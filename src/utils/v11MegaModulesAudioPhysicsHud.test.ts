import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEALERSHIP_VEHICLES, PRESET_VEHICLES } from '../data/presetVehicles.ts';
import { ASUNCION_CIRCUITS, toRaceTrack } from '../data/asuncionCircuits.ts';
import { InteractiveRacePhysics, PHYSICS_STEP } from './interactiveRacePhysics.ts';
import { FourCornerSuspension } from './roadSuspension.ts';
import { brakingResponse } from './brakingDynamics.ts';
import { getVehicleDynamicsProfile } from './vehicleDynamicsProfile.ts';
import { evaluateAdasHudReadout } from './adasPresentationAudit.ts';
import {
  resolveMobileSfxGainMultiplier,
  MOBILE_SFX_BOOST_MULTIPLIER,
  ENGINE_MASTER_GAIN,
  RAIN_GAIN_BY_WEATHER,
  computeEngineVoiceLevels,
  computeBrakingAudioLevels,
  resolveAudioProfile,
} from './soundEngine.ts';
import {
  clearRoadPathCache,
  getRoadPathCacheSize,
  makeRoadPath,
} from './curvedRoadPath.ts';
import {
  BGM_DUCK_FACTOR,
  BGM_RACE_FADE_IN_SECONDS,
  BGM_RACE_VOLUME,
  BGM_TRACKS,
  computeBgmDuckMultiplier,
  resolveBgmSceneTrack,
  shouldIgnoreInteractionUnlock,
  type BgmDuckReason,
} from './bgmAudioManager.ts';

test('Module 4 — Dynamic Mass increases CoM height, body roll, and braking distance', () => {
  const car = PRESET_VEHICLES[0];
  const dryProfile = getVehicleDynamicsProfile(car, 0, 22);
  const loadedProfile = getVehicleDynamicsProfile(car, 360, 22);
  assert.ok(loadedProfile.massKg > dryProfile.massKg);
  assert.ok(loadedProfile.cgHeightM > dryProfile.cgHeightM, 'Cargo/passengers raise CoM height');

  // Suspension body roll increases under identical lateral acceleration with loaded mass
  const suspLight = new FourCornerSuspension();
  const suspHeavy = new FourCornerSuspension();
  let rollLight = 0;
  let rollHeavy = 0;
  for (let i = 0; i < 40; i++) {
    rollLight = suspLight.step({
      x: 0, z: i * 0.25, yaw: 0, speed: 18, dt: PHYSICS_STEP,
      wheelbaseM: dryProfile.wheelbaseM, trackWidthM: 1.55,
      massKg: dryProfile.massKg, lateralAccelMps2: 5.5,
      hazards: [], bumps: [],
    }).rollRad;
    rollHeavy = suspHeavy.step({
      x: 0, z: i * 0.25, yaw: 0, speed: 18, dt: PHYSICS_STEP,
      wheelbaseM: loadedProfile.wheelbaseM, trackWidthM: 1.55,
      massKg: loadedProfile.massKg, lateralAccelMps2: 5.5,
      hazards: [], bumps: [],
    }).rollRad;
  }
  assert.ok(
    Math.abs(rollHeavy) > Math.abs(rollLight) * 1.1,
    `Heavy load should create greater body roll (heavy=${rollHeavy}, light=${rollLight})`,
  );

  // Full braking distance comparison from ~90 km/h on dry road
  const track = toRaceTrack(ASUNCION_CIRCUITS[0], 1);
  const measureStoppingDistance = (payloadKg: number) => {
    const sim = new InteractiveRacePhysics([car], track, car.id, false, {
      urbanTrafficRules: false,
      playerPayloadKg: payloadKg,
    });
    sim.setWeather('sunny');
    const c = sim.getCar(car.id)!;
    c.speed = 25; // 90 km/h
    const startZ = c.z;
    for (let step = 0; step < 500 && c.speed > 0.2; step++) {
      sim.step(PHYSICS_STEP, { steer: 0, throttle: 0, brake: 1 });
    }
    return c.z - startZ;
  };

  const lightStopM = measureStoppingDistance(0);
  const heavyStopM = measureStoppingDistance(420);
  assert.ok(
    heavyStopM > lightStopM + 1.0,
    `Loaded vehicle must stop longer (light=${lightStopM.toFixed(2)}m, heavy=${heavyStopM.toFixed(2)}m)`,
  );
});

test('Module 4 — ABS modulates brake pulsing under extreme slip to prevent lockup and retain steering', () => {
  const absCar = PRESET_VEHICLES[0]; // Tracker / SUV with documented ABS
  const t1 = brakingResponse({
    vehicle: absCar,
    speedMps: 22,
    pedal: 0.95,
    availableLongitudinalAccel: 3.1, // wet/slippery limit below demanded ~9 m/s2
    requestedMaxDeceleration: 9.2,
    timeSeconds: 1.0,
  });
  const t2 = brakingResponse({
    vehicle: absCar,
    speedMps: 22,
    pedal: 0.95,
    availableLongitudinalAccel: 3.1,
    requestedMaxDeceleration: 9.2,
    timeSeconds: 1.021, // ~half cycle of 24 Hz modulation
  });
  assert.equal(t1.absActive, true);
  assert.equal(t1.lockSeverity, 0, 'ABS prevents total wheel lockup');
  assert.ok(t1.steeringRetention >= 0.82, 'ABS preserves steering authority');
  assert.notEqual(
    Number(t1.deceleration.toFixed(4)),
    Number(t2.deceleration.toFixed(4)),
    'ABS dynamically pulses braking deceleration across modulation cycle',
  );
});

test('Module 4 — Raudal hydroplaning drops grip near zero, applies severe fluid drag and lateral current', () => {
  const car = PRESET_VEHICLES[0];
  const circuit =
    ASUNCION_CIRCUITS.find(c => toRaceTrack(c, 1).routeHazardProfile === 'flood') ||
    ASUNCION_CIRCUITS[0];
  const track = toRaceTrack(circuit, 1);
  const sim = new InteractiveRacePhysics([car], track, car.id, false, {
    urbanTrafficRules: true,
    playerPayloadKg: 75,
  });
  sim.setWeather('flood');
  const zone = sim.waterZones[0];
  assert.ok(zone, 'Flood mode provides localized waterZones');

  const c = sim.getCar(car.id)!;
  c.x = zone.x;
  c.z = zone.z;
  c.speed = 24; // ~86 km/h straight into deep raudal

  for (let i = 0; i < 6; i++) {
    sim.step(PHYSICS_STEP, { steer: 0, throttle: 0.4, brake: 0 });
  }

  assert.equal(c.hydroplaningActive, true, 'High-speed raudal entry activates hydroplaning');
  assert.ok(c.raudalDragN > 1200, `Raudal applies severe water drag (got ${c.raudalDragN} N)`);
  assert.ok(c.raudalFlowForceN > 500, `Raudal applies lateral current force (got ${c.raudalFlowForceN} N)`);
  assert.ok(Math.abs(c.lateralSpeed) > 0.05, 'Lateral current imparts lateral drift velocity');
});

test('Module 5 — ADAS detects pedestrian + traffic targets in forward corridor with TTC flash & chime', () => {
  const kicks = PRESET_VEHICLES.find(v => v.id === 'nissan-kicks-2027') ?? PRESET_VEHICLES[2];
  const pedAlert = evaluateAdasHudReadout({
    vehicle: kicks,
    playerX: -4.2,
    playerZ: 100,
    playerSpeedKmh: 54, // 15 m/s
    targets: [
      {
        id: 'crosswalk_ped_1',
        kind: 'pedestrian',
        x: -4.0,
        z: 118, // 18 m ahead -> net ~15.5m -> TTC ~1.03s -> imminent collision_warning
        longitudinalSpeedMps: 0,
      },
    ],
  });
  assert.equal(pedAlert.targetKind, 'pedestrian');
  assert.equal(pedAlert.level, 'collision_warning');
  assert.equal(pedAlert.shouldFlash, true);
  assert.equal(pedAlert.shouldChime, true);
  assert.ok(pedAlert.ttcSeconds !== null && pedAlert.ttcSeconds <= 1.5);
});

test('Module 6 — Mobile 30% GainNode boost and Global BGM Manager menu loop, 4s race fade-in, and ADAS/Jail ducking', () => {
  assert.equal(resolveMobileSfxGainMultiplier(true), 1.3);
  assert.equal(MOBILE_SFX_BOOST_MULTIPLIER, 1.3);
  assert.equal(resolveMobileSfxGainMultiplier(false), 1.0);

  for (const menuStage of ['intro', 'home', 'garage', 'compare', 'compare-choose', 'circuits', 'briefing']) {
    const sel = resolveBgmSceneTrack({ screenOrStage: menuStage });
    assert.equal(sel.mode, 'menu');
    assert.equal(sel.trackUrl, BGM_TRACKS.menu);
  }

  const raceSel = resolveBgmSceneTrack({ screenOrStage: 'race-run', circuitId: 'oliva' });
  assert.equal(raceSel.mode, 'race');
  assert.ok(raceSel.trackUrl === BGM_TRACKS.racePrimary || raceSel.trackUrl === BGM_TRACKS.raceSecondary);
  assert.ok(
    BGM_RACE_FADE_IN_SECONDS >= 3 && BGM_RACE_FADE_IN_SECONDS <= 5,
    `Race fade-in must be between 3 and 5 seconds (got ${BGM_RACE_FADE_IN_SECONDS}s)`,
  );

  const noDuck = new Set<BgmDuckReason>();
  const adasDuck = new Set<BgmDuckReason>(['adas']);
  const jailDuck = new Set<BgmDuckReason>(['jail']);
  assert.equal(computeBgmDuckMultiplier(noDuck), 1.0);
  assert.equal(computeBgmDuckMultiplier(adasDuck), BGM_DUCK_FACTOR);
  assert.equal(computeBgmDuckMultiplier(jailDuck), BGM_DUCK_FACTOR);
  assert.ok(BGM_DUCK_FACTOR < 0.4);
});

test('BGM Interaction Guard — UI clicks/touches/keydowns ignore unlock when active track is already playing', () => {
  // Active playback on same track & running AudioContext -> MUST ignore interaction event
  assert.equal(
    shouldIgnoreInteractionUnlock({
      isPlaying: true,
      currentTrack: BGM_TRACKS.menu,
      targetTrack: BGM_TRACKS.menu,
      muted: false,
      elementPaused: false,
      elementEnded: false,
      contextState: 'running',
    }),
    true,
  );

  // Muted -> ignore unlock so muting never restarts audio
  assert.equal(
    shouldIgnoreInteractionUnlock({
      isPlaying: false,
      currentTrack: BGM_TRACKS.menu,
      targetTrack: BGM_TRACKS.menu,
      muted: true,
      elementPaused: true,
      contextState: 'suspended',
    }),
    true,
  );

  // Not yet playing / paused / suspended AudioContext / switched track -> allow unlock/play
  assert.equal(
    shouldIgnoreInteractionUnlock({
      isPlaying: false,
      currentTrack: BGM_TRACKS.menu,
      targetTrack: BGM_TRACKS.menu,
      muted: false,
      elementPaused: true,
      contextState: 'suspended',
    }),
    false,
  );
  assert.equal(
    shouldIgnoreInteractionUnlock({
      isPlaying: true,
      currentTrack: BGM_TRACKS.menu,
      targetTrack: BGM_TRACKS.racePrimary,
      muted: false,
      elementPaused: false,
      contextState: 'running',
    }),
    false,
  );
});

test('On-Demand Circuit Spline Cache — builds per selected circuit and reuses Map cache without preloading all 6', () => {
  clearRoadPathCache();
  assert.equal(getRoadPathCacheSize(), 0);

  const trackA = toRaceTrack(ASUNCION_CIRCUITS[0], 1);
  const pathA1 = makeRoadPath(trackA);
  assert.equal(getRoadPathCacheSize(), 1, 'Only requested circuit spline is materialized initially');

  const pathA2 = makeRoadPath(trackA);
  assert.equal(pathA1, pathA2, 'Revisit returns cached CurvedRoadPath instance');
  assert.equal(getRoadPathCacheSize(), 1);

  const trackB = toRaceTrack(ASUNCION_CIRCUITS[2], 2);
  const pathB = makeRoadPath(trackB);
  assert.notEqual(pathA1, pathB);
  assert.equal(getRoadPathCacheSize(), 2);
});

test('Code-Splitting Architecture — Entry screens defer 3D engine & secondary screens via React.lazy + Suspense', () => {
  const rootDir = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '../..');
  const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8');
  const introSrc = fs.readFileSync(path.join(rootDir, 'src/components/IntroSplash.tsx'), 'utf8');
  const mobileSrc = fs.readFileSync(
    path.join(rootDir, 'src/components/mobile/MobileGameExperience.tsx'),
    'utf8',
  );

  for (const [label, src] of [
    ['App.tsx', appSrc],
    ['IntroSplash.tsx', introSrc],
    ['MobileGameExperience.tsx', mobileSrc],
  ] as const) {
    assert.ok(src.includes('lazy('), `${label} must declare React.lazy split components`);
    assert.ok(src.includes('<Suspense'), `${label} must wrap lazy views in Suspense boundaries`);
    assert.ok(
      !/^import\s+.*from\s+['"]three['"]/m.test(src),
      `${label} must not statically import Three.js into the initial bundle`,
    );
    assert.ok(
      !/^import\s+.*from\s+['"].*vehicle3DModelLoader['"]/m.test(src),
      `${label} must import vehicle3DModelLoader dynamically on demand`,
    );
  }
});

test('Audio Pipeline — BGM uses direct HTMLAudioElement volume envelope and soundEngine avoids suspending AudioContext on stopAll', () => {
  const rootDir = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '../..');
  const bgmSrc = fs.readFileSync(path.join(rootDir, 'src/utils/bgmAudioManager.ts'), 'utf8');
  const sfxSrc = fs.readFileSync(path.join(rootDir, 'src/utils/soundEngine.ts'), 'utf8');
  const raceSrc = fs.readFileSync(path.join(rootDir, 'src/components/Race3DPerspectiveView.tsx'), 'utf8');

  assert.ok(
    !bgmSrc.includes('createMediaElementSource'),
    'bgmAudioManager must not hijack HTMLAudioElement via createMediaElementSource (silences BGM when AudioContext is suspended)',
  );
  assert.ok(
    bgmSrc.includes("'click'") && bgmSrc.includes("'touchend'"),
    'bgmAudioManager must bind click and touchend in addition to pointerdown/keydown for iOS Safari & Chrome autoplay unlock',
  );
  assert.ok(
    !sfxSrc.includes('ctx.suspend()'),
    'soundEngine.stopAll must silence and disconnect voices without suspending AudioContext',
  );
  assert.ok(
    sfxSrc.includes('bindGestureUnlock'),
    'soundEngine must bind user gesture unlock listeners so engine/countdown SFX always resume cleanly',
  );
  const preStartMatch = raceSrc.match(/if\s*\(!startRequested\s*\|\|\s*isPreloading\)\s*\{[\s\S]{0,260}\}/);
  assert.ok(
    Boolean(preStartMatch && preStartMatch[0].includes('soundEngine.stopCountdownTones()')),
    'Race3DPerspectiveView pre-start cleanup must use stopCountdownTones() instead of soundEngine.stopAll() right as countdown begins',
  );
});

test('Audit HUD Layout — uses dedicated responsive .dc-audit-hud dock (no top-14 left-3 overlap on minimap or mirrors)', () => {
  const rootDir = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '../..');
  const raceSrc = fs.readFileSync(path.join(rootDir, 'src/components/Race3DPerspectiveView.tsx'), 'utf8');
  const cssSrc = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');

  const auditTagMatch = raceSrc.match(/data-testid="audit-mode-telemetry-hud"[\s\S]{0,240}className="([^"]+)"/);
  assert.ok(auditTagMatch, 'audit-mode-telemetry-hud element exists');
  assert.ok(auditTagMatch![1].includes('dc-audit-hud'), 'audit-mode-telemetry-hud uses .dc-audit-hud responsive class');
  assert.ok(!auditTagMatch![1].includes('top-14 left-3'), 'audit-mode-telemetry-hud must not overlap minimap at top-14 left-3');
  assert.ok(cssSrc.includes('.dc-audit-hud'), 'index.css defines responsive .dc-audit-hud placement for desktop & mobile');
});

test('Engine Loudness vs Music — calm low idle purr while full-throttle roars strongly above BGM', () => {
  assert.ok(ENGINE_MASTER_GAIN >= 0.9, 'Engine master bus must run near unity behind compressor/limiter');
  assert.ok(BGM_RACE_VOLUME <= 0.3, 'Race BGM volume stays balanced so it does not mask engine audio');

  // Every dealership vehicle (all 7 models) must resolve to a multi-clip WAV profile
  for (const car of DEALERSHIP_VEHICLES) {
    const profile = resolveAudioProfile(car);
    assert.ok(profile, `Dealership vehicle ${car.id} must resolve to an AudioProfile`);
  }

  const idlePlayer = computeEngineVoiceLevels({
    focus: true,
    throttle: 0,
    rpm: 900,
    kmh: 0,
    hasSampledClips: true,
  });
  const wotPlayer = computeEngineVoiceLevels({
    focus: true,
    throttle: 1,
    rpm: 4600,
    kmh: 110,
    hasSampledClips: true,
  });
  const rivalAi = computeEngineVoiceLevels({
    focus: false,
    throttle: 1,
    rpm: 4600,
    kmh: 110,
    hasSampledClips: true,
  });

  // Native WAV RMS is ~0.24, commercial MP3 RMS is ~0.45
  const estMusicRms = BGM_RACE_VOLUME * 0.45;
  const estEngineIdleRms = ENGINE_MASTER_GAIN * (idlePlayer.sampledLevel * 0.24 + idlePlayer.synthGain * 0.35);
  const estEngineWotRms = ENGINE_MASTER_GAIN * (wotPlayer.sampledLevel * 0.24 + wotPlayer.synthGain * 0.35);

  assert.ok(
    idlePlayer.sampledLevel <= 0.28 && estEngineIdleRms < estMusicRms,
    `Player idle engine (${estEngineIdleRms.toFixed(3)}) must stay calm and lower than race music (${estMusicRms.toFixed(3)})`,
  );
  assert.ok(
    wotPlayer.sampledLevel >= idlePlayer.sampledLevel * 5.5 && estEngineWotRms >= estMusicRms * 2.2,
    `Player full-throttle engine (${estEngineWotRms.toFixed(3)}) must roar strongly above race music (${estMusicRms.toFixed(3)})`,
  );
  assert.ok(
    wotPlayer.sampledLevel > rivalAi.sampledLevel * 10,
    'Player engine voice must dominate over background AI traffic voices',
  );
});

test('Braking, Subtle ABS & Weather Audio — hard braking triggers tire scrub + subtle 14Hz ABS and wet weather scales rain', () => {
  // Gentle braking stays quiet (no premature screech)
  const gentleBrake = computeBrakingAudioLevels({
    focus: true,
    brakeIntensity: 0.25,
    kmh: 48,
    brakeSlip: 0.12,
    tireSlip: 0.05,
    absActive: false,
    timeSec: 1.0,
  });
  assert.equal(gentleBrake.brakeGain, 0);
  assert.equal(gentleBrake.absGain, 0);

  // Abrupt/hard braking with ABS active produces strong brake friction + subtle ABS pulse
  const hardBrakeAbsPeak = computeBrakingAudioLevels({
    focus: true,
    brakeIntensity: 1.0,
    kmh: 88,
    brakeSlip: 0.65,
    tireSlip: 0.32,
    absActive: true,
    timeSec: 0.25 / 14, // sin(pi/2) = +1 peak of 14 Hz ABS modulation
  });
  const hardBrakeAbsTrough = computeBrakingAudioLevels({
    focus: true,
    brakeIntensity: 1.0,
    kmh: 88,
    brakeSlip: 0.65,
    tireSlip: 0.32,
    absActive: true,
    timeSec: 0.75 / 14, // sin(3pi/2) = -1 trough of 14 Hz ABS modulation
  });
  assert.ok(hardBrakeAbsPeak.brakeGain > 0.4, `Hard braking must produce clear brake friction (${hardBrakeAbsPeak.brakeGain})`);
  assert.ok(
    hardBrakeAbsPeak.absGain > 0.08 && hardBrakeAbsPeak.absGain < 0.16,
    `ABS sound must be clearly perceptible yet subtle (${hardBrakeAbsPeak.absGain})`,
  );
  assert.ok(
    hardBrakeAbsPeak.absGain < hardBrakeAbsPeak.brakeGain * 0.4,
    'ABS pulse stays subtle relative to primary hard-braking sound',
  );
  assert.ok(
    hardBrakeAbsPeak.absGain > hardBrakeAbsTrough.absGain * 2.0,
    'ABS sound pulses dynamically at 14 Hz',
  );

  // Hard braking without ABS has brake sound + tire skid, zero ABS pulse
  const hardBrakeNoAbs = computeBrakingAudioLevels({
    focus: true,
    brakeIntensity: 1.0,
    kmh: 88,
    brakeSlip: 0.75,
    tireSlip: 0.45,
    absActive: false,
    timeSec: 0.25 / 14,
  });
  assert.ok(hardBrakeNoAbs.brakeGain > 0.4);
  assert.equal(hardBrakeNoAbs.absGain, 0);

  // Weather rain ambient levels are clearly audible in wet modes and silent when dry
  assert.equal(RAIN_GAIN_BY_WEATHER.sunny, 0);
  assert.equal(RAIN_GAIN_BY_WEATHER.dawn, 0);
  assert.equal(RAIN_GAIN_BY_WEATHER.cloudy, 0);
  assert.ok(RAIN_GAIN_BY_WEATHER.rain >= 0.24, `Rain level must be clearly audible (${RAIN_GAIN_BY_WEATHER.rain})`);
  assert.ok(RAIN_GAIN_BY_WEATHER.flood > RAIN_GAIN_BY_WEATHER.rain);
  assert.ok(RAIN_GAIN_BY_WEATHER.storm > RAIN_GAIN_BY_WEATHER.flood);
});



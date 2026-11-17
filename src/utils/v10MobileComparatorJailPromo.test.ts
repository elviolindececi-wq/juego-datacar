import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PRESET_VEHICLES } from '../data/presetVehicles';
import { ASUNCION_CIRCUITS, toRaceTrack } from '../data/asuncionCircuits';
import {
  executeLandscapeRotationFlow,
  resetOrientationStateForTests,
} from './iosOrientationManager';
import {
  DATACAR_PROMO_DOMAIN,
  DATACAR_PROMO_URL,
  JAIL_EXACT_MESSAGE,
  JAIL_PENALTY_MS,
  JAIL_PENALTY_SECONDS,
  POST_RACE_PROMO_EXACT_MESSAGE,
  hasInvalidMissingDataLabel,
  resolveComparatorVehicleStats,
} from './comparatorHelpers';
import { computeDownscaledDimensions } from './comparatorSharedWebGL';
import { JAIL_DURATION_MS } from './careerProgression';
import { InteractiveRacePhysics } from './interactiveRacePhysics';
import { evaluateCrosswalkPedestrians } from './urbanTrafficRules';

test('1. iOS Orientation Lock Fix: requests Fullscreen BEFORE orientation.lock("landscape") and falls back to CSS rotate(90deg)', async () => {
  resetOrientationStateForTests();
  const callOrder: string[] = [];
  const iosBlockedResult = await executeLandscapeRotationFlow({
    isPortraitViewport: () => true,
    requestFullscreen: async () => {
      callOrder.push('requestFullscreen');
      return false;
    },
    lockLandscape: async () => {
      callOrder.push('lockLandscape');
      return false;
    },
  });

  assert.deepEqual(
    callOrder,
    ['requestFullscreen', 'lockLandscape'],
    'Must attempt requestFullscreen() first, then screen.orientation.lock("landscape")',
  );
  assert.equal(iosBlockedResult.mode, 'css-rotate-90');
  assert.equal(iosBlockedResult.softwareRotated, true);
  assert.equal(iosBlockedResult.showIosUnlockHint, true);

  // Toggling again while softwareRotated is active disables CSS rotation cleanly
  const toggledOff = await executeLandscapeRotationFlow({
    isPortraitViewport: () => true,
    requestFullscreen: async () => false,
    lockLandscape: async () => false,
  });
  assert.equal(toggledOff.softwareRotated, false);
  assert.equal(toggledOff.mode, 'none');

  // Native Android/Desktop path where Fullscreen + orientation.lock succeed and viewport rotates
  const nativeCallOrder: string[] = [];
  const nativeResult = await executeLandscapeRotationFlow({
    isPortraitViewport: () => false,
    requestFullscreen: async () => {
      nativeCallOrder.push('fullscreen');
      return true;
    },
    lockLandscape: async () => {
      nativeCallOrder.push('lock');
      return true;
    },
  });
  assert.deepEqual(nativeCallOrder, ['fullscreen', 'lock']);
  assert.equal(nativeResult.mode, 'native-landscape');
  assert.equal(nativeResult.softwareRotated, false);
  resetOrientationStateForTests();
});

test('2 & 3. Comparator Data Fallback Logic: zero "sin datos" / "No especificado" / "No alcanzado" across all vehicles', () => {
  assert.ok(PRESET_VEHICLES.length >= 4);

  for (const vehicle of PRESET_VEHICLES) {
    // Case A: No dynamic race result available at all
    const staticOnly = resolveComparatorVehicleStats(vehicle, undefined);
    const allFields = [
      staticOnly.accel0to100Display,
      staticOnly.topSpeedDisplay,
      staticOnly.powerDisplay,
      staticOnly.torqueDisplay,
      staticOnly.weightDisplay,
      staticOnly.consumptionDisplay,
      staticOnly.brakingDisplay,
      staticOnly.clearanceDisplay,
      staticOnly.fuelCapacityDisplay,
      staticOnly.tireSizeDisplay,
      staticOnly.priceDisplay,
    ];
    for (const value of allFields) {
      assert.equal(
        hasInvalidMissingDataLabel(value),
        false,
        `Vehicle ${vehicle.id} produced forbidden missing-data text: "${value}"`,
      );
      assert.ok(value.trim().length > 0);
    }

    // Case B: Dynamic result exists but time0to100 is null (short track) -> falls back via ?? to vehicle.accel0100
    const nullDynamic = resolveComparatorVehicleStats(vehicle, {
      vehicle,
      finishPosition: 1,
      finishTimeSec: 18.4,
      gapSec: 0,
      topSpeedAchievedKmh: 0,
      trapSpeedKmh: 92,
      time0to100: null,
      time0to200: null,
      time400m: null,
      fuelBurned: 0.4,
      fuelRemaining: 45,
      effectivePowerToWeight: 110,
      verdict: 'OK',
      telemetryHistory: [],
    });
    assert.equal(nullDynamic.accel0to100Sec, vehicle.accel0100);
    assert.equal(nullDynamic.topSpeedKmh, vehicle.topSpeedKmh);
    assert.equal(hasInvalidMissingDataLabel(nullDynamic.accel0to100Display), false);

    // Case C: Dynamic result has valid positive time0to100 -> uses dynamic measurement via ??
    const validDynamic = resolveComparatorVehicleStats(vehicle, {
      vehicle,
      finishPosition: 1,
      finishTimeSec: 16.2,
      gapSec: 0,
      topSpeedAchievedKmh: vehicle.topSpeedKmh + 4.5,
      trapSpeedKmh: 170.0,
      time0to100: 8.65,
      time0to200: null,
      time400m: 16.2,
      fuelBurned: 0.5,
      fuelRemaining: 44,
      effectivePowerToWeight: 112,
      verdict: 'OK',
      telemetryHistory: [],
    });
    assert.equal(validDynamic.accel0to100Sec, 8.65);
    assert.equal(validDynamic.topSpeedKmh, vehicle.topSpeedKmh + 4.5);
  }
});

test('4. Comparator 3D Performance: THREE.Cache enabled and texture downscaling caps UI textures at 512px on mobile', () => {
  assert.equal(THREE.Cache.enabled, true, 'THREE.Cache.enabled must be true globally');

  const square2k = computeDownscaledDimensions(2048, 2048, 512);
  assert.deepEqual(square2k, { width: 512, height: 512, scaled: true });

  const rect4k = computeDownscaledDimensions(4096, 2048, 512);
  assert.deepEqual(rect4k, { width: 512, height: 256, scaled: true });

  const alreadySmall = computeDownscaledDimensions(512, 256, 512);
  assert.deepEqual(alreadySmall, { width: 512, height: 256, scaled: false });
});

test('5. Pedestrian Collision & 30-Second Jail Penalty: locks car movement for 30s, keeps race alive, and restores controls at 0s', () => {
  assert.equal(JAIL_PENALTY_SECONDS, 30);
  assert.equal(JAIL_PENALTY_MS, 30_000);
  assert.equal(JAIL_DURATION_MS, 30_000);
  assert.equal(
    JAIL_EXACT_MESSAGE,
    '¡Atropellaste a un peatón! Estás en la cárcel por 30 segundos. Mientras esperas, visitá www.datacarpy.com para comparar autos reales del mercado paraguayo.',
  );

  const circuit = ASUNCION_CIRCUITS[0];
  const track = toRaceTrack(circuit, 1);
  const playerVehicle = PRESET_VEHICLES[0];
  const physics = new InteractiveRacePhysics([playerVehicle], track, playerVehicle.id, false, {
    urbanTrafficRules: true,
    speedRaceMode: false,
  });

  // Find a moment when at least one crosswalk pedestrian is actively in the roadway
  let activePed: ReturnType<typeof evaluateCrosswalkPedestrians>[number] | undefined;
  for (let t = 0; t < 45 && !activePed; t += 0.5) {
    physics.time = t;
    const peds = evaluateCrosswalkPedestrians(physics.trafficLights, physics.time, physics.roadHalfWidth);
    activePed = peds.find(p => p.inRoadway);
  }
  assert.ok(activePed, 'Expected at least one crossing pedestrian during red light cycle');

  const playerCar = physics.getCar(playerVehicle.id)!;
  playerCar.x = activePed.x;
  playerCar.z = activePed.z;
  playerCar.speed = 11; // ~40 km/h into pedestrian

  const fullThrottle = { steer: 0, throttle: 1, brake: 0, reverse: 0 };
  physics.step(0.02, fullThrottle);

  // Immediately arrested for 30s, car immobilized, race NOT marked finished
  assert.ok(physics.pedestrianArrest !== null, 'Pedestrian collision must trigger arrest incident');
  assert.ok(physics.pedestrianJailRemainingSec > 29.9 && physics.pedestrianJailRemainingSec <= 30);
  assert.equal(playerCar.speed, 0, 'Car speed must be immediately zeroed on pedestrian collision');
  assert.equal(physics.playerFinished, false, 'Race must remain active during 30s jail penalty');

  // Step 10 seconds while holding full throttle — car must stay completely immobilized
  for (let i = 0; i < 500; i++) {
    physics.step(0.02, fullThrottle);
  }
  assert.ok(physics.pedestrianJailRemainingSec > 19.5 && physics.pedestrianJailRemainingSec < 20.5);
  assert.ok(Math.abs(playerCar.speed) < 0.05, 'Car must not move while 30s jail timer is active');

  // Step remaining ~20.2 seconds to reach 0s countdown
  for (let i = 0; i < 1015; i++) {
    physics.step(0.02, fullThrottle);
  }
  assert.equal(physics.pedestrianJailRemainingSec, 0, 'Jail timer must reach 0 after 30s');
  assert.equal(physics.pedestrianArrest, null, 'Arrest state must clear when 30s countdown reaches 0');

  // Now step 1 second with throttle — car controls are restored and speed increases!
  for (let i = 0; i < 50; i++) {
    physics.step(0.02, fullThrottle);
  }
  assert.ok(playerCar.speed > 1.0, `Expected car controls restored after 30s penalty, got speed=${playerCar.speed}`);
});

test('6. Post-Race Promotional CTA: matches exact required Spanish copy and www.datacarpy.com link', () => {
  assert.equal(DATACAR_PROMO_URL, 'https://www.datacarpy.com');
  assert.equal(DATACAR_PROMO_DOMAIN, 'www.datacarpy.com');
  assert.equal(
    POST_RACE_PROMO_EXACT_MESSAGE,
    '¿Querés dejar los jueguitos y comprar estos autos en la vida real? No olvides ingresar a www.datacarpy.com',
  );
});

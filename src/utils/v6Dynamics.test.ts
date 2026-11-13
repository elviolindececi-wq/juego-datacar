import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_VEHICLES } from '../data/presetVehicles';
import {
  evaluateCircuitTimeResult,
  formatTargetMinutesSec,
  getCircuitTargetTime,
} from './circuitTargetTimes';
import {
  clampPayloadSelection,
  computePayloadHandlingInsight,
  computePayloadKg,
} from './payloadConfig';
import {
  CENTRAL_MEDIAN_HALF_WIDTH_M,
  computeCentralMedianSpans,
  resolveCentralMedianCollision,
} from './centralMedianCollision';
import {
  CUSTOM_VEHICLE_ID,
  buildVehicleFromCustomInput,
  createDefaultCustomVehicleInput,
  renderGenericCarPngPreview,
} from './customVehicleStore';
import {
  CITY_UNLOCK_MIN_IQ,
  evaluateCityTrialCompletion,
  formatJailCountdown,
} from './careerProgression';

test('circuitTargetTimes: calcula tiempos objetivos desafiantes y medallas coherentes', () => {
  const city1 = getCircuitTargetTime('aviadores', 'city_trial', 1);
  const city2 = getCircuitTargetTime('aviadores', 'city_trial', 2);
  const pro1 = getCircuitTargetTime('aviadores', 'speed_pro', 1);

  assert.ok(city1.targetSec > 60 && city1.maxLimitSec > city1.targetSec);
  assert.ok(city2.targetSec >= city1.targetSec * 1.9);
  assert.ok(pro1.targetSec < city1.targetSec, 'Fase 2 sin semáforos debe ser más veloz');
  assert.equal(formatTargetMinutesSec(125), '2:05');

  const gold = evaluateCircuitTimeResult(city1.targetSec - 1.5, city1);
  assert.equal(gold.medal, 'gold');
  assert.equal(gold.iqBonus, 50);

  const silver = evaluateCircuitTimeResult(city1.targetSec + 5, city1);
  assert.equal(silver.medal, 'silver');
  assert.equal(silver.iqBonus, 15);

  const late = evaluateCircuitTimeResult(city1.maxLimitSec + 4, city1);
  assert.equal(late.medal, 'over_limit');
  assert.equal(late.iqBonus, -20);
});

test('payloadConfig: limita ocupantes según plazas del vehículo y calcula masa extra', () => {
  const carens = PRESET_VEHICLES.find((v) => v.id === 'kia-carens-ex');
  const fronx = PRESET_VEHICLES.find((v) => v.id === 'suzuki-fronx');
  assert.ok(carens && fronx);

  const clampedCarens = clampPayloadSelection({ occupants: 7, luggageTier: 'full' }, carens);
  assert.equal(clampedCarens.occupants, 7);

  const clampedFronx = clampPayloadSelection({ occupants: 7, luggageTier: 'full' }, fronx);
  assert.equal(clampedFronx.occupants, fronx.equipment.seatingCapacity);

  const soloKg = computePayloadKg({ occupants: 1, luggageTier: 'none' }, carens);
  assert.equal(soloKg, 0);

  const loadedKg = computePayloadKg({ occupants: 5, luggageTier: 'full' }, carens);
  assert.equal(loadedKg, 4 * 75 + 90);

  const insight = computePayloadHandlingInsight({ occupants: 5, luggageTier: 'full' }, carens);
  assert.ok(insight.accelPenaltyPct > 0);
  assert.ok(insight.brakingExtensionPct > 0);
  assert.ok(insight.iqCleanLoadBonus > 0);
});

test('centralMedianCollision: deflecta el vehículo rígidamente fuera de aperturas peatonales', () => {
  const spans = computeCentralMedianSpans({
    trackDistanceMeters: 1200,
    lights: [{ id: 'tl-1', label: 'Semáforo 1', z: 320, cycleSec: 18, greenSec: 8, yellowSec: 3, phaseOffsetSec: 0 }],
    crossingZs: [320],
  });
  assert.ok(spans.length >= 2, 'Debe abrir paso alrededor del cruce peatonal');

  const span0 = spans[0];
  const carScrape = {
    z: span0.fromS + 14,
    x: -0.65,
    speed: 22,
    lateralSpeed: 2,
    damage: 0,
    bump: 0,
    impacts: 0,
    widthM: 1.84,
  };
  const scrapeRes = resolveCentralMedianCollision(carScrape, spans);
  assert.equal(scrapeRes.hit, true);
  assert.equal(scrapeRes.hitType, 'lateral_scrape');
  assert.ok(carScrape.x < -CENTRAL_MEDIAN_HALF_WIDTH_M);
  assert.ok(carScrape.speed < 22 && carScrape.speed > 10);

  const carCrosswalk = {
    z: 320,
    x: 0.1,
    speed: 18,
    lateralSpeed: 0,
    damage: 0,
    bump: 0,
    impacts: 0,
  };
  const gapRes = resolveCentralMedianCollision(carCrosswalk, spans);
  assert.equal(gapRes.hit, false);
});

test('customVehicleStore: genera ficha válida y preview PNG/SVG sin requerir GLB', () => {
  const input = {
    ...createDefaultCustomVehicleInput(),
    name: 'MI SUV PRUEBA',
    powerHp: 210,
    seatingCapacity: 6,
    color: '#ef4444',
  };
  const car = buildVehicleFromCustomInput(input);
  assert.equal(car.id, CUSTOM_VEHICLE_ID);
  assert.equal(car.isCustom, true);
  assert.equal(car.powerHp, 210);
  assert.equal(car.equipment.seatingCapacity, 6);
  assert.ok(car.imageUrl && car.imageUrl.startsWith('data:image/svg+xml'));
  assert.ok(renderGenericCarPngPreview('#10b981', 'TEST').includes('%2310b981'));
});

test('careerProgression: modo practice_free nunca desbloquea Fase 2 y formatea cárcel', () => {
  const res = evaluateCityTrialCompletion({
    finished: true,
    isDnf: false,
    pedestrianHit: false,
    iqScore1000: CITY_UNLOCK_MIN_IQ + 150,
    redLightViolations: 0,
    circuitId: 'aviadores',
    raceMode: 'practice_free',
  });
  assert.equal(res.qualifiesThisRun, false);
  assert.equal(res.newlyUnlocked, false);
  assert.equal(formatJailCountdown(120), '02:00');
});

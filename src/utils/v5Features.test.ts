import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_VEHICLES } from '../data/presetVehicles';
import {
  NOT_SPECIFIED_LABEL,
  formatOfficialPower,
  formatOfficialTorque,
  formatOfficialClearance,
  formatOfficialConsumption,
  formatOfficialOrSimAccel,
  formatOfficialTopSpeed,
  formatOfficialWeight,
  formatOfficialBraking,
  formatOfficialFuelCapacity,
  formatOfficialPriceUsd,
  formatShortTransmission,
} from './specFidelity';
import {
  createStuckDetectorState,
  stepStuckDetector,
  acknowledgeKeepTrying,
  resetStuckDetectorState,
} from './useVehicleStuckDetection';
import {
  applyTurnSignalAction,
  mapKeyCodeToTurnSignalAction,
  evaluateTurnSignalBlink,
  TURN_SIGNAL_PERIOD_SEC,
} from './turnSignalsController';
import {
  shouldBuildCentralMedian,
  computeCentralMedianSpans,
  CENTRAL_MEDIAN_HALF_WIDTH_M,
} from './centralMedianVisuals3D';
import {
  createForwardMotorcyclePool,
  stepForwardMotorcycles,
} from './forwardMotorcycleTraffic';
import {
  getAuditedAdasProfile,
  computeCoherentTtcSeconds,
  evaluateAdasHudReadout,
} from './adasPresentationAudit';
import { enableTireShowroom, INITIAL_TIRE_SHOWROOM_CONFIG } from '../config/featureFlags';
import type { RaceTrackConfig } from '../types/vehicle';
import type { TrafficLightNode, SpeedLimitZone } from './urbanTrafficRules';

function getVehicle(id: string) {
  const found = PRESET_VEHICLES.find(v => v.id === id);
  assert.ok(found, `Vehículo ${id} debe existir en PRESET_VEHICLES`);
  return found;
}

test('specFidelity: nunca expone calibraciones de simulación como cifras oficiales de fabricante', () => {
  const t2 = getVehicle('chery-t2-pro-max');
  assert.equal(formatOfficialPower(t2), NOT_SPECIFIED_LABEL);
  assert.equal(formatOfficialTorque(t2), NOT_SPECIFIED_LABEL);
  assert.equal(formatOfficialConsumption(t2), NOT_SPECIFIED_LABEL);
  assert.equal(formatOfficialFuelCapacity(t2), NOT_SPECIFIED_LABEL);
  assert.equal(formatOfficialOrSimAccel(t2, false), NOT_SPECIFIED_LABEL);
  assert.match(formatOfficialOrSimAccel(t2, true), /≈ .* s \(sim\.\)/);

  const kicks = getVehicle('nissan-kicks-2027');
  assert.equal(formatOfficialPower(kicks), '120 HP');
  assert.equal(formatOfficialTorque(kicks), '220 Nm');
  assert.equal(formatOfficialClearance(kicks), NOT_SPECIFIED_LABEL);
  assert.equal(formatShortTransmission(kicks), '6DCT');

  const t4Hev = getVehicle('chery-t4-pro-luxury-hev');
  assert.equal(formatOfficialPower(t4Hev), '195 HP');
  assert.equal(formatOfficialTorque(t4Hev), '310 Nm (motor eléc.)');
  assert.equal(formatShortTransmission(t4Hev), 'DHT HEV');

  const corolla = getVehicle('toyota-corolla-cross-seg-2027');
  assert.equal(formatOfficialPower(corolla), '171 HP');
  assert.equal(formatOfficialTorque(corolla), '203 Nm');
  assert.equal(formatOfficialClearance(corolla), '161 mm');
  assert.equal(formatOfficialWeight(corolla, false), NOT_SPECIFIED_LABEL);
  assert.match(formatOfficialTopSpeed(corolla, true), /≈ 190 km\/h \(sim\.\)/);
  assert.match(formatOfficialBraking(corolla, true), /≈ 39\.0 m \(sim\.\)/);
  assert.match(formatOfficialPriceUsd(corolla), /^USD /);
});

test('useVehicleStuckDetection: dispara exactamente a >= 3.0s con intención de movimiento y respeta pausa/semáforo/gracia', () => {
  const st = createStuckDetectorState();
  const baseSample = {
    isRaceActive: true,
    isPaused: false,
    isLoading: false,
    isCountdown: false,
    isFinished: false,
    isDocumentHidden: false,
    hasMovementIntent: true,
    positionX: -4.0,
    positionZ: 120.0,
    speedKmh: 0.4,
    dtSeconds: 0.2,
  };

  // 14 pasos de 0.2s = 2.8s -> aún no debe abrir modal
  for (let i = 0; i < 14; i++) {
    stepStuckDetector(st, { ...baseSample, positionZ: 120.0 + i * 0.01 });
    assert.equal(st.isModalOpen, false);
  }

  // Paso 15 (3.0s acumulados con desplazamiento < 0.55m) -> abre modal
  stepStuckDetector(st, { ...baseSample, positionZ: 120.15 });
  assert.equal(st.isModalOpen, true);
  assert.equal(st.triggerCount, 1);

  // Pulsar SEGUIR INTENTANDO otorga 6.0s de gracia sin reabrir de inmediato
  acknowledgeKeepTrying(st);
  assert.equal(st.isModalOpen, false);
  assert.equal(st.graceCooldownSeconds, 6.0);

  for (let i = 0; i < 20; i++) {
    stepStuckDetector(st, baseSample);
    assert.equal(st.isModalOpen, false);
  }

  // Detención voluntaria en semáforo (sin acelerar ni retroceder) jamás dispara el modal
  resetStuckDetectorState(st);
  for (let i = 0; i < 30; i++) {
    stepStuckDetector(st, { ...baseSample, hasMovementIntent: false, speedKmh: 0 });
    assert.equal(st.isModalOpen, false);
  }

  // Pausado, en cuenta regresiva o pestaña oculta jamás acumula tiempo de atasco
  for (let i = 0; i < 25; i++) {
    stepStuckDetector(st, { ...baseSample, isPaused: true });
    stepStuckDetector(st, { ...baseSample, isCountdown: true });
    stepStuckDetector(st, { ...baseSample, isDocumentHidden: true });
    assert.equal(st.isModalOpen, false);
  }
});

test('turnSignalsController: atajos Q/E/B/X, toggle limpio y destello inmediato en t=0', () => {
  assert.equal(mapKeyCodeToTurnSignalAction('KeyQ'), 'toggle_left');
  assert.equal(mapKeyCodeToTurnSignalAction('KeyE'), 'toggle_right');
  assert.equal(mapKeyCodeToTurnSignalAction('KeyB'), 'toggle_hazards');
  assert.equal(mapKeyCodeToTurnSignalAction('KeyX'), 'turn_off');
  assert.equal(mapKeyCodeToTurnSignalAction('KeyW'), null);

  let mode = applyTurnSignalAction('off', 'toggle_left');
  assert.equal(mode, 'left');
  const blinkStart = evaluateTurnSignalBlink(mode, 10.0, 10.0);
  assert.equal(blinkStart.leftLit, true);
  assert.equal(blinkStart.rightLit, false);

  const blinkHalf = evaluateTurnSignalBlink(mode, 10.0 + TURN_SIGNAL_PERIOD_SEC * 0.75, 10.0);
  assert.equal(blinkHalf.leftLit, false);

  mode = applyTurnSignalAction(mode, 'toggle_hazards');
  assert.equal(mode, 'hazards');
  const hzBlink = evaluateTurnSignalBlink(mode, 12.0, 12.0);
  assert.equal(hzBlink.leftLit, true);
  assert.equal(hzBlink.rightLit, true);

  mode = applyTurnSignalAction(mode, 'turn_off');
  assert.equal(mode, 'off');
});

test('centralMedianVisuals3D: elegibilidad en avenidas anchas, exclusión en adoquines y aperturas en semáforos', () => {
  assert.equal(CENTRAL_MEDIAN_HALF_WIDTH_M, 0.42);
  assert.equal(
    shouldBuildCentralMedian({
      roadWidthM: 21,
      trackDistanceMeters: 1800,
      cityCircuitId: 'aviadores',
      routeHazardProfile: 'flood',
    }),
    true,
  );
  assert.equal(
    shouldBuildCentralMedian({
      roadWidthM: 21,
      trackDistanceMeters: 1600,
      cityCircuitId: 'oliva',
      routeHazardProfile: 'cobbles',
    }),
    false,
  );
  assert.equal(
    shouldBuildCentralMedian({
      roadWidthM: 21,
      trackDistanceMeters: 402,
      isDragStrip: true,
    }),
    false,
  );

  const lights: TrafficLightNode[] = [
    {
      id: 'sem-1',
      z: 300,
      label: 'Cruce 1',
      cycleSec: 18.4,
      greenSec: 8,
      yellowSec: 2.4,
      phaseOffsetSec: 0,
    },
  ];
  const spans = computeCentralMedianSpans({
    trackDistanceMeters: 900,
    lights,
    crossingZs: [600],
  });
  assert.ok(spans.length >= 2);
  for (const sp of spans) {
    // Ningún tramo invade el cruce semaforizado z=300 ni el cruce transversal z=600
    assert.ok(sp.toS <= 289.5 || sp.fromS >= 311.5);
    assert.ok(sp.toS <= 589.0 || sp.fromS >= 611.0);
  }
});

test('forwardMotorcycleTraffic: circula exclusivamente en carriles de ida y frena en semáforo rojo', () => {
  const urbanTrack: RaceTrackConfig = {
    id: 'drag_quarter',
    name: 'Avenida Aviadores del Chaco',
    subtitle: 'Circuito de Raudales',
    description: 'Tramo urbano de doble mano',
    distanceMeters: 1800,
    inclineGradePercent: 0,
    cargoPayloadKg: 0,
    cityCircuitId: 'aviadores',
    routeHazardProfile: 'flood',
  };

  const pool = createForwardMotorcyclePool(urbanTrack);
  assert.ok(pool.length >= 4 && pool.length <= 6);
  for (const m of pool) {
    assert.ok(m.z >= 64, 'Las motos deben aparecer >= 64 m delante de la largada');
    assert.ok(m.x <= -1.4 && m.x >= -9.2, 'Las motos deben iniciar en carriles de ida');
  }

  // Semáforo en fase roja en t = 12s (green=8, yellow=2.4 -> t=12 es rojo, forwardStopZ = 194.5)
  const redLight: TrafficLightNode = {
    id: 'sem-red',
    z: 200,
    label: 'Cruce Aviadores',
    cycleSec: 18.4,
    greenSec: 8,
    yellowSec: 2.4,
    phaseOffsetSec: 0,
  };
  const zones: SpeedLimitZone[] = [
    { id: 'z1', fromZ: 0, toZ: 2000, signZ: 30, maxKmh: 60, minKmh: 30, label: 'Urbano' },
  ];

  pool[0].z = 176;
  pool[0].speedMps = 12;

  for (let step = 0; step < 60; step++) {
    stepForwardMotorcycles({
      motorcycles: pool,
      lights: [redLight],
      speedZones: zones,
      forwardCars: [{ id: 'car-1', x: -4.4, z: 240, speedMps: 10 }],
      playerX: -4.0,
      playerZ: 40,
      playerSpeedMps: 14,
      timeSec: 12.0,
      dt: 0.05,
      trackDistanceM: 1800,
    });
  }

  assert.ok(pool[0].z <= redLight.z - 5.0, 'La motocicleta debe detenerse antes de la línea de pare en rojo');
  assert.ok(pool[0].speedMps < 0.5, 'La motocicleta debe llegar a velocidad ~0 frente al semáforo rojo');
  for (const m of pool) {
    assert.ok(m.x <= -1.4 && m.x >= -9.2, 'Ninguna motocicleta puede cruzar al paseo central ni a contramano');
  }
});

test('adasPresentationAudit: TTC coherente, diferenciación por modelo y etiqueta ASISTENCIA SIMULADA DEL JUEGO en motos', () => {
  assert.equal(computeCoherentTtcSeconds(20, 10), 2);
  assert.equal(computeCoherentTtcSeconds(20, 0), null);
  assert.equal(computeCoherentTtcSeconds(20, -4), null);

  const t4 = getVehicle('chery-t4-pro-luxury-hev');
  const kicks = getVehicle('nissan-kicks-2027');
  const tracker = getVehicle('chevrolet-tracker-lite');
  const corolla = getVehicle('toyota-corolla-cross-seg-2027');

  const pT4 = getAuditedAdasProfile(t4);
  const pKicks = getAuditedAdasProfile(kicks);
  const pTracker = getAuditedAdasProfile(tracker);
  const pCorolla = getAuditedAdasProfile(corolla);

  // Prohibido umbral universal idéntico entre modelos distintos
  assert.notEqual(pT4.detectionRangeM, pKicks.detectionRangeM);
  assert.notEqual(pKicks.detectionRangeM, pTracker.detectionRangeM);
  assert.equal(pCorolla.detectionRangeM, 0);

  // Corolla Cross SEG 2027 no equipa ADAS según ficha -> ADAS NO DISPONIBLE frente a un auto
  const corollaVsCar = evaluateAdasHudReadout({
    vehicle: corolla,
    playerX: -4.0,
    playerZ: 100,
    playerSpeedKmh: 72,
    targets: [{ id: 'c1', kind: 'vehicle', x: -4.0, z: 118, longitudinalSpeedMps: 5 }],
  });
  assert.equal(corollaVsCar.level, 'unavailable');
  assert.equal(corollaVsCar.badgeLabel, 'ADAS NO DISPONIBLE');

  // Chery T4 Pro HEV con FCW/AEB confirmado -> alerta OEM coherente frente al mismo auto
  const t4VsCar = evaluateAdasHudReadout({
    vehicle: t4,
    playerX: -4.0,
    playerZ: 100,
    playerSpeedKmh: 72, // 20 m/s contra 5 m/s -> cierre 15 m/s
    targets: [{ id: 'c1', kind: 'vehicle', x: -4.0, z: 118, longitudinalSpeedMps: 5 }],
  });
  assert.equal(t4VsCar.origin, 'verified_oem');
  assert.equal(t4VsCar.level, 'collision_warning');

  // Proximidad a motocicleta -> SIEMPRE etiquetada como ASISTENCIA SIMULADA DEL JUEGO
  const kicksVsMoto = evaluateAdasHudReadout({
    vehicle: kicks,
    playerX: -4.4,
    playerZ: 100,
    playerSpeedKmh: 65,
    targets: [{ id: 'm1', kind: 'motorcycle', x: -4.4, z: 114, longitudinalSpeedMps: 6 }],
  });
  assert.equal(kicksVsMoto.origin, 'simulated_game_aid');
  assert.equal(kicksVsMoto.badgeLabel, 'ASISTENCIA SIMULADA DEL JUEGO');
});

test('featureFlags: enableTireShowroom permanece en false por defecto', () => {
  assert.equal(enableTireShowroom, false);
  assert.equal(INITIAL_TIRE_SHOWROOM_CONFIG.enabled, false);
  assert.equal(INITIAL_TIRE_SHOWROOM_CONFIG.tires.length, 0);
});

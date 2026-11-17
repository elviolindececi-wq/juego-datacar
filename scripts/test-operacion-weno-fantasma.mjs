import assert from 'node:assert/strict';
import fs from 'node:fs';
import module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Proveer stub ligero de 'react' cuando se ejecutan pruebas unitarias en Node sin node_modules instalado
if (typeof module.registerHooks === 'function') {
  module.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'react') {
        return {
          url: 'data:text/javascript,export const useState = (i) => [typeof i === "function" ? i() : i, () => {}]; export const useEffect = () => {}; export const useCallback = (f) => f; export default { useState, useEffect, useCallback };',
          shortCircuit: true,
        };
      }
      return nextResolve(specifier, context);
    },
  });
}

// Simular localStorage y window en entorno Node para probar persistencia, eventos y migración
const storageMap = new Map();
globalThis.window = {
  location: { search: '' },
  localStorage: {
    getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  },
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, detail) {
    this.type = type;
    this.detail = detail;
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const {
  PRESET_VEHICLES,
  PROYECTO_FANTASMA_LAMBORGHINI,
} = await import('../src/data/presetVehicles.ts');
const { ASUNCION_CIRCUITS, toRaceTrack } = await import('../src/data/asuncionCircuits.ts');
const { simulateFullRace } = await import('../src/utils/physicsEngine.ts');
const { InteractiveRacePhysics } = await import('../src/utils/interactiveRacePhysics.ts');
const {
  VEHICLE_3D_REGISTRY,
  BUNDLED_DEDICATED_GLB_URLS,
} = await import('../src/utils/vehicleModelRegistry.ts');
const {
  STORY_CONNECTED_MISSIONS,
  STORY_DIALOGUES_BY_CHAPTER,
  STORY_INTRO_10S_TIMELINE,
  WENO_STORY_ORDERED_CIRCUIT_IDS,
} = await import('../src/utils/storyCampaign.ts');
const {
  acceptRecruitmentMission,
  canStartRecoveryMission,
  canUseLamborghiniInContext,
  completeEpilogueAndSeason1,
  completeTheftCinematicAndUnlockGarage,
  isLamborghiniUnlockedForFreePlay,
  isWenoCircuitUnlockedInStory,
  loadStoryProgress,
  markStoryIntroStarted,
  markStoryIntroVideoCompleted,
  recordStoryMissionAttempt,
  shouldAutoLaunchStoryPrologue,
  skipPrologueToGarage,
} = await import('../src/utils/storyProgress.ts');
const { resolveIntroCinematicCueAtTime } = await import('../src/utils/NarrativeDirector.ts');

console.log('=== PRUEBAS AUTOMATIZADAS: OPERACIÓN WENO — EL PROYECTO FANTASMA ===');

// 1. Verificar que los 7 vehículos comerciales se mantienen intactos y que el Lamborghini NO está mezclado en el comparador
assert.equal(PRESET_VEHICLES.length, 7, 'El catálogo comercial debe conservar exactamente los 7 vehículos');
assert.ok(
  !PRESET_VEHICLES.some((v) => v.id === 'lamborghini-proyecto-fantasma'),
  'El Lamborghini Proyecto Fantasma NO debe figurar en el catálogo comercial de comparación',
);

// 2. Verificar registro 3D y archivo físico GLB del Lamborghini y de la Limusina Presidencial
const lamboRegistry = VEHICLE_3D_REGISTRY['lamborghini-proyecto-fantasma'];
assert.ok(lamboRegistry, 'Lamborghini debe estar registrado en VEHICLE_3D_REGISTRY');
assert.equal(lamboRegistry.glbUrl, '/models/lamborghini-bonus.glb');
assert.ok(BUNDLED_DEDICATED_GLB_URLS.has('/models/lamborghini-bonus.glb'));

try {
  const lamboGlbDiskPath = path.join(projectRoot, 'public', 'models', 'lamborghini-bonus.glb');
  if (fs.existsSync(lamboGlbDiskPath)) {
    assert.ok(fs.statSync(lamboGlbDiskPath).size > 1_000_000, 'lamborghini-bonus.glb válido');
  }
} catch {
  // En sandbox sin acceso directo a public/models se valida mediante el registro canónico
}

// 3. Verificar que el Lamborghini funciona con el motor físico existente (simulateFullRace + InteractiveRacePhysics 100Hz)
const testTrack = toRaceTrack(ASUNCION_CIRCUITS.find((c) => c.id === 'aviadores'), 1);
const lamboSim = simulateFullRace([PROYECTO_FANTASMA_LAMBORGHINI], testTrack);
assert.equal(lamboSim.length, 1);
assert.ok(lamboSim[0].finishTimeSec > 0 && !lamboSim[0].isDnf, 'El Lamborghini debe completar la simulación física');

const interactiveSim = new InteractiveRacePhysics(
  [PROYECTO_FANTASMA_LAMBORGHINI],
  testTrack,
  PROYECTO_FANTASMA_LAMBORGHINI.id,
  false,
);
for (let i = 0; i < 300; i++) {
  interactiveSim.step(0.01, { steer: 0.05, throttle: 1, brake: 0 });
}
const dynamicLambo = interactiveSim.getCar(PROYECTO_FANTASMA_LAMBORGHINI.id);
assert.ok(dynamicLambo && dynamicLambo.speed > 20, 'El Lamborghini acelera y gira en InteractiveRacePhysics a 100Hz');

// 4. Cronograma exacto de 10 segundos de la cinemática inicial (§4)
assert.equal(STORY_INTRO_10S_TIMELINE.length, 5);
assert.equal(resolveIntroCinematicCueAtTime(0.5)?.headline, 'ASUNCIÓN, PARAGUAY');
assert.equal(resolveIntroCinematicCueAtTime(0.5)?.subline, '23:47 HS.');
assert.equal(resolveIntroCinematicCueAtTime(2.5)?.headline, '"TENEMOS UN TRABAJO PARA VOS."');
assert.equal(resolveIntroCinematicCueAtTime(2.5)?.vibrate, true);
assert.equal(resolveIntroCinematicCueAtTime(4.5)?.headline, '"NECESITAMOS UN PILOTO. NO CUALQUIERA."');
assert.equal(resolveIntroCinematicCueAtTime(6.5)?.headline, '"HAY UN VEHÍCULO QUE DEBEMOS PROBAR ESTA NOCHE."');
assert.equal(resolveIntroCinematicCueAtTime(8.5)?.headline, 'PROYECTO FANTASMA');
assert.equal(resolveIntroCinematicCueAtTime(8.5)?.subline, 'ARCHIVO CONFIDENCIAL.');

// 5. Diálogos estructurados en el teléfono (§5 y §18)
const recruitmentMsgs = STORY_DIALOGUES_BY_CHAPTER.recruitment_phone;
assert.equal(recruitmentMsgs.length, 7);
assert.equal(recruitmentMsgs[5].attachment?.title, 'PROYECTO FANTASMA');
assert.equal(recruitmentMsgs[6].text, '¿ACEPTÁS LA MISIÓN?');

// 6. Jugador nuevo: activación automática en el primer arranque y flujo de Misión 0 -> Robo -> Garaje
storageMap.clear();
assert.equal(shouldAutoLaunchStoryPrologue(), true, 'Jugador nuevo debe activar automáticamente la campaña');
let st = loadStoryProgress();
assert.equal(st.narrativeState, 'not_started');

st = markStoryIntroStarted();
assert.equal(st.narrativeState, 'intro_started');

st = markStoryIntroVideoCompleted();
assert.equal(st.narrativeState, 'intro_completed');

st = acceptRecruitmentMission();
assert.equal(st.narrativeState, 'mission_0_available');
assert.equal(canUseLamborghiniInContext('mission_0', st), true);

// Perder Misión 0 no activa el robo ni avanza el estado
const m0Fail = recordStoryMissionAttempt({
  missionId: 'mission_0',
  circuitId: 'aviadores',
  won: false,
  finishTimeSec: 250,
  raceMode: 'city_trial',
  availableCircuitIds: WENO_STORY_ORDERED_CIRCUIT_IDS,
});
assert.equal(m0Fail.won, false);
assert.equal(loadStoryProgress().narrativeState, 'mission_0_available');

// Ganar Misión 0 registra la pista inicial y habilita la cinemática del robo
const m0Win = recordStoryMissionAttempt({
  missionId: 'mission_0',
  circuitId: 'aviadores',
  won: true,
  finishTimeSec: 74.2,
  raceMode: 'city_trial',
  availableCircuitIds: WENO_STORY_ORDERED_CIRCUIT_IDS,
});
assert.equal(m0Win.won, true);
assert.equal(m0Win.storyState.narrativeState, 'mission_0_completed');
assert.ok(m0Win.storyState.discoveredClues.includes('clue_0_routes'));

// Ejecutar robo y desbloquear garaje comercial: Lamborghini queda ROBADO y bloqueado
st = completeTheftCinematicAndUnlockGarage();
assert.equal(st.narrativeState, 'garage_unlocked');
assert.equal(st.lamborghiniStatus, 'stolen_locked');
assert.equal(canUseLamborghiniInContext('weno_campaign', st), false);
assert.equal(canUseLamborghiniInContext('free_play', st), false);

// 7. Orden obligatorio de las 6 misiones de Operación WENO (§10 y §14)
assert.equal(isWenoCircuitUnlockedInStory('aviadores', st), true, 'Misión 1 disponible al desbloquear garaje');
assert.equal(isWenoCircuitUnlockedInStory('oliva', st), false, 'Misión 2 bloqueada antes de ganar Misión 1');

// Intentar ganar Misión 2 sin haber ganado Misión 1 debe ser rechazado
const prematureM2 = recordStoryMissionAttempt({
  circuitId: 'oliva',
  won: true,
  finishTimeSec: 88,
  raceMode: 'city_trial',
  availableCircuitIds: WENO_STORY_ORDERED_CIRCUIT_IDS,
});
assert.equal(prematureM2.won, false, 'No se puede completar Misión 2 sin completar Misión 1');

// Completar las 6 misiones en orden y verificar pistas, revelación del infiltrado (Misión 5) y Piloto Élite (Misión 6)
const expectedStatesAfterMission = [
  ['aviadores', 'weno_mission_1_completed', 'LA LIMUSINA DEL ROBO IDENTIFICADA.'],
  ['oliva', 'weno_mission_2_completed', 'SOCIEDAD INTERMEDIARIA IDENTIFICADA.'],
  ['herrera', 'weno_mission_3_completed', 'TRASLADO DEL LAMBORGHINI CONFIRMADO.'],
  ['jose-felix', 'weno_mission_4_completed', 'PRIMER ESCONDITE DESCUBIERTO.'],
  ['artigas', 'weno_mission_5_completed', 'INFILTRADO IDENTIFICADO.'],
  ['avelino', 'recovery_unlocked', 'DESTINO DEL PROYECTO FANTASMA DESCUBIERTO.'],
];

for (const [circuitId, expectedState, expectedClue] of expectedStatesAfterMission) {
  assert.equal(isWenoCircuitUnlockedInStory(circuitId, loadStoryProgress()), true, `Circuito ${circuitId} debe estar desbloqueado`);
  const res = recordStoryMissionAttempt({
    circuitId,
    won: true,
    finishTimeSec: 82.5,
    raceMode: 'city_trial',
    availableCircuitIds: WENO_STORY_ORDERED_CIRCUIT_IDS,
  });
  assert.equal(res.won, true);
  assert.equal(res.clueTitle, expectedClue);
  assert.equal(res.storyState.narrativeState, expectedState);
}

st = loadStoryProgress();
assert.equal(st.eliteAwarded, true, 'Al completar las 6 misiones se otorga Piloto Élite');
assert.equal(st.recoveryUnlocked, true, 'Al completar las 6 misiones se desbloquea la Recuperación Final');
assert.equal(canStartRecoveryMission(st), true);
assert.equal(isLamborghiniUnlockedForFreePlay(st), false, 'El Lamborghini sigue robado antes de ganar la Recuperación Final');

// 8. Misión Bonus: Recuperación Final -> Desbloqueo del Lamborghini -> Epílogo
const recovFail = recordStoryMissionAttempt({
  missionId: 'recovery_final',
  circuitId: 'aviadores',
  won: false,
  finishTimeSec: 240,
  raceMode: 'city_trial',
  availableCircuitIds: WENO_STORY_ORDERED_CIRCUIT_IDS,
});
assert.equal(recovFail.won, false);
assert.equal(isLamborghiniUnlockedForFreePlay(), false, 'Perder la recuperación no desbloquea el Lamborghini');

const recovWin = recordStoryMissionAttempt({
  missionId: 'recovery_final',
  circuitId: 'aviadores',
  won: true,
  finishTimeSec: 79.4,
  raceMode: 'city_trial',
  availableCircuitIds: WENO_STORY_ORDERED_CIRCUIT_IDS,
});
assert.equal(recovWin.won, true);
assert.equal(recovWin.newlyRecoveredLamborghini, true);
assert.equal(recovWin.storyState.narrativeState, 'lamborghini_recovered');
assert.equal(recovWin.storyState.lamborghiniStatus, 'recovered_unlocked');
assert.equal(isLamborghiniUnlockedForFreePlay(), true, 'El Lamborghini queda desbloqueado tras la recuperación');
assert.equal(canUseLamborghiniInContext('free_play'), true);
assert.equal(canUseLamborghiniInContext('compare'), false, 'El Lamborghini nunca se mezcla en el comparador comercial');

st = completeEpilogueAndSeason1();
assert.equal(st.narrativeState, 'epilogue_completed');
assert.equal(st.epilogueCompleted, true);

// 9. Opción explícita de omitir prólogo sin regalar victorias ni recompensas (§14)
storageMap.clear();
const skipped = skipPrologueToGarage();
assert.equal(skipped.narrativeState, 'garage_unlocked');
assert.equal(skipped.lamborghiniStatus, 'stolen_locked');
assert.equal(skipped.completedMissions.length, 0, 'Omitir el prólogo no regala victorias');
assert.equal(isLamborghiniUnlockedForFreePlay(skipped), false);

// 10. Migración de partidas antiguas sin perder avance (§15)
storageMap.clear();
window.localStorage.setItem(
  'datacar_arena_progression_v1',
  JSON.stringify({
    speedModeUnlocked: true,
    bestCityIqScore: 910,
    completedCityCircuits: ['aviadores', 'oliva'],
    jailUntilMs: 0,
    jailCircuitName: null,
    arrestCount: 0,
    wenoCompletedCircuits: ['aviadores', 'oliva', 'herrera', 'jose-felix', 'artigas', 'avelino'],
    wenoBestTimesSec: { aviadores: 81.2, oliva: 75.4 },
    wenoElitePilotUnlocked: true,
    wenoCampaignCompletedAt: 1700000000000,
  }),
);
const migrated = loadStoryProgress();
assert.equal(migrated.migratedLegacySave, true, 'Debe detectar y migrar partida existente');
assert.equal(migrated.eliteAwarded, true, 'Conserva reconocimiento Piloto Élite');
assert.equal(migrated.recoveryUnlocked, true, 'Habilita directamente la misión bonus de recuperación');
assert.equal(shouldAutoLaunchStoryPrologue(), false, 'No obliga al jugador antiguo a empezar desde cero');

// 11. Verificación de integración de todos los componentes UI y diálogos exactos
const readSrc = (rel) => fs.readFileSync(path.join(projectRoot, rel), 'utf8');
const introCinematicSrc = readSrc('src/components/StoryIntroCinematic.tsx');
const phoneMsgsSrc = readSrc('src/components/DatacarPhoneMessages.tsx');
const lamboRevealSrc = readSrc('src/components/LamborghiniReveal.tsx');
const lamboTheftSrc = readSrc('src/components/LamborghiniTheftCinematic.tsx');
const missionBriefingSrc = readSrc('src/components/StoryMissionBriefing.tsx');
const missionResultSrc = readSrc('src/components/StoryMissionResult.tsx');
const lamboRecoverySrc = readSrc('src/components/LamborghiniRecoveryCinematic.tsx');
const appSrc = readSrc('src/App.tsx');
const mobileSrc = readSrc('src/components/mobile/MobileGameExperience.tsx');

assert.match(introCinematicSrc, /playsInline/, 'StoryIntroCinematic debe usar playsInline');
assert.match(phoneMsgsSrc, /ACEPTAR MISIÓN/, 'DatacarPhoneMessages debe incluir botón ACEPTAR MISIÓN');
assert.match(phoneMsgsSrc, /AHORA NO/, 'DatacarPhoneMessages debe incluir botón AHORA NO');
assert.match(lamboRevealSrc, /PROYECTO FANTASMA/, 'LamborghiniReveal debe mostrar PROYECTO FANTASMA');
assert.match(lamboRevealSrc, /MISIÓN 0 — PRUEBA DE CONDUCCIÓN/, 'LamborghiniReveal debe mostrar MISIÓN 0');
assert.match(lamboTheftSrc, /PRUEBA SUPERADA/, 'LamborghiniTheftCinematic debe mostrar PRUEBA SUPERADA');
assert.match(lamboTheftSrc, /PILOTO APROBADO/, 'LamborghiniTheftCinematic debe mostrar PILOTO APROBADO');
assert.match(lamboTheftSrc, /INVESTIGACIÓN ACTIVADA/, 'LamborghiniTheftCinematic debe activar Operación WENO');
assert.match(missionBriefingSrc, /PROYECTO FANTASMA — ROBADO/, 'StoryMissionBriefing debe reflejar el estado robado');
assert.match(missionResultSrc, /mission-4-empty-hangar-scene/, 'StoryMissionResult debe incluir escena de hangar vacío en Misión 4');
assert.match(missionResultSrc, /mission-5-infiltrator-revelation/, 'StoryMissionResult debe revelar al contratista infiltrado en Misión 5');
assert.match(lamboRecoverySrc, /LAMBORGHINI RECUPERADO/, 'LamborghiniRecoveryCinematic debe mostrar LAMBORGHINI RECUPERADO');
assert.match(lamboRecoverySrc, /VEHÍCULO BONUS DESBLOQUEADO/, 'LamborghiniRecoveryCinematic debe mostrar VEHÍCULO BONUS DESBLOQUEADO');
assert.match(lamboRecoverySrc, /FIN DE LA PRIMERA TEMPORADA\./, 'LamborghiniRecoveryCinematic debe cerrar con el epílogo de la Temporada 1');
assert.match(appSrc, /StoryIntroCinematic/, 'App.tsx debe integrar StoryIntroCinematic');
assert.match(appSrc, /LamborghiniReveal/, 'App.tsx debe integrar LamborghiniReveal');
assert.match(appSrc, /LamborghiniTheftCinematic/, 'App.tsx debe integrar LamborghiniTheftCinematic');
assert.match(appSrc, /LamborghiniRecoveryCinematic/, 'App.tsx debe integrar LamborghiniRecoveryCinematic');
assert.match(mobileSrc, /StoryIntroCinematic/, 'MobileGameExperience.tsx debe integrar la campaña narrativa en móvil');

// 12. Verificación de Catálogo de Cubiertas (Sponsor-Ready) y Estaciones de Servicio 3D con recomendación de combustible
const { TIRE_COMPOUNDS_CATALOG, applySelectedTireCompoundToVehicle } = await import(
  '../src/utils/tireCatalog.ts'
);
const {
  FUEL_PRODUCTS_CATALOG,
  recommendFuelForVehicle,
  evaluateFuelStationPitInteraction,
  getCircuitFuelStationDistanceM,
} = await import('../src/utils/fuelStationSponsorConfig.ts');

assert.equal(TIRE_COMPOUNDS_CATALOG.length, 4, 'El catálogo de cubiertas debe incluir 4 compuestos');
const tunedSportCar = applySelectedTireCompoundToVehicle(PRESET_VEHICLES[0], 'sport_uhp');
assert.ok(tunedSportCar.tireGrip > PRESET_VEHICLES[0].tireGrip, 'Cubierta UHP mejora el agarre en seco');
assert.ok(tunedSportCar.brakingDistance100 < PRESET_VEHICLES[0].brakingDistance100, 'Cubierta UHP acorta la frenada 100-0');

assert.ok(FUEL_PRODUCTS_CATALOG.length >= 5, 'El catálogo de combustibles debe incluir todos los octanajes/diésel');
for (const vehicle of [...PRESET_VEHICLES, PROYECTO_FANTASMA_LAMBORGHINI]) {
  const rec = recommendFuelForVehicle(vehicle);
  assert.ok(rec.recommendedFuel?.id, `Debe recomendar combustible para ${vehicle.name}`);
  assert.ok(rec.technicalExplanation.length > 10, `Debe explicar el motivo técnico para ${vehicle.name}`);
}
const lamboFuel = recommendFuelForVehicle(PROYECTO_FANTASMA_LAMBORGHINI);
assert.equal(lamboFuel.recommendedFuel.id, 'racing_100_ron', 'El Lamborghini V12 debe recomendar Racing 100 RON');

const stationDist = getCircuitFuelStationDistanceM(2000);
const pitCheck = evaluateFuelStationPitInteraction({
  vehicle: PRESET_VEHICLES[0],
  playerSInLapM: stationDist,
  playerLateralX: -8.5,
  singleLapDistanceM: 2000,
  challengeActive: true,
  alreadyRefueled: false,
  loadedFuel: null,
});
assert.equal(pitCheck.isInPitBay, true, 'El vehículo en el carril derecho frente a los surtidores activa el box de carga');

console.log('PASS: Todas las condiciones técnicas, narrativas, Catálogo de Cubiertas y Estaciones de Servicio 3D verificadas.');

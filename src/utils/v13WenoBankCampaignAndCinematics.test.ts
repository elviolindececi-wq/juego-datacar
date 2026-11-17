import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ASUNCION_CIRCUITS, toRaceTrack } from '../data/asuncionCircuits';
import { makeRoadPath } from './curvedRoadPath';
import {
  type CareerProgressionState,
  evaluateWenoCampaignAttemptPure,
  getWenoCampaignOverview,
  willCompleteWenoCampaign,
} from './careerProgression';
import {
  DATACAR_CAMPAIGN_COPY,
  DATACAR_RESULTS_COPY,
  getWenoBankMissionForCircuit,
} from './wenoBankMissions';
import {
  FINALE_CINEMATIC_DURATION_SEC,
  PRE_RACE_CINEMATIC_DURATION_SEC,
  WENO_GROUP_YAW_OFFSET,
  evaluateFinaleCinematicTimeline,
  evaluatePreRaceCinematicTimeline,
  localToWenoWorld,
} from './wenoBankCampaign';

function makeEmptyProgression(): CareerProgressionState {
  return {
    speedModeUnlocked: false,
    bestCityIqScore: 0,
    completedCityCircuits: [],
    jailUntilMs: 0,
    jailCircuitName: null,
    arrestCount: 0,
    wenoCompletedCircuits: [],
    wenoBestTimesSec: {},
    wenoElitePilotUnlocked: false,
    wenoCampaignCompletedAt: null,
  };
}

test('Campaña Operación Weno Bank: total dinámico sin hardcodear 6 y estados PENDIENTE / EN CURSO / COMPLETADO', () => {
  const initialState = makeEmptyProgression();

  // Con los 6 circuitos actuales de Asunción
  const overview6 = getWenoCampaignOverview(ASUNCION_CIRCUITS, initialState);
  assert.equal(overview6.totalCount, ASUNCION_CIRCUITS.length);
  assert.equal(overview6.completedCount, 0);
  assert.equal(overview6.pendingCount, ASUNCION_CIRCUITS.length);
  assert.equal(overview6.isCampaignComplete, false);
  assert.equal(overview6.eliteBadgeUnlocked, false);
  assert.equal(overview6.nextPendingCircuitId, ASUNCION_CIRCUITS[0].id);
  assert.ok(overview6.items.every((item) => item.status === 'pending'));

  // En curso marca el circuito activo como `in_progress`
  const inProgressOverview = getWenoCampaignOverview(
    ASUNCION_CIRCUITS,
    initialState,
    'circuit-herrera',
    true,
  );
  const herreraItem = inProgressOverview.items.find((i) => i.circuitId === 'herrera');
  assert.equal(herreraItem?.status, 'in_progress');

  // Si en el futuro existen 7 circuitos, `totalCount` escala dinámicamente a 7
  const extendedCircuits = [
    ...ASUNCION_CIRCUITS.map((c) => ({ id: c.id, name: c.name })),
    { id: 'costanera-sur', name: 'Costanera Sur' },
  ];
  const overview7 = getWenoCampaignOverview(extendedCircuits, {
    wenoCompletedCircuits: ASUNCION_CIRCUITS.map((c) => c.id),
    wenoBestTimesSec: {},
    wenoElitePilotUnlocked: false,
  });
  assert.equal(overview7.totalCount, 7);
  assert.equal(overview7.completedCount, 6);
  assert.equal(overview7.isCampaignComplete, false);
  assert.equal(overview7.nextPendingCircuitId, 'costanera-sur');
});

test('Progresión de campaña: victorias acumulativas, derrota no destructiva, mejora de récord y exclusión de práctica libre', () => {
  const circuitIds = ASUNCION_CIRCUITS.map((c) => c.id);
  let state = makeEmptyProgression();

  // Práctica libre jamás cuenta para la campaña
  const practiceRes = evaluateWenoCampaignAttemptPure(state, {
    circuitId: 'aviadores',
    won: true,
    finishTimeSec: 112.4,
    raceMode: 'practice_free',
    availableCircuitIds: circuitIds,
  });
  assert.equal(practiceRes.completedCount, 0);
  assert.equal(practiceRes.newlyWonCircuit, false);
  assert.equal(practiceRes.isCampaignComplete, false);

  // Victoria en Circuito 1 (Aviadores) -> 1/6, NO termina el juego
  const win1 = evaluateWenoCampaignAttemptPure(state, {
    circuitId: 'circuit-aviadores',
    won: true,
    finishTimeSec: 145.678,
    raceMode: 'city_trial',
    availableCircuitIds: circuitIds,
  });
  state = win1.nextState;
  assert.equal(win1.newlyWonCircuit, true);
  assert.equal(win1.completedCount, 1);
  assert.equal(win1.totalCount, 6);
  assert.equal(win1.isCampaignComplete, false);
  assert.equal(win1.newlyCompletedCampaign, false);
  // `aviadores` es el último elemento de ASUNCION_CIRCUITS; el siguiente pendiente envuelve a `avelino`
  assert.equal(win1.nextPendingCircuitId, 'avelino');
  assert.equal(state.wenoBestTimesSec.aviadores, 145.678);

  // Victoria en Circuito 2 (Oliva) -> 2/6; tras `oliva` (ya teniendo `aviadores`), el siguiente pendiente es `avelino`
  const win2 = evaluateWenoCampaignAttemptPure(state, {
    circuitId: 'oliva',
    won: true,
    finishTimeSec: 132.5,
    raceMode: 'speed_pro',
    availableCircuitIds: circuitIds,
  });
  state = win2.nextState;
  assert.equal(win2.completedCount, 2);
  assert.equal(win2.nextPendingCircuitId, 'avelino');

  // Derrota en Circuito 3 (Herrera) -> mantiene intactas las 2 victorias previas
  const lose3 = evaluateWenoCampaignAttemptPure(state, {
    circuitId: 'herrera',
    won: false,
    finishTimeSec: 260.0,
    raceMode: 'city_trial',
    availableCircuitIds: circuitIds,
  });
  state = lose3.nextState;
  assert.equal(lose3.newlyWonCircuit, false);
  assert.equal(lose3.completedCount, 2);
  assert.deepEqual(state.wenoCompletedCircuits, ['aviadores', 'oliva']);
  assert.equal(
    DATACAR_RESULTS_COPY.defeatLine2,
    'DATACAR sigue confiando en su mejor piloto.',
  );

  // Repetir Circuito 1 más lento conserva récord previo; repetir más rápido actualiza récord
  const repeatSlower = evaluateWenoCampaignAttemptPure(state, {
    circuitId: 'aviadores',
    won: true,
    finishTimeSec: 160.0,
    raceMode: 'city_trial',
    availableCircuitIds: circuitIds,
  });
  assert.equal(repeatSlower.newlyWonCircuit, false);
  assert.equal(repeatSlower.nextState.wenoBestTimesSec.aviadores, 145.678);

  const repeatFaster = evaluateWenoCampaignAttemptPure(repeatSlower.nextState, {
    circuitId: 'aviadores',
    won: true,
    finishTimeSec: 139.25,
    raceMode: 'speed_pro',
    availableCircuitIds: circuitIds,
  });
  state = repeatFaster.nextState;
  assert.equal(state.wenoBestTimesSec.aviadores, 139.25);

  // Completar circuitos 3, 4 y 5 -> 5/6
  for (const cid of ['herrera', 'jose-felix', 'artigas']) {
    const res = evaluateWenoCampaignAttemptPure(state, {
      circuitId: cid,
      won: true,
      finishTimeSec: 128.0,
      raceMode: 'city_trial',
      availableCircuitIds: circuitIds,
    });
    state = res.nextState;
    assert.equal(res.isCampaignComplete, false);
  }
  assert.equal(state.wenoCompletedCircuits.length, 5);

  // Predicción antes del último circuito pendiente (`avelino`)
  assert.equal(willCompleteWenoCampaign(state, 'artigas', circuitIds), false);
  assert.equal(willCompleteWenoCampaign(state, 'circuit-avelino', circuitIds), true);

  // Ganar el 6.º circuito desbloquea 100% de campaña e insignia PILOTO ÉLITE DATACAR
  const fixedNow = 1763150000000;
  const win6 = evaluateWenoCampaignAttemptPure(state, {
    circuitId: 'avelino',
    won: true,
    finishTimeSec: 151.4,
    raceMode: 'speed_pro',
    availableCircuitIds: circuitIds,
    nowMs: fixedNow,
  });
  state = win6.nextState;
  assert.equal(win6.completedCount, 6);
  assert.equal(win6.totalCount, 6);
  assert.equal(win6.isCampaignComplete, true);
  assert.equal(win6.newlyCompletedCampaign, true);
  assert.equal(win6.nextPendingCircuitId, null);
  assert.equal(state.wenoElitePilotUnlocked, true);
  assert.equal(state.wenoCampaignCompletedAt, fixedNow);

  // Rejugar cualquier circuito después del 100% no vuelve a disparar `newlyCompletedCampaign`
  const replayAfterComplete = evaluateWenoCampaignAttemptPure(state, {
    circuitId: 'avelino',
    won: true,
    finishTimeSec: 149.1,
    raceMode: 'speed_pro',
    availableCircuitIds: circuitIds,
  });
  assert.equal(replayAfterComplete.isCampaignComplete, true);
  assert.equal(replayAfterComplete.newlyCompletedCampaign, false);
  assert.equal(replayAfterComplete.nextState.wenoElitePilotUnlocked, true);
});

test('localToWenoWorld coincide exactamente con THREE.Group.localToWorld en cualquier pose y orientación', () => {
  const samplePoses = [
    { x: 0, z: 0, yaw: 0 },
    { x: 412.5, z: -890.25, yaw: 0.68 },
    { x: -1240.0, z: 620.8, yaw: -2.14 },
    { x: 95.3, z: 1540.6, yaw: Math.PI * 0.5 },
  ];
  const sampleLocals = [
    { x: 8.2, y: 8.8, z: 28.5 },
    { x: -5.6, y: 4.5, z: 5.8 },
    { x: 4.5, y: 2.1, z: 8.65 },
    { x: -14.0, y: 1.25, z: 13.1 },
  ];

  for (const pose of samplePoses) {
    const group = new THREE.Group();
    group.position.set(pose.x, 0, pose.z);
    group.rotation.y = pose.yaw + WENO_GROUP_YAW_OFFSET;
    group.updateMatrixWorld(true);

    for (const loc of sampleLocals) {
      const expected = group.localToWorld(new THREE.Vector3(loc.x, loc.y, loc.z));
      const actual = localToWenoWorld(pose, loc.x, loc.y, loc.z);
      assert.ok(Math.abs(actual.x - expected.x) < 1e-6);
      assert.ok(Math.abs(actual.y - expected.y) < 1e-6);
      assert.ok(Math.abs(actual.z - expected.z) < 1e-6);
    }
  }
});

test('Cinemática inicial de 4 tomas funciona en TODOS los circuitos mostrando ciudad, Weno Bank, antagonista y largada', () => {
  const roadHalfWidth = 10.5;

  for (const circuit of ASUNCION_CIRCUITS) {
    const track = toRaceTrack(circuit, 1);
    const roadPath = makeRoadPath(track);
    const startPose = roadPath.world(0, 0);
    const avenueAheadPose = roadPath.world(Math.min(75, track.distanceMeters * 0.25), 0);
    const wenoBankPose = roadPath.world(track.distanceMeters + 8, roadHalfWidth + 27.5);
    const mission = getWenoBankMissionForCircuit(circuit.id, circuit.name);

    const anchors = {
      startPose,
      avenueAheadPose,
      wenoBankPose,
      sampleRoadPose: (s: number, lateral: number) => roadPath.world(s, lateral),
      circuitName: circuit.name,
      mission,
    };

    // Toma 1: Ciudad y avenida
    const shot1 = evaluatePreRaceCinematicTimeline(0.5, anchors);
    assert.equal(shot1.shotId, 'intro_shot_1');
    assert.equal(shot1.shotNumber, 1);
    assert.equal(shot1.headline, mission.title);
    assert.equal(shot1.rivalPreviewProgress01, 0);
    assert.equal(shot1.finished, false);
    assert.ok(shot1.camera.y >= 18);

    // Toma 2: Revelación de Weno Bank ("DESTINO: WENO BANK")
    const shot2 = evaluatePreRaceCinematicTimeline(2.2, anchors);
    assert.equal(shot2.shotId, 'intro_shot_2');
    assert.equal(shot2.shotNumber, 2);
    assert.equal(shot2.headline, 'DESTINO: WENO BANK');
    assert.equal(shot2.rivalPreviewProgress01, 0);
    const distCamToBank = Math.hypot(
      shot2.camera.x - wenoBankPose.x,
      shot2.camera.z - wenoBankPose.z,
    );
    const distTargetToBank = Math.hypot(
      shot2.target.x - wenoBankPose.x,
      shot2.target.z - wenoBankPose.z,
    );
    assert.ok(
      distCamToBank < 36 && distCamToBank > 16,
      `Toma 2 debe encuadrar de cerca el edificio Weno Bank en ${circuit.id} (dist=${distCamToBank.toFixed(2)}m)`,
    );
    assert.ok(
      distTargetToBank < 8,
      `El foco de Toma 2 debe apuntar a la fachada/acceso de Weno Bank en ${circuit.id}`,
    );

    // Toma 3: Vehículo del antagonista corrupto EN CAMINO sobre la avenida, adelantado y lejos de la llegada al banco
    const shot3Start = evaluatePreRaceCinematicTimeline(3.65, anchors);
    const shot3 = evaluatePreRaceCinematicTimeline(4.1, anchors);
    const shot3End = evaluatePreRaceCinematicTimeline(4.75, anchors);
    assert.equal(shot3.shotId, 'intro_shot_3');
    assert.equal(shot3.shotNumber, 3);
    assert.equal(shot3.headline, mission.introRivalAlert);
    assert.ok(shot3.rivalPreviewProgress01 > 0.46 && shot3.rivalPreviewProgress01 < 0.75);
    assert.ok(shot3Start.rivalRoadPose && shot3.rivalRoadPose && shot3End.rivalRoadPose);
    const projStart = roadPath.project(shot3Start.rivalRoadPose.x, shot3Start.rivalRoadPose.z);
    const projEnd = roadPath.project(shot3End.rivalRoadPose.x, shot3End.rivalRoadPose.z);
    assert.ok(
      projStart.s >= 65 && projEnd.s > projStart.s + 25,
      `El rival debe estar desplazándose adelante sobre la avenida en ${circuit.id} (${projStart.s.toFixed(1)}m -> ${projEnd.s.toFixed(1)}m)`,
    );
    const distRivalToBank = Math.hypot(
      shot3.rivalRoadPose.x - wenoBankPose.x,
      shot3.rivalRoadPose.z - wenoBankPose.z,
    );
    assert.ok(
      distRivalToBank > 150,
      `Toma 3 no debe mostrar al rival ya en la puerta del banco en ${circuit.id} (dist=${distRivalToBank.toFixed(1)}m)`,
    );
    assert.ok(shot3.camera.y < 3.5, 'Toma 3 sigue al rival a ras de avenida, no desde arriba');
    assert.match(shot3.kicker, new RegExp(mission.rivalVehicleLabel, 'i'));

    // Toma 4: Regreso al SUV del jugador en el punto de largada
    const shot4 = evaluatePreRaceCinematicTimeline(5.7, anchors);
    assert.equal(shot4.shotId, 'intro_shot_4');
    assert.equal(shot4.shotNumber, 4);
    assert.equal(shot4.rivalPreviewProgress01, 0);
    assert.equal(shot4.headline, DATACAR_CAMPAIGN_COPY.introShot4Line1);
    assert.equal(shot4.subline, DATACAR_CAMPAIGN_COPY.introShot4Line2);
    const distCamToStart = Math.hypot(
      shot4.camera.x - startPose.x,
      shot4.camera.z - startPose.z,
    );
    assert.ok(
      distCamToStart < 20,
      `Toma 4 debe regresar junto al SUV del jugador en la largada de ${circuit.id}`,
    );

    // Fin de cinemática inicial a los 6.4s
    const endFrame = evaluatePreRaceCinematicTimeline(PRE_RACE_CINEMATIC_DURATION_SEC, anchors);
    assert.equal(endFrame.finished, true);
    assert.equal(endFrame.progress01, 1);
  }
});

test('Cinemática final 100% de campaña orbita Weno Bank y recorre los textos épicos de cierre', () => {
  const bankPose = { x: 320, z: -640, yaw: 0.45 };

  const f0 = evaluateFinaleCinematicTimeline(0.6, bankPose);
  assert.equal(f0.shotId, 'finale_weno_bank');
  assert.equal(f0.stageIndex, 0);
  assert.equal(f0.kicker, 'OPERACIÓN WENO BANK');
  assert.equal(f0.headline, '100% COMPLETADA');
  assert.equal(f0.finished, false);

  const f1 = evaluateFinaleCinematicTimeline(3.2, bankPose);
  assert.equal(f1.stageIndex, 1);
  assert.equal(f1.headline, '¡SOS EL MEJOR PILOTO DE DATACAR!');
  assert.ok(f1.bodyLines.includes('Completaste todas las misiones.'));

  const f2 = evaluateFinaleCinematicTimeline(5.8, bankPose);
  assert.equal(f2.stageIndex, 2);
  assert.equal(f2.kicker, 'PILOTO ÉLITE DATACAR');
  assert.ok(f2.bodyLines.includes('LOS CORRUPTOS CORRIERON POR LA PLATA.'));
  assert.ok(f2.bodyLines.includes('DATACAR TENÍA RAZÓN: SOS NUESTRO MEJOR PILOTO.'));

  const fEnd = evaluateFinaleCinematicTimeline(FINALE_CINEMATIC_DURATION_SEC, bankPose);
  assert.equal(fEnd.finished, true);
  assert.equal(fEnd.progress01, 1);
  assert.ok(fEnd.camera.y >= 3.2);
});

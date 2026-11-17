import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ASUNCION_CIRCUITS, toRaceTrack } from '../data/asuncionCircuits';
import { makeRoadPath } from './curvedRoadPath';
import {
  DATACAR_BRIEFING_FIXED_CONTEXT,
  DATACAR_BRIEFING_HEADER,
  DATACAR_HUD_OBJECTIVE_LABEL,
  DATACAR_INITIAL_INTRO_COPY,
  DATACAR_INSTITUTIONAL_FLEET,
  DATACAR_INSTITUTIONAL_PREMISE,
  DATACAR_RESULTS_COPY,
  DATACAR_SELECTOR_COPY,
  SATIRICAL_FICTION_DISCLAIMER,
  WENO_BANK_INTRO_STORAGE_KEY,
  evaluateWenoBankMissionOutcome,
  evaluateWenoBankRaceProgress,
  getAllWenoBankMissions,
  getWenoBankMissionForCircuit,
  markWenoBankIntroSeen,
  shouldAutoOpenWenoBankIntro,
  type CorruptRivalArchetype,
} from './wenoBankMissions';
import {
  createWenoBankBuilding3D,
  evaluateTerracottaCanopySurface,
} from './wenoBankBuilding3D';
import { createCorruptRivalVehicle3D } from './corruptRivalVehicles3D';

test('Premisa institucional DATACAR, voseo paraguayo, flota y descargo satírico', () => {
  assert.equal(
    DATACAR_INSTITUTIONAL_PREMISE,
    'DATACAR te eligió a vos, su mejor piloto, para una misión especial.',
  );
  assert.match(DATACAR_INSTITUTIONAL_FLEET, /autos más buscados por los paraguayos/i);
  assert.match(DATACAR_INSTITUTIONAL_FLEET, /Weno Bank/);

  assert.equal(DATACAR_SELECTOR_COPY.fleetBadge, 'LOS AUTOS MÁS BUSCADOS POR LOS PARAGUAYOS');
  assert.equal(DATACAR_SELECTOR_COPY.title, 'TU MISIÓN. TU MÁQUINA.');
  assert.match(DATACAR_SELECTOR_COPY.subtitle, /DATACAR te eligió como su mejor piloto/);
  assert.equal(
    DATACAR_SELECTOR_COPY.onSelectVehicle,
    'Máquina confirmada. El Weno Bank te espera.',
  );
  assert.equal(
    DATACAR_SELECTOR_COPY.beforeStartReady,
    'Tu vehículo está listo. Los corruptos ya están en camino.',
  );

  assert.equal(DATACAR_BRIEFING_HEADER.line1, 'DATACAR TE ELIGIÓ.');
  assert.equal(DATACAR_BRIEFING_HEADER.line2, 'SOS NUESTRO MEJOR PILOTO.');
  assert.match(DATACAR_BRIEFING_FIXED_CONTEXT, /autos más buscados por los paraguayos/);
  assert.equal(DATACAR_HUD_OBJECTIVE_LABEL, 'OBJETIVO: LLEGAR PRIMERO AL WENO BANK');

  // Voseo paraguayo obligatorio en introducción
  const fullIntroText = DATACAR_INITIAL_INTRO_COPY.paragraphs.join(' ');
  assert.match(fullIntroText, /\bvos\b/i);
  assert.match(fullIntroText, /(?:^|\s)Elegí(?:\s|[.,])/u);
  assert.match(fullIntroText, /(?:^|\s)Acelerá(?:\s|[.,])/u);
  assert.match(fullIntroText, /(?:^|\s)llegá(?:\s|[.,])/iu);

  // Prohibido mencionar el banco real
  assert.ok(!/ueno\s*bank/i.test(fullIntroText));
  assert.ok(!/ueno\s*bank/i.test(SATIRICAL_FICTION_DISCLAIMER));
  assert.match(SATIRICAL_FICTION_DISCLAIMER, /Ficción satírica/i);
});

test('Control de apertura inicial WenoBankIntroModal respeta ?autostart=1 y localStorage', () => {
  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
  };

  assert.equal(shouldAutoOpenWenoBankIntro('', mockStorage), true);
  assert.equal(shouldAutoOpenWenoBankIntro('?autostart=1', mockStorage), false);
  assert.equal(shouldAutoOpenWenoBankIntro('?skipIntro=1', mockStorage), false);

  markWenoBankIntroSeen(mockStorage);
  assert.equal(mem.get(WENO_BANK_INTRO_STORAGE_KEY), '1');
  assert.equal(shouldAutoOpenWenoBankIntro('', mockStorage), false);
});

test('Mapeo 1 a 1 de las 6 misiones contra la corrupción en los 6 circuitos de Asunción + fallback futuro', () => {
  const allMissions = getAllWenoBankMissions();
  assert.equal(allMissions.length, 6);
  assert.equal(ASUNCION_CIRCUITS.length, 6);

  const expectedTitlesByCircuit: Record<string, string> = {
    aviadores: 'MISIÓN 1 — EL ÚLTIMO RETIRO',
    oliva: 'MISIÓN 2 — EL BANQUERO DESAPARECIDO',
    herrera: 'MISIÓN 3 — LA VALIJA DE LOS FONDOS RESERVADOS',
    'jose-felix': 'MISIÓN 4 — LA LICITACIÓN MILAGROSA',
    artigas: 'MISIÓN 5 — EL EXPEDIENTE QUE CAMINA',
    avelino: 'MISIÓN 6 — OPERACIÓN CAJA FUERTE',
  };

  for (const circuit of ASUNCION_CIRCUITS) {
    const m = getWenoBankMissionForCircuit(circuit.id);
    assert.equal(m.title, expectedTitlesByCircuit[circuit.id]);
    assert.equal(m.circuitOriginalName, circuit.name);
    assert.equal(m.destination, 'Weno Bank');
    assert.ok(m.briefingLines.length >= 4);
    assert.ok(!/ueno\s*bank/i.test(JSON.stringify(m)));

    // También soporta prefijo `circuit-...` de RaceTrackConfig
    const fromTrackId = getWenoBankMissionForCircuit(`circuit-${circuit.id}`);
    assert.equal(fromTrackId.id, m.id);
  }

  // Fallback determinista para eventuales circuitos futuros (>6)
  const extraA = getWenoBankMissionForCircuit('costanera-sur', 'Costanera Sur');
  const extraB = getWenoBankMissionForCircuit('costanera-sur', 'Costanera Sur');
  assert.equal(extraA.id, extraB.id);
  assert.equal(extraA.destination, 'Weno Bank');
  assert.equal(extraA.circuitOriginalName, 'Costanera Sur');
  assert.ok(extraA.missionNumber >= 7);
});

test('Sincronización de cronómetro único y evaluación de victoria/derrota en Weno Bank', () => {
  const mission = getWenoBankMissionForCircuit('aviadores');
  const maxLimitSec = 200;

  const s0 = evaluateWenoBankRaceProgress(0, maxLimitSec, mission);
  assert.equal(s0.stage, 'departed');
  assert.equal(s0.antagonistProgress01, 0);
  assert.equal(s0.hasAntagonistArrived, false);

  const sMid = evaluateWenoBankRaceProgress(100, maxLimitSec, mission);
  assert.equal(sMid.stage, 'approaching');
  assert.equal(sMid.antagonistPercent, 50);

  const sUrgent = evaluateWenoBankRaceProgress(170, maxLimitSec, mission);
  assert.equal(sUrgent.stage, 'urgent');
  assert.equal(sUrgent.hasAntagonistArrived, false);

  const sEnd = evaluateWenoBankRaceProgress(200, maxLimitSec, mission);
  assert.equal(sEnd.stage, 'arrived');
  assert.equal(sEnd.antagonistProgress01, 1);
  assert.equal(sEnd.hasAntagonistArrived, true);

  const win = evaluateWenoBankMissionOutcome({
    isDnf: false,
    finishTimeSec: 184.5,
    maxLimitSec,
    mission,
  });
  assert.equal(win.won, true);
  assert.equal(win.headline, DATACAR_RESULTS_COPY.victoryTitle);
  assert.equal(win.specificLine, mission.victorySpecific);

  const loseTimeout = evaluateWenoBankMissionOutcome({
    isDnf: false,
    finishTimeSec: 205.2,
    maxLimitSec,
    mission,
  });
  assert.equal(loseTimeout.won, false);
  assert.equal(loseTimeout.headline, DATACAR_RESULTS_COPY.defeatTitle);
  assert.equal(loseTimeout.specificLine, mission.defeatSpecific);

  const loseDnf = evaluateWenoBankMissionOutcome({
    isDnf: true,
    finishTimeSec: 95,
    maxLimitSec,
    mission,
  });
  assert.equal(loseDnf.won, false);
  assert.equal(loseDnf.headline, DATACAR_RESULTS_COPY.defeatTitle);
});

test('WenoBankBuilding3D: cubierta orgánica asimétrica de terracota, cartel "weno bank", 3 LODs, clima y limpieza', () => {
  const leftArchPt = { x: 0, y: 0, z: 0 };
  const valleyPt = { x: 0, y: 0, z: 0 };
  const rightWingPt = { x: 0, y: 0, z: 0 };

  evaluateTerracottaCanopySurface(0.245, 0.75, leftArchPt);
  evaluateTerracottaCanopySurface(0.57, 0.55, valleyPt);
  evaluateTerracottaCanopySurface(1.0, 0.75, rightWingPt);

  // Asimetría escultórica obligatoria: gran arco izquierdo > ala derecha > valle central (no techo plano)
  assert.ok(
    leftArchPt.y > 13.0,
    `El arco izquierdo debe elevarse de forma monumental (obtenido ${leftArchPt.y.toFixed(2)}m)`,
  );
  assert.ok(
    rightWingPt.y > 7.5 && rightWingPt.y < leftArchPt.y - 2.5,
    `El ala derecha debe elevarse asimétricamente por debajo del arco principal (${rightWingPt.y.toFixed(2)}m)`,
  );
  assert.ok(
    valleyPt.y < rightWingPt.y - 3.0,
    `La transición central debe descender formando un valle orgánico (${valleyPt.y.toFixed(2)}m)`,
  );

  const bank = createWenoBankBuilding3D({ initialWeather: 'sunny', maxAnisotropy: 4 });
  bank.group.position.set(0, 0, 0);
  bank.group.updateMatrixWorld(true);

  const diag0 = bank.getDiagnostics();
  assert.equal(diag0.signText, 'weno bank');
  assert.equal(diag0.lodTier, 'lod0');
  assert.equal(diag0.disposed, false);
  assert.ok(diag0.canopyVertexCount > 800);
  assert.ok(diag0.foliageInstanceCount >= 28);

  // Transiciones LOD0 -> LOD1 -> LOD2 -> LOD0
  assert.equal(bank.updateLod(new THREE.Vector3(0, 4, 40)), 'lod0');
  assert.equal(bank.updateLod(new THREE.Vector3(0, 10, 210)), 'lod1');
  assert.equal(bank.updateLod(new THREE.Vector3(0, 15, 420)), 'lod2');
  assert.equal(bank.updateLod(new THREE.Vector3(0, 3, 25)), 'lod0');

  // Adaptación climática en los 6 estados sin arrojar errores
  for (const mode of ['sunny', 'dawn', 'cloudy', 'rain', 'storm', 'flood'] as const) {
    bank.setWeather(mode);
  }

  // Ubicación junto a la meta fuera de los carriles transitables en los 6 circuitos
  const roadHalfWidth = 10.5;
  const bankHalfFootprint = 18.0;
  for (const circuit of ASUNCION_CIRCUITS) {
    const track = toRaceTrack(circuit, 1);
    const roadPath = makeRoadPath(track);
    const pose = roadPath.world(track.distanceMeters + 8, roadHalfWidth + 27.5);
    const proj = roadPath.project(pose.x, pose.z);
    assert.ok(
      Math.abs(proj.lateral) >= roadHalfWidth + bankHalfFootprint,
      `Weno Bank debe ubicarse fuera de la calzada en ${circuit.id} (lateral=${proj.lateral.toFixed(2)}m)`,
    );
  }

  bank.dispose();
  assert.equal(bank.getDiagnostics().disposed, true);
});

test('Vehículos NPC corruptos livianos: 6 arquetipos, avance sincronizado en bahía VIP y dispose', () => {
  const archetypes: CorruptRivalArchetype[] = [
    'limo_blindada',
    'sedan_ejecutivo',
    'suv_blindada',
    'camioneta_vip',
    'oficial_oscuro',
    'caravana_vip',
  ];

  for (const arch of archetypes) {
    const npc = createCorruptRivalVehicle3D(arch);
    assert.equal(npc.archetype, arch);
    // Al inicio (0%) permanece oculto aún lejos del banco
    assert.equal(npc.group.visible, false);

    npc.updateSync(0.4, 60);
    assert.equal(npc.group.visible, true);
    const xAt40 = npc.group.children[0].position.x;

    npc.updateSync(0.85, 130);
    const xAt85 = npc.group.children[0].position.x;

    npc.updateSync(1.0, 160);
    const xAt100 = npc.group.children[0].position.x;

    assert.ok(xAt85 > xAt40, `El vehículo ${arch} debe avanzar hacia la entrada del Weno Bank`);
    assert.ok(xAt100 >= xAt85, `Al llegar al 100% debe detenerse frente a la escalinata`);
    assert.ok(Math.abs(xAt100 - -3.8) < 1e-4);

    npc.setRoadPreviewPose(12, 88, 0.35, 1.5);
    assert.equal(npc.group.visible, true);
    assert.ok(Math.abs(npc.group.position.x - 12) < 1e-5);
    assert.ok(Math.abs(npc.group.position.z - 88) < 1e-5);
    assert.ok(Math.abs(npc.group.rotation.y - 0.35) < 1e-5);

    npc.clearRoadPreviewPose();
    npc.updateSync(0.85, 130);
    assert.equal(npc.group.position.x, 0);
    assert.equal(npc.group.position.z, 0);
    assert.equal(npc.group.rotation.y, 0);

    npc.dispose();
  }
});

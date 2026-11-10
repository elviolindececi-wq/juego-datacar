import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ASUNCION_CIRCUITS, toRaceTrack } from '../src/data/asuncionCircuits.ts';
import { makeRoadPath } from '../src/utils/curvedRoadPath.ts';
import { PRESET_VEHICLES } from '../src/data/presetVehicles.ts';
import { InteractiveRacePhysics } from '../src/utils/interactiveRacePhysics.ts';

const routeSource = fs.readFileSync(new URL('../src/components/Race3DPerspectiveView.tsx', import.meta.url), 'utf8');
assert.ok(routeSource.includes('makeCurvedAsphalt(roadPath'), 'La malla usa la misma curva que la física');
assert.ok(routeSource.includes('bendRoadsideGroup(urbanEnvironment, roadPath)'), 'La ciudad se alinea a la curva');
assert.ok(routeSource.includes('entity.group.rotation.y += globalPose.yaw'), 'Yaw mundial del auto');
assert.ok(routeSource.includes('<RaceMiniMap'), 'Minimapa conectado a ruta real');
assert.ok(routeSource.includes('const globalPose = roadPath.world(state.distance, localLateral)'), 'Replay y física comparten coordenadas');
assert.ok(routeSource.includes('getReplayPose'), 'Director TV conserva la trayectoria registrada');

assert.equal(ASUNCION_CIRCUITS.length, 6);
const results = [];
const testVehicles = [
  PRESET_VEHICLES.find(v => v.id === 'chevrolet-tracker-lite'),
  PRESET_VEHICLES.find(v => v.id === 'toyota-corolla-cross-seg-2027'),
  PRESET_VEHICLES.find(v => v.id === 'chery-t4-pro-luxury-hev'),
];
assert.ok(testVehicles.every(Boolean), 'Los tres vehículos de ensayo existen en las fichas');

for (const circuit of ASUNCION_CIRCUITS) {
  const track = toRaceTrack(circuit);
  assert.ok(track.distanceMeters >= 1600 && track.distanceMeters <= 3600, `Circuito largo ${circuit.id}`);
  const path = makeRoadPath(track);
  assert.equal(path.isCurved, true);
  assert.ok(path.samples.every(p => Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.yaw)));
  assert.ok(Math.abs(path.heading(0)) < 1e-8 && Math.abs(path.heading(track.distanceMeters)) < 1e-8);
  assert.ok(path.samples.some(p => Math.abs(p.yaw) > .07), 'La ruta contiene curvas suaves de verdad');
  for (let s = 0; s < track.distanceMeters; s += 45) {
    const p = path.world(s, 2.3);
    const local = path.project(p.x, p.z);
    assert.ok(Math.abs(local.s - s) < .5, `Distancia Frenet recuperable ${circuit.id}: ${local.s} vs ${s}`);
    assert.ok(Math.abs(local.lateral - 2.3) < .15, `Coordenada lateral recuperable ${circuit.id}`);
    assert.ok(Math.abs(path.curvature(s)) < .012, 'Radio de curvatura amplio');
  }
  // Tres rivales con control automático, siguiendo la misma geometría física.
  const physics = new InteractiveRacePhysics(testVehicles, track, 'test-bot-all', false);
  for (let i = 0; i < 36000 && !physics.finished; i++) physics.step(.01, {throttle:0,steer:0,brake:0});
  for(const car of physics.cars) {
    assert.ok(car.finishedAt !== null, `${circuit.id}: ${car.id} cruza meta en ruta curva`);
    assert.ok(Math.abs(car.x) < 7, 'No sale sistemáticamente de la pista');
    assert.ok(car.history.some(h=>Math.abs(h.yawRad ?? 0) > .005), 'Se registra yaw dinámico para replay');
    assert.ok(car.history.every(h=>Number.isFinite(h.distanceMeters) && Number.isFinite(h.lateralX)), 'Telemetría finita');
  }
  results.push(`${circuit.id} ${track.distanceMeters}m ${(physics.time).toFixed(1)}s`);
}
// Las pruebas de comparación 0-100 / 402 m no se convierten en rutas curvas.
const straight = makeRoadPath({id:'drag_quarter',name:'402m',distanceMeters:402,cargoPayloadKg:0,inclineGradePercent:0});
assert.equal(straight.isCurved, false);
assert.equal(straight.world(200, 1).x, 1);
console.log('OK V9.2: 6 circuitos curvos, 3 rivales en cada circuito, proyección inversa, radio, geometría y replay.');
console.log(results.join(' | '));

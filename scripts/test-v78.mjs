import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getAsuncionStreetDetails } from '../src/utils/asuncionStreetData.ts';
import { InteractiveRacePhysics } from '../src/utils/interactiveRacePhysics.ts';

const profiles = ['craters', 'chains', 'trenches', 'flood', 'cobbles', 'traffic'];
for (const profile of profiles) {
  const { crossings, speedBumps } = getAsuncionStreetDetails(profile, 620);
  assert.equal(crossings.length, 2, `Faltan cruces de ${profile}`);
  assert.ok(speedBumps.length >= 2, `Faltan lomos de ${profile}`);
  for (const b of speedBumps) {
    assert.ok(b.z > 15 && b.z < 600);
    assert.ok(crossings.every(c => Math.abs(b.z - c.z) > 11), 'Un lomo tapa una intersección');
  }
}
const mock = { id: 'toyota', brand: 'Toyota', name: 'Corolla', powerHp: 171, torqueNm: 203,
  weightKg: 1400, topSpeedKmh: 180, tireGrip: .95, drivetrain: 'FWD', consumptionRacing: 12,
  fuelCapacityL: 45, dimensions: { widthMm: 1825, lengthMm: 4460, heightMm: 1620 },
  brakingDistance100: 40, frontalArea: 2.3, dragCoeff: .31 };
const track = { distanceMeters: 620, cargoPayloadKg: 0, inclineGradePercent: 0,
  cityCircuitId: 'aviadores', routeHazardProfile: 'traffic', surfaceGripFactor: .98, surfaceRoughnessFactor: 1 };
const withBumps = new InteractiveRacePhysics([mock], track, mock.id, false);
const noBumps = new InteractiveRacePhysics([mock], { ...track, cityCircuitId: undefined }, mock.id, false);
assert.ok(withBumps.speedBumps.length > 0);
for (let i = 0; i < 1700; i++) {
  const control = { throttle: 1, brake: 0, steer: 0 };
  withBumps.step(.01, control);
  noBumps.step(.01, control);
}
assert.ok(withBumps.surfaceEvents > 0, 'Lomo no genera evento');
assert.ok(withBumps.getCar('toyota').z < noBumps.getCar('toyota').z, 'El lomo no desaceleró el auto');
assert.ok(withBumps.getCar('toyota').history.some(h => h.bump > .4), 'No hubo reacción de suspensión');
const scenery = readFileSync(new URL('../src/utils/urbanTrackScenery.ts', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/components/Race3DPerspectiveView.tsx', import.meta.url), 'utf8');
assert.match(scenery, /createCanvasSign/);
assert.match(scenery, /DATACARPY\.COM/);
assert.match(scenery, /interseccion_3d_/);
assert.match(scenery, /carteles_/);
assert.match(renderer, /createSpeedBumps3D/);
assert.match(renderer, /if \(!track\.cityCircuitId\) trackGroup\.add\(leftKerb\)/);
console.log('OK V7.8: seis ambientaciones, cruces, señalética, publicidad DATACAR, lomos físicos, rebote y desaceleración.');
console.log('Lomos:', withBumps.speedBumps.length, 'eventos:', withBumps.surfaceEvents, 'distancia:', withBumps.getCar('toyota').z.toFixed(1), 'versus:', noBumps.getCar('toyota').z.toFixed(1));

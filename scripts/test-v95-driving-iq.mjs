import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRESET_VEHICLES } from '../src/data/presetVehicles.ts';
import { ASUNCION_CIRCUITS, toRaceTrack } from '../src/data/asuncionCircuits.ts';
import { InteractiveRacePhysics, PHYSICS_STEP } from '../src/utils/interactiveRacePhysics.ts';
import { scoreDrivingIQ, rankDrivingIQ, explainDriving, emptyDrivingEvents } from '../src/utils/drivingIQ.ts';

const corolla = PRESET_VEHICLES.find(v => v.id === 'toyota-corolla-cross-seg-2027');
const carens = PRESET_VEHICLES.find(v => v.id === 'kia-carens-ex');
assert.ok(corolla && carens);
assert.equal(carens.dimensions.lengthMm, 4540);
assert.equal(corolla.dimensions.lengthMm, 4460);
const registry = readFileSync(new URL('../src/utils/vehicle3DModelLoader.ts', import.meta.url), 'utf8');
assert.ok(registry.includes('scale: 4.54 / 0.12'), 'Carens uses registered length, not Tracker length');
assert.ok(registry.includes("glbUrl: '/models/tracker-rs-wheels.glb'"), 'Carens silhouette remains provisional, disclosed');

const track = toRaceTrack(ASUNCION_CIRCUITS.find(t => t.id === 'aviadores') || ASUNCION_CIRCUITS[0]);
const physics = new InteractiveRacePhysics([corolla, carens, PRESET_VEHICLES[2]], track, corolla.id, false);
physics.addHazard('pothole', 0, 96);
const bot = physics.cars[1];
bot.x = 0; bot.z = 69; bot.speed = 18; bot.laneX=0; bot.aiTargetX=0;
const control = physics.controlAI(bot);
assert.ok(control.brake > .01 || Math.abs(control.steer) > .01 || control.throttle < .6,
  'Bot anticipates pothole with avoidance or reduction of speed');
for (let i = 0; i < 220; i++) physics.step(PHYSICS_STEP, {steer:0,throttle: .78,brake:0});
for (const car of physics.cars) {
  assert.ok(Number.isFinite(car.speed));
  assert.ok(car.drivingEvents && Number.isFinite(car.drivingEvents.collisionSeverity));
}
const base = {
  vehicle:corolla, finishPosition:1, finishTimeSec:120, gapSec:0, topSpeedAchievedKmh:90,trapSpeedKmh:75,
  time0to100:null,time0to200:null,time400m:null,fuelBurned:1,fuelRemaining:44,
  effectivePowerToWeight:120,telemetryHistory:[{distanceMeters:track.distanceMeters}],isDnf:false,
};
const clean = { ...base, drivingEvents: emptyDrivingEvents() };
const damaged = { ...base, finishTimeSec:110,
  drivingEvents: {...emptyDrivingEvents(),collisions:5,collisionSeverity:28,potholesHit:4,lossOfControl:2} };
const a = scoreDrivingIQ(clean,120,track.distanceMeters);
const b = scoreDrivingIQ(damaged,120,track.distanceMeters);
assert.ok(a.total > b.total, 'Clean driver beats faster driver with severe collisions');
assert.ok(a.total<=100 && a.total>=0);
const ranks = rankDrivingIQ([damaged, {...clean,vehicle:carens}],
 [{...base,vehicle:carens,finishTimeSec:120},base], track.distanceMeters);
assert.equal(ranks[0].vehicleId,carens.id);
const messages = explainDriving(damaged,b);
assert.ok(messages.some(m=>m.includes('contactos')));
assert.ok(!messages.some(m=>m.includes('crash-test')));
const emptySheetCar = PRESET_VEHICLES.find(v=>v.id==='chery-t2-pro-max');
assert.ok(emptySheetCar);
const noOfficial = explainDriving({...damaged,vehicle:emptySheetCar},b);
assert.ok(noOfficial.every(m => !m.includes('140 Nm')), 'No present temporary Chery motor calibration as official torque');
console.log('OK V9.5: escala Carens 4.54m; AI anticipates obstacles; Driving IQ rewards safe driving, events recorded and no invented specs.');

import assert from 'node:assert/strict';
import { InteractiveRacePhysics } from '../src/utils/interactiveRacePhysics.ts';
import { potholeRoadDepth, FourCornerSuspension } from '../src/utils/roadSuspension.ts';
import { PRESET_VEHICLES } from '../src/data/presetVehicles.ts';

const player = PRESET_VEHICLES.find(v => v.name === 'TRACKER');
const rival = PRESET_VEHICLES.find(v => v.name === 'COROLLA CROSS');
assert.ok(player && rival);
const track = {id:'circuit',name:'Meta prueba',distanceMeters:90,cargoPayloadKg:0,
  inclineGradePercent:0,routeHazardProfile:'chains',cityCircuitId:'herrera',
  surfaceGripFactor:1,surfaceRoughnessFactor:1};
const race = new InteractiveRacePhysics([player, rival], track, player.id, false);
assert.equal(race.playerFinished, false);
assert.equal(race.finished, false);
const chosen = race.getCar(player.id), ai = race.getCar(rival.id);
chosen.z = 88; chosen.speed = 11;
ai.z = 3; ai.speed = 0;
for (let i = 0; i < 50 && !race.playerFinished; i++) {
  race.step(.01, {throttle:1, steer:0, brake:0});
}
assert.equal(race.playerFinished, true, 'El jugador debe alcanzar la meta');
assert.equal(race.finished, false, 'Los demás todavía no llegaron');
const results = race.makeResults([]);
assert.equal(results.find(r => r.vehicle.id === player.id)?.isDnf, false);
assert.equal(results.find(r => r.vehicle.id === rival.id)?.isDnf, true);
assert.ok(results.find(r=>r.vehicle.id===rival.id).verdict.includes('cuando terminó la partida del jugador'));

const holes = [{id:1,kind:'pothole',x:0,z:25,radius:1.12}];
assert.equal(potholeRoadDepth(0,25,holes),-.17,'Profundidad visual y física deben ser 17 cm');
assert.ok(Math.abs(potholeRoadDepth(10,25,holes)) < 1e-9,'Fuera del bache no se hunde');
const solver = new FourCornerSuspension();
let lowest = 0, peakImpact=0;
for (let i=0; i<250; i++) {
  const pose=solver.step({x:.4,z:20+i*.09,yaw:0,speed:9,dt:.01,wheelbaseM:2.6,
   trackWidthM:1.5,massKg:1350,hazards:holes,bumps:[]});
  lowest=Math.min(lowest,pose.heaveM);peakImpact=Math.max(peakImpact,pose.impact);
}
assert.ok(lowest < -.01 && peakImpact > .15, `Bache genera descenso e impacto: ${lowest}/${peakImpact}`);
console.log('OK V8.4: al llegar el jugador termina su partida; rivales pendientes sin tiempos ficticios; bache -17 cm y golpe físico.');

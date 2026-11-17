import { InteractiveRacePhysics, PHYSICS_STEP } from '../src/utils/interactiveRacePhysics.ts';
const PRESET_VEHICLES = [0,1,2].map(i=>({id: 'v'+i, name:'Car '+i, brand:'Demo', powerHp:115, torqueNm:210, weightKg:1250, tireGrip:1.05, topSpeedKmh:180, dimensions:{lengthMm:4300,widthMm:1820,heightMm:1600,clearanceMm:160}, brakingDistance100:38, dragCoeff:.33, frontalArea:2.3, drivetrain:'FWD', consumptionRacing:12, fuelCapacityL:50}));
const PRESET_TRACKS = [{distanceMeters:400,cargoPayloadKg:0,inclineGradePercent:0}];
const assert = (v, message) => { if (!v) throw new Error(message); };
const vehicles = PRESET_VEHICLES.slice(0, 3);
const track = { ...PRESET_TRACKS[0], distanceMeters: 400 };
const create = () => new InteractiveRacePhysics(vehicles, track, vehicles[0].id, false);
const left = create(), right = create();
for (let i = 0; i < 400; i++) {
  left.step(PHYSICS_STEP, { steer: -0.65, throttle: 1, brake: 0 });
  right.step(PHYSICS_STEP, { steer: 0.65, throttle: 1, brake: 0 });
}
assert(right.getCar(vehicles[0].id).x < left.getCar(vehicles[0].id).x, 'Dirección derecha invertida');
assert(right.getCar(vehicles[0].id).speed > 0, 'Motor no acelera');
const baseline = new InteractiveRacePhysics([vehicles[0]], track, vehicles[0].id, false);
const braking = new InteractiveRacePhysics([vehicles[0]], track, vehicles[0].id, false);
for (let i=0;i<300;i++) {
  baseline.step(.01, {steer:0,throttle:1,brake:0});
  braking.step(.01, {steer:0,throttle:1,brake:0});
}
for (let i=0;i<100;i++) {
  baseline.step(.01, {steer:0,throttle:1,brake:0});
  braking.step(.01, {steer:0,throttle:0,brake:1});
}
assert(braking.cars[0].speed + 2 < baseline.cars[0].speed, 'No frena');
const road = new InteractiveRacePhysics([vehicles[0]], track, vehicles[0].id, false);
const crater = new InteractiveRacePhysics([vehicles[0]], track, vehicles[0].id, false);
crater.addHazard('pothole', 0, 35);
for (let i=0;i<1000;i++) {
  road.step(.01, {steer:0,throttle:1,brake:0});
  crater.step(.01, {steer:0,throttle:1,brake:0});
}
assert(crater.cars[0].z < road.cars[0].z - .1, 'Bache no ralentiza');
const hit = new InteractiveRacePhysics([vehicles[0]], track, vehicles[0].id, false);
hit.addHazard('barrier', 0, 38);
for (let i=0;i<1300;i++) hit.step(.01, {steer:0,throttle:1,brake:0});
assert(hit.cars[0].impacts > 0, 'No detectó obstáculo');
assert(hit.cars[0].z < road.cars[0].z + 50, 'Choque sin reacción');
const ai = new InteractiveRacePhysics(vehicles, track, vehicles[0].id, false);
ai.addHazard('barrier', 0, 80);
for (let i=0;i<1000;i++) ai.step(.01, {steer:0,throttle:0,brake:0});
const bot = ai.cars[1];
assert(bot.z > 40, 'IA no acelera');
const results = ai.makeResults([]);
assert(results.length === vehicles.length && results[0].telemetryHistory.length > 2, 'No hay telemetría');
console.log('OK: volante, acelerador, frenada, baches, barreras, IA y telemetría');
console.log('Comparación bache:', {normalM: road.cars[0].z.toFixed(1), bacheM: crater.cars[0].z.toFixed(1)});
console.log('IA:', {distanceM: bot.z.toFixed(1), x: bot.x.toFixed(1), impacts: bot.impacts});

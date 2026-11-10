import { InteractiveRacePhysics, PHYSICS_STEP } from '../src/utils/interactiveRacePhysics.ts';
const vehicle = { id: 'player', name:'Tracker', powerHp:115, torqueNm:210, weightKg:1250, tireGrip:1.05, topSpeedKmh:180,
  dimensions:{lengthMm:4300,widthMm:1820,heightMm:1600,clearanceMm:160}, brakingDistance100:38, dragCoeff:.33, frontalArea:2.3,
  drivetrain:'FWD',consumptionRacing:12,fuelCapacityL:50 };
const track={distanceMeters:400,cargoPayloadKg:0,inclineGradePercent:0};
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const drive=(sim,input,steps)=>{for(let i=0;i<steps;i++)sim.step(PHYSICS_STEP,{steer:0,throttle:0,brake:0,...input})};
const sim=new InteractiveRacePhysics([vehicle], track,vehicle.id,false);
sim.getCar(vehicle.id).z=55;
const startZ=sim.cars[0].z;
drive(sim,{reverse:1},150);
assert(sim.cars[0].speed < -.5,'No engrana reversa desde detenido');
assert(sim.cars[0].z < startZ-0.5,'No avanza hacia atrás');
assert(sim.cars[0].speed >= -25/3.6-0.001,'Reversa sobrepasa límite de 25 km/h');
const telemetry=sim.makeResults([])[0].telemetryHistory.at(-1);
assert(telemetry.gear===0,'No registra marcha R');
assert(telemetry.speedKmh >= 0,'Velocímetro muestra valor negativo');
const reverseZ=sim.cars[0].z;
drive(sim,{throttle:1},200);
assert(sim.cars[0].speed>0,'Arranque en primera después de reversa falló');
assert(sim.cars[0].z>reverseZ,'No avanza al salir de reversa');
const braking=new InteractiveRacePhysics([vehicle],track,vehicle.id,false);
braking.cars[0].z=55;
drive(braking,{throttle:1},160);
const beforeBraking=braking.cars[0].speed;
drive(braking,{brake:1},60);
assert(braking.cars[0].speed<beforeBraking,'Espacio no frena');
assert(braking.cars[0].speed>=0,'Espacio engranó reversa incorrectamente');
// Choque real + marcha atrás de rescate, sin salir de los bordes.
const crash=new InteractiveRacePhysics([vehicle],track,vehicle.id,false);
crash.addHazard('barrier',0,38);
drive(crash,{throttle:1},1200);
assert(crash.cars[0].impacts>0,'No detectó choque');
const collisionZ=crash.cars[0].z;
drive(crash,{reverse:1},400);
assert(crash.cars[0].z<collisionZ-1,'No se pudo salir del choque marcha atrás');
assert(crash.cars[0].z>=0,'Atravesó el inicio de la pista');
console.log('OK: R desde parado, hasta 25 km/h, paso R→D, freno independiente, recuperación tras choque');
console.log({beforeCollisionM:collisionZ.toFixed(1), afterReverseM:crash.cars[0].z.toFixed(1), gear:telemetry.gear});

import { InteractiveRacePhysics } from '../src/utils/interactiveRacePhysics.ts';
const v=i=>({id:'v'+i,name:'Auto '+i,brand:'D',powerHp:115,torqueNm:200,weightKg:1200,tireGrip:1.02,topSpeedKmh:180,dimensions:{lengthMm:4350,widthMm:1820,heightMm:1600,clearanceMm:160},brakingDistance100:38,dragCoeff:.33,frontalArea:2.3,drivetrain:'FWD',consumptionRacing:12,fuelCapacityL:50});
const t={distanceMeters:400,cargoPayloadKg:0,inclineGradePercent:0};
const race=new InteractiveRacePhysics([v(0),v(1),v(2)],t,'v0',true);
for(let i=0;i<6500;i++)race.step(.01,{steer:0,throttle:1,brake:0});
console.log('race:',race.cars.map(c=>({id:c.id,z:+c.z.toFixed(1),x:+c.x.toFixed(1),impacts:c.impacts,damage:+c.damage.toFixed(2),finishedAt:c.finishedAt})));
// Test close car pair collision: head-on pursuit.
const crash=new InteractiveRacePhysics([v(0),v(1)],t,'v0',false);
crash.cars[0].x=0; crash.cars[1].x=0;
crash.cars[0].z=30; crash.cars[1].z=36;
crash.cars[0].speed=25; crash.cars[1].speed=3;
for(let i=0;i<80;i++)crash.step(.01,{steer:0,throttle:0,brake:0});
console.log('collision:',crash.cars.map(c=>({id:c.id,z:+c.z.toFixed(1),impacts:c.impacts,speed:+c.speed.toFixed(1)})));
if(!crash.cars.every(c=>c.impacts>0))throw new Error('Colisión auto-auto no detectada');

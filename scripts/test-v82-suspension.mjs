import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FourCornerSuspension, bumpRoadHeight, potholeRoadDepth } from '../src/utils/roadSuspension.ts';
import { InteractiveRacePhysics } from '../src/utils/interactiveRacePhysics.ts';

const speedBumps = [{id:'test',z:28,height:.085,length:2.1}];
assert.ok(Math.abs(bumpRoadHeight(28,speedBumps)-.085)<1e-10,'El lomo tiene altura real de 8.5 cm');
assert.equal(bumpRoadHeight(24,speedBumps),0);
const potholes=[{id:1,kind:'pothole',x:.75,z:20,radius:1.12}];
assert.ok(potholeRoadDepth(.75,20,potholes)<-.10,'El centro del bache está más bajo');
assert.ok(Math.abs(potholeRoadDepth(5,20,potholes)) < 1e-12);

function simulate(bumps,holes){
  const suspension=new FourCornerSuspension();
  let min=0,max=0,maxRoll=0,maxImpact=0;
  for(let i=0;i<900;i++) {
    // velocidad constante ~9 m/s para aislar la suspensión de la propulsión.
    const pose=suspension.step({x:0,z:i*.09,yaw:0,speed:9,dt:.01,
      wheelbaseM:2.65,trackWidthM:1.52,massKg:1400,hazards:holes,bumps});
    min=Math.min(min,pose.heaveM);max=Math.max(max,pose.heaveM);
    maxRoll=Math.max(maxRoll,Math.abs(pose.rollRad));
    maxImpact=Math.max(maxImpact,pose.impact);
  }
  return {min,max,maxRoll,maxImpact};
}
const bump = simulate(speedBumps,[]);
const hole = simulate([],potholes);
assert.ok(bump.max > .003,`Carrocería no asciende con lomo: ${JSON.stringify(bump)}`);
assert.ok(hole.min < -.001,`Carrocería no cae en bache: ${JSON.stringify(hole)}`);
assert.ok(hole.maxRoll > .002,`Bache unilateral no inclina la carrocería: ${JSON.stringify(hole)}`);
assert.ok(bump.maxImpact > .12,`Golpe no responde a velocidad: ${JSON.stringify(bump)}`);
const soft = simulate([{...speedBumps[0],height:.045}],[]);
assert.ok(bump.max > soft.max,'Un lomo más alto debe tener mayor respuesta');

const mock={id:'toyota',name:'Corolla',powerHp:171,torqueNm:203,weightKg:1400,topSpeedKmh:180,
 tireGrip:.95,drivetrain:'FWD',consumptionRacing:12,fuelCapacityL:45,
 dimensions:{widthMm:1825,lengthMm:4460,heightMm:1620},brakingDistance100:40,frontalArea:2.3,dragCoeff:.31};
const physics=new InteractiveRacePhysics([mock], {distanceMeters:400,cargoPayloadKg:0,inclineGradePercent:0,
 surfaceGripFactor:1,surfaceRoughnessFactor:1,routeHazardProfile:'chains',cityCircuitId:'asuncion'},mock.id,false);
physics.addHazard('pothole',.75,38);
let observed=false;
for(let i=0;i<1500;i++){
 physics.step(.01,{throttle:1,steer:0,brake:0});
 const pose=physics.getCar('toyota').suspension;
 assert.ok(Number.isFinite(pose.heaveM)&& Number.isFinite(pose.pitchRad) && Number.isFinite(pose.rollRad));
 if(Math.abs(pose.heaveM)>.001) observed=true;
}
assert.ok(observed,'La física de carrera no transmite el relieve a la suspensión');
assert.ok(physics.getCar('toyota').history.some(h=>h.wheelRoadHeights && Number.isFinite(h.suspensionHeaveM)),
 'La repetición debe guardar la suspensión por rueda');
const render=readFileSync(new URL('../src/components/Race3DPerspectiveView.tsx',import.meta.url),'utf8');
assert.match(render,/chaseDistance = \(compact \? 5\.5 : 6\.0\)/);
assert.match(render,/suspension: (?:car\.suspension|visualPose!\.suspension)/);
console.log('OK V8.2: suspensión muelle-amortiguador, bache con descenso, lomo con elevación, golpeteo y cámara cercana');
console.log({lomo:bump,bache:hole});

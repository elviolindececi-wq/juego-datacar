import assert from 'node:assert/strict';
import { InteractiveRacePhysics } from '../src/utils/interactiveRacePhysics.ts';
import { powertrainProfile, turboTarget, integrateTurbo, coastEngineBrake } from '../src/utils/powertrainDynamics.ts';
import { FourCornerSuspension } from '../src/utils/roadSuspension.ts';
import { PRESET_VEHICLES } from '../src/data/presetVehicles.ts';
const byName = (name) => PRESET_VEHICLES.find(v=>v.name === name);
const tracker = byName('TRACKER'), carens = byName('CARENS');
const corolla = byName('COROLLA CROSS'), kicks = byName('KICKS');
assert.ok(tracker && carens && corolla && kicks);
for (const turbo of [tracker,carens]) assert.equal(powertrainProfile(turbo).turbo,true,`${turbo.name} turbo según ficha`);
for (const na of [corolla,kicks]) assert.equal(powertrainProfile(na).turbo,false,`${na.name} no turbo según ficha`);
assert.equal(turboTarget(corolla,4000,1),0);
// CRDi por sí solo no equivale a un turbo confirmado: respetar la ficha de versión.
const dieselSinTurboIndicado = { ...carens, engineDescription: '1.5L CRDi', fuelFeeding: 'Inyección common-rail' };
assert.equal(powertrainProfile(dieselSinTurboIndicado).turbo, false);
const boosted = Array.from({length:100},(_,i)=>i).reduce((b)=>integrateTurbo(tracker,b,2900,1,.01),0);
assert.ok(boosted>.5 && boosted<1,'turbo tarda en cargar pero responde');
assert.ok(integrateTurbo(tracker, boosted,3000,0,.2) < boosted,'turbo descarga al soltar');
const track={id:'circuit',name:'Prueba',distanceMeters:1000,cargoPayloadKg:0,inclineGradePercent:0,routeHazardProfile:'chains',cityCircuitId:'asuncion',surfaceGripFactor:1,surfaceRoughnessFactor:1};
function physicsOf(v) { return new InteractiveRacePhysics([v], track,v.id,false); }
const phys=physicsOf(tracker);
for(let i=0;i<500;i++) phys.step(.01,{throttle:1,steer:0,brake:0});
let a=phys.getCar(tracker.id);
assert.ok(a.speed>0 && a.turboBoost>.4,`aceleración y turbo: ${a.speed}/${a.turboBoost}`);
const before=a.speed;
for(let i=0;i<250;i++) phys.step(.01,{throttle:0,steer:0,brake:0});
a=phys.getCar(tracker.id);
assert.ok(a.speed<before - 1.2,`al soltar ↑ debe retener: ${a.speed} < ${before}`);
assert.ok(a.speed>0,`no debe detenerse de golpe: ${a.speed}`);
assert.ok(a.turboBoost<.2,'turbo descarga sin acelerador');
assert.ok(coastEngineBrake(tracker,20,0,0,0)>0);
const noTurbo=physicsOf(corolla);
for(let i=0;i<250;i++) noTurbo.step(.01,{throttle:1,steer:0,brake:0});
assert.equal(noTurbo.getCar(corolla.id).turboBoost,0);
function suspensionStats(velocity, obstacles, bumps){
 const s=new FourCornerSuspension(); let maxImpact=0,maxHeave=0,minHeave=0,maxRoll=0;
 for(let i=0;i<800;i++){
  const q=s.step({x:.5,z:i*velocity*.01,yaw:0,speed:velocity,dt:.01,wheelbaseM:2.6,trackWidthM:1.5,massKg:1400,hazards:obstacles,bumps});
  maxImpact=Math.max(maxImpact,q.impact); maxHeave=Math.max(maxHeave,q.heaveM);
  minHeave=Math.min(minHeave,q.heaveM);maxRoll=Math.max(maxRoll,Math.abs(q.rollRad));
 }
 return {maxImpact,maxHeave,minHeave,maxRoll};
}
const speedBump=[{id:'b',z:25,height:.11,length:2.1}];
const pothole=[{id:1,kind:'pothole',z:25,x:.9,radius:1.12}];
const slow=suspensionStats(4,[],speedBump), fast=suspensionStats(17,[],speedBump);
const hole=suspensionStats(12,pothole,[]);
assert.ok(fast.maxImpact>slow.maxImpact,`golpe depende velocidad ${JSON.stringify({fast,slow})}`);
assert.ok(fast.maxHeave>.01,'lomo levanta carrocería');
assert.ok(hole.minHeave<-.01 && hole.maxRoll>.008,'bache baja e inclina');
console.log('OK V8.3: turbo específico, retención al soltar ↑, baches y lomos más notorios.');
console.log({trackerBoost: boosted,coasting:{before,after:a.speed},bumpSlow:slow,bumpFast:fast,pothole:hole});

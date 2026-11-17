import assert from 'node:assert/strict';
import { PRESET_VEHICLES } from '../src/data/presetVehicles.ts';
import { integrateBicycle } from '../src/utils/advancedVehicleDynamics.ts';
import { InteractiveRacePhysics } from '../src/utils/interactiveRacePhysics.ts';
import { getVehicleDynamicsProfile } from '../src/utils/vehicleDynamicsProfile.ts';
const vehicle = id => {const v=PRESET_VEHICLES.find(v=>v.id===id);assert.ok(v,id);return v;};
const tracker=vehicle('chevrolet-tracker-lite'), corolla=vehicle('toyota-corolla-cross-seg-2027'),t4=vehicle('chery-t4-pro-luxury-hev');
const track={id:'test89',name:'V8.9',distanceMeters:3000,cargoPayloadKg:0,inclineGradePercent:0,surfaceGripFactor:1,surfaceRoughnessFactor:1};
const bicycle=i=>integrateBicycle({massKg:1450,wheelbaseM:2.65,drivetrain:'FWD',speedMps:22,lateralSpeedMps:0,yawRateRadS:0,steeringRad:.10,longitudinalAccelMps2:0,tyreFriction:1,dt:.01,...i});
const first=bicycle();
assert.ok(first.frontLateralForceN>0 && first.yawRateRadS>0,'volante hacia +X genera fuerza lateral y guiñada +X');
assert.ok(Math.abs(first.frontNormalN+first.rearNormalN-1450*9.80665)<.01,'cargas verticales conservan peso');
const braking=bicycle({longitudinalAccelMps2:-6});
assert.ok(braking.frontNormalN>first.frontNormalN,'frenado transfiere peso al tren delantero');
assert.ok(braking.rearNormalN<first.rearNormalN);
const accelerating=bicycle({longitudinalAccelMps2:3});
assert.ok(accelerating.rearNormalN>first.rearNormalN,'aceleración transfiere peso atrás');
const wet=bicycle({tyreFriction:.44,steeringRad:.28});
const dry=bicycle({tyreFriction:1.08,steeringRad:.28});
assert.ok(wet.frontLateralForceN<dry.frontLateralForceN,'menos adherencia = menos fuerza lateral');
const shared={speedMps:25,steeringRad:.12,tyreFriction:1.0};
const turning=bicycle(shared);
const simultaneous=bicycle({...shared,longitudinalAccelMps2:-10});
assert.ok(simultaneous.frontLateralForceN<turning.frontLateralForceN,'frenar fuerte consume adherencia lateral');
const rev=bicycle({speedMps:-2,steeringRad:.23});
assert.ok(rev.yawRateRadS<0,'volante hace girar al sentido inverso en marcha atrás');
// Rollout with same vehicle, deterministic dt and weather consistency.
function rollout(v,{secs=8,steer=0,weather='sunny',cargo=0,brake=0,throttle=1}={}) {
 const t={...track,cargoPayloadKg:cargo};const sim=new InteractiveRacePhysics([v],t,v.id,false);sim.setWeather(weather);
 for(let i=0;i<secs*100;i++)sim.step(.01,{steer,throttle,brake});
 const c=sim.getCar(v.id);return {c,sim};
}
const a=rollout(corolla),b=rollout(corolla);
assert.ok(Math.abs(a.c.speed-b.c.speed)<1e-9 && Math.abs(a.c.x-b.c.x)<1e-9,'simulación determinista con paso fijo');
const heavy=structuredClone(corolla);heavy.weightKg*=1.5;
assert.ok(a.c.speed>rollout(heavy).c.speed,'mayor peso baja la aceleración a igualdad de motor');
assert.ok(rollout(t4,{secs:4}).c.speed>rollout(vehicle('suzuki-fronx'),{secs:4}).c.speed,'HEV sale más ágil que mild hybrid');
const cornerDry=rollout(corolla,{secs:5,steer:.48,weather:'sunny'}).c;
const cornerWet=rollout(corolla,{secs:5,steer:.48,weather:'storm'}).c;
for(const [label,c] of [['seca',cornerDry],['mojada',cornerWet]]) {
 for(const key of ['x','z','yaw','yawRate','lateralSpeed','lateralAccelMps2','slip','speed']) assert.ok(Number.isFinite(c[key]),`${label}: ${key} finito`);
 assert.ok(Math.abs(c.yawRate)<1.9 && Math.abs(c.lateralSpeed)<12.1,`${label} no diverge`);
}
const one=rollout(corolla,{secs:12,steer:0,weather:'sunny'}).c;
const two=rollout(corolla,{secs:12,steer:0,weather:'flood'}).c;
assert.ok(one.z>two.z,'zonas de raudal reducen distancia recorrida');
const p=getVehicleDynamicsProfile(tracker,0,12);
assert.ok(p.massKg>700 && p.wheelbaseM>2.2,'perfil específico de ficha');
for(const v of PRESET_VEHICLES) {
 const test=rollout(v,{secs:12,steer:0}).c;
 for(const key of ['speed','x','z','engineRpm','lateralSpeed']) assert.ok(Number.isFinite(test[key]),`${v.id}: ${key} finito`);
 assert.ok(test.speed<=v.topSpeedKmh/3.6+.01,`${v.id} no supera su límite de ficha/simulación`);
}
// Escenario de estrés reproducible: tres autos, tráfico, barreras, curvas,
// frenadas, marcha atrás y raudales. Debe conservar magnitudes finitas.
const simStress=new InteractiveRacePhysics([tracker,corolla,t4],{...track,distanceMeters:2500},tracker.id,true);
simStress.setWeather('flood');
for(let i=0;i<3500;i++){
  const phase=i%560;
  const input={throttle:phase<330?1:phase>510?.3:0,
    brake:phase>=330&&phase<400?.90:0,
    reverse:phase>=400&&phase<490?.65:0,
    steer:Math.sin(i/73)*.85};
  simStress.step(.01,input);
  for(const car of simStress.cars){
    for(const k of ['x','z','yaw','yawRate','lateralSpeed','speed','acceleration','frontNormalN','rearNormalN','sideSlipRad'])
      assert.ok(Number.isFinite(car[k]),`estrés: ${car.id}.${k} no finito`);
    assert.ok(Math.abs(car.x)<=7,`estrés: ${car.id} dentro de la calle`);
    assert.ok(car.frontNormalN>=0&&car.rearNormalN>=0,'contactos verticales positivos');
  }
}
assert.ok(simStress.cars.some(car=>car.impacts>0)||simStress.hazards.length>0,'se evaluaron obstáculos');
console.log('OK V8.9: ejes, transferencia de carga, elipse fricción, dirección/reversa, clima, masa, HEV, 7 autos, determinismo y estabilidad.');
console.log('Prueba curvas:',{seco:{x:cornerDry.x,yaw:cornerDry.yaw,speed:cornerDry.speed,slip:cornerDry.slip},mojado:{x:cornerWet.x,yaw:cornerWet.yaw,speed:cornerWet.speed,slip:cornerWet.slip}});

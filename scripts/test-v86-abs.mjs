import assert from 'node:assert/strict';
import { PRESET_VEHICLES } from '../src/data/presetVehicles.ts';
import { hasDocumentedABS, brakingResponse } from '../src/utils/brakingDynamics.ts';
import { InteractiveRacePhysics } from '../src/utils/interactiveRacePhysics.ts';

const corolla = PRESET_VEHICLES.find(v => v.name === 'COROLLA CROSS');
assert.ok(corolla, 'Corolla Cross cargado');
assert.equal(hasDocumentedABS(corolla), true, 'Corolla: ABS con EBD documentado');
for (const v of PRESET_VEHICLES) {
 const expected = v.id !== 'kia-carens-ex'; // Carens: año exacto aún pendiente
 assert.equal(hasDocumentedABS(v), expected, `${v.name}: respetar ABS de la ficha nueva`);
}
const without = { ...corolla, id: 'corolla-no-abs-doc', equipment: {...corolla.equipment, safetyFeatures: [], abs: undefined, safetySystems: {...corolla.equipment.safetySystems, abs:'absent'}} };
assert.equal(hasDocumentedABS(without), false);
const normal = brakingResponse({vehicle:corolla,speedMps:20,pedal:.28,availableLongitudinalAccel:8,requestedMaxDeceleration:9.9,timeSeconds:1});
assert.equal(normal.absActive,false,'frenada suave sin modulación ABS');
const hardWet = brakingResponse({vehicle:corolla,speedMps:20,pedal:1,availableLongitudinalAccel:5,requestedMaxDeceleration:9.9,timeSeconds:1});
const hardUnknown = brakingResponse({vehicle:without,speedMps:20,pedal:1,availableLongitudinalAccel:5,requestedMaxDeceleration:9.9,timeSeconds:1});
assert.equal(hardWet.absActive,true,'ABS modula bajo baja adherencia');
assert.ok(hardWet.brakeSlip < hardUnknown.brakeSlip,'ABS limita deslizamiento longitudinal');
assert.ok(hardWet.steeringRetention > hardUnknown.steeringRetention,'ABS ayuda a conservar dirección');
assert.ok(hardWet.deceleration > hardUnknown.deceleration,'la presión modulada evita bloqueo con calzada mojada');
const slow = brakingResponse({vehicle:corolla,speedMps:0,pedal:1,availableLongitudinalAccel:5,requestedMaxDeceleration:9.9,timeSeconds:1});
assert.ok(!slow.absActive && slow.deceleration === 0,'ABS desactivado al detenerse');
const track = { id:'circuit',name:'Prueba frenada',distanceMeters:1000,cargoPayloadKg:0,inclineGradePercent:0,cityCircuitId:'asuncion',routeHazardProfile:'chains',surfaceGripFactor:1,surfaceRoughnessFactor:1 };
function run(vehicle,mode='rain') {
 const physics=new InteractiveRacePhysics([vehicle],track,vehicle.id,false);
 physics.setWeather(mode);
 for (let i=0;i<950;i++) physics.step(.01,{throttle:1,steer:0,brake:0});
 const car=physics.getCar(vehicle.id);
 assert.ok(car.speed>8,'velocidad inicial suficiente');
 let wasActive=false, maxSlip=0;
 let distance=0,steps=0;
 while(car.speed> .2 && steps<900){
  const z=car.z;physics.step(.01,{throttle:0,steer:0,brake:1});
  distance+=Math.max(0,car.z-z); wasActive ||= car.absActive; maxSlip=Math.max(maxSlip,car.brakeSlip); steps++;
 }
 return {wasActive,maxSlip,distance,steps};
}
const withABS=run(corolla), control=run(without);
assert.equal(withABS.wasActive,true,'ABS entra durante frenada de emergencia');
assert.ok(withABS.distance < control.distance,'distancia menor que referencia sin ABS bajo condiciones iguales');
assert.ok(withABS.maxSlip < control.maxSlip,'menos deslizamiento acumulado al frenar');
console.log('OK V8.6: ABS únicamente documentado, modulación al límite, dirección preservada y frenada intensa con telemetría.');
console.log({withABS,withoutABSForTest:control});

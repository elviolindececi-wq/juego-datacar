import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { InteractiveRacePhysics } from '../src/utils/interactiveRacePhysics.ts';
import { WEATHER_OPTIONS, WEATHER_CONFIG, getWaterZones, waterContact } from '../src/utils/weatherDynamics.ts';

assert.deepEqual(WEATHER_OPTIONS.map(o => o.id), ['sunny','cloudy','rain','storm','flood']);
assert.ok(WEATHER_CONFIG.storm.grip < WEATHER_CONFIG.rain.grip);
assert.equal(getWaterZones('sunny', 620, 'flood').length, 0);
const zones = getWaterZones('flood', 620, 'flood');
assert.ok(zones.length >= 3);
assert.ok(waterContact(zones, zones[0].x, zones[0].z).immersion > .5);

const car = { id:'test-car', name:'Toyota Corolla Cross', powerHp:171, torqueNm:203,
  weightKg:1400, topSpeedKmh:185, tireGrip:.95, drivetrain:'FWD', fuelType:'gasoline',
  brakingDistance100:40, frontalArea:2.3, dragCoeff:.31,
  dimensions:{lengthMm:4460,widthMm:1825,heightMm:1620} };
const track = { distanceMeters:620, inclineGradePercent:0, cargoPayloadKg:0,
  surfaceGripFactor:.95, surfaceRoughnessFactor:1, cityCircuitId:undefined, routeHazardProfile:'flood' };
const clear = new InteractiveRacePhysics([car], track, car.id, false);
const wet = new InteractiveRacePhysics([car], track, car.id, false);
wet.setWeather('flood');
for (let i=0;i<2500;i++) {
  clear.step(.01, {throttle:1,reverse:0,steer:0,brake:0});
  wet.step(.01, {throttle:1,reverse:0,steer:0,brake:0});
}
assert.ok(wet.waterEvents > 0, 'La simulación no detectó el raudal');
assert.ok(wet.getCar(car.id).z < clear.getCar(car.id).z, 'El agua no modifica la distancia');
let scenery = readFileSync(new URL('../src/utils/urbanTrackScenery.ts',import.meta.url),'utf8');
assert.match(scenery, /publicidad_datacarpy_com_fachada_/);
assert.doesNotMatch(scenery, /const fixedAdZ =/);
assert.match(scenery, /PlaneGeometry\(2\.65, \.50\)/);
const renderer = readFileSync(new URL('../src/components/Race3DPerspectiveView.tsx',import.meta.url),'utf8');
assert.match(renderer,/case 'arcade'/);
assert.match(renderer,/createWeatherVisuals3D/);
assert.match(renderer,/setWeatherMode/);
assert.match(renderer,/soundEngine\.playImpact/);
console.log('OK V8.0: climas, hidroplaneo aproximado, desaceleración con raudal, cámara arcade, ads en fachadas y señales compactas.');
console.log({ clearMeters:clear.getCar(car.id).z.toFixed(1), floodMeters:wet.getCar(car.id).z.toFixed(1), floodSamples:wet.waterEvents });

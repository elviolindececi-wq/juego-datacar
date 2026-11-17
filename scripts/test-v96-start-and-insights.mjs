import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRESET_VEHICLES } from '../src/data/presetVehicles.ts';
import { initialRaceInsight, nextRaceInsight } from '../src/utils/vehicleRaceInsights.ts';

const t2 = PRESET_VEHICLES.find(v => v.id === 'chery-t2-pro-max');
const tracker = PRESET_VEHICLES.find(v => v.id === 'chevrolet-tracker-lite');
const corolla = PRESET_VEHICLES.find(v => v.id === 'toyota-corolla-cross-seg-2027');
const t4 = PRESET_VEHICLES.find(v => v.id === 'chery-t4-pro-luxury-hev');
assert.ok(t2 && tracker && corolla && t4, 'Main catalog is present');
const prohibited = /105\s*(?:HP|CV)|140\s*Nm/i;
for (const choice of [initialRaceInsight(t2), ...Array.from({length:16}, (_,i) => nextRaceInsight(t2, {
  speedKmh:40, accelG:.16, rpm:2100, slip:.05, pothole:false, impacts:0, absActive:false,
  tcsActive:false, escActive:false, aebActive:false, braking:false,
}, {throttle:.4, weather:'sunny',elapsedSec:22},i))]) {
  assert.doesNotMatch(choice.message, prohibited, 'T2 simulated values must not appear as factory specs');
}
assert.match(initialRaceInsight(tracker).message, /220 Nm/, 'Certified tracker torque is displayed');
assert.match(initialRaceInsight(corolla).message, /203 Nm/, 'Certified Corolla torque is displayed');
const sample = {
  speedKmh:19, accelG:.06, rpm:1900, slip:.05, pothole:false, impacts:0, absActive:false,
  tcsActive:false, escActive:false, aebActive:false, braking:false,
};
const start = nextRaceInsight(tracker, sample, {throttle:1,weather:'sunny',elapsedSec:4},0);
assert.equal(start.id,'salida-lenta');
assert.match(start.message,/no se puede afirmar.*torque bajo/i);
const abs = nextRaceInsight(corolla,{...sample,speedKmh:55,absActive:true}, {throttle:0,weather:'rain',elapsedSec:14},0);
assert.equal(abs.id,'abs');
const crash = nextRaceInsight(corolla,sample, {throttle:0,weather:'sunny',elapsedSec:18,newCollision:true},0);
assert.equal(crash.id,'choque');
const wet = Array.from({length:12}, (_,i) => nextRaceInsight(corolla,{...sample,speedKmh:55}, {throttle:0,weather:'rain',elapsedSec:30},i));
assert.ok(wet.some(x=>x.id==='lluvia'));
const hev = Array.from({length:12}, (_,i) => nextRaceInsight(t4,sample, {throttle:0,weather:'sunny',elapsedSec:30},i));
assert.ok(hev.some(x=>x.id==='hev'));
const scene = readFileSync(new URL('../src/components/Race3DPerspectiveView.tsx',import.meta.url),'utf8');
const app = readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const sound = readFileSync(new URL('../src/utils/soundEngine.ts',import.meta.url),'utf8');
assert.match(app,/const startRace = \(\) => \{ soundEngine\.unlock\(\)/,'Click unlocks audio');
for (const step of ['3','2','1','0']) assert.match(scene,new RegExp(`playCountdownTone\\(${step}\\)`));
assert.match(scene,/setCountdown\(null\);\s*setGoFlash\(true\);\s*setIsPlaying\(true\);/,'Physical race starts with the long beep');
assert.match(sound,/const duration = finalTone \? 0\.72 : 0\.18/,'Long fourth tone');
assert.match(scene,/DATACAR · DATO EN CARRERA/,'Contextual insight is rendered');
console.log('OK V9.6: 3 short beeps + long GO, authorized sound, no invented T2 specs, physics-based insights');

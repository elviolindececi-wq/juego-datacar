import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const src = fs.readFileSync(path.join(root,'src/utils/soundEngine.ts'),'utf8');
const cars = ['tracker','corolla','kicks','carens'];
for (const [prefix,id] of Object.entries({
  tracker:'chevrolet-tracker-lite',
  corolla:'toyota-corolla-cross-seg-2027',
  kicks:'nissan-kicks-2027',
  carens:'kia-carens-ex',
})) {
 assert(src.includes(`'${id}'`), `Falta perfil de ${prefix}`);
 for (const state of ['idle','cruise','load']) {
  const filename=path.join(root,'public/audio/engines',`${prefix}_${state}.wav`);
  const b=fs.readFileSync(filename);
  assert(b.length>40000 && b.length<500000, `Tamaño WAV anómalo: ${filename}`);
  assert.equal(b.toString('ascii',0,4),'RIFF');
  assert.equal(b.toString('ascii',8,12),'WAVE');
  assert.equal(b.readUInt16LE(22),1, 'WAV mono');
  assert.equal(b.readUInt32LE(24),48000,'Muestreo 48 kHz');
  assert.equal(b.readUInt16LE(34),16,'PCM 16-bit');
  const data=b.indexOf(Buffer.from('data'));
  assert(data>0,'No se encontró chunk data');
  const start=data+8;
  const last=b.length-2;
  const seam=Math.abs(b.readInt16LE(start)-b.readInt16LE(last));
  assert(seam<6,`Loop discontinuo en ${prefix}_${state}: ${seam}`);
 }
}
assert(src.includes('decodeAudioData') && src.includes('setTargetAtTime'),'Falta carga y mezcla de audio');
console.log('OK AUDIO V8.1: 4 vehículos, 12 WAV PCM, bucles continuos y motor WebAudio integrado.');

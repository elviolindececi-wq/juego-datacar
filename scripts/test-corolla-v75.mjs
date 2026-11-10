import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const glbPath = path.join(root,'public/models/toyota-corolla-cross-seg-2027.glb');
const b=fs.readFileSync(glbPath);
assert.equal(b.toString('ascii',0,4),'glTF');
const jsonLength=b.readUInt32LE(12);
const data=JSON.parse(b.subarray(20,20+jsonLength).toString('utf8'));
assert.equal(data.nodes.length,8,'El GLB debe mantener 8 piezas originales');
const wheels = data.nodes.filter(n=>/^model_part\d+$/.test(n.name) && n.name!=='model_part0');
assert.equal(wheels.length,7,'Se esperan 7 subpiezas de ruedas');
const bounds=wheels.map(n=>{
  const p=data.meshes[n.mesh].primitives[0];
  const acc=data.accessors[p.attributes.POSITION];
  const min=acc.min,max=acc.max;
  return {name:n.name,x:(min[0]+max[0])/2,z:(min[2]+max[2])/2};
});
const midX=(Math.min(...bounds.map(x=>x.x))+Math.max(...bounds.map(x=>x.x)))/2;
const midZ=(Math.min(...bounds.map(x=>x.z))+Math.max(...bounds.map(x=>x.z)))/2;
const groups={};
for(const part of bounds){
  const key=`${part.x<midX?'F':'R'}${part.z>midZ?'L':'R'}`;
  (groups[key]??=[]).push(part.name);
}
for(const key of ['FL','FR','RL','RR'])assert.ok(groups[key]?.length,`${key} sin ruedas`);
assert.equal(Object.values(groups).flat().length,7);
console.log('Ruedas por zona:',groups);
assert.ok(b.length<45*1024*1024,'El GLB optimizado excede 45 MiB');
const video=path.join(root,'public/assets/aistudio/Toyota_Corolla_Cross_SEG_2027.mp4');
assert.ok(fs.existsSync(video));
const frames=path.join(root,'public/assets/360_frames/corolla');
for(let i=1;i<=120;i++) assert.ok(fs.existsSync(path.join(frames,`frame_${String(i).padStart(3,'0')}.jpg`)),`Falta frame_${i}`);
const preset=fs.readFileSync(path.join(root,'src/data/presetVehicles.ts'),'utf8');
for (const s of ["id: 'toyota-corolla-cross-seg-2027'",'powerHp: 171','torqueNm: 203','priceUsd: 36800','estimatedSimulationParameters: true']) assert.ok(preset.includes(s),s);
const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
assert.ok(app.includes('const allCars = PRESET_VEHICLES;'));
assert.ok(app.includes('.slice(0, 2)'),'Los rivales deben limitarse a dos');
console.log('OK: GLB, 4 grupos, 120 frames, video, ficha y selección.');

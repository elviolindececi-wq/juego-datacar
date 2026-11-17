import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const scene = fs.readFileSync(path.join(root,'src/components/Race3DPerspectiveView.tsx'),'utf8');
const textures = fs.readFileSync(path.join(root,'src/utils/race3dTextures.ts'),'utf8');
const sceneImport = scene.match(/import\s*\{([^}]*)\}\s*from\s*['"]\.\.\/utils\/race3dTextures['"]/s);
assert.ok(sceneImport, 'La escena debe importar explícitamente las funciones de texturas');
assert.match(sceneImport[1], /\bcreateAsphaltMicroRelief\b/, 'Falta importar createAsphaltMicroRelief, produciendo pantalla negra al cargar la carrera');
assert.match(textures, /export\s+function\s+createAsphaltMicroRelief\s*\(/, 'La función de micro-relieve debe estar exportada en race3dTextures.ts');
assert.match(scene,/\bconst asphaltRelief = createAsphaltMicroRelief\(\)/,'La pista debe usar el material de micro-relieve');
console.log('OK V9.2.1: createAsphaltMicroRelief importado y definido; verificación de referencia al cargar la escena.');

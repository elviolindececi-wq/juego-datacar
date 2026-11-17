import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const at = name => fs.readFileSync(path.resolve(import.meta.dirname,'../'+name),'utf8');
const checkSyntax = name => {
 const source=at(name);
 const output=ts.transpileModule(source,{fileName:name,reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}});
 const errors=(output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0, name+': '+errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
};
[
 'src/utils/depressedRoadSurface3D.ts',
 'src/utils/realisticPotholes3D.ts',
 'src/utils/urbanTrackScenery.ts',
 'src/utils/interactiveRacePhysics.ts',
 'src/utils/soundEngine.ts',
 'src/components/Race3DPerspectiveView.tsx',
].forEach(checkSyntax);
const scene=at('src/components/Race3DPerspectiveView.tsx');
const road=at('src/utils/depressedRoadSurface3D.ts');
const hole=at('src/utils/realisticPotholes3D.ts');
assert.match(scene,/updateRoadCutouts\(experience === 'replay'/);
assert.match(scene,/if \(added\.kind === 'pothole'\) updateRoadCutouts/);
assert.match(scene,/livePhysics\.playerFinished/);
assert.match(scene,/isFinishCinematic \? 'frontal_meta'/);
assert.match(scene,/onFinishRace/);
assert.match(scene,/soundEngine\.playSuspensionHit/);
assert.match(road,/outline\.holes\.push\(cutout\)/);
assert.match(hole,/cavidad_real_profunda_17cm/);
assert.match(hole,/RingGeometry/);
console.log('OK V8.4: sintaxis TypeScript y flujo geometría, golpes, corte de meta, resultados.');

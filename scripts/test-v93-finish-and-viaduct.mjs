import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { finishCameraPose } from '../src/utils/finishCinematicCamera.ts';
import { getViaductStations } from '../src/utils/viaductPlacement.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const approx = (a, b, tolerance = 1e-8) => Math.abs(a - b) <= tolerance;

// La cámara debe situarse siempre ENFRENTE del vehículo, con curvas incluidas.
for (const yaw of [0, .15, -.5, Math.PI / 2, -Math.PI / 2, Math.PI]) {
  const x = 47.2, z = 962.5;
  for (const p of [0, .5, 1]) {
    const shot = finishCameraPose(x, z, yaw, p, false);
    const dx = shot.camera.x - x, dz = shot.camera.z - z;
    const frontDot = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    assert.ok(frontDot > 5.6 && frontDot < 6.9, `Plano frontal delante del coche: yaw ${yaw}, p ${p}`);
    assert.ok(approx(shot.target.x, x) && approx(shot.target.z, z));
    assert.ok(shot.camera.y > 1.4 && shot.camera.y < 1.8);
    assert.ok(Number.isFinite(shot.fov) && shot.fov > 40 && shot.fov < 60);
  }
}
assert.ok(finishCameraPose(0, 0, 0, 1).camera.z < finishCameraPose(0, 0, 0, 0).camera.z,
  'El travelling debe acercarse levemente');
assert.ok(finishCameraPose(0, 0, Math.PI / 2, 0).camera.x > 5,
  'Al terminar una curva de 90°, la cámara no debe volver al eje Z recto');

for (const profile of ['craters','chains','trenches','flood','cobbles','traffic']) {
  for (const length of [1600,1900,2300]) {
    const stations = getViaductStations(length, profile);
    assert.ok(stations.length >= 2 && stations.length <= 3, 'Viaductos repartidos por circuito');
    for (const s of stations) {
      assert.ok(s > 125 && s < length - 125, 'Lejos de salida y meta');
      for (const cross of [.33,.64].map(p => Math.round(length*p))) {
        assert.ok(Math.abs(cross-s) >= 32, 'No colocar sobre intersecciones');
      }
    }
  }
}
assert.deepEqual(getViaductStations(402, 'traffic'), [], 'Sin viaductos en prueba corta');

const scene = readFileSync(join(root, 'src/components/Race3DPerspectiveView.tsx'), 'utf8');
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
const bridge = readFileSync(join(root, 'src/utils/datacarViaducts3D.ts'), 'utf8');
assert.ok(scene.includes('finishCameraPose(selectedX, selectedZ, carYaw'), 'La cámara usa la posición y yaw reales');
assert.ok(scene.includes("!(isFinishCinematic && effectiveShot === 'frontal_meta')"), 'No se transforma dos veces el plano final');
assert.ok(scene.includes('createDatacarViaducts3D(roadWidth, track.distanceMeters'), 'Puentes integrados a los circuitos urbanos');
assert.ok(scene.includes('bendRoadsideGroup(viaducts, roadPath)'), 'Puentes alineados a ruta curva');
assert.ok(app.includes('TU LLEGADA') && app.includes('getPreviewUrl(hero.id)'), 'Imagen grande del jugador en resultados');
assert.ok(bridge.includes('DATACARPY.COM') && bridge.includes('publicidad_viaducto_datacarpy'), 'Marca en el propio viaducto');
assert.ok(bridge.includes('side * legX'), 'Pilares fuera de la calzada');
assert.ok(existsSync(join(root,'public/assets/vehicle-previews/toyota-corolla-cross-seg-2027.jpg')),
  'Imagen grande disponible');
console.log('OK V9.3: cámara frontal en curvas, auto en resultados, viaductos, publicidad y separación de intersecciones.');

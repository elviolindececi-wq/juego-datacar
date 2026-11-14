import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getHyperrealAtmosphere } from './hyperrealEnvironment3D';
import {
  NFSMW_PRESET_BY_WEATHER,
  computeSunScreenProjection,
  createAutumnLeafParticlePool,
  stepAutumnLeafParticlePool,
  enhanceAsphaltMaterialWithPuddles,
  createAutumnAtmosphericParticles,
} from './nfsmwRenderingPipeline';
import { createUrbanTrackScenery } from './urbanTrackScenery';
import { createDatacarViaducts3D } from './datacarViaducts3D';
import { getViaductStations } from './viaductPlacement';
import { getAsuncionStreetDetails } from './asuncionStreetData';

function installCanvasStubIfNeeded(): () => void {
  const prevDoc = (globalThis as { document?: unknown }).document;
  if (prevDoc) return () => {};

  const noopCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillRect: () => {},
    clearRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    roundRect: () => {},
    fillText: () => {},
    measureText: (t: string) => ({ width: t.length * 10 }),
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: () => {},
  };

  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      width: 256,
      height: 256,
      getContext: () => noopCtx,
    }),
  };

  return () => {
    delete (globalThis as { document?: unknown }).document;
  };
}

test('NFSMW (2005) modernizado: gradación otoñal desaturada, sol HDR vespertino bajo y neblina dorada', () => {
  const sunny = getHyperrealAtmosphere('sunny');
  const preset = NFSMW_PRESET_BY_WEATHER.sunny;

  // Sol HDR intenso en ángulo bajo de tarde pero sin contraluz oscuro sobre los autos
  assert.ok(sunny.sunIntensity > 3.0, `Sol HDR debe superar 3.0 (actual=${sunny.sunIntensity})`);
  assert.ok(sunny.sunDir[1] > 0.5 && sunny.sunDir[1] < 0.56, `Elevación solar de tarde dorada (actual=${sunny.sunDir[1]})`);
  assert.ok(sunny.sunDir[2] < -0.5, `Dirección solar posterior preservada (actual=${sunny.sunDir[2]})`);
  assert.ok(sunny.fogDensity >= 0.0018, `Perspectiva aérea/niebla de distancia activa (actual=${sunny.fogDensity})`);

  // Paleta cálida dorada/ámbar/ocre + desaturación cinematográfica controlada
  const sunColor = new THREE.Color(sunny.sunLightHex);
  const horizonColor = new THREE.Color(sunny.horizonHex);
  assert.ok(sunColor.r > sunColor.g && sunColor.g > sunColor.b, 'Luz solar debe tener tinte cálido ámbar/dorado');
  assert.ok(horizonColor.r > horizonColor.g && horizonColor.g > horizonColor.b, 'Horizonte debe tener bruma cálida ocre/dorada');
  assert.ok(preset.desaturation >= 0.15 && preset.desaturation <= 0.32, 'Desaturación otoñal fotorrealista');
  assert.ok(preset.bloomStrength >= 0.5, 'Overbright bloom activo en reflejos y horizonte');
  assert.ok(preset.lensFlareIntensity >= 0.8, 'Lens flare activo frente al sol');
});

test('computeSunScreenProjection activa lens flare al mirar hacia el sol y lo apaga de espaldas', () => {
  const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.2, 1000);
  const sunDir: readonly [number, number, number] = [0.56, 0.518, -0.646];

  cam.position.set(0, 2, 0);
  cam.lookAt(sunDir[0] * 100, sunDir[1] * 100, sunDir[2] * 100);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();

  const towardSun = computeSunScreenProjection(cam, sunDir);
  assert.ok(towardSun.visibility > 0.75, `Visibilidad alta mirando al sol (${towardSun.visibility})`);
  assert.ok(Math.abs(towardSun.uvX - 0.5) < 0.05 && Math.abs(towardSun.uvY - 0.5) < 0.05);

  cam.lookAt(-sunDir[0] * 100, -sunDir[1] * 100, -sunDir[2] * 100);
  cam.updateMatrixWorld(true);
  const awayFromSun = computeSunScreenProjection(cam, sunDir);
  assert.equal(awayFromSun.visibility, 0, 'Lens flare debe valer 0 cuando el sol queda detrás de la cámara');
});

test('enhanceAsphaltMaterialWithPuddles extiende MeshStandardMaterial con charcos y sonda dinámica sin reemplazar PBR', () => {
  const roadMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82 });
  const fakeProbe = new THREE.CubeTexture();
  const handle = enhanceAsphaltMaterialWithPuddles(roadMat, fakeProbe);

  assert.equal(roadMat.envMap, fakeProbe, 'Debe enlazar el cubemap dinámico en tiempo real al asfalto');
  assert.equal(typeof roadMat.onBeforeCompile, 'function');

  const mockShader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: 'void main() {\n#include <project_vertex>\n}',
    fragmentShader: [
      'void main() {',
      '#include <color_fragment>',
      '#include <roughnessmap_fragment>',
      '#include <metalnessmap_fragment>',
      '#include <normal_fragment_maps>',
      '}',
    ].join('\n'),
  };
  roadMat.onBeforeCompile(mockShader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);

  assert.ok(mockShader.fragmentShader.includes('nfsmwEvaluateWetness'), 'Inyecta máscara espacial de humedad y charcos');
  assert.ok(mockShader.fragmentShader.includes('puddleNormal'), 'Aplana normales con micro-ondas sobre charcos');
  handle.setPuddleState(0.88, 12.5);
  assert.equal((mockShader.uniforms.uPuddleAmount as { value: number }).value, 0.88);
  assert.equal((mockShader.uniforms.uWetTime as { value: number }).value, 12.5);
});

test('geometría del mapa 100% intacta con sombras proyectadas y materiales PBR/reflexiones activas en edificios, puentes y árboles', () => {
  const cleanup = installCanvasStubIfNeeded();
  try {
    const roadWidth = 21;
    const trackLength = 1200;
    const profile = 'avenida';

    const scenery = createUrbanTrackScenery(roadWidth, trackLength, profile, true, 'aviadores');
    const viaducts = createDatacarViaducts3D(roadWidth, trackLength, profile);

    // 1. Verificar invariancia de estaciones de viaductos e intersecciones del mapa
    const expectedStations = getViaductStations(trackLength, profile);
    assert.deepEqual(viaducts.userData.stations, expectedStations, 'Los puentes/viaductos mantienen sus estaciones exactas');
    const expectedCrossings = getAsuncionStreetDetails(profile, trackLength - 120).crossings;
    const crossingMeshes = scenery.children.filter((c) => c.name.startsWith('interseccion_3d_'));
    assert.equal(crossingMeshes.length, expectedCrossings.length, 'Las intersecciones mantienen su cantidad y diseño intactos');

    // 2. Verificar sombras proyectadas en tiempo real en edificios, torres, árboles y puentes
    const buildingInst = scenery.children.find((c) => c.name === 'urban_buildings_0') as THREE.InstancedMesh | undefined;
    const towerInst = scenery.children.find((c) => c.name === 'skyline_towers_0') as THREE.InstancedMesh | undefined;
    assert.ok(buildingInst && buildingInst.castShadow && buildingInst.receiveShadow, 'Edificios proyectan y reciben sombras reales');
    assert.ok(towerInst && towerInst.castShadow && towerInst.receiveShadow, 'Torres proyectan y reciben sombras reales');

    // Materiales PBR con mapas especulares/rugosidad y sonda de reflexión dinámica
    const facadeMat = buildingInst!.material as THREE.MeshStandardMaterial;
    assert.ok(facadeMat.roughnessMap, 'Fachadas urbanas poseen mapa PBR de rugosidad/especularidad');
    assert.ok(facadeMat.normalMap || facadeMat.bumpMap, 'Fachadas urbanas poseen mapa PBR de normales/relieve');

    const probeTex = new THREE.CubeTexture();
    scenery.userData.applyDynamicReflectionEnvMap(probeTex);
    assert.equal(facadeMat.envMap, probeTex, 'La sonda de reflexión dinámica se aplica a los edificios');
    assert.equal((towerInst!.material as THREE.MeshPhysicalMaterial).envMap, probeTex, 'La sonda dinámica se aplica a las torres vidriadas');

    // Verificar sombras en puentes/viaductos
    let viaductShadowCasters = 0;
    viaducts.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.castShadow) viaductShadowCasters++;
    });
    assert.ok(viaductShadowCasters >= expectedStations.length * 5, 'Tableros, columnas y barandas de puentes proyectan sombras reales');

    scenery.userData.disposeTextureMaps?.();
    viaducts.userData.disposeTextures?.();
  } finally {
    cleanup();
  }
});

test('partículas ambientales otoñales (hojas secas y motas en haces solares) advectan y envuelven sin NaN ni fugas', () => {
  const pool = createAutumnLeafParticlePool(48, 2005);
  assert.equal(pool.length, 48);

  for (let step = 0; step < 40; step++) {
    stepAutumnLeafParticlePool(pool, 3.5, step * 8, step * 0.05, 0.05);
  }

  for (const leaf of pool) {
    assert.ok(Number.isFinite(leaf.x) && Number.isFinite(leaf.y) && Number.isFinite(leaf.z));
    assert.ok(leaf.y >= 0.04 && leaf.y <= 3.8, `Altura de hoja dentro de rango vial (${leaf.y})`);
    assert.ok(Math.abs(leaf.x - 3.5) <= 26.5, 'Las hojas se mantienen envueltas cerca de la calzada');
  }

  const controller = createAutumnAtmosphericParticles({ isMobilePerf: false });
  assert.equal(controller.group.children.length, 2, 'Incluye InstancedMesh de hojas secas + Points de motas solares');
  controller.update(0, 0, 40, [0.56, 0.518, -0.646], 'sunny', 2.5, 0.016);
  controller.dispose();
});

import fs from 'node:fs';
import path from 'node:path';
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
import { PRESIDENTIAL_LIMOUSINE_GLB_URL } from './corruptRivalVehicles3D';
import { evaluatePreRaceCinematicTimeline } from './wenoBankCampaign';
import { getWenoBankMissionForCircuit } from './wenoBankMissions';

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
    ellipse: () => {},
    roundRect: () => {},
    fillText: () => {},
    measureText: (t: string) => ({ width: t.length * 10 }),
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
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

test('NFSMW (2005) modernizado: Amanecer dorado y Soleado otoñal con sol lateral izquierdo del piloto', () => {
  const dawn = getHyperrealAtmosphere('dawn');
  const dawnPreset = NFSMW_PRESET_BY_WEATHER.dawn;

  // Amanecer: Sol HDR en ángulo bajo cálido sin contraluz oscuro sobre los autos
  assert.ok(dawn.sunIntensity > 3.0, `Sol HDR en Amanecer debe superar 3.0 (actual=${dawn.sunIntensity})`);
  assert.ok(dawn.sunDir[1] > 0.5 && dawn.sunDir[1] < 0.56, `Elevación solar de amanecer dorado (actual=${dawn.sunDir[1]})`);
  assert.ok(dawn.sunDir[2] < -0.5, `Dirección solar posterior preservada en Amanecer (actual=${dawn.sunDir[2]})`);
  assert.ok(dawn.fogDensity >= 0.0018, `Bruma cálida de amanecer activa (actual=${dawn.fogDensity})`);

  const dawnSunColor = new THREE.Color(dawn.sunLightHex);
  const dawnHorizonColor = new THREE.Color(dawn.horizonHex);
  assert.ok(dawnSunColor.r > dawnSunColor.g && dawnSunColor.g > dawnSunColor.b, 'Luz solar de Amanecer debe tener tinte dorado/ámbar');
  assert.ok(dawnHorizonColor.r > dawnHorizonColor.g && dawnHorizonColor.g > dawnHorizonColor.b, 'Horizonte de Amanecer debe tener bruma cálida');
  assert.ok(dawnPreset.desaturation >= 0.15 && dawnPreset.desaturation <= 0.32);
  assert.ok(dawnPreset.bloomStrength >= 0.5);
  assert.ok(dawnPreset.lensFlareIntensity >= 0.8);

  // Soleado NFSMW otoñal: sol lateral fuerte al costado izquierdo del piloto (+X) proyectando sombras dinámicas
  const sunny = getHyperrealAtmosphere('sunny');
  const sunnyPreset = NFSMW_PRESET_BY_WEATHER.sunny;
  assert.ok(sunny.sunDir[0] > 0.62, `Sol en Soleado debe ubicarse al costado izquierdo del piloto (+X > 0.62, actual=${sunny.sunDir[0]})`);
  assert.ok(sunny.sunDir[1] > 0.5, `Elevación solar diurna válida (> 0.5, actual=${sunny.sunDir[1]})`);
  assert.ok(sunny.sunDir[2] < -0.5, `Dirección solar posterior preservada en Soleado (actual=${sunny.sunDir[2]})`);
  assert.ok(sunny.sunIntensity >= 3.5);
  const sunnyHorizon = new THREE.Color(sunny.horizonHex);
  assert.ok(sunnyHorizon.r > sunnyHorizon.g && sunnyHorizon.g > sunnyHorizon.b, 'Horizonte Soleado conserva calidez otoñal NFSMW');
  assert.ok(sunnyPreset.warmTintStrength >= 0.30 && sunnyPreset.warmTintStrength < dawnPreset.warmTintStrength);
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

test('enhanceAsphaltMaterialWithPuddles inyecta remiendos viales paraguayos, charcos y faros blancos puros', () => {
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

  assert.ok(mockShader.fragmentShader.includes('nfsmwEvaluateAsphaltPatches'), 'Inyecta remiendos de bacheo paraguayo en espacio mundial');
  assert.ok(mockShader.fragmentShader.includes('nfsmwEvaluateWetness'), 'Inyecta máscara espacial de humedad y charcos');
  assert.ok(mockShader.fragmentShader.includes('vec3(1.24, 1.26, 1.30)'), 'Cono de faros delanteros proyecta luz blanca pura sobre el asfalto');
  assert.ok(mockShader.fragmentShader.includes('puddleNormal'), 'Aplana normales con micro-ondas sobre charcos');
  handle.setPuddleState(0.88, 12.5);
  assert.equal((mockShader.uniforms.uPuddleAmount as { value: number }).value, 0.88);
  assert.equal((mockShader.uniforms.uWetTime as { value: number }).value, 12.5);
});

test('geometría del mapa intacta con edificios de vidrio reflectivo NFSMW y sombras proyectadas', () => {
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

    // 2. Verificar edificios corporativos de vidrio reflectivo en primera fila
    const glassBuildings = scenery.children.filter((c) =>
      c.name.startsWith('edificio_vidrio_reflectivo_nfsmw_'),
    );
    assert.ok(glassBuildings.length >= 2, `Deben existir edificios corporativos de vidrio reflectivo en primera fila (encontrados=${glassBuildings.length})`);

    // 3. Verificar sombras proyectadas en tiempo real en edificios, torres, árboles y puentes
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

    // Verificar que los edificios de vidrio reflectivo en primera fila también reciben envMap
    let glassMeshesWithEnv = 0;
    for (const gb of glassBuildings) {
      gb.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh && (mesh.material as THREE.MeshPhysicalMaterial)?.envMap === probeTex) {
          glassMeshesWithEnv++;
        }
      });
    }
    assert.ok(glassMeshesWithEnv >= 2, 'Los muros cortina de vidrio en primera fila enlazan la sonda de reflexión solar');

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

test('limusina presidencial 3D (.glb) válida y coreografía de largada en 4 actos con llegada trasera', () => {
  const glbDiskPath = path.join(process.cwd(), 'public', PRESIDENTIAL_LIMOUSINE_GLB_URL.replace(/^\//, ''));
  assert.ok(fs.existsSync(glbDiskPath), `Debe existir el archivo 3D real ${glbDiskPath}`);
  const buf = fs.readFileSync(glbDiskPath);
  assert.ok(buf.byteLength > 100_000, `Modelo GLB de limusina debe tener malla 3D detallada (${buf.byteLength} bytes)`);
  assert.equal(buf.readUInt32LE(0), 0x46546c67, 'Encabezado binario glTF 2.0 válido (magic 0x46546c67)');
  assert.equal(buf.readUInt32LE(4), 2, 'Versión glTF 2.0');
  const jsonLen = buf.readUInt32LE(12);
  const gltfJson = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as {
    nodes?: Array<{ name?: string }>;
  };
  const nodeNames = new Set((gltfJson.nodes ?? []).map((n) => n.name));
  for (const wheelName of ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR']) {
    assert.ok(nodeNames.has(wheelName), `GLB de limusina contiene rueda articulada ${wheelName}`);
  }

  // Verificar coreografía de dirección de arte:
  // Acto 1 (ciudad amplia) -> Acto 2 (bajada de grúa a Weno Bank) -> Acto 3 (limusina en movimiento) -> Acto 4 (vista desde atrás del jugador)
  const anchors = {
    startPose: { x: 0, z: 10, yaw: 0 },
    avenueAheadPose: { x: 0, z: 85, yaw: 0 },
    wenoBankPose: { x: 18, z: 1120, yaw: 0 },
    circuitName: 'Av. Aviadores del Chaco',
    mission: getWenoBankMissionForCircuit('aviadores'),
  };

  const shot1 = evaluatePreRaceCinematicTimeline(0.3, anchors);
  assert.equal(shot1.shotNumber, 1);
  assert.ok(shot1.camera.y > 25, 'Acto 1 inicia en plano amplio elevado de la ciudad');

  const shot2Start = evaluatePreRaceCinematicTimeline(1.65, anchors);
  const shot2End = evaluatePreRaceCinematicTimeline(3.45, anchors);
  assert.equal(shot2Start.shotNumber, 2);
  assert.ok(shot2Start.camera.y > shot2End.camera.y + 10, 'Acto 2 ejecuta bajada de grúa hacia la sede de Weno Bank');

  const shot3Start = evaluatePreRaceCinematicTimeline(3.55, anchors);
  const shot3End = evaluatePreRaceCinematicTimeline(4.85, anchors);
  assert.equal(shot3Start.shotNumber, 3);
  assert.ok(shot3Start.rivalRoadPose && shot3End.rivalRoadPose, 'Acto 3 posiciona la limusina sobre la avenida');
  assert.ok(
    shot3End.rivalRoadPose!.z - shot3Start.rivalRoadPose!.z > 50,
    'Acto 3 muestra a la limusina desplazándose a velocidad hacia Weno Bank',
  );

  const shot4End = evaluatePreRaceCinematicTimeline(6.35, anchors);
  assert.equal(shot4End.shotNumber, 4);
  assert.ok(shot4End.camera.z < anchors.startPose.z - 5.5, 'Acto 4 termina detrás del vehículo del jugador (-Z)');
  assert.ok(Math.abs(shot4End.camera.x - anchors.startPose.x) < 1.2, 'Acto 4 queda alineado detrás del vehículo para empalmar con la cuenta regresiva trasera');
  assert.ok(shot4End.target.z > anchors.startPose.z + 6, 'Acto 4 apunta hacia el frente de la avenida vista desde atrás');
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

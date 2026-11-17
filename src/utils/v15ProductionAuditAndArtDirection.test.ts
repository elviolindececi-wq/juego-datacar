import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { getHyperrealAtmosphere } from './hyperrealEnvironment3D';
import { enhanceAsphaltMaterialWithPuddles } from './nfsmwRenderingPipeline';
import { createFaithfulVehicle3D } from './faithfulVehicleChassis3D';
import { PRESET_VEHICLES } from '../data/presetVehicles';
import {
  PRESIDENTIAL_LIMOUSINE_GLB_URL,
  createCorruptRivalVehicle3D,
} from './corruptRivalVehicles3D';
import { getWenoBankMissionForCircuit } from './wenoBankMissions';
import { evaluatePreRaceCinematicTimeline } from './wenoBankCampaign';

function installMinimalDocumentCanvasStub(): () => void {
  const g = globalThis as { document?: unknown };
  const prevDoc = g.document;
  if (!g.document) {
    const noop = () => {};
    const makeGrad = () => ({ addColorStop: noop });
    const ctxStub = {
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      globalAlpha: 1,
      fillRect: noop,
      clearRect: noop,
      strokeRect: noop,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      quadraticCurveTo: noop,
      bezierCurveTo: noop,
      arc: noop,
      ellipse: noop,
      fill: noop,
      stroke: noop,
      save: noop,
      restore: noop,
      translate: noop,
      rotate: noop,
      scale: noop,
      createLinearGradient: makeGrad,
      createRadialGradient: makeGrad,
      fillText: noop,
    };
    g.document = {
      createElement: () => ({
        width: 256,
        height: 256,
        getContext: () => ctxStub,
      }),
    };
  }
  return () => {
    if (prevDoc === undefined) {
      delete g.document;
    } else {
      g.document = prevDoc;
    }
  };
}

test('V15: clima Soleado posiciona el sol al costado izquierdo (+X) manteniendo elevación y luz trasera otoñal NFSMW', () => {
  const sunny = getHyperrealAtmosphere('sunny');
  const [sx, sy, sz] = sunny.sunDir;
  // En el eje del corredor (+Z hacia adelante), +X corresponde a la izquierda del piloto
  assert.ok(sx > 0.55, `Se esperaba sol lateral izquierdo (+X > 0.55), obtenido ${sx}`);
  assert.ok(sy > 0.5, `Se esperaba elevación diurna (> 0.5), obtenido ${sy}`);
  assert.ok(sz < -0.45, `Se esperaba componente trasera (-Z < -0.45) sin contraluz, obtenido ${sz}`);
});

test('V15: asfalto paraguayo remendado compila parches no repetitivos, preserva líneas pintadas y proyecta faros blancos', () => {
  const roadMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.84 });
  const cube = new THREE.CubeTexture();
  enhanceAsphaltMaterialWithPuddles(roadMat, cube);

  const shaderStub = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: 'void main() {\n#include <project_vertex>\n}',
    fragmentShader: [
      'void main() {',
      '#include <color_fragment>',
      '#include <roughnessmap_fragment>',
      '#include <metalnessmap_fragment>',
      '#include <normal_fragment_maps>',
      '#include <emissivemap_fragment>',
      '}',
    ].join('\n'),
  };

  roadMat.onBeforeCompile(
    shaderStub as unknown as THREE.WebGLProgramParametersWithUniforms,
    {} as THREE.WebGLRenderer,
  );

  assert.ok(
    shaderStub.fragmentShader.includes('nfsmwEvaluateAsphaltPatches'),
    'El shader de asfalto debe evaluar parches paraguayos en espacio de mundo',
  );
  assert.ok(
    shaderStub.fragmentShader.includes('nfsmwPaintLineKeep'),
    'Los parches deben preservar la señalización horizontal pintada',
  );
  assert.ok(
    shaderStub.fragmentShader.includes('vec3(1.24, 1.26, 1.30)'),
    'La proyección en calzada de los faros delanteros debe ser luz blanca fría/pura',
  );

  roadMat.dispose();
  cube.dispose();
});

test('V15: edificios corporativos de vidrio reflectivo otoñal NFSMW existen en el escenario urbano con sonda envMap', () => {
  const scenerySource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/utils/urbanTrackScenery.ts'),
    'utf8',
  );
  assert.ok(
    scenerySource.includes('edificio_vidrio_reflectivo_nfsmw_'),
    'urbanTrackScenery debe construir los edificios corporativos de vidrio reflectivo NFSMW',
  );
  assert.ok(
    scenerySource.includes('sunGlintCurtainMat'),
    'Los edificios de vidrio deben incorporar cortina acristalada con reflejo solar lateral dorado',
  );
});

test('V15: faros delanteros blancos conmutables (setHeadlightsLit) funcionan al igual que las luces traseras', () => {
  const cleanupDoc = installMinimalDocumentCanvasStub();
  try {
    const vehicle = PRESET_VEHICLES[0];
    const built = createFaithfulVehicle3D(vehicle, null);
    assert.equal(typeof built.setHeadlightsLit, 'function');

    built.setHeadlightsLit(false);
    let maxEmissiveChannelOff = 0;
    built.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive && mesh.position.z > built.spec.lengthM * 0.35) {
        maxEmissiveChannelOff = Math.max(maxEmissiveChannelOff, mat.emissive.r, mat.emissive.g, mat.emissive.b);
      }
    });

    built.setHeadlightsLit(true);
    let maxEmissiveChannelOn = 0;
    built.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive && mesh.position.z > built.spec.lengthM * 0.35) {
        maxEmissiveChannelOn = Math.max(maxEmissiveChannelOn, mat.emissive.r, mat.emissive.g, mat.emissive.b);
      }
    });

    assert.ok(maxEmissiveChannelOn > 3.5, `Los faros encendidos deben emitir luz blanca HDR (obtenido ${maxEmissiveChannelOn})`);
    assert.ok(maxEmissiveChannelOn > maxEmissiveChannelOff * 10, 'Encender faros delanteros multiplica la emisión blanca frontal');
    built.dispose();
  } finally {
    cleanupDoc();
  }
});

test('V15: archivo 3D real presidential-limousine.glb es un glTF 2.0 binario válido con carrocería stretch y 4 ruedas', () => {
  const glbDiskPath = path.resolve(process.cwd(), 'public', PRESIDENTIAL_LIMOUSINE_GLB_URL.replace(/^\//, ''));
  assert.equal(fs.existsSync(glbDiskPath), true, 'Debe existir public/models/presidential-limousine.glb');

  const buf = fs.readFileSync(glbDiskPath);
  assert.ok(buf.byteLength > 200_000, `El GLB debe tener geometría 3D detallada (>200 KB), actual: ${buf.byteLength}`);

  // Cabecera mágica glTF 2.0 ("glTF" = 0x46546C67, version = 2)
  assert.equal(buf.readUInt32LE(0), 0x46546c67);
  assert.equal(buf.readUInt32LE(4), 2);

  const jsonChunkLen = buf.readUInt32LE(12);
  const jsonChunkType = buf.readUInt32LE(16);
  assert.equal(jsonChunkType, 0x4e4f534a); // "JSON"
  const gltfJson = JSON.parse(buf.subarray(20, 20 + jsonChunkLen).toString('utf8')) as {
    nodes?: Array<{ name?: string }>;
    materials?: Array<{ name?: string }>;
  };

  const nodeNames = new Set((gltfJson.nodes ?? []).map((n) => n.name));
  for (const wheelName of ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR']) {
    assert.equal(nodeNames.has(wheelName), true, `Falta nodo articulado ${wheelName} en presidential-limousine.glb`);
  }
  const matNames = new Set((gltfJson.materials ?? []).map((m) => m.name));
  assert.equal(matNames.has('ExecutiveChrome'), true);
  assert.equal(matNames.has('WhiteLEDHeadlamp'), true);

  // En entorno Node sin window, el handle rival 3D opera de forma segura y limpia memoria
  const rival = createCorruptRivalVehicle3D('limo_blindada');
  rival.setRoadPreviewPose(3.5, 185, 0, 1.2);
  assert.equal(rival.group.visible, true);
  rival.clearRoadPreviewPose();
  rival.dispose();
});

test('V15: coreografía pre-carrera en 4 actos encuadra limusina en movimiento en Toma 3 y cierra detrás del piloto para la cuenta regresiva', () => {
  const mission = getWenoBankMissionForCircuit('mcal-lopez');
  const anchors = {
    startPose: { x: -3.6, y: 0, z: 12, yaw: 0 },
    avenueAheadPose: { x: 0, y: 0, z: 87, yaw: 0 },
    wenoBankPose: { x: 24, y: 0, z: 1188, yaw: 0 },
    sampleRoadPose: (distM: number, latM: number) => ({
      x: latM,
      y: 0,
      z: 12 + distM,
      yaw: 0,
    }),
    circuitName: 'Av. Mariscal López',
    mission,
  };

  const s1 = evaluatePreRaceCinematicTimeline(0.2, anchors);
  const s2 = evaluatePreRaceCinematicTimeline(2.3, anchors);
  const s3 = evaluatePreRaceCinematicTimeline(4.1, anchors);
  const s4End = evaluatePreRaceCinematicTimeline(6.4, anchors);

  assert.equal(s1.shotId, 'intro_shot_1');
  assert.ok(s1.camera.y > 28, 'Toma 1 debe abrir con plano amplio aéreo de la ciudad');

  assert.equal(s2.shotId, 'intro_shot_2');
  assert.ok(s2.camera.z > 1100, 'Toma 2 debe descender sobre el edificio Weno Bank en la meta');

  assert.equal(s3.shotId, 'intro_shot_3');
  assert.ok(s3.rivalRoadPose !== null, 'Toma 3 debe posicionar la limusina adelantada en movimiento');
  // La cámara Russian-arm viaja delante (+Z > rival.z) y a la izquierda (+X > rival.x) mirando hacia el centro-derecha
  assert.ok(s3.camera.z > s3.rivalRoadPose!.z + 6.5);
  assert.ok(s3.camera.x > s3.rivalRoadPose!.x + 3.0);

  assert.equal(s4End.shotId, 'intro_shot_4');
  assert.equal(s4End.finished, true);
  // Al terminar Toma 4 para arrancar el 3, 2, 1, la cámara queda DETRÁS del auto del piloto (z < startPose.z) mirando hacia adelante (+Z)
  assert.ok(s4End.camera.z < anchors.startPose.z - 5.5, 'La cuenta regresiva debe verse desde atrás del vehículo del piloto');
  assert.ok(s4End.target.z > anchors.startPose.z + 6.0);
});

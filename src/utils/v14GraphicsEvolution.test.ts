import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  GRAPHICS_QUALITY_OPTIONS,
  GRAPHICS_QUALITY_STORAGE_KEY,
  createAutoQualityScalerState,
  getAssetCompressionReadiness,
  getStoredGraphicsQualityPreset,
  resolveGraphicsSettings,
  setStoredGraphicsQualityPreset,
  stepAutoQualityScaler,
  subscribeGraphicsQualityPreset,
} from './graphicsQualityProfile';
import {
  classifyVehicleMaterialRole,
  createCalibratedVehicle3DInstance,
  getVehicle3DConfig,
} from './vehicle3DModelLoader';
import {
  NFSMW_PRESET_BY_WEATHER,
  enhanceAsphaltMaterialWithPuddles,
} from './nfsmwRenderingPipeline';
import { WEATHER_OPTIONS } from './weatherDynamics';
import { createWenoBankBuilding3D } from './wenoBankBuilding3D';
import {
  createSpeedAndTireEffectsController,
  createSpeedStreakPool,
  createTirePlumePool,
  stepSpeedStreakPool,
  stepTirePlumePool,
} from './speedAndTireEffects3D';

function installWindowStorageStub(): () => void {
  const prevWindow = (globalThis as { window?: unknown }).window;
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  };
  return () => {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  };
}

test('graphicsQualityProfile expone 4 perfiles, persiste en localStorage y resuelve presupuestos GPU seguros', () => {
  const cleanup = installWindowStorageStub();
  try {
    assert.deepEqual(
      GRAPHICS_QUALITY_OPTIONS.map((o) => o.id),
      ['auto', 'performance', 'balanced', 'quality'],
    );
    assert.equal(getStoredGraphicsQualityPreset(), 'auto');

    const observed: string[] = [];
    const unsubscribe = subscribeGraphicsQualityPreset((next) => observed.push(next));

    setStoredGraphicsQualityPreset('quality');
    assert.equal(getStoredGraphicsQualityPreset(), 'quality');
    assert.equal(
      (globalThis as { window: { localStorage: Storage } }).window.localStorage.getItem(GRAPHICS_QUALITY_STORAGE_KEY),
      'quality',
    );
    assert.deepEqual(observed, ['quality']);

    // Valor inválido vuelve seguro a 'auto'
    setStoredGraphicsQualityPreset('ultra-fake' as unknown as 'auto');
    assert.equal(getStoredGraphicsQualityPreset(), 'auto');
    unsubscribe();

    const perfDesktop = resolveGraphicsSettings({
      preset: 'performance',
      isMobilePerf: false,
      isSoftwareGl: false,
      devicePixelRatio: 2,
    });
    assert.equal(perfDesktop.shadowsEnabled, false);
    assert.equal(perfDesktop.postProcessingMode, 'off');
    assert.equal(perfDesktop.reflectionProbeMode, 'off');
    assert.equal(perfDesktop.speedEffectsEnabled, false);
    assert.ok(perfDesktop.maxDpr <= 1.15);

    const balancedDesktop = resolveGraphicsSettings({
      preset: 'balanced',
      isMobilePerf: false,
      isSoftwareGl: false,
      devicePixelRatio: 2,
    });
    assert.equal(balancedDesktop.shadowsEnabled, true);
    assert.equal(balancedDesktop.shadowMapSize, 1024);
    assert.equal(balancedDesktop.postProcessingMode, 'full_bloom');
    assert.equal(balancedDesktop.reflectionProbeMode, 'low');

    const qualityDesktop = resolveGraphicsSettings({
      preset: 'quality',
      isMobilePerf: false,
      isSoftwareGl: false,
      devicePixelRatio: 2,
    });
    assert.equal(qualityDesktop.shadowsEnabled, true);
    assert.equal(qualityDesktop.shadowMapSize, 2048);
    assert.equal(qualityDesktop.reflectionProbeMode, 'high');
    assert.equal(qualityDesktop.maxAnisotropy, 16);
    assert.ok(qualityDesktop.lodDistanceScale > 1.2);

    const swGl = resolveGraphicsSettings({
      preset: 'auto',
      isMobilePerf: false,
      isSoftwareGl: true,
      devicePixelRatio: 2,
    });
    assert.equal(swGl.resolvedTier, 'performance');
    assert.equal(swGl.maxDpr, 1);
    assert.equal(swGl.maxAnisotropy, 1);
  } finally {
    cleanup();
  }
});

test('autoQualityScaler escala con histéresis estricta sin oscilación y reporta preparación Draco/KTX2', () => {
  const scaler = createAutoQualityScalerState('quality', 0);

  // 1 muestra lenta dentro de cooldown o racha < 2 NO debe bajar todavía
  const s1 = stepAutoQualityScaler(scaler, { fps: 28, avgFrameTimeMs: 35, nowMs: 5000 });
  assert.equal(s1.changed, false);
  assert.equal(s1.tier, 'quality');

  // 2a muestra lenta consecutiva baja a balanced
  const s2 = stepAutoQualityScaler(scaler, { fps: 29, avgFrameTimeMs: 34, nowMs: 5500 });
  assert.equal(s2.changed, true);
  assert.equal(s2.direction, 'downgrade');
  assert.equal(s2.tier, 'balanced');

  // Aunque tenga >= 58 FPS enseguida, no sube antes de los 10s de cooldown post-downgrade
  for (let i = 0; i < 6; i++) {
    const waitStep = stepAutoQualityScaler(scaler, {
      fps: 60,
      avgFrameTimeMs: 14,
      nowMs: 7000 + i * 500,
    });
    assert.equal(waitStep.changed, false);
    assert.equal(waitStep.tier, 'balanced');
  }

  // Pasados > 10s desde el downgrade y acumuladas 5 muestras rápidas -> sube de nuevo a quality
  let upgraded = false;
  for (let i = 0; i < 5; i++) {
    const upStep = stepAutoQualityScaler(scaler, {
      fps: 60,
      avgFrameTimeMs: 14,
      nowMs: 16500 + i * 400,
    });
    if (upStep.changed) {
      upgraded = true;
      assert.equal(upStep.direction, 'upgrade');
      assert.equal(upStep.tier, 'quality');
    }
  }
  assert.equal(upgraded, true);

  const readinessDefault = getAssetCompressionReadiness(false);
  assert.equal(readinessDefault.dracoActive, true);
  assert.equal(readinessDefault.dracoDecoderPath, '/draco/gltf/');
  assert.equal(readinessDefault.ktx2Ready, false);

  const readinessKtx = getAssetCompressionReadiness(true);
  assert.equal(readinessKtx.ktx2Ready, true);
  assert.equal(readinessKtx.ktx2TranscoderPath, '/basis/');
});

test('vehicle3DModelLoader clasifica materiales multipieza con clearcoat PBR sin romper mallas horneadas', () => {
  assert.equal(
    classifyVehicleMaterialRole('BodyShell_01', 'CarPaint_Red', { hasBakedTextureMap: false }),
    'lacquer_paint',
  );
  assert.equal(
    classifyVehicleMaterialRole('Windshield_Front', 'TintedGlass', { hasBakedTextureMap: false }),
    'glass',
  );
  assert.equal(
    classifyVehicleMaterialRole('Wheel_FL_Tire', 'Rubber_Black', { hasBakedTextureMap: false }),
    'tire',
  );
  assert.equal(
    classifyVehicleMaterialRole('Wheel_FL_Rim', 'Alloy_Silver', { hasBakedTextureMap: false }),
    'rim_alloy',
  );
  assert.equal(
    classifyVehicleMaterialRole('Grille_Front', 'Chrome_Trim', { hasBakedTextureMap: false }),
    'chrome_trim',
  );
  assert.equal(
    classifyVehicleMaterialRole('Headlight_L', 'DRL_LED', { hasBakedTextureMap: false }),
    'headlight',
  );
  assert.equal(
    classifyVehicleMaterialRole('Taillight_R', 'Brake_Red', { hasBakedTextureMap: false }),
    'taillight',
  );
  assert.equal(
    classifyVehicleMaterialRole('Car_Unified', 'BakedMaterial', { hasBakedTextureMap: true }),
    'baked_unified',
  );

  // Construir un GLB simulado con carrocería pintada + vidrio + neumático + llanta
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const root = new THREE.Group();
  const bodyMesh = new THREE.Mesh(
    boxGeo,
    new THREE.MeshStandardMaterial({ name: 'CarPaint', color: '#cc1818', roughness: 0.4, metalness: 0.3 }),
  );
  bodyMesh.name = 'BodyShell';
  const glassMesh = new THREE.Mesh(
    boxGeo,
    new THREE.MeshStandardMaterial({ name: 'WindowGlass', color: '#99bbdd', transparent: true, opacity: 0.5 }),
  );
  glassMesh.name = 'Windshield';
  const tireMesh = new THREE.Mesh(
    boxGeo,
    new THREE.MeshStandardMaterial({ name: 'RubberTire', color: '#222222', roughness: 0.4 }),
  );
  tireMesh.name = 'Tire_RL';
  const rimMesh = new THREE.Mesh(
    boxGeo,
    new THREE.MeshStandardMaterial({ name: 'AlloyRim', color: '#cccccc', metalness: 0.5, roughness: 0.5 }),
  );
  rimMesh.name = 'Rim_RL';
  root.add(bodyMesh, glassMesh, tireMesh, rimMesh);

  const cfg = getVehicle3DConfig('nissan-kicks-2027')!;
  const envTex = new THREE.CubeTexture();
  const instance = createCalibratedVehicle3DInstance(cfg, { scene: root } as unknown as GLTF, envTex, {
    maxAnisotropy: 8,
  });

  let foundBody: THREE.MeshPhysicalMaterial | null = null;
  let foundGlass: THREE.MeshPhysicalMaterial | null = null;
  let foundTire: THREE.MeshStandardMaterial | null = null;
  let foundRim: THREE.MeshPhysicalMaterial | null = null;

  instance.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const m = obj as THREE.Mesh;
    if (m.name === 'BodyShell') foundBody = m.material as THREE.MeshPhysicalMaterial;
    if (m.name === 'Windshield') foundGlass = m.material as THREE.MeshPhysicalMaterial;
    if (m.name === 'Tire_RL') foundTire = m.material as THREE.MeshStandardMaterial;
    if (m.name === 'Rim_RL') foundRim = m.material as THREE.MeshPhysicalMaterial;
  });

  assert.ok(foundBody && (foundBody as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial);
  assert.equal((foundBody as THREE.MeshPhysicalMaterial).clearcoat, 1.0);
  assert.equal((foundBody as THREE.MeshPhysicalMaterial).envMap, envTex);

  assert.ok(foundGlass && (foundGlass as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial);
  assert.equal((foundGlass as THREE.MeshPhysicalMaterial).clearcoat, 1.0);
  assert.ok((foundGlass as THREE.MeshPhysicalMaterial).envMapIntensity >= 1.2);

  assert.ok(foundTire);
  assert.ok((foundTire as THREE.MeshStandardMaterial).roughness >= 0.86);
  assert.ok((foundTire as THREE.MeshStandardMaterial).metalness <= 0.05);

  assert.ok(foundRim && (foundRim as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial);
  assert.ok((foundRim as THREE.MeshPhysicalMaterial).metalness >= 0.88);

  instance.userData.disposeMaterials?.();
  boxGeo.dispose();
  envTex.dispose();
});

test('asfalto separa cabalmente pista seca (0 charcos en soleado/amanecer/nublado) de lluvia y tormenta', () => {
  assert.ok(WEATHER_OPTIONS.some(o => o.id === 'dawn' && o.label === 'Amanecer'));
  assert.ok(WEATHER_OPTIONS.some(o => o.id === 'sunny' && o.label === 'Soleado'));
  assert.equal(NFSMW_PRESET_BY_WEATHER.sunny.puddleAmount, 0);
  assert.equal(NFSMW_PRESET_BY_WEATHER.dawn.puddleAmount, 0);
  assert.equal(NFSMW_PRESET_BY_WEATHER.cloudy.puddleAmount, 0);
  assert.ok(NFSMW_PRESET_BY_WEATHER.rain.puddleAmount >= 0.75);
  assert.ok(NFSMW_PRESET_BY_WEATHER.storm.puddleAmount >= 0.9);
  assert.equal(NFSMW_PRESET_BY_WEATHER.flood.puddleAmount, 1.0);

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
  roadMat.onBeforeCompile(shaderStub as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);

  assert.ok(shaderStub.fragmentShader.includes('if (amount <= 0.02)'), 'Asfalto seco evita charcos por completo');
  assert.ok(shaderStub.fragmentShader.includes('nfsmwWheelTrack'), 'Asfalto seco incluye desgaste sutil de rodadura');
  roadMat.dispose();
  cube.dispose();
});

test('WenoBankBuilding3D enlaza sonda envMap dinámica y respeta escalado adaptativo de distancia LOD', () => {
  const cubeA = new THREE.CubeTexture();
  const cubeB = new THREE.CubeTexture();
  const weno = createWenoBankBuilding3D({
    initialWeather: 'sunny',
    envMap: cubeA,
    lodDistanceScale: 0.72,
  });

  const glass = weno.group.getObjectByName('weno_bank_curved_glass_facade') as THREE.Mesh;
  assert.ok(glass);
  assert.equal((glass.material as THREE.MeshPhysicalMaterial).envMap, cubeA);

  // En distancia intermedia (120m): con lodDistanceScale = 0.72, lod0Max desktop es 145 * 0.72 = 104.4 -> pasa a lod1
  const tierPerf = weno.updateLod(new THREE.Vector3(0, 2, 120));
  assert.equal(tierPerf, 'lod1');

  // Al subir lodDistanceScale a 1.3 (lod0Max = 188.5), el mismo punto 120m vuelve a lod0
  weno.setLodDistanceScale(1.3);
  weno.setEnvMap(cubeB);
  const tierQuality = weno.updateLod(new THREE.Vector3(0, 2, 120));
  assert.equal(tierQuality, 'lod0');
  assert.equal((glass.material as THREE.MeshPhysicalMaterial).envMap, cubeB);

  weno.dispose();
  assert.equal(weno.getDiagnostics().disposed, true);
  cubeA.dispose();
  cubeB.dispose();
});

test('speedAndTireEffects3D mantiene estelas periféricas >= 105 km/h y genera humo o spray 0-GC', () => {
  const streaks = createSpeedStreakPool(24);
  assert.equal(streaks.length, 24);
  for (const s of streaks) {
    assert.ok(Math.abs(s.radialX) >= 2.9, 'Las estelas no tapan el centro del campo visual');
  }
  stepSpeedStreakPool(streaks, 36, 0.016);
  for (const s of streaks) {
    assert.ok(Number.isFinite(s.zOffset) && s.zOffset >= -5 && s.zOffset <= 23);
  }

  const plumes = createTirePlumePool(16);
  let cursor = 0;
  // En seco con deslizamiento -> isWetSpray = false
  cursor = stepTirePlumePool({
    pool: plumes,
    cursor,
    rearLeftX: -0.8,
    rearLeftZ: -1.4,
    rearRightX: 0.8,
    rearRightZ: -1.4,
    carSpeedMps: 22,
    slipIntensity01: 0.65,
    wetRoad: false,
    dt: 0.016,
    spawnBudget: 2,
  });
  const dryActive = plumes.filter((p) => p.active);
  assert.ok(dryActive.length > 0);
  assert.equal(dryActive.every((p) => p.isWetSpray === false), true);

  // En lluvia rápida -> isWetSpray = true
  cursor = stepTirePlumePool({
    pool: plumes,
    cursor,
    rearLeftX: -0.8,
    rearLeftZ: -1.4,
    rearRightX: 0.8,
    rearRightZ: -1.4,
    carSpeedMps: 25,
    slipIntensity01: 0.1,
    wetRoad: true,
    dt: 0.016,
    spawnBudget: 2,
  });
  assert.ok(plumes.some((p) => p.active && p.isWetSpray === true));

  const controller = createSpeedAndTireEffectsController();
  const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.2, 500);
  cam.position.set(0, 2, -6);
  cam.lookAt(0, 1, 10);
  cam.updateMatrixWorld();

  // Por debajo de 105 km/h (20 m/s = 72 km/h): estelas ocultas
  controller.update({
    carX: 0,
    carY: 0,
    carZ: 0,
    carYaw: 0,
    carSpeedMps: 20,
    slipIntensity01: 0,
    isBrakingHard: false,
    weatherMode: 'sunny',
    camera: cam,
    enabled: true,
    particleDensity: 1,
    dt: 0.016,
  });
  const lineMesh = controller.group.getObjectByName('v14_peripheral_speed_streaks') as THREE.LineSegments;
  assert.equal(lineMesh.visible, false);

  // Por encima de 105 km/h (38 m/s = 136.8 km/h): estelas periféricas activas
  controller.update({
    carX: 0,
    carY: 0,
    carZ: 10,
    carYaw: 0,
    carSpeedMps: 38,
    slipIntensity01: 0.7,
    isBrakingHard: true,
    weatherMode: 'rain',
    camera: cam,
    enabled: true,
    particleDensity: 1,
    dt: 0.016,
  });
  assert.equal(lineMesh.visible, true);

  controller.dispose();
});

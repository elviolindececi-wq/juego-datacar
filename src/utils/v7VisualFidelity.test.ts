import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  DEALERSHIP_VEHICLES,
  OFFICIAL_VEHICLE_IMAGE_URLS,
  PRESET_VEHICLES,
} from '../data/presetVehicles';
import {
  createCalibratedVehicle3DInstance,
  getVehicle3DConfig,
} from './vehicle3DModelLoader';
import {
  createLightningStrikeState,
  generateForkedLightningSegments,
  stepLightningStrikeState,
} from './weatherVisuals3D';
import { soundEngine } from './soundEngine';

test('todos los vehículos oficiales apuntan a archivos .webp en inicio y vista arcade', () => {
  for (const [id, url] of Object.entries(OFFICIAL_VEHICLE_IMAGE_URLS)) {
    assert.ok(url.endsWith('.webp'), `Imagen oficial de ${id} debe terminar en .webp: ${url}`);
  }
  for (const v of PRESET_VEHICLES) {
    assert.ok(Boolean(v.imageUrl && v.imageUrl.endsWith('.webp')), `${v.id} debe cargar imagen .webp por defecto`);
  }
  const kicks = DEALERSHIP_VEHICLES.find((v) => v.id === 'nissan-kicks-2027');
  const tracker = DEALERSHIP_VEHICLES.find((v) => v.id === 'chevrolet-tracker-lite');
  assert.equal(kicks?.turntable360?.framesExtension, '.webp');
  assert.equal(tracker?.turntable360?.framesExtension, '.webp');
});

test('createCalibratedVehicle3DInstance preserva fielmente texturas PBR originales del GLB sin clearcoat blanco', () => {
  const geo = new THREE.BoxGeometry(1.8, 1.6, 4.3);
  const baseColorTex = new THREE.DataTexture(new Uint8Array([32, 36, 42, 255]), 1, 1);
  const mrTex = new THREE.DataTexture(new Uint8Array([0, 140, 200, 255]), 1, 1);
  const normalTex = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);

  const originalMat = new THREE.MeshStandardMaterial({
    name: 'BakedMaterial',
    color: new THREE.Color(0xd8dde6),
    map: baseColorTex,
    roughnessMap: mrTex,
    metalnessMap: mrTex,
    normalMap: normalTex,
    roughness: 1.0,
    metalness: 1.0,
  });

  const mesh = new THREE.Mesh(geo, originalMat);
  const scene = new THREE.Group();
  scene.add(mesh);

  const cfg = getVehicle3DConfig('chevrolet-tracker-lite')!;
  const mockGltf = { scene } as unknown as GLTF;
  const instance = createCalibratedVehicle3DInstance(cfg, mockGltf, null);

  let calibratedMat: THREE.MeshStandardMaterial | null = null;
  instance.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      calibratedMat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
    }
  });

  assert.ok(calibratedMat, 'Debe existir el material calibrado del GLB');
  const mat = calibratedMat as THREE.MeshStandardMaterial;
  // No debe ser reemplazado por MeshPhysicalMaterial con capa blanca espejo
  assert.equal((mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial ?? false, false);
  // Debe conservar intactos baseColor, roughnessMap, metalnessMap, normalMap y factores glTF 2.0
  assert.equal(mat.map, baseColorTex);
  assert.equal(mat.roughnessMap, mrTex);
  assert.equal(mat.metalnessMap, mrTex);
  assert.equal(mat.normalMap, normalTex);
  assert.equal(mat.metalness, 0.05);
  assert.equal(mat.roughness, 1.0);
  assert.equal(mat.color.getHex(), 0xd8dde6);
  assert.ok(mat.envMapIntensity <= 0.15, 'envMapIntensity bajo para no agrisar carrocerías negras bajo RoomEnvironment');

  instance.userData.disposeMaterials?.();
  geo.dispose();
  baseColorTex.dispose();
  mrTex.dispose();
  normalTex.dispose();
});

test('modo tormenta genera centellas 3D bifurcadas y relámpagos deterministas, y 0 en otros climas', () => {
  const st = createLightningStrikeState(7);

  // En climas no tormentosos nunca dispara centellas ni relámpagos
  for (const mode of ['sunny', 'cloudy', 'rain', 'flood'] as const) {
    const res = stepLightningStrikeState(st, mode, 2.5);
    assert.equal(res.flashIntensity, 0);
    assert.equal(res.boltOpacity, 0);
    assert.equal(res.triggeredStrike, null);
  }

  // En modo storm dispara la primera centella tras ~1.85 s
  let triggered = false;
  let peakFlash = 0;
  for (let i = 0; i < 60; i++) {
    const step = stepLightningStrikeState(st, 'storm', 0.05);
    if (step.triggeredStrike) {
      triggered = true;
      const bolt = generateForkedLightningSegments(
        step.triggeredStrike.boltSeed,
        step.triggeredStrike.offsetX,
        148,
        5,
        step.triggeredStrike.offsetZ,
      );
      assert.ok(bolt.corePositions.length >= 108, 'El canal principal de la centella tiene geometría 3D');
      assert.ok(bolt.branchPositions.length >= 72, 'Las ramificaciones secundarias tienen geometría 3D');
    }
    peakFlash = Math.max(peakFlash, step.flashIntensity);
  }

  assert.equal(triggered, true, 'Debe disparar centella y relámpago en modo tormenta');
  assert.ok(peakFlash > 0.7, `El destello del relámpago debe ser intenso (obtenido ${peakFlash})`);
});

test('soundEngine.playThunder y stopAll operan de forma segura sin persistir audio', () => {
  soundEngine.setWeather('storm');
  assert.doesNotThrow(() => {
    soundEngine.playThunder(0.85);
    soundEngine.stopAll(0.05);
  });
});

test('el sol ilumina desde atrás (-Z) y en altura en todos los climas para evitar autos en contraluz oscuro', async () => {
  const { getHyperrealAtmosphere } = await import('./hyperrealEnvironment3D');
  for (const mode of ['sunny', 'cloudy', 'rain', 'storm', 'flood'] as const) {
    const atm = getHyperrealAtmosphere(mode);
    assert.ok(
      atm.sunDir[2] < -0.5,
      `El sol en modo ${mode} debe provenir de atrás (sunDir.z < -0.5, actual=${atm.sunDir[2]})`,
    );
    assert.ok(
      atm.sunDir[1] > 0.5,
      `El sol en modo ${mode} debe tener buena elevación (sunDir.y > 0.5, actual=${atm.sunDir[1]})`,
    );
  }
});

test('experiencia mobile habilita touch-action:pan-y y evita recortar Iniciar Carrera, Circuitos y Comparador', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = process.cwd();
  const indexCss = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
  const arcadeCss = fs.readFileSync(path.join(root, 'src/styles/datacar-arcade.css'), 'utf8');
  const briefingTsx = fs.readFileSync(path.join(root, 'src/components/ArcadeBriefingAndResults.tsx'), 'utf8');
  const mobileTsx = fs.readFileSync(path.join(root, 'src/components/mobile/MobileGameExperience.tsx'), 'utf8');

  assert.ok(!indexCss.includes('.dc99-game { display:flex; flex-direction:column; position:fixed; inset:0; width:100vw; height:100vh; height:100dvh; z-index:1000; isolation:isolate; overflow:hidden; color:#f8fbff; background:radial-gradient(circle at 65% 50%, #14374a 0%,#091525 44%,#02050e 100%); font-family:var(--font-sans);touch-action:pan-x; }'), 'No debe bloquearse el scroll vertical con touch-action:pan-x en .dc99-game');
  assert.ok(indexCss.includes('touch-action:pan-y;'), 'El contenedor mobile .dc99-game debe habilitar touch-action:pan-y');
  assert.ok(arcadeCss.includes('.dc99-game main .dc-arcade-card'), 'Las tarjetas internas de briefing y resultados deben expandirse sin recortarse');
  assert.ok(!briefingTsx.includes('sticky bottom-0') && briefingTsx.includes('¡EMPEZAR CARRERA!'), 'El botón ¡EMPEZAR CARRERA! debe estar visible sin barras sticky que tapen las tarjetas');
  assert.ok(mobileTsx.includes('hidden sm:flex items-center justify-center pointer-events-none shrink-0'), 'El logo central del header no debe tapar el botón Volver en portrait estrecho');
  assert.ok(mobileTsx.includes('dc-mobile-track-card') && mobileTsx.includes('dc-mobile-compare-card'), 'Las tarjetas mobile de circuitos y comparador deben usar el layout responsivo sin aplastamiento');
});

test('perfil mobile 3D reserva GLB solo para el vehículo del jugador y usa modelos 3D livianos para rivales', async () => {
  const {
    resolveRace3DPerformanceProfile,
    shouldUseLightweightProceduralVehicle,
    filterVehiclesForRacePreload,
  } = await import('./mobilePerformanceProfile');

  const mobileProfile = resolveRace3DPerformanceProfile({
    isMobilePerf: true,
    isSoftwareGl: false,
    devicePixelRatio: 3,
    innerWidth: 800,
  });
  assert.equal(mobileProfile.antialias, false);
  assert.equal(mobileProfile.maxDpr, 1);
  assert.equal(mobileProfile.shadowsEnabled, false);
  assert.equal(mobileProfile.defaultRearviewMirror, false);
  assert.equal(mobileProfile.defaultSideMirrors, false);
  assert.equal(mobileProfile.gameplayCameraFar, 420);
  assert.equal(mobileProfile.skyDomeRadius, 360);

  const desktopProfile = resolveRace3DPerformanceProfile({
    isMobilePerf: false,
    isSoftwareGl: false,
    devicePixelRatio: 2,
    innerWidth: 1440,
  });
  assert.equal(desktopProfile.antialias, true);
  assert.equal(desktopProfile.maxDpr, 1.5);
  assert.equal(desktopProfile.shadowsEnabled, true);
  assert.equal(desktopProfile.defaultRearviewMirror, true);
  assert.equal(desktopProfile.defaultSideMirrors, true);

  // En mobile durante carrera: el auto elegido usa su GLB (false) y todos los rivales / pares online usan el 3D liviano (true)
  assert.equal(
    shouldUseLightweightProceduralVehicle({
      isMobilePerf: true,
      experience: 'race',
      vehicleId: 'nissan-kicks-2027',
      playerVehicleId: 'nissan-kicks-2027',
    }),
    false,
  );
  assert.equal(
    shouldUseLightweightProceduralVehicle({
      isMobilePerf: true,
      experience: 'race',
      vehicleId: 'chevrolet-tracker-lite',
      playerVehicleId: 'nissan-kicks-2027',
    }),
    true,
  );
  assert.equal(
    shouldUseLightweightProceduralVehicle({
      isMobilePerf: true,
      experience: 'race',
      vehicleId: 'nissan-kicks-2027',
      playerVehicleId: 'nissan-kicks-2027',
      isOnlinePeer: true,
    }),
    true,
  );
  // En desktop todos conservan su GLB
  assert.equal(
    shouldUseLightweightProceduralVehicle({
      isMobilePerf: false,
      experience: 'race',
      vehicleId: 'chevrolet-tracker-lite',
      playerVehicleId: 'nissan-kicks-2027',
    }),
    false,
  );

  const preloadedMobile = filterVehiclesForRacePreload(PRESET_VEHICLES.slice(0, 3), PRESET_VEHICLES[1].id, true);
  assert.equal(preloadedMobile.length, 1);
  assert.equal(preloadedMobile[0].id, PRESET_VEHICLES[1].id);
});

test('createVehicleEntity con preferProceduralModel instancia inmediatamente el modelo 3D liviano por defecto sin descargar GLB', async () => {
  const prevDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => null,
    }),
  };
  try {
    const { createVehicleEntity } = await import('./vehicle3DEntity');
    const tracker = DEALERSHIP_VEHICLES.find((v) => v.id === 'chevrolet-tracker-lite')!;
    let loadedSync = false;
    const entity = createVehicleEntity(
      tracker,
      1,
      3,
      () => {
        loadedSync = true;
      },
      undefined,
      null,
      undefined,
      { preferProceduralModel: true },
    );
    assert.equal(loadedSync, true, 'El modelo 3D liviano debe quedar montado síncronamente sin red');
    assert.equal(entity.usesProceduralModel, true, 'El rival debe marcar usesProceduralModel = true');
    entity.dispose();
  } finally {
    if (prevDocument === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = prevDocument;
    }
  }
});

test('Race3DPerspectiveView elimina backdrop-blur sobre WebGL y expone botón visible PONER CINTURÓN', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const raceSource = fs.readFileSync(path.join(process.cwd(), 'src/components/Race3DPerspectiveView.tsx'), 'utf8');

  assert.equal(
    raceSource.includes('backdrop-blur'),
    false,
    'No deben existir clases backdrop-blur sobre el canvas WebGL activo',
  );
  assert.ok(
    raceSource.includes('data-testid="seatbelt-button"') &&
      raceSource.includes('PONER CINTURÓN') &&
      raceSource.includes('✓ CINTURÓN PUESTO') &&
      raceSource.includes('onClick={buckleSeatbelt}'),
    'El botón de cinturón de seguridad debe estar visible y conectado a buckleSeatbelt',
  );
});

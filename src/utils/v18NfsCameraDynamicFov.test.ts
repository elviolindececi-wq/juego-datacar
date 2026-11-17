import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DYNAMIC_FOV_PROFILES,
  computeAdaptiveNfsCameraRig,
  computeDynamicChaseFov,
  computeNfsCameraPose,
  dampScalar,
  resolveVehicleDimensionsM,
} from './dynamicChaseCamera.ts';
import { PRESET_VEHICLES } from '../data/presetVehicles.ts';
import { NFSMW_PRESET_BY_WEATHER } from './nfsmwRenderingPipeline.ts';
import { getHyperrealAtmosphere } from './hyperrealEnvironment3D.ts';

test('V18 — FOV dinámico compartido: tabla exacta NFS (65°..74°) y Arcade (+7° máx a 180 km/h)', () => {
  // Perfil NFS: base 65°, ganancia máxima +9° a 180+ km/h
  assert.equal(DYNAMIC_FOV_PROFILES.nfs.baseFovDesktop, 65);
  assert.equal(DYNAMIC_FOV_PROFILES.nfs.maxGainDeg, 9);
  assert.equal(DYNAMIC_FOV_PROFILES.nfs.referenceSpeedKmh, 180);

  assert.equal(computeDynamicChaseFov({ mode: 'nfs', speedKmh: 0, compact: false }), 65);
  assert.equal(computeDynamicChaseFov({ mode: 'nfs', speedKmh: 50, compact: false }), 67.5);
  assert.equal(computeDynamicChaseFov({ mode: 'nfs', speedKmh: 100, compact: false }), 70);
  assert.equal(computeDynamicChaseFov({ mode: 'nfs', speedKmh: 150, compact: false }), 72.5);
  assert.equal(computeDynamicChaseFov({ mode: 'nfs', speedKmh: 180, compact: false }), 74);
  assert.equal(computeDynamicChaseFov({ mode: 'nfs', speedKmh: 240, compact: false }), 74);
  assert.equal(computeDynamicChaseFov({ mode: 'nfs', speedKmh: 0, compact: true }), 65);
  assert.equal(computeDynamicChaseFov({ mode: 'nfs', speedKmh: 180, compact: true }), 74);

  // Perfil Arcade: preserva FOV base original (61° desktop / 62° compact) + ganancia máxima +7°
  assert.equal(computeDynamicChaseFov({ mode: 'arcade', speedKmh: 0, compact: false }), 61);
  assert.equal(computeDynamicChaseFov({ mode: 'arcade', speedKmh: 180, compact: false }), 68);
  assert.equal(computeDynamicChaseFov({ mode: 'arcade', speedKmh: 0, compact: true }), 62);
  assert.equal(computeDynamicChaseFov({ mode: 'arcade', speedKmh: 180, compact: true }), 69);
});

test('V18 — La cámara NFS es más cercana y ligeramente más baja que Arcade en toda la flota oficial', () => {
  const arcadeDesktopDist = 6.0;
  const arcadeDesktopHeight = 2.0;
  const arcadeCompactDist = 5.5;
  const arcadeCompactHeight = 1.85;

  for (const vehicle of PRESET_VEHICLES) {
    const dims = resolveVehicleDimensionsM(vehicle.dimensions);
    const rigDesktop = computeAdaptiveNfsCameraRig(dims, false);
    const rigCompact = computeAdaptiveNfsCameraRig(dims, true);

    assert.ok(
      rigDesktop.chaseDistanceM < arcadeDesktopDist,
      `${vehicle.id} desktop chaseDistanceM (${rigDesktop.chaseDistanceM}) debe ser menor que Arcade (${arcadeDesktopDist})`,
    );
    assert.ok(
      rigDesktop.camHeightM < arcadeDesktopHeight,
      `${vehicle.id} desktop camHeightM (${rigDesktop.camHeightM}) debe ser ligeramente inferior a Arcade (${arcadeDesktopHeight})`,
    );
    assert.ok(
      rigDesktop.camHeightM > dims.heightM,
      `${vehicle.id} desktop camHeightM (${rigDesktop.camHeightM}) debe superar el techo (${dims.heightM})`,
    );
    assert.ok(
      rigDesktop.chaseDistanceM >= dims.lengthM * 0.5 + 2.2,
      `${vehicle.id} desktop debe mantener margen libre detrás del paragolpes`,
    );

    assert.ok(
      rigCompact.chaseDistanceM < arcadeCompactDist,
      `${vehicle.id} compact chaseDistanceM (${rigCompact.chaseDistanceM}) debe ser menor que Arcade (${arcadeCompactDist})`,
    );
    assert.ok(
      rigCompact.camHeightM < arcadeCompactHeight,
      `${vehicle.id} compact camHeightM (${rigCompact.camHeightM}) debe ser menor que Arcade (${arcadeCompactHeight})`,
    );
  }
});

test('V18 — Adaptación automática entre hatchback, sedán, SUV y camioneta sin atravesar geometría ni alejarse al acelerar', () => {
  const hatchback = resolveVehicleDimensionsM({ lengthMm: 3995, widthMm: 1765, heightMm: 1550 });
  const sedan = resolveVehicleDimensionsM({ lengthMm: 4600, widthMm: 1800, heightMm: 1440 });
  const suv = resolveVehicleDimensionsM({ lengthMm: 4460, widthMm: 1825, heightMm: 1620 });
  const pickup = resolveVehicleDimensionsM({ lengthMm: 5360, widthMm: 1900, heightMm: 1840 });

  const hatchRig = computeAdaptiveNfsCameraRig(hatchback, false);
  const sedanRig = computeAdaptiveNfsCameraRig(sedan, false);
  const suvRig = computeAdaptiveNfsCameraRig(suv, false);
  const pickupRig = computeAdaptiveNfsCameraRig(pickup, false);

  assert.ok(hatchRig.chaseDistanceM < suvRig.chaseDistanceM, 'Hatchback compacto encuadra más cerca que SUV mediano');
  assert.ok(suvRig.chaseDistanceM < pickupRig.chaseDistanceM, 'Camioneta grande toma más distancia que SUV');
  assert.ok(sedanRig.camHeightM < suvRig.camHeightM, 'Sedán bajo sitúa cámara más baja que SUV');
  assert.ok(pickupRig.camHeightM > pickup.heightM, 'Camioneta alta mantiene cámara por encima del techo');
  assert.ok(pickupRig.chaseDistanceM >= pickup.lengthM * 0.5 + 2.2, 'Camioneta nunca atraviesa el paragolpes');

  // Al acelerar en cámara NFS, la distancia trasera NO retrocede: el efecto de velocidad viene del FOV
  const pose0 = computeNfsCameraPose({
    selectedX: 2,
    selectedZ: 100,
    yawRad: 0,
    speedKmh: 0,
    compact: false,
    dimensionsM: suv,
  });
  const pose180 = computeNfsCameraPose({
    selectedX: 2,
    selectedZ: 100,
    yawRad: 0,
    speedKmh: 180,
    compact: false,
    dimensionsM: suv,
  });
  assert.equal(pose0.desiredCamZ, pose180.desiredCamZ, 'NFS no aleja la cámara hacia atrás al acelerar');
  assert.equal(pose0.wantedFov, 65);
  assert.equal(pose180.wantedFov, 74);
});

test('V18 — Amortiguación exponencial independiente de FPS (30 vs 60 vs 120 FPS convergen igual en 0.5s)', () => {
  const simulate = (fps: number, seconds: number) => {
    let value = 65;
    const steps = Math.round(fps * seconds);
    const dt = 1 / fps;
    for (let i = 0; i < steps; i++) {
      value = dampScalar(value, 74, DYNAMIC_FOV_PROFILES.nfs.dampLambda, dt);
    }
    return value;
  };

  const at30 = simulate(30, 0.5);
  const at60 = simulate(60, 0.5);
  const at120 = simulate(120, 0.5);

  assert.ok(Math.abs(at30 - at60) < 1e-6);
  assert.ok(Math.abs(at60 - at120) < 1e-6);
  assert.ok(at60 > 73.5 && at60 < 74);
});

test('V18 — Integración en UI, selector de cámaras, guard de curvas y estética climática moderada', () => {
  const root = process.cwd();
  const raceViewSrc = fs.readFileSync(path.join(root, 'src/components/Race3DPerspectiveView.tsx'), 'utf8');

  assert.ok(raceViewSrc.includes("'nfs'"), 'CameraViewMode debe incluir el modo adicional nfs');
  assert.ok(raceViewSrc.includes("case 'nfs':"), 'Debe existir case nfs dedicado en el loop 3D');
  assert.ok(raceViewSrc.includes("['arcade', 'nfs', 'trasera'"), 'El selector móvil/ciclo debe incluir nfs');
  assert.ok(raceViewSrc.includes('<span>NFS</span>'), 'El selector de escritorio debe incluir botón NFS');
  assert.ok(
    raceViewSrc.includes("!['arcade', 'nfs', 'trasera'"),
    'El guard de curvas en coordenadas mundiales debe incluir nfs',
  );

  // Seco sigue seco (sin charcos en soleado) y tono/exposición moderados
  assert.equal(NFSMW_PRESET_BY_WEATHER.sunny.puddleAmount, 0);
  const sunnyAtm = getHyperrealAtmosphere('sunny');
  assert.ok(sunnyAtm.exposure >= 1.0 && sunnyAtm.exposure <= 1.15);
  assert.ok(sunnyAtm.sunIntensity > sunnyAtm.ambientIntensity * 10);
});

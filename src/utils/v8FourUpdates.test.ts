import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ASUNCION_CIRCUITS, toRaceTrack } from '../data/asuncionCircuits';
import { makeRoadPath } from './curvedRoadPath';
import {
  REALISTIC_TRAFFIC_SUV_PALETTE,
  createOncomingTrafficPool,
  stepOncomingTraffic,
  buildTrafficLights,
  buildSpeedLimitZones,
} from './urbanTrafficRules';
import { createFaithfulVehicle3D } from './faithfulVehicleChassis3D';
import { PRESET_VEHICLES } from '../data/presetVehicles';
import { enhanceAsphaltMaterialWithPuddles } from './nfsmwRenderingPipeline';

test('Task 2: all 6 Asunción circuits produce unique track IDs, indices (1..6), and distinct road splines', () => {
  assert.equal(ASUNCION_CIRCUITS.length, 6);
  const seenTrackIds = new Set<string>();
  const seenIndices = new Set<number>();
  const sampleSignatures = new Set<string>();

  ASUNCION_CIRCUITS.forEach((circuit, idx) => {
    const track = toRaceTrack(circuit, 2);
    assert.equal(track.id, `circuit-${circuit.id}`);
    assert.equal(track.cityCircuitId, circuit.id);
    assert.equal(track.trackIndex, idx + 1);
    seenTrackIds.add(track.id);
    seenIndices.add(track.trackIndex!);

    const path = makeRoadPath(track);
    assert.equal(path.isCurved, true);

    // Spawn origin must stay cleanly aligned at (0, 0) facing +Z (yaw 0)
    const origin = path.world(0, 0);
    assert.ok(Math.abs(origin.x) < 1e-6, `Expected origin.x ~ 0 for ${circuit.id}`);
    assert.ok(Math.abs(origin.z) < 1e-6, `Expected origin.z ~ 0 for ${circuit.id}`);
    assert.ok(Math.abs(origin.yaw) < 1e-6, `Expected origin.yaw ~ 0 for ${circuit.id}`);

    // Mid-track and 75% spline coordinates must differ across all 6 circuits
    const mid = path.world(track.distanceMeters * 0.45, 0);
    const late = path.world(track.distanceMeters * 0.78, 0);
    const sig = `${mid.x.toFixed(2)}:${mid.z.toFixed(2)}:${late.x.toFixed(2)}:${late.yaw.toFixed(3)}`;
    sampleSignatures.add(sig);
  });

  assert.equal(seenTrackIds.size, 6, 'Every circuit must have a distinct RaceTrackConfig.id');
  assert.equal(seenIndices.size, 6, 'Every circuit must have a unique trackIndex 1..6');
  assert.equal(sampleSignatures.size, 6, 'Every circuit must generate a distinct 3D road spline layout');
});

test('Task 3: oncoming AI traffic uses realistic modern SUV dimensions and realistic traffic colors', () => {
  const allowedColors = new Set<string>(REALISTIC_TRAFFIC_SUV_PALETTE as readonly string[]);
  assert.equal(allowedColors.size, 5);

  const track = toRaceTrack(ASUNCION_CIRCUITS[0], 2);
  const pool = createOncomingTrafficPool(track);
  assert.ok(pool.length >= 6);

  for (const car of pool) {
    assert.ok(
      allowedColors.has(car.color),
      `Traffic SUV color ${car.color} must belong to realistic traffic palette`,
    );
    assert.ok(car.lengthM >= 4.35, `Expected SUV length >= 4.35m, got ${car.lengthM}`);
    assert.ok(car.widthM >= 1.82, `Expected SUV width >= 1.82m, got ${car.widthM}`);
  }

  // Verify AI SUVs stopped or slowing for a red traffic light keep braking = true
  const lights = buildTrafficLights(track);
  const speedZones = buildSpeedLimitZones(track);
  assert.ok(lights.length > 0);
  const redNode = {
    ...lights[0],
    phaseOffsetSec: lights[0].greenSec + lights[0].yellowSec + 1.0, // squarely inside RED phase at t=0
  };
  pool[0].z = redNode.z + 5.8 + 1.2; // 1.2m before oncomingStopZ while light is RED
  pool[0].speedMps = 0;
  stepOncomingTraffic(pool, [redNode], speedZones, 0, 0.1, 0, track.distanceMeters);
  assert.equal(pool[0].braking, true, 'AI SUV stopped at red light must illuminate dual brake lights');
});

function installCanvasStubIfNeeded(): () => void {
  const prevDoc = (globalThis as { document?: unknown }).document;
  if (prevDoc) return () => {};
  const noopGrad = { addColorStop: () => {} };
  const noopCtx = new Proxy(
    {
      measureText: (t: string) => ({ width: t.length * 10 }),
      createLinearGradient: () => noopGrad,
      createRadialGradient: () => noopGrad,
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
    },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<PropertyKey, unknown>)[prop];
        return () => {};
      },
      set() {
        return true;
      },
    },
  );
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

test('Task 3 & 4: procedural SUV generator produces composite clearcoat SUV with symmetrical front & dual rear lamps', () => {
  const cleanup = installCanvasStubIfNeeded();
  try {
    const sampleVehicle = PRESET_VEHICLES[0];
    const built = createFaithfulVehicle3D(sampleVehicle, null, {
      trafficSuvMode: true,
      paintHexOverride: '#102648',
    });

    const a = built.lampAnchors;
    // Left/Right X symmetry & matching Y/Z alignment for front headlights
    assert.ok(Math.abs(a.frontLeft[0] + a.frontRight[0]) < 1e-6, 'Front headlights must be X-symmetrical');
    assert.ok(Math.abs(a.frontLeft[0] - a.frontRight[0]) >= 1.1, 'Front headlights must sit on wide left/right housings');
    assert.equal(a.frontLeft[1], a.frontRight[1], 'Front headlights must share exact SUV grille height');
    assert.equal(a.frontLeft[2], a.frontRight[2], 'Front headlights must share exact front Z plane');
    assert.ok(a.frontLeft[1] >= 0.72, `Front headlights should match elevated SUV front (${a.frontLeft[1]}m)`);

    // Left/Right X symmetry & matching Y/Z alignment for dual rear brake lights
    assert.ok(Math.abs(a.rearLeft[0] + a.rearRight[0]) < 1e-6, 'Rear brake lights must be X-symmetrical');
    assert.ok(Math.abs(a.rearLeft[0] - a.rearRight[0]) >= 1.1, 'Rear brake lights must be two distinct left/right units');
    assert.equal(a.rearLeft[1], a.rearRight[1], 'Rear brake lights must share exact SUV liftgate height');
    assert.equal(a.rearLeft[2], a.rearRight[2], 'Rear brake lights must share exact rear Z plane');
    assert.ok(a.rearLeft[1] >= 0.92, `Rear brake lights should match elevated SUV liftgate (${a.rearLeft[1]}m)`);

    // Inspect materials & meshes inside the composite SUV group
    let meshCount = 0;
    let foundClearcoatBody = false;
    let foundMatteCladding = false;
    const redBrakeMeshes: THREE.MeshStandardMaterial[] = [];

    built.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        meshCount++;
        const mat = obj.material;
        if (mat instanceof THREE.MeshPhysicalMaterial && mat.clearcoat >= 0.95) {
          foundClearcoatBody = true;
        }
        if (mat instanceof THREE.MeshStandardMaterial && mat.roughness >= 0.82 && mat.metalness <= 0.15) {
          foundMatteCladding = true;
        }
        if (
          mat instanceof THREE.MeshStandardMaterial &&
          mat.emissive.r > 0.45 &&
          mat.emissive.g < 0.25 &&
          obj.position.z < -1.0
        ) {
          redBrakeMeshes.push(mat);
        }
      }
    });

    assert.ok(meshCount >= 20, `Expected rich composite SUV (>20 parts), got ${meshCount}`);
    assert.equal(foundClearcoatBody, true, 'SUV body must use glossy automotive clearcoat PBR shader');
    assert.equal(foundMatteCladding, true, 'SUV must include matte black plastic trim/wheel-arch cladding');
    assert.ok(redBrakeMeshes.length >= 2, 'SUV must have at least two rear red brake light meshes');

    // Toggle brake lights ON and verify HDR emissive glow for bloom
    built.setBrakeLit(true);
    for (const mat of redBrakeMeshes) {
      assert.ok(mat.emissive.r >= 4.0, `Expected HDR brake emissive.r >= 4.0 when braking, got ${mat.emissive.r}`);
    }

    // Toggle brake lights OFF and verify tail-running intensity drops
    built.setBrakeLit(false);
    for (const mat of redBrakeMeshes) {
      assert.ok(mat.emissive.r < 1.0, `Expected tail-lamp idle emissive.r < 1.0, got ${mat.emissive.r}`);
    }

    built.dispose();
  } finally {
    cleanup();
  }
});

test('Task 1 & 4: close-up asphalt PBR shader compiles custom GLSL hooks for pebbles, tar cracks, and dual lamp reflections', () => {
  const roadMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.1 });
  const dummyEnv = new THREE.Texture();
  const dummyDetailNormal = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);

  const handle = enhanceAsphaltMaterialWithPuddles(roadMat, dummyEnv, {
    detailNormalMap: dummyDetailNormal,
    trackSeed: 4,
  });

  assert.equal(typeof roadMat.onBeforeCompile, 'function');
  const mockShader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: 'void main() {\n#include <project_vertex>\n}',
    fragmentShader:
      'void main() {\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <emissivemap_fragment>\n}',
  };

  roadMat.onBeforeCompile(mockShader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);

  assert.ok(mockShader.fragmentShader.includes('nfsmwEvaluateTarCracks'), 'Must include tar-sealed crack shader');
  assert.ok(mockShader.fragmentShader.includes('nfsmwEvalHeadlightCone'), 'Must include dual headlight beam shader');
  assert.ok(mockShader.fragmentShader.includes('nfsmwEvalBrakePool'), 'Must include dual red brake reflection shader');
  assert.equal((mockShader.uniforms.uTrackSeed.value as number), 4);
  assert.equal((mockShader.uniforms.uHasDetailNormal.value as number), 1);

  handle.setSunDirection(-0.5, 0.3, 0.8);
  handle.setVehicleLightState({
    headLeft: new THREE.Vector3(-0.72, 0.84, 12.2),
    headRight: new THREE.Vector3(0.72, 0.84, 12.2),
    headDir: new THREE.Vector3(0, -0.08, 1),
    headIntensity: 1.15,
    brakeLeft: new THREE.Vector3(-0.70, 1.04, 7.8),
    brakeRight: new THREE.Vector3(0.70, 1.04, 7.8),
    brakeIntensity: 1.35,
  });

  assert.equal((mockShader.uniforms.uHeadIntensity.value as number), 1.15);
  assert.equal((mockShader.uniforms.uBrakeIntensity.value as number), 1.35);

  dummyDetailNormal.dispose();
  dummyEnv.dispose();
  roadMat.dispose();
});

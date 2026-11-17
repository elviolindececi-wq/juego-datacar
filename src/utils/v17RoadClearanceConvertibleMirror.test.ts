import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { ASUNCION_CIRCUITS, toRaceTrack } from '../data/asuncionCircuits';
import { makeRoadPath } from './curvedRoadPath';
import {
  auditSceneryRoadClearance,
  bendRoadsideGroup,
  resolveSafeRoadsideBuildingPose,
} from './curvedRoadVisuals3D';
import { createUrbanTrackScenery } from './urbanTrackScenery';
import { URBAN_ROAD_WIDTH } from './urbanTrafficRules';
import {
  CONVERTIBLE_1966_VILLAIN_GLB_URL,
  CONVERTIBLE_1966_VILLAIN_PUBLIC_PATH,
  PRESIDENTIAL_LIMOUSINE_GLB_URL,
  VILLAIN_GLB_CANDIDATE_URLS,
  createCorruptRivalVehicle3D,
  isBinaryGlbBuffer,
  normalizeAndRigVillainGlb,
} from './corruptRivalVehicles3D';

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
      font: '12px sans-serif',
      textAlign: 'center',
      textBaseline: 'middle',
      fillRect: noop,
      clearRect: noop,
      strokeRect: noop,
      roundRect: noop,
      beginPath: noop,
      closePath: noop,
      clip: noop,
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
      setLineDash: noop,
      createLinearGradient: makeGrad,
      createRadialGradient: makeGrad,
      fillText: noop,
      strokeText: noop,
      measureText: () => ({ width: 42 }),
      createImageData: (w: number, h: number) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(Math.max(4, w * h * 4)),
      }),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(Math.max(4, w * h * 4)),
      }),
      putImageData: noop,
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

test('V17: cero edificios, podios vidriados, complejos comerciales o carteles invaden la ruta en Calle José Félix López ni en ninguno de los 6 circuitos', () => {
  const cleanupDoc = installMinimalDocumentCanvasStub();
  try {
    assert.ok(ASUNCION_CIRCUITS.length >= 6, 'Deben existir los 6 circuitos de Asunción');

    for (const circuit of ASUNCION_CIRCUITS) {
      for (const laps of [1, 2]) {
        const track = toRaceTrack(circuit, laps);
        const totalDistanceMeters = track.distanceMeters;
        const roadPath = makeRoadPath(track);
        assert.equal(roadPath.isCurved, true, `El trazado ${circuit.id} debe ser curvo`);

        const scenery = createUrbanTrackScenery(
          URBAN_ROAD_WIDTH,
          totalDistanceMeters + 120,
          track.routeHazardProfile,
          true,
          circuit.id,
          1,
        );

        bendRoadsideGroup(scenery, roadPath, URBAN_ROAD_WIDTH);
        const clearance = auditSceneryRoadClearance(scenery, roadPath, URBAN_ROAD_WIDTH);

        assert.ok(
          clearance.checkedInstances > 20 && clearance.checkedGroups >= 2,
          `El circuito ${circuit.id} (${laps}v) debe auditar instancias (${clearance.checkedInstances}) y complejos de edificios (${clearance.checkedGroups})`,
        );
        assert.deepEqual(
          clearance.encroachingItems,
          [],
          `Edificio(s) sobre o demasiado cerca de la calzada en ${circuit.id} (${laps}v): ${JSON.stringify(clearance.encroachingItems.slice(0, 5))}`,
        );

        // También verificar que el edificio monumental Weno Bank quede fuera de todo tramo de la calzada
        const wenoPose = resolveSafeRoadsideBuildingPose(
          roadPath,
          URBAN_ROAD_WIDTH,
          totalDistanceMeters + 8,
          URBAN_ROAD_WIDTH / 2 + 27.5,
          18.5,
          4.0,
        );
        for (let s = -20; s <= totalDistanceMeters + 40; s += 4) {
          const center = roadPath.world(s, 0);
          const dist = Math.hypot(wenoPose.x - center.x, wenoPose.z - center.z);
          assert.ok(
            dist >= URBAN_ROAD_WIDTH * 0.5 + 18.5 + 3.5,
            `Weno Bank demasiado cerca de la ruta en ${circuit.id} (${laps}v) en s=${s}m: dist=${dist.toFixed(2)}m`,
          );
        }

        scenery.userData.dispose?.();
      }
    }
  } finally {
    cleanupDoc();
  }
});

test('V17: Meshy_AI_Convertible_1966_thun_1115235921_texture.glb está registrado como candidato primario y sus 4 ruedas giran aunque el GLB sea malla única', () => {
  assert.equal(
    CONVERTIBLE_1966_VILLAIN_PUBLIC_PATH,
    '/public/models/Meshy_AI_Convertible_1966_thun_1115235921_texture.glb',
  );
  assert.equal(
    CONVERTIBLE_1966_VILLAIN_GLB_URL,
    '/models/Meshy_AI_Convertible_1966_thun_1115235921_texture.glb',
  );
  assert.equal(VILLAIN_GLB_CANDIDATE_URLS[0], CONVERTIBLE_1966_VILLAIN_GLB_URL);
  assert.equal(VILLAIN_GLB_CANDIDATE_URLS[1], PRESIDENTIAL_LIMOUSINE_GLB_URL);

  // Verificar detector de cabecera binaria glTF ("glTF" = 0x46546C67) frente a HTML fallback SPA
  const htmlFallback = new TextEncoder().encode('<!doctype html><html><body>SPA</body></html>').buffer;
  assert.equal(isBinaryGlbBuffer(htmlFallback), false);
  const validHeader = new ArrayBuffer(28);
  new DataView(validHeader).setUint32(0, 0x46546c67, true);
  assert.equal(isBinaryGlbBuffer(validHeader), true);

  // Simular un .glb exportado por Meshy AI: malla única sin nodos Wheel_*, eje X más largo y textura PBR horneada
  const rawMeshyGroup = new THREE.Group();
  const bakedTex = new THREE.DataTexture(new Uint8Array([210, 45, 45, 255]), 1, 1);
  bakedTex.needsUpdate = true;
  const bakedMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    map: bakedTex,
    roughness: 0.5,
    metalness: 0.4,
  });
  // Caja desalineada (largo en X = 1.8, alto = 0.48, ancho en Z = 0.68) y descentrada en Y
  const singleBodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.48, 0.68), bakedMat);
  singleBodyMesh.position.set(0.35, -0.42, -0.18);
  rawMeshyGroup.add(singleBodyMesh);

  const trackedGeos: THREE.BufferGeometry[] = [];
  const streakMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  const rigged = normalizeAndRigVillainGlb(rawMeshyGroup, {
    isConvertible1966: true,
    targetLengthM: 5.22,
    wheelMaterials: {
      tireMat: new THREE.MeshStandardMaterial(),
      whitewallMat: new THREE.MeshStandardMaterial(),
      redlinePinMat: new THREE.MeshBasicMaterial(),
      chromeMat: new THREE.MeshStandardMaterial(),
      spinnerGoldMat: new THREE.MeshStandardMaterial(),
      streakMat,
    },
    trackGeo: (g) => {
      trackedGeos.push(g);
      return g;
    },
  });

  // 1. Orientación longitudinal corregida a ~5.22 m en Z y neumáticos apoyados en Y ≈ 0
  assert.ok(Math.abs(rigged.lengthM - 5.22) < 0.05, `Longitud esperada ~5.22m, actual=${rigged.lengthM}`);
  assert.equal(rigged.preservedTextureCount, 1, 'Debe preservar la textura horneada de Meshy AI');
  assert.equal(bakedTex.colorSpace, THREE.SRGBColorSpace, 'La textura Meshy AI debe quedar en SRGBColorSpace');
  assert.equal(bakedMat.color.getHex(), 0xffffff, 'El color base debe ser blanco neutro para no oscurecer la textura');

  rigged.root.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(rigged.root);
  assert.ok(Math.abs(finalBox.min.y) < 0.03, `El vehículo debe apoyar al ras del suelo (min.y=${finalBox.min.y})`);

  // 2. Aunque el .glb original tenía 0 nodos Wheel_*, el rig acopla las 4 ruedas clásicas 3D giratorias
  assert.equal(rigged.rollingWheels.length, 4, 'Debe acoplar 4 ruedas 3D giratorias al convertible de malla única');

  // 3. Verificar giro efectivo de las ruedas tanto en Toma 3 (setRoadPreviewPose) como en llegada a Weno Bank (updateSync)
  const rivalHandle = createCorruptRivalVehicle3D('camioneta_vip');
  rivalHandle.setRoadPreviewPose(3.5, 120, 0, 0.2);
  rivalHandle.setRoadPreviewPose(3.5, 132, 0, 0.7);

  let spinningWheelAngles: number[] = [];
  rivalHandle.group.traverse((obj) => {
    if (obj.name.startsWith('classic_1966_spinning_wheel_')) {
      spinningWheelAngles.push(obj.rotation.x);
    }
  });
  assert.equal(spinningWheelAngles.length, 4, 'Deben existir las 4 ruedas giratorias en el rival activo');
  const angleAfterShot3 = spinningWheelAngles[0];
  assert.ok(angleAfterShot3 > 10, `Las ruedas deben girar visiblemente al avanzar en ruta (rad=${angleAfterShot3})`);

  rivalHandle.clearRoadPreviewPose();
  rivalHandle.updateSync(0.35, 1.5);
  rivalHandle.updateSync(0.75, 2.5);

  spinningWheelAngles = [];
  rivalHandle.group.traverse((obj) => {
    if (obj.name.startsWith('classic_1966_spinning_wheel_')) {
      spinningWheelAngles.push(obj.rotation.x);
    }
  });
  assert.ok(
    spinningWheelAngles[0] > angleAfterShot3,
    `Las ruedas deben seguir girando al aproximarse a Weno Bank (${spinningWheelAngles[0]} > ${angleAfterShot3})`,
  );

  trackedGeos.forEach((g) => g.dispose());
  bakedTex.dispose();
  bakedMat.dispose();
  streakMat.dispose();
  rivalHandle.dispose();
});

test('V17: retrovisor estilo Need for Speed permanece oculto por defecto, se activa con botón ESPEJO o tecla M y se centra simétricamente al 50%', () => {
  const raceViewSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/Race3DPerspectiveView.tsx'),
    'utf8',
  );
  const indexCssSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

  assert.match(
    raceViewSrc,
    /const \[showRearviewMirror,\s*setShowRearviewMirror\]\s*=\s*useState\(false\)/,
    'El retrovisor central debe iniciar apagado por defecto (Need for Speed)',
  );
  assert.match(
    raceViewSrc,
    /const \[showSideMirrors,\s*setShowSideMirrors\]\s*=\s*useState\(false\)/,
    'Los espejos laterales deben iniciar apagados por defecto',
  );
  assert.match(
    raceViewSrc,
    /event\.code === 'KeyM'/,
    'Debe existir atajo de teclado KeyM para mostrar/ocultar el retrovisor bajo demanda',
  );

  // Verificar márgenes simétricos left === right en todas las reglas responsivas de .dc-v5-top-center
  assert.match(indexCssSrc, /left:\s*320px\s*!important;\s*\n\s*right:\s*320px\s*!important;/);
  assert.match(
    indexCssSrc,
    /left:\s*calc\(max\(8px,\s*env\(safe-area-inset-left\)\)\s*\+\s*184px\)\s*!important;\s*\n\s*right:\s*calc\(max\(8px,\s*env\(safe-area-inset-right\)\)\s*\+\s*184px\)\s*!important;/,
  );
  assert.match(
    indexCssSrc,
    /left:\s*calc\(max\(8px,\s*env\(safe-area-inset-left\)\)\s*\+\s*138px\)\s*!important;\s*\n\s*right:\s*calc\(max\(8px,\s*env\(safe-area-inset-right\)\)\s*\+\s*138px\)\s*!important;/,
  );
  assert.match(
    indexCssSrc,
    /left:\s*calc\(max\(6px,\s*env\(safe-area-inset-left\)\)\s*\+\s*86px\)\s*!important;\s*\n\s*right:\s*calc\(max\(6px,\s*env\(safe-area-inset-right\)\)\s*\+\s*86px\)\s*!important;/,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ASUNCION_PURSUIT_LORE_TEXT,
  shouldShowAsuncionPursuitBriefing,
  buildPursuitMissionMetadata,
} from './asuncionPursuitLore';
import { createPhotorealEnvironmentMaterials } from './nfsmwEnvironmentMaterials';
import { createUrbanTrackScenery } from './urbanTrackScenery';
import { ASUNCION_CIRCUITS, toRaceTrack } from '../data/asuncionCircuits';
import { makeRoadPath } from './curvedRoadPath';
import type { EnvironmentLodController } from './environmentLodSystem3D';

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

test('Narrative UI ("Asunción Pursuit"): conserva el texto en español exacto palabra por palabra y controla la compuerta previa al conteo', () => {
  const expectedVerbatim =
    'Un político corrupto ha vaciado las arcas del municipio de Asunción y está en camino al aeropuerto con el dinero. Datacar te ha contratado a vos, su piloto de élite, para interceptarlo en el hangar antes de que escape. Pero primero, deberás superar las pruebas de conducción contrarreloj en el circuito más salvaje de todos... y no estamos hablando del Chaco paraguayo, sino de Asunción y sus legendarios baches.';

  assert.equal(ASUNCION_PURSUIT_LORE_TEXT, expectedVerbatim);

  // Activo en modo carrera individual (especialmente competición) antes de la cuenta regresiva
  assert.equal(
    shouldShowAsuncionPursuitBriefing({ experience: 'race', raceMode: 'city_trial', onlineSession: false }),
    true,
  );
  assert.equal(
    shouldShowAsuncionPursuitBriefing({ experience: 'race', raceMode: 'speed_pro', onlineSession: false }),
    true,
  );

  // Inactivo en repeticiones, comparador o sesiones sincronizadas por WebSocket en línea
  assert.equal(
    shouldShowAsuncionPursuitBriefing({ experience: 'replay', raceMode: 'city_trial' }),
    false,
  );
  assert.equal(
    shouldShowAsuncionPursuitBriefing({ experience: 'comparison', raceMode: 'city_trial' }),
    false,
  );
  assert.equal(
    shouldShowAsuncionPursuitBriefing({ experience: 'race', raceMode: 'city_trial', onlineSession: true }),
    false,
  );

  const compMeta = buildPursuitMissionMetadata('city_trial', '≤ 04:12');
  assert.equal(compMeta.isCompetitionMode, true);
  assert.ok(compMeta.objectiveSummary.includes('04:12'));
});

test('Alpha-clipped foliage + maxAnisotropy: preserva shaders SSS y viento en follaje recortado y propaga maxAnisotropy', () => {
  const env = createPhotorealEnvironmentMaterials({
    halfRoadWidth: 10.5,
    wet: false,
    maxAnisotropy: 16,
  });

  // Todas las texturas PBR ambientales deben tener maxAnisotropy = 16
  for (const tex of env.textures) {
    assert.equal(tex.anisotropy, 16, 'Cada textura PBR debe recibir maxAnisotropy para nitidez extrema de cerca');
  }

  // Follaje con recorte alfa preciso (alphaTest > 0) + DoubleSide + shader SSS y viento intacto
  assert.ok(env.foliageCutoutMaterial.alphaTest >= 0.4, 'Follaje volumétrico debe usar alpha-clipping preciso');
  assert.equal(env.foliageCutoutMaterial.side, THREE.DoubleSide);

  const shader = {
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  env.foliageCutoutMaterial.onBeforeCompile(
    shader as unknown as THREE.WebGLProgramParametersWithUniforms,
    null as unknown as THREE.WebGLRenderer,
  );
  assert.ok(shader.vertexShader.includes('swayX') && shader.vertexShader.includes('uEnvTime'), 'Mantiene animación de viento en hojas alpha-clipped');
  assert.ok(shader.fragmentShader.includes('sssTranslucency') && shader.fragmentShader.includes('warmTransmitted'), 'Mantiene Subsurface Scattering (SSS) en hojas alpha-clipped');

  // Materiales de infraestructura urbana PBR presentes
  assert.ok(env.utilityWoodPoleMaterial.normalMap && env.utilityWoodPoleMaterial.roughnessMap);
  assert.ok(env.guardrailMetalMaterial.normalMap && env.guardrailMetalMaterial.roughnessMap);
  assert.ok(env.retainingWallMaterial.normalMap && env.retainingWallMaterial.roughnessMap);
  assert.ok(env.ceramicInsulatorMaterial.clearcoat >= 0.85);

  env.dispose();
});

test('Sistema LOD basado en distancia a cámara + InstancedMesh en los 6 circuitos de Asunción', () => {
  const cleanup = installCanvasStubIfNeeded();
  try {
    assert.equal(ASUNCION_CIRCUITS.length, 6);

    for (const circuit of ASUNCION_CIRCUITS) {
      const track = toRaceTrack(circuit, 2);
      const roadPath = makeRoadPath(track);
      const scenery = createUrbanTrackScenery(
        21,
        track.distanceMeters + 120,
        track.routeHazardProfile,
        true,
        track.cityCircuitId,
        16,
      );
      scenery.userData.initPedestrians?.(roadPath);

      const lod = scenery.userData.lodSystem as EnvironmentLodController;
      assert.ok(lod, `Circuito ${circuit.id} debe inicializar sistema LOD de props`);

      // Posicionar cámara en la largada (0, 2, 18) -> objetos inmediatos deben estar en LOD0 de máxima densidad
      const startWorld = roadPath.world(18, 0);
      scenery.userData.updateScenery?.(1.0, 18, roadPath, [0.56, 0.518, -0.646], {
        x: startWorld.x,
        y: 2.0,
        z: startWorld.z,
      });

      const nearDiag = lod.getDiagnostics();
      assert.ok(
        nearDiag.lod0TreeTriangles > nearDiag.lod2TreeTriangles * 10,
        `LOD0 de árbol (${nearDiag.lod0TreeTriangles} tris) debe superar ampliamente la malla lejana LOD2 (${nearDiag.lod2TreeTriangles} tris)`,
      );
      assert.ok(nearDiag.trees.lod0 > 0, `${circuit.id}: árboles frente a cámara en LOD0`);
      assert.ok(nearDiag.utilityPoles.lod0 > 0, `${circuit.id}: postes eléctricos frente a cámara en LOD0`);
      assert.ok(nearDiag.guardrails.lod0 > 0, `${circuit.id}: guardarrieles metálicos 3D frente a cámara en LOD0`);
      assert.ok(nearDiag.retainingWalls.total > 0, `${circuit.id}: muros de contención de hormigón presentes`);
      assert.ok(nearDiag.hvTowers.total > 0, `${circuit.id}: torres de alta tensión presentes`);
      assert.ok(nearDiag.catenarySegments > 60, `${circuit.id}: líneas aéreas catenarias tendidas (${nearDiag.catenarySegments})`);

      // Conservación exacta de instancias en los 3 niveles LOD (LOD0 + LOD1 + LOD2 === total)
      for (const family of [
        nearDiag.trees,
        nearDiag.utilityPoles,
        nearDiag.hvTowers,
        nearDiag.guardrails,
        nearDiag.retainingWalls,
      ]) {
        assert.equal(family.lod0 + family.lod1 + family.lod2, family.total);
      }

      // Alejar la cámara muy lejos (x=5000, z=5000) -> todos los props deben transicionar limpiamente a LOD2 (lod0 = 0, lod1 = 0)
      scenery.userData.updateScenery?.(2.0, 500, roadPath, [0.56, 0.518, -0.646], {
        x: 5000,
        y: 20,
        z: 5000,
      });
      const farDiag = lod.getDiagnostics();
      assert.equal(farDiag.trees.lod0, 0);
      assert.equal(farDiag.trees.lod1, 0);
      assert.equal(farDiag.trees.lod2, farDiag.trees.total);
      assert.equal(farDiag.guardrails.lod0, 0);
      assert.equal(farDiag.guardrails.lod2, farDiag.guardrails.total);

      scenery.userData.disposeTextureMaps?.();
    }
  } finally {
    cleanup();
  }
});

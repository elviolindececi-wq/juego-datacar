import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createPhotorealEnvironmentMaterials,
  generateBuildingArchetypePbrMaps,
  type BuildingArchetype,
} from './nfsmwEnvironmentMaterials';
import { createUrbanTrackScenery } from './urbanTrackScenery';

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
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
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

function compileStandardShaderPreview(mat: THREE.Material): {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, THREE.IUniform>;
} {
  const isPhys = (mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial;
  const lib = isPhys ? THREE.ShaderLib.physical : THREE.ShaderLib.standard;
  const shader = {
    uniforms: THREE.UniformsUtils.clone(lib.uniforms),
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
  };
  mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, null as unknown as THREE.WebGLRenderer);
  return shader;
}

test('nfsmwEnvironmentMaterials: genera mapas PBR de alta resolución (corteza, follaje, césped y 4 arquetipos de fachadas) con espacios de color y rugosidad no uniforme', () => {
  const env = createPhotorealEnvironmentMaterials({ halfRoadWidth: 10.5, wet: false });

  // Corteza y follaje con mapas PBR completos
  assert.ok(env.trunkMaterial.map && env.trunkMaterial.normalMap && env.trunkMaterial.roughnessMap);
  assert.equal(env.trunkMaterial.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(env.trunkMaterial.normalMap.colorSpace, THREE.NoColorSpace);
  assert.equal(env.trunkMaterial.roughnessMap.colorSpace, THREE.NoColorSpace);

  assert.ok(env.foliageMaterial.map && env.foliageMaterial.normalMap && env.foliageMaterial.roughnessMap);
  assert.ok(env.groundGrassMaterial.map && env.groundGrassMaterial.normalMap && env.groundGrassMaterial.roughnessMap);
  assert.ok(env.lushGrassMaterial.map && env.lushGrassMaterial.normalMap && env.lushGrassMaterial.roughnessMap);

  // 4 arquetipos arquitectónicos: hormigón, ladrillo, mampostería y metal oxidado
  assert.equal(env.facadeMaterials.length, 4);
  const archetypes: BuildingArchetype[] = ['concrete', 'brick', 'stucco', 'industrial_metal'];
  for (const arch of archetypes) {
    const maps = generateBuildingArchetypePbrMaps(arch, 64);
    const roughData = maps.roughness.image.data as Uint8Array;
    const heightData = maps.height.image.data as Uint8Array;
    let minR = 255;
    let maxR = 0;
    let minH = 255;
    let maxH = 0;
    for (let i = 0; i < roughData.length; i += 4) {
      if (roughData[i] < minR) minR = roughData[i];
      if (roughData[i] > maxR) maxR = roughData[i];
      if (heightData[i] < minH) minH = heightData[i];
      if (heightData[i] > maxH) maxH = heightData[i];
    }
    assert.ok(minR < 40 && maxR > 190, `${arch} debe diferenciar vidrio especular (minR=${minR}) de muro mate (maxR=${maxR})`);
    assert.ok(maxH - minH > 120, `${arch} debe tener relieve profundo de ventanas/alféizar para POM (rango=${maxH - minH})`);
    maps.albedo.dispose();
    maps.normal.dispose();
    maps.roughness.dispose();
    maps.height.dispose();
  }

  env.dispose();
});

test('nfsmwEnvironmentMaterials: inyecta shaders GLSL válidos de SSS + viento foliar, césped macro AO, POM e imperfecciones basales sin sintaxis inválida', () => {
  const env = createPhotorealEnvironmentMaterials({ halfRoadWidth: 10.5, wet: false });

  // 1. Follaje SSS + animación de viento
  const leafShader = compileStandardShaderPreview(env.foliageMaterial);
  assert.ok(leafShader.vertexShader.includes('uEnvTime') && leafShader.vertexShader.includes('swayX'));
  assert.ok(leafShader.fragmentShader.includes('sssTranslucency') && leafShader.fragmentShader.includes('warmTransmitted'));
  assert.ok(!leafShader.fragmentShader.includes('void('));

  // 2. Césped con AO en raíces + parches otoñales secos
  const grassShader = compileStandardShaderPreview(env.groundGrassMaterial);
  assert.ok(grassShader.fragmentShader.includes('dryAutumnOchre') && grassShader.fragmentShader.includes('rootClumpAo'));

  // 3. Fachadas con Parallax Occlusion Mapping + reflejo de cielo dorado + suciedad y musgo basal
  const facadeShader = compileStandardShaderPreview(env.facadeMaterials[1]);
  assert.ok(facadeShader.fragmentShader.includes('computePomUv'), 'Debe inyectar Parallax Occlusion Mapping');
  assert.ok(facadeShader.fragmentShader.includes('plinthDirtMask') && facadeShader.fragmentShader.includes('basalMossMask'), 'Debe inyectar suciedad y musgo en la base del edificio');
  assert.ok(facadeShader.fragmentShader.includes('goldenSkyRefl'), 'Debe inyectar reflejos de cielo dorado en ventanas');
  assert.ok(!facadeShader.fragmentShader.includes('void('), 'No debe contener expresiones void(...) inválidas en GLSL');

  // 4. Actualización dinámica de tiempo y dirección solar
  env.update(4.25, [0.4, 0.55, -0.73]);
  assert.equal((leafShader.uniforms.uEnvTime as THREE.IUniform<number>).value, 4.25);
  const sunVec = (leafShader.uniforms.uSunDirWorld as THREE.IUniform<THREE.Vector3>).value;
  assert.ok(Math.abs(sunVec.length() - 1.0) < 1e-5);

  env.dispose();
});

test('invariancia de edificios/torres y sistema LOD de árboles con shaders SSS + viento intactos', () => {
  const cleanup = installCanvasStubIfNeeded();
  try {
    const roadWidth = 21;
    const trackLength = 1800;
    const sceneryA = createUrbanTrackScenery(roadWidth, trackLength, 'flood', true, 'aviadores');
    const sceneryB = createUrbanTrackScenery(roadWidth, trackLength, 'flood', true, 'aviadores');

    // Misma jerarquía exacta y conteo de nodos
    assert.equal(sceneryA.children.length, sceneryB.children.length);

    const buildingsA = sceneryA.children.filter((c) => c.name.startsWith('urban_buildings_')) as THREE.InstancedMesh[];
    const towersA = sceneryA.children.filter((c) => c.name.startsWith('skyline_towers_')) as THREE.InstancedMesh[];
    assert.equal(buildingsA.length, 4, 'Los 4 grupos de edificios existentes permanecen intactos');
    assert.equal(towersA.length, 2, 'Los 2 grupos de torres existentes permanecen intactos');

    const totalBuildings = buildingsA.reduce((acc, m) => acc + m.count, 0);
    assert.ok(totalBuildings > 15, `Edificios existentes poblados sin cambios (${totalBuildings})`);

    // Verificar árboles volumétricos con LOD e InstancedMesh
    const lodGroup = sceneryA.children.find((c) => c.name === 'nfsmw2012_instanced_lod_props') as THREE.Group | undefined;
    assert.ok(lodGroup, 'Grupo de props LOD de alta densidad presente');
    const diag = sceneryA.userData.lodSystem.getDiagnostics();
    assert.ok(diag.trees.total > 20, 'Árboles urbanos y costeros poblados mediante InstancedMesh + LOD');
    assert.equal(diag.trees.lod0 + diag.trees.lod1 + diag.trees.lod2, diag.trees.total);

    // Verificar que updateScenery sin cambio de cámara no muta matrices de edificios
    const sampleBuildingMatBefore = new THREE.Matrix4();
    buildingsA[0].getMatrixAt(0, sampleBuildingMatBefore);

    sceneryA.userData.updateScenery?.(3.5, 120, undefined, [0.56, 0.518, -0.646]);

    const sampleBuildingMatAfter = new THREE.Matrix4();
    buildingsA[0].getMatrixAt(0, sampleBuildingMatAfter);

    assert.deepEqual(Array.from(sampleBuildingMatBefore.elements), Array.from(sampleBuildingMatAfter.elements));

    sceneryA.userData.disposeTextureMaps?.();
    sceneryB.userData.disposeTextureMaps?.();
  } finally {
    cleanup();
  }
});

import * as THREE from 'three';
import { getAsuncionStreetDetails } from './asuncionStreetData.ts';
import type { CurvedRoadPath } from './curvedRoadPath.ts';

interface PedestrianAgent {
  lateral: number;
  baseS: number;
  minS: number;
  maxS: number;
  speedMps: number;
  dir: 1 | -1;
  phase: number;
  heightScale: number;
}

/**
 * Entorno estilizado de Asunción — Edición Ciudad Viva:
 * - Avenida ancha con canteros de pasto, veredas amplias y arboleda (Lapachos, Jacarandás y verdes)
 * - Plazas verdes con césped, senderos peatonales y bancos cada pocas cuadras
 * - Skyline de múltiples alturas: comercios bajos (6-11m), edificios medios (15-34m) y torres corporativas vidriadas (34-72m)
 * - Bahía y Río Paraguay con Costanera, agua con reflejos y oleaje suave + costa verde del Chaco al fondo
 * - Peatones 3D compuestos (5 InstancedMesh coordinados: piernas, torso, cabeza, cabello y brazos) caminando por veredas y plazas
 */
export function createUrbanTrackScenery(
  roadWidth: number,
  trackLength: number,
  profile: string | undefined,
  isCityCircuit: boolean,
  circuitId?: string,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'asuncion_roadside_environment';
  const end = Math.min(trackLength, isCityCircuit ? 7800 : 1600);
  const mid = end / 2 - 20;
  const halfRoad = roadWidth / 2;
  const wet = profile === 'flood';
  const streetDetails = isCityCircuit
    ? getAsuncionStreetDetails(profile, Math.max(100, trackLength - 120))
    : { crossings: [], speedBumps: [] };
  const crossings = streetDetails.crossings;
  const historical = profile === 'cobbles' || profile === 'chains';

  const generatedTextures: THREE.Texture[] = [];
  const mat = (color: string, roughness = 0.92, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  // 1. SUELO BASE CON TEXTURA ORGÁNICA DE PASTO Y TIERRA URBANA
  const grassTex = createGrassTurfTexture();
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.wrapS = THREE.RepeatWrapping;
  grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(36, Math.max(16, Math.round(end / 14)));
  generatedTextures.push(grassTex);

  const groundMaterial = new THREE.MeshStandardMaterial({
    color: historical ? '#d5ddd0' : wet ? '#c0d4c4' : '#edf5e8',
    map: grassTex,
    roughness: 0.94,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(540, end + 160), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(35, -0.32, mid);
  group.add(ground);

  // 2. CORDONES, CANTEROS DE PASTO LATERALES Y VEREDAS AMPLIAS CORTADAS EN INTERSECCIONES
  const sidewalkMaterial = mat(historical ? '#aba89e' : '#a3acb2', 0.88);
  const curbMaterial = mat('#cfd0ca', 0.82);
  const lushGrassMat = new THREE.MeshStandardMaterial({
    color: wet ? '#cbe0ce' : '#ffffff',
    map: grassTex,
    roughness: 0.88,
    metalness: 0.02,
  });

  const interruptions = crossings
    .map((c) => ({ from: c.z - 6.2, to: c.z + 6.2 }))
    .sort((a, b) => a.from - b.from);
  const spans: { from: number; to: number }[] = [];
  let sectionStart = -20;
  for (const interruption of interruptions) {
    if (interruption.from > sectionStart) {
      spans.push({ from: sectionStart, to: interruption.from });
    }
    sectionStart = Math.max(sectionStart, interruption.to);
  }
  if (sectionStart < end - 20) spans.push({ from: sectionStart, to: end - 20 });

  for (const span of spans) {
    const length = span.to - span.from;
    if (length < 0.5) continue;
    const spanCenterZ = (span.from + span.to) / 2;
    for (const side of [-1, 1]) {
      // Cordón cuneta junto al asfalto
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, length), curbMaterial);
      curb.position.set(side * (halfRoad + 0.72), 0.01, spanCenterZ);
      group.add(curb);

      // Franja de pasto / cantero verde arbolado entre el cordón y la vereda peatonal
      const grassStrip = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.17, length), lushGrassMat);
      grassStrip.position.set(side * (halfRoad + 1.72), -0.04, spanCenterZ);
      group.add(grassStrip);

      // Vereda peatonal amplia de baldosas
      const walk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, length), sidewalkMaterial);
      walk.position.set(side * (halfRoad + 4.2), -0.05, spanCenterZ);
      group.add(walk);
    }
  }

  // 3. MARCAS DE CARRIL ADAPTADAS AL ANCHO DE LA AVENIDA (3+3 carriles en avenida de 21 m)
  const stripeMaterial = new THREE.MeshBasicMaterial({
    color: '#e8e8df',
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const dashLength = 2.9;
  const gapLength = 5.6;
  const usableLength = Math.max(0, end - 20);
  const dashPerLane = Math.ceil(usableLength / (dashLength + gapLength));
  const laneOffsets =
    roadWidth >= 19
      ? [-6.9, -3.45, 3.45, 6.9] // 3 carriles amplios por sentido alrededor de X = 0
      : [-1.8, 1.8];

  const dashes = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.11, dashLength),
    stripeMaterial,
    dashPerLane * laneOffsets.length,
  );
  dashes.name = 'lane_markings';
  const dummy = new THREE.Object3D();
  let dashIdx = 0;
  for (let i = 0; i < dashPerLane; i++) {
    const z = i * (dashLength + gapLength) - 14;
    const hideAtCrossing = crossings.some((c) => Math.abs(c.z - z) < 9.0);
    for (let lane = 0; lane < laneOffsets.length; lane++) {
      dummy.position.set(laneOffsets[lane], 0.028, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(hideAtCrossing ? 0 : 1, 1, 1);
      dummy.updateMatrix();
      dashes.setMatrixAt(dashIdx++, dummy.matrix);
    }
  }
  dashes.count = dashIdx;
  dashes.instanceMatrix.needsUpdate = true;
  dashes.frustumCulled = false;
  group.add(dashes);

  for (const span of spans) {
    const length = span.to - span.from;
    if (length <= 0.2) continue;
    for (const side of [-1, 1]) {
      const edgeLine = new THREE.Mesh(new THREE.PlaneGeometry(0.14, length), stripeMaterial);
      edgeLine.rotation.x = -Math.PI / 2;
      edgeLine.position.set(side * (halfRoad - 0.45), 0.027, (span.from + span.to) / 2);
      group.add(edgeLine);
    }
  }

  if (!isCityCircuit) return group;

  // 4. RÍO PARAGUAY, COSTANERA VERDE Y COSTA DEL CHACO AL FONDO (+X, lado Bahía de Asunción)
  const riverWaterTex = createRiverWaterTexture();
  riverWaterTex.wrapS = THREE.RepeatWrapping;
  riverWaterTex.wrapT = THREE.RepeatWrapping;
  riverWaterTex.repeat.set(8, Math.max(18, Math.round(end / 28)));
  generatedTextures.push(riverWaterTex);

  const riverBumpTex = createRiverBumpTexture();
  riverBumpTex.wrapS = THREE.RepeatWrapping;
  riverBumpTex.wrapT = THREE.RepeatWrapping;
  riverBumpTex.repeat.set(12, Math.max(24, Math.round(end / 20)));
  generatedTextures.push(riverBumpTex);

  const costaneraGrassX = halfRoad + 44;
  const costaneraPromenadeX = halfRoad + 53.5;
  const riverCenterX = halfRoad + 142;
  const riverWidth = 172;
  const chacoBankX = halfRoad + 244;

  // Parque lineal verde de la Costanera junto al río
  const costaneraLawn = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.22, end + 120),
    lushGrassMat,
  );
  costaneraLawn.position.set(costaneraGrassX, -0.16, mid);
  costaneraLawn.name = 'parque_costanera_pasto';
  group.add(costaneraLawn);

  // Paseo peatonal y murallón de piedra de la Costanera de Asunción
  const promenadeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.30, end + 120),
    mat('#cbd5e1', 0.78),
  );
  promenadeMesh.position.set(costaneraPromenadeX, -0.06, mid);
  group.add(promenadeMesh);

  const seawallMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.95, end + 120),
    mat('#64748b', 0.85),
  );
  seawallMesh.position.set(costaneraPromenadeX + 2.5, -0.25, mid);
  group.add(seawallMesh);

  // Playa de arena húmeda ribereña junto a la bahía
  const sandBeach = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, end + 120),
    mat('#cbb894', 0.92),
  );
  sandBeach.rotation.x = -Math.PI / 2;
  sandBeach.position.set(costaneraPromenadeX + 4.8, -0.24, mid);
  group.add(sandBeach);

  // Espejo de agua hiperrealista del Río Paraguay con mapa de normales de oleaje e IBL solar
  const riverNormalTex = createRiverNormalTexture();
  riverNormalTex.wrapS = THREE.RepeatWrapping;
  riverNormalTex.wrapT = THREE.RepeatWrapping;
  riverNormalTex.repeat.set(14, Math.max(28, Math.round(end / 18)));
  generatedTextures.push(riverNormalTex);

  const riverMaterial = new THREE.MeshPhysicalMaterial({
    color: wet ? '#94b8cb' : '#bae0f5',
    map: riverWaterTex,
    normalMap: riverNormalTex,
    normalScale: new THREE.Vector2(0.55, 0.55),
    bumpMap: riverBumpTex,
    bumpScale: 0.05,
    roughness: 0.08,
    metalness: 0.28,
    clearcoat: 0.96,
    clearcoatRoughness: 0.05,
    reflectivity: 0.96,
    envMapIntensity: 2.05,
  });
  const paraguayRiver = new THREE.Mesh(
    new THREE.PlaneGeometry(riverWidth, end + 220),
    riverMaterial,
  );
  paraguayRiver.rotation.x = -Math.PI / 2;
  paraguayRiver.position.set(riverCenterX, -0.20, mid);
  paraguayRiver.name = 'rio_paraguay_asuncion';
  group.add(paraguayRiver);

  // Costa verde del Chaco Húmedo del otro lado del Río Paraguay
  const chacoBank = new THREE.Mesh(
    new THREE.BoxGeometry(42, 1.4, end + 220),
    mat('#365f3b', 0.95),
  );
  chacoBank.position.set(chacoBankX, 0.35, mid);
  chacoBank.name = 'costa_verde_chaco';
  group.add(chacoBank);

  // Pequeñas embarcaciones / barcazas estilizadas navegando sobre el Río Paraguay (2 InstancedMesh)
  const boatCount = Math.max(4, Math.floor(end / 320));
  const boatHullInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(3.4, 1.1, 9.8),
    mat('#e2e8f0', 0.48, 0.2),
    boatCount,
  );
  const boatCabinInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.4, 1.35, 3.8),
    mat('#0284c7', 0.38, 0.25),
    boatCount,
  );
  for (let b = 0; b < boatCount; b++) {
    const bx = riverCenterX - 36 + (b % 3) * 32;
    const bz = 95 + b * (end / boatCount);
    dummy.rotation.set(0, (b % 2 === 0 ? 0.04 : -0.04), 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(bx, 0.22, bz);
    dummy.updateMatrix();
    boatHullInst.setMatrixAt(b, dummy.matrix);
    dummy.position.set(bx, 1.15, bz - 1.1);
    dummy.updateMatrix();
    boatCabinInst.setMatrixAt(b, dummy.matrix);
  }
  boatHullInst.instanceMatrix.needsUpdate = true;
  boatCabinInst.instanceMatrix.needsUpdate = true;
  boatHullInst.frustumCulled = false;
  boatCabinInst.frustumCulled = false;
  group.add(boatHullInst, boatCabinInst);

  // 5. CRUCES PERPENDICULARES Y SENDAS PEATONALES ADAPTADAS AL ANCHO VIAL
  const crossAsphalt = mat(wet ? '#454f54' : '#34383b', 0.92);
  const crossingMaterial = new THREE.MeshBasicMaterial({
    color: '#e4e1d5',
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  const stripesPerCrosswalk = Math.max(13, Math.floor((roadWidth - 1.8) / 1.05));
  const crosswalks = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.58, 2.3),
    crossingMaterial,
    Math.max(1, crossings.length * 2 * stripesPerCrosswalk),
  );
  let stripeId = 0;
  const crossDummy = new THREE.Object3D();
  for (const cross of crossings) {
    const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(92, 11.4), crossAsphalt);
    crossRoad.rotation.x = -Math.PI / 2;
    crossRoad.position.set(0, 0.012, cross.z);
    crossRoad.name = `interseccion_3d_${Math.round(cross.z)}`;
    group.add(crossRoad);
    const startStripeX = -(stripesPerCrosswalk - 1) * 0.5 * 1.02;
    for (const dz of [-7.4, 7.4]) {
      for (let i = 0; i < stripesPerCrosswalk; i++) {
        crossDummy.rotation.set(-Math.PI / 2, 0, 0);
        crossDummy.position.set(startStripeX + i * 1.02, 0.034, cross.z + dz);
        crossDummy.scale.set(1, 1, 1);
        crossDummy.updateMatrix();
        crosswalks.setMatrixAt(stripeId++, crossDummy.matrix);
      }
    }
  }
  crosswalks.count = stripeId;
  crosswalks.instanceMatrix.needsUpdate = true;
  crosswalks.frustumCulled = false;
  group.add(crosswalks);

  // 6. EDIFICIOS DE ALTURAS VARIADAS + TORRES CORPORATIVAS + PLAZAS DE PASTO
  let seed = Array.from(profile ?? 'asuncion').reduce(
    (acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0,
    1729,
  );
  const rng = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const blockStep = 50;
  const approxBlocksPerSide = Math.ceil(end / blockStep);
  const maxRow1Count = approxBlocksPerSide * 2 + 8;
  const maxRow2Count = approxBlocksPerSide * 2 + 8;

  const facadeMaterials = [
    mat('#94a0aa', 0.78),
    mat('#beb5a4', 0.82),
    mat('#a5988e', 0.80),
    mat('#7b8c9e', 0.65, 0.18),
  ];
  facadeMaterials.forEach((material, i) => {
    const tex = createUrbanFacadeTexture(i);
    generatedTextures.push(tex);
    material.map = tex;
    material.needsUpdate = true;
  });

  const towerGlassTex = createGlassTowerTexture();
  generatedTextures.push(towerGlassTex);
  const towerMaterials = [
    new THREE.MeshPhysicalMaterial({
      color: '#7dd3fc',
      map: towerGlassTex,
      roughness: 0.09,
      metalness: 0.38,
      clearcoat: 0.92,
      clearcoatRoughness: 0.06,
      reflectivity: 0.95,
      envMapIntensity: 1.75,
    }),
    new THREE.MeshPhysicalMaterial({
      color: '#cbd5e1',
      map: towerGlassTex,
      roughness: 0.14,
      metalness: 0.34,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
      reflectivity: 0.92,
      envMapIntensity: 1.65,
    }),
  ];

  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMeshes = facadeMaterials.map(
    (material) => new THREE.InstancedMesh(buildingGeometry, material, maxRow1Count),
  );
  const buildingCounters = [0, 0, 0, 0];

  const towerMeshes = towerMaterials.map(
    (material) => new THREE.InstancedMesh(buildingGeometry, material, maxRow2Count),
  );
  const towerCounters = [0, 0];

  // Coronamientos / terrazas técnicas en azoteas para riqueza visual desde el Dron
  const roofCapMesh = new THREE.InstancedMesh(
    buildingGeometry,
    mat('#334155', 0.72, 0.25),
    maxRow1Count + maxRow2Count,
  );
  let roofCapIdx = 0;

  // Plazas verdes urbanas con pasto y senderos cada ciertos bloques
  const parkLawnMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.20, 1),
    lushGrassMat,
    approxBlocksPerSide * 2,
  );
  const parkPathMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.23, 1),
    mat('#d6d3c9', 0.86),
    approxBlocksPerSide * 4,
  );
  const parkBenchMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.65, 0.52, 2.1),
    mat('#7c4a2d', 0.82),
    approxBlocksPerSide * 6,
  );
  let parkLawnIdx = 0;
  let parkPathIdx = 0;
  let parkBenchIdx = 0;
  const parkZones: { side: number; centerX: number; centerZ: number; spanZ: number }[] = [];

  const windowMaterial = new THREE.MeshBasicMaterial({
    color: '#60798e',
    transparent: true,
    opacity: 0.72,
  });
  const windowMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    windowMaterial,
    maxRow1Count * 4,
  );
  let windowIndex = 0;

  const adTextures = [
    createAdvertisingTexture('DATACARPY.COM', 'LOS AUTOS REALES ESTÁN ACÁ'),
    createAdvertisingTexture('DATACARPY.COM', 'DEL JUEGO A LA CALLE'),
    createAdvertisingTexture('DATACARPY.COM', 'ENCONTRÁ TU PRÓXIMO AUTO'),
  ];
  generatedTextures.push(...adTextures);
  const adMats = adTextures.map(
    (map) =>
      new THREE.MeshBasicMaterial({
        map,
        side: THREE.DoubleSide,
        depthWrite: true,
        toneMapped: false,
      }),
  );
  const adFrameMat = new THREE.MeshStandardMaterial({
    color: '#071525',
    roughness: 0.6,
    metalness: 0.12,
  });
  let adCount = 0;

  // 5B. COMPLEJO ICÓNICO TIPO PASEO LA GALERÍA EN AV. AVIADORES DEL CHACO
  // Torres gemelas curvas de cristal celeste/azul con coronamiento escalonado en 3 niveles,
  // podio comercial con jardines verticales verdes, terraza central con cubierta blanca octogonal y palmeras.
  const isAviadores = circuitId === 'aviadores';
  const paseoSites: { z: number; side: -1 | 1 }[] = isAviadores
    ? [
        { z: 168, side: -1 },
        ...(end > 980 ? [{ z: 910, side: 1 as const }] : []),
        ...(end > 1750 ? [{ z: 1680, side: -1 as const }] : []),
      ]
    : end > 760
      ? [{ z: Math.min(end - 180, 560), side: -1 }]
      : [];

  for (const site of paseoSites) {
    if (site.z < end - 90 && !crossings.some((c) => Math.abs(c.z - site.z) < 26)) {
      const paseoComplex = buildPaseoLaGaleriaComplex(
        halfRoad,
        site.z,
        site.side,
        towerGlassTex,
        grassTex,
      );
      group.add(paseoComplex);
    }
  }

  for (let block = 0; block < approxBlocksPerSide; block++) {
    for (const side of [-1, 1]) {
      const laneZ = block * blockStep + 8 + rng() * 6;
      if (crossings.some((c) => Math.abs(c.z - laneZ) < 18)) continue;
      if (paseoSites.some((ps) => ps.side === side && Math.abs(ps.z - laneZ) < 52)) continue;

      // Cada 3 cuadras alternadas abrimos una Plaza Verde con pasto (y en +X abre vista franca al Río Paraguay)
      const isGreenParkBlock =
        (side === 1 && block % 3 === 1) || (side === -1 && block % 4 === 2);

      if (isGreenParkBlock) {
        const parkDepth = 22;
        const parkLength = 36;
        const parkX = side * (halfRoad + 6.5 + parkDepth * 0.5);
        dummy.rotation.set(0, 0, 0);
        dummy.position.set(parkX, -0.06, laneZ);
        dummy.scale.set(parkDepth, 1, parkLength);
        dummy.updateMatrix();
        parkLawnMesh.setMatrixAt(parkLawnIdx++, dummy.matrix);

        // Sendero central de piedra dentro del pasto
        dummy.position.set(parkX, -0.045, laneZ);
        dummy.scale.set(parkDepth * 0.92, 1, 2.6);
        dummy.updateMatrix();
        parkPathMesh.setMatrixAt(parkPathIdx++, dummy.matrix);

        dummy.position.set(parkX, -0.045, laneZ);
        dummy.scale.set(2.6, 1, parkLength * 0.88);
        dummy.updateMatrix();
        parkPathMesh.setMatrixAt(parkPathIdx++, dummy.matrix);

        // Bancos de plaza junto a los senderos
        for (const bzOff of [-7.5, 7.5]) {
          dummy.position.set(parkX - side * 3.2, 0.22, laneZ + bzOff);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          parkBenchMesh.setMatrixAt(parkBenchIdx++, dummy.matrix);
        }

        parkZones.push({ side, centerX: parkX, centerZ: laneZ, spanZ: parkLength * 0.7 });
        continue;
      }

      // Fila 1: Edificios sobre línea municipal con alturas variadas (comercios bajos, edificios medios y esquinas altas)
      const tierRoll = rng();
      const height =
        tierRoll < 0.30
          ? 6.5 + rng() * 5.5 // Comercios / casonas bajas (6.5 - 12 m)
          : tierRoll < 0.72
            ? 15 + rng() * (historical ? 10 : 16) // Edificios residenciales medios (15 - 31 m)
            : 30 + rng() * (historical ? 10 : 16); // Edificios altos frente a avenida (30 - 46 m)

      const width = 10 + rng() * 11;
      const depth = 10 + rng() * 8;
      const x = side * (halfRoad + 10.5 + depth * 0.5 + rng() * 2.2);
      const materialIndex = Math.floor(rng() * facadeMaterials.length);

      dummy.position.set(x, height / 2 - 0.1, laneZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(depth, height, width);
      dummy.updateMatrix();
      buildingMeshes[materialIndex].setMatrixAt(buildingCounters[materialIndex]++, dummy.matrix);

      // Terraza / sala de máquinas sobre azotea para silueta realista desde el Dron
      if (height > 13 && roofCapIdx < roofCapMesh.instanceMatrix.count) {
        const capH = 1.6 + rng() * 1.8;
        dummy.position.set(x, height + capH * 0.5 - 0.1, laneZ);
        dummy.scale.set(depth * 0.48, capH, width * 0.46);
        dummy.updateMatrix();
        roofCapMesh.setMatrixAt(roofCapIdx++, dummy.matrix);
      }

      // Carteles DATACARPY.COM orientados al conductor
      if (block % 3 === 0 && height > 8.0 && adCount < 18) {
        const panelWidth = Math.min(7.2, depth - 0.7);
        const panelHeight = 1.7;
        const panelX = x - side * depth * 0.12;
        const panelZ = laneZ - width / 2 - 0.14;
        const panelY = Math.min(height - 1.5, 5.2);
        const back = new THREE.Mesh(
          new THREE.BoxGeometry(panelWidth + 0.05, panelHeight + 0.05, 0.025),
          adFrameMat,
        );
        back.position.set(panelX, panelY, panelZ + 0.018);
        back.name = `marco_publicidad_datacar_fachada_${adCount}`;
        group.add(back);
        const board = new THREE.Mesh(
          new THREE.PlaneGeometry(panelWidth, panelHeight),
          adMats[adCount % adMats.length],
        );
        board.rotation.y = Math.PI;
        board.position.set(panelX, panelY, panelZ - 0.025);
        board.name = `publicidad_datacarpy_com_fachada_${adCount++}`;
        group.add(board);
      }

      // Paños vidriados hacia la avenida
      const facadeX = x - side * (depth / 2 + 0.015);
      for (let f = 0; f < 3; f++) {
        if (windowIndex >= windowMesh.instanceMatrix.count) break;
        dummy.position.set(facadeX, Math.max(1.5, height * (0.26 + f * 0.22)), laneZ);
        dummy.rotation.set(0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0);
        dummy.scale.set(Math.min(5.6, width - 2.0), 0.72, 1);
        dummy.updateMatrix();
        windowMesh.setMatrixAt(windowIndex++, dummy.matrix);
      }

      // Fila 2: Skyline de torres corporativas y edificios altos detrás de la primera línea
      // (En el lado +X dejamos corredores abiertos para ver el Río Paraguay y la Costanera)
      const spawnSkylineTower = side === -1 ? block % 2 === 0 : block % 4 === 0;
      if (spawnSkylineTower) {
        const towerHeight = 34 + rng() * 38; // Torres de 34 m a 72 m (estilo Aviadores / Costanera)
        const towerWidth = 13 + rng() * 9;
        const towerDepth = 13 + rng() * 8;
        const towerX = side * (halfRoad + 29 + towerDepth * 0.5 + rng() * 5);
        const towerZ = laneZ + (rng() - 0.5) * 14;
        const tMatIdx = block % towerMaterials.length;

        dummy.rotation.set(0, 0, 0);
        dummy.position.set(towerX, towerHeight / 2 - 0.15, towerZ);
        dummy.scale.set(towerDepth, towerHeight, towerWidth);
        dummy.updateMatrix();
        towerMeshes[tMatIdx].setMatrixAt(towerCounters[tMatIdx]++, dummy.matrix);

        if (roofCapIdx < roofCapMesh.instanceMatrix.count) {
          dummy.position.set(towerX, towerHeight + 1.4, towerZ);
          dummy.scale.set(towerDepth * 0.55, 2.8, towerWidth * 0.55);
          dummy.updateMatrix();
          roofCapMesh.setMatrixAt(roofCapIdx++, dummy.matrix);
        }
      }
    }
  }

  buildingMeshes.forEach((mesh, i) => {
    mesh.name = `urban_buildings_${i}`;
    mesh.count = buildingCounters[i];
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  });

  towerMeshes.forEach((mesh, i) => {
    mesh.name = `skyline_towers_${i}`;
    mesh.count = towerCounters[i];
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  });

  roofCapMesh.count = roofCapIdx;
  roofCapMesh.instanceMatrix.needsUpdate = true;
  roofCapMesh.frustumCulled = false;
  group.add(roofCapMesh);

  parkLawnMesh.count = parkLawnIdx;
  parkLawnMesh.instanceMatrix.needsUpdate = true;
  parkLawnMesh.frustumCulled = false;
  parkPathMesh.count = parkPathIdx;
  parkPathMesh.instanceMatrix.needsUpdate = true;
  parkPathMesh.frustumCulled = false;
  parkBenchMesh.count = parkBenchIdx;
  parkBenchMesh.instanceMatrix.needsUpdate = true;
  parkBenchMesh.frustumCulled = false;
  group.add(parkLawnMesh, parkPathMesh, parkBenchMesh);

  windowMesh.count = windowIndex;
  windowMesh.instanceMatrix.needsUpdate = true;
  windowMesh.frustumCulled = false;
  group.add(windowMesh);

  // 7. ALUMBRADO PÚBLICO Y CABLEADO URBANO
  const lampCountPerSide = Math.ceil(end / 54);
  const totalLamps = lampCountPerSide * 2;
  const poleGeometry = new THREE.CylinderGeometry(0.065, 0.105, 6.3, 6);
  const metalMaterial = mat('#59626a', 0.55, 0.35);
  const lampPosts = new THREE.InstancedMesh(poleGeometry, metalMaterial, totalLamps);
  const fixture = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.2, 0.14, 0.35),
    mat('#d2d4ce', 0.42),
    totalLamps,
  );
  let lampIdx = 0;
  for (let p = 0; p < lampCountPerSide; p++) {
    for (const side of [-1, 1]) {
      const z = p * 54 - 8;
      const x = side * (halfRoad + 2.35);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(x, 3.12, z);
      dummy.updateMatrix();
      lampPosts.setMatrixAt(lampIdx, dummy.matrix);
      dummy.position.set(x - side * 0.48, 6.2, z);
      dummy.updateMatrix();
      fixture.setMatrixAt(lampIdx, dummy.matrix);
      lampIdx++;
    }
  }
  lampPosts.instanceMatrix.needsUpdate = true;
  fixture.instanceMatrix.needsUpdate = true;
  lampPosts.frustumCulled = false;
  fixture.frustumCulled = false;
  group.add(lampPosts, fixture);

  const cablePoints: number[] = [];
  for (const side of [-1, 1]) {
    const x = side * (halfRoad + 2.55);
    for (let i = 0; i < lampCountPerSide - 1; i++) {
      const startZ = i * 54 - 8;
      const endZ = (i + 1) * 54 - 8;
      for (let k = 0; k < 5; k++) {
        const t0 = k / 5;
        const t1 = (k + 1) / 5;
        const sag0 = Math.sin(Math.PI * t0) * 0.22;
        const sag1 = Math.sin(Math.PI * t1) * 0.22;
        cablePoints.push(
          x,
          6.5 - sag0,
          startZ + (endZ - startZ) * t0,
          x,
          6.5 - sag1,
          startZ + (endZ - startZ) * t1,
        );
      }
    }
  }
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cablePoints, 3));
  const wires = new THREE.LineSegments(
    wireGeometry,
    new THREE.LineBasicMaterial({ color: '#292f32', transparent: true, opacity: 0.78 }),
  );
  wires.name = 'cableado_aereo_asuncion';
  group.add(wires);

  // 8. ARBOLEDA ASUNCENA EN CANTEROS DE PASTO, PLAZAS Y COSTANERA (Lapachos rosados/amarillos, Jacarandás y verdes)
  const streetTreePairs = Math.floor(end / 38);
  const coastalTreeCount = Math.floor(end / 46);
  const parkTreeCount = parkZones.length * 5;
  const maxTrees = streetTreePairs * 2 + coastalTreeCount + parkTreeCount + 12;

  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.14, 0.23, 2.8, 8),
    mat('#544034', 0.92),
    maxTrees,
  );
  // Copa orgánica facetada de 4 racimos asimétricos por árbol (evita esferas lisas artificiales)
  const leaves = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.12, 0),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.84, metalness: 0.01 }),
    maxTrees * 4,
  );
  const foliagePalette = [
    new THREE.Color('#2d5e36'), // Ficus verde profundo
    new THREE.Color('#3b7341'), // Yvyrá Pytã soleado
    new THREE.Color('#244d2c'), // Sombra subtropical
    new THREE.Color('#4a7c44'), // Copa verde oliva cálido
    new THREE.Color('#9e4768'), // Lapacho rosado natural atenuado
    new THREE.Color('#b8891e'), // Lapacho dorado natural
  ];

  let treeIdx = 0;
  let leafLobeIdx = 0;
  const _shadeColor = new THREE.Color();
  const placeTree = (tx: number, tz: number, scale: number, colorIdx: number) => {
    if (treeIdx >= maxTrees) return;
    if (crossings.some((c) => Math.abs(c.z - tz) < 9.5)) return;
    const baseCol = foliagePalette[colorIdx % foliagePalette.length];
    dummy.rotation.set(0, (treeIdx * 1.1) % (Math.PI * 2), 0);
    dummy.position.set(tx, 1.3 * scale, tz);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(treeIdx, dummy.matrix);

    const lobes: Array<[number, number, number, number, number]> = [
      [0, 3.62 * scale, 0, 1.16, 1.04],
      [-0.68 * scale, 3.05 * scale, 0.46 * scale, 0.96, 0.86],
      [0.64 * scale, 3.12 * scale, -0.48 * scale, 0.98, 0.93],
      [0.14 * scale, 2.95 * scale, 0.62 * scale, 0.88, 0.82],
    ];
    for (const [lx, ly, lz, ls, bright] of lobes) {
      if (leafLobeIdx >= maxTrees * 4) break;
      dummy.position.set(tx + lx, ly, tz + lz);
      dummy.rotation.set((leafLobeIdx * 0.7) % 1.4, (leafLobeIdx * 1.3) % 3.1, (leafLobeIdx * 0.5) % 0.9);
      dummy.scale.set(scale * ls * 1.08, scale * ls * 0.82, scale * ls * 1.04);
      dummy.updateMatrix();
      leaves.setMatrixAt(leafLobeIdx, dummy.matrix);
      _shadeColor.copy(baseCol).multiplyScalar(bright);
      leaves.setColorAt(leafLobeIdx, _shadeColor);
      leafLobeIdx++;
    }
    treeIdx++;
  };

  // Árboles en los canteros de pasto junto a las veredas (predominio verde subtropical realista)
  for (let i = 0; i < streetTreePairs; i++) {
    const z = i * 38 + 14;
    placeTree(-(halfRoad + 1.75), z, 0.94 + (i % 3) * 0.1, (i + 2) % 9 === 0 ? 4 : i % 4);
    placeTree(halfRoad + 1.75, z + 11, 0.96 + ((i + 1) % 3) * 0.1, (i + 4) % 11 === 0 ? 5 : (i + 1) % 4);
  }
  // Árboles en las Plazas Verdes
  parkZones.forEach((pz, pIdx) => {
    for (let k = 0; k < 5; k++) {
      const ox = (k % 2 === 0 ? -6.5 : 6.5) + (k === 2 ? 3.2 : 0);
      const oz = (k - 2) * 6.8;
      placeTree(pz.centerX + ox, pz.centerZ + oz, 1.08 + (k % 2) * 0.16, (pIdx + k) % foliagePalette.length);
    }
  });
  // Árboles sobre el Parque Costanera junto al Río Paraguay
  for (let c = 0; c < coastalTreeCount; c++) {
    placeTree(costaneraPromenadeX - 3.2, c * 46 + 20, 1.06, c % 5 === 0 ? 3 : c % 3);
  }

  trunks.count = treeIdx;
  leaves.count = leafLobeIdx;
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  trunks.frustumCulled = false;
  leaves.frustumCulled = false;
  group.add(trunks, leaves);

  // 9. PERSONAS 3D EN LAS CALLES (VEREDAS, PLAZAS Y COSTANERA — 5 InstancedMesh compuestos, 0 GC)
  const pedestrians: PedestrianAgent[] = [];
  for (const span of spans) {
    const len = span.to - span.from;
    if (len < 16) continue;
    const peoplePerSide = Math.min(8, Math.max(2, Math.floor(len / 34)));
    for (const side of [-1, 1]) {
      for (let p = 0; p < peoplePerSide; p++) {
        const frac = (p + 0.5) / peoplePerSide;
        const baseS = span.from + 4 + frac * (len - 8);
        const lateral = side * (halfRoad + 3.35 + ((p * 37) % 10) * 0.14);
        pedestrians.push({
          lateral,
          baseS,
          minS: span.from + 3,
          maxS: span.to - 3,
          speedMps: 0.95 + ((p * 19) % 7) * 0.11,
          dir: p % 2 === 0 ? 1 : -1,
          phase: p * 1.37 + (side > 0 ? 0.8 : 0),
          heightScale: 0.92 + ((p * 13) % 5) * 0.04,
        });
      }
    }
  }
  // Personas paseando en las plazas de pasto y la Costanera
  parkZones.forEach((pz, idx) => {
    for (let k = 0; k < 3; k++) {
      pedestrians.push({
        lateral: pz.centerX + (k - 1) * 4.2,
        baseS: pz.centerZ + (k - 1) * 5,
        minS: pz.centerZ - pz.spanZ * 0.45,
        maxS: pz.centerZ + pz.spanZ * 0.45,
        speedMps: 0.8 + k * 0.12,
        dir: (idx + k) % 2 === 0 ? 1 : -1,
        phase: idx * 0.9 + k,
        heightScale: 0.94 + (k % 3) * 0.04,
      });
    }
  });

  const pedCount = pedestrians.length;
  if (pedCount > 0) {
    const pedestrianGroup = new THREE.Group();
    pedestrianGroup.name = 'peatones_veredas_asuncion';
    // Se proyectan directamente sobre la curva Frenet en updateScenery para animar caminata suave
    pedestrianGroup.userData.skipBend = true;

    const legGeo = new THREE.CapsuleGeometry(0.085, 0.52, 4, 6);
    const torsoGeo = new THREE.CapsuleGeometry(0.17, 0.46, 4, 8);
    const headGeo = new THREE.SphereGeometry(0.135, 10, 10);
    const hairGeo = new THREE.SphereGeometry(0.142, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
    const armGeo = new THREE.CapsuleGeometry(0.06, 0.40, 3, 6);

    const whiteBaseMat = () =>
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78, metalness: 0.04 });
    const pedLegsL = new THREE.InstancedMesh(legGeo, whiteBaseMat(), pedCount);
    const pedLegsR = new THREE.InstancedMesh(legGeo, whiteBaseMat(), pedCount);
    const pedTorso = new THREE.InstancedMesh(torsoGeo, whiteBaseMat(), pedCount);
    const pedHead = new THREE.InstancedMesh(headGeo, whiteBaseMat(), pedCount);
    const pedHair = new THREE.InstancedMesh(hairGeo, whiteBaseMat(), pedCount);
    const pedArm = new THREE.InstancedMesh(armGeo, whiteBaseMat(), pedCount * 2);

    const shirtPalette = [
      '#ef4444', '#38bdf8', '#f8fafc', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#0ea5e9',
    ].map((c) => new THREE.Color(c));
    const pantsPalette = ['#1e293b', '#334155', '#1d4ed8', '#475569', '#292524'].map(
      (c) => new THREE.Color(c),
    );
    const skinPalette = ['#f1c27d', '#e0ac69', '#c68642', '#ffdbac', '#8d5524'].map(
      (c) => new THREE.Color(c),
    );
    const hairPalette = ['#111827', '#3f2314', '#5c3a21', '#78350f', '#cbd5e1'].map(
      (c) => new THREE.Color(c),
    );

    for (let i = 0; i < pedCount; i++) {
      const shirt = shirtPalette[i % shirtPalette.length];
      const pants = pantsPalette[(i * 3) % pantsPalette.length];
      const skin = skinPalette[(i * 5) % skinPalette.length];
      const hair = hairPalette[(i * 2) % hairPalette.length];
      pedLegsL.setColorAt(i, pants);
      pedLegsR.setColorAt(i, pants);
      pedTorso.setColorAt(i, shirt);
      pedHead.setColorAt(i, skin);
      pedHair.setColorAt(i, hair);
      pedArm.setColorAt(i * 2, shirt);
      pedArm.setColorAt(i * 2 + 1, shirt);
    }

    [pedLegsL, pedLegsR, pedTorso, pedHead, pedHair, pedArm].forEach((im) => {
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      pedestrianGroup.add(im);
    });
    group.add(pedestrianGroup);

    // Vectores pre-alocados para 0 GC por frame
    const _m = new THREE.Matrix4();
    const _pos = new THREE.Vector3();
    const _quat = new THREE.Quaternion();
    const _euler = new THREE.Euler();
    const _scale = new THREE.Vector3();

    const applyPedestrianMatrices = (
      timeSec: number,
      focusZ: number,
      roadPath?: CurvedRoadPath,
      initializeAll = false,
    ) => {
      // Animar oleaje suave del Río Paraguay (albedo + normales cruzadas)
      riverWaterTex.offset.y = (timeSec * 0.018) % 1;
      riverNormalTex.offset.x = (timeSec * 0.014) % 1;
      riverNormalTex.offset.y = (timeSec * 0.026) % 1;
      riverBumpTex.offset.x = Math.sin(timeSec * 0.35) * 0.04;
      riverBumpTex.offset.y = (timeSec * 0.024) % 1;

      let updatedAny = false;
      for (let i = 0; i < pedCount; i++) {
        const p = pedestrians[i];
        const spanLen = Math.max(1, p.maxS - p.minS);
        const rawTravel = p.baseS - p.minS + p.dir * timeSec * p.speedMps;
        const cycle = ((rawTravel % (spanLen * 2)) + spanLen * 2) % (spanLen * 2);
        const currentS = cycle <= spanLen ? p.minS + cycle : p.maxS - (cycle - spanLen);
        const walkingForward = cycle <= spanLen;

        if (!initializeAll && Math.abs(currentS - focusZ) > 220) continue;
        updatedAny = true;

        const wp = roadPath
          ? roadPath.world(currentS, p.lateral)
          : { x: p.lateral, z: currentS, yaw: 0 };
        const headingYaw = wp.yaw + (walkingForward ? 0 : Math.PI);
        const sinY = Math.sin(headingYaw);
        const cosY = Math.cos(headingYaw);
        const rightX = cosY;
        const rightZ = -sinY;

        const stride = Math.sin(timeSec * p.speedMps * 4.4 + p.phase) * 0.34;
        const bob = Math.abs(Math.cos(timeSec * p.speedMps * 4.4 + p.phase)) * 0.025;
        const hs = p.heightScale;

        // Pierna izquierda y derecha con balanceo de caminata
        _scale.set(hs, hs, hs);
        _pos.set(
          wp.x - rightX * 0.10 + sinY * stride * 0.14,
          0.42 * hs + bob,
          wp.z - rightZ * 0.10 + cosY * stride * 0.14,
        );
        _euler.set(stride, headingYaw, 0, 'YXZ');
        _quat.setFromEuler(_euler);
        _m.compose(_pos, _quat, _scale);
        pedLegsL.setMatrixAt(i, _m);

        _pos.set(
          wp.x + rightX * 0.10 - sinY * stride * 0.14,
          0.42 * hs + bob,
          wp.z + rightZ * 0.10 - cosY * stride * 0.14,
        );
        _euler.set(-stride, headingYaw, 0, 'YXZ');
        _quat.setFromEuler(_euler);
        _m.compose(_pos, _quat, _scale);
        pedLegsR.setMatrixAt(i, _m);

        // Torso
        _pos.set(wp.x, 1.04 * hs + bob, wp.z);
        _euler.set(0, headingYaw, 0, 'YXZ');
        _quat.setFromEuler(_euler);
        _m.compose(_pos, _quat, _scale);
        pedTorso.setMatrixAt(i, _m);

        // Cabeza + cabello
        _pos.set(wp.x, 1.50 * hs + bob, wp.z);
        _m.compose(_pos, _quat, _scale);
        pedHead.setMatrixAt(i, _m);

        _pos.set(wp.x, 1.52 * hs + bob, wp.z);
        _m.compose(_pos, _quat, _scale);
        pedHair.setMatrixAt(i, _m);

        // Brazos oscilantes en contrafase
        _pos.set(
          wp.x - rightX * 0.24 - sinY * stride * 0.12,
          1.03 * hs + bob,
          wp.z - rightZ * 0.24 - cosY * stride * 0.12,
        );
        _euler.set(-stride * 0.85, headingYaw, 0, 'YXZ');
        _quat.setFromEuler(_euler);
        _m.compose(_pos, _quat, _scale);
        pedArm.setMatrixAt(i * 2, _m);

        _pos.set(
          wp.x + rightX * 0.24 + sinY * stride * 0.12,
          1.03 * hs + bob,
          wp.z + rightZ * 0.24 + cosY * stride * 0.12,
        );
        _euler.set(stride * 0.85, headingYaw, 0, 'YXZ');
        _quat.setFromEuler(_euler);
        _m.compose(_pos, _quat, _scale);
        pedArm.setMatrixAt(i * 2 + 1, _m);
      }

      if (updatedAny) {
        pedLegsL.instanceMatrix.needsUpdate = true;
        pedLegsR.instanceMatrix.needsUpdate = true;
        pedTorso.instanceMatrix.needsUpdate = true;
        pedHead.instanceMatrix.needsUpdate = true;
        pedHair.instanceMatrix.needsUpdate = true;
        pedArm.instanceMatrix.needsUpdate = true;
      }
    };

    group.userData.initPedestrians = (roadPath?: CurvedRoadPath) => {
      applyPedestrianMatrices(0, 0, roadPath, true);
    };
    group.userData.updateScenery = (
      timeSec: number,
      focusZ: number,
      roadPath?: CurvedRoadPath,
    ) => {
      applyPedestrianMatrices(timeSec, focusZ, roadPath, false);
    };
  }

  group.userData.datacarAdvertisements = { facade: adCount, streetFacing: 0 };

  // 10. NOMENCLADORES DE CALLES ASUNCENAS Y CARTELES DE LOMO DE BURRO
  const streetMatCache = new Map<string, THREE.MeshBasicMaterial>();
  const signMaterial = (lines: string[]) => {
    const key = lines.join('|');
    let sign = streetMatCache.get(key);
    if (!sign) {
      const texture = createCanvasSign(lines, '#0b1119', '#ffffff');
      generatedTextures.push(texture);
      sign = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      streetMatCache.set(key, sign);
    }
    return sign;
  };
  const paintRed = mat('#b82d32');
  const paintWhite = mat('#ecece5');
  for (const cross of crossings) {
    for (const side of [-1, 1]) {
      const signGroup = new THREE.Group();
      signGroup.name = `carteles_${cross.main}_${Math.round(cross.z)}`;
      signGroup.position.set(side * (halfRoad + 3.1), 0, cross.z - 8.7);
      for (let i = 0; i < 7; i++) {
        const segment = new THREE.Mesh(
          new THREE.CylinderGeometry(0.085, 0.085, 0.59, 6),
          i % 2 ? paintWhite : paintRed,
        );
        segment.position.set(0, 0.35 + i * 0.58, 0);
        signGroup.add(segment);
      }
      const main = new THREE.Mesh(
        new THREE.PlaneGeometry(2.65, 0.5),
        signMaterial([cross.main, '←']),
      );
      main.position.set(-side * 0.2, 3.37, 0);
      main.rotation.y = Math.PI;
      signGroup.add(main);
      const transverse = new THREE.Mesh(
        new THREE.PlaneGeometry(2.65, 0.5),
        signMaterial([cross.transverse, '→']),
      );
      transverse.position.set(-side * 0.2, 2.72, 0.025);
      transverse.rotation.y = Math.PI;
      signGroup.add(transverse);
      group.add(signGroup);
    }
  }
  for (const bump of streetDetails.speedBumps) {
    const warn = new THREE.Group();
    warn.name = `aviso_lomo_de_burro_${bump.id}`;
    warn.position.set(halfRoad + 2.3, 0, bump.z - 17);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.8, 6), metalMaterial);
    pole.position.y = 1.4;
    warn.add(pole);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.82),
      signMaterial(['LOMO DE BURRO', 'REDUCÍ VELOCIDAD']),
    );
    board.rotation.y = Math.PI;
    board.position.y = 2.35;
    warn.add(board);
    group.add(warn);
  }

  group.userData.disposeTextureMaps = () =>
    generatedTextures.forEach((texture) => texture.dispose());
  return group;
}

/**
 * Construye el complejo arquitectónico estilo Paseo La Galería sobre Av. Aviadores del Chaco:
 * - Dos torres corporativas gemelas curvas ("velas") en muro cortina azul cielo reflectivo
 *   con aletas estructurales azul marino y remate superior escalonado en 3 niveles vidriados.
 * - Podio comercial de 3 niveles recubierto de jardines verticales vivos y terrazas arboladas.
 * - Plaza central abierta ("Las Terrazas") con cubierta tensada octogonal blanca y pérgolas de madera.
 * - Hilera de palmeras imperiales frente a la vereda de Aviadores del Chaco.
 */
function createLoftedCurvedSailGeometry(
  heightM: number,
  side: -1 | 1,
  levels = 22,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // 4 esquinas por nivel: 0=(-X,-Z), 1=(+X,-Z), 2=(+X,+Z), 3=(-X,+Z), cerradas en anillo de 5 cols para UVs limpias
  for (let lvl = 0; lvl <= levels; lvl++) {
    const t = lvl / levels;
    const y = t * heightM;
    const curveShiftX = Math.sin(t * Math.PI * 0.94) * 2.85 * -side;
    const halfW = (15.0 - t * 1.25) * 0.5;
    const halfD = (11.6 - Math.sin(t * Math.PI) * 0.9) * 0.5;

    const ring: Array<[number, number, number]> = [
      [curveShiftX - halfD, y, -halfW],
      [curveShiftX + halfD, y, -halfW],
      [curveShiftX + halfD, y, halfW],
      [curveShiftX - halfD, y, halfW],
      [curveShiftX - halfD, y, -halfW],
    ];
    for (let c = 0; c < 5; c++) {
      positions.push(ring[c][0], ring[c][1], ring[c][2]);
      uvs.push(c, t * 3.2);
    }
  }

  for (let lvl = 0; lvl < levels; lvl++) {
    const rowA = lvl * 5;
    const rowB = (lvl + 1) * 5;
    for (let c = 0; c < 4; c++) {
      const a = rowA + c;
      const b = rowA + c + 1;
      const d = rowB + c;
      const e = rowB + c + 1;
      indices.push(a, b, e, a, e, d);
    }
  }
  // Tapa superior
  const topBase = levels * 5;
  indices.push(topBase, topBase + 2, topBase + 1, topBase, topBase + 3, topBase + 2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildPaseoLaGaleriaComplex(
  halfRoad: number,
  centerZ: number,
  side: -1 | 1,
  glassTex: THREE.Texture,
  grassTex: THREE.Texture,
): THREE.Group {
  const complex = new THREE.Group();
  complex.name = `complejo_paseo_la_galeria_${Math.round(centerZ)}`;

  const sailGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#67c6f5',
    map: glassTex,
    roughness: 0.065,
    metalness: 0.42,
    clearcoat: 0.96,
    clearcoatRoughness: 0.04,
    reflectivity: 0.98,
    envMapIntensity: 1.95,
  });
  const crownGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#0369a1',
    map: glassTex,
    roughness: 0.06,
    metalness: 0.48,
    clearcoat: 0.96,
    clearcoatRoughness: 0.04,
    envMapIntensity: 2.0,
  });
  const finNavyMat = new THREE.MeshPhysicalMaterial({
    color: '#082f49',
    roughness: 0.22,
    metalness: 0.78,
    clearcoat: 0.72,
    envMapIntensity: 1.45,
  });
  const greenWallMat = new THREE.MeshStandardMaterial({
    color: '#2e7d32',
    map: grassTex,
    roughness: 0.86,
    metalness: 0.02,
  });
  const whiteRoofMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.34,
    metalness: 0.08,
  });
  const woodPergolaMat = new THREE.MeshStandardMaterial({
    color: '#92400e',
    roughness: 0.72,
    metalness: 0.06,
  });
  const palmTrunkMat = new THREE.MeshStandardMaterial({
    color: '#78624c',
    roughness: 0.88,
  });
  const palmLeafMat = new THREE.MeshStandardMaterial({
    color: '#2f855a',
    roughness: 0.70,
    side: THREE.DoubleSide,
  });

  const baseOffsetX = side * (halfRoad + 22.5);
  const podiumFrontDepth = 18;
  const podiumSpanZ = 76;
  const podiumHeight = 10.2;

  const shoppingBack = new THREE.Mesh(
    new THREE.BoxGeometry(24, 12.6, podiumSpanZ * 0.94),
    whiteRoofMat,
  );
  shoppingBack.position.set(baseOffsetX + side * 19, 6.2, centerZ);
  complex.add(shoppingBack);

  for (const wingDir of [-1, 1]) {
    const greenWing = new THREE.Mesh(
      new THREE.BoxGeometry(podiumFrontDepth, podiumHeight, 24),
      greenWallMat,
    );
    greenWing.position.set(baseOffsetX, podiumHeight * 0.5 - 0.1, centerZ + wingDir * 24);
    complex.add(greenWing);

    // Arbustos volumétricos sobre muros vivos y borde de terraza jardín
    for (let g = -2; g <= 2; g++) {
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15, 1), greenWallMat);
      bush.position.set(
        baseOffsetX - side * (podiumFrontDepth * 0.5 + 0.15),
        4.2 + ((g + 2) % 2) * 2.4,
        centerZ + wingDir * 24 + g * 4.4,
      );
      bush.scale.set(0.55, 1.1, 1.3);
      complex.add(bush);
    }

    const roofGarden = new THREE.Mesh(
      new THREE.BoxGeometry(podiumFrontDepth - 1.4, 0.55, 22.4),
      greenWallMat,
    );
    roofGarden.position.set(baseOffsetX, podiumHeight + 0.25, centerZ + wingDir * 24);
    complex.add(roofGarden);

    for (let b = -3; b <= 3; b++) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(podiumFrontDepth * 0.78, 0.28, 0.42),
        woodPergolaMat,
      );
      beam.position.set(baseOffsetX + side * 1.2, podiumHeight + 2.4, centerZ + wingDir * 24 + b * 1.6);
      complex.add(beam);
    }
  }

  // Cubierta blanca octogonal sobre "Las Terrazas"
  const canopyRadius = 11.4;
  const centralCanopy = new THREE.Mesh(
    new THREE.CylinderGeometry(canopyRadius, canopyRadius * 0.92, 0.75, 8),
    whiteRoofMat,
  );
  centralCanopy.position.set(baseOffsetX + side * 1.5, 9.6, centerZ);
  complex.add(centralCanopy);

  const canopySkylightRing = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 0.92, 8),
    finNavyMat,
  );
  canopySkylightRing.position.set(baseOffsetX + side * 1.5, 9.75, centerZ);
  complex.add(canopySkylightRing);

  const plazaPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.75, 9.4, 8),
    whiteRoofMat,
  );
  plazaPillar.position.set(baseOffsetX + side * 1.5, 4.7, centerZ);
  complex.add(plazaPillar);

  // Dos Torres Corporativas Gemelas Curvas continuas ("Velas" de cristal celeste + aleta marina + 3 coronamientos)
  const towerConfigs = [
    { zOffset: -19.5, totalHeight: 55, yawTilt: side * 0.14 },
    { zOffset: 19.5, totalHeight: 50, yawTilt: -side * 0.11 },
  ];

  for (const tc of towerConfigs) {
    const towerGroup = new THREE.Group();
    const towerX = baseOffsetX - side * 2.2;
    const towerZ = centerZ + tc.zOffset;
    const mainBodyH = tc.totalHeight - 8.5;

    const smoothSailMesh = new THREE.Mesh(
      createLoftedCurvedSailGeometry(mainBodyH, side, 22),
      sailGlassMat,
    );
    towerGroup.add(smoothSailMesh);

    // Aleta vertical estructural azul marino siguiendo la curva lateral de la vela
    const finSlices = 14;
    const finSliceH = mainBodyH / finSlices;
    for (let s = 0; s < finSlices; s++) {
      const frac = (s + 0.5) / finSlices;
      const sailShift = Math.sin(frac * Math.PI * 0.94) * 2.85 * -side;
      const sliceWidthZ = 15.0 - frac * 1.25;
      const sliceDepthX = 11.6 - Math.sin(frac * Math.PI) * 0.9;
      const finMesh = new THREE.Mesh(
        new THREE.BoxGeometry(sliceDepthX + 0.75, finSliceH + 0.12, 1.35),
        finNavyMat,
      );
      finMesh.position.set(
        sailShift + side * 0.35,
        s * finSliceH + finSliceH * 0.5,
        tc.zOffset < 0 ? sliceWidthZ * 0.5 + 0.38 : -sliceWidthZ * 0.5 - 0.38,
      );
      towerGroup.add(finMesh);
    }

    // Remate superior icónico de 3 niveles horizontales escalonados de vidrio azul profundo
    for (let tier = 0; tier < 3; tier++) {
      const tierH = 2.75;
      const tierY = mainBodyH + tier * tierH + tierH * 0.5;
      const setbackZ = tier * 1.65;
      const setbackX = tier * 0.95;
      const crownTier = new THREE.Mesh(
        new THREE.BoxGeometry(10.6 - setbackX, tierH - 0.10, 13.7 - setbackZ),
        crownGlassMat,
      );
      crownTier.position.set(-side * (1.2 - tier * 0.35), tierY, (tc.zOffset < 0 ? -1 : 1) * tier * 0.45);
      towerGroup.add(crownTier);
    }

    towerGroup.position.set(towerX, 0, towerZ);
    towerGroup.rotation.y = tc.yawTilt;
    complex.add(towerGroup);
  }

  // Palmeras imperiales con hojas arqueadas frente a Av. Aviadores del Chaco
  const palmFrontX = side * (halfRoad + 8.6);
  for (let p = -3; p <= 3; p++) {
    const pz = centerZ + p * 10.5;
    const palmH = 7.0 + (Math.abs(p) % 2) * 1.2;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.25, palmH, 8),
      palmTrunkMat,
    );
    trunk.position.set(palmFrontX, palmH * 0.5, pz);
    complex.add(trunk);

    for (let frond = 0; frond < 8; frond++) {
      const angle = (frond / 8) * Math.PI * 2;
      for (const seg of [0, 1]) {
        const dist = seg === 0 ? 0.85 : 1.95;
        const dropY = seg === 0 ? 0.08 : -0.42;
        const pitch = seg === 0 ? 0.22 : 0.68;
        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(0.42 - seg * 0.12, 0.06, 1.35),
          palmLeafMat,
        );
        leaf.position.set(
          palmFrontX + Math.sin(angle) * dist,
          palmH + dropY,
          pz + Math.cos(angle) * dist,
        );
        leaf.rotation.order = 'YXZ';
        leaf.rotation.y = angle;
        leaf.rotation.x = pitch;
        complex.add(leaf);
      }
    }
  }

  return complex;
}

function createRiverNormalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const u = (x / 256) * Math.PI * 2;
        const v = (y / 256) * Math.PI * 2;
        const dx =
          Math.cos(u * 4 + v * 2) * 0.45 +
          Math.cos(u * 9 - v * 5) * 0.28 +
          Math.cos(u * 15 + v * 11) * 0.16;
        const dy =
          Math.sin(v * 6 + u * 2) * 0.45 +
          Math.sin(v * 11 - u * 4) * 0.28 +
          Math.sin(v * 17 + u * 7) * 0.16;
        const idx = (y * 256 + x) * 4;
        img.data[idx] = Math.round(Math.max(0, Math.min(255, 128 + dx * 65)));
        img.data[idx + 1] = Math.round(Math.max(0, Math.min(255, 128 + dy * 65)));
        img.data[idx + 2] = 238;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  return new THREE.CanvasTexture(canvas);
}

function createGrassTurfTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#4c8549';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2400; i++) {
      const x = (i * 73.17) % 256;
      const y = (i * 129.83) % 256;
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(34, 72, 36, 0.28)'
          : i % 3 === 1
            ? 'rgba(116, 179, 89, 0.24)'
            : 'rgba(62, 108, 52, 0.22)';
      ctx.fillRect(x, y, 2, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRiverWaterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, '#12536e');
    g.addColorStop(0.5, '#1d6f8f');
    g.addColorStop(1, '#145875');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 420; i++) {
      const x = (i * 97.3) % 512;
      const y = (i * 53.7) % 512;
      const w = 22 + (i % 45);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(186, 230, 253, 0.12)' : 'rgba(12, 74, 110, 0.18)';
      ctx.fillRect(x, y, w, 3);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRiverBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 6) {
      const v = Math.round(128 + Math.sin((y / 256) * Math.PI * 12) * 48);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, y, 256, 3);
    }
  }
  return new THREE.CanvasTexture(canvas);
}

function createGlassTowerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 8; col++) {
        const x = 6 + col * 63;
        const y = 5 + row * 31;
        const lit = (row * 7 + col * 3) % 5 === 0;
        const grad = ctx.createLinearGradient(x, y, x + 54, y + 24);
        grad.addColorStop(0, lit ? '#bae6fd' : '#386688');
        grad.addColorStop(1, lit ? '#7dd3fc' : '#1d3a52');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, 54, 24);
      }
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, row * 31 + 29, 512, 3);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

function createCanvasSign(lines: string[], bg: string, border: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = border;
    ctx.lineWidth = 9;
    ctx.strokeRect(10, 10, 1004, 236);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, index) => {
      const fontSize = line.length > 23 ? 40 : line.length > 16 ? 52 : 64;
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(line, 512, lines.length === 1 ? 132 : index === 0 ? 86 : 174, 955);
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function createAdvertisingTexture(brand: string, slogan: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1536;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#061525';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#09c8ee';
    ctx.fillRect(0, 0, canvas.width, 22);
    ctx.fillStyle = '#eafaff';
    ctx.fillRect(36, 42, 12, 414);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 138px Arial, sans-serif';
    ctx.fillText(brand, 784, 210, 1410);
    ctx.font = 'bold 61px Arial, sans-serif';
    ctx.fillStyle = '#46dafa';
    ctx.fillText(slogan, 784, 358, 1410);
    ctx.fillStyle = '#09c8ee';
    ctx.fillRect(0, 486, canvas.width, 26);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createUrbanFacadeTexture(variant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const colors = ['#b7b5b0', '#aaa59c', '#aa9e95', '#9aa6b2'];
  if (ctx) {
    ctx.fillStyle = colors[variant % colors.length];
    ctx.fillRect(0, 0, 512, 512);
    for (let n = 0; n < 1900; n++) {
      const x = (n * 137.31) % 512;
      const y = (n * 91.43) % 512;
      ctx.fillStyle = n % 3 ? 'rgba(48,46,41,.055)' : 'rgba(245,241,232,.10)';
      ctx.fillRect(x, y, 1 + (n % 5), 2 + (n % 4));
    }
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const x = 30 + col * 164;
        const y = 22 + row * 98;
        ctx.fillStyle = '#69645f';
        ctx.fillRect(x - 6, y - 5, 109, 78);
        ctx.fillStyle = variant === 1 ? '#5a7380' : '#4f6878';
        ctx.fillRect(x, y, 97, 64);
        const grad = ctx.createLinearGradient(x, y, x + 97, y + 64);
        grad.addColorStop(0, 'rgba(199,216,223,.47)');
        grad.addColorStop(0.45, 'rgba(116,136,149,.04)');
        grad.addColorStop(1, 'rgba(12,24,34,.35)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, 97, 64);
        ctx.fillStyle = '#d0cdc5';
        ctx.fillRect(x + 46, y, 4, 64);
        ctx.fillRect(x, y + 32, 97, 3);
        ctx.fillStyle = '#8e8880';
        ctx.fillRect(x - 11, y + 67, 120, 6);
        if ((row + col + variant) % 4 === 0) {
          ctx.fillStyle = '#e0ded9';
          ctx.fillRect(x + 52, y + 70, 30, 12);
          ctx.fillStyle = '#707478';
          ctx.fillRect(x + 58, y + 72, 14, 7);
        }
      }
    }
    ctx.fillStyle = 'rgba(35,30,28,.13)';
    for (let i = 0; i < 6; i++) ctx.fillRect(0, i * 98 + 92, 512, 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

import * as THREE from 'three';
import { getAsuncionStreetDetails } from './asuncionStreetData.ts';

/**
 * Entorno estilizado de Asunción. No reproduce calles ni edificios reales.
 * Emplea InstancedMesh para no multiplicar las llamadas de dibujo al añadir
 * edificios, árboles, señales y marcas de carril a un escenario con GLB densos.
 */
export function createUrbanTrackScenery(
  roadWidth: number,
  trackLength: number,
  profile: string | undefined,
  isCityCircuit: boolean,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'asuncion_roadside_environment';
  const end = Math.min(trackLength, isCityCircuit ? 3700 : 1600);
  const mid = end / 2 - 20;
  const halfRoad = roadWidth / 2;
  const wet = profile === 'flood';
  const streetDetails = isCityCircuit ? getAsuncionStreetDetails(profile, Math.max(100, trackLength - 120)) : { crossings: [], speedBumps: [] };
  const crossings = streetDetails.crossings;
  const historical = profile === 'cobbles' || profile === 'chains';
  const mat = (color: string, roughness = 0.95) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  const groundMaterial = mat(historical ? '#777468' : wet ? '#52636b' : '#617166');
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, end), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.32, mid); // Permitir ver el fondo real (-17 cm) de los baches excavados.
  group.add(ground);

  // Veredas cortadas en intersecciones: la calle transversal queda libre.
  const sidewalkMaterial = mat(historical ? '#a4a39b' : '#9ca3a7');
  const curbMaterial = mat('#c9c8c2');
  const interruptions = crossings.map(c => ({ from: c.z - 5.7, to: c.z + 5.7 })).sort((a, b) => a.from - b.from);
  const spans: { from: number; to: number }[] = [];
  let sectionStart = -20;
  for (const interruption of interruptions) {
    if (interruption.from > sectionStart) spans.push({ from: sectionStart, to: interruption.from });
    sectionStart = Math.max(sectionStart, interruption.to);
  }
  if (sectionStart < end - 20) spans.push({ from: sectionStart, to: end - 20 });
  for (const span of spans) for (const side of [-1, 1]) {
    const length = span.to - span.from;
    if (length < .1) continue;
    const walk = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.16, length), sidewalkMaterial);
    walk.position.set(side * (halfRoad + 2.1), -0.055, (span.from + span.to) / 2);
    group.add(walk);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.20, length), curbMaterial);
    curb.position.set(side * (halfRoad + 0.74), 0.005, (span.from + span.to) / 2);
    group.add(curb);
  }

  // Marcas de carril: un InstancedMesh para cientos de guiones.
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: '#e8e8df', transparent: true, opacity: 0.77, depthWrite: false });
  const dashLength = 2.7;
  const gapLength = 5.8;
  const usableLength = Math.max(0, end - 20);
  const dashPerLane = Math.ceil(usableLength / (dashLength + gapLength));
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.10, dashLength), stripeMaterial, dashPerLane * 2);
  dashes.name = 'lane_markings';
  const dummy = new THREE.Object3D();
  for (let i = 0; i < dashPerLane; i++) {
    const z = i * (dashLength + gapLength) - 14;
    for (let lane = 0; lane < 2; lane++) {
      dummy.position.set(lane === 0 ? -1.8 : 1.8, 0.028, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(crossings.some(c => Math.abs(c.z - z) < 8.5) ? 0 : 1, 1, 1);
      dummy.updateMatrix();
      dashes.setMatrixAt(i * 2 + lane, dummy.matrix);
    }
  }
  dashes.instanceMatrix.needsUpdate = true;
  dashes.frustumCulled = false;
  group.add(dashes);
  // Los bordes de carril terminan antes de cada cruce.
  for (const span of spans) for (const side of [-1, 1]) {
    const length = span.to - span.from;
    if (length <= .1) continue;
    const edgeLine = new THREE.Mesh(new THREE.PlaneGeometry(0.13, length), stripeMaterial);
    edgeLine.rotation.x = -Math.PI / 2;
    edgeLine.position.set(side * (halfRoad - .46), .027, (span.from + span.to) / 2);
    group.add(edgeLine);
  }
  if (!isCityCircuit) return group;

  // Cruces perpendiculares reales en la escena 3D, con pasos peatonales.
  // Son elementos de ambientación: la conducción todavía sigue el eje principal.
  const crossAsphalt = mat(wet ? '#454f54' : '#34383b');
  const crossingMaterial = new THREE.MeshBasicMaterial({ color: '#e4e1d5', transparent: true, opacity: .85, depthWrite: false });
  const crosswalks = new THREE.InstancedMesh(new THREE.PlaneGeometry(.58, 2.1), crossingMaterial, crossings.length * 2 * 13);
  let stripeId = 0;
  const crossDummy = new THREE.Object3D();
  for (const cross of crossings) {
    const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(76, 10.8), crossAsphalt);
    crossRoad.rotation.x = -Math.PI / 2;
    crossRoad.position.set(0, .012, cross.z);
    crossRoad.name = `interseccion_3d_${Math.round(cross.z)}`;
    group.add(crossRoad);
    for (const dz of [-7.1, 7.1]) for (let i = 0; i < 13; i++) {
      crossDummy.rotation.set(-Math.PI / 2, 0, 0);
      crossDummy.position.set(-5.6 + i * .93, .034, cross.z + dz);
      crossDummy.scale.set(1, 1, 1);
      crossDummy.updateMatrix();
      crosswalks.setMatrixAt(stripeId++, crossDummy.matrix);
    }
  }
  crosswalks.count = stripeId;
  crosswalks.instanceMatrix.needsUpdate = true;
  group.add(crosswalks);


  // RNG determinista: los edificios y árboles no cambian tras reiniciar carrera.
  let seed = Array.from(profile ?? 'asuncion').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 1729);
  const rng = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const approxBlocksPerSide = Math.ceil(end / 58);
  const bldCount = approxBlocksPerSide * 2;
  const facadeMaterials = [mat('#89939c'), mat('#b3ad9f'), mat('#958e87')];
  const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMeshes = facadeMaterials.map(material => new THREE.InstancedMesh(buildingGeometry, material, bldCount));
  const buildingCounters = [0, 0, 0];
  const windowMaterial = new THREE.MeshBasicMaterial({ color: '#60798e', transparent: true, opacity: 0.72 });
  const windowMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), windowMaterial, bldCount * 3);
  let windowIndex = 0;
  const generatedTextures: THREE.Texture[] = [];
  // Fachadas con ventanas, balcones y desgaste PBR reutilizadas por instancias.
  facadeMaterials.forEach((material, i) => {
    const tex = createUrbanFacadeTexture(i);
    generatedTextures.push(tex);
    material.map = tex;
    material.roughness = .82;
    material.needsUpdate = true;
  });
  // V7.9: carteles de alto contraste, orientados hacia la cámara de conducción.
  // En V7.8 solo había letreros pequeños pegados a fachadas laterales y cada
  // 8 cuadras: desde una cámara de persecución resultaban casi invisibles.
  const adTextures = [
    createAdvertisingTexture('DATACARPY.COM', 'LOS AUTOS REALES ESTÁN ACÁ'),
    createAdvertisingTexture('DATACARPY.COM', 'DEL JUEGO A LA CALLE'),
    createAdvertisingTexture('DATACARPY.COM', 'ENCONTRÁ TU PRÓXIMO AUTO'),
  ];
  generatedTextures.push(...adTextures);
  const adMats = adTextures.map(map => new THREE.MeshBasicMaterial({
    map, side: THREE.DoubleSide, depthWrite: true, toneMapped: false,
  }));
  const adFrameMat = new THREE.MeshStandardMaterial({ color: '#071525', roughness: .6, metalness: .12 });
  const adPoleMat = new THREE.MeshStandardMaterial({ color: '#56616c', roughness: .6, metalness: .35 });
  let adCount = 0;
  for (let block = 0; block < approxBlocksPerSide; block++) {
    for (const side of [-1, 1]) {
      const laneZ = block * 58 - 7 + rng() * 7;
      // No poner edificios encima de las calles transversales.
      if (crossings.some(c => Math.abs(c.z - laneZ) < 17)) continue;
      const height = 5 + rng() * (historical ? 10 : 18);
      const width = 7 + rng() * 7;
      const depth = 8 + rng() * 7;
      const x = side * (halfRoad + 8.6 + depth / 3 + rng() * 3);
      const materialIndex = Math.floor(rng() * facadeMaterials.length);
      dummy.position.set(x, height / 2 - 0.10, laneZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(depth, height, width);
      dummy.updateMatrix();
      buildingMeshes[materialIndex].setMatrixAt(buildingCounters[materialIndex]++, dummy.matrix);
      // V7.9: anuncios instalados en la pared transversal de los edificios.
      // Esa pared mira hacia el vehículo que se aproxima por +Z, a diferencia
      // de una fachada paralela al avance, que se veía de canto en V7.8.
      if (block % 3 === 1 && height > 7.4 && adCount < 16) {
        const panelWidth = Math.min(6.9, depth - 0.7);
        const panelHeight = 1.65;
        const panelX = x - side * depth * .10;
        const panelZ = laneZ - width / 2 - .14;
        const panelY = Math.min(height - 1.45, 4.8);
        const back = new THREE.Mesh(new THREE.BoxGeometry(panelWidth + .05, panelHeight + .05, .025), adFrameMat);
        back.position.set(panelX, panelY, panelZ + .018);
        back.name = `marco_publicidad_datacar_fachada_${adCount}`;
        group.add(back);
        const board = new THREE.Mesh(new THREE.PlaneGeometry(panelWidth, panelHeight), adMats[adCount % adMats.length]);
        board.rotation.y = Math.PI; // Frente visible para quien conduce en +Z.
        board.position.set(panelX, panelY, panelZ - .025);
        board.name = `publicidad_datacarpy_com_fachada_${adCount++}`;
        group.add(board);
      }
      // Oscuros paños de ventanas, sobre la fachada dirigida al asfalto.
      const facadeX = x - side * (depth / 2 + 0.013);
      for (let f = 0; f < 3; f++) {
        dummy.position.set(facadeX, Math.max(1.35, height * (0.3 + f * 0.20)), laneZ);
        dummy.rotation.set(0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0);
        dummy.scale.set(Math.min(4.6, width - 1.8), 0.66, 1);
        dummy.updateMatrix();
        windowMesh.setMatrixAt(windowIndex++, dummy.matrix);
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
  windowMesh.count = windowIndex;
  windowMesh.instanceMatrix.needsUpdate = true;
  windowMesh.frustumCulled = false;
  group.add(windowMesh);

  const lampCountPerSide = Math.ceil(end / 56);
  const totalLamps = lampCountPerSide * 2;
  const poleGeometry = new THREE.CylinderGeometry(0.062, 0.10, 6.1, 6);
  const metalMaterial = mat('#59626a', .57);
  const lampPosts = new THREE.InstancedMesh(poleGeometry, metalMaterial, totalLamps);
  const fixture = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, .13, .34), mat('#d2d4ce', .42), totalLamps);
  let lampIdx = 0;
  for (let p = 0; p < lampCountPerSide; p++) for (const side of [-1, 1]) {
    const z = p * 56 - 8;
    const x = side * (halfRoad + 2.95);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.position.set(x, 3.02, z);
    dummy.updateMatrix();
    lampPosts.setMatrixAt(lampIdx, dummy.matrix);
    dummy.position.set(x - side * .46, 6.0, z);
    dummy.updateMatrix();
    fixture.setMatrixAt(lampIdx, dummy.matrix);
    lampIdx++;
  }
  lampPosts.instanceMatrix.needsUpdate = true;
  fixture.instanceMatrix.needsUpdate = true;
  lampPosts.frustumCulled = false;
  fixture.frustumCulled = false;
  group.add(lampPosts, fixture);

  // Cables aéreos estilizados: referencia visual del tendido urbano asunceno.
  // Líneas muy livianas, por encima de la altura de los vehículos.
  const cablePoints: number[] = [];
  for (const side of [-1, 1]) {
    const x = side * (halfRoad + 3.15);
    for (let i = 0; i < lampCountPerSide - 1; i++) {
      const startZ = i * 56 - 8;
      const endZ = (i + 1) * 56 - 8;
      for (let k = 0; k < 5; k++) {
        const t0 = k / 5;
        const t1 = (k + 1) / 5;
        const sag0 = Math.sin(Math.PI * t0) * .22;
        const sag1 = Math.sin(Math.PI * t1) * .22;
        cablePoints.push(x, 6.4 - sag0, startZ + (endZ - startZ) * t0,
          x, 6.4 - sag1, startZ + (endZ - startZ) * t1);
      }
    }
  }
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cablePoints, 3));
  const wires = new THREE.LineSegments(wireGeometry, new THREE.LineBasicMaterial({ color: '#292f32', transparent: true, opacity: .8 }));
  wires.name = 'cableado_aereo_asuncion';
  group.add(wires);

  // Árboles simples: dos draw calls en lugar de geometría individual por árbol.
  const treeCount = Math.floor(end / 70) * 2;
  if (treeCount > 0) {
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .17, 2.4, 6), mat('#625248'), treeCount);
    const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.35, 0), mat('#3f7050'), treeCount);
    for (let i = 0; i < treeCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = Math.floor(i / 2) * 70 + 26;
      const x = side * (halfRoad + 4.2);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(x, 1.15, z);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 3.05, z);
      dummy.scale.set(1, 1.20, 1);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    trunks.frustumCulled = false;
    leaves.frustumCulled = false;
    group.add(trunks, leaves);
  }
  // V8: anuncios integrados exclusivamente en las fachadas.
  // Se eliminaron las vallas en postes que tapaban el entorno urbano.
  group.userData.datacarAdvertisements = { facade: adCount, streetFacing: 0 };

  // Señales estilo Asunción: fondo negro, borde blanco, postes rojo/blanco.
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
      signGroup.position.set(side * (halfRoad + 3.3), 0, cross.z - 8.7);
      for (let i = 0; i < 7; i++) {
        const segment = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, .59, 6), i % 2 ? paintWhite : paintRed);
        segment.position.set(0, .35 + i * .58, 0);
        signGroup.add(segment);
      }
      const main = new THREE.Mesh(new THREE.PlaneGeometry(2.65, .50), signMaterial([cross.main, '←']));
      main.position.set(-side * .20, 3.37, 0);
      main.rotation.y = Math.PI;
      signGroup.add(main);
      const transverse = new THREE.Mesh(new THREE.PlaneGeometry(2.65, .50), signMaterial([cross.transverse, '→']));
      transverse.position.set(-side * .20, 2.72, .025);
      transverse.rotation.y = Math.PI;
      signGroup.add(transverse);
      group.add(signGroup);
    }
  }
  for (const bump of streetDetails.speedBumps) {
    const warn = new THREE.Group();
    warn.name = `aviso_lomo_de_burro_${bump.id}`;
    warn.position.set(halfRoad + 2.3, 0, bump.z - 17);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, 2.8, 6), metalMaterial);
    pole.position.y = 1.40;
    warn.add(pole);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .82), signMaterial(['LOMO DE BURRO', 'REDUCÍ VELOCIDAD']));
    board.rotation.y = Math.PI;
    board.position.y = 2.35;
    warn.add(board);
    group.add(warn);
  }
  group.userData.disposeTextureMaps = () => generatedTextures.forEach(texture => texture.dispose());
  return group;
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


/** Textura legible en movimiento: jerarquía visual grande y dominio sin adornos. */
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


/** Textura repetible de fachada asuncena: arquitectura urbana estilizada con
 * ventanas, persianas, manchas y unidades de aire acondicionado.
 * No replica edificios reales ni usa imágenes de terceros.
 */
function createUrbanFacadeTexture(variant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const colors = ['#b7b5b0', '#aaa59c', '#aa9e95'];
  if (ctx) {
    ctx.fillStyle = colors[variant % colors.length]; ctx.fillRect(0, 0, 512, 512);
    for (let n = 0; n < 1900; n++) {
      const x = ((n * 137.31) % 512), y = ((n * 91.43) % 512);
      ctx.fillStyle = n % 3 ? 'rgba(48,46,41,.055)' : 'rgba(245,241,232,.10)';
      ctx.fillRect(x, y, 1 + n % 5, 2 + n % 4);
    }
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
      const x = 30 + col * 164, y = 22 + row * 98;
      ctx.fillStyle = '#69645f'; ctx.fillRect(x - 6, y - 5, 109, 78);
      ctx.fillStyle = variant === 1 ? '#5a7380' : '#4f6878'; ctx.fillRect(x, y, 97, 64);
      const grad = ctx.createLinearGradient(x, y, x + 97, y + 64);
      grad.addColorStop(0, 'rgba(199,216,223,.47)'); grad.addColorStop(.45, 'rgba(116,136,149,.04)');
      grad.addColorStop(1, 'rgba(12,24,34,.35)');
      ctx.fillStyle = grad; ctx.fillRect(x, y, 97, 64);
      ctx.fillStyle = '#d0cdc5'; ctx.fillRect(x + 46, y, 4, 64); ctx.fillRect(x, y + 32, 97, 3);
      ctx.fillStyle = '#8e8880'; ctx.fillRect(x - 11, y + 67, 120, 6);
      if ((row + col + variant) % 4 === 0) {
        ctx.fillStyle = '#e0ded9'; ctx.fillRect(x + 52, y + 70, 30, 12);
        ctx.fillStyle = '#707478'; ctx.fillRect(x + 58, y + 72, 14, 7);
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

import * as THREE from 'three';

export interface VehicleVisualProps {
  color: string;
  category: string;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
}

/**
 * Genera un modelo 3D detallado de alta fidelidad con proporciones reales de SUV / Crossover
 * (chasis esculpido, cristales oscurecidos, faros con ópticas LED, parrilla, ruedas de aleación con frenos y techo panorámico).
 */
export function buildProceduralVehicleMesh(props: VehicleVisualProps): {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  paintMaterial: THREE.MeshPhysicalMaterial;
} {
  const group = new THREE.Group();

  // Escala normalizada a metros (largo ~4.4m, ancho ~1.8m, alto ~1.6m)
  const l = (props.lengthMm || 4400) / 1000;
  const w = (props.widthMm || 1800) / 1000;
  const h = (props.heightMm || 1620) / 1000;

  // Material de pintura automotriz multicapa PBR con laca transparente (Clearcoat)
  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(props.color),
    metalness: 0.72,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  // Material de cristales oscurecidos
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0a111e'),
    metalness: 0.1,
    roughness: 0.1,
    transmission: 0.75,
    transparent: true,
    opacity: 0.88,
    ior: 1.52,
  });

  // Material de molduras y bajos en plástico negro mate texturizado (SUV cladding)
  const plasticCladdingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#161c26'),
    roughness: 0.85,
    metalness: 0.05,
  });

  // Material de llantas y cromados
  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#cbd5e1'),
    metalness: 0.9,
    roughness: 0.2,
  });

  // Material de neumáticos de goma
  const tireMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0f172a'),
    roughness: 0.85,
    metalness: 0.05,
  });

  // 1. Chasis Inferior (Bajo y faldones)
  const lowerBodyGeo = new THREE.BoxGeometry(l * 0.92, h * 0.35, w * 0.94);
  const lowerBody = new THREE.Mesh(lowerBodyGeo, plasticCladdingMat);
  lowerBody.position.y = h * 0.25;
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  group.add(lowerBody);

  // 2. Carrocería Principal Esculpida
  // Creamos un shape extruido con perfil aerodinámico de SUV moderna
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-l * 0.46, 0);
  bodyShape.lineTo(l * 0.44, 0);
  bodyShape.lineTo(l * 0.46, h * 0.28);
  bodyShape.lineTo(l * 0.28, h * 0.35); // Capó frontal
  bodyShape.lineTo(l * 0.12, h * 0.65); // Parabrisas delantero inclinado
  bodyShape.lineTo(-l * 0.24, h * 0.66); // Techo
  bodyShape.lineTo(-l * 0.42, h * 0.36); // Luneta trasera
  bodyShape.lineTo(-l * 0.46, h * 0.25);
  bodyShape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 2,
    depth: w * 0.9,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 4,
  };

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
  bodyGeo.center();
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMaterial);
  bodyMesh.position.y = h * 0.48;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 3. Invernadero / Cabina de Cristales (Parabrisas, ventanillas y luneta)
  const cabinGeo = new THREE.BoxGeometry(l * 0.52, h * 0.32, w * 0.84);
  const cabin = new THREE.Mesh(cabinGeo, glassMaterial);
  cabin.position.set(-l * 0.04, h * 0.64, 0);
  group.add(cabin);

  // Techo y barras de techo (Roof rails)
  const roofGeo = new THREE.BoxGeometry(l * 0.48, 0.03, w * 0.78);
  const roof = new THREE.Mesh(roofGeo, paintMaterial);
  roof.position.set(-l * 0.04, h * 0.81, 0);
  group.add(roof);

  const railGeo = new THREE.CylinderGeometry(0.015, 0.015, l * 0.42);
  const railLeft = new THREE.Mesh(railGeo, chromeMaterial);
  railLeft.rotation.z = Math.PI / 2;
  railLeft.position.set(-l * 0.04, h * 0.84, w * 0.36);
  group.add(railLeft);

  const railRight = railLeft.clone();
  railRight.position.z = -w * 0.36;
  group.add(railRight);

  // 4. Parrilla Delantera y Ópticas LED
  const grilleGeo = new THREE.BoxGeometry(0.06, h * 0.2, w * 0.65);
  const grille = new THREE.Mesh(grilleGeo, plasticCladdingMat);
  grille.position.set(l * 0.46, h * 0.32, 0);
  group.add(grille);

  const headlightMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd });
  const headlightGeo = new THREE.BoxGeometry(0.08, 0.07, 0.16);
  const headlightL = new THREE.Mesh(headlightGeo, headlightMat);
  headlightL.position.set(l * 0.45, h * 0.4, w * 0.34);
  group.add(headlightL);

  const headlightR = headlightL.clone();
  headlightR.position.z = -w * 0.34;
  group.add(headlightR);

  // Ópticas traseras rojas
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const taillightGeo = new THREE.BoxGeometry(0.06, 0.06, 0.18);
  const taillightL = new THREE.Mesh(taillightGeo, taillightMat);
  taillightL.position.set(-l * 0.46, h * 0.38, w * 0.35);
  group.add(taillightL);

  const taillightR = taillightL.clone();
  taillightR.position.z = -w * 0.35;
  group.add(taillightR);

  // 5. Ruedas de Aleación Deportivas con Neumáticos y Pinzas de Freno
  const wheelRadius = h * 0.22;
  const wheelWidth = 0.22;
  const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
  tireGeo.rotateZ(Math.PI / 2);

  const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth * 1.05, 16);
  rimGeo.rotateZ(Math.PI / 2);

  const brakeDiscGeo = new THREE.CylinderGeometry(wheelRadius * 0.5, wheelRadius * 0.5, 0.04, 16);
  brakeDiscGeo.rotateZ(Math.PI / 2);

  const wheelPositions = [
    { x: l * 0.28, z: w * 0.46 }, // Delantera Derecha
    { x: l * 0.28, z: -w * 0.46 },// Delantera Izquierda
    { x: -l * 0.28, z: w * 0.46 },// Trasera Derecha
    { x: -l * 0.28, z: -w * 0.46 },// Trasera Izquierda
  ];

  wheelPositions.forEach((pos) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(pos.x, wheelRadius * 0.95, pos.z);

    const tire = new THREE.Mesh(tireGeo, tireMaterial);
    tire.castShadow = true;
    wheelGroup.add(tire);

    const rim = new THREE.Mesh(rimGeo, chromeMaterial);
    wheelGroup.add(rim);

    const disc = new THREE.Mesh(brakeDiscGeo, chromeMaterial);
    wheelGroup.add(disc);

    group.add(wheelGroup);
  });

  return { group, bodyMesh, paintMaterial };
}

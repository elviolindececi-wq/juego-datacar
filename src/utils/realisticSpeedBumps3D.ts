import * as THREE from 'three';
import type { SpeedBump } from './asuncionStreetData.ts';

/** Lomo de burro suavizado en 3D. La física se maneja en InteractiveRacePhysics. */
export function createSpeedBumps3D(roadWidth: number, bumps: SpeedBump[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lomos_de_burro_asuncion';
  const asphalt = new THREE.MeshStandardMaterial({ color: '#292d31', roughness: .97 });
  const yellow = new THREE.MeshBasicMaterial({ color: '#f1c849', side: THREE.DoubleSide });
  const shadow = new THREE.MeshBasicMaterial({ color: '#060b0d', transparent: true, opacity: .24, depthWrite: false });
  for (const bump of bumps) {
    const sectionCount = 16;
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= sectionCount; i++) {
      const t = i / sectionCount;
      const z = bump.z + (t - .5) * bump.length;
      const h = Math.max(0, bump.height * Math.sin(Math.PI * t));
      vertices.push(-roadWidth / 2 + .34, .011 + h, z, roadWidth / 2 - .34, .011 + h, z);
      if (i < sectionCount) {
        const n = i * 2;
        indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    const surface = new THREE.Mesh(geom, asphalt);
    surface.name = `lomo_de_burro_${bump.id}`;
    group.add(surface);
    // Una única malla para todas las franjas (menos draw calls por lomo).
    const paintVertices: number[] = [];
    const paintIndices: number[] = [];
    for (let i = 0; i < 8; i++) {
      const x = -roadWidth / 2 + .9 + i * ((roadWidth - 1.8) / 7);
      const stripVerts: number[] = [];
      const stripIndices: number[] = [];
      const slices = 8;
      for (let j = 0; j <= slices; j++) {
        const t = .18 + j / slices * .64;
        const z = bump.z + (t - .5) * bump.length;
        const h = .024 + Math.max(0, bump.height * Math.sin(Math.PI * t));
        stripVerts.push(x - .22, h, z, x + .22, h, z);
        if (j < slices) {
          const index = j * 2;
          stripIndices.push(index, index + 2, index + 1, index + 1, index + 2, index + 3);
        }
      }
      const offset = paintVertices.length / 3;
      paintVertices.push(...stripVerts);
      paintIndices.push(...stripIndices.map(index => index + offset));
    }
    const paintGeometry = new THREE.BufferGeometry();
    paintGeometry.setAttribute('position', new THREE.Float32BufferAttribute(paintVertices, 3));
    paintGeometry.setIndex(paintIndices);
    paintGeometry.computeVertexNormals();
    group.add(new THREE.Mesh(paintGeometry, yellow));
    for (const dz of [-1, 1]) {
      const contact = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth - .8, .30), shadow);
      contact.rotation.x = -Math.PI / 2;
      contact.position.set(0, .019, bump.z + dz * (bump.length / 2 + .16));
      group.add(contact);
    }
  }
  return group;
}

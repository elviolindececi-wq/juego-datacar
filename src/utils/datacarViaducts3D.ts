import * as THREE from 'three';
import { getViaductStations } from './viaductPlacement.ts';

/**
 * DATACAR ARENA V9.3 — pasos elevados de ambientación ficticios, inspirados
 * en infraestructura urbana. Están fuera de las superficies de contacto de
 * los autos. La altura libre mínima bajo el tablero es de 6,2 metros.
 * Se ubican sobre la misma trayectoria Frenet que la calzada usando
 * bendRoadsideGroup() en el componente principal.
 */

function makeViaductAd(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const bg = ctx.createLinearGradient(0, 0, 1024, 0);
    bg.addColorStop(0, '#071827'); bg.addColorStop(.55, '#0b2940'); bg.addColorStop(1, '#071827');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#09c8ee';
    ctx.lineWidth = 9;
    ctx.strokeRect(8, 8, 1008, 224);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 105px Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('DATACARPY.COM', 512, 102);
    ctx.fillStyle = '#64daec';
    ctx.font = 'bold 35px Arial, sans-serif';
    ctx.fillText('COMPARÁ AUTOS REALES EN PARAGUAY', 512, 189);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Tablero transversal, pilares fuera del borde y publicidad aplicada a barandas. */
export function createDatacarViaducts3D(roadWidth: number, length: number, profile?: string): THREE.Group {
  const collection = new THREE.Group();
  collection.name = 'datacar_asuncion_viaductos';
  const stations = getViaductStations(length, profile);
  if (stations.length === 0) return collection;

  const cement = new THREE.MeshStandardMaterial({ color: '#87939b', roughness: .94, metalness: .03 });
  const cementDark = new THREE.MeshStandardMaterial({ color: '#55626b', roughness: .90 });
  const parapet = new THREE.MeshStandardMaterial({ color: '#aeb8bd', roughness: .82 });
  const asphaltTop = new THREE.MeshStandardMaterial({ color: '#3b4247', roughness: .96 });
  const stripe = new THREE.MeshBasicMaterial({ color: '#ded6b8' });
  const adTexture = makeViaductAd();
  const boardMat = new THREE.MeshBasicMaterial({ map: adTexture, side: THREE.DoubleSide, toneMapped: false });
  const adBacking = new THREE.MeshStandardMaterial({ color: '#061321', roughness: .65 });
  const underShadow = new THREE.MeshBasicMaterial({ color: '#0c1016', transparent: true, opacity: .12, depthWrite: false });

  const fullSpan = roadWidth + 13.5;
  const deckWidthAlongRoad = 10.0;
  const halfRoad = roadWidth / 2;
  const legX = halfRoad + 5.0;

  stations.forEach((s, i) => {
    const bridge = new THREE.Group();
    bridge.name = `viaducto_datacarpy_${i + 1}_${s}m`;
    bridge.position.z = s;

    // Plataforma a 6,2 m de luz libre, por encima del alto de los SUVs.
    const deck = new THREE.Mesh(new THREE.BoxGeometry(fullSpan, 1.05, deckWidthAlongRoad), cement);
    deck.position.set(0, 6.75, 0); // parte inferior 6,225m
    deck.castShadow = true;
    bridge.add(deck);

    const roadTop = new THREE.Mesh(new THREE.BoxGeometry(fullSpan - .5, .11, deckWidthAlongRoad - .3), asphaltTop);
    roadTop.position.set(0, 7.33, 0);
    bridge.add(roadTop);

    // Pilares robustos, fuera del asfalto, incluidos los carriles exteriores.
    for (const side of [-1, 1]) for (const dz of [-2.9, 2.9]) {
      const column = new THREE.Mesh(new THREE.BoxGeometry(1.05, 6.20, 1.12), cementDark);
      column.position.set(side * legX, 3.10, dz);
      column.castShadow = true;
      bridge.add(column);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.75, .40, 1.75), cement);
      base.position.set(side * legX, .2, dz);
      bridge.add(base);
    }

    for (const face of [-1, 1]) {
      // Baranda de hormigón: el aviso está adherido, no es un cartel flotante.
      const guard = new THREE.Mesh(new THREE.BoxGeometry(fullSpan, 1.32, .44), parapet);
      guard.position.set(0, 7.98, face * 4.87);
      bridge.add(guard);
      const panelBack = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.15, .08), adBacking);
      panelBack.position.set(0, 8.05, face * 5.12);
      bridge.add(panelBack);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 1.06), boardMat);
      panel.position.set(0, 8.05, face * 5.18);
      panel.rotation.y = face < 0 ? Math.PI : 0;
      panel.name = `publicidad_viaducto_datacarpy_${i + 1}_${face < 0 ? 'entrada' : 'salida'}`;
      bridge.add(panel);
    }

    for (let j = -5; j <= 5; j++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(.8, .015, .13), stripe);
      dash.position.set(j * 2.25, 7.40, 0);
      bridge.add(dash);
    }

    // Mancha de sombra tenue sobre el asfalto, sin bloquear profundidad.
    const groundShade = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, 10), underShadow);
    groundShade.rotation.x = -Math.PI / 2;
    groundShade.position.y = .052;
    bridge.add(groundShade);
    collection.add(bridge);
  });

  // Se liberará al destruir la escena por el mecanismo de dispose() general.
  collection.userData.viaductCount = stations.length;
  collection.userData.stations = stations;
  return collection;
}

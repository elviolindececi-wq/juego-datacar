import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findUpcomingPothole, potholeCameraCue } from '../src/utils/potholeVisibility.ts';

const hazards = [
  { id: 1, kind: 'pothole', x: .1, z: 34, radius: 1.12 },
  { id: 2, kind: 'pothole', x: 4.5, z: 20, radius: 1.12 },
  { id: 3, kind: 'pothole', x: 0, z: -4, radius: 1.12 },
  { id: 4, kind: 'barrier', x: 0, z: 14, radius: .8 },
];
const player = { x: 0, z: 0, yaw: 0, speed: 23 };
const next = findUpcomingPothole(hazards, player, 1.8);
assert.equal(next?.id, 1, 'Detectar solo el bache por delante y en el carril');
assert.ok(next && next.distanceM >= 33 && next.distanceM <= 35);
assert.equal(findUpcomingPothole(hazards, { ...player, x: -4.8 }, 1.8), null, 'No alertar por baches en otras calles');
assert.equal(findUpcomingPothole(hazards, { ...player, z: 41 }, 1.8), null, 'No alertar por baches detrás');
assert.equal(findUpcomingPothole(hazards, { ...player, speed: -5 }, 1.8), null, 'No advertir pozos delanteros en reversa');
assert.ok(potholeCameraCue(18) > potholeCameraCue(43), 'La cámara lee más el asfalto al acercarse');
assert.equal(potholeCameraCue(75), 0, 'Cámara normal lejos del bache');
assert.ok(potholeCameraCue(6) <= 1, 'Movimiento de cámara acotado');

const root = new URL('../', import.meta.url);
const app = fs.readFileSync(new URL('src/App.tsx', root), 'utf8');
const intro = fs.readFileSync(new URL('src/components/IntroSplash.tsx', root), 'utf8');
const race = fs.readFileSync(new URL('src/components/Race3DPerspectiveView.tsx', root), 'utf8');
const visuals = fs.readFileSync(new URL('src/utils/realisticPotholes3D.ts', root), 'utf8');
assert.ok(app.includes("useState<Screen>('intro')"));
assert.ok(app.includes('onRace={id => { setPlayerId(id);'), 'La selección conserva el auto al ir a carrera');
assert.ok(intro.includes('LOS MÁS') && intro.includes('BUSCADOS'));
assert.ok(intro.includes('no están ordenados por estadísticas de búsqueda'), 'No inventar ranking de usuarios');
assert.ok(race.includes('<ArcadeRaceHud'), 'Se mantiene el velocímetro V9.0');
assert.ok(!race.includes('LLEGADA · PLANO FRONTAL'), 'El mensaje de META sigue quitado');
assert.ok(race.includes('<ShieldAlert') && race.includes('Bache en tu trayectoria'));
assert.ok(visuals.includes('asfalto_agrietado_previo_al_bache') && visuals.includes('cavidad_real_profunda_17cm'));
console.log('OK V9.1: detección de baches, lectura de cámara, portada, HUD y meta limpia.');

import assert from 'node:assert/strict';
import { ASUNCION_CIRCUITS, matchesDifficulty, toRaceTrack } from '../src/data/asuncionCircuits.ts';
import { InteractiveRacePhysics, PHYSICS_STEP } from '../src/utils/interactiveRacePhysics.ts';
import { PRESET_VEHICLES } from '../src/data/presetVehicles.ts';
assert.equal(ASUNCION_CIRCUITS.length, 6, 'Seis circuitos');
assert.equal(new Set(ASUNCION_CIRCUITS.map(c => c.id)).size, 6);
assert.equal(ASUNCION_CIRCUITS.filter(c => matchesDifficulty(c, 'extremo')).length, 1);
assert.equal(ASUNCION_CIRCUITS.filter(c => matchesDifficulty(c, 'facil')).length, 1);
for (const circuit of ASUNCION_CIRCUITS) {
  const track = toRaceTrack(circuit);
  assert.equal(track.cityCircuitId, circuit.id);
  assert.equal(track.routeHazardProfile, circuit.profile);
  assert.ok(track.distanceMeters < 3500);
  const game = new InteractiveRacePhysics(PRESET_VEHICLES, track, PRESET_VEHICLES[0].id, true);
  assert.ok(game.hazards.length > 0, circuit.name + ' incluye obstáculos');
  assert.ok(game.hazards.every(h => h.z > 12 && h.z < track.distanceMeters - 10));
  for(let i = 0; i < 700; i++) game.step(PHYSICS_STEP, { steer: i>100 && i<350 ? 0.13 : 0, throttle: 1, brake: 0 });
  const player=game.getCar(PRESET_VEHICLES[0].id);
  assert.ok(player.z>5, circuit.name+' avanza');
  const hist=player.history;
  assert.ok(hist.length>10 && hist.every(s => Number.isFinite(s.lateralX) && Number.isFinite(s.yawRad)), circuit.name+' registra trayectoria de replay');
  console.log(`OK ${circuit.name}: ${game.hazards.length} peligros, distancia ${player.z.toFixed(1)}m, ${hist.length} fotogramas de datos`);
}

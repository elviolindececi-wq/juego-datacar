from pathlib import Path
root=Path('/mnt/data/datacar_v84_work')
p=root/'src/components/Race3DPerspectiveView.tsx'
s=p.read_text()
s=s.replace("import { createPotholeVisualKit } from '../utils/realisticPotholes3D';", "import { createPotholeVisualKit } from '../utils/realisticPotholes3D';\nimport { createDepressedRoadGeometry } from '../utils/depressedRoadSurface3D';")
s=s.replace("    const roadGeo = new THREE.PlaneGeometry(roadWidth, trackLength);", "    const roadCenterZ = trackLength / 2 - 20;\n    const roadGeo = createDepressedRoadGeometry(roadWidth, trackLength, roadCenterZ, []);")
s=s.replace("    road.position.set(0, 0, trackLength / 2 - 20);", "    road.position.set(0, 0, roadCenterZ);")
needle="    const potholeVisualKit = createPotholeVisualKit(track.routeHazardProfile);\n"
assert needle in s
s=s.replace(needle,needle+"""    // La calzada cambia de geometría SOLO si cambia el catálogo de baches.
    // ShapeGeometry deja huecos geométricos y el kit dibuja las paredes 17 cm más abajo.
    const updateRoadCutouts = (allHazards: readonly TrackHazard[]) => {
      const oldGeometry = road.geometry;
      road.geometry = createDepressedRoadGeometry(roadWidth, trackLength, roadCenterZ, allHazards);
      oldGeometry.dispose();
    };
    updateRoadCutouts(experience === 'replay' ? (replayHazards ?? []) : (racePhysics?.hazards ?? []));
""")
s=s.replace("      addHazardVisual(added);\n      raceHazardsSnapshotRef.current", "      addHazardVisual(added);\n      if (added.kind === 'pothole') updateRoadCutouts(activePhysics.hazards);\n      raceHazardsSnapshotRef.current")
s=s.replace("    let lastRoadImpactAudioAt = -Infinity;", "    let lastRoadImpactAudioAt = -Infinity;\n    // Cámara de llegada: se activa cuando el JUGADOR cruza la línea, no al llegar el último rival.\n    let finishCinematicStartedAt = -Infinity;")
s=s.replace("      lastRoadImpactAudioAt = -Infinity;\n      lastImpacts.clear();", "      lastRoadImpactAudioAt = -Infinity;\n      finishCinematicStartedAt = -Infinity;\n      lastImpacts.clear();")
s=s.replace("while (physicsAccumulator >= PHYSICS_STEP && steps < 12 && !livePhysics.finished)", "while (physicsAccumulator >= PHYSICS_STEP && steps < 12 &&\n            !(experience === 'race' ? livePhysics.playerFinished : livePhysics.finished))")
s=s.replace("          if (ownSuspension && ownSuspension.impact > .13 &&\n              livePhysics.time - lastRoadImpactAudioAt > .35) {\n            soundEngine.playImpact(.24 + ownSuspension.impact * .66);", "          if (ownSuspension && ownSuspension.impact > .17 &&\n              livePhysics.time - lastRoadImpactAudioAt > .30) {\n            soundEngine.playSuspensionHit(.28 + ownSuspension.impact * .72);")
s=s.replace("        const raceDone = livePhysics ? livePhysics.finished :", "        const raceDone = livePhysics ? (experience === 'race' ? livePhysics.playerFinished : livePhysics.finished) :")
s=s.replace("          if (livePhysics) finalResultsRef.current = livePhysics.makeResults(simulationResults);", "          if (livePhysics) finalResultsRef.current = livePhysics.makeResults(simulationResults);\n          if (experience === 'race') {\n            finishCinematicStartedAt = now;\n            setRaceEvent('🏁 ¡Cruzaste la meta! Toma frontal cinematográfica.');\n          }")
s=s.replace("                if (car.id === selectedVehicleId) soundEngine.playImpact(.19);", "                // El golpe ya lo genera la suspensión según su velocidad e intensidad.")
needle="      const automaticDirector = cameraMode === 'automatica';\n      if (automaticDirector) directorShot = chooseDirectorShot(leaderDist, finishDist);\n      const effectiveShot = automaticDirector ? directorShot! : cameraMode;"
assert needle in s
s=s.replace(needle,"""      const automaticDirector = cameraMode === 'automatica';
      if (automaticDirector) directorShot = chooseDirectorShot(leaderDist, finishDist);
      // La toma frontal de META es un cierre del juego, NO Director TV en vivo.
      const isFinishCinematic = experience === 'race' && stateRef.current.hasFinished;
      const effectiveShot = isFinishCinematic ? 'frontal_meta' : (automaticDirector ? directorShot! : cameraMode);""")
needle="""        case 'frontal_meta': {
          // Delante de la meta mirando hacia -Z: se ven las tres parrillas.
          // No atravesar la carrocería del líder ni perder el plano tras cruzar.
          targetSmoothRate = 11;
          wantedFov = compact ? 65 : 55;
          const frontZ = Math.max(finishDist + 12, leaderDist + 12);
          _desiredCamPos.set(avgX * 0.20, compact ? 2.1 : 1.9, frontZ);
          _camTarget.set(avgX, 1.04, centerZ - Math.min(2, spreadZ * 0.15));
          break;
        }
"""
assert needle in s
s=s.replace(needle,"""        case 'frontal_meta': {
          if (isFinishCinematic) {
            // Cambio de plano instantáneo y travelling MUY suave sobre el capó del jugador.
            // El auto permanece congelado en la línea y no hay cambio aleatorio de cámara.
            const p = THREE.MathUtils.clamp((now - finishCinematicStartedAt) / 3100, 0, 1);
            const easing = p * p * (3 - 2 * p);
            targetSmoothRate = 12;
            wantedFov = (compact ? 62 : 54) - 3 * easing;
            _desiredCamPos.set(selectedX * .85 + .35, 1.75 - .05 * easing,
              finishDist + 10.4 - easing * 2.4);
            _camTarget.set(selectedX, 1.22, finishDist - 1.2);
          } else {
            // Director TV de las repeticiones: todos los competidores de frente.
            targetSmoothRate = 11;
            wantedFov = compact ? 65 : 55;
            const frontZ = Math.max(finishDist + 12, leaderDist + 12);
            _desiredCamPos.set(avgX * 0.20, compact ? 2.1 : 1.9, frontZ);
            _camTarget.set(avgX, 1.04, centerZ - Math.min(2, spreadZ * 0.15));
          }
          break;
        }
""")
# overlay in viewport after mount
needle="        <div ref={mountRef} className={`w-full h-full block touch-none ${placementKind ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`} />"
assert needle in s
s=s.replace(needle,needle+"""
        {hasFinished && experience === 'race' && (
          <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between">
            <div className="h-[5.5%] bg-black/90" />
            <div className="self-center text-center rounded-xl border border-amber-300/45 bg-slate-950/75 px-7 py-3 shadow-2xl backdrop-blur-sm">
              <div className="text-2xl font-black tracking-[.24em] text-white">¡META!</div>
              <div className="text-xs font-semibold tracking-widest text-amber-300">LLEGADA · PLANO FRONTAL</div>
              <div className="text-[11px] text-slate-300">Resultados en unos segundos</div>
            </div>
            <div className="h-[5.5%] bg-black/90" />
          </div>
        )}""")
p.write_text(s)

p=root/'src/utils/interactiveRacePhysics.ts'
s=p.read_text()
s=s.replace("  get finished() { return this.cars.every(c => c.finishedAt !== null) || this.time >= 180; }", "  get playerFinished() { return this.getCar(this.playerId)?.finishedAt != null || this.time >= 180; }\n  get finished() { return this.cars.every(c => c.finishedAt !== null) || this.time >= 180; }")
s=s.replace("      const finished = car.finishedAt !== null;", "      const finished = car.finishedAt !== null;")
s=s.replace("          : `No terminó la carrera interactiva dentro del tiempo disponible; ${car.impacts} impactos.`,", "          : `No había cruzado la meta cuando terminó la partida del jugador; distancia ${Math.round(car.z)} m; ${car.impacts} impactos.`,")
s=s.replace("    }).sort((a, b) => Number(!!a.isDnf) - Number(!!b.isDnf) || a.finishTimeSec - b.finishTimeSec)", "    }).sort((a, b) => Number(!!a.isDnf) - Number(!!b.isDnf) ||\n      (a.isDnf && b.isDnf ? (b.telemetryHistory.at(-1)?.distanceMeters ?? 0) - (a.telemetryHistory.at(-1)?.distanceMeters ?? 0) : a.finishTimeSec - b.finishTimeSec))")
s=s.replace("        gapSec: result.finishTimeSec - arr[0].finishTimeSec }));", "        gapSec: result.isDnf ? 0 : result.finishTimeSec - arr[0].finishTimeSec }));")
p.write_text(s)

p=root/'src/utils/soundEngine.ts'
s=p.read_text()
s=s.replace("  private lastImpactAt = -Infinity;", "  private lastImpactAt = -Infinity;\n  private lastSuspensionHitAt = -Infinity;")
needle="  stopAll() {"
assert needle in s
s=s.replace(needle,"""  /** Golpe seco de suspensión: grave de chasis + traqueteo de piedra, según impacto. */
  playSuspensionHit(strength = .6) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    if (t - this.lastSuspensionHitAt < .28) return;
    this.lastSuspensionHitAt = t;
    const v = clamp(strength, .12, 1);
    const bass = this.ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(108 + v * 40, t);
    bass.frequency.exponentialRampToValueAtTime(43, t + .15);
    const body = this.ctx.createGain();
    body.gain.setValueAtTime(.0001, t);
    body.gain.exponentialRampToValueAtTime(.23 * v, t + .006);
    body.gain.exponentialRampToValueAtTime(.0001, t + .21);
    bass.connect(body); body.connect(this.master);
    bass.start(t); bass.stop(t + .22);
    bass.onended = () => { bass.disconnect(); body.disconnect(); };

    const length = Math.max(1, Math.floor(this.ctx.sampleRate * .17));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * .20));
    const grit = this.ctx.createBufferSource(); grit.buffer = buffer;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 600 + v * 650; filter.Q.value = .8;
    const gritGain = this.ctx.createGain(); gritGain.gain.value = .25 * v;
    grit.connect(filter); filter.connect(gritGain); gritGain.connect(this.master);
    grit.start(t); grit.stop(t + .18);
    grit.onended = () => { grit.disconnect(); filter.disconnect(); gritGain.disconnect(); };
  }

"""+needle)
p.write_text(s)

p=root/'package.json'
import json
obj=json.loads(p.read_text())
obj['version']='8.4.0'
obj['scripts']['test:v84']="node --experimental-strip-types scripts/test-v84-physics.mjs && node scripts/test-v84-integration.mjs"
p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')

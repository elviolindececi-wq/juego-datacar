import React, { useEffect } from 'react';
import { VehicleRaceResult, RaceTrackConfig, PreferenceWeights, VehicleMatchScore } from '../types/vehicle';
import { Trophy, Medal, Timer, Gauge, Fuel, Zap, X, RotateCcw, Shield, Sparkles, DollarSign, Star, CheckCircle2, Info } from 'lucide-react';
import confetti from 'canvas-confetti';

interface RaceResultsModalProps {
  results: VehicleRaceResult[];
  track: RaceTrackConfig;
  weights: PreferenceWeights;
  matchScores: VehicleMatchScore[];
  isOpen: boolean;
  onClose: () => void;
  onRestartRace: () => void;
}

export const RaceResultsModal: React.FC<RaceResultsModalProps> = ({
  results,
  track,
  weights,
  matchScores,
  isOpen,
  onClose,
  onRestartRace,
}) => {
  useEffect(() => {
    if (isOpen && results.length > 0) {
      try {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#38bdf8', '#3b82f6', '#10b981', '#f59e0b'],
        });
      } catch (e) {
        // silent
      }
    }
  }, [isOpen, results]);

  if (!isOpen || results.length === 0) return null;

  // Ganador físico en pista
  const physicalWinner = results[0];

  // Ganador según ponderador de preferencias
  const bestMatchScore = matchScores.find((s) => s.isBestMatch) || matchScores[0];
  const preferenceWinnerResult = results.find((r) => r.vehicle.id === bestMatchScore?.vehicleId) || results[0];

  const isSameWinner = physicalWinner.vehicle.id === preferenceWinnerResult.vehicle.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display tracking-wide uppercase">
                Veredicto Final: Carrera de Atributos & Preferencias
              </h2>
              <div className="text-xs text-slate-400 font-mono">
                {track.name} · {track.distanceMeters}m · Ponderadores: Motor {weights.motor}%, Seg {weights.seguridad}%, Tec {weights.tecnologia}%, Eco {weights.economia}%
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Dual Podium / Winner Announcement Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Ganador por Ponderador de Preferencias (Lo que pidió el usuario) */}
            <div className="p-5 rounded-xl border border-sky-400/40 bg-gradient-to-br from-sky-500/10 via-slate-900 to-slate-950 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-sky-500 text-slate-950 text-[10px] font-mono font-bold px-3 py-0.5 rounded-bl-lg uppercase tracking-wider">
                ★ Ganador por Preferencias
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-sky-400 font-bold mb-1">
                  <Star className="w-4 h-4 fill-sky-400 text-sky-400" />
                  <span>MAYOR AFINIDAD ({bestMatchScore?.totalMatchPercent}% MATCH)</span>
                </div>
                <h3 className="text-xl font-black text-white mb-1">
                  {preferenceWinnerResult.vehicle.brand} {preferenceWinnerResult.vehicle.name}
                </h3>
                <span className="text-xs font-mono text-slate-400 block mb-3">
                  Precio Contado: US$ {preferenceWinnerResult.vehicle.equipment.priceUsd.toLocaleString()}
                </span>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  {bestMatchScore?.matchReasons.slice(0, 2).join('. ') || 'Máxima puntuación en tus prioridades.'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Puesto en pista:</span>
                <span className="text-white font-bold">P{preferenceWinnerResult.finishPosition} ({preferenceWinnerResult.finishTimeSec.toFixed(3)}s)</span>
              </div>
            </div>

            {/* 2. Ganador en Pista (Física Pura) */}
            <div className="p-5 rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 text-[10px] font-mono font-bold px-3 py-0.5 rounded-bl-lg uppercase tracking-wider">
                1er Lugar Pista
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold mb-1">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>CRUZÓ LA META PRIMERO</span>
                </div>
                <h3 className="text-xl font-black text-white mb-1">
                  {physicalWinner.vehicle.brand} {physicalWinner.vehicle.name}
                </h3>
                <span className="text-xs font-mono text-slate-400 block mb-3">
                  Tiempo: {physicalWinner.finishTimeSec.toFixed(3)}s · Trap: {physicalWinner.trapSpeedKmh} km/h
                </span>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  {physicalWinner.verdict}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Afinidad Match:</span>
                <span className="text-sky-400 font-bold">
                  {matchScores.find((s) => s.vehicleId === physicalWinner.vehicle.id)?.totalMatchPercent}% Match
                </span>
              </div>
            </div>
          </div>

          {/* Leaderboard Table with Combined Physical & Preference Metrics */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">PISTA</th>
                  <th className="py-3 px-3">VEHÍCULO</th>
                  <th className="py-3 px-3 text-right">PRECIO CONTADO</th>
                  <th className="py-3 px-3 text-right">TIEMPO PISTA</th>
                  <th className="py-3 px-3 text-right">TRAP SPEED</th>
                  <th className="py-3 px-3 text-right">0-100 KM/H</th>
                  <th className="py-3 px-3 text-right">MATCH PREFERENCIAS</th>
                  <th className="py-3 px-3 text-right">VEREDICTO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {results.map((res) => {
                  const score = matchScores.find((s) => s.vehicleId === res.vehicle.id);
                  const isPrefWin = score?.isBestMatch;
                  const isPhysWin = res.finishPosition === 1;

                  return (
                    <tr
                      key={res.vehicle.id}
                      className={`hover:bg-slate-900/50 transition-colors ${
                        isPrefWin ? 'bg-sky-500/10 text-white font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          {res.isDnf ? (
                            <span className="text-red-400 font-bold">DNF</span>
                          ) : (
                            <>
                              {isPhysWin ? <Medal className="w-3.5 h-3.5 text-amber-400" /> : null}
                              <span>P{res.finishPosition}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: res.vehicle.color }}
                          />
                          <span className="font-bold text-white whitespace-nowrap">
                            {res.vehicle.brand} {res.vehicle.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-white">
                        US$ {res.vehicle.equipment.priceUsd.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-bold tabular-nums">
                        {res.isDnf ? (
                          <span className="text-red-400">DNF (Varado)</span>
                        ) : (
                          <span className="text-sky-400">{res.finishTimeSec.toFixed(3)}s</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {res.trapSpeedKmh.toFixed(1)} km/h
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {res.time0to100 !== null ? `${res.time0to100.toFixed(2)}s` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        <span className={`px-2 py-0.5 rounded font-bold ${isPrefWin ? 'bg-sky-500 text-slate-950' : 'text-sky-300'}`}>
                          {score ? score.totalMatchPercent : 50}% Match
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[11px]">
                        {res.isDnf ? (
                          <span className="text-red-400 font-bold">{res.dnfReason || 'SIN ENERGÍA'}</span>
                        ) : isPrefWin ? (
                          <span className="text-sky-400 font-bold">★ ELECCIÓN ÓPTIMA</span>
                        ) : isPhysWin ? (
                          <span className="text-amber-400 font-bold">MÁS RÁPIDO</span>
                        ) : (
                          <span className="text-slate-500">COMPETITIVO</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Full Analytical Decision Synthesis */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
            <h4 className="font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-sky-400" /> Síntesis Comparativa del Resultado:
            </h4>
            <p className="text-slate-300 leading-relaxed">
              {isSameWinner
                ? `¡Coincidencia absoluta! El ${physicalWinner.vehicle.brand} ${physicalWinner.vehicle.name} no solo dominó la pista física con un tiempo de ${physicalWinner.finishTimeSec.toFixed(3)}s, sino que también cumplió a la perfección tus preferencias actuales con un ${bestMatchScore?.totalMatchPercent}% de Match.`
                : `Divergencia técnica: El ${physicalWinner.vehicle.brand} ${physicalWinner.vehicle.name} se llevó la victoria en el asfalto gracias a su rendimiento dinámico (${physicalWinner.finishTimeSec.toFixed(3)}s), pero de acuerdo a tu ponderador de preferencias (${weights.economia}% Economía, ${weights.seguridad}% Seguridad, ${weights.motor}% Motor, ${weights.tecnologia}% Confort), el ${preferenceWinnerResult.vehicle.brand} ${preferenceWinnerResult.vehicle.name} resulta ser el ganador del Match con un ${bestMatchScore?.totalMatchPercent}% de afinidad total.`}
            </p>
          </div>

          {/* Disclaimer Legal & Referencial datacarpy.com */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-slate-300 font-bold block">Aviso Informativo y Metodología:</span>
              <p>
                Esta simulación y carrera de atributos tiene carácter <strong className="text-white">referencial y lúdico</strong> para comparar de forma intuitiva la relación potencia/peso, torque y equipamiento oficial. Los valores reales en calle pueden variar según el combustible, carga y estilo de conducción. Para consultar las fichas técnicas oficiales y cotizaciones completas, te recomendamos ingresar a{' '}
                <a
                  href="https://datacarpy.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300 underline font-bold"
                >
                  datacarpy.com
                </a>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cerrar Resumen
          </button>

          <button
            onClick={() => {
              onClose();
              onRestartRace();
            }}
            className="flex items-center gap-1.5 px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-lg shadow-sky-500/20"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Repetir Carrera</span>
          </button>
        </div>
      </div>
    </div>
  );
};

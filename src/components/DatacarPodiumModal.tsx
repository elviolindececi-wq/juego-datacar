import React, { useEffect } from 'react';
import { VehicleRaceResult, RaceTrackConfig, PreferenceWeights, VehicleMatchScore } from '../types/vehicle';
import { Trophy, Medal, Timer, Gauge, Fuel, Zap, X, RotateCcw, Shield, Sparkles, DollarSign, ExternalLink, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Photographic360Viewer } from './Photographic360Viewer';

interface DatacarPodiumModalProps {
  isInteractive?: boolean;
  results: VehicleRaceResult[];
  track: RaceTrackConfig;
  weights: PreferenceWeights;
  matchScores: VehicleMatchScore[];
  isOpen: boolean;
  onClose: () => void;
  onRestartRace: () => void;
  onOpenMatchTab: () => void;
}

export const DatacarPodiumModal: React.FC<DatacarPodiumModalProps> = ({
  results,
  isInteractive = false,
  track,
  weights,
  matchScores,
  isOpen,
  onClose,
  onRestartRace,
  onOpenMatchTab,
}) => {
  useEffect(() => {
    if (isOpen && results.length > 0) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#38bdf8', '#0284c7', '#fbbf24', '#ffffff'],
        });
      } catch (e) {
        // Safe confetti fallback
      }
    }
  }, [isOpen, results]);

  if (!isOpen || results.length === 0) return null;

  const physicalWinner = results.find(r => !r.isDnf) || results[0];
  const secondPlace = results.find(r => r.finishPosition === 2) || results[1];
  const thirdPlace = results.find(r => r.finishPosition === 3) || results[2];

  const bestMatchScore = matchScores.find((s) => s.isBestMatch) || matchScores[0];
  const preferenceWinnerResult = results.find((r) => r.vehicle.id === bestMatchScore?.vehicleId) || results[0];

  const isSameWinner = physicalWinner.vehicle.id === preferenceWinnerResult.vehicle.id;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#090d19] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* Top Header Strip */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <Trophy className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-sky-400 uppercase tracking-wider block font-bold">
                DATACAR ARENA · EL VEREDICTO
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase font-display tracking-tight">
                {isInteractive ? 'Podio · Carrera Interactiva' : 'Podio & Resultados Oficiales de la Prueba'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TRACK SUBTITLE */}
          <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span>
              Desafío: <strong className="text-white">{track.name}</strong> ({track.distanceMeters}m {track.inclineGradePercent > 0 && `+${track.inclineGradePercent}% pendiente`})
            </span>
            <span>
              Ponderación actual: Motor {weights.motor}%, Seg {weights.seguridad}%, Tec {weights.tecnologia}%, Eco {weights.economia}%
            </span>
          </div>

          {isInteractive && (
            <p className="text-xs text-amber-300 font-mono">
              Tiempos de esta partida: aceleración, frenadas, choques y baches modifican el resultado. Modelo físico simplificado; no corresponde a una prueba oficial de fabricante.
            </p>
          )}
          {/* DUAL VERDICT CARDS (EL VEREDICTO DATACAR) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Ganador de la Prueba Física */}
            <div className="bg-gradient-to-b from-amber-500/10 via-slate-950 to-slate-950 border border-amber-500/40 rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> {isInteractive ? 'GANADOR DE TU CARRERA' : 'GANADOR DE LA PRUEBA FÍSICA'}
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">
                  P1 · {physicalWinner.finishTimeSec.toFixed(2)}s
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black font-display text-white uppercase tracking-tight">
                  {physicalWinner.vehicle.brand} {physicalWinner.vehicle.name}
                </h3>
                <span className="text-xs font-mono text-slate-400">{physicalWinner.vehicle.trim}</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                {physicalWinner.verdict}
              </p>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Velocidad final cruzando meta:</span>
                <span className="font-bold text-amber-400">{physicalWinner.trapSpeedKmh} km/h</span>
              </div>
            </div>

            {/* Card 2: Mejor Match para Vos (Recomendación inteligente) */}
            <div className="bg-gradient-to-b from-sky-500/10 via-slate-950 to-slate-950 border border-sky-500/40 rounded-2xl p-4 shadow-xl space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> MEJOR MATCH PARA VOS
                </span>
                <span className="text-xs font-mono font-bold text-sky-400">
                  {bestMatchScore?.totalMatchPercent}% AFINIDAD
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black font-display text-white uppercase tracking-tight">
                  {preferenceWinnerResult.vehicle.brand} {preferenceWinnerResult.vehicle.name}
                </h3>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  US$ {preferenceWinnerResult.vehicle.equipment.priceUsd.toLocaleString()}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                {bestMatchScore?.matchReasons[0] || preferenceWinnerResult.vehicle.description}
              </p>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">
                  {isSameWinner 
                    ? '¡Coincidencia total entre pista y tus prioridades!' 
                    : '¿La más rápida es tu mejor compra? No siempre.'}
                </span>
                <button
                  onClick={onOpenMatchTab}
                  className="text-xs font-mono font-bold text-sky-400 hover:text-sky-300 underline flex items-center gap-1"
                >
                  Ver Mi Match <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* VISUAL 360° TURNTABLE OF THE CHAMPION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Vehículo Ganador en Vista 360° de Celebración:
              </h4>
              <span className="text-[11px] font-mono text-slate-400">
                Arrastrá con el mouse para girar el auto
              </span>
            </div>

            <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-3">
              <Photographic360Viewer
                vehicle={physicalWinner.vehicle}
                compact={true}
              />
            </div>
          </div>

          {/* TABLE OF COMPARATIVE RESULTS */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Tabla Completa de Posiciones & Brecha de Rendimiento:
            </h4>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Puesto</th>
                    <th className="py-2.5 px-3">Vehículo</th>
                    <th className="py-2.5 px-3">Precio Contado</th>
                    <th className="py-2.5 px-3">Tiempo</th>
                    <th className="py-2.5 px-3">Trap Speed</th>
                    <th className="py-2.5 px-3">Brecha</th>
                    <th className="py-2.5 px-3">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {results.map((res) => {
                    const score = matchScores.find((s) => s.vehicleId === res.vehicle.id);
                    return (
                      <tr key={res.vehicle.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">
                          {res.finishPosition === 1 ? '🥇 P1' : res.finishPosition === 2 ? '🥈 P2' : '🥉 P3'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white">
                          {res.vehicle.brand} {res.vehicle.name}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">
                          US$ {res.vehicle.equipment.priceUsd.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-sky-400 font-bold">
                          {res.isDnf ? 'DNF' : `${res.finishTimeSec.toFixed(2)}s`}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {res.trapSpeedKmh} km/h
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {res.finishPosition === 1 ? 'LÍDER' : `+${res.gapSec}s`}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-sky-400">
                          {score?.totalMatchPercent}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DATACARPY.COM OFFICIAL DISCLAIMER & CTA */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-300 font-bold block">Aviso Informativo de Metodología:</span>
                <span>
                  Esta simulación tiene carácter <strong className="text-white">referencial y lúdico</strong> para comparar la relación potencia/peso, torque y equipamiento oficial. Para consultar fichas técnicas homologadas y cotizar con representantes autorizados, ingresá a{' '}
                  <strong className="text-sky-400">datacarpy.com</strong>.
                </span>
              </div>
            </div>

            <a
              href="https://datacarpy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 shrink-0 shadow-lg shadow-sky-500/20 transition-all"
            >
              <span>Ver Ficha en datacarpy.com</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono font-bold border border-slate-800"
          >
            Cerrar Resumen
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onRestartRace}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-bold border border-slate-800 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Repetir Desafío</span>
            </button>
            <button
              onClick={onOpenMatchTab}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md shadow-sky-500/20"
            >
              <span>Descubrir Mi Match</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Vehicle, PreferenceWeights, VehicleMatchScore } from '../types/vehicle';
import { X, Trophy, Zap, Shield, Sparkles, DollarSign, CheckCircle2 } from 'lucide-react';

interface PointsBreakdownModalProps {
  vehicles: Vehicle[];
  weights: PreferenceWeights;
  scores: VehicleMatchScore[];
  isOpen: boolean;
  onClose: () => void;
}

export const PointsBreakdownModal: React.FC<PointsBreakdownModalProps> = ({
  vehicles,
  weights,
  scores,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

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
                Desglose Analítico de Puntos y Ponderación
              </h2>
              <div className="text-xs text-slate-400 font-mono">
                Cálculo transparente de afinidad basado en atributos de ficha técnica y tus preferencias
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
          {/* Active Weights Summary Strip */}
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <span className="text-slate-400 font-bold uppercase">Ponderadores Activos:</span>
            <div className="flex items-center gap-4">
              <span className="text-amber-400">⚡ Motor: {weights.motor}%</span>
              <span className="text-blue-400">🛡️ Seguridad: {weights.seguridad}%</span>
              <span className="text-purple-400">📱 Tecnología: {weights.tecnologia}%</span>
              <span className="text-emerald-400">💰 Economía: {weights.economia}%</span>
            </div>
          </div>

          {/* Cards for each vehicle */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vehicles.map((v) => {
              const sc = scores.find((s) => s.vehicleId === v.id);
              if (!sc) return null;

              return (
                <div
                  key={v.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    sc.isBestMatch
                      ? 'bg-slate-900/90 border-sky-400 ring-1 ring-sky-400/40'
                      : 'bg-slate-900/50 border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-slate-400 uppercase">{v.brand}</span>
                      {sc.isBestMatch && (
                        <span className="bg-sky-500/20 text-sky-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                          ★ MEJOR MATCH
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{v.name}</h3>
                    <div className="text-2xl font-black text-sky-400 font-mono mb-4">
                      {sc.totalMatchPercent}% Match
                    </div>

                    {/* Breakdown bars */}
                    <div className="space-y-2.5 text-xs font-mono mb-4">
                      <div>
                        <div className="flex justify-between text-slate-400 mb-0.5">
                          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> Motor</span>
                          <span className="text-white font-bold">{sc.motorScore}/100</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-400 h-full rounded-full" style={{ width: `${sc.motorScore}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 mb-0.5">
                          <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-blue-400" /> Seguridad</span>
                          <span className="text-white font-bold">{sc.seguridadScore}/100</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-400 h-full rounded-full" style={{ width: `${sc.seguridadScore}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 mb-0.5">
                          <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-purple-400" /> Tecnología</span>
                          <span className="text-white font-bold">{sc.tecnologiaScore}/100</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-purple-400 h-full rounded-full" style={{ width: `${sc.tecnologiaScore}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 mb-0.5">
                          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-400" /> Economía</span>
                          <span className="text-white font-bold">{sc.economiaScore}/100</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${sc.economiaScore}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Highlights */}
                  <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-300">
                    <span className="text-[10px] text-slate-500 font-mono block uppercase mb-1">
                      Puntos Fuertes:
                    </span>
                    <ul className="space-y-1">
                      {sc.matchReasons.map((r, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <CheckCircle2 className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-bold rounded-lg transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

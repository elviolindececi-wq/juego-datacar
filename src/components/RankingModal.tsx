import React, { useEffect, useState } from 'react';
import { Award, ShieldCheck, Timer, Trophy, Users, X } from 'lucide-react';
import { ASUNCION_CIRCUITS } from '../data/asuncionCircuits';
import type { RaceModeVariant } from '../utils/careerProgression';
import { formatTargetMinutesSec, getCircuitTargetTime } from '../utils/circuitTargetTimes';
import { fetchCircuitRanking, type RankingEntry } from '../utils/rankingStore';

interface RankingModalProps {
  isOpen: boolean;
  initialCircuitId?: string;
  onClose: () => void;
}

export const RankingModal: React.FC<RankingModalProps> = ({
  isOpen,
  initialCircuitId,
  onClose,
}) => {
  const [circuitId, setCircuitId] = useState(
    initialCircuitId || ASUNCION_CIRCUITS[0]?.id || 'avelino',
  );
  const [mode, setMode] = useState<RaceModeVariant>('city_trial');
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialCircuitId) setCircuitId(initialCircuitId);
  }, [initialCircuitId]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    void fetchCircuitRanking(circuitId, mode).then((list) => {
      if (!active) return;
      setEntries(list);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [isOpen, circuitId, mode]);

  if (!isOpen) return null;

  const target1Lap = getCircuitTargetTime(circuitId, mode, 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ranking-modal-title"
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-cyan-500/40 bg-slate-900 p-5 sm:p-6 text-slate-100 shadow-2xl my-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar tabla de ranking"
          className="absolute right-4 top-4 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:text-white cursor-pointer"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 text-cyan-300">
          <Trophy size={18} />
          <span className="text-[11px] font-black uppercase tracking-[0.2em]">
            TABLA OFICIAL DE PILOTOS
          </span>
        </div>
        <h2 id="ranking-modal-title" className="mt-1 text-2xl font-black uppercase">
          Ranking por Circuito
        </h2>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <select
            aria-label="Seleccionar circuito del ranking"
            value={circuitId}
            onChange={(e) => setCircuitId(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
          >
            {ASUNCION_CIRCUITS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setMode('city_trial')}
              className={`rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${
                mode === 'city_trial' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Fase 1 · Ciudad (IQ)
            </button>
            <button
              type="button"
              onClick={() => setMode('speed_pro')}
              className={`rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${
                mode === 'speed_pro' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Fase 2 · Carrera (Tiempo)
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/75 px-3 py-2 text-[11px] text-slate-300">
          <Timer size={14} className="text-amber-300 shrink-0" />
          <span>
            Meta Oro (1 vuelta): <strong className="text-amber-300 font-mono">{formatTargetMinutesSec(target1Lap.targetSec)}</strong> · Límite Plata:{' '}
            <strong className="text-slate-200 font-mono">{formatTargetMinutesSec(target1Lap.maxLimitSec)}</strong>
          </span>
        </div>

        <div className="mt-4 max-h-[340px] overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="py-10 text-center text-xs text-slate-400">Cargando clasificación...</div>
          ) : entries.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-center">
              <p className="text-sm font-bold text-slate-200">
                Todavía no hay marcas registradas en este circuito y fase.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Completá una partida oficial (Fase 1 o Fase 2) para inaugurar la tabla con tu tiempo y Driving IQ reales.
              </p>
            </div>
          ) : (
            entries.map((entry, idx) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/85 px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-black tabular-nums ${
                      idx === 0
                        ? 'bg-amber-400 text-slate-950'
                        : idx === 1
                          ? 'bg-slate-300 text-slate-950'
                          : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {idx + 1}º
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 font-black text-white">
                      <span className="truncate">{entry.pilotName}</span>
                      {entry.isDatacarMember && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-black text-amber-300">
                          <ShieldCheck size={10} /> MIEMBRO DATACARPY
                        </span>
                      )}
                      {entry.medal === 'gold' && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                          <Award size={10} /> ORO
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span>{entry.vehicleName}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Users size={11} /> {entry.occupants} pax (+{entry.payloadKg} kg)
                      </span>
                      <span>· {entry.laps} vta</span>
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums">
                  <div className="text-sm font-black text-cyan-300">
                    {entry.finishTimeSec.toFixed(2)}s
                  </div>
                  {mode === 'city_trial' && (
                    <div className="text-[10px] font-bold text-slate-400">
                      IQ {Math.round(entry.drivingIq)} / 1000
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

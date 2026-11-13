import React from 'react';
import { AlertOctagon, Clock, Lock, ShieldAlert } from 'lucide-react';
import { formatJailCountdown } from '../utils/careerProgression';

export interface JailLockoutModalProps {
  remainingSec: number;
  incidentCircuit?: string;
  onAcknowledgeRelease?: () => void;
  onExploreWhileLocked?: () => void;
}

export const JailLockoutModal: React.FC<JailLockoutModalProps> = ({
  remainingSec,
  incidentCircuit,
  onAcknowledgeRelease,
  onExploreWhileLocked,
}) => {
  const isLocked = remainingSec > 0;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#02060d]/92 px-4 py-6 backdrop-blur-lg select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Detención vial por atropello peatonal"
    >
      {/* Barras verticales estilizadas de celda */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(148,163,184,0.28) 0px, rgba(148,163,184,0.28) 6px, transparent 6px, transparent 56px)',
        }}
        aria-hidden="true"
      />

      {/* Baliza policial roja / azul superior */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-rose-600 via-sky-500 to-rose-600 animate-pulse shadow-[0_0_32px_rgba(244,63,94,0.85)]"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border-2 border-rose-500/80 bg-[#07111e]/95 p-6 sm:p-8 text-center shadow-[0_0_60px_rgba(244,63,94,0.35)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/60 bg-rose-950/80 text-rose-300 shadow-[0_0_24px_rgba(244,63,94,0.45)]">
          {isLocked ? <Lock className="h-8 w-8 animate-pulse" /> : <ShieldAlert className="h-8 w-8 text-emerald-300" />}
        </div>

        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-950/70 px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-rose-200">
          <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
          <span>COMISARÍA VIAL · SANCIÓN PENAL DE TRÁNSITO</span>
        </div>

        <h2 className="mt-3 font-display text-3xl sm:text-4xl font-black italic uppercase tracking-wide text-white">
          {isLocked ? 'DETENIDO EN LA CÁRCEL' : 'SANCIÓN CUMPLIDA'}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-slate-200">
          {isLocked ? (
            <>
              Atropellaste a un peatón en franja peatonal
              {incidentCircuit ? ` en ${incidentCircuit}` : ''}. Tu licencia queda suspendida y{' '}
              <strong className="text-rose-300">no podés competir durante los próximos 2 minutos</strong>.
              Mientras tanto podés recorrer el Garage, Comparador, Ranking y personalizar vehículos.
            </>
          ) : (
            'Cumpliste los 2 minutos de detención vial. Ya podés volver a conducir respetando los semáforos en rojo y las franjas peatonales.'
          )}
        </p>

        {/* Reloj digital de condena */}
        <div className="mt-5 rounded-xl border border-rose-500/45 bg-slate-950/90 px-5 py-4">
          <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
            <Clock className="h-3.5 w-3.5 text-rose-400" />
            <span>TIEMPO RESTANTE DE CÁRCEL</span>
          </div>
          <div className="mt-1 font-mono text-5xl sm:text-6xl font-black tracking-wider text-rose-400 tabular-nums drop-shadow-[0_0_16px_rgba(244,63,94,0.65)]">
            {formatJailCountdown(remainingSec)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            En semáforo rojo los peatones tienen prioridad absoluta sobre la franja peatonal.
          </p>
        </div>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            disabled={isLocked}
            onClick={onAcknowledgeRelease}
            className={`w-full rounded-xl px-6 py-3.5 font-display text-base font-black italic uppercase tracking-wider transition ${
              isLocked
                ? 'cursor-not-allowed border border-slate-700 bg-slate-900 text-slate-500'
                : 'cursor-pointer bg-emerald-400 text-slate-950 hover:bg-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.45)]'
            }`}
          >
            {isLocked
              ? `PISTA BLOQUEADA (${formatJailCountdown(remainingSec)})`
              : 'SALIR EN LIBERTAD Y VOLVER A LA PISTA'}
          </button>

          {isLocked && onExploreWhileLocked && (
            <button
              type="button"
              onClick={onExploreWhileLocked}
              className="w-full rounded-xl border border-cyan-400/50 bg-cyan-950/70 px-6 py-3 text-xs font-black uppercase tracking-wider text-cyan-200 hover:bg-cyan-900/75 hover:text-white transition cursor-pointer"
            >
              EXPLORAR APP MIENTRAS ESPERO (GARAGE / COMPARAR / RANKING)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

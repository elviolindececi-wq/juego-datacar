import React, { useEffect } from 'react';
import { ArrowRight, Building2, Car, Crosshair, Gauge, MapPin, ShieldAlert, Timer } from 'lucide-react';
import { buildPursuitMissionMetadata } from '../utils/asuncionPursuitLore';
import type { RaceModeId } from '../utils/careerProgression';
import {
  DATACAR_BRIEFING_FIXED_CONTEXT,
  DATACAR_BRIEFING_HEADER,
  DATACAR_SELECTOR_COPY,
  SATIRICAL_FICTION_DISCLAIMER,
  getWenoBankMissionForCircuit,
} from '../utils/wenoBankMissions';

export interface AsuncionPursuitModalProps {
  open: boolean;
  circuitId?: string;
  trackName: string;
  trackDistanceMeters: number;
  laps: number;
  vehicleName: string;
  raceMode?: RaceModeId;
  targetTimeLabel?: string;
  maxLimitLabel?: string;
  sceneReady: boolean;
  glbLoadError: string | null;
  onAcceptMission: () => void;
  onRetryLoad?: () => void;
  onFallback3D?: () => void;
}

/**
 * Pantalla de briefing de cada circuito ("Operación Weno Bank") renderizada como
 * superposición HTML/React sobre el canvas WebGL activo justo antes de iniciar
 * la cuenta regresiva (3, 2, 1).
 *
 * Nota técnica WebGL: evita deliberadamente backdrop-filter / backdrop-blur sobre
 * el lienzo 3D activo para mantener máxima fluidez de fotogramas en hardware y móvil.
 */
export const AsuncionPursuitModal: React.FC<AsuncionPursuitModalProps> = ({
  open,
  circuitId,
  trackName,
  trackDistanceMeters,
  laps,
  vehicleName,
  raceMode = 'city_trial',
  targetTimeLabel,
  maxLimitLabel,
  sceneReady,
  glbLoadError,
  onAcceptMission,
  onRetryLoad,
  onFallback3D,
}) => {
  useEffect(() => {
    if (!open || glbLoadError) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        const tag = (ev.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT') return;
        ev.preventDefault();
        onAcceptMission();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, glbLoadError, onAcceptMission]);

  if (!open) return null;

  const meta = buildPursuitMissionMetadata(raceMode, targetTimeLabel);
  const mission = getWenoBankMissionForCircuit(circuitId, trackName);
  const kmFormatted = (Math.max(400, trackDistanceMeters) / 1000).toFixed(1).replace('.', ',');
  const resolvedMaxTime =
    raceMode === 'practice_free'
      ? 'Reconocimiento libre'
      : maxLimitLabel || targetTimeLabel || 'Según cronómetro oficial';

  return (
    <div
      className="absolute inset-0 z-[75] flex items-center justify-center p-2.5 sm:p-6 pointer-events-auto"
      style={{
        background:
          'radial-gradient(circle at 50% 42%, rgba(7, 13, 22, 0.48) 0%, rgba(4, 8, 15, 0.84) 78%, rgba(2, 5, 10, 0.92) 100%)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="asuncion-pursuit-title"
      aria-describedby="asuncion-pursuit-lore"
      data-testid="asuncion-pursuit-modal"
    >
      <div
        className="relative w-full max-w-[720px] max-h-[92dvh] overflow-y-auto border border-amber-400/40 text-slate-100 shadow-[0_28px_80px_rgba(0,0,0,0.85)]"
        style={{
          backgroundColor: 'rgba(6, 12, 21, 0.95)',
        }}
      >
        {/* Franja superior terracota / ámbar / cian */}
        <div
          className="h-[3px] w-full"
          style={{
            background: 'linear-gradient(90deg, #c25934 0%, #fbbf24 52%, #06b6d4 100%)',
          }}
        />

        <div className="px-4 py-4 sm:px-7 sm:py-6">
          {/* Encabezado de clasificación operativa */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 pb-3">
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-amber-300">
              <Crosshair size={14} className="text-amber-400 shrink-0" aria-hidden="true" />
              <span>OPERACIÓN WENO BANK · {meta.operationCode}</span>
            </div>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-cyan-300/90">
              DESTINO: WENO BANK
            </span>
          </div>

          {/* Cabecera institucional obligatoria (§10) */}
          <div className="mt-3.5">
            <p className="text-[11px] sm:text-xs font-mono font-black uppercase tracking-[0.2em] text-amber-400">
              {DATACAR_BRIEFING_HEADER.line1} {DATACAR_BRIEFING_HEADER.line2}
            </p>
            <h2
              id="asuncion-pursuit-title"
              className="mt-1 font-display text-xl sm:text-3xl font-black italic uppercase tracking-tight text-white leading-tight"
            >
              {mission.title}
            </h2>
            <p className="mt-1 text-xs sm:text-[13px] text-cyan-200/95 font-medium">
              {DATACAR_BRIEFING_FIXED_CONTEXT}
            </p>
          </div>

          {/* Briefing particular del circuito + historia breve */}
          <div className="mt-3.5 border-l-2 border-amber-400/85 bg-slate-900/65 px-3.5 py-2.5 sm:px-4 sm:py-3">
            <div
              id="asuncion-pursuit-lore"
              data-testid="asuncion-pursuit-lore-text"
              className="space-y-1 text-xs sm:text-[14.5px] leading-snug text-slate-100 font-medium"
            >
              {mission.briefingLines.map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
            <p className="mt-2 text-[11px] sm:text-xs text-slate-300/90 leading-relaxed">
              {mission.story}
            </p>
          </div>

          {/* Grilla táctica con toda la información de misión (§10) */}
          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 border-y border-slate-800/90 py-3 text-xs">
            <div className="flex items-start gap-2">
              <MapPin size={14} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400">
                  CIRCUITO ORIGINAL
                </div>
                <div className="mt-0.5 font-bold text-white truncate" title={trackName}>
                  {trackName}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {kmFormatted} km · {laps} {laps === 1 ? 'vuelta' : 'vueltas'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <ShieldAlert size={14} className="text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400">
                  ANTAGONISTA FICTICIO
                </div>
                <div className="mt-0.5 font-bold text-amber-100 leading-snug">
                  {mission.antagonistLabel}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Car size={14} className="text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400">
                  VEHÍCULO RIVAL
                </div>
                <div className="mt-0.5 font-bold text-white leading-snug">
                  {mission.rivalVehicleLabel}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Gauge size={14} className="text-cyan-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400">
                  TU MÁQUINA DATACAR
                </div>
                <div className="mt-0.5 font-bold text-white truncate" title={vehicleName}>
                  {vehicleName}
                </div>
                <div className="text-[10px] text-emerald-300/90">
                  {DATACAR_SELECTOR_COPY.beforeStartReady}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Timer size={14} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400">
                  TIEMPO MÁXIMO (LLEGADA RIVAL)
                </div>
                <div className="mt-0.5 font-mono font-bold text-amber-200 tabular-nums">
                  {resolvedMaxTime}
                </div>
                {targetTimeLabel && (
                  <div className="text-[10px] font-mono text-slate-400">
                    Meta Oro: {targetTimeLabel}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Building2 size={14} className="text-cyan-300 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400">
                  DESTINO FINAL
                </div>
                <div className="mt-0.5 font-bold text-cyan-200">
                  {mission.destination}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Llegá antes del cierre
                </div>
              </div>
            </div>
          </div>

          {/* Pie de acción principal */}
          {glbLoadError ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-rose-300">{glbLoadError}</span>
              <div className="flex flex-wrap gap-2">
                {onRetryLoad && (
                  <button
                    type="button"
                    onClick={onRetryLoad}
                    className="border border-slate-600 bg-slate-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Reintentar carga
                  </button>
                )}
                {onFallback3D && (
                  <button
                    type="button"
                    onClick={onFallback3D}
                    className="bg-amber-400 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer"
                  >
                    Largar con rescate 3D
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="sticky bottom-0 z-10 mt-3 -mx-4 sm:-mx-7 px-4 sm:px-7 py-2.5 border-t border-slate-800/95 bg-[#060c15]/95 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="text-[11px] font-mono text-slate-400">
                {sceneReady
                  ? 'Weno Bank y escenario 3D sincronizados · Listo para largar'
                  : 'Sincronizando Weno Bank y escenario 3D de Asunción…'}
              </div>

              <button
                type="button"
                onClick={onAcceptMission}
                data-testid="accept-mission-btn"
                data-start="true"
                className="inline-flex items-center justify-center gap-2.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 px-6 py-2.5 sm:py-3 font-display text-sm sm:text-base font-black italic uppercase tracking-wider text-slate-950 shadow-[0_10px_28px_rgba(245,158,11,0.32)] transition-colors cursor-pointer shrink-0"
              >
                <span>INICIAR MISIÓN</span>
                <ArrowRight size={18} strokeWidth={2.75} aria-hidden="true" />
              </button>
            </div>
          )}

          <p className="mt-2.5 text-[10px] leading-snug text-slate-500">
            {SATIRICAL_FICTION_DISCLAIMER}
          </p>
        </div>
      </div>
    </div>
  );
};


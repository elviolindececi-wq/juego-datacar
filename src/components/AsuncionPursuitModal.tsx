import React, { useEffect } from 'react';
import { ArrowRight, Crosshair, Gauge, MapPin, ShieldAlert } from 'lucide-react';
import {
  ASUNCION_PURSUIT_LORE_TEXT,
  buildPursuitMissionMetadata,
} from '../utils/asuncionPursuitLore';
import type { RaceModeId } from '../utils/careerProgression';

export interface AsuncionPursuitModalProps {
  open: boolean;
  trackName: string;
  trackDistanceMeters: number;
  laps: number;
  vehicleName: string;
  raceMode?: RaceModeId;
  targetTimeLabel?: string;
  sceneReady: boolean;
  glbLoadError: string | null;
  onAcceptMission: () => void;
  onRetryLoad?: () => void;
  onFallback3D?: () => void;
}

/**
 * Pantalla de introducción narrativa ("Persecución en Asunción") renderizada como
 * superposición HTML/React sobre el canvas WebGL activo justo antes de iniciar
 * la cuenta regresiva (3, 2, 1).
 *
 * Nota técnica WebGL: evita deliberadamente backdrop-filter / backdrop-blur sobre
 * el lienzo 3D activo para mantener máxima fluidez de fotogramas en hardware y móvil.
 */
export const AsuncionPursuitModal: React.FC<AsuncionPursuitModalProps> = ({
  open,
  trackName,
  trackDistanceMeters,
  laps,
  vehicleName,
  raceMode = 'city_trial',
  targetTimeLabel,
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
  const kmFormatted = (Math.max(400, trackDistanceMeters) / 1000).toFixed(1).replace('.', ',');

  return (
    <div
      className="absolute inset-0 z-[75] flex items-center justify-center p-3 sm:p-6 pointer-events-auto"
      style={{
        background:
          'radial-gradient(circle at 50% 42%, rgba(7, 13, 22, 0.46) 0%, rgba(4, 8, 15, 0.80) 78%, rgba(2, 5, 10, 0.90) 100%)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="asuncion-pursuit-title"
      aria-describedby="asuncion-pursuit-lore"
      data-testid="asuncion-pursuit-modal"
    >
      <div
        className="relative w-full max-w-[680px] max-h-[92dvh] overflow-y-auto border border-amber-400/35 text-slate-100 shadow-[0_28px_80px_rgba(0,0,0,0.82)]"
        style={{
          backgroundColor: 'rgba(6, 12, 21, 0.94)',
        }}
      >
        {/* Franja superior ámbar de expediente táctico */}
        <div
          className="h-[3px] w-full"
          style={{
            background: 'linear-gradient(90deg, #d97706 0%, #fbbf24 45%, #06b6d4 100%)',
          }}
        />

        <div className="px-5 py-5 sm:px-8 sm:py-7">
          {/* Encabezado de clasificación operativa */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 pb-3.5">
            <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-amber-300">
              <Crosshair size={14} className="text-amber-400 shrink-0" aria-hidden="true" />
              <span>{meta.operationCode}</span>
            </div>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
              {meta.modeClassification}
            </span>
          </div>

          {/* Título principal */}
          <div className="mt-4">
            <p className="text-[11px] font-mono uppercase tracking-[0.24em] text-slate-400">
              EXPEDIENTE CONFIDENCIAL · UNIDAD DE INTERCEPCIÓN DATACAR
            </p>
            <h2
              id="asuncion-pursuit-title"
              className="mt-1 font-display text-2xl sm:text-4xl font-black italic uppercase tracking-tight text-white leading-none"
            >
              PERSECUCIÓN EN ASUNCIÓN
            </h2>
          </div>

          {/* Cuerpo narrativo exacto */}
          <div className="mt-4 sm:mt-5 border-l-2 border-amber-400/80 pl-4 sm:pl-5 py-1">
            <p
              id="asuncion-pursuit-lore"
              data-testid="asuncion-pursuit-lore-text"
              className="text-sm sm:text-[15.5px] leading-relaxed text-slate-200 font-normal"
            >
              {ASUNCION_PURSUIT_LORE_TEXT}
            </p>
          </div>

          {/* Grilla táctica del tramo seleccionado */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 border-y border-slate-800/90 py-3.5 text-xs">
            <div className="flex items-start gap-2.5">
              <MapPin size={15} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-400">
                  TRAMO ASIGNADO
                </div>
                <div className="mt-0.5 font-bold text-white truncate" title={trackName}>
                  {trackName}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {kmFormatted} km · {laps} {laps === 1 ? 'vuelta' : 'vueltas'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Gauge size={15} className="text-cyan-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-400">
                  UNIDAD DE ÉLITE
                </div>
                <div className="mt-0.5 font-bold text-white truncate" title={vehicleName}>
                  {vehicleName}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Telemetría activa
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <ShieldAlert size={15} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-400">
                  DIRECTIVA DE CORTE
                </div>
                <div className="mt-0.5 font-bold text-amber-200 leading-snug">
                  {meta.objectiveSummary}
                </div>
              </div>
            </div>
          </div>

          {/* Pie de acción principal */}
          {glbLoadError ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
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
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-[11px] font-mono text-slate-400">
                {sceneReady
                  ? ' Escenario 3D sincronizado · Listo para largada inmediata'
                  : ' Sincronizando geometría urbana y tránsito de Asunción…'}
              </div>

              <button
                type="button"
                onClick={onAcceptMission}
                data-testid="accept-mission-btn"
                className="inline-flex items-center justify-center gap-2.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 px-6 py-3.5 font-display text-sm sm:text-base font-black italic uppercase tracking-wider text-slate-950 shadow-[0_10px_28px_rgba(245,158,11,0.32)] transition-colors cursor-pointer shrink-0"
              >
                <span>Iniciar Misión</span>
                <ArrowRight size={18} strokeWidth={2.75} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

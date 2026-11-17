import React, { useEffect } from 'react';
import { ShieldAlert, Timer, ExternalLink, Car, Scale, MapPin, Settings } from 'lucide-react';
import {
  DATACAR_PROMO_DOMAIN,
  DATACAR_PROMO_URL,
} from '../utils/comparatorHelpers';

export interface JailLockoutModalProps {
  remainingSec: number;
  incidentCircuit?: string;
  onAcknowledgeRelease?: () => void;
  onExploreWhileLocked?: () => void;
  /** Navegación activa directa hacia las secciones principales sin bloquear la app. */
  onNavigateGarage?: () => void;
  onNavigateComparator?: () => void;
  onNavigateCircuits?: () => void;
  onOpenSettings?: () => void;
}

export const JailLockoutModal: React.FC<JailLockoutModalProps> = ({
  remainingSec,
  incidentCircuit,
  onAcknowledgeRelease,
  onExploreWhileLocked,
  onNavigateGarage,
  onNavigateComparator,
  onNavigateCircuits,
  onOpenSettings,
}) => {
  const activeSeconds = Math.max(0, Math.ceil(remainingSec));

  // Auto-cerrar el modal apenas el contador llegue a 0 para restaurar los controles automáticamente
  useEffect(() => {
    if (activeSeconds <= 0) {
      onAcknowledgeRelease?.();
    }
  }, [activeSeconds, onAcknowledgeRelease]);

  if (activeSeconds <= 0) return null;

  return (
    <div
      data-testid="jail-lockout-modal"
      role="dialog"
      aria-modal="false"
      aria-label="Sanción de cárcel por atropello peatonal"
      className="pointer-events-none fixed inset-x-0 top-[64px] bottom-[12px] z-[90] flex items-center justify-center p-3 select-none"
    >
      <div className="pointer-events-auto relative w-full max-w-md max-h-[calc(100dvh-76px)] overflow-y-auto rounded-2xl border-2 border-rose-500/90 bg-[#090d18]/96 shadow-[0_18px_50px_rgba(0,0,0,0.92),0_0_32px_rgba(244,63,94,0.4)]">
        {/* Baliza policial superior */}
        <div className="sticky top-0 z-10 flex h-2 w-full">
          <div className="h-full w-1/2 animate-pulse bg-rose-500" />
          <div className="h-full w-1/2 animate-pulse bg-sky-500" />
        </div>

        <div className="relative p-3 sm:p-5 text-center">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-rose-400/80 bg-rose-950/90 shadow-[0_0_20px_rgba(244,63,94,0.45)]">
            <ShieldAlert className="h-5 w-5 text-rose-300" />
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/60 bg-rose-950/90 px-3 py-0.5 text-[10px] font-mono font-black uppercase tracking-[0.18em] text-rose-200">
            🚔 CÁRCEL VIAL · 30 SEGUNDOS
          </div>

          {incidentCircuit && (
            <div className="mt-1 text-[11px] font-mono text-slate-400">
              Incidente en: <strong className="text-rose-200">{incidentCircuit}</strong>
            </div>
          )}

          {/* Texto promocional exacto requerido con enlace clicable a www.datacarpy.com */}
          <p
            data-testid="jail-exact-copy"
            className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-100 font-medium"
          >
            ¡Atropellaste a un peatón! Estás en la cárcel por 30 segundos. Mientras esperas, visitá{' '}
            <a
              href={DATACAR_PROMO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-black text-[#00E5F5] underline decoration-[#00E5F5]/80 underline-offset-2 hover:text-amber-300"
            >
              {DATACAR_PROMO_DOMAIN}
            </a>{' '}
            para comparar autos reales del mercado paraguayo.
          </p>

          {/* Contador en vivo de 30 a 0 */}
          <div className="mt-3 rounded-xl border border-rose-500/45 bg-slate-950/95 px-4 py-2">
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
              <Timer className="h-3.5 w-3.5 text-rose-400" />
              <span>CONTROLES RESTAURADOS EN</span>
            </div>
            <div
              data-testid="jail-countdown-seconds"
              className="mt-0.5 font-mono text-3xl sm:text-4xl font-black tracking-wider text-rose-300 tabular-nums"
            >
              {activeSeconds}s
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <a
              href={DATACAR_PROMO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#00E5F5]/75 bg-[#072638] px-3.5 py-2 text-xs font-black uppercase tracking-wider text-[#00E5F5] hover:bg-[#0c364f] transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Visitar {DATACAR_PROMO_DOMAIN}</span>
            </a>
            {onExploreWhileLocked && (
              <button
                type="button"
                onClick={onExploreWhileLocked}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                Ocultar aviso
              </button>
            )}
          </div>

          {/* Navegación rápida no bloqueante para recorrer Garaje / Comparador / Circuitos / Ajustes */}
          {(onNavigateGarage || onNavigateComparator || onNavigateCircuits || onOpenSettings) && (
            <div className="mt-3 border-t border-slate-800/90 pt-2.5">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Recorré otras secciones mientras corre el reloj:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {onNavigateGarage && (
                  <button
                    type="button"
                    onClick={onNavigateGarage}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-cyan-500/50 bg-slate-900/95 px-2 py-1.5 text-[11px] font-black uppercase tracking-wide text-cyan-200 hover:bg-cyan-950/70 cursor-pointer"
                  >
                    <Car className="h-3.5 w-3.5" />
                    <span>Garaje</span>
                  </button>
                )}
                {onNavigateComparator && (
                  <button
                    type="button"
                    onClick={onNavigateComparator}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-400/60 bg-slate-900/95 px-2 py-1.5 text-[11px] font-black uppercase tracking-wide text-amber-200 hover:bg-amber-950/70 cursor-pointer"
                  >
                    <Scale className="h-3.5 w-3.5" />
                    <span>Comparar</span>
                  </button>
                )}
                {onNavigateCircuits && (
                  <button
                    type="button"
                    onClick={onNavigateCircuits}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-900/95 px-2 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-200 hover:bg-slate-800 cursor-pointer"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Circuitos</span>
                  </button>
                )}
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-900/95 px-2 py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-200 hover:bg-slate-800 cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>Ajustes</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

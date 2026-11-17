import React, { useEffect } from 'react';
import { ChevronsRight, ShieldCheck, X } from 'lucide-react';
import {
  DATACAR_INITIAL_INTRO_COPY,
  SATIRICAL_FICTION_DISCLAIMER,
} from '../utils/wenoBankMissions';

export interface WenoBankIntroModalProps {
  open: boolean;
  onAccept: () => void;
  onSkip: () => void;
}

/**
 * Presentación narrativa institucional de ingreso inicial — DATACAR ARENA V10:
 * "FUISTE ELEGIDO. / SOS NUESTRO MEJOR PILOTO."
 *
 * Reglas UX:
 * - Se muestra únicamente en el primer ingreso (o cuando el piloto elige volver a verla).
 * - Permite saltar o aceptar con un toque/clic o Enter/Escape.
 * - Optimizada para celulares y escritorio sin usar backdrop-blur.
 */
export const WenoBankIntroModal: React.FC<WenoBankIntroModalProps> = ({
  open,
  onAccept,
  onSkip,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        onSkip();
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        const tag = (ev.target as HTMLElement | null)?.tagName;
        if (tag === 'BUTTON' || tag === 'A') return;
        ev.preventDefault();
        onAccept();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onAccept, onSkip]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center p-3 sm:p-6 select-none"
      style={{
        background:
          'radial-gradient(circle at 50% 38%, rgba(8, 22, 34, 0.86) 0%, rgba(3, 9, 15, 0.96) 76%, rgba(2, 6, 11, 0.98) 100%)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="weno-intro-headline"
      data-testid="weno-bank-intro-modal"
    >
      <div className="relative w-full max-w-[650px] max-h-[92dvh] overflow-y-auto rounded-2xl border border-[#00E5F5]/45 bg-[#06131E] text-[#F3F7FC] shadow-[0_28px_80px_rgba(0,0,0,0.92)]">
        {/* Franja superior institucional DATACAR ARENA */}
        <div
          className="h-1 w-full"
          style={{
            background: 'linear-gradient(90deg, #00E5F5 0%, #FFAA12 52%, #D97706 100%)',
          }}
        />

        <div className="px-5 py-5 sm:px-8 sm:py-7">
          {/* Cabecera con marca + botón de salto rápido */}
          <div className="flex items-center justify-between gap-3 border-b border-[#00E5F5]/20 pb-3">
            <div>
              <div className="font-display text-sm sm:text-base font-black italic uppercase tracking-[0.18em] text-[#00E5F5]">
                {DATACAR_INITIAL_INTRO_COPY.brand}
              </div>
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-[#FFAA12]">
                {DATACAR_INITIAL_INTRO_COPY.operationTag}
              </div>
            </div>

            <button
              type="button"
              onClick={onSkip}
              data-testid="weno-intro-skip-btn"
              aria-label="Saltar introducción"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0A1D2B] px-3 py-1.5 min-h-[38px] text-xs font-bold text-slate-300 hover:border-[#00E5F5] hover:text-white transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>{DATACAR_INITIAL_INTRO_COPY.ctaSkip}</span>
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          {/* Titulares cinematográficos */}
          <div className="mt-4 sm:mt-5">
            <h2
              id="weno-intro-headline"
              className="font-display text-3xl sm:text-5xl font-black italic uppercase leading-[0.94] tracking-tight text-white"
            >
              <span className="block text-[#FFAA12]">
                {DATACAR_INITIAL_INTRO_COPY.headline1}
              </span>
              <span className="block mt-1 text-[#F3F7FC]">
                {DATACAR_INITIAL_INTRO_COPY.headline2}
              </span>
            </h2>
          </div>

          {/* Mensaje institucional conciso y legible en celular */}
          <div className="mt-4 sm:mt-5 rounded-xl border border-[#00E5F5]/25 bg-[#091D2C] px-4 py-3.5 sm:px-5 sm:py-4 space-y-2 text-sm sm:text-base leading-snug text-slate-100">
            {DATACAR_INITIAL_INTRO_COPY.paragraphs.map((line, index) => (
              <p
                key={line}
                className={
                  index === DATACAR_INITIAL_INTRO_COPY.paragraphs.length - 1
                    ? 'font-bold text-[#FFAA12] pt-0.5'
                    : index === 0
                      ? 'font-semibold text-white'
                      : 'text-slate-200'
                }
              >
                {line}
              </p>
            ))}
          </div>

          {/* Acción principal: ACEPTAR LA MISIÓN */}
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="button"
              onClick={onAccept}
              data-testid="weno-intro-accept-btn"
              data-start="true"
              className="dc-btn-gold w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 min-h-[46px] font-display text-base sm:text-lg font-black italic uppercase tracking-wider cursor-pointer whitespace-nowrap"
            >
              <ChevronsRight size={20} strokeWidth={3} aria-hidden="true" />
              <span>{DATACAR_INITIAL_INTRO_COPY.ctaAccept}</span>
            </button>

            <button
              type="button"
              onClick={onSkip}
              className="sm:hidden w-full rounded-lg border border-slate-700/80 bg-[#081723] py-2.5 min-h-[42px] text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
            >
              {DATACAR_INITIAL_INTRO_COPY.ctaSkip}
            </button>
          </div>

          {/* Aclaración discreta de sátira y ficción */}
          <p className="mt-4 flex items-start gap-1.5 border-t border-slate-800/90 pt-3 text-[11px] leading-relaxed text-slate-400">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-[#00E5F5]/80" aria-hidden="true" />
            <span>{SATIRICAL_FICTION_DISCLAIMER}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

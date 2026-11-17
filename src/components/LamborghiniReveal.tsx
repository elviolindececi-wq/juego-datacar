import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronsRight,
  FastForward,
  Gauge,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';
import { PROYECTO_FANTASMA_LAMBORGHINI } from '../data/presetVehicles';
import { STORY_CONNECTED_MISSIONS, STORY_DIALOGUES_BY_CHAPTER } from '../utils/storyCampaign';
import { LoadingFallbackBadge } from './LoadingFallbackBadge';

const LazyArenaHero3DStage = lazy(() =>
  import('./ArenaHero3DStage').then((m) => ({ default: m.ArenaHero3DStage })),
);

export interface LamborghiniRevealProps {
  open: boolean;
  onStartMission0TestDrive: () => void;
  onSkipPrologueToGarage: () => void;
  onBackToMenu?: () => void;
}

/**
 * Cinemática previa de Misión 0 — Hangar DATACAR y revelación del Lamborghini Proyecto Fantasma (§6).
 * Las luces del hangar se encienden progresivamente y se muestra el archivo GLB real
 * (`/models/lamborghini-bonus.glb`) junto con los objetivos de evaluación.
 */
export const LamborghiniReveal: React.FC<LamborghiniRevealProps> = ({
  open,
  onStartMission0TestDrive,
  onSkipPrologueToGarage,
  onBackToMenu,
}) => {
  // Etapas de iluminación progresiva del hangar: 0 (penumbra) -> 1 (luces laterales) -> 2 (reflectores principales)
  const [lightStage, setLightStage] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    if (!open) return;
    setLightStage(0);
    const t1 = window.setTimeout(() => setLightStage(1), 450);
    const t2 = window.setTimeout(() => setLightStage(2), 1150);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open]);

  if (!open) return null;

  const mission0Spec = STORY_CONNECTED_MISSIONS[0];
  const preDialogues = STORY_DIALOGUES_BY_CHAPTER.mission_0_pre;

  return (
    <div
      data-testid="lamborghini-reveal-cinematic"
      role="dialog"
      aria-modal="true"
      aria-label="Hangar DATACAR — Revelación Lamborghini Proyecto Fantasma"
      className="fixed inset-0 z-[190] flex flex-col justify-between overflow-y-auto bg-[#03070e] text-white select-none"
    >
      {/* ILUMINACIÓN PROGRESIVA DEL HANGAR DATACAR */}
      <div
        className="pointer-events-none fixed inset-0 transition-opacity duration-700"
        style={{
          opacity: lightStage === 0 ? 0.25 : lightStage === 1 ? 0.65 : 1,
          background: `
            radial-gradient(ellipse 55% 35% at 50% 18%, rgba(0, 229, 245, 0.28) 0%, transparent 70%),
            radial-gradient(ellipse 48% 40% at 50% 56%, rgba(245, 158, 11, 0.24) 0%, rgba(4, 12, 20, 0.92) 72%, rgba(2, 5, 10, 0.99) 100%)
          `,
        }}
        aria-hidden="true"
      />

      {/* Haces de reflectores superiores del hangar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex justify-around px-12" aria-hidden="true">
        {[0, 1, 2].map((beamIdx) => (
          <div
            key={beamIdx}
            className={`h-44 w-32 rounded-full blur-2xl transition-all duration-700 ${
              lightStage >= 1
                ? beamIdx === 1
                  ? 'bg-amber-400/25 scale-110'
                  : 'bg-cyan-400/20 scale-100'
                : 'bg-transparent scale-50'
            }`}
          />
        ))}
      </div>

      {/* CABECERA DEL HANGAR DATACAR */}
      <header className="relative z-20 shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[#00E5F5]/25 bg-[#040c16]/90 px-3 py-1.5 sm:px-8 sm:py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Lightbulb
            className={`h-4 w-4 shrink-0 transition-colors ${
              lightStage === 2 ? 'text-[#FFAA12]' : 'text-cyan-400 animate-pulse'
            }`}
          />
          <span className="truncate font-mono text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-[#00E5F5]">
            HANGAR SECRETO DATACAR · LUCES {lightStage === 2 ? '100% ACTIVAS' : 'ENCENDIENDO…'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onSkipPrologueToGarage}
            data-testid="reveal-skip-prologue-btn"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1 min-h-[32px] text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-300 hover:border-amber-400 hover:text-white cursor-pointer"
          >
            <FastForward className="h-3 w-3" />
            <span>Omitir prólogo</span>
          </button>
          {onBackToMenu && (
            <button
              type="button"
              onClick={onBackToMenu}
              className="rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1 min-h-[32px] text-[10px] sm:text-xs font-bold uppercase text-slate-300 hover:text-white cursor-pointer"
            >
              Volver
            </button>
          )}
        </div>
      </header>

      {/* CUERPO PRINCIPAL: LAYOUT LADO A LADO EN MÓVIL HORIZONTAL Y ESCRITORIO */}
      <div className="relative z-20 mx-auto my-auto grid w-full max-w-[1320px] grid-cols-1 landscape:grid-cols-12 md:grid-cols-12 gap-2.5 sm:gap-5 px-3 py-1.5 sm:px-8 sm:py-4 items-center">
        {/* COLUMNA IZQUIERDA: Textos obligatorios y objetivos jugables (§6) */}
        <div className="landscape:col-span-6 md:col-span-5">
          <div className="rounded-2xl border border-[#FFAA12]/55 bg-[#071320]/95 p-2.5 sm:p-5 shadow-[0_18px_50px_rgba(0,0,0,0.85)]">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-[#FFAA12]/50 bg-[#FFAA12]/15 px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-black uppercase tracking-[0.18em] text-[#FFAA12]">
              <Sparkles className="h-3 w-3" />
              <span>UNIDAD PROTOTIPO REVELADA</span>
            </div>

            <div className="mt-1.5 sm:mt-2 space-y-0.5">
              <p
                data-testid="reveal-title-brand"
                className="font-display text-base sm:text-2xl font-black italic uppercase tracking-[0.14em] text-[#00E5F5] leading-none"
              >
                LAMBORGHINI
              </p>
              <h1
                data-testid="reveal-title-project"
                className="font-display text-xl sm:text-4xl lg:text-5xl font-black italic uppercase leading-none tracking-tight text-white"
              >
                PROYECTO FANTASMA
              </h1>
              <p
                data-testid="reveal-title-mission0"
                className="pt-0.5 font-mono text-[9.5px] sm:text-xs font-black uppercase tracking-[0.16em] text-[#FFAA12]"
              >
                MISIÓN 0 — PRUEBA DE CONDUCCIÓN
              </p>
            </div>

            {/* Diálogo exacto de CENTRAL DATACAR */}
            <div className="mt-1.5 sm:mt-2.5 rounded-xl border-l-4 border-[#00E5F5] bg-[#040d17] px-2.5 py-1.5 sm:px-3 sm:py-2 space-y-0.5">
              <p className="text-[9px] sm:text-[9.5px] font-mono font-black uppercase tracking-widest text-[#00E5F5]">
                CENTRAL DATACAR:
              </p>
              {preDialogues.map((msg) => (
                <p key={msg.id} className="text-[11px] sm:text-sm font-bold text-slate-100 leading-snug">
                  "{msg.text}"
                </p>
              ))}
            </div>

            {/* Especificaciones rápidas del Lamborghini */}
            <div className="mt-1.5 sm:mt-2.5 grid grid-cols-3 gap-1.5 border-y border-slate-800 py-1.5 sm:py-2 text-center">
              <div>
                <span className="flex items-center justify-center gap-1 text-[9px] sm:text-[9.5px] font-bold uppercase text-slate-400">
                  <Zap className="h-3 w-3 text-[#FFAA12]" /> Potencia
                </span>
                <p className="font-display text-xs sm:text-lg font-black italic text-white">640 HP</p>
              </div>
              <div>
                <span className="flex items-center justify-center gap-1 text-[9px] sm:text-[9.5px] font-bold uppercase text-slate-400">
                  <Timer className="h-3 w-3 text-[#00E5F5]" /> 0–100
                </span>
                <p className="font-display text-xs sm:text-lg font-black italic text-[#00E5F5]">2,9 s</p>
              </div>
              <div>
                <span className="flex items-center justify-center gap-1 text-[9px] sm:text-[9.5px] font-bold uppercase text-slate-400">
                  <Gauge className="h-3 w-3 text-emerald-400" /> Tracción
                </span>
                <p className="font-display text-xs sm:text-lg font-black italic text-emerald-300">AWD V10</p>
              </div>
            </div>

            {/* Objetivos jugables de la Misión 0 */}
            <div className="mt-2 sm:mt-2.5 space-y-1 [@media(max-height:520px)]:hidden">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                OBJETIVOS DE LA PRUEBA (60–90 S):
              </p>
              <ul className="space-y-0.5 text-[11px] text-slate-200">
                {mission0Spec.playableChecklist.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#00E5F5]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-2 sm:mt-3">
              <button
                type="button"
                onClick={onStartMission0TestDrive}
                data-testid="start-mission-0-btn"
                data-start="true"
                className="dc-btn-gold w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 sm:px-4 py-2 sm:py-3.5 min-h-[38px] sm:min-h-[42px] font-display text-xs sm:text-lg font-black italic uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(255,170,18,0.4)] cursor-pointer"
              >
                <ChevronsRight className="h-4 w-4 sm:h-5 sm:w-5 stroke-[3]" />
                <span>INICIAR MISIÓN 0 · PROBAR LAMBORGHINI</span>
              </button>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: Escenario 3D del Hangar con el archivo GLB real `/models/lamborghini-bonus.glb` */}
        <div className="landscape:col-span-6 md:col-span-7">
          <div className="relative h-[210px] landscape:h-[calc(100dvh-4.25rem)] sm:h-[400px] lg:h-[440px] w-full overflow-hidden rounded-2xl border-2 border-[#00E5F5]/45 bg-[#050f19] shadow-[0_24px_70px_rgba(0,0,0,0.92)]">
            <div
              className="pointer-events-none absolute inset-0 transition-opacity duration-700"
              style={{
                opacity: lightStage === 0 ? 0.3 : lightStage === 1 ? 0.75 : 1,
                background:
                  'radial-gradient(circle at 50% 62%, rgba(245, 158, 11, 0.24) 0%, rgba(0, 229, 245, 0.12) 42%, rgba(4, 10, 18, 0.95) 85%)',
              }}
            />

            <div className="relative z-10 h-full w-full">
              <Suspense
                fallback={
                  <LoadingFallbackBadge
                    compact
                    label="Encendiendo luces del hangar y cargando modelo 3D Lamborghini Proyecto Fantasma…"
                  />
                }
              >
                <LazyArenaHero3DStage
                  vehicle={PROYECTO_FANTASMA_LAMBORGHINI}
                  pngOnly={false}
                  imageBadgeLabel="MODELO 3D REAL · PROYECTO FANTASMA (lamborghini-bonus.glb)"
                />
              </Suspense>
            </div>

            <div className="pointer-events-none absolute bottom-3 inset-x-4 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-[#030912]/90 px-3.5 py-2 text-[11px] font-mono text-slate-300">
              <span className="inline-flex items-center gap-1.5 text-[#00E5F5] font-bold">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>GLB ACTIVO: /models/lamborghini-bonus.glb</span>
              </span>
              <span className="text-amber-300">Arrastrá horizontalmente para inspeccionar en 360°</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

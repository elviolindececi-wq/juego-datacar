import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  FastForward,
  Play,
  ShieldCheck,
  Sparkles,
  Sun,
  Trophy,
} from 'lucide-react';
import { PROYECTO_FANTASMA_LAMBORGHINI } from '../data/presetVehicles';
import { STORY_DIALOGUES_BY_CHAPTER } from '../utils/storyCampaign';
import { DatacarPhoneMessages } from './DatacarPhoneMessages';
import { LoadingFallbackBadge } from './LoadingFallbackBadge';

const LazyArenaHero3DStage = lazy(() =>
  import('./ArenaHero3DStage').then((m) => ({ default: m.ArenaHero3DStage })),
);

export interface LamborghiniRecoveryCinematicProps {
  open: boolean;
  initialStage?: 'hangar_recovery' | 'sunrise_epilogue';
  onFinishEpilogueAndContinue: () => void;
  onDriveRecoveredLamborghini?: () => void;
}

/**
 * Cinemática de Recuperación Final del Lamborghini (§12) + Epílogo "La Ciudad Sigue Corriendo" (§13).
 */
export const LamborghiniRecoveryCinematic: React.FC<LamborghiniRecoveryCinematicProps> = ({
  open,
  initialStage = 'hangar_recovery',
  onFinishEpilogueAndContinue,
  onDriveRecoveredLamborghini,
}) => {
  const [stage, setStage] = useState<'hangar_recovery' | 'sunrise_epilogue'>(initialStage);
  const [doorsOpened, setDoorsOpened] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStage(initialStage);
    setDoorsOpened(false);
    const timer = window.setTimeout(() => setDoorsOpened(true), 450);
    return () => window.clearTimeout(timer);
  }, [open, initialStage]);

  if (!open) return null;

  return (
    <div
      data-testid="lamborghini-recovery-cinematic"
      role="dialog"
      aria-modal="true"
      aria-label="Recuperación Final del Proyecto Fantasma y Epílogo"
      className="fixed inset-0 z-[195] flex flex-col justify-between overflow-y-auto bg-[#03070e] text-white select-none"
    >
      {/* FONDO SEGÚN LA ETAPA: HANGAR ASEGURADO O ASUNCIÓN AL AMANECER */}
      <div
        className="pointer-events-none fixed inset-0 transition-all duration-1000"
        style={{
          background:
            stage === 'hangar_recovery'
              ? 'radial-gradient(circle at 50% 48%, rgba(245, 158, 11, 0.25) 0%, rgba(0, 229, 245, 0.14) 42%, rgba(3, 8, 15, 0.98) 100%)'
              : 'linear-gradient(180deg, rgba(251, 146, 60, 0.34) 0%, rgba(245, 158, 11, 0.20) 32%, rgba(8, 25, 42, 0.92) 72%, rgba(3, 9, 16, 0.98) 100%)',
        }}
        aria-hidden="true"
      />

      {/* CABECERA */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-[#040c16]/90 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-2.5">
          {stage === 'hangar_recovery' ? (
            <Sparkles className="h-4 w-4 text-[#FFAA12]" />
          ) : (
            <Sun className="h-4 w-4 text-amber-400" />
          )}
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#00E5F5]">
            {stage === 'hangar_recovery'
              ? 'HANGAR ASEGURADO · PROYECTO FANTASMA RECUPERADO'
              : 'EPÍLOGO · LA CIUDAD SIGUE CORRIENDO · ASUNCIÓN AL AMANECER'}
          </span>
        </div>

        <button
          type="button"
          onClick={onFinishEpilogueAndContinue}
          data-testid="recovery-skip-btn"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 min-h-[36px] text-xs font-bold uppercase tracking-wider text-slate-300 hover:border-amber-400 hover:text-white cursor-pointer"
        >
          <FastForward className="h-3.5 w-3.5" />
          <span>Omitir cinemática</span>
        </button>
      </header>

      {/* CUERPO PRINCIPAL */}
      <div className="relative z-20 mx-auto my-auto w-full max-w-[1320px] px-4 py-5 sm:px-8">
        {stage === 'hangar_recovery' ? (
          /* ETAPA 1: PUERTAS DEL HANGAR ABRIÉNDOSE Y REVELACIÓN DE RECOMPENSA (§12) */
          <div
            data-testid="stage-hangar-recovery"
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
          >
            {/* Izquierda: Textos de victoria y desbloqueo */}
            <div className="lg:col-span-5 space-y-4 rounded-2xl border-2 border-[#FFAA12]/70 bg-[#081320]/95 p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.92)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/20 px-3.5 py-1 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>HANGAR DEL AEROPUERTO ASEGURADO</span>
              </div>

              <div className="space-y-1">
                <h1
                  data-testid="lamborghini-recovered-headline"
                  className="font-display text-3xl sm:text-5xl font-black italic uppercase leading-none text-white"
                >
                  LAMBORGHINI RECUPERADO
                </h1>
                <p
                  data-testid="bonus-vehicle-unlocked-subheadline"
                  className="font-display text-lg sm:text-2xl font-black italic uppercase tracking-[0.14em] text-[#FFAA12]"
                >
                  VEHÍCULO BONUS DESBLOQUEADO
                </p>
              </div>

              {/* Diálogo exacto de CENTRAL DATACAR */}
              <div className="rounded-xl border-l-4 border-[#00E5F5] bg-[#040d17] p-4 space-y-1.5">
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#00E5F5]">
                  CENTRAL DATACAR:
                </p>
                {STORY_DIALOGUES_BY_CHAPTER.recovery_victory.map((msg) => (
                  <p key={msg.id} className="text-sm sm:text-base font-bold text-slate-100">
                    "{msg.text}"
                  </p>
                ))}
              </div>

              <div className="rounded-xl border border-amber-400/35 bg-amber-950/35 p-3.5 text-xs text-amber-100 leading-relaxed">
                <p className="font-bold uppercase tracking-wider text-[#FFAA12]">
                  Recompensa de Campaña Desbloqueada:
                </p>
                <p className="mt-1">
                  El <strong>Lamborghini Proyecto Fantasma</strong> queda habilitado en tu Garaje para <strong>carrera libre y desafíos especiales</strong>. No forma parte del catálogo comercial de comparación de DATACAR.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStage('sunrise_epilogue')}
                data-testid="to-sunrise-epilogue-btn"
                data-start="true"
                className="dc-btn-gold w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 min-h-[48px] font-display text-base sm:text-lg font-black italic uppercase tracking-wider text-slate-950 cursor-pointer"
              >
                <span>Continuar al Epílogo · Amanecer en Asunción</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Derecha: Puertas del hangar abriéndose y acercamiento de cámara al Lamborghini 3D */}
            <div className="lg:col-span-7">
              <div className="relative h-[340px] sm:h-[460px] w-full overflow-hidden rounded-2xl border-2 border-[#FFAA12]/60 bg-[#050f19] shadow-[0_24px_75px_rgba(0,0,0,0.95)]">
                {/* Compuertas del hangar que se abren lateralmente */}
                <div
                  className={`pointer-events-none absolute inset-y-0 left-0 z-30 w-1/2 border-r border-amber-400/40 bg-[#040a12] transition-transform duration-1000 ${
                    doorsOpened ? '-translate-x-full' : 'translate-x-0'
                  }`}
                />
                <div
                  className={`pointer-events-none absolute inset-y-0 right-0 z-30 w-1/2 border-l border-amber-400/40 bg-[#040a12] transition-transform duration-1000 ${
                    doorsOpened ? 'translate-x-full' : 'translate-x-0'
                  }`}
                />

                <div
                  className={`relative z-10 h-full w-full transition-transform duration-1000 ${
                    doorsOpened ? 'scale-105' : 'scale-95'
                  }`}
                >
                  <Suspense
                    fallback={
                      <LoadingFallbackBadge
                        compact
                        label="Abriendo puertas del hangar y encendiendo luces sobre el Proyecto Fantasma…"
                      />
                    }
                  >
                    <LazyArenaHero3DStage
                      vehicle={PROYECTO_FANTASMA_LAMBORGHINI}
                      pngOnly={false}
                      imageBadgeLabel="LAMBORGHINI RECUPERADO · UNIDAD BONUS DESBLOQUEADA"
                    />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ETAPA 2: EPÍLOGO — LA CIUDAD SIGUE CORRIENDO (§13) */
          <div
            data-testid="stage-sunrise-epilogue"
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
          >
            {/* Izquierda: Escena de Asunción al amanecer con el Lamborghini circulando sin persecución */}
            <div className="lg:col-span-7 space-y-4 rounded-2xl border-2 border-amber-400/60 bg-[#09131e]/95 p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.95)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/25 pb-3">
                <div className="inline-flex items-center gap-2 text-xs font-mono font-black uppercase tracking-widest text-amber-300">
                  <Sun className="h-4 w-4 text-amber-400" />
                  <span>ASUNCIÓN, PARAGUAY · 06:12 HS · AL AMANECER</span>
                </div>
                <span className="rounded bg-amber-400/20 border border-amber-400/50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-200">
                  SIN PERSECUCIÓN · RECORRIDO LIBRE
                </span>
              </div>

              {/* Vista panorámica al amanecer con cámara alejándose lentamente */}
              <div className="relative h-56 sm:h-64 w-full overflow-hidden rounded-xl border border-amber-400/40 bg-[#0d1826]">
                <img
                  src="/assets/aistudio/calle_hist_rica_de_asunci_n_al_atardecer_e19f74fb.webp"
                  alt="Asunción al amanecer"
                  className="h-full w-full object-cover object-center opacity-70 scale-105 transition-transform duration-1000"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(251, 146, 60, 0.35) 0%, rgba(15, 23, 42, 0.35) 55%, rgba(4, 10, 18, 0.92) 100%)',
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-end p-4 text-center">
                  <img
                    src={PROYECTO_FANTASMA_LAMBORGHINI.imageUrl}
                    alt="Lamborghini Proyecto Fantasma circulando al amanecer"
                    className="h-28 sm:h-36 w-auto object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.95)]"
                  />
                  <p className="mt-1 text-xs font-mono text-amber-200">
                    El Lamborghini circula por la avenida mientras el sol asoma sobre Asunción…
                  </p>
                </div>
              </div>

              {/* Cartel Final de Temporada + Conexión con Persecución en Asunción (§13 y §16) */}
              <div
                data-testid="season-1-finale-banner"
                className="rounded-xl border-2 border-[#00E5F5]/65 bg-gradient-to-r from-[#061826] via-[#0c2135] to-[#1d1405] p-4 sm:p-5 text-center space-y-2"
              >
                <p className="font-display text-2xl sm:text-4xl font-black italic uppercase tracking-[0.14em] text-white">
                  DATACAR ARENA
                </p>
                <p className="font-mono text-xs sm:text-sm font-black uppercase tracking-[0.26em] text-[#FFAA12]">
                  FIN DE LA PRIMERA TEMPORADA.
                </p>
                <p className="text-xs text-slate-300 max-w-xl mx-auto">
                  El mensaje desconocido anticipa una nueva red activa en la ciudad. La modalidad secundaria <strong>Persecución en Asunción</strong> y todos los circuitos quedan abiertos para correr con tu <strong>Lamborghini Proyecto Fantasma</strong> o cualquiera de los 7 vehículos de la flota.
                </p>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  {onDriveRecoveredLamborghini && (
                    <button
                      type="button"
                      onClick={onDriveRecoveredLamborghini}
                      data-testid="epilogue-drive-lamborghini-btn"
                      className="dc-btn-gold inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-xs sm:text-sm font-black italic uppercase text-slate-950 cursor-pointer"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>Conducir Lamborghini en Carrera Libre</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onFinishEpilogueAndContinue}
                    data-testid="epilogue-finish-continue-btn"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#00E5F5]/65 bg-[#082233] px-5 py-3 text-xs sm:text-sm font-black italic uppercase text-[#00E5F5] hover:bg-[#0c3149] cursor-pointer"
                  >
                    <Trophy className="h-4 w-4" />
                    <span>Continuar Jugando en DATACAR ARENA</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Derecha: Último mensaje en el teléfono + Remitente Desconocido (§13) */}
            <div className="lg:col-span-5">
              <DatacarPhoneMessages
                messages={STORY_DIALOGUES_BY_CHAPTER.epilogue_messages}
                chapterTitle="EPÍLOGO · TEMPORADA 1"
                headerBadge="MENSAJE ENTRANDO…"
                acceptLabel="FINALIZAR TEMPORADA 1 Y CONTINUAR"
                onAccept={onFinishEpilogueAndContinue}
                onSkip={onFinishEpilogueAndContinue}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

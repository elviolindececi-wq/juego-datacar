import React, { useEffect, useRef, useState } from 'react';
import { FastForward, Lock, Radio, ShieldAlert, Smartphone, X } from 'lucide-react';
import {
  STORY_DIALOGUES_BY_CHAPTER,
  STORY_INTRO_10S_TIMELINE,
} from '../utils/storyCampaign';
import { resolveIntroCinematicCueAtTime } from '../utils/NarrativeDirector';
import { soundEngine } from '../utils/soundEngine';
import { DatacarPhoneMessages } from './DatacarPhoneMessages';

export interface StoryIntroCinematicProps {
  open: boolean;
  initialPhase?: 'cinematic_10s' | 'phone_recruitment';
  onIntroVideoCompleted?: () => void;
  onAcceptMission: () => void;
  onPostponeToMenu: () => void;
  onSkipPrologueToGarage: () => void;
}

const INTRO_DURATION_SEC = 10.0;

/**
 * Cinemática de apertura de 10 segundos + Conversación interactiva en teléfono (§4 y §5).
 * Sincroniza con precisión el cronograma 00:00–00:10 mediante requestAnimationFrame
 * y presenta una escena nocturna generada de Asunción (23:47 HS) con soporte opcional
 * para `/videos/datacar-intro.mp4` (`playsInline`, `muted`, sin barras nativas).
 */
export const StoryIntroCinematic: React.FC<StoryIntroCinematicProps> = ({
  open,
  initialPhase = 'cinematic_10s',
  onIntroVideoCompleted,
  onAcceptMission,
  onPostponeToMenu,
  onSkipPrologueToGarage,
}) => {
  const [phase, setPhase] = useState<'cinematic_10s' | 'phone_recruitment'>(initialPhase);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [videoAvailable, setVideoAvailable] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setPhase(initialPhase);
    setElapsedSec(0);
    completedRef.current = false;
  }, [open, initialPhase]);

  useEffect(() => {
    if (!open || phase !== 'cinematic_10s') return;

    let rafId = 0;
    const startMs = performance.now();

    const tick = (nowMs: number) => {
      const sec = Math.min(INTRO_DURATION_SEC, (nowMs - startMs) / 1000);
      setElapsedSec(sec);
      if (sec >= INTRO_DURATION_SEC) {
        if (!completedRef.current) {
          completedRef.current = true;
          onIntroVideoCompleted?.();
          setPhase('phone_recruitment');
        }
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [open, phase, onIntroVideoCompleted]);

  if (!open) return null;

  const activeCue = resolveIntroCinematicCueAtTime(elapsedSec);
  const lastSoundCueIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || phase !== 'cinematic_10s' || !activeCue) return;
    if (activeCue.kind === 'phone_notification' && lastSoundCueIdRef.current !== activeCue.id) {
      lastSoundCueIdRef.current = activeCue.id;
      try {
        soundEngine.playMessageNotification();
      } catch {
        // Ignorar si autoplay bloqueado antes del primer toque
      }
    }
  }, [open, phase, activeCue]);
  const progressPercent = Math.min(100, Math.round((elapsedSec / INTRO_DURATION_SEC) * 100));

  const skip10sToPhone = () => {
    if (!completedRef.current) {
      completedRef.current = true;
      onIntroVideoCompleted?.();
    }
    setElapsedSec(INTRO_DURATION_SEC);
    setPhase('phone_recruitment');
  };

  return (
    <div
      data-testid="story-intro-cinematic"
      role="dialog"
      aria-modal="true"
      aria-label="Apertura Operación WENO — El Proyecto Fantasma"
      className="fixed inset-0 z-[190] flex flex-col justify-between overflow-hidden bg-[#02060c] text-white select-none"
    >
      {/* ESCENA CINEMATOGRÁFICA NOCTURNA DE ASUNCIÓN 23:47 HS (Generada en tiempo real + soporte opcional de video) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <video
          ref={videoRef}
          src="/videos/datacar-intro.mp4"
          playsInline
          muted
          autoPlay
          onCanPlay={() => setVideoAvailable(true)}
          onError={() => setVideoAvailable(false)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            videoAvailable ? 'opacity-80' : 'opacity-0'
          }`}
        />

        {/* Fondo nocturno táctico generado al instante (0ms sin imágenes pesadas en móvil) */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 50% 42%, rgba(0, 229, 245, 0.22) 0%, rgba(7, 21, 36, 0.92) 55%, rgba(2, 6, 12, 0.99) 100%),
              linear-gradient(180deg, #030a14 0%, #071b2d 48%, #02060c 100%)
            `,
          }}
        />

        {/* Estelas dinámicas de tráfico nocturno en Aviadores del Chaco y cuadrícula táctica */}
        <svg
          viewBox="0 0 1200 680"
          className="absolute inset-0 h-full w-full opacity-55"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="cyanTrail" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00E5F5" stopOpacity="0" />
              <stop offset="60%" stopColor="#00E5F5" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="amberTrail" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
              <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#fde047" stopOpacity="0.95" />
            </linearGradient>
          </defs>
          {/* Horizonte y perspectiva vial nocturna */}
          <line x1="0" y1="430" x2="1200" y2="430" stroke="#00E5F5" strokeOpacity="0.22" strokeWidth="1" />
          <path d="M 560 430 L 140 680" stroke="#00E5F5" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M 640 430 L 1060 680" stroke="#f59e0b" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M 600 430 L 600 680" stroke="#ffffff" strokeOpacity="0.18" strokeDasharray="16 14" strokeWidth="2" />

          {/* Estelas animadas según elapsedSec */}
          <line
            x1={250 + elapsedSec * 38}
            y1={560 - elapsedSec * 8}
            x2={420 + elapsedSec * 46}
            y2={520 - elapsedSec * 9}
            stroke="url(#cyanTrail)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1={880 - elapsedSec * 32}
            y1={545 - elapsedSec * 7}
            x2={720 - elapsedSec * 40}
            y2={510 - elapsedSec * 8}
            stroke="url(#amberTrail)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* BARRA SUPERIOR DE CONTROL (OMITIR INTRODUCCIÓN / ESTADO DE TRANSMISIÓN) */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-[#030912]/85 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Radio className="h-4 w-4 animate-pulse text-[#00E5F5]" />
          <span className="font-display text-xs sm:text-sm font-black italic uppercase tracking-[0.2em] text-[#00E5F5]">
            DATACAR ARENA · OPERACIÓN WENO
          </span>
          <span className="hidden sm:inline rounded border border-amber-400/45 bg-amber-950/60 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-300">
            EL PROYECTO FANTASMA
          </span>
        </div>

        <div className="flex items-center gap-2">
          {phase === 'cinematic_10s' && (
            <button
              type="button"
              onClick={skip10sToPhone}
              data-testid="skip-10s-video-btn"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#00E5F5]/50 bg-[#071a29]/90 px-3 py-1.5 min-h-[38px] text-xs font-bold uppercase tracking-wider text-cyan-200 hover:border-[#00E5F5] hover:text-white cursor-pointer"
            >
              <FastForward className="h-3.5 w-3.5" />
              <span>Ir al teléfono</span>
            </button>
          )}
          <button
            type="button"
            onClick={onPostponeToMenu}
            data-testid="intro-close-to-menu-btn"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 min-h-[38px] text-xs font-bold uppercase tracking-wider text-slate-300 hover:border-slate-400 hover:text-white cursor-pointer"
          >
            <span>Menú principal</span>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* CONTENIDO CENTRAL: FASE 1 (SOBREIMPRESOS 00:00–00:10) O FASE 2 (TELÉFONO INTERACTIVO) */}
      <div className="relative z-20 flex flex-1 flex-col items-center justify-center px-4 py-4 sm:px-8">
        {phase === 'cinematic_10s' && activeCue ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center text-center">
            {/* 00:00–00:02: ASUNCIÓN, PARAGUAY / 23:47 HS. */}
            {activeCue.kind === 'location_timestamp' && (
              <div
                data-testid="intro-cue-location"
                className="space-y-2 rounded-2xl border border-white/15 bg-black/45 px-8 py-6 shadow-2xl"
              >
                <p className="font-mono text-xs sm:text-sm font-semibold uppercase tracking-[0.38em] text-slate-300">
                  TRANSMISIÓN NOCTURNA EN VIVO
                </p>
                <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-light tracking-[0.22em] text-white uppercase">
                  {activeCue.headline}
                </h1>
                {activeCue.subline && (
                  <p className="font-mono text-xl sm:text-2xl font-bold tracking-[0.32em] text-cyan-200">
                    {activeCue.subline}
                  </p>
                )}
              </div>
            )}

            {/* 00:02–00:08: Notificaciones de teléfono CENTRAL DATACAR */}
            {activeCue.kind === 'phone_notification' && (
              <div
                data-testid={`intro-cue-${activeCue.id}`}
                className={`w-full max-w-lg rounded-2xl border-2 border-[#00E5F5]/75 bg-[#051523]/95 p-5 sm:p-6 text-left shadow-[0_20px_60px_rgba(0,0,0,0.92),0_0_30px_rgba(0,229,245,0.28)] transition-transform ${
                  activeCue.vibrate ? 'animate-bounce' : ''
                }`}
              >
                <div className="flex items-center justify-between border-b border-[#00E5F5]/25 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00E5F5]/20 border border-[#00E5F5]/60 text-[#00E5F5]">
                      <Smartphone className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#FFAA12]">
                        NOTIFICACIÓN ENTRANTE
                      </p>
                      <p className="font-display text-sm sm:text-base font-black italic uppercase tracking-wider text-white">
                        {activeCue.sender}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#00E5F5]">23:47</span>
                </div>
                <p className="mt-4 font-display text-xl sm:text-2xl md:text-3xl font-black italic uppercase leading-tight tracking-wide text-white">
                  {activeCue.headline}
                </p>
              </div>
            )}

            {/* 00:08–00:10: PROYECTO FANTASMA / ARCHIVO CONFIDENCIAL */}
            {activeCue.kind === 'confidential_stamp' && (
              <div
                data-testid="intro-cue-confidential"
                className="w-full max-w-xl rounded-2xl border-2 border-[#FFAA12]/80 bg-[#0b131e]/95 px-7 py-7 text-center shadow-[0_24px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(255,170,18,0.28)]"
              >
                <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-[#FFAA12]/60 bg-[#FFAA12]/15 px-4 py-1 text-xs font-mono font-black uppercase tracking-[0.25em] text-[#FFAA12]">
                  <Lock className="h-3.5 w-3.5" />
                  <span>EXPEDIENTE NIVEL OMEGA</span>
                </div>
                <h2 className="font-display text-4xl sm:text-6xl font-black italic uppercase tracking-[0.12em] text-white drop-shadow">
                  {activeCue.headline}
                </h2>
                {activeCue.subline && (
                  <p className="mt-2 font-mono text-sm sm:text-lg font-bold uppercase tracking-[0.28em] text-[#00E5F5]">
                    {activeCue.subline}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* FASE 2: CONVERSACIÓN INTERACTIVA EN EL TELÉFONO (§5) */
          <div className="w-full max-w-lg">
            <DatacarPhoneMessages
              messages={STORY_DIALOGUES_BY_CHAPTER.recruitment_phone}
              chapterTitle="RECLUTAMIENTO · HANGAR DATACAR"
              headerBadge="CANAL CONFIDENCIAL"
              isRecruitmentPrompt
              acceptLabel="ACEPTAR MISIÓN"
              declineLabel="AHORA NO"
              skipLabel="Cerrar"
              onAccept={onAcceptMission}
              onDecline={onPostponeToMenu}
              onSkip={onPostponeToMenu}
              onSkipPrologueToGarage={onSkipPrologueToGarage}
            />
          </div>
        )}
      </div>

      {/* BARRA INFERIOR DE CRONOGRAMA DE 10 SEGUNDOS */}
      <footer className="relative z-20 border-t border-slate-800/80 bg-[#030912]/90 px-4 py-2.5 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          {phase === 'cinematic_10s' ? (
            <>
              <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
                <span className="text-[#00E5F5] font-bold">
                  00:{String(Math.min(10, Math.floor(elapsedSec))).padStart(2, '0')} / 00:10
                </span>
                <div className="h-1.5 w-36 sm:w-56 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-[#00E5F5] to-[#FFAA12] transition-all duration-100"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {STORY_INTRO_10S_TIMELINE.map((cue, idx) => {
                  const active = activeCue?.id === cue.id;
                  return (
                    <span
                      key={cue.id}
                      className={`h-2 w-2 rounded-full ${
                        active ? 'bg-[#FFAA12] scale-125' : elapsedSec >= cue.endSec ? 'bg-[#00E5F5]' : 'bg-slate-700'
                      }`}
                      title={`Segmento ${idx + 1}`}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex w-full items-center justify-between text-[11px] font-mono text-slate-400">
              <span>ASUNCIÓN, PARAGUAY · 23:47 HS · HANGAR DATACAR</span>
              <span className="text-[#00E5F5]">ESPERANDO CONFIRMACIÓN DEL PILOTO</span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

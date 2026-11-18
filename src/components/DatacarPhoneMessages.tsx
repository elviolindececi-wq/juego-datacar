import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  FastForward,
  FileWarning,
  Lock,
  MapPin,
  MessageSquare,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Wifi,
  X,
} from 'lucide-react';
import type { StoryDialogueMessage } from '../utils/storyCampaign';
import { soundEngine } from '../utils/soundEngine';

export interface DatacarPhoneMessagesProps {
  messages: readonly StoryDialogueMessage[];
  chapterTitle?: string;
  headerBadge?: string;
  /** Si es la escena de reclutamiento, muestra ACEPTAR MISIÓN y AHORA NO */
  isRecruitmentPrompt?: boolean;
  acceptLabel?: string;
  declineLabel?: string;
  skipLabel?: string;
  onAccept: () => void;
  onDecline?: () => void;
  onSkip?: () => void;
  /** Permite saltar el prólogo explícitamente hacia el garaje comercial sin regalar victorias */
  onSkipPrologueToGarage?: () => void;
}

/**
 * Interfaz de teléfono seguro encriptado de CENTRAL DATACAR (§5 y §18).
 * Presenta mensajes secuenciales con indicador de escritura, adjuntos confidenciales,
 * avance manual o automático seguro (limpiando temporizadores al desmontar) y botones táctiles grandes.
 */
export const DatacarPhoneMessages: React.FC<DatacarPhoneMessagesProps> = ({
  messages,
  chapterTitle = 'CANAL ENCRIPTADO · CENTRAL DATACAR',
  headerBadge = 'CONEXIÓN SEGURA AES-256',
  isRecruitmentPrompt = false,
  acceptLabel = 'ACEPTAR MISIÓN',
  declineLabel = 'AHORA NO',
  skipLabel = 'Omitir',
  onAccept,
  onDecline,
  onSkip,
  onSkipPrologueToGarage,
}) => {
  const totalCount = messages.length;
  const [visibleCount, setVisibleCount] = useState(1);
  const [isTyping, setIsTyping] = useState(() => totalCount > 1);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const [hangarPreloadPercent, setHangarPreloadPercent] = useState<number>(0);

  // Precargar en segundo plano el GLB del Lamborghini Proyecto Fantasma mientras el jugador lee los mensajes
  useEffect(() => {
    if (!isRecruitmentPrompt) return;
    let cancelled = false;
    import('../utils/vehicle3DModelLoader')
      .then(({ resolveDedicatedVehicleGLTF }) =>
        resolveDedicatedVehicleGLTF(
          'lamborghini-proyecto-fantasma',
          (loaded, total) => {
            if (cancelled || total <= 0) return;
            setHangarPreloadPercent(Math.min(100, Math.round((loaded / total) * 100)));
          },
          '/models/Lamborghini prototipo.glb',
        ),
      )
      .then((res) => {
        if (!cancelled && res) setHangarPreloadPercent(100);
      })
      .catch(() => {
        // Silencioso: el hangar volverá a intentar si hace falta
      });
    return () => {
      cancelled = true;
    };
  }, [isRecruitmentPrompt]);

  useEffect(() => {
    const el = messageListRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: visibleCount <= 1 ? 'auto' : 'smooth',
    });
  }, [visibleCount, isTyping]);

  const allRevealed = visibleCount >= totalCount;
  const visibleMessages = messages.slice(0, visibleCount);
  const currentLastMessage = visibleMessages[visibleMessages.length - 1];

  useEffect(() => {
    if (visibleCount >= totalCount) {
      setIsTyping(false);
      return;
    }
    setIsTyping(true);
    const currentMsg = messages[visibleCount - 1];
    const baseDelay = currentMsg?.minReadDurationMs ?? 950;
    const pauseExtra = currentMsg?.isPauseAfter ? 650 : 0;

    const timerId = window.setTimeout(() => {
      setVisibleCount((prev) => Math.min(totalCount, prev + 1));
      if (!soundEngine.getIsMuted()) {
        try {
          soundEngine.playMessageNotification();
        } catch {
          // Respetar políticas de autoplay del navegador
        }
      }
    }, baseDelay + pauseExtra);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [visibleCount, totalCount, messages]);

  const handleAdvanceStep = () => {
    if (!allRevealed) {
      setVisibleCount((prev) => Math.min(totalCount, prev + 1));
      setIsTyping(visibleCount + 1 < totalCount);
      if (!soundEngine.getIsMuted()) {
        try {
          soundEngine.playMessageNotification();
        } catch {
          // Respetar políticas de autoplay del navegador
        }
      }
    } else {
      onAccept();
    }
  };

  const handleRevealAll = () => {
    setVisibleCount(totalCount);
    setIsTyping(false);
  };

  return (
    <div
      data-testid="datacar-phone-interface"
      className="relative mx-auto flex w-full max-w-[460px] max-h-[calc(100dvh-6.2rem)] flex-col overflow-hidden rounded-[24px] sm:rounded-[28px] border-2 border-[#00E5F5]/55 bg-[#040d16]/98 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.95),0_0_35px_rgba(0,229,245,0.22)] select-none"
      role="region"
      aria-label="Teléfono encriptado DATACAR"
    >
      {/* Barra de estado del teléfono táctico */}
      <div className="shrink-0 flex items-center justify-between border-b border-[#00E5F5]/20 bg-[#02080e] px-4 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-[#00E5F5]">
        <div className="flex items-center gap-1.5">
          <Radio className="h-3 w-3 animate-pulse text-[#FFAA12]" />
          <span>DATACAR SECURE OS</span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <span>23:47 HS · ASU</span>
          <Wifi className="h-3 w-3 text-[#00E5F5]" />
        </div>
      </div>

      {/* Cabecera del remitente */}
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-800/90 bg-[#071624] px-3.5 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00E5F5]/60 bg-[#00E5F5]/15 text-[#00E5F5] shadow-[0_0_12px_rgba(0,229,245,0.3)]">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-display text-sm sm:text-base font-black italic uppercase tracking-wider text-white">
                {currentLastMessage?.sender ?? 'CENTRAL DATACAR'}
              </span>
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#00E5F5]" />
            </div>
            <p className="truncate text-[10px] font-mono uppercase tracking-wider text-[#FFAA12]">
              {headerBadge} · {chapterTitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!allRevealed && (
            <button
              type="button"
              onClick={handleRevealAll}
              data-testid="phone-reveal-all-btn"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 min-h-[34px] text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:border-[#00E5F5] hover:text-white cursor-pointer"
            >
              <FastForward className="h-3 w-3" />
              <span>Todo</span>
            </button>
          )}
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              data-testid="phone-skip-btn"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 min-h-[34px] text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:border-amber-400 hover:text-white cursor-pointer"
            >
              <span>{skipLabel}</span>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Historial de mensajes progresivos */}
      <div
        ref={messageListRef}
        className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto px-3.5 py-2.5 sm:px-4 sm:py-4 bg-gradient-to-b from-[#040d16] via-[#061421] to-[#040c14]"
        aria-live="polite"
      >
        {visibleMessages.map((msg) => {
          const isUnknown = msg.sender === 'REMITENTE DESCONOCIDO';
          return (
            <div key={msg.id} className="space-y-2 animate-fadeIn">
              <div
                data-testid={`phone-msg-${msg.id}`}
                className={`rounded-2xl rounded-tl-xs border px-3.5 py-2.5 shadow-md ${
                  isUnknown
                    ? 'border-rose-500/60 bg-rose-950/55 text-rose-100'
                    : msg.order === totalCount && isRecruitmentPrompt
                      ? 'border-[#FFAA12]/70 bg-[#1c1406]/95 text-[#FFAA12]'
                      : 'border-[#00E5F5]/35 bg-[#091e30]/95 text-slate-100'
                }`}
              >
                <div className="mb-1 flex items-center justify-between text-[9px] font-mono uppercase tracking-widest">
                  <span className={isUnknown ? 'text-rose-300 font-bold' : 'text-[#00E5F5]'}>
                    {msg.sender}
                  </span>
                  <span className="text-slate-400">#{msg.order}</span>
                </div>
                <p
                  className={`text-sm sm:text-[15px] leading-snug ${
                    msg.order === totalCount && isRecruitmentPrompt
                      ? 'font-display text-base sm:text-lg font-black italic uppercase tracking-wider text-[#FFAA12]'
                      : 'font-medium'
                  }`}
                >
                  "{msg.text}"
                </p>
              </div>

              {/* Archivo confidencial adjunto si aplica (§5, §8, §11, §12, §13) */}
              {msg.attachment && (
                <div
                  data-testid={`phone-attachment-${msg.id}`}
                  className="rounded-xl border-2 border-[#FFAA12]/65 bg-gradient-to-r from-[#191204] via-[#131d2b] to-[#0b1724] p-3.5 shadow-[0_0_20px_rgba(255,170,18,0.2)]"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono font-black uppercase tracking-widest text-[#FFAA12]">
                    <span className="inline-flex items-center gap-1.5">
                      <FileWarning className="h-3.5 w-3.5 text-[#FFAA12]" />
                      <span>{msg.attachment.badge || 'ARCHIVO ADJUNTO'}</span>
                    </span>
                    <Lock className="h-3.5 w-3.5 text-[#00E5F5]" />
                  </div>
                  <div className="mt-1.5 font-display text-lg sm:text-xl font-black italic uppercase tracking-wide text-white">
                    {msg.attachment.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-mono">
                    <span className="rounded bg-[#FFAA12]/20 border border-[#FFAA12]/50 px-2 py-0.5 font-bold text-[#FFAA12]">
                      ESTADO: {msg.attachment.status}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-cyan-200 font-medium">
                    <MapPin className="h-3.5 w-3.5 text-[#00E5F5] shrink-0" />
                    <span>UBICACIÓN: {msg.attachment.location}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Indicador discreto de escritura */}
        {isTyping && !allRevealed && (
          <div
            data-testid="phone-typing-indicator"
            className="inline-flex items-center gap-2 self-start rounded-full border border-[#00E5F5]/30 bg-[#071826] px-3 py-1.5 text-[11px] font-mono text-cyan-300"
          >
            <MessageSquare className="h-3 w-3 animate-bounce text-[#00E5F5]" />
            <span>CENTRAL DATACAR escribiendo…</span>
          </div>
        )}
      </div>

      {/* Pie de controles táctiles grandes (siempre visible sin cortarse en móvil horizontal) */}
      <div className="shrink-0 border-t border-[#00E5F5]/25 bg-[#030a12] px-3.5 py-2.5 sm:p-4 space-y-2">
        {!allRevealed ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAdvanceStep}
              data-testid="phone-next-msg-btn"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#00E5F5]/65 bg-[#082233] px-4 py-3 min-h-[46px] font-display text-sm font-black italic uppercase tracking-wider text-[#00E5F5] hover:bg-[#0c3149] transition cursor-pointer"
            >
              <span>Siguiente mensaje ({visibleCount}/{totalCount})</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleRevealAll}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 min-h-[46px] text-xs font-bold uppercase text-slate-200 hover:border-cyan-400 cursor-pointer"
            >
              Mostrar todo
            </button>
          </div>
        ) : isRecruitmentPrompt ? (
          <div className="space-y-2">
            {hangarPreloadPercent > 0 && hangarPreloadPercent < 100 && (
              <div className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-[#04111f] px-2.5 py-1 text-[10px] font-mono text-cyan-200">
                <span className="shrink-0">Preparando Hangar 3D · {hangarPreloadPercent}%</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-[#00E5F5] to-amber-400 transition-all duration-150"
                    style={{ width: `${hangarPreloadPercent}%` }}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onAccept}
                data-testid="phone-accept-mission-btn"
                data-start="true"
                className="dc-btn-gold inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 min-h-[48px] font-display text-base font-black italic uppercase tracking-wider text-slate-950 shadow-[0_0_20px_rgba(255,170,18,0.4)] cursor-pointer"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>{acceptLabel}</span>
              </button>
              {onDecline && (
                <button
                  type="button"
                  onClick={onDecline}
                  data-testid="phone-decline-mission-btn"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-3.5 min-h-[48px] font-display text-sm font-black italic uppercase tracking-wider text-slate-200 hover:border-slate-400 hover:text-white cursor-pointer"
                >
                  <span>{declineLabel}</span>
                </button>
              )}
            </div>
            {onSkipPrologueToGarage && (
              <button
                type="button"
                onClick={onSkipPrologueToGarage}
                data-testid="phone-skip-prologue-btn"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2 text-[11px] font-semibold text-slate-400 hover:border-cyan-500/40 hover:text-cyan-200 transition cursor-pointer"
              >
                Omitir prólogo de prueba e ir directo al Garaje Comercial (sin recompensas)
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onAccept}
            data-testid="phone-continue-btn"
            data-start="true"
            className="dc-btn-gold w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 min-h-[48px] font-display text-base font-black italic uppercase tracking-wider text-slate-950 cursor-pointer"
          >
            <span>{acceptLabel}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};

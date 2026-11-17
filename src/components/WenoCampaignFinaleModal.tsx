import React, { useEffect } from 'react';
import { Award, CheckCircle2, ChevronsRight, Flag, Play, ShieldCheck, Smartphone, Sparkles, Trophy, X } from 'lucide-react';
import { ASUNCION_CIRCUITS } from '../data/asuncionCircuits';
import { getWenoCampaignOverview, useCareerProgression } from '../utils/careerProgression';
import {
  DATACAR_CAMPAIGN_COPY,
  SATIRICAL_FICTION_DISCLAIMER,
  getWenoBankMissionForCircuit,
} from '../utils/wenoBankMissions';
import { STORY_DIALOGUES_BY_CHAPTER } from '../utils/storyCampaign';
import { useStoryProgress } from '../utils/storyProgress';
import { formatTime } from '../utils/comparatorHelpers';

export interface WenoCampaignFinaleModalProps {
  open: boolean;
  onClose: () => void;
  onReplayCircuit?: (circuitId: string) => void;
  onStartRecoveryMission?: () => void;
  onOpenRecoveryCinematic?: () => void;
}

export const WenoCampaignFinaleModal: React.FC<WenoCampaignFinaleModalProps> = ({
  open,
  onClose,
  onReplayCircuit,
  onStartRecoveryMission,
  onOpenRecoveryCinematic,
}) => {
  const progression = useCareerProgression();
  const storyState = useStoryProgress();

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const overview = getWenoCampaignOverview(ASUNCION_CIRCUITS, progression);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="weno-finale-modal-title"
      data-testid="weno-campaign-finale-modal"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-[#04070d]/95 p-3 sm:p-6 overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-amber-400/45 bg-[#09111f] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.88)] overflow-hidden my-auto">
        {/* Top institutional accent bar */}
        <div className="h-1.5 w-full bg-amber-400" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 pt-5 pb-4 sm:px-7 sm:pt-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">
              <Trophy className="h-3.5 w-3.5 text-amber-300" />
              <span>
                {DATACAR_CAMPAIGN_COPY.finaleHeader} · {DATACAR_CAMPAIGN_COPY.finaleSubheader}
              </span>
            </div>
            <h2
              id="weno-finale-modal-title"
              className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase"
            >
              {DATACAR_CAMPAIGN_COPY.finaleHeroTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar reconocimiento de campaña"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6 max-h-[75vh] overflow-y-auto">
          {/* Elite Badge Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-amber-400/35 bg-[#101a2e] p-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500/20 text-amber-300">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/90">
                  INSIGNIA PERMANENTE DESBLOQUEADA
                </div>
                <div className="text-lg font-black uppercase tracking-wide text-white">
                  {DATACAR_CAMPAIGN_COPY.eliteBadgeTitle}
                </div>
                <div className="text-xs font-semibold text-cyan-300">
                  {DATACAR_CAMPAIGN_COPY.eliteBadgeSubtitle} ({overview.completedCount} /{' '}
                  {overview.totalCount})
                </div>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 self-start sm:self-center rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              <span>100% MISIONES CUMPLIDAS</span>
            </div>
          </div>

          {/* Narrative Tribute */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-[#0b1526] p-4 space-y-2 text-sm text-slate-200 leading-relaxed">
              {DATACAR_CAMPAIGN_COPY.finaleParagraphs.map((line, idx) => (
                <p key={idx} className={idx === 0 ? 'font-bold text-white' : ''}>
                  {line}
                </p>
              ))}
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-[#08192b] p-4 flex flex-col justify-center space-y-2">
              {DATACAR_CAMPAIGN_COPY.finaleClosingLines.map((line, idx) => (
                <p
                  key={idx}
                  className={
                    idx === DATACAR_CAMPAIGN_COPY.finaleClosingLines.length - 1
                      ? 'text-sm sm:text-base font-black uppercase tracking-wide text-amber-300 pt-1'
                      : 'text-xs sm:text-sm font-extrabold uppercase tracking-wider text-cyan-200'
                  }
                >
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Notificación de Teléfono CENTRAL DATACAR — Desbloqueo Misión Bonus (§11) */}
          <div
            data-testid="elite-phone-bonus-mission-unlock"
            className="rounded-2xl border-2 border-[#00E5F5]/65 bg-gradient-to-r from-[#051523] via-[#091e30] to-[#1d1404] p-4 sm:p-5 space-y-3 shadow-[0_0_28px_rgba(0,229,245,0.22)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00E5F5]/25 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-mono font-black uppercase tracking-widest text-[#00E5F5]">
                <Smartphone className="h-4 w-4 text-[#FFAA12] animate-bounce" />
                <span>NOTIFICACIÓN ENTRANTE · CENTRAL DATACAR</span>
              </div>
              <span className="rounded bg-[#FFAA12]/20 border border-[#FFAA12]/60 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase text-[#FFAA12]">
                MISIÓN BONUS DESBLOQUEADA
              </span>
            </div>

            <div className="space-y-1 border-l-3 border-[#FFAA12] pl-3.5">
              {STORY_DIALOGUES_BY_CHAPTER.elite_bonus_unlock.map((msg) => (
                <p key={msg.id} className="text-sm sm:text-base font-bold text-white">
                  "{msg.text}"
                </p>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-amber-400/50 bg-[#140f04]/90 p-3.5">
              <div>
                <p className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-[#FFAA12]">
                  MISIÓN BONUS DESBLOQUEADA
                </p>
                <p className="font-display text-lg sm:text-xl font-black italic uppercase tracking-wide text-white">
                  OPERACIÓN FANTASMA — RECUPERACIÓN FINAL.
                </p>
                <p className="text-xs text-slate-300">
                  {storyState.recoveryCompleted
                    ? '¡Ya recuperaste el Lamborghini Proyecto Fantasma! Podés volver a ver la cinemática o rejugar la misión.'
                    : 'Elegí uno de los 7 vehículos comerciales de DATACAR e interceptá el traslado rumbo al aeropuerto para recuperar el Lamborghini.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {storyState.recoveryCompleted && onOpenRecoveryCinematic && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenRecoveryCinematic();
                    }}
                    data-testid="finale-view-recovery-cinematic-btn"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#00E5F5]/65 bg-[#082233] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#00E5F5] hover:bg-[#0c3149] cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Ver Epílogo</span>
                  </button>
                )}
                {onStartRecoveryMission && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStartRecoveryMission();
                    }}
                    data-testid="finale-start-recovery-mission-btn"
                    className="dc-btn-gold inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs sm:text-sm font-black italic uppercase tracking-wider text-slate-950 shadow-lg cursor-pointer"
                  >
                    <ChevronsRight className="h-4 w-4 stroke-[3]" />
                    <span>
                      {storyState.recoveryCompleted
                        ? 'Rejugar Recuperación Final'
                        : 'Iniciar Recuperación Final'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Completed Missions Ledger */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5 text-cyan-400" />
                Circuitos Asegurados frente al Weno Bank
              </span>
              <span className="tabular-nums text-emerald-300">
                {overview.completedCount} DE {overview.totalCount} COMPLETADOS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {overview.items.map((item) => {
                const mission = getWenoBankMissionForCircuit(item.circuitId, item.name);
                return (
                  <div
                    key={item.circuitId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#0c1628] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{mission.title}</span>
                      </div>
                      <div className="truncate text-xs text-slate-300">{item.name}</div>
                      {item.bestTimeSec != null && (
                        <div className="text-[11px] font-mono tabular-nums text-amber-300/90">
                          Mejor llegada: {formatTime(item.bestTimeSec)}
                        </div>
                      )}
                    </div>

                    {onReplayCircuit && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onReplayCircuit(item.circuitId);
                        }}
                        aria-label={`Repetir ${item.name}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/20 transition-colors"
                      >
                        <Play className="h-3 w-3" />
                        <span>Repetir</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-snug">{SATIRICAL_FICTION_DISCLAIMER}</p>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-[#070d18] px-5 py-3.5 sm:px-7">
          <span className="text-xs text-slate-400">
            Todos los circuitos siguen habilitados para mejorar tus tiempos.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-amber-300 transition-colors"
          >
            <Trophy className="h-4 w-4" />
            <span>Continuar en DATACAR ARENA</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WenoCampaignFinaleModal;

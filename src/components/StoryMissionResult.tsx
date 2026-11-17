import React from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronsRight,
  FileCheck2,
  Lock,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Unlock,
} from 'lucide-react';
import {
  getStoryMissionByCircuitId,
  getStoryMissionById,
} from '../utils/storyCampaign';
import { canStartRecoveryMission, useStoryProgress } from '../utils/storyProgress';

export interface StoryMissionResultProps {
  circuitId: string;
  activeStoryMissionId?: string | null;
  won: boolean;
  isPracticeFree?: boolean;
  onNextStoryAction?: () => void;
  onRetryMission?: () => void;
  onStartBonusRecovery?: () => void;
  onOpenRecoveryCinematic?: () => void;
}

/**
 * Presenta la consecuencia narrativa real tras la carrera, la pista desbloqueada,
 * la escena del hangar vacío (Misión 4), la revelación del infiltrado (Misión 5)
 * y el desbloqueo del siguiente capítulo o de la Recuperación Final (§10, §11, §12 y §17).
 */
export const StoryMissionResult: React.FC<StoryMissionResultProps> = ({
  circuitId,
  activeStoryMissionId,
  won,
  isPracticeFree = false,
  onNextStoryAction,
  onRetryMission,
  onStartBonusRecovery,
  onOpenRecoveryCinematic,
}) => {
  const storyState = useStoryProgress();
  const mission = getStoryMissionByCircuitId(circuitId, activeStoryMissionId);
  const nextMission = mission.unlocksMissionId
    ? getStoryMissionById(mission.unlocksMissionId)
    : undefined;
  const recoveryReady = canStartRecoveryMission(storyState);

  if (isPracticeFree) {
    return (
      <section
        data-testid="story-mission-result-practice"
        className="relative z-10 mx-auto w-full max-w-[1120px] rounded-2xl border border-sky-400/40 bg-[#061523]/95 p-4 text-xs text-sky-100"
      >
        <p className="font-mono font-bold uppercase tracking-wider text-sky-300">
          RECONOCIMIENTO TÁCTICO EN PISTA DE PRUEBAS
        </p>
        <p className="mt-1 text-slate-200">
          Las vueltas en Pista de Pruebas sirven para calibrar frenada y trazada, pero no otorgan pistas ni desbloquean capítulos de la historia.
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="story-mission-result"
      aria-label={`Resultado narrativo: ${mission.title}`}
      className={`relative z-10 mx-auto w-full max-w-[1120px] rounded-2xl border-2 p-4 sm:p-6 shadow-[0_18px_55px_rgba(0,0,0,0.85)] ${
        won
          ? 'border-emerald-400/65 bg-gradient-to-r from-[#051a18]/96 via-[#071929]/96 to-[#191305]/96'
          : 'border-rose-500/60 bg-gradient-to-r from-[#1a0810]/96 via-[#0c1322]/96 to-[#140b0e]/96'
      }`}
    >
      {/* Cabecera de Capítulo y Pista */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.18em] ${
              won
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                : 'border-rose-400/60 bg-rose-500/20 text-rose-200'
            }`}
          >
            {won ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            <span>
              {won ? 'OBJETIVO DE INVESTIGACIÓN DOCUMENTADO' : 'OPERATIVO INCOMPLETO · SIN PISTA'}
            </span>
          </span>
          <span className="font-display text-base sm:text-xl font-black italic uppercase tracking-wider text-white">
            {mission.title}
          </span>
        </div>

        {won && (
          <span
            data-testid="story-clue-badge"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#FFAA12]/75 bg-[#221704] px-3 py-1 font-mono text-xs font-black uppercase tracking-wider text-[#FFAA12] shadow-[0_0_15px_rgba(255,170,18,0.28)]"
          >
            <FileCheck2 className="h-4 w-4 shrink-0" />
            <span>PISTA: {mission.clueTitle}</span>
          </span>
        )}
      </div>

      {won ? (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Izquierda (7 cols): Consecuencia narrativa + Escena especial (Misión 4 / Misión 5) */}
          <div className="lg:col-span-7 space-y-3 flex flex-col justify-between">
            <div className="rounded-xl border border-emerald-400/35 bg-[#04111c]/90 p-4 space-y-2">
              <p className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-300">
                CONSECUENCIA NARRATIVA · INFORME DEL EQUIPO DATACAR
              </p>
              <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-medium">
                {mission.victoryNarrativeOutcome}
              </p>
              <p className="text-xs text-cyan-200/95 border-t border-slate-800 pt-2">
                <strong className="text-[#FFAA12]">Evidencia registrada:</strong> {mission.clueDetail}
              </p>
            </div>

            {/* Escena breve del hangar vacío en Misión 4 (§10 Misión 4) */}
            {mission.missionId === 'weno_4' && mission.specialSceneNote && (
              <div
                data-testid="mission-4-empty-hangar-scene"
                className="rounded-xl border-2 border-amber-400/65 bg-[#191205]/95 p-3.5 text-xs text-amber-100"
              >
                <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-widest text-[#FFAA12]">
                  <ShieldAlert className="h-4 w-4 text-[#FFAA12]" />
                  <span>ESCENA EN TERRENO · HANGAR PRIVADO PRÓXIMO AL AEROPUERTO</span>
                </div>
                <p className="mt-1.5 leading-relaxed">{mission.specialSceneNote}</p>
              </div>
            )}

            {/* Revelación explícita del contratista infiltrado en Misión 5 (§10 Misión 5) */}
            {mission.missionId === 'weno_5' && (
              <div
                data-testid="mission-5-infiltrator-revelation"
                className="rounded-xl border-2 border-rose-400/70 bg-[#1c0912]/95 p-3.5 text-xs text-rose-100"
              >
                <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-widest text-rose-300">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  <span>REVELACIÓN DE CONTRAINTELIGENCIA · TRAICIÓN DESCUBIERTA</span>
                </div>
                <p className="mt-1.5 leading-relaxed">
                  El infiltrado era un <strong>contratista encargado del sistema de seguridad del hangar DATACAR</strong>. Había vendido los códigos de acceso utilizados en el robo del Proyecto Fantasma y filtraba nuestras rutas. Su credencial fue revocada permanentemente.
                </p>
              </div>
            )}
          </div>

          {/* Derecha (5 cols): Mensaje en el teléfono de CENTRAL DATACAR + Desbloqueo */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-3 rounded-xl border border-[#00E5F5]/45 bg-[#040d17]/95 p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono font-black uppercase tracking-widest text-[#00E5F5]">
                <span className="inline-flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-[#FFAA12]" />
                  <span>CENTRAL DATACAR:</span>
                </span>
                <span className="text-emerald-300">CANAL SEGURO</span>
              </div>

              <div className="space-y-1.5 border-l-2 border-[#FFAA12] pl-3 py-1">
                {mission.revelationDialogueLines.map((line, idx) => (
                  <p key={idx} className="text-sm sm:text-base font-bold text-white leading-snug">
                    "{line}"
                  </p>
                ))}
              </div>
            </div>

            {/* Banner de desbloqueo del siguiente capítulo */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              {mission.missionId === 'recovery_final' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-black uppercase text-[#FFAA12]">
                    <Sparkles className="h-4 w-4" />
                    <span>LAMBORGHINI RECUPERADO · VEHÍCULO BONUS DESBLOQUEADO</span>
                  </div>
                  {onOpenRecoveryCinematic && (
                    <button
                      type="button"
                      onClick={onOpenRecoveryCinematic}
                      data-testid="open-recovery-cinematic-btn"
                      className="dc-btn-gold w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black italic uppercase text-slate-950 cursor-pointer"
                    >
                      <Award className="h-4 w-4" />
                      <span>Ver Cinemática de Recuperación y Epílogo</span>
                    </button>
                  )}
                </div>
              ) : mission.missionId === 'weno_6' || recoveryReady ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-black uppercase text-[#FFAA12]">
                    <Unlock className="h-4 w-4 text-emerald-400" />
                    <span>MISIÓN BONUS DESBLOQUEADA: OPERACIÓN FANTASMA — RECUPERACIÓN FINAL</span>
                  </div>
                  {onStartBonusRecovery && (
                    <button
                      type="button"
                      onClick={onStartBonusRecovery}
                      data-testid="start-bonus-recovery-btn"
                      className="dc-btn-gold w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black italic uppercase text-slate-950 cursor-pointer"
                    >
                      <ChevronsRight className="h-5 w-5 stroke-[3]" />
                      <span>Iniciar Recuperación Final del Lamborghini</span>
                    </button>
                  )}
                </div>
              ) : nextMission ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-cyan-300">
                    <Unlock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>DESBLOQUEADO: {nextMission.title}</span>
                  </div>
                  {onNextStoryAction && (
                    <button
                      type="button"
                      onClick={onNextStoryAction}
                      data-testid="story-result-next-chapter-btn"
                      className="dc-btn-gold w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-black italic uppercase text-slate-950 cursor-pointer"
                    >
                      <ChevronsRight className="h-4 w-4 stroke-[3]" />
                      <span>Avanzar a {nextMission.title}</span>
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        /* Caso Derrota: no entrega pista ni desbloquea el siguiente capítulo (§14 y §20) */
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-rose-500/40 bg-[#090d16]/90 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-rose-300">
              <Lock className="h-3.5 w-3.5" />
              <span>PISTA Y SIGUIENTE CAPÍTULO BLOQUEADOS</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200">{mission.defeatMessage}</p>
          </div>
          {onRetryMission && (
            <button
              type="button"
              onClick={onRetryMission}
              data-testid="story-result-retry-btn"
              className="dc-btn-gold inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-xs sm:text-sm font-black italic uppercase text-slate-950 shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reintentar Misión</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
};

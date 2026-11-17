import React from 'react';
import {
  CheckCircle2,
  FileSearch,
  Lock,
  Radio,
  ShieldAlert,
  Smartphone,
  Target,
} from 'lucide-react';
import {
  STORY_CONNECTED_MISSIONS,
  getStoryMissionByCircuitId,
} from '../utils/storyCampaign';
import { useStoryProgress } from '../utils/storyProgress';

export interface StoryMissionBriefingProps {
  circuitId: string;
  activeStoryMissionId?: string | null;
  compact?: boolean;
}

/**
 * Muestra la escena breve de introducción, diálogo de CENTRAL DATACAR, antagonista identificado,
 * objetivo conectado de la investigación y expediente de pistas acumuladas antes de correr (§10 y §17).
 */
export const StoryMissionBriefing: React.FC<StoryMissionBriefingProps> = ({
  circuitId,
  activeStoryMissionId,
  compact = false,
}) => {
  const storyState = useStoryProgress();
  const mission = getStoryMissionByCircuitId(circuitId, activeStoryMissionId);
  const completedClueMissions = STORY_CONNECTED_MISSIONS.filter((m) =>
    storyState.discoveredClues.includes(m.clueId),
  );

  return (
    <section
      data-testid="story-mission-briefing"
      aria-label={`Expediente narrativo: ${mission.title}`}
      className="relative z-10 mx-auto w-full max-w-[1080px] rounded-2xl border border-[#00E5F5]/45 bg-gradient-to-r from-[#05121e]/96 via-[#081a2b]/96 to-[#141106]/96 p-4 sm:p-5 text-slate-100 shadow-[0_14px_40px_rgba(0,0,0,0.75)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00E5F5]/20 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#FFAA12]/60 bg-[#FFAA12]/15 px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#FFAA12]">
            <Radio className="h-3 w-3 animate-pulse" />
            <span>{mission.subtitle}</span>
          </span>
          <span className="font-display text-sm sm:text-base font-black italic uppercase tracking-wider text-white">
            {mission.title}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-bold uppercase ${
              storyState.lamborghiniStatus === 'recovered_unlocked'
                ? 'border border-emerald-400/50 bg-emerald-950/70 text-emerald-300'
                : 'border border-rose-500/50 bg-rose-950/70 text-rose-200'
            }`}
          >
            <Lock className="h-3 w-3" />
            <span>
              {storyState.lamborghiniStatus === 'recovered_unlocked'
                ? 'PROYECTO FANTASMA — RECUPERADO'
                : mission.missionId === 'mission_0'
                  ? 'PROYECTO FANTASMA — EN EVALUACIÓN'
                  : 'PROYECTO FANTASMA — ROBADO'}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Diálogo exacto de CENTRAL DATACAR */}
        <div className="lg:col-span-7 rounded-xl border-l-4 border-[#00E5F5] bg-[#040d17]/95 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono font-black uppercase tracking-widest text-[#00E5F5]">
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-[#FFAA12]" />
              <span>TRANSMISIÓN · CENTRAL DATACAR</span>
            </span>
            <span className="text-slate-400">{mission.circuitDisplayName}</span>
          </div>

          <div className="space-y-1 pt-0.5">
            {mission.introDialogueLines.map((line, index) => (
              <p
                key={index}
                className="text-xs sm:text-sm font-bold text-white leading-snug"
              >
                "{line}"
              </p>
            ))}
          </div>

          <p className="pt-1.5 text-[11px] sm:text-xs text-cyan-200/95 leading-relaxed">
            <strong className="text-[#FFAA12] uppercase">Objetivo táctico:</strong>{' '}
            {mission.objectiveSummary}
          </p>
        </div>

        {/* Antagonista identificado y Pistas recolectadas */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="rounded-xl border border-amber-400/35 bg-[#0b1624]/90 p-3 text-xs">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>OBJETIVO IDENTIFICADO EN RUTA</span>
            </div>
            <p className="mt-1 font-bold text-white">{mission.antagonistName}</p>
            <p className="text-[11px] text-slate-300">
              Vehículo: <span className="text-[#00E5F5] font-semibold">{mission.antagonistVehicle}</span>
            </p>
          </div>

          {!compact && (
            <div className="rounded-xl border border-slate-800 bg-[#040b13]/90 p-3 text-xs">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                <span className="inline-flex items-center gap-1.5">
                  <FileSearch className="h-3.5 w-3.5" />
                  <span>PISTAS DEL PROYECTO FANTASMA</span>
                </span>
                <span className="text-amber-300 tabular-nums">
                  {completedClueMissions.length} DESCUBIERTAS
                </span>
              </div>
              {completedClueMissions.length === 0 ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  Completá esta misión para registrar la primera pista verificada en el expediente.
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {completedClueMissions.map((m) => (
                    <span
                      key={m.clueId}
                      className="inline-flex items-center gap-1 rounded border border-emerald-400/45 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-200"
                    >
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span>{m.clueTitle}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

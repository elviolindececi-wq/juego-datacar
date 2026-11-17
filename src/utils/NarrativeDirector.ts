/**
 * DATACAR ARENA — NARRATIVE DIRECTOR
 * Coordina escenas, diálogos, eventos y navegación de "Operación WENO — El Proyecto Fantasma"
 * sin depender de temporizadores huérfanos ni reemplazar los motores físicos existentes.
 */

import {
  STORY_CONNECTED_MISSIONS,
  STORY_DIALOGUES_BY_CHAPTER,
  STORY_INTRO_10S_TIMELINE,
  getStoryMissionByCircuitId,
  getStoryMissionById,
  type StoryChapterId,
  type StoryConnectedMissionSpec,
  type StoryDialogueMessage,
  type StoryIntroOverlayCue,
} from './storyCampaign.ts';
import {
  acceptRecruitmentMission,
  canStartRecoveryMission,
  completeEpilogueAndSeason1,
  completeTheftCinematicAndUnlockGarage,
  getNextUnlockedStoryCircuitId,
  isLamborghiniUnlockedForFreePlay,
  isNarrativeStateAtLeast,
  isWenoCircuitUnlockedInStory,
  loadStoryProgress,
  markGarageNarrativeSeen,
  markStoryIntroStarted,
  markStoryIntroVideoCompleted,
  recordStoryMissionAttempt,
  skipPrologueToGarage,
  type StoryProgressState,
} from './storyProgress.ts';

export type ActiveStoryOverlayStage =
  | 'closed'
  | 'intro_10s_cinematic'
  | 'recruitment_phone'
  | 'lamborghini_reveal'
  | 'mission_0_discovery_theft'
  | 'garage_first_entry'
  | 'recovery_cinematic_and_epilogue';

export interface NarrativeDirectorStatus {
  ctaLabel: 'INICIAR HISTORIA' | 'CONTINUAR HISTORIA' | 'OPERACIÓN FANTASMA' | 'HISTORIA COMPLETADA';
  ctaSublabel: string;
  hasStartedStory: boolean;
  canPlayPrologue: boolean;
  canPlayRecoveryBonus: boolean;
  isLamborghiniRecovered: boolean;
  nextRecommendedMission: StoryConnectedMissionSpec;
}

/**
 * Determina el estado de experiencia de usuario para la portada y botones principales (§20).
 */
export function evaluateNarrativeDirectorStatus(
  state: StoryProgressState = loadStoryProgress(),
): NarrativeDirectorStatus {
  const hasStartedStory =
    state.narrativeState !== 'not_started' ||
    state.completedMissions.length > 0 ||
    state.prologueSkipped;

  if (state.epilogueCompleted || isLamborghiniUnlockedForFreePlay(state)) {
    return {
      ctaLabel: 'HISTORIA COMPLETADA',
      ctaSublabel: 'Lamborghini Proyecto Fantasma recuperado · Rejugar o explorar',
      hasStartedStory: true,
      canPlayPrologue: true,
      canPlayRecoveryBonus: true,
      isLamborghiniRecovered: true,
      nextRecommendedMission: STORY_CONNECTED_MISSIONS[7],
    };
  }

  if (canStartRecoveryMission(state) && !state.recoveryCompleted) {
    return {
      ctaLabel: 'OPERACIÓN FANTASMA',
      ctaSublabel: 'Misión Bonus Desbloqueada — Recuperación Final del Lamborghini',
      hasStartedStory: true,
      canPlayPrologue: true,
      canPlayRecoveryBonus: true,
      isLamborghiniRecovered: false,
      nextRecommendedMission: STORY_CONNECTED_MISSIONS[7],
    };
  }

  if (!isNarrativeStateAtLeast(state.narrativeState, 'garage_unlocked') && !state.prologueSkipped) {
    return {
      ctaLabel: hasStartedStory ? 'CONTINUAR HISTORIA' : 'INICIAR HISTORIA',
      ctaSublabel: 'Prólogo: Proyecto Fantasma — Evaluación Nocturna',
      hasStartedStory,
      canPlayPrologue: true,
      canPlayRecoveryBonus: false,
      isLamborghiniRecovered: false,
      nextRecommendedMission: STORY_CONNECTED_MISSIONS[0],
    };
  }

  const nextCircuit = getNextUnlockedStoryCircuitId(state);
  const nextMission = getStoryMissionByCircuitId(nextCircuit);
  return {
    ctaLabel: 'CONTINUAR HISTORIA',
    ctaSublabel: `${nextMission.title} (${nextMission.circuitDisplayName})`,
    hasStartedStory: true,
    canPlayPrologue: true,
    canPlayRecoveryBonus: canStartRecoveryMission(state),
    isLamborghiniRecovered: false,
    nextRecommendedMission: nextMission,
  };
}

/**
 * Obtiene el sobreimpreso exacto para un segundo dado (`0.0` .. `10.0`) de la apertura de 10 segundos (§4).
 */
export function resolveIntroCinematicCueAtTime(elapsedSec: number): StoryIntroOverlayCue | null {
  const safe = Math.max(0, Math.min(10, Number.isFinite(elapsedSec) ? elapsedSec : 0));
  for (const cue of STORY_INTRO_10S_TIMELINE) {
    if (safe >= cue.startSec && safe < cue.endSec) {
      return cue;
    }
  }
  return STORY_INTRO_10S_TIMELINE[STORY_INTRO_10S_TIMELINE.length - 1] ?? null;
}

export function getDialogueSequence(key: keyof typeof STORY_DIALOGUES_BY_CHAPTER): readonly StoryDialogueMessage[] {
  return STORY_DIALOGUES_BY_CHAPTER[key] ?? [];
}

export const NarrativeDirector = {
  getStatus: evaluateNarrativeDirectorStatus,
  getCueAtTime: resolveIntroCinematicCueAtTime,
  getDialogueSequence,
  getMissionByCircuit: getStoryMissionByCircuitId,
  getMissionById: getStoryMissionById,
  isCircuitUnlocked: isWenoCircuitUnlockedInStory,
  canStartRecovery: canStartRecoveryMission,
  isLamborghiniUnlocked: isLamborghiniUnlockedForFreePlay,
  startIntro: markStoryIntroStarted,
  completeIntroVideo: markStoryIntroVideoCompleted,
  acceptRecruitment: acceptRecruitmentMission,
  skipPrologue: skipPrologueToGarage,
  completeTheftAndUnlockGarage: completeTheftCinematicAndUnlockGarage,
  markGarageSeen: markGarageNarrativeSeen,
  recordMissionAttempt: recordStoryMissionAttempt,
  completeEpilogue: completeEpilogueAndSeason1,
};

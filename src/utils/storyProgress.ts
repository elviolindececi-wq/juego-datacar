import { useEffect, useState } from 'react';
import {
  loadCareerProgression,
  recordWenoBankCircuitAttempt,
  type CareerProgressionState,
  type RaceModeId,
} from './careerProgression.ts';
import { loadDatacarAccount } from './datacarAccount.ts';
import {
  STORY_CONNECTED_MISSIONS,
  STORY_NARRATIVE_STATE_ORDER,
  WENO_STORY_ORDERED_CIRCUIT_IDS,
  type LamborghiniCampaignStatus,
  type StoryChapterId,
  type StoryNarrativeStateId,
} from './storyCampaign.ts';

export const STORY_PROGRESS_STORAGE_KEY = 'datacar_arena_story_campaign_v2';
export const STORY_PROGRESS_EVENT = 'datacar-story-progress-updated';
export const STORY_SCHEMA_VERSION = 2;

export interface StoryProgressState {
  schemaVersion: number;
  pilotId: string | null;
  narrativeState: StoryNarrativeStateId;
  currentChapter: StoryChapterId;
  completedMissions: string[];
  discoveredClues: string[];
  bestTimesByCircuit: Record<string, number>;
  selectedVehicleId: string;
  seenCinematics: string[];
  seenDialogueIds: string[];
  lamborghiniStatus: LamborghiniCampaignStatus;
  eliteAwarded: boolean;
  recoveryUnlocked: boolean;
  recoveryCompleted: boolean;
  epilogueCompleted: boolean;
  prologueSkipped: boolean;
  /** True si el jugador venía de una versión anterior con circuitos ya superados */
  migratedLegacySave: boolean;
  updatedAtIso: string;
}

export interface StoryPersistenceAdapter {
  load: () => StoryProgressState | null;
  save: (state: StoryProgressState) => void;
}

const CIRCUIT_TO_WENO_MISSION_ID: Readonly<Record<string, string>> = {
  aviadores: 'weno_1',
  oliva: 'weno_2',
  herrera: 'weno_3',
  'jose-felix': 'weno_4',
  artigas: 'weno_5',
  avelino: 'weno_6',
};

const WENO_MISSION_TO_CIRCUIT_ID: Readonly<Record<string, string>> = {
  weno_1: 'aviadores',
  weno_2: 'oliva',
  weno_3: 'herrera',
  weno_4: 'jose-felix',
  weno_5: 'artigas',
  weno_6: 'avelino',
};

const WENO_MISSION_TO_CLUE_ID: Readonly<Record<string, string>> = {
  mission_0: 'clue_0_routes',
  weno_1: 'clue_1_limo',
  weno_2: 'clue_2_shell_company',
  weno_3: 'clue_3_transport_order',
  weno_4: 'clue_4_hangar_hideout',
  weno_5: 'clue_5_infiltrator',
  weno_6: 'clue_6_airport_destination',
  recovery_final: 'clue_7_recovered',
};

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getRankOfNarrativeState(state: StoryNarrativeStateId): number {
  const idx = STORY_NARRATIVE_STATE_ORDER.indexOf(state);
  return idx >= 0 ? idx : 0;
}

export function isNarrativeStateAtLeast(
  current: StoryNarrativeStateId,
  target: StoryNarrativeStateId,
): boolean {
  return getRankOfNarrativeState(current) >= getRankOfNarrativeState(target);
}

function advanceNarrativeState(
  current: StoryNarrativeStateId,
  candidate: StoryNarrativeStateId,
): StoryNarrativeStateId {
  return getRankOfNarrativeState(candidate) > getRankOfNarrativeState(current)
    ? candidate
    : current;
}

function buildDefaultStoryState(): StoryProgressState {
  const account = loadDatacarAccount();
  return {
    schemaVersion: STORY_SCHEMA_VERSION,
    pilotId: account?.pilotName ?? null,
    narrativeState: 'not_started',
    currentChapter: 'chapter_intro_video',
    completedMissions: [],
    discoveredClues: [],
    bestTimesByCircuit: {},
    selectedVehicleId: 'toyota-corolla-cross-seg-2027',
    seenCinematics: [],
    seenDialogueIds: [],
    lamborghiniStatus: 'prototype_test',
    eliteAwarded: false,
    recoveryUnlocked: false,
    recoveryCompleted: false,
    epilogueCompleted: false,
    prologueSkipped: false,
    migratedLegacySave: false,
    updatedAtIso: new Date().toISOString(),
  };
}

/**
 * Reconcilia y migra el progreso existente de `careerProgression.ts` para que ningún
 * jugador antiguo pierda sus victorias, mejores tiempos o insignia de Piloto Élite (§15).
 */
export function reconcileStoryWithCareerProgression(
  rawStory: Partial<StoryProgressState> | null,
  career: CareerProgressionState,
): StoryProgressState {
  const base = buildDefaultStoryState();
  const account = loadDatacarAccount();
  const completedMissionsSet = new Set<string>(
    Array.isArray(rawStory?.completedMissions)
      ? rawStory.completedMissions.filter((x): x is string => typeof x === 'string')
      : [],
  );
  const cluesSet = new Set<string>(
    Array.isArray(rawStory?.discoveredClues)
      ? rawStory.discoveredClues.filter((x): x is string => typeof x === 'string')
      : [],
  );
  const seenCinematicsSet = new Set<string>(
    Array.isArray(rawStory?.seenCinematics)
      ? rawStory.seenCinematics.filter((x): x is string => typeof x === 'string')
      : [],
  );
  const seenDialoguesSet = new Set<string>(
    Array.isArray(rawStory?.seenDialogueIds)
      ? rawStory.seenDialogueIds.filter((x): x is string => typeof x === 'string')
      : [],
  );

  // Sincronizar circuitos completados desde careerProgression
  const careerCircuits = new Set(
    (career.wenoCompletedCircuits ?? []).map((c) => c.trim().toLowerCase().replace(/^circuit-/, '')),
  );
  let hadLegacyCircuits = false;
  for (const circuitId of WENO_STORY_ORDERED_CIRCUIT_IDS) {
    if (careerCircuits.has(circuitId)) {
      const mId = CIRCUIT_TO_WENO_MISSION_ID[circuitId];
      if (mId) {
        if (!completedMissionsSet.has(mId)) {
          hadLegacyCircuits = true;
        }
        completedMissionsSet.add(mId);
        const clue = WENO_MISSION_TO_CLUE_ID[mId];
        if (clue) cluesSet.add(clue);
      }
    }
  }

  // Asegurar que toda misión completada tenga su pista asociada
  for (const mId of completedMissionsSet) {
    const clue = WENO_MISSION_TO_CLUE_ID[mId];
    if (clue) cluesSet.add(clue);
  }

  const allSixWenoDone = WENO_STORY_ORDERED_CIRCUIT_IDS.every((cId) =>
    completedMissionsSet.has(CIRCUIT_TO_WENO_MISSION_ID[cId]),
  );

  const eliteAwarded = Boolean(
    rawStory?.eliteAwarded || career.wenoElitePilotUnlocked || allSixWenoDone,
  );
  const recoveryUnlocked = Boolean(
    rawStory?.recoveryUnlocked || (allSixWenoDone && eliteAwarded),
  );
  const recoveryCompleted = Boolean(
    rawStory?.recoveryCompleted || completedMissionsSet.has('recovery_final'),
  );
  const epilogueCompleted = Boolean(rawStory?.epilogueCompleted);

  let narrativeState: StoryNarrativeStateId =
    rawStory?.narrativeState && STORY_NARRATIVE_STATE_ORDER.includes(rawStory.narrativeState)
      ? rawStory.narrativeState
      : base.narrativeState;

  // Si es un jugador existente que ya tenía circuitos completados pero no tenía story state v2:
  const isLegacyMigration = Boolean(
    rawStory?.migratedLegacySave || (!rawStory && (careerCircuits.size > 0 || career.wenoElitePilotUnlocked)),
  );
  if (isLegacyMigration && narrativeState === 'not_started') {
    narrativeState = 'garage_unlocked';
  }

  if (completedMissionsSet.has('mission_0')) {
    narrativeState = advanceNarrativeState(narrativeState, 'mission_0_completed');
  }
  if (completedMissionsSet.has('weno_1')) {
    narrativeState = advanceNarrativeState(narrativeState, 'weno_mission_1_completed');
  }
  if (completedMissionsSet.has('weno_1') && completedMissionsSet.has('weno_2')) {
    narrativeState = advanceNarrativeState(narrativeState, 'weno_mission_2_completed');
  }
  if (
    completedMissionsSet.has('weno_1') &&
    completedMissionsSet.has('weno_2') &&
    completedMissionsSet.has('weno_3')
  ) {
    narrativeState = advanceNarrativeState(narrativeState, 'weno_mission_3_completed');
  }
  if (
    completedMissionsSet.has('weno_1') &&
    completedMissionsSet.has('weno_2') &&
    completedMissionsSet.has('weno_3') &&
    completedMissionsSet.has('weno_4')
  ) {
    narrativeState = advanceNarrativeState(narrativeState, 'weno_mission_4_completed');
  }
  if (
    completedMissionsSet.has('weno_1') &&
    completedMissionsSet.has('weno_2') &&
    completedMissionsSet.has('weno_3') &&
    completedMissionsSet.has('weno_4') &&
    completedMissionsSet.has('weno_5')
  ) {
    narrativeState = advanceNarrativeState(narrativeState, 'weno_mission_5_completed');
  }
  if (allSixWenoDone) {
    narrativeState = advanceNarrativeState(narrativeState, 'weno_mission_6_completed');
  }
  if (eliteAwarded) {
    narrativeState = advanceNarrativeState(narrativeState, 'elite_awarded');
  }
  if (recoveryUnlocked) {
    narrativeState = advanceNarrativeState(narrativeState, 'recovery_unlocked');
  }
  if (recoveryCompleted) {
    narrativeState = advanceNarrativeState(narrativeState, 'lamborghini_recovered');
  }
  if (epilogueCompleted) {
    narrativeState = advanceNarrativeState(narrativeState, 'epilogue_completed');
  }

  let lamborghiniStatus: LamborghiniCampaignStatus = 'prototype_test';
  if (recoveryCompleted) {
    lamborghiniStatus = 'recovered_unlocked';
  } else if (
    isNarrativeStateAtLeast(narrativeState, 'lamborghini_stolen') ||
    rawStory?.prologueSkipped ||
    isLegacyMigration
  ) {
    lamborghiniStatus = 'stolen_locked';
  }

  const bestTimesByCircuit: Record<string, number> = {
    ...(rawStory?.bestTimesByCircuit ?? {}),
    ...(career.wenoBestTimesSec ?? {}),
  };

  let currentChapter: StoryChapterId = rawStory?.currentChapter ?? 'chapter_intro_video';
  if (epilogueCompleted) {
    currentChapter = 'chapter_epilogue';
  } else if (recoveryCompleted) {
    currentChapter = 'chapter_epilogue';
  } else if (recoveryUnlocked) {
    currentChapter = 'chapter_recovery_mission';
  } else if (isNarrativeStateAtLeast(narrativeState, 'garage_unlocked') || hadLegacyCircuits) {
    if (!completedMissionsSet.has('weno_1')) currentChapter = 'chapter_weno_1';
    else if (!completedMissionsSet.has('weno_2')) currentChapter = 'chapter_weno_2';
    else if (!completedMissionsSet.has('weno_3')) currentChapter = 'chapter_weno_3';
    else if (!completedMissionsSet.has('weno_4')) currentChapter = 'chapter_weno_4';
    else if (!completedMissionsSet.has('weno_5')) currentChapter = 'chapter_weno_5';
    else currentChapter = 'chapter_weno_6';
  }

  return {
    schemaVersion: STORY_SCHEMA_VERSION,
    pilotId: account?.pilotName ?? rawStory?.pilotId ?? null,
    narrativeState,
    currentChapter,
    completedMissions: Array.from(completedMissionsSet),
    discoveredClues: Array.from(cluesSet),
    bestTimesByCircuit,
    selectedVehicleId:
      typeof rawStory?.selectedVehicleId === 'string' && rawStory.selectedVehicleId
        ? rawStory.selectedVehicleId
        : base.selectedVehicleId,
    seenCinematics: Array.from(seenCinematicsSet),
    seenDialogueIds: Array.from(seenDialoguesSet),
    lamborghiniStatus,
    eliteAwarded,
    recoveryUnlocked,
    recoveryCompleted,
    epilogueCompleted,
    prologueSkipped: Boolean(rawStory?.prologueSkipped),
    migratedLegacySave: isLegacyMigration,
    updatedAtIso: rawStory?.updatedAtIso ?? new Date().toISOString(),
  };
}

export function loadStoryProgress(): StoryProgressState {
  const career = loadCareerProgression();
  if (!canUseLocalStorage()) {
    return reconcileStoryWithCareerProgression(null, career);
  }
  try {
    const raw = window.localStorage.getItem(STORY_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return reconcileStoryWithCareerProgression(null, career);
    }
    const parsed = JSON.parse(raw) as Partial<StoryProgressState>;
    return reconcileStoryWithCareerProgression(parsed, career);
  } catch {
    return reconcileStoryWithCareerProgression(null, career);
  }
}

export function saveStoryProgress(next: StoryProgressState): StoryProgressState {
  const stamped: StoryProgressState = {
    ...next,
    schemaVersion: STORY_SCHEMA_VERSION,
    updatedAtIso: new Date().toISOString(),
  };
  if (canUseLocalStorage()) {
    try {
      window.localStorage.setItem(STORY_PROGRESS_STORAGE_KEY, JSON.stringify(stamped));
      window.dispatchEvent(new CustomEvent(STORY_PROGRESS_EVENT));
    } catch {
      // Ignore storage quota errors
    }
  }
  return stamped;
}

export function updateStoryProgress(
  updater: (current: StoryProgressState) => StoryProgressState,
): StoryProgressState {
  const current = loadStoryProgress();
  const updated = updater(current);
  return saveStoryProgress(reconcileStoryWithCareerProgression(updated, loadCareerProgression()));
}

/**
 * Comprueba si debe iniciarse automáticamente la experiencia narrativa en el primer arranque.
 */
export function shouldAutoLaunchStoryPrologue(
  searchString: string = typeof window !== 'undefined' ? window.location.search : '',
): boolean {
  try {
    const params = new URLSearchParams(searchString);
    if (params.get('autostart') === '1' || params.get('skipIntro') === '1') {
      return false;
    }
    const st = loadStoryProgress();
    // Si es un jugador nuevo (not_started o intro_started) y aún no desbloqueó el garaje ni migró partida antigua:
    return (
      !st.migratedLegacySave &&
      !isNarrativeStateAtLeast(st.narrativeState, 'garage_unlocked') &&
      !st.prologueSkipped
    );
  } catch {
    return false;
  }
}

export function markStoryIntroStarted(): StoryProgressState {
  return updateStoryProgress((cur) => ({
    ...cur,
    narrativeState: advanceNarrativeState(cur.narrativeState, 'intro_started'),
    currentChapter: 'chapter_intro_video',
  }));
}

export function markStoryIntroVideoCompleted(): StoryProgressState {
  return updateStoryProgress((cur) => ({
    ...cur,
    narrativeState: advanceNarrativeState(cur.narrativeState, 'intro_completed'),
    currentChapter: 'chapter_phone_recruitment',
    seenCinematics: Array.from(new Set([...cur.seenCinematics, 'intro_10s_video'])),
  }));
}

export function acceptRecruitmentMission(): StoryProgressState {
  return updateStoryProgress((cur) => ({
    ...cur,
    narrativeState: advanceNarrativeState(cur.narrativeState, 'mission_0_available'),
    currentChapter: 'chapter_lamborghini_reveal',
    seenDialogueIds: Array.from(new Set([...cur.seenDialogueIds, 'recruitment_accepted'])),
  }));
}

/**
 * Omitir explícitamente el prólogo (Misión 0 y su cinemática):
 * Avanza la historia al robo del Lamborghini y desbloqueo del garaje comercial,
 * pero NUNCA regala victorias, récords ni recompensas (§14).
 */
export function skipPrologueToGarage(): StoryProgressState {
  return updateStoryProgress((cur) => ({
    ...cur,
    narrativeState: advanceNarrativeState(cur.narrativeState, 'garage_unlocked'),
    currentChapter: 'chapter_garage_entry',
    lamborghiniStatus: cur.recoveryCompleted ? 'recovered_unlocked' : 'stolen_locked',
    prologueSkipped: true,
    seenCinematics: Array.from(new Set([...cur.seenCinematics, 'prologue_skipped'])),
  }));
}

export function recordMission0EvaluationOutcome(args: {
  won: boolean;
  finishTimeSec?: number | null;
}): StoryProgressState {
  if (!args.won) {
    return loadStoryProgress();
  }
  return updateStoryProgress((cur) => ({
    ...cur,
    narrativeState: advanceNarrativeState(cur.narrativeState, 'mission_0_completed'),
    currentChapter: 'chapter_mission_0_discovery',
    completedMissions: Array.from(new Set([...cur.completedMissions, 'mission_0'])),
    discoveredClues: Array.from(new Set([...cur.discoveredClues, 'clue_0_routes'])),
  }));
}

export function completeTheftCinematicAndUnlockGarage(): StoryProgressState {
  return updateStoryProgress((cur) => ({
    ...cur,
    narrativeState: advanceNarrativeState(cur.narrativeState, 'garage_unlocked'),
    currentChapter: 'chapter_garage_entry',
    lamborghiniStatus: cur.recoveryCompleted ? 'recovered_unlocked' : 'stolen_locked',
    seenCinematics: Array.from(
      new Set([...cur.seenCinematics, 'discovery_routes', 'lamborghini_theft']),
    ),
  }));
}

export function markGarageNarrativeSeen(selectedVehicleId?: string): StoryProgressState {
  return updateStoryProgress((cur) => ({
    ...cur,
    narrativeState: advanceNarrativeState(cur.narrativeState, 'garage_unlocked'),
    currentChapter: 'chapter_weno_1',
    selectedVehicleId: selectedVehicleId || cur.selectedVehicleId,
    seenCinematics: Array.from(new Set([...cur.seenCinematics, 'garage_first_entry'])),
  }));
}

/**
 * Verifica si una misión de la campaña principal (1..6) está desbloqueada.
 * Regla obligatoria (§14):
 * - La misión 2 se desbloquea después de la 1.
 * - La misión 3 se desbloquea después de la 2.
 * - Y así sucesivamente hasta la misión 6.
 */
export function isWenoCircuitUnlockedInStory(
  circuitId: string,
  state: StoryProgressState = loadStoryProgress(),
): boolean {
  const clean = circuitId.trim().toLowerCase().replace(/^circuit-/, '');
  const idx = WENO_STORY_ORDERED_CIRCUIT_IDS.indexOf(
    clean as (typeof WENO_STORY_ORDERED_CIRCUIT_IDS)[number],
  );
  if (idx <= 0) return true; // Misión 1 (aviadores) siempre es el punto de entrada
  const prevCircuitId = WENO_STORY_ORDERED_CIRCUIT_IDS[idx - 1];
  const prevMissionId = CIRCUIT_TO_WENO_MISSION_ID[prevCircuitId];
  return state.completedMissions.includes(prevMissionId);
}

export function getNextUnlockedStoryCircuitId(
  state: StoryProgressState = loadStoryProgress(),
): string {
  for (const circuitId of WENO_STORY_ORDERED_CIRCUIT_IDS) {
    const mId = CIRCUIT_TO_WENO_MISSION_ID[circuitId];
    if (!state.completedMissions.includes(mId)) {
      return circuitId;
    }
  }
  return 'aviadores';
}

export function canStartRecoveryMission(
  state: StoryProgressState = loadStoryProgress(),
): boolean {
  const allSixDone = WENO_STORY_ORDERED_CIRCUIT_IDS.every((cId) =>
    state.completedMissions.includes(CIRCUIT_TO_WENO_MISSION_ID[cId]),
  );
  return allSixDone && state.eliteAwarded;
}

export function isLamborghiniUnlockedForFreePlay(
  state: StoryProgressState = loadStoryProgress(),
): boolean {
  return (
    state.recoveryCompleted &&
    state.lamborghiniStatus === 'recovered_unlocked' &&
    isNarrativeStateAtLeast(state.narrativeState, 'lamborghini_recovered')
  );
}

export function canUseLamborghiniInContext(
  context: 'mission_0' | 'weno_campaign' | 'recovery_final' | 'compare' | 'free_play',
  state: StoryProgressState = loadStoryProgress(),
): boolean {
  if (context === 'mission_0') return true;
  if (context === 'weno_campaign' || context === 'recovery_final' || context === 'compare') {
    return false;
  }
  return isLamborghiniUnlockedForFreePlay(state);
}

export interface StoryMissionAttemptOutcome {
  storyState: StoryProgressState;
  missionId: string;
  won: boolean;
  newlyCompletedMission: boolean;
  unlockedNextMissionId: string | null;
  unlockedNextCircuitId: string | null;
  clueTitle: string | null;
  newlyUnlockedRecovery: boolean;
  newlyRecoveredLamborghini: boolean;
}

/**
 * Registra el resultado real de una carrera de la historia (Misión 0, Misiones 1–6 o Recuperación Final).
 * Si el jugador pierde o corre en práctica libre, no entrega recompensas ni desbloquea capítulos (§14, §20).
 */
export function recordStoryMissionAttempt(args: {
  missionId?: string | null;
  circuitId: string;
  won: boolean;
  finishTimeSec?: number | null;
  raceMode?: RaceModeId;
  availableCircuitIds: readonly string[];
}): StoryMissionAttemptOutcome {
  const cleanCircuit = args.circuitId.trim().toLowerCase().replace(/^circuit-/, '');
  const current = loadStoryProgress();
  const isPractice = args.raceMode === 'practice_free';

  // Determinar qué misión se estaba jugando
  const resolvedMissionId =
    args.missionId ||
    CIRCUIT_TO_WENO_MISSION_ID[cleanCircuit] ||
    'weno_1';
  const missionSpec =
    STORY_CONNECTED_MISSIONS.find((m) => m.missionId === resolvedMissionId) ??
    STORY_CONNECTED_MISSIONS[1];

  if (isPractice || !args.won) {
    return {
      storyState: current,
      missionId: resolvedMissionId,
      won: false,
      newlyCompletedMission: false,
      unlockedNextMissionId: null,
      unlockedNextCircuitId: null,
      clueTitle: null,
      newlyUnlockedRecovery: false,
      newlyRecoveredLamborghini: false,
    };
  }

  // Caso 1: Misión 0 (Prueba del Lamborghini)
  if (resolvedMissionId === 'mission_0') {
    const wasDone = current.completedMissions.includes('mission_0');
    const nextState = recordMission0EvaluationOutcome({
      won: true,
      finishTimeSec: args.finishTimeSec,
    });
    return {
      storyState: nextState,
      missionId: 'mission_0',
      won: true,
      newlyCompletedMission: !wasDone,
      unlockedNextMissionId: 'weno_1',
      unlockedNextCircuitId: 'aviadores',
      clueTitle: missionSpec.clueTitle,
      newlyUnlockedRecovery: false,
      newlyRecoveredLamborghini: false,
    };
  }

  // Caso 2: Misión Bonus de Recuperación Final
  if (resolvedMissionId === 'recovery_final') {
    if (!canStartRecoveryMission(current)) {
      return {
        storyState: current,
        missionId: 'recovery_final',
        won: false,
        newlyCompletedMission: false,
        unlockedNextMissionId: null,
        unlockedNextCircuitId: null,
        clueTitle: null,
        newlyUnlockedRecovery: false,
        newlyRecoveredLamborghini: false,
      };
    }
    const wasRecovered = current.recoveryCompleted;
    const nextState = updateStoryProgress((cur) => ({
      ...cur,
      narrativeState: advanceNarrativeState(cur.narrativeState, 'lamborghini_recovered'),
      currentChapter: 'chapter_recovery_cinematic',
      completedMissions: Array.from(new Set([...cur.completedMissions, 'recovery_final'])),
      discoveredClues: Array.from(new Set([...cur.discoveredClues, 'clue_7_recovered'])),
      lamborghiniStatus: 'recovered_unlocked',
      recoveryCompleted: true,
    }));
    return {
      storyState: nextState,
      missionId: 'recovery_final',
      won: true,
      newlyCompletedMission: !wasRecovered,
      unlockedNextMissionId: null,
      unlockedNextCircuitId: null,
      clueTitle: missionSpec.clueTitle,
      newlyUnlockedRecovery: false,
      newlyRecoveredLamborghini: !wasRecovered,
    };
  }

  // Caso 3: Misiones 1 a 6 de Operación WENO
  if (!isWenoCircuitUnlockedInStory(cleanCircuit, current)) {
    return {
      storyState: current,
      missionId: resolvedMissionId,
      won: false,
      newlyCompletedMission: false,
      unlockedNextMissionId: null,
      unlockedNextCircuitId: null,
      clueTitle: null,
      newlyUnlockedRecovery: false,
      newlyRecoveredLamborghini: false,
    };
  }

  const wasCompleted = current.completedMissions.includes(resolvedMissionId);
  const wasRecoveryUnlocked = current.recoveryUnlocked;

  // Sincronizar con careerProgression para mantener una única fuente de verdad
  recordWenoBankCircuitAttempt({
    circuitId: cleanCircuit,
    won: true,
    finishTimeSec: args.finishTimeSec,
    raceMode: args.raceMode,
    availableCircuitIds: args.availableCircuitIds,
  });

  const nextState = updateStoryProgress((cur) => {
    const nextMissions = Array.from(new Set([...cur.completedMissions, resolvedMissionId]));
    const nextClues = Array.from(new Set([...cur.discoveredClues, missionSpec.clueId]));
    const allSixDone = WENO_STORY_ORDERED_CIRCUIT_IDS.every((cId) =>
      nextMissions.includes(CIRCUIT_TO_WENO_MISSION_ID[cId]),
    );
    return {
      ...cur,
      narrativeState: advanceNarrativeState(
        cur.narrativeState,
        allSixDone ? 'recovery_unlocked' : missionSpec.completionState,
      ),
      completedMissions: nextMissions,
      discoveredClues: nextClues,
      eliteAwarded: cur.eliteAwarded || allSixDone,
      recoveryUnlocked: cur.recoveryUnlocked || allSixDone,
    };
  });

  const unlockedNextCircuitId = missionSpec.unlocksMissionId
    ? WENO_MISSION_TO_CIRCUIT_ID[missionSpec.unlocksMissionId] ?? null
    : null;

  return {
    storyState: nextState,
    missionId: resolvedMissionId,
    won: true,
    newlyCompletedMission: !wasCompleted,
    unlockedNextMissionId: missionSpec.unlocksMissionId,
    unlockedNextCircuitId,
    clueTitle: missionSpec.clueTitle,
    newlyUnlockedRecovery: !wasRecoveryUnlocked && nextState.recoveryUnlocked,
    newlyRecoveredLamborghini: false,
  };
}

export function completeEpilogueAndSeason1(): StoryProgressState {
  return updateStoryProgress((cur) => ({
    ...cur,
    narrativeState: advanceNarrativeState(cur.narrativeState, 'epilogue_completed'),
    currentChapter: 'chapter_epilogue',
    epilogueCompleted: true,
    seenCinematics: Array.from(
      new Set([...cur.seenCinematics, 'lamborghini_recovery', 'season_1_epilogue']),
    ),
  }));
}

export function useStoryProgress(): StoryProgressState {
  const [state, setState] = useState<StoryProgressState>(() => loadStoryProgress());

  useEffect(() => {
    const sync = () => setState(loadStoryProgress());
    window.addEventListener(STORY_PROGRESS_EVENT, sync);
    window.addEventListener('datacar-progression-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(STORY_PROGRESS_EVENT, sync);
      window.removeEventListener('datacar-progression-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return state;
}

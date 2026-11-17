import type { RaceModeId } from './careerProgression';

/**
 * Texto narrativo oficial de la campaña "Persecución en Asunción" (Asunción Pursuit).
 * Debe mantenerse exactamente fiel al guion narrativo de Datacar.
 */
export const ASUNCION_PURSUIT_LORE_TEXT =
  'Un político corrupto ha vaciado las arcas del municipio de Asunción y está en camino al aeropuerto con el dinero. Datacar te ha contratado a vos, su piloto de élite, para interceptarlo en el hangar antes de que escape. Pero primero, deberás superar las pruebas de conducción contrarreloj en el circuito más salvaje de todos... y no estamos hablando del Chaco paraguayo, sino de Asunción y sus legendarios baches.';

export interface PursuitBriefingGateArgs {
  experience: 'legacy' | 'comparison' | 'race' | 'replay';
  raceMode?: RaceModeId;
  onlineSession?: boolean;
  skipBriefing?: boolean;
}

/**
 * Determina si debe desplegarse el dossier narrativo previo a la cuenta regresiva (3, 2, 1)
 * sobre el lienzo WebGL al cargar un circuito.
 */
export function shouldShowAsuncionPursuitBriefing(args: PursuitBriefingGateArgs): boolean {
  if (args.experience !== 'race') return false;
  if (args.onlineSession) return false;
  if (args.skipBriefing) return false;
  return true;
}

export interface PursuitMissionMetadata {
  operationCode: string;
  modeClassification: string;
  objectiveSummary: string;
  isCompetitionMode: boolean;
}

export function buildPursuitMissionMetadata(
  raceMode: RaceModeId = 'city_trial',
  targetGoldLabel?: string,
): PursuitMissionMetadata {
  const isCompetitionMode = raceMode !== 'practice_free';
  if (raceMode === 'speed_pro') {
    return {
      operationCode: 'OP-ASU-02 · FASE 2 INTERCEPCIÓN',
      modeClassification: 'MODO COMPETICIÓN · VELOCIDAD PURA',
      objectiveSummary: targetGoldLabel
        ? `Batir cronómetro de corte (${targetGoldLabel})`
        : 'Superar corte de velocidad rumbo a Luque',
      isCompetitionMode: true,
    };
  }
  if (raceMode === 'practice_free') {
    return {
      operationCode: 'OP-ASU-00 · RECONOCIMIENTO VIAL',
      modeClassification: 'RECONOCIMIENTO TÁCTICO · SIN PENALIDAD',
      objectiveSummary: 'Memorizar trazado, baches y referencias de frenada',
      isCompetitionMode: false,
    };
  }
  return {
    operationCode: 'OP-ASU-01 · CONTRARRELOJ URBANA',
    modeClassification: 'MODO COMPETICIÓN · CLASIFICACIÓN ÉLITE',
    objectiveSummary: targetGoldLabel
      ? `Superar tiempo objetivo (${targetGoldLabel})`
      : 'Clasificar dentro del tiempo límite oficial',
    isCompetitionMode: true,
  };
}

/**
 * DATACAR ARENA — OPERACIÓN WENO: EL PROYECTO FANTASMA
 * Definición estructurada de la campaña narrativa, capítulos, requisitos, pistas,
 * diálogos tipados y misiones conectadas.
 */

export type StoryNarrativeStateId =
  | 'not_started'
  | 'intro_started'
  | 'intro_completed'
  | 'mission_0_available'
  | 'mission_0_completed'
  | 'lamborghini_stolen'
  | 'garage_unlocked'
  | 'weno_mission_1_completed'
  | 'weno_mission_2_completed'
  | 'weno_mission_3_completed'
  | 'weno_mission_4_completed'
  | 'weno_mission_5_completed'
  | 'weno_mission_6_completed'
  | 'elite_awarded'
  | 'recovery_unlocked'
  | 'lamborghini_recovered'
  | 'epilogue_completed';

export const STORY_NARRATIVE_STATE_ORDER: readonly StoryNarrativeStateId[] = [
  'not_started',
  'intro_started',
  'intro_completed',
  'mission_0_available',
  'mission_0_completed',
  'lamborghini_stolen',
  'garage_unlocked',
  'weno_mission_1_completed',
  'weno_mission_2_completed',
  'weno_mission_3_completed',
  'weno_mission_4_completed',
  'weno_mission_5_completed',
  'weno_mission_6_completed',
  'elite_awarded',
  'recovery_unlocked',
  'lamborghini_recovered',
  'epilogue_completed',
] as const;

export type StoryChapterId =
  | 'chapter_intro_video'
  | 'chapter_phone_recruitment'
  | 'chapter_lamborghini_reveal'
  | 'chapter_mission_0_test'
  | 'chapter_mission_0_discovery'
  | 'chapter_theft_cinematic'
  | 'chapter_garage_entry'
  | 'chapter_weno_1'
  | 'chapter_weno_2'
  | 'chapter_weno_3'
  | 'chapter_weno_4'
  | 'chapter_weno_5'
  | 'chapter_weno_6'
  | 'chapter_elite_recognition'
  | 'chapter_recovery_mission'
  | 'chapter_recovery_cinematic'
  | 'chapter_epilogue';

export type LamborghiniCampaignStatus =
  | 'prototype_test'
  | 'stolen_locked'
  | 'recovered_unlocked';

export interface StoryDialogueAttachment {
  title: string;
  status: string;
  location: string;
  badge?: string;
}

export interface StoryDialogueMessage {
  id: string;
  sender: 'CENTRAL DATACAR' | 'REMITENTE DESCONOCIDO' | 'SISTEMA DATACAR';
  chapterId: StoryChapterId;
  text: string;
  order: number;
  triggerEvent: string;
  minReadDurationMs: number;
  canAdvance: boolean;
  viewed?: boolean;
  nextAction: string;
  isPauseAfter?: boolean;
  attachment?: StoryDialogueAttachment;
}

export interface StoryIntroOverlayCue {
  id: string;
  startSec: number;
  endSec: number;
  kind: 'location_timestamp' | 'phone_notification' | 'confidential_stamp';
  sender?: string;
  headline: string;
  subline?: string;
  vibrate?: boolean;
}

/**
 * Cronograma preciso de los 10 segundos de la cinemática de apertura (§4)
 */
export const STORY_INTRO_10S_TIMELINE: readonly StoryIntroOverlayCue[] = [
  {
    id: 'cue_0_2_asuncion',
    startSec: 0,
    endSec: 2,
    kind: 'location_timestamp',
    headline: 'ASUNCIÓN, PARAGUAY',
    subline: '23:47 HS.',
  },
  {
    id: 'cue_2_4_msg1',
    startSec: 2,
    endSec: 4,
    kind: 'phone_notification',
    sender: 'CENTRAL DATACAR',
    headline: '"TENEMOS UN TRABAJO PARA VOS."',
    vibrate: true,
  },
  {
    id: 'cue_4_6_msg2',
    startSec: 4,
    endSec: 6,
    kind: 'phone_notification',
    sender: 'CENTRAL DATACAR',
    headline: '"NECESITAMOS UN PILOTO. NO CUALQUIERA."',
  },
  {
    id: 'cue_6_8_msg3',
    startSec: 6,
    endSec: 8,
    kind: 'phone_notification',
    sender: 'CENTRAL DATACAR',
    headline: '"HAY UN VEHÍCULO QUE DEBEMOS PROBAR ESTA NOCHE."',
  },
  {
    id: 'cue_8_10_confidential',
    startSec: 8,
    endSec: 10,
    kind: 'confidential_stamp',
    headline: 'PROYECTO FANTASMA',
    subline: 'ARCHIVO CONFIDENCIAL.',
  },
] as const;

/**
 * Diálogos estructurados por escena / capítulo (§5, §6, §7, §8, §9, §10, §11, §12, §13, §18)
 */
export const STORY_DIALOGUES_BY_CHAPTER: Readonly<Record<string, readonly StoryDialogueMessage[]>> = {
  recruitment_phone: [
    {
      id: 'rec_1',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_phone_recruitment',
      text: 'Tenemos un trabajo para vos.',
      order: 1,
      triggerEvent: 'intro_video_completed',
      minReadDurationMs: 900,
      canAdvance: true,
      nextAction: 'rec_2',
    },
    {
      id: 'rec_2',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_phone_recruitment',
      text: 'Necesitamos un piloto. No cualquiera.',
      order: 2,
      triggerEvent: 'rec_1_done',
      minReadDurationMs: 900,
      canAdvance: true,
      nextAction: 'rec_3',
    },
    {
      id: 'rec_3',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_phone_recruitment',
      text: 'Hay un vehículo que debemos probar esta noche.',
      order: 3,
      triggerEvent: 'rec_2_done',
      minReadDurationMs: 1000,
      canAdvance: true,
      nextAction: 'rec_4',
    },
    {
      id: 'rec_4',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_phone_recruitment',
      text: 'Su sistema guarda información que todavía no conseguimos descifrar.',
      order: 4,
      triggerEvent: 'rec_3_done',
      minReadDurationMs: 1100,
      canAdvance: true,
      nextAction: 'rec_5',
    },
    {
      id: 'rec_5',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_phone_recruitment',
      text: 'Queremos saber qué puede hacer.',
      order: 5,
      triggerEvent: 'rec_4_done',
      minReadDurationMs: 900,
      canAdvance: true,
      nextAction: 'rec_6',
    },
    {
      id: 'rec_6',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_phone_recruitment',
      text: 'Y queremos saber qué podés hacer vos.',
      order: 6,
      triggerEvent: 'rec_5_done',
      minReadDurationMs: 1000,
      canAdvance: true,
      nextAction: 'rec_7_prompt',
      attachment: {
        title: 'PROYECTO FANTASMA',
        status: 'CONFIDENCIAL',
        location: 'HANGAR DATACAR',
        badge: 'EXPEDIENTE ADJUNTO',
      },
    },
    {
      id: 'rec_7_prompt',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_phone_recruitment',
      text: '¿ACEPTÁS LA MISIÓN?',
      order: 7,
      triggerEvent: 'rec_6_done',
      minReadDurationMs: 600,
      canAdvance: false,
      nextAction: 'await_player_consent',
    },
  ],

  mission_0_pre: [
    {
      id: 'm0_pre_1',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_lamborghini_reveal',
      text: 'Necesitamos una evaluación completa.',
      order: 1,
      triggerEvent: 'hangar_lights_on',
      minReadDurationMs: 900,
      canAdvance: true,
      nextAction: 'm0_pre_2',
    },
    {
      id: 'm0_pre_2',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_lamborghini_reveal',
      text: 'Conducí, completá el recorrido y regresá.',
      order: 2,
      triggerEvent: 'm0_pre_1_done',
      minReadDurationMs: 900,
      canAdvance: true,
      nextAction: 'start_mission_0_race',
    },
  ],

  mission_0_post_victory: [
    {
      id: 'm0_win_1',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_mission_0_discovery',
      text: 'Impresionante.',
      order: 1,
      triggerEvent: 'mission_0_victory',
      minReadDurationMs: 800,
      canAdvance: true,
      nextAction: 'm0_win_2',
    },
    {
      id: 'm0_win_2',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_mission_0_discovery',
      text: 'El vehículo respondió mejor de lo esperado.',
      order: 2,
      triggerEvent: 'm0_win_1_done',
      minReadDurationMs: 950,
      canAdvance: true,
      nextAction: 'm0_win_3',
    },
    {
      id: 'm0_win_3',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_mission_0_discovery',
      text: 'Y encontramos algo que no esperábamos.',
      order: 3,
      triggerEvent: 'm0_win_2_done',
      minReadDurationMs: 1000,
      canAdvance: true,
      nextAction: 'open_discovery_map',
    },
  ],

  discovery_routes: [
    {
      id: 'disc_1',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_mission_0_discovery',
      text: 'El Lamborghini tiene información oculta.',
      order: 1,
      triggerEvent: 'discovery_opened',
      minReadDurationMs: 900,
      canAdvance: true,
      nextAction: 'disc_2',
    },
    {
      id: 'disc_2',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_mission_0_discovery',
      text: 'Seis recorridos.',
      order: 2,
      triggerEvent: 'disc_1_done',
      minReadDurationMs: 800,
      canAdvance: true,
      nextAction: 'disc_3',
    },
    {
      id: 'disc_3',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_mission_0_discovery',
      text: 'Seis vehículos.',
      order: 3,
      triggerEvent: 'disc_2_done',
      minReadDurationMs: 800,
      canAdvance: true,
      nextAction: 'disc_4',
    },
    {
      id: 'disc_4',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_mission_0_discovery',
      text: 'Y todos están conectados con WENO Bank.',
      order: 4,
      triggerEvent: 'disc_3_done',
      minReadDurationMs: 1100,
      canAdvance: true,
      nextAction: 'trigger_theft_cinematic',
    },
  ],

  theft_cinematic: [
    {
      id: 'theft_1',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_theft_cinematic',
      text: 'Tenemos una alerta de seguridad.',
      order: 1,
      triggerEvent: 'hangar_breach',
      minReadDurationMs: 950,
      canAdvance: true,
      nextAction: 'theft_2',
    },
    {
      id: 'theft_2',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_theft_cinematic',
      text: 'Alguien ingresó al hangar.',
      order: 2,
      triggerEvent: 'theft_1_done',
      minReadDurationMs: 1200,
      canAdvance: true,
      isPauseAfter: true,
      nextAction: 'theft_3',
    },
    {
      id: 'theft_3',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_theft_cinematic',
      text: 'Nos robaron el Proyecto Fantasma.',
      order: 3,
      triggerEvent: 'theft_2_done',
      minReadDurationMs: 1300,
      canAdvance: true,
      isPauseAfter: true,
      nextAction: 'theft_4',
    },
    {
      id: 'theft_4',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_theft_cinematic',
      text: 'Pero cometieron un error.',
      order: 4,
      triggerEvent: 'theft_3_done',
      minReadDurationMs: 950,
      canAdvance: true,
      nextAction: 'theft_5',
    },
    {
      id: 'theft_5',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_theft_cinematic',
      text: 'Durante la prueba recuperamos parte de su historial.',
      order: 5,
      triggerEvent: 'theft_4_done',
      minReadDurationMs: 1050,
      canAdvance: true,
      nextAction: 'theft_6',
    },
    {
      id: 'theft_6',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_theft_cinematic',
      text: 'Creo que sabemos por qué lo querían.',
      order: 6,
      triggerEvent: 'theft_5_done',
      minReadDurationMs: 1100,
      canAdvance: true,
      nextAction: 'enter_narrative_garage',
      attachment: {
        title: 'OPERACIÓN WENO',
        status: 'INVESTIGACIÓN ACTIVADA',
        location: 'ASUNCIÓN · 6 RUTAS CLASIFICADAS',
        badge: 'ALERTA NIVEL 1',
      },
    },
  ],

  garage_first_entry: [
    {
      id: 'gar_1',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_garage_entry',
      text: 'Necesitamos recuperar el Lamborghini.',
      order: 1,
      triggerEvent: 'garage_entered',
      minReadDurationMs: 900,
      canAdvance: true,
      nextAction: 'gar_2',
    },
    {
      id: 'gar_2',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_garage_entry',
      text: 'Pero primero tenemos que identificar a los responsables.',
      order: 2,
      triggerEvent: 'gar_1_done',
      minReadDurationMs: 950,
      canAdvance: true,
      nextAction: 'gar_3',
    },
    {
      id: 'gar_3',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_garage_entry',
      text: 'Disponemos de siete vehículos.',
      order: 3,
      triggerEvent: 'gar_2_done',
      minReadDurationMs: 850,
      canAdvance: true,
      nextAction: 'gar_4',
    },
    {
      id: 'gar_4',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_garage_entry',
      text: 'Elegí el tuyo.',
      order: 4,
      triggerEvent: 'gar_3_done',
      minReadDurationMs: 800,
      canAdvance: true,
      nextAction: 'gar_5',
    },
    {
      id: 'gar_5',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_garage_entry',
      text: 'Cada victoria nos acercará a la verdad.',
      order: 5,
      triggerEvent: 'gar_4_done',
      minReadDurationMs: 1000,
      canAdvance: true,
      nextAction: 'unlock_mission_1',
    },
  ],

  elite_bonus_unlock: [
    {
      id: 'elite_1',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_elite_recognition',
      text: 'Detectamos el traslado final del Proyecto Fantasma.',
      order: 1,
      triggerEvent: 'elite_awarded',
      minReadDurationMs: 950,
      canAdvance: true,
      nextAction: 'elite_2',
    },
    {
      id: 'elite_2',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_elite_recognition',
      text: 'Está rumbo al aeropuerto.',
      order: 2,
      triggerEvent: 'elite_1_done',
      minReadDurationMs: 900,
      canAdvance: true,
      nextAction: 'elite_3',
    },
    {
      id: 'elite_3',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_elite_recognition',
      text: 'Tenemos una oportunidad para recuperarlo.',
      order: 3,
      triggerEvent: 'elite_2_done',
      minReadDurationMs: 1050,
      canAdvance: true,
      nextAction: 'launch_recovery_mission',
      attachment: {
        title: 'MISIÓN BONUS DESBLOQUEADA',
        status: 'OPERACIÓN FANTASMA — RECUPERACIÓN FINAL',
        location: 'CORREDOR AEROPUERTO · HANGAR PRIVADO',
        badge: 'PRIORIDAD MÁXIMA',
      },
    },
  ],

  recovery_victory: [
    {
      id: 'recov_1',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_recovery_cinematic',
      text: 'Cuando te elegimos, necesitábamos un buen piloto.',
      order: 1,
      triggerEvent: 'recovery_race_won',
      minReadDurationMs: 1000,
      canAdvance: true,
      nextAction: 'recov_2',
    },
    {
      id: 'recov_2',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_recovery_cinematic',
      text: 'Ahora sabemos que encontramos al mejor.',
      order: 2,
      triggerEvent: 'recov_1_done',
      minReadDurationMs: 1000,
      canAdvance: true,
      nextAction: 'recov_3',
    },
    {
      id: 'recov_3',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_recovery_cinematic',
      text: 'Bienvenido de nuevo, Proyecto Fantasma.',
      order: 3,
      triggerEvent: 'recov_2_done',
      minReadDurationMs: 1200,
      canAdvance: true,
      nextAction: 'proceed_to_epilogue',
      attachment: {
        title: 'LAMBORGHINI RECUPERADO',
        status: 'VEHÍCULO BONUS DESBLOQUEADO',
        location: 'DISPONIBLE PARA CARRERA LIBRE Y DESAFÍOS ESPECIALES',
        badge: 'RECOMPENSA ÉLITE',
      },
    },
  ],

  epilogue_messages: [
    {
      id: 'epi_1',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_epilogue',
      text: 'Operación WENO: completada.',
      order: 1,
      triggerEvent: 'epilogue_started',
      minReadDurationMs: 900,
      canAdvance: true,
      nextAction: 'epi_2',
    },
    {
      id: 'epi_2',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_epilogue',
      text: 'Proyecto Fantasma: recuperado.',
      order: 2,
      triggerEvent: 'epi_1_done',
      minReadDurationMs: 900,
      canAdvance: true,
      nextAction: 'epi_3',
    },
    {
      id: 'epi_3',
      sender: 'CENTRAL DATACAR',
      chapterId: 'chapter_epilogue',
      text: 'Piloto: Élite.',
      order: 3,
      triggerEvent: 'epi_2_done',
      minReadDurationMs: 1200,
      canAdvance: true,
      isPauseAfter: true,
      nextAction: 'epi_4_unknown',
    },
    {
      id: 'epi_4_unknown',
      sender: 'REMITENTE DESCONOCIDO',
      chapterId: 'chapter_epilogue',
      text: 'Creyeron que WENO era toda la organización.',
      order: 4,
      triggerEvent: 'epi_3_done',
      minReadDurationMs: 1100,
      canAdvance: true,
      nextAction: 'epi_5_unknown',
    },
    {
      id: 'epi_5_unknown',
      sender: 'REMITENTE DESCONOCIDO',
      chapterId: 'chapter_epilogue',
      text: 'Esto recién empieza.',
      order: 5,
      triggerEvent: 'epi_4_done',
      minReadDurationMs: 1200,
      canAdvance: true,
      nextAction: 'complete_season_1',
      attachment: {
        title: 'DATACAR ARENA',
        status: 'FIN DE LA PRIMERA TEMPORADA.',
        location: 'MODALIDAD SECUNDARIA HABILITADA: PERSECUCIÓN EN ASUNCIÓN',
        badge: 'TEMPORADA 1 COMPLETADA',
      },
    },
  ],
};

export interface StoryConnectedMissionSpec {
  missionId: string;
  missionNumber: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  chapterId: StoryChapterId;
  circuitId: string;
  circuitDisplayName: string;
  title: string;
  subtitle: string;
  antagonistName: string;
  antagonistVehicle: string;
  objectiveSummary: string;
  playableChecklist: readonly string[];
  introDialogueLines: readonly string[];
  victoryNarrativeOutcome: string;
  clueId: string;
  clueTitle: string;
  clueDetail: string;
  revelationDialogueLines: readonly string[];
  defeatMessage: string;
  specialSceneNote?: string;
  requiredPreviousMissionId: string | null;
  unlocksMissionId: string | null;
  completionState: StoryNarrativeStateId;
  usesPhoneAlertBefore?: boolean;
  usesPhoneAlertAfter?: boolean;
}

/**
 * Orden canónico de los 6 circuitos de la campaña Operación WENO (§10 y §14):
 * 1. Aviadores del Chaco (Misión 1)
 * 2. Oliva y Piribebuy (Misión 2)
 * 3. Herrera y Caballero (Misión 3)
 * 4. José Félix López (Misión 4)
 * 5. Artigas y Mburicaó (Misión 5)
 * 6. Avelino Martínez (Misión 6)
 */
export const WENO_STORY_ORDERED_CIRCUIT_IDS = [
  'aviadores',
  'oliva',
  'herrera',
  'jose-felix',
  'artigas',
  'avelino',
] as const;

export const STORY_CONNECTED_MISSIONS: readonly StoryConnectedMissionSpec[] = [
  {
    missionId: 'mission_0',
    missionNumber: 0,
    chapterId: 'chapter_mission_0_test',
    circuitId: 'aviadores',
    circuitDisplayName: 'Corredor Nocturno Aviadores del Chaco (Evaluación Hangar DATACAR)',
    title: 'MISIÓN 0 — PRUEBA DE CONDUCCIÓN',
    subtitle: 'LAMBORGHINI · PROYECTO FANTASMA',
    antagonistName: 'Cronómetro de Telemetría Forense DATACAR',
    antagonistVehicle: 'Lamborghini Proyecto Fantasma (Unidad Experimental)',
    objectiveSummary:
      'Completá la evaluación dinámica del Lamborghini Proyecto Fantasma para sincronizar su módulo de diagnóstico interno y regresar al hangar.',
    playableChecklist: [
      '1. Acelerar desde la grilla de evaluación nocturna.',
      '2. Completar dos puntos de control de telemetría en la avenida.',
      '3. Tomar la curva principal manteniendo tracción controlada.',
      '4. Frenar en la zona indicada respetando semáforos y cruces.',
      '5. Cruzar la meta dentro del tiempo de evaluación para aprobar.',
    ],
    introDialogueLines: [
      'Necesitamos una evaluación completa.',
      'Conducí, completá el recorrido y regresá.',
    ],
    victoryNarrativeOutcome:
      'Durante la prueba, el sistema de diagnóstico de DATACAR recuperó seis rutas históricas ocultas en la memoria del Lamborghini y transmitió una señal de diagnóstico.',
    clueId: 'clue_0_routes',
    clueTitle: 'SEIS RUTAS VINCULADAS A WENO BANK RECUPERADAS.',
    clueDetail:
      'El módulo de diagnóstico reveló seis recorridos históricos asociados a distintos vehículos y operaciones vinculadas con WENO Bank. Son pistas que requieren corroboración.',
    revelationDialogueLines: [
      'Impresionante.',
      'El vehículo respondió mejor de lo esperado.',
      'Y encontramos algo que no esperábamos.',
    ],
    defeatMessage:
      'La sincronización del módulo de diagnóstico requiere completar el recorrido dentro del parámetro de evaluación. Podés reintentar la prueba.',
    requiredPreviousMissionId: null,
    unlocksMissionId: 'weno_1',
    completionState: 'mission_0_completed',
  },
  {
    missionId: 'weno_1',
    missionNumber: 1,
    chapterId: 'chapter_weno_1',
    circuitId: 'aviadores',
    circuitDisplayName: 'Avenida Aviadores del Chaco',
    title: 'MISIÓN 1 — EL ÚLTIMO RETIRO',
    subtitle: 'CAPÍTULO 1 · OPERACIÓN WENO',
    antagonistName: 'Político ficticio en traslado',
    antagonistVehicle: 'Limusina negra blindada',
    objectiveSummary:
      'Llegar a la sede de WENO Bank por Aviadores del Chaco antes que la limusina negra para que el equipo de DATACAR documente el vehículo.',
    playableChecklist: [
      'Alcanzar el acceso principal de WENO Bank antes del tiempo límite.',
      'Permitir que el equipo técnico verifique la patente y el chasis de la limusina.',
    ],
    introDialogueLines: [
      'Identificamos uno de los vehículos registrados.',
      'Es una limusina negra.',
      'Su conductor se dirige a WENO Bank.',
      'Necesitamos llegar antes.',
    ],
    victoryNarrativeOutcome:
      'El equipo de DATACAR documenta la llegada y confirma que la limusina negra coincide exactamente con uno de los vehículos captados en la emboscada al hangar.',
    clueId: 'clue_1_limo',
    clueTitle: 'LA LIMUSINA DEL ROBO IDENTIFICADA.',
    clueDetail:
      'Los registros visuales corroboran que la limusina blindada participó directamente en la extracción del Proyecto Fantasma del hangar DATACAR.',
    revelationDialogueLines: [
      'Ya sabemos quiénes se llevaron el Lamborghini.',
      'Pero todavía no sabemos por qué.',
    ],
    defeatMessage:
      'La limusina negra se retiró antes de que el equipo pudiera documentar su registro. Reintentá la misión para obtener la pista.',
    requiredPreviousMissionId: null,
    unlocksMissionId: 'weno_2',
    completionState: 'weno_mission_1_completed',
  },
  {
    missionId: 'weno_2',
    missionNumber: 2,
    chapterId: 'chapter_weno_2',
    circuitId: 'oliva',
    circuitDisplayName: 'Calle Oliva y Piribebuy',
    title: 'MISIÓN 2 — EL BANQUERO DESAPARECIDO',
    subtitle: 'CAPÍTULO 2 · OPERACIÓN WENO',
    antagonistName: 'Banquero ficticio de enlace',
    antagonistVehicle: 'Sedán ejecutivo de lujo',
    objectiveSummary:
      'Seguir el movimiento por Oliva y Piribebuy antes de que el ejecutivo cierre la transferencia vinculada a la empresa de la limusina.',
    playableChecklist: [
      'Superar el trazado histórico de Oliva y Piribebuy dentro del tiempo límite.',
      'Asegurar el registro de la operación para los investigadores.',
    ],
    introDialogueLines: [
      'La limusina estaba vinculada a una empresa.',
      'Esa empresa tiene relaciones con WENO Bank.',
      'Su ejecutivo está intentando cerrar una transferencia.',
      'Necesitamos seguir la operación.',
    ],
    victoryNarrativeOutcome:
      'DATACAR relaciona los metadatos de la transferencia con la sociedad intermediaria que figuraba como propietaria anterior del Lamborghini.',
    clueId: 'clue_2_shell_company',
    clueTitle: 'SOCIEDAD INTERMEDIARIA IDENTIFICADA.',
    clueDetail:
      'La sociedad pantalla operaba con WENO Bank y había registrado el Lamborghini antes de su incautación. Su computadora de a bordo conserva las coordenadas donde se reunieron.',
    revelationDialogueLines: [
      'Ahora entendemos por qué lo quieren.',
      'El Lamborghini estuvo vinculado a la red financiera.',
      'Y sus registros pueden demostrar dónde se reunieron sus integrantes.',
    ],
    defeatMessage:
      'El ejecutivo abandonó el microcentro antes de poder documentar el vínculo societario. Reintentá el recorrido.',
    requiredPreviousMissionId: 'weno_1',
    unlocksMissionId: 'weno_3',
    completionState: 'weno_mission_2_completed',
  },
  {
    missionId: 'weno_3',
    missionNumber: 3,
    chapterId: 'chapter_weno_3',
    circuitId: 'herrera',
    circuitDisplayName: 'Esquina Herrera y Caballero',
    title: 'MISIÓN 3 — LOS FONDOS RESERVADOS',
    subtitle: 'CAPÍTULO 3 · OPERACIÓN WENO',
    antagonistName: 'Funcionario ficticio de logística',
    antagonistVehicle: 'SUV blindada oficial',
    objectiveSummary:
      'Adelantarse a la SUV blindada en Herrera y Caballero para que el equipo de DATACAR corrobore la autorización de transporte detectada.',
    playableChecklist: [
      'Sortear los baches encadenados de Herrera y Caballero sin dañar la suspensión.',
      'Cruzar la meta dentro del tiempo exigido para documentar el despacho.',
    ],
    introDialogueLines: [
      'Un funcionario está trasladando documentación.',
      'Entre los movimientos detectados aparece una autorización de transporte.',
      'Creemos que corresponde al Proyecto Fantasma.',
    ],
    victoryNarrativeOutcome:
      'El equipo de DATACAR corrobora la orden de despacho logístico mediante la información reunida durante el operativo.',
    clueId: 'clue_3_transport_order',
    clueTitle: 'TRASLADO DEL LAMBORGHINI CONFIRMADO.',
    clueDetail:
      'La autorización de transporte confirma que el Proyecto Fantasma permanece oculto en territorio paraguayo mientras preparan su extracción aérea.',
    revelationDialogueLines: [
      'El auto sigue en Paraguay.',
      'Pero están preparando su salida.',
    ],
    defeatMessage:
      'El traslado de documentación se completó sin que pudiéramos corroborar el despacho. Volvé a intentarlo.',
    requiredPreviousMissionId: 'weno_2',
    unlocksMissionId: 'weno_4',
    completionState: 'weno_mission_3_completed',
  },
  {
    missionId: 'weno_4',
    missionNumber: 4,
    chapterId: 'chapter_weno_4',
    circuitId: 'jose-felix',
    circuitDisplayName: 'Calle José Félix López',
    title: 'MISIÓN 4 — LA LICITACIÓN MILAGROSA',
    subtitle: 'CAPÍTULO 4 · OPERACIÓN WENO',
    antagonistName: 'Empresario contratista ficticio',
    antagonistVehicle: 'Camioneta ejecutiva VIP',
    objectiveSummary:
      'Seguir el movimiento del contratista en José Félix López para rastrear los pagos del hangar donde ocultan el Lamborghini.',
    playableChecklist: [
      'Superar las zanjas de José Félix López dentro del cronómetro oficial.',
      'Localizar el destino de los pagos logísticos hacia la zona aeroportuaria.',
    ],
    introDialogueLines: [
      'Encontramos a la empresa que financia el traslado.',
      'Su propietario está intentando cerrar un contrato.',
      'Si conseguimos seguir el movimiento, podremos localizar el vehículo.',
    ],
    victoryNarrativeOutcome:
      'DATACAR descubre pagos dirigidos a un hangar privado próximo al aeropuerto. El equipo llega de inmediato al hangar, pero las instalaciones acaban de ser vaciadas.',
    specialSceneNote:
      'ESCENA DE INSPECCIÓN — HANGAR PRIVADO VACÍO: Las luces tácticas iluminan marcas frescas de neumáticos sobre el concreto. El Proyecto Fantasma fue retirado minutos antes.',
    clueId: 'clue_4_hangar_hideout',
    clueTitle: 'PRIMER ESCONDITE DESCUBIERTO.',
    clueDetail:
      'El hangar privado próximo al aeropuerto estaba vacío al llegar el equipo de DATACAR. Alguien dentro de la operación advirtió a los responsables.',
    revelationDialogueLines: [
      'Llegamos tarde.',
      'Alguien sabía que veníamos.',
    ],
    defeatMessage:
      'Perdimos el rastro de la camioneta ejecutiva antes de confirmar la ubicación del hangar. Reintentá la misión.',
    requiredPreviousMissionId: 'weno_3',
    unlocksMissionId: 'weno_5',
    completionState: 'weno_mission_4_completed',
    usesPhoneAlertAfter: true,
  },
  {
    missionId: 'weno_5',
    missionNumber: 5,
    chapterId: 'chapter_weno_5',
    circuitId: 'artigas',
    circuitDisplayName: 'Avenida Artigas y Mburicaó',
    title: 'MISIÓN 5 — EL EXPEDIENTE QUE CAMINA',
    subtitle: 'CAPÍTULO 5 · OPERACIÓN WENO',
    antagonistName: 'Comitiva oficial ficticia',
    antagonistVehicle: 'Vehículo oficial oscuro',
    objectiveSummary:
      'Interceptar el recorrido en Artigas y Mburicaó para corroborar los registros de acceso y descubrir quién filtró los códigos del hangar DATACAR.',
    playableChecklist: [
      'Dominar el tramo de raudales de Artigas y Mburicaó respetando las normas.',
      'Cruzar la meta antes que la comitiva para asegurar el registro de accesos.',
    ],
    introDialogueLines: [
      'Revisamos nuestros movimientos.',
      'Los sospechosos conocían nuestras rutas.',
      'Creemos que alguien nos está filtrando información.',
      'Hay un expediente que puede confirmar quién tuvo acceso.',
    ],
    victoryNarrativeOutcome:
      'El equipo de DATACAR corrobora los registros de autorización: el infiltrado era un contratista encargado del sistema de seguridad del hangar DATACAR que había vendido los códigos de acceso y compartido avances de la investigación.',
    clueId: 'clue_5_infiltrator',
    clueTitle: 'INFILTRADO IDENTIFICADO.',
    clueDetail:
      'Un contratista externo del sistema de seguridad del hangar DATACAR entregó los códigos usados en el robo y alertó sobre el operativo del hangar privado. Su acceso fue revocado.',
    revelationDialogueLines: [
      'Ahora sabemos cómo entraron.',
      'Y por qué siempre llegaban antes.',
      'Acabamos de cerrar su acceso.',
      'No volverán a anticiparse.',
    ],
    defeatMessage:
      'No logramos corroborar el expediente de autorizaciones a tiempo. Reintentá la carrera para identificar al infiltrado.',
    requiredPreviousMissionId: 'weno_4',
    unlocksMissionId: 'weno_6',
    completionState: 'weno_mission_5_completed',
    usesPhoneAlertAfter: true,
  },
  {
    missionId: 'weno_6',
    missionNumber: 6,
    chapterId: 'chapter_weno_6',
    circuitId: 'avelino',
    circuitDisplayName: 'Avenida Avelino Martínez',
    title: 'MISIÓN 6 — OPERACIÓN CAJA FUERTE',
    subtitle: 'CAPÍTULO 6 · CULMINACIÓN DE CAMPAÑA',
    antagonistName: 'Caravana final de la organización ficticia',
    antagonistVehicle: 'Convoy blindado VIP hacia WENO Bank',
    objectiveSummary:
      'Superar al convoy final en el exigente trazado de Avelino Martínez para que DATACAR documente el cierre de la operación y localice el destino del Lamborghini.',
    playableChecklist: [
      'Completar el circuito más exigente de Asunción dentro del tiempo oficial.',
      'Documentar la operación final para entregar el expediente a los investigadores competentes.',
    ],
    introDialogueLines: [
      'Los seis implicados están cerrando sus operaciones.',
      'Organizaron un último convoy hacia WENO Bank.',
      'Si conseguimos llegar antes, podremos reconstruir el movimiento final.',
      'Esta es nuestra oportunidad.',
    ],
    victoryNarrativeOutcome:
      'Superás al convoy. DATACAR documenta la operación completa y entrega la información reunida a los investigadores competentes. La red comienza a desmantelarse y se confirma que el Lamborghini está siendo trasladado hacia el aeropuerto.',
    clueId: 'clue_6_airport_destination',
    clueTitle: 'DESTINO DEL PROYECTO FANTASMA DESCUBIERTO.',
    clueDetail:
      'Con el acceso del infiltrado bloqueado, los registros logísticos confirman que el Lamborghini Proyecto Fantasma está siendo trasladado hacia el hangar del aeropuerto.',
    revelationDialogueLines: [
      'Lo logramos.',
      'Tenemos toda la información.',
      'Pero todavía falta algo.',
      'El Lamborghini.',
      'Y esta es nuestra última oportunidad.',
    ],
    defeatMessage:
      'El convoy completó su maniobra antes de que pudiéramos reconstruir el movimiento final. Reintentá la misión culminante.',
    requiredPreviousMissionId: 'weno_5',
    unlocksMissionId: 'recovery_final',
    completionState: 'weno_mission_6_completed',
    usesPhoneAlertBefore: true,
  },
  {
    missionId: 'recovery_final',
    missionNumber: 7,
    chapterId: 'chapter_recovery_mission',
    circuitId: 'aviadores',
    circuitDisplayName: 'Corredor Rápido hacia el Aeropuerto (Vía Aviadores del Chaco)',
    title: 'OPERACIÓN FANTASMA — RECUPERACIÓN FINAL',
    subtitle: 'MISIÓN BONUS · INTERCEPTACIÓN RUMBO AL AEROPUERTO',
    antagonistName: 'Unidad de Extracción Logística',
    antagonistVehicle: 'Transporte Blindado de Salida',
    objectiveSummary:
      'Conducí uno de los siete vehículos comerciales de DATACAR y llegá al punto de interceptación antes de que el Proyecto Fantasma sea trasladado fuera del país.',
    playableChecklist: [
      'Elegir uno de los siete vehículos comerciales de DATACAR (el Lamborghini sigue robado).',
      'Llegar al punto de interceptación en el hangar antes de que expire el tiempo límite.',
      'Asegurar el hangar junto al equipo de DATACAR y recuperar el Proyecto Fantasma.',
    ],
    introDialogueLines: [
      'Detectamos el traslado final del Proyecto Fantasma.',
      'Está rumbo al aeropuerto.',
      'Tenemos una oportunidad para recuperarlo.',
    ],
    victoryNarrativeOutcome:
      'El equipo de DATACAR y las autoridades ficticias encargadas de la operación aseguran el hangar. Las puertas se abren y el Lamborghini Proyecto Fantasma vuelve a casa.',
    clueId: 'clue_7_recovered',
    clueTitle: 'LAMBORGHINI RECUPERADO · VEHÍCULO BONUS DESBLOQUEADO',
    clueDetail:
      'El Proyecto Fantasma ha sido recuperado intacto y queda desbloqueado permanentemente para carrera libre y desafíos especiales.',
    revelationDialogueLines: [
      'Cuando te elegimos, necesitábamos un buen piloto.',
      'Ahora sabemos que encontramos al mejor.',
      'Bienvenido de nuevo, Proyecto Fantasma.',
    ],
    defeatMessage:
      'No llegaste al punto de interceptación a tiempo. El vehículo sigue bloqueado: reintentá la misión final para recuperar el Lamborghini.',
    requiredPreviousMissionId: 'weno_6',
    unlocksMissionId: null,
    completionState: 'lamborghini_recovered',
    usesPhoneAlertBefore: true,
  },
];

export function getStoryMissionByCircuitId(
  circuitId: string,
  activeStoryMissionId?: string | null,
): StoryConnectedMissionSpec {
  if (activeStoryMissionId) {
    const byId = STORY_CONNECTED_MISSIONS.find((m) => m.missionId === activeStoryMissionId);
    if (byId) return byId;
  }
  const clean = circuitId.trim().toLowerCase().replace(/^circuit-/, '');
  const found = STORY_CONNECTED_MISSIONS.find(
    (m) => m.missionNumber >= 1 && m.missionNumber <= 6 && m.circuitId === clean,
  );
  return found ?? STORY_CONNECTED_MISSIONS[1];
}

export function getStoryMissionById(missionId: string): StoryConnectedMissionSpec | undefined {
  return STORY_CONNECTED_MISSIONS.find((m) => m.missionId === missionId);
}

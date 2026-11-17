import { ASUNCION_CIRCUITS } from '../data/asuncionCircuits';

/**
 * Sistema narrativo configurable — DATACAR ARENA V10
 * "OPERACIÓN WENO BANK: LLEGÁ ANTES DE QUE SE LLEVEN TODO"
 *
 * Nota editorial y legal: Todos los antagonistas, cargos, situaciones, operaciones
 * y la entidad "Weno Bank" pertenecen exclusivamente a una obra de ficción satírica
 * y humorística. No representan hechos reales ni acusaciones sobre personas o instituciones.
 */

export type CorruptRivalArchetype =
  | 'limo_blindada'
  | 'sedan_ejecutivo'
  | 'suv_blindada'
  | 'camioneta_vip'
  | 'oficial_oscuro'
  | 'caravana_vip';

export type AntagonistProgressStage =
  | 'departed'
  | 'en_route'
  | 'approaching'
  | 'urgent'
  | 'arrived';

export interface WenoBankMission {
  id: string;
  missionNumber: number;
  circuitId: string;
  circuitOriginalName: string;
  title: string;
  antagonistLabel: string;
  rivalVehicleLabel: string;
  rivalArchetype: CorruptRivalArchetype;
  destination: 'Weno Bank';
  story: string;
  briefingLines: readonly string[];
  progressAlerts: Readonly<Record<AntagonistProgressStage, string>>;
  introRivalAlert: string;
  victorySpecific: string;
  defeatSpecific: string;
  clueTitle?: string;
  revelationLines?: readonly string[];
}

export const WENO_BANK_INTRO_STORAGE_KEY = 'datacar_weno_intro_seen_v10';

export const DATACAR_INSTITUTIONAL_PREMISE =
  'DATACAR te eligió a vos, su mejor piloto, para una misión especial.';

export const DATACAR_INSTITUTIONAL_FLEET =
  'Ponemos a tu disposición los autos más buscados por los paraguayos. Elegí tu máquina y llegá al Weno Bank antes de que los corruptos se lleven todo.';

export const DATACAR_BRIEFING_HEADER = {
  line1: 'DATACAR TE ELIGIÓ.',
  line2: 'SOS NUESTRO MEJOR PILOTO.',
} as const;

export const DATACAR_BRIEFING_FIXED_CONTEXT =
  'DATACAR pone a tu disposición los autos más buscados por los paraguayos.';

export const DATACAR_INITIAL_INTRO_COPY = {
  brand: 'DATACAR ARENA',
  operationTag: 'OPERACIÓN WENO BANK · LLEGÁ ANTES DE QUE SE LLEVEN TODO',
  headline1: 'FUISTE ELEGIDO.',
  headline2: 'SOS NUESTRO MEJOR PILOTO.',
  paragraphs: [
    'DATACAR tiene una misión para vos.',
    'Los corruptos están camino al Weno Bank.',
    'Y vos sos nuestra última oportunidad de llegar primero.',
    'Ponemos a tu disposición los autos más buscados por los paraguayos.',
    'Elegí tu máquina. Acelerá. Y llegá antes de que se lleven todo.',
  ],
  ctaAccept: 'ACEPTAR LA MISIÓN',
  ctaSkip: 'Saltar introducción',
} as const;

export const DATACAR_SELECTOR_COPY = {
  fleetBadge: 'LOS AUTOS MÁS BUSCADOS POR LOS PARAGUAYOS',
  title: 'TU MISIÓN. TU MÁQUINA.',
  subtitle:
    'DATACAR te eligió como su mejor piloto. Ahora elegí con qué auto vas a cumplir la misión.',
  onSelectVehicle: 'Máquina confirmada. El Weno Bank te espera.',
  beforeStartReady: 'Tu vehículo está listo. Los corruptos ya están en camino.',
} as const;

export const DATACAR_HUD_OBJECTIVE_LABEL = 'OBJETIVO: LLEGAR PRIMERO AL WENO BANK';

export const DATACAR_RESULTS_COPY = {
  victoryTitle: '¡MISIÓN CUMPLIDA, PILOTO!',
  victoryLine1: 'DATACAR sabía que podía confiar en vos.',
  victoryLine2: 'Llegaste antes que los corruptos al Weno Bank.',
  defeatTitle: 'MISIÓN FALLIDA.',
  defeatLine1: 'Los corruptos llegaron primero al Weno Bank.',
  defeatLine2: 'DATACAR sigue confiando en su mejor piloto.',
} as const;

export const DATACAR_CAMPAIGN_COPY = {
  operationHeader: 'OPERACIÓN WENO BANK',
  completedCounterLabel: 'MISIONES COMPLETADAS',
  statusPending: 'PENDIENTE',
  statusInProgress: 'EN CURSO',
  statusCompleted: 'COMPLETADO',
  introShot1Kicker: 'OPERACIÓN WENO BANK · RECONOCIMIENTO AÉREO',
  introShot2Kicker: 'PUNTO DE META IDENTIFICADO',
  introShot2Title: 'DESTINO: WENO BANK',
  introShot2Subline: 'Llegá al acceso principal antes de que cierren la operación.',
  introShot3Kicker: 'OBJETIVO EN MOVIMIENTO',
  introShot4Kicker: 'UNIDAD DATACAR EN LARGADA',
  introShot4Line1: 'DATACAR TE ELIGIÓ COMO SU MEJOR PILOTO.',
  introShot4Line2: 'TU MISIÓN: LLEGAR PRIMERO AL WENO BANK.',
  skipIntroCta: 'Omitir introducción',
  pendingCircuitsNotice: 'BUEN TRABAJO. PERO TODAVÍA QUEDAN CORRUPTOS EN CAMINO.',
  nextMissionCta: 'SIGUIENTE MISIÓN',
  retryMissionCta: 'REINTENTAR MISIÓN',
  finaleHeader: 'OPERACIÓN WENO BANK',
  finaleSubheader: '100% COMPLETADA',
  finaleHeroTitle: '¡SOS EL MEJOR PILOTO DE DATACAR!',
  finaleParagraphs: [
    'Completaste todas las misiones.',
    'Llegaste antes que todos los corruptos al Weno Bank.',
    'Políticos, banqueros, ministros y empresarios intentaron adelantarse.',
    'Ninguno pudo contra vos.',
  ],
  finaleClosingLines: [
    'LOS CORRUPTOS CORRIERON POR LA PLATA.',
    'VOS CORRISTE POR LA VICTORIA.',
    'DATACAR TENÍA RAZÓN: SOS NUESTRO MEJOR PILOTO.',
  ],
  eliteBadgeTitle: 'PILOTO ÉLITE DATACAR',
  eliteBadgeSubtitle: 'OPERACIÓN WENO BANK COMPLETADA',
  viewFinaleCta: 'Reconocimiento Élite',
} as const;

export const SATIRICAL_FICTION_DISCLAIMER =
  'Ficción satírica: todos los antagonistas, cargos, operaciones y el Weno Bank son ficticios y humorísticos; no representan acusaciones sobre personas ni instituciones reales.';

const WENO_BANK_MISSIONS_LIST: readonly WenoBankMission[] = [
  {
    id: 'mision-1-ultimo-retiro',
    missionNumber: 1,
    circuitId: 'aviadores',
    circuitOriginalName: 'Avenida Aviadores del Chaco',
    title: 'MISIÓN 1 — EL ÚLTIMO RETIRO',
    antagonistLabel: 'Político corrupto ficticio',
    rivalVehicleLabel: 'Limusina negra blindada',
    rivalArchetype: 'limo_blindada',
    destination: 'Weno Bank',
    story:
      'Identificamos uno de los vehículos registrados en el Proyecto Fantasma: una limusina negra cuyo conductor se dirige a WENO Bank.',
    briefingLines: [
      'Identificamos uno de los vehículos registrados.',
      'Es una limusina negra.',
      'Su conductor se dirige a WENO Bank.',
      'Necesitamos llegar antes.',
    ],
    progressAlerts: {
      departed: 'LA LIMUSINA YA SALIÓ.',
      en_route: 'EL HONORABLE AVANZA RUMBO AL WENO BANK.',
      approaching: 'LA LIMUSINA SE ACERCA AL WENO BANK.',
      urgent: 'QUEDA POCO TIEMPO. ACELERÁ.',
      arrived: 'LA LIMUSINA LLEGÓ AL WENO BANK.',
    },
    introRivalAlert: 'LA LIMUSINA REGISTRADA YA VA CAMINO AL WENO BANK.',
    victorySpecific:
      'PISTA OBTENIDA: LA LIMUSINA DEL ROBO IDENTIFICADA. Ya sabemos quiénes se llevaron el Lamborghini, pero todavía no sabemos por qué.',
    defeatSpecific: 'La limusina se retiró antes de poder corroborar su registro. Reintentá la misión.',
    clueTitle: 'LA LIMUSINA DEL ROBO IDENTIFICADA.',
    revelationLines: [
      'Ya sabemos quiénes se llevaron el Lamborghini.',
      'Pero todavía no sabemos por qué.',
    ],
  },
  {
    id: 'mision-2-banquero-desaparecido',
    missionNumber: 2,
    circuitId: 'oliva',
    circuitOriginalName: 'Calle Oliva y Piribebuy',
    title: 'MISIÓN 2 — EL BANQUERO DESAPARECIDO',
    antagonistLabel: 'Banquero corrupto ficticio',
    rivalVehicleLabel: 'Sedán ejecutivo de lujo',
    rivalArchetype: 'sedan_ejecutivo',
    destination: 'Weno Bank',
    story:
      'La limusina estaba vinculada a una empresa con relaciones en WENO Bank. Su ejecutivo intenta cerrar una transferencia vinculada al propietario anterior del Lamborghini.',
    briefingLines: [
      'La limusina estaba vinculada a una empresa.',
      'Esa empresa tiene relaciones con WENO Bank.',
      'Su ejecutivo está intentando cerrar una transferencia.',
      'Necesitamos seguir la operación.',
    ],
    progressAlerts: {
      departed: 'EL SEDÁN EJECUTIVO YA SALIÓ.',
      en_route: 'EL BANQUERO ESTÁ EN CAMINO AL WENO BANK.',
      approaching: 'EL BANQUERO SE ACERCA AL WENO BANK.',
      urgent: 'QUEDA POCO TIEMPO. ACELERÁ.',
      arrived: 'EL BANQUERO ENTRÓ AL WENO BANK.',
    },
    introRivalAlert: 'EL BANQUERO YA SALIÓ RUMBO AL WENO BANK.',
    victorySpecific:
      'PISTA OBTENIDA: SOCIEDAD INTERMEDIARIA IDENTIFICADA. El Lamborghini estuvo vinculado a la red financiera y sus registros pueden demostrar dónde se reunieron sus integrantes.',
    defeatSpecific: 'No se pudo documentar la transferencia a tiempo. Reintentá la misión.',
    clueTitle: 'SOCIEDAD INTERMEDIARIA IDENTIFICADA.',
    revelationLines: [
      'Ahora entendemos por qué lo quieren.',
      'El Lamborghini estuvo vinculado a la red financiera.',
      'Y sus registros pueden demostrar dónde se reunieron sus integrantes.',
    ],
  },
  {
    id: 'mision-3-valija-fondos-reservados',
    missionNumber: 3,
    circuitId: 'herrera',
    circuitOriginalName: 'Esquina Herrera y Caballero',
    title: 'MISIÓN 3 — LOS FONDOS RESERVADOS',
    antagonistLabel: 'Funcionario ficticio en una SUV blindada',
    rivalVehicleLabel: 'SUV blindada',
    rivalArchetype: 'suv_blindada',
    destination: 'Weno Bank',
    story:
      'Un funcionario traslada documentación donde aparece una autorización de transporte que correspondería al Proyecto Fantasma.',
    briefingLines: [
      'Un funcionario está trasladando documentación.',
      'Entre los movimientos detectados aparece una autorización de transporte.',
      'Creemos que corresponde al Proyecto Fantasma.',
    ],
    progressAlerts: {
      departed: 'LA SUV BLINDADA YA SALIÓ DEL MINISTERIO.',
      en_route: 'LA DOCUMENTACIÓN VA EN CAMINO AL WENO BANK.',
      approaching: 'LA COMITIVA SE ACERCA AL WENO BANK.',
      urgent: 'LA COMITIVA ESTÁ POR LLEGAR.',
      arrived: 'LA SUV ENTRÓ AL WENO BANK.',
    },
    introRivalAlert: 'LA SUV BLINDADA YA VA CAMINO AL WENO BANK.',
    victorySpecific:
      'PISTA OBTENIDA: TRASLADO DEL LAMBORGHINI CONFIRMADO. El auto sigue en Paraguay, pero están preparando su salida.',
    defeatSpecific: 'La SUV completó el traslado antes de corroborar la orden. Reintentá la misión.',
    clueTitle: 'TRASLADO DEL LAMBORGHINI CONFIRMADO.',
    revelationLines: [
      'El auto sigue en Paraguay.',
      'Pero están preparando su salida.',
    ],
  },
  {
    id: 'mision-4-licitacion-milagrosa',
    missionNumber: 4,
    circuitId: 'jose-felix',
    circuitOriginalName: 'Calle José Félix López',
    title: 'MISIÓN 4 — LA LICITACIÓN MILAGROSA',
    antagonistLabel: 'Empresario ficticio',
    rivalVehicleLabel: 'Camioneta ejecutiva de lujo',
    rivalArchetype: 'camioneta_vip',
    destination: 'Weno Bank',
    story:
      'Encontramos a la empresa que financia el traslado del Lamborghini. Su propietario intenta cerrar un contrato que revela la ubicación del escondite.',
    briefingLines: [
      'Encontramos a la empresa que financia el traslado.',
      'Su propietario está intentando cerrar un contrato.',
      'Si conseguimos seguir el movimiento, podremos localizar el vehículo.',
    ],
    progressAlerts: {
      departed: 'LA CAMIONETA VIP YA SALIÓ.',
      en_route: 'EL CONTRATISTA AVANZA HACIA EL WENO BANK.',
      approaching: 'LA CAMIONETA EJECUTIVA SE ACERCA AL WENO BANK.',
      urgent: 'QUEDA POCO TIEMPO. ACELERÁ.',
      arrived: 'EL CONTRATISTA LLEGÓ AL WENO BANK.',
    },
    introRivalAlert: 'EL CONTRATISTA YA VA RUMBO AL WENO BANK.',
    victorySpecific:
      'PISTA OBTENIDA: PRIMER ESCONDITE DESCUBIERTO (Hangar privado vacío cerca del aeropuerto). Llegamos tarde: alguien sabía que veníamos.',
    defeatSpecific: 'Se perdió el rastro de los pagos al hangar privado. Reintentá la misión.',
    clueTitle: 'PRIMER ESCONDITE DESCUBIERTO.',
    revelationLines: [
      'Llegamos tarde.',
      'Alguien sabía que veníamos.',
    ],
  },
  {
    id: 'mision-5-expediente-que-camina',
    missionNumber: 5,
    circuitId: 'artigas',
    circuitOriginalName: 'Avenida Artigas y Mburicaó',
    title: 'MISIÓN 5 — EL EXPEDIENTE QUE CAMINA',
    antagonistLabel: 'Comitiva oficial ficticia',
    rivalVehicleLabel: 'Vehículo oficial oscuro',
    rivalArchetype: 'oficial_oscuro',
    destination: 'Weno Bank',
    story:
      'Los sospechosos conocían nuestras rutas. Un expediente de autorizaciones puede confirmar quién filtró los códigos del hangar DATACAR.',
    briefingLines: [
      'Revisamos nuestros movimientos.',
      'Los sospechosos conocían nuestras rutas.',
      'Creemos que alguien nos está filtrando información.',
      'Hay un expediente que puede confirmar quién tuvo acceso.',
    ],
    progressAlerts: {
      departed: 'EL VEHÍCULO OFICIAL YA SALIÓ.',
      en_route: 'EL EXPEDIENTE VIAJA RUMBO AL WENO BANK.',
      approaching: 'LA COMITIVA OFICIAL SE ACERCA AL WENO BANK.',
      urgent: 'LA COMITIVA ESTÁ POR LLEGAR.',
      arrived: 'EL EXPEDIENTE ENTRÓ AL WENO BANK.',
    },
    introRivalAlert: 'LA COMITIVA OFICIAL YA LLEVA EL EXPEDIENTE AL WENO BANK.',
    victorySpecific:
      'PISTA OBTENIDA: INFILTRADO IDENTIFICADO. El contratista de seguridad del hangar vendió los códigos. Cerramos su acceso: no volverán a anticiparse.',
    defeatSpecific: 'No pudimos corroborar los registros de acceso a tiempo. Reintentá la misión.',
    clueTitle: 'INFILTRADO IDENTIFICADO.',
    revelationLines: [
      'Ahora sabemos cómo entraron.',
      'Y por qué siempre llegaban antes.',
      'Acabamos de cerrar su acceso.',
      'No volverán a anticiparse.',
    ],
  },
  {
    id: 'mision-6-operacion-caja-fuerte',
    missionNumber: 6,
    circuitId: 'avelino',
    circuitOriginalName: 'Avenida Avelino Martínez',
    title: 'MISIÓN 6 — OPERACIÓN CAJA FUERTE',
    antagonistLabel: 'Caravana final de la organización ficticia',
    rivalVehicleLabel: 'Caravana VIP con vehículo principal',
    rivalArchetype: 'caravana_vip',
    destination: 'Weno Bank',
    story:
      'Los seis implicados están cerrando sus operaciones y organizaron un último convoy hacia WENO Bank. Si llegamos antes, reconstruiremos el destino del Lamborghini.',
    briefingLines: [
      'Los seis implicados están cerrando sus operaciones.',
      'Organizaron un último convoy hacia WENO Bank.',
      'Si conseguimos llegar antes, podremos reconstruir el movimiento final.',
      'Esta es nuestra oportunidad.',
    ],
    progressAlerts: {
      departed: 'LA CARAVANA VIP YA SALIÓ.',
      en_route: 'LA CARAVANA AVANZA RUMBO AL WENO BANK.',
      approaching: 'LA CARAVANA VIP SE ACERCA AL WENO BANK.',
      urgent: 'QUEDA POCO TIEMPO. ACELERÁ.',
      arrived: 'LA CARAVANA VIP LLEGÓ AL WENO BANK.',
    },
    introRivalAlert: 'LA CARAVANA FINAL YA VA CAMINO AL WENO BANK.',
    victorySpecific:
      'PISTA DEFINITIVA: DESTINO DEL PROYECTO FANTASMA DESCUBIERTO. El Lamborghini está siendo trasladado hacia el aeropuerto.',
    defeatSpecific: 'El convoy cerró la operación antes de nuestra llegada. Reintentá la misión.',
    clueTitle: 'DESTINO DEL PROYECTO FANTASMA DESCUBIERTO.',
    revelationLines: [
      'Lo logramos.',
      'Tenemos toda la información.',
      'Pero todavía falta algo.',
      'El Lamborghini.',
      'Y esta es nuestra última oportunidad.',
    ],
  },
];

export const WENO_BANK_MISSIONS_BY_CIRCUIT: Readonly<Record<string, WenoBankMission>> =
  Object.freeze(
    WENO_BANK_MISSIONS_LIST.reduce<Record<string, WenoBankMission>>((acc, mission) => {
      acc[mission.circuitId] = mission;
      return acc;
    }, {}),
  );

export function getAllWenoBankMissions(): readonly WenoBankMission[] {
  return WENO_BANK_MISSIONS_LIST;
}

export function normalizeCircuitId(rawCircuitId?: string | null): string {
  if (!rawCircuitId) return 'aviadores';
  const trimmed = rawCircuitId.trim().toLowerCase();
  if (trimmed.startsWith('circuit-')) {
    return trimmed.slice('circuit-'.length);
  }
  return trimmed;
}

/**
 * Obtiene la misión de Weno Bank asignada a cualquier circuito existente o futuro.
 * Si en el futuro se añade un circuito adicional (>6), genera de manera determinista
 * una misión satírica sobre corrupción ficticia manteniendo la premisa institucional.
 */
export function getWenoBankMissionForCircuit(
  rawCircuitId?: string | null,
  fallbackCircuitName?: string,
): WenoBankMission {
  const normalized = normalizeCircuitId(rawCircuitId);
  const direct = WENO_BANK_MISSIONS_BY_CIRCUIT[normalized];
  if (direct) return direct;

  const matchedCircuit = ASUNCION_CIRCUITS.find((c) => c.id === normalized);
  const circuitOriginalName =
    fallbackCircuitName || matchedCircuit?.name || `Tramo Urbano (${normalized})`;

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  const extraNumber = 7 + (hash % 12);

  return {
    id: `mision-extra-${normalized}`,
    missionNumber: extraNumber,
    circuitId: normalized,
    circuitOriginalName,
    title: `MISIÓN ${extraNumber} — AUDITORÍA DE MEDIANOCHE`,
    antagonistLabel: ' Tesorero y operador financiero corruptos ficticios',
    rivalVehicleLabel: 'Vehículo de lujo con vidrios polarizados',
    rivalArchetype: 'sedan_ejecutivo',
    destination: 'Weno Bank',
    story:
      'Un operador ficticio intenta ingresar al Weno Bank para vaciar una cuenta fantasma antes del arqueo.',
    briefingLines: [
      'DATACAR te eligió a vos, su mejor piloto.',
      'Un auto con vidrios polarizados salió apurado rumbo al Weno Bank.',
      'Ponemos a tu disposición los autos más buscados por los paraguayos.',
      'Elegí tu máquina y llegá antes que él.',
    ],
    progressAlerts: {
      departed: 'EL AUTO POLARIZADO YA SALIÓ.',
      en_route: 'EL OPERADOR VA EN CAMINO AL WENO BANK.',
      approaching: 'EL RIVAL SE ACERCA AL WENO BANK.',
      urgent: 'QUEDA POCO TIEMPO. ACELERÁ.',
      arrived: 'EL RIVAL LLEGÓ AL WENO BANK.',
    },
    introRivalAlert: 'EL OPERADOR CORRUPTO YA VA CAMINO AL WENO BANK.',
    victorySpecific: '¡MISIÓN CUMPLIDA! Llegaste antes y la cuenta quedó congelada.',
    defeatSpecific: 'Llegaron antes al Weno Bank. Del saldo quedó solamente el recibo.',
  };
}

export interface WenoBankRaceProgressSnapshot {
  antagonistProgress01: number;
  antagonistPercent: number;
  remainingSec: number;
  stage: AntagonistProgressStage;
  alertText: string;
  shortAlertText: string;
  hasAntagonistArrived: boolean;
}

const SHORT_STAGE_ALERTS: Readonly<Record<AntagonistProgressStage, string>> = {
  departed: 'RIVAL EN SALIDA',
  en_route: 'RIVAL EN RUTA',
  approaching: 'CERCA DEL BANCO',
  urgent: '¡ACELERÁ YA!',
  arrived: 'RIVAL EN META',
};

/**
 * Calcula el avance narrativo y visual del antagonista usando UNA ÚNICA fuente de tiempo:
 * el cronómetro real de carrera (`elapsedSec`) frente al tiempo límite real (`maxLimitSec`).
 * Independiente de los FPS de renderizado.
 */
export function evaluateWenoBankRaceProgress(
  elapsedSec: number,
  maxLimitSec: number,
  mission: WenoBankMission,
): WenoBankRaceProgressSnapshot {
  const safeLimit = Math.max(1, Number.isFinite(maxLimitSec) ? maxLimitSec : 300);
  const safeElapsed = Math.max(0, Number.isFinite(elapsedSec) ? elapsedSec : 0);
  const ratio = Math.max(0, Math.min(1, safeElapsed / safeLimit));
  const remainingSec = Math.max(0, safeLimit - safeElapsed);

  let stage: AntagonistProgressStage = 'departed';
  if (ratio >= 1) {
    stage = 'arrived';
  } else if (ratio >= 0.78) {
    stage = 'urgent';
  } else if (ratio >= 0.48) {
    stage = 'approaching';
  } else if (ratio >= 0.16) {
    stage = 'en_route';
  }

  return {
    antagonistProgress01: ratio,
    antagonistPercent: Math.round(ratio * 100),
    remainingSec,
    stage,
    alertText: mission.progressAlerts[stage],
    shortAlertText: SHORT_STAGE_ALERTS[stage],
    hasAntagonistArrived: ratio >= 1,
  };
}

export interface WenoBankOutcomeEvaluationArgs {
  isDnf?: boolean;
  finishTimeSec?: number;
  maxLimitSec?: number | null;
  isPracticeFree?: boolean;
  mission: WenoBankMission;
}

export interface WenoBankOutcomeSummary {
  won: boolean;
  isPracticeFree: boolean;
  headline: string;
  generalLine1: string;
  generalLine2: string;
  specificLine: string;
}

/**
 * Evalúa de forma determinista si el jugador llegó al Weno Bank antes que el antagonista
 * (es decir, completó el recorrido dentro del `maxLimitSec` oficial del circuito).
 */
export function evaluateWenoBankMissionOutcome(
  args: WenoBankOutcomeEvaluationArgs,
): WenoBankOutcomeSummary {
  const { isDnf = false, finishTimeSec = -1, maxLimitSec = null, isPracticeFree = false, mission } = args;

  if (isPracticeFree) {
    return {
      won: !isDnf,
      isPracticeFree: true,
      headline: 'RECONOCIMIENTO RUMBO AL WENO BANK',
      generalLine1: DATACAR_INSTITUTIONAL_PREMISE,
      generalLine2: 'Práctica libre completada sin impacto en puntos ni ranking.',
      specificLine: `Tramo ensayado para ${mission.title}.`,
    };
  }

  const validFinish = !isDnf && Number.isFinite(finishTimeSec) && finishTimeSec >= 0;
  const withinTimeLimit =
    validFinish && (maxLimitSec == null || finishTimeSec <= maxLimitSec);

  if (withinTimeLimit) {
    return {
      won: true,
      isPracticeFree: false,
      headline: DATACAR_RESULTS_COPY.victoryTitle,
      generalLine1: DATACAR_RESULTS_COPY.victoryLine1,
      generalLine2: DATACAR_RESULTS_COPY.victoryLine2,
      specificLine: mission.victorySpecific,
    };
  }

  return {
    won: false,
    isPracticeFree: false,
    headline: DATACAR_RESULTS_COPY.defeatTitle,
    generalLine1: DATACAR_RESULTS_COPY.defeatLine1,
    generalLine2: DATACAR_RESULTS_COPY.defeatLine2,
    specificLine: mission.defeatSpecific,
  };
}

export function shouldAutoOpenWenoBankIntro(
  searchString: string = typeof window !== 'undefined' ? window.location.search : '',
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
): boolean {
  try {
    const params = new URLSearchParams(searchString);
    if (params.get('autostart') === '1' || params.get('skipIntro') === '1') {
      return false;
    }
    if (!storage) return true;
    return storage.getItem(WENO_BANK_INTRO_STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}

export function markWenoBankIntroSeen(
  storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
): void {
  try {
    storage?.setItem(WENO_BANK_INTRO_STORAGE_KEY, '1');
  } catch {
    // Ignorar modo privado sin almacenamiento persistente
  }
}

import { DATACAR_CAMPAIGN_COPY, WenoBankMission } from './wenoBankMissions';

/**
 * Cinemática de campaña Operación Weno Bank (lógica pura desacoplada de Three.js / React).
 * Adapta la cámara aérea existente (`dron_prestart`) a una secuencia ágil de 4 tomas
 * antes de largar (6.4s totales, omitible en cualquier instante, 0s de consumo del reloj de carrera)
 * y provee la trayectoria aérea de cierre cuando se gana el 100% de los circuitos.
 */

export const PRE_RACE_CINEMATIC_DURATION_SEC = 6.4;
export const FINALE_CINEMATIC_DURATION_SEC = 7.2;

export const WENO_GROUP_YAW_OFFSET = -Math.PI * 0.76;

export type PreRaceIntroShotId =
  | 'intro_shot_1'
  | 'intro_shot_2'
  | 'intro_shot_3'
  | 'intro_shot_4';

export interface Vec3Point {
  x: number;
  y: number;
  z: number;
}

export interface WorldPose2D {
  x: number;
  z: number;
  yaw: number;
}

export interface PreRaceCinematicSceneAnchors {
  /** Posición inicial del jugador en largada (s = 0). */
  startPose: WorldPose2D;
  /** Punto adelantado sobre la avenida (ej. s = 75m) para panorámica de Toma 1. */
  avenueAheadPose: WorldPose2D;
  /** Pose real de `wenoBankBuilding.group` en este circuito (`roadPath.world(distanceMeters + 8, roadWidth / 2 + 27.5)`). */
  wenoBankPose: WorldPose2D;
  /** Muestreador opcional sobre la calzada real (`roadPath.world(s, lateral)`) para ubicar al rival en camino en Toma 3. */
  sampleRoadPose?: (distanceMeters: number, lateralMeters: number) => WorldPose2D;
  /** Nombre visible del circuito actual. */
  circuitName: string;
  /** Misión narrativa asignada a este circuito. */
  mission: WenoBankMission;
}

export interface PreRaceCinematicFrame {
  shotId: PreRaceIntroShotId;
  shotNumber: 1 | 2 | 3 | 4;
  camera: Vec3Point;
  target: Vec3Point;
  fov: number;
  smoothRate: number;
  /** Avance temporal de previsualización del vehículo rival en Toma 3 (0 fuera de Toma 3). */
  rivalPreviewProgress01: number;
  /** Pose del vehículo rival circulando por la avenida en Toma 3 (null fuera de Toma 3). */
  rivalRoadPose: WorldPose2D | null;
  kicker: string;
  headline: string;
  subline: string;
  progress01: number;
  finished: boolean;
}

export interface FinaleCinematicFrame {
  shotId: 'finale_weno_bank';
  stageIndex: 0 | 1 | 2;
  camera: Vec3Point;
  target: Vec3Point;
  fov: number;
  smoothRate: number;
  kicker: string;
  headline: string;
  bodyLines: readonly string[];
  progress01: number;
  finished: boolean;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function smoothstep01(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function safePoint(p: Vec3Point, minY = 1.6): Vec3Point {
  return {
    x: Number.isFinite(p.x) ? p.x : 0,
    y: Math.max(minY, Number.isFinite(p.y) ? p.y : minY),
    z: Number.isFinite(p.z) ? p.z : 0,
  };
}

/**
 * Convierte coordenadas locales del grupo `wenoBankBuilding.group` a coordenadas de mundo Three.js.
 * En `Race3DPerspectiveView.tsx`:
 *   `wenoBankBuilding.group.position.set(wenoBankPose.x, 0, wenoBankPose.z)`
 *   `wenoBankBuilding.group.rotation.y = wenoBankPose.yaw - Math.PI * 0.76`
 * Rotación activa alrededor de +Y en sistema dextrógiro Three.js:
 *   `wx = bx + lx * cos(ry) + lz * sin(ry)`
 *   `wz = bz - lx * sin(ry) + lz * cos(ry)`
 */
export function localToWenoWorld(
  wenoBankPose: WorldPose2D,
  localX: number,
  localY: number,
  localZ: number,
): Vec3Point {
  const bx = Number.isFinite(wenoBankPose.x) ? wenoBankPose.x : 0;
  const bz = Number.isFinite(wenoBankPose.z) ? wenoBankPose.z : 0;
  const yaw = Number.isFinite(wenoBankPose.yaw) ? wenoBankPose.yaw : 0;
  const ry = yaw + WENO_GROUP_YAW_OFFSET;
  const cosR = Math.cos(ry);
  const sinR = Math.sin(ry);
  return {
    x: bx + localX * cosR + localZ * sinR,
    y: localY,
    z: bz - localX * sinR + localZ * cosR,
  };
}

/**
 * Evalúa la cinemática inicial de 4 tomas para cualquier circuito de la campaña:
 * - TOMA 1 (0.00s - 1.60s): Presentación aérea de la ciudad y la avenida del circuito.
 * - TOMA 2 (1.60s - 3.50s): Revelación arquitectónica 3/4 de Weno Bank (cubierta de terracota,
 *   fachada acristalada curva, jardines tropicales, cartel 3D "weno bank" y acceso de meta).
 * - TOMA 3 (3.50s - 4.90s): Presentación del vehículo del antagonista corrupto avanzando por
 *   la vía VIP hacia Weno Bank con alerta personalizada de misión.
 * - TOMA 4 (4.90s - 6.40s): Regreso fluido al punto de largada sobre el SUV elegido por el piloto,
 *   listo para empalmar con la cuenta regresiva `3, 2, 1, ¡YA!`.
 */
export function evaluatePreRaceCinematicTimeline(
  elapsedSec: number,
  anchors: PreRaceCinematicSceneAnchors,
): PreRaceCinematicFrame {
  const safeElapsed = Math.max(0, Number.isFinite(elapsedSec) ? elapsedSec : 0);
  const progress01 = clamp01(safeElapsed / PRE_RACE_CINEMATIC_DURATION_SEC);
  const finished = safeElapsed >= PRE_RACE_CINEMATIC_DURATION_SEC;

  const { startPose, avenueAheadPose, wenoBankPose, circuitName, mission } = anchors;
  const startYaw = Number.isFinite(startPose.yaw) ? startPose.yaw : 0;
  const fwdX = Math.sin(startYaw);
  const fwdZ = Math.cos(startYaw);
  const rightX = Math.cos(startYaw);
  const rightZ = -Math.sin(startYaw);

  // TOMA 1: Gran plano amplio aéreo de Asunción otoñal, torres de vidrio y avenida (0.0s -> 1.6s)
  if (safeElapsed < 1.6) {
    const t = smoothstep01(safeElapsed / 1.6);
    const camX =
      startPose.x - fwdX * lerp(38, 19, t) + rightX * lerp(24, 12, t);
    const camY = lerp(31, 19.5, t);
    const camZ =
      startPose.z - fwdZ * lerp(38, 19, t) + rightZ * lerp(24, 12, t);
    const tgtX = lerp(avenueAheadPose.x, startPose.x + fwdX * 52, 0.35 * t);
    const tgtY = lerp(4.6, 2.8, t);
    const tgtZ = lerp(avenueAheadPose.z, startPose.z + fwdZ * 52, 0.35 * t);

    return {
      shotId: 'intro_shot_1',
      shotNumber: 1,
      camera: safePoint({ x: camX, y: camY, z: camZ }, 4.0),
      target: safePoint({ x: tgtX, y: tgtY, z: tgtZ }, 1.0),
      fov: lerp(56, 51, t),
      smoothRate: 9,
      rivalPreviewProgress01: 0,
      rivalRoadPose: null,
      kicker: `${DATACAR_CAMPAIGN_COPY.introShot1Kicker} · ${circuitName.toUpperCase()}`,
      headline: mission.title,
      subline: mission.story,
      progress01,
      finished: false,
    };
  }

  // TOMA 2: Bajada cinematográfica de grúa hacia la sede de Weno Bank (1.6s -> 3.5s)
  // Desciende desde plano elevado (y=17.8m) hasta cota peatonal/explanada (y=5.2m),
  // revelando la bóveda ondulada de terracota, fachada acristalada curva, jardines y cartel 3D "weno bank".
  if (safeElapsed < 3.5) {
    const t = smoothstep01((safeElapsed - 1.6) / 1.9);
    const camWorld = localToWenoWorld(
      wenoBankPose,
      lerp(9.6, 1.8, t),
      lerp(17.8, 5.2, t),
      lerp(32.2, 21.8, t),
    );
    const tgtWorld = localToWenoWorld(
      wenoBankPose,
      lerp(0.4, -1.5, t),
      lerp(6.4, 4.3, t),
      lerp(2.2, 3.8, t),
    );

    return {
      shotId: 'intro_shot_2',
      shotNumber: 2,
      camera: safePoint(camWorld, 3.2),
      target: safePoint(tgtWorld, 1.5),
      fov: lerp(51, 45, t),
      smoothRate: 11,
      rivalPreviewProgress01: 0,
      rivalRoadPose: null,
      kicker: DATACAR_CAMPAIGN_COPY.introShot2Kicker,
      headline: DATACAR_CAMPAIGN_COPY.introShot2Title,
      subline: DATACAR_CAMPAIGN_COPY.introShot2Subline,
      progress01,
      finished: false,
    };
  }

  // TOMA 3: Limusina 3D del antagonista corrupto EN MOVIMIENTO por la avenida adelantada (3.5s -> 4.9s)
  if (safeElapsed < 4.9) {
    const rawT = clamp01((safeElapsed - 3.5) / 1.4);
    const t = smoothstep01(rawT);
    const rivalPreviewProgress01 = lerp(0.46, 0.74, rawT);
    const rivalRoadS = lerp(70, 134, rawT);
    const rivalLaneLateral = -3.2;

    const rivalRoadPose: WorldPose2D = anchors.sampleRoadPose
      ? anchors.sampleRoadPose(rivalRoadS, rivalLaneLateral)
      : {
          x:
            startPose.x +
            fwdX * rivalRoadS +
            rightX * rivalLaneLateral,
          z:
            startPose.z +
            fwdZ * rivalRoadS +
            rightZ * rivalLaneLateral,
          yaw: startYaw,
        };

    const rYaw = Number.isFinite(rivalRoadPose.yaw) ? rivalRoadPose.yaw : startYaw;
    const rFwdX = Math.sin(rYaw);
    const rFwdZ = Math.cos(rYaw);
    const rLatPosX = Math.cos(rYaw);
    const rLatPosZ = -Math.sin(rYaw);

    // Cámara Russian-arm 3/4 frontal-lateral: encuadra el 100% de la limusina 3D (6.36m, parrilla cromada,
    // faros blancos encendidos y llantas girando) en el centro-derecha del plano (48%-72% X), libre del banner inferior izquierdo
    const camWorld: Vec3Point = {
      x: rivalRoadPose.x + rFwdX * lerp(10.2, 7.2, t) + rLatPosX * lerp(4.0, 3.4, t),
      y: lerp(1.92, 1.56, t),
      z: rivalRoadPose.z + rFwdZ * lerp(10.2, 7.2, t) + rLatPosZ * lerp(4.0, 3.4, t),
    };
    const tgtWorld: Vec3Point = {
      x: rivalRoadPose.x + rFwdX * lerp(0.4, -0.6, t) - rLatPosX * 1.65,
      y: 0.82,
      z: rivalRoadPose.z + rFwdZ * lerp(0.4, -0.6, t) - rLatPosZ * 1.65,
    };

    return {
      shotId: 'intro_shot_3',
      shotNumber: 3,
      camera: safePoint(camWorld, 1.4),
      target: safePoint(tgtWorld, 0.8),
      fov: lerp(43, 46, t),
      smoothRate: 16,
      rivalPreviewProgress01,
      rivalRoadPose,
      kicker: `${DATACAR_CAMPAIGN_COPY.introShot3Kicker} · ${mission.rivalVehicleLabel.toUpperCase()}`,
      headline: mission.introRivalAlert,
      subline: `${mission.antagonistLabel} en movimiento rumbo al Weno Bank. ¡Alcanzalo antes de que llegue!`,
      progress01,
      finished: false,
    };
  }

  // TOMA 4: Empalme continuo colocándose DETRÁS del vehículo del jugador para la cuenta regresiva (4.9s -> 6.4s)
  const t4 = smoothstep01((safeElapsed - 4.9) / 1.5);
  const camX =
    startPose.x -
    fwdX * lerp(10.8, 6.35, t4) +
    rightX * lerp(3.6, 0.72, t4);
  const camY = lerp(3.25, 1.76, t4);
  const camZ =
    startPose.z -
    fwdZ * lerp(10.8, 6.35, t4) +
    rightZ * lerp(3.6, 0.72, t4);
  const tgtX = startPose.x + fwdX * lerp(1.8, 7.5, t4);
  const tgtY = lerp(1.25, 1.32, t4);
  const tgtZ = startPose.z + fwdZ * lerp(1.8, 7.5, t4);

  return {
    shotId: 'intro_shot_4',
    shotNumber: 4,
    camera: safePoint({ x: camX, y: camY, z: camZ }, 1.7),
    target: safePoint({ x: tgtX, y: tgtY, z: tgtZ }, 1.0),
    fov: lerp(50, 59, t4),
    smoothRate: 12,
    rivalPreviewProgress01: 0,
    rivalRoadPose: null,
    kicker: DATACAR_CAMPAIGN_COPY.introShot4Kicker,
    headline: DATACAR_CAMPAIGN_COPY.introShot4Line1,
    subline: DATACAR_CAMPAIGN_COPY.introShot4Line2,
    progress01,
    finished,
  };
}

/**
 * Evalúa la cinemática especial de cierre cuando el jugador completa el 100% de la campaña
 * Operación Weno Bank (`completedCount === totalCount`):
 * - Sobrevuela el arribo triunfal y orbita la cubierta ondulada de terracota, la fachada
 *   acristalada, el jardín tropical y el cartel 3D "weno bank".
 */
export function evaluateFinaleCinematicTimeline(
  elapsedSec: number,
  wenoBankPose: WorldPose2D,
): FinaleCinematicFrame {
  const safeElapsed = Math.max(0, Number.isFinite(elapsedSec) ? elapsedSec : 0);
  const progress01 = clamp01(safeElapsed / FINALE_CINEMATIC_DURATION_SEC);
  const finished = safeElapsed >= FINALE_CINEMATIC_DURATION_SEC;
  const t = smoothstep01(progress01);

  // Órbita cinematográfica amplia frente a la explanada y bóveda de terracota de Weno Bank
  const angle = lerp(-0.52, 0.44, t);
  const radius = lerp(29.0, 22.5, t);
  const localCamX = Math.sin(angle) * radius + 1.5;
  const localCamZ = Math.cos(angle) * radius + 3.2;
  const localCamY = lerp(11.8, 6.8, t);

  const camWorld = localToWenoWorld(wenoBankPose, localCamX, localCamY, localCamZ);
  const tgtWorld = localToWenoWorld(
    wenoBankPose,
    lerp(-2.2, 1.4, t),
    lerp(5.8, 4.2, t),
    lerp(2.5, 5.2, t),
  );

  let stageIndex: 0 | 1 | 2 = 0;
  let kicker: string = DATACAR_CAMPAIGN_COPY.finaleHeader;
  let headline: string = DATACAR_CAMPAIGN_COPY.finaleSubheader;
  let bodyLines: readonly string[] = [
    DATACAR_CAMPAIGN_COPY.eliteBadgeTitle,
    DATACAR_CAMPAIGN_COPY.eliteBadgeSubtitle,
  ];

  if (safeElapsed >= 2.2 && safeElapsed < 4.8) {
    stageIndex = 1;
    kicker = `${DATACAR_CAMPAIGN_COPY.finaleHeader} · ${DATACAR_CAMPAIGN_COPY.finaleSubheader}`;
    headline = DATACAR_CAMPAIGN_COPY.finaleHeroTitle;
    bodyLines = DATACAR_CAMPAIGN_COPY.finaleParagraphs;
  } else if (safeElapsed >= 4.8) {
    stageIndex = 2;
    kicker = DATACAR_CAMPAIGN_COPY.eliteBadgeTitle;
    headline = DATACAR_CAMPAIGN_COPY.finaleHeroTitle;
    bodyLines = DATACAR_CAMPAIGN_COPY.finaleClosingLines;
  }

  return {
    shotId: 'finale_weno_bank',
    stageIndex,
    camera: safePoint(camWorld, 3.2),
    target: safePoint(tgtWorld, 1.4),
    fov: lerp(52, 46, t),
    smoothRate: 6.5,
    kicker,
    headline,
    bodyLines,
    progress01,
    finished,
  };
}

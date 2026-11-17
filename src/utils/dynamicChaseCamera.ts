/**
 * Módulo puro para cámara dinámica estilo Need for Speed No Limits y FOV progresivo
 * compartido entre las cámaras `arcade` y `nfs` sin acoplarse a física ni shaders.
 */

export type DynamicChaseFovMode = 'arcade' | 'nfs';

export interface DynamicFovProfile {
  baseFovDesktop: number;
  baseFovCompact: number;
  maxGainDeg: number;
  referenceSpeedKmh: number;
  dampLambda: number;
}

export const DYNAMIC_FOV_PROFILES: Record<DynamicChaseFovMode, DynamicFovProfile> = {
  arcade: {
    baseFovDesktop: 61,
    baseFovCompact: 62,
    maxGainDeg: 7,
    referenceSpeedKmh: 180,
    dampLambda: 6.0,
  },
  nfs: {
    baseFovDesktop: 65,
    baseFovCompact: 65,
    maxGainDeg: 9,
    referenceSpeedKmh: 180,
    dampLambda: 6.5,
  },
};

export interface VehicleDimensionsM {
  lengthM: number;
  widthM: number;
  heightM: number;
}

export interface NfsAdaptiveCameraRig {
  chaseDistanceM: number;
  camHeightM: number;
  lookAheadM: number;
  lookAtHeightM: number;
  positionSmoothRate: number;
  lookSmoothRate: number;
  slipSwayFactor: number;
}

export interface NfsCameraPoseInput {
  selectedX: number;
  selectedZ: number;
  groundY?: number;
  yawRad: number;
  speedKmh: number;
  lateralSpeedMps?: number;
  roadVisibilityCue?: number;
  compact: boolean;
  dimensionsM: VehicleDimensionsM;
}

export interface NfsCameraPoseResult {
  desiredCamX: number;
  desiredCamY: number;
  desiredCamZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  wantedFov: number;
  rig: NfsAdaptiveCameraRig;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Amortiguación exponencial independiente de FPS: 1 - exp(-lambda * dt).
 */
export function dampScalar(current: number, target: number, lambda: number, dtSeconds: number): number {
  if (!Number.isFinite(current)) return target;
  if (!Number.isFinite(target)) return current;
  const safeDt = Math.max(0, Number.isFinite(dtSeconds) ? dtSeconds : 0);
  if (safeDt === 0) return current;
  const alpha = 1 - Math.exp(-Math.max(0.001, lambda) * safeDt);
  return current + (target - current) * alpha;
}

/**
 * Calcula el FOV objetivo únicamente en función de la velocidad física real (km/h),
 * sin depender de acelerador ni RPM y sin acumular estado al cambiar de cámara.
 */
export function computeDynamicChaseFov(args: {
  mode: DynamicChaseFovMode;
  speedKmh: number;
  compact: boolean;
  baseFovOverride?: number;
}): number {
  const profile = DYNAMIC_FOV_PROFILES[args.mode];
  const baseFov =
    typeof args.baseFovOverride === 'number' && Number.isFinite(args.baseFovOverride)
      ? args.baseFovOverride
      : args.compact
        ? profile.baseFovCompact
        : profile.baseFovDesktop;
  const speedKmhSafe = Number.isFinite(args.speedKmh) ? Math.abs(args.speedKmh) : 0;
  const speedRatio = clamp(speedKmhSafe / profile.referenceSpeedKmh, 0, 1);
  return baseFov + speedRatio * profile.maxGainDeg;
}

/**
 * Resuelve dimensiones reales seguras (en metros) a partir de la ficha técnica y,
 * opcionalmente, de la medición cacheada una sola vez al cargar el GLB/chasis 3D.
 */
export function resolveVehicleDimensionsM(
  dimensionsMm?: { lengthMm?: number; widthMm?: number; heightMm?: number } | null,
  measuredBoxM?: Partial<VehicleDimensionsM> | null,
  fallback: VehicleDimensionsM = { lengthM: 4.35, widthM: 1.80, heightM: 1.62 },
): VehicleDimensionsM {
  const specLength =
    dimensionsMm?.lengthMm && dimensionsMm.lengthMm > 1500 ? dimensionsMm.lengthMm / 1000 : fallback.lengthM;
  const specWidth =
    dimensionsMm?.widthMm && dimensionsMm.widthMm > 1000 ? dimensionsMm.widthMm / 1000 : fallback.widthM;
  const specHeight =
    dimensionsMm?.heightMm && dimensionsMm.heightMm > 900 ? dimensionsMm.heightMm / 1000 : fallback.heightM;

  const lengthM =
    measuredBoxM?.lengthM && Number.isFinite(measuredBoxM.lengthM) && measuredBoxM.lengthM > 2.0
      ? clamp(measuredBoxM.lengthM, specLength * 0.86, specLength * 1.16)
      : specLength;
  const widthM =
    measuredBoxM?.widthM && Number.isFinite(measuredBoxM.widthM) && measuredBoxM.widthM > 1.2
      ? clamp(measuredBoxM.widthM, specWidth * 0.86, specWidth * 1.16)
      : specWidth;
  const heightM =
    measuredBoxM?.heightM && Number.isFinite(measuredBoxM.heightM) && measuredBoxM.heightM > 1.0
      ? clamp(measuredBoxM.heightM, specHeight * 0.86, specHeight * 1.16)
      : specHeight;

  return {
    lengthM: clamp(lengthM, 3.2, 6.4),
    widthM: clamp(widthM, 1.45, 2.4),
    heightM: clamp(heightM, 1.2, 2.3),
  };
}

/**
 * Adapta distancia, altura y punto de mira de la cámara NFS a las dimensiones reales
 * de cada vehículo (hatchback, sedán, SUV o camioneta) conservando siempre un encuadre
 * más cercano y ligeramente más bajo que la cámara Arcade original.
 */
export function computeAdaptiveNfsCameraRig(
  dims: VehicleDimensionsM,
  compact: boolean,
): NfsAdaptiveCameraRig {
  const lengthM = clamp(dims.lengthM, 3.2, 6.4);
  const widthM = clamp(dims.widthM, 1.45, 2.4);
  const heightM = clamp(dims.heightM, 1.2, 2.3);
  const halfLengthM = lengthM * 0.5;

  // Escala perceptual combinando ancho, alto y largo respecto al SUV base (4.35 x 1.80 x 1.62 m)
  const silhouetteScale = clamp(
    (widthM / 1.80) * 0.45 + (heightM / 1.62) * 0.35 + (lengthM / 4.35) * 0.20,
    0.84,
    1.26,
  );

  // Distancia más cercana que Arcade (Arcade: 6.0m desktop / 5.5m compact) sin invadir jamás el paragolpes
  const baseDist = compact ? 4.45 : 4.75;
  const minBumperClearanceDist = halfLengthM + (compact ? 2.05 : 2.20);
  const chaseDistanceM = clamp(
    Math.max(baseDist * silhouetteScale, minBumperClearanceDist),
    compact ? 4.20 : 4.45,
    compact ? 5.35 : 5.65,
  );

  // Altura ligeramente inferior a Arcade (Arcade: 2.00m desktop / 1.85m compact),
  // manteniendo margen limpio sobre el techo para conservar visibilidad del trazado.
  const roofMargin = compact ? 0.06 : 0.11;
  const arcadeCeiling = compact ? 1.82 : 1.96;
  const camHeightM = clamp(
    heightM + roofMargin,
    compact ? 1.50 : 1.58,
    Math.max(arcadeCeiling, heightM + 0.06),
  );

  const lookAheadM = clamp(5.4 + (lengthM - 4.35) * 0.55, 5.0, 7.2);
  // Punto de mira por debajo de la línea de techo para ubicar el auto centrado
  // horizontalmente y ligeramente debajo del centro vertical de la pantalla.
  const lookAtHeightM = clamp(heightM * 0.72, 1.02, 1.44);

  return {
    chaseDistanceM,
    camHeightM,
    lookAheadM,
    lookAtHeightM,
    positionSmoothRate: 9.4,
    lookSmoothRate: 10.2,
    slipSwayFactor: 0.10,
  };
}

/**
 * Calcula pose mundial de la cámara NFS (sin empujar la cámara hacia atrás al acelerar)
 * y su FOV dinámico correspondiente a la velocidad física.
 */
export function computeNfsCameraPose(input: NfsCameraPoseInput): NfsCameraPoseResult {
  const rig = computeAdaptiveNfsCameraRig(input.dimensionsM, input.compact);
  const groundY = Number.isFinite(input.groundY) ? (input.groundY as number) : 0;
  const roadCue = clamp(input.roadVisibilityCue ?? 0, 0, 1);

  const forwardX = Math.sin(input.yawRad);
  const forwardZ = Math.cos(input.yawRad);
  const slipSway = clamp((input.lateralSpeedMps ?? 0) * rig.slipSwayFactor, -0.30, 0.30);

  const desiredCamX = input.selectedX - forwardX * rig.chaseDistanceM + Math.cos(input.yawRad) * slipSway;
  const desiredCamY = groundY + rig.camHeightM + roadCue * 0.14;
  const desiredCamZ = input.selectedZ - forwardZ * rig.chaseDistanceM - Math.sin(input.yawRad) * slipSway;

  const targetX = input.selectedX + forwardX * rig.lookAheadM;
  const targetY = groundY + rig.lookAtHeightM - roadCue * 0.14;
  const targetZ = input.selectedZ + forwardZ * rig.lookAheadM;

  const wantedFov = computeDynamicChaseFov({
    mode: 'nfs',
    speedKmh: input.speedKmh,
    compact: input.compact,
  });

  return {
    desiredCamX,
    desiredCamY,
    desiredCamZ,
    targetX,
    targetY,
    targetZ,
    wantedFov,
    rig,
  };
}

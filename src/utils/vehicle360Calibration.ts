/**
 * Módulo de Calibración de Orientación y Perspectiva 360° para DATACAR ARENA V4
 *
 * Mapea con precisión matemática el ángulo relativo entre la cámara de la pista y la
 * dirección de avance del vehículo, seleccionando el fotograma exacto (1 a 120) de las
 * secuencias fotográficas originales sin saltos, sin parpadeos y sin deformaciones.
 */

export interface VehicleCalibration {
  modelId: string;
  folderName: 'carens' | 'kicks' | 'tracker';
  totalFrames: number;
  rearFrameIndex: number;   // Fotograma de vista trasera pura (0° respecto a persecución)
  frontFrameIndex: number;  // Fotograma de vista frontal pura (180° respecto a persecución)
  rightSideFrameIndex: number; // 90°
  leftSideFrameIndex: number;  // 270°
  worldWidthMeters: number;    // Ancho real del sprite en la pista 3D (m)
  worldHeightMeters: number;   // Altura real del sprite en la pista 3D (m)
  groundOffsetMeters: number;  // Offset vertical para que los neumáticos toquen el asfalto
  aspectRatio: number;         // 800 / 450 = 1.777
}

export const VEHICLE_CALIBRATIONS: Record<string, VehicleCalibration> = {
  'nissan-kicks-2027': {
    modelId: 'nissan-kicks-2027',
    folderName: 'kicks',
    totalFrames: 120,
    rearFrameIndex: 48,       // Vista trasera con ópticas rojas LED
    frontFrameIndex: 108,     // Vista frontal con parrilla V-Motion y luces diurnas
    rightSideFrameIndex: 18,  // Perfil derecho
    leftSideFrameIndex: 78,   // Perfil izquierdo
    worldWidthMeters: 4.10,   // Escala visual protagonista para encuadre nítido
    worldHeightMeters: 2.31,  // Relación 800/450 exacta (1.777)
    groundOffsetMeters: 0.80, // Neumáticos tocan exactamente el asfalto (y=0)
    aspectRatio: 800 / 450,
  },
  'kia-carens-ex': {
    modelId: 'kia-carens-ex',
    folderName: 'carens',
    totalFrames: 120,
    rearFrameIndex: 62,       // Vista trasera con barra LED horizontal
    frontFrameIndex: 2,       // Vista frontal Tiger Nose
    rightSideFrameIndex: 32,  // Perfil derecho
    leftSideFrameIndex: 92,   // Perfil izquierdo
    worldWidthMeters: 4.25,   // Carrocería 7 plazas más corpulenta
    worldHeightMeters: 2.39,
    groundOffsetMeters: 0.83,
    aspectRatio: 800 / 450,
  },
  'chevrolet-tracker-lite': {
    modelId: 'chevrolet-tracker-lite',
    folderName: 'tracker',
    totalFrames: 120,
    rearFrameIndex: 52,       // Vista trasera con logotipo bowtie y tercera luz de freno
    frontFrameIndex: 112,     // Vista frontal con firma lumínica doble
    rightSideFrameIndex: 22,  // Perfil derecho
    leftSideFrameIndex: 82,   // Perfil izquierdo
    worldWidthMeters: 4.05,   // SUV compacta ágil
    worldHeightMeters: 2.28,
    groundOffsetMeters: 0.79,
    aspectRatio: 800 / 450,
  },
};

/**
 * Normaliza cualquier ID de vehículo a su configuración calibrada
 */
export function getCalibrationForVehicle(vehicleId: string): VehicleCalibration {
  if (vehicleId.includes('carens')) return VEHICLE_CALIBRATIONS['kia-carens-ex'];
  if (vehicleId.includes('tracker')) return VEHICLE_CALIBRATIONS['chevrolet-tracker-lite'];
  return VEHICLE_CALIBRATIONS['nissan-kicks-2027'];
}

/**
 * Calcula el fotograma exacto (1 a 120) según el ángulo relativo entre la cámara y el vehículo.
 *
 * @param vehicleId ID del modelo (Kicks, Carens, Tracker)
 * @param relativeAngleDeg Ángulo relativo en grados (0° = cámara detrás del auto viendo el maletero,
 *                         90° = cámara al costado derecho, 180° = cámara al frente, 270° = costado izquierdo)
 * @returns Número de fotograma calibrado entre 1 y 120
 */
export function getCalibratedFrameIndex(vehicleId: string, relativeAngleDeg: number): number {
  const calib = getCalibrationForVehicle(vehicleId);
  const total = calib.totalFrames;

  // Normalizar ángulo al rango [0, 360)
  let normAngle = relativeAngleDeg % 360;
  if (normAngle < 0) normAngle += 360;

  // El ángulo 0° corresponde a ver el vehículo desde atrás (rearFrameIndex)
  // Conforme la cámara gira o el auto avanza, sumamos proporcionalmente
  const frameOffset = Math.round((normAngle / 360) * total);
  
  // Rotación circular continua sin saltos de 359° a 0°
  let targetFrame = (calib.rearFrameIndex + frameOffset) % total;
  if (targetFrame <= 0) targetFrame += total;

  return targetFrame;
}

/**
 * Retorna la URL del archivo de imagen para un fotograma específico (Showroom original)
 */
export function getCalibratedFrameUrl(vehicleId: string, frameIndex: number): string {
  const calib = getCalibrationForVehicle(vehicleId);
  const total = calib.totalFrames;
  let idx = frameIndex % total;
  if (idx <= 0) idx += total;

  const padded = String(idx).padStart(3, '0');
  return `/assets/360_frames/${calib.folderName}/frame_${padded}.jpg`;
}

/**
 * Retorna la URL del fotograma derivado con canal alfa profesional y edge bleed para la pista
 */
export function getCalibratedRaceFrameUrl(vehicleId: string, frameIndex: number): string {
  const calib = getCalibrationForVehicle(vehicleId);
  const total = calib.totalFrames;
  let idx = frameIndex % total;
  if (idx <= 0) idx += total;

  const padded = String(idx).padStart(3, '0');
  return `/assets/360_race_frames/${calib.folderName}/frame_${padded}.webp`;
}


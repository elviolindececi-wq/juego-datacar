/**
 * Perfil determinista de rendimiento 3D para dispositivos móviles.
 * Garantiza fluidez en celulares reservando el modelo .glb de alta densidad
 * exclusivamente para el vehículo elegido por el jugador y empleando los
 * modelos 3D livianos por defecto para los rivales IA / pares online.
 */

export const MOBILE_PERF_MEDIA_QUERY =
  '(pointer: coarse) and (max-width: 1100px), (pointer: coarse) and (max-height: 560px), (max-width: 768px)';

export function detectMobilePerformanceMode(
  win: Pick<Window, 'matchMedia' | 'innerWidth'> | undefined = typeof window !== 'undefined' ? window : undefined,
): boolean {
  if (!win) return false;
  if (typeof win.matchMedia === 'function') {
    try {
      if (win.matchMedia(MOBILE_PERF_MEDIA_QUERY).matches) return true;
    } catch {
      // Fallback por ancho de viewport
    }
  }
  return typeof win.innerWidth === 'number' && win.innerWidth <= 768;
}

export interface Race3DPerformanceProfile {
  isMobilePerf: boolean;
  antialias: boolean;
  maxDpr: number;
  maxAnisotropy: number;
  shadowsEnabled: boolean;
  defaultRearviewMirror: boolean;
  defaultSideMirrors: boolean;
  gameplayCameraFar: number;
  droneCameraFar: number;
  skyDomeRadius: number;
  fogDensityMultiplier: number;
}

export function resolveRace3DPerformanceProfile(args: {
  isMobilePerf: boolean;
  isSoftwareGl: boolean;
  compact?: boolean;
  devicePixelRatio?: number;
  innerWidth?: number;
}): Race3DPerformanceProfile {
  const lowCostGpu = args.isMobilePerf || args.isSoftwareGl;
  const dpr = args.devicePixelRatio ?? 1;
  const width = args.innerWidth ?? 1280;

  return {
    isMobilePerf: args.isMobilePerf,
    // En móviles con DPR < 1.5 activamos MSAA; en pantallas Retina (DPR >= 1.5) el DPR 1.75 ya da bordes nítidos sin costo de MSAA
    antialias: !args.isSoftwareGl && (!args.isMobilePerf || dpr < 1.5),
    maxDpr: args.isSoftwareGl
      ? 1
      : args.isMobilePerf
        ? Math.min(dpr, 1.75)
        : Math.min(dpr, args.compact ? 1.25 : 1.75),
    maxAnisotropy: args.isSoftwareGl ? 1 : args.isMobilePerf ? 4 : 8,
    shadowsEnabled: !lowCostGpu,
    defaultRearviewMirror: !args.isMobilePerf,
    defaultSideMirrors: !args.isMobilePerf && width >= 768,
    gameplayCameraFar: args.isMobilePerf ? 540 : 1250,
    droneCameraFar: args.isMobilePerf ? 780 : 1250,
    skyDomeRadius: args.isMobilePerf ? 460 : 960,
    fogDensityMultiplier: args.isMobilePerf ? 1.15 : 1,
  };
}

export function shouldUseLightweightProceduralVehicle(args: {
  isMobilePerf: boolean;
  experience?: 'legacy' | 'comparison' | 'race' | 'replay';
  vehicleId: string;
  playerVehicleId: string;
  isOnlinePeer?: boolean;
}): boolean {
  // En conducción/carrera y replay (tanto en celular como en desktop), SOLO el auto
  // conducido por el jugador carga el .glb real; todos los demás usan chasis liviano no-GLB.
  if (args.experience !== 'race' && args.experience !== 'replay') return false;
  if (args.isOnlinePeer) return true;
  return args.vehicleId !== args.playerVehicleId;
}

export function filterVehiclesForRacePreload<T extends { id: string }>(
  cars: readonly T[],
  playerVehicleId: string,
  _isMobilePerf?: boolean,
): T[] {
  const playerOnly = cars.filter((car) => car.id === playerVehicleId);
  if (playerOnly.length > 0) return playerOnly;
  return cars.length > 0 ? [cars[0]] : [];
}

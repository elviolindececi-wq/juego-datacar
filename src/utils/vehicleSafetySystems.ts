/** Seguridad declarada por versión, no por parecido de nombre comercial.
 * `unknown` no significa que el auto real no tenga la función.
 * Una asistencia sin ficha validada NO se simula ni se presenta como incluida.
 */
import type { Vehicle } from '../types/vehicle.ts';
export type SafetySystem = 'abs'|'ebd'|'esc'|'tcs'|'hillAssist'|'aeb'|'fcw'|'laneDeparture'|'laneKeeping'|'adaptiveCruise'|'blindSpot'|'rearCrossTraffic'|'laneChangeAssist'|'trafficJamAssist'|'autoHighBeam'|'hillDescent'|'parkingAssist';
export type FeatureState = 'present'|'absent'|'unknown';
export const SAFETY_LABELS: Record<SafetySystem,string> = {
  abs:'ABS', ebd:'Distribución electrónica de frenado (EBD)', esc:'Control de estabilidad (ESC/VSC/VDC)',
  tcs:'Control de tracción (TCS/TRC)',hillAssist:'Asistente de pendiente (HAC/HSA)',
  aeb:'Frenado autónomo de emergencia',fcw:'Alerta de colisión frontal',
  laneDeparture:'Alerta de salida de carril',laneKeeping:'Mantenimiento de carril',
  adaptiveCruise:'Crucero adaptativo',blindSpot:'Alerta de punto ciego',
  rearCrossTraffic:'Alerta de tránsito cruzado trasero',laneChangeAssist:'Asistencia de cambio de carril',
  trafficJamAssist:'Asistencia de congestión de tráfico',autoHighBeam:'Luces altas inteligentes',
  hillDescent:'Control de descenso',parkingAssist:'Asistencia de estacionamiento',
};
export const SAFETY_KEYS = Object.keys(SAFETY_LABELS) as SafetySystem[];
export function getSafetyState(v:Vehicle,key:SafetySystem):FeatureState {
  // Sólo configuración de versión, sin heredar ADAS de otra motorización/año.
  return v.equipment?.safetySystems?.[key] ?? 'unknown';
}
export function hasVerifiedSystem(v:Vehicle,key:SafetySystem):boolean {
  return getSafetyState(v,key) === 'present';
}
export interface AebAssessment { active:boolean; brakePedal:number; warning:boolean; ttcSeconds:number|null }
export function assessAeb(args: {vehicle:Vehicle; speedMps:number; distanceM:number|null; relativeSpeedMps:number}):AebAssessment {
  const {vehicle,speedMps,distanceM,relativeSpeedMps} = args;
  if (!hasVerifiedSystem(vehicle,'aeb') || distanceM === null || speedMps < 1 || relativeSpeedMps <= .1)
    return {active:false,brakePedal:0,warning:false,ttcSeconds:null};
  const ttc = Math.max(0,distanceM) / relativeSpeedMps;
  const warning = ttc < 2.3;
  return {active:ttc < 1.3,brakePedal:ttc < 1.3 ? Math.min(1,(1.3-ttc)*1.8+.25):0, warning,ttcSeconds:ttc};
}
export function safetyDriveModifiers(args:{vehicle:Vehicle;throttle:number;slip:number;yawRate:number;neededLateralAccel:number;availableLateralAccel:number}) {
  const {vehicle,slip,yawRate,neededLateralAccel,availableLateralAccel} = args;
  const tcsActive = hasVerifiedSystem(vehicle,'tcs') && args.throttle > .20 && slip > .30;
  const escActive = hasVerifiedSystem(vehicle,'esc') && neededLateralAccel > availableLateralAccel*.9 && Math.abs(yawRate) > .06;
  return {
    tcsActive, escActive,
    // Suaves: funcionan como asistencia, no como conducción automática.
    tractionFactor: tcsActive ? Math.max(.65,1 - (slip-.30)*.42) : 1,
    lateralDamping: escActive ? .86 : 1,
    yawDamping: escActive ? .93 : 1,
  };
}

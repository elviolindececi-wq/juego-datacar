/**
 * DATACAR Driving IQ — reglas de videojuego, NO calificación de seguridad real.
 * Los puntajes comparan conducción observada respecto de referencias internas;
 * no convierten el equipamiento de seguridad en un resultado de choque.
 */
import type { Vehicle, VehicleRaceResult } from '../types/vehicle.ts';

export interface DrivingEventStats {
  collisions: number;
  collisionSeverity: number; // suma de cambios relativos de velocidad de contacto (m/s aprox.)
  potholesHit: number;
  speedBumpsTooFast: number;
  waterEntries: number;
  lossOfControl: number;
  absInterventions: number;
  tcsInterventions: number;
  escInterventions: number;
  aebInterventions: number;
}

export const emptyDrivingEvents = (): DrivingEventStats => ({
  collisions: 0, collisionSeverity: 0, potholesHit: 0, speedBumpsTooFast: 0,
  waterEntries: 0, lossOfControl: 0, absInterventions: 0, tcsInterventions: 0,
  escInterventions: 0, aebInterventions: 0,
});

export interface DrivingIQAssessment {
  vehicleId: string;
  total: number;
  performance: number;
  safety: number;
  obstacles: number;
  control: number;
  events: DrivingEventStats;
  completed: boolean;
  relativeTimeRatio: number | null;
}

const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreDrivingIQ(
  result: VehicleRaceResult,
  referenceTimeSec?: number | null,
  trackLengthMeters?: number,
): DrivingIQAssessment {
  const e = { ...emptyDrivingEvents(), ...(result.drivingEvents ?? {}) };
  const completed = !result.isDnf;
  const actual = Math.max(.01, result.finishTimeSec);
  const ref = Number.isFinite(referenceTimeSec) && (referenceTimeSec ?? 0) > 1 ? referenceTimeSec! : null;
  const ratio = completed && ref ? actual / ref : null;
  const distance = result.telemetryHistory.at(-1)?.distanceMeters ?? 0;
  const progress = clamp(distance / Math.max(1, trackLengthMeters ?? 1), 0, 1);

  // Referencia por VEHÍCULO (modelo virtual sin incidentes), nunca 0-100 homologado.
  // El tiempo no puede borrar las penalizaciones por conducción peligrosa.
  const performance = completed
    ? ref ? clamp(35 - Math.max(0, ratio! - 1) * 6.5, 12, 35) : 27
    : 12 * progress;
  const safety = clamp(30 - e.collisions * 3.8 - e.collisionSeverity * 0.65, 0, 30);
  const obstacles = clamp(20 - e.potholesHit * 2.5 - e.speedBumpsTooFast * 1.8 - e.waterEntries * 1.2, 0, 20);
  const control = clamp(15 - e.lossOfControl * 2.7, 0, 15);
  return {
    vehicleId: result.vehicle.id,
    total: round1(performance + safety + obstacles + control),
    performance: round1(performance), safety: round1(safety),
    obstacles: round1(obstacles), control: round1(control),
    events: e, completed, relativeTimeRatio: ratio === null ? null : round1(ratio),
  };
}

export function rankDrivingIQ(
  results: VehicleRaceResult[],
  referenceResults: VehicleRaceResult[],
  trackLengthMeters: number,
): DrivingIQAssessment[] {
  return results.map(result => {
    const reference = referenceResults.find(r => r.vehicle.id === result.vehicle.id);
    return scoreDrivingIQ(result, reference?.finishTimeSec, trackLengthMeters);
  }).sort((a, b) => b.total - a.total ||
    Number(b.completed) - Number(a.completed) || a.vehicleId.localeCompare(b.vehicleId));
}

/** Texto de diagnóstico construido SOLO a partir de eventos medidos y ficha recibida. */
export function explainDriving(
  result: VehicleRaceResult,
  assessment: DrivingIQAssessment,
): string[] {
  const e = assessment.events;
  const v: Vehicle = result.vehicle;
  const messages: string[] = [];
  if (e.collisions > 0) {
    messages.push(`Tuviste ${e.collisions} ${e.collisions === 1 ? 'contacto' : 'contactos'} con vehículos u obstáculos. La puntuación descuenta también la intensidad de los impactos virtuales. Esto NO equivale a una prueba de choque ni mide protección de ocupantes.`);
  } else messages.push('No registramos impactos con otros vehículos ni barreras en esta partida. Eso favoreció tu puntaje de conducción segura.');
  if (e.potholesHit > 0 || e.speedBumpsTooFast > 0) {
    messages.push(`Atravesaste ${e.potholesHit} ${e.potholesHit === 1 ? 'bache' : 'baches'} y ${e.speedBumpsTooFast} ${e.speedBumpsTooFast === 1 ? 'reductor' : 'reductores'} a velocidad elevada. Los golpes de suspensión registrados son eventos del simulador, no daños mecánicos certificados.`);
  } else messages.push('Gestionaste los baches y reductores sin contactos o excesos registrados en esta simulación.');
  if (e.lossOfControl) messages.push(`Se detectaron ${e.lossOfControl} episodios de pérdida de adherencia o control. Una entrada más lenta en curvas y un manejo progresivo podrían mejorar el resultado.`);
  if (e.absInterventions || e.tcsInterventions || e.escInterventions || e.aebInterventions) {
    const active = [
      e.absInterventions ? `ABS ${e.absInterventions}` : null,
      e.tcsInterventions ? `tracción ${e.tcsInterventions}` : null,
      e.escInterventions ? `estabilidad ${e.escInterventions}` : null,
      e.aebInterventions ? `frenado automático ${e.aebInterventions}` : null,
    ].filter(Boolean).join(', ');
    messages.push(`Intervenciones simuladas de asistencias confirmadas en la ficha: ${active}. La simulación no reproduce el software real del fabricante.`);
  }
  if (assessment.relativeTimeRatio !== null && assessment.relativeTimeRatio > 1.25) {
    const trustedTorque = v.specEvidence?.status === 'exact-user-sheet' &&
      !v.estimatedFieldNames?.includes('torqueNm') && v.torqueNm > 0;
    messages.push(trustedTorque
      ? `Tu tiempo fue más lento que la referencia virtual de este modelo. El motor declarado tiene ${v.torqueNm} Nm, pero la salida también depende de la transmisión, la masa y la adherencia; no podemos atribuir el tiempo solamente al torque.`
      : 'Tu tiempo fue más lento que la referencia virtual. La respuesta depende de la motorización, la transmisión y la adherencia; la ficha recibida no permite atribuirlo a un torque oficial.');
  }
  if (!assessment.completed) messages.push('No completaste el trazado antes del cierre de la partida; el rendimiento se valora de acuerdo con el avance alcanzado.');
  return messages.slice(0, 5);
}

import type { Vehicle } from '../types/vehicle.ts';
import type { WeatherMode } from './weatherDynamics.ts';

/** DATACAR V9.6: mensajes educativos del juego. No equivalen a una prueba del vehículo. */
export type RaceInsight = {
  id: string;
  title: string;
  message: string;
  kind: 'info' | 'event' | 'warning';
};

export type InsightTelemetry = {
  speedKmh: number;
  accelG: number;
  rpm: number;
  slip: number;
  pothole: boolean;
  impacts: number;
  absActive: boolean;
  tcsActive: boolean;
  escActive: boolean;
  aebActive: boolean;
  braking: boolean;
};

export type InsightConditions = {
  throttle: number;
  weather: WeatherMode;
  elapsedSec: number;
  newCollision?: boolean;
  newPothole?: boolean;
};

const documented = (v: Vehicle, field: 'powerHp' | 'torqueNm' | 'weightKg'): boolean =>
  (v.specEvidence?.status === 'exact-user-sheet' || v.specEvidence?.status === 'exact-official') &&
  !v.estimatedFieldNames?.includes(field) &&
  Number.isFinite(v[field]) && v[field] > 0;

const insight = (id: string, title: string, message: string, kind: RaceInsight['kind'] = 'info'): RaceInsight => ({ id, title, message, kind });

/** El resumen inicial utiliza únicamente datos identificados como documentados. */
export function initialRaceInsight(v: Vehicle): RaceInsight {
  const power = documented(v, 'powerHp') ? `${Math.round(v.powerHp)} HP` : null;
  const torque = documented(v, 'torqueNm') ? `${Math.round(v.torqueNm)} Nm` : null;
  const figures = [power, torque].filter(Boolean).join(' · ');
  if (figures) {
    return insight('ficha-inicial', 'TU MOTOR · FICHA DATACAR',
      `${v.engineDescription}. ${figures}. La respuesta también depende de la masa, la caja y la adherencia.`);
  }
  return insight('ficha-inicial', 'TU MOTOR · FICHA DATACAR',
    `${v.engineDescription}. La ficha recibida no incluye cifras completas de potencia/torque; la aceleración es una estimación del simulador.`);
}

/**
 * El motor puede explicar un EVENTO observado, pero no diagnostica causas
 * mecánicas solo por una aceleración menor. El repertorio general gira sin
 * repetir el mismo texto consecutivamente.
 */
export function nextRaceInsight(
  v: Vehicle,
  state: InsightTelemetry,
  conditions: InsightConditions,
  sequence: number,
  previousId?: string | null,
): RaceInsight {
  const urgent: RaceInsight[] = [];
  if (conditions.newCollision) urgent.push(insight('choque', 'CONTACTO REGISTRADO',
    'Hubo un impacto en la simulación: perdés puntos de conducción segura. Esto no determina la protección real de los ocupantes.', 'warning'));
  if (conditions.newPothole) urgent.push(insight('bache', 'SUSPENSIÓN EN ACCIÓN',
    'Una rueda entró en un bache. La profundidad, velocidad y suspensión simulada determinan el golpe y la pérdida de control.', 'warning'));
  if (state.aebActive) urgent.push(insight('aeb', 'FRENADO AUTÓNOMO',
    'Intervino el frenado automático simulado porque se detectó un riesgo de alcance; las condiciones reales del sistema pueden diferir.', 'event'));
  if (state.absActive) urgent.push(insight('abs', 'ABS ACTIVO',
    'El ABS está modulando la presión de frenado en esta simulación para limitar el bloqueo. No significa que el auto frene en menos metros siempre.', 'event'));
  if (state.escActive || state.tcsActive) urgent.push(insight('estabilidad', 'ASISTENCIA DE CONTROL',
    'Se activó una asistencia verificada para esta versión. El control de estabilidad o tracción intenta limitar el deslizamiento.', 'event'));
  if (state.slip > .4 && state.speedKmh > 15) urgent.push(insight('deriva', 'PÉRDIDA DE ADHERENCIA',
    'Se detectó deslizamiento. Entrá más despacio a la curva y dosificá dirección y acelerador; el agarre disponible es limitado.', 'warning'));
  if (conditions.throttle > .85 && state.speedKmh > 4 && state.speedKmh < 30 && conditions.elapsedSec > 2 && state.accelG < .11) {
    urgent.push(insight('salida-lenta', 'SALIDA CONTENIDA',
      'La aceleración observada es moderada. Influyen torque, masa, caja y agarre; no se puede afirmar que la causa sea «torque bajo».', 'event'));
  }
  if (state.braking && state.speedKmh > 22 && state.accelG < -.35) urgent.push(insight('frenada', 'FRENADA INTENSA',
    'El frenado traslada carga al eje delantero. La distancia de detención depende de neumáticos, velocidad y superficie.', 'event'));
  if (urgent.length) {
    const next = urgent.find(item => item.id !== previousId);
    if (next) return next;
  }

  const general: RaceInsight[] = [];
  const isTurbo = /\bturbo\b/i.test(`${v.fuelFeeding} ${v.engineDescription}`);
  if (isTurbo) general.push(insight('turbo', 'ENTREGA DEL MOTOR',
    'La ficha identifica una motorización turbo. La respuesta del motor depende de las RPM, la carga y la calibración de transmisión.'));
  if (v.hybridSystem?.kind === 'self-charging-hev') general.push(insight('hev', 'ASISTENCIA HÍBRIDA',
    'Este HEV combina motor a combustión y asistencia eléctrica. Su respuesta virtual cambia con la carga y la energía disponible.'));
  if (v.hybridSystem?.kind === 'mild-12v') general.push(insight('mild', 'MILD HYBRID',
    'El ISG de 12 V aporta una ayuda limitada al motor térmico. No convierte el vehículo en eléctrico ni suma libremente ambos torques.'));
  if (/\bcvt\b/i.test(v.transmissionDescription)) general.push(insight('cvt', 'TRANSMISIÓN CVT',
    'Una CVT puede sostener las revoluciones mientras cambia la relación de transmisión. Los cambios de sonido no equivalen a marchas fijas.'));
  else if (/\bdct\b|doble embrague/i.test(v.transmissionDescription)) general.push(insight('dct', 'DOBLE EMBRAGUE',
    'La ficha indica una transmisión de doble embrague: el motor y la caja condicionan la salida y las transiciones entre relaciones.'));
  else general.push(insight('caja', 'TRANSMISIÓN',
    `La ficha identifica: ${v.transmissionDescription}. El desarrollo de las relaciones influye en la fuerza que llega a las ruedas.`));
  if (documented(v, 'torqueNm')) general.push(insight('torque', '¿QUÉ HACE EL TORQUE?',
    `La ficha declara ${Math.round(v.torqueNm)} Nm. Esa cifra sola NO determina la aceleración: importan también potencia, peso y transmisión.`));
  else general.push(insight('torque-pendiente', 'TORQUE · DATO PENDIENTE',
    'La ficha recibida no confirma el torque de esta versión. El juego emplea una calibración provisional, no una cifra oficial.'));
  if (documented(v, 'weightKg')) general.push(insight('masa', 'LA MASA IMPORTA',
    `Esta versión tiene ${Math.round(v.weightKg)} kg documentados. La masa influye al acelerar, frenar y transferir carga en las curvas.`));
  else general.push(insight('masa-estimada', 'MASA Y ACELERACIÓN',
    'La masa también determina la respuesta. Cuando no figura en la ficha, su valor de simulación es provisional.'));
  if (conditions.weather === 'rain' || conditions.weather === 'storm' || conditions.weather === 'flood') general.push(insight('lluvia', 'MENOS AGARRE EN MOJADO',
    'La pista húmeda reduce el agarre disponible en esta simulación. Frená antes de las curvas y evitá cambios bruscos.'));
  general.push(insight('control', 'DRIVING IQ',
    'No gana solamente quien llega primero: los impactos, la gestión de obstáculos y la pérdida de control también descuentan puntos.'));

  const withoutRepeat = general.filter(item => item.id !== previousId);
  return withoutRepeat[sequence % Math.max(1, withoutRepeat.length)] || general[0];
}

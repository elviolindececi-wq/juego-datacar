/**
 * DATACAR ARENA — Controlador de Señaleros e Indicadores de Giro (§9)
 * Estado puramente visual e interactivo: NO altera la dirección ni las físicas del vehículo.
 *
 * Atajos de teclado en Desktop (sin colisionar con W/A/S/D, Flechas, Espacio, C, P, R, Escape):
 * - Q: Señalero izquierdo (toggle)
 * - E: Señalero derecho (toggle)
 * - B: Balizas de emergencia / 4 luces (toggle)
 * - X: Apagar señaleros inmediatamente
 */

export type TurnSignalMode = 'off' | 'left' | 'right' | 'hazards';

export interface TurnSignalBlinkReadout {
  mode: TurnSignalMode;
  blinkOn: boolean;
  leftLit: boolean;
  rightLit: boolean;
}

/** Frecuencia automotriz estándar (~1.5 Hz -> período de 0.66s, 0.33s encendido / 0.33s apagado). */
export const TURN_SIGNAL_PERIOD_SEC = 0.66;

export function applyTurnSignalAction(
  current: TurnSignalMode,
  action: 'toggle_left' | 'toggle_right' | 'toggle_hazards' | 'turn_off',
): TurnSignalMode {
  switch (action) {
    case 'toggle_left':
      return current === 'left' ? 'off' : 'left';
    case 'toggle_right':
      return current === 'right' ? 'off' : 'right';
    case 'toggle_hazards':
      return current === 'hazards' ? 'off' : 'hazards';
    case 'turn_off':
      return 'off';
  }
}

export function mapKeyCodeToTurnSignalAction(
  code: string,
): 'toggle_left' | 'toggle_right' | 'toggle_hazards' | 'turn_off' | null {
  switch (code) {
    case 'KeyQ':
    case 'BracketLeft':
      return 'toggle_left';
    case 'KeyE':
    case 'BracketRight':
      return 'toggle_right';
    case 'KeyB':
      return 'toggle_hazards';
    case 'KeyX':
      return 'turn_off';
    default:
      return null;
  }
}

export function evaluateTurnSignalBlink(
  mode: TurnSignalMode,
  elapsedSec: number,
  activatedAtSec = 0,
): TurnSignalBlinkReadout {
  if (mode === 'off') {
    return { mode, blinkOn: false, leftLit: false, rightLit: false };
  }
  const rel = Math.max(0, elapsedSec - activatedAtSec);
  const phase = (rel % TURN_SIGNAL_PERIOD_SEC) / TURN_SIGNAL_PERIOD_SEC;
  // Arranca encendido en t = 0 para respuesta visual inmediata al pulsar el botón
  const blinkOn = phase < 0.52;
  return {
    mode,
    blinkOn,
    leftLit: blinkOn && (mode === 'left' || mode === 'hazards'),
    rightLit: blinkOn && (mode === 'right' || mode === 'hazards'),
  };
}

/**
 * Apagado automático al girar en sentido contrario:
 * - Si está encendido el señalero DERECHO ('right') y el conductor gira a la IZQUIERDA (steerDirection < -threshold) -> 'off'.
 * - Si está encendido el señalero IZQUIERDO ('left') y el conductor gira a la DERECHA (steerDirection > threshold) -> 'off'.
 * - Las balizas ('hazards') se mantienen activas hasta apagado manual.
 */
export function evaluateTurnSignalAutoCancel(
  current: TurnSignalMode,
  steerDirection: number,
  threshold = 0.2,
): TurnSignalMode {
  if (current === 'right' && steerDirection < -threshold) {
    return 'off';
  }
  if (current === 'left' && steerDirection > threshold) {
    return 'off';
  }
  return current;
}

import { chooseDirectorShot, screenRightSteeringToWorldYaw } from '../src/utils/cinematicDirector.ts';
import { VehicleSteeringDynamics } from '../src/utils/vehicleSteeringDynamics.ts';

const stages = [
  [0, 'grilla_frontal'],
  [70, 'persecucion_baja'],
  [140, 'lateral_izquierda'],
  [210, 'cenital_dinamica'],
  [265, 'lateral_derecha'],
  [310, 'frontal_seguimiento'],
  [370, 'frontal_meta'],
  [400, 'frontal_meta'],
];
for (const [distance, expected] of stages) {
  const actual = chooseDirectorShot(distance, 400);
  if (actual !== expected) throw new Error(`Director ${distance} m: ${actual} !== ${expected}`);
}
const right = new VehicleSteeringDynamics();
const left = new VehicleSteeringDynamics();
let rightState, leftState;
for (let i = 0; i <= 100; i++) {
  const distance = i * .42;
  rightState = right.update(distance, 75, screenRightSteeringToWorldYaw(.24), .016, 0);
  leftState = left.update(distance, 75, screenRightSteeringToWorldYaw(-.24), .016, 0);
}
// La carrera va a +Z, la cámara de persecución mira a +Z: pantalla derecha es -X.
if (!(rightState.x < -0.5 && leftState.x > 0.5)) {
  throw new Error(`Dirección invertida: derecha X=${rightState.x}, izquierda X=${leftState.x}`);
}
// En el borde de pista el modelo endereza la carrocería; probar orientación antes del límite.
const rightBeforeEdge = new VehicleSteeringDynamics();
const leftBeforeEdge = new VehicleSteeringDynamics();
let earlyRight, earlyLeft;
for (let i = 0; i <= 20; i++) {
  earlyRight = rightBeforeEdge.update(i*.42, 75, screenRightSteeringToWorldYaw(.24), .016, 0);
  earlyLeft = leftBeforeEdge.update(i*.42, 75, screenRightSteeringToWorldYaw(-.24), .016, 0);
}
if (!(earlyRight.yaw < 0 && earlyLeft.yaw > 0)) {
  throw new Error('La carrocería debe orientar su trompa en la misma dirección');
}
console.log('OK: 7 fases cinematográficas y toma frontal de meta');
console.log('OK: flecha derecha → derecha de pantalla; flecha izquierda → izquierda');

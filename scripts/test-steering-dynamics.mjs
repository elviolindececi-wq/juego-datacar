// Prueba de lógica sin navegador. Usa TypeScript strip-types de Node 22 (si disponible)
import { VehicleSteeringDynamics } from '../src/utils/vehicleSteeringDynamics.ts';
const steering = new VehicleSteeringDynamics();
let s = steering.update(0, 0, 0, 1/60, -3.6);
if (s.x !== -3.6 || s.yaw !== 0) throw new Error('Inicio incorrecto');
for (let i = 1; i <= 120; i++) {
  s = steering.update(i * 0.7, 75, 0.2, 1/60, -3.6);
  if (!Number.isFinite(s.x) || !Number.isFinite(s.yaw)) throw new Error('Valor no finito');
  if (s.x < -5.801 || s.x > 5.801) throw new Error('Salió de pista');
}
if (s.x <= -3.6) throw new Error('El volante positivo no mueve a la derecha');
console.log('OK: dirección hacia la derecha y límites de pista');
for (let i = 121; i <= 180; i++) s = steering.update(i * .7, 75, -.3, 1/60, -3.6);
if (!Number.isFinite(s.yaw)) throw new Error('Giro invertido inválido');
steering.update(0, 0, 0, 1/60, -3.6);
const r = steering.update(0, 0, 0, 1/60, -3.6);
if (r.x !== -3.6) throw new Error('No se reinició correctamente');
console.log('OK: inversión y reinicio');

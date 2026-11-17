/**
 * Dirección lateral cinemática para la demostración interactiva de DATACAR ARENA.
 * La telemetría oficial conserva distancia/tiempo/ranking; solo se modifica la
 * posición transversal y la orientación visual del vehículo seleccionado.
 *
 * No es un modelo de neumáticos ni un simulador de colisiones. La dirección se
 * limita según la velocidad para evitar saltos y salidas de pista abruptas.
 */
export class VehicleSteeringDynamics {
  private lastDistance = 0;
  private initialized = false;
  private offsetX = 0;
  private yawRadians = 0;

  reset(distanceMeters = 0) {
    this.initialized = true;
    this.lastDistance = distanceMeters;
    this.offsetX = 0;
    this.yawRadians = 0;
  }

  update(
    distanceMeters: number,
    speedKmh: number,
    steeringRadians: number,
    deltaSeconds: number,
    laneCenterX: number,
    roadHalfWidth = 7,
  ): { x: number; yaw: number } {
    if (!this.initialized) this.reset(distanceMeters);
    const deltaDistance = distanceMeters - this.lastDistance;
    this.lastDistance = distanceMeters;

    // Una búsqueda en el timeline o un reinicio no debe lanzar al auto de costado.
    if (deltaDistance < -0.05 || deltaDistance > 12) this.reset(distanceMeters);
    const distanceStep = deltaDistance >= 0 && deltaDistance <= 12 ? deltaDistance : 0;

    const dt = Math.max(0, Math.min(deltaSeconds, 0.06));
    const speed = Math.max(0, speedKmh / 3.6);
    const wheelbase = 2.65; // Tracker: aproximación visual de distancia entre ejes (m)
    const maxLateralAccel = 5.0; // m/s², dirección atenuada a alta velocidad
    const maxSteeringAtSpeed = Math.min(
      Math.PI / 6,
      Math.atan((maxLateralAccel * wheelbase) / Math.max(9, speed * speed)),
    );
    const effectiveSteering = Math.max(
      -maxSteeringAtSpeed,
      Math.min(maxSteeringAtSpeed, steeringRadians),
    );

    if (distanceStep > 0 && speed > 0.05) {
      // Modelo bicicleta: velocidad angular = v / L * tan(delta).
      // Se usa el avance real de telemetría para no depender de los FPS.
      this.yawRadians += (distanceStep / wheelbase) * Math.tan(effectiveSteering);
    }
    if (Math.abs(steeringRadians) < 0.002) {
      this.yawRadians *= Math.exp(-2.8 * dt);
    }

    // La ruta es una recta de 14m: limitar deriva y orientación para no atravesar
    // bordillos ni apuntar casi perpendicularmente al sentido de circulación.
    this.yawRadians = Math.max(-0.22, Math.min(0.22, this.yawRadians));
    this.offsetX += Math.tan(this.yawRadians) * distanceStep;
    const minOffset = -roadHalfWidth + 1.2 - laneCenterX;
    const maxOffset = roadHalfWidth - 1.2 - laneCenterX;
    if (this.offsetX <= minOffset) {
      this.offsetX = minOffset;
      this.yawRadians = Math.max(0, this.yawRadians);
    } else if (this.offsetX >= maxOffset) {
      this.offsetX = maxOffset;
      this.yawRadians = Math.min(0, this.yawRadians);
    }

    return { x: laneCenterX + this.offsetX, yaw: this.yawRadians };
  }
}

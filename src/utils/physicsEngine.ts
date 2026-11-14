import { Vehicle, RaceTrackConfig, SimulationTelemetrySample, VehicleRaceResult } from '../types/vehicle';

export const GRAVITY = 9.80665;
export const AIR_DENSITY = 1.225; // kg/m³ a nivel del mar

export interface SimulationStepInput {
  timeSec: number;
  dt: number;
  vehicle: Vehicle;
  track: RaceTrackConfig;
  currentSpeedMs: number;
  currentDistanceM: number;
  fuelRemaining: number;
  pitStops: number;
  isPitStopping: boolean;
  pitStopTimerSec: number;
}

/**
 * Calcula la física en tiempo continuo para un vehículo en una pista específica
 */
export function simulateFullRace(
  vehicles: Vehicle[],
  track: RaceTrackConfig,
  timeStep = 0.02
): VehicleRaceResult[] {
  // La pantalla de Comparar empieza con 0 autos seleccionados en V7.2+.
  // Sin este guard, `winner` sería undefined y React deja la pantalla en blanco.
  if (!vehicles.length) return [];

  const results: VehicleRaceResult[] = [];

  for (const vehicle of vehicles) {
    const history: SimulationTelemetrySample[] = [];
    let timeSec = 0;
    let distanceM = 0;
    let speedMs = 0;
    const initialFuelPct = track.initialFuelPercent !== undefined ? track.initialFuelPercent : 100;
    let fuelRemaining = (vehicle.fuelCapacityL * initialFuelPct) / 100;
    let fuelBurned = 0;
    let pitStops = 0;
    let isPitStopping = false;
    let pitStopTimer = 0;
    let strandedTimer = 0;

    let time0to100: number | null = null;
    let time0to200: number | null = null;
    let time400m: number | null = null;
    let topSpeedMs = 0;

    // Masas
    const cargoMass = Math.max(0, track.cargoPayloadKg);
    const fuelDensityKgL = vehicle.fuelType === 'electric' ? 0 : 0.75;
    
    // Inclinación
    const angleRad = Math.atan(track.inclineGradePercent / 100);
    const sinAngle = Math.sin(angleRad);
    const cosAngle = Math.cos(angleRad);

    // Relación de transmisión y eficiencias
    const drivetrainEfficiency = vehicle.drivetrain === 'AWD' ? 0.84 : vehicle.drivetrain === 'RWD' ? 0.88 : 0.86;
    
    // En subida con pendiente y/o carga pesada, el par motor (torque) a medio régimen dicta la potencia utilizable real:
    // Los motores Turbo Diésel (250 Nm) entregan par plano desde 1.500 RPM sin caer; los turbo nafteros sostienen ~88%,
    // mientras que los motores atmosféricos dependen de altas RPM (6.000+) y sufren caída de empuje en subida.
    let powerBandFactor = 1.0;
    if (track.inclineGradePercent > 0 || cargoMass > 200) {
      const isDiesel = vehicle.fuelType === 'diesel' || vehicle.fuelFeeding?.toLowerCase().includes('diésel');
      const isTurbo = vehicle.fuelFeeding?.toLowerCase().includes('turbo') || vehicle.engineDescription?.toLowerCase().includes('turbo');
      if (isDiesel) {
        powerBandFactor = 0.98; // Par diésel masivo y continuo
      } else if (isTurbo) {
        powerBandFactor = 0.88; // Turbo naftero
      } else {
        powerBandFactor = 0.77; // Atmosférico sin sobrealimentación
      }
    }
    const maxPowerWatts = vehicle.powerHp * 745.7 * drivetrainEfficiency * powerBandFactor;

    // Par y rueda efectiva
    const effectiveWheelRadius = 0.33; // ~0.33m radio rueda medio
    const firstGearTorqueMult = vehicle.category === 'heavy_truck' ? 14.0 : 8.5; // multiplicador de caja en 1ra/2da
    const tireFrictionCoeff = vehicle.tireGrip;

    // Resistencia a la rodadura Crr
    const Crr = vehicle.category === 'heavy_truck' ? 0.010 : 0.014;

    const targetDistance = track.distanceMeters;

    // Simular paso a paso hasta cruzar la meta o tiempo máximo de seguridad (300 segundos)
    while (distanceM < targetDistance && timeSec < 300) {
      const currentFuelMass = fuelRemaining * fuelDensityKgL;
      const currentTotalMass = vehicle.weightKg + cargoMass + currentFuelMass;

      // Penalización por sobrecarga extrema si excede la capacidad máxima del fabricante
      const overloadFactor = cargoMass > vehicle.maxPayloadKg 
        ? Math.min(2.5, 1 + ((cargoMass - vehicle.maxPayloadKg) / Math.max(1, vehicle.maxPayloadKg)) * 0.75)
        : 1.0;

      // Si se queda sin combustible en modo resistencia (solo si la pista incluye paradas de repostaje)
      if (fuelRemaining <= 0.05 && track.id === 'endurance' && !isPitStopping && track.initialFuelPercent === undefined) {
        isPitStopping = true;
        pitStopTimer = 12.0; // 12 segundos de parada en boxes para repostar
        pitStops++;
      }

      let netAccel = 0;
      let driveForceN = 0;
      let aeroDragN = 0;
      let powerDeliveredHp = 0;
      let currentGear = 1;
      let currentRpm = 1000;
      let isBraking = false;
      let inCorner = false;
      let currentCornerRadius = 999;
      const isOutOfFuel = fuelRemaining <= 0.001;

      if (isPitStopping) {
        speedMs = 0;
        pitStopTimer -= timeStep;
        if (pitStopTimer <= 0) {
          isPitStopping = false;
          fuelRemaining = vehicle.fuelCapacityL * 0.75; // Reposta 75%
        }
      } else if (isOutOfFuel) {
        // CORTE TOTAL DE ENERGÍA: Batería al 0% o tanque seco
        // El motor se apaga por completo, tracción = 0 N, rueda solo por inercia
        driveForceN = 0;
        currentRpm = 0;
        powerDeliveredHp = 0;

        // Si la velocidad cae a cero por rozamiento, el auto queda varado en la pista
        if (speedMs < 0.1) {
          speedMs = 0;
          netAccel = 0;
          strandedTimer += timeStep;
          if (strandedTimer >= 3.0) {
            // Varado definitivamente en la pista, registrar y terminar
            break;
          }
        }
      } else {
        // Fuerza de tracción máxima que los neumáticos pueden transferir al asfalto sin derrapar
        let axleWeightShare = 0.5;
        if (vehicle.drivetrain === 'AWD') axleWeightShare = 0.95;
        else if (vehicle.drivetrain === 'RWD') axleWeightShare = 0.68; // transferencia de peso hacia atrás
        else if (vehicle.drivetrain === 'FWD') axleWeightShare = 0.48; // elevación frontal en aceleración

        const maxTractionForce = currentTotalMass * GRAVITY * tireFrictionCoeff * axleWeightShare;

        // Fuerza motriz del motor a la velocidad actual
        const speedKmh = speedMs * 3.6;
        const lowSpeedThresholdMs = vehicle.torqueNm >= 240 ? 10.0 : 8.0; // Motores diésel de alto par estiran más el empuje inicial

        if (speedMs < lowSpeedThresholdMs) {
          // Régimen de par motor multiplicado por caja
          const engineTorqueAtWheel = (vehicle.torqueNm * firstGearTorqueMult) / effectiveWheelRadius;
          driveForceN = Math.min(maxTractionForce, engineTorqueAtWheel);
        } else {
          // Régimen de potencia constante F = P / v
          const forceFromPower = maxPowerWatts / Math.max(speedMs, 1.0);
          driveForceN = Math.min(maxTractionForce, forceFromPower);
        }

        // Si hay sobrecarga extrema sobre la suspensión/transmisión, reduce la entrega
        driveForceN = driveForceN / overloadFactor;

        // Comportamiento en curvas si la pista es circuito o prueba técnica de frenos
        let cornerSpeedLimitMs = 999;
        isBraking = false;
        inCorner = false;
        currentCornerRadius = 999;

        if (
          track.id === 'circuit' ||
          Boolean(track.cityCircuitId) ||
          track.id.startsWith('circuit-') ||
          track.id === 'endurance' ||
          track.id === 'brake_slalom'
        ) {
          // Si es pista técnica de frenos (brake_slalom), curvas cerradas más frecuentes (cada 260m)
          const cornerInterval = track.id === 'brake_slalom' ? 260 : track.cityCircuitId === 'oliva' ? 320 : 420;
          const cornerZoneLength = track.id === 'brake_slalom' ? 95 : 120;
          const trackPositionMod = distanceM % cornerInterval;

          // Curva activa
          if (trackPositionMod > (cornerInterval - cornerZoneLength)) {
            inCorner = true;
            // Radio de curvatura adaptado a cada trazado
            currentCornerRadius = track.id === 'brake_slalom' ? 32 : track.cityCircuitId === 'oliva' ? 46 : 55;
            
            // v_max = sqrt(μ * g * R)
            // Considerar centro de gravedad y chasis
            const chassisBonus = vehicle.dimensions?.clearanceMm && vehicle.dimensions.clearanceMm > 190 ? 0.95 : 1.05;
            const lateralG = vehicle.tireGrip * 0.98 * chassisBonus;
            cornerSpeedLimitMs = Math.sqrt(lateralG * GRAVITY * currentCornerRadius);
          }
        }

        // Eficacia del sistema de frenos:
        // Los frenos de 4 discos disipan calor y tienen mayor deceleración (~1.08g - 1.15g)
        // Tambores traseros sufren sobrecalentamiento/fade y menor deceleración pico (~0.88g - 0.94g)
        const has4Discs = vehicle.equipment?.brakesType === '4_discs';
        const brakeDecelG = has4Discs ? 1.12 : 0.91;

        // Si la velocidad actual supera el límite de paso por curva (o estamos cerca de entrar a ella), aplicar frenada
        if (speedMs > cornerSpeedLimitMs) {
          isBraking = true;
          // Fuerza de frenado F_freno = masa * deceleración
          const brakingForce = currentTotalMass * (GRAVITY * brakeDecelG * vehicle.tireGrip);
          driveForceN = -brakingForce;
        }

        // Fuerza de resistencia aerodinámica: Fd = 0.5 * rho * Cd * A * v²
        aeroDragN = 0.5 * AIR_DENSITY * vehicle.dragCoeff * vehicle.frontalArea * (speedMs * speedMs);

        // Fuerza de resistencia a la rodadura: Fr = Crr * M * g * cos(θ)
        const rollingResistanceN = Crr * currentTotalMass * GRAVITY * cosAngle;

        // Fuerza de pendiente (peso en dirección de la bajada o subida): F_slope = M * g * sin(θ)
        const slopeForceN = currentTotalMass * GRAVITY * sinAngle;

        // Aceleración neta: F_neta = F_motriz - F_aero - F_rodadura - F_pendiente
        const netForce = driveForceN - aeroDragN - rollingResistanceN - slopeForceN;
        netAccel = netForce / currentTotalMass;

        // Límite de velocidad máxima según ficha técnica del vehículo
        const topSpeedLimitMs = vehicle.topSpeedKmh / 3.6;
        if (speedMs >= topSpeedLimitMs && netAccel > 0) {
          netAccel = 0;
          speedMs = topSpeedLimitMs;
        }

        // Actualizar velocidad
        speedMs += netAccel * timeStep;
        if (speedMs < 0) speedMs = 0;

        // Actualizar distancia
        distanceM += speedMs * timeStep;

        // Consumo de combustible / batería
        // Consumo WOT (a fondo): Litros por segundo basado en potencia demandada
        if (fuelRemaining > 0 && driveForceN > 0) {
          // Tasa de consumo en L/100km escalada a la velocidad y esfuerzo de potencia
          const throttleEffort = Math.min(1.0, Math.max(0.2, (driveForceN * speedMs) / maxPowerWatts));
          const currentConsumptionPer100Km = vehicle.consumptionBase + (vehicle.consumptionRacing - vehicle.consumptionBase) * throttleEffort;
          // Litros por metro = L/100km / 100,000
          const litersPerMeter = currentConsumptionPer100Km / 100000;
          const fuelUsedThisStep = (speedMs * timeStep) * litersPerMeter;
          fuelRemaining = Math.max(0, fuelRemaining - fuelUsedThisStep);
          fuelBurned += fuelUsedThisStep;
        }

        powerDeliveredHp = Math.min(vehicle.powerHp, Math.round((Math.max(0, driveForceN) * speedMs) / 745.7));

        // Estimación visual de marcha y RPM
        if (vehicle.fuelType === 'electric') {
          currentGear = 1;
          currentRpm = Math.min(19000, Math.round(1000 + (speedKmh / vehicle.topSpeedKmh) * 18000));
        } else {
          const speedRatio = speedKmh / Math.max(1, vehicle.topSpeedKmh);
          if (speedRatio < 0.15) { currentGear = 1; currentRpm = 2000 + speedRatio * 25000; }
          else if (speedRatio < 0.30) { currentGear = 2; currentRpm = 3000 + (speedRatio - 0.15) * 20000; }
          else if (speedRatio < 0.50) { currentGear = 3; currentRpm = 3500 + (speedRatio - 0.30) * 15000; }
          else if (speedRatio < 0.70) { currentGear = 4; currentRpm = 4000 + (speedRatio - 0.50) * 12000; }
          else if (speedRatio < 0.85) { currentGear = 5; currentRpm = 4500 + (speedRatio - 0.70) * 10000; }
          else { currentGear = 6; currentRpm = 5000 + (speedRatio - 0.85) * 8000; }
          currentRpm = Math.min(8500, Math.max(1200, Math.round(currentRpm)));
        }
      }

      if (speedMs > topSpeedMs) {
        topSpeedMs = speedMs;
      }

      const speedKmh = speedMs * 3.6;

      // Hitos de cronometraje
      if (time0to100 === null && speedKmh >= 100) {
        time0to100 = parseFloat(timeSec.toFixed(3));
      }
      if (time0to200 === null && speedKmh >= 200) {
        time0to200 = parseFloat(timeSec.toFixed(3));
      }
      if (time400m === null && distanceM >= 402) {
        time400m = parseFloat(timeSec.toFixed(3));
      }

      // Guardar telemetría a alta frecuencia (50 muestras por segundo) con precisión de coma flotante continua
      if (history.length === 0 || timeSec - history[history.length - 1].timeSec >= 0.02 || distanceM >= targetDistance) {
        history.push({
          timeSec: parseFloat(timeSec.toFixed(3)),
          distanceMeters: Math.min(targetDistance, distanceM),
          speedKmh: speedKmh,
          accelerationG: netAccel / GRAVITY,
          fuelRemaining: Math.round(fuelRemaining * 100) / 100,
          fuelBurned: Math.round(fuelBurned * 100) / 100,
          powerDeliveredHp,
          aeroDragN: Math.round(aeroDragN),
          gear: currentGear,
          rpm: currentRpm,
          pitStops,
          isBraking,
          inCorner,
          currentCornerRadiusM: inCorner ? currentCornerRadius : undefined,
          outOfFuel: isOutOfFuel,
        });
      }

      timeSec += timeStep;
    }

    const finalTrapSpeed = Math.round(speedMs * 3.6 * 10) / 10;
    const finalFinishTime = parseFloat(timeSec.toFixed(3));
    const effectiveTotalMassTon = (vehicle.weightKg + cargoMass) / 1000;
    const effectivePowerToWeight = Math.round((vehicle.powerHp / effectiveTotalMassTon) * 10) / 10;

    const isDnf = distanceM < targetDistance - 3;
    const dnfReason = isDnf
      ? vehicle.fuelType === 'electric'
        ? `Batería agotada a los ${Math.round(distanceM)} m (0% de carga restante)`
        : `Sin combustible a los ${Math.round(distanceM)} m (tanque seco)`
      : undefined;

    // Veredicto físico personalizado
    const verdict = isDnf
      ? `DNF (No completó el recorrido) — ${dnfReason}. El motor se apagó en plena marcha y el auto rodó por inercia hasta detenerse varado en la pista con balizas de emergencia.`
      : generatePhysicsVerdict(vehicle, track, finalFinishTime, finalTrapSpeed, effectivePowerToWeight, cargoMass);

    results.push({
      vehicle,
      finishPosition: 0,
      finishTimeSec: isDnf ? 999.0 : finalFinishTime,
      gapSec: 0,
      topSpeedAchievedKmh: Math.round(topSpeedMs * 3.6 * 10) / 10,
      trapSpeedKmh: finalTrapSpeed,
      time0to100,
      time0to200,
      time400m,
      fuelBurned: Math.round(fuelBurned * 100) / 100,
      fuelRemaining: Math.round(fuelRemaining * 100) / 100,
      effectivePowerToWeight,
      verdict,
      telemetryHistory: history,
      isDnf,
      dnfReason,
    });
  }

  // Ordenar: primero los que llegaron a la meta (por menor tiempo), y después los DNF (por mayor distancia alcanzada)
  results.sort((a, b) => {
    if (!a.isDnf && !b.isDnf) return a.finishTimeSec - b.finishTimeSec;
    if (!a.isDnf && b.isDnf) return -1;
    if (a.isDnf && !b.isDnf) return 1;
    const distA = a.telemetryHistory[a.telemetryHistory.length - 1]?.distanceMeters || 0;
    const distB = b.telemetryHistory[b.telemetryHistory.length - 1]?.distanceMeters || 0;
    return distB - distA;
  });

  const winner = results.find(r => !r.isDnf) || results[0];
  const winnerTime = winner.finishTimeSec;
  results.forEach((res, index) => {
    res.finishPosition = index + 1;
    res.gapSec = res.isDnf ? 0 : parseFloat((res.finishTimeSec - winnerTime).toFixed(3));
  });

  return results;
}

function generatePhysicsVerdict(
  vehicle: Vehicle,
  track: RaceTrackConfig,
  finishTime: number,
  trapSpeed: number,
  powerToWeight: number,
  cargoMass: number
): string {
  if (track.id === 'brake_slalom') {
    const has4Discs = vehicle.equipment?.brakesType === '4_discs';
    if (has4Discs) {
      return `Ventaja contundente en frenada: sus discos en las 4 ruedas le permitieron retrasar el punto de frenado en cada horquilla hasta el último instante, manteniendo gran estabilidad térmica y cruzando en ${finishTime}s con trap speed de ${trapSpeed} km/h.`;
    } else {
      return `Frenos traseros a tambor comprometidos: mayor distancia de frenado antes de cada curva cerrada, requiriendo frenar antes para no sobrepasar el límite de agarre lateral de la chicana.`;
    }
  }

  if (track.id === 'load_hillclimb') {
    if (cargoMass > vehicle.maxPayloadKg) {
      return `Sobrecarga severa (+${cargoMass - vehicle.maxPayloadKg} kg por encima de la capacidad de ficha técnica). Su motor y transmisión sufrieron pérdida de tracción en la pendiente del ${track.inclineGradePercent}%.`;
    }
    if (vehicle.torqueNm > 1200) {
      return `Dominio absoluto de torque bruto (${vehicle.torqueNm} Nm). La carga de ${cargoMass} kg y la pendiente no mermaron su curva de potencia gracias a su transmisión reforzada.`;
    }
    if (powerToWeight < 120) {
      return `Relación potencia/peso comprometida (${powerToWeight} HP/ton con carga). En pendientes pronunciadas el par motor fue insuficiente para mantener aceleración constante.`;
    }
    return `Buen equilibrio de potencia (${vehicle.powerHp} HP), logrando sostener ${trapSpeed} km/h en el ascenso con ${cargoMass} kg remolcados.`;
  }

  if (track.id === 'drag_quarter') {
    if (vehicle.drivetrain === 'AWD' && vehicle.accel0100 < 3.0) {
      return `Salida demoledora: la tracción total (AWD) eliminó el derrape inicial transfiriendo ${vehicle.powerHp} HP instantáneamente al asfalto en los primeros 60 pies.`;
    }
    if (vehicle.drivetrain === 'RWD' && vehicle.powerHp > 600) {
      return `Pérdida por tracción en la arrancada: a pesar de sus ${vehicle.powerHp} HP, el eje trasero sufrió deslizamiento de neumáticos antes de alcanzar plena adherencia.`;
    }
    return `Comportamiento lineal: completó el cuarto de milla en ${finishTime}s con una velocidad de trampa de ${trapSpeed} km/h con relación ${powerToWeight} HP/ton.`;
  }

  if (track.id === 'drag_half') {
    if (vehicle.dragCoeff <= 0.28) {
      return `Ventaja aerodinámica decisiva: su bajísimo coeficiente de arrastre Cx de ${vehicle.dragCoeff} le permitió cortar el aire a más de 250 km/h sin penalización de resistencia.`;
    }
    if (vehicle.dragCoeff >= 0.45) {
      return `Freno aerodinámico en alta velocidad: el arrastre frontal a más de 160 km/h consumió gran parte de la potencia generada, limitando su aceleración final.`;
    }
    return `Potencia sostenida en alta velocidad, cruzando a ${trapSpeed} km/h.`;
  }

  if (track.id === 'route_500km' || track.id === 'endurance') {
    if (vehicle.fuelType === 'diesel') {
      return `Eficiencia diésel dominante: consumo ultra bajo de ${vehicle.consumptionBase} L/100km, reduciendo el costo por kilómetro y rindiendo más de 800 km de autonomía en ruta continua.`;
    }
    return `Buen promedio de rendimiento en carretera con ${vehicle.consumptionBase} L/100km, completando el trayecto a ritmo sostenido de ${trapSpeed} km/h.`;
  }

  if (track.id === 'family_challenge') {
    if (vehicle.equipment?.seatingCapacity === 7) {
      return `Dominio familiar absoluto (7 plazas en 3 filas): la Carens transporta a toda la familia cómodamente con climatización trasera y sus 250 Nm de torque no se inmutan con 450 kg de carga.`;
    }
    return `Habitáculo compacto de 5 plazas: ágil para parejas o familias pequeñas, pero insuficiente para trasladar a 6 o 7 ocupantes simultáneamente.`;
  }

  if (track.id === 'smart_buy') {
    if (vehicle.equipment?.priceUsd && vehicle.equipment.priceUsd <= 20000) {
      return `La compra inteligente por precio: a US$ ${vehicle.equipment.priceUsd.toLocaleString()} ofrece un ahorro directo de hasta US$ 7.000 manteniendo motor turbo y conectividad OnStar Wi-Fi.`;
    }
    if (vehicle.equipment?.adasFeatures && vehicle.equipment.adasFeatures.length > 0) {
      return `Inversión orientada a la seguridad: el mayor valor agregado está en su suite ADAS con frenado autónomo y control crucero inteligente.`;
    }
    return `Propuesta de valor enfocada en versatilidad familiar y motor diésel de larga durabilidad.`;
  }

  return `Rendimiento global óptimo, combinando velocidad punta de ${trapSpeed} km/h y maniobrabilidad en sectores con ${vehicle.tireGrip}x de agarre mecánico.`;
}

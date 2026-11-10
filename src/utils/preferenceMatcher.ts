import { Vehicle, PreferenceWeights, VehicleMatchScore, VehicleRaceResult } from '../types/vehicle';

export function calculateVehicleScores(
  vehicle: Vehicle,
  allVehicles: Vehicle[],
  raceResult?: VehicleRaceResult
): {
  motorScore: number;
  seguridadScore: number;
  tecnologiaScore: number;
  economiaScore: number;
  matchReasons: string[];
} {
  const reasons: string[] = [];

  // 1. MOTOR & DESEMPEÑO (0 - 100)
  // Factores: Potencia HP, Par motor Nm, Rendimiento en subida/carga, Peso y Transmisión
  let motorPoints = 0;
  // Potencia
  if (vehicle.powerHp >= 120) motorPoints += 25;
  else if (vehicle.powerHp >= 115) motorPoints += 22;
  else motorPoints += 20;

  // Torque real a las ruedas
  if (vehicle.torqueNm >= 240) {
    motorPoints += 38; // Carens Turbo Diésel 250 Nm
    reasons.push('Mayor par motor del segmento (250 Nm Turbo Diésel) con empuje imparable bajo carga');
  } else if (vehicle.torqueNm >= 160) {
    motorPoints += 28; // Tracker 1.0T 160 Nm
    reasons.push('Excelente respuesta de torque en bajas RPM (160 Nm Turbo)');
  } else {
    motorPoints += 22; // Kicks 149 Nm atmosférico
    reasons.push('Motor 1.6L lineal y progresivo con 118 HP');
  }

  // Transmisión y agilidad
  if (vehicle.transmissionDescription.toLowerCase().includes('cvt')) {
    motorPoints += 20; // CVT suave y eficiente
  } else {
    motorPoints += 22; // Automática con convertidor de par y marchas fijas
  }

  // Desempeño en pista o peso pluma
  if (raceResult && raceResult.finishPosition === 1) {
    motorPoints += 15;
    reasons.push(`Ganador en pista con tiempo de ${raceResult.finishTimeSec.toFixed(2)}s`);
  } else if (vehicle.weightKg <= 1180) {
    motorPoints += 14; // Kicks ultraliviana
    reasons.push('Carrocería ultraliviana (1.142 kg) con excelente agilidad urbana');
  } else {
    motorPoints += 10;
  }
  const motorScore = Math.min(100, Math.max(30, motorPoints));

  // 2. SEGURIDAD (0 - 100)
  // Factores: Asistencias activas ADAS, Frenos (4 discos vs tambores), Airbags, Cámara
  let seguridadPoints = 35; // Base de 6 airbags de serie en todos
  if (vehicle.equipment.adasFeatures.length > 0) {
    seguridadPoints += 35; // Kicks paquete completo ADAS ProPILOT
    reasons.push('Exclusivo paquete de asistencias ADAS (Frenado autónomo de emergencia, Crucero inteligente, Alerta carril)');
  }
  if (vehicle.equipment.brakesType === '4_discs') {
    seguridadPoints += 18; // Kicks y Carens
    reasons.push('Frenos a disco ventilados en las 4 ruedas para frenadas más cortas y sin fatiga');
  } else {
    seguridadPoints += 6; // Tracker tambores traseros
  }
  if (vehicle.equipment.rearCamera) {
    seguridadPoints += 12; // Cámara de retroceso
  }
  const seguridadScore = Math.min(100, Math.max(25, seguridadPoints));

  // 3. HABITABILIDAD, CONFORT & TECNOLOGÍA (0 - 100)
  let techPoints = 15;
  // Pantalla multimedia
  if (vehicle.equipment.screenSize.includes('12.3')) {
    techPoints += 25;
    reasons.push('Pantalla panorámica de 12.3" con conectividad inalámbrica');
  } else if (vehicle.equipment.screenSize.includes('8')) {
    techPoints += 15;
  }

  // Conectividad Wi-Fi
  if (vehicle.equipment.connectivity.includes('Wi-Fi') || vehicle.equipment.connectivity.includes('OnStar')) {
    techPoints += 16;
    reasons.push('Conectividad OnStar con Wi-Fi Nativo para hasta 7 dispositivos');
  }

  // HABITABILIDAD FAMILIAR Y 7 PLAZAS (Factor clave e insustituible para familias numerosas)
  if (vehicle.equipment.seatingCapacity === 7) {
    techPoints += 55; // Ventaja colosal de Carens frente a rivales de 5 plazas
    reasons.push('Única con 3 filas de asientos para 7 pasajeros, climatizador con salidas en techo y posavasos térmicos');
  } else if (vehicle.equipment.trunkLiters >= 430) {
    techPoints += 15;
    reasons.push(`Baúl espacioso de ${vehicle.equipment.trunkLiters} Litros`);
  } else {
    techPoints += 10;
  }

  // Confort adicional (Autohold, etc.)
  if (vehicle.equipment.comfortFeatures.some((f) => f.includes('Autohold'))) {
    techPoints += 12;
    reasons.push('Freno de mano electrónico con función AutoHold');
  }
  const tecnologiaScore = Math.min(100, Math.max(25, techPoints));

  // 4. ECONOMÍA & PRECIO DE COMPRA (0 - 100)
  // Factores: Precio contado oficial y costo de combustible
  let ecoPoints = 0;
  // Precio contado oficial (Tracker US$ 19.990 vs Kicks US$ 24.990 vs Carens US$ 26.990)
  if (vehicle.equipment.priceUsd <= 20000) {
    ecoPoints += 65; // Tracker imbatible
    reasons.push(`Precio contado imbatible: US$ ${vehicle.equipment.priceUsd.toLocaleString()} (ahorro de hasta US$ 7.000 frente a rivales)`);
  } else if (vehicle.equipment.priceUsd <= 25000) {
    ecoPoints += 30;
  } else {
    ecoPoints += 20;
  }

  // Costo por km y consumo
  if (vehicle.fuelType === 'diesel') {
    ecoPoints += 35; // Carens diésel
    reasons.push('Motor Turbo Diésel con menor costo por kilómetro y más de 800 km de autonomía en ruta');
  } else if (vehicle.consumptionBase <= 6.3) {
    ecoPoints += 30; // Tracker 1.0T
    reasons.push(`Excelente rendimiento urbano (${vehicle.consumptionBase} L/100km)`);
  } else {
    ecoPoints += 24; // Kicks
  }
  const economiaScore = Math.min(100, Math.max(25, ecoPoints));

  return {
    motorScore,
    seguridadScore,
    tecnologiaScore,
    economiaScore,
    matchReasons: reasons,
  };
}

export function calculatePreferencesMatch(
  vehicles: Vehicle[],
  weights: PreferenceWeights,
  raceResults?: VehicleRaceResult[]
): VehicleMatchScore[] {
  const totalWeight = (weights.motor + weights.seguridad + weights.tecnologia + weights.economia) || 1;

  const scores: VehicleMatchScore[] = vehicles.map((v) => {
    const raceRes = raceResults?.find((r) => r.vehicle.id === v.id);
    const { motorScore, seguridadScore, tecnologiaScore, economiaScore, matchReasons } =
      calculateVehicleScores(v, vehicles, raceRes);

    // Suma ponderada normalizada
    const weightedSum =
      (motorScore * weights.motor +
       seguridadScore * weights.seguridad +
       tecnologiaScore * weights.tecnologia +
       economiaScore * weights.economia) / totalWeight;

    // Normalizado a porcentaje de afinidad realista (ej: 50% a 88%)
    const normalizedMatch = Math.round(weightedSum * 0.88);

    return {
      vehicleId: v.id,
      totalMatchPercent: normalizedMatch,
      motorScore,
      seguridadScore,
      tecnologiaScore,
      economiaScore,
      isBestMatch: false,
      matchReasons,
    };
  });

  // Determinar el de mayor afinidad
  let maxScore = -1;
  let bestIdx = 0;
  scores.forEach((s, idx) => {
    if (s.totalMatchPercent > maxScore) {
      maxScore = s.totalMatchPercent;
      bestIdx = idx;
    }
  });

  if (scores[bestIdx]) {
    scores[bestIdx].isBestMatch = true;
  }

  return scores;
}

export const PREFERENCE_PROFILES: Record<string, { label: string; weights: PreferenceWeights }> = {
  equilibrado: {
    label: 'EQUILIBRADO',
    weights: { motor: 50, seguridad: 50, tecnologia: 50, economia: 50 },
  },
  familiar: {
    label: 'FAMILIAR (7 PLAZAS)',
    weights: { motor: 20, seguridad: 45, tecnologia: 95, economia: 30 },
  },
  economico: {
    label: 'ECONÓMICO (PRECIO)',
    weights: { motor: 15, seguridad: 25, tecnologia: 15, economia: 95 },
  },
  tecnologia: {
    label: 'SEGURIDAD & ADAS',
    weights: { motor: 30, seguridad: 95, tecnologia: 75, economia: 20 },
  },
};

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

  // 1. MOTOR (0 - 100)
  // Factores: Potencia HP, Par motor Nm, Relación peso/potencia, Tipo de transmisión, Desempeño en pista
  let motorPoints = 0;
  // Potencia
  if (vehicle.powerHp >= 120) motorPoints += 30;
  else if (vehicle.powerHp >= 115) motorPoints += 26;
  else motorPoints += 22;

  // Torque
  if (vehicle.torqueNm >= 240) {
    motorPoints += 30; // Carens Turbo Diésel 250 Nm
    reasons.push('Mayor par motor del segmento (250 Nm Turbo Diésel)');
  } else if (vehicle.torqueNm >= 200) {
    motorPoints += 27; // Kicks 220 Nm
    reasons.push('Excelente entrega de par a 2500 RPM (220 Nm)');
  } else {
    motorPoints += 22; // Tracker 180 Nm
  }

  // Transmisión
  if (vehicle.transmissionDescription.toLowerCase().includes('doble embrague') || vehicle.transmissionDescription.includes('6DCT')) {
    motorPoints += 25; // Caja 6DCT rápida
    reasons.push('Caja automática 6DCT de doble embrague con cambios inmediatos');
  } else {
    motorPoints += 20; // Caja automática tradicional de 6 vel
  }

  // Relación peso potencia o aceleración en pista
  if (raceResult && raceResult.finishPosition === 1) {
    motorPoints += 15;
    reasons.push(`Ganador en pista con tiempo de ${raceResult.finishTimeSec.toFixed(2)}s`);
  } else if (vehicle.weightKg <= 1250) {
    motorPoints += 14; // Tracker liviano
  } else {
    motorPoints += 10;
  }
  const motorScore = Math.min(100, Math.max(30, motorPoints));

  // 2. SEGURIDAD (0 - 100)
  // Factores: Asistencias ADAS, Frenos (4 discos vs tambores traseros), Sensores, Cámaras
  let seguridadPoints = 30; // Base por 6 airbags en todos
  if (vehicle.equipment.adasFeatures.length > 0) {
    seguridadPoints += 45; // Paquete completo ADAS en Kicks
    reasons.push('Exclusivo paquete de asistencias ADAS (Frenado autónomo peatones, Control crucero inteligente, Alerta carril)');
  }
  if (vehicle.equipment.brakesType === '4_discs') {
    seguridadPoints += 15; // Kicks y Carens
  } else {
    seguridadPoints += 5; // Tracker tambores traseros
  }
  if (vehicle.equipment.rearCamera) {
    seguridadPoints += 10;
  }
  const seguridadScore = Math.min(100, Math.max(25, seguridadPoints));

  // 3. TECNOLOGÍA & CONFORT (0 - 100)
  let techPoints = 20;
  // Pantalla
  if (vehicle.equipment.screenSize.includes('12.3')) {
    techPoints += 30;
    reasons.push('Pantalla multimedia panorámica de 12.3" con CarPlay/Android Auto inalámbrico');
  } else if (vehicle.equipment.screenSize.includes('8')) {
    techPoints += 20;
  }

  // Conectividad Wi-Fi
  if (vehicle.equipment.connectivity.includes('Wi-Fi') || vehicle.equipment.connectivity.includes('OnStar')) {
    techPoints += 12;
    reasons.push('Conectividad OnStar con Wi-Fi Nativo');
  }

  // Capacidad de pasajeros o baulera
  if (vehicle.equipment.seatingCapacity === 7) {
    techPoints += 25;
    reasons.push('Exclusivo habitáculo de 3 filas de asientos para 7 pasajeros con posavasos térmicos');
  } else if (vehicle.equipment.trunkLiters >= 450) {
    techPoints += 20;
    reasons.push(`Mayor capacidad de baulera (${vehicle.equipment.trunkLiters} Litros)`);
  } else {
    techPoints += 12;
  }

  // Equipamiento confort (Autohold, smart key, etc.)
  if (vehicle.equipment.comfortFeatures.some((f) => f.includes('Autohold'))) {
    techPoints += 15;
  } else {
    techPoints += 10;
  }
  const tecnologiaScore = Math.min(100, Math.max(25, techPoints));

  // 4. ECONOMÍA (0 - 100)
  // Factores: Precio contado oficial, Consumo oficial, Tipo de combustible
  let ecoPoints = 0;
  // Precio contado (Tracker US$ 19.990 vs Kicks US$ 24.990 vs Carens US$ 26.990)
  if (vehicle.equipment.priceUsd <= 20000) {
    ecoPoints += 60; // Gran ventaja en precio
    reasons.push(`Precio contado imbatible: US$ ${vehicle.equipment.priceUsd.toLocaleString()} (ahorro de hasta US$ 7.000)`);
  } else if (vehicle.equipment.priceUsd <= 25000) {
    ecoPoints += 35;
  } else {
    ecoPoints += 25;
  }

  // Rendimiento de combustible
  if (vehicle.fuelType === 'diesel') {
    ecoPoints += 35;
    reasons.push('Motor Turbo Diésel con menor costo por kilómetro y máxima autonomía');
  } else if (vehicle.consumptionBase <= 6.5) {
    ecoPoints += 32;
    reasons.push(`Bajo consumo combinado de combustible (${vehicle.consumptionBase} L/100km)`);
  } else {
    ecoPoints += 25;
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

    // Normalizado al rango de afininidad visible (ej: 40% a 85% para mantener escala similar a captura)
    const normalizedMatch = Math.round(weightedSum * 0.85);

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
    label: 'FAMILIAR',
    weights: { motor: 35, seguridad: 90, tecnologia: 85, economia: 45 },
  },
  economico: {
    label: 'ECONÓMICO',
    weights: { motor: 30, seguridad: 40, tecnologia: 35, economia: 95 },
  },
  potencia: {
    label: 'POTENCIA',
    weights: { motor: 95, seguridad: 40, tecnologia: 40, economia: 25 },
  },
};

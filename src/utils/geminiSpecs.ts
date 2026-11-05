import { GoogleGenAI } from '@google/genai';
import { Vehicle } from '../types/vehicle';

export async function generateVehicleSpecsWithAI(vehicleNameQuery: string): Promise<Partial<Vehicle>> {
  const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
                 (import.meta as any).env?.VITE_GEMINI_API_KEY || '';

  if (!apiKey) {
    // Si no hay key configurada, retornamos una estimación heurística realista según el nombre
    return getHeuristicEstimate(vehicleNameQuery);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Actúa como un ingeniero automotriz y jefe técnico de homologación.
Proporciona la ficha técnica realista y precisa del vehículo: "${vehicleNameQuery}".
Responde EXCLUSIVAMENTE con un JSON válido sin markdown, sin backticks ni explicaciones, con la siguiente estructura exacta:
{
  "name": "nombre del modelo",
  "brand": "marca",
  "year": 2024,
  "category": "supercar" | "muscle" | "electric" | "heavy_truck" | "pickup" | "track_toy" | "hypercar" | "sedan",
  "color": "#hexColor",
  "powerHp": 500,
  "torqueNm": 600,
  "weightKg": 1500,
  "topSpeedKmh": 300,
  "accel0100": 3.5,
  "drivetrain": "AWD" | "RWD" | "FWD",
  "dragCoeff": 0.32,
  "frontalArea": 2.2,
  "fuelCapacityL": 65,
  "fuelType": "gasoline" | "diesel" | "electric" | "hybrid",
  "consumptionBase": 10.5,
  "consumptionRacing": 35.0,
  "maxPayloadKg": 450,
  "brakingDistance100": 31.5,
  "tireGrip": 1.25,
  "description": "breve resumen de 1 oración destacando sus fortalezas mecánicas"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text?.trim() || '';
    const cleanJson = text.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJson);
    return parsed;
  } catch (error) {
    console.warn('Error fetching specs with Gemini, using heuristic fallback:', error);
    return getHeuristicEstimate(vehicleNameQuery);
  }
}

function getHeuristicEstimate(query: string): Partial<Vehicle> {
  const q = query.toLowerCase();
  
  if (q.includes('truck') || q.includes('camion') || q.includes('diesel') || q.includes('f-') || q.includes('ram') || q.includes('scania') || q.includes('volvo fh')) {
    return {
      name: query,
      brand: 'Heavy Duty',
      year: 2024,
      category: 'heavy_truck',
      color: '#f59e0b',
      powerHp: 580,
      torqueNm: 2200,
      weightKg: 5200,
      topSpeedKmh: 155,
      accel0100: 8.5,
      drivetrain: 'AWD',
      dragCoeff: 0.58,
      frontalArea: 4.8,
      fuelCapacityL: 300,
      fuelType: 'diesel',
      consumptionBase: 24.0,
      consumptionRacing: 65.0,
      maxPayloadKg: 18000,
      brakingDistance100: 45.0,
      tireGrip: 0.95,
      description: 'Potente vehículo de transporte pesado con par masivo para pruebas de carga y arrastre.',
    };
  }

  if (q.includes('electric') || q.includes('tesla') || q.includes('lucid') || q.includes('taycan') || q.includes('ev') || q.includes('rimac')) {
    return {
      name: query,
      brand: 'EV Performance',
      year: 2024,
      category: 'electric',
      color: '#06b6d4',
      powerHp: 900,
      torqueNm: 1250,
      weightKg: 2100,
      topSpeedKmh: 310,
      accel0100: 2.3,
      drivetrain: 'AWD',
      dragCoeff: 0.22,
      frontalArea: 2.3,
      fuelCapacityL: 95,
      fuelType: 'electric',
      consumptionBase: 19.0,
      consumptionRacing: 58.0,
      maxPayloadKg: 400,
      brakingDistance100: 32.0,
      tireGrip: 1.20,
      description: 'Tracción integral eléctrica con entrega instantánea de par sin pérdidas por embrague.',
    };
  }

  // Superdeportivo por defecto
  return {
    name: query,
    brand: 'Sport Engineering',
    year: 2024,
    category: 'supercar',
    color: '#ef4444',
    powerHp: 650,
    torqueNm: 720,
    weightKg: 1480,
    topSpeedKmh: 330,
    accel0100: 3.1,
    drivetrain: 'AWD',
    dragCoeff: 0.31,
    frontalArea: 2.15,
    fuelCapacityL: 70,
    fuelType: 'gasoline',
    consumptionBase: 12.0,
    consumptionRacing: 40.0,
    maxPayloadKg: 300,
    brakingDistance100: 30.5,
    tireGrip: 1.30,
    description: 'Chasis deportivo de alto rendimiento optimizado para aceleración y velocidad punta.',
  };
}

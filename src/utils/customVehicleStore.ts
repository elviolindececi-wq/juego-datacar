import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DrivetrainType, FuelType, Vehicle, VehicleCategory } from '../types/vehicle.ts';
import {
  GENERIC_CUSTOM_CAR_PUBLIC_PATH,
  registerCustomVehicleGlbUrl,
  unregisterCustomVehicleGlbUrl,
} from './vehicle3DModelLoader.ts';

export const CUSTOM_VEHICLE_ID = 'custom-generic-car';
const CUSTOM_VEHICLE_STORAGE_KEY = 'datacar_arena_custom_vehicle_v1';
const CUSTOM_GLB_IDB_NAME = 'datacar_arena_custom_models_v1';
const CUSTOM_GLB_IDB_STORE = 'glb_files';

export interface CustomVehicleFormInput {
  name: string;
  trim: string;
  color: string;
  category: VehicleCategory;
  drivetrain: DrivetrainType;
  fuelType: FuelType;
  powerHp: number;
  torqueNm: number;
  weightKg: number;
  topSpeedKmh: number;
  accel0100: number;
  brakingDistance100: number;
  clearanceMm: number;
  seatingCapacity: number;
  absEnabled: boolean;
  adasBlindSpotEnabled: boolean;
  hasUploadedGlb?: boolean;
  uploadedGlbFileName?: string;
}

const DEFAULT_CUSTOM_INPUT: CustomVehicleFormInput = {
  name: 'MI AUTO GENÉRICO',
  trim: 'PROTOTIPO PERSONALIZADO',
  color: '#06b6d4',
  category: 'suv_compact',
  drivetrain: 'FWD',
  fuelType: 'gasoline',
  powerHp: 150,
  torqueNm: 220,
  weightKg: 1360,
  topSpeedKmh: 192,
  accel0100: 9.4,
  brakingDistance100: 38.5,
  clearanceMm: 185,
  seatingCapacity: 5,
  absEnabled: true,
  adasBlindSpotEnabled: true,
  hasUploadedGlb: false,
  uploadedGlbFileName: undefined,
};

/**
 * Genera una imagen PNG/SVG limpia de estudio (vista 3/4 lateral translúcida)
 * teñida exactamente con el color elegido por el usuario para usar en Garage y tarjetas sin usar 3D.
 */
export function renderGenericCarPngPreview(colorHex: string, label = 'GENÉRICO'): string {
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(colorHex) ? colorHex : '#06b6d4';
  const safeLabel = label.replace(/[<>&"']/g, '').slice(0, 18) || 'AUTO GENÉRICO';
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" width="800" height="420">
  <defs>
    <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${safeColor}" stop-opacity="1"/>
      <stop offset="55%" stop-color="${safeColor}" stop-opacity="0.88"/>
      <stop offset="100%" stop-color="#0b1526" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#bae6fd" stop-opacity="0.82"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95"/>
    </linearGradient>
    <radialGradient id="floorShadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.85"/>
      <stop offset="70%" stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="405" cy="355" rx="310" ry="34" fill="url(#floorShadow)"/>
  <!-- Carrocería SUV / Crossover Genérica -->
  <path d="M110 262 Q105 224 134 202 L226 184 L298 122 Q335 104 420 104 L548 112 Q606 122 652 178 L698 196 Q718 206 716 238 L708 268 Q690 278 666 278 L142 278 Q116 276 110 262 Z" fill="url(#bodyGrad)" stroke="#e2e8f0" stroke-opacity="0.45" stroke-width="3"/>
  <!-- Franja inferior protectora -->
  <path d="M126 266 L696 266 L686 286 L138 286 Z" fill="#1e293b"/>
  <!-- Techo vidriado y ventanillas -->
  <path d="M244 182 L310 124 L498 124 L596 178 Z" fill="url(#glassGrad)" stroke="#38bdf8" stroke-opacity="0.4" stroke-width="2"/>
  <rect x="404" y="122" width="12" height="58" rx="3" fill="#0f172a"/>
  <!-- Faros LED -->
  <path d="M640 194 L702 206 L690 222 L636 210 Z" fill="#e0f2fe"/>
  <path d="M116 212 L152 204 L148 224 L112 228 Z" fill="#fb7185"/>
  <!-- Placa lateral -->
  <rect x="332" y="218" width="150" height="26" rx="6" fill="#020617" fill-opacity="0.72" stroke="#38bdf8" stroke-opacity="0.55"/>
  <text x="407" y="236" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="800" letter-spacing="1.5" fill="#e0f2fe">${safeLabel}</text>
  <!-- Ruedas delanteras y traseras -->
  <g transform="translate(225,280)">
    <circle r="54" fill="#090d16" stroke="#334155" stroke-width="5"/>
    <circle r="35" fill="#1e293b" stroke="#94a3b8" stroke-width="3"/>
    <circle r="11" fill="#38bdf8"/>
  </g>
  <g transform="translate(592,280)">
    <circle r="54" fill="#090d16" stroke="#334155" stroke-width="5"/>
    <circle r="35" fill="#1e293b" stroke="#94a3b8" stroke-width="3"/>
    <circle r="11" fill="#38bdf8"/>
  </g>
</svg>`.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function buildVehicleFromCustomInput(input: CustomVehicleFormInput): Vehicle {
  const safeName = (input.name || 'MI AUTO GENÉRICO').trim().slice(0, 28) || 'MI AUTO GENÉRICO';
  const safeTrim = (input.trim || 'PROTOTIPO').trim().slice(0, 32);
  const clampedSeats = Math.max(2, Math.min(7, Math.round(input.seatingCapacity || 5)));
  const clampedPower = Math.max(70, Math.min(650, Math.round(input.powerHp || 150)));
  const clampedTorque = Math.max(95, Math.min(950, Math.round(input.torqueNm || 220)));
  const clampedWeight = Math.max(850, Math.min(2800, Math.round(input.weightKg || 1360)));
  const clampedTopSpeed = Math.max(130, Math.min(310, Math.round(input.topSpeedKmh || 192)));
  const clampedAccel = Math.max(3.2, Math.min(18.0, Number((input.accel0100 || 9.4).toFixed(1))));
  const clampedBraking = Math.max(30, Math.min(54, Number((input.brakingDistance100 || 38.5).toFixed(1))));
  const clampedClearance = Math.max(115, Math.min(265, Math.round(input.clearanceMm || 185)));
  const previewImg = renderGenericCarPngPreview(input.color, safeName);

  const adasList = input.adasBlindSpotEnabled
    ? ['Monitor de Punto Ciego (config. simulador)', 'Alerta de colisión frontal (config.)']
    : [];

  return {
    id: CUSTOM_VEHICLE_ID,
    name: safeName,
    brand: 'GENÉRICO',
    trim: safeTrim,
    year: 2026,
    category: input.category,
    color: input.color,
    imageUrl: previewImg,
    engineDescription:
      input.fuelType === 'electric'
        ? `Motor Eléctrico Personalizado (${clampedPower} HP)`
        : input.fuelType === 'hybrid'
          ? `Sistema Híbrido Personalizado (${clampedPower} HP)`
          : `Motor Personalizado (${clampedPower} HP / ${clampedTorque} Nm)`,
    transmissionDescription:
      input.fuelType === 'electric' ? 'Directa 1 velocidad' : 'Automática 6 marchas (simulada)',
    powerHp: clampedPower,
    torqueNm: clampedTorque,
    weightKg: clampedWeight,
    topSpeedKmh: clampedTopSpeed,
    accel0100: clampedAccel,
    drivetrain: input.drivetrain,
    dragCoeff: 0.33,
    frontalArea: 2.38,
    dimensions: {
      lengthMm: 4460,
      widthMm: 1825,
      heightMm: 1620,
      clearanceMm: clampedClearance,
    },
    fuelCapacityL: input.fuelType === 'electric' ? 62 : 52,
    fuelType: input.fuelType,
    fuelFeeding:
      input.fuelType === 'electric'
        ? 'Batería de tracción simulada'
        : input.fuelType === 'diesel'
          ? 'Turbo Diésel Common Rail (sim.)'
          : 'Inyección multipunto / turbo (sim.)',
    consumptionBase: input.fuelType === 'electric' ? 0 : input.fuelType === 'hybrid' ? 4.8 : 7.4,
    consumptionRacing: input.fuelType === 'electric' ? 0 : 14.2,
    maxPayloadKg: 480,
    brakingDistance100: clampedBraking,
    tireGrip: 0.96,
    equipment: {
      screenSize: '10.25" táctil',
      connectivity: 'Perfil genérico configurable',
      comfortFeatures: [`${clampedSeats} plazas configuradas`, 'Climatizador simulado'],
      adasFeatures: adasList,
      airbags: 6,
      rearCamera: true,
      brakesType: '4_discs',
      trunkLiters: 420,
      groundClearanceMm: clampedClearance,
      seatingCapacity: clampedSeats,
      priceUsd: 0,
      abs: input.absEnabled,
      safetySystems: {
        abs: input.absEnabled ? 'present' : 'absent',
        blindSpot: input.adasBlindSpotEnabled ? 'present' : 'unknown',
        aeb: input.adasBlindSpotEnabled ? 'present' : 'unknown',
        esc: 'present',
      },
    },
    description: `Vehículo genérico configurable por el usuario. Listo para correr y preparado para cargar modelo .glb propio (${GENERIC_CUSTOM_CAR_PUBLIC_PATH} o archivo local).`,
    estimatedSimulationParameters: true,
    isCustom: true,
    specEvidence: {
      status: 'partial-reference',
      sourceLabel: input.hasUploadedGlb && input.uploadedGlbFileName
        ? `Ficha personalizada · Modelo .glb: ${input.uploadedGlbFileName}`
        : `Ficha genérica personalizada · Slot listo: ${GENERIC_CUSTOM_CAR_PUBLIC_PATH}`,
    },
  };
}

export function createDefaultCustomVehicleInput(): CustomVehicleFormInput {
  return { ...DEFAULT_CUSTOM_INPUT };
}

export function loadStoredCustomVehicleInput(): CustomVehicleFormInput | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CUSTOM_VEHICLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomVehicleFormInput>;
    return { ...DEFAULT_CUSTOM_INPUT, ...parsed };
  } catch {
    return null;
  }
}

export function saveCustomVehicleInput(input: CustomVehicleFormInput): Vehicle {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CUSTOM_VEHICLE_STORAGE_KEY, JSON.stringify(input));
    } catch {
      // Ignore storage quota errors
    }
  }
  return buildVehicleFromCustomInput(input);
}

export function deleteStoredCustomVehicle(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CUSTOM_VEHICLE_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
  unregisterCustomVehicleGlbUrl(CUSTOM_VEHICLE_ID);
  void deleteCustomGlbFromIndexedDb();
}

function openCustomGlbDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(CUSTOM_GLB_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CUSTOM_GLB_IDB_STORE)) {
        db.createObjectStore(CUSTOM_GLB_IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomGlbFile(file: File): Promise<{ blobUrl: string; fileName: string }> {
  const buffer = await file.arrayBuffer();
  try {
    const db = await openCustomGlbDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CUSTOM_GLB_IDB_STORE, 'readwrite');
      tx.objectStore(CUSTOM_GLB_IDB_STORE).put({ name: file.name, buffer }, CUSTOM_VEHICLE_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Fallback to runtime blob URL only
  }
  const blobUrl = URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }));
  registerCustomVehicleGlbUrl(CUSTOM_VEHICLE_ID, blobUrl);
  return { blobUrl, fileName: file.name };
}

export async function hydrateCustomGlbFromIndexedDb(): Promise<string | null> {
  try {
    const db = await openCustomGlbDb();
    const record = await new Promise<{ name: string; buffer: ArrayBuffer } | undefined>((resolve, reject) => {
      const tx = db.transaction(CUSTOM_GLB_IDB_STORE, 'readonly');
      const req = tx.objectStore(CUSTOM_GLB_IDB_STORE).get(CUSTOM_VEHICLE_ID);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!record?.buffer) return null;
    const blobUrl = URL.createObjectURL(new Blob([record.buffer], { type: 'model/gltf-binary' }));
    registerCustomVehicleGlbUrl(CUSTOM_VEHICLE_ID, blobUrl);
    return record.name;
  } catch {
    return null;
  }
}

export async function deleteCustomGlbFromIndexedDb(): Promise<void> {
  try {
    const db = await openCustomGlbDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CUSTOM_GLB_IDB_STORE, 'readwrite');
      tx.objectStore(CUSTOM_GLB_IDB_STORE).delete(CUSTOM_VEHICLE_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}

export function useCustomVehicle() {
  const [customInput, setCustomInput] = useState<CustomVehicleFormInput | null>(() =>
    loadStoredCustomVehicleInput()
  );

  useEffect(() => {
    if (!customInput?.hasUploadedGlb) return;
    void hydrateCustomGlbFromIndexedDb();
  }, [customInput?.hasUploadedGlb]);

  const customVehicle = useMemo<Vehicle | null>(
    () => (customInput ? buildVehicleFromCustomInput(customInput) : null),
    [customInput],
  );

  const saveCustom = useCallback((nextInput: CustomVehicleFormInput): Vehicle => {
    const built = saveCustomVehicleInput(nextInput);
    setCustomInput({ ...nextInput });
    return built;
  }, []);

  const clearCustom = useCallback(() => {
    deleteStoredCustomVehicle();
    setCustomInput(null);
  }, []);

  return {
    customInput,
    customVehicle,
    saveCustom,
    clearCustom,
  };
}

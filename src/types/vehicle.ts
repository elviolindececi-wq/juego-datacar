export type DrivetrainType = 'AWD' | 'RWD' | 'FWD';
export type FuelType = 'gasoline' | 'diesel' | 'electric' | 'hybrid' | 'flex';
export type VehicleCategory = 'suv_compact' | 'suv_familiar' | 'supercar' | 'muscle' | 'electric' | 'heavy_truck' | 'pickup' | 'track_toy' | 'hypercar';

export interface VehicleEquipment {
  screenSize: string;
  connectivity: string;
  comfortFeatures: string[];
  adasFeatures: string[];
  airbags: number;
  rearCamera: boolean;
  brakesType: '4_discs' | 'front_disc_rear_drum';
  trunkLiters: number;
  groundClearanceMm: number;
  seatingCapacity: number;
  priceUsd: number;
  safetyFeatures?: string[];
  /** ABS confirmado en ficha. Sin valor: no verificado (no asumir false). */
  abs?: boolean;
  /** Matriz con evidencia por versión exacta. unknown NO implica ausencia. */
  safetySystems?: Partial<Record<import('../utils/vehicleSafetySystems.ts').SafetySystem, import('../utils/vehicleSafetySystems.ts').FeatureState>>;
}

export interface VehiclePhotoAngles {
  front: string;
  threeQuarterFront: string;
  side: string;
  threeQuarterRear: string;
  rear: string;
  topZenith: string;
}

export interface Vehicle360Config {
  videoUrl?: string;
  framesCount?: number;
  framesBaseUrl?: string;
  framesExtension?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  brand: string;
  trim?: string;
  year: number;
  category: VehicleCategory;
  color: string; // Hex color for livery in simulation
  imageUrl?: string;
  video360Url?: string;
  turntable360?: Vehicle360Config;
  photoAngles?: VehiclePhotoAngles;
  
  // Ficha Técnica - Motor & Potencia
  engineDescription: string;
  transmissionDescription: string;
  powerHp: number;           // Caballos de fuerza (HP)
  torqueNm: number;          // Torque motor (Nm)
  weightKg: number;          // Peso en vacío / Tara (kg)
  topSpeedKmh: number;       // Velocidad punta teórica (km/h)
  accel0100: number;         // Aceleración 0-100 km/h oficial (segundos)
  drivetrain: DrivetrainType;// AWD, RWD, FWD
  
  // Ficha Técnica - Aerodinámica & Dimensiones
  dragCoeff: number;         // Coeficiente aerodinámico Cx / Cd
  frontalArea: number;       // Área frontal en m²
  dimensions: {
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    clearanceMm: number;
  };
  
  // Ficha Técnica - Combustible & Eficiencia
  fuelCapacityL: number;     // Capacidad del tanque en Litros (o kWh)
  fuelType: FuelType;        // Tipo de combustible
  fuelFeeding: string;       // Inyección multipunto, Turbo directa, Turbo diésel
  consumptionBase: number;   // Consumo mixto oficial (L/100km)
  consumptionRacing: number; // Consumo bajo aceleración máxima WOT (L/100km)
  
  // Ficha Técnica - Carga & Frenado
  maxPayloadKg: number;      // Capacidad máxima de baulera / remolque (kg)
  brakingDistance100: number;// Frenado 100-0 km/h en metros
  tireGrip: number;          // Factor de agarre de neumáticos
  
  // Equipamiento detallado y comercial
  equipment: VehicleEquipment;
  
  description: string;
  /** Datos de simulación estimados; no presentarlos como prestaciones certificadas. */
  estimatedSimulationParameters?: boolean;
  /** Valores obligatorios para el solver pero no publicados en la ficha: NO son cifras oficiales. */
  estimatedFieldNames?: string[];
  hybridSystem?: {
    kind: 'self-charging-hev' | 'mild-12v';
    combustionHp?: number;
    combustionTorqueNm?: number;
    electricHp?: number;
    electricTorqueNm?: number;
    batteryKWh?: number;
    /** La ficha puede informar torque eléctrico sin indicar torque combinado. */
    torqueNmIsElectricOnly?: boolean;
  };
  technicalDetails?: {
    tireSize?: string;
    wheelDiameterInches?: number;
    engineDisplacementCc?: number;
    wheelbaseMm?: number;
    frontSuspension?: string;
    rearSuspension?: string;
    brakeDetails?: string;
  };
  /** Estado de auditoría del par año / motorización / versión. */
  specEvidence?: { status: 'exact-user-sheet' | 'exact-official' | 'partial-reference' | 'pending'; sourceLabel: string; sourceUrl?: string; notes?: string };
  isCustom?: boolean;
}

export interface PreferenceWeights {
  motor: number;      // 0 - 100 (default 50)
  seguridad: number;  // 0 - 100 (default 50)
  tecnologia: number; // 0 - 100 (default 50)
  economia: number;   // 0 - 100 (default 50)
}

export interface VehicleMatchScore {
  vehicleId: string;
  totalMatchPercent: number;
  motorScore: number;      // 0 - 100
  seguridadScore: number;  // 0 - 100
  tecnologiaScore: number; // 0 - 100
  economiaScore: number;   // 0 - 100
  isBestMatch: boolean;
  matchReasons: string[];
}

export type RaceMode = 
  | 'drag_quarter' 
  | 'drag_half' 
  | 'circuit' 
  | 'brake_slalom' 
  | 'load_hillclimb' 
  | 'endurance' 
  | 'fuel_critical'
  | 'family_challenge'
  | 'smart_buy'
  | 'route_500km';

export interface RaceTrackConfig {
  id: RaceMode;
  name: string;
  subtitle: string;
  distanceMeters: number;
  laps?: number;
  inclineGradePercent: number; // Inclinación en % (0% = plano, 10% = subida empinada)
  cargoPayloadKg: number;      // Carga adicional aplicada en kg
  initialFuelPercent?: number; // Nivel de combustible o batería al inicio (1% a 100%)
  description: string;
  imageBanner?: string;
  // Configuración lúdica de circuitos inspirados en Asunción (no datos viales en tiempo real).
  cityCircuitId?: string;
  routeHazardProfile?: 'craters' | 'chains' | 'trenches' | 'flood' | 'cobbles' | 'traffic';
  surfaceGripFactor?: number;
  surfaceRoughnessFactor?: number;
}

export interface SimulationTelemetrySample {
  timeSec: number;
  distanceMeters: number;
  speedKmh: number;
  accelerationG: number;
  fuelRemaining: number;       // Litros o kWh restantes
  fuelBurned: number;          // Litros o kWh consumidos
  powerDeliveredHp: number;
  aeroDragN: number;
  gear: number;
  rpm: number;
  pitStops: number;
  isBraking?: boolean;
  absActive?: boolean;
  tcsActive?: boolean;
  escActive?: boolean;
  aebActive?: boolean;
  fcwWarning?: boolean;
  laneDepartureWarning?: boolean;
  brakeIntensity?: number;
  brakeSlip?: number;
  /** Diagnóstico V8.9: magnitudes de modelo estimado, no ensayos de fabricante. */
  lateralAccelerationG?: number;
  tireGripUsage?: number;
  slipAngleDegrees?: number;
  normalLoadFrontN?: number;
  normalLoadRearN?: number;
  // Grabación de la trayectoria real para la repetición de Director TV.
  lateralX?: number;
  yawRad?: number;
  steerRad?: number;
  slip?: number;
  bump?: number;
  suspensionHeaveM?: number;
  suspensionPitchRad?: number;
  suspensionRollRad?: number;
  wheelRoadHeights?: { FL: number; FR: number; RL: number; RR: number };
  inCorner?: boolean;
  brakeTempC?: number;
  currentCornerRadiusM?: number;
  outOfFuel?: boolean;         // True si se quedó sin combustible / batería
}

export interface VehicleRaceResult {
  vehicle: Vehicle;
  finishPosition: number;
  finishTimeSec: number;
  gapSec: number;
  topSpeedAchievedKmh: number;
  trapSpeedKmh: number;
  time0to100: number | null;
  time0to200: number | null;
  time400m: number | null;
  fuelBurned: number;
  fuelRemaining: number;
  effectivePowerToWeight: number; // HP/Tonelada con la carga incluida
  effectiveWeightKg?: number;
  verdict: string;
  telemetryHistory: SimulationTelemetrySample[];
  /** Eventos reales de esta partida; sirven exclusivamente para Driving IQ. */
  drivingEvents?: import('../utils/drivingIQ.ts').DrivingEventStats;
  matchScore?: VehicleMatchScore;
  weightedOverallScore?: number;
  isDnf?: boolean;                // No completó la carrera (Did Not Finish)
  dnfReason?: string;             // Razón por la cual se quedó varado
}

export interface RaceState {
  isRunning: boolean;
  isPaused: boolean;
  isFinished: boolean;
  elapsedTimeSec: number;
  playbackSpeed: number; // 1x, 2x, 4x
  track: RaceTrackConfig;
  competitors: Vehicle[];
  currentTelemetry: Record<string, SimulationTelemetrySample>;
  results: VehicleRaceResult[];
}

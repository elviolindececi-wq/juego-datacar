/**
 * DATACAR ARENA – dinámica interactiva simplificada en el plano X/Z.
 * Paso fijo 100 Hz, fuerzas F=ma, neumáticos por eje con fricción combinada,
 * modelo bicicleta dinámico (yaw/lateral), colisiones de discos aproximados,
 * obstáculos sólidos, baches con menor agarre y bots con anticipación.
 * Es un modelo jugable aproximado; no sustituye un solver de neumáticos/rigid bodies 3D.
 * Sistema global: avance +Z, derecha vista de persecución = -X.
 */
import type { Vehicle, RaceTrackConfig, VehicleRaceResult, SimulationTelemetrySample } from '../types/vehicle';
import { getAsuncionStreetDetails } from './asuncionStreetData.ts';
import type { SpeedBump } from './asuncionStreetData.ts';
import { WEATHER_CONFIG, getWaterZones, waterContact } from './weatherDynamics.ts';
import type { WeatherMode, WaterZone } from './weatherDynamics.ts';
import { FourCornerSuspension } from './roadSuspension.ts';
import type { SuspensionPose } from './roadSuspension.ts';
import { powertrainProfile, estimatedRpm, integrateTurbo, torqueAvailability, coastEngineBrake } from './powertrainDynamics.ts';
import { brakingResponse } from './brakingDynamics.ts';
import { getVehicleDynamicsProfile, tractionForceFromSpec } from './vehicleDynamicsProfile.ts';
import { integrateBicycle } from './advancedVehicleDynamics.ts';
import { assessAeb, safetyDriveModifiers, hasVerifiedSystem } from './vehicleSafetySystems.ts';
import { makeRoadPath, type CurvedRoadPath } from './curvedRoadPath.ts';
import { emptyDrivingEvents, type DrivingEventStats } from './drivingIQ.ts';
import {
  DOUBLE_YELLOW_X,
  FORWARD_LANE_OPTIONS,
  URBAN_HALF_WIDTH,
  buildSpeedLimitZones,
  buildTrafficLights,
  createOncomingTrafficPool,
  evaluateBlindSpotFlanks,
  evaluateCrosswalkPedestrians,
  findUpcomingTrafficLight,
  getActiveSpeedLimitZone,
  getTrafficLightState,
  stepOncomingTraffic,
  type BlindSpotFlankState,
  type CrosswalkPedestrianState,
  type OncomingTrafficCar,
  type SpeedLimitZone,
  type TrafficLightNode,
  type TrafficRuleNotice,
  type WetSplashEvent,
} from './urbanTrafficRules.ts';
import {
  computeCentralMedianSpans,
  resolveCentralMedianCollision,
  shouldBuildCentralMedian,
  type MedianSpanSegment,
} from './centralMedianCollision.ts';

const GRAVITY = 9.80665;
const AIR_DENSITY = 1.225;
export const PHYSICS_STEP = 0.01;
export const TRACK_HALF_WIDTH = 7;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const expFollow = (current: number, target: number, speed: number, dt: number) => current + (target - current) * (1 - Math.exp(-speed * dt));

export type HazardKind = 'pothole' | 'barrier';
export interface TrackHazard {
  id: number;
  kind: HazardKind;
  x: number;
  z: number;
  radius: number;
}
export interface PlayerInput {
  steer: number; // -1 izquierda de pantalla; +1 derecha de pantalla
  throttle: number;
  brake: number;
  reverse?: number; // ↓/S: frena primero y, detenido, engrana marcha atrás
}
export interface DynamicCar {
  id: string;
  vehicle: Vehicle;
  x: number;
  z: number;
  yaw: number;
  speed: number;   // velocidad longitudinal, m/s
  lateralSpeed: number; // m/s, desplazamiento hacia el lado derecho local
  yawRate: number;
  lateralAccelMps2: number; // aceleración lateral de modelo de neumáticos/ejes
  tyreGripUse: number; // 0..1, combinado longitudinal/lateral
  frontNormalN: number; rearNormalN: number;
  sideSlipRad: number;
  steer: number; // radián en sistema mundial; hacia -X es negativo
  acceleration: number;
  turboBoost: number; // 0..1; cero en motores aspirados
  effectiveThrottle: number; // respuesta progresiva del pedal según ficha y masa
  batterySoc: number; // 0..1; estado estimado de híbridos, NO SOC real del fabricante
  engineRpm: number;
  deliveredPowerHp: number;
  braking: boolean;
  brakeIntensity: number;
  absActive: boolean;
  brakeSlip: number;
  wheelLock: number;
  tcsActive: boolean;
  escActive: boolean;
  aebActive: boolean;
  fcwWarning: boolean;
  laneDepartureWarning: boolean;
  hillHoldRemaining: number;
  slip: number;
  pothole: boolean;
  bump: number;
  suspension: SuspensionPose;
  speedBumpActiveId: string | null;
  damage: number;
  impacts: number;
  drivingEvents: DrivingEventStats;
  previousPothole: boolean;
  previousWater: boolean;
  previousLossOfControl: boolean;
  previousAbs: boolean;
  previousTcs: boolean;
  previousEsc: boolean;
  previousAeb: boolean;
  bestSpeed: number;
  finishedAt: number | null;
  laneX: number;
  aiTargetX: number;
  aiAvoidUntilZ: number;
  aiStationarySeconds: number;
  aiRecoverySeconds: number;
  history: SimulationTelemetrySample[];
}

export interface InteractivePhysicsOptions {
  urbanTrafficRules?: boolean;
  speedRaceMode?: boolean;
  playerPayloadKg?: number;
}

export interface PedestrianArrestIncident {
  x: number;
  z: number;
  timeSec: number;
  label: string;
}

export class InteractiveRacePhysics {
  public readonly cars: DynamicCar[];
  public hazards: TrackHazard[] = [];
  public readonly speedBumps: SpeedBump[];
  public readonly urbanRulesEnabled: boolean;
  public readonly speedRaceMode: boolean;
  public readonly playerPayloadKg?: number;
  public readonly medianSpans: MedianSpanSegment[];
  public readonly roadHalfWidth: number;
  public readonly trafficLights: TrafficLightNode[];
  public readonly speedZones: SpeedLimitZone[];
  public readonly oncomingCars: OncomingTrafficCar[];
  public seatbeltBuckled = false;
  public lastTrafficNotice: TrafficRuleNotice | null = null;
  public lastWetSplash: WetSplashEvent | null = null;
  public pedestrianArrest: PedestrianArrestIncident | null = null;
  private crosswalkPedScratch: CrosswalkPedestrianState[] = [];
  private noticeSeq = 0;
  private splashSeq = 0;
  private lastMedianNoticeAt = -99;
  private seatbeltReminderSent = false;
  private seatbeltPenaltyApplied = false;
  private unbuckledMovingSec = 0;
  private penalizedRedLights = new Set<string>();
  private overspeedSec = 0;
  private underspeedSec = 0;
  private wrongWaySec = 0;
  private lastSpeedPenaltyAt = -99;
  private lastWrongWayPenaltyAt = -99;
  private prevPlayerZ = 0;
  public time = 0;
  public playerId: string;
  private nextHazardId = 1;
  private track: RaceTrackConfig;
  public readonly roadPath: CurvedRoadPath;
  private suspensionSolvers = new Map<string, FourCornerSuspension>();
  private lastTelemetryTime = -1;
  public surfaceEvents = 0;
  public weather: WeatherMode = 'sunny';
  public waterZones: WaterZone[] = [];
  public waterEvents = 0;

  setWeather(mode: WeatherMode) {
    this.weather = mode;
    this.waterZones = this.speedRaceMode
      ? []
      : getWaterZones(mode, this.track.distanceMeters, this.track.routeHazardProfile);
  }

  setSeatbeltBuckled(buckled: boolean) {
    if (this.seatbeltBuckled === buckled) return;
    this.seatbeltBuckled = buckled;
    if (buckled) {
      this.unbuckledMovingSec = 0;
      this.pushNotice('ok', 'seatbelt_ok', '✓ CINTURÓN ABROCHADO', 'Conducción segura activada · sin penalización', 0);
    }
  }

  private pushNotice(
    kind: TrafficRuleNotice['kind'],
    code: TrafficRuleNotice['code'],
    title: string,
    subtitle: string,
    pointsDelta: number,
  ) {
    this.lastTrafficNotice = {
      seq: ++this.noticeSeq,
      kind,
      code,
      title,
      subtitle,
      pointsDelta,
      createdAtSec: this.time,
    };
  }

  getBlindSpotState(vehicleId = this.playerId): BlindSpotFlankState {
    const own = this.getCar(vehicleId);
    if (!own) {
      return { equipped: false, leftAlert: false, rightAlert: false, leftDistanceM: null, rightDistanceM: null };
    }
    return evaluateBlindSpotFlanks(
      own.vehicle,
      own.x,
      own.z,
      this.cars,
      this.oncomingCars,
      own.id,
    );
  }

  getActiveSpeedZone(z: number): SpeedLimitZone {
    return getActiveSpeedLimitZone(this.speedZones, z);
  }

  getUpcomingTrafficLight(z: number, lookaheadM = 135) {
    return findUpcomingTrafficLight(this.trafficLights, z, this.time, lookaheadM);
  }

  constructor(
    vehicles: Vehicle[],
    track: RaceTrackConfig,
    playerId: string,
    seedHazards = true,
    options?: InteractivePhysicsOptions,
  ) {
    this.track = track;
    this.roadPath = makeRoadPath(track);
    this.playerId = playerId;
    this.playerPayloadKg =
      typeof options?.playerPayloadKg === 'number' && Number.isFinite(options.playerPayloadKg)
        ? Math.max(0, options.playerPayloadKg)
        : undefined;
    this.speedRaceMode = Boolean(options?.speedRaceMode);
    this.urbanRulesEnabled = !this.speedRaceMode && Boolean(options?.urbanTrafficRules);
    this.roadHalfWidth =
      this.urbanRulesEnabled || this.speedRaceMode ? URBAN_HALF_WIDTH : TRACK_HALF_WIDTH;
    this.trafficLights = this.urbanRulesEnabled ? buildTrafficLights(track) : [];
    this.speedZones = this.urbanRulesEnabled ? buildSpeedLimitZones(track) : [];
    this.oncomingCars = this.urbanRulesEnabled ? createOncomingTrafficPool(track) : [];
    this.speedBumps =
      !this.speedRaceMode && track.cityCircuitId
        ? getAsuncionStreetDetails(track.routeHazardProfile, track.distanceMeters).speedBumps
        : [];
    const streetCrossings = track.cityCircuitId
      ? getAsuncionStreetDetails(track.routeHazardProfile, track.distanceMeters).crossings.map((c) => c.z)
      : [];
    this.medianSpans = shouldBuildCentralMedian({
      roadWidthM: this.roadHalfWidth * 2,
      trackDistanceMeters: track.distanceMeters,
      cityCircuitId: track.cityCircuitId,
      routeHazardProfile: track.routeHazardProfile,
      isDragStrip: !track.cityCircuitId || this.speedRaceMode,
    })
      ? computeCentralMedianSpans({
          trackDistanceMeters: track.distanceMeters,
          lights: this.trafficLights,
          crossingZs: streetCrossings,
        })
      : [];
    const laneWidth = 3.6;
    const offset = (vehicles.length - 1) * laneWidth * 0.5;
    // En modo urbano de doble mano ancha (21 m), la grilla ocupa los carriles derechos (-9.5 .. -1.5).
    // En Fase 2 (Velocidad Pura sin obstáculos), los competidores ocupan toda la pista ancha de 21 m.
    const urbanStartSlots = [-4.6, -7.8, -1.8, -9.0];
    const speedProStartSlots = [0.0, -3.8, 3.8, -7.4, 7.4];
    this.cars = vehicles.map((v, i) => {
      const startX = this.speedRaceMode
        ? speedProStartSlots[i % speedProStartSlots.length]
        : this.urbanRulesEnabled
          ? urbanStartSlots[i % urbanStartSlots.length]
          : i * laneWidth - offset;
      return {
        id: v.id, vehicle: v,
        x: startX, z: 0, yaw: 0, speed: 0, lateralSpeed: 0,
        yawRate: 0, lateralAccelMps2: 0, tyreGripUse: 0, frontNormalN: 0, rearNormalN: 0, sideSlipRad: 0, steer: 0, acceleration: 0, turboBoost: 0, effectiveThrottle:0, batterySoc:.68, engineRpm: 850, deliveredPowerHp: 0, braking: false, brakeIntensity: 0, absActive: false, brakeSlip: 0, wheelLock: 0, tcsActive:false, escActive:false, aebActive:false, fcwWarning:false, laneDepartureWarning:false, hillHoldRemaining:0, slip: 0,
        pothole: false, bump: 0, suspension: new FourCornerSuspension().pose, speedBumpActiveId: null, damage: 0, impacts: 0, drivingEvents: emptyDrivingEvents(),
        previousPothole:false, previousWater:false, previousLossOfControl:false,
        previousAbs:false, previousTcs:false, previousEsc:false, previousAeb:false,
        bestSpeed: 0,
        finishedAt: null, laneX: startX,
        aiTargetX: startX, aiAvoidUntilZ: 0, aiStationarySeconds:0, aiRecoverySeconds:0, history: [],
      };
    });
    for (const car of this.cars) this.suspensionSolvers.set(car.id, new FourCornerSuspension());
    const maxSeedDist = track.cityCircuitId ? 7800 : 3500;
    if (!this.speedRaceMode && seedHazards && track.distanceMeters <= maxSeedDist) {
      this.populateHazards();
    }
    this.recordTelemetry();
  }

  addHazard(kind: HazardKind, x: number, z: number): TrackHazard | null {
    if (z <= 12 || z >= this.track.distanceMeters - 10) return null;
    const radius = kind === 'pothole' ? 1.12 : 0.83;
    const minRightHandX = this.urbanRulesEnabled ? -(this.roadHalfWidth - 1.35) : -5.7;
    const maxRightHandX = this.urbanRulesEnabled ? -0.95 : 5.7;
    const next: TrackHazard = { id: this.nextHazardId++, kind, x: clamp(x, minRightHandX, maxRightHandX), z, radius };
    // No crear piezas superpuestas entre sí ni sobre líneas de detención de semáforo.
    if (this.hazards.some(h => Math.hypot(h.x - next.x, h.z - next.z) < h.radius + radius + 2)) return null;
    if (this.speedBumps.some(b => Math.abs(b.z - z) < 4)) return null;
    if (this.trafficLights.some(tl => Math.abs((tl.z - 5.5) - z) < 15)) return null;
    this.hazards.push(next);
    return next;
  }

  private populateHazards() {
    const max = this.track.distanceMeters;
    const laps = Math.max(1, this.track.laps ?? 1);
    const profile = this.track.routeHazardProfile;
    const config = {
      craters: { spacing: 34, barrierEvery: 5, xShift: 1 },
      chains: { spacing: 33, barrierEvery: 6, xShift: 2 },
      trenches: { spacing: 47, barrierEvery: 3, xShift: 3 },
      flood: { spacing: 44, barrierEvery: 7, xShift: 4 },
      cobbles: { spacing: 56, barrierEvery: 5, xShift: 1 },
      traffic: { spacing: 105, barrierEvery: 1, xShift: 2 },
    }[profile || 'chains'];
    const number = Math.min(24 * laps, Math.max(2, Math.floor((max - 60) / config.spacing)));
    const spacing = (max - 80) / number;
    const xs = this.urbanRulesEnabled
      ? [-8.2, -5.6, -3.1, -1.45, -6.9]
      : [-3.6, 0, 3.6, -1.8, 1.8];
    for (let i = 0; i < number; i++) {
      const z = 40 + i * spacing;
      if (z >= max - 14) break;
      const kind: HazardKind = (i + 1) % config.barrierEvery === 0 ? 'barrier' : 'pothole';
      this.addHazard(kind, xs[(i * 3 + config.xShift) % xs.length], z);
    }
  }

  clearHazards() { this.hazards = []; }

  restoreHazards(hazards: TrackHazard[]) {
    this.hazards = hazards.map(h => ({ ...h }));
    this.nextHazardId = Math.max(0, ...this.hazards.map(h => h.id)) + 1;
  }

  /** IA anticipatoria: busca un corredor lateral libre y frena si no lo encuentra. */
  private controlAI(car: DynamicCar): PlayerInput {
    // Tras un atasco real, el rival engrana reversa; no se teletransporta ni ignora barreras.
    if (car.aiRecoverySeconds > 0) {
      return {steer: car.aiTargetX > car.x ? -0.45 : 0.45, throttle:0, brake:0, reverse: .72};
    }
    // MODALIDAD FASE 2 · VELOCIDAD PURA SIN OBSTÁCULOS: Competidores IA Élite (conducción de precisión al límite sin derrapar)
    if (this.speedRaceMode) {
      const proLanes = [-7.6, -5.1, -2.55, 0.0, 2.55, 5.1, 7.6] as const;
      const nearbyPro = this.cars.filter(
        other => other !== car && other.finishedAt === null && other.z > car.z - 4 && other.z < car.z + 58,
      );
      const upcomingCurv = this.roadPath.curvature(car.z + Math.max(18, car.speed * 0.95));
      const idealApexX = clamp(upcomingCurv * 240, -4.8, 4.8);

      let proBestX = car.aiTargetX;
      let proBestScore = Infinity;
      for (const lx of proLanes) {
        let sc =
          Math.abs(lx - idealApexX) * 0.22 +
          Math.abs(lx - car.aiTargetX) * 0.42 +
          Math.abs(lx - car.laneX) * 0.14;
        for (const other of nearbyPro) {
          const dz = other.z - car.z;
          const lateralGap = Math.abs(lx - other.x);
          if (dz >= -3.0 && dz < 38 && lateralGap < 2.55) {
            const speedDiff = Math.max(0.5, car.speed - other.speed + 4.0);
            sc += (340 * (1 + speedDiff * 0.08)) / (1 + Math.max(0, dz) * 0.055);
          }
        }
        if (sc < proBestScore) {
          proBestScore = sc;
          proBestX = lx;
        }
      }

      const urgentBlocked = nearbyPro.some(
        o => o.z > car.z && o.z - car.z < 18 && Math.abs(o.x - car.aiTargetX) < 2.25 && car.speed > o.speed - 0.5,
      );
      if (car.z > car.aiAvoidUntilZ || urgentBlocked) {
        car.aiTargetX = proBestX;
        car.aiAvoidUntilZ = car.z + Math.max(18, car.speed * 0.85);
      }

      const proProfile = getVehicleDynamicsProfile(car.vehicle, this.track.cargoPayloadKg, car.speed);
      const lookDist = Math.max(12, Math.abs(car.speed) * 0.72);
      const desiredYaw = Math.atan2(car.aiTargetX - car.x, lookDist);
      const yawErr = clamp(desiredYaw - car.yaw, -0.26, 0.26);
      const curNow = this.roadPath.curvature(car.z);
      const ffCurv =
        Math.atan(proProfile.wheelbaseM * curNow) /
        Math.max(0.12, proProfile.maxSteerRad);
      const yawDamp = -car.yawRate * 0.16;
      const proSteer = clamp(
        ffCurv + (yawErr * 3.4 / Math.max(6.5, Math.abs(car.speed) * 0.48)) / 0.42 + yawDamp,
        -0.78,
        0.78,
      );

      const cornerCurvAhead = Math.max(
        Math.abs(curNow),
        Math.abs(this.roadPath.curvature(car.z + Math.max(14, car.speed * 0.65))),
        Math.abs(this.roadPath.curvature(car.z + Math.max(28, car.speed * 1.25))),
      );
      const latAccelDemand = car.speed * car.speed * cornerCurvAhead;
      const maxTireLatAccel = GRAVITY * (car.vehicle.tireGrip || 1.02) * 0.92;

      const boxedIn = nearbyPro.some(
        o => o.z > car.z && o.z - car.z < 4.5 && Math.abs(o.x - car.x) < 1.9 && car.speed > o.speed + 2.2,
      );

      let proThrottle = 1.0;
      let proBrake = 0;
      if (boxedIn) {
        proThrottle = 0.35;
        proBrake = 0.28;
      } else if (latAccelDemand > maxTireLatAccel * 0.96) {
        proThrottle = 0.32;
        proBrake = clamp((latAccelDemand - maxTireLatAccel * 0.92) / 14, 0.08, 0.36);
      } else if (latAccelDemand > maxTireLatAccel * 0.82) {
        proThrottle = 0.82;
      }

      return {
        steer: -proSteer,
        throttle: proThrottle,
        brake: proBrake,
      };
    }

    const lookAhead = clamp(25 + Math.abs(car.speed) * 2.7, 32, 125);
    const upcoming = this.hazards.filter(h => h.z > car.z - 3 && h.z < car.z + lookAhead);
    const nearbyCars = this.cars.filter(other => other !== car && other.finishedAt === null &&
      other.z > car.z - 3 && other.z < car.z + lookAhead);
    const options: readonly number[] = this.urbanRulesEnabled
      ? FORWARD_LANE_OPTIONS
      : [-5.0, -3.6, -1.6, 0, 1.6, 3.6, 5.0];
    let bestX = car.laneX;
    let bestScore = Infinity;
    for (const x of options) {
      let score = Math.abs(x - car.laneX) * 0.38 + Math.abs(x - car.aiTargetX) * 0.12;
      for (const h of upcoming) {
        const distZ = Math.max(0, h.z - car.z);
        const laneGap = Math.abs(x - h.x);
        const clearance = h.radius + 1.05;
        if (laneGap < clearance + 0.4) score += (h.kind === 'barrier' ? 450 : 260) / (1 + distZ * 0.04);
      }
      for (const other of nearbyCars) {
        const distZ = Math.max(0, other.z - car.z);
        if (Math.abs(x - other.x) < 2.35) score += 260 / (1 + distZ * 0.05);
      }
      // Los rivales intentan evitar charcos donde existe otro corredor libre.
      for (const water of this.waterZones) {
        const ahead = water.z - car.z;
        if (ahead < 0 || ahead > lookAhead) continue;
        if (Math.abs(x - water.x) < water.radiusX + .3) {
          score += (this.weather === 'flood' ? 65 : 25) / (1 + ahead * .07);
        }
      }
      if (score < bestScore) { bestScore = score; bestX = x; }
    }
    // Planificación con histéresis; evita zigzags ante cada frame.
    if (car.z > car.aiAvoidUntilZ || Math.abs(bestX - car.aiTargetX) > 0.4 && bestScore < 10) {
      car.aiTargetX = bestX;
      car.aiAvoidUntilZ = car.z + Math.max(7, car.speed * 0.30);
    }
    const desiredHeading = Math.atan2(car.aiTargetX - car.x, Math.max(7, Math.abs(car.speed) * .43));
    const headingError = clamp(desiredHeading - car.yaw, -0.35, 0.35);
    // Feed-forward por la curvatura física + corrección de carril.
    const profile = getVehicleDynamicsProfile(car.vehicle, this.track.cargoPayloadKg, car.speed);
    const curveFeedForward = Math.atan(profile.wheelbaseM * this.roadPath.curvature(car.z)) /
      Math.max(.12, profile.maxSteerRad);
    const steer = clamp(curveFeedForward +
      (headingError * 4.2 / Math.max(5, Math.abs(car.speed) * 0.37)) / 0.42, -1, 1);

    // Respeto estricto de semáforos y límites de velocidad por los rivales IA en modo urbano
    let redLightHold = false;
    let redLightBrake = 0;
    let speedLimitThrottleCap = .92;
    let speedLimitBrake = 0;
    if (this.urbanRulesEnabled) {
      const nextLight = findUpcomingTrafficLight(this.trafficLights, car.z, this.time, 62);
      if (nextLight && nextLight.phase !== 'green' && nextLight.distanceToStopM >= -1.2) {
        const dist = Math.max(0, nextLight.distanceToStopM - 1.2);
        if (dist <= 2.4) {
          redLightHold = true;
          redLightBrake = car.speed > 0.15 ? 0.92 : 0.55;
        } else {
          const safeSpeedMps = Math.sqrt(2 * 4.5 * dist);
          if (car.speed > safeSpeedMps) {
            redLightHold = true;
            redLightBrake = clamp((car.speed - safeSpeedMps) / 8 + 0.35, 0.32, 0.95);
          } else if (nextLight.phase === 'red' && dist < 14) {
            speedLimitThrottleCap = 0.18;
          }
        }
      }
      const zone = getActiveSpeedLimitZone(this.speedZones, car.z);
      const kmh = Math.abs(car.speed) * 3.6;
      if (kmh > zone.maxKmh - 1.0) {
        speedLimitThrottleCap = 0;
        if (kmh > zone.maxKmh + 2.0) {
          speedLimitBrake = clamp((kmh - zone.maxKmh) / 28, 0.14, 0.55);
        }
      } else if (kmh > zone.maxKmh - 6) {
        speedLimitThrottleCap = Math.min(speedLimitThrottleCap, 0.42);
      }
    }

    const nearSolidObstacle = upcoming.some(h => h.kind === 'barrier' &&
      h.z > car.z && h.z - car.z < Math.max(20, Math.abs(car.speed) * 1.9) &&
      Math.abs(h.x - car.x) < h.radius + car.vehicle.dimensions.widthMm / 2000 + .7);
    const unavoidablePothole = upcoming.some(h => h.kind === 'pothole' &&
      h.z > car.z && h.z - car.z < Math.max(14, Math.abs(car.speed) * 1.75) &&
      Math.abs(h.x - car.x) < h.radius + car.vehicle.dimensions.widthMm / 2000 + .3);
    const nearSpeedBump = this.speedBumps.some(b => b.z > car.z && b.z - car.z < Math.max(12, car.speed * 1.4) && car.speed * 3.6 > 28);
    const approachingWater = this.waterZones.some(w => w.z > car.z && w.z - car.z < Math.max(14, car.speed * 1.5) && Math.abs(car.x - w.x) < w.radiusX + 1);
    const wetSlowdown = approachingWater && car.speed * 3.6 > (this.weather === 'flood' ? 28 : 52);
    const threat = upcoming.some(h => h.kind === 'barrier' && h.z - car.z < Math.max(10, car.speed * 1.0) &&
      Math.abs(h.x - car.x) < h.radius + 1.15) || nearbyCars.some(o => o.z - car.z < Math.max(10, car.speed * 0.65) && Math.abs(o.x - car.x) < 2.15);

    const baseThrottle = redLightHold
      ? 0
      : threat || nearSolidObstacle
        ? .05
        : unavoidablePothole
          ? .20
          : nearSpeedBump
            ? .25
            : wetSlowdown
              ? .30
              : speedLimitThrottleCap;
    const baseBrake = Math.max(
      redLightBrake,
      speedLimitBrake,
      threat || nearSolidObstacle ? .68 : unavoidablePothole ? .48 : nearSpeedBump ? .27 : wetSlowdown ? .24 : 0,
    );
    return {
      steer: -steer,
      throttle: Math.min(baseThrottle, speedLimitThrottleCap),
      brake: baseBrake,
    };
  }

  private integrateCar(car: DynamicCar, input: PlayerInput, dt: number) {
    if (car.finishedAt !== null) {
      // Cruzar la línea no congela instantáneamente la carrocería.
      car.z += car.speed * dt;
      car.speed *= Math.exp(-.9 * dt);
      return;
    }
    const v = car.vehicle;
    const activePayloadKg =
      car.id === this.playerId && this.playerPayloadKg !== undefined
        ? this.playerPayloadKg
        : this.track.cargoPayloadKg;
    const profile = getVehicleDynamicsProfile(v, activePayloadKg, car.speed);
    const mass = profile.massKg;
    // Relieve transversal: lomo de burro suave, independiente de los baches.
    // Penalización UNA VEZ por cruce; no reduce la velocidad indefinidamente.
    const currentBump = this.speedBumps.find(b => Math.abs(car.z - b.z) <= (b.length * .5 + .25));
    if (currentBump?.id !== car.speedBumpActiveId) {
      car.speedBumpActiveId = currentBump?.id ?? null;
      if (currentBump) {
        const absoluteKmh = Math.abs(car.speed) * 3.6;
        if (absoluteKmh > 32) car.drivingEvents.speedBumpsTooFast++;
        if (absoluteKmh > 22) {
          const severity = clamp((absoluteKmh - 22) / 80, 0, 1);
          car.speed *= 1 - severity * .20;
          this.surfaceEvents++;
        }
        // El golpe se calcula físicamente por compresión de suspensión.
        // El exceso de velocidad también penaliza levemente la integridad.
        if (absoluteKmh > 65) car.damage = clamp(car.damage + (absoluteKmh - 65) / 7000, 0, 1);
        car.bump = Math.max(car.bump, .25 + clamp(absoluteKmh / 130, 0, .45));
      }
    }
    const onSpeedBump = Boolean(currentBump);
    const speed = car.speed; // con signo: + adelante, - marcha atrás
    const water = waterContact(this.waterZones, car.x, car.z);
    if (water.immersion > .35) this.waterEvents++; // contacto real de agua
    const insideWater = water.immersion > .35;
    const enteringWater = insideWater && !car.previousWater;
    if (enteringWater) car.drivingEvents.waterEntries++;
    car.previousWater = insideWater;
    const hydroplane = Math.min(.65, water.immersion * Math.max(0, (Math.abs(speed) * 3.6 - 35) / 90));
    // El neumático pierde adherencia en un bache o superficie irregular.
    const onPothole = this.hazards.some(h => h.kind === 'pothole' &&
      Math.abs(h.z - car.z) < h.radius + 1.2 && Math.abs(h.x - car.x) < h.radius + 0.85);
    car.pothole = onPothole;
    const enteringPothole = onPothole && !car.previousPothole;
    if (enteringPothole) car.drivingEvents.potholesHit++;
    car.previousPothole = onPothole;
    // Salpicadura simulada cuando cae en bache con asfalto mojado/lluvia/raudal o entra en charco
    const isRoadWet =
      this.weather === 'rain' ||
      this.weather === 'storm' ||
      this.weather === 'flood' ||
      this.track.routeHazardProfile === 'flood' ||
      insideWater;
    if ((enteringPothole || enteringWater) && isRoadWet && Math.abs(speed) * 3.6 > 10) {
      this.lastWetSplash = {
        seq: ++this.splashSeq,
        carId: car.id,
        x: car.x,
        z: car.z,
        intensity: clamp(Math.abs(speed) / 15.5, 0.42, 1.25),
        timeSec: this.time,
      };
    }
    if (onPothole) { car.bump = Math.min(1, car.bump + 8 * dt); }
    else if (onSpeedBump) { car.bump = Math.min(1, Math.max(.55, car.bump)); }
    else car.bump = Math.max(0, car.bump - 2.2 * dt);
    const effectiveSurfaceGrip = this.speedRaceMode ? 0.98 : (this.track.surfaceGripFactor ?? 1);
    const effectiveWeatherGrip = this.speedRaceMode ? 1.0 : WEATHER_CONFIG[this.weather].grip;
    const mu = profile.tireGrip *
      effectiveSurfaceGrip * effectiveWeatherGrip * (1 - hydroplane) * (onPothole ? 0.48 : 1);
    const lateralGripLimit = mu * GRAVITY;
    const desiredSteer = clamp(-input.steer, -1, 1) * profile.maxSteerRad;
    car.steer = expFollow(car.steer, desiredSteer, profile.steeringResponseHz, dt);
    const wheelbase = profile.wheelbaseM;
    // La fuerza lateral se calcula abajo con el modelo dinámico de dos ejes,
    // después de conocer las fuerzas de aceleración/frenado del paso actual.
    // Para limitar tracción en este paso se utiliza la demanda lateral reciente.
    const neededLateralAccel = Math.abs(speed * speed * Math.tan(car.steer) / wheelbase);
    const actualLateralAccel = Math.min(lateralGripLimit, Math.abs(car.lateralAccelMps2));
    // Raudal transversal; la fuerza sobre el neumático y la deriva se resuelven después.
    const flowAcceleration = water.flow * 2.2;
    // Fuerzas motrices limitadas por potencia, neumáticos y círculo de fricción.
    const tireAvailableLongitudinalAccel = Math.sqrt(Math.max(0.2, lateralGripLimit ** 2 - actualLateralAccel ** 2));
    // Límites por ficha: masa, potencia, torque, radio de rueda, tracción y caja estimada.
    // Torque disponible: solo los motores turbo de ficha acumulan presión de sobrealimentación.
    // La inercia del turbo introduce una pequeña demora sin sobrepasar torque/potencia nominales.
    const requestedThrottle = clamp(input.throttle, 0, 1);
    // Sensibilidad de respuesta: potencia/masa, HEV con par eléctrico disponible,
    // mild hybrid de menor potencia, y retardo adicional propio del turbo.
    // No equivale a un tiempo de reacción oficial del fabricante.
    const hpPerTonne = v.powerHp / Math.max(.6, mass / 1000);
    const hybridKind = v.hybridSystem?.kind;
    const responseHz = hybridKind === 'self-charging-hev' ? 5.8 :
      clamp(2.3 + (hpPerTonne - 75) * .056, 2.0, 5.6);
    car.effectiveThrottle = expFollow(car.effectiveThrottle, requestedThrottle,
      requestedThrottle > car.effectiveThrottle ? responseHz : responseHz * 1.8, dt);
    const forward = car.effectiveThrottle;

    const reverse = clamp(input.reverse ?? 0, 0, 1);
    const footBrake = clamp(input.brake, 0, 1);
    const rpmTarget = estimatedRpm(v, speed, Math.max(forward, reverse * .55));
    car.engineRpm = expFollow(car.engineRpm, rpmTarget, 6.0, dt);
    car.turboBoost = integrateTurbo(v, car.turboBoost, car.engineRpm, forward, dt);
    const torqueFactor = torqueAvailability(v, car.engineRpm, car.turboBoost);
    const assistants = safetyDriveModifiers({ vehicle:v, throttle:forward, slip:car.slip, yawRate:car.yawRate, neededLateralAccel, availableLateralAccel:actualLateralAccel });
    car.tcsActive = assistants.tcsActive;
    car.escActive = assistants.escActive;
    if (car.tcsActive && !car.previousTcs) car.drivingEvents.tcsInterventions++;
    if (car.escActive && !car.previousEsc) car.drivingEvents.escInterventions++;
    car.previousTcs = car.tcsActive;
    car.previousEsc = car.escActive;
    if (car.escActive) { car.lateralSpeed *= assistants.lateralDamping; car.yawRate *= assistants.yawDamping; }
    // HEV: la ficha indica potencia combinada y TORQUE ELÉCTRICO, no torque conjunto.
    // El límite de potencia cae hacia el motor térmico si disminuye el SOC simulado;
    // las cifras combinadas no se obtienen sumando Nm de ambos motores.
    const hev = v.hybridSystem?.kind === 'self-charging-hev';
    const mild = v.hybridSystem?.kind === 'mild-12v';
    const electricAvailability = hev ? clamp((car.batterySoc - .20) / .45, .08, 1) : 0;
    const effectivePowerW = hev && v.hybridSystem ?
      Math.min(profile.powerW, ((v.hybridSystem.combustionHp ?? 100) +
      (v.hybridSystem.electricHp ?? 0) * electricAvailability) * 745.7) : profile.powerW;
    const torqueCap = hev ? clamp(.75 + .25 * electricAvailability, .72, 1) : 1;
    let driveForce = tractionForceFromSpec(v,{...profile,powerW:effectivePowerW}, speed,
      torqueFactor * torqueCap, tireAvailableLongitudinalAccel) * assistants.tractionFactor;
    if (hev && v.hybridSystem && electricAvailability > .02) {
      // Dos fuentes de par EN LAS RUEDAS: relación de reducción del motor eléctrico
      // estimada (no torque 'combinado' de fábrica). El total permanece limitado
      // por la potencia COMBINADA publicada y por la adherencia del eje motriz.
      const electricalAxleForce = (v.hybridSystem.electricTorqueNm ?? 0) * 3.1 *
        profile.drivelineEfficiency / profile.tireRadiusM * electricAvailability;
      const powerLimit = effectivePowerW * profile.drivelineEfficiency / Math.max(3.2, Math.abs(speed));
      driveForce = Math.min(profile.massKg * tireAvailableLongitudinalAccel * .88,
        powerLimit, driveForce + electricalAxleForce * .85);
    }
    // ISG 12V: ayuda a baja velocidad hasta la potencia eléctrica de ficha;
    // NO se considera EV ni se suma permanentemente como HP combinados.
    if (mild && v.hybridSystem && forward > .05 && Math.abs(speed) < 12 && car.batterySoc > .25) {
      const assistPower = (v.hybridSystem.electricHp ?? 0) * 745.7;
      const assistTorque = (v.hybridSystem.electricTorqueNm ?? 0) * profile.lowSpeedTorqueRatio / profile.tireRadiusM;
      driveForce = Math.min(profile.massKg * tireAvailableLongitudinalAccel * .88,
        driveForce + Math.min(assistTorque, assistPower / Math.max(2.5, Math.abs(speed))) * .60);
    }

    const requestedMaxBraking = Math.max(4, (100 / 3.6) ** 2 / (2 * Math.max(15, v.brakingDistance100)));
    const dragN = .5 * AIR_DENSITY * v.dragCoeff * v.frontalArea * speed * speed;
    const rollAccel = (.014 + .010 * Math.max(0, (this.track.surfaceRoughnessFactor ?? 1) - 1)) *
      GRAVITY * Math.cos(Math.atan(this.track.inclineGradePercent / 100));
    const slopeAccel = GRAVITY * Math.sin(Math.atan(this.track.inclineGradePercent / 100));
    const waterDrag = water.immersion * (1.2 + Math.min(4.2, Math.abs(speed) * .14));
    const roughnessAccel = (onPothole ? 6.8 : onSpeedBump ? .85 : 0) + waterDrag +
      Math.max(0, (this.track.surfaceRoughnessFactor ?? 1) - 1) * 0.45;
    // Caja automática arcade: ↓/S frena el avance y SOLO al detenerse activa R.
    // ↑/W hace lo contrario. Espacio frena en ambas direcciones sin acelerar.
    const changingDirection = (forward > .05 && speed < -.08) || (reverse > .05 && speed > .08);
    const neutralBrake = (forward > .05 && reverse > .05) || footBrake > .05;
    const efficiency = 1 - Math.min(.45, car.damage * .45);
    const reverseMax = 25 / 3.6; // reversa deliberadamente limitada a 25 km/h
    let driveAccel = 0;
    let brakePedal = footBrake;
    if (neutralBrake) {
      brakePedal = Math.max(brakePedal, forward > .05 && reverse > .05 ? 1 : 0);
    } else if (changingDirection) {
      // No pasar directamente de avance a reversa mientras todavía se mueve.
      brakePedal = Math.max(forward, reverse);
    } else if (reverse > 0) {
      driveAccel = -Math.min(3.2, driveForce / mass * .56 * efficiency) * reverse;
    } else if (forward > 0) {
      driveAccel = Math.min(tireAvailableLongitudinalAccel, driveForce / mass * efficiency) * forward;
    }
    const direction = Math.sign(speed);
    const dragAccel = direction * dragN / mass;
    // ↑ suelta: arrastre aerodinámico + rodadura + retención del motor, sin frenada instantánea.
    const coastDecel = coastEngineBrake(v, speed, forward, reverse, footBrake);
    const roadResistance = direction * (rollAccel + roughnessAccel + coastDecel);
    // ADAS AEB únicamente si está documentado para la versión exacta.
    // Se verifica distancia longitudinal relativa en corredor actual, no se usa para bots de IA.
    let closestDistance: number | null = null;
    let relativeClosing = 0;
    for (const other of this.cars) {
      if (other === car || other.z <= car.z || Math.abs(other.x-car.x) > (v.dimensions.widthMm + other.vehicle.dimensions.widthMm)/2000 + .25) continue;
      const distance = other.z - car.z - (v.dimensions.lengthMm + other.vehicle.dimensions.lengthMm)/4000;
      if (closestDistance === null || distance < closestDistance) { closestDistance = distance; relativeClosing = Math.max(0,speed-other.speed); }
    }
    const aeb = assessAeb({vehicle:v,speedMps:speed,distanceM:closestDistance,relativeSpeedMps:relativeClosing});
    car.aebActive = aeb.active;
    if (car.aebActive && !car.previousAeb) car.drivingEvents.aebInterventions++;
    car.previousAeb = car.aebActive;
    // Advertencias ADAS no invasivas: no confundir alerta con frenado autónomo.
    car.fcwWarning = hasVerifiedSystem(v,'fcw') && closestDistance !== null && relativeClosing > .5 &&
      closestDistance / relativeClosing < 2.5;
    // El prototipo simula advertencia de borde de calzada, no reconocimiento
    // de líneas pintadas mediante cámara ni LKA autónomo.
    car.laneDepartureWarning = hasVerifiedSystem(v,'laneDeparture') && Math.abs(car.x) >
      (this.roadHalfWidth - v.dimensions.widthMm / 2000 - .75) && Math.abs(speed) > 7;

    if (aeb.active) driveAccel = 0;
    brakePedal = Math.max(brakePedal,aeb.brakePedal);
    // SOC simplificado: retención regenerativa del motor HEV (y ayuda leve ISG 12 V).
    // No se suma potencia de frenado extra a la fricción: la frenada total ya está
    // limitada por neumáticos/ABS; solo se representa recuperación parcial de energía.
    if (hev || mild) {
      const regenFactor = hev ? .000115 : .000018;
      const regen = Math.abs(speed) > 1.2 ? clamp(brakePedal + (forward < .05 ? .16 : 0),0,1) : 0;
      car.batterySoc = clamp(car.batterySoc + regen * Math.abs(speed) * regenFactor * dt -
        Math.max(0,forward) * (hev ? .0045 : .00035) * dt, .18, .92);
    }
    const braking = brakingResponse({
      vehicle: v, speedMps: speed, pedal: brakePedal,
      availableLongitudinalAccel: tireAvailableLongitudinalAccel,
      requestedMaxDeceleration: requestedMaxBraking, timeSeconds: this.time,
    });
    car.brakeIntensity = brakePedal;
    car.absActive = braking.absActive;
    if (car.absActive && !car.previousAbs) car.drivingEvents.absInterventions++;
    car.previousAbs = car.absActive;
    car.brakeSlip = braking.brakeSlip;
    car.wheelLock = braking.lockSeverity;
    // Con rueda bloqueada se pierde parcialmente autoridad lateral.
    // ABS documentado modula presión y conserva la dirección.
    car.yawRate *= braking.steeringRetention;
    if (braking.lockSeverity > 0) car.slip = Math.max(car.slip, braking.brakeSlip * .68);
    const brakingAccel = -direction * braking.deceleration;
    let longitudinalAccel = driveAccel + brakingAccel - dragAccel - roadResistance - slopeAccel;
    // HAC: retener unos segundos en cuesta tras soltar freno, si está confirmado en ficha.
    if (hasVerifiedSystem(v,'hillAssist') && slopeAccel > .08) {
      if (brakePedal > .15 && Math.abs(speed) < .5) car.hillHoldRemaining = 2;
      else car.hillHoldRemaining = Math.max(0,car.hillHoldRemaining-dt);
      if (car.hillHoldRemaining > 0 && Math.abs(speed) < .12 && forward < .05 && reverse < .05)
        longitudinalAccel += slopeAccel;
    } else car.hillHoldRemaining = 0;
    longitudinalAccel = clamp(longitudinalAccel, -tireAvailableLongitudinalAccel - roughnessAccel, tireAvailableLongitudinalAccel + roughnessAccel);
    let nextSpeed = clamp(speed + longitudinalAccel * dt, -reverseMax, v.topSpeedKmh / 3.6);
    // Cuando se frena, detenerse exactamente en cero; no invertir por inercia de un frame.
    if (brakePedal > .05 && speed !== 0 && Math.sign(nextSpeed) !== Math.sign(speed)) nextSpeed = 0;
    if (forward === 0 && reverse === 0 && Math.abs(nextSpeed) < .045) nextSpeed = 0;
    if (forward < .025 && reverse < .025 && speed > .0 && nextSpeed < 0 && Math.abs(slopeAccel) < .25) nextSpeed = 0;
    car.deliveredPowerHp = forward > 0 ? Math.min(v.powerHp, Math.max(0, driveForce * Math.abs(speed) / 745.7)) * forward : 0;
    car.acceleration = (nextSpeed - speed) / dt;
    // Física lateral por eje (ángulos de deriva, Fz, fricción combinada e inercia
    // de guiñada). Se usa la aceleración longitudinal realmente obtenida.
    const bicycle = integrateBicycle({
      massKg: mass, wheelbaseM: wheelbase, drivetrain: v.drivetrain,
      speedMps: (speed + nextSpeed) * .5,
      lateralSpeedMps: car.lateralSpeed, yawRateRadS: car.yawRate,
      steeringRad: car.steer, longitudinalAccelMps2: car.acceleration,
      tyreFriction: mu, corneringStiffnessScale: profile.corneringStiffnessScale,
      cgHeightM: profile.cgHeightM, dt,
    });
    car.yawRate = bicycle.yawRateRadS;
    car.lateralSpeed = clamp(bicycle.lateralSpeedMps + flowAcceleration * dt, -11, 11);
    car.lateralAccelMps2 = bicycle.lateralAccelMps2;
    car.tyreGripUse = bicycle.combinedGripUsed;
    car.frontNormalN = bicycle.frontNormalN;
    car.rearNormalN = bicycle.rearNormalN;
    car.sideSlipRad = bicycle.sideSlipRad;
    car.slip = expFollow(car.slip,
      clamp(Math.abs(bicycle.sideSlipRad) / .27 +
        Math.max(0, bicycle.combinedGripUsed - .90) * 1.8, 0, 1), 8, dt);
    car.braking = brakePedal > .10 || onPothole;
    const losingControl = Math.abs(car.speed) > 7 &&
      (Math.abs(car.sideSlipRad) > .24 || car.tyreGripUse > .98 && Math.abs(car.yawRate) > .22);
    if (losingControl && !car.previousLossOfControl) car.drivingEvents.lossOfControl++;
    car.previousLossOfControl = losingControl;
    car.speed = nextSpeed;
    car.bestSpeed = Math.max(car.bestSpeed, Math.max(0, car.speed));
    // Cinemática de Frenet: x representa el desplazamiento lateral real;
    // z representa metros sobre la curva, NO la coordenada global Z.
    // La orientación es relativa a la tangente de la carretera.
    // v_longitudinal / (1 - k*x) incluye el cambio métrico en curvas.
    const curvature = this.roadPath.curvature(car.z);
    const metric = clamp(1 - curvature * car.x, .65, 1.35);
    const ds = (Math.cos(car.yaw) * car.speed - Math.sin(car.yaw) * car.lateralSpeed) * dt / metric;
    const dx = (Math.sin(car.yaw) * car.speed + Math.cos(car.yaw) * car.lateralSpeed) * dt;
    car.z += ds;
    car.x += dx;
    car.yaw = clamp(car.yaw + car.yawRate * dt - curvature * ds, -1.5, 1.5);
    // La línea de salida es un límite: no salir marcha atrás del circuito.
    if (car.z < 0) { car.z = 0; if (car.speed < 0) car.speed = 0; }
    const xLimit = this.roadHalfWidth - v.dimensions.widthMm / 2000 - .12;
    if (car.x < -xLimit || car.x > xLimit) {
      car.x = clamp(car.x, -xLimit, xLimit);
      car.speed *= .985;
      car.lateralSpeed = 0;
      car.yawRate *= .35;
      car.yaw = clamp(car.yaw, -0.16, .16);
    }
    const solver = this.suspensionSolvers.get(car.id);
    if (solver) {
      car.suspension = solver.step({
        x: car.x, z: car.z, yaw: car.yaw, speed: car.speed, dt,
        wheelbaseM: v.dimensions.lengthMm / 1000 * .60,
        trackWidthM: v.dimensions.widthMm / 1000 - .30, massKg: mass,
        longitudinalAccelMps2: car.acceleration,
        lateralAccelMps2: car.lateralAccelMps2,
        hazards: this.hazards, bumps: this.speedBumps,
      });
      car.bump = Math.max(car.bump, car.suspension.impact);
    }
    if (car.z >= this.track.distanceMeters) {
      car.z = this.track.distanceMeters;
      car.finishedAt = this.time;
    }
  }

  private resolveCollisions() {
    // Cada vehículo se aproxima por dos discos longitudinales: frente y zaga.
    // Separación + impulso = los autos no se interpenetran ni ignoran un contacto.
    const getCenters = (car: DynamicCar) => {
      const halfSpan = Math.max(.85, (car.vehicle.dimensions.lengthMm - car.vehicle.dimensions.widthMm) / 2000);
      return [
        this.roadPath.world(car.z + Math.cos(car.yaw) * halfSpan,
          car.x + Math.sin(car.yaw) * halfSpan),
        this.roadPath.world(car.z - Math.cos(car.yaw) * halfSpan,
          car.x - Math.sin(car.yaw) * halfSpan),
      ];
    };
    for (let i = 0; i < this.cars.length; i++) {
      const a = this.cars[i];
      for (let j = i + 1; j < this.cars.length; j++) {
        const b = this.cars[j];
        pairContact: for (const pa of getCenters(a)) for (const pb of getCenters(b)) {
          const dx = pb.x - pa.x, dz = pb.z - pa.z;
          const r = (Math.max(1.0, a.vehicle.dimensions.widthMm / 2000) + Math.max(1.0, b.vehicle.dimensions.widthMm / 2000));
          const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          const dist = Math.sqrt(d2);
          const nx = dist > 1e-5 ? dx / dist : 1;
          const nz = dist > 1e-5 ? dz / dist : 0;
          const payloadA =
            a.id === this.playerId && this.playerPayloadKg !== undefined
              ? this.playerPayloadKg
              : this.track.cargoPayloadKg;
          const payloadB =
            b.id === this.playerId && this.playerPayloadKg !== undefined
              ? this.playerPayloadKg
              : this.track.cargoPayloadKg;
          const invA = 1 / Math.max(650, a.vehicle.weightKg + payloadA);
          const invB = 1 / Math.max(650, b.vehicle.weightKg + payloadB);
          // La carrocería más pesada se desplaza menos durante la corrección.
          const correction = (r - dist + .002) * .82 / (invA + invB);
          // Resolver contacto en coordenadas mundiales y volver a Frenet.
          const angA = this.roadPath.heading(a.z), angB = this.roadPath.heading(b.z);
          const correct = (car: DynamicCar, heading: number, factor: number) => {
            car.x += factor * (nx * Math.cos(heading) - nz * Math.sin(heading));
            car.z += factor * (nx * Math.sin(heading) + nz * Math.cos(heading));
          };
          correct(a, angA, -correction * invA);
          correct(b, angB, correction * invB);
          const ayaw = angA + a.yaw, byaw = angB + b.yaw;
          const vaX = Math.sin(ayaw) * a.speed + Math.cos(ayaw) * a.lateralSpeed;
          const vaZ = Math.cos(ayaw) * a.speed - Math.sin(ayaw) * a.lateralSpeed;
          const vbX = Math.sin(byaw) * b.speed + Math.cos(byaw) * b.lateralSpeed;
          const vbZ = Math.cos(byaw) * b.speed - Math.sin(byaw) * b.lateralSpeed;
          const approaching = (vbX - vaX) * nx + (vbZ - vaZ) * nz;
          if (approaching >= -0.08) continue;
          const jImpulse = -(1.0 + .12) * approaching / (invA + invB);
          const aVx = vaX - jImpulse * invA * nx, aVz = vaZ - jImpulse * invA * nz;
          const bVx = vbX + jImpulse * invB * nx, bVz = vbZ + jImpulse * invB * nz;
          a.speed = clamp((aVx * Math.sin(ayaw) + aVz * Math.cos(ayaw)) * .93, -25 / 3.6, a.vehicle.topSpeedKmh / 3.6);
          b.speed = clamp((bVx * Math.sin(byaw) + bVz * Math.cos(byaw)) * .93, -25 / 3.6, b.vehicle.topSpeedKmh / 3.6);
          a.lateralSpeed = clamp(aVx * Math.cos(ayaw) - aVz * Math.sin(ayaw), -7, 7);
          b.lateralSpeed = clamp(bVx * Math.cos(byaw) - bVz * Math.sin(byaw), -7, 7);
          a.damage = clamp(a.damage + Math.abs(approaching) / 110, 0, 1);
          b.damage = clamp(b.damage + Math.abs(approaching) / 110, 0, 1);
          a.impacts++; b.impacts++;
          a.drivingEvents.collisions++; b.drivingEvents.collisions++;
          a.drivingEvents.collisionSeverity += Math.abs(approaching);
          b.drivingEvents.collisionSeverity += Math.abs(approaching);
          break pairContact; // Un impulso por pareja en este paso; continuar con otras colisiones.
        }
      }
    }
    // Obstáculos rígidos (barriles / conos): corrección posicional más pérdida de energía.
    for (const car of this.cars) {
      for (const h of this.hazards) {
        if (h.kind !== 'barrier' || Math.abs(car.z - h.z) > 6) continue;
        for (const end of [-1.1, 1.1]) {
          const p = this.roadPath.world(car.z + Math.cos(car.yaw) * end,
            car.x + Math.sin(car.yaw) * end);
          const hWorld = this.roadPath.world(h.z, h.x);
          const dx = p.x - hWorld.x, dz = p.z - hWorld.z;
          const distance = Math.hypot(dx, dz);
          const clearance = h.radius + Math.max(.95, car.vehicle.dimensions.widthMm / 2000);
          if (distance >= clearance) continue;
          const nx = distance > .0001 ? dx / distance : 1;
          const nz = distance > .0001 ? dz / distance : 0;
          const heading = this.roadPath.heading(car.z);
          const push = clearance - distance + .008;
          car.x += push * (nx * Math.cos(heading) - nz * Math.sin(heading));
          car.z += push * (nx * Math.sin(heading) + nz * Math.cos(heading));
          const approachSpeed = Math.max(0, -(nx * Math.sin(car.yaw + heading) +
            nz * Math.cos(car.yaw + heading)) * car.speed);
          if (approachSpeed > .05) {
            car.speed *= .20;
            car.lateralSpeed = 0;
            car.yawRate *= .2;
            car.damage = clamp(car.damage + approachSpeed / 90, 0, 1);
            car.impacts++;
            car.drivingEvents.collisions++;
            car.drivingEvents.collisionSeverity += approachSpeed;
          }
          break;
        }
      }
    }
    // Colisión contra tránsito de mano contraria: SOLO ocurre si un vehículo invade el carril izquierdo (X > +1.65)
    if (this.urbanRulesEnabled && this.oncomingCars.length > 0) {
      for (const car of this.cars) {
        if (car.x < DOUBLE_YELLOW_X - 0.25) continue;
        for (const oc of this.oncomingCars) {
          if (Math.abs(car.z - oc.z) > 5.2) continue;
          const dx = car.x - oc.x;
          const dz = car.z - oc.z;
          const minX = (car.vehicle.dimensions.widthMm / 1000 + oc.widthM) * 0.48;
          const minZ = (car.vehicle.dimensions.lengthMm / 1000 + oc.lengthM) * 0.46;
          if (Math.abs(dx) < minX && Math.abs(dz) < minZ) {
            const relImpact = Math.abs(car.speed) + oc.speedMps;
            // Empujar al invasor de regreso hacia la línea divisoria para evitar bloqueo infinito
            car.x = Math.min(car.x, oc.x - minX - 0.18);
            car.speed = -Math.min(4.5, oc.speedMps * 0.35);
            car.lateralSpeed = -2.4;
            car.yawRate *= 0.25;
            car.damage = clamp(car.damage + relImpact / 95, 0, 1);
            car.impacts++;
            car.drivingEvents.collisions++;
            car.drivingEvents.collisionSeverity += relImpact;
            oc.speedMps *= 0.25;
            break;
          }
        }
      }
    }
    // Colisión rígida contra el paseo central de hormigón (solo en tramos activos, respetando cruces)
    if (this.medianSpans.length > 0) {
      for (const car of this.cars) {
        if (car.finishedAt !== null) continue;
        const medianHit = resolveCentralMedianCollision(car, this.medianSpans);
        if (medianHit.hit) {
          car.drivingEvents.collisions += 1;
          car.drivingEvents.collisionSeverity += medianHit.impactStrength * 8;
          if (car.id === this.playerId && this.time - this.lastMedianNoticeAt > 1.8) {
            this.lastMedianNoticeAt = this.time;
            this.pushNotice(
              'penalty',
              'collision',
              '🧱 IMPACTO CON PASEO CENTRAL',
              medianHit.hitType === 'frontal_cap'
                ? 'Golpe frontal contra cabecera de hormigón'
                : 'Roce rígido contra el cantero divisor central',
              -2.5,
            );
          }
        }
      }
    }
  }

  private evaluatePlayerTrafficRules(player: DynamicCar, dt: number) {
    if (!this.urbanRulesEnabled || player.finishedAt !== null) return;
    const kmh = Math.abs(player.speed) * 3.6;

    // 1. Aviso y penalización por cinturón de seguridad
    if (!this.seatbeltBuckled) {
      if (!this.seatbeltReminderSent && (this.time > 1.8 || kmh > 10)) {
        this.seatbeltReminderSent = true;
        this.pushNotice(
          'warning',
          'seatbelt',
          '🔔 ¡USÁ EL CINTURÓN DE SEGURIDAD!',
          'Presioná [C] o el botón CINTURÓN en pantalla para evitar resta de puntos',
          0,
        );
      }
      if (kmh > 14) {
        this.unbuckledMovingSec += dt;
        if (!this.seatbeltPenaltyApplied && this.unbuckledMovingSec >= 5.0) {
          this.seatbeltPenaltyApplied = true;
          player.drivingEvents.unbuckledSeatbelt++;
          this.pushNotice(
            'penalty',
            'seatbelt',
            '🚨 PENALIZACIÓN: SIN CINTURÓN (-6 pts)',
            'Conducir sin abrochar el cinturón descuenta puntos en Driving IQ',
            -6,
          );
        }
      }
    }

    // 2. Cruce de semáforo en ROJO (obliga a frenar antes de forwardStopZ)
    for (const node of this.trafficLights) {
      if (this.penalizedRedLights.has(node.id)) continue;
      const st = getTrafficLightState(node, this.time);
      const lineZ = st.forwardStopZ + 1.8;
      if (this.prevPlayerZ <= lineZ && player.z > lineZ) {
        if (st.phase === 'red' && kmh > 6) {
          this.penalizedRedLights.add(node.id);
          player.drivingEvents.redLightViolations++;
          this.pushNotice(
            'penalty',
            'red_light',
            '🚨 ¡PASASTE LUZ ROJA! (-6,5 pts)',
            `No frenaste a tiempo en ${node.label}`,
            -6.5,
          );
        }
      }
    }

    // 3. Límites de velocidad MÁXIMA y MÍNIMA del tramo activo
    const zone = getActiveSpeedLimitZone(this.speedZones, player.z);
    if (kmh > zone.maxKmh + 6) {
      this.overspeedSec += dt;
      if (this.overspeedSec >= 2.2 && this.time - this.lastSpeedPenaltyAt > 7.5) {
        this.overspeedSec = 0;
        this.lastSpeedPenaltyAt = this.time;
        player.drivingEvents.speedLimitViolations++;
        this.pushNotice(
          'penalty',
          'max_speed',
          `⚠️ EXCESO DE VELOCIDAD (-3 pts)`,
          `Superaste la máxima de ${zone.maxKmh} km/h (${Math.round(kmh)} km/h)`,
          -3,
        );
      }
    } else {
      this.overspeedSec = Math.max(0, this.overspeedSec - dt * 1.5);
    }

    const upcomingLight = findUpcomingTrafficLight(this.trafficLights, player.z, this.time, 52);
    const excusedSlow =
      player.z < 75 ||
      player.pothole ||
      Boolean(upcomingLight && upcomingLight.phase !== 'green');
    if (!excusedSlow && kmh > 2.5 && kmh < zone.minKmh - 4) {
      this.underspeedSec += dt;
      if (this.underspeedSec >= 4.2 && this.time - this.lastSpeedPenaltyAt > 8.5) {
        this.underspeedSec = 0;
        this.lastSpeedPenaltyAt = this.time;
        player.drivingEvents.speedLimitViolations++;
        this.pushNotice(
          'penalty',
          'min_speed',
          `⚠️ BAJO VELOCIDAD MÍNIMA (-3 pts)`,
          `Circulás por debajo de ${zone.minKmh} km/h en vía despejada`,
          -3,
        );
      }
    } else {
      this.underspeedSec = Math.max(0, this.underspeedSec - dt * 1.5);
    }

    // 4. Invasión de carril de mano contraria
    if (player.x > DOUBLE_YELLOW_X + 0.38 && kmh > 8) {
      this.wrongWaySec += dt;
      if (this.wrongWaySec >= 1.15 && this.time - this.lastWrongWayPenaltyAt > 6.0) {
        this.wrongWaySec = 0;
        this.lastWrongWayPenaltyAt = this.time;
        player.drivingEvents.wrongWayInvasions++;
        this.pushNotice(
          'penalty',
          'wrong_way',
          '🚨 ¡INVADISTE MANO CONTRARIA! (-3,5 pts)',
          'Volvé a tu carril derecho para no chocar de frente',
          -3.5,
        );
      }
    } else {
      this.wrongWaySec = Math.max(0, this.wrongWaySec - dt * 2);
    }

    // 5. DETENCIÓN INMEDIATA (CÁRCEL 2 MINUTOS) SI ATROPELLA A UN PEATÓN EN FRANJA PEATONAL O VEREDA
    if (!this.pedestrianArrest && kmh > 2.4) {
      const carHalfW = Math.max(0.88, player.vehicle.dimensions.widthMm / 2000);
      const carHalfL = Math.max(2.05, player.vehicle.dimensions.lengthMm / 2000);
      const peds = evaluateCrosswalkPedestrians(
        this.trafficLights,
        this.time,
        this.roadHalfWidth,
        this.crosswalkPedScratch,
      );

      for (let i = 0; i < peds.length; i++) {
        const ped = peds[i];
        if (!ped.inRoadway && Math.abs(player.x) < this.roadHalfWidth + 1.1) continue;
        if (
          Math.abs(player.z - ped.z) < carHalfL + 0.42 &&
          Math.abs(player.x - ped.x) < carHalfW + 0.42
        ) {
          this.pedestrianArrest = {
            x: player.x,
            z: player.z,
            timeSec: this.time,
            label: ped.crosswalkLabel,
          };
          player.speed = 0;
          player.lateralSpeed = 0;
          player.impacts++;
          player.drivingEvents.collisions++;
          player.drivingEvents.redLightViolations++;
          this.pushNotice(
            'penalty',
            'pedestrian_arrest',
            '🚔 ¡DETENIDO! ATROPELLASTE A UN PEATÓN',
            `Cruce peatonal en ${ped.crosswalkLabel} · Vas a la cárcel por 2 minutos`,
            -100,
          );
          return;
        }
      }

      // También si el jugador invade la vereda peatonal a velocidad donde caminan peatones laterales
      if (Math.abs(player.x) > this.roadHalfWidth + 2.35 && kmh > 16) {
        const modZ = ((player.z % 38) + 38) % 38;
        if (modZ > 11 && modZ < 15.5) {
          this.pedestrianArrest = {
            x: player.x,
            z: player.z,
            timeSec: this.time,
            label: 'Vereda peatonal',
          };
          player.speed = 0;
          player.lateralSpeed = 0;
          player.impacts++;
          player.drivingEvents.collisions++;
          this.pushNotice(
            'penalty',
            'pedestrian_arrest',
            '🚔 ¡DETENIDO! INVASIÓN DE VEREDA Y ATROPELLO',
            'Subiste a la vereda peatonal · Vas a la cárcel por 2 minutos',
            -100,
          );
        }
      }
    }
  }

  step(dt: number, player: PlayerInput) {
    const step = clamp(dt, 0, .02);
    if (!step) return;
    this.time += step;
    const playerCarBefore = this.getCar(this.playerId);
    this.prevPlayerZ = playerCarBefore?.z ?? 0;

    for (const car of this.cars) {
      if (car.id !== this.playerId && car.finishedAt === null) {
        const heldAtRed = this.urbanRulesEnabled && (() => {
          const nl = findUpcomingTrafficLight(this.trafficLights, car.z, this.time, 18);
          return Boolean(nl && nl.phase !== 'green' && nl.distanceToStopM >= -2);
        })();
        if (car.aiRecoverySeconds > 0) car.aiRecoverySeconds = Math.max(0, car.aiRecoverySeconds - step);
        else if (!heldAtRed && car.z > 15 && Math.abs(car.speed) < .65) {
          car.aiStationarySeconds += step;
          if (car.aiStationarySeconds > 1.3) {
            // Reconoce qué obstáculo está bloqueando el corredor y busca el lado libre dentro de su mano.
            const blocker = this.hazards.find(h => h.kind === 'barrier' &&
              h.z > car.z - 5 && h.z < car.z + 18 &&
              Math.abs(h.x - car.x) < h.radius + car.vehicle.dimensions.widthMm / 2000 + 1);
            if (this.urbanRulesEnabled) {
              car.aiTargetX = blocker ? (blocker.x < -5.0 ? -1.8 : -8.2) : (car.x < -5.0 ? -1.8 : -8.2);
            } else {
              car.aiTargetX = blocker ? (blocker.x < 0 ? 4.6 : -4.6) : (car.x < 0 ? 3.6 : -3.6);
            }
            car.aiAvoidUntilZ = car.z + 22;
            car.aiRecoverySeconds = 1.55;
            car.aiStationarySeconds = 0;
          }
        } else car.aiStationarySeconds = Math.max(0, car.aiStationarySeconds - step * 2);
      }
      const input = car.id === this.playerId ? player : this.controlAI(car);
      this.integrateCar(car, input, step);
    }

    const activePlayer = this.getCar(this.playerId);
    if (this.urbanRulesEnabled) {
      stepOncomingTraffic(
        this.oncomingCars,
        this.trafficLights,
        this.speedZones,
        this.time,
        step,
        activePlayer?.z ?? 0,
        this.track.distanceMeters,
      );
      if (activePlayer) this.evaluatePlayerTrafficRules(activePlayer, step);
    }
    this.resolveCollisions();
    if (this.time - this.lastTelemetryTime >= .09) this.recordTelemetry();
  }

  private get maxRaceDurationSec() {
    const base = this.track.cityCircuitId ? 420 : 180;
    return base * Math.max(1, this.track.laps ?? 1);
  }

  getCar(id: string) { return this.cars.find(c => c.id === id); }
  get playerFinished() {
    return (
      this.pedestrianArrest !== null ||
      this.getCar(this.playerId)?.finishedAt != null ||
      this.time >= this.maxRaceDurationSec
    );
  }
  get finished() {
    return (
      this.pedestrianArrest !== null ||
      this.cars.every(c => c.finishedAt !== null) ||
      this.time >= this.maxRaceDurationSec
    );
  }

  private recordTelemetry() {
    this.lastTelemetryTime = this.time;
    for (const car of this.cars) {
      const vKmh = Math.abs(car.speed) * 3.6;
      const fuelBurned = Math.max(0, this.time * car.vehicle.consumptionRacing / 3600 * vKmh / 100);
      const gear = car.speed < -.08 ? 0 : vKmh < 15 ? 1 : vKmh < 38 ? 2 : vKmh < 70 ? 3 : vKmh < 105 ? 4 : vKmh < 145 ? 5 : 6;
      car.history.push({ timeSec: this.time, distanceMeters: car.z,
        lateralX: car.x, yawRad: car.yaw, steerRad: car.steer, slip: car.slip, bump: car.bump,
        suspensionHeaveM: car.suspension.heaveM, suspensionPitchRad: car.suspension.pitchRad,
        suspensionRollRad: car.suspension.rollRad, wheelRoadHeights: { ...car.suspension.wheelRoadM },
        speedKmh: vKmh, accelerationG: car.acceleration / GRAVITY, gear,
        rpm: Math.round(car.engineRpm), isBraking: car.braking,
        absActive: car.absActive, brakeIntensity: car.brakeIntensity, brakeSlip: car.brakeSlip,
        lateralAccelerationG: car.lateralAccelMps2 / GRAVITY,
        tireGripUsage: car.tyreGripUse,
        slipAngleDegrees: car.sideSlipRad * 180 / Math.PI,
        normalLoadFrontN: car.frontNormalN, normalLoadRearN: car.rearNormalN,
        tcsActive:car.tcsActive,escActive:car.escActive,aebActive:car.aebActive,fcwWarning:car.fcwWarning,laneDepartureWarning:car.laneDepartureWarning,
        fuelRemaining: car.vehicle.fuelCapacityL - fuelBurned, fuelBurned,
        powerDeliveredHp: car.deliveredPowerHp, aeroDragN: .5 * AIR_DENSITY * car.vehicle.dragCoeff * car.vehicle.frontalArea * car.speed ** 2,
        pitStops: 0, inCorner: Math.abs(car.yawRate) > .04,
      });
    }
  }

  makeResults(base: VehicleRaceResult[]): VehicleRaceResult[] {
    if (this.time > this.lastTelemetryTime) this.recordTelemetry();
    return this.cars.map(car => {
      const prev = base.find(r => r.vehicle.id === car.id);
      const finishTimeSec = car.finishedAt ?? this.time;
      const finished = car.finishedAt !== null;
      return {
        ...(prev || {}), vehicle: car.vehicle,
        finishPosition: 0, finishTimeSec, gapSec: 0,
        topSpeedAchievedKmh: car.bestSpeed * 3.6, trapSpeedKmh: Math.max(0, car.speed) * 3.6,
        time0to100: car.history.find(h => h.speedKmh >= 100)?.timeSec ?? null,
        time0to200: car.history.find(h => h.speedKmh >= 200)?.timeSec ?? null,
        time400m: car.history.find(h => h.distanceMeters >= 400)?.timeSec ?? null,
        fuelBurned: car.history.at(-1)?.fuelBurned || 0,
        fuelRemaining: car.history.at(-1)?.fuelRemaining ?? car.vehicle.fuelCapacityL,
        effectivePowerToWeight: car.vehicle.powerHp / Math.max(.1, car.vehicle.weightKg / 1000),
        telemetryHistory: car.history,
        drivingEvents: { ...car.drivingEvents },
        isDnf: !finished,
        verdict: finished
          ? `Carrera interactiva: ${car.impacts} impactos; daño ${Math.round(car.damage * 100)}%. La conducción, los baches y las colisiones afectaron el tiempo real.`
          : `No había cruzado la meta cuando terminó la partida del jugador; distancia ${Math.round(car.z)} m; ${car.impacts} impactos.`,
      } as VehicleRaceResult;
    }).sort((a, b) => Number(!!a.isDnf) - Number(!!b.isDnf) ||
      (a.isDnf && b.isDnf ? (b.telemetryHistory.at(-1)?.distanceMeters ?? 0) - (a.telemetryHistory.at(-1)?.distanceMeters ?? 0) : a.finishTimeSec - b.finishTimeSec))
      .map((result, index, arr) => ({ ...result, finishPosition: index + 1,
        gapSec: result.isDnf ? 0 : result.finishTimeSec - arr[0].finishTimeSec }));
  }
}

import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Vehicle, RaceTrackConfig, VehicleRaceResult } from '../types/vehicle';
import {
  Play,
  Pause,
  RotateCcw,
  Award,
  Volume2,
  VolumeX,
  Video,
  Tv,
  Compass,
  Clapperboard,
  Flag,
  Activity,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Sun,
  Moon,
  MousePointer2,
  Keyboard,
  TrafficCone,
  Zap,
  ShieldAlert,
  CloudRain,
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, CircleStop, Maximize2, Smartphone, X,
  MapPin, Timer, Gauge, ChevronLeft, ChevronRight, ChevronsUp, ChevronsDown, AlertCircle,
} from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';
import { canStartCountdown, raceStartupMessage } from '../utils/raceStartupGate';
import { initialRaceInsight, nextRaceInsight, type RaceInsight } from '../utils/vehicleRaceInsights';
import { hasDocumentedABS } from '../utils/brakingDynamics';
import { hasVerifiedSystem } from '../utils/vehicleSafetySystems';
import { interpolateRenderPose, snapshotRenderPose, type RenderPose } from '../utils/visualPhysicsInterpolation';
import { createVehicleEntity, VehicleEntityRunner, type VehicleWorldLampState } from '../utils/vehicle3DEntity';
import { createUrbanTrackScenery } from '../utils/urbanTrackScenery';
import { createDatacarViaducts3D } from '../utils/datacarViaducts3D';
import { finishCameraPose } from '../utils/finishCinematicCamera';
import { createWeatherVisuals3D } from '../utils/weatherVisuals3D';
import { WEATHER_CONFIG, WEATHER_OPTIONS } from '../utils/weatherDynamics';
import type { WeatherMode } from '../utils/weatherDynamics';
import { createSpeedBumps3D } from '../utils/realisticSpeedBumps3D';
import { getAsuncionStreetDetails } from '../utils/asuncionStreetData';
import { createPotholeVisualKit } from '../utils/realisticPotholes3D';
import { findUpcomingPothole, potholeCameraCue, type PotholeLookahead } from '../utils/potholeVisibility';
import { createDepressedRoadGeometry } from '../utils/depressedRoadSurface3D';
import { makeRoadPath, type CurvedRoadPath } from '../utils/curvedRoadPath';
import { makeCurvedAsphalt, bendRoadsideGroup } from '../utils/curvedRoadVisuals3D';
import { hasVehicle3DModel } from '../utils/vehicle3DModelLoader';
import { chooseDirectorShot, DirectorShot } from '../utils/cinematicDirector';
import { simulatedGear } from '../utils/powertrainDynamics';
import { InteractiveRacePhysics, PHYSICS_STEP } from '../utils/interactiveRacePhysics';
import type { TrackHazard, HazardKind } from '../utils/interactiveRacePhysics';
import { createUrbanTrafficVisuals3D } from '../utils/urbanTrafficVisuals3D';
import {
  URBAN_ROAD_WIDTH,
  hasVerifiedBlindSpotAdas,
  stepOncomingTraffic,
  type BlindSpotFlankState,
  type SpeedLimitZone,
  type TrafficLightLiveState,
  type TrafficRuleNotice,
} from '../utils/urbanTrafficRules';
import { PRESET_VEHICLES } from '../data/presetVehicles';
import { triggerPedestrianArrest, type RaceModeId } from '../utils/careerProgression';
import { multiplayerClient } from '../utils/multiplayerClient';
import {
  createAsphaltTexture,
  createAsphaltMicroRelief,
  createAsphaltRoughnessTexture,
  createAsphaltNormalTexture,
  createAsphaltCloseUpDetailNormalTexture,
  createKerbTexture,
  createCheckeredFinishTexture,
  createDistanceSignTexture
} from '../utils/race3dTextures';
import {
  createHyperrealSkyAndIBL,
  getHyperrealAtmosphere,
} from '../utils/hyperrealEnvironment3D';
import {
  NFSMW_PRESET_BY_WEATHER,
  createAutumnAtmosphericParticles,
  createDynamicReflectionProbe,
  createNfsmwPostProcessor,
  enhanceAsphaltMaterialWithPuddles,
} from '../utils/nfsmwRenderingPipeline';
import {
  formatOfficialPower,
  formatOfficialTorque,
  formatOfficialTopSpeed,
  isVehicleFieldUnconfirmed,
} from '../utils/specFidelity';
import { createCentralMedianVisuals3D } from '../utils/centralMedianVisuals3D';
import {
  createForwardMotorcyclePool,
  stepForwardMotorcycles,
  createForwardMotorcyclesVisuals3D,
  type ForwardMotorcycleActor,
} from '../utils/forwardMotorcycleTraffic';
import {
  createDigitalRearviewMirror,
  type DigitalRearviewMirrorController,
} from '../utils/digitalRearviewMirror';
import {
  detectMobilePerformanceMode,
  resolveRace3DPerformanceProfile,
  shouldUseLightweightProceduralVehicle,
} from '../utils/mobilePerformanceProfile';
import {
  applyTurnSignalAction,
  evaluateTurnSignalAutoCancel,
  evaluateTurnSignalBlink,
  mapKeyCodeToTurnSignalAction,
  type TurnSignalMode,
} from '../utils/turnSignalsController';
import {
  evaluateAdasHudReadout,
  type AdasHudReadout,
} from '../utils/adasPresentationAudit';
import { useVehicleStuckDetection } from '../utils/useVehicleStuckDetection';
import { VehicleStuckModal } from './VehicleStuckModal';
import { formatTargetMinutesSec, getCircuitTargetTime } from '../utils/circuitTargetTimes';

export type CameraViewMode = 'arcade' | 'trasera' | 'lateral' | 'cenital' | 'dron' | 'frontal_meta' | 'automatica' | 'libre';

interface Race3DPerspectiveViewProps {
  vehicles: Vehicle[];
  track: RaceTrackConfig;
  simulationResults: VehicleRaceResult[];
  onFinishRace: (liveResults?: VehicleRaceResult[], replayHazards?: TrackHazard[], weather?: WeatherMode) => void;
  onSwitchTo2D?: () => void;
  compact?: boolean; // Para modo vertical 9:16 de TikTok LIVE
  experience?: 'legacy' | 'comparison' | 'race' | 'replay';
  playerVehicleId?: string;
  replayHazards?: TrackHazard[];
  replayWeather?: WeatherMode;
  initialWeather?: WeatherMode;
  onExitRace?: () => void;
  onRestartRace?: () => void;
  /** La carrera mobile espera el toque START después de preparar render y modelos. */
  manualStart?: boolean;
  /** Fase 1 ('city_trial' con semáforos/peatones) o Fase 2 ('speed_pro' sin obstáculos con IA élite). */
  raceMode?: RaceModeId;
  /** Sesión multijugador en línea sincronizada por WebSockets. */
  onlineSession?: boolean;
  /** Se invoca de inmediato cuando el jugador atropella a un peatón y va 2 minutos a la cárcel. */
  onPedestrianArrest?: (incident: { label: string; timeSec: number }) => void;
  /** Peso adicional seleccionado (pasajeros extra + equipaje) en kg. */
  playerPayloadKg?: number;
  /** Si el piloto está registrado en DATACARPY. */
  isDatacarMember?: boolean;
}

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

const describeArc = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArcFlag = endDeg - startDeg <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

const gaugeRatio = (value: number, min: number, max: number) => THREE.MathUtils.clamp((value - min) / Math.max(1e-6, max - min), 0, 1);

type ArcadeGaugeProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  accentClass: string;
  glowClass: string;
  subValue?: string;
  dangerFrom?: number;
};

const ArcadeGauge: React.FC<ArcadeGaugeProps> = ({
  label,
  value,
  min,
  max,
  unit,
  accentClass,
  glowClass,
  subValue,
  dangerFrom,
}) => {
  const ratio = gaugeRatio(value, min, max);
  const startDeg = -215;
  const endDeg = 35;
  const progressDeg = startDeg + ratio * (endDeg - startDeg);
  const dangerRatio = typeof dangerFrom === 'number' ? gaugeRatio(dangerFrom, min, max) : null;
  const dangerStart = typeof dangerRatio === 'number' ? startDeg + dangerRatio * (endDeg - startDeg) : null;

  return (
    <div className="relative w-[148px] h-[148px] rounded-full border border-sky-400/20 bg-slate-950/95 shadow-[0_8px_30px_rgba(2,6,23,0.65)] overflow-hidden">
      <div className={`absolute inset-3 rounded-full bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.55),rgba(2,6,23,0.95)_68%)] ring-1 ring-inset ring-white/5 ${glowClass}`} />
      <svg viewBox="0 0 160 160" className="absolute inset-0 w-full h-full">
        <path d={describeArc(80, 80, 60, startDeg, endDeg)} stroke="rgba(148,163,184,0.18)" strokeWidth="11" fill="none" strokeLinecap="round" />
        {dangerStart !== null && (
          <path d={describeArc(80, 80, 60, dangerStart, endDeg)} stroke="rgba(251,191,36,0.7)" strokeWidth="11" fill="none" strokeLinecap="round" />
        )}
        <path d={describeArc(80, 80, 60, startDeg, progressDeg)} stroke="currentColor" className={accentClass} strokeWidth="11" fill="none" strokeLinecap="round" />
        {Array.from({ length: 11 }).map((_, i) => {
          const a = startDeg + (i / 10) * (endDeg - startDeg);
          const p1 = polarToCartesian(80, 80, 50, a);
          const p2 = polarToCartesian(80, 80, i % 5 === 0 ? 37 : 42, a);
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(226,232,240,0.65)" strokeWidth={i % 5 === 0 ? 2.4 : 1.2} strokeLinecap="round" />;
        })}
        <line
          x1="80"
          y1="80"
          x2={polarToCartesian(80, 80, 48, progressDeg).x}
          y2={polarToCartesian(80, 80, 48, progressDeg).y}
          stroke="white"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <circle cx="80" cy="80" r="4.5" fill="white" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <div className="text-[10px] font-bold tracking-[0.28em] text-slate-400 uppercase">{label}</div>
        <div className="mt-1 text-[34px] leading-none font-black tracking-tight text-white tabular-nums">{Math.round(value)}</div>
        <div className="text-[10px] font-semibold tracking-[0.24em] text-slate-400 uppercase">{unit}</div>
        {subValue && <div className="mt-2 text-[11px] font-mono font-bold text-slate-300">{subValue}</div>}
      </div>
    </div>
  );
};

type ArcadeRaceHudState = {
  speedKmh: number;
  rpm: number;
  gear: number;
  accelG: number;
  absActive?: boolean;
  tcsActive?: boolean;
  escActive?: boolean;
  aebActive?: boolean;
};

const ArcadeRaceHud: React.FC<{
  vehicle: Vehicle;
  state: ArcadeRaceHudState;
}> = ({ vehicle, state }) => {
  const maxRpm = vehicle.fuelType === 'hybrid' ? 7000 : vehicle.engineDescription.toLowerCase().includes('turbo') ? 6500 : 6800;
  const assistBadges = [
    { key: 'ABS', active: !!state.absActive, available: hasDocumentedABS(vehicle) },
    { key: 'TRC', active: !!state.tcsActive, available: hasVerifiedSystem(vehicle, 'tcs') },
    { key: 'ESC', active: !!state.escActive, available: hasVerifiedSystem(vehicle, 'esc') },
    { key: 'AEB', active: !!state.aebActive, available: hasVerifiedSystem(vehicle, 'aeb') },
  ].filter((b) => b.available);

  return (
    <div className="dc100-race-gauges absolute bottom-4 right-4 z-20 pointer-events-none select-none">
      <div className="relative rounded-[26px] border border-sky-400/20 bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(2,6,23,0.98))] px-4 pt-3 pb-2 shadow-[0_20px_45px_rgba(2,6,23,0.6)] overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
        <div className="flex items-end gap-3">
          <div className="relative">
            <ArcadeGauge
              label="Velocidad"
              value={state.speedKmh}
              min={0}
              max={Math.max(140, Math.ceil(vehicle.topSpeedKmh / 10) * 10)}
              unit="km/h"
              accentClass="text-sky-400"
              glowClass="shadow-[0_0_24px_rgba(56,189,248,0.16)]"
              subValue={
                isVehicleFieldUnconfirmed(vehicle, 'topSpeedKmh')
                  ? `≈${Math.round(vehicle.topSpeedKmh)} sim.`
                  : `Máx ${Math.round(vehicle.topSpeedKmh)}`
              }
            />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/90 border border-slate-700 px-3 py-1 text-[11px] font-black tracking-[0.22em] text-sky-300 shadow-lg">
              {state.gear === 0 ? 'R' : `${state.gear}ª`}
            </div>
          </div>
          <div className="relative -ml-1">
            <ArcadeGauge
              label="Revoluciones"
              value={state.rpm}
              min={0}
              max={maxRpm}
              unit="rpm"
              accentClass="text-amber-400"
              glowClass="shadow-[0_0_24px_rgba(251,191,36,0.14)]"
              dangerFrom={maxRpm * 0.82}
              subValue={`${(state.rpm / 1000).toFixed(1)} x1000`}
            />
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3 font-mono">
          <div>
            <div className="text-[9px] uppercase tracking-[0.26em] text-slate-500">Aceleración</div>
            <div className="text-[15px] font-black tabular-nums text-white">{state.accelG > 0 ? '+' : ''}{state.accelG.toFixed(2)}<span className="ml-1 text-[10px] text-slate-400">G</span></div>
          </div>
          {assistBadges.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-[190px]">
              {assistBadges.map((badge) => (
                <span
                  key={badge.key}
                  className={`rounded-md border px-2 py-1 text-[10px] font-bold tracking-[0.18em] ${badge.active ? 'border-amber-400/70 bg-amber-400/20 text-amber-200' : 'border-slate-700 bg-slate-900/80 text-slate-400'}`}
                >
                  {badge.active ? (badge.key === 'ABS' ? 'ABS ACTIVO' : `${badge.key} ACTIVO`) : badge.key}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export const formatRaceStopwatch = (sec: number): string => {
  if (isNaN(sec) || sec < 0) return '00:00.000';
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  const ms = Math.floor((sec * 1000) % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

/** Minimapa circular Mockup 5:
 * Borde cian brillante, flecha dorada del jugador, trazado con glow, bandera a cuadros en la meta,
 * y píldora inferior con POS. (dorado) y VUELTA.
 */
const RaceMiniMap: React.FC<{
  path: CurvedRoadPath;
  player: { distance: number; lateralX?: number };
  opponents: { id: string; distance: number; lateralX?: number }[];
  playerId: string;
  playerRank?: number;
  totalCars?: number;
  currentLap?: number;
  totalLaps?: number;
  targetSec?: number | null;
  elapsedWithPenaltySec?: number;
  isPracticeFree?: boolean;
}> = ({
  path,
  player,
  opponents,
  playerId,
  playerRank = 1,
  totalCars = 1,
  currentLap = 1,
  totalLaps = 2,
  targetSec = null,
  elapsedWithPenaltySec = 0,
  isPracticeFree = false,
}) => {
  const center = path.world(player.distance, player.lateralX ?? 0);
  const c = Math.cos(center.yaw), s = Math.sin(center.yaw);
  const project = (worldX: number, worldZ: number) => {
    const dx = worldX - center.x, dz = worldZ - center.z;
    const lateral = dx * c - dz * s;
    const forward = dx * s + dz * c;
    return { x: 58 + lateral * 0.44, y: 76 - forward * 0.44 };
  };
  const points: string[] = [];
  const from = Math.max(0, player.distance - 75);
  const to = Math.min(path.length, player.distance + 240);
  for (let dist = from; dist <= to; dist += 6) {
    const sample = path.at(dist);
    const q = project(sample.x, sample.z);
    points.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
  }
  const last = path.at(to);
  const lastPoint = project(last.x, last.z);
  points.push(`${lastPoint.x.toFixed(1)},${lastPoint.y.toFixed(1)}`);
  const finish = path.world(path.length);
  const finishPoint = project(finish.x, finish.z);
  const canShowFinish = path.length - player.distance < 280;

  return (
    <div className="dc100-race-map dc-mockup5-minimap absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-30 pointer-events-none flex flex-col items-start select-none">
      {/* 1. Minimapa circular con borde cian brillante */}
      <div className="relative w-[110px] h-[110px] sm:w-[116px] sm:h-[116px] rounded-full border-2 border-[#00e5ff] bg-[#030914]/94 shadow-[0_0_20px_rgba(0,229,255,0.7),inset_0_0_14px_rgba(0,229,255,0.22)] overflow-hidden flex items-center justify-center">
        {/* Indicador brújula N con flecha hacia arriba */}
        <div className="absolute top-1 inset-x-0 flex flex-col items-center pointer-events-none z-10">
          <span className="text-[9px] font-black tracking-widest text-[#00e5ff] leading-none drop-shadow-[0_0_4px_#00e5ff]">N</span>
          <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[4px] border-b-[#00e5ff] mt-0.5" />
        </div>

        <svg viewBox="0 0 116 116" className="w-full h-full block" aria-label="Minimapa circular">
          {/* Anillos de cuadrícula de radar */}
          <circle cx="58" cy="58" r="48" fill="none" stroke="rgba(0,229,255,0.09)" strokeWidth="1" strokeDasharray="3 3"/>
          <circle cx="58" cy="58" r="28" fill="none" stroke="rgba(0,229,255,0.09)" strokeWidth="1"/>

          {/* Trazado base de pista */}
          <polyline points={points.join(' ')} fill="none" stroke="rgba(15,23,42,0.85)" strokeWidth="12" strokeLinejoin="round" strokeLinecap="round" />
          {/* Trazado neón cian brillante */}
          <polyline points={points.join(' ')} fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="drop-shadow-[0_0_6px_#00e5ff]" />

          {/* Bandera a cuadros en la meta */}
          {canShowFinish && (
            <g transform={`translate(${finishPoint.x},${finishPoint.y})`}>
              <circle r="7" fill="#000" stroke="#00e5ff" strokeWidth="1.5"/>
              <rect x="-4" y="-4" width="4" height="4" fill="#fff"/>
              <rect x="0" y="-4" width="4" height="4" fill="#000"/>
              <rect x="-4" y="0" width="4" height="4" fill="#000"/>
              <rect x="0" y="0" width="4" height="4" fill="#fff"/>
            </g>
          )}

          {/* Rivales */}
          {opponents.filter(v => v.id !== playerId).map(v => {
            const p = path.world(v.distance, v.lateralX ?? 0);
            const xy = project(p.x, p.z);
            return (
              <g key={v.id} transform={`translate(${xy.x},${xy.y})`}>
                <circle r="4" fill="#ff9900" stroke="#ffffff" strokeWidth="1.2" className="drop-shadow-[0_0_4px_#ff9900]" />
              </g>
            );
          })}

          {/* Flecha dorada indicando la posición y rumbo del jugador */}
          <g transform="translate(58,76)">
            <polygon points="0,-12 7,8 0,4 -7,8" fill="#ffb800" stroke="#ffffff" strokeWidth="1.4" className="drop-shadow-[0_0_8px_#ffb800]" />
          </g>
        </svg>
      </div>

      {/* Píldora inferior: en modo solitario muestra META y cuenta regresiva RESTAN; en multijugador POS. y VUELTA */}
      <div className="mt-1.5 w-[114px] sm:w-[120px] px-2.5 py-1 bg-[#030914]/94 border border-cyan-400/40 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.85)] flex flex-col gap-0.5">
        {totalCars <= 1 ? (
          <>
            <div className="flex items-center justify-between gap-1.5 text-[10px] leading-tight font-black tracking-wider">
              <span className="text-white/80">META</span>
              <span className="text-[#ffb800] text-[12px] font-mono font-black tabular-nums drop-shadow-[0_0_6px_rgba(255,184,0,0.7)]">
                {isPracticeFree ? 'LIBRE' : targetSec ? formatTargetMinutesSec(targetSec) : '--:--'}
              </span>
            </div>
            {!isPracticeFree && targetSec != null && (() => {
              const remSec = Math.ceil(targetSec - elapsedWithPenaltySec);
              const overBudget = remSec < 0;
              return (
                <div className="flex items-center justify-between gap-1.5 text-[9.5px] leading-tight font-black tracking-wide">
                  <span className="text-white/80">{overBudget ? 'EXCESO' : 'RESTAN'}</span>
                  <span
                    className={`text-[11px] font-mono font-black tabular-nums ${
                      overBudget
                        ? 'text-rose-400'
                        : remSec <= 20
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                    }`}
                  >
                    {overBudget ? `+${formatTargetMinutesSec(Math.abs(remSec))}` : formatTargetMinutesSec(remSec)}
                  </span>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="flex items-center justify-between gap-1.5 text-[10px] leading-tight font-black tracking-wider">
            <span className="text-white/80">POS.</span>
            <span className="text-[#ffb800] text-[13px] font-black italic drop-shadow-[0_0_6px_rgba(255,184,0,0.7)]">{playerRank}/{totalCars}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-1.5 text-[10px] leading-tight font-black tracking-wider">
          <span className="text-white/80">VUELTA</span>
          <span className="text-cyan-300 text-[12px] font-black italic drop-shadow-[0_0_6px_rgba(0,229,255,0.7)]">{currentLap}/{totalLaps}</span>
        </div>
      </div>
    </div>
  );
};

/** Clúster digital arcade Mockup 5/6:
 * Botones de cámara y pausa en cristal oscuro, arco semicircular de RPM (RPM x1000) con zona roja,
 * velocidad en números gigantes 168 km/h y marcha en cuadro dorado 4.
 */
const Mockup5SpeedCluster: React.FC<{
  speedKmh: number;
  rpm: number;
  gear: number;
  onCycleCamera: () => void;
  onPause: () => void;
  onOpenDetailed?: () => void;
}> = ({ speedKmh, rpm, gear, onCycleCamera, onPause, onOpenDetailed }) => {
  const maxRpm = 8000;
  const clampedRpm = Math.max(0, Math.min(maxRpm, rpm));
  const ratio = clampedRpm / maxRpm;
  const radius = 54;
  const cx = 75;
  const cy = 64;
  const circumference = Math.PI * radius; // ~169.6
  const strokeDashoffset = circumference * (1 - ratio);

  return (
    <div className="dc-mockup5-cluster-wrapper absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-30 flex flex-col items-end gap-1.5 select-none pointer-events-none">
      {/* Botones superiores de cámara y pausa en cristal oscuro */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={onCycleCamera}
          className="w-9 h-9 rounded-xl bg-[#030914]/94 border border-cyan-400/40 text-cyan-300 flex items-center justify-center hover:bg-cyan-950/60 active:scale-95 transition-all shadow-[0_0_12px_rgba(0,0,0,0.7)] cursor-pointer"
          aria-label="Cambiar vista de cámara"
          title="Cambiar vista de cámara"
        >
          <Video size={17} />
        </button>
        <button
          type="button"
          onClick={onPause}
          className="w-9 h-9 rounded-xl bg-[#030914]/94 border border-cyan-400/40 text-cyan-300 flex items-center justify-center hover:bg-cyan-950/60 active:scale-95 transition-all shadow-[0_0_12px_rgba(0,0,0,0.7)] cursor-pointer"
          aria-label="Pausa"
          title="Pausa"
        >
          <Pause size={17} />
        </button>
      </div>

      {/* Tacómetro / Velocímetro digital estilo arcade */}
      <div className="dc11-mobile-speed dc-mockup5-cluster pointer-events-auto relative w-[164px] sm:w-[178px] rounded-2xl border border-cyan-400/50 bg-[#030914]/94 px-3 pt-2 pb-2 shadow-[0_0_24px_rgba(0,229,255,0.28),inset_0_0_14px_rgba(0,229,255,0.08)] flex flex-col items-center">
        {/* Semicírculo de RPM con escala 0-8 y zona roja 7-8 */}
        <div className="relative w-[150px] h-[64px] overflow-visible">
          <svg viewBox="0 0 150 68" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="dcRpmGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00e5ff" />
                <stop offset="55%" stopColor="#22c55e" />
                <stop offset="75%" stopColor="#eab308" />
                <stop offset="90%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            {/* Pista de fondo */}
            <path
              d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}`}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {/* Zona roja indicativa en 7-8 */}
            <path
              d={`M ${cx + radius * Math.cos(Math.PI * 0.15)},${cy - radius * Math.sin(Math.PI * 0.15)} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}`}
              fill="none"
              stroke="rgba(239,68,68,0.4)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {/* Arco dinámico de revoluciones */}
            <path
              d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}`}
              fill="none"
              stroke="url(#dcRpmGrad)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-75"
            />
            {/* Marcas numéricas 0 a 8 */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => {
              const angle = Math.PI - (i / 8) * Math.PI;
              const tr = radius + 9;
              const tx = cx + tr * Math.cos(angle);
              const ty = cy - tr * Math.sin(angle) + 2;
              const isRed = i >= 7;
              return (
                <text
                  key={i}
                  x={tx}
                  y={ty}
                  textAnchor="middle"
                  className={`text-[8px] font-mono font-bold ${isRed ? 'fill-red-400' : 'fill-slate-300'}`}
                >
                  {i}
                </text>
              );
            })}
          </svg>
          {/* Texto RPM x1000 */}
          <div className="absolute inset-x-0 bottom-0 flex justify-center">
            <span className="text-[8px] font-mono font-bold tracking-widest text-slate-400 uppercase">
              RPM x1000
            </span>
          </div>
        </div>

        {/* Fila: Velocidad en números gigantes + Marcha en cuadro dorado */}
        <div className="mt-1 flex items-end justify-between w-full px-1">
          {/* Velocidad en números gigantes 168 km/h */}
          <div className="flex flex-col items-start leading-none">
            <div className="flex items-baseline gap-1">
              <strong className="font-display font-black italic text-[34px] sm:text-[38px] text-white tracking-tight leading-none tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]">
                {Math.round(speedKmh)}
              </strong>
            </div>
            <span className="text-[10px] font-extrabold text-cyan-300 tracking-wider uppercase pl-0.5 -mt-0.5">
              km/h
            </span>
          </div>

          {/* Marcha en cuadro dorado 4 */}
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg border-2 border-[#ffb800] bg-[#1a1202]/94 flex items-center justify-center shadow-[0_0_16px_rgba(255,184,0,0.55),inset_0_0_8px_rgba(255,184,0,0.25)]">
            <span className="font-display font-black italic text-xl sm:text-2xl text-[#ffb800] drop-shadow-[0_0_6px_#ffb800] leading-none">
              {gear === 0 ? 'R' : gear === -1 ? 'N' : gear}
            </span>
          </div>
        </div>

        {/* Pie de datos / compatibilidad de tests */}
        <footer className="w-full flex items-center justify-between mt-1 pt-1 border-t border-cyan-500/20 text-[9px] text-slate-300">
          <b>{gear === 0 ? 'R' : `${gear}ª`}</b>
          <b>{Math.round(rpm)} RPM</b>
          {onOpenDetailed && (
            <button
              type="button"
              onClick={onOpenDetailed}
              className="text-cyan-300 hover:text-white px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30 font-bold text-[8px] tracking-wider"
              aria-label="Ver telemetría completa"
            >
              DATOS +
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export const Race3DPerspectiveView: React.FC<Race3DPerspectiveViewProps> = ({
  vehicles,
  track,
  simulationResults,
  onFinishRace,
  onSwitchTo2D,
  compact = false,
  experience = 'legacy',
  playerVehicleId,
  replayHazards,
  replayWeather,
  initialWeather,
  onExitRace,
  onRestartRace,
  manualStart = false,
  raceMode = 'city_trial',
  onlineSession = false,
  onPedestrianArrest,
  playerPayloadKg = 0,
  isDatacarMember: _isDatacarMember = false,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  type TouchControl = 'left' | 'right' | 'throttle' | 'reverse' | 'brake';
  type ControlState = Record<TouchControl, boolean>;
  const neutralControls = (): ControlState => ({left:false,right:false,throttle:false,reverse:false,brake:false});
  // Teclado y touch tienen fuentes INDEPENDIENTES. La física usa el OR de ambas.
  // Esto permite acelerar + girar con dos dedos sin que pointerup o keyup de
  // un control borre la entrada del otro.
  const steeringKeysRef = useRef<ControlState>(neutralControls());
  const keyboardControlsRef = useRef<ControlState>(neutralControls());
  const touchControlsRef = useRef<ControlState>(neutralControls());
  const [touchPressed, setTouchPressed] = useState<Partial<ControlState>>({});
  const touchPointersRef = useRef<Record<TouchControl, number | null>>({left:null,right:null,throttle:null,reverse:null,brake:null});
  const cancelOppositeTurnSignalRef = useRef<(steerDirection: number) => void>(() => {});
  const syncCombinedControls = () => {
    for (const control of Object.keys(steeringKeysRef.current) as TouchControl[]) {
      steeringKeysRef.current[control] = keyboardControlsRef.current[control] || touchControlsRef.current[control];
    }
    const steerDir =
      steeringKeysRef.current.left === steeringKeysRef.current.right
        ? 0
        : steeringKeysRef.current.right
          ? 1
          : -1;
    if (steerDir !== 0) {
      cancelOppositeTurnSignalRef.current(steerDir);
    }
  };
  const setTouchControl = (control: TouchControl, pressed: boolean) => {
    touchControlsRef.current[control] = pressed;
    if (control === 'left' || control === 'right') keyboardSteeringRef.current = true;
    syncCombinedControls();
    setTouchPressed(previous => previous[control] === pressed ? previous : {...previous, [control]: pressed});
    if (pressed) soundEngine.unlock();
  };
  useEffect(() => {
    const reset = () => {
      for (const control of Object.keys(touchPointersRef.current) as TouchControl[]) {
        touchPointersRef.current[control] = null;
        touchControlsRef.current[control] = false;
      }
      syncCombinedControls();
      setTouchPressed({});
    };
    const onVisibility = () => { if (document.hidden) reset(); };
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  const touchButton = (control: TouchControl, label: string, icon: React.ReactNode, extra = '') => (
    <button type="button" key={control} aria-label={label} aria-pressed={!!touchPressed[control]}
      className={`dc-touch-button ${extra} ${touchPressed[control] ? 'dc-touch-active' : ''}`}
      onContextMenu={event => event.preventDefault()}
      onTouchStart={event => {
        event.stopPropagation();
        setTouchControl(control, true);
      }}
      onTouchEnd={event => {
        event.stopPropagation();
        setTouchControl(control, false);
      }}
      onTouchCancel={event => {
        event.stopPropagation();
        setTouchControl(control, false);
      }}
      onPointerDown={event => {
        event.preventDefault();
        if (touchPointersRef.current[control] !== null) return;
        touchPointersRef.current[control] = event.pointerId;
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer may already have been released. */ }
        setTouchControl(control, true);
      }}
      onPointerUp={event => { if (touchPointersRef.current[control] === event.pointerId) { touchPointersRef.current[control] = null; setTouchControl(control, false); } }}
      onPointerCancel={event => { if (touchPointersRef.current[control] === event.pointerId) { touchPointersRef.current[control] = null; setTouchControl(control, false); } }}
      onLostPointerCapture={event => { if (touchPointersRef.current[control] === event.pointerId) { touchPointersRef.current[control] = null; setTouchControl(control, false); } }}>
      {icon}<span className="sr-only">{label}</span>
    </button>
  );
  const enableLandscape = async () => {
    try {
      const element = document.querySelector('.dc-mobile-race') as HTMLElement | null;
      if (element && !document.fullscreenElement && element.requestFullscreen) await element.requestFullscreen();
    } catch { /* En iOS Safari / navegadores sin fullscreen se mantiene el modo normal. */ }
    try {
      const orientation = screen.orientation as ScreenOrientation & {lock?: (mode: string) => Promise<void>};
      if (orientation?.lock) await orientation.lock('landscape');
    } catch { /* El navegador puede prohibir el bloqueo: mostrar indicación de giro manual. */ }
  };

  const physicsRef = useRef<InteractiveRacePhysics | null>(null);
  const raceHazardsSnapshotRef = useRef<TrackHazard[]>([]);
  const addVisualHazardRef = useRef<((kind: HazardKind) => void) | null>(null);
  const placeHazardAtRef = useRef<((kind: HazardKind, x: number, z: number) => void) | null>(null);
  const placementKindRef = useRef<HazardKind | null>(null);
  const finalResultsRef = useRef<VehicleRaceResult[] | null>(null);
  const resetVisualRaceRef = useRef<(() => void) | null>(null);
  const keyboardSteeringRef = useRef(false);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultDeliveredRef = useRef(false);
  const timeDisplayRef = useRef<HTMLSpanElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  // Velocidad de reproducción visual: 0.75x por defecto según especificación
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(experience === 'legacy' ? 0.75 : 1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stuckInPothole,setStuckInPothole] = useState(false);
  const stuckRef = useRef<{seconds:number;lastDistance:number}>({seconds:0,lastDistance:0});
  const [mobileCameraOpen, setMobileCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraViewMode>(experience === 'replay' || experience === 'legacy' ? 'automatica' : 'arcade');
  const [weatherMode, setWeatherMode] = useState<WeatherMode>(() => experience === 'replay' ? (replayWeather || 'sunny') : (initialWeather || (track.routeHazardProfile === 'flood' && experience === 'race' ? 'rain' : 'sunny')));
  const weatherModeRef = useRef<WeatherMode>(weatherMode);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [goFlash, setGoFlash] = useState(false);
  const [raceInsight, setRaceInsight] = useState<RaceInsight | null>(null);
  const insightSequenceRef = useRef(0);
  const lastUrgentInsightAtRef = useRef(0);
  const [restartSequence, setRestartSequence] = useState(0);
  const [startRequested, setStartRequested] = useState(experience !== 'race');
  const [visualReady, setVisualReady] = useState(false);
  const [showDetailedHud,setShowDetailedHud] = useState(false);
  const [showRaceInformation,setShowRaceInformation] = useState(false);
  const lastInsightIdRef = useRef<string | null>(null);
  const [hasFinished, setHasFinished] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(playerVehicleId || vehicles[0]?.id || '');
  const [isMuted, setIsMuted] = useState(false);
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [potholeWarning, setPotholeWarning] = useState<PotholeLookahead | null>(null);
  const [steeringDemoDeg, setSteeringDemoDeg] = useState(0);
  const [headlightsOn, setHeadlightsOn] = useState(true);
  const [showVehicleLabels, setShowVehicleLabels] = useState(() => experience !== 'race');
  const [interactiveMode, setInteractiveMode] = useState(() => experience === 'race' || (experience === 'legacy' && track.distanceMeters <= 3500));
  const [hazardsEnabled, setHazardsEnabled] = useState(true);
  const [hazardCount, setHazardCount] = useState(0);
  const [placementKind, setPlacementKind] = useState<HazardKind | null>(null);
  useEffect(() => { placementKindRef.current = placementKind; }, [placementKind]);
  useEffect(() => {
    if (experience === 'race') setInteractiveMode(true);
    else if (experience === 'comparison' || experience === 'replay' || track.distanceMeters > 3500) setInteractiveMode(false);
    setSelectedVehicleId(playerVehicleId || vehicles[0]?.id || '');
    setCameraMode(experience === 'replay' || experience === 'legacy' ? 'automatica' : 'arcade');
  }, [track.distanceMeters, experience, playerVehicleId]);
  const roadPath = useMemo(() => makeRoadPath(track), [track.cityCircuitId, track.distanceMeters, track.laps]);
  const [liveVehicleStates, setLiveVehicleStates] = useState<Record<string, { lateralX?: number, distance: number, speedKmh: number, accelG: number, gear: number, rpm: number, impacts: number, slip: number, pothole: boolean, absActive: boolean, tcsActive?: boolean, escActive?: boolean, aebActive?: boolean, fcwWarning?: boolean, laneDepartureWarning?: boolean }>>({});
  const [raceEvent, setRaceEvent] = useState('');
  const [seatbeltBuckled, setSeatbeltBuckled] = useState(false);
  const seatbeltBuckledRef = useRef(false);
  const lastSeatbeltSessionKeyRef = useRef('');
  const [activeSpeedZone, setActiveSpeedZone] = useState<SpeedLimitZone | null>(null);
  const [upcomingTrafficLight, setUpcomingTrafficLight] = useState<(TrafficLightLiveState & { distanceToStopM: number }) | null>(null);
  const [blindSpotState, setBlindSpotState] = useState<BlindSpotFlankState>({
    equipped: false,
    leftAlert: false,
    rightAlert: false,
    leftDistanceM: null,
    rightDistanceM: null,
  });
  const [trafficNotice, setTrafficNotice] = useState<TrafficRuleNotice | null>(null);
  const [timePenaltyHudSec, setTimePenaltyHudSec] = useState(0);
  const [splashHudActive, setSplashHudActive] = useState(false);
  const lastNoticeSeqRef = useRef(0);
  const lastSplashSeqRef = useRef(0);
  const splashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rearviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftMirrorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightMirrorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showRearviewMirror, setShowRearviewMirror] = useState(() => !detectMobilePerformanceMode());
  const [showSideMirrors, setShowSideMirrors] = useState(() =>
    !detectMobilePerformanceMode() && (typeof window !== 'undefined' ? window.innerWidth >= 768 : true),
  );
  const showRearviewMirrorRef = useRef(showRearviewMirror);
  const showSideMirrorsRef = useRef(showSideMirrors);
  useEffect(() => {
    showRearviewMirrorRef.current = showRearviewMirror;
  }, [showRearviewMirror]);
  useEffect(() => {
    showSideMirrorsRef.current = showSideMirrors;
  }, [showSideMirrors]);
  const [portraitPromptDismissed, setPortraitPromptDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  });
  const [turnSignalMode, setTurnSignalMode] = useState<TurnSignalMode>('off');
  const [turnSignalBlinkHud, setTurnSignalBlinkHud] = useState<{ leftLit: boolean; rightLit: boolean }>({
    leftLit: false,
    rightLit: false,
  });
  const turnSignalRef = useRef<{ mode: TurnSignalMode; activatedAtSec: number }>({
    mode: 'off',
    activatedAtSec: 0,
  });
  cancelOppositeTurnSignalRef.current = (steerDirection: number) => {
    const currentMode = turnSignalRef.current.mode;
    const nextMode = evaluateTurnSignalAutoCancel(currentMode, steerDirection);
    if (nextMode !== currentMode) {
      turnSignalRef.current = {
        mode: nextMode,
        activatedAtSec: performance.now() / 1000,
      };
      setTurnSignalMode(nextMode);
      setTurnSignalBlinkHud({ leftLit: false, rightLit: false });
    }
  };
  const triggerTurnSignalAction = (action: 'toggle_left' | 'toggle_right' | 'toggle_hazards' | 'turn_off') => {
    soundEngine.unlock();
    const next = applyTurnSignalAction(turnSignalRef.current.mode, action);
    turnSignalRef.current = {
      mode: next,
      activatedAtSec: performance.now() / 1000,
    };
    setTurnSignalMode(next);
    const immediate = evaluateTurnSignalBlink(next, turnSignalRef.current.activatedAtSec, turnSignalRef.current.activatedAtSec);
    setTurnSignalBlinkHud({ leftLit: immediate.leftLit, rightLit: immediate.rightLit });
  };
  useEffect(() => {
    if (turnSignalMode === 'off') {
      setTurnSignalBlinkHud({ leftLit: false, rightLit: false });
      return;
    }
    const timer = window.setInterval(() => {
      const readout = evaluateTurnSignalBlink(
        turnSignalRef.current.mode,
        performance.now() / 1000,
        turnSignalRef.current.activatedAtSec,
      );
      setTurnSignalBlinkHud(prev =>
        prev.leftLit === readout.leftLit && prev.rightLit === readout.rightLit
          ? prev
          : { leftLit: readout.leftLit, rightLit: readout.rightLit },
      );
    }, 110);
    return () => window.clearInterval(timer);
  }, [turnSignalMode]);
  const [adasReadout, setAdasReadout] = useState<AdasHudReadout | null>(null);
  const {
    isStuckModalOpen,
    reportSimulationFrame,
    handleKeepTrying,
    resetDetection: resetStuckDetection,
  } = useVehicleStuckDetection({ requiredStuckSeconds: 3.0 });
  const buckleSeatbelt = () => {
    soundEngine.unlock();
    soundEngine.playSeatbeltClick();
    seatbeltBuckledRef.current = true;
    physicsRef.current?.setSeatbeltBuckled(true);
    setSeatbeltBuckled(true);
  };
  const [isGlbLoading, setIsGlbLoading] = useState<boolean>(() => vehicles.some((v) => hasVehicle3DModel(v.id)));
  const [loadedVehicleModels, setLoadedVehicleModels] = useState(0);
  const requiredVehicleModels = vehicles.filter(v => hasVehicle3DModel(v.id)).length;
  const [glbLoadError, setGlbLoadError] = useState<string | null>(null);
  const raceGateReady = canStartCountdown({sceneRendered: visualReady, loadedModels: loadedVehicleModels, requiredModels: requiredVehicleModels, modelError: false});
  const isPreloading = !raceGateReady;
  const isPreloadingRef = useRef(isPreloading);
  useEffect(() => {
    isPreloadingRef.current = isPreloading;
  }, [isPreloading]);
  const mobileMenuOpenRef = useRef(mobileMenuOpen);
  useEffect(() => {
    mobileMenuOpenRef.current = mobileMenuOpen;
  }, [mobileMenuOpen]);

  // Métricas de diagnóstico en tiempo real (GPU / Engine)
  const [diagStats, setDiagStats] = useState({
    fps: 60,
    frameTimeMs: 16.6,
    drawCalls: 0,
    triangles: 0,
  });

  // Referencias para el render loop de Three.js (evita pausas por re-render de React)
  const stateRef = useRef({
    isPlaying: false,
    currentTimeSec: 0,
    playbackSpeed: experience === 'legacy' ? 0.75 : 1,
    cameraMode: (experience === 'replay' || experience === 'legacy' ? 'automatica' : 'arcade') as CameraViewMode,
    countdown: null as number | null,
    hasFinished: false,
    selectedVehicleId: playerVehicleId || vehicles[0]?.id || '',
    steeringDemoDeg: 0,
    headlightsOn: true,
    showVehicleLabels: experience !== 'race',
    maxRaceTimeSec: 15,
    interactiveMode: false,
  });

  useEffect(() => {
    stateRef.current.isPlaying = isPlaying;
    // El reloj del render loop es la fuente de verdad. No copiar el estado React:
    // los commits demorados podían volverlo atrás y producir tirones en la escena.
    stateRef.current.playbackSpeed = playbackSpeed;
    stateRef.current.cameraMode = cameraMode;
    stateRef.current.countdown = countdown;
    stateRef.current.hasFinished = hasFinished;
    stateRef.current.selectedVehicleId = selectedVehicleId;
    // La lectura del volante durante el render la controla stateRef directamente.
    // NO copiar el valor del HUD aquí: los re-renders pueden revertir pulsaciones.
    stateRef.current.headlightsOn = headlightsOn;
    stateRef.current.showVehicleLabels = showVehicleLabels;
    stateRef.current.interactiveMode = interactiveMode;
  }, [isPlaying, playbackSpeed, cameraMode, countdown, hasFinished, selectedVehicleId, headlightsOn, interactiveMode, showVehicleLabels]);

  // El usuario cambia clima en caliente sin reiniciar el WebGL ni la carrera.
  useEffect(() => {
    weatherModeRef.current = weatherMode;
    physicsRef.current?.setWeather(weatherMode);
    soundEngine.setWeather(weatherMode);
  }, [weatherMode]);

  // Duración máxima de la prueba oficial
  const maxRaceTimeSec = useMemo(() => {
    return simulationResults.length > 0
      ? Math.max(...simulationResults.map((r) => r.finishTimeSec))
      : 15;
  }, [simulationResults]);

  useEffect(() => {
    stateRef.current.maxRaceTimeSec = maxRaceTimeSec;
  }, [maxRaceTimeSec]);

  /**
   * MUESTREO ULTRAFLUIDO CON INTERPOLACIÓN CONTINUA (FASE 1)
   * Elimina completamente los saltos discretos muestreando continuamente entre
   * muestras físicas oficiales mediante búsqueda binaria O(log N) y LERP suave.
   */
  const getInterpolatedVehicleState = (vId: string, time: number) => {
    const result = simulationResults.find((r) => r.vehicle.id === vId);
    if (!result || result.telemetryHistory.length === 0) {
      return {
        distance: 0,
        speedKmh: 0,
        accelG: 0,
        gear: 1,
        rpm: 1000,
        isBraking: false,
        brakeIntensity: 0, absActive: false, brakeSlip: 0,
        outOfFuel: false,
      };
    }

    const history = result.telemetryHistory;

    // Antes del primer instante
    if (time <= history[0].timeSec) {
      const s0 = history[0];
      return {
        distance: s0.distanceMeters,
        speedKmh: s0.speedKmh,
        accelG: s0.accelerationG,
        gear: s0.gear,
        rpm: s0.rpm,
        isBraking: s0.isBraking || false,
        brakeIntensity: s0.brakeIntensity ?? 0, absActive: s0.absActive ?? false, brakeSlip: s0.brakeSlip ?? 0,
        outOfFuel: s0.outOfFuel || false,
      };
    }

    // Después del último instante (meta alcanzada)
    const sLast = history[history.length - 1];
    if (time >= sLast.timeSec) {
      return {
        distance: sLast.distanceMeters,
        speedKmh: sLast.speedKmh,
        accelG: sLast.accelerationG,
        gear: sLast.gear,
        rpm: sLast.rpm,
        isBraking: sLast.isBraking || false,
        brakeIntensity: sLast.brakeIntensity ?? 0, absActive: sLast.absActive ?? false, brakeSlip: sLast.brakeSlip ?? 0,
        outOfFuel: sLast.outOfFuel || false,
      };
    }

    // Búsqueda binaria O(log N) para localizar el intervalo temporal exacto [prev, next]
    let low = 0;
    let high = history.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (history[mid].timeSec <= time) {
        if (mid === history.length - 1 || history[mid + 1].timeSec > time) {
          low = mid;
          break;
        }
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const prev = history[low];
    const next = history[Math.min(low + 1, history.length - 1)];

    const dt = next.timeSec - prev.timeSec;
    const alpha = dt > 0.00001 ? Math.min(1.0, Math.max(0.0, (time - prev.timeSec) / dt)) : 0;

    // Interpolación continua que garantiza desplazamiento suave sin escalones discretos
    const distance = prev.distanceMeters + alpha * (next.distanceMeters - prev.distanceMeters);
    const speedKmh = prev.speedKmh + alpha * (next.speedKmh - prev.speedKmh);
    const accelG = prev.accelerationG + alpha * (next.accelerationG - prev.accelerationG);
    const rpm = Math.round(prev.rpm + alpha * (next.rpm - prev.rpm));
    const gear = alpha > 0.5 ? next.gear : prev.gear;
    const isBraking = alpha > 0.5 ? next.isBraking : prev.isBraking;
    const outOfFuel = alpha > 0.5 ? next.outOfFuel : prev.outOfFuel;

    return {
      distance: Math.min(track.distanceMeters, distance),
      speedKmh,
      accelG,
      gear,
      rpm,
      isBraking: isBraking || false,
      brakeIntensity: (prev.brakeIntensity ?? 0) + alpha * ((next.brakeIntensity ?? 0) - (prev.brakeIntensity ?? 0)),
      absActive: alpha > .5 ? next.absActive ?? false : prev.absActive ?? false,
      brakeSlip: (prev.brakeSlip ?? 0) + alpha * ((next.brakeSlip ?? 0) - (prev.brakeSlip ?? 0)),
      outOfFuel: outOfFuel || false,
    };
  };

  /** Reproducción de la trayectoria que ocurrió realmente, NO nueva simulación. */
  const getReplayPose = (vehicleId: string, time: number) => {
    const history = simulationResults.find(result => result.vehicle.id === vehicleId)?.telemetryHistory ?? [];
    if (!history.length) return undefined;
    let low = 0, high = history.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      if (history[mid].timeSec <= time) low = mid;
      else high = mid - 1;
    }
    const a = history[low];
    const b = history[Math.min(history.length - 1, low + 1)];
    const ratio = b.timeSec > a.timeSec ? THREE.MathUtils.clamp((time - a.timeSec) / (b.timeSec - a.timeSec), 0, 1) : 0;
    const lerp = (key: 'lateralX' | 'yawRad' | 'steerRad' | 'slip' | 'bump') =>
      THREE.MathUtils.lerp(a[key] || 0, b[key] || 0, ratio);
    const wheelKeys = ['FL', 'FR', 'RL', 'RR'] as const;
    const wheelRoadM = Object.fromEntries(wheelKeys.map(k => [k, THREE.MathUtils.lerp(a.wheelRoadHeights?.[k] ?? 0, b.wheelRoadHeights?.[k] ?? 0, ratio)])) as { FL: number; FR: number; RL: number; RR: number };
    return { x: lerp('lateralX'), z: THREE.MathUtils.lerp(a.distanceMeters, b.distanceMeters, ratio),
      yaw: lerp('yawRad'), steer: lerp('steerRad'), slip: lerp('slip'), bump: lerp('bump'),
      suspension: { heaveM: THREE.MathUtils.lerp(a.suspensionHeaveM ?? 0, b.suspensionHeaveM ?? 0, ratio),
        pitchRad: THREE.MathUtils.lerp(a.suspensionPitchRad ?? 0, b.suspensionPitchRad ?? 0, ratio),
        rollRad: THREE.MathUtils.lerp(a.suspensionRollRad ?? 0, b.suspensionRollRad ?? 0, ratio),
        wheelRoadM, impact: lerp('bump') } };
  };

  // Cuenta regresiva cinemática al iniciar carrera o cambiar de circuito
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTimeSec(0);
    stateRef.current.currentTimeSec = 0;
    setHasFinished(false);
    setStuckInPothole(false);stuckRef.current={seconds:0,lastDistance:0};
    resetStuckDetection();
    turnSignalRef.current = { mode: 'off', activatedAtSec: 0 };
    setTurnSignalMode('off');
    setAdasReadout(null);
    finalResultsRef.current = null;
    setLiveVehicleStates({});
    setRaceEvent('');
    setRaceInsight(null);
    setGoFlash(false);
    const sessionKey = `${track.id}:${restartSequence}:${experience}`;
    if (lastSeatbeltSessionKeyRef.current !== sessionKey) {
      lastSeatbeltSessionKeyRef.current = sessionKey;
      seatbeltBuckledRef.current = false;
      setSeatbeltBuckled(false);
    }
    setTrafficNotice(null);
    setTimePenaltyHudSec(0);
    setSplashHudActive(false);
    lastNoticeSeqRef.current = 0;
    lastSplashSeqRef.current = 0;
    insightSequenceRef.current = 0;
    lastUrgentInsightAtRef.current = 0;
    lastInsightIdRef.current = null;
    resultDeliveredRef.current = false;
    if (finishTimerRef.current !== null) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (experience === 'replay') {
      // Una repetición nunca empieza con cuenta regresiva ni modifica el motor físico.
      setCountdown(null);
      setIsPlaying(true);
      stateRef.current.isPlaying = true;
      return () => { soundEngine.stopAll(); };
    }
    // Si la compuerta de preparación aún no ha habilitado la largada o está precargando, esperar
    if (!startRequested || isPreloading) {
      setCountdown(null);
      stateRef.current.countdown = null;
      stateRef.current.isPlaying = false;
      return () => { soundEngine.stopAll(); };
    }
    // V11.2: cuenta regresiva de tres pasos COMPLETOS de 1 segundo.
    // En lugar de tres temporizadores absolutos (que se ejecutaban uno tras otro
    // al bloquearse el hilo principal en móviles lentos), cada paso programa el
    // siguiente solo DESPUÉS de que el anterior se haya mostrado.
    // Los pitidos y los cambios visuales nacen del mismo paso.
    let stopped = false;
    let stageTimer: ReturnType<typeof setTimeout> | null = null;
    let flashTimer: ReturnType<typeof setTimeout> | null = null;
    const startStep = (step: 3 | 2 | 1 | 0) => {
      if (stopped) return;
      if (step > 0) {
        setCountdown(step);
        stateRef.current.countdown = step;
        stateRef.current.isPlaying = false;
        if (experience === 'race') {
          if (step === 3) soundEngine.playCountdownTone(3);
          else if (step === 2) soundEngine.playCountdownTone(2);
          else soundEngine.playCountdownTone(1);
        }
        stageTimer = setTimeout(() => startStep((step - 1) as 3 | 2 | 1 | 0), 1000);
        return;
      }
      // GO: desbloquear física y sonido en el mismo instante.
      setCountdown(null);
      setGoFlash(true);
      setIsPlaying(true);
      stateRef.current.isPlaying = true;
      stateRef.current.countdown = null;
      if (experience === 'race') {
        soundEngine.playCountdownTone(0);
        const chosen = vehicles.find(v => v.id === (playerVehicleId || vehicles[0]?.id));
        if (chosen) {
          const insight = initialRaceInsight(chosen);
          setRaceInsight(insight);
          lastInsightIdRef.current = insight.id;
        }
      }
      flashTimer = setTimeout(() => { if (!stopped) setGoFlash(false); }, 700);
    };
    // Una animación de React debe presentar la grilla antes del primer pitido.
    const firstFrame = requestAnimationFrame(() => startStep(3));
    return () => {
      stopped = true;
      cancelAnimationFrame(firstFrame);
      if (stageTimer !== null) clearTimeout(stageTimer);
      if (flashTimer !== null) clearTimeout(flashTimer);
      soundEngine.stopCountdownTones();
      if (finishTimerRef.current !== null) {
        clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
    };
  }, [track.id, vehicles, interactiveMode, hazardsEnabled, experience, restartSequence, manualStart, startRequested]);

  // Compuerta universal de preparación: precarga 3D -> paneo aéreo Dron sobre Asunción -> 3, 2, 1.
  // En modo multijugador en línea, sincroniza la largada con el servidor WebSocket cuando ambos están listos.
  const [onlinePeersHud, setOnlinePeersHud] = useState<{ id: string; pilotName: string; distance: number; lateralX: number }[]>([]);
  useEffect(() => {
    if (!raceGateReady || startRequested) return;
    if (onlineSession && experience === 'race') {
      const startMarker = multiplayerClient.synchronizedStartCounter;
      multiplayerClient.notifySceneReady();
      const triggerLaunch = () => {
        soundEngine.unlock();
        stateRef.current.isPlaying = false;
        setStartRequested(true);
      };
      const unsubscribe = multiplayerClient.subscribe(() => {
        if (multiplayerClient.synchronizedStartCounter > startMarker || multiplayerClient.room?.status === 'racing') {
          triggerLaunch();
        }
      });
      const safetyFallback = window.setTimeout(triggerLaunch, 4200);
      return () => {
        unsubscribe();
        window.clearTimeout(safetyFallback);
      };
    }
    const droneShowcaseDelayMs = experience === 'race' ? 1650 : 450;
    const timer = window.setTimeout(() => {
      soundEngine.unlock();
      stateRef.current.isPlaying = false;
      setStartRequested(true);
    }, droneShowcaseDelayMs);
    return () => window.clearTimeout(timer);
  }, [raceGateReady, startRequested, experience, onlineSession]);

  // DATACAR V9.6: cápsulas educativas durante la carrera. Máximo una cada
  // 5,2 segundos, calculadas desde el auto real de esta partida, no desde
  // suposiciones de equipamiento ni mensajes aleatorios precargados.
  useEffect(() => {
    if (experience !== 'race') return;
    let lastImpactCount = 0;
    let lastPothole = false;
    const ticker = window.setInterval(() => {
      const physics = physicsRef.current;
      const car = physics?.getCar(selectedVehicleId);
      if (!car || !stateRef.current.isPlaying || stateRef.current.hasFinished ||
          stateRef.current.countdown !== null || physics!.playerFinished) return;
      if (Date.now() - lastUrgentInsightAtRef.current < 3900) return;
      const newCollision = car.impacts > lastImpactCount;
      const newPothole = car.pothole && !lastPothole;
      lastImpactCount = car.impacts;
      lastPothole = car.pothole;
      const next = nextRaceInsight(car.vehicle, {
        speedKmh: Math.abs(car.speed) * 3.6,
        accelG: car.acceleration / 9.80665,
        rpm: car.engineRpm,
        slip: car.slip,
        pothole: car.pothole,
        impacts: car.impacts,
        absActive: car.absActive,
        tcsActive: car.tcsActive,
        escActive: car.escActive,
        aebActive: car.aebActive,
        braking: car.braking,
      }, {
        throttle: steeringKeysRef.current.throttle ? 1 : 0,
        weather: weatherModeRef.current,
        elapsedSec: physics!.time,
        newCollision,
        newPothole,
      }, insightSequenceRef.current++, lastInsightIdRef.current);
      lastInsightIdRef.current = next.id;
      setRaceInsight(next);
    }, 5200);
    return () => window.clearInterval(ticker);
  }, [experience, selectedVehicleId]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  // Inicialización de la escena Three.js
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detección de software GL para rendimiento óptimo
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const perfProfile = resolveRace3DPerformanceProfile({
      isMobilePerf: detectMobilePerformanceMode(),
      isSoftwareGl,
      compact,
      devicePixelRatio: window.devicePixelRatio || 1,
      innerWidth: window.innerWidth,
    });
    container.dataset.mobilePerf = perfProfile.isMobilePerf ? '1' : '0';
    container.dataset.circuitId = track.cityCircuitId || track.id;
    container.dataset.trackIndex = String(track.trackIndex ?? 0);
    if (isSoftwareGl) {
      showRearviewMirrorRef.current = false;
      showSideMirrorsRef.current = false;
      setShowRearviewMirror(false);
      setShowSideMirrors(false);
    }

    const scene = new THREE.Scene();

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // FOV vertical calibrado y plano lejano optimizado (420m en mobile, 1250m en desktop)
    const camera = new THREE.PerspectiveCamera(compact ? 58 : 48, width / height, 0.2, perfProfile.gameplayCameraFar);
    camera.position.set(0, 3.2, -10.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: perfProfile.antialias,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    const maxDpr = perfProfile.maxDpr;
    let renderDpr = maxDpr;
    renderer.setPixelRatio(renderDpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    // Domo atmosférico hiperrealista (Rayleigh/Mie + nubes fBm) + mapa IBL exterior PMREM
    // que da reflejos reales de cielo, sol y horizonte sobre la laca automotriz, vidrios y agua.
    const hyperrealEnv = createHyperrealSkyAndIBL(renderer, scene, {
      skyRadius: perfProfile.skyDomeRadius,
      fogDensityMultiplier: perfProfile.fogDensityMultiplier,
    });
    const vehicleEnvTexture = hyperrealEnv.envMap;

    const realtimeShadowsEnabled = perfProfile.shadowsEnabled || !perfProfile.isMobilePerf;
    renderer.shadowMap.enabled = realtimeShadowsEnabled;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

    // Cámara libre de seguimiento: un clic+arrastre del mousepad/mouse cambia
    // la vista. Dos dedos (wheel horizontal) giran; vertical hace zoom.
    // El volante del teclado permanece independiente de la cámara.
    const orbit = { yaw: 0, pitch: 0.20, radius: 12 };
    const orbitPointer = { active: false, x: 0, y: 0 };
    let orbitInitialized = false;
    const enableOrbit = () => {
      if (stateRef.current.cameraMode !== 'libre') {
        orbitInitialized = false;
        stateRef.current.cameraMode = 'libre';
        setCameraMode('libre');
      }
      if (!orbitInitialized) {
        const focused = vehicleEntities.find(e => e.vehicle.id === stateRef.current.selectedVehicleId);
        const focus = new THREE.Vector3(
          focused?.group.position.x ?? 0, 1.05, focused?.group.position.z ?? 0,
        );
        const cameraOffset = camera.position.clone().sub(focus);
        orbit.yaw = Math.atan2(cameraOffset.x, -cameraOffset.z);
        orbit.pitch = THREE.MathUtils.clamp(
          Math.atan2(cameraOffset.y, Math.hypot(cameraOffset.x, cameraOffset.z)),
          0.04, 1.35,
        );
        orbit.radius = THREE.MathUtils.clamp(cameraOffset.length(), 6.0, 44);
        orbitInitialized = true;
      }
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (placementKindRef.current && physicsRef.current) {
        const rect = renderer.domElement.getBoundingClientRect();
        const pointer = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, camera);
        const collision = raycaster.intersectObject(road, false)[0];
        if (collision) {
          const local = roadPath.project(collision.point.x, collision.point.z);
          if (local.distance <= roadWidth / 2) {
            placeHazardAtRef.current?.(placementKindRef.current, local.lateral, local.s);
          }
          placementKindRef.current = null;
          setPlacementKind(null);
        }
        return;
      }
      orbitPointer.active = true;
      orbitPointer.x = event.clientX;
      orbitPointer.y = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!orbitPointer.active) return;
      const dx = event.clientX - orbitPointer.x;
      const dy = event.clientY - orbitPointer.y;
      orbitPointer.x = event.clientX;
      orbitPointer.y = event.clientY;
      if (Math.abs(dx) + Math.abs(dy) < 0.01) return;
      enableOrbit();
      orbit.yaw -= dx * 0.006;
      orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + dy * 0.004, 0.04, 1.35);
    };
    const pointerUp = (event: PointerEvent) => {
      orbitPointer.active = false;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };
    const wheelOrbit = (event: WheelEvent) => {
      // Los gestos de dos dedos del trackpad emiten wheel sin necesidad de hacer clic.
      event.preventDefault();
      enableOrbit();
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1;
      const dx = event.deltaX * factor;
      const dy = event.deltaY * factor;
      if (event.shiftKey) {
        orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + dy * 0.0028, 0.04, 1.35);
      } else {
        orbit.yaw -= dx * 0.0045;
        orbit.radius = THREE.MathUtils.clamp(orbit.radius * Math.exp(dy * 0.0011), 6.0, 44);
      }
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);
    renderer.domElement.addEventListener('wheel', wheelOrbit, { passive: false });

    // Flechas izquierda y derecha: dirección progresiva con autocentrado.
    // No capturamos las teclas si el usuario escribe en campos de texto.
    const isEditing = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return !!element && (element.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName));
    };
    const keyDown = (event: KeyboardEvent) => {
      if ((experience !== 'race' && experience !== 'legacy') || isEditing(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
      const bounds = container.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
      if (event.code === 'KeyC') {
        event.preventDefault();
        soundEngine.unlock();
        soundEngine.playSeatbeltClick();
        seatbeltBuckledRef.current = true;
        physicsRef.current?.setSeatbeltBuckled(true);
        setSeatbeltBuckled(true);
        return;
      }
      const turnAction = mapKeyCodeToTurnSignalAction(event.code);
      if (turnAction && experience === 'race') {
        event.preventDefault();
        const nextMode = applyTurnSignalAction(turnSignalRef.current.mode, turnAction);
        const nowSec = performance.now() / 1000;
        turnSignalRef.current = { mode: nextMode, activatedAtSec: nowSec };
        setTurnSignalMode(nextMode);
        const immediate = evaluateTurnSignalBlink(nextMode, nowSec, nowSec);
        setTurnSignalBlinkHud({ leftLit: immediate.leftLit, rightLit: immediate.rightLit });
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space'].includes(event.code) || event.key === ' ') {
        event.preventDefault();
        if (event.code === 'ArrowLeft' || event.code === 'KeyA') keyboardControlsRef.current.left = true;
        if (event.code === 'ArrowRight' || event.code === 'KeyD') keyboardControlsRef.current.right = true;
        if (event.code === 'ArrowUp' || event.code === 'KeyW') keyboardControlsRef.current.throttle = true;
        if (event.code === 'ArrowDown' || event.code === 'KeyS') keyboardControlsRef.current.reverse = true;
        if (event.code === 'Space' || event.key === ' ') keyboardControlsRef.current.brake = true;
        keyboardSteeringRef.current = true;
        syncCombinedControls();
        soundEngine.unlock();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') keyboardControlsRef.current.left = false;
      if (event.code === 'ArrowRight' || event.code === 'KeyD') keyboardControlsRef.current.right = false;
      if (event.code === 'ArrowUp' || event.code === 'KeyW') keyboardControlsRef.current.throttle = false;
      if (event.code === 'ArrowDown' || event.code === 'KeyS') keyboardControlsRef.current.reverse = false;
      if (event.code === 'Space' || event.key === ' ') keyboardControlsRef.current.brake = false;
      syncCombinedControls();
    };
    const releaseKeys = () => {
      keyboardControlsRef.current.left = false;
      keyboardControlsRef.current.right = false;
      keyboardControlsRef.current.throttle = false;
      keyboardControlsRef.current.reverse = false;
      keyboardControlsRef.current.brake = false;
      syncCombinedControls();
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', releaseKeys);

    // 2. Iluminación exterior HDR vespertina (sol dorado rasante + sombras proyectadas en tiempo real)
    const sunnyAtm = getHyperrealAtmosphere('sunny');
    const ambientLight = new THREE.AmbientLight(sunnyAtm.ambientHex, sunnyAtm.ambientIntensity);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(
      sunnyAtm.hemiSkyHex,
      sunnyAtm.hemiGroundHex,
      sunnyAtm.hemiIntensity,
    );
    scene.add(hemiLight);

    const sunDirVec = new THREE.Vector3(sunnyAtm.sunDir[0], sunnyAtm.sunDir[1], sunnyAtm.sunDir[2]);
    const keyLight = new THREE.DirectionalLight(sunnyAtm.sunLightHex, sunnyAtm.sunIntensity);
    keyLight.position.copy(sunDirVec).multiplyScalar(115);
    keyLight.castShadow = realtimeShadowsEnabled;
    if (realtimeShadowsEnabled) {
      const shadowRes = !isSoftwareGl && !perfProfile.isMobilePerf ? 2048 : 1024;
      keyLight.shadow.mapSize.set(shadowRes, shadowRes);
      keyLight.shadow.camera.near = 8;
      keyLight.shadow.camera.far = 240;
      keyLight.shadow.camera.left = -54;
      keyLight.shadow.camera.right = 54;
      keyLight.shadow.camera.top = 58;
      keyLight.shadow.camera.bottom = -48;
      keyLight.shadow.bias = -0.00035;
      keyLight.shadow.normalBias = 0.024;
      keyLight.shadow.radius = 2.0;
    }
    scene.add(keyLight);
    scene.add(keyLight.target);

    const fillLight = new THREE.DirectionalLight('#ffedd4', 0.76);
    fillLight.position.set(-18, 26, -34);
    scene.add(fillLight);
    scene.add(fillLight.target);

    // Sonda de reflexión dinámica en tiempo real (cubemap adaptable a edificios, viaductos y arboleda)
    const dynamicReflectionProbe = createDynamicReflectionProbe(scene, {
      resolution: perfProfile.isMobilePerf ? 96 : 128,
      far: 440,
    });

    // 3. Trazado de asfalto tridimensional con carriles amplios en ambos sentidos (21m en modo carrera urbana)
    const trackLength = Math.max(track.distanceMeters + 120, 550);
    const roadWidth = experience === 'race' ? URBAN_ROAD_WIDTH : 14.0;
    const trackGroup = new THREE.Group();

    // Superficie de asfalto PBR con normales de alta resolución, especularidad, humedad y charcos reflectivos
    const roadCenterZ = trackLength / 2 - 20;
    const roadGeo = roadPath.isCurved
      ? makeCurvedAsphalt(roadPath, roadWidth, trackLength, [])
      : createDepressedRoadGeometry(roadWidth, trackLength, roadCenterZ, []);
    const roadTex = createAsphaltTexture(track.routeHazardProfile);
    const maxAniso = Math.min(
      perfProfile.maxAnisotropy,
      renderer.capabilities.getMaxAnisotropy?.() || perfProfile.maxAnisotropy,
    );
    roadTex.anisotropy = maxAniso;
    roadTex.repeat.set(1, Math.max(8, Math.round(trackLength / 14)));
    const asphaltRelief = createAsphaltMicroRelief();
    asphaltRelief.anisotropy = maxAniso;
    asphaltRelief.repeat.copy(roadTex.repeat);
    const asphaltRoughness = createAsphaltRoughnessTexture(track.routeHazardProfile);
    asphaltRoughness.anisotropy = maxAniso;
    asphaltRoughness.repeat.copy(roadTex.repeat);
    const asphaltNormal = createAsphaltNormalTexture(track.routeHazardProfile);
    asphaltNormal.anisotropy = maxAniso;
    asphaltNormal.repeat.copy(roadTex.repeat);
    const asphaltDetailNormal = createAsphaltCloseUpDetailNormalTexture();
    asphaltDetailNormal.anisotropy = maxAniso;
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      normalMap: asphaltNormal,
      normalScale: new THREE.Vector2(0.74, 0.74),
      bumpMap: asphaltRelief,
      bumpScale: 0.022,
      roughnessMap: asphaltRoughness,
      color: track.routeHazardProfile === 'flood' ? '#8ea8b9'
        : track.routeHazardProfile === 'cobbles' ? '#b3b0b5' : '#ffffff',
      roughness: track.routeHazardProfile === 'flood' ? 0.34 : 0.80,
      metalness: track.routeHazardProfile === 'flood' ? 0.24 : 0.11,
      envMapIntensity: 1.55,
    });
    const puddleShaderHandle = enhanceAsphaltMaterialWithPuddles(roadMat, dynamicReflectionProbe.texture, {
      detailNormalMap: asphaltDetailNormal,
      trackSeed: track.trackIndex ?? 1,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    if (!roadPath.isCurved) {
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0, roadCenterZ);
    }
    road.receiveShadow = realtimeShadowsEnabled;
    trackGroup.add(road);

    // Bordillos de carrera rojo y blanco en los bordes
    const kerbWidth = 0.85;
    const kerbGeo = new THREE.PlaneGeometry(kerbWidth, trackLength);
    const kerbTex = createKerbTexture();
    kerbTex.anisotropy = maxAniso;
    kerbTex.repeat.set(1, Math.round(trackLength / 4));
    const kerbMat = new THREE.MeshStandardMaterial({
      map: kerbTex,
      roughness: 0.6,
      metalness: 0.1,
    });

    const leftKerb = new THREE.Mesh(kerbGeo, kerbMat);
    leftKerb.rotation.x = -Math.PI / 2;
    leftKerb.position.set(-roadWidth / 2 - kerbWidth / 2, 0.01, trackLength / 2 - 20);
    if (!track.cityCircuitId) trackGroup.add(leftKerb);

    const rightKerb = new THREE.Mesh(kerbGeo, kerbMat);
    rightKerb.rotation.x = -Math.PI / 2;
    rightKerb.position.set(roadWidth / 2 + kerbWidth / 2, 0.01, trackLength / 2 - 20);
    if (!track.cityCircuitId) trackGroup.add(rightKerb);

    // Línea de salida (pintura termoplástica PBR en z = 0 que recibe sombras reales)
    const startLineGeo = new THREE.PlaneGeometry(roadWidth, 0.6);
    const startLineMat = new THREE.MeshStandardMaterial({
      color: '#dcd6c8',
      roughness: 0.56,
      metalness: 0.04,
    });
    const startLine = new THREE.Mesh(startLineGeo, startLineMat);
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.set(0, 0.02, 0);
    startLine.receiveShadow = realtimeShadowsEnabled;
    trackGroup.add(startLine);

    // Línea de meta a cuadros (Checkered pattern PBR en track.distanceMeters)
    const finishLineGeo = new THREE.PlaneGeometry(roadWidth, 2.4);
    const finishTex = createCheckeredFinishTexture();
    finishTex.anisotropy = maxAniso;
    const finishLineMat = new THREE.MeshStandardMaterial({
      map: finishTex,
      roughness: 0.54,
      metalness: 0.04,
    });
    const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
    const finalRoadPoint = roadPath.world(track.distanceMeters, 0);
    finishLine.rotation.set(-Math.PI / 2, 0, -finalRoadPoint.yaw);
    finishLine.position.set(finalRoadPoint.x, 0.02, finalRoadPoint.z);
    finishLine.receiveShadow = realtimeShadowsEnabled;
    trackGroup.add(finishLine);

    // Estructuras de pórticos
    const gantryMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.35,
      metalness: 0.75,
    });

    // Pórtico de salida con semáforos
    const gantryGroup = new THREE.Group();
    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 0.5), gantryMat);
    leftPost.position.set(-roadWidth / 2 - 1.0, 3.1, 0);
    leftPost.castShadow = realtimeShadowsEnabled;
    leftPost.receiveShadow = realtimeShadowsEnabled;
    gantryGroup.add(leftPost);

    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 0.5), gantryMat);
    rightPost.position.set(roadWidth / 2 + 1.0, 3.1, 0);
    rightPost.castShadow = realtimeShadowsEnabled;
    rightPost.receiveShadow = realtimeShadowsEnabled;
    gantryGroup.add(rightPost);

    const topTruss = new THREE.Mesh(new THREE.BoxGeometry(roadWidth + 3.0, 0.8, 0.6), gantryMat);
    topTruss.position.set(0, 6.2, 0);
    topTruss.castShadow = realtimeShadowsEnabled;
    topTruss.receiveShadow = realtimeShadowsEnabled;
    gantryGroup.add(topTruss);

    const lightBulbs: THREE.Mesh[] = [];
    for (let l = 0; l < 3; l++) {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 16, 16),
        new THREE.MeshBasicMaterial({ color: '#ef4444' })
      );
      bulb.position.set((l - 1) * 0.85, 5.8, 0.35);
      gantryGroup.add(bulb);
      lightBulbs.push(bulb);
    }
    bendRoadsideGroup(gantryGroup, roadPath);
    trackGroup.add(gantryGroup);

    // Arco de llegada con cartel de meta
    const finishArchGroup = new THREE.Group();
    const finishPostLeft = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7.2, 0.6), gantryMat);
    finishPostLeft.position.set(-roadWidth / 2 - 1.0, 3.6, track.distanceMeters);
    finishArchGroup.add(finishPostLeft);

    const finishPostRight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7.2, 0.6), gantryMat);
    finishPostRight.position.set(roadWidth / 2 + 1.0, 3.6, track.distanceMeters);
    finishArchGroup.add(finishPostRight);

    const finishTruss = new THREE.Mesh(new THREE.BoxGeometry(roadWidth + 3.2, 1.4, 0.8), gantryMat);
    finishTruss.position.set(0, 7.0, track.distanceMeters);
    finishArchGroup.add(finishTruss);

    const finishBannerGeo = new THREE.PlaneGeometry(roadWidth * 0.72, 1.15);
    const finishBannerTex = createDistanceSignTexture(`🏁 META ${track.distanceMeters}m`);
    finishBannerTex.anisotropy = maxAniso;
    const finishBannerMat = new THREE.MeshBasicMaterial({ map: finishBannerTex });
    const finishBanner = new THREE.Mesh(finishBannerGeo, finishBannerMat);
    finishBanner.position.set(0, 7.0, track.distanceMeters - 0.42);
    finishBanner.rotation.y = Math.PI;
    finishArchGroup.add(finishBanner);

    // Cartel posterior de meta visible desde la cámara frontal
    const finishBannerRear = new THREE.Mesh(finishBannerGeo, finishBannerMat);
    finishBannerRear.position.set(0, 7.0, track.distanceMeters + 0.42);
    finishArchGroup.add(finishBannerRear);
    bendRoadsideGroup(finishArchGroup, roadPath);
    trackGroup.add(finishArchGroup);

    // Señales kilométricas laterales (50m, 100m, 200m, etc.)
    const signIntervals = [50, 100, 200, 300, 400, 500, 600, 800].filter((d) => d < track.distanceMeters);
    signIntervals.forEach((dist) => {
      const signGroup = new THREE.Group();
      const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5), gantryMat);
      signPost.position.set(roadWidth / 2 + 1.5, 1.25, dist);
      signGroup.add(signPost);

      const distSignTex = createDistanceSignTexture(`${dist}m`);
      distSignTex.anisotropy = maxAniso;
      const signBoard = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.8),
        new THREE.MeshBasicMaterial({ map: distSignTex })
      );
      signBoard.position.set(roadWidth / 2 + 1.5, 2.2, dist);
      signBoard.rotation.y = -Math.PI / 2;
      signGroup.add(signBoard);
      bendRoadsideGroup(signGroup, roadPath);
      trackGroup.add(signGroup);
    });

    // Señalización, veredas, plazas de pasto, peatones 3D, Río Paraguay, Paseo La Galería y skyline de múltiples alturas.
    const urbanEnvironment = createUrbanTrackScenery(
      roadWidth,
      trackLength,
      track.routeHazardProfile,
      Boolean(track.cityCircuitId),
      track.cityCircuitId,
    );
    bendRoadsideGroup(urbanEnvironment, roadPath);
    urbanEnvironment.userData.initPedestrians?.(roadPath);
    urbanEnvironment.userData.applyDynamicReflectionEnvMap?.(dynamicReflectionProbe.texture);
    trackGroup.add(urbanEnvironment);
    // V9.3: viaductos elevados ficticios, con publicidad aplicada a los parapetos.
    // Los apoyos están fuera de la calzada y no alteran la física.
    let viaductsGroup: THREE.Group | null = null;
    if (track.cityCircuitId) {
      viaductsGroup = createDatacarViaducts3D(roadWidth, track.distanceMeters, track.routeHazardProfile);
      bendRoadsideGroup(viaductsGroup, roadPath);
      trackGroup.add(viaductsGroup);
    }
    const isSpeedProRace = experience === 'race' && raceMode === 'speed_pro';
    if (track.cityCircuitId && !isSpeedProRace) {
      const { speedBumps } = getAsuncionStreetDetails(track.routeHazardProfile, track.distanceMeters);
      const raisedBumps = createSpeedBumps3D(roadWidth, speedBumps);
      bendRoadsideGroup(raisedBumps, roadPath);
      trackGroup.add(raisedBumps);
    }
    [gantryGroup, finishArchGroup].forEach((grp) => {
      grp.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    });
    scene.add(trackGroup);
    const weatherVisuals = createWeatherVisuals3D(scene, track.distanceMeters, track.routeHazardProfile, roadPath);
    const autumnParticles = createAutumnAtmosphericParticles({
      isMobilePerf: perfProfile.isMobilePerf,
    });
    scene.add(autumnParticles.group);
    const nfsmwPostProcessor = createNfsmwPostProcessor({
      renderer,
      scene,
      camera,
      width,
      height,
      pixelRatio: renderDpr,
      isMobilePerf: perfProfile.isMobilePerf,
    });
    container.dataset.nfsmwPipeline = 'active';
    const initialRoadColor = roadMat.color.clone();
    let lastWeatherApplied: WeatherMode | null = null;

    // 3B. Modo de carrera interactiva: Fase 1 (ciudad con semáforos y peatones) o Fase 2 (velocidad pura sin obstáculos + IA élite).
    const effectiveHazardsEnabled = hazardsEnabled && !isSpeedProRace;
    const racePhysics = interactiveMode
      ? new InteractiveRacePhysics(vehicles, track, stateRef.current.selectedVehicleId, effectiveHazardsEnabled, {
          urbanTrafficRules: experience === 'race' && !isSpeedProRace,
          speedRaceMode: isSpeedProRace,
          playerPayloadKg,
        })
      : null;
    physicsRef.current = racePhysics;
    if (seatbeltBuckledRef.current) {
      racePhysics?.setSeatbeltBuckled(true);
    }
    racePhysics?.setWeather(weatherModeRef.current);
    setHazardCount(racePhysics?.hazards.length ?? 0);
    const urbanTrafficVisuals = racePhysics?.urbanRulesEnabled
      ? createUrbanTrafficVisuals3D({
          roadPath,
          roadWidth,
          trackDistanceMeters: track.distanceMeters,
          laps: Math.max(1, track.laps ?? 1),
          lights: racePhysics.trafficLights,
          speedZones: racePhysics.speedZones,
          oncomingCount: racePhysics.oncomingCars.length,
          envMap: vehicleEnvTexture,
        })
      : null;
    if (urbanTrafficVisuals) {
      scene.add(urbanTrafficVisuals.group);
      scene.add(urbanTrafficVisuals.splashGroup);
    }
    const streetCrossings = track.cityCircuitId
      ? getAsuncionStreetDetails(track.routeHazardProfile, track.distanceMeters).crossings.map(c => c.z)
      : [];
    const centralMedianVisuals = createCentralMedianVisuals3D({
      roadPath,
      roadWidthM: roadWidth,
      trackDistanceMeters: track.distanceMeters,
      cityCircuitId: track.cityCircuitId,
      routeHazardProfile: track.routeHazardProfile,
      isDragStrip: !track.cityCircuitId || isSpeedProRace,
      lights: racePhysics?.trafficLights ?? [],
      crossingZs: streetCrossings,
      hazardCenters: (racePhysics?.hazards ?? []).map(h => ({ x: h.x, z: h.z, radiusM: h.radius })),
    });
    scene.add(centralMedianVisuals.group);

    let forwardMotorcycles: ForwardMotorcycleActor[] =
      experience === 'race' && !isSpeedProRace && Boolean(track.cityCircuitId)
        ? createForwardMotorcyclePool(track)
        : [];
    const forwardMotorcyclesVisuals = createForwardMotorcyclesVisuals3D({
      roadPath,
      actors: forwardMotorcycles,
    });
    scene.add(forwardMotorcyclesVisuals.group);

    [urbanTrafficVisuals?.group, centralMedianVisuals.group, forwardMotorcyclesVisuals.group].forEach((grp) => {
      grp?.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material;
          const primary = Array.isArray(mat) ? mat[0] : mat;
          if (primary && primary.blending !== THREE.AdditiveBlending) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        }
      });
    });

    let digitalRearviewMirror: DigitalRearviewMirrorController | null = null;

    const hazardsGroup = new THREE.Group();
    hazardsGroup.name = 'obstaculos_fisicos';
    trackGroup.add(hazardsGroup);
    const hazardGeometry = new THREE.CylinderGeometry(0.67, 0.83, 1.25, 12);
    const barrelBodyMaterial = new THREE.MeshStandardMaterial({ color: '#e97825', roughness: .67, metalness: .1 });
    const barrelStripeMaterial = new THREE.MeshStandardMaterial({ color: '#eee8da', roughness: .72 });
    const potholeMaterial = new THREE.MeshStandardMaterial({ color: '#111821', roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1 });
    const potholeVisualKit = createPotholeVisualKit(track.routeHazardProfile);
    // La calzada cambia de geometría SOLO si cambia el catálogo de baches.
    // ShapeGeometry deja huecos geométricos y el kit dibuja las paredes 17 cm más abajo.
    const updateRoadCutouts = (allHazards: readonly TrackHazard[]) => {
      const oldGeometry = road.geometry;
      road.geometry = roadPath.isCurved
        ? makeCurvedAsphalt(roadPath, roadWidth, trackLength, allHazards)
        : createDepressedRoadGeometry(roadWidth, trackLength, roadCenterZ, allHazards);
      oldGeometry.dispose();
    };
    updateRoadCutouts(experience === 'replay' ? (replayHazards ?? []) : (racePhysics?.hazards ?? []));
    const addHazardVisual = (hazard: TrackHazard) => {
      const visual = new THREE.Group();
      visual.name = `hazard_${hazard.kind}_${hazard.id}`;
      const hWorld = roadPath.world(hazard.z, hazard.x);
      visual.position.set(hWorld.x, 0, hWorld.z);
      visual.rotation.y = hWorld.yaw;
      if (hazard.kind === 'pothole') {
        visual.add(potholeVisualKit.create(hazard));
      } else {
        const barrel = new THREE.Mesh(hazardGeometry, barrelBodyMaterial);
        barrel.position.y = .66;
        visual.add(barrel);
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(.70, .75, .21, 12), barrelStripeMaterial);
        stripe.position.y = .77;
        visual.add(stripe);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(.66, .66, .10, 12), potholeMaterial);
        cap.position.y = 1.3;
        visual.add(cap);
      }
      hazardsGroup.add(visual);
    };
    racePhysics?.hazards.forEach(addHazardVisual);
    if (experience === 'replay') replayHazards?.forEach(addHazardVisual);
    raceHazardsSnapshotRef.current = racePhysics?.hazards ?? [];
    placeHazardAtRef.current = (kind: HazardKind, x: number, z: number) => {
      const activePhysics = physicsRef.current;
      if (!activePhysics || !hazardsEnabled) return;
      const added = activePhysics.addHazard(kind, x, z);
      if (!added) {
        setRaceEvent('No se pudo colocar: cerca de otro obstáculo, la salida o la meta.');
        return;
      }
      addHazardVisual(added);
      if (added.kind === 'pothole') updateRoadCutouts(activePhysics.hazards);
      raceHazardsSnapshotRef.current = activePhysics.hazards.map(h => ({ ...h }));
      setHazardCount(activePhysics.hazards.length);
    };
    addVisualHazardRef.current = (kind: HazardKind) => {
      const activePhysics = physicsRef.current;
      if (!activePhysics || !hazardsEnabled) return;
      const player = activePhysics.getCar(stateRef.current.selectedVehicleId);
      const ahead = (player?.z || 0) + Math.max(35, (player?.speed || 12) * 1.6);
      const maxEditX = activePhysics.urbanRulesEnabled ? -1.2 : 4.8;
      const minEditX = activePhysics.urbanRulesEnabled ? -(activePhysics.roadHalfWidth - 1.5) : -4.8;
      const x = player ? Math.max(minEditX, Math.min(maxEditX, player.x + (kind === 'pothole' ? 0 : -2.4))) : -4.2;
      placeHazardAtRef.current?.(kind, x, ahead);
    };

    // Marcas de derrape instanciadas: un solo draw call, sin crear una malla por marca.
    const skidGeometry = new THREE.PlaneGeometry(.14, .82);
    const skidMaterial = new THREE.MeshBasicMaterial({
      color: '#070b11', transparent: true, opacity: .60,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const maxSkidMarks = 900;
    const skidMarks = new THREE.InstancedMesh(skidGeometry, skidMaterial, maxSkidMarks);
    skidMarks.count = 0;
    skidMarks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    skidMarks.frustumCulled = false;
    trackGroup.add(skidMarks);
    const _skidMatrix = new THREE.Matrix4();
    const _skidPosition = new THREE.Vector3();
    const _skidRotation = new THREE.Quaternion();
    const _skidScale = new THREE.Vector3(1, 1, 1);
    const _skidEuler = new THREE.Euler();
    let lastSkidTime = 0;
    let skidIndex = 0;

    // 4. Instanciar competidores en 3D: en mobile solo el auto elegido por el jugador carga .glb
    // y los rivales emplean su modelo 3D liviano por defecto (0 MB descarga extra, mínima VRAM).
    const vehicleEntities: VehicleEntityRunner[] = [];
    const activePlayerId = playerVehicleId || stateRef.current.selectedVehicleId || vehicles[0]?.id || '';
    let sceneDisposed = false;
    let completedModels = 0;
    let proceduralRivalCount = 0;
    setLoadedVehicleModels(0);
    setGlbLoadError(null);
    setIsGlbLoading(requiredVehicleModels > 0);
    vehicles.forEach((vehicle, idx) => {
      const preferProceduralModel = shouldUseLightweightProceduralVehicle({
        isMobilePerf: perfProfile.isMobilePerf,
        experience,
        vehicleId: vehicle.id,
        playerVehicleId: activePlayerId,
      });
      if (preferProceduralModel) proceduralRivalCount += 1;
      const entity = createVehicleEntity(
        vehicle,
        idx,
        vehicles.length,
        () => {
          if (sceneDisposed) return;
          completedModels += 1;
          setLoadedVehicleModels(completedModels);
          if (completedModels >= requiredVehicleModels) setIsGlbLoading(false);
        },
        (err) => {
          if (sceneDisposed) return;
          console.error(err);
          setGlbLoadError(`No se pudo cargar el modelo 3D de ${vehicle.name}`);
          setIsGlbLoading(false);
        },
        vehicleEnvTexture,
        undefined,
        { preferProceduralModel },
      );
      entity.setNameplateVisible(stateRef.current.showVehicleLabels);
      scene.add(entity.group);
      vehicleEntities.push(entity);
    });
    container.dataset.lightweightRivals = String(proceduralRivalCount);

    // Entidades 3D en tiempo real para rivales humanos conectados en línea por WebSocket
    const onlinePeerEntities = new Map<
      string,
      {
        entity: VehicleEntityRunner;
        smoothX: number;
        smoothZ: number;
        smoothYaw: number;
      }
    >();
    let arrestTriggered = false;

    // Director TV: cobertura de varias cámaras con corte frontal de llegada.
    let directorShot: DirectorShot | null = null;
    let previousEffectiveShot: string | null = null;
    let lastAutoMode = stateRef.current.cameraMode;

    // Loop de animación y sincronización física-visual ultrafluida
    let animationFrameId = 0;
    let softwareGlTimerId = 0;
    let sceneReadyReported = false;
    let lastTime = performance.now();
    let lastUiSyncTime = performance.now();
    let frameCount = 0;
    let lastFpsCalcTime = performance.now();
    let slowFpsStreak = 0;
    let fastFpsStreak = 0;
    // La GPU puede sufrir con 4 GLB densos. Ajustar resolución, nunca la física.
    let lastDprChangeAt = 0;

    const _camTarget = new THREE.Vector3();
    const _desiredCamPos = new THREE.Vector3();
    const _smoothedCamTarget = new THREE.Vector3();
    const playerWorldLampState: VehicleWorldLampState = {
      headLeft: new THREE.Vector3(0, -50, 0),
      headRight: new THREE.Vector3(0, -50, 0),
      headDir: new THREE.Vector3(0, -0.08, 1),
      headIntensity: 0,
      brakeLeft: new THREE.Vector3(0, -50, 0),
      brakeRight: new THREE.Vector3(0, -50, 0),
      brakeIntensity: 0,
    };
    let cameraTargetInitialized = false;
    let lastSteeringHudSync = 0;
    let physicsAccumulator = 0;
    const lastPhysicsPose = new Map<string, RenderPose>();
    let lastRoadImpactAudioAt = -Infinity;
    // Cámara de llegada: se activa cuando el JUGADOR cruza la línea, no al llegar el último rival.
    let finishCinematicStartedAt = -Infinity;
    let finishCarPose: { x:number; z:number; yaw:number } | null = null;
    const lastImpacts = new Map<string, number>();
    const lastBumps = new Map<string, boolean>();
    resetVisualRaceRef.current = () => {
      skidMarks.count = 0;
      skidIndex = 0;
      lastSkidTime = 0;
      physicsAccumulator = 0;
      lastPhysicsPose.clear();
      lastRoadImpactAudioAt = -Infinity;
      finishCinematicStartedAt = -Infinity;
      finishCarPose = null;
      lastImpacts.clear();
      lastBumps.clear();
      skidMarks.instanceMatrix.needsUpdate = true;
      if (forwardMotorcycles.length > 0) {
        const freshMotos = createForwardMotorcyclePool(track);
        for (let i = 0; i < Math.min(forwardMotorcycles.length, freshMotos.length); i++) {
          Object.assign(forwardMotorcycles[i], freshMotos[i]);
        }
        forwardMotorcyclesVisuals.update(forwardMotorcycles);
      }
    };

    let ambientCityTimeSec = 0;
    let droneFlyoverSec = 0;

    const tick = (now: number) => {
      // Evitar deltas negativos y saltos tras cambiar de pestaña/GPU stall.
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 0.05);
      lastTime = now;
      ambientCityTimeSec += dt;

      // Cálculo de métricas de rendimiento (GPU / Engine)
      frameCount++;
      if (now - lastFpsCalcTime >= 850) {
        const measuredFps = Math.round((frameCount * 1000) / (now - lastFpsCalcTime));
        setDiagStats({
          fps: measuredFps,
          frameTimeMs: parseFloat((dt * 1000).toFixed(1)),
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
        });
        // Adaptación con histéresis (cambios espaciados): menos pixel fill
        // cuando el equipo no sostiene FPS, sin zoom ni saltos de cámara.
        if (!isSoftwareGl && now - lastDprChangeAt > 3800 && experience === 'race') {
          slowFpsStreak = measuredFps < 43 ? slowFpsStreak + 1 : 0;
          fastFpsStreak = measuredFps > 57 ? fastFpsStreak + 1 : 0;
          let nextDpr = renderDpr;
          if (slowFpsStreak >= 2) nextDpr = Math.max(0.8, renderDpr - 0.15);
          else if (fastFpsStreak >= 5) nextDpr = Math.min(maxDpr, renderDpr + 0.07);
          if (Math.abs(nextDpr - renderDpr) > 0.01) {
            renderDpr = nextDpr;
            renderer.setPixelRatio(renderDpr);
            nfsmwPostProcessor.setSize(
              container.clientWidth || width,
              container.clientHeight || height,
              renderDpr,
            );
            lastDprChangeAt = now;
            slowFpsStreak = fastFpsStreak = 0;
          }
        }
        frameCount = 0;
        lastFpsCalcTime = now;
      }

      // Dirección con teclado: mantener pulsada una flecha lleva el volante
      // progresivamente a +/-30°, al soltar vuelve con amortiguación suave.
      if (keyboardSteeringRef.current || steeringKeysRef.current.left || steeringKeysRef.current.right) {
        const { left, right } = steeringKeysRef.current;
        const targetDeg = left === right ? 0 : left ? -30 : 30;
        const nextDeg = THREE.MathUtils.damp(
          stateRef.current.steeringDemoDeg, targetDeg,
          left || right ? 7.2 : 5.8, dt,
        );
        stateRef.current.steeringDemoDeg = Math.abs(nextDeg - targetDeg) < 0.07 ? targetDeg : nextDeg;
        if (!left && !right && Math.abs(stateRef.current.steeringDemoDeg) < 0.07) {
          keyboardSteeringRef.current = false;
          stateRef.current.steeringDemoDeg = 0;
        }
        if (now - lastSteeringHudSync > 90 || !keyboardSteeringRef.current) {
          setSteeringDemoDeg(Math.round(stateRef.current.steeringDemoDeg));
          lastSteeringHudSync = now;
        }
      }
      const { isPlaying, playbackSpeed, maxRaceTimeSec, countdown, cameraMode, selectedVehicleId } = stateRef.current;

      // Integración física a 100 Hz, independientemente de los FPS de GPU.
      // La carrera clásica precalculada permanece disponible como alternativa.
      const livePhysics = interactiveMode ? physicsRef.current : null;
      if (livePhysics) livePhysics.playerId = selectedVehicleId;
      if (isPlaying && countdown === null) {
        if (livePhysics) {
          physicsAccumulator = Math.min(.1, physicsAccumulator + dt * playbackSpeed);
          const input = {
            steer: steeringKeysRef.current.right === steeringKeysRef.current.left ? 0 :
              steeringKeysRef.current.right ? 1 : -1,
            throttle: steeringKeysRef.current.throttle ? 1 : 0,
            reverse: steeringKeysRef.current.reverse ? 1 : 0,
            brake: steeringKeysRef.current.brake ? 1 : 0,
          };
          // El deslizador sigue siendo válido para la dirección manual.
          if (!steeringKeysRef.current.left && !steeringKeysRef.current.right &&
              !keyboardSteeringRef.current && stateRef.current.steeringDemoDeg !== 0) {
            input.steer = stateRef.current.steeringDemoDeg / 30;
          }
          let steps = 0;
          while (physicsAccumulator >= PHYSICS_STEP && steps < 12 &&
            !(experience === 'race' ? livePhysics.playerFinished : livePhysics.finished)) {
            // Snapshot justo ANTES del último paso: luego interpolaremos la
            // imagen sin tocar estados oficiales ni resultados de colisiones.
            for (const c of livePhysics.cars) lastPhysicsPose.set(c.id, snapshotRenderPose(c));
            livePhysics.step(PHYSICS_STEP, input);
            physicsAccumulator -= PHYSICS_STEP;
            steps++;
          }
          if (livePhysics.time - lastSkidTime >= .085) {
            lastSkidTime = livePhysics.time;
            for (const car of livePhysics.cars) {
              if (car.slip < .36 || car.speed < 5) continue;
              for (const side of [-.74, .74]) {
                const localSkidX = car.x + Math.sin(car.yaw) * -1.36 + Math.cos(car.yaw) * side;
                const localSkidS = car.z + Math.cos(car.yaw) * -1.36 - Math.sin(car.yaw) * side;
                const skidWorld = roadPath.world(localSkidS, localSkidX);
                _skidPosition.set(skidWorld.x, .027, skidWorld.z);
                _skidEuler.set(-Math.PI / 2, car.yaw + skidWorld.yaw, 0, 'YXZ');
                _skidRotation.setFromEuler(_skidEuler);
                _skidMatrix.compose(_skidPosition, _skidRotation, _skidScale);
                skidMarks.setMatrixAt(skidIndex % maxSkidMarks, _skidMatrix);
                skidIndex++;
              }
            }
            skidMarks.count = Math.min(maxSkidMarks, skidIndex);
            skidMarks.instanceMatrix.needsUpdate = true;
          }
          // Un golpe de suspensión produce sonido solo cuando el terreno lo causa,
          // no al tocar el freno. 350ms de espera evitan un traqueteo artificial.
          const ownSuspension = livePhysics.getCar(selectedVehicleId)?.suspension;
          if (ownSuspension && ownSuspension.impact > .17 &&
              livePhysics.time - lastRoadImpactAudioAt > .30) {
            soundEngine.playSuspensionHit(.28 + ownSuspension.impact * .72);
            lastRoadImpactAudioAt = livePhysics.time;
          }
          if (livePhysics.lastWetSplash && livePhysics.lastWetSplash.seq !== lastSplashSeqRef.current) {
            const splash = livePhysics.lastWetSplash;
            lastSplashSeqRef.current = splash.seq;
            const wp = roadPath.world(splash.z, splash.x);
            urbanTrafficVisuals?.triggerSplash(wp.x, wp.z, splash.intensity);
            if (splash.carId === selectedVehicleId) {
              soundEngine.playWaterSplash(splash.intensity);
              setSplashHudActive(true);
              if (splashTimeoutRef.current !== null) clearTimeout(splashTimeoutRef.current);
              splashTimeoutRef.current = setTimeout(() => setSplashHudActive(false), 780);
            }
          }
          stateRef.current.currentTimeSec = livePhysics.time;

          // Emitir telemetría local a 20 Hz si estamos en carrera multijugador en línea
          if (onlineSession && experience === 'race') {
            const ownLive = livePhysics.getCar(selectedVehicleId);
            if (ownLive) {
              multiplayerClient.sendLocalCarState({
                x: ownLive.x,
                z: ownLive.z,
                yaw: ownLive.yaw,
                speed: ownLive.speed,
                steer: ownLive.steer,
                braking: ownLive.braking,
              });
            }
          }

          // Sanción inmediata: atropello a peatón en franja peatonal -> detención policial y 2 minutos de cárcel
          if (livePhysics.pedestrianArrest && !arrestTriggered) {
            arrestTriggered = true;
            stateRef.current.isPlaying = false;
            stateRef.current.hasFinished = true;
            setIsPlaying(false);
            setHasFinished(true);
            soundEngine.stopAll(0.05);
            soundEngine.playPoliceSiren();
            triggerPedestrianArrest(track.name);
            if (onlineSession) {
              multiplayerClient.reportFinish(livePhysics.time, true);
            }
            onPedestrianArrest?.(livePhysics.pedestrianArrest);
          }
        } else {
          stateRef.current.currentTimeSec += dt * playbackSpeed;
        }
        const raceDone = livePhysics ? (experience === 'race' ? livePhysics.playerFinished : livePhysics.finished) :
          stateRef.current.currentTimeSec >= maxRaceTimeSec + 0.5;
        if (raceDone && !stateRef.current.hasFinished && !arrestTriggered) {
          if (!livePhysics) stateRef.current.currentTimeSec = maxRaceTimeSec;
          stateRef.current.isPlaying = false;
          stateRef.current.hasFinished = true;
          setIsPlaying(false);
          setHasFinished(true);
          if (livePhysics) finalResultsRef.current = livePhysics.makeResults(simulationResults);
          if (onlineSession) {
            multiplayerClient.reportFinish(livePhysics?.time ?? stateRef.current.currentTimeSec, false);
          }
          if (experience === 'race') {
            finishCinematicStartedAt = now;
            const finishedEntity = vehicleEntities.find(e => e.vehicle.id === stateRef.current.selectedVehicleId);
            finishCarPose = finishedEntity ? {x:finishedEntity.group.position.x,z:finishedEntity.group.position.z,yaw:finishedEntity.group.rotation.y}:null;
            setRaceEvent(''); // No cubrir la toma de tu auto con mensajes de llegada.
            setRaceInsight(null);
          }
          // Antes se cortaban motores y muestras instantáneamente,
          // generando clics/zumbidos al cruzar la meta.
          // Silenciar todos los motores al cruzar meta. El travelling posterior es visual.
          soundEngine.stopAll(0.08);
          // Llegada sin ovación: conservar únicamente el fundido del motor.
          if (finishTimerRef.current !== null) clearTimeout(finishTimerRef.current);
          finishTimerRef.current = setTimeout(() => {
            finishTimerRef.current = null;
            if (!resultDeliveredRef.current && stateRef.current.hasFinished) {
              resultDeliveredRef.current = true;
              onFinishRace(finalResultsRef.current ?? undefined, raceHazardsSnapshotRef.current.map(h => ({ ...h })), weatherModeRef.current);
            }
          }, 4000);
        }
        if (timeDisplayRef.current) timeDisplayRef.current.textContent = `${stateRef.current.currentTimeSec.toFixed(2)}s`;
        if (now - lastUiSyncTime >= 180) {
          const uiDeltaSeconds = Math.min(0.4, Math.max(0, (now - lastUiSyncTime) / 1000));
          setCurrentTimeSec(stateRef.current.currentTimeSec);
          if (livePhysics) {
            const player = experience === 'race' ? livePhysics.getCar(selectedVehicleId) : null;
            if (player && !stuckInPothole && !livePhysics.playerFinished) {
              const state=stuckRef.current;
              const motion=Math.abs(player.z-state.lastDistance);
              const nearPothole=livePhysics.hazards.some(h=>h.kind==='pothole' && Math.hypot(h.x-player.x,h.z-player.z)<h.radius+1.15);
              const isTrapped=(player.pothole||nearPothole) && Math.abs(player.speed)*3.6<4 && motion<.4 && (steeringKeysRef.current.throttle||steeringKeysRef.current.reverse);
              state.seconds=isTrapped?state.seconds+uiDeltaSeconds:0;
              state.lastDistance=player.z;
              if(state.seconds>=6){setStuckInPothole(true);setIsPlaying(false);stateRef.current.isPlaying=false;}
            }
            if (player && experience === 'race') {
              const openedNow = reportSimulationFrame({
                isRaceActive: experience === 'race',
                isPaused: !stateRef.current.isPlaying || mobileMenuOpenRef.current,
                isLoading: isPreloadingRef.current,
                isCountdown: stateRef.current.countdown !== null,
                isFinished: Boolean(livePhysics.playerFinished || stateRef.current.hasFinished),
                isDocumentHidden: typeof document !== 'undefined' ? document.hidden : false,
                hasMovementIntent: Boolean(steeringKeysRef.current.throttle || steeringKeysRef.current.reverse),
                positionX: player.x,
                positionZ: player.z,
                speedKmh: Math.abs(player.speed) * 3.6,
                dtSeconds: uiDeltaSeconds,
              });
              if (openedNow) {
                setIsPlaying(false);
                stateRef.current.isPlaying = false;
              }
              const adasTargets = [
                ...livePhysics.cars
                  .filter(c => c.id !== selectedVehicleId)
                  .map(c => ({
                    id: c.id,
                    kind: 'vehicle' as const,
                    x: c.x,
                    z: c.z,
                    longitudinalSpeedMps: c.speed,
                    lengthM: (c.vehicle.dimensions?.lengthMm || 4300) / 1000,
                    widthM: (c.vehicle.dimensions?.widthMm || 1800) / 1000,
                  })),
                ...forwardMotorcycles.map(m => ({
                  id: m.id,
                  kind: 'motorcycle' as const,
                  x: m.x,
                  z: m.z,
                  longitudinalSpeedMps: m.speedMps,
                  lengthM: m.lengthM,
                  widthM: m.widthM,
                })),
              ];
              setAdasReadout(
                evaluateAdasHudReadout({
                  vehicle: player.vehicle,
                  playerX: player.x,
                  playerZ: player.z,
                  playerSpeedKmh: Math.abs(player.speed) * 3.6,
                  solverAebActive: player.aebActive,
                  solverFcwWarning: player.fcwWarning,
                  targets: adasTargets,
                }),
              );
            }
            setPotholeWarning(player && !livePhysics.playerFinished
              ? findUpcomingPothole(livePhysics.hazards, player, player.vehicle.dimensions.widthMm / 1000)
              : null);
            setTimePenaltyHudSec(Math.round(livePhysics.timePenaltySec));
            if (livePhysics.urbanRulesEnabled && player && !livePhysics.playerFinished) {
              setSeatbeltBuckled(livePhysics.seatbeltBuckled);
              setActiveSpeedZone(livePhysics.getActiveSpeedZone(player.z));
              setUpcomingTrafficLight(livePhysics.getUpcomingTrafficLight(player.z, 135));
              setBlindSpotState(livePhysics.getBlindSpotState(selectedVehicleId));
              const notice = livePhysics.lastTrafficNotice;
              if (notice && notice.seq !== lastNoticeSeqRef.current) {
                lastNoticeSeqRef.current = notice.seq;
                setTrafficNotice(notice);
                if (notice.kind === 'penalty' || notice.kind === 'warning') {
                  soundEngine.playTrafficWarningTone(notice.kind === 'penalty');
                }
              } else if (notice && livePhysics.time - notice.createdAtSec > 4.2) {
                setTrafficNotice(prev => (prev?.seq === notice.seq ? null : prev));
              }
            }
            const snapshot: typeof liveVehicleStates = {};
            for (const car of livePhysics.cars) {
              const kmh = Math.abs(car.speed) * 3.6;
              snapshot[car.id] = {
                distance: car.z, lateralX: car.x, speedKmh: kmh, accelG: car.acceleration / 9.80665,
                gear: simulatedGear(car.vehicle,car.speed),
                rpm: Math.round(car.engineRpm),
                impacts: car.impacts, slip: car.slip, pothole: car.pothole, absActive: car.absActive, tcsActive: car.tcsActive, escActive: car.escActive, aebActive: car.aebActive, fcwWarning: car.fcwWarning, laneDepartureWarning: car.laneDepartureWarning,
              };
              if (car.impacts > (lastImpacts.get(car.id) || 0)) {
                setRaceEvent(`💥 ${car.vehicle.name}: choque y pérdida de velocidad`);
                if (car.id === selectedVehicleId) {
                  soundEngine.playImpact(.85);
                  const event = nextRaceInsight(car.vehicle, {
                    speedKmh: kmh, accelG: car.acceleration / 9.80665, rpm: car.engineRpm,
                    slip: car.slip, pothole: car.pothole, impacts: car.impacts,
                    absActive: car.absActive, tcsActive: car.tcsActive, escActive: car.escActive,
                    aebActive: car.aebActive, braking: car.braking,
                  }, {throttle: 0, weather: weatherModeRef.current, elapsedSec: livePhysics.time, newCollision: true}, 0);
                  setRaceInsight(event);
                  lastInsightIdRef.current = event.id;
                  lastUrgentInsightAtRef.current = Date.now();
                }
              }
              if (car.pothole && !lastBumps.get(car.id)) {
                setRaceEvent(`⚠ ${car.vehicle.name}: bache, baja la velocidad`);
                // El golpe ya lo genera la suspensión según su velocidad e intensidad.
                if (car.id === selectedVehicleId && Date.now() - lastUrgentInsightAtRef.current > 2200) {
                  const event = nextRaceInsight(car.vehicle, {
                    speedKmh: kmh, accelG: car.acceleration / 9.80665, rpm: car.engineRpm,
                    slip: car.slip, pothole: car.pothole, impacts: car.impacts,
                    absActive: car.absActive, tcsActive: car.tcsActive, escActive: car.escActive,
                    aebActive: car.aebActive, braking: car.braking,
                  }, {throttle: 0, weather: weatherModeRef.current, elapsedSec: livePhysics.time, newPothole: true}, 0);
                  setRaceInsight(event);
                  lastInsightIdRef.current = event.id;
                  lastUrgentInsightAtRef.current = Date.now();
                }
              }
              lastImpacts.set(car.id, car.impacts);
              lastBumps.set(car.id, car.pothole);
            }
            setLiveVehicleStates(snapshot);
            if (onlineSession) {
              setOnlinePeersHud(
                Array.from(multiplayerClient.peers.values()).map((p) => ({
                  id: `online_${p.clientId}`,
                  pilotName: p.pilotName,
                  distance: p.z,
                  lateralX: p.x,
                })),
              );
            }
          }
          lastUiSyncTime = now;
        }
        if (!stateRef.current.hasFinished && !arrestTriggered) {
          vehicles.forEach(v => {
            const liveCar = livePhysics?.getCar(v.id);
            const st = liveCar ? {
              rpm: Math.round(liveCar.engineRpm),
              speedKmh: Math.abs(liveCar.speed) * 3.6, isBraking: liveCar.braking,
              brakeIntensity: liveCar.brakeIntensity, absActive: liveCar.absActive, brakeSlip: liveCar.brakeSlip,
            } : getInterpolatedVehicleState(v.id, stateRef.current.currentTimeSec);
            soundEngine.updateTelemetry(v, st.rpm, st.speedKmh, st.isBraking, v.id === selectedVehicleId,
              liveCar?.slip ?? 0, v.id === selectedVehicleId && steeringKeysRef.current.throttle ? 1 : 0,
              st.brakeIntensity, st.absActive, st.brakeSlip);
          });
        }
      } else if (!stateRef.current.hasFinished && !arrestTriggered) {
        // Antes de largar (durante el vuelo de cámara Dron sobre la ciudad), el tránsito 3D
        // de mano contraria circula normalmente respetando semáforos sin alterar la carrera.
        if (livePhysics?.urbanRulesEnabled && experience === 'race') {
          stepOncomingTraffic(
            livePhysics.oncomingCars,
            livePhysics.trafficLights,
            livePhysics.speedZones,
            ambientCityTimeSec,
            dt,
            0,
            track.distanceMeters,
          );
        }
        vehicles.forEach(v => soundEngine.updateTelemetry(v, 900, 0, false, false));
      }

      // Semáforos en pórtico
      if (countdown !== null) {
        if (countdown === 0) {
          lightBulbs.forEach((b) => (b.material as THREE.MeshBasicMaterial).color.set('#10b981'));
        } else {
          lightBulbs.forEach((b) => (b.material as THREE.MeshBasicMaterial).color.set('#ef4444'));
        }
      } else {
        lightBulbs.forEach((b) => (b.material as THREE.MeshBasicMaterial).color.set('#10b981'));
      }

      // Calcular posiciones ultrafluidas de cada vehículo
      let minZ = Infinity;
      let maxZ = -Infinity;
      let sumZ = 0;
      let sumX = 0;
      let leaderDist = 0;
      let leaderX = 0;

      const interpolationAlpha = livePhysics && isPlaying && !stateRef.current.hasFinished
        ? THREE.MathUtils.clamp(physicsAccumulator / PHYSICS_STEP, 0, 1) : 1;
      vehicleEntities.forEach((entity) => {
        const car = livePhysics?.getCar(entity.vehicle.id);
        const visualPose = car ? interpolateRenderPose(lastPhysicsPose.get(car.id), car, interpolationAlpha) : undefined;
        const recorded = experience === 'replay' ? getReplayPose(entity.vehicle.id, stateRef.current.currentTimeSec) : undefined;
        const state = car ? {
          distance: visualPose!.z,
          speedKmh: Math.abs(visualPose!.speed) * 3.6,
          accelG: car.acceleration / 9.80665,
          isBraking: car.braking,
          outOfFuel: false,
        } : getInterpolatedVehicleState(entity.vehicle.id, stateRef.current.currentTimeSec);
        const isSelectedPlayerEntity = entity.vehicle.id === stateRef.current.selectedVehicleId;
        const manualPedalBraking =
          isSelectedPlayerEntity &&
          (steeringKeysRef.current.brake ||
            (steeringKeysRef.current.reverse && state.speedKmh <= 2.5));
        const effectiveBraking = state.isBraking || manualPedalBraking;
        const steeringAngle = car ? -visualPose!.steer : recorded ? -recorded.steer :
          isSelectedPlayerEntity
            ? THREE.MathUtils.degToRad(stateRef.current.steeringDemoDeg) : 0;
        entity.updateState(state.distance, state.speedKmh, state.accelG,
          effectiveBraking, camera.position, state.outOfFuel,
          steeringAngle, dt,
          car ? { x: visualPose!.x, z: visualPose!.z, yaw: visualPose!.yaw, slip: visualPose!.slip, bump: visualPose!.bump, suspension: visualPose!.suspension } : recorded ? { x: recorded.x, z: recorded.z, yaw: recorded.yaw, slip: recorded.slip, bump: recorded.bump, suspension: recorded.suspension } : undefined,
        );
        // Mismo trazado en física, GLB, cámara, minimapa y repetición.
        // Los datos del motor físico conservan coordenadas Frenet (s, lateral).
        const localLateral = car ? visualPose!.x : recorded ? recorded.x : entity.group.position.x;
        const globalPose = roadPath.world(state.distance, localLateral);
        entity.group.position.x = globalPose.x;
        entity.group.position.z = globalPose.z;
        entity.group.rotation.y += globalPose.yaw;
        entity.setNameplateVisible(stateRef.current.showVehicleLabels);
        entity.setHeadlights(stateRef.current.headlightsOn,
          entity.vehicle.id === stateRef.current.selectedVehicleId);
        if (entity.vehicle.id === stateRef.current.selectedVehicleId) {
          const sigBlink = evaluateTurnSignalBlink(
            turnSignalRef.current.mode,
            now / 1000,
            turnSignalRef.current.activatedAtSec,
          );
          entity.setTurnSignals?.(sigBlink.leftLit, sigBlink.rightLit);
        } else {
          entity.setTurnSignals?.(false, false);
        }
        if (state.distance < minZ) minZ = state.distance;
        if (state.distance > maxZ) {
          maxZ = state.distance;
          leaderDist = state.distance;
          leaderX = entity.group.position.x;
        }
        sumZ += state.distance;
        sumX += entity.group.position.x;
      });

      // Actualizar rivales humanos en línea (WebSocket 20 Hz + extrapolación suave en 3D)
      if (onlineSession && experience === 'race') {
        for (const [peerId, peer] of multiplayerClient.peers.entries()) {
          let record = onlinePeerEntities.get(peerId);
          if (!record) {
            const peerCarSpec =
              PRESET_VEHICLES.find((v) => v.id === peer.vehicleId) ||
              vehicles[0] ||
              PRESET_VEHICLES[0];
            const peerEntity = createVehicleEntity(
              peerCarSpec,
              0,
              1,
              undefined,
              undefined,
              vehicleEnvTexture,
              `ONLINE · ${peer.pilotName}`,
              {
                preferProceduralModel: shouldUseLightweightProceduralVehicle({
                  isMobilePerf: perfProfile.isMobilePerf,
                  experience,
                  vehicleId: peerCarSpec.id,
                  playerVehicleId: activePlayerId,
                  isOnlinePeer: true,
                }),
              },
            );
            peerEntity.setHeadlights(true, false);
            peerEntity.setNameplateVisible(true);
            scene.add(peerEntity.group);
            record = {
              entity: peerEntity,
              smoothX: peer.x,
              smoothZ: peer.z,
              smoothYaw: peer.yaw,
            };
            onlinePeerEntities.set(peerId, record);
          }
          const ageSec = Math.min(0.25, Math.max(0, (performance.now() - peer.updatedAtMs) / 1000));
          const predictedZ = peer.finished ? peer.z : peer.z + peer.speed * ageSec;
          record.smoothX = THREE.MathUtils.damp(record.smoothX, peer.x, 14, dt);
          record.smoothZ = THREE.MathUtils.damp(record.smoothZ, predictedZ, 14, dt);
          record.smoothYaw = THREE.MathUtils.damp(record.smoothYaw, peer.yaw, 14, dt);
          record.entity.updateState(
            record.smoothZ,
            Math.abs(peer.speed) * 3.6,
            0,
            peer.braking,
            camera.position,
            false,
            -peer.steer,
            dt,
            {
              x: record.smoothX,
              z: record.smoothZ,
              yaw: record.smoothYaw,
              slip: 0,
              bump: 0,
            },
          );
          const peerGlobal = roadPath.world(record.smoothZ, record.smoothX);
          record.entity.group.position.x = peerGlobal.x;
          record.entity.group.position.z = peerGlobal.z;
          record.entity.group.rotation.y += peerGlobal.yaw;
        }
        for (const [peerId, record] of onlinePeerEntities.entries()) {
          if (!multiplayerClient.peers.has(peerId)) {
            scene.remove(record.entity.group);
            record.entity.dispose();
            onlinePeerEntities.delete(peerId);
          }
        }
      }

      // Travelling de llegada: el vehículo avanza despacio después de cruzar meta,
      // sin reescribir física ni telemetría. La cámara frontal lo sigue.
      if (experience === 'race' && stateRef.current.hasFinished && finishCarPose) {
        const entity = vehicleEntities.find(e => e.vehicle.id === stateRef.current.selectedVehicleId);
        if (entity) {
          // Travelling uniforme durante los cuatro segundos del cierre.
          // La velocidad visual es ~18 km/h; nunca se frena hasta detenerse
          // en la imagen de meta. No modifica el resultado ni reanuda el motor.
          const elapsed = Math.max(0, (now - finishCinematicStartedAt) / 1000);
          const advance = Math.min(elapsed, 4) * 5;
          entity.group.position.x = finishCarPose.x + Math.sin(finishCarPose.yaw) * advance;
          entity.group.position.z = finishCarPose.z + Math.cos(finishCarPose.yaw) * advance;
          // El desplazamiento posterior a meta es solo visual: animar también las
          // ruedas con esos metros extra sin modificar la distancia de carrera.
          entity.advanceFinishWheelRotation?.(advance);
        }
      }
      const count = vehicleEntities.length || 1;
      const centerZ = (minZ + maxZ) / 2;
      const avgZ = sumZ / count;
      const avgX = sumX / count;
      const spreadZ = maxZ - minZ;
      const selectedEntity = vehicleEntities.find(e => e.vehicle.id === selectedVehicleId);
      const selectedX = selectedEntity?.group.position.x ?? avgX;

      // DIRECTOR CINEMATOGRÁFICO: cámara aérea tipo Dron previa a iniciar + planos de carrera y llegada.
      const finishDist = track.distanceMeters;
      const automaticDirector = cameraMode === 'automatica';
      if (automaticDirector) directorShot = chooseDirectorShot(leaderDist, finishDist);
      const isFinishCinematic = experience === 'race' && stateRef.current.hasFinished;
      const isPreStartDrone =
        experience === 'race' &&
        !stateRef.current.hasFinished &&
        (!isPlaying || countdown !== null);
      if (isPreStartDrone) {
        droneFlyoverSec += dt;
      } else {
        droneFlyoverSec = 0;
      }
      const effectiveShot = isFinishCinematic
        ? 'frontal_meta'
        : isPreStartDrone
          ? 'dron_prestart'
          : automaticDirector
            ? directorShot!
            : cameraMode;
      if (lastAutoMode !== cameraMode) {
        previousEffectiveShot = null;
        lastAutoMode = cameraMode;
      }
      if (cameraMode === 'libre' && !orbitInitialized) enableOrbit();
      if (cameraMode !== 'libre' && !orbitPointer.active) orbitInitialized = false;

      let targetSmoothRate = 10;
      let wantedFov = compact ? 58 : 48;
      const selectedZ = selectedEntity?.group.position.z ?? centerZ;
      const selectedTrackS = livePhysics?.getCar(selectedVehicleId)?.z ?? centerZ;
      const currentWeather = weatherModeRef.current;
      const stormStep = weatherVisuals.update(currentWeather, dt, selectedX, selectedZ);
      if (stormStep.triggeredStrike && !stateRef.current.hasFinished) {
        soundEngine.playThunder(stormStep.triggeredStrike.proximity01);
      }
      const atm = getHyperrealAtmosphere(currentWeather);
      if (currentWeather !== lastWeatherApplied) {
        lastWeatherApplied = currentWeather;
        sunDirVec.set(atm.sunDir[0], atm.sunDir[1], atm.sunDir[2]);
        keyLight.color.set(atm.sunLightHex);
        keyLight.intensity = atm.sunIntensity;
        hemiLight.color.set(atm.hemiSkyHex);
        hemiLight.groundColor.set(atm.hemiGroundHex);
        hemiLight.intensity = atm.hemiIntensity;
        ambientLight.intensity = atm.ambientIntensity;
        fillLight.intensity = currentWeather === 'storm' ? 0.48 : currentWeather === 'flood' ? 0.60 : 0.82;
        renderer.toneMappingExposure = atm.exposure;

        const wet = WEATHER_CONFIG[currentWeather].roadWetness;
        roadMat.roughness = THREE.MathUtils.lerp(0.82, 0.22, wet);
        roadMat.metalness = THREE.MathUtils.lerp(0.10, 0.28, wet);
        roadMat.envMapIntensity = THREE.MathUtils.lerp(1.45, 1.95, wet);
        roadMat.color.copy(initialRoadColor).lerp(new THREE.Color('#5a646e'), wet * 0.44);
        roadMat.needsUpdate = true;
      }
      const nfsmwPreset = NFSMW_PRESET_BY_WEATHER[currentWeather] || NFSMW_PRESET_BY_WEATHER.sunny;
      const effectivePuddleAmount =
        track.routeHazardProfile === 'flood' ? 1.0 : nfsmwPreset.puddleAmount;
      puddleShaderHandle.setPuddleState(effectivePuddleAmount, ambientCityTimeSec);
      puddleShaderHandle.setSunDirection(atm.sunDir[0], atm.sunDir[1], atm.sunDir[2]);
      if (selectedEntity?.getWorldLampState) {
        selectedEntity.getWorldLampState(playerWorldLampState);
      } else {
        playerWorldLampState.headIntensity = 0;
        playerWorldLampState.brakeIntensity = 0;
      }
      puddleShaderHandle.setVehicleLightState(playerWorldLampState);

      if (currentWeather === 'storm') {
        const flash = stormStep.flashIntensity;
        keyLight.intensity = atm.sunIntensity + flash * 2.85;
        hemiLight.intensity = atm.hemiIntensity + flash * 1.15;
        renderer.toneMappingExposure = atm.exposure + flash * 0.24;
      }
      // Seguir al vehículo protagonista con frustum amplio para sombras nítidas de edificios, puentes y árboles
      const shadowFocusZ = selectedZ + 18;
      keyLight.target.position.set(selectedX, 0, shadowFocusZ);
      keyLight.position.set(
        selectedX + sunDirVec.x * 115,
        sunDirVec.y * 115,
        shadowFocusZ + sunDirVec.z * 115,
      );
      urbanEnvironment.userData.updateScenery?.(
        ambientCityTimeSec,
        selectedTrackS,
        roadPath,
        atm.sunDir,
      );
      const activeUrbanPhysics = interactiveMode ? physicsRef.current : null;
      const isAerialDroneShot = effectiveShot === 'dron' || effectiveShot === 'dron_prestart';
      const wantedFar = isAerialDroneShot ? perfProfile.droneCameraFar : perfProfile.gameplayCameraFar;
      if (Math.abs(camera.far - wantedFar) > 1) {
        camera.far = wantedFar;
        camera.updateProjectionMatrix();
        hyperrealEnv.skyDome.scale.setScalar(
          isAerialDroneShot && perfProfile.isMobilePerf ? 1.75 : 1,
        );
      }
      urbanTrafficVisuals?.update(
        isPlaying ? (activeUrbanPhysics?.time ?? stateRef.current.currentTimeSec) : ambientCityTimeSec,
        dt,
        activeUrbanPhysics?.oncomingCars ?? [],
        selectedTrackS,
        isAerialDroneShot,
      );
      if (forwardMotorcycles.length > 0 && activeUrbanPhysics) {
        const ownMotoRef = activeUrbanPhysics.getCar(selectedVehicleId);
        const ownLengthM = (ownMotoRef?.vehicle.dimensions?.lengthMm || 4400) / 1000;
        const ownWidthM = (ownMotoRef?.vehicle.dimensions?.widthMm || 1820) / 1000;
        if (isPlaying && countdown === null && !stateRef.current.hasFinished) {
          const motoCollisions = stepForwardMotorcycles({
            motorcycles: forwardMotorcycles,
            lights: activeUrbanPhysics.trafficLights,
            speedZones: activeUrbanPhysics.speedZones,
            forwardCars: activeUrbanPhysics.cars
              .filter(c => c.id !== selectedVehicleId)
              .map(c => ({
                id: c.id,
                x: c.x,
                z: c.z,
                speedMps: c.speed,
                lengthM: (c.vehicle.dimensions?.lengthMm || 4300) / 1000,
                widthM: (c.vehicle.dimensions?.widthMm || 1800) / 1000,
              })),
            playerX: ownMotoRef?.x ?? -4.2,
            playerZ: ownMotoRef?.z ?? 0,
            playerSpeedMps: Math.max(0, ownMotoRef?.speed ?? 0),
            playerLengthM: ownLengthM,
            playerWidthM: ownWidthM,
            timeSec: activeUrbanPhysics.time,
            dt: dt * playbackSpeed,
            trackDistanceM: track.distanceMeters,
          });
          if (motoCollisions.length > 0) {
            for (const hit of motoCollisions) {
              activeUrbanPhysics.applyMotorcycleCollision(hit.x, hit.z, hit.impactSpeedMps);
              soundEngine.playImpact(0.95);
              soundEngine.playTrafficWarningTone(true);
            }
            setTimePenaltyHudSec(Math.round(activeUrbanPhysics.timePenaltySec));
            if (activeUrbanPhysics.lastTrafficNotice) {
              lastNoticeSeqRef.current = activeUrbanPhysics.lastTrafficNotice.seq;
              setTrafficNotice(activeUrbanPhysics.lastTrafficNotice);
            }
            setRaceEvent('🚨 ¡Atropellaste a un motociclista! Moto caída y +15 s de penalización');
          }
        } else if (!stateRef.current.hasFinished) {
          stepForwardMotorcycles({
            motorcycles: forwardMotorcycles,
            lights: activeUrbanPhysics.trafficLights,
            speedZones: activeUrbanPhysics.speedZones,
            forwardCars: [],
            playerX: ownMotoRef?.x ?? -4.2,
            playerZ: ownMotoRef?.z ?? 0,
            playerSpeedMps: 0,
            playerLengthM: ownLengthM,
            playerWidthM: ownWidthM,
            timeSec: ambientCityTimeSec,
            dt,
            trackDistanceM: track.distanceMeters,
          });
        }
        forwardMotorcyclesVisuals.update(forwardMotorcycles);
      }

      switch (effectiveShot) {
        case 'grilla_frontal': {
          targetSmoothRate = 6;
          wantedFov = compact ? 65 : 53;
          _desiredCamPos.set(avgX * 0.22, 2.0, Math.max(19, leaderDist + 17));
          _camTarget.set(avgX, 1.05, avgZ);
          break;
        }
        case 'arcade': {
          // Cámara de conducción arcade inspirada en juegos de carreras:
          // a ras de carretera, con distancia, mirada y FOV ajustados a la velocidad.
          // Damping estable; sin vibraciones aleatorias.
          const own = livePhysics?.getCar(selectedVehicleId);
          const yaw = selectedEntity?.group.rotation.y ?? 0;
          const speed = Math.abs(own?.speed ?? 0) * 3.6;
          const speed01 = THREE.MathUtils.clamp(speed / 145, 0, 1);
          const forwardX = Math.sin(yaw);
          const forwardZ = Math.cos(yaw);
          // Mantener siempre una silueta grande en pantalla: el FOV cambia poco.
          // No transmitir la aceleración vertical de suspensión a la cámara.
          const chaseDistance = (compact ? 5.5 : 6.0) + speed01 * .48;
          const hazardLookahead = own ? findUpcomingPothole(livePhysics?.hazards ?? [], own,
            own.vehicle.dimensions.widthMm / 1000) : null;
          const roadVisibility = hazardLookahead ? potholeCameraCue(hazardLookahead.distanceM) : 0;
          // Leve elevación de perspectiva cuando un bache importante se acerca.
          // NO modificamos la distancia trasera: conserva el auto grande en pantalla.
          const camHeight = (compact ? 1.85 : 2.0) + speed01 * .12 + roadVisibility * .23;
          targetSmoothRate = 8.2;
          wantedFov = (compact ? 62 : 61) + speed01 * 5;
          const slipSway = own ? THREE.MathUtils.clamp(own.lateralSpeed * .13, -.38, .38) : 0;
          _desiredCamPos.set(selectedX - forwardX * chaseDistance + Math.cos(yaw) * slipSway,
            camHeight, selectedZ - forwardZ * chaseDistance - Math.sin(yaw) * slipSway);
          _camTarget.set(selectedX + forwardX * (5.8 + speed01 * 1.2), 1.3 - roadVisibility * .16,
            selectedZ + forwardZ * (5.8 + speed01 * 1.2));
          break;
        }
        case 'trasera': {
          if (experience !== 'race') {
            // Comparar y repeticiones siguen mostrando la grilla completa.
            targetSmoothRate = 9;
            const fullGridDist = THREE.MathUtils.clamp((compact ? 9 : 11) + spreadZ * 0.14, 8, 17);
            _desiredCamPos.set(selectedX * 0.55 + avgX * 0.45, compact ? 2.8 : 2.45, centerZ - fullGridDist);
            _camTarget.set(selectedX * 0.55 + avgX * 0.45, 1.18, centerZ + 6);
            break;
          }
          // CÁMARA DEL JUGADOR, TERCERA PERSONA (inspiración de juegos arcade).
          // Antes seguía el centro de todos los autos: cuando el jugador se
          // retrasaba o giraba, su vehículo quedaba pequeño o fuera de plano.
          // Ahora SIEMPRE anclamos el seguimiento al root físico del auto elegido.
          const ownCar = livePhysics?.getCar(selectedVehicleId);
          const carYaw = selectedEntity?.group.rotation.y ?? 0;
          const forwardX = Math.sin(carYaw);
          const forwardZ = Math.cos(carYaw);
          const speedKmh = ownCar ? ownCar.speed * 3.6 : 0;
          // Distancia fija respecto del auto: evitar zoom impredecible cuando
          // otros competidores se alejan o se acercan.
          const chaseDist = compact ? 5.7 : 6.3;
          const hazardLookahead = ownCar ? findUpcomingPothole(livePhysics?.hazards ?? [], ownCar,
            ownCar.vehicle.dimensions.widthMm / 1000) : null;
          const roadVisibility = hazardLookahead ? potholeCameraCue(hazardLookahead.distanceM) : 0;
          const chaseHeight = (compact ? 2.05 : 2.15) + roadVisibility * .22;
          const lookAhead = compact ? 5.0 : 6.3;
          targetSmoothRate = 9.5;
          wantedFov = THREE.MathUtils.clamp((compact ? 58 : 54) + speedKmh * 0.027, 54, compact ? 63 : 60);
          _desiredCamPos.set(
            selectedX - forwardX * chaseDist,
            chaseHeight,
            selectedZ - forwardZ * chaseDist,
          );
          _camTarget.set(
            selectedX + forwardX * lookAhead,
            1.25 - roadVisibility * .15,
            selectedZ + forwardZ * lookAhead,
          );
          break;
        }
        case 'persecucion_baja': {
          // Plano de conjunto para las repeticiones cinematográficas.
          targetSmoothRate = 9;
          const followDist = THREE.MathUtils.clamp((compact ? 9 : 11) + spreadZ * 0.14, 8, 17);
          _desiredCamPos.set(selectedX * 0.55 + avgX * 0.45, compact ? 2.8 : 2.45, centerZ - followDist);
          _camTarget.set(selectedX * 0.55 + avgX * 0.45, 1.18, centerZ + 6);
          break;
        }
        case 'lateral':
        case 'lateral_izquierda':
        case 'lateral_derecha': {
          // Cámara lateral vinculada al auto seleccionado, NO a la media de
          // los rivales. Trabaja en coordenadas mundiales y acompaña curvas.
          const yaw = selectedEntity?.group.rotation.y ?? 0;
          const side = effectiveShot === 'lateral_derecha' ? 1 : -1;
          const rightX = Math.cos(yaw);
          const rightZ = -Math.sin(yaw);
          const forwardX = Math.sin(yaw);
          const forwardZ = Math.cos(yaw);
          const nearStartGantry = Math.abs(selectedZ) < 6 && Math.abs(selectedX) < 12;
          const sideDistance = nearStartGantry ? (compact ? 6.8 : 7.6) : (compact ? 8.2 : 9.4);
          targetSmoothRate = 9.2;
          wantedFov = compact ? 51 : 46;
          // Si el auto está en la grilla de largada, colocar la cámara TV delante del pórtico
          // de salida (z=0) en ángulo 3/4 lateral-frontal sin que la columna oculte los autos.
          const forwardLead = nearStartGantry ? 3.8 : -2.2;
          _desiredCamPos.set(
            selectedX + side * rightX * sideDistance + forwardX * forwardLead,
            compact ? 2.45 : 2.65,
            selectedZ + side * rightZ * sideDistance + forwardZ * forwardLead,
          );
          _camTarget.set(selectedX + forwardX * 0.5, 1.18, selectedZ + forwardZ * 0.5);
          break;
        }
        case 'cenital':
        case 'cenital_dinamica': {
          // Pose en coordenadas de mundo: seguir al vehículo elegido sin
          // referencias indefinidas ni transformar dos veces las curvas.
          const carYaw = selectedEntity?.group.rotation.y ?? roadPath.at(0).yaw;
          const forwardX = Math.sin(carYaw);
          const forwardZ = Math.cos(carYaw);
          targetSmoothRate = 7.2;
          wantedFov = compact ? 50 : 44;
          const topHeight = compact ? 19 : 23;
          const behind = 3.2;
          const ahead = compact ? 3.8 : 5.0;
          _desiredCamPos.set(
            selectedX - forwardX * behind,
            topHeight,
            selectedZ - forwardZ * behind,
          );
          _camTarget.set(
            selectedX + forwardX * ahead,
            0.9,
            selectedZ + forwardZ * ahead,
          );
          break;
        }
        case 'dron_prestart': {
          // Cámara de dirección tipo DRON antes de largar: sobrevuela Asunción mostrando
          // skyline de distintas alturas, plazas de pasto, peatones, tránsito 3D y el Río Paraguay,
          // y en el último segundo ("1") desciende con suavidad detrás del SUV del jugador.
          if (countdown === 1) {
            const carYaw = selectedEntity?.group.rotation.y ?? roadPath.at(0).yaw;
            const fx = Math.sin(carYaw);
            const fz = Math.cos(carYaw);
            targetSmoothRate = 9.5;
            wantedFov = compact ? 61 : 57;
            _desiredCamPos.set(selectedX - fx * 7.4 - 1.2, 3.4, selectedZ - fz * 7.4);
            _camTarget.set(selectedX + fx * 9, 1.35, selectedZ + fz * 9);
          } else {
            const sweepPhase = Math.min(1, droneFlyoverSec / 3.8);
            const camS = THREE.MathUtils.lerp(132, 64, sweepPhase);
            const camLat = THREE.MathUtils.lerp(-38, -22, sweepPhase) + Math.sin(droneFlyoverSec * 0.55) * 4.5;
            const camAlt = THREE.MathUtils.lerp(52, 35, sweepPhase);
            const droneWorld = roadPath.world(camS, camLat);
            const lookS = THREE.MathUtils.lerp(62, 24, sweepPhase);
            // Apuntar ligeramente hacia +X para encuadrar avenida doble mano + skyline + Río Paraguay
            const lookLat = THREE.MathUtils.lerp(24, 6, sweepPhase);
            const lookWorld = roadPath.world(lookS, lookLat);
            targetSmoothRate = droneFlyoverSec < 0.12 ? 20 : 2.4;
            wantedFov = compact ? 62 : 54;
            _desiredCamPos.set(droneWorld.x, camAlt, droneWorld.z);
            _camTarget.set(lookWorld.x, THREE.MathUtils.lerp(5.5, 2.2, sweepPhase), lookWorld.z);
          }
          break;
        }
        case 'dron': {
          // Cámara aérea tipo Dron durante la carrera: gran plano elevado mostrando ciudad, parques y Río Paraguay
          const sNow = livePhysics?.getCar(selectedVehicleId)?.z ?? centerZ;
          const droneCam = roadPath.world(sNow - 24, -20);
          const droneLook = roadPath.world(sNow + 36, 12);
          targetSmoothRate = 5.8;
          wantedFov = compact ? 60 : 52;
          _desiredCamPos.set(droneCam.x, compact ? 34 : 38, droneCam.z);
          _camTarget.set(droneLook.x, 2.4, droneLook.z);
          break;
        }
        case 'libre': {
          targetSmoothRate = 11;
          _camTarget.set(selectedX, 1.03, selectedZ);
          const cosPitch = Math.cos(orbit.pitch);
          _desiredCamPos.set(
            selectedX + orbit.radius * cosPitch * Math.sin(orbit.yaw),
            1.03 + orbit.radius * Math.sin(orbit.pitch),
            selectedZ - orbit.radius * cosPitch * Math.cos(orbit.yaw),
          );
          break;
        }
        case 'frontal_seguimiento': {
          targetSmoothRate = 7.5;
          wantedFov = compact ? 63 : 53;
          const ahead = THREE.MathUtils.clamp(13 + spreadZ * 0.2, 12, 19);
          _desiredCamPos.set(avgX * 0.26, 1.9, leaderDist + ahead);
          _camTarget.set(avgX, 1.12, centerZ - 0.8);
          break;
        }
        case 'frontal_meta': {
          if (isFinishCinematic) {
            // Cámara respecto del auto y su rumbo mundial real (incluidas curvas).
            // Antes se utilizaba finishDist como Z global y se perdía el vehículo.
            const p = THREE.MathUtils.clamp((now - finishCinematicStartedAt) / 3750, 0, 1);
            const carYaw = selectedEntity?.group.rotation.y ?? roadPath.at(finishDist).yaw;
            const shot = finishCameraPose(selectedX, selectedZ, carYaw, p, compact);
            targetSmoothRate = 11;
            wantedFov = shot.fov;
            _desiredCamPos.set(shot.camera.x, shot.camera.y, shot.camera.z);
            _camTarget.set(shot.target.x, shot.target.y, shot.target.z);
          } else {
            // Director TV de las repeticiones: todos los competidores de frente.
            targetSmoothRate = 11;
            wantedFov = compact ? 65 : 55;
            const frontZ = Math.max(finishDist + 12, leaderDist + 12);
            _desiredCamPos.set(avgX * 0.20, compact ? 2.1 : 1.9, frontZ);
            _camTarget.set(avgX, 1.04, centerZ - Math.min(2, spreadZ * 0.15));
          }
          break;
        }
        default: {
          _desiredCamPos.set(avgX, 3, centerZ - 10);
          _camTarget.set(avgX, 1.2, centerZ + 5);
        }
      }

      // Director TV opera en posiciones globales. Sus planos procedentes del
      // antiguo eje Z se reorientan sobre la tangente del circuito curvo.
      // Arcade, tercera persona y libre ya utilizan la posición mundial del GLB.
      if (roadPath.isCurved && !(isFinishCinematic && effectiveShot === 'frontal_meta') && !['arcade', 'trasera', 'libre', 'lateral', 'lateral_izquierda', 'lateral_derecha', 'cenital', 'cenital_dinamica', 'dron', 'dron_prestart'].includes(effectiveShot)) {
        const frameX = roadPath.at(centerZ).x;
        const cameraAt = roadPath.world(_desiredCamPos.z, _desiredCamPos.x - frameX);
        const targetAt = roadPath.world(_camTarget.z, _camTarget.x - frameX);
        _desiredCamPos.x = cameraAt.x;
        _desiredCamPos.z = cameraAt.z;
        _camTarget.x = targetAt.x;
        _camTarget.z = targetAt.z;
      }

      // Resguardo: una coordenada inválida nunca debe bloquear el render 3D.
      // Se regresa a una vista detrás del coche si una pose falla.
      if (![ _desiredCamPos.x, _desiredCamPos.y, _desiredCamPos.z,
              _camTarget.x, _camTarget.y, _camTarget.z ].every(Number.isFinite)) {
        const yaw = selectedEntity?.group.rotation.y ?? 0;
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        _desiredCamPos.set(selectedX - fx * 7, 3, selectedZ - fz * 7);
        _camTarget.set(selectedX + fx * 5, 1.2, selectedZ + fz * 5);
      }

      // Cortes de televisión auténticos, salvo la transición fluida del Dron previo hacia cámara Arcade al largar.
      const smoothDroneHandoff = previousEffectiveShot === 'dron_prestart' && effectiveShot === 'arcade';
      const cut = previousEffectiveShot !== effectiveShot && !smoothDroneHandoff;
      if (cut) {
        camera.position.copy(_desiredCamPos);
        _smoothedCamTarget.copy(_camTarget);
        cameraTargetInitialized = true;
        camera.fov = wantedFov;
        camera.updateProjectionMatrix();
        previousEffectiveShot = effectiveShot;
      } else {
        if (smoothDroneHandoff && (camera.position.y > 7.5 || camera.position.z > selectedZ + 1.5)) {
          const carYaw = selectedEntity?.group.rotation.y ?? 0;
          const fx = Math.sin(carYaw);
          const fz = Math.cos(carYaw);
          camera.position.set(selectedX - fx * 8.2, 3.1, selectedZ - fz * 8.2);
          _smoothedCamTarget.copy(_camTarget);
          cameraTargetInitialized = true;
        }
        previousEffectiveShot = effectiveShot;
        if (Math.abs(camera.fov - wantedFov) > 0.02) {
          camera.fov = THREE.MathUtils.damp(camera.fov, wantedFov, 5, dt);
          camera.updateProjectionMatrix();
        }
      }

      // AMORTIGUACIÓN ESTABLE E INDEPENDIENTE DE FPS: factor = 1 - exp(-lambda * dt)
      camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredCamPos.x, targetSmoothRate, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredCamPos.y, targetSmoothRate, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredCamPos.z, targetSmoothRate, dt);

      // CRÍTICO: antes la posición tenía damping pero lookAt seguía el blanco
      // sin suavizado, originando microtemblores visibles al acelerar/seguir.
      if (!cameraTargetInitialized) {
        _smoothedCamTarget.copy(_camTarget);
        cameraTargetInitialized = true;
      } else {
        _smoothedCamTarget.x = THREE.MathUtils.damp(_smoothedCamTarget.x, _camTarget.x, 9, dt);
        _smoothedCamTarget.y = THREE.MathUtils.damp(_smoothedCamTarget.y, _camTarget.y, 9, dt);
        _smoothedCamTarget.z = THREE.MathUtils.damp(_smoothedCamTarget.z, _camTarget.z, 9, dt);
      }
      camera.lookAt(_smoothedCamTarget);
      hyperrealEnv.update(currentWeather, camera.position, ambientCityTimeSec, stormStep.flashIntensity);

      // Luz de apoyo solar alineada detrás de la cámara activa para que la parte trasera
      // de los autos permanezca bien iluminada incluso al girar 180° en circuitos cerrados.
      const camBackDx = camera.position.x - selectedX;
      const camBackDz = camera.position.z - selectedZ;
      const camBackLen = Math.hypot(camBackDx, camBackDz) || 1;
      const rearUx = camBackDx / camBackLen;
      const rearUz = camBackDz / camBackLen;
      fillLight.target.position.set(selectedX, 1.0, selectedZ);
      fillLight.position.set(
        selectedX + (rearUx * 0.88 - rearUz * 0.24) * 34,
        26,
        selectedZ + (rearUz * 0.88 + rearUx * 0.24) * 34,
      );

      if (
        experience === 'race' &&
        selectedEntity &&
        showRearviewMirrorRef.current &&
        !stateRef.current.hasFinished &&
        !isPreloadingRef.current
      ) {
        if (!digitalRearviewMirror) {
          digitalRearviewMirror = createDigitalRearviewMirror({
            isSoftwareGl: isSoftwareGl || perfProfile.isMobilePerf,
          });
        }
        const prevPlayerVis = selectedEntity.group.visible;
        digitalRearviewMirror.renderFrame({
          renderer,
          scene,
          targetCanvas: rearviewCanvasRef.current,
          leftCanvas: leftMirrorCanvasRef.current,
          rightCanvas: rightMirrorCanvasRef.current,
          showSideMirrors: showSideMirrorsRef.current,
          vehicleWorldX: selectedEntity.group.position.x,
          vehicleWorldY: selectedEntity.group.position.y,
          vehicleWorldZ: selectedEntity.group.position.z,
          vehicleYawRad: selectedEntity.group.rotation.y,
          elapsedSec: ambientCityTimeSec,
          enabled: showRearviewMirrorRef.current,
          beforeRender: () => {
            selectedEntity.group.visible = false;
          },
          afterRender: () => {
            selectedEntity.group.visible = prevPlayerVis;
          },
        });
      }

      // Actualizar partículas otoñales (hojas secas + motas de polvo en haces solares) y sonda de reflexión dinámica
      const particleAnchorX = isAerialDroneShot ? selectedX : camera.position.x * 0.45 + selectedX * 0.55;
      const particleAnchorZ = isAerialDroneShot ? selectedZ : camera.position.z * 0.35 + selectedZ * 0.65;
      autumnParticles.update(
        particleAnchorX,
        selectedEntity?.group.position.y ?? 0,
        particleAnchorZ,
        atm.sunDir,
        currentWeather,
        ambientCityTimeSec,
        dt,
      );
      dynamicReflectionProbe.update({
        renderer,
        scene,
        focusX: selectedX,
        focusY: selectedEntity?.group.position.y ?? 0,
        focusZ: selectedZ,
        timeSec: ambientCityTimeSec,
        isSoftwareGl,
        hiddenObjects: [selectedEntity?.group, autumnParticles.group],
      });

      nfsmwPostProcessor.render(currentWeather, atm.sunDir, ambientCityTimeSec);
      if (!sceneReadyReported) { sceneReadyReported = true; setVisualReady(true); }
      if (isSoftwareGl) {
        afterDraw(() => {
          if (!sceneDisposed) animationFrameId = requestAnimationFrame(tick);
        });
      } else {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        softwareGlTimerId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (sceneDisposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          softwareGlTimerId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          softwareGlTimerId = window.setTimeout(cb, 80);
        }
      };
      softwareGlTimerId = window.setTimeout(poll, 5);
    };

    animationFrameId = requestAnimationFrame(tick);

    // Ajuste responsivo de ventana
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      nfsmwPostProcessor.setSize(w, h, renderDpr);
    };
    window.addEventListener('resize', handleResize);
    const viewportResizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientHeight > 0) handleResize();
    }) : null;
    viewportResizeObserver?.observe(container);
    requestAnimationFrame(handleResize);

    return () => {
      sceneDisposed = true;
      cancelAnimationFrame(animationFrameId);
      clearTimeout(softwareGlTimerId);
      soundEngine.stopAll(0.03);
      window.removeEventListener('resize', handleResize);
      viewportResizeObserver?.disconnect();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerUp);
      renderer.domElement.removeEventListener('wheel', wheelOrbit);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', releaseKeys);
      releaseKeys();
      if (finishTimerRef.current !== null) {
        clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      physicsRef.current = null;
      addVisualHazardRef.current = null;
      placeHazardAtRef.current = null;
      resetVisualRaceRef.current = null;
      vehicleEntities.forEach((ent) => ent.dispose());
      onlinePeerEntities.forEach((rec) => {
        scene.remove(rec.entity.group);
        rec.entity.dispose();
      });
      onlinePeerEntities.clear();
      skidGeometry.dispose();
      skidMaterial.dispose();
      hazardGeometry.dispose();
      barrelBodyMaterial.dispose();
      barrelStripeMaterial.dispose();
      potholeMaterial.dispose();
      potholeVisualKit.dispose();
      urbanEnvironment.userData.disposeTextureMaps?.();
      viaductsGroup?.userData.disposeTextures?.();
      weatherVisuals.dispose();
      scene.remove(autumnParticles.group);
      autumnParticles.dispose();
      dynamicReflectionProbe.dispose();
      nfsmwPostProcessor.dispose();
      if (splashTimeoutRef.current !== null) {
        clearTimeout(splashTimeoutRef.current);
        splashTimeoutRef.current = null;
      }
      urbanTrafficVisuals?.dispose();
      centralMedianVisuals.dispose();
      forwardMotorcyclesVisuals.dispose();
      digitalRearviewMirror?.dispose();
      roadTex.dispose();
      kerbTex.dispose();
      trackGroup.traverse((obj) => {
        if (obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      asphaltRelief.dispose();
      asphaltRoughness.dispose();
      asphaltNormal.dispose();
      asphaltDetailNormal.dispose();
      hyperrealEnv.dispose();
      renderer.dispose();
    };
  }, [track.id, track.cityCircuitId, track.trackIndex, track.routeHazardProfile, vehicles, compact, track.distanceMeters, interactiveMode, hazardsEnabled, experience, replayHazards, roadPath, raceMode, onlineSession, playerPayloadKg]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (interactiveMode) return; // No se puede retroceder una simulación física acumulativa.
    const val = parseFloat(e.target.value);
    setCurrentTimeSec(val);
    stateRef.current.currentTimeSec = val;
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${val.toFixed(2)}s`;
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];
  const selectedVehicleState = selectedVehicle
    ? interactiveMode && liveVehicleStates[selectedVehicle.id]
      ? liveVehicleStates[selectedVehicle.id]
      : getInterpolatedVehicleState(selectedVehicle.id, currentTimeSec)
    : null;

  const cycleCameraMode = () => {
    const modes: CameraViewMode[] = ['arcade', 'trasera', 'lateral', 'cenital', 'dron', 'libre'];
    const currentIndex = modes.indexOf(cameraMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setCameraMode(nextMode);
    stateRef.current.cameraMode = nextMode;
  };

  const totalCars = vehicles.length || 8;
  const totalLaps = Math.max(1, track.laps ?? 1);

  const playerRank = useMemo(() => {
    if (!selectedVehicle || !liveVehicleStates[selectedVehicle.id]) return 2;
    const playerDist = liveVehicleStates[selectedVehicle.id].distance;
    let ahead = 0;
    for (const [id, st] of Object.entries(liveVehicleStates)) {
      if (id !== selectedVehicle.id && st.distance > playerDist) {
        ahead++;
      }
    }
    return 1 + ahead;
  }, [selectedVehicle, liveVehicleStates]);

  const currentLap = useMemo(() => {
    if (!selectedVehicle || !liveVehicleStates[selectedVehicle.id] || !track) return 1;
    const dist = liveVehicleStates[selectedVehicle.id].distance;
    const lapDist = Math.max(1, track.distanceMeters / totalLaps);
    return Math.min(totalLaps, Math.max(1, Math.floor(dist / lapDist) + 1));
  }, [selectedVehicle, liveVehicleStates, track, totalLaps]);

  const dynamicDrivingFeedback = useMemo(() => {
    if (raceInsight?.message) return raceInsight.message;
    if (!selectedVehicleState) return '¡Buen ritmo! Mantén la velocidad.';
    if (selectedVehicleState.speedKmh > 140) return '¡Velocidad punta alcanzada! Sostené el trazado.';
    if (touchPressed.throttle || steeringKeysRef.current.throttle) return '¡Aceleración a pleno! Controlá la salida.';
    if (touchPressed.brake || steeringKeysRef.current.brake) return 'Frenado medido. Preparate para la curva.';
    if (touchPressed.left || touchPressed.right || steeringKeysRef.current.left || steeringKeysRef.current.right) return 'Viraje preciso. Mantén la línea ideal.';
    return '¡Buen ritmo! Mantén la velocidad.';
  }, [raceInsight, selectedVehicleState, touchPressed]);

  return (
    <div className={`relative bg-[#0a0f1d] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col select-none ${experience === 'race' ? 'dc-mobile-race' : ''}`}>
      {experience === 'race' && <button type="button" onClick={enableLandscape} className="dc-landscape-toggle" title="Pantalla completa horizontal"><Maximize2 size={16}/> <span>Modo horizontal</span></button>}
      {/* Top Header Bar: Track Specs + Camera Mode Switcher + Audio */}
      <div className="px-4 py-2.5 border-b border-slate-800/90 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 z-10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
            <span className="text-sky-400 font-bold uppercase">{track.name}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{track.distanceMeters}m</span>
            {track.inclineGradePercent > 0 && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-400 font-bold">+{track.inclineGradePercent}% Pendiente</span>
              </>
            )}
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-400/30 px-2 py-0.5 rounded font-bold">
              3D OEM &amp; GLB · Hiperrealista
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{track.subtitle}</p>
        </div>

        {/* View Switcher, Diagnostics & Audio */}
        <div className="flex items-center gap-2 flex-wrap">
          {onSwitchTo2D && (
            <button
              onClick={onSwitchTo2D}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono transition-colors"
              title="Cambiar a Vista 2D Cenital"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Vista 2D</span>
            </button>
          )}

          {/* Las etiquetas aéreas se ocultan en conducción para despejar la pista. */}
          <button
            type="button"
            onClick={() => setShowVehicleLabels(value => !value)}
            aria-pressed={showVehicleLabels}
            title="Mostrar u ocultar etiquetas flotantes sobre los vehículos"
            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${showVehicleLabels ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'}`}
          >
            Nombres {showVehicleLabels ? 'ON' : 'OFF'}
          </button>

          {/* Toggle Diagnóstico GPU / FPS */}
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`p-1.5 rounded-lg border text-xs font-mono transition-colors flex items-center gap-1 ${
              showDiagnostics
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Telemetría y Diagnóstico de Rendimiento"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">{diagStats.fps} FPS</span>
          </button>

          <button
            onClick={toggleMute}
            className={`p-1.5 rounded-lg border text-xs font-mono transition-colors flex items-center gap-1 ${
              isMuted
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-slate-900 border-slate-700 text-sky-400 hover:bg-slate-800'
            }`}
            title={isMuted ? 'Activar sonido motor' : 'Silenciar'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Audio ON'}</span>
          </button>

          {experience === 'race' && (
            <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 text-sky-200 text-xs">
              <CloudRain className="w-4 h-4" />
              <span className="hidden sm:inline">Clima</span>
              <select aria-label="Elegir clima de la carrera" value={weatherMode}
                onChange={e => setWeatherMode(e.target.value as WeatherMode)}
                className="bg-slate-900 text-sky-200 text-xs font-bold outline-none cursor-pointer">
                {WEATHER_OPTIONS.map(opt => <option value={opt.id} key={opt.id}>{opt.label}</option>)}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={() => setHeadlightsOn(value => !value)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
              headlightsOn
                ? 'bg-sky-500/15 border-sky-400/40 text-sky-200 hover:bg-sky-500/25'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
            title="Encender o apagar las ópticas delanteras y su iluminación sobre el asfalto"
            aria-pressed={headlightsOn}
          >
            {headlightsOn ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>Faros {headlightsOn ? 'ON' : 'OFF'}</span>
          </button>

          <div className="bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-center font-mono">
            <span className="text-[9px] text-slate-500 uppercase block leading-none">Tiempo Simulado</span>
            <span ref={timeDisplayRef} className="text-sm font-bold text-white tabular-nums">
              {currentTimeSec.toFixed(2)}s
            </span>
          </div>

          {hasFinished && experience === 'replay' && <span className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300">REPETICIÓN TERMINADA · Podés volver a reproducir</span>}
          {hasFinished && experience !== 'replay' && (
            <button
              onClick={() => {
                if (finishTimerRef.current !== null) {
                  clearTimeout(finishTimerRef.current);
                  finishTimerRef.current = null;
                }
                if (!resultDeliveredRef.current) {
                  resultDeliveredRef.current = true;
                  onFinishRace(finalResultsRef.current ?? undefined, raceHazardsSnapshotRef.current.map(h => ({ ...h })), weatherModeRef.current);
                }
              }}
              className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-emerald-600/30 animate-pulse"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Resultados</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 3D Viewport with 100% Unobstructed Center */}
      <div className="dc-race-viewport relative w-full overflow-hidden bg-[#0a0f1d]" style={{ height: compact ? '350px' : experience === 'race' ? 'min(72vh, 720px)' : '520px', minHeight: compact ? undefined : experience === 'race' ? '520px' : undefined }}>
        {experience === 'race' && !portraitPromptDismissed && <div className="dc-portrait-prompt">
          <Smartphone size={42} aria-hidden="true" />
          <strong>Girá tu celular o jugá en vertical</strong>
          <span>Podés correr en pantalla completa horizontal o continuar directamente en vertical con controles adaptados.</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={enableLandscape}><Maximize2 size={16}/> Intentar pantalla completa</button>
            <button type="button" onClick={() => setPortraitPromptDismissed(true)} className="!bg-slate-800 border border-cyan-400/50 text-cyan-200">
              Continuar en vertical
            </button>
          </div>
        </div>}
        <div ref={mountRef} className={`w-full h-full block touch-none ${placementKind ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`} />
        {experience === 'race' && <div className="dc-mobile-game-top" aria-label="Barra de juego">
          <span className="dc-mobile-track-name">{track.name}</span>
          <span className="dc-mobile-clock">{currentTimeSec.toFixed(1)} s</span>
          <button onClick={() => setMobileCameraOpen(v => !v)} aria-label="Elegir cámara"><Video size={19}/></button>
          <button onClick={() => { setIsPlaying(false); stateRef.current.isPlaying = false; setMobileMenuOpen(true); }} aria-label="Pausar y abrir menú"><Pause size={19}/></button>
        </div>}
        {experience === 'race' && mobileCameraOpen && <div className="dc-mobile-camera-menu">
          {([['arcade','Arcade'],['trasera','Mi auto'],['lateral','Lateral'],['cenital','Cenital'],['dron','Dron'],['libre','Libre']] as const).map(([mode,label]) => <button key={mode} onClick={() => { setCameraMode(mode); setMobileCameraOpen(false); }}>{label}</button>)}
        </div>}
        {experience === 'race' && mobileMenuOpen && <div className="dc-mobile-pause-screen">
          <h2>PAUSA</h2><p>DATACAR ARENA</p>
          <button className="dc-mobile-resume" onClick={() => { soundEngine.unlock(); if(startRequested){setIsPlaying(true);stateRef.current.isPlaying=true;} setMobileMenuOpen(false); }}><Play size={18}/> CONTINUAR</button>
          <button onClick={toggleMute}>{isMuted ? 'Activar sonido' : 'Silenciar sonido'}</button>
          <button onClick={() => setHeadlightsOn(v => !v)}>{headlightsOn ? 'Apagar faros' : 'Encender faros'}</button>
          <button onClick={() => setShowRearviewMirror(v => !v)}>{showRearviewMirror ? 'Ocultar espejos' : 'Mostrar espejos'}</button>
          <button onClick={() => setShowSideMirrors(v => !v)}>{showSideMirrors ? 'Ocultar espejos laterales' : 'Mostrar espejos laterales'}</button>
          <button onClick={()=>{setMobileMenuOpen(false);setShowRaceInformation(true);}}>DATOS EN CARRERA / INFORMACIÓN</button>
          {onExitRace && <button onClick={() => { soundEngine.stopAll(0.05); onExitRace(); }}>ABANDONAR CARRERA</button>}
          <label>CLIMA <select value={weatherMode} onChange={e => setWeatherMode(e.target.value as WeatherMode)}>{WEATHER_OPTIONS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}</select></label>
        </div>}

        {showRaceInformation && <div className="dc11-race-info-dialog" role="dialog" aria-label="Datos y telemetría educativa"><div><header><h2>DATACAR · DATOS EN CARRERA</h2><button onClick={()=>{setShowRaceInformation(false);setMobileMenuOpen(true);}}>CERRAR</button></header>{raceInsight?<><h3>{raceInsight.title}</h3><p>{raceInsight.message}</p></>:<p>La información educativa aparece conforme a los eventos de conducción y a las fichas de los vehículos.</p>}<p>Ficha técnica + telemetría virtual. No constituye una prueba oficial.</p><h3>MI AUTO</h3><p>{selectedVehicle?.brand} {selectedVehicle?.name}</p>{selectedVehicleState&&<p>{selectedVehicleState.speedKmh.toFixed(1)} km/h · {selectedVehicleState.rpm} RPM · {selectedVehicleState.accelG.toFixed(2)} G · {selectedVehicleState.distance.toFixed(1)} metros</p>}</div></div>}
        {/* Detector modular de VEHÍCULO ATASCADO (3 segundos consecutivos con opción de reiniciar o seguir intentando) */}
        <VehicleStuckModal
          open={experience === 'race' && (isStuckModalOpen || stuckInPothole)}
          onRestartRace={() => {
            soundEngine.stopAll();
            stateRef.current.isPlaying = false;
            resetStuckDetection();
            setStuckInPothole(false);
            if (onRestartRace) {
              onRestartRace?.();
            } else {
              const speedPro = experience === 'race' && raceMode === 'speed_pro';
              const rebuilt = new InteractiveRacePhysics(vehicles, track, stateRef.current.selectedVehicleId, hazardsEnabled && !speedPro, {
                urbanTrafficRules: experience === 'race' && !speedPro,
                speedRaceMode: speedPro,
                playerPayloadKg,
              });
              physicsRef.current = rebuilt;
              rebuilt.setWeather(weatherModeRef.current);
              raceHazardsSnapshotRef.current = rebuilt.hazards.map(h => ({...h}));
              resetVisualRaceRef.current?.();
              stuckRef.current = {seconds:0,lastDistance:0};
              seatbeltBuckledRef.current = false;
              setSeatbeltBuckled(false);
              setCurrentTimeSec(0);
              stateRef.current.currentTimeSec = 0;
              setLiveVehicleStates({});
              setStartRequested(experience !== 'race');
              setRestartSequence(n=>n+1);
            }
          }}
          onKeepTrying={() => {
            soundEngine.unlock();
            handleKeepTrying();
            stuckRef.current = { seconds: 0, lastDistance: stuckRef.current.lastDistance };
            setStuckInPothole(false);
            if (startRequested && !hasFinished) {
              setIsPlaying(true);
              stateRef.current.isPlaying = true;
            }
          }}
        />
        {experience === 'race' && !startRequested && (
          <div
            className="absolute inset-x-0 bottom-44 lg:bottom-[132px] z-30 flex justify-center pointer-events-auto px-4"
            role="status"
            aria-live="polite"
          >
            <div className="rounded-2xl border border-cyan-400/45 bg-slate-950/80 px-5 py-3 text-center shadow-2xl">
              <div className="text-[10px] font-mono font-black uppercase tracking-[0.22em] text-cyan-300">
                VISTA AÉREA DRON · CIUDAD DE ASUNCIÓN Y RÍO PARAGUAY
              </div>
              <h2 className="mt-1 font-display text-lg sm:text-xl font-black italic tracking-wide text-white">
                {glbLoadError
                  ? 'ERROR DE CARGA'
                  : raceGateReady
                    ? 'SOBREVOLANDO CIRCUITO · PREPARATE PARA LARGAR'
                    : 'PREPARANDO CIUDAD, TRÁNSITO 3D Y AUTOS…'}
              </h2>
              {glbLoadError && (
                <div className="mt-3 flex flex-wrap gap-2 justify-center">
                  <button type="button" onClick={() => onRestartRace?.()} className="rounded-lg bg-slate-800 border border-slate-600 px-4 py-2 font-bold text-white hover:bg-slate-700">REINTENTAR CARGA</button>
                  <button type="button" onClick={() => { setGlbLoadError(null); setLoadedVehicleModels(requiredVehicleModels); }} className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-slate-950 hover:bg-amber-300">LARGAR CON RESCATE 3D</button>
                </div>
              )}
            </div>
          </div>
        )}
        {experience === 'race' && !hasFinished && (
          <div className="dc-mobile-controls dc-mockup5-controls lg:hidden" aria-label="Controles táctiles de conducción">
            {/* Lado izquierdo: Botones biselados de dirección < y > en color cian brillante para el pulgar izquierdo */}
            <div className="dc-touch-steering">
              {touchButton(
                'left',
                'Izquierda',
                <div className="skew-x-[12deg] flex items-center justify-center pointer-events-none">
                  <ChevronLeft size={34} strokeWidth={3} className="text-white drop-shadow-[0_0_8px_#00e5ff]" />
                </div>,
                'dc-touch-rhomboid dc-touch-left'
              )}
              {touchButton(
                'right',
                'Derecha',
                <div className="skew-x-[12deg] flex items-center justify-center pointer-events-none">
                  <ChevronRight size={34} strokeWidth={3} className="text-white drop-shadow-[0_0_8px_#00e5ff]" />
                </div>,
                'dc-touch-rhomboid dc-touch-right'
              )}
            </div>

            {/* Lado derecho: Botón vertical alargado dorado con doble chevron >> para ACELERAR. Al lado, botón de FRENO (!) y botón de REVERSA R \/ */}
            <div className="dc-touch-pedals">
              {/* Botón de freno y botón de reversa apilados */}
              <div className="flex flex-col gap-2">
                {touchButton(
                  'brake',
                  'Freno',
                  <div className="flex flex-col items-center justify-center pointer-events-none">
                    <div className="flex items-center gap-0.5 text-white font-mono font-black text-sm tracking-tighter">
                      <span>(</span>
                      <AlertCircle size={14} className="text-amber-300" />
                      <span>)</span>
                    </div>
                    <div className="mt-1 flex gap-1 opacity-60">
                      <div className="w-1.5 h-0.5 bg-white -skew-x-[30deg]" />
                      <div className="w-1.5 h-0.5 bg-white -skew-x-[30deg]" />
                      <div className="w-1.5 h-0.5 bg-white -skew-x-[30deg]" />
                    </div>
                  </div>,
                  'dc-touch-brake dc-touch-brake-pedal'
                )}
                {touchButton(
                  'reverse',
                  'Frenar / reversa',
                  <div className="flex flex-col items-center justify-center pointer-events-none">
                    <span className="font-display font-black text-sm text-white tracking-wider leading-none">R</span>
                    <ChevronsDown size={14} className="text-cyan-300 -mt-0.5" />
                  </div>,
                  'dc-touch-reverse dc-touch-reverse-pedal'
                )}
              </div>

              {/* Botón vertical alargado dorado >> para ACELERAR */}
              {touchButton(
                'throttle',
                'Acelerar',
                <div className="flex flex-col items-center justify-between h-full py-2.5 pointer-events-none">
                  <ChevronsUp size={34} strokeWidth={3} className="text-[#ffb800] drop-shadow-[0_0_10px_#ffb800]" />
                  <div className="flex flex-col gap-1 items-center opacity-70">
                    <div className="w-6 h-0.5 bg-[#ffb800] -skew-x-[30deg]" />
                    <div className="w-6 h-0.5 bg-[#ffb800] -skew-x-[30deg]" />
                    <div className="w-6 h-0.5 bg-[#ffb800] -skew-x-[30deg]" />
                  </div>
                </div>,
                'dc-touch-throttle dc-touch-gold-throttle'
              )}
            </div>
          </div>
        )}

        {/* 1. ESQUINA SUPERIOR IZQUIERDA: Minimapa circular con borde cian brillante y píldora inferior META / RESTAN / VUELTA */}
        {experience === 'race' && !hasFinished && selectedVehicle && liveVehicleStates[selectedVehicle.id] && (() => {
          const minimapTarget = track?.cityCircuitId
            ? getCircuitTargetTime(
                track.cityCircuitId,
                raceMode === 'speed_pro' ? 'speed_pro' : 'city_trial',
                totalLaps,
                track.distanceMeters,
              )
            : null;
          return (
            <RaceMiniMap
              path={roadPath}
              player={liveVehicleStates[selectedVehicle.id]}
              opponents={[
                ...Object.entries(liveVehicleStates).map(([id, st]) => ({ id, distance: st.distance, lateralX: st.lateralX })),
                ...onlinePeersHud.map((p) => ({ id: p.id, distance: p.distance, lateralX: p.lateralX })),
              ]}
              playerId={selectedVehicle.id}
              playerRank={playerRank}
              totalCars={totalCars + onlinePeersHud.length}
              currentLap={currentLap}
              totalLaps={totalLaps}
              targetSec={minimapTarget?.targetSec ?? null}
              elapsedWithPenaltySec={currentTimeSec + timePenaltyHudSec}
              isPracticeFree={raceMode === 'practice_free'}
            />
          );
        })()}

        {/* 2. CENTRO SUPERIOR: Cronómetro + Meta Oro + Retrovisor automotriz realista + Espejos laterales */}
        {experience === 'race' && !hasFinished && (() => {
          const circuitTarget = track?.cityCircuitId
            ? getCircuitTargetTime(
                track.cityCircuitId,
                raceMode === 'speed_pro' ? 'speed_pro' : 'city_trial',
                totalLaps,
                track.distanceMeters,
              )
            : null;
          return (
            <>
              <div className="dc-mockup5-center-header dc-v5-top-center absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center select-none">
                {/* Barra superior compacta: circuito + cronómetro + Meta Oro + botones de espejos */}
                <div className="dc-v5-clock-bar flex items-center justify-center gap-1.5 px-2.5 py-1 bg-[#030914]/92 border border-cyan-400/40 rounded-xl shadow-[0_0_14px_rgba(0,229,255,0.22)] text-white pointer-events-auto max-w-full">
                  <div className="dc-v5-track-label hidden 2xl:flex items-center gap-1 font-bold text-slate-100 text-[10px] tracking-wide truncate max-w-[135px]">
                    <MapPin size={11} className="text-[#00e5ff] shrink-0" />
                    <span className="truncate">{track?.name ?? 'Circuito Asunción'}</span>
                  </div>
                  <span className="hidden 2xl:inline text-cyan-400/45">|</span>
                  <div className="flex items-center gap-1 font-mono font-black text-cyan-300 text-[11px] tracking-wider tabular-nums shrink-0">
                    <Timer size={11} className="text-[#00e5ff] shrink-0" />
                    <span>{formatRaceStopwatch(currentTimeSec)}</span>
                  </div>
                  {timePenaltyHudSec > 0 && (
                    <span
                      data-testid="hud-time-penalty"
                      className="inline-flex items-center rounded border border-rose-400/80 bg-rose-950/90 px-1.5 py-0.5 text-[9px] font-mono font-black text-rose-200 tabular-nums shrink-0"
                    >
                      +{timePenaltyHudSec}s
                    </span>
                  )}
                  {raceMode === 'practice_free' ? (
                    <span className="inline-flex items-center rounded border border-sky-400/45 bg-sky-950/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-200 shrink-0">
                      PRUEBA LIBRE
                    </span>
                  ) : circuitTarget ? (
                    <span
                      data-testid="hud-target-time"
                      className="inline-flex items-center rounded border border-amber-400/55 bg-amber-950/85 px-1.5 py-0.5 text-[9px] font-mono font-black text-amber-200 tabular-nums shrink-0"
                    >
                      🎯 ≤ {formatTargetMinutesSec(circuitTarget.targetSec)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowRearviewMirror(v => !v)}
                    aria-pressed={showRearviewMirror}
                    aria-label={showRearviewMirror ? 'Ocultar espejos retrovisores' : 'Mostrar espejos retrovisores'}
                    className={`ml-1 rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer shrink-0 min-h-[26px] ${
                      showRearviewMirror
                        ? 'border-cyan-400/60 bg-cyan-950/80 text-cyan-200'
                        : 'border-slate-700 bg-slate-900/90 text-slate-400'
                    }`}
                  >
                    {showRearviewMirror ? 'ESPEJOS ON' : 'ESPEJOS OFF'}
                  </button>
                  {showRearviewMirror && (
                    <button
                      type="button"
                      onClick={() => setShowSideMirrors(v => !v)}
                      aria-pressed={showSideMirrors}
                      aria-label={showSideMirrors ? 'Ocultar espejos laterales' : 'Mostrar espejos laterales'}
                      title="Espejos laterales izquierdo y derecho"
                      className={`hidden sm:inline-flex items-center rounded-lg border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer shrink-0 min-h-[26px] ${
                        showSideMirrors
                          ? 'border-cyan-400/45 bg-slate-900/90 text-cyan-300'
                          : 'border-slate-700 bg-slate-950/90 text-slate-500'
                      }`}
                    >
                      LAT
                    </button>
                  )}
                </div>

                {/* Espejo retrovisor interior realista con soporte superior y carcasa trapezoidal (sin etiqueta superpuesta) */}
                {showRearviewMirror && (
                  <div className="dc-v5-rearview-wrap mt-1 flex flex-col items-center pointer-events-none">
                    <div className="dc-v5-rearview-stem" aria-hidden="true" />
                    <div
                      className="dc-v5-rearview-housing relative flex items-center justify-center overflow-hidden"
                      aria-label="Espejo retrovisor interior en tiempo real"
                    >
                      <canvas
                        ref={rearviewCanvasRef}
                        data-testid="digital-rearview-mirror"
                        width={192}
                        height={60}
                        className="dc-v5-rearview-canvas block w-full h-full object-cover"
                      />
                      <span
                        aria-hidden="true"
                        className={`absolute left-2 top-1.5 text-[9px] font-black transition-opacity ${
                          turnSignalBlinkHud.leftLit ? 'text-amber-400 opacity-100 drop-shadow-[0_0_6px_#f59e0b]' : 'text-slate-500 opacity-30'
                        }`}
                      >
                        ◀
                      </span>
                      <span
                        aria-hidden="true"
                        className={`absolute right-2 top-1.5 text-[9px] font-black transition-opacity ${
                          turnSignalBlinkHud.rightLit ? 'text-amber-400 opacity-100 drop-shadow-[0_0_6px_#f59e0b]' : 'text-slate-500 opacity-30'
                        }`}
                      >
                        ▶
                      </span>
                    </div>
                  </div>
                )}

                {(raceMode === 'speed_pro' || onlineSession) && (
                  <div className="mt-1 hidden sm:flex flex-wrap items-center justify-center gap-1">
                    {raceMode === 'speed_pro' && (
                      <span className="rounded-md border border-amber-400/70 bg-amber-950/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-200 shadow">
                        FASE 2 · VELOCIDAD PURA
                      </span>
                    )}
                    {onlineSession && (
                      <span className="rounded-md border border-cyan-400/70 bg-cyan-950/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-200 shadow">
                        EN LÍNEA · {onlinePeersHud.length + 1} PILOTOS
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Espejos retrovisores laterales izquierdo y derecho (cámaras secundarias reales) */}
              {showRearviewMirror && showSideMirrors && (
                <>
                  <div
                    className={`dc-v5-sidemirror dc-v5-sidemirror-left pointer-events-none select-none ${
                      blindSpotState.leftAlert ? 'dc-v5-sidemirror-alert' : ''
                    }`}
                    aria-label="Espejo lateral izquierdo en tiempo real"
                  >
                    <canvas
                      ref={leftMirrorCanvasRef}
                      data-testid="left-side-mirror"
                      width={96}
                      height={58}
                      className="block w-full h-full object-cover"
                    />
                    <span className="dc-v5-sidemirror-tag">IZQ</span>
                    {blindSpotState.equipped && (
                      <span
                        aria-hidden="true"
                        className={`dc-v5-sidemirror-dot ${blindSpotState.leftAlert ? 'active' : ''}`}
                      />
                    )}
                  </div>

                  <div
                    className={`dc-v5-sidemirror dc-v5-sidemirror-right pointer-events-none select-none ${
                      blindSpotState.rightAlert ? 'dc-v5-sidemirror-alert' : ''
                    }`}
                    aria-label="Espejo lateral derecho en tiempo real"
                  >
                    <canvas
                      ref={rightMirrorCanvasRef}
                      data-testid="right-side-mirror"
                      width={96}
                      height={58}
                      className="block w-full h-full object-cover"
                    />
                    <span className="dc-v5-sidemirror-tag">DER</span>
                    {blindSpotState.equipped && (
                      <span
                        aria-hidden="true"
                        className={`dc-v5-sidemirror-dot ${blindSpotState.rightAlert ? 'active' : ''}`}
                      />
                    )}
                  </div>
                </>
              )}
            </>
          );
        })()}

        {/* 2A. BANDA VIAL Y ADAS COHERENTE (Debajo del espejo / en fila dedicada mobile sin pisar minimapa ni velocímetro) */}
        {experience === 'race' && !hasFinished && (
          <div className="dc-v5-road-rules-strip absolute z-30 pointer-events-none flex flex-col items-center gap-1 select-none">
            <div className="flex flex-wrap items-center justify-center gap-1 pointer-events-auto">
              {/* Tarjeta reglamentaria Velocidad MÁXIMA y MÍNIMA */}
              {activeSpeedZone && (() => {
                const curSpeed = selectedVehicleState?.speedKmh ?? 0;
                const overMax = curSpeed > activeSpeedZone.maxKmh + 5;
                const underMin = curSpeed > 4 && curSpeed < activeSpeedZone.minKmh - 4 && (!upcomingTrafficLight || upcomingTrafficLight.phase === 'green');
                return (
                  <div
                    className={`flex items-center gap-1 rounded-lg border px-1.5 py-0.5 bg-[#06101d]/95 shadow ${
                      overMax
                        ? 'border-rose-400 ring-1 ring-rose-500/60'
                        : underMin
                          ? 'border-amber-400/80'
                          : 'border-slate-700/90'
                    }`}
                    aria-label={`Límite máximo ${activeSpeedZone.maxKmh} y mínimo ${activeSpeedZone.minKmh} kilómetros por hora`}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-rose-500 bg-white text-[9px] font-black text-slate-950 tabular-nums leading-none">
                      {activeSpeedZone.maxKmh}
                    </span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/85 bg-sky-600 text-[9px] font-black text-white tabular-nums leading-none">
                      {activeSpeedZone.minKmh}
                    </span>
                  </div>
                );
              })()}

              {/* Indicador de Semáforo Próximo */}
              {upcomingTrafficLight && upcomingTrafficLight.distanceToStopM >= -2 && (
                <div
                  className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 bg-[#06101d]/95 shadow text-[9px] font-black uppercase tracking-wide ${
                    upcomingTrafficLight.phase === 'red'
                      ? 'border-rose-500/90 text-rose-200'
                      : upcomingTrafficLight.phase === 'yellow'
                        ? 'border-amber-400/90 text-amber-200'
                        : 'border-emerald-500/70 text-emerald-200'
                  }`}
                >
                  <span className="inline-flex items-center gap-0.5 rounded bg-slate-950 px-1 py-0.5 border border-slate-800">
                    <span className={`h-1.5 w-1.5 rounded-full ${upcomingTrafficLight.phase === 'red' ? 'bg-rose-500' : 'bg-rose-950'}`} />
                    <span className={`h-1.5 w-1.5 rounded-full ${upcomingTrafficLight.phase === 'yellow' ? 'bg-amber-400' : 'bg-amber-950'}`} />
                    <span className={`h-1.5 w-1.5 rounded-full ${upcomingTrafficLight.phase === 'green' ? 'bg-emerald-400' : 'bg-emerald-950'}`} />
                  </span>
                  <span className="tabular-nums">{Math.max(0, Math.round(upcomingTrafficLight.distanceToStopM))}m</span>
                  <span>
                    {upcomingTrafficLight.phase === 'red'
                      ? 'ROJO'
                      : upcomingTrafficLight.phase === 'yellow'
                        ? 'ÁMBAR'
                        : 'VERDE'}
                  </span>
                </div>
              )}

              {/* Lectura ADAS auditada (OEM verificado vs No disponible vs Asistencia simulada del juego) */}
              {adasReadout && (
                <div
                  data-testid="adas-hud-badge"
                  aria-live="polite"
                  className={`pointer-events-none inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[9px] font-mono font-bold shadow ${
                    adasReadout.colorTone === 'red'
                      ? 'border-rose-400 bg-rose-950/95 text-rose-100'
                      : adasReadout.colorTone === 'amber'
                        ? 'border-amber-400 bg-amber-950/95 text-amber-100'
                        : adasReadout.colorTone === 'cyan'
                          ? 'border-cyan-400/50 bg-slate-950/90 text-cyan-200'
                          : 'border-slate-700/80 bg-slate-950/85 text-slate-400'
                  }`}
                >
                  <span className="font-black uppercase tracking-wider">{adasReadout.badgeLabel}</span>
                  {(adasReadout.level === 'detection' ||
                    adasReadout.level === 'caution' ||
                    adasReadout.level === 'collision_warning' ||
                    adasReadout.level === 'aeb_active') && (
                    <span className="hidden sm:inline text-[9px] opacity-90">· {adasReadout.detailLabel}</span>
                  )}
                </div>
              )}

              {selectedVehicle && liveVehicleStates[selectedVehicle.id]?.laneDepartureWarning && (
                <span className="pointer-events-none rounded-lg border border-amber-400 bg-amber-950/90 px-2 py-0.5 text-[9px] font-mono font-bold text-amber-200">
                  LDW CARRIL
                </span>
              )}
            </div>

            {/* Banner de aviso / penalización vial en vivo */}
            {trafficNotice && (
              <div
                role="status"
                className={`rounded-lg border px-2.5 py-0.5 text-center shadow-lg pointer-events-none max-w-[92vw] ${
                  trafficNotice.kind === 'penalty'
                    ? 'border-rose-400 bg-rose-950/95 text-rose-100'
                    : trafficNotice.kind === 'ok'
                      ? 'border-emerald-400 bg-emerald-950/95 text-emerald-100'
                      : 'border-amber-400 bg-amber-950/95 text-amber-100'
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-wide">
                  {trafficNotice.title} · <span className="font-medium opacity-90">{trafficNotice.subtitle}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2B. SENSORES ADAS DE PUNTO CIEGO LATERAL (IZQUIERDA / DERECHA — solo modelos con ADAS verificado) */}
        {experience === 'race' && !hasFinished && selectedVehicle && hasVerifiedBlindSpotAdas(selectedVehicle) && (
          <>
            <div
              aria-live="polite"
              className={`dc-v5-bsd-pill dc-v5-bsd-left pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-opacity duration-150 ${
                blindSpotState.leftAlert
                  ? 'border-amber-300 bg-amber-950/95 text-amber-200 opacity-100 shadow-[0_0_16px_rgba(251,191,36,0.55)]'
                  : 'border-cyan-500/25 bg-[#050f1d]/75 text-slate-400 opacity-50'
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  blindSpotState.leftAlert ? 'bg-amber-400 animate-ping' : 'bg-slate-600'
                }`}
              />
              <div className="leading-tight">
                <div className="text-[8px] font-black uppercase tracking-wider">◀ BSD</div>
                <div className="text-[9px] font-mono font-bold tabular-nums">
                  {blindSpotState.leftAlert ? `${blindSpotState.leftDistanceM ?? ''}m` : 'LIBRE'}
                </div>
              </div>
            </div>

            <div
              aria-live="polite"
              className={`dc-v5-bsd-pill dc-v5-bsd-right pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-opacity duration-150 ${
                blindSpotState.rightAlert
                  ? 'border-amber-300 bg-amber-950/95 text-amber-200 opacity-100 shadow-[0_0_16px_rgba(251,191,36,0.55)]'
                  : 'border-cyan-500/25 bg-[#050f1d]/75 text-slate-400 opacity-50'
              }`}
            >
              <div className="leading-tight text-right">
                <div className="text-[8px] font-black uppercase tracking-wider">BSD ▶</div>
                <div className="text-[9px] font-mono font-bold tabular-nums">
                  {blindSpotState.rightAlert ? `${blindSpotState.rightDistanceM ?? ''}m` : 'LIBRE'}
                </div>
              </div>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  blindSpotState.rightAlert ? 'bg-amber-400 animate-ping' : 'bg-slate-600'
                }`}
              />
            </div>
          </>
        )}

        {/* 2C. EFECTO VISUAL DE SALPICADURA DE AGUA EN PARABRISAS AL CAER EN BACHE MOJADO */}
        {experience === 'race' && !hasFinished && splashHudActive && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 z-20 flex items-end justify-center pb-24 bg-[radial-gradient(ellipse_at_25%_95%,rgba(125,211,252,0.34),transparent_48%),radial-gradient(ellipse_at_75%_95%,rgba(125,211,252,0.34),transparent_48%)]"
          >
            <span className="rounded-lg border border-sky-300/60 bg-sky-950/90 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-200">
              💦 Salpicadura en calzada mojada
            </span>
          </div>
        )}

        {/* 4B. COMANDO DE CONDUCCIÓN SEGURA: SEÑALEROS / BALIZAS + CINTURÓN DE SEGURIDAD VISIBLE */}
        {experience === 'race' && !hasFinished && (
          <div
            role="group"
            aria-label="Señaleros y cinturón de seguridad"
            data-testid="turn-signals-pod"
            className="dc-v5-turn-signals-pod absolute left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 sm:gap-1.5 rounded-xl border border-cyan-400/40 bg-[#040c1a]/96 px-1.5 sm:px-2 py-1 shadow-[0_6px_20px_rgba(0,0,0,0.82)] pointer-events-auto select-none"
          >
            <button
              type="button"
              data-testid="turn-left-button"
              onClick={() => triggerTurnSignalAction('toggle_left')}
              aria-label="Señalero izquierdo"
              aria-pressed={turnSignalMode === 'left'}
              title="Luz de giro izquierda (Tecla Q · se apaga sola al girar a la derecha)"
              className={`min-w-[46px] sm:min-w-[52px] min-h-[36px] px-2 rounded-lg border text-[10px] sm:text-xs font-black tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                turnSignalMode === 'left'
                  ? turnSignalBlinkHud.leftLit
                    ? 'border-amber-300 bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.85)]'
                    : 'border-amber-500/70 bg-amber-950/95 text-amber-300'
                  : 'border-slate-700 bg-slate-900/95 text-slate-200 hover:border-amber-400/50'
              }`}
            >
              <span>◀</span>
              <span>IZQ</span>
            </button>
            <button
              type="button"
              data-testid="turn-hazards-button"
              onClick={() => triggerTurnSignalAction('toggle_hazards')}
              aria-label="Balizas de emergencia"
              aria-pressed={turnSignalMode === 'hazards'}
              title="Balizas / 4 luces (Tecla B)"
              className={`min-w-[36px] sm:min-w-[38px] min-h-[36px] px-2 rounded-lg border text-xs font-black transition-colors cursor-pointer flex items-center justify-center ${
                turnSignalMode === 'hazards'
                  ? turnSignalBlinkHud.leftLit
                    ? 'border-rose-300 bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.85)]'
                    : 'border-rose-500/70 bg-rose-950/95 text-rose-300'
                  : 'border-slate-700 bg-slate-900/95 text-rose-300 hover:border-rose-400/50'
              }`}
            >
              ⚠
            </button>
            <button
              type="button"
              data-testid="turn-right-button"
              onClick={() => triggerTurnSignalAction('toggle_right')}
              aria-label="Señalero derecho"
              aria-pressed={turnSignalMode === 'right'}
              title="Luz de giro derecha (Tecla E · se apaga sola al girar a la izquierda)"
              className={`min-w-[46px] sm:min-w-[52px] min-h-[36px] px-2 rounded-lg border text-[10px] sm:text-xs font-black tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                turnSignalMode === 'right'
                  ? turnSignalBlinkHud.rightLit
                    ? 'border-amber-300 bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.85)]'
                    : 'border-amber-500/70 bg-amber-950/95 text-amber-300'
                  : 'border-slate-700 bg-slate-900/95 text-slate-200 hover:border-amber-400/50'
              }`}
            >
              <span>DER</span>
              <span>▶</span>
            </button>
            {turnSignalMode !== 'off' && (
              <button
                type="button"
                onClick={() => triggerTurnSignalAction('turn_off')}
                aria-label="Apagar señaleros"
                title="Apagar señaleros (Tecla X)"
                className="min-w-[32px] min-h-[36px] px-1.5 rounded-lg border border-slate-600 bg-slate-800/95 text-[11px] font-black text-slate-200 hover:bg-slate-700 cursor-pointer flex items-center justify-center"
              >
                ✕
              </button>
            )}

            <span aria-hidden="true" className="h-5 w-px bg-cyan-500/30 mx-0.5 shrink-0" />

            <button
              type="button"
              data-testid="seatbelt-button"
              onClick={buckleSeatbelt}
              aria-pressed={seatbeltBuckled}
              aria-label={seatbeltBuckled ? 'Cinturón de seguridad puesto' : 'Ponerse el cinturón de seguridad'}
              title="Abrochar cinturón de seguridad (Tecla C)"
              className={`min-h-[36px] px-2.5 sm:px-3.5 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                seatbeltBuckled
                  ? 'border border-emerald-400/85 bg-emerald-950/95 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.28)]'
                  : 'border-2 border-amber-400 bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 shadow-[0_0_16px_rgba(245,158,11,0.55)]'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="5.5" r="2.5" />
                <path d="M7.5 20.5v-5a4.5 4.5 0 0 1 9 0v5" />
                <path d="M6.5 10.5l11 8" />
                <rect x="13.2" y="15.2" width="3.8" height="3.2" rx="0.8" fill="currentColor" />
              </svg>
              <span className="whitespace-nowrap">
                {seatbeltBuckled ? '✓ CINTURÓN PUESTO' : 'PONER CINTURÓN'}
              </span>
              {!seatbeltBuckled && (
                <span className="hidden lg:inline-block rounded bg-slate-950/20 px-1 py-0.5 font-mono text-[9px] font-black">
                  C
                </span>
              )}
            </button>
          </div>
        )}

        {/* 5. CENTRO INFERIOR: Píldora flotante de Driving IQ con feedback dinámico */}
        {experience === 'race' && !hasFinished && (
          <div className="dc-mockup5-driving-iq absolute left-1/2 -translate-x-1/2 z-25 pointer-events-none select-none max-w-[min(380px,calc(100vw-620px))]">
            <div className="flex items-center gap-2 px-3.5 py-1 bg-[#030914]/94 border border-[#00e5ff]/45 rounded-xl shadow-[0_0_14px_rgba(0,229,255,0.28)] text-white w-full overflow-hidden">
              <Gauge size={14} className="text-[#00e5ff] shrink-0" />
              <span className="text-[11px] font-semibold text-slate-100 tracking-wide truncate">
                {dynamicDrivingFeedback}
              </span>
            </div>
          </div>
        )}

        {/* 3. ESQUINA SUPERIOR DERECHA: Botones de cámara y pausa en cristal oscuro + Tacómetro/Velocímetro digital arcade */}
        {experience === 'race' && !hasFinished && selectedVehicle && selectedVehicleState && (
          <>
            <div className="dc-mobile-speed-wrapper lg:hidden">
              <Mockup5SpeedCluster
                speedKmh={selectedVehicleState.speedKmh}
                rpm={selectedVehicleState.rpm}
                gear={selectedVehicleState.gear}
                onCycleCamera={cycleCameraMode}
                onPause={() => {
                  soundEngine.unlock();
                  setMobileMenuOpen(true);
                  setIsPlaying(false);
                  stateRef.current.isPlaying = false;
                }}
                onOpenDetailed={() => setShowDetailedHud(true)}
              />
            </div>
            <div className="dc11-desktop-hud hidden lg:block"><ArcadeRaceHud vehicle={selectedVehicle} state={selectedVehicleState}/></div>
            {showDetailedHud && <div className="dc11-hud-backdrop" role="dialog" aria-label="Telemetría extendida">
              <button className="dc11-hud-close" onClick={()=>setShowDetailedHud(false)}><X size={17}/> VOLVER A CARRERA</button>
              <div className="dc11-hud-gauge"><ArcadeRaceHud vehicle={selectedVehicle} state={selectedVehicleState}/></div>
              <p>VELOCIDAD · RPM · MARCHA · ACELERACIÓN · ASISTENCIAS DOCUMENTADAS</p>
            </div>}
          </>
        )}
        {experience === 'race' && !hasFinished && countdown === null && raceInsight && (
          <div key={raceInsight.id} className={`dc100-race-insight absolute top-[260px] left-3 z-20 pointer-events-none w-[min(290px,calc(100%-24px))] rounded-xl border border-l-[3px] px-3 py-2.5 shadow-xl hidden md:block select-none ${
            raceInsight.kind === 'warning'
              ? 'border-amber-500/45 border-l-amber-400 bg-slate-950/94'
              : raceInsight.kind === 'event'
                ? 'border-emerald-500/45 border-l-emerald-400 bg-slate-950/94'
                : 'border-cyan-500/40 border-l-cyan-400 bg-slate-950/94'
          }`} aria-live="polite" aria-atomic="true">
            <div className="text-[9px] font-black uppercase tracking-[.2em] text-cyan-300">DATACAR · DATO EN CARRERA</div>
            <div className="mt-1 text-[11px] font-black uppercase tracking-wide text-white">{raceInsight.title}</div>
            <p className="mt-1 text-[11px] leading-snug text-slate-200">{raceInsight.message}</p>
            <div className="mt-1.5 text-[9px] text-slate-500">Ficha técnica + telemetría virtual · no ensayo oficial</div>
          </div>
        )}

        {/* ALERTA CENTRAL DE BACHE EN CALZADA (HUD Arcade Central) */}
        {experience === 'race' && !hasFinished && potholeWarning && (
          <div
            className="absolute top-20 sm:top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center select-none"
            role="alert"
            aria-label="Advertencia de bache en la calzada"
          >
            <div className="flex items-center gap-2.5 sm:gap-3 px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-gradient-to-r from-amber-950/95 via-red-950/98 to-amber-950/95 border-2 border-amber-400 shadow-[0_0_28px_rgba(245,158,11,0.7),inset_0_0_12px_rgba(239,68,68,0.35)] animate-pulse">
              <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-amber-300 shrink-0 drop-shadow-[0_0_8px_#f59e0b] animate-bounce" />
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="font-display font-black italic text-xs sm:text-sm tracking-wider text-amber-200 uppercase drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]">
                    ¡BACHE EN CALZADA A {Math.round(potholeWarning.distanceM)}m!
                  </span>
                </div>
                <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-200 tracking-wide">
                  Reducí velocidad o esquivalo por los lados
                </span>
              </div>
            </div>
          </div>
        )}

        <div className={`dc-v5-kbd-hint absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3 py-1 text-[10px] text-slate-300 font-mono bg-slate-950/94 border border-slate-700/60 rounded-xl shadow-lg hidden lg:flex items-center gap-2.5 whitespace-nowrap select-none max-w-[min(560px,calc(100vw-700px))] overflow-hidden`}>
          <span className="truncate">{experience === 'race' ? '↑/W Acelerar · ↓/S Reversa · Espacio Freno · ←→ Giro · C Cinturón · Q/E/B/X Señaleros' : experience === 'replay' ? 'Director TV · repetición real' : 'Comparación automática'}</span>
        </div>

        {/* Floating Diagnostics Panel (Toggleable) */}
        {showDiagnostics && (
          <div className="absolute top-14 right-3 z-30 bg-slate-950/95 border border-slate-800 p-2.5 rounded-xl shadow-2xl font-mono text-[11px] text-slate-300 w-52 pointer-events-none">
            <div className="text-amber-400 font-bold mb-1 border-b border-slate-800 pb-1 flex items-center justify-between">
              <span>DIAGNÓSTICO 3D</span>
              <span className="text-emerald-400 font-bold">{diagStats.fps} FPS</span>
            </div>
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between"><span>Frame Time:</span><span className="text-white">{diagStats.frameTimeMs} ms</span></div>
              <div className="flex justify-between"><span>Draw Calls:</span><span className="text-white">{diagStats.drawCalls}</span></div>
              <div className="flex justify-between"><span>Triángulos:</span><span className="text-white">{(diagStats.triangles / 1000).toFixed(1)}k</span></div>
              <div className="flex justify-between"><span>Física:</span><span className="text-sky-400">{interactiveMode ? '100 Hz · Fuerzas / colisiones' : 'Replay telemetría'}</span></div>
              <div className="flex justify-between"><span>Modelos 3D:</span><span className="text-emerald-400">1x GLB + Tránsito 3D Liviano</span></div>
            </div>
          </div>
        )}

        {/* Cinematic Countdown Overlay (transparente para lucir el vuelo de cámara Dron sobre la ciudad) */}
        {(countdown !== null || goFlash) && (() => {
          const countdownTarget = track?.cityCircuitId
            ? getCircuitTargetTime(
                track.cityCircuitId,
                raceMode === 'speed_pro' ? 'speed_pro' : 'city_trial',
                totalLaps,
                track.distanceMeters,
              )
            : null;
          return (
            <div className="absolute inset-0 z-30 bg-[radial-gradient(circle_at_center,transparent_55%,rgba(2,6,23,0.42)_100%)] flex flex-col items-center justify-center animate-fadeIn pointer-events-none px-4">
              <span className="rounded-full border border-cyan-400/45 bg-slate-950/90 px-3.5 py-1 text-[10px] sm:text-xs font-mono font-bold text-cyan-300 uppercase tracking-widest mb-2 shadow-lg">
                {goFlash ? 'LARGADA OFICIAL · CONTRARRELOJ' : 'CÁMARA DRON · SOBREVOLANDO ASUNCIÓN'}
              </span>
              <div className="text-8xl sm:text-9xl font-black font-display text-white tracking-wider drop-shadow-[0_8px_28px_rgba(2,6,23,0.95)] animate-bounce">
                {goFlash ? <span className="text-emerald-400 drop-shadow-[0_0_26px_rgba(52,211,153,0.85)]">¡YA!</span> : countdown}
              </div>
              <span className="rounded-lg bg-slate-950/92 px-3 py-1 text-xs font-mono text-amber-200 mt-2 border border-amber-400/45 text-center shadow-lg">
                {raceMode === 'practice_free'
                  ? `${track.name} · Conducción libre sin límite de tiempo`
                  : countdownTarget
                    ? `🎯 OBJETIVO: Llegá en ≤ ${formatTargetMinutesSec(countdownTarget.targetSec)} sin atropellar motos ni violar normas`
                    : `${track.name} · Contrarreloj individual`}
              </span>
            </div>
          );
        })()}

        {/* Floating Mini Camera Selector (Top Right of Canvas) */}
        <div className="dc100-race-camera-desktop absolute top-3 right-3 z-20 hidden lg:flex items-center gap-1 bg-slate-950/94 p-1 rounded-xl border border-slate-800/80 shadow-xl select-none">
          {experience === 'race' && <button
            onClick={() => setCameraMode('arcade')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${cameraMode === 'arcade' ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`}
            title="Cámara arcade baja y dinámica, sigue a tu auto">
            <Video className="w-3.5 h-3.5" /><span>Arcade</span>
          </button>}
          <button
            onClick={() => setCameraMode('trasera')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
              cameraMode === 'trasera'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Cámara de conducción: tercera persona detrás del vehículo seleccionado"
          >
            <Video className="w-3.5 h-3.5" />
            <span>{experience === 'race' ? 'Mi auto' : 'Persecución'}</span>
          </button>

          <button
            onClick={() => setCameraMode('lateral')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
              cameraMode === 'lateral'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Cámara 2: Lateral Transmisión Deportiva (Trackside TV)"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>TV</span>
          </button>

          <button
            onClick={() => setCameraMode('cenital')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
              cameraMode === 'cenital'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Cámara 3: Cenital 3D (Overhead perspective)"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Cenital</span>
          </button>

          <button
            onClick={() => { setCameraMode('dron'); stateRef.current.cameraMode = 'dron'; }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
              cameraMode === 'dron'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Cámara Dron: vista aérea de la ciudad de Asunción, edificios, parques y Río Paraguay"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Dron</span>
          </button>

          <button
            onClick={() => { setCameraMode('libre'); stateRef.current.cameraMode = 'libre'; }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
              cameraMode === 'libre'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Cámara libre: arrastrar con mouse/mousepad, zoom con dos dedos"
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span>Libre</span>
          </button>

          {experience === 'replay' && (<>
          {/* Nueva Cámara Frontal de Meta (FINISH_LINE_FRONT_CAMERA) */}
          <button
            onClick={() => setCameraMode('frontal_meta')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
              cameraMode === 'frontal_meta'
                ? 'bg-emerald-400 text-slate-950 shadow-md shadow-emerald-400/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Cámara 4: Frontal de Meta (Enfoque directo a parrillas y cruce)"
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Frontal Meta</span>
          </button>

          <button
            onClick={() => setCameraMode('automatica')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
              cameraMode === 'automatica'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Director cinematográfico: siete planos y llegada frontal garantizada"
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span>Director TV</span>
          </button>
          </>)}
        </div>

        {/* Full-screen Arcade Preloader Gate */}
        {isPreloading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050914]/98 px-4 py-6 select-none transition-all duration-300">
            <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center">
              {/* Badge */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-300 font-mono text-xs uppercase tracking-widest mb-3">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>DATACAR ARENA · PREPARANDO PARRILLA</span>
              </div>

              {/* Title & Track */}
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase mb-1">
                {track.name}
              </h2>
              <p className="text-xs sm:text-sm font-mono text-slate-400 mb-6">
                {track.distanceMeters} METROS · {track.subtitle}
              </p>

              {/* Competitors List */}
              <div className={`w-full grid grid-cols-1 ${vehicles.length > 1 ? 'sm:grid-cols-3' : 'max-w-xs mx-auto'} gap-3 mb-6`}>
                {vehicles.map((v, i) => {
                  const isPlayer = v.id === (playerVehicleId || vehicles[0]?.id);
                  const isModelReady = i < loadedVehicleModels;
                  return (
                    <div
                      key={v.id}
                      className={`relative rounded-xl border p-3 flex flex-col items-center text-center transition-all ${
                        isPlayer
                          ? 'border-amber-400/60 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                          : 'border-slate-800 bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20" style={{ backgroundColor: v.color }} />
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                          {isPlayer ? 'TU AUTO' : `RIVAL ${i}`}
                        </span>
                      </div>
                      <div className="text-sm font-black text-white uppercase tracking-tight">
                        {v.brand} {v.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {formatOfficialPower(v)} · {formatOfficialTorque(v)}
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-[10px] font-bold font-mono">
                        {isModelReady ? (
                          <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                            ✓ LISTO EN PISTA
                          </span>
                        ) : (
                          <span className="text-sky-400 flex items-center gap-1 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-md animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                            CARGANDO 3D...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md bg-slate-900/80 rounded-full h-2.5 border border-slate-700/60 overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-amber-400 transition-all duration-300 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.8)]"
                  style={{
                    width: `${
                      requiredVehicleModels > 0
                        ? Math.min(100, Math.round((loadedVehicleModels / requiredVehicleModels) * 100))
                        : 100
                    }%`,
                  }}
                />
              </div>

              {/* Status Message */}
              <div className="text-xs font-mono text-slate-400">
                {loadedVehicleModels >= requiredVehicleModels
                  ? '¡Vehículos en pista! Iniciando largada...'
                  : `Cargando y calibrando modelos 3D (${loadedVehicleModels}/${requiredVehicleModels})...`}
              </div>

              {glbLoadError && (
                <div className="mt-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-lg">
                  {glbLoadError} (utilizando auto-fallback)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Race Positions Pill (Shown only when comparing or racing with multiple cars) */}
        {vehicles.length > 1 && (
          <div className="dc100-race-ranking absolute top-[186px] left-3 z-20 hidden md:flex flex-col gap-1 bg-slate-950/94 p-2 rounded-xl border border-slate-800/80 shadow-xl font-mono text-[11px] pointer-events-none select-none max-w-[280px]">
            {vehicles.map((v) => {
              const st = interactiveMode && liveVehicleStates[v.id]
                ? liveVehicleStates[v.id]
                : getInterpolatedVehicleState(v.id, currentTimeSec);
              return (
                <div key={v.id} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full ring-1 ring-white/30" style={{ backgroundColor: v.color }} />
                  <span className="text-white font-bold">{v.name.slice(0, 10)}</span>
                  {v.id === (playerVehicleId || vehicles[0]?.id) ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-300 border border-amber-400/40 font-black">
                      TU AUTO (GLB)
                    </span>
                  ) : (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/25 text-sky-300 border border-sky-400/40 font-bold">
                      3D OEM
                    </span>
                  )}
                  <span className="text-sky-400 tabular-nums">{st.speedKmh.toFixed(0)} km/h</span>
                  <span className="text-slate-400 tabular-nums">{st.distance.toFixed(0)}m</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ergonomic Collapsible Bottom Control Dock */}
      <div className="border-t border-slate-800 bg-slate-950/95 flex flex-col">
        {/* Collapse / Expand Toggle Bar */}
        <div className="px-4 py-1.5 flex items-center justify-between border-b border-slate-900 bg-slate-950">
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 flex-wrap">
            <span className="text-sky-400 font-bold">CONTROLES & TELEMETRÍA</span>
            <span>·</span>
            <span>Cámara activa: <strong className="text-white uppercase">{cameraMode}</strong></span>
            <span>·</span>
            <span>Velocidad visual: <strong className="text-amber-400 font-bold">{playbackSpeed}x</strong></span>
          </div>

          <button
            onClick={() => setIsHudCollapsed(!isHudCollapsed)}
            className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800"
          >
            {isHudCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>{isHudCollapsed ? 'Mostrar Panel' : 'Minimizar'}</span>
          </button>
        </div>

        {!isHudCollapsed && (
          <>
            {/* Playback Controls & Timeline Scrubber */}
            <div className="px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { soundEngine.unlock(); soundEngine.setWeather(weatherModeRef.current); setIsPlaying(!isPlaying); }}
                  disabled={hasFinished && experience === 'race'}
                  className="w-8 h-8 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center justify-center transition-colors shadow-md shadow-sky-500/30"
                  title={isPlaying ? 'Pausar' : 'Reanudar'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950 ml-0.5" />}
                </button>

                <button
                  onClick={() => {
                    if (interactiveMode) {
                      // Recrear el motor dentro del loop; conservar las posiciones de los obstáculos.
                      physicsRef.current = new InteractiveRacePhysics(vehicles, track,
                        stateRef.current.selectedVehicleId, false, {
                          urbanTrafficRules: experience === 'race' && raceMode !== 'speed_pro',
                          speedRaceMode: experience === 'race' && raceMode === 'speed_pro',
                          playerPayloadKg,
                        });
                      const rebuilt = physicsRef.current;
                      rebuilt.setWeather(weatherModeRef.current);
                      rebuilt.restoreHazards(raceHazardsSnapshotRef.current);
                      finalResultsRef.current = null;
                      setRaceEvent('');
                      setRaceInsight(null);
                      setSeatbeltBuckled(false);
                      setTrafficNotice(null);
                      setTimePenaltyHudSec(0);
                      setLiveVehicleStates({});
                      resetVisualRaceRef.current?.();
                    }
                    setCurrentTimeSec(0);
                    stateRef.current.currentTimeSec = 0;
                    if (timeDisplayRef.current) {
                      timeDisplayRef.current.textContent = '0.00s';
                    }
                    if (finishTimerRef.current !== null) {
                      clearTimeout(finishTimerRef.current);
                      finishTimerRef.current = null;
                    }
                    resultDeliveredRef.current = false;
                    soundEngine.unlock();
                    soundEngine.setWeather(weatherModeRef.current);
                    if (experience === 'race') {
                      setRestartSequence(value => value + 1);
                      setIsPlaying(false);
                      stateRef.current.isPlaying = false;
                    } else {
                      setIsPlaying(true);
                      stateRef.current.isPlaying = true;
                    }
                    setHasFinished(false);
                    stateRef.current.hasFinished = false;
                  }}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors border border-slate-700"
                  title="Reiniciar Carrera"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Separación de física y reproducción visual: 0.25x, 0.5x, 0.75x (predeterminado), 1x, 2x */}
                <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 ml-1 text-xs font-mono">
                  {[0.25, 0.5, 0.75, 1, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                        playbackSpeed === spd
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title={`Reproducción a ${spd}x (0.75x recomendado para disfrutar la acción)`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrubber */}
              <div className="flex-1 max-w-md w-full flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max={interactiveMode ? (track.cityCircuitId ? 420 : 180) * Math.max(1, track.laps ?? 1) : maxRaceTimeSec}
                  step="0.01"
                  disabled={interactiveMode}
                  value={currentTimeSec}
                  onChange={handleSeek}
                  aria-label="Línea de tiempo de la carrera"
                  title={interactiveMode ? 'El modo físico no permite retroceder el tiempo; usá Reiniciar' : 'Mover cronómetro'}
                  className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
                  {interactiveMode ? `${currentTimeSec.toFixed(1)} s · tiempo real` : `${currentTimeSec.toFixed(1)} / ${maxRaceTimeSec.toFixed(1)}s`}
                </span>
              </div>
            </div>

            {/* MODO CONDUCCIÓN FÍSICA Y EDICIÓN DE RIESGOS */}
            <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/60 flex flex-wrap items-center gap-2">
              {experience === 'legacy' && <button type="button" onClick={() => { setPlacementKind(null); setInteractiveMode(v => !v); }}
                disabled={track.distanceMeters > 3500}
                className={`text-xs rounded-lg border px-3 py-2 font-semibold ${interactiveMode ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-slate-800 border-slate-600 text-slate-300'}`}>
                <Zap className="inline w-3.5 h-3.5 mr-1" /> {interactiveMode ? 'Física interactiva ON' : 'Carrera clásica'}
              </button>}
              {interactiveMode && experience !== 'replay' && <>
                <button type="button" onClick={() => { setPlacementKind(null); setHazardsEnabled(v => !v); }}
                  className={`text-xs rounded-lg border px-2.5 py-2 ${hazardsEnabled ? 'text-amber-300 border-amber-500/50' : 'text-slate-400 border-slate-700'}`}>
                  <ShieldAlert className="inline w-3.5 h-3.5 mr-1" /> Baches/obstáculos {hazardsEnabled ? 'ON' : 'OFF'}
                </button>
                <button type="button" disabled={!hazardsEnabled} onClick={() => addVisualHazardRef.current?.('pothole')}
                  className="text-xs rounded-lg border border-slate-600 px-2.5 py-2 text-slate-200 hover:bg-slate-700 disabled:opacity-35">
                  + Bache
                </button>
                <button type="button" disabled={!hazardsEnabled} onClick={() => addVisualHazardRef.current?.('barrier')}
                  className="text-xs rounded-lg border border-slate-600 px-2.5 py-2 text-slate-200 hover:bg-slate-700 disabled:opacity-35">
                  <TrafficCone className="inline w-3.5 h-3.5 mr-1" /> + Obstáculo
                </button>
                <button type="button" disabled={!hazardsEnabled} onClick={() => setPlacementKind(p => p === 'pothole' ? null : 'pothole')}
                  className={`text-xs rounded-lg border px-2.5 py-2 ${placementKind === 'pothole' ? 'text-emerald-200 border-emerald-400' : 'text-slate-300 border-slate-600'} disabled:opacity-35`}>
                  {placementKind === 'pothole' ? '✓ Clic en pista: bache' : 'Colocar bache con mouse'}
                </button>
                <button type="button" disabled={!hazardsEnabled} onClick={() => setPlacementKind(p => p === 'barrier' ? null : 'barrier')}
                  className={`text-xs rounded-lg border px-2.5 py-2 ${placementKind === 'barrier' ? 'text-emerald-200 border-emerald-400' : 'text-slate-300 border-slate-600'} disabled:opacity-35`}>
                  {placementKind === 'barrier' ? '✓ Clic en pista: obstáculo' : 'Colocar obstáculo con mouse'}
                </button>
                <span className="text-[10px] text-slate-400">{hazardCount} riesgos · la IA intenta esquivarlos</span>
              </>}
              {experience === 'legacy' && track.distanceMeters > 3500 && <span className="text-[10px] text-amber-300">Modo interactivo disponible en pistas de hasta 3.500 m.</span>}
              <span className="w-full text-[11px] text-sky-200">
                {experience === 'race' ? '↑ / W: avanzar · ↓ / S: frenar y retroceder · Espacio: freno · ← →: dirección · Q / E / B / X: señaleros y balizas · C: cinturón' : experience === 'replay' ? 'Grabación real de tu carrera · Director TV automático · controles de reproducción disponibles' : 'Comparación automática a partir de las fichas técnicas.'}
              </span>
              {interactiveMode && raceEvent && <span className="w-full text-[11px] text-amber-300 font-semibold">{raceEvent}</span>}
            </div>

            {/* VOLANTE INTERACTIVO: mueve lateralmente y orienta el auto elegido.
                Los tiempos oficiales/ranking permanecen sin alteraciones. */}
            {experience === 'race' && (
            <div className="px-4 py-2 border-t border-slate-900 bg-slate-950 flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2 min-w-[210px]">
                <Keyboard className="w-4 h-4 text-sky-400" />
                <span className="text-sky-400 font-mono font-bold text-xs">VOLANTE / FLECHAS ← →</span>
                <span className="text-slate-400 text-xs font-mono">{steeringDemoDeg > 0 ? '+' : ''}{steeringDemoDeg}°</span>
              </div>
              <label className="flex-1 max-w-sm flex items-center gap-3 text-xs font-mono text-slate-300">
                <span>Izq.</span>
                <input
                  type="range" min="-30" max="30" step="1"
                  aria-label="Volante: dirige lateralmente el automóvil seleccionado"
                  value={steeringDemoDeg}
                  onChange={e => {
                    keyboardSteeringRef.current = false;
                    const angle = Number(e.target.value);
                    stateRef.current.steeringDemoDeg = angle;
                    setSteeringDemoDeg(angle);
                    cancelOppositeTurnSignalRef.current(angle / 30);
                  }}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <span>Der.</span>
              </label>
              <button
                type="button"
                className="rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5"
                onClick={() => { keyboardSteeringRef.current = false; stateRef.current.steeringDemoDeg = 0; setSteeringDemoDeg(0); }}
              >
                Centrar volante
              </button>
              <span className="text-[10px] text-slate-400">{interactiveMode ? 'Conducción física: velocidad, adherencia, baches y choques modifican el resultado.' : 'Modo clásico: los tiempos oficiales no cambian.'}</span>
            </div>

            )}

            {/* Individual Telemetry HUD */}
            <div className="px-4 py-2 border-t border-slate-900 bg-slate-950 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400">Telemetría en foco:</span>
                <div className="flex items-center gap-1">
                  {vehicles.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => { if (experience === 'legacy' || experience === 'comparison') setSelectedVehicleId(v.id); }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 ${
                        selectedVehicleId === v.id
                          ? 'bg-slate-800 text-white border border-slate-700 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                      <span>{v.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedVehicle && selectedVehicleState && (
                <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-300 flex-wrap">
                  <div>
                    <span className="text-slate-500 mr-1.5">Velocidad:</span>
                    <strong className="text-white text-sm">{selectedVehicleState.speedKmh.toFixed(1)}</strong>
                    <span className="text-slate-400 text-[10px] ml-0.5">km/h</span>
                  </div>
                  <div>
                    <span className="text-slate-500 mr-1.5">Distancia:</span>
                    <strong className="text-sky-400 text-sm">{selectedVehicleState.distance.toFixed(1)}</strong>
                    <span className="text-slate-400 text-[10px] ml-0.5">m</span>
                  </div>
                  <div>
                    <span className="text-slate-500 mr-1.5">Aceleración:</span>
                    <strong className="text-emerald-400">{selectedVehicleState.accelG > 0 ? `+${selectedVehicleState.accelG.toFixed(2)}` : selectedVehicleState.accelG.toFixed(2)}</strong>
                    <span className="text-slate-400 text-[10px] ml-0.5">G</span>
                  </div>
                  <div>
                    <span className="text-slate-500 mr-1.5">Marcha:</span>
                    <strong className="text-amber-400">{selectedVehicleState.gear === 0 ? 'R' : `${selectedVehicleState.gear}ª`}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 mr-1.5">RPM:</span>
                    <strong className="text-slate-200">{selectedVehicleState.rpm}</strong>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

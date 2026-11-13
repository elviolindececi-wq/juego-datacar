import React from 'react';
import {
  Brain,
  Car,
  CheckCircle2,
  ChevronsRight,
  Clapperboard,
  Crown,
  Disc,
  FlagTriangleRight,
  Gauge,
  Info,
  Leaf,
  Loader2,
  Mountain,
  Timer,
  Trophy,
  Warehouse,
  Zap,
} from 'lucide-react';
import type { Vehicle, VehicleRaceResult } from '../types/vehicle';
import { getOfficialVehicleImageUrl } from '../data/presetVehicles';
import type { AsuncionCircuit } from '../data/asuncionCircuits';
import type { WeatherMode } from '../utils/weatherDynamics';
import { WEATHER_OPTIONS } from '../utils/weatherDynamics';
import type { DrivingIQAssessment } from '../utils/drivingIQ';
import type { RaceModeId } from '../utils/careerProgression';
import { CITY_UNLOCK_MIN_IQ } from '../utils/careerProgression';
import { Clock, Compass, Globe, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import {
  evaluateCircuitTimeResult,
  formatTargetMinutesSec,
  getCircuitTargetTime,
} from '../utils/circuitTargetTimes';
import {
  DEFAULT_PAYLOAD_SELECTION,
  computePayloadKg,
  type VehiclePayloadSelection,
} from '../utils/payloadConfig';
import { PayloadSelector } from './PayloadSelector';
import {
  formatOfficialOrSimAccel,
  formatOfficialPower,
  formatOfficialTorque,
} from '../utils/specFidelity';

export const CIRCUIT_META: Record<
  string,
  { curves: number; terrain: string; path: string; dot: [number, number] }
> = {
  aviadores: {
    curves: 12,
    terrain: 'Desnivel bajo',
    path: 'M 28 76 C 18 62, 34 42, 56 46 C 72 49, 78 24, 104 22 C 130 20, 134 38, 158 34 C 182 30, 198 18, 202 34 C 206 50, 172 64, 138 74 C 102 84, 52 94, 28 76 Z',
    dot: [114, 80],
  },
  avelino: {
    curves: 16,
    terrain: 'Asfalto exigente',
    path: 'M 24 72 C 20 44, 48 24, 78 30 C 102 35, 114 16, 148 22 C 182 28, 200 48, 190 68 C 180 86, 142 74, 112 84 C 82 94, 32 92, 24 72 Z',
    dot: [98, 87],
  },
  herrera: {
    curves: 14,
    terrain: 'Tramo urbano',
    path: 'M 30 78 L 46 34 L 92 38 L 112 20 L 176 24 L 194 54 L 154 76 L 96 72 L 64 88 Z',
    dot: [125, 74],
  },
  'jose-felix': {
    curves: 11,
    terrain: 'Desnivel medio',
    path: 'M 24 68 C 36 32, 82 22, 122 30 C 156 36, 196 26, 198 50 C 200 74, 154 84, 108 82 C 66 80, 16 90, 24 68 Z',
    dot: [108, 82],
  },
  artigas: {
    curves: 13,
    terrain: 'Zona ribereña',
    path: 'M 22 74 C 34 50, 58 58, 84 36 C 110 14, 156 18, 188 34 C 206 44, 194 72, 162 78 C 122 86, 48 92, 22 74 Z',
    dot: [124, 83],
  },
  oliva: {
    curves: 15,
    terrain: 'Casco histórico',
    path: 'M 32 76 L 42 28 L 106 24 L 122 44 L 184 32 L 192 68 L 132 82 L 78 78 Z',
    dot: [105, 80],
  },
};

export const formatRaceTime = (sec: number): string => {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  const secs = Math.floor(rem);
  const ms = Math.min(999, Math.round((rem - secs) * 1000));
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

export const calcEfficiencyKmL = (res: VehicleRaceResult, distanceMeters: number): string => {
  const baseKmL = 100 / Math.max(4.5, res.vehicle.consumptionBase || 7.0);
  if (res.fuelBurned > 0.015 && distanceMeters > 100) {
    const rawKmL = distanceMeters / 1000 / res.fuelBurned;
    const blended = Math.max(7.8, Math.min(18.9, baseKmL * 0.68 + Math.min(22, rawKmL) * 0.32));
    return blended.toFixed(1).replace('.', ',');
  }
  return baseKmL.toFixed(1).replace('.', ',');
};

export const countHarshBrakes = (res?: VehicleRaceResult): number => {
  if (!res) return 0;
  let episodes = 0;
  let inHardBrake = false;
  for (const s of res.telemetryHistory ?? []) {
    const hard = Boolean((s.isBraking && (s.brakeIntensity ?? 0) > 0.62) || s.accelerationG < -0.45);
    if (hard && !inHardBrake) {
      episodes++;
      inHardBrake = true;
    } else if (!hard) {
      inHardBrake = false;
    }
  }
  const ev = res.drivingEvents;
  const fallback =
    (ev?.absInterventions ?? 0) + (ev?.aebInterventions ?? 0) + (ev?.speedBumpsTooFast ?? 0);
  return Math.max(episodes, fallback);
};

export const getDrivingIQGrade = (score1000: number): string => {
  if (score1000 >= 900) return 'A+';
  if (score1000 >= 820) return 'A';
  if (score1000 >= 740) return 'B+';
  if (score1000 >= 640) return 'B';
  return 'C';
};

export const getDrivingIQSummary = (score1000: number, isDnf?: boolean): string => {
  if (isDnf) return 'Recorrido incompleto: cuidá la suspensión y mantené el control.';
  if (score1000 >= 880) return 'Conducción de alto nivel: rápida, precisa y eficiente.';
  if (score1000 >= 750) return 'Buen desempeño general: ritmo sólido con margen para pulir frenadas.';
  return 'Conducción intensa: anticipar baches y curvas elevará tu Driving IQ.';
};

export function CircuitWireframeSVG({
  circuitId,
  compact = false,
}: {
  circuitId: string;
  compact?: boolean;
}) {
  const meta = CIRCUIT_META[circuitId] ?? CIRCUIT_META.aviadores;
  return (
    <svg
      viewBox="0 0 220 105"
      className={
        compact
          ? 'w-8 h-5 shrink-0'
          : 'w-full h-full max-h-[88px] md:max-h-[108px] overflow-visible'
      }
      aria-hidden="true"
    >
      <defs>
        <filter id={`dc-glow-${circuitId}`} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={meta.path}
        fill="none"
        stroke="rgba(0,229,255,0.42)"
        strokeWidth={compact ? 8 : 9.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={meta.path}
        fill="none"
        stroke="#081426"
        strokeWidth={compact ? 5 : 6.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={meta.path}
        fill="none"
        stroke="#ffffff"
        strokeWidth={compact ? 2.4 : 3.3}
        strokeLinejoin="round"
        strokeLinecap="round"
        filter={compact ? undefined : `url(#dc-glow-${circuitId})`}
      />
      {!compact && (
        <>
          <circle cx={meta.dot[0]} cy={meta.dot[1]} r="7" fill="rgba(251,191,36,0.38)" />
          <circle
            cx={meta.dot[0]}
            cy={meta.dot[1]}
            r="3.9"
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="1.3"
          />
        </>
      )}
    </svg>
  );
}

export function CheckeredFlagIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 24" className={className} aria-hidden="true">
      <path d="M4 3v18" stroke="#cbd5e1" strokeWidth="2.2" strokeLinecap="round" />
      <g transform="skewX(-10)">
        <rect x="6" y="4" width="4" height="4" fill="#fff" />
        <rect x="10" y="4" width="4" height="4" fill="#0f172a" />
        <rect x="14" y="4" width="4" height="4" fill="#fff" />
        <rect x="18" y="4" width="4" height="4" fill="#0f172a" />
        <rect x="6" y="8" width="4" height="4" fill="#0f172a" />
        <rect x="10" y="8" width="4" height="4" fill="#fff" />
        <rect x="14" y="8" width="4" height="4" fill="#0f172a" />
        <rect x="18" y="8" width="4" height="4" fill="#fff" />
        <rect x="6" y="12" width="4" height="4" fill="#fff" />
        <rect x="10" y="12" width="4" height="4" fill="#0f172a" />
        <rect x="14" y="12" width="4" height="4" fill="#fff" />
        <rect x="18" y="12" width="4" height="4" fill="#0f172a" />
      </g>
    </svg>
  );
}

export function LaurelBranchIcon({
  mirrored = false,
  className = 'w-5 h-8',
}: {
  mirrored?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 40"
      className={`${className} ${mirrored ? 'scale-x-[-1]' : ''}`}
      aria-hidden="true"
    >
      <path
        d="M18 36 C9 28, 7 16, 15 4"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <ellipse cx="10" cy="29" rx="4.2" ry="2" transform="rotate(-35 10 29)" fill="#f59e0b" />
      <ellipse cx="8" cy="22" rx="4.4" ry="2" transform="rotate(-20 8 22)" fill="#fbbf24" />
      <ellipse cx="9" cy="14" rx="4.2" ry="1.9" transform="rotate(-5 9 14)" fill="#fde047" />
      <ellipse cx="13" cy="8" rx="3.8" ry="1.7" transform="rotate(15 13 8)" fill="#fef08a" />
    </svg>
  );
}

export interface ArcadeBriefingStageProps {
  car: Vehicle;
  circuit: AsuncionCircuit;
  weather: WeatherMode;
  onWeatherChange: (weather: WeatherMode) => void;
  laps?: number;
  onLapsChange?: (laps: number) => void;
  raceMode?: RaceModeId;
  onRaceModeChange?: (mode: RaceModeId) => void;
  speedModeUnlocked?: boolean;
  payload?: VehiclePayloadSelection;
  onPayloadChange?: (next: VehiclePayloadSelection) => void;
  isDatacarMember?: boolean;
  onOpenAccount?: () => void;
  onOpenOnlineLobby?: () => void;
  loadPercent: number;
  loadLabel?: string;
  loadError?: string | null;
  isActivelyLoading: boolean;
  loadingContext?: 'boot' | 'race';
  onStartRace?: () => void;
  onChangeCar?: () => void;
  onChangeCircuit?: () => void;
  onRetryLoad?: () => void;
  getCarImageUrl?: (id: string) => string;
}

export function ArcadeBriefingStage({
  car,
  circuit,
  weather,
  onWeatherChange,
  laps = 1,
  onLapsChange,
  raceMode = 'city_trial',
  onRaceModeChange,
  speedModeUnlocked = false,
  payload,
  onPayloadChange,
  isDatacarMember = false,
  onOpenAccount,
  onOpenOnlineLobby,
  loadPercent,
  loadLabel = 'Cargando pista y vehículos',
  loadError = null,
  isActivelyLoading,
  loadingContext = 'race',
  onStartRace,
  onChangeCar,
  onChangeCircuit,
  onRetryLoad,
  getCarImageUrl = (id: string) => car.imageUrl || getOfficialVehicleImageUrl(id),
}: ArcadeBriefingStageProps) {
  const safeLaps = Math.max(1, Math.min(3, Math.round(laps)));
  const totalDistanceKm = ((circuit.distanceMeters * safeLaps) / 1000).toFixed(1).replace('.', ',');
  const circuitMeta = CIRCUIT_META[circuit.id] ?? CIRCUIT_META.aviadores;
  const targetModeVariant = raceMode === 'speed_pro' ? 'speed_pro' : 'city_trial';
  const targetInfo = getCircuitTargetTime(circuit.id, targetModeVariant, safeLaps);
  const effectivePayload = payload ?? DEFAULT_PAYLOAD_SELECTION;
  const addedPayloadKg = computePayloadKg(effectivePayload, car);
  const segmentCount = 24;
  const clampedPercent = Math.max(0, Math.min(100, Math.round(loadPercent)));
  const activeSegments = Math.round((clampedPercent / 100) * segmentCount);
  const modelReady = clampedPercent >= 30;
  const trackReady = clampedPercent >= 65;
  const audioReady = clampedPercent >= 92 || (!isActivelyLoading && clampedPercent >= 70);

  return (
    <div
      className="dc-arcade-stage dc-wet-asphalt flex flex-col justify-between rounded-2xl border border-cyan-500/25 px-3 sm:px-6 py-3 md:py-5 relative overflow-hidden select-none shadow-[0_18px_50px_rgba(0,0,0,0.75)]"
      role={isActivelyLoading ? 'status' : undefined}
      aria-live={isActivelyLoading ? 'polite' : undefined}
    >
      {/* Subtle nocturnal stadium floodlights */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_8%,rgba(0,229,255,0.18),transparent_45%),radial-gradient(ellipse_at_88%_10%,rgba(245,158,11,0.16),transparent_45%)]"
        aria-hidden="true"
      />

      {/* Top Title: Angled Cyan Accents + Golden Crown + INICIAR CARRERA (Mockup 7) */}
      <div className="relative z-10 flex flex-col items-center justify-center pb-2 shrink-0">
        <Crown className="w-4 h-4 md:w-5 md:h-5 text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.85)] mb-0.5" />
        <div className="flex items-center justify-center gap-3">
          <div className="hidden sm:flex items-center">
            <div className="w-12 md:w-20 h-[2px] bg-gradient-to-r from-transparent to-cyan-400" />
            <div className="w-3 h-3 border-t-2 border-r-2 border-cyan-400 rotate-45 -ml-1.5" />
          </div>
          <h1 className="font-display text-xl sm:text-2xl md:text-4xl font-black italic tracking-wider text-white uppercase drop-shadow-[0_3px_12px_rgba(0,0,0,0.95)]">
            INICIAR CARRERA
          </h1>
          <div className="hidden sm:flex items-center">
            <div className="w-3 h-3 border-b-2 border-l-2 border-cyan-400 rotate-45 -mr-1.5" />
            <div className="w-12 md:w-20 h-[2px] bg-gradient-to-l from-transparent to-cyan-400" />
          </div>
        </div>
      </div>

      {/* Two Side-by-Side Panels: Vehículo Seleccionado & Circuito Seleccionado */}
      <div className="relative z-10 w-full max-w-[1080px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 my-1.5">
        {/* Panel 1: Vehículo Seleccionado */}
        <div className="md:col-span-6 dc-panel-cyan flex flex-col justify-between min-h-[168px] md:min-h-[215px]">
          <div className="flex items-center justify-between pr-3">
            <div className="dc-panel-tab-cyan text-[10px] md:text-xs">
              <span className="w-2.5 h-2.5 bg-cyan-400 -skew-x-12 inline-block shadow-[0_0_8px_#00e5ff]" />
              <span>VEHÍCULO SELECCIONADO</span>
            </div>
            {!isActivelyLoading && onChangeCar && (
              <button
                type="button"
                onClick={onChangeCar}
                className="text-[11px] md:text-xs font-bold text-cyan-300 hover:text-white underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                Cambiar vehículo
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 px-3.5 pb-3 pt-1.5 flex-1 min-h-0">
            {/* Left vehicle specs */}
            <div className="w-[46%] flex flex-col justify-between shrink-0">
              <div>
                <div className="text-[10px] md:text-xs font-black tracking-widest text-slate-300 uppercase">
                  {car.brand}
                </div>
                <div className="font-display text-lg md:text-2xl font-black italic tracking-wide text-white uppercase leading-none mt-0.5 truncate">
                  {car.name}
                </div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] md:text-xs text-slate-300 font-semibold">
                  <Car size={12} className="text-cyan-400 shrink-0" />
                  <span>{car.equipment.seatingCapacity === 7 ? 'SUV 7 Plazas' : 'SUV Compacto'}</span>
                </div>
              </div>

              <div className="mt-2 space-y-1 border-t border-cyan-500/20 pt-1.5 text-[11px] md:text-xs">
                <div className="flex items-center justify-between gap-2 border-b border-cyan-500/15 pb-0.5">
                  <span className="flex items-center gap-1.5 text-slate-300 font-semibold shrink-0">
                    <Zap size={12} className="text-cyan-400 shrink-0" /> POTENCIA
                  </span>
                  <strong className="font-black italic text-white tabular-nums text-right truncate">
                    {formatOfficialPower(car, 'CV')}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2 border-b border-cyan-500/15 pb-0.5">
                  <span className="flex items-center gap-1.5 text-slate-300 font-semibold shrink-0">
                    <Disc size={12} className="text-cyan-400 shrink-0" /> TORQUE
                  </span>
                  <strong className="font-black italic text-white tabular-nums text-right truncate">
                    {formatOfficialTorque(car)}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-slate-300 font-semibold shrink-0">
                    <Timer size={12} className="text-cyan-400 shrink-0" /> 0 – 100 km/h
                  </span>
                  <strong className="font-black italic text-white tabular-nums text-right truncate">
                    {formatOfficialOrSimAccel(car, true)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Right vehicle hero photo */}
            <div className="flex-1 h-full flex items-center justify-center relative min-w-0">
              <div className="absolute inset-0 bg-radial from-cyan-500/20 via-amber-500/10 to-transparent blur-md pointer-events-none" />
              <img
                src={getCarImageUrl(car.id)}
                alt={`${car.brand} ${car.name}`}
                referrerPolicy="no-referrer"
                className="w-full max-h-[118px] md:max-h-[160px] object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.92)] relative z-10"
                draggable={false}
              />
            </div>
          </div>
        </div>

        {/* Panel 2: Circuito Seleccionado + White Wireframe Map */}
        <div className="md:col-span-6 dc-panel-cyan flex flex-col justify-between min-h-[168px] md:min-h-[215px]">
          <div className="flex items-center justify-between pr-3 relative z-10">
            <div className="dc-panel-tab-cyan text-[10px] md:text-xs">
              <span className="w-2.5 h-2.5 bg-cyan-400 -skew-x-12 inline-block shadow-[0_0_8px_#00e5ff]" />
              <span>CIRCUITO SELECCIONADO</span>
            </div>
            {!isActivelyLoading && (
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {onLapsChange && (
                  <div
                    className="inline-flex items-center rounded-md border border-amber-400/45 bg-slate-950/90 p-0.5 text-[10px] md:text-[11px] font-black"
                    role="group"
                    aria-label="Cantidad de vueltas"
                  >
                    {[1, 2, 3].map(count => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => onLapsChange(count)}
                        aria-pressed={safeLaps === count}
                        className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                          safeLaps === count
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-amber-200/80 hover:text-white'
                        }`}
                      >
                        {count}V
                      </button>
                    ))}
                  </div>
                )}
                <select
                  aria-label="Clima de la carrera"
                  value={weather}
                  onChange={e => onWeatherChange(e.target.value as WeatherMode)}
                  className="bg-slate-950/90 border border-cyan-500/45 rounded-md px-2 py-0.5 text-[10px] md:text-xs font-bold text-cyan-200 cursor-pointer"
                >
                  {WEATHER_OPTIONS.map(o => {
                    const extremeLocked =
                      !isDatacarMember &&
                      raceMode === 'practice_free' &&
                      (o.id === 'storm' || o.id === 'flood');
                    return (
                      <option key={o.id} value={o.id} disabled={extremeLocked}>
                        {o.label}
                        {extremeLocked ? ' (Solo miembro DATACARPY)' : ''}
                      </option>
                    );
                  })}
                </select>
                {onChangeCircuit && (
                  <button
                    type="button"
                    onClick={onChangeCircuit}
                    className="text-[11px] md:text-xs font-bold text-cyan-300 hover:text-white underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Cambiar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Circuit title + white wireframe SVG + Arena nocturnal visual */}
          <div className="flex-1 flex items-center justify-between gap-2 px-3.5 py-1.5 relative min-h-0">
            {/* Nocturnal urban track photo & arch vignette on right half */}
            <div
              className="absolute right-2.5 top-1.5 bottom-1.5 w-[47%] rounded-xl bg-[#061121] border border-cyan-400/30 pointer-events-none flex flex-col items-end justify-between p-2.5 overflow-hidden"
              aria-hidden="true"
            >
              <img
                src={circuit.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-cover opacity-65"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#040c18]/90 via-[#040c18]/35 to-transparent" />
              <div className="relative z-10 px-2 py-0.5 rounded bg-slate-950/95 border border-cyan-400/50 text-[8px] md:text-[9px] font-black italic tracking-wider text-amber-400 shadow-[0_0_12px_rgba(0,229,255,0.3)]">
                DATACAR /// ARENA
              </div>
              {/* Stylized glowing track kerbs & asphalt */}
              <div className="relative z-10 w-full space-y-1">
                <div className="flex items-center gap-1 text-[9px] font-black text-amber-400/90 tracking-tighter">
                  <span>{'>>>'}</span>
                  <span>{'>>>'}</span>
                </div>
                <div className="w-full h-2.5 rounded-sm bg-gradient-to-r from-cyan-500/30 via-slate-700/45 to-rose-500/55 -skew-x-12 border-b border-amber-400/50" />
              </div>
            </div>

            <div className="w-[56%] flex flex-col justify-between relative z-10">
              <div>
                <div className="font-display text-base md:text-xl font-black italic uppercase text-white leading-tight truncate">
                  {circuit.name}
                </div>
                <div className="font-display text-xs md:text-sm font-black italic uppercase text-amber-400 tracking-wide">
                  {circuit.zone}
                </div>
              </div>
              <div className="mt-1 w-full max-w-[205px]">
                <CircuitWireframeSVG circuitId={circuit.id} />
              </div>
            </div>
          </div>

          {/* Bottom 3-stat strip inside Circuit Panel */}
          <div className="grid grid-cols-3 gap-1 px-3.5 py-1.5 bg-slate-950/80 border-t border-cyan-500/25 text-[10px] md:text-xs relative z-10">
            <div className="flex items-center gap-1.5 text-slate-200 font-bold tabular-nums">
              <CheckeredFlagIcon className="w-3.5 h-3.5 shrink-0" />
              <span>
                {totalDistanceKm} km · {safeLaps}V
              </span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-amber-300 font-black tabular-nums border-x border-cyan-500/20">
              <Clock size={12} className="text-amber-400 shrink-0" />
              <span>
                Meta {formatTargetMinutesSec(targetInfo.targetSec)}
              </span>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-slate-200 font-bold truncate">
              <Mountain size={13} className="text-cyan-400 shrink-0" />
              <span className="truncate">
                {addedPayloadKg > 0 ? `+${addedPayloadKg} kg` : circuitMeta.terrain}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Ocupantes & Equipaje antes de largar */}
      {!isActivelyLoading && onPayloadChange && (
        <div className="relative z-10 w-full max-w-[1080px] mx-auto my-1">
          <PayloadSelector
            vehicle={car}
            value={effectivePayload}
            onChange={onPayloadChange}
            compact
          />
        </div>
      )}

      {/* Bottom Stepper: (1) Vehículo seleccionado -> (2) Circuito seleccionado -> (3) Cargando... */}
      <div className="relative z-10 w-full max-w-[960px] mx-auto flex flex-wrap items-center justify-center gap-1.5 md:gap-3 my-1.5 shrink-0">
        <div className="dc-step-pill text-[10px] md:text-xs whitespace-nowrap shrink-0">
          <span className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-cyan-300/75 bg-slate-950 text-white font-black italic flex items-center justify-center text-[10px]">
            1
          </span>
          <Car size={14} className="text-cyan-300 hidden sm:inline shrink-0" />
          <span className="font-bold italic text-slate-100">Vehículo seleccionado</span>
        </div>

        <ChevronsRight size={16} className="text-cyan-400 shrink-0" />

        <div className="dc-step-pill text-[10px] md:text-xs whitespace-nowrap shrink-0">
          <span className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-cyan-300/75 bg-slate-950 text-white font-black italic flex items-center justify-center text-[10px]">
            2
          </span>
          <CircuitWireframeSVG circuitId={circuit.id} compact />
          <span className="font-bold italic text-slate-100">Circuito seleccionado</span>
        </div>

        <ChevronsRight size={16} className="text-amber-400 shrink-0" />

        <div className="dc-step-pill-gold text-[10px] md:text-xs whitespace-nowrap shrink-0">
          <span className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-amber-300 bg-amber-950 text-amber-200 font-black italic flex items-center justify-center text-[10px]">
            3
          </span>
          {isActivelyLoading || clampedPercent < 100 ? (
            <Loader2 size={14} className="text-amber-400 animate-spin shrink-0" />
          ) : (
            <FlagTriangleRight size={14} className="text-amber-400 shrink-0" />
          )}
          <span className="font-bold italic text-amber-100">
            {isActivelyLoading || clampedPercent < 100 ? 'Cargando...' : 'Cargando... · Listo'}
          </span>
        </div>
      </div>

      {/* Segmented Yellow/Orange Progress Bar + Green Check Badges (Mockup 7) */}
      <div className="relative z-10 w-full max-w-[900px] mx-auto flex flex-col items-center gap-2 mt-1 shrink-0">
        <div className="font-display text-sm md:text-lg font-black italic tracking-widest uppercase text-white drop-shadow text-center">
          {loadError
            ? 'ERROR AL CARGAR RECURSOS'
            : loadingContext === 'boot' && isActivelyLoading
              ? 'CARGANDO CATÁLOGO Y PISTA...'
              : clampedPercent < 100 || isActivelyLoading
                ? 'CARGANDO PISTA Y VEHÍCULOS...'
                : 'PISTA Y VEHÍCULOS LISTOS PARA LARGAR'}
        </div>

        {/* Segmented Yellow/Orange Glowing Progress Bar with Percentage */}
        <div
          className="dc-segmented-shell w-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clampedPercent}
          aria-label={loadLabel}
        >
          <div className="flex-1 flex items-center gap-1 md:gap-1.5 py-0.5">
            {Array.from({ length: segmentCount }).map((_, idx) => (
              <div
                key={idx}
                className={`dc-segment-cell ${idx < activeSegments ? 'filled' : 'empty'}`}
              />
            ))}
          </div>
          <div className="px-3 md:px-4 py-0.5 border-l border-cyan-500/35 font-display text-lg md:text-2xl font-black italic text-white tabular-nums min-w-[70px] md:min-w-[88px] text-right">
            {clampedPercent} %
          </div>
        </div>

        {/* 3 Green Checkmark Badges: [✓] Modelo listo, [✓] Circuito listo, [✓] Audio listo */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 pt-0.5">
          <div className={`dc-ready-badge text-[10px] md:text-xs ${modelReady ? '' : 'pending'}`}>
            <CheckCircle2
              size={14}
              className={modelReady ? 'text-emerald-400' : 'text-slate-400'}
            />
            <span>Modelo listo</span>
          </div>
          <div className={`dc-ready-badge text-[10px] md:text-xs ${trackReady ? '' : 'pending'}`}>
            <CheckCircle2
              size={14}
              className={trackReady ? 'text-emerald-400' : 'text-slate-400'}
            />
            <span>Circuito listo</span>
          </div>
          <div className={`dc-ready-badge text-[10px] md:text-xs ${audioReady ? '' : 'pending'}`}>
            <CheckCircle2
              size={14}
              className={audioReady ? 'text-emerald-400' : 'text-slate-400'}
            />
            <span>Audio listo</span>
          </div>
        </div>

        {/* Action Row or Active Loading Info Banner */}
        {loadError ? (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <span className="text-xs text-rose-300 font-semibold">{loadError}</span>
            {onRetryLoad && (
              <button
                type="button"
                className="dc-btn-gold px-5 py-1.5 text-xs"
                onClick={onRetryLoad}
              >
                REINTENTAR
              </button>
            )}
          </div>
        ) : isActivelyLoading ? (
          <div className="flex items-center justify-center gap-2 text-[10px] md:text-xs text-slate-200 bg-slate-950/75 border-y border-cyan-500/25 px-4 py-1.5 rounded-full text-center">
            <Info size={14} className="text-cyan-400 shrink-0" />
            <span>
              Al finalizar la carga, entrarás a la pista y comenzará la cuenta regresiva para la
              carrera.
            </span>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-2.5 pt-1">
            {onRaceModeChange && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onRaceModeChange('city_trial')}
                  aria-pressed={raceMode === 'city_trial'}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] md:text-xs font-black italic uppercase transition cursor-pointer ${
                    raceMode === 'city_trial'
                      ? 'border-cyan-400 bg-cyan-500/20 text-white shadow-[0_0_12px_rgba(0,229,255,0.3)]'
                      : 'border-slate-700 bg-slate-950/80 text-slate-300 hover:border-cyan-400/50'
                  }`}
                >
                  <ShieldCheck size={14} className="text-cyan-300" />
                  <span>Fase 1: Prueba en Ciudad</span>
                </button>
                <button
                  type="button"
                  disabled={!speedModeUnlocked}
                  onClick={() => speedModeUnlocked && onRaceModeChange('speed_pro')}
                  aria-pressed={raceMode === 'speed_pro'}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] md:text-xs font-black italic uppercase transition ${
                    !speedModeUnlocked
                      ? 'cursor-not-allowed border-slate-800 bg-slate-950/60 text-slate-500'
                      : raceMode === 'speed_pro'
                        ? 'cursor-pointer border-amber-400 bg-amber-500/20 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                        : 'cursor-pointer border-amber-500/40 bg-slate-950/80 text-amber-200 hover:border-amber-400'
                  }`}
                >
                  {speedModeUnlocked ? <Zap size={14} className="text-amber-400" /> : <Lock size={14} />}
                  <span>
                    {speedModeUnlocked
                      ? 'Fase 2: Sin Obstáculos · IA Élite'
                      : `Fase 2: Sin Obstáculos (IQ ≥ ${CITY_UNLOCK_MIN_IQ})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRaceModeChange('practice_free')}
                  aria-pressed={raceMode === 'practice_free'}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] md:text-xs font-black italic uppercase transition cursor-pointer ${
                    raceMode === 'practice_free'
                      ? 'border-sky-400 bg-sky-500/20 text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                      : 'border-slate-700 bg-slate-950/80 text-slate-300 hover:border-sky-400/50'
                  }`}
                >
                  <Compass size={14} className="text-sky-300" />
                  <span>Pista de Pruebas (Sin puntos)</span>
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
              {onChangeCar && (
                <button
                  type="button"
                  className="dc-btn-cyan flex items-center gap-2 px-5 md:px-7 py-2.5 text-xs md:text-sm whitespace-nowrap shrink-0"
                  onClick={onChangeCar}
                >
                  <Warehouse size={16} />
                  <span>VOLVER AL GARAJE</span>
                </button>
              )}
              {onStartRace && (
                <button
                  type="button"
                  className="dc-btn-gold flex items-center gap-2 px-8 md:px-12 py-2.5 text-sm md:text-lg shadow-lg whitespace-nowrap shrink-0"
                  onClick={onStartRace}
                >
                  <ChevronsRight size={20} strokeWidth={3} />
                  <span>
                    {raceMode === 'speed_pro'
                      ? '¡CORRER VELOCIDAD PURA!'
                      : raceMode === 'practice_free'
                        ? '¡PROBAR EN PISTA!'
                        : '¡EMPEZAR CARRERA!'}
                  </span>
                </button>
              )}
              {onOpenOnlineLobby && (
                <button
                  type="button"
                  onClick={onOpenOnlineLobby}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/65 bg-emerald-950/80 px-5 py-2.5 font-display text-xs md:text-sm font-black italic uppercase tracking-wider text-emerald-200 hover:border-emerald-300 hover:bg-emerald-900/80 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Globe size={16} className="text-emerald-400" />
                  <span>JUGAR EN LÍNEA</span>
                </button>
              )}
              {!isDatacarMember && onOpenAccount && (
                <button
                  type="button"
                  onClick={onOpenAccount}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/45 bg-slate-950/85 px-3.5 py-2 text-[11px] font-bold text-cyan-200 hover:border-cyan-300 cursor-pointer"
                >
                  <UserCheck size={14} className="text-cyan-400" />
                  <span>Registrar cuenta DATACARPY</span>
                </button>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 text-[10px] md:text-xs text-slate-300 bg-slate-950/70 border-y border-cyan-500/20 px-4 py-1 rounded-full text-center">
              <Info size={13} className="text-cyan-400 shrink-0" />
              <span>
                {raceMode === 'practice_free'
                  ? 'Modo Pruebas: ideal para ensayar frenado, peso con pasajeros y espejos sin afectar tu Ranking ni tu Driving IQ.'
                  : `Meta Oro: ${formatTargetMinutesSec(targetInfo.targetSec)} (Límite ${formatTargetMinutesSec(targetInfo.maxLimitSec)}). Al cargar la pista comienza la cuenta regresiva.`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface ArcadeResultsStageProps {
  circuitId?: string;
  circuitName: string;
  trackDistanceMeters: number;
  laps?: number;
  podium: VehicleRaceResult[];
  assessments: DrivingIQAssessment[];
  playerId: string;
  fallbackCar: Vehicle;
  onBackToGarage: () => void;
  onRepeatRace: () => void;
  onWatchReplay?: () => void;
  onShowAllData?: () => void;
  raceMode?: RaceModeId;
  speedModeUnlocked?: boolean;
  speedModeNewlyUnlocked?: boolean;
  onLaunchSpeedMode?: () => void;
  payloadKg?: number;
  isDatacarMember?: boolean;
  onOpenAccount?: () => void;
  onOpenRanking?: () => void;
  getCarImageUrl?: (id: string) => string;
}

export function ArcadeResultsStage({
  circuitId,
  circuitName,
  trackDistanceMeters,
  laps = 2,
  podium,
  assessments,
  playerId,
  fallbackCar,
  onBackToGarage,
  onRepeatRace,
  onWatchReplay,
  onShowAllData,
  raceMode = 'city_trial',
  speedModeUnlocked = false,
  speedModeNewlyUnlocked = false,
  onLaunchSpeedMode,
  payloadKg = 0,
  isDatacarMember = false,
  onOpenAccount,
  onOpenRanking,
  getCarImageUrl = (id: string) => fallbackCar.imageUrl || getOfficialVehicleImageUrl(id),
}: ArcadeResultsStageProps) {
  const playerResult = podium.find(p => p.vehicle.id === playerId) ?? podium[0];
  const winnerResult = podium[0] ?? playerResult;
  const heroCar = winnerResult?.vehicle ?? fallbackCar;
  const playerInsight = assessments.find(a => a.vehicleId === playerId) ?? assessments[0];
  const baseIq1000 = playerInsight ? Math.round(playerInsight.total * 10) : 948;
  const targetSpec = circuitId
    ? getCircuitTargetTime(
        circuitId,
        raceMode === 'speed_pro' ? 'speed_pro' : 'city_trial',
        laps,
        trackDistanceMeters,
      )
    : null;
  const targetEval = targetSpec
    ? evaluateCircuitTimeResult(
        playerResult?.isDnf ? -1 : (playerResult?.finishTimeSec ?? -1),
        targetSpec,
      )
    : null;
  const isPracticeFree = raceMode === 'practice_free';
  const iqScore1000 = isPracticeFree
    ? 0
    : Math.max(0, Math.min(1000, baseIq1000 + (targetEval?.iqBonus ?? 0)));
  const iqGrade = isPracticeFree ? 'PRB' : getDrivingIQGrade(iqScore1000);
  const harshBrakesCount = countHarshBrakes(playerResult);
  const peakBrakeG = (() => {
    let minG = 0;
    for (const s of playerResult?.telemetryHistory ?? []) {
      if (s.accelerationG < minG) minG = s.accelerationG;
    }
    return Math.abs(minG).toFixed(2);
  })();

  return (
    <div className="dc-arcade-stage dc-wet-asphalt flex flex-col justify-between rounded-2xl border border-cyan-500/25 px-3 sm:px-6 py-3 md:py-5 relative overflow-hidden select-none shadow-[0_18px_50px_rgba(0,0,0,0.8)]">
      {/* Floodlights */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_14%,rgba(0,229,255,0.16),transparent_48%),radial-gradient(ellipse_at_85%_18%,rgba(245,158,11,0.16),transparent_48%)]"
        aria-hidden="true"
      />

      {/* Top Title Row with Checkered Flags: RESULTADOS (Mockup 6) */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-2 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] md:text-xs text-cyan-300 font-bold truncate max-w-[220px]">
          <Trophy size={14} className="text-amber-400 shrink-0" />
          <span className="truncate">{circuitName}</span>
        </div>

        <div className="flex items-center justify-center gap-2.5 mx-auto">
          <div className="hidden md:block w-14 h-[2px] bg-gradient-to-r from-transparent to-cyan-400" />
          <CheckeredFlagIcon className="w-5 h-5 md:w-7 md:h-7 shrink-0" />
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-black italic tracking-wider text-white uppercase drop-shadow-[0_3px_12px_rgba(0,0,0,0.95)]">
            RESULTADOS
          </h1>
          <CheckeredFlagIcon className="w-5 h-5 md:w-7 md:h-7 shrink-0" />
          <div className="hidden md:block w-14 h-[2px] bg-gradient-to-l from-transparent to-cyan-400" />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenRanking && (
            <button
              type="button"
              onClick={onOpenRanking}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-400/50 text-[10px] md:text-xs font-black italic text-amber-200 hover:border-amber-300 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trophy size={12} />
              <span>RANKING</span>
            </button>
          )}
          {onWatchReplay && (
            <button
              type="button"
              disabled={podium.length === 0}
              onClick={onWatchReplay}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-cyan-500/40 text-[10px] md:text-xs font-black italic text-cyan-200 hover:border-cyan-300 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Clapperboard size={12} />
              <span>REPETICIÓN</span>
            </button>
          )}
          {onShowAllData && (
            <button
              type="button"
              onClick={onShowAllData}
              className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-cyan-500/40 text-[10px] md:text-xs font-black italic text-cyan-200 hover:border-cyan-300 cursor-pointer whitespace-nowrap shrink-0"
            >
              TODOS LOS DATOS
            </button>
          )}
        </div>
      </div>

      {isPracticeFree && (
        <div className="relative z-10 mx-auto mb-2 flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-400/55 bg-sky-950/80 px-4 py-2 text-xs text-sky-100">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-sky-300 shrink-0" />
            <span>
              <strong>PISTA DE PRUEBAS · SIN PUNTAJE NI IMPACTO EN RANKING:</strong> esta vuelta fue de práctica libre y no suma Driving IQ ni desbloquea Fase 2.
            </span>
          </div>
          {payloadKg > 0 && (
            <span className="rounded-md bg-slate-950/75 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300">
              Carga ensayada: +{payloadKg} kg
            </span>
          )}
        </div>
      )}

      {raceMode === 'city_trial' && (speedModeNewlyUnlocked || speedModeUnlocked) && onLaunchSpeedMode && (
        <div className="relative z-10 mx-auto mb-2 flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/70 bg-gradient-to-r from-amber-950/80 via-[#1b1405]/90 to-amber-950/80 px-4 py-2.5 shadow-[0_0_24px_rgba(245,158,11,0.28)]">
          <div className="flex items-center gap-2.5">
            <Zap className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-display text-xs sm:text-sm font-black italic uppercase tracking-wider text-amber-300">
                {speedModeNewlyUnlocked
                  ? '¡FASE 2 DESBLOQUEADA! · MODALIDAD VELOCIDAD SIN OBSTÁCULOS HABILITADA'
                  : 'FASE 2 DISPONIBLE · MODALIDAD VELOCIDAD SIN OBSTÁCULOS'}
              </div>
              <p className="text-[11px] text-slate-200">
                Superaste la Prueba en Ciudad con conducción limpia. Ya podés medirte a pura velocidad contra la IA experta sin obstáculos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLaunchSpeedMode}
            className="rounded-lg bg-amber-400 px-4 py-2 font-display text-xs font-black italic uppercase tracking-wider text-slate-950 hover:bg-amber-300 cursor-pointer shrink-0"
          >
            Correr Fase 2 (Sin Obstáculos) →
          </button>
        </div>
      )}

      {/* Main Content Split: Left (1º GANADOR + 3-Position Table) | Right (Golden DRIVING IQ + 2x2 Metric Cards) */}
      <div className="relative z-10 w-full max-w-[1120px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 my-1.5">
        {/* LEFT COLUMN (7 cols): Winner Car with Laurel + Standings Table */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-2.5 min-w-0">
          {/* Winner Hero Showcase + 1.º GANADOR Laurel */}
          <div className="flex items-center justify-between gap-3 md:gap-5 px-1">
            <div className="flex flex-col items-start shrink-0">
              {/* Golden Laurel 1.º GANADOR */}
              <div className="flex flex-col items-center px-2 py-0.5">
                <div className="flex items-center gap-0.5 text-amber-400 drop-shadow-[0_0_14px_rgba(251,191,36,0.7)]">
                  <LaurelBranchIcon className="w-5 h-8 md:w-7 md:h-11" />
                  <span className="font-display text-3xl md:text-5xl font-black italic tracking-tight text-amber-300 leading-none">
                    1.º
                  </span>
                  <LaurelBranchIcon mirrored className="w-5 h-8 md:w-7 md:h-11" />
                </div>
                <span className="font-display text-xs md:text-base font-black italic tracking-widest text-amber-400 uppercase -mt-0.5">
                  GANADOR
                </span>
              </div>

              {/* Winner Brand/Model Card */}
              <div className="dc-specs-glass px-3.5 py-2.5 rounded-xl min-w-[155px] md:min-w-[205px] mt-1">
                <div className="text-[10px] md:text-xs font-black tracking-widest text-slate-300 uppercase">
                  {heroCar.brand}
                </div>
                <div className="font-display text-base md:text-xl font-black italic text-white uppercase leading-tight">
                  {heroCar.name}
                </div>
                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-400/35 text-[10px] font-bold text-cyan-300">
                  <Car size={11} />
                  <span>SUV Compacto</span>
                </div>
              </div>
            </div>

            {/* Winner Hero Car Image */}
            <div className="flex-1 flex items-center justify-center relative min-w-0">
              <div className="absolute inset-0 bg-radial from-cyan-400/20 via-amber-500/12 to-transparent blur-lg pointer-events-none" />
              <img
                src={getCarImageUrl(heroCar.id)}
                alt={`${heroCar.brand} ${heroCar.name} — 1º Ganador`}
                referrerPolicy="no-referrer"
                className="w-full max-h-[120px] md:max-h-[175px] object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.94)] relative z-10"
                draggable={false}
              />
            </div>
          </div>

          {/* 3-Position Standings Table (1.º, 2.º, 3.º) */}
          <div className="flex flex-col gap-2">
            {podium.slice(0, 3).map((p, idx) => {
              const rank = idx + 1;
              const isPlayer = p.vehicle.id === playerId;
              const badgeStyle =
                rank === 1
                  ? 'bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 text-slate-950 border-amber-200'
                  : rank === 2
                    ? 'bg-gradient-to-b from-slate-200 via-slate-400 to-slate-600 text-slate-950 border-slate-100'
                    : 'bg-gradient-to-b from-amber-600 via-orange-700 to-amber-900 text-amber-100 border-amber-400/60';
              return (
                <div key={p.vehicle.id} className={`dc-podium-row ${rank === 1 ? 'rank-1' : ''}`}>
                  {/* Slanted Rank Badge */}
                  <div
                    className={`w-10 md:w-12 h-9 md:h-11 rounded-lg border font-display font-black italic text-base md:text-xl flex items-center justify-center -skew-x-12 shrink-0 ${badgeStyle}`}
                  >
                    <span className="skew-x-12">{rank}.º</span>
                  </div>

                  {/* Car Thumbnail */}
                  <img
                    src={getCarImageUrl(p.vehicle.id)}
                    alt={`${p.vehicle.brand} ${p.vehicle.name}`}
                    referrerPolicy="no-referrer"
                    className="w-14 md:w-20 h-9 md:h-12 object-contain shrink-0"
                    draggable={false}
                  />

                  {/* Brand & Model */}
                  <div className="min-w-[90px] md:min-w-[125px] flex-1 truncate">
                    <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold text-slate-300 uppercase">
                      <span className="truncate">{p.vehicle.brand}</span>
                      {isPlayer && (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/25 border border-cyan-400/60 text-[8px] text-cyan-200 font-black shrink-0">
                          TÚ
                        </span>
                      )}
                    </div>
                    <div className="font-display text-sm md:text-base font-black italic text-white uppercase truncate">
                      {p.vehicle.name}
                    </div>
                  </div>

                  {/* Total Time */}
                  <div className="px-2 md:px-3 border-l border-slate-700/70 text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 text-[8px] md:text-[9px] font-bold text-slate-400 uppercase">
                      <CheckeredFlagIcon className="w-3 h-3" />
                      <span>TIEMPO TOTAL</span>
                    </div>
                    <div
                      className={`font-display text-sm md:text-base font-black italic tabular-nums ${
                        rank === 1 ? 'text-amber-400' : 'text-white'
                      }`}
                    >
                      {p.isDnf ? 'DNF' : formatRaceTime(p.finishTimeSec)}
                    </div>
                  </div>

                  {/* Vmáx */}
                  <div className="px-2 md:px-2.5 border-l border-slate-700/70 text-right hidden sm:block shrink-0">
                    <div className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase">
                      VMÁX
                    </div>
                    <div className="text-xs md:text-sm font-black italic text-white tabular-nums">
                      {Math.round(p.topSpeedAchievedKmh)} km/h
                    </div>
                  </div>

                  {/* 0-100 */}
                  <div className="px-2 md:px-2.5 border-l border-slate-700/70 text-right hidden md:block shrink-0">
                    <div className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase">
                      0–100
                    </div>
                    <div className="text-xs md:text-sm font-black italic text-white tabular-nums">
                      {(p.time0to100 ?? p.vehicle.accel0100).toFixed(1).replace('.', ',')} s
                    </div>
                  </div>

                  {/* Efficiency */}
                  <div className="pl-2 md:pl-2.5 border-l border-slate-700/70 text-right shrink-0">
                    <div className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase">
                      EFI
                    </div>
                    <div className="text-xs md:text-sm font-black italic text-white tabular-nums">
                      {calcEfficiencyKmL(p, trackDistanceMeters)} km/l
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): Golden DRIVING IQ Card + 2x2 Individual Metric Cards */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-2.5 min-w-0">
          {/* Golden DRIVING IQ Card */}
          <div className="dc-iq-gold-card p-3.5 md:p-4.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 md:w-6 md:h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.85)] shrink-0" />
                  <span className="font-display text-base md:text-xl font-black italic tracking-wider text-white uppercase">
                    DRIVING IQ
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="font-display text-4xl md:text-6xl font-black italic text-amber-400 leading-none drop-shadow-[0_2px_14px_rgba(245,158,11,0.6)] tabular-nums">
                    {iqScore1000}
                  </span>
                  <span className="font-display text-base md:text-2xl font-bold italic text-slate-300 tabular-nums">
                    / 1000
                  </span>
                </div>
              </div>

              {/* Golden Circular/Shield Medal A+ with Laurel Wreath */}
              <div className="flex items-center shrink-0">
                <LaurelBranchIcon className="w-4 h-9 md:w-6 md:h-12 -mr-1.5" />
                <div className="dc-medal-shield relative z-10">
                  <span className="font-display text-xl md:text-3xl font-black italic text-amber-300 drop-shadow">
                    {iqGrade}
                  </span>
                </div>
                <LaurelBranchIcon mirrored className="w-4 h-9 md:w-6 md:h-12 -ml-1.5" />
              </div>
            </div>

            {/* Golden Progress Bar */}
            <div className="w-full h-2.5 md:h-3 mt-3 rounded-full bg-slate-900/90 border border-amber-500/45 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-200 shadow-[0_0_12px_rgba(251,191,36,0.9)]"
                style={{ width: `${Math.min(100, Math.max(8, iqScore1000 / 10))}%` }}
              />
            </div>

            <p className="text-[11px] md:text-xs italic text-slate-200 mt-2 text-center">
              {isPracticeFree
                ? 'Modo Pruebas sin puntaje oficial. Ideal para calibrar espejos, frenos y peso con pasajeros.'
                : getDrivingIQSummary(iqScore1000, playerResult?.isDnf)}
            </p>
            {targetEval && !isPracticeFree && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-bold tabular-nums">
                <span
                  className={`rounded-md border px-2 py-0.5 ${
                    targetEval.medal === 'gold'
                      ? 'border-amber-400/70 bg-amber-950/80 text-amber-200'
                      : targetEval.medal === 'silver'
                        ? 'border-cyan-400/60 bg-cyan-950/80 text-cyan-200'
                        : 'border-rose-400/60 bg-rose-950/80 text-rose-200'
                  }`}
                >
                  <Clock size={11} className="inline mr-1" />
                  {targetEval.label} · Meta {formatTargetMinutesSec(targetEval.target.targetSec)} (
                  {targetEval.iqBonus >= 0 ? `+${targetEval.iqBonus}` : targetEval.iqBonus} IQ)
                </span>
              </div>
            )}
            {playerInsight && (() => {
              const ev = playerInsight.events;
              const totalRuleInfractions =
                ev.redLightViolations +
                ev.speedLimitViolations +
                ev.unbuckledSeatbelt +
                ev.wrongWayInvasions;
              return (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-bold">
                  {totalRuleInfractions === 0 ? (
                    <span className="rounded-md border border-emerald-400/45 bg-emerald-950/75 px-2 py-0.5 text-emerald-300">
                      ✓ Normas viales y cinturón respetados
                    </span>
                  ) : (
                    <>
                      {ev.redLightViolations > 0 && (
                        <span className="rounded-md border border-rose-400/55 bg-rose-950/80 px-2 py-0.5 text-rose-200">
                          🚦 Luz roja ×{ev.redLightViolations}
                        </span>
                      )}
                      {ev.speedLimitViolations > 0 && (
                        <span className="rounded-md border border-amber-400/55 bg-amber-950/80 px-2 py-0.5 text-amber-200">
                          ⚠ Límite vel. ×{ev.speedLimitViolations}
                        </span>
                      )}
                      {ev.unbuckledSeatbelt > 0 && (
                        <span className="rounded-md border border-amber-400/55 bg-amber-950/80 px-2 py-0.5 text-amber-200">
                          🔒 Sin cinturón
                        </span>
                      )}
                      {ev.wrongWayInvasions > 0 && (
                        <span className="rounded-md border border-rose-400/55 bg-rose-950/80 px-2 py-0.5 text-rose-200">
                          ⇄ Contramano ×{ev.wrongWayInvasions}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 2x2 Individual Metric Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* 1. Velocidad Máxima */}
            <div className="dc-metric-tile">
              <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-slate-300 uppercase">
                <Gauge size={16} className="text-cyan-400 shrink-0" />
                <span className="leading-tight">VELOCIDAD MÁXIMA</span>
              </div>
              <div className="font-display text-lg md:text-2xl font-black italic text-white text-right mt-2 tabular-nums">
                {Math.round(playerResult?.topSpeedAchievedKmh ?? fallbackCar.topSpeedKmh)}{' '}
                <span className="text-xs md:text-sm font-bold text-slate-300">km/h</span>
              </div>
            </div>

            {/* 2. Aceleración Media */}
            <div className="dc-metric-tile">
              <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-slate-300 uppercase">
                <ChevronsRight size={16} className="text-cyan-400 shrink-0" />
                <span className="leading-tight">ACELERACIÓN MEDIA</span>
              </div>
              <div className="flex items-baseline justify-end gap-1.5 mt-2">
                <span className="text-[10px] text-slate-400 font-semibold">0–100 km/h</span>
                <span className="font-display text-lg md:text-2xl font-black italic text-white tabular-nums">
                  {(playerResult?.time0to100 ?? fallbackCar.accel0100)
                    .toFixed(1)
                    .replace('.', ',')}{' '}
                  <span className="text-xs md:text-sm font-bold text-slate-300">s</span>
                </span>
              </div>
            </div>

            {/* 3. Frenadas Bruscas */}
            <div className="dc-metric-tile brake-accent">
              <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-slate-300 uppercase">
                <Disc size={16} className="text-rose-400 shrink-0" />
                <span className="leading-tight">FRENADAS BRUSCAS</span>
              </div>
              <div className="font-display text-lg md:text-2xl font-black italic text-white text-right mt-2 tabular-nums">
                {harshBrakesCount}{' '}
                <span className="text-xs font-semibold text-slate-300">eventos</span>
              </div>
            </div>

            {/* 4. Eficiencia */}
            <div className="dc-metric-tile eco-accent">
              <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-slate-300 uppercase">
                <Leaf size={16} className="text-emerald-400 shrink-0" />
                <span className="leading-tight">EFICIENCIA</span>
              </div>
              <div className="font-display text-lg md:text-2xl font-black italic text-white text-right mt-2 tabular-nums">
                {playerResult
                  ? calcEfficiencyKmL(playerResult, trackDistanceMeters)
                  : (100 / (fallbackCar.consumptionBase || 7)).toFixed(1).replace('.', ',')}{' '}
                <span className="text-xs md:text-sm font-bold text-slate-300">km/l</span>
              </div>
            </div>
          </div>

          {isDatacarMember ? (
            <div className="rounded-xl border border-emerald-400/45 bg-emerald-950/45 px-3 py-2 text-[11px] text-emerald-100">
              <div className="flex items-center justify-between font-black uppercase tracking-wider text-emerald-300">
                <span>Telemetría Extendida DATACARPY</span>
                <span className="tabular-nums">Carga: +{payloadKg} kg</span>
              </div>
              <p className="mt-1 text-slate-200 tabular-nums">
                Pico frenada: {peakBrakeG} G · ABS/AEB: {(playerResult?.drivingEvents?.absInterventions ?? 0) + (playerResult?.drivingEvents?.aebInterventions ?? 0)} act. · Peso efectivo: {Math.round(playerResult?.effectiveWeightKg ?? fallbackCar.weightKg + payloadKg)} kg.
              </p>
            </div>
          ) : (
            onOpenAccount && (
              <button
                type="button"
                onClick={onOpenAccount}
                className="w-full rounded-xl border border-cyan-400/35 bg-slate-950/80 px-3 py-2 text-left text-[11px] text-cyan-200 hover:border-cyan-300 transition cursor-pointer"
              >
                <span className="font-black uppercase tracking-wider text-cyan-300">★ Beneficio DATACARPY:</span>{' '}
                Registrate gratis para desbloquear telemetría extendida de frenado e insignia en el Ranking →
              </button>
            )
          )}
        </div>
      </div>

      {/* Bottom Action Buttons: VOLVER AL GARAJE & >> REPETIR CARRERA */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 md:gap-6 pt-2.5 pb-0.5 shrink-0">
        <button
          type="button"
          className="dc-btn-cyan flex items-center justify-center gap-2.5 px-6 md:px-10 py-2.5 md:py-3 text-xs md:text-base font-black italic whitespace-nowrap shrink-0"
          onClick={onBackToGarage}
        >
          <Warehouse size={18} />
          <span>VOLVER AL GARAJE</span>
        </button>

        <button
          type="button"
          className="dc-btn-gold flex items-center justify-center gap-2.5 px-8 md:px-12 py-2.5 md:py-3 text-xs md:text-lg font-black italic shadow-lg whitespace-nowrap shrink-0"
          onClick={onRepeatRace}
        >
          <ChevronsRight size={20} strokeWidth={3} />
          <span>REPETIR CARRERA</span>
        </button>
      </div>
    </div>
  );
}

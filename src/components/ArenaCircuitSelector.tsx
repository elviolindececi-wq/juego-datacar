import React from 'react';
import { ArrowRight, Check, Clock, Compass, Globe, Info, Lock, MapPin, ShieldCheck, Trophy, Zap } from 'lucide-react';
import type { AsuncionCircuit, DifficultyFilter } from '../data/asuncionCircuits';
import { matchesDifficulty } from '../data/asuncionCircuits';
import { getOfficialVehicleImageUrl } from '../data/presetVehicles';
import type { Vehicle } from '../types/vehicle';
import type { RaceModeId } from '../utils/careerProgression';
import { CITY_UNLOCK_MIN_IQ } from '../utils/careerProgression';
import { formatTargetMinutesSec, getCircuitTargetTime } from '../utils/circuitTargetTimes';
import {
  CheckeredFlagIcon,
  CircuitWireframeSVG,
  LaurelBranchIcon,
} from './ArcadeBriefingAndResults';

export interface ArenaCircuitSelectorProps {
  circuits: AsuncionCircuit[];
  selectedCircuitId: string;
  onSelectCircuit: (circuitId: string) => void;
  difficulty: DifficultyFilter;
  onSelectDifficulty: (filter: DifficultyFilter) => void;
  laps?: number;
  onSelectLaps?: (laps: number) => void;
  raceMode?: RaceModeId;
  onSelectRaceMode?: (mode: RaceModeId) => void;
  speedModeUnlocked?: boolean;
  onOpenOnlineLobby?: () => void;
  onOpenRanking?: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  playerVehicleId?: string;
  playerVehicle?: Vehicle;
  getCarImageUrl?: (id: string) => string;
}

const DIFFICULTY_FILTERS: ReadonlyArray< readonly [DifficultyFilter, string] > = [
  ['todos', 'Todos'],
  ['facil', 'Fácil'],
  ['medio', 'Intermedio'],
  ['dificil', 'Difícil'],
  ['extremo', 'Extremo'],
];

interface CircuitVisualTheme {
  zoneClass: string;
  slashClass: string;
  scoreBadgeClass: string;
  streakWarm: boolean;
  withLaurel?: boolean;
}

function getCircuitTheme(circuitId: string): CircuitVisualTheme {
  switch (circuitId) {
    case 'avelino':
      return {
        zoneClass: 'text-[#FFAA12]',
        slashClass: 'bg-[#FFAA12] shadow-[0_0_8px_rgba(255,170,18,0.8)]',
        scoreBadgeClass: 'border-[#FFAA12]/85 text-[#FFAA12] bg-[#1A1104]/90 shadow-[0_0_14px_rgba(255,170,18,0.35)]',
        streakWarm: true,
        withLaurel: true,
      };
    case 'herrera':
      return {
        zoneClass: 'text-[#00E5F5]',
        slashClass: 'bg-[#00E5F5] shadow-[0_0_8px_rgba(0,229,245,0.8)]',
        scoreBadgeClass: 'border-[#00E5F5]/80 text-[#00E5F5] bg-[#041824]/90 shadow-[0_0_12px_rgba(0,229,245,0.3)]',
        streakWarm: false,
      };
    case 'jose-felix':
      return {
        zoneClass: 'text-[#FB923C]',
        slashClass: 'bg-[#FB923C] shadow-[0_0_8px_rgba(251,146,60,0.8)]',
        scoreBadgeClass: 'border-[#FB923C]/85 text-[#FDBA74] bg-[#1C0F05]/90 shadow-[0_0_12px_rgba(251,146,60,0.3)]',
        streakWarm: true,
      };
    case 'artigas':
      return {
        zoneClass: 'text-[#22D3EE]',
        slashClass: 'bg-[#22D3EE] shadow-[0_0_8px_rgba(34,211,238,0.8)]',
        scoreBadgeClass: 'border-[#22D3EE]/80 text-[#67E8F9] bg-[#041824]/90 shadow-[0_0_12px_rgba(34,211,238,0.3)]',
        streakWarm: false,
      };
    case 'oliva':
      return {
        zoneClass: 'text-[#C4B5FD]',
        slashClass: 'bg-[#A78BFA] shadow-[0_0_8px_rgba(167,139,250,0.8)]',
        scoreBadgeClass: 'border-[#A78BFA]/75 text-[#F3F7FC] bg-[#130E24]/90 shadow-[0_0_12px_rgba(167,139,250,0.28)]',
        streakWarm: false,
      };
    case 'aviadores':
    default:
      return {
        zoneClass: 'text-[#38BDF8]',
        slashClass: 'bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.85)]',
        scoreBadgeClass: 'border-[#38BDF8]/85 text-[#7DD3FC] bg-[#041828]/90 shadow-[0_0_12px_rgba(56,189,248,0.32)]',
        streakWarm: false,
      };
  }
}

export const ArenaCircuitSelector: React.FC<ArenaCircuitSelectorProps> = ({
  circuits,
  selectedCircuitId,
  onSelectCircuit,
  difficulty,
  onSelectDifficulty,
  laps = 1,
  onSelectLaps,
  raceMode = 'city_trial',
  onSelectRaceMode,
  speedModeUnlocked = false,
  onOpenOnlineLobby,
  onOpenRanking,
  onConfirm,
  confirmLabel = 'Elegir mi vehículo',
  playerVehicleId = 'nissan-kicks-2027',
  playerVehicle,
  getCarImageUrl,
}) => {
  const safeLaps = Math.max(1, Math.min(3, Math.round(laps)));
  const activeCircuit =
    circuits.find((item) => item.id === selectedCircuitId) || circuits[0];
  const filteredCircuits = circuits.filter((item) =>
    matchesDifficulty(item, difficulty),
  );
  const heroCarImage =
    getCarImageUrl?.(playerVehicleId) ??
    playerVehicle?.imageUrl ??
    getOfficialVehicleImageUrl(playerVehicleId);
  const targetModeVariant = raceMode === 'speed_pro' ? 'speed_pro' : 'city_trial';
  const activeTarget = getCircuitTargetTime(activeCircuit.id, targetModeVariant, safeLaps);

  return (
    <div className="relative z-10 w-full space-y-5 select-none">
      {/* 1. FRANJA HERO SUPERIOR: MODO CARRERA · ASUNCIÓN / ELEGÍ TU CIRCUITO. */}
      <section className="dc-circuit-hero relative overflow-hidden rounded-xl border border-[#00E5F5]/25 px-5 py-5 sm:px-8 sm:py-6">
        {/* Escena atmosférica derecha: postal nocturna de Asunción + piano de pista + silueta 3/4 trasera en PNG */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <img
            src={activeCircuit.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute right-0 top-0 h-full w-full sm:w-[68%] object-cover object-center opacity-55 transition-opacity duration-300"
          />
          <div className="dc-circuit-hero-scrim absolute inset-0" />
          {/* Piano rojo/blanco estilizado de competición */}
          <div className="dc-circuit-kerb-strip hidden md:block absolute bottom-0 right-[18%] w-[34%] h-2.5 -skew-x-24 opacity-80" />
          {/* Vehículo seleccionado en recorte PNG */}
          <img
            src={heroCarImage}
            alt=""
            referrerPolicy="no-referrer"
            className="hidden lg:block absolute -right-4 -bottom-4 h-[118%] w-auto max-w-[360px] object-contain opacity-90 drop-shadow-[0_12px_24px_rgba(0,0,0,0.95)]"
          />
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1" aria-hidden="true">
              <span className="h-3 w-1 -skew-x-20 bg-[#FFAA12]" />
              <span className="h-3 w-1 -skew-x-20 bg-[#FFAA12]" />
              <span className="h-3 w-1 -skew-x-20 bg-[#FFAA12]" />
              <span className="h-3 w-1 -skew-x-20 bg-[#FFAA12]/75" />
            </span>
            <span className="font-display text-xs sm:text-sm font-black italic uppercase tracking-[0.22em] text-[#FFAA12]">
              MODO CARRERA · ASUNCIÓN
            </span>
          </div>

          <h1 className="mt-1.5 font-display text-4xl sm:text-5xl md:text-[56px] font-black italic uppercase leading-[0.94] tracking-[0.02em] text-[#F3F7FC] drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
            ELEGÍ TU CIRCUITO.
          </h1>

          <p className="mt-2 max-w-2xl text-xs sm:text-sm italic leading-relaxed text-slate-200/90 drop-shadow">
            Cada tramo tiene una dificultad, adherencia y distribución de obstáculos distinta. Elegí qué desafío querés enfrentar.
          </p>
        </div>

        {/* Barra de filtros hexagonales + contador dorado */}
        <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filtrar circuitos por dificultad"
          >
            {DIFFICULTY_FILTERS.map(([id, label]) => {
              const active = difficulty === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectDifficulty(id)}
                  aria-pressed={active}
                  className={`dc-hex-filter-wrap cursor-pointer ${active ? 'active' : ''}`}
                >
                  <span className={`dc-hex-filter-inner text-xs sm:text-[13px] ${active ? 'active' : ''}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onSelectLaps && (
              <div
                className="inline-flex items-center gap-1 rounded-lg border border-[#FFAA12]/55 bg-[#081724]/95 px-2.5 py-1 text-xs"
                role="group"
                aria-label="Seleccionar cantidad de vueltas"
              >
                <span className="font-display text-[11px] font-black italic uppercase tracking-wider text-[#FFAA12] mr-1">
                  Vueltas:
                </span>
                {[1, 2, 3].map((count) => {
                  const active = safeLaps === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => onSelectLaps(count)}
                      aria-pressed={active}
                      className={`rounded px-2 py-0.5 font-display text-xs font-black italic transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#FFAA12] text-[#04131A]'
                          : 'text-slate-200 hover:text-white'
                      }`}
                    >
                      {count} {count === 1 ? 'Lap' : 'Laps'}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="dc-hex-count-wrap">
              <div className="dc-hex-count-inner text-xs sm:text-[13px]">
                <CheckeredFlagIcon className="w-4 h-4 shrink-0" />
                <span>
                  {filteredCircuits.length}{' '}
                  {filteredCircuits.length === 1
                    ? 'circuito disponible'
                    : 'circuitos disponibles'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Selector de Fase / Modalidad de Carrera + Pista de Pruebas + Ranking + En Línea */}
        {(onSelectRaceMode || onOpenOnlineLobby || onOpenRanking) && (
          <div className="relative z-10 mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] pt-3 border-t border-[#00E5F5]/20">
            {onSelectRaceMode && (
              <>
                <button
                  type="button"
                  onClick={() => onSelectRaceMode('city_trial')}
                  aria-pressed={raceMode === 'city_trial'}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition cursor-pointer ${
                    raceMode === 'city_trial'
                      ? 'border-[#00E5F5] bg-[#062030]/95 shadow-[0_0_18px_rgba(0,229,245,0.28)]'
                      : 'border-slate-700/80 bg-[#05111b]/85 hover:border-[#00E5F5]/55'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00E5F5]/15 border border-[#00E5F5]/45 text-[#00E5F5]">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-xs sm:text-sm font-black italic uppercase tracking-wider text-white">
                        FASE 1 · PRUEBA EN CIUDAD
                      </div>
                      <p className="text-[11px] text-slate-300 truncate">
                        Semáforos, franjas peatonales, raudales y normas viales
                      </p>
                    </div>
                  </div>
                  <span className="rounded bg-[#00E5F5]/20 px-2 py-0.5 text-[10px] font-black uppercase text-[#00E5F5] shrink-0">
                    {raceMode === 'city_trial' ? 'ACTIVA' : 'ELEGIR'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={!speedModeUnlocked}
                  onClick={() => speedModeUnlocked && onSelectRaceMode('speed_pro')}
                  aria-pressed={raceMode === 'speed_pro'}
                  title={
                    speedModeUnlocked
                      ? 'Contrarreloj pura de velocidad sin obstáculos contra el Tiempo Meta Oro'
                      : `Superá primero la Fase 1 (Prueba en Ciudad con Driving IQ ≥ ${CITY_UNLOCK_MIN_IQ}, sin atropellar peatones ni motociclistas) para desbloquear`
                  }
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                    !speedModeUnlocked
                      ? 'cursor-not-allowed border-slate-800 bg-[#050d16]/75 opacity-75'
                      : raceMode === 'speed_pro'
                        ? 'cursor-pointer border-[#FFAA12] bg-[#1f1404]/95 shadow-[0_0_18px_rgba(255,170,18,0.3)]'
                        : 'cursor-pointer border-amber-500/40 bg-[#0c131c]/90 hover:border-[#FFAA12]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        speedModeUnlocked
                          ? 'border-[#FFAA12]/60 bg-[#FFAA12]/15 text-[#FFAA12]'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      {speedModeUnlocked ? <Zap className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-xs sm:text-sm font-black italic uppercase tracking-wider text-white">
                        FASE 2 · CONTRARRELOJ SIN OBSTÁCULOS
                      </div>
                      <p className="text-[11px] text-slate-300 truncate">
                        {speedModeUnlocked
                          ? 'Contrarreloj pura a fondo contra el Tiempo Meta Oro sin obstáculos'
                          : `Bloqueada: superá Fase 1 en ciudad (IQ ≥ ${CITY_UNLOCK_MIN_IQ}) para habilitar`}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-black uppercase shrink-0 ${
                      !speedModeUnlocked
                        ? 'bg-slate-800 text-slate-400'
                        : raceMode === 'speed_pro'
                          ? 'bg-[#FFAA12] text-slate-950'
                          : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {!speedModeUnlocked ? 'BLOQUEADA' : raceMode === 'speed_pro' ? 'ACTIVA' : 'DESBLOQUEADA'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectRaceMode('practice_free')}
                  aria-pressed={raceMode === 'practice_free'}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition cursor-pointer ${
                    raceMode === 'practice_free'
                      ? 'border-sky-400 bg-sky-950/90 shadow-[0_0_18px_rgba(56,189,248,0.28)]'
                      : 'border-slate-700/80 bg-[#05111b]/85 hover:border-sky-400/55'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 border border-sky-400/45 text-sky-300">
                      <Compass className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-xs sm:text-sm font-black italic uppercase tracking-wider text-white">
                        PISTA DE PRUEBAS · SIN PUNTOS
                      </div>
                      <p className="text-[11px] text-slate-300 truncate">
                        Entrená libremente espejos, peso y clima sin sumar puntos ni ranking
                      </p>
                    </div>
                  </div>
                  <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-sky-200 shrink-0">
                    {raceMode === 'practice_free' ? 'ACTIVA' : 'LIBRE'}
                  </span>
                </button>
              </>
            )}

            {(onOpenOnlineLobby || onOpenRanking) && (
              <div className="flex items-stretch gap-2">
                {onOpenRanking && (
                  <button
                    type="button"
                    onClick={onOpenRanking}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FFAA12]/55 bg-amber-950/55 px-3.5 py-2.5 font-display text-xs sm:text-sm font-black italic uppercase tracking-wider text-amber-200 hover:border-amber-300 hover:bg-amber-900/60 transition cursor-pointer whitespace-nowrap"
                  >
                    <Trophy className="h-4 w-4 text-[#FFAA12] shrink-0" />
                    <span>RANKING</span>
                  </button>
                )}
                {onOpenOnlineLobby && (
                  <button
                    type="button"
                    onClick={onOpenOnlineLobby}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/60 bg-emerald-950/75 px-4 py-2.5 font-display text-xs sm:text-sm font-black italic uppercase tracking-wider text-emerald-200 hover:border-emerald-300 hover:bg-emerald-900/80 transition cursor-pointer whitespace-nowrap"
                  >
                    <Globe className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>JUGAR EN LÍNEA</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. GRILLA 3x2 DE LOS 6 CIRCUITOS TEMÁTICOS DE ASUNCIÓN */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCircuits.map((item) => {
          const chosen = item.id === selectedCircuitId;
          const theme = getCircuitTheme(item.id);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectCircuit(item.id)}
              aria-pressed={chosen}
              className={`dc-circuit-card group text-left cursor-pointer ${
                chosen ? 'selected' : ''
              }`}
            >
              {/* Mitad superior fotográfica con trazado neón del circuito */}
              <div className="relative h-36 sm:h-40 w-full overflow-hidden bg-[#061219]">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                />
                {/* Scrim oscuro inferior y viñeta para resaltar el trazado luminoso */}
                <div className="dc-circuit-photo-scrim absolute inset-0" />

                {/* Acento diagonal luminoso lateral como en el mockup */}
                <div
                  className={`pointer-events-none absolute -right-4 bottom-0 h-24 w-12 -skew-x-24 opacity-65 ${
                    theme.streakWarm ? 'dc-circuit-streak-warm' : 'dc-circuit-streak-cyan'
                  }`}
                  aria-hidden="true"
                />

                {/* Insignia superior izquierda cuando está seleccionado */}
                {chosen && (
                  <span className="dc-circuit-selected-pill absolute left-3 top-3 z-20 inline-flex items-center gap-1 px-3 py-1 text-[10px] sm:text-[11px] font-black italic uppercase tracking-wider text-[#031519]">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>SELECCIONADO</span>
                  </span>
                )}

                {/* Puntaje de dificultad en esquina superior derecha */}
                <div className="absolute right-3 top-2.5 z-20 flex items-center">
                  {theme.withLaurel && (
                    <LaurelBranchIcon className="w-3.5 h-6 -mr-1 drop-shadow" />
                  )}
                  <span
                    className={`dc-circuit-score-pill inline-flex items-center justify-center border px-2.5 py-0.5 font-display text-sm sm:text-base font-black italic tabular-nums ${theme.scoreBadgeClass}`}
                  >
                    {item.difficulty.toFixed(1)}/10
                  </span>
                  {theme.withLaurel && (
                    <LaurelBranchIcon mirrored className="w-3.5 h-6 -ml-1 drop-shadow" />
                  )}
                </div>

                {/* Mapa del trazado luminoso centrado */}
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-10 pt-3">
                  <div className="w-40 sm:w-44 drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]">
                    <CircuitWireframeSVG circuitId={item.id} />
                  </div>
                </div>
              </div>

              {/* Mitad inferior de datos del tramo */}
              <div className="relative z-10 flex flex-col justify-between px-4 pb-3.5 pt-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-3.5 w-1 -skew-x-20 shrink-0 ${theme.slashClass}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`font-display text-xs font-black italic uppercase tracking-[0.12em] ${theme.zoneClass}`}
                    >
                      {item.zone}
                    </span>
                  </div>

                  <h2 className="mt-1 font-display text-xl sm:text-[23px] font-black italic leading-tight tracking-wide text-[#F3F7FC] group-hover:text-white truncate">
                    {item.name}
                  </h2>

                  <p className="mt-0.5 text-xs italic text-slate-300/90 truncate">
                    {item.hazardLabel}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#00E5F5]/15 pt-2.5 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-slate-300 tabular-nums truncate">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>
                      {item.distanceMeters * safeLaps} m · Meta{' '}
                      <strong className="text-amber-300">
                        {formatTargetMinutesSec(getCircuitTargetTime(item.id, targetModeVariant, safeLaps).targetSec)}
                      </strong>
                    </span>
                  </span>

                  {chosen ? (
                    <span className="inline-flex items-center gap-1 font-bold text-[#34F5C5] whitespace-nowrap shrink-0">
                      <Check className="h-3.5 w-3.5 stroke-[2.8]" />
                      <span>Elegido</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-[#00E5F5] group-hover:translate-x-0.5 transition-transform whitespace-nowrap shrink-0">
                      <span>Elegir</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. BANNER INFERIOR DE CIRCUITO SELECCIONADO + TIEMPO X + CTA DORADO */}
      <section
        className="dc-circuit-selected-banner relative overflow-hidden px-5 py-4 sm:px-7 sm:py-5"
        aria-label="Resumen del circuito seleccionado"
      >
        {/* Textura sutil de la calle seleccionada en el fondo del banner */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <img
            src={activeCircuit.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-center opacity-22"
          />
          <div className="dc-circuit-banner-scrim absolute inset-0" />
        </div>

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-stretch gap-3.5 min-w-0">
            <span
              className="w-1.5 shrink-0 -skew-x-16 rounded-xs bg-gradient-to-b from-[#FFE082] via-[#FFAA12] to-[#D97706] shadow-[0_0_14px_rgba(255,170,18,0.85)]"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-xs sm:text-sm font-black italic uppercase tracking-[0.14em] text-[#00E5F5]">
                  CIRCUITO SELECCIONADO
                </p>
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-950/75 px-2 py-0.5 text-[11px] font-black text-amber-300 tabular-nums">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>
                    🎯 Objetivo Oro: ≤ {formatTargetMinutesSec(activeTarget.targetSec)} (Límite {formatTargetMinutesSec(activeTarget.maxLimitSec)})
                  </span>
                </span>
              </div>
              <h3 className="mt-0.5 font-display text-2xl sm:text-3xl font-black italic leading-none tracking-wide text-[#F3F7FC] truncate">
                {activeCircuit.name}
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-cyan-200 font-semibold">
                {raceMode === 'speed_pro'
                  ? `Objetivo: Llegá en ≤ ${formatTargetMinutesSec(activeTarget.targetSec)} sin dañar el vehículo en pista limpia.`
                  : raceMode === 'practice_free'
                    ? 'Objetivo: Práctica libre de manejo, frenada, espejos y carga sin penalización.'
                    : `Objetivo: Llegá antes de ${formatTargetMinutesSec(activeTarget.maxLimitSec)} (Oro ≤ ${formatTargetMinutesSec(activeTarget.targetSec)}), abrochá el cinturón, respetá semáforos y no choques motos (+15s) ni peatones.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onConfirm}
            className="dc-circuit-gold-cta-wrap shrink-0 cursor-pointer"
          >
            <span className="dc-circuit-gold-cta-inner text-base sm:text-xl whitespace-nowrap">
              <span>{confirmLabel}</span>
              <ArrowRight className="h-5 w-5 stroke-[2.8]" />
            </span>
          </button>
        </div>
      </section>

      {/* 4. NOTA LEGAL INFERIOR + DATACARPY.COM */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px] italic text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 not-italic" />
          <span>
            Ficción inspirada en nombres de calles reales; los peligros no son un diagnóstico de tránsito. La versión 3D utiliza tramos temáticos estilizados, no mapas viales exactos.
          </span>
        </span>
        <a
          href="https://datacarpy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 not-italic font-bold text-[#00E5F5] hover:text-white transition-colors"
        >
          <span className="tracking-tighter text-slate-500" aria-hidden="true">
            ///
          </span>
          <span className="underline underline-offset-4">datacarpy.com</span>
        </a>
      </div>
    </div>
  );
};

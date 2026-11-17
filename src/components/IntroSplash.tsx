import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Cog,
  ExternalLink,
  Gauge,
  Maximize2,
  Settings,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type { Vehicle } from '../types/vehicle';
import { ArenaHeroCutoutView } from './ArenaHeroCutoutView';
import { LoadingFallbackBadge } from './LoadingFallbackBadge';
import { GraphicsQualitySelector } from './GraphicsQualitySelector';

import { Award } from 'lucide-react';
import { ASUNCION_CIRCUITS } from '../data/asuncionCircuits';
import { getWenoCampaignOverview, useCareerProgression } from '../utils/careerProgression';

import { retryDynamicImport } from '../utils/chunkRecovery';

const LazyPhotographic360Viewer = lazy(() =>
  retryDynamicImport(() =>
    import('./Photographic360Viewer').then((m) => ({ default: m.Photographic360Viewer })),
  ),
);
const LazyWenoBankIntroModal = lazy(() =>
  retryDynamicImport(() =>
    import('./WenoBankIntroModal').then((m) => ({ default: m.WenoBankIntroModal })),
  ),
);
const LazyWenoCampaignFinaleModal = lazy(() =>
  retryDynamicImport(() =>
    import('./WenoCampaignFinaleModal').then((m) => ({ default: m.WenoCampaignFinaleModal })),
  ),
);
import {
  ArenaBrandEmblem,
  ArenaCenterLogo,
  ArenaCircuitsIcon,
  ArenaCompareIcon,
  ArenaCrownTitle,
  ArenaGarageIcon,
  ArenaPilotHelmetAvatar,
  ArenaRunChevronsIcon,
  formatArenaVehicleCardData,
} from './ArenaVisualKit';
import { soundEngine } from '../utils/soundEngine';
import { bgmAudioManager } from '../utils/bgmAudioManager';
import {
  dismissOrientationHint,
  requestLandscapeOrientation,
  useForcedLandscapeOrientation,
} from '../utils/iosOrientationManager';
import {
  DATACAR_CAMPAIGN_COPY,
  DATACAR_INSTITUTIONAL_FLEET,
  DATACAR_INSTITUTIONAL_PREMISE,
  DATACAR_SELECTOR_COPY,
  SATIRICAL_FICTION_DISCLAIMER,
  markWenoBankIntroSeen,
  shouldAutoOpenWenoBankIntro,
} from '../utils/wenoBankMissions';
import { evaluateNarrativeDirectorStatus } from '../utils/NarrativeDirector';
import { isNarrativeStateAtLeast, useStoryProgress } from '../utils/storyProgress';

interface IntroSplashProps {
  vehicles: Vehicle[];
  onStart: () => void;
  onCompare: (vehicleId?: string) => void;
  onRace: (vehicleId: string) => void;
  onGarage?: (vehicleId: string) => void;
  onCircuits?: (vehicleId: string) => void;
  onOpenArcade?: () => void;
  onStartStoryPrologue?: () => void;
  onStartBonusRecovery?: () => void;
}

/**
 * Pantalla inicial AAA de DATACAR ARENA — "LOS MÁS BUSCADOS".
 * Nota editorial: "Los más buscados" es un nombre creativo; los modelos no están ordenados por estadísticas de búsqueda.
 */
export function IntroSplash({
  vehicles,
  onStart,
  onCompare,
  onRace,
  onGarage,
  onCircuits,
  onOpenArcade,
  onStartStoryPrologue,
  onStartBonusRecovery,
}: IntroSplashProps) {
  // Iniciar en Nissan Kicks o el primer vehículo disponible
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const orientationState = useForcedLandscapeOrientation();
  const [show360Modal, setShow360Modal] = useState(false);
  const [muted, setMuted] = useState(() => soundEngine.getIsMuted());
  const [unreadNotice, setUnreadNotice] = useState(true);
  const [showWenoIntro, setShowWenoIntro] = useState(
    () => !onStartStoryPrologue && shouldAutoOpenWenoBankIntro(),
  );
  const [showFinaleModal, setShowFinaleModal] = useState(false);
  const [vehicleConfirmed, setVehicleConfirmed] = useState(false);
  const progression = useCareerProgression();
  const storyState = useStoryProgress();
  const directorStatus = evaluateNarrativeDirectorStatus(storyState);
  const campaignOverview = getWenoCampaignOverview(ASUNCION_CIRCUITS, progression);

  const chosen = vehicles[selectedIndex] || vehicles[0];
  const selectRelative = (offset: number) => {
    setSelectedIndex((i) => (i + offset + vehicles.length) % vehicles.length);
    setVehicleConfirmed(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showWenoIntro) return;
      if (showNotifications || showSettings || show360Modal) {
        if (event.code === 'Escape') {
          setShowNotifications(false);
          setShowSettings(false);
          setShow360Modal(false);
        }
        return;
      }
      const element = event.target as HTMLElement | null;
      if (
        event.code === 'Enter' &&
        !element?.closest?.('button, a, input, select, textarea, [role=button]')
      ) {
        onRace(chosen.id);
      }
      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        selectRelative(-1);
      }
      if (event.code === 'ArrowRight') {
        event.preventDefault();
        selectRelative(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [vehicles.length, chosen?.id, onRace, showNotifications, showSettings, show360Modal, showWenoIntro]);

  if (!chosen) return null;

  const specData = formatArenaVehicleCardData(chosen);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignorar restricciones de iframe si aplica
    }
  };

  const toggleSound = () => {
    const nextMuted = !muted;
    soundEngine.setMuted(nextMuted);
    bgmAudioManager.setMuted(nextMuted);
    if (!nextMuted) {
      soundEngine.unlock();
      bgmAudioManager.unlock();
    }
    setMuted(nextMuted);
  };

  return (
    <main
      className={`dc-arena-shell relative isolate flex min-h-[100dvh] lg:h-[100dvh] w-full flex-col justify-between overflow-x-hidden lg:overflow-hidden select-none ${orientationState.softwareRotated ? 'dc-ios-forced-landscape' : ''}`}
      aria-label="DATACAR ARENA: Los más buscados"
    >
      {/* 1. ESCENARIO CINEMATOGRÁFICO DE ESTADIO NOCTURNO */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <img
          src="/assets/aistudio/arena_home_bg_4f3f8584.webp"
          alt=""
          className="h-full w-full object-cover object-[center_62%] scale-[1.02]"
          loading="eager"
        />
        {/* Oscurecimiento superior, inferior y máscara atmosférica central para limpiar el cartel de fondo del estadio */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 36% 22% at 50% 35%, rgba(6, 18, 25, 0.98) 0%, rgba(6, 18, 25, 0.92) 55%, rgba(6, 18, 25, 0) 100%),
              linear-gradient(180deg, rgba(4, 12, 18, 0.92) 0%, rgba(6, 18, 25, 0.52) 22%, rgba(6, 18, 25, 0.16) 56%, rgba(4, 11, 17, 0.76) 88%, rgba(3, 9, 14, 0.95) 100%),
              linear-gradient(90deg, rgba(4, 13, 20, 0.68) 0%, rgba(4, 13, 20, 0.08) 38%, rgba(4, 13, 20, 0.05) 72%, rgba(4, 13, 20, 0.42) 100%)
            `,
          }}
        />
      </div>

      {/* 2. HEADER SUPERIOR PREMIUM */}
      <header className="dc-arena-header relative z-30 flex w-full items-center justify-between px-3 sm:px-6 lg:px-10 py-2 sm:py-2.5 shrink-0">
        {/* Izquierda: Perfil del piloto, nivel y barra XP */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <ArenaPilotHelmetAvatar className="w-10 h-10 sm:w-12 sm:h-12" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 leading-none">
              <span className="font-display text-base sm:text-xl font-extrabold tracking-wide text-[#F3F7FC] truncate">
                PilotoDC
              </span>
              <span
                className="inline-block px-2 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#04131A] bg-[#00E5F5] shadow-[0_0_10px_rgba(0,229,245,0.55)]"
                style={{ clipPath: 'polygon(5px 0%, 100% 0%, calc(100% - 5px) 100%, 0% 100%)' }}
              >
                NIVEL 12
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2.5">
              <div className="h-2 w-20 sm:w-32 md:w-36 rounded-sm bg-[#091A24] border border-[#00E5F5]/30 overflow-hidden p-[1px]">
                <div className="h-full w-[78.5%] bg-gradient-to-r from-[#00B4D8] to-[#00E5F5] shadow-[0_0_8px_rgba(0,229,245,0.85)]" />
              </div>
              <span className="hidden sm:inline font-mono text-[10px] font-semibold tracking-tight text-slate-300">
                7.850 / 10.000 XP
              </span>
            </div>
          </div>
        </div>

        {/* Centro: Logo oficial independiente DATACAR ARENA */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 z-10 hidden sm:block">
          <ArenaCenterLogo />
        </div>
        <div className="sm:hidden">
          <ArenaCenterLogo compact />
        </div>

        {/* Derecha: Misión Weno Bank, Notificaciones y Ajustes en paralelogramos biselados */}
        <div className="flex items-center gap-2 sm:gap-3">
          {campaignOverview.eliteBadgeUnlocked && (
            <button
              type="button"
              data-testid="intro-elite-pilot-btn"
              onClick={() => setShowFinaleModal(true)}
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-400 text-[11px] font-black uppercase tracking-wider text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Award size={13} />
              <span>{DATACAR_CAMPAIGN_COPY.eliteBadgeTitle}</span>
            </button>
          )}
          <button
            type="button"
            data-testid="reopen-weno-intro-btn"
            onClick={() => {
              if (onStartStoryPrologue) {
                onStartStoryPrologue();
              } else {
                setShowWenoIntro(true);
              }
            }}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1A1306]/90 border border-[#FFAA12]/60 text-[11px] font-bold uppercase tracking-wider text-[#FFAA12] hover:border-[#FFAA12] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShieldCheck size={13} />
            <span>
              Proyecto Fantasma · {campaignOverview.completedCount}/{campaignOverview.totalCount}
            </span>
          </button>
          {onOpenArcade && (
            <button
              type="button"
              onClick={onOpenArcade}
              className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#102C38]/85 border border-[#00E5F5]/40 text-[11px] font-bold uppercase tracking-wider text-[#00E5F5] hover:border-[#00E5F5] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Smartphone size={13} />
              <span>Vista Arcade</span>
            </button>
          )}
          <button
            type="button"
            className="dc-arena-util-btn"
            aria-label="Notificaciones"
            onClick={() => {
              setUnreadNotice(false);
              setShowSettings(false);
              setShowNotifications((v) => !v);
            }}
          >
            <div className="relative flex items-center justify-center">
              <Bell size={18} />
              {unreadNotice && (
                <span className="absolute -top-1 -right-1.5 h-2.5 w-2.5 rounded-full bg-[#FFAA12] ring-2 ring-[#061219] shadow-[0_0_8px_#FFAA12]" />
              )}
            </div>
          </button>

          <button
            type="button"
            data-testid="intro-rotate-landscape-btn"
            className="dc-arena-util-btn"
            aria-label="Rotar pantalla horizontal"
            title={orientationState.softwareRotated ? 'Salir de giro horizontal 90°' : 'Rotar a pantalla horizontal'}
            onClick={() => {
              void requestLandscapeOrientation();
            }}
          >
            <Smartphone size={17} className={orientationState.softwareRotated ? 'text-[#FFAA12]' : ''} />
          </button>

          <button
            type="button"
            className="dc-arena-util-btn"
            aria-label="Configuración"
            onClick={() => {
              setShowNotifications(false);
              setShowSettings((v) => !v);
            }}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {orientationState.showIosUnlockHint && (
        <div
          role="status"
          data-testid="ios-orientation-hint"
          className="relative z-[145] mx-auto mt-1 flex max-w-xl items-center justify-between gap-2 rounded-xl border border-cyan-400/50 bg-[#051523]/95 px-3.5 py-1.5 text-[11px] text-cyan-100 shadow-lg"
        >
          <span>{orientationState.hintMessage}</span>
          <button
            type="button"
            onClick={dismissOrientationHint}
            aria-label="Cerrar aviso de rotación"
            className="rounded-md border border-cyan-400/40 px-2 py-0.5 text-[10px] font-black text-cyan-300 hover:bg-cyan-950 cursor-pointer shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* 3. TÍTULO PRINCIPAL CON CORONA DORADA — LA FLOTA DATACAR */}
      <div className="relative z-20 pt-1.5 sm:pt-2.5 pb-1 px-4 shrink-0">
        <ArenaCrownTitle subtitle={DATACAR_SELECTOR_COPY.subtitle} />
      </div>

      {/* 4. ESCENARIO CENTRAL: PANEL TÉCNICO IZQUIERDO + VEHÍCULO PROTAGONISTA 3D/RGBA */}
      <section
        className="relative z-20 mx-auto flex w-full max-w-[1440px] flex-1 min-h-0 flex-col lg:flex-row items-center justify-between gap-4 lg:gap-6 px-4 sm:px-8 lg:px-12 py-1"
        aria-labelledby="intro-heading"
      >
        {/* PANEL IZQUIERDO DEL VEHÍCULO (Diseño geométrico petrol-blue con borde cian y acento ámbar) */}
        <aside
          className="dc-arena-spec-wrap w-full max-w-[420px] lg:w-[345px] xl:w-[375px] shrink-0 order-2 lg:order-1"
          aria-label={`Ficha rápida de ${chosen.brand} ${chosen.name}`}
        >
          <div className="dc-arena-spec-card-border">
            <div className="dc-arena-spec-card px-5 py-4 sm:px-6 sm:py-5">
              {/* Marca + Emblema vectorial + Modelo + Versión */}
              <div className="flex items-center gap-3.5">
                <div className="shrink-0 flex items-center justify-center">
                  <ArenaBrandEmblem brand={specData.brand} className="w-14 h-12" />
                </div>
                <div className="h-11 w-[1.5px] bg-slate-500/45 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className="font-display text-3xl sm:text-[38px] font-black italic uppercase leading-[0.9] tracking-wide text-[#F3F7FC] drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] truncate">
                    {specData.modelName}
                  </h2>
                  <p className="mt-1 font-display text-sm sm:text-base font-extrabold italic uppercase tracking-[0.08em] text-[#00E5F5] truncate">
                    {specData.trimBadge}
                  </p>
                </div>
              </div>

              {/* Etiqueta de categoría SUV */}
              <div className="mt-3">
                <span
                  className="inline-block px-3.5 py-0.5 font-display text-xs sm:text-sm font-black italic uppercase tracking-[0.10em] text-[#04131A] bg-[#00E5F5] shadow-[0_0_12px_rgba(0,229,245,0.45)]"
                  style={{ clipPath: 'polygon(5px 0%, 100% 0%, calc(100% - 5px) 100%, 0% 100%)' }}
                >
                  {specData.categoryBadge}
                </span>
              </div>

              {/* Descripción concisa real */}
              <p className="mt-2.5 text-xs sm:text-[13px] leading-[1.42] text-[#F3F7FC]/90 line-clamp-2">
                {specData.summary}
              </p>

              {/* Confirmación institucional al seleccionar vehículo */}
              <p
                data-testid="vehicle-confirmed-status"
                className={`mt-2 text-[11px] sm:text-xs font-bold tracking-wide transition-colors ${
                  vehicleConfirmed ? 'text-[#FFAA12]' : 'text-[#00E5F5]/95'
                }`}
              >
                {DATACAR_SELECTOR_COPY.onSelectVehicle}
              </p>

              {/* Métricas reales con divisores finos */}
              <div className="mt-4 pt-2 border-t border-[#00E5F5]/25 divide-y divide-[#00E5F5]/20">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2.5 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#F3F7FC]">
                    <Zap className="w-4 h-4 text-[#00E5F5] fill-[#00E5F5]/30 shrink-0" />
                    <span>POTENCIA</span>
                  </div>
                  <span className="font-display text-xl sm:text-2xl font-black italic tracking-wide text-[#00E5F5] drop-shadow-[0_0_8px_rgba(0,229,245,0.35)]">
                    {specData.powerDisplay}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2.5 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#F3F7FC]">
                    <Cog className="w-4 h-4 text-[#00E5F5] shrink-0" />
                    <span>TORQUE</span>
                  </div>
                  <span className="font-display text-xl sm:text-2xl font-black italic tracking-wide text-[#00E5F5] drop-shadow-[0_0_8px_rgba(0,229,245,0.35)]">
                    {specData.torqueDisplay}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 pb-0.5">
                  <div className="flex items-center gap-2.5 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[#F3F7FC]">
                    <Gauge className="w-4 h-4 text-[#00E5F5] shrink-0" />
                    <span>0 – 100 km/h</span>
                  </div>
                  <span className="font-display text-xl sm:text-2xl font-black italic tracking-wide text-[#00E5F5] drop-shadow-[0_0_8px_rgba(0,229,245,0.35)]">
                    {specData.accelDisplay}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* VEHÍCULO PROTAGONISTA EN EL ESTADIO + CARRUSEL DE 7 VEHÍCULOS */}
        <div className="relative flex-1 w-full h-[34dvh] sm:h-[42dvh] lg:h-full min-h-[230px] max-h-[540px] flex flex-col items-center justify-center order-1 lg:order-2 min-w-0">
          <div className="relative w-full flex-1 min-h-0 flex items-center justify-center">
            {/* Flecha izquierda hexagonal */}
            <button
              type="button"
              onClick={() => selectRelative(-1)}
              aria-label="Vehículo anterior"
              className="dc-arena-arrow-wrap absolute left-0 sm:left-2 z-30 w-12 h-11 sm:w-14 sm:h-12"
            >
              <span className="dc-arena-arrow-inner">
                <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.8]" />
              </span>
            </button>

            {/* Escenario protagonista con imagen oficial WebP (sin cargar Three.js ni modelos 3D en el inicio) */}
            <div className="w-full h-full px-10 sm:px-14">
              <ArenaHeroCutoutView
                vehicle={chosen}
                imageBadgeLabel={null}
                onOpen360Modal={() => setShow360Modal(true)}
              />
            </div>

            {/* Flecha derecha hexagonal */}
            <button
              type="button"
              onClick={() => selectRelative(1)}
              aria-label="Siguiente vehículo"
              className="dc-arena-arrow-wrap absolute right-0 sm:right-2 z-30 w-12 h-11 sm:w-14 sm:h-12"
            >
              <span className="dc-arena-arrow-inner">
                <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.8]" />
              </span>
            </button>
          </div>

          {/* Indicadores inferiores de paginación (7 puntos sobre el asfalto) */}
          <div
            className="relative z-30 flex items-center justify-center gap-2.5 pt-1 pb-1"
            aria-label="Elegir vehículo destacado"
          >
            {vehicles.map((v, i) => {
              const active = i === selectedIndex;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-label={`Mostrar ${v.brand} ${v.name}`}
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedIndex(i);
                    setVehicleConfirmed(true);
                  }}
                  className={`rounded-full transition-all duration-200 cursor-pointer ${
                    active
                      ? 'h-3 w-3 bg-[#E0FBFF] ring-2 ring-[#00E5F5] shadow-[0_0_12px_#00E5F5,0_0_22px_rgba(0,229,245,0.85)] scale-110'
                      : 'h-2.5 w-2.5 bg-slate-400/45 hover:bg-slate-200/80'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. BARRA INFERIOR DE 4 BOTONES BISELADOS + NOTA DISCRETA */}
      <footer className="relative z-30 mx-auto w-full max-w-[1440px] px-3 sm:px-8 lg:px-12 pt-1 pb-2.5 sm:pb-3.5 shrink-0">
        <nav
          className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.32fr] gap-2 sm:gap-4 items-stretch"
          aria-label="Acciones principales"
        >
          {/* 1. GARAJE */}
          <button
            type="button"
            onClick={() => (onGarage ? onGarage(chosen.id) : onStart())}
            className="dc-arena-dock-btn-wrap min-w-0"
          >
            <span className="dc-arena-dock-btn !px-2.5 sm:!px-4 text-xs sm:text-xl md:text-[22px] whitespace-nowrap">
              <ArenaGarageIcon className="w-5 h-5 sm:w-7 sm:h-7 shrink-0" />
              <span className="truncate">GARAJE</span>
            </span>
          </button>

          {/* 2. COMPARAR */}
          <button
            type="button"
            onClick={() => onCompare(chosen.id)}
            className="dc-arena-dock-btn-wrap min-w-0"
          >
            <span className="dc-arena-dock-btn !px-2.5 sm:!px-4 text-xs sm:text-xl md:text-[22px] whitespace-nowrap">
              <ArenaCompareIcon className="w-5 h-5 sm:w-7 sm:h-7 shrink-0" />
              <span className="truncate">COMPARAR</span>
            </span>
          </button>

          {/* 3. CIRCUITOS */}
          <button
            type="button"
            onClick={() => (onCircuits ? onCircuits(chosen.id) : onRace(chosen.id))}
            className="dc-arena-dock-btn-wrap min-w-0"
          >
            <span className="dc-arena-dock-btn !px-2.5 sm:!px-4 text-xs sm:text-xl md:text-[22px] whitespace-nowrap">
              <ArenaCircuitsIcon className="w-5 h-5 sm:w-7 sm:h-7 shrink-0" />
              <span className="truncate">CIRCUITOS</span>
            </span>
          </button>

          {/* 4. >> INICIAR / CONTINUAR HISTORIA / CORRER AHORA (CTA Principal Naranja Energía) */}
          <button
            type="button"
            data-testid="intro-main-story-cta"
            onClick={() => {
              if (
                onStartStoryPrologue &&
                !isNarrativeStateAtLeast(storyState.narrativeState, 'garage_unlocked') &&
                !storyState.prologueSkipped
              ) {
                onStartStoryPrologue();
                return;
              }
              if (
                onStartBonusRecovery &&
                directorStatus.canPlayRecoveryBonus &&
                !storyState.recoveryCompleted
              ) {
                onStartBonusRecovery();
                return;
              }
              onRace(chosen.id);
            }}
            className="dc-arena-cta-wrap min-w-0"
          >
            <span className="dc-arena-cta-btn !px-2.5 sm:!px-6 text-xs sm:text-2xl md:text-[26px] whitespace-nowrap">
              <ArenaRunChevronsIcon className="w-5 h-5 sm:w-7 sm:h-7 shrink-0" />
              <span className="truncate">{directorStatus.ctaLabel}</span>
            </span>
          </button>
        </nav>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400/80">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-[#00E5F5]/80 shrink-0" />
            <span>
              {SATIRICAL_FICTION_DISCLAIMER} · Selección creativa de los autos más buscados por los paraguayos (sin orden de ranking comercial).
            </span>
          </span>
          <a
            href="https://datacarpy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold text-[#00E5F5]/90 hover:text-white transition-colors"
          >
            <span>datacarpy.com</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </footer>

      {/* MODAL DE NOTIFICACIONES */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Notificaciones de DATACAR ARENA"
          onClick={() => setShowNotifications(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[#00E5F5]/55 bg-[#061219] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#00E5F5]/25 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#FFAA12]" />
                <h3 className="font-display text-xl font-black italic uppercase tracking-wider text-white">
                  CENTRO DE AVISOS
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifications(false)}
                className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-[#00E5F5] hover:text-white cursor-pointer"
                aria-label="Cerrar notificaciones"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-300">
              <div className="rounded-lg border border-[#FFAA12]/45 bg-[#1C1406]/80 p-3">
                <p className="font-bold uppercase tracking-wider text-[#FFAA12]">
                  Operación Weno Bank · Piloto Oficial DATACAR
                </p>
                <p className="mt-1 text-slate-100">{DATACAR_INSTITUTIONAL_PREMISE}</p>
                <p className="mt-1 text-slate-300">{DATACAR_INSTITUTIONAL_FLEET}</p>
              </div>
              <div className="rounded-lg border border-[#00E5F5]/30 bg-[#102C38]/60 p-3">
                <p className="font-bold uppercase tracking-wider text-[#00E5F5]">
                  La Flota DATACAR · 7 SUVs en catálogo
                </p>
                <p className="mt-1">
                  Arrastrá horizontalmente sobre el vehículo en el estadio para inspeccionarlo en 360°, o usá las flechas laterales para explorar los 7 modelos.
                </p>
              </div>
              <p className="text-[11px] text-slate-400">{SATIRICAL_FICTION_DISCLAIMER}</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AJUSTES */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Ajustes de DATACAR ARENA"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[#00E5F5]/55 bg-[#061219] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#00E5F5]/25 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#00E5F5]" />
                <h3 className="font-display text-xl font-black italic uppercase tracking-wider text-white">
                  CONFIGURACIÓN
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-[#00E5F5] hover:text-white cursor-pointer"
                aria-label="Cerrar configuración"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              <GraphicsQualitySelector />
              <button
                type="button"
                onClick={toggleSound}
                className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-[#102C38]/55 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white hover:border-[#00E5F5] cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  {muted ? <VolumeX size={16} className="text-rose-400" /> : <Volume2 size={16} className="text-[#00E5F5]" />}
                  <span>Audio del motor y efectos</span>
                </span>
                <span className={muted ? 'text-rose-400' : 'text-[#00E5F5]'}>
                  {muted ? 'SILENCIADO' : 'ACTIVO'}
                </span>
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-[#102C38]/55 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white hover:border-[#00E5F5] cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Maximize2 size={16} className="text-[#00E5F5]" />
                  <span>Pantalla completa</span>
                </span>
                <span className="text-slate-300">ALTERNAR</span>
              </button>

              {onOpenArcade && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(false);
                    onOpenArcade();
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-[#FFAA12]/50 bg-[#FFAA12]/10 px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#FFAA12] hover:bg-[#FFAA12]/20 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Smartphone size={16} />
                    <span>Cambiar a Vista Arcade compacta</span>
                  </span>
                  <span>ABRIR</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowSettings(false);
                  setShowWenoIntro(true);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-[#FFAA12]/50 bg-[#1A1306]/90 px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#FFAA12] hover:border-[#FFAA12] cursor-pointer"
              >
                <span>Ver presentación Operación Weno Bank</span>
                <span>ABRIR</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSettings(false);
                  onStart();
                }}
                className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-200 hover:border-[#00E5F5] cursor-pointer"
              >
                <span>Selector clásico de modalidades</span>
                <span className="text-[#00E5F5]">IR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SHOWROOM 360° FOTOGRÁFICO */}
      {show360Modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Showroom 360 de ${chosen.brand} ${chosen.name}`}
          onClick={() => setShow360Modal(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-[#00E5F5]/55 bg-[#061219] p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#00E5F5]/25 pb-3 mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#00E5F5]">
                  SHOWROOM 360° INTERACTIVO
                </p>
                <h3 className="font-display text-2xl font-black italic uppercase text-white">
                  {chosen.brand} {chosen.name} · {specData.trimBadge}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShow360Modal(false)}
                className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-[#00E5F5] hover:text-white cursor-pointer"
                aria-label="Cerrar visor 360"
              >
                <X size={18} />
              </button>
            </div>
            <Suspense fallback={<LoadingFallbackBadge compact label="Cargando visor 360°…" />}>
              <LazyPhotographic360Viewer key={chosen.id} vehicle={chosen} compact initialMode="frames" />
            </Suspense>
          </div>
        </div>
      )}
      {showWenoIntro && (
        <Suspense fallback={null}>
          <LazyWenoBankIntroModal
            open={showWenoIntro}
            onAccept={() => {
              markWenoBankIntroSeen();
              setShowWenoIntro(false);
            }}
            onSkip={() => {
              markWenoBankIntroSeen();
              setShowWenoIntro(false);
            }}
          />
        </Suspense>
      )}
      {showFinaleModal && (
        <Suspense fallback={null}>
          <LazyWenoCampaignFinaleModal
            open={showFinaleModal}
            onClose={() => setShowFinaleModal(false)}
            onReplayCircuit={() => {
              setShowFinaleModal(false);
              onCircuits?.(chosen.id);
            }}
            onStartRecoveryMission={
              onStartBonusRecovery
                ? () => {
                    setShowFinaleModal(false);
                    onStartBonusRecovery();
                  }
                : undefined
            }
          />
        </Suspense>
      )}
    </main>
  );
}

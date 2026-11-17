import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { Vehicle, VehicleRaceResult } from './types/vehicle';
import {
  PRESET_VEHICLES,
  PRESET_TRACKS,
  PROYECTO_FANTASMA_LAMBORGHINI,
  getOfficialVehicleImageUrl,
} from './data/presetVehicles';
import { ASUNCION_CIRCUITS, matchesDifficulty, toRaceTrack } from './data/asuncionCircuits';
import type { DifficultyFilter } from './data/asuncionCircuits';
import { simulateFullRace } from './utils/physicsEngine';
import { WEATHER_OPTIONS } from './utils/weatherDynamics';
import type { WeatherMode } from './utils/weatherDynamics';
import { IntroSplash } from './components/IntroSplash';
import { LoadingFallbackBadge } from './components/LoadingFallbackBadge';
import { rankDrivingIQ } from './utils/drivingIQ';
import { soundEngine } from './utils/soundEngine';
import { bgmAudioManager } from './utils/bgmAudioManager';
import type { TrackHazard } from './utils/interactiveRacePhysics';
import {
  ArenaFlowTopBar,
  ArenaSectionBackdrop,
} from './components/ArenaVisualKit';
import type { ArenaFlowStepItem } from './components/ArenaVisualKit';
import {
  evaluateCityTrialCompletion,
  formatJailCountdown,
  getWenoCampaignOverview,
  isPlayerCurrentlyJailed,
  recordWenoBankCircuitAttempt,
  useCareerProgression,
  type RaceModeId,
} from './utils/careerProgression';
import { multiplayerClient, type OnlineRoomSnapshot } from './utils/multiplayerClient';
import {
  DEFAULT_PAYLOAD_SELECTION,
  clampPayloadSelection,
  computePayloadKg,
  type VehiclePayloadSelection,
} from './utils/payloadConfig';
import {
  CUSTOM_VEHICLE_ID,
  hydrateCustomGlbFromIndexedDb,
  useCustomVehicle,
} from './utils/customVehicleStore';
import { useDatacarAccount } from './utils/datacarAccount';
import { evaluateCircuitTimeResult, getCircuitTargetTime } from './utils/circuitTargetTimes';
import { submitCircuitRun } from './utils/rankingStore';
import {
  formatOfficialPower,
  formatOfficialTorque,
  formatOfficialWeight,
} from './utils/specFidelity';
import {
  DATACAR_PROMO_DOMAIN,
  DATACAR_PROMO_URL,
  resolveComparatorVehicleStats,
} from './utils/comparatorHelpers';
import {
  disableSoftwareLandscapeFallback,
  dismissOrientationHint,
  requestLandscapeOrientation,
  useForcedLandscapeOrientation,
} from './utils/iosOrientationManager';
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ChevronsRight, Clapperboard,
  FlagTriangleRight, GitCompareArrows, Globe, Lock, Play, Plus, RotateCcw,
  ShieldAlert, ShieldCheck, Smartphone, Sparkles, Trophy, MousePointer2, UserCheck, Volume2, VolumeX, Wrench,
} from 'lucide-react';
import {
  DATACAR_INSTITUTIONAL_PREMISE,
  DATACAR_SELECTOR_COPY,
  SATIRICAL_FICTION_DISCLAIMER,
  getWenoBankMissionForCircuit,
  markWenoBankIntroSeen,
} from './utils/wenoBankMissions';
import { STORY_DIALOGUES_BY_CHAPTER } from './utils/storyCampaign';
import {
  canStartRecoveryMission,
  canUseLamborghiniInContext,
  getNextUnlockedStoryCircuitId,
  isLamborghiniUnlockedForFreePlay,
  isWenoCircuitUnlockedInStory,
  shouldAutoLaunchStoryPrologue,
  useStoryProgress,
} from './utils/storyProgress';
import {
  NarrativeDirector,
  type ActiveStoryOverlayStage,
} from './utils/NarrativeDirector';
import {
  applySelectedTireCompoundToVehicle,
  useTireCatalogSelection,
} from './utils/tireCatalog';

import { retryDynamicImport } from './utils/chunkRecovery';

// Pantallas secundarias, motores 3D y modales diferidos con React.lazy() y recuperación ante despliegues nuevos
const Race3DPerspectiveView = lazy(() =>
  retryDynamicImport(() =>
    import('./components/Race3DPerspectiveView').then((m) => ({ default: m.Race3DPerspectiveView })),
  ),
);
const CarShowroom3D = lazy(() =>
  retryDynamicImport(() =>
    import('./components/CarShowroom3D').then((m) => ({ default: m.CarShowroom3D })),
  ),
);
const MobileGameExperience = lazy(() =>
  retryDynamicImport(() => import('./components/mobile/MobileGameExperience')),
);
const VehicleSpecsPanel = lazy(() =>
  retryDynamicImport(() =>
    import('./components/VehicleSpecsPanel').then((m) => ({ default: m.VehicleSpecsPanel })),
  ),
);
const DetailedSpecsTable = lazy(() =>
  retryDynamicImport(() =>
    import('./components/DetailedSpecsTable').then((m) => ({ default: m.DetailedSpecsTable })),
  ),
);
const DrivingIQResults = lazy(() =>
  retryDynamicImport(() =>
    import('./components/DrivingIQResults').then((m) => ({ default: m.DrivingIQResults })),
  ),
);
const ArcadeBriefingStage = lazy(() =>
  retryDynamicImport(() =>
    import('./components/ArcadeBriefingAndResults').then((m) => ({ default: m.ArcadeBriefingStage })),
  ),
);
const ArcadeResultsStage = lazy(() =>
  retryDynamicImport(() =>
    import('./components/ArcadeBriefingAndResults').then((m) => ({ default: m.ArcadeResultsStage })),
  ),
);
const ArenaCircuitSelector = lazy(() =>
  retryDynamicImport(() =>
    import('./components/ArenaCircuitSelector').then((m) => ({ default: m.ArenaCircuitSelector })),
  ),
);
const ComparatorDual3DStage = lazy(() =>
  retryDynamicImport(() =>
    import('./components/ComparatorDual3DStage').then((m) => ({ default: m.ComparatorDual3DStage })),
  ),
);
const TireShowroomSection = lazy(() =>
  retryDynamicImport(() =>
    import('./components/TireShowroomSection').then((m) => ({ default: m.TireShowroomSection })),
  ),
);
const PayloadSelector = lazy(() =>
  retryDynamicImport(() =>
    import('./components/PayloadSelector').then((m) => ({ default: m.PayloadSelector })),
  ),
);
const JailLockoutModal = lazy(() =>
  retryDynamicImport(() =>
    import('./components/JailLockoutModal').then((m) => ({ default: m.JailLockoutModal })),
  ),
);
const OnlineLobbyModal = lazy(() =>
  retryDynamicImport(() =>
    import('./components/OnlineLobbyModal').then((m) => ({ default: m.OnlineLobbyModal })),
  ),
);
const CustomVehicleModal = lazy(() =>
  retryDynamicImport(() =>
    import('./components/CustomVehicleModal').then((m) => ({ default: m.CustomVehicleModal })),
  ),
);
const DatacarAccountModal = lazy(() =>
  retryDynamicImport(() =>
    import('./components/DatacarAccountModal').then((m) => ({ default: m.DatacarAccountModal })),
  ),
);
const RankingModal = lazy(() =>
  retryDynamicImport(() =>
    import('./components/RankingModal').then((m) => ({ default: m.RankingModal })),
  ),
);
const WenoBankIntroModal = lazy(() =>
  retryDynamicImport(() =>
    import('./components/WenoBankIntroModal').then((m) => ({ default: m.WenoBankIntroModal })),
  ),
);
const WenoCampaignFinaleModal = lazy(() =>
  retryDynamicImport(() =>
    import('./components/WenoCampaignFinaleModal').then((m) => ({ default: m.WenoCampaignFinaleModal })),
  ),
);
const StoryIntroCinematic = lazy(() =>
  retryDynamicImport(() =>
    import('./components/StoryIntroCinematic').then((m) => ({ default: m.StoryIntroCinematic })),
  ),
);
const LamborghiniReveal = lazy(() =>
  retryDynamicImport(() =>
    import('./components/LamborghiniReveal').then((m) => ({ default: m.LamborghiniReveal })),
  ),
);
const LamborghiniTheftCinematic = lazy(() =>
  retryDynamicImport(() =>
    import('./components/LamborghiniTheftCinematic').then((m) => ({ default: m.LamborghiniTheftCinematic })),
  ),
);
const LamborghiniRecoveryCinematic = lazy(() =>
  retryDynamicImport(() =>
    import('./components/LamborghiniRecoveryCinematic').then((m) => ({ default: m.LamborghiniRecoveryCinematic })),
  ),
);

type Screen =
  | 'intro' | 'home' | 'compare-choose' | 'compare-run' | 'compare-results'
  | 'circuit-choose' | 'garage' | 'briefing' | 'race-run' | 'race-results' | 'replay';

const compareTracks = PRESET_TRACKS.filter(track => track.distanceMeters <= 3500);
const buttonPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40';
const buttonSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600/80 bg-[#081724]/90 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-cyan-400/70 hover:bg-[#0d2436]';
const panel = 'rounded-2xl border border-[#00E5F5]/25 bg-[#06131f]/92 shadow-[0_16px_40px_rgba(0,0,0,0.72)]';

function RealCarsCTA() {
  return (
    <section
      data-testid="real-cars-promo-cta"
      aria-label="Promoción Datacar Paraguay"
      className="rounded-2xl border-2 border-amber-400/60 bg-gradient-to-r from-[#06131f] via-[#091c2b] to-[#112a3d] p-6 shadow-xl sm:p-7"
    >
      <p className="text-[11px] font-black uppercase tracking-[.22em] text-amber-300">
        DATACAR PARAGUAY · MERCADO REAL
      </p>
      <p className="mt-2 max-w-3xl text-lg font-extrabold leading-snug text-white sm:text-2xl">
        ¿Querés dejar los jueguitos y comprar estos autos en la vida real? No olvides ingresar a{' '}
        <a
          href={DATACAR_PROMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-black text-[#00E5F5] underline decoration-[#00E5F5]/80 underline-offset-4 hover:text-amber-300"
        >
          {DATACAR_PROMO_DOMAIN}
        </a>
      </p>
      <a
        className={`${buttonPrimary} mt-4`}
        href={DATACAR_PROMO_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Ir a {DATACAR_PROMO_DOMAIN} <ArrowRight size={17} />
      </a>
    </section>
  );
}

function PrettyCar({car}: {car: Vehicle}) {
  return <img src={car.imageUrl || getOfficialVehicleImageUrl(car.id)} alt={`${car.brand} ${car.name}`} referrerPolicy="no-referrer" className="dc-arena-cutout-img h-36 w-full rounded-xl object-contain object-center" />;
}

export default function App() {
  const initialQuery = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);
  const mobileMediaQuery = '(pointer: coarse) and (max-width: 1100px), (pointer: coarse) and (max-height: 560px), (max-width: 768px)';
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(mobileMediaQuery).matches);
  useEffect(() => { const query = window.matchMedia(mobileMediaQuery); const update = () => setIsMobile(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  const [screen, setScreen] = useState<Screen>(() =>
    initialQuery.get('autostart') === '1' && !isPlayerCurrentlyJailed() ? 'race-run' : 'intro',
  );
  const { customInput, customVehicle, saveCustom, clearCustom } = useCustomVehicle();
  const { account, isMember } = useDatacarAccount();
  const allCars = useMemo(
    () => (customVehicle ? [...PRESET_VEHICLES, customVehicle] : PRESET_VEHICLES),
    [customVehicle],
  );
  const getCar = (id: string) =>
    id === PROYECTO_FANTASMA_LAMBORGHINI.id
      ? PROYECTO_FANTASMA_LAMBORGHINI
      : allCars.find(car => car.id === id) || allCars[0];
  const getPreviewUrl = (id: string) =>
    id === PROYECTO_FANTASMA_LAMBORGHINI.id
      ? PROYECTO_FANTASMA_LAMBORGHINI.imageUrl || getOfficialVehicleImageUrl(id)
      : allCars.find(car => car.id === id)?.imageUrl || getOfficialVehicleImageUrl(id);

  useEffect(() => {
    void hydrateCustomGlbFromIndexedDb();
    // Precargar y decodificar en memoria desde el primer segundo las 6 fotos de los circuitos
    // y las 7 imágenes de los vehículos para que aparezcan al instante (0 ms) al cambiar de pantalla.
    const preloadUrls = [
      ...ASUNCION_CIRCUITS.map((c) => c.imageUrl),
      ...PRESET_VEHICLES.map((v) => v.imageUrl || getOfficialVehicleImageUrl(v.id)),
    ];
    for (const url of preloadUrls) {
      if (!url) continue;
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }, []);

  useEffect(() => {
    if (account?.pilotName) {
      multiplayerClient.setPilotName(account.pilotName, isMember);
    }
  }, [account?.pilotName, isMember]);

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparePreviewId, setComparePreviewId] = useState<string>(PRESET_VEHICLES[0].id);
  const [compareTrackIndex, setCompareTrackIndex] = useState(0);
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('todos');
  const [circuitId, setCircuitId] = useState(() => {
    const requestedCircuit = initialQuery.get('circuit');
    if (requestedCircuit && ASUNCION_CIRCUITS.some(c => c.id === requestedCircuit)) {
      return requestedCircuit;
    }
    return initialQuery.get('autostart') === '1' ? 'aviadores' : 'aviadores';
  });
  const [playerId, setPlayerId] = useState(() => {
    const requestedCar = initialQuery.get('car');
    if (requestedCar && PRESET_VEHICLES.some(c => c.id === requestedCar)) {
      return requestedCar;
    }
    return PRESET_VEHICLES[2].id;
  });
  const [payloadSelection, setPayloadSelection] = useState<VehiclePayloadSelection>(DEFAULT_PAYLOAD_SELECTION);
  const [raceResults, setRaceResults] = useState<VehicleRaceResult[] | null>(null);
  const [raceHazards, setRaceHazards] = useState<TrackHazard[]>([]);
  const [replayWeather, setReplayWeather] = useState<WeatherMode>('sunny');
  const [raceWeather, setRaceWeather] = useState<WeatherMode>(() => {
    const requestedWeather = initialQuery.get('weather') as WeatherMode | null;
    if (requestedWeather && WEATHER_OPTIONS.some(w => w.id === requestedWeather)) {
      return requestedWeather;
    }
    return 'sunny';
  });
  const [raceLaps, setRaceLaps] = useState<number>(2);
  const [raceMode, setRaceMode] = useState<RaceModeId>('city_trial');
  const [onlineSession, setOnlineSession] = useState(false);
  const [showOnlineLobby, setShowOnlineLobby] = useState(false);
  const [showCustomCarModal, setShowCustomCarModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [speedModeNewlyUnlocked, setSpeedModeNewlyUnlocked] = useState(false);
  const [jailModalAcknowledged, setJailModalAcknowledged] = useState(() => !isPlayerCurrentlyJailed());
  const [bgmMuted, setBgmMuted] = useState(() => bgmAudioManager.isMuted());
  const progression = useCareerProgression();
  const orientationState = useForcedLandscapeOrientation();
  // Cada reinicio crea una escena y un motor físico NUEVOS desde la grilla.
  const [raceSession, setRaceSession] = useState(0);
  const [arcadeView, setArcadeView] = useState(() => initialQuery.get('arcade') === '1');
  const [briefingLoadPercent, setBriefingLoadPercent] = useState(100);
  const [briefingActivelyLoading, setBriefingActivelyLoading] = useState(false);
  const [showExtendedDetails, setShowExtendedDetails] = useState(false);
  const [showWenoIntro, setShowWenoIntro] = useState(false);
  const [showCampaignFinaleModal, setShowCampaignFinaleModal] = useState(false);
  const storyState = useStoryProgress();
  const [storyOverlayStage, setStoryOverlayStage] = useState<ActiveStoryOverlayStage>(() =>
    shouldAutoLaunchStoryPrologue() ? 'intro_10s_cinematic' : 'closed',
  );
  const [activeStoryMissionId, setActiveStoryMissionId] = useState<string | null>(null);
  const [lastMission0FinishSec, setLastMission0FinishSec] = useState<number | null>(null);
  const campaignOverview = useMemo(
    () => getWenoCampaignOverview(ASUNCION_CIRCUITS, progression, circuitId),
    [progression, circuitId],
  );
  const nextPendingCircuit = useMemo(() => {
    const nextUnlocked = getNextUnlockedStoryCircuitId(storyState);
    if (nextUnlocked && !storyState.completedMissions.includes('weno_6')) {
      return ASUNCION_CIRCUITS.find((c) => c.id === nextUnlocked) ?? null;
    }
    return campaignOverview.nextPendingCircuitId
      ? ASUNCION_CIRCUITS.find((c) => c.id === campaignOverview.nextPendingCircuitId) ?? null
      : null;
  }, [storyState, campaignOverview.nextPendingCircuitId]);
  const touchX = useRef<number | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => bgmAudioManager.subscribe((s) => setBgmMuted(s.muted)), []);

  useEffect(() => {
    if (progression.isJailed) {
      setJailModalAcknowledged(false);
    }
  }, [progression.isJailed]);

  useEffect(() => {
    const allowsLamborghini =
      activeStoryMissionId === 'mission_0' ||
      (isLamborghiniUnlockedForFreePlay(storyState) &&
        activeStoryMissionId !== 'recovery_final');
    if (
      playerId === PROYECTO_FANTASMA_LAMBORGHINI.id &&
      allowsLamborghini
    ) {
      return;
    }
    if (!allCars.some(c => c.id === playerId)) {
      setPlayerId(PRESET_VEHICLES[2].id);
    }
    if (!allCars.some(c => c.id === comparePreviewId)) {
      setComparePreviewId(PRESET_VEHICLES[0].id);
    }
    setCompareIds(prev => {
      const filtered = prev.filter(id => allCars.some(c => c.id === id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [allCars, playerId, comparePreviewId, activeStoryMissionId, storyState]);

  const circuit = ASUNCION_CIRCUITS.find(item => item.id === circuitId) || ASUNCION_CIRCUITS[0];
  const raceTrack = useMemo(() => toRaceTrack(circuit, raceLaps), [circuit, raceLaps]);
  const compareTrack = compareTracks[compareTrackIndex] || compareTracks[0];
  const compareCars = useMemo(() => compareIds.map(id => allCars.find(c => c.id === id) || allCars[0]), [compareIds, allCars]);
  const comparePreviewCar = getCar(comparePreviewId);
  const compareResults = useMemo(() => simulateFullRace(compareCars, compareTrack), [compareCars, compareTrack]);
  const { selectedCompoundId: selectedTireCompoundId } = useTireCatalogSelection(playerId);
  const playerCar = useMemo(
    () => applySelectedTireCompoundToVehicle(getCar(playerId), selectedTireCompoundId),
    [allCars, playerId, selectedTireCompoundId],
  );
  // En modo conducción individual se compite contra el Tiempo Meta del circuito (solo tu vehículo .glb en pista, sin rivales IA).
  const raceCars = useMemo(() => [playerCar], [playerCar]);
  const raceBaseResults = useMemo(() => simulateFullRace(raceCars, raceTrack), [raceCars, raceTrack]);
  const playerIndex = Math.max(0, allCars.findIndex(car => car.id === playerId));
  useEffect(() => {
    setPayloadSelection(prev => {
      const clamped = clampPayloadSelection(prev, playerCar);
      if (clamped.occupants === prev.occupants && clamped.luggageTier === prev.luggageTier) {
        return prev;
      }
      return clamped;
    });
  }, [playerCar.id, playerCar.equipment.seatingCapacity]);
  const playerPayloadKg = useMemo(
    () => computePayloadKg(payloadSelection, playerCar),
    [payloadSelection, playerCar],
  );
  const podium = raceResults?.slice().sort((a, b) => a.finishPosition - b.finishPosition);
  const drivingAssessments = useMemo(() => raceResults
    ? rankDrivingIQ(raceResults, raceBaseResults, raceTrack.distanceMeters)
    : [], [raceResults, raceBaseResults, raceTrack.distanceMeters]);

  useEffect(() => {
    if (isMobile || arcadeView) return;
    bgmAudioManager.setSceneContext({
      screenOrStage: screen,
      circuitId,
      raceMode,
    });
  }, [isMobile, arcadeView, screen, circuitId, raceMode]);

  useEffect(() => {
    if (isMobile || arcadeView) return;
    bgmAudioManager.setDuckReason('jail', progression.isJailed);
  }, [isMobile, arcadeView, progression.isJailed]);

  useEffect(() => {
    if (screen !== 'circuit-choose' && screen !== 'garage' && screen !== 'briefing') return;
    if (screen === 'briefing') {
      setBriefingLoadPercent(100);
      setBriefingActivelyLoading(false);
    }
    // Precalentar los módulos ligeros de interfaz
    void retryDynamicImport(() => import('./components/ArcadeBriefingAndResults')).catch(() => null);
    void retryDynamicImport(() => import('./components/Race3DPerspectiveView')).catch(() => null);
    // IMPORTANTE: No iniciar la descarga del archivo .glb de 50-68 MB mientras el navegador está en
    // 'circuit-choose' renderizando las 6 fotos de los circuitos, para no saturar las conexiones HTTP.
    if (screen === 'briefing') {
      void retryDynamicImport(() => import('./utils/vehicle3DModelLoader'))
        .then(({ resolveDedicatedVehicleGLTF }) => resolveDedicatedVehicleGLTF(playerId))
        .catch(() => null);
    }
  }, [screen, playerId]);

  const startStoryPrologueFlow = () => {
    NarrativeDirector.startIntro();
    setStoryOverlayStage('intro_10s_cinematic');
  };

  const launchMission0TestDrive = () => {
    soundEngine.unlock();
    setStoryOverlayStage('closed');
    setActiveStoryMissionId('mission_0');
    setCircuitId('aviadores');
    setRaceLaps(1);
    setRaceMode('city_trial');
    setPlayerId(PROYECTO_FANTASMA_LAMBORGHINI.id);
    setOnlineSession(false);
    setSpeedModeNewlyUnlocked(false);
    setRaceSession(n => n + 1);
    setRaceResults(null);
    setRaceHazards([]);
    setReplayWeather(raceWeather);
    setScreen('race-run');
  };

  const launchBonusRecoveryFlow = () => {
    if (!canStartRecoveryMission(storyState)) return;
    setStoryOverlayStage('closed');
    setShowCampaignFinaleModal(false);
    setActiveStoryMissionId('recovery_final');
    setCircuitId('aviadores');
    setRaceLaps(1);
    setRaceMode('city_trial');
    if (playerId === PROYECTO_FANTASMA_LAMBORGHINI.id) {
      setPlayerId(PRESET_VEHICLES[2].id);
    }
    setScreen('garage');
  };

  const startRaceWithCarId = (targetCarId?: string) => {
    soundEngine.unlock();
    if (isPlayerCurrentlyJailed()) {
      setJailModalAcknowledged(false);
      return;
    }
    const candidateCarId = targetCarId || playerId;
    const isMainOrRecoveryMission =
      activeStoryMissionId === 'recovery_final' ||
      (activeStoryMissionId !== 'mission_0' && raceMode !== 'practice_free' && !isLamborghiniUnlockedForFreePlay(storyState));
    if (candidateCarId === PROYECTO_FANTASMA_LAMBORGHINI.id && isMainOrRecoveryMission) {
      setPlayerId(PRESET_VEHICLES[2].id);
    } else if (
      targetCarId &&
      (allCars.some(c => c.id === targetCarId) || targetCarId === PROYECTO_FANTASMA_LAMBORGHINI.id)
    ) {
      setPlayerId(targetCarId);
    }
    if (
      activeStoryMissionId !== 'mission_0' &&
      activeStoryMissionId !== 'recovery_final' &&
      raceMode !== 'practice_free' &&
      !isWenoCircuitUnlockedInStory(circuitId, storyState)
    ) {
      setCircuitId(getNextUnlockedStoryCircuitId(storyState));
    }
    setOnlineSession(false);
    setSpeedModeNewlyUnlocked(false);
    setRaceSession(n => n + 1);
    setRaceResults(null);
    setRaceHazards([]);
    setReplayWeather(raceWeather);
    setScreen('race-run');
  };
  const startRace = () => startRaceWithCarId();
  const handleOnlineMatchReady = (room: OnlineRoomSnapshot) => {
    soundEngine.unlock();
    if (isPlayerCurrentlyJailed()) {
      setShowOnlineLobby(false);
      setJailModalAcknowledged(false);
      return;
    }
    setShowOnlineLobby(false);
    if (ASUNCION_CIRCUITS.some(c => c.id === room.circuitId)) {
      setCircuitId(room.circuitId);
    }
    setRaceLaps(Math.max(1, Math.min(3, room.laps)));
    setRaceMode(room.mode === 'speed_pro' && progression.speedModeUnlocked ? 'speed_pro' : 'city_trial');
    setOnlineSession(true);
    setSpeedModeNewlyUnlocked(false);
    setRaceSession(n => n + 1);
    setRaceResults(null);
    setRaceHazards([]);
    setReplayWeather(raceWeather);
    setScreen('race-run');
  };
  const chooseDifficulty = (filter: DifficultyFilter) => {
    setDifficulty(filter);
    if (!matchesDifficulty(circuit, filter)) {
      const firstAvailable = ASUNCION_CIRCUITS.find(item => matchesDifficulty(item, filter));
      if (firstAvailable) setCircuitId(firstAvailable.id);
    }
  };
  const rotateSelection = (offset: number) => {
    setPlayerId(allCars[(playerIndex + offset + allCars.length) % allCars.length].id);
  };
  const toggleCompare = (id: string) => {
    setCompareIds(previous => {
      if (previous.includes(id)) return previous.filter(item => item !== id);
      return previous.length >= 2 ? [previous[1], id] : [...previous, id];
    });
  };
  const goHome = () => setScreen('home');
  const goIntro = () => setScreen('intro');
  const isComparison = screen.startsWith('compare');
  const isCareerFlow = ['circuit-choose', 'garage', 'briefing', 'race-run', 'race-results', 'replay'].includes(screen);

  const careerStepIndex =
    screen === 'circuit-choose'
      ? 0
      : screen === 'garage'
        ? 1
        : screen === 'briefing'
          ? 2
          : screen === 'race-run'
            ? 3
            : 4;

  const compareStepIndex =
    screen === 'compare-choose' ? 0 : screen === 'compare-run' ? 1 : 2;

  const flowSteps: ArenaFlowStepItem[] | undefined = isCareerFlow
    ? [
        { label: 'CIRCUITO', onSelect: () => setScreen('circuit-choose') },
        { label: 'TU AUTO 360°', onSelect: () => setScreen('garage') },
        { label: 'PREPARAR', onSelect: () => setScreen('briefing') },
        { label: 'CORRER' },
        { label: 'RESULTADOS', onSelect: podium ? () => setScreen('race-results') : undefined },
      ]
    : isComparison
      ? [
          { label: 'MODELOS', onSelect: () => setScreen('compare-choose') },
          { label: 'SIMULACIÓN', onSelect: compareIds.length === 2 ? () => setScreen('compare-run') : undefined },
          { label: 'RESULTADOS' },
        ]
      : undefined;

  if (isMobile) {
    const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    return (
      <Suspense fallback={<LoadingFallbackBadge fullHeight label="Cargando modo Arcade…" />}>
        <MobileGameExperience initialCircuitId={circuitId} onCircuitChange={setCircuitId} forceArcadeMode={!isCoarsePointer} />
      </Suspense>
    );
  }
  if (arcadeView) {
    return (
      <Suspense fallback={<LoadingFallbackBadge fullHeight label="Cargando Vista Arcade…" />}>
        <MobileGameExperience initialPlayerId={playerId} initialCircuitId={circuitId} onCircuitChange={setCircuitId} forceArcadeMode onExitArcadeMode={() => setArcadeView(false)} />
      </Suspense>
    );
  }

  const storyCinematicModals = (
    <Suspense fallback={null}>
      {storyOverlayStage === 'intro_10s_cinematic' && (
        <StoryIntroCinematic
          open
          onIntroVideoCompleted={() => {
            NarrativeDirector.completeIntroVideo();
          }}
          onAcceptMission={() => {
            NarrativeDirector.acceptRecruitment();
            setStoryOverlayStage('lamborghini_reveal');
          }}
          onPostponeToMenu={() => {
            setStoryOverlayStage('closed');
          }}
          onSkipPrologueToGarage={() => {
            NarrativeDirector.skipPrologue();
            setActiveStoryMissionId(null);
            setCircuitId('aviadores');
            if (playerId === PROYECTO_FANTASMA_LAMBORGHINI.id) {
              setPlayerId(PRESET_VEHICLES[2].id);
            }
            setStoryOverlayStage('closed');
            setScreen('garage');
          }}
        />
      )}
      {storyOverlayStage === 'lamborghini_reveal' && (
        <LamborghiniReveal
          open
          onStartMission0TestDrive={launchMission0TestDrive}
          onSkipPrologueToGarage={() => {
            NarrativeDirector.skipPrologue();
            setActiveStoryMissionId(null);
            setCircuitId('aviadores');
            if (playerId === PROYECTO_FANTASMA_LAMBORGHINI.id) {
              setPlayerId(PRESET_VEHICLES[2].id);
            }
            setStoryOverlayStage('closed');
            setScreen('garage');
          }}
          onBackToMenu={() => setStoryOverlayStage('closed')}
        />
      )}
      {storyOverlayStage === 'mission_0_discovery_theft' && (
        <LamborghiniTheftCinematic
          open
          finishTimeSec={lastMission0FinishSec}
          onCompleteToGarage={() => {
            NarrativeDirector.completeTheftAndUnlockGarage();
            setActiveStoryMissionId(null);
            setPlayerId(PRESET_VEHICLES[2].id);
            setCircuitId('aviadores');
            setRaceLaps(2);
            setStoryOverlayStage('closed');
            setScreen('garage');
          }}
        />
      )}
      {storyOverlayStage === 'recovery_cinematic_and_epilogue' && (
        <LamborghiniRecoveryCinematic
          open
          onFinishEpilogueAndContinue={() => {
            NarrativeDirector.completeEpilogue();
            setActiveStoryMissionId(null);
            setStoryOverlayStage('closed');
            setScreen('garage');
          }}
          onDriveRecoveredLamborghini={() => {
            NarrativeDirector.completeEpilogue();
            setActiveStoryMissionId(null);
            setStoryOverlayStage('closed');
            setPlayerId(PROYECTO_FANTASMA_LAMBORGHINI.id);
            setRaceMode('practice_free');
            setRaceLaps(1);
            setScreen('briefing');
          }}
        />
      )}
    </Suspense>
  );

  if (screen === 'intro') {
    return (
      <>
        {storyCinematicModals}
        <IntroSplash
          vehicles={allCars}
          onStart={() => setScreen('home')}
          onGarage={id => { setPlayerId(id); setScreen('garage'); }}
          onCompare={id => { if (id) setComparePreviewId(id); setScreen('compare-choose'); }}
          onCircuits={id => { setPlayerId(id); setScreen('circuit-choose'); }}
          onRace={id => { setPlayerId(id); setScreen('circuit-choose'); }}
          onOpenArcade={() => setArcadeView(true)}
          onStartStoryPrologue={startStoryPrologueFlow}
          onStartBonusRecovery={launchBonusRecoveryFlow}
        />
      </>
    );
  }

  const leaveRaceToScreen = (nextScreen: Screen) => {
    if (screen === 'race-run' || screen === 'replay') {
      soundEngine.stopAll(0.05);
      if (onlineSession) {
        multiplayerClient.leaveRoom();
        setOnlineSession(false);
      }
    }
    setScreen(nextScreen);
  };

  return <div ref={shellRef} className={`dc-app-shell relative min-h-screen bg-[#061219] text-slate-50 selection:bg-cyan-400 selection:text-slate-950 ${orientationState.softwareRotated ? 'dc-ios-forced-landscape' : ''} ${progression.isJailed ? 'dc-jail-active' : ''}`}>
    {/* Fondo nocturno genérico de estadio DATACAR ARENA para todas las secciones */}
    <ArenaSectionBackdrop fixed />

    {orientationState.showIosUnlockHint && (
      <div
        data-testid="desktop-ios-orientation-hint"
        role="status"
        className="relative z-[150] flex items-center justify-between gap-2 border-b border-amber-400/50 bg-[#081622] px-4 py-1.5 text-xs text-amber-100"
      >
        <span>
          <strong>Giro 90° activo:</strong> Si estás en iPhone/iPad, desactivá el bloqueo vertical en Centro de Control para rotación nativa.
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {orientationState.softwareRotated && (
            <button
              type="button"
              onClick={() => disableSoftwareLandscapeFallback()}
              className="rounded border border-cyan-400/60 bg-cyan-950 px-2.5 py-0.5 text-[11px] font-black uppercase text-cyan-200 cursor-pointer"
            >
              Vertical
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissOrientationHint()}
            className="rounded border border-amber-400/55 bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-black uppercase text-amber-200 cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    )}

    <ArenaFlowTopBar
      steps={flowSteps}
      currentStep={isCareerFlow ? careerStepIndex : isComparison ? compareStepIndex : undefined}
      onLogoClick={() => leaveRaceToScreen('intro')}
      rightSlot={
        <>
          {progression.isJailed && (
            <>
              <button
                type="button"
                onClick={() => setJailModalAcknowledged(v => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/80 bg-rose-950/90 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-rose-200 tabular-nums animate-pulse cursor-pointer whitespace-nowrap shrink-0"
                title="Ver detalle de sanción vial de 30s"
              >
                <span>🔒 Cárcel · {formatJailCountdown(progression.jailRemainingSec)}</span>
              </button>
              <button
                type="button"
                onClick={() => leaveRaceToScreen('garage')}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/65 bg-[#0a2335] px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-cyan-200 hover:border-cyan-300 cursor-pointer whitespace-nowrap shrink-0"
              >
                Garaje
              </button>
              <button
                type="button"
                onClick={() => leaveRaceToScreen('compare-choose')}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/65 bg-[#0a2335] px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-cyan-200 hover:border-cyan-300 cursor-pointer whitespace-nowrap shrink-0"
              >
                Comparar
              </button>
            </>
          )}
          <button
            type="button"
            data-testid="topbar-bgm-toggle-btn"
            onClick={() => {
              const next = !bgmAudioManager.isMuted();
              if (!next) bgmAudioManager.unlock();
              bgmAudioManager.setMuted(next);
            }}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider cursor-pointer whitespace-nowrap shrink-0 ${
              bgmMuted
                ? 'border-slate-600/80 bg-slate-900/90 text-slate-400 hover:text-white'
                : 'border-cyan-400/50 bg-[#0A1D2A]/90 text-cyan-200 hover:border-cyan-300'
            }`}
            title={bgmMuted ? 'Activar música de fondo' : 'Silenciar música de fondo'}
            aria-label={bgmMuted ? 'Activar música' : 'Silenciar música'}
          >
            {bgmMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            <span className="hidden lg:inline">{bgmMuted ? 'Música OFF' : 'Música'}</span>
          </button>
          <button
            type="button"
            data-testid="topbar-rotate-landscape-btn"
            onClick={() => {
              void requestLandscapeOrientation(shellRef.current || document.documentElement);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/50 bg-[#0A1D2A]/90 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-cyan-200 hover:border-cyan-300 cursor-pointer whitespace-nowrap shrink-0"
            title="Modo horizontal / Giro 90° iOS"
          >
            <Smartphone size={13} className="rotate-90" />
            <span className="hidden lg:inline">Girar</span>
          </button>
          <button
            type="button"
            onClick={() => setShowRankingModal(true)}
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-950/55 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-200 hover:border-amber-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Trophy size={13} />
            <span>Ranking</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAccountModal(true)}
            className={`hidden md:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isMember
                ? 'border-cyan-400/65 bg-cyan-950/75 text-cyan-200'
                : 'border-slate-600/80 bg-slate-900/90 text-slate-200 hover:border-cyan-400/60'
            }`}
          >
            <UserCheck size={13} />
            <span>{isMember ? account?.pilotName : 'DATACARPY'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (isPlayerCurrentlyJailed()) {
                setJailModalAcknowledged(false);
                return;
              }
              setShowOnlineLobby(true);
            }}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/55 bg-emerald-950/65 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-300 hover:border-emerald-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Globe size={13} />
            <span>En Línea</span>
          </button>
          <button
            type="button"
            onClick={() => setArcadeView(true)}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#FFAA12]/55 bg-[#FFAA12]/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#FFAA12] hover:bg-[#FFAA12]/25 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Smartphone size={13} />
            <span>Vista Arcade</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (canStartRecoveryMission(storyState) && !storyState.recoveryCompleted) {
                setShowCampaignFinaleModal(true);
              } else {
                startStoryPrologueFlow();
              }
            }}
            className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-[#FFAA12]/55 bg-[#1A1306]/90 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#FFAA12] hover:border-[#FFAA12] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShieldCheck size={13} />
            <span>Proyecto Fantasma</span>
          </button>
          <button
            type="button"
            onClick={() => leaveRaceToScreen('intro')}
            className="rounded-lg border border-[#00E5F5]/40 bg-[#0A1D2A]/90 px-3 py-1.5 text-xs font-bold text-[#00E5F5] hover:border-[#00E5F5] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Inicio
          </button>
        </>
      }
    />

    {!jailModalAcknowledged && progression.isJailed && (
      <Suspense fallback={null}>
        <JailLockoutModal
          remainingSec={progression.jailRemainingSec}
          incidentCircuit={progression.lastJailReasonCircuit}
          onAcknowledgeRelease={() => setJailModalAcknowledged(true)}
          onExploreWhileLocked={() => setJailModalAcknowledged(true)}
          onNavigateGarage={() => leaveRaceToScreen('garage')}
          onNavigateComparator={() => leaveRaceToScreen('compare-choose')}
          onNavigateCircuits={() => leaveRaceToScreen('circuit-choose')}
          onOpenSettings={() => setShowAccountModal(true)}
        />
      </Suspense>
    )}

    {showOnlineLobby && (
      <Suspense fallback={null}>
        <OnlineLobbyModal
          isOpen={showOnlineLobby}
          onClose={() => setShowOnlineLobby(false)}
          selectedCar={playerCar}
          selectedCircuit={circuit}
          laps={raceLaps}
          raceMode={raceMode}
          speedModeUnlocked={progression.speedModeUnlocked}
          onSelectRaceMode={mode => {
            if (mode === 'speed_pro' && !progression.speedModeUnlocked) return;
            setRaceMode(mode);
          }}
          onMatchReady={handleOnlineMatchReady}
        />
      </Suspense>
    )}

    {showCustomCarModal && (
      <Suspense fallback={null}>
        <CustomVehicleModal
          isOpen={showCustomCarModal}
          initialInput={customInput}
          onClose={() => setShowCustomCarModal(false)}
          onSave={input => {
            saveCustom(input);
            setPlayerId(CUSTOM_VEHICLE_ID);
          }}
          onDelete={customVehicle ? () => {
            clearCustom();
            setPlayerId(PRESET_VEHICLES[2].id);
            setShowCustomCarModal(false);
          } : undefined}
        />
      </Suspense>
    )}

    {showAccountModal && (
      <Suspense fallback={null}>
        <DatacarAccountModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
        />
      </Suspense>
    )}

    {showRankingModal && (
      <Suspense fallback={null}>
        <RankingModal
          isOpen={showRankingModal}
          initialCircuitId={circuitId}
          onClose={() => setShowRankingModal(false)}
        />
      </Suspense>
    )}

    {showWenoIntro && (
      <Suspense fallback={null}>
        <WenoBankIntroModal
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

    {storyCinematicModals}

    {showCampaignFinaleModal && (
      <Suspense fallback={null}>
        <WenoCampaignFinaleModal
          open={showCampaignFinaleModal}
          onClose={() => setShowCampaignFinaleModal(false)}
          onReplayCircuit={(targetCircuitId) => {
            setShowCampaignFinaleModal(false);
            setActiveStoryMissionId(null);
            if (ASUNCION_CIRCUITS.some((c) => c.id === targetCircuitId)) {
              setCircuitId(targetCircuitId);
            }
            setScreen('briefing');
          }}
          onStartRecoveryMission={launchBonusRecoveryFlow}
          onOpenRecoveryCinematic={() => {
            setShowCampaignFinaleModal(false);
            setStoryOverlayStage('recovery_cinematic_and_epilogue');
          }}
        />
      </Suspense>
    )}

    <main className="dc-app-main relative z-10 mx-auto w-full max-w-[1380px] px-4 pb-16 pt-6 sm:px-8">
      <Suspense fallback={<LoadingFallbackBadge fullHeight label="Cargando módulo de DATACAR ARENA…" />}>
      {screen === 'home' && <div className="dc-game-home space-y-8">
        <button type="button" onClick={() => setScreen('intro')} className="text-xs font-bold uppercase tracking-widest text-cyan-400 hover:text-white">← Volver a la Flota DATACAR</button>
        <div className="mx-auto max-w-3xl py-6 text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[.32em] text-amber-300">{DATACAR_INSTITUTIONAL_PREMISE}</p>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">ELEGÍ TU <span className="text-cyan-400">OPERACIÓN.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-300">Compará el rendimiento de dos vehículos de la flota DATACAR, o cumplí misiones contrarreloj rumbo al Weno Bank antes de que lleguen los corruptos.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <button onClick={() => setScreen('compare-choose')} className={`${panel} group flex min-h-[330px] flex-col items-start justify-between overflow-hidden p-7 text-left transition hover:border-cyan-400/60 hover:bg-slate-800/85`}>
            <span className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-cyan-300"><GitCompareArrows size={28}/></span>
            <div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-cyan-400">Modalidad 01 · Automática</p><h2 className="text-4xl font-black">COMPARAR</h2><p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">Elegí exactamente dos modelos de los más buscados por los paraguayos. La simulación se calcula a partir de sus fichas técnicas.</p></div>
            <span className="flex items-center gap-2 text-sm font-bold text-cyan-300">Elegir 2 autos <ArrowRight className="transition group-hover:translate-x-1" size={17}/></span>
          </button>
          <button onClick={() => setScreen('circuit-choose')} className={`${panel} group flex min-h-[330px] flex-col items-start justify-between overflow-hidden border-emerald-400/20 p-7 text-left transition hover:border-emerald-400/70 hover:bg-slate-800/85`}>
            <span className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-emerald-300"><FlagTriangleRight size={28}/></span>
            <div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-emerald-400">Modalidad 02 · Operación Weno Bank</p><h2 className="text-4xl font-black">MODO CARRERA</h2><p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">Elegí tu circuito en Asunción, confirmá tu máquina y llegá al Weno Bank antes que los corruptos respetando semáforos y peatones.</p></div>
            <span className="flex items-center gap-2 text-sm font-bold text-emerald-300">Elegir misión <ArrowRight className="transition group-hover:translate-x-1" size={17}/></span>
          </button>
        </div>
        <p className="text-center text-xs text-slate-500">{SATIRICAL_FICTION_DISCLAIMER}</p>
      </div>}

      {screen === 'compare-choose' && <div className="space-y-6 pb-4">
        <div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-400">COMPARAR</p><h1 className="mt-2 font-display text-3xl font-black italic uppercase sm:text-5xl">DOS AUTOS. UNA PRUEBA.</h1><p className="mt-2 text-sm text-slate-300">Elegí un modelo a la izquierda, giralo libremente en el escenario Arena y añadilo a la comparación o iniciá carrera directamente.</p></div>
        {/* Primero explorar el vehículo con giro manual, luego añadirlo al comparador. */}
        <div className="grid items-start gap-4 lg:grid-cols-[225px_minmax(0,1fr)_290px]">
          <div className={`${panel} space-y-2.5 p-4`}>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-300">MODELOS DISPONIBLES</p>
            {allCars.map(car => {
              const cStats = resolveComparatorVehicleStats(car);
              return (
                <button type="button" key={car.id} onClick={() => setComparePreviewId(car.id)} aria-pressed={comparePreviewId === car.id} className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition cursor-pointer ${comparePreviewId === car.id ? 'border-cyan-400 bg-cyan-400/15 shadow-[0_0_14px_rgba(0,229,245,0.2)]' : 'border-slate-700/80 bg-[#040c14]/85 hover:border-cyan-400/50'}`}>
                  <img src={getPreviewUrl(car.id)} alt="" referrerPolicy="no-referrer" className="h-14 w-20 shrink-0 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]" />
                  <span className="min-w-0"><span className="block truncate text-[10px] font-bold uppercase tracking-wider text-cyan-300">{car.brand}</span><span className="block truncate text-sm font-black">{car.name}</span><span className="block text-[11px] text-slate-400">{cStats.powerDisplay} · 0–100 {cStats.accel0to100Display}</span></span>
                </button>
              );
            })}
            <div className="border-t border-slate-700/80 pt-3">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">TU COMPARATIVA · {compareIds.length}/2</p>
              {[0,1].map(slot => <div key={slot} className="mb-2 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/75 px-3 py-2 text-sm"><span className="text-slate-300">Auto {slot+1}</span><span className="font-bold text-cyan-300">{compareIds[slot] ? getCar(compareIds[slot]).name : 'Sin elegir'}</span></div>)}
              <button type="button" onClick={() => toggleCompare(comparePreviewId)} aria-pressed={compareIds.includes(comparePreviewId)} className={`mt-2 w-full rounded-xl px-4 py-3 text-sm font-black transition cursor-pointer ${compareIds.includes(comparePreviewId) ? 'border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20' : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'}`}>
                {compareIds.includes(comparePreviewId) ? 'Quitar de la comparación' : compareIds.length === 2 ? 'Reemplazar el más antiguo' : 'Elegir este auto'}
              </button>
            </div>
          </div>
          <div className="min-w-0">
            <CarShowroom3D vehicle={comparePreviewCar} allow3DToggle />
            <p className="mt-3 text-center text-xs text-slate-300">Explorá el auto en vista oficial PNG/WebP o Modelo 3D (GLB), arrastrá para girarlo y consultá su ficha antes de elegirlo.</p>
          </div>
          <aside className="min-w-0 lg:sticky lg:top-5" aria-label="Características del modelo que estás explorando">
            <VehicleSpecsPanel
              key={comparePreviewCar.id}
              vehicle={comparePreviewCar}
              context="compare"
              onRace={() => startRaceWithCarId(comparePreviewCar.id)}
              raceLabel="Iniciar carrera con este auto"
            />
          </aside>
        </div>
        <div className={`${panel} dc-comparator-sticky-actions flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
          <label className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-300">Prueba predeterminada
            <select value={compareTrackIndex} onChange={event => setCompareTrackIndex(Number(event.target.value))} className="mt-1.5 block w-full rounded-lg border border-slate-600 bg-slate-950 p-2.5 text-sm font-semibold text-white">
              {compareTracks.map((track, index) => <option key={track.id} value={index}>{track.name}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2.5">
            <button disabled={compareIds.length !== 2} onClick={() => setScreen('compare-results')} className={buttonPrimary}>
              <Play size={16}/> Comparar modelos
            </button>
            <button
              type="button"
              data-testid="comparator-start-race-btn"
              onClick={() => startRaceWithCarId(compareIds[0] ?? comparePreviewId)}
              className="dc-btn-gold dc-comparator-start-race-btn inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-black italic uppercase cursor-pointer"
            >
              <ChevronsRight size={17} strokeWidth={3} />
              <span>Iniciar carrera</span>
            </button>
          </div>
        </div>
        <button onClick={goIntro} className={buttonSecondary}><ArrowLeft size={16}/> Volver a Los más buscados</button>
      </div>}

      {screen === 'compare-run' && <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-400">COMPARACIÓN AUTOMÁTICA</p><h1 className="mt-1 font-display text-3xl font-black italic uppercase">{compareTrack.name}</h1><p className="mt-2 text-sm text-slate-300">No necesitás acelerar ni girar. Se reproducen los resultados calculados.</p></div><button onClick={() => setScreen('compare-choose')} className={buttonSecondary}><ArrowLeft size={16}/> Cambiar modelos</button></div>
        <Race3DPerspectiveView key={`comparison-${compareTrack.id}-${compareIds.join('-')}`} experience="comparison" vehicles={compareCars} track={compareTrack} simulationResults={compareResults} onFinishRace={() => setScreen('compare-results')}/>
        <button onClick={() => setScreen('compare-results')} className={buttonSecondary}>Ver resultados calculados <ArrowRight size={16}/></button>
      </div>}

      {screen === 'compare-results' && <div className="space-y-6 pb-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-400">RESULTADOS DE COMPARACIÓN</p><h1 className="mt-1 font-display text-4xl font-black italic uppercase">FRENTE A FRENTE</h1><p className="mt-2 text-sm text-slate-300">Prueba: {compareTrack.name}. Valores referenciales con respaldo técnico estático completo.</p></div>
        {compareCars.length === 2 && (
          <ComparatorDual3DStage vehicles={[compareCars[0], compareCars[1]]} />
        )}
        <div className="grid gap-4 md:grid-cols-2">{compareResults.slice().sort((a,b)=>a.finishPosition-b.finishPosition).map((item, index) => {
          const st = resolveComparatorVehicleStats(item.vehicle, item);
          return (
            <div key={item.vehicle.id} className={`${panel} p-5`}>
              <span className="text-xs font-black text-cyan-400">PUESTO {index + 1}</span>
              <PrettyCar car={item.vehicle}/>
              <h2 className="text-xl font-black">{item.vehicle.brand} {item.vehicle.name}</h2>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div><span className="text-xs text-slate-400">Tiempo</span><p className="text-xl font-black tabular-nums">{item.finishTimeSec.toFixed(2)} s</p></div>
                <div><span className="text-xs text-slate-400">0–100 km/h</span><p className="text-xl font-black tabular-nums text-cyan-300">{st.accel0to100Display}</p></div>
                <div><span className="text-xs text-slate-400">Vel. máxima</span><p className="text-xl font-black tabular-nums">{(item.topSpeedAchievedKmh ?? item.vehicle.topSpeedKmh).toFixed(1)} <span className="text-xs">km/h</span></p></div>
              </div>
            </div>
          );
        })}</div>
        <DetailedSpecsTable vehicles={compareCars} results={compareResults} />
        <RealCarsCTA/>
        <div className={`${panel} dc-comparator-sticky-actions flex flex-wrap items-center justify-between gap-3 p-4`}>
          <div className="flex flex-wrap gap-2.5">
            <button onClick={() => setScreen('compare-run')} className={buttonSecondary}><RotateCcw size={16}/> Ver simulación en pista</button>
            <button onClick={() => setScreen('compare-choose')} className={buttonSecondary}>Cambiar vehículos</button>
            <button onClick={goIntro} className={buttonSecondary}>Inicio</button>
          </div>
          <button
            type="button"
            data-testid="comparator-results-start-race-btn"
            onClick={() => startRaceWithCarId(compareCars[0]?.id ?? playerId)}
            className="dc-btn-gold dc-comparator-start-race-btn inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-black italic uppercase cursor-pointer"
          >
            <ChevronsRight size={18} strokeWidth={3} />
            <span>Iniciar carrera</span>
          </button>
        </div>
      </div>}

      {screen === 'circuit-choose' && (
        <ArenaCircuitSelector
          circuits={ASUNCION_CIRCUITS}
          selectedCircuitId={circuitId}
          onSelectCircuit={setCircuitId}
          difficulty={difficulty}
          onSelectDifficulty={chooseDifficulty}
          laps={raceLaps}
          onSelectLaps={setRaceLaps}
          raceMode={raceMode}
          onSelectRaceMode={mode => {
            if (mode === 'speed_pro' && !progression.speedModeUnlocked) return;
            setRaceMode(mode);
          }}
          speedModeUnlocked={progression.speedModeUnlocked}
          onOpenOnlineLobby={() => {
            if (isPlayerCurrentlyJailed()) {
              setJailModalAcknowledged(false);
              return;
            }
            setShowOnlineLobby(true);
          }}
          onOpenRanking={() => setShowRankingModal(true)}
          onOpenCampaignFinale={() => setShowCampaignFinaleModal(true)}
          onStartBonusRecovery={launchBonusRecoveryFlow}
          onReplayPrologue={startStoryPrologueFlow}
          onConfirm={() => {
            setActiveStoryMissionId(null);
            setScreen('garage');
          }}
          confirmLabel="Elegir mi vehículo"
          playerVehicleId={playerId}
          playerVehicle={playerCar}
          getCarImageUrl={getPreviewUrl}
        />
      )}

      {screen === 'garage' && <div className="space-y-6">
        {/* Mensaje narrativo de ingreso al Garaje (§9) + Estado del Proyecto Fantasma */}
        <section
          data-testid="garage-story-narrative-banner"
          className="rounded-2xl border border-[#00E5F5]/45 bg-gradient-to-r from-[#051320]/96 via-[#081c2e]/96 to-[#191205]/96 p-4 sm:p-5 shadow-xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-7 space-y-1.5 border-l-4 border-[#00E5F5] pl-3.5">
              <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-widest text-[#00E5F5]">
                <Smartphone size={13} className="text-[#FFAA12]" />
                <span>
                  {activeStoryMissionId === 'recovery_final'
                    ? 'CENTRAL DATACAR · OPERACIÓN FANTASMA — RECUPERACIÓN FINAL'
                    : 'CENTRAL DATACAR · INGRESO AL GARAJE COMERCIAL'}
                </span>
              </div>
              {activeStoryMissionId === 'recovery_final' ? (
                <p className="text-xs sm:text-sm font-bold text-slate-100 leading-snug">
                  "Detectamos el traslado final del Proyecto Fantasma rumbo al aeropuerto. Elegí uno de los siete vehículos comerciales de DATACAR para interceptarlo antes de que salga del país."
                </p>
              ) : (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm font-bold text-slate-100">
                  {STORY_DIALOGUES_BY_CHAPTER.garage_first_entry.map((msg) => (
                    <span key={msg.id}>"{msg.text}"</span>
                  ))}
                </div>
              )}
            </div>

            {/* Tarjeta de estado del Lamborghini Proyecto Fantasma (Bloqueado por robo o Desbloqueado como Bonus) */}
            <div
              data-testid="garage-lamborghini-status-card"
              className={`lg:col-span-5 rounded-xl border p-3.5 flex items-center justify-between gap-3 ${
                isLamborghiniUnlockedForFreePlay(storyState) && activeStoryMissionId !== 'recovery_final'
                  ? 'border-[#FFAA12]/80 bg-[#1c1404]/95'
                  : 'border-rose-500/55 bg-[#190810]/90'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-black uppercase tracking-wider">
                  {isLamborghiniUnlockedForFreePlay(storyState) && activeStoryMissionId !== 'recovery_final' ? (
                    <span className="inline-flex items-center gap-1 text-[#FFAA12]">
                      <Sparkles size={12} />
                      <span>LAMBORGHINI RECUPERADO · VEHÍCULO BONUS</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-300">
                      <Lock size={12} />
                      <span>PROYECTO FANTASMA — ROBADO</span>
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-display text-sm sm:text-base font-black italic uppercase text-white truncate">
                  LAMBORGHINI PROYECTO FANTASMA
                </p>
                <p className="text-[11px] text-slate-300">
                  {isLamborghiniUnlockedForFreePlay(storyState) && activeStoryMissionId !== 'recovery_final'
                    ? 'Disponible para Carrera Libre y Desafíos Especiales (no comercial).'
                    : 'Bloqueado durante las 6 misiones principales y la recuperación.'}
                </p>
              </div>

              {isLamborghiniUnlockedForFreePlay(storyState) && activeStoryMissionId !== 'recovery_final' ? (
                <button
                  type="button"
                  data-testid="select-recovered-lamborghini-btn"
                  onClick={() => {
                    setPlayerId(PROYECTO_FANTASMA_LAMBORGHINI.id);
                    setRaceMode('practice_free');
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider shrink-0 cursor-pointer ${
                    playerId === PROYECTO_FANTASMA_LAMBORGHINI.id
                      ? 'bg-[#00E5F5] text-slate-950'
                      : 'bg-[#FFAA12] text-slate-950 hover:bg-amber-300'
                  }`}
                >
                  {playerId === PROYECTO_FANTASMA_LAMBORGHINI.id ? 'Seleccionado' : 'Usar Bonus'}
                </button>
              ) : (
                <span className="rounded-lg border border-rose-500/40 bg-rose-950/80 px-2.5 py-1.5 font-mono text-[10px] font-black uppercase text-rose-200 shrink-0">
                  BLOQUEADO
                </span>
              )}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#00E5F5]">{DATACAR_SELECTOR_COPY.fleetBadge} · {allCars.length} VEHÍCULOS</p>
            <h1 className="mt-1 font-display text-3xl font-black italic uppercase sm:text-5xl">{DATACAR_SELECTOR_COPY.title}</h1>
            <p className="mt-2 text-sm text-slate-200">{DATACAR_SELECTOR_COPY.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCustomCarModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/65 bg-cyan-950/75 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-cyan-200 hover:border-cyan-300 hover:text-white transition cursor-pointer shrink-0"
          >
            {customVehicle ? <Wrench size={15} /> : <Plus size={15} />}
            <span>{customVehicle ? 'Editar Auto Genérico (.glb)' : 'Crear Auto Genérico (.glb)'}</span>
          </button>
        </div>
        <div className={`${panel} p-4`}>
          <div className="flex items-center gap-3"><button className={buttonSecondary} onClick={() => rotateSelection(-1)} aria-label="Modelo anterior"><ChevronLeft size={22}/></button>
            <div className="flex min-w-0 flex-1 select-none gap-3 overflow-x-auto py-2" onTouchStart={event => { touchX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => { if (touchX.current === null) return; const delta = event.changedTouches[0]?.clientX - touchX.current; if (delta !== undefined && Math.abs(delta) > 55) rotateSelection(delta < 0 ? 1 : -1); touchX.current = null; }}>
              {allCars.map(car => <button key={car.id} onClick={() => setPlayerId(car.id)} className={`min-w-[155px] flex-1 rounded-xl border px-3 py-2.5 text-left transition cursor-pointer ${car.id === playerId ? 'border-[#00E5F5] bg-[#00E5F5]/15 shadow-[0_0_16px_rgba(0,229,245,0.28)]' : 'border-slate-700/80 bg-[#040c14]/80 hover:border-[#00E5F5]/50'}`}>
                <img src={getPreviewUrl(car.id)} alt="" referrerPolicy="no-referrer" className="h-14 w-full object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.85)]" />
                <p className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${car.id === playerId ? 'text-[#00E5F5]' : 'text-slate-400'}`}>{car.brand}</p>
                <p className="truncate text-sm font-black text-white">{car.name}</p>
              </button>)}
            </div>
            <button className={buttonSecondary} onClick={() => rotateSelection(1)} aria-label="Modelo siguiente"><ChevronRight size={22}/></button></div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400"><span>← Deslizá los {allCars.length} modelos →</span><span className="flex items-center gap-1"><MousePointer2 size={13}/> Vista PNG de estudio</span></div>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 space-y-4">
            <CarShowroom3D key={playerId} vehicle={playerCar} pngOnly />
            <PayloadSelector vehicle={playerCar} value={payloadSelection} onChange={setPayloadSelection} />
          </div>
          <aside className="min-w-0 lg:sticky lg:top-5" aria-label="Ficha técnica del vehículo seleccionado">
            <VehicleSpecsPanel key={playerCar.id} vehicle={playerCar} context="race" />
          </aside>
        </div>
        <TireShowroomSection selectedVehicle={playerCar} />
        <div className={`${panel} flex flex-wrap items-center justify-between gap-5 p-5`}>
          <div className="flex items-center gap-4 min-w-0">
            <img src={getPreviewUrl(playerCar.id)} alt="" referrerPolicy="no-referrer" className="hidden sm:block h-16 w-28 shrink-0 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)]" />
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-widest text-[#FFAA12]">{DATACAR_SELECTOR_COPY.onSelectVehicle}</span>
              <h2 className="mt-0.5 font-display text-2xl font-black italic uppercase truncate">{playerCar.brand} {playerCar.name}</h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-300">{getWenoBankMissionForCircuit(circuit.id, circuit.name).title} ({circuit.name}) · {formatOfficialPower(playerCar)} · {formatOfficialTorque(playerCar)} · Peso: {formatOfficialWeight(playerCar, true)}{playerPayloadKg > 0 ? ` + ${playerPayloadKg} kg carga` : ''}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5"><button onClick={() => setScreen('circuit-choose')} className={buttonSecondary}><ArrowLeft size={16}/> Circuitos</button><button onClick={() => { NarrativeDirector.markGarageSeen(playerId); setScreen('briefing'); }} className="dc-circuit-gold-cta-wrap cursor-pointer"><span className="dc-circuit-gold-cta-inner text-base">Confirmar vehículo <ArrowRight size={17}/></span></button></div>
        </div>
      </div>}

      {screen === 'briefing' && <div className="space-y-6">
        <ArcadeBriefingStage
          car={playerCar}
          circuit={circuit}
          weather={raceWeather}
          onWeatherChange={setRaceWeather}
          laps={raceLaps}
          onLapsChange={setRaceLaps}
          raceMode={raceMode}
          onRaceModeChange={mode => {
            if (mode === 'speed_pro' && !progression.speedModeUnlocked) return;
            setRaceMode(mode);
          }}
          speedModeUnlocked={progression.speedModeUnlocked}
          payload={payloadSelection}
          onPayloadChange={setPayloadSelection}
          isDatacarMember={isMember}
          onOpenAccount={() => setShowAccountModal(true)}
          onOpenOnlineLobby={() => {
            if (isPlayerCurrentlyJailed()) {
              setJailModalAcknowledged(false);
              return;
            }
            setShowOnlineLobby(true);
          }}
          loadPercent={briefingLoadPercent}
          loadLabel="Cargando pista y vehículos"
          isActivelyLoading={briefingActivelyLoading}
          loadingContext="race"
          onStartRace={startRace}
          onChangeCar={() => setScreen('garage')}
          onChangeCircuit={() => setScreen('circuit-choose')}
          getCarImageUrl={getPreviewUrl}
          activeStoryMissionId={activeStoryMissionId}
        />
        <div className={`${panel} p-5`}><h3 className="flex items-center gap-2 text-sm font-black"><ShieldAlert className="h-4 w-4 text-amber-400"/> MECÁNICA DE LA PARTIDA, CRUCE PEATONAL Y DESBLOQUEO DE FASE 2</h3><p className="mt-3 text-sm leading-relaxed text-slate-300">Acelerá con ↑ o W. Con ↓ o S frenás y, al detenerte, activás marcha atrás. Espacio es freno independiente y <strong>C abrocha el cinturón de seguridad</strong>. En la <strong>Fase 1 (Prueba en Ciudad)</strong> los peatones cruzan por las <strong>franjas peatonales cuando el semáforo está en rojo</strong>: si atropellás a un peatón vas a la <strong>cárcel por 30 segundos</strong> (tu auto queda inmovilizado durante la cuenta regresiva y podés recorrer el Garaje y el Comparador mientras esperás). Superando la Fase 1 limpiamente (Driving IQ ≥ 700) desbloqueás la <strong>Fase 2</strong>; también podés ensayar en <strong>Pista de Pruebas (Sin puntos)</strong>.</p></div>
      </div>}

      {screen === 'race-run' && <div className="dc-game-running space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-400">{onlineSession ? 'MULTIJUGADOR EN LÍNEA EN VIVO' : raceMode === 'speed_pro' ? 'FASE 2 · CONTRARRELOJ PURA SIN OBSTÁCULOS' : raceMode === 'practice_free' ? 'PISTA DE PRUEBAS · SIN PUNTAJE' : 'FASE 1 · OBJETIVO CONTRARRELOJ EN CIUDAD'} · {raceLaps} {raceLaps === 1 ? 'VUELTA' : 'VUELTAS'}</p><h1 className="mt-1 font-display text-3xl font-black italic uppercase">{circuit.name}</h1><p className="mt-1 text-sm text-slate-300">Vos: {playerCar.brand} {playerCar.name}{playerPayloadKg > 0 ? ` (+${playerPayloadKg} kg)` : ''} · {raceMode === 'speed_pro' ? 'Contrarreloj pura sin obstáculos: batí el Tiempo Meta Oro' : 'Superá el Tiempo Meta respetando semáforos, motociclistas (+15s penal.) y peatones'}</p></div><button onClick={() => { soundEngine.stopAll(0.05); if (onlineSession) { multiplayerClient.leaveRoom(); setOnlineSession(false); } setScreen('briefing'); }} className={buttonSecondary}><ArrowLeft size={16}/> Abandonar partida</button></div>
        <Race3DPerspectiveView
          key={`race-${circuitId}-${playerId}-${raceLaps}-${raceMode}-${onlineSession ? 'online' : 'solo'}-${raceSession}`}
          experience="race"
          playerVehicleId={playerId}
          initialWeather={raceWeather}
          vehicles={raceCars}
          track={raceTrack}
          simulationResults={raceBaseResults}
          raceMode={raceMode}
          onlineSession={onlineSession}
          playerPayloadKg={playerPayloadKg}
          isDatacarMember={isMember}
          onPedestrianArrest={() => {
            if (onlineSession) {
              multiplayerClient.leaveRoom();
              setOnlineSession(false);
            }
            setJailModalAcknowledged(false);
          }}
          onRestartRace={() => {
            if (isPlayerCurrentlyJailed()) {
              setJailModalAcknowledged(false);
              return;
            }
            setRaceSession(n => n + 1);
          }}
          onFinishRace={(results, hazards, weather) => {
            setRaceResults(results || null);
            setRaceHazards(hazards || []);
            setReplayWeather(weather || 'sunny');
            if (results) {
              const iqRanks = rankDrivingIQ(results, raceBaseResults, raceTrack.distanceMeters);
              const playerRes = results.find(r => r.vehicle.id === playerId);
              const playerIq = iqRanks.find(a => a.vehicleId === playerId);
              const baseIq1000 = playerIq ? Math.round(playerIq.total * 10) : 0;
              if (raceMode === 'city_trial') {
                const verdict = evaluateCityTrialCompletion({
                  finished: Boolean(playerRes && !playerRes.isDnf),
                  isDnf: Boolean(playerRes?.isDnf),
                  iqScore1000: baseIq1000,
                  redLightViolations: playerIq?.events.redLightViolations ?? 0,
                  motorcycleCollisions: playerIq?.events.motorcycleCollisions ?? 0,
                  pedestrianHit: false,
                  circuitId,
                });
                setSpeedModeNewlyUnlocked(verdict.newlyUnlocked);
              }
              if (raceMode !== 'practice_free') {
                const targetSpec = getCircuitTargetTime(circuitId, raceMode, raceLaps, raceTrack.distanceMeters);
                const wonCircuitMission = Boolean(
                  playerRes &&
                    !playerRes.isDnf &&
                    playerRes.finishTimeSec >= 0 &&
                    playerRes.finishTimeSec <= targetSpec.maxLimitSec,
                );
                if (activeStoryMissionId === 'mission_0') {
                  const storyOutcome = NarrativeDirector.recordMissionAttempt({
                    missionId: 'mission_0',
                    circuitId,
                    won: wonCircuitMission,
                    finishTimeSec: playerRes?.finishTimeSec ?? null,
                    raceMode,
                    availableCircuitIds: ASUNCION_CIRCUITS.map((c) => c.id),
                  });
                  if (storyOutcome.won) {
                    setLastMission0FinishSec(playerRes?.finishTimeSec ?? null);
                    setStoryOverlayStage('mission_0_discovery_theft');
                  }
                } else if (activeStoryMissionId === 'recovery_final') {
                  const storyOutcome = NarrativeDirector.recordMissionAttempt({
                    missionId: 'recovery_final',
                    circuitId,
                    won: wonCircuitMission,
                    finishTimeSec: playerRes?.finishTimeSec ?? null,
                    raceMode,
                    availableCircuitIds: ASUNCION_CIRCUITS.map((c) => c.id),
                  });
                  if (storyOutcome.won) {
                    setStoryOverlayStage('recovery_cinematic_and_epilogue');
                  }
                } else {
                  const storyOutcome = NarrativeDirector.recordMissionAttempt({
                    missionId: activeStoryMissionId,
                    circuitId,
                    won: wonCircuitMission,
                    finishTimeSec: playerRes?.finishTimeSec ?? null,
                    raceMode,
                    availableCircuitIds: ASUNCION_CIRCUITS.map((c) => c.id),
                  });
                  const campaignResult = recordWenoBankCircuitAttempt({
                    circuitId,
                    won: wonCircuitMission,
                    finishTimeSec: playerRes?.finishTimeSec ?? null,
                    raceMode,
                    availableCircuitIds: ASUNCION_CIRCUITS.map((c) => c.id),
                  });
                  if (campaignResult.newlyCompletedCampaign || storyOutcome.newlyUnlockedRecovery) {
                    setShowCampaignFinaleModal(true);
                  }
                }
                if (playerRes && !playerRes.isDnf && activeStoryMissionId !== 'mission_0') {
                  const targetEval = evaluateCircuitTimeResult(playerRes.finishTimeSec, targetSpec);
                  const finalIq1000 = Math.max(0, Math.min(1000, baseIq1000 + targetEval.iqBonus));
                  void submitCircuitRun({
                    circuitId,
                    mode: raceMode,
                    laps: raceLaps,
                    pilotName: account?.pilotName || multiplayerClient.getSnapshot().pilotName || 'PilotoDC',
                    isDatacarMember: isMember,
                    vehicleId: playerCar.id,
                    vehicleName: `${playerCar.brand} ${playerCar.name}`,
                    finishTimeSec: playerRes.finishTimeSec,
                    drivingIq: finalIq1000,
                    occupants: payloadSelection.occupants,
                    payloadKg: playerPayloadKg,
                    medal: targetEval.medal,
                  });
                }
              }
            }
            setScreen('race-results');
          }}
        />
        <p className="text-xs text-slate-400">Física jugable aproximada: agarre, aceleración, frenada en semáforos y franjas peatonales, salpicaduras en piso mojado e infracciones afectan el Driving IQ.</p>
      </div>}

      {screen === 'race-results' && <div className="space-y-6">
        {!podium ? (
          <div className={`${panel} p-8`}>
            <p>No hay resultados registrados todavía. Podés volver a correr.</p>
          </div>
        ) : (
          <>
            <ArcadeResultsStage
              circuitId={circuitId}
              circuitName={circuit.name}
              trackDistanceMeters={raceTrack.distanceMeters}
              laps={raceLaps}
              podium={podium}
              assessments={drivingAssessments}
              playerId={playerId}
              fallbackCar={playerCar}
              onBackToGarage={() => setScreen('garage')}
              onRepeatRace={startRace}
              onNextMission={
                nextPendingCircuit
                  ? () => {
                      setActiveStoryMissionId(null);
                      setCircuitId(nextPendingCircuit.id);
                      setRaceResults(null);
                      setRaceHazards([]);
                      setScreen('briefing');
                    }
                  : undefined
              }
              nextMissionCircuitName={nextPendingCircuit?.name ?? null}
              onOpenCampaignFinale={() => setShowCampaignFinaleModal(true)}
              activeStoryMissionId={activeStoryMissionId}
              onStartBonusRecovery={launchBonusRecoveryFlow}
              onOpenRecoveryCinematic={() => setStoryOverlayStage('recovery_cinematic_and_epilogue')}
              onWatchReplay={() => setScreen('replay')}
              onShowAllData={() => setShowExtendedDetails(v => !v)}
              raceMode={raceMode}
              speedModeUnlocked={progression.speedModeUnlocked}
              speedModeNewlyUnlocked={speedModeNewlyUnlocked}
              payloadKg={playerPayloadKg}
              isDatacarMember={isMember}
              onOpenAccount={() => setShowAccountModal(true)}
              onOpenRanking={() => setShowRankingModal(true)}
              onLaunchSpeedMode={() => {
                setRaceMode('speed_pro');
                setOnlineSession(false);
                setSpeedModeNewlyUnlocked(false);
                setRaceSession(n => n + 1);
                setRaceResults(null);
                setRaceHazards([]);
                setReplayWeather(raceWeather);
                setScreen('race-run');
              }}
              getCarImageUrl={getPreviewUrl}
            />
            {(() => {
              // Protagonista del jugador conservado en resumen compacto y accesible.
              const result = podium.find(item => item.vehicle.id === playerId);
              const hero = result?.vehicle ?? playerCar;
              return (
                <section className={`${panel} relative overflow-hidden border-cyan-400/25 p-4 sm:p-5`} aria-label="Tu vehículo al finalizar la carrera">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={getPreviewUrl(hero.id)}
                        alt={`${hero.brand} ${hero.name} — vehículo elegido para tu carrera`}
                        referrerPolicy="no-referrer"
                        className="h-16 w-28 object-contain"
                      />
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-300">TU LLEGADA · {circuit.name}</p>
                        <h2 className="text-lg font-black uppercase text-white">{hero.brand} {hero.name}</h2>
                        <p className="text-xs text-slate-400">
                          {result?.isDnf ? 'Recorrido no completado (DNF)' : `Puesto ${result?.finishPosition ?? '—'} · ${result ? `${result.finishTimeSec.toFixed(2)} s` : '—'} · Punta ${result ? result.topSpeedAchievedKmh.toFixed(1) : '—'} km/h`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setShowExtendedDetails(v => !v)} className={buttonSecondary}>
                        {showExtendedDetails ? 'Ocultar desglose técnico' : 'Ver desglose completo Driving IQ'}
                      </button>
                      <button type="button" onClick={() => setScreen('replay')} className={buttonPrimary}>
                        <Clapperboard size={16}/> Director TV · Repetición
                      </button>
                    </div>
                  </div>
                </section>
              );
            })()}
            {showExtendedDetails && (
              <DrivingIQResults
                results={podium}
                assessments={drivingAssessments}
                playerId={playerId}
                circuitId={circuitId}
                circuitName={circuit.name}
                practiceFree={raceMode === 'practice_free'}
                payloadKg={playerPayloadKg}
                isDatacarMember={isMember}
                targetEval={(() => {
                  const res = podium.find(r => r.vehicle.id === playerId);
                  if (!res || raceMode === 'practice_free') return null;
                  const spec = getCircuitTargetTime(circuitId, raceMode, raceLaps, raceTrack.distanceMeters);
                  return evaluateCircuitTimeResult(res.isDnf ? -1 : res.finishTimeSec, spec);
                })()}
              />
            )}
          </>
        )}
        <RealCarsCTA/>
        <div className="flex flex-wrap gap-3"><button onClick={startRace} className={buttonSecondary}><RotateCcw size={16}/> Volver a correr</button><button onClick={() => setScreen('circuit-choose')} className={buttonSecondary}>Elegir otro circuito</button><button onClick={goIntro} className={buttonSecondary}>Inicio</button></div>
      </div>}

      {screen === 'replay' && raceResults && <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400"><Clapperboard size={16}/> REPETICIÓN EXCLUSIVA · DIRECTOR TV</p><h1 className="mt-1 text-3xl font-black">ASÍ FUE TU CARRERA.</h1><p className="mt-2 text-sm text-slate-400">Se muestran las trayectorias que quedaron registradas durante la partida.</p></div><button onClick={() => setScreen('race-results')} className={buttonSecondary}><ArrowLeft size={16}/> Resultados</button></div>
        <Race3DPerspectiveView key={`replay-${circuitId}-${playerId}`} experience="replay" playerVehicleId={playerId} vehicles={raceCars} track={raceTrack} simulationResults={raceResults} replayHazards={raceHazards} replayWeather={replayWeather} onFinishRace={() => {}} />
        <RealCarsCTA/>
        <div className="flex gap-3"><button onClick={() => setScreen('race-results')} className={buttonPrimary}><Trophy size={16}/> Volver al podio</button><button onClick={startRace} className={buttonSecondary}><RotateCcw size={16}/> Nueva carrera</button></div>
      </div>}
      </Suspense>
    </main>
    <footer className="relative z-10 border-t border-slate-800 bg-slate-950/80 px-5 py-6 text-center text-xs leading-relaxed text-slate-500">DATACAR ARENA · Operación Weno Bank · {SATIRICAL_FICTION_DISCLAIMER} Las condiciones de los circuitos son ficticias e inspiradas en Asunción, no información actual sobre el estado de sus calles. · <a className="font-bold text-cyan-400 underline" href="https://datacarpy.com" target="_blank" rel="noreferrer">datacarpy.com</a></footer>
  </div>;
}

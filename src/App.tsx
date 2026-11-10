import React, { useMemo, useRef, useState } from 'react';
import type { Vehicle, VehicleRaceResult } from './types/vehicle';
import { PRESET_VEHICLES, PRESET_TRACKS } from './data/presetVehicles';
import { ASUNCION_CIRCUITS, matchesDifficulty, toRaceTrack } from './data/asuncionCircuits';
import type { DifficultyFilter } from './data/asuncionCircuits';
import { simulateFullRace } from './utils/physicsEngine';
import { Race3DPerspectiveView } from './components/Race3DPerspectiveView';
import { WEATHER_OPTIONS } from './utils/weatherDynamics';
import type { WeatherMode } from './utils/weatherDynamics';
import { CarShowroom3D } from './components/CarShowroom3D';
import { IntroSplash } from './components/IntroSplash';
import { VehicleSpecsPanel } from './components/VehicleSpecsPanel';
import { DetailedSpecsTable } from './components/DetailedSpecsTable';
import { DrivingIQResults } from './components/DrivingIQResults';
import { rankDrivingIQ } from './utils/drivingIQ';
import { soundEngine } from './utils/soundEngine';
import type { TrackHazard } from './utils/interactiveRacePhysics';
import {
  ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Clapperboard,
  FlagTriangleRight, Gauge, GitCompareArrows, MapPinned, Play, RotateCcw,
  ShieldAlert, Sparkles, Trophy, Volume2, Zap, MousePointer2, CloudRain,
} from 'lucide-react';

type Screen =
  | 'intro' | 'home' | 'compare-choose' | 'compare-run' | 'compare-results'
  | 'circuit-choose' | 'garage' | 'briefing' | 'race-run' | 'race-results' | 'replay';

const allCars = PRESET_VEHICLES;
const compareTracks = PRESET_TRACKS.filter(track => track.distanceMeters <= 3500);
const buttonPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40';
const buttonSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-cyan-400/60 hover:bg-slate-800';
const panel = 'rounded-2xl border border-slate-700/70 bg-slate-900/80 shadow-xl';
const getCar = (id: string) => allCars.find(car => car.id === id) || allCars[0];
const getPreviewUrl = (id: string) => `/assets/vehicle-previews/${id}.jpg`;

function Stepper({steps, current}: {steps: string[], current: number}) {
  return <div className="mb-7 flex flex-wrap items-center gap-2" aria-label="Etapas de la experiencia">
    {steps.map((label, index) => <React.Fragment key={label}>
      {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-600" />}
      <div className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${index === current ? 'border-cyan-400 bg-cyan-400/15 text-cyan-300' : index < current ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 text-slate-500'}`}>
        {index + 1}. {label}
      </div>
    </React.Fragment>)}
  </div>;
}
function RealCarsCTA() {
  return <section aria-label="Pasá del juego a los autos reales" className="rounded-2xl border border-cyan-400/40 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/50 p-6 shadow-xl sm:p-8">
    <p className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-300">EL JUEGO TERMINÓ. EL PRÓXIMO AUTO ES REAL.</p>
    <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">¿Querés dejar los jueguitos y pasar a los autos reales?</h2>
    <p className="mt-2 max-w-2xl text-sm text-slate-300">Explorá modelos, compará opciones y encontrá tu próximo vehículo en DATACAR Paraguay.</p>
    <a className={`${buttonPrimary} mt-5`} href="https://datacarpy.com" target="_blank" rel="noopener noreferrer">Conocer autos reales en datacarpy.com <ArrowRight size={17}/></a>
  </section>;
}

function PrettyCar({car}: {car: Vehicle}) {
  return <img src={getPreviewUrl(car.id)} alt={`${car.brand} ${car.name}`} className="h-32 w-full rounded-xl object-contain object-center" />;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('intro');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparePreviewId, setComparePreviewId] = useState<string>(allCars[0].id);
  const [compareTrackIndex, setCompareTrackIndex] = useState(0);
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('todos');
  const [circuitId, setCircuitId] = useState('aviadores');
  const [playerId, setPlayerId] = useState(allCars[2].id);
  const [raceResults, setRaceResults] = useState<VehicleRaceResult[] | null>(null);
  const [raceHazards, setRaceHazards] = useState<TrackHazard[]>([]);
  const [replayWeather, setReplayWeather] = useState<WeatherMode>('sunny');
  const [raceWeather, setRaceWeather] = useState<WeatherMode>('sunny');
  const touchX = useRef<number | null>(null);

  const circuit = ASUNCION_CIRCUITS.find(item => item.id === circuitId) || ASUNCION_CIRCUITS[0];
  const raceTrack = useMemo(() => toRaceTrack(circuit), [circuit]);
  const compareTrack = compareTracks[compareTrackIndex] || compareTracks[0];
  const compareCars = useMemo(() => compareIds.map(getCar), [compareIds]);
  const comparePreviewCar = getCar(comparePreviewId);
  const compareResults = useMemo(() => simulateFullRace(compareCars, compareTrack), [compareCars, compareTrack]);
  const raceCars = useMemo(() => [getCar(playerId), ...allCars.filter(car => car.id !== playerId).slice(0, 2)], [playerId]);
  const raceBaseResults = useMemo(() => simulateFullRace(raceCars, raceTrack), [raceCars, raceTrack]);
  const playerIndex = allCars.findIndex(car => car.id === playerId);
  const playerCar = getCar(playerId);
  const podium = raceResults?.slice().sort((a, b) => a.finishPosition - b.finishPosition);
  const drivingAssessments = useMemo(() => raceResults
    ? rankDrivingIQ(raceResults, raceBaseResults, raceTrack.distanceMeters)
    : [], [raceResults, raceBaseResults, raceTrack.distanceMeters]);

  const startRace = () => { soundEngine.unlock(); setRaceResults(null); setRaceHazards([]); setReplayWeather(raceWeather); setScreen('race-run'); };
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
  const isComparison = screen.startsWith('compare');
  const isRaceSetup = ['circuit-choose', 'garage', 'briefing'].includes(screen);

  if (screen === 'intro') {
    return <IntroSplash vehicles={allCars} onStart={() => setScreen('home')} onCompare={() => setScreen('compare-choose')} onRace={id => { setPlayerId(id); setScreen('circuit-choose'); }} />;
  }

  return <div className="min-h-screen bg-[#060b14] text-slate-50 selection:bg-cyan-400 selection:text-slate-950">
    <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_15%_-10%,rgba(8,145,178,.20),transparent_52%),radial-gradient(ellipse_at_85%_55%,rgba(16,185,129,.06),transparent_55%)]" />
    <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
        <button onClick={goHome} className="flex items-center gap-3 text-left" aria-label="Volver al inicio">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10"><Gauge className="h-6 w-6 text-cyan-400" /></span>
          <span><span className="block text-xl font-black tracking-tight">DATA<span className="font-light text-cyan-400">CAR</span> <span className="text-white">ARENA</span></span><span className="block text-[10px] font-semibold uppercase tracking-[.22em] text-slate-500">Edición 9.5 · Asunción</span></span>
        </button>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className={`rounded-full px-3 py-1.5 ${isComparison ? 'border border-cyan-400/30 bg-cyan-400/10 text-cyan-300' : 'text-slate-500'}`}>COMPARAR</span>
          <span className={`rounded-full px-3 py-1.5 ${isRaceSetup || screen === 'race-run' || screen === 'race-results' || screen === 'replay' ? 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'text-slate-500'}`}>MODO CARRERA</span>
          {screen !== 'home' && <button onClick={goHome} className="ml-2 rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800">Inicio</button>}
        </div>
      </div>
    </header>

    <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      {screen === 'home' && <div className="space-y-8">
        <button type="button" onClick={() => setScreen('intro')} className="text-xs font-bold uppercase tracking-widest text-cyan-400 hover:text-white">← Volver a Los más buscados</button>
        <div className="mx-auto max-w-3xl py-6 text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[.32em] text-cyan-400">Dos maneras de vivir DATACAR</p>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">ELEGÍ TU <span className="text-cyan-400">EXPERIENCIA.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400">Compará el rendimiento de dos vehículos en pruebas predeterminadas, o conducí contra rivales automáticos en circuitos ficticios inspirados en Asunción.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <button onClick={() => setScreen('compare-choose')} className={`${panel} group flex min-h-[330px] flex-col items-start justify-between overflow-hidden p-7 text-left transition hover:border-cyan-400/60 hover:bg-slate-800/85`}>
            <span className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-cyan-300"><GitCompareArrows size={28}/></span>
            <div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-cyan-400">Modalidad 01 · Automática</p><h2 className="text-4xl font-black">COMPARAR</h2><p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">Elegí exactamente dos modelos. La simulación se calcula a partir de sus fichas técnicas, sin manejar manualmente.</p></div>
            <span className="flex items-center gap-2 text-sm font-bold text-cyan-300">Elegir 2 autos <ArrowRight className="transition group-hover:translate-x-1" size={17}/></span>
          </button>
          <button onClick={() => setScreen('circuit-choose')} className={`${panel} group flex min-h-[330px] flex-col items-start justify-between overflow-hidden border-emerald-400/20 p-7 text-left transition hover:border-emerald-400/70 hover:bg-slate-800/85`}>
            <span className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-emerald-300"><FlagTriangleRight size={28}/></span>
            <div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-emerald-400">Modalidad 02 · Interactiva</p><h2 className="text-4xl font-black">MODO CARRERA</h2><p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">Elegí un circuito, seleccioná tu auto en el showroom 360° y conducí. Los rivales intentan esquivar los peligros.</p></div>
            <span className="flex items-center gap-2 text-sm font-bold text-emerald-300">Elegir circuito <ArrowRight className="transition group-hover:translate-x-1" size={17}/></span>
          </button>
        </div>
        <p className="text-center text-xs text-slate-500">Los circuitos son escenarios de ficción inspirados en calles reales. No representan el estado actual de las vías.</p>
      </div>}

      {screen === 'compare-choose' && <div className="space-y-6">
        <Stepper steps={['Elegir 2 modelos', 'Simulación automática', 'Resultados']} current={0}/>
        <div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-400">COMPARAR</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">DOS AUTOS. UNA PRUEBA.</h1><p className="mt-2 text-sm text-slate-400">Elegí un modelo a la izquierda, giralo libremente en el visor grande y recién después añadilo a la comparación.</p></div>
        {/* Primero explorar el vehículo con giro manual, luego añadirlo al comparador. */}
        <div className="grid items-start gap-4 lg:grid-cols-[210px_minmax(0,1fr)_290px]">
          <div className={`${panel} space-y-3 p-4`}>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-300">MODELOS DISPONIBLES</p>
            {allCars.map(car => <button type="button" key={car.id} onClick={() => setComparePreviewId(car.id)} aria-pressed={comparePreviewId === car.id} className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition ${comparePreviewId === car.id ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700 bg-slate-950 hover:border-slate-500'}`}>
              <img src={getPreviewUrl(car.id)} alt="" className="h-16 w-20 shrink-0 object-contain" />
              <span className="min-w-0"><span className="block truncate text-[10px] font-bold uppercase tracking-wider text-cyan-300">{car.brand}</span><span className="block text-sm font-black">{car.name}</span><span className="block text-[11px] text-slate-400">{car.powerHp} HP</span></span>
            </button>)}
            <div className="border-t border-slate-700/80 pt-3">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">TU COMPARATIVA · {compareIds.length}/2</p>
              {[0,1].map(slot => <div key={slot} className="mb-2 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/75 px-3 py-2 text-sm"><span className="text-slate-300">Auto {slot+1}</span><span className="font-bold text-cyan-300">{compareIds[slot] ? getCar(compareIds[slot]).name : 'Sin elegir'}</span></div>)}
              <button type="button" onClick={() => toggleCompare(comparePreviewId)} aria-pressed={compareIds.includes(comparePreviewId)} className={`mt-2 w-full rounded-xl px-4 py-3 text-sm font-black transition ${compareIds.includes(comparePreviewId) ? 'border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20' : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'}`}>
                {compareIds.includes(comparePreviewId) ? 'Quitar de la comparación' : compareIds.length === 2 ? 'Reemplazar el más antiguo' : 'Elegir este auto'}
              </button>
            </div>
          </div>
          <div className="min-w-0">
            <CarShowroom3D key={comparePreviewId} vehicle={comparePreviewCar} />
            <p className="mt-3 text-center text-xs text-slate-400">Explorá el auto con el mousepad y consultá su ficha antes de elegirlo.</p>
          </div>
          <aside className="min-w-0 lg:sticky lg:top-5" aria-label="Características del modelo que estás explorando">
            <VehicleSpecsPanel key={comparePreviewCar.id} vehicle={comparePreviewCar} context="compare" />
          </aside>
        </div>
        <div className={`${panel} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}>
          <label className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-300">Prueba predeterminada
            <select value={compareTrackIndex} onChange={event => setCompareTrackIndex(Number(event.target.value))} className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-sm font-semibold text-white">
              {compareTracks.map((track, index) => <option key={track.id} value={index}>{track.name}</option>)}
            </select>
          </label>
          <button disabled={compareIds.length !== 2} onClick={() => setScreen('compare-run')} className={buttonPrimary}><Play size={16}/> Ejecutar comparación</button>
        </div>
        <button onClick={goHome} className={buttonSecondary}><ArrowLeft size={16}/> Volver</button>
      </div>}

      {screen === 'compare-run' && <div className="space-y-6">
        <Stepper steps={['Elegir 2 modelos', 'Simulación automática', 'Resultados']} current={1}/>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-400">COMPARACIÓN AUTOMÁTICA</p><h1 className="mt-1 text-3xl font-black">{compareTrack.name}</h1><p className="mt-2 text-sm text-slate-400">No necesitás acelerar ni girar. Se reproducen los resultados calculados.</p></div><button onClick={() => setScreen('compare-choose')} className={buttonSecondary}><ArrowLeft size={16}/> Cambiar modelos</button></div>
        <Race3DPerspectiveView key={`comparison-${compareTrack.id}-${compareIds.join('-')}`} experience="comparison" vehicles={compareCars} track={compareTrack} simulationResults={compareResults} onFinishRace={() => setScreen('compare-results')}/>
        <button onClick={() => setScreen('compare-results')} className={buttonSecondary}>Ver resultados calculados <ArrowRight size={16}/></button>
      </div>}

      {screen === 'compare-results' && <div className="space-y-6">
        <Stepper steps={['Elegir 2 modelos', 'Simulación automática', 'Resultados']} current={2}/>
        <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-400">RESULTADOS DE COMPARACIÓN</p><h1 className="mt-1 text-4xl font-black">FRENTE A FRENTE</h1><p className="mt-2 text-sm text-slate-400">Prueba: {compareTrack.name}. Valores referenciales calculados a partir de atributos técnicos.</p></div>
        <div className="grid gap-4 md:grid-cols-2">{compareResults.slice().sort((a,b)=>a.finishPosition-b.finishPosition).map((item, index) => <div key={item.vehicle.id} className={`${panel} p-5`}>
          <span className="text-xs font-black text-cyan-400">PUESTO {index + 1}</span><PrettyCar car={item.vehicle}/><h2 className="text-xl font-black">{item.vehicle.brand} {item.vehicle.name}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3"><div><span className="text-xs text-slate-500">Tiempo</span><p className="text-2xl font-black">{item.finishTimeSec.toFixed(2)} s</p></div><div><span className="text-xs text-slate-500">Velocidad máxima</span><p className="text-2xl font-black">{item.topSpeedAchievedKmh.toFixed(1)} <span className="text-xs">km/h</span></p></div></div>
        </div>)}</div>
        <DetailedSpecsTable vehicles={compareCars}/>
        <RealCarsCTA/>
        <div className="flex flex-wrap gap-3"><button onClick={() => setScreen('compare-run')} className={buttonPrimary}><RotateCcw size={16}/> Ver simulación otra vez</button><button onClick={() => setScreen('compare-choose')} className={buttonSecondary}>Cambiar vehículos</button><button onClick={goHome} className={buttonSecondary}>Inicio</button></div>
      </div>}

      {screen === 'circuit-choose' && <div className="space-y-6">
        <Stepper steps={['Circuito', 'Tu auto 360°', 'Preparar', 'Correr', 'Resultados']} current={0}/>
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.25em] text-emerald-400">MODO CARRERA · ASUNCIÓN</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">ELEGÍ TU CIRCUITO.</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Cada tramo tiene una dificultad, adherencia y distribución de obstáculos distinta. Elegí qué desafío querés enfrentar.</p></div><span className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-400">6 circuitos disponibles</span></div>
        <div className="flex flex-wrap gap-2" aria-label="Filtrar circuitos por dificultad">{([['todos','Todos'],['facil','Fácil'],['medio','Intermedio'],['dificil','Difícil'],['extremo','Extremo']] as const).map(([id,label]) => <button key={id} onClick={() => chooseDifficulty(id)} aria-pressed={difficulty === id} className={`rounded-full border px-4 py-2 text-xs font-bold transition ${difficulty === id ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>{label}</button>)}</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{ASUNCION_CIRCUITS.filter(item => matchesDifficulty(item,difficulty)).map(item => {
          const chosen = item.id === circuitId;
          return <button key={item.id} onClick={() => setCircuitId(item.id)} aria-pressed={chosen} className={`${panel} overflow-hidden text-left transition hover:-translate-y-0.5 ${chosen ? 'border-emerald-400 ring-1 ring-emerald-400/30' : 'hover:border-slate-500'}`}>
            <div className="relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br from-[#152338] via-[#0e1521] to-[#080b13]">
              <div className="absolute left-1/2 top-[-20px] h-48 w-24 -translate-x-1/2 rotate-[12deg] border-x-4 border-dashed border-slate-400/30 bg-slate-800/80" />
              <MapPinned size={32} className="relative text-slate-300/80"/><span className="absolute right-3 top-3 rounded-md border border-white/20 bg-black/60 px-2 py-1 text-sm font-black" style={{color:item.sky}}>{item.difficulty.toFixed(1)}/10</span>
              {chosen && <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-bold text-slate-950"><Check size={12}/> SELECCIONADO</span>}
            </div>
            <div className="space-y-2 p-4"><p className="text-[11px] font-bold uppercase tracking-widest" style={{color:item.sky}}>{item.zone}</p><h2 className="min-h-[47px] text-lg font-black leading-tight">{item.name}</h2><p className="text-xs text-slate-400">{item.hazardLabel}</p><div className="flex items-center justify-between border-t border-slate-700/60 pt-3 text-xs"><span className="text-slate-400">{item.distanceMeters} m · Tramo temático</span><span className="font-bold text-emerald-300">{chosen ? 'Elegido' : 'Elegir'}</span></div></div>
          </button>;
        })}</div>
        <div className={`${panel} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}><div><p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">CIRCUITO SELECCIONADO</p><h3 className="mt-1 text-xl font-black">{circuit.name}</h3><p className="mt-1 text-sm italic text-slate-400">“{circuit.lore}”</p></div><button className={buttonPrimary} onClick={() => setScreen('garage')}>Elegir mi vehículo <ArrowRight size={16}/></button></div>
        <p className="text-xs text-slate-500">Ficción inspirada en nombres de calles reales; los peligros no son un diagnóstico de tránsito. La versión 3D utiliza tramos temáticos estilizados, no mapas viales exactos.</p>
      </div>}

      {screen === 'garage' && <div className="space-y-6">
        <Stepper steps={['Circuito', 'Tu auto 360°', 'Preparar', 'Correr', 'Resultados']} current={1}/>
        <div><p className="text-xs font-black uppercase tracking-[.25em] text-emerald-400">SHOWROOM 360°</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">ELEGÍ TU MÁQUINA.</h1><p className="mt-2 text-sm text-slate-400">Deslizá entre los modelos para elegir. Giralo manualmente con el mousepad antes de elegirlo. El video 360° queda como opción secundaria.</p></div>
        <div className={`${panel} p-4`}>
          <div className="flex items-center gap-3"><button className={buttonSecondary} onClick={() => rotateSelection(-1)} aria-label="Modelo anterior"><ChevronLeft size={22}/></button>
            <div className="flex min-w-0 flex-1 select-none gap-3 overflow-x-auto py-2" onTouchStart={event => { touchX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => { if (touchX.current === null) return; const delta = event.changedTouches[0]?.clientX - touchX.current; if (delta !== undefined && Math.abs(delta) > 55) rotateSelection(delta < 0 ? 1 : -1); touchX.current = null; }}>
              {allCars.map(car => <button key={car.id} onClick={() => setPlayerId(car.id)} className={`min-w-[140px] flex-1 rounded-xl border px-3 py-3 text-left transition ${car.id === playerId ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700 bg-slate-950/50'}`}><p className={`text-[10px] font-bold ${car.id === playerId ? 'text-cyan-300' : 'text-slate-400'}`}>{car.brand}</p><p className="mt-1 text-sm font-black">{car.name}</p></button>)}
            </div>
            <button className={buttonSecondary} onClick={() => rotateSelection(1)} aria-label="Modelo siguiente"><ChevronRight size={22}/></button></div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500"><span>← Deslizá modelos →</span><span className="flex items-center gap-1"><MousePointer2 size={13}/> Giro manual por defecto · Video opcional</span></div>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0"><CarShowroom3D key={playerId} vehicle={playerCar}/></div>
          <aside className="min-w-0 lg:sticky lg:top-5" aria-label="Ficha técnica del vehículo seleccionado">
            <VehicleSpecsPanel key={playerCar.id} vehicle={playerCar} context="race" />
          </aside>
        </div>
        <div className={`${panel} flex flex-wrap items-center justify-between gap-5 p-5`}><div><span className="text-xs font-bold uppercase tracking-widest text-emerald-400">TU ELECCIÓN</span><h2 className="mt-1 text-2xl font-black">{playerCar.brand} {playerCar.name}</h2><p className="mt-2 text-sm text-slate-400">{playerCar.powerHp} HP · {playerCar.torqueNm} Nm · {playerCar.weightKg} kg{playerCar.estimatedSimulationParameters ? ' (masa estimada para simulación)' : ''}</p></div><div className="flex gap-2"><button onClick={() => setScreen('circuit-choose')} className={buttonSecondary}><ArrowLeft size={16}/> Circuitos</button><button onClick={() => setScreen('briefing')} className={buttonPrimary}>Confirmar vehículo <ArrowRight size={16}/></button></div></div>
      </div>}

      {screen === 'briefing' && <div className="space-y-6">
        <Stepper steps={['Circuito', 'Tu auto 360°', 'Preparar', 'Correr', 'Resultados']} current={2}/>
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-400">PREPARAR PARTIDA</p><h1 className="mt-1 text-4xl font-black">TODO LISTO PARA LARGAR.</h1></div>
        <div className="grid gap-4 md:grid-cols-2"><div className={`${panel} p-6`}><span className="text-xs font-bold text-emerald-400">01 · CIRCUITO</span><h2 className="mt-3 text-2xl font-black">{circuit.name}</h2><p className="mt-3 text-sm text-slate-400">Dificultad {circuit.difficulty.toFixed(1)}/10 · {circuit.distanceMeters} metros</p><p className="mt-2 text-sm text-slate-400">{circuit.hazardLabel}</p><button onClick={() => setScreen('circuit-choose')} className="mt-6 text-xs font-bold text-cyan-300 underline">Cambiar circuito</button></div>
          <div className={`${panel} p-6`}><span className="text-xs font-bold text-emerald-400">02 · TU VEHÍCULO</span><h2 className="mt-3 text-2xl font-black">{playerCar.brand} {playerCar.name}</h2><p className="mt-3 text-sm text-slate-400">{playerCar.trim} · {playerCar.powerHp} HP</p><p className="mt-2 text-sm text-slate-400">2 rivales controlados por IA</p><button onClick={() => setScreen('garage')} className="mt-6 text-xs font-bold text-cyan-300 underline">Cambiar vehículo</button></div></div>
        <div className={`${panel} p-5`}>
          <h3 className="flex items-center gap-2 text-sm font-black"><CloudRain className="h-4 w-4 text-cyan-300"/> 03 · CLIMA DE LA CARRERA</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {WEATHER_OPTIONS.map(option => <button key={option.id} type="button" onClick={() => setRaceWeather(option.id)} aria-pressed={raceWeather === option.id}
              className={`rounded-lg border px-3 py-2 text-xs font-bold ${raceWeather === option.id ? 'border-cyan-300 bg-cyan-500/20 text-cyan-200' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>{option.label}</button>)}
          </div>
          <p className="mt-2 text-xs text-slate-400">La lluvia reduce adherencia y alarga frenadas. En Raudales el agua puede arrastrar lateralmente el auto. Simulación ficticia, no datos climáticos reales.</p>
        </div>
        <div className={`${panel} p-5`}><h3 className="flex items-center gap-2 text-sm font-black"><ShieldAlert className="h-4 w-4 text-amber-400"/> MECÁNICA DE LA PARTIDA</h3><p className="mt-3 text-sm leading-relaxed text-slate-400">Acelerá con ↑ o W. Con ↓ o S frenás y, cuando el auto se detiene, activás la marcha atrás para salir de un choque. Espacio es el freno independiente. Doblá con ← y →. Los choques y baches afectan la velocidad; los rivales automáticos intentan evitarlos. La cámara por defecto sigue tu auto desde atrás en tercera persona; podés pasar a cámara libre. Director TV se habilita únicamente en la repetición.</p></div>
        <button onClick={startRace} className={`${buttonPrimary} w-full py-4 text-lg`}><FlagTriangleRight size={21}/> ¡EMPEZAR CARRERA!</button>
      </div>}

      {screen === 'race-run' && <div className="space-y-5">
        <Stepper steps={['Circuito', 'Tu auto 360°', 'Preparar', 'Correr', 'Resultados']} current={3}/>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-400">MODO CARRERA · CONDUCCIÓN EN VIVO</p><h1 className="mt-1 text-3xl font-black">{circuit.name}</h1><p className="mt-1 text-sm text-slate-400">Vos: {playerCar.brand} {playerCar.name} · IA: otros dos vehículos</p></div><button onClick={() => setScreen('briefing')} className={buttonSecondary}><ArrowLeft size={16}/> Abandonar partida</button></div>
        <Race3DPerspectiveView key={`race-${circuitId}-${playerId}`} experience="race" playerVehicleId={playerId} initialWeather={raceWeather} vehicles={raceCars} track={raceTrack} simulationResults={raceBaseResults} onFinishRace={(results, hazards, weather) => { setRaceResults(results || null); setRaceHazards(hazards || []); setReplayWeather(weather || 'sunny'); setScreen('race-results'); }}/>
        <p className="text-xs text-slate-500">Física jugable aproximada: agarre, aceleración, frenada y colisiones cambian el resultado. Los trazados urbanos son recreaciones ficticias.</p>
      </div>}

      {screen === 'race-results' && <div className="space-y-6">
        <Stepper steps={['Circuito', 'Tu auto 360°', 'Preparar', 'Correr', 'Resultados']} current={4}/>
        <div><p className="text-xs font-black uppercase tracking-widest text-amber-400">CARRERA FINALIZADA</p><h1 className="mt-1 text-4xl font-black">RESULTADOS DE LA CARRERA.</h1><p className="mt-2 text-sm text-slate-400">{circuit.name} · Los tiempos reflejan la conducción y los incidentes de la partida.</p></div>
        {podium && (() => {
          // Protagonista siempre el vehículo del jugador, no el ganador ajeno.
          const result = podium.find(item => item.vehicle.id === playerId);
          const hero = result?.vehicle ?? playerCar;
          return <section className={`${panel} relative overflow-hidden border-cyan-400/30 p-4 sm:p-6`} aria-label="Tu vehículo al finalizar la carrera">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_24%_55%,rgba(6,182,212,.16),transparent_58%)]" />
            <div className="relative grid items-center gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(220px,.75fr)]">
              <div className="relative flex min-h-[205px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-800/75 via-slate-950 to-slate-900 sm:min-h-[275px]">
                <img src={getPreviewUrl(hero.id)} alt={`${hero.brand} ${hero.name} — vehículo elegido para tu carrera`}
                  className="max-h-[305px] w-full object-contain object-center drop-shadow-[0_18px_20px_rgba(0,0,0,.42)]" />
                <span className="absolute bottom-3 left-3 rounded-md border border-cyan-400/25 bg-slate-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-300">TU AUTO · DATACAR ARENA</span>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[.22em] text-cyan-300">TU LLEGADA</p>
                <h2 className="mt-2 text-2xl font-black uppercase leading-tight tracking-tight text-white sm:text-3xl">{hero.brand} {hero.name}</h2>
                <p className="mt-1 text-sm text-slate-400">{hero.trim || 'Versión seleccionada'}</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">Posición</div><div className="mt-1 text-2xl font-black text-amber-300">{result?.isDnf ? 'DNF' : result ? `P${result.finishPosition}` : '—'}</div></div>
                  <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">Tiempo</div><div className="mt-1 text-2xl font-black text-white tabular-nums">{result && !result.isDnf ? `${result.finishTimeSec.toFixed(2)}s` : '—'}</div></div>
                  <div className="col-span-2 rounded-lg border border-slate-700 bg-slate-950/70 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">Velocidad máxima de la carrera</div><div className="mt-1 text-xl font-black text-cyan-300 tabular-nums">{result ? result.topSpeedAchievedKmh.toFixed(1) : '—'} <span className="text-xs font-semibold text-slate-400">km/h</span></div></div>
                </div>
              </div>
            </div>
          </section>;
        })()}
        {podium && <DrivingIQResults results={podium} assessments={drivingAssessments} playerId={playerId} />}
        {!podium ? <div className={`${panel} p-8`}><p>No hay resultados registrados todavía. Podés volver a correr.</p></div> : <div className="space-y-3">{podium.map(item => <div key={item.vehicle.id} className={`${panel} flex flex-wrap items-center gap-4 p-4 ${item.vehicle.id === playerId ? 'border-emerald-400/70' : ''}`}>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-2xl font-black text-amber-300">{item.finishPosition}</div><img className="h-16 w-28 object-contain" src={getPreviewUrl(item.vehicle.id)} alt=""/><div className="min-w-[170px] flex-1"><p className="font-black">{item.vehicle.brand} {item.vehicle.name} {item.vehicle.id === playerId && <span className="ml-1 text-xs text-emerald-300">(VOS)</span>}</p><p className="mt-1 text-xs text-slate-400">{item.isDnf ? 'No completó la prueba' : `${item.finishTimeSec.toFixed(2)} segundos`} · punta {item.topSpeedAchievedKmh.toFixed(1)} km/h</p></div></div>)}</div>}
        <div className={`${panel} border-amber-400/20 p-6`}><div className="flex items-center gap-2"><Clapperboard className="text-amber-400"/><h2 className="text-xl font-black">REPETICIÓN · DIRECTOR TV</h2></div><p className="mt-2 max-w-xl text-sm text-slate-400">Reviví esta misma carrera con cámaras cinematográficas, adelantamientos, planos laterales y la llegada de frente. No se vuelve a calcular el resultado.</p><button disabled={!podium} onClick={() => setScreen('replay')} className={`${buttonPrimary} mt-5`}><Play size={16}/> Ver repetición</button></div>
        <RealCarsCTA/>
        <div className="flex flex-wrap gap-3"><button onClick={startRace} className={buttonSecondary}><RotateCcw size={16}/> Volver a correr</button><button onClick={() => setScreen('circuit-choose')} className={buttonSecondary}>Elegir otro circuito</button><button onClick={goHome} className={buttonSecondary}>Inicio</button></div>
      </div>}

      {screen === 'replay' && raceResults && <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400"><Clapperboard size={16}/> REPETICIÓN EXCLUSIVA · DIRECTOR TV</p><h1 className="mt-1 text-3xl font-black">ASÍ FUE TU CARRERA.</h1><p className="mt-2 text-sm text-slate-400">Se muestran las trayectorias que quedaron registradas durante la partida.</p></div><button onClick={() => setScreen('race-results')} className={buttonSecondary}><ArrowLeft size={16}/> Resultados</button></div>
        <Race3DPerspectiveView key={`replay-${circuitId}-${playerId}`} experience="replay" playerVehicleId={playerId} vehicles={raceCars} track={raceTrack} simulationResults={raceResults} replayHazards={raceHazards} replayWeather={replayWeather} onFinishRace={() => {}} />
        <RealCarsCTA/>
        <div className="flex gap-3"><button onClick={() => setScreen('race-results')} className={buttonPrimary}><Trophy size={16}/> Volver al podio</button><button onClick={startRace} className={buttonSecondary}><RotateCcw size={16}/> Nueva carrera</button></div>
      </div>}
    </main>
    <footer className="relative z-10 border-t border-slate-800 bg-slate-950/80 px-5 py-6 text-center text-xs leading-relaxed text-slate-500">DATACAR ARENA V9.5 · Prototipo interactivo · Las condiciones de los circuitos son ficticias e inspiradas en Asunción, no información actual sobre el estado de sus calles. Los resultados técnicos son referenciales; algunos parámetros del Corolla Cross son estimados para la simulación. · <a className="font-bold text-cyan-400 underline" href="https://datacarpy.com" target="_blank" rel="noreferrer">datacarpy.com</a></footer>
  </div>;
}

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft, ArrowRight, Award, Check, ChevronLeft, ChevronRight,
  Compass, Gauge, Globe, Lock, Maximize2, PlusCircle, RotateCcw,
  ShieldCheck, Smartphone, Trophy, UserCheck, X, Bell, Settings,
  FileText, ChevronsRight, Warehouse, Car, Tag, Disc, Timer, Zap
} from 'lucide-react';
import type {Vehicle, VehicleRaceResult} from '../../types/vehicle';
import {PRESET_VEHICLES, PRESET_TRACKS, getOfficialVehicleImageUrl} from '../../data/presetVehicles';
import {ASUNCION_CIRCUITS, toRaceTrack} from '../../data/asuncionCircuits';
import {simulateFullRace} from '../../utils/physicsEngine';
import type {TrackHazard} from '../../utils/interactiveRacePhysics';
import {WEATHER_OPTIONS, type WeatherMode} from '../../utils/weatherDynamics';
import {Race3DPerspectiveView} from '../Race3DPerspectiveView';
import {Photographic360Viewer} from '../Photographic360Viewer';
import {DrivingIQResults} from '../DrivingIQResults';
import {soundEngine} from '../../utils/soundEngine';
import {rankDrivingIQ} from '../../utils/drivingIQ';
import {resolveDedicatedVehicleGLTF} from '../../utils/vehicle3DModelLoader';
import {ArcadeBriefingStage, ArcadeResultsStage, CircuitWireframeSVG} from '../ArcadeBriefingAndResults';
import {ArenaHero3DStage} from '../ArenaHero3DStage';
import {
  evaluateCityTrialCompletion,
  formatJailCountdown,
  isPlayerCurrentlyJailed,
  useCareerProgression,
  type RaceModeId,
} from '../../utils/careerProgression';
import {multiplayerClient, type OnlineRoomSnapshot} from '../../utils/multiplayerClient';
import {JailLockoutModal} from '../JailLockoutModal';
import {OnlineLobbyModal} from '../OnlineLobbyModal';
import {CustomVehicleModal} from '../CustomVehicleModal';
import {DatacarAccountModal} from '../DatacarAccountModal';
import {RankingModal} from '../RankingModal';
import {PayloadSelector} from '../PayloadSelector';
import {
  CUSTOM_VEHICLE_ID,
  hydrateCustomGlbFromIndexedDb,
  useCustomVehicle,
} from '../../utils/customVehicleStore';
import {useDatacarAccount} from '../../utils/datacarAccount';
import {
  clampPayloadSelection,
  computePayloadKg,
  DEFAULT_PAYLOAD_SELECTION,
  type VehiclePayloadSelection,
} from '../../utils/payloadConfig';
import {
  evaluateCircuitTimeResult,
  formatTargetMinutesSec,
  getCircuitTargetTime,
} from '../../utils/circuitTargetTimes';
import {submitCircuitRun} from '../../utils/rankingStore';
import {
  ArenaBrandEmblem,
  ArenaCenterLogo,
  ArenaCircuitsIcon,
  ArenaCompareIcon,
  ArenaCrownTitle,
  ArenaGarageIcon,
  ArenaPilotHelmetAvatar,
  ArenaRunChevronsIcon,
  ArenaSectionBackdrop,
  formatArenaVehicleCardData,
} from '../ArenaVisualKit';
import {TireShowroomSection} from '../TireShowroomSection';
import {
  formatOfficialBraking,
  formatOfficialClearance,
  formatOfficialConsumption,
  formatOfficialFuelCapacity,
  formatOfficialOrSimAccel,
  formatOfficialPower,
  formatOfficialPriceUsd,
  formatOfficialTopSpeed,
  formatOfficialTorque,
  formatOfficialWeight,
  formatShortTransmission,
  getVerifiedVehicleSummary,
  NOT_SPECIFIED_LABEL,
} from '../../utils/specFidelity';

type Stage='loading'|'home'|'circuits'|'garage'|'briefing'|'race'|'results'|'replay'|'compare'|'compare-results';
type Props={initialPlayerId?:string;forceArcadeMode?:boolean;onExitArcadeMode?:()=>void};
const preview=(car:Vehicle)=>car.imageUrl||getOfficialVehicleImageUrl(car.id);

const getVehicleDesc=(v:Vehicle)=>getVerifiedVehicleSummary(v);
const getVehiclePrice=(v:Vehicle)=>formatOfficialPriceUsd(v);
const getTransmissionShort=(v:Vehicle)=>formatShortTransmission(v);



/** Carrusel con snap real; pointer drag nativo táctil, navegación accesible y sincronización de selección. */
function SwipeDeck<T extends {id:string}>({items, selectedId, onSelect, renderItem, label}: {items:T[];selectedId:string;onSelect:(id:string)=>void;renderItem:(item:T,active:boolean,index:number)=>React.ReactNode;label:string}) {
  const scrollRef=useRef<HTMLDivElement>(null);
  const selectedRef=useRef(onSelect);
  selectedRef.current=onSelect;
  const slideRefs=useRef(new Map<string,HTMLDivElement>());
  const programmaticRef=useRef(false);
  const scrollToId=useCallback((id:string,behavior:ScrollBehavior='smooth')=>{
    const el=slideRefs.current.get(id);
    const list=scrollRef.current;
    if(!el || !list) return;
    programmaticRef.current=true;
    list.scrollTo({left:el.offsetLeft-(list.clientWidth-el.clientWidth)/2,behavior});
    window.setTimeout(()=>{programmaticRef.current=false;},behavior==='instant'?50:360);
  },[]);
  useEffect(()=>{scrollToId(selectedId,'instant');},[scrollToId]);
  const idx=Math.max(0,items.findIndex(item=>item.id===selectedId));
  const move=(offset:number)=>{const next=items[Math.min(items.length-1,Math.max(0,idx+offset))];if(next){onSelect(next.id);scrollToId(next.id);}};
  const onScroll=()=>{
    if(programmaticRef.current) return;
    const list=scrollRef.current;if(!list)return;
    const center=list.scrollLeft+list.clientWidth/2;
    const item=items.reduce<{id:string;distance:number}|null>((best,current)=>{
      const node=slideRefs.current.get(current.id);if(!node)return best;
      const distance=Math.abs(node.offsetLeft+node.offsetWidth/2-center);
      return !best || distance<best.distance?{id:current.id,distance}:best;
    },null);
    if(item && item.id!==selectedId)selectedRef.current(item.id);
  };
  return <div className="dc99-deck" aria-label={label}>
    <button className="dc99-deck-arrow" onClick={()=>move(-1)} disabled={idx===0} aria-label="Anterior"><ChevronLeft/></button>
    <div className="dc99-snap-row" ref={scrollRef} onScroll={onScroll}>
      {items.map((item,i)=><div className={`dc99-snap-slide ${item.id===selectedId?'dc99-active':''}`} key={item.id} ref={el=>{if(el)slideRefs.current.set(item.id,el);else slideRefs.current.delete(item.id);}} onClick={()=>{onSelect(item.id);scrollToId(item.id);}}>
        {renderItem(item,item.id===selectedId,i)}
      </div>)}
    </div>
    <button className="dc99-deck-arrow" onClick={()=>move(1)} disabled={idx===items.length-1} aria-label="Siguiente"><ChevronRight/></button>
    <div className="dc99-deck-dots">{items.map((item,i)=><button key={item.id} aria-label={`Elegir opción ${i+1}`} aria-current={item.id===selectedId?'true':undefined} onClick={()=>{onSelect(item.id);scrollToId(item.id);}} className={item.id===selectedId?'selected':''}/>)}</div>
  </div>;
}

/** Gráfica compacta de telemetría real de la carrera; sin recalcular resultados. */
function MobileTelemetryChart({result}:{result:VehicleRaceResult}){
  const [metric,setMetric]=useState<'speedKmh'|'rpm'|'accelerationG'>('speedKmh');
  const history=result.telemetryHistory??[];
  const samples=useMemo(()=>history.filter((_,i)=>i%Math.max(1,Math.ceil(history.length/140))===0),[history]);
  if(samples.length<2)return <p className="dc11-no-telemetry">Sin muestras de telemetría para graficar.</p>;
  const ys=samples.map(sample=>Number(sample[metric])||0);
  const low=Math.min(...ys),high=Math.max(...ys),span=Math.max(.001,high-low);
  const duration=Math.max(.001,samples[samples.length-1].timeSec-samples[0].timeSec);
  const points=samples.map((sample,i)=>`${(10+(sample.timeSec-samples[0].timeSec)/duration*480).toFixed(1)},${(90-(ys[i]-low)/span*77).toFixed(1)}`).join(' ');
  return <div className="dc11-telemetry-chart"><div className="dc11-chart-options"><strong>TELEMETRÍA VIRTUAL</strong>{([['speedKmh','Velocidad'],['rpm','RPM'],['accelerationG','Aceleración G']] as const).map(([id,label])=><button key={id} className={metric===id?'active':''} onClick={()=>setMetric(id)}>{label}</button>)}</div><svg role="img" aria-label={`Evolución de ${metric} durante la carrera`} viewBox="0 0 500 100" preserveAspectRatio="none"><path d="M 10 12 V 90 H 490" fill="none" stroke="#466478" strokeWidth="1.4"/><polyline points={points} fill="none" stroke="#4cdef6" strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round"/></svg><div className="dc11-chart-labels"><span>0 s</span><span>Máx. {high.toFixed(metric==='accelerationG'?2:0)}</span><span>{samples[samples.length-1].timeSec.toFixed(1)} s</span></div></div>;
}

export default function MobileGameExperience({initialPlayerId,forceArcadeMode=false,onExitArcadeMode}:Props){
  const [stage,setStage]=useState<Stage>('loading');
  const [loadPercent,setLoadPercent]=useState(0);
  const [loadLabel,setLoadLabel]=useState('Preparando DATACAR ARENA');
  const [loadError,setLoadError]=useState<string|null>(null);
  const [loadingMode,setLoadingMode]=useState<'boot'|'race'>('boot');
  const loadingSequence=useRef(0);
  const [playerId,setPlayerId]=useState(initialPlayerId??PRESET_VEHICLES[0].id);
  const [homeIndex,setHomeIndex]=useState(()=>{
    const idx=initialPlayerId?PRESET_VEHICLES.findIndex(v=>v.id===initialPlayerId):-1;
    return idx>=0?idx:0;
  });
  const {customInput,customVehicle,saveCustom,clearCustom}=useCustomVehicle();
  const {account,isMember}=useDatacarAccount();
  const allCars=useMemo(()=>customVehicle?[...PRESET_VEHICLES,customVehicle]:PRESET_VEHICLES,[customVehicle]);
  const allCarsRef=useRef(allCars);
  allCarsRef.current=allCars;
  const [payloadSelection,setPayloadSelection]=useState<VehiclePayloadSelection>(DEFAULT_PAYLOAD_SELECTION);
  const [showCustomCarModal,setShowCustomCarModal]=useState(false);
  const [showAccountModal,setShowAccountModal]=useState(false);
  const [showRankingModal,setShowRankingModal]=useState(false);
  const [showroomCarId,setShowroomCarId]=useState<string|null>(null);
  const [compareSimulation,setCompareSimulation]=useState(false);
  const [compareFocusId,setCompareFocusId]=useState(PRESET_VEHICLES[0].id);
  const compareTracks=useMemo(()=>PRESET_TRACKS.filter(t=>t.distanceMeters<=3500),[]);
  const [compareTrackIndex,setCompareTrackIndex]=useState(0);
  const [circuitId,setCircuitId]=useState('oliva');
  const [raceLaps,setRaceLaps]=useState<number>(2);
  const [raceMode,setRaceMode]=useState<RaceModeId>('city_trial');
  const [onlineSession,setOnlineSession]=useState(false);
  const [showOnlineLobby,setShowOnlineLobby]=useState(false);
  const [speedModeNewlyUnlocked,setSpeedModeNewlyUnlocked]=useState(false);
  const [jailAcknowledged,setJailAcknowledged]=useState(()=>!isPlayerCurrentlyJailed());
  const progression=useCareerProgression();
  const initialQuery=useMemo(()=>typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search),[]);
  const [weather,setWeather]=useState<WeatherMode>(()=>{
    const reqW=initialQuery.get('weather') as WeatherMode|null;
    return reqW&&WEATHER_OPTIONS.some(w=>w.id===reqW)?reqW:'sunny';
  });
  const [completedWeather,setCompletedWeather]=useState<WeatherMode>('sunny');
  const [results,setResults]=useState<VehicleRaceResult[]|null>(null);
  const [hazards,setHazards]=useState<TrackHazard[]>([]);
  const [compareIds,setCompareIds]=useState<string[]>(PRESET_VEHICLES.slice(0,2).map(c=>c.id));
  const [showInfo,setShowInfo]=useState(false);
  const [showShowroom,setShowShowroom]=useState(false);
  const [showroomMode,setShowroomMode]=useState<'image'|'glb3d'|'frames'>('frames');
  const [showroomAllow3D,setShowroomAllow3D]=useState(false);
  const [showSpecs,setShowSpecs]=useState(false);
  const [showAllResults,setShowAllResults]=useState(false);
  const [landscape,setLandscape]=useState(()=>window.matchMedia('(orientation: landscape)').matches);
  const [portraitDismissed,setPortraitDismissed]=useState(()=>initialQuery.get('autostart')==='1');
  const [showRotateHint,setShowRotateHint]=useState(true);
  const [fullscreenError,setFullscreenError]=useState(false);
  const [raceSession,setRaceSession]=useState(0);
  const rootRef=useRef<HTMLElement>(null);
  useEffect(()=>{if(progression.isJailed)setJailAcknowledged(false);},[progression.isJailed]);
  useEffect(()=>{
    if(account?.pilotName){multiplayerClient.setPilotName(account.pilotName,isMember);}
  },[account?.pilotName,isMember]);
  useEffect(()=>{
    if(!allCars.some(v=>v.id===playerId))setPlayerId(PRESET_VEHICLES[0].id);
    if(!allCars.some(v=>v.id===compareFocusId))setCompareFocusId(PRESET_VEHICLES[0].id);
    setCompareIds(prev=>{const filtered=prev.filter(id=>allCars.some(v=>v.id===id));return filtered.length===prev.length?prev:filtered;});
  },[allCars,playerId,compareFocusId]);
  useEffect(()=>{
    const mq=window.matchMedia('(orientation: landscape)');
    const update=()=>setLandscape(mq.matches);
    mq.addEventListener?.('change',update);window.addEventListener('orientationchange',update);
    return ()=>{mq.removeEventListener?.('change',update);window.removeEventListener('orientationchange',update);};
  },[]);
  const enterGame=async()=>{
    setFullscreenError(false);
    try{
      const el = rootRef.current || document.documentElement;
      if(!document.fullscreenElement && el?.requestFullscreen) {
        await el.requestFullscreen({navigationUI:'hide'});
      }
    }catch{setFullscreenError(true);}
    try{
      const orientation=screen.orientation as ScreenOrientation & {lock?:(orientation:string)=>Promise<void>};
      if (orientation?.lock) {
        await orientation.lock('landscape');
      }
    }catch{setFullscreenError(true);}
    setShowRotateHint(false);
  };
  const car=allCars.find(v=>v.id===playerId)??allCars[0];
  const safeHomeIdx=allCars.length?homeIndex%allCars.length:0;
  const featuredCar=allCars[safeHomeIdx]??car;
  const showroomCar=allCars.find(v=>v.id===showroomCarId)??car;
  const showVehicle=(id:string)=>{setShowroomCarId(id);setShowroomAllow3D(false);setShowroomMode('frames');setShowShowroom(true);};
  const openCompareShowroom=(id:string,initial:'image'|'glb3d'|'frames'='glb3d')=>{setShowroomCarId(id);setShowroomAllow3D(true);setShowroomMode(initial);setShowShowroom(true);};
  useEffect(()=>{setPayloadSelection(prev=>{const clamped=clampPayloadSelection(prev,car);return clamped.occupants===prev.occupants&&clamped.luggageTier===prev.luggageTier?prev:clamped;});},[car.id,car.equipment.seatingCapacity]);
  const playerPayloadKg=useMemo(()=>computePayloadKg(payloadSelection,car),[payloadSelection,car]);
  const circuit=ASUNCION_CIRCUITS.find(c=>c.id===circuitId)??ASUNCION_CIRCUITS[0];
  const track=useMemo(()=>toRaceTrack(circuit,raceLaps),[circuit,raceLaps]);
  const rivalCount=raceMode==='speed_pro'?4:2;
  const raceCars=useMemo(()=>[car,...allCars.filter(v=>v.id!==car.id).slice(0,rivalCount)],[car,allCars,rivalCount]);
  const baseResults=useMemo(()=>simulateFullRace(raceCars,track),[raceCars,track]);
  const podium=useMemo(()=>results?.slice().sort((a,b)=>a.finishPosition-b.finishPosition)??[],[results]);
  const insights=useMemo(()=>results?rankDrivingIQ(results,baseResults,track.distanceMeters):[],[results,baseResults,track]);
  // Carga real (sin porcentaje simulado): cada recurso se da por preparado
  // solo cuando terminó de descargarse/decodificarse; GLB se guarda en la caché del motor.
  const warmup=useCallback(async(mode:'boot'|'race', cars:Vehicle[]=[])=>{
    const token=++loadingSequence.current;
    setLoadingMode(mode);setLoadError(null);setLoadPercent(0);setStage('loading');
    const update=(amount:number,label:string)=>{if(token!==loadingSequence.current)return;setLoadPercent(Math.round(amount));setLoadLabel(label);};
    try {
      if(mode==='boot'){
        await hydrateCustomGlbFromIndexedDb().catch(()=>null);
        const urls=Array.from(new Set(allCarsRef.current.map(v=>preview(v))));
        let done=0;
        await Promise.all(urls.map(src=>new Promise<void>(resolve=>{
          const image=new Image();
          image.onload=image.onerror=()=>{done++;update(done/Math.max(1,urls.length)*100,'Preparando imágenes del garage');resolve();};
          image.src=src;
          if(image.complete){/* load/error se entregan por el navegador */}
        })));
      } else {
        await hydrateCustomGlbFromIndexedDb().catch(()=>null);
        const carIds=Array.from(new Set(cars.map(v=>v.id)));
        const fractions=new Map(carIds.map(id=>[id,0]));
        const updateModel=(id:string,part:number)=>{fractions.set(id,part);update(100*Array.from(fractions.values()).reduce((a,b)=>a+b,0)/Math.max(1,carIds.length),'Cargando vehículos 3D');};
        if(!carIds.length)update(100,'Preparando pista');
        await Promise.all(carIds.map(async id=>{
          try {
            await resolveDedicatedVehicleGLTF(id,(bytes,total)=>{if(total>0)updateModel(id,Math.min(.97,bytes/total*.97));});
          } catch {
            // Si no posee GLB dedicado, vehicle3DEntity construye su carrocería OEM 3D fiel
          }
          updateModel(id,1);
        }));
      }
      if(token!==loadingSequence.current)return;
      setLoadPercent(100);setLoadLabel(mode==='boot'?'Juego listo':'Vehículos listos · Preparando carrera');
      if(mode==='boot')setStage('home');
      else {setResults(null);setHazards([]);setRaceSession(n=>n+1);setStage('race');}
    } catch(err){
      if(token!==loadingSequence.current)return;
      setLoadError(err instanceof Error?err.message:'No se pudo cargar un recurso');
    }
  },[]);
  useEffect(()=>{
    if(initialQuery.get('autostart')==='1' && !isPlayerCurrentlyJailed()){
      const reqCircuit=initialQuery.get('circuit');
      if(reqCircuit && ASUNCION_CIRCUITS.some(c=>c.id===reqCircuit))setCircuitId(reqCircuit);
      else setCircuitId('aviadores');
      void warmup('race',[car]);
    } else {
      void warmup('boot');
    }
    return ()=>{loadingSequence.current++;};
  },[warmup]);
  const beginRace=()=>{if(isPlayerCurrentlyJailed()){setJailAcknowledged(false);return;}setOnlineSession(false);setSpeedModeNewlyUnlocked(false);setShowShowroom(false);setShowSpecs(false);soundEngine.unlock();void enterGame();void warmup('race',[car]);};
  const handleOnlineMatchReady=(room:OnlineRoomSnapshot)=>{
    if(isPlayerCurrentlyJailed()){setShowOnlineLobby(false);setJailAcknowledged(false);return;}
    setShowOnlineLobby(false);
    if(ASUNCION_CIRCUITS.some(c=>c.id===room.circuitId))setCircuitId(room.circuitId);
    setRaceLaps(Math.max(1,Math.min(3,room.laps)));
    setRaceMode(room.mode==='speed_pro'&&progression.speedModeUnlocked?'speed_pro':'city_trial');
    setOnlineSession(true);
    setSpeedModeNewlyUnlocked(false);
    soundEngine.unlock();
    void enterGame();
    void warmup('race',[car]);
  };
  const nextFromHome=()=>{setPlayerId(featuredCar.id);void enterGame();setStage('circuits');};
  const toggleCompare=(id:string)=>setCompareIds(list=>list.includes(id)?list.filter(x=>x!==id):list.length===2?[list[1],id]:[...list,id]);
  const compareCars=compareIds.map(id=>allCars.find(v=>v.id===id)).filter((v):v is Vehicle=>Boolean(v));
  const compareTrack=compareTracks[compareTrackIndex]??compareTracks[0]??PRESET_TRACKS[0];
  const compareResults=useMemo(()=>compareCars.length===2?simulateFullRace(compareCars,compareTrack):[],[compareCars,compareTrack]);
  const [briefingPercent,setBriefingPercent]=useState(72);
  useEffect(()=>{
    if(stage!=='briefing') return;
    let cancelled=false;
    setBriefingPercent(24);
    const carIds=[car.id];
    const fractions=new Map(carIds.map(id=>[id,0]));
    const sync=()=>{
      if(cancelled) return;
      const avg=carIds.length?Array.from(fractions.values()).reduce((a,b)=>a+b,0)/carIds.length:1;
      setBriefingPercent(Math.max(32,Math.round(avg*100)));
    };
    void Promise.all(carIds.map(async id=>{
      try{
        await resolveDedicatedVehicleGLTF(id,(bytes,total)=>{if(total>0){fractions.set(id,Math.min(0.95,(bytes/total)*0.95));sync();}});
      }catch{
        // Rescate manejado en warmup('race')
      }
      fractions.set(id,1);
      sync();
    })).then(()=>{if(!cancelled)setBriefingPercent(100);});
    return ()=>{cancelled=true;};
  },[stage,car.id]);

  return <section ref={rootRef} className={`dc99-game ${forceArcadeMode?'dc-force-arcade':''} ${portraitDismissed?'dc99-allow-portrait':''} ${stage==='race'||stage==='replay'?'dc99-in-race':''}`} aria-label="DATACAR ARENA para celular">
    {!landscape && !forceArcadeMode && !portraitDismissed && <div className="dc99-rotate" role="dialog" aria-label="Girar celular">
      <div className="dc99-rotate-icon animate-pulse"><Smartphone size={54} className="rotate-90 transition-transform duration-700"/><RotateCcw size={29}/></div>
      <div className="dc99-logo">DATA<span>CAR</span> <strong>ARENA</strong></div>
      <h1>GIRÁ TU CELULAR</h1>
      <p>DATACAR ARENA se disfruta al máximo en horizontal, pero también podés continuar en vertical sin bloqueos.</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full max-w-xs">
        <button type="button" className="dc99-primary w-full" onClick={enterGame}><Maximize2 size={18}/> GIRAR AHORA (HORIZONTAL)</button>
        <button type="button" className="dc99-secondary w-full" onClick={()=>setPortraitDismissed(true)}>CONTINUAR EN VERTICAL</button>
      </div>
      {fullscreenError&&<small>Si no gira automáticamente, activá la rotación automática o pulsá Continuar en vertical.</small>}
      {showRotateHint && null}
    </div>}
    <div className="dc99-world" aria-hidden="true">
      {stage !== 'race' && stage !== 'replay' && stage !== 'home' && <ArenaSectionBackdrop />}
      <div className="dc99-world-grid opacity-30"/>
    </div>
    {stage!=='race' && stage!=='replay' && <header className="dc-arena-header flex items-center justify-between gap-2 px-2.5 sm:px-4 md:px-6 py-1.5 md:py-2 z-30 select-none relative shrink-0">
      {/* Pilot Avatar & Level */}
      <div className="flex items-center gap-2 min-w-0">
        {stage!=='home' && stage!=='loading' && <button className="relative z-20 w-8 h-8 rounded-lg bg-[#102C38]/90 border border-[#00E5F5]/45 text-[#00E5F5] flex items-center justify-center hover:bg-[#00E5F5]/20 active:scale-95 transition-all mr-0.5 shrink-0" aria-label="Volver" onClick={()=>setStage(stage==='circuits'?'home':stage==='garage'?'home':stage==='briefing'?'circuits':stage==='results'?'home':stage==='compare-results'?'compare':'home')}><ArrowLeft size={16}/></button>}
        <ArenaPilotHelmetAvatar className="w-8 h-8 md:w-10 md:h-10 shrink-0" />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-display text-xs md:text-base font-extrabold text-[#F3F7FC] tracking-wide truncate max-w-[78px] sm:max-w-none">{account?.pilotName || 'PilotoDC'}</span>
            <span className="hidden xs:inline-block sm:inline-block px-1.5 py-0.5 text-[9px] md:text-[10px] font-black uppercase text-[#04131A] bg-[#00E5F5] shrink-0" style={{clipPath:'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)'}}>{isMember?'DATACARPY':'NIVEL 12'}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 mt-1">
            <div className="w-16 md:w-28 h-1.5 bg-[#091A24] rounded-xs overflow-hidden border border-[#00E5F5]/30 p-[1px]">
              <div className="w-[78.5%] h-full bg-gradient-to-r from-[#00B4D8] to-[#00E5F5] shadow-[0_0_6px_rgba(0,229,245,0.85)]" />
            </div>
            <span className="hidden md:inline font-mono text-[9px] text-slate-300">7.850 / 10.000 XP</span>
          </div>
        </div>
      </div>

      {/* Official DATACAR ARENA Metallic Emblem — hidden on narrow portrait (<640px) so it never covers Volver or utility buttons */}
      <div className="hidden sm:flex items-center justify-center pointer-events-none shrink-0">
        <ArenaCenterLogo compact />
      </div>

      {/* Ranking + DATACARPY Account + Bell + Online + Settings (+ Exit Desktop Arcade) */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
        {progression.isJailed && jailAcknowledged && (
          <button
            type="button"
            onClick={()=>setJailAcknowledged(false)}
            className="px-2 py-1 rounded-md border border-rose-500/75 bg-rose-950/90 text-[10px] font-mono font-black text-rose-200 tabular-nums animate-pulse cursor-pointer whitespace-nowrap"
            title="Ver bloqueo temporal"
          >
            CÁRCEL {formatJailCountdown(progression.jailRemainingSec)}
          </button>
        )}
        {onExitArcadeMode && (
          <button
            type="button"
            onClick={onExitArcadeMode}
            className="px-2 py-1 rounded-md bg-[#102C38]/90 border border-[#00E5F5]/45 text-[10px] md:text-xs font-bold text-[#00E5F5] hover:border-[#00E5F5] hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Vista Clásica
          </button>
        )}
        <button className="dc-arena-util-btn !w-8 !h-8 sm:!w-9 shrink-0" onClick={()=>setShowRankingModal(true)} aria-label="Ranking por circuito" title="Ranking por circuito">
          <Trophy size={14}/>
        </button>
        <button className="dc-arena-util-btn !w-8 !h-8 sm:!w-9 shrink-0" onClick={()=>setShowAccountModal(true)} aria-label="Cuenta DATACARPY" title="Cuenta DATACARPY">
          <UserCheck size={14} className={isMember?'text-amber-300':undefined}/>
        </button>
        <button className="dc-arena-util-btn !w-8 !h-8 sm:!w-9 shrink-0" onClick={()=>setShowInfo(true)} aria-label="Notificaciones">
          <div className="relative flex items-center justify-center">
            <Bell size={14}/>
            <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-[#FFAA12] ring-1 ring-[#061219]" />
          </div>
        </button>
        <button className="dc-arena-util-btn !w-8 !h-8 sm:!w-9 shrink-0" onClick={()=>{if(isPlayerCurrentlyJailed()){setJailAcknowledged(false);return;}setShowOnlineLobby(true);}} aria-label="Jugar en línea" title="Jugar en línea">
          <Globe size={14}/>
        </button>
        <button className="dc-arena-util-btn !w-8 !h-8 sm:!w-9 shrink-0" onClick={enterGame} aria-label="Ajustes">
          <Settings size={14}/>
        </button>
      </div>
    </header>}

    {!jailAcknowledged && (
      <JailLockoutModal
        remainingSec={progression.jailRemainingSec}
        incidentCircuit={progression.lastJailReasonCircuit}
        onAcknowledgeRelease={()=>setJailAcknowledged(true)}
        onExploreWhileLocked={()=>setJailAcknowledged(true)}
      />
    )}

    <OnlineLobbyModal
      isOpen={showOnlineLobby}
      onClose={()=>setShowOnlineLobby(false)}
      selectedCar={car}
      selectedCircuit={circuit}
      laps={raceLaps}
      raceMode={raceMode}
      speedModeUnlocked={progression.speedModeUnlocked}
      onSelectRaceMode={m=>{if(m==='speed_pro'&&!progression.speedModeUnlocked)return;setRaceMode(m);}}
      onMatchReady={handleOnlineMatchReady}
    />

    <CustomVehicleModal
      key={customInput?`${customInput.name}-${customInput.color}-${customInput.uploadedGlbFileName??''}`:'new-custom'}
      isOpen={showCustomCarModal}
      initialInput={customInput}
      onClose={()=>setShowCustomCarModal(false)}
      onSave={input=>{const created=saveCustom(input);setPlayerId(created.id);}}
      onDelete={()=>{clearCustom();if(playerId===CUSTOM_VEHICLE_ID)setPlayerId(PRESET_VEHICLES[0].id);}}
    />

    <DatacarAccountModal isOpen={showAccountModal} onClose={()=>setShowAccountModal(false)} />
    <RankingModal isOpen={showRankingModal} initialCircuitId={circuitId} onClose={()=>setShowRankingModal(false)} />

    {(stage==='loading' || stage==='briefing') && (
      <main className="dc-arcade-stage flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 md:p-4">
        <ArcadeBriefingStage
          car={car}
          circuit={circuit}
          weather={weather}
          onWeatherChange={setWeather}
          laps={raceLaps}
          onLapsChange={setRaceLaps}
          raceMode={raceMode}
          onRaceModeChange={m=>{if(m==='speed_pro'&&!progression.speedModeUnlocked)return;setRaceMode(m);}}
          speedModeUnlocked={progression.speedModeUnlocked}
          payload={payloadSelection}
          onPayloadChange={setPayloadSelection}
          isDatacarMember={isMember}
          onOpenAccount={()=>setShowAccountModal(true)}
          onOpenOnlineLobby={()=>{if(isPlayerCurrentlyJailed()){setJailAcknowledged(false);return;}setShowOnlineLobby(true);}}
          loadPercent={stage==='loading'?loadPercent:briefingPercent}
          loadLabel={loadLabel}
          loadError={stage==='loading'?loadError:null}
          isActivelyLoading={stage==='loading'}
          loadingContext={loadingMode}
          onStartRace={beginRace}
          onChangeCar={()=>setStage('garage')}
          onChangeCircuit={()=>setStage('circuits')}
          onRetryLoad={()=>{void warmup(loadingMode,loadingMode==='race'?raceCars:[]);}}
          getCarImageUrl={id=>allCars.find(v=>v.id===id)?.imageUrl||getOfficialVehicleImageUrl(id)}
        />
      </main>
    )}
    {stage==='home'&&(()=>{
      const featuredSpecs=formatArenaVehicleCardData(featuredCar);
      return <main className="dc99-home dc-wet-asphalt dc-arena-shell flex flex-col justify-between p-2 md:p-4 relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden select-none">
        {/* Night Stadium Cinematic Background */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <img src="/assets/aistudio/arena_home_bg_4f3f8584.webp" alt="" className="w-full h-full object-cover object-[center_62%] scale-[1.02]" />
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 38% 24% at 50% 34%, rgba(6, 18, 25, 0.98) 0%, rgba(6, 18, 25, 0.90) 56%, rgba(6, 18, 25, 0) 100%),
                linear-gradient(180deg, rgba(4, 12, 18, 0.90) 0%, rgba(6, 18, 25, 0.45) 24%, rgba(6, 18, 25, 0.14) 58%, rgba(3, 9, 14, 0.90) 100%)
              `,
            }}
          />
        </div>

        {/* Top Title: Crown + LOS MÁS BUSCADOS */}
        <div className="relative z-10 pt-0.5 pb-0.5 shrink-0">
          <ArenaCrownTitle compact />
          <span className="sr-only">LOS MÁS<br/><em>BUSCADOS.</em></span>
        </div>

        {/* Main Content: Responsive Stack in Portrait / Side-by-Side in Landscape */}
        <div className="flex-1 min-h-0 flex flex-col landscape:flex-row md:flex-row items-center justify-between gap-2.5 md:gap-6 px-1 md:px-5 relative z-10 my-auto">
          {/* Left Chamfered Petrol-Blue Specs Card */}
          <div className="dc-arena-spec-wrap w-full max-w-[360px] landscape:w-[220px] md:w-[310px] shrink-0 order-2 landscape:order-1 md:order-1">
            <div className="dc-arena-spec-card-border">
              <div className="dc-arena-spec-card p-2.5 md:p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <ArenaBrandEmblem brand={featuredSpecs.brand} className="w-9 h-7 md:w-12 md:h-10 shrink-0" />
                    <div className="h-7 w-[1.5px] bg-slate-500/45 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display text-lg md:text-3xl font-black italic tracking-wide text-[#F3F7FC] uppercase leading-none truncate">
                        {featuredSpecs.modelName}
                      </div>
                      <div className="font-display text-[10px] md:text-xs font-extrabold italic tracking-wider text-[#00E5F5] uppercase truncate mt-0.5">
                        {featuredSpecs.trimBadge}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <span className="inline-block px-2 py-0.5 font-display text-[9px] md:text-xs font-black italic uppercase tracking-wider text-[#04131A] bg-[#00E5F5]" style={{clipPath:'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)'}}>
                      {featuredSpecs.categoryBadge}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] md:text-xs text-[#F3F7FC]/90 leading-snug line-clamp-2">
                    {featuredSpecs.summary}
                  </p>
                </div>

                <div className="mt-2 pt-1.5 border-t border-[#00E5F5]/25 divide-y divide-[#00E5F5]/20">
                  <div className="flex items-center justify-between py-1 gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-[#F3F7FC] uppercase shrink-0">
                      <Zap size={12} className="text-[#00E5F5]" />
                      <span>POTENCIA</span>
                    </div>
                    <div className="font-display text-xs md:text-lg font-black italic text-[#00E5F5] text-right truncate">
                      {featuredSpecs.powerDisplay}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-1 gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-[#F3F7FC] uppercase shrink-0">
                      <Disc size={12} className="text-[#00E5F5]" />
                      <span>TORQUE</span>
                    </div>
                    <div className="font-display text-xs md:text-lg font-black italic text-[#00E5F5] text-right truncate">
                      {featuredSpecs.torqueDisplay}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-[#F3F7FC] uppercase shrink-0">
                      <Timer size={12} className="text-[#00E5F5]" />
                      <span>0 – 100 km/h</span>
                    </div>
                    <div className="font-display text-xs md:text-lg font-black italic text-[#00E5F5] text-right truncate">
                      {featuredSpecs.accelDisplay}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Center / Right Protagonist Car Showcase (3D GLB or Transparent RGBA Cutout) */}
          <div className="flex-1 w-full min-h-[165px] landscape:min-h-0 flex flex-col items-center justify-center relative min-w-0 order-1 landscape:order-2 md:order-2">
            <div
              className="w-full flex-1 min-h-[145px] landscape:min-h-0 flex items-center justify-center relative dc12-featured"
              onTouchStart={event=>{(event.currentTarget as HTMLElement).dataset.touchX=String(event.touches[0]?.clientX??0);}}
              onTouchEnd={event=>{const x=Number((event.currentTarget as HTMLElement).dataset.touchX||0);const dx=(event.changedTouches[0]?.clientX??x)-x;if(Math.abs(dx)>40)setHomeIndex(i=>(i+(dx<0?1:allCars.length-1))%allCars.length);}}
            >
              {/* Left navigation arrow */}
              <button
                className="dc12-featured-nav dc-arena-arrow-wrap !border-0 !bg-transparent absolute left-0 md:left-2 z-20 !w-9 !h-9 md:!w-12 md:!h-11"
                aria-label="Auto anterior"
                onClick={()=>setHomeIndex(i=>(i+allCars.length-1)%allCars.length)}
              >
                <span className="dc-arena-arrow-inner"><ChevronLeft size={20} /></span>
              </button>

              {/* Official WebP Protagonist Stage (never 3D GLB on Arcade Home) */}
              <div className="relative w-full h-full px-8 md:px-12 flex items-center justify-center">
                <ArenaHero3DStage vehicle={featuredCar} compact pngOnly imageBadgeLabel={null} onOpen360Modal={showVehicle} />
              </div>

              {/* Right navigation arrow */}
              <button
                className="dc12-featured-nav dc-arena-arrow-wrap !border-0 !bg-transparent absolute right-0 md:right-2 z-20 !w-9 !h-9 md:!w-12 md:!h-11"
                aria-label="Auto siguiente"
                onClick={()=>setHomeIndex(i=>(i+1)%allCars.length)}
              >
                <span className="dc-arena-arrow-inner"><ChevronRight size={20} /></span>
              </button>
            </div>

            {/* Pagination dots over asphalt */}
            <div className="flex items-center justify-center gap-2 pt-0.5 pb-0.5 z-20">
              {allCars.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => setHomeIndex(i)}
                  aria-label={`Ver auto ${i+1}`}
                  className={`rounded-full transition-all ${i === safeHomeIdx ? 'w-2.5 h-2.5 bg-[#E0FBFF] ring-2 ring-[#00E5F5] shadow-[0_0_10px_#00E5F5]' : 'w-2 h-2 bg-slate-400/45'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Fixed Bottom Navigation Dock (2x2 in narrow portrait, 4 cols in landscape/tablet) */}
        <div className="w-full grid grid-cols-2 landscape:grid-cols-4 md:grid-cols-4 gap-1.5 md:gap-3.5 pt-1.5 pb-0.5 z-20 shrink-0">
          <button
            className="dc-arena-dock-btn-wrap min-w-0"
            onClick={()=>{setPlayerId(featuredCar.id);setStage('garage');}}
          >
            <span className="dc-arena-dock-btn !py-2 !px-2 text-[11px] md:text-lg whitespace-nowrap">
              <ArenaGarageIcon className="w-4 h-4 md:w-6 md:h-6 shrink-0" />
              <span className="truncate">GARAJE</span>
            </span>
          </button>

          <button
            className="dc-arena-dock-btn-wrap min-w-0"
            onClick={()=>{setCompareFocusId(featuredCar.id);setStage('compare');}}
          >
            <span className="dc-arena-dock-btn !py-2 !px-2 text-[11px] md:text-lg whitespace-nowrap">
              <ArenaCompareIcon className="w-4 h-4 md:w-6 md:h-6 shrink-0" />
              <span className="truncate">COMPARAR</span>
            </span>
          </button>

          <button
            className="dc-arena-dock-btn-wrap min-w-0"
            onClick={()=>{setPlayerId(featuredCar.id);setStage('circuits');}}
          >
            <span className="dc-arena-dock-btn !py-2 !px-2 text-[11px] md:text-lg whitespace-nowrap">
              <ArenaCircuitsIcon className="w-4 h-4 md:w-6 md:h-6 shrink-0" />
              <span className="truncate">CIRCUITOS</span>
            </span>
          </button>

          <button
            className="dc-arena-cta-wrap min-w-0"
            onClick={nextFromHome}
          >
            <span className="dc-arena-cta-btn !py-2 !px-2.5 text-[11px] md:text-xl whitespace-nowrap">
              <ArenaRunChevronsIcon className="w-4 h-4 md:w-6 md:h-6 shrink-0" />
              <span className="truncate">CORRER AHORA</span>
            </span>
          </button>
        </div>
      </main>;
    })()}
    {stage==='circuits' && <main className="dc99-picker dc-circuits-picker relative z-10 overflow-y-auto overflow-x-hidden flex flex-col justify-between gap-1.5 md:gap-2.5">
      <div className="dc99-heading shrink-0">
        <div className="flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-0.5">
          <span>MODO CARRERA · ASUNCIÓN</span>
          <h1>ELEGÍ TU CIRCUITO.</h1>
        </div>
        <p className="hidden [@media(min-height:540px)]:md:block">Cada tramo tiene una dificultad, semáforos, doble carril y límites de velocidad.</p>
        <div className="mt-1 flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto pb-0.5 px-1 max-w-full no-scrollbar">
          <div className="inline-flex items-center gap-1 rounded-lg border border-[#FFAA12]/55 bg-[#081724]/95 px-2 py-1 text-xs shrink-0 min-h-[34px]" role="group" aria-label="Seleccionar vueltas">
            <span className="font-display text-[10px] font-black italic uppercase tracking-wider text-[#FFAA12]">VUELTAS:</span>
            {[1,2,3].map(n=>(
              <button key={n} type="button" onClick={()=>setRaceLaps(n)} aria-pressed={raceLaps===n} className={`rounded px-2 py-0.5 font-display text-xs font-black italic cursor-pointer ${raceLaps===n?'bg-[#FFAA12] text-[#04131A]':'text-slate-200'}`}>
                {n}V
              </button>
            ))}
          </div>
          <button type="button" onClick={()=>setRaceMode('city_trial')} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 min-h-[34px] text-[11px] font-black italic uppercase cursor-pointer shrink-0 whitespace-nowrap ${raceMode==='city_trial'?'border-cyan-400 bg-cyan-500/20 text-white':'border-slate-700 bg-slate-950/80 text-slate-300'}`}>
            <ShieldCheck size={13} className="text-cyan-300 shrink-0"/> Fase 1: Ciudad
          </button>
          <button type="button" disabled={!progression.speedModeUnlocked} onClick={()=>progression.speedModeUnlocked&&setRaceMode('speed_pro')} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 min-h-[34px] text-[11px] font-black italic uppercase shrink-0 whitespace-nowrap ${!progression.speedModeUnlocked?'cursor-not-allowed border-slate-800 bg-slate-950/60 text-slate-500':raceMode==='speed_pro'?'cursor-pointer border-amber-400 bg-amber-500/20 text-amber-200':'cursor-pointer border-amber-500/40 bg-slate-950/80 text-amber-200'}`}>
            {progression.speedModeUnlocked?<Zap size={13} className="text-amber-400 shrink-0"/>:<Lock size={13} className="shrink-0"/>} {progression.speedModeUnlocked?'Fase 2: Velocidad':'Fase 2 (Bloq.)'}
          </button>
          <button type="button" onClick={()=>setRaceMode('practice_free')} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 min-h-[34px] text-[11px] font-black italic uppercase cursor-pointer shrink-0 whitespace-nowrap ${raceMode==='practice_free'?'border-sky-400 bg-sky-500/20 text-sky-100':'border-slate-700 bg-slate-950/80 text-slate-300'}`}>
            <Compass size={13} className="text-sky-300 shrink-0"/> Pruebas
          </button>
          <button type="button" onClick={()=>{if(isPlayerCurrentlyJailed()){setJailAcknowledged(false);return;}setShowOnlineLobby(true);}} className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/60 bg-emerald-950/80 px-2.5 py-1 min-h-[34px] text-[11px] font-black italic uppercase text-emerald-200 cursor-pointer shrink-0 whitespace-nowrap">
            <Globe size={13} className="text-emerald-400 shrink-0"/> En Línea
          </button>
          <button type="button" onClick={()=>setShowRankingModal(true)} className="inline-flex items-center gap-1 rounded-lg border border-amber-400/50 bg-slate-950/85 px-2.5 py-1 min-h-[34px] text-[11px] font-black italic uppercase text-amber-200 cursor-pointer shrink-0 whitespace-nowrap">
            <Trophy size={13} className="text-amber-300 shrink-0"/> Ranking
          </button>
        </div>
      </div>

      <SwipeDeck items={ASUNCION_CIRCUITS} selectedId={circuitId} onSelect={setCircuitId} label="Circuitos" renderItem={(item,active)=>{
        const cTarget=getCircuitTargetTime(item.id,raceMode==='speed_pro'?'speed_pro':'city_trial',raceLaps,item.distanceMeters*raceLaps);
        return <div className={`dc99-track-card dc-mobile-track-card ${active ? '!border-[#00E5F5] shadow-[0_0_24px_rgba(0,229,245,0.45)]' : ''}`} style={{'--dc99-track-accent':item.sky} as React.CSSProperties}>
          <div className="dc99-track-art dc-mobile-track-art flex items-center justify-center relative overflow-hidden shrink-0">
            <img src={item.imageUrl} alt={item.name} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
            <div className="dc-circuit-photo-scrim absolute inset-0" />
            {active && <span className="dc-circuit-selected-pill absolute left-2 top-2 z-20 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black italic uppercase text-[#031519]"><Check size={12}/> SELECCIONADO</span>}
            <span className="dc-circuit-score-pill absolute right-2 top-2 z-20 px-2 py-0.5 border border-[#00E5F5]/75 bg-[#041824]/90 font-display text-xs md:text-sm font-black italic text-[#00E5F5]">{item.difficulty.toFixed(1)}/10</span>
            <div className="w-40 sm:w-48 z-10 p-2 drop-shadow-[0_4px_14px_rgba(0,0,0,0.95)]"><CircuitWireframeSVG circuitId={item.id}/></div>
          </div>
          <div className="dc-mobile-track-info flex flex-1 flex-col justify-between min-w-0 gap-1">
            <div>
              <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] font-black italic uppercase tracking-wider text-[#00E5F5]">
                <span className="truncate">{item.zone}</span>
                <span className="text-amber-300 font-mono tabular-nums shrink-0">Meta {formatTargetMinutesSec(cTarget.targetSec)}</span>
              </div>
              <h2 className="dc-mobile-track-title font-display italic font-black text-white uppercase mt-0.5">{item.name}</h2>
              <p className="dc-mobile-track-hazard italic text-slate-300 mt-0.5">{item.hazardLabel}</p>
            </div>
            <div className="dc99-stats pt-1 border-t border-cyan-500/20 flex items-center justify-between gap-2">
              <span className="truncate">{item.distanceMeters * raceLaps} m ({raceLaps}V) · Límite {formatTargetMinutesSec(cTarget.maxLimitSec)}</span>
              <span className={`px-2 py-0.5 rounded font-black uppercase text-[10px] shrink-0 ${active ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-cyan-300 border border-cyan-500/40'}`}>{active ? '✓ Elegido' : 'Elegir →'}</span>
            </div>
          </div>
        </div>;}}/>

      <div className="dc99-actions mt-0.5 rounded-xl border border-cyan-500/30 bg-[#04101d]/95 px-3 py-1 shrink-0">
        <button type="button" className="dc-btn-cyan flex items-center justify-center gap-2 px-4 md:px-5 py-1.5 min-h-[38px] text-xs shrink-0" onClick={()=>setStage('garage')}><Warehouse size={15}/> GARAJE</button>
        <button type="button" className="dc-btn-gold flex items-center justify-center gap-2 px-5 md:px-7 py-1.5 min-h-[40px] text-xs md:text-sm shrink-0" onClick={()=>setStage('briefing')}><ChevronsRight size={17} strokeWidth={3}/> PREPARAR / INICIAR CARRERA</button>
      </div>
    </main>}
    {stage==='garage' && <main className="dc99-picker dc-wet-asphalt flex flex-col justify-between gap-2.5 p-2 md:p-4 relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden select-none">
      {/* Subheader: < GARAJE / SELECCIÓN DE VEHÍCULOS */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1 pb-0.5 z-10 shrink-0">
        <button
          className="flex items-center gap-1.5 text-xs md:text-sm font-black italic uppercase text-cyan-400 hover:text-white transition-colors cursor-pointer"
          onClick={()=>setStage('home')}
        >
          <ChevronLeft size={18} />
          <span>GARAJE</span>
          <span className="text-slate-500 font-normal">/</span>
          <span className="text-slate-300 font-bold tracking-wider">SELECCIÓN DE VEHÍCULOS</span>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={()=>setShowCustomCarModal(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/55 bg-cyan-950/75 px-3 py-1 text-[11px] font-black uppercase text-cyan-200 hover:bg-cyan-900/75 cursor-pointer"
          >
            <PlusCircle size={13} className="text-cyan-400"/>
            <span>{customVehicle?'Editar mi auto genérico':'Crear Auto Genérico (.glb)'}</span>
          </button>
          <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full">
            VEHÍCULO {Math.max(0,allCars.findIndex(v=>v.id===playerId))+1} / {allCars.length}
          </div>
          <button
            type="button"
            onClick={()=>setStage('circuits')}
            className="dc-btn-gold inline-flex items-center gap-1.5 px-3.5 py-1 min-h-[34px] text-[11px] font-black italic"
          >
            <ChevronsRight size={14} strokeWidth={3} />
            <span>ELEGIR AUTO</span>
          </button>
        </div>
      </div>

      {/* Central Floating Card with Glowing Illuminated Cyan Border (Garaje 100% PNG, sin 3D) */}
      <div className="dc-garage-card-frame w-full max-w-[940px] mx-auto p-3.5 md:p-5 flex flex-col justify-between relative z-10 shadow-[0_0_40px_rgba(0,229,255,0.35)] shrink-0">
        {/* Top Info Header inside the card */}
        <div className="flex flex-col landscape:flex-row md:flex-row items-start justify-between gap-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs md:text-sm font-black tracking-widest text-slate-300 uppercase">
                {car.brand}
              </span>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-[10px] md:text-[11px] font-bold text-cyan-300">
                <Car size={11} />
                <span>{car.isCustom?'Auto Genérico PNG':car.equipment.seatingCapacity >= 7 ? 'SUV 3 Filas' : 'SUV Compacto'}</span>
              </div>
            </div>
            <h2 className="text-xl md:text-3xl font-black italic tracking-wide text-white uppercase drop-shadow leading-tight mt-0.5">
              {car.name}
            </h2>
            <div className="mt-1 inline-block px-2.5 py-0.5 rounded-md bg-slate-900/90 border border-slate-700 text-xs font-mono font-bold text-amber-300">
              {car.trim ?? NOT_SPECIFIED_LABEL}
            </div>
            <p className="mt-1.5 text-xs md:text-sm text-slate-300 max-w-[420px] leading-snug line-clamp-2">
              {getVehicleDesc(car)}
            </p>
          </div>

          {/* SwipeDeck for PNG Garage Cards (never mounts GLB in Garage) */}
          <div className="w-full landscape:w-[310px] md:w-[460px] h-[135px] md:h-[175px] relative flex items-center justify-center shrink-0">
            <SwipeDeck
              items={allCars}
              selectedId={playerId}
              onSelect={setPlayerId}
              label="Autos"
              renderItem={(item, active) => (
                <div className={`dc99-car-card flex flex-col items-center justify-center cursor-pointer transition-all ${active ? 'scale-105' : 'opacity-60 scale-95'}`} onClick={()=>setPlayerId(item.id)}>
                  <div className="relative">
                    <img
                      src={preview(item)}
                      alt={`${item.brand} ${item.name}`}
                      className="max-h-[110px] md:max-h-[155px] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
                      draggable={false}
                    />
                  </div>
                </div>
              )}
            />
          </div>
        </div>

        {/* 5 Specifications Row with Icons and Dividers (100% verified specFidelity) */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 border-t border-cyan-500/25 pt-3 bg-cyan-950/20 rounded-xl px-2 py-2">
          {/* 1. Precio */}
          <div className="flex flex-col items-center text-center min-w-0">
            <div className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
              <Tag size={11} />
              <span>PRECIO</span>
            </div>
            <div className="text-xs md:text-sm font-black italic text-white mt-0.5 truncate max-w-full">
              {getVehiclePrice(car)}
            </div>
          </div>

          {/* 2. Potencia */}
          <div className="flex flex-col items-center text-center sm:border-l border-cyan-500/20 min-w-0">
            <div className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
              <Zap size={11} />
              <span>POTENCIA</span>
            </div>
            <div className="text-xs md:text-sm font-black italic text-white mt-0.5 truncate max-w-full">
              {formatOfficialPower(car)}
            </div>
          </div>

          {/* 3. Torque */}
          <div className="flex flex-col items-center text-center sm:border-l border-cyan-500/20 min-w-0">
            <div className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
              <Disc size={11} />
              <span>TORQUE</span>
            </div>
            <div className="text-xs md:text-sm font-black italic text-white mt-0.5 truncate max-w-full">
              {formatOfficialTorque(car)}
            </div>
          </div>

          {/* 4. Consumo (mixto) */}
          <div className="flex flex-col items-center text-center sm:border-l border-cyan-500/20 min-w-0">
            <div className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
              <Gauge size={11} />
              <span>CONSUMO</span>
            </div>
            <div className="text-xs md:text-sm font-black italic text-white mt-0.5 truncate max-w-full">
              {formatOfficialConsumption(car)}
            </div>
          </div>

          {/* 5. Transmisión */}
          <div className="col-span-2 sm:col-span-1 flex flex-col items-center text-center sm:border-l border-cyan-500/20 min-w-0">
            <div className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
              <Settings size={11} />
              <span>TRANSMISIÓN</span>
            </div>
            <div className="text-xs md:text-sm font-black italic text-white mt-0.5 truncate max-w-full">
              {getTransmissionShort(car)}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <PayloadSelector vehicle={car} value={payloadSelection} onChange={setPayloadSelection} compact />
        </div>
      </div>

      {/* Subtext under Garage Card */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 text-[10px] md:text-xs text-slate-300 z-10 shrink-0">
        <span className="font-semibold text-slate-400">{'<< Deslizá para ver más >>'}</span>
        <span className="text-slate-600">|</span>
        <button
          onClick={()=>showVehicle(playerId)}
          className="flex items-center gap-1 text-cyan-300 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
        >
          <span>Arrastrá para girar 360°</span>
        </button>
        <div className="flex items-center gap-1 ml-1">
          {allCars.map((v) => (
            <div
              key={v.id}
              className={`h-1.5 rounded-full transition-all ${v.id === playerId ? 'w-4 bg-cyan-400' : 'w-1.5 bg-slate-600'}`}
            />
          ))}
        </div>
      </div>

      {/* Showroom de Cubiertas bloqueado por feature flag (PRÓXIMAMENTE · Sponsor Oficial) */}
      <div className="w-full max-w-[940px] mx-auto z-10 shrink-0">
        <TireShowroomSection selectedVehicle={car} compact />
      </div>

      {/* Action Buttons: [=] VER FICHA (Cyan) and >> ELEGIR ESTE AUTO (Gold) */}
      <div className="w-full max-w-[940px] mx-auto mt-1 mb-1 rounded-xl border border-cyan-500/35 bg-[#04101d]/95 px-3 py-2 flex flex-wrap items-center justify-center gap-3 shrink-0">
        <button
          type="button"
          className="dc-btn-cyan flex items-center justify-center gap-2 px-5 md:px-8 py-2 min-h-[42px] text-xs md:text-sm font-black italic"
          onClick={()=>{setShowroomCarId(playerId);setShowSpecs(true);}}
        >
          <FileText size={16} />
          <span>VER FICHA</span>
          <span className="sr-only">FICHA TÉCNICA COMPLETA</span>
        </button>

        <button
          type="button"
          className="dc-btn-gold flex items-center justify-center gap-2 px-6 md:px-10 py-2 min-h-[44px] text-xs md:text-sm font-black italic shadow-lg"
          onClick={()=>setStage('circuits')}
        >
          <ChevronsRight size={18} strokeWidth={3} />
          <span>ELEGIR ESTE AUTO</span>
        </button>
      </div>
    </main>}
    {stage==='race'&&<main className="dc99-race-stage"><Race3DPerspectiveView key={`mobile-${circuitId}-${playerId}-${raceLaps}-${raceMode}-${onlineSession?'online':'solo'}-${raceSession}`} manualStart experience="race" playerVehicleId={playerId} initialWeather={weather} vehicles={raceCars} track={track} simulationResults={baseResults} raceMode={raceMode} onlineSession={onlineSession} playerPayloadKg={playerPayloadKg} isDatacarMember={isMember} onPedestrianArrest={()=>{if(onlineSession){multiplayerClient.leaveRoom();setOnlineSession(false);}setJailAcknowledged(false);setStage('briefing');}} onExitRace={()=>{if(onlineSession){multiplayerClient.leaveRoom();setOnlineSession(false);}setStage('briefing');}} onRestartRace={()=>{if(isPlayerCurrentlyJailed()){setJailAcknowledged(false);setStage('briefing');return;}setRaceSession(n=>n+1);setStage('race');}} onFinishRace={(newResults,newHazards,newWeather)=>{setResults(newResults??null);setHazards(newHazards??[]);setCompletedWeather(newWeather??weather);if(newResults){const iqRanks=rankDrivingIQ(newResults,baseResults,track.distanceMeters);const pRes=newResults.find(r=>r.vehicle.id===playerId);const pIq=iqRanks.find(a=>a.vehicleId===playerId);const baseIq1000=pIq?Math.round(pIq.total*10):0;if(raceMode==='city_trial'){const verdict=evaluateCityTrialCompletion({finished:Boolean(pRes&&!pRes.isDnf),isDnf:Boolean(pRes?.isDnf),iqScore1000:baseIq1000,redLightViolations:pIq?.events.redLightViolations??0,pedestrianHit:false,circuitId});setSpeedModeNewlyUnlocked(verdict.newlyUnlocked);}if(raceMode!=='practice_free'&&pRes&&!pRes.isDnf){const targetSpec=getCircuitTargetTime(circuitId,raceMode,raceLaps,track.distanceMeters);const targetEval=evaluateCircuitTimeResult(pRes.finishTimeSec,targetSpec);const finalIq1000=Math.max(0,Math.min(1000,baseIq1000+targetEval.iqBonus));void submitCircuitRun({circuitId,mode:raceMode,laps:raceLaps,pilotName:account?.pilotName||multiplayerClient.getSnapshot().pilotName||'PilotoDC',isDatacarMember:isMember,vehicleId:car.id,vehicleName:`${car.brand} ${car.name}`,finishTimeSec:pRes.finishTimeSec,drivingIq:finalIq1000,occupants:payloadSelection.occupants,payloadKg:playerPayloadKg,medal:targetEval.medal});}}setStage('results');}}/></main>}

    {stage==='results' && (
      <main className="dc-arcade-stage flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 md:p-4" data-extended-label="TODOS LOS DATOS">
        <ArcadeResultsStage
          circuitId={circuitId}
          circuitName={circuit.name}
          trackDistanceMeters={track.distanceMeters}
          laps={raceLaps}
          podium={podium}
          assessments={insights}
          playerId={playerId}
          fallbackCar={car}
          onBackToGarage={()=>setStage('garage')}
          onRepeatRace={beginRace}
          onWatchReplay={results?()=>setStage('replay'):undefined}
          onShowAllData={()=>setShowAllResults(true)}
          raceMode={raceMode}
          speedModeUnlocked={progression.speedModeUnlocked}
          speedModeNewlyUnlocked={speedModeNewlyUnlocked}
          onLaunchSpeedMode={()=>{setRaceMode('speed_pro');setOnlineSession(false);setSpeedModeNewlyUnlocked(false);void warmup('race',[car]);}}
          payloadKg={playerPayloadKg}
          isDatacarMember={isMember}
          onOpenAccount={()=>setShowAccountModal(true)}
          onOpenRanking={()=>setShowRankingModal(true)}
          getCarImageUrl={id=>allCars.find(v=>v.id===id)?.imageUrl||getOfficialVehicleImageUrl(id)}
        />
      </main>
    )}
    {stage==='replay'&&results&&<main className="dc99-race-stage dc99-replay"><button className="dc99-replay-back" onClick={()=>setStage('results')}><ArrowLeft size={15}/> RESULTADOS</button><Race3DPerspectiveView key={`mobile-replay-${circuitId}-${playerId}`} experience="replay" playerVehicleId={playerId} vehicles={raceCars} track={track} simulationResults={results} replayHazards={hazards} replayWeather={completedWeather} onFinishRace={()=>{}}/></main>}
    {stage==='compare'&&<main className="dc99-picker dc-compare-picker overflow-y-auto overflow-x-hidden gap-1.5 relative z-10">
      <div className="dc99-heading shrink-0 flex flex-wrap items-center justify-between gap-2 max-w-[920px] w-full mx-auto px-1">
        <div className="text-left">
          <span>DUELO COMPARATIVO DIRECTO</span>
          <h1 className="!text-lg sm:!text-2xl md:!text-3xl">ELEGÍ 2 AUTOS</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <label htmlFor="arcade-compare-track" className="font-bold uppercase text-cyan-300 text-[10px] tracking-wider whitespace-nowrap">Pista:</label>
          <select id="arcade-compare-track" value={compareTrackIndex} onChange={e=>setCompareTrackIndex(Number(e.target.value))} className="rounded-lg border border-cyan-500/45 bg-slate-950/90 px-2 py-1 min-h-[36px] text-xs font-bold text-white max-w-[175px] sm:max-w-[230px]">
            {compareTracks.map((t,idx)=><option key={t.id} value={idx}>{t.name} ({t.distanceMeters} m)</option>)}
          </select>
          <button
            type="button"
            disabled={compareCars.length!==2}
            onClick={()=>{setCompareSimulation(true);setStage('compare-results');}}
            className="dc-btn-gold px-3.5 py-1.5 min-h-[36px] text-[11px] font-black italic whitespace-nowrap"
          >
            {compareCars.length===2?'COMPARAR AHORA →':`ELEGÍ ${2-compareCars.length} MÁS`}
          </button>
        </div>
      </div>

      {/* Compact Auto A vs Auto B Duel Bar */}
      <div className="dc-compare-duel-bar z-10 shrink-0">
        {[0,1].map(slotIdx=>{
          const assigned=compareCars[slotIdx];
          return <React.Fragment key={slotIdx}>
            <div className={`dc-compare-slot ${assigned?'filled':''}`}>
              {assigned?(
                <>
                  <img src={preview(assigned)} alt={`${assigned.brand} ${assigned.name}`} className="h-9 w-14 sm:h-10 sm:w-16 object-contain shrink-0"/>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] font-black uppercase tracking-wider text-cyan-300">Auto {slotIdx===0?'A':'B'}</div>
                    <div className="truncate text-xs font-black text-white">{assigned.brand} {assigned.name}</div>
                    <div className="truncate text-[10px] font-mono text-slate-300">{formatOfficialPower(assigned)}</div>
                  </div>
                  <button type="button" onClick={()=>toggleCompare(assigned.id)} aria-label={`Quitar ${assigned.brand} ${assigned.name} de comparación`} className="rounded-lg border border-rose-500/50 bg-rose-950/80 p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-rose-200 hover:bg-rose-900 cursor-pointer shrink-0">
                    <X size={14}/>
                  </button>
                </>
              ):(
                <div className="min-w-0 flex-1 py-1">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Auto {slotIdx===0?'A':'B'}</div>
                  <div className="text-[11px] font-bold text-slate-400 truncate">Elegí un modelo abajo</div>
                </div>
              )}
            </div>
            {slotIdx===0 && <div className="dc-compare-vs-badge">VS</div>}
          </React.Fragment>;
        })}
      </div>

      <SwipeDeck items={allCars} selectedId={compareFocusId} onSelect={setCompareFocusId} label="Comparador" renderItem={(item)=>{
        const slotIndex=compareIds.indexOf(item.id);
        const isAssigned=slotIndex>=0;
        return <div className={`dc99-car-card dc-mobile-compare-card ${isAssigned?'!border-[#00E5F5] shadow-[0_0_20px_rgba(0,229,245,0.3)]':''}`}>
          <div className="dc99-car-frame dc-mobile-compare-art">
            <img src={preview(item)} alt={`${item.brand} ${item.name}`}/>
          </div>
          <div className="dc-mobile-compare-info flex flex-1 flex-col justify-between min-w-0 gap-1.5">
            <div>
              <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase">
                <span className="text-cyan-300 truncate">{item.brand}</span>
                {isAssigned && <span className="rounded bg-[#00E5F5] px-2 py-0.5 text-[#04131A] shrink-0">AUTO {slotIndex===0?'A':'B'}</span>}
              </div>
              <h2 className="font-display italic font-black text-white uppercase leading-tight mt-0.5">{item.brand} {item.name}</h2>
              <p className="text-xs text-slate-300 mt-0.5">{formatOfficialPower(item)} · {formatOfficialTorque(item)} · {getVehiclePrice(item)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                className={`dc12-select-compare flex-1 min-h-[40px] rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition cursor-pointer ${isAssigned?'!bg-[#00E5F5] !text-[#04131A] !border-[#00E5F5]':'bg-[#082536] text-cyan-100 border border-[#00E5F5]/65'}`}
                onClick={event=>{event.stopPropagation();setCompareFocusId(item.id);toggleCompare(item.id);}}
              >
                {isAssigned?`✓ AUTO ${slotIndex===0?'A':'B'} (QUITAR)`:'+ ELEGIR PARA COMPARAR'}
              </button>
              <button
                type="button"
                onClick={event=>{event.stopPropagation();setCompareFocusId(item.id);openCompareShowroom(item.id,'glb3d');}}
                className="min-h-[40px] rounded-lg border border-cyan-400/50 bg-slate-900/90 px-2.5 py-1.5 text-[10px] font-black uppercase text-cyan-200 hover:border-cyan-300 cursor-pointer shrink-0"
              >
                3D / PNG
              </button>
              <button
                type="button"
                onClick={event=>{event.stopPropagation();setCompareFocusId(item.id);setShowroomCarId(item.id);setShowSpecs(true);}}
                className="min-h-[40px] rounded-lg border border-slate-600 bg-slate-900/90 px-2.5 py-1.5 text-[10px] font-black uppercase text-slate-200 hover:border-cyan-300 cursor-pointer shrink-0"
              >
                FICHA
              </button>
            </div>
          </div>
        </div>;
      }}/>

      <div className="dc99-actions mt-1 mb-1 rounded-xl border border-cyan-500/35 bg-[#04101d]/95 px-3 py-1.5 shrink-0">
        <button type="button" className="dc99-secondary min-h-[40px]" onClick={()=>setStage('home')}>MENÚ</button>
        <button type="button" className="dc99-secondary min-h-[40px]" onClick={()=>openCompareShowroom(compareFocusId,'frames')}>GIRO 360°</button>
        <button type="button" className="dc99-primary min-h-[42px]" disabled={compareCars.length!==2} onClick={()=>{setCompareSimulation(true);setStage('compare-results');}}>
          {compareCars.length===2?'VER TABLA Y PISTA →':`ELEGÍ ${2-compareCars.length} AUTO MÁS (${compareCars.length}/2)`}
        </button>
      </div>
    </main>}
    {stage==='compare-results'&&<main className="dc99-results dc12-compare-results overflow-y-auto overflow-x-hidden gap-2.5 relative z-10">
      <div className="dc99-heading shrink-0 flex flex-wrap items-center justify-between gap-2 max-w-[920px] w-full mx-auto px-1">
        <div className="text-left">
          <span>DUELO · {compareTrack.name} ({compareTrack.distanceMeters} m)</span>
          <h1 className="!text-lg sm:!text-2xl md:!text-3xl">RESULTADOS COMPARATIVOS</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className="dc99-secondary !min-h-[36px] !px-3 !py-1 !text-[11px]" onClick={()=>setStage('compare')}>← CAMBIAR AUTOS</button>
          <button type="button" className="dc99-primary !min-h-[36px] !px-3 !py-1 !text-[11px]" onClick={()=>setStage('home')}>MENÚ</button>
        </div>
      </div>

      {/* Podium Time Summary */}
      <div className="dc99-ranking shrink-0">{compareResults.map((r,i)=>{
        const winnerSec=compareResults[0]?.finishTimeSec??r.finishTimeSec;
        const gap=r.finishTimeSec-winnerSec;
        return <div key={r.vehicle.id}>
          <b>{i+1}º</b>
          <span>{r.vehicle.brand} {r.vehicle.name}</span>
          <strong className="tabular-nums">{r.finishTimeSec.toFixed(2)}s {i>0?`(+${gap.toFixed(2)}s)`:'(Ganador)'}</strong>
        </div>;
      })}</div>

      {/* Side-by-Side Auto A vs Auto B Technical Comparison Card */}
      {compareCars.length===2 && (
        <div className="w-full max-w-[920px] mx-auto rounded-2xl border border-cyan-500/35 bg-[#061423]/95 p-3 sm:p-4 shrink-0">
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-cyan-500/25">
            {compareCars.map((c, idx) => (
              <div key={c.id} className="flex flex-col items-center text-center gap-1.5 min-w-0">
                <span className="rounded bg-cyan-400/20 border border-cyan-400/50 px-2 py-0.5 text-[10px] font-black uppercase text-cyan-200">
                  Auto {idx === 0 ? 'A' : 'B'}
                </span>
                <img src={preview(c)} alt={`${c.brand} ${c.name}`} className="h-16 sm:h-24 w-full object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.85)]" />
                <div className="font-display text-sm sm:text-lg font-black italic uppercase text-white truncate max-w-full">
                  {c.brand} {c.name}
                </div>
                <button
                  type="button"
                  onClick={()=>openCompareShowroom(c.id,'glb3d')}
                  className="min-h-[36px] rounded-lg border border-cyan-400/60 bg-cyan-950/75 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-200 hover:bg-cyan-900 cursor-pointer"
                >
                  Ver en 3D (GLB) / PNG
                </button>
              </div>
            ))}
          </div>
          <div className="divide-y divide-slate-800/90 text-xs mt-1">
            {[
              ['Potencia', formatOfficialPower(compareCars[0]), formatOfficialPower(compareCars[1])],
              ['Torque', formatOfficialTorque(compareCars[0]), formatOfficialTorque(compareCars[1])],
              ['0–100 km/h', formatOfficialOrSimAccel(compareCars[0]), formatOfficialOrSimAccel(compareCars[1])],
              ['Vel. máxima', formatOfficialTopSpeed(compareCars[0]), formatOfficialTopSpeed(compareCars[1])],
              ['Consumo mixto', formatOfficialConsumption(compareCars[0]), formatOfficialConsumption(compareCars[1])],
              ['Peso', formatOfficialWeight(compareCars[0]), formatOfficialWeight(compareCars[1])],
              ['Despeje', formatOfficialClearance(compareCars[0]), formatOfficialClearance(compareCars[1])],
              ['Precio ref.', getVehiclePrice(compareCars[0]), getVehiclePrice(compareCars[1])],
            ].map(([label, valA, valB]) => (
              <div key={String(label)} className="grid grid-cols-3 items-center gap-2 py-1.5 text-center">
                <strong className="text-white font-bold truncate">{valA}</strong>
                <span className="text-[10px] uppercase tracking-wider text-cyan-300 font-bold">{label}</span>
                <strong className="text-white font-bold truncate">{valB}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dc11-garage-tools shrink-0">
        <button type="button" className="min-h-[38px]" onClick={()=>setCompareSimulation(v=>!v)}>
          {compareSimulation?'OCULTAR SIMULACIÓN 3D EN PISTA':'VER SIMULACIÓN 3D EN PISTA'}
        </button>
      </div>

      {compareSimulation && (
        <div className="dc12-compare-render w-full max-w-[920px] mx-auto h-[230px] sm:h-[320px] rounded-xl overflow-hidden border border-cyan-500/35 shrink-0">
          <Race3DPerspectiveView compact experience="comparison" vehicles={compareCars} track={compareTrack} simulationResults={compareResults} onFinishRace={()=>{}} />
        </div>
      )}

      <div className="dc99-actions mt-1 mb-1 rounded-xl border border-cyan-500/35 bg-[#04101d]/95 px-3 py-1.5 shrink-0">
        <button type="button" className="dc99-secondary min-h-[42px]" onClick={()=>setStage('compare')}>CAMBIAR AUTOS</button>
        <button type="button" className="dc99-primary min-h-[44px]" onClick={()=>setStage('home')}>MENÚ PRINCIPAL</button>
      </div>
    </main>}
    {showShowroom&&<div className="dc11-modal-backdrop" role="dialog" aria-modal="true" aria-label="Showroom 360"><section className="dc11-modal dc11-showroom"><header><h2>{showroomCar.brand} {showroomCar.name} · {showroomAllow3D?'VISTA COMPARAR (3D GLB / PNG)':'SHOWROOM 360°'}</h2><button onClick={()=>setShowShowroom(false)} aria-label="Cerrar visor 360"><X/></button></header><div className="dc11-modal-scroll">
      {showroomAllow3D && (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Modo de vista en Comparar">
          <button type="button" onClick={()=>setShowroomMode('image')} aria-pressed={showroomMode==='image'} className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider border transition ${showroomMode==='image'?'bg-[#00E5F5] text-[#04131A] border-[#00E5F5]':'bg-[#081824] text-slate-200 border-[#00E5F5]/35'}`}>PNG / WebP</button>
          <button type="button" onClick={()=>setShowroomMode('glb3d')} aria-pressed={showroomMode==='glb3d'} className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider border transition ${showroomMode==='glb3d'?'bg-[#00E5F5] text-[#04131A] border-[#00E5F5]':'bg-[#081824] text-slate-200 border-[#00E5F5]/35'}`}>Ver en 3D (GLB)</button>
          <button type="button" onClick={()=>setShowroomMode('frames')} aria-pressed={showroomMode==='frames'} className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider border transition ${showroomMode==='frames'?'bg-[#00E5F5] text-[#04131A] border-[#00E5F5]':'bg-[#081824] text-slate-200 border-[#00E5F5]/35'}`}>Giro 360°</button>
        </div>
      )}
      {showroomAllow3D && showroomMode !== 'frames' ? (
        <div className="relative h-72 sm:h-96 w-full overflow-hidden rounded-xl border border-[#00E5F5]/30 bg-[#061219]">
          <img src="/assets/aistudio/arena_home_bg_4f3f8584.webp" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_63%]" />
          <div className="relative z-10 h-full w-full">
            <ArenaHero3DStage vehicle={showroomCar} compact pngOnly={showroomMode==='image'} imageBadgeLabel="Vista PNG / WebP" />
          </div>
        </div>
      ) : (
        <Photographic360Viewer key={showroomCar.id} vehicle={showroomCar} compact initialMode="frames"/>
      )}
      <p>{'Arrastrá horizontalmente para girar el auto.'}</p><button className="dc99-primary" onClick={()=>{setShowShowroom(false);setShowSpecs(true);}}>VER FICHA TÉCNICA</button></div></section></div>}
    {showSpecs&&<div className="dc11-modal-backdrop" role="dialog" aria-modal="true" aria-label="Ficha técnica"><section className="dc11-modal"><header><h2>FICHA · {showroomCar.brand} {showroomCar.name}</h2><button onClick={()=>setShowSpecs(false)} aria-label="Cerrar ficha"><X/></button></header><div className="dc11-modal-scroll"><p className="dc11-evidence">{showroomCar.specEvidence?.sourceLabel??'Información según el catálogo del proyecto'} · {showroomCar.estimatedSimulationParameters?'Incluye parámetros de simulación calibrados (no mostrados como ficha oficial)':'Datos sujetos a la ficha registrada'}</p><div className="dc11-spec-grid">{[
      ['Versión',showroomCar.trim??NOT_SPECIFIED_LABEL],['Año',showroomCar.year],['Motor',showroomCar.engineDescription],['Transmisión',showroomCar.transmissionDescription],['Potencia',formatOfficialPower(showroomCar)],['Torque',formatOfficialTorque(showroomCar)],['Peso',formatOfficialWeight(showroomCar)],['Tracción',showroomCar.drivetrain],['0–100',formatOfficialOrSimAccel(showroomCar)],['Velocidad máxima',formatOfficialTopSpeed(showroomCar)],['Longitud',`${showroomCar.dimensions.lengthMm} mm`],['Ancho',`${showroomCar.dimensions.widthMm} mm`],['Alto',`${showroomCar.dimensions.heightMm} mm`],['Despeje',formatOfficialClearance(showroomCar)],['Frenado 100–0',formatOfficialBraking(showroomCar)],['Combustible',showroomCar.fuelType],['Consumo mixto',formatOfficialConsumption(showroomCar)],['Tanque',formatOfficialFuelCapacity(showroomCar)],['Baúl',showroomCar.equipment.trunkLiters>0?`${showroomCar.equipment.trunkLiters} L`:NOT_SPECIFIED_LABEL],['Asientos',showroomCar.equipment.seatingCapacity],['Airbags',showroomCar.equipment.airbags],['Conectividad',showroomCar.equipment.connectivity],['Neumáticos',showroomCar.technicalDetails?.tireSize??NOT_SPECIFIED_LABEL],['Suspensión delantera',showroomCar.technicalDetails?.frontSuspension??NOT_SPECIFIED_LABEL],['Suspensión trasera',showroomCar.technicalDetails?.rearSuspension??NOT_SPECIFIED_LABEL],['Frenos',showroomCar.technicalDetails?.brakeDetails??showroomCar.equipment.brakesType]
      ].map(([name,value])=><div key={String(name)}><span>{name}</span><strong>{value}</strong></div>)}</div><h3>Equipamiento y asistentes</h3><p>{[...showroomCar.equipment.adasFeatures,...showroomCar.equipment.comfortFeatures].join(' · ')||NOT_SPECIFIED_LABEL}</p><h3>Seguridad y tecnología</h3><p>{showroomCar.equipment.safetyFeatures?.join(' · ')||NOT_SPECIFIED_LABEL}</p><p>Los estados de asistencia se muestran únicamente cuando existe evidencia: {showroomCar.equipment.safetySystems?Object.entries(showroomCar.equipment.safetySystems).map(([name,status])=>`${name.toUpperCase()}: ${String(status)}`).join(' · '):'Sin matriz adicional de verificación'}</p>
      {showroomCar.hybridSystem&&<><h3>Sistema híbrido</h3><p>Tipo: {showroomCar.hybridSystem.kind} · Potencia térmica: {showroomCar.hybridSystem.combustionHp??'No consignada'} HP · Potencia eléctrica: {showroomCar.hybridSystem.electricHp??'No consignada'} HP · Batería: {showroomCar.hybridSystem.batteryKWh??'No consignada'} kWh</p></>}
      <h3>Información adicional</h3><p>{showroomCar.description}</p><p>{showroomCar.specEvidence?.notes??''}</p><p>Los datos de simulación no constituyen una prueba técnica certificada.</p></div></section></div>}
    {showAllResults&&<div className="dc11-modal-backdrop" role="dialog" aria-modal="true" aria-label="Resultados completos"><section className="dc11-modal dc11-full-results"><header><h2>RESULTADOS COMPLETOS · {circuit.name}</h2><button onClick={()=>setShowAllResults(false)} aria-label="Cerrar resultados"><X/></button></header><div className="dc11-modal-scroll">{podium.map(r=><section key={r.vehicle.id} className="dc11-result-entry"><h3>{r.finishPosition}º · {r.vehicle.brand} {r.vehicle.name}</h3><div className="dc11-spec-grid">{[
      ['Tiempo',r.isDnf?`DNF · ${r.dnfReason??''}`:`${r.finishTimeSec.toFixed(2)} s`],['Diferencia',`${r.gapSec.toFixed(2)} s`],['Velocidad máxima',`${r.topSpeedAchievedKmh.toFixed(1)} km/h`],['Velocidad de llegada',`${r.trapSpeedKmh.toFixed(1)} km/h`],['0–100',r.time0to100==null?'No alcanzado':`${r.time0to100.toFixed(2)} s`],['0–200',r.time0to200==null?'No alcanzado':`${r.time0to200.toFixed(2)} s`],['400 metros',r.time400m==null?'No alcanzado':`${r.time400m.toFixed(2)} s`],['Combustible gastado',`${r.fuelBurned.toFixed(2)} L`],['Combustible restante',`${r.fuelRemaining.toFixed(2)} L`],['Potencia / peso',`${r.effectivePowerToWeight.toFixed(1)} HP/t`],['Muestras telemetría',r.telemetryHistory.length]
      ].map(([name,value])=><div key={String(name)}><span>{name}</span><strong>{value}</strong></div>)}</div><p>{r.verdict}</p><MobileTelemetryChart result={r}/></section>)}{results&&<DrivingIQResults results={podium} assessments={insights} playerId={playerId} payloadKg={playerPayloadKg} isDatacarMember={isMember} practiceFree={raceMode==='practice_free'}/>}</div></section></div>}
    {showInfo&&<div className="dc99-info-backdrop"><section className="dc99-info"><button aria-label="Cerrar" onClick={()=>setShowInfo(false)}><X/></button><h2>SOBRE DATACAR ARENA</h2><p>Experiencia recreativa. Los circuitos son ficticios e inspirados en Asunción; no reflejan condiciones viales actuales. La simulación de vehículos utiliza fichas técnicas y algunos parámetros estimados, y no constituye una prueba oficial.</p><a href="https://datacarpy.com" target="_blank" rel="noopener noreferrer">VER DATACAR PARAGUAY</a></section></div>}
  </section>;
}

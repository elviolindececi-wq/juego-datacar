import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, FlagTriangleRight, Gauge, GitCompareArrows, Info, Maximize2, Pause, Play, RotateCcw, Smartphone, Trophy, Volume2, X} from 'lucide-react';
import type {Vehicle, VehicleRaceResult} from '../../types/vehicle';
import {PRESET_VEHICLES, PRESET_TRACKS} from '../../data/presetVehicles';
import {ASUNCION_CIRCUITS, toRaceTrack} from '../../data/asuncionCircuits';
import {simulateFullRace} from '../../utils/physicsEngine';
import type {TrackHazard} from '../../utils/interactiveRacePhysics';
import type {WeatherMode} from '../../utils/weatherDynamics';
import {WEATHER_OPTIONS} from '../../utils/weatherDynamics';
import {Race3DPerspectiveView} from '../Race3DPerspectiveView';
import {Photographic360Viewer} from '../Photographic360Viewer';
import {DrivingIQResults} from '../DrivingIQResults';
import {soundEngine} from '../../utils/soundEngine';
import {rankDrivingIQ} from '../../utils/drivingIQ';
import {getVehicle3DConfig, loadVehicleGLTF} from '../../utils/vehicle3DModelLoader';

type Stage='loading'|'home'|'circuits'|'garage'|'briefing'|'race'|'results'|'replay'|'compare'|'compare-results';
type Props={initialPlayerId?:string};
const preview=(car:Vehicle)=>`/assets/vehicle-previews/${car.id}.jpg`;

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

export default function MobileGameExperience({initialPlayerId}:Props){
  const [stage,setStage]=useState<Stage>('loading');
  const [loadPercent,setLoadPercent]=useState(0);
  const [loadLabel,setLoadLabel]=useState('Preparando DATACAR ARENA');
  const [loadError,setLoadError]=useState<string|null>(null);
  const [loadingMode,setLoadingMode]=useState<'boot'|'race'>('boot');
  const loadingSequence=useRef(0);
  const [playerId,setPlayerId]=useState(initialPlayerId??PRESET_VEHICLES[2].id);
  const [circuitId,setCircuitId]=useState('aviadores');
  const [weather,setWeather]=useState<WeatherMode>('sunny');
  const [completedWeather,setCompletedWeather]=useState<WeatherMode>('sunny');
  const [results,setResults]=useState<VehicleRaceResult[]|null>(null);
  const [hazards,setHazards]=useState<TrackHazard[]>([]);
  const [compareIds,setCompareIds]=useState<string[]>(PRESET_VEHICLES.slice(0,2).map(c=>c.id));
  const [showInfo,setShowInfo]=useState(false);
  const [showShowroom,setShowShowroom]=useState(false);
  const [show360Video,setShow360Video]=useState(false);
  const [showSpecs,setShowSpecs]=useState(false);
  const [showAllResults,setShowAllResults]=useState(false);
  const [landscape,setLandscape]=useState(()=>window.matchMedia('(orientation: landscape)').matches);
  const [showRotateHint,setShowRotateHint]=useState(true);
  const [fullscreenError,setFullscreenError]=useState(false);
  const [raceSession,setRaceSession]=useState(0);
  const rootRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const mq=window.matchMedia('(orientation: landscape)');
    const update=()=>setLandscape(mq.matches);
    mq.addEventListener?.('change',update);window.addEventListener('orientationchange',update);
    return ()=>{mq.removeEventListener?.('change',update);window.removeEventListener('orientationchange',update);};
  },[]);
  const enterGame=async()=>{
    setFullscreenError(false);
    try{if(!document.fullscreenElement && rootRef.current?.requestFullscreen) await rootRef.current.requestFullscreen({navigationUI:'hide'});}catch{setFullscreenError(true);}
    try{const orientation=screen.orientation as ScreenOrientation & {lock?:(orientation:string)=>Promise<void>};await orientation.lock?.('landscape');}catch{setFullscreenError(true);}
    setShowRotateHint(false);
  };
  const car=PRESET_VEHICLES.find(v=>v.id===playerId)??PRESET_VEHICLES[0];
  const circuit=ASUNCION_CIRCUITS.find(c=>c.id===circuitId)??ASUNCION_CIRCUITS[0];
  const track=useMemo(()=>toRaceTrack(circuit),[circuit]);
  const raceCars=useMemo(()=>[car,...PRESET_VEHICLES.filter(v=>v.id!==car.id).slice(0,2)],[car]);
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
        const urls=Array.from(new Set(PRESET_VEHICLES.map(v=>preview(v))));
        let done=0;
        await Promise.all(urls.map(src=>new Promise<void>(resolve=>{
          const image=new Image();
          image.onload=image.onerror=()=>{done++;update(done/urls.length*100,'Preparando imágenes del garage');resolve();};
          image.src=src;
          if(image.complete){/* load/error se entregan por el navegador */}
        })));
      } else {
        const urls=Array.from(new Set(cars.map(v=>getVehicle3DConfig(v.id)?.glbUrl).filter((v):v is string=>Boolean(v))));
        const fractions=new Map(urls.map(url=>[url,0]));
        const updateModel=(url:string,part:number)=>{fractions.set(url,part);update(100*Array.from(fractions.values()).reduce((a,b)=>a+b,0)/Math.max(1,urls.length),'Cargando vehículos 3D');};
        if(!urls.length)update(100,'Preparando pista');
        await Promise.all(urls.map(async url=>{
          await loadVehicleGLTF(url,(bytes,total)=>{if(total>0)updateModel(url,Math.min(.97,bytes/total*.97));});
          updateModel(url,1);
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
  useEffect(()=>{void warmup('boot');return ()=>{loadingSequence.current++;};},[warmup]);
  const beginRace=()=>{setShowShowroom(false);setShowSpecs(false);soundEngine.unlock();void warmup('race',raceCars);};
  const nextFromHome=()=>setStage('circuits');
  const toggleCompare=(id:string)=>setCompareIds(list=>list.includes(id)?list.filter(x=>x!==id):list.length===2?[list[1],id]:[...list,id]);
  const compareCars=compareIds.map(id=>PRESET_VEHICLES.find(v=>v.id===id)).filter((v):v is Vehicle=>Boolean(v));
  const compareResults=useMemo(()=>compareCars.length===2?simulateFullRace(compareCars,PRESET_TRACKS[0]):[],[compareIds.join('|')]);
  return <section ref={rootRef} className={`dc99-game ${stage==='race'||stage==='replay'?'dc99-in-race':''}`} aria-label="DATACAR ARENA para celular">
    {(!landscape && showRotateHint) && <div className="dc99-rotate" role="dialog" aria-label="Girar celular">
      <div className="dc99-rotate-icon"><Smartphone size={54}/><RotateCcw size={29}/></div>
      <div className="dc99-logo">DATA<span>CAR</span> <strong>ARENA</strong></div>
      <h1>GIRÁ TU CELULAR</h1>
      <p>La experiencia completa funciona en horizontal, como un juego de carreras.</p>
      <button className="dc99-primary" onClick={enterGame}><Maximize2 size={18}/> ENTRAR AL JUEGO</button>
      {fullscreenError&&<small>Tu navegador puede requerir girar el teléfono manualmente y ocultar sus barras. La experiencia sigue disponible.</small>}
      <small>Si no gira automáticamente, activá la rotación de pantalla en el celular.</small>
    </div>}
    {!landscape && !showRotateHint && <div className="dc99-rotate" role="alert"><Smartphone size={55}/><h1>GIRÁ TU CELULAR</h1><p>El juego está diseñado para usarse horizontalmente.</p><button onClick={enterGame} className="dc99-primary">PANTALLA COMPLETA</button></div>}
    <div className="dc99-world" aria-hidden="true"><div className="dc99-world-grid"/></div>
    {stage!=='race' && stage!=='replay' && stage!=='loading' && <header className="dc99-topbar">
      <button className="dc99-back" aria-label="Volver" onClick={()=>setStage(stage==='home'?'home':stage==='circuits'?'home':stage==='garage'?'circuits':stage==='briefing'?'garage':stage==='results'?'home':stage==='compare-results'?'compare':'home')}><ArrowLeft size={18}/></button>
      <div className="dc99-logo">DATA<span>CAR</span> <strong>ARENA</strong><small>ASUNCIÓN</small></div>
      <div className="dc99-step">{stage==='home'?'MENÚ':stage==='circuits'?'01 / 03':stage==='garage'?'02 / 03':stage==='briefing'?'03 / 03':stage==='results'?'META':stage==='compare'?'COMPARAR':'RESULTADOS'}</div>
      <button className="dc99-icon" onClick={enterGame} aria-label="Poner juego en pantalla completa"><Maximize2 size={18}/></button>
      <button className="dc99-icon dc99-help" onClick={()=>setShowInfo(true)} aria-label="Información del simulador"><Info size={18}/></button>
    </header>}
    {stage==='loading' && <main className="dc100-loading" role="status" aria-live="polite">
      <div className="dc100-loading-inner">
        <div className="dc99-logo">DATA<span>CAR</span> <strong>ARENA</strong></div>
        <div className="dc100-loading-title">{loadError?'ERROR AL CARGAR':loadPercent===100?'¡LISTO!':'PREPARANDO EL JUEGO'}</div>
        <div className="dc100-loading-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={loadPercent}><div style={{width:`${loadPercent}%`}}/></div>
        <div className="dc100-loading-meta"><span>{loadError??loadLabel}</span><strong>{loadPercent}%</strong></div>
        {loadError&&<div className="dc100-loading-actions"><button className="dc99-primary" onClick={()=>{void warmup(loadingMode,loadingMode==='race'?raceCars:[]);}}>REINTENTAR</button>{loadingMode==='race'&&<button className="dc99-secondary" onClick={()=>setStage('briefing')}>VOLVER</button>}</div>}
      </div>
    </main>}
    {stage==='home'&&<main className="dc99-home">
      <div className="dc99-home-copy"><div className="dc99-overline">MODO CARRERA · ASUNCIÓN</div><h1>EL ASFALTO<br/><em>NO PERDONA.</em></h1><p>Elegí tu auto. Dominá la ciudad.</p><button className="dc99-primary" onClick={nextFromHome}><Play fill="currentColor" size={18}/> JUGAR AHORA <ArrowRight size={18}/></button><button className="dc99-secondary" onClick={()=>setStage('compare')}><GitCompareArrows size={16}/> COMPARAR AUTOS</button></div>
      <div className="dc99-hero-car"><div className="dc99-hero-glow"/><img src={preview(car)} alt={`${car.brand} ${car.name}`}/><span>{car.brand} {car.name}</span></div>
      <div className="dc99-home-footer">7 VEHÍCULOS <b>·</b> 6 CIRCUITOS <b>·</b> FÍSICA INTERACTIVA</div>
    </main>}
    {stage==='circuits' && <main className="dc99-picker">
      <div className="dc99-heading"><span>ETAPA 01</span><h1>ELEGÍ TU CIRCUITO</h1><p>Deslizá para explorar las pistas de Asunción.</p></div>
      <SwipeDeck items={ASUNCION_CIRCUITS} selectedId={circuitId} onSelect={setCircuitId} label="Circuitos" renderItem={(item,active,i)=><div className="dc99-track-card" style={{'--dc99-track-accent':item.sky} as React.CSSProperties}>
        <div className="dc99-track-art"><span className="dc99-track-number">PISTA {String(i+1).padStart(2,'0')}</span><div className="dc99-track-road"/><span className="dc99-track-difficulty">DIFICULTAD {item.difficulty.toFixed(1)}/10</span></div>
        <h2>{item.name}</h2><p>{item.subtitle}</p><div className="dc99-stats"><span>{(item.distanceMeters/1000).toFixed(1)} KM</span><span>{item.zone}</span></div>{active&&<span className="dc99-selected"><Check size={13}/> SELECCIONADO</span>}
      </div>}/>
      <div className="dc99-actions"><button className="dc99-secondary" onClick={()=>setStage('home')}>ATRÁS</button><button className="dc99-primary" onClick={()=>setStage('garage')}>ELEGIR AUTO <ArrowRight size={17}/></button></div>
    </main>}
    {stage==='garage' && <main className="dc99-picker">
      <div className="dc99-heading"><span>ETAPA 02</span><h1>SELECCIONÁ TU AUTO</h1><p>Deslizá para cambiar de vehículo.</p></div>
      <SwipeDeck items={PRESET_VEHICLES} selectedId={playerId} onSelect={setPlayerId} label="Autos" renderItem={(item,active,i)=><div className="dc99-car-card">
        <div className="dc99-car-frame"><span>VEHÍCULO {String(i+1).padStart(2,'0')}</span><img src={preview(item)} alt={`${item.brand} ${item.name}`}/></div>
        <h2>{item.brand} {item.name}</h2><p>{item.trim}</p><div className="dc99-stats"><span>{item.powerHp} HP</span><span>{item.torqueNm} NM</span></div>{active&&<span className="dc99-selected"><Check size={13}/> SELECCIONADO</span>}
      </div>}/>
      <div className="dc11-garage-tools"><button onClick={()=>{setShow360Video(false);setShowShowroom(true);}}><RotateCcw size={15}/> VER 360° / VIDEO</button><button onClick={()=>setShowSpecs(true)}><Info size={15}/> FICHA TÉCNICA COMPLETA</button></div>
      <div className="dc99-actions"><button className="dc99-secondary" onClick={()=>setStage('circuits')}>ATRÁS</button><button className="dc99-primary" onClick={()=>setStage('briefing')}>CONFIRMAR AUTO <ArrowRight size={17}/></button></div>
    </main>}
    {stage==='briefing'&&<main className="dc99-briefing">
      <div className="dc99-heading"><span>ETAPA 03</span><h1>LISTO PARA CORRER</h1><p>Revisá tu selección y preparate para la largada.</p></div>
      <div className="dc99-briefing-car"><img src={preview(car)} alt={`${car.brand} ${car.name}`}/><div><span>TU VEHÍCULO</span><h2>{car.brand} {car.name}</h2><p>{car.powerHp} HP · {car.torqueNm} Nm</p><button onClick={()=>setStage('garage')}>CAMBIAR AUTO</button></div></div>
      <div className="dc99-briefing-track"><span>TU CIRCUITO</span><h2>{circuit.name}</h2><p>{circuit.distanceMeters} m · Dificultad {circuit.difficulty}/10</p><button onClick={()=>setStage('circuits')}>CAMBIAR CIRCUITO</button></div>
      <div className="dc99-weather"><label htmlFor="dc99-weather">CLIMA</label><select id="dc99-weather" value={weather} onChange={e=>setWeather(e.target.value as WeatherMode)}>{WEATHER_OPTIONS.map(option=><option value={option.id} key={option.id}>{option.label}</option>)}</select></div>
      <button className="dc99-primary dc99-start-race" onClick={beginRace}><FlagTriangleRight size={19}/> ¡EMPEZAR CARRERA!</button>
    </main>}
    {stage==='race'&&<main className="dc99-race-stage"><Race3DPerspectiveView key={`mobile-${circuitId}-${playerId}-${raceSession}`} manualStart experience="race" playerVehicleId={playerId} initialWeather={weather} vehicles={raceCars} track={track} simulationResults={baseResults} onExitRace={()=>setStage('briefing')} onFinishRace={(newResults,newHazards,newWeather)=>{setResults(newResults??null);setHazards(newHazards??[]);setCompletedWeather(newWeather??weather);setStage('results');}}/></main>}
    {stage==='results'&&<main className="dc99-results"><div className="dc99-heading"><span><Trophy size={16}/> CARRERA FINALIZADA</span><h1>RESULTADOS</h1><p>{circuit.name}</p></div><div className="dc99-results-body"><div className="dc99-results-hero"><img src={preview(car)} alt={`${car.brand} ${car.name}`}/><h2>{car.brand} {car.name}</h2><p>{podium.find(p=>p.vehicle.id===playerId)?.isDnf?'NO COMPLETÓ':`P${podium.find(p=>p.vehicle.id===playerId)?.finishPosition??'—'} · ${podium.find(p=>p.vehicle.id===playerId)?.finishTimeSec.toFixed(2)??'—'} S`}</p></div><div className="dc99-ranking">{podium.map((p,i)=><div key={p.vehicle.id}><b>{i+1}º</b><span>{p.vehicle.brand} {p.vehicle.name}</span><strong>{p.isDnf?'DNF':`${p.finishTimeSec.toFixed(2)}s`}</strong></div>)}{insights.length>0&&<small>Driving IQ calculado a partir de la telemetría de la carrera.</small>}</div></div><div className="dc99-actions"><button className="dc99-secondary" onClick={()=>setStage('home')}>MENÚ</button><button className="dc99-secondary" disabled={!results} onClick={()=>setStage('replay')}>REPETICIÓN</button><button className="dc99-secondary" onClick={()=>setShowAllResults(true)}>TODOS LOS DATOS</button><button className="dc99-primary" onClick={beginRace}><RotateCcw size={17}/> OTRA VEZ</button></div></main>}
    {stage==='replay'&&results&&<main className="dc99-race-stage dc99-replay"><button className="dc99-replay-back" onClick={()=>setStage('results')}><ArrowLeft size={15}/> RESULTADOS</button><Race3DPerspectiveView key={`mobile-replay-${circuitId}-${playerId}`} experience="replay" playerVehicleId={playerId} vehicles={raceCars} track={track} simulationResults={results} replayHazards={hazards} replayWeather={completedWeather} onFinishRace={()=>{}}/></main>}
    {stage==='compare'&&<main className="dc99-picker"><div className="dc99-heading"><span>MODO COMPARAR</span><h1>ELEGÍ 2 AUTOS</h1><p>Deslizá y tocá un vehículo para seleccionarlo.</p></div><SwipeDeck items={PRESET_VEHICLES} selectedId={compareIds.at(-1)??PRESET_VEHICLES[0].id} onSelect={toggleCompare} label="Comparador" renderItem={(item)=> <div className="dc99-car-card"><div className="dc99-car-frame"><img src={preview(item)} alt={`${item.brand} ${item.name}`}/></div><h2>{item.brand} {item.name}</h2><p>{item.powerHp} HP · {item.torqueNm} Nm</p><span className="dc99-selected">{compareIds.includes(item.id)?'✓ SELECCIONADO':'TOCAR PARA ELEGIR'}</span></div>}/><div className="dc99-actions"><button className="dc99-secondary" onClick={()=>setStage('home')}>MENÚ</button><button className="dc99-primary" disabled={compareIds.length!==2} onClick={()=>setStage('compare-results')}>COMPARAR {compareIds.length}/2 <ArrowRight size={16}/></button></div></main>}
    {stage==='compare-results'&&<main className="dc99-results"><div className="dc99-heading"><span>COMPARACIÓN FICTICIA</span><h1>RESULTADOS</h1></div><div className="dc99-ranking">{compareResults.map((r,i)=><div key={r.vehicle.id}><b>{i+1}º</b><span>{r.vehicle.brand} {r.vehicle.name}</span><strong>{r.finishTimeSec.toFixed(2)}s</strong></div>)}</div><div className="dc99-actions"><button className="dc99-secondary" onClick={()=>setStage('compare')}>OTROS AUTOS</button><button className="dc99-primary" onClick={()=>setStage('home')}>MENÚ PRINCIPAL</button></div></main>}
    {showShowroom&&<div className="dc11-modal-backdrop" role="dialog" aria-modal="true" aria-label="Showroom 360"><section className="dc11-modal dc11-showroom"><header><h2>{car.brand} {car.name} · SHOWROOM 360°</h2><button onClick={()=>setShowShowroom(false)} aria-label="Cerrar visor 360"><X/></button></header><div className="dc11-modal-scroll"><div className="dc11-view-switch"><button className={!show360Video?'active':''} onClick={()=>setShow360Video(false)}>360° INTERACTIVO</button>{car.video360Url&&<button className={show360Video?'active':''} onClick={()=>setShow360Video(true)}>VIDEO 360°</button>}</div>
      {show360Video&&car.video360Url?<video key={car.video360Url} src={car.video360Url} playsInline autoPlay muted loop controls preload="metadata" className="dc11-vehicle-video"/>:<Photographic360Viewer key={car.id} vehicle={car} compact/>}
      <p>{show360Video?'Video disponible para este vehículo.':'Deslizá sobre el vehículo para girarlo. Si este modelo carece de fotogramas, se utiliza la fotografía disponible.'}</p><button className="dc99-primary" onClick={()=>{setShowShowroom(false);setShowSpecs(true);}}>VER FICHA TÉCNICA</button></div></section></div>}
    {showSpecs&&<div className="dc11-modal-backdrop" role="dialog" aria-modal="true" aria-label="Ficha técnica"><section className="dc11-modal"><header><h2>FICHA · {car.brand} {car.name}</h2><button onClick={()=>setShowSpecs(false)} aria-label="Cerrar ficha"><X/></button></header><div className="dc11-modal-scroll"><p className="dc11-evidence">{car.specEvidence?.sourceLabel??'Información según el catálogo del proyecto'} · {car.estimatedSimulationParameters?'Incluye parámetros de simulación estimados':'Datos sujetos a la ficha registrada'}</p><div className="dc11-spec-grid">{[
      ['Versión',car.trim??'—'],['Año',car.year],['Motor',car.engineDescription],['Transmisión',car.transmissionDescription],['Potencia',`${car.powerHp} HP`],['Torque',`${car.torqueNm} Nm`],['Peso',`${car.weightKg} kg`],['Tracción',car.drivetrain],['0–100',`${car.accel0100} s`],['Velocidad teórica',`${car.topSpeedKmh} km/h`],['Longitud',`${car.dimensions.lengthMm} mm`],['Ancho',`${car.dimensions.widthMm} mm`],['Alto',`${car.dimensions.heightMm} mm`],['Despeje',`${car.dimensions.clearanceMm} mm`],['Distancia de frenado',`${car.brakingDistance100} m`],['Combustible',car.fuelType],['Consumo base',`${car.consumptionBase} L/100 km`],['Tanque',`${car.fuelCapacityL} L`],['Baúl',`${car.equipment.trunkLiters} L`],['Asientos',car.equipment.seatingCapacity],['Airbags',car.equipment.airbags],['Conectividad',car.equipment.connectivity],['Neumáticos',car.technicalDetails?.tireSize??'No consignado'],['Suspensión delantera',car.technicalDetails?.frontSuspension??'No consignada'],['Suspensión trasera',car.technicalDetails?.rearSuspension??'No consignada'],['Frenos',car.technicalDetails?.brakeDetails??car.equipment.brakesType]
      ].map(([name,value])=><div key={String(name)}><span>{name}</span><strong>{value}</strong></div>)}</div><h3>Equipamiento y asistentes</h3><p>{[...car.equipment.adasFeatures,...car.equipment.comfortFeatures].join(' · ')||'No consignado'}</p><h3>Seguridad y tecnología</h3><p>{car.equipment.safetyFeatures?.join(' · ')||'No se detallan elementos adicionales en el catálogo'}</p><p>Los estados de asistencia se muestran únicamente cuando existe evidencia: {car.equipment.safetySystems?Object.entries(car.equipment.safetySystems).map(([name,status])=>`${name.toUpperCase()}: ${String(status)}`).join(' · '):'Sin matriz adicional de verificación'}</p>
      {car.hybridSystem&&<><h3>Sistema híbrido</h3><p>Tipo: {car.hybridSystem.kind} · Potencia térmica: {car.hybridSystem.combustionHp??'No consignada'} HP · Potencia eléctrica: {car.hybridSystem.electricHp??'No consignada'} HP · Batería: {car.hybridSystem.batteryKWh??'No consignada'} kWh</p></>}
      <h3>Información adicional</h3><p>{car.description}</p><p>{car.specEvidence?.notes??''}</p><p>Los datos de simulación no constituyen una prueba técnica certificada.</p></div></section></div>}
    {showAllResults&&<div className="dc11-modal-backdrop" role="dialog" aria-modal="true" aria-label="Resultados completos"><section className="dc11-modal dc11-full-results"><header><h2>RESULTADOS COMPLETOS · {circuit.name}</h2><button onClick={()=>setShowAllResults(false)} aria-label="Cerrar resultados"><X/></button></header><div className="dc11-modal-scroll">{podium.map(r=><section key={r.vehicle.id} className="dc11-result-entry"><h3>{r.finishPosition}º · {r.vehicle.brand} {r.vehicle.name}</h3><div className="dc11-spec-grid">{[
      ['Tiempo',r.isDnf?`DNF · ${r.dnfReason??''}`:`${r.finishTimeSec.toFixed(2)} s`],['Diferencia',`${r.gapSec.toFixed(2)} s`],['Velocidad máxima',`${r.topSpeedAchievedKmh.toFixed(1)} km/h`],['Velocidad de llegada',`${r.trapSpeedKmh.toFixed(1)} km/h`],['0–100',r.time0to100==null?'No alcanzado':`${r.time0to100.toFixed(2)} s`],['0–200',r.time0to200==null?'No alcanzado':`${r.time0to200.toFixed(2)} s`],['400 metros',r.time400m==null?'No alcanzado':`${r.time400m.toFixed(2)} s`],['Combustible gastado',`${r.fuelBurned.toFixed(2)} L`],['Combustible restante',`${r.fuelRemaining.toFixed(2)} L`],['Potencia / peso',`${r.effectivePowerToWeight.toFixed(1)} HP/t`],['Muestras telemetría',r.telemetryHistory.length]
      ].map(([name,value])=><div key={String(name)}><span>{name}</span><strong>{value}</strong></div>)}</div><p>{r.verdict}</p><MobileTelemetryChart result={r}/></section>)}{results&&<DrivingIQResults results={podium} assessments={insights} playerId={playerId}/>}</div></section></div>}
    {showInfo&&<div className="dc99-info-backdrop"><section className="dc99-info"><button aria-label="Cerrar" onClick={()=>setShowInfo(false)}><X/></button><h2>SOBRE DATACAR ARENA</h2><p>Experiencia recreativa. Los circuitos son ficticios e inspirados en Asunción; no reflejan condiciones viales actuales. La simulación de vehículos utiliza fichas técnicas y algunos parámetros estimados, y no constituye una prueba oficial.</p><a href="https://datacarpy.com" target="_blank" rel="noopener noreferrer">VER DATACAR PARAGUAY</a></section></div>}
  </section>;
}

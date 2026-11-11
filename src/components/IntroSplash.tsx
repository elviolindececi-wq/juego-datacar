import React, { useEffect, useState } from 'react';
import type { Vehicle } from '../types/vehicle';
import { ArrowRight, CarFront, ChevronLeft, ChevronRight, GitCompareArrows, Gauge, Play, ShieldCheck } from 'lucide-react';

interface IntroSplashProps {
  vehicles: Vehicle[];
  onStart: () => void;
  onCompare: () => void;
  onRace: (vehicleId: string) => void;
}

const preview = (v: Vehicle) => v.imageUrl || `/assets/vehicle-previews/${v.id}.jpg`;

/** Pantalla propia de DATACAR, con energía de juego callejero, sin copiar marcas o artes de otros videojuegos.
 * "Los más buscados" es un nombre creativo, NO un ranking estadístico de búsquedas.
 */
export function IntroSplash({ vehicles, onStart, onCompare, onRace }: IntroSplashProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const chosen = vehicles[selectedIndex] || vehicles[0];
  const selectRelative = (offset: number) => setSelectedIndex(i => (i + offset + vehicles.length) % vehicles.length);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (event.code === 'Enter' && !element?.closest?.('button, a, input, select, textarea, [role=button]')) onStart();
      if (event.code === 'ArrowLeft') { event.preventDefault(); selectRelative(-1); }
      if (event.code === 'ArrowRight') { event.preventDefault(); selectRelative(1); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [vehicles.length, onStart]);

  if (!chosen) return null;

  return (
    <>
    <main className="dc-mobile-start" aria-label="DATACAR ARENA: inicio del juego">
      <div className="dc-mobile-start-glow" aria-hidden="true" />
      <div className="dc-mobile-game-brand"><span>DATA<b>CAR</b></span><strong>ARENA</strong><small>ASUNCIÓN · EDICIÓN MOBILE</small></div>
      <div className="dc-mobile-hero-copy"><span className="dc-mobile-eyebrow">EL ASFALTO TE ESPERA</span><h1>LOS MÁS <em>BUSCADOS</em></h1></div>
      <div className="dc-mobile-car-picker">
        <button onClick={() => selectRelative(-1)} aria-label="Auto anterior" className="dc-mobile-pick-arrow"><ChevronLeft/></button>
        <img src={preview(chosen)} alt={`${chosen.brand} ${chosen.name}`} />
        <button onClick={() => selectRelative(1)} aria-label="Auto siguiente" className="dc-mobile-pick-arrow"><ChevronRight/></button>
      </div>
      <div className="dc-mobile-car-title"><span>{String(selectedIndex + 1).padStart(2,'0')} / {String(vehicles.length).padStart(2,'0')} · SELECCIONÁ TU AUTO</span><strong>{chosen.brand} {chosen.name}</strong><small>{chosen.powerHp} HP · {chosen.torqueNm} Nm</small></div>
      <nav className="dc-mobile-start-actions" aria-label="Menú principal">
        <button className="dc-mobile-play" onClick={() => onRace(chosen.id)}><Play fill="currentColor" size={19}/> CORRER AHORA <ArrowRight size={19}/></button>
        <div><button onClick={onStart}><Gauge size={17}/> MODOS DE JUEGO</button><button onClick={onCompare}><GitCompareArrows size={17}/> COMPARAR</button></div>
      </nav>
      <p className="dc-mobile-disclaimer">Simulación recreativa basada en fichas técnicas. No equivale a un ensayo oficial.</p>
    </main>
    <main className="dc-desktop-start relative isolate flex min-h-screen flex-col overflow-hidden bg-[#04070c] text-white selection:bg-cyan-300 selection:text-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_74%_33%,rgba(7,151,182,.25),transparent_46%),radial-gradient(ellipse_at_15%_80%,rgba(234,179,8,.14),transparent_36%),linear-gradient(145deg,#04070d_10%,#0a1825_56%,#050910_100%)]" />
      <div className="dc-city-skyline pointer-events-none absolute inset-x-0 top-0 h-[72%] overflow-hidden opacity-65" aria-hidden="true">
        {Array.from({ length: 19 }, (_, i) => (
          <div key={i} className="dc-city-building absolute bottom-0 border-x border-white/5"
            style={{ left: `${i * 5.8 - 1}%`, width: `${4.7 + i % 3}%`, height: `${16 + (i * 47 + 31) % 48}%`, opacity: .22 + i % 4 * .1 }} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-[-30%] bottom-[-15%] h-[41%] -rotate-[11deg] border-t border-slate-500/30 bg-[repeating-linear-gradient(0deg,transparent_0px,transparent_35px,rgba(255,255,255,.025)_36px,transparent_37px),linear-gradient(180deg,#1d2632,#080c11)] shadow-[0_-30px_90px_rgba(0,0,0,.65)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 opacity-[.07] [background-image:repeating-linear-gradient(0deg,transparent,transparent_2px,#fff_3px,transparent_4px)]" aria-hidden="true" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-9">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-400/50 bg-cyan-400/10 text-cyan-300"><Gauge size={27}/></span>
          <div className="leading-tight"><div className="text-xl font-black tracking-tight">DATA<span className="font-normal text-cyan-300">CAR</span> <span className="text-slate-50">ARENA</span></div><div className="text-[9px] font-bold uppercase tracking-[.32em] text-slate-400">ASUNCIÓN · EDICIÓN 9.1</div></div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-slate-700/70 bg-slate-950/60 px-4 py-2 text-[10px] font-bold uppercase tracking-[.26em] text-slate-300 sm:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"/> SIMULADOR DE CONDUCCIÓN</div>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-8 px-5 pb-10 pt-4 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-6 sm:px-9" aria-labelledby="intro-heading">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 border-l-[3px] border-amber-400 pl-3 text-xs font-bold uppercase tracking-[.28em] text-amber-300">ESPECIAL ASUNCIÓN · CATÁLOGO DATACAR</div>
          <h1 id="intro-heading" className="font-display text-[clamp(4rem,9.2vw,8.3rem)] font-black uppercase italic leading-[.79] tracking-[-.035em] drop-shadow-[0_8px_15px_rgba(0,0,0,.55)]">
            LOS MÁS<br/><span className="text-cyan-300">BUSCADOS</span>
          </h1>
          <div className="mt-5 flex items-center gap-3"><div className="h-[2px] w-12 bg-amber-400"/><p className="font-display text-xl font-bold uppercase tracking-[.32em] text-white/90 sm:text-2xl">DE DATACAR</p></div>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-300 sm:text-base">Elegí un modelo, compará su ficha o salí a correr en circuitos inspirados en las calles de Asunción. El asfalto no perdona.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={onStart} className="inline-flex items-center justify-center gap-3 rounded-xl bg-cyan-300 px-7 py-4 text-sm font-black uppercase tracking-wider text-slate-950 shadow-[0_0_35px_rgba(103,232,249,.19)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"><Play fill="currentColor" size={18}/> PRESIONÁ START</button>
            <button type="button" onClick={() => onRace(chosen.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/35 bg-slate-950/60 px-6 py-4 text-sm font-bold uppercase text-white backdrop-blur transition hover:border-cyan-300 hover:text-cyan-300"><CarFront size={18}/> MODO CARRERA</button>
            <button type="button" onClick={onCompare} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/50 px-6 py-4 text-sm font-bold uppercase text-white transition hover:border-amber-400 hover:text-amber-300"><GitCompareArrows size={18}/> COMPARAR</button>
          </div>
          <p className="mt-5 text-[10px] uppercase tracking-widest text-slate-500">Los más buscados es el nombre creativo de esta experiencia; los modelos no están ordenados por estadísticas de búsqueda.</p>
        </div>

        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-[26px] border border-sky-300/25 bg-[linear-gradient(150deg,rgba(11,25,38,.9),rgba(4,9,16,.95))] p-4 shadow-[0_24px_90px_rgba(0,0,0,.55)] sm:p-6">
            <div className="pointer-events-none absolute -right-10 -top-8 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl"/>
            <div className="relative z-10 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[.22em] text-cyan-300">SELECCIÓN DE VEHÍCULOS</span>
              <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 font-mono text-[11px] text-slate-400">{String(selectedIndex + 1).padStart(2,'0')} / {String(vehicles.length).padStart(2,'0')}</span>
            </div>
            <div className="relative mt-4 flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl bg-slate-950/60 sm:min-h-[280px]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(30,64,90,.65),transparent_67%)]"/>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,rgba(3,9,18,.9))]"/>
              <img key={chosen.id} className="relative z-10 max-h-[265px] w-full object-contain p-3 drop-shadow-[0_24px_22px_rgba(0,0,0,.65)]" src={preview(chosen)} alt={`Vista del ${chosen.brand} ${chosen.name}`} loading="eager" />
              <button type="button" onClick={() => selectRelative(-1)} className="absolute left-2 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-slate-950/80 transition hover:bg-cyan-500/30" aria-label="Vehículo anterior"><ChevronLeft/></button>
              <button type="button" onClick={() => selectRelative(1)} className="absolute right-2 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-slate-950/80 transition hover:bg-cyan-500/30" aria-label="Siguiente vehículo"><ChevronRight/></button>
            </div>
            <div className="relative z-10 mt-5 flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-[11px] font-bold uppercase tracking-[.25em] text-slate-400">{chosen.brand} · {chosen.year}</p><h2 className="font-display mt-1 text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">{chosen.name}</h2><p className="mt-2 text-xs font-semibold text-cyan-300">{chosen.trim} · {chosen.powerHp} HP · {chosen.torqueNm} Nm</p></div>
              <button onClick={() => onRace(chosen.id)} className="flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-400/10 px-4 py-3 text-xs font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-slate-950">CORRER CON ESTE <ArrowRight size={16}/></button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2" aria-label="Elegir vehículo destacado">
            {vehicles.map((v, i) => <button key={v.id} aria-label={`Mostrar ${v.brand} ${v.name}`} aria-pressed={i === selectedIndex} type="button" onClick={() => setSelectedIndex(i)} className={`h-1.5 rounded-full transition-all ${i === selectedIndex ? 'w-10 bg-cyan-300' : 'w-4 bg-slate-600 hover:bg-slate-400'}`}/>) }
          </div>
        </div>
      </section>
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/40 px-5 py-4 text-[10px] uppercase tracking-wider text-slate-500 sm:px-9">
        <span className="inline-flex items-center gap-2"><ShieldCheck size={14}/> Simulación recreativa basada en fichas técnicas; no prueba homologada</span>
        <a className="font-bold text-cyan-300 hover:text-white" href="https://datacarpy.com" target="_blank" rel="noopener noreferrer">Conocé autos reales en datacarpy.com <ArrowRight size={12} className="inline"/></a>
      </footer>
    </main>
    </>
  );
}

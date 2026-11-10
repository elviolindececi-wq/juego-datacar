import React, { useEffect, useRef, useState } from 'react';
import { Vehicle } from '../types/vehicle';
import { Photographic360Viewer } from './Photographic360Viewer';
import { Fuel, Gauge, CheckCircle2, Play, Pause, RotateCw, Video } from 'lucide-react';

interface CarShowroom3DProps {
  vehicle: Vehicle;
}

export const CarShowroom3D: React.FC<CarShowroom3DProps> = ({ vehicle }) => {
  const videoUrl = vehicle.video360Url || vehicle.turntable360?.videoUrl;
  const hasManual360 = Boolean(vehicle.turntable360?.framesBaseUrl && vehicle.turntable360.framesCount);
  const [viewMode, setViewMode] = useState<'video' | 'manual'>('manual');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setViewMode('manual');
    setVideoError(false);
    setIsVideoPlaying(false);
  }, [vehicle.id, videoUrl]);

  useEffect(() => {
    if (viewMode !== 'video' || !videoUrl) return;
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => setIsVideoPlaying(false));
    }
  }, [viewMode, videoUrl]);

  const toggleVideoPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => setIsVideoPlaying(false));
    else video.pause();
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Top Header Strip */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-md shrink-0"
            style={{ backgroundColor: vehicle.color || '#3b82f6' }}
          />
          <div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-sky-400 font-bold uppercase">{vehicle.brand} {vehicle.name}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-300 font-semibold">{vehicle.trim}</span>
              <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-400/30 px-2 py-0.5 rounded">
                Showroom interactivo 360°
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Arrastrá para girar el auto antes de elegir · El video es opcional
            </span>
          </div>
        </div>

        {/* Quick specs badge pill */}
        <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-slate-300 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5 text-sky-400 font-bold">
            <Gauge className="w-3.5 h-3.5" />
            <span>{vehicle.powerHp} HP</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span>{vehicle.torqueNm} Nm</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Fuel className="w-3.5 h-3.5" />
            <span>{vehicle.estimatedSimulationParameters ? '≈ ' : ''}{vehicle.consumptionBase} L/100km{vehicle.estimatedSimulationParameters ? ' (sim.)' : ''}</span>
          </div>
        </div>
      </div>

      {/* La inspección manual de 120 fotogramas es la vista predeterminada.
          Los MP4 solo se reproducen por elección explícita del usuario. */}
      <div className="p-4 sm:p-6 bg-slate-950/40">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de vista 360°">
            {videoUrl && !videoError && <button
              type="button"
              onClick={() => setViewMode('video')}
              aria-pressed={viewMode === 'video'}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${viewMode === 'video' ? 'border-cyan-400 bg-cyan-400/15 text-cyan-300' : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'}`}
            ><Video size={15}/> Video 360°</button>}
            {hasManual360 && <button
              type="button"
              onClick={() => setViewMode('manual')}
              aria-pressed={viewMode === 'manual'}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${viewMode === 'manual' ? 'border-cyan-400 bg-cyan-400/15 text-cyan-300' : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'}`}
            ><RotateCw size={15}/> Girar manualmente</button>}
          </div>
          <span className="text-xs text-slate-400">{!hasManual360 && !videoUrl ? 'Vista de referencia · visor 360° pendiente' : viewMode === 'video' ? 'Video activado por vos' : 'Giro manual, sin reproducción automática'}</span>
        </div>
        {viewMode === 'video' && videoUrl && !videoError ? (
          <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-[#030610] sm:min-h-[420px]">
            <video
              key={vehicle.id}
              ref={videoRef}
              src={videoUrl}
              poster={vehicle.imageUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
              onError={() => { setVideoError(true); setViewMode('manual'); }}
              className="h-[260px] w-full object-contain sm:h-[420px]"
              aria-label={`Video 360° de ${vehicle.brand} ${vehicle.name}`}
            />
            <span className="pointer-events-none absolute left-3 top-3 rounded-md border border-cyan-400/30 bg-slate-950/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-cyan-300">Video 360° · {vehicle.name}</span>
            <button
              type="button"
              onClick={toggleVideoPlayback}
              className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs font-bold text-slate-100 hover:border-cyan-400"
              aria-label={isVideoPlaying ? 'Pausar video' : 'Reproducir video'}
            >{isVideoPlaying ? <Pause size={15}/> : <Play size={15}/>} {isVideoPlaying ? 'Pausar' : 'Reproducir'}</button>
          </div>
        ) : hasManual360 || videoUrl ? (
          <Photographic360Viewer key={vehicle.id} vehicle={vehicle} compact={false}/>
        ) : (
          <div className="relative flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-800 bg-[#080d1a] sm:min-h-[420px]">
            <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.name} · imagen de catálogo`} className="max-h-[410px] w-full object-contain"/>
            <div className="absolute bottom-2 left-2 right-2 rounded-lg border border-amber-500/35 bg-slate-950/85 px-3 py-2 text-xs text-amber-200">Imagen de ficha DATACAR. No existe un 360° propio todavía. En carrera se usa una carrocería 3D provisional con física de esta versión.</div>
          </div>
        )}
        {videoError && <p className="mt-3 text-xs text-amber-300">El MP4 no pudo cargarse; se abrió la vista 360° manual. Comprobá que la carpeta public/assets/aistudio conserve los videos originales.</p>}
      </div>

      {/* Technical Summary Bar under Showroom */}
      <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Ficha cargada en DATACAR: <strong className="text-white">{vehicle.brand} {vehicle.name}</strong></span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>Dimensiones: <span className="text-slate-300">{vehicle.dimensions.lengthMm} × {vehicle.dimensions.widthMm} × {vehicle.dimensions.heightMm} mm</span></span>
          <span className="hidden md:inline">Despeje del suelo: <span className="text-slate-300">{vehicle.dimensions.clearanceMm} mm</span></span>
          <span>Peso {vehicle.estimatedSimulationParameters ? 'estimado' : 'tara'}: <span className="text-slate-300">{vehicle.weightKg} kg</span></span>
        </div>
      </div>
    </div>
  );
};

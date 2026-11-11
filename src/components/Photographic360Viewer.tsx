import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Vehicle } from '../types/vehicle';
import { RotateCw, Play, Pause, ZoomIn } from 'lucide-react';

// Memoria caché global de fotogramas por URL base para que el cambio entre vehículos sea instantáneo
const globalVehicleFramesCache = new Map<string, HTMLImageElement[]>();

export function getOrLoadFrames(
  baseUrl: string,
  count: number,
  ext: string,
  onFirstFrameLoaded?: () => void
): HTMLImageElement[] {
  const cached = globalVehicleFramesCache.get(baseUrl);
  if (cached && cached.length === count) {
    return cached;
  }

  const images: HTMLImageElement[] = [];
  for (let i = 1; i <= count; i++) {
    const img = new Image();
    const paddedIndex = String(i).padStart(3, '0');
    img.src = `${baseUrl}${paddedIndex}${ext}`;
    if (i === 1 && onFirstFrameLoaded) {
      if (img.complete && img.naturalWidth > 0) {
        onFirstFrameLoaded();
      } else {
        img.onload = () => onFirstFrameLoaded();
      }
    }
    images.push(img);
  }
  globalVehicleFramesCache.set(baseUrl, images);
  return images;
}

// Los fotogramas 360 se solicitan únicamente cuando el usuario abre el showroom.
// El preload global anterior descargaba 360 imágenes al cargar cualquier pantalla,
// ralentizando el teléfono e interfiriendo con la descarga de los GLB de carrera.

interface Photographic360ViewerProps {
  vehicle: Vehicle;
  compact?: boolean;
  onOpenSpecs?: () => void;
}

export const Photographic360Viewer: React.FC<Photographic360ViewerProps> = ({
  vehicle,
  compact = false,
  onOpenSpecs: _onOpenSpecs,
}) => {
  const turntable = vehicle.turntable360;
  const hasFrames = Boolean(turntable?.framesCount && turntable.framesCount > 0 && turntable.framesBaseUrl);
  const totalFrames = turntable?.framesCount || 120;

  // Estado del ángulo (0 a totalFrames - 1)
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState<0.5 | 1 | 2>(1);
  const [zoomLevel, setZoomLevel] = useState<1 | 1.25 | 1.5>(1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDuration, setVideoDuration] = useState(10.0);

  // Dragging refs para respuesta ultra-fluida y continua al mouse
  const lastXRef = useRef(0);
  const frameFloatRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  // Obtener los 120 fotogramas específicos del vehículo actual
  const currentFrames = useMemo(() => {
    if (!hasFrames || !turntable?.framesBaseUrl) return [];
    return getOrLoadFrames(
      turntable.framesBaseUrl,
      turntable.framesCount || 120,
      turntable.framesExtension || '.jpg',
      () => {
        renderFrameToCanvas(1);
      }
    );
  }, [hasFrames, turntable?.framesBaseUrl, turntable?.framesCount, turntable?.framesExtension]);

  // Renderizar el fotograma exacto en canvas para eliminar todo parpadeo
  const renderFrameToCanvas = useCallback(
    (frameNum: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !currentFrames || currentFrames.length === 0) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const frameIdx = Math.max(0, Math.min(currentFrames.length - 1, frameNum - 1));
      const img = currentFrames[frameIdx];

      if (img && img.complete && img.naturalWidth > 0) {
        if (canvas.width !== img.naturalWidth) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } else if (img) {
        img.onload = () => {
          if (canvasRef.current) {
            const c = canvasRef.current;
            const context = c.getContext('2d');
            if (context && img.naturalWidth > 0) {
              c.width = img.naturalWidth;
              c.height = img.naturalHeight;
              context.clearRect(0, 0, c.width, c.height);
              context.drawImage(img, 0, 0, c.width, c.height);
            }
          }
        };
      }
    },
    [currentFrames]
  );

  // Al cambiar de vehículo, resetear ángulo y pausar, y dibujar el frame 1 del nuevo auto
  useEffect(() => {
    setFrameIndex(0);
    frameFloatRef.current = 0;
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    renderFrameToCanvas(1);
  }, [vehicle.id, renderFrameToCanvas]);

  // Sincronizar canvas cuando cambia frameIndex
  useEffect(() => {
    if (hasFrames && currentFrames.length > 0) {
      const frameNum = (frameIndex % totalFrames) + 1;
      renderFrameToCanvas(frameNum);
    }
  }, [frameIndex, hasFrames, totalFrames, currentFrames, renderFrameToCanvas]);

  // Loop de reproducción suave cuando se activa Play voluntariamente
  useEffect(() => {
    if (!isPlaying) return;

    let lastTime = performance.now();
    const fps = 24 * rotationSpeed; // Velocidad configurable
    const interval = 1000 / fps;

    const tick = (now: number) => {
      if (now - lastTime >= interval) {
        lastTime = now;
        frameFloatRef.current = (frameFloatRef.current + 1) % totalFrames;
        setFrameIndex(Math.floor(frameFloatRef.current));
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, totalFrames, rotationSpeed]);

  // Cálculo del ángulo en grados (0° a 360°)
  const currentAngleDeg = Math.round((frameIndex / totalFrames) * 360);

  // Manejo de Drag continuo con el mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastXRef.current = e.clientX;
    frameFloatRef.current = frameIndex;
    setIsPlaying(false); // Detener auto-spin inmediatamente
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;

    // Sensibilidad continua: cada ~3-4px de movimiento del mouse rota 1 fotograma (3°)
    const sensitivity = compact ? 0.30 : 0.25;
    let nextFloat = (frameFloatRef.current - deltaX * sensitivity) % totalFrames;
    if (nextFloat < 0) nextFloat += totalFrames;

    frameFloatRef.current = nextFloat;
    const nextIdx = Math.floor(nextFloat);
    if (nextIdx !== frameIndex) {
      setFrameIndex(nextIdx);
    }

    if (videoRef.current && videoDuration > 0) {
      videoRef.current.currentTime = (nextIdx / totalFrames) * videoDuration;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Manejo táctil para pantallas táctiles y móviles
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    lastXRef.current = e.touches[0].clientX;
    frameFloatRef.current = frameIndex;
    setIsPlaying(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaX = e.touches[0].clientX - lastXRef.current;
    lastXRef.current = e.touches[0].clientX;

    const sensitivity = compact ? 0.32 : 0.28;
    let nextFloat = (frameFloatRef.current - deltaX * sensitivity) % totalFrames;
    if (nextFloat < 0) nextFloat += totalFrames;

    frameFloatRef.current = nextFloat;
    const nextIdx = Math.floor(nextFloat);
    if (nextIdx !== frameIndex) {
      setFrameIndex(nextIdx);
    }

    if (videoRef.current && videoDuration > 0) {
      videoRef.current.currentTime = (nextIdx / totalFrames) * videoDuration;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Rueda del mouse (Scroll horizontal o vertical sobre el auto para girar fluido)
  const handleWheel = (e: React.WheelEvent) => {
    setIsPlaying(false);
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const step = (delta > 0 ? 1 : -1) * 1.5;

    let nextFloat = (frameFloatRef.current + step) % totalFrames;
    if (nextFloat < 0) nextFloat += totalFrames;

    frameFloatRef.current = nextFloat;
    const nextIdx = Math.floor(nextFloat);
    setFrameIndex(nextIdx);

    if (videoRef.current && videoDuration > 0) {
      videoRef.current.currentTime = (nextIdx / totalFrames) * videoDuration;
    }
  };

  // Fallback source URL
  const currentPaddedIndex = String((frameIndex % totalFrames) + 1).padStart(3, '0');
  const currentFallbackSrc = hasFrames && turntable?.framesBaseUrl
    ? `${turntable.framesBaseUrl}${currentPaddedIndex}${turntable.framesExtension || '.jpg'}`
    : vehicle.imageUrl;

  return (
    <div className={`relative flex flex-col ${compact ? 'w-full' : 'w-full bg-[#080d1a] rounded-2xl border border-slate-800/80 p-4 sm:p-6 shadow-2xl overflow-hidden'}`}>
      {/* Cinematic Studio Turntable Stage */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className={`relative w-full rounded-xl overflow-hidden bg-gradient-to-b from-slate-950 via-[#060a12] to-[#04070e] border border-slate-800/90 flex items-center justify-center select-none ${
          compact ? 'h-52 cursor-grab active:cursor-grabbing' : 'h-80 sm:h-[420px] cursor-grab active:cursor-grabbing'
        }`}
      >
        {/* Subtle Studio Lighting & Radial Floor Reflection */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(56,189,248,0.06),transparent_65%)] pointer-events-none" />
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-4/5 h-16 bg-sky-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        {/* Scaled Car Canvas / Video with Zoom Support */}
        <div 
          className="w-full h-full flex items-center justify-center transition-transform duration-200 ease-out"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {hasFrames ? (
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain pointer-events-none"
            />
          ) : vehicle.video360Url ? (
            <video
              ref={videoRef}
              src={vehicle.video360Url}
              playsInline
              muted
              preload="auto"
              onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration || 10.0)}
              className="w-full h-full object-contain pointer-events-none"
            />
          ) : (
            <img
              src={currentFallbackSrc}
              alt={`${vehicle.brand} ${vehicle.name}`}
              className="w-full h-full object-contain pointer-events-none"
              referrerPolicy="no-referrer"
              draggable={false}
            />
          )}
        </div>

        {/* Top-Right HUD: Angle & Circular Continuity */}
        <div className="absolute top-3 right-3 pointer-events-none flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800/90 text-xs font-mono font-bold text-sky-400 shadow-lg">
            <RotateCw className="w-3.5 h-3.5 text-sky-400 animate-spin-slow" />
            <span>{currentAngleDeg}°</span>
            <span className="text-slate-500 text-[10px]">
              {currentAngleDeg < 45 || currentAngleDeg > 315
                ? 'FRONTAL'
                : currentAngleDeg >= 45 && currentAngleDeg < 135
                ? 'LATERAL DER.'
                : currentAngleDeg >= 135 && currentAngleDeg < 225
                ? 'TRASERA'
                : 'LATERAL IZQ.'}
            </span>
          </div>
        </div>

        {/* Top-Left Contextual Badge: Model & Official Price */}
        {!compact && (
          <div className="absolute top-3 left-3 pointer-events-none flex flex-col gap-1 z-10">
            <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl shadow-lg">
              <span className="text-[10px] font-mono text-sky-400 uppercase tracking-wider block font-bold">
                {vehicle.brand}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-black text-white font-display uppercase tracking-wide">
                  {vehicle.name}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  US$ {vehicle.equipment.priceUsd.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Floating Verified Spec Badges (Non-obstructive) */}
        {!compact && (
          <div className="absolute bottom-3 right-3 pointer-events-none hidden sm:flex items-center gap-2 z-10 text-[11px] font-mono">
            <div className="bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800/80 text-slate-300 flex items-center gap-1.5">
              <span className="text-sky-400 font-bold">{vehicle.powerHp} HP</span>
              <span className="text-slate-600">·</span>
              <span>{vehicle.torqueNm} Nm</span>
            </div>
            <div className="bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800/80 text-emerald-400 font-bold flex items-center gap-1.5">
              <span>{vehicle.consumptionBase} L/100km</span>
            </div>
            {vehicle.equipment.seatingCapacity === 7 && (
              <div className="bg-cyan-500/15 backdrop-blur-md px-2.5 py-1 rounded-lg border border-cyan-400/40 text-cyan-300 font-bold">
                7 Plazas
              </div>
            )}
          </div>
        )}

        {/* Bottom-Left Controls Bar: Play/Pause, Speed, Zoom */}
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md p-1 rounded-xl border border-slate-800/90 shadow-xl">
          {/* Play / Pause Auto-spin */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pausar rotación continua' : 'Iniciar rotación continua'}
            className={`p-2 rounded-lg border text-xs font-mono font-bold transition-all flex items-center gap-1 ${
              isPlaying
                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isPlaying ? 'Pausa' : 'Auto 360°'}</span>
          </button>

          {/* Speed Selector (0.5x, 1x, 2x) */}
          <div className="flex items-center border-l border-slate-800 pl-1.5 ml-0.5 gap-1">
            {([0.5, 1, 2] as const).map((spd) => (
              <button
                key={spd}
                onClick={() => setRotationSpeed(spd)}
                title={`Velocidad ${spd}x`}
                className={`px-1.5 py-1 rounded text-[10px] font-mono font-bold transition-colors ${
                  rotationSpeed === spd
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Zoom Selector (1x, 1.25x, 1.5x) */}
          <div className="flex items-center border-l border-slate-800 pl-1.5 ml-0.5 gap-1">
            <button
              onClick={() => setZoomLevel((prev) => (prev === 1 ? 1.25 : prev === 1.25 ? 1.5 : 1))}
              title="Acercar / Alejar cámara"
              className="px-2 py-1 rounded text-[10px] font-mono font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 flex items-center gap-1"
            >
              <ZoomIn className="w-3 h-3 text-sky-400" />
              <span>{zoomLevel}x</span>
            </button>
          </div>
        </div>
      </div>

      {/* 360° Circular Dial & Scrubbing Range */}
      <div className="mt-3 px-1 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            Arrastrá con el mouse o dedo para girar en 360°
          </span>
          <span className="text-sky-400 font-bold tabular-nums">{currentAngleDeg}° / 360°</span>
        </div>

        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={totalFrames - 1}
            step={1}
            value={frameIndex}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setFrameIndex(val);
              frameFloatRef.current = val;
              setIsPlaying(false);
              if (videoRef.current && videoDuration > 0) {
                videoRef.current.currentTime = (val / totalFrames) * videoDuration;
              }
            }}
            className="w-full h-2 bg-slate-800/90 rounded-lg appearance-none cursor-pointer accent-sky-400 hover:bg-slate-700 transition-colors"
          />
        </div>
      </div>
    </div>
  );
};

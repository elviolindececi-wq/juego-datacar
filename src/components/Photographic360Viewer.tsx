import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Vehicle } from '../types/vehicle';
import { RotateCw, Play, Pause } from 'lucide-react';

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

// Pre-cargar inmediatamente los 3 modelos oficiales en memoria al iniciar la app
if (typeof window !== 'undefined') {
  getOrLoadFrames('/assets/360_frames/kicks/frame_', 120, '.jpg');
  getOrLoadFrames('/assets/360_frames/carens/frame_', 120, '.jpg');
  getOrLoadFrames('/assets/360_frames/tracker/frame_', 120, '.jpg');
}

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
  const [isPlaying, setIsPlaying] = useState(false); // NO se reproduce sin fin por defecto
  const [isDragging, setIsDragging] = useState(false);

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
        // Renderizar frame 1 cuando esté listo
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
    const fps = 24; // 24 FPS continuos
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
  }, [isPlaying, totalFrames]);

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
    <div className={`relative flex flex-col ${compact ? 'w-full' : 'w-full bg-slate-900/95 rounded-2xl border border-slate-800 p-4 sm:p-6 shadow-2xl'}`}>
      {/* Escenario de Video 360 / Turntable (Completamente limpio, sin textos que tapen el video) */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className={`relative w-full rounded-xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center select-none ${
          compact ? 'h-48 cursor-grab active:cursor-grabbing' : 'h-72 sm:h-96 cursor-grab active:cursor-grabbing'
        }`}
      >
        {/* Canvas de renderizado instantáneo a 60 FPS sin parpadeos */}
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

        {/* Indicador discreto y elegante de ángulo 360° en la esquina superior */}
        <div className="absolute top-2.5 right-2.5 pointer-events-none flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-slate-800 text-[10px] font-mono font-bold text-sky-400">
          <RotateCw className="w-3 h-3 text-sky-400" />
          <span>{currentAngleDeg}°</span>
        </div>

        {/* Botón sutil de Play / Pausa en esquina inferior izquierda */}
        <div className="absolute bottom-2.5 left-2.5 z-10">
          <button
            onClick={(_e) => {
              setIsPlaying(!isPlaying);
            }}
            title={isPlaying ? 'Pausar giro automático' : 'Iniciar giro automático'}
            className={`p-1.5 rounded-lg border transition-all ${
              isPlaying
                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20'
                : 'bg-slate-950/80 backdrop-blur-md border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Barra de progreso de giro 360° intuitiva */}
      <div className="mt-2.5 px-1 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span className="font-semibold text-slate-300">
            {currentAngleDeg < 45 || currentAngleDeg > 315
              ? 'Frontal'
              : currentAngleDeg >= 45 && currentAngleDeg < 135
              ? 'Lateral Derecho'
              : currentAngleDeg >= 135 && currentAngleDeg < 225
              ? 'Trasera'
              : 'Lateral Izquierdo'}
          </span>
          <span className="text-sky-400 font-bold tabular-nums">{currentAngleDeg}°</span>
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
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
        </div>
      </div>
    </div>
  );
};

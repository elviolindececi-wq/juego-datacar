import React, { useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Vehicle } from '../types/vehicle';
import { getOfficialVehicleImageUrl } from '../data/presetVehicles';

export interface CutoutOrbitStop {
  angle: 'front34' | 'front' | 'side' | 'rear34' | 'rear';
  flipX: boolean;
  label: string;
}

export const CUTOUT_ORBIT_STOPS: CutoutOrbitStop[] = [
  { angle: 'front34', flipX: false, label: '3/4 Delantera' },
  { angle: 'front', flipX: false, label: 'Frontal' },
  { angle: 'front34', flipX: true, label: '3/4 Delantera Der.' },
  { angle: 'side', flipX: true, label: 'Perfil Der.' },
  { angle: 'rear34', flipX: true, label: '3/4 Trasera Der.' },
  { angle: 'rear', flipX: false, label: 'Trasera' },
  { angle: 'rear34', flipX: false, label: '3/4 Trasera Izq.' },
  { angle: 'side', flipX: false, label: 'Perfil Izq.' },
];

interface ArenaHeroCutoutViewProps {
  vehicle: Vehicle;
  compact?: boolean;
  imageBadgeLabel?: string | null;
  onOpen360Modal?: (vehicleId: string) => void;
}

/**
 * Escenario protagonista ligero basado exclusivamente en recorte oficial `.webp` / `.png`
 * sin importar Three.js en la pantalla de inicio ni en el Home móvil.
 */
export const ArenaHeroCutoutView: React.FC<ArenaHeroCutoutViewProps> = ({
  vehicle,
  compact = false,
  imageBadgeLabel = 'Vista PNG · Estudio',
  onOpen360Modal,
}) => {
  const [cutoutStopIndex, setCutoutStopIndex] = useState(0);
  const [isRotated, setIsRotated] = useState(false);

  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    lastX: number;
    accumulatedDx: number;
  }>({
    active: false,
    pointerId: -1,
    startX: 0,
    lastX: 0,
    accumulatedDx: 0,
  });

  const resetAngle = () => {
    setIsRotated(false);
    setCutoutStopIndex(0);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      lastX: e.clientX,
      accumulatedDx: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;
    const dx = e.clientX - st.lastX;
    st.lastX = e.clientX;
    st.accumulatedDx += dx;

    if (Math.abs(e.clientX - st.startX) > 6) {
      setIsRotated(true);
    }

    if (Math.abs(st.accumulatedDx) >= 36) {
      const steps = Math.trunc(st.accumulatedDx / 36);
      st.accumulatedDx -= steps * 36;
      setCutoutStopIndex(
        (prev) => (prev - steps + CUTOUT_ORBIT_STOPS.length * 8) % CUTOUT_ORBIT_STOPS.length,
      );
    }
  };

  const endPointerDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active || st.pointerId !== e.pointerId) return;
    st.active = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const activeCutout = useMemo(
    () => CUTOUT_ORBIT_STOPS[cutoutStopIndex] || CUTOUT_ORBIT_STOPS[0],
    [cutoutStopIndex],
  );

  return (
    <div
      className="relative w-full h-full flex items-center justify-center select-none cursor-grab active:cursor-grabbing touch-none"
      data-glb-status="image"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
      onDoubleClick={resetAngle}
      role="region"
      aria-label={`Escenario 3D de ${vehicle.brand} ${vehicle.name}. Arrastrá para girar en perspectiva 360 grados.`}
    >
      <div
        className="dc-arena-floor-glow pointer-events-none absolute bottom-[4%] left-[10%] right-[10%] h-[24%] rounded-full opacity-90"
        aria-hidden="true"
      />

      <div className="relative w-full h-full flex items-end justify-center pb-[5.5%] sm:pb-[4.5%] px-4 sm:px-8 pointer-events-none z-20">
        <div
          className="dc-arena-contact-shadow absolute bottom-[4.5%] w-[76%] max-w-[640px] h-[14%] rounded-full"
          aria-hidden="true"
        />
        <img
          key={vehicle.id}
          src={vehicle.imageUrl || getOfficialVehicleImageUrl(vehicle.id)}
          alt={`${vehicle.brand} ${vehicle.name}`}
          referrerPolicy="no-referrer"
          draggable={false}
          className={`dc-arena-cutout-img relative z-10 w-auto object-contain transition-transform duration-150 ${
            compact
              ? 'max-h-[34dvh] sm:max-h-[42dvh] md:max-h-[48dvh] max-w-[88%]'
              : 'max-h-[34dvh] sm:max-h-[44dvh] lg:max-h-[52dvh] max-w-[90%]'
          } ${activeCutout.flipX ? '-scale-x-100' : ''}`}
        />
      </div>

      <div className="absolute top-2 right-2 sm:right-6 z-30 flex flex-wrap items-center justify-end gap-1.5">
        {imageBadgeLabel ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#06141d]/90 border border-[#00E5F5]/40 text-[10px] font-bold uppercase tracking-wider text-cyan-200 whitespace-nowrap">
            <span>{imageBadgeLabel}</span>
          </span>
        ) : null}

        {isRotated && (
          <button
            type="button"
            onClick={resetAngle}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#061219]/90 border border-[#00E5F5]/45 text-[10px] font-bold uppercase tracking-wider text-[#00E5F5] hover:border-[#00E5F5] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Restablecer ángulo protagonista"
          >
            <RotateCcw size={12} />
            <span>Vista 3/4</span>
          </button>
        )}

        {onOpen360Modal && (
          <button
            type="button"
            onClick={() => onOpen360Modal(vehicle.id)}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#061219]/85 border border-slate-500/40 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:border-[#00E5F5]/60 hover:text-[#00E5F5] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Visor 360°</span>
          </button>
        )}
      </div>
    </div>
  );
};

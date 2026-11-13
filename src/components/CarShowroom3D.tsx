import React, { useState } from 'react';
import { Vehicle } from '../types/vehicle';
import { Photographic360Viewer } from './Photographic360Viewer';
import { ArenaHero3DStage } from './ArenaHero3DStage';
import { Box, Fuel, Gauge, CheckCircle2, Image as ImageIcon, RotateCw } from 'lucide-react';
import {
  formatOfficialClearance,
  formatOfficialPower,
  formatOfficialTorque,
  formatOfficialWeight,
} from '../utils/specFidelity';

interface CarShowroom3DProps {
  vehicle: Vehicle;
  pngOnly?: boolean;
  allow3DToggle?: boolean;
}

type ShowroomViewMode = 'image' | 'glb3d' | 'turntable360';

export const CarShowroom3D: React.FC<CarShowroom3DProps> = ({
  vehicle,
  pngOnly = true,
  allow3DToggle = false,
}) => {
  const [viewMode, setViewMode] = useState<ShowroomViewMode>(() =>
    !pngOnly ? 'glb3d' : 'image',
  );

  const effectivePngOnly = allow3DToggle ? viewMode !== 'glb3d' : pngOnly;
  const isTurntable360 = viewMode === 'turntable360';

  return (
    <div className="bg-[#061219]/96 border border-[#00E5F5]/35 rounded-2xl overflow-hidden shadow-[0_18px_48px_rgba(0,0,0,0.8)] flex flex-col">
      {/* Top Header Strip */}
      <div className="px-5 py-3 border-b border-[#00E5F5]/20 bg-[#040d15]/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-1.5 -skew-x-16 bg-[#00E5F5] shadow-[0_0_8px_#00E5F5] shrink-0" />
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="text-[#00E5F5] font-bold uppercase">
                {vehicle.brand} {vehicle.name}
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="text-slate-300 font-semibold">{vehicle.trim}</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {isTurntable360
                ? 'Secuencia fotográfica 360° de estudio · Arrastrá para girar'
                : effectivePngOnly
                  ? 'Vista oficial PNG / WebP interactiva · Arrastrá para girar ángulos'
                  : 'Modelo 3D GLB fiel al original · Arrastrá horizontalmente para girar en 360°'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick specs summary */}
          <div className="hidden xl:flex items-center gap-3 text-xs font-mono text-slate-300 bg-[#081824]/90 px-3 py-1.5 rounded-xl border border-[#00E5F5]/25">
            <div className="flex items-center gap-1.5 text-[#00E5F5] font-bold">
              <Gauge className="w-3.5 h-3.5" />
              <span>{formatOfficialPower(vehicle, 'HP')}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span>{formatOfficialTorque(vehicle)}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Fuel className="w-3.5 h-3.5" />
              <span>
                {vehicle.estimatedSimulationParameters ? '≈ ' : ''}
                {vehicle.consumptionBase} L/100km
                {vehicle.estimatedSimulationParameters ? ' (sim.)' : ''}
              </span>
            </div>
          </div>

          {allow3DToggle ? (
            <div
              className="inline-flex items-center rounded-xl border border-[#00E5F5]/35 bg-[#071620]/95 p-1 gap-1"
              role="group"
              aria-label="Modo de visualización en Comparar"
            >
              <button
                type="button"
                onClick={() => setViewMode('image')}
                aria-pressed={viewMode === 'image'}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'image'
                    ? 'bg-[#00E5F5] text-[#04131A] shadow-[0_0_12px_rgba(0,229,245,0.35)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>PNG / WebP</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('glb3d')}
                aria-pressed={viewMode === 'glb3d'}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'glb3d'
                    ? 'bg-[#00E5F5] text-[#04131A] shadow-[0_0_12px_rgba(0,229,245,0.35)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>Ver en 3D (GLB)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('turntable360')}
                aria-pressed={viewMode === 'turntable360'}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'turntable360'
                    ? 'bg-[#00E5F5] text-[#04131A] shadow-[0_0_12px_rgba(0,229,245,0.35)]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>360°</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === 'turntable360' ? 'image' : 'turntable360'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#00E5F5]/40 bg-[#102C38]/85 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#00E5F5] hover:border-[#00E5F5] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{isTurntable360 ? 'Vista Garage PNG' : 'Visor 360° Estudio'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Escenario Arena PNG/WebP o Modelo 3D GLB bajo demanda */}
      {isTurntable360 ? (
        <div className="p-4 sm:p-6 bg-[#050d16]/70">
          <Photographic360Viewer
            key={vehicle.id}
            vehicle={vehicle}
            compact={false}
            initialMode="frames"
          />
        </div>
      ) : (
        <div className="relative h-80 sm:h-[430px] w-full overflow-hidden bg-[#061219]">
          <img
            src="/assets/aistudio/arena_home_bg_4f3f8584.webp"
            alt=""
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_63%] scale-[1.03]"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 46% 24% at 50% 30%, rgba(6, 18, 25, 0.92) 0%, rgba(6, 18, 25, 0.55) 60%, rgba(6, 18, 25, 0) 100%), linear-gradient(180deg, rgba(4, 12, 18, 0.65) 0%, rgba(6, 18, 25, 0.08) 54%, rgba(3, 9, 14, 0.82) 100%)',
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full w-full">
            <ArenaHero3DStage
              vehicle={vehicle}
              pngOnly={effectivePngOnly}
              imageBadgeLabel={allow3DToggle ? 'Vista PNG / WebP' : 'Vista PNG · Garage'}
            />
          </div>
        </div>
      )}

      {/* Technical Summary Bar under Showroom */}
      <div className="px-5 py-3 border-t border-[#00E5F5]/20 bg-[#040d15]/85 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            Ficha cargada en DATACAR:{' '}
            <strong className="text-white">
              {vehicle.brand} {vehicle.name}
            </strong>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px] tabular-nums">
          <span>
            Dimensiones:{' '}
            <span className="text-slate-300">
              {vehicle.dimensions.lengthMm} × {vehicle.dimensions.widthMm} ×{' '}
              {vehicle.dimensions.heightMm} mm
            </span>
          </span>
          <span className="hidden md:inline">
            Despeje del suelo:{' '}
            <span className="text-slate-300">{formatOfficialClearance(vehicle)}</span>
          </span>
          <span>
            Peso:{' '}
            <span className="text-slate-300">{formatOfficialWeight(vehicle, true)}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Vehicle } from '../types/vehicle';
import { Photographic360Viewer } from './Photographic360Viewer';
import { Fuel, Gauge, CheckCircle2 } from 'lucide-react';

interface CarShowroom3DProps {
  vehicle: Vehicle;
}

export const CarShowroom3D: React.FC<CarShowroom3DProps> = ({ vehicle }) => {
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
                Fotografía Oficial 0KM
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Rotación 360° continua con el mouse · Girar alrededor de su propio eje
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
            <span>{vehicle.consumptionBase} L/100km</span>
          </div>
        </div>
      </div>

      {/* Main Photographic Turntable Stage */}
      <div className="p-4 sm:p-6 bg-slate-950/40">
        <Photographic360Viewer
          vehicle={vehicle}
          compact={false}
        />
      </div>

      {/* Technical Summary Bar under Showroom */}
      <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Modelo Real Verificado: <strong className="text-white">{vehicle.brand} {vehicle.name}</strong></span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>Dimensiones: <span className="text-slate-300">{vehicle.dimensions.lengthMm} × {vehicle.dimensions.widthMm} × {vehicle.dimensions.heightMm} mm</span></span>
          <span className="hidden md:inline">Despeje del suelo: <span className="text-slate-300">{vehicle.dimensions.clearanceMm} mm</span></span>
          <span>Peso tara: <span className="text-slate-300">{vehicle.weightKg} kg</span></span>
        </div>
      </div>
    </div>
  );
};

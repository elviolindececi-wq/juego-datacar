import React from 'react';
import { Vehicle } from '../types/vehicle';
import { Zap, Weight, Gauge, Fuel, Check, SlidersHorizontal, ShieldAlert, Truck } from 'lucide-react';

interface VehicleCardProps {
  vehicle: Vehicle;
  isSelected: boolean;
  onToggleSelect: (vehicleId: string) => void;
  onEditSpecs: (vehicle: Vehicle) => void;
  disableSelection?: boolean;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  isSelected,
  onToggleSelect,
  onEditSpecs,
  disableSelection = false,
}) => {
  const powerToWeight = Math.round((vehicle.powerHp / (vehicle.weightKg / 1000)) * 10) / 10;

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
        isSelected
          ? 'bg-slate-900/90 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500'
          : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top Banner Accent */}
      <div
        className="h-1.5 w-full transition-opacity"
        style={{ backgroundColor: vehicle.color }}
      />

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span>{vehicle.brand}</span>
                <span aria-hidden="true">·</span>
                <span>{vehicle.year}</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-300 font-semibold">{vehicle.drivetrain}</span>
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                {vehicle.name}
              </h3>
            </div>

            {/* Selection Checkbox */}
            <button
              onClick={() => onToggleSelect(vehicle.id)}
              disabled={!isSelected && disableSelection}
              aria-label={isSelected ? 'Deseleccionar vehículo' : 'Seleccionar para carrera'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : disableSelection
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-800'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 border border-slate-700'
              }`}
            >
              {isSelected ? <Check className="w-4 h-4 stroke-[2.5]" /> : <span className="text-xs font-mono">+</span>}
            </button>
          </div>

          <p className="text-xs text-slate-400 line-clamp-2 mb-4">
            {vehicle.description}
          </p>

          {/* Key Engineering Specs Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums mb-4">
            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
                <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> Potencia</span>
                <span className="text-white font-bold">{vehicle.powerHp} HP</span>
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>Par:</span>
                <span className="text-slate-300">{vehicle.torqueNm} Nm</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
                <span className="flex items-center gap-1"><Weight className="w-3 h-3 text-sky-400" /> Masa</span>
                <span className="text-white font-bold">{vehicle.weightKg.toLocaleString()} kg</span>
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>Relación:</span>
                <span className="text-emerald-400 font-semibold">{powerToWeight} HP/t</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
                <span className="flex items-center gap-1"><Gauge className="w-3 h-3 text-red-400" /> 0-100 km/h</span>
                <span className="text-white font-bold">{vehicle.accel0100}s</span>
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>Punta:</span>
                <span className="text-slate-300">{vehicle.topSpeedKmh} km/h</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <div className="flex items-center justify-between text-slate-400 text-[11px] mb-0.5">
                <span className="flex items-center gap-1"><Truck className="w-3 h-3 text-purple-400" /> Carga máx</span>
                <span className="text-white font-bold">{vehicle.maxPayloadKg.toLocaleString()} kg</span>
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>Tanque:</span>
                <span className="text-slate-300">{vehicle.fuelCapacityL}{vehicle.fuelType === 'electric' ? ' kWh' : ' L'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <span>Cx {vehicle.dragCoeff}</span>
            <span aria-hidden="true">·</span>
            <span>Grip {vehicle.tireGrip}x</span>
          </div>

          <button
            onClick={() => onEditSpecs(vehicle)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded hover:bg-blue-500/10 transition-colors"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Ficha Técnica</span>
          </button>
        </div>
      </div>
    </div>
  );
};

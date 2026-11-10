import React from 'react';
import { Vehicle, VehicleMatchScore } from '../types/vehicle';
import { Star, MessageCircle, Check, Plus, Info, Eye } from 'lucide-react';
import { Photographic360Viewer } from './Photographic360Viewer';

import { hasVehicle3DModel } from '../utils/vehicle3DModelLoader';

interface DealershipCardsHeaderProps {
  vehicles: Vehicle[];
  matchScores: VehicleMatchScore[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onOpenSpecs: (v: Vehicle) => void;
  activeShowroomId?: string;
  onSelectShowroom?: (id: string) => void;
}

export const DealershipCardsHeader: React.FC<DealershipCardsHeaderProps> = ({
  vehicles,
  matchScores,
  selectedIds,
  onToggleSelect,
  onOpenSpecs,
  activeShowroomId,
  onSelectShowroom,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {vehicles.map((v) => {
        const score = matchScores.find((s) => s.vehicleId === v.id);
        const matchPercent = score ? score.totalMatchPercent : 50;
        const isBest = score ? score.isBestMatch : false;
        const isSelected = selectedIds.includes(v.id);
        const isActiveInShowroom = activeShowroomId === v.id;

        return (
          <div
            key={v.id}
            className={`rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col justify-between relative shadow-xl ${
              isActiveInShowroom
                ? 'bg-slate-900 border-sky-400 ring-2 ring-sky-400/50 shadow-sky-500/20'
                : isBest
                ? 'bg-slate-900/90 border-sky-400/60 ring-1 ring-sky-400/20'
                : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            {/* Top Bar Accent with Brand & Close/Toggle */}
            <div className="p-4 pb-2 flex items-start justify-between">
              <div
                className="cursor-pointer group flex-1"
                onClick={() => onSelectShowroom && onSelectShowroom(v.id)}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold block">
                    {v.brand}
                  </span>
                  {hasVehicle3DModel(v.id) && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold font-mono px-1.5 py-0.2 rounded uppercase">
                      3D GLB
                    </span>
                  )}
                  {isActiveInShowroom && (
                    <span className="text-[9px] bg-sky-500 text-slate-950 font-bold font-mono px-1.5 py-0.2 rounded-full uppercase">
                      Activo 360°
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-black text-white font-display tracking-wide group-hover:text-sky-300 transition-colors">
                  {v.name}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {v.trim}
                </span>
              </div>

              {/* Race Selection Toggle */}
              <button
                onClick={() => onToggleSelect(v.id)}
                title={isSelected ? 'En pista de carrera' : 'Añadir a carrera'}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  isSelected
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                {isSelected ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>

            {/* Interactive 360° Turntable */}
            <div className="px-4 py-2">
              <Photographic360Viewer
                key={v.id}
                vehicle={v}
                compact={true}
                onOpenSpecs={() => onOpenSpecs(v)}
              />

              {/* Action buttons under photo: Ver en Showroom & Ficha Técnica */}
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-300">
                <button
                  onClick={() => onSelectShowroom && onSelectShowroom(v.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-all ${
                    isActiveInShowroom
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/50'
                      : 'bg-slate-950/90 text-slate-400 hover:text-sky-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <Eye className="w-3 h-3 text-sky-400" />
                  <span>{isActiveInShowroom ? 'En Showroom' : 'Abrir en 360°'}</span>
                </button>

                <button
                  onClick={() => onOpenSpecs(v)}
                  className="text-slate-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                >
                  <Info className="w-3 h-3" />
                  <span>Ficha Técnica</span>
                </button>
              </div>
            </div>

            {/* Afinidad Match Strip */}
            <div className="px-5 py-2.5 bg-slate-950/70 border-t border-b border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-300">
                  {isBest ? (
                    <span className="text-sky-400 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-sky-400 text-sky-400" />
                      ★ MAYOR AFINIDAD
                    </span>
                  ) : (
                    <span>AFINIDAD</span>
                  )}
                </span>
                <span className={`font-bold tabular-nums text-sm ${isBest ? 'text-sky-400' : 'text-slate-300'}`}>
                  {matchPercent}% Match
                </span>
              </div>

              {/* Match Progress Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isBest ? 'bg-sky-400' : 'bg-slate-500'
                  }`}
                  style={{ width: `${matchPercent}%` }}
                />
              </div>
            </div>

            {/* Price and CTA */}
            <div className="p-4 flex items-center justify-between gap-3 bg-slate-900/90">
              <div>
                <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">
                  PRECIO CONTADO
                </span>
                <span className="text-lg font-black text-white font-mono tabular-nums">
                  US$ {v.equipment.priceUsd.toLocaleString()}
                </span>
              </div>

              <a
                href={`https://datacarpy.com`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-mono text-xs font-bold tracking-wider uppercase border border-slate-700 hover:border-sky-500 transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-md"
              >
                <MessageCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>CONSULTAR</span>
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};

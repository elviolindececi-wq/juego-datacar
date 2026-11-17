import React from 'react';
import { Check, CloudRain, Disc, Gauge, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { enableTireShowroom } from '../config/featureFlags';
import type { Vehicle } from '../types/vehicle';
import {
  useTireCatalogSelection,
  type TireCompoundId,
  type TireCompoundSpec,
} from '../utils/tireCatalog';

export interface TireShowroomSectionProps {
  selectedVehicle?: Vehicle | null;
  compact?: boolean;
  onSelectCompound?: (compoundId: TireCompoundId) => void;
}

function TireCompoundGraphic({
  spec,
  active,
}: {
  spec: TireCompoundSpec;
  active: boolean;
}) {
  return (
    <div
      className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl border bg-[#040a12] shadow-inner transition-transform"
      style={{
        borderColor: active ? spec.accentColorHex : 'rgba(148,163,184,0.25)',
      }}
    >
      <svg viewBox="0 0 120 120" className="h-14 w-14 sm:h-16 sm:w-16" aria-hidden="true">
        <defs>
          <radialGradient id={`tireRubber-${spec.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="56%" stopColor="#1e293b" />
            <stop offset="84%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="108" rx="36" ry="5" fill={spec.accentColorHex} fillOpacity="0.22" />
        <circle
          cx="60"
          cy="58"
          r="45"
          fill={`url(#tireRubber-${spec.id})`}
          stroke={active ? spec.accentColorHex : '#334155'}
          strokeWidth="2.8"
        />
        <circle
          cx="60"
          cy="58"
          r="39"
          fill="none"
          stroke={spec.accentColorHex}
          strokeWidth="1.5"
          strokeOpacity="0.8"
        />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <line
            key={deg}
            x1="60"
            y1="13"
            x2="60"
            y2="20"
            stroke={active ? spec.accentColorHex : '#64748b'}
            strokeWidth="2.5"
            transform={`rotate(${deg} 60 58)`}
          />
        ))}
        <circle cx="60" cy="58" r="28" fill="#09101d" stroke="#cbd5e1" strokeWidth="3.2" />
        <circle
          cx="60"
          cy="58"
          r="19"
          fill="none"
          stroke="#475569"
          strokeWidth="4.5"
          strokeDasharray="6 3"
        />
        <path
          d="M 73 43 A 20 20 0 0 1 79 62 L 71 62 A 13 13 0 0 0 67 48 Z"
          fill={spec.accentColorHex}
        />
        {[0, 72, 144, 216, 288].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 60 58)`}>
            <polygon points="56,58 53,30 58,30 59,58" fill="#e2e8f0" />
            <polygon points="64,58 62,30 67,30 61,58" fill="#94a3b8" />
          </g>
        ))}
        <circle cx="60" cy="58" r="8" fill="#0f172a" stroke={spec.accentColorHex} strokeWidth="2" />
      </svg>
    </div>
  );
}

/**
 * DATACAR ARENA — SHOWROOM Y CATÁLOGO INTERACTIVO DE CUBIERTAS
 * Permite elegir el compuesto de neumáticos para mejorar el agarre, la evacuación en raudales,
 * la absorción de baches y la distancia de frenado del vehículo seleccionado, con arquitectura
 * lista para patrocinador oficial (`ACTIVE_TIRE_SPONSOR`).
 */
export const TireShowroomSection: React.FC<TireShowroomSectionProps> = ({
  selectedVehicle,
  compact = false,
  onSelectCompound,
}) => {
  const vehicleId = selectedVehicle?.id ?? 'toyota-corolla-cross-seg-2027';
  const { selectedCompoundId, selectedSpec, sponsor, catalog, selectCompound } =
    useTireCatalogSelection(vehicleId);
  const oemTireSize = selectedVehicle?.technicalDetails?.tireSize || '215/60 R17';

  if (!enableTireShowroom) return null;

  const handleChoose = (id: TireCompoundId) => {
    selectCompound(id);
    onSelectCompound?.(id);
  };

  return (
    <section
      aria-labelledby="dc-tire-showroom-heading"
      data-testid="tire-showroom-section"
      data-enabled="true"
      className={`relative overflow-hidden rounded-2xl border border-[#00E5F5]/35 bg-gradient-to-br from-[#060f1c] via-[#091829] to-[#111827] ${
        compact ? 'p-3.5 sm:p-4' : 'p-5 sm:p-6'
      } shadow-[0_18px_48px_rgba(0,0,0,0.8)]`}
    >
      {/* Cabecera del Showroom + Espacio para Sponsor Oficial */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#00E5F5]/20 pb-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider">
            <span
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 font-black"
              style={{
                borderColor: `${sponsor.accentColorHex}88`,
                backgroundColor: `${sponsor.accentColorHex}22`,
                color: sponsor.accentColorHex,
              }}
            >
              <Sparkles className="h-3 w-3" />
              <span>{sponsor.displayName}</span>
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-[#00E5F5] tabular-nums">
              MEDIDA HOMOLOGADA {selectedVehicle?.name || 'SUV'}: {oemTireSize}
            </span>
          </div>

          <h3
            id="dc-tire-showroom-heading"
            className="mt-1 font-display text-xl sm:text-2xl font-black italic uppercase tracking-wide text-white"
          >
            CATÁLOGO DE CUBIERTAS Y COMPUESTOS DE PISTA
          </h3>
          <p className="text-xs text-slate-300">
            Elegí el tipo de cubierta ideal según el clima y el asfalto del circuito. Impacta directamente en agarre, frenada y absorción de baches.
          </p>
        </div>

        {/* Insignia del compuesto activo + Etiqueta Sponsor Ready */}
        <div className="flex flex-col items-start sm:items-end gap-1">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/55 bg-emerald-950/75 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            <span>INSTALADO: {selectedSpec.code}</span>
          </span>
          {sponsor.isSponsorSlotAvailable && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300/90">
              ★ {sponsor.tagline}
            </span>
          )}
        </div>
      </div>

      {/* Grilla de los 4 compuestos seleccionables */}
      <div className="relative z-10 mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {catalog.map((compound) => {
          const isSelected = compound.id === selectedCompoundId;
          return (
            <button
              key={compound.id}
              type="button"
              data-testid={`tire-compound-${compound.id}`}
              aria-pressed={isSelected}
              onClick={() => handleChoose(compound.id)}
              className={`group flex flex-col justify-between rounded-xl border p-3.5 text-left transition cursor-pointer ${
                isSelected
                  ? 'border-[#00E5F5] bg-[#082236]/95 shadow-[0_0_20px_rgba(0,229,245,0.26)]'
                  : 'border-slate-700/80 bg-[#050e18]/90 hover:border-cyan-400/60 hover:bg-[#071726]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2.5">
                  <TireCompoundGraphic spec={compound} active={isSelected} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="rounded px-2 py-0.5 font-mono text-[10px] font-black uppercase"
                        style={{
                          backgroundColor: `${compound.accentColorHex}25`,
                          color: compound.accentColorHex,
                        }}
                      >
                        {compound.code}
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-300">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                          <span>ACTIVA</span>
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1 font-display text-sm sm:text-base font-black italic uppercase leading-tight text-white">
                      {compound.modelName}
                    </h4>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      {compound.categoryBadge}
                    </p>
                  </div>
                </div>

                <p className="mt-2.5 text-xs text-slate-300 leading-snug">
                  {compound.shortDescription}
                </p>

                <div className="mt-2 rounded-lg border border-slate-800 bg-[#030911] px-2.5 py-1.5 text-[11px] font-mono text-cyan-200">
                  {compound.technicalHighlight}
                </div>

                {/* Barras comparativas de rendimiento */}
                <div className="mt-2.5 space-y-1.5 text-[10px] font-mono">
                  {[
                    ['Agarre en seco', compound.ratings.dryGrip, Gauge],
                    ['Evacuación raudal', compound.ratings.wetDrainage, CloudRain],
                    ['Frenada 100–0', compound.ratings.brakingResponse, Disc],
                    ['Absorción baches', compound.ratings.potholeDurability, Zap],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="space-y-0.5">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>{String(label)}</span>
                        <span className="font-bold text-white tabular-nums">{Number(val)}/100</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Number(val)}%`,
                            backgroundColor: compound.accentColorHex,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/90 flex items-center justify-between text-[11px] font-bold uppercase">
                <span className="text-slate-400 truncate max-w-[65%]">
                  Ideal: {compound.recommendedCircuitProfile}
                </span>
                <span
                  className={
                    isSelected ? 'text-emerald-300 font-black' : 'text-[#00E5F5] group-hover:text-white'
                  }
                >
                  {isSelected ? '✓ Equipada' : 'Instalar →'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

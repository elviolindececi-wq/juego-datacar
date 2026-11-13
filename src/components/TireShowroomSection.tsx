import React from 'react';
import { Lock } from 'lucide-react';
import { enableTireShowroom, INITIAL_TIRE_SHOWROOM_CONFIG } from '../config/featureFlags';
import type { Vehicle } from '../types/vehicle';

export interface TireShowroomSectionProps {
  selectedVehicle?: Vehicle | null;
  compact?: boolean;
}

/**
 * DATACAR ARENA — SHOWROOM DE CUBIERTAS (§12)
 * Espacio comercial preparado dentro del Garaje para un futuro patrocinador oficial.
 * Controlado explícitamente por `enableTireShowroom = false`:
 * - Permanece visualmente presente pero comercial y funcionalmente bloqueado.
 * - Cero marcas ficticias, cero precios inventados, cero upgrades de rendimiento.
 */
export const TireShowroomSection: React.FC<TireShowroomSectionProps> = ({
  selectedVehicle,
  compact = false,
}) => {
  const isUnlocked = enableTireShowroom && INITIAL_TIRE_SHOWROOM_CONFIG.sponsor !== null;
  const oemTireSize = selectedVehicle?.technicalDetails?.tireSize || 'No especificado';

  return (
    <section
      aria-labelledby="dc-tire-showroom-heading"
      data-testid="tire-showroom-section"
      data-enabled={isUnlocked ? 'true' : 'false'}
      className={`relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-[#060d1a] via-[#091628] to-[#111827] ${
        compact ? 'p-3.5 sm:p-4' : 'p-5 sm:p-6'
      } shadow-xl`}
    >
      {/* Iluminación ambiental de showroom cian y naranja competición */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-cyan-500/12 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -right-12 h-44 w-44 rounded-full bg-orange-500/14 blur-2xl"
      />

      <div
        className={`relative z-10 flex ${
          compact ? 'flex-col sm:flex-row items-start sm:items-center gap-3.5' : 'flex-col md:flex-row items-start md:items-center gap-5'
        } justify-between`}
      >
        {/* Neumático y llanta metálica de estudio con candado discreto */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-[#050b14] shadow-inner">
            <svg
              viewBox="0 0 120 120"
              className="h-16 w-16 sm:h-20 sm:w-20"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="dcTireRubber" cx="50%" cy="50%" r="50%">
                  <stop offset="56%" stopColor="#1e293b" />
                  <stop offset="82%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#020617" />
                </radialGradient>
                <linearGradient id="dcRimAlloy" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e2e8f0" />
                  <stop offset="48%" stopColor="#64748b" />
                  <stop offset="100%" stopColor="#cbd5e1" />
                </linearGradient>
                <linearGradient id="dcShowroomRimAccent" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00e5ff" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              {/* Sombra de apoyo en piso de showroom */}
              <ellipse cx="60" cy="108" rx="38" ry="6" fill="rgba(0,229,255,0.16)" />
              {/* Banda de rodadura exterior */}
              <circle cx="60" cy="58" r="46" fill="url(#dcTireRubber)" stroke="#334155" strokeWidth="2.5" />
              <circle cx="60" cy="58" r="41" fill="none" stroke="url(#dcShowroomRimAccent)" strokeWidth="1.4" strokeOpacity="0.65" />
              {/* Surcos técnicos del neumático */}
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
                <line
                  key={deg}
                  x1="60"
                  y1="12"
                  x2="60"
                  y2="19"
                  stroke="#475569"
                  strokeWidth="2.4"
                  transform={`rotate(${deg} 60 58)`}
                />
              ))}
              {/* Aro metálico diamantado */}
              <circle cx="60" cy="58" r="30" fill="#09101d" stroke="url(#dcRimAlloy)" strokeWidth="4" />
              {/* Disco de freno ventilado y caliper naranja competición */}
              <circle cx="60" cy="58" r="21" fill="none" stroke="#475569" strokeWidth="5" strokeDasharray="6 3" />
              <path d="M 74 42 A 22 22 0 0 1 81 62 L 73 62 A 14 14 0 0 0 68 47 Z" fill="#f97316" />
              {/* 5 rayos dobles de aleación */}
              {[0, 72, 144, 216, 288].map(deg => (
                <g key={deg} transform={`rotate(${deg} 60 58)`}>
                  <polygon points="56,58 53,29 58,29 59,58" fill="url(#dcRimAlloy)" />
                  <polygon points="64,58 62,29 67,29 61,58" fill="url(#dcRimAlloy)" />
                </g>
              ))}
              {/* Maza central */}
              <circle cx="60" cy="58" r="8.5" fill="#0f172a" stroke="#00e5ff" strokeWidth="1.8" />
            </svg>

            {!isUnlocked && (
              <span
                aria-hidden="true"
                className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-orange-400/55 bg-[#0b1322] text-orange-300 shadow-md"
              >
                <Lock className="h-3.5 w-3.5" />
              </span>
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-wider uppercase">
              <span className="text-orange-300">PRÓXIMAMENTE</span>
              {selectedVehicle && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-cyan-300/90 tabular-nums">
                    Medida ficha {selectedVehicle.name}: {oemTireSize}
                  </span>
                </>
              )}
            </div>

            <h3
              id="dc-tire-showroom-heading"
              className={`${compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} font-black tracking-tight text-white uppercase`}
            >
              SHOWROOM DE CUBIERTAS
            </h3>

            <p className="text-xs sm:text-sm font-medium text-slate-200">
              Prepará tu auto para nuevos desafíos.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Esta función estará disponible cuando llegue nuestro sponsor oficial.
            </p>
          </div>
        </div>

        {/* Acción explícitamente deshabilitada con explicación clara (§12 y §13.F) */}
        <div className="flex flex-col items-stretch sm:items-end gap-1.5 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            disabled={!isUnlocked}
            aria-disabled={!isUnlocked}
            title="Bloqueado hasta confirmación de sponsor oficial"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-700/90 bg-[#0b1526] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 cursor-not-allowed whitespace-nowrap"
          >
            <Lock className="h-3.5 w-3.5 text-orange-400 shrink-0" />
            <span>PRÓXIMAMENTE · SPONSOR OFICIAL</span>
          </button>
          <span className="text-[11px] text-slate-500 sm:text-right">
            Sin modificaciones de adherencia ni mejoras activas
          </span>
        </div>
      </div>
    </section>
  );
};

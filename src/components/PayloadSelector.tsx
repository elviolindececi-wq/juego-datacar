import React from 'react';
import { Luggage, Users } from 'lucide-react';
import type { Vehicle } from '../types/vehicle';
import {
  LUGGAGE_TIERS,
  computePayloadHandlingInsight,
  getMaxOccupantsForVehicle,
  type LuggageLoadTier,
  type VehiclePayloadSelection,
} from '../utils/payloadConfig';

interface PayloadSelectorProps {
  vehicle: Vehicle | null | undefined;
  value: VehiclePayloadSelection;
  onChange: (next: VehiclePayloadSelection) => void;
  compact?: boolean;
}

export const PayloadSelector: React.FC<PayloadSelectorProps> = ({
  vehicle,
  value,
  onChange,
  compact = false,
}) => {
  const maxSeats = getMaxOccupantsForVehicle(vehicle);
  const clampedOccupants = Math.max(1, Math.min(maxSeats, value.occupants));
  const insight = computePayloadHandlingInsight(
    { occupants: clampedOccupants, luggageTier: value.luggageTier },
    vehicle,
  );

  return (
    <div
      className={`rounded-2xl border border-slate-700/80 bg-slate-900/85 ${
        compact ? 'p-3' : 'p-4'
      } text-slate-100`}
      data-testid="payload-selector"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-cyan-400 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
            Ocupantes y Carga Real
          </span>
        </div>
        <span className="rounded-md border border-cyan-500/35 bg-cyan-950/60 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-200 tabular-nums">
          +{insight.extraKg} kg · Masa total {insight.totalMassKg} kg
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {/* Ocupantes dentro del vehículo */}
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Personas a bordo (máx. {maxSeats} plazas en ficha)
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cantidad de ocupantes">
            {Array.from({ length: maxSeats }, (_, idx) => idx + 1).map((count) => {
              const active = clampedOccupants === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => onChange({ ...value, occupants: count })}
                  aria-pressed={active}
                  className={`min-w-[34px] rounded-lg border px-2.5 py-1.5 text-xs font-black tabular-nums transition-colors cursor-pointer ${
                    active
                      ? 'border-cyan-400 bg-cyan-500/20 text-white shadow-[0_0_10px_rgba(34,211,238,0.25)]'
                      : 'border-slate-700 bg-slate-950/80 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {count}
                </button>
              );
            })}
          </div>
        </div>

        {/* Equipaje en baulera */}
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <Luggage size={12} className="text-amber-300" />
            Equipaje adicional
          </p>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Carga de equipaje">
            {LUGGAGE_TIERS.map((tier) => {
              const active = value.luggageTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => onChange({ ...value, luggageTier: tier.id as LuggageLoadTier })}
                  aria-pressed={active}
                  className={`rounded-lg border px-2 py-1.5 text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-amber-400 bg-amber-500/15 text-amber-100'
                      : 'border-slate-700 bg-slate-950/80 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <div className="text-[10px] font-black leading-tight">{tier.label}</div>
                  <div className="font-mono text-[9px] text-slate-400">+{tier.kg} kg</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-[11px] leading-snug text-slate-400">
        {insight.extraKg > 0 ? (
          <>
            Impacto en física: <strong className="text-slate-200">+{insight.accelPenaltyPct}% masa</strong>{' '}
            (frenada aprox. <strong className="text-amber-300">+{insight.brakingExtensionPct}%</strong>).
            {insight.iqCleanLoadBonus > 0 && (
              <span className="text-emerald-300">
                {' '}
                Conducción limpia con {clampedOccupants} ocupantes suma hasta +{insight.iqCleanLoadBonus} IQ.
              </span>
            )}
          </>
        ) : (
          'Solo conductor (masa en orden de marcha). Sumá pasajeros para probar el peso real al acelerar y frenar.'
        )}
      </p>
    </div>
  );
};

import React from 'react';
import type { Vehicle } from '../types/vehicle';
import { resolveComparatorVehicleStats } from '../utils/comparatorHelpers';

interface VehicleSpecsPanelProps {
  vehicle: Vehicle;
  context?: 'race' | 'compare' | string;
  onRace?: () => void;
  raceLabel?: string;
}

/**
 * Ficha técnica compacta con fallback estático completo (`??`) hacia las propiedades
 * de `Vehicle` para evitar campos vacíos o "sin datos" en Garaje y Comparador.
 */
export const VehicleSpecsPanel: React.FC<VehicleSpecsPanelProps> = ({
  vehicle,
  onRace,
  raceLabel = 'Competir con este auto',
}) => {
  const stats = resolveComparatorVehicleStats(vehicle);
  const rows: [string, string][] = [
    ['Marca y modelo', `${vehicle.brand} ${vehicle.name}`],
    ['Versión / año', `${vehicle.trim || 'Versión cargada'} · ${vehicle.year}`],
    ['Motor', vehicle.engineDescription],
    ['Potencia', stats.powerDisplay],
    ['Torque', stats.torqueDisplay],
    ['Aceleración 0–100', stats.accel0to100Display],
    ['Velocidad máx.', stats.topSpeedDisplay],
    ['Transmisión', vehicle.transmissionDescription],
    ['Tracción', vehicle.drivetrain === 'FWD' ? 'Delantera (FWD)' : vehicle.drivetrain],
    ['Alimentación', vehicle.fuelFeeding],
    ['Consumo mixto', stats.consumptionDisplay],
    ['Frenado 100–0', stats.brakingDisplay],
    ['Tanque', stats.fuelCapacityDisplay],
    [
      'Dimensiones',
      `${vehicle.dimensions.lengthMm} × ${vehicle.dimensions.widthMm} × ${vehicle.dimensions.heightMm} mm`,
    ],
    ['Despeje al suelo', stats.clearanceDisplay],
    ['Peso orden de marcha', stats.weightDisplay],
    ['Baulera', `${vehicle.equipment.trunkLiters} L`],
    ['Plazas', `${vehicle.equipment.seatingCapacity} ocupantes`],
    ['Neumáticos', stats.tireSizeDisplay],
    ['Frenos', vehicle.technicalDetails?.brakeDetails || vehicle.equipment.brakesType],
    ['Pantalla', vehicle.equipment.screenSize],
    ['Conectividad', vehicle.equipment.connectivity],
    ['Airbags', `${vehicle.equipment.airbags} airbags`],
    ['Precio de referencia', stats.priceDisplay],
  ];

  return (
    <div className="space-y-4">
      {vehicle.hybridSystem && (
        <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
          {vehicle.hybridSystem.kind === 'self-charging-hev'
            ? 'Sistema híbrido autorrecargable (HEV) con asistencia eléctrica inteligente.'
            : 'Sistema micro-híbrido Mild-Hybrid 12V con recuperación de energía.'}
        </p>
      )}

      <dl className="dc11-spec-grid grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
            <dd className="mt-0.5 text-xs font-semibold text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>

      {vehicle.equipment.adasFeatures.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
            Seguridad activa / asistencias listadas
          </div>
          <p className="mt-1 text-xs text-slate-300">{vehicle.equipment.adasFeatures.join(' · ')}</p>
        </div>
      )}

      {onRace && (
        <button
          type="button"
          onClick={onRace}
          className="w-full rounded-xl bg-cyan-400 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-cyan-300 sm:w-auto cursor-pointer"
        >
          {raceLabel}
        </button>
      )}
    </div>
  );
};

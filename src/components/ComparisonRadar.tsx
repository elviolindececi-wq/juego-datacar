import React from 'react';
import { Vehicle } from '../types/vehicle';
import { Zap, Weight, Gauge, Fuel, Wind, Truck, Disc, CheckCircle } from 'lucide-react';

interface ComparisonRadarProps {
  vehicles: Vehicle[];
}

export const ComparisonRadar: React.FC<ComparisonRadarProps> = ({ vehicles }) => {
  if (vehicles.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono text-xs">
        Selecciona al menos 1 vehículo en el garaje para ver el análisis técnico comparativo.
      </div>
    );
  }

  // Máximos para normalización de barras
  const maxHp = Math.max(...vehicles.map((v) => v.powerHp), 1000);
  const maxTorque = Math.max(...vehicles.map((v) => v.torqueNm), 1500);
  const minWeight = Math.min(...vehicles.map((v) => v.weightKg));
  const maxSpeed = Math.max(...vehicles.map((v) => v.topSpeedKmh), 350);
  const min0100 = Math.min(...vehicles.map((v) => v.accel0100));
  const maxPayload = Math.max(...vehicles.map((v) => v.maxPayloadKg), 5000);
  const maxP2W = Math.max(...vehicles.map((v) => (v.powerHp / (v.weightKg / 1000))), 500);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {vehicles.map((v) => {
          const p2w = Math.round((v.powerHp / (v.weightKg / 1000)) * 10) / 10;
          return (
            <div
              key={v.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: v.color }}
              />
              <div>
                <span className="text-[11px] font-mono text-slate-400 block mb-0.5">
                  {v.brand} · {v.year}
                </span>
                <h4 className="text-base font-bold text-white mb-2">{v.name}</h4>
                <div className="text-xs font-mono text-emerald-400 mb-3 font-semibold">
                  {p2w} HP / Tonelada
                </div>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Tracción:</span>
                  <span className="text-white font-bold">{v.drivetrain}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cx Aerodinámico:</span>
                  <span className="text-white font-bold">{v.dragCoeff}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Carga Máxima:</span>
                  <span className="text-purple-400 font-bold">{v.maxPayloadKg.toLocaleString()} kg</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tanque / Bat:</span>
                  <span className="text-white font-bold">{v.fuelCapacityL} {v.fuelType === 'electric' ? 'kWh' : 'L'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparative Metric Bars */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" /> Comparativa Métrica Frente a Frente
        </h3>

        {/* 1. Potencia Máxima (HP) */}
        <div>
          <div className="flex justify-between text-xs font-mono mb-2">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Potencia Máxima (HP)
            </span>
            <span className="text-slate-500">Más alto es mejor</span>
          </div>
          <div className="space-y-2">
            {vehicles.map((v) => (
              <div key={v.id} className="flex items-center gap-3 text-xs font-mono">
                <span className="w-36 truncate text-slate-400">{v.name}</span>
                <div className="flex-1 bg-slate-950 h-5 rounded-md overflow-hidden relative border border-slate-800/80">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (v.powerHp / maxHp) * 100)}%`,
                      backgroundColor: v.color,
                      opacity: 0.85,
                    }}
                  />
                  <span className="absolute right-2 top-0.5 text-[11px] font-bold text-white tabular-nums">
                    {v.powerHp} HP
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Par Motor (Torque Nm) */}
        <div>
          <div className="flex justify-between text-xs font-mono mb-2">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-blue-400" /> Par Motor (Torque Nm - Capacidad de Arrastre)
            </span>
            <span className="text-slate-500">Esencial para cargas pesadas y pendientes</span>
          </div>
          <div className="space-y-2">
            {vehicles.map((v) => (
              <div key={v.id} className="flex items-center gap-3 text-xs font-mono">
                <span className="w-36 truncate text-slate-400">{v.name}</span>
                <div className="flex-1 bg-slate-950 h-5 rounded-md overflow-hidden relative border border-slate-800/80">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (v.torqueNm / maxTorque) * 100)}%`,
                      backgroundColor: v.color,
                      opacity: 0.85,
                    }}
                  />
                  <span className="absolute right-2 top-0.5 text-[11px] font-bold text-white tabular-nums">
                    {v.torqueNm} Nm
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Aceleración 0-100 km/h (s) */}
        <div>
          <div className="flex justify-between text-xs font-mono mb-2">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-red-400" /> Aceleración 0-100 km/h (segundos)
            </span>
            <span className="text-slate-500">Menor tiempo es mejor</span>
          </div>
          <div className="space-y-2">
            {vehicles.map((v) => {
              // Invertido para que menor tiempo sea barra más larga
              const pct = Math.max(15, Math.min(100, (12 - v.accel0100) * 10));
              return (
                <div key={v.id} className="flex items-center gap-3 text-xs font-mono">
                  <span className="w-36 truncate text-slate-400">{v.name}</span>
                  <div className="flex-1 bg-slate-950 h-5 rounded-md overflow-hidden relative border border-slate-800/80">
                    <div
                      className="h-full rounded-md transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: v.color,
                        opacity: 0.85,
                      }}
                    />
                    <span className="absolute right-2 top-0.5 text-[11px] font-bold text-white tabular-nums">
                      {v.accel0100}s
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Capacidad de Carga y Remolque (kg) */}
        <div>
          <div className="flex justify-between text-xs font-mono mb-2">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-purple-400" /> Capacidad de Carga Útil & Remolque (kg)
            </span>
            <span className="text-slate-500">Prueba de resistencia bajo carga</span>
          </div>
          <div className="space-y-2">
            {vehicles.map((v) => (
              <div key={v.id} className="flex items-center gap-3 text-xs font-mono">
                <span className="w-36 truncate text-slate-400">{v.name}</span>
                <div className="flex-1 bg-slate-950 h-5 rounded-md overflow-hidden relative border border-slate-800/80">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(8, (v.maxPayloadKg / maxPayload) * 100))}%`,
                      backgroundColor: v.color,
                      opacity: 0.85,
                    }}
                  />
                  <span className="absolute right-2 top-0.5 text-[11px] font-bold text-white tabular-nums">
                    {v.maxPayloadKg.toLocaleString()} kg
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

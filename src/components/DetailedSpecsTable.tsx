import React, { useState } from 'react';
import { Vehicle } from '../types/vehicle';
import { SlidersHorizontal, CheckCircle2, XCircle, ShieldCheck, Zap, Maximize2 } from 'lucide-react';

interface DetailedSpecsTableProps {
  vehicles: Vehicle[];
}

export const DetailedSpecsTable: React.FC<DetailedSpecsTableProps> = ({ vehicles }) => {
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header bar with title and "SOLO DIFERENCIAS" toggle */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
          <h3 className="text-sm font-extrabold text-white font-display uppercase tracking-wider">
            Ficha Técnica Detallada
          </h3>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            · Fichas cargadas y simulación referencial
          </span>
        </div>

        <button
          onClick={() => setOnlyDifferences(!onlyDifferences)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
            onlyDifferences
              ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
              : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
          }`}
        >
          <span>SOLO DIFERENCIAS</span>
          <span className="bg-sky-400/20 text-sky-300 px-1.5 py-0.2 rounded text-[10px]">
            18
          </span>
        </button>
      </div>

      {vehicles.some(v => v.estimatedSimulationParameters) && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 px-6 py-2 text-[11px] text-amber-300">
          El Corolla Cross utiliza parámetros estimados de peso, consumo, aceleración y velocidad máxima para la simulación. No son mediciones homologadas.
        </div>
      )}
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          {/* Header Row with Vehicle Mini Cards */}
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-4 px-4 w-1/4 uppercase tracking-wider text-slate-500">
                Matriz Técnica / Atributos
              </th>
              {vehicles.map((v) => (
                <th key={v.id} className="py-4 px-4 w-1/4">
                  <div className="flex items-center gap-3">
                    {v.imageUrl && (
                      <div className="w-14 h-10 rounded-lg overflow-hidden border border-slate-800 shrink-0 bg-slate-950">
                        <img
                          src={v.imageUrl}
                          alt={v.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div>
                      <span className="text-white font-bold block text-sm">
                        {v.brand} {v.name}
                      </span>
                      <span className="text-sky-400 font-bold">
                        US$ {v.equipment.priceUsd.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60">
            {/* SECTION 1: MOTOR */}
            <tr className="bg-slate-950/90 text-sky-400 font-bold">
              <td colSpan={1 + vehicles.length} className="py-2.5 px-4 uppercase tracking-wider text-[11px]">
                1. Planta Motriz y Rendimiento
              </td>
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Motor</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-white">
                  {v.engineDescription} / {v.powerHp} HP / {v.torqueNm} Nm
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Transmisión</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-slate-200">
                  {v.transmissionDescription}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Tracción</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-slate-200">
                  {v.drivetrain === 'FWD' ? 'Delantera - FWD' : v.drivetrain}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Alimentación / Autonomía</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-slate-200">
                  {v.fuelFeeding}
                </td>
              ))}
            </tr>

            {/* SECTION 2: CHASIS Y DIMENSIONES */}
            <tr className="bg-slate-950/90 text-sky-400 font-bold">
              <td colSpan={1 + vehicles.length} className="py-2.5 px-4 uppercase tracking-wider text-[11px]">
                2. Chasis, Baulera y Dimensiones
              </td>
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Capacidad de Baulera</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-white font-bold">
                  {v.equipment.trunkLiters} L {v.equipment.seatingCapacity === 7 ? '(con 3 filas)' : ''}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Largo Total</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-slate-200">
                  {v.dimensions.lengthMm} mm
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Ancho Total</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-slate-200">
                  {v.dimensions.widthMm} mm
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Alto Total</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-slate-200">
                  {v.dimensions.heightMm} mm
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Despeje del Suelo</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-slate-200 font-bold">
                  {v.dimensions.clearanceMm} mm
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Frenos</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-slate-200">
                  {v.equipment.brakesType === '4_discs'
                    ? 'Discos en las cuatro ruedas'
                    : 'Delanteros a disco ventilado / Traseros a tambor'}
                </td>
              ))}
            </tr>

            {/* SECTION 3: CONFORT Y TECNOLOGÍA */}
            <tr className="bg-slate-950/90 text-sky-400 font-bold">
              <td colSpan={1 + vehicles.length} className="py-2.5 px-4 uppercase tracking-wider text-[11px]">
                3. Confort y Tecnología
              </td>
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Pantalla Multimedia</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-white font-bold">
                  {v.equipment.screenSize}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Conectividad</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-slate-300 text-[11px]">
                  {v.equipment.connectivity}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Filas de Asientos</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-slate-200 font-bold">
                  {v.equipment.seatingCapacity === 7 ? '3 Filas (7 pasajeros)' : '2 Filas (5 pasajeros)'}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Equipamiento Destacado</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-slate-300 text-[11px]">
                  <ul className="list-disc pl-4 space-y-1">
                    {v.equipment.comfortFeatures.slice(0, 4).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>

            {/* SECTION 4: SEGURIDAD Y ASISTENCIAS */}
            <tr className="bg-slate-950/90 text-sky-400 font-bold">
              <td colSpan={1 + vehicles.length} className="py-2.5 px-4 uppercase tracking-wider text-[11px]">
                4. Seguridad y Asistencias ADAS
              </td>
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Airbags Totales</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-white font-bold">
                  {v.equipment.airbags} Airbags
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Cámaras y Sensores</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4 text-slate-200">
                  {v.equipment.rearCamera ? 'Cámara de retroceso + sensores' : 'Sin cámara'}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-850 transition-colors">
              <td className="py-3 px-4 text-slate-400 font-bold">Asistencias ADAS</td>
              {vehicles.map((v) => (
                <td key={v.id} className="py-3 px-4">
                  {v.equipment.adasFeatures.length > 0 ? (
                    <ul className="text-emerald-400 text-[10px] space-y-1">
                      {v.equipment.adasFeatures.map((ad, i) => (
                        <li key={i} className="flex items-center gap-1 font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{ad}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-500 font-bold">ADAS SIN CONFIRMAR EN FICHA</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

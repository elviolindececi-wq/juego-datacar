import React, { useMemo, useState } from 'react';
import { Vehicle } from '../types/vehicle';
import { CheckCircle2 } from 'lucide-react';
import {
  formatOfficialClearance,
  formatOfficialPower,
  formatOfficialPriceUsd,
  formatOfficialTorque,
} from '../utils/specFidelity';

interface DetailedSpecsTableProps {
  vehicles: Vehicle[];
}

interface SpecComparisonRow {
  id: string;
  section: string;
  label: string;
  getComparableText: (v: Vehicle) => string;
  renderCell: (v: Vehicle) => React.ReactNode;
}

export const DetailedSpecsTable: React.FC<DetailedSpecsTableProps> = ({ vehicles }) => {
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  const rows: SpecComparisonRow[] = useMemo(
    () => [
      {
        id: 'engine',
        section: '1. Planta Motriz y Rendimiento',
        label: 'Motor / Potencia / Torque',
        getComparableText: v =>
          `${v.engineDescription} | ${formatOfficialPower(v, 'HP')} | ${formatOfficialTorque(v)}`,
        renderCell: v => (
          <span className="text-white">
            {v.engineDescription} · {formatOfficialPower(v, 'HP')} · {formatOfficialTorque(v)}
          </span>
        ),
      },
      {
        id: 'transmission',
        section: '1. Planta Motriz y Rendimiento',
        label: 'Transmisión',
        getComparableText: v => v.transmissionDescription,
        renderCell: v => <span className="text-slate-200">{v.transmissionDescription}</span>,
      },
      {
        id: 'drivetrain',
        section: '1. Planta Motriz y Rendimiento',
        label: 'Tracción',
        getComparableText: v => v.drivetrain,
        renderCell: v => (
          <span className="text-slate-200">
            {v.drivetrain === 'FWD' ? 'Delantera - FWD' : v.drivetrain}
          </span>
        ),
      },
      {
        id: 'feeding',
        section: '1. Planta Motriz y Rendimiento',
        label: 'Alimentación / Sistema',
        getComparableText: v => v.fuelFeeding,
        renderCell: v => <span className="text-slate-200">{v.fuelFeeding}</span>,
      },
      {
        id: 'trunk',
        section: '2. Chasis, Baulera y Dimensiones',
        label: 'Capacidad de Baulera',
        getComparableText: v => `${v.equipment.trunkLiters}-${v.equipment.seatingCapacity}`,
        renderCell: v => (
          <span className="text-white font-bold">
            {v.equipment.trunkLiters} L {v.equipment.seatingCapacity === 7 ? '(con 3 filas)' : ''}
          </span>
        ),
      },
      {
        id: 'length',
        section: '2. Chasis, Baulera y Dimensiones',
        label: 'Largo Total',
        getComparableText: v => String(v.dimensions.lengthMm),
        renderCell: v => <span className="text-slate-200">{v.dimensions.lengthMm} mm</span>,
      },
      {
        id: 'width',
        section: '2. Chasis, Baulera y Dimensiones',
        label: 'Ancho Total',
        getComparableText: v => String(v.dimensions.widthMm),
        renderCell: v => <span className="text-slate-200">{v.dimensions.widthMm} mm</span>,
      },
      {
        id: 'height',
        section: '2. Chasis, Baulera y Dimensiones',
        label: 'Alto Total',
        getComparableText: v => String(v.dimensions.heightMm),
        renderCell: v => <span className="text-slate-200">{v.dimensions.heightMm} mm</span>,
      },
      {
        id: 'clearance',
        section: '2. Chasis, Baulera y Dimensiones',
        label: 'Despeje del Suelo',
        getComparableText: v => formatOfficialClearance(v),
        renderCell: v => <span className="text-slate-200 font-bold">{formatOfficialClearance(v)}</span>,
      },
      {
        id: 'tires',
        section: '2. Chasis, Baulera y Dimensiones',
        label: 'Neumáticos en Ficha',
        getComparableText: v => v.technicalDetails?.tireSize || 'No especificado',
        renderCell: v => (
          <span className="text-slate-200">{v.technicalDetails?.tireSize || 'No especificado'}</span>
        ),
      },
      {
        id: 'brakes',
        section: '2. Chasis, Baulera y Dimensiones',
        label: 'Frenos',
        getComparableText: v => v.technicalDetails?.brakeDetails || v.equipment.brakesType,
        renderCell: v => (
          <span className="text-slate-200">
            {v.technicalDetails?.brakeDetails ||
              (v.equipment.brakesType === '4_discs'
                ? 'Discos en las cuatro ruedas'
                : 'Delanteros a disco ventilado / Traseros a tambor')}
          </span>
        ),
      },
      {
        id: 'screen',
        section: '3. Confort y Tecnología',
        label: 'Pantalla Multimedia',
        getComparableText: v => v.equipment.screenSize,
        renderCell: v => <span className="text-white font-bold">{v.equipment.screenSize}</span>,
      },
      {
        id: 'connectivity',
        section: '3. Confort y Tecnología',
        label: 'Conectividad',
        getComparableText: v => v.equipment.connectivity,
        renderCell: v => (
          <span className="text-slate-300 text-[11px]">{v.equipment.connectivity}</span>
        ),
      },
      {
        id: 'seating',
        section: '3. Confort y Tecnología',
        label: 'Filas de Asientos',
        getComparableText: v => String(v.equipment.seatingCapacity),
        renderCell: v => (
          <span className="text-slate-200 font-bold">
            {v.equipment.seatingCapacity === 7 ? '3 Filas (7 pasajeros)' : '2 Filas (5 pasajeros)'}
          </span>
        ),
      },
      {
        id: 'comfort',
        section: '3. Confort y Tecnología',
        label: 'Equipamiento Destacado',
        getComparableText: v => v.equipment.comfortFeatures.slice(0, 4).join('|'),
        renderCell: v => (
          <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
            {v.equipment.comfortFeatures.slice(0, 4).map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        ),
      },
      {
        id: 'airbags',
        section: '4. Seguridad y Asistencias ADAS',
        label: 'Airbags Totales',
        getComparableText: v => String(v.equipment.airbags),
        renderCell: v => <span className="text-white font-bold">{v.equipment.airbags} Airbags</span>,
      },
      {
        id: 'camera',
        section: '4. Seguridad y Asistencias ADAS',
        label: 'Cámaras y Sensores',
        getComparableText: v => (v.equipment.rearCamera ? 'si' : 'no'),
        renderCell: v => (
          <span className="text-slate-200">
            {v.equipment.rearCamera ? 'Cámara de retroceso incluida' : 'Sin cámara confirmada'}
          </span>
        ),
      },
      {
        id: 'adas',
        section: '4. Seguridad y Asistencias ADAS',
        label: 'Asistencias ADAS',
        getComparableText: v => v.equipment.adasFeatures.join('|') || 'none',
        renderCell: v =>
          v.equipment.adasFeatures.length > 0 ? (
            <ul className="text-emerald-400 text-[10px] space-y-1">
              {v.equipment.adasFeatures.map((ad, i) => (
                <li key={i} className="flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{ad}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-slate-500 font-bold">Sin ADAS confirmado en ficha</span>
          ),
      },
    ],
    [],
  );

  const rowHasDifference = (row: SpecComparisonRow): boolean => {
    if (vehicles.length <= 1) return true;
    const baseline = row.getComparableText(vehicles[0]);
    return vehicles.some(v => row.getComparableText(v) !== baseline);
  };

  const diffCount = rows.filter(rowHasDifference).length;
  const visibleRows = onlyDifferences ? rows.filter(rowHasDifference) : rows;
  const sections = Array.from(new Set(visibleRows.map(r => r.section)));
  const estimatedModels = vehicles
    .filter(v => v.estimatedSimulationParameters)
    .map(v => `${v.brand} ${v.name}`);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header bar with title and functional "SOLO DIFERENCIAS" toggle */}
      <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/70">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-extrabold text-white font-display uppercase tracking-wider">
            Ficha Técnica Detallada
          </h3>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            · Fichas cargadas y simulación referencial
          </span>
        </div>

        <button
          type="button"
          aria-pressed={onlyDifferences}
          onClick={() => setOnlyDifferences(!onlyDifferences)}
          className={`flex min-h-[38px] items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer whitespace-nowrap ${
            onlyDifferences
              ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
              : 'bg-slate-950 text-slate-300 hover:text-white border-slate-800'
          }`}
        >
          <span>SOLO DIFERENCIAS</span>
          <span className="bg-sky-400/20 text-sky-200 px-1.5 py-0.5 rounded text-[10px] tabular-nums">
            {diffCount}
          </span>
        </button>
      </div>

      {estimatedModels.length > 0 && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 sm:px-6 py-2 text-[11px] text-amber-300">
          {estimatedModels.join(' y ')}: la simulación física utiliza parámetros calibrados cuando el fabricante no publica peso, consumo o 0–100 km/h en la ficha recibida. Los valores no confirmados se informan como &quot;No especificado&quot;.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-left text-xs font-mono">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-4 px-4 w-1/4 uppercase tracking-wider text-slate-500">
                Matriz Técnica / Atributos
              </th>
              {vehicles.map(v => (
                <th key={v.id} className="py-4 px-4 w-1/4">
                  <div className="flex items-center gap-3">
                    {v.imageUrl && (
                      <div className="w-14 h-10 rounded-lg overflow-hidden border border-slate-800 shrink-0 bg-slate-950">
                        <img
                          src={v.imageUrl}
                          alt={`${v.brand} ${v.name}`}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div>
                      <span className="text-white font-bold block text-sm">
                        {v.brand} {v.name}
                      </span>
                      <span className="text-sky-400 font-bold tabular-nums">
                        {formatOfficialPriceUsd(v)}
                      </span>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60">
            {sections.length === 0 ? (
              <tr>
                <td
                  colSpan={1 + vehicles.length}
                  className="py-6 px-4 text-center text-slate-400"
                >
                  No se detectaron diferencias entre los vehículos seleccionados.
                </td>
              </tr>
            ) : (
              sections.map(sectionTitle => (
                <React.Fragment key={sectionTitle}>
                  <tr className="bg-slate-950/90 text-sky-400 font-bold">
                    <td
                      colSpan={1 + vehicles.length}
                      className="py-2.5 px-4 uppercase tracking-wider text-[11px]"
                    >
                      {sectionTitle}
                    </td>
                  </tr>
                  {visibleRows
                    .filter(r => r.section === sectionTitle)
                    .map(row => (
                      <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-bold">{row.label}</td>
                        {vehicles.map(v => (
                          <td key={`${row.id}-${v.id}`} className="py-3 px-4">
                            {row.renderCell(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

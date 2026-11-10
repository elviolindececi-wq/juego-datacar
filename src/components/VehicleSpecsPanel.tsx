import React, { useState } from 'react';
import type { Vehicle } from '../types/vehicle';
import { ChevronDown, ChevronUp, Gauge, Fuel, ShieldCheck, Settings2 } from 'lucide-react';
import { SAFETY_KEYS, SAFETY_LABELS, getSafetyState } from '../utils/vehicleSafetySystems';

type VehicleSpecsPanelProps = {
  vehicle: Vehicle;
  context?: 'compare' | 'race';
};

type Spec = { label: string; value: string };

const digits = (value: number) => new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1 }).format(value);
const drivetrainName = { FWD: 'Delantera', RWD: 'Trasera', AWD: 'Integral' } as const;
const fuelName = { gasoline: 'Nafta', diesel: 'Diésel', electric: 'Eléctrico', hybrid: 'Híbrido', flex: 'Flex' } as const;

function SpecRows({ specs }: { specs: Spec[] }) {
  return <dl className="divide-y divide-slate-800/80">
    {specs.map(item => <div key={item.label} className="flex items-start justify-between gap-3 py-2.5 text-xs">
      <dt className="max-w-[52%] text-slate-400">{item.label}</dt>
      <dd className="max-w-[60%] text-right font-semibold leading-snug text-slate-100">{item.value}</dd>
    </div>)}
  </dl>;
}

/** Solo lee los datos ya cargados en presetVehicles.ts: no consulta ni inventa fichas. */
export function VehicleSpecsPanel({ vehicle, context = 'compare' }: VehicleSpecsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const economy = vehicle.fuelType === 'electric' ? '—' : `${vehicle.estimatedSimulationParameters ? '≈ ' : ''}${digits(vehicle.consumptionBase)} L/100 km${vehicle.estimatedSimulationParameters ? ' (sim.)' : ''}`;
  const unknown = (key:string) => vehicle.estimatedFieldNames?.includes(key) ?? false;
  const quick: Spec[] = [
    { label: 'Motor', value: vehicle.engineDescription },
    { label: 'Transmisión', value: vehicle.transmissionDescription },
    { label: 'Tracción', value: drivetrainName[vehicle.drivetrain] },
    ...(vehicle.hybridSystem ? [
      {label:'Sistema híbrido',value:vehicle.hybridSystem.kind === 'self-charging-hev' ? 'HEV autorrecargable · DHT' : 'Mild hybrid ISG 12 V'},
      ...(vehicle.hybridSystem.electricHp ? [{label:'Potencia eléctrica',value:`${vehicle.hybridSystem.electricHp} HP`}] : []),
      ...(vehicle.hybridSystem.combustionHp ? [{label:'Potencia térmica',value:`${vehicle.hybridSystem.combustionHp} HP`}] : []),
      ...(vehicle.hybridSystem.electricTorqueNm ? [{label:'Torque eléctrico',value:`${vehicle.hybridSystem.electricTorqueNm} Nm (motor eléctrico)`}] : []),
    ] : []),
    { label: 'Consumo mixto', value: economy },
  ];
  const full: Spec[] = [
    { label: 'Peso en vacío', value: `${vehicle.estimatedSimulationParameters ? '≈ ' : ''}${digits(vehicle.weightKg)} kg${vehicle.estimatedSimulationParameters ? ' (sim.)' : ''}` },
    { label: 'Combustible', value: fuelName[vehicle.fuelType] },
    { label: 'Depósito', value: `${vehicle.estimatedSimulationParameters ? '≈ ' : ''}${digits(vehicle.fuelCapacityL)} L${vehicle.estimatedSimulationParameters ? ' (sim.)' : ''}` },
    { label: 'Largo × ancho × alto', value: `${digits(vehicle.dimensions.lengthMm)} × ${digits(vehicle.dimensions.widthMm)} × ${digits(vehicle.dimensions.heightMm)} mm` },
    { label: 'Despeje del suelo', value: `${digits(vehicle.dimensions.clearanceMm)} mm` },
    { label: 'Plazas', value: `${vehicle.equipment.seatingCapacity}` },
    { label: 'Baúl', value: `${digits(vehicle.equipment.trunkLiters)} L` },
    { label: 'Airbags', value: `${vehicle.equipment.airbags}` },
    { label: 'Cámara de retroceso', value: vehicle.equipment.rearCamera ? 'Sí' : 'No' },
    { label: 'Frenos', value: vehicle.equipment.brakesType === '4_discs' ? 'Cuatro discos' : 'Discos delanteros / tambores traseros' },
    { label: 'Pantalla', value: vehicle.equipment.screenSize },
    ...(vehicle.technicalDetails?.tireSize ? [{label:'Neumáticos',value:vehicle.technicalDetails.tireSize}] : []),
    ...(vehicle.technicalDetails?.wheelDiameterInches ? [{label:'Llantas',value:`${vehicle.technicalDetails.wheelDiameterInches}" aleación`}] : []),
    ...(vehicle.technicalDetails?.frontSuspension ? [{label:'Suspensión delantera',value:vehicle.technicalDetails.frontSuspension}] : []),
    ...(vehicle.technicalDetails?.rearSuspension ? [{label:'Suspensión trasera',value:vehicle.technicalDetails.rearSuspension}] : []),
    ...(vehicle.technicalDetails?.brakeDetails ? [{label:'Frenos (detalle)',value:vehicle.technicalDetails.brakeDetails}] : []),
  ];
  const activeSafety = vehicle.equipment.adasFeatures ?? [];
  const comfort = vehicle.equipment.comfortFeatures ?? [];
  const safety = vehicle.equipment.safetyFeatures ?? [];
  return <section className="overflow-hidden rounded-2xl border border-cyan-400/25 bg-slate-900/95 shadow-xl" aria-label={`Ficha técnica de ${vehicle.brand} ${vehicle.name}`}>
    <div className="border-b border-slate-700/80 bg-gradient-to-br from-cyan-400/10 to-slate-950 px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Ficha técnica · {context === 'race' ? 'Tu auto' : 'Explorando'}</p>
      <h2 className="mt-1 text-xl font-black leading-tight text-white">{vehicle.brand} {vehicle.name}</h2>
      <p className="mt-1 text-xs text-slate-400">{vehicle.trim || 'Versión no indicada'} · Modelo {vehicle.year}</p>
      <p className="mt-2 text-sm font-black text-emerald-300">Precio informado: USD {vehicle.equipment.priceUsd.toLocaleString('es-PY')}</p>
    </div>
    <div className="grid grid-cols-2 gap-2 p-3">
      {[
        ['Potencia', unknown('powerHp') ? 'Sin dato oficial' : `${digits(vehicle.powerHp)} HP`],
        ['Torque', unknown('torqueNm') ? 'Sin dato oficial' : vehicle.hybridSystem?.torqueNmIsElectricOnly ? `${digits(vehicle.torqueNm)} Nm eléct.` : `${digits(vehicle.torqueNm)} Nm`],
        ['0–100 km/h', `${vehicle.estimatedSimulationParameters ? '≈ ' : ''}${digits(vehicle.accel0100)} s`],
        ['Vel. máxima', `${vehicle.estimatedSimulationParameters ? '≈ ' : ''}${digits(vehicle.topSpeedKmh)} km/h`],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/85 p-3">
        <span className="block text-[10px] text-slate-400">{label}</span>
        <strong className="mt-1 block text-lg font-black tabular-nums text-white">{value}</strong>
      </div>)}
    </div>
    {vehicle.hybridSystem && <p className="px-4 pb-2 text-[11px] leading-relaxed text-cyan-300">{vehicle.hybridSystem.kind === 'self-charging-hev' ? 'HEV: asistencia eléctrica y recuperación regenerativa simuladas; torque eléctrico no equivale a torque combinado.' : 'Mild Hybrid ISG 12V: asistencia breve en la salida, sin modo eléctrico de conducción.'}</p>}
    {vehicle.estimatedSimulationParameters && <p className="px-4 pb-3 text-[11px] leading-relaxed text-amber-300">≈ indica valores estimados para la simulación, NO prestaciones homologadas. Los datos no listados como estimados provienen de la ficha; las cifras de simulación no equivalen a pruebas homologadas.</p>}
    <div className="px-4 pb-3">
      <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-cyan-300"><Gauge size={14}/> Motor y conducción</h3>
      <SpecRows specs={quick}/>
    </div>
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="flex w-full items-center justify-between gap-3 border-t border-slate-700/80 bg-slate-950/70 px-4 py-3 text-left text-xs font-black text-cyan-300 transition hover:bg-slate-800/90">
      <span>{expanded ? 'Ocultar ficha completa' : 'Ver ficha completa'}</span>
      {expanded ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
    </button>
    {expanded && <div className="space-y-4 border-t border-slate-800 px-4 py-4">
      <div><h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-cyan-300"><Fuel size={14}/> Dimensiones y equipamiento</h3><SpecRows specs={full}/></div>
      <div><h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-cyan-300"><ShieldCheck size={14}/> Asistencias de seguridad</h3>
        <p className="mt-2 text-[11px] leading-relaxed text-amber-200">Sólo se simulan las asistencias confirmadas para esta versión. «Pendiente» no significa que el vehículo carezca de ellas.</p>
        <div className="mt-2 grid gap-1">{SAFETY_KEYS.map(key => { const status=getSafetyState(vehicle,key); return <div key={key} className="flex justify-between gap-2 border-b border-slate-800 py-1.5 text-xs"><span className="text-slate-300">{SAFETY_LABELS[key]}</span><span className={status==='present' ? 'text-emerald-300' : status==='absent' ? 'text-slate-400' : 'text-amber-300'}>{status==='present'?'Confirmado':status==='absent'?'No incluido':'Pendiente'}</span></div> })}</div>
        {activeSafety.length ? <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-slate-300">{activeSafety.map(item => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-xs text-slate-500">No hay ADAS adicionales confirmados para esta versión.</p>}
      </div>
      {safety.length > 0 && <div><h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-cyan-300"><ShieldCheck size={14}/> Seguridad de serie</h3><ul className="mt-2 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-slate-300">{safety.map(item => <li key={item}>{item}</li>)}</ul></div>}
      {comfort.length > 0 && <div><h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-cyan-300"><Settings2 size={14}/> Confort</h3><ul className="mt-2 list-inside list-disc space-y-1.5 text-xs leading-relaxed text-slate-300">{comfort.map(item => <li key={item}>{item}</li>)}</ul></div>}
    </div>}
    {vehicle.specEvidence && <div className="border-t border-slate-800 px-4 py-2 text-[10px] leading-relaxed text-slate-400"><strong>Fuente:</strong> {vehicle.specEvidence.sourceLabel} · {vehicle.specEvidence.status === 'exact-user-sheet' || vehicle.specEvidence.status === 'exact-official' ? 'Versión cotejada' : 'Pendiente de validación exacta'}. {vehicle.specEvidence.notes}</div>}
    <p className="border-t border-slate-800 px-4 py-3 text-[10px] leading-relaxed text-slate-500">Datos cargados en DATACAR para esta versión. Pueden variar por mercado y equipamiento; contrastar con la ficha oficial del fabricante antes de tomar una decisión de compra.</p>
  </section>;
}

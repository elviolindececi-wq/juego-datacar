import React from 'react';
import { Award, Clock, FlagTriangleRight, Gauge, Info } from 'lucide-react';
import type { VehicleRaceResult } from '../types/vehicle';
import { explainDriving, type DrivingIQAssessment } from '../utils/drivingIQ';
import { formatTargetMinutesSec, type CircuitTimeEvaluation } from '../utils/circuitTargetTimes';

interface Props {
  results: VehicleRaceResult[];
  assessments: DrivingIQAssessment[];
  playerId: string;
  targetEval?: CircuitTimeEvaluation | null;
  practiceFree?: boolean;
  payloadKg?: number;
  isDatacarMember?: boolean;
}
const getName = (result?: VehicleRaceResult) => result ? `${result.vehicle.brand} ${result.vehicle.name}` : '—';

export const DrivingIQResults: React.FC<Props> = ({
  results,
  assessments,
  playerId,
  targetEval = null,
  practiceFree = false,
  payloadKg = 0,
  isDatacarMember = false,
}) => {
  if (!results.length || !assessments.length) return null;
  const fastest = results.find(r => !r.isDnf) ?? results[0];
  const winner = assessments[0];
  const winnerResult = results.find(r => r.vehicle.id === winner.vehicleId);
  const me = assessments.find(a => a.vehicleId === playerId);
  const player = results.find(r => r.vehicle.id === playerId);
  const categories: { label: string; value: number; max: number }[] = me ? [
    {label: 'Rendimiento virtual', value: me.performance, max: 35},
    {label: 'Conducción segura', value: me.safety, max: 30},
    {label: 'Gestión de obstáculos', value: me.obstacles, max: 20},
    {label: 'Control del vehículo', value: me.control, max: 15},
  ] : [];
  const notes = player && me ? explainDriving(player, me) : [];
  return (
    <section aria-label="DATACAR Driving IQ, clasificación por manejo" className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/10 to-slate-900 p-5">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-amber-300"><FlagTriangleRight size={16}/> Primero en llegar</p>
          <h3 className="mt-2 text-xl font-black uppercase">{getName(fastest)}</h3>
          <p className="mt-1 text-xs text-slate-400">{fastest.isDnf ? 'Ninguno completó el circuito' : `Tiempo ${fastest.finishTimeSec.toFixed(2)} segundos`}</p>
        </div>
        <div className="rounded-2xl border border-cyan-400/35 bg-gradient-to-br from-cyan-500/12 to-slate-900 p-5">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-cyan-300"><Award size={16}/> {practiceFree ? 'Pruebas en pista · Sin puntaje' : 'Mejor conducción · Driving IQ'}</p>
          <h3 className="mt-2 text-xl font-black uppercase">{getName(winnerResult)}</h3>
          <p className="mt-1 text-xs text-slate-400">{practiceFree ? 'Sesión libre sin puntuación oficial' : `${winner.total.toFixed(1)} / 100 puntos · reglas de esta partida`}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-cyan-300">DATACAR DRIVING IQ</p>
            <h3 className="mt-1 text-2xl font-black">Tu diagnóstico de conducción</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-400">Puntaje educativo del videojuego, calculado con tu tiempo relativo y eventos de la carrera. No mide seguridad real, daño mecánico ni calidad homologada del vehículo.</p>
          </div>
          {me && <div className="rounded-xl border border-cyan-400/35 bg-slate-950 px-5 py-3 text-center"><p className="text-3xl font-black tabular-nums text-cyan-300">{practiceFree ? 'PRB' : me.total.toFixed(1)}</p><p className="text-[10px] uppercase tracking-wider text-slate-500">{practiceFree ? 'sin puntaje' : 'sobre 100'}</p></div>}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-3">
            {categories.map(({label, value, max}) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-xs"><span className="text-slate-300">{label}</span><span className="font-bold tabular-nums text-white">{value.toFixed(1)} / {max}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-950"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-300" style={{width: `${Math.max(0,Math.min(100,value/max*100))}%`}} /></div>
              </div>
            ))}
            {me && <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-xs leading-relaxed text-slate-300">
              <strong>Eventos de tu partida:</strong> {me.events.collisions} contactos · {me.events.potholesHit} baches · {me.events.speedBumpsTooFast} reductores rápidos · {me.events.lossOfControl} pérdidas de control · {me.events.redLightViolations} semáforos en rojo · {me.events.speedLimitViolations} infracciones de velocidad · {me.events.wrongWayInvasions} invasiones de mano contraria{me.events.unbuckledSeatbelt > 0 ? ' · sin cinturón' : ' · cinturón abrochado'}{payloadKg > 0 ? ` · carga +${payloadKg} kg` : ''}.
            </div>}
            {targetEval && !practiceFree && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-950/35 px-3 py-2 text-xs text-amber-200 tabular-nums">
                <Clock size={14} className="shrink-0 text-amber-300" />
                <span>
                  {targetEval.label}: meta {formatTargetMinutesSec(targetEval.target.targetSec)} (límite {formatTargetMinutesSec(targetEval.target.maxLimitSec)}) · ajuste {targetEval.iqBonus >= 0 ? `+${targetEval.iqBonus}` : targetEval.iqBonus} IQ
                </span>
              </div>
            )}
            {isDatacarMember && player && (
              <div className="rounded-lg border border-emerald-400/40 bg-emerald-950/35 px-3 py-2 text-xs text-emerald-200 tabular-nums">
                <strong>Telemetría extendida DATACARPY:</strong> peso total simulado {Math.round(player.effectiveWeightKg ?? player.vehicle.weightKg + payloadKg)} kg · potencia/peso {player.effectivePowerToWeight.toFixed(1)} HP/t · intervenciones ABS {player.drivingEvents?.absInterventions ?? 0} · AEB {player.drivingEvents?.aebInterventions ?? 0}.
              </div>
            )}
          </div>
          <div className="space-y-2">
            {notes.map((note, i) => <p key={i} className="rounded-lg border border-slate-700/65 bg-slate-950/65 px-3 py-2.5 text-xs leading-relaxed text-slate-300">{note}</p>)}
          </div>
        </div>
        <div className="mt-5 border-t border-slate-700/70 pt-4">
          <h4 className="flex items-center gap-2 text-sm font-black"><Gauge size={16} className="text-cyan-300"/> Ranking de mejor conducción</h4>
          <div className="mt-2 space-y-2">
            {assessments.map((a, index) => {
              const r = results.find(result => result.vehicle.id === a.vehicleId);
              return <div key={a.vehicleId} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${a.vehicleId===playerId ? 'border-cyan-400/50 bg-cyan-400/10' : 'border-slate-700 bg-slate-950/50'}`}>
                <strong className="w-8 text-cyan-300">{index+1}º</strong>
                <div className="flex-1 font-semibold">{getName(r)} {a.vehicleId === playerId && <span className="text-xs text-cyan-300">(VOS)</span>}</div>
                <span className="font-black tabular-nums">{a.total.toFixed(1)}</span>
              </div>;
            })}
          </div>
        </div>
        <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-amber-300/90"><Info size={14} className="mt-0.5 shrink-0"/> Las referencias de tiempo se generan dentro del simulador para cada vehículo. Que se active ABS o ADAS no implica una calificación oficial de seguridad. Los datos incompletos de ficha no se presentan como hechos verificados.</p>
      </div>
    </section>
  );
};

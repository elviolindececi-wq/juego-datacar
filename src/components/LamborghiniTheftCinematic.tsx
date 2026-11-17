import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  FastForward,
  Lock,
  MapPin,
  Radio,
  ShieldAlert,
  Warehouse,
} from 'lucide-react';
import { ASUNCION_CIRCUITS } from '../data/asuncionCircuits';
import {
  STORY_DIALOGUES_BY_CHAPTER,
  WENO_STORY_ORDERED_CIRCUIT_IDS,
} from '../utils/storyCampaign';
import { CircuitWireframeSVG } from './CircuitWireframeSVG';
import { DatacarPhoneMessages } from './DatacarPhoneMessages';

export interface LamborghiniTheftCinematicProps {
  open: boolean;
  initialStage?: 'test_approved' | 'discovery_routes' | 'theft_ambush';
  finishTimeSec?: number | null;
  onCompleteToGarage: () => void;
}

/**
 * Secuencia narrativa post-Misión 0 (§6 Final, §7 El Descubrimiento y §8 Cinemática del Robo):
 * 1. PRUEBA SUPERADA · PILOTO APROBADO
 * 2. EL DESCUBRIMIENTO (Interfaz de investigación con las 6 rutas clasificadas conectadas a WENO Bank)
 * 3. CINEMÁTICA DEL ROBO (Emboscada de la limusina negra en el traslado al hangar con código filtrado)
 */
export const LamborghiniTheftCinematic: React.FC<LamborghiniTheftCinematicProps> = ({
  open,
  initialStage = 'test_approved',
  finishTimeSec,
  onCompleteToGarage,
}) => {
  const [stage, setStage] = useState<'test_approved' | 'discovery_routes' | 'theft_ambush'>(
    initialStage,
  );

  if (!open) return null;

  const orderedCircuits = WENO_STORY_ORDERED_CIRCUIT_IDS.map(
    (id) => ASUNCION_CIRCUITS.find((c) => c.id === id) || ASUNCION_CIRCUITS[0],
  );

  return (
    <div
      data-testid="lamborghini-theft-cinematic"
      role="dialog"
      aria-modal="true"
      aria-label="Descubrimiento y Robo del Proyecto Fantasma"
      className="fixed inset-0 z-[190] flex flex-col justify-between overflow-y-auto bg-[#03070e] text-white select-none"
    >
      {/* CABECERA CON PROGRESO DE LA ESCENA */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#040c16]/95 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-2.5">
          {stage === 'theft_ambush' ? (
            <ShieldAlert className="h-4 w-4 animate-pulse text-rose-400" />
          ) : (
            <Radio className="h-4 w-4 text-[#00E5F5]" />
          )}
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#00E5F5]">
            {stage === 'test_approved'
              ? 'MISIÓN 0 COMPLETADA · TELEMETRÍA SINCRONIZADA'
              : stage === 'discovery_routes'
                ? 'DIAGNÓSTICO PROYECTO FANTASMA · 6 RUTAS RECUPERADAS'
                : 'ALERTA DE SEGURIDAD CRÍTICA · HANGAR DATACAR'}
          </span>
        </div>

        <button
          type="button"
          onClick={onCompleteToGarage}
          data-testid="theft-skip-to-garage-btn"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 min-h-[36px] text-xs font-bold uppercase tracking-wider text-slate-300 hover:border-amber-400 hover:text-white cursor-pointer"
        >
          <FastForward className="h-3.5 w-3.5" />
          <span>Ir al Garaje</span>
        </button>
      </header>

      {/* CONTENIDO SEGÚN LA ETAPA */}
      <div className="relative z-20 mx-auto my-auto w-full max-w-5xl px-4 py-6 sm:px-8">
        {/* ETAPA 1: PRUEBA SUPERADA · PILOTO APROBADO (§6 Final) */}
        {stage === 'test_approved' && (
          <div
            data-testid="stage-test-approved"
            className="mx-auto max-w-2xl rounded-2xl border-2 border-emerald-400/60 bg-[#061522]/95 p-6 sm:p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.92)]"
          >
            <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/15 px-4 py-1 text-xs font-mono font-black uppercase tracking-[0.24em] text-emerald-300">
              <Award className="h-4 w-4" />
              <span>EVALUACIÓN DINÁMICA COMPLETADA</span>
            </div>

            <h1 className="font-display text-4xl sm:text-6xl font-black italic uppercase tracking-wide text-white">
              PRUEBA SUPERADA
            </h1>
            <p className="mt-1 font-display text-xl sm:text-2xl font-black italic uppercase tracking-[0.2em] text-[#FFAA12]">
              PILOTO APROBADO
            </p>
            {typeof finishTimeSec === 'number' && finishTimeSec > 0 && (
              <p className="mt-2 font-mono text-xs text-cyan-300">
                Tiempo de evaluación registrado: {finishTimeSec.toFixed(2)} s
              </p>
            )}

            <div className="mt-6 rounded-xl border-l-4 border-[#00E5F5] bg-[#040d17] p-4 text-left space-y-2">
              <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#00E5F5]">
                CENTRAL DATACAR:
              </p>
              {STORY_DIALOGUES_BY_CHAPTER.mission_0_post_victory.map((msg) => (
                <p key={msg.id} className="text-base sm:text-lg font-bold text-slate-100">
                  "{msg.text}"
                </p>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStage('discovery_routes')}
              data-testid="to-discovery-routes-btn"
              data-start="true"
              className="dc-btn-gold mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 min-h-[48px] font-display text-base sm:text-lg font-black italic uppercase tracking-wider text-slate-950 cursor-pointer"
            >
              <span>Analizar datos recuperados del Lamborghini</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* ETAPA 2: EL DESCUBRIMIENTO — 6 RUTAS CLASIFICADAS VINCULADAS A WENO BANK (§7) */}
        {stage === 'discovery_routes' && (
          <div
            data-testid="stage-discovery-routes"
            className="space-y-5 rounded-2xl border border-[#00E5F5]/45 bg-[#06131f]/95 p-5 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.92)]"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <p className="text-xs font-mono font-black uppercase tracking-[0.2em] text-[#FFAA12]">
                  SISTEMA DE DIAGNÓSTICO FORENSE · PROYECTO FANTASMA
                </p>
                <h2 className="mt-1 font-display text-2xl sm:text-4xl font-black italic uppercase text-white">
                  SEIS RUTAS CLASIFICADAS · CONEXIÓN WENO BANK
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start rounded-lg border border-amber-400/50 bg-amber-950/60 px-3 py-1.5 text-xs font-mono font-bold text-amber-200">
                <Lock className="h-3.5 w-3.5" />
                <span>SOSPECHOSOS AÚN SIN IDENTIFICAR</span>
              </span>
            </div>

            {/* Diálogo exacto de CENTRAL DATACAR */}
            <div className="rounded-xl border-l-4 border-[#00E5F5] bg-[#040d17] p-4 grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#00E5F5]">
                  CENTRAL DATACAR:
                </p>
                <div className="mt-1 space-y-1">
                  {STORY_DIALOGUES_BY_CHAPTER.discovery_routes.map((msg) => (
                    <p key={msg.id} className="text-sm sm:text-base font-bold text-slate-100">
                      "{msg.text}"
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300 leading-relaxed flex flex-col justify-center">
                <p className="font-bold text-amber-300 uppercase tracking-wider">
                  Nota de Investigación DATACAR:
                </p>
                <p className="mt-1">
                  Los datos recuperados durante la prueba son pistas técnicas que requieren corroboración en terreno. Además, la conexión de diagnóstico transmitió una señal que permitió localizar el vehículo.
                </p>
              </div>
            </div>

            {/* Mapa / Grilla de las 6 rutas clasificadas reutilizando CircuitWireframeSVG */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {orderedCircuits.map((circuit, index) => (
                <div
                  key={circuit.id}
                  className="rounded-xl border border-[#00E5F5]/30 bg-[#040c14] p-3 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase text-[#00E5F5]">
                    <span>RUTA CLASIFICADA #{index + 1}</span>
                    <span className="text-amber-300">WENO LINK</span>
                  </div>
                  <div className="my-2 h-16 flex items-center justify-center">
                    <div className="w-28">
                      <CircuitWireframeSVG circuitId={circuit.id} />
                    </div>
                  </div>
                  <div>
                    <p className="truncate font-display text-sm font-black italic uppercase text-white">
                      {circuit.name}
                    </p>
                    <p className="truncate text-[10px] font-mono text-slate-400">
                      Objetivo #{index + 1}: Identidad desconocida
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setStage('theft_ambush')}
                data-testid="to-theft-ambush-btn"
                data-start="true"
                className="dc-btn-gold inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 min-h-[48px] font-display text-base font-black italic uppercase tracking-wider text-slate-950 cursor-pointer"
              >
                <span>Continuar traslado al Hangar DATACAR</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3: CINEMÁTICA DEL ROBO (§8) */}
        {stage === 'theft_ambush' && (
          <div
            data-testid="stage-theft-ambush"
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
          >
            {/* Izquierda: Representación cinematográfica de la emboscada en el hangar con la limusina negra */}
            <div className="lg:col-span-7 space-y-4 rounded-2xl border-2 border-rose-500/60 bg-[#0b0710]/95 p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.95)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/30 pb-3">
                <div className="inline-flex items-center gap-2 text-xs font-mono font-black uppercase tracking-widest text-rose-400">
                  <AlertTriangle className="h-4 w-4 animate-bounce" />
                  <span>BRECHA DE SEGURIDAD · HANGAR DATACAR</span>
                </div>
                <span className="rounded bg-rose-500/20 border border-rose-500/50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-rose-200">
                  CÓDIGO DE ACCESO COMPROMETIDO
                </span>
              </div>

              {/* Escena visual de cámaras de seguridad del hangar */}
              <div className="relative overflow-hidden rounded-xl border border-rose-500/40 bg-[#050811] p-5">
                <div className="flex items-center justify-between text-[10px] font-mono text-rose-300/90 mb-3">
                  <span>CAM-04 · ACCESO PRINCIPAL HANGAR</span>
                  <span className="animate-pulse">● REC 23:58:14</span>
                </div>

                {/* Ilustración táctica de la limusina presidencial negra y escoltas llevándose el Lamborghini */}
                <svg viewBox="0 0 720 240" className="w-full h-44 sm:h-52 rounded-lg bg-[#03060c]">
                  <defs>
                    <linearGradient id="hangarFloor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#09131f" />
                      <stop offset="100%" stopColor="#02050a" />
                    </linearGradient>
                  </defs>
                  <rect width="720" height="240" fill="url(#hangarFloor)" />
                  {/* Líneas de hangar */}
                  <line x1="0" y1="185" x2="720" y2="185" stroke="#ef4444" strokeOpacity="0.4" strokeWidth="2" />
                  <line x1="80" y1="185" x2="20" y2="240" stroke="#00E5F5" strokeOpacity="0.25" strokeWidth="2" />
                  <line x1="640" y1="185" x2="700" y2="240" stroke="#00E5F5" strokeOpacity="0.25" strokeWidth="2" />

                  {/* Limusina negra blindada (Presidential Limousine) */}
                  <g transform="translate(55, 108)">
                    <rect x="0" y="28" width="245" height="36" rx="6" fill="#090d14" stroke="#94a3b8" strokeWidth="2" />
                    <path d="M 45 28 L 78 6 L 185 6 L 212 28 Z" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1.5" />
                    <circle cx="48" cy="66" r="16" fill="#020617" stroke="#e2e8f0" strokeWidth="3" />
                    <circle cx="198" cy="66" r="16" fill="#020617" stroke="#e2e8f0" strokeWidth="3" />
                    <polygon points="245,36 310,20 310,60 245,48" fill="#fef08a" fillOpacity="0.22" />
                    <text x="122" y="50" textAnchor="middle" fill="#f8fafc" fontSize="10" fontFamily="monospace" fontWeight="bold">
                      LIMUSINA BLINDADA · ESCOLTA OSCURA
                    </text>
                  </g>

                  {/* Lamborghini Proyecto Fantasma siendo extraído */}
                  <g transform="translate(415, 116)">
                    <path d="M 10 46 L 45 22 L 125 6 L 205 6 L 255 30 L 248 54 L 10 54 Z" fill="#1e293b" stroke="#f59e0b" strokeWidth="2.5" />
                    <circle cx="65" cy="56" r="16" fill="#090d16" stroke="#f59e0b" strokeWidth="3" />
                    <circle cx="205" cy="56" r="16" fill="#090d16" stroke="#f59e0b" strokeWidth="3" />
                    <text x="135" y="-6" textAnchor="middle" fill="#f59e0b" fontSize="11" fontFamily="monospace" fontWeight="bold">
                      PROYECTO FANTASMA — EXTRAÍDO
                    </text>
                  </g>
                </svg>

                <div className="mt-3 space-y-1.5 text-xs text-slate-200 leading-relaxed">
                  <p>
                    Mientras el Lamborghini era trasladado de regreso al hangar tras tu prueba, una <strong>limusina negra blindada</strong> y vehículos oscuros ingresaron utilizando un <strong>código de acceso válido</strong>.
                  </p>
                  <p className="text-amber-300 font-semibold">
                    La señal de diagnóstico transmitida durante la prueba reveló la ubicación del prototipo, y alguien filtró los códigos de seguridad desde adentro.
                  </p>
                </div>
              </div>

              {/* Banner OPERACIÓN WENO — INVESTIGACIÓN ACTIVADA */}
              <div
                data-testid="operation-weno-activated-banner"
                className="rounded-xl border-2 border-[#FFAA12] bg-gradient-to-r from-[#1f1404] via-[#131f30] to-[#091826] p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-display text-xl sm:text-2xl font-black italic uppercase tracking-wider text-[#FFAA12]">
                    OPERACIÓN WENO
                  </p>
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-white">
                    INVESTIGACIÓN ACTIVADA · ESTADO: PROYECTO FANTASMA — ROBADO
                  </p>
                </div>
                <Warehouse className="h-8 w-8 text-[#00E5F5] shrink-0" />
              </div>
            </div>

            {/* Derecha: Teléfono con el diálogo exacto del robo (§8) */}
            <div className="lg:col-span-5">
              <DatacarPhoneMessages
                messages={STORY_DIALOGUES_BY_CHAPTER.theft_cinematic}
                chapterTitle="ALERTA DE INTRUSIÓN · HANGAR"
                headerBadge="EMERGENCIA DE SEGURIDAD"
                acceptLabel="INGRESAR AL GARAJE DATACAR"
                onAccept={onCompleteToGarage}
                onSkip={onCompleteToGarage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

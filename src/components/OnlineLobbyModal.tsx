import React, { useEffect, useState } from 'react';
import { Globe, KeyRound, Loader2, Play, Radio, ShieldCheck, Users, X, Zap } from 'lucide-react';
import type { Vehicle } from '../types/vehicle';
import type { AsuncionCircuit } from '../data/asuncionCircuits';
import type { RaceModeId } from '../utils/careerProgression';
import { multiplayerClient, type OnlineRoomSnapshot } from '../utils/multiplayerClient';

export interface OnlineLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCar: Vehicle;
  selectedCircuit: AsuncionCircuit;
  laps: number;
  raceMode: RaceModeId;
  speedModeUnlocked: boolean;
  onSelectRaceMode: (mode: RaceModeId) => void;
  onMatchReady: (room: OnlineRoomSnapshot) => void;
}

export const OnlineLobbyModal: React.FC<OnlineLobbyModalProps> = ({
  isOpen,
  onClose,
  selectedCar,
  selectedCircuit,
  laps,
  raceMode,
  speedModeUnlocked,
  onSelectRaceMode,
  onMatchReady,
}) => {
  const [pilotName, setPilotName] = useState(() => multiplayerClient.getSavedPilotName());
  const [joinCode, setJoinCode] = useState('');
  const [, setTick] = useState(0);
  const [launchedRoomId, setLaunchedRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setLaunchedRoomId(null);
      return;
    }
    multiplayerClient.connect();
    const unsubscribe = multiplayerClient.subscribe(() => {
      setTick((n) => n + 1);
    });
    return unsubscribe;
  }, [isOpen]);

  const room = multiplayerClient.room;

  // Cuando la sala reúne al menos 2 jugadores simultáneos en línea, lanzamos automáticamente la partida sincronizada
  useEffect(() => {
    if (!isOpen || !room) return;
    if (room.players.length >= 2 && launchedRoomId !== room.roomId) {
      setLaunchedRoomId(room.roomId);
      const timer = window.setTimeout(() => {
        onMatchReady(room);
      }, 650);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, room, launchedRoomId, onMatchReady]);

  if (!isOpen) return null;

  const onlineMode = raceMode === 'speed_pro' && speedModeUnlocked ? 'speed_pro' : 'city_trial';

  const handleQuickMatch = () => {
    multiplayerClient.setPilotName(pilotName);
    multiplayerClient.joinMatchmakingQueue({
      pilotName,
      vehicleId: selectedCar.id,
      circuitId: selectedCircuit.id,
      mode: onlineMode,
      laps,
    });
  };

  const handleCreateRoom = () => {
    multiplayerClient.setPilotName(pilotName);
    multiplayerClient.createPrivateRoom({
      pilotName,
      vehicleId: selectedCar.id,
      circuitId: selectedCircuit.id,
      mode: onlineMode,
      laps,
    });
  };

  const handleJoinCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim().length < 4) return;
    multiplayerClient.setPilotName(pilotName);
    multiplayerClient.joinRoomByCode({
      code: joinCode.trim().toUpperCase(),
      pilotName,
      vehicleId: selectedCar.id,
    });
  };

  const handleClose = () => {
    if (multiplayerClient.inQueue) {
      multiplayerClient.leaveQueue();
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#020813]/88 px-4 py-6 backdrop-blur-md select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Multijugador en línea en tiempo real"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[#00E5F5]/50 bg-[#061320]/95 p-5 sm:p-7 text-slate-100 shadow-[0_0_50px_rgba(0,229,245,0.25)]">
        <div className="flex items-start justify-between gap-4 border-b border-cyan-500/20 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/45 bg-emerald-950/70 px-3 py-0.5 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
              <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
              <span>
                {multiplayerClient.connected ? 'SERVIDOR EN LÍNEA ACTIVO' : 'CONECTANDO SERVIDOR…'} ·{' '}
                {multiplayerClient.onlineCount} {multiplayerClient.onlineCount === 1 ? 'PILOTO CONECTADO' : 'PILOTOS CONECTADOS'}
              </span>
            </div>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-black italic uppercase tracking-wide text-white">
              MULTIJUGADOR EN LÍNEA EN VIVO
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              Competí simultáneamente en tiempo real contra otro jugador que entre al mismo tiempo o compartí un código de sala.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar sala en línea"
            className="rounded-xl border border-slate-700 bg-slate-900/90 p-2 text-slate-300 hover:border-cyan-400 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Configuración rápida de piloto y modalidad */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block rounded-xl border border-slate-700/80 bg-slate-950/75 p-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
              TU ALIAS EN PISTA
            </span>
            <input
              type="text"
              maxLength={22}
              value={pilotName}
              onChange={(e) => setPilotName(e.target.value)}
              placeholder="Ej. PilotoAsuncion"
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-cyan-400"
            />
            <span className="mt-1 block text-[11px] text-slate-400 truncate">
              SUV: {selectedCar.brand} {selectedCar.name} · {selectedCircuit.name}
            </span>
          </label>

          <div className="rounded-xl border border-slate-700/80 bg-slate-950/75 p-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
              MODALIDAD DE SALA
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSelectRaceMode('city_trial')}
                className={`rounded-lg border px-2.5 py-2 text-left text-xs font-black transition cursor-pointer ${
                  raceMode === 'city_trial'
                    ? 'border-cyan-400 bg-cyan-500/20 text-white'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="flex items-center gap-1 text-[11px] uppercase">
                  <ShieldCheck className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
                  Ciudad
                </span>
                <span className="block text-[10px] font-normal text-slate-300 mt-0.5">
                  Semáforos y peatones
                </span>
              </button>

              <button
                type="button"
                disabled={!speedModeUnlocked}
                onClick={() => speedModeUnlocked && onSelectRaceMode('speed_pro')}
                className={`rounded-lg border px-2.5 py-2 text-left text-xs font-black transition ${
                  !speedModeUnlocked
                    ? 'cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-500'
                    : raceMode === 'speed_pro'
                      ? 'cursor-pointer border-amber-400 bg-amber-500/20 text-amber-100'
                      : 'cursor-pointer border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-400/60'
                }`}
              >
                <span className="flex items-center gap-1 text-[11px] uppercase">
                  <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  Velocidad
                </span>
                <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                  {speedModeUnlocked ? 'Sin obstáculos' : 'Superá Fase 1'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {multiplayerClient.lastError && (
          <div className="mt-3 rounded-xl border border-rose-500/50 bg-rose-950/75 px-3.5 py-2 text-xs font-semibold text-rose-200">
            {multiplayerClient.lastError}
          </div>
        )}

        {/* Estado activo de cola o sala */}
        {room ? (
          <div className="mt-4 rounded-xl border border-cyan-400/50 bg-cyan-950/35 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
                  SALA EN LÍNEA CREADA · CÓDIGO PARA COMPARTIR
                </span>
                <div className="mt-0.5 font-mono text-3xl font-black tracking-[0.25em] text-amber-300">
                  {room.code}
                </div>
              </div>
              <div className="text-right text-xs text-slate-300">
                <div className="font-bold text-white">
                  {room.players.length} / 4 pilotos en sala
                </div>
                <div>
                  {room.players.length >= 2
                    ? '¡Rival conectado! Iniciando grilla sincronizada…'
                    : 'Esperando que otro jugador ingrese con el código o en cola…'}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {room.players.map((p) => (
                <div
                  key={p.clientId}
                  className="flex items-center justify-between rounded-lg border border-cyan-400/30 bg-slate-950/80 px-3 py-2 text-xs"
                >
                  <span className="font-bold text-white truncate">
                    {p.pilotName} {p.clientId === multiplayerClient.clientId ? '(Vos)' : ''}
                  </span>
                  <span className="text-[10px] font-mono uppercase text-cyan-300">
                    LISTO
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => multiplayerClient.leaveRoom()}
                className="rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:border-rose-400 hover:text-rose-200 cursor-pointer"
              >
                Salir de la sala
              </button>
              {room.players.length >= 2 && (
                <button
                  type="button"
                  onClick={() => onMatchReady(room)}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 font-display text-sm font-black italic uppercase text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  <Play className="h-4 w-4" />
                  <span>ENTRAR A PISTA AHORA</span>
                </button>
              )}
            </div>
          </div>
        ) : multiplayerClient.inQueue ? (
          <div className="mt-4 rounded-xl border border-amber-400/55 bg-amber-950/25 p-5 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-400" />
            <h3 className="mt-2 font-display text-xl font-black italic uppercase text-white">
              BUSCANDO OTRO JUGADOR EN LÍNEA AL MISMO TIEMPO…
            </h3>
            <p className="mt-1 text-xs text-slate-300">
              En cuanto otro piloto pulse &ldquo;Emparejar en vivo&rdquo; desde otra ventana o dispositivo, ambos entrarán automáticamente a la misma grilla.
            </p>
            <p className="mt-1.5 text-[11px] font-mono text-amber-300">
              Pilotos conectados ahora: {multiplayerClient.onlineCount} · En cola: {multiplayerClient.waitingInQueue}
            </p>
            <button
              type="button"
              onClick={() => multiplayerClient.leaveQueue()}
              className="mt-4 rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:border-white cursor-pointer"
            >
              Cancelar búsqueda
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {/* Opción 1: Emparejamiento automático simultáneo */}
            <div className="flex flex-col justify-between rounded-xl border border-cyan-400/40 bg-gradient-to-b from-cyan-950/45 to-slate-950/85 p-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-300">
                  <Globe className="h-4 w-4" />
                  <span>EMPAREJAMIENTO SIMULTÁNEO</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  Entrá a la cola rápida: si otro jugador entra al mismo tiempo, el servidor los une automáticamente en la misma carrera 3D.
                </p>
              </div>
              <button
                type="button"
                onClick={handleQuickMatch}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E5F5] px-4 py-3 font-display text-sm font-black italic uppercase text-slate-950 transition hover:bg-cyan-300 cursor-pointer shadow-[0_0_20px_rgba(0,229,245,0.35)]"
              >
                <Users className="h-4 w-4" />
                <span>EMPAREJAR EN VIVO AHORA</span>
              </button>
            </div>

            {/* Opción 2: Sala privada con código de 4 letras */}
            <div className="flex flex-col justify-between rounded-xl border border-amber-400/35 bg-gradient-to-b from-amber-950/30 to-slate-950/85 p-4">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
                  <KeyRound className="h-4 w-4" />
                  <span>SALA DIRECTA CON CÓDIGO</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  Creá un código de 4 letras o ingresá el de tu rival para competir cara a cara.
                </p>
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  className="mt-2.5 w-full rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-2 text-xs font-black uppercase tracking-wider text-amber-200 hover:bg-amber-500/25 cursor-pointer"
                >
                  + Crear Sala y Obtener Código
                </button>
              </div>

              <form onSubmit={handleJoinCode} className="mt-3 flex gap-2">
                <input
                  type="text"
                  maxLength={4}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO"
                  aria-label="Código de sala de 4 letras"
                  className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-center font-mono text-sm font-black uppercase tracking-widest text-white outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={joinCode.trim().length < 4}
                  className="flex-1 rounded-lg bg-amber-400 px-3 py-2 text-xs font-black uppercase text-slate-950 hover:bg-amber-300 disabled:opacity-40 cursor-pointer"
                >
                  Unirse
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

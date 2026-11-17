import React, { useState, useEffect } from 'react';
import { Vehicle, RaceTrackConfig, VehicleRaceResult, PreferenceWeights } from '../types/vehicle';
import { Photographic360Viewer } from './Photographic360Viewer';
import { Race3DPerspectiveView } from './Race3DPerspectiveView';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Award, 
  Users, 
  Radio, 
  X, 
  ChevronRight, 
  Sliders, 
  Maximize2, 
  Minimize2,
  Trophy,
  Flame,
  CheckCircle2,
  Video
} from 'lucide-react';

interface DatacarLiveModeProps {
  vehicles: Vehicle[];
  currentTrack: RaceTrackConfig;
  onSelectTrack: (track: RaceTrackConfig) => void;
  tracks: RaceTrackConfig[];
  simulationResults: VehicleRaceResult[];
  weights: PreferenceWeights;
  onOpenResults: () => void;
  onCloseLiveMode: () => void;
}

export const DatacarLiveMode: React.FC<DatacarLiveModeProps> = ({
  vehicles,
  currentTrack,
  onSelectTrack,
  tracks,
  simulationResults,
  onOpenResults,
  onCloseLiveMode,
}) => {
  // Live audience voting simulation & manual control for the host
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    vehicles.forEach((v, idx) => {
      initial[v.id] = 120 + idx * 45;
    });
    return initial;
  });

  const [activeTabLive, setActiveTabLive] = useState<'360_preview' | 'live_race'>('360_preview');
  const [raceVisualMode, setRaceVisualMode] = useState<'3d' | '2d'>('3d');
  const [focusedCarId, setFocusedCarId] = useState<string>(vehicles[0]?.id || '');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isHostDrawerOpen, setIsHostDrawerOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);

  const focusedCar = vehicles.find((v) => v.id === focusedCarId) || vehicles[0];

  // Calculate vote percentages
  const totalVotes = Object.values(voteCounts).reduce((acc, v) => acc + v, 0) || 1;
  const votePcts: Record<string, number> = {};
  vehicles.forEach((v) => {
    votePcts[v.id] = Math.round(((voteCounts[v.id] || 0) / totalVotes) * 100);
  });

  const handleAddVote = (vehicleId: string, amount: number) => {
    setVoteCounts((prev) => ({
      ...prev,
      [vehicleId]: (prev[vehicleId] || 0) + amount,
    }));
  };

  const handleResetVotes = () => {
    const reset: Record<string, number> = {};
    vehicles.forEach((v) => {
      reset[v.id] = 10;
    });
    setVoteCounts(reset);
  };

  // Countdown sequence before race
  const handleStartRaceSequence = () => {
    setActiveTabLive('360_preview');
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 1) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 1) {
      const timer = setTimeout(() => {
        setCountdown(0); // LARGADA
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      const timer = setTimeout(() => {
        setCountdown(null);
        setActiveTabLive('live_race');
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      {/* 9:16 Vertical Container - TikTok Stream Screen */}
      <div 
        className={`relative bg-[#070b14] border-2 border-sky-500/40 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(56,189,248,0.2)] flex flex-col justify-between select-none ${
          isFullscreen 
            ? 'w-full h-full max-w-[540px]' 
            : 'w-full max-w-[430px] h-[92vh] max-h-[880px]'
        }`}
        style={{ aspectRatio: '9/16' }}
      >
        {/* TOP SAFE ZONE: LIVE Watermark & Challenge Header */}
        <div className="pt-4 px-4 pb-2 bg-gradient-to-b from-black/95 via-black/80 to-transparent z-20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-600/90 text-white font-mono font-bold text-[10px] tracking-wider animate-pulse">
                <Radio className="w-2.5 h-2.5" /> LIVE
              </span>
              <span className="text-xs font-black font-display tracking-wider text-white uppercase">
                DATACAR <span className="text-sky-400">ARENA</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                RONDA {roundNumber}
              </span>
              <button
                onClick={onCloseLiveMode}
                className="p-1 rounded-lg bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
                title="Cerrar Modo TikTok"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Current Challenge Banner */}
          <div className="bg-slate-950/90 border border-sky-500/30 px-3 py-1.5 rounded-xl shadow-lg flex items-center justify-between">
            <div>
              <span className="text-[9px] font-mono text-sky-400 uppercase tracking-wider block font-bold">
                DESAFÍO EN VIVO:
              </span>
              <span className="text-xs font-black text-white uppercase font-display truncate block">
                {currentTrack.name}
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-amber-400">
              {currentTrack.distanceMeters}m {currentTrack.inclineGradePercent > 0 && `+${currentTrack.inclineGradePercent}%`}
            </span>
          </div>
        </div>

        {/* MIDDLE STAGE: 360 Spin / Live Race Canvas / Countdown */}
        <div className="flex-1 relative flex flex-col justify-center items-center overflow-hidden">
          {countdown !== null && (
            <div className="absolute inset-0 z-40 bg-black/85 flex flex-col items-center justify-center animate-fadeIn">
              <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-widest mb-2">
                ¡PREPARADOS EN LA GRILLA!
              </span>
              <div className="text-7xl font-black font-display text-white tracking-wider animate-bounce">
                {countdown === 0 ? (
                  <span className="text-emerald-400 text-6xl">¡YA!</span>
                ) : (
                  countdown
                )}
              </div>
              <span className="text-xs font-mono text-slate-400 mt-4">
                {currentTrack.name}
              </span>
            </div>
          )}

          {activeTabLive === '360_preview' ? (
            <div className="w-full h-full flex flex-col justify-center px-2 py-1">
              {/* Contenders Selector Tabs for 360 Preview */}
              <div className="flex items-center justify-center gap-1.5 mb-2">
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setFocusedCarId(v.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                      focusedCarId === v.id
                        ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/30'
                        : 'bg-slate-900/90 text-slate-300 border-slate-800'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>

              {/* 360 Turntable in vertical format */}
              <div className="w-full">
                {focusedCar && (
                  <Photographic360Viewer
                    vehicle={focusedCar}
                    compact={true}
                  />
                )}
              </div>

              {/* Quick Specs Cards */}
              <div className="grid grid-cols-3 gap-1.5 mt-2 px-1 text-center font-mono text-[10px]">
                <div className="bg-slate-950/80 border border-slate-800 p-1.5 rounded-lg">
                  <span className="text-slate-500 block">POTENCIA</span>
                  <span className="font-bold text-sky-400">{focusedCar?.powerHp} HP</span>
                </div>
                <div className="bg-slate-950/80 border border-slate-800 p-1.5 rounded-lg">
                  <span className="text-slate-500 block">TORQUE</span>
                  <span className="font-bold text-white">{focusedCar?.torqueNm} Nm</span>
                </div>
                <div className="bg-slate-950/80 border border-slate-800 p-1.5 rounded-lg">
                  <span className="text-slate-500 block">PRECIO</span>
                  <span className="font-bold text-emerald-400">US$ {focusedCar?.equipment.priceUsd.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col justify-center px-1">
              <div className="w-full rounded-xl overflow-hidden border border-slate-800 shadow-inner">
                {raceVisualMode === '3d' ? (
                  <Race3DPerspectiveView
                    vehicles={vehicles}
                    track={currentTrack}
                    simulationResults={simulationResults}
                    onFinishRace={onOpenResults}
                    onSwitchTo2D={() => setRaceVisualMode('2d')}
                    compact={true}
                  />
                ) : (
                  <Race3DPerspectiveView
                    vehicles={vehicles}
                    track={currentTrack}
                    simulationResults={simulationResults}
                    onFinishRace={onOpenResults}
                    compact={true}
                  />
                )}
              </div>

              <div className="mt-2 flex items-center justify-between px-2">
                <button
                  onClick={() => setActiveTabLive('360_preview')}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 text-[10px] font-mono hover:text-white"
                >
                  ◀ Volver a Vista 360°
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setRaceVisualMode(raceVisualMode === '3d' ? '2d' : '3d')}
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-sky-400 font-bold text-[10px] font-mono flex items-center gap-1 hover:border-slate-700"
                  >
                    <Video className="w-3 h-3" />
                    <span>{raceVisualMode === '3d' ? 'Cambiar a 2D' : 'Cambiar a 3D'}</span>
                  </button>

                  <button
                    onClick={onOpenResults}
                    className="px-2.5 py-1 rounded-lg bg-sky-500 text-slate-950 font-bold text-[10px] font-mono flex items-center gap-1 shadow-md shadow-sky-500/20"
                  >
                    <Award className="w-3 h-3" /> Ver Podio
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM SAFE ZONE: Live Audience Voting Bar & TikTok Poll */}
        <div className="p-3 bg-gradient-to-t from-black via-black/95 to-transparent z-20 space-y-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1 font-display">
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> ¿CUÁL GANA? ¡VOTÁ EN EL CHAT!
            </span>
            <span className="text-[9px] font-mono text-slate-400">
              {totalVotes.toLocaleString()} Votos
            </span>
          </div>

          {/* Voting Bars for Audience (A, B, C) */}
          <div className="space-y-1.5">
            {vehicles.map((v, idx) => {
              const letter = idx === 0 ? 'A' : idx === 1 ? 'B' : 'C';
              const pct = votePcts[v.id] || 0;
              return (
                <div key={v.id} className="relative rounded-lg overflow-hidden bg-slate-900/90 border border-slate-800 p-1.5">
                  <div 
                    className="absolute inset-y-0 left-0 bg-sky-500/25 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                  <div className="relative flex items-center justify-between text-xs font-mono px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-sky-500 text-slate-950 font-black text-[10px] flex items-center justify-center font-display">
                        {letter}
                      </span>
                      <span className="font-bold text-white uppercase">{v.brand} {v.name}</span>
                    </div>
                    <span className="font-extrabold text-sky-400 tabular-nums">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Call to Action direct link */}
          <div className="pt-1 text-center">
            <span className="text-[9px] font-mono text-slate-400 block">
              Fichas técnicas y cotizaciones oficiales en{' '}
              <strong className="text-sky-400">datacarpy.com</strong>
            </span>
          </div>
        </div>
      </div>

      {/* HOST CONTROL PANEL (Panel para el Conductor del LIVE) */}
      <div 
        className={`fixed right-4 top-4 bottom-4 w-80 bg-slate-950/95 border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col justify-between transition-transform duration-300 z-50 ${
          isHostDrawerOpen ? 'translate-x-0' : 'translate-x-[340px]'
        }`}
      >
        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              <h4 className="text-xs font-black text-white uppercase font-display tracking-wider">
                Control Conductor LIVE
              </h4>
            </div>
            <button
              onClick={() => setIsHostDrawerOpen(!isHostDrawerOpen)}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Challenge Selector */}
          <div>
            <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
              Seleccionar Desafío en Vivo:
            </label>
            <select
              value={currentTrack.id}
              onChange={(e) => {
                const tr = tracks.find((t) => t.id === e.target.value);
                if (tr) onSelectTrack(tr);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
            >
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Action Trigger Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleStartRaceSequence}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>🎬 Iniciar Cuenta Regresiva & Carrera</span>
            </button>

            <button
              onClick={onOpenResults}
              className="w-full py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all"
            >
              <Trophy className="w-4 h-4" />
              <span>🏆 Revelar Ganador & Podio</span>
            </button>
          </div>

          {/* Audience Voting Management (Add Votes from Chat) */}
          <div className="border-t border-slate-800/80 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Votos del Chat en Vivo:
              </span>
              <button
                onClick={handleResetVotes}
                className="text-[9px] font-mono text-slate-500 hover:text-red-400"
              >
                Resetear Votos
              </button>
            </div>

            <div className="space-y-2">
              {vehicles.map((v, idx) => {
                const letter = idx === 0 ? 'A' : idx === 1 ? 'B' : 'C';
                return (
                  <div key={v.id} className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {letter} · {v.name}
                      </span>
                      <span className="text-[10px] font-mono text-sky-400 font-bold">
                        {voteCounts[v.id] || 0} votos ({votePcts[v.id]}%)
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAddVote(v.id, 1)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-[10px] font-mono font-bold text-slate-300"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => handleAddVote(v.id, 10)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-[10px] font-mono font-bold text-slate-300"
                      >
                        +10
                      </button>
                      <button
                        onClick={() => handleAddVote(v.id, 50)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-[10px] font-mono font-bold text-slate-300"
                      >
                        +50
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Drawer Actions */}
        <div className="border-t border-slate-800 pt-3 space-y-2">
          <button
            onClick={() => setRoundNumber((r) => r + 1)}
            className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-mono flex items-center justify-center gap-1.5 border border-slate-800"
          >
            <span>🔄 Siguiente Ronda (#{roundNumber + 1})</span>
          </button>
        </div>
      </div>

      {/* Floating Toggle Button to reopen host drawer if closed */}
      {!isHostDrawerOpen && (
        <button
          onClick={() => setIsHostDrawerOpen(true)}
          className="fixed right-4 top-4 z-50 p-2.5 rounded-xl bg-sky-500 text-slate-950 font-bold shadow-lg shadow-sky-500/30 flex items-center gap-1.5 font-mono text-xs"
        >
          <Sliders className="w-4 h-4" />
          <span>Panel Conductor</span>
        </button>
      )}
    </div>
  );
};

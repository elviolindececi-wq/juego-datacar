import React from 'react';
import { RaceTrackConfig, Vehicle } from '../types/vehicle';
import { PRESET_TRACKS } from '../data/presetVehicles';
import { Truck, Mountain, Gauge, Flag, Zap, ArrowRight, Fuel } from 'lucide-react';

interface LoadTestConfigProps {
  currentTrack: RaceTrackConfig;
  onSelectTrack: (track: RaceTrackConfig) => void;
  selectedVehicles: Vehicle[];
}

export const LoadTestConfig: React.FC<LoadTestConfigProps> = ({
  currentTrack,
  onSelectTrack,
  selectedVehicles,
}) => {
  const handlePresetSelect = (trackPreset: typeof PRESET_TRACKS[0]) => {
    onSelectTrack({ ...trackPreset });
  };

  const handleCargoChange = (kg: number) => {
    onSelectTrack({
      ...currentTrack,
      cargoPayloadKg: kg,
    });
  };

  const handleInclineChange = (grade: number) => {
    onSelectTrack({
      ...currentTrack,
      inclineGradePercent: grade,
    });
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-6">
      {/* Track Preset Tabs */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
          Selecciona Disciplina de Carrera & Ensayo
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {PRESET_TRACKS.map((t) => {
            const isActive = currentTrack.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handlePresetSelect(t)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isActive
                    ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                <div>
                  <span className={`text-xs font-bold block ${isActive ? 'text-blue-400' : 'text-white'}`}>
                    {t.name}
                  </span>
                  <span className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                    {t.subtitle}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>{t.distanceMeters}m</span>
                  {t.inclineGradePercent > 0 && <span className="text-amber-400">+{t.inclineGradePercent}%</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Load & Incline Controls (Prueba de Carga a través de Potencia) */}
      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-purple-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Parámetros de Carga & Pendiente (Ensayo de Fuerza)
            </h4>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Física: F = m·a + F_pendiente + F_arrastre
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cargo Payload Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-purple-400" /> Carga Remolcada Adicional:
              </span>
              <span className="font-bold text-purple-400 tabular-nums">
                +{currentTrack.cargoPayloadKg.toLocaleString()} kg
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="15000"
              step="250"
              value={currentTrack.cargoPayloadKg}
              onChange={(e) => handleCargoChange(parseInt(e.target.value) || 0)}
              className="w-full accent-purple-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>0 kg (Vacío)</span>
              <span>1,500 kg (Remolque)</span>
              <span>5,000 kg (Maquinaria)</span>
              <span>15,000 kg (Carga Extrema)</span>
            </div>
          </div>

          {/* Incline Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Mountain className="w-3.5 h-3.5 text-amber-400" /> Inclinación de Pendiente:
              </span>
              <span className="font-bold text-amber-400 tabular-nums">
                +{currentTrack.inclineGradePercent}% Grado
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              step="1"
              value={currentTrack.inclineGradePercent}
              onChange={(e) => handleInclineChange(parseInt(e.target.value) || 0)}
              className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>0% (Plano)</span>
              <span>8% (Autopista)</span>
              <span>15% (Puerto de Montaña)</span>
              <span>25% (Rampa Extrema)</span>
            </div>
          </div>
        </div>

        {/* Nivel de Combustible / Carga Inicial (Simulación de Corte por Energía / Varado) */}
        <div className="pt-3 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
              <Fuel className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-bold uppercase tracking-wider">
                Nivel Inicial de Combustible / Batería (Simular Corte de Energía):
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onSelectTrack({ ...currentTrack, initialFuelPercent: 100 })}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all ${
                  (currentTrack.initialFuelPercent ?? 100) === 100
                    ? 'bg-sky-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                100% (Lleno)
              </button>
              <button
                onClick={() => onSelectTrack({ ...currentTrack, initialFuelPercent: 10 })}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all ${
                  currentTrack.initialFuelPercent === 10
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                10% (Reserva)
              </button>
              <button
                onClick={() => onSelectTrack({ ...currentTrack, initialFuelPercent: 1.5 })}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all flex items-center gap-1 ${
                  currentTrack.initialFuelPercent === 1.5
                    ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                    : 'bg-slate-900 text-red-400 border border-red-900/60 hover:bg-red-950/40'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>1.5% (Crítico: Vararse en pista)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={currentTrack.initialFuelPercent ?? 100}
              onChange={(e) => onSelectTrack({ ...currentTrack, initialFuelPercent: parseFloat(e.target.value) || 100 })}
              className="flex-1 accent-sky-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <span className={`text-xs font-mono font-bold w-14 text-right tabular-nums ${
              (currentTrack.initialFuelPercent ?? 100) <= 2
                ? 'text-red-400'
                : (currentTrack.initialFuelPercent ?? 100) <= 15
                ? 'text-amber-400'
                : 'text-sky-400'
            }`}>
              {(currentTrack.initialFuelPercent ?? 100)}%
            </span>
          </div>
          {(currentTrack.initialFuelPercent ?? 100) <= 2 && (
            <p className="text-[11px] font-mono text-red-400 mt-1 flex items-center gap-1">
              ⚠️ Al 1.5%, la energía se agotará a mitad de pista: el motor o batería se apagará al 0%, el auto rodará por inercia y quedará varado con balizas encendidas.
            </p>
          )}
        </div>

        {/* Real-time Effective Power-to-weight Impact Matrix */}
        {selectedVehicles.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800/80">
            <span className="text-[11px] font-mono text-slate-400 block mb-2">
              Impacto de la masa sobre la relación Potencia/Peso efectiva:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {selectedVehicles.map((v) => {
                const effectiveMass = v.weightKg + currentTrack.cargoPayloadKg;
                const effectiveRatio = Math.round((v.powerHp / (effectiveMass / 1000)) * 10) / 10;
                const isOverloaded = currentTrack.cargoPayloadKg > v.maxPayloadKg;

                return (
                  <div
                    key={v.id}
                    className={`p-2 rounded-lg border text-xs font-mono tabular-nums ${
                      isOverloaded
                        ? 'bg-red-950/30 border-red-800/60 text-red-300'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate text-[11px] font-bold text-white">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                      <span className="truncate">{v.name}</span>
                    </div>
                    <div className="flex justify-between text-[11px] mt-1">
                      <span className="text-slate-400">P/P real:</span>
                      <span className="font-bold text-emerald-400">{effectiveRatio} HP/t</span>
                    </div>
                    {isOverloaded && (
                      <span className="text-[10px] text-red-400 block mt-0.5 font-sans font-semibold">
                        ⚠️ Sobrecarga ({v.maxPayloadKg} kg máx)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

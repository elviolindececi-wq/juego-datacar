import React from 'react';
import { PreferenceWeights } from '../types/vehicle';
import { PREFERENCE_PROFILES } from '../utils/preferenceMatcher';
import { Zap, Shield, Sparkles, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';

interface PreferenceSlidersBarProps {
  weights: PreferenceWeights;
  onChangeWeights: (newWeights: PreferenceWeights) => void;
  activeProfile: string | null;
  setActiveProfile: (profile: string | null) => void;
  onToggleBreakdown: () => void;
  isBreakdownOpen: boolean;
}

export const PreferenceSlidersBar: React.FC<PreferenceSlidersBarProps> = ({
  weights,
  onChangeWeights,
  activeProfile,
  setActiveProfile,
  onToggleBreakdown,
  isBreakdownOpen,
}) => {
  const handleSliderChange = (field: keyof PreferenceWeights, value: number) => {
    setActiveProfile(null); // Custom adjustment
    onChangeWeights({
      ...weights,
      [field]: value,
    });
  };

  const handleSelectProfile = (key: string) => {
    const profile = PREFERENCE_PROFILES[key];
    if (profile) {
      setActiveProfile(key);
      onChangeWeights({ ...profile.weights });
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header with Title and Profiles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
          <h3 className="text-sm font-extrabold text-white font-display uppercase tracking-wider">
            Ponderador de Preferencias
          </h3>
          <span className="text-xs text-slate-400 hidden sm:inline">
            · Ajustá los sliders para calcular el Match en las tarjetas de arriba
          </span>
        </div>

        {/* Profile Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider shrink-0">
            Perfiles:
          </span>
          {Object.entries(PREFERENCE_PROFILES).map(([key, prof]) => {
            const isSelected = activeProfile === key;
            return (
              <button
                key={key}
                onClick={() => handleSelectProfile(key)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all shrink-0 border ${
                  isSelected
                    ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
                    : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
              >
                {prof.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Interactive Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
        {/* 1. Motor */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-200">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              MOTOR
            </span>
            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-amber-400 font-bold tabular-nums">
              {weights.motor}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={weights.motor}
            onChange={(e) => handleSliderChange('motor', parseInt(e.target.value) || 0)}
            className="w-full accent-sky-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
          />
        </div>

        {/* 2. Seguridad */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-200">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              SEGURIDAD
            </span>
            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-blue-400 font-bold tabular-nums">
              {weights.seguridad}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={weights.seguridad}
            onChange={(e) => handleSliderChange('seguridad', parseInt(e.target.value) || 0)}
            className="w-full accent-sky-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
          />
        </div>

        {/* 3. Tecnología / Confort */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              TECNOLOGÍA/CONFORT
            </span>
            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-purple-400 font-bold tabular-nums">
              {weights.tecnologia}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={weights.tecnologia}
            onChange={(e) => handleSliderChange('tecnologia', parseInt(e.target.value) || 0)}
            className="w-full accent-sky-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
          />
        </div>

        {/* 4. Economía */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-200">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              ECONOMÍA
            </span>
            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-emerald-400 font-bold tabular-nums">
              {weights.economia}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={weights.economia}
            onChange={(e) => handleSliderChange('economia', parseInt(e.target.value) || 0)}
            className="w-full accent-sky-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Footer Text and Toggle Breakdown Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-xs">
        <p className="text-[11px] text-slate-400 italic">
          El resultado se refleja en vivo en los cuadros de producto de arriba y decide el ganador del match.
        </p>

        <button
          onClick={onToggleBreakdown}
          className="flex items-center gap-1 font-mono font-bold text-sky-400 hover:text-sky-300 transition-colors uppercase tracking-wider"
        >
          <span>{isBreakdownOpen ? 'Ocultar Desglose de Puntos' : 'Ver Desglose de Puntos'}</span>
          {isBreakdownOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

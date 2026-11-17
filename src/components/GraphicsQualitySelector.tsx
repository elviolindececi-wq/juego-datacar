import React, { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
  GRAPHICS_QUALITY_OPTIONS,
  getStoredGraphicsQualityPreset,
  setStoredGraphicsQualityPreset,
  subscribeGraphicsQualityPreset,
  type GraphicsQualityPreset,
} from '../utils/graphicsQualityProfile';

interface GraphicsQualitySelectorProps {
  compact?: boolean;
  onChange?: (preset: GraphicsQualityPreset) => void;
}

export const GraphicsQualitySelector: React.FC<GraphicsQualitySelectorProps> = ({
  compact = false,
  onChange,
}) => {
  const [preset, setPreset] = useState<GraphicsQualityPreset>(() =>
    getStoredGraphicsQualityPreset(),
  );

  useEffect(() => {
    return subscribeGraphicsQualityPreset((next) => {
      setPreset(next);
    });
  }, []);

  const handleSelect = (next: GraphicsQualityPreset) => {
    setStoredGraphicsQualityPreset(next);
    setPreset(next);
    onChange?.(next);
  };

  const activeOption =
    GRAPHICS_QUALITY_OPTIONS.find((o) => o.id === preset) ?? GRAPHICS_QUALITY_OPTIONS[0];

  return (
    <div
      className={`rounded-lg border border-slate-700/80 bg-[#0b1b26] ${
        compact ? 'p-2' : 'p-3'
      }`}
      data-testid="graphics-quality-selector"
      data-active-preset={preset}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#00E5F5]">
          <SlidersHorizontal size={13} />
          <span>Calidad Gráfica 3D</span>
        </span>
        <span className="text-[10px] font-mono font-bold text-amber-300 uppercase">
          {activeOption.label}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="group" aria-label="Seleccionar perfil de calidad gráfica">
        {GRAPHICS_QUALITY_OPTIONS.map((opt) => {
          const isActive = opt.id === preset;
          return (
            <button
              key={opt.id}
              type="button"
              data-graphics-preset={opt.id}
              aria-pressed={isActive}
              onClick={() => handleSelect(opt.id)}
              className={`rounded-md border px-2 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wide transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#00E5F5] bg-[#00E5F5]/20 text-white'
                  : 'border-slate-700 bg-slate-900/90 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {!compact && (
        <p className="mt-1.5 text-[10px] text-slate-400 leading-snug">
          {activeOption.description}
        </p>
      )}
    </div>
  );
};

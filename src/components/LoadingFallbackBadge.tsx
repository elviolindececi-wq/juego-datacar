import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingFallbackBadgeProps {
  label?: string;
  compact?: boolean;
  fullHeight?: boolean;
}

/**
 * Indicador de carga no intrusivo para vistas diferidas con React.lazy y recursos 3D bajo demanda.
 */
export const LoadingFallbackBadge: React.FC<LoadingFallbackBadgeProps> = ({
  label = 'Cargando vista…',
  compact = false,
  fullHeight = false,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="lazy-loading-fallback"
      className={`flex w-full items-center justify-center ${
        fullHeight ? 'min-h-[60dvh]' : compact ? 'py-6' : 'py-12'
      }`}
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#00E5F5]/35 bg-[#061219]/95 px-6 py-4 text-center shadow-[0_14px_38px_rgba(0,0,0,0.75)]">
        <div className="flex items-center gap-2.5 text-cyan-300">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-100">
            {label}
          </span>
        </div>
        <div className="h-1.5 w-44 overflow-hidden rounded-full bg-slate-800/90 border border-slate-700/70">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-cyan-500 via-sky-400 to-amber-400" />
        </div>
      </div>
    </div>
  );
};

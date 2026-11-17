import React from 'react';

export const CIRCUIT_META: Record<
  string,
  { curves: number; terrain: string; path: string; dot: [number, number] }
> = {
  aviadores: {
    curves: 12,
    terrain: 'Desnivel bajo',
    path: 'M 28 76 C 18 62, 34 42, 56 46 C 72 49, 78 24, 104 22 C 130 20, 134 38, 158 34 C 182 30, 198 18, 202 34 C 206 50, 172 64, 138 74 C 102 84, 52 94, 28 76 Z',
    dot: [114, 80],
  },
  avelino: {
    curves: 16,
    terrain: 'Asfalto exigente',
    path: 'M 24 72 C 20 44, 48 24, 78 30 C 102 35, 114 16, 148 22 C 182 28, 200 48, 190 68 C 180 86, 142 74, 112 84 C 82 94, 32 92, 24 72 Z',
    dot: [98, 87],
  },
  herrera: {
    curves: 14,
    terrain: 'Tramo urbano',
    path: 'M 30 78 L 46 34 L 92 38 L 112 20 L 176 24 L 194 54 L 154 76 L 96 72 L 64 88 Z',
    dot: [125, 74],
  },
  'jose-felix': {
    curves: 11,
    terrain: 'Desnivel medio',
    path: 'M 24 68 C 36 32, 82 22, 122 30 C 156 36, 196 26, 198 50 C 200 74, 154 84, 108 82 C 66 80, 16 90, 24 68 Z',
    dot: [108, 82],
  },
  artigas: {
    curves: 13,
    terrain: 'Zona ribereña',
    path: 'M 22 74 C 34 50, 58 58, 84 36 C 110 14, 156 18, 188 34 C 206 44, 194 72, 162 78 C 122 86, 48 92, 22 74 Z',
    dot: [124, 83],
  },
  oliva: {
    curves: 15,
    terrain: 'Casco histórico',
    path: 'M 32 76 L 42 28 L 106 24 L 122 44 L 184 32 L 192 68 L 132 82 L 78 78 Z',
    dot: [105, 80],
  },
};

export function CircuitWireframeSVG({
  circuitId,
  compact = false,
}: {
  circuitId: string;
  compact?: boolean;
}) {
  const meta = CIRCUIT_META[circuitId] ?? CIRCUIT_META.aviadores;
  return (
    <svg
      viewBox="0 0 220 105"
      className={
        compact
          ? 'w-8 h-5 shrink-0'
          : 'w-full h-full max-h-[88px] md:max-h-[108px] overflow-visible'
      }
      aria-hidden="true"
    >
      <defs>
        <filter id={`dc-glow-${circuitId}`} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={meta.path}
        fill="none"
        stroke="rgba(0,229,255,0.42)"
        strokeWidth={compact ? 8 : 9.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={meta.path}
        fill="none"
        stroke="#081426"
        strokeWidth={compact ? 5 : 6.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={meta.path}
        fill="none"
        stroke="#ffffff"
        strokeWidth={compact ? 2.4 : 3.3}
        strokeLinejoin="round"
        strokeLinecap="round"
        filter={compact ? undefined : `url(#dc-glow-${circuitId})`}
      />
      {!compact && (
        <>
          <circle cx={meta.dot[0]} cy={meta.dot[1]} r="7" fill="rgba(251,191,36,0.38)" />
          <circle
            cx={meta.dot[0]}
            cy={meta.dot[1]}
            r="3.9"
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="1.3"
          />
        </>
      )}
    </svg>
  );
}

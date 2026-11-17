import React from 'react';
import { Car, Box, Flag, Play, Trophy, Sparkles } from 'lucide-react';

export type AppStage = 'select_cars' | 'showroom_360' | 'select_challenge' | 'live_race' | 'results_podium' | 'match_recommendation';

interface StageNavigatorProps {
  currentStage: AppStage;
  onSelectStage: (stage: AppStage) => void;
  selectedCount: number;
}

export const StageNavigator: React.FC<StageNavigatorProps> = ({
  currentStage,
  onSelectStage,
  selectedCount,
}) => {
  const stages: { id: AppStage; number: number; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    {
      id: 'select_cars',
      number: 1,
      label: 'ELEGÍ TUS AUTOS',
      shortLabel: 'Autos',
      icon: <Car className="w-3.5 h-3.5" />,
    },
    {
      id: 'showroom_360',
      number: 2,
      label: 'EXPLORÁ EN 360°',
      shortLabel: 'Showroom 360°',
      icon: <Box className="w-3.5 h-3.5" />,
    },
    {
      id: 'select_challenge',
      number: 3,
      label: 'ELEGÍ EL DESAFÍO',
      shortLabel: 'Desafíos',
      icon: <Flag className="w-3.5 h-3.5" />,
    },
    {
      id: 'live_race',
      number: 4,
      label: 'CARRERA EN VIVO',
      shortLabel: 'Carrera',
      icon: <Play className="w-3.5 h-3.5 fill-current" />,
    },
    {
      id: 'results_podium',
      number: 5,
      label: 'PODIO & RESULTADOS',
      shortLabel: 'Podio',
      icon: <Trophy className="w-3.5 h-3.5" />,
    },
    {
      id: 'match_recommendation',
      number: 6,
      label: 'TU MATCH DATACAR',
      shortLabel: 'Mi Match',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <nav className="w-full bg-[#080d1a]/95 backdrop-blur-md border-y border-slate-800/80 px-2 sm:px-4 py-2 sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
        {stages.map((st, idx) => {
          const isActive = currentStage === st.id;
          return (
            <button
              key={st.id}
              onClick={() => onSelectStage(st.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25 ring-1 ring-sky-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                isActive ? 'bg-slate-950 text-sky-400' : 'bg-slate-800 text-slate-400'
              }`}>
                {st.number}
              </span>
              <span className="hidden md:inline">{st.label}</span>
              <span className="md:hidden">{st.shortLabel}</span>
              {st.id === 'select_cars' && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-sky-400'
                }`}>
                  {selectedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

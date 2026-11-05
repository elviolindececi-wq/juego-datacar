import React from 'react';
import { Gauge, Plus, Flag, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  activeTab: 'garage' | 'simulator' | 'comparison';
  setActiveTab: (tab: 'garage' | 'simulator' | 'comparison') => void;
  onOpenNewVehicleModal: () => void;
  selectedCount: number;
  onStartRaceClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewVehicleModal,
  selectedCount,
  onStartRaceClick,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#090d16]/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Gauge className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold font-display tracking-wider uppercase text-white whitespace-nowrap">
            Apex<span className="text-blue-500">Spec</span>
          </span>
          <span className="hidden sm:inline-block text-xs font-mono text-slate-500 border-l border-slate-700 pl-3">
            v2.4 Telemetría
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`whitespace-nowrap transition-colors hover:text-white pb-1 border-b-2 ${
              activeTab === 'simulator'
                ? 'text-white border-blue-500 font-semibold'
                : 'border-transparent text-slate-400'
            }`}
          >
            Pista & Simulación
          </button>
          <button
            onClick={() => setActiveTab('garage')}
            className={`whitespace-nowrap transition-colors hover:text-white pb-1 border-b-2 ${
              activeTab === 'garage'
                ? 'text-white border-blue-500 font-semibold'
                : 'border-transparent text-slate-400'
            }`}
          >
            Garaje & Fichas ({selectedCount} listos)
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`whitespace-nowrap transition-colors hover:text-white pb-1 border-b-2 ${
              activeTab === 'comparison'
                ? 'text-white border-blue-500 font-semibold'
                : 'border-transparent text-slate-400'
            }`}
          >
            Comparativa Técnica
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenNewVehicleModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            Nueva Ficha
          </button>

          <button
            onClick={onStartRaceClick}
            disabled={selectedCount < 2}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-wide uppercase rounded-lg shadow-lg transition-all whitespace-nowrap ${
              selectedCount >= 2
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Flag className="w-4 h-4" />
            <span>Competir ({selectedCount}/4)</span>
          </button>
        </div>
      </div>
    </header>
  );
};

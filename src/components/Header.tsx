import React from 'react';
import { Gauge, Flag, Radio, Volume2, VolumeX, ExternalLink, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: 'garage' | 'simulator' | 'comparison';
  setActiveTab: (tab: 'garage' | 'simulator' | 'comparison') => void;
  onOpenNewVehicleModal: () => void;
  selectedCount: number;
  onStartRaceClick: () => void;
  onOpenLiveMode: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  selectedCount,
  onStartRaceClick,
  onOpenLiveMode,
  isMuted,
  onToggleMute,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#060a13]/95 backdrop-blur-md border-b border-slate-800/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: DATACAR ARENA Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-sky-500/25">
            <Gauge className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black font-display tracking-wider uppercase text-white whitespace-nowrap">
                DATACAR <span className="text-sky-400">ARENA</span>
              </span>
              <span className="text-[10px] bg-sky-500/15 text-sky-400 font-mono font-bold px-1.5 py-0.2 rounded border border-sky-400/30">
                V2
              </span>
            </div>
            <a
              href="https://datacarpy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-slate-400 hover:text-sky-400 transition-colors flex items-center gap-1"
            >
              powered by datacarpy.com <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-mono font-bold text-slate-400">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`whitespace-nowrap transition-colors pb-1 border-b-2 ${
              activeTab === 'simulator'
                ? 'text-white border-sky-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Showroom & Pista
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`whitespace-nowrap transition-colors pb-1 border-b-2 ${
              activeTab === 'comparison'
                ? 'text-white border-sky-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Comparativa Radar
          </button>
          <button
            onClick={() => setActiveTab('garage')}
            className={`whitespace-nowrap transition-colors pb-1 border-b-2 ${
              activeTab === 'garage'
                ? 'text-white border-sky-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Fichas Técnicas Oficiales
          </button>
        </nav>

        {/* Zone 3: Actions (TikTok LIVE Mode + Sound + Start Race) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Audio Mute / Unmute */}
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Activar sonido de motores' : 'Silenciar sonido'}
            className={`p-2 rounded-xl border text-xs transition-colors ${
              isMuted
                ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                : 'bg-sky-500/10 border-sky-400/40 text-sky-400 shadow-md shadow-sky-500/10'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* MODO TIKTOK LIVE (9:16) */}
          <button
            onClick={onOpenLiveMode}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-lg shadow-red-600/25 border border-red-500/50 transition-all active:scale-95 whitespace-nowrap"
            title="Formato vertical 9:16 para TikTok LIVE y streaming"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden sm:inline">MODO TIKTOK</span>
            <span>9:16</span>
          </button>

          {/* Start Race Button */}
          <button
            onClick={onStartRaceClick}
            disabled={selectedCount < 2}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-bold uppercase rounded-xl shadow-lg transition-all whitespace-nowrap ${
              selectedCount >= 2
                ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/30 active:scale-95'
                : 'bg-slate-900 text-slate-500 cursor-not-allowed border border-slate-800'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>DESAFÍO ({selectedCount})</span>
          </button>
        </div>
      </div>
    </header>
  );
};

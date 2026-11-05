import React, { useState, useMemo } from 'react';
import { Vehicle, RaceTrackConfig, VehicleRaceResult, PreferenceWeights } from './types/vehicle';
import { PRESET_VEHICLES, PRESET_TRACKS } from './data/presetVehicles';
import { simulateFullRace } from './utils/physicsEngine';
import { calculatePreferencesMatch } from './utils/preferenceMatcher';
import { Header } from './components/Header';
import { DealershipCardsHeader } from './components/DealershipCardsHeader';
import { PreferenceSlidersBar } from './components/PreferenceSlidersBar';
import { PointsBreakdownModal } from './components/PointsBreakdownModal';
import { DetailedSpecsTable } from './components/DetailedSpecsTable';
import { RaceCanvas } from './components/RaceCanvas';
import { LoadTestConfig } from './components/LoadTestConfig';
import { VehicleSpecsModal } from './components/VehicleSpecsModal';
import { RaceResultsModal } from './components/RaceResultsModal';
import { ComparisonRadar } from './components/ComparisonRadar';
import { CarShowroom3D } from './components/CarShowroom3D';
import { Flag, Play, RotateCcw, Award, SlidersHorizontal, Sparkles, Box } from 'lucide-react';

export default function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(PRESET_VEHICLES);
  
  // Los 3 vehículos oficiales seleccionados por defecto para competir
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([
    'nissan-kicks-2027',
    'kia-carens-ex',
    'chevrolet-tracker-lite',
  ]);

  // Vehículo enfocado en el showroom 3D 360°
  const [showroomVehicleId, setShowroomVehicleId] = useState<string>('nissan-kicks-2027');

  // Ponderador de preferencias (Motor, Seguridad, Tecnología, Economía)
  const [preferenceWeights, setPreferenceWeights] = useState<PreferenceWeights>({
    motor: 50,
    seguridad: 50,
    tecnologia: 50,
    economia: 50,
  });

  const [activeProfile, setActiveProfile] = useState<string | null>('equilibrado');
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'simulator' | 'garage' | 'comparison'>('simulator');
  const [currentTrack, setCurrentTrack] = useState<RaceTrackConfig>(PRESET_TRACKS[0]);

  // Modales
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isSpecsModalOpen, setIsSpecsModalOpen] = useState(false);
  const [isNewVehicleModal, setIsNewVehicleModal] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);

  // Competidores en carrera
  const competingVehicles = useMemo(() => {
    return vehicles.filter((v) => selectedVehicleIds.includes(v.id));
  }, [vehicles, selectedVehicleIds]);

  // Simulación física continua de carrera
  const simulationResults: VehicleRaceResult[] = useMemo(() => {
    if (competingVehicles.length === 0) return [];
    return simulateFullRace(competingVehicles, currentTrack);
  }, [competingVehicles, currentTrack]);

  // Cálculo en vivo de afinidad y scores ponderados
  const matchScores = useMemo(() => {
    return calculatePreferencesMatch(competingVehicles, preferenceWeights, simulationResults);
  }, [competingVehicles, preferenceWeights, simulationResults]);

  // Alternar selección de vehículo para la carrera
  const handleToggleSelectVehicle = (vehicleId: string) => {
    setSelectedVehicleIds((prev) => {
      if (prev.includes(vehicleId)) {
        if (prev.length <= 1) return prev; // Mantener al menos 1
        return prev.filter((id) => id !== vehicleId);
      } else {
        if (prev.length >= 4) {
          return [...prev.slice(1), vehicleId];
        }
        return [...prev, vehicleId];
      }
    });
  };

  const handleSaveVehicle = (savedVehicle: Vehicle) => {
    setVehicles((prev) => {
      const exists = prev.some((v) => v.id === savedVehicle.id);
      if (exists) {
        return prev.map((v) => (v.id === savedVehicle.id ? savedVehicle : v));
      } else {
        return [savedVehicle, ...prev];
      }
    });
  };

  const handleOpenEditSpecs = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsNewVehicleModal(false);
    setIsSpecsModalOpen(true);
  };

  const handleOpenNewVehicle = () => {
    setEditingVehicle(null);
    setIsNewVehicleModal(true);
    setIsSpecsModalOpen(true);
  };

  const bestMatch = matchScores.find((s) => s.isBestMatch);
  const bestMatchVehicle = competingVehicles.find((v) => v.id === bestMatch?.vehicleId);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-slate-950">
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewVehicleModal={handleOpenNewVehicle}
        selectedCount={selectedVehicleIds.length}
        onStartRaceClick={() => setActiveTab('simulator')}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Dealership Comparador Header Section (Cards with Photos, Prices & Live Match % ) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-mono text-sky-400 uppercase tracking-wider font-semibold">
                INICIO / COMPARADOR
              </div>
              <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white uppercase">
                COMPARADOR DE <span className="text-sky-400">AUTOS 0KM</span> & CARRERA DE ATRIBUTOS
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                COMPARÁ SIN COSTO · PRECIOS OFICIALES DIRECTOS DE CONCESIONARIA · PRUEBAS DE PISTA Y CARGA
              </p>
            </div>

            {bestMatchVehicle && (
              <div className="bg-sky-500/10 border border-sky-400/30 px-3.5 py-1.5 rounded-xl flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono text-slate-300">Líder Actual por Match:</span>
                <span className="text-xs font-bold text-sky-400 uppercase font-mono">
                  {bestMatchVehicle.brand} {bestMatchVehicle.name} ({bestMatch?.totalMatchPercent}%)
                </span>
              </div>
            )}
          </div>

          {/* Product Cards Row */}
          <DealershipCardsHeader
            vehicles={competingVehicles}
            matchScores={matchScores}
            selectedIds={selectedVehicleIds}
            onToggleSelect={handleToggleSelectVehicle}
            onOpenSpecs={handleOpenEditSpecs}
            activeShowroomId={showroomVehicleId}
            onSelectShowroom={(id) => setShowroomVehicleId(id)}
          />

          {/* Ponderador de Preferencias Sliders (Motor, Seguridad, Tecnología, Economía) */}
          <PreferenceSlidersBar
            weights={preferenceWeights}
            onChangeWeights={setPreferenceWeights}
            activeProfile={activeProfile}
            setActiveProfile={setActiveProfile}
            onToggleBreakdown={() => setIsBreakdownModalOpen(true)}
            isBreakdownOpen={isBreakdownModalOpen}
          />

          {/* 3D Car Showroom Section (Rotación 360° Real de Estudio) */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-extrabold text-white font-display uppercase tracking-wider">
                  Showroom 360° Realista · Vista de Estudio Fotográfico Oficial
                </h3>
              </div>

              {/* Selector de vehículo para el showroom 3D */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {competingVehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setShowroomVehicleId(v.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap border ${
                      showroomVehicleId === v.id
                        ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color }} />
                    <span>{v.brand} {v.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Componente 360° */}
            {(() => {
              const focusedShowroomCar = vehicles.find((v) => v.id === showroomVehicleId) || vehicles[0];
              return (
                <CarShowroom3D
                  key={focusedShowroomCar.id}
                  vehicle={focusedShowroomCar}
                />
              );
            })()}
          </div>
        </div>

        {/* TAB 1: SIMULATOR & PISTA */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-lg font-bold text-white font-display uppercase tracking-wide">
                  Pista de Ensayos y Telemetría en Vivo
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsResultsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold font-mono rounded-lg transition-colors shadow-md shadow-sky-500/20"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Ver Dictamen Final</span>
                </button>
              </div>
            </div>

            {/* 2D Canvas Track Simulator */}
            <RaceCanvas
              vehicles={competingVehicles}
              track={currentTrack}
              simulationResults={simulationResults}
              onFinishRace={() => setIsResultsModalOpen(true)}
            />

            {/* Dynamic Load Test & Track Incline Configurator */}
            <LoadTestConfig
              currentTrack={currentTrack}
              onSelectTrack={setCurrentTrack}
              selectedVehicles={competingVehicles}
            />

            {/* Ficha Técnica Detallada Matrix Table */}
            <DetailedSpecsTable vehicles={competingVehicles} />
          </div>
        )}

        {/* TAB 2: GARAJE & FICHAS */}
        {activeTab === 'garage' && (
          <div className="space-y-6">
            <DetailedSpecsTable vehicles={competingVehicles} />
          </div>
        )}

        {/* TAB 3: COMPARATIVA TÉCNICA */}
        {activeTab === 'comparison' && (
          <div className="space-y-6">
            <ComparisonRadar vehicles={competingVehicles} />
          </div>
        )}
      </main>

      {/* Points Breakdown Modal */}
      <PointsBreakdownModal
        vehicles={competingVehicles}
        weights={preferenceWeights}
        scores={matchScores}
        isOpen={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
      />

      {/* Vehicle Specs Modal (Edit / Create) */}
      <VehicleSpecsModal
        vehicle={editingVehicle}
        isOpen={isSpecsModalOpen}
        onClose={() => setIsSpecsModalOpen(false)}
        onSave={handleSaveVehicle}
        isNew={isNewVehicleModal}
      />

      {/* Final Race & Preference Results Modal */}
      <RaceResultsModal
        results={simulationResults}
        track={currentTrack}
        weights={preferenceWeights}
        matchScores={matchScores}
        isOpen={isResultsModalOpen}
        onClose={() => setIsResultsModalOpen(false)}
        onRestartRace={() => {
          setIsResultsModalOpen(false);
          setActiveTab('simulator');
        }}
      />

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-800/80 py-6 bg-slate-950/80 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">ApexSpec · Comparador 0KM</span>
            <span aria-hidden="true">·</span>
            <span>Simulación Física y Ponderación de Preferencias (Nissan Kicks vs Kia Carens vs Chevrolet Tracker)</span>
          </div>
          <div className="text-slate-600">
            Física: P = F·v · F_arrastre = 0.5·ρ·Cd·A·v² · Ponderación: Σ(Score_i · Peso_i)
          </div>
        </div>
      </footer>
    </div>
  );
}

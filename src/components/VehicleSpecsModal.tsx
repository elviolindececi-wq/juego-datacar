import React, { useState, useEffect } from 'react';
import { Vehicle, DrivetrainType, FuelType, VehicleCategory } from '../types/vehicle';
import { X, Sparkles, Sliders, Zap, Weight, Gauge, Fuel, Wind, Truck, Disc } from 'lucide-react';
import { generateVehicleSpecsWithAI } from '../utils/geminiSpecs';

interface VehicleSpecsModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedVehicle: Vehicle) => void;
  isNew?: boolean;
}

export const VehicleSpecsModal: React.FC<VehicleSpecsModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSave,
  isNew = false,
}) => {
  const [formData, setFormData] = useState<Vehicle>({
    id: 'custom-' + Date.now(),
    name: 'Prototipo Custom',
    brand: 'Custom Brand',
    year: 2024,
    category: 'suv_compact',
    color: '#3b82f6',
    engineDescription: '1.2L Turbo 3 Cilindros',
    transmissionDescription: 'Automática 6 velocidades',
    powerHp: 500,
    torqueNm: 600,
    weightKg: 1500,
    topSpeedKmh: 300,
    accel0100: 3.5,
    drivetrain: 'AWD',
    dragCoeff: 0.30,
    frontalArea: 2.15,
    dimensions: {
      lengthMm: 4350,
      widthMm: 1800,
      heightMm: 1620,
      clearanceMm: 180,
    },
    fuelCapacityL: 65,
    fuelType: 'gasoline',
    fuelFeeding: 'Inyección Directa Turbo',
    consumptionBase: 11.5,
    consumptionRacing: 36.0,
    maxPayloadKg: 400,
    brakingDistance100: 31.0,
    tireGrip: 1.25,
    equipment: {
      priceUsd: 22000,
      trunkLiters: 420,
      groundClearanceMm: 180,
      seatingCapacity: 5,
      screenSize: '10.25"',
      connectivity: 'Apple CarPlay y Android Auto',
      brakesType: '4_discs',
      airbags: 6,
      rearCamera: true,
      adasFeatures: [],
      comfortFeatures: ['Aire acondicionado automático', 'Control crucero', 'Smart Key'],
    },
    description: 'Vehículo configurado a medida con especificaciones técnicas personalizadas.',
    isCustom: true,
  });

  const [aiQuery, setAiQuery] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  useEffect(() => {
    if (vehicle) {
      setFormData({ ...vehicle });
    } else {
      setFormData({
        id: 'custom-' + Date.now(),
        name: 'Prototipo GT Custom',
        brand: 'Apex Engineering',
        year: 2025,
        category: 'suv_compact',
        color: '#06b6d4',
        engineDescription: '1.5L Turbo 4 Cilindros',
        transmissionDescription: 'Automática 6 velocidades',
        powerHp: 130,
        torqueNm: 230,
        weightKg: 1350,
        topSpeedKmh: 195,
        accel0100: 9.2,
        drivetrain: 'FWD',
        dragCoeff: 0.32,
        frontalArea: 2.4,
        dimensions: {
          lengthMm: 4400,
          widthMm: 1820,
          heightMm: 1630,
          clearanceMm: 185,
        },
        fuelCapacityL: 50,
        fuelType: 'gasoline',
        fuelFeeding: 'Inyección Directa',
        consumptionBase: 6.5,
        consumptionRacing: 15.0,
        maxPayloadKg: 450,
        brakingDistance100: 36.0,
        tireGrip: 1.10,
        equipment: {
          priceUsd: 23500,
          trunkLiters: 430,
          groundClearanceMm: 185,
          seatingCapacity: 5,
          screenSize: '10.25"',
          connectivity: 'CarPlay y Android Auto inalámbrico',
          brakesType: '4_discs',
          airbags: 6,
          rearCamera: true,
          adasFeatures: [],
          comfortFeatures: ['Aire acondicionado automático', 'Smart Key'],
        },
        description: 'Vehículo configurado a medida con especificaciones técnicas.',
        isCustom: true,
      });
    }
  }, [vehicle, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof Vehicle, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAiAutoFill = async () => {
    if (!aiQuery.trim()) return;
    setIsGeneratingAi(true);
    try {
      const suggested = await generateVehicleSpecsWithAI(aiQuery);
      setFormData((prev) => ({
        ...prev,
        ...suggested,
        id: prev.id,
        isCustom: true,
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const powerToWeight = Math.round((formData.powerHp / (formData.weightKg / 1000)) * 10) / 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full border border-white/20"
              style={{ backgroundColor: formData.color }}
            />
            <div>
              <h2 className="text-lg font-bold text-white font-display uppercase tracking-wide">
                {isNew ? 'Nueva Ficha Técnica de Vehículo' : `Ficha Técnica: ${formData.brand} ${formData.name}`}
              </h2>
              <div className="text-xs text-slate-400 font-mono">
                Homologación de parámetros físicos de ingeniería
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Autofill Prompt Bar */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800/80">
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Autocompletar ficha técnica con IA (ej: "Lamborghini Revuelto", "Toyota GR Yaris", "Scania V8")</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="Introduce marca y modelo para extraer especificaciones técnicas reales..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAiAutoFill()}
            />
            <button
              onClick={handleAiAutoFill}
              disabled={isGeneratingAi || !aiQuery.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              {isGeneratingAi ? 'Consultando...' : 'Completar Ficha'}
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* General Identification */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Nombre del Modelo</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Marca / Fabricante</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Año</label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => handleChange('year', parseInt(e.target.value) || 2024)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Color Livery</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                  className="w-full h-[38px] bg-slate-900 border border-slate-800 rounded-lg p-1 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Section 1: Motor & Transmisión */}
          <div>
            <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 font-mono">
              <Zap className="w-3.5 h-3.5" /> 01. Planta Motriz y Tracción
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Potencia (HP / CV)</label>
                <input
                  type="number"
                  value={formData.powerHp}
                  onChange={(e) => handleChange('powerHp', Math.max(10, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Par Motor (Nm)</label>
                <input
                  type="number"
                  value={formData.torqueNm}
                  onChange={(e) => handleChange('torqueNm', Math.max(10, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tracción (Drivetrain)</label>
                <select
                  value={formData.drivetrain}
                  onChange={(e) => handleChange('drivetrain', e.target.value as DrivetrainType)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                >
                  <option value="AWD">AWD (Total 4x4)</option>
                  <option value="RWD">RWD (Trasera)</option>
                  <option value="FWD">FWD (Delantera)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Combustible / Fuente</label>
                <select
                  value={formData.fuelType}
                  onChange={(e) => handleChange('fuelType', e.target.value as FuelType)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                >
                  <option value="gasoline">Gasolina</option>
                  <option value="diesel">Diésel (Alto Par)</option>
                  <option value="electric">100% Eléctrico (EV)</option>
                  <option value="hybrid">Híbrido</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Dinámica, Peso y Aerodinámica */}
          <div>
            <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 font-mono">
              <Weight className="w-3.5 h-3.5" /> 02. Chasis, Peso y Aerodinámica
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Peso en Vacío (kg)</label>
                <input
                  type="number"
                  value={formData.weightKg}
                  onChange={(e) => handleChange('weightKg', Math.max(200, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">0-100 km/h Oficial (s)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.accel0100}
                  onChange={(e) => handleChange('accel0100', Math.max(1.0, parseFloat(e.target.value) || 3.0))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Velocidad Máx (km/h)</label>
                <input
                  type="number"
                  value={formData.topSpeedKmh}
                  onChange={(e) => handleChange('topSpeedKmh', Math.max(80, parseInt(e.target.value) || 120))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Coeficiente Arrastre Cx</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.dragCoeff}
                  onChange={(e) => handleChange('dragCoeff', Math.max(0.15, parseFloat(e.target.value) || 0.30))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Calculated Ratio Tag */}
            <div className="mt-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Relación Potencia / Peso de Fábrica:</span>
              <span className="text-emerald-400 font-bold">{powerToWeight} HP por Tonelada</span>
            </div>
          </div>

          {/* Section 3: Carga, Combustible y Frenos */}
          <div>
            <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 font-mono">
              <Truck className="w-3.5 h-3.5" /> 03. Prueba de Carga y Consumo
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Carga Máxima (kg)</label>
                <input
                  type="number"
                  value={formData.maxPayloadKg}
                  onChange={(e) => handleChange('maxPayloadKg', Math.max(50, parseInt(e.target.value) || 300))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Capacidad Tanque (L/kWh)</label>
                <input
                  type="number"
                  value={formData.fuelCapacityL}
                  onChange={(e) => handleChange('fuelCapacityL', Math.max(10, parseInt(e.target.value) || 50))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Consumo a Fondo (WOT)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.consumptionRacing}
                  onChange={(e) => handleChange('consumptionRacing', Math.max(5, parseFloat(e.target.value) || 30))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Frenado 100-0 km/h (m)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.brakingDistance100}
                  onChange={(e) => handleChange('brakingDistance100', Math.max(20, parseFloat(e.target.value) || 35))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onSave(formData);
              onClose();
            }}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-blue-600/30"
          >
            Guardar en Garaje
          </button>
        </div>
      </div>
    </div>
  );
};

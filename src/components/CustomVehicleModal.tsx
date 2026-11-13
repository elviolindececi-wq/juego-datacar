import React, { useState } from 'react';
import { Box, Check, Trash2, Upload, X } from 'lucide-react';
import type { DrivetrainType, FuelType, VehicleCategory } from '../types/vehicle';
import {
  createDefaultCustomVehicleInput,
  deleteCustomGlbFromIndexedDb,
  renderGenericCarPngPreview,
  saveCustomGlbFile,
  type CustomVehicleFormInput,
} from '../utils/customVehicleStore';
import { GENERIC_CUSTOM_CAR_PUBLIC_PATH } from '../utils/vehicle3DModelLoader';

interface CustomVehicleModalProps {
  isOpen: boolean;
  initialInput: CustomVehicleFormInput | null;
  onClose: () => void;
  onSave: (input: CustomVehicleFormInput) => void;
  onDelete?: () => void;
}

const COLOR_PRESETS = [
  '#06b6d4',
  '#2563eb',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#e2e8f0',
  '#1e293b',
];

export const CustomVehicleModal: React.FC<CustomVehicleModalProps> = ({
  isOpen,
  initialInput,
  onClose,
  onSave,
  onDelete,
}) => {
  const [form, setForm] = useState<CustomVehicleFormInput>(
    () => initialInput ?? createDefaultCustomVehicleInput(),
  );
  const [glbBusy, setGlbBusy] = useState(false);
  const [glbError, setGlbError] = useState<string | null>(null);

  if (!isOpen) return null;

  const previewUrl = renderGenericCarPngPreview(form.color, form.name || 'MI AUTO');

  const handleGlbFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.glb')) {
      setGlbError('El modelo 3D debe ser un archivo .glb válido.');
      return;
    }
    setGlbBusy(true);
    setGlbError(null);
    try {
      const saved = await saveCustomGlbFile(file);
      setForm((prev) => ({
        ...prev,
        hasUploadedGlb: true,
        uploadedGlbFileName: saved.fileName,
      }));
    } catch {
      setGlbError('No se pudo almacenar el archivo .glb en el navegador.');
    } finally {
      setGlbBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      name: (form.name || 'MI AUTO GENÉRICO').trim().slice(0, 28) || 'MI AUTO GENÉRICO',
      trim: (form.trim || 'PROTOTIPO').trim().slice(0, 32),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-vehicle-modal-title"
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-cyan-500/40 bg-slate-900 p-5 sm:p-6 text-slate-100 shadow-2xl my-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar creador de auto genérico"
          className="absolute right-4 top-4 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:text-white cursor-pointer"
        >
          <X size={16} />
        </button>

        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">
          GARAGE PERSONALIZADO · AUTO GENÉRICO
        </p>
        <h2 id="custom-vehicle-modal-title" className="mt-1 text-2xl font-black uppercase">
          Configurá tu propio vehículo
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Personalizá el nombre, la ficha técnica simulada y salí a correr en pista con él. En el Garage se muestra con su imagen PNG/estudio y ya queda preparado para recibir un modelo 3D <code className="text-cyan-300">.glb</code>.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Preview estudio PNG + selector de color */}
          <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-3 sm:grid-cols-[1.15fr_1fr] items-center">
            <img
              src={previewUrl}
              alt="Vista estudio de auto genérico"
              className="mx-auto h-32 w-full object-contain"
            />
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Color de carrocería
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, color: hex }))}
                    aria-label={`Color ${hex}`}
                    className={`h-7 w-7 rounded-full border-2 cursor-pointer transition-transform ${
                      form.color.toLowerCase() === hex.toLowerCase()
                        ? 'scale-110 border-white ring-2 ring-cyan-400/70'
                        : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                  aria-label="Color personalizado"
                  className="h-7 w-9 cursor-pointer rounded border border-slate-700 bg-transparent"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="custom-car-name" className="block text-[11px] font-bold uppercase text-slate-300">
                Nombre del vehículo
              </label>
              <input
                id="custom-car-name"
                type="text"
                required
                maxLength={28}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: MI SUV ASUNCIÓN 2.0"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="custom-car-trim" className="block text-[11px] font-bold uppercase text-slate-300">
                Versión / Subtítulo
              </label>
              <input
                id="custom-car-trim"
                type="text"
                maxLength={32}
                value={form.trim}
                onChange={(e) => setForm((p) => ({ ...p, trim: e.target.value }))}
                placeholder="Ej: TURBO SPORT"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="custom-car-category" className="block text-[11px] font-bold uppercase text-slate-400">
                Categoría
              </label>
              <select
                id="custom-car-category"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as VehicleCategory }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs font-semibold text-white"
              >
                <option value="suv_compact">SUV Compacto</option>
                <option value="suv_familiar">SUV Familiar</option>
                <option value="pickup">Pickup</option>
                <option value="track_toy">Deportivo Urbano</option>
                <option value="electric">Eléctrico</option>
              </select>
            </div>

            <div>
              <label htmlFor="custom-car-drive" className="block text-[11px] font-bold uppercase text-slate-400">
                Tracción
              </label>
              <select
                id="custom-car-drive"
                value={form.drivetrain}
                onChange={(e) => setForm((p) => ({ ...p, drivetrain: e.target.value as DrivetrainType }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs font-semibold text-white"
              >
                <option value="FWD">FWD (Delantera)</option>
                <option value="RWD">RWD (Trasera)</option>
                <option value="AWD">AWD (Integral)</option>
              </select>
            </div>

            <div>
              <label htmlFor="custom-car-fuel" className="block text-[11px] font-bold uppercase text-slate-400">
                Motorización
              </label>
              <select
                id="custom-car-fuel"
                value={form.fuelType}
                onChange={(e) => setForm((p) => ({ ...p, fuelType: e.target.value as FuelType }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs font-semibold text-white"
              >
                <option value="gasoline">Nafta</option>
                <option value="hybrid">Híbrido (HEV)</option>
                <option value="diesel">Diésel</option>
                <option value="electric">100% Eléctrico</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label htmlFor="custom-hp" className="block text-[10px] font-bold uppercase text-slate-400">
                Potencia (HP)
              </label>
              <input
                id="custom-hp"
                type="number"
                min={70}
                max={650}
                value={form.powerHp}
                onChange={(e) => setForm((p) => ({ ...p, powerHp: Number(e.target.value) || 120 }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm font-mono font-bold text-white"
              />
            </div>

            <div>
              <label htmlFor="custom-torque" className="block text-[10px] font-bold uppercase text-slate-400">
                Torque (Nm)
              </label>
              <input
                id="custom-torque"
                type="number"
                min={95}
                max={950}
                value={form.torqueNm}
                onChange={(e) => setForm((p) => ({ ...p, torqueNm: Number(e.target.value) || 180 }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm font-mono font-bold text-white"
              />
            </div>

            <div>
              <label htmlFor="custom-weight" className="block text-[10px] font-bold uppercase text-slate-400">
                Peso en vacío (kg)
              </label>
              <input
                id="custom-weight"
                type="number"
                min={850}
                max={2800}
                value={form.weightKg}
                onChange={(e) => setForm((p) => ({ ...p, weightKg: Number(e.target.value) || 1350 }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm font-mono font-bold text-white"
              />
            </div>

            <div>
              <label htmlFor="custom-seats" className="block text-[10px] font-bold uppercase text-slate-400">
                Plazas (ocupantes)
              </label>
              <input
                id="custom-seats"
                type="number"
                min={2}
                max={7}
                value={form.seatingCapacity}
                onChange={(e) => setForm((p) => ({ ...p, seatingCapacity: Number(e.target.value) || 5 }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm font-mono font-bold text-white"
              />
            </div>

            <div>
              <label htmlFor="custom-topspeed" className="block text-[10px] font-bold uppercase text-slate-400">
                Vel. Punta (km/h)
              </label>
              <input
                id="custom-topspeed"
                type="number"
                min={130}
                max={310}
                value={form.topSpeedKmh}
                onChange={(e) => setForm((p) => ({ ...p, topSpeedKmh: Number(e.target.value) || 185 }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm font-mono font-bold text-white"
              />
            </div>

            <div>
              <label htmlFor="custom-accel" className="block text-[10px] font-bold uppercase text-slate-400">
                0-100 km/h (s)
              </label>
              <input
                id="custom-accel"
                type="number"
                step="0.1"
                min={3.2}
                max={18}
                value={form.accel0100}
                onChange={(e) => setForm((p) => ({ ...p, accel0100: Number(e.target.value) || 9.5 }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm font-mono font-bold text-white"
              />
            </div>

            <div>
              <label htmlFor="custom-brake" className="block text-[10px] font-bold uppercase text-slate-400">
                Frenada 100-0 (m)
              </label>
              <input
                id="custom-brake"
                type="number"
                step="0.5"
                min={30}
                max={54}
                value={form.brakingDistance100}
                onChange={(e) =>
                  setForm((p) => ({ ...p, brakingDistance100: Number(e.target.value) || 38.5 }))
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm font-mono font-bold text-white"
              />
            </div>

            <div>
              <label htmlFor="custom-clearance" className="block text-[10px] font-bold uppercase text-slate-400">
                Despeje (mm)
              </label>
              <input
                id="custom-clearance"
                type="number"
                min={115}
                max={265}
                value={form.clearanceMm}
                onChange={(e) => setForm((p) => ({ ...p, clearanceMm: Number(e.target.value) || 185 }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm font-mono font-bold text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.absEnabled}
                onChange={(e) => setForm((p) => ({ ...p, absEnabled: e.target.checked }))}
                className="rounded border-slate-600"
              />
              <span>Frenos ABS simulados activos</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.adasBlindSpotEnabled}
                onChange={(e) => setForm((p) => ({ ...p, adasBlindSpotEnabled: e.target.checked }))}
                className="rounded border-slate-600"
              />
              <span>Alertas ADAS de punto ciego y colisión</span>
            </label>
          </div>

          {/* Slot preparado para modelo 3D .glb */}
          <div className="rounded-xl border border-cyan-500/30 bg-slate-950/75 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-200">
                <Box size={15} className="text-cyan-400 shrink-0" />
                <span>Modelo 3D de pista (.glb) — Preparado para carga futura</span>
              </div>
              {form.hasUploadedGlb && (
                <button
                  type="button"
                  onClick={() => {
                    void deleteCustomGlbFromIndexedDb();
                    setForm((p) => ({ ...p, hasUploadedGlb: false, uploadedGlbFileName: undefined }));
                  }}
                  className="text-[11px] font-bold text-rose-300 hover:text-rose-200 cursor-pointer"
                >
                  Quitar .glb
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Si todavía no subiste tu modelo 3D, en pista usará nuestra carrocería genérica en 3D con tu color. También podés subir tu archivo <strong>.glb</strong> ahora o colocarlo luego en <code className="text-slate-300">{GENERIC_CUSTOM_CAR_PUBLIC_PATH}</code>.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/50 bg-cyan-950/70 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-900/70 cursor-pointer">
                <Upload size={14} />
                <span>{glbBusy ? 'Cargando .glb...' : 'Cargar archivo .glb'}</span>
                <input
                  type="file"
                  accept=".glb"
                  onChange={handleGlbFile}
                  className="sr-only"
                />
              </label>
              {form.hasUploadedGlb && form.uploadedGlbFileName && (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1 text-[11px] font-bold text-emerald-200">
                  <Check size={12} /> {form.uploadedGlbFileName}
                </span>
              )}
              {glbError && <span className="text-xs font-semibold text-rose-400">{glbError}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
            {onDelete && initialInput ? (
              <button
                type="button"
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3.5 py-2.5 text-xs font-bold text-rose-200 hover:bg-rose-900/50 cursor-pointer"
              >
                <Trash2 size={14} /> Eliminar auto genérico
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 hover:from-cyan-400 hover:to-sky-300 cursor-pointer"
              >
                <Check size={15} /> Guardar y usar en Garage / Pista
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

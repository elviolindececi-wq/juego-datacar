import React from 'react';

export interface VehicleStuckModalProps {
  open: boolean;
  onRestartRace: () => void;
  onKeepTrying: () => void;
}

/**
 * Modal obligatorio de detección de vehículo atascado tras 3 segundos consecutivos (§6).
 * Respeta exactamente los textos, acciones y estética oscura premium de DATACAR ARENA.
 */
export const VehicleStuckModal: React.FC<VehicleStuckModalProps> = ({
  open,
  onRestartRace,
  onKeepTrying,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dc-stuck-modal-title"
      data-testid="vehicle-stuck-modal"
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[#030712]/86 p-4 pointer-events-auto"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#f97316]/55 bg-[#071120] p-5 sm:p-6 text-center shadow-2xl">
        <h3
          id="dc-stuck-modal-title"
          className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase"
        >
          🚧 ¡TU AUTO SE ATASCÓ!
        </h3>

        <div className="mt-3 space-y-1.5 text-sm sm:text-base text-slate-200 leading-relaxed">
          <p className="font-semibold text-white">
            Parece que este bache te ganó la carrera.
          </p>
          <p className="text-slate-300">
            La municipalidad tiene mucho trabajo por hacer. 😅
          </p>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={onRestartRace}
            className="min-h-[46px] flex-1 rounded-xl bg-[#f97316] px-5 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 transition-transform active:scale-[0.98] hover:bg-[#fb923c] whitespace-nowrap"
          >
            REINICIAR CARRERA
          </button>
          <button
            type="button"
            onClick={onKeepTrying}
            className="min-h-[46px] flex-1 rounded-xl border border-cyan-400/45 bg-[#0c1c33] px-5 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-200 transition-colors hover:bg-[#122847] whitespace-nowrap"
          >
            SEGUIR INTENTANDO
          </button>
        </div>
      </div>
    </div>
  );
};

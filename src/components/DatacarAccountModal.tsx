import React, { useState } from 'react';
import { Award, CheckCircle2, LogOut, ShieldCheck, X } from 'lucide-react';
import {
  DATACARPY_EXCLUSIVE_BENEFITS,
  useDatacarAccount,
} from '../utils/datacarAccount';

interface DatacarAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatacarAccountModal: React.FC<DatacarAccountModalProps> = ({ isOpen, onClose }) => {
  const { account, isMember, register, signOut } = useDatacarAccount();
  const [pilotName, setPilotName] = useState(account?.pilotName ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [city, setCity] = useState(account?.city ?? 'Asunción');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pilotName.trim()) {
      setError('Ingresá tu nombre o alias de piloto.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Ingresá un correo electrónico válido.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await register({ pilotName, email, city });
      onClose();
    } catch {
      setError('No se pudo completar el registro.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="datacarpy-account-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-amber-400/45 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar cuenta DATACARPY"
          className="absolute right-4 top-4 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:text-white cursor-pointer"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 text-amber-300">
          <Award size={18} />
          <span className="text-[11px] font-black uppercase tracking-[0.2em]">
            COMUNIDAD DATACARPY
          </span>
        </div>

        <h2 id="datacarpy-account-title" className="mt-1 text-2xl font-black uppercase">
          {isMember ? 'Tu pase Miembro DATACARPY' : 'Registrate en DATACARPY'}
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Activá beneficios exclusivos dentro del simulador y prepará tu perfil para futuras ventajas del portal DATACARPY.
        </p>

        <div className="mt-4 rounded-xl border border-amber-400/25 bg-slate-950/75 p-3.5 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
            Beneficios activos para miembros
          </p>
          <ul className="space-y-1.5 text-xs text-slate-200">
            {DATACARPY_EXCLUSIVE_BENEFITS.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 text-emerald-400 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {isMember && account ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/35 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-400/40">
                  <ShieldCheck size={12} /> MIEMBRO DATACARPY VERIFICADO
                </div>
                <p className="mt-1.5 text-lg font-black text-white">{account.pilotName}</p>
                <p className="text-xs text-slate-400">{account.email} · {account.city}</p>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                <LogOut size={13} /> Cerrar sesión
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-cyan-500 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-cyan-400 cursor-pointer"
            >
              Listo · Volver al simulador
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label htmlFor="datacar-pilot-name" className="block text-[11px] font-bold uppercase text-slate-300">
                Nombre o Alias en Pista
              </label>
              <input
                id="datacar-pilot-name"
                type="text"
                required
                maxLength={26}
                value={pilotName}
                onChange={(e) => setPilotName(e.target.value)}
                placeholder="Ej: PilotoAsuncion"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="datacar-email" className="block text-[11px] font-bold uppercase text-slate-300">
                  Correo electrónico
                </label>
                <input
                  id="datacar-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="datacar-city" className="block text-[11px] font-bold uppercase text-slate-300">
                  Ciudad
                </label>
                <input
                  id="datacar-city"
                  type="text"
                  maxLength={32}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Asunción"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 hover:from-amber-300 hover:to-amber-400 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Activando membresía...' : 'Registrarme gratis y activar beneficios'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

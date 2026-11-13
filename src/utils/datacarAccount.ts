import { useCallback, useEffect, useState } from 'react';

export interface DatacarAccountProfile {
  pilotName: string;
  email: string;
  city: string;
  memberTier: 'standard' | 'datacarpy';
  registeredAtIso: string;
}

const STORAGE_KEY = 'datacar_arena_account_v1';
const ACCOUNT_EVENT = 'datacar_account_updated';

export const DATACARPY_EXCLUSIVE_BENEFITS = [
  'Insignia verificada MIEMBRO DATACARPY en el Ranking y salas En Línea',
  'Telemetría extendida de frenado y estabilidad tras cada carrera',
  'Clima extremo (Tormenta / Raudal Intenso) desbloqueado en Pista de Pruebas',
  'Acceso prioritario para identificar tu nombre en salas multijugador',
];

export function loadDatacarAccount(): DatacarAccountProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DatacarAccountProfile;
    if (!parsed?.pilotName || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function registerDatacarAccount(input: {
  pilotName: string;
  email: string;
  city?: string;
}): Promise<DatacarAccountProfile> {
  const cleanName = input.pilotName.trim().slice(0, 26);
  const cleanEmail = input.email.trim().toLowerCase().slice(0, 80);
  const cleanCity = (input.city || 'Asunción').trim().slice(0, 32);

  const profile: DatacarAccountProfile = {
    pilotName: cleanName,
    email: cleanEmail,
    city: cleanCity,
    memberTier: 'datacarpy',
    registeredAtIso: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT));
    } catch {
      // Ignore quota errors
    }
  }

  try {
    await fetch('/api/account/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
  } catch {
    // Offline fallback stays persisted locally
  }

  return profile;
}

export function signOutDatacarAccount(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT));
    } catch {
      // Ignore
    }
  }
}

export function useDatacarAccount() {
  const [account, setAccount] = useState<DatacarAccountProfile | null>(() => loadDatacarAccount());

  useEffect(() => {
    const sync = () => setAccount(loadDatacarAccount());
    window.addEventListener(ACCOUNT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const register = useCallback(
    async (input: { pilotName: string; email: string; city?: string }) => {
      const saved = await registerDatacarAccount(input);
      setAccount(saved);
      return saved;
    },
    []
  );

  const signOut = useCallback(() => {
    signOutDatacarAccount();
    setAccount(null);
  }, []);

  return {
    account,
    isMember: account?.memberTier === 'datacarpy',
    register,
    signOut,
  };
}

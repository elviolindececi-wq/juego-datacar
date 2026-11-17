import type { RaceModeVariant } from './careerProgression.ts';

export interface RankingEntry {
  id: string;
  circuitId: string;
  mode: RaceModeVariant;
  laps: number;
  pilotName: string;
  isDatacarMember: boolean;
  vehicleId: string;
  vehicleName: string;
  finishTimeSec: number;
  drivingIq: number;
  occupants: number;
  payloadKg: number;
  medal: 'gold' | 'silver' | 'over_limit';
  recordedAtIso: string;
}

export interface SubmitRankingInput {
  circuitId: string;
  mode: RaceModeVariant;
  laps: number;
  pilotName: string;
  isDatacarMember: boolean;
  vehicleId: string;
  vehicleName: string;
  finishTimeSec: number;
  drivingIq: number;
  occupants: number;
  payloadKg: number;
  medal: 'gold' | 'silver' | 'over_limit';
}

const LOCAL_RANKING_KEY = 'datacar_arena_local_ranking_v1';

function readLocalCache(): RankingEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_RANKING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCache(entries: RankingEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_RANKING_KEY, JSON.stringify(entries.slice(0, 80)));
  } catch {
    // Ignore storage limits
  }
}

export function sortRankingEntries(entries: RankingEntry[], mode: RaceModeVariant): RankingEntry[] {
  return [...entries].sort((a, b) => {
    if (mode === 'city_trial') {
      if (b.drivingIq !== a.drivingIq) return b.drivingIq - a.drivingIq;
      return a.finishTimeSec - b.finishTimeSec;
    }
    return a.finishTimeSec - b.finishTimeSec;
  });
}

export async function fetchCircuitRanking(
  circuitId: string,
  mode: RaceModeVariant
): Promise<RankingEntry[]> {
  try {
    const url = `/api/ranking?circuitId=${encodeURIComponent(circuitId)}&mode=${encodeURIComponent(mode)}`;
    const res = await fetch(url);
    if (res.ok) {
      const payload = (await res.json()) as { entries?: RankingEntry[] };
      if (Array.isArray(payload.entries)) {
        return sortRankingEntries(payload.entries, mode);
      }
    }
  } catch {
    // Fallback to local runs only
  }

  const local = readLocalCache().filter(
    (entry) => entry.circuitId === circuitId && entry.mode === mode
  );
  return sortRankingEntries(local, mode);
}

export async function submitCircuitRun(input: SubmitRankingInput): Promise<RankingEntry | null> {
  if (!Number.isFinite(input.finishTimeSec) || input.finishTimeSec <= 0) return null;

  const fallbackEntry: RankingEntry = {
    ...input,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    recordedAtIso: new Date().toISOString(),
  };

  try {
    const res = await fetch('/api/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const data = (await res.json()) as { entry?: RankingEntry };
      if (data.entry) {
        const cached = readLocalCache().filter((e) => e.id !== data.entry!.id);
        writeLocalCache([data.entry, ...cached]);
        return data.entry;
      }
    }
  } catch {
    // Save locally if server offline
  }

  const cached = readLocalCache();
  writeLocalCache([fallbackEntry, ...cached]);
  return fallbackEntry;
}

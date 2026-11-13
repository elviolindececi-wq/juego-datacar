import type { RaceModeVariant } from './careerProgression.ts';

export interface OnlinePeerTelemetry {
  pilotId: string;
  clientId: string;
  pilotName: string;
  vehicleId: string;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  steer: number;
  braking: boolean;
  jailed: boolean;
  finished: boolean;
  updatedAtMs: number;
  finishTimeSec: number | null;
}

export interface OnlineRoomPlayerSummary {
  id: string;
  clientId: string;
  pilotName: string;
  isDatacarMember?: boolean;
  vehicleId: string;
  slotIndex: number;
  sceneReady: boolean;
  finishTimeSec: number | null;
  jailed: boolean;
}

export interface OnlineRoomSummary {
  roomId: string;
  code: string;
  circuitId: string;
  laps: number;
  raceMode: RaceModeVariant;
  mode: RaceModeVariant;
  weather: 'sunny' | 'rain' | 'storm' | 'flood';
  status: 'waiting' | 'loading' | 'countdown' | 'racing' | 'finished';
  players: OnlineRoomPlayerSummary[];
}

export type OnlineRoomSnapshot = OnlineRoomSummary;

export interface MultiplayerSnapshot {
  connected: boolean;
  pilotId: string | null;
  pilotName: string;
  onlineCount: number;
  waitingInQueue: number;
  activeRooms: number;
  inQueue: boolean;
  room: OnlineRoomSummary | null;
  lastError: string | null;
  synchronizedStartCounter: number;
}

type Listener = (snapshot: MultiplayerSnapshot) => void;

const PILOT_NAME_KEY = 'datacar_online_pilot_name_v1';

function loadSavedPilotName(): string {
  if (typeof window === 'undefined') return 'PilotoPY';
  try {
    const saved = window.localStorage.getItem(PILOT_NAME_KEY);
    if (saved && saved.trim()) return saved.trim().slice(0, 20);
  } catch {
    // ignore
  }
  return `Piloto${Math.floor(100 + Math.random() * 899)}`;
}

function normalizeRoomSummary(raw: unknown): OnlineRoomSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const rawPlayers = Array.isArray(r.players) ? r.players : [];
  return {
    roomId: String(r.roomId || ''),
    code: String(r.code || ''),
    circuitId: String(r.circuitId || 'aviadores'),
    laps: Number(r.laps) || 2,
    raceMode: r.raceMode === 'speed_pro' ? 'speed_pro' : 'city_trial',
    mode: r.raceMode === 'speed_pro' ? 'speed_pro' : 'city_trial',
    weather:
      r.weather === 'rain' || r.weather === 'storm' || r.weather === 'flood'
        ? r.weather
        : 'sunny',
    status:
      r.status === 'loading' ||
      r.status === 'countdown' ||
      r.status === 'racing' ||
      r.status === 'finished'
        ? r.status
        : 'waiting',
    players: rawPlayers.map((item, idx) => {
      const p = (item || {}) as Record<string, unknown>;
      const id = String(p.id || p.clientId || `peer_${idx}`);
      return {
        id,
        clientId: id,
        pilotName: String(p.pilotName || 'Piloto'),
        isDatacarMember: Boolean(p.isDatacarMember),
        vehicleId: String(p.vehicleId || 'toyota-corolla-cross-seg-2027'),
        slotIndex: typeof p.slotIndex === 'number' ? p.slotIndex : idx,
        sceneReady: Boolean(p.sceneReady),
        finishTimeSec: typeof p.finishTimeSec === 'number' ? p.finishTimeSec : null,
        jailed: Boolean(p.jailed),
      };
    }),
  };
}

class LiveMultiplayerClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();
  private lastEmitMs = 0;
  private pendingOutbox: Record<string, unknown>[] = [];
  public readonly peers = new Map<string, OnlinePeerTelemetry>();

  private snapshot: MultiplayerSnapshot = {
    connected: false,
    pilotId: null,
    pilotName: loadSavedPilotName(),
    onlineCount: 1,
    waitingInQueue: 0,
    activeRooms: 0,
    inQueue: false,
    room: null,
    lastError: null,
    synchronizedStartCounter: 0,
  };

  get connected(): boolean {
    return this.snapshot.connected;
  }

  get clientId(): string | null {
    return this.snapshot.pilotId;
  }

  get onlineCount(): number {
    return this.snapshot.onlineCount;
  }

  get waitingInQueue(): number {
    return this.snapshot.waitingInQueue;
  }

  get inQueue(): boolean {
    return this.snapshot.inQueue;
  }

  get room(): OnlineRoomSummary | null {
    return this.snapshot.room;
  }

  get lastError(): string | null {
    return this.snapshot.lastError;
  }

  get synchronizedStartCounter(): number {
    return this.snapshot.synchronizedStartCounter;
  }

  getSavedPilotName(): string {
    return this.snapshot.pilotName;
  }

  getSnapshot(): MultiplayerSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    this.ensureConnected();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const copy = { ...this.snapshot };
    for (const l of this.listeners) {
      l(copy);
    }
  }

  private isDatacarMember = false;

  setPilotName(name: string, isMember?: boolean): void {
    const clean = name.trim().slice(0, 20) || 'PilotoPY';
    if (typeof isMember === 'boolean') this.isDatacarMember = isMember;
    this.snapshot = { ...this.snapshot, pilotName: clean };
    try {
      window.localStorage.setItem(PILOT_NAME_KEY, clean);
    } catch {
      // ignore
    }
    this.send({ type: 'pilot:hello', pilotName: clean, isDatacarMember: this.isDatacarMember });
    this.notify();
  }

  connect(): void {
    this.ensureConnected();
  }

  ensureConnected(): void {
    if (typeof window === 'undefined') return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws/race`;
    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.snapshot = { ...this.snapshot, connected: true, lastError: null };
        ws.send(
          JSON.stringify({
            type: 'pilot:hello',
            pilotName: this.snapshot.pilotName,
            isDatacarMember: this.isDatacarMember,
          }),
        );
        while (this.pendingOutbox.length > 0 && ws.readyState === WebSocket.OPEN) {
          const nextMsg = this.pendingOutbox.shift();
          if (nextMsg) ws.send(JSON.stringify(nextMsg));
        }
        this.notify();
      };

      ws.onmessage = (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        this.handleServerMessage(msg);
      };

      ws.onclose = () => {
        this.snapshot = {
          ...this.snapshot,
          connected: false,
          inQueue: false,
        };
        this.notify();
        if (this.listeners.size > 0 && !this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.ensureConnected();
          }, 2200);
        }
      };

      ws.onerror = () => {
        // Handled by onclose reconnect
      };
    } catch {
      // Ignore WebSocket construction errors in headless Node tests
    }
  }

  private handleServerMessage(msg: Record<string, unknown>): void {
    const type = String(msg.type || '');

    if (type === 'welcome') {
      this.snapshot = {
        ...this.snapshot,
        pilotId: String(msg.pilotId || ''),
        onlineCount: Math.max(1, Number(msg.onlineCount) || 1),
      };
      this.notify();
      return;
    }

    if (type === 'presence:update') {
      this.snapshot = {
        ...this.snapshot,
        onlineCount: Math.max(1, Number(msg.onlineCount) || 1),
        waitingInQueue: Number(msg.waitingInQueue) || 0,
        activeRooms: Number(msg.activeRooms) || 0,
      };
      this.notify();
      return;
    }

    if (type === 'queue:searching') {
      this.snapshot = { ...this.snapshot, inQueue: true, lastError: null };
      this.notify();
      return;
    }

    if (type === 'queue:left') {
      this.snapshot = { ...this.snapshot, inQueue: false, room: null };
      this.peers.clear();
      this.notify();
      return;
    }

    if (type === 'room:error') {
      this.snapshot = {
        ...this.snapshot,
        lastError: String(msg.message || 'No se pudo conectar a la sala'),
      };
      this.notify();
      return;
    }

    if (type === 'room:waiting' || type === 'room:matched' || type === 'room:standings') {
      const room = normalizeRoomSummary(msg.room);
      if (!room) return;
      if (type === 'room:matched') {
        this.peers.clear();
        for (const p of room.players) {
          if (p.id === this.snapshot.pilotId) continue;
          this.peers.set(p.id, {
            pilotId: p.id,
            clientId: p.id,
            pilotName: p.pilotName,
            vehicleId: p.vehicleId,
            x: -2.2 - p.slotIndex * 3.1,
            z: 0,
            yaw: 0,
            speed: 0,
            steer: 0,
            braking: false,
            jailed: p.jailed,
            finished: p.finishTimeSec !== null,
            updatedAtMs: performance.now(),
            finishTimeSec: p.finishTimeSec,
          });
        }
      } else if (type === 'room:standings') {
        for (const p of room.players) {
          const existing = this.peers.get(p.id);
          if (existing) {
            existing.finishTimeSec = p.finishTimeSec;
            existing.finished = p.finishTimeSec !== null;
            existing.jailed = p.jailed;
          }
        }
      }
      this.snapshot = {
        ...this.snapshot,
        inQueue: false,
        room,
        lastError: null,
      };
      this.notify();
      return;
    }

    if (type === 'race:start') {
      const room = normalizeRoomSummary(msg.room) ?? this.snapshot.room;
      this.snapshot = {
        ...this.snapshot,
        inQueue: false,
        room: room ?? null,
        synchronizedStartCounter: this.snapshot.synchronizedStartCounter + 1,
      };
      this.notify();
      return;
    }

    if (type === 'room:peer_state') {
      const peerId = String(msg.pilotId || '');
      if (!peerId || peerId === this.snapshot.pilotId) return;
      const prev = this.peers.get(peerId);
      const finishTimeSec = prev?.finishTimeSec ?? null;
      this.peers.set(peerId, {
        pilotId: peerId,
        clientId: peerId,
        pilotName: String(msg.pilotName || prev?.pilotName || 'Rival Online'),
        vehicleId: String(msg.vehicleId || prev?.vehicleId || 'toyota-corolla-cross-seg-2027'),
        x: Number(msg.x) || 0,
        z: Number(msg.z) || 0,
        yaw: Number(msg.yaw) || 0,
        speed: Number(msg.speed) || 0,
        steer: Number(msg.steer) || 0,
        braking: Boolean(msg.braking),
        jailed: Boolean(msg.jailed),
        finished: finishTimeSec !== null,
        updatedAtMs: performance.now(),
        finishTimeSec,
      });
      return;
    }

    if (type === 'room:peer_left') {
      const peerId = String(msg.pilotId || '');
      this.peers.delete(peerId);
      const room = normalizeRoomSummary(msg.room);
      this.snapshot = {
        ...this.snapshot,
        room,
      };
      this.notify();
    }
  }

  private send(payload: Record<string, unknown>, queueIfConnecting = false): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else if (queueIfConnecting) {
      if (this.pendingOutbox.length < 16) {
        this.pendingOutbox.push(payload);
      }
    }
  }

  joinMatchmakingQueue(params: {
    pilotName?: string;
    vehicleId: string;
    circuitId: string;
    laps: number;
    raceMode?: RaceModeVariant;
    mode?: RaceModeVariant;
  }): void {
    if (params.pilotName && params.pilotName.trim()) {
      this.snapshot = { ...this.snapshot, pilotName: params.pilotName.trim().slice(0, 20) };
    }
    this.ensureConnected();
    this.peers.clear();
    this.snapshot = { ...this.snapshot, lastError: null };
    const resolvedMode: RaceModeVariant = params.raceMode ?? params.mode ?? 'city_trial';
    this.send(
      {
        type: 'queue:join',
        pilotName: this.snapshot.pilotName,
        isDatacarMember: this.isDatacarMember,
        vehicleId: params.vehicleId,
        circuitId: params.circuitId,
        laps: params.laps,
        raceMode: resolvedMode,
      },
      true,
    );
  }

  createPrivateRoom(params: {
    pilotName?: string;
    vehicleId: string;
    circuitId: string;
    laps: number;
    raceMode?: RaceModeVariant;
    mode?: RaceModeVariant;
  }): void {
    if (params.pilotName && params.pilotName.trim()) {
      this.snapshot = { ...this.snapshot, pilotName: params.pilotName.trim().slice(0, 20) };
    }
    this.ensureConnected();
    this.peers.clear();
    this.snapshot = { ...this.snapshot, lastError: null };
    const resolvedMode: RaceModeVariant = params.raceMode ?? params.mode ?? 'city_trial';
    this.send(
      {
        type: 'room:create',
        pilotName: this.snapshot.pilotName,
        isDatacarMember: this.isDatacarMember,
        vehicleId: params.vehicleId,
        circuitId: params.circuitId,
        laps: params.laps,
        raceMode: resolvedMode,
      },
      true,
    );
  }

  joinRoomByCode(
    codeOrParams: string | { code: string; pilotName?: string; vehicleId: string },
    maybeVehicleId?: string,
  ): void {
    const code =
      typeof codeOrParams === 'string' ? codeOrParams : codeOrParams.code;
    const vehicleId =
      typeof codeOrParams === 'string'
        ? maybeVehicleId || 'toyota-corolla-cross-seg-2027'
        : codeOrParams.vehicleId;
    if (typeof codeOrParams !== 'string' && codeOrParams.pilotName?.trim()) {
      this.snapshot = {
        ...this.snapshot,
        pilotName: codeOrParams.pilotName.trim().slice(0, 20),
      };
    }
    this.ensureConnected();
    this.peers.clear();
    this.snapshot = { ...this.snapshot, lastError: null };
    this.send(
      {
        type: 'room:join_code',
        code: code.trim().toUpperCase(),
        pilotName: this.snapshot.pilotName,
        isDatacarMember: this.isDatacarMember,
        vehicleId,
      },
      true,
    );
  }

  leaveQueue(): void {
    this.leaveOnlineSession();
  }

  leaveRoom(): void {
    this.leaveOnlineSession();
  }

  leaveOnlineSession(): void {
    this.peers.clear();
    this.snapshot = {
      ...this.snapshot,
      inQueue: false,
      room: null,
      lastError: null,
    };
    this.send({ type: 'queue:leave' });
    this.notify();
  }

  notifySceneReady(): void {
    this.send({ type: 'room:scene_ready' }, true);
  }

  sendLocalCarState(state: {
    x: number;
    z: number;
    yaw: number;
    speed: number;
    steer: number;
    braking: boolean;
    jailed?: boolean;
  }): void {
    if (!this.snapshot.room) return;
    const now = performance.now();
    // Throttle delta updates a ~20 Hz (cada 48 ms)
    if (now - this.lastEmitMs < 48 && !state.jailed) return;
    this.lastEmitMs = now;
    this.send({
      type: 'player:state',
      ...state,
    });
  }

  reportFinish(finishTimeSec: number, jailed = false): void {
    if (!this.snapshot.room) return;
    this.send({
      type: 'player:finish',
      finishTimeSec,
      jailed,
    });
  }
}

export const multiplayerClient = new LiveMultiplayerClient();

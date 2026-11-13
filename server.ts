import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type RaceModeVariant = 'city_trial' | 'speed_pro';

interface RankingRecord {
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

interface DatacarMemberRecord {
  pilotName: string;
  email: string;
  city: string;
  memberTier: 'datacarpy';
  registeredAtIso: string;
}

interface ConnectedPilot {
  id: string;
  ws: WebSocket;
  pilotName: string;
  isDatacarMember: boolean;
  vehicleId: string;
  circuitId: string;
  laps: number;
  raceMode: RaceModeVariant;
  inQueue: boolean;
  queuedAt: number;
  roomId: string | null;
  sceneReady: boolean;
  finishedAt: number | null;
  finishTimeSec: number | null;
  jailed: boolean;
}

interface OnlineRaceRoom {
  id: string;
  code: string;
  circuitId: string;
  laps: number;
  raceMode: RaceModeVariant;
  weather: 'sunny' | 'rain' | 'storm' | 'flood';
  players: Map<string, ConnectedPilot>;
  status: 'waiting' | 'loading' | 'countdown' | 'racing' | 'finished';
  createdAt: number;
  raceStartedAt: number | null;
  forceStartTimer: ReturnType<typeof setTimeout> | null;
}

const PORT = Number(process.env.PORT || 3000);
const pilots = new Map<string, ConnectedPilot>();
const rooms = new Map<string, OnlineRaceRoom>();

let pilotSeq = 1;
let roomSeq = 1;

function sendJson(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastPresence(): void {
  let waitingCount = 0;
  for (const p of pilots.values()) {
    if (p.inQueue) waitingCount++;
  }
  const msg = {
    type: 'presence:update',
    onlineCount: pilots.size,
    waitingInQueue: waitingCount,
    activeRooms: rooms.size,
  };
  for (const p of pilots.values()) {
    sendJson(p.ws, msg);
  }
}

function serializeRoom(room: OnlineRaceRoom) {
  return {
    roomId: room.id,
    code: room.code,
    circuitId: room.circuitId,
    laps: room.laps,
    raceMode: room.raceMode,
    weather: room.weather,
    status: room.status,
    players: Array.from(room.players.values()).map((p, idx) => ({
      id: p.id,
      pilotName: p.pilotName,
      isDatacarMember: p.isDatacarMember,
      vehicleId: p.vehicleId,
      slotIndex: idx,
      sceneReady: p.sceneReady,
      finishTimeSec: p.finishTimeSec,
      jailed: p.jailed,
    })),
  };
}

function broadcastToRoom(
  room: OnlineRaceRoom,
  payload: Record<string, unknown>,
  excludePilotId?: string,
): void {
  for (const peer of room.players.values()) {
    if (excludePilotId && peer.id === excludePilotId) continue;
    sendJson(peer.ws, payload);
  }
}

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function startRoomSynchronizedCountdown(room: OnlineRaceRoom): void {
  if (room.status === 'countdown' || room.status === 'racing') return;
  if (room.forceStartTimer) {
    clearTimeout(room.forceStartTimer);
    room.forceStartTimer = null;
  }
  room.status = 'countdown';
  room.raceStartedAt = Date.now() + 3000;
  broadcastToRoom(room, {
    type: 'race:start',
    roomId: room.id,
    countdownSec: 3,
    serverNowMs: Date.now(),
    goAtServerMs: room.raceStartedAt,
    room: serializeRoom(room),
  });
}

function beginRoomLoadingPhase(room: OnlineRaceRoom): void {
  room.status = 'loading';
  for (const p of room.players.values()) {
    p.sceneReady = false;
    p.finishedAt = null;
    p.finishTimeSec = null;
    p.jailed = false;
  }
  broadcastToRoom(room, {
    type: 'room:matched',
    room: serializeRoom(room),
  });
  // Si un cliente tarda en reportar sceneReady por red lenta, arrancamos máximo en 6.5 s
  if (room.forceStartTimer) clearTimeout(room.forceStartTimer);
  room.forceStartTimer = setTimeout(() => {
    if (room.players.size >= 2 && room.status === 'loading') {
      startRoomSynchronizedCountdown(room);
    }
  }, 6500);
}

function tryMatchmakingQueue(): void {
  const waiting = Array.from(pilots.values())
    .filter((p) => p.inQueue && !p.roomId && p.ws.readyState === WebSocket.OPEN)
    .sort((a, b) => a.queuedAt - b.queuedAt);

  while (waiting.length >= 2) {
    // Priorizar emparejar pilotos con la misma modalidad (city_trial o speed_pro), o los 2 que entraron al mismo tiempo
    const host = waiting.shift()!;
    let matchIdx = waiting.findIndex((c) => c.raceMode === host.raceMode);
    if (matchIdx < 0) matchIdx = 0;
    const challenger = waiting.splice(matchIdx, 1)[0];

    host.inQueue = false;
    challenger.inQueue = false;

    const roomId = `room_${roomSeq++}`;
    const code = makeRoomCode();
    // Si ambos eligieron speed_pro se corre en speed_pro; si alguno aún no desbloqueó, se corre en city_trial
    const sharedMode: RaceModeVariant =
      host.raceMode === 'speed_pro' && challenger.raceMode === 'speed_pro'
        ? 'speed_pro'
        : 'city_trial';

    const room: OnlineRaceRoom = {
      id: roomId,
      code,
      circuitId: host.circuitId || 'aviadores',
      laps: host.laps || 2,
      raceMode: sharedMode,
      weather: host.circuitId === 'aviadores' || host.circuitId === 'artigas' ? 'rain' : 'sunny',
      players: new Map([
        [host.id, host],
        [challenger.id, challenger],
      ]),
      status: 'loading',
      createdAt: Date.now(),
      raceStartedAt: null,
      forceStartTimer: null,
    };

    host.roomId = roomId;
    challenger.roomId = roomId;
    rooms.set(roomId, room);
    beginRoomLoadingPhase(room);
  }
  broadcastPresence();
}

function removePilotFromRoom(pilot: ConnectedPilot): void {
  if (!pilot.roomId) return;
  const room = rooms.get(pilot.roomId);
  pilot.roomId = null;
  pilot.sceneReady = false;
  if (!room) return;

  room.players.delete(pilot.id);
  if (room.players.size === 0) {
    if (room.forceStartTimer) clearTimeout(room.forceStartTimer);
    rooms.delete(room.id);
  } else {
    broadcastToRoom(room, {
      type: 'room:peer_left',
      pilotId: pilot.id,
      pilotName: pilot.pilotName,
      room: serializeRoom(room),
    });
  }
}

const DATA_DIR = path.join(__dirname, '.data');
const RANKING_FILE = path.join(DATA_DIR, 'ranking.json');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

function readJsonList<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonListAsync<T>(filePath: string, data: T[]): void {
  void fs.promises
    .mkdir(DATA_DIR, { recursive: true })
    .then(() => fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8'))
    .catch(() => {});
}

const rankingRecords: RankingRecord[] = readJsonList<RankingRecord>(RANKING_FILE);
const memberRecords: DatacarMemberRecord[] = readJsonList<DatacarMemberRecord>(ACCOUNTS_FILE);

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/online-status', (_req, res) => {
    let waitingInQueue = 0;
    for (const p of pilots.values()) {
      if (p.inQueue) waitingInQueue++;
    }
    res.json({
      onlineCount: pilots.size,
      waitingInQueue,
      activeRooms: rooms.size,
    });
  });

  app.get('/api/ranking', (req, res) => {
    const circuitId = String(req.query.circuitId || '').trim();
    const mode = req.query.mode === 'speed_pro' ? 'speed_pro' : 'city_trial';
    const filtered = rankingRecords
      .filter((r) => (!circuitId || r.circuitId === circuitId) && r.mode === mode)
      .sort((a, b) => {
        if (mode === 'city_trial') {
          if (b.drivingIq !== a.drivingIq) return b.drivingIq - a.drivingIq;
          return a.finishTimeSec - b.finishTimeSec;
        }
        return a.finishTimeSec - b.finishTimeSec;
      })
      .slice(0, 50);
    res.json({ entries: filtered });
  });

  app.post('/api/ranking', (req, res) => {
    const body = (req.body || {}) as Partial<RankingRecord>;
    const finishTimeSec = Number(body.finishTimeSec);
    if (!body.circuitId || !Number.isFinite(finishTimeSec) || finishTimeSec <= 0) {
      res.status(400).json({ error: 'Invalid run payload' });
      return;
    }
    const mode: RaceModeVariant = body.mode === 'speed_pro' ? 'speed_pro' : 'city_trial';
    const record: RankingRecord = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      circuitId: String(body.circuitId).slice(0, 40),
      mode,
      laps: Math.max(1, Math.min(3, Number(body.laps) || 1)),
      pilotName: String(body.pilotName || 'Piloto').trim().slice(0, 26) || 'Piloto',
      isDatacarMember: Boolean(body.isDatacarMember),
      vehicleId: String(body.vehicleId || 'unknown').slice(0, 50),
      vehicleName: String(body.vehicleName || 'Vehículo').slice(0, 60),
      finishTimeSec: Number(finishTimeSec.toFixed(2)),
      drivingIq: Math.max(0, Math.min(1000, Number(body.drivingIq) || 0)),
      occupants: Math.max(1, Math.min(8, Number(body.occupants) || 1)),
      payloadKg: Math.max(0, Math.min(900, Number(body.payloadKg) || 0)),
      medal:
        body.medal === 'gold' || body.medal === 'silver' ? body.medal : 'over_limit',
      recordedAtIso: new Date().toISOString(),
    };
    rankingRecords.unshift(record);
    if (rankingRecords.length > 300) rankingRecords.length = 300;
    writeJsonListAsync(RANKING_FILE, rankingRecords);
    res.status(201).json({ entry: record });
  });

  app.post('/api/account/register', (req, res) => {
    const body = (req.body || {}) as Partial<DatacarMemberRecord>;
    const pilotName = String(body.pilotName || '').trim().slice(0, 26);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 80);
    if (!pilotName || !email || !email.includes('@')) {
      res.status(400).json({ error: 'Nombre y correo válido son requeridos' });
      return;
    }
    const profile: DatacarMemberRecord = {
      pilotName,
      email,
      city: String(body.city || 'Asunción').trim().slice(0, 32) || 'Asunción',
      memberTier: 'datacarpy',
      registeredAtIso: new Date().toISOString(),
    };
    const existingIdx = memberRecords.findIndex((m) => m.email === email);
    if (existingIdx >= 0) memberRecords[existingIdx] = profile;
    else memberRecords.unshift(profile);
    if (memberRecords.length > 500) memberRecords.length = 500;
    writeJsonListAsync(ACCOUNTS_FILE, memberRecords);
    res.status(201).json({ profile });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/race' });

  wss.on('connection', (ws) => {
    const id = `pilot_${pilotSeq++}_${Math.random().toString(36).slice(2, 6)}`;
    const pilot: ConnectedPilot = {
      id,
      ws,
      pilotName: `Piloto ${id.slice(-3).toUpperCase()}`,
      isDatacarMember: false,
      vehicleId: 'toyota-corolla-cross-seg-2027',
      circuitId: 'aviadores',
      laps: 2,
      raceMode: 'city_trial',
      inQueue: false,
      queuedAt: 0,
      roomId: null,
      sceneReady: false,
      finishedAt: null,
      finishTimeSec: null,
      jailed: false,
    };
    pilots.set(id, pilot);

    sendJson(ws, {
      type: 'welcome',
      pilotId: id,
      onlineCount: pilots.size,
    });
    broadcastPresence();

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw)) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'pilot:hello') {
        if (typeof msg.pilotName === 'string' && msg.pilotName.trim()) {
          pilot.pilotName = msg.pilotName.trim().slice(0, 22);
        }
        if (typeof msg.isDatacarMember === 'boolean') {
          pilot.isDatacarMember = msg.isDatacarMember;
        }
        if (typeof msg.vehicleId === 'string' && msg.vehicleId) {
          pilot.vehicleId = msg.vehicleId;
        }
        if (typeof msg.circuitId === 'string' && msg.circuitId) {
          pilot.circuitId = msg.circuitId;
        }
        if (typeof msg.laps === 'number') {
          pilot.laps = Math.max(1, Math.min(3, Math.round(msg.laps)));
        }
        if (msg.raceMode === 'speed_pro' || msg.raceMode === 'city_trial') {
          pilot.raceMode = msg.raceMode;
        }
        broadcastPresence();
        return;
      }

      if (type === 'queue:join') {
        removePilotFromRoom(pilot);
        if (typeof msg.pilotName === 'string' && msg.pilotName.trim()) {
          pilot.pilotName = msg.pilotName.trim().slice(0, 22);
        }
        if (typeof msg.isDatacarMember === 'boolean') {
          pilot.isDatacarMember = msg.isDatacarMember;
        }
        if (typeof msg.vehicleId === 'string' && msg.vehicleId) {
          pilot.vehicleId = msg.vehicleId;
        }
        if (typeof msg.circuitId === 'string' && msg.circuitId) {
          pilot.circuitId = msg.circuitId;
        }
        if (typeof msg.laps === 'number') {
          pilot.laps = Math.max(1, Math.min(3, Math.round(msg.laps)));
        }
        if (msg.raceMode === 'speed_pro' || msg.raceMode === 'city_trial') {
          pilot.raceMode = msg.raceMode;
        }
        pilot.inQueue = true;
        pilot.queuedAt = Date.now();
        sendJson(ws, { type: 'queue:searching' });
        tryMatchmakingQueue();
        return;
      }

      if (type === 'queue:leave') {
        pilot.inQueue = false;
        removePilotFromRoom(pilot);
        sendJson(ws, { type: 'queue:left' });
        broadcastPresence();
        return;
      }

      if (type === 'room:create') {
        pilot.inQueue = false;
        removePilotFromRoom(pilot);
        if (typeof msg.pilotName === 'string' && msg.pilotName.trim()) {
          pilot.pilotName = msg.pilotName.trim().slice(0, 22);
        }
        if (typeof msg.vehicleId === 'string' && msg.vehicleId) {
          pilot.vehicleId = msg.vehicleId;
        }
        if (typeof msg.circuitId === 'string' && msg.circuitId) {
          pilot.circuitId = msg.circuitId;
        }
        if (typeof msg.laps === 'number') {
          pilot.laps = Math.max(1, Math.min(3, Math.round(msg.laps)));
        }
        if (msg.raceMode === 'speed_pro' || msg.raceMode === 'city_trial') {
          pilot.raceMode = msg.raceMode;
        }
        const roomId = `room_${roomSeq++}`;
        const code = makeRoomCode();
        const room: OnlineRaceRoom = {
          id: roomId,
          code,
          circuitId: pilot.circuitId,
          laps: pilot.laps,
          raceMode: pilot.raceMode,
          weather:
            pilot.circuitId === 'aviadores' || pilot.circuitId === 'artigas' ? 'rain' : 'sunny',
          players: new Map([[pilot.id, pilot]]),
          status: 'waiting',
          createdAt: Date.now(),
          raceStartedAt: null,
          forceStartTimer: null,
        };
        pilot.roomId = roomId;
        rooms.set(roomId, room);
        sendJson(ws, { type: 'room:waiting', room: serializeRoom(room) });
        broadcastPresence();
        return;
      }

      if (type === 'room:join_code') {
        const targetCode = String(msg.code || '')
          .trim()
          .toUpperCase();
        if (!targetCode) return;
        let found: OnlineRaceRoom | undefined;
        for (const r of rooms.values()) {
          if (r.code === targetCode && r.status === 'waiting' && r.players.size < 4) {
            found = r;
            break;
          }
        }
        if (!found) {
          sendJson(ws, {
            type: 'room:error',
            message: `No se encontró una sala abierta con el código ${targetCode}.`,
          });
          return;
        }
        pilot.inQueue = false;
        removePilotFromRoom(pilot);
        if (typeof msg.pilotName === 'string' && msg.pilotName.trim()) {
          pilot.pilotName = msg.pilotName.trim().slice(0, 22);
        }
        if (typeof msg.vehicleId === 'string' && msg.vehicleId) {
          pilot.vehicleId = msg.vehicleId;
        }
        // Idempotent add
        if (!found.players.has(pilot.id)) {
          found.players.set(pilot.id, pilot);
        }
        pilot.roomId = found.id;
        if (found.players.size >= 2) {
          beginRoomLoadingPhase(found);
        } else {
          broadcastToRoom(found, { type: 'room:waiting', room: serializeRoom(found) });
        }
        broadcastPresence();
        return;
      }

      if (type === 'room:scene_ready') {
        if (!pilot.roomId) return;
        const room = rooms.get(pilot.roomId);
        if (!room) return;
        pilot.sceneReady = true;
        const allReady =
          room.players.size >= 2 &&
          Array.from(room.players.values()).every((p) => p.sceneReady);
        if (allReady && room.status === 'loading') {
          startRoomSynchronizedCountdown(room);
        }
        return;
      }

      if (type === 'player:state') {
        if (!pilot.roomId) return;
        const room = rooms.get(pilot.roomId);
        if (!room) return;
        if (room.status === 'countdown' && room.raceStartedAt && Date.now() >= room.raceStartedAt) {
          room.status = 'racing';
        }
        broadcastToRoom(
          room,
          {
            type: 'room:peer_state',
            pilotId: pilot.id,
            pilotName: pilot.pilotName,
            vehicleId: pilot.vehicleId,
            x: Number(msg.x) || 0,
            z: Number(msg.z) || 0,
            yaw: Number(msg.yaw) || 0,
            speed: Number(msg.speed) || 0,
            steer: Number(msg.steer) || 0,
            braking: Boolean(msg.braking),
            jailed: Boolean(msg.jailed),
            ts: Date.now(),
          },
          pilot.id,
        );
        return;
      }

      if (type === 'player:finish') {
        if (!pilot.roomId) return;
        const room = rooms.get(pilot.roomId);
        if (!room) return;
        pilot.finishedAt = Date.now();
        pilot.finishTimeSec = Number(msg.finishTimeSec) || 0;
        pilot.jailed = Boolean(msg.jailed);
        broadcastToRoom(room, {
          type: 'room:standings',
          room: serializeRoom(room),
        });
        return;
      }
    });

    ws.on('close', () => {
      pilot.inQueue = false;
      removePilotFromRoom(pilot);
      pilots.delete(id);
      broadcastPresence();
    });

    ws.on('error', () => {
      pilot.inQueue = false;
      removePilotFromRoom(pilot);
      pilots.delete(id);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`DATACAR ARENA server + WebSocket (/ws/race) running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();

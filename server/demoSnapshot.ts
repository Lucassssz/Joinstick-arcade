import { CARD_GAME_IDS, getGameGenre, getGameMeta } from '../src/shared/games.ts';
import { PLAYER_PALETTE, type GameId, type GameSnapshot } from '../src/shared/types.ts';
import { SERVER_GAMES, type ServerPlayerInputState } from './games/engine.ts';
import { computeBotInput, createBotMemory, type BotMemory } from './games/botController.ts';

const DEMO_NAMES = ['NOVA', 'BLITZ', 'KAI', 'ZARA'];

export interface DemoClipPayload {
  gameId: GameId;
  durationMs: number;
  fps: number;
  frames: GameSnapshot[];
}

// Strict LRU caches so scaling to 150+ games keeps server RAM bounded
const MAX_SNAPSHOT_CACHE = 96;
const MAX_CLIP_CACHE = 32;

const snapshotCache = new Map<GameId, GameSnapshot>();
const clipCache = new Map<GameId, DemoClipPayload>();
const inflightSnapshots = new Map<GameId, Promise<GameSnapshot | null>>();
const inflightClips = new Map<GameId, Promise<DemoClipPayload | null>>();

function getLru<K, V>(cache: Map<K, V>, key: K): V | undefined {
  const val = cache.get(key);
  if (val !== undefined) {
    cache.delete(key);
    cache.set(key, val);
  }
  return val;
}

function setLru<K, V>(cache: Map<K, V>, key: K, value: V, maxSize: number): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= maxSize) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, value);
}

/**
 * Yields control back to Node's event loop so demo simulation never stalls
 * live 30Hz/60Hz multiplayer rooms or WebSocket heartbeats.
 */
function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function createDemoPlayers(gameId: GameId): ServerPlayerInputState[] {
  const meta = getGameMeta(gameId);
  const playerCount = Math.max(2, Math.min(4, meta.maxPlayers));
  return Array.from({ length: playerCount }, (_, idx) => ({
    id: `demo_p${idx + 1}`,
    slotIndex: idx,
    name: DEMO_NAMES[idx % DEMO_NAMES.length],
    color: PLAYER_PALETTE[idx % PLAYER_PALETTE.length],
    connected: true,
    isBot: true,
    input: { dx: 0, dy: 0, a: false, b: false },
    prevA: false,
    prevB: false,
  }));
}

/**
 * Non-blocking async demo snapshot generator with in-flight deduplication and LRU caching.
 */
export async function getOrGenerateDemoSnapshotAsync(gameId: GameId): Promise<GameSnapshot | null> {
  const cached = getLru(snapshotCache, gameId);
  if (cached) return cached;

  const pending = inflightSnapshots.get(gameId);
  if (pending) return pending;

  const engine = SERVER_GAMES[gameId];
  if (!engine) return null;

  const task = (async (): Promise<GameSnapshot | null> => {
    const meta = getGameMeta(gameId);
    const genre = getGameGenre(gameId);
    const players = createDemoPlayers(gameId);
    const botMemories: BotMemory[] = players.map(() => createBotMemory());
    const state = engine.createState(players, meta.defaultSetting);
    let bestSnapshot: GameSnapshot = engine.getSnapshot(state);

    const isCard = CARD_GAME_IDS.has(gameId);
    const totalTicks = isCard ? 95 : genre === 'board' ? 110 : 62;
    const stepDt = isCard ? 0.095 : genre === 'board' ? 0.08 : 0.05;

    for (let tick = 0; tick < totalTicks; tick++) {
      for (let i = 0; i < players.length; i++) {
        players[i].prevA = players[i].input.a;
        players[i].prevB = players[i].input.b;
        players[i].input = computeBotInput(bestSnapshot, players[i].id, 'spicy', stepDt, botMemories[i]);
      }
      const out = engine.step(state, players, stepDt);
      if (out.finished) break;
      bestSnapshot = out.snapshot;
      if (tick % 16 === 15) {
        await yieldEventLoop();
      }
    }

    const cloned = structuredClone(bestSnapshot);
    setLru(snapshotCache, gameId, cloned, MAX_SNAPSHOT_CACHE);
    return cloned;
  })().finally(() => {
    inflightSnapshots.delete(gameId);
  });

  inflightSnapshots.set(gameId, task);
  return task;
}

/**
 * Non-blocking async 5-second gameplay clip generator (60 frames at 12fps)
 * with chunked event-loop yielding, request deduplication, and bounded LRU memory.
 */
export async function getOrGenerateDemoClipAsync(gameId: GameId): Promise<DemoClipPayload | null> {
  const cached = getLru(clipCache, gameId);
  if (cached) return cached;

  const pending = inflightClips.get(gameId);
  if (pending) return pending;

  const engine = SERVER_GAMES[gameId];
  if (!engine) return null;

  const task = (async (): Promise<DemoClipPayload | null> => {
    const meta = getGameMeta(gameId);
    const genre = getGameGenre(gameId);
    const isCard = CARD_GAME_IDS.has(gameId);

    const FPS = 12;
    const DURATION_MS = 5000;
    const TARGET_FRAMES = Math.round((DURATION_MS / 1000) * FPS); // 60 frames = 5.0 seconds

    let players = createDemoPlayers(gameId);
    let botMemories: BotMemory[] = players.map(() => createBotMemory());
    let state = engine.createState(players, meta.defaultSetting);
    let currentSnap: GameSnapshot = engine.getSnapshot(state);

    const stepDt = isCard ? 0.075 : genre === 'board' ? 0.065 : 1 / 24;
    const warmupTicks = isCard ? 28 : genre === 'board' ? 32 : 24;
    const substepsPerFrame = 2;

    const advanceOneTick = (): boolean => {
      for (let i = 0; i < players.length; i++) {
        players[i].prevA = players[i].input.a;
        players[i].prevB = players[i].input.b;
        players[i].input = computeBotInput(currentSnap, players[i].id, 'spicy', stepDt, botMemories[i]);
      }
      const out = engine.step(state, players, stepDt);
      if (out.finished) return true;
      currentSnap = out.snapshot;
      return false;
    };

    for (let w = 0; w < warmupTicks; w++) {
      const ended = advanceOneTick();
      if (ended) break;
      if (w % 12 === 11) await yieldEventLoop();
    }

    const frames: GameSnapshot[] = [];
    for (let f = 0; f < TARGET_FRAMES; f++) {
      let ended = false;
      for (let s = 0; s < substepsPerFrame; s++) {
        ended = advanceOneTick();
        if (ended) break;
      }

      if (ended) {
        players = createDemoPlayers(gameId);
        botMemories = players.map(() => createBotMemory());
        state = engine.createState(players, meta.defaultSetting);
        currentSnap = engine.getSnapshot(state);
        for (let w = 0; w < 10; w++) {
          if (advanceOneTick()) break;
        }
      }

      frames.push(structuredClone(currentSnap));

      // Yield every 6 frames (~12 ticks) so live matches & WS heartbeats stay jitter-free
      if (f % 6 === 5) {
        await yieldEventLoop();
      }
    }

    if (!snapshotCache.has(gameId) && frames.length > 0) {
      setLru(snapshotCache, gameId, frames[Math.floor(frames.length * 0.45)], MAX_SNAPSHOT_CACHE);
    }

    const payload: DemoClipPayload = {
      gameId,
      durationMs: DURATION_MS,
      fps: FPS,
      frames,
    };

    setLru(clipCache, gameId, payload, MAX_CLIP_CACHE);
    return payload;
  })().finally(() => {
    inflightClips.delete(gameId);
  });

  inflightClips.set(gameId, task);
  return task;
}

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

export interface RuleClipsPayload {
  gameId: GameId;
  segmentDurationMs: number;
  fps: number;
  segments: GameSnapshot[][];
}

// Strict LRU caches so scaling to 150+ games keeps server RAM bounded
const MAX_SNAPSHOT_CACHE = 96;
const MAX_CLIP_CACHE = 32;
const MAX_RULE_CLIP_CACHE = 24;

const snapshotCache = new Map<GameId, GameSnapshot>();
const clipCache = new Map<GameId, DemoClipPayload>();
const ruleClipCache = new Map<GameId, RuleClipsPayload>();
const inflightSnapshots = new Map<GameId, Promise<GameSnapshot | null>>();
const inflightClips = new Map<GameId, Promise<DemoClipPayload | null>>();
const inflightRuleClips = new Map<GameId, Promise<RuleClipsPayload | null>>();

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

/**
 * Generates 4 distinct 2.0-second (24 frames @ 12fps) real-engine rule clips per game:
 *  - Segment 0 (Rule 1): Opening movement / navigation / card deal
 *  - Segment 1 (Rule 2): Active Primary Action A bursts (dash/fire/strike/play)
 *  - Segment 2 (Rule 3): Secondary Action B & mid-match interaction (shield/special/hazard)
 *  - Segment 3 (Rule 4): Late-game Frenzy climax & scoring push
 */
export async function getOrGenerateRuleClipsAsync(
  gameId: GameId
): Promise<RuleClipsPayload | null> {
  const cached = getLru(ruleClipCache, gameId);
  if (cached) return cached;

  const pending = inflightRuleClips.get(gameId);
  if (pending) return pending;

  const engine = SERVER_GAMES[gameId];
  if (!engine) return null;

  const task = (async (): Promise<RuleClipsPayload | null> => {
    const meta = getGameMeta(gameId);
    const genre = getGameGenre(gameId);
    const isCard = CARD_GAME_IDS.has(gameId);

    const FPS = 12;
    const SEGMENT_DURATION_MS = 2000;
    const FRAMES_PER_SEGMENT = 24;
    const stepDt = isCard ? 0.08 : genre === 'board' ? 0.07 : 1 / 24;
    const substepsPerFrame = 2;

    let players = createDemoPlayers(gameId);
    let botMemories: BotMemory[] = players.map(() => createBotMemory());
    let state = engine.createState(players, meta.defaultSetting);
    let currentSnap: GameSnapshot = engine.getSnapshot(state);

    const resetSim = () => {
      players = createDemoPlayers(gameId);
      botMemories = players.map(() => createBotMemory());
      state = engine.createState(players, meta.defaultSetting);
      currentSnap = engine.getSnapshot(state);
    };

    const advanceSegmentTick = (mode: 0 | 1 | 2 | 3, tickIdx: number): boolean => {
      for (let i = 0; i < players.length; i++) {
        players[i].prevA = players[i].input.a;
        players[i].prevB = players[i].input.b;
        const botIn = computeBotInput(
          currentSnap,
          players[i].id,
          'spicy',
          stepDt,
          botMemories[i]
        );
        // Script P1 (slot 0) to demonstrate each rule's distinct mechanic clearly
        if (i === 0 && !isCard) {
          if (mode === 0) {
            // Rule 1: Pure movement / steering / aiming
            botIn.a = false;
            botIn.b = false;
          } else if (mode === 1) {
            // Rule 2: Primary Action A pulses
            botIn.a = tickIdx % 6 === 1 || tickIdx % 6 === 2;
            botIn.b = false;
          } else if (mode === 2) {
            // Rule 3: Secondary Action B pulses
            botIn.b = tickIdx % 7 === 2 || tickIdx % 7 === 3;
          }
        }
        players[i].input = botIn;
      }
      const allowFrenzy = !isCard && genre !== 'board';
      const out = engine.step(state, players, stepDt, allowFrenzy && mode === 3);
      if (out.finished) return true;
      currentSnap = out.snapshot;
      return false;
    };

    // Short initial warmup so actors are active in arena
    const warmup = isCard ? 10 : genre === 'board' ? 12 : 8;
    for (let w = 0; w < warmup; w++) {
      if (advanceSegmentTick(0, w)) resetSim();
    }

    const segments: GameSnapshot[][] = [];
    for (let segIdx = 0; segIdx < 4; segIdx++) {
      const mode = segIdx as 0 | 1 | 2 | 3;

      // Advance simulation slightly between segments so each 2s clip starts in a fresh state
      if (segIdx > 0) {
        const skipTicks = segIdx === 3 ? 26 : 14;
        for (let k = 0; k < skipTicks; k++) {
          if (advanceSegmentTick(mode, k)) {
            resetSim();
          }
          if (k % 12 === 11) await yieldEventLoop();
        }
      }

      const frames: GameSnapshot[] = [];
      for (let f = 0; f < FRAMES_PER_SEGMENT; f++) {
        let ended = false;
        for (let s = 0; s < substepsPerFrame; s++) {
          ended = advanceSegmentTick(mode, f * substepsPerFrame + s);
          if (ended) break;
        }
        if (ended) {
          resetSim();
          for (let w = 0; w < 6; w++) {
            if (advanceSegmentTick(mode, w)) break;
          }
        }
        frames.push(structuredClone(currentSnap));
        if (f % 6 === 5) await yieldEventLoop();
      }
      segments.push(frames);
    }

    const payload: RuleClipsPayload = {
      gameId,
      segmentDurationMs: SEGMENT_DURATION_MS,
      fps: FPS,
      segments,
    };

    setLru(ruleClipCache, gameId, payload, MAX_RULE_CLIP_CACHE);
    return payload;
  })().finally(() => {
    inflightRuleClips.delete(gameId);
  });

  inflightRuleClips.set(gameId, task);
  return task;
}


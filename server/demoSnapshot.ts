import { CARD_GAME_IDS, getGameGenre, getGameMeta } from '../src/shared/games.ts';
import { PLAYER_PALETTE, type GameId, type GameSnapshot } from '../src/shared/types.ts';
import { SERVER_GAMES, type ServerPlayerInputState } from './games/engine.ts';
import { computeBotInput, createBotMemory, type BotMemory } from './games/botController.ts';

const DEMO_NAMES = ['NOVA', 'BLITZ', 'KAI', 'ZARA'];
const snapshotCache = new Map<GameId, GameSnapshot>();

export interface DemoClipPayload {
  gameId: GameId;
  durationMs: number;
  fps: number;
  frames: GameSnapshot[];
}

const clipCache = new Map<GameId, DemoClipPayload>();
const MAX_CLIP_CACHE = 48;

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
 * Simulates a short real match using the authoritative game engine and built-in bot AI
 * so the client can capture an authentic mid-action screenshot from inside each game.
 */
export function getOrGenerateDemoSnapshot(gameId: GameId): GameSnapshot | null {
  const cached = snapshotCache.get(gameId);
  if (cached) return cached;

  const engine = SERVER_GAMES[gameId];
  if (!engine) return null;

  const meta = getGameMeta(gameId);
  const genre = getGameGenre(gameId);
  const players = createDemoPlayers(gameId);
  const botMemories: BotMemory[] = players.map(() => createBotMemory());
  const state = engine.createState(players, meta.defaultSetting);
  let bestSnapshot: GameSnapshot = engine.getSnapshot(state);

  // Tune simulation steps by genre so we capture exciting mid-game action (never empty start or post-game)
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
    if (out.finished) {
      // Keep the exciting peak-action frame right before match completion
      break;
    }
    bestSnapshot = out.snapshot;
  }

  snapshotCache.set(gameId, bestSnapshot);
  return bestSnapshot;
}

/**
 * Simulates a real 5-second gameplay clip (60 frames at 12fps) from the authoritative engine
 * with active AI bots so homepage cards can play a genuine 5-second live gameplay preview on hover.
 */
export function getOrGenerateDemoClip(gameId: GameId): DemoClipPayload | null {
  const cached = clipCache.get(gameId);
  if (cached) return cached;

  const engine = SERVER_GAMES[gameId];
  if (!engine) return null;

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
  const substepsPerFrame = isCard ? 2 : genre === 'board' ? 2 : 2;

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

  // Warm up past static start state into active mid-game play
  for (let w = 0; w < warmupTicks; w++) {
    const ended = advanceOneTick();
    if (ended) break;
  }

  const frames: GameSnapshot[] = [];
  for (let f = 0; f < TARGET_FRAMES; f++) {
    let ended = false;
    for (let s = 0; s < substepsPerFrame; s++) {
      ended = advanceOneTick();
      if (ended) break;
    }

    if (ended) {
      // If a fast match finishes early, seamlessly start a fresh live sequence so all 5 seconds stay active
      players = createDemoPlayers(gameId);
      botMemories = players.map(() => createBotMemory());
      state = engine.createState(players, meta.defaultSetting);
      currentSnap = engine.getSnapshot(state);
      for (let w = 0; w < 10; w++) {
        if (advanceOneTick()) break;
      }
    }

    // Clone snapshot cleanly via structuredClone so later ticks can't mutate earlier frames
    frames.push(structuredClone(currentSnap));
  }

  // Also prime snapshotCache with a peak frame if not already cached
  if (!snapshotCache.has(gameId) && frames.length > 0) {
    snapshotCache.set(gameId, frames[Math.floor(frames.length * 0.45)]);
  }

  const payload: DemoClipPayload = {
    gameId,
    durationMs: DURATION_MS,
    fps: FPS,
    frames,
  };

  if (clipCache.size >= MAX_CLIP_CACHE) {
    const oldestKey = clipCache.keys().next().value;
    if (oldestKey) clipCache.delete(oldestKey);
  }
  clipCache.set(gameId, payload);
  return payload;
}

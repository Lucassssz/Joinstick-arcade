import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BotDifficulty,
  type CompetitiveDrop,
  type CompetitiveDropKind,
  type CompetitiveHotZone,
  type CompetitivePlayerMeta,
  type CompetitivePopup,
  type CompetitiveSnapshot,
  type ControllerInput,
  type GameId,
  type GameSnapshot,
  type SoundEvent,
} from '../../src/shared/types.ts';
import { CARD_GAME_IDS } from '../../src/shared/games.ts';
import type { HapticTrigger } from './engine.ts';

/**
 * Games with free 2D movement across the 1200x720 arena where players & bots
 * can physically roam to contest Golden Relics and 2x Hot Zones.
 */
export const FREE_ROAM_ARENA_GAMES = new Set<GameId>([
  'bumper-brawl',
  'astro-blaster',
  'hex-drop',
  'fuse-pass',
  'grid-runners',
  'ricochet-tanks',
  'turbo-striker',
  'paint-rush',
  'laser-gauntlet',
  'vault-heist',
  'blade-duel',
  'crown-heist',
  'freeze-tag',
  'meteor-swarm',
  'hook-shot',
  'bomb-grid',
  'color-match',
  'kitchen-rush',
  'treasure-dig',
  'line-breakers',
  'spin-clash',
  'step-stomp',
  'blob-devour',
  'dodgeball-riot',
  'sumo-clash',
  'boxing-ko',
  'laser-jump-rope',
  'hot-lava-floor',
  'bomb-tag-arena',
  'musical-thrones',
  'sumo-ice-drift',
  'meteor-dodge-x',
  'king-of-hill-neo',
  'zombie-outbreak',
  'falling-anvils',
  'confetti-capture',
  'crane-drop-chaos',
  'horde-survivor',
  'starship-crew-chaos',
  'swarm-herd-clash',
  'moving-day-havoc',
  'wau-kite-cut',
  'five-stones-toss',
  // Free-roam 2D arenas that also use COMPACT_RING_GAMES spawn bounds (matching hex-drop & hot-lava-floor)
  'marble-ring',
  'roulette-arena',
]);

const COMPACT_RING_GAMES = new Set<GameId>([
  'bumper-brawl',
  'hex-drop',
  'sumo-clash',
  'sumo-ice-drift',
  'spin-clash',
  'marble-ring',
  'laser-jump-rope',
  'hot-lava-floor',
  'king-of-hill-neo',
  'roulette-arena',
]);

interface PlayerCompTrack {
  lastScore: number;
  streak: number;
  lastScoreAt: number;
  zoneTicks: number;
  lastComebackAt: number;
  lastActiveTurnAt: number;
}

export interface CompetitiveLayerState {
  gameId: GameId;
  spatialActive: boolean;
  elapsed: number;
  leaderId: string | null;
  leaderBounty: number;
  bountyGrowTimer: number;
  drops: CompetitiveDrop[];
  dropSpawnTimer: number;
  dropSeq: number;
  hotZone: CompetitiveHotZone | null;
  hotZoneCooldown: number;
  popups: CompetitivePopup[];
  popupSeq: number;
  bannerEn: string | null;
  bannerZh: string | null;
  bannerColor: string | null;
  bannerAlpha: number;
  prevActiveTurnPlayerId: string | null;
  tracks: Map<string, PlayerCompTrack>;
}

export interface CompetitivePlayerFeed {
  id: string;
  name: string;
  rawScore: number;
  score: number;
  alive: boolean;
  colorHex: string;
}

export interface CompetitiveStepResult {
  bonusAwards: Map<string, number>;
  sounds: SoundEvent[];
  haptics: HapticTrigger[];
  snapshot: CompetitiveSnapshot;
}

export function createCompetitiveState(gameId: GameId): CompetitiveLayerState {
  return {
    gameId,
    spatialActive: FREE_ROAM_ARENA_GAMES.has(gameId),
    elapsed: 0,
    leaderId: null,
    leaderBounty: 25,
    bountyGrowTimer: 0,
    drops: [],
    dropSpawnTimer: 4.5,
    dropSeq: 1,
    hotZone: null,
    hotZoneCooldown: 9.0,
    popups: [],
    popupSeq: 1,
    bannerEn: null,
    bannerZh: null,
    bannerColor: null,
    bannerAlpha: 0,
    prevActiveTurnPlayerId: null,
    tracks: new Map(),
  };
}

function getSafeArenaBounds(
  gameId: GameId,
  snapshot: GameSnapshot
): { cx: number; cy: number; rx: number; ry: number } {
  const sAny = snapshot as unknown as {
    ringCenterX?: number;
    ringCenterY?: number;
    ringRadius?: number;
  };
  if (
    typeof sAny.ringRadius === 'number' &&
    typeof sAny.ringCenterX === 'number' &&
    typeof sAny.ringCenterY === 'number' &&
    sAny.ringRadius > 90
  ) {
    const safeR = Math.max(60, sAny.ringRadius * 0.64);
    return { cx: sAny.ringCenterX, cy: sAny.ringCenterY, rx: safeR, ry: safeR };
  }
  if (COMPACT_RING_GAMES.has(gameId)) {
    return { cx: ARENA_WIDTH / 2, cy: ARENA_HEIGHT / 2 + 8, rx: 165, ry: 145 };
  }
  return { cx: ARENA_WIDTH / 2, cy: ARENA_HEIGHT / 2, rx: 320, ry: 175 };
}

function randomPointInArena(
  gameId: GameId,
  snapshot: GameSnapshot,
  centerBias = false
): { x: number; y: number } {
  const b = getSafeArenaBounds(gameId, snapshot);
  const angle = Math.random() * Math.PI * 2;
  const distFactor = centerBias ? 0.12 + Math.random() * 0.38 : 0.28 + Math.random() * 0.66;
  return {
    x: Math.round(b.cx + Math.cos(angle) * b.rx * distFactor),
    y: Math.round(b.cy + Math.sin(angle) * b.ry * distFactor),
  };
}

function pushPopup(
  state: CompetitiveLayerState,
  x: number,
  y: number,
  textEn: string,
  textZh: string,
  colorHex: string
): void {
  state.popups.push({
    id: `cp_${state.popupSeq++}`,
    x: Math.max(120, Math.min(ARENA_WIDTH - 120, x)),
    y: Math.max(85, Math.min(ARENA_HEIGHT - 85, y)),
    textEn,
    textZh,
    colorHex,
    alpha: 1.25,
  });
  if (state.popups.length > 10) {
    state.popups.shift();
  }
}

function setBanner(
  state: CompetitiveLayerState,
  textEn: string,
  textZh: string,
  colorHex: string
): void {
  state.bannerEn = textEn;
  state.bannerZh = textZh;
  state.bannerColor = colorHex;
  state.bannerAlpha = 2.6;
}

export function stepCompetitiveLayer(
  state: CompetitiveLayerState,
  players: CompetitivePlayerFeed[],
  snapshot: GameSnapshot,
  dt: number,
  frenzyActive: boolean,
  isTurnPaced: boolean
): CompetitiveStepResult {
  state.elapsed += dt;
  const bonusAwards = new Map<string, number>();
  const sounds: SoundEvent[] = [];
  const haptics: HapticTrigger[] = [];

  const awardBonus = (playerId: string, amount: number) => {
    if (amount <= 0) return;
    bonusAwards.set(playerId, (bonusAwards.get(playerId) ?? 0) + amount);
  };

  // Decay popups & banner
  for (let i = state.popups.length - 1; i >= 0; i--) {
    state.popups[i].y -= 26 * dt;
    state.popups[i].alpha -= dt * 0.85;
    if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
  }
  if (state.bannerAlpha > 0) {
    state.bannerAlpha = Math.max(0, state.bannerAlpha - dt);
  }

  // Extract spatial coordinates from snapshot players if available
  const snapPlayers = (
    (snapshot as unknown as {
      players?: Array<{
        id: string;
        x?: number;
        y?: number;
        alive?: boolean;
        falling?: boolean;
      }>;
    }).players ?? []
  );
  const posById = new Map<string, { x: number; y: number; alive: boolean }>();
  for (const sp of snapPlayers) {
    if (
      sp &&
      typeof sp.id === 'string' &&
      typeof sp.x === 'number' &&
      typeof sp.y === 'number' &&
      !sp.falling
    ) {
      posById.set(sp.id, { x: sp.x, y: sp.y, alive: sp.alive !== false });
    }
  }

  // Track turn transitions for Turn/Card Blitz bonus
  const activeTurnId =
    (snapshot as unknown as { activePlayerId?: string }).activePlayerId ?? null;
  if (activeTurnId && activeTurnId !== state.prevActiveTurnPlayerId) {
    state.prevActiveTurnPlayerId = activeTurnId;
    const t = state.tracks.get(activeTurnId);
    if (t) {
      t.lastActiveTurnAt = state.elapsed;
    }
  }

  const streakWindow = isTurnPaced ? 22 : 4.2;
  const isMultiplayer = players.length >= 2;
  const prevLeaderId = state.leaderId;

  // 1. Track scoring streaks, Blitz & Underdog Comeback across ALL 150 games
  for (let idx = 0; idx < players.length; idx++) {
    const p = players[idx];
    let track = state.tracks.get(p.id);
    if (!track) {
      track = {
        lastScore: p.rawScore,
        streak: 0,
        lastScoreAt: -99,
        zoneTicks: 0,
        lastComebackAt: -99,
        lastActiveTurnAt: state.elapsed,
      };
      state.tracks.set(p.id, track);
      continue;
    }

    const gain = p.rawScore - track.lastScore;
    if (gain > 0) {
      const withinWindow = state.elapsed - track.lastScoreAt <= streakWindow;
      track.streak = withinWindow ? Math.min(9, track.streak + 1) : 1;
      track.lastScoreAt = state.elapsed;

      const pos = posById.get(p.id);
      const px = pos?.x ?? 220 + ((idx + 0.5) / Math.max(1, players.length)) * 760;
      const py = pos?.y ?? (CARD_GAME_IDS.has(state.gameId) ? 200 : 170);

      // Hot-Streak Bonus (on 3x, 5x, 7x milestones)
      if (track.streak === 3 || track.streak === 5 || track.streak === 7) {
        const streakBonus = track.streak === 3 ? 10 : track.streak === 5 ? 18 : 28;
        awardBonus(p.id, streakBonus);
        pushPopup(
          state,
          px,
          py - 34,
          `🔥 ${track.streak}× STREAK +${streakBonus}`,
          `🔥 ${track.streak}连击 +${streakBonus}`,
          '#FF8A00'
        );
        sounds.push({ type: 'pickup', playerId: p.id });
      }

      // Quick-Draw Blitz Bonus in Turn/Card/Board games when scoring within 4.0s of turn start
      if (
        isTurnPaced &&
        gain >= 5 &&
        state.elapsed - track.lastActiveTurnAt <= 4.0 &&
        state.elapsed > 3
      ) {
        awardBonus(p.id, 10);
        pushPopup(state, px, py - 58, '⚡ BLITZ +10', '⚡ 快攻 +10', '#00C2FF');
        track.lastActiveTurnAt = -99; // once per turn
      }

      // Underdog Comeback Bonus (trailing player scoring in second half / frenzy)
      if (
        isMultiplayer &&
        prevLeaderId &&
        prevLeaderId !== p.id &&
        (state.elapsed >= 18 || frenzyActive) &&
        gain >= 8 &&
        state.elapsed - track.lastComebackAt >= 7.5
      ) {
        track.lastComebackAt = state.elapsed;
        const cb = frenzyActive ? 15 : 10;
        awardBonus(p.id, cb);
        pushPopup(
          state,
          px,
          py - 54,
          `⚡ COMEBACK +${cb}`,
          `⚡ 反击 +${cb}`,
          '#10D98B'
        );
      }
    } else if (state.elapsed - track.lastScoreAt > streakWindow + 1.5 && track.streak > 0) {
      track.streak = 0;
    }
    track.lastScore = p.rawScore;
  }

  // 2. Spatial Arena Interactive Drops & 2x Contested Hot Zone (~50 free-roam arena games)
  if (state.spatialActive && state.elapsed > 2.5) {
    // Spawn Golden Relics / Crown Shards
    state.dropSpawnTimer -= dt;
    const maxDrops = frenzyActive ? 3 : 2;
    if (state.dropSpawnTimer <= 0 && state.drops.length < maxDrops) {
      state.dropSpawnTimer = frenzyActive ? 4.8 : 6.8;
      const roll = Math.random();
      const kind: CompetitiveDropKind =
        roll < 0.25 ? 'crown' : roll < 0.62 ? 'relic' : 'surge';
      const value = kind === 'crown' ? 45 : kind === 'relic' ? 30 : 20;
      const pt = randomPointInArena(state.gameId, snapshot, kind === 'crown');
      const maxTtl = kind === 'crown' ? 9.5 : 11.5;
      state.drops.push({
        id: `drop_${state.dropSeq++}`,
        kind,
        x: pt.x,
        y: pt.y,
        value,
        ttl: maxTtl,
        maxTtl,
      });
      if (kind === 'crown' && isMultiplayer) {
        setBanner(
          state,
          'CROWN SHARD SPAWNED (+45 PTS)!',
          '王冠碎片已刷新（+45 分）！',
          '#FFB800'
        );
      }
    }

    // Check drop expiration & pickups
    for (let i = state.drops.length - 1; i >= 0; i--) {
      const d = state.drops[i];
      d.ttl -= dt;
      if (d.ttl <= 0) {
        state.drops.splice(i, 1);
        continue;
      }
      for (const p of players) {
        if (!p.alive) continue;
        const pos = posById.get(p.id);
        if (!pos || !pos.alive) continue;
        if (Math.hypot(pos.x - d.x, pos.y - d.y) <= 36) {
          const pts = frenzyActive ? Math.round(d.value * 1.5) : d.value;
          awardBonus(p.id, pts);
          const tr = state.tracks.get(p.id);
          if (tr) {
            tr.streak = Math.min(9, tr.streak + 1);
            tr.lastScoreAt = state.elapsed;
          }
          const labelEn =
            d.kind === 'crown'
              ? `👑 CROWN +${pts}`
              : d.kind === 'relic'
              ? `⭐ RELIC +${pts}`
              : `⚡ SURGE +${pts}`;
          const labelZh =
            d.kind === 'crown'
              ? `👑 王冠 +${pts}`
              : d.kind === 'relic'
              ? `⭐ 圣物 +${pts}`
              : `⚡ 狂飙 +${pts}`;
          const col =
            d.kind === 'crown' ? '#FFB800' : d.kind === 'relic' ? '#10D98B' : '#00C2FF';
          pushPopup(state, d.x, d.y - 20, labelEn, labelZh, col);
          sounds.push({ type: 'pickup', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: [24, 20, 36], reason: 'relic' });
          state.drops.splice(i, 1);
          break;
        }
      }
    }

    // Contested 2x Power Hot Zone
    if (!state.hotZone) {
      state.hotZoneCooldown -= dt;
      if (state.hotZoneCooldown <= 0 && isMultiplayer) {
        const pt = randomPointInArena(state.gameId, snapshot, true);
        const duration = frenzyActive ? 9.0 : 7.5;
        state.hotZone = {
          x: pt.x,
          y: pt.y,
          radius: 78,
          remaining: duration,
          duration,
          holderId: null,
          holderColorHex: null,
        };
        state.hotZoneCooldown = frenzyActive ? 11.5 : 15.0;
        setBanner(
          state,
          'HOT ZONE OPEN — HOLD CENTER FOR PTS!',
          '高能热区开启 —— 占领中心持续加分！',
          '#00C2FF'
        );
      }
    } else {
      state.hotZone.remaining -= dt;
      const occupants: CompetitivePlayerFeed[] = [];
      for (const p of players) {
        if (!p.alive) continue;
        const pos = posById.get(p.id);
        if (!pos || !pos.alive) continue;
        if (Math.hypot(pos.x - state.hotZone.x, pos.y - state.hotZone.y) <= state.hotZone.radius) {
          occupants.push(p);
        }
      }
      if (occupants.length === 1) {
        const holder = occupants[0];
        state.hotZone.holderId = holder.id;
        state.hotZone.holderColorHex = holder.colorHex;
        const tr = state.tracks.get(holder.id);
        if (tr) {
          tr.zoneTicks += dt;
          if (tr.zoneTicks >= 0.85) {
            tr.zoneTicks = 0;
            const zPts = frenzyActive ? 8 : 5;
            awardBonus(holder.id, zPts);
            const pos = posById.get(holder.id);
            pushPopup(
              state,
              pos?.x ?? state.hotZone.x,
              (pos?.y ?? state.hotZone.y) - 36,
              `ZONE +${zPts}`,
              `热区 +${zPts}`,
              holder.colorHex
            );
          }
        }
      } else {
        state.hotZone.holderId = null;
        state.hotZone.holderColorHex = null;
      }

      if (state.hotZone.remaining <= 0) {
        state.hotZone = null;
      }
    }
  }

  // 3. Leader Crown & Dethrone Bounty System (ALL 150 GAMES!)
  if (isMultiplayer) {
    // Determine effective leader using live score + current tick's bonusAwards
    let topPlayer: CompetitivePlayerFeed | null = null;
    let topScore = 0;
    let runnerUpScore = 0;

    for (const p of players) {
      const eff = p.score + (bonusAwards.get(p.id) ?? 0);
      if (eff > topScore) {
        runnerUpScore = topScore;
        topScore = eff;
        topPlayer = p;
      } else if (eff > runnerUpScore) {
        runnerUpScore = eff;
      }
    }

    if (topPlayer && topScore > 0 && topScore > runnerUpScore) {
      if (state.leaderId && state.leaderId !== topPlayer.id && state.elapsed > 4) {
        // DETHRONE! Claim the previous leader's bounty!
        const claimed = state.leaderBounty;
        awardBonus(topPlayer.id, claimed);
        const pos = posById.get(topPlayer.id);
        pushPopup(
          state,
          pos?.x ?? ARENA_WIDTH / 2,
          (pos?.y ?? 220) - 42,
          `👑 BOUNTY +${claimed}!`,
          `👑 夺冠悬赏 +${claimed}!`,
          '#FFB800'
        );
        setBanner(
          state,
          `LEAD CHANGE! ${topPlayer.name} CLAIMS +${claimed} BOUNTY!`,
          `榜首易主！${topPlayer.name} 拿下 +${claimed} 悬赏分！`,
          topPlayer.colorHex
        );
        sounds.push({ type: 'win', playerId: topPlayer.id });
        haptics.push({ playerId: topPlayer.id, pattern: [35, 25, 65], reason: 'bounty' });
        state.leaderBounty = 25;
        state.bountyGrowTimer = 0;
      } else if (!state.leaderId) {
        state.leaderBounty = 25;
        state.bountyGrowTimer = 0;
      } else {
        state.bountyGrowTimer += dt;
        if (state.bountyGrowTimer >= 6.0) {
          state.bountyGrowTimer = 0;
          state.leaderBounty = Math.min(75, state.leaderBounty + 5);
        }
      }
      state.leaderId = topPlayer.id;
    }
  }

  // Update lastScore for players who just earned bonus points so next tick diff stays clean
  // (Notice track.lastScore tracks p.score BEFORE bonusAwards; RoomManager adds bonusAwards to p.bonusScore separately!)

  const playerMeta: CompetitivePlayerMeta[] = players.map((p) => {
    const tr = state.tracks.get(p.id);
    const pos = posById.get(p.id);
    const isLeader = state.leaderId === p.id;
    return {
      id: p.id,
      streak: tr?.streak ?? 0,
      bounty: isLeader ? state.leaderBounty : 0,
      isLeader,
      x: pos?.x,
      y: pos?.y,
      colorHex: p.colorHex,
    };
  });

  return {
    bonusAwards,
    sounds,
    haptics,
    snapshot: {
      spatialActive: state.spatialActive,
      leaderId: state.leaderId,
      leaderBounty: state.leaderBounty,
      drops: state.drops.map((d) => ({ ...d })),
      hotZone: state.hotZone ? { ...state.hotZone } : null,
      popups: state.popups.map((pp) => ({ ...pp })),
      playerMeta,
      bannerEn: state.bannerEn,
      bannerZh: state.bannerZh,
      bannerColor: state.bannerColor,
      bannerAlpha: Math.min(1, state.bannerAlpha),
    },
  };
}

/**
 * Allows AI bots in free-roam spatial games to naturally spot and contest
 * Golden Relics and Active Hot Zones unless currently executing an urgent action.
 */
export function biasBotInputForCompetitiveDrops(
  compState: CompetitiveLayerState | null | undefined,
  snapshot: GameSnapshot | null,
  botId: string,
  difficulty: BotDifficulty,
  input: ControllerInput
): ControllerInput {
  if (!compState || !compState.spatialActive || !snapshot) return input;
  if (input.a || input.b) return input; // Do not override urgent dash/attack/jump

  const snapPlayers = (
    (snapshot as unknown as {
      players?: Array<{ id: string; x?: number; y?: number; alive?: boolean }>;
    }).players ?? []
  );
  const self = snapPlayers.find((p) => p.id === botId);
  if (!self || typeof self.x !== 'number' || typeof self.y !== 'number' || self.alive === false) {
    return input;
  }

  const detectRange = difficulty === 'spicy' ? 320 : difficulty === 'arcade' ? 245 : 155;
  let targetX: number | null = null;
  let targetY: number | null = null;
  let bestDist = detectRange;

  for (const drop of compState.drops) {
    const d = Math.hypot(drop.x - self.x, drop.y - self.y);
    const weightDist = drop.kind === 'crown' ? d * 0.78 : d;
    if (weightDist < bestDist) {
      bestDist = weightDist;
      targetX = drop.x;
      targetY = drop.y;
    }
  }

  if (targetX === null && compState.hotZone && !compState.hotZone.holderId) {
    const d = Math.hypot(compState.hotZone.x - self.x, compState.hotZone.y - self.y);
    if (d < detectRange * 0.9 && d > 28) {
      targetX = compState.hotZone.x;
      targetY = compState.hotZone.y;
    }
  }

  if (targetX === null || targetY === null) return input;
  const distToTarget = Math.hypot(targetX - self.x, targetY - self.y);
  if (distToTarget < 4) return input;

  const tx = (targetX - self.x) / distToTarget;
  const ty = (targetY - self.y) / distToTarget;
  const blend = difficulty === 'spicy' ? 0.65 : difficulty === 'arcade' ? 0.48 : 0.3;
  const nx = input.dx * (1 - blend) + tx * blend;
  const ny = input.dy * (1 - blend) + ty * blend;
  const nMag = Math.hypot(nx, ny);
  if (nMag < 0.05) return input;

  return {
    ...input,
    dx: nx / Math.max(1, nMag),
    dy: ny / Math.max(1, nMag),
  };
}

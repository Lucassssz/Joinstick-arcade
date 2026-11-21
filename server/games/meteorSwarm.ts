import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type MeteorPlayerState,
  type MeteorSwarmSnapshot,
  type RankingEntry,
  type SoundEvent,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface InternalMeteorPlayer extends MeteorPlayerState {
  vx: number;
  vy: number;
  fireCd: number;
  novaCd: number;
  invulnTimer: number;
}

interface InternalMeteor {
  id: string;
  kind: 'rock' | 'ufo';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  angle: number;
  shootCd: number;
}

interface InternalBullet {
  id: string;
  ownerId: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  enemy?: boolean;
}

interface MeteorSwarmState {
  timeLeft: number;
  totalTime: number;
  elapsed: number;
  wave: number;
  coreHp: number;
  maxCoreHp: number;
  teamScore: number;
  spawnTimer: number;
  nextId: number;
  meteors: InternalMeteor[];
  bullets: InternalBullet[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  players: Map<string, InternalMeteorPlayer>;
}

const CX = ARENA_WIDTH / 2;
const CY = ARENA_HEIGHT / 2;
const CORE_R = 46;
const PLAYER_R = 17;
const FIRE_CD = 0.22;
const NOVA_CD = 4.0;

function spawnEdgeThreat(state: MeteorSwarmState) {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (edge === 0) {
    x = Math.random() * ARENA_WIDTH;
    y = -30;
  } else if (edge === 1) {
    x = ARENA_WIDTH + 30;
    y = Math.random() * ARENA_HEIGHT;
  } else if (edge === 2) {
    x = Math.random() * ARENA_WIDTH;
    y = ARENA_HEIGHT + 30;
  } else {
    x = -30;
    y = Math.random() * ARENA_HEIGHT;
  }
  const isUfo = state.wave >= 2 && Math.random() < 0.24;
  const dx = CX - x + (Math.random() - 0.5) * 140;
  const dy = CY - y + (Math.random() - 0.5) * 140;
  const d = Math.hypot(dx, dy) || 1;
  const spd = isUfo ? 115 + state.wave * 8 : 78 + Math.random() * 42 + state.wave * 7;
  const big = !isUfo && Math.random() < 0.45;
  const r = isUfo ? 22 : big ? 30 : 19;
  const hp = isUfo ? 3 : big ? 3 : 1;

  state.meteors.push({
    id: `m_${state.nextId++}`,
    kind: isUfo ? 'ufo' : 'rock',
    x,
    y,
    vx: (dx / d) * spd,
    vy: (dy / d) * spd,
    r,
    hp,
    maxHp: hp,
    angle: Math.random() * Math.PI * 2,
    shootCd: 1.8,
  });
}

function makePlayer(p: ServerPlayerInputState, idx: number, total: number): InternalMeteorPlayer {
  const ang = (idx / Math.max(1, total)) * Math.PI * 2;
  return {
    id: p.id,
    slotIndex: p.slotIndex,
    name: p.name,
    colorHex: p.color.hex,
    x: CX + Math.cos(ang) * 135,
    y: CY + Math.sin(ang) * 135,
    vx: 0,
    vy: 0,
    angle: ang,
    hp: 4,
    maxHp: 4,
    downed: false,
    reviveProgress: 0,
    novaTimer: 0,
    kills: 0,
    score: 0,
    cooldownA: 0,
    cooldownB: 0,
    fireCd: 0,
    novaCd: 0,
    invulnTimer: 1.5,
  };
}

export const meteorSwarmModule: ServerGameModule<MeteorSwarmState> = {
  id: 'meteor-swarm',

  createState(players, settingValue) {
    const totalTime = Math.max(45, Math.min(120, settingValue || 75));
    const state: MeteorSwarmState = {
      timeLeft: totalTime,
      totalTime,
      elapsed: 0,
      wave: 1,
      coreHp: 14,
      maxCoreHp: 14,
      teamScore: 0,
      spawnTimer: 0.7,
      nextId: 1,
      meteors: [],
      bullets: [],
      explosions: [],
      players: new Map(),
    };
    players.forEach((p, idx) => state.players.set(p.id, makePlayer(p, idx, players.length)));
    return state;
  },

  addPlayer(state, player) {
    if (!state.players.has(player.id)) {
      state.players.set(player.id, makePlayer(player, state.players.size, state.players.size + 1));
    }
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const hudUpdates: Record<string, PlayerHudUpdate> = {};

    state.elapsed += dt;
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.wave = 1 + Math.floor(state.elapsed / 16);

    for (let i = state.explosions.length - 1; i >= 0; i--) {
      state.explosions[i].radius += 160 * dt;
      state.explosions[i].alpha -= dt * 3.2;
      if (state.explosions[i].alpha <= 0) state.explosions.splice(i, 1);
    }

    // Spawn meteors scaled fairly to player count & wave (intermediate pace)
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.meteors.length < 14 + players.length * 2) {
      spawnEdgeThreat(state);
      const playerScale = Math.max(0.65, 1 - (players.length - 1) * 0.08);
      state.spawnTimer = Math.max(0.55, (1.55 - state.wave * 0.14) * playerScale);
    }

    // Update players
    for (const p of players) {
      const e = state.players.get(p.id);
      if (!e) continue;

      e.fireCd = Math.max(0, e.fireCd - dt);
      e.novaCd = Math.max(0, e.novaCd - dt);
      e.novaTimer = Math.max(0, e.novaTimer - dt);
      e.invulnTimer = Math.max(0, e.invulnTimer - dt);

      if (e.downed) {
        // Solo auto-revive after 3s, or co-op ally hover revives quickly!
        const helper = [...state.players.values()].find(
          (other) => other.id !== e.id && !other.downed && Math.hypot(other.x - e.x, other.y - e.y) < 62
        );
        const rate = players.length <= 1 ? 0.34 : helper ? 0.72 : 0.08;
        e.reviveProgress = Math.min(1, e.reviveProgress + rate * dt);
        if (e.reviveProgress >= 1) {
          e.downed = false;
          e.hp = e.maxHp;
          e.reviveProgress = 0;
          e.invulnTimer = 2.0;
          if (helper) helper.score += 50;
          sounds.push({ type: 'pickup', playerId: e.id });
          haptics.push({ playerId: e.id, pattern: [24, 22, 42], reason: 'revived' });
        }
        e.cooldownA = 1;
        e.cooldownB = 1;
        continue;
      }

      const mag = Math.hypot(p.input.dx, p.input.dy);
      const nx = mag > 0.12 ? p.input.dx / mag : 0;
      const ny = mag > 0.12 ? p.input.dy / mag : 0;
      if (mag > 0.12) e.angle = Math.atan2(ny, nx);

      // Button A: Twin Plasma Blasters (hold or tap)
      if (p.input.a && e.fireCd <= 0) {
        e.fireCd = FIRE_CD;
        const perpX = -Math.sin(e.angle) * 7;
        const perpY = Math.cos(e.angle) * 7;
        const spd = 720;
        for (const side of [-1, 1]) {
          state.bullets.push({
            id: `b_${state.nextId++}`,
            ownerId: e.id,
            colorHex: e.colorHex,
            x: e.x + Math.cos(e.angle) * 20 + perpX * side,
            y: e.y + Math.sin(e.angle) * 20 + perpY * side,
            vx: Math.cos(e.angle) * spd,
            vy: Math.sin(e.angle) * spd,
            ttl: 1.15,
          });
        }
        sounds.push({ type: 'shoot', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: 12, reason: 'blaster' });
      }

      // Button B: Nova Repel Shield
      if (p.input.b && !p.prevB && e.novaCd <= 0) {
        e.novaCd = NOVA_CD;
        e.novaTimer = 0.4;
        e.invulnTimer = Math.max(e.invulnTimer, 0.7);
        const novaR = 200;
        state.explosions.push({ x: e.x, y: e.y, radius: 24, colorHex: '#00C2FF', alpha: 0.95 });
        for (const m of state.meteors) {
          const mdx = m.x - e.x;
          const mdy = m.y - e.y;
          const md = Math.hypot(mdx, mdy) || 1;
          if (md < novaR) {
            m.vx = (mdx / md) * 280;
            m.vy = (mdy / md) * 280;
            m.hp -= 1;
          }
        }
        state.bullets = state.bullets.filter((b) => !b.enemy || Math.hypot(b.x - e.x, b.y - e.y) > novaR);
        sounds.push({ type: 'pulse', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: [32, 22, 42], reason: 'nova' });
      }

      const targetVx = nx * 355;
      const targetVy = ny * 355;
      e.vx += (targetVx - e.vx) * Math.min(1, 12 * dt);
      e.vy += (targetVy - e.vy) * Math.min(1, 12 * dt);
      e.x = Math.max(32, Math.min(ARENA_WIDTH - 32, e.x + e.vx * dt));
      e.y = Math.max(32, Math.min(ARENA_HEIGHT - 32, e.y + e.vy * dt));

      // Gentle orbit outside core
      const cdx = e.x - CX;
      const cdy = e.y - CY;
      const cdist = Math.hypot(cdx, cdy) || 1;
      if (cdist < CORE_R + PLAYER_R + 6) {
        e.x = CX + (cdx / cdist) * (CORE_R + PLAYER_R + 6);
        e.y = CY + (cdy / cdist) * (CORE_R + PLAYER_R + 6);
      }

      e.cooldownA = e.fireCd / FIRE_CD;
      e.cooldownB = e.novaCd / NOVA_CD;
    }

    // Update bullets
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.ttl -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.ttl <= 0 || b.x < -10 || b.x > ARENA_WIDTH + 10 || b.y < -10 || b.y > ARENA_HEIGHT + 10) {
        state.bullets.splice(i, 1);
        continue;
      }

      if (b.enemy) {
        // Check hitting players or core
        if (Math.hypot(b.x - CX, b.y - CY) < CORE_R + 6) {
          state.coreHp = Math.max(0, state.coreHp - 1);
          state.explosions.push({ x: b.x, y: b.y, radius: 14, colorHex: '#FF4D2E', alpha: 0.9 });
          state.bullets.splice(i, 1);
          sounds.push({ type: 'hit' });
          continue;
        }
        for (const pl of state.players.values()) {
          if (!pl.downed && pl.invulnTimer <= 0 && Math.hypot(b.x - pl.x, b.y - pl.y) < PLAYER_R + 7) {
            pl.hp -= 1;
            pl.invulnTimer = 1.1;
            if (pl.hp <= 0) pl.downed = true;
            state.bullets.splice(i, 1);
            sounds.push({ type: 'hit', playerId: pl.id });
            haptics.push({ playerId: pl.id, pattern: [45, 25, 45], reason: 'ship-hit' });
            break;
          }
        }
      } else {
        // Player bullet vs meteors
        for (let mi = state.meteors.length - 1; mi >= 0; mi--) {
          const m = state.meteors[mi];
          if (Math.hypot(b.x - m.x, b.y - m.y) < m.r + 7) {
            m.hp -= 1;
            state.bullets.splice(i, 1);
            if (m.hp <= 0) {
              const shooter = state.players.get(b.ownerId);
              const pts = m.kind === 'ufo' ? 50 : m.maxHp >= 3 ? 35 : 20;
              if (shooter) {
                shooter.kills += 1;
                shooter.score += pts;
                haptics.push({ playerId: shooter.id, pattern: 22, reason: 'meteor-pop' });
              }
              state.teamScore += pts;
              state.explosions.push({ x: m.x, y: m.y, radius: m.r * 0.6, colorHex: m.kind === 'ufo' ? '#C084FC' : '#FFB800', alpha: 0.95 });
              // Large rocks split into 2 small fragments
              if (m.kind === 'rock' && m.r >= 26) {
                for (const sgn of [-1, 1]) {
                  const a = Math.atan2(m.vy, m.vx) + sgn * 0.65;
                  state.meteors.push({
                    id: `m_${state.nextId++}`,
                    kind: 'rock',
                    x: m.x + Math.cos(a) * 14,
                    y: m.y + Math.sin(a) * 14,
                    vx: Math.cos(a) * 105,
                    vy: Math.sin(a) * 105,
                    r: 15,
                    hp: 1,
                    maxHp: 1,
                    angle: a,
                    shootCd: 9,
                  });
                }
              }
              state.meteors.splice(mi, 1);
              sounds.push({ type: 'hit' });
            }
            break;
          }
        }
      }
    }

    // Update meteors & UFOs
    for (let i = state.meteors.length - 1; i >= 0; i--) {
      const m = state.meteors[i];
      if (m.hp <= 0) {
        state.meteors.splice(i, 1);
        continue;
      }
      // Gently steer back toward core if pushed away
      const cdx = CX - m.x;
      const cdy = CY - m.y;
      const cdist = Math.hypot(cdx, cdy) || 1;
      const pull = m.kind === 'ufo' ? 40 : 28;
      m.vx += (cdx / cdist) * pull * dt;
      m.vy += (cdy / cdist) * pull * dt;

      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.angle += dt * (m.kind === 'ufo' ? 2.5 : 1.4);

      if (m.kind === 'ufo') {
        m.shootCd -= dt;
        if (m.shootCd <= 0 && cdist < 420) {
          m.shootCd = 2.6;
          state.bullets.push({
            id: `eb_${state.nextId++}`,
            ownerId: 'ufo',
            colorHex: '#FF3B9A',
            x: m.x,
            y: m.y,
            vx: (cdx / cdist) * 290,
            vy: (cdy / cdist) * 290,
            ttl: 2.2,
            enemy: true,
          });
        }
      }

      // Hit central core
      if (cdist < CORE_R + m.r) {
        state.coreHp = Math.max(0, state.coreHp - (m.r >= 26 ? 2 : 1));
        state.explosions.push({ x: m.x, y: m.y, radius: 26, colorHex: '#FF4D2E', alpha: 1 });
        state.meteors.splice(i, 1);
        sounds.push({ type: 'ko' });
        for (const p of players) haptics.push({ playerId: p.id, pattern: [55, 30, 55], reason: 'core-hit' });
        continue;
      }

      // Hit players
      for (const pl of state.players.values()) {
        if (!pl.downed && pl.invulnTimer <= 0 && Math.hypot(pl.x - m.x, pl.y - m.y) < PLAYER_R + m.r - 3) {
          pl.hp -= 1;
          pl.invulnTimer = 1.25;
          m.hp -= 1;
          if (pl.hp <= 0) pl.downed = true;
          sounds.push({ type: 'hit', playerId: pl.id });
          haptics.push({ playerId: pl.id, pattern: [50, 30, 50], reason: 'meteor-hit' });
        }
      }
    }

    for (const p of players) {
      const e = state.players.get(p.id);
      if (!e) continue;
      hudUpdates[p.id] = {
        score: e.score,
        alive: !e.downed,
        statText: e.downed ? 'DOWNED' : `Core ${state.coreHp}/${state.maxCoreHp} · ${e.kills} KOs`,
        cooldownA: e.cooldownA,
        cooldownB: e.cooldownB,
      };
    }

    const finished = state.coreHp <= 0 || state.timeLeft <= 0;
    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished,
      rankings: finished ? this.getRankings(state, players) : undefined,
    };
  },

  getSnapshot(state): MeteorSwarmSnapshot {
    return {
      gameId: 'meteor-swarm',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      wave: state.wave,
      coreHp: state.coreHp,
      maxCoreHp: state.maxCoreHp,
      teamScore: state.teamScore,
      meteors: state.meteors.map((m) => ({
        id: m.id,
        kind: m.kind,
        x: m.x,
        y: m.y,
        r: m.r,
        hp: m.hp,
        maxHp: m.maxHp,
        angle: m.angle,
      })),
      bullets: state.bullets.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        colorHex: b.colorHex,
        enemy: b.enemy,
      })),
      explosions: state.explosions.map((e) => ({ ...e })),
      players: [...state.players.values()].map((e) => ({
        id: e.id,
        slotIndex: e.slotIndex,
        name: e.name,
        colorHex: e.colorHex,
        x: e.x,
        y: e.y,
        angle: e.angle,
        hp: e.hp,
        maxHp: e.maxHp,
        downed: e.downed,
        reviveProgress: e.reviveProgress,
        novaTimer: e.novaTimer,
        kills: e.kills,
        score: e.score,
        cooldownA: e.cooldownA,
        cooldownB: e.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...players]
      .map((p) => ({ p, e: state.players.get(p.id) }))
      .sort((a, b) => (b.e?.score ?? 0) - (a.e?.score ?? 0));
    return sorted.map(({ p, e }, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: p.color,
      rank: idx + 1,
      score: e?.score ?? 0,
      highlight: `${e?.kills ?? 0} destroyed · Core ${state.coreHp}/${state.maxCoreHp}`,
    }));
  },
};

import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BladeDuelPlayerState,
  type BladeDuelSnapshot,
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

interface InternalDuelist extends BladeDuelPlayerState {
  vx: number;
  vy: number;
  slashCd: number;
  parryCd: number;
  waveTimer: number;
  windTimer: number;
}

interface InternalWave {
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  colorHex: string;
  ttl: number;
}

interface BladeDuelState {
  round: number;
  targetWins: number;
  roundTimer: number;
  roundBanner: string | null;
  betweenRoundTimer: number;
  dangerRadius: number;
  nextId: number;
  scrollTimer: number;
  pillars: { x: number; y: number; r: number }[];
  scrolls: { id: string; kind: 'blade-wave' | 'wind-step' | 'heart'; x: number; y: number }[];
  waveProjectiles: InternalWave[];
  slashes: { x: number; y: number; angle: number; colorHex: string; alpha: number }[];
  sparks: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  duelists: InternalDuelist[];
}

const SLASH_CD = 1.25;
const PARRY_CD = 1.7;
const PARRY_WINDOW = 0.44; // Generous intermediate parry window
const MAX_HP = 3;
const HIT_INVULN = 1.05;
const PLAYER_R = 20;
const CX = ARENA_WIDTH / 2;
const CY = ARENA_HEIGHT / 2;

function spawnScroll(state: BladeDuelState) {
  const spots = [
    { x: CX, y: CY },
    { x: CX - 180, y: 180 },
    { x: CX + 180, y: 180 },
    { x: CX - 180, y: ARENA_HEIGHT - 180 },
    { x: CX + 180, y: ARENA_HEIGHT - 180 },
  ];
  const sp = spots[Math.floor(Math.random() * spots.length)];
  const anyWounded = state.duelists.some((d) => d.alive && d.hp < d.maxHp);
  const roll = Math.random();
  const kind: 'blade-wave' | 'wind-step' | 'heart' =
    anyWounded && roll < 0.36 ? 'heart' : roll < 0.68 ? 'blade-wave' : 'wind-step';
  state.scrolls.push({
    id: `sc_${state.nextId++}`,
    kind,
    x: sp.x + (Math.random() - 0.5) * 40,
    y: sp.y + (Math.random() - 0.5) * 40,
  });
}

function applyDuelDamage(
  state: BladeDuelState,
  victim: InternalDuelist,
  attacker: InternalDuelist | undefined,
  knockAngle: number,
  koLabel: string,
  sounds: SoundEvent[],
  haptics: HapticTrigger[],
  players: ServerPlayerInputState[]
) {
  if (!victim.alive || victim.invulnTimer > 0) return;

  victim.hp = Math.max(0, victim.hp - 1);
  victim.slashTimer = 0;
  victim.parryTimer = 0;
  victim.vx = Math.cos(knockAngle) * 520;
  victim.vy = Math.sin(knockAngle) * 520;

  if (victim.hp > 0) {
    victim.invulnTimer = HIT_INVULN;
    if (attacker && attacker.id !== victim.id) {
      attacker.score += 45;
    }
    state.sparks.push({ x: victim.x, y: victim.y, radius: 18, colorHex: '#FF4D2E', alpha: 1 });
    state.popups.push({
      x: victim.x,
      y: victim.y - 26,
      text: `-1 ♥ (${victim.hp} LEFT)`,
      colorHex: '#FF4D2E',
      alpha: 1,
    });
    sounds.push({ type: 'hit', playerId: victim.id });
    if (!victim.isBot) haptics.push({ playerId: victim.id, pattern: [45, 25, 45], reason: 'blade-hit' });
    if (attacker && !attacker.isBot) haptics.push({ playerId: attacker.id, pattern: 35, reason: 'blade-strike' });
  } else {
    victim.alive = false;
    victim.invulnTimer = 0;
    if (attacker && attacker.id !== victim.id) {
      attacker.score += 100;
    }
    const col = attacker?.colorHex ?? '#FF4D2E';
    state.sparks.push({ x: victim.x, y: victim.y, radius: 24, colorHex: col, alpha: 1 });
    state.popups.push({ x: victim.x, y: victim.y - 26, text: koLabel, colorHex: col, alpha: 1 });
    sounds.push({ type: 'ko' });
    for (const pl of players) haptics.push({ playerId: pl.id, pattern: [65, 35, 85], reason: 'ko' });
  }
}

function resetRound(state: BladeDuelState) {
  state.roundTimer = 40;
  state.dangerRadius = 560;
  state.slashes = [];
  state.waveProjectiles = [];
  state.scrolls = [];
  state.scrollTimer = 3.5;
  const total = state.duelists.length;
  state.duelists.forEach((d, idx) => {
    if (total <= 2) {
      d.x = idx === 0 ? 270 : ARENA_WIDTH - 270;
      d.y = ARENA_HEIGHT / 2;
      d.angle = idx === 0 ? 0 : Math.PI;
    } else {
      const ang = (idx / total) * Math.PI * 2;
      d.x = ARENA_WIDTH / 2 + Math.cos(ang) * 320;
      d.y = ARENA_HEIGHT / 2 + Math.sin(ang) * 210;
      d.angle = ang + Math.PI;
    }
    d.vx = 0;
    d.vy = 0;
    d.alive = true;
    d.hp = MAX_HP;
    d.maxHp = MAX_HP;
    d.invulnTimer = 0;
    d.slashTimer = 0;
    d.parryTimer = 0;
    d.stunTimer = 0;
    d.waveTimer = 0;
    d.windTimer = 0;
    d.slashCd = 0.35;
    d.parryCd = 0.35;
  });
}

export const bladeDuelModule: ServerGameModule<BladeDuelState> = {
  id: 'blade-duel',

  createState(players, settingValue) {
    const targetWins = Math.max(2, Math.min(7, settingValue || 3));
    const duelists: InternalDuelist[] = players.map((p, idx) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: p.isBot,
      x: idx === 0 ? 270 : ARENA_WIDTH - 270,
      y: ARENA_HEIGHT / 2,
      vx: 0,
      vy: 0,
      angle: idx === 0 ? 0 : Math.PI,
      alive: true,
      hp: MAX_HP,
      maxHp: MAX_HP,
      invulnTimer: 0,
      slashTimer: 0,
      parryTimer: 0,
      stunTimer: 0,
      waveTimer: 0,
      windTimer: 0,
      roundsWon: 0,
      parries: 0,
      score: 0,
      cooldownA: 0,
      cooldownB: 0,
      slashCd: 0,
      parryCd: 0,
    }));

    const state: BladeDuelState = {
      round: 1,
      targetWins,
      roundTimer: 40,
      roundBanner: null,
      betweenRoundTimer: 0,
      dangerRadius: 560,
      nextId: 1,
      scrollTimer: 3.5,
      pillars: [
        { x: ARENA_WIDTH / 2, y: 205, r: 30 },
        { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT - 205, r: 30 },
      ],
      scrolls: [],
      waveProjectiles: [],
      slashes: [],
      sparks: [],
      popups: [],
      duelists,
    };
    resetRound(state);
    return state;
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const inputById = new Map(players.map((p) => [p.id, p]));

    for (let i = state.slashes.length - 1; i >= 0; i--) {
      state.slashes[i].alpha -= dt * 3.8;
      if (state.slashes[i].alpha <= 0) state.slashes.splice(i, 1);
    }
    for (let i = state.sparks.length - 1; i >= 0; i--) {
      state.sparks[i].radius += 260 * dt;
      state.sparks[i].alpha -= dt * 2.8;
      if (state.sparks[i].alpha <= 0) state.sparks.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= 28 * dt;
      state.popups[i].alpha -= dt * 1.1;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    if (state.betweenRoundTimer > 0) {
      state.betweenRoundTimer = Math.max(0, state.betweenRoundTimer - dt);
      if (state.betweenRoundTimer <= 0) {
        const matchWinner = state.duelists.find((d) => d.roundsWon >= state.targetWins);
        if (matchWinner) {
          return {
            snapshot: this.getSnapshot(state),
            sounds,
            haptics,
            hudUpdates,
            finished: true,
            rankings: this.getRankings(state, players),
          };
        }
        state.round += 1;
        state.roundBanner = null;
        resetRound(state);
      }
    } else {
      state.roundTimer = Math.max(0, state.roundTimer - dt);

      // Sudden death shrinking hazard ring in final 14s
      if (state.roundTimer < 14) {
        state.dangerRadius = Math.max(175, 175 + (state.roundTimer / 14) * 385);
      } else {
        state.dangerRadius = 560;
      }

      state.scrollTimer -= dt;
      if (state.scrollTimer <= 0 && state.scrolls.length < 2) {
        spawnScroll(state);
        state.scrollTimer = 7.0;
      }

      for (let idx = 0; idx < state.duelists.length; idx++) {
        const d = state.duelists[idx];
        if (!d.alive) continue;

        d.slashCd = Math.max(0, d.slashCd - dt);
        d.parryCd = Math.max(0, d.parryCd - dt);
        d.slashTimer = Math.max(0, d.slashTimer - dt);
        d.parryTimer = Math.max(0, d.parryTimer - dt);
        d.stunTimer = Math.max(0, d.stunTimer - dt);
        d.waveTimer = Math.max(0, d.waveTimer - dt);
        d.windTimer = Math.max(0, d.windTimer - dt);
        d.invulnTimer = Math.max(0, d.invulnTimer - dt);

        let dx = 0;
        let dy = 0;
        let pressA = false;
        let pressB = false;

        if (d.stunTimer <= 0) {
          const inp = inputById.get(d.id);
          if (inp) {
            dx = inp.input.dx;
            dy = inp.input.dy;
            pressA = inp.input.a && !inp.prevA;
            pressB = inp.input.b && !inp.prevB;
          }
        }

        const mag = Math.hypot(dx, dy);
        if (mag > 0.14 && d.slashTimer <= 0) {
          d.angle = Math.atan2(dy, dx);
        }

        // Button B: Timed Parry
        if (pressB && d.parryCd <= 0 && d.slashTimer <= 0) {
          d.parryTimer = PARRY_WINDOW;
          d.parryCd = PARRY_CD;
          sounds.push({ type: 'ready', playerId: d.id });
          if (!d.isBot) haptics.push({ playerId: d.id, pattern: 18, reason: 'parry-stance' });
        }

        // Button A: Dash Slash (plus Blade Wave projectile if buffed!)
        if (pressA && d.slashCd <= 0 && d.parryTimer <= 0) {
          d.slashTimer = 0.24;
          d.slashCd = d.windTimer > 0 ? SLASH_CD * 0.72 : SLASH_CD;
          d.vx = Math.cos(d.angle) * 760;
          d.vy = Math.sin(d.angle) * 760;
          state.slashes.push({ x: d.x, y: d.y, angle: d.angle, colorHex: d.colorHex, alpha: 1 });
          if (d.waveTimer > 0) {
            state.waveProjectiles.push({
              ownerId: d.id,
              x: d.x + Math.cos(d.angle) * 26,
              y: d.y + Math.sin(d.angle) * 26,
              vx: Math.cos(d.angle) * 620,
              vy: Math.sin(d.angle) * 620,
              angle: d.angle,
              colorHex: d.colorHex,
              ttl: 0.9,
            });
          }
          sounds.push({ type: 'boost', playerId: d.id });
          if (!d.isBot) haptics.push({ playerId: d.id, pattern: 26, reason: 'slash' });
        }

        const windMult = d.windTimer > 0 ? 1.32 : 1;
        const speed = d.stunTimer > 0 ? 0 : d.parryTimer > 0 ? 110 : d.slashTimer > 0 ? 740 : 300 * windMult;
        const tvx = d.slashTimer > 0 ? d.vx : mag > 0.14 ? (dx / mag) * speed : 0;
        const tvy = d.slashTimer > 0 ? d.vy : mag > 0.14 ? (dy / mag) * speed : 0;
        const accel = d.slashTimer > 0 ? 3.5 : 15;
        d.vx += (tvx - d.vx) * Math.min(1, accel * dt);
        d.vy += (tvy - d.vy) * Math.min(1, accel * dt);

        d.x = Math.max(84, Math.min(ARENA_WIDTH - 84, d.x + d.vx * dt));
        d.y = Math.max(84, Math.min(ARENA_HEIGHT - 84, d.y + d.vy * dt));

        for (const pil of state.pillars) {
          const pdx = d.x - pil.x;
          const pdy = d.y - pil.y;
          const pdist = Math.hypot(pdx, pdy) || 1;
          if (pdist < pil.r + PLAYER_R) {
            d.x = pil.x + (pdx / pdist) * (pil.r + PLAYER_R);
            d.y = pil.y + (pdy / pdist) * (pil.r + PLAYER_R);
          }
        }

        // Scroll pickup
        for (let si = state.scrolls.length - 1; si >= 0; si--) {
          const sc = state.scrolls[si];
          if (Math.hypot(d.x - sc.x, d.y - sc.y) < PLAYER_R + 20) {
            if (sc.kind === 'blade-wave') {
              d.waveTimer = 8.5;
              state.popups.push({ x: d.x, y: d.y - 26, text: 'BLADE WAVE!', colorHex: '#FF3B9A', alpha: 1 });
            } else if (sc.kind === 'heart') {
              if (d.hp < d.maxHp) {
                d.hp += 1;
                state.popups.push({ x: d.x, y: d.y - 26, text: '+1 ♥ LIFE!', colorHex: '#FF4D2E', alpha: 1 });
              } else {
                d.windTimer = 5.0;
                state.popups.push({ x: d.x, y: d.y - 26, text: 'FULL ♥ +40', colorHex: '#FFB800', alpha: 1 });
                d.score += 10;
              }
            } else {
              d.windTimer = 8.0;
              state.popups.push({ x: d.x, y: d.y - 26, text: 'WIND STEP!', colorHex: '#10D98B', alpha: 1 });
            }
            d.score += 30;
            state.scrolls.splice(si, 1);
            sounds.push({ type: 'pickup', playerId: d.id });
            if (!d.isBot) haptics.push({ playerId: d.id, pattern: 22, reason: 'scroll' });
          }
        }

        // Sudden death ring out-of-bounds damage
        if (state.roundTimer < 14 && Math.hypot(d.x - CX, d.y - CY) > state.dangerRadius) {
          const inwardAngle = Math.atan2(CY - d.y, CX - d.x);
          applyDuelDamage(state, d, undefined, inwardAngle, 'RING OUT!', sounds, haptics, players);
        }

        d.cooldownA = d.slashCd / SLASH_CD;
        d.cooldownB = d.parryCd / PARRY_CD;
      }

      // Step Blade Wave projectiles
      for (let wi = state.waveProjectiles.length - 1; wi >= 0; wi--) {
        const w = state.waveProjectiles[wi];
        w.ttl -= dt;
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        if (w.ttl <= 0 || w.x < 70 || w.x > ARENA_WIDTH - 70 || w.y < 70 || w.y > ARENA_HEIGHT - 70) {
          state.waveProjectiles.splice(wi, 1);
          continue;
        }
        if (state.pillars.some((pil) => Math.hypot(w.x - pil.x, w.y - pil.y) < pil.r + 14)) {
          state.waveProjectiles.splice(wi, 1);
          continue;
        }
        for (const target of state.duelists) {
          if (!target.alive || target.id === w.ownerId) continue;
          if (Math.hypot(w.x - target.x, w.y - target.y) < PLAYER_R + 22) {
            const owner = state.duelists.find((du) => du.id === w.ownerId);
            if (target.parryTimer > 0) {
              // Reflected!
              w.vx = -w.vx;
              w.vy = -w.vy;
              w.angle += Math.PI;
              w.ownerId = target.id;
              w.colorHex = target.colorHex;
              target.parries += 1;
              target.score += 45;
              state.sparks.push({ x: target.x, y: target.y, radius: 18, colorHex: '#FFB800', alpha: 1 });
              state.popups.push({ x: target.x, y: target.y - 28, text: 'DEFLECT +45', colorHex: '#FFB800', alpha: 1 });
              sounds.push({ type: 'pulse', playerId: target.id });
            } else if (target.invulnTimer <= 0) {
              applyDuelDamage(state, target, owner, w.angle, 'WAVE KO!', sounds, haptics, players);
              state.waveProjectiles.splice(wi, 1);
            }
            break;
          }
        }
      }

      // Check pairwise blade clashes & hits across all active duelists
      for (let i = 0; i < state.duelists.length; i++) {
        for (let j = i + 1; j < state.duelists.length; j++) {
          const a = state.duelists[i];
          const b = state.duelists[j];
          if (!a.alive || !b.alive) continue;
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist >= 66) continue;

          if (a.slashTimer > 0 && b.slashTimer > 0) {
            const nx = (a.x - b.x) / (dist || 1);
            const ny = (a.y - b.y) / (dist || 1);
            a.vx = nx * 460;
            a.vy = ny * 460;
            b.vx = -nx * 460;
            b.vy = -ny * 460;
            a.slashTimer = 0;
            b.slashTimer = 0;
            state.sparks.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, radius: 14, colorHex: '#FFB800', alpha: 1 });
            sounds.push({ type: 'pulse' });
            for (const pl of players) haptics.push({ playerId: pl.id, pattern: [30, 20, 45], reason: 'clash' });
          } else if (a.slashTimer > 0) {
            if (b.parryTimer > 0) {
              a.slashTimer = 0;
              a.stunTimer = 1.15;
              b.parries += 1;
              b.score += 40;
              b.slashCd = 0;
              state.sparks.push({ x: b.x, y: b.y, radius: 18, colorHex: '#FFB800', alpha: 1 });
              state.popups.push({ x: b.x, y: b.y - 26, text: 'PARRY +40', colorHex: '#FFB800', alpha: 1 });
              sounds.push({ type: 'pulse', playerId: b.id });
              if (!b.isBot) haptics.push({ playerId: b.id, pattern: [25, 20, 60], reason: 'parry-win' });
              if (!a.isBot) haptics.push({ playerId: a.id, pattern: [60, 30, 60], reason: 'parried' });
            } else if (b.invulnTimer <= 0) {
              a.slashTimer = 0;
              const knockAng = Math.atan2(b.y - a.y, b.x - a.x);
              applyDuelDamage(state, b, a, knockAng, 'SLASH KO!', sounds, haptics, players);
            }
          } else if (b.slashTimer > 0) {
            if (a.parryTimer > 0) {
              b.slashTimer = 0;
              b.stunTimer = 1.15;
              a.parries += 1;
              a.score += 40;
              a.slashCd = 0;
              state.sparks.push({ x: a.x, y: a.y, radius: 18, colorHex: '#FFB800', alpha: 1 });
              state.popups.push({ x: a.x, y: a.y - 26, text: 'PARRY +40', colorHex: '#FFB800', alpha: 1 });
              sounds.push({ type: 'pulse', playerId: a.id });
              if (!a.isBot) haptics.push({ playerId: a.id, pattern: [25, 20, 60], reason: 'parry-win' });
              if (!b.isBot) haptics.push({ playerId: b.id, pattern: [60, 30, 60], reason: 'parried' });
            } else if (a.invulnTimer <= 0) {
              b.slashTimer = 0;
              const knockAng = Math.atan2(a.y - b.y, a.x - b.x);
              applyDuelDamage(state, a, b, knockAng, 'SLASH KO!', sounds, haptics, players);
            }
          }
        }
      }

      const aliveDuelists = state.duelists.filter((d) => d.alive);
      if (state.duelists.length > 1 && aliveDuelists.length <= 1 && state.betweenRoundTimer <= 0) {
        const survivor = aliveDuelists[0];
        if (survivor) {
          survivor.roundsWon += 1;
          state.roundBanner = `${survivor.name} STRIKES TRUE!`;
        } else {
          state.roundBanner = 'DOUBLE KO!';
        }
        state.betweenRoundTimer = 1.9;
      }

      if (state.roundTimer <= 0 && state.betweenRoundTimer <= 0) {
        const sortedAlive = [...aliveDuelists].sort((a, b) => b.hp - a.hp);
        if (sortedAlive.length >= 2 && sortedAlive[0].hp > sortedAlive[1].hp) {
          sortedAlive[0].roundsWon += 1;
          state.roundBanner = `${sortedAlive[0].name} WINS ON LIFE!`;
        } else {
          state.roundBanner = 'DRAW — NEXT ROUND';
        }
        state.betweenRoundTimer = 1.6;
      }
    }

    for (const p of players) {
      const d = state.duelists.find((du) => du.id === p.id);
      if (!d) continue;
      const heartsText = `${'♥'.repeat(Math.max(0, d.hp))}${'♡'.repeat(Math.max(0, d.maxHp - d.hp))}`;
      hudUpdates[p.id] = {
        score: d.roundsWon,
        alive: d.alive,
        statText: `${heartsText} · Wins ${d.roundsWon}/${state.targetWins}`,
        cooldownA: d.cooldownA,
        cooldownB: d.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished: false,
    };
  },

  getSnapshot(state): BladeDuelSnapshot {
    return {
      gameId: 'blade-duel',
      round: state.round,
      targetWins: state.targetWins,
      roundTimer: state.roundTimer,
      roundBanner: state.roundBanner,
      dangerRadius: state.dangerRadius,
      pillars: state.pillars,
      scrolls: state.scrolls.map((s) => ({ ...s })),
      waveProjectiles: state.waveProjectiles.map((w) => ({
        x: w.x,
        y: w.y,
        angle: w.angle,
        colorHex: w.colorHex,
      })),
      slashes: state.slashes.map((s) => ({ ...s })),
      sparks: state.sparks.map((s) => ({ ...s })),
      popups: state.popups.map((p) => ({ ...p })),
      players: state.duelists.map((d) => ({
        id: d.id,
        slotIndex: d.slotIndex,
        name: d.name,
        colorHex: d.colorHex,
        isBot: d.isBot,
        x: d.x,
        y: d.y,
        angle: d.angle,
        alive: d.alive,
        hp: d.hp,
        maxHp: d.maxHp,
        invulnTimer: d.invulnTimer,
        slashTimer: d.slashTimer,
        parryTimer: d.parryTimer,
        stunTimer: d.stunTimer,
        waveTimer: d.waveTimer,
        windTimer: d.windTimer,
        roundsWon: d.roundsWon,
        parries: d.parries,
        score: d.score,
        cooldownA: d.cooldownA,
        cooldownB: d.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...players]
      .map((p) => ({ p, d: state.duelists.find((du) => du.id === p.id) }))
      .sort((a, b) => (b.d?.roundsWon ?? 0) - (a.d?.roundsWon ?? 0) || (b.d?.score ?? 0) - (a.d?.score ?? 0));
    return sorted.map(({ p, d }, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: p.color,
      rank: idx + 1,
      score: d?.roundsWon ?? 0,
      highlight: `${d?.roundsWon ?? 0} wins · ${d?.parries ?? 0} parries`,
    }));
  },
};

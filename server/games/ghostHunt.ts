import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type GhostHuntSnapshot,
  type GhostPlayerState,
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

interface InternalGhostPlayer extends GhostPlayerState {
  vx: number;
  vy: number;
  cdA: number;
  cdB: number;
  revealTimer: number;
  invulnTimer: number;
  flareTimer: number;
}

interface InternalNet {
  id: string;
  ownerId: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ttl: number;
}

interface GhostHuntState {
  timeLeft: number;
  totalTime: number;
  nextId: number;
  orbTimer: number;
  banner: string | null;
  bannerTimer: number;
  walls: { x: number; y: number; w: number; h: number }[];
  nets: InternalNet[];
  pings: { x: number; y: number; radius: number; maxRadius: number; alpha: number }[];
  orbs: { id: string; kind: 'flare' | 'ecto'; x: number; y: number }[];
  decoys: { x: number; y: number; vx: number; vy: number; alpha: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  entities: InternalGhostPlayer[];
}

const PLAYER_R = 18;
const CD_A = 1.35;
const CD_B = 3.6;

function resolveWall(entity: { x: number; y: number }, r: number, w: { x: number; y: number; w: number; h: number }) {
  const cx = Math.max(w.x, Math.min(entity.x, w.x + w.w));
  const cy = Math.max(w.y, Math.min(entity.y, w.y + w.h));
  const dx = entity.x - cx;
  const dy = entity.y - cy;
  const dist = Math.hypot(dx, dy);
  if (dist < r && dist > 0.0001) {
    entity.x += (dx / dist) * (r - dist);
    entity.y += (dy / dist) * (r - dist);
  }
}

export const ghostHuntModule: ServerGameModule<GhostHuntState> = {
  id: 'ghost-hunt',

  createState(players, settingValue) {
    const totalTime = Math.max(45, Math.min(120, settingValue || 75));
    const totalCount = players.length;
    const ghostIdx = totalCount >= 2 ? Math.floor(Math.random() * totalCount) : -1;
    const entities: InternalGhostPlayer[] = [];

    const spawnPoints = [
      { x: 130, y: 130 },
      { x: ARENA_WIDTH - 130, y: 130 },
      { x: 130, y: ARENA_HEIGHT - 130 },
      { x: ARENA_WIDTH - 130, y: ARENA_HEIGHT - 130 },
      { x: ARENA_WIDTH / 2, y: 110 },
      { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT - 110 },
      { x: 140, y: ARENA_HEIGHT / 2 },
      { x: ARENA_WIDTH - 140, y: ARENA_HEIGHT / 2 },
    ];

    for (let i = 0; i < totalCount; i++) {
      const p = players[i];
      const role: 'ghost' | 'hunter' = i === ghostIdx ? 'ghost' : 'hunter';
      const sp = role === 'ghost' ? { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 } : spawnPoints[i % spawnPoints.length];

      entities.push({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: role === 'ghost' ? '#C084FC' : p.color.hex,
        isBot: p.isBot,
        role,
        x: sp.x,
        y: sp.y,
        vx: 0,
        vy: 0,
        angle: Math.atan2(ARENA_HEIGHT / 2 - sp.y, ARENA_WIDTH / 2 - sp.x),
        alive: true,
        hp: role === 'ghost' ? 6 : 2,
        maxHp: role === 'ghost' ? 6 : 2,
        visibility: role === 'ghost' ? 0.15 : 1,
        dashTimer: 0,
        flareTimer: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        cdA: 0,
        cdB: 0,
        revealTimer: role === 'ghost' ? 1.5 : 0,
        invulnTimer: 1.5,
      });
    }

    return {
      timeLeft: totalTime,
      totalTime,
      nextId: 1,
      orbTimer: 4.0,
      banner: 'SWEEP FLASHLIGHTS TO EXPOSE THE PHANTOM!',
      bannerTimer: 2.2,
      walls: [
        { x: 250, y: 170, w: 170, h: 28 },
        { x: 780, y: 170, w: 170, h: 28 },
        { x: 250, y: 522, w: 170, h: 28 },
        { x: 780, y: 522, w: 170, h: 28 },
        { x: 586, y: 260, w: 28, h: 200 },
        { x: 250, y: 295, w: 28, h: 130 },
        { x: 922, y: 295, w: 28, h: 130 },
      ],
      nets: [],
      pings: [],
      orbs: [],
      decoys: [],
      popups: [],
      entities,
    };
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const inputById = new Map(players.map((p) => [p.id, p]));

    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }

    for (let i = state.pings.length - 1; i >= 0; i--) {
      const pg = state.pings[i];
      pg.radius += 540 * dt;
      pg.alpha = Math.max(0, 1 - pg.radius / pg.maxRadius);
      if (pg.radius >= pg.maxRadius) state.pings.splice(i, 1);
    }
    for (let i = state.decoys.length - 1; i >= 0; i--) {
      const dc = state.decoys[i];
      dc.x += dc.vx * dt;
      dc.y += dc.vy * dt;
      dc.alpha -= dt * 0.48;
      if (dc.alpha <= 0) state.decoys.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= 28 * dt;
      state.popups[i].alpha -= dt * 1.1;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    state.orbTimer -= dt;
    if (state.orbTimer <= 0 && state.orbs.length < 3) {
      const kind: 'flare' | 'ecto' = Math.random() < 0.5 ? 'flare' : 'ecto';
      const spots = [
        { x: 420, y: 120 },
        { x: 780, y: 120 },
        { x: 420, y: ARENA_HEIGHT - 120 },
        { x: 780, y: ARENA_HEIGHT - 120 },
        { x: 160, y: ARENA_HEIGHT / 2 },
        { x: ARENA_WIDTH - 160, y: ARENA_HEIGHT / 2 },
      ];
      const sp = spots[Math.floor(Math.random() * spots.length)];
      state.orbs.push({ id: `go_${state.nextId++}`, kind, x: sp.x, y: sp.y });
      state.orbTimer = 5.5;
    }

    const ghost = state.entities.find((e) => e.role === 'ghost');
    const hunters = state.entities.filter((e) => e.role === 'hunter');

    // Check if ghost is inside any hunter's flashlight cone
    let ghostLit = false;
    if (ghost && ghost.alive) {
      for (const h of hunters) {
        if (!h.alive) continue;
        const dx = ghost.x - h.x;
        const dy = ghost.y - h.y;
        const dist = Math.hypot(dx, dy);
        const coneDist = h.flareTimer > 0 ? 440 : 330;
        const coneAng = h.flareTimer > 0 ? 0.62 : 0.44;
        if (dist < coneDist) {
          const ang = Math.atan2(dy, dx);
          let diff = ang - h.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) < coneAng) {
            ghostLit = true;
            h.score += dt * 12;
          }
        }
      }
      ghost.revealTimer = Math.max(0, ghost.revealTimer - dt);
      const targetVis = ghostLit ? 1 : ghost.revealTimer > 0 ? 0.85 : 0.08;
      ghost.visibility += (targetVis - ghost.visibility) * Math.min(1, 8 * dt);
    }

    for (const e of state.entities) {
      if (!e.alive) continue;
      e.cdA = Math.max(0, e.cdA - dt);
      e.cdB = Math.max(0, e.cdB - dt);
      e.dashTimer = Math.max(0, e.dashTimer - dt);
      e.invulnTimer = Math.max(0, e.invulnTimer - dt);
      e.flareTimer = Math.max(0, e.flareTimer - dt);

      let dx = 0;
      let dy = 0;
      let pressA = false;
      let pressB = false;

      const inp = inputById.get(e.id);
      if (inp) {
        dx = inp.input.dx;
        dy = inp.input.dy;
        pressA = inp.input.a && !inp.prevA;
        pressB = inp.input.b && !inp.prevB;
      }

      const mag = Math.hypot(dx, dy);
      const nx = mag > 0.12 ? dx / mag : 0;
      const ny = mag > 0.12 ? dy / mag : 0;
      if (mag > 0.12) e.angle = Math.atan2(ny, nx);

      // Action A
      if (pressA && e.cdA <= 0) {
        e.cdA = CD_A;
        if (e.role === 'hunter') {
          state.nets.push({
            id: `net_${state.nextId++}`,
            ownerId: e.id,
            colorHex: e.colorHex,
            x: e.x + Math.cos(e.angle) * 22,
            y: e.y + Math.sin(e.angle) * 22,
            vx: Math.cos(e.angle) * 560,
            vy: Math.sin(e.angle) * 560,
            r: 14,
            ttl: 0.9,
          });
          sounds.push({ type: 'shoot', playerId: e.id });
          if (!e.isBot) haptics.push({ playerId: e.id, pattern: 20, reason: 'proton-net' });
        } else {
          // Phantom Strike lunge
          e.dashTimer = 0.26;
          e.revealTimer = Math.max(e.revealTimer, 1.3);
          e.vx = Math.cos(e.angle) * 680;
          e.vy = Math.sin(e.angle) * 680;
          sounds.push({ type: 'boost', playerId: e.id });
          if (!e.isBot) haptics.push({ playerId: e.id, pattern: 28, reason: 'ghost-strike' });
        }
      }

      // Action B
      if (pressB && e.cdB <= 0) {
        e.cdB = CD_B;
        if (e.role === 'hunter') {
          state.pings.push({ x: e.x, y: e.y, radius: 16, maxRadius: 480, alpha: 1 });
          if (ghost && ghost.alive) {
            ghost.revealTimer = Math.max(ghost.revealTimer, 2.2);
            state.pings.push({ x: ghost.x, y: ghost.y, radius: 10, maxRadius: 95, alpha: 1 });
          }
          sounds.push({ type: 'pulse', playerId: e.id });
          if (!e.isBot) haptics.push({ playerId: e.id, pattern: [22, 22, 28], reason: 'sonar' });
        } else {
          // Phantom Shadow Blink + spawn illusory Decoy Clone
          state.decoys.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(e.angle + Math.PI * 0.65) * 220,
            vy: Math.sin(e.angle + Math.PI * 0.65) * 220,
            alpha: 0.85,
          });
          e.dashTimer = 0.24;
          e.vx = Math.cos(e.angle) * 760;
          e.vy = Math.sin(e.angle) * 760;
          sounds.push({ type: 'boost', playerId: e.id });
          if (!e.isBot) haptics.push({ playerId: e.id, pattern: [18, 18, 25], reason: 'ghost-blink' });
        }
      }

      const slowFromLight = e.role === 'ghost' && ghostLit ? 0.82 : 1;
      const baseSpeed = e.dashTimer > 0 ? 680 : (e.role === 'ghost' ? 345 : 300) * slowFromLight;
      const tvx = e.dashTimer > 0 ? e.vx : nx * baseSpeed;
      const tvy = e.dashTimer > 0 ? e.vy : ny * baseSpeed;
      e.vx += (tvx - e.vx) * Math.min(1, 13 * dt);
      e.vy += (tvy - e.vy) * Math.min(1, 13 * dt);

      e.x = Math.max(36, Math.min(ARENA_WIDTH - 36, e.x + e.vx * dt));
      e.y = Math.max(36, Math.min(ARENA_HEIGHT - 36, e.y + e.vy * dt));
      for (const w of state.walls) resolveWall(e, PLAYER_R, w);

      // Collect Orbs
      for (let oi = state.orbs.length - 1; oi >= 0; oi--) {
        const ob = state.orbs[oi];
        if (Math.hypot(e.x - ob.x, e.y - ob.y) < PLAYER_R + 18) {
          if (ob.kind === 'flare') {
            if (e.role === 'hunter') {
              e.flareTimer = 7.0;
              e.hp = Math.min(e.maxHp, e.hp + 1);
              e.score += 50;
              if (ghost && ghost.alive) ghost.revealTimer = Math.max(ghost.revealTimer, 2.8);
              state.pings.push({ x: e.x, y: e.y, radius: 14, maxRadius: 420, alpha: 1 });
              state.popups.push({ x: e.x, y: e.y - 26, text: 'SUPER FLARE!', colorHex: '#FFB800', alpha: 1 });
            } else {
              e.score += 40;
              state.popups.push({ x: e.x, y: e.y - 26, text: 'DENIED +40', colorHex: '#C084FC', alpha: 1 });
            }
          } else {
            if (e.role === 'ghost') {
              e.hp = Math.min(e.maxHp, e.hp + 1);
              e.score += 55;
              state.popups.push({ x: e.x, y: e.y - 26, text: 'ECTO HEAL +1!', colorHex: '#C084FC', alpha: 1 });
            } else {
              e.score += 40;
              state.popups.push({ x: e.x, y: e.y - 26, text: 'ECTO +40', colorHex: '#00C2FF', alpha: 1 });
            }
          }
          state.orbs.splice(oi, 1);
          sounds.push({ type: 'pickup', playerId: e.id });
          if (!e.isBot) haptics.push({ playerId: e.id, pattern: 18, reason: 'orb-pickup' });
        }
      }

      if (e.role === 'ghost') e.score += dt * 4;

      e.cooldownA = e.cdA / CD_A;
      e.cooldownB = e.cdB / CD_B;
    }

    // Ghost strike hitting hunters
    if (ghost && ghost.alive) {
      for (const h of hunters) {
        if (!h.alive || h.invulnTimer > 0) continue;
        if (Math.hypot(ghost.x - h.x, ghost.y - h.y) < PLAYER_R * 2.15 && ghost.dashTimer > 0) {
          h.hp -= 1;
          h.invulnTimer = 1.6;
          ghost.score += 75;
          ghost.revealTimer = Math.max(ghost.revealTimer, 1.4);
          if (h.hp <= 0) {
            h.alive = false;
            ghost.score += 100;
            state.banner = `${h.name} WAS HAUNTED!`;
            state.bannerTimer = 1.6;
            sounds.push({ type: 'ko' });
            if (!h.isBot) haptics.push({ playerId: h.id, pattern: [80, 35, 80], reason: 'haunted' });
          } else {
            sounds.push({ type: 'hit' });
            if (!h.isBot) haptics.push({ playerId: h.id, pattern: [45, 25, 45], reason: 'ghost-hit' });
          }
          if (!ghost.isBot) haptics.push({ playerId: ghost.id, pattern: [30, 20, 45], reason: 'strike-land' });
        }
      }
    }

    // Update Hunter Proton Nets
    for (let i = state.nets.length - 1; i >= 0; i--) {
      const n = state.nets[i];
      n.ttl -= dt;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      const hitWall = state.walls.some(
        (w) => n.x + n.r > w.x && n.x - n.r < w.x + w.w && n.y + n.r > w.y && n.y - n.r < w.y + w.h
      );
      if (n.ttl <= 0 || hitWall || n.x < 10 || n.x > ARENA_WIDTH - 10 || n.y < 10 || n.y > ARENA_HEIGHT - 10) {
        state.nets.splice(i, 1);
        continue;
      }
      if (ghost && ghost.alive && ghost.invulnTimer <= 0 && Math.hypot(n.x - ghost.x, n.y - ghost.y) < PLAYER_R + n.r + 4) {
        ghost.hp -= 1;
        ghost.invulnTimer = 0.85;
        ghost.revealTimer = Math.max(ghost.revealTimer, 2.0);
        const owner = state.entities.find((e) => e.id === n.ownerId);
        if (owner) {
          owner.score += 80;
          if (!owner.isBot) haptics.push({ playerId: owner.id, pattern: [28, 20, 45], reason: 'net-hit' });
        }
        if (!ghost.isBot) haptics.push({ playerId: ghost.id, pattern: [55, 30, 55], reason: 'netted' });
        sounds.push({ type: 'hit' });
        state.nets.splice(i, 1);
        if (ghost.hp <= 0) {
          ghost.alive = false;
          for (const h of hunters) h.score += 120;
          sounds.push({ type: 'ko' });
        }
      }
    }

    const aliveHunters = hunters.filter((h) => h.alive).length;
    const ghostDefeated = Boolean(ghost && !ghost.alive);
    const huntersEliminated = hunters.length > 0 && aliveHunters === 0;
    const finished = ghostDefeated || huntersEliminated || state.timeLeft <= 0;
    if (finished && !ghostDefeated && ghost) {
      ghost.score += 140;
    }

    for (const p of players) {
      const e = state.entities.find((en) => en.id === p.id);
      if (!e) continue;
      hudUpdates[p.id] = {
        score: Math.round(e.score),
        alive: e.alive,
        statText: e.role === 'ghost' ? `Phantom HP ${e.hp}/${e.maxHp}` : `Hunter HP ${e.hp}/${e.maxHp}`,
        cooldownA: e.cooldownA,
        cooldownB: e.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished,
      rankings: finished ? this.getRankings(state, players) : undefined,
    };
  },

  getSnapshot(state): GhostHuntSnapshot {
    return {
      gameId: 'ghost-hunt',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      banner: state.banner,
      walls: state.walls,
      nets: state.nets.map((n) => ({ id: n.id, x: n.x, y: n.y, r: n.r, colorHex: n.colorHex })),
      pings: state.pings.map((p) => ({ ...p })),
      orbs: state.orbs.map((o) => ({ ...o })),
      decoys: state.decoys.map((d) => ({ x: d.x, y: d.y, alpha: d.alpha })),
      popups: state.popups.map((p) => ({ ...p })),
      players: state.entities.map((e) => ({
        id: e.id,
        slotIndex: e.slotIndex,
        name: e.name,
        colorHex: e.colorHex,
        isBot: e.isBot,
        role: e.role,
        x: e.x,
        y: e.y,
        angle: e.angle,
        alive: e.alive,
        hp: e.hp,
        maxHp: e.maxHp,
        visibility: e.visibility,
        dashTimer: e.dashTimer,
        flareTimer: e.flareTimer,
        score: Math.round(e.score),
        cooldownA: e.cooldownA,
        cooldownB: e.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...players]
      .map((p) => ({ p, e: state.entities.find((en) => en.id === p.id) }))
      .sort((a, b) => (b.e?.score ?? 0) - (a.e?.score ?? 0));
    return sorted.map(({ p, e }, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: p.color,
      rank: idx + 1,
      score: Math.round(e?.score ?? 0),
      highlight: e?.role === 'ghost' ? `Phantom · ${Math.round(e.score)} pts` : `Hunter · ${Math.round(e?.score ?? 0)} pts`,
    }));
  },
};

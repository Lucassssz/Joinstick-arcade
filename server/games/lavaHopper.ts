import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type LavaHopperPlayerState,
  type LavaHopperSnapshot,
  type LavaPillarState,
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

interface LavaPlayerInternal extends LavaHopperPlayerState {
  vz: number;
}

interface LavaHopperState {
  timeLeft: number;
  totalTime: number;
  wave: number;
  waveTimer: number;
  fireballSpawnTimer: number;
  nextFireballId: number;
  pillars: LavaPillarState[];
  fireballs: { id: string; x: number; y: number; vx: number; vy: number; r: number }[];
  stompWaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: LavaPlayerInternal[];
  finished: boolean;
}

function buildPillars(): LavaPillarState[] {
  const pillars: LavaPillarState[] = [];
  const cols = 5;
  const rows = 3;
  const spacingX = 148;
  const spacingY = 122;
  const startX = ARENA_WIDTH / 2 - ((cols - 1) * spacingX) / 2;
  const startY = ARENA_HEIGHT / 2 - ((rows - 1) * spacingY) / 2 + 16;
  let id = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pillars.push({
        id: id++,
        x: startX + c * spacingX,
        y: startY + r * spacingY,
        r: 56,
        state: 'safe',
        timer: 0,
        hasGem: (r + c) % 3 === 0,
      });
    }
  }
  return pillars;
}

export const lavaHopperModule: ServerGameModule<LavaHopperState> = {
  id: 'lava-hopper',

  createState(players: ServerPlayerInputState[], settingValue: number): LavaHopperState {
    const duration = settingValue || 60;
    const pillars = buildPillars();
    const pStates: LavaPlayerInternal[] = players.map((p, idx) => {
      const startPillar = pillars[(idx * 2 + 2) % pillars.length];
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        x: startPillar.x,
        y: startPillar.y,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        angle: 0,
        alive: true,
        leapTimer: 0,
        leapDuration: 0.48,
        stompTimer: 0,
        respawnTimer: 0,
        gems: 0,
        kos: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
      };
    });

    return {
      timeLeft: duration,
      totalTime: duration,
      wave: 1,
      waveTimer: 3.6,
      fireballSpawnTimer: 2.2,
      nextFireballId: 1,
      pillars,
      fireballs: [],
      stompWaves: [],
      popups: [],
      players: pStates,
      finished: false,
    };
  },

  step(state: LavaHopperState, players: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const inputMap = new Map(players.map((p) => [p.id, p]));

    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) state.finished = true;

    for (let i = state.stompWaves.length - 1; i >= 0; i--) {
      const sw = state.stompWaves[i];
      sw.radius += dt * 290;
      sw.alpha -= dt * 1.9;
      if (sw.alpha <= 0) state.stompWaves.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= dt * 34;
      state.popups[i].alpha -= dt * 1.05;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    // Pillar sink & rise cycle (always keeps at least 6 safe pillars)
    state.waveTimer -= dt;
    if (state.waveTimer <= 0) {
      state.wave += 1;
      state.waveTimer = Math.max(2.4, 4.4 - state.wave * 0.16);
      const safeList = state.pillars.filter((pl) => pl.state === 'safe');
      const toWarn = Math.min(Math.max(0, safeList.length - 6), Math.min(4, 2 + Math.floor(state.wave / 3)));
      for (let i = 0; i < toWarn; i++) {
        const pickIdx = Math.floor(Math.random() * safeList.length);
        const pl = safeList.splice(pickIdx, 1)[0];
        if (pl) {
          pl.state = 'warning';
          pl.timer = 2.4;
        }
      }
      for (let i = 0; i < 2; i++) {
        const gemTarget = state.pillars[Math.floor(Math.random() * state.pillars.length)];
        if (gemTarget && gemTarget.state === 'safe') gemTarget.hasGem = true;
      }
    }

    for (const pl of state.pillars) {
      if (pl.state === 'warning') {
        pl.timer -= dt;
        if (pl.timer <= 0) {
          pl.state = 'sunk';
          pl.hasGem = false;
          pl.timer = 3.8;
        }
      } else if (pl.state === 'sunk') {
        pl.timer -= dt;
        if (pl.timer <= 0) {
          pl.state = 'safe';
          pl.timer = 0;
          pl.hasGem = Math.random() < 0.45;
        }
      }
    }

    // Fireball spawner
    state.fireballSpawnTimer -= dt;
    if (state.fireballSpawnTimer <= 0) {
      state.fireballSpawnTimer = Math.max(1.25, 2.5 - state.wave * 0.08);
      const fromLeft = Math.random() < 0.5;
      const startX = fromLeft ? 95 : ARENA_WIDTH - 95;
      const startY = 170 + Math.random() * (ARENA_HEIGHT - 300);
      const spd = 165 + state.wave * 8;
      state.fireballs.push({
        id: `fb-${state.nextFireballId++}`,
        x: startX,
        y: startY,
        vx: (fromLeft ? 1 : -1) * spd,
        vy: (Math.random() - 0.5) * 65,
        r: 17,
      });
    }

    for (let i = state.fireballs.length - 1; i >= 0; i--) {
      const fb = state.fireballs[i];
      fb.x += fb.vx * dt;
      fb.y += fb.vy * dt;
      if (fb.x < 40 || fb.x > ARENA_WIDTH - 40 || fb.y < 60 || fb.y > ARENA_HEIGHT - 40) {
        state.fireballs.splice(i, 1);
      }
    }

    let aliveCount = 0;
    for (const p of state.players) {
      if (!p.alive) continue;
      aliveCount++;
      p.score += Math.round(dt * 14);
      p.cooldownA = Math.max(0, p.cooldownA - dt * 1.45);
      p.cooldownB = Math.max(0, p.cooldownB - dt * 0.75);
      p.leapTimer = Math.max(0, p.leapTimer - dt);
      p.stompTimer = Math.max(0, p.stompTimer - dt);

      const inp = inputMap.get(p.id);
      const dx = inp?.input.dx ?? 0;
      const dy = inp?.input.dy ?? 0;
      const justA = Boolean(inp && inp.input.a && !inp.prevA);
      const justB = Boolean(inp && inp.input.b && !inp.prevB);

      const speed = p.z > 2 ? 320 : 255;
      p.vx = p.vx * 0.8 + dx * speed * 0.2;
      p.vy = p.vy * 0.8 + dy * speed * 0.2;
      if (Math.hypot(dx, dy) > 0.15) {
        p.angle = Math.atan2(dy, dx);
      }

      // Action A: Volcano Leap across gaps
      if (justA && p.cooldownA <= 0 && p.z <= 8) {
        p.cooldownA = 1;
        p.leapTimer = 0.48;
        p.vz = 275;
        p.z = 6;
        let leapDirX = dx;
        let leapDirY = dy;
        if (Math.hypot(leapDirX, leapDirY) < 0.2) {
          const safe = state.pillars
            .filter((pl) => pl.state === 'safe' && Math.hypot(pl.x - p.x, pl.y - p.y) > 45)
            .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
          if (safe) {
            const d = Math.hypot(safe.x - p.x, safe.y - p.y) || 1;
            leapDirX = (safe.x - p.x) / d;
            leapDirY = (safe.y - p.y) / d;
          } else {
            leapDirX = Math.cos(p.angle);
            leapDirY = Math.sin(p.angle);
          }
        }
        const len = Math.hypot(leapDirX, leapDirY) || 1;
        p.vx = (leapDirX / len) * 290;
        p.vy = (leapDirY / len) * 290;
        sounds.push({ type: 'boost', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: 22, reason: 'lava-leap' });
      }

      // Action B: Seismic Stomp Knockback + Fireball Deflect
      if (justB && p.cooldownB <= 0) {
        p.cooldownB = 1;
        p.stompTimer = 0.35;
        state.stompWaves.push({
          x: p.x,
          y: p.y,
          radius: 18,
          maxRadius: 155,
          colorHex: p.colorHex,
          alpha: 1,
        });
        sounds.push({ type: 'pulse', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: [30, 18, 40], reason: 'lava-stomp' });

        for (let fi = state.fireballs.length - 1; fi >= 0; fi--) {
          const fb = state.fireballs[fi];
          if (Math.hypot(fb.x - p.x, fb.y - p.y) < 145) {
            state.fireballs.splice(fi, 1);
            p.score += 20;
            state.popups.push({ x: fb.x, y: fb.y - 16, text: '+20 BLOCK', colorHex: '#00C2FF', alpha: 1 });
          }
        }

        for (const other of state.players) {
          if (other.id === p.id || !other.alive) continue;
          const dist = Math.hypot(other.x - p.x, other.y - p.y);
          if (dist < 150 && dist > 1) {
            const nx = (other.x - p.x) / dist;
            const ny = (other.y - p.y) / dist;
            other.vx += nx * 360;
            other.vy += ny * 360;
            other.vz = Math.max(other.vz, 130);
            p.score += 25;
          }
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = Math.max(95, Math.min(ARENA_WIDTH - 95, p.x));
      p.y = Math.max(100, Math.min(ARENA_HEIGHT - 80, p.y));

      if (p.z > 0 || p.vz > 0) {
        p.z += p.vz * dt;
        p.vz -= 620 * dt;
        if (p.z <= 0) {
          p.z = 0;
          p.vz = 0;
        }
      }

      const onPillar = state.pillars.find(
        (pl) => pl.state !== 'sunk' && Math.hypot(pl.x - p.x, pl.y - p.y) <= pl.r + 12
      );

      if (onPillar && onPillar.hasGem && p.z < 46) {
        onPillar.hasGem = false;
        p.gems += 1;
        p.score += 35;
        state.popups.push({
          x: onPillar.x,
          y: onPillar.y - 26,
          text: '+35 GEM!',
          colorHex: '#FFB800',
          alpha: 1,
        });
        sounds.push({ type: 'pickup', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: 18, reason: 'lava-gem' });
      }

      for (const fb of state.fireballs) {
        const d = Math.hypot(fb.x - p.x, fb.y - p.y);
        if (d < fb.r + 20 && p.z < 36) {
          const nx = (p.x - fb.x) / (d || 1);
          const ny = (p.y - fb.y) / (d || 1);
          p.vx += nx * 340;
          p.vy += ny * 340;
          sounds.push({ type: 'hit', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 40, reason: 'lava-fireball' });
        }
      }

      if (p.z <= 1 && !onPillar) {
        p.alive = false;
        aliveCount--;
        state.popups.push({
          x: p.x,
          y: p.y - 20,
          text: 'LAVA KO!',
          colorHex: '#FF4D2E',
          alpha: 1,
        });
        sounds.push({ type: 'ko', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: [50, 25, 50], reason: 'lava-ko' });
      }
    }

    if (state.players.length > 1 && aliveCount <= 1) {
      state.finished = true;
    } else if (state.players.length === 1 && aliveCount === 0) {
      state.finished = true;
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: p.score,
        alive: p.alive,
        statText: p.alive
          ? `Wave ${state.wave} · ${p.gems} Gems · ${p.score} pts`
          : `Fell in Lava · ${p.score} pts`,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },

  getSnapshot(state: LavaHopperState): LavaHopperSnapshot {
    return {
      gameId: 'lava-hopper',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      wave: state.wave,
      pillars: state.pillars,
      fireballs: state.fireballs,
      stompWaves: state.stompWaves,
      popups: state.popups,
      players: state.players.map(({ vz: _vz, ...rest }) => rest),
    };
  },

  getRankings(state: LavaHopperState, players: ServerPlayerInputState[]): RankingEntry[] {
    const colorMap = new Map(players.map((p) => [p.id, p.color]));
    const sorted = [...state.players].sort((a, b) => Number(b.alive) - Number(a.alive) || b.score - a.score);
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: colorMap.get(p.id)!,
      rank: idx + 1,
      score: p.score,
      highlight: `${p.alive ? 'Volcano Survivor' : 'Melted'} · ${p.gems} Fire Gems`,
    }));
  },
};

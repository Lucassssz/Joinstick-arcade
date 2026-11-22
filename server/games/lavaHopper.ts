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

interface LavaHopperState {
  timeLeft: number;
  totalTime: number;
  wave: number;
  waveTimer: number;
  fireballSpawnTimer: number;
  pillars: LavaPillarState[];
  fireballs: { id: string; x: number; y: number; vx: number; vy: number; r: number }[];
  stompWaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: LavaHopperPlayerState[];
  finished: boolean;
}

function buildLavaPillars(): LavaPillarState[] {
  const pillars: LavaPillarState[] = [];
  const cols = 5;
  const rows = 3;
  let id = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offsetX = r % 2 === 1 ? 35 : -35;
      const x = 210 + c * 195 + offsetX;
      const y = 175 + r * 185;
      pillars.push({
        id: id++,
        x,
        y,
        r: r === 1 && c === 2 ? 78 : 66,
        state: 'safe',
        timer: 4 + Math.random() * 5,
        hasGem: (id + r) % 4 === 0,
      });
    }
  }
  return pillars;
}

export const lavaHopperModule: ServerGameModule<LavaHopperState> = {
  id: 'lava-hopper',

  createState(players: ServerPlayerInputState[], settingValue: number): LavaHopperState {
    const totalTime = settingValue || 60;
    const pillars = buildLavaPillars();
    const pStates: LavaHopperPlayerState[] = players.map((p, idx) => {
      const homePillar = pillars[idx % pillars.length];
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        x: homePillar.x + ((idx % 2) - 0.5) * 22,
        y: homePillar.y + (Math.floor(idx / 2) % 2 - 0.5) * 20,
        vx: 0,
        vy: 0,
        z: 0,
        angle: 0,
        alive: true,
        leapTimer: 0,
        leapDuration: 0.52,
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
      timeLeft: totalTime,
      totalTime,
      wave: 1,
      waveTimer: 7.5,
      fireballSpawnTimer: 3.2,
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
    if (state.timeLeft <= 0) {
      state.finished = true;
    }

    for (let i = state.stompWaves.length - 1; i >= 0; i--) {
      state.stompWaves[i].radius += dt * 270;
      state.stompWaves[i].alpha -= dt * 2.0;
      if (state.stompWaves[i].alpha <= 0) state.stompWaves.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= dt * 34;
      state.popups[i].alpha -= dt * 1.1;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    // Pillar sink/rise cycle (always keep at least 7 pillars safe!)
    state.waveTimer -= dt;
    if (state.waveTimer <= 0) {
      state.wave += 1;
      state.waveTimer = Math.max(4.5, 7.5 - state.wave * 0.35);
      const safePillars = state.pillars.filter((pl) => pl.state === 'safe');
      const sinkCount = Math.min(3, Math.max(1, safePillars.length - 7));
      for (let k = 0; k < sinkCount; k++) {
        const pick = safePillars[Math.floor(Math.random() * safePillars.length)];
        if (pick && pick.state === 'safe') {
          pick.state = 'warning';
          pick.timer = 2.4;
        }
      }
      // Spawn a fresh gem on a safe pillar
      const gemCandidates = state.pillars.filter((pl) => pl.state === 'safe' && !pl.hasGem);
      if (gemCandidates.length > 0) {
        gemCandidates[Math.floor(Math.random() * gemCandidates.length)].hasGem = true;
      }
    }

    for (const pl of state.pillars) {
      if (pl.state === 'warning') {
        pl.timer -= dt;
        if (pl.timer <= 0) {
          pl.state = 'sunk';
          pl.timer = 3.6;
          pl.hasGem = false;
        }
      } else if (pl.state === 'sunk') {
        pl.timer -= dt;
        if (pl.timer <= 0) {
          pl.state = 'safe';
          pl.timer = 5;
          if (Math.random() < 0.35) pl.hasGem = true;
        }
      }
    }

    // Spawn occasional magma fireballs
    state.fireballSpawnTimer -= dt;
    if (state.fireballSpawnTimer <= 0) {
      state.fireballSpawnTimer = Math.max(1.8, 3.3 - state.wave * 0.15);
      const fromLeft = Math.random() < 0.5;
      const y = 140 + Math.random() * (ARENA_HEIGHT - 280);
      state.fireballs.push({
        id: `fb_${Date.now()}_${Math.random()}`,
        x: fromLeft ? 40 : ARENA_WIDTH - 40,
        y,
        vx: (fromLeft ? 1 : -1) * (190 + state.wave * 12),
        vy: (Math.random() - 0.5) * 65,
        r: 16,
      });
    }

    for (let i = state.fireballs.length - 1; i >= 0; i--) {
      const fb = state.fireballs[i];
      fb.x += fb.vx * dt;
      fb.y += fb.vy * dt;
      if (fb.x < -40 || fb.x > ARENA_WIDTH + 40 || fb.y < -40 || fb.y > ARENA_HEIGHT + 40) {
        state.fireballs.splice(i, 1);
      }
    }

    // Update players
    for (const p of state.players) {
      const inp = inputMap.get(p.id);
      p.cooldownA = Math.max(0, p.cooldownA - dt * 1.15);
      p.cooldownB = Math.max(0, p.cooldownB - dt * 0.75);
      p.stompTimer = Math.max(0, p.stompTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          const safe = state.pillars.filter((pl) => pl.state === 'safe');
          const spawnPillar = safe[Math.floor(Math.random() * safe.length)] ?? state.pillars[0];
          p.x = spawnPillar.x;
          p.y = spawnPillar.y;
          p.vx = 0;
          p.vy = 0;
          p.z = 0;
          p.alive = true;
        }
        continue;
      }

      // Passive survival points
      p.score += dt * 8;

      const dx = inp?.input.dx ?? 0;
      const dy = inp?.input.dy ?? 0;
      const justA = Boolean(inp && inp.input.a && !inp.prevA);
      const justB = Boolean(inp && inp.input.b && !inp.prevB);

      if (Math.hypot(dx, dy) > 0.15) {
        p.angle = Math.atan2(dy, dx);
      }

      // Action A: Leap across gaps
      if (justA && p.cooldownA <= 0 && p.leapTimer <= 0) {
        p.cooldownA = 1;
        p.leapTimer = p.leapDuration;
        const jumpSpeed = 355;
        p.vx = Math.cos(p.angle) * jumpSpeed;
        p.vy = Math.sin(p.angle) * jumpSpeed;
        sounds.push({ type: 'boost', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: 22, reason: 'lava-leap' });
      }

      if (p.leapTimer > 0) {
        p.leapTimer = Math.max(0, p.leapTimer - dt);
        const phase = 1 - p.leapTimer / p.leapDuration;
        p.z = Math.sin(phase * Math.PI) * 44;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else {
        p.z = 0;
        const walkSpeed = 205;
        p.vx = p.vx * 0.8 + dx * walkSpeed * 0.2;
        p.vy = p.vy * 0.8 + dy * walkSpeed * 0.2;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      p.x = Math.max(60, Math.min(ARENA_WIDTH - 60, p.x));
      p.y = Math.max(90, Math.min(ARENA_HEIGHT - 80, p.y));

      // Action B: Shockwave Stomp
      if (justB && p.cooldownB <= 0) {
        p.cooldownB = 1;
        p.stompTimer = 0.35;
        state.stompWaves.push({
          x: p.x,
          y: p.y,
          radius: 18,
          maxRadius: 118,
          colorHex: p.colorHex,
          alpha: 1,
        });
        sounds.push({ type: 'pulse', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: [32, 18, 48], reason: 'lava-stomp' });

        for (const other of state.players) {
          if (other.id === p.id || !other.alive || other.leapTimer > 0) continue;
          const dist = Math.hypot(other.x - p.x, other.y - p.y);
          if (dist < 115) {
            const pushAngle = Math.atan2(other.y - p.y, other.x - p.x);
            other.x += Math.cos(pushAngle) * 58;
            other.y += Math.sin(pushAngle) * 58;
            p.kos += 1;
            p.score += 35;
            state.popups.push({
              x: other.x,
              y: other.y - 24,
              text: 'STOMPED! +35',
              colorHex: p.colorHex,
              alpha: 1,
            });
          }
        }
      }

      // Check pillar footing & gem pickup when on the ground
      if (p.leapTimer <= 0) {
        let onSolidPillar = false;
        for (const pl of state.pillars) {
          if (pl.state === 'sunk') continue;
          const d = Math.hypot(p.x - pl.x, p.y - pl.y);
          if (d <= pl.r + 6) {
            onSolidPillar = true;
            if (pl.hasGem && d <= 36) {
              pl.hasGem = false;
              p.gems += 1;
              p.score += 60;
              state.popups.push({
                x: pl.x,
                y: pl.y - 22,
                text: '+60 FIRE GEM!',
                colorHex: '#FFB800',
                alpha: 1,
              });
              sounds.push({ type: 'pickup', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: 28, reason: 'gem' });
            }
            break;
          }
        }

        // Check fireball hit
        for (let fi = state.fireballs.length - 1; fi >= 0; fi--) {
          const fb = state.fireballs[fi];
          if (Math.hypot(fb.x - p.x, fb.y - p.y) < fb.r + 18) {
            const ang = Math.atan2(p.y - fb.y, p.x - fb.x);
            p.x += Math.cos(ang) * 54;
            p.y += Math.sin(ang) * 54;
            state.fireballs.splice(fi, 1);
            sounds.push({ type: 'hit', playerId: p.id });
          }
        }

        if (!onSolidPillar) {
          p.alive = false;
          p.respawnTimer = 1.75;
          state.popups.push({
            x: p.x,
            y: p.y,
            text: 'SIZZLED!',
            colorHex: '#FF4D2E',
            alpha: 1,
          });
          sounds.push({ type: 'ko', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: [50, 30, 75], reason: 'lava-burn' });
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      const roundedScore = Math.round(p.score);
      hudUpdates[p.id] = {
        score: roundedScore,
        alive: p.alive,
        statText: `${roundedScore} pts · 💎 ${p.gems}`,
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
      players: state.players.map((p) => ({ ...p, score: Math.round(p.score) })),
    };
  },

  getRankings(state: LavaHopperState, players: ServerPlayerInputState[]): RankingEntry[] {
    const colorMap = new Map(players.map((p) => [p.id, p.color]));
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: colorMap.get(p.id)!,
      rank: idx + 1,
      score: Math.round(p.score),
      highlight: `${p.gems} Fire Gems · ${p.kos} Stomps`,
    }));
  },
};

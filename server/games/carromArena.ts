import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type CarromArenaSnapshot,
  type CarromPlayerState,
  type CarromPuckState,
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

interface CarromArenaState {
  round: number;
  totalRounds: number;
  turnIndex: number;
  phase: 'aiming' | 'sliding';
  turnTimeLeft: number;
  slideTimer: number;
  striker: { x: number; y: number; vx: number; vy: number; r: number; colorHex: string; spin: boolean };
  pucks: CarromPuckState[];
  pockets: { x: number; y: number; r: number }[];
  banner: string | null;
  eventText: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: CarromPlayerState[];
  finished: boolean;
}

const BOARD_CX = ARENA_WIDTH / 2;
const BOARD_CY = ARENA_HEIGHT / 2 + 12;
const BOARD_HALF = 235;
const TURN_TIMEOUT = 13;

function buildCarromPucks(): CarromPuckState[] {
  const pucks: CarromPuckState[] = [
    {
      id: 'queen',
      kind: 'queen',
      x: BOARD_CX,
      y: BOARD_CY,
      vx: 0,
      vy: 0,
      r: 15,
      value: 50,
    },
  ];
  const innerCount = 6;
  for (let i = 0; i < innerCount; i++) {
    const a = (i / innerCount) * Math.PI * 2;
    const kind = i % 2 === 0 ? 'gold' : 'silver';
    pucks.push({
      id: `in-${i}`,
      kind,
      x: BOARD_CX + Math.cos(a) * 34,
      y: BOARD_CY + Math.sin(a) * 34,
      vx: 0,
      vy: 0,
      r: 14,
      value: kind === 'gold' ? 20 : 10,
    });
  }
  const outerCount = 10;
  for (let i = 0; i < outerCount; i++) {
    const a = (i / outerCount) * Math.PI * 2 + 0.25;
    const kind = i % 2 === 0 ? 'gold' : 'silver';
    pucks.push({
      id: `out-${i}`,
      kind,
      x: BOARD_CX + Math.cos(a) * 66,
      y: BOARD_CY + Math.sin(a) * 66,
      vx: 0,
      vy: 0,
      r: 14,
      value: kind === 'gold' ? 20 : 10,
    });
  }
  return pucks;
}

function positionStrikerForPlayer(state: CarromArenaState, player: CarromPlayerState): void {
  const baselineY = BOARD_CY + BOARD_HALF - 46;
  state.striker = {
    x: BOARD_CX + player.strikerOffset * 135,
    y: baselineY,
    vx: 0,
    vy: 0,
    r: 19,
    colorHex: player.colorHex,
    spin: false,
  };
}

export const carromArenaModule: ServerGameModule<CarromArenaState> = {
  id: 'carrom-arena',

  createState(players: ServerPlayerInputState[], settingValue: number): CarromArenaState {
    const totalRounds = settingValue || 8;
    const pOffset = BOARD_HALF - 22;
    const pockets = [
      { x: BOARD_CX - pOffset, y: BOARD_CY - pOffset, r: 27 },
      { x: BOARD_CX + pOffset, y: BOARD_CY - pOffset, r: 27 },
      { x: BOARD_CX - pOffset, y: BOARD_CY + pOffset, r: 27 },
      { x: BOARD_CX + pOffset, y: BOARD_CY + pOffset, r: 27 },
    ];

    const carromPlayers: CarromPlayerState[] = players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: p.isBot,
      aimAngle: -Math.PI / 2,
      strikerOffset: 0,
      pocketed: 0,
      queensPocketed: 0,
      spinCharges: 2,
      score: 0,
      cooldownA: 0,
      cooldownB: 0,
    }));

    const state: CarromArenaState = {
      round: 1,
      totalRounds,
      turnIndex: 0,
      phase: 'aiming',
      turnTimeLeft: TURN_TIMEOUT,
      slideTimer: 0,
      striker: {
        x: BOARD_CX,
        y: BOARD_CY + BOARD_HALF - 46,
        vx: 0,
        vy: 0,
        r: 19,
        colorHex: carromPlayers[0]?.colorHex ?? '#FFB800',
        spin: false,
      },
      pucks: buildCarromPucks(),
      pockets,
      banner: null,
      eventText: carromPlayers[0] ? `${carromPlayers[0].name}'s Turn — Aim & Press A to Flick Striker!` : null,
      popups: [],
      players: carromPlayers,
      finished: false,
    };
    if (carromPlayers[0]) positionStrikerForPlayer(state, carromPlayers[0]);
    return state;
  },

  step(state: CarromArenaState, players: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= dt * 32;
      state.popups[i].alpha -= dt * 1.05;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    if (state.players.length === 0) state.finished = true;

    if (!state.finished) {
      const active = state.players[state.turnIndex];
      const inp = players.find((p) => p.id === active.id);
      const justA = Boolean(inp && inp.input.a && !inp.prevA);
      const justB = Boolean(inp && inp.input.b && !inp.prevB);

      if (state.phase === 'aiming') {
        state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);

        if (inp) {
          // Left/Right adjusts aim angle, Up/Down slides striker along baseline
          active.aimAngle += inp.input.dx * dt * 1.95;
          active.strikerOffset = Math.max(
            -1,
            Math.min(1, active.strikerOffset + inp.input.dy * dt * 1.4)
          );
          positionStrikerForPlayer(state, active);
        }

        const fireStriker = (power: number, spin: boolean) => {
          state.phase = 'sliding';
          state.slideTimer = 3.2;
          state.striker.vx = Math.cos(active.aimAngle) * power;
          state.striker.vy = Math.sin(active.aimAngle) * power;
          state.striker.spin = spin;
          state.banner = spin ? 'POWER SPIN SHOT!' : null;
          state.eventText = `${active.name} launched the Carrom Striker!`;
          sounds.push({ type: spin ? 'boost' : 'confirm', playerId: active.id });
          haptics.push({ playerId: active.id, pattern: spin ? [35, 20, 45] : 24, reason: 'carrom-flick' });
        };

        if (justB && active.spinCharges > 0) {
          active.spinCharges--;
          fireStriker(880, true);
        } else if (justA || state.turnTimeLeft <= 0) {
          fireStriker(670, false);
        }
      } else if (state.phase === 'sliding') {
        state.slideTimer -= dt;
        const minX = BOARD_CX - BOARD_HALF + 18;
        const maxX = BOARD_CX + BOARD_HALF - 18;
        const minY = BOARD_CY - BOARD_HALF + 18;
        const maxY = BOARD_CY + BOARD_HALF - 18;

        // Move striker & pucks with sub-steps for crisp collisions
        const bodies = [state.striker, ...state.pucks];
        const drag = Math.pow(0.22, dt);

        for (const b of bodies) {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vx *= drag;
          b.vy *= drag;

          if (b.x - b.r < minX) {
            b.x = minX + b.r;
            b.vx = Math.abs(b.vx) * 0.85;
          } else if (b.x + b.r > maxX) {
            b.x = maxX - b.r;
            b.vx = -Math.abs(b.vx) * 0.85;
          }
          if (b.y - b.r < minY) {
            b.y = minY + b.r;
            b.vy = Math.abs(b.vy) * 0.85;
          } else if (b.y + b.r > maxY) {
            b.y = maxY - b.r;
            b.vy = -Math.abs(b.vy) * 0.85;
          }
        }

        // Elastic disc-to-disc collisions
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i];
            const b = bodies[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            const minDist = a.r + b.r;
            if (dist > 0 && dist < minDist) {
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = (minDist - dist) * 0.52;
              a.x -= nx * overlap;
              a.y -= ny * overlap;
              b.x += nx * overlap;
              b.y += ny * overlap;

              const dvx = a.vx - b.vx;
              const dvy = a.vy - b.vy;
              const rel = dvx * nx + dvy * ny;
              if (rel > 0) {
                const boost = i === 0 && state.striker.spin ? 1.18 : 0.96;
                a.vx -= rel * nx * 0.9;
                a.vy -= rel * ny * 0.9;
                b.vx += rel * nx * boost;
                b.vy += rel * ny * boost;
                sounds.push({ type: 'bump', playerId: active.id });
              }
            }
          }
        }

        // Check pocketed pucks
        for (let i = state.pucks.length - 1; i >= 0; i--) {
          const puck = state.pucks[i];
          const hitPocket = state.pockets.find(
            (pk) => Math.hypot(puck.x - pk.x, puck.y - pk.y) < pk.r + 4
          );
          if (hitPocket) {
            state.pucks.splice(i, 1);
            active.pocketed++;
            active.score += puck.value;
            if (puck.kind === 'queen') {
              active.queensPocketed++;
              state.banner = '👑 RED QUEEN POCKETED! +50';
              state.eventText = `👑 ${active.name} sank the Red Queen Puck (+50 pts)!`;
              sounds.push({ type: 'lap', playerId: active.id });
            } else {
              state.banner = `POCKETED +${puck.value}!`;
              state.eventText = `${active.name} pocketed a ${puck.kind.toUpperCase()} puck (+${puck.value} pts)!`;
              sounds.push({ type: 'pickup', playerId: active.id });
            }
            state.popups.push({
              x: hitPocket.x,
              y: hitPocket.y - 12,
              text: `+${puck.value}`,
              colorHex: puck.kind === 'queen' ? '#FF3B9A' : '#FFB800',
              alpha: 1,
            });
            haptics.push({ playerId: active.id, pattern: [30, 20, 45], reason: 'carrom-pocket' });
          }
        }

        const totalMotion = bodies.reduce((acc, b) => acc + Math.hypot(b.vx, b.vy), 0);
        if (totalMotion < 18 || state.slideTimer <= 0) {
          if (state.pucks.length === 0) {
            state.finished = true;
            state.banner = 'ALL PUCKS POCKETED!';
            sounds.push({ type: 'win' });
          } else {
            state.turnIndex = (state.turnIndex + 1) % state.players.length;
            if (state.turnIndex === 0) {
              state.round++;
              if (state.round > state.totalRounds) {
                state.finished = true;
                state.banner = 'CARROM MATCH COMPLETE!';
                sounds.push({ type: 'win' });
              }
            }
            if (!state.finished) {
              state.phase = 'aiming';
              state.turnTimeLeft = TURN_TIMEOUT;
              const nextP = state.players[state.turnIndex];
              positionStrikerForPlayer(state, nextP);
              state.eventText = `${nextP.name}'s Turn — Aim & Flick Striker!`;
            }
          }
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const activePlayer = state.players[state.turnIndex];
    for (const p of state.players) {
      const isTurn = activePlayer && p.id === activePlayer.id && !state.finished;
      p.cooldownA = isTurn && state.phase === 'aiming' ? 0 : 1;
      p.cooldownB = isTurn && state.phase === 'aiming' && p.spinCharges > 0 ? 0 : 1;
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: isTurn
          ? `YOUR TURN · ${p.pocketed} Pocketed · ${p.score} pts`
          : `${p.pocketed} Pocketed · ${p.score} pts`,
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

  getSnapshot(state: CarromArenaState): CarromArenaSnapshot {
    return {
      gameId: 'carrom-arena',
      round: Math.min(state.round, state.totalRounds),
      totalRounds: state.totalRounds,
      activePlayerId: state.players[state.turnIndex]?.id ?? '',
      phase: state.phase,
      turnTimeLeft: state.turnTimeLeft,
      striker: { ...state.striker },
      pucks: state.pucks.map((pk) => ({ ...pk })),
      pockets: state.pockets,
      banner: state.banner,
      eventText: state.eventText,
      popups: state.popups,
      players: state.players.map((p) => ({ ...p })),
    };
  },

  getRankings(state: CarromArenaState, players: ServerPlayerInputState[]): RankingEntry[] {
    const colorMap = new Map(players.map((p) => [p.id, p.color]));
    const sorted = [...state.players].sort((a, b) => b.score - a.score || b.pocketed - a.pocketed);
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: colorMap.get(p.id)!,
      rank: idx + 1,
      score: p.score,
      highlight: `${p.pocketed} Pucks Pocketed · ${p.queensPocketed} Queens`,
    }));
  },
};

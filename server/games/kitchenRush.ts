import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type DishKind,
  type KitchenOrderState,
  type KitchenPlayerState,
  type KitchenRushSnapshot,
  type KitchenStationState,
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

interface FlyingPlate {
  id: string;
  ownerId: string;
  dish: DishKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  colorHex: string;
  life: number;
}

interface InternalChef extends KitchenPlayerState {
  dashCd: number;
  bootsTimer: number;
  combo: number;
  comboTimer: number;
}

interface KitchenState {
  timeLeft: number;
  totalTime: number;
  orders: KitchenOrderState[];
  stations: KitchenStationState[];
  flyingPlates: FlyingPlate[];
  boots: { id: string; x: number; y: number }[];
  bootsSpawnTimer: number;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: InternalChef[];
  nextId: number;
  finished: boolean;
}

const DISHES: DishKind[] = ['burger', 'pizza', 'taco'];

function makeOrder(nextId: number): KitchenOrderState {
  const dish = DISHES[Math.floor(Math.random() * DISHES.length)];
  const vip = Math.random() < 0.32;
  return {
    id: `ord_${nextId}`,
    dish,
    timeLeft: vip ? 20 : 24,
    maxTime: vip ? 20 : 24,
    points: vip ? 220 : 120,
    vip,
  };
}

function buildStations(): KitchenStationState[] {
  return [
    { id: 'raw_burger', kind: 'raw-burger', x: 96, y: 145, w: 112, h: 96, cookingDish: null, cookProgress: 0, cookOwnerId: null },
    { id: 'raw_pizza', kind: 'raw-pizza', x: 96, y: 342, w: 112, h: 96, cookingDish: null, cookProgress: 0, cookOwnerId: null },
    { id: 'raw_taco', kind: 'raw-taco', x: 96, y: 538, w: 112, h: 96, cookingDish: null, cookProgress: 0, cookOwnerId: null },
    { id: 'grill_1', kind: 'grill', x: 528, y: 155, w: 138, h: 86, cookingDish: null, cookProgress: 0, cookOwnerId: null },
    { id: 'grill_2', kind: 'grill', x: 528, y: 348, w: 138, h: 86, cookingDish: null, cookProgress: 0, cookOwnerId: null },
    { id: 'grill_3', kind: 'grill', x: 528, y: 540, w: 138, h: 86, cookingDish: null, cookProgress: 0, cookOwnerId: null },
    { id: 'serve_1', kind: 'serve', x: 985, y: 230, w: 126, h: 310, cookingDish: null, cookProgress: 0, cookOwnerId: null },
  ];
}

function scoreDish(
  state: KitchenState,
  chef: InternalChef,
  dish: DishKind,
  x: number,
  y: number,
  sounds: SoundEvent[],
  haptics: HapticTrigger[]
): void {
  const ordIdx = state.orders.findIndex((o) => o.dish === dish);
  let pts = 65;
  let isVip = false;
  if (ordIdx !== -1) {
    const ord = state.orders[ordIdx];
    isVip = Boolean(ord.vip);
    const speedBonus = Math.round((ord.timeLeft / ord.maxTime) * 60);
    pts = ord.points + speedBonus;
    state.orders.splice(ordIdx, 1);
    state.orders.push(makeOrder(state.nextId++));
  }
  chef.combo = chef.comboTimer > 0 ? Math.min(4, chef.combo + 1) : 1;
  chef.comboTimer = 11;
  const streakTip = (chef.combo - 1) * 35;
  const totalPts = pts + streakTip;
  chef.score += totalPts;
  chef.served++;
  const tag = isVip ? `VIP +${totalPts}!` : chef.combo > 1 ? `+${totalPts} x${chef.combo}!` : `+${totalPts}!`;
  state.popups.push({ x, y: y - 16, text: tag, colorHex: isVip ? '#FFB800' : '#10D98B', alpha: 1 });
  sounds.push({ type: isVip ? 'win' : 'pickup', playerId: chef.id });
  haptics.push({ playerId: chef.id, pattern: [18, 20, 30], reason: 'served' });
}

export const kitchenRushModule: ServerGameModule<KitchenState> = {
  id: 'kitchen-rush',

  createState(players, settingValue) {
    const totalTime = Math.max(45, Math.min(120, settingValue || 75));
    const list: InternalChef[] = players.map((p, idx) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x: 340 + (idx % 2) * 50,
      y: 230 + ((idx * 68) % 340),
      angle: 0,
      holding: null,
      dashTimer: 0,
      bootsTimer: 0,
      combo: 0,
      comboTimer: 0,
      served: 0,
      score: 0,
      cooldownA: 0,
      cooldownB: 0,
      dashCd: 0,
    }));

    return {
      timeLeft: totalTime,
      totalTime,
      orders: [makeOrder(1), makeOrder(2), makeOrder(3), makeOrder(4)],
      stations: buildStations(),
      flyingPlates: [],
      boots: [],
      bootsSpawnTimer: 6.5,
      popups: [],
      players: list,
      nextId: 10,
      finished: false,
    };
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= 38 * dt;
      state.popups[i].alpha -= dt * 1.1;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    if (!state.finished) {
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      if (state.timeLeft <= 0) state.finished = true;

      // Update order timers
      for (let i = 0; i < state.orders.length; i++) {
        state.orders[i].timeLeft -= dt;
        if (state.orders[i].timeLeft <= 0) {
          state.orders[i] = makeOrder(state.nextId++);
        }
      }

      // Spawn Chef Speed Boots
      state.bootsSpawnTimer -= dt;
      if (state.bootsSpawnTimer <= 0 && state.boots.length < 2) {
        state.bootsSpawnTimer = 8.5;
        state.boots.push({
          id: `bt_${state.nextId++}`,
          x: 340 + (Math.random() < 0.5 ? 0 : 440) + (Math.random() - 0.5) * 70,
          y: 200 + Math.random() * 360,
        });
      }

      // Advance grills (speed boosted if chef has Speed Boots!)
      for (const st of state.stations) {
        if (st.kind === 'grill' && st.cookingDish && st.cookProgress < 1) {
          const cookOwner = state.players.find((c) => c.id === st.cookOwnerId);
          const grillRate = cookOwner && cookOwner.bootsTimer > 0 ? 0.95 : 0.62;
          st.cookProgress = Math.min(1, st.cookProgress + dt * grillRate);
          if (st.cookProgress >= 1) {
            sounds.push({ type: 'confirm' });
          }
        }
      }

      // Update flying tossed plates
      const serveSt = state.stations.find((s) => s.kind === 'serve')!;
      for (let i = state.flyingPlates.length - 1; i >= 0; i--) {
        const fp = state.flyingPlates[i];
        fp.x += fp.vx * dt;
        fp.y += fp.vy * dt;
        fp.life -= dt;
        const hitServe =
          fp.x >= serveSt.x - 20 &&
          fp.x <= serveSt.x + serveSt.w + 20 &&
          fp.y >= serveSt.y - 20 &&
          fp.y <= serveSt.y + serveSt.h + 20;
        if (hitServe) {
          const chef = state.players.find((c) => c.id === fp.ownerId);
          if (chef) scoreDish(state, chef, fp.dish, fp.x, fp.y, sounds, haptics);
          state.flyingPlates.splice(i, 1);
        } else if (fp.life <= 0 || fp.x < 40 || fp.x > ARENA_WIDTH - 40 || fp.y < 80 || fp.y > ARENA_HEIGHT - 30) {
          state.flyingPlates.splice(i, 1);
        }
      }

      // Update chefs
      for (const p of state.players) {
        p.dashTimer = Math.max(0, p.dashTimer - dt);
        p.dashCd = Math.max(0, p.dashCd - dt);
        p.bootsTimer = Math.max(0, p.bootsTimer - dt);
        p.comboTimer = Math.max(0, p.comboTimer - dt);
        if (p.comboTimer <= 0) p.combo = 0;

        for (let bi = state.boots.length - 1; bi >= 0; bi--) {
          const bt = state.boots[bi];
          if (Math.hypot(p.x - bt.x, p.y - bt.y) < 34) {
            p.bootsTimer = 8;
            p.score += 30;
            state.popups.push({ x: bt.x, y: bt.y - 16, text: 'SPEED BOOTS!', colorHex: '#00C2FF', alpha: 1.1 });
            state.boots.splice(bi, 1);
            sounds.push({ type: 'boost', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 18, reason: 'boots' });
          }
        }

        const inp = players.find((x) => x.id === p.id);
        if (!inp) continue;
        const { dx, dy, a, b } = inp.input;
        const mag = Math.hypot(dx, dy);
        if (mag > 0.12) {
          p.angle = Math.atan2(dy, dx);
          const spd = p.dashTimer > 0 ? 450 : p.bootsTimer > 0 ? 370 : 285;
          const nx = Math.max(58, Math.min(ARENA_WIDTH - 58, p.x + (dx / Math.max(1, mag)) * spd * dt));
          const ny = Math.max(115, Math.min(ARENA_HEIGHT - 48, p.y + (dy / Math.max(1, mag)) * spd * dt));
          const collides = (tx: number, ty: number) =>
            state.stations.some(
              (st) => tx > st.x - 18 && tx < st.x + st.w + 18 && ty > st.y - 18 && ty < st.y + st.h + 18
            );
          if (!collides(nx, p.y)) p.x = nx;
          if (!collides(p.x, ny)) p.y = ny;
        }

        // Action A: Smart interact with closest station within reach
        if (a && !inp.prevA) {
          let bestSt: KitchenStationState | null = null;
          let bestDist = 115;
          for (const st of state.stations) {
            const cx = Math.max(st.x, Math.min(p.x, st.x + st.w));
            const cy = Math.max(st.y, Math.min(p.y, st.y + st.h));
            const d = Math.hypot(p.x - cx, p.y - cy);
            if (d < bestDist) {
              bestDist = d;
              bestSt = st;
            }
          }

          if (bestSt) {
            if (bestSt.kind === 'raw-burger' || bestSt.kind === 'raw-pizza' || bestSt.kind === 'raw-taco') {
              const dish: DishKind =
                bestSt.kind === 'raw-burger' ? 'burger' : bestSt.kind === 'raw-pizza' ? 'pizza' : 'taco';
              p.holding = { dish, cooked: false };
              sounds.push({ type: 'nav', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: 14, reason: 'grab' });
            } else if (bestSt.kind === 'grill') {
              if (!bestSt.cookingDish && p.holding && !p.holding.cooked) {
                bestSt.cookingDish = p.holding.dish;
                bestSt.cookProgress = 0;
                bestSt.cookOwnerId = p.id;
                p.holding = null;
                sounds.push({ type: 'confirm', playerId: p.id });
                haptics.push({ playerId: p.id, pattern: 18, reason: 'cook' });
              } else if (bestSt.cookingDish && bestSt.cookProgress >= 1 && !p.holding) {
                p.holding = { dish: bestSt.cookingDish, cooked: true };
                bestSt.cookingDish = null;
                bestSt.cookProgress = 0;
                bestSt.cookOwnerId = null;
                sounds.push({ type: 'pickup', playerId: p.id });
                haptics.push({ playerId: p.id, pattern: 20, reason: 'plate' });
              }
            } else if (bestSt.kind === 'serve' && p.holding && p.holding.cooked) {
              const dish = p.holding.dish;
              p.holding = null;
              scoreDish(state, p, dish, bestSt.x + 20, p.y, sounds, haptics);
            }
          }
        }

        // Action B: Toss cooked plate OR Dash!
        if (b && !inp.prevB && p.dashCd <= 0) {
          if (p.holding && p.holding.cooked) {
            const tx = serveSt.x + serveSt.w / 2 - p.x;
            const ty = Math.max(serveSt.y + 30, Math.min(serveSt.y + serveSt.h - 30, p.y)) - p.y;
            const d = Math.hypot(tx, ty) || 1;
            state.flyingPlates.push({
              id: `pl_${state.nextId++}`,
              ownerId: p.id,
              dish: p.holding.dish,
              x: p.x,
              y: p.y,
              vx: (tx / d) * 620,
              vy: (ty / d) * 620,
              colorHex: p.colorHex,
              life: 1.2,
            });
            p.holding = null;
            p.dashCd = 0.8;
            sounds.push({ type: 'shoot', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 20, reason: 'toss' });
          } else {
            p.dashTimer = 0.35;
            p.dashCd = 1.6;
            sounds.push({ type: 'boost', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 16, reason: 'dash' });
          }
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      p.cooldownA = 0;
      p.cooldownB = Math.min(1, p.dashCd / 1.6);
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: `${p.score} pts · ${p.served} served`,
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

  getSnapshot(state): KitchenRushSnapshot {
    return {
      gameId: 'kitchen-rush',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      orders: state.orders.map((o) => ({ ...o })),
      stations: state.stations.map((s) => ({ ...s })),
      flyingPlates: state.flyingPlates.map((fp) => ({
        id: fp.id,
        dish: fp.dish,
        x: fp.x,
        y: fp.y,
        colorHex: fp.colorHex,
      })),
      boots: state.boots.map((bt) => ({ ...bt })),
      popups: state.popups.map((pp) => ({ ...pp })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        holding: p.holding ? { ...p.holding } : null,
        dashTimer: p.dashTimer,
        bootsTimer: p.bootsTimer,
        combo: p.combo,
        served: p.served,
        score: p.score,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => b.score - a.score || b.served - a.served);
    return sorted.map((cp, idx) => {
      const meta = players.find((p) => p.id === cp.id);
      return {
        playerId: cp.id,
        slotIndex: cp.slotIndex,
        name: cp.name,
        color: meta?.color ?? {
          id: 'tangerine',
          name: 'Tangerine',
          hex: cp.colorHex,
          dark: '#B54F06',
          textOnColor: '#140F0A',
        },
        rank: idx + 1,
        score: cp.score,
        highlight: `${cp.served} dishes served`,
      };
    });
  },
};

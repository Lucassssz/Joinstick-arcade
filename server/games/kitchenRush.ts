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
  gourmet: boolean;
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
  choppingTimer: number;
}

interface KitchenState {
  timeLeft: number;
  totalTime: number;
  teamScore: number;
  totalServedCount: number;
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
    timeLeft: vip ? 24 : 28,
    maxTime: vip ? 24 : 28,
    points: vip ? 220 : 130,
    vip,
  };
}

function buildStations(): KitchenStationState[] {
  return [
    // Left Ingredient Crates & Trash Chute
    { id: 'raw_burger', kind: 'raw-burger', x: 74, y: 126, w: 108, h: 86, cookingDish: null, cookProgress: 0, cookOwnerId: null },
    { id: 'raw_pizza', kind: 'raw-pizza', x: 74, y: 266, w: 108, h: 86, cookingDish: null, cookProgress: 0, cookOwnerId: null },
    { id: 'raw_taco', kind: 'raw-taco', x: 74, y: 406, w: 108, h: 86, cookingDish: null, cookProgress: 0, cookOwnerId: null },
    { id: 'trash_1', kind: 'trash', x: 74, y: 546, w: 108, h: 80, cookingDish: null, cookProgress: 0, cookOwnerId: null },

    // Center-Left Prep Island: Butcher-Block Cutting Boards
    { id: 'chop_1', kind: 'chop', x: 356, y: 146, w: 124, h: 82, cookingDish: null, cookProgress: 0, cookOwnerId: null },
    { id: 'chop_2', kind: 'chop', x: 356, y: 344, w: 124, h: 82, cookingDish: null, cookProgress: 0, cookOwnerId: null },
    { id: 'chop_3', kind: 'chop', x: 356, y: 542, w: 124, h: 82, cookingDish: null, cookProgress: 0, cookOwnerId: null },

    // Center-Right Cooking Island: Cast-Iron Stoves / Grills
    {
      id: 'grill_1',
      kind: 'grill',
      x: 656,
      y: 146,
      w: 130,
      h: 82,
      cookingDish: null,
      cookProgress: 0,
      burnProgress: 0,
      onFire: false,
      cleanPlates: 0,
      cookOwnerId: null,
    },
    {
      id: 'grill_2',
      kind: 'grill',
      x: 656,
      y: 344,
      w: 130,
      h: 82,
      cookingDish: null,
      cookProgress: 0,
      burnProgress: 0,
      onFire: false,
      cleanPlates: 0,
      cookOwnerId: null,
    },
    {
      id: 'grill_3',
      kind: 'grill',
      x: 656,
      y: 542,
      w: 130,
      h: 82,
      cookingDish: null,
      cookProgress: 0,
      burnProgress: 0,
      onFire: false,
      cleanPlates: 0,
      cookOwnerId: null,
    },

    // Right Wall: Bubbly Dish Sink & Serve Conveyor
    {
      id: 'sink_1',
      kind: 'sink',
      x: 984,
      y: 126,
      w: 128,
      h: 126,
      cookingDish: null,
      cookProgress: 0,
      dirtyPlates: 0,
      cleanPlates: 4,
      cookOwnerId: null,
    },
    {
      id: 'serve_1',
      kind: 'serve',
      x: 984,
      y: 288,
      w: 128,
      h: 338,
      cookingDish: null,
      cookProgress: 0,
      cookOwnerId: null,
    },
  ];
}

function stationDist(px: number, py: number, st: KitchenStationState): number {
  const cx = Math.max(st.x, Math.min(px, st.x + st.w));
  const cy = Math.max(st.y, Math.min(py, st.y + st.h));
  return Math.hypot(px - cx, py - cy);
}

function scoreDish(
  state: KitchenState,
  chef: InternalChef,
  dish: DishKind,
  gourmet: boolean,
  x: number,
  y: number,
  sounds: SoundEvent[],
  haptics: HapticTrigger[]
): void {
  const ordIdx = state.orders.findIndex((o) => o.dish === dish);
  let pts = 70;
  let isVip = false;
  if (ordIdx !== -1) {
    const ord = state.orders[ordIdx];
    isVip = Boolean(ord.vip);
    const speedBonus = Math.round((ord.timeLeft / ord.maxTime) * 65);
    pts = ord.points + speedBonus;
    state.orders.splice(ordIdx, 1);
    state.orders.push(makeOrder(state.nextId++));
  }
  const sink = state.stations.find((s) => s.kind === 'sink');
  let cleanPlateBonus = 0;
  if (sink && (sink.cleanPlates ?? 0) > 0) {
    sink.cleanPlates = Math.max(0, (sink.cleanPlates ?? 0) - 1);
    cleanPlateBonus = 20;
  }

  chef.combo = chef.comboTimer > 0 ? Math.min(4, chef.combo + 1) : 1;
  chef.comboTimer = 12;
  const streakTip = (chef.combo - 1) * 35;
  const gourmetBonus = gourmet ? 45 : 0;
  const totalPts = pts + streakTip + gourmetBonus + cleanPlateBonus;

  chef.score += totalPts;
  chef.served++;
  state.teamScore += totalPts;
  state.totalServedCount += 1;

  if (sink && state.totalServedCount % 2 === 0) {
    sink.dirtyPlates = Math.min(6, (sink.dirtyPlates ?? 0) + 1);
  }

  const tag = isVip
    ? `VIP ★ +${totalPts}!`
    : gourmet
      ? `GOURMET +${totalPts}${chef.combo > 1 ? ` x${chef.combo}` : ''}!`
      : chef.combo > 1
        ? `+${totalPts} x${chef.combo}!`
        : `+${totalPts}!`;

  state.popups.push({
    x,
    y: y - 16,
    text: tag,
    colorHex: isVip ? '#FFB800' : gourmet ? '#10D98B' : '#00C2FF',
    alpha: 1,
  });
  sounds.push({ type: isVip ? 'win' : 'pickup', playerId: chef.id });
  haptics.push({ playerId: chef.id, pattern: [18, 20, 30], reason: 'served' });
}

export const kitchenRushModule: ServerGameModule<KitchenState> = {
  id: 'kitchen-rush',

  createState(players, settingValue) {
    const totalTime = Math.max(45, Math.min(120, settingValue || 80));
    const spawnPoints = [
      { x: 255, y: 245 },
      { x: 555, y: 245 },
      { x: 255, y: 455 },
      { x: 555, y: 455 },
      { x: 865, y: 245 },
      { x: 865, y: 455 },
    ];
    const list: InternalChef[] = players.map((p, idx) => {
      const sp = spawnPoints[idx % spawnPoints.length];
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        x: sp.x,
        y: sp.y,
        angle: 0,
        holding: null,
        dashTimer: 0,
        bootsTimer: 0,
        combo: 0,
        comboTimer: 0,
        choppingTimer: 0,
        served: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        dashCd: 0,
      };
    });

    return {
      timeLeft: totalTime,
      totalTime,
      teamScore: 0,
      totalServedCount: 0,
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

      // Spawn Chef Speed Boots in the open kitchen walkways
      state.bootsSpawnTimer -= dt;
      if (state.bootsSpawnTimer <= 0 && state.boots.length < 2) {
        state.bootsSpawnTimer = 8.5;
        const aisleXs = [255, 560, 865];
        const aisleYs = [250, 445];
        state.boots.push({
          id: `bt_${state.nextId++}`,
          x: aisleXs[Math.floor(Math.random() * aisleXs.length)] + (Math.random() - 0.5) * 40,
          y: aisleYs[Math.floor(Math.random() * aisleYs.length)] + (Math.random() - 0.5) * 36,
        });
      }

      // Advance Cutting Boards (auto-chop when any chef stands nearby!)
      for (const st of state.stations) {
        if (st.kind === 'chop' && st.cookingDish && st.cookProgress < 1) {
          let nearestChef: InternalChef | null = null;
          let nearestD = 108;
          for (const c of state.players) {
            const d = stationDist(c.x, c.y, st);
            if (d < nearestD) {
              nearestD = d;
              nearestChef = c;
            }
          }
          if (nearestChef) {
            const chopRate = nearestChef.bootsTimer > 0 ? 1.38 : 0.96;
            st.cookProgress = Math.min(1, st.cookProgress + dt * chopRate);
            nearestChef.choppingTimer = 0.22;
            if (st.cookProgress >= 1) {
              sounds.push({ type: 'pickup', playerId: nearestChef.id });
              // Auto-pop into nearby chef's empty hands for seamless Switch feel!
              if (!nearestChef.holding) {
                nearestChef.holding = {
                  dish: st.cookingDish,
                  cooked: false,
                  stage: 'chopped',
                  gourmet: true,
                };
                st.cookingDish = null;
                st.cookProgress = 0;
                st.cookOwnerId = null;
                state.popups.push({
                  x: st.x + st.w / 2,
                  y: st.y - 12,
                  text: 'CHOPPED! → GRILL',
                  colorHex: '#00C2FF',
                  alpha: 1,
                });
              } else {
                state.popups.push({
                  x: st.x + st.w / 2,
                  y: st.y - 12,
                  text: 'PREP READY!',
                  colorHex: '#00C2FF',
                  alpha: 1,
                });
              }
            }
          }
        }
      }

      // Advance Stoves / Grills (sizzle -> cooked -> overcook warning -> stove fire!)
      for (const st of state.stations) {
        if (st.kind === 'grill' && st.cookingDish && !st.onFire) {
          const cookOwner = state.players.find((c) => c.id === st.cookOwnerId);
          const isChoppedPrepped = (st.cleanPlates ?? 0) > 0;
          if (st.cookProgress < 1) {
            const baseRate = isChoppedPrepped ? 0.68 : 0.46;
            const grillRate = cookOwner && cookOwner.bootsTimer > 0 ? baseRate * 1.35 : baseRate;
            st.cookProgress = Math.min(1, st.cookProgress + dt * grillRate);
            if (st.cookProgress >= 1) {
              st.burnProgress = 0;
              sounds.push({ type: 'confirm' });
              state.popups.push({
                x: st.x + st.w / 2,
                y: st.y - 10,
                text: 'COOKED! GRAB IT!',
                colorHex: '#10D98B',
                alpha: 1,
              });
            }
          } else {
            // Grace period before overcooking into a Stove Fire (~9.5s)
            st.burnProgress = Math.min(1, (st.burnProgress ?? 0) + dt * 0.105);
            if (st.burnProgress >= 1) {
              st.onFire = true;
              sounds.push({ type: 'hit' });
              state.popups.push({
                x: st.x + st.w / 2,
                y: st.y - 14,
                text: '🔥 STOVE FIRE! TAP A/B!',
                colorHex: '#FF4D2E',
                alpha: 1.15,
              });
            }
          }
        }
      }

      // Advance Dish Sink if a chef stands right next to dirty plates
      for (const st of state.stations) {
        if (st.kind === 'sink' && (st.dirtyPlates ?? 0) > 0) {
          const washer = state.players.find((c) => !c.holding && stationDist(c.x, c.y, st) < 92);
          if (washer) {
            st.cookProgress = Math.min(1, st.cookProgress + dt * 0.9);
            washer.choppingTimer = 0.18;
            if (st.cookProgress >= 1) {
              st.cookProgress = 0;
              st.dirtyPlates = Math.max(0, (st.dirtyPlates ?? 0) - 1);
              st.cleanPlates = Math.min(6, (st.cleanPlates ?? 0) + 2);
              washer.score += 45;
              state.teamScore += 45;
              state.popups.push({
                x: st.x + st.w / 2,
                y: st.y - 12,
                text: '🫧 CLEAN DISHES +45!',
                colorHex: '#00C2FF',
                alpha: 1,
              });
              sounds.push({ type: 'pickup', playerId: washer.id });
            }
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
          fp.x >= serveSt.x - 24 &&
          fp.x <= serveSt.x + serveSt.w + 24 &&
          fp.y >= serveSt.y - 24 &&
          fp.y <= serveSt.y + serveSt.h + 24;
        if (hitServe) {
          const chef = state.players.find((c) => c.id === fp.ownerId);
          if (chef) scoreDish(state, chef, fp.dish, fp.gourmet, fp.x, fp.y, sounds, haptics);
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
        p.choppingTimer = Math.max(0, (p.choppingTimer ?? 0) - dt);
        if (p.comboTimer <= 0) p.combo = 0;

        for (let bi = state.boots.length - 1; bi >= 0; bi--) {
          const bt = state.boots[bi];
          if (Math.hypot(p.x - bt.x, p.y - bt.y) < 34) {
            p.bootsTimer = 8;
            p.score += 30;
            state.teamScore += 30;
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
          const spd = p.dashTimer > 0 ? 450 : p.bootsTimer > 0 ? 375 : 290;
          const nx = Math.max(52, Math.min(ARENA_WIDTH - 52, p.x + (dx / Math.max(1, mag)) * spd * dt));
          const ny = Math.max(112, Math.min(ARENA_HEIGHT - 44, p.y + (dy / Math.max(1, mag)) * spd * dt));
          const collides = (tx: number, ty: number) =>
            state.stations.some(
              (st) => tx > st.x - 16 && tx < st.x + st.w + 16 && ty > st.y - 16 && ty < st.y + st.h + 16
            );
          if (!collides(nx, p.y)) p.x = nx;
          if (!collides(p.x, ny)) p.y = ny;
        }

        // Helper to extinguish any nearby burning stove
        const tryExtinguishNearbyFire = (): boolean => {
          const burningStove = state.stations.find(
            (st) => st.kind === 'grill' && st.onFire && stationDist(p.x, p.y, st) < 138
          );
          if (!burningStove) return false;
          burningStove.onFire = false;
          burningStove.burnProgress = 0;
          burningStove.cookingDish = null;
          burningStove.cookProgress = 0;
          burningStove.cleanPlates = 0;
          p.score += 30;
          state.teamScore += 30;
          state.popups.push({
            x: burningStove.x + burningStove.w / 2,
            y: burningStove.y - 14,
            text: '🧯 FIRE OUT +30!',
            colorHex: '#00C2FF',
            alpha: 1.1,
          });
          sounds.push({ type: 'boost', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: [25, 20, 35], reason: 'extinguish' });
          return true;
        };

        // Action A: Smart interact with closest station within reach
        if (a && !inp.prevA) {
          if (tryExtinguishNearbyFire()) {
            // Handled stove fire
          } else {
            let bestSt: KitchenStationState | null = null;
            let bestDist = 115;
            for (const st of state.stations) {
              const d = stationDist(p.x, p.y, st);
              if (d < bestDist) {
                bestDist = d;
                bestSt = st;
              }
            }

            if (bestSt) {
              if (bestSt.kind === 'raw-burger' || bestSt.kind === 'raw-pizza' || bestSt.kind === 'raw-taco') {
                const dish: DishKind =
                  bestSt.kind === 'raw-burger' ? 'burger' : bestSt.kind === 'raw-pizza' ? 'pizza' : 'taco';
                p.holding = { dish, cooked: false, stage: 'raw', gourmet: false };
                sounds.push({ type: 'nav', playerId: p.id });
                haptics.push({ playerId: p.id, pattern: 14, reason: 'grab' });
              } else if (bestSt.kind === 'trash') {
                if (p.holding) {
                  p.holding = null;
                  state.popups.push({
                    x: bestSt.x + bestSt.w / 2,
                    y: bestSt.y - 10,
                    text: 'TRASHED',
                    colorHex: '#94A3B8',
                    alpha: 0.9,
                  });
                  sounds.push({ type: 'nav', playerId: p.id });
                }
              } else if (bestSt.kind === 'chop') {
                if (!bestSt.cookingDish && p.holding && !p.holding.cooked && p.holding.stage !== 'chopped') {
                  bestSt.cookingDish = p.holding.dish;
                  bestSt.cookProgress = 0.18;
                  bestSt.cookOwnerId = p.id;
                  p.holding = null;
                  p.choppingTimer = 0.28;
                  sounds.push({ type: 'nav', playerId: p.id });
                  haptics.push({ playerId: p.id, pattern: 16, reason: 'chop-start' });
                } else if (bestSt.cookingDish && bestSt.cookProgress < 1) {
                  // Tap A to chop faster!
                  bestSt.cookProgress = Math.min(1, bestSt.cookProgress + 0.35);
                  p.choppingTimer = 0.28;
                  sounds.push({ type: 'nav', playerId: p.id });
                  haptics.push({ playerId: p.id, pattern: 14, reason: 'chop-slice' });
                  if (bestSt.cookProgress >= 1 && !p.holding) {
                    p.holding = {
                      dish: bestSt.cookingDish,
                      cooked: false,
                      stage: 'chopped',
                      gourmet: true,
                    };
                    bestSt.cookingDish = null;
                    bestSt.cookProgress = 0;
                    bestSt.cookOwnerId = null;
                    state.popups.push({
                      x: bestSt.x + bestSt.w / 2,
                      y: bestSt.y - 12,
                      text: 'CHOPPED! → GRILL',
                      colorHex: '#00C2FF',
                      alpha: 1,
                    });
                    sounds.push({ type: 'pickup', playerId: p.id });
                  }
                } else if (bestSt.cookingDish && bestSt.cookProgress >= 1 && !p.holding) {
                  p.holding = {
                    dish: bestSt.cookingDish,
                    cooked: false,
                    stage: 'chopped',
                    gourmet: true,
                  };
                  bestSt.cookingDish = null;
                  bestSt.cookProgress = 0;
                  bestSt.cookOwnerId = null;
                  sounds.push({ type: 'pickup', playerId: p.id });
                  haptics.push({ playerId: p.id, pattern: 18, reason: 'grab-chopped' });
                }
              } else if (bestSt.kind === 'grill') {
                if (!bestSt.cookingDish && p.holding && !p.holding.cooked) {
                  bestSt.cookingDish = p.holding.dish;
                  bestSt.cookProgress = 0;
                  bestSt.burnProgress = 0;
                  bestSt.onFire = false;
                  bestSt.cleanPlates = p.holding.stage === 'chopped' || p.holding.gourmet ? 1 : 0;
                  bestSt.cookOwnerId = p.id;
                  p.holding = null;
                  sounds.push({ type: 'confirm', playerId: p.id });
                  haptics.push({ playerId: p.id, pattern: 18, reason: 'cook' });
                } else if (bestSt.cookingDish && bestSt.cookProgress >= 1 && !bestSt.onFire && !p.holding) {
                  const isGourmet = (bestSt.cleanPlates ?? 0) > 0;
                  p.holding = {
                    dish: bestSt.cookingDish,
                    cooked: true,
                    stage: 'plated',
                    gourmet: isGourmet,
                  };
                  bestSt.cookingDish = null;
                  bestSt.cookProgress = 0;
                  bestSt.burnProgress = 0;
                  bestSt.cleanPlates = 0;
                  bestSt.cookOwnerId = null;
                  sounds.push({ type: 'pickup', playerId: p.id });
                  haptics.push({ playerId: p.id, pattern: 20, reason: 'plate' });
                }
              } else if (bestSt.kind === 'sink') {
                if ((bestSt.dirtyPlates ?? 0) > 0) {
                  bestSt.cookProgress = Math.min(1, bestSt.cookProgress + 0.55);
                  p.choppingTimer = 0.25;
                  if (bestSt.cookProgress >= 1) {
                    bestSt.cookProgress = 0;
                    bestSt.dirtyPlates = Math.max(0, (bestSt.dirtyPlates ?? 0) - 1);
                    bestSt.cleanPlates = Math.min(6, (bestSt.cleanPlates ?? 0) + 2);
                    p.score += 45;
                    state.teamScore += 45;
                    state.popups.push({
                      x: bestSt.x + bestSt.w / 2,
                      y: bestSt.y - 12,
                      text: '🫧 CLEAN DISHES +45!',
                      colorHex: '#00C2FF',
                      alpha: 1,
                    });
                    sounds.push({ type: 'pickup', playerId: p.id });
                  } else {
                    sounds.push({ type: 'nav', playerId: p.id });
                  }
                }
              } else if (bestSt.kind === 'serve' && p.holding && p.holding.cooked) {
                const { dish, gourmet } = p.holding;
                p.holding = null;
                scoreDish(state, p, dish, Boolean(gourmet), bestSt.x + 20, p.y, sounds, haptics);
              }
            }
          }
        }

        // Action B: Extinguish Fire OR Toss cooked plate OR Dash!
        if (b && !inp.prevB) {
          if (tryExtinguishNearbyFire()) {
            // Extinguished stove fire!
          } else if (p.dashCd <= 0) {
            if (p.holding && p.holding.cooked) {
              const tx = serveSt.x + serveSt.w / 2 - p.x;
              const ty = Math.max(serveSt.y + 30, Math.min(serveSt.y + serveSt.h - 30, p.y)) - p.y;
              const d = Math.hypot(tx, ty) || 1;
              state.flyingPlates.push({
                id: `pl_${state.nextId++}`,
                ownerId: p.id,
                dish: p.holding.dish,
                gourmet: Boolean(p.holding.gourmet),
                x: p.x,
                y: p.y,
                vx: (tx / d) * 640,
                vy: (ty / d) * 640,
                colorHex: p.colorHex,
                life: 1.35,
              });
              p.holding = null;
              p.dashCd = 0.75;
              sounds.push({ type: 'shoot', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: 20, reason: 'toss' });
            } else {
              p.dashTimer = 0.35;
              p.dashCd = 1.45;
              sounds.push({ type: 'boost', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: 16, reason: 'dash' });
            }
          }
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const stars = state.teamScore >= 1100 ? '★★★' : state.teamScore >= 650 ? '★★☆' : state.teamScore >= 280 ? '★☆☆' : '☆☆☆';
    for (const p of state.players) {
      p.cooldownA = 0;
      p.cooldownB = Math.min(1, p.dashCd / 1.45);
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: `${stars} · ${p.score} pts · ${p.served} served`,
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
      teamScore: state.teamScore,
      orders: state.orders.map((o) => ({ ...o })),
      stations: state.stations.map((s) => ({ ...s })),
      flyingPlates: state.flyingPlates.map((fp) => ({
        id: fp.id,
        dish: fp.dish,
        gourmet: fp.gourmet,
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
        choppingTimer: p.choppingTimer,
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
    const stars = state.teamScore >= 1100 ? '3★ Kitchen' : state.teamScore >= 650 ? '2★ Kitchen' : '1★ Kitchen';
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
        highlight: `${cp.served} served · ${stars}`,
      };
    });
  },
};


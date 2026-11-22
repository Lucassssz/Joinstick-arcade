import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type DungeonCrawlBoardSnapshot,
  type DungeonPlayerState,
  type DungeonTileState,
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

interface DungeonCrawlState {
  round: number;
  totalRounds: number;
  turnIndex: number;
  phase: 'wait-roll' | 'rolling' | 'moving' | 'combat' | 'event';
  turnTimeLeft: number;
  phaseTimer: number;
  diceValue: number;
  combatRoll: number | null;
  diceRolling: boolean;
  stepsRemaining: number;
  hopProgress: number;
  bossHp: number;
  bossMaxHp: number;
  tiles: DungeonTileState[];
  banner: string | null;
  eventText: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: DungeonPlayerState[];
  finished: boolean;
}

const TOTAL_TILES = 20;
const TURN_TIMEOUT = 14;

function buildDungeonSpiral(): DungeonTileState[] {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 16;
  const specs: Array<{ kind: DungeonTileState['kind']; name: string; power: number; reward: number }> = [
    { kind: 'start', name: 'GUILD GATE', power: 0, reward: 20 },
    { kind: 'monster', name: 'SLIME', power: 3, reward: 40 },
    { kind: 'chest', name: 'IRON CHEST', power: 0, reward: 55 },
    { kind: 'monster', name: 'GOBLIN', power: 4, reward: 50 },
    { kind: 'camp', name: 'CAMPFIRE', power: 0, reward: 30 },
    { kind: 'trap', name: 'SPIKE PIT', power: 2, reward: 0 },
    { kind: 'monster', name: 'SKELETON', power: 4, reward: 60 },
    { kind: 'chest', name: 'GOLD CHEST', power: 0, reward: 75 },
    { kind: 'monster', name: 'ORC BRUTE', power: 5, reward: 70 },
    { kind: 'camp', name: 'SHRINE', power: 0, reward: 40 },
    { kind: 'monster', name: 'DARK MAGE', power: 5, reward: 80 },
    { kind: 'trap', name: 'FIRE RUNE', power: 3, reward: 0 },
    { kind: 'chest', name: 'RELIC VAULT', power: 0, reward: 90 },
    { kind: 'monster', name: 'MINOTAUR', power: 6, reward: 95 },
    { kind: 'camp', name: 'SANCTUARY', power: 0, reward: 45 },
    { kind: 'monster', name: 'GOLEM', power: 6, reward: 100 },
    { kind: 'chest', name: 'ROYAL HOARD', power: 0, reward: 110 },
    { kind: 'monster', name: 'DRAKE', power: 7, reward: 115 },
    { kind: 'camp', name: 'ALTAR', power: 0, reward: 50 },
    { kind: 'boss', name: 'DRAGON BOSS', power: 7, reward: 180 },
  ];

  return specs.map((sp, i) => {
    const t = i / (TOTAL_TILES - 1);
    const angle = i * 0.72 - Math.PI * 0.75;
    const rx = 415 - t * 265;
    const ry = 225 - t * 145;
    const x = i === TOTAL_TILES - 1 ? cx : Math.round(cx + Math.cos(angle) * rx);
    const y = i === TOTAL_TILES - 1 ? cy : Math.round(cy + Math.sin(angle) * ry);
    return {
      index: i,
      x,
      y,
      kind: sp.kind,
      name: sp.name,
      power: sp.power,
      reward: sp.reward,
    };
  });
}

function advanceTurn(state: DungeonCrawlState): void {
  state.turnIndex = (state.turnIndex + 1) % state.players.length;
  if (state.turnIndex === 0) {
    state.round++;
    if (state.round > state.totalRounds) {
      state.finished = true;
      state.banner = 'DUNGEON QUEST COMPLETE!';
      return;
    }
  }
  state.phase = 'wait-roll';
  state.turnTimeLeft = TURN_TIMEOUT;
  state.combatRoll = null;
  state.diceRolling = false;
  state.banner = null;
  const active = state.players[state.turnIndex];
  if (active) {
    state.eventText = `${active.name}'s Turn — Press A to Roll or B for Hero Potion!`;
  }
}

export const dungeonCrawlBoardModule: ServerGameModule<DungeonCrawlState> = {
  id: 'dungeon-crawl-board',

  createState(players: ServerPlayerInputState[], settingValue: number): DungeonCrawlState {
    const totalRounds = settingValue || 10;
    const tiles = buildDungeonSpiral();
    const heroes: DungeonPlayerState[] = players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: p.isBot,
      tileIndex: 0,
      visualTile: 0,
      hp: 10,
      maxHp: 10,
      attackBonus: 1,
      potions: 2,
      monstersSlain: 0,
      gold: 25,
      score: 25,
      cooldownA: 0,
      cooldownB: 0,
    }));

    return {
      round: 1,
      totalRounds,
      turnIndex: 0,
      phase: 'wait-roll',
      turnTimeLeft: TURN_TIMEOUT,
      phaseTimer: 0,
      diceValue: 6,
      combatRoll: null,
      diceRolling: false,
      stepsRemaining: 0,
      hopProgress: 0,
      bossHp: 18,
      bossMaxHp: 18,
      tiles,
      banner: null,
      eventText: heroes[0] ? `${heroes[0].name}'s Turn — Venture into the Dungeon!` : null,
      popups: [],
      players: heroes,
      finished: false,
    };
  },

  step(state: DungeonCrawlState, players: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= dt * 28;
      state.popups[i].alpha -= dt * 0.95;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    if (state.players.length === 0) state.finished = true;

    if (!state.finished) {
      const active = state.players[state.turnIndex];
      const inp = players.find((p) => p.id === active.id);
      const justA = Boolean(inp && inp.input.a && !inp.prevA);
      const justB = Boolean(inp && inp.input.b && !inp.prevB);

      // Action B: Hero Potion (+3 HP & +2 Sword Attack) available during wait-roll or combat
      if (justB && active.potions > 0 && (state.phase === 'wait-roll' || state.phase === 'combat')) {
        active.potions--;
        active.hp = Math.min(active.maxHp, active.hp + 4);
        active.attackBonus += 2;
        state.banner = 'HERO POTION (+4 HP / +2 ATK)!';
        state.eventText = `🧪 ${active.name} drank a Hero Potion (+4 HP & +2 Attack Power)!`;
        sounds.push({ type: 'boost', playerId: active.id });
        haptics.push({ playerId: active.id, pattern: 26, reason: 'dungeon-potion' });
      }

      if (state.phase === 'wait-roll') {
        state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
        if (justA || state.turnTimeLeft <= 0) {
          state.phase = 'rolling';
          state.phaseTimer = 0.85;
          state.diceRolling = true;
          state.diceValue = 1 + Math.floor(Math.random() * 6);
          sounds.push({ type: 'confirm', playerId: active.id });
          haptics.push({ playerId: active.id, pattern: 20, reason: 'dungeon-roll' });
        }
      } else if (state.phase === 'rolling') {
        state.phaseTimer -= dt;
        if (Math.random() < 0.45) {
          state.diceValue = 1 + Math.floor(Math.random() * 6);
        }
        if (state.phaseTimer <= 0) {
          state.diceRolling = false;
          const roll = 1 + Math.floor(Math.random() * 6);
          state.diceValue = roll;
          state.stepsRemaining = roll;
          state.hopProgress = 0;
          state.phase = 'moving';
          state.eventText = `${active.name} rolled ${roll}! Advancing deeper into the crypt...`;
        }
      } else if (state.phase === 'moving') {
        state.hopProgress += dt * 4.4;
        if (state.hopProgress >= 1) {
          state.hopProgress = 0;
          active.tileIndex = Math.min(TOTAL_TILES - 1, active.tileIndex + 1);
          active.visualTile = active.tileIndex;
          state.stepsRemaining--;
          sounds.push({ type: 'nav', playerId: active.id });

          if (active.tileIndex === TOTAL_TILES - 1) {
            state.stepsRemaining = 0;
          }

          if (state.stepsRemaining <= 0) {
            const tile = state.tiles[active.tileIndex];
            if (tile.kind === 'monster' || tile.kind === 'boss') {
              state.phase = 'combat';
              state.turnTimeLeft = 9;
              state.banner = `⚔️ ENCOUNTER: ${tile.name} (PWR ${tile.power})!`;
              state.eventText = `${active.name} encountered ${tile.name}! Press A to Strike!`;
              sounds.push({ type: 'pulse', playerId: active.id });
            } else if (tile.kind === 'chest') {
              active.gold += tile.reward;
              active.attackBonus += 1;
              active.score = active.gold;
              state.banner = `TREASURE +${tile.reward}G & +1 ATK!`;
              state.eventText = `💎 ${active.name} looted ${tile.name} (+${tile.reward} Gold & +1 Sword ATK)!`;
              sounds.push({ type: 'pickup', playerId: active.id });
              state.phase = 'event';
              state.phaseTimer = 1.35;
            } else if (tile.kind === 'camp') {
              active.hp = active.maxHp;
              active.gold += tile.reward;
              active.score = active.gold;
              state.banner = `HEALED +${tile.reward}G!`;
              state.eventText = `🔥 ${active.name} rested at ${tile.name} (Full HP & +${tile.reward} Gold)!`;
              sounds.push({ type: 'boost', playerId: active.id });
              state.phase = 'event';
              state.phaseTimer = 1.35;
            } else if (tile.kind === 'trap') {
              active.hp = Math.max(1, active.hp - tile.power);
              state.banner = `${tile.name} (-${tile.power} HP)!`;
              state.eventText = `⚠️ ${active.name} triggered ${tile.name} (-${tile.power} HP)!`;
              sounds.push({ type: 'hit', playerId: active.id });
              state.phase = 'event';
              state.phaseTimer = 1.35;
            } else {
              active.gold += 20;
              active.score = active.gold;
              state.phase = 'event';
              state.phaseTimer = 1.25;
            }
          }
        }
      } else if (state.phase === 'combat') {
        state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
        if (justA || state.turnTimeLeft <= 0) {
          const tile = state.tiles[active.tileIndex];
          const rawRoll = 1 + Math.floor(Math.random() * 6);
          const totalPower = rawRoll + active.attackBonus;
          state.combatRoll = totalPower;

          if (tile.kind === 'boss') {
            const dmg = Math.max(3, totalPower);
            state.bossHp = Math.max(0, state.bossHp - dmg);
            active.gold += dmg * 15;
            active.score = active.gold;
            state.banner = `DRAGON HIT FOR ${dmg} DMG!`;
            state.eventText = `🐉 ${active.name} struck the Dragon Boss for ${dmg} DMG (+${dmg * 15} Gold)!`;
            sounds.push({ type: 'lap', playerId: active.id });
            haptics.push({ playerId: active.id, pattern: [40, 20, 60], reason: 'boss-hit' });

            if (state.bossHp <= 0) {
              active.gold += tile.reward;
              active.monstersSlain++;
              active.score = active.gold;
              state.finished = true;
              state.banner = `${active.name} SLEW THE DRAGON BOSS!`;
              sounds.push({ type: 'win', playerId: active.id });
              return {
                snapshot: this.getSnapshot(state),
                sounds,
                haptics,
                hudUpdates: {},
                finished: true,
                rankings: this.getRankings(state, players),
              };
            } else {
              // Boss pushes hero back 3 tiles after attack so others can also charge the lair
              active.tileIndex = Math.max(0, active.tileIndex - 3);
              active.visualTile = active.tileIndex;
            }
          } else if (totalPower >= tile.power) {
            active.gold += tile.reward;
            active.monstersSlain++;
            active.score = active.gold;
            state.banner = `SLAIN ${tile.name}! +${tile.reward}G`;
            state.eventText = `⚔️ ${active.name} rolled ${rawRoll}+${active.attackBonus}=${totalPower} & slew ${tile.name} (+${tile.reward} Gold)!`;
            sounds.push({ type: 'ko', playerId: active.id });
            haptics.push({ playerId: active.id, pattern: [30, 20, 45], reason: 'monster-slain' });
          } else {
            active.hp = Math.max(1, active.hp - 2);
            active.gold += 15;
            active.score = active.gold;
            state.banner = `GRAZED ${tile.name} (+15G, -2 HP)`;
            state.eventText = `🛡️ ${active.name} rolled ${totalPower} vs ${tile.power} — took 2 damage but grabbed 15 Gold!`;
            sounds.push({ type: 'hit', playerId: active.id });
          }
          state.phase = 'event';
          state.phaseTimer = 1.45;
        }
      } else if (state.phase === 'event') {
        state.phaseTimer -= dt;
        if (state.phaseTimer <= 0) {
          advanceTurn(state);
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const activePlayer = state.players[state.turnIndex];
    for (const p of state.players) {
      const isTurn = activePlayer && p.id === activePlayer.id && !state.finished;
      p.cooldownA = isTurn && (state.phase === 'wait-roll' || state.phase === 'combat') ? 0 : 1;
      p.cooldownB = isTurn && p.potions > 0 ? 0 : 1;
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: isTurn
          ? `YOUR TURN · ♥${p.hp} · ⚔+${p.attackBonus} · ${p.gold}G`
          : `♥${p.hp} · ⚔+${p.attackBonus} · ${p.gold}G`,
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

  getSnapshot(state: DungeonCrawlState): DungeonCrawlBoardSnapshot {
    return {
      gameId: 'dungeon-crawl-board',
      round: Math.min(state.round, state.totalRounds),
      totalRounds: state.totalRounds,
      activePlayerId: state.players[state.turnIndex]?.id ?? '',
      phase: state.phase,
      turnTimeLeft: state.turnTimeLeft,
      diceValue: state.diceValue,
      combatRoll: state.combatRoll,
      diceRolling: state.diceRolling,
      bossHp: state.bossHp,
      bossMaxHp: state.bossMaxHp,
      tiles: state.tiles,
      banner: state.banner,
      eventText: state.eventText,
      popups: state.popups,
      players: state.players.map((p) => ({ ...p })),
    };
  },

  getRankings(state: DungeonCrawlState, players: ServerPlayerInputState[]): RankingEntry[] {
    const colorMap = new Map(players.map((p) => [p.id, p.color]));
    const sorted = [...state.players].sort((a, b) => b.gold - a.gold || b.monstersSlain - a.monstersSlain);
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: colorMap.get(p.id)!,
      rank: idx + 1,
      score: p.gold,
      highlight: `${p.gold} Gold · ${p.monstersSlain} Monsters Slain`,
    }));
  },
};

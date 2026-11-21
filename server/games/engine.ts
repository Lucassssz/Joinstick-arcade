import type {
  ControllerInput,
  GameId,
  GameSnapshot,
  PlayerColorSpec,
  RankingEntry,
  SoundEvent,
} from '../../src/shared/types.ts';
import { bumperBrawlModule } from './bumperBrawl.ts';
import { astroBlasterModule } from './astroBlaster.ts';
import { turboDriftModule } from './turboDrift.ts';
import { hexDropModule } from './hexDrop.ts';
import { fusePassModule } from './fusePass.ts';
import { gridRunnersModule } from './gridRunners.ts';
import { ricochetTanksModule } from './ricochetTanks.ts';
import { turboStrikerModule } from './turboStriker.ts';
import { paintRushModule } from './paintRush.ts';

export interface ServerPlayerInputState {
  id: string;
  slotIndex: number;
  name: string;
  color: PlayerColorSpec;
  connected: boolean;
  input: ControllerInput;
  prevA: boolean;
  prevB: boolean;
}

export interface HapticTrigger {
  playerId: string;
  pattern: number | number[];
  reason?: string;
}

export interface PlayerHudUpdate {
  score: number;
  alive: boolean;
  statText: string;
  cooldownA: number;
  cooldownB: number;
}

export interface StepOutput {
  snapshot: GameSnapshot;
  sounds: SoundEvent[];
  haptics: HapticTrigger[];
  hudUpdates: Record<string, PlayerHudUpdate>;
  finished: boolean;
  rankings?: RankingEntry[];
}

export interface ServerGameModule<TState = unknown> {
  id: GameId;
  createState(players: ServerPlayerInputState[], settingValue: number): TState;
  addPlayer?(state: TState, player: ServerPlayerInputState): void;
  step(state: TState, players: ServerPlayerInputState[], dt: number): StepOutput;
  getSnapshot(state: TState): GameSnapshot;
  getRankings(state: TState, players: ServerPlayerInputState[]): RankingEntry[];
}

export const SERVER_GAMES: Record<GameId, ServerGameModule<any>> = {
  'bumper-brawl': bumperBrawlModule,
  'astro-blaster': astroBlasterModule,
  'turbo-drift': turboDriftModule,
  'hex-drop': hexDropModule,
  'fuse-pass': fusePassModule,
  'grid-runners': gridRunnersModule,
  'ricochet-tanks': ricochetTanksModule,
  'turbo-striker': turboStrikerModule,
  'paint-rush': paintRushModule,
};

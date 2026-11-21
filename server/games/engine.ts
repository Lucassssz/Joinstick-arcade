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
import { laserGauntletModule } from './laserGauntlet.ts';
import { vaultHeistModule } from './vaultHeist.ts';
import { hyperPongModule } from './hyperPong.ts';
import { bladeDuelModule } from './bladeDuel.ts';
import { cannonSiegeModule } from './cannonSiege.ts';
import { crownHeistModule } from './crownHeist.ts';
import { freezeTagModule } from './freezeTag.ts';
import { ghostHuntModule } from './ghostHunt.ts';
import { meteorSwarmModule } from './meteorSwarm.ts';
import { hookShotModule } from './hookShot.ts';
import { gravityFlipModule } from './gravityFlip.ts';
import { richStreetModule } from './richStreet.ts';
import { jungleLaddersModule } from './jungleLadders.ts';
import { bombGridModule } from './bombGrid.ts';
import { redLightDashModule } from './redLightDash.ts';
import { colorMatchModule } from './colorMatch.ts';
import { kitchenRushModule } from './kitchenRush.ts';
import { treasureDigModule } from './treasureDig.ts';
import { fruitDropModule } from './fruitDrop.ts';
import { luckyAuctionModule } from './luckyAuction.ts';
import { pinballClashModule } from './pinballClash.ts';

export interface ServerPlayerInputState {
  id: string;
  slotIndex: number;
  name: string;
  color: PlayerColorSpec;
  connected: boolean;
  isBot?: boolean;
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
  'laser-gauntlet': laserGauntletModule,
  'vault-heist': vaultHeistModule,
  'hyper-pong': hyperPongModule,
  'blade-duel': bladeDuelModule,
  'cannon-siege': cannonSiegeModule,
  'crown-heist': crownHeistModule,
  'freeze-tag': freezeTagModule,
  'ghost-hunt': ghostHuntModule,
  'meteor-swarm': meteorSwarmModule,
  'hook-shot': hookShotModule,
  'gravity-flip': gravityFlipModule,
  'rich-street': richStreetModule,
  'jungle-ladders': jungleLaddersModule,
  'bomb-grid': bombGridModule,
  'red-light-dash': redLightDashModule,
  'color-match': colorMatchModule,
  'kitchen-rush': kitchenRushModule,
  'treasure-dig': treasureDigModule,
  'fruit-drop': fruitDropModule,
  'lucky-auction': luckyAuctionModule,
  'pinball-clash': pinballClashModule,
};

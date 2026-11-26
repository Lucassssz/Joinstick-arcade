import type {
  BotDifficulty,
  CardClientAction,
  CardPrivateState,
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
import { colorClashModule } from './colorClash.ts';
import { liarsDeckModule } from './liarsDeck.ts';
import { volleySmashModule } from './volleySmash.ts';
import { lavaHopperModule } from './lavaHopper.ts';
import { ludoRoyaleModule } from './ludoRoyale.ts';
import { starPartyBoardModule } from './starPartyBoard.ts';
import { reversiClashModule } from './reversiClash.ts';
import { fourInARowModule } from './fourInARow.ts';
import { navalSalvoModule } from './navalSalvo.ts';
import { neonCheckersModule } from './neonCheckers.ts';
import { carromArenaModule } from './carromArena.ts';
import { dungeonCrawlBoardModule } from './dungeonCrawlBoard.ts';
import { boomKittensModule } from './boomKittens.ts';
import { propertyDealModule } from './propertyDeal.ts';
import { flipSevenModule } from './flipSeven.ts';
import { royalBluffModule } from './royalBluff.ts';
import { darkFlipClashModule } from './darkFlipClash.ts';
import { sushiDraftModule } from './sushiDraft.ts';
import {
  deskFlippersModule,
  lineBreakersModule,
  marbleRingModule,
  pitHarvestModule,
  rattanVolleyModule,
  spinClashModule,
  stepStompModule,
} from './packMalaysianArcade.ts';
import {
  bigTwoRoyaleModule,
  lucky21Module,
  tenPairShowdownModule,
} from './packMalaysianCards.ts';
import { adaptPackModule } from './packModuleAdapter.ts';
import {
  blockHopModule,
  clawManiaModule,
  drawGuessRelayModule,
  eggRushModule,
  gooseAlertModule,
  hotpotRushModule,
  melonMergeModule,
  platformLeapModule,
  tileTripleModule,
  truthBombModule,
} from './packChineseViralArcade.ts';
import {
  idiomChainModule,
  landlordClashModule,
  liarsDiceTavernModule,
  midnightWerewolfModule,
  speedMahjongModule,
  undercoverWordModule,
} from './packChineseViralCards.ts';
import {
  blobDevourModule,
  dinoDashModule,
  flappyFlockModule,
  geoPinRushModule,
  glassBridgeModule,
  mineSweepDuelModule,
  skyClimbModule,
  slitherFeastModule,
  tile2048BlitzModule,
  tugTitanModule,
  turfRibbonModule,
  wavelengthSyncModule,
} from './packGlobalViralArcade.ts';
import {
  codenamesGridModule,
  fibPartyModule,
  triviaBlitzModule,
  wordPulseModule,
} from './packGlobalViralCards.ts';
import {
  alienWaveModule,
  barrelTowerModule,
  blockStackModule,
  brickClashModule,
  frogCrossingModule,
  mazeChomperModule,
  rhythmPulseModule,
  whackBlitzModule,
} from './packRetroArcadeA.ts';
import {
  airHockeyNeoModule,
  bubblePopArcModule,
  claySkeetModule,
  coinDozerModule,
  pinStrikeModule,
  skeeRollModule,
  stackTowerModule,
  tunnelDigModule,
} from './packRetroArcadeB.ts';
import {
  archeryWindModule,
  badmintonSmashModule,
  billiardsSnookerModule,
  boxingKoModule,
  canoeSprintModule,
  discArenaModule,
  dodgeballRiotModule,
  homeRunDerbyModule,
  hoopBlitzModule,
  miniGolfProModule,
  penaltyDuelModule,
  pingPongProModule,
  sumoClashModule,
  tetherJoustModule,
} from './packSportsPhysics.ts';
import {
  bombTagArenaModule,
  chainGangClimbModule,
  confettiCaptureModule,
  craneDropChaosModule,
  fallingAnvilsModule,
  hotLavaFloorModule,
  kingOfHillNeoModule,
  laserJumpRopeModule,
  laserMazeHeistModule,
  meteorDodgeXModule,
  musicalThronesModule,
  rouletteArenaModule,
  seesawBalanceModule,
  sumoIceDriftModule,
  zombieOutbreakModule,
} from './packChaosSurvival.ts';
import {
  baccaratClubModule,
  backgammonSprintModule,
  chessBlitzModule,
  curlingMastersModule,
  dominoChainModule,
  gomokuBlitzModule,
  heartsBreakerModule,
  hexagonConquestModule,
  mancalaJewelsModule,
  memoryPairsModule,
  pokerShowdownModule,
  rummyRoyaleModule,
  sequenceJackModule,
  spadesBiddingModule,
  tarotArcanaModule,
} from './packStrategyClassics.ts';
import {
  artilleryCraterWarModule,
  bridgeLoadStressModule,
  hillTorqueClimbModule,
  ropeSlicePhysicsModule,
  slingshotFortressModule,
  threeLaneMetroModule,
  tiltLabyrinthModule,
  trackCrafterGpModule,
  trapBuilderRunModule,
  wobblyTimberPullModule,
} from './packPhysicsBuilder.ts';
import {
  airTrafficLandingModule,
  fishingTensionTugModule,
  hordeSurvivorModule,
  laneTowerBlitzModule,
  movingDayHavocModule,
  pathTowerDefenseModule,
  pipeFlowSprintModule,
  railSwitchRushModule,
  starshipCrewChaosModule,
  swarmHerdClashModule,
} from './packCrewDefense.ts';
import {
  camelStackDerbyModule,
  cornerPolyominoModule,
  gemEngineGuildModule,
  hexInsectChessModule,
  hexIslandSettlersModule,
  mazeWallDuelModule,
  mosaicTileDraftModule,
  pillarAscent3dModule,
  routeExpressModule,
  secretRankFlagsModule,
} from './packTabletopGems.ts';
import {
  deepSeaOxygenModule,
  fireworkHintsModule,
  oneCardCourtModule,
  picrossNonogramModule,
  rowSixBustModule,
  silentSyncModule,
  speedSudokuDuelModule,
  tangramSilhouetteModule,
  tunnelSaboteurModule,
  wordTileCrossroadsModule,
} from './packMindLogic.ts';
import {
  bladeFruitSliceModule,
  chaptehJuggleModule,
  corridorFencingModule,
  fiveSecondMicrogamesModule,
  fiveStonesTossModule,
  halfpipeSkateComboModule,
  pegFeverBounceModule,
  proDarts301Module,
  wauKiteCutModule,
  xiangqiRiverClashModule,
} from './packCultHeritage.ts';

export interface ServerPlayerInputState {
  id: string;
  slotIndex: number;
  name: string;
  color: PlayerColorSpec;
  connected: boolean;
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
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
  privateStates?: Record<string, CardPrivateState>;
  finished: boolean;
  rankings?: RankingEntry[];
}

export interface ServerGameModule<TState = unknown> {
  id: GameId;
  handlesOwnFrenzyMultiplier?: boolean;
  createState(players: ServerPlayerInputState[], settingValue: number): TState;
  addPlayer?(state: TState, player: ServerPlayerInputState): void;
  handleCardAction?(
    state: TState,
    playerId: string,
    action: CardClientAction,
    players: ServerPlayerInputState[]
  ): void;
  getPrivateStates?(state: TState, players: ServerPlayerInputState[]): Record<string, CardPrivateState>;
  step(state: TState, players: ServerPlayerInputState[], dt: number, frenzyActive?: boolean): StepOutput;
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
  'color-clash': colorClashModule,
  'liars-deck': liarsDeckModule,
  'volley-smash': volleySmashModule,
  'lava-hopper': lavaHopperModule,
  'ludo-royale': ludoRoyaleModule,
  'star-party-board': starPartyBoardModule,
  'reversi-clash': reversiClashModule,
  'four-in-a-row': fourInARowModule,
  'naval-salvo': navalSalvoModule,
  'neon-checkers': neonCheckersModule,
  'carrom-arena': carromArenaModule,
  'dungeon-crawl-board': dungeonCrawlBoardModule,
  'boom-kittens': boomKittensModule,
  'property-deal': propertyDealModule,
  'flip-seven': flipSevenModule,
  'royal-bluff': royalBluffModule,
  'dark-flip-clash': darkFlipClashModule,
  'sushi-draft': sushiDraftModule,
  'line-breakers': lineBreakersModule,
  'desk-flippers': deskFlippersModule,
  'spin-clash': spinClashModule,
  'marble-ring': marbleRingModule,
  'rattan-volley': rattanVolleyModule,
  'step-stomp': stepStompModule,
  'pit-harvest': pitHarvestModule,
  'big-two-royale': bigTwoRoyaleModule,
  'lucky-21': lucky21Module,
  'ten-pair-showdown': tenPairShowdownModule,
  // Expansion Pack 2 — 16 Chinese Viral & Party Hits
  'melon-merge': adaptPackModule(melonMergeModule),
  'tile-triple': adaptPackModule(tileTripleModule),
  'block-hop': adaptPackModule(blockHopModule),
  'platform-leap': adaptPackModule(platformLeapModule),
  'egg-rush': adaptPackModule(eggRushModule),
  'goose-alert': adaptPackModule(gooseAlertModule),
  'hotpot-rush': adaptPackModule(hotpotRushModule),
  'claw-mania': adaptPackModule(clawManiaModule),
  'truth-bomb': adaptPackModule(truthBombModule),
  'draw-guess-relay': adaptPackModule(drawGuessRelayModule),
  'landlord-clash': adaptPackModule(landlordClashModule),
  'speed-mahjong': adaptPackModule(speedMahjongModule),
  'liars-dice-tavern': adaptPackModule(liarsDiceTavernModule),
  'undercover-word': adaptPackModule(undercoverWordModule),
  'midnight-werewolf': adaptPackModule(midnightWerewolfModule),
  'idiom-chain': adaptPackModule(idiomChainModule),
  // Expansion Pack 3 — 16 Global & English Viral Internet Hits
  'sky-climb': adaptPackModule(skyClimbModule),
  'slither-feast': adaptPackModule(slitherFeastModule),
  'blob-devour': adaptPackModule(blobDevourModule),
  'turf-ribbon': adaptPackModule(turfRibbonModule),
  'glass-bridge': adaptPackModule(glassBridgeModule),
  'tug-titan': adaptPackModule(tugTitanModule),
  'flappy-flock': adaptPackModule(flappyFlockModule),
  'dino-dash': adaptPackModule(dinoDashModule),
  'tile-2048-blitz': adaptPackModule(tile2048BlitzModule),
  'mine-sweep-duel': adaptPackModule(mineSweepDuelModule),
  'geo-pin-rush': adaptPackModule(geoPinRushModule),
  'wavelength-sync': adaptPackModule(wavelengthSyncModule),
  'word-pulse': adaptPackModule(wordPulseModule),
  'trivia-blitz': adaptPackModule(triviaBlitzModule),
  'codenames-grid': adaptPackModule(codenamesGridModule),
  'fib-party': adaptPackModule(fibPartyModule),
  // Expansion Pack 4 — 16 Retro Arcade & Classic Skill Hits
  'maze-chomper': adaptPackModule(mazeChomperModule),
  'brick-clash': adaptPackModule(brickClashModule),
  'alien-wave': adaptPackModule(alienWaveModule),
  'block-stack': adaptPackModule(blockStackModule),
  'frog-crossing': adaptPackModule(frogCrossingModule),
  'barrel-tower': adaptPackModule(barrelTowerModule),
  'whack-blitz': adaptPackModule(whackBlitzModule),
  'rhythm-pulse': adaptPackModule(rhythmPulseModule),
  'clay-skeet': adaptPackModule(claySkeetModule),
  'air-hockey-neo': adaptPackModule(airHockeyNeoModule),
  'skee-roll': adaptPackModule(skeeRollModule),
  'stack-tower': adaptPackModule(stackTowerModule),
  'tunnel-dig': adaptPackModule(tunnelDigModule),
  'bubble-pop-arc': adaptPackModule(bubblePopArcModule),
  'pin-strike': adaptPackModule(pinStrikeModule),
  'coin-dozer': adaptPackModule(coinDozerModule),
  // Expansion Pack 5 — 14 Sports & Physics Showdowns
  'hoop-blitz': adaptPackModule(hoopBlitzModule),
  'penalty-duel': adaptPackModule(penaltyDuelModule),
  'mini-golf-pro': adaptPackModule(miniGolfProModule),
  'archery-wind': adaptPackModule(archeryWindModule),
  'boxing-ko': adaptPackModule(boxingKoModule),
  'ping-pong-pro': adaptPackModule(pingPongProModule),
  'home-run-derby': adaptPackModule(homeRunDerbyModule),
  'dodgeball-riot': adaptPackModule(dodgeballRiotModule),
  'sumo-clash': adaptPackModule(sumoClashModule),
  'canoe-sprint': adaptPackModule(canoeSprintModule),
  'disc-arena': adaptPackModule(discArenaModule),
  'badminton-smash': adaptPackModule(badmintonSmashModule),
  'billiards-snooker': adaptPackModule(billiardsSnookerModule),
  'tether-joust': adaptPackModule(tetherJoustModule),
  // Expansion Pack 6 — 15 Chaos Party & Survival Games
  'laser-jump-rope': adaptPackModule(laserJumpRopeModule),
  'hot-lava-floor': adaptPackModule(hotLavaFloorModule),
  'bomb-tag-arena': adaptPackModule(bombTagArenaModule),
  'musical-thrones': adaptPackModule(musicalThronesModule),
  'sumo-ice-drift': adaptPackModule(sumoIceDriftModule),
  'meteor-dodge-x': adaptPackModule(meteorDodgeXModule),
  'king-of-hill-neo': adaptPackModule(kingOfHillNeoModule),
  'laser-maze-heist': adaptPackModule(laserMazeHeistModule),
  'zombie-outbreak': adaptPackModule(zombieOutbreakModule),
  'falling-anvils': adaptPackModule(fallingAnvilsModule),
  'seesaw-balance': adaptPackModule(seesawBalanceModule),
  'chain-gang-climb': adaptPackModule(chainGangClimbModule),
  'confetti-capture': adaptPackModule(confettiCaptureModule),
  'crane-drop-chaos': adaptPackModule(craneDropChaosModule),
  'roulette-arena': adaptPackModule(rouletteArenaModule),
  // Expansion Pack 7 — 15 Strategy Board & Card Classics (150 Total Games)
  'gomoku-blitz': adaptPackModule(gomokuBlitzModule),
  'chess-blitz': adaptPackModule(chessBlitzModule),
  'domino-chain': adaptPackModule(dominoChainModule),
  'hexagon-conquest': adaptPackModule(hexagonConquestModule),
  'backgammon-sprint': adaptPackModule(backgammonSprintModule),
  'mancala-jewels': adaptPackModule(mancalaJewelsModule),
  'curling-masters': adaptPackModule(curlingMastersModule),
  'rummy-royale': adaptPackModule(rummyRoyaleModule),
  'hearts-breaker': adaptPackModule(heartsBreakerModule),
  'spades-bidding': adaptPackModule(spadesBiddingModule),
  'poker-showdown': adaptPackModule(pokerShowdownModule),
  'tarot-arcana': adaptPackModule(tarotArcanaModule),
  'baccarat-club': adaptPackModule(baccaratClubModule),
  'memory-pairs': adaptPackModule(memoryPairsModule),
  'sequence-jack': adaptPackModule(sequenceJackModule),
  // Expansion Pack 8 — Physics & Trap-Builder Action
  'trap-builder-run': adaptPackModule(trapBuilderRunModule),
  'track-crafter-gp': adaptPackModule(trackCrafterGpModule),
  'slingshot-fortress': adaptPackModule(slingshotFortressModule),
  'rope-slice-physics': adaptPackModule(ropeSlicePhysicsModule),
  'wobbly-timber-pull': adaptPackModule(wobblyTimberPullModule),
  'artillery-crater-war': adaptPackModule(artilleryCraterWarModule),
  'bridge-load-stress': adaptPackModule(bridgeLoadStressModule),
  'hill-torque-climb': adaptPackModule(hillTorqueClimbModule),
  'three-lane-metro': adaptPackModule(threeLaneMetroModule),
  'tilt-labyrinth': adaptPackModule(tiltLabyrinthModule),
  // Expansion Pack 9 — Tactical Crew, Tower Defense & Horde
  'lane-tower-blitz': adaptPackModule(laneTowerBlitzModule),
  'path-tower-defense': adaptPackModule(pathTowerDefenseModule),
  'horde-survivor': adaptPackModule(hordeSurvivorModule),
  'starship-crew-chaos': adaptPackModule(starshipCrewChaosModule),
  'swarm-herd-clash': adaptPackModule(swarmHerdClashModule),
  'rail-switch-rush': adaptPackModule(railSwitchRushModule),
  'air-traffic-landing': adaptPackModule(airTrafficLandingModule),
  'pipe-flow-sprint': adaptPackModule(pipeFlowSprintModule),
  'moving-day-havoc': adaptPackModule(movingDayHavocModule),
  'fishing-tension-tug': adaptPackModule(fishingTensionTugModule),
  // Expansion Pack 10 — Tabletop Strategy Gems & Card Showdowns
  'mosaic-tile-draft': adaptPackModule(mosaicTileDraftModule),
  'maze-wall-duel': adaptPackModule(mazeWallDuelModule),
  'corner-polyomino': adaptPackModule(cornerPolyominoModule),
  'pillar-ascent-3d': adaptPackModule(pillarAscent3dModule),
  'camel-stack-derby': adaptPackModule(camelStackDerbyModule),
  'route-express': adaptPackModule(routeExpressModule),
  'gem-engine-guild': adaptPackModule(gemEngineGuildModule),
  'hex-island-settlers': adaptPackModule(hexIslandSettlersModule),
  'hex-insect-chess': adaptPackModule(hexInsectChessModule),
  'secret-rank-flags': adaptPackModule(secretRankFlagsModule),
  // Expansion Pack 11 — Social Mind-Games & Logic Speedruns
  'row-six-bust': adaptPackModule(rowSixBustModule),
  'silent-sync': adaptPackModule(silentSyncModule),
  'deep-sea-oxygen': adaptPackModule(deepSeaOxygenModule),
  'one-card-court': adaptPackModule(oneCardCourtModule),
  'firework-hints': adaptPackModule(fireworkHintsModule),
  'tunnel-saboteur': adaptPackModule(tunnelSaboteurModule),
  'picross-nonogram': adaptPackModule(picrossNonogramModule),
  'speed-sudoku-duel': adaptPackModule(speedSudokuDuelModule),
  'word-tile-crossroads': adaptPackModule(wordTileCrossroadsModule),
  'tangram-silhouette': adaptPackModule(tangramSilhouetteModule),
  // Expansion Pack 12 — Cult Classics & SEA Cultural Heritage (200 Total Games)
  'blade-fruit-slice': adaptPackModule(bladeFruitSliceModule),
  'peg-fever-bounce': adaptPackModule(pegFeverBounceModule),
  'halfpipe-skate-combo': adaptPackModule(halfpipeSkateComboModule),
  'five-second-microgames': adaptPackModule(fiveSecondMicrogamesModule),
  'corridor-fencing': adaptPackModule(corridorFencingModule),
  'pro-darts-301': adaptPackModule(proDarts301Module),
  'wau-kite-cut': adaptPackModule(wauKiteCutModule),
  'five-stones-toss': adaptPackModule(fiveStonesTossModule),
  'chapteh-juggle': adaptPackModule(chaptehJuggleModule),
  'xiangqi-river-clash': adaptPackModule(xiangqiRiverClashModule),
};

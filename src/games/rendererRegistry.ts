import { type GameId, type GameSnapshot } from '../shared/types';
import { getGameMeta } from '../shared/games';
import { renderLavaHopper, renderVolleySmash } from './newArcadeRenderers';
import {
  renderFourInARow,
  renderLudoRoyale,
  renderReversiClash,
  renderStarPartyBoard,
} from './newBoardRenderersA';
import {
  renderCarromArena,
  renderDungeonCrawlBoard,
  renderNavalSalvo,
  renderNeonCheckers,
} from './newBoardRenderersB';
import {
  renderBoomKittens,
  renderDarkFlipClash,
  renderFlipSeven,
  renderPropertyDeal,
  renderRoyalBluff,
  renderSushiDraft,
} from './newCardRenderers';
import {
  renderBigTwoRoyale,
  renderDeskFlippers,
  renderLineBreakers,
  renderLucky21,
  renderMarbleRing,
  renderPitHarvest,
  renderRattanVolley,
  renderSpinClash,
  renderStepStomp,
  renderTenPairShowdown,
} from './packMalaysianRenderers';
import {
  renderBlockHop,
  renderClawMania,
  renderDrawGuessRelay,
  renderEggRush,
  renderGooseAlert,
  renderHotpotRush,
  renderMelonMerge,
  renderPlatformLeap,
  renderTileTriple,
  renderTruthBomb,
} from './packChineseViralArcadeRenderers';
import {
  renderIdiomChain,
  renderLandlordClash,
  renderLiarsDiceTavern,
  renderMidnightWerewolf,
  renderSpeedMahjong,
  renderUndercoverWord,
} from './packChineseViralCardRenderers';
import {
  renderBlobDevour,
  renderDinoDash,
  renderFlappyFlock,
  renderGeoPinRush,
  renderGlassBridge,
  renderMineSweepDuel,
  renderSkyClimb,
  renderSlitherFeast,
  renderTile2048Blitz,
  renderTugTitan,
  renderTurfRibbon,
  renderWavelengthSync,
} from './packGlobalViralArcadeRenderers';
import {
  renderCodeGrid,
  renderFibParty,
  renderTriviaBlitz,
  renderWordPulse,
} from './packGlobalViralCardRenderers';
import {
  renderAlienWave,
  renderBarrelTower,
  renderBlockStack,
  renderBrickClash,
  renderFrogCrossing,
  renderMazeChomper,
  renderRhythmPulse,
  renderWhackBlitz,
} from './packRetroArcadeRenderersA';
import {
  renderAirHockeyNeo,
  renderBubblePopArc,
  renderClaySkeet,
  renderCoinDozer,
  renderPinStrike,
  renderSkeeRoll,
  renderStackTower,
  renderTunnelDig,
} from './packRetroArcadeRenderersB';
import {
  renderArcheryWind,
  renderBadmintonSmash,
  renderBilliardsSnooker,
  renderBoxingKo,
  renderCanoeSprint,
  renderDiscArena,
  renderDodgeballRiot,
  renderHomeRunDerby,
  renderHoopBlitz,
  renderMiniGolfPro,
  renderPenaltyDuel,
  renderPingPongPro,
  renderSumoClash,
  renderTetherJoust,
} from './packSportsPhysicsRenderers';
import {
  renderBombTagArena,
  renderChainGangClimb,
  renderConfettiCapture,
  renderCraneDropChaos,
  renderFallingAnvils,
  renderHotLavaFloor,
  renderKingOfHillNeo,
  renderLaserJumpRope,
  renderLaserMazeHeist,
  renderMeteorDodgeX,
  renderMusicalThrones,
  renderRouletteArena,
  renderSeesawBalance,
  renderSumoIceDrift,
  renderZombieOutbreak,
} from './packChaosSurvivalRenderers';
import {
  renderBaccaratClub,
  renderBackgammonSprint,
  renderChessBlitz,
  renderCurlingMasters,
  renderDominoChain,
  renderGomokuBlitz,
  renderHeartsBreaker,
  renderHexagonConquest,
  renderMancalaJewels,
  renderMemoryPairs,
  renderPokerShowdown,
  renderRummyRoyale,
  renderSequenceJack,
  renderSpadesBidding,
  renderTarotArcana,
} from './packStrategyClassicsRenderers';
import {
  renderArtilleryCraterWar,
  renderBridgeLoadStress,
  renderHillTorqueClimb,
  renderRopeSlicePhysics,
  renderSlingshotFortress,
  renderThreeLaneMetro,
  renderTiltLabyrinth,
  renderTrackCrafterGp,
  renderTrapBuilderRun,
  renderWobblyTimberPull,
} from './packPhysicsBuilderRenderers';
import {
  renderAirTrafficLanding,
  renderFishingTensionTug,
  renderHordeSurvivor,
  renderLaneTowerBlitz,
  renderMovingDayHavoc,
  renderPathTowerDefense,
  renderPipeFlowSprint,
  renderRailSwitchRush,
  renderStarshipCrewChaos,
  renderSwarmHerdClash,
} from './packCrewDefenseRenderers';
import {
  renderCamelStackDerby,
  renderCornerPolyomino,
  renderGemEngineGuild,
  renderHexInsectChess,
  renderHexIslandSettlers,
  renderMazeWallDuel,
  renderMosaicTileDraft,
  renderPillarAscent3d,
  renderRouteExpress,
  renderSecretRankFlags,
} from './packTabletopGemsRenderers';
import {
  renderDeepSeaOxygen,
  renderFireworkHints,
  renderOneCardCourt,
  renderPicrossNonogram,
  renderRowSixBust,
  renderSilentSync,
  renderSpeedSudokuDuel,
  renderTangramSilhouette,
  renderTunnelSaboteur,
  renderWordTileCrossroads,
} from './packMindLogicRenderers';
import {
  renderBladeFruitSlice,
  renderChaptehJuggle,
  renderCorridorFencing,
  renderFiveSecondMicrogames,
  renderFiveStonesToss,
  renderHalfpipeSkateCombo,
  renderPegFeverBounce,
  renderProDarts301,
  renderWauKiteCut,
  renderXiangqiRiverClash,
} from './packCultHeritageRenderers';

type ModularRendererFn = (ctx: CanvasRenderingContext2D, snap: any) => void;

const preloadedImages = new Set<string>();

/**
 * Synchronous static renderer map for all 118 expansion-pack games (150 total games with core 32).
 * Bundled directly so 5-Game Cup Mode, random votes, thumbnails, and live matches render
 * immediately on Frame 0 with zero network chunk latency or "LOADING ARENA MODULE..." stalls.
 */
const STATIC_MODULAR_RENDERERS: Partial<Record<GameId, ModularRendererFn>> = {
  'volley-smash': renderVolleySmash,
  'lava-hopper': renderLavaHopper,
  'ludo-royale': renderLudoRoyale,
  'star-party-board': renderStarPartyBoard,
  'reversi-clash': renderReversiClash,
  'four-in-a-row': renderFourInARow,
  'naval-salvo': renderNavalSalvo,
  'neon-checkers': renderNeonCheckers,
  'carrom-arena': renderCarromArena,
  'dungeon-crawl-board': renderDungeonCrawlBoard,
  'boom-kittens': renderBoomKittens,
  'property-deal': renderPropertyDeal,
  'flip-seven': renderFlipSeven,
  'royal-bluff': renderRoyalBluff,
  'dark-flip-clash': renderDarkFlipClash,
  'sushi-draft': renderSushiDraft,
  // Expansion Pack 1 — Malaysian Heritage & CNY Classics
  'line-breakers': renderLineBreakers,
  'desk-flippers': renderDeskFlippers,
  'spin-clash': renderSpinClash,
  'marble-ring': renderMarbleRing,
  'rattan-volley': renderRattanVolley,
  'step-stomp': renderStepStomp,
  'pit-harvest': renderPitHarvest,
  'big-two-royale': renderBigTwoRoyale,
  'lucky-21': renderLucky21,
  'ten-pair-showdown': renderTenPairShowdown,
  // Expansion Pack 2 — 16 Chinese Viral & Party Hits
  'melon-merge': renderMelonMerge,
  'tile-triple': renderTileTriple,
  'block-hop': renderBlockHop,
  'platform-leap': renderPlatformLeap,
  'egg-rush': renderEggRush,
  'goose-alert': renderGooseAlert,
  'hotpot-rush': renderHotpotRush,
  'claw-mania': renderClawMania,
  'truth-bomb': renderTruthBomb,
  'draw-guess-relay': renderDrawGuessRelay,
  'landlord-clash': renderLandlordClash,
  'speed-mahjong': renderSpeedMahjong,
  'liars-dice-tavern': renderLiarsDiceTavern,
  'undercover-word': renderUndercoverWord,
  'midnight-werewolf': renderMidnightWerewolf,
  'idiom-chain': renderIdiomChain,
  // Expansion Pack 3 — 16 Global & English Viral Internet Hits
  'sky-climb': renderSkyClimb,
  'slither-feast': renderSlitherFeast,
  'blob-devour': renderBlobDevour,
  'turf-ribbon': renderTurfRibbon,
  'glass-bridge': renderGlassBridge,
  'tug-titan': renderTugTitan,
  'flappy-flock': renderFlappyFlock,
  'dino-dash': renderDinoDash,
  'tile-2048-blitz': renderTile2048Blitz,
  'mine-sweep-duel': renderMineSweepDuel,
  'geo-pin-rush': renderGeoPinRush,
  'wavelength-sync': renderWavelengthSync,
  'word-pulse': renderWordPulse,
  'trivia-blitz': renderTriviaBlitz,
  'codenames-grid': renderCodeGrid,
  'fib-party': renderFibParty,
  // Expansion Pack 4 — 16 Retro Arcade & Classic Skill Hits
  'maze-chomper': renderMazeChomper,
  'brick-clash': renderBrickClash,
  'alien-wave': renderAlienWave,
  'block-stack': renderBlockStack,
  'frog-crossing': renderFrogCrossing,
  'barrel-tower': renderBarrelTower,
  'whack-blitz': renderWhackBlitz,
  'rhythm-pulse': renderRhythmPulse,
  'clay-skeet': renderClaySkeet,
  'air-hockey-neo': renderAirHockeyNeo,
  'skee-roll': renderSkeeRoll,
  'stack-tower': renderStackTower,
  'tunnel-dig': renderTunnelDig,
  'bubble-pop-arc': renderBubblePopArc,
  'pin-strike': renderPinStrike,
  'coin-dozer': renderCoinDozer,
  // Expansion Pack 5 — 14 Sports & Physics Showdowns
  'hoop-blitz': renderHoopBlitz,
  'penalty-duel': renderPenaltyDuel,
  'mini-golf-pro': renderMiniGolfPro,
  'archery-wind': renderArcheryWind,
  'boxing-ko': renderBoxingKo,
  'ping-pong-pro': renderPingPongPro,
  'home-run-derby': renderHomeRunDerby,
  'dodgeball-riot': renderDodgeballRiot,
  'sumo-clash': renderSumoClash,
  'canoe-sprint': renderCanoeSprint,
  'disc-arena': renderDiscArena,
  'badminton-smash': renderBadmintonSmash,
  'billiards-snooker': renderBilliardsSnooker,
  'tether-joust': renderTetherJoust,
  // Expansion Pack 6 — 15 Chaos Party & Survival Games
  'laser-jump-rope': renderLaserJumpRope,
  'hot-lava-floor': renderHotLavaFloor,
  'bomb-tag-arena': renderBombTagArena,
  'musical-thrones': renderMusicalThrones,
  'sumo-ice-drift': renderSumoIceDrift,
  'meteor-dodge-x': renderMeteorDodgeX,
  'king-of-hill-neo': renderKingOfHillNeo,
  'laser-maze-heist': renderLaserMazeHeist,
  'zombie-outbreak': renderZombieOutbreak,
  'falling-anvils': renderFallingAnvils,
  'seesaw-balance': renderSeesawBalance,
  'chain-gang-climb': renderChainGangClimb,
  'confetti-capture': renderConfettiCapture,
  'crane-drop-chaos': renderCraneDropChaos,
  'roulette-arena': renderRouletteArena,
  // Expansion Pack 7 — 15 Strategy Board & Card Classics (150 Total Games)
  'gomoku-blitz': renderGomokuBlitz,
  'chess-blitz': renderChessBlitz,
  'domino-chain': renderDominoChain,
  'hexagon-conquest': renderHexagonConquest,
  'backgammon-sprint': renderBackgammonSprint,
  'mancala-jewels': renderMancalaJewels,
  'curling-masters': renderCurlingMasters,
  'rummy-royale': renderRummyRoyale,
  'hearts-breaker': renderHeartsBreaker,
  'spades-bidding': renderSpadesBidding,
  'poker-showdown': renderPokerShowdown,
  'tarot-arcana': renderTarotArcana,
  'baccarat-club': renderBaccaratClub,
  'memory-pairs': renderMemoryPairs,
  'sequence-jack': renderSequenceJack,
  // Expansion Pack 8 — Physics & Trap-Builder Action
  'trap-builder-run': renderTrapBuilderRun,
  'track-crafter-gp': renderTrackCrafterGp,
  'slingshot-fortress': renderSlingshotFortress,
  'rope-slice-physics': renderRopeSlicePhysics,
  'wobbly-timber-pull': renderWobblyTimberPull,
  'artillery-crater-war': renderArtilleryCraterWar,
  'bridge-load-stress': renderBridgeLoadStress,
  'hill-torque-climb': renderHillTorqueClimb,
  'three-lane-metro': renderThreeLaneMetro,
  'tilt-labyrinth': renderTiltLabyrinth,
  // Expansion Pack 9 — Tactical Crew, Tower Defense & Horde
  'lane-tower-blitz': renderLaneTowerBlitz,
  'path-tower-defense': renderPathTowerDefense,
  'horde-survivor': renderHordeSurvivor,
  'starship-crew-chaos': renderStarshipCrewChaos,
  'swarm-herd-clash': renderSwarmHerdClash,
  'rail-switch-rush': renderRailSwitchRush,
  'air-traffic-landing': renderAirTrafficLanding,
  'pipe-flow-sprint': renderPipeFlowSprint,
  'moving-day-havoc': renderMovingDayHavoc,
  'fishing-tension-tug': renderFishingTensionTug,
  // Expansion Pack 10 — Tabletop Strategy Gems & Card Showdowns
  'mosaic-tile-draft': renderMosaicTileDraft,
  'maze-wall-duel': renderMazeWallDuel,
  'corner-polyomino': renderCornerPolyomino,
  'pillar-ascent-3d': renderPillarAscent3d,
  'camel-stack-derby': renderCamelStackDerby,
  'route-express': renderRouteExpress,
  'gem-engine-guild': renderGemEngineGuild,
  'hex-island-settlers': renderHexIslandSettlers,
  'hex-insect-chess': renderHexInsectChess,
  'secret-rank-flags': renderSecretRankFlags,
  // Expansion Pack 11 — Social Mind-Games & Logic Speedruns
  'row-six-bust': renderRowSixBust,
  'silent-sync': renderSilentSync,
  'deep-sea-oxygen': renderDeepSeaOxygen,
  'one-card-court': renderOneCardCourt,
  'firework-hints': renderFireworkHints,
  'tunnel-saboteur': renderTunnelSaboteur,
  'picross-nonogram': renderPicrossNonogram,
  'speed-sudoku-duel': renderSpeedSudokuDuel,
  'word-tile-crossroads': renderWordTileCrossroads,
  'tangram-silhouette': renderTangramSilhouette,
  // Expansion Pack 12 — Cult Classics & SEA Cultural Heritage (200 Total Games)
  'blade-fruit-slice': renderBladeFruitSlice,
  'peg-fever-bounce': renderPegFeverBounce,
  'halfpipe-skate-combo': renderHalfpipeSkateCombo,
  'five-second-microgames': renderFiveSecondMicrogames,
  'corridor-fencing': renderCorridorFencing,
  'pro-darts-301': renderProDarts301,
  'wau-kite-cut': renderWauKiteCut,
  'five-stones-toss': renderFiveStonesToss,
  'chapteh-juggle': renderChaptehJuggle,
  'xiangqi-river-clash': renderXiangqiRiverClash,
};

/**
 * All modular game renderers are bundled synchronously, so this resolves immediately.
 */
export async function ensureGameRendererLoaded(_gameId: GameId): Promise<void> {
  return;
}

/**
 * Preloads a game's cover artwork in the background.
 */
export function preloadGameRenderer(gameId: GameId): void {
  if (typeof window !== 'undefined') {
    const meta = getGameMeta(gameId);
    if (meta?.coverImage && !preloadedImages.has(meta.coverImage)) {
      preloadedImages.add(meta.coverImage);
      const img = new Image();
      img.decoding = 'async';
      img.src = meta.coverImage;
    }
  }
}

/**
 * Renders a modularly registered game snapshot synchronously.
 */
export function renderModularGame(
  ctx: CanvasRenderingContext2D,
  snap: GameSnapshot
): boolean {
  const fn = STATIC_MODULAR_RENDERERS[snap.gameId];
  if (fn) {
    fn(ctx, snap);
    return true;
  }
  return false;
}


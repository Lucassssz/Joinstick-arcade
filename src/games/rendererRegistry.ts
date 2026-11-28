import { type GameId, type GameSnapshot } from '../shared/types';
import { getGameMeta } from '../shared/games';

type ModularRendererFn = (ctx: CanvasRenderingContext2D, snap: any) => void;

interface RendererGroupSpec {
  id: string;
  load: () => Promise<Record<string, unknown>>;
  exports: Partial<Record<GameId, string>>;
}

const preloadedImages = new Set<string>();
const LOADED_MODULAR_RENDERERS: Partial<Record<GameId, ModularRendererFn>> = {};
const inflightGroupLoads = new Map<string, Promise<void>>();

/**
 * Dynamic-import renderer groups for all 168 expansion-pack games (200 total games with core 32).
 * Each group is split into its own JS chunk and loaded on demand before a match starts or a
 * thumbnail/preview renders, keeping the live canvas render loop 100% synchronous.
 */
const RENDERER_GROUPS: RendererGroupSpec[] = [
  {
    id: 'newArcade',
    load: () => import('./newArcadeRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'volley-smash': 'renderVolleySmash',
      'lava-hopper': 'renderLavaHopper',
    },
  },
  {
    id: 'newBoardA',
    load: () => import('./newBoardRenderersA') as Promise<Record<string, unknown>>,
    exports: {
      'ludo-royale': 'renderLudoRoyale',
      'star-party-board': 'renderStarPartyBoard',
      'reversi-clash': 'renderReversiClash',
      'four-in-a-row': 'renderFourInARow',
    },
  },
  {
    id: 'newBoardB',
    load: () => import('./newBoardRenderersB') as Promise<Record<string, unknown>>,
    exports: {
      'naval-salvo': 'renderNavalSalvo',
      'neon-checkers': 'renderNeonCheckers',
      'carrom-arena': 'renderCarromArena',
      'dungeon-crawl-board': 'renderDungeonCrawlBoard',
    },
  },
  {
    id: 'newCard',
    load: () => import('./newCardRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'boom-kittens': 'renderBoomKittens',
      'property-deal': 'renderPropertyDeal',
      'flip-seven': 'renderFlipSeven',
      'royal-bluff': 'renderRoyalBluff',
      'dark-flip-clash': 'renderDarkFlipClash',
      'sushi-draft': 'renderSushiDraft',
    },
  },
  // Expansion Pack 1 — Malaysian Heritage & CNY Classics
  {
    id: 'packMalaysian',
    load: () => import('./packMalaysianRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'line-breakers': 'renderLineBreakers',
      'desk-flippers': 'renderDeskFlippers',
      'spin-clash': 'renderSpinClash',
      'marble-ring': 'renderMarbleRing',
      'rattan-volley': 'renderRattanVolley',
      'step-stomp': 'renderStepStomp',
      'pit-harvest': 'renderPitHarvest',
      'big-two-royale': 'renderBigTwoRoyale',
      'lucky-21': 'renderLucky21',
      'ten-pair-showdown': 'renderTenPairShowdown',
    },
  },
  // Expansion Pack 2 — 16 Chinese Viral & Party Hits
  {
    id: 'packChineseViralArcade',
    load: () => import('./packChineseViralArcadeRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'melon-merge': 'renderMelonMerge',
      'tile-triple': 'renderTileTriple',
      'block-hop': 'renderBlockHop',
      'platform-leap': 'renderPlatformLeap',
      'egg-rush': 'renderEggRush',
      'goose-alert': 'renderGooseAlert',
      'hotpot-rush': 'renderHotpotRush',
      'claw-mania': 'renderClawMania',
      'truth-bomb': 'renderTruthBomb',
      'draw-guess-relay': 'renderDrawGuessRelay',
    },
  },
  {
    id: 'packChineseViralCard',
    load: () => import('./packChineseViralCardRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'landlord-clash': 'renderLandlordClash',
      'speed-mahjong': 'renderSpeedMahjong',
      'liars-dice-tavern': 'renderLiarsDiceTavern',
      'undercover-word': 'renderUndercoverWord',
      'midnight-werewolf': 'renderMidnightWerewolf',
      'idiom-chain': 'renderIdiomChain',
    },
  },
  // Expansion Pack 3 — 16 Global & English Viral Internet Hits
  {
    id: 'packGlobalViralArcade',
    load: () => import('./packGlobalViralArcadeRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'sky-climb': 'renderSkyClimb',
      'slither-feast': 'renderSlitherFeast',
      'blob-devour': 'renderBlobDevour',
      'turf-ribbon': 'renderTurfRibbon',
      'glass-bridge': 'renderGlassBridge',
      'tug-titan': 'renderTugTitan',
      'flappy-flock': 'renderFlappyFlock',
      'dino-dash': 'renderDinoDash',
      'tile-2048-blitz': 'renderTile2048Blitz',
      'mine-sweep-duel': 'renderMineSweepDuel',
      'geo-pin-rush': 'renderGeoPinRush',
      'wavelength-sync': 'renderWavelengthSync',
    },
  },
  {
    id: 'packGlobalViralCard',
    load: () => import('./packGlobalViralCardRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'word-pulse': 'renderWordPulse',
      'trivia-blitz': 'renderTriviaBlitz',
      'codenames-grid': 'renderCodeGrid',
      'fib-party': 'renderFibParty',
    },
  },
  // Expansion Pack 4 — 16 Retro Arcade & Classic Skill Hits
  {
    id: 'packRetroArcadeA',
    load: () => import('./packRetroArcadeRenderersA') as Promise<Record<string, unknown>>,
    exports: {
      'maze-chomper': 'renderMazeChomper',
      'brick-clash': 'renderBrickClash',
      'alien-wave': 'renderAlienWave',
      'block-stack': 'renderBlockStack',
      'frog-crossing': 'renderFrogCrossing',
      'barrel-tower': 'renderBarrelTower',
      'whack-blitz': 'renderWhackBlitz',
      'rhythm-pulse': 'renderRhythmPulse',
    },
  },
  {
    id: 'packRetroArcadeB',
    load: () => import('./packRetroArcadeRenderersB') as Promise<Record<string, unknown>>,
    exports: {
      'clay-skeet': 'renderClaySkeet',
      'air-hockey-neo': 'renderAirHockeyNeo',
      'skee-roll': 'renderSkeeRoll',
      'stack-tower': 'renderStackTower',
      'tunnel-dig': 'renderTunnelDig',
      'bubble-pop-arc': 'renderBubblePopArc',
      'pin-strike': 'renderPinStrike',
      'coin-dozer': 'renderCoinDozer',
    },
  },
  // Expansion Pack 5 — 14 Sports & Physics Showdowns
  {
    id: 'packSportsPhysics',
    load: () => import('./packSportsPhysicsRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'hoop-blitz': 'renderHoopBlitz',
      'penalty-duel': 'renderPenaltyDuel',
      'mini-golf-pro': 'renderMiniGolfPro',
      'archery-wind': 'renderArcheryWind',
      'boxing-ko': 'renderBoxingKo',
      'ping-pong-pro': 'renderPingPongPro',
      'home-run-derby': 'renderHomeRunDerby',
      'dodgeball-riot': 'renderDodgeballRiot',
      'sumo-clash': 'renderSumoClash',
      'canoe-sprint': 'renderCanoeSprint',
      'disc-arena': 'renderDiscArena',
      'badminton-smash': 'renderBadmintonSmash',
      'billiards-snooker': 'renderBilliardsSnooker',
      'tether-joust': 'renderTetherJoust',
    },
  },
  // Expansion Pack 6 — 15 Chaos Party & Survival Games
  {
    id: 'packChaosSurvival',
    load: () => import('./packChaosSurvivalRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'laser-jump-rope': 'renderLaserJumpRope',
      'hot-lava-floor': 'renderHotLavaFloor',
      'bomb-tag-arena': 'renderBombTagArena',
      'musical-thrones': 'renderMusicalThrones',
      'sumo-ice-drift': 'renderSumoIceDrift',
      'meteor-dodge-x': 'renderMeteorDodgeX',
      'king-of-hill-neo': 'renderKingOfHillNeo',
      'laser-maze-heist': 'renderLaserMazeHeist',
      'zombie-outbreak': 'renderZombieOutbreak',
      'falling-anvils': 'renderFallingAnvils',
      'seesaw-balance': 'renderSeesawBalance',
      'chain-gang-climb': 'renderChainGangClimb',
      'confetti-capture': 'renderConfettiCapture',
      'crane-drop-chaos': 'renderCraneDropChaos',
      'roulette-arena': 'renderRouletteArena',
    },
  },
  // Expansion Pack 7 — 15 Strategy Board & Card Classics
  {
    id: 'packStrategyClassics',
    load: () => import('./packStrategyClassicsRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'gomoku-blitz': 'renderGomokuBlitz',
      'chess-blitz': 'renderChessBlitz',
      'domino-chain': 'renderDominoChain',
      'hexagon-conquest': 'renderHexagonConquest',
      'backgammon-sprint': 'renderBackgammonSprint',
      'mancala-jewels': 'renderMancalaJewels',
      'curling-masters': 'renderCurlingMasters',
      'rummy-royale': 'renderRummyRoyale',
      'hearts-breaker': 'renderHeartsBreaker',
      'spades-bidding': 'renderSpadesBidding',
      'poker-showdown': 'renderPokerShowdown',
      'tarot-arcana': 'renderTarotArcana',
      'baccarat-club': 'renderBaccaratClub',
      'memory-pairs': 'renderMemoryPairs',
      'sequence-jack': 'renderSequenceJack',
    },
  },
  // Expansion Pack 8 — Physics & Trap-Builder Action
  {
    id: 'packPhysicsBuilder',
    load: () => import('./packPhysicsBuilderRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'trap-builder-run': 'renderTrapBuilderRun',
      'track-crafter-gp': 'renderTrackCrafterGp',
      'slingshot-fortress': 'renderSlingshotFortress',
      'rope-slice-physics': 'renderRopeSlicePhysics',
      'wobbly-timber-pull': 'renderWobblyTimberPull',
      'artillery-crater-war': 'renderArtilleryCraterWar',
      'bridge-load-stress': 'renderBridgeLoadStress',
      'hill-torque-climb': 'renderHillTorqueClimb',
      'three-lane-metro': 'renderThreeLaneMetro',
      'tilt-labyrinth': 'renderTiltLabyrinth',
    },
  },
  // Expansion Pack 9 — Tactical Crew, Tower Defense & Horde
  {
    id: 'packCrewDefense',
    load: () => import('./packCrewDefenseRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'lane-tower-blitz': 'renderLaneTowerBlitz',
      'path-tower-defense': 'renderPathTowerDefense',
      'horde-survivor': 'renderHordeSurvivor',
      'starship-crew-chaos': 'renderStarshipCrewChaos',
      'swarm-herd-clash': 'renderSwarmHerdClash',
      'rail-switch-rush': 'renderRailSwitchRush',
      'air-traffic-landing': 'renderAirTrafficLanding',
      'pipe-flow-sprint': 'renderPipeFlowSprint',
      'moving-day-havoc': 'renderMovingDayHavoc',
      'fishing-tension-tug': 'renderFishingTensionTug',
    },
  },
  // Expansion Pack 10 — Tabletop Strategy Gems & Card Showdowns
  {
    id: 'packTabletopGems',
    load: () => import('./packTabletopGemsRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'mosaic-tile-draft': 'renderMosaicTileDraft',
      'maze-wall-duel': 'renderMazeWallDuel',
      'corner-polyomino': 'renderCornerPolyomino',
      'pillar-ascent-3d': 'renderPillarAscent3d',
      'camel-stack-derby': 'renderCamelStackDerby',
      'route-express': 'renderRouteExpress',
      'gem-engine-guild': 'renderGemEngineGuild',
      'hex-island-settlers': 'renderHexIslandSettlers',
      'hex-insect-chess': 'renderHexInsectChess',
      'secret-rank-flags': 'renderSecretRankFlags',
    },
  },
  // Expansion Pack 11 — Social Mind-Games & Logic Speedruns
  {
    id: 'packMindLogic',
    load: () => import('./packMindLogicRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'row-six-bust': 'renderRowSixBust',
      'silent-sync': 'renderSilentSync',
      'deep-sea-oxygen': 'renderDeepSeaOxygen',
      'one-card-court': 'renderOneCardCourt',
      'firework-hints': 'renderFireworkHints',
      'tunnel-saboteur': 'renderTunnelSaboteur',
      'picross-nonogram': 'renderPicrossNonogram',
      'speed-sudoku-duel': 'renderSpeedSudokuDuel',
      'word-tile-crossroads': 'renderWordTileCrossroads',
      'tangram-silhouette': 'renderTangramSilhouette',
    },
  },
  // Expansion Pack 12 — Cult Classics & SEA Cultural Heritage
  {
    id: 'packCultHeritage',
    load: () => import('./packCultHeritageRenderers') as Promise<Record<string, unknown>>,
    exports: {
      'blade-fruit-slice': 'renderBladeFruitSlice',
      'peg-fever-bounce': 'renderPegFeverBounce',
      'halfpipe-skate-combo': 'renderHalfpipeSkateCombo',
      'five-second-microgames': 'renderFiveSecondMicrogames',
      'corridor-fencing': 'renderCorridorFencing',
      'pro-darts-301': 'renderProDarts301',
      'wau-kite-cut': 'renderWauKiteCut',
      'five-stones-toss': 'renderFiveStonesToss',
      'chapteh-juggle': 'renderChaptehJuggle',
      'xiangqi-river-clash': 'renderXiangqiRiverClash',
    },
  },
];

const GAME_TO_GROUP: Partial<Record<GameId, RendererGroupSpec>> = {};
for (const group of RENDERER_GROUPS) {
  for (const gameId of Object.keys(group.exports) as GameId[]) {
    GAME_TO_GROUP[gameId] = group;
  }
}

function preloadCoverImage(gameId: GameId): void {
  if (typeof window === 'undefined') return;
  const meta = getGameMeta(gameId);
  if (meta?.coverImage && !preloadedImages.has(meta.coverImage)) {
    preloadedImages.add(meta.coverImage);
    const img = new Image();
    img.decoding = 'async';
    img.src = meta.coverImage;
  }
}

/**
 * Returns true when the renderer for `gameId` can execute synchronously in the canvas loop.
 * Core 32 games in renderers.ts are always ready; modular pack games are ready once loaded.
 */
export function isGameRendererReady(gameId: GameId): boolean {
  const group = GAME_TO_GROUP[gameId];
  return !group || Boolean(LOADED_MODULAR_RENDERERS[gameId]);
}

/**
 * Loads the dynamic renderer chunk for `gameId` (if it is an expansion-pack game)
 * and registers all renderers in that pack group synchronously. Rejects on load failure
 * and clears the in-flight cache so subsequent retries attempt a fresh import.
 */
export async function ensureGameRendererLoaded(gameId: GameId): Promise<void> {
  if (LOADED_MODULAR_RENDERERS[gameId]) return;
  const group = GAME_TO_GROUP[gameId];
  if (!group) return;

  let task = inflightGroupLoads.get(group.id);
  if (!task) {
    task = group
      .load()
      .then((mod) => {
        for (const [gId, exportName] of Object.entries(group.exports)) {
          const fn = mod[exportName as string];
          if (typeof fn === 'function') {
            LOADED_MODULAR_RENDERERS[gId as GameId] = fn as ModularRendererFn;
          }
        }
        inflightGroupLoads.delete(group.id);
      })
      .catch((err) => {
        inflightGroupLoads.delete(group.id);
        throw err;
      });
    inflightGroupLoads.set(group.id, task);
  }

  await task;
  if (!LOADED_MODULAR_RENDERERS[gameId]) {
    throw new Error(`Missing renderer export for ${gameId}`);
  }
}

/**
 * Preloads both the game's cover artwork and its renderer chunk, returning the load promise
 * so callers can gate PLAYING transitions until rendering is guaranteed synchronous.
 */
export function preloadRenderer(gameId: GameId): Promise<void> {
  preloadCoverImage(gameId);
  return ensureGameRendererLoaded(gameId);
}

/**
 * Fires-and-forgets cover + chunk preloading for hover/carousel browsing without throwing.
 */
export function preloadGameRenderer(gameId: GameId): void {
  void preloadRenderer(gameId).catch(() => {});
}

/**
 * Renders a modularly registered game snapshot synchronously.
 */
export function renderModularGame(
  ctx: CanvasRenderingContext2D,
  snap: GameSnapshot
): boolean {
  const fn = LOADED_MODULAR_RENDERERS[snap.gameId];
  if (fn) {
    fn(ctx, snap);
    return true;
  }
  return false;
}

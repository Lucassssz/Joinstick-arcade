import { ARENA_HEIGHT, ARENA_WIDTH, type GameId, type GameSnapshot } from '../shared/types';
import { getGameMeta } from '../shared/games';
import { drawStudioBackdrop } from './render25d';

type ModularRendererFn = (ctx: CanvasRenderingContext2D, snap: any) => void;

/**
 * Modular Renderer & Asset Registry
 * ---------------------------------
 * Enables scaling the game library to 42+ (and 48+) games without bloating the initial
 * entry bundle. Each modular pack is code-split via dynamic `import()` and loaded on-demand
 * when the host selects or previews a game in the Lobby / Rules Briefing.
 */
const rendererCache = new Map<GameId, ModularRendererFn>();
const pendingLoads = new Map<GameId, Promise<void>>();
const preloadedImages = new Set<string>();

const MODULAR_LOADERS: Partial<Record<GameId, () => Promise<ModularRendererFn>>> = {
  'volley-smash': async () => (await import('./newArcadeRenderers')).renderVolleySmash,
  'lava-hopper': async () => (await import('./newArcadeRenderers')).renderLavaHopper,
  'ludo-royale': async () => (await import('./newBoardRenderersA')).renderLudoRoyale,
  'star-party-board': async () => (await import('./newBoardRenderersA')).renderStarPartyBoard,
  'reversi-clash': async () => (await import('./newBoardRenderersA')).renderReversiClash,
  'four-in-a-row': async () => (await import('./newBoardRenderersA')).renderFourInARow,
  'naval-salvo': async () => (await import('./newBoardRenderersB')).renderNavalSalvo,
  'neon-checkers': async () => (await import('./newBoardRenderersB')).renderNeonCheckers,
  'carrom-arena': async () => (await import('./newBoardRenderersB')).renderCarromArena,
  'dungeon-crawl-board': async () => (await import('./newBoardRenderersB')).renderDungeonCrawlBoard,
  'boom-kittens': async () => (await import('./newCardRenderers')).renderBoomKittens,
  'property-deal': async () => (await import('./newCardRenderers')).renderPropertyDeal,
  'flip-seven': async () => (await import('./newCardRenderers')).renderFlipSeven,
  'royal-bluff': async () => (await import('./newCardRenderers')).renderRoyalBluff,
  'dark-flip-clash': async () => (await import('./newCardRenderers')).renderDarkFlipClash,
  'sushi-draft': async () => (await import('./newCardRenderers')).renderSushiDraft,
  // Expansion Pack 1 — Malaysian Heritage & CNY Classics (lazy-loaded chunk)
  'line-breakers': async () => (await import('./packMalaysianRenderers')).renderLineBreakers,
  'desk-flippers': async () => (await import('./packMalaysianRenderers')).renderDeskFlippers,
  'spin-clash': async () => (await import('./packMalaysianRenderers')).renderSpinClash,
  'marble-ring': async () => (await import('./packMalaysianRenderers')).renderMarbleRing,
  'rattan-volley': async () => (await import('./packMalaysianRenderers')).renderRattanVolley,
  'step-stomp': async () => (await import('./packMalaysianRenderers')).renderStepStomp,
  'pit-harvest': async () => (await import('./packMalaysianRenderers')).renderPitHarvest,
  'big-two-royale': async () => (await import('./packMalaysianRenderers')).renderBigTwoRoyale,
  'lucky-21': async () => (await import('./packMalaysianRenderers')).renderLucky21,
  'ten-pair-showdown': async () => (await import('./packMalaysianRenderers')).renderTenPairShowdown,
  // Expansion Pack 2 — 16 Chinese Viral & Party Hits (2 lazy-loaded chunks)
  'melon-merge': async () => (await import('./packChineseViralArcadeRenderers')).renderMelonMerge,
  'tile-triple': async () => (await import('./packChineseViralArcadeRenderers')).renderTileTriple,
  'block-hop': async () => (await import('./packChineseViralArcadeRenderers')).renderBlockHop,
  'platform-leap': async () => (await import('./packChineseViralArcadeRenderers')).renderPlatformLeap,
  'egg-rush': async () => (await import('./packChineseViralArcadeRenderers')).renderEggRush,
  'goose-alert': async () => (await import('./packChineseViralArcadeRenderers')).renderGooseAlert,
  'hotpot-rush': async () => (await import('./packChineseViralArcadeRenderers')).renderHotpotRush,
  'claw-mania': async () => (await import('./packChineseViralArcadeRenderers')).renderClawMania,
  'truth-bomb': async () => (await import('./packChineseViralArcadeRenderers')).renderTruthBomb,
  'draw-guess-relay': async () => (await import('./packChineseViralArcadeRenderers')).renderDrawGuessRelay,
  'landlord-clash': async () => (await import('./packChineseViralCardRenderers')).renderLandlordClash,
  'speed-mahjong': async () => (await import('./packChineseViralCardRenderers')).renderSpeedMahjong,
  'liars-dice-tavern': async () => (await import('./packChineseViralCardRenderers')).renderLiarsDiceTavern,
  'undercover-word': async () => (await import('./packChineseViralCardRenderers')).renderUndercoverWord,
  'midnight-werewolf': async () => (await import('./packChineseViralCardRenderers')).renderMidnightWerewolf,
  'idiom-chain': async () => (await import('./packChineseViralCardRenderers')).renderIdiomChain,
  // Expansion Pack 3 — 16 Global & English Viral Internet Hits (2 lazy-loaded chunks)
  'sky-climb': async () => (await import('./packGlobalViralArcadeRenderers')).renderSkyClimb,
  'slither-feast': async () => (await import('./packGlobalViralArcadeRenderers')).renderSlitherFeast,
  'blob-devour': async () => (await import('./packGlobalViralArcadeRenderers')).renderBlobDevour,
  'turf-ribbon': async () => (await import('./packGlobalViralArcadeRenderers')).renderTurfRibbon,
  'glass-bridge': async () => (await import('./packGlobalViralArcadeRenderers')).renderGlassBridge,
  'tug-titan': async () => (await import('./packGlobalViralArcadeRenderers')).renderTugTitan,
  'flappy-flock': async () => (await import('./packGlobalViralArcadeRenderers')).renderFlappyFlock,
  'dino-dash': async () => (await import('./packGlobalViralArcadeRenderers')).renderDinoDash,
  'tile-2048-blitz': async () => (await import('./packGlobalViralArcadeRenderers')).renderTile2048Blitz,
  'mine-sweep-duel': async () => (await import('./packGlobalViralArcadeRenderers')).renderMineSweepDuel,
  'geo-pin-rush': async () => (await import('./packGlobalViralArcadeRenderers')).renderGeoPinRush,
  'wavelength-sync': async () => (await import('./packGlobalViralArcadeRenderers')).renderWavelengthSync,
  'word-pulse': async () => (await import('./packGlobalViralCardRenderers')).renderWordPulse,
  'trivia-blitz': async () => (await import('./packGlobalViralCardRenderers')).renderTriviaBlitz,
  'codenames-grid': async () => (await import('./packGlobalViralCardRenderers')).renderCodeGrid,
  'fib-party': async () => (await import('./packGlobalViralCardRenderers')).renderFibParty,
  // Expansion Pack 4 — 16 Retro Arcade & Classic Skill Hits (2 lazy-loaded chunks)
  'maze-chomper': async () => (await import('./packRetroArcadeRenderersA')).renderMazeChomper,
  'brick-clash': async () => (await import('./packRetroArcadeRenderersA')).renderBrickClash,
  'alien-wave': async () => (await import('./packRetroArcadeRenderersA')).renderAlienWave,
  'block-stack': async () => (await import('./packRetroArcadeRenderersA')).renderBlockStack,
  'frog-crossing': async () => (await import('./packRetroArcadeRenderersA')).renderFrogCrossing,
  'barrel-tower': async () => (await import('./packRetroArcadeRenderersA')).renderBarrelTower,
  'whack-blitz': async () => (await import('./packRetroArcadeRenderersA')).renderWhackBlitz,
  'rhythm-pulse': async () => (await import('./packRetroArcadeRenderersA')).renderRhythmPulse,
  'clay-skeet': async () => (await import('./packRetroArcadeRenderersB')).renderClaySkeet,
  'air-hockey-neo': async () => (await import('./packRetroArcadeRenderersB')).renderAirHockeyNeo,
  'skee-roll': async () => (await import('./packRetroArcadeRenderersB')).renderSkeeRoll,
  'stack-tower': async () => (await import('./packRetroArcadeRenderersB')).renderStackTower,
  'tunnel-dig': async () => (await import('./packRetroArcadeRenderersB')).renderTunnelDig,
  'bubble-pop-arc': async () => (await import('./packRetroArcadeRenderersB')).renderBubblePopArc,
  'pin-strike': async () => (await import('./packRetroArcadeRenderersB')).renderPinStrike,
  'coin-dozer': async () => (await import('./packRetroArcadeRenderersB')).renderCoinDozer,
  // Expansion Pack 5 — 14 Sports & Physics Showdowns
  'hoop-blitz': async () => (await import('./packSportsPhysicsRenderers')).renderHoopBlitz,
  'penalty-duel': async () => (await import('./packSportsPhysicsRenderers')).renderPenaltyDuel,
  'mini-golf-pro': async () => (await import('./packSportsPhysicsRenderers')).renderMiniGolfPro,
  'archery-wind': async () => (await import('./packSportsPhysicsRenderers')).renderArcheryWind,
  'boxing-ko': async () => (await import('./packSportsPhysicsRenderers')).renderBoxingKo,
  'ping-pong-pro': async () => (await import('./packSportsPhysicsRenderers')).renderPingPongPro,
  'home-run-derby': async () => (await import('./packSportsPhysicsRenderers')).renderHomeRunDerby,
  'dodgeball-riot': async () => (await import('./packSportsPhysicsRenderers')).renderDodgeballRiot,
  'sumo-clash': async () => (await import('./packSportsPhysicsRenderers')).renderSumoClash,
  'canoe-sprint': async () => (await import('./packSportsPhysicsRenderers')).renderCanoeSprint,
  'disc-arena': async () => (await import('./packSportsPhysicsRenderers')).renderDiscArena,
  'badminton-smash': async () => (await import('./packSportsPhysicsRenderers')).renderBadmintonSmash,
  'billiards-snooker': async () => (await import('./packSportsPhysicsRenderers')).renderBilliardsSnooker,
  'tether-joust': async () => (await import('./packSportsPhysicsRenderers')).renderTetherJoust,
  // Expansion Pack 6 — 15 Chaos Party & Survival Games
  'laser-jump-rope': async () => (await import('./packChaosSurvivalRenderers')).renderLaserJumpRope,
  'hot-lava-floor': async () => (await import('./packChaosSurvivalRenderers')).renderHotLavaFloor,
  'bomb-tag-arena': async () => (await import('./packChaosSurvivalRenderers')).renderBombTagArena,
  'musical-thrones': async () => (await import('./packChaosSurvivalRenderers')).renderMusicalThrones,
  'sumo-ice-drift': async () => (await import('./packChaosSurvivalRenderers')).renderSumoIceDrift,
  'meteor-dodge-x': async () => (await import('./packChaosSurvivalRenderers')).renderMeteorDodgeX,
  'king-of-hill-neo': async () => (await import('./packChaosSurvivalRenderers')).renderKingOfHillNeo,
  'laser-maze-heist': async () => (await import('./packChaosSurvivalRenderers')).renderLaserMazeHeist,
  'zombie-outbreak': async () => (await import('./packChaosSurvivalRenderers')).renderZombieOutbreak,
  'falling-anvils': async () => (await import('./packChaosSurvivalRenderers')).renderFallingAnvils,
  'seesaw-balance': async () => (await import('./packChaosSurvivalRenderers')).renderSeesawBalance,
  'chain-gang-climb': async () => (await import('./packChaosSurvivalRenderers')).renderChainGangClimb,
  'confetti-capture': async () => (await import('./packChaosSurvivalRenderers')).renderConfettiCapture,
  'crane-drop-chaos': async () => (await import('./packChaosSurvivalRenderers')).renderCraneDropChaos,
  'roulette-arena': async () => (await import('./packChaosSurvivalRenderers')).renderRouletteArena,
  // Expansion Pack 7 — 15 Strategy Board & Card Classics (150 Total Games)
  'gomoku-blitz': async () => (await import('./packStrategyClassicsRenderers')).renderGomokuBlitz,
  'chess-blitz': async () => (await import('./packStrategyClassicsRenderers')).renderChessBlitz,
  'domino-chain': async () => (await import('./packStrategyClassicsRenderers')).renderDominoChain,
  'hexagon-conquest': async () => (await import('./packStrategyClassicsRenderers')).renderHexagonConquest,
  'backgammon-sprint': async () => (await import('./packStrategyClassicsRenderers')).renderBackgammonSprint,
  'mancala-jewels': async () => (await import('./packStrategyClassicsRenderers')).renderMancalaJewels,
  'curling-masters': async () => (await import('./packStrategyClassicsRenderers')).renderCurlingMasters,
  'rummy-royale': async () => (await import('./packStrategyClassicsRenderers')).renderRummyRoyale,
  'hearts-breaker': async () => (await import('./packStrategyClassicsRenderers')).renderHeartsBreaker,
  'spades-bidding': async () => (await import('./packStrategyClassicsRenderers')).renderSpadesBidding,
  'poker-showdown': async () => (await import('./packStrategyClassicsRenderers')).renderPokerShowdown,
  'tarot-arcana': async () => (await import('./packStrategyClassicsRenderers')).renderTarotArcana,
  'baccarat-club': async () => (await import('./packStrategyClassicsRenderers')).renderBaccaratClub,
  'memory-pairs': async () => (await import('./packStrategyClassicsRenderers')).renderMemoryPairs,
  'sequence-jack': async () => (await import('./packStrategyClassicsRenderers')).renderSequenceJack,
};

/**
 * Awaits loading of a modular renderer pack if the game is registered in MODULAR_LOADERS.
 * Used by both Gameplay Preloading and the Real In-Game Screenshot Thumbnail Engine.
 */
export async function ensureGameRendererLoaded(gameId: GameId): Promise<void> {
  if (rendererCache.has(gameId)) return;
  const loader = MODULAR_LOADERS[gameId];
  if (!loader) return;
  const existing = pendingLoads.get(gameId);
  if (existing) {
    await existing;
    return;
  }
  const task = loader()
    .then((fn) => {
      rendererCache.set(gameId, fn);
    })
    .catch((err) => {
      console.error(`[ModularRegistry] Failed to load renderer for ${gameId}:`, err);
    })
    .finally(() => {
      pendingLoads.delete(gameId);
    });
  pendingLoads.set(gameId, task);
  await task;
}

/**
 * Preloads a game's renderer chunk and cover artwork in the background
 * during Lobby selection or Rules Briefing so gameplay starts with zero frame delay.
 */
export function preloadGameRenderer(gameId: GameId): void {
  // 1. Preload cover image asset on-demand
  if (typeof window !== 'undefined') {
    const meta = getGameMeta(gameId);
    if (meta?.coverImage && !preloadedImages.has(meta.coverImage)) {
      preloadedImages.add(meta.coverImage);
      const img = new Image();
      img.decoding = 'async';
      img.src = meta.coverImage;
    }
  }

  // 2. Dynamically load modular renderer chunk if registered
  void ensureGameRendererLoaded(gameId);
}

/**
 * Renders a modularly registered game snapshot synchronously if cached,
 * or triggers on-demand loading while rendering a sleek 1-frame studio backdrop.
 */
export function renderModularGame(
  ctx: CanvasRenderingContext2D,
  snap: GameSnapshot
): boolean {
  const fn = rendererCache.get(snap.gameId);
  if (fn) {
    fn(ctx, snap);
    return true;
  }

  if (MODULAR_LOADERS[snap.gameId]) {
    preloadGameRenderer(snap.gameId);
    drawStudioBackdrop(ctx, '#0A0D14', 'rgba(0, 194, 255, 0.12)', 'rgba(255,255,255,0.03)', 44);
    ctx.save();
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOADING ARENA MODULE...', ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    ctx.restore();
    return true;
  }

  return false;
}

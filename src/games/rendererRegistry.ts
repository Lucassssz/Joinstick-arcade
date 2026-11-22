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

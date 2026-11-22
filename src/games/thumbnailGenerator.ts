import { ARENA_HEIGHT, ARENA_WIDTH, type GameId, type GameSnapshot } from '../shared/types';
import type { getGameGenre } from '../shared/games';
import { ensureGameRendererLoaded } from './rendererRegistry';
import { createRenderFxState, renderGameSnapshot } from './renderers';

type GameGenre = ReturnType<typeof getGameGenre>;

const THUMB_W = 640;
const THUMB_H = 360;

const MAX_THUMB_CACHE = 64;
const thumbnailCache = new Map<GameId, string>();
const inflightMap = new Map<GameId, Promise<string | null>>();

let activeWorkers = 0;
const MAX_CONCURRENT = 2;
const jobQueue: (() => void)[] = [];

function scheduleIdle(fn: () => void) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(
      fn,
      { timeout: 120 }
    );
  } else {
    setTimeout(fn, 0);
  }
}

function runQueued<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const execute = () => {
      activeWorkers += 1;
      scheduleIdle(() => {
        task()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            activeWorkers -= 1;
            const next = jobQueue.shift();
            if (next) next();
          });
      });
    };
    if (activeWorkers < MAX_CONCURRENT) {
      execute();
    } else {
      jobQueue.push(execute);
    }
  });
}

let sharedSourceCanvas: HTMLCanvasElement | null = null;
let sharedThumbCanvas: HTMLCanvasElement | null = null;

function getOffscreenCanvases() {
  if (!sharedSourceCanvas) {
    sharedSourceCanvas = document.createElement('canvas');
    sharedSourceCanvas.width = ARENA_WIDTH;
    sharedSourceCanvas.height = ARENA_HEIGHT;
  }
  if (!sharedThumbCanvas) {
    sharedThumbCanvas = document.createElement('canvas');
    sharedThumbCanvas.width = THUMB_W;
    sharedThumbCanvas.height = THUMB_H;
  }
  return { src: sharedSourceCanvas, dst: sharedThumbCanvas };
}

function hashGameId(gameId: string): number {
  let h = 2166136261;
  for (let i = 0; i < gameId.length; i++) {
    h ^= gameId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  const n = parseInt(clean, 16);
  if (Number.isNaN(n)) return [0, 194, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Generates a bold, high-contrast complementary/triadic partner color from accentHex
 * so every thumbnail pops with dual-tone arcade poster lighting.
 */
function derivePartnerHex(accentHex: string, seed: number): string {
  const [r, g, b] = hexToRgb(accentHex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  // Shift hue by 135..175 degrees for punchy dual-tone contrast
  const shift = 135 + (seed % 45);
  const nh = (h + shift) % 360;
  const s = 0.88;
  const l = 0.56;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((nh / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (nh < 60) [r1, g1, b1] = [c, x, 0];
  else if (nh < 120) [r1, g1, b1] = [x, c, 0];
  else if (nh < 180) [r1, g1, b1] = [0, c, x];
  else if (nh < 240) [r1, g1, b1] = [0, x, c];
  else if (nh < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawStarburst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  spikes: number,
  rotation: number,
  fill: string,
  stroke?: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.beginPath();
  const total = spikes * 2;
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / spikes;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws comic halftone dots fading out from the outer edges into the focal arena.
 */
function drawComicHalftone(
  ctx: CanvasRenderingContext2D,
  accentHex: string,
  partnerHex: string
) {
  ctx.save();
  const step = 16;
  for (let y = 8; y < THUMB_H; y += step) {
    for (let x = 8; x < THUMB_W; x += step) {
      const nx = (x - THUMB_W * 0.5) / (THUMB_W * 0.5);
      const ny = (y - THUMB_H * 0.5) / (THUMB_H * 0.5);
      const dist = Math.hypot(nx, ny);
      if (dist < 0.72) continue;
      const r = Math.min(4.6, (dist - 0.7) * 5.2);
      if (r <= 0.6) continue;
      ctx.fillStyle = x < THUMB_W * 0.5 ? hexToRgba(accentHex, 0.24) : hexToRgba(partnerHex, 0.24);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Draws bold radiating comic / anime action sunburst rays behind the tilted gameplay panel.
 */
function drawSunburstRays(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  accentHex: string,
  partnerHex: string,
  seed: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  const rayCount = 18;
  const baseAngle = ((seed % 360) * Math.PI) / 180;
  for (let i = 0; i < rayCount; i++) {
    const a1 = baseAngle + (i / rayCount) * Math.PI * 2;
    const width = i % 3 === 0 ? 0.12 : 0.065;
    const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, THUMB_W * 0.85);
    const col = i % 2 === 0 ? accentHex : partnerHex;
    grad.addColorStop(0, hexToRgba(col, 0.42));
    grad.addColorStop(0.55, hexToRgba(col, 0.14));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, THUMB_W * 0.85, a1, a1 + width);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Renders a crisp 3D-shaded tumbling die for Board Game poster covers.
 */
function drawStylizedDie(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  angle: number,
  faceVal: number,
  accentHex: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Drop shadow
  ctx.fillStyle = 'rgba(6,8,14,0.62)';
  roundedRectPath(ctx, -size / 2 + 5, -size / 2 + 8, size, size, size * 0.22);
  ctx.fill();

  // Extruded colored bottom bevel
  ctx.fillStyle = hexToRgba(accentHex, 0.92);
  roundedRectPath(ctx, -size / 2, -size / 2 + 4, size, size, size * 0.22);
  ctx.fill();

  // Ivory glossy top face
  const faceGrad = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
  faceGrad.addColorStop(0, '#FFFFFF');
  faceGrad.addColorStop(0.6, '#F1F5F9');
  faceGrad.addColorStop(1, '#CBD5E1');
  ctx.fillStyle = faceGrad;
  roundedRectPath(ctx, -size / 2, -size / 2, size, size, size * 0.22);
  ctx.fill();

  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Pips
  const o = size * 0.26;
  const pipR = size * 0.095;
  const pipMaps: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [
      [-o, -o],
      [o, o],
    ],
    3: [
      [-o, -o],
      [0, 0],
      [o, o],
    ],
    4: [
      [-o, -o],
      [o, -o],
      [-o, o],
      [o, o],
    ],
    5: [
      [-o, -o],
      [o, -o],
      [0, 0],
      [-o, o],
      [o, o],
    ],
    6: [
      [-o, -o],
      [o, -o],
      [-o, 0],
      [o, 0],
      [-o, o],
      [o, o],
    ],
  };
  const pips = pipMaps[faceVal] ?? pipMaps[6];
  for (const [px, py] of pips) {
    ctx.fillStyle = faceVal === 1 || faceVal === 6 ? accentHex : '#111827';
    ctx.beginPath();
    ctx.arc(px, py, pipR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Renders 3D-fanned hero playing cards bursting out of the foreground for all 8 Card Games,
 * complete with custom per-game emblem artwork on the lead hero card.
 */
function drawCardGameHeroFan(
  ctx: CanvasRenderingContext2D,
  gameId: GameId,
  accentHex: string,
  partnerHex: string
) {
  const cardSpecs: Record<
    string,
    { label: string; sub: string; primary: string; secondary: string; glyph: string }
  > = {
    'boom-kittens': {
      label: 'BOOM!',
      sub: 'DEFUSE',
      primary: '#FF4D2E',
      secondary: '#FFB800',
      glyph: '💣',
    },
    'property-deal': {
      label: '$5M',
      sub: 'DEAL',
      primary: '#10D98B',
      secondary: '#FFB800',
      glyph: '🏠',
    },
    'flip-seven': {
      label: '7',
      sub: '×2 FLIP',
      primary: '#FFB800',
      secondary: '#00C2FF',
      glyph: '⚡',
    },
    'royal-bluff': {
      label: 'COUP',
      sub: 'BLUFF',
      primary: '#A855F7',
      secondary: '#FFB800',
      glyph: '👑',
    },
    'dark-flip-clash': {
      label: '+5',
      sub: 'FLIP',
      primary: '#EC4899',
      secondary: '#00C2FF',
      glyph: '⇄',
    },
    'sushi-draft': {
      label: '×3',
      sub: 'DRAFT',
      primary: '#FF7A1A',
      secondary: '#10D98B',
      glyph: '🍣',
    },
    'color-clash': {
      label: '+4',
      sub: 'WILD',
      primary: '#FF3B9A',
      secondary: '#00C2FF',
      glyph: '★',
    },
    'liars-deck': {
      label: 'A♠',
      sub: 'LIAR!',
      primary: '#EF4444',
      secondary: '#1E293B',
      glyph: '♠',
    },
    'big-two-royale': {
      label: '2♠',
      sub: 'BIG 2',
      primary: '#DC2626',
      secondary: '#FFB800',
      glyph: '♠',
    },
    'lucky-21': {
      label: '21',
      sub: 'BAN LUCK',
      primary: '#E11D48',
      secondary: '#F59E0B',
      glyph: 'A',
    },
    'ten-pair-showdown': {
      label: 'NGAU',
      sub: '×5 GONG',
      primary: '#F59E0B',
      secondary: '#B91C1C',
      glyph: '10',
    },
    'landlord-clash': {
      label: '王炸',
      sub: 'BOMB ×2',
      primary: '#DC2626',
      secondary: '#F59E0B',
      glyph: '★',
    },
    'speed-mahjong': {
      label: '發',
      sub: 'HU! 胡',
      primary: '#10B981',
      secondary: '#065F46',
      glyph: '中',
    },
    'liars-dice-tavern': {
      label: '6×⚄',
      sub: 'LIAR!',
      primary: '#F59E0B',
      secondary: '#7C2D12',
      glyph: '⚄',
    },
    'undercover-word': {
      label: 'SPY?',
      sub: '卧底',
      primary: '#8B5CF6',
      secondary: '#312E81',
      glyph: '?',
    },
    'midnight-werewolf': {
      label: 'WOLF',
      sub: '狼人杀',
      primary: '#6366F1',
      secondary: '#1E1B4B',
      glyph: '☽',
    },
    'idiom-chain': {
      label: '接龙',
      sub: 'CHAIN!',
      primary: '#F97316',
      secondary: '#7C2D12',
      glyph: '龍',
    },
    'word-pulse': {
      label: 'WORD',
      sub: '5-LTR',
      primary: '#22C55E',
      secondary: '#14532D',
      glyph: 'W',
    },
    'trivia-blitz': {
      label: 'QUIZ',
      sub: 'BLITZ!',
      primary: '#8B5CF6',
      secondary: '#4C1D95',
      glyph: '?',
    },
    'codenames-grid': {
      label: 'CODE',
      sub: 'SPY',
      primary: '#14B8A6',
      secondary: '#115E59',
      glyph: '◆',
    },
    'fib-party': {
      label: 'FIB!',
      sub: 'TRUTH',
      primary: '#F43F5E',
      secondary: '#881337',
      glyph: '!',
    },
  };

  const spec = cardSpecs[gameId] ?? {
    label: '★',
    sub: 'CARD',
    primary: accentHex,
    secondary: partnerHex,
    glyph: '♦',
  };

  const fanCards = [
    { x: THUMB_W - 142, y: THUMB_H - 46, rot: -0.34, bg: spec.secondary, main: false },
    { x: THUMB_W - 92, y: THUMB_H - 58, rot: -0.09, bg: '#161B26', main: false },
    { x: THUMB_W - 56, y: THUMB_H - 46, rot: 0.16, bg: spec.primary, main: true },
  ];

  // Radial glow behind the fanned hero cards
  ctx.save();
  const fanGlow = ctx.createRadialGradient(
    THUMB_W - 85,
    THUMB_H - 55,
    12,
    THUMB_W - 85,
    THUMB_H - 55,
    145
  );
  fanGlow.addColorStop(0, hexToRgba(spec.primary, 0.55));
  fanGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fanGlow;
  ctx.fillRect(THUMB_W - 230, THUMB_H - 200, 230, 200);
  ctx.restore();

  const cw = 82;
  const ch = 114;

  for (const fc of fanCards) {
    ctx.save();
    ctx.translate(fc.x, fc.y);
    ctx.rotate(fc.rot);

    // Shadow
    ctx.fillStyle = 'rgba(4,6,12,0.72)';
    roundedRectPath(ctx, -cw / 2 + 5, -ch / 2 + 7, cw, ch, 11);
    ctx.fill();

    // Crisp white outer card stock
    ctx.fillStyle = '#FFFFFF';
    roundedRectPath(ctx, -cw / 2, -ch / 2, cw, ch, 11);
    ctx.fill();
    ctx.strokeStyle = '#0B0F19';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Inner colored face
    const innerGrad = ctx.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 2);
    innerGrad.addColorStop(0, fc.bg);
    innerGrad.addColorStop(1, '#0F1320');
    ctx.fillStyle = innerGrad;
    roundedRectPath(ctx, -cw / 2 + 5, -ch / 2 + 5, cw - 10, ch - 10, 7);
    ctx.fill();

    // Diagonal foil highlight
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(-cw / 2 + 5, -ch / 2 + 28);
    ctx.lineTo(cw / 2 - 5, -ch / 2 + 5);
    ctx.lineTo(cw / 2 - 5, -ch / 2 + 34);
    ctx.lineTo(-cw / 2 + 5, -ch / 2 + 56);
    ctx.closePath();
    ctx.fill();

    // Inner crest oval
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.ellipse(0, 0, cw * 0.31, ch * 0.28, -0.35, 0, Math.PI * 2);
    ctx.fill();

    // Center bold rank / emblem
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (fc.main) {
      ctx.font = '900 28px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(spec.label, 0, -6);
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FFE58F';
      ctx.fillText(spec.sub, 0, 22);
    } else {
      ctx.font = '900 28px system-ui, sans-serif';
      ctx.fillText(spec.glyph, 0, 0);
    }

    // Corner index mark
    ctx.font = '900 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(spec.label.slice(0, 2), -cw / 2 + 9, -ch / 2 + 16);

    ctx.restore();
  }
}

/**
 * Draws a dramatic circular "Action Loupe" pop-out medallion showing a 2.3x zoomed real-gameplay
 * close-up right over the corner of the tilted hero panel!
 */
function drawActionLoupe(
  ctx: CanvasRenderingContext2D,
  srcCanvas: HTMLCanvasElement,
  accentHex: string,
  partnerHex: string,
  seed: number
) {
  const cx = THUMB_W - 86;
  const cy = THUMB_H - 74;
  const r = 58;

  // Pick a live action hotspot slightly offset from center
  const offX = ((seed % 5) - 2) * 58;
  const offY = (((seed >> 3) % 3) - 1) * 44;
  const sampleSize = 235;
  const sx = Math.max(40, Math.min(ARENA_WIDTH - sampleSize - 40, ARENA_WIDTH * 0.5 - sampleSize * 0.5 + offX));
  const sy = Math.max(40, Math.min(ARENA_HEIGHT - sampleSize - 40, ARENA_HEIGHT * 0.5 - sampleSize * 0.5 + offY));

  ctx.save();

  // Spiky comic impact burst right behind the loupe
  drawStarburst(
    ctx,
    cx,
    cy,
    r + 22,
    r + 6,
    12,
    ((seed % 30) * Math.PI) / 180,
    hexToRgba(accentHex, 0.85),
    '#0B0F18'
  );

  // Heavy offset drop shadow
  ctx.fillStyle = 'rgba(4,7,14,0.75)';
  ctx.beginPath();
  ctx.arc(cx + 4, cy + 7, r + 4, 0, Math.PI * 2);
  ctx.fill();

  // Clipped zoomed real-game close-up
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.filter = 'contrast(1.22) saturate(1.38) brightness(1.08)';
  ctx.drawImage(srcCanvas, sx, sy, sampleSize, sampleSize, cx - r, cy - r, r * 2, r * 2);
  ctx.filter = 'none';

  // Glossy curved highlight across top of lens
  const lensShine = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.4, cy + r * 0.3);
  lensShine.addColorStop(0, 'rgba(255,255,255,0.34)');
  lensShine.addColorStop(0.45, 'rgba(255,255,255,0.06)');
  lensShine.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = lensShine;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  // Double comic/neon bezel ring
  ctx.strokeStyle = '#0B0F18';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
  ctx.stroke();

  const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ringGrad.addColorStop(0, '#FFFFFF');
  ringGrad.addColorStop(0.5, accentHex);
  ringGrad.addColorStop(1, partnerHex);
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws bold arcade speed-slashes, chevron trails, and kinetic impact sparks
 * bursting across the frame border so arcade thumbnails look like energetic box art.
 */
function drawArcadeKineticOverlay(
  ctx: CanvasRenderingContext2D,
  accentHex: string,
  partnerHex: string,
  seed: number
) {
  ctx.save();

  // Bold diagonal glowing energy slash ribbon (bottom-left to upper-right)
  ctx.globalCompositeOperation = 'screen';
  const slashGrad = ctx.createLinearGradient(0, THUMB_H, THUMB_W, 0);
  slashGrad.addColorStop(0, hexToRgba(partnerHex, 0.55));
  slashGrad.addColorStop(0.45, hexToRgba(accentHex, 0.08));
  slashGrad.addColorStop(0.75, hexToRgba(accentHex, 0.32));
  slashGrad.addColorStop(1, 'rgba(255,255,255,0.45)');
  ctx.strokeStyle = slashGrad;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-20, THUMB_H - 36);
  ctx.lineTo(135, THUMB_H - 118);
  ctx.stroke();

  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(14, THUMB_H - 12);
  ctx.lineTo(165, THUMB_H - 94);
  ctx.stroke();

  // Top-right kinetic speed chevrons
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 3; i++) {
    const bx = THUMB_W - 36 - i * 18;
    const by = 32 + i * 5;
    ctx.strokeStyle = i === 0 ? '#FFFFFF' : i === 1 ? accentHex : hexToRgba(partnerHex, 0.8);
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(bx - 10, by - 9);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx - 10, by + 9);
    ctx.stroke();
  }

  // Stylized floating impact diamond sparks
  const sparkPoints = [
    { x: 54 + (seed % 32), y: THUMB_H - 48, s: 10, col: '#FFFFFF' },
    { x: 96 + (seed % 24), y: THUMB_H - 26, s: 7, col: accentHex },
    { x: THUMB_W - 154, y: 42 + (seed % 18), s: 9, col: partnerHex },
    { x: THUMB_W - 44, y: 92 + (seed % 20), s: 6.5, col: '#FFFFFF' },
  ];
  for (const sp of sparkPoints) {
    drawStarburst(ctx, sp.x, sp.y, sp.s, sp.s * 0.28, 4, 0, sp.col);
  }

  ctx.restore();
}

/**
 * Transforms a raw 1200x720 real in-game render into an unmistakable, heavily stylized
 * 640x360 promotional poster / collector key-art thumbnail:
 *  - Blurred dual-tone neon atmospheric backdrop + comic sunburst rays + halftone dot matrix
 *  - Dynamic Dutch-angle tilted & extruded 3D real-gameplay Hero Panel with focal zoom
 *  - Subtle RGB chromatic rim punch & studio lighting splits
 *  - Genre-specific foreground props breaking out of the frame (Zoomed Action Loupe &
 *    kinetic slashes for Arcade; 3D tumbling dice & golden bevel stage for Board;
 *    custom per-game 3D fanned hero cards for Card games)
 */
function stylizeScreenshot(
  srcCanvas: HTMLCanvasElement,
  dstCanvas: HTMLCanvasElement,
  gameId: GameId,
  accentHex: string,
  genre: GameGenre
): string {
  const ctx = dstCanvas.getContext('2d');
  if (!ctx) return '';

  const seed = hashGameId(gameId);
  const partnerHex = derivePartnerHex(accentHex, seed);
  const tiltDir = seed % 2 === 0 ? 1 : -1;

  ctx.save();
  ctx.clearRect(0, 0, THUMB_W, THUMB_H);

  // =========================================================================
  // LAYER 1: VIBRANT BLURRED DUAL-TONE ATMOSPHERIC STAGE + SUNBURST + HALFTONE
  // =========================================================================
  ctx.save();
  ctx.filter = 'blur(11px) saturate(1.65) brightness(0.54) contrast(1.22)';
  ctx.drawImage(srcCanvas, 0, 0, ARENA_WIDTH, ARENA_HEIGHT, -24, -18, THUMB_W + 48, THUMB_H + 36);
  ctx.filter = 'none';
  ctx.restore();

  // Rich dual-tone diagonal studio stage wash
  const bgWash = ctx.createLinearGradient(0, 0, THUMB_W, THUMB_H);
  bgWash.addColorStop(0, hexToRgba(accentHex, 0.42));
  bgWash.addColorStop(0.5, 'rgba(11, 14, 24, 0.56)');
  bgWash.addColorStop(1, hexToRgba(partnerHex, 0.48));
  ctx.fillStyle = bgWash;
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);

  // Radiating comic / arcade action sunburst rays
  drawSunburstRays(
    ctx,
    THUMB_W * (tiltDir > 0 ? 0.44 : 0.54),
    THUMB_H * 0.48,
    accentHex,
    partnerHex,
    seed
  );

  // Halftone comic dot screen around outer perimeter
  drawComicHalftone(ctx, accentHex, partnerHex);

  // =========================================================================
  // LAYER 2: TILTED 3D-EXTRUDED REAL-GAMEPLAY HERO PANEL (FOCAL ZOOM + CHROMA)
  // =========================================================================
  const panelW = genre === 'arcade' ? 544 : 532;
  const panelH = genre === 'arcade' ? 302 : 296;
  const panelCx = THUMB_W * 0.47;
  const panelCy = THUMB_H * 0.505;
  const tiltRad =
    ((genre === 'arcade' ? 4.8 + (seed % 22) * 0.1 : 3.4 + (seed % 16) * 0.1) *
      tiltDir *
      Math.PI) /
    180;

  // Focal zoom into the most exciting center of the live game
  const zoom = genre === 'arcade' ? 1.28 : genre === 'board' ? 1.14 : 1.13;
  const cropW = ARENA_WIDTH / zoom;
  const cropH = (cropW * panelH) / panelW;
  const cropX = (ARENA_WIDTH - cropW) / 2;
  const cropY = Math.max(0, (ARENA_HEIGHT - cropH) / 2 + (genre === 'arcade' ? 10 : 6));

  ctx.save();
  ctx.translate(panelCx, panelCy);
  ctx.rotate(tiltRad);

  // Dramatic 3D slab extrusion & shadow under the gameplay frame
  ctx.fillStyle = 'rgba(4, 6, 12, 0.78)';
  roundedRectPath(ctx, -panelW / 2 + 12, -panelH / 2 + 16, panelW, panelH, 20);
  ctx.fill();

  // Vibrant partner-color offset comic backing plate (gives unmistakable graphic poster pop)
  ctx.fillStyle = partnerHex;
  roundedRectPath(ctx, -panelW / 2 - 7 * tiltDir, -panelH / 2 + 8, panelW, panelH, 20);
  ctx.fill();

  // Primary accent glowing backing plate
  ctx.fillStyle = accentHex;
  roundedRectPath(ctx, -panelW / 2 + 4 * tiltDir, -panelH / 2 - 4, panelW, panelH, 20);
  ctx.fill();

  // Clipped high-punch real in-game gameplay render
  ctx.save();
  roundedRectPath(ctx, -panelW / 2, -panelH / 2, panelW, panelH, 18);
  ctx.clip();

  // Vibrant color-graded real gameplay blit
  ctx.filter = 'contrast(1.18) saturate(1.36) brightness(1.06)';
  ctx.drawImage(
    srcCanvas,
    cropX,
    cropY,
    cropW,
    cropH,
    -panelW / 2,
    -panelH / 2,
    panelW,
    panelH
  );
  ctx.filter = 'none';

  // Subtle chromatic edge-pop for high-energy arcade depth
  if (genre === 'arcade') {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.16;
    ctx.drawImage(
      srcCanvas,
      cropX,
      cropY,
      cropW,
      cropH,
      -panelW / 2 + 4,
      -panelH / 2 - 2,
      panelW,
      panelH
    );
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Dual-tone studio key-light + warm/cool spotlight across the live arena
  ctx.globalCompositeOperation = 'screen';
  const keySpot = ctx.createRadialGradient(
    -panelW * 0.18,
    -panelH * 0.25,
    18,
    0,
    0,
    panelW * 0.65
  );
  keySpot.addColorStop(0, hexToRgba(accentHex, 0.34));
  keySpot.addColorStop(0.55, hexToRgba(partnerHex, 0.1));
  keySpot.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = keySpot;
  ctx.fillRect(-panelW / 2, -panelH / 2, panelW, panelH);

  // Crisp angled glossy glass sheen across upper frame
  const sheen = ctx.createLinearGradient(-panelW / 2, -panelH / 2, panelW * 0.35, panelH * 0.35);
  sheen.addColorStop(0, 'rgba(255,255,255,0.20)');
  sheen.addColorStop(0.28, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(0.32, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-panelW / 2, -panelH / 2, panelW, panelH);

  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // Crisp comic ink + bright white studio frame border
  roundedRectPath(ctx, -panelW / 2, -panelH / 2, panelW, panelH, 18);
  ctx.strokeStyle = '#090C14';
  ctx.lineWidth = 6.5;
  ctx.stroke();

  roundedRectPath(ctx, -panelW / 2, -panelH / 2, panelW, panelH, 18);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.6;
  ctx.stroke();

  ctx.restore();

  // =========================================================================
  // LAYER 3: GENRE-SPECIFIC FOREGROUND PROPS BREAKING OUT OF THE FRAME
  // =========================================================================
  if (genre === 'arcade') {
    drawArcadeKineticOverlay(ctx, accentHex, partnerHex, seed);
    drawActionLoupe(ctx, srcCanvas, accentHex, partnerHex, seed);
  } else if (genre === 'board') {
    // Sweeping golden tabletop highlight beam + tumbling 3D twin dice breaking the corner
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const boardBeam = ctx.createRadialGradient(
      THUMB_W - 88,
      THUMB_H - 72,
      10,
      THUMB_W - 88,
      THUMB_H - 72,
      150
    );
    boardBeam.addColorStop(0, hexToRgba(accentHex, 0.45));
    boardBeam.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = boardBeam;
    ctx.fillRect(THUMB_W - 240, THUMB_H - 220, 240, 220);
    ctx.restore();

    // Motion arcs behind tumbling dice
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(THUMB_W - 95, THUMB_H - 64, 52, Math.PI * 0.95, Math.PI * 1.48);
    ctx.stroke();
    ctx.strokeStyle = hexToRgba(accentHex, 0.8);
    ctx.beginPath();
    ctx.arc(THUMB_W - 92, THUMB_H - 62, 62, Math.PI * 1.05, Math.PI * 1.42);
    ctx.stroke();
    ctx.restore();

    const d1 = (seed % 6) + 1;
    const d2 = ((seed >> 2) % 6) + 1;
    drawStylizedDie(ctx, THUMB_W - 112, THUMB_H - 54, 48, -0.32, d1, partnerHex);
    drawStylizedDie(ctx, THUMB_W - 58, THUMB_H - 78, 56, 0.24, d2, accentHex);

    // Golden sparkle bursts
    drawStarburst(ctx, THUMB_W - 34, 46, 12, 3.5, 4, 0.2, '#FFE066');
    drawStarburst(ctx, 56, THUMB_H - 42, 9, 2.8, 4, 0, '#FFFFFF');
  } else {
    // Card Game: Dramatic overhead spotlight cone + 3D fanned hero cards with custom emblem art
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const coneGrad = ctx.createLinearGradient(THUMB_W * 0.5, 0, THUMB_W * 0.5, THUMB_H);
    coneGrad.addColorStop(0, 'rgba(255,255,255,0.22)');
    coneGrad.addColorStop(0.6, hexToRgba(accentHex, 0.12));
    coneGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(THUMB_W * 0.3, 0);
    ctx.lineTo(THUMB_W * 0.7, 0);
    ctx.lineTo(THUMB_W * 0.95, THUMB_H);
    ctx.lineTo(THUMB_W * 0.05, THUMB_H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    drawCardGameHeroFan(ctx, gameId, accentHex, partnerHex);
    drawStarburst(ctx, THUMB_W - 148, THUMB_H - 122, 11, 3.2, 4, 0.2, '#FFE066');
    drawStarburst(ctx, 48, THUMB_H - 46, 8, 2.5, 4, 0, '#FFFFFF');
  }

  // =========================================================================
  // LAYER 4: CINEMATIC EDGE VIGNETTE + CLEAN OUTER STUDIO POSTER RIM
  // =========================================================================
  ctx.globalCompositeOperation = 'source-over';
  const vig = ctx.createRadialGradient(
    THUMB_W * 0.5,
    THUMB_H * 0.48,
    THUMB_W * 0.34,
    THUMB_W * 0.5,
    THUMB_H * 0.5,
    THUMB_W * 0.66
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.76, 'rgba(8,10,18,0.14)');
  vig.addColorStop(1, 'rgba(6,8,14,0.52)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);

  // Subtle bottom contrast scrim so card UI titles/metadata stay crisp
  const bottomScrim = ctx.createLinearGradient(0, THUMB_H * 0.76, 0, THUMB_H);
  bottomScrim.addColorStop(0, 'rgba(0,0,0,0)');
  bottomScrim.addColorStop(1, 'rgba(6,8,14,0.44)');
  ctx.fillStyle = bottomScrim;
  ctx.fillRect(0, THUMB_H * 0.76, THUMB_W, THUMB_H * 0.24);

  // Crisp outer accent rim border
  ctx.strokeStyle = hexToRgba(accentHex, 0.55);
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, THUMB_W - 3, THUMB_H - 3);

  ctx.restore();
  return dstCanvas.toDataURL('image/jpeg', 0.9);
}

export function getCachedGameThumbnail(gameId: GameId): string | null {
  const hit = thumbnailCache.get(gameId);
  if (!hit) return null;
  thumbnailCache.delete(gameId);
  thumbnailCache.set(gameId, hit);
  return hit;
}

export function getStylizedGameThumbnail(
  gameId: GameId,
  accentHex: string,
  genre: GameGenre
): Promise<string | null> {
  const cached = getCachedGameThumbnail(gameId);
  if (cached) return Promise.resolve(cached);

  const existing = inflightMap.get(gameId);
  if (existing) return existing;

  const promise = runQueued<string | null>(async () => {
    try {
      const [resp] = await Promise.all([
        fetch(`/api/demo-snapshot/${encodeURIComponent(gameId)}`),
        ensureGameRendererLoaded(gameId),
      ]);
      if (!resp.ok) return null;
      const snap = (await resp.json()) as GameSnapshot;

      const { src, dst } = getOffscreenCanvases();
      const srcCtx = src.getContext('2d');
      if (!srcCtx) return null;

      srcCtx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
      const fx = createRenderFxState();
      // Render the authentic in-game frame using the exact production canvas renderer
      renderGameSnapshot(srcCtx, snap, fx, 'en');

      const dataUrl = stylizeScreenshot(src, dst, gameId, accentHex, genre);
      if (dataUrl) {
        if (thumbnailCache.size >= MAX_THUMB_CACHE) {
          const oldest = thumbnailCache.keys().next().value;
          if (oldest) thumbnailCache.delete(oldest);
        }
        thumbnailCache.set(gameId, dataUrl);
      }
      return dataUrl || null;
    } catch (err) {
      console.error(`[ThumbnailGenerator] Failed for ${gameId}:`, err);
      return null;
    } finally {
      inflightMap.delete(gameId);
    }
  });

  inflightMap.set(gameId, promise);
  return promise;
}

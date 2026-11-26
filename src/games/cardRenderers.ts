import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../shared/cardLayout';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  CardColor,
  ColorClashSnapshot,
  FlyingCardAnim,
  LiarCard,
  LiarsDeckSnapshot,
} from '../shared/types';
import { drawShadowOval, drawStudioBackdrop, shadeHex } from './render25d';
import { drawNameplate, drawPopupTexts, tCanvas } from './renderers';

const CLASH_COLORS: Record<CardColor, { bg: string; dark: string; rim: string }> = {
  red: { bg: '#FF4D2E', dark: '#A8230D', rim: '#FFB5A7' },
  blue: { bg: '#00C2FF', dark: '#007199', rim: '#A5ECFF' },
  gold: { bg: '#FFB800', dark: '#A67200', rim: '#FFE699' },
  green: { bg: '#10D98B', dark: '#077D4E', rim: '#9EF7D2' },
  wild: { bg: '#1E1B4B', dark: '#0F0D2B', rim: '#E879F9' },
};

// ============================================================
// MOTION CURVES & JUICY TABLE 60FPS FX STATE
// ============================================================
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutBack(t: number, overshoot = 1.70158): number {
  const x = clamp01(t) - 1;
  return 1 + (overshoot + 1) * x * x * x + overshoot * x * x;
}

function parseHexRgb(hex: string): [number, number, number] {
  let clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [255, 184, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lerpHex(fromHex: string, toHex: string, alpha: number): string {
  const a = clamp01(alpha);
  const [r1, g1, b1] = parseHexRgb(fromHex);
  const [r2, g2, b2] = parseHexRgb(toHex);
  const r = Math.round(r1 + (r2 - r1) * a);
  const g = Math.round(g1 + (g2 - g1) * a);
  const b = Math.round(b1 + (b2 - b1) * a);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

interface TrackedFlight {
  fc: FlyingCardAnim;
  serverProgress: number;
  localProgress: number;
  landed: boolean;
  lastSeenMs: number;
}

interface FeltRipple {
  x: number;
  y: number;
  r: number;
  maxR: number;
  colorHex: string;
  alpha: number;
}

interface TableSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  colorHex: string;
  life: number;
  maxLife: number;
}

interface SeatMotion {
  activeLerp: number;
  displayedCards: number;
  fanKick: number;
  lastCardCount: number;
  actionPop: number;
  lastAction: string | null;
}

interface TurnComet {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  colorHex: string;
  progress: number;
}

interface AmbientMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

function createAmbientMotes(): AmbientMote[] {
  const out: AmbientMote[] = [];
  for (let i = 0; i < 18; i++) {
    out.push({
      x: TABLE_CENTER_X + ((i * 97) % 860) - 430,
      y: TABLE_CENTER_Y + ((i * 61) % 440) - 220,
      vx: ((i % 2 === 0 ? 1 : -1) * (5 + (i % 4) * 2.5)),
      vy: -3 - (i % 3) * 2,
      r: 1.4 + (i % 3) * 0.7,
      phase: i * 0.7,
    });
  }
  return out;
}

interface JuicyTableFX {
  gameId: string;
  lastFrameMs: number;
  feltAccentHex: string;
  orbitAngle: number;
  orbitVel: number;
  lastDirection: number;
  lastTopKey: string;
  pileSlam: number; // 0..1 decaying
  pileSlamRot: number;
  lastDeckCount: number;
  deckPulse: number;
  lastPileCount: number;
  lastActivePlayerId: string;
  spotlightX: number;
  spotlightY: number;
  spotlightAlpha: number;
  lastBannerText: string | null;
  bannerAnim: number; // 0 -> 1 easeOutBack
  flights: Map<string, TrackedFlight>;
  ripples: FeltRipple[];
  sparks: TableSpark[];
  seats: Map<string, SeatMotion>;
  comets: TurnComet[];
  motes: AmbientMote[];
}

const fx: JuicyTableFX = {
  gameId: '',
  lastFrameMs: 0,
  feltAccentHex: '#10D98B',
  orbitAngle: 0,
  orbitVel: 1.45,
  lastDirection: 1,
  lastTopKey: '',
  pileSlam: 0,
  pileSlamRot: 0,
  lastDeckCount: -1,
  deckPulse: 0,
  lastPileCount: -1,
  lastActivePlayerId: '',
  spotlightX: TABLE_CENTER_X,
  spotlightY: TABLE_CENTER_Y,
  spotlightAlpha: 0,
  lastBannerText: null,
  bannerAnim: 1,
  flights: new Map(),
  ripples: [],
  sparks: [],
  seats: new Map(),
  comets: [],
  motes: createAmbientMotes(),
};

function spawnLandingJuice(x: number, y: number, colorHex: string, strong = false) {
  fx.ripples.push({
    x,
    y,
    r: 12,
    maxR: strong ? 92 : 56,
    colorHex,
    alpha: strong ? 0.85 : 0.55,
  });
  const count = strong ? 10 : 5;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const spd = (strong ? 130 : 75) + Math.random() * 65;
    fx.sparks.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      size: strong ? 3.5 : 2.3,
      colorHex: i % 2 === 0 ? '#FEF08A' : colorHex,
      life: 0,
      maxLife: strong ? 0.45 : 0.32,
    });
  }
}

function stepTableFX(gameId: string): number {
  const nowMs = performance.now();
  const gapMs = nowMs - fx.lastFrameMs;
  if (fx.gameId !== gameId || gapMs > 650 || fx.lastFrameMs === 0) {
    fx.gameId = gameId;
    fx.lastTopKey = '';
    fx.pileSlam = 0;
    fx.lastDeckCount = -1;
    fx.deckPulse = 0;
    fx.lastPileCount = -1;
    fx.lastActivePlayerId = '';
    fx.spotlightAlpha = 0;
    fx.lastBannerText = null;
    fx.bannerAnim = 1;
    fx.flights.clear();
    fx.ripples = [];
    fx.sparks = [];
    fx.seats.clear();
    fx.comets = [];
    fx.lastFrameMs = nowMs;
    return 0.016;
  }

  const dt = Math.min(0.05, Math.max(0.001, gapMs / 1000));
  fx.lastFrameMs = nowMs;

  if (fx.pileSlam > 0) fx.pileSlam = Math.max(0, fx.pileSlam - dt * 3.1);
  if (fx.deckPulse > 0) fx.deckPulse = Math.max(0, fx.deckPulse - dt * 3.4);
  if (fx.bannerAnim < 1) fx.bannerAnim = Math.min(1, fx.bannerAnim + dt * 3.8);

  // Ripples
  for (let i = fx.ripples.length - 1; i >= 0; i--) {
    const rp = fx.ripples[i];
    rp.r += (rp.maxR - rp.r) * Math.min(1, dt * 11);
    rp.alpha -= dt * 2.1;
    if (rp.alpha <= 0) fx.ripples.splice(i, 1);
  }

  // Sparks
  for (let i = fx.sparks.length - 1; i >= 0; i--) {
    const sp = fx.sparks[i];
    sp.life += dt;
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.vx *= 0.9;
    sp.vy *= 0.9;
    if (sp.life >= sp.maxLife) fx.sparks.splice(i, 1);
  }

  // Turn comets
  for (let i = fx.comets.length - 1; i >= 0; i--) {
    fx.comets[i].progress += dt * 3.0;
    if (fx.comets[i].progress >= 1) fx.comets.splice(i, 1);
  }

  // Ambient casino felt motes
  for (const m of fx.motes) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.phase += dt * 1.6;
    if (m.y < TABLE_CENTER_Y - 235) m.y = TABLE_CENTER_Y + 235;
    if (m.x < TABLE_CENTER_X - 450) m.x = TABLE_CENTER_X + 450;
    if (m.x > TABLE_CENTER_X + 450) m.x = TABLE_CENTER_X - 450;
  }

  return dt;
}

function syncSeatStates(
  dt: number,
  players: { id: string; cardCount: number; lastAction: string | null }[],
  activePlayerId: string,
  activeColorHex: string
): void {
  const total = players.length;

  // Detect turn handoff for comet trail & spotlight glide
  if (activePlayerId && activePlayerId !== fx.lastActivePlayerId) {
    const prevIdx = players.findIndex((p) => p.id === fx.lastActivePlayerId);
    const nextIdx = players.findIndex((p) => p.id === activePlayerId);
    if (nextIdx >= 0) {
      const nextSeat = getCardSeatPosition(nextIdx, total);
      if (prevIdx >= 0 && fx.lastActivePlayerId !== '') {
        const prevSeat = getCardSeatPosition(prevIdx, total);
        fx.comets.push({
          fromX: prevSeat.x,
          fromY: prevSeat.y,
          toX: nextSeat.x,
          toY: nextSeat.y,
          colorHex: activeColorHex,
          progress: 0,
        });
      } else {
        fx.spotlightX = nextSeat.x;
        fx.spotlightY = nextSeat.y;
      }
    }
    fx.lastActivePlayerId = activePlayerId;
  }

  const activeIdx = players.findIndex((p) => p.id === activePlayerId);
  if (activeIdx >= 0) {
    const targetSeat = getCardSeatPosition(activeIdx, total);
    const k = 1 - Math.exp(-10 * dt);
    fx.spotlightX += (targetSeat.x - fx.spotlightX) * k;
    fx.spotlightY += (targetSeat.y - fx.spotlightY) * k;
    fx.spotlightAlpha += (1 - fx.spotlightAlpha) * k;
  } else {
    fx.spotlightAlpha = Math.max(0, fx.spotlightAlpha - dt * 4);
  }

  for (const p of players) {
    let st = fx.seats.get(p.id);
    if (!st) {
      st = {
        activeLerp: p.id === activePlayerId ? 1 : 0,
        displayedCards: p.cardCount,
        fanKick: 0,
        lastCardCount: p.cardCount,
        actionPop: p.lastAction ? 0.2 : 0,
        lastAction: p.lastAction,
      };
      fx.seats.set(p.id, st);
    }

    const targetActive = p.id === activePlayerId ? 1 : 0;
    st.activeLerp += (targetActive - st.activeLerp) * (1 - Math.exp(-11 * dt));

    if (p.cardCount !== st.lastCardCount) {
      st.fanKick = p.cardCount > st.lastCardCount ? 1.0 : -0.7;
      st.lastCardCount = p.cardCount;
    }
    st.displayedCards += (p.cardCount - st.displayedCards) * (1 - Math.exp(-12 * dt));
    st.fanKick *= Math.exp(-7.5 * dt);

    if (p.lastAction !== st.lastAction) {
      st.lastAction = p.lastAction;
      st.actionPop = p.lastAction ? 0 : 0;
    }
    if (p.lastAction && st.actionPop < 1) {
      st.actionPop = Math.min(1, st.actionPop + dt * 4.5);
    }
  }
}

function drawCasinoCardTable(
  ctx: CanvasRenderingContext2D,
  feltAccentHex: string,
  spotlightHex: string
): void {
  drawStudioBackdrop(ctx, '#090D11', spotlightHex, 'rgba(255,255,255,0.025)', 54);

  const cx = TABLE_CENTER_X;
  const cy = TABLE_CENTER_Y;
  const rx = 505;
  const ry = 278;

  ctx.save();
  // Deep floor shadow below table
  ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
  ctx.beginPath();
  ctx.ellipse(cx + 6, cy + 28, rx + 18, ry + 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Extruded mahogany outer wood rim (depth = 20px)
  const woodSkirt = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
  woodSkirt.addColorStop(0, '#2A1208');
  woodSkirt.addColorStop(0.3, '#5C2B16');
  woodSkirt.addColorStop(0.7, '#431D0E');
  woodSkirt.addColorStop(1, '#220D05');
  ctx.fillStyle = woodSkirt;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 18, rx + 6, ry + 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Top mahogany wood rail
  const woodTop = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  woodTop.addColorStop(0, '#7C3F23');
  woodTop.addColorStop(0.5, '#592914');
  woodTop.addColorStop(1, '#3D190B');
  ctx.fillStyle = woodTop;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 6, ry + 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Classic emerald green casino felt surface
  const feltGrad = ctx.createRadialGradient(cx, cy - 35, 30, cx, cy, rx - 30);
  feltGrad.addColorStop(0, '#16653E');
  feltGrad.addColorStop(0.58, '#0F5132');
  feltGrad.addColorStop(1, '#08331F');
  ctx.fillStyle = feltGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 26, ry - 26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Clip ambient motes & spotlight beam strictly to inside the felt
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 28, ry - 28, 0, 0, Math.PI * 2);
  ctx.clip();

  // Active turn spotlight cone gliding across the felt toward the active seat
  if (fx.spotlightAlpha > 0.02) {
    const dx = fx.spotlightX - cx;
    const dy = fx.spotlightY - cy;
    const angle = Math.atan2(dy, dx);
    const dist = Math.hypot(dx, dy);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const cone = ctx.createLinearGradient(0, 0, dist, 0);
    cone.addColorStop(0, 'rgba(255, 255, 255, 0)');
    cone.addColorStop(0.45, `${feltAccentHex}24`);
    cone.addColorStop(1, `${feltAccentHex}44`);
    ctx.globalAlpha = fx.spotlightAlpha * 0.72;
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(dist + 45, -72);
    ctx.lineTo(dist + 45, 72);
    ctx.lineTo(0, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Subtle ambient drifting gold/felt motes
  for (const m of fx.motes) {
    const a = 0.08 + 0.07 * Math.sin(m.phase);
    ctx.fillStyle = `rgba(254, 240, 138, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Felt landing ripples (from dealt & played cards)
  for (const rp of fx.ripples) {
    ctx.save();
    ctx.strokeStyle = rp.colorHex;
    ctx.globalAlpha = Math.max(0, rp.alpha);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Warm inlaid gold felt pinstripe + subtle color aura
  ctx.strokeStyle = 'rgba(255, 184, 0, 0.36)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 42, ry - 40, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = feltAccentHex;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 165, 118, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCardBack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rot = 0,
  tintHex = '#1E293B',
  goldTrim = '#FFB800'
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  ctx.fillStyle = 'rgba(7, 10, 16, 0.55)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 2.5, -h / 2 + 3.5, w, h, 8);
  ctx.fill();

  const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  grad.addColorStop(0, shadeHex(tintHex, 0.18));
  grad.addColorStop(1, shadeHex(tintHex, -0.35));
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#F8FAFC';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = goldTrim;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 5);
  ctx.stroke();

  // Center diamond crest
  ctx.fillStyle = goldTrim;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.18);
  ctx.lineTo(w * 0.18, 0);
  ctx.lineTo(0, h * 0.18);
  ctx.lineTo(-w * 0.18, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawClashCardFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: CardColor,
  value: string,
  rot = 0,
  overrideWildHex?: string,
  scale = 1,
  flashAlpha = 0
): void {
  const spec = CLASH_COLORS[color];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (scale !== 1) ctx.scale(scale, scale);

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.46)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, 10);
  ctx.fill();

  // Card outer white border
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 10);
  ctx.fill();

  // Inner colored face
  if (color === 'wild') {
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, '#FF4D2E');
    g.addColorStop(0.33, '#FFB800');
    g.addColorStop(0.66, '#10D98B');
    g.addColorStop(1, '#00C2FF');
    ctx.fillStyle = g;
  } else {
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, shadeHex(spec.bg, 0.24));
    g.addColorStop(1, spec.dark);
    ctx.fillStyle = g;
  }
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 7);
  ctx.fill();

  // Tilted oval center medallion
  ctx.save();
  ctx.rotate(-0.32);
  ctx.fillStyle = color === 'wild' && overrideWildHex ? overrideWildHex : 'rgba(15, 23, 42, 0.42)';
  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.34, h * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Center label
  const fontSize =
    value.length >= 4 ? Math.round(w * 0.24) : value.length >= 2 ? Math.round(w * 0.3) : Math.round(w * 0.44);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 ${fontSize}px "Bricolage Grotesque", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(10, 14, 22, 0.85)';
  ctx.lineWidth = 4;
  ctx.strokeText(value, 0, 1);
  ctx.fillText(value, 0, 1);

  // Corner rank badges
  const cornerFont = Math.max(10, Math.round(w * 0.16));
  ctx.font = `800 ${cornerFont}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(value, -w / 2 + 9, -h / 2 + 8);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(value, w / 2 - 9, h / 2 - 8);

  // Landing sheen flash
  if (flashAlpha > 0.02) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 10);
    ctx.fill();
  }

  ctx.restore();
}

function drawPlayingCardFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rank: string,
  suitSymbol: string,
  rot = 0,
  highlightBorder?: string,
  scale = 1
): void {
  const isRed = suitSymbol === '♥' || suitSymbol === '♦';
  const isJoker = rank === 'JOKER' || suitSymbol === '★';
  const ink = isJoker ? '#9333EA' : isRed ? '#DC2626' : '#0F172A';

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (scale !== 1) ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, 9);
  ctx.fill();

  const cardGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  cardGrad.addColorStop(0, '#FFFFFF');
  cardGrad.addColorStop(1, '#F1F5F9');
  ctx.fillStyle = cardGrad;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 9);
  ctx.fill();

  if (highlightBorder) {
    ctx.strokeStyle = highlightBorder;
    ctx.lineWidth = 4;
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // Corner rank + suit
  const cSize = Math.max(11, Math.round(w * 0.2));
  ctx.fillStyle = ink;
  ctx.font = `800 ${cSize}px "Bricolage Grotesque", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(isJoker ? '★' : rank, -w / 2 + 7, -h / 2 + 6);

  // Big center suit/rank
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(w * 0.44)}px "Bricolage Grotesque", sans-serif`;
  ctx.fillText(isJoker ? '★' : suitSymbol, 0, -4);
  ctx.font = `800 ${Math.round(w * 0.22)}px "JetBrains Mono", monospace`;
  ctx.fillText(rank, 0, h * 0.24);

  ctx.restore();
}

function drawSeatPod(
  ctx: CanvasRenderingContext2D,
  seatIdx: number,
  total: number,
  p: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot?: boolean;
    cardCount: number;
    lastAction: string | null;
  },
  isActiveTurn: boolean,
  turnTimeLeft: number,
  turnTotal: number
): void {
  const seat = getCardSeatPosition(seatIdx, total);
  const now = fx.orbitAngle * 2.8;
  const isDanger = isActiveTurn && turnTimeLeft <= 5;
  const st = fx.seats.get(p.id);
  const activeLerp = st?.activeLerp ?? (isActiveTurn ? 1 : 0);
  const fanKick = st?.fanKick ?? 0;
  const podScale = 1 + activeLerp * 0.1;

  ctx.save();

  // Active turn spotlight ring + rotating halo + 15s radial shot-clock
  if (activeLerp > 0.04) {
    ctx.save();
    ctx.globalAlpha = activeLerp;
    const pulse = 1 + Math.sin(now * (isDanger ? 2.8 : 1.4)) * 0.07;
    ctx.fillStyle = isDanger ? 'rgba(255, 59, 48, 0.24)' : 'rgba(255, 184, 0, 0.18)';
    ctx.beginPath();
    ctx.arc(seat.x, seat.y, 46 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Rotating dashed outer orbit ring
    ctx.save();
    ctx.translate(seat.x, seat.y);
    ctx.rotate(now * 0.5);
    ctx.setLineDash([7, 7]);
    ctx.strokeStyle = isDanger ? 'rgba(255, 59, 48, 0.7)' : 'rgba(255, 184, 0, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 41, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Base track ring
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(seat.x, seat.y, 34, 0, Math.PI * 2);
    ctx.stroke();

    // Countdown progress arc
    const frac = Math.max(0, Math.min(1, turnTimeLeft / Math.max(1, turnTotal)));
    ctx.strokeStyle = isDanger ? '#FF3B30' : '#10D98B';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(seat.x, seat.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.restore();
  }

  // Seat avatar medallion with smooth turn scale-lift
  ctx.save();
  ctx.translate(seat.x, seat.y);
  ctx.scale(podScale, podScale);
  drawShadowOval(ctx, 2, 18, 22, 10, 0.45);
  const grad = ctx.createRadialGradient(-8, -8, 4, 0, 0, 26);
  grad.addColorStop(0, shadeHex(p.colorHex, 0.35));
  grad.addColorStop(1, shadeHex(p.colorHex, -0.3));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isDanger ? '#FF3B30' : isActiveTurn ? '#FFB800' : '#F8FAFC';
  ctx.lineWidth = isActiveTurn ? 3 : 2;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 13px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`P${p.slotIndex + 1}`, 0, 0.5);
  ctx.restore();

  // Mini fanned face-down hand beside seat with gentle breathing & deal flare
  const showFan = Math.min(6, Math.max(0, Math.round(st?.displayedCards ?? p.cardCount)));
  const fanSide = seat.x >= TABLE_CENTER_X ? -1 : 1;
  const fanX = seat.x + fanSide * 48;
  const fanY = seat.y - 2;
  for (let i = 0; i < showFan; i++) {
    const centered = i - (showFan - 1) / 2;
    const spread = centered * (5.2 + Math.max(-1.5, fanKick * 2.5));
    const arcDrop = Math.abs(centered) * 1.4;
    const breathe = Math.sin(now * 0.9 + seatIdx + i * 0.5) * 0.025;
    const rot = centered * (0.14 + fanKick * 0.06) + breathe;
    drawCardBack(ctx, fanX + spread, fanY + arcDrop, 18, 26, rot, '#1E293B', p.colorHex);
  }

  // Card count badge
  const lowCards = p.cardCount === 1;
  ctx.fillStyle = lowCards ? '#FF4D2E' : 'rgba(13, 16, 23, 0.92)';
  ctx.beginPath();
  ctx.roundRect(fanX - 18, fanY + 12, 36, 17, 6);
  ctx.fill();
  ctx.strokeStyle = lowCards ? '#FEF08A' : p.colorHex;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`×${p.cardCount}`, fanX, fanY + 21);

  // Active shot-clock badge
  if (activeLerp > 0.25) {
    const secs = Math.ceil(turnTimeLeft);
    ctx.save();
    ctx.globalAlpha = Math.min(1, activeLerp);
    ctx.fillStyle = isDanger ? '#FF3B30' : '#111827';
    ctx.beginPath();
    ctx.roundRect(seat.x - 24, seat.y - 48, 48, 20, 6);
    ctx.fill();
    ctx.strokeStyle = isDanger ? '#FEF08A' : '#10D98B';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.fillText(`${secs}s`, seat.x, seat.y - 38);
    ctx.restore();
  }

  // Recent action callout with spring pop-in
  if (p.lastAction) {
    const popS = easeOutBack(st?.actionPop ?? 1, 1.5);
    ctx.save();
    ctx.translate(seat.x, seat.y + 54);
    ctx.scale(popS, popS);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.beginPath();
    ctx.roundRect(-58, -10, 116, 20, 6);
    ctx.fill();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tCanvas(p.lastAction), 0, 0.5);
    ctx.restore();
  }

  drawNameplate(
    ctx,
    seat.x,
    seat.y + 30,
    p.slotIndex,
    p.name,
    isDanger ? '#FF3B30' : p.colorHex,
    lowCards ? '1 CARD!' : undefined
  );

  ctx.restore();
}

function drawFlyingCardsAndFX(
  ctx: CanvasRenderingContext2D,
  flyingCards: FlyingCardAnim[],
  dt: number
): void {
  const nowMs = performance.now();
  const activeIds = new Set<string>();

  for (const fc of flyingCards) {
    activeIds.add(fc.id);
    let tr = fx.flights.get(fc.id);
    if (!tr) {
      tr = {
        fc,
        serverProgress: fc.progress,
        localProgress: fc.progress,
        landed: false,
        lastSeenMs: nowMs,
      };
      fx.flights.set(fc.id, tr);
    } else {
      tr.fc = fc;
      if (Math.abs(fc.progress - tr.serverProgress) > 0.001) {
        tr.serverProgress = fc.progress;
        // Blend smoothly toward authoritative server progress
        tr.localProgress += (fc.progress - tr.localProgress) * 0.45;
      }
      tr.lastSeenMs = nowMs;
    }
    const speed = fc.flipping ? 1.35 : 1.75;
    tr.localProgress += dt * speed;
  }

  // Prune completed flights that left server snapshot
  for (const [id, tr] of fx.flights.entries()) {
    if (!activeIds.has(id) && (tr.localProgress >= 1 || nowMs - tr.lastSeenMs > 180)) {
      fx.flights.delete(id);
    }
  }

  // Draw Turn Handoff Comets
  for (const cm of fx.comets) {
    const t = easeOutCubic(cm.progress);
    const mx = (cm.fromX + cm.toX) / 2;
    const my = (cm.fromY + cm.toY) / 2;
    const vx = mx - TABLE_CENTER_X;
    const vy = my - TABLE_CENTER_Y;
    const vLen = Math.max(1, Math.hypot(vx, vy));
    const cx = mx + (vx / vLen) * 65;
    const cy = my + (vy / vLen) * 65;

    for (let trail = 4; trail >= 0; trail--) {
      const u = Math.max(0, t - trail * 0.045);
      const px = (1 - u) * (1 - u) * cm.fromX + 2 * (1 - u) * u * cx + u * u * cm.toX;
      const py = (1 - u) * (1 - u) * cm.fromY + 2 * (1 - u) * u * cy + u * u * cm.toY;
      const alpha = (1 - t * 0.65) * (1 - trail * 0.2) * 0.78;
      ctx.save();
      ctx.fillStyle = cm.colorHex;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.beginPath();
      ctx.arc(px, py, 6.5 - trail * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Draw all active flying & flipping cards
  for (const tr of fx.flights.values()) {
    const fc = tr.fc;
    if (tr.localProgress < 0) continue;

    const rawT = clamp01(tr.localProgress);
    const u = easeOutCubic(rawT);

    // Sweeping Quadratic Bezier curve slightly bowed away from table center
    const mx = (fc.fromX + fc.toX) / 2;
    const my = (fc.fromY + fc.toY) / 2;
    const dx = fc.toX - fc.fromX;
    const dy = fc.toY - fc.fromY;
    const dist = Math.hypot(dx, dy);
    const outX = mx - TABLE_CENTER_X;
    const outY = my - TABLE_CENTER_Y;
    const outLen = Math.max(1, Math.hypot(outX, outY));
    const bow = Math.min(82, dist * 0.22);
    const ctrlX = mx + (outX / outLen) * bow;
    const ctrlY = my + (outY / outLen) * bow - 28;

    const x = (1 - u) * (1 - u) * fc.fromX + 2 * (1 - u) * u * ctrlX + u * u * fc.toX;
    const arcLift = Math.sin(rawT * Math.PI) * (fc.flipping ? 38 : 66);
    const groundY = (1 - u) * (1 - u) * fc.fromY + 2 * (1 - u) * u * ctrlY + u * u * fc.toY;
    const y = groundY - arcLift;

    // Trigger landing impact sparks/ripples right as card touches down!
    if (!tr.landed && rawT >= 0.94) {
      tr.landed = true;
      spawnLandingJuice(fc.toX, fc.toY, fc.colorHex ?? '#FFB800', Boolean(fc.faceUp));
    }

    // Damped landing settle bounce when rawT approaches 1 or > 1
    let settleScale = 1;
    let settleRot = 0;
    if (tr.localProgress > 0.92 && !fc.flipping) {
      const sPhase = clamp01((tr.localProgress - 0.92) / 0.23);
      settleScale = 1 + Math.sin(sPhase * Math.PI * 1.5) * 0.1 * (1 - sPhase);
      settleRot = Math.sin(sPhase * Math.PI * 2) * 0.05 * (1 - sPhase);
    }

    const spinArc = Math.sin(rawT * Math.PI) * 0.24 * (fc.rotEnd >= fc.rotStart ? 1 : -1);
    const rot = fc.rotStart + (fc.rotEnd - fc.rotStart) * u + spinArc + settleRot;
    const scale = (1 + Math.sin(rawT * Math.PI) * 0.34) * settleScale;

    ctx.save();
    const shadowAlpha = 0.22 + (1 - Math.sin(rawT * Math.PI)) * 0.24;
    drawShadowOval(ctx, x + 5, groundY + 14, 28 * scale, 14 * scale, shadowAlpha);

    if (fc.flipping) {
      const flipU = easeInOutCubic(Math.min(1, tr.localProgress * 1.08));
      const theta = flipU * Math.PI;
      const cosT = Math.cos(theta);
      const scaleX = Math.max(0.08, Math.abs(cosT));
      const showFront = flipU >= 0.5;
      const postBounce =
        tr.localProgress > 1
          ? 1 + Math.sin(clamp01((tr.localProgress - 1) / 0.35) * Math.PI) * 0.12
          : 1;

      ctx.translate(x, y);
      ctx.transform(1, Math.sin(theta) * 0.11, 0, 1, 0, 0);
      ctx.scale(scaleX * scale * postBounce, scale * postBounce);

      if (showFront && fc.rankText) {
        drawPlayingCardFace(
          ctx,
          0,
          0,
          78,
          110,
          fc.rankText,
          fc.suitSymbol ?? '♠',
          rot,
          fc.colorHex
        );
      } else {
        drawCardBack(ctx, 0, 0, 78, 110, rot, '#1E293B', '#FFB800');
      }

      // Crisp specular card-edge glint right as it crosses 90deg
      if (Math.abs(cosT) < 0.22) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
        ctx.fillRect(-10, -54, 20, 108);
      }
    } else if (fc.faceUp && fc.rankText) {
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      drawClashCardFace(
        ctx,
        0,
        0,
        76,
        108,
        colorFromHex(fc.colorHex),
        fc.rankText,
        rot
      );
    } else {
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      drawCardBack(ctx, 0, 0, 68, 96, rot, '#1E293B', fc.colorHex ?? '#FFB800');
    }
    ctx.restore();
  }

  // Draw crisp felt landing sparks on top
  for (const sp of fx.sparks) {
    const a = 1 - sp.life / sp.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = sp.colorHex;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.size * a, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function colorFromHex(hex?: string): CardColor {
  if (hex === '#FF4D2E') return 'red';
  if (hex === '#00C2FF') return 'blue';
  if (hex === '#FFB800') return 'gold';
  if (hex === '#10D98B') return 'green';
  return 'wild';
}

function drawTableBanner(
  ctx: CanvasRenderingContext2D,
  text: string | null,
  colorHex: string | null
): void {
  if (!text) {
    fx.lastBannerText = null;
    return;
  }
  if (text !== fx.lastBannerText) {
    fx.lastBannerText = text;
    fx.bannerAnim = 0;
  }
  const s = easeOutBack(fx.bannerAnim, 1.55);
  const alpha = clamp01(fx.bannerAnim * 2.5);

  ctx.save();
  const y = 78;
  ctx.globalAlpha = alpha;
  ctx.translate(ARENA_WIDTH / 2, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(11, 14, 20, 0.92)';
  ctx.beginPath();
  ctx.roundRect(-220, -22, 440, 44, 14);
  ctx.fill();
  ctx.strokeStyle = colorHex ?? '#FFB800';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 20px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tCanvas(text), 0, 0.5);
  ctx.restore();
}

// ============================================================
// 31. COLOR CLASH RENDERER
// ============================================================
export function renderColorClash(
  ctx: CanvasRenderingContext2D,
  snap: ColorClashSnapshot
): void {
  const dt = stepTableFX('color-clash');
  const targetAccentHex = CLASH_COLORS[snap.activeColor].bg;
  fx.feltAccentHex = lerpHex(fx.feltAccentHex, targetAccentHex, 1 - Math.exp(-8 * dt));

  // Smooth direction angular velocity easing on REVERSE
  if (snap.direction !== fx.lastDirection) {
    fx.orbitVel = snap.direction * 4.2; // crisp directional whip burst!
    fx.lastDirection = snap.direction;
  }
  const targetVel = snap.direction * 1.45;
  fx.orbitVel += (targetVel - fx.orbitVel) * (1 - Math.exp(-4.5 * dt));
  fx.orbitAngle += fx.orbitVel * dt;

  // Detect new top card for slam settle spring
  const topKey = `${snap.discardCount}|${snap.topCard.id}|${snap.topCard.color}|${snap.topCard.value}`;
  if (topKey !== fx.lastTopKey) {
    if (fx.lastTopKey !== '') {
      fx.pileSlam = 1.0;
      fx.pileSlamRot = (Math.random() - 0.5) * 0.24;
      spawnLandingJuice(TABLE_CENTER_X + 74, TABLE_CENTER_Y, targetAccentHex, true);
    }
    fx.lastTopKey = topKey;
  }

  // Detect Draw Deck card draw
  if (fx.lastDeckCount >= 0 && snap.deckCount < fx.lastDeckCount) {
    fx.deckPulse = 1.0;
  }
  fx.lastDeckCount = snap.deckCount;

  syncSeatStates(dt, snap.players, snap.activePlayerId, fx.feltAccentHex);

  drawCasinoCardTable(ctx, fx.feltAccentHex, 'rgba(16, 217, 139, 0.08)');

  // Smoothly orbiting turn direction arrows circling the center piles
  ctx.save();
  ctx.translate(TABLE_CENTER_X, TABLE_CENTER_Y);
  for (let i = 0; i < 4; i++) {
    const a = fx.orbitAngle + (i * Math.PI) / 2;
    ctx.save();
    ctx.rotate(a);
    ctx.strokeStyle = fx.feltAccentHex;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 152, -0.32, 0.32);
    ctx.stroke();

    const tipAngle = snap.direction === 1 ? 0.36 : -0.36;
    const tx = Math.cos(tipAngle) * 152;
    const ty = Math.sin(tipAngle) * 152;
    ctx.translate(tx, ty);
    ctx.rotate(tipAngle + (snap.direction === 1 ? Math.PI / 2 : -Math.PI / 2));
    ctx.fillStyle = fx.feltAccentHex;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Draw Deck stack on the left of center with tactile draw peel bounce
  const deckX = TABLE_CENTER_X - 108;
  const deckY = TABLE_CENTER_Y;
  const deckLift = Math.sin(fx.deckPulse * Math.PI) * 7;
  for (let layer = 3; layer >= 0; layer--) {
    const topBoost = layer === 0 ? deckLift : 0;
    drawCardBack(
      ctx,
      deckX - layer * 2,
      deckY + layer * 2 - topBoost,
      84,
      120,
      -0.04 + (layer === 0 ? fx.deckPulse * 0.07 : 0),
      '#1E293B',
      '#00C2FF'
    );
  }
  ctx.save();
  ctx.fillStyle = 'rgba(12, 16, 24, 0.88)';
  ctx.beginPath();
  ctx.roundRect(deckX - 40, deckY + 68, 80, 22, 7);
  ctx.fill();
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '800 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${tCanvas('DECK')} ${snap.deckCount}`, deckX, deckY + 79);
  ctx.restore();

  // Recent fanned discard cards underneath top card
  const pileX = TABLE_CENTER_X + 74;
  const pileY = TABLE_CENTER_Y;
  const prevCards = snap.recentCards.slice(0, -1);
  prevCards.forEach((rc, idx) => {
    drawClashCardFace(
      ctx,
      pileX + (idx - 1.5) * 7,
      pileY + (idx - 1.5) * 3,
      86,
      122,
      rc.color,
      rc.value,
      rc.rot
    );
  });

  // Active Top Card with glowing ring + easeOutBack slam-settle spring!
  ctx.save();
  ctx.fillStyle = fx.feltAccentHex;
  ctx.globalAlpha = 0.25 + Math.sin(fx.orbitAngle * 4.5) * 0.08 + fx.pileSlam * 0.25;
  ctx.beginPath();
  ctx.roundRect(pileX - 58, pileY - 77, 116, 154, 16);
  ctx.fill();
  ctx.restore();

  const slamElapsed = 1 - fx.pileSlam;
  const slamScale =
    fx.pileSlam > 0.01 ? 1 + (1 - easeOutBack(slamElapsed, 1.8)) * 0.26 : 1;
  const slamRot = fx.pileSlam > 0.01 ? fx.pileSlamRot * (1 - easeOutCubic(slamElapsed)) : 0;

  drawClashCardFace(
    ctx,
    pileX,
    pileY,
    92,
    130,
    snap.topCard.color,
    snap.topCard.value,
    slamRot,
    snap.topCard.color === 'wild' ? fx.feltAccentHex : undefined,
    slamScale,
    fx.pileSlam * 0.38
  );

  // Active color chip + Draw Penalty flame badge
  ctx.save();
  ctx.fillStyle = fx.feltAccentHex;
  ctx.beginPath();
  ctx.roundRect(pileX - 44, pileY + 72, 88, 22, 8);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = snap.activeColor === 'gold' || snap.activeColor === 'green' ? '#0B1219' : '#FFFFFF';
  ctx.font = '800 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tCanvas(snap.activeColor.toUpperCase()), pileX, pileY + 83);
  ctx.restore();

  if (snap.drawPenalty > 0) {
    const bounce = Math.sin(fx.orbitAngle * 6) * 4;
    ctx.save();
    ctx.fillStyle = '#FF3B30';
    ctx.beginPath();
    ctx.roundRect(TABLE_CENTER_X - 48, TABLE_CENTER_Y - 96 + bounce, 96, 30, 10);
    ctx.fill();
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${snap.drawPenalty}`, TABLE_CENTER_X, TABLE_CENTER_Y - 81 + bounce);
    ctx.restore();
  }

  // Player seat pods
  snap.players.forEach((p, idx) => {
    drawSeatPod(
      ctx,
      idx,
      snap.players.length,
      p,
      p.id === snap.activePlayerId,
      snap.turnTimeLeft,
      snap.turnTotal
    );
  });

  // Shockwaves & 60fps Flying Cards & Popups
  for (const sw of snap.shockwaves) {
    ctx.save();
    ctx.strokeStyle = sw.colorHex;
    ctx.globalAlpha = Math.max(0, sw.alpha);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawFlyingCardsAndFX(ctx, snap.flyingCards, dt);
  drawPopupTexts(ctx, snap.popups);
  drawTableBanner(ctx, snap.banner, snap.bannerColor);

  // Top-left match info box (No total match clock — 15s turn clock only!)
  ctx.save();
  ctx.fillStyle = 'rgba(13, 16, 23, 0.88)';
  ctx.beginPath();
  ctx.roundRect(22, 18, 250, 38, 10);
  ctx.fill();
  ctx.strokeStyle = fx.feltAccentHex;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 13px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    tCanvas(`${snap.direction === 1 ? '↻' : '↺'}  ${Math.ceil(snap.turnTimeLeft)}s TURN · #${snap.turnCount + 1}`),
    36,
    37
  );
  ctx.restore();
}

// ============================================================
// 32. LIAR'S DECK RENDERER
// ============================================================
export function renderLiarsDeck(
  ctx: CanvasRenderingContext2D,
  snap: LiarsDeckSnapshot
): void {
  const dt = stepTableFX('liars-deck');
  const isBluffHot = snap.phase === 'challenge' || snap.revealVerdict === 'bluff-caught';
  const targetAccent = isBluffHot ? '#FF4D2E' : '#FFB800';
  fx.feltAccentHex = lerpHex(fx.feltAccentHex, targetAccent, 1 - Math.exp(-8 * dt));

  if (fx.lastPileCount >= 0 && snap.pileCount > fx.lastPileCount) {
    fx.pileSlam = 1.0;
    fx.pileSlamRot = (Math.random() - 0.5) * 0.22;
    spawnLandingJuice(TABLE_CENTER_X, TABLE_CENTER_Y + 26, '#FFB800', true);
  }
  fx.lastPileCount = snap.pileCount;

  syncSeatStates(
    dt,
    snap.players,
    snap.phase === 'selecting' ? snap.activePlayerId : '',
    fx.feltAccentHex
  );

  drawCasinoCardTable(ctx, fx.feltAccentHex, 'rgba(255, 184, 0, 0.09)');

  // Center Target Rank Crest (e.g. TARGET: A)
  const targetY = TABLE_CENTER_Y - 82;
  ctx.save();
  ctx.fillStyle = 'rgba(11, 15, 22, 0.92)';
  ctx.beginPath();
  ctx.roundRect(TABLE_CENTER_X - 110, targetY - 26, 220, 52, 14);
  ctx.fill();
  ctx.strokeStyle = '#FFB800';
  ctx.lineWidth = 2.4;
  ctx.stroke();

  ctx.fillStyle = '#FFB800';
  ctx.font = '800 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${tCanvas('TARGET')} · ★ ${tCanvas('JOKER = WILD')}`, TABLE_CENTER_X, targetY - 12);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 22px "Bricolage Grotesque", sans-serif';
  ctx.fillText(snap.targetRank, TABLE_CENTER_X, targetY + 11);
  ctx.restore();

  // Center Face-Down Table Pile with slam settle bounce
  const pileX = TABLE_CENTER_X;
  const pileY = TABLE_CENTER_Y + 26;
  const stackDraw = Math.min(6, snap.pileCount);
  if (stackDraw === 0 && snap.phase !== 'reveal') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 184, 0, 0.35)';
    ctx.setLineDash([7, 7]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(pileX - 42, pileY - 58, 84, 116, 10);
    ctx.stroke();
    ctx.restore();
  } else if (snap.phase !== 'reveal') {
    const slamElapsed = 1 - fx.pileSlam;
    const topSlamScale =
      fx.pileSlam > 0.01 ? 1 + (1 - easeOutBack(slamElapsed, 1.8)) * 0.22 : 1;
    for (let i = 0; i < stackDraw; i++) {
      const isTop = i === stackDraw - 1;
      const rot = ((i * 7) % 5 - 2) * 0.06 + (isTop ? fx.pileSlamRot * fx.pileSlam : 0);
      const s = isTop ? topSlamScale : 1;
      drawCardBack(
        ctx,
        pileX + i * 2 - stackDraw,
        pileY - i * 2,
        82 * s,
        114 * s,
        rot,
        '#181E29',
        '#FFB800'
      );
    }
  }

  // Pile Count Label
  ctx.save();
  ctx.fillStyle = 'rgba(13, 16, 23, 0.9)';
  ctx.beginPath();
  ctx.roundRect(pileX - 66, pileY + 66, 132, 24, 8);
  ctx.fill();
  ctx.strokeStyle = '#FFB800';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${tCanvas('PILE')}: ${snap.pileCount}`, pileX, pileY + 78);
  ctx.restore();

  // Challenge Window Ring around center pile
  if (snap.phase === 'challenge') {
    const frac = Math.max(0, Math.min(1, snap.turnTimeLeft / Math.max(1, snap.turnTotal)));
    const pulseR = 96 + Math.sin(performance.now() * 0.009) * 3;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 77, 46, 0.28)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(pileX, pileY, pulseR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = snap.turnTimeLeft <= 2.5 ? '#FF3B30' : '#FFB800';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(pileX, pileY, pulseR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.restore();
  }

  // Revealed flipped cards once their flip completes
  if (snap.phase === 'reveal' && snap.revealedCards.length > 0) {
    snap.revealedCards.forEach((c: LiarCard & { matchesTarget: boolean }, i: number) => {
      const flipMatch = Array.from(fx.flights.values()).find(
        (tr) => tr.fc.flipping && tr.fc.id.endsWith(`_${i}`)
      );
      if (flipMatch) return;
      const offset = (i - (snap.revealedCards.length - 1) / 2) * 90;
      const suitSym =
        c.suit === 'spades'
          ? '♠'
          : c.suit === 'hearts'
          ? '♥'
          : c.suit === 'diamonds'
          ? '♦'
          : c.suit === 'clubs'
          ? '♣'
          : '★';
      drawPlayingCardFace(
        ctx,
        TABLE_CENTER_X + offset,
        TABLE_CENTER_Y - 10,
        78,
        110,
        c.rank,
        suitSym,
        (i - (snap.revealedCards.length - 1) / 2) * 0.08,
        c.matchesTarget ? '#10D98B' : '#FF4D2E'
      );
    });
  }

  // Seat pods around table
  snap.players.forEach((p, idx) => {
    const isActive = snap.phase === 'selecting' && p.id === snap.activePlayerId;
    drawSeatPod(
      ctx,
      idx,
      snap.players.length,
      p,
      isActive,
      snap.turnTimeLeft,
      snap.turnTotal
    );
  });

  // Shockwaves, 60fps flying cards, popups & banner
  for (const sw of snap.shockwaves) {
    ctx.save();
    ctx.strokeStyle = sw.colorHex;
    ctx.globalAlpha = Math.max(0, sw.alpha);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawFlyingCardsAndFX(ctx, snap.flyingCards, dt);
  drawPopupTexts(ctx, snap.popups);
  drawTableBanner(ctx, snap.banner, snap.bannerColor);

  // Top-left round & shot-clock box
  ctx.save();
  ctx.fillStyle = 'rgba(13, 16, 23, 0.88)';
  ctx.beginPath();
  ctx.roundRect(22, 18, 260, 38, 10);
  ctx.fill();
  ctx.strokeStyle = fx.feltAccentHex;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 13px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    tCanvas(
      snap.phase === 'challenge'
        ? `ROUND ${snap.round} · BLUFF CHECK ${Math.ceil(snap.turnTimeLeft)}s`
        : `ROUND ${snap.round} · ${Math.ceil(snap.turnTimeLeft)}s TURN`
    ),
    36,
    37
  );
  ctx.restore();
}

import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../shared/cardLayout';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BigTwoRoyaleSnapshot,
  type CardShockwave,
  type DeskFlippersSnapshot,
  type FlyingCardAnim,
  type LineBreakersSnapshot,
  type Lucky21Snapshot,
  type MarbleRingSnapshot,
  type PitHarvestSnapshot,
  type RattanVolleySnapshot,
  type SpinClashSnapshot,
  type StandardCardView,
  type StepStompSnapshot,
  type TenPairShowdownSnapshot,
} from '../shared/types';
import { drawBoardBanner, drawHudChip, drawNameplate, drawPopupTexts, isTablePlayerHidden, tCanvas } from './canvasHelpers';
import {
  drawArenaSlab,
  drawCharacterPod3D,
  drawCrown3D,
  drawExtrudedDiscStage,
  drawShadowOval,
  drawSphere3D,
  drawStudioBackdrop,
  shadeHex,
} from './render25d';
import { clamp01, easeOutCubic, getMotionTime } from './arcadeMotion';

// ============================================================
// SHARED HELPERS FOR PACK 1 (MALAYSIAN CLASSICS & CNY CARDS)
// ============================================================
const SUIT_SYMBOL: Record<StandardCardView['suit'], string> = {
  spades: '♠',
  hearts: '♥',
  clubs: '♣',
  diamonds: '♦',
};

const SUIT_COLOR: Record<StandardCardView['suit'], string> = {
  spades: '#111827',
  hearts: '#DC2626',
  clubs: '#111827',
  diamonds: '#DC2626',
};

function drawStandardPlayingCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  card: StandardCardView,
  rot = 0,
  highlightHex?: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 3, -h / 2 + 6, w, h, 8);
  ctx.fill();

  // Crisp ivory card body
  const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  grad.addColorStop(0, '#FFFFFF');
  grad.addColorStop(1, '#F1F5F9');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 8);
  ctx.fill();

  ctx.strokeStyle = highlightHex ?? '#CBD5E1';
  ctx.lineWidth = highlightHex ? 2.6 : 1.5;
  ctx.stroke();

  const color = SUIT_COLOR[card.suit];
  const sym = SUIT_SYMBOL[card.suit];

  // Top-left corner pip
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `900 ${Math.round(w * 0.27)}px "JetBrains Mono", monospace`;
  ctx.fillText(card.rank, -w / 2 + 5, -h / 2 + 4);
  ctx.font = `700 ${Math.round(w * 0.24)}px sans-serif`;
  ctx.fillText(sym, -w / 2 + 5, -h / 2 + 4 + w * 0.27);

  // Center emblem
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(w * 0.52)}px sans-serif`;
  ctx.fillText(sym, 0, h * 0.05);

  // Bottom-right corner pip
  ctx.save();
  ctx.rotate(Math.PI);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `900 ${Math.round(w * 0.24)}px "JetBrains Mono", monospace`;
  ctx.fillText(card.rank, -w / 2 + 5, -h / 2 + 4);
  ctx.restore();

  ctx.restore();
}

function drawCnyCardBack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rot = 0,
  tint = '#B91C1C'
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 2, -h / 2 + 4, w, h, 7);
  ctx.fill();

  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 7);
  ctx.fill();

  ctx.strokeStyle = '#FCD34D';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Inner gold diamond motif
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 4);
  ctx.stroke();

  ctx.fillStyle = 'rgba(252, 211, 77, 0.85)';
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.16);
  ctx.lineTo(w * 0.2, 0);
  ctx.lineTo(0, h * 0.16);
  ctx.lineTo(-w * 0.2, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawCnyOvalTable(
  ctx: CanvasRenderingContext2D,
  feltCenter: string,
  feltEdge: string,
  rimOuter: string,
  rimInner: string,
  accentGlow: string
): void {
  drawStudioBackdrop(ctx, '#12080A', accentGlow, 'rgba(255, 210, 120, 0.03)', 56);

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.beginPath();
  ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y + 18, 496, 268, 0, 0, Math.PI * 2);
  ctx.fill();

  const rimGrad = ctx.createLinearGradient(0, TABLE_CENTER_Y - 260, 0, TABLE_CENTER_Y + 260);
  rimGrad.addColorStop(0, rimOuter);
  rimGrad.addColorStop(0.5, rimInner);
  rimGrad.addColorStop(1, shadeHex(rimOuter, -0.35));
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y, 488, 256, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.45)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const feltGrad = ctx.createRadialGradient(
    TABLE_CENTER_X,
    TABLE_CENTER_Y - 30,
    30,
    TABLE_CENTER_X,
    TABLE_CENTER_Y,
    460
  );
  feltGrad.addColorStop(0, feltCenter);
  feltGrad.addColorStop(1, feltEdge);
  ctx.fillStyle = feltGrad;
  ctx.beginPath();
  ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y, 452, 224, 0, 0, Math.PI * 2);
  ctx.fill();

  // Golden ornamental rail
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.28)';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y, 424, 198, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawCardFx(
  ctx: CanvasRenderingContext2D,
  flyingCards: FlyingCardAnim[],
  shockwaves: CardShockwave[]
): void {
  // Shockwaves
  for (const sw of shockwaves) {
    ctx.save();
    ctx.globalAlpha = clamp01(sw.alpha) * 0.72;
    ctx.strokeStyle = sw.colorHex;
    ctx.lineWidth = 4.5 * clamp01(sw.alpha) + 1.5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Flying cards
  for (const fc of flyingCards) {
    const p = clamp01(fc.progress);
    const e = easeOutCubic(p);
    const x = fc.fromX + (fc.toX - fc.fromX) * e;
    const y = fc.fromY + (fc.toY - fc.fromY) * e - Math.sin(p * Math.PI) * 34;
    const rot = fc.rotStart + (fc.rotEnd - fc.rotStart) * e;
    if (fc.faceUp && (fc.rankText || fc.suitSymbol)) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = fc.colorHex || '#F59E0B';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(-24, -34, 48, 68, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.font = '900 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${fc.rankText ?? ''}${fc.suitSymbol ?? ''}`, 0, 0);
      ctx.restore();
    } else {
      drawCnyCardBack(ctx, x, y, 42, 60, rot, fc.colorHex || '#B91C1C');
    }
  }
}

function drawSeatPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  colorHex: string,
  subtitle: string,
  isActive: boolean,
  isBanker = false,
  badge?: { text: string; bg: string; fg: string }
): void {
  ctx.save();
  const w = 158;
  const h = 48;
  ctx.fillStyle = isActive ? 'rgba(28, 22, 16, 0.96)' : 'rgba(13, 15, 22, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 11);
  ctx.fill();

  ctx.strokeStyle = isActive ? '#FFB800' : colorHex;
  ctx.lineWidth = isActive ? 3 : 1.8;
  ctx.stroke();

  if (isActive) {
    ctx.strokeStyle = 'rgba(255, 184, 0, 0.32)';
    ctx.lineWidth = 7;
    ctx.stroke();
  }

  // Color dot
  ctx.fillStyle = colorHex;
  ctx.beginPath();
  ctx.arc(x - w / 2 + 14, y - 7, 5, 0, Math.PI * 2);
  ctx.fill();

  // Name
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const maxName = name.length > 12 ? `${name.slice(0, 11)}…` : name;
  ctx.fillText(maxName, x - w / 2 + 24, y - 7);

  // Subtitle
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillText(tCanvas(subtitle), x - w / 2 + 12, y + 12);

  // Banker medallion
  if (isBanker) {
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.roundRect(x + w / 2 - 48, y - h / 2 - 12, 46, 18, 5);
    ctx.fill();
    ctx.fillStyle = '#18120B';
    ctx.font = '900 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas('BANKER'), x + w / 2 - 25, y - h / 2 - 2.5);
  }

  // Extra alert badge
  if (badge) {
    ctx.font = '900 11px "JetBrains Mono", monospace';
    const bw = Math.max(54, ctx.measureText(tCanvas(badge.text)).width + 16);
    ctx.fillStyle = badge.bg;
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, y + h / 2 + 4, bw, 20, 6);
    ctx.fill();
    ctx.fillStyle = badge.fg;
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(badge.text), x, y + h / 2 + 14.5);
  }
  ctx.restore();
}

// ============================================================
// 49. LINE BREAKERS (Galah Panjang / 过五关)
// ============================================================
export function renderLineBreakers(ctx: CanvasRenderingContext2D, snap: LineBreakersSnapshot): void {
  const t = getMotionTime();
  drawStudioBackdrop(ctx, '#0D131C', 'rgba(245, 158, 11, 0.14)', 'rgba(255,255,255,0.025)', 48);

  const { courtX, courtY, courtW, courtH, lineYs, centerSpineX } = snap;

  // Raised kampung courtyard slab
  const courtGrad = ctx.createLinearGradient(courtX, courtY, courtX, courtY + courtH);
  courtGrad.addColorStop(0, '#1D2939');
  courtGrad.addColorStop(0.5, '#192331');
  courtGrad.addColorStop(1, '#1E293B');
  drawArenaSlab(ctx, courtX, courtY, courtW, courtH, 16, 14, courtGrad, '#0B111A', '#F59E0B', 3);

  // Far-End Goal Zone (Top) & Start Zone (Bottom)
  ctx.save();
  ctx.fillStyle = 'rgba(16, 217, 139, 0.16)';
  ctx.fillRect(courtX + 3, courtY + 3, courtW - 6, 56);
  ctx.fillStyle = 'rgba(0, 194, 255, 0.13)';
  ctx.fillRect(courtX + 3, courtY + courtH - 59, courtW - 6, 56);

  // Zone labels
  ctx.font = '900 13px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(16, 217, 139, 0.85)';
  ctx.fillText(tCanvas('FAR END — TOUCH & RETURN'), courtX + courtW / 2, courtY + 26);
  ctx.fillStyle = 'rgba(0, 194, 255, 0.85)';
  ctx.fillText(tCanvas('START & HOME GOAL'), courtX + courtW / 2, courtY + courtH - 26);

  // Chalk guard lines (horizontal)
  for (let i = 0; i < lineYs.length; i++) {
    const ly = lineYs[i];
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.22)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(courtX + 6, ly);
    ctx.lineTo(courtX + courtW - 6, ly);
    ctx.stroke();

    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 6]);
    ctx.beginPath();
    ctx.moveTo(courtX + 6, ly);
    ctx.lineTo(courtX + courtW - 6, ly);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Center spine (Ibu / Captain vertical line)
  const topLine = lineYs[0] ?? courtY + 80;
  const botLine = lineYs[lineYs.length - 1] ?? courtY + courtH - 80;
  ctx.strokeStyle = 'rgba(255, 77, 46, 0.28)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(centerSpineX, topLine);
  ctx.lineTo(centerSpineX, botLine);
  ctx.stroke();

  ctx.strokeStyle = '#FDBA74';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(centerSpineX, topLine);
  ctx.lineTo(centerSpineX, botLine);
  ctx.stroke();
  ctx.restore();

  // Players sorted by Y
  const sorted = [...snap.players].sort((a, b) => a.y - b.y);
  for (const p of sorted) {
    if (!p.alive) continue;
    const isGuard = p.role === 'guard';
    const pulsing = p.dashTimer > 0 ? 1.12 : 1;

    // Guard reach bar / Runner feint halo
    ctx.save();
    if (isGuard) {
      ctx.strokeStyle = `${p.colorHex}55`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 29 + (p.dashTimer > 0 ? 8 : 0), 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.feintTimer > 0) {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26 + Math.sin(t * 16) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    drawCharacterPod3D(ctx, p.x, p.y, isGuard ? 19 : 17, p.angle, p.colorHex, {
      playerId: p.id,
      scale: pulsing,
      rimColor: isGuard ? '#FDE68A' : p.reachedFarEnd ? '#10D98B' : '#FFFFFF',
      hat: p.reachedFarEnd ? 'crown' : 'none',
      alpha: p.feintTimer > 0 ? 0.65 : 1,
    });

    const roleTag = isGuard ? 'GUARD' : p.reachedFarEnd ? 'RETURN!' : 'RUNNER';
    drawNameplate(ctx, p.x, p.y + 30, p.slotIndex, p.name, p.colorHex, `${roleTag} · ${p.score}`);
  }

  // Top HUD
  drawHudChip(ctx, 20, 16, `RD ${snap.round}/${snap.totalRounds}`, '#F59E0B', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.roundTimer)}s`, '#00C2FF', 'right');
  drawBoardBanner(ctx, 'line-breakers', snap.banner, null, '#F59E0B');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 50. DESK FLIPPERS (Lawan Pemadam / 翻橡皮擦)
// ============================================================
export function renderDeskFlippers(ctx: CanvasRenderingContext2D, snap: DeskFlippersSnapshot): void {
  drawStudioBackdrop(ctx, '#1A130D', 'rgba(249, 115, 22, 0.16)', 'rgba(255, 230, 180, 0.025)', 52);
  const { deskX, deskY, deskW, deskH } = snap;

  // Warm sunlit wooden Malaysian classroom desk slab
  const woodGrad = ctx.createLinearGradient(deskX, deskY, deskX + deskW, deskY + deskH);
  woodGrad.addColorStop(0, '#B8834E');
  woodGrad.addColorStop(0.5, '#A66F3C');
  woodGrad.addColorStop(1, '#8C592C');
  drawArenaSlab(ctx, deskX, deskY, deskW, deskH, 16, 20, woodGrad, '#5A3618', '#E2B47D', 3.5);

  // Subtle wood plank seams & carved pencil tray groove
  ctx.save();
  ctx.strokeStyle = 'rgba(65, 34, 12, 0.25)';
  ctx.lineWidth = 2;
  for (let py = deskY + 80; py < deskY + deskH - 40; py += 90) {
    ctx.beginPath();
    ctx.moveTo(deskX + 10, py);
    ctx.lineTo(deskX + deskW - 10, py);
    ctx.stroke();
  }
  // Pencil groove near top of desk
  ctx.fillStyle = 'rgba(60, 32, 10, 0.35)';
  ctx.beginPath();
  ctx.roundRect(deskX + deskW * 0.26, deskY + 18, deskW * 0.48, 12, 6);
  ctx.fill();

  // Subtle boundary warning zone near edges
  ctx.strokeStyle = 'rgba(255, 245, 220, 0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(deskX + 18, deskY + 18, deskW - 36, deskH - 36);
  ctx.setLineDash([]);
  ctx.restore();

  // Tindih landing shockwaves
  for (const sw of snap.shockwaves) {
    ctx.save();
    ctx.globalAlpha = clamp01(sw.alpha);
    ctx.strokeStyle = sw.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Erasers sorted by z (airborne ones on top!)
  const sorted = [...snap.players].sort((a, b) => a.z - b.z || a.y - b.y);
  for (const p of sorted) {
    if (!p.alive) continue;
    const zScale = 1 + Math.min(0.42, p.z * 0.0045);
    const drawY = p.y - p.z;
    const erW = 46 * zScale;
    const erH = 26 * zScale;

    // Ground shadow beneath airborne eraser
    drawShadowOval(ctx, p.x + 3, p.y + 8, 25 * Math.max(0.55, 1 - p.z / 160), 14 * Math.max(0.55, 1 - p.z / 160), 0.45);

    // Aim direction arrow + charge bar when grounded
    if (p.z < 2 && p.pinnedTimer <= 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      const len = 34 + p.charge * 34;
      ctx.strokeStyle = p.charge > 0.1 ? '#FDE047' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = p.charge > 0.1 ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(len, 0);
      ctx.lineTo(len - 8, -6);
      ctx.moveTo(len, 0);
      ctx.lineTo(len - 8, 6);
      ctx.stroke();
      ctx.restore();
    }

    // 2.5D Rubber Eraser with Flag Sleeve
    ctx.save();
    ctx.translate(p.x, drawY);
    ctx.rotate(p.angle + p.flipRot * 0.25);
    const tumbleSquash = 0.55 + 0.45 * Math.abs(Math.cos(p.flipRot));
    ctx.scale(1, tumbleSquash);

    // Thickness lip
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.roundRect(-erW / 2, -erH / 2 + 6, erW, erH, 5);
    ctx.fill();

    // Main white rubber block
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.roundRect(-erW / 2, -erH / 2, erW, erH, 5);
    ctx.fill();
    ctx.strokeStyle = p.pinnedTimer > 0 ? '#EF4444' : '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cardboard flag wrapper band across middle
    ctx.fillStyle = p.colorHex;
    ctx.fillRect(-erW * 0.34, -erH / 2 + 1, erW * 0.68, erH - 2);
    // Flag stripe accent
    ctx.fillStyle = p.flagStripeHex || '#FACC15';
    ctx.fillRect(-erW * 0.34, -3, erW * 0.68, 6);
    // Tiny emblem star/circle
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-erW * 0.14, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    if (p.pinnedTimer > 0) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.fillRect(-erW / 2, -erH / 2, erW, erH);
    }
    ctx.restore();

    drawNameplate(ctx, p.x, p.y + 28, p.slotIndex, p.name, p.colorHex, `${p.pins} PIN`);
  }

  drawHudChip(ctx, 20, 16, `RD ${snap.round}/${snap.totalRounds}`, '#F97316', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.timeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'desk-flippers', snap.banner, null, '#F97316');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 51. SPIN CLASH (Gasing Pangkah / 马来陀螺)
// ============================================================
export function renderSpinClash(ctx: CanvasRenderingContext2D, snap: SpinClashSnapshot): void {
  drawStudioBackdrop(ctx, '#0F131A', 'rgba(234, 179, 8, 0.16)', 'rgba(255,255,255,0.025)', 48);

  const { ringCenterX: cx, ringCenterY: cy, ringRadius: rr } = snap;

  // Carved circular kampung timber ring
  const ringGrad = ctx.createRadialGradient(cx, cy - 20, 20, cx, cy, rr);
  ringGrad.addColorStop(0, '#4E3724');
  ringGrad.addColorStop(0.75, '#3A2719');
  ringGrad.addColorStop(1, '#291A10');
  drawExtrudedDiscStage(ctx, cx, cy, rr, 18, ringGrad, '#1E120A', '#EAB308');

  // Concentric kampung battle rings
  ctx.save();
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.18)';
  ctx.lineWidth = 2;
  for (const frac of [0.35, 0.68, 0.92]) {
    ctx.beginPath();
    ctx.arc(cx, cy, rr * frac, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Danger rim glow
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
  ctx.lineWidth = 5;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.arc(cx, cy, rr - 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Collision sparks
  for (const sp of snap.sparks) {
    ctx.save();
    ctx.globalAlpha = clamp01(sp.alpha);
    ctx.fillStyle = sp.colorHex;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Spinning Gasing Tops
  for (const p of snap.players) {
    if (!p.alive) continue;
    const r = 24;
    const rpmFrac = clamp01(p.rpm / 100);

    // Shadow
    drawShadowOval(ctx, p.x + 3, p.y + 10, r * 0.92, r * 0.58, 0.48);

    // Whip burst trail ring
    if (p.whipTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Brace iron shield
    if (p.braceTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4.5;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Spinning Gasing body
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spinAngle);

    // Outer brass rim
    const topGrad = ctx.createRadialGradient(-6, -6, 3, 0, 0, r);
    topGrad.addColorStop(0, shadeHex(p.colorHex, 0.35));
    topGrad.addColorStop(0.6, p.colorHex);
    topGrad.addColorStop(1, shadeHex(p.colorHex, -0.45));
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // Carved radial blades/notches showing spin speed
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a) * (r - 3), Math.sin(a) * (r - 3));
      ctx.stroke();
    }

    // Central spindle cap
    ctx.fillStyle = '#FFFBEB';
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // RPM arc gauge around top
    ctx.save();
    ctx.strokeStyle = rpmFrac < 0.25 ? '#EF4444' : '#10D98B';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rpmFrac);
    ctx.stroke();
    ctx.restore();

    drawNameplate(ctx, p.x, p.y + 38, p.slotIndex, p.name, p.colorHex, `${Math.round(p.rpm)} RPM`);
  }

  drawHudChip(ctx, 20, 16, `RD ${snap.round}/${snap.totalRounds}`, '#EAB308', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.timeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'spin-clash', snap.banner, null, '#EAB308');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 52. MARBLE RING (Guli / Kelereng / 弹珠)
// ============================================================
export function renderMarbleRing(ctx: CanvasRenderingContext2D, snap: MarbleRingSnapshot): void {
  drawStudioBackdrop(ctx, '#1A1410', 'rgba(16, 185, 129, 0.14)', 'rgba(255,240,210,0.02)', 50);

  const { ringCenterX: cx, ringCenterY: cy, ringRadius: rr } = snap;

  // Kampung sand/earth courtyard slab
  const yardGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 460);
  yardGrad.addColorStop(0, '#574231');
  yardGrad.addColorStop(0.65, '#423022');
  yardGrad.addColorStop(1, '#2D2016');
  drawArenaSlab(ctx, 64, 52, ARENA_WIDTH - 128, ARENA_HEIGHT - 104, 24, 14, yardGrad, '#1B120C', '#A16207', 2.5);

  // Chalk Bulatan Circle
  ctx.save();
  ctx.fillStyle = 'rgba(254, 243, 199, 0.08)';
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FEF3C7';
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(254, 243, 199, 0.45)';
  ctx.font = '800 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tCanvas('KNOCK MARBLES OUT OF THE RING!'), cx, cy - rr - 14);
  ctx.restore();

  // Target Guli marbles
  let remainingCount = 0;
  for (const m of snap.marbles) {
    if (m.claimed) continue;
    remainingCount++;
    const rim = m.kind === 'gold' ? '#FEF08A' : m.kind === 'jade' ? '#6EE7B7' : '#E0F2FE';
    drawSphere3D(ctx, m.x, m.y, m.r, m.colorHex, rim, 0, true);
    // Cat's eye inner swirl
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * 0.48, 0.4, 2.5);
    ctx.stroke();
    ctx.restore();
  }

  // Player Gundu shooters
  for (const p of snap.players) {
    // Aim dotted laser when ready
    if (!p.isShooting) {
      ctx.save();
      ctx.strokeStyle = `${p.colorHex}BB`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.aimAngle) * 115, p.y + Math.sin(p.aimAngle) * 115);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    drawSphere3D(ctx, p.x, p.y, 18, p.colorHex, '#FFFFFF', 0, true);
    drawNameplate(ctx, p.x, p.y + 30, p.slotIndex, p.name, p.colorHex, `${p.score} PTS`);
  }

  drawHudChip(ctx, 20, 16, `GULI LEFT: ${remainingCount}`, '#10B981', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.timeLeft)}s`, '#FDE047', 'right');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 53. RATTAN VOLLEY (Sepak Takraw / 藤球)
// ============================================================
export function renderRattanVolley(ctx: CanvasRenderingContext2D, snap: RattanVolleySnapshot): void {
  // Tropical sky dusk gradient
  const sky = ctx.createLinearGradient(0, 0, 0, snap.floorY);
  sky.addColorStop(0, '#0B1726');
  sky.addColorStop(0.65, '#133146');
  sky.addColorStop(1, '#1E4A52');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Painted outdoor Sepak Takraw court floor
  const floorGrad = ctx.createLinearGradient(0, snap.floorY, 0, ARENA_HEIGHT);
  floorGrad.addColorStop(0, '#0F766E');
  floorGrad.addColorStop(0.25, '#115E59');
  floorGrad.addColorStop(1, '#083344');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, snap.floorY, ARENA_WIDTH, ARENA_HEIGHT - snap.floorY);

  // Court sideline chalk
  ctx.strokeStyle = '#F8FAFC';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(30, snap.floorY + 2);
  ctx.lineTo(ARENA_WIDTH - 30, snap.floorY + 2);
  ctx.stroke();

  // Center Sepak Takraw Net
  ctx.save();
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(snap.netX - 4, snap.netTopY, 8, snap.floorY - snap.netTopY);
  // Net top white tape
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(snap.netX - 7, snap.netTopY - 4, 14, 12);
  // Subtle mesh lines
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
  for (let ny = snap.netTopY + 14; ny < snap.floorY; ny += 16) {
    ctx.beginPath();
    ctx.moveTo(snap.netX - 6, ny);
    ctx.lineTo(snap.netX + 6, ny);
    ctx.stroke();
  }
  ctx.restore();

  // 3-Touch Counter Dots per side
  for (const side of ['left', 'right'] as const) {
    const touches = side === 'left' ? snap.sideTouchesLeft : snap.sideTouchesRight;
    const baseX = side === 'left' ? snap.netX - 110 : snap.netX + 54;
    for (let i = 0; i < snap.maxTouches; i++) {
      ctx.fillStyle = i < touches ? '#FACC15' : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(baseX + i * 26, snap.floorY + 26, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Players
  for (const p of snap.players) {
    const zH = Math.max(0, snap.floorY - p.y);
    drawShadowOval(ctx, p.x, snap.floorY + 4, 24 * Math.max(0.45, 1 - zH / 320), 8, 0.42);

    // Bicycle kick energy arc
    if (p.kickTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 34, p.bicycleAngle - 1.1, p.bicycleAngle + 1.1);
      ctx.stroke();
      ctx.restore();
    }

    drawCharacterPod3D(ctx, p.x, p.y, 21, p.team === 'left' ? -0.25 : Math.PI + 0.25, p.colorHex, {
      playerId: p.id,
      rimColor: p.kickTimer > 0 ? '#FEF08A' : '#FFFFFF',
    });
    drawNameplate(ctx, p.x, p.y + 32, p.slotIndex, p.name, p.colorHex);
  }

  // Ball trail
  const b = snap.ball;
  for (let i = 0; i < b.trail.length; i++) {
    const pt = b.trail[i];
    const frac = (i + 1) / b.trail.length;
    ctx.fillStyle = `rgba(250, 204, 21, ${(frac * 0.35).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, b.r * frac * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  // Woven Golden Rattan Bola Takraw
  drawShadowOval(ctx, b.x, snap.floorY + 3, b.r * 0.9, 6, 0.35);
  drawSphere3D(ctx, b.x, b.y, b.r, '#EAB308', '#FEF08A', 0, false);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.ellipse(0, 0, b.r * 0.86, b.r * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Scoreboard HUD
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2,
    16,
    `LEFT ${snap.scoreLeft}  —  ${snap.scoreRight} RIGHT  (TO ${snap.targetPoints})`,
    '#14B8A6',
    'center'
  );
  drawBoardBanner(ctx, 'rattan-volley', snap.banner, null, '#14B8A6');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 54. STEP STOMP (Pepsi Cola / One-Two-Jus / 踩脚)
// ============================================================
export function renderStepStomp(ctx: CanvasRenderingContext2D, snap: StepStompSnapshot): void {
  const t = getMotionTime();
  drawStudioBackdrop(ctx, '#12131F', 'rgba(236, 72, 153, 0.14)', 'rgba(255,255,255,0.03)', 48);

  // Schoolyard concrete court
  const courtGrad = ctx.createRadialGradient(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 40, ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 480);
  courtGrad.addColorStop(0, '#27293D');
  courtGrad.addColorStop(1, '#1A1C2C');
  drawArenaSlab(ctx, 56, 54, ARENA_WIDTH - 112, ARENA_HEIGHT - 108, 20, 14, courtGrad, '#0E101A', '#EC4899', 2.5);

  // Chalk center circle
  ctx.save();
  ctx.strokeStyle = 'rgba(244, 114, 182, 0.25)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 150, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Footprints trail
  for (const fp of snap.footprints) {
    ctx.save();
    ctx.translate(fp.x, fp.y);
    ctx.rotate(fp.angle);
    ctx.globalAlpha = clamp01(fp.alpha) * 0.65;
    ctx.fillStyle = fp.colorHex;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Stomp shockwaves
  for (const sw of snap.shockwaves) {
    ctx.save();
    ctx.globalAlpha = clamp01(sw.alpha);
    ctx.strokeStyle = sw.colorHex;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Players
  for (const p of snap.players) {
    if (!p.alive) continue;
    const isAttacker = p.id === snap.activeAttackerId;
    const zLift = p.leapTimer > 0 ? Math.sin(clamp01(p.leapTimer * 3) * Math.PI) * 32 : 0;

    // Shoe stomp hitbox ring around feet
    ctx.save();
    ctx.strokeStyle = isAttacker ? '#FACC15' : 'rgba(255,255,255,0.28)';
    ctx.lineWidth = isAttacker ? 3 : 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, isAttacker ? 34 + Math.sin(t * 10) * 3 : 24, 0, Math.PI * 2);
    ctx.stroke();

    // Attacker aim indicator + step pips
    if (isAttacker && snap.phase === 'stride') {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 95, p.y + Math.sin(p.angle) * 95);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let i = 0; i < p.maxSteps; i++) {
        const px = p.x - ((p.maxSteps - 1) * 14) / 2 + i * 14;
        ctx.fillStyle = i < p.stepsLeft ? '#FACC15' : 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(px, p.y - 44, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    drawCharacterPod3D(ctx, p.x, p.y, 19, p.angle, p.colorHex, {
      playerId: p.id,
      zHeight: zLift,
      rimColor: isAttacker ? '#FDE047' : p.dodgeTimer > 0 ? '#38BDF8' : '#FFFFFF',
      hat: isAttacker ? 'crown' : 'none',
    });

    drawNameplate(
      ctx,
      p.x,
      p.y + 32,
      p.slotIndex,
      p.name,
      p.colorHex,
      isAttacker ? `${p.stepsLeft} STEPS` : `${p.score} PTS`
    );
  }

  drawHudChip(ctx, 20, 16, `RD ${snap.round}/${snap.totalRounds}`, '#EC4899', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.phaseTimer)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'step-stomp', snap.calloutText || null, null, '#EC4899');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 55. PIT HARVEST (Congkak / 冲格)
// ============================================================
export function renderPitHarvest(ctx: CanvasRenderingContext2D, snap: PitHarvestSnapshot): void {
  drawStudioBackdrop(ctx, '#140E0A', 'rgba(217, 119, 6, 0.16)', 'rgba(255, 224, 178, 0.025)', 54);

  const boardW = 920;
  const boardH = 310;
  const bx = (ARENA_WIDTH - boardW) / 2;
  const by = (ARENA_HEIGHT - boardH) / 2 + 12;

  // Carved mahogany Congkak wooden boat board
  const woodGrad = ctx.createLinearGradient(bx, by, bx, by + boardH);
  woodGrad.addColorStop(0, '#7C3E1D');
  woodGrad.addColorStop(0.5, '#622E14');
  woodGrad.addColorStop(1, '#471F0C');
  drawArenaSlab(ctx, bx, by, boardW, boardH, 130, 22, woodGrad, '#2C1105', '#D97706', 3.5);

  // Ornamental gold wood inlay line
  ctx.save();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx + 18, by + 18, boardW - 36, boardH - 36, 114);
  ctx.stroke();
  ctx.restore();

  const p0 = snap.players.find((p) => p.side === 0);
  const p1 = snap.players.find((p) => p.side === 1);

  // Helper for pit coordinates:
  // Side 0 = bottom row: indices 0..6 left -> right
  // Side 1 = top row: indices 7..13 right -> left (so index 7 is rightmost, 13 is leftmost)
  const pitSpacing = 88;
  const firstPitX = ARENA_WIDTH / 2 - 3 * pitSpacing;
  const topRowY = by + 95;
  const botRowY = by + boardH - 95;
  const rumahLeftX = bx + 98; // Side 1's Rumah (top player sows right->left into left rumah)
  const rumahRightX = bx + boardW - 98; // Side 0's Rumah (bottom player sows left->right into right rumah)
  const rumahY = by + boardH / 2;

  const getPitPos = (idx: number): { x: number; y: number } => {
    if (idx === -1) return { x: rumahRightX, y: rumahY };
    if (idx === -2) return { x: rumahLeftX, y: rumahY };
    if (idx >= 0 && idx <= 6) {
      return { x: firstPitX + idx * pitSpacing, y: botRowY };
    }
    const col = 6 - (idx - 7);
    return { x: firstPitX + col * pitSpacing, y: topRowY };
  };

  // Draw small marble cluster inside a recessed pit
  const drawPitMarbles = (px: number, py: number, count: number, maxR: number) => {
    const visible = Math.min(count, 16);
    for (let i = 0; i < visible; i++) {
      const a = i * 2.39996;
      const rad = visible === 1 ? 0 : Math.min(maxR, Math.sqrt(i + 0.5) * 5.6);
      const mx = px + Math.cos(a) * rad;
      const my = py + Math.sin(a) * rad;
      const colors = ['#38BDF8', '#34D399', '#FBBF24', '#F472B6', '#A78BFA'];
      drawSphere3D(ctx, mx, my, 5.2, colors[i % colors.length], undefined, 0, false);
    }
  };

  // Draw Left & Right Rumah Storehouses
  const rumahs: { x: number; side: 0 | 1; count: number; color: string; label: string }[] = [
    { x: rumahLeftX, side: 1, count: snap.rumah[1], color: p1?.colorHex ?? '#38BDF8', label: p1?.name ?? 'TOP' },
    { x: rumahRightX, side: 0, count: snap.rumah[0], color: p0?.colorHex ?? '#F59E0B', label: p0?.name ?? 'BOT' },
  ];
  for (const rm of rumahs) {
    ctx.save();
    const isSowingHere = (rm.side === 0 && snap.sowingPitIndex === -1) || (rm.side === 1 && snap.sowingPitIndex === -2);
    ctx.fillStyle = '#2B1207';
    ctx.beginPath();
    ctx.arc(rm.x, rumahY, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isSowingHere ? '#FEF08A' : rm.color;
    ctx.lineWidth = isSowingHere ? 4.5 : 3;
    ctx.stroke();

    drawPitMarbles(rm.x, rumahY, rm.count, 32);

    // Count pill
    ctx.fillStyle = 'rgba(13, 15, 20, 0.92)';
    ctx.beginPath();
    ctx.roundRect(rm.x - 24, rumahY + 42, 48, 22, 6);
    ctx.fill();
    ctx.strokeStyle = rm.color;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(rm.count), rm.x, rumahY + 53.5);
    ctx.restore();
  }

  // Draw 14 Kampung Pits
  for (let i = 0; i < 14; i++) {
    const pos = getPitPos(i);
    const side: 0 | 1 = i < 7 ? 0 : 1;
    const localIdx = side === 0 ? i : i - 7;
    const burnt = Boolean(snap.burntPits[i]);
    const isCursor =
      snap.activeSide === side &&
      ((side === 0 && p0?.cursorPit === localIdx) || (side === 1 && p1?.cursorPit === localIdx));
    const isSowing = snap.sowingPitIndex === i;

    ctx.save();
    ctx.fillStyle = burnt ? '#1C1414' : '#31160A';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 33, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isSowing
      ? '#FEF08A'
      : isCursor
      ? '#10D98B'
      : burnt
      ? '#EF4444'
      : 'rgba(217, 119, 6, 0.5)';
    ctx.lineWidth = isSowing || isCursor ? 4 : 2;
    ctx.stroke();

    if (burnt) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pos.x - 14, pos.y - 14);
      ctx.lineTo(pos.x + 14, pos.y + 14);
      ctx.moveTo(pos.x + 14, pos.y - 14);
      ctx.lineTo(pos.x - 14, pos.y + 14);
      ctx.stroke();
    } else {
      drawPitMarbles(pos.x, pos.y, snap.pits[i] ?? 0, 18);
    }

    // Crisp count badge above/below pit
    const badgeY = side === 1 ? pos.y - 46 : pos.y + 46;
    ctx.fillStyle = burnt ? 'rgba(127, 29, 29, 0.9)' : 'rgba(13, 15, 20, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pos.x - 16, badgeY - 10, 32, 20, 5);
    ctx.fill();
    ctx.fillStyle = burnt ? '#FCA5A5' : '#F8FAFC';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(burnt ? 'X' : String(snap.pits[i] ?? 0), pos.x, badgeY + 0.5);
    ctx.restore();
  }

  // Floating Sowing Hand indicator
  if (snap.sowingInHand > 0 && snap.sowingPitIndex !== null) {
    const sp = getPitPos(snap.sowingPitIndex);
    ctx.save();
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y - 44, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#18120B';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#18120B';
    ctx.font = '900 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(snap.sowingInHand), sp.x, sp.y - 43.5);
    ctx.restore();
  }

  // Player headers above/below board
  if (p1) {
    drawSeatPill(
      ctx,
      ARENA_WIDTH / 2,
      by - 38,
      p1.name,
      p1.colorHex,
      `RUMAH ${snap.rumah[1]} · TOTAL ${p1.totalScore}`,
      snap.activeSide === 1
    );
  }
  if (p0) {
    drawSeatPill(
      ctx,
      ARENA_WIDTH / 2,
      by + boardH + 42,
      p0.name,
      p0.colorHex,
      `RUMAH ${snap.rumah[0]} · TOTAL ${p0.totalScore}`,
      snap.activeSide === 0
    );
  }

  drawHudChip(ctx, 20, 16, `CONGKAK RD ${snap.round}/${snap.totalRounds}`, '#D97706', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.turnTimeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'pit-harvest', snap.banner, null, '#D97706');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 56. BIG TWO ROYALE (Chor Dai Di / 锄大弟)
// ============================================================
export function renderBigTwoRoyale(ctx: CanvasRenderingContext2D, snap: BigTwoRoyaleSnapshot): void {
  drawCnyOvalTable(ctx, '#7F1D1D', '#450A0A', '#92400E', '#78350F', 'rgba(220, 38, 38, 0.22)');

  // Center table trick display
  if (snap.tableCards.length > 0) {
    const spacing = Math.min(62, 290 / Math.max(1, snap.tableCards.length));
    const startX = TABLE_CENTER_X - ((snap.tableCards.length - 1) * spacing) / 2;
    for (let i = 0; i < snap.tableCards.length; i++) {
      const rot = (i - (snap.tableCards.length - 1) / 2) * 0.05;
      drawStandardPlayingCard(ctx, startX + i * spacing, TABLE_CENTER_Y - 6, 72, 102, snap.tableCards[i], rot, '#F59E0B');
    }
    if (snap.tableComboName) {
      drawHudChip(
        ctx,
        TABLE_CENTER_X,
        TABLE_CENTER_Y + 58,
        `${snap.tableComboName}${snap.trickOwnerName ? ` · ${snap.trickOwnerName}` : ''}`,
        '#F59E0B',
        'center'
      );
    }
  } else {
    ctx.save();
    ctx.fillStyle = 'rgba(254, 243, 199, 0.55)';
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      tCanvas(snap.mustInclude3D ? 'OPEN WITH 3♦!' : 'FREE LEAD — PLAY ANY COMBO'),
      TABLE_CENTER_X,
      TABLE_CENTER_Y
    );
    ctx.restore();
  }

  // Player seats around perimeter
  const n = snap.players.length;
  for (let i = 0; i < n; i++) {
    const p = snap.players[i];
    if (isTablePlayerHidden(p.id)) continue;
    const seat = getCardSeatPosition(i, n);
    const isActive = p.id === snap.activePlayerId;

    // Fanned mini card backs toward table center
    const dx = TABLE_CENTER_X - seat.x;
    const dy = TABLE_CENTER_Y - seat.y;
    const dist = Math.hypot(dx, dy) || 1;
    const fanX = seat.x + (dx / dist) * 58;
    const fanY = seat.y + (dy / dist) * 44;
    const showBacks = Math.min(p.cardCount, 6);
    for (let c = 0; c < showBacks; c++) {
      const off = (c - (showBacks - 1) / 2) * 9;
      drawCnyCardBack(ctx, fanX + off, fanY, 26, 38, (c - (showBacks - 1) / 2) * 0.08, '#991B1B');
    }

    const badge = p.oneCardWarning
      ? { text: '1 CARD!', bg: '#EF4444', fg: '#FFFFFF' }
      : p.passedTrick
      ? { text: 'PASS', bg: '#374151', fg: '#D1D5DB' }
      : undefined;

    drawSeatPill(
      ctx,
      seat.x,
      seat.y,
      p.name,
      p.colorHex,
      `${p.cardCount} CARDS · ${p.score} PTS`,
      isActive,
      false,
      badge
    );
  }

  drawCardFx(ctx, snap.flyingCards, snap.shockwaves);

  drawHudChip(ctx, 20, 16, `RD ${snap.round}/${snap.totalRounds}`, '#DC2626', 'left');
  if (snap.topCardGuardActive) {
    drawHudChip(ctx, ARENA_WIDTH / 2, 16, 'TOP-CARD GUARD ACTIVE!', '#EF4444', 'center');
  }
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.turnTimeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'big-two-royale', snap.banner, null, snap.bannerColor ?? '#F59E0B');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 57. LUCKY 21 (21点 / Ban Luck / 廿一点)
// ============================================================
export function renderLucky21(ctx: CanvasRenderingContext2D, snap: Lucky21Snapshot): void {
  drawCnyOvalTable(ctx, '#991B1B', '#450A0A', '#B45309', '#78350F', 'rgba(245, 158, 11, 0.22)');

  // Center Angpao pot crest
  ctx.save();
  ctx.fillStyle = 'rgba(252, 211, 77, 0.14)';
  ctx.beginPath();
  ctx.arc(TABLE_CENTER_X, TABLE_CENTER_Y, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#FDE68A';
  ctx.font = '900 22px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('21', TABLE_CENTER_X, TABLE_CENTER_Y - 8);
  ctx.font = '800 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#FEF3C7';
  ctx.fillText(tCanvas(snap.phase.toUpperCase()), TABLE_CENTER_X, TABLE_CENTER_Y + 16);
  ctx.restore();

  // Player seats + cards
  const n = snap.players.length;
  for (let i = 0; i < n; i++) {
    const p = snap.players[i];
    const seat = getCardSeatPosition(i, n);
    const isActive = p.id === snap.activePlayerId && snap.phase !== 'settle';

    // Cards drawn toward table center
    const dx = TABLE_CENTER_X - seat.x;
    const dy = TABLE_CENTER_Y - seat.y;
    const dist = Math.hypot(dx, dy) || 1;
    const handX = seat.x + (dx / dist) * 82;
    const handY = seat.y + (dy / dist) * 62;

    if (p.revealed && p.cards.length > 0) {
      const sp = Math.min(34, 125 / Math.max(1, p.cards.length));
      const sx = handX - ((p.cards.length - 1) * sp) / 2;
      for (let c = 0; c < p.cards.length; c++) {
        drawStandardPlayingCard(ctx, sx + c * sp, handY, 44, 64, p.cards[c], 0, p.specialTag ? '#FACC15' : undefined);
      }
    } else if (p.cardCount > 0) {
      const sp = 20;
      const sx = handX - ((p.cardCount - 1) * sp) / 2;
      for (let c = 0; c < p.cardCount; c++) {
        drawCnyCardBack(ctx, sx + c * sp, handY, 38, 54, 0, '#B91C1C');
      }
    }

    // Status or result badge
    let badge: { text: string; bg: string; fg: string } | undefined;
    if (p.specialTag) {
      badge = {
        text: p.specialTag,
        bg: p.specialTag === 'BUST' ? '#DC2626' : '#F59E0B',
        fg: p.specialTag === 'BUST' ? '#FFFFFF' : '#18120B',
      };
    } else if (p.revealed && p.handValue !== null) {
      badge = { text: `${p.handValue} PTS`, bg: '#10B981', fg: '#052E16' };
    } else if (p.status === 'stood') {
      badge = { text: 'STAND', bg: '#334155', fg: '#F8FAFC' };
    } else if (p.status === 'escaped') {
      badge = { text: 'RUN (15)', bg: '#6366F1', fg: '#FFFFFF' };
    }

    const deltaStr = p.lastDelta > 0 ? ` (+${p.lastDelta})` : p.lastDelta < 0 ? ` (${p.lastDelta})` : '';
    if (!isTablePlayerHidden(p.id)) {
      drawSeatPill(
        ctx,
        seat.x,
        seat.y,
        p.name,
        p.colorHex,
        `${p.chips} CHIPS${!p.isBanker && p.bet > 0 ? ` · BET ${p.bet}` : ''}${deltaStr}`,
        isActive,
        p.isBanker,
        badge
      );
    }
  }

  drawCardFx(ctx, snap.flyingCards, snap.shockwaves);

  drawHudChip(ctx, 20, 16, `RD ${snap.round}/${snap.totalRounds}`, '#F59E0B', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.turnTimeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'lucky-21', snap.banner, null, snap.bannerColor ?? '#F59E0B');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 58. TEN-PAIR SHOWDOWN (Ngau / 斗牛)
// ============================================================
export function renderTenPairShowdown(
  ctx: CanvasRenderingContext2D,
  snap: TenPairShowdownSnapshot
): void {
  drawCnyOvalTable(ctx, '#065F46', '#022C22', '#B45309', '#78350F', 'rgba(16, 185, 129, 0.22)');

  // Center Bull Crest
  ctx.save();
  ctx.fillStyle = 'rgba(252, 211, 77, 0.14)';
  ctx.beginPath();
  ctx.arc(TABLE_CENTER_X, TABLE_CENTER_Y, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#FDE68A';
  ctx.font = '900 20px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tCanvas('NGAU'), TABLE_CENTER_X, TABLE_CENTER_Y - 8);
  ctx.font = '800 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#A7F3D0';
  ctx.fillText(tCanvas(snap.phase.toUpperCase()), TABLE_CENTER_X, TABLE_CENTER_Y + 15);
  ctx.restore();

  // Player seats + split 3+2 Ngau cards
  const n = snap.players.length;
  for (let i = 0; i < n; i++) {
    const p = snap.players[i];
    const seat = getCardSeatPosition(i, n);
    const dx = TABLE_CENTER_X - seat.x;
    const dy = TABLE_CENTER_Y - seat.y;
    const dist = Math.hypot(dx, dy) || 1;
    const handX = seat.x + (dx / dist) * 86;
    const handY = seat.y + (dy / dist) * 62;

    if (p.revealed && (p.baseCards.length > 0 || p.pairCards.length > 0)) {
      // Draw 3-card Base on left + gap + 2-card Point Pair on right!
      const baseStartX = handX - 58;
      for (let c = 0; c < p.baseCards.length; c++) {
        drawStandardPlayingCard(ctx, baseStartX + c * 22, handY, 38, 56, p.baseCards[c], 0, '#94A3B8');
      }
      const pairStartX = handX + 26;
      for (let c = 0; c < p.pairCards.length; c++) {
        drawStandardPlayingCard(
          ctx,
          pairStartX + c * 24,
          handY - 4,
          40,
          58,
          p.pairCards[c],
          0,
          p.multiplier >= 2 ? '#FACC15' : '#34D399'
        );
      }
    } else {
      // 5 face-down cards while arranging
      for (let c = 0; c < 5; c++) {
        drawCnyCardBack(ctx, handX - 36 + c * 18, handY, 32, 46, 0, p.lockedIn ? '#059669' : '#991B1B');
      }
    }

    let badge: { text: string; bg: string; fg: string } | undefined;
    if (p.revealed && p.rankLabel) {
      badge = {
        text: p.rankLabel,
        bg: p.multiplier >= 2 ? '#F59E0B' : p.rankLabel === 'NO NGAU' ? '#475569' : '#10B981',
        fg: p.multiplier >= 2 ? '#18120B' : '#FFFFFF',
      };
    } else if (p.lockedIn) {
      badge = { text: 'READY', bg: '#10B981', fg: '#052E16' };
    }

    const deltaStr = p.lastDelta > 0 ? ` (+${p.lastDelta})` : p.lastDelta < 0 ? ` (${p.lastDelta})` : '';
    if (!isTablePlayerHidden(p.id)) {
      drawSeatPill(
        ctx,
        seat.x,
        seat.y,
        p.name,
        p.colorHex,
        `${p.chips} CHIPS${deltaStr}`,
        snap.phase === 'arrange' && !p.lockedIn,
        p.isBanker,
        badge
      );
    }
  }

  drawCardFx(ctx, snap.flyingCards, snap.shockwaves);

  drawHudChip(ctx, 20, 16, `RD ${snap.round}/${snap.totalRounds}`, '#10B981', 'left');
  if (snap.wild36Enabled) {
    drawHudChip(ctx, ARENA_WIDTH / 2, 16, '3 ↔ 6 WILD ON', '#F59E0B', 'center');
  }
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.turnTimeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'ten-pair-showdown', snap.banner, null, snap.bannerColor ?? '#10B981');
  drawPopupTexts(ctx, snap.popups);
}

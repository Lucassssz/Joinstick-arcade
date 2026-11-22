import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../shared/cardLayout';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BoomKittensSnapshot,
  type CardShockwave,
  type DarkFlipClashSnapshot,
  type FlipSevenSnapshot,
  type FlyingCardAnim,
  type PropertyDealSnapshot,
  type RoyalBluffSnapshot,
  type SushiDraftSnapshot,
} from '../shared/types';
import { drawBoardBanner, drawHudChip, drawPopupTexts, tCanvas } from './canvasHelpers';
import { drawStudioBackdrop, shadeHex } from './render25d';
import { clamp01, easeOutCubic, getMotionTime } from './arcadeMotion';

// ============================================================
// SHARED 2.5D TABLETOP HELPERS FOR MODULAR CARD GAMES
// ============================================================
function drawOvalCardTable(
  ctx: CanvasRenderingContext2D,
  feltCenter: string,
  feltEdge: string,
  rimOuter: string,
  rimInner: string,
  accentGlow: string
) {
  drawStudioBackdrop(ctx, '#080B12', accentGlow, 'rgba(255,255,255,0.025)', 52);

  // Outer drop shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.beginPath();
  ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y + 18, 496, 266, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mahogany / Obsidian Rim
  const rimGrad = ctx.createLinearGradient(0, TABLE_CENTER_Y - 260, 0, TABLE_CENTER_Y + 260);
  rimGrad.addColorStop(0, rimOuter);
  rimGrad.addColorStop(0.5, rimInner);
  rimGrad.addColorStop(1, shadeHex(rimOuter, -0.35));
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y, 488, 256, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Inner Felt Surface
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

  // Inner ornamental rail line
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y, 424, 198, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawCardFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accentHex: string,
  title: string,
  subtitle?: string,
  badge?: string,
  rot = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 4, -h / 2 + 7, w, h, 12);
  ctx.fill();

  // Card body
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  g.addColorStop(0, shadeHex(accentHex, 0.14));
  g.addColorStop(1, shadeHex(accentHex, -0.32));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 12);
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Inner inset frame
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 8);
  ctx.stroke();

  if (badge) {
    const bTxt = tCanvas(badge);
    ctx.fillStyle = 'rgba(10,14,22,0.72)';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 9, -h / 2 + 9, Math.min(w - 18, Math.max(52, ctx.measureText(bTxt).width + 14)), 18, 5);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(bTxt, -w / 2 + 14, -h / 2 + 18);
  }

  const titleTxt = tCanvas(title);
  const subTxt = subtitle ? tCanvas(subtitle) : undefined;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font =
    titleTxt.length <= 3
      ? '900 34px "Bricolage Grotesque", sans-serif'
      : titleTxt.length <= 8
        ? '900 18px "Bricolage Grotesque", sans-serif'
        : '900 14px "Plus Jakarta Sans", sans-serif';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.strokeText(titleTxt, 0, subTxt ? -6 : 2);
  ctx.fillText(titleTxt, 0, subTxt ? -6 : 2);

  if (subTxt) {
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(subTxt, 0, h / 2 - 20);
  }

  ctx.restore();
}

function drawCardDeckStack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  accentHex: string,
  label: string
) {
  ctx.save();
  const layers = Math.min(5, Math.max(1, Math.ceil(count / 8)));
  for (let i = layers; i >= 0; i--) {
    const oy = -i * 3;
    ctx.fillStyle = i === 0 ? '#111827' : shadeHex('#1E293B', -i * 0.08);
    ctx.beginPath();
    ctx.roundRect(x - 42, y - 58 + oy, 84, 116, 11);
    ctx.fill();
    ctx.strokeStyle = i === 0 ? accentHex : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = i === 0 ? 2.4 : 1.2;
    ctx.stroke();
  }
  ctx.fillStyle = accentHex;
  ctx.font = '900 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tCanvas(label), x, y - 14);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 22px "Bricolage Grotesque", sans-serif';
  ctx.fillText(`${count}`, x, y + 14);
  ctx.restore();
}

function drawShockwaves(ctx: CanvasRenderingContext2D, waves: CardShockwave[]) {
  if (!waves.length) return;
  ctx.save();
  for (const sw of waves) {
    ctx.globalAlpha = Math.max(0, Math.min(1, sw.alpha));
    ctx.strokeStyle = sw.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFlyingCards(ctx: CanvasRenderingContext2D, flying: FlyingCardAnim[]) {
  if (!flying.length) return;
  for (const fc of flying) {
    if (fc.progress < 0) continue;
    const t = easeOutCubic(clamp01(fc.progress));
    const x = fc.fromX + (fc.toX - fc.fromX) * t;
    const y = fc.fromY + (fc.toY - fc.fromY) * t - Math.sin(t * Math.PI) * 56;
    const rot = fc.rotStart + (fc.rotEnd - fc.rotStart) * t;
    const scale = 0.78 + Math.sin(t * Math.PI) * 0.25;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    drawCardFace(
      ctx,
      0,
      0,
      58,
      82,
      fc.faceUp ? fc.colorHex ?? '#FFB800' : '#1E293B',
      fc.faceUp ? fc.rankText ?? '★' : 'JS',
      undefined,
      undefined,
      rot
    );
    ctx.restore();
  }
}

function drawSeatShell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colorHex: string,
  name: string,
  slotIndex: number,
  isActive: boolean,
  turnFrac: number,
  subText: string,
  lastAction?: string | null,
  dimmed = false
) {
  ctx.save();
  if (dimmed) ctx.globalAlpha = 0.52;

  if (isActive) {
    const pulse = 0.65 + 0.35 * Math.sin(getMotionTime() * 6);
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 18 * pulse;
  }

  ctx.fillStyle = isActive ? 'rgba(17, 24, 39, 0.96)' : 'rgba(13, 17, 26, 0.88)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 14);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = isActive ? colorHex : 'rgba(255,255,255,0.16)';
  ctx.lineWidth = isActive ? 2.8 : 1.4;
  ctx.stroke();

  // Active shot-clock bar along top edge
  if (isActive && turnFrac > 0) {
    ctx.fillStyle = turnFrac <= 0.33 ? '#EF4444' : colorHex;
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + 8, y - h / 2 + 4, (w - 16) * clamp01(turnFrac), 4, 2);
    ctx.fill();
  }

  // Player dot + name
  ctx.fillStyle = colorHex;
  ctx.beginPath();
  ctx.arc(x - w / 2 + 18, y - h / 2 + 22, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`P${slotIndex + 1} ${name.slice(0, 10)}`, x - w / 2 + 30, y - h / 2 + 22);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(tCanvas(subText), x + w / 2 - 12, y - h / 2 + 22);

  if (lastAction) {
    ctx.fillStyle = colorHex;
    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(lastAction), x, y + h / 2 - 12);
  }
  ctx.restore();
}

// ============================================================
// 43. BOOM KITTENS
// ============================================================
export function renderBoomKittens(ctx: CanvasRenderingContext2D, snap: BoomKittensSnapshot): void {
  drawOvalCardTable(ctx, '#2C1116', '#14080C', '#5C1E26', '#2A0D12', 'rgba(255, 77, 46, 0.2)');

  const riskPct = snap.deckCount > 0 ? Math.round((snap.bombsInDeck / snap.deckCount) * 100) : 0;
  drawHudChip(ctx, 24, 18, `BOOM DECK: ${snap.deckCount}`, '#FF4D2E', 'left');
  drawHudChip(ctx, ARENA_WIDTH / 2, 18, `BOMBS HIDDEN: ${snap.bombsInDeck} · RISK ${riskPct}%`, riskPct >= 35 ? '#EF4444' : '#FFB800', 'center');
  drawHudChip(ctx, ARENA_WIDTH - 24, 18, `DRAWS OWED: x${snap.drawsOwed}`, '#00C2FF', 'right');

  // Center Danger Pulse Ring
  const pulse = 0.5 + 0.5 * Math.sin(getMotionTime() * 5);
  ctx.save();
  ctx.strokeStyle = riskPct >= 35 ? `rgba(239, 68, 68, ${0.35 + pulse * 0.45})` : 'rgba(255, 184, 0, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(TABLE_CENTER_X - 88, TABLE_CENTER_Y, 76 + pulse * 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawCardDeckStack(ctx, TABLE_CENTER_X - 88, TABLE_CENTER_Y, snap.deckCount, '#FF4D2E', 'BOOM DECK');

  if (snap.topDiscard) {
    drawCardFace(
      ctx,
      TABLE_CENTER_X + 82,
      TABLE_CENTER_Y,
      98,
      134,
      snap.topDiscard.accentHex,
      snap.topDiscard.label,
      'LAST ACTION',
      snap.topDiscard.badge,
      0.06
    );
  } else {
    drawCardFace(ctx, TABLE_CENTER_X + 82, TABLE_CENTER_Y, 98, 134, '#F59E0B', 'ACTION', 'DISCARD PILE', 'SAFE', 0.04);
  }

  // Player Seats
  const turnFrac = snap.turnTotal > 0 ? snap.turnTimeLeft / snap.turnTotal : 0;
  snap.players.forEach((p, idx) => {
    const seat = getCardSeatPosition(idx, snap.players.length);
    const isAct = p.id === snap.activePlayerId && p.alive;
    drawSeatShell(
      ctx,
      seat.x,
      seat.y,
      204,
      86,
      p.colorHex,
      p.name,
      p.slotIndex,
      isAct,
      turnFrac,
      p.alive ? `${p.cardCount} CARDS` : 'BOOM!',
      p.lastAction,
      !p.alive
    );
    // Mini hand fan + Defuse shield pips
    ctx.save();
    if (!p.alive) {
      ctx.fillStyle = '#EF4444';
      ctx.font = '900 18px "Bricolage Grotesque", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tCanvas('EXPLODED!'), seat.x, seat.y + 8);
    } else {
      const fanCount = Math.min(7, p.cardCount);
      for (let i = 0; i < fanCount; i++) {
        const cx = seat.x - 42 + i * 11;
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.roundRect(cx, seat.y - 6, 16, 24, 3);
        ctx.fill();
        ctx.strokeStyle = p.colorHex;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.fillStyle = p.defuseCount > 0 ? '#10D98B' : '#64748B';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(tCanvas(`DEFUSE x${p.defuseCount}`), seat.x + 88, seat.y + 8);
    }
    ctx.restore();
  });

  drawShockwaves(ctx, snap.shockwaves);
  drawFlyingCards(ctx, snap.flyingCards);
  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, 'boom-kittens', snap.banner, null, snap.bannerColor ?? '#FF4D2E');
}

// ============================================================
// 44. PROPERTY DEAL (Monopoly Deal-Style)
// ============================================================
const PROP_COLOR_HEX: Record<'red' | 'blue' | 'gold' | 'green', string> = {
  red: '#FF4D2E',
  blue: '#00C2FF',
  gold: '#FFB800',
  green: '#10D98B',
};

export function renderPropertyDeal(ctx: CanvasRenderingContext2D, snap: PropertyDealSnapshot): void {
  drawOvalCardTable(ctx, '#0E3526', '#061B13', '#7C5821', '#3B280D', 'rgba(16, 217, 139, 0.18)');

  drawHudChip(ctx, 24, 18, `ROUND ${snap.round}/${snap.maxRounds}`, '#FFB800', 'left');
  drawHudChip(ctx, ARENA_WIDTH / 2, 18, `GOAL: ${snap.targetSets} FULL SETS · PLAYS LEFT: ${snap.playsLeft}`, '#10D98B', 'center');
  drawHudChip(ctx, ARENA_WIDTH - 24, 18, `DECK: ${snap.deckCount}`, '#00C2FF', 'right');

  drawCardDeckStack(ctx, TABLE_CENTER_X - 92, TABLE_CENTER_Y, snap.deckCount, '#10D98B', 'DEEDS');

  if (snap.lastPlayedCard) {
    drawCardFace(
      ctx,
      TABLE_CENTER_X + 82,
      TABLE_CENTER_Y,
      110,
      142,
      snap.lastPlayedCard.accentHex,
      snap.lastPlayedCard.title,
      snap.lastPlayedCard.subtitle,
      snap.lastPlayedCard.badge,
      0.04
    );
  } else {
    drawCardFace(ctx, TABLE_CENTER_X + 82, TABLE_CENTER_Y, 110, 142, '#10D98B', 'PROPERTY', 'PLAY UP TO 3/TURN', 'DEAL', 0);
  }

  const turnFrac = snap.turnTotal > 0 ? snap.turnTimeLeft / snap.turnTotal : 0;
  snap.players.forEach((p, idx) => {
    const seat = getCardSeatPosition(idx, snap.players.length);
    const isAct = p.id === snap.activePlayerId;
    drawSeatShell(
      ctx,
      seat.x,
      seat.y,
      224,
      98,
      p.colorHex,
      p.name,
      p.slotIndex,
      isAct,
      turnFrac,
      `$${p.bankCash}M · ${p.setsCompleted}/${snap.targetSets} SETS`,
      p.lastAction
    );

    // Draw miniature color-coded Property Deed stacks on the player's mat
    ctx.save();
    const props = p.properties;
    if (props.length === 0) {
      ctx.fillStyle = '#64748B';
      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tCanvas('No deeds placed yet'), seat.x, seat.y + 6);
    } else {
      const startX = seat.x - ((props.length - 1) * 44) / 2;
      props.forEach((pr, pi) => {
        const px = startX + pi * 44;
        const py = seat.y + 6;
        const col = PROP_COLOR_HEX[pr.color];
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(px - 16, py - 15, 32, 30, 6);
        ctx.fill();
        ctx.strokeStyle = pr.complete ? '#FFFFFF' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = pr.complete ? 2.4 : 1.2;
        ctx.stroke();

        ctx.fillStyle = '#0A0D14';
        ctx.font = '900 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pr.complete ? `★${pr.count}` : `${pr.count}/2`, px, py + 1);
      });
    }
    ctx.restore();
  });

  drawShockwaves(ctx, snap.shockwaves);
  drawFlyingCards(ctx, snap.flyingCards);
  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, 'property-deal', snap.banner, null, snap.bannerColor ?? '#10D98B');
}

// ============================================================
// 45. FLIP SEVEN (Push-Your-Luck Unique Numbers)
// ============================================================
export function renderFlipSeven(ctx: CanvasRenderingContext2D, snap: FlipSevenSnapshot): void {
  drawOvalCardTable(ctx, '#13274A', '#081226', '#694F1D', '#2D200A', 'rgba(255, 184, 0, 0.18)');

  drawHudChip(ctx, 24, 18, `ROUND ${snap.round}/${snap.totalRounds}`, '#00C2FF', 'left');
  drawHudChip(ctx, ARENA_WIDTH / 2, 18, `FLIP 7 UNIQUE = +35 JACKPOT · GOAL ${snap.targetScore} PTS`, '#FFB800', 'center');
  drawHudChip(ctx, ARENA_WIDTH - 24, 18, `DECK: ${snap.deckCount}`, '#10D98B', 'right');

  drawCardDeckStack(ctx, TABLE_CENTER_X - 88, TABLE_CENTER_Y, snap.deckCount, '#FFB800', 'FLIP 7');

  if (snap.lastFlipped) {
    drawCardFace(
      ctx,
      TABLE_CENTER_X + 82,
      TABLE_CENTER_Y,
      102,
      138,
      snap.lastFlipped.accentHex,
      snap.lastFlipped.label,
      snap.lastFlipped.subtitle,
      'FLIPPED',
      0.05
    );
  } else {
    drawCardFace(ctx, TABLE_CENTER_X + 82, TABLE_CENTER_Y, 102, 138, '#00C2FF', '7', 'NO DUPLICATES!', 'GOAL', 0);
  }

  const turnFrac = snap.turnTotal > 0 ? snap.turnTimeLeft / snap.turnTotal : 0;
  snap.players.forEach((p, idx) => {
    const seat = getCardSeatPosition(idx, snap.players.length);
    const isAct = p.id === snap.activePlayerId && p.status === 'active';
    const badgeStr = `${p.totalScore} PTS (+${p.roundPoints})`;
    drawSeatShell(
      ctx,
      seat.x,
      seat.y,
      236,
      102,
      p.colorHex,
      p.name,
      p.slotIndex,
      isAct,
      turnFrac,
      badgeStr,
      p.lastAction ?? (p.status === 'stayed' ? 'STAYED' : p.status === 'busted' ? 'BUSTED!' : null),
      p.status === 'busted'
    );

    // Draw player's live unique number cards face-up!
    ctx.save();
    const nums = p.numberCards;
    const step = Math.min(28, nums.length > 0 ? 180 / Math.max(nums.length, 1) : 28);
    const startX = seat.x - ((nums.length - 1) * step) / 2;
    nums.forEach((n, ni) => {
      const cx = startX + ni * step;
      const cy = seat.y + 6;
      ctx.fillStyle = n >= 9 ? '#F59E0B' : n >= 5 ? '#00C2FF' : '#10D98B';
      ctx.beginPath();
      ctx.roundRect(cx - 12, cy - 16, 24, 32, 5);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#090D16';
      ctx.font = '900 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), cx, cy + 1);
    });

    if (p.hasSecondChance || p.hasMultiplier) {
      ctx.fillStyle = p.hasMultiplier ? '#C084FC' : '#10D98B';
      ctx.font = '900 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      const tags = [p.hasSecondChance ? tCanvas('SHIELD') : '', p.hasMultiplier ? 'x2' : ''].filter(Boolean).join(' ');
      ctx.fillText(tags, seat.x + 106, seat.y + 34);
    }
    ctx.restore();
  });

  drawShockwaves(ctx, snap.shockwaves);
  drawFlyingCards(ctx, snap.flyingCards);
  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, 'flip-seven', snap.banner, null, snap.bannerColor ?? '#FFB800');
}

// ============================================================
// 46. ROYAL BLUFF (Coup-Style Court Intrigue)
// ============================================================
export function renderRoyalBluff(ctx: CanvasRenderingContext2D, snap: RoyalBluffSnapshot): void {
  drawOvalCardTable(ctx, '#311334', '#16081A', '#855E1E', '#3A2508', 'rgba(168, 85, 247, 0.22)');

  drawHudChip(ctx, 24, 18, `COURT ROUND ${snap.round}`, '#A855F7', 'left');
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2,
    18,
    snap.phase === 'challenge' ? 'CHALLENGE WINDOW OPEN!' : 'ROYAL COURT IN SESSION',
    snap.phase === 'challenge' ? '#EF4444' : '#FFB800',
    'center'
  );
  drawHudChip(ctx, ARENA_WIDTH - 24, 18, `ALIVE: ${snap.players.filter((p) => p.alive).length}`, '#10D98B', 'right');

  // Center Royal Seal or Active Bluff Claim Showcase
  ctx.save();
  if (snap.pendingClaim) {
    const pulse = 0.5 + 0.5 * Math.sin(getMotionTime() * 8);
    ctx.fillStyle = 'rgba(15, 10, 26, 0.94)';
    ctx.beginPath();
    ctx.roundRect(TABLE_CENTER_X - 185, TABLE_CENTER_Y - 68, 370, 136, 18);
    ctx.fill();
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.65 + pulse * 0.35})`;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.fillStyle = '#FFB800';
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(`${snap.pendingClaim.actorName.toUpperCase()} CLAIMS`), TABLE_CENTER_X, TABLE_CENTER_Y - 38);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 30px "Bricolage Grotesque", sans-serif';
    ctx.fillText(tCanvas(snap.pendingClaim.claimedRole), TABLE_CENTER_X, TABLE_CENTER_Y - 2);

    ctx.fillStyle = '#F87171';
    ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      `${tCanvas(snap.pendingClaim.actionName)}${snap.pendingClaim.targetName ? ` -> ${snap.pendingClaim.targetName}` : ''} · ${Math.ceil(snap.turnTimeLeft)}s`,
      TABLE_CENTER_X,
      TABLE_CENTER_Y + 34
    );
  } else {
    ctx.strokeStyle = 'rgba(255, 184, 0, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(TABLE_CENTER_X, TABLE_CENTER_Y, 72, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#FFB800';
    ctx.font = '900 22px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tCanvas('ROYAL'), TABLE_CENTER_X, TABLE_CENTER_Y - 12);
    ctx.fillStyle = '#E9D5FF';
    ctx.font = '800 14px "JetBrains Mono", monospace';
    ctx.fillText(tCanvas('BLUFF COURT'), TABLE_CENTER_X, TABLE_CENTER_Y + 14);
  }
  ctx.restore();

  const turnFrac = snap.turnTotal > 0 ? snap.turnTimeLeft / snap.turnTotal : 0;
  snap.players.forEach((p, idx) => {
    const seat = getCardSeatPosition(idx, snap.players.length);
    const isAct = p.id === snap.activePlayerId && p.alive;
    drawSeatShell(
      ctx,
      seat.x,
      seat.y,
      216,
      94,
      p.colorHex,
      p.name,
      p.slotIndex,
      isAct,
      turnFrac,
      `${p.coins} COINS`,
      p.lastAction,
      !p.alive
    );

    // Influence cards (hidden royal seals vs fallen revealed roles)
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const cx = seat.x - 42 + i * 84;
      const cy = seat.y + 8;
      if (i < p.influenceLeft) {
        ctx.fillStyle = '#4C1D95';
        ctx.beginPath();
        ctx.roundRect(cx - 32, cy - 16, 64, 30, 6);
        ctx.fill();
        ctx.strokeStyle = '#FFB800';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = '#FEF3C7';
        ctx.font = '800 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tCanvas('SECRET'), cx, cy);
      } else {
        const rev = tCanvas(p.revealedRoles[i - p.influenceLeft] ?? 'EXILED');
        ctx.fillStyle = 'rgba(127, 29, 29, 0.72)';
        ctx.beginPath();
        ctx.roundRect(cx - 32, cy - 16, 64, 30, 6);
        ctx.fill();
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = '#FCA5A5';
        ctx.font = '800 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rev.slice(0, 8), cx, cy);
      }
    }
    ctx.restore();
  });

  drawShockwaves(ctx, snap.shockwaves);
  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, 'royal-bluff', snap.banner, null, snap.bannerColor ?? '#A855F7');
}

// ============================================================
// 47. DARK FLIP CLASH (UNO Flip!-Style Dual-Sided Table)
// ============================================================
const DF_LIGHT_HEX: Record<string, string> = {
  red: '#FF4D2E',
  blue: '#00C2FF',
  gold: '#FFB800',
  green: '#10D98B',
  wild: '#A855F7',
};
const DF_DARK_HEX: Record<string, string> = {
  red: '#EC4899',
  blue: '#22D3EE',
  gold: '#F97316',
  green: '#A855F7',
  wild: '#C084FC',
};

export function renderDarkFlipClash(ctx: CanvasRenderingContext2D, snap: DarkFlipClashSnapshot): void {
  const isDark = snap.side === 'dark';
  const palette = isDark ? DF_DARK_HEX : DF_LIGHT_HEX;
  const activeHex = palette[snap.activeColor] ?? '#A855F7';

  drawOvalCardTable(
    ctx,
    isDark ? '#210D38' : '#113A44',
    isDark ? '#0D0518' : '#081C24',
    isDark ? '#6D28D9' : '#334155',
    isDark ? '#2E1065' : '#0F172A',
    isDark ? 'rgba(168, 85, 247, 0.28)' : 'rgba(0, 194, 255, 0.18)'
  );

  drawHudChip(
    ctx,
    24,
    18,
    isDark ? 'DARK SIDE ACTIVE (+5 / SKIP ALL)' : 'LIGHT SIDE ACTIVE',
    isDark ? '#EC4899' : '#FFB800',
    'left'
  );
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2,
    18,
    snap.drawPenalty > 0 ? `PENALTY STACK: +${snap.drawPenalty}` : `ACTIVE COLOR: ${snap.activeColor.toUpperCase()}`,
    snap.drawPenalty > 0 ? '#EF4444' : activeHex,
    'center'
  );
  drawHudChip(ctx, ARENA_WIDTH - 24, 18, `DIR: ${snap.direction === 1 ? 'CW' : 'CCW'}`, '#00C2FF', 'right');

  // Glowing Active Color Halo around center
  ctx.save();
  ctx.strokeStyle = activeHex;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(TABLE_CENTER_X + 74, TABLE_CENTER_Y, 84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawCardDeckStack(ctx, TABLE_CENTER_X - 96, TABLE_CENTER_Y, snap.deckCount, isDark ? '#EC4899' : '#00C2FF', isDark ? 'DARK' : 'LIGHT');

  drawCardFace(
    ctx,
    TABLE_CENTER_X + 74,
    TABLE_CENTER_Y,
    108,
    146,
    palette[snap.topCard.color] ?? activeHex,
    snap.topCard.value,
    isDark ? 'DARK SIDE' : 'LIGHT SIDE',
    snap.activeColor.toUpperCase(),
    0.05
  );

  const turnFrac = snap.turnTotal > 0 ? snap.turnTimeLeft / snap.turnTotal : 0;
  snap.players.forEach((p, idx) => {
    const seat = getCardSeatPosition(idx, snap.players.length);
    const isAct = p.id === snap.activePlayerId;
    drawSeatShell(
      ctx,
      seat.x,
      seat.y,
      204,
      86,
      p.colorHex,
      p.name,
      p.slotIndex,
      isAct,
      turnFrac,
      `${p.cardCount} CARDS`,
      p.lastAction
    );

    ctx.save();
    const show = Math.min(8, p.cardCount);
    for (let i = 0; i < show; i++) {
      const cx = seat.x - ((show - 1) * 14) / 2 + i * 14;
      ctx.fillStyle = isDark ? '#3B0764' : '#0F172A';
      ctx.beginPath();
      ctx.roundRect(cx - 8, seat.y - 6, 16, 24, 3);
      ctx.fill();
      ctx.strokeStyle = isDark ? '#EC4899' : '#38BDF8';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    ctx.restore();
  });

  drawShockwaves(ctx, snap.shockwaves);
  drawFlyingCards(ctx, snap.flyingCards);
  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, 'dark-flip-clash', snap.banner, null, snap.bannerColor ?? activeHex);
}

// ============================================================
// 48. SUSHI DRAFT (Sushi Go!-Style Conveyor Drafting)
// ============================================================
export function renderSushiDraft(ctx: CanvasRenderingContext2D, snap: SushiDraftSnapshot): void {
  drawOvalCardTable(ctx, '#29201B', '#140E0C', '#8A4F2C', '#4A2512', 'rgba(255, 122, 89, 0.2)');

  drawHudChip(ctx, 24, 18, `ROUND ${snap.round}/${snap.totalRounds}`, '#FFB800', 'left');
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2,
    18,
    `PICK ${snap.pickStep}/${snap.totalPickSteps} · ${snap.phase === 'picking' ? `${Math.ceil(snap.turnTimeLeft)}s TO DRAFT` : 'REVEALING PLATES!'}`,
    '#FF7A59',
    'center'
  );
  drawHudChip(ctx, ARENA_WIDTH - 24, 18, 'PICK 1 & PASS', '#10D98B', 'right');

  // Animated Sushi Conveyor Belt Track in center!
  const t = getMotionTime();
  ctx.save();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 44;
  ctx.beginPath();
  ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y, 175, 76, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 12]);
  ctx.lineDashOffset = -t * 36;
  ctx.beginPath();
  ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y, 175, 76, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Moving colorful sushi plates on the belt
  const beltColors = ['#FB923C', '#10D98B', '#F472B6', '#A855F7', '#FACC15', '#00C2FF'];
  for (let i = 0; i < 6; i++) {
    const ang = t * 0.55 + (i * Math.PI * 2) / 6;
    const px = TABLE_CENTER_X + Math.cos(ang) * 175;
    const py = TABLE_CENTER_Y + Math.sin(ang) * 76;
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(px, py, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = beltColors[i % beltColors.length];
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = beltColors[i % beltColors.length];
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#FFF7ED';
  ctx.font = '900 20px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tCanvas('SUSHI BAR'), TABLE_CENTER_X, TABLE_CENTER_Y - 6);
  ctx.fillStyle = '#FDBA74';
  ctx.font = '800 11px "JetBrains Mono", monospace';
  ctx.fillText(tCanvas(`STEP ${snap.pickStep}/${snap.totalPickSteps}`), TABLE_CENTER_X, TABLE_CENTER_Y + 14);
  ctx.restore();

  const turnFrac = snap.turnTotal > 0 ? snap.turnTimeLeft / snap.turnTotal : 0;
  snap.players.forEach((p, idx) => {
    const seat = getCardSeatPosition(idx, snap.players.length);
    const needsPick = snap.phase === 'picking' && !p.pickedThisStep;
    drawSeatShell(
      ctx,
      seat.x,
      seat.y,
      244,
      102,
      p.colorHex,
      p.name,
      p.slotIndex,
      needsPick,
      turnFrac,
      `${p.totalScore} (+${p.roundScore})`,
      p.pickedThisStep ? 'LOCKED!' : p.lastAction
    );

    // Draw player's drafted sushi cards on their mat
    ctx.save();
    const cards = p.plateCards.slice(-6);
    if (cards.length === 0) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tCanvas(p.pickedThisStep ? 'Dish chosen!' : 'Picking sushi...'), seat.x, seat.y + 6);
    } else {
      const step = Math.min(34, 200 / Math.max(cards.length, 1));
      const startX = seat.x - ((cards.length - 1) * step) / 2;
      cards.forEach((c, ci) => {
        const cx = startX + ci * step;
        const cy = seat.y + 6;
        ctx.fillStyle = c.accentHex;
        ctx.beginPath();
        ctx.roundRect(cx - 14, cy - 16, 28, 32, 6);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = '#0A0D14';
        ctx.font = '900 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tCanvas(c.badge).slice(0, 4), cx, cy + 1);
      });
    }
    ctx.restore();
  });

  drawShockwaves(ctx, snap.shockwaves);
  drawFlyingCards(ctx, snap.flyingCards);
  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, 'sushi-draft', snap.banner, null, snap.bannerColor ?? '#FF7A59');
}

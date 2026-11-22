import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../shared/cardLayout';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type CardShockwave,
  type FlyingCardAnim,
  type IdiomChainSnapshot,
  type LandlordCardView,
  type LandlordClashSnapshot,
  type LiarsDiceTavernSnapshot,
  type MahjongTileView,
  type MidnightWerewolfSnapshot,
  type SpeedMahjongSnapshot,
  type UndercoverWordSnapshot,
} from '../shared/types';
import { drawBoardBanner, drawHudChip, drawPopupTexts, tCanvas } from './canvasHelpers';
import { drawStudioBackdrop, shadeHex } from './render25d';
import { clamp01, easeOutCubic } from './arcadeMotion';

const DICE_FACE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function drawTableOval(
  ctx: CanvasRenderingContext2D,
  feltCenter: string,
  feltEdge: string,
  rimOuter: string,
  rimInner: string,
  accentGlow: string
) {
  drawStudioBackdrop(ctx, '#0C0A12', accentGlow, 'rgba(255,255,255,0.025)', 54);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y + 16, 494, 266, 0, 0, Math.PI * 2);
  ctx.fill();

  const rimGrad = ctx.createLinearGradient(0, TABLE_CENTER_Y - 256, 0, TABLE_CENTER_Y + 256);
  rimGrad.addColorStop(0, rimOuter);
  rimGrad.addColorStop(0.5, rimInner);
  rimGrad.addColorStop(1, shadeHex(rimOuter, -0.35));
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y, 486, 254, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.38)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const feltGrad = ctx.createRadialGradient(TABLE_CENTER_X, TABLE_CENTER_Y - 24, 30, TABLE_CENTER_X, TABLE_CENTER_Y, 455);
  feltGrad.addColorStop(0, feltCenter);
  feltGrad.addColorStop(1, feltEdge);
  ctx.fillStyle = feltGrad;
  ctx.beginPath();
  ctx.ellipse(TABLE_CENTER_X, TABLE_CENTER_Y, 450, 222, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFx(ctx: CanvasRenderingContext2D, flying: FlyingCardAnim[], waves: CardShockwave[]) {
  for (const sw of waves) {
    ctx.save();
    ctx.globalAlpha = clamp01(sw.alpha) * 0.72;
    ctx.strokeStyle = sw.colorHex;
    ctx.lineWidth = 4.5 * clamp01(sw.alpha) + 1.5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  for (const fc of flying) {
    const p = clamp01(fc.progress);
    const e = easeOutCubic(p);
    const x = fc.fromX + (fc.toX - fc.fromX) * e;
    const y = fc.fromY + (fc.toY - fc.fromY) * e - Math.sin(p * Math.PI) * 32;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = fc.colorHex ?? '#FACC15';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-22, -32, 44, 64, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = '900 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fc.rankText ?? '★', 0, 0);
    ctx.restore();
  }
}

function drawSeatBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  colorHex: string,
  sub: string,
  active: boolean,
  badge?: { text: string; bg: string; fg: string }
) {
  ctx.save();
  const w = 162;
  const h = 48;
  ctx.fillStyle = active ? 'rgba(30, 24, 16, 0.96)' : 'rgba(13, 15, 22, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 11);
  ctx.fill();
  ctx.strokeStyle = active ? '#FACC15' : colorHex;
  ctx.lineWidth = active ? 3 : 1.8;
  ctx.stroke();

  ctx.fillStyle = colorHex;
  ctx.beginPath();
  ctx.arc(x - w / 2 + 13, y - 7, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 12), x - w / 2 + 24, y - 7);
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillText(tCanvas(sub), x - w / 2 + 12, y + 12);

  if (badge) {
    ctx.font = '900 10px "JetBrains Mono", monospace';
    const bw = Math.max(58, ctx.measureText(tCanvas(badge.text)).width + 14);
    ctx.fillStyle = badge.bg;
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, y + h / 2 + 4, bw, 19, 6);
    ctx.fill();
    ctx.fillStyle = badge.fg;
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(badge.text), x, y + h / 2 + 14);
  }
  ctx.restore();
}

function drawLandlordCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: LandlordCardView) {
  const symMap = { spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦', joker: '★' };
  const isRed = c.suit === 'hearts' || c.suit === 'diamonds' || c.jokerKind === 'big';
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, 8);
  ctx.fill();
  ctx.fillStyle = c.rank === 'JOKER' ? '#FEF3C7' : '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = c.rank === 'JOKER' ? '#F59E0B' : '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = isRed ? '#DC2626' : '#111827';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(w * 0.34)}px "JetBrains Mono", monospace`;
  ctx.fillText(c.rank === 'JOKER' ? (c.jokerKind === 'big' ? 'BIG' : 'SM') : c.rank, 0, -h * 0.18);
  ctx.font = `800 ${Math.round(w * 0.44)}px sans-serif`;
  ctx.fillText(symMap[c.suit], 0, h * 0.16);
  ctx.restore();
}

function drawMahjongTile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: MahjongTileView) {
  ctx.save();
  ctx.translate(x, y);
  // Green jade back lip
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2 + 5, w, h, 6);
  ctx.fill();
  // Ivory tile front
  ctx.fillStyle = '#FFFBEB';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const col = t.suit === 'dragon' ? (t.value === 1 ? '#DC2626' : t.value === 2 ? '#059669' : '#2563EB') : '#B91C1C';
  ctx.fillStyle = col;
  ctx.font = `900 ${Math.round(w * 0.46)}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.label, 0, -4);
  ctx.fillStyle = '#64748B';
  ctx.font = `700 ${Math.round(w * 0.24)}px "JetBrains Mono", monospace`;
  ctx.fillText(t.sublabel, 0, h * 0.28);
  ctx.restore();
}

// ============================================================
// 69. LANDLORD CLASH (斗地主)
// ============================================================
export function renderLandlordClash(ctx: CanvasRenderingContext2D, snap: LandlordClashSnapshot): void {
  drawTableOval(ctx, '#7F1D1D', '#450A0A', '#B45309', '#78350F', 'rgba(220, 38, 38, 0.22)');

  // Top 3 Kitty cards display
  if (snap.kittyRevealed && snap.kittyCards.length > 0) {
    snap.kittyCards.forEach((c, i) => {
      drawLandlordCard(ctx, TABLE_CENTER_X - 58 + i * 58, 128, 46, 66, c);
    });
  }

  // Center table trick
  if (snap.tableCards.length > 0) {
    const sp = Math.min(54, 280 / Math.max(1, snap.tableCards.length));
    const sx = TABLE_CENTER_X - ((snap.tableCards.length - 1) * sp) / 2;
    snap.tableCards.forEach((c, i) => drawLandlordCard(ctx, sx + i * sp, TABLE_CENTER_Y + 6, 66, 94, c));
    if (snap.tableComboName) {
      drawHudChip(ctx, TABLE_CENTER_X, TABLE_CENTER_Y + 66, `${snap.tableComboName}`, '#FACC15', 'center');
    }
  } else {
    ctx.fillStyle = 'rgba(254, 243, 199, 0.65)';
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      tCanvas(snap.phase === 'bidding' ? 'BIDDING FOR LANDLORD (1× — 3×)' : 'FREE LEAD — PLAY ANY COMBO'),
      TABLE_CENTER_X,
      TABLE_CENTER_Y + 8
    );
  }

  const n = snap.players.length;
  snap.players.forEach((p, i) => {
    const seat = getCardSeatPosition(i, n);
    const badge = p.isLandlord
      ? { text: 'LANDLORD 地主', bg: '#DC2626', fg: '#FFFFFF' }
      : p.passedTrick
      ? { text: 'PASS', bg: '#334155', fg: '#CBD5E1' }
      : p.lastAction
      ? { text: p.lastAction, bg: '#10B981', fg: '#052E16' }
      : undefined;
    drawSeatBox(ctx, seat.x, seat.y, p.name, p.colorHex, `${p.cardCount} CARDS · ${p.score}`, p.id === snap.activePlayerId, badge);
  });

  drawFx(ctx, snap.flyingCards, snap.shockwaves);
  drawHudChip(ctx, 20, 16, `RD ${snap.round}/${snap.totalRounds} · ×${snap.multiplier}`, '#DC2626', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.turnTimeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'landlord-clash', snap.banner, null, snap.bannerColor ?? '#F59E0B');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 70. SPEED MAHJONG (雀魂极速麻将)
// ============================================================
export function renderSpeedMahjong(ctx: CanvasRenderingContext2D, snap: SpeedMahjongSnapshot): void {
  drawTableOval(ctx, '#065F46', '#022C22', '#92400E', '#78350F', 'rgba(16, 185, 129, 0.22)');

  // Center tile pond or winning HU hand!
  if (snap.winnerHand && snap.winnerHand.length > 0) {
    const sp = 50;
    const sx = TABLE_CENTER_X - ((snap.winnerHand.length - 1) * sp) / 2;
    snap.winnerHand.forEach((t, i) => drawMahjongTile(ctx, sx + i * sp, TABLE_CENTER_Y, 44, 62, t));
  } else if (snap.lastDiscard) {
    drawMahjongTile(ctx, TABLE_CENTER_X, TABLE_CENTER_Y - 6, 58, 82, snap.lastDiscard);
    drawHudChip(
      ctx,
      TABLE_CENTER_X,
      TABLE_CENTER_Y + 48,
      `LAST DISCARD · ${snap.lastDiscardBy ?? ''}`,
      '#10B981',
      'center'
    );
  } else {
    ctx.fillStyle = '#A7F3D0';
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(`WALL: ${snap.wallRemaining} TILES`), TABLE_CENTER_X, TABLE_CENTER_Y);
  }

  const n = snap.players.length;
  snap.players.forEach((p, i) => {
    const seat = getCardSeatPosition(i, n);
    // Show recent discards & melds toward center
    const dx = TABLE_CENTER_X - seat.x;
    const dy = TABLE_CENTER_Y - seat.y;
    const d = Math.hypot(dx, dy) || 1;
    const pondX = seat.x + (dx / d) * 86;
    const pondY = seat.y + (dy / d) * 62;
    p.discards.slice(-4).forEach((t, k) => {
      drawMahjongTile(ctx, pondX - 42 + k * 28, pondY, 26, 36, t);
    });
    drawSeatBox(
      ctx,
      seat.x,
      seat.y,
      p.name,
      p.colorHex,
      `${p.tileCount} TILES · ${p.score}`,
      p.id === snap.activePlayerId,
      p.lastAction ? { text: p.lastAction, bg: '#10B981', fg: '#052E16' } : undefined
    );
  });

  drawFx(ctx, snap.flyingCards, snap.shockwaves);
  drawHudChip(ctx, 20, 16, `MAHJONG RD ${snap.round}/${snap.totalRounds} · WALL ${snap.wallRemaining}`, '#10B981', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.turnTimeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'speed-mahjong', snap.banner, null, snap.bannerColor ?? '#10B981');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 71. TAVERN DICE (大话骰)
// ============================================================
export function renderLiarsDiceTavern(ctx: CanvasRenderingContext2D, snap: LiarsDiceTavernSnapshot): void {
  drawTableOval(ctx, '#451A03', '#271002', '#92400E', '#713F12', 'rgba(245, 158, 11, 0.22)');

  // Center Current Bid Medallion
  ctx.save();
  ctx.fillStyle = 'rgba(13, 15, 22, 0.9)';
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(TABLE_CENTER_X - 150, TABLE_CENTER_Y - 56, 300, 112, 18);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (snap.currentBidQty > 0) {
    ctx.fillStyle = '#FDE047';
    ctx.font = '900 38px "JetBrains Mono", monospace';
    ctx.fillText(`${snap.currentBidQty} × ${DICE_FACE[snap.currentBidFace]}`, TABLE_CENTER_X, TABLE_CENTER_Y - 8);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText(
      snap.totalMatchingDice !== null
        ? `ACTUAL MATCHING: ${snap.totalMatchingDice} DICE`
        : `${snap.lastBidderName ?? ''} · ${snap.pureMode ? 'PURE 齋' : '1s WILD'}`,
      TABLE_CENTER_X,
      TABLE_CENTER_Y + 32
    );
  } else {
    ctx.fillStyle = '#FDE68A';
    ctx.font = '800 18px "JetBrains Mono", monospace';
    ctx.fillText(tCanvas('OPENING BID...'), TABLE_CENTER_X, TABLE_CENTER_Y);
  }
  ctx.restore();

  const n = snap.players.length;
  snap.players.forEach((p, i) => {
    const seat = getCardSeatPosition(i, n);
    const dx = TABLE_CENTER_X - seat.x;
    const dy = TABLE_CENTER_Y - seat.y;
    const d = Math.hypot(dx, dy) || 1;
    const cupX = seat.x + (dx / d) * 84;
    const cupY = seat.y + (dy / d) * 58;

    if (snap.phase === 'reveal' && p.revealedDice.length > 0) {
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FEF08A';
      ctx.fillText(p.revealedDice.map((v) => DICE_FACE[v]).join(' '), cupX, cupY);
    } else if (p.alive) {
      // Closed leather dice cup
      ctx.fillStyle = '#7C2D12';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cupX - 18, cupY - 22, 36, 40, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FEF3C7';
      ctx.font = '900 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.diceCount}🎲`, cupX, cupY + 4);
    }

    drawSeatBox(
      ctx,
      seat.x,
      seat.y,
      p.name,
      p.colorHex,
      p.alive ? `${p.diceCount} DICE · ${p.score}` : 'OUT',
      p.id === snap.activePlayerId,
      p.lastAction ? { text: p.lastAction, bg: '#F59E0B', fg: '#141008' } : undefined
    );
  });

  drawFx(ctx, snap.flyingCards, snap.shockwaves);
  drawHudChip(ctx, 20, 16, `TAVERN DICE RD ${snap.round}`, '#F59E0B', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.turnTimeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'liars-dice-tavern', snap.banner, null, snap.bannerColor ?? '#F59E0B');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 72. SPY WORD (谁是卧底)
// ============================================================
export function renderUndercoverWord(ctx: CanvasRenderingContext2D, snap: UndercoverWordSnapshot): void {
  drawTableOval(ctx, '#2E1065', '#170838', '#6D28D9', '#4C1D95', 'rgba(139, 92, 246, 0.22)');

  // Center Phase / Word Reveal Board
  ctx.save();
  ctx.fillStyle = 'rgba(13, 15, 22, 0.92)';
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(TABLE_CENTER_X - 190, TABLE_CENTER_Y - 62, 380, 124, 18);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  if (snap.phase === 'reveal' && snap.civilianWordRevealed) {
    ctx.fillStyle = '#4ADE80';
    ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`CIVILIAN: ${snap.civilianWordRevealed}`, TABLE_CENTER_X, TABLE_CENTER_Y - 16);
    ctx.fillStyle = '#F87171';
    ctx.fillText(`SPY: ${snap.spyWordRevealed}`, TABLE_CENTER_X, TABLE_CENTER_Y + 20);
  } else {
    ctx.fillStyle = '#C4B5FD';
    ctx.font = '900 22px "Bricolage Grotesque", sans-serif';
    ctx.fillText(snap.phase === 'clue' ? 'CLUE PHASE' : 'VOTE OUT THE SPY!', TABLE_CENTER_X, TABLE_CENTER_Y - 10);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText(tCanvas('CHECK YOUR SECRET WORD ON YOUR PHONE'), TABLE_CENTER_X, TABLE_CENTER_Y + 24);
  }
  ctx.restore();

  const n = snap.players.length;
  snap.players.forEach((p, i) => {
    const seat = getCardSeatPosition(i, n);
    const badge =
      p.revealedRole === 'spy'
        ? { text: 'UNDERCOVER SPY!', bg: '#EF4444', fg: '#FFFFFF' }
        : p.revealedRole === 'civilian'
        ? { text: 'CIVILIAN', bg: '#10B981', fg: '#052E16' }
        : p.clueSubmitted
        ? { text: p.clueSubmitted.slice(0, 18), bg: '#312E81', fg: '#E0E7FF' }
        : undefined;
    drawSeatBox(
      ctx,
      seat.x,
      seat.y,
      p.name,
      p.colorHex,
      snap.phase === 'vote' ? `${p.votesReceived} VOTES · ${p.score}` : `${p.score} PTS`,
      (snap.phase === 'clue' && !p.clueSubmitted) || (snap.phase === 'vote' && !p.hasVoted),
      badge
    );
  });

  drawHudChip(ctx, 20, 16, `SPY WORD RD ${snap.round}/${snap.totalRounds}`, '#8B5CF6', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.turnTimeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'undercover-word', snap.banner, null, snap.bannerColor ?? '#8B5CF6');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 73. MIDNIGHT WEREWOLF (狼人杀极速版)
// ============================================================
export function renderMidnightWerewolf(ctx: CanvasRenderingContext2D, snap: MidnightWerewolfSnapshot): void {
  const isNight = snap.phase === 'night';
  drawTableOval(
    ctx,
    isNight ? '#1E1B4B' : '#312E81',
    '#09071A',
    '#4338CA',
    '#312E81',
    isNight ? 'rgba(99, 102, 241, 0.24)' : 'rgba(245, 158, 11, 0.2)'
  );

  // Center Moon / Sun Village Crest
  ctx.save();
  ctx.fillStyle = isNight ? 'rgba(99, 102, 241, 0.2)' : 'rgba(245, 158, 11, 0.2)';
  ctx.beginPath();
  ctx.arc(TABLE_CENTER_X, TABLE_CENTER_Y, 82, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isNight ? '#818CF8' : '#FACC15';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.font = '42px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isNight ? '🌕' : '☀️', TABLE_CENTER_X, TABLE_CENTER_Y - 14);
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '900 14px "JetBrains Mono", monospace';
  ctx.fillText(isNight ? `NIGHT ${snap.dayNumber}` : `DAY ${snap.dayNumber} VOTE`, TABLE_CENTER_X, TABLE_CENTER_Y + 34);
  ctx.restore();

  const n = snap.players.length;
  snap.players.forEach((p, i) => {
    const seat = getCardSeatPosition(i, n);
    const badge = p.revealedRole
      ? {
          text: p.revealedRole.toUpperCase(),
          bg: p.revealedRole === 'werewolf' ? '#EF4444' : '#10B981',
          fg: '#FFFFFF',
        }
      : !p.alive
      ? { text: 'ELIMINATED', bg: '#475569', fg: '#CBD5E1' }
      : snap.phase === 'vote' && p.votesReceived > 0
      ? { text: `${p.votesReceived} VOTES`, bg: '#F59E0B', fg: '#141008' }
      : undefined;
    drawSeatBox(
      ctx,
      seat.x,
      seat.y,
      p.name,
      p.alive ? p.colorHex : '#475569',
      p.alive ? `${p.score} PTS` : 'OUT',
      p.alive && ((isNight && !p.actedNight) || (snap.phase === 'vote' && !p.hasVoted)),
      badge
    );
  });

  drawHudChip(ctx, 20, 16, `MIDNIGHT WEREWOLF · DAY ${snap.dayNumber}`, '#6366F1', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.turnTimeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'midnight-werewolf', snap.banner, null, snap.bannerColor ?? '#6366F1');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 74. WORD CHAIN (成语/词语接龙)
// ============================================================
export function renderIdiomChain(ctx: CanvasRenderingContext2D, snap: IdiomChainSnapshot): void {
  drawTableOval(ctx, '#431407', '#1C0A03', '#C2410C', '#9A3412', 'rgba(249, 115, 22, 0.24)');

  // Giant Glowing Anchor Idiom & Word in center
  ctx.save();
  ctx.fillStyle = 'rgba(13, 15, 22, 0.94)';
  ctx.strokeStyle = '#F97316';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(TABLE_CENTER_X - 220, TABLE_CENTER_Y - 76, 440, 152, 20);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 38px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(snap.anchorZh, TABLE_CENTER_X, TABLE_CENTER_Y - 24);

  ctx.fillStyle = '#FDBA74';
  ctx.font = '800 22px "JetBrains Mono", monospace';
  ctx.fillText(snap.anchorEn, TABLE_CENTER_X, TABLE_CENTER_Y + 18);

  // Highlighted link target badge
  ctx.fillStyle = '#FACC15';
  ctx.font = '900 13px "JetBrains Mono", monospace';
  ctx.fillText(
    `NEXT STARTS WITH: "${snap.linkHintZh}"  /  "${snap.linkHintEn}"`,
    TABLE_CENTER_X,
    TABLE_CENTER_Y + 52
  );
  ctx.restore();

  const n = snap.players.length;
  snap.players.forEach((p, i) => {
    const seat = getCardSeatPosition(i, n);
    drawSeatBox(
      ctx,
      seat.x,
      seat.y,
      p.name,
      p.alive ? p.colorHex : '#475569',
      p.alive ? `STREAK ${p.streak} · ${p.score}` : 'OUT',
      p.alive && p.id === snap.activePlayerId,
      p.lastAction ? { text: p.lastAction.slice(0, 16), bg: p.alive ? '#10B981' : '#EF4444', fg: '#FFFFFF' } : undefined
    );
  });

  drawHudChip(ctx, 20, 16, `WORD CHAIN · ${snap.chainLength} LINKS`, '#F97316', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${snap.turnTimeLeft.toFixed(1)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'idiom-chain', snap.banner, null, snap.bannerColor ?? '#F97316');
  drawPopupTexts(ctx, snap.popups);
}

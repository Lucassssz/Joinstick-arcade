import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import type {
  BaccaratClubSnapshot,
  BackgammonSprintSnapshot,
  ChessBlitzSnapshot,
  CurlingMastersSnapshot,
  DominoChainSnapshot,
  GomokuBlitzSnapshot,
  HeartsBreakerSnapshot,
  HexagonConquestSnapshot,
  MancalaJewelsSnapshot,
  MemoryPairsSnapshot,
  PokerShowdownSnapshot,
  RummyRoyaleSnapshot,
  SequenceJackSnapshot,
  SpadesBiddingSnapshot,
  TarotArcanaSnapshot,
} from '../shared/packStrategyClassicsTypes';
import {
  drawArenaSlab,
  drawBoardBanner,
  drawCharacterPod3D,
  drawExtrudedBox3D,
  drawHudChip,
  drawNameplate,
  drawSphere3D,
  drawStudioBackdrop,
  shadeHex,
  tCanvas,
} from './packRenderHelpers';

function drawScoreFooter(
  ctx: CanvasRenderingContext2D,
  players: { name: string; colorHex: string; score: number; badge?: string }[]
) {
  const count = Math.max(1, players.length);
  const w = Math.min(220, (ARENA_WIDTH - 80) / count - 10);
  const sx = (ARENA_WIDTH - (count * (w + 10) - 10)) / 2;
  players.forEach((p, i) => {
    const x = sx + i * (w + 10);
    ctx.save();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(x, ARENA_HEIGHT - 74, w, 54, 12);
    ctx.fill();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, x + w / 2, ARENA_HEIGHT - 51);
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 14px "JetBrains Mono", monospace';
    ctx.fillText(`${tCanvas(`${p.score} PTS`)}${p.badge ? ` · ${tCanvas(p.badge)}` : ''}`, x + w / 2, ARENA_HEIGHT - 30);
    ctx.restore();
  });
}

// 1. GOMOKU BLITZ
export function renderGomokuBlitz(ctx: CanvasRenderingContext2D, snap: GomokuBlitzSnapshot): void {
  drawStudioBackdrop(ctx, '#0C111E', 'rgba(56,189,248,0.14)', 'rgba(255,255,255,0.03)', 44);
  const bw = 540;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 90;
  const cell = bw / snap.size;
  drawArenaSlab(ctx, ox - 18, oy - 18, bw + 36, bw + 36, 18, '#B45309', '#F59E0B');

  const slotColors = new Map(snap.players.map((p) => [p.slotIndex, p.colorHex]));
  ctx.save();
  ctx.strokeStyle = 'rgba(15,23,42,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < snap.size; i++) {
    const x = ox + (i + 0.5) * cell;
    const y = oy + (i + 0.5) * cell;
    ctx.beginPath();
    ctx.moveTo(ox + cell * 0.5, y);
    ctx.lineTo(ox + bw - cell * 0.5, y);
    ctx.moveTo(x, oy + cell * 0.5);
    ctx.lineTo(x, oy + bw - cell * 0.5);
    ctx.stroke();
  }
  ctx.restore();

  for (let r = 0; r < snap.size; r++) {
    for (let c = 0; c < snap.size; c++) {
      const val = snap.cells[r * snap.size + c];
      const cx = ox + (c + 0.5) * cell;
      const cy = oy + (r + 0.5) * cell;
      if (val === -2) {
        drawExtrudedBox3D(ctx, cx - 14, cy - 14, 28, 28, 6, '#334155', '#0F172A', 6);
      } else if (val >= 0) {
        const col = slotColors.get(val) ?? '#38BDF8';
        drawSphere3D(ctx, cx, cy, 16, col, '#FFFFFF');
      }
    }
  }

  for (const p of snap.players) {
    const cx = ox + (p.cursorC + 0.5) * cell;
    const cy = oy + (p.cursorR + 0.5) * cell;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(cx - 20, cy - 20, 40, 40);
    ctx.restore();
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#38BDF8');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#38BDF8', 16);
}

// 2. CHESS BLITZ
export function renderChessBlitz(ctx: CanvasRenderingContext2D, snap: ChessBlitzSnapshot): void {
  drawStudioBackdrop(ctx, '#120B1F', 'rgba(168,85,247,0.16)', 'rgba(255,255,255,0.03)', 44);
  const bw = 540;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 84;
  const cell = bw / snap.size;
  drawArenaSlab(ctx, ox - 16, oy - 16, bw + 32, bw + 32, 18, '#1E1B4B', '#A855F7');

  for (let r = 0; r < snap.size; r++) {
    for (let c = 0; c < snap.size; c++) {
      const dark = (r + c) % 2 === 1;
      ctx.fillStyle = dark ? '#312E81' : '#E2E8F0';
      ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
    }
  }

  for (const pw of snap.pawns) {
    const px = ox + (pw.c + 0.5) * cell;
    const py = oy + (pw.r + 0.5) * cell;
    drawSphere3D(ctx, px, py, 16, pw.gold ? '#FACC15' : '#64748B', '#FFFFFF');
  }

  for (const p of snap.players) {
    const px = ox + (p.c + 0.5) * cell;
    const py = oy + (p.r + 0.5) * cell;
    drawCharacterPod3D(ctx, px, py, 24, p.colorHex, 0, 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♞', px, py);
    drawNameplate(ctx, px, py - 34, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#A855F7');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#A855F7', 16);
}

// 3. DOMINO CHAIN
export function renderDominoChain(ctx: CanvasRenderingContext2D, snap: DominoChainSnapshot): void {
  drawStudioBackdrop(ctx, '#091418', 'rgba(250,204,21,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 98, ARENA_WIDTH - 168, 320, 20, '#0F293A', '#FACC15');

  const count = snap.chain.length;
  const tw = 82;
  const sx = ARENA_WIDTH / 2 - (count * (tw + 8)) / 2;
  snap.chain.forEach((d, i) => {
    const x = sx + i * (tw + 8);
    const y = 225;
    drawExtrudedBox3D(ctx, x, y, tw, 48, 8, '#F8FAFC', '#94A3B8', 8);
    ctx.strokeStyle = d.ownerColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, tw, 48);
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${d.a}|${d.b}`, x + tw / 2, y + 31);
  });

  // Player racks
  snap.players.forEach((p, idx) => {
    const rx = 120 + (idx % 4) * 255;
    const ry = 460 + Math.floor(idx / 4) * 110;
    drawExtrudedBox3D(ctx, rx, ry, 235, 90, 8, '#1E293B', '#0F172A', 12);
    ctx.fillStyle = p.colorHex;
    ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${p.name} · ${p.score}`, rx + 12, ry + 24);
    p.tiles.forEach((t, ti) => {
      const tx = rx + 12 + ti * 42;
      const isCur = ti === p.cursorIdx;
      ctx.fillStyle = isCur ? '#FACC15' : '#F8FAFC';
      ctx.fillRect(tx, ry + 36, 36, 40);
      ctx.fillStyle = '#0F172A';
      ctx.font = '800 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${t[0]}|${t[1]}`, tx + 18, ry + 61);
    });
  });

  drawHudChip(ctx, 24, 22, `ENDS ${snap.leftEnd} · ${snap.rightEnd} · ${Math.ceil(snap.timeLeft)}s`, '#FACC15');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FACC15', 16);
}

// 4. HEXAGON CONQUEST
export function renderHexagonConquest(ctx: CanvasRenderingContext2D, snap: HexagonConquestSnapshot): void {
  drawStudioBackdrop(ctx, '#061A14', 'rgba(16,217,139,0.16)', 'rgba(255,255,255,0.03)', 44);
  const slotColors = new Map(snap.players.map((p) => [p.slotIndex, p.colorHex]));
  const hexR = 46;
  const ox = 250;
  const oy = 175;

  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const cx = ox + c * 92 + (r % 2 === 1 ? 46 : 0);
      const cy = oy + r * 82;
      const owner = snap.owners[r * snap.cols + c];
      const fill = owner >= 0 ? slotColors.get(owner) ?? '#10D98B' : '#1E293B';
      ctx.save();
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 3) * k + Math.PI / 6;
        const hx = cx + Math.cos(ang) * hexR;
        const hy = cy + Math.sin(ang) * hexR;
        if (k === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const p of snap.players) {
    const cx = ox + p.c * 92 + (p.r % 2 === 1 ? 46 : 0);
    const cy = oy + p.r * 82;
    drawCharacterPod3D(ctx, cx, cy, 20, p.colorHex, 0, 6);
    drawNameplate(ctx, cx, cy - 34, `${p.name} (${p.hexes})`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#10D98B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10D98B', 16);
}

// 5. BACKGAMMON SPRINT
export function renderBackgammonSprint(ctx: CanvasRenderingContext2D, snap: BackgammonSprintSnapshot): void {
  drawStudioBackdrop(ctx, '#180B12', 'rgba(251,113,133,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 96, ARENA_WIDTH - 168, ARENA_HEIGHT - 196, 18, '#451A03', '#F59E0B');

  const pw = (ARENA_WIDTH - 220) / 12;
  for (let i = 0; i < 12; i++) {
    const px = 110 + i * pw;
    ctx.fillStyle = i % 2 === 0 ? '#B91C1C' : '#FEF3C7';
    // Top triangle points 12..23
    ctx.beginPath();
    ctx.moveTo(px, 110);
    ctx.lineTo(px + pw, 110);
    ctx.lineTo(px + pw / 2, 290);
    ctx.closePath();
    ctx.fill();
    // Bottom triangle points 0..11
    ctx.beginPath();
    ctx.moveTo(px, 595);
    ctx.lineTo(px + pw, 595);
    ctx.lineTo(px + pw / 2, 415);
    ctx.closePath();
    ctx.fill();
  }

  for (const p of snap.players) {
    p.pips.forEach((pt, idx) => {
      const clamped = Math.min(23, pt);
      const isTop = clamped >= 12;
      const col = isTop ? clamped - 12 : 11 - clamped;
      const cx = 110 + col * pw + pw / 2;
      const cy = isTop ? 155 + p.slotIndex * 28 : 545 - p.slotIndex * 28;
      drawSphere3D(ctx, cx, cy, 15, p.colorHex, idx === p.cursorPip ? '#FACC15' : '#FFFFFF');
    });
  }

  drawScoreFooter(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.lastRoll[0]}+${p.lastRoll[1]}` }))
  );
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#FB7185');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FB7185', 16);
}

// 6. MANCALA JEWELS
export function renderMancalaJewels(ctx: CanvasRenderingContext2D, snap: MancalaJewelsSnapshot): void {
  drawStudioBackdrop(ctx, '#061B12', 'rgba(34,197,94,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 110, 140, ARENA_WIDTH - 220, 380, 26, '#78350F', '#22C55E');

  for (let i = 0; i < 12; i++) {
    const topRow = i >= 6;
    const col = topRow ? 11 - i : i;
    const px = 210 + col * 155;
    const py = topRow ? 240 : 415;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(px, py, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 30px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(snap.pits[i]), px, py);
  }

  for (const p of snap.players) {
    const i = p.cursorPit;
    const topRow = i >= 6;
    const col = topRow ? 11 - i : i;
    const px = 210 + col * 155;
    const py = topRow ? 240 : 415;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(px, py, 60 + p.slotIndex * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawScoreFooter(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.store} GEMS` }))
  );
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#22C55E');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#22C55E', 16);
}

// 7. CURLING MASTERS
export function renderCurlingMasters(ctx: CanvasRenderingContext2D, snap: CurlingMastersSnapshot): void {
  drawStudioBackdrop(ctx, '#061524', 'rgba(0,194,255,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 210, 74, ARENA_WIDTH - 420, ARENA_HEIGHT - 104, 20, '#E0F2FE', '#38BDF8');

  // Target house rings
  const rings: [number, string][] = [
    [snap.houseR, '#2563EB'],
    [snap.houseR * 0.66, '#FFFFFF'],
    [snap.houseR * 0.34, '#EF4444'],
    [22, '#FACC15'],
  ];
  for (const [r, col] of rings) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(snap.houseX, snap.houseY, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const s of snap.stones) {
    drawSphere3D(ctx, s.x, s.y, 18, s.colorHex, '#FFFFFF');
  }

  for (const p of snap.players) {
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.aimX, 625);
    ctx.lineTo(p.aimX, snap.houseY);
    ctx.stroke();
    ctx.restore();
    drawSphere3D(ctx, p.aimX, 635, 16, p.colorHex, p.charging ? '#FACC15' : '#FFFFFF');
    drawNameplate(ctx, p.aimX, 666, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#00C2FF');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#00C2FF', 16);
}

// 8. RUMMY ROYALE
export function renderRummyRoyale(ctx: CanvasRenderingContext2D, snap: RummyRoyaleSnapshot): void {
  drawStudioBackdrop(ctx, '#061A14', 'rgba(16,217,139,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 90, 96, ARENA_WIDTH - 180, ARENA_HEIGHT - 196, 22, '#064E3B', '#10D98B');

  snap.melds.forEach((m, i) => {
    const x = 140 + (i % 3) * 315;
    const y = 140 + Math.floor(i / 3) * 145;
    drawExtrudedBox3D(ctx, x, y, 285, 115, 10, '#F8FAFC', '#CBD5E1', 12);
    ctx.fillStyle = m.colorHex;
    ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.ownerName, x + 142, y + 32);
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 32px "JetBrains Mono", monospace';
    ctx.fillText(tCanvas(m.label), x + 142, y + 82);
  });

  drawScoreFooter(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.meldsCount} MELDS` }))
  );
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#10D98B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10D98B', 16);
}

// 9 & 10. HEARTS BREAKER & SPADES BIDDING
function renderTrickTable(
  ctx: CanvasRenderingContext2D,
  snap: HeartsBreakerSnapshot | SpadesBiddingSnapshot,
  accent: string
) {
  drawStudioBackdrop(ctx, '#0E1220', 'rgba(56,189,248,0.14)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 110, 96, ARENA_WIDTH - 220, ARENA_HEIGHT - 196, 28, '#0F293A', accent);

  const count = Math.max(1, snap.trick.length);
  const w = 128;
  const sx = ARENA_WIDTH / 2 - (count * (w + 18) - 18) / 2;
  snap.trick.forEach((t, i) => {
    const x = sx + i * (w + 18);
    const y = 240;
    drawExtrudedBox3D(ctx, x, y, w, 175, 10, '#F8FAFC', '#94A3B8', 14);
    ctx.strokeStyle = t.colorHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, 175);
    const suitSym = t.suit === 'spades' ? '♠' : t.suit === 'hearts' ? '♥' : t.suit === 'diamonds' ? '♦' : '♣';
    ctx.fillStyle = t.suit === 'hearts' || t.suit === 'diamonds' ? '#EF4444' : '#0F172A';
    ctx.font = '900 44px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${t.rank}${suitSym}`, x + w / 2, y + 98);
    drawNameplate(ctx, x + w / 2, y + 195, t.playerName, t.colorHex);
  });

  drawScoreFooter(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.tricksWon}W` }))
  );
  drawHudChip(ctx, 24, 22, `TRICK ${snap.round} · ${Math.ceil(snap.timeLeft)}s`, accent);
  if (snap.banner) drawBoardBanner(ctx, snap.banner, accent, 16);
}

export function renderHeartsBreaker(ctx: CanvasRenderingContext2D, snap: HeartsBreakerSnapshot): void {
  renderTrickTable(ctx, snap, '#F43F5E');
}

export function renderSpadesBidding(ctx: CanvasRenderingContext2D, snap: SpadesBiddingSnapshot): void {
  renderTrickTable(ctx, snap, '#38BDF8');
}

// 11. POKER SHOWDOWN
export function renderPokerShowdown(ctx: CanvasRenderingContext2D, snap: PokerShowdownSnapshot): void {
  drawStudioBackdrop(ctx, '#140F08', 'rgba(250,204,21,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 96, ARENA_WIDTH - 168, ARENA_HEIGHT - 196, 26, '#064E3B', '#FACC15');

  snap.players.forEach((p, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 130 + col * 485;
    const y = 132 + row * 120;
    drawExtrudedBox3D(ctx, x, y, 455, 102, 8, '#1E293B', '#0F172A', 12);
    ctx.fillStyle = p.colorHex;
    ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${p.name} · ${p.score}`, x + 16, y + 28);
    ctx.fillStyle = p.locked ? '#10D98B' : '#94A3B8';
    ctx.fillText(tCanvas(p.handRankLabel ?? (p.locked ? 'LOCKED' : 'DRAWING...')), x + 16, y + 54);
    p.revealedCards.forEach((c, ci) => {
      const cx = x + 220 + ci * 42;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(cx, y + 20, 36, 56);
      ctx.fillStyle = c.suit === 'hearts' || c.suit === 'diamonds' ? '#EF4444' : '#0F172A';
      ctx.font = '900 16px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.rank, cx + 18, y + 54);
    });
  });

  drawScoreFooter(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score }))
  );
  drawHudChip(ctx, 24, 22, `HAND ${snap.round} · ${Math.ceil(snap.timeLeft)}s`, '#FACC15');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FACC15', 16);
}

// 12. TAROT ARCANA
export function renderTarotArcana(ctx: CanvasRenderingContext2D, snap: TarotArcanaSnapshot): void {
  drawStudioBackdrop(ctx, '#140924', 'rgba(192,132,252,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 100, 98, ARENA_WIDTH - 200, ARENA_HEIGHT - 198, 24, '#1E1B4B', '#C084FC');

  const count = Math.max(1, snap.players.length);
  const w = 135;
  const sx = ARENA_WIDTH / 2 - (count * (w + 14) - 14) / 2;
  snap.players.forEach((p, i) => {
    const x = sx + i * (w + 14);
    const y = 215;
    const col = p.element === 'FIRE' ? '#EF4444' : p.element === 'NATURE' ? '#22C55E' : p.element === 'FROST' ? '#38BDF8' : p.element === 'SUN' ? '#FACC15' : '#334155';
    drawExtrudedBox3D(ctx, x, y, w, 195, 10, col, shadeHex(col, -0.35), 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(p.element ?? (p.picked ? 'READY' : '...')), x + w / 2, y + 108);
    drawNameplate(ctx, x + w / 2, y + 218, `${p.name} · ${p.score}`, p.colorHex);
  });

  drawHudChip(ctx, 24, 22, `CLASH ${snap.round} · ${Math.ceil(snap.timeLeft)}s`, '#C084FC');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#C084FC', 16);
}

// 13. BACCARAT CLUB
export function renderBaccaratClub(ctx: CanvasRenderingContext2D, snap: BaccaratClubSnapshot): void {
  drawStudioBackdrop(ctx, '#181006', 'rgba(245,158,11,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 100, 98, ARENA_WIDTH - 200, ARENA_HEIGHT - 198, 24, '#064E3B', '#F59E0B');

  const count = Math.max(1, snap.players.length);
  const w = 135;
  const sx = ARENA_WIDTH / 2 - (count * (w + 14) - 14) / 2;
  snap.players.forEach((p, i) => {
    const x = sx + i * (w + 14);
    const y = 215;
    drawExtrudedBox3D(ctx, x, y, w, 195, 10, p.handTotal === 9 ? '#FACC15' : '#1E293B', '#0F172A', 14);
    ctx.fillStyle = p.handTotal === 9 ? '#0F172A' : '#FFFFFF';
    ctx.font = '900 42px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.handTotal !== null ? String(p.handTotal) : p.picked ? '✓' : '?', x + w / 2, y + 102);
    if (p.cardsShown.length > 0) {
      ctx.font = '800 18px "JetBrains Mono", monospace';
      ctx.fillText(p.cardsShown.join(' + '), x + w / 2, y + 148);
    }
    drawNameplate(ctx, x + w / 2, y + 218, `${p.name} · ${p.score}`, p.colorHex);
  });

  drawHudChip(ctx, 24, 22, `RD ${snap.round} · ${Math.ceil(snap.timeLeft)}s`, '#F59E0B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F59E0B', 16);
}

// 14. MEMORY PAIRS
export function renderMemoryPairs(ctx: CanvasRenderingContext2D, snap: MemoryPairsSnapshot): void {
  drawStudioBackdrop(ctx, '#160918', 'rgba(236,72,153,0.16)', 'rgba(255,255,255,0.03)', 44);
  const bw = 720;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 115;
  const cw = 165;
  const ch = 132;
  const gap = 16;

  snap.cards.forEach((c, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = ox + col * (cw + gap);
    const y = oy + row * (ch + gap);
    const shown = c.flipped || !!c.matchedByColor;
    const bg = c.matchedByColor ? c.matchedByColor : shown ? c.colorHex : '#1E293B';
    drawExtrudedBox3D(ctx, x, y, cw, ch, 8, bg, shadeHex(bg, -0.35), 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 42px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shown ? c.symbol : `#${i + 1}`, x + cw / 2, y + ch / 2);
  });

  drawScoreFooter(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.pairs} PAIRS` }))
  );
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#EC4899');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EC4899', 16);
}

// 15. SEQUENCE JACK
export function renderSequenceJack(ctx: CanvasRenderingContext2D, snap: SequenceJackSnapshot): void {
  drawStudioBackdrop(ctx, '#160E07', 'rgba(255,122,26,0.16)', 'rgba(255,255,255,0.03)', 44);
  const bw = 780;
  const bh = 460;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 104;
  const cw = bw / snap.cols;
  const ch = bh / snap.rows;
  const slotColors = new Map(snap.players.map((p) => [p.slotIndex, p.colorHex]));

  drawArenaSlab(ctx, ox - 14, oy - 14, bw + 28, bh + 28, 18, '#0F172A', '#FF7A1A');

  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const idx = r * snap.cols + c;
      const x = ox + c * cw + 4;
      const y = oy + r * ch + 4;
      const owner = snap.owners[idx];
      const bg = owner >= 0 ? slotColors.get(owner) ?? '#FF7A1A' : '#1E293B';
      drawExtrudedBox3D(ctx, x, y, cw - 8, ch - 8, 6, bg, shadeHex(bg, -0.35), 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 28px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(snap.boardLabels[idx] ?? '', x + (cw - 8) / 2, y + (ch - 8) / 2);
    }
  }

  drawScoreFooter(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.lines} SEQ` }))
  );
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#FF7A1A');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FF7A1A', 16);
}

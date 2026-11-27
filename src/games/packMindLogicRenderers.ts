import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import type {
  DeepSeaOxygenSnapshot,
  FireworkHintsSnapshot,
  OneCardCourtSnapshot,
  PicrossNonogramSnapshot,
  RowSixBustSnapshot,
  SilentSyncSnapshot,
  SpeedSudokuDuelSnapshot,
  TangramSilhouetteSnapshot,
  TunnelSaboteurSnapshot,
  WordTileCrossroadsSnapshot,
} from '../shared/packMindLogicTypes';
import {
  drawArenaSlab,
  drawBoardBanner,
  drawCharacterPod3D,
  drawExtrudedBox3D,
  drawHudChip,
  drawNameplate,
  drawShadowOval,
  drawSphere3D,
  drawStudioBackdrop,
  isTablePlayerHidden,
  shadeHex,
  tCanvas,
} from './packRenderHelpers';

const FW_HEX: Record<'red' | 'blue' | 'gold' | 'green', string> = {
  red: '#FF4D2E',
  blue: '#00C2FF',
  gold: '#FFB800',
  green: '#10D98B',
};

function drawFooterBar(
  ctx: CanvasRenderingContext2D,
  players: { id?: string; name: string; colorHex: string; score: number; badge?: string }[]
) {
  const visible = players.filter((p) => !isTablePlayerHidden(p.id, p.name));
  if (visible.length === 0) return;
  const count = Math.max(1, visible.length);
  const w = Math.min(220, (ARENA_WIDTH - 80) / count - 10);
  const sx = (ARENA_WIDTH - (count * (w + 10) - 10)) / 2;
  visible.forEach((p, i) => {
    const x = sx + i * (w + 10);
    ctx.save();
    ctx.fillStyle = 'rgba(13,18,30,0.92)';
    ctx.beginPath();
    ctx.roundRect(x, ARENA_HEIGHT - 72, w, 52, 12);
    ctx.fill();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 2.8;
    ctx.stroke();
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, x + w / 2, ARENA_HEIGHT - 51);
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.fillText(`${tCanvas(`${Math.round(p.score)} PTS`)}${p.badge ? ` · ${tCanvas(p.badge)}` : ''}`, x + w / 2, ARENA_HEIGHT - 30);
    ctx.restore();
  });
}

// 1. ROW SIX BUST
export function renderRowSixBust(ctx: CanvasRenderingContext2D, snap: RowSixBustSnapshot): void {
  drawStudioBackdrop(ctx, '#1A0F0A', 'rgba(249,115,22,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 110, 88, ARENA_WIDTH - 220, 470, 22, '#2B1910', '#F97316');

  snap.rows.forEach((row, ri) => {
    const ry = 114 + ri * 106;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.roundRect(140, ry, ARENA_WIDTH - 280, 86, 14);
    ctx.fill();
    ctx.fillStyle = '#FB923C';
    ctx.font = '900 14px "JetBrains Mono", monospace';
    ctx.fillText(tCanvas(`ROW ${ri + 1}`), 158, ry + 48);
    ctx.restore();

    row.cards.forEach((c, ci) => {
      const cx = 240 + ci * 136;
      const topCol = c.bulls >= 3 ? '#EF4444' : c.bulls === 2 ? '#F59E0B' : '#38BDF8';
      drawExtrudedBox3D(ctx, cx, ry + 8, 112, 70, 7, topCol, shadeHex(topCol, -0.4), 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 24px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.val}`, cx + 56, ry + 40);
      ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${c.bulls} 🐂`, cx + 56, ry + 64);
    });

    const slot6X = 240 + 5 * 136;
    ctx.save();
    ctx.strokeStyle = 'rgba(239,68,68,0.65)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2.5;
    ctx.strokeRect(slot6X, ry + 8, 108, 70);
    ctx.fillStyle = '#FCA5A5';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas('6TH BUST!'), slot6X + 54, ry + 48);
    ctx.restore();
  });

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · R${snap.round}`, '#F97316');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F97316', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: p.picked ? 'READY' : `${p.bullsTaken}🐂` }))
  );
}

// 2. SILENT SYNC
export function renderSilentSync(ctx: CanvasRenderingContext2D, snap: SilentSyncSnapshot): void {
  drawStudioBackdrop(ctx, '#091124', 'rgba(56,189,248,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 180, 108, ARENA_WIDTH - 360, 420, 26, '#0E1C36', '#38BDF8');

  drawSphere3D(ctx, ARENA_WIDTH / 2, 300, 118, '#1E3A8A', '#38BDF8');
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 72px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(snap.lastPlayedNum > 0 ? `#${snap.lastPlayedNum}` : '01', ARENA_WIDTH / 2, 294);
  ctx.fillStyle = '#FACC15';
  ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(tCanvas(`LEVEL ${snap.level} · STREAK ${snap.streak}`), ARENA_WIDTH / 2, 356);
  ctx.restore();

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · ${snap.cardsRemaining} LEFT`, '#38BDF8');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#38BDF8', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.cardsLeft} CARDS` }))
  );
}

// 3. DEEP SEA OXYGEN
export function renderDeepSeaOxygen(ctx: CanvasRenderingContext2D, snap: DeepSeaOxygenSnapshot): void {
  drawStudioBackdrop(ctx, '#041E30', 'rgba(14,165,233,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 110, 86, ARENA_WIDTH - 220, 495, 22, '#062C46', '#0EA5E9');

  // Oxygen Meter Bar
  const oxyPct = Math.max(0, Math.min(1, snap.oxygen / Math.max(1, snap.maxOxygen)));
  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(140, 102, ARENA_WIDTH - 280, 32, 10);
  ctx.fill();
  ctx.fillStyle = oxyPct > 0.35 ? '#00C2FF' : '#EF4444';
  ctx.beginPath();
  ctx.roundRect(144, 106, (ARENA_WIDTH - 288) * oxyPct, 24, 8);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tCanvas(`SHARED OXYGEN: ${snap.oxygen} / ${snap.maxOxygen}`), ARENA_WIDTH / 2, 123);
  ctx.restore();

  // Submarine Zone (Depth 0) + 10 Sea Floor Stones
  drawExtrudedBox3D(ctx, 145, 148, 910, 48, 8, '#FACC15', '#B45309', 14);
  ctx.fillStyle = '#14120B';
  ctx.font = '900 15px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(tCanvas('SUBMARINE DECK — RETURN HERE TO BANK TREASURE!'), ARENA_WIDTH / 2, 177);

  snap.depths.forEach((d, idx) => {
    const col = idx % 5;
    const row = Math.floor(idx / 5);
    const dx = 180 + col * 176;
    const dy = 236 + row * 145;
    const fill = d.treasure > 0 ? '#F59E0B' : '#1E293B';
    drawExtrudedBox3D(ctx, dx, dy, 132, 92, 8, fill, shadeHex(fill, -0.4), 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(`DEPTH ${d.depth}`), dx + 66, dy + 34);
    ctx.fillStyle = d.treasure > 0 ? '#FEF08A' : '#64748B';
    ctx.fillText(d.treasure > 0 ? `💎 ×${d.treasure}` : tCanvas('LOOTED'), dx + 66, dy + 64);
  });

  snap.players.forEach((p, idx) => {
    let px = ARENA_WIDTH / 2 + (idx - (snap.players.length - 1) / 2) * 76;
    let py = 172;
    if (p.depth > 0) {
      const i = p.depth - 1;
      const col = i % 5;
      const row = Math.floor(i / 5);
      px = 246 + col * 176 + ((idx % 3) - 1) * 20;
      py = 282 + row * 145;
    }
    drawCharacterPod3D(ctx, px, py, 19, p.colorHex, 0, 6);
    drawNameplate(ctx, px, py - 28, `${p.name} (${p.bagLoot}💎)`, p.colorHex);
  });

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#0EA5E9');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#0EA5E9', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.banked} BANKED` }))
  );
}

// 4. ONE CARD COURT
export function renderOneCardCourt(ctx: CanvasRenderingContext2D, snap: OneCardCourtSnapshot): void {
  drawStudioBackdrop(ctx, '#1F0A1B', 'rgba(236,72,153,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 90, 98, ARENA_WIDTH - 180, 440, 24, '#2E1028', '#EC4899');

  const count = Math.max(1, snap.players.length);
  const cardW = Math.min(180, (ARENA_WIDTH - 240) / count - 12);
  const sx = (ARENA_WIDTH - (count * (cardW + 12) - 12)) / 2;

  snap.players.forEach((p, i) => {
    const x = sx + i * (cardW + 12);
    const y = 170;
    const face = p.playedCard ? '#1E1B4B' : '#31122C';
    drawExtrudedBox3D(ctx, x, y, cardW, 250, 10, face, '#0F172A', 16);
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, 250, 16);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, x + cardW / 2, y + 36);
    ctx.fillStyle = p.playedCard ? '#FACC15' : '#F472B6';
    ctx.font = '900 18px "JetBrains Mono", monospace';
    ctx.fillText(p.playedCard ? tCanvas(p.playedCard) : tCanvas('THINKING...'), x + cardW / 2, y + 132);
    if (p.shielded) {
      ctx.fillStyle = '#38BDF8';
      ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(tCanvas('🛡 SHIELDED'), x + cardW / 2, y + 185);
    }
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '800 14px "JetBrains Mono", monospace';
    ctx.fillText(`${p.favors} ★`, x + cardW / 2, y + 225);
    ctx.restore();
  });

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · R${snap.round}`, '#EC4899');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EC4899', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.favors} ★` }))
  );
}

// 5. FIREWORK HINTS
export function renderFireworkHints(ctx: CanvasRenderingContext2D, snap: FireworkHintsSnapshot): void {
  drawStudioBackdrop(ctx, '#090C1C', 'rgba(250,204,21,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 110, 96, ARENA_WIDTH - 220, 445, 24, '#111833', '#FACC15');

  snap.stacks.forEach((st, idx) => {
    const x = 195 + idx * 220;
    const y = 160;
    const col = FW_HEX[st.color];
    drawExtrudedBox3D(ctx, x, y, 150, 290, 10, '#1E293B', '#0F172A', 18);
    for (let lvl = 1; lvl <= 5; lvl++) {
      const lit = lvl <= st.topVal;
      const ly = y + 245 - (lvl - 1) * 50;
      ctx.fillStyle = lit ? col : 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(x + 22, ly, 106, 38, 10);
      ctx.fill();
      ctx.fillStyle = lit ? '#0F172A' : '#64748B';
      ctx.font = '900 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`#${lvl}`, x + 75, ly + 25);
    }
    ctx.fillStyle = col;
    ctx.font = '900 16px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(`${st.color.toUpperCase()} NEXT: #${st.topVal + 1}`), x + 75, y + 322);
  });

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · HINTS ${snap.hintTokens}`, '#FACC15');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FACC15', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.launched} 🚀` }))
  );
}

// 6. TUNNEL SABOTEUR
export function renderTunnelSaboteur(ctx: CanvasRenderingContext2D, snap: TunnelSaboteurSnapshot): void {
  drawStudioBackdrop(ctx, '#16110A', 'rgba(245,158,11,0.16)', 'rgba(255,255,255,0.03)', 44);
  const bw = 740;
  const bh = 430;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 104;
  drawArenaSlab(ctx, ox - 20, oy - 20, bw + 40, bh + 40, 22, '#241B10', '#F59E0B');

  const cw = bw / snap.cols;
  const ch = bh / snap.rows;
  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const kind = snap.tunnelCells[r * snap.cols + c];
      const cx = ox + c * cw + 5;
      const cy = oy + r * ch + 5;
      const fill =
        kind === 'gold' ? '#FACC15' : kind === 'path' ? '#92400E' : kind === 'rock' ? '#475569' : '#1E1610';
      drawExtrudedBox3D(ctx, cx, cy, cw - 10, ch - 10, 6, fill, shadeHex(fill, -0.4), 10);
      ctx.fillStyle = kind === 'gold' ? '#14120B' : '#FFFFFF';
      ctx.font = '900 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        kind === 'gold' ? tCanvas('GOLD') : kind === 'path' ? '══' : kind === 'rock' ? '🪨' : '',
        cx + (cw - 10) / 2,
        cy + (ch - 10) / 2 + 6
      );
    }
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#F59E0B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F59E0B', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.goldFound} GOLD` }))
  );
}

// 7. PICROSS NONOGRAM
export function renderPicrossNonogram(ctx: CanvasRenderingContext2D, snap: PicrossNonogramSnapshot): void {
  drawStudioBackdrop(ctx, '#091915', 'rgba(16,217,139,0.16)', 'rgba(255,255,255,0.03)', 44);
  const bw = 420;
  const ox = (ARENA_WIDTH - bw) / 2 + 30;
  const oy = 148;
  const cell = bw / snap.size;
  drawArenaSlab(ctx, ox - 110, oy - 68, bw + 135, bw + 92, 22, '#0F172A', '#10D98B');

  const slotColor = new Map(snap.players.map((p) => [p.slotIndex, p.colorHex]));

  ctx.save();
  ctx.fillStyle = '#6EE7B7';
  ctx.font = '900 18px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  for (let c = 0; c < snap.size; c++) {
    ctx.fillText(snap.colClues[c] ?? '0', ox + (c + 0.5) * cell, oy - 22);
  }
  ctx.textAlign = 'right';
  for (let r = 0; r < snap.size; r++) {
    ctx.fillText(snap.rowClues[r] ?? '0', ox - 18, oy + (r + 0.5) * cell + 6);
  }
  ctx.restore();

  for (let r = 0; r < snap.size; r++) {
    for (let c = 0; c < snap.size; c++) {
      const val = snap.revealed[r * snap.size + c];
      const cx = ox + c * cell + 4;
      const cy = oy + r * cell + 4;
      if (val >= 0) {
        const col = slotColor.get(val) ?? '#10D98B';
        drawExtrudedBox3D(ctx, cx, cy, cell - 8, cell - 8, 6, col, shadeHex(col, -0.4), 8);
      } else {
        ctx.fillStyle = val === -2 ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.roundRect(cx, cy, cell - 8, cell - 8, 8);
        ctx.fill();
        if (val === -2) {
          ctx.fillStyle = '#FCA5A5';
          ctx.font = '900 22px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('×', cx + (cell - 8) / 2, cy + (cell - 8) / 2 + 8);
        }
      }
    }
  }

  for (const p of snap.players) {
    const cx = ox + p.c * cell + 2;
    const cy = oy + p.r * cell + 2;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(cx, cy, cell - 4, cell - 4);
    drawNameplate(ctx, cx + cell / 2, cy - 12, p.name, p.colorHex);
    ctx.restore();
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · #${snap.puzzleIndex + 1}`, '#10D98B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10D98B', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.hits} PX` }))
  );
}

// 8. SPEED SUDOKU DUEL
export function renderSpeedSudokuDuel(ctx: CanvasRenderingContext2D, snap: SpeedSudokuDuelSnapshot): void {
  drawStudioBackdrop(ctx, '#120C24', 'rgba(168,85,247,0.18)', 'rgba(255,255,255,0.03)', 44);
  const bw = 468;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 104;
  const cell = bw / snap.size;
  drawArenaSlab(ctx, ox - 18, oy - 18, bw + 36, bw + 36, 20, '#1E1B4B', '#A855F7');

  for (let r = 0; r < snap.size; r++) {
    for (let c = 0; c < snap.size; c++) {
      const idx = r * snap.size + c;
      const val = snap.grid[idx];
      const locked = snap.lockedMask[idx];
      const cx = ox + c * cell + 3;
      const cy = oy + r * cell + 3;
      ctx.fillStyle = locked ? '#312E81' : val > 0 ? '#14532D' : '#0F172A';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cell - 6, cell - 6, 8);
      ctx.fill();
      if (val > 0) {
        ctx.fillStyle = locked ? '#E2E8F0' : '#4ADE80';
        ctx.font = '900 28px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${val}`, cx + (cell - 6) / 2, cy + (cell - 6) / 2 + 2);
      }
    }
  }

  // 2x3 Box dividers
  ctx.save();
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox + cell * 3, oy);
  ctx.lineTo(ox + cell * 3, oy + bw);
  ctx.moveTo(ox, oy + cell * 2);
  ctx.lineTo(ox + bw, oy + cell * 2);
  ctx.moveTo(ox, oy + cell * 4);
  ctx.lineTo(ox + bw, oy + cell * 4);
  ctx.stroke();
  ctx.restore();

  for (const p of snap.players) {
    const cx = ox + p.c * cell + 2;
    const cy = oy + p.r * cell + 2;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(cx, cy, cell - 4, cell - 4);
    drawNameplate(ctx, cx + cell / 2, cy - 12, `${p.name}: [${p.pickNum}]`, p.colorHex);
    ctx.restore();
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#A855F7');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#A855F7', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `PICK ${p.pickNum}` }))
  );
}

// 9. WORD TILE CROSSROADS
export function renderWordTileCrossroads(ctx: CanvasRenderingContext2D, snap: WordTileCrossroadsSnapshot): void {
  drawStudioBackdrop(ctx, '#091A10', 'rgba(34,197,94,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 110, 96, ARENA_WIDTH - 220, 445, 24, '#11291B', '#22C55E');

  snap.targetWords.forEach((tw, idx) => {
    const y = 138 + idx * 124;
    drawExtrudedBox3D(ctx, 180, y, ARENA_WIDTH - 360, 96, 8, tw.claimedBy ? '#166534' : '#1E293B', '#0F172A', 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 34px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tw.word, ARENA_WIDTH / 2, y + 54);
    ctx.fillStyle = tw.claimedBy ? '#FACC15' : '#86EFAC';
    ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(tCanvas(tw.claimedBy ? `CLAIMED BY ${tw.claimedBy}` : `WORD BOUNTY +${tw.bonus}`), ARENA_WIDTH / 2, y + 82);
  });

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#22C55E');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#22C55E', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.wordsBuilt} WORDS` }))
  );
}

// 10. TANGRAM SILHOUETTE SPRINT
function drawTangramPoly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rotDeg: number,
  kind: TangramSilhouetteSnapshot['shapeKind'],
  fill: string,
  stroke: string,
  alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.beginPath();
  if (kind === 'triangle') {
    ctx.moveTo(0, -48);
    ctx.lineTo(48, 36);
    ctx.lineTo(-48, 36);
  } else if (kind === 'diamond') {
    ctx.moveTo(0, -52);
    ctx.lineTo(40, 0);
    ctx.lineTo(0, 52);
    ctx.lineTo(-40, 0);
  } else if (kind === 'parallelogram') {
    ctx.moveTo(-26, -34);
    ctx.lineTo(50, -34);
    ctx.lineTo(26, 34);
    ctx.lineTo(-50, 34);
  } else {
    ctx.rect(-38, -38, 76, 76);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

export function renderTangramSilhouette(ctx: CanvasRenderingContext2D, snap: TangramSilhouetteSnapshot): void {
  drawStudioBackdrop(ctx, '#1A0B1B', 'rgba(255,59,154,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 88, ARENA_WIDTH - 168, 520, 24, '#1E1128', '#FF3B9A');

  drawTangramPoly(ctx, snap.targetX, snap.targetY, snap.targetRot, snap.shapeKind, 'rgba(255,255,255,0.16)', '#FFFFFF', 1);

  for (const p of snap.players) {
    drawShadowOval(ctx, p.x, p.y + 18, 42, 16, 0.32);
    drawTangramPoly(ctx, p.x, p.y, p.rot, snap.shapeKind, p.colorHex, '#FFFFFF', 0.88);
    drawNameplate(ctx, p.x, p.y - 54, `${p.name} (${p.rot}°)`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · ${snap.puzzlesSolved} SOLVED`, '#FF3B9A');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FF3B9A', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.matches} ★` }))
  );
}

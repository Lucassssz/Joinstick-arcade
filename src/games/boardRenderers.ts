import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ColorMatchSnapshot,
  type JungleLaddersSnapshot,
  type LuckyAuctionSnapshot,
  type RichStreetSnapshot,
  type TreasureDigSnapshot,
} from '../shared/types';
import { drawNameplate, tCanvas } from './renderers';

function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  accentHex = '#FFB800',
  align: 'left' | 'center' | 'right' = 'center'
): void {
  const label = tCanvas(text);
  ctx.save();
  ctx.font = '800 13px "JetBrains Mono", monospace';
  const w = Math.max(88, ctx.measureText(label).width + 22);
  const h = 28;
  const rx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  ctx.fillStyle = 'rgba(13, 15, 20, 0.88)';
  ctx.beginPath();
  ctx.roundRect(rx, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rx + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

function drawCenterBanner(ctx: CanvasRenderingContext2D, text: string, accent = '#FFB800', y = ARENA_HEIGHT / 2): void {
  const label = tCanvas(text);
  ctx.save();
  ctx.font = '800 26px "Plus Jakarta Sans", sans-serif';
  const w = Math.min(ARENA_WIDTH - 120, Math.max(300, ctx.measureText(label).width + 64));
  const h = 58;
  ctx.fillStyle = 'rgba(13, 15, 20, 0.94)';
  ctx.beginPath();
  ctx.roundRect(ARENA_WIDTH / 2 - w / 2, y - h / 2, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, ARENA_WIDTH / 2, y + 1);
  ctx.restore();
}

function drawDieFace(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, value: number, rolling: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  if (rolling) ctx.rotate(Math.sin(performance.now() * 0.04) * 0.28);
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2, size, size, 10);
  ctx.fill();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.stroke();

  const off = size * 0.25;
  const r = size * 0.085;
  const pips: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-off, -off], [off, off]],
    3: [[-off, -off], [0, 0], [off, off]],
    4: [[-off, -off], [off, -off], [-off, off], [off, off]],
    5: [[-off, -off], [off, -off], [0, 0], [-off, off], [off, off]],
    6: [[-off, -off], [off, -off], [-off, 0], [off, 0], [-off, off], [off, off]],
  };
  ctx.fillStyle = value === 1 || value === 6 ? '#FF4D2E' : '#11141B';
  for (const [px, py] of pips[Math.max(1, Math.min(6, value))] ?? pips[1]) {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ============================================================
// 21. RICH STREET (Monopoly-Style Fast City Board)
// ============================================================
function getRichTileRect(idx: number): { x: number; y: number; w: number; h: number } {
  // 24 tiles around a 7x7 perimeter loop (indices 0..23 clockwise from bottom-left)
  const boardSize = 650;
  const left = 56;
  const top = Math.floor((ARENA_HEIGHT - boardSize) / 2);
  const cell = boardSize / 7; // ~92.8px

  let col = 0;
  let row = 6;
  if (idx <= 6) {
    col = idx;
    row = 6;
  } else if (idx <= 12) {
    col = 6;
    row = 6 - (idx - 6);
  } else if (idx <= 18) {
    col = 6 - (idx - 12);
    row = 0;
  } else {
    col = 0;
    row = idx - 18;
  }
  return { x: left + col * cell, y: top + row * cell, w: cell - 3, h: cell - 3 };
}

function getRichVisualPos(visualTile: number): { x: number; y: number } {
  const n = 24;
  const base = Math.floor(visualTile) % n;
  const next = (base + 1) % n;
  const frac = visualTile - Math.floor(visualTile);
  const r1 = getRichTileRect(base);
  const r2 = getRichTileRect(next);
  const x1 = r1.x + r1.w / 2;
  const y1 = r1.y + r1.h / 2;
  const x2 = r2.x + r2.w / 2;
  const y2 = r2.y + r2.h / 2;
  return {
    x: x1 + (x2 - x1) * frac,
    y: y1 + (y2 - y1) * frac - Math.sin(frac * Math.PI) * 14,
  };
}

export function renderRichStreet(ctx: CanvasRenderingContext2D, snap: RichStreetSnapshot): void {
  ctx.fillStyle = '#0F131A';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Subtle tabletop grid
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  for (let x = 0; x < ARENA_WIDTH; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_HEIGHT);
    ctx.stroke();
  }

  // Board center felt panel
  const cLeft = 56 + 650 / 7 + 8;
  const cTop = Math.floor((ARENA_HEIGHT - 650) / 2) + 650 / 7 + 8;
  const cSize = (650 / 7) * 5 - 19;
  ctx.fillStyle = '#142029';
  ctx.beginPath();
  ctx.roundRect(cLeft, cTop, cSize, cSize, 16);
  ctx.fill();
  ctx.strokeStyle = '#2B3647';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw all 24 tiles
  for (const t of snap.tiles) {
    const r = getRichTileRect(t.index);
    const isDecision = snap.phase === 'decision' && snap.decisionTileIndex === t.index;

    ctx.fillStyle = isDecision ? '#263244' : '#1B202B';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = isDecision ? '#FFB800' : t.ownerColor ?? '#2E3646';
    ctx.lineWidth = isDecision ? 3 : t.ownerColor ? 2.5 : 1.2;
    ctx.stroke();

    // Top color bar
    ctx.fillStyle = t.groupColor;
    ctx.beginPath();
    ctx.roundRect(r.x + 3, r.y + 3, r.w - 6, 13, 5);
    ctx.fill();

    // Property level stars / towers
    if (t.level > 0) {
      for (let i = 0; i < t.level; i++) {
        ctx.fillStyle = '#FFB800';
        ctx.fillRect(r.x + 8 + i * 14, r.y + 21, 10, 10);
      }
    }

    // Tile name
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shortName = tCanvas(t.name);
    ctx.fillText(shortName.slice(0, 12), r.x + r.w / 2, r.y + r.h * 0.56);

    // Price or rent tag
    if (t.kind === 'property') {
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = t.ownerColor ? '#FFB800' : '#94A3B8';
      const rent = t.level <= 1 ? t.baseRent : t.level === 2 ? Math.round(t.baseRent * 1.9) : Math.round(t.baseRent * 3.1);
      ctx.fillText(t.ownerId ? `R:$${rent}` : `$${t.price}`, r.x + r.w / 2, r.y + r.h - 12);
    } else if (t.kind === 'tax') {
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FF7A1A';
      ctx.fillText(`-$${t.baseRent}`, r.x + r.w / 2, r.y + r.h - 12);
    } else if (t.kind === 'jackpot') {
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FFB800';
      ctx.fillText(`$${snap.jackpotPool}`, r.x + r.w / 2, r.y + r.h - 12);
    }
  }

  // Center table showcase: Title, Jackpot, Dice, Event Log
  const cx = cLeft + cSize / 2;
  const cy = cTop + cSize / 2;

  ctx.fillStyle = '#FFB800';
  ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(tCanvas('RICH STREET'), cx, cTop + 44);

  drawChip(ctx, cx, cTop + 68, `ROUND ${snap.round}/${snap.totalRounds} · POT $${snap.jackpotPool}`, '#FFB800', 'center');

  // Twin Dice
  drawDieFace(ctx, cx - 44, cy - 18, 62, snap.dice[0], snap.diceRolling);
  drawDieFace(ctx, cx + 44, cy - 18, 62, snap.dice[1], snap.diceRolling);

  // Active turn / decision box inside center
  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  if (active) {
    ctx.fillStyle = 'rgba(13, 15, 20, 0.85)';
    ctx.beginPath();
    ctx.roundRect(cLeft + 24, cy + 44, cSize - 48, 124, 12);
    ctx.fill();
    ctx.strokeStyle = active.colorHex;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = active.colorHex;
    ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`P${active.slotIndex + 1} ${active.name}`, cx, cy + 72);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    const msg = snap.eventText ? tCanvas(snap.eventText) : '';
    ctx.fillText(msg.slice(0, 44), cx, cy + 102);

    if (snap.phase === 'wait-roll' || snap.phase === 'decision') {
      const prompt =
        snap.phase === 'decision'
          ? tCanvas(`A: BUY/UPGRADE ($${snap.decisionCost})  ·  B: SKIP (${Math.ceil(snap.turnTimeLeft)}s)`)
          : tCanvas(`PRESS A TO ROLL (${Math.ceil(snap.turnTimeLeft)}s)`);
      ctx.fillStyle = '#FFB800';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText(prompt, cx, cy + 136);
    }
  }

  // Draw player tokens on the board
  snap.players.forEach((p, idx) => {
    if (p.bankrupt) return;
    const pos = getRichVisualPos(p.visualTile);
    const ox = ((idx % 3) - 1) * 16;
    const oy = (Math.floor(idx / 3) - 0.5) * 16;
    const px = pos.x + ox;
    const py = pos.y + oy;

    ctx.save();
    if (p.id === snap.activePlayerId) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 16 + Math.sin(performance.now() * 0.01) * 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0D0F14';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`P${p.slotIndex + 1}`, px, py + 0.5);
    ctx.restore();
  });

  // Right-side Wealth Leaderboard Panel
  const panelX = 740;
  const panelY = 38;
  const panelW = 418;
  const panelH = ARENA_HEIGHT - 76;
  ctx.fillStyle = '#161A23';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 16);
  ctx.fill();
  ctx.strokeStyle = '#2A3140';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 17px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(tCanvas('CITY WEALTH'), panelX + 20, panelY + 34);

  const sorted = [...snap.players].sort((a, b) => b.netWorth - a.netWorth);
  sorted.forEach((p, idx) => {
    const ry = panelY + 60 + idx * 70;
    const isAct = p.id === snap.activePlayerId;
    ctx.fillStyle = isAct ? '#232A38' : '#1B202A';
    ctx.beginPath();
    ctx.roundRect(panelX + 16, ry, panelW - 32, 60, 10);
    ctx.fill();
    ctx.strokeStyle = isAct ? p.colorHex : '#283040';
    ctx.lineWidth = isAct ? 2.2 : 1;
    ctx.stroke();

    // Color dot
    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(panelX + 36, ry + 30, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`P${p.slotIndex + 1} ${p.name}`, panelX + 56, ry + 22);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '600 12px "JetBrains Mono", monospace';
    const sub = `$${p.cash} · ${p.propertiesOwned} ${tCanvas('shops')}${p.rentShield ? ' · SHIELD' : ''}`;
    ctx.fillText(sub, panelX + 56, ry + 43);

    // Net worth right-aligned
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFB800';
    ctx.font = '800 16px "JetBrains Mono", monospace';
    ctx.fillText(`$${p.netWorth}`, panelX + panelW - 28, ry + 28);

    // Lucky charge mini bar
    const bw = 72;
    ctx.fillStyle = '#0F131A';
    ctx.fillRect(panelX + panelW - 28 - bw, ry + 40, bw, 6);
    ctx.fillStyle = p.luckyCharge >= 100 ? '#00C2FF' : '#3B82F6';
    ctx.fillRect(panelX + panelW - 28 - bw, ry + 40, (bw * p.luckyCharge) / 100, 6);
    ctx.textAlign = 'left';
  });

  if (snap.banner) {
    drawCenterBanner(ctx, snap.banner, '#FFB800', 84);
  }
}

// ============================================================
// 22. JUNGLE LADDERS (Snakes & Ladders Party)
// ============================================================
function getJungleTileCenter(tileNum: number, targetTile: number): { x: number; y: number; w: number; h: number } {
  const cols = 10;
  const rows = targetTile === 50 ? 5 : 10;
  const boardW = 730;
  const boardH = 640;
  const left = 46;
  const top = Math.floor((ARENA_HEIGHT - boardH) / 2);
  const cw = boardW / cols;
  const ch = boardH / rows;

  const clamped = Math.max(1, Math.min(targetTile, tileNum)) - 1;
  const rowFromBottom = Math.floor(clamped / cols);
  const colInRow = clamped % cols;
  const col = rowFromBottom % 2 === 0 ? colInRow : cols - 1 - colInRow;
  const rowFromTop = rows - 1 - rowFromBottom;

  return {
    x: left + col * cw + cw / 2,
    y: top + rowFromTop * ch + ch / 2,
    w: cw,
    h: ch,
  };
}

export function renderJungleLadders(ctx: CanvasRenderingContext2D, snap: JungleLaddersSnapshot): void {
  ctx.fillStyle = '#0E1714';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  const cols = 10;
  const rows = snap.targetTile === 50 ? 5 : 10;
  const boardW = 730;
  const boardH = 640;
  const left = 46;
  const top = Math.floor((ARENA_HEIGHT - boardH) / 2);

  // Wooden frame
  ctx.fillStyle = '#1D2923';
  ctx.beginPath();
  ctx.roundRect(left - 10, top - 10, boardW + 20, boardH + 20, 14);
  ctx.fill();
  ctx.strokeStyle = '#31493C';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw numbered tiles
  for (let n = 1; n <= snap.targetTile; n++) {
    const c = getJungleTileCenter(n, snap.targetTile);
    const isMystery = snap.mysteryTiles.includes(n);
    const isGoal = n === snap.targetTile;
    const alt = ((n - 1) + Math.floor((n - 1) / cols)) % 2 === 0;

    ctx.fillStyle = isGoal
      ? '#4A360D'
      : isMystery
        ? '#1C3545'
        : alt
          ? '#1A2D24'
          : '#21382C';
    ctx.beginPath();
    ctx.roundRect(c.x - c.w / 2 + 2, c.y - c.h / 2 + 2, c.w - 4, c.h - 4, 6);
    ctx.fill();

    if (isGoal || isMystery) {
      ctx.strokeStyle = isGoal ? '#FFB800' : '#00C2FF';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    ctx.fillStyle = isGoal ? '#FFB800' : isMystery ? '#7DD3FC' : 'rgba(241,245,249,0.72)';
    ctx.font = isGoal ? '800 15px "JetBrains Mono", monospace' : '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(n), c.x - c.w / 2 + 6, c.y - c.h / 2 + 5);

    if (isMystery) {
      ctx.fillStyle = '#00C2FF';
      ctx.font = '800 18px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', c.x, c.y + 4);
    }

    if (snap.bananas.includes(n)) {
      ctx.fillStyle = '#FFB800';
      ctx.beginPath();
      ctx.arc(c.x + 10, c.y + 8, 9, 0.2, Math.PI * 1.15);
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }

  // Draw bamboo ladders
  for (const lad of snap.ladders) {
    const a = getJungleTileCenter(lad.from, snap.targetTile);
    const b = getJungleTileCenter(lad.to, snap.targetTile);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = (-dy / len) * 9;
    const py = (dx / len) * 9;

    ctx.save();
    ctx.strokeStyle = '#D99B38';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x + px, a.y + py);
    ctx.lineTo(b.x + px, b.y + py);
    ctx.moveTo(a.x - px, a.y - py);
    ctx.lineTo(b.x - px, b.y - py);
    ctx.stroke();

    const rungs = Math.max(3, Math.floor(len / 24));
    ctx.strokeStyle = '#F6C86E';
    ctx.lineWidth = 3;
    for (let i = 1; i < rungs; i++) {
      const t = i / rungs;
      const rx = a.x + dx * t;
      const ry = a.y + dy * t;
      ctx.beginPath();
      ctx.moveTo(rx + px, ry + py);
      ctx.lineTo(rx - px, ry - py);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw playful snakes
  for (const sn of snap.snakes) {
    const head = getJungleTileCenter(sn.from, snap.targetTile);
    const tail = getJungleTileCenter(sn.to, snap.targetTile);
    const mx = (head.x + tail.x) / 2;
    const my = (head.y + tail.y) / 2;
    const perpX = -(tail.y - head.y) * 0.22;
    const perpY = (tail.x - head.x) * 0.22;

    ctx.save();
    ctx.strokeStyle = sn.colorHex;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.bezierCurveTo(
      mx + perpX,
      my + perpY,
      mx - perpX,
      my - perpY,
      tail.x,
      tail.y
    );
    ctx.stroke();

    // Snake head + eyes
    ctx.fillStyle = sn.colorHex;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(head.x - 4, head.y - 3, 2.8, 0, Math.PI * 2);
    ctx.arc(head.x + 4, head.y - 3, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0D0F14';
    ctx.beginPath();
    ctx.arc(head.x - 4, head.y - 3, 1.3, 0, Math.PI * 2);
    ctx.arc(head.x + 4, head.y - 3, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw player pawns
  snap.players.forEach((p, idx) => {
    let px = 0;
    let py = 0;
    if (p.slideFrom !== null && p.slideTo !== null) {
      const c1 = getJungleTileCenter(p.slideFrom, snap.targetTile);
      const c2 = getJungleTileCenter(p.slideTo, snap.targetTile);
      px = c1.x + (c2.x - c1.x) * p.slideProgress;
      py = c1.y + (c2.y - c1.y) * p.slideProgress;
    } else {
      const base = Math.floor(p.visualTile);
      const next = Math.min(snap.targetTile, base + 1);
      const frac = p.visualTile - base;
      const c1 = getJungleTileCenter(base, snap.targetTile);
      const c2 = getJungleTileCenter(next, snap.targetTile);
      px = c1.x + (c2.x - c1.x) * frac;
      py = c1.y + (c2.y - c1.y) * frac - Math.sin(frac * Math.PI) * 14;
    }

    const ox = ((idx % 3) - 1) * 13;
    const oy = (Math.floor(idx / 3) - 0.5) * 12;
    px += ox;
    py += oy;

    ctx.save();
    if (p.id === snap.activePlayerId) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 16 + Math.sin(performance.now() * 0.01) * 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0B1210';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`P${p.slotIndex + 1}`, px, py + 0.5);
    ctx.restore();
  });

  // Right-side Dice & Standings Panel
  const px = 804;
  const py = 40;
  const pw = 356;
  const ph = ARENA_HEIGHT - 80;
  ctx.fillStyle = '#15201C';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 16);
  ctx.fill();
  ctx.strokeStyle = '#2A3F36';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#10D98B';
  ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(tCanvas('JUNGLE LADDERS'), px + pw / 2, py + 36);

  // Giant Die
  drawDieFace(ctx, px + pw / 2, py + 106, 78, snap.diceValue, snap.diceRolling);

  // Oscillating Power-Dice Bar
  const barX = px + 28;
  const barY = py + 168;
  const barW = pw - 56;
  const barH = 18;
  ctx.fillStyle = '#0D1412';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 9);
  ctx.fill();
  const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  grad.addColorStop(0, '#FF4D2E');
  grad.addColorStop(0.5, '#FFB800');
  grad.addColorStop(1, '#10D98B');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(barX + 2, barY + 2, (barW - 4) * snap.powerMeter, barH - 4, 7);
  ctx.fill();

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillText(tCanvas(`POWER ROLL · ${Math.ceil(snap.turnTimeLeft)}s`), px + pw / 2, barY + 34);

  if (snap.eventText) {
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(tCanvas(snap.eventText).slice(0, 38), px + pw / 2, barY + 60);
  }

  // Player positions list
  const sorted = [...snap.players].sort((a, b) => b.tile - a.tile);
  sorted.forEach((p, idx) => {
    const ry = barY + 86 + idx * 52;
    if (ry + 44 > py + ph) return;
    const isAct = p.id === snap.activePlayerId;
    ctx.fillStyle = isAct ? '#21362D' : '#1A2822';
    ctx.beginPath();
    ctx.roundRect(px + 16, ry, pw - 32, 44, 10);
    ctx.fill();
    ctx.strokeStyle = isAct ? p.colorHex : '#2A3F36';
    ctx.lineWidth = isAct ? 2 : 1;
    ctx.stroke();

    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(px + 34, ry + 22, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`P${p.slotIndex + 1} ${p.name}`, px + 50, ry + 22);

    ctx.textAlign = 'right';
    ctx.fillStyle = p.trickReady ? '#FFB800' : '#10D98B';
    ctx.font = '800 14px "JetBrains Mono", monospace';
    ctx.fillText(`#${p.tile}${p.trickReady ? ' ★' : ''}`, px + pw - 26, ry + 22);
    ctx.textAlign = 'center';
  });

  if (snap.banner) {
    drawCenterBanner(ctx, snap.banner, '#10D98B', 76);
  }
}

// ============================================================
// 25. COLOR MATCH DANCE (Memory Floor Party)
// ============================================================
const MATCH_PALETTE = [
  { bg: '#C62828', border: '#FF6B57', name: 'RED' },
  { bg: '#0077B6', border: '#38BDF8', name: 'BLUE' },
  { bg: '#C68A00', border: '#FDE047', name: 'GOLD' },
  { bg: '#0D8A5A', border: '#34D399', name: 'MINT' },
];

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  symbol: 'star' | 'moon' | 'diamond' | 'bolt',
  cx: number,
  cy: number,
  size: number,
  color = 'rgba(255,255,255,0.92)'
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.beginPath();
  if (symbol === 'star') {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? size : size * 0.45;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else if (symbol === 'diamond') {
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.8, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.8, 0);
    ctx.closePath();
    ctx.fill();
  } else if (symbol === 'bolt') {
    ctx.moveTo(size * 0.15, -size);
    ctx.lineTo(-size * 0.55, size * 0.08);
    ctx.lineTo(0, size * 0.08);
    ctx.lineTo(-size * 0.2, size);
    ctx.lineTo(size * 0.58, -size * 0.08);
    ctx.lineTo(0.05 * size, -size * 0.08);
    ctx.closePath();
    ctx.fill();
  } else {
    // Moon crescent
    ctx.arc(0, 0, size * 0.82, 0.35 * Math.PI, 1.75 * Math.PI);
    ctx.arc(size * 0.32, -size * 0.1, size * 0.65, 1.65 * Math.PI, 0.45 * Math.PI, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function renderColorMatch(ctx: CanvasRenderingContext2D, snap: ColorMatchSnapshot): void {
  ctx.fillStyle = '#0D0F16';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Subtle disco pit radial backdrop
  const pit = ctx.createRadialGradient(ARENA_WIDTH / 2, ARENA_HEIGHT / 2 + 40, 40, ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 560);
  pit.addColorStop(0, '#1B1F30');
  pit.addColorStop(1, '#090B10');
  ctx.fillStyle = pit;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Top Target Marquee (Color + Symbol + Timer)
  const targetCol = MATCH_PALETTE[snap.targetColorIndex] ?? MATCH_PALETTE[0];
  ctx.save();
  ctx.fillStyle = '#161A24';
  ctx.beginPath();
  ctx.roundRect(ARENA_WIDTH / 2 - 220, 16, 440, 74, 14);
  ctx.fill();
  ctx.strokeStyle = targetCol.border;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = targetCol.bg;
  ctx.beginPath();
  ctx.roundRect(ARENA_WIDTH / 2 - 204, 26, 54, 54, 10);
  ctx.fill();
  drawSymbol(ctx, snap.targetSymbol, ARENA_WIDTH / 2 - 177, 53, 18);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const targetLabel =
    snap.phase === 'drop'
      ? tCanvas('FLOOR DROPPED!')
      : tCanvas(`STAND ON ${targetCol.name}!`);
  ctx.fillText(targetLabel, ARENA_WIDTH / 2 - 134, 42);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.fillText(
    tCanvas(`WAVE ${snap.wave}/${snap.totalWaves} · ${Math.max(0, snap.phaseTimer).toFixed(1)}s`),
    ARENA_WIDTH / 2 - 134,
    67
  );
  ctx.restore();

  // Tiles
  for (const t of snap.tiles) {
    if (t.dropped) continue;
    const pal = MATCH_PALETTE[t.colorIndex] ?? MATCH_PALETTE[0];
    const shake = t.warning ? (Math.sin(performance.now() * 0.06 + t.id) * 3) : 0;

    ctx.save();
    ctx.fillStyle = pal.bg;
    ctx.globalAlpha = t.warning ? 0.62 : 0.94;
    ctx.beginPath();
    ctx.roundRect(t.x + shake, t.y, t.w, t.h, 12);
    ctx.fill();
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    drawSymbol(ctx, t.symbol, t.x + t.w / 2 + shake, t.y + t.h / 2, 24, 'rgba(255,255,255,0.88)');
    ctx.restore();
  }

  // Shove waves
  for (const w of snap.shoveWaves) {
    ctx.save();
    ctx.strokeStyle = w.colorHex;
    ctx.globalAlpha = Math.max(0, w.alpha);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Players
  for (const p of snap.players) {
    if (!p.alive) continue;
    const hopScale = p.hopTimer > 0 ? 1 + Math.sin((p.hopTimer / p.hopDuration) * Math.PI) * 0.45 : 1;
    const fallScale = p.falling ? Math.max(0.15, 1 - p.fallProgress * 0.85) : 1;
    const scale = hopScale * fallScale;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(0, 7, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    if (!p.falling) {
      drawNameplate(ctx, p.x, p.y - 34, p.slotIndex, p.name, p.colorHex);
    }
  }

  if (snap.banner) {
    drawCenterBanner(ctx, snap.banner, targetCol.border, ARENA_HEIGHT / 2);
  }
}

// ============================================================
// 27. TREASURE ISLAND DIG (Hot-or-Cold Pirate Hunt)
// ============================================================
export function renderTreasureDig(ctx: CanvasRenderingContext2D, snap: TreasureDigSnapshot): void {
  // Tropical turquoise ocean
  ctx.fillStyle = '#0D4A5E';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  const tNow = performance.now() * 0.002;
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.16)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.roundRect(70 - i * 16 + Math.sin(tNow + i) * 6, 56 - i * 12, ARENA_WIDTH - 140 + i * 32, ARENA_HEIGHT - 112 + i * 24, 90);
    ctx.stroke();
  }

  // Sandy island
  ctx.fillStyle = '#E0B973';
  ctx.beginPath();
  ctx.roundRect(96, 78, ARENA_WIDTH - 192, ARENA_HEIGHT - 156, 72);
  ctx.fill();
  ctx.fillStyle = '#EBC886';
  ctx.beginPath();
  ctx.roundRect(114, 94, ARENA_WIDTH - 228, ARENA_HEIGHT - 188, 60);
  ctx.fill();

  // Dug holes
  for (const h of snap.dugHoles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, h.alpha);
    ctx.fillStyle = h.success ? '#5C3D18' : '#A6834D';
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, 20, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    if (h.success) {
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Radar sonar rings
  for (const r of snap.radars) {
    ctx.save();
    ctx.strokeStyle = r.colorHex;
    ctx.globalAlpha = Math.max(0, r.alpha);
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Revealed treasure X marks!
  for (const s of snap.spots) {
    if (s.revealedTimer <= 0) continue;
    ctx.save();
    ctx.strokeStyle = s.kind === 'crown' ? '#FF3B9A' : s.kind === 'gem' ? '#00C2FF' : '#D97706';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x - 14, s.y - 14);
    ctx.lineTo(s.x + 14, s.y + 14);
    ctx.moveTo(s.x + 14, s.y - 14);
    ctx.lineTo(s.x - 14, s.y + 14);
    ctx.stroke();
    ctx.restore();
  }

  // Crabs
  for (const c of snap.crabs) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = c.stunTimer > 0 ? '#94A3B8' : '#EF4444';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    // Claws
    ctx.beginPath();
    ctx.arc(-16, -11, 6, 0, Math.PI * 2);
    ctx.arc(16, -11, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-6, -4, 3, 0, Math.PI * 2);
    ctx.arc(6, -4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Hunters with hot-or-cold ring!
  for (const p of snap.players) {
    ctx.save();
    const heatColor = p.heat > 0.75 ? '#FF4D2E' : p.heat > 0.42 ? '#FFB800' : '#00C2FF';
    const ringR = 28 + p.heat * 18 + Math.sin(performance.now() * (0.008 + p.heat * 0.02)) * 4;
    ctx.strokeStyle = heatColor;
    ctx.lineWidth = 3 + p.heat * 3;
    ctx.globalAlpha = 0.4 + p.heat * 0.55;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = p.stunTimer > 0 ? '#64748B' : p.colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    const tag = p.heat > 0.76 ? 'HOT!' : undefined;
    drawNameplate(ctx, p.x, p.y - 34, p.slotIndex, p.name, p.colorHex, tag);
  }

  // Score popups
  for (const pp of snap.popups) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pp.alpha);
    ctx.font = '800 18px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0D0F14';
    ctx.fillText(tCanvas(pp.text), pp.x + 2, pp.y + 2);
    ctx.fillStyle = pp.colorHex;
    ctx.fillText(tCanvas(pp.text), pp.x, pp.y);
    ctx.restore();
  }

  drawChip(ctx, ARENA_WIDTH / 2, 18, `TIME ${Math.ceil(snap.timeLeft)}s`, '#FFB800', 'center');
}

// ============================================================
// 29. LUCKY AUCTION (Mystery Chest Game Show)
// ============================================================
export function renderLuckyAuction(ctx: CanvasRenderingContext2D, snap: LuckyAuctionSnapshot): void {
  // Deep velvet stage
  ctx.fillStyle = '#110F18';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Overhead warm game-show spotlight
  const spot = ctx.createRadialGradient(ARENA_WIDTH / 2, 160, 20, ARENA_WIDTH / 2, 260, 440);
  spot.addColorStop(0, 'rgba(255, 184, 0, 0.24)');
  spot.addColorStop(0.6, 'rgba(82, 139, 255, 0.08)');
  spot.addColorStop(1, 'rgba(17, 15, 24, 0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Top round + timer HUD
  drawChip(
    ctx,
    ARENA_WIDTH / 2,
    18,
    `CHEST ${snap.round}/${snap.totalRounds} · ${Math.ceil(snap.timer)}s`,
    '#FFB800',
    'center'
  );

  // Center Stage Pedestal
  const cx = ARENA_WIDTH / 2;
  const cy = 248;
  ctx.fillStyle = '#1D1A2B';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 78, 170, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFB800';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Mystery Chest or Revealed Prize
  if (snap.phase === 'bidding') {
    const bob = Math.sin(performance.now() * 0.004) * 5;
    const chestColors = {
      royal: '#7C2D12',
      wooden: '#6B4423',
      mystery: '#3B1D5E',
      crystal: '#0F4C75',
    };
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.fillStyle = chestColors[snap.chestVisual];
    ctx.beginPath();
    ctx.roundRect(-84, -64, 168, 118, 16);
    ctx.fill();
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 5;
    ctx.stroke();
    // Horizontal golden strap
    ctx.fillStyle = '#FFB800';
    ctx.fillRect(-84, -10, 168, 14);
    ctx.fillStyle = '#14120B';
    ctx.beginPath();
    ctx.roundRect(-18, -22, 36, 38, 8);
    ctx.fill();
    ctx.fillStyle = '#FFB800';
    ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, -2);
    ctx.restore();
  } else {
    // Reveal prize!
    ctx.save();
    ctx.translate(cx, cy - 6);
    if (snap.revealedPrize === 'duck') {
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(0, 14, 42, 0, Math.PI * 2);
      ctx.arc(16, -24, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FF7A1A';
      ctx.beginPath();
      ctx.ellipse(40, -20, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(24, -30, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle =
        snap.revealedPrize === 'diamond'
          ? '#38BDF8'
          : snap.revealedPrize === 'ruby'
            ? '#FF3B9A'
            : '#FFB800';
      ctx.beginPath();
      ctx.moveTo(0, -56);
      ctx.lineTo(54, -8);
      ctx.lineTo(0, 56);
      ctx.lineTo(-54, -8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 24px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`$${snap.revealedValue}`, 0, 72);
    ctx.restore();
  }

  // Chest Title & Mystery Clue
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(tCanvas(snap.chestLabel), cx, 94);

  ctx.fillStyle = '#FDE047';
  ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`"${tCanvas(snap.chestClue)}"`, cx, 124);

  // Current Top Bid Display
  ctx.fillStyle = 'rgba(20, 24, 34, 0.92)';
  ctx.beginPath();
  ctx.roundRect(cx - 210, 356, 420, 68, 14);
  ctx.fill();
  ctx.strokeStyle = snap.highestBidderColor ?? '#334155';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText(tCanvas('CURRENT TOP BID'), cx, 376);

  ctx.fillStyle = snap.highestBidderColor ?? '#F8FAFC';
  ctx.font = '800 22px "JetBrains Mono", monospace';
  const topLabel = snap.highestBidderName
    ? `$${snap.highestBid} · ${snap.highestBidderName}`
    : tCanvas('NO BIDS YET — PRESS A!');
  ctx.fillText(topLabel, cx, 404);

  // Player Bidding Podiums across bottom
  const count = Math.max(1, snap.players.length);
  const cardW = Math.min(220, Math.floor((ARENA_WIDTH - 80 - (count - 1) * 14) / count));
  const totalW = count * cardW + (count - 1) * 14;
  const startX = (ARENA_WIDTH - totalW) / 2;

  snap.players.forEach((p, idx) => {
    const rx = startX + idx * (cardW + 14);
    const ry = 468;
    const isTop = snap.highestBidderId === p.id;
    ctx.fillStyle = p.passed ? '#161922' : isTop ? '#242B3A' : '#1B202C';
    ctx.beginPath();
    ctx.roundRect(rx, ry, cardW, 206, 14);
    ctx.fill();
    ctx.strokeStyle = isTop ? p.colorHex : p.passed ? '#282E3A' : '#333D4F';
    ctx.lineWidth = isTop ? 3 : 1.5;
    ctx.stroke();

    ctx.fillStyle = p.colorHex;
    ctx.fillRect(rx + 12, ry + 12, cardW - 24, 6);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`P${p.slotIndex + 1} ${p.name}`, rx + cardW / 2, ry + 42);

    ctx.fillStyle = '#10D98B';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillText(`$${p.cash} ${tCanvas('cash')}`, rx + cardW / 2, ry + 76);

    ctx.fillStyle = '#FFB800';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText(`$${p.treasureValue} ${tCanvas('loot')}`, rx + cardW / 2, ry + 102);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText(`${tCanvas('WORTH')} $${p.totalWorth}`, rx + cardW / 2, ry + 130);

    // Status footer
    const statusText = p.passed
      ? tCanvas('PASSED')
      : isTop
        ? tCanvas('LEADING!')
        : `${tCanvas('OFFER')} $${p.draftBid}`;
    ctx.fillStyle = p.passed ? '#64748B' : isTop ? '#10D98B' : '#00C2FF';
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.fillText(statusText, rx + cardW / 2, ry + 174);
  });

  if (snap.banner) {
    drawCenterBanner(ctx, snap.banner, '#FFB800', 442);
  }
}

import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ColorMatchSnapshot,
  type JungleLaddersSnapshot,
  type LuckyAuctionSnapshot,
  type RichStreetSnapshot,
  type TreasureDigSnapshot,
} from '../shared/types';
import { drawNameplate, drawPopupTexts, tCanvas } from './renderers';
import {
  drawArenaSlab,
  drawCharacterPod3D,
  drawDie3D,
  drawExtrudedBox3D,
  drawExtrudedCylinder3D,
  drawShadowOval,
  drawSphere3D,
  drawSpinningGem3D,
  drawStudioBackdrop,
  shadeHex,
} from './render25d';

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

// ============================================================
// 21. RICH STREET (2.5D Monopoly-Style Tabletop & 3D Towers)
// ============================================================
function getRichTileRect(idx: number): { x: number; y: number; w: number; h: number } {
  const boardSize = 650;
  const left = 56;
  const top = Math.floor((ARENA_HEIGHT - boardSize) / 2);
  const cell = boardSize / 7;

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

function getRichVisualPos(visualTile: number): { x: number; y: number; hopZ: number } {
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
    y: y1 + (y2 - y1) * frac,
    hopZ: Math.sin(frac * Math.PI) * 18,
  };
}

function drawPropertyBuilding3D(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  level: number,
  colorHex: string
): void {
  if (level <= 0) return;
  const w = level >= 3 ? 22 : level === 2 ? 20 : 18;
  const h = level >= 3 ? 14 : 13;
  const depth = level >= 3 ? 22 : level === 2 ? 14 : 8;
  const topCol = level >= 3 ? '#FDE047' : shadeHex(colorHex, 0.18);
  const frontCol = level >= 3 ? '#B45309' : shadeHex(colorHex, -0.35);
  drawExtrudedBox3D(ctx, cx - w / 2, cy - h / 2, w, h, depth, 3, topCol, frontCol, '#FFFFFF', true);

  // Tiny window detail on front facade
  ctx.fillStyle = level >= 3 ? '#FFFBEB' : 'rgba(255,255,255,0.75)';
  if (level >= 2) {
    ctx.fillRect(cx - 5, cy - 6, 3, 4);
    ctx.fillRect(cx + 2, cy - 6, 3, 4);
  }
  if (level >= 3) {
    ctx.fillRect(cx - 5, cy - 13, 3, 4);
    ctx.fillRect(cx + 2, cy - 13, 3, 4);
  }
}

export function renderRichStreet(ctx: CanvasRenderingContext2D, snap: RichStreetSnapshot): void {
  drawStudioBackdrop(ctx, '#0B0E14', 'rgba(255, 184, 0, 0.06)', 'rgba(255,255,255,0.025)', 48);

  // Thick 2.5D Monopoly board tabletop slab
  const boardSize = 650;
  const bLeft = 56;
  const bTop = Math.floor((ARENA_HEIGHT - boardSize) / 2);
  drawArenaSlab(ctx, bLeft - 10, bTop - 10, boardSize + 18, boardSize + 18, 18, 16, '#141B25', '#0D121A', '#334155', 3);

  // Board center recessed felt panel
  const cLeft = bLeft + boardSize / 7 + 8;
  const cTop = bTop + boardSize / 7 + 8;
  const cSize = (boardSize / 7) * 5 - 19;
  ctx.fillStyle = '#121E27';
  ctx.beginPath();
  ctx.roundRect(cLeft, cTop, cSize, cSize, 16);
  ctx.fill();
  ctx.strokeStyle = '#2B3647';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw all 24 3D beveled tiles (sorted top-to-bottom by row so overlap is seamless)
  const sortedTiles = [...snap.tiles].sort((a, b) => getRichTileRect(a.index).y - getRichTileRect(b.index).y);
  for (const t of sortedTiles) {
    const r = getRichTileRect(t.index);
    const isDecision = snap.phase === 'decision' && snap.decisionTileIndex === t.index;

    const tileTop = isDecision ? '#28364A' : '#1E2431';
    const tileBorder = isDecision ? '#FFB800' : t.ownerColor ?? '#344054';
    drawExtrudedBox3D(ctx, r.x, r.y, r.w, r.h, 5, 8, tileTop, '#111620', tileBorder, false);

    // Top color bar on lifted face (y - 5)
    ctx.fillStyle = t.groupColor;
    ctx.beginPath();
    ctx.roundRect(r.x + 3, r.y - 2, r.w - 6, 13, 5);
    ctx.fill();

    // Actual 3D extruded building on owned properties!
    if (t.level > 0) {
      drawPropertyBuilding3D(ctx, r.x + r.w - 18, r.y + 18, t.level, t.ownerColor ?? '#FFB800');
    }

    // Tile name
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shortName = tCanvas(t.name);
    ctx.fillText(shortName.slice(0, 12), r.x + r.w / 2, r.y + r.h * 0.56 - 5);

    // Price or rent tag
    if (t.kind === 'property') {
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = t.monopoly ? '#10D98B' : t.ownerColor ? '#FFB800' : '#94A3B8';
      const baseRent = t.level <= 1 ? t.baseRent : t.level === 2 ? Math.round(t.baseRent * 1.9) : Math.round(t.baseRent * 3.1);
      const rent = t.monopoly ? baseRent * 2 : baseRent;
      ctx.fillText(t.ownerId ? `R:$${rent}${t.monopoly ? '★' : ''}` : `$${t.price}`, r.x + r.w / 2, r.y + r.h - 16);
    } else if (t.kind === 'tax') {
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FF7A1A';
      ctx.fillText(`-$${t.baseRent}`, r.x + r.w / 2, r.y + r.h - 16);
    } else if (t.kind === 'jackpot') {
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#FFB800';
      ctx.fillText(`$${snap.jackpotPool}`, r.x + r.w / 2, r.y + r.h - 16);
    }
  }

  // Center table showcase: Title, Jackpot, 3D Twin Dice, Event Log
  const cx = cLeft + cSize / 2;
  const cy = cTop + cSize / 2;

  ctx.fillStyle = '#FFB800';
  ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(tCanvas('RICH STREET'), cx, cTop + 44);

  drawChip(ctx, cx, cTop + 68, `ROUND ${snap.round}/${snap.totalRounds} · POT $${snap.jackpotPool}`, '#FFB800', 'center');

  // 3D Twin Dice
  drawDie3D(ctx, cx - 44, cy - 20, 62, snap.dice[0], snap.diceRolling);
  drawDie3D(ctx, cx + 44, cy - 20, 62, snap.dice[1], snap.diceRolling);

  // Active turn / decision box inside center
  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  if (active) {
    ctx.fillStyle = 'rgba(13, 15, 20, 0.88)';
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

  // Draw 3D player pawn tokens on the board
  const tokenEntries = snap.players
    .map((p, idx) => ({ p, idx, pos: getRichVisualPos(p.visualTile) }))
    .filter((e) => !e.p.bankrupt)
    .sort((a, b) => a.pos.y - b.pos.y);

  for (const { p, idx, pos } of tokenEntries) {
    const ox = ((idx % 3) - 1) * 16;
    const oy = (Math.floor(idx / 3) - 0.5) * 16;
    const px = pos.x + ox;
    const py = pos.y + oy;

    if (p.id === snap.activePlayerId) {
      ctx.save();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(px, py - 4, 17 + Math.sin(performance.now() * 0.01) * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawCharacterPod3D(ctx, px, py - 4, 12, 0, p.colorHex, {
      height: 10,
      zHeight: pos.hopZ,
      rimColor: '#FFFFFF',
      showVisor: false,
    });

    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`P${p.slotIndex + 1}`, px, py - 14 - pos.hopZ);
    ctx.restore();
  }

  // Right-side Wealth Leaderboard 3D Panel
  const panelX = 740;
  const panelY = 36;
  const panelW = 418;
  const panelH = ARENA_HEIGHT - 74;
  drawArenaSlab(ctx, panelX, panelY, panelW, panelH, 16, 12, '#161B25', '#0D1017', '#2F384A', 2);

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

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFB800';
    ctx.font = '800 16px "JetBrains Mono", monospace';
    ctx.fillText(`$${p.netWorth}`, panelX + panelW - 28, ry + 28);

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
// 22. JUNGLE LADDERS (2.5D Carved Wood Board & 3D Ladders/Snakes)
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
  drawStudioBackdrop(ctx, '#0A120F', 'rgba(16, 217, 139, 0.08)', 'rgba(255,255,255,0.02)', 52);

  const cols = 10;
  const boardW = 730;
  const boardH = 640;
  const left = 46;
  const top = Math.floor((ARENA_HEIGHT - boardH) / 2);

  // Thick carved wooden 2.5D frame slab
  drawArenaSlab(ctx, left - 12, top - 12, boardW + 24, boardH + 24, 16, 18, '#233329', '#2E2014', '#4A6B56', 3.5);

  // Draw raised 3D numbered tiles
  for (let n = snap.targetTile; n >= 1; n--) {
    const c = getJungleTileCenter(n, snap.targetTile);
    const isMystery = snap.mysteryTiles.includes(n);
    const isGolden = (snap.goldenTiles ?? []).includes(n);
    const isGoal = n === snap.targetTile;
    const alt = ((n - 1) + Math.floor((n - 1) / cols)) % 2 === 0;

    const tileTop = isGoal ? '#59410E' : isGolden ? '#4A3910' : isMystery ? '#1E3C4F' : alt ? '#1E3529' : '#254133';
    const tileBorder = isGoal ? '#FFB800' : isGolden ? '#FDE047' : isMystery ? '#00C2FF' : '#355B47';

    drawExtrudedBox3D(
      ctx,
      c.x - c.w / 2 + 2,
      c.y - c.h / 2 + 2,
      c.w - 4,
      c.h - 4,
      4,
      6,
      tileTop,
      shadeHex(tileTop, -0.35),
      tileBorder,
      false
    );

    ctx.fillStyle = isGoal || isGolden ? '#FFB800' : isMystery ? '#7DD3FC' : 'rgba(241,245,249,0.78)';
    ctx.font = isGoal ? '800 15px "JetBrains Mono", monospace' : '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(n), c.x - c.w / 2 + 7, c.y - c.h / 2 + 2);

    if (isMystery) {
      ctx.fillStyle = '#00C2FF';
      ctx.font = '800 18px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', c.x, c.y + 1);
    } else if (isGolden && !isGoal) {
      ctx.fillStyle = '#FDE047';
      ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', c.x, c.y + 1);
    }

    if (snap.bananas.includes(n)) {
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c.x + 10, c.y + 5, 9, 0.2, Math.PI * 1.15);
      ctx.stroke();
    }
  }

  // Draw 3D bamboo ladders with cast shadows
  for (const lad of snap.ladders) {
    const a = getJungleTileCenter(lad.from, snap.targetTile);
    const b = getJungleTileCenter(lad.to, snap.targetTile);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = (-dy / len) * 9;
    const py = (dx / len) * 9;
    const rungs = Math.max(3, Math.floor(len / 24));

    ctx.save();
    ctx.lineCap = 'round';
    // Ladder shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.38)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(a.x + px + 4, a.y + py + 5);
    ctx.lineTo(b.x + px + 4, b.y + py + 5);
    ctx.moveTo(a.x - px + 4, a.y - py + 5);
    ctx.lineTo(b.x - px + 4, b.y - py + 5);
    ctx.stroke();

    // Bamboo side rails (lifted -4px)
    ctx.strokeStyle = '#D99B38';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(a.x + px, a.y + py - 4);
    ctx.lineTo(b.x + px, b.y + py - 4);
    ctx.moveTo(a.x - px, a.y - py - 4);
    ctx.lineTo(b.x - px, b.y - py - 4);
    ctx.stroke();

    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 3;
    for (let i = 1; i < rungs; i++) {
      const t = i / rungs;
      const rx = a.x + dx * t;
      const ry = a.y + dy * t - 4;
      ctx.beginPath();
      ctx.moveTo(rx + px, ry + py);
      ctx.lineTo(rx - px, ry - py);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw 3D shaded snakes with shadows and raised heads
  for (const sn of snap.snakes) {
    const head = getJungleTileCenter(sn.from, snap.targetTile);
    const tail = getJungleTileCenter(sn.to, snap.targetTile);
    const mx = (head.x + tail.x) / 2;
    const my = (head.y + tail.y) / 2;
    const perpX = -(tail.y - head.y) * 0.22;
    const perpY = (tail.x - head.x) * 0.22;

    ctx.save();
    ctx.lineCap = 'round';
    // Snake shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(head.x + 3, head.y + 4);
    ctx.bezierCurveTo(mx + perpX + 3, my + perpY + 4, mx - perpX + 3, my - perpY + 4, tail.x + 3, tail.y + 4);
    ctx.stroke();

    // Dark outline body
    ctx.strokeStyle = shadeHex(sn.colorHex, -0.45);
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(head.x, head.y - 3);
    ctx.bezierCurveTo(mx + perpX, my + perpY - 3, mx - perpX, my - perpY - 3, tail.x, tail.y - 3);
    ctx.stroke();

    // Bright upper ridge
    ctx.strokeStyle = sn.colorHex;
    ctx.lineWidth = 7;
    ctx.stroke();

    // 3D Snake head
    drawSphere3D(ctx, head.x, head.y, 11.5, sn.colorHex, '#FFFFFF', 6, true);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(head.x - 4, head.y - 9, 2.8, 0, Math.PI * 2);
    ctx.arc(head.x + 4, head.y - 9, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0D0F14';
    ctx.beginPath();
    ctx.arc(head.x - 4, head.y - 9, 1.3, 0, Math.PI * 2);
    ctx.arc(head.x + 4, head.y - 9, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw 3D player pawns
  const pawnList = snap.players.map((p, idx) => {
    let px = 0;
    let py = 0;
    let hopZ = 0;
    if (p.slideFrom !== null && p.slideTo !== null) {
      const c1 = getJungleTileCenter(p.slideFrom, snap.targetTile);
      const c2 = getJungleTileCenter(p.slideTo, snap.targetTile);
      px = c1.x + (c2.x - c1.x) * p.slideProgress;
      py = c1.y + (c2.y - c1.y) * p.slideProgress;
      hopZ = Math.sin(p.slideProgress * Math.PI) * 14;
    } else {
      const base = Math.floor(p.visualTile);
      const next = Math.min(snap.targetTile, base + 1);
      const frac = p.visualTile - base;
      const c1 = getJungleTileCenter(base, snap.targetTile);
      const c2 = getJungleTileCenter(next, snap.targetTile);
      px = c1.x + (c2.x - c1.x) * frac;
      py = c1.y + (c2.y - c1.y) * frac;
      hopZ = Math.sin(frac * Math.PI) * 16;
    }
    const ox = ((idx % 3) - 1) * 13;
    const oy = (Math.floor(idx / 3) - 0.5) * 12;
    return { p, px: px + ox, py: py + oy, hopZ };
  });
  pawnList.sort((a, b) => a.py - b.py);

  for (const { p, px, py, hopZ } of pawnList) {
    if (p.id === snap.activePlayerId) {
      ctx.save();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(px, py - 4, 16 + Math.sin(performance.now() * 0.01) * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (p.shielded) {
      ctx.save();
      ctx.strokeStyle = '#10D98B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py - 4 - hopZ, 19, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawCharacterPod3D(ctx, px, py - 4, 12, 0, p.colorHex, {
      height: 10,
      zHeight: hopZ,
      rimColor: '#FFFFFF',
      showVisor: false,
    });
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`P${p.slotIndex + 1}`, px, py - 14 - hopZ);
    ctx.restore();
  }

  // Right-side 3D Dice & Standings Panel
  const px = 804;
  const py = 38;
  const pw = 356;
  const ph = ARENA_HEIGHT - 76;
  drawArenaSlab(ctx, px, py, pw, ph, 16, 12, '#16231D', '#0D1512', '#2E473B', 2);

  ctx.fillStyle = '#10D98B';
  ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(tCanvas('JUNGLE LADDERS'), px + pw / 2, py + 36);

  // Giant 3D Die
  drawDie3D(ctx, px + pw / 2, py + 106, 78, snap.diceValue, snap.diceRolling);

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
    ctx.fillText(`#${p.tile}${p.shielded ? ' 🛡️' : ''}${p.trickReady ? ' ★' : ''}`, px + pw - 26, ry + 22);
    ctx.textAlign = 'center';
  });

  if (snap.banner) {
    drawCenterBanner(ctx, snap.banner, '#10D98B', 76);
  }
}

// ============================================================
// 25. COLOR MATCH DANCE (2.5D Extruded Disco Tiles)
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
    ctx.arc(0, 0, size * 0.82, 0.35 * Math.PI, 1.75 * Math.PI);
    ctx.arc(size * 0.32, -size * 0.1, size * 0.65, 1.65 * Math.PI, 0.45 * Math.PI, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function renderColorMatch(ctx: CanvasRenderingContext2D, snap: ColorMatchSnapshot): void {
  drawStudioBackdrop(ctx, '#090B12', 'rgba(82, 139, 255, 0.1)', 'rgba(255,255,255,0.03)', 56);

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

  // 2.5D Extruded Disco Tiles sorted top-to-bottom
  const tiles = [...snap.tiles].filter((t) => !t.dropped).sort((a, b) => a.y - b.y);
  for (const t of tiles) {
    const pal = MATCH_PALETTE[t.colorIndex] ?? MATCH_PALETTE[0];
    const shake = t.warning ? Math.sin(performance.now() * 0.06 + t.id) * 3 : 0;
    const depth = t.warning ? 6 : 12;

    ctx.save();
    ctx.globalAlpha = t.warning ? 0.68 : 0.96;
    drawExtrudedBox3D(
      ctx,
      t.x + shake,
      t.y,
      t.w,
      t.h,
      depth,
      12,
      pal.bg,
      shadeHex(pal.bg, -0.45),
      t.bonus ? '#FFB800' : pal.border
    );
    if (t.bonus) {
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(t.x + shake + 2, t.y + 2, t.w - 4, t.h - depth - 4, 10);
      ctx.stroke();
      ctx.fillStyle = '#FFB800';
      ctx.font = '800 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('2X', t.x + t.w + shake - 10, t.y + 18);
    }
    drawSymbol(ctx, t.symbol, t.x + t.w / 2 + shake, t.y + t.h / 2 - depth, 24, 'rgba(255,255,255,0.92)');
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

  // Center Orb pickup (Turbo Dance / Shock Ready)
  if (snap.orb) {
    const ob = snap.orb;
    const orbCol = ob.kind === 'speed' ? '#FFB800' : '#00C2FF';
    drawShadowOval(ctx, ob.x, ob.y + 12, 18, 7, 0.38);
    drawSphere3D(ctx, ob.x, ob.y, 17, orbCol, '#FFFFFF', 6, true);
    ctx.save();
    ctx.fillStyle = '#0D0F14';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ob.kind === 'speed' ? 'SPD' : 'SHK', ob.x, ob.y - 6);
    ctx.restore();
  }

  // Players (falling first, then Y-sorted)
  const dancers = [...snap.players]
    .filter((p) => p.alive)
    .sort((a, b) => {
      if (a.falling !== b.falling) return Number(b.falling) - Number(a.falling);
      return a.y - b.y;
    });

  for (const p of dancers) {
    const hopZ = p.hopTimer > 0 ? Math.sin((p.hopTimer / p.hopDuration) * Math.PI) * 26 : 0;
    const fallDrop = p.falling ? p.fallProgress * 50 : 0;
    const scale = p.falling ? Math.max(0.2, 1 - p.fallProgress * 0.8) : 1 + (hopZ > 0 ? 0.12 : 0);
    const hasSpeed = (p.speedTimer ?? 0) > 0 && !p.falling;

    if (hasSpeed) {
      ctx.save();
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y - 4, 27, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawCharacterPod3D(ctx, p.x, p.y - 6 + fallDrop, 19, 0, p.colorHex, {
      height: 11,
      zHeight: hopZ,
      scale,
      alpha: p.falling ? Math.max(0.15, 1 - p.fallProgress) : 1,
      rimColor: hasSpeed ? '#FFB800' : '#FFFFFF',
      showVisor: false,
    });

    if (!p.falling) {
      drawNameplate(ctx, p.x, p.y - hopZ - 42, p.slotIndex, p.name, p.colorHex);
    }
  }

  drawPopupTexts(ctx, snap.popups);

  if (snap.banner) {
    drawCenterBanner(ctx, snap.banner, targetCol.border, ARENA_HEIGHT / 2);
  }
}

// ============================================================
// 27. TREASURE ISLAND DIG (2.5D Raised Sandy Island & Crabs)
// ============================================================
export function renderTreasureDig(ctx: CanvasRenderingContext2D, snap: TreasureDigSnapshot): void {
  // Tropical turquoise ocean
  ctx.fillStyle = '#0A3E52';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  const tNow = performance.now() * 0.002;
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.2)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.roundRect(
      70 - i * 16 + Math.sin(tNow + i) * 6,
      56 - i * 12,
      ARENA_WIDTH - 140 + i * 32,
      ARENA_HEIGHT - 112 + i * 24,
      90
    );
    ctx.stroke();
  }

  // Thick 2.5D raised sandy island shelf with wet-sand cliff skirt
  drawArenaSlab(
    ctx,
    96,
    72,
    ARENA_WIDTH - 192,
    ARENA_HEIGHT - 150,
    72,
    22,
    '#DFB76F',
    '#8B6632',
    '#FDE68A',
    3
  );
  // Inner elevated dry-sand plateau
  drawArenaSlab(
    ctx,
    114,
    88,
    ARENA_WIDTH - 228,
    ARENA_HEIGHT - 182,
    60,
    8,
    '#ECC988',
    '#C49B54',
    'rgba(255,255,255,0.2)',
    1.5
  );

  // Sunken 3D Dug holes
  for (const h of snap.dugHoles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, h.alpha);
    // Dirt rim highlight
    ctx.fillStyle = '#B89152';
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 2, 24, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Recessed crater
    ctx.fillStyle = h.success ? '#4D3111' : '#856534';
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, 19, 12, 0, 0, Math.PI * 2);
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

  // Beach powerup pickups (Treasure Map & Gold Magnet)
  for (const pk of snap.pickups ?? []) {
    const col = pk.kind === 'map' ? '#FFB800' : '#00C2FF';
    drawShadowOval(ctx, pk.x, pk.y + 10, 15, 6, 0.35);
    drawSphere3D(ctx, pk.x, pk.y, 15, col, '#FFFFFF', 5, true);
    ctx.save();
    ctx.fillStyle = '#0D0F14';
    ctx.font = '800 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'map' ? 'MAP' : 'MAG', pk.x, pk.y - 5);
    ctx.restore();
  }

  // Y-sort Crabs and Hunters
  type DigItem =
    | { kind: 'crab'; y: number; c: (typeof snap.crabs)[number] }
    | { kind: 'player'; y: number; p: (typeof snap.players)[number] };
  const items: DigItem[] = [
    ...snap.crabs.map((c) => ({ kind: 'crab' as const, y: c.y, c })),
    ...snap.players.map((p) => ({ kind: 'player' as const, y: p.y, p })),
  ];
  items.sort((a, b) => a.y - b.y);

  for (const it of items) {
    if (it.kind === 'crab') {
      const { c } = it;
      const crabCol = c.stunTimer > 0 ? '#94A3B8' : '#EF4444';
      drawShadowOval(ctx, c.x + 2, c.y + 6, 19, 11, 0.36);
      ctx.save();
      ctx.translate(c.x, c.y - 3);
      // Shell thickness
      ctx.fillStyle = shadeHex(crabCol, -0.45);
      ctx.beginPath();
      ctx.ellipse(0, 4, 18, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Top shell
      ctx.fillStyle = crabCol;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Claws
      ctx.beginPath();
      ctx.arc(-16, -11, 6, 0, Math.PI * 2);
      ctx.arc(16, -11, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-6, -4, 3.2, 0, Math.PI * 2);
      ctx.arc(6, -4, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      const { p } = it;
      const hasMagnet = (p.magnetTimer ?? 0) > 0;
      ctx.save();
      const heatColor = p.heat > 0.75 ? '#FF4D2E' : p.heat > 0.42 ? '#FFB800' : '#00C2FF';
      const ringR = 28 + p.heat * 18 + Math.sin(performance.now() * (0.008 + p.heat * 0.02)) * 4;
      ctx.strokeStyle = heatColor;
      ctx.lineWidth = 3 + p.heat * 3;
      ctx.globalAlpha = 0.45 + p.heat * 0.55;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      if (hasMagnet) {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#00C2FF';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 44, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      drawCharacterPod3D(ctx, p.x, p.y, 19, 0, p.stunTimer > 0 ? '#64748B' : p.colorHex, {
        height: 11,
        rimColor: hasMagnet ? '#00C2FF' : '#FFFFFF',
        showVisor: false,
      });

      const tag = hasMagnet ? 'MAG' : p.heat > 0.76 ? 'HOT!' : undefined;
      drawNameplate(ctx, p.x, p.y - 40, p.slotIndex, p.name, p.colorHex, tag);
    }
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
// 29. LUCKY AUCTION (2.5D Velvet Stage, 3D Pedestal & Chest)
// ============================================================
export function renderLuckyAuction(ctx: CanvasRenderingContext2D, snap: LuckyAuctionSnapshot): void {
  drawStudioBackdrop(ctx, '#0F0D16', 'rgba(255, 184, 0, 0.16)', 'rgba(255,255,255,0.02)', 56);

  // Top round + timer HUD
  drawChip(
    ctx,
    ARENA_WIDTH / 2,
    18,
    `CHEST ${snap.round}/${snap.totalRounds} · ${Math.ceil(snap.timer)}s`,
    '#FFB800',
    'center'
  );
  const isDouble = (snap.multiplier ?? 1) > 1;
  if (isDouble) {
    drawChip(ctx, ARENA_WIDTH - 28, 18, '2X GOLDEN GAVEL', '#FFB800', 'right');
  }

  // 2.5D Extruded Cylindrical Center Stage Pedestal
  const cx = ARENA_WIDTH / 2;
  const cy = 248;
  drawShadowOval(ctx, cx, cy + 92, 178, 36, 0.55);
  if (isDouble) {
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, 24, cx, cy, 170);
    glow.addColorStop(0, 'rgba(255, 184, 0, 0.28)');
    glow.addColorStop(1, 'rgba(255, 184, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 170, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  // Pedestal side wall
  ctx.fillStyle = '#151221';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 84, 170, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 170, cy + 66, 340, 18);
  // Pedestal top disc
  ctx.fillStyle = isDouble ? '#332818' : '#252036';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 66, 170, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFB800';
  ctx.lineWidth = isDouble ? 4 : 3;
  ctx.stroke();
  ctx.restore();

  // 3D Mystery Chest or Revealed 3D Prize
  if (snap.phase === 'bidding') {
    const bob = Math.sin(performance.now() * 0.004) * 5;
    const chestColors = {
      royal: '#8B3314',
      wooden: '#7A4E28',
      mystery: '#4C247A',
      crystal: '#12598A',
    };
    const cCol = chestColors[snap.chestVisual];
    drawShadowOval(ctx, cx, cy + 64, 92, 18, 0.42);

    ctx.save();
    ctx.translate(cx, cy + bob);

    // 3D chest side/front depth
    drawExtrudedBox3D(ctx, -84, -46, 168, 96, 16, 14, cCol, shadeHex(cCol, -0.42), '#FFB800', true);

    // Domed chest lid bevel
    const lidGrad = ctx.createLinearGradient(-84, -68, 84, -22);
    lidGrad.addColorStop(0, shadeHex(cCol, 0.25));
    lidGrad.addColorStop(1, shadeHex(cCol, -0.25));
    ctx.fillStyle = lidGrad;
    ctx.beginPath();
    ctx.roundRect(-84, -68, 168, 44, 14);
    ctx.fill();
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Vertical & horizontal golden straps
    ctx.fillStyle = '#FFB800';
    ctx.fillRect(-84, -14, 168, 13);
    ctx.fillRect(-52, -68, 12, 118);
    ctx.fillRect(40, -68, 12, 118);

    // 3D Lock clasp
    drawExtrudedBox3D(ctx, -18, -22, 36, 36, 5, 8, '#1E1B12', '#0D0B07', '#FFB800', false);
    ctx.fillStyle = '#FFB800';
    ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, -9);
    ctx.restore();
  } else {
    // 3D Reveal prize!
    const now = performance.now() * 0.004;
    ctx.save();
    if (snap.revealedPrize === 'duck') {
      drawSphere3D(ctx, cx, cy + 12, 40, '#FACC15', '#FEF08A', 8, true);
      drawSphere3D(ctx, cx + 18, cy - 26, 23, '#FACC15', '#FEF08A', 10, false);
      ctx.fillStyle = '#FF7A1A';
      ctx.beginPath();
      ctx.ellipse(cx + 42, cy - 30, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(cx + 26, cy - 40, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const gemCol =
        snap.revealedPrize === 'diamond'
          ? '#38BDF8'
          : snap.revealedPrize === 'ruby'
            ? '#FF3B9A'
            : '#FFB800';
      drawSpinningGem3D(ctx, cx, cy, 52, gemCol, now, 12);
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 24px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`$${snap.revealedValue}`, cx, cy + 68);
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

  // Current Top Bid Display (3D beveled plaque)
  drawArenaSlab(
    ctx,
    cx - 210,
    354,
    420,
    68,
    14,
    8,
    '#141824',
    '#0B0D14',
    snap.highestBidderColor ?? '#334155',
    2.5
  );

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.fillText(tCanvas('CURRENT TOP BID'), cx, 376);

  ctx.fillStyle = snap.highestBidderColor ?? '#F8FAFC';
  ctx.font = '800 22px "JetBrains Mono", monospace';
  const topLabel = snap.highestBidderName
    ? `$${snap.highestBid} · ${snap.highestBidderName}`
    : tCanvas('NO BIDS YET — PRESS A!');
  ctx.fillText(topLabel, cx, 404);

  // 3D Raised Player Bidding Podiums across bottom
  const count = Math.max(1, snap.players.length);
  const cardW = Math.min(220, Math.floor((ARENA_WIDTH - 80 - (count - 1) * 14) / count));
  const totalW = count * cardW + (count - 1) * 14;
  const startX = (ARENA_WIDTH - totalW) / 2;

  snap.players.forEach((p, idx) => {
    const rx = startX + idx * (cardW + 14);
    const ry = 464;
    const isTop = snap.highestBidderId === p.id;
    const topFill = p.passed ? '#161922' : isTop ? '#242B3A' : '#1B202C';
    const borderCol = isTop ? p.colorHex : p.passed ? '#282E3A' : '#333D4F';
    drawArenaSlab(ctx, rx, ry, cardW, 204, 14, 12, topFill, '#0E1118', borderCol, isTop ? 3 : 1.5);

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

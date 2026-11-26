import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import type {
  CamelStackDerbySnapshot,
  CornerPolyominoSnapshot,
  GemEngineGuildSnapshot,
  HexInsectChessSnapshot,
  HexIslandSettlersSnapshot,
  MazeWallDuelSnapshot,
  MosaicTileDraftSnapshot,
  PillarAscent3dSnapshot,
  RouteExpressSnapshot,
  SecretRankFlagsSnapshot,
} from '../shared/packTabletopGemsTypes';
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
  shadeHex,
  tCanvas,
} from './packRenderHelpers';

const TILE_HEX: Record<'red' | 'blue' | 'gold' | 'green', string> = {
  red: '#FF4D2E',
  blue: '#00C2FF',
  gold: '#FFB800',
  green: '#10D98B',
};

function drawFooterBar(
  ctx: CanvasRenderingContext2D,
  players: { name: string; colorHex: string; score: number; badge?: string }[]
) {
  const count = Math.max(1, players.length);
  const w = Math.min(220, (ARENA_WIDTH - 80) / count - 10);
  const sx = (ARENA_WIDTH - (count * (w + 10) - 10)) / 2;
  players.forEach((p, i) => {
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
    ctx.fillText(`${Math.round(p.score)} PTS${p.badge ? ` · ${tCanvas(p.badge)}` : ''}`, x + w / 2, ARENA_HEIGHT - 30);
    ctx.restore();
  });
}

// 1. MOSAIC TILE DRAFT
export function renderMosaicTileDraft(ctx: CanvasRenderingContext2D, snap: MosaicTileDraftSnapshot): void {
  drawStudioBackdrop(ctx, '#0A1525', 'rgba(56,189,248,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 92, ARENA_WIDTH - 168, 220, 20, '#0F223A', '#38BDF8');

  // 4 Shared Factory Plates across top slab
  snap.factories.forEach((fac, idx) => {
    const px = 225 + idx * 250;
    const py = 200;
    drawShadowOval(ctx, px, py + 12, 82, 34, 0.35);
    ctx.save();
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(px, py, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`PLATE ${idx + 1}`, px, py - 52);
    ctx.restore();

    fac.tiles.forEach((t, ti) => {
      const tx = px + ((ti % 2) * 38 - 32);
      const ty = py + (Math.floor(ti / 2) * 38 - 32);
      drawExtrudedBox3D(ctx, tx, ty, 28, 28, 6, TILE_HEX[t], shadeHex(TILE_HEX[t], -0.35), 6);
    });

    const cursors = snap.players.filter((p) => p.factoryIdx === idx);
    cursors.forEach((p, ci) => {
      ctx.save();
      ctx.strokeStyle = p.colorHex;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px, py, 82 + ci * 7, 0, Math.PI * 2);
      ctx.stroke();
      drawNameplate(ctx, px, py + 92 + ci * 20, `${p.name} (${p.pickColor.toUpperCase()})`, p.colorHex);
      ctx.restore();
    });
  });

  // Player 5x5 Mosaic Mini-Boards
  const count = Math.max(1, snap.players.length);
  const bw = Math.min(180, (ARENA_WIDTH - 140) / count - 14);
  const sx = (ARENA_WIDTH - (count * (bw + 14) - 14)) / 2;
  const wallColors: ('red' | 'blue' | 'gold' | 'green')[] = ['red', 'blue', 'gold', 'green'];
  snap.players.forEach((p, i) => {
    const bx = sx + i * (bw + 14);
    const by = 350;
    drawArenaSlab(ctx, bx, by, bw, 228, 16, '#0F172A', p.colorHex);
    const cell = Math.floor((bw - 24) / 5);
    const ox = bx + (bw - cell * 5) / 2;
    const oy = by + 44;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const bit = r * 5 + c;
        const filled = (p.wallMask & (1 << bit)) !== 0;
        const col = TILE_HEX[wallColors[(r + c) % 4]];
        if (filled) {
          drawExtrudedBox3D(ctx, ox + c * cell + 2, oy + r * cell + 2, cell - 4, cell - 4, 5, col, shadeHex(col, -0.35), 4);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(ox + c * cell + 2, oy + r * cell + 2, cell - 4, cell - 4);
        }
      }
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name} · ${p.score}`, bx + bw / 2, by + 26);
  });

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · R${snap.round}`, '#38BDF8');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#38BDF8', 16);
}

// 2. MAZE WALL DUEL
export function renderMazeWallDuel(ctx: CanvasRenderingContext2D, snap: MazeWallDuelSnapshot): void {
  drawStudioBackdrop(ctx, '#18100A', 'rgba(245,158,11,0.16)', 'rgba(255,255,255,0.03)', 44);
  const bw = 510;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 96;
  const cell = bw / snap.size;
  drawArenaSlab(ctx, ox - 20, oy - 20, bw + 40, bw + 40, 20, '#292018', '#F59E0B');

  for (let r = 0; r < snap.size; r++) {
    for (let c = 0; c < snap.size; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#3E2F23' : '#32251B';
      ctx.beginPath();
      ctx.roundRect(ox + c * cell + 3, oy + r * cell + 3, cell - 6, cell - 6, 8);
      ctx.fill();
    }
  }

  // Goal edge highlights
  ctx.fillStyle = 'rgba(16, 217, 139, 0.22)';
  ctx.fillRect(ox, oy, bw, 8);
  ctx.fillStyle = 'rgba(255, 77, 46, 0.22)';
  ctx.fillRect(ox, oy + bw - 8, bw, 8);

  // Walls
  for (const w of snap.walls) {
    if (w.horizontal) {
      drawExtrudedBox3D(ctx, ox + w.c * cell + 4, oy + (w.r + 1) * cell - 5, cell * 2 - 8, 10, 6, w.ownerColor, shadeHex(w.ownerColor, -0.4), 4);
    } else {
      drawExtrudedBox3D(ctx, ox + (w.c + 1) * cell - 5, oy + w.r * cell + 4, 10, cell * 2 - 8, 6, w.ownerColor, shadeHex(w.ownerColor, -0.4), 4);
    }
  }

  // Players
  for (const p of snap.players) {
    const px = ox + (p.c + 0.5) * cell;
    const py = oy + (p.r + 0.5) * cell;
    drawCharacterPod3D(ctx, px, py, 22, p.colorHex, 0, p.wallMode ? 12 : 4);
    if (p.wallMode) {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3;
      ctx.strokeRect(px - 26, py - 26, 52, 52);
    }
    drawNameplate(ctx, px, py - 32, `${p.name} ${p.targetR === 0 ? '▲' : '▼'}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#F59E0B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F59E0B', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({
      name: p.name,
      colorHex: p.colorHex,
      score: p.score,
      badge: `${p.wallsLeft} WALLS`,
    }))
  );
}

// 3. CORNER POLYOMINO
export function renderCornerPolyomino(ctx: CanvasRenderingContext2D, snap: CornerPolyominoSnapshot): void {
  drawStudioBackdrop(ctx, '#091815', 'rgba(16,217,139,0.16)', 'rgba(255,255,255,0.03)', 44);
  const bw = 520;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 90;
  const cell = bw / snap.size;
  drawArenaSlab(ctx, ox - 18, oy - 18, bw + 36, bw + 36, 18, '#0F172A', '#10D98B');

  const slotColor = new Map(snap.players.map((p) => [p.slotIndex, p.colorHex]));
  for (let r = 0; r < snap.size; r++) {
    for (let c = 0; c < snap.size; c++) {
      const val = snap.cells[r * snap.size + c];
      const cx = ox + c * cell + 2;
      const cy = oy + r * cell + 2;
      if (val >= 0) {
        const col = slotColor.get(val) ?? '#10D98B';
        drawExtrudedBox3D(ctx, cx, cy, cell - 4, cell - 4, 5, col, shadeHex(col, -0.35), 5);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath();
        ctx.roundRect(cx, cy, cell - 4, cell - 4, 4);
        ctx.fill();
      }
    }
  }

  for (const p of snap.players) {
    const cx = ox + (p.c + 0.5) * cell;
    const cy = oy + (p.r + 0.5) * cell;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(ox + p.c * cell, oy + p.r * cell, cell, cell);
    drawNameplate(ctx, cx, cy - 26, `${p.name} · ${p.score}`, p.colorHex);
    ctx.restore();
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#10D98B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10D98B', 16);
}

// 4. 3D PILLAR ASCENT
export function renderPillarAscent3d(ctx: CanvasRenderingContext2D, snap: PillarAscent3dSnapshot): void {
  drawStudioBackdrop(ctx, '#0E132B', 'rgba(168,85,247,0.16)', 'rgba(255,255,255,0.03)', 44);
  const bw = 500;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 104;
  const cell = bw / snap.size;
  drawArenaSlab(ctx, ox - 20, oy - 20, bw + 40, bw + 40, 22, '#0B3B5A', '#38BDF8');

  for (let r = 0; r < snap.size; r++) {
    for (let c = 0; c < snap.size; c++) {
      const h = snap.heights[r * snap.size + c];
      const cx = ox + c * cell + 8;
      const cy = oy + r * cell + 8;
      const cw = cell - 16;
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, cw, 10);
      ctx.fill();
      for (let lvl = 1; lvl <= Math.min(3, h); lvl++) {
        const inset = lvl * 6;
        const topC = lvl === 3 ? '#FDE047' : '#F8FAFC';
        drawExtrudedBox3D(ctx, cx + inset, cy + inset - lvl * 7, cw - inset * 2, cw - inset * 2, 10, topC, '#94A3B8', 8);
      }
      if (h === 4) {
        drawSphere3D(ctx, cx + cw / 2, cy + cw / 2 - 22, cw * 0.28, '#2563EB', '#93C5FD');
      }
    }
  }

  for (const p of snap.players) {
    const h = snap.heights[p.r * snap.size + p.c];
    const px = ox + (p.c + 0.5) * cell;
    const py = oy + (p.r + 0.5) * cell - Math.min(3, h) * 8;
    drawCharacterPod3D(ctx, px, py, 20, p.colorHex, 0, 8);
    drawNameplate(ctx, px, py - 30, `${p.name} L${h}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#A855F7');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#A855F7', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.ascents} ★` }))
  );
}

// 5. CAMEL STACK DERBY
export function renderCamelStackDerby(ctx: CanvasRenderingContext2D, snap: CamelStackDerbySnapshot): void {
  drawStudioBackdrop(ctx, '#1F1509', 'rgba(255,184,0,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 64, 110, ARENA_WIDTH - 128, 430, 24, '#5C3A16', '#FFB800');

  const trackW = ARENA_WIDTH - 220;
  const sx = 110;
  const tileW = trackW / snap.trackLen;
  for (let i = 0; i < snap.trackLen; i++) {
    const tx = sx + i * tileW;
    const isFinish = i === snap.trackLen - 1;
    drawExtrudedBox3D(
      ctx,
      tx + 4,
      360,
      tileW - 8,
      78,
      10,
      isFinish ? '#FACC15' : i % 2 === 0 ? '#D97706' : '#B45309',
      '#78350F',
      10
    );
    ctx.fillStyle = isFinish ? '#14120B' : '#FEF3C7';
    ctx.font = '900 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(isFinish ? 'FINISH' : `${i + 1}`, tx + tileW / 2, 404);
  }

  const ordered = [...snap.camels].sort((a, b) => a.stackOrder - b.stackOrder);
  for (const c of ordered) {
    const cx = sx + c.space * tileW + tileW / 2;
    const cy = 336 - c.stackOrder * 34;
    drawExtrudedBox3D(ctx, cx - 22, cy - 14, 44, 28, 8, c.colorHex, shadeHex(c.colorHex, -0.35), 8);
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.name.split(' ')[0], cx, cy + 5);
  }

  if (snap.lastRollText) {
    drawHudChip(ctx, ARENA_WIDTH - 230, 22, snap.lastRollText, '#10D98B');
  }
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · LEG ${snap.leg}`, '#FFB800');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FFB800', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({
      name: p.name,
      colorHex: p.colorHex,
      score: p.score,
      badge: p.betColor ? `BET ${p.betColor.toUpperCase()}` : p.lastAction,
    }))
  );
}

// 6. ROUTE EXPRESS
export function renderRouteExpress(ctx: CanvasRenderingContext2D, snap: RouteExpressSnapshot): void {
  drawStudioBackdrop(ctx, '#091522', 'rgba(0,194,255,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 90, 92, ARENA_WIDTH - 180, 440, 24, '#0D2136', '#00C2FF');

  for (const r of snap.routes) {
    const a = snap.cities[r.from];
    const b = snap.cities[r.to];
    if (!a || !b) continue;
    ctx.save();
    ctx.lineWidth = r.ownerColor ? 14 : 9;
    ctx.strokeStyle = r.ownerColor ?? TILE_HEX[r.color];
    if (!r.ownerColor) ctx.setLineDash([16, 10]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + 44);
    ctx.lineTo(b.x, b.y + 44);
    ctx.stroke();
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 + 44;
    ctx.setLineDash([]);
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(mx, my, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = r.ownerColor ?? TILE_HEX[r.color];
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${r.len}`, mx, my);
    ctx.restore();
  }

  for (const c of snap.cities) {
    drawSphere3D(ctx, c.x, c.y + 44, 22, '#F8FAFC', '#38BDF8');
    drawNameplate(ctx, c.x, c.y + 12, c.name, '#00C2FF');
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#00C2FF');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#00C2FF', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({
      name: p.name,
      colorHex: p.colorHex,
      score: p.score,
      badge: `${p.routesClaimed} RAIL`,
    }))
  );
}

// 7. GEM ENGINE GUILD
export function renderGemEngineGuild(ctx: CanvasRenderingContext2D, snap: GemEngineGuildSnapshot): void {
  drawStudioBackdrop(ctx, '#180A1F', 'rgba(236,72,153,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 90, 96, ARENA_WIDTH - 180, 440, 24, '#241030', '#EC4899');

  const cols = 3;
  snap.market.forEach((m, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = 180 + col * 300;
    const y = 136 + row * 190;
    const accent = TILE_HEX[m.color];
    drawExtrudedBox3D(ctx, x, y, 240, 152, 10, '#1E1B4B', '#0F172A', 16);
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, 240, 152, 16);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = '900 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`TIER ${m.tier} · ${m.color.toUpperCase()}`, x + 18, y + 34);
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 32px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`+${m.pts} PTS`, x + 18, y + 86);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '800 15px "JetBrains Mono", monospace';
    ctx.fillText(`COST: ${m.cost} GEMS`, x + 18, y + 126);
    ctx.restore();
  });

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#EC4899');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EC4899', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({
      name: p.name,
      colorHex: p.colorHex,
      score: p.score,
      badge: `${p.gems}💎 ${p.discounts}D`,
    }))
  );
}

// 8. HEX ISLAND SETTLERS
function drawHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string, stroke: string) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

export function renderHexIslandSettlers(ctx: CanvasRenderingContext2D, snap: HexIslandSettlersSnapshot): void {
  drawStudioBackdrop(ctx, '#072235', 'rgba(34,197,94,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 110, 90, ARENA_WIDTH - 220, 480, 28, '#0C4A6E', '#38BDF8');

  const resColors: Record<string, string> = {
    wood: '#16A34A',
    brick: '#EA580C',
    ore: '#64748B',
    gold: '#EAB308',
  };
  const slotColor = new Map(snap.players.map((p) => [p.slotIndex, p.colorHex]));

  for (const h of snap.hexes) {
    const ownerCol = h.ownerSlot >= 0 ? slotColor.get(h.ownerSlot) ?? '#FFFFFF' : '#E2E8F0';
    drawHexagon(ctx, h.x, h.y, 92, resColors[h.resource], ownerCol);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(h.resource.toUpperCase(), h.x, h.y - 26);
    drawSphere3D(ctx, h.x, h.y + 6, 22, '#0F172A', '#FACC15');
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 18px "JetBrains Mono", monospace';
    ctx.fillText(`${h.rollNum}`, h.x, h.y + 12);
    if (h.ownerSlot >= 0) {
      drawExtrudedBox3D(ctx, h.x - 18, h.y + 36, 36, h.city ? 26 : 18, 6, ownerCol, shadeHex(ownerCol, -0.4), 5);
    }
  }

  snap.players.forEach((p, idx) => {
    const h = snap.hexes[p.cursorHex];
    if (!h) return;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 64 + idx * 6, 0, Math.PI * 2);
    ctx.stroke();
    drawNameplate(ctx, h.x, h.y - 54 - idx * 18, `${p.name} (${p.resources} RES)`, p.colorHex);
    ctx.restore();
  });

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · DICE ${snap.lastDice}`, '#22C55E');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#22C55E', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.resources} RES` }))
  );
}

// 9. HEX INSECT CHESS
export function renderHexInsectChess(ctx: CanvasRenderingContext2D, snap: HexInsectChessSnapshot): void {
  drawStudioBackdrop(ctx, '#181408', 'rgba(250,204,21,0.16)', 'rgba(255,255,255,0.03)', 44);
  const bw = 700;
  const bh = 460;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 104;
  drawArenaSlab(ctx, ox - 20, oy - 20, bw + 40, bh + 40, 22, '#29220C', '#FACC15');

  const cw = bw / snap.cols;
  const ch = bh / snap.rows;
  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const cx = ox + (c + 0.5) * cw + (r % 2 === 1 ? 14 : -14);
      const cy = oy + (r + 0.5) * ch;
      drawHexagon(ctx, cx, cy, 42, '#3F3515', 'rgba(250,204,21,0.35)');
    }
  }

  const bugEmoji: Record<string, string> = {
    queen: '👑',
    beetle: '🐞',
    hopper: '🦗',
    spider: '🕷',
  };
  for (const b of snap.bugs) {
    const cx = ox + (b.c + 0.5) * cw + (b.r % 2 === 1 ? 14 : -14);
    const cy = oy + (b.r + 0.5) * ch;
    drawSphere3D(ctx, cx, cy, 24, b.ownerColor, '#FFFFFF');
    ctx.font = '900 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bugEmoji[b.kind] ?? '●', cx, cy + 1);
  }

  for (const p of snap.players) {
    const cx = ox + (p.c + 0.5) * cw + (p.r % 2 === 1 ? 14 : -14);
    const cy = oy + (p.r + 0.5) * ch;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.stroke();
    drawNameplate(ctx, cx, cy - 40, `${p.name} · ${p.pickBug.toUpperCase()}`, p.colorHex);
    ctx.restore();
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#FACC15');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FACC15', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: p.pickBug.toUpperCase() }))
  );
}

// 10. SECRET RANK FLAGS
export function renderSecretRankFlags(ctx: CanvasRenderingContext2D, snap: SecretRankFlagsSnapshot): void {
  drawStudioBackdrop(ctx, '#180B0E', 'rgba(239,68,68,0.16)', 'rgba(255,255,255,0.03)', 44);
  const bw = 680;
  const bh = 440;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 104;
  drawArenaSlab(ctx, ox - 18, oy - 18, bw + 36, bh + 36, 20, '#1E151B', '#EF4444');

  const cw = bw / snap.cols;
  const ch = bh / snap.rows;
  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#2C1F27' : '#23181F';
      ctx.beginPath();
      ctx.roundRect(ox + c * cw + 4, oy + r * ch + 4, cw - 8, ch - 8, 10);
      ctx.fill();
    }
  }

  for (const u of snap.pieces) {
    const cx = ox + (u.c + 0.5) * cw;
    const cy = oy + (u.r + 0.5) * ch;
    drawExtrudedBox3D(ctx, cx - 36, cy - 30, 72, 54, 8, u.ownerColor, shadeHex(u.ownerColor, -0.4), 10);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(u.revealedRank ? u.revealedRank.slice(0, 7).toUpperCase() : 'SECRET', cx, cy - 3);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#EF4444');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EF4444', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({
      name: p.name,
      colorHex: p.colorHex,
      score: p.score,
      badge: `${p.flagsCaptured} 🚩`,
    }))
  );
}

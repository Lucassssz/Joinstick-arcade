import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type CarromArenaSnapshot,
  type DungeonCrawlBoardSnapshot,
  type NavalSalvoSnapshot,
  type NeonCheckersSnapshot,
} from '../shared/types';
import { drawNameplate, drawPopupTexts, tCanvas } from './renderers';
import {
  drawArenaSlab,
  drawCharacterPod3D,
  drawDie3D,
  drawExtrudedCylinder3D,
  drawSphere3D,
  drawSpinningGem3D,
  drawStudioBackdrop,
  shadeHex,
} from './render25d';
import { getMotionTime, getSpringBannerAnim } from './arcadeMotion';

function drawBoardChip(
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
  const w = Math.max(96, ctx.measureText(label).width + 22);
  const h = 28;
  const rx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  ctx.fillStyle = 'rgba(13, 15, 20, 0.9)';
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

function drawBoardBanner(
  ctx: CanvasRenderingContext2D,
  text: string | null,
  eventText: string | null,
  accent = '#FFB800'
): void {
  if (eventText) {
    drawBoardChip(ctx, ARENA_WIDTH / 2, ARENA_HEIGHT - 44, eventText, accent);
  }
  if (!text) return;
  const label = tCanvas(text);
  const anim = getSpringBannerAnim(`bB:${accent}`, text);
  ctx.save();
  ctx.translate(ARENA_WIDTH / 2, 74);
  ctx.scale(anim.scale, anim.scale);
  ctx.globalAlpha = anim.alpha;
  ctx.font = '900 22px "Plus Jakarta Sans", sans-serif';
  const w = Math.max(280, ctx.measureText(label).width + 48);
  ctx.fillStyle = 'rgba(13, 15, 20, 0.94)';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -24, w, 48, 12);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

// ============================================================
// 39. BATTLESHIP SALVO (8x6 Radar Grid Sea Warfare)
// ============================================================
export function renderNavalSalvo(
  ctx: CanvasRenderingContext2D,
  snap: NavalSalvoSnapshot
): void {
  drawStudioBackdrop(ctx, '#03121E', 'rgba(0, 194, 255, 0.14)', 'rgba(16, 185, 129, 0.06)', 44);

  const cellSize = 68;
  const gridW = snap.cols * cellSize;
  const gridH = snap.rows * cellSize;
  const left = (ARENA_WIDTH - gridW) / 2;
  const top = (ARENA_HEIGHT - gridH) / 2 + 16;
  const t = getMotionTime();

  drawArenaSlab(ctx, left - 20, top - 20, gridW + 40, gridH + 40, 22, 16, '#0A3656', '#062338', '#00C2FF');

  for (const cell of snap.cells) {
    const x = left + cell.col * cellSize;
    const y = top + cell.row * cellSize;
    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;

    ctx.save();
    ctx.fillStyle = cell.revealed
      ? cell.content === 'flagship'
        ? 'rgba(255, 184, 0, 0.25)'
        : cell.content === 'ship'
        ? 'rgba(255, 77, 46, 0.24)'
        : cell.content === 'mine'
        ? 'rgba(239, 68, 68, 0.26)'
        : 'rgba(14, 116, 144, 0.22)'
      : 'rgba(7, 42, 64, 0.85)';
    ctx.strokeStyle = cell.hitByColor || 'rgba(0, 194, 255, 0.32)';
    ctx.lineWidth = cell.revealed ? 2.2 : 1.4;
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, cellSize - 6, cellSize - 6, 10);
    ctx.fill();
    ctx.stroke();

    if (cell.revealed) {
      ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (cell.content === 'flagship') {
        drawSpinningGem3D(ctx, cx, cy, 16, '#FFB800', t * 3 + cell.col);
      } else if (cell.content === 'ship') {
        drawSphere3D(ctx, cx, cy, 16, '#FF4D2E', '#FFB800');
      } else if (cell.content === 'mine') {
        drawSphere3D(ctx, cx, cy, 14, '#EF4444', '#1F2937');
      } else {
        ctx.fillStyle = 'rgba(125, 211, 252, 0.55)';
        ctx.fillText('•', cx, cy);
      }
    } else if (cell.sonarHint !== null) {
      ctx.fillStyle = '#00E5A3';
      ctx.font = '900 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`📡${cell.sonarHint}`, cx, cy);
    }
    ctx.restore();
  }

  for (const exp of snap.explosions) {
    const cx = left + (exp.col + 0.5) * cellSize;
    const cy = top + (exp.row + 0.5) * cellSize;
    ctx.save();
    ctx.globalAlpha = Math.max(0, exp.alpha);
    ctx.strokeStyle = exp.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, (1 - exp.alpha) * 48 + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  if (active) {
    const cx = left + (active.cursorCol + 0.5) * cellSize;
    const cy = top + (active.cursorRow + 0.5) * cellSize;
    ctx.save();
    ctx.strokeStyle = active.colorHex;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy);
    ctx.lineTo(cx + 22, cy);
    ctx.moveTo(cx, cy - 22);
    ctx.lineTo(cx, cy + 22);
    ctx.stroke();
    ctx.restore();
  }

  drawBoardChip(
    ctx,
    ARENA_WIDTH / 2 - 140,
    18,
    `FLEET HULLS LEFT: ${snap.shipsRemaining}`,
    '#00C2FF'
  );
  drawBoardChip(
    ctx,
    ARENA_WIDTH / 2 + 140,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'BATTLESHIP SALVO',
    active?.colorHex || '#FFB800'
  );

  drawBoardBanner(ctx, snap.banner, snap.eventText, active?.colorHex || '#00C2FF');
}

// ============================================================
// 40. KING JUMP CHECKERS (8x8 Arcade Draughts)
// ============================================================
export function renderNeonCheckers(
  ctx: CanvasRenderingContext2D,
  snap: NeonCheckersSnapshot
): void {
  drawStudioBackdrop(ctx, '#120C1F', 'rgba(236, 72, 153, 0.14)', 'rgba(255, 184, 0, 0.05)', 44);

  const cellSize = 54;
  const boardW = 8 * cellSize;
  const boardH = 8 * cellSize;
  const left = (ARENA_WIDTH - boardW) / 2;
  const top = (ARENA_HEIGHT - boardH) / 2 + 14;

  drawArenaSlab(ctx, left - 20, top - 20, boardW + 40, boardH + 40, 20, 16, '#312E81', '#1E1B4B', '#EC4899');

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const x = left + c * cellSize;
      const y = top + r * cellSize;
      ctx.save();
      ctx.fillStyle = (r + c) % 2 === 1 ? '#1E1638' : '#3B2F63';
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.restore();
    }
  }

  // Highlight selected & available moves
  snap.availableMoves.forEach((mv, idx) => {
    const isSel = idx === snap.selectedMoveIndex;
    const fx = left + (mv.fromCol + 0.5) * cellSize;
    const fy = top + (mv.fromRow + 0.5) * cellSize;
    const tx = left + (mv.toCol + 0.5) * cellSize;
    const ty = top + (mv.toRow + 0.5) * cellSize;

    ctx.save();
    ctx.strokeStyle = isSel ? '#FFB800' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = isSel ? 4 : 2;
    if (!isSel) ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    ctx.fillStyle = isSel ? 'rgba(255, 184, 0, 0.35)' : 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.arc(tx, ty, isSel ? 18 : 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  // Render Checkers Pieces
  for (const pc of snap.pieces) {
    const cx = left + (pc.col + 0.5) * cellSize;
    const cy = top + (pc.row + 0.5) * cellSize;
    drawExtrudedCylinder3D(
      ctx,
      cx,
      cy + 6,
      cellSize * 0.36,
      pc.king ? 14 : 9,
      pc.colorHex,
      shadeHex(pc.colorHex, -0.35)
    );
    if (pc.king) {
      ctx.save();
      ctx.fillStyle = '#FFFBEB';
      ctx.font = '900 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑', cx, cy - 8);
      ctx.restore();
    }
  }

  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  drawBoardChip(ctx, ARENA_WIDTH / 2 - 140, 18, `TURN ${snap.turnCount}/${snap.maxTurns}`, '#EC4899');
  drawBoardChip(
    ctx,
    ARENA_WIDTH / 2 + 140,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'KING JUMP CHECKERS',
    active?.colorHex || '#FFB800'
  );

  drawBoardBanner(ctx, snap.banner, snap.eventText, active?.colorHex || '#EC4899');
}

// ============================================================
// 41. CARROM STRIKER (Tabletop Flick & Pocket Board)
// ============================================================
export function renderCarromArena(
  ctx: CanvasRenderingContext2D,
  snap: CarromArenaSnapshot
): void {
  drawStudioBackdrop(ctx, '#1A110A', 'rgba(245, 158, 11, 0.16)', 'rgba(255, 255, 255, 0.04)', 44);

  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 12;
  const half = 235;

  // Hardwood Carrom Board Frame
  drawArenaSlab(
    ctx,
    cx - half - 22,
    cy - half - 22,
    (half + 22) * 2,
    (half + 22) * 2,
    26,
    18,
    '#D97706',
    '#451A03',
    '#FBBF24'
  );

  // Inner smooth maple playing surface
  ctx.save();
  ctx.fillStyle = '#FEF3C7';
  ctx.beginPath();
  ctx.roundRect(cx - half, cy - half, half * 2, half * 2, 16);
  ctx.fill();

  // Center Carrom Mandala Circle & Baseline
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 58, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 145, cy + half - 46);
  ctx.lineTo(cx + 145, cy + half - 46);
  ctx.stroke();
  ctx.restore();

  // 4 Corner Pockets
  for (const pk of snap.pockets) {
    ctx.save();
    ctx.fillStyle = '#090D16';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  // Aiming Laser Guide during 'aiming' phase
  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  if (snap.phase === 'aiming' && active) {
    ctx.save();
    ctx.strokeStyle = active.colorHex;
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(snap.striker.x, snap.striker.y);
    ctx.lineTo(
      snap.striker.x + Math.cos(active.aimAngle) * 195,
      snap.striker.y + Math.sin(active.aimAngle) * 195
    );
    ctx.stroke();
    ctx.restore();
  }

  // Pucks (Gold, Silver, Red Queen)
  for (const puck of snap.pucks) {
    const hex =
      puck.kind === 'queen'
        ? '#FF3B9A'
        : puck.kind === 'gold'
        ? '#F59E0B'
        : '#64748B';
    drawExtrudedCylinder3D(ctx, puck.x, puck.y + 4, puck.r, 8, hex, shadeHex(hex, -0.35));
  }

  // Heavy Striker Disc
  drawExtrudedCylinder3D(
    ctx,
    snap.striker.x,
    snap.striker.y + 5,
    snap.striker.r,
    10,
    snap.striker.colorHex,
    shadeHex(snap.striker.colorHex, -0.35)
  );

  drawBoardChip(ctx, ARENA_WIDTH / 2 - 140, 18, `ROUND ${snap.round}/${snap.totalRounds}`, '#F59E0B');
  drawBoardChip(
    ctx,
    ARENA_WIDTH / 2 + 140,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'CARROM STRIKER',
    active?.colorHex || '#FFB800'
  );

  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, snap.banner, snap.eventText, active?.colorHex || '#F59E0B');
}

// ============================================================
// 42. DUNGEON QUEST BOARD (20-Tile Spiral RPG Adventure)
// ============================================================
export function renderDungeonCrawlBoard(
  ctx: CanvasRenderingContext2D,
  snap: DungeonCrawlBoardSnapshot
): void {
  drawStudioBackdrop(ctx, '#0F0A1C', 'rgba(139, 92, 246, 0.16)', 'rgba(255, 77, 46, 0.08)', 44);

  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 16;

  drawArenaSlab(ctx, cx - 455, cy - 260, 910, 520, 28, 18, '#251B42', '#17112B', '#8B5CF6');

  // Spiral Stone Path connecting tiles
  ctx.save();
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.35)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  snap.tiles.forEach((t, idx) => {
    if (idx === 0) ctx.moveTo(t.x, t.y);
    else ctx.lineTo(t.x, t.y);
  });
  ctx.stroke();
  ctx.restore();

  const kindColor: Record<string, string> = {
    start: '#3B82F6',
    monster: '#EF4444',
    chest: '#F59E0B',
    camp: '#10B981',
    trap: '#9333EA',
    boss: '#FF4D2E',
  };

  for (const tile of snap.tiles) {
    const isBoss = tile.kind === 'boss';
    const hex = kindColor[tile.kind] || '#64748B';
    drawExtrudedCylinder3D(
      ctx,
      tile.x,
      tile.y,
      isBoss ? 44 : 26,
      isBoss ? 20 : 12,
      hex,
      shadeHex(hex, -0.35)
    );

    ctx.save();
    ctx.font = isBoss ? '900 12px "Plus Jakarta Sans", sans-serif' : '800 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isBoss ? `🐉 BOSS ♥${snap.bossHp}` : tCanvas(tile.name),
      tile.x,
      tile.y - (isBoss ? 20 : 12)
    );
    ctx.restore();
  }

  // Top-right 3D Dice Indicator
  drawDie3D(ctx, ARENA_WIDTH - 96, 86, 44, snap.combatRoll ?? snap.diceValue, snap.diceRolling);

  // Players on Dungeon Tiles
  snap.players.forEach((p, idx) => {
    const tile = snap.tiles[p.tileIndex] || snap.tiles[0];
    const ox = ((idx % 2) - 0.5) * 20;
    const oy = (Math.floor(idx / 2) - 0.5) * 18 - 14;
    drawCharacterPod3D(ctx, tile.x + ox, tile.y + oy, 17, 0, p.colorHex, {
      playerId: p.id,
      flash: p.id === snap.activePlayerId ? 0.35 : 0,
    });
    drawNameplate(
      ctx,
      tile.x + ox,
      tile.y + oy - 28,
      p.slotIndex,
      p.name,
      p.colorHex,
      `♥${p.hp} · ${p.gold}G`
    );
  });

  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  drawBoardChip(
    ctx,
    ARENA_WIDTH / 2 - 145,
    18,
    `ROUND ${snap.round}/${snap.totalRounds} · BOSS ♥${snap.bossHp}/${snap.bossMaxHp}`,
    '#FF4D2E'
  );
  drawBoardChip(
    ctx,
    ARENA_WIDTH / 2 + 145,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'DUNGEON QUEST',
    active?.colorHex || '#FFB800'
  );

  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, snap.banner, snap.eventText, active?.colorHex || '#8B5CF6');
}

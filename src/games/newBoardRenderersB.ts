import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type CarromArenaSnapshot,
  type DungeonCrawlBoardSnapshot,
  type NavalSalvoSnapshot,
  type NeonCheckersSnapshot,
} from '../shared/types';
import {
  drawBoardBanner,
  drawHudChip,
  drawNameplate,
  drawPopupTexts,
  tCanvas,
} from './canvasHelpers';
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
import { getMotionTime } from './arcadeMotion';

// ============================================================
// 39. BATTLESHIP SALVO (8x6 Tactical Radar Sea Warfare)
// ============================================================
export function renderNavalSalvo(
  ctx: CanvasRenderingContext2D,
  snap: NavalSalvoSnapshot
): void {
  drawStudioBackdrop(ctx, '#03121E', 'rgba(0, 194, 255, 0.16)', 'rgba(16, 185, 129, 0.06)', 44);

  const cellSize = 66;
  const gridW = snap.cols * cellSize;
  const gridH = snap.rows * cellSize;
  const left = (ARENA_WIDTH - gridW) / 2 - 30;
  const top = (ARENA_HEIGHT - gridH) / 2 + 16;
  const t = getMotionTime();

  drawArenaSlab(ctx, left - 26, top - 26, gridW + 52, gridH + 52, 22, 16, '#0A3656', '#062338', '#00C2FF');

  // Sweeping tactical radar beam clipped inside sonar grid
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left, top, gridW, gridH, 10);
  ctx.clip();
  const rcx = left + gridW / 2;
  const rcy = top + gridH / 2;
  const sweepAngle = t * 1.1;
  ctx.fillStyle = 'rgba(0, 229, 163, 0.08)';
  ctx.beginPath();
  ctx.moveTo(rcx, rcy);
  ctx.arc(rcx, rcy, gridW * 0.75, sweepAngle, sweepAngle + 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Coordinate Axis Labels (A-H, 1-6)
  ctx.save();
  ctx.fillStyle = 'rgba(125, 211, 252, 0.75)';
  ctx.font = '800 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let c = 0; c < snap.cols; c++) {
    ctx.fillText(String.fromCharCode(65 + c), left + (c + 0.5) * cellSize, top - 12);
  }
  for (let r = 0; r < snap.rows; r++) {
    ctx.fillText(`${r + 1}`, left - 14, top + (r + 0.5) * cellSize);
  }
  ctx.restore();

  for (const cell of snap.cells) {
    const x = left + cell.col * cellSize;
    const y = top + cell.row * cellSize;
    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;

    ctx.save();
    ctx.fillStyle = cell.revealed
      ? cell.content === 'flagship'
        ? 'rgba(255, 184, 0, 0.28)'
        : cell.content === 'ship'
        ? 'rgba(255, 77, 46, 0.26)'
        : cell.content === 'mine'
        ? 'rgba(239, 68, 68, 0.28)'
        : 'rgba(14, 116, 144, 0.24)'
      : 'rgba(7, 42, 64, 0.85)';
    ctx.strokeStyle = cell.hitByColor || 'rgba(0, 194, 255, 0.34)';
    ctx.lineWidth = cell.revealed ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, cellSize - 6, cellSize - 6, 10);
    ctx.fill();
    ctx.stroke();

    if (cell.revealed) {
      if (cell.content === 'flagship') {
        drawSpinningGem3D(ctx, cx, cy, 17, '#FFB800', t * 3 + cell.col);
      } else if (cell.content === 'ship') {
        drawSphere3D(ctx, cx, cy, 16, '#FF4D2E', '#FFB800');
      } else if (cell.content === 'mine') {
        drawSphere3D(ctx, cx, cy, 14, '#EF4444', '#1F2937');
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕', cx, cy);
      } else {
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.stroke();
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
    // 3x3 Sonar scan zone subtle outline if sonar ready
    if (active.sonarCharges > 0) {
      ctx.strokeStyle = 'rgba(0, 229, 163, 0.35)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        left + Math.max(0, active.cursorCol - 1) * cellSize + 2,
        top + Math.max(0, active.cursorRow - 1) * cellSize + 2,
        Math.min(3, snap.cols - Math.max(0, active.cursorCol - 1)) * cellSize - 4,
        Math.min(3, snap.rows - Math.max(0, active.cursorRow - 1)) * cellSize - 4
      );
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = active.colorHex;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.42 + Math.sin(t * 9) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy);
    ctx.lineTo(cx + 24, cy);
    ctx.moveTo(cx, cy - 24);
    ctx.lineTo(cx, cy + 24);
    ctx.stroke();
    ctx.restore();
  }

  // Right-side Fleet Scoreboard
  snap.players.forEach((p, idx) => {
    const y = 140 + idx * 46;
    drawHudChip(
      ctx,
      ARENA_WIDTH - 24,
      y,
      `P${p.slotIndex + 1} ${p.name}: ${p.score}pt (${p.hits}H)`,
      p.id === snap.activePlayerId ? '#FFB800' : p.colorHex,
      'right'
    );
  });

  drawHudChip(ctx, ARENA_WIDTH / 2 - 150, 18, `FLEET HULLS LEFT: ${snap.shipsRemaining}`, '#00C2FF');
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 + 145,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'BATTLESHIP SALVO',
    active?.colorHex || '#FFB800'
  );

  drawBoardBanner(ctx, 'naval-banner', snap.banner, snap.eventText, active?.colorHex || '#00C2FF');
}

// ============================================================
// 40. KING JUMP CHECKERS (8x8 Arcade Draughts)
// ============================================================
export function renderNeonCheckers(
  ctx: CanvasRenderingContext2D,
  snap: NeonCheckersSnapshot
): void {
  drawStudioBackdrop(ctx, '#120C1F', 'rgba(236, 72, 153, 0.16)', 'rgba(255, 184, 0, 0.06)', 44);

  const cellSize = 54;
  const boardW = 8 * cellSize;
  const boardH = 8 * cellSize;
  const left = (ARENA_WIDTH - boardW) / 2;
  const top = (ARENA_HEIGHT - boardH) / 2 + 14;
  const t = getMotionTime();

  drawArenaSlab(ctx, left - 22, top - 22, boardW + 44, boardH + 44, 20, 16, '#312E81', '#1E1B4B', '#EC4899');

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const x = left + c * cellSize;
      const y = top + r * cellSize;
      ctx.save();
      ctx.fillStyle = (r + c) % 2 === 1 ? '#1B1433' : '#3E3269';
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.restore();
    }
  }

  // Last move ghost trail
  if (snap.lastMove) {
    ctx.save();
    ctx.strokeStyle = `${snap.lastMove.colorHex}55`;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(left + (snap.lastMove.fromCol + 0.5) * cellSize, top + (snap.lastMove.fromRow + 0.5) * cellSize);
    ctx.lineTo(left + (snap.lastMove.toCol + 0.5) * cellSize, top + (snap.lastMove.toRow + 0.5) * cellSize);
    ctx.stroke();
    ctx.restore();
  }

  // Highlight available & selected moves (Gold = Capture Jump, Cyan = Slide)
  snap.availableMoves.forEach((mv, idx) => {
    const isSel = idx === snap.selectedMoveIndex;
    const fx = left + (mv.fromCol + 0.5) * cellSize;
    const fy = top + (mv.fromRow + 0.5) * cellSize;
    const tx = left + (mv.toCol + 0.5) * cellSize;
    const ty = top + (mv.toRow + 0.5) * cellSize;
    const strokeCol = mv.isJump ? '#FFB800' : isSel ? '#00E5FF' : 'rgba(255, 255, 255, 0.3)';

    ctx.save();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = isSel ? 4.5 : 2;
    if (!isSel) ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.stroke();

    ctx.fillStyle = isSel
      ? mv.isJump
        ? 'rgba(255, 184, 0, 0.35)'
        : 'rgba(0, 229, 255, 0.28)'
      : 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(tx, ty, isSel ? 18 + Math.sin(t * 8) * 2 : 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Highlight selected source piece ring
    if (isSel) {
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(fx, fy, 22 + Math.sin(t * 8) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });

  // Render 3D Checkers Pieces
  for (const pc of snap.pieces) {
    const cx = left + (pc.col + 0.5) * cellSize;
    const cy = top + (pc.row + 0.5) * cellSize;
    if (pc.shielded) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
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

  // Side Standings
  snap.players.forEach((p, idx) => {
    const y = 140 + idx * 46;
    drawHudChip(
      ctx,
      ARENA_WIDTH - 24,
      y,
      `P${p.slotIndex + 1} ${p.name}: ${p.piecesCount}P · ${p.captures}KO`,
      p.id === snap.activePlayerId ? '#FFB800' : p.colorHex,
      'right'
    );
  });

  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  drawHudChip(ctx, ARENA_WIDTH / 2 - 145, 18, `TURN ${snap.turnCount}/${snap.maxTurns}`, '#EC4899');
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 + 145,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'KING JUMP CHECKERS',
    active?.colorHex || '#FFB800'
  );

  drawBoardBanner(ctx, 'checkers-banner', snap.banner, snap.eventText, active?.colorHex || '#EC4899');
}

// ============================================================
// 41. CARROM STRIKER (Tabletop Flick & Pocket Board)
// ============================================================
export function renderCarromArena(
  ctx: CanvasRenderingContext2D,
  snap: CarromArenaSnapshot
): void {
  drawStudioBackdrop(ctx, '#1A110A', 'rgba(245, 158, 11, 0.18)', 'rgba(255, 255, 255, 0.04)', 44);

  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 12;
  const half = 235;
  const t = getMotionTime();

  // Hardwood Carrom Board Frame
  drawArenaSlab(
    ctx,
    cx - half - 22,
    cy - half - 22,
    (half + 22) * 2,
    (half + 22) * 2,
    26,
    18,
    '#B45309',
    '#451A03',
    '#FBBF24'
  );

  // Inner polished maple playing surface
  ctx.save();
  ctx.fillStyle = '#FEF3C7';
  ctx.beginPath();
  ctx.roundRect(cx - half, cy - half, half * 2, half * 2, 16);
  ctx.fill();

  // Decorative diagonal pocket guide lines & center Carrom mandala
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.stroke();

  // Baseline rail with red end circles
  const baseY = cy + half - 46;
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.65)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 145, baseY);
  ctx.lineTo(cx + 145, baseY);
  ctx.stroke();
  for (const bx of [cx - 145, cx + 145]) {
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(bx, baseY, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 4 Corner Pockets
  for (const pk of snap.pockets) {
    ctx.save();
    ctx.fillStyle = '#090D16';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }

  // High-visibility Laser Aiming Ray + Arrowhead during 'aiming' phase
  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  if (snap.phase === 'aiming' && active) {
    const rayLen = 225;
    const ex = snap.striker.x + Math.cos(active.aimAngle) * rayLen;
    const ey = snap.striker.y + Math.sin(active.aimAngle) * rayLen;
    ctx.save();
    ctx.strokeStyle = active.colorHex;
    ctx.lineWidth = 3.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(snap.striker.x, snap.striker.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    // Arrowhead
    ctx.fillStyle = active.colorHex;
    ctx.translate(ex, ey);
    ctx.rotate(active.aimAngle);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Pucks (Gold 20pt, Silver 10pt, Red Queen 50pt)
  for (const puck of snap.pucks) {
    const hex =
      puck.kind === 'queen'
        ? '#FF3B9A'
        : puck.kind === 'gold'
        ? '#F59E0B'
        : '#475569';
    drawExtrudedCylinder3D(ctx, puck.x, puck.y + 4, puck.r, 8, hex, shadeHex(hex, -0.38));
    if (puck.kind === 'queen') {
      ctx.save();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(puck.x, puck.y - 4, puck.r - 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Heavy Striker Disc
  if (snap.striker.spin) {
    ctx.save();
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(snap.striker.x, snap.striker.y, snap.striker.r + 5 + Math.sin(t * 14) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  drawExtrudedCylinder3D(
    ctx,
    snap.striker.x,
    snap.striker.y + 5,
    snap.striker.r,
    10,
    snap.striker.colorHex,
    shadeHex(snap.striker.colorHex, -0.35)
  );

  // Side Standings
  snap.players.forEach((p, idx) => {
    const y = 140 + idx * 46;
    drawHudChip(
      ctx,
      ARENA_WIDTH - 24,
      y,
      `P${p.slotIndex + 1} ${p.name}: ${p.score}pt (${p.pocketed})`,
      p.id === snap.activePlayerId ? '#FFB800' : p.colorHex,
      'right'
    );
  });

  drawHudChip(ctx, ARENA_WIDTH / 2 - 145, 18, `ROUND ${snap.round}/${snap.totalRounds}`, '#F59E0B');
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 + 145,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'CARROM STRIKER',
    active?.colorHex || '#FFB800'
  );

  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, 'carrom-banner', snap.banner, snap.eventText, active?.colorHex || '#F59E0B');
}

// ============================================================
// 42. DUNGEON QUEST BOARD (20-Tile Spiral RPG Adventure)
// ============================================================
export function renderDungeonCrawlBoard(
  ctx: CanvasRenderingContext2D,
  snap: DungeonCrawlBoardSnapshot
): void {
  drawStudioBackdrop(ctx, '#0F0A1C', 'rgba(139, 92, 246, 0.18)', 'rgba(255, 77, 46, 0.08)', 44);

  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 16;
  const t = getMotionTime();

  drawArenaSlab(ctx, cx - 455, cy - 260, 910, 520, 28, 18, '#251B42', '#17112B', '#8B5CF6');

  // Spiral Stone Path connecting tiles
  ctx.save();
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.38)';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  snap.tiles.forEach((tile, idx) => {
    if (idx === 0) ctx.moveTo(tile.x, tile.y);
    else ctx.lineTo(tile.x, tile.y);
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
      isBoss ? 48 : 27,
      isBoss ? 22 : 12,
      hex,
      shadeHex(hex, -0.38)
    );

    ctx.save();
    ctx.font = isBoss
      ? '900 12px "Plus Jakarta Sans", sans-serif'
      : '800 9.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = isBoss
      ? `🐉 BOSS`
      : tile.kind === 'monster'
      ? `⚔ ${tCanvas(tile.name)}`
      : tile.kind === 'chest'
      ? `💎 +${tile.reward}G`
      : tile.kind === 'camp'
      ? `🔥 HEAL`
      : tile.kind === 'trap'
      ? `⚠ -${tile.power}HP`
      : tCanvas(tile.name);
    ctx.fillText(label, tile.x, tile.y - (isBoss ? 26 : 12));

    // Boss HP Bar right on the Dragon Lair
    if (isBoss) {
      const bw = 64;
      const bh = 8;
      const ratio = Math.max(0, Math.min(1, snap.bossHp / Math.max(1, snap.bossMaxHp)));
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(tile.x - bw / 2, tile.y - 12, bw, bh);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(tile.x - bw / 2, tile.y - 12, bw * ratio, bh);
    }
    ctx.restore();
  }

  // Top-right 3D Dice Indicator
  drawDie3D(ctx, ARENA_WIDTH - 92, 92, 46, snap.combatRoll ?? snap.diceValue, snap.diceRolling);

  // Players smoothly interpolating along the dungeon spiral
  const maxIdx = Math.max(0, snap.tiles.length - 1);
  snap.players.forEach((p, idx) => {
    const v = Math.max(0, Math.min(maxIdx, p.visualTile));
    const iA = Math.floor(v);
    const iB = Math.min(maxIdx, iA + 1);
    const frac = v - iA;
    const tA = snap.tiles[iA] || snap.tiles[0];
    const tB = snap.tiles[iB] || tA;
    const px = tA.x + (tB.x - tA.x) * frac;
    const py = tA.y + (tB.y - tA.y) * frac;
    const hopZ = Math.sin(frac * Math.PI) * 20;

    const ox = ((idx % 2) - 0.5) * 20;
    const oy = (Math.floor(idx / 2) - 0.5) * 18 - 14;
    drawCharacterPod3D(ctx, px + ox, py + oy, 18, 0, p.colorHex, {
      playerId: p.id,
      zHeight: hopZ,
      flash: p.id === snap.activePlayerId ? 0.35 : 0,
    });
    drawNameplate(
      ctx,
      px + ox,
      py + oy - hopZ - 30,
      p.slotIndex,
      p.name,
      p.colorHex,
      `♥${p.hp} · ⚔+${p.attackBonus} · ${p.gold}G`
    );
  });

  // Vivid Combat Encounter Prompt Overlay when fighting a Monster or Dragon Boss!
  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  if (snap.phase === 'combat' && active) {
    const tile = snap.tiles[active.tileIndex];
    if (tile) {
      ctx.save();
      const pulse = 1 + Math.sin(t * 9) * 0.03;
      ctx.translate(ARENA_WIDTH / 2, ARENA_HEIGHT - 108);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(15, 10, 28, 0.94)';
      ctx.strokeStyle = '#FF4D2E';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-230, -28, 460, 56, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FEF08A';
      ctx.font = '900 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        tCanvas(`⚔ ${active.name} (1-6 +${active.attackBonus}) VS ${tile.name} (PWR ${tile.power}) — PRESS A TO STRIKE!`),
        0,
        0
      );
      ctx.restore();
    }
  }

  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 - 155,
    18,
    `ROUND ${snap.round}/${snap.totalRounds} · BOSS ♥${snap.bossHp}/${snap.bossMaxHp}`,
    '#FF4D2E'
  );
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 + 155,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'DUNGEON QUEST',
    active?.colorHex || '#FFB800'
  );

  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, 'dungeon-banner', snap.banner, snap.eventText, active?.colorHex || '#8B5CF6');
}

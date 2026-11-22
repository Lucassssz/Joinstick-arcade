import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type FourInARowSnapshot,
  type LudoRoyaleSnapshot,
  type ReversiClashSnapshot,
  type StarPartyBoardSnapshot,
} from '../shared/types';
import { drawNameplate, drawPopupTexts, tCanvas } from './renderers';
import {
  drawArenaSlab,
  drawCharacterPod3D,
  drawDie3D,
  drawExtrudedBox3D,
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
  const anim = getSpringBannerAnim(`bA:${accent}`, text);
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
// 35. LUDO ROYALE (28-Tile Cross Loop & Home Stretch Race)
// ============================================================
function getLudoTrackCoord(absIndex: number): { x: number; y: number } {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 12;
  const rx = 250;
  const ry = 195;
  const angle = (absIndex / 28) * Math.PI * 2 - Math.PI / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: cx + cos * rx + Math.sign(cos) * 28,
    y: cy + sin * ry + Math.sign(sin) * 18,
  };
}

export function renderLudoRoyale(
  ctx: CanvasRenderingContext2D,
  snap: LudoRoyaleSnapshot
): void {
  drawStudioBackdrop(ctx, '#0D1021', 'rgba(168, 85, 247, 0.14)', 'rgba(255, 184, 0, 0.05)', 44);

  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 12;

  drawArenaSlab(ctx, cx - 355, cy - 255, 710, 510, 24, 16, '#1E2642', '#11162B', '#3B4878');

  // Draw 28 Perimeter Track Tiles
  for (let i = 0; i < 28; i++) {
    const pt = getLudoTrackCoord(i);
    const isStar = snap.starIndices.includes(i);
    const isStart = i % 7 === 0;
    const topColor = isStart ? '#FFB800' : isStar ? '#38BDF8' : '#263052';
    drawExtrudedBox3D(
      ctx,
      pt.x - 19,
      pt.y - 17,
      38,
      34,
      8,
      6,
      topColor,
      shadeHex(topColor, -0.35),
      '#94A3B8'
    );
    if (isStar) {
      ctx.save();
      ctx.fillStyle = '#0F172A';
      ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', pt.x, pt.y - 8);
      ctx.restore();
    }
  }

  // Center Royal Crown Goal Platform
  drawExtrudedCylinder3D(ctx, cx, cy, 56, 18, '#FFB800', '#B45309');
  drawDie3D(ctx, cx, cy - 18, 44, snap.diceValue, snap.diceRolling);

  // Draw each player's Base Yard, Home Stretch & 3 Tokens
  snap.players.forEach((p, pIdx) => {
    const cornerAngles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 0.75];
    const ca = cornerAngles[pIdx % 4];
    const baseX = cx + Math.cos(ca) * 240;
    const baseY = cy + Math.sin(ca) * 165;

    p.visualSteps.forEach((vStep, tIdx) => {
      let tx = baseX + (tIdx - 1) * 26;
      let ty = baseY;
      if (vStep >= 31) {
        tx = cx + Math.cos(ca) * 32 + (tIdx - 1) * 14;
        ty = cy + Math.sin(ca) * 32;
      } else if (vStep >= 28) {
        const ratio = (vStep - 27) / 4;
        const entryPt = getLudoTrackCoord(p.startTrackIndex);
        tx = entryPt.x + (cx - entryPt.x) * ratio;
        ty = entryPt.y + (cy - entryPt.y) * ratio;
      } else if (vStep >= 0) {
        const abs = (p.startTrackIndex + Math.floor(vStep)) % 28;
        const pt = getLudoTrackCoord(abs);
        tx = pt.x + (tIdx - 1) * 7;
        ty = pt.y + (pIdx - 1.5) * 5;
      }

      const isSelected = p.id === snap.activePlayerId && p.selectedToken === tIdx;
      drawCharacterPod3D(ctx, tx, ty, isSelected ? 16 : 13, 0, p.colorHex, {
        playerId: p.id,
        hat: vStep >= 31 ? 'crown' : 'none',
        flash: isSelected ? 0.35 : 0,
      });
    });
  });

  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  drawBoardChip(
    ctx,
    ARENA_WIDTH / 2 - 140,
    18,
    `ROUND ${snap.round}/${snap.totalRounds}`,
    '#A855F7'
  );
  drawBoardChip(
    ctx,
    ARENA_WIDTH / 2 + 140,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'LUDO ROYALE',
    active?.colorHex || '#FFB800'
  );

  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, snap.banner, snap.eventText, active?.colorHex || '#FFB800');
}

// ============================================================
// 36. STAR PARTY ISLAND (Mario-Party-Style Star Hunt Board)
// ============================================================
export function renderStarPartyBoard(
  ctx: CanvasRenderingContext2D,
  snap: StarPartyBoardSnapshot
): void {
  drawStudioBackdrop(ctx, '#061A26', 'rgba(0, 229, 163, 0.16)', 'rgba(255, 184, 0, 0.08)', 44);

  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 18;
  const t = getMotionTime();

  // Tropical Lagoon Island Base
  drawArenaSlab(ctx, cx - 455, cy - 260, 910, 520, 32, 18, '#146C78', '#0B3B49', '#22D3EE');

  // Connecting stepping path between tiles
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  snap.tiles.forEach((tile, idx) => {
    if (idx === 0) ctx.moveTo(tile.x, tile.y);
    else ctx.lineTo(tile.x, tile.y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  const kindColor: Record<string, string> = {
    coin: '#00C2FF',
    lucky: '#10B981',
    trap: '#FF4D2E',
    boost: '#A855F7',
    duel: '#F59E0B',
  };

  for (const tile of snap.tiles) {
    const isStarShrine = tile.index === snap.starTileIndex;
    const hex = isStarShrine ? '#FFB800' : kindColor[tile.kind] || '#00C2FF';
    drawExtrudedCylinder3D(
      ctx,
      tile.x,
      tile.y,
      isStarShrine ? 32 : 25,
      isStarShrine ? 18 : 12,
      hex,
      shadeHex(hex, -0.35)
    );

    ctx.save();
    ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = isStarShrine ? '#0F172A' : '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isStarShrine ? '★ STAR 20C' : tCanvas(tile.label),
      tile.x,
      tile.y - (isStarShrine ? 18 : 12)
    );
    ctx.restore();

    if (isStarShrine) {
      drawSpinningGem3D(ctx, tile.x, tile.y - 36, 16, '#FFB800', t * 3);
    }
  }

  // Center Dice Block Pedestal
  drawExtrudedCylinder3D(ctx, cx, cy, 62, 18, '#1E293B', '#0F172A');
  drawDie3D(ctx, cx, cy - 22, 48, snap.diceValue, snap.diceRolling);

  // Players on tiles
  snap.players.forEach((p, idx) => {
    const tile = snap.tiles[p.tileIndex % snap.tiles.length] || snap.tiles[0];
    const ox = ((idx % 2) - 0.5) * 22;
    const oy = (Math.floor(idx / 2) - 0.5) * 18 - 14;
    drawCharacterPod3D(ctx, tile.x + ox, tile.y + oy, 17, 0, p.colorHex, {
      playerId: p.id,
      hat: p.stars > 0 ? 'crown' : 'none',
      flash: p.candyActive || p.id === snap.activePlayerId ? 0.35 : 0,
    });
    drawNameplate(
      ctx,
      tile.x + ox,
      tile.y + oy - 28,
      p.slotIndex,
      p.name,
      p.colorHex,
      `★${p.stars} · ${p.coins}c`
    );
  });

  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  drawBoardChip(ctx, ARENA_WIDTH / 2 - 140, 18, `ROUND ${snap.round}/${snap.totalRounds}`, '#00E5A3');
  drawBoardChip(
    ctx,
    ARENA_WIDTH / 2 + 140,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'STAR PARTY',
    active?.colorHex || '#FFB800'
  );

  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, snap.banner, snap.eventText, active?.colorHex || '#FFB800');
}

// ============================================================
// 37. REVERSI CLASH (8x8 Tactical Disc Flip Board)
// ============================================================
export function renderReversiClash(
  ctx: CanvasRenderingContext2D,
  snap: ReversiClashSnapshot
): void {
  drawStudioBackdrop(ctx, '#081512', 'rgba(16, 185, 129, 0.14)', 'rgba(255, 184, 0, 0.04)', 44);

  const cellSize = 54;
  const boardW = snap.cols * cellSize;
  const boardH = snap.rows * cellSize;
  const left = (ARENA_WIDTH - boardW) / 2;
  const top = (ARENA_HEIGHT - boardH) / 2 + 12;

  drawArenaSlab(ctx, left - 20, top - 20, boardW + 40, boardH + 40, 20, 16, '#0D4A38', '#062E22', '#10B981');

  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const x = left + c * cellSize;
      const y = top + r * cellSize;
      const idx = r * snap.cols + c;
      const colorHex = snap.colorGrid[idx];

      ctx.save();
      ctx.fillStyle = (r + c) % 2 === 0 ? '#0F3D2E' : '#134E3A';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, cellSize - 4, cellSize - 4, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (colorHex) {
        drawExtrudedCylinder3D(
          ctx,
          x + cellSize / 2,
          y + cellSize / 2 + 6,
          cellSize * 0.36,
          9,
          colorHex,
          shadeHex(colorHex, -0.35)
        );
      }
    }
  }

  // Highlight valid flip moves for active player
  for (const vm of snap.validMoves) {
    const cx = left + (vm.col + 0.5) * cellSize;
    const cy = top + (vm.row + 0.5) * cellSize;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 184, 0, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#FFB800';
    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${vm.flips}`, cx, cy);
    ctx.restore();
  }

  // Active player cursor frame
  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  if (active) {
    const cx = left + active.cursorCol * cellSize;
    const cy = top + active.cursorRow * cellSize;
    ctx.save();
    ctx.strokeStyle = active.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(cx + 1, cy + 1, cellSize - 2, cellSize - 2, 10);
    ctx.stroke();
    ctx.restore();
  }

  drawBoardChip(ctx, ARENA_WIDTH / 2 - 140, 18, `TURN ${snap.turnCount}/${snap.maxTurns}`, '#10B981');
  drawBoardChip(
    ctx,
    ARENA_WIDTH / 2 + 140,
    18,
    active ? `${active.name}: ${active.discCount} Discs (${Math.ceil(snap.turnTimeLeft)}s)` : 'REVERSI CLASH',
    active?.colorHex || '#FFB800'
  );

  drawBoardBanner(ctx, snap.banner, snap.eventText, active?.colorHex || '#10B981');
}

// ============================================================
// 38. CONNECT 4 DROP (7x6 Vertical Gravity Rack)
// ============================================================
export function renderFourInARow(
  ctx: CanvasRenderingContext2D,
  snap: FourInARowSnapshot
): void {
  drawStudioBackdrop(ctx, '#0A1024', 'rgba(59, 130, 246, 0.16)', 'rgba(255, 184, 0, 0.06)', 44);

  const cellSize = 64;
  const rackW = snap.cols * cellSize;
  const rackH = snap.rows * cellSize;
  const left = (ARENA_WIDTH - rackW) / 2;
  const top = (ARENA_HEIGHT - rackH) / 2 + 28;

  // Hover token preview above rack
  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  if (active) {
    const hx = left + (active.hoverCol + 0.5) * cellSize;
    const hy = top - 34;
    drawSphere3D(ctx, hx, hy, 22, active.colorHex, '#FFFFFF');
    drawNameplate(ctx, hx, hy - 34, active.slotIndex, active.name, active.colorHex, `Col ${active.hoverCol + 1}`);
  }

  // Vertical Blue Acrylic Gravity Frame
  drawArenaSlab(ctx, left - 20, top - 16, rackW + 40, rackH + 36, 20, 16, '#1E3A8A', '#172554', '#60A5FA');

  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const cx = left + (c + 0.5) * cellSize;
      const cy = top + (r + 0.5) * cellSize;
      const colorHex = snap.colorGrid[r * snap.cols + c];

      ctx.save();
      ctx.fillStyle = '#090D1A';
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.39, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      if (colorHex) {
        drawSphere3D(ctx, cx, cy, cellSize * 0.36, colorHex, shadeHex(colorHex, 0.25));
      }
    }
  }

  // Highlight Winning 4-in-a-Row Line
  for (const wc of snap.winningCells) {
    const cx = left + (wc.col + 0.5) * cellSize;
    const cy = top + (wc.row + 0.5) * cellSize;
    ctx.save();
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.43, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawBoardChip(ctx, ARENA_WIDTH / 2 - 140, 18, `GOAL: ${snap.targetConnects} CONNECTS`, '#3B82F6');
  drawBoardChip(
    ctx,
    ARENA_WIDTH / 2 + 140,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'CONNECT 4 DROP',
    active?.colorHex || '#FFB800'
  );

  drawBoardBanner(ctx, snap.banner, snap.eventText, active?.colorHex || '#FFB800');
}

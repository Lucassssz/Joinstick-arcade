import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type FourInARowSnapshot,
  type LudoRoyaleSnapshot,
  type ReversiClashSnapshot,
  type StarPartyBoardSnapshot,
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
  drawExtrudedBox3D,
  drawExtrudedCylinder3D,
  drawSphere3D,
  drawSpinningGem3D,
  drawStudioBackdrop,
  shadeHex,
} from './render25d';
import { getMotionTime } from './arcadeMotion';

// ============================================================
// 35. LUDO ROYALE (Authentic 4-Arm Royal Cross Ludo Board)
// ============================================================
const LUDO_CROSS_GRID: Array<[number, number]> = [
  // Top arm left column going down (0..2), then left arm top going left (3..5), left turn (6)
  [-1, -4], [-1, -3], [-1, -2],
  [-2, -1], [-3, -1], [-4, -1],
  [-4, 0],
  // Left arm bottom going right (7..9), bottom arm left going down (10..12), bottom turn (13)
  [-4, 1], [-3, 1], [-2, 1],
  [-1, 2], [-1, 3], [-1, 4],
  [0, 4],
  // Bottom arm right going up (14..16), right arm bottom going right (17..19), right turn (20)
  [1, 4], [1, 3], [1, 2],
  [2, 1], [3, 1], [4, 1],
  [4, 0],
  // Right arm top going left (21..23), top arm right going up (24..26), top turn (27)
  [4, -1], [3, -1], [2, -1],
  [1, -2], [1, -3], [1, -4],
  [0, -4],
];

function getLudoTrackCoord(absIndex: number): { x: number; y: number } {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 10;
  const cell = 52;
  const [gx, gy] = LUDO_CROSS_GRID[((absIndex % 28) + 28) % 28];
  return { x: cx + gx * cell, y: cy + gy * cell };
}

function getLudoHomeStretchCoord(playerIdx: number, stepIntoHome: number): { x: number; y: number } {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 10;
  const cell = 52;
  // 4 arms: 0=Top(0,-3..-1), 1=Left(-3..-1,0), 2=Bottom(0,3..1), 3=Right(3..1,0)
  const dist = Math.max(0.6, 3.2 - stepIntoHome * 0.85);
  const dirs: Array<[number, number]> = [
    [0, -1],
    [-1, 0],
    [0, 1],
    [1, 0],
  ];
  const [dx, dy] = dirs[playerIdx % 4];
  return { x: cx + dx * dist * cell, y: cy + dy * dist * cell };
}

export function renderLudoRoyale(
  ctx: CanvasRenderingContext2D,
  snap: LudoRoyaleSnapshot
): void {
  drawStudioBackdrop(ctx, '#0B0F20', 'rgba(168, 85, 247, 0.16)', 'rgba(255, 184, 0, 0.06)', 44);

  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 10;
  const t = getMotionTime();

  // Royal Board Frame
  drawArenaSlab(ctx, cx - 285, cy - 260, 570, 520, 24, 18, '#1B2340', '#0E1326', '#4F46E5');

  const yardCenters: Array<[number, number]> = [
    [cx - 175, cy - 160],
    [cx - 175, cy + 160],
    [cx + 175, cy + 160],
    [cx + 175, cy - 160],
  ];

  // Draw 4 Colored Corner Home Yards
  for (let q = 0; q < 4; q++) {
    const owner = snap.players[q];
    const col = owner ? owner.colorHex : '#334155';
    const [yx, yy] = yardCenters[q];
    ctx.save();
    ctx.fillStyle = owner ? `${col}26` : 'rgba(51, 65, 85, 0.22)';
    ctx.strokeStyle = owner ? col : 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(yx - 72, yy - 66, 144, 132, 16);
    ctx.fill();
    ctx.stroke();
    if (owner) {
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${owner.slotIndex + 1} ${owner.name}`, yx, yy - 48);
    }
    ctx.restore();
  }

  // Draw Colored Home Stretch Lanes (3 tiles per arm toward center)
  for (let q = 0; q < 4; q++) {
    const col = snap.players[q]?.colorHex || '#475569';
    for (let s = 0; s < 3; s++) {
      const pt = getLudoHomeStretchCoord(q, s);
      drawExtrudedBox3D(
        ctx,
        pt.x - 19,
        pt.y - 19,
        38,
        38,
        7,
        6,
        col,
        shadeHex(col, -0.4),
        'rgba(255,255,255,0.45)'
      );
    }
  }

  // Draw 28 Perimeter Cross Track Tiles
  for (let i = 0; i < 28; i++) {
    const pt = getLudoTrackCoord(i);
    const isStar = snap.starIndices.includes(i);
    const isStart = i % 7 === 0;
    const startOwner = isStart ? snap.players[Math.floor(i / 7)] : null;
    const topColor = startOwner
      ? startOwner.colorHex
      : isStar
      ? '#38BDF8'
      : '#283358';

    drawExtrudedBox3D(
      ctx,
      pt.x - 21,
      pt.y - 21,
      42,
      42,
      8,
      7,
      topColor,
      shadeHex(topColor, -0.38),
      isStar ? '#FEF08A' : '#64748B'
    );

    if (isStar) {
      ctx.save();
      ctx.fillStyle = isStart ? '#FFFFFF' : '#0F172A';
      ctx.font = '900 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', pt.x, pt.y - 8);
      ctx.restore();
    }
  }

  // Center Royal Crown Podium & 3D Dice
  drawExtrudedCylinder3D(ctx, cx, cy, 48, 16, '#FFB800', '#B45309');
  drawDie3D(ctx, cx, cy - 16, 42, snap.diceValue, snap.diceRolling);

  // Draw all player tokens with smooth hop arcs & selection rings
  snap.players.forEach((p, pIdx) => {
    const [yx, yy] = yardCenters[pIdx % 4];
    const isTurnPlayer = p.id === snap.activePlayerId;

    p.visualSteps.forEach((vStep, tIdx) => {
      let tx = yx + (tIdx - 1) * 40;
      let ty = yy + 6;
      let hopLift = 0;

      if (vStep >= 31) {
        const ang = (pIdx * Math.PI) / 2 + (tIdx - 1) * 0.35;
        tx = cx + Math.cos(ang) * 28;
        ty = cy + Math.sin(ang) * 28;
      } else if (vStep >= 28) {
        const pt = getLudoHomeStretchCoord(pIdx, vStep - 28);
        tx = pt.x;
        ty = pt.y;
      } else if (vStep >= 0) {
        const stepFloor = Math.floor(vStep);
        const frac = vStep - stepFloor;
        const pA = getLudoTrackCoord((p.startTrackIndex + stepFloor) % 28);
        const pB =
          stepFloor + 1 >= 28
            ? getLudoHomeStretchCoord(pIdx, 0)
            : getLudoTrackCoord((p.startTrackIndex + stepFloor + 1) % 28);
        tx = pA.x + (pB.x - pA.x) * frac + (tIdx - 1) * 6;
        ty = pA.y + (pB.y - pA.y) * frac + (pIdx - 1.5) * 4;
        hopLift = Math.sin(frac * Math.PI) * 18;
      }

      const isSelected = isTurnPlayer && p.selectedToken === tIdx;
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(tx, ty, 20 + Math.sin(t * 8) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      drawCharacterPod3D(ctx, tx, ty, isSelected ? 16 : 13, 0, p.colorHex, {
        playerId: p.id,
        zHeight: hopLift + (isSelected ? Math.abs(Math.sin(t * 6)) * 5 : 0),
        hat: vStep >= 31 ? 'crown' : 'none',
        flash: isSelected ? 0.35 : 0,
      });

      // Small token index badge (#1/#2/#3)
      ctx.save();
      ctx.fillStyle = '#0F172A';
      ctx.font = '900 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${tIdx + 1}`, tx, ty - hopLift - 4);
      ctx.restore();
    });
  });

  // Right-side Live Standings Panel
  snap.players.forEach((p, idx) => {
    const y = 128 + idx * 46;
    drawHudChip(
      ctx,
      ARENA_WIDTH - 24,
      y,
      `P${p.slotIndex + 1} ${p.name}: ${p.finishedCount}/3 · ${p.score}pt`,
      p.id === snap.activePlayerId ? '#FFB800' : p.colorHex,
      'right'
    );
  });

  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  drawHudChip(ctx, ARENA_WIDTH / 2 - 145, 18, `ROUND ${snap.round}/${snap.totalRounds}`, '#A855F7');
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 + 145,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'LUDO ROYALE',
    active?.colorHex || '#FFB800'
  );

  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, 'ludo-banner', snap.banner, snap.eventText, active?.colorHex || '#FFB800');
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

  // Tropical Lagoon Island Slab
  drawArenaSlab(ctx, cx - 455, cy - 260, 910, 520, 32, 18, '#146C78', '#0B3B49', '#22D3EE');

  // Connecting path with directional golden chevrons
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  snap.tiles.forEach((tile, idx) => {
    if (idx === 0) ctx.moveTo(tile.x, tile.y);
    else ctx.lineTo(tile.x, tile.y);
  });
  ctx.closePath();
  ctx.stroke();

  // Draw little directional arrows between tiles
  for (let i = 0; i < snap.tiles.length; i++) {
    const a = snap.tiles[i];
    const b = snap.tiles[(i + 1) % snap.tiles.length];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255, 240, 150, 0.55)';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
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
      isStarShrine ? 34 : 26,
      isStarShrine ? 18 : 12,
      hex,
      shadeHex(hex, -0.35)
    );

    if (isStarShrine) {
      ctx.save();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tile.x, tile.y - 18, 37 + Math.sin(t * 6) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = isStarShrine ? '#0F172A' : '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isStarShrine ? `★ ${snap.starCost}C` : tCanvas(tile.label),
      tile.x,
      tile.y - (isStarShrine ? 18 : 12)
    );
    ctx.restore();

    if (isStarShrine) {
      drawSpinningGem3D(ctx, tile.x, tile.y - 42, 16, '#FFB800', t * 3.4);
    }
  }

  // Center Dice Block Pedestal
  drawExtrudedCylinder3D(ctx, cx, cy, 62, 18, '#1E293B', '#0F172A');
  drawDie3D(ctx, cx, cy - 22, 48, snap.diceValue, snap.diceRolling);

  // Players smoothly interpolating between tiles with hop bounce
  const nTiles = snap.tiles.length || 1;
  snap.players.forEach((p, idx) => {
    const vTile = ((p.visualTile % nTiles) + nTiles) % nTiles;
    const iA = Math.floor(vTile) % nTiles;
    const iB = (iA + 1) % nTiles;
    const frac = vTile - Math.floor(vTile);
    const tA = snap.tiles[iA];
    const tB = snap.tiles[iB];
    const px = tA.x + (tB.x - tA.x) * frac;
    const py = tA.y + (tB.y - tA.y) * frac;
    const hopZ = Math.sin(frac * Math.PI) * 22;

    const ox = ((idx % 2) - 0.5) * 22;
    const oy = (Math.floor(idx / 2) - 0.5) * 18 - 14;
    drawCharacterPod3D(ctx, px + ox, py + oy, 18, 0, p.colorHex, {
      playerId: p.id,
      zHeight: hopZ,
      hat: p.stars > 0 ? 'crown' : 'none',
      flash: p.candyActive || p.id === snap.activePlayerId ? 0.35 : 0,
    });
    drawNameplate(
      ctx,
      px + ox,
      py + oy - hopZ - 30,
      p.slotIndex,
      p.name,
      p.colorHex,
      `★${p.stars} · ${p.coins}c`
    );
  });

  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  const distToStar = active
    ? (snap.starTileIndex - active.tileIndex + nTiles) % nTiles
    : 0;
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 - 170,
    18,
    `ROUND ${snap.round}/${snap.totalRounds} · STAR ${distToStar} AWAY`,
    '#00E5A3'
  );
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 + 165,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'STAR PARTY',
    active?.colorHex || '#FFB800'
  );

  drawPopupTexts(ctx, snap.popups);
  drawBoardBanner(ctx, 'star-banner', snap.banner, snap.eventText, active?.colorHex || '#FFB800');
}

// ============================================================
// 37. REVERSI CLASH (8x8 Tactical Disc Flip Board)
// ============================================================
export function renderReversiClash(
  ctx: CanvasRenderingContext2D,
  snap: ReversiClashSnapshot
): void {
  drawStudioBackdrop(ctx, '#071411', 'rgba(16, 185, 129, 0.16)', 'rgba(255, 184, 0, 0.05)', 44);

  const cellSize = 54;
  const boardW = snap.cols * cellSize;
  const boardH = snap.rows * cellSize;
  const left = (ARENA_WIDTH - boardW) / 2;
  const top = (ARENA_HEIGHT - boardH) / 2 + 12;
  const t = getMotionTime();

  drawArenaSlab(ctx, left - 26, top - 26, boardW + 52, boardH + 52, 22, 16, '#0D4A38', '#062E22', '#10B981');

  // Column (A-H) & Row (1-8) coordinate labels
  ctx.save();
  ctx.fillStyle = 'rgba(167, 243, 208, 0.7)';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let c = 0; c < snap.cols; c++) {
    ctx.fillText(String.fromCharCode(65 + c), left + (c + 0.5) * cellSize, top - 12);
  }
  for (let r = 0; r < snap.rows; r++) {
    ctx.fillText(`${r + 1}`, left - 14, top + (r + 0.5) * cellSize);
  }
  ctx.restore();

  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const x = left + c * cellSize;
      const y = top + r * cellSize;
      const idx = r * snap.cols + c;
      const colorHex = snap.colorGrid[idx];
      const isLast = snap.lastPlaced && snap.lastPlaced.col === c && snap.lastPlaced.row === r;

      ctx.save();
      ctx.fillStyle = (r + c) % 2 === 0 ? '#0F3D2E' : '#134E3A';
      ctx.strokeStyle = isLast ? '#FFB800' : 'rgba(16, 185, 129, 0.25)';
      ctx.lineWidth = isLast ? 2.5 : 1.5;
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
          10,
          colorHex,
          shadeHex(colorHex, -0.38)
        );
      }
    }
  }

  // Animated golden flip rings on recently flipped discs
  for (const fc of snap.flippedCells) {
    const cx = left + (fc.col + 0.5) * cellSize;
    const cy = top + (fc.row + 0.5) * cellSize;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fc.alpha);
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * (0.36 + (1 - fc.alpha) * 0.25), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Highlight valid flip moves with flip count badge
  for (const vm of snap.validMoves) {
    const cx = left + (vm.col + 0.5) * cellSize;
    const cy = top + (vm.row + 0.5) * cellSize;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 184, 0, 0.14)';
    ctx.strokeStyle = 'rgba(255, 184, 0, 0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FEF08A';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${vm.flips}`, cx, cy);
    ctx.restore();
  }

  // Active player pulsing cursor frame
  const active = snap.players.find((p) => p.id === snap.activePlayerId);
  if (active) {
    const cx = left + active.cursorCol * cellSize;
    const cy = top + active.cursorRow * cellSize;
    const pulse = 2 + Math.sin(t * 9) * 1.5;
    ctx.save();
    ctx.strokeStyle = active.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(cx - pulse * 0.5, cy - pulse * 0.5, cellSize + pulse, cellSize + pulse, 10);
    ctx.stroke();
    ctx.restore();
  }

  // Side Scoreboard for all players
  snap.players.forEach((p, idx) => {
    const y = 140 + idx * 46;
    drawHudChip(
      ctx,
      ARENA_WIDTH - 24,
      y,
      `P${p.slotIndex + 1} ${p.name}: ${p.discCount} Discs`,
      p.id === snap.activePlayerId ? '#FFB800' : p.colorHex,
      'right'
    );
  });

  drawHudChip(ctx, ARENA_WIDTH / 2 - 145, 18, `TURN ${snap.turnCount}/${snap.maxTurns}`, '#10B981');
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 + 145,
    18,
    active ? `${active.name}: ${active.discCount} Discs (${Math.ceil(snap.turnTimeLeft)}s)` : 'REVERSI CLASH',
    active?.colorHex || '#FFB800'
  );

  drawBoardBanner(ctx, 'reversi-banner', snap.banner, snap.eventText, active?.colorHex || '#10B981');
}

// ============================================================
// 38. CONNECT 4 DROP (7x6 Vertical Gravity Rack)
// ============================================================
export function renderFourInARow(
  ctx: CanvasRenderingContext2D,
  snap: FourInARowSnapshot
): void {
  drawStudioBackdrop(ctx, '#0A1024', 'rgba(59, 130, 246, 0.18)', 'rgba(255, 184, 0, 0.06)', 44);

  const cellSize = 62;
  const rackW = snap.cols * cellSize;
  const rackH = snap.rows * cellSize;
  const left = (ARENA_WIDTH - rackW) / 2;
  const top = (ARENA_HEIGHT - rackH) / 2 + 30;
  const t = getMotionTime();

  const active = snap.players.find((p) => p.id === snap.activePlayerId);

  // Hover dropper disc above active column
  if (active) {
    const hx = left + (active.hoverCol + 0.5) * cellSize;
    const hy = top - 36 + Math.sin(t * 7) * 3;
    drawSphere3D(ctx, hx, hy, 22, active.colorHex, '#FFFFFF');
    drawNameplate(ctx, hx, hy - 34, active.slotIndex, active.name, active.colorHex, `Col ${active.hoverCol + 1}`);
  }

  // Vertical Blue Acrylic Gravity Rack
  drawArenaSlab(ctx, left - 22, top - 16, rackW + 44, rackH + 38, 20, 18, '#1E3A8A', '#172554', '#60A5FA');

  // Highlight active hover column lane + landing ghost slot
  if (active) {
    const colX = left + active.hoverCol * cellSize;
    ctx.save();
    ctx.fillStyle = `${active.colorHex}22`;
    ctx.beginPath();
    ctx.roundRect(colX + 4, top, cellSize - 8, rackH, 10);
    ctx.fill();
    ctx.restore();

    // Find lowest open row in hovered column for ghost preview
    let ghostRow = -1;
    for (let r = snap.rows - 1; r >= 0; r--) {
      if (snap.colorGrid[r * snap.cols + active.hoverCol] === null) {
        ghostRow = r;
        break;
      }
    }
    if (ghostRow !== -1) {
      const gx = left + (active.hoverCol + 0.5) * cellSize;
      const gy = top + (ghostRow + 0.5) * cellSize;
      ctx.save();
      ctx.strokeStyle = active.colorHex;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(gx, gy, cellSize * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Grid holes + static placed discs (skip the currently falling cell until it lands)
  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const cx = left + (c + 0.5) * cellSize;
      const cy = top + (r + 0.5) * cellSize;
      const colorHex = snap.colorGrid[r * snap.cols + c];
      const isFallingSlot =
        snap.fallingToken && snap.fallingToken.col === c && snap.fallingToken.row === r;

      ctx.save();
      ctx.fillStyle = '#090D1A';
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.39, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      if (colorHex && !isFallingSlot) {
        drawSphere3D(ctx, cx, cy, cellSize * 0.36, colorHex, shadeHex(colorHex, 0.28));
      }
    }
  }

  // Animated falling disc!
  if (snap.fallingToken) {
    const fx = left + (snap.fallingToken.col + 0.5) * cellSize;
    const fy = top + (snap.fallingToken.currentY + 0.5) * cellSize;
    drawSphere3D(
      ctx,
      fx,
      fy,
      cellSize * 0.36,
      snap.fallingToken.colorHex,
      shadeHex(snap.fallingToken.colorHex, 0.3)
    );
  }

  // Blazing Laser Beam & Rings across Winning 4-in-a-Row Line
  if (snap.winningCells.length >= 2) {
    const first = snap.winningCells[0];
    const last = snap.winningCells[snap.winningCells.length - 1];
    ctx.save();
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(left + (first.col + 0.5) * cellSize, top + (first.row + 0.5) * cellSize);
    ctx.lineTo(left + (last.col + 0.5) * cellSize, top + (last.row + 0.5) * cellSize);
    ctx.stroke();
    ctx.restore();
  }
  for (const wc of snap.winningCells) {
    const cx = left + (wc.col + 0.5) * cellSize;
    const cy = top + (wc.row + 0.5) * cellSize;
    ctx.save();
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.43, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Side Connects Standings
  snap.players.forEach((p, idx) => {
    const y = 140 + idx * 46;
    drawHudChip(
      ctx,
      ARENA_WIDTH - 24,
      y,
      `P${p.slotIndex + 1} ${p.name}: ${p.connects}/${snap.targetConnects}`,
      p.id === snap.activePlayerId ? '#FFB800' : p.colorHex,
      'right'
    );
  });

  drawHudChip(ctx, ARENA_WIDTH / 2 - 145, 18, `GOAL: ${snap.targetConnects} CONNECTS`, '#3B82F6');
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 + 145,
    18,
    active ? `TURN: ${active.name} (${Math.ceil(snap.turnTimeLeft)}s)` : 'CONNECT 4 DROP',
    active?.colorHex || '#FFB800'
  );

  drawBoardBanner(ctx, 'c4-banner', snap.banner, snap.eventText, active?.colorHex || '#FFB800');
}

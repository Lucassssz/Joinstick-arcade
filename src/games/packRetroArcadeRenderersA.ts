import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import type {
  AlienWaveSnapshot,
  BarrelTowerSnapshot,
  BlockStackSnapshot,
  BrickClashSnapshot,
  FrogCrossingSnapshot,
  MazeChomperSnapshot,
  RhythmPulseSnapshot,
  WhackBlitzSnapshot,
} from '../shared/packRetroArcadeTypes';
import {
  drawArenaSlab,
  drawBoardBanner,
  drawCharacterPod3D,
  drawExtrudedBox3D,
  drawHudChip,
  drawNameplate,
  drawPopupTexts,
  drawShadowOval,
  drawSphere3D,
  drawStudioBackdrop,
  shadeHex,
  tCanvas,
} from './packRenderHelpers';
import { getMotionTime } from './arcadeMotion';

// 1. MAZE CHOMPER (Pac-Man)
export function renderMazeChomper(ctx: CanvasRenderingContext2D, snap: MazeChomperSnapshot): void {
  drawStudioBackdrop(ctx, '#060914', 'rgba(250,204,21,0.12)', 'rgba(255,255,255,0.025)', 44);
  const bw = 1045;
  const bh = 605;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 76;
  const cw = bw / snap.cols;
  const ch = bh / snap.rows;

  ctx.fillStyle = '#080D1B';
  ctx.fillRect(ox, oy, bw, bh);

  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      if (snap.walls[r * snap.cols + c] === 1) {
        drawExtrudedBox3D(ctx, ox + c * cw + 2, oy + r * ch + 2, cw - 4, ch - 4, 6, '#1D4ED8', '#1E3A8A', 7);
      }
    }
  }

  for (const pel of snap.pellets) {
    const px = ox + pel.x * cw;
    const py = oy + pel.y * ch;
    ctx.fillStyle = pel.power ? '#FACC15' : '#FEF08A';
    ctx.beginPath();
    ctx.arc(px, py, pel.power ? 11 : 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ghosts
  for (const g of snap.ghosts) {
    const gx = ox + g.x * cw;
    const gy = oy + g.y * ch;
    const col = g.scaredTimer > 0 ? '#2563EB' : g.colorHex;
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(gx, gy - 4, 17, Math.PI, 0);
    ctx.lineTo(gx + 17, gy + 15);
    ctx.lineTo(gx - 17, gy + 15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(gx - 5, gy - 5, 4, 0, Math.PI * 2);
    ctx.arc(gx + 5, gy - 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const t = getMotionTime();
  const mouth = 0.28 + Math.abs(Math.sin(t * 12)) * 0.45;
  for (const p of snap.players) {
    const px = ox + p.x * cw;
    const py = oy + p.y * ch;
    ctx.save();
    if (p.stunTimer > 0) ctx.globalAlpha = 0.45;
    ctx.fillStyle = p.powerTimer > 0 ? '#FACC15' : p.colorHex;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, 19, p.angle + mouth, p.angle + Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawNameplate(ctx, px, py - 26, `${p.name} ${p.score}`, p.colorHex);
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FACC15', 16);
}

// 2. BRICK CLASH (Breakout)
export function renderBrickClash(ctx: CanvasRenderingContext2D, snap: BrickClashSnapshot): void {
  drawStudioBackdrop(ctx, '#09101D', 'rgba(0,194,255,0.14)', 'rgba(255,255,255,0.03)', 46);
  drawArenaSlab(ctx, 20, 56, ARENA_WIDTH - 40, ARENA_HEIGHT - 74, 18, '#0D1526', '#1E3A5F');

  for (const br of snap.bricks) {
    drawExtrudedBox3D(ctx, br.x, br.y, br.w, br.h, 6, br.colorHex, shadeHex(br.colorHex, -35), 6);
    if (br.bonus === 'multi') {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tCanvas('×2 BALL'), br.x + br.w / 2, br.y + 19);
    }
  }

  for (const p of snap.players) {
    if (p.laserActive) {
      ctx.save();
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(p.x - 16, p.y);
      ctx.lineTo(p.x - 16, 65);
      ctx.moveTo(p.x + 16, p.y);
      ctx.lineTo(p.x + 16, 65);
      ctx.stroke();
      ctx.restore();
    }
    drawExtrudedBox3D(ctx, p.x - p.w / 2, p.y - 10, p.w, 20, 8, p.colorHex, shadeHex(p.colorHex, -35), 10);
    drawNameplate(ctx, p.x, p.y + 28, `${p.name} · ${p.score}`, p.colorHex);
  }

  for (const b of snap.balls) {
    drawSphere3D(ctx, b.x, b.y, 11, b.colorHex, '#FFFFFF');
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#00C2FF', 16);
}

// 3. ALIEN WAVE (Space Invaders)
export function renderAlienWave(ctx: CanvasRenderingContext2D, snap: AlienWaveSnapshot): void {
  drawStudioBackdrop(ctx, '#060812', 'rgba(34,197,94,0.14)', 'rgba(255,255,255,0.025)', 44);

  for (const s of snap.shields) {
    if (s.hp <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0.3, s.hp / 10);
    drawExtrudedBox3D(ctx, s.x - 42, s.y - 12, 84, 24, 6, '#10B981', '#047857', 8);
    ctx.restore();
  }

  for (const a of snap.aliens) {
    if (a.kind === 'ufo') {
      drawExtrudedBox3D(ctx, a.x - 32, a.y - 12, 64, 24, 6, '#FACC15', '#B45309', 12);
    } else {
      drawExtrudedBox3D(ctx, a.x - 20, a.y - 14, 40, 28, 6, a.colorHex, shadeHex(a.colorHex, -35), 6);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(a.x - 10, a.y - 4, 6, 6);
      ctx.fillRect(a.x + 4, a.y - 4, 6, 6);
    }
  }

  for (const b of snap.bullets) {
    ctx.fillStyle = b.colorHex;
    ctx.fillRect(b.x - 3, b.y - 10, 6, 20);
  }

  for (const p of snap.players) {
    ctx.save();
    if (p.stunTimer > 0) ctx.globalAlpha = 0.45;
    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 24);
    ctx.lineTo(p.x + 24, p.y + 16);
    ctx.lineTo(p.x - 24, p.y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawNameplate(ctx, p.x, p.y + 34, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `WAVE ${snap.wave} · ${Math.ceil(snap.timeLeft)}s`, '#22C55E');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#22C55E', 16);
}

// 4. BLOCK STACK (Tetris)
const TET_COLORS = ['', '#06B6D4', '#FACC15', '#A855F7', '#3B82F6', '#F97316', '#22C55E', '#EF4444', '#64748B'];

export function renderBlockStack(ctx: CanvasRenderingContext2D, snap: BlockStackSnapshot): void {
  drawStudioBackdrop(ctx, '#0C0A18', 'rgba(168,85,247,0.16)', 'rgba(255,255,255,0.03)', 48);
  const count = Math.max(1, snap.players.length);
  const cols = Math.min(4, count);
  const rows = Math.ceil(count / cols);
  const slotW = (ARENA_WIDTH - 64) / cols;
  const slotH = (ARENA_HEIGHT - 96) / rows;

  snap.players.forEach((p, idx) => {
    const gc = idx % cols;
    const gr = Math.floor(idx / cols);
    const cell = Math.min(Math.floor((slotW - 44) / 10), Math.floor((slotH - 54) / 16), 28);
    const bw = cell * 10;
    const bh = cell * 16;
    const bx = 32 + gc * slotW + (slotW - bw) / 2;
    const by = 78 + gr * slotH + (slotH - bh) / 2;

    drawArenaSlab(ctx, bx - 6, by - 6, bw + 12, bh + 12, 10, '#0F172A', p.colorHex);

    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 10; c++) {
        const v = p.board[r * 10 + c];
        if (v > 0) {
          ctx.fillStyle = TET_COLORS[v] ?? '#FFFFFF';
          ctx.fillRect(bx + c * cell + 1, by + r * cell + 1, cell - 2, cell - 2);
        }
      }
    }
    for (const seg of p.curShape) {
      if (seg.cy >= 0 && seg.cy < 16) {
        ctx.fillStyle = TET_COLORS[p.curColor] ?? '#FFFFFF';
        ctx.fillRect(bx + seg.cx * cell + 1, by + seg.cy * cell + 1, cell - 2, cell - 2);
      }
    }
    drawNameplate(ctx, bx + bw / 2, by - 18, `${p.name} · ${p.score}`, p.colorHex);
  });

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#A855F7', 16);
}

// 5. FROG CROSSING (Frogger)
export function renderFrogCrossing(ctx: CanvasRenderingContext2D, snap: FrogCrossingSnapshot): void {
  drawStudioBackdrop(ctx, '#091512', 'rgba(74,222,128,0.14)', 'rgba(255,255,255,0.03)', 44);
  const topY = 76;
  const laneH = (ARENA_HEIGHT - topY - 24) / 9;

  for (const ln of snap.lanes) {
    const y = topY + ln.row * laneH;
    ctx.fillStyle =
      ln.kind === 'goal'
        ? '#065F46'
        : ln.kind === 'river'
        ? '#0C4A6E'
        : ln.kind === 'road'
        ? '#1E293B'
        : '#14532D';
    ctx.fillRect(0, y, ARENA_WIDTH, laneH);
    for (const it of ln.items) {
      drawExtrudedBox3D(ctx, it.x, y + 10, it.w, laneH - 20, 6, it.colorHex, shadeHex(it.colorHex, -35), 8);
    }
  }

  for (const pad of snap.pads) {
    drawSphere3D(ctx, pad.x, topY + laneH / 2, 24, pad.claimedByColor ?? '#22C55E', '#BBF7D0');
  }

  for (const p of snap.players) {
    const py = topY + (p.row + 0.5) * laneH;
    ctx.save();
    if (p.stunTimer > 0) ctx.globalAlpha = 0.45;
    drawCharacterPod3D(ctx, p.x, py, 19, p.colorHex, -Math.PI / 2, p.hopTimer > 0 ? 12 : 2);
    ctx.restore();
    drawNameplate(ctx, p.x, py - 28, `${p.name} · ${p.score}`, p.colorHex);
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#4ADE80', 16);
}

// 6. BARREL TOWER (Donkey Kong)
export function renderBarrelTower(ctx: CanvasRenderingContext2D, snap: BarrelTowerSnapshot): void {
  drawStudioBackdrop(ctx, '#140B09', 'rgba(249,115,22,0.16)', 'rgba(255,255,255,0.03)', 46);

  // Girders & Ladders
  for (let i = 0; i < snap.floors.length; i++) {
    const fl = snap.floors[i];
    drawExtrudedBox3D(ctx, 84, fl.y, ARENA_WIDTH - 168, 22, 8, i === 4 ? '#FACC15' : '#DC2626', '#7F1D1D', 6);
    if (i < snap.floors.length - 1) {
      const nextY = snap.floors[i + 1].y;
      for (const lx of fl.ladderX) {
        ctx.save();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(lx - 14, fl.y);
        ctx.lineTo(lx - 14, nextY + 20);
        ctx.moveTo(lx + 14, fl.y);
        ctx.lineTo(lx + 14, nextY + 20);
        for (let ry = nextY + 32; ry < fl.y; ry += 20) {
          ctx.moveTo(lx - 14, ry);
          ctx.lineTo(lx + 14, ry);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  for (const h of snap.hammers) {
    drawSphere3D(ctx, h.x, h.y, 16, '#FACC15', '#FEF9C3');
  }
  for (const b of snap.barrels) {
    drawSphere3D(ctx, b.x, b.y, b.r, b.burning ? '#EF4444' : '#B45309', '#FDE68A');
  }
  for (const p of snap.players) {
    ctx.save();
    if (p.stunTimer > 0) ctx.globalAlpha = 0.45;
    drawCharacterPod3D(ctx, p.x, p.y, 18, p.hammerTimer > 0 ? '#FACC15' : p.colorHex, 0, 4);
    ctx.restore();
    drawNameplate(ctx, p.x, p.y - 30, `${p.name} · ${p.score}`, p.colorHex);
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F97316', 16);
}

// 7. WHACK BLITZ (Whac-A-Mole)
export function renderWhackBlitz(ctx: CanvasRenderingContext2D, snap: WhackBlitzSnapshot): void {
  drawStudioBackdrop(ctx, '#160B14', 'rgba(251,113,133,0.16)', 'rgba(255,255,255,0.03)', 48);
  drawArenaSlab(ctx, 100, 108, ARENA_WIDTH - 200, ARENA_HEIGHT - 144, 24, '#14231C', '#22C55E');

  for (const h of snap.holes) {
    drawShadowOval(ctx, h.x, h.y + 14, 58, 22, 0.75);
    if (h.mole !== 'none' && h.popProgress > 0.05) {
      const rise = h.popProgress * 44;
      const col = h.mole === 'golden' ? '#FACC15' : h.mole === 'bomb' ? '#EF4444' : '#D97706';
      drawSphere3D(ctx, h.x, h.y + 10 - rise, 30, col, '#FFFFFF');
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h.mole === 'golden' ? '👑' : h.mole === 'bomb' ? '💣' : '🐹', h.x, h.y + 10 - rise);
    }
  }

  for (const p of snap.players) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.swingTimer > 0 ? -0.65 : 0.25);
    drawExtrudedBox3D(ctx, -26, -18, 52, 26, 8, p.colorHex, shadeHex(p.colorHex, -35), 8);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(-5, 8, 10, 32);
    ctx.restore();
    drawNameplate(ctx, p.x, p.y - 34, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawPopupTexts(ctx, snap.popups);
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FB7185', 16);
}

// 8. RHYTHM PULSE (DDR / Guitar Hero)
const LANE_COLORS = ['#EC4899', '#38BDF8', '#22C55E', '#FACC15'];
const LANE_ARROWS = ['◀', '▲', '▼', '▶'];

export function renderRhythmPulse(ctx: CanvasRenderingContext2D, snap: RhythmPulseSnapshot): void {
  drawStudioBackdrop(ctx, '#120821', 'rgba(232,121,249,0.18)', 'rgba(255,255,255,0.03)', 46);
  const hw = 540;
  const hx = (ARENA_WIDTH - hw) / 2;
  const lw = hw / 4;
  const hitY = 585;

  drawArenaSlab(ctx, hx - 14, 72, hw + 28, 610, 18, '#0F172A', '#E879F9');

  for (let i = 0; i < 4; i++) {
    const lx = hx + i * lw;
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(lx + 4, 84, lw - 8, 580);
    // Hit target circle
    ctx.save();
    ctx.strokeStyle = LANE_COLORS[i];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(lx + lw / 2, hitY, 32 + Math.sin(snap.beatPhase * Math.PI * 2) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = LANE_COLORS[i];
    ctx.font = '900 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(LANE_ARROWS[i], lx + lw / 2, hitY);
    ctx.restore();
  }

  for (const n of snap.notes) {
    const nx = hx + (n.lane + 0.5) * lw;
    drawSphere3D(ctx, nx, n.y, 24, n.golden ? '#FACC15' : LANE_COLORS[n.lane], '#FFFFFF');
  }

  // Player side scorecards + lane markers
  snap.players.forEach((p, idx) => {
    const lx = hx + (p.activeLane + 0.5) * lw;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(lx - 42, hitY - 40, 84, 80);
    ctx.restore();

    const sideX = idx % 2 === 0 ? 44 : ARENA_WIDTH - 284;
    const sideY = 120 + Math.floor(idx / 2) * 124;
    drawExtrudedBox3D(ctx, sideX, sideY, 240, 96, 8, '#1E293B', p.colorHex, 14);
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(p.name, sideX + 16, sideY + 32);
    ctx.fillStyle = p.judgeColor;
    ctx.font = '900 16px "JetBrains Mono", monospace';
    ctx.fillText(`${tCanvas(p.lastJudge)}  ×${p.combo}`, sideX + 16, sideY + 60);
    ctx.fillStyle = '#FACC15';
    ctx.fillText(tCanvas(`${p.score} PTS`), sideX + 16, sideY + 84);
    ctx.restore();
  });

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#E879F9', 16);
}

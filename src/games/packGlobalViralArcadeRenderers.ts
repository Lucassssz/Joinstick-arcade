import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import type {
  BlobDevourSnapshot,
  DinoDashSnapshot,
  FlappyFlockSnapshot,
  GeoPinRushSnapshot,
  GlassBridgeSnapshot,
  MineSweepDuelSnapshot,
  SkyClimbSnapshot,
  SlitherFeastSnapshot,
  Tile2048BlitzSnapshot,
  TugTitanSnapshot,
  TurfRibbonSnapshot,
  WavelengthSyncSnapshot,
} from '../shared/packGlobalViralTypes';
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
  getActiveCanvasLang,
  shadeHex,
} from './packRenderHelpers';
import { getMotionTime } from './arcadeMotion';

// 1. SKY CLIMB
export function renderSkyClimb(ctx: CanvasRenderingContext2D, snap: SkyClimbSnapshot): void {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
  skyGrad.addColorStop(0, '#071428');
  skyGrad.addColorStop(0.55, '#0F2A4D');
  skyGrad.addColorStop(1, '#1E3A5F');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Parallax clouds
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 8; i++) {
    const cy = ((i * 150 - snap.cameraY * 0.25) % (ARENA_HEIGHT + 120) + ARENA_HEIGHT + 120) % (ARENA_HEIGHT + 120) - 60;
    const cx = 120 + (i * 173) % 980;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 85, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  for (const pl of snap.platforms) {
    if (pl.broken) continue;
    const sy = pl.y - snap.cameraY;
    const col =
      pl.kind === 'boost'
        ? '#38BDF8'
        : pl.kind === 'moving'
        ? '#A855F7'
        : pl.kind === 'crumble'
        ? '#F97316'
        : pl.kind === 'cloud'
        ? '#E2E8F0'
        : '#10B981';
    drawExtrudedBox3D(ctx, pl.x - pl.w / 2, sy, pl.w, 18, 10, col, shadeHex(col, -35), 8);
  }

  for (const c of snap.collectibles) {
    const sy = c.y - snap.cameraY;
    drawSphere3D(ctx, c.x, sy, 13, '#FACC15', '#FEF9C3');
  }

  for (const p of snap.players) {
    const sy = p.y - snap.cameraY;
    if (p.grappling) {
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, sy);
      ctx.lineTo(p.x, sy - 110);
      ctx.stroke();
      ctx.restore();
    }
    drawCharacterPod3D(ctx, p.x, sy, 18, p.colorHex, p.vx * 0.001, p.grounded ? 0 : 8);
    drawNameplate(ctx, p.x, sy - 30, `${p.name} ${p.altitude}m`, p.colorHex);
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#38BDF8', 22);
  drawHudChip(ctx, 24, 22, `SKY CLIMB · ${Math.ceil(snap.timeLeft)}s`, '#38BDF8');
}

// 2. SLITHER FEAST
export function renderSlitherFeast(ctx: CanvasRenderingContext2D, snap: SlitherFeastSnapshot): void {
  drawStudioBackdrop(ctx, '#090F18', 'rgba(34,197,94,0.12)', 'rgba(255,255,255,0.03)', 42);
  drawArenaSlab(ctx, 26, 26, ARENA_WIDTH - 52, ARENA_HEIGHT - 52, 20, '#0C1624', '#1E3A5F');

  for (const pel of snap.pellets) {
    ctx.save();
    ctx.fillStyle = pel.colorHex;
    ctx.shadowColor = pel.colorHex;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(pel.x, pel.y, pel.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const s of snap.snakes) {
    if (!s.alive) continue;
    for (let i = s.segments.length - 1; i >= 0; i--) {
      const seg = s.segments[i];
      const rad = i === 0 ? 15 : Math.max(8, 13 - i * 0.08);
      ctx.save();
      ctx.fillStyle = i % 2 === 0 ? s.colorHex : shadeHex(s.colorHex, -22);
      if (s.boosting && i === 0) {
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = 16;
      }
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const h = s.segments[0];
    if (h) {
      // Eyes
      const ex = Math.cos(s.angle) * 6;
      const ey = Math.sin(s.angle) * 6;
      const px = -Math.sin(s.angle) * 5;
      const py = Math.cos(s.angle) * 5;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(h.x + ex + px, h.y + ey + py, 3.5, 0, Math.PI * 2);
      ctx.arc(h.x + ex - px, h.y + ey - py, 3.5, 0, Math.PI * 2);
      ctx.fill();
      drawNameplate(ctx, h.x, h.y - 26, `${s.name} · ${s.score}`, s.colorHex);
    }
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#22C55E', 18);
}

// 3. BLOB DEVOUR
export function renderBlobDevour(ctx: CanvasRenderingContext2D, snap: BlobDevourSnapshot): void {
  drawStudioBackdrop(ctx, '#0E0A18', 'rgba(168,85,247,0.14)', 'rgba(255,255,255,0.035)', 44);

  for (const pel of snap.pellets) {
    ctx.fillStyle = pel.colorHex;
    ctx.beginPath();
    ctx.arc(pel.x, pel.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spiky green viruses
  const t = getMotionTime();
  for (const v of snap.viruses) {
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(t * 0.5);
    ctx.fillStyle = '#22C55E';
    ctx.strokeStyle = '#86EFAC';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const rad = i % 2 === 0 ? v.r + 7 : v.r - 3;
      if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  const sorted = [...snap.players].sort((a, b) => a.r - b.r);
  for (const p of sorted) {
    if (!p.alive) continue;
    drawShadowOval(ctx, p.x, p.y + p.r * 0.72, p.r * 0.9, p.r * 0.32, 0.35);
    drawSphere3D(ctx, p.x, p.y, p.r, p.colorHex, '#FFFFFF');
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${p.name}`, p.x, p.y - 6);
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.fillText(`${p.mass}`, p.x, p.y + 10);
    ctx.restore();
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#A855F7', 18);
}

// 4. TURF RIBBON
export function renderTurfRibbon(ctx: CanvasRenderingContext2D, snap: TurfRibbonSnapshot): void {
  drawStudioBackdrop(ctx, '#0C111C', 'rgba(249,115,22,0.12)', 'rgba(255,255,255,0.025)', 48);
  const padX = 72;
  const padY = 66;
  const boardW = ARENA_WIDTH - padX * 2;
  const boardH = ARENA_HEIGHT - padY - 36;
  const cw = boardW / snap.cols;
  const ch = boardH / snap.rows;

  const colorBySlot = new Map(snap.players.map((p) => [p.slotIndex, p.colorHex]));

  ctx.fillStyle = '#111827';
  ctx.fillRect(padX, padY, boardW, boardH);

  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const idx = r * snap.cols + c;
      const x = padX + c * cw;
      const y = padY + r * ch;
      const owner = snap.cells[idx];
      if (owner >= 0) {
        ctx.fillStyle = colorBySlot.get(owner) ?? '#64748B';
        ctx.fillRect(x, y, cw + 0.6, ch + 0.6);
      }
      const tr = snap.trails[idx];
      if (tr >= 0) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = colorBySlot.get(tr) ?? '#FFFFFF';
        ctx.fillRect(x + 3, y + 3, cw - 6, ch - 6);
        ctx.restore();
      }
    }
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(padX, padY, boardW, boardH);

  for (const p of snap.players) {
    if (!p.alive) continue;
    const px = padX + p.x * cw;
    const py = padY + p.y * ch;
    drawExtrudedBox3D(ctx, px - 13, py - 13, 26, 26, 8, p.colorHex, '#FFFFFF', 6);
    drawNameplate(ctx, px, py - 24, `${p.name} ${p.territoryPct}%`, p.colorHex);
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F97316', 16);
}

// 5. GLASS BRIDGE
export function renderGlassBridge(ctx: CanvasRenderingContext2D, snap: GlassBridgeSnapshot): void {
  drawStudioBackdrop(ctx, '#060D1A', 'rgba(6,182,212,0.16)', 'rgba(255,255,255,0.025)', 40);

  // Abyss rails
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(100, 225);
  ctx.lineTo(ARENA_WIDTH - 100, 225);
  ctx.moveTo(100, 325);
  ctx.lineTo(ARENA_WIDTH - 100, 325);
  ctx.moveTo(100, 395);
  ctx.lineTo(ARENA_WIDTH - 100, 395);
  ctx.moveTo(100, 495);
  ctx.lineTo(ARENA_WIDTH - 100, 495);
  ctx.stroke();

  // Start & Finish platforms
  drawExtrudedBox3D(ctx, 20, 210, 88, 300, 14, '#1E293B', '#0F172A', 12);
  drawExtrudedBox3D(ctx, ARENA_WIDTH - 108, 210, 88, 300, 14, '#10B981', '#047857', 12);

  const startX = 115;
  const span = ARENA_WIDTH - 230;
  const pw = span / snap.totalSteps - 10;

  for (const pn of snap.panels) {
    const px = startX + (pn.step / snap.totalSteps) * span + 5;
    const py = pn.lane === 0 ? 232 : 402;
    if (pn.state === 'shattered') {
      ctx.save();
      ctx.strokeStyle = 'rgba(239,68,68,0.45)';
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(px, py, pw, 86);
      ctx.restore();
    } else {
      const col = pn.state === 'safe-revealed' ? '#10B981' : '#38BDF8';
      ctx.save();
      ctx.globalAlpha = pn.state === 'safe-revealed' ? 0.85 : 0.45;
      drawExtrudedBox3D(ctx, px, py, pw, 86, 8, col, shadeHex(col, -40), 8);
      ctx.restore();
    }
  }

  for (const p of snap.players) {
    drawCharacterPod3D(ctx, p.x, p.y, 17, p.colorHex, 0, p.falling ? -12 : 4);
    drawNameplate(ctx, p.x, p.y - 28, p.name, p.colorHex);
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#06B6D4', 18);
  drawHudChip(ctx, 24, 22, `GLASS BRIDGE · ${Math.ceil(snap.timeLeft)}s`, '#06B6D4');
}

// 6. TUG TITAN
export function renderTugTitan(ctx: CanvasRenderingContext2D, snap: TugTitanSnapshot): void {
  drawStudioBackdrop(ctx, '#140B10', 'rgba(239,68,68,0.16)', 'rgba(255,255,255,0.03)', 46);

  // Left & Right neon platforms with abyss center
  drawExtrudedBox3D(ctx, 30, 390, 420, 260, 20, '#1E293B', '#0F172A', 16);
  drawExtrudedBox3D(ctx, ARENA_WIDTH - 450, 390, 420, 260, 20, '#1E293B', '#0F172A', 16);

  // Abyss glow
  const g = ctx.createLinearGradient(0, 400, 0, ARENA_HEIGHT);
  g.addColorStop(0, 'rgba(239,68,68,0.05)');
  g.addColorStop(1, 'rgba(239,68,68,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(450, 400, ARENA_WIDTH - 900, 320);

  // Rhythm pulse bar at top-center
  const barX = 360;
  const barY = 108;
  const barW = 480;
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(barX, barY, barW, 24);
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(barX + barW * 0.78, barY, barW * 0.22, 24);
  ctx.fillStyle = snap.pulseZone > 0.78 ? '#FEF08A' : '#38BDF8';
  ctx.fillRect(barX, barY + 4, barW * snap.pulseZone, 16);

  // Rope + Knot
  const knotX = ARENA_WIDTH / 2 + snap.ropeOffset * 170;
  const ropeY = 345;
  ctx.save();
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(110, ropeY);
  ctx.lineTo(ARENA_WIDTH - 110, ropeY);
  ctx.stroke();
  drawSphere3D(ctx, knotX, ropeY, 22, '#EF4444', '#FCA5A5');
  ctx.restore();

  // Players on left & right
  const leftP = snap.players.filter((p) => p.team === 'left');
  const rightP = snap.players.filter((p) => p.team === 'right');
  leftP.forEach((p, i) => {
    const px = 380 - i * 78 + snap.ropeOffset * 40;
    const py = 355 + (p.pulling ? -6 : 0);
    drawCharacterPod3D(ctx, px, py, 22, p.colorHex, 0, p.anchorActive ? -4 : 6);
    drawNameplate(ctx, px, py - 34, `${p.name}`, p.colorHex);
  });
  rightP.forEach((p, i) => {
    const px = ARENA_WIDTH - 380 + i * 78 + snap.ropeOffset * 40;
    const py = 355 + (p.pulling ? -6 : 0);
    drawCharacterPod3D(ctx, px, py, 22, p.colorHex, Math.PI, p.anchorActive ? -4 : 6);
    drawNameplate(ctx, px, py - 34, `${p.name}`, p.colorHex);
  });

  drawHudChip(ctx, 28, 24, `LEFT ${snap.leftWins} — ${snap.rightWins} RIGHT`, '#FACC15');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EF4444', 18);
}

// 7. FLAPPY FLOCK
export function renderFlappyFlock(ctx: CanvasRenderingContext2D, snap: FlappyFlockSnapshot): void {
  drawStudioBackdrop(ctx, '#091829', 'rgba(250,204,21,0.14)', 'rgba(255,255,255,0.03)', 48);

  for (const pp of snap.pipes) {
    const topH = Math.max(20, pp.gapY - pp.gapH / 2);
    const botY = pp.gapY + pp.gapH / 2;
    drawExtrudedBox3D(ctx, pp.x - 32, 0, 64, topH, 10, '#10B981', '#047857', 8);
    drawExtrudedBox3D(ctx, pp.x - 32, botY, 64, ARENA_HEIGHT - botY, 10, '#10B981', '#047857', 8);
    if (pp.hasRing && !pp.ringTaken) {
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(pp.x, pp.gapY, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const p of snap.players) {
    if (!p.alive) continue;
    ctx.save();
    if (p.dashTimer > 0) ctx.globalAlpha = 0.6;
    drawSphere3D(ctx, p.x, p.y, 18, p.colorHex, '#FFFFFF');
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.moveTo(p.x + 16, p.y - 4);
    ctx.lineTo(p.x + 28, p.y + 1);
    ctx.lineTo(p.x + 16, p.y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawNameplate(ctx, p.x, p.y - 28, `${p.name} · ${p.score}`, p.colorHex);
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FACC15', 18);
}

// 8. DINO DASH
export function renderDinoDash(ctx: CanvasRenderingContext2D, snap: DinoDashSnapshot): void {
  drawStudioBackdrop(
    ctx,
    snap.nightMode ? '#09071A' : '#131C2B',
    snap.nightMode ? 'rgba(168,85,247,0.2)' : 'rgba(16,217,139,0.14)',
    'rgba(255,255,255,0.03)',
    44
  );

  // Horizon ground
  drawExtrudedBox3D(ctx, 0, 560, ARENA_WIDTH, 160, 12, snap.nightMode ? '#1E1B4B' : '#1E293B', '#0F172A', 0);

  for (const o of snap.obstacles) {
    if (o.kind === 'star') {
      drawSphere3D(ctx, o.x + o.w / 2, o.y + o.h / 2, 15, '#FACC15', '#FEF9C3');
    } else if (o.kind.startsWith('ptero')) {
      drawExtrudedBox3D(ctx, o.x, o.y, o.w, o.h, 6, '#A855F7', '#6B21A8', 8);
    } else {
      drawExtrudedBox3D(ctx, o.x, o.y, o.w, o.h, 8, '#10D98B', '#047857', 8);
    }
  }

  for (const p of snap.players) {
    const h = p.ducking ? 34 : 58;
    const w = p.ducking ? 46 : 34;
    ctx.save();
    if (p.stunTimer > 0) ctx.globalAlpha = 0.5;
    drawExtrudedBox3D(ctx, p.x - w / 2, p.y - h, w, h, 8, p.colorHex, shadeHex(p.colorHex, -35), 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(p.x + 4, p.y - h + 8, 6, 6);
    ctx.restore();
    drawNameplate(ctx, p.x, p.y - h - 18, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${snap.distance}m · ${snap.speed} SPD`, '#10D98B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10D98B', 18);
}

// 9. 2048 BLITZ
const TILE_2048_COLORS: Record<number, string> = {
  2: '#334155',
  4: '#475569',
  8: '#F97316',
  16: '#EA580C',
  32: '#EF4444',
  64: '#DC2626',
  128: '#EAB308',
  256: '#CA8A04',
  512: '#22C55E',
  1024: '#06B6D4',
  2048: '#A855F7',
};

export function renderTile2048Blitz(ctx: CanvasRenderingContext2D, snap: Tile2048BlitzSnapshot): void {
  drawStudioBackdrop(ctx, '#0E121D', 'rgba(245,158,11,0.14)', 'rgba(255,255,255,0.03)', 48);
  const count = Math.max(1, snap.players.length);
  const cols = count <= 2 ? count : count <= 4 ? 2 : 4;
  const rows = Math.ceil(count / cols);
  const cellW = (ARENA_WIDTH - 80) / cols;
  const cellH = (ARENA_HEIGHT - 110) / rows;

  snap.players.forEach((p, idx) => {
    const gc = idx % cols;
    const gr = Math.floor(idx / cols);
    const boxSize = Math.min(cellW - 36, cellH - 52, 260);
    const bx = 40 + gc * cellW + (cellW - boxSize) / 2;
    const by = 82 + gr * cellH + (cellH - boxSize) / 2;

    drawArenaSlab(ctx, bx - 8, by - 8, boxSize + 16, boxSize + 16, 14, '#111827', p.frozenTimer > 0 ? '#38BDF8' : p.colorHex);
    const tSize = (boxSize - 18) / 4;
    for (let i = 0; i < 16; i++) {
      const r = Math.floor(i / 4);
      const c = i % 4;
      const v = p.grid[i];
      const tx = bx + c * (tSize + 6);
      const ty = by + r * (tSize + 6);
      ctx.fillStyle = v > 0 ? TILE_2048_COLORS[v] ?? '#A855F7' : '#1E293B';
      ctx.beginPath();
      ctx.roundRect(tx, ty, tSize, tSize, 6);
      ctx.fill();
      if (v > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `900 ${v >= 1000 ? 15 : 19}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(v), tx + tSize / 2, ty + tSize / 2);
      }
    }
    drawNameplate(ctx, bx + boxSize / 2, by - 22, `${p.name} · ${p.score}`, p.colorHex);
  });

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F59E0B', 16);
}

// 10. MINE SWEEP DUEL
const ADJ_COLORS = ['', '#38BDF8', '#22C55E', '#EF4444', '#A855F7', '#F97316', '#06B6D4', '#FACC15', '#FFFFFF'];

export function renderMineSweepDuel(ctx: CanvasRenderingContext2D, snap: MineSweepDuelSnapshot): void {
  drawStudioBackdrop(ctx, '#0C1018', 'rgba(239,68,68,0.12)', 'rgba(255,255,255,0.025)', 44);
  const bw = 960;
  const bh = 580;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 96;
  const cw = bw / snap.cols;
  const ch = bh / snap.rows;

  drawArenaSlab(ctx, ox - 12, oy - 12, bw + 24, bh + 24, 16, '#0F172A', '#334155');

  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const cell = snap.cells[r * snap.cols + c];
      const x = ox + c * cw + 2;
      const y = oy + r * ch + 2;
      const w = cw - 4;
      const h = ch - 4;
      if (cell.state === 'hidden') {
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
      } else if (cell.state === 'revealed') {
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
        if (cell.adj > 0) {
          ctx.fillStyle = ADJ_COLORS[cell.adj] ?? '#FFFFFF';
          ctx.font = '900 22px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(cell.adj), x + w / 2, y + h / 2);
        }
      } else if (cell.state === 'flagged') {
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚩', x + w / 2, y + h / 2);
      } else {
        ctx.fillStyle = '#7F1D1D';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💥', x + w / 2, y + h / 2);
      }
    }
  }

  for (const p of snap.players) {
    const px = ox + p.col * cw;
    const py = oy + p.row * ch;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(px + 2, py + 2, cw - 4, ch - 4);
    ctx.restore();
    drawNameplate(ctx, px + cw / 2, py - 10, `${p.name} ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `MINES LEFT: ${snap.minesLeft}`, '#EF4444');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EF4444', 18);
}

// 11. GEO PIN RUSH
const CONTINENT_BLOBS = [
  { x: 0.22, y: 0.34, rx: 0.13, ry: 0.14 }, // North America
  { x: 0.33, y: 0.67, rx: 0.08, ry: 0.16 }, // South America
  { x: 0.51, y: 0.27, rx: 0.08, ry: 0.09 }, // Europe
  { x: 0.54, y: 0.54, rx: 0.09, ry: 0.17 }, // Africa
  { x: 0.74, y: 0.34, rx: 0.16, ry: 0.15 }, // Asia
  { x: 0.87, y: 0.75, rx: 0.08, ry: 0.09 }, // Australia
];

export function renderGeoPinRush(ctx: CanvasRenderingContext2D, snap: GeoPinRushSnapshot): void {
  drawStudioBackdrop(ctx, '#071422', 'rgba(14,165,233,0.16)', 'rgba(255,255,255,0.03)', 48);
  const mx = 70;
  const my = 152;
  const mw = ARENA_WIDTH - 140;
  const mh = 510;

  drawArenaSlab(ctx, mx, my, mw, mh, 18, '#0A2540', '#0EA5E9');

  // Stylized glowing continents
  ctx.save();
  ctx.fillStyle = '#14532D';
  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 2;
  for (const b of CONTINENT_BLOBS) {
    ctx.beginPath();
    ctx.ellipse(mx + b.x * mw, my + b.y * mh, b.rx * mw, b.ry * mh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Clue header
  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(140, 22, ARENA_WIDTH - 280, 108, 16);
  ctx.fill();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.stroke();
  const isZh = getActiveCanvasLang() === 'zh';
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '900 28px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    isZh ? `${snap.clueEmoji} ${snap.clueTitleZh}` : `${snap.clueEmoji} ${snap.clueTitle} · ${snap.clueTitleZh}`,
    ARENA_WIDTH / 2,
    62
  );
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    isZh ? snap.clueHintZh : `${snap.clueHint}  |  ${snap.clueHintZh}`,
    ARENA_WIDTH / 2,
    100
  );
  ctx.restore();

  if (snap.phase === 'reveal') {
    const tx = mx + snap.targetX * mw;
    const ty = my + snap.targetY * mh;
    for (const p of snap.players) {
      ctx.save();
      ctx.strokeStyle = p.colorHex;
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mx + p.x * mw, my + p.y * mh);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();
    }
    drawSphere3D(ctx, tx, ty, 18, '#FACC15', '#FEF9C3');
    drawNameplate(ctx, tx, ty - 28, snap.targetCity, '#FACC15');
  }

  for (const p of snap.players) {
    const px = mx + p.x * mw;
    const py = my + p.y * mh;
    drawSphere3D(ctx, px, py, p.locked ? 14 : 11, p.colorHex, '#FFFFFF');
    drawNameplate(ctx, px, py - 24, `${p.name} ${p.locked ? '✓' : ''}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 24, `R${snap.round}/${snap.maxRounds} · ${Math.ceil(snap.timeLeft)}s`, '#0EA5E9');
}

// 12. MIND DIAL (Wavelength)
export function renderWavelengthSync(ctx: CanvasRenderingContext2D, snap: WavelengthSyncSnapshot): void {
  drawStudioBackdrop(ctx, '#130A1C', 'rgba(236,72,153,0.16)', 'rgba(255,255,255,0.03)', 48);
  const cx = ARENA_WIDTH / 2;
  const cy = 540;
  const rad = 320;

  // Dial semi-circle
  ctx.save();
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(cx, cy, rad, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Target zones on reveal
  if (snap.phase === 'reveal') {
    const tAng = Math.PI + snap.targetAngle * Math.PI;
    const drawWedge = (span: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rad - 8, tAng - span, tAng + span);
      ctx.closePath();
      ctx.fill();
    };
    drawWedge(0.24 * Math.PI, 'rgba(56,189,248,0.45)');
    drawWedge(0.14 * Math.PI, 'rgba(250,204,21,0.65)');
    drawWedge(0.06 * Math.PI, '#EC4899');
  }

  // Player needles
  for (const p of snap.players) {
    const ang = Math.PI + p.dial * Math.PI;
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * (rad - 18), cy + Math.sin(ang) * (rad - 18));
    ctx.stroke();
    const nx = cx + Math.cos(ang) * (rad + 24);
    const ny = cy + Math.sin(ang) * (rad + 24);
    drawNameplate(ctx, nx, ny, `${p.name}${p.locked ? ' ✓' : ''}`, p.colorHex);
  }
  ctx.restore();

  // Spectrum labels
  drawExtrudedBox3D(ctx, 64, 560, 290, 82, 10, '#0284C7', '#075985', 14);
  drawExtrudedBox3D(ctx, ARENA_WIDTH - 354, 560, 290, 82, 10, '#DB2777', '#9D174D', 14);
  ctx.save();
  const isZh = getActiveCanvasLang() === 'zh';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isZh ? snap.leftLabelZh : `${snap.leftLabel} · ${snap.leftLabelZh}`, 209, 608);
  ctx.fillText(isZh ? snap.rightLabelZh : `${snap.rightLabel} · ${snap.rightLabelZh}`, ARENA_WIDTH - 209, 608);

  // Center clue card
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(310, 56, 580, 92, 16);
  ctx.fill();
  ctx.strokeStyle = '#EC4899';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#FACC15';
  ctx.font = '900 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(isZh ? snap.clueTextZh : `${snap.clueText} · ${snap.clueTextZh}`, ARENA_WIDTH / 2, 112);
  ctx.restore();

  drawHudChip(ctx, 24, 24, `R${snap.round}/${snap.maxRounds} · ${Math.ceil(snap.timeLeft)}s`, '#EC4899');
}

import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BlockHopSnapshot,
  type ClawManiaSnapshot,
  type DrawGuessRelaySnapshot,
  type EggRushSnapshot,
  type GooseAlertSnapshot,
  type HotpotRushSnapshot,
  type MelonMergeSnapshot,
  type PlatformLeapSnapshot,
  type TileTripleSnapshot,
  type TruthBombSnapshot,
} from '../shared/types';
import { drawBoardBanner, drawHudChip, drawNameplate, drawPopupTexts, getActiveCanvasLang, tCanvas } from './canvasHelpers';
import {
  drawArenaSlab,
  drawCharacterPod3D,
  drawExtrudedBox3D,
  drawExtrudedDiscStage,
  drawShadowOval,
  drawSphere3D,
  drawStudioBackdrop,
  shadeHex,
} from './render25d';
import { clamp01, getMotionTime } from './arcadeMotion';

// ============================================================
// 59. MELON MERGE (合成大西瓜)
// ============================================================
const FRUIT_STYLES = [
  { color: '#EF4444', rim: '#FCA5A5', label: '🍒' },
  { color: '#A855F7', rim: '#E9D5FF', label: '🍇' },
  { color: '#F97316', rim: '#FED7AA', label: '🍊' },
  { color: '#FACC15', rim: '#FEF08A', label: '🍋' },
  { color: '#84CC16', rim: '#D9F99D', label: '🥝' },
  { color: '#DC2626', rim: '#FECACA', label: '🍅' },
  { color: '#F472B6', rim: '#FBCFE8', label: '🍑' },
  { color: '#EAB308', rim: '#FEF9C3', label: '🍍' },
  { color: '#78350F', rim: '#FDE68A', label: '🥥' },
  { color: '#16A34A', rim: '#86EFAC', label: '🍉' },
];

export function renderMelonMerge(ctx: CanvasRenderingContext2D, snap: MelonMergeSnapshot): void {
  drawStudioBackdrop(ctx, '#11161F', 'rgba(34, 197, 94, 0.14)', 'rgba(255,255,255,0.025)', 48);
  const n = snap.players.length;
  const cols = n <= 2 ? n : n <= 4 ? n : 4;
  const rows = Math.ceil(n / cols);
  const padX = 28;
  const padY = 66;
  const gapX = 18;
  const gapY = 20;
  const cellW = (ARENA_WIDTH - padX * 2 - gapX * (cols - 1)) / cols;
  const cellH = (ARENA_HEIGHT - padY - 26 - gapY * (rows - 1)) / rows;

  snap.players.forEach((p, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const shakeX = p.shakeTimer > 0 ? Math.sin(getMotionTime() * 55) * 6 : 0;
    const tx = padX + col * (cellW + gapX) + shakeX;
    const ty = padY + row * (cellH + gapY);

    // Glass fruit tank
    const tankGrad = ctx.createLinearGradient(tx, ty, tx, ty + cellH);
    tankGrad.addColorStop(0, '#1B2230');
    tankGrad.addColorStop(1, '#121822');
    drawArenaSlab(ctx, tx, ty, cellW, cellH, 14, 8, tankGrad, '#0A0D14', p.overflowed ? '#EF4444' : p.colorHex, 2.5);

    // Danger overflow line
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(tx + 8, ty + cellH * 0.16);
    ctx.lineTo(tx + cellW - 8, ty + cellH * 0.16);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dropper aim guide + next fruit
    if (!p.overflowed) {
      const ax = tx + p.aimX * cellW;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax, ty + 24);
      ctx.lineTo(ax, ty + cellH - 8);
      ctx.stroke();

      const nextStyle = FRUIT_STYLES[p.nextTier] ?? FRUIT_STYLES[0];
      drawSphere3D(ctx, ax, ty + 24, 14, nextStyle.color, nextStyle.rim, 0, false);
    }

    // Clipped fruits inside tank
    const scaleDim = Math.min(cellW, cellH);
    for (const f of p.fruits) {
      const fx = tx + f.x * cellW;
      const fy = ty + f.y * cellH;
      const fr = Math.max(8, f.r * scaleDim * 0.92);
      const st = FRUIT_STYLES[f.tier] ?? FRUIT_STYLES[0];
      drawSphere3D(ctx, fx, fy, fr, st.color, st.rim, 0, false);
      if (f.tier === 9) {
        // Watermelon stripes!
        ctx.strokeStyle = '#052E16';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(fx, fy, fr * 0.72, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
    }

    // Player header bar
    ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
    ctx.beginPath();
    ctx.roundRect(tx + 8, ty + cellH - 28, cellW - 16, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.name.slice(0, 10), tx + 14, ty + cellH - 17);
    ctx.fillStyle = '#4ADE80';
    ctx.textAlign = 'right';
    ctx.fillText(tCanvas(`${p.score} PTS`), tx + cellW - 14, ty + cellH - 17);
    ctx.restore();
  });

  drawHudChip(ctx, 20, 16, 'MELON MERGE', '#22C55E', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.timeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'melon-merge', snap.banner, null, '#22C55E');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 60. TILE TRIPLE (羊了个羊)
// ============================================================
const TRIPLE_SYMBOLS = [
  { glyph: '🌿', bg: '#14532D', border: '#4ADE80' },
  { glyph: '🥕', bg: '#7C2D12', border: '#FB923C' },
  { glyph: '🔥', bg: '#7F1D1D', border: '#F87171' },
  { glyph: '🔔', bg: '#713F12', border: '#FACC15' },
  { glyph: '🧶', bg: '#581C87', border: '#C084FC' },
  { glyph: '🐑', bg: '#0C4A6E', border: '#38BDF8' },
];

export function renderTileTriple(ctx: CanvasRenderingContext2D, snap: TileTripleSnapshot): void {
  drawStudioBackdrop(ctx, '#142214', 'rgba(163, 230, 53, 0.14)', 'rgba(255,255,255,0.025)', 48);
  const n = snap.players.length;
  const cols = n <= 2 ? n : n <= 4 ? n : 4;
  const rows = Math.ceil(n / cols);
  const padX = 24;
  const padY = 66;
  const gap = 16;
  const cw = (ARENA_WIDTH - padX * 2 - gap * (cols - 1)) / cols;
  const ch = (ARENA_HEIGHT - padY - 22 - gap * (rows - 1)) / rows;

  snap.players.forEach((p, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const bx = padX + col * (cw + gap);
    const by = padY + row * (ch + gap);

    drawArenaSlab(ctx, bx, by, cw, ch, 14, 8, '#1B2D1B', '#0E1A0E', p.failed ? '#EF4444' : p.colorHex, 2.5);

    const gridAreaH = ch - 78;
    const tileW = Math.min(54, (cw - 36) / 4.4);
    const tileH = Math.min(54, gridAreaH / 4.4);
    const startX = bx + (cw - tileW * 4) / 2;
    const startY = by + 18;

    // Render stacked tiles bottom layer -> top layer
    const visibleTiles = [...p.tiles].filter((t) => !t.removed).sort((a, b) => a.layer - b.layer);
    for (const tile of visibleTiles) {
      const tx = startX + tile.col * tileW + tile.layer * 3;
      const ty = startY + tile.row * tileH - tile.layer * 4;
      const sym = TRIPLE_SYMBOLS[tile.symbol % TRIPLE_SYMBOLS.length];
      ctx.save();
      ctx.fillStyle = tile.blocked ? '#1E293B' : '#F8FAFC';
      ctx.beginPath();
      ctx.roundRect(tx, ty, tileW - 4, tileH - 4, 8);
      ctx.fill();
      ctx.strokeStyle = tile.blocked ? '#475569' : sym.border;
      ctx.lineWidth = tile.blocked ? 1.5 : 2.6;
      ctx.stroke();

      ctx.globalAlpha = tile.blocked ? 0.35 : 1;
      ctx.font = `${Math.round(tileW * 0.48)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sym.glyph, tx + (tileW - 4) / 2, ty + (tileH - 4) / 2 + 1);
      ctx.restore();
    }

    // Active cursor frame
    if (!p.failed) {
      const cx = startX + p.cursorCol * tileW;
      const cy = startY + p.cursorRow * tileH;
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(cx - 3, cy - 10, tileW + 4, tileH + 4);
      ctx.restore();
    }

    // 7-slot Tray at bottom of card
    const slotW = Math.min(34, (cw - 24) / 7);
    const trayX = bx + (cw - slotW * 7) / 2;
    const trayY = by + ch - 56;
    ctx.fillStyle = '#0F1711';
    ctx.beginPath();
    ctx.roundRect(trayX - 4, trayY - 3, slotW * 7 + 8, 32, 7);
    ctx.fill();
    for (let s = 0; s < 7; s++) {
      const sx = trayX + s * slotW;
      ctx.strokeStyle = p.tray.length >= 6 ? '#EF4444' : '#365314';
      ctx.strokeRect(sx + 1, trayY, slotW - 2, 26);
      if (p.tray[s] !== undefined) {
        const sym = TRIPLE_SYMBOLS[p.tray[s] % TRIPLE_SYMBOLS.length];
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sym.glyph, sx + slotW / 2, trayY + 13);
      }
    }

    // Footer name + score
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(p.name.slice(0, 10), bx + 12, by + ch - 10);
    ctx.fillStyle = '#A3E635';
    ctx.textAlign = 'right';
    ctx.fillText(tCanvas(`${p.score} PTS`), bx + cw - 12, by + ch - 10);
  });

  drawHudChip(ctx, 20, 16, 'TILE TRIPLE', '#A3E635', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.timeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'tile-triple', snap.banner, null, '#A3E635');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 61. BLOCK HOP (跳一跳)
// ============================================================
export function renderBlockHop(ctx: CanvasRenderingContext2D, snap: BlockHopSnapshot): void {
  drawStudioBackdrop(ctx, '#0E1726', 'rgba(6, 182, 212, 0.16)', 'rgba(255,255,255,0.03)', 56);
  const ox = ARENA_WIDTH * 0.45 - snap.cameraX;
  const oy = ARENA_HEIGHT * 0.56 - snap.cameraY;

  // Draw isometric floating platforms
  for (const pl of snap.platforms) {
    const px = pl.x + ox;
    const py = pl.y + oy;
    const s = pl.size;
    drawExtrudedBox3D(
      ctx,
      px - s,
      py - s * 0.58,
      s * 2,
      s * 1.16,
      26,
      12,
      pl.colorHex,
      shadeHex(pl.colorHex, -0.4),
      '#FFFFFF'
    );
    // Bullseye center dot
    ctx.save();
    ctx.fillStyle = pl.kind === 'gold' ? '#FFFFFF' : 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(px, py - 26, 7, 0, Math.PI * 2);
    ctx.fill();
    if (pl.kind !== 'normal') {
      ctx.fillStyle = '#111827';
      ctx.font = '900 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pl.kind === 'gold' ? '★' : pl.kind === 'music' ? '♪' : '+', px, py - 26);
    }
    ctx.restore();
  }

  // Players (cute jumping chess-piece / spring pawns)
  for (const p of snap.players) {
    if (!p.alive) continue;
    const sx = p.x + ox;
    const sy = p.y + oy - 26;
    const squashY = 1 - p.charging * 0.36;
    const stretchX = 1 + p.charging * 0.28;

    // Charge ring beneath feet
    if (p.charging > 0.02) {
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sx, sy, 24 + p.charging * 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.charging);
      ctx.stroke();
      ctx.restore();
    }

    drawCharacterPod3D(ctx, sx, sy, 18, -0.5, p.colorHex, {
      playerId: p.id,
      zHeight: p.z,
      scaleX: stretchX,
      scaleY: squashY,
      hat: p.bullseyeStreak >= 2 ? 'crown' : 'none',
    });
    drawNameplate(ctx, sx, sy + 28, p.slotIndex, p.name, p.colorHex, `${p.score}`);
  }

  drawHudChip(ctx, 20, 16, 'BLOCK HOP', '#06B6D4', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.timeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'block-hop', snap.banner, null, '#06B6D4');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 62. PLATFORM LEAP (极速跳台)
// ============================================================
export function renderPlatformLeap(ctx: CanvasRenderingContext2D, snap: PlatformLeapSnapshot): void {
  drawStudioBackdrop(ctx, '#0E0A1C', 'rgba(244, 63, 94, 0.16)', 'rgba(255,255,255,0.03)', 48);

  // Draw sky ledges
  for (const pl of snap.platforms) {
    if (pl.cracked) continue;
    const sy = pl.y - snap.cameraY;
    const color =
      pl.kind === 'spring' ? '#10D98B' : pl.kind === 'moving' ? '#38BDF8' : pl.kind === 'crumble' ? '#F59E0B' : '#6366F1';
    drawExtrudedBox3D(ctx, pl.x, sy, pl.w, 16, 8, 6, color, shadeHex(color, -0.45), '#F8FAFC');
    if (pl.kind === 'spring') {
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(pl.x + pl.w / 2 - 18, sy - 11, 36, 5);
    }
  }

  // Players
  for (const p of snap.players) {
    if (!p.alive) continue;
    const sy = p.y - snap.cameraY;
    drawCharacterPod3D(ctx, p.x, sy, 18, p.vx >= 0 ? 0 : Math.PI, p.colorHex, {
      playerId: p.id,
      rimColor: p.stompTimer > 0 ? '#FACC15' : '#FFFFFF',
    });
    drawNameplate(ctx, p.x, sy + 28, p.slotIndex, p.name, p.colorHex, `${p.maxAltitude}m`);
  }

  // Rising Neon Lava floor
  const lavaScreenY = snap.lavaY - snap.cameraY;
  if (lavaScreenY < ARENA_HEIGHT + 40) {
    const t = getMotionTime();
    const lg = ctx.createLinearGradient(0, lavaScreenY, 0, ARENA_HEIGHT);
    lg.addColorStop(0, '#FB7185');
    lg.addColorStop(0.25, '#E11D48');
    lg.addColorStop(1, '#881337');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(0, ARENA_HEIGHT);
    for (let x = 0; x <= ARENA_WIDTH; x += 36) {
      ctx.lineTo(x, lavaScreenY + Math.sin(x * 0.025 + t * 5) * 8);
    }
    ctx.lineTo(ARENA_WIDTH, ARENA_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  drawHudChip(ctx, 20, 16, 'PLATFORM LEAP', '#F43F5E', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.timeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'platform-leap', snap.banner, null, '#F43F5E');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 63. EGG RUSH (蛋仔派对)
// ============================================================
export function renderEggRush(ctx: CanvasRenderingContext2D, snap: EggRushSnapshot): void {
  drawStudioBackdrop(ctx, '#1C142B', 'rgba(250, 204, 21, 0.16)', 'rgba(255,255,255,0.025)', 52);

  // Pastel candy obstacle track
  const trackY = 100;
  const trackH = 480;
  const trackGrad = ctx.createLinearGradient(0, trackY, 0, trackY + trackH);
  trackGrad.addColorStop(0, '#312E81');
  trackGrad.addColorStop(0.5, '#3730A3');
  trackGrad.addColorStop(1, '#1E1B4B');
  drawArenaSlab(ctx, 20, trackY, ARENA_WIDTH - 40, trackH, 20, 16, trackGrad, '#141133', '#FACC15', 3);

  // Lane guide stripes
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.setLineDash([22, 16]);
  for (let ly = trackY + 120; ly < trackY + trackH - 40; ly += 120) {
    ctx.beginPath();
    ctx.moveTo(26, ly);
    ctx.lineTo(ARENA_WIDTH - 26, ly);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Golden Finish Gate when in view
  const finX = snap.trackLength - snap.cameraX;
  if (finX > -40 && finX < ARENA_WIDTH + 60) {
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(finX - 8, trackY, 16, trackH);
    ctx.fillStyle = '#111827';
    for (let y = trackY; y < trackY + trackH; y += 24) {
      ctx.fillRect(finX - 8, y, 8, 12);
      ctx.fillRect(finX, y + 12, 8, 12);
    }
  }
  ctx.restore();

  // Obstacles
  for (const obs of snap.obstacles) {
    const ox = obs.x - snap.cameraX;
    if (obs.kind === 'boost') {
      ctx.fillStyle = 'rgba(16, 217, 139, 0.32)';
      ctx.strokeStyle = '#10D98B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(ox - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#6EE7B7';
      ctx.font = '900 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('>>>', ox, obs.y + 6);
    } else if (obs.kind === 'conveyor') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.fillRect(ox - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
      ctx.strokeRect(ox - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
    } else if (obs.kind === 'bumper') {
      drawSphere3D(ctx, ox, obs.y, 24, '#EC4899', '#FBCFE8', 0, true);
    } else if (obs.kind === 'sweeper') {
      ctx.save();
      ctx.translate(ox, obs.y);
      ctx.rotate(obs.angle);
      ctx.fillStyle = '#EF4444';
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-obs.w / 2, -10, obs.w, 20, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      drawSphere3D(ctx, ox, obs.y, 16, '#FACC15', '#FFFFFF', 0, false);
    }
  }

  // Cute Eggy players!
  for (const p of snap.players) {
    const px = p.x - snap.cameraX;
    if (px < -40 || px > ARENA_WIDTH + 40) continue;
    if (p.rolling) {
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px, p.y - p.z, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawCharacterPod3D(ctx, px, p.y, 20, 0, p.colorHex, {
      playerId: p.id,
      zHeight: p.z,
      rimColor: p.rolling ? '#FEF08A' : '#FFFFFF',
      hat: p.finishRank === 1 ? 'crown' : 'none',
    });
    drawNameplate(ctx, px, p.y + 30, p.slotIndex, p.name, p.colorHex, `${p.progressPct}%`);
  }

  drawHudChip(ctx, 20, 16, 'EGG RUSH', '#FACC15', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.timeLeft)}s`, '#38BDF8', 'right');
  drawBoardBanner(ctx, 'egg-rush', snap.banner, null, '#FACC15');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 64. GOOSE ALERT (鹅鸭杀)
// ============================================================
export function renderGooseAlert(ctx: CanvasRenderingContext2D, snap: GooseAlertSnapshot): void {
  drawStudioBackdrop(ctx, '#12131A', 'rgba(251, 146, 60, 0.14)', 'rgba(255,255,255,0.025)', 48);

  // Manor floor slab
  drawArenaSlab(ctx, 48, 56, ARENA_WIDTH - 96, ARENA_HEIGHT - 112, 22, 14, '#1E2430', '#0F131C', '#FB923C', 2.5);

  // Task Stations
  for (const st of snap.stations) {
    ctx.save();
    ctx.fillStyle = st.completed ? 'rgba(16, 217, 139, 0.22)' : 'rgba(251, 146, 60, 0.18)';
    ctx.strokeStyle = st.completed ? '#10D98B' : '#FB923C';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(st.x - 48, st.y - 28, 96, 56, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(st.label), st.x, st.y - 6);

    // Progress bar
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(st.x - 34, st.y + 8, 68, 9);
    ctx.fillStyle = st.completed ? '#10D98B' : '#FACC15';
    ctx.fillRect(st.x - 34, st.y + 8, 68 * clamp01(st.progress), 9);
    ctx.restore();
  }

  // Players + Honk radar rings
  for (const p of snap.players) {
    if (!p.alive) {
      // Eliminated ghost feather marker
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✕', p.x, p.y);
      ctx.restore();
      continue;
    }

    if (p.honkWaveTimer > 0) {
      const r = (1 - p.honkWaveTimer / 0.65) * 230 + 30;
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.globalAlpha = clamp01(p.honkWaveTimer * 1.4);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawCharacterPod3D(ctx, p.x, p.y, 19, p.angle, p.colorHex, {
      playerId: p.id,
      rimColor: p.revealedDuck ? '#EF4444' : '#FFFFFF',
    });
    drawNameplate(
      ctx,
      p.x,
      p.y + 30,
      p.slotIndex,
      p.name,
      p.revealedDuck ? '#EF4444' : p.colorHex,
      p.revealedDuck ? 'DUCK!' : undefined
    );
  }

  drawHudChip(ctx, 20, 16, `TASKS ${snap.completedTasks}/${snap.totalTasks}`, '#10D98B', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.timeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'goose-alert', snap.banner, null, '#FB923C');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 65. HOTPOT RUSH (火锅夹菜王)
// ============================================================
export function renderHotpotRush(ctx: CanvasRenderingContext2D, snap: HotpotRushSnapshot): void {
  drawStudioBackdrop(ctx, '#1A0F0E', 'rgba(239, 68, 68, 0.18)', 'rgba(255, 220, 170, 0.025)', 52);
  const { potX: cx, potY: cy, potR: r } = snap;

  // Metallic outer pot base
  drawExtrudedDiscStage(ctx, cx, cy, r + 18, 22, '#64748B', '#334155', '#E2E8F0');

  // Split Yin-Yang Sichuan Broth (Left: Red Mala, Right: Golden Broth)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.closePath();
  ctx.fillStyle = '#991B1B';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = '#B45309';
  ctx.fill();

  // S-curve divider
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.bezierCurveTo(cx + 42, cy - r * 0.45, cx - 42, cy + r * 0.45, cx, cy + r);
  ctx.stroke();

  // Bubbles
  for (const b of snap.bubbles) {
    ctx.strokeStyle = b.broth === 'mala' ? `rgba(254, 202, 202, ${b.alpha * 0.6})` : `rgba(254, 240, 138, ${b.alpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Floating ingredients
  const ingIcons: Record<string, { col: string; glyph: string }> = {
    beef: { col: '#DC2626', glyph: '🥩' },
    shrimp: { col: '#FB923C', glyph: '🍤' },
    dumpling: { col: '#FEF08A', glyph: '🥟' },
    mushroom: { col: '#A8A29E', glyph: '🍄' },
    chili: { col: '#EF4444', glyph: '🌶️' },
    'golden-ball': { col: '#FACC15', glyph: '✨' },
  };
  for (const ing of snap.ingredients) {
    const perfect = ing.kind !== 'chili' && ing.cookPct >= 55 && ing.cookPct <= 95;
    const spec = ingIcons[ing.kind] ?? ingIcons.beef;
    drawSphere3D(ctx, ing.x, ing.y, ing.r, spec.col, perfect ? '#FEF08A' : undefined, 0, false);
    ctx.font = `${Math.round(ing.r * 1.15)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.glyph, ing.x, ing.y + 1);
  }

  // Player Chopsticks reaching from around the table
  for (const p of snap.players) {
    const handX = cx + Math.cos(p.seatAngle) * (r + 145);
    const handY = cy + Math.sin(p.seatAngle) * (r + 115);
    const spread = p.snatchTimer > 0 ? 3 : 10;

    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(handX - 6, handY - 6);
    ctx.lineTo(p.tipX - spread * 0.4, p.tipY - spread * 0.4);
    ctx.moveTo(handX + 6, handY + 6);
    ctx.lineTo(p.tipX + spread * 0.4, p.tipY + spread * 0.4);
    ctx.stroke();

    // Tip reticle
    ctx.strokeStyle = p.spicyBurnTimer > 0 ? '#EF4444' : p.parryTimer > 0 ? '#FACC15' : '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.tipX, p.tipY, p.parryTimer > 0 ? 32 : 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    drawNameplate(
      ctx,
      clamp01((handX - 60) / (ARENA_WIDTH - 120)) * (ARENA_WIDTH - 160) + 80,
      clamp01((handY - 40) / (ARENA_HEIGHT - 80)) * (ARENA_HEIGHT - 80) + 40,
      p.slotIndex,
      p.name,
      p.colorHex,
      `${p.score}`
    );
  }

  drawHudChip(ctx, 20, 16, 'HOTPOT RUSH', '#EF4444', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.timeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'hotpot-rush', snap.banner, null, '#EF4444');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 66. CLAW MANIA (娃娃机大作战)
// ============================================================
export function renderClawMania(ctx: CanvasRenderingContext2D, snap: ClawManiaSnapshot): void {
  drawStudioBackdrop(ctx, '#160B24', 'rgba(232, 121, 249, 0.16)', 'rgba(255,255,255,0.03)', 48);
  const { binX, binY, binW, binH } = snap;

  drawArenaSlab(ctx, binX, binY, binW, binH, 20, 16, '#1E1533', '#0D0818', '#E879F9', 3);

  // 3 neon conveyor belts
  for (let row = 0; row < 3; row++) {
    const by = binY + 75 + row * 125;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(binX + 16, by - 30, binW - 32, 60);
  }

  // Prizes
  const icons: Record<string, string> = {
    dragon: '🐉',
    capsule: '🔮',
    bear: '🧸',
    duck: '🐤',
    bomb: '💣',
  };
  for (const pr of snap.prizes) {
    drawSphere3D(ctx, pr.x, pr.y, pr.r, pr.colorHex, pr.kind === 'dragon' ? '#FEF08A' : '#FFFFFF', 0, true);
    ctx.font = `${Math.round(pr.r * 1.15)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icons[pr.kind] ?? '🎁', pr.x, pr.y + 1);
  }

  // Overhead Claw Gantries
  for (const p of snap.players) {
    const scale = 1 - p.clawDepth * 0.25;
    ctx.save();
    // Magnet aura
    if (p.magnetTimer > 0) {
      ctx.strokeStyle = '#00C2FF';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Crosshair claw prongs
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 4;
    const rad = 22 * scale;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * rad, p.y + Math.sin(a) * rad);
      ctx.lineTo(p.x + Math.cos(a) * (rad * 0.4), p.y + Math.sin(a) * (rad * 0.4));
      ctx.stroke();
    }
    ctx.restore();
    drawNameplate(ctx, p.x, p.y + 34, p.slotIndex, p.name, p.colorHex, `${p.score}`);
  }

  drawHudChip(ctx, 20, 16, 'CLAW MANIA', '#E879F9', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.timeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'claw-mania', snap.banner, null, '#E879F9');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 67. TRUTH BOMB (真心话大冒险轮盘)
// ============================================================
export function renderTruthBomb(ctx: CanvasRenderingContext2D, snap: TruthBombSnapshot): void {
  drawStudioBackdrop(ctx, '#1A0D14', 'rgba(255, 77, 46, 0.18)', 'rgba(255,255,255,0.03)', 52);
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 12;

  // Spinning Party Wheel
  drawExtrudedDiscStage(ctx, cx, cy, 215, 18, '#271722', '#140B11', '#FF4D2E');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(snap.wheelAngle);
  for (let i = 0; i < 8; i++) {
    const a1 = (i * Math.PI) / 4;
    const a2 = a1 + Math.PI / 4;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 77, 46, 0.25)' : 'rgba(250, 204, 21, 0.18)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 205, a1, a2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Player seats around wheel
  for (const p of snap.players) {
    const px = cx + Math.cos(p.seatAngle) * 265;
    const py = cy + Math.sin(p.seatAngle) * 185;
    drawCharacterPod3D(ctx, px, py, 20, p.seatAngle + Math.PI, p.colorHex, {
      playerId: p.id,
      scale: p.hasBomb ? 1.18 : 1,
      rimColor: p.hasBomb ? '#FF4D2E' : '#FFFFFF',
    });
    if (p.hasBomb) {
      drawSphere3D(ctx, px, py - 34, 15, '#111827', '#FF4D2E', 0, false);
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💣', px, py - 34);
    }
    drawNameplate(ctx, px, py + 32, p.slotIndex, p.name, p.colorHex, `${p.score}`);
  }

  // Center Fuse Gauge OR Truth/Dare Card
  ctx.save();
  if (snap.phase === 'challenge' && snap.challengeEn) {
    ctx.fillStyle = 'rgba(13, 15, 22, 0.96)';
    ctx.strokeStyle = snap.challengeKind === 'DARE' ? '#FF4D2E' : '#00C2FF';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(cx - 240, cy - 88, 480, 176, 18);
    ctx.fill();
    ctx.stroke();

    const isZh = getActiveCanvasLang() === 'zh';
    ctx.fillStyle = snap.challengeKind === 'DARE' ? '#FF4D2E' : '#00C2FF';
    ctx.font = '900 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      tCanvas(`${snap.challengeKind}${snap.doubleStakes ? ' ×2 STAKES!' : ''} · VOTES ${snap.votesDone}/${snap.votesNeeded}`),
      cx,
      cy - 54
    );

    if (isZh && snap.challengeZh) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 19px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(snap.challengeZh, cx, cy + 4);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(snap.challengeEn.slice(0, 56), cx, cy - 8);
      ctx.fillStyle = '#FDE047';
      ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(snap.challengeZh ?? '', cx, cy + 26);
    }
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText(tCanvas('OTHER PLAYERS: PRESS A TO VOTE DONE!'), cx, cy + 62);
  } else {
    // Fuse countdown ring
    const danger = snap.fuseRatio < 0.3;
    ctx.strokeStyle = danger ? '#EF4444' : '#FACC15';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 74, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * snap.fuseRatio);
    ctx.stroke();
    ctx.font = '44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💣', cx, cy);
  }
  ctx.restore();

  drawHudChip(ctx, 20, 16, `RD ${snap.round}/${snap.totalRounds}`, '#FF4D2E', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.phaseTimer)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'truth-bomb', snap.banner, null, '#FF4D2E');
  drawPopupTexts(ctx, snap.popups);
}

// ============================================================
// 68. DRAW & GUESS RELAY (你画我猜)
// ============================================================
export function renderDrawGuessRelay(ctx: CanvasRenderingContext2D, snap: DrawGuessRelaySnapshot): void {
  drawStudioBackdrop(ctx, '#111622', 'rgba(56, 189, 248, 0.14)', 'rgba(255,255,255,0.025)', 48);

  // Left Whiteboard Sketchpad
  drawArenaSlab(ctx, 96, 110, 660, 470, 18, 12, '#F8FAFC', '#94A3B8', '#38BDF8', 3);

  // Painted strokes (clipped neatly inside whiteboard interior)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(102, 116, 648, 458, 14);
  ctx.clip();

  // Subtle drawing paper guide grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = 156; gx < 740; gx += 60) {
    ctx.moveTo(gx, 120);
    ctx.lineTo(gx, 570);
  }
  for (let gy = 170; gy < 570; gy += 60) {
    ctx.moveTo(106, gy);
    ctx.lineTo(746, gy);
  }
  ctx.stroke();

  const strokeWidth = 8;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < snap.strokes.length; i++) {
    const cur = snap.strokes[i];
    const prev = i > 0 ? snap.strokes[i - 1] : null;
    if (cur.newStroke || !prev) {
      ctx.fillStyle = cur.colorHex;
      ctx.beginPath();
      ctx.arc(cur.x, cur.y, strokeWidth * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = cur.colorHex;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();
    }
  }

  // Ink palette indicator row at bottom-left of whiteboard
  const inkPalette = ['#111827', '#EF4444', '#2563EB', '#10B981', '#F59E0B', '#9333EA'];
  inkPalette.forEach((hex, idx) => {
    const sx = 128 + idx * 24;
    const sy = 556;
    const active = hex.toLowerCase() === snap.brushColor.toLowerCase();
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.arc(sx, sy, active ? 8.5 : 6, 0, Math.PI * 2);
    ctx.fill();
    if (active) {
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  });

  // Live brush cursor
  if (snap.phase === 'drawing') {
    if (snap.isDrawing) {
      ctx.strokeStyle = snap.brushColor;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(snap.brushX, snap.brushY, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = snap.brushColor;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(snap.brushX, snap.brushY, snap.isDrawing ? 9 : 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Right 4 Bilingual Guess Option Cards
  snap.options.forEach((opt, i) => {
    const oy = 120 + i * 112;
    const isAns = snap.revealedWord && snap.revealedWord.en === opt.en;
    const pickers = snap.players.filter((p) => !p.isArtist && p.cursorOption === i);
    ctx.save();
    ctx.fillStyle = isAns ? 'rgba(16, 217, 139, 0.28)' : 'rgba(22, 27, 38, 0.92)';
    ctx.strokeStyle = isAns ? '#10D98B' : pickers.length > 0 ? '#38BDF8' : '#334155';
    ctx.lineWidth = isAns ? 3.5 : 2;
    ctx.beginPath();
    ctx.roundRect(786, oy, 330, 92, 14);
    ctx.fill();
    ctx.stroke();

    const isZh = getActiveCanvasLang() === 'zh';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 18px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}. ${isZh ? opt.zh : opt.en}`, 806, oy + 36);
    ctx.fillStyle = '#FDE047';
    ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(isZh ? opt.en : opt.zh, 806, oy + 64);

    // Picker color dots + lock checkmark
    pickers.forEach((pk, k) => {
      const px = 1090 - k * 22;
      const py = oy + 26;
      ctx.fillStyle = pk.colorHex;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
      if (pk.lockedGuess) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
    ctx.restore();
  });

  drawHudChip(ctx, 20, 16, `ARTIST: ${snap.artistName} · RD ${snap.round}/${snap.totalRounds}`, '#38BDF8', 'left');
  drawHudChip(ctx, ARENA_WIDTH - 20, 16, `${Math.ceil(snap.timeLeft)}s`, '#FDE047', 'right');
  drawBoardBanner(ctx, 'draw-guess-relay', snap.banner, null, '#38BDF8');
  drawPopupTexts(ctx, snap.popups);
}

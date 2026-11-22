import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type LavaHopperSnapshot,
  type VolleySmashSnapshot,
} from '../shared/types';
import { drawNameplate, drawPopupTexts, tCanvas } from './renderers';
import {
  drawArenaSlab,
  drawCharacterPod3D,
  drawExtrudedCylinder3D,
  drawShadowOval,
  drawSphere3D,
  drawSpinningGem3D,
  drawStudioBackdrop,
} from './render25d';
import { getMotionTime, getSpringBannerAnim } from './arcadeMotion';

function drawHudChip(
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
  const w = Math.max(92, ctx.measureText(label).width + 22);
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

// ============================================================
// 33. VOLLEY SMASH (2.5D Arcade Beach Volleyball)
// ============================================================
export function renderVolleySmash(
  ctx: CanvasRenderingContext2D,
  snap: VolleySmashSnapshot
): void {
  drawStudioBackdrop(ctx, '#06141F', 'rgba(0, 194, 255, 0.14)', 'rgba(255, 184, 0, 0.05)', 44);

  const left = 110;
  const right = ARENA_WIDTH - 110;
  const top = 130;
  const bottom = ARENA_HEIGHT - 95;
  const courtW = right - left;
  const courtH = bottom - top;
  const netX = ARENA_WIDTH / 2;

  // Extruded sand court slab
  drawArenaSlab(ctx, left, top, courtW, courtH, 22, 16, '#D9A75A', '#7C5826', '#F6D38B');

  // Red & Blue team court tint halves
  ctx.save();
  ctx.fillStyle = 'rgba(255, 77, 46, 0.15)';
  ctx.beginPath();
  ctx.roundRect(left + 10, top + 10, courtW / 2 - 14, courtH - 20, 14);
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 194, 255, 0.15)';
  ctx.beginPath();
  ctx.roundRect(netX + 4, top + 10, courtW / 2 - 14, courtH - 20, 14);
  ctx.fill();

  // Court boundary lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 3;
  ctx.strokeRect(left + 18, top + 18, courtW - 36, courtH - 36);
  ctx.restore();

  // Pulsing Landing Target Ring on sand
  const pulse = 0.5 + 0.5 * Math.sin(getMotionTime() * 8);
  ctx.save();
  const targetColor = snap.ball.hot ? '#FF4D2E' : '#00C2FF';
  ctx.strokeStyle = targetColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(
    snap.ball.targetX,
    snap.ball.targetY,
    24 + pulse * 8,
    15 + pulse * 5,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  ctx.fillStyle = snap.ball.hot ? 'rgba(255, 77, 46, 0.22)' : 'rgba(0, 194, 255, 0.18)';
  ctx.fill();
  ctx.restore();

  // Shockwaves
  for (const sw of snap.shockwaves) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, sw.alpha);
    ctx.strokeStyle = sw.colorHex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Center holographic net & posts
  drawExtrudedCylinder3D(ctx, netX, top + 12, 10, 26, '#94A3B8', '#334155');
  drawExtrudedCylinder3D(ctx, netX, bottom - 12, 10, 26, '#94A3B8', '#334155');
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(netX, top + 10);
  ctx.lineTo(netX, bottom - 10);
  ctx.stroke();
  ctx.strokeStyle = '#00C2FF';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(netX, top + 10);
  ctx.lineTo(netX, bottom - 10);
  ctx.stroke();
  ctx.restore();

  // Players sorted by Y
  const sortedPlayers = [...snap.players].sort((a, b) => a.y - b.y);
  for (const p of sortedPlayers) {
    const drawY = p.y - p.z * 0.55;
    drawCharacterPod3D(
      ctx,
      p.x,
      p.y,
      21,
      p.team === 'red' ? 0 : Math.PI,
      p.colorHex,
      {
        playerId: p.id,
        zHeight: p.z * 0.55,
        flash: p.spikeTimer > 0 || p.setTimer > 0 ? 0.55 : 0,
      }
    );
    drawNameplate(
      ctx,
      p.x,
      drawY - 34,
      p.slotIndex,
      p.name,
      p.colorHex,
      p.team === 'red' ? 'RED' : 'BLUE'
    );
  }

  // Volleyball shadow & 3D ball in flight
  drawSphere3D(
    ctx,
    snap.ball.x,
    snap.ball.y,
    17,
    snap.ball.hot ? '#FF4D2E' : '#F8FAFC',
    snap.ball.hot ? '#FFB800' : '#00C2FF',
    snap.ball.z * 0.62
  );

  // Top Scoreboard Chips
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 - 125,
    18,
    `RED TEAM: ${snap.scoreRed}/${snap.targetPoints}`,
    '#FF4D2E'
  );
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 + 125,
    18,
    `BLUE TEAM: ${snap.scoreBlue}/${snap.targetPoints}`,
    '#00C2FF'
  );

  drawPopupTexts(ctx, snap.popups);

  if (snap.goalBanner) {
    const anim = getSpringBannerAnim('volley-goal', snap.goalBanner);
    ctx.save();
    ctx.translate(ARENA_WIDTH / 2, ARENA_HEIGHT / 2 - 20);
    ctx.scale(anim.scale, anim.scale);
    ctx.globalAlpha = anim.alpha;
    ctx.font = '900 28px "Plus Jakarta Sans", sans-serif';
    const txt = tCanvas(snap.goalBanner);
    const w = Math.max(320, ctx.measureText(txt).width + 60);
    ctx.fillStyle = 'rgba(13, 15, 20, 0.94)';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -30, w, 60, 14);
    ctx.fill();
    ctx.strokeStyle = snap.goalBannerColor || '#FFB800';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, 0, 1);
    ctx.restore();
  }
}

// ============================================================
// 34. LAVA HOPPER (2.5D Sinking Magma Pillars Survival)
// ============================================================
export function renderLavaHopper(
  ctx: CanvasRenderingContext2D,
  snap: LavaHopperSnapshot
): void {
  drawStudioBackdrop(ctx, '#180705', 'rgba(255, 77, 46, 0.22)', 'rgba(255, 184, 0, 0.08)', 48);

  const t = getMotionTime();

  // Bubbling magma veins across the caldera floor
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const rx = 180 + ((i * 155) % (ARENA_WIDTH - 320));
    const ry = 140 + ((i * 115) % (ARENA_HEIGHT - 240));
    const rad = 28 + Math.sin(t * 2.5 + i) * 10;
    const grad = ctx.createRadialGradient(rx, ry, 4, rx, ry, rad * 2.2);
    grad.addColorStop(0, 'rgba(255, 184, 0, 0.24)');
    grad.addColorStop(0.5, 'rgba(255, 77, 46, 0.14)');
    grad.addColorStop(1, 'rgba(255, 77, 46, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(rx, ry, rad * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Render Basalt Pillars
  for (const pl of snap.pillars) {
    if (pl.state === 'sunk') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 77, 46, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, pl.r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    const isWarn = pl.state === 'warning';
    const shakeX = isWarn ? Math.sin(t * 36 + pl.id) * 2.5 : 0;
    const topHex = isWarn ? '#FF7A1A' : '#475569';
    const sideHex = isWarn ? '#9A3412' : '#1E293B';

    drawExtrudedCylinder3D(
      ctx,
      pl.x + shakeX,
      pl.y,
      pl.r,
      isWarn ? 12 : 20,
      topHex,
      sideHex
    );

    if (isWarn) {
      ctx.save();
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pl.x + shakeX, pl.y - 12, pl.r - 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (pl.hasGem) {
      drawSpinningGem3D(ctx, pl.x + shakeX, pl.y - 22, 13, '#FFB800', t * 3 + pl.id);
    }
  }

  // Shockwaves from Stomp (B)
  for (const sw of snap.stompWaves) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, sw.alpha);
    ctx.strokeStyle = sw.colorHex;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Magma Fireballs
  for (const fb of snap.fireballs) {
    drawShadowOval(ctx, fb.x, fb.y + 10, fb.r, fb.r * 0.55, 0.35);
    drawSphere3D(ctx, fb.x, fb.y, fb.r, '#FFB800', '#FF4D2E');
  }

  // Players
  const sortedPlayers = [...snap.players].sort((a, b) => a.y - b.y);
  for (const p of sortedPlayers) {
    if (!p.alive) continue;
    const drawY = p.y - p.z * 0.65;
    drawCharacterPod3D(ctx, p.x, p.y, 20, p.angle, p.colorHex, {
      playerId: p.id,
      zHeight: p.z * 0.65,
      flash: p.leapTimer > 0 || p.stompTimer > 0 ? 0.5 : 0,
    });
    drawNameplate(ctx, p.x, drawY - 34, p.slotIndex, p.name, p.colorHex, `${p.score} pts`);
  }

  drawHudChip(ctx, ARENA_WIDTH / 2 - 110, 18, `WAVE ${snap.wave}`, '#FF4D2E');
  drawHudChip(ctx, ARENA_WIDTH / 2 + 110, 18, `TIME: ${Math.ceil(snap.timeLeft)}s`, '#FFB800');
  drawPopupTexts(ctx, snap.popups);
}

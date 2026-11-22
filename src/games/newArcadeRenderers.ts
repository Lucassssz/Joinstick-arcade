import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type LavaHopperSnapshot,
  type VolleySmashSnapshot,
} from '../shared/types';
import { drawHudChip, drawNameplate, drawPopupTexts, tCanvas } from './canvasHelpers';
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

// ============================================================
// 33. VOLLEY SMASH (2.5D Arcade Beach Volleyball)
// ============================================================
export function renderVolleySmash(
  ctx: CanvasRenderingContext2D,
  snap: VolleySmashSnapshot
): void {
  drawStudioBackdrop(ctx, '#06141F', 'rgba(0, 194, 255, 0.16)', 'rgba(255, 184, 0, 0.06)', 44);

  const left = 110;
  const right = ARENA_WIDTH - 110;
  const top = 130;
  const bottom = ARENA_HEIGHT - 95;
  const courtW = right - left;
  const courtH = bottom - top;
  const netX = ARENA_WIDTH / 2;
  const t = getMotionTime();
  const hasBluePlayers = snap.players.some((p) => p.team === 'blue');

  // Extruded beach sand court slab
  drawArenaSlab(ctx, left, top, courtW, courtH, 22, 18, '#DDA95B', '#7C5826', '#F9DA97');

  // Subtle sand grain bands & team half zones
  ctx.save();
  ctx.fillStyle = 'rgba(255, 77, 46, 0.15)';
  ctx.beginPath();
  ctx.roundRect(left + 12, top + 12, courtW / 2 - 16, courtH - 24, 14);
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 194, 255, 0.15)';
  ctx.beginPath();
  ctx.roundRect(netX + 4, top + 12, courtW / 2 - 16, courtH - 24, 14);
  ctx.fill();

  // Court crisp white boundary & attack lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 3;
  ctx.strokeRect(left + 18, top + 18, courtW - 36, courtH - 36);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(netX - 135, top + 18);
  ctx.lineTo(netX - 135, bottom - 18);
  ctx.moveTo(netX + 135, top + 18);
  ctx.lineTo(netX + 135, bottom - 18);
  ctx.stroke();
  ctx.setLineDash([]);

  // Solo mode Holo-Keeper badge on Blue side
  if (!hasBluePlayers) {
    ctx.fillStyle = 'rgba(0, 194, 255, 0.22)';
    ctx.font = '900 18px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tCanvas('HOLO-KEEPER ZONE (SPIKE TO SCORE!)'), netX + courtW * 0.25, (top + bottom) / 2);
  }
  ctx.restore();

  // Pulsing Landing Target Crosshair on sand
  const pulse = 0.5 + 0.5 * Math.sin(t * 9);
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
  ctx.fillStyle = snap.ball.hot ? 'rgba(255, 77, 46, 0.24)' : 'rgba(0, 194, 255, 0.2)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(snap.ball.targetX - 12, snap.ball.targetY);
  ctx.lineTo(snap.ball.targetX + 12, snap.ball.targetY);
  ctx.moveTo(snap.ball.targetX, snap.ball.targetY - 8);
  ctx.lineTo(snap.ball.targetX, snap.ball.targetY + 8);
  ctx.stroke();
  ctx.restore();

  // Shockwaves
  for (const sw of snap.shockwaves) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, sw.alpha);
    ctx.strokeStyle = sw.colorHex;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Center holographic volleyball net & metallic posts
  drawExtrudedCylinder3D(ctx, netX, top + 12, 11, 30, '#CBD5E1', '#334155');
  drawExtrudedCylinder3D(ctx, netX, bottom - 12, 11, 30, '#CBD5E1', '#334155');
  ctx.save();
  ctx.fillStyle = 'rgba(0, 194, 255, 0.14)';
  ctx.fillRect(netX - 5, top + 12, 10, courtH - 24);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(netX, top + 10);
  ctx.lineTo(netX, bottom - 10);
  ctx.stroke();
  ctx.strokeStyle = '#00C2FF';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 7]);
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
      22,
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
      drawY - 36,
      p.slotIndex,
      p.name,
      p.colorHex,
      p.team === 'red' ? 'RED' : 'BLUE'
    );
  }

  // Altitude guide line + ground shadow + 3D Volleyball in flight
  const ballLift = snap.ball.z * 0.62;
  drawShadowOval(
    ctx,
    snap.ball.x,
    snap.ball.y + 4,
    Math.max(8, 17 - snap.ball.z * 0.03),
    Math.max(5, 10 - snap.ball.z * 0.02),
    0.35
  );
  if (ballLift > 10) {
    ctx.save();
    ctx.strokeStyle = snap.ball.hot ? 'rgba(255, 77, 46, 0.45)' : 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(snap.ball.x, snap.ball.y);
    ctx.lineTo(snap.ball.x, snap.ball.y - ballLift);
    ctx.stroke();
    ctx.restore();
  }
  drawSphere3D(
    ctx,
    snap.ball.x,
    snap.ball.y,
    18,
    snap.ball.hot ? '#FF4D2E' : '#F8FAFC',
    snap.ball.hot ? '#FFB800' : '#00C2FF',
    ballLift
  );

  // Top Scoreboard Chips
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 - 135,
    18,
    `RED TEAM: ${snap.scoreRed}/${snap.targetPoints}`,
    '#FF4D2E'
  );
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2 + 135,
    18,
    `${hasBluePlayers ? 'BLUE TEAM' : 'HOLO-CPU'}: ${snap.scoreBlue}/${snap.targetPoints}`,
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
  drawStudioBackdrop(ctx, '#1A0705', 'rgba(255, 77, 46, 0.24)', 'rgba(255, 184, 0, 0.08)', 48);

  const t = getMotionTime();

  // Bubbling glowing magma caldera backdrop
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const rx = 140 + ((i * 135) % (ARENA_WIDTH - 240));
    const ry = 120 + ((i * 97) % (ARENA_HEIGHT - 200));
    const rad = 30 + Math.sin(t * 2.6 + i * 1.1) * 12;
    const grad = ctx.createRadialGradient(rx, ry, 4, rx, ry, rad * 2.4);
    grad.addColorStop(0, 'rgba(255, 200, 30, 0.28)');
    grad.addColorStop(0.5, 'rgba(255, 77, 46, 0.16)');
    grad.addColorStop(1, 'rgba(255, 77, 46, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(rx, ry, rad * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Render Basalt Pillars
  for (const pl of snap.pillars) {
    if (pl.state === 'sunk') {
      ctx.save();
      const pulseR = pl.r * (0.65 + 0.1 * Math.sin(t * 5 + pl.id));
      ctx.strokeStyle = 'rgba(255, 100, 46, 0.5)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, pulseR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 77, 46, 0.14)';
      ctx.fill();
      ctx.restore();
      continue;
    }

    const isWarn = pl.state === 'warning';
    const shakeX = isWarn ? Math.sin(t * 38 + pl.id) * 3 : 0;
    const topHex = isWarn ? '#FF7A1A' : '#4B5563';
    const sideHex = isWarn ? '#9A3412' : '#1F2937';
    const height = isWarn ? 11 + Math.max(0, pl.timer * 3) : 22;

    drawExtrudedCylinder3D(ctx, pl.x + shakeX, pl.y, pl.r, height, topHex, sideHex);

    // Top basalt stone ring highlight or glowing warning crack ring
    ctx.save();
    ctx.strokeStyle = isWarn ? '#FEF08A' : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = isWarn ? 3 : 2;
    ctx.beginPath();
    ctx.arc(pl.x + shakeX, pl.y - height, pl.r - 9, 0, Math.PI * 2);
    ctx.stroke();
    if (isWarn) {
      ctx.fillStyle = '#FEF08A';
      ctx.font = '900 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', pl.x + shakeX, pl.y - height);
    }
    ctx.restore();

    if (pl.hasGem) {
      drawSpinningGem3D(ctx, pl.x + shakeX, pl.y - height - 10, 14, '#FFB800', t * 3.2 + pl.id);
    }
  }

  // Shockwaves from Stomp (B)
  for (const sw of snap.stompWaves) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, sw.alpha);
    ctx.strokeStyle = sw.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Magma Fireballs with bright glow
  for (const fb of snap.fireballs) {
    drawShadowOval(ctx, fb.x, fb.y + 12, fb.r, fb.r * 0.55, 0.38);
    drawSphere3D(ctx, fb.x, fb.y, fb.r, '#FFB800', '#FF4D2E');
  }

  // Players sorted by Y
  const sortedPlayers = [...snap.players].sort((a, b) => a.y - b.y);
  for (const p of sortedPlayers) {
    if (!p.alive) continue;
    const drawY = p.y - p.z * 0.65;
    drawCharacterPod3D(ctx, p.x, p.y, 20, p.angle, p.colorHex, {
      playerId: p.id,
      zHeight: p.z * 0.65,
      flash: p.leapTimer > 0 || p.stompTimer > 0 ? 0.55 : 0,
    });
    drawNameplate(ctx, p.x, drawY - 36, p.slotIndex, p.name, p.colorHex, `${p.score} pts`);
  }

  drawHudChip(ctx, ARENA_WIDTH / 2 - 120, 18, `WAVE ${snap.wave}`, '#FF4D2E');
  drawHudChip(ctx, ARENA_WIDTH / 2 + 120, 18, `TIME: ${Math.ceil(snap.timeLeft)}s`, '#FFB800');
  drawPopupTexts(ctx, snap.popups);
}

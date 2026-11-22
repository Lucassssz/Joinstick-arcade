import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import type {
  ArcheryWindSnapshot,
  BadmintonSmashSnapshot,
  BilliardsSnookerSnapshot,
  BoxingKoSnapshot,
  CanoeSprintSnapshot,
  DiscArenaSnapshot,
  DodgeballRiotSnapshot,
  HomeRunDerbySnapshot,
  HoopBlitzSnapshot,
  MiniGolfProSnapshot,
  PenaltyDuelSnapshot,
  PingPongProSnapshot,
  SumoClashSnapshot,
  TetherJoustSnapshot,
} from '../shared/packSportsPhysicsTypes';
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
} from './packRenderHelpers';
import { getMotionTime } from './arcadeMotion';

// 1. HOOP BLITZ
export function renderHoopBlitz(ctx: CanvasRenderingContext2D, snap: HoopBlitzSnapshot): void {
  drawStudioBackdrop(ctx, '#120C08', 'rgba(249,115,22,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 70, 82, ARENA_WIDTH - 140, ARENA_HEIGHT - 116, 20, '#854D0E', '#F97316');

  // Hardwood court lines & 3pt arc
  ctx.save();
  ctx.strokeStyle = 'rgba(254,240,138,0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(100, 108, ARENA_WIDTH - 200, ARENA_HEIGHT - 168);
  ctx.beginPath();
  ctx.arc(snap.hoopX, snap.hoopY + 20, 310, 0.22 * Math.PI, 0.78 * Math.PI);
  ctx.stroke();

  // Backboard + glowing orange rim
  drawExtrudedBox3D(ctx, snap.hoopX - 78, snap.hoopY - 54, 156, 48, 8, '#E2E8F0', '#94A3B8', 8);
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 3;
  ctx.strokeRect(snap.hoopX - 28, snap.hoopY - 40, 56, 28);
  ctx.strokeStyle = '#F97316';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(snap.hoopX, snap.hoopY, 34, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  for (const p of snap.players) {
    drawCharacterPod3D(ctx, p.x, 608, 24, p.colorHex, p.aimAngle, p.charging ? 8 : 0);
    // Aim reticle & sweet-spot power bar
    const rx = p.x + Math.cos(p.aimAngle) * 140;
    const ry = 608 + Math.sin(p.aimAngle) * 140;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, 595);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ctx.restore();

    if (p.charging) {
      drawExtrudedBox3D(ctx, p.x - 36, 642, 72, 12, 3, '#1E293B', '#0F172A', 4);
      ctx.fillStyle = Math.abs(p.power - 0.72) < 0.12 ? '#22C55E' : '#FACC15';
      ctx.fillRect(p.x - 34, 644, 68 * p.power, 8);
    }
    drawNameplate(ctx, p.x, 568, `${p.name} · ${p.score}`, p.colorHex);
  }

  for (const b of snap.balls) {
    drawShadowOval(ctx, b.x, Math.min(640, b.y + 35), 14, 0.3);
    drawSphere3D(ctx, b.x, b.y, 15, b.moneyBall ? '#FACC15' : '#EA580C', b.moneyBall ? '#FEF08A' : '#FDBA74');
  }

  drawPopupTexts(ctx, snap.popups);
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#F97316');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F97316', 16);
}

// 2. PENALTY DUEL
export function renderPenaltyDuel(ctx: CanvasRenderingContext2D, snap: PenaltyDuelSnapshot): void {
  drawStudioBackdrop(ctx, '#06150E', 'rgba(34,197,94,0.15)', 'rgba(255,255,255,0.03)', 46);
  drawArenaSlab(ctx, 80, 96, ARENA_WIDTH - 160, ARENA_HEIGHT - 130, 18, '#15803D', '#22C55E');

  // Penalty box & Goalposts
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 3;
  ctx.strokeRect(ARENA_WIDTH / 2 - 360, snap.goalY, 720, 260);
  const gx0 = snap.goalX - snap.goalW / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(gx0, snap.goalY - 65, snap.goalW, 70);
  drawExtrudedBox3D(ctx, gx0 - 10, snap.goalY - 72, snap.goalW + 20, 14, 6, '#F8FAFC', '#94A3B8', 6);
  drawExtrudedBox3D(ctx, gx0 - 10, snap.goalY - 68, 12, 74, 6, '#F8FAFC', '#94A3B8', 4);
  drawExtrudedBox3D(ctx, gx0 + snap.goalW - 2, snap.goalY - 68, 12, 74, 6, '#F8FAFC', '#94A3B8', 4);
  ctx.restore();

  // Goalkeeper
  ctx.save();
  ctx.translate(snap.keeperX, snap.goalY + 18);
  ctx.rotate(snap.keeperDive * 0.35);
  drawExtrudedBox3D(ctx, -46, -16, 92, 32, 8, '#FACC15', '#B45309', 10);
  drawCharacterPod3D(ctx, 0, -4, 20, '#F59E0B', Math.PI / 2, 6);
  ctx.restore();

  for (const p of snap.players) {
    const startX = ARENA_WIDTH / 2 + ((p.slotIndex % 4) - 1.5) * 90;
    const startY = 610;
    // Aim target reticle in goal
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.aimX, snap.goalY, 16, 0, Math.PI * 2);
    ctx.moveTo(p.aimX - 22, snap.goalY);
    ctx.lineTo(p.aimX + 22, snap.goalY);
    ctx.stroke();
    ctx.restore();

    drawCharacterPod3D(ctx, startX, startY, 22, p.colorHex, Math.atan2(snap.goalY - startY, p.aimX - startX), 0);
    drawNameplate(ctx, startX, startY + 38, `${p.name} · ${p.score}`, p.colorHex);
  }

  for (const s of snap.shots) {
    drawSphere3D(ctx, s.x, s.y, 13, '#F8FAFC', s.colorHex);
  }

  drawPopupTexts(ctx, snap.popups);
  drawHudChip(ctx, 24, 22, `RD ${snap.round} · ${Math.ceil(snap.timeLeft)}s`, '#22C55E');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#22C55E', 16);
}

// 3. MINI GOLF PRO
export function renderMiniGolfPro(ctx: CanvasRenderingContext2D, snap: MiniGolfProSnapshot): void {
  drawStudioBackdrop(ctx, '#061A12', 'rgba(16,185,129,0.16)', 'rgba(255,255,255,0.03)', 42);
  drawArenaSlab(ctx, 88, 108, ARENA_WIDTH - 176, ARENA_HEIGHT - 176, 16, '#059669', '#34D399');

  // Walls
  for (const w of snap.walls) {
    drawExtrudedBox3D(ctx, w.x, w.y, w.w, w.h, 10, '#F59E0B', '#B45309', 6);
  }

  // Cup + Flag
  ctx.save();
  ctx.fillStyle = '#090D16';
  ctx.beginPath();
  ctx.arc(snap.cupX, snap.cupY, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.moveTo(snap.cupX, snap.cupY);
  ctx.lineTo(snap.cupX, snap.cupY - 56);
  ctx.stroke();
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  ctx.moveTo(snap.cupX, snap.cupY - 56);
  ctx.lineTo(snap.cupX + 28, snap.cupY - 46);
  ctx.lineTo(snap.cupX, snap.cupY - 34);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  for (const p of snap.players) {
    if (p.sunk) continue;
    if (Math.hypot(p.vx, p.vy) < 28) {
      ctx.save();
      ctx.strokeStyle = p.colorHex;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.aimAngle) * (45 + p.power * 110), p.y + Math.sin(p.aimAngle) * (45 + p.power * 110));
      ctx.stroke();
      ctx.restore();
    }
    drawShadowOval(ctx, p.x, p.y + 8, 14, 0.35);
    drawSphere3D(ctx, p.x, p.y, 13, '#F8FAFC', p.colorHex);
    drawNameplate(ctx, p.x, p.y - 26, `${p.name} (${p.score})`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `HOLE ${snap.holeIndex} · ${Math.ceil(snap.timeLeft)}s`, '#10B981');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10B981', 16);
}

// 4. ARCHERY WIND
export function renderArcheryWind(ctx: CanvasRenderingContext2D, snap: ArcheryWindSnapshot): void {
  drawStudioBackdrop(ctx, '#0A1322', 'rgba(56,189,248,0.14)', 'rgba(255,255,255,0.03)', 46);
  drawArenaSlab(ctx, 140, 88, ARENA_WIDTH - 280, ARENA_HEIGHT - 128, 22, '#13243B', '#38BDF8');

  // Bullseye Rings
  const rings: [number, string][] = [
    [135, '#F8FAFC'],
    [95, '#0F172A'],
    [60, '#38BDF8'],
    [32, '#EF4444'],
    [16, '#FACC15'],
  ];
  for (const [r, col] of rings) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(snap.targetX, snap.targetY, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const ar of snap.arrows) {
    drawSphere3D(ctx, ar.x, ar.y, 6, ar.colorHex, '#FFFFFF');
  }

  // Wind indicator
  const wx = 175;
  const wy = 160;
  ctx.save();
  ctx.fillStyle = 'rgba(13,18,30,0.9)';
  ctx.beginPath();
  ctx.arc(wx, wy, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const wAng = Math.atan2(snap.windY, snap.windX);
  const wLen = Math.min(36, Math.hypot(snap.windX, snap.windY) * 0.45);
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  ctx.lineTo(wx + Math.cos(wAng) * wLen, wy + Math.sin(wAng) * wLen);
  ctx.stroke();
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '800 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('WIND', wx, wy + 34);
  ctx.restore();

  // Player crosshairs
  for (const p of snap.players) {
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 3;
    const rad = p.drawing ? 28 - p.drawPct * 16 : 24;
    ctx.beginPath();
    ctx.arc(p.aimX, p.aimY, rad, 0, Math.PI * 2);
    ctx.moveTo(p.aimX - 18, p.aimY);
    ctx.lineTo(p.aimX + 18, p.aimY);
    ctx.moveTo(p.aimX, p.aimY - 18);
    ctx.lineTo(p.aimX, p.aimY + 18);
    ctx.stroke();
    ctx.restore();
    drawNameplate(ctx, p.aimX, p.aimY - 34, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawPopupTexts(ctx, snap.popups);
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#38BDF8');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#38BDF8', 16);
}

// 5. BOXING KO
export function renderBoxingKo(ctx: CanvasRenderingContext2D, snap: BoxingKoSnapshot): void {
  drawStudioBackdrop(ctx, '#160910', 'rgba(244,63,94,0.16)', 'rgba(255,255,255,0.03)', 46);
  drawArenaSlab(ctx, 180, 110, ARENA_WIDTH - 360, ARENA_HEIGHT - 170, 18, '#1E293B', '#F43F5E');

  // Ring ropes
  ctx.save();
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 4;
  ctx.strokeRect(205, 132, ARENA_WIDTH - 410, ARENA_HEIGHT - 214);
  ctx.restore();

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawCharacterPod3D(ctx, p.x, p.y, 26, p.stunTimer > 0 ? '#94A3B8' : p.colorHex, p.angle, p.punchTimer > 0 ? 8 : 0);
    // Boxing gloves
    const reach = p.punchTimer > 0 ? 44 : 26;
    const gx = p.x + Math.cos(p.angle) * reach;
    const gy = p.y + Math.sin(p.angle) * reach;
    drawSphere3D(ctx, gx, gy, 13, '#EF4444', '#FCA5A5');
    if (p.guarding) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // HP bar
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(p.x - 28, p.y - 44, 56, 7);
    ctx.fillStyle = '#22C55E';
    ctx.fillRect(p.x - 28, p.y - 44, 56 * (p.hp / p.maxHp), 7);
    drawNameplate(ctx, p.x, p.y - 58, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawPopupTexts(ctx, snap.impacts);
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#F43F5E');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F43F5E', 16);
}

// 6. PING PONG PRO
export function renderPingPongPro(ctx: CanvasRenderingContext2D, snap: PingPongProSnapshot): void {
  drawStudioBackdrop(ctx, '#061420', 'rgba(56,189,248,0.14)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 148, 92, ARENA_WIDTH - 296, ARENA_HEIGHT - 162, 16, '#1D4ED8', '#F8FAFC');

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ARENA_WIDTH / 2, 100);
  ctx.lineTo(ARENA_WIDTH / 2, ARENA_HEIGHT - 78);
  ctx.stroke();
  ctx.restore();

  for (const p of snap.players) {
    const isVert = p.side === 'left' || p.side === 'right';
    const w = isVert ? 20 : 98;
    const h = isVert ? 98 : 20;
    drawExtrudedBox3D(ctx, p.x - w / 2, p.y - h / 2, w, h, 8, p.colorHex, shadeHex(p.colorHex, -0.35), 8);
    drawNameplate(ctx, p.x, p.y - (isVert ? 64 : 26), `${p.name} · ${p.score}`, p.colorHex);
  }

  for (const b of snap.balls) {
    drawSphere3D(ctx, b.x, b.y, 11, b.smash ? '#FACC15' : '#F8FAFC', '#FFFFFF');
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#38BDF8');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#38BDF8', 16);
}

// 7. HOME RUN DERBY
export function renderHomeRunDerby(ctx: CanvasRenderingContext2D, snap: HomeRunDerbySnapshot): void {
  drawStudioBackdrop(ctx, '#08180C', 'rgba(34,197,94,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 75, 84, ARENA_WIDTH - 150, ARENA_HEIGHT - 114, 22, '#166534', '#4ADE80');

  // Outfield wall + Home plate strike zone band
  ctx.save();
  ctx.fillStyle = 'rgba(250,204,21,0.16)';
  ctx.fillRect(90, 520, ARENA_WIDTH - 180, 78);
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 3;
  ctx.strokeRect(90, 520, ARENA_WIDTH - 180, 78);
  ctx.restore();

  for (const p of snap.players) {
    // Lane stripe
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(p.laneX - 24, 110, 48, 490);
    drawCharacterPod3D(ctx, p.laneX, 595, 22, p.colorHex, -Math.PI / 2, p.swingTimer > 0 ? 10 : 0);
    // Bat
    ctx.save();
    ctx.translate(p.laneX, 580);
    ctx.rotate(p.swingTimer > 0 ? -0.9 : 0.6);
    drawExtrudedBox3D(ctx, 6, -6, 52, 11, 4, '#F59E0B', '#B45309', 5);
    ctx.restore();
    drawNameplate(ctx, p.laneX, 646, `${p.name} · ${p.score}`, p.colorHex);
  }

  for (const pt of snap.pitches) {
    if (!pt.active) continue;
    for (const p of snap.players) {
      drawSphere3D(ctx, p.laneX, pt.y, 12, '#F8FAFC', '#EF4444');
    }
  }
  for (const hb of snap.hitBalls) {
    drawSphere3D(ctx, hb.x, hb.y, 14, '#FACC15', hb.colorHex);
  }

  drawPopupTexts(ctx, snap.popups);
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#4ADE80');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#4ADE80', 16);
}

// 8. DODGEBALL RIOT
export function renderDodgeballRiot(ctx: CanvasRenderingContext2D, snap: DodgeballRiotSnapshot): void {
  drawStudioBackdrop(ctx, '#160B18', 'rgba(251,113,133,0.16)', 'rgba(255,255,255,0.03)', 46);
  drawArenaSlab(ctx, 72, 86, ARENA_WIDTH - 144, ARENA_HEIGHT - 122, 18, '#1E1B4B', '#FB7185');

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ARENA_WIDTH / 2, 92);
  ctx.lineTo(ARENA_WIDTH / 2, ARENA_HEIGHT - 44);
  ctx.stroke();
  ctx.restore();

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawCharacterPod3D(ctx, p.x, p.y, 24, p.colorHex, p.angle, p.dashTimer > 0 ? 10 : 0);
    if (p.catchTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawNameplate(ctx, p.x, p.y - 42, `${p.name} (${p.hp}♥) · ${p.score}`, p.colorHex);
  }

  for (const b of snap.balls) {
    drawSphere3D(ctx, b.x, b.y, b.hot ? 16 : 14, b.hot ? '#EF4444' : b.colorHex, '#FFFFFF');
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#FB7185');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FB7185', 16);
}

// 9. SUMO CLASH
export function renderSumoClash(ctx: CanvasRenderingContext2D, snap: SumoClashSnapshot): void {
  drawStudioBackdrop(ctx, '#1A1106', 'rgba(245,158,11,0.16)', 'rgba(255,255,255,0.03)', 44);

  // Circular Dohyo Ring
  ctx.save();
  ctx.fillStyle = '#92400E';
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, 385, snap.ringRadius + 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, 375, snap.ringRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FDE047';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  for (const sw of snap.shockwaves) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, sw.alpha);
    ctx.strokeStyle = sw.colorHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawCharacterPod3D(ctx, p.x, p.y, p.radius, p.colorHex, p.angle, p.chargeTimer > 0 ? 10 : 0);
    drawNameplate(ctx, p.x, p.y - p.radius - 16, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `RD ${snap.round} · ${Math.ceil(snap.timeLeft)}s`, '#F59E0B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F59E0B', 16);
}

// 10. CANOE SPRINT
export function renderCanoeSprint(ctx: CanvasRenderingContext2D, snap: CanoeSprintSnapshot): void {
  drawStudioBackdrop(ctx, '#041A2B', 'rgba(14,165,233,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 110, 74, ARENA_WIDTH - 220, ARENA_HEIGHT - 102, 18, '#0369A1', '#38BDF8');

  const leadDist = Math.max(0, ...snap.players.map((p) => p.dist));
  const camBase = Math.max(0, leadDist - 180);
  const toScreenY = (d: number) => 560 - (d - camBase) * 0.85;

  // Water ripples
  const t = getMotionTime();
  ctx.save();
  ctx.strokeStyle = 'rgba(186,230,253,0.22)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const wy = ((i * 110 + camBase * 0.85 + t * 90) % 620) + 80;
    ctx.beginPath();
    ctx.moveTo(150, wy);
    ctx.lineTo(ARENA_WIDTH - 150, wy);
    ctx.stroke();
  }
  ctx.restore();

  // Gates & Rocks
  for (const g of snap.gates) {
    const gy = toScreenY(g.dist);
    if (gy < 60 || gy > ARENA_HEIGHT - 20) continue;
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(g.x - g.width / 2, gy);
    ctx.lineTo(g.x + g.width / 2, gy);
    ctx.stroke();
    drawSphere3D(ctx, g.x - g.width / 2, gy, 10, '#22C55E', '#BBF7D0');
    drawSphere3D(ctx, g.x + g.width / 2, gy, 10, '#22C55E', '#BBF7D0');
  }

  for (const r of snap.rocks) {
    const ry = toScreenY(r.dist);
    if (ry < 60 || ry > ARENA_HEIGHT - 20) continue;
    drawSphere3D(ctx, r.x, ry, r.r, '#64748B', '#CBD5E1');
  }

  for (const p of snap.players) {
    const py = Math.max(95, Math.min(640, toScreenY(p.dist)));
    drawExtrudedBox3D(ctx, p.laneX - 15, py - 34, 30, 68, 8, p.colorHex, shadeHex(p.colorHex, -0.35), 14);
    drawCharacterPod3D(ctx, p.laneX, py, 16, p.stunTimer > 0 ? '#94A3B8' : '#F8FAFC', -Math.PI / 2, p.boostTimer > 0 ? 8 : 0);
    drawNameplate(ctx, p.laneX, py - 50, `${p.name} · ${Math.round(p.dist)}m`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#38BDF8');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#38BDF8', 16);
}

// 11. DISC ARENA
export function renderDiscArena(ctx: CanvasRenderingContext2D, snap: DiscArenaSnapshot): void {
  drawStudioBackdrop(ctx, '#091628', 'rgba(250,204,21,0.14)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 86, ARENA_WIDTH - 168, ARENA_HEIGHT - 122, 18, '#0F2942', '#FACC15');

  // Center net & end goals
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(ARENA_WIDTH / 2, 92);
  ctx.lineTo(ARENA_WIDTH / 2, ARENA_HEIGHT - 44);
  ctx.stroke();
  ctx.restore();
  drawExtrudedBox3D(ctx, 76, 120, 16, ARENA_HEIGHT - 190, 6, '#38BDF8', '#0284C7', 6);
  drawExtrudedBox3D(ctx, ARENA_WIDTH - 92, 120, 16, ARENA_HEIGHT - 190, 6, '#FB7185', '#BE123C', 6);

  for (const p of snap.players) {
    drawCharacterPod3D(ctx, p.x, p.y, 24, p.colorHex, p.angle, p.dashTimer > 0 ? 9 : 0);
    drawNameplate(ctx, p.x, p.y - 38, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawSphere3D(ctx, snap.disc.x, snap.disc.y, 16, snap.disc.power ? '#FACC15' : '#38BDF8', '#FFFFFF');
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#FACC15');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FACC15', 16);
}

// 12. BADMINTON SMASH
export function renderBadmintonSmash(ctx: CanvasRenderingContext2D, snap: BadmintonSmashSnapshot): void {
  drawStudioBackdrop(ctx, '#08181A', 'rgba(45,212,191,0.16)', 'rgba(255,255,255,0.03)', 46);
  drawArenaSlab(ctx, 72, 82, ARENA_WIDTH - 144, ARENA_HEIGHT - 108, 18, '#0F766E', '#5EEAD4');

  // Floor line & center net
  ctx.fillStyle = '#115E59';
  ctx.fillRect(82, 610, ARENA_WIDTH - 164, 14);
  drawExtrudedBox3D(ctx, ARENA_WIDTH / 2 - 6, 465, 12, 148, 6, '#F8FAFC', '#94A3B8', 4);

  for (const p of snap.players) {
    drawShadowOval(ctx, p.x, 612, 24, 0.35);
    drawCharacterPod3D(ctx, p.x, p.y - 18, 22, p.colorHex, p.side === 0 ? 0 : Math.PI, Math.max(0, 610 - p.y) * 0.2);
    // Racket swing arc
    if (p.swingTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 26, 44, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.stroke();
      ctx.restore();
    }
    drawNameplate(ctx, p.x, p.y - 54, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawSphere3D(ctx, snap.shuttle.x, snap.shuttle.y, 12, snap.shuttle.smashing ? '#FACC15' : '#F8FAFC', '#FFFFFF');
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#2DD4BF');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#2DD4BF', 16);
}

// 13. BILLIARDS SNOOKER
export function renderBilliardsSnooker(ctx: CanvasRenderingContext2D, snap: BilliardsSnookerSnapshot): void {
  drawStudioBackdrop(ctx, '#06150E', 'rgba(16,185,129,0.14)', 'rgba(255,255,255,0.03)', 46);
  // Wood outer rim + Emerald felt
  drawExtrudedBox3D(ctx, 114, 98, ARENA_WIDTH - 228, ARENA_HEIGHT - 166, 14, '#78350F', '#451A03', 18);
  drawArenaSlab(ctx, 130, 115, ARENA_WIDTH - 260, ARENA_HEIGHT - 200, 10, '#047857', '#10B981');

  for (const pk of snap.pockets) {
    ctx.fillStyle = '#090D16';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of snap.balls) {
    drawShadowOval(ctx, b.x, b.y + 6, 13, 0.35);
    drawSphere3D(ctx, b.x, b.y, 14, b.colorHex, '#FFFFFF');
  }

  for (const p of snap.players) {
    // Cue aim line
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * (80 + p.power * 110), p.y + Math.sin(p.aimAngle) * (80 + p.power * 110));
    ctx.stroke();
    ctx.restore();
    drawSphere3D(ctx, p.x, p.y, 15, '#F8FAFC', p.colorHex);
    drawNameplate(ctx, p.x, p.y - 26, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#10B981');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10B981', 16);
}

// 14. TETHER JOUST
export function renderTetherJoust(ctx: CanvasRenderingContext2D, snap: TetherJoustSnapshot): void {
  drawStudioBackdrop(ctx, '#160B24', 'rgba(168,85,247,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 92, ARENA_WIDTH - 168, ARENA_HEIGHT - 134, 24, '#1E1B4B', '#A855F7');

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawCharacterPod3D(ctx, p.x, p.y, 24, p.colorHex, p.angle, p.lungeTimer > 0 ? 10 : 0);
    // Joust lance
    const len = p.lungeTimer > 0 ? 60 : 44;
    ctx.save();
    ctx.strokeStyle = p.lungeTimer > 0 ? '#FACC15' : '#E2E8F0';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18);
    ctx.lineTo(p.x + Math.cos(p.angle) * len, p.y + Math.sin(p.angle) * len);
    ctx.stroke();
    ctx.restore();
    if (p.shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawNameplate(ctx, p.x, p.y - 40, `${p.name} · ${p.score}`, p.colorHex);
  }

  for (const sp of snap.sparks) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, sp.alpha);
    drawSphere3D(ctx, sp.x, sp.y, 12, sp.colorHex, '#FFFFFF');
    ctx.restore();
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#A855F7');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#A855F7', 16);
}

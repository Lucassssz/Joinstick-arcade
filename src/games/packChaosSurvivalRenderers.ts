import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import type {
  BombTagArenaSnapshot,
  ChainGangClimbSnapshot,
  ConfettiCaptureSnapshot,
  CraneDropChaosSnapshot,
  FallingAnvilsSnapshot,
  HotLavaFloorSnapshot,
  KingOfHillNeoSnapshot,
  LaserJumpRopeSnapshot,
  LaserMazeHeistSnapshot,
  MeteorDodgeXSnapshot,
  MusicalThronesSnapshot,
  RouletteArenaSnapshot,
  SeesawBalanceSnapshot,
  SumoIceDriftSnapshot,
  ZombieOutbreakSnapshot,
} from '../shared/packChaosSurvivalTypes';
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
  shadeHex,
} from './packRenderHelpers';
import { getMotionTime } from './arcadeMotion';

// 1. LASER JUMP ROPE (#73 replacement)
export function renderLaserJumpRope(ctx: CanvasRenderingContext2D, snap: LaserJumpRopeSnapshot): void {
  drawStudioBackdrop(ctx, '#09091A', 'rgba(244,63,94,0.16)', 'rgba(255,255,255,0.03)', 44);
  ctx.save();
  ctx.fillStyle = '#1E1B4B';
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, 375, 255, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  // Collectible gems
  for (const g of snap.gems) {
    drawSphere3D(ctx, g.x, g.y, 13, '#FACC15', '#FEF08A');
  }

  // Sweeping laser beam(s)
  const angles = snap.doubleBeam ? [snap.beamAngle, snap.beamAngle + Math.PI] : [snap.beamAngle];
  for (const ang of angles) {
    ctx.save();
    ctx.strokeStyle = '#FB7185';
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ARENA_WIDTH / 2, 375);
    ctx.lineTo(ARENA_WIDTH / 2 + Math.cos(ang) * 260, 375 + Math.sin(ang) * 260);
    ctx.stroke();
    ctx.restore();
  }
  drawSphere3D(ctx, ARENA_WIDTH / 2, 375, 22, '#F43F5E', '#FFFFFF');

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawShadowOval(ctx, p.x, p.y + 8, 18, 0.35);
    drawCharacterPod3D(ctx, p.x, p.y, 20, p.colorHex, 0, p.z * 0.45);
    if (p.shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y - p.z * 0.45, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawNameplate(ctx, p.x, p.y - 38 - p.z * 0.45, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#FB7185');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FB7185', 16);
}

// 2. HOT LAVA FLOOR
export function renderHotLavaFloor(ctx: CanvasRenderingContext2D, snap: HotLavaFloorSnapshot): void {
  drawStudioBackdrop(ctx, '#280705', 'rgba(249,115,22,0.22)', 'rgba(255,255,255,0.025)', 46);
  drawArenaSlab(ctx, 76, 86, ARENA_WIDTH - 152, ARENA_HEIGHT - 122, 22, '#9A3412', '#F97316');

  for (const pl of snap.platforms) {
    if (!pl.safe && !pl.sinking) continue;
    const fill = pl.sinking ? '#EF4444' : '#22C55E';
    const rim = pl.sinking ? '#FCA5A5' : '#86EFAC';
    ctx.save();
    ctx.fillStyle = shadeHex(fill, -0.35);
    ctx.beginPath();
    ctx.arc(pl.x, pl.y + 8, pl.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, pl.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  }

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawShadowOval(ctx, p.x, p.y + 8, 18, 0.35);
    drawCharacterPod3D(ctx, p.x, p.y, 20, p.colorHex, 0, p.z * 0.45);
    drawNameplate(ctx, p.x, p.y - 36 - p.z * 0.45, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#F97316');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F97316', 16);
}

// 3. BOMB TAG ARENA
export function renderBombTagArena(ctx: CanvasRenderingContext2D, snap: BombTagArenaSnapshot): void {
  drawStudioBackdrop(ctx, '#180B0C', 'rgba(239,68,68,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 92, ARENA_WIDTH - 168, ARENA_HEIGHT - 134, 20, '#1E293B', '#F97316');

  for (const ex of snap.explosions) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ex.alpha);
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const p of snap.players) {
    if (!p.alive) continue;
    const isHolder = snap.bombHolderId === p.id;
    if (isHolder) {
      ctx.save();
      ctx.strokeStyle = snap.fuseLeft < 3 ? '#EF4444' : '#FACC15';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 38 + Math.sin(getMotionTime() * 14) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawCharacterPod3D(ctx, p.x, p.y, 22, p.colorHex, p.angle, p.dashTimer > 0 ? 10 : 0);
    if (isHolder) {
      drawSphere3D(ctx, p.x, p.y - 34, 15, '#111827', '#EF4444');
    }
    drawNameplate(ctx, p.x, p.y - (isHolder ? 60 : 38), `${p.name} · ${p.score}`, isHolder ? '#EF4444' : p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `FUSE ${snap.fuseLeft.toFixed(1)}s · ${Math.ceil(snap.timeLeft)}s`, '#EF4444');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EF4444', 16);
}

// 4. MUSICAL THRONES
export function renderMusicalThrones(ctx: CanvasRenderingContext2D, snap: MusicalThronesSnapshot): void {
  drawStudioBackdrop(ctx, '#140924', 'rgba(192,132,252,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 92, ARENA_WIDTH - 168, ARENA_HEIGHT - 134, 24, '#1E1B4B', '#C084FC');

  for (const pd of snap.pods) {
    const col = snap.phase === 'music' ? '#475569' : pd.occupantId ? '#FACC15' : '#22C55E';
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(pd.x, pd.y, pd.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawCharacterPod3D(ctx, p.x, p.y, 21, p.colorHex, 0, p.seatedPodId ? 6 : 0);
    drawNameplate(ctx, p.x, p.y - 36, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${snap.phase.toUpperCase()} · ${Math.ceil(snap.timeLeft)}s`, '#C084FC');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#C084FC', 16);
}

// 5. SUMO ICE DRIFT
export function renderSumoIceDrift(ctx: CanvasRenderingContext2D, snap: SumoIceDriftSnapshot): void {
  drawStudioBackdrop(ctx, '#061529', 'rgba(56,189,248,0.18)', 'rgba(255,255,255,0.03)', 46);

  ctx.save();
  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, 385, snap.iceRadius + 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#BAE6FD';
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, 375, snap.iceRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawCharacterPod3D(ctx, p.x, p.y, 24, p.colorHex, p.angle, p.dashTimer > 0 ? 9 : 0);
    drawNameplate(ctx, p.x, p.y - 38, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#38BDF8');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#38BDF8', 16);
}

// 6. METEOR DODGE X
export function renderMeteorDodgeX(ctx: CanvasRenderingContext2D, snap: MeteorDodgeXSnapshot): void {
  drawStudioBackdrop(ctx, '#0F0814', 'rgba(249,115,22,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 92, ARENA_WIDTH - 168, ARENA_HEIGHT - 134, 20, '#1C1917', '#F97316');

  for (const c of snap.craters) {
    drawSphere3D(ctx, c.x, c.y, 18, '#FACC15', '#FEF08A');
  }

  for (const m of snap.meteors) {
    ctx.save();
    ctx.strokeStyle = m.gold ? '#FACC15' : '#EF4444';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = m.gold ? 'rgba(250,204,21,0.22)' : 'rgba(239,68,68,0.22)';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * m.progress, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Falling rock height
    const fallY = m.y - (1 - m.progress) * 320;
    drawSphere3D(ctx, m.x, fallY, 20, m.gold ? '#FACC15' : '#EA580C', '#FFFFFF');
  }

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawCharacterPod3D(ctx, p.x, p.y, 21, p.colorHex, 0, 0);
    if (p.shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 31, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawNameplate(ctx, p.x, p.y - 36, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#F97316');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F97316', 16);
}

// 7. KING OF HILL NEO
export function renderKingOfHillNeo(ctx: CanvasRenderingContext2D, snap: KingOfHillNeoSnapshot): void {
  drawStudioBackdrop(ctx, '#140E05', 'rgba(250,204,21,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 92, ARENA_WIDTH - 168, ARENA_HEIGHT - 134, 20, '#1E293B', '#FACC15');

  ctx.save();
  ctx.fillStyle = 'rgba(250,204,21,0.22)';
  ctx.beginPath();
  ctx.arc(snap.zoneX, snap.zoneY, snap.zoneR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();

  for (const sw of snap.shockwaves) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, sw.alpha);
    ctx.strokeStyle = sw.colorHex;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const p of snap.players) {
    drawCharacterPod3D(ctx, p.x, p.y, 23, p.colorHex, 0, p.inZone ? 8 : 0);
    drawNameplate(ctx, p.x, p.y - 40, `${p.name} · ${p.score}`, p.inZone ? '#FACC15' : p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#FACC15');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FACC15', 16);
}

// 8. LASER MAZE HEIST
export function renderLaserMazeHeist(ctx: CanvasRenderingContext2D, snap: LaserMazeHeistSnapshot): void {
  drawStudioBackdrop(ctx, '#090D16', 'rgba(239,68,68,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 92, ARENA_WIDTH - 168, ARENA_HEIGHT - 134, 18, '#0F172A', '#38BDF8');

  for (const d of snap.diamonds) {
    drawSphere3D(ctx, d.x, d.y, 14, '#38BDF8', '#E0F2FE');
  }

  for (const sw of snap.sweepers) {
    ctx.save();
    ctx.strokeStyle = '#EF4444';
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(sw.x, sw.y);
    ctx.lineTo(sw.x + Math.cos(sw.angle) * sw.length, sw.y + Math.sin(sw.angle) * sw.length);
    ctx.stroke();
    ctx.restore();
    drawSphere3D(ctx, sw.x, sw.y, 14, '#EF4444', '#FFFFFF');
  }

  for (const p of snap.players) {
    drawCharacterPod3D(ctx, p.x, p.y, p.crouching ? 14 : 21, p.stunTimer > 0 ? '#64748B' : p.colorHex, 0, 0);
    drawNameplate(ctx, p.x, p.y - 36, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#38BDF8');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EF4444', 16);
}

// 9. ZOMBIE OUTBREAK
export function renderZombieOutbreak(ctx: CanvasRenderingContext2D, snap: ZombieOutbreakSnapshot): void {
  drawStudioBackdrop(ctx, '#07140B', 'rgba(34,197,94,0.18)', 'rgba(255,255,255,0.03)', 46);
  drawArenaSlab(ctx, 84, 92, ARENA_WIDTH - 168, ARENA_HEIGHT - 134, 20, '#0F1D14', '#22C55E');

  for (const orb of snap.cureOrbs) {
    drawSphere3D(ctx, orb.x, orb.y, 14, '#38BDF8', '#FFFFFF');
  }

  for (const p of snap.players) {
    drawCharacterPod3D(ctx, p.x, p.y, p.infected ? 24 : 20, p.infected ? '#22C55E' : p.colorHex, p.angle, p.dashTimer > 0 ? 8 : 0);
    drawNameplate(ctx, p.x, p.y - 38, `${p.infected ? '☣ ' : ''}${p.name} · ${p.score}`, p.infected ? '#22C55E' : p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#22C55E');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#22C55E', 16);
}

// 10. FALLING ANVILS
export function renderFallingAnvils(ctx: CanvasRenderingContext2D, snap: FallingAnvilsSnapshot): void {
  drawStudioBackdrop(ctx, '#12131A', 'rgba(148,163,184,0.14)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 92, ARENA_WIDTH - 168, ARENA_HEIGHT - 134, 20, '#1E293B', '#94A3B8');

  for (const av of snap.anvils) {
    ctx.save();
    ctx.strokeStyle = av.gold ? '#FACC15' : '#EF4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(av.x, av.y, av.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(av.x, av.y, av.r * av.progress, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const ay = av.y - (1 - av.progress) * 290;
    drawExtrudedBox3D(ctx, av.x - 24, ay - 18, 48, 36, 12, av.gold ? '#FACC15' : '#64748B', av.gold ? '#B45309' : '#334155', 6);
  }

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawCharacterPod3D(ctx, p.x, p.y, 21, p.colorHex, 0, p.dashTimer > 0 ? 8 : 0);
    drawNameplate(ctx, p.x, p.y - 36, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#94A3B8');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FACC15', 16);
}

// 11. SEESAW BALANCE
export function renderSeesawBalance(ctx: CanvasRenderingContext2D, snap: SeesawBalanceSnapshot): void {
  drawStudioBackdrop(ctx, '#081226', 'rgba(56,189,248,0.16)', 'rgba(255,255,255,0.03)', 46);

  const cx = ARENA_WIDTH / 2;
  const cy = 440;
  // Fulcrum triangle
  ctx.save();
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - 56, cy + 120);
  ctx.lineTo(cx + 56, cy + 120);
  ctx.closePath();
  ctx.fill();

  // Tilted seesaw beam + coins + players
  ctx.translate(cx, cy);
  ctx.rotate(snap.beamTilt);
  drawExtrudedBox3D(ctx, -435, -14, 870, 28, 10, '#F59E0B', '#B45309', 10);

  for (const c of snap.coins) {
    drawSphere3D(ctx, c.offset, -34, 14, '#FACC15', '#FFFFFF');
  }
  for (const p of snap.players) {
    if (!p.alive) continue;
    drawCharacterPod3D(ctx, p.offset, -34 - p.z * 0.4, 20, p.colorHex, 0, 0);
    drawNameplate(ctx, p.offset, -72 - p.z * 0.4, `${p.name} · ${p.score}`, p.colorHex);
  }
  ctx.restore();

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#F59E0B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F59E0B', 16);
}

// 12. CHAIN GANG CLIMB
export function renderChainGangClimb(ctx: CanvasRenderingContext2D, snap: ChainGangClimbSnapshot): void {
  drawStudioBackdrop(ctx, '#140E08', 'rgba(245,158,11,0.14)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 96, 86, ARENA_WIDTH - 192, ARENA_HEIGHT - 122, 18, '#292524', '#F59E0B');

  // Elastic chain links between alive players
  const alive = snap.players.filter((p) => p.alive);
  if (alive.length > 1) {
    ctx.save();
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(alive[0].x, alive[0].y);
    for (let i = 1; i < alive.length; i++) {
      ctx.lineTo(alive[i].x, alive[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  for (const st of snap.stars) {
    drawSphere3D(ctx, st.x, st.y, 14, '#FACC15', '#FEF08A');
  }

  for (const hz of snap.hazards) {
    ctx.save();
    ctx.translate(hz.x, hz.y);
    ctx.rotate(getMotionTime() * 8);
    drawSphere3D(ctx, 0, 0, hz.r, '#EF4444', '#CBD5E1');
    ctx.restore();
  }

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawCharacterPod3D(ctx, p.x, p.y, 21, p.colorHex, -Math.PI / 2, p.pulling ? 6 : 0);
    drawNameplate(ctx, p.x, p.y - 36, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#F59E0B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F59E0B', 16);
}

// 13. CONFETTI CAPTURE
export function renderConfettiCapture(ctx: CanvasRenderingContext2D, snap: ConfettiCaptureSnapshot): void {
  drawStudioBackdrop(ctx, '#0E0A1B', 'rgba(236,72,153,0.16)', 'rgba(255,255,255,0.03)', 44);
  const ax = 120;
  const ay = 105;
  const aw = ARENA_WIDTH - 240;
  const ah = ARENA_HEIGHT - 190;
  const cw = aw / snap.cols;
  const ch = ah / snap.rows;

  const slotColors = new Map(snap.players.map((p) => [p.slotIndex, p.colorHex]));
  drawArenaSlab(ctx, ax - 10, ay - 10, aw + 20, ah + 20, 14, '#0F172A', '#EC4899');

  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const ownerSlot = snap.cells[r * snap.cols + c];
      const fill = ownerSlot >= 0 ? slotColors.get(ownerSlot) ?? '#334155' : '#1E293B';
      ctx.fillStyle = fill;
      ctx.fillRect(ax + c * cw + 2, ay + r * ch + 2, cw - 4, ch - 4);
    }
  }

  for (const bm of snap.bombs) {
    drawSphere3D(ctx, bm.x, bm.y, 15, bm.colorHex, '#FFFFFF');
  }

  for (const p of snap.players) {
    drawCharacterPod3D(ctx, p.x, p.y, 21, p.colorHex, p.angle, p.dashTimer > 0 ? 8 : 0);
    drawNameplate(ctx, p.x, p.y - 36, `${p.name} (${p.tilesOwned})`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#EC4899');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EC4899', 16);
}

// 14. CRANE DROP CHAOS
export function renderCraneDropChaos(ctx: CanvasRenderingContext2D, snap: CraneDropChaosSnapshot): void {
  drawStudioBackdrop(ctx, '#161108', 'rgba(250,204,21,0.16)', 'rgba(255,255,255,0.03)', 44);

  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, 375, 275, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  // Swinging steel chains from crane center
  for (const b of snap.balls) {
    ctx.save();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(ARENA_WIDTH / 2, 375);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
    drawSphere3D(ctx, b.x, b.y, b.r, '#475569', '#E2E8F0');
  }
  drawSphere3D(ctx, ARENA_WIDTH / 2, 375, 18, '#FACC15', '#FFFFFF');

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawCharacterPod3D(ctx, p.x, p.y, 21, p.colorHex, 0, p.dashTimer > 0 ? 8 : 0);
    if (p.shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 31, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawNameplate(ctx, p.x, p.y - 36, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#FACC15');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FACC15', 16);
}

// 15. ROULETTE ARENA
export function renderRouletteArena(ctx: CanvasRenderingContext2D, snap: RouletteArenaSnapshot): void {
  drawStudioBackdrop(ctx, '#12081A', 'rgba(244,63,94,0.16)', 'rgba(255,255,255,0.03)', 44);
  const ax = 180;
  const ay = 135;
  const aw = ARENA_WIDTH - 360;
  const ah = ARENA_HEIGHT - 230;
  const cw = aw / snap.cols;
  const ch = ah / snap.rows;

  drawArenaSlab(ctx, ax - 14, ay - 14, aw + 28, ah + 28, 16, '#0F172A', '#FB7185');

  const blink = Math.sin(getMotionTime() * 14) > 0;
  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const st = snap.tileStates[r * snap.cols + c];
      const tx = ax + c * cw + 4;
      const ty = ay + r * ch + 4;
      if (st === 2) {
        ctx.fillStyle = '#05080F';
        ctx.fillRect(tx, ty, cw - 8, ch - 8);
      } else {
        const col = st === 1 ? (blink ? '#EF4444' : '#B91C1C') : '#10B981';
        drawExtrudedBox3D(ctx, tx, ty, cw - 8, ch - 8, 8, col, shadeHex(col, -0.35), 8);
      }
    }
  }

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawCharacterPod3D(ctx, p.x, p.y, 21, p.colorHex, 0, p.dashTimer > 0 ? 8 : 0);
    drawNameplate(ctx, p.x, p.y - 36, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${snap.countdown.toFixed(1)}s · ${Math.ceil(snap.timeLeft)}s`, '#FB7185');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FB7185', 16);
}

import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import type {
  ArtilleryCraterWarSnapshot,
  BridgeLoadStressSnapshot,
  HillTorqueClimbSnapshot,
  RopeSlicePhysicsSnapshot,
  SlingshotFortressSnapshot,
  ThreeLaneMetroSnapshot,
  TiltLabyrinthSnapshot,
  TrackCrafterGpSnapshot,
  TrapBuilderRunSnapshot,
  WobblyTimberPullSnapshot,
} from '../shared/packPhysicsBuilderTypes';
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
  tCanvas,
} from './packRenderHelpers';
import { getMotionTime } from './arcadeMotion';

// 1. TRAP BUILDER RUN
export function renderTrapBuilderRun(ctx: CanvasRenderingContext2D, snap: TrapBuilderRunSnapshot): void {
  drawStudioBackdrop(ctx, '#120E1D', 'rgba(255,122,26,0.16)', 'rgba(255,255,255,0.03)', 48);
  drawArenaSlab(ctx, 56, 84, ARENA_WIDTH - 112, ARENA_HEIGHT - 122, 22, '#1E1B2E', '#FF7A1A');

  const t = getMotionTime();
  // Placed items
  for (const it of snap.items) {
    if (it.kind === 'saw') {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(t * 7);
      ctx.fillStyle = '#EF4444';
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -22, 8, 44);
      }
      drawSphere3D(ctx, 0, 0, 14, '#CBD5E1', '#FFFFFF');
      ctx.restore();
    } else if (it.kind === 'spring') {
      drawExtrudedBox3D(ctx, it.x - it.w / 2, it.y - it.h / 2, it.w, it.h, 8, '#10D98B', '#047857', 8);
    } else if (it.kind === 'spike') {
      ctx.fillStyle = '#F43F5E';
      for (let sx = it.x - it.w / 2; sx < it.x + it.w / 2 - 8; sx += 18) {
        ctx.beginPath();
        ctx.moveTo(sx, it.y + 10);
        ctx.lineTo(sx + 9, it.y - 12);
        ctx.lineTo(sx + 18, it.y + 10);
        ctx.fill();
      }
    } else {
      const col = it.kind === 'ice' ? '#38BDF8' : it.ownerId === 'sys' ? '#475569' : it.colorHex;
      drawExtrudedBox3D(ctx, it.x - it.w / 2, it.y - it.h / 2, it.w, it.h, 10, col, shadeHex(col, -0.35), 7);
    }
  }

  // Goal Flag
  ctx.save();
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(snap.goal.x, snap.goal.y + 34);
  ctx.lineTo(snap.goal.x, snap.goal.y - 38);
  ctx.stroke();
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.moveTo(snap.goal.x, snap.goal.y - 38);
  ctx.lineTo(snap.goal.x + 38, snap.goal.y - 24);
  ctx.lineTo(snap.goal.x, snap.goal.y - 10);
  ctx.fill();
  ctx.restore();

  for (const p of snap.players) {
    if (snap.phase === 'build' && !p.placedThisRound) {
      ctx.save();
      ctx.strokeStyle = p.colorHex;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(p.cursorX - 42, p.cursorY - 14, 84, 28);
      ctx.fillStyle = p.colorHex;
      ctx.font = '800 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tCanvas(p.selectedKind.toUpperCase()), p.cursorX, p.cursorY - 22);
      ctx.restore();
    }
    if (!p.alive) continue;
    drawShadowOval(ctx, p.x, p.y + 14, 16, 0.32);
    drawCharacterPod3D(ctx, p.x, p.y, 18, p.colorHex, 0, 0);
    drawNameplate(ctx, p.x, p.y - 32, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · R${snap.round}`, '#FF7A1A');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FF7A1A', 16);
}

// 2. TRACK CRAFTER GP
export function renderTrackCrafterGp(ctx: CanvasRenderingContext2D, snap: TrackCrafterGpSnapshot): void {
  drawStudioBackdrop(ctx, '#071421', 'rgba(0,194,255,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 64, 84, ARENA_WIDTH - 128, ARENA_HEIGHT - 122, 24, '#0F172A', '#00C2FF');

  // Track loop spine
  if (snap.nodes.length >= 2) {
    ctx.save();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 54;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    snap.nodes.forEach((n, idx) => (idx === 0 ? ctx.moveTo(n.x, n.y) : ctx.lineTo(n.x, n.y)));
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 14]);
    ctx.stroke();
    ctx.restore();
  }

  for (let i = 0; i < snap.nodes.length; i++) {
    const n = snap.nodes[i];
    const col =
      n.kind === 'boost'
        ? '#10D98B'
        : n.kind === 'hazard'
        ? '#B45309'
        : n.kind === 'ramp'
        ? '#FFB800'
        : '#38BDF8';
    drawSphere3D(ctx, n.x, n.y, n.kind === 'normal' ? 12 : 20, col, '#FFFFFF');
  }

  for (const p of snap.players) {
    const target = snap.nodes[p.nodeIdx];
    if (target) {
      ctx.save();
      ctx.strokeStyle = p.colorHex;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawShadowOval(ctx, p.x, p.y + 8, 18, 0.34);
    drawCharacterPod3D(ctx, p.x, p.y, 19, p.colorHex, p.angle, 0);
    drawNameplate(
      ctx,
      p.x,
      p.y - 34,
      snap.phase === 'craft' && !p.placedPiece ? `${p.name} [${tCanvas(p.pickKind.toUpperCase())}]` : `${p.name} · ${p.score}`,
      p.colorHex
    );
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · L${snap.round}`, '#00C2FF');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#00C2FF', 16);
}

// 3. SLINGSHOT FORTRESS
export function renderSlingshotFortress(ctx: CanvasRenderingContext2D, snap: SlingshotFortressSnapshot): void {
  drawStudioBackdrop(ctx, '#16110B', 'rgba(255,184,0,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 56, 86, ARENA_WIDTH - 112, ARENA_HEIGHT - 124, 20, '#1B2432', '#FFB800');

  // Ground strip
  ctx.fillStyle = '#334155';
  ctx.fillRect(68, 595, ARENA_WIDTH - 136, 30);

  for (const b of snap.blocks) {
    const col = b.mat === 'tnt' ? '#EF4444' : b.mat === 'stone' ? '#94A3B8' : '#D97706';
    drawExtrudedBox3D(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 8, col, shadeHex(col, -0.38), 5);
    if (b.mat === 'tnt') {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TNT', b.x, b.y + 4);
    }
  }

  for (const tg of snap.targets) {
    drawShadowOval(ctx, tg.x, tg.y + tg.r, tg.r, 0.35);
    drawSphere3D(ctx, tg.x, tg.y, tg.r, tg.gold ? '#FACC15' : '#10D98B', '#FFFFFF');
  }

  for (const pr of snap.projectiles) {
    drawSphere3D(ctx, pr.x, pr.y, pr.cluster ? 11 : 14, pr.colorHex, '#FFFFFF');
  }

  for (const p of snap.players) {
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * (95 + p.power * 85), p.y + Math.sin(p.aimAngle) * (95 + p.power * 85));
    ctx.stroke();
    ctx.restore();
    drawCharacterPod3D(ctx, p.x, p.y, 17, p.colorHex, p.aimAngle, 0);
    drawNameplate(ctx, p.x, p.y - 30, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · W${snap.wave}`, '#FFB800');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FFB800', 16);
}

// 4. ROPE SLICE PHYSICS
export function renderRopeSlicePhysics(ctx: CanvasRenderingContext2D, snap: RopeSlicePhysicsSnapshot): void {
  drawStudioBackdrop(ctx, '#081813', 'rgba(16,217,139,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 64, 84, ARENA_WIDTH - 128, ARENA_HEIGHT - 122, 22, '#0F221C', '#10D98B');

  for (const bk of snap.buckets) {
    drawExtrudedBox3D(ctx, bk.x - bk.w / 2, bk.y - 22, bk.w, 40, 10, bk.colorHex, shadeHex(bk.colorHex, -0.4), 10);
  }

  for (const r of snap.ropes) {
    if (!r.cut) {
      ctx.save();
      ctx.strokeStyle = '#FDE68A';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(r.ax, r.ay);
      ctx.lineTo(r.orbX, r.orbY);
      ctx.stroke();
      ctx.restore();
      drawSphere3D(ctx, r.ax, r.ay, 8, '#CBD5E1', '#FFFFFF');
    }
    const orbCol = r.kind === 'bomb' ? '#EF4444' : r.kind === 'gold' ? '#FACC15' : '#EC4899';
    drawSphere3D(ctx, r.orbX, r.orbY, 19, orbCol, '#FFFFFF');
  }

  for (const p of snap.players) {
    if (p.gustTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawSphere3D(ctx, p.x, p.y, 16, p.colorHex, '#FFFFFF');
    drawNameplate(ctx, p.x, p.y - 28, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#10D98B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10D98B', 16);
}

// 5. WOBBLY TIMBER PULL
export function renderWobblyTimberPull(ctx: CanvasRenderingContext2D, snap: WobblyTimberPullSnapshot): void {
  drawStudioBackdrop(ctx, '#181108', 'rgba(245,158,11,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 180, 86, ARENA_WIDTH - 360, ARENA_HEIGHT - 122, 24, '#1F2430', '#F59E0B');

  ctx.save();
  ctx.translate(600, 560);
  ctx.rotate(snap.tiltAngle);
  for (const row of snap.rows) {
    const ry = -row.row * 44 - 38;
    for (let c = 0; c < 3; c++) {
      if (!row.blocks[c]) continue;
      const bx = (c - 1) * 86 - 38;
      const col = row.stress > 0.7 ? '#F97316' : '#D97706';
      drawExtrudedBox3D(ctx, bx, ry, 76, 34, 8, col, shadeHex(col, -0.35), 6);
    }
  }
  for (const p of snap.players) {
    const rx = (p.cursorCol - 1) * 86 - 42;
    const ry = -p.cursorRow * 44 - 42;
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(rx, ry, 84, 42);
    if (p.pullProgress > 0.05) {
      ctx.fillStyle = p.colorHex;
      ctx.fillRect(rx, ry - 8, 84 * p.pullProgress, 5);
    }
  }
  ctx.restore();

  // Score strip along bottom inside safe zone
  snap.players.forEach((p, i) => {
    const sx = 280 + i * 165;
    drawNameplate(ctx, sx, 622, `${p.name} · ${p.score}`, p.colorHex);
  });

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#F59E0B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F59E0B', 16);
}

// 6. ARTILLERY CRATER WAR
export function renderArtilleryCraterWar(ctx: CanvasRenderingContext2D, snap: ArtilleryCraterWarSnapshot): void {
  drawStudioBackdrop(ctx, '#170B0E', 'rgba(239,68,68,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 56, 84, ARENA_WIDTH - 112, ARENA_HEIGHT - 122, 20, '#0F172A', '#EF4444');

  // Terrain polygon
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(68, 636);
  snap.terrain.forEach((hy, idx) => {
    const tx = clampX(idx * 20);
    ctx.lineTo(tx, Math.min(636, hy));
  });
  ctx.lineTo(ARENA_WIDTH - 68, 636);
  ctx.closePath();
  ctx.fillStyle = '#334155';
  ctx.fill();
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  for (const cr of snap.craters) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - cr.age / 0.7);
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.arc(cr.x, cr.y, cr.r * (0.5 + cr.age), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const sh of snap.shells) {
    drawSphere3D(ctx, sh.x, sh.y, sh.big ? 11 : 8, sh.colorHex, '#FFFFFF');
  }

  for (const p of snap.players) {
    if (!p.alive) continue;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 34, p.y + Math.sin(p.aimAngle) * 34);
    ctx.stroke();
    ctx.restore();
    drawCharacterPod3D(ctx, p.x, p.y, 17, p.colorHex, p.aimAngle, 0);
    drawNameplate(ctx, p.x, p.y - 34, `${p.name} · ${p.hp}HP · ${p.score}`, p.colorHex);
  }

  const windDir = snap.wind >= 0 ? '→' : '←';
  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · WIND ${windDir}${Math.abs(Math.round(snap.wind))}`, '#EF4444');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EF4444', 16);
}

function clampX(x: number): number {
  return x < 68 ? 68 : x > ARENA_WIDTH - 68 ? ARENA_WIDTH - 68 : x;
}

// 7. BRIDGE LOAD STRESS
export function renderBridgeLoadStress(ctx: CanvasRenderingContext2D, snap: BridgeLoadStressSnapshot): void {
  drawStudioBackdrop(ctx, '#071422', 'rgba(56,189,248,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 56, 84, ARENA_WIDTH - 112, ARENA_HEIGHT - 122, 22, '#0F172A', '#38BDF8');

  // Canyon cliff ledges
  drawExtrudedBox3D(ctx, 76, 430, 154, 190, 12, '#334155', '#1E293B', 8);
  drawExtrudedBox3D(ctx, 970, 430, 154, 190, 12, '#334155', '#1E293B', 8);

  // Beams
  for (const bm of snap.beams) {
    if (bm.broken) continue;
    const pa = snap.anchors[bm.a];
    const pb = snap.anchors[bm.b];
    if (!pa || !pb) continue;
    ctx.save();
    ctx.strokeStyle = bm.stress > 0.65 ? '#EF4444' : bm.mat === 'steel' ? '#38BDF8' : '#F59E0B';
    ctx.lineWidth = bm.mat === 'steel' ? 9 : 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.restore();
  }

  for (const a of snap.anchors) {
    drawSphere3D(ctx, a.x, a.y, 11, '#E2E8F0', '#FFFFFF');
  }

  for (const p of snap.players) {
    const cur = snap.anchors[p.cursorIdx];
    if (cur) {
      ctx.save();
      ctx.strokeStyle = p.colorHex;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cur.x, cur.y, 19, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (p.selectedFrom !== null && snap.anchors[p.selectedFrom]) {
      const fr = snap.anchors[p.selectedFrom];
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3;
      ctx.strokeRect(fr.x - 16, fr.y - 16, 32, 32);
      ctx.restore();
    }
    drawNameplate(ctx, 250 + p.slotIndex * 185, 622, `${p.name} · ${p.score}`, p.colorHex);
  }

  // Convoy truck
  drawExtrudedBox3D(ctx, snap.truckX - 30, snap.truckY - 20, 60, 34, 8, '#10D98B', '#047857', 8);

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#38BDF8');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#38BDF8', 16);
}

// 8. HILL TORQUE CLIMB
export function renderHillTorqueClimb(ctx: CanvasRenderingContext2D, snap: HillTorqueClimbSnapshot): void {
  drawStudioBackdrop(ctx, '#061A14', 'rgba(16,217,139,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 56, 84, ARENA_WIDTH - 112, ARENA_HEIGHT - 122, 22, '#0F1E2A', '#10D98B');

  if (snap.terrainHeights.length >= 2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(68, 636);
    for (const pt of snap.terrainHeights) {
      ctx.lineTo(clampX(pt.x), Math.min(636, pt.y));
    }
    ctx.lineTo(ARENA_WIDTH - 68, 636);
    ctx.closePath();
    ctx.fillStyle = '#065F46';
    ctx.fill();
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  }

  for (const c of snap.coins) {
    drawSphere3D(ctx, c.x, c.y, c.gold ? 15 : 11, c.gold ? '#FACC15' : '#38BDF8', '#FFFFFF');
  }

  for (const p of snap.players) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    drawExtrudedBox3D(ctx, -22, -12, 44, 20, 6, p.colorHex, shadeHex(p.colorHex, -0.35), 6);
    drawSphere3D(ctx, -14, 12, 8, '#1E293B', '#94A3B8');
    drawSphere3D(ctx, 14, 12, 8, '#1E293B', '#94A3B8');
    ctx.restore();
    drawNameplate(ctx, p.x, p.y - 34, `${p.name} · ${p.distMeters}m · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#10D98B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10D98B', 16);
}

// 9. 3-LANE METRO DASH
export function renderThreeLaneMetro(ctx: CanvasRenderingContext2D, snap: ThreeLaneMetroSnapshot): void {
  drawStudioBackdrop(ctx, '#170818', 'rgba(255,59,154,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 110, 84, ARENA_WIDTH - 220, ARENA_HEIGHT - 122, 24, '#131624', '#FF3B9A');

  const laneTopX = [500, 600, 700];
  const laneBotX = [310, 600, 890];
  for (let l = 0; l < 3; l++) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(laneTopX[l], 125);
    ctx.lineTo(laneBotX[l], 615);
    ctx.stroke();
    ctx.restore();
  }

  const sortedObs = [...snap.obstacles].sort((a, b) => b.z - a.z);
  for (const ob of sortedObs) {
    const t = 1 - Math.max(0, Math.min(1, ob.z));
    const cx = laneTopX[ob.lane] + (laneBotX[ob.lane] - laneTopX[ob.lane]) * t;
    const cy = 130 + 470 * t;
    const sc = 0.35 + t * 0.85;
    if (ob.kind === 'coin' || ob.kind === 'magnet') {
      drawSphere3D(ctx, cx, cy, 14 * sc, ob.kind === 'magnet' ? '#00C2FF' : '#FACC15', '#FFFFFF');
    } else if (ob.kind === 'train') {
      drawExtrudedBox3D(ctx, cx - 48 * sc, cy - 72 * sc, 96 * sc, 80 * sc, 10, '#FF3B9A', '#831843', 10);
    } else if (ob.kind === 'highbar') {
      drawExtrudedBox3D(ctx, cx - 54 * sc, cy - 68 * sc, 108 * sc, 24 * sc, 8, '#FFB800', '#92400E', 6);
    } else {
      drawExtrudedBox3D(ctx, cx - 50 * sc, cy - 26 * sc, 100 * sc, 30 * sc, 8, '#EF4444', '#991B1B', 6);
    }
  }

  for (const p of snap.players) {
    const px = laneBotX[p.lane] + (p.slotIndex % 2 === 0 ? -10 : 10);
    const py = 545 - p.zHeight * 0.9;
    drawShadowOval(ctx, px, 560, 22, 0.35);
    drawCharacterPod3D(ctx, px, py, p.sliding ? 15 : 22, p.colorHex, -Math.PI / 2, p.zHeight * 0.5);
    drawNameplate(ctx, px, py - 38, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#FF3B9A');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FF3B9A', 16);
}

// 10. TILT LABYRINTH
export function renderTiltLabyrinth(ctx: CanvasRenderingContext2D, snap: TiltLabyrinthSnapshot): void {
  drawStudioBackdrop(ctx, '#0E170A', 'rgba(158,230,34,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 110, 96, ARENA_WIDTH - 220, ARENA_HEIGHT - 134, 24, '#3B2F23', '#9EE622');

  for (const h of snap.holes) {
    ctx.fillStyle = '#07090D';
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  for (const w of snap.walls) {
    drawExtrudedBox3D(ctx, w.x, w.y, w.w, w.h, 10, '#D97706', '#78350F', 6);
  }

  for (const g of snap.goals) {
    drawSphere3D(ctx, g.x, g.y, g.r, g.gold ? '#FACC15' : '#10D98B', '#FFFFFF');
  }

  for (const p of snap.players) {
    if (!p.alive) continue;
    drawShadowOval(ctx, p.x, p.y + 8, 16, 0.35);
    drawSphere3D(ctx, p.x, p.y - p.z * 0.5, 16, p.colorHex, '#FFFFFF');
    drawNameplate(ctx, p.x, p.y - 34 - p.z * 0.5, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · ST${snap.stage}`, '#9EE622');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#9EE622', 16);
}

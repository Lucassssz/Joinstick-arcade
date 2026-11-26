import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import type {
  AirTrafficLandingSnapshot,
  FishingTensionTugSnapshot,
  HordeSurvivorSnapshot,
  LaneTowerBlitzSnapshot,
  MovingDayHavocSnapshot,
  PathTowerDefenseSnapshot,
  PipeFlowSprintSnapshot,
  RailSwitchRushSnapshot,
  StarshipCrewChaosSnapshot,
  SwarmHerdClashSnapshot,
} from '../shared/packCrewDefenseTypes';
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

// 1. LANE TOWER BLITZ
export function renderLaneTowerBlitz(ctx: CanvasRenderingContext2D, snap: LaneTowerBlitzSnapshot): void {
  drawStudioBackdrop(ctx, '#061B12', 'rgba(16,217,139,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 74, 86, ARENA_WIDTH - 148, ARENA_HEIGHT - 124, 22, '#0D261B', '#10D98B');

  for (let r = 0; r < 4; r++) {
    const ly = 175 + r * 122;
    ctx.fillStyle = r % 2 === 0 ? 'rgba(16,217,139,0.08)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(140, ly - 48, 940, 96);
    for (let c = 0; c < 6; c++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeRect(235 + c * 118 - 44, ly - 40, 88, 80);
    }
  }

  for (const t of snap.towers) {
    const cx = 235 + t.col * 118;
    const cy = 175 + t.row * 122;
    const col = t.kind === 'frost' ? '#38BDF8' : t.kind === 'mortar' ? '#FFB800' : '#10D98B';
    drawExtrudedBox3D(ctx, cx - 24, cy - 24, 48, 48, 8, col, shadeHex(col, -0.35), 10);
    ctx.fillStyle = '#0B1016';
    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`L${t.level}`, cx, cy + 5);
  }

  for (const e of snap.enemies) {
    const ey = 175 + e.row * 122;
    drawCharacterPod3D(ctx, e.x, ey, e.fast ? 15 : 21, e.fast ? '#FB7185' : '#EF4444', Math.PI, 0);
  }

  for (const b of snap.bolts) {
    drawSphere3D(ctx, b.x, b.y, 7, b.colorHex, '#FFFFFF');
  }

  for (const p of snap.players) {
    const cx = 235 + p.col * 118;
    const cy = 175 + p.row * 122;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - 42, cy - 38, 84, 76);
    ctx.restore();
    drawNameplate(ctx, 210 + p.slotIndex * 195, 636, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · BASE ${snap.baseHp}%`, '#10D98B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10D98B', 16);
}

// 2. PATH TOWER DEFENSE
export function renderPathTowerDefense(ctx: CanvasRenderingContext2D, snap: PathTowerDefenseSnapshot): void {
  drawStudioBackdrop(ctx, '#071423', 'rgba(0,194,255,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 64, 86, ARENA_WIDTH - 128, ARENA_HEIGHT - 124, 22, '#0F1B2B', '#00C2FF');

  // Road spline
  ctx.save();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 48;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  snap.waypoints.forEach((wp, i) => (i === 0 ? ctx.moveTo(wp.x, wp.y) : ctx.lineTo(wp.x, wp.y)));
  ctx.stroke();
  ctx.restore();

  for (const bm of snap.beams) {
    ctx.save();
    ctx.strokeStyle = bm.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bm.x1, bm.y1);
    ctx.lineTo(bm.x2, bm.y2);
    ctx.stroke();
    ctx.restore();
  }

  for (const pd of snap.pads) {
    if (pd.tower === 'none') {
      drawSphere3D(ctx, pd.x, pd.y, 18, '#1E293B', '#64748B');
    } else {
      const col = pd.tower === 'cannon' ? '#FF7A1A' : pd.tower === 'frost' ? '#38BDF8' : '#10D98B';
      drawExtrudedBox3D(ctx, pd.x - 22, pd.y - 22, 44, 44, 8, col, shadeHex(col, -0.38), 10);
    }
  }

  for (const c of snap.creeps) {
    drawSphere3D(ctx, c.x, c.y, c.boss ? 21 : 14, c.chilled ? '#38BDF8' : c.boss ? '#EF4444' : '#F43F5E', '#FFFFFF');
  }

  for (const p of snap.players) {
    const pad = snap.pads[p.padIdx];
    if (pad) {
      ctx.save();
      ctx.strokeStyle = p.colorHex;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawNameplate(ctx, 210 + p.slotIndex * 195, 636, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · ♥${snap.lives}`, '#00C2FF');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#00C2FF', 16);
}

// 3. HORDE SURVIVOR
export function renderHordeSurvivor(ctx: CanvasRenderingContext2D, snap: HordeSurvivorSnapshot): void {
  drawStudioBackdrop(ctx, '#180716', 'rgba(255,59,154,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 74, 86, ARENA_WIDTH - 148, ARENA_HEIGHT - 122, 22, '#171124', '#FF3B9A');

  for (const g of snap.gems) {
    drawSphere3D(ctx, g.x, g.y, g.gold ? 10 : 7, g.gold ? '#FACC15' : '#00C2FF', '#FFFFFF');
  }

  for (const e of snap.enemies) {
    drawShadowOval(ctx, e.x, e.y + e.r * 0.6, e.r, 0.3);
    drawSphere3D(ctx, e.x, e.y, e.r, e.elite ? '#A855F7' : '#EF4444', '#FCA5A5');
  }

  for (const p of snap.players) {
    if (!p.alive) continue;
    if (p.novaTimer > 0) {
      ctx.save();
      ctx.strokeStyle = p.colorHex;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 155 * (1 - p.novaTimer), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const bladeCount = Math.min(5, 1 + p.level);
    const orbitR = 54 + p.level * 6;
    for (let b = 0; b < bladeCount; b++) {
      const ang = p.orbitAngle + (b / bladeCount) * Math.PI * 2;
      drawSphere3D(ctx, p.x + Math.cos(ang) * orbitR, p.y + Math.sin(ang) * orbitR, 8, '#38BDF8', '#FFFFFF');
    }
    drawCharacterPod3D(ctx, p.x, p.y, 18, p.colorHex, 0, 0);
    drawNameplate(ctx, p.x, p.y - 34, `${p.name} L${p.level} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#FF3B9A');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FF3B9A', 16);
}

// 4. STARSHIP CREW CHAOS
export function renderStarshipCrewChaos(ctx: CanvasRenderingContext2D, snap: StarshipCrewChaosSnapshot): void {
  drawStudioBackdrop(ctx, '#060D1E', 'rgba(56,189,248,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 74, 86, ARENA_WIDTH - 148, ARENA_HEIGHT - 122, 24, '#091124', '#38BDF8');

  for (const l of snap.lasers) {
    ctx.save();
    ctx.strokeStyle = l.colorHex;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    ctx.restore();
  }

  for (const th of snap.threats) {
    const col = th.kind === 'gem' ? '#FACC15' : th.kind === 'drone' ? '#FF3B9A' : '#94A3B8';
    drawSphere3D(ctx, th.x, th.y, th.r, col, '#FFFFFF');
  }

  // Shared Starship Hull
  ctx.save();
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(snap.shipX, snap.shipY, 102, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Arc Shield
  ctx.strokeStyle = '#10D98B';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(snap.shipX, snap.shipY, 118, snap.shieldAngle - 0.9, snap.shieldAngle + 0.9);
  ctx.stroke();
  ctx.restore();

  for (const st of snap.stations) {
    drawSphere3D(ctx, st.x, st.y, 17, st.activeBy ?? '#475569', '#FFFFFF');
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(st.id.toUpperCase()), st.x, st.y + 28);
  }

  for (const p of snap.players) {
    drawCharacterPod3D(ctx, p.x, p.y, 14, p.colorHex, 0, 0);
    drawNameplate(ctx, p.x, p.y - 26, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · HULL ${snap.hullHp}%`, '#38BDF8');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#38BDF8', 16);
}

// 5. SWARM HERD CLASH
export function renderSwarmHerdClash(ctx: CanvasRenderingContext2D, snap: SwarmHerdClashSnapshot): void {
  drawStudioBackdrop(ctx, '#171206', 'rgba(255,184,0,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 88, ARENA_WIDTH - 168, ARENA_HEIGHT - 126, 24, '#1A202C', '#FFB800');

  for (const n of snap.neutrals) {
    drawSphere3D(ctx, n.x, n.y, 8, '#E2E8F0', '#FFFFFF');
  }

  for (const p of snap.players) {
    const shown = Math.min(18, p.swarmCount);
    const orbitR = 28 + Math.min(26, p.swarmCount * 0.9);
    for (let k = 0; k < shown; k++) {
      const a = (k / shown) * Math.PI * 2 + p.angle;
      const sx = p.x + Math.cos(a) * orbitR;
      const sy = p.y + Math.sin(a) * orbitR;
      drawSphere3D(ctx, sx, sy, 8, p.colorHex, '#FFFFFF');
    }
    drawCharacterPod3D(ctx, p.x, p.y, 18, p.colorHex, p.angle, 0);
    drawNameplate(ctx, p.x, p.y - 34, `${p.name} (${p.swarmCount}) · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#FFB800');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FFB800', 16);
}

// 6. RAIL SWITCH RUSH
export function renderRailSwitchRush(ctx: CanvasRenderingContext2D, snap: RailSwitchRushSnapshot): void {
  drawStudioBackdrop(ctx, '#1A0F07', 'rgba(249,115,22,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 74, 86, ARENA_WIDTH - 148, ARENA_HEIGHT - 124, 22, '#111827', '#F97316');

  const railColors = ['#EF4444', '#00C2FF', '#FFB800'];
  for (let r = 0; r < 3; r++) {
    const ry = 225 + r * 150;
    ctx.strokeStyle = railColors[r];
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(130, ry);
    ctx.lineTo(1040, ry);
    ctx.stroke();
    drawExtrudedBox3D(ctx, 1005, ry - 26, 65, 52, 8, railColors[r], shadeHex(railColors[r], -0.4), 8);
  }

  for (const sw of snap.switches) {
    drawSphere3D(ctx, sw.x, sw.y, 17, sw.state ? '#10D98B' : '#475569', '#FFFFFF');
    if (sw.state) {
      ctx.save();
      ctx.strokeStyle = '#10D98B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sw.x, sw.y);
      ctx.lineTo(sw.x + 48, sw.y >= 520 ? 225 : sw.y + 150);
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const tr of snap.trains) {
    drawExtrudedBox3D(ctx, tr.x - 28, tr.y - 16, 56, 32, 8, tr.colorHex, shadeHex(tr.colorHex, -0.35), 8);
    ctx.fillStyle = '#0B1016';
    ctx.font = '900 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(tr.label), tr.x, tr.y + 4);
  }

  for (const p of snap.players) {
    const sw = snap.switches[p.cursorSwitch];
    if (sw) {
      ctx.save();
      ctx.strokeStyle = p.colorHex;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawNameplate(ctx, 210 + p.slotIndex * 195, 636, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#F97316');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F97316', 16);
}

// 7. AIR TRAFFIC LANDING
export function renderAirTrafficLanding(ctx: CanvasRenderingContext2D, snap: AirTrafficLandingSnapshot): void {
  drawStudioBackdrop(ctx, '#051525', 'rgba(56,189,248,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 74, 86, ARENA_WIDTH - 148, ARENA_HEIGHT - 124, 24, '#0B192C', '#38BDF8');

  for (const rw of snap.runways) {
    drawExtrudedBox3D(ctx, rw.x - 52, rw.y - 26, 104, 52, 8, rw.colorHex, shadeHex(rw.colorHex, -0.4), 10);
    ctx.fillStyle = '#0B1016';
    ctx.font = '900 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(rw.kind === 'jet' ? 'JET' : 'HELI'), rw.x, rw.y + 5);
  }

  for (const pl of snap.planes) {
    ctx.save();
    ctx.strokeStyle = pl.colorHex;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pl.x, pl.y);
    ctx.lineTo(pl.x + Math.cos(pl.angle) * 58, pl.y + Math.sin(pl.angle) * 58);
    ctx.stroke();
    ctx.restore();
    drawCharacterPod3D(ctx, pl.x, pl.y, 18, pl.colorHex, pl.angle, 0);
  }

  for (const p of snap.players) {
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawNameplate(ctx, p.x, p.y - 28, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#38BDF8');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#38BDF8', 16);
}

// 8. PIPE FLOW SPRINT
export function renderPipeFlowSprint(ctx: CanvasRenderingContext2D, snap: PipeFlowSprintSnapshot): void {
  drawStudioBackdrop(ctx, '#061B15', 'rgba(16,217,139,0.16)', 'rgba(255,255,255,0.03)', 44);
  const bw = 560;
  const bh = 400;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 128;
  const cell = bw / snap.cols;
  drawArenaSlab(ctx, ox - 28, oy - 24, bw + 56, bh + 48, 22, '#0F172A', '#10D98B');

  // Source Valve & Drain tags
  drawSphere3D(ctx, ox - 18, oy + Math.floor(snap.rows / 2) * cell + cell / 2, 16, '#10D98B', '#FFFFFF');
  drawSphere3D(ctx, ox + bw + 18, oy + Math.floor(snap.rows / 2) * cell + cell / 2, 16, '#FFB800', '#FFFFFF');

  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const pp = snap.pipes[r * snap.cols + c];
      const cx = ox + (c + 0.5) * cell;
      const cy = oy + (r + 0.5) * cell;
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(cx - cell * 0.44, cy - cell * 0.44, cell * 0.88, cell * 0.88);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((pp.rot * Math.PI) / 2);
      ctx.strokeStyle = pp.filled ? '#10D98B' : '#94A3B8';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (pp.kind === 'straight') {
        ctx.moveTo(-cell * 0.4, 0);
        ctx.lineTo(cell * 0.4, 0);
      } else if (pp.kind === 'corner') {
        ctx.moveTo(0, -cell * 0.4);
        ctx.lineTo(0, 0);
        ctx.lineTo(cell * 0.4, 0);
      } else {
        ctx.moveTo(-cell * 0.4, 0);
        ctx.lineTo(cell * 0.4, 0);
        ctx.moveTo(0, -cell * 0.4);
        ctx.lineTo(0, cell * 0.4);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const p of snap.players) {
    const cx = ox + (p.c + 0.5) * cell;
    const cy = oy + (p.r + 0.5) * cell;
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - cell * 0.44, cy - cell * 0.44, cell * 0.88, cell * 0.88);
    ctx.restore();
    drawNameplate(ctx, 210 + p.slotIndex * 195, 636, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#10D98B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10D98B', 16);
}

// 9. MOVING DAY HAVOC
export function renderMovingDayHavoc(ctx: CanvasRenderingContext2D, snap: MovingDayHavocSnapshot): void {
  drawStudioBackdrop(ctx, '#1A1109', 'rgba(255,122,26,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 74, 86, ARENA_WIDTH - 148, ARENA_HEIGHT - 124, 22, '#27201B', '#FF7A1A');

  const tz = snap.truckZone;
  drawExtrudedBox3D(ctx, tz.x, tz.y, tz.w, tz.h, 12, '#065F46', '#064E3B', 14);
  ctx.fillStyle = '#34D399';
  ctx.font = '900 18px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tCanvas('TRUCK BAY'), tz.x + tz.w / 2, tz.y + 34);

  for (const it of snap.items) {
    const col = it.kind === 'piano' ? '#FACC15' : it.kind === 'sofa' ? '#FF3B9A' : it.kind === 'tv' ? '#38BDF8' : '#D97706';
    drawExtrudedBox3D(ctx, it.x - 24, it.y - 18, 48, 36, 9, col, shadeHex(col, -0.35), 7);
  }

  for (const p of snap.players) {
    drawShadowOval(ctx, p.x, p.y + 8, 18, 0.35);
    drawCharacterPod3D(ctx, p.x, p.y, 18, p.colorHex, p.angle, 0);
    drawNameplate(ctx, p.x, p.y - 34, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#FF7A1A');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#FF7A1A', 16);
}

// 10. FISHING TENSION TUG
export function renderFishingTensionTug(ctx: CanvasRenderingContext2D, snap: FishingTensionTugSnapshot): void {
  drawStudioBackdrop(ctx, '#041624', 'rgba(0,194,255,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 74, 86, ARENA_WIDTH - 148, ARENA_HEIGHT - 124, 28, '#0B2F4A', '#00C2FF');

  for (const f of snap.fish) {
    drawSphere3D(ctx, f.x, f.y, f.size, f.gold ? '#FACC15' : '#38BDF8', '#FFFFFF');
  }

  for (const p of snap.players) {
    if (p.hooked) {
      ctx.save();
      ctx.strokeStyle = p.tension > 0.72 ? '#EF4444' : '#10D98B';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34, -Math.PI / 2, -Math.PI / 2 + p.tension * Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 24, -Math.PI / 2, -Math.PI / 2 + p.reelProgress * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawSphere3D(ctx, p.x, p.y, 14, p.colorHex, '#FFFFFF');
    drawNameplate(ctx, p.x, p.y - 42, `${p.name} (${p.catches}) · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#00C2FF');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#00C2FF', 16);
}

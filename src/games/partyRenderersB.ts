import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type FreezeTagSnapshot,
  type GhostHuntSnapshot,
  type GravityFlipSnapshot,
  type HookShotSnapshot,
  type MeteorSwarmSnapshot,
} from '../shared/types';
import { drawNameplate, tCanvas } from './renderers';
import {
  drawArenaSlab,
  drawCharacterPod3D,
  drawCoin3D,
  drawExtrudedBox3D,
  drawExtrudedCylinder3D,
  drawShadowOval,
  drawSphere3D,
  drawStudioBackdrop,
  shadeHex,
} from './render25d';

function drawHudPill(ctx: CanvasRenderingContext2D, leftText: string, centerText: string, rightText?: string) {
  ctx.save();
  ctx.fillStyle = 'rgba(13, 15, 20, 0.86)';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(ARENA_WIDTH / 2 - 220, 12, 440, 34, 10);
  ctx.fill();
  ctx.stroke();

  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#CBD5E1';
  ctx.textAlign = 'left';
  ctx.fillText(tCanvas(leftText), ARENA_WIDTH / 2 - 204, 29);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tCanvas(centerText), ARENA_WIDTH / 2, 29);

  if (rightText) {
    ctx.fillStyle = '#00C2FF';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(tCanvas(rightText), ARENA_WIDTH / 2 + 204, 29);
  }
  ctx.restore();
}

// ============================================================
// 16. FREEZE TAG ARENA (2.5D Frosted Ice Rink & 3D Ice Cubes)
// ============================================================
export function renderFreezeTag(ctx: CanvasRenderingContext2D, snap: FreezeTagSnapshot): void {
  drawStudioBackdrop(ctx, '#09111B', 'rgba(56, 189, 248, 0.1)', 'rgba(125, 211, 252, 0.04)', 56);

  // Raised 2.5D frosted ice-rink slab
  const iceGrad = ctx.createLinearGradient(0, 24, ARENA_WIDTH, ARENA_HEIGHT - 24);
  iceGrad.addColorStop(0, '#102438');
  iceGrad.addColorStop(0.5, '#132C44');
  iceGrad.addColorStop(1, '#0D1E30');
  drawArenaSlab(ctx, 24, 22, ARENA_WIDTH - 48, ARENA_HEIGHT - 46, 28, 16, iceGrad, '#0B1A2B', '#38BDF8', 3.5);

  // Subtle ice sheen streaks + center rink circle
  ctx.save();
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.07)';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(180, 40);
  ctx.lineTo(420, ARENA_HEIGHT - 40);
  ctx.moveTo(640, 40);
  ctx.lineTo(900, ARENA_HEIGHT - 40);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Ice traps on rink floor
  for (const t of snap.traps) {
    ctx.save();
    ctx.fillStyle = `rgba(0, 194, 255, ${t.alpha * 0.22})`;
    ctx.strokeStyle = `rgba(125, 211, 252, ${t.alpha * 0.85})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Y-sort ice pillars and skaters
  type IceItem =
    | { kind: 'pillar'; y: number; p: (typeof snap.pillars)[number] }
    | { kind: 'player'; y: number; p: (typeof snap.players)[number] };
  const items: IceItem[] = [
    ...snap.pillars.map((p) => ({ kind: 'pillar' as const, y: p.y, p })),
    ...snap.players.map((p) => ({ kind: 'player' as const, y: p.y, p })),
  ];
  items.sort((a, b) => a.y - b.y);

  for (const it of items) {
    if (it.kind === 'pillar') {
      const { p } = it;
      drawExtrudedCylinder3D(ctx, p.x, p.y, p.r, 24, '#234A6E', '#112840', '#7DD3FC', '#BAE6FD');
    } else {
      const { p } = it;
      if (p.role === 'hunter') {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 194, 255, 0.18)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      drawCharacterPod3D(ctx, p.x, p.y, 19, 0, p.colorHex, {
        height: 11,
        rimColor: p.role === 'hunter' ? '#38BDF8' : '#FFFFFF',
        frozen: p.frozen,
        showVisor: false,
      });

      const tag = p.role === 'hunter' ? 'HUNTER' : p.frozen ? 'THAW ME!' : undefined;
      drawNameplate(ctx, p.x, p.y - 42, p.slotIndex, p.name, p.frozen ? '#38BDF8' : p.colorHex, tag);
    }
  }

  // 3D Frost bolts
  for (const b of snap.bolts) {
    drawSphere3D(ctx, b.x, b.y, 9, '#38BDF8', '#FFFFFF', 7, true);
  }

  drawHudPill(ctx, `FROZEN ${snap.frozenCount}/${snap.runnerCount}`, `${Math.ceil(snap.timeLeft)}s`, 'FREEZE TAG');
  if (snap.banner) {
    ctx.save();
    ctx.font = '800 22px "Bricolage Grotesque", sans-serif';
    ctx.fillStyle = '#E0F2FE';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(snap.banner), ARENA_WIDTH / 2, 76);
    ctx.restore();
  }
}

// ============================================================
// 17. GHOST HUNT (2.5D Dark Manor & Floating Ghost)
// ============================================================
export function renderGhostHunt(ctx: CanvasRenderingContext2D, snap: GhostHuntSnapshot): void {
  drawStudioBackdrop(ctx, '#06080D', 'rgba(168, 85, 247, 0.06)', 'rgba(255,255,255,0.025)', 60);

  // Flashlight cones from alive hunters
  for (const p of snap.players) {
    if (p.role !== 'hunter' || !p.alive) continue;
    ctx.save();
    const grad = ctx.createRadialGradient(p.x, p.y, 12, p.x, p.y, 330);
    grad.addColorStop(0, 'rgba(255, 226, 120, 0.36)');
    grad.addColorStop(0.7, 'rgba(255, 200, 70, 0.14)');
    grad.addColorStop(1, 'rgba(255, 200, 70, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 6);
    ctx.arc(p.x, p.y - 6, 330, p.angle - 0.44, p.angle + 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Radar sonar pings
  for (const pg of snap.pings) {
    ctx.save();
    ctx.strokeStyle = `rgba(82, 139, 255, ${pg.alpha})`;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(pg.x, pg.y, pg.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Proton nets
  for (const n of snap.nets) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 184, 0, 0.25)';
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Y-sort Maze Walls and Players
  type ManorItem =
    | { kind: 'wall'; y: number; w: (typeof snap.walls)[number] }
    | { kind: 'player'; y: number; p: (typeof snap.players)[number] };
  const items: ManorItem[] = [
    ...snap.walls.map((w) => ({ kind: 'wall' as const, y: w.y + w.h, w })),
    ...snap.players.filter((p) => p.alive).map((p) => ({ kind: 'player' as const, y: p.y + 8, p })),
  ];
  items.sort((a, b) => a.y - b.y);

  const bob = Math.sin(Date.now() * 0.006) * 4;
  for (const it of items) {
    if (it.kind === 'wall') {
      const { w } = it;
      drawExtrudedBox3D(ctx, w.x, w.y, w.w, w.h, 18, 6, '#232A3E', '#131724', '#475569');
    } else {
      const { p } = it;
      if (p.role === 'ghost') {
        const vis = Math.max(0.06, p.visibility);
        drawShadowOval(ctx, p.x, p.y + 16, 18, 9, 0.35 * vis);

        ctx.save();
        ctx.globalAlpha = vis;
        const gy = p.y - 10 + bob;
        const gGrad = ctx.createRadialGradient(p.x - 6, gy - 8, 3, p.x, gy, 24);
        gGrad.addColorStop(0, '#E9D5FF');
        gGrad.addColorStop(0.5, '#A855F7');
        gGrad.addColorStop(1, '#581C87');
        ctx.fillStyle = gGrad;
        ctx.strokeStyle = '#F3E8FF';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(p.x, gy, 20, Math.PI, 0);
        ctx.lineTo(p.x + 20, gy + 18);
        ctx.lineTo(p.x + 10, gy + 12);
        ctx.lineTo(p.x, gy + 18);
        ctx.lineTo(p.x - 10, gy + 12);
        ctx.lineTo(p.x - 20, gy + 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glowing eyes
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(p.x - 6, gy - 3, 3.3, 0, Math.PI * 2);
        ctx.arc(p.x + 6, gy - 3, 3.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.visibility > 0.32) {
          drawNameplate(ctx, p.x, p.y - 42 + bob, p.slotIndex, p.name, '#C084FC', `HP ${p.hp}`);
        }
      } else {
        drawCharacterPod3D(ctx, p.x, p.y, 17, p.angle, p.colorHex, {
          height: 10,
          rimColor: '#FFFFFF',
          visorColor: '#FEF08A',
        });
        drawNameplate(ctx, p.x, p.y - 36, p.slotIndex, p.name, p.colorHex, `HP ${p.hp}`);
      }
    }
  }

  const ghost = snap.players.find((p) => p.role === 'ghost');
  drawHudPill(ctx, `PHANTOM HP ${ghost?.hp ?? 0}`, `${Math.ceil(snap.timeLeft)}s`, 'GHOST HUNT');
  if (snap.banner) {
    ctx.save();
    ctx.font = '800 22px "Bricolage Grotesque", sans-serif';
    ctx.fillStyle = '#E9D5FF';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas(snap.banner), ARENA_WIDTH / 2, 76);
    ctx.restore();
  }
}

// ============================================================
// 18. METEOR SWARM (2.5D Orbital Defense)
// ============================================================
export function renderMeteorSwarm(ctx: CanvasRenderingContext2D, snap: MeteorSwarmSnapshot): void {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;

  drawStudioBackdrop(ctx, '#070A12', 'rgba(0, 194, 255, 0.08)', 'rgba(0, 194, 255, 0.03)', 64);

  // Parallax starfield
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  for (let i = 0; i < 75; i++) {
    const sx = (i * 197 + 43) % ARENA_WIDTH;
    const sy = (i * 113 + 71) % ARENA_HEIGHT;
    ctx.fillRect(sx, sy, i % 3 === 0 ? 2.5 : 1.5, i % 3 === 0 ? 2.5 : 1.5);
  }

  // Central 3D Energy Core Reactor Tower
  ctx.save();
  ctx.fillStyle = 'rgba(0, 194, 255, 0.14)';
  ctx.beginPath();
  ctx.arc(cx, cy, 66, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawExtrudedCylinder3D(ctx, cx, cy, 46, 18, '#102B40', '#0A1A28', '#00C2FF');
  drawSphere3D(ctx, cx, cy - 18, 22, snap.coreHp > 5 ? '#00C2FF' : '#FF4D2E', '#FFFFFF', 4, false);

  // Core HP ring
  ctx.save();
  ctx.strokeStyle = snap.coreHp > 5 ? '#10D98B' : '#FF4D2E';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy - 18, 54, -Math.PI / 2, -Math.PI / 2 + (snap.coreHp / snap.maxCoreHp) * Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 18px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${snap.coreHp}`, cx, cy - 22);
  ctx.restore();

  // 3D Meteors & UFOs
  for (const m of snap.meteors) {
    ctx.save();
    if (m.kind === 'ufo') {
      drawShadowOval(ctx, m.x + 2, m.y + m.r * 0.75, m.r * 0.9, m.r * 0.45, 0.4);
      ctx.translate(m.x, m.y - 6);
      // Lower saucer rim
      ctx.fillStyle = '#581C87';
      ctx.beginPath();
      ctx.ellipse(0, 5, m.r, m.r * 0.56, 0, 0, Math.PI * 2);
      ctx.fill();

      // Upper metallic saucer
      const uGrad = ctx.createLinearGradient(-m.r, -m.r * 0.5, m.r, m.r * 0.5);
      uGrad.addColorStop(0, '#C084FC');
      uGrad.addColorStop(0.5, '#9333EA');
      uGrad.addColorStop(1, '#581C87');
      ctx.fillStyle = uGrad;
      ctx.strokeStyle = '#F5D0FE';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.r, m.r * 0.56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Glass cockpit dome
      drawSphere3D(ctx, 0, -4, m.r * 0.36, '#38BDF8', '#FFFFFF', 4, false);
    } else {
      ctx.translate(m.x, m.y);
      const traceRock = (oy: number) => {
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = m.angle + (i / 7) * Math.PI * 2;
          const rad = m.r * (i % 2 === 0 ? 1 : 0.78);
          if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad + oy);
          else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad + oy);
        }
        ctx.closePath();
      };

      // Extruded rock underside
      traceRock(7);
      ctx.fillStyle = '#1E293B';
      ctx.fill();

      traceRock(0);
      const rGrad = ctx.createRadialGradient(-m.r * 0.3, -m.r * 0.3, 2, 0, 0, m.r);
      rGrad.addColorStop(0, '#64748B');
      rGrad.addColorStop(1, '#334155');
      ctx.fillStyle = rGrad;
      ctx.strokeStyle = m.hp < m.maxHp ? '#FFB800' : '#94A3B8';
      ctx.lineWidth = 2.4;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Bullets
  for (const b of snap.bullets) {
    drawSphere3D(ctx, b.x, b.y, b.enemy ? 6.5 : 4.8, b.enemy ? '#FF3B9A' : b.colorHex, '#FFFFFF', 4, false);
  }

  // Explosions
  for (const ex of snap.explosions) {
    ctx.save();
    ctx.strokeStyle = ex.colorHex;
    ctx.globalAlpha = ex.alpha;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Ships
  for (const p of snap.players) {
    drawShadowOval(ctx, p.x + 2, p.y + 13, 18, 10, p.downed ? 0.2 : 0.4);
    ctx.save();
    if (p.downed) {
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, -Math.PI / 2, -Math.PI / 2 + p.reviveProgress * Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = p.downed ? 0.4 : 1;

    // Wing underside depth
    ctx.save();
    ctx.translate(p.x, p.y + 1);
    ctx.rotate(p.angle);
    ctx.fillStyle = shadeHex(p.colorHex, -0.55);
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-14, -13);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.translate(p.x, p.y - 4);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.colorHex;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-14, -13);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E0F2FE';
    ctx.beginPath();
    ctx.ellipse(4, 0, 5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawNameplate(ctx, p.x, p.y - 34, p.slotIndex, p.name, p.colorHex, p.downed ? 'REVIVE!' : `HP ${p.hp}`);
  }

  drawHudPill(ctx, `WAVE ${snap.wave}`, `${Math.ceil(snap.timeLeft)}s`, `TEAM ${snap.teamScore}`);
}

// ============================================================
// 19. HOOK SHOT (2.5D Floating Sky Islands)
// ============================================================
export function renderHookShot(ctx: CanvasRenderingContext2D, snap: HookShotSnapshot): void {
  const bg = ctx.createRadialGradient(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 40, ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 680);
  bg.addColorStop(0, '#1B1330');
  bg.addColorStop(1, '#070910');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Subtle floating abyss stars
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 40; i++) {
    ctx.fillRect((i * 233 + 17) % ARENA_WIDTH, (i * 149 + 31) % ARENA_HEIGHT, 2, 2);
  }

  // Thick 2.5D floating metallic sky islands (sorted top-to-bottom)
  const sortedIslands = [...snap.islands].sort((a, b) => a.y - b.y);
  for (const isl of sortedIslands) {
    drawArenaSlab(ctx, isl.x, isl.y, isl.w, isl.h, 16, 22, '#222A3A', '#131722', '#64748B', 3);

    // Inner amber trim bevel
    ctx.strokeStyle = 'rgba(255, 184, 0, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(isl.x + 8, isl.y + 8, isl.w - 16, isl.h - 16, 10);
    ctx.stroke();
  }

  // Shock parry waves
  for (const w of snap.waves) {
    ctx.save();
    ctx.strokeStyle = w.colorHex;
    ctx.globalAlpha = w.alpha;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Grapple hook lines (with rope shadow)
  for (const hk of snap.hooks) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hk.x1, hk.y1);
    ctx.lineTo(hk.x2, hk.y2);
    ctx.stroke();

    ctx.strokeStyle = hk.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hk.x1, hk.y1 - 8);
    ctx.lineTo(hk.x2, hk.y2 - 8);
    ctx.stroke();
    ctx.restore();

    drawSphere3D(ctx, hk.x2, hk.y2, 8.5, '#FFFFFF', hk.colorHex, 8, false);
  }

  // Players: falling below first, then Y-sorted active players
  const players = [...snap.players]
    .filter((p) => p.alive || p.falling)
    .sort((a, b) => {
      if (a.falling !== b.falling) return Number(b.falling) - Number(a.falling);
      return a.y - b.y;
    });

  for (const p of players) {
    const scale = p.falling ? Math.max(0.24, 1 - p.fallProgress * 0.76) : 1;
    const fallDrop = p.falling ? p.fallProgress * 55 : 0;

    if (p.parryTimer > 0 && !p.falling) {
      ctx.save();
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 8, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawCharacterPod3D(ctx, p.x, p.y + fallDrop, 18, p.angle, p.colorHex, {
      height: 11,
      scale,
      alpha: p.falling ? Math.max(0.12, 1 - p.fallProgress) : 1,
      rimColor: '#FFFFFF',
    });

    if (!p.falling) {
      drawNameplate(ctx, p.x, p.y - 36, p.slotIndex, p.name, p.colorHex, `${p.kos} KO`);
    }
  }

  drawHudPill(ctx, 'HOOK SHOT', `${Math.ceil(snap.timeLeft)}s`, 'YANK RIVALS OFF!');
}

// ============================================================
// 20. GRAVITY FLIP (2.5D Recessed Neon Tunnel)
// ============================================================
export function renderGravityFlip(ctx: CanvasRenderingContext2D, snap: GravityFlipSnapshot): void {
  drawStudioBackdrop(ctx, '#0A0D14', 'rgba(0, 194, 255, 0.06)', 'rgba(255,255,255,0.03)', 80);

  // Moving background tunnel depth grid
  const offset = snap.scrollX % 80;
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -offset; x <= ARENA_WIDTH; x += 80) {
    ctx.moveTo(x, snap.ceilingY);
    ctx.lineTo(x, snap.floorY);
  }
  ctx.stroke();

  // Extruded Ceiling & Floor Neon Tracks
  // Ceiling slab
  ctx.fillStyle = '#131926';
  ctx.fillRect(0, 0, ARENA_WIDTH, snap.ceilingY - 12);
  ctx.fillStyle = '#20293C';
  ctx.fillRect(0, snap.ceilingY - 12, ARENA_WIDTH, 12);
  ctx.strokeStyle = '#00C2FF';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, snap.ceilingY);
  ctx.lineTo(ARENA_WIDTH, snap.ceilingY);
  ctx.stroke();

  // Floor slab with beveled top lip
  ctx.fillStyle = '#20293C';
  ctx.fillRect(0, snap.floorY, ARENA_WIDTH, 14);
  ctx.fillStyle = '#131926';
  ctx.fillRect(0, snap.floorY + 14, ARENA_WIDTH, ARENA_HEIGHT - snap.floorY - 14);
  ctx.strokeStyle = '#9EE622';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, snap.floorY);
  ctx.lineTo(ARENA_WIDTH, snap.floorY);
  ctx.stroke();

  // 3D Spinning Coins
  const phase = snap.scrollX * 0.025;
  for (const c of snap.coins) {
    drawCoin3D(ctx, c.x, c.y, c.r, phase + c.x * 0.01, '#FFB800');
  }

  // 3D Obstacles (Buzzsaws & Neon Barriers)
  const spin = snap.scrollX * 0.03;
  for (const ob of snap.obstacles) {
    ctx.save();
    if (ob.kind === 'saw') {
      drawShadowOval(ctx, ob.x + 3, ob.y + 6, ob.w * 0.45, ob.w * 0.45, 0.35);
      ctx.translate(ob.x, ob.y);
      ctx.rotate(spin);

      // Saw rim depth
      ctx.fillStyle = '#7F1D1D';
      ctx.beginPath();
      const teeth = 10;
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? ob.w * 0.5 : ob.w * 0.34;
        if (i === 0) ctx.moveTo(Math.cos(a) * r + 2, Math.sin(a) * r + 4);
        else ctx.lineTo(Math.cos(a) * r + 2, Math.sin(a) * r + 4);
      }
      ctx.closePath();
      ctx.fill();

      // Main buzzsaw blade
      ctx.fillStyle = '#FF4D2E';
      ctx.strokeStyle = '#FFF5F2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? ob.w * 0.5 : ob.w * 0.34;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Metallic center hub
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.arc(0, 0, ob.w * 0.14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawExtrudedBox3D(ctx, ob.x, ob.y, ob.w, ob.h, 10, 8, '#7E1D53', '#4A1031', '#FF3B9A');
    }
    ctx.restore();
  }

  // 3D Cube Runners
  for (const p of snap.players) {
    if (!p.alive) continue;
    ctx.save();
    ctx.globalAlpha = p.phaseTimer > 0 ? 0.52 : 1;
    if (p.phaseTimer > 0) {
      ctx.strokeStyle = '#00C2FF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Track shadow on ceiling or floor depending on gravityDir
    drawShadowOval(ctx, p.x, p.gravityDir === 1 ? p.y + 18 : p.y - 18, 16, 6, 0.36);

    ctx.translate(p.x, p.y);
    ctx.scale(1, p.gravityDir);

    // 3D cube side extrusion
    ctx.fillStyle = shadeHex(p.colorHex, -0.45);
    ctx.beginPath();
    ctx.roundRect(-14, -12, 32, 32, 9);
    ctx.fill();

    // Front face
    const cubeGrad = ctx.createLinearGradient(-16, -16, 16, 16);
    cubeGrad.addColorStop(0, shadeHex(p.colorHex, 0.3));
    cubeGrad.addColorStop(1, p.colorHex);
    ctx.fillStyle = cubeGrad;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-16, -16, 32, 32, 9);
    ctx.fill();
    ctx.stroke();

    // Visor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(3, -9, 10, 7);
    ctx.fillStyle = '#E0F2FE';
    ctx.fillRect(8, -8, 4, 3);
    ctx.restore();

    drawNameplate(
      ctx,
      p.x,
      p.y + (p.gravityDir === 1 ? -34 : 36),
      p.slotIndex,
      p.name,
      p.colorHex,
      `${p.score}`
    );
  }

  drawHudPill(ctx, `SPEED ${Math.round(snap.speed)}`, `${Math.ceil(snap.timeLeft)}s`, 'GRAVITY FLIP');
}

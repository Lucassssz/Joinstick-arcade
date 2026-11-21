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

function drawHudPill(ctx: CanvasRenderingContext2D, leftText: string, centerText: string, rightText?: string) {
  ctx.save();
  ctx.fillStyle = 'rgba(13, 15, 20, 0.84)';
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
// 16. FREEZE TAG ARENA
// ============================================================
export function renderFreezeTag(ctx: CanvasRenderingContext2D, snap: FreezeTagSnapshot): void {
  // Frosted rink floor
  ctx.fillStyle = '#0D1722';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  ctx.strokeStyle = 'rgba(0, 194, 255, 0.12)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(24, 24, ARENA_WIDTH - 48, ARENA_HEIGHT - 48, 28);
  ctx.stroke();

  // Rink center circle
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 96, 0, Math.PI * 2);
  ctx.stroke();

  // Ice traps
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

  // Pillars
  for (const p of snap.pillars) {
    ctx.fillStyle = '#1A2D42';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Frost bolts
  for (const b of snap.bolts) {
    ctx.fillStyle = '#7DD3FC';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Players
  for (const p of snap.players) {
    ctx.save();
    if (p.role === 'hunter') {
      ctx.fillStyle = 'rgba(0, 194, 255, 0.18)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = p.colorHex;
    ctx.strokeStyle = p.role === 'hunter' ? '#38BDF8' : '#FFFFFF';
    ctx.lineWidth = p.role === 'hunter' ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ice cube encasing frozen runners!
    if (p.frozen) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(p.x - 26, p.y - 26, 52, 52, 8);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    const tag = p.role === 'hunter' ? 'HUNTER' : p.frozen ? 'THAW ME!' : undefined;
    drawNameplate(ctx, p.x, p.y - 36, p.slotIndex, p.name, p.frozen ? '#38BDF8' : p.colorHex, tag);
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
// 17. GHOST HUNT
// ============================================================
export function renderGhostHunt(ctx: CanvasRenderingContext2D, snap: GhostHuntSnapshot): void {
  // Deep dark mystery floor
  ctx.fillStyle = '#07090E';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Subtle floor grid visible dimly
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= ARENA_WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_HEIGHT);
    ctx.stroke();
  }

  // Flashlight cones from alive hunters
  for (const p of snap.players) {
    if (p.role !== 'hunter' || !p.alive) continue;
    ctx.save();
    const grad = ctx.createRadialGradient(p.x, p.y, 12, p.x, p.y, 330);
    grad.addColorStop(0, 'rgba(255, 226, 120, 0.34)');
    grad.addColorStop(0.7, 'rgba(255, 200, 70, 0.14)');
    grad.addColorStop(1, 'rgba(255, 200, 70, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, 330, p.angle - 0.44, p.angle + 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Maze walls
  for (const w of snap.walls) {
    ctx.fillStyle = '#1B2030';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(w.x, w.y, w.w, w.h, 6);
    ctx.fill();
    ctx.stroke();
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

  // Players
  for (const p of snap.players) {
    if (!p.alive) continue;
    ctx.save();
    if (p.role === 'ghost') {
      ctx.globalAlpha = Math.max(0.06, p.visibility);
      ctx.fillStyle = '#A855F7';
      ctx.strokeStyle = '#F3E8FF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, Math.PI, 0);
      ctx.lineTo(p.x + 20, p.y + 18);
      ctx.lineTo(p.x + 10, p.y + 12);
      ctx.lineTo(p.x, p.y + 18);
      ctx.lineTo(p.x - 10, p.y + 12);
      ctx.lineTo(p.x - 20, p.y + 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x - 6, p.y - 3, 3.2, 0, Math.PI * 2);
      ctx.arc(p.x + 6, p.y - 3, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (p.visibility > 0.32) {
        drawNameplate(ctx, p.x, p.y - 34, p.slotIndex, p.name, '#C084FC', `HP ${p.hp}`);
      }
    } else {
      ctx.fillStyle = p.colorHex;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      drawNameplate(ctx, p.x, p.y - 32, p.slotIndex, p.name, p.colorHex, `HP ${p.hp}`);
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
// 18. METEOR SWARM
// ============================================================
export function renderMeteorSwarm(ctx: CanvasRenderingContext2D, snap: MeteorSwarmSnapshot): void {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;

  ctx.fillStyle = '#090C14';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Crisp starfield
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (let i = 0; i < 65; i++) {
    const sx = (i * 197 + 43) % ARENA_WIDTH;
    const sy = (i * 113 + 71) % ARENA_HEIGHT;
    ctx.fillRect(sx, sy, i % 3 === 0 ? 2.5 : 1.5, i % 3 === 0 ? 2.5 : 1.5);
  }

  // Central Energy Core
  ctx.save();
  ctx.fillStyle = 'rgba(0, 194, 255, 0.16)';
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0F2537';
  ctx.strokeStyle = '#00C2FF';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Core HP ring
  ctx.strokeStyle = snap.coreHp > 5 ? '#10D98B' : '#FF4D2E';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 54, -Math.PI / 2, -Math.PI / 2 + (snap.coreHp / snap.maxCoreHp) * Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 18px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${snap.coreHp}`, cx, cy);
  ctx.restore();

  // Meteors & UFOs
  for (const m of snap.meteors) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);
    if (m.kind === 'ufo') {
      ctx.fillStyle = '#9333EA';
      ctx.strokeStyle = '#F5D0FE';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, m.r, m.r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(0, -4, m.r * 0.38, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = m.hp < m.maxHp ? '#FFB800' : '#94A3B8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const rad = m.r * (i % 2 === 0 ? 1 : 0.78);
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Bullets
  for (const b of snap.bullets) {
    ctx.fillStyle = b.enemy ? '#FF3B9A' : b.colorHex;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.enemy ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.save();
    if (p.downed) {
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, -Math.PI / 2, -Math.PI / 2 + p.reviveProgress * Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = p.downed ? 0.4 : 1;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.colorHex;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-14, -13);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawNameplate(ctx, p.x, p.y - 30, p.slotIndex, p.name, p.colorHex, p.downed ? 'REVIVE!' : `HP ${p.hp}`);
  }

  drawHudPill(ctx, `WAVE ${snap.wave}`, `${Math.ceil(snap.timeLeft)}s`, `TEAM ${snap.teamScore}`);
}

// ============================================================
// 19. HOOK SHOT
// ============================================================
export function renderHookShot(ctx: CanvasRenderingContext2D, snap: HookShotSnapshot): void {
  // Cosmic abyss backdrop
  const bg = ctx.createRadialGradient(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 40, ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 680);
  bg.addColorStop(0, '#1B1330');
  bg.addColorStop(1, '#080A10');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Floating metallic islands
  for (const isl of snap.islands) {
    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.roundRect(isl.x + 6, isl.y + 12, isl.w, isl.h, 16);
    ctx.fill();

    // Island deck
    ctx.fillStyle = '#1E2533';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(isl.x, isl.y, isl.w, isl.h, 16);
    ctx.fill();
    ctx.stroke();

    // Inner bevel trim
    ctx.strokeStyle = 'rgba(255, 184, 0, 0.25)';
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

  // Grapple hook lines
  for (const hk of snap.hooks) {
    ctx.save();
    ctx.strokeStyle = hk.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hk.x1, hk.y1);
    ctx.lineTo(hk.x2, hk.y2);
    ctx.stroke();

    // Claw head
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(hk.x2, hk.y2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Players
  for (const p of snap.players) {
    if (!p.alive && !p.falling) continue;
    const scale = p.falling ? Math.max(0.2, 1 - p.fallProgress * 0.8) : 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = p.falling ? Math.max(0.15, 1 - p.fallProgress) : 1;
    if (p.parryTimer > 0) {
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = p.colorHex;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Aim chevron
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 14, Math.sin(p.angle) * 14, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (!p.falling) {
      drawNameplate(ctx, p.x, p.y - 32, p.slotIndex, p.name, p.colorHex, `${p.kos} KO`);
    }
  }

  drawHudPill(ctx, 'HOOK SHOT', `${Math.ceil(snap.timeLeft)}s`, 'YANK RIVALS OFF!');
}

// ============================================================
// 20. GRAVITY FLIP
// ============================================================
export function renderGravityFlip(ctx: CanvasRenderingContext2D, snap: GravityFlipSnapshot): void {
  ctx.fillStyle = '#0D1017';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Moving background tunnel grid
  const offset = snap.scrollX % 80;
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = -offset; x <= ARENA_WIDTH; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, snap.ceilingY);
    ctx.lineTo(x, snap.floorY);
    ctx.stroke();
  }

  // Ceiling & Floor Neon Tracks
  ctx.fillStyle = '#181E2B';
  ctx.fillRect(0, 0, ARENA_WIDTH, snap.ceilingY);
  ctx.fillRect(0, snap.floorY, ARENA_WIDTH, ARENA_HEIGHT - snap.floorY);

  ctx.strokeStyle = '#00C2FF';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, snap.ceilingY);
  ctx.lineTo(ARENA_WIDTH, snap.ceilingY);
  ctx.stroke();

  ctx.strokeStyle = '#9EE622';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, snap.floorY);
  ctx.lineTo(ARENA_WIDTH, snap.floorY);
  ctx.stroke();

  // Coins
  for (const c of snap.coins) {
    ctx.fillStyle = '#FFB800';
    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Obstacles
  const spin = snap.scrollX * 0.03;
  for (const ob of snap.obstacles) {
    ctx.save();
    if (ob.kind === 'saw') {
      ctx.translate(ob.x, ob.y);
      ctx.rotate(spin);
      ctx.fillStyle = '#FF4D2E';
      ctx.strokeStyle = '#FFF5F2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const teeth = 10;
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? ob.w * 0.5 : ob.w * 0.34;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255, 59, 154, 0.28)';
      ctx.strokeStyle = '#FF3B9A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(ob.x, ob.y, ob.w, ob.h, 8);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Runners
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
    ctx.translate(p.x, p.y);
    ctx.scale(1, p.gravityDir);
    ctx.fillStyle = p.colorHex;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-16, -16, 32, 32, 9);
    ctx.fill();
    ctx.stroke();
    // Visor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(3, -9, 10, 7);
    ctx.restore();

    drawNameplate(
      ctx,
      p.x,
      p.y + (p.gravityDir === 1 ? -32 : 34),
      p.slotIndex,
      p.name,
      p.colorHex,
      `${p.score}`
    );
  }

  drawHudPill(ctx, `SPEED ${Math.round(snap.speed)}`, `${Math.ceil(snap.timeLeft)}s`, 'GRAVITY FLIP');
}

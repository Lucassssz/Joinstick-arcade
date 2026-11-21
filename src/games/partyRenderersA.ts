import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BladeDuelSnapshot,
  type CannonSiegeSnapshot,
  type CrownHeistSnapshot,
  type HyperPongSnapshot,
  type LaserGauntletSnapshot,
  type VaultHeistSnapshot,
} from '../shared/types';
import { drawNameplate, tCanvas } from './renderers';

function drawTopHud(ctx: CanvasRenderingContext2D, leftText: string, centerText: string, rightText?: string) {
  ctx.save();
  ctx.fillStyle = 'rgba(13, 15, 20, 0.82)';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(ARENA_WIDTH / 2 - 210, 12, 420, 34, 10);
  ctx.fill();
  ctx.stroke();

  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#CBD5E1';
  ctx.textAlign = 'left';
  ctx.fillText(tCanvas(leftText), ARENA_WIDTH / 2 - 194, 29);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tCanvas(centerText), ARENA_WIDTH / 2, 29);

  if (rightText) {
    ctx.fillStyle = '#FFB800';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(tCanvas(rightText), ARENA_WIDTH / 2 + 194, 29);
  }
  ctx.restore();
}

function drawBanner(ctx: CanvasRenderingContext2D, text: string, colorHex = '#FFB800') {
  const localized = tCanvas(text);
  ctx.save();
  ctx.font = '800 28px "Bricolage Grotesque", sans-serif';
  const w = Math.max(320, ctx.measureText(localized).width + 56);
  ctx.fillStyle = 'rgba(13, 15, 20, 0.9)';
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(ARENA_WIDTH / 2 - w / 2, 74, w, 52, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(localized, ARENA_WIDTH / 2, 101);
  ctx.restore();
}

// ============================================================
// 10. LASER GAUNTLET
// ============================================================
export function renderLaserGauntlet(ctx: CanvasRenderingContext2D, snap: LaserGauntletSnapshot): void {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;

  ctx.fillStyle = snap.slowMoTimer > 0 ? '#0D1724' : '#0E1117';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Arena grid
  ctx.strokeStyle = snap.slowMoTimer > 0 ? 'rgba(0, 194, 255, 0.09)' : 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= ARENA_WIDTH; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= ARENA_HEIGHT; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA_WIDTH, y);
    ctx.stroke();
  }

  // Expanding shockwave rings
  for (const r of snap.rings) {
    ctx.save();
    ctx.strokeStyle = `rgba(255, 77, 46, ${r.alpha * 0.85})`;
    ctx.lineWidth = r.thickness;
    ctx.beginPath();
    ctx.arc(cx, cy, r.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Sweeping laser beams
  for (const b of snap.beams) {
    const ex = cx + Math.cos(b.angle) * 900;
    const ey = cy + Math.sin(b.angle) * 900;
    ctx.save();
    if (b.state === 'warn') {
      ctx.strokeStyle = `rgba(255, 184, 0, ${0.28 + b.progress * 0.55})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255, 77, 46, 0.35)';
      ctx.lineWidth = b.width * 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.strokeStyle = '#FF4D2E';
      ctx.lineWidth = b.width * 0.85;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.strokeStyle = '#FFF5F2';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Golden shards
  for (const sh of snap.shards) {
    const sc = 1 + Math.sin(sh.pulse) * 0.14;
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.scale(sc, sc);
    ctx.fillStyle = sh.value >= 25 ? '#FFB800' : '#FDE047';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const s = sh.value >= 25 ? 14 : 10;
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.78, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.78, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Homing orbs
  for (const o of snap.orbs) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 59, 154, 0.25)';
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r + 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FF3B9A';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Rotating Boss Core
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(snap.coreAngle);
  ctx.fillStyle = '#1E2430';
  ctx.strokeStyle = snap.slowMoTimer > 0 ? '#00C2FF' : '#FF4D2E';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rad = i % 2 === 0 ? 56 : 44;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = snap.slowMoTimer > 0 ? '#00C2FF' : '#FF4D2E';
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Players
  for (const p of snap.players) {
    if (!p.alive) continue;
    ctx.save();
    ctx.globalAlpha = p.invulnTimer > 0 ? 0.55 + Math.sin(Date.now() * 0.03) * 0.3 : 1;
    if (p.blinkTimer > 0) {
      ctx.strokeStyle = '#00C2FF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.colorHex;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-14, -14);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawNameplate(ctx, p.x, p.y - 30, p.slotIndex, p.name, p.colorHex, `HP ${p.hp} · ${p.combo}x`);
  }

  drawTopHud(
    ctx,
    `WAVE ${snap.wave}`,
    `${Math.ceil(snap.timeLeft)}s`,
    snap.slowMoTimer > 0 ? 'EMP SLOW-MO' : `${snap.players[0]?.score ?? 0} PTS`
  );
}

// ============================================================
// 11. VAULT HEIST
// ============================================================
export function renderVaultHeist(ctx: CanvasRenderingContext2D, snap: VaultHeistSnapshot): void {
  ctx.fillStyle = '#10141C';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Subtle floor plating
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= ARENA_WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= ARENA_HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA_WIDTH, y);
    ctx.stroke();
  }

  // Extraction portal in center
  ctx.save();
  ctx.fillStyle = 'rgba(16, 217, 139, 0.14)';
  ctx.strokeStyle = '#10D98B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(snap.portal.x, snap.portal.y, snap.portal.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#A7F3D0';
  ctx.font = '800 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tCanvas('BANK'), snap.portal.x, snap.portal.y);
  ctx.restore();

  // Spike pads
  for (const s of snap.spikes) {
    ctx.save();
    ctx.fillStyle =
      s.disabledTimer > 0
        ? 'rgba(0, 194, 255, 0.14)'
        : s.state === 'active'
          ? 'rgba(255, 77, 46, 0.32)'
          : s.state === 'warn'
            ? 'rgba(255, 184, 0, 0.25)'
            : '#1B212D';
    ctx.strokeStyle =
      s.disabledTimer > 0
        ? '#00C2FF'
        : s.state === 'active'
          ? '#FF4D2E'
          : s.state === 'warn'
            ? '#FFB800'
            : '#2F384A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, s.w, s.h, 8);
    ctx.fill();
    ctx.stroke();

    // Draw spikes dots
    for (let rx = 14; rx < s.w - 8; rx += 20) {
      for (let ry = 14; ry < s.h - 8; ry += 20) {
        ctx.fillStyle = s.state === 'active' ? '#FF4D2E' : s.state === 'warn' ? '#FFB800' : '#475569';
        ctx.beginPath();
        ctx.arc(s.x + rx, s.y + ry, s.state === 'active' ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Lasers
  for (const l of snap.lasers) {
    ctx.save();
    if (l.disabledTimer > 0) {
      ctx.strokeStyle = 'rgba(0, 194, 255, 0.35)';
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
    } else if (l.state === 'warn') {
      ctx.strokeStyle = 'rgba(255, 184, 0, 0.75)';
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3;
    } else if (l.state === 'active') {
      ctx.strokeStyle = '#FF4D2E';
      ctx.lineWidth = 7;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
    }
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    ctx.restore();
  }

  // Walls
  for (const w of snap.walls) {
    ctx.fillStyle = '#252D3D';
    ctx.strokeStyle = '#3B465E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(w.x, w.y, w.w, w.h, 6);
    ctx.fill();
    ctx.stroke();
  }

  // Hack waves
  for (const w of snap.hackWaves) {
    ctx.save();
    ctx.strokeStyle = `rgba(0, 194, 255, ${w.alpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Relics
  for (const r of snap.relics) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.fillStyle = '#10D98B';
    ctx.strokeStyle = '#ECFDF5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 14);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Patrol drones
  for (const d of snap.drones) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.fillStyle = d.disabledTimer > 0 ? '#00C2FF' : '#FF4D2E';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, d.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Players
  for (const p of snap.players) {
    ctx.save();
    ctx.globalAlpha = p.invulnTimer > 0 ? 0.65 : 1;
    ctx.fillStyle = p.colorHex;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Carrying gem badge dots orbiting player
    for (let c = 0; c < Math.min(5, p.carrying); c++) {
      const a = (c / Math.min(5, p.carrying)) * Math.PI * 2 + Date.now() * 0.004;
      ctx.fillStyle = '#10D98B';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    drawNameplate(ctx, p.x, p.y - 32, p.slotIndex, p.name, p.colorHex, `Bag ${p.carrying}`);
  }

  drawTopHud(ctx, 'VAULT HEIST', `${Math.ceil(snap.timeLeft)}s`, 'BRING GEMS TO CENTER');
}

// ============================================================
// 12. HYPER PONG
// ============================================================
export function renderHyperPong(ctx: CanvasRenderingContext2D, snap: HyperPongSnapshot): void {
  ctx.fillStyle = '#0D1017';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Court surface
  ctx.fillStyle = '#141925';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(54, 54, ARENA_WIDTH - 108, ARENA_HEIGHT - 108, 22);
  ctx.fill();
  ctx.stroke();

  // Center line & circle
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ARENA_WIDTH / 2, 54);
  ctx.lineTo(ARENA_WIDTH / 2, ARENA_HEIGHT - 54);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 84, 0, Math.PI * 2);
  ctx.stroke();

  // Left & Right goal mouths
  const goalH = 256;
  ctx.fillStyle = 'rgba(255, 77, 46, 0.25)';
  ctx.fillRect(36, ARENA_HEIGHT / 2 - goalH / 2, 20, goalH);
  ctx.fillStyle = 'rgba(0, 194, 255, 0.25)';
  ctx.fillRect(ARENA_WIDTH - 56, ARENA_HEIGHT / 2 - goalH / 2, 20, goalH);

  // Bumpers
  for (const b of snap.bumpers) {
    ctx.fillStyle = b.flash > 0 ? '#FFB800' : '#263044';
    ctx.strokeStyle = b.flash > 0 ? '#FFFFFF' : '#528BFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Puck trail
  snap.puck.trail.forEach((pt, idx) => {
    const a = (idx / Math.max(1, snap.puck.trail.length)) * 0.45;
    ctx.fillStyle = snap.puck.hot ? `rgba(255, 77, 46, ${a})` : `rgba(255, 184, 0, ${a})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, snap.puck.radius * (0.45 + idx * 0.05), 0, Math.PI * 2);
    ctx.fill();
  });

  // Puck
  ctx.fillStyle = snap.puck.hot ? '#FF4D2E' : '#FFB800';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(snap.puck.x, snap.puck.y, snap.puck.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Paddles
  for (const p of snap.players) {
    ctx.save();
    if (p.magnetTimer > 0) {
      ctx.strokeStyle = 'rgba(0, 194, 255, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 24, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.smashTimer > 0) {
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = p.colorHex;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawNameplate(ctx, p.x, p.y - p.radius - 18, p.slotIndex, p.name, p.colorHex);
  }

  drawTopHud(ctx, `FIRST TO ${snap.targetScore}`, `${snap.scoreLeft}  –  ${snap.scoreRight}`, 'HYPER PONG');
  if (snap.goalBanner) drawBanner(ctx, snap.goalBanner, snap.goalBannerColor ?? '#FFB800');
}

// ============================================================
// 13. BLADE DUEL
// ============================================================
export function renderBladeDuel(ctx: CanvasRenderingContext2D, snap: BladeDuelSnapshot): void {
  // Warm dark dojo tatami surface
  ctx.fillStyle = '#141214';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  ctx.fillStyle = '#1C191B';
  ctx.strokeStyle = '#4B3A2E';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(70, 70, ARENA_WIDTH - 140, ARENA_HEIGHT - 140, 18);
  ctx.fill();
  ctx.stroke();

  // Center dojo crest circle
  ctx.strokeStyle = 'rgba(255, 184, 0, 0.16)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 110, 0, Math.PI * 2);
  ctx.stroke();

  // Pillars
  for (const pil of snap.pillars) {
    ctx.fillStyle = '#2A2322';
    ctx.strokeStyle = '#6B5342';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pil.x, pil.y, pil.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Slash arcs
  for (const s of snap.slashes) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.strokeStyle = s.colorHex;
    ctx.globalAlpha = s.alpha;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(18, 0, 52, -0.9, 0.9);
    ctx.stroke();
    ctx.restore();
  }

  // Parry sparks
  for (const sp of snap.sparks) {
    ctx.save();
    ctx.strokeStyle = sp.colorHex;
    ctx.globalAlpha = sp.alpha;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Duelists
  for (const p of snap.players) {
    if (!p.alive) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.parryTimer > 0) {
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.stunTimer > 0) {
      ctx.strokeStyle = '#FF4D2E';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.rotate(p.angle);
    // Katana blade
    ctx.strokeStyle = p.slashTimer > 0 ? '#FFFFFF' : '#E2E8F0';
    ctx.lineWidth = p.slashTimer > 0 ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(8, 12);
    ctx.lineTo(p.slashTimer > 0 ? 56 : 38, p.slashTimer > 0 ? -8 : 12);
    ctx.stroke();

    // Samurai body
    ctx.fillStyle = p.colorHex;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawNameplate(
      ctx,
      p.x,
      p.y - 36,
      p.slotIndex,
      p.name,
      p.colorHex,
      p.stunTimer > 0 ? 'STUNNED!' : `${p.roundsWon}/${snap.targetWins}`
    );
  }

  drawTopHud(ctx, `ROUND ${snap.round}`, `${Math.ceil(snap.roundTimer)}s`, `FIRST TO ${snap.targetWins}`);
  if (snap.roundBanner) drawBanner(ctx, snap.roundBanner, '#FFB800');
}

// ============================================================
// 14. CANNON SIEGE
// ============================================================
export function renderCannonSiege(ctx: CanvasRenderingContext2D, snap: CannonSiegeSnapshot): void {
  ctx.fillStyle = '#11141C';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Canyon chasm down the middle
  const grad = ctx.createLinearGradient(ARENA_WIDTH / 2 - 110, 0, ARENA_WIDTH / 2 + 110, 0);
  grad.addColorStop(0, '#171D2A');
  grad.addColorStop(0.5, '#090B10');
  grad.addColorStop(1, '#171D2A');
  ctx.fillStyle = grad;
  ctx.fillRect(ARENA_WIDTH / 2 - 110, 40, 220, ARENA_HEIGHT - 80);

  // Canyon edges
  ctx.strokeStyle = 'rgba(255, 122, 26, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, ARENA_WIDTH - 80, ARENA_HEIGHT - 80);

  // Destructible fortress bricks
  for (const b of snap.blocks) {
    ctx.fillStyle = b.hp >= 2 ? '#8B4513' : '#5C2D0C';
    ctx.strokeStyle = b.hp >= 2 ? '#D97706' : '#92400E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 4);
    ctx.fill();
    ctx.stroke();
  }

  // Power Cores
  for (const c of snap.cores) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = c.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // HP arc
    ctx.strokeStyle = '#10D98B';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r + 9, -Math.PI / 2, -Math.PI / 2 + (c.hp / c.maxHp) * Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${c.hp}`, c.x, c.y);
    ctx.restore();
  }

  // Turrets
  for (const p of snap.players) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.shieldTimer > 0) {
      ctx.strokeStyle = '#00C2FF';
      ctx.lineWidth = 6;
      const startA = p.side === 'left' ? -1.1 : Math.PI - 1.1;
      ctx.beginPath();
      ctx.arc(0, 0, 56, startA, startA + 2.2);
      ctx.stroke();
    }
    ctx.rotate(p.aimAngle);
    // Barrel + dotted aim preview
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(135, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(0, -8, 34, 16);
    ctx.fillStyle = p.colorHex;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawNameplate(ctx, p.x, p.y - 36, p.slotIndex, p.name, p.colorHex);
  }

  // Shells & explosions
  for (const s of snap.shells) {
    ctx.fillStyle = s.colorHex;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  for (const ex of snap.explosions) {
    ctx.save();
    ctx.strokeStyle = ex.colorHex;
    ctx.globalAlpha = ex.alpha;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawTopHud(
    ctx,
    `LEFT CORE ${snap.cores[0]?.hp ?? 0}`,
    `${Math.ceil(snap.timeLeft)}s`,
    `RIGHT CORE ${snap.cores[1]?.hp ?? 0}`
  );
}

// ============================================================
// 15. CROWN HEIST
// ============================================================
export function renderCrownHeist(ctx: CanvasRenderingContext2D, snap: CrownHeistSnapshot): void {
  ctx.fillStyle = '#10131A';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Subtle checkered party tiles
  for (let x = 40; x < ARENA_WIDTH - 40; x += 64) {
    for (let y = 40; y < ARENA_HEIGHT - 40; y += 64) {
      if (((x / 64 + y / 64) | 0) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fillRect(x, y, 64, 64);
      }
    }
  }

  // Obstacles
  for (const o of snap.obstacles) {
    ctx.fillStyle = '#222836';
    ctx.strokeStyle = '#3C465C';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Shockwaves
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

  // Draw Crown on ground if unheld
  const drawCrownIcon = (x: number, y: number, scale = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#FFB800';
    ctx.strokeStyle = '#FFFBEB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, 8);
    ctx.lineTo(-16, -8);
    ctx.lineTo(-6, -1);
    ctx.lineTo(0, -13);
    ctx.lineTo(6, -1);
    ctx.lineTo(16, -8);
    ctx.lineTo(14, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  if (!snap.crownHolderId) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 184, 0, 0.18)';
    ctx.beginPath();
    ctx.arc(snap.crownX, snap.crownY, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawCrownIcon(snap.crownX, snap.crownY, 1.25);
  }

  // Players
  for (const p of snap.players) {
    ctx.save();
    if (p.hasCrown) {
      ctx.fillStyle = 'rgba(255, 184, 0, 0.22)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 38, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = p.colorHex;
    ctx.strokeStyle = p.hasCrown ? '#FFB800' : '#FFFFFF';
    ctx.lineWidth = p.hasCrown ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (p.hasCrown) drawCrownIcon(p.x, p.y - 22, 0.9);
    drawNameplate(ctx, p.x, p.y - (p.hasCrown ? 44 : 32), p.slotIndex, p.name, p.colorHex, `${p.score}`);
  }

  const leader = [...snap.players].sort((a, b) => b.score - a.score)[0];
  drawTopHud(ctx, 'CROWN HEIST', `${Math.ceil(snap.timeLeft)}s`, leader ? `LEAD: ${leader.name}` : '');
}

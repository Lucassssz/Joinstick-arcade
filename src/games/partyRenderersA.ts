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
import {
  drawArenaSlab,
  drawCharacterPod3D,
  drawCrown3D,
  drawExtrudedBox3D,
  drawExtrudedCylinder3D,
  drawShadowOval,
  drawSphere3D,
  drawSpinningGem3D,
  drawStudioBackdrop,
  shadeHex,
} from './render25d';

function drawTopHud(ctx: CanvasRenderingContext2D, leftText: string, centerText: string, rightText?: string) {
  ctx.save();
  ctx.fillStyle = 'rgba(13, 15, 20, 0.84)';
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
// 10. LASER GAUNTLET (2.5D Reactor Deck & 3D Boss Core)
// ============================================================
export function renderLaserGauntlet(ctx: CanvasRenderingContext2D, snap: LaserGauntletSnapshot): void {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;

  drawStudioBackdrop(
    ctx,
    snap.slowMoTimer > 0 ? '#09121E' : '#0A0D13',
    snap.slowMoTimer > 0 ? 'rgba(0, 194, 255, 0.14)' : 'rgba(255, 77, 46, 0.09)',
    snap.slowMoTimer > 0 ? 'rgba(0, 194, 255, 0.07)' : 'rgba(255, 255, 255, 0.035)',
    48
  );

  // Raised cyber-reactor deck
  drawArenaSlab(
    ctx,
    24,
    22,
    ARENA_WIDTH - 48,
    ARENA_HEIGHT - 46,
    18,
    14,
    snap.slowMoTimer > 0 ? '#0F1B2B' : '#121620',
    '#1A2130',
    snap.slowMoTimer > 0 ? '#00C2FF' : '#334155',
    3
  );

  // Reactor floor grid
  ctx.strokeStyle = snap.slowMoTimer > 0 ? 'rgba(0, 194, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 48; x < ARENA_WIDTH - 48; x += 48) {
    ctx.moveTo(x, 26);
    ctx.lineTo(x, ARENA_HEIGHT - 28);
  }
  for (let y = 48; y < ARENA_HEIGHT - 28; y += 48) {
    ctx.moveTo(28, y);
    ctx.lineTo(ARENA_WIDTH - 28, y);
  }
  ctx.stroke();

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

  // Sweeping laser beams (lifted slightly to core emitter height)
  for (const b of snap.beams) {
    const ex = cx + Math.cos(b.angle) * 900;
    const ey = cy - 10 + Math.sin(b.angle) * 900;
    ctx.save();
    if (b.state === 'warn') {
      ctx.strokeStyle = `rgba(255, 184, 0, ${0.28 + b.progress * 0.55})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255, 77, 46, 0.35)';
      ctx.lineWidth = b.width * 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.strokeStyle = '#FF4D2E';
      ctx.lineWidth = b.width * 0.85;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.strokeStyle = '#FFF5F2';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Golden 3D spinning shards
  const now = Date.now() * 0.004;
  for (const sh of snap.shards) {
    drawSpinningGem3D(
      ctx,
      sh.x,
      sh.y,
      sh.value >= 25 ? 15 : 11,
      sh.value >= 25 ? '#FFB800' : '#FDE047',
      now + sh.pulse,
      6
    );
  }

  // Homing 3D orbs
  for (const o of snap.orbs) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 59, 154, 0.2)';
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawSphere3D(ctx, o.x, o.y, o.r, '#FF3B9A', '#FFFFFF', 7, true);
  }

  // 2.5D Extruded Rotating Boss Core Tower
  const coreAccent = snap.slowMoTimer > 0 ? '#00C2FF' : '#FF4D2E';
  drawShadowOval(ctx, cx + 3, cy + 16, 62, 46, 0.55);

  const traceOctagon = (oy: number) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = snap.coreAngle + (i / 8) * Math.PI * 2;
      const rad = i % 2 === 0 ? 56 : 44;
      const px = cx + Math.cos(a) * rad;
      const py = cy + oy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  // Lower extruded tower base
  traceOctagon(4);
  ctx.fillStyle = '#121620';
  ctx.fill();
  ctx.strokeStyle = shadeHex(coreAccent, -0.5);
  ctx.lineWidth = 3;
  ctx.stroke();

  // Top rotating octagon turret plate
  traceOctagon(-10);
  ctx.fillStyle = '#242C3D';
  ctx.fill();
  ctx.strokeStyle = coreAccent;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Central glowing 3D emitter dome
  drawSphere3D(ctx, cx, cy, 22, coreAccent, '#FFFFFF', 12, false);

  // 2.5D Jet Fighters (Y-sorted)
  const jets = [...snap.players].filter((p) => p.alive).sort((a, b) => a.y - b.y);
  for (const p of jets) {
    drawShadowOval(ctx, p.x + 2, p.y + 12, 18, 10, 0.42);
    ctx.save();
    ctx.globalAlpha = p.invulnTimer > 0 ? 0.55 + Math.sin(Date.now() * 0.03) * 0.3 : 1;
    if (p.blinkTimer > 0) {
      ctx.strokeStyle = '#00C2FF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 4, 26, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Extruded underside wing shadow
    ctx.save();
    ctx.translate(p.x, p.y + 1);
    ctx.rotate(p.angle);
    ctx.fillStyle = shadeHex(p.colorHex, -0.55);
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-14, -14);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.translate(p.x, p.y - 5);
    ctx.rotate(p.angle);
    const jetGrad = ctx.createLinearGradient(-14, -14, 20, 14);
    jetGrad.addColorStop(0, shadeHex(p.colorHex, 0.35));
    jetGrad.addColorStop(1, p.colorHex);
    ctx.fillStyle = jetGrad;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-14, -14);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Canopy
    ctx.fillStyle = '#E0F2FE';
    ctx.beginPath();
    ctx.ellipse(4, 0, 5.5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawNameplate(ctx, p.x, p.y - 36, p.slotIndex, p.name, p.colorHex, `HP ${p.hp} · ${p.combo}x`);
  }

  drawTopHud(
    ctx,
    `WAVE ${snap.wave}`,
    `${Math.ceil(snap.timeLeft)}s`,
    snap.slowMoTimer > 0 ? 'EMP SLOW-MO' : `${snap.players[0]?.score ?? 0} PTS`
  );
}

// ============================================================
// 11. VAULT HEIST (2.5D Security Vault)
// ============================================================
export function renderVaultHeist(ctx: CanvasRenderingContext2D, snap: VaultHeistSnapshot): void {
  drawStudioBackdrop(ctx, '#0A0D14', 'rgba(16, 217, 139, 0.07)', 'rgba(255,255,255,0.025)', 60);

  // Raised vault platform slab
  drawArenaSlab(ctx, 18, 16, ARENA_WIDTH - 36, ARENA_HEIGHT - 34, 16, 14, '#131822', '#1B2230', '#334155', 3);

  // Subtle floor plating
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 60; x < ARENA_WIDTH - 40; x += 60) {
    ctx.moveTo(x, 20);
    ctx.lineTo(x, ARENA_HEIGHT - 22);
  }
  for (let y = 60; y < ARENA_HEIGHT - 40; y += 60) {
    ctx.moveTo(22, y);
    ctx.lineTo(ARENA_WIDTH - 22, y);
  }
  ctx.stroke();

  // Extraction portal pad in center (3D ringed platform)
  drawExtrudedCylinder3D(
    ctx,
    snap.portal.x,
    snap.portal.y,
    snap.portal.r,
    6,
    '#0E2E26',
    '#091E19',
    '#10D98B'
  );
  ctx.save();
  ctx.fillStyle = '#A7F3D0';
  ctx.font = '800 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tCanvas('BANK'), snap.portal.x, snap.portal.y - 6);
  ctx.restore();

  // 2.5D Spike pads
  for (const s of snap.spikes) {
    ctx.save();
    const topCol =
      s.disabledTimer > 0
        ? '#143347'
        : s.state === 'active'
          ? '#4D1A1A'
          : s.state === 'warn'
            ? '#473615'
            : '#1B212D';
    const borderCol =
      s.disabledTimer > 0
        ? '#00C2FF'
        : s.state === 'active'
          ? '#FF4D2E'
          : s.state === 'warn'
            ? '#FFB800'
            : '#2F384A';
    drawExtrudedBox3D(ctx, s.x, s.y, s.w, s.h, 4, 8, topCol, shadeHex(topCol, -0.35), borderCol, false);

    // 3D conical spikes
    for (let rx = 14; rx < s.w - 8; rx += 20) {
      for (let ry = 14; ry < s.h - 8; ry += 20) {
        const sx = s.x + rx;
        const sy = s.y + ry - 4;
        if (s.state === 'active') {
          ctx.fillStyle = '#FF4D2E';
          ctx.beginPath();
          ctx.moveTo(sx - 5, sy + 2);
          ctx.lineTo(sx, sy - 11);
          ctx.lineTo(sx + 5, sy + 2);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#FFE4E6';
          ctx.beginPath();
          ctx.arc(sx, sy - 9, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = s.state === 'warn' ? '#FFB800' : '#475569';
          ctx.beginPath();
          ctx.arc(sx, sy, s.state === 'warn' ? 4 : 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
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
    ctx.moveTo(l.x1, l.y1 - 6);
    ctx.lineTo(l.x2, l.y2 - 6);
    ctx.stroke();
    ctx.restore();
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

  // Y-sort Walls, Relics, Drones, Players
  type VaultItem =
    | { kind: 'wall'; y: number; w: (typeof snap.walls)[number] }
    | { kind: 'relic'; y: number; r: (typeof snap.relics)[number] }
    | { kind: 'drone'; y: number; d: (typeof snap.drones)[number] }
    | { kind: 'player'; y: number; p: (typeof snap.players)[number] };
  const items: VaultItem[] = [
    ...snap.walls.map((w) => ({ kind: 'wall' as const, y: w.y + w.h, w })),
    ...snap.relics.map((r) => ({ kind: 'relic' as const, y: r.y, r })),
    ...snap.drones.map((d) => ({ kind: 'drone' as const, y: d.y, d })),
    ...snap.players.map((p) => ({ kind: 'player' as const, y: p.y + 8, p })),
  ];
  items.sort((a, b) => a.y - b.y);

  const now = Date.now() * 0.004;
  for (const it of items) {
    if (it.kind === 'wall') {
      const { w } = it;
      drawExtrudedBox3D(ctx, w.x, w.y, w.w, w.h, 16, 6, '#2A3346', '#181E2B', '#4B5875');
    } else if (it.kind === 'relic') {
      drawSpinningGem3D(ctx, it.r.x, it.r.y, 13, '#10D98B', now + it.r.x * 0.02, 7);
    } else if (it.kind === 'drone') {
      const { d } = it;
      const bob = Math.sin(now * 1.4 + d.x) * 3;
      drawSphere3D(ctx, d.x, d.y, d.r, d.disabledTimer > 0 ? '#00C2FF' : '#FF4D2E', '#FFFFFF', 10 + bob, true);
    } else {
      const { p } = it;
      drawCharacterPod3D(ctx, p.x, p.y, 17, 0, p.colorHex, {
        height: 10,
        alpha: p.invulnTimer > 0 ? 0.65 : 1,
        showVisor: false,
      });

      // Carrying gem badge dots orbiting player in 3D lift
      for (let c = 0; c < Math.min(5, p.carrying); c++) {
        const a = (c / Math.min(5, p.carrying)) * Math.PI * 2 + Date.now() * 0.004;
        const gx = p.x + Math.cos(a) * 26;
        const gy = p.y - 10 + Math.sin(a) * 18;
        drawSphere3D(ctx, gx, gy, 5.5, '#10D98B', '#ECFDF5', 4, false);
      }

      drawNameplate(ctx, p.x, p.y - 36, p.slotIndex, p.name, p.colorHex, `Bag ${p.carrying}`);
    }
  }

  drawTopHud(ctx, 'VAULT HEIST', `${Math.ceil(snap.timeLeft)}s`, 'BRING GEMS TO CENTER');
}

// ============================================================
// 12. HYPER PONG (2.5D Air-Hockey Arcade Cabinet)
// ============================================================
export function renderHyperPong(ctx: CanvasRenderingContext2D, snap: HyperPongSnapshot): void {
  drawStudioBackdrop(ctx, '#090B10', 'rgba(82, 139, 255, 0.09)', 'rgba(255,255,255,0.025)', 48);

  // Outer 2.5D wooden/titanium air-hockey cabinet slab
  drawArenaSlab(ctx, 42, 42, ARENA_WIDTH - 84, ARENA_HEIGHT - 84, 26, 20, '#263042', '#151B26', '#475569', 3);

  // Recessed inner court surface
  ctx.fillStyle = '#121824';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(54, 54, ARENA_WIDTH - 108, ARENA_HEIGHT - 108, 22);
  ctx.fill();
  ctx.stroke();

  // Subtle air-hockey table perforation dots + center line
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ARENA_WIDTH / 2, 54);
  ctx.lineTo(ARENA_WIDTH / 2, ARENA_HEIGHT - 54);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 84, 0, Math.PI * 2);
  ctx.stroke();

  // Left & Right recessed goal slots
  const goalH = 256;
  ctx.fillStyle = 'rgba(255, 77, 46, 0.3)';
  ctx.fillRect(36, ARENA_HEIGHT / 2 - goalH / 2, 20, goalH);
  ctx.strokeStyle = '#FF4D2E';
  ctx.lineWidth = 3;
  ctx.strokeRect(36, ARENA_HEIGHT / 2 - goalH / 2, 20, goalH);

  ctx.fillStyle = 'rgba(0, 194, 255, 0.3)';
  ctx.fillRect(ARENA_WIDTH - 56, ARENA_HEIGHT / 2 - goalH / 2, 20, goalH);
  ctx.strokeStyle = '#00C2FF';
  ctx.strokeRect(ARENA_WIDTH - 56, ARENA_HEIGHT / 2 - goalH / 2, 20, goalH);

  // Puck trail
  snap.puck.trail.forEach((pt, idx) => {
    const a = (idx / Math.max(1, snap.puck.trail.length)) * 0.42;
    ctx.fillStyle = snap.puck.hot ? `rgba(255, 77, 46, ${a})` : `rgba(255, 184, 0, ${a})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y - 3, snap.puck.radius * (0.45 + idx * 0.05), 0, Math.PI * 2);
    ctx.fill();
  });

  // Y-sort bumpers, puck, and mallet paddles
  type PongItem =
    | { kind: 'bumper'; y: number; b: (typeof snap.bumpers)[number] }
    | { kind: 'puck'; y: number }
    | { kind: 'paddle'; y: number; p: (typeof snap.players)[number] };
  const pongItems: PongItem[] = [
    ...snap.bumpers.map((b) => ({ kind: 'bumper' as const, y: b.y, b })),
    { kind: 'puck' as const, y: snap.puck.y },
    ...snap.players.map((p) => ({ kind: 'paddle' as const, y: p.y, p })),
  ];
  pongItems.sort((a, b) => a.y - b.y);

  for (const it of pongItems) {
    if (it.kind === 'bumper') {
      const { b } = it;
      drawExtrudedCylinder3D(
        ctx,
        b.x,
        b.y,
        b.r,
        14,
        b.flash > 0 ? '#FFB800' : '#2C374E',
        '#171E2C',
        b.flash > 0 ? '#FFFFFF' : '#528BFF',
        b.flash > 0 ? '#FFFFFF' : '#528BFF'
      );
    } else if (it.kind === 'puck') {
      drawExtrudedCylinder3D(
        ctx,
        snap.puck.x,
        snap.puck.y,
        snap.puck.radius,
        6,
        snap.puck.hot ? '#FF4D2E' : '#FFB800',
        snap.puck.hot ? '#9A2210' : '#9C6B00',
        '#FFFFFF'
      );
    } else {
      const { p } = it;
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
      ctx.restore();

      // Thick 3D mallet base + raised center grip handle
      drawExtrudedCylinder3D(ctx, p.x, p.y, p.radius, 9, p.colorHex, shadeHex(p.colorHex, -0.45), '#FFFFFF');
      drawExtrudedCylinder3D(
        ctx,
        p.x,
        p.y - 9,
        p.radius * 0.4,
        11,
        shadeHex(p.colorHex, 0.25),
        shadeHex(p.colorHex, -0.35),
        '#FFFFFF'
      );

      drawNameplate(ctx, p.x, p.y - p.radius - 26, p.slotIndex, p.name, p.colorHex);
    }
  }

  drawTopHud(ctx, `FIRST TO ${snap.targetScore}`, `${snap.scoreLeft}  –  ${snap.scoreRight}`, 'HYPER PONG');
  if (snap.goalBanner) drawBanner(ctx, snap.goalBanner, snap.goalBannerColor ?? '#FFB800');
}

// ============================================================
// 13. BLADE DUEL (2.5D Dojo Tatami Platform)
// ============================================================
export function renderBladeDuel(ctx: CanvasRenderingContext2D, snap: BladeDuelSnapshot): void {
  drawStudioBackdrop(ctx, '#0D0B0D', 'rgba(255, 184, 0, 0.08)', 'rgba(255,255,255,0.02)', 56);

  // Raised wooden dojo tatami platform
  drawArenaSlab(
    ctx,
    70,
    66,
    ARENA_WIDTH - 140,
    ARENA_HEIGHT - 138,
    18,
    18,
    '#221E20',
    '#3B2B22',
    '#7B5F4C',
    5
  );

  // Tatami weave lines & center dojo crest
  ctx.strokeStyle = 'rgba(255, 184, 0, 0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 130; x < ARENA_WIDTH - 100; x += 90) {
    ctx.moveTo(x, 70);
    ctx.lineTo(x, ARENA_HEIGHT - 74);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 184, 0, 0.18)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 110, 0, Math.PI * 2);
  ctx.stroke();

  // Slash arcs
  for (const s of snap.slashes) {
    ctx.save();
    ctx.translate(s.x, s.y - 10);
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
    ctx.arc(sp.x, sp.y - 8, sp.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Y-sort dojo pillars & duelists
  type DojoItem =
    | { kind: 'pillar'; y: number; pil: (typeof snap.pillars)[number] }
    | { kind: 'player'; y: number; p: (typeof snap.players)[number] };
  const items: DojoItem[] = [
    ...snap.pillars.map((pil) => ({ kind: 'pillar' as const, y: pil.y, pil })),
    ...snap.players.filter((p) => p.alive).map((p) => ({ kind: 'player' as const, y: p.y, p })),
  ];
  items.sort((a, b) => a.y - b.y);

  for (const it of items) {
    if (it.kind === 'pillar') {
      const { pil } = it;
      drawExtrudedCylinder3D(ctx, pil.x, pil.y, pil.r, 26, '#3B2E2B', '#211917', '#8C6B54', '#5C4436');
    } else {
      const { p } = it;
      ctx.save();
      if (p.parryTimer > 0) {
        ctx.strokeStyle = '#FFB800';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 8, 34, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (p.stunTimer > 0) {
        ctx.strokeStyle = '#FF4D2E';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 8, 30, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Samurai pod
      drawCharacterPod3D(ctx, p.x, p.y, 19, p.angle, p.colorHex, {
        height: 11,
        rimColor: '#FFFFFF',
      });

      // Gleaming 3D Katana Blade held at waist/shoulder height
      ctx.save();
      ctx.translate(p.x, p.y - 9);
      ctx.rotate(p.angle);
      const bladeEndX = p.slashTimer > 0 ? 58 : 40;
      const bladeEndY = p.slashTimer > 0 ? -8 : 12;
      // Blade shadow
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = p.slashTimer > 0 ? 6 : 4;
      ctx.beginPath();
      ctx.moveTo(8, 16);
      ctx.lineTo(bladeEndX, bladeEndY + 4);
      ctx.stroke();
      // Steel edge
      ctx.strokeStyle = p.slashTimer > 0 ? '#FFFFFF' : '#E2E8F0';
      ctx.lineWidth = p.slashTimer > 0 ? 5 : 3.2;
      ctx.beginPath();
      ctx.moveTo(8, 12);
      ctx.lineTo(bladeEndX, bladeEndY);
      ctx.stroke();
      // Gold tsuba guard
      ctx.fillStyle = '#FFB800';
      ctx.beginPath();
      ctx.arc(11, 12, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawNameplate(
        ctx,
        p.x,
        p.y - 40,
        p.slotIndex,
        p.name,
        p.colorHex,
        p.stunTimer > 0 ? 'STUNNED!' : `${p.roundsWon}/${snap.targetWins}`
      );
    }
  }

  drawTopHud(ctx, `ROUND ${snap.round}`, `${Math.ceil(snap.roundTimer)}s`, `FIRST TO ${snap.targetWins}`);
  if (snap.roundBanner) drawBanner(ctx, snap.roundBanner, '#FFB800');
}

// ============================================================
// 14. CANNON SIEGE (2.5D Cliffside Fortresses over Canyon)
// ============================================================
export function renderCannonSiege(ctx: CanvasRenderingContext2D, snap: CannonSiegeSnapshot): void {
  drawStudioBackdrop(ctx, '#080A10', 'rgba(255, 122, 26, 0.06)', 'rgba(255,255,255,0.02)', 56);

  // Left & Right elevated cliffside fortress decks separated by canyon chasm
  const canyonLeft = ARENA_WIDTH / 2 - 110;
  const canyonRight = ARENA_WIDTH / 2 + 110;
  drawArenaSlab(ctx, 40, 40, canyonLeft - 40, ARENA_HEIGHT - 80, 14, 24, '#181F2D', '#27201C', '#64748B', 3);
  drawArenaSlab(
    ctx,
    canyonRight,
    40,
    ARENA_WIDTH - 40 - canyonRight,
    ARENA_HEIGHT - 80,
    14,
    24,
    '#181F2D',
    '#27201C',
    '#64748B',
    3
  );

  // Canyon bridges / depth lines
  ctx.strokeStyle = 'rgba(255, 122, 26, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, ARENA_WIDTH - 80, ARENA_HEIGHT - 80);

  // Y-sort destructible fortress bricks, power cores, and cannons
  type SiegeItem =
    | { kind: 'block'; y: number; b: (typeof snap.blocks)[number] }
    | { kind: 'core'; y: number; c: (typeof snap.cores)[number] }
    | { kind: 'turret'; y: number; p: (typeof snap.players)[number] };
  const siegeItems: SiegeItem[] = [
    ...snap.blocks.map((b) => ({ kind: 'block' as const, y: b.y + b.h, b })),
    ...snap.cores.map((c) => ({ kind: 'core' as const, y: c.y, c })),
    ...snap.players.map((p) => ({ kind: 'turret' as const, y: p.y + 12, p })),
  ];
  siegeItems.sort((a, b) => a.y - b.y);

  for (const it of siegeItems) {
    if (it.kind === 'block') {
      const { b } = it;
      drawExtrudedBox3D(
        ctx,
        b.x,
        b.y,
        b.w,
        b.h,
        14,
        4,
        b.hp >= 2 ? '#9C521B' : '#6B340E',
        b.hp >= 2 ? '#582B0C' : '#3C1B05',
        b.hp >= 2 ? '#F59E0B' : '#B45309'
      );
    } else if (it.kind === 'core') {
      const { c } = it;
      drawExtrudedCylinder3D(ctx, c.x, c.y, c.r, 18, '#1E293B', '#0F172A', c.colorHex);
      drawSphere3D(ctx, c.x, c.y - 18, c.r * 0.56, c.colorHex, '#FFFFFF', 6, false);

      // HP arc
      ctx.save();
      ctx.strokeStyle = '#10D98B';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(c.x, c.y - 18, c.r + 8, -Math.PI / 2, -Math.PI / 2 + (c.hp / c.maxHp) * Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 16px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${c.hp}`, c.x, c.y - 24);
      ctx.restore();
    } else {
      const { p } = it;
      drawShadowOval(ctx, p.x + 2, p.y + 8, 25, 16, 0.45);
      drawExtrudedCylinder3D(ctx, p.x, p.y, 22, 10, p.colorHex, shadeHex(p.colorHex, -0.45), '#FFFFFF');

      ctx.save();
      ctx.translate(p.x, p.y - 10);
      if (p.shieldTimer > 0) {
        ctx.strokeStyle = '#00C2FF';
        ctx.lineWidth = 6;
        const startA = p.side === 'left' ? -1.1 : Math.PI - 1.1;
        ctx.beginPath();
        ctx.arc(0, 0, 56, startA, startA + 2.2);
        ctx.stroke();
      }
      ctx.rotate(p.aimAngle);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(34, 0);
      ctx.lineTo(135, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3D shaded cannon barrel
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, -6, 36, 16);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(0, -8, 36, 14);
      ctx.fillStyle = shadeHex(p.colorHex, 0.25);
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      drawNameplate(ctx, p.x, p.y - 42, p.slotIndex, p.name, p.colorHex);
    }
  }

  // 3D Cannonballs & explosions
  for (const s of snap.shells) {
    drawSphere3D(ctx, s.x, s.y, s.r, s.colorHex, '#FFFFFF', 14, true);
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
// 15. CROWN HEIST (2.5D Royal Ballroom Stage)
// ============================================================
export function renderCrownHeist(ctx: CanvasRenderingContext2D, snap: CrownHeistSnapshot): void {
  drawStudioBackdrop(ctx, '#0A0C12', 'rgba(255, 184, 0, 0.08)', 'rgba(255,255,255,0.02)', 64);

  // Raised royal ballroom floor slab
  drawArenaSlab(ctx, 32, 32, ARENA_WIDTH - 64, ARENA_HEIGHT - 64, 18, 16, '#141924', '#1E2536', '#475569', 3);

  // Subtle checkered party tiles on slab
  for (let x = 40; x < ARENA_WIDTH - 40; x += 64) {
    for (let y = 40; y < ARENA_HEIGHT - 40; y += 64) {
      if (((x / 64 + y / 64) | 0) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fillRect(x, y, 64, 64);
      }
    }
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

  // Y-sort obstacles, unheld crown, and players
  type CrownItem =
    | { kind: 'obs'; y: number; o: (typeof snap.obstacles)[number] }
    | { kind: 'crown'; y: number }
    | { kind: 'player'; y: number; p: (typeof snap.players)[number] };
  const items: CrownItem[] = [
    ...snap.obstacles.map((o) => ({ kind: 'obs' as const, y: o.y, o })),
    ...(snap.crownHolderId ? [] : [{ kind: 'crown' as const, y: snap.crownY }]),
    ...snap.players.map((p) => ({ kind: 'player' as const, y: p.y, p })),
  ];
  items.sort((a, b) => a.y - b.y);

  const bob = Math.sin(Date.now() * 0.005) * 4;
  for (const it of items) {
    if (it.kind === 'obs') {
      const { o } = it;
      drawExtrudedCylinder3D(ctx, o.x, o.y, o.r, 22, '#2B3345', '#181D29', '#52607D', '#1E2432');
    } else if (it.kind === 'crown') {
      drawShadowOval(ctx, snap.crownX, snap.crownY + 12, 22, 11, 0.45);
      ctx.save();
      ctx.fillStyle = 'rgba(255, 184, 0, 0.18)';
      ctx.beginPath();
      ctx.arc(snap.crownX, snap.crownY, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawCrown3D(ctx, snap.crownX, snap.crownY - 8 + bob, 1.35);
    } else {
      const { p } = it;
      if (p.hasCrown) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 184, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      drawCharacterPod3D(ctx, p.x, p.y, 19, 0, p.colorHex, {
        height: 11,
        rimColor: p.hasCrown ? '#FFB800' : '#FFFFFF',
        hat: p.hasCrown ? 'crown' : 'none',
        showVisor: false,
      });

      drawNameplate(
        ctx,
        p.x,
        p.y - (p.hasCrown ? 52 : 36),
        p.slotIndex,
        p.name,
        p.colorHex,
        `${p.score}`
      );
    }
  }

  const leader = [...snap.players].sort((a, b) => b.score - a.score)[0];
  drawTopHud(ctx, 'CROWN HEIST', `${Math.ceil(snap.timeLeft)}s`, leader ? `LEAD: ${leader.name}` : '');
}

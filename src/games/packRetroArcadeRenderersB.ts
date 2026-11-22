import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import type {
  AirHockeyNeoSnapshot,
  BubblePopArcSnapshot,
  ClaySkeetSnapshot,
  CoinDozerSnapshot,
  PinStrikeSnapshot,
  SkeeRollSnapshot,
  StackTowerSnapshot,
  TunnelDigSnapshot,
} from '../shared/packRetroArcadeTypes';
import {
  drawArenaSlab,
  drawBoardBanner,
  drawCharacterPod3D,
  drawExtrudedBox3D,
  drawHudChip,
  drawNameplate,
  drawSphere3D,
  drawStudioBackdrop,
  shadeHex,
  tCanvas,
} from './packRenderHelpers';

// 9. CLAY SKEET (Duck Hunt)
export function renderClaySkeet(ctx: CanvasRenderingContext2D, snap: ClaySkeetSnapshot): void {
  const sky = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
  sky.addColorStop(0, '#0F172A');
  sky.addColorStop(0.65, '#312E81');
  sky.addColorStop(1, '#7C2D12');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Silhouette hills
  ctx.fillStyle = '#090D16';
  ctx.beginPath();
  ctx.moveTo(0, ARENA_HEIGHT);
  ctx.lineTo(0, 560);
  ctx.quadraticCurveTo(300, 490, 600, 550);
  ctx.quadraticCurveTo(920, 610, ARENA_WIDTH, 530);
  ctx.lineTo(ARENA_WIDTH, ARENA_HEIGHT);
  ctx.closePath();
  ctx.fill();

  for (const t of snap.targets) {
    const col = t.kind === 'gold' ? '#FACC15' : t.kind === 'decoy' ? '#EF4444' : '#F97316';
    drawSphere3D(ctx, t.x, t.y, t.r, col, '#FFFFFF');
    if (t.kind === 'decoy') {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 22px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✕', t.x, t.y);
    }
  }

  for (const fl of snap.flashes) {
    ctx.save();
    ctx.globalAlpha = fl.alpha;
    ctx.strokeStyle = fl.colorHex;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(fl.x, fl.y, 44 * (1.2 - fl.alpha), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const p of snap.players) {
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 24, 0, Math.PI * 2);
    ctx.moveTo(p.x - 32, p.y);
    ctx.lineTo(p.x + 32, p.y);
    ctx.moveTo(p.x, p.y - 32);
    ctx.lineTo(p.x, p.y + 32);
    ctx.stroke();
    ctx.restore();
    drawNameplate(ctx, p.x, p.y - 34, `${p.name} · ${p.score}`, p.colorHex);
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F59E0B', 16);
}

// 10. NEO HOCKEY (Air Hockey)
export function renderAirHockeyNeo(ctx: CanvasRenderingContext2D, snap: AirHockeyNeoSnapshot): void {
  drawStudioBackdrop(ctx, '#060F1D', 'rgba(0,194,255,0.16)', 'rgba(255,255,255,0.03)', 48);
  drawArenaSlab(ctx, 64, 72, ARENA_WIDTH - 128, ARENA_HEIGHT - 144, 24, '#0B1D33', '#00C2FF');

  // Center line & circle
  ctx.save();
  ctx.strokeStyle = 'rgba(0,194,255,0.45)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ARENA_WIDTH / 2, 74);
  ctx.lineTo(ARENA_WIDTH / 2, ARENA_HEIGHT - 74);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 86, 0, Math.PI * 2);
  ctx.stroke();
  // Goal mouths
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(56, ARENA_HEIGHT / 2 - 115, 14, 230);
  ctx.fillRect(ARENA_WIDTH - 70, ARENA_HEIGHT / 2 - 115, 14, 230);
  ctx.restore();

  for (const p of snap.players) {
    drawSphere3D(ctx, p.x, p.y, 32, p.colorHex, '#FFFFFF');
    drawNameplate(ctx, p.x, p.y - 42, `${p.name}`, p.colorHex);
  }

  for (const pk of snap.pucks) {
    drawSphere3D(ctx, pk.x, pk.y, pk.r, pk.supercharged ? '#FACC15' : '#FFFFFF', '#00C2FF');
  }

  drawHudChip(ctx, 24, 20, `LEFT ${snap.leftScore} — ${snap.rightScore} RIGHT`, '#00C2FF');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#00C2FF', 16);
}

// 11. SKEE ROLL (Skee-Ball)
export function renderSkeeRoll(ctx: CanvasRenderingContext2D, snap: SkeeRollSnapshot): void {
  drawStudioBackdrop(ctx, '#160E09', 'rgba(249,115,22,0.16)', 'rgba(255,255,255,0.03)', 46);
  // Alley ramp
  drawArenaSlab(ctx, 340, 82, 520, 608, 22, '#451A03', '#F97316');
  drawArenaSlab(ctx, 368, 98, 464, 290, 18, '#1E1B4B', '#FACC15');

  for (const ring of snap.rings) {
    ctx.save();
    ctx.fillStyle = '#090D16';
    ctx.strokeStyle = ring.colorHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ring.colorHex;
    ctx.font = '900 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(ring.points), ring.x, ring.y);
    ctx.restore();
  }

  for (const b of snap.balls) {
    drawSphere3D(ctx, b.x, b.y, 15, b.colorHex, '#FFFFFF');
  }

  for (const p of snap.players) {
    drawSphere3D(ctx, p.aimX, 640, 17, p.colorHex, '#FFFFFF');
    if (p.charging) {
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(p.aimX - 24, 666, 48 * p.charge, 8);
    }
    drawNameplate(ctx, p.aimX, 610, `${p.name} ${p.score}`, p.colorHex);
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F97316', 16);
}

// 12. STACK TOWER (Arcade Stacker)
export function renderStackTower(ctx: CanvasRenderingContext2D, snap: StackTowerSnapshot): void {
  drawStudioBackdrop(ctx, '#091220', 'rgba(56,189,248,0.16)', 'rgba(255,255,255,0.03)', 48);
  const count = Math.max(1, snap.players.length);
  const laneW = Math.min(280, (ARENA_WIDTH - 80) / count);
  const startX = (ARENA_WIDTH - laneW * count) / 2;

  snap.players.forEach((p, idx) => {
    const lx = startX + idx * laneW + 10;
    const lw = laneW - 20;
    drawArenaSlab(ctx, lx, 86, lw, 586, 14, '#0F172A', p.colorHex);

    const bh = 32;
    p.blocks.forEach((bl, bi) => {
      const y = 640 - (bi + 1) * (bh + 3);
      drawExtrudedBox3D(ctx, lx + (bl.x - bl.w / 2) * lw, y, bl.w * lw, bh, 6, bl.colorHex, shadeHex(bl.colorHex, -35), 6);
    });
    const moverY = 640 - (p.blocks.length + 1) * (bh + 3);
    drawExtrudedBox3D(ctx, lx + (p.moverX - p.moverW / 2) * lw, moverY, p.moverW * lw, bh, 6, '#FFFFFF', p.colorHex, 6);
    drawNameplate(ctx, lx + lw / 2, 74, `${p.name} · ${p.score}`, p.colorHex);
  });

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#38BDF8', 16);
}

// 13. TUNNEL DIG (Dig Dug)
const STRATA_COLORS = ['#0F172A', '#92400E', '#78350F', '#7C2D12', '#581C87'];

export function renderTunnelDig(ctx: CanvasRenderingContext2D, snap: TunnelDigSnapshot): void {
  drawStudioBackdrop(ctx, '#0B0F1A', 'rgba(234,179,8,0.14)', 'rgba(255,255,255,0.03)', 48);
  const bw = 1040;
  const bh = 600;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 82;
  const cw = bw / snap.cols;
  const ch = bh / snap.rows;

  ctx.fillStyle = '#090D16';
  ctx.fillRect(ox, oy, bw, bh);

  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      if (snap.dirt[r * snap.cols + c] === 1) {
        const sIdx = Math.min(STRATA_COLORS.length - 1, Math.floor(r / 3) + 1);
        ctx.fillStyle = STRATA_COLORS[sIdx];
        ctx.fillRect(ox + c * cw, oy + r * ch, cw + 0.6, ch + 0.6);
      }
    }
  }

  for (const g of snap.gems) {
    drawSphere3D(ctx, ox + g.x * cw, oy + g.y * ch, 13, g.colorHex, '#FFFFFF');
  }
  for (const b of snap.boulders) {
    drawSphere3D(ctx, ox + b.x * cw, oy + b.y * ch, 22, '#64748B', '#CBD5E1');
  }
  for (const m of snap.monsters) {
    drawSphere3D(ctx, ox + m.x * cw, oy + m.y * ch, 18 + m.inflated * 8, '#EF4444', '#FCA5A5');
  }
  for (const p of snap.players) {
    const px = ox + p.x * cw;
    const py = oy + p.y * ch;
    drawCharacterPod3D(ctx, px, py, 18, p.colorHex, p.angle, 4);
    drawNameplate(ctx, px, py - 28, `${p.name} · ${p.score}`, p.colorHex);
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EAB308', 16);
}

// 14. BUBBLE POP (Puzzle Bobble)
export function renderBubblePopArc(ctx: CanvasRenderingContext2D, snap: BubblePopArcSnapshot): void {
  drawStudioBackdrop(ctx, '#14081B', 'rgba(236,72,153,0.16)', 'rgba(255,255,255,0.03)', 46);
  drawArenaSlab(ctx, 114, 72, ARENA_WIDTH - 228, ARENA_HEIGHT - 96, 18, '#0D1322', '#EC4899');

  for (const b of snap.bubbles) {
    drawSphere3D(ctx, b.x, b.y, 21, b.colorHex, '#FFFFFF');
  }
  for (const s of snap.shots) {
    drawSphere3D(ctx, s.x, s.y, 20, s.colorHex, '#FFFFFF');
  }

  for (const p of snap.players) {
    ctx.save();
    ctx.strokeStyle = p.nextColorHex;
    ctx.lineWidth = 5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(p.x, 630);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 140, 630 + Math.sin(p.aimAngle) * 140);
    ctx.stroke();
    ctx.restore();
    drawSphere3D(ctx, p.x, 632, 22, p.nextColorHex, '#FFFFFF');
    drawNameplate(ctx, p.x, 668, `${p.name} · ${p.score}`, p.colorHex);
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EC4899', 16);
}

// 15. PIN STRIKE (Arcade Bowling)
export function renderPinStrike(ctx: CanvasRenderingContext2D, snap: PinStrikeSnapshot): void {
  drawStudioBackdrop(ctx, '#0A091C', 'rgba(99,102,241,0.18)', 'rgba(255,255,255,0.03)', 46);
  // Bowling lane
  drawArenaSlab(ctx, 355, 76, 490, 616, 18, '#3B2314', '#6366F1');
  ctx.fillStyle = '#090D16';
  ctx.fillRect(340, 76, 20, 616);
  ctx.fillRect(840, 76, 20, 616);

  for (const pin of snap.pins) {
    if (pin.knocked) continue;
    drawSphere3D(ctx, pin.x, pin.y, 16, '#F8FAFC', '#EF4444');
  }
  for (const b of snap.balls) {
    drawSphere3D(ctx, b.x, b.y, 22, b.colorHex, '#FFFFFF');
  }
  for (const p of snap.players) {
    drawSphere3D(ctx, p.laneX, 636, 20, p.colorHex, '#FFFFFF');
    if (p.aimSpin !== 0) {
      ctx.fillStyle = '#FACC15';
      ctx.font = '900 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(tCanvas(p.aimSpin < 0 ? '↺ HOOK' : '↻ HOOK'), p.laneX, 608);
    }
    if (p.charging) {
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(p.laneX - 24, 666, 48 * p.charge, 8);
    }
    drawNameplate(ctx, p.laneX, 586, `${p.name} · ${p.score}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `FRAME ${snap.round}/${snap.maxRounds} · ${Math.ceil(snap.timeLeft)}s`, '#6366F1');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#6366F1', 16);
}

// 16. COIN DOZER (Arcade Coin Pusher)
export function renderCoinDozer(ctx: CanvasRenderingContext2D, snap: CoinDozerSnapshot): void {
  drawStudioBackdrop(ctx, '#161009', 'rgba(245,158,11,0.18)', 'rgba(255,255,255,0.03)', 46);
  // Shelf
  drawArenaSlab(ctx, 200, 120, 800, 504, 20, '#1E293B', '#F59E0B');
  // Jackpot lip line
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(200, 610, 800, 14);
  // Moving pusher bar
  drawExtrudedBox3D(ctx, 208, 128, 784, Math.max(40, snap.pusherY - 128), 12, '#334155', '#0F172A', 10);

  for (const c of snap.coins) {
    const col = c.kind === 'gem' ? '#EC4899' : c.kind === 'mega' ? '#A855F7' : '#FACC15';
    drawSphere3D(ctx, c.x, c.y, c.r, col, '#FEF9C3');
  }

  for (const p of snap.players) {
    drawExtrudedBox3D(ctx, p.x - 22, 86, 44, 26, 6, p.colorHex, shadeHex(p.colorHex, -35), 8);
    drawNameplate(ctx, p.x, 72, `${p.name} · ${p.score}`, p.colorHex);
  }

  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F59E0B', 16);
}

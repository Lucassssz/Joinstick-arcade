import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  FusePassSnapshot,
  GridRunnersSnapshot,
  HexDropSnapshot,
  PaintRushSnapshot,
  PLAYER_PALETTE,
  RicochetTanksSnapshot,
  TurboStrikerSnapshot,
} from '../shared/types';
import { drawNameplate } from './renderers';

function drawHudChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  text: string,
  textColor = '#F8FAFC',
  borderColor = 'rgba(255,255,255,0.12)'
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(18, 20, 25, 0.88)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 40, 10);
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = '700 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + 20);
  ctx.restore();
}

function drawCenterBanner(
  ctx: CanvasRenderingContext2D,
  text: string,
  accentHex = '#FFB800'
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(12, 14, 19, 0.9)';
  ctx.beginPath();
  ctx.roundRect(ARENA_WIDTH / 2 - 250, ARENA_HEIGHT / 2 - 42, 500, 84, 16);
  ctx.fill();
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 28px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
  ctx.restore();
}

function drawHexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ============================================================
// 4. HEX DROP RENDERER
// ============================================================
export function renderHexDrop(ctx: CanvasRenderingContext2D, snap: HexDropSnapshot): void {
  ctx.fillStyle = '#0B0D13';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Subtle deep abyss grid
  ctx.strokeStyle = 'rgba(16, 217, 139, 0.04)';
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

  // Draw tiles (falling tiles first, then solid/cracking on top)
  const orderedTiles = [...snap.tiles].sort((a, b) => {
    const rank = (s: string) => (s === 'falling' ? 0 : s === 'cracking' ? 1 : 2);
    return rank(a.state) - rank(b.state);
  });

  for (const tile of orderedTiles) {
    if (tile.state === 'gone') continue;
    ctx.save();

    let scale = 1;
    let alpha = 1;
    let oy = 0;
    let jitterX = 0;
    let fill = '#222836';
    let stroke = '#364154';

    if (tile.state === 'cracking') {
      jitterX = Math.sin(Date.now() * 0.06 + tile.id) * 2.5 * tile.progress;
      fill = tile.progress > 0.55 ? '#5E2420' : '#4E391B';
      stroke = tile.progress > 0.55 ? '#FF4D2E' : '#FFB800';
    } else if (tile.state === 'falling') {
      scale = Math.max(0.25, 1 - tile.progress * 0.72);
      alpha = Math.max(0, 1 - tile.progress);
      oy = tile.progress * 42;
      fill = '#3B1818';
      stroke = '#FF4D2E';
    }

    ctx.globalAlpha = alpha;
    ctx.translate(tile.x + jitterX, tile.y + oy);
    ctx.scale(scale, scale);

    // 3D beveled underside
    if (tile.state !== 'falling') {
      drawHexPath(ctx, 0, 7, tile.radius - 2);
      ctx.fillStyle = '#0F131C';
      ctx.fill();
    }

    drawHexPath(ctx, 0, 0, tile.radius - 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = tile.state === 'solid' ? 2 : 2.5;
    ctx.stroke();

    // Inner subtle hex inset
    drawHexPath(ctx, 0, 0, tile.radius - 9);
    ctx.strokeStyle =
      tile.state === 'solid' ? 'rgba(16, 217, 139, 0.16)' : 'rgba(255, 184, 0, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Crack lines
    if (tile.state === 'cracking' && tile.progress > 0.2) {
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, -8);
      ctx.lineTo(0, 2);
      ctx.lineTo(14, -6);
      ctx.moveTo(0, 2);
      ctx.lineTo(-4, 15);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Shove shockwaves
  for (const w of snap.shoveWaves) {
    ctx.save();
    ctx.strokeStyle = w.colorHex;
    ctx.globalAlpha = w.alpha * 0.85;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Players (falling first, grounded next, leaping highest)
  const orderedPlayers = [...snap.players].sort((a, b) => {
    const z = (p: typeof a) => (p.falling ? 0 : p.leapTimer > 0 ? 2 : 1);
    return z(a) - z(b);
  });

  for (const p of orderedPlayers) {
    if (!p.alive) continue;
    ctx.save();
    const jumpArc =
      p.leapTimer > 0
        ? Math.sin((1 - p.leapTimer / Math.max(0.01, p.leapDuration)) * Math.PI)
        : 0;
    const scale = p.falling
      ? Math.max(0.25, 1 - p.fallProgress * 0.75)
      : 1 + jumpArc * 0.34;
    const liftY = jumpArc * 22;

    if (p.falling) {
      ctx.globalAlpha = Math.max(0.1, 1 - p.fallProgress * 0.9);
    }

    // Ground shadow
    if (!p.falling) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 8, 17 * (1 - jumpArc * 0.28), 11 * (1 - jumpArc * 0.28), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.translate(p.x, p.y - liftY);
    ctx.scale(scale, scale);
    ctx.rotate(p.angle + (p.falling ? p.fallProgress * 5 : 0));

    // Runner pod
    ctx.fillStyle = '#0D1017';
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    // Visor indicating forward direction
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.roundRect(5, -7, 8, 14, 3);
    ctx.fill();

    ctx.restore();

    if (!p.falling) {
      drawNameplate(ctx, p.x, p.y - liftY - 30, p.slotIndex, p.name, p.colorHex);
    }
  }

  drawHudChip(
    ctx,
    22,
    20,
    220,
    `ROUND ${snap.round}/${snap.totalRounds}  ·  ${Math.ceil(snap.roundTimer)}s`
  );

  if (snap.roundBanner) {
    drawCenterBanner(ctx, snap.roundBanner, '#10D98B');
  }
}

// ============================================================
// 5. FUSE PASS RENDERER
// ============================================================
export function renderFusePass(ctx: CanvasRenderingContext2D, snap: FusePassSnapshot): void {
  ctx.fillStyle = '#11141B';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Industrial workshop floor inside margin
  ctx.fillStyle = '#171B24';
  ctx.beginPath();
  ctx.roundRect(30, 30, ARENA_WIDTH - 60, ARENA_HEIGHT - 60, 18);
  ctx.fill();

  // Floor hazard stripes border
  ctx.strokeStyle = '#FF7A1A';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Subtle floor grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 60; x < ARENA_WIDTH - 40; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 32);
    ctx.lineTo(x, ARENA_HEIGHT - 32);
    ctx.stroke();
  }
  for (let y = 60; y < ARENA_HEIGHT - 40; y += 60) {
    ctx.beginPath();
    ctx.moveTo(32, y);
    ctx.lineTo(ARENA_WIDTH - 32, y);
    ctx.stroke();
  }

  // Steel cover pillars
  for (const pil of snap.pillars) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(pil.x, pil.y + 6, pil.r + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2B3242';
    ctx.beginPath();
    ctx.arc(pil.x, pil.y, pil.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#4B5568';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#191E29';
    ctx.beginPath();
    ctx.arc(pil.x, pil.y, pil.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Explosions
  for (const e of snap.explosions) {
    ctx.save();
    ctx.fillStyle = e.colorHex;
    ctx.globalAlpha = e.alpha * 0.25;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFB800';
    ctx.globalAlpha = e.alpha;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }

  const urgency = snap.bombMaxTime > 0 ? 1 - snap.bombTimer / snap.bombMaxTime : 0;
  const flashFast = Math.sin(Date.now() * (0.012 + urgency * 0.04)) > 0;

  // Players
  for (const p of snap.players) {
    if (!p.alive) continue;
    ctx.save();
    ctx.translate(p.x, p.y);

    // Bomb danger aura
    if (p.hasBomb) {
      ctx.strokeStyle = flashFast ? '#FF4D2E' : '#FFB800';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 32 + urgency * 8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.immuneTimer > 0) {
      ctx.strokeStyle = 'rgba(0, 194, 255, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(0, 5, 21, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(p.angle);

    // Body
    ctx.fillStyle = '#0D1017';
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    // Forward indicator
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(7, -6, 7, 12, 3);
    ctx.fill();

    ctx.restore();

    // Render cartoon ticking bomb hovering right above holder
    if (p.hasBomb) {
      const bx = p.x;
      const by = p.y - 34;
      ctx.save();
      ctx.fillStyle = flashFast ? '#FF4D2E' : '#1E232E';
      ctx.beginPath();
      ctx.arc(bx, by, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Fuse spark
      ctx.fillStyle = '#FFB800';
      ctx.beginPath();
      ctx.arc(bx + 10, by - 11, flashFast ? 5.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(snap.bombTimer.toFixed(1), bx, by + 0.5);
      ctx.restore();
    }

    drawNameplate(
      ctx,
      p.x,
      p.hasBomb ? p.y - 56 : p.y - 34,
      p.slotIndex,
      p.name,
      p.hasBomb ? '#FF4D2E' : p.colorHex,
      p.hasBomb ? 'BOMB' : undefined
    );
  }

  drawHudChip(ctx, 22, 20, 165, `ROUND ${snap.round}/${snap.totalRounds}`);
  if (snap.bombHolderId) {
    const danger = snap.bombTimer <= 3;
    drawHudChip(
      ctx,
      ARENA_WIDTH / 2 - 110,
      20,
      220,
      `FUSE  ${snap.bombTimer.toFixed(1)}s`,
      danger ? '#FF4D2E' : '#FFB800',
      danger ? '#FF4D2E' : '#FFB800'
    );
  }

  if (snap.roundBanner) {
    drawCenterBanner(ctx, snap.roundBanner, '#FF7A1A');
  }
}

// ============================================================
// 6. GRID RUNNERS RENDERER
// ============================================================
export function renderGridRunners(ctx: CanvasRenderingContext2D, snap: GridRunnersSnapshot): void {
  ctx.fillStyle = '#080B12';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Retro neon cyber-grid
  ctx.strokeStyle = 'rgba(0, 194, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 24; x <= ARENA_WIDTH - 24; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, ARENA_HEIGHT - 24);
    ctx.stroke();
  }
  for (let y = 24; y <= ARENA_HEIGHT - 24; y += 40) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(ARENA_WIDTH - 24, y);
    ctx.stroke();
  }

  // Outer energy wall
  ctx.strokeStyle = '#00C2FF';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, ARENA_WIDTH - 48, ARENA_HEIGHT - 48);

  // Glowing light trails
  for (const trail of snap.trails) {
    if (trail.points.length < 2) continue;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawRibbon = (width: number, color: string, alpha: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < trail.points.length; i++) {
        const pt = trail.points[i];
        if (!started || pt.gap) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();
    };

    drawRibbon(14, trail.colorHex, 0.22);
    drawRibbon(7, trail.colorHex, 0.92);
    drawRibbon(2.5, '#FFFFFF', 0.85);
    ctx.restore();
  }

  // Crash bursts
  for (const e of snap.explosions) {
    ctx.save();
    ctx.strokeStyle = e.colorHex;
    ctx.globalAlpha = e.alpha;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Light cycles
  for (const p of snap.players) {
    if (!p.alive) continue;
    const hopArc =
      p.hopTimer > 0
        ? Math.sin((1 - p.hopTimer / Math.max(0.01, p.hopDuration)) * Math.PI)
        : 0;
    const scale = 1 + hopArc * 0.4;

    ctx.save();
    ctx.translate(p.x, p.y - hopArc * 16);
    ctx.scale(scale, scale);
    ctx.rotate(p.angle);

    // Overdrive tail glow
    if (p.overdriveTimer > 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(-14, -5);
      ctx.lineTo(-32, 0);
      ctx.lineTo(-14, 5);
      ctx.closePath();
      ctx.fill();
    }

    // Sleek cycle chassis
    ctx.fillStyle = '#0B0E16';
    ctx.beginPath();
    ctx.roundRect(-16, -9, 32, 18, 7);
    ctx.fill();

    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.roundRect(-13, -7, 27, 14, 6);
    ctx.fill();

    // Canopy stripe
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(1, -3.5, 10, 7, 3);
    ctx.fill();

    ctx.restore();

    drawNameplate(
      ctx,
      p.x,
      p.y - hopArc * 16 - 26,
      p.slotIndex,
      p.name,
      p.colorHex,
      p.hopTimer > 0 ? 'HOP' : undefined
    );
  }

  drawHudChip(
    ctx,
    22,
    20,
    220,
    `ROUND ${snap.round}/${snap.totalRounds}  ·  ${Math.ceil(snap.roundTimer)}s`,
    '#F8FAFC',
    'rgba(0,194,255,0.4)'
  );

  if (snap.roundBanner) {
    drawCenterBanner(ctx, snap.roundBanner, '#00C2FF');
  }
}

// ============================================================
// 7. RICOCHET TANKS RENDERER
// ============================================================
export function renderRicochetTanks(
  ctx: CanvasRenderingContext2D,
  snap: RicochetTanksSnapshot
): void {
  // Matte tactical bunker floor
  ctx.fillStyle = '#151922';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Blueprint tiles
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  for (let x = 20; x <= ARENA_WIDTH - 20; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, ARENA_HEIGHT - 20);
    ctx.stroke();
  }
  for (let y = 20; y <= ARENA_HEIGHT - 20; y += 40) {
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(ARENA_WIDTH - 20, y);
    ctx.stroke();
  }

  // Outer bunker armored frame
  ctx.strokeStyle = '#3B4457';
  ctx.lineWidth = 10;
  ctx.strokeRect(17, 17, ARENA_WIDTH - 34, ARENA_HEIGHT - 34);

  // Bunker walls with 3D top bevel
  for (const w of snap.walls) {
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.roundRect(w.x + 3, w.y + 6, w.w, w.h, 5);
    ctx.fill();

    ctx.fillStyle = '#2E3646';
    ctx.beginPath();
    ctx.roundRect(w.x, w.y, w.w, w.h, 5);
    ctx.fill();

    ctx.strokeStyle = '#53607A';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Proximity mines
  const blink = Math.floor(Date.now() / 220) % 2 === 0;
  for (const m of snap.mines) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = '#1F2430';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = m.colorHex;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = m.armed && blink ? '#FF4D2E' : '#64748B';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Ricochet shells
  for (const sh of snap.shells) {
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.fillStyle = sh.bounces > 0 ? '#FFB800' : sh.colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Tanks
  for (const t of snap.players) {
    if (!t.alive) continue;
    ctx.save();
    ctx.translate(t.x, t.y);

    if (t.shieldTimer > 0) {
      ctx.strokeStyle = '#00C2FF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Tank hull & treads
    ctx.save();
    ctx.rotate(t.hullAngle);

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.roundRect(-18, -15, 36, 34, 5);
    ctx.fill();

    // Treads
    ctx.fillStyle = '#0D1017';
    ctx.fillRect(-18, -18, 36, 7);
    ctx.fillRect(-18, 11, 36, 7);

    // Armored body
    ctx.fillStyle = t.colorHex;
    ctx.beginPath();
    ctx.roundRect(-16, -12, 32, 24, 5);
    ctx.fill();
    ctx.strokeStyle = '#0D1017';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Turret + Barrel
    ctx.save();
    ctx.rotate(t.turretAngle);
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.roundRect(4, -3.5, 22, 7, 2);
    ctx.fill();
    ctx.strokeStyle = '#0D1017';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#1E2430';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = t.colorHex;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // HP pips
    const pipW = 10;
    const totalW = t.maxHp * (pipW + 3) - 3;
    for (let i = 0; i < t.maxHp; i++) {
      ctx.fillStyle = i < t.hp ? t.colorHex : 'rgba(255,255,255,0.16)';
      ctx.fillRect(t.x - totalW / 2 + i * (pipW + 3), t.y + 24, pipW, 4);
    }

    drawNameplate(ctx, t.x, t.y - 32, t.slotIndex, t.name, t.colorHex);
  }

  // Explosions
  for (const e of snap.explosions) {
    ctx.save();
    ctx.strokeStyle = e.colorHex;
    ctx.globalAlpha = e.alpha;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const secs = Math.ceil(snap.timeLeft);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  drawHudChip(
    ctx,
    22,
    20,
    162,
    `TIME  ${mm}:${ss}`,
    snap.timeLeft <= 10 ? '#FF4D2E' : '#F8FAFC'
  );
}

// ============================================================
// 8. TURBO STRIKER RENDERER
// ============================================================
export function renderTurboStriker(
  ctx: CanvasRenderingContext2D,
  snap: TurboStrikerSnapshot
): void {
  const left = 72;
  const right = ARENA_WIDTH - 72;
  const top = 58;
  const bottom = ARENA_HEIGHT - 58;
  const pitchW = right - left;
  const pitchH = bottom - top;
  const goalHalf = 115;
  const goalDepth = 48;
  const cy = ARENA_HEIGHT / 2;

  // Stadium exterior
  ctx.fillStyle = '#0D1118';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Striped turf field
  const stripes = 10;
  const stripeW = pitchW / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#142A24' : '#18322B';
    ctx.fillRect(left + i * stripeW, top, stripeW + 0.5, pitchH);
  }

  // Recessed Goals (Left = Red defends / Blue attacks, Right = Blue defends / Red attacks)
  ctx.fillStyle = 'rgba(255, 77, 46, 0.22)';
  ctx.fillRect(left - goalDepth, cy - goalHalf, goalDepth, goalHalf * 2);
  ctx.strokeStyle = '#FF4D2E';
  ctx.lineWidth = 4;
  ctx.strokeRect(left - goalDepth, cy - goalHalf, goalDepth, goalHalf * 2);

  ctx.fillStyle = 'rgba(0, 194, 255, 0.22)';
  ctx.fillRect(right, cy - goalHalf, goalDepth, goalHalf * 2);
  ctx.strokeStyle = '#00C2FF';
  ctx.lineWidth = 4;
  ctx.strokeRect(right, cy - goalHalf, goalDepth, goalHalf * 2);

  // Pitch chalk markings
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ARENA_WIDTH / 2, top);
  ctx.lineTo(ARENA_WIDTH / 2, bottom);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(ARENA_WIDTH / 2, cy, 85, 0, Math.PI * 2);
  ctx.stroke();

  // Penalty boxes
  ctx.strokeRect(left, cy - 155, 130, 310);
  ctx.strokeRect(right - 130, cy - 155, 130, 310);

  // Pitch perimeter walls (with open goal mouths)
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(left, cy - goalHalf);
  ctx.lineTo(left, top);
  ctx.lineTo(right, top);
  ctx.lineTo(right, cy - goalHalf);
  ctx.moveTo(right, cy + goalHalf);
  ctx.lineTo(right, bottom);
  ctx.lineTo(left, bottom);
  ctx.lineTo(left, cy + goalHalf);
  ctx.stroke();

  // Strikers
  for (const p of snap.players) {
    const teamColor = p.team === 'red' ? '#FF4D2E' : '#00C2FF';
    ctx.save();
    ctx.translate(p.x, p.y);

    // Kick ring FX
    if (p.kickRingTimer > 0) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.globalAlpha = p.kickRingTimer * 3.5;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 26 + (0.24 - p.kickRingTimer) * 160, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(0, 5, 23, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(p.angle);

    // Tackle speed streak
    if (p.tackleTimer > 0) {
      ctx.fillStyle = teamColor;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(-14, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Outer team ring
    ctx.fillStyle = teamColor;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    // Inner player badge color
    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // Striker nose bumper
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(12, -7, 7, 14, 3);
    ctx.fill();

    ctx.restore();

    drawNameplate(
      ctx,
      p.x,
      p.y - 34,
      p.slotIndex,
      p.name,
      teamColor,
      p.team === 'red' ? 'RED' : 'BLUE'
    );
  }

  // Physics Soccer Ball
  const b = snap.ball;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.arc(0, 5, b.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = b.lastTouchColor ?? '#121419';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Classic pentagon soccer core
  ctx.fillStyle = '#1E2430';
  ctx.beginPath();
  ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Top Scoreboard HUD
  const secs = Math.ceil(snap.timeLeft);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  ctx.save();
  ctx.fillStyle = 'rgba(13, 16, 23, 0.92)';
  ctx.beginPath();
  ctx.roundRect(ARENA_WIDTH / 2 - 175, 10, 350, 40, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = '800 16px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#FF4D2E';
  ctx.textAlign = 'right';
  ctx.fillText(`RED ${snap.scoreRed}`, ARENA_WIDTH / 2 - 48, 30);

  ctx.fillStyle = snap.timeLeft <= 10 ? '#FFB800' : '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.fillText(`${mm}:${ss}`, ARENA_WIDTH / 2, 30);

  ctx.fillStyle = '#00C2FF';
  ctx.textAlign = 'left';
  ctx.fillText(`${snap.scoreBlue} BLUE`, ARENA_WIDTH / 2 + 48, 30);
  ctx.restore();

  if (snap.goalBanner) {
    drawCenterBanner(ctx, snap.goalBanner, snap.goalBannerColor ?? '#FFB800');
  }
}

// ============================================================
// 9. PAINT RUSH RENDERER
// ============================================================
export function renderPaintRush(ctx: CanvasRenderingContext2D, snap: PaintRushSnapshot): void {
  const cellW = ARENA_WIDTH / snap.cols;
  const cellH = ARENA_HEIGHT / snap.rows;

  // Map slotIndex -> hex color
  const slotColor = PLAYER_PALETTE.map((c) => c.hex);
  for (const p of snap.players) {
    slotColor[p.slotIndex] = p.colorHex;
  }

  // Draw painted tile grid
  ctx.fillStyle = '#181C25';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  for (let r = 0; r < snap.rows; r++) {
    const y = r * cellH;
    for (let c = 0; c < snap.cols; c++) {
      const owner = snap.grid[r * snap.cols + c];
      const x = c * cellW;
      if (owner >= 0) {
        ctx.fillStyle = slotColor[owner] ?? '#FF3B9A';
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
        // Glossy wet-paint top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(x + 3, y + 3, cellW - 6, 6);
      } else {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#1C212C' : '#171B24';
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      }
    }
  }

  // Splash bomb rings
  for (const s of snap.splashes) {
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.globalAlpha = s.alpha * 0.9;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = s.colorHex;
    ctx.globalAlpha = s.alpha * 0.25;
    ctx.fill();
    ctx.restore();
  }

  // Paint rollers / bots
  for (const p of snap.players) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(0, 5, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(p.angle);

    // Front wide paint roller cylinder
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(12, -19, 10, 38, 4);
    ctx.fill();
    ctx.fillStyle = p.colorHex;
    ctx.fillRect(14, -17, 6, 34);
    ctx.strokeStyle = '#121419';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, -19, 10, 38);

    // Chassis
    ctx.fillStyle = '#121419';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    // Center cap
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    drawNameplate(
      ctx,
      p.x,
      p.y - 34,
      p.slotIndex,
      p.name,
      p.colorHex,
      `${p.percent.toFixed(0)}%`
    );
  }

  // Timer + Live turf dominance bar
  const secs = Math.ceil(snap.timeLeft);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  drawHudChip(
    ctx,
    22,
    20,
    162,
    `TIME  ${mm}:${ss}`,
    snap.timeLeft <= 10 ? '#FF4D2E' : '#F8FAFC'
  );

  // Horizontal territory bar at top center
  const barW = 420;
  const barH = 18;
  const barX = ARENA_WIDTH / 2 - barW / 2;
  const barY = 30;
  ctx.save();
  ctx.fillStyle = 'rgba(13, 16, 23, 0.9)';
  ctx.beginPath();
  ctx.roundRect(barX - 4, barY - 4, barW + 8, barH + 8, 8);
  ctx.fill();

  let cursor = barX;
  const sorted = [...snap.players].sort((a, b) => b.percent - a.percent);
  for (const p of sorted) {
    const segW = (p.percent / 100) * barW;
    if (segW > 0.5) {
      ctx.fillStyle = p.colorHex;
      ctx.fillRect(cursor, barY, segW, barH);
      cursor += segW;
    }
  }
  ctx.restore();
}

import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  AstroBlasterSnapshot,
  BumperBrawlSnapshot,
  GameSnapshot,
  TurboDriftSnapshot,
} from '../shared/types';
import {
  renderFusePass,
  renderGridRunners,
  renderHexDrop,
  renderPaintRush,
  renderRicochetTanks,
  renderTurboStriker,
} from './extraRenderers';

export interface RenderFxState {
  skidMarks: { x: number; y: number; alpha: number; color: string }[];
  shake: number;
}

export function createRenderFxState(): RenderFxState {
  return { skidMarks: [], shake: 0 };
}

export function drawNameplate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  slotIndex: number,
  name: string,
  colorHex: string,
  extra?: string
): void {
  const label = `P${slotIndex + 1} ${name}${extra ? ` · ${extra}` : ''}`;
  ctx.save();
  ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
  const metrics = ctx.measureText(label);
  const w = metrics.width + 14;
  const h = 20;
  const rx = x - w / 2;
  const ry = y - h / 2;

  ctx.fillStyle = 'rgba(13, 15, 20, 0.84)';
  ctx.beginPath();
  ctx.roundRect(rx, ry, w, h, 5);
  ctx.fill();

  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 0.5);
  ctx.restore();
}

// ============================================================
// 1. BUMPER BRAWL RENDERER
// ============================================================
function renderBumperBrawl(ctx: CanvasRenderingContext2D, snap: BumperBrawlSnapshot): void {
  // Deep mechanical workshop drop-off pit
  ctx.fillStyle = '#0D0F14';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Subtle recessed metal grating grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= ARENA_WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= ARENA_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA_WIDTH, y);
    ctx.stroke();
  }

  const { ringCenterX: cx, ringCenterY: cy, ringRadius: r, maxRingRadius: maxR } = snap;

  // Ghost outer maximum boundary
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 184, 0, 0.14)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Drop shadow beneath steel arena platform
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy + 12, r + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Main matte steel arena ring
  const floorGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, r);
  floorGrad.addColorStop(0, '#272C37');
  floorGrad.addColorStop(0.84, '#1C2029');
  floorGrad.addColorStop(1, '#151820');
  ctx.fillStyle = floorGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Inner concentric tactical rings & crosshairs
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.85, cy);
  ctx.lineTo(cx + r * 0.85, cy);
  ctx.moveTo(cx, cy - r * 0.85);
  ctx.lineTo(cx, cy + r * 0.85);
  ctx.stroke();

  // Bold hazard amber rim
  ctx.save();
  ctx.strokeStyle = '#FFB800';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#121419';
  ctx.lineWidth = 8;
  ctx.setLineDash([14, 14]);
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Shockwaves
  for (const sw of snap.shockwaves) {
    ctx.save();
    ctx.strokeStyle = sw.colorHex;
    ctx.globalAlpha = sw.alpha * 0.85;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Spring bumper pylons
  for (const pylon of snap.pylons) {
    ctx.save();
    ctx.fillStyle = '#0B0D12';
    ctx.beginPath();
    ctx.arc(pylon.x, pylon.y + 3, pylon.r + 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#333A48';
    ctx.beginPath();
    ctx.arc(pylon.x, pylon.y, pylon.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#FFB800';
    ctx.beginPath();
    ctx.arc(pylon.x, pylon.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Bumper pods
  for (const p of snap.players) {
    if (!p.alive) continue;
    ctx.save();
    ctx.translate(p.x, p.y);

    // Dash trail glow
    if (p.dashTimer > 0) {
      ctx.save();
      ctx.fillStyle = p.colorHex;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(-Math.cos(p.angle) * 14, -Math.sin(p.angle) * 14, p.radius * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.arc(0, 5, p.radius + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(p.angle);

    // Outer rubber bumper ring
    ctx.fillStyle = '#0F1117';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 2, 0, Math.PI * 2);
    ctx.fill();

    // Colored tactile chassis
    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius - 2, 0, Math.PI * 2);
    ctx.fill();

    // Inner cabin detail
    ctx.fillStyle = 'rgba(15, 17, 23, 0.35)';
    ctx.beginPath();
    ctx.roundRect(-10, -10, 17, 20, 5);
    ctx.fill();

    // Front bumper bar & headlights
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.roundRect(p.radius - 7, -9, 5, 6, 2);
    ctx.roundRect(p.radius - 7, 3, 5, 6, 2);
    ctx.fill();

    ctx.restore();

    drawNameplate(ctx, p.x, p.y - p.radius - 16, p.slotIndex, p.name, p.colorHex);
  }

  // Top-left round counter
  ctx.save();
  ctx.fillStyle = 'rgba(18, 20, 25, 0.85)';
  ctx.beginPath();
  ctx.roundRect(22, 20, 210, 40, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `ROUND ${snap.round}/${snap.totalRounds}  ·  ${Math.ceil(snap.roundTimer)}s`,
    38,
    40
  );
  ctx.restore();

  // Round winner banner
  if (snap.roundBanner) {
    ctx.save();
    ctx.fillStyle = 'rgba(12, 14, 19, 0.88)';
    ctx.beginPath();
    ctx.roundRect(ARENA_WIDTH / 2 - 240, ARENA_HEIGHT / 2 - 42, 480, 84, 16);
    ctx.fill();
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 28px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(snap.roundBanner, ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    ctx.restore();
  }
}

// ============================================================
// 2. ASTRO BLASTER RENDERER
// ============================================================
const STATIC_STARS = Array.from({ length: 85 }, (_, i) => ({
  x: ((i * 197 + 43) % ARENA_WIDTH),
  y: ((i * 131 + 29) % ARENA_HEIGHT),
  r: (i % 3) * 0.6 + 0.8,
  alpha: 0.25 + ((i * 17) % 50) / 100,
}));

function drawPolygonAsteroid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  seed: number
): void {
  const sides = 8;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const jitter = 0.82 + (((seed * (i + 3) * 19) % 30) / 100);
    const px = Math.cos(a) * r * jitter;
    const py = Math.sin(a) * r * jitter;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#252B36';
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Inner facet highlight
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.2, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fill();
  ctx.restore();
}

function renderAstroBlaster(ctx: CanvasRenderingContext2D, snap: AstroBlasterSnapshot): void {
  ctx.fillStyle = '#0B0E14';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Subtle sector grid
  ctx.strokeStyle = 'rgba(0, 194, 255, 0.04)';
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

  // Stars
  for (const s of STATIC_STARS) {
    ctx.fillStyle = `rgba(226, 232, 240, ${s.alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Arena frame border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, ARENA_WIDTH - 20, ARENA_HEIGHT - 20);

  // Pickups
  const pulse = 0.85 + Math.sin(Date.now() / 180) * 0.15;
  for (const pk of snap.pickups) {
    const color =
      pk.kind === 'shield' ? '#00C2FF' : pk.kind === 'rapid' ? '#FFB800' : '#10D98B';
    const label = pk.kind === 'shield' ? 'S' : pk.kind === 'rapid' ? 'R' : '+';
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = '800 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }

  // Asteroids
  for (const ast of snap.asteroids) {
    drawPolygonAsteroid(ctx, ast.x, ast.y, ast.r, ast.seed);
  }

  // Plasma bolts
  for (const b of snap.bullets) {
    ctx.save();
    const angle = Math.atan2(b.vy, b.vx);
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    ctx.fillStyle = b.colorHex;
    ctx.beginPath();
    ctx.roundRect(-10, -3, 18, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(-4, -1.5, 10, 3, 1.5);
    ctx.fill();
    ctx.restore();
  }

  // Ships
  for (const ship of snap.players) {
    if (!ship.alive) continue;
    ctx.save();
    ctx.translate(ship.x, ship.y);

    // Shield halo
    if (ship.shieldTimer > 0 || ship.boostTimer > 0) {
      ctx.strokeStyle = ship.boostTimer > 0 ? '#10D98B' : '#00C2FF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.rotate(ship.angle);

    // Thruster flame
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > 45 || ship.boostTimer > 0) {
      const flameLen = ship.boostTimer > 0 ? 28 : Math.min(18, speed / 18);
      ctx.fillStyle = ship.boostTimer > 0 ? '#10D98B' : '#FFB800';
      ctx.beginPath();
      ctx.moveTo(-14, -5);
      ctx.lineTo(-14 - flameLen, 0);
      ctx.lineTo(-14, 5);
      ctx.closePath();
      ctx.fill();
    }

    // Starfighter hull
    ctx.fillStyle = ship.colorHex;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, -16);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0B0E14';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cockpit glass
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.ellipse(4, 0, 6, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // HP pips under ship
    const pipWidth = 10;
    const totalW = ship.maxHp * (pipWidth + 3) - 3;
    for (let i = 0; i < ship.maxHp; i++) {
      ctx.fillStyle = i < ship.hp ? ship.colorHex : 'rgba(255,255,255,0.16)';
      ctx.fillRect(ship.x - totalW / 2 + i * (pipWidth + 3), ship.y + 24, pipWidth, 4);
    }

    drawNameplate(ctx, ship.x, ship.y - 32, ship.slotIndex, ship.name, ship.colorHex);
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

  // Timer pill-less readout
  ctx.save();
  ctx.fillStyle = 'rgba(18, 20, 25, 0.85)';
  ctx.beginPath();
  ctx.roundRect(22, 20, 172, 40, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = snap.timeLeft <= 10 ? '#FF4D2E' : '#F8FAFC';
  ctx.font = '700 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const secs = Math.ceil(snap.timeLeft);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  ctx.fillText(`TIME  ${mm}:${ss}`, 40, 40);
  ctx.restore();
}

// ============================================================
// 3. TURBO DRIFT RENDERER
// ============================================================
function strokeClosedSpline(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
}

function renderTurboDrift(
  ctx: CanvasRenderingContext2D,
  snap: TurboDriftSnapshot,
  fx: RenderFxState
): void {
  // Deep elevated sky-track drop-off abyss
  ctx.fillStyle = '#0B0E14';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Subtle recessed chasm grid below the elevated track
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.032)';
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

  const pts = snap.trackPoints;
  const roadW = snap.trackHalfWidth * 2;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Elevated track drop shadow cast onto the pit below
  ctx.save();
  ctx.translate(0, 14);
  strokeClosedSpline(ctx, pts);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.lineWidth = roadW + 20;
  ctx.stroke();
  ctx.restore();

  // Outer steel deck rim
  strokeClosedSpline(ctx, pts);
  ctx.strokeStyle = '#313847';
  ctx.lineWidth = roadW + 20;
  ctx.stroke();

  // Red & cream curbs
  strokeClosedSpline(ctx, pts);
  ctx.strokeStyle = '#E53935';
  ctx.lineWidth = roadW + 14;
  ctx.stroke();

  ctx.save();
  strokeClosedSpline(ctx, pts);
  ctx.strokeStyle = '#F5F0E6';
  ctx.lineWidth = roadW + 14;
  ctx.setLineDash([18, 18]);
  ctx.stroke();
  ctx.restore();

  // Dark matte asphalt
  strokeClosedSpline(ctx, pts);
  ctx.strokeStyle = '#1E222B';
  ctx.lineWidth = roadW;
  ctx.stroke();

  // Center dashed lane marker
  ctx.save();
  strokeClosedSpline(ctx, pts);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 18]);
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // Checkered start/finish line at trackPoints[0]
  if (pts.length > 2) {
    const p0 = pts[0];
    const p1 = pts[1];
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(angle);
    const squares = 10;
    const sqSize = (snap.trackHalfWidth * 2) / squares;
    for (let i = 0; i < squares; i++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (i + col) % 2 === 0 ? '#F8FAFC' : '#121419';
        ctx.fillRect(
          -sqSize + col * sqSize,
          -snap.trackHalfWidth + i * sqSize,
          sqSize,
          sqSize
        );
      }
    }
    ctx.restore();
  }

  // Boost chevron pads
  for (const pad of snap.boostPads) {
    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.rotate(pad.angle);
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 4;
    for (let c = -1; c <= 1; c++) {
      const ox = c * 14;
      ctx.beginPath();
      ctx.moveTo(ox - 6, -16);
      ctx.lineTo(ox + 6, 0);
      ctx.lineTo(ox - 6, 16);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Emit & render drift skid marks
  for (const car of snap.players) {
    if (car.drifting) {
      const backX = car.x - Math.cos(car.angle) * 14;
      const backY = car.y - Math.sin(car.angle) * 14;
      fx.skidMarks.push({ x: backX, y: backY, alpha: 0.45, color: '#0B0D12' });
    }
  }
  if (fx.skidMarks.length > 180) {
    fx.skidMarks.splice(0, fx.skidMarks.length - 180);
  }
  for (let i = fx.skidMarks.length - 1; i >= 0; i--) {
    const m = fx.skidMarks[i];
    m.alpha -= 0.004;
    if (m.alpha <= 0) {
      fx.skidMarks.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(10, 12, 16, ${m.alpha})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cars (render falling cars beneath on-track cars with shrink + tumble animation)
  const orderedCars = [...snap.players].sort((a, b) => Number(b.falling) - Number(a.falling));
  for (const car of orderedCars) {
    ctx.save();
    ctx.translate(car.x, car.y);

    if (car.falling) {
      const scale = Math.max(0.28, 1 - car.fallProgress * 0.72);
      ctx.globalAlpha = Math.max(0.15, 1 - car.fallProgress * 0.85);
      ctx.scale(scale, scale);
      ctx.rotate(car.angle + car.fallProgress * Math.PI * 2.4);
    } else {
      if (car.respawnBlink > 0) {
        const blink = Math.floor(Date.now() / 90) % 2 === 0;
        ctx.globalAlpha = blink ? 0.55 : 1;
      }
      ctx.rotate(car.angle);
    }

    // Nitro exhaust flame
    if (car.boosting && !car.falling) {
      ctx.fillStyle = '#FFB800';
      ctx.beginPath();
      ctx.moveTo(-17, -5);
      ctx.lineTo(-36, 0);
      ctx.lineTo(-17, 5);
      ctx.closePath();
      ctx.fill();
    }

    // Shadow (hidden when falling into the drop-off)
    if (!car.falling) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.roundRect(-16, -10, 34, 24, 6);
      ctx.fill();
    }

    // Tires
    ctx.fillStyle = '#0D0F14';
    ctx.fillRect(-13, -12, 8, 4);
    ctx.fillRect(6, -12, 8, 4);
    ctx.fillRect(-13, 8, 8, 4);
    ctx.fillRect(6, 8, 8, 4);

    // Body
    ctx.fillStyle = car.colorHex;
    ctx.beginPath();
    ctx.roundRect(-17, -10, 34, 20, 6);
    ctx.fill();
    ctx.strokeStyle = car.respawnBlink > 0 ? '#FFFFFF' : '#0D0F14';
    ctx.lineWidth = car.respawnBlink > 0 ? 2.5 : 1.5;
    ctx.stroke();

    // Racing stripe & windshield
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-15, -2, 30, 4);
    ctx.fillStyle = '#121419';
    ctx.beginPath();
    ctx.roundRect(1, -7, 8, 14, 2);
    ctx.fill();

    ctx.restore();

    const posStr = car.falling
      ? 'OFF TRACK!'
      : car.position === 1
      ? '1st'
      : car.position === 2
      ? '2nd'
      : car.position === 3
      ? '3rd'
      : `${car.position}th`;
    drawNameplate(
      ctx,
      car.x,
      car.y - 26,
      car.slotIndex,
      car.name,
      car.falling ? '#FF4D2E' : car.colorHex,
      posStr
    );
  }

  // Top-left lap/race time HUD
  const leaderLap = Math.min(
    snap.totalLaps,
    Math.max(1, ...snap.players.map((p) => p.lap))
  );
  ctx.save();
  ctx.fillStyle = 'rgba(18, 20, 25, 0.88)';
  ctx.beginPath();
  ctx.roundRect(22, 20, 245, 40, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const sec = (snap.elapsedMs / 1000).toFixed(1);
  ctx.fillText(`LAP ${leaderLap}/${snap.totalLaps}  ·  ${sec}s`, 38, 40);
  ctx.restore();

  if (snap.finishCountdown !== null) {
    ctx.save();
    ctx.fillStyle = 'rgba(18, 20, 25, 0.9)';
    ctx.beginPath();
    ctx.roundRect(ARENA_WIDTH / 2 - 170, 20, 340, 40, 10);
    ctx.fill();
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FFB800';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `RACE ENDING IN ${Math.ceil(snap.finishCountdown)}s`,
      ARENA_WIDTH / 2,
      40
    );
    ctx.restore();
  }
}

export function renderGameSnapshot(
  ctx: CanvasRenderingContext2D,
  snap: GameSnapshot,
  fx: RenderFxState
): void {
  ctx.save();
  if (fx.shake > 0.2) {
    const ox = (Math.random() - 0.5) * fx.shake;
    const oy = (Math.random() - 0.5) * fx.shake;
    ctx.translate(ox, oy);
    fx.shake *= 0.85;
  } else {
    fx.shake = 0;
  }

  switch (snap.gameId) {
    case 'bumper-brawl':
      renderBumperBrawl(ctx, snap);
      break;
    case 'astro-blaster':
      renderAstroBlaster(ctx, snap);
      break;
    case 'turbo-drift':
      renderTurboDrift(ctx, snap, fx);
      break;
    case 'hex-drop':
      renderHexDrop(ctx, snap);
      break;
    case 'fuse-pass':
      renderFusePass(ctx, snap);
      break;
    case 'grid-runners':
      renderGridRunners(ctx, snap);
      break;
    case 'ricochet-tanks':
      renderRicochetTanks(ctx, snap);
      break;
    case 'turbo-striker':
      renderTurboStriker(ctx, snap);
      break;
    case 'paint-rush':
      renderPaintRush(ctx, snap);
      break;
  }

  ctx.restore();
}

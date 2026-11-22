import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  AstroBlasterSnapshot,
  BumperBrawlSnapshot,
  GameSnapshot,
  TurboDriftSnapshot,
} from '../shared/types';
import { Language } from '../lib/i18n';
import { CARD_GAME_IDS } from '../shared/games';
import {
  drawNameplate,
  drawPopupTexts,
  setActiveCanvasLang,
  tCanvas,
} from './canvasHelpers';
import {
  drawCharacterPod3D,
  drawExtrudedCylinder3D,
  drawExtrudedDiscStage,
  drawShadowOval,
  drawSphere3D,
  drawStudioBackdrop,
  shadeHex,
} from './render25d';
import {
  renderFusePass,
  renderGridRunners,
  renderHexDrop,
  renderPaintRush,
  renderRicochetTanks,
  renderTurboStriker,
} from './extraRenderers';
import {
  renderBladeDuel,
  renderCannonSiege,
  renderCrownHeist,
  renderHyperPong,
  renderLaserGauntlet,
  renderVaultHeist,
} from './partyRenderersA';
import {
  renderFreezeTag,
  renderGhostHunt,
  renderGravityFlip,
  renderHookShot,
  renderMeteorSwarm,
} from './partyRenderersB';
import {
  renderColorMatch,
  renderJungleLadders,
  renderLuckyAuction,
  renderRichStreet,
  renderTreasureDig,
} from './boardRenderers';
import {
  renderBombGrid,
  renderFruitDrop,
  renderKitchenRush,
  renderPinballClash,
  renderRedLightDash,
} from './partyRenderersC';
import { renderColorClash, renderLiarsDeck } from './cardRenderers';
import { renderModularGame } from './rendererRegistry';
import {
  ArcadeMotionState,
  createArcadeMotionState,
  drawArcadeFrontFX,
  getMotionTime,
  getPodFx,
  getSpringBannerAnim,
  prepareArcadeFrame,
  setActiveArcadeMotion,
} from './arcadeMotion';

export { drawNameplate, drawPopupTexts, tCanvas };

export interface RenderFxState {
  skidMarks: { x: number; y: number; alpha: number; color: string }[];
  shake: number;
  arcade: ArcadeMotionState;
}

export function createRenderFxState(): RenderFxState {
  return { skidMarks: [], shake: 0, arcade: createArcadeMotionState() };
}

// ============================================================
// 1. BUMPER BRAWL RENDERER (2.5D Extruded Steel Arena)
// ============================================================
function renderBumperBrawl(ctx: CanvasRenderingContext2D, snap: BumperBrawlSnapshot): void {
  drawStudioBackdrop(ctx, '#0A0C12', 'rgba(255, 184, 0, 0.08)', 'rgba(255,255,255,0.03)', 44);

  const { ringCenterX: cx, ringCenterY: cy, ringRadius: r, maxRingRadius: maxR } = snap;

  // Ghost outer maximum boundary
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 184, 0, 0.16)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Raised 2.5D circular steel arena slab with thick cliff wall
  const floorGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, 20, cx, cy, r);
  floorGrad.addColorStop(0, '#313846');
  floorGrad.addColorStop(0.75, '#1F242F');
  floorGrad.addColorStop(1, '#161A22');
  drawExtrudedDiscStage(ctx, cx, cy, r, 22, floorGrad, '#222835', '#475569');

  // Inner concentric tactical rings & crosshairs
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
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

  // Bold hazard amber bevel rim
  ctx.save();
  ctx.strokeStyle = '#FFB800';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#121419';
  ctx.lineWidth = 8;
  ctx.setLineDash([14, 14]);
  ctx.beginPath();
  ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
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

  // Power orbs on arena floor
  const pNow = getMotionTime() * 4.5;
  for (const orb of snap.powerups ?? []) {
    const col = orb.kind === 'giant' ? '#FFB800' : orb.kind === 'shock' ? '#00C2FF' : '#10D98B';
    const glyph = orb.kind === 'giant' ? 'BIG' : orb.kind === 'shock' ? 'ZAP' : '★';
    const bob = Math.sin(pNow + orb.x * 0.03) * 4;
    drawSphere3D(ctx, orb.x, orb.y, 15, col, '#FFFFFF', 5 + bob, true);
    ctx.save();
    ctx.fillStyle = '#0B0E14';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, orb.x, orb.y - (5 + bob) + 0.5);
    ctx.restore();
  }

  // Y-sort pylons and players for authentic 2.5D overlap
  type Item =
    | { kind: 'pylon'; y: number; pylon: (typeof snap.pylons)[number] }
    | { kind: 'player'; y: number; player: (typeof snap.players)[number] };
  const items: Item[] = [
    ...snap.pylons.map((pylon) => ({ kind: 'pylon' as const, y: pylon.y, pylon })),
    ...snap.players.filter((p) => p.alive).map((player) => ({ kind: 'player' as const, y: player.y, player })),
  ];
  items.sort((a, b) => a.y - b.y);

  for (const item of items) {
    if (item.kind === 'pylon') {
      const { pylon } = item;
      drawExtrudedCylinder3D(
        ctx,
        pylon.x,
        pylon.y,
        pylon.r,
        14,
        '#394254',
        '#202633',
        '#FFB800',
        '#FFB800'
      );
    } else {
      const p = item.player;
      ctx.save();
      if ((p.giantTimer ?? 0) > 0) {
        ctx.strokeStyle = '#FFB800';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 4, p.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      if ((p.shockTimer ?? 0) > 0) {
        ctx.strokeStyle = '#00C2FF';
        ctx.lineWidth = 3.5;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.arc(p.x, p.y - 4, p.radius + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Dash trail glow
      if (p.dashTimer > 0) {
        ctx.save();
        ctx.fillStyle = p.colorHex;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(p.x - Math.cos(p.angle) * 14, p.y - Math.sin(p.angle) * 14 - 5, p.radius * 1.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Ground shadow
      drawShadowOval(ctx, p.x + 2, p.y + p.radius * 0.48, p.radius * 1.12, p.radius * 0.78, 0.48);

      // Thick dark outer rubber bumper skirt (extruded 7px)
      ctx.fillStyle = '#0D1017';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 3, 0, Math.PI);
      ctx.lineTo(p.x - p.radius - 3, p.y - 7);
      ctx.arc(p.x, p.y - 7, p.radius + 3, Math.PI, 0, true);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#1B212D';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 7, p.radius + 3, 0, Math.PI * 2);
      ctx.fill();

      // Colored 3D bumper chassis sitting above rubber ring
      drawCharacterPod3D(ctx, p.x, p.y - 4, p.radius - 2, p.angle, p.colorHex, {
        height: 8,
        rimColor: (p.giantTimer ?? 0) > 0 ? '#FFB800' : '#F8FAFC',
        visorColor: '#FFFFFF',
        playerId: p.id,
      });

      // Front headlights on top face
      ctx.translate(p.x, p.y - 12);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.roundRect(p.radius - 7, -8, 5, 5, 2);
      ctx.roundRect(p.radius - 7, 3, 5, 5, 2);
      ctx.fill();
      ctx.restore();

      const streakTag = (p.streak ?? 0) >= 2 ? `${p.streak}x` : undefined;
      drawNameplate(ctx, p.x, p.y - p.radius - 26, p.slotIndex, p.name, p.colorHex, streakTag);
    }
  }

  drawPopupTexts(ctx, snap.popups);

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
    tCanvas(`ROUND ${snap.round}/${snap.totalRounds}  ·  ${Math.ceil(snap.roundTimer)}s`),
    38,
    40
  );
  ctx.restore();

  // Round winner banner
  if (snap.roundBanner) {
    const anim = getSpringBannerAnim('bumper-round', snap.roundBanner);
    ctx.save();
    ctx.translate(ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    ctx.scale(anim.scale, anim.scale);
    ctx.globalAlpha = anim.alpha;
    ctx.fillStyle = 'rgba(12, 14, 19, 0.9)';
    ctx.beginPath();
    ctx.roundRect(-240, -42, 480, 84, 16);
    ctx.fill();
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 28px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tCanvas(snap.roundBanner), 0, 0);
    ctx.restore();
  }
}

// ============================================================
// 2. ASTRO BLASTER RENDERER (2.5D Depth Cosmos)
// ============================================================
const STATIC_STARS = Array.from({ length: 100 }, (_, i) => ({
  x: (i * 197 + 43) % ARENA_WIDTH,
  y: (i * 131 + 29) % ARENA_HEIGHT,
  r: (i % 3) * 0.7 + 0.7,
  layer: i % 3,
  alpha: 0.22 + ((i * 17) % 55) / 100,
}));

function drawPolygonAsteroid3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  seed: number
): void {
  const sides = 8;
  const pts: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const jitter = 0.82 + (((seed * (i + 3) * 19) % 30) / 100);
    pts.push([Math.cos(a) * r * jitter, Math.sin(a) * r * jitter]);
  }

  const tracePoly = (ox: number, oy: number) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const px = pts[i][0] + ox;
      const py = pts[i][1] + oy;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  ctx.save();
  ctx.translate(x, y);

  // Shaded underside rock extrusion (depth = 10px)
  tracePoly(2, 9);
  ctx.fillStyle = '#11151E';
  ctx.fill();

  // Main rock body with directional gradient
  tracePoly(0, 0);
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#475569');
  grad.addColorStop(0.55, '#2A3241');
  grad.addColorStop(1, '#191F2A');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Recessed crater & top-left facet highlight
  ctx.fillStyle = 'rgba(10, 14, 22, 0.42)';
  ctx.beginPath();
  ctx.arc(r * 0.2, r * 0.18, r * 0.26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.arc(-r * 0.26, -r * 0.26, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderAstroBlaster(ctx: CanvasRenderingContext2D, snap: AstroBlasterSnapshot): void {
  drawStudioBackdrop(ctx, '#080B12', 'rgba(0, 194, 255, 0.08)', 'rgba(0, 194, 255, 0.04)', 60);

  // Multi-layer depth starfield
  const now = getMotionTime();
  for (const s of STATIC_STARS) {
    const drift = (now * (s.layer + 1) * 5) % ARENA_WIDTH;
    const sx = (s.x + drift) % ARENA_WIDTH;
    ctx.fillStyle = `rgba(226, 232, 240, ${s.alpha})`;
    ctx.beginPath();
    ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Beveled arena boundary frame
  ctx.strokeStyle = 'rgba(0, 194, 255, 0.18)';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, ARENA_WIDTH - 20, ARENA_HEIGHT - 20);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, ARENA_WIDTH - 20, ARENA_HEIGHT - 20);

  // Gravity Vortex Event
  if (snap.vortex && snap.vortex.active) {
    const vx = snap.vortex.x;
    const vy = snap.vortex.y;
    const vr = snap.vortex.r;
    ctx.save();
    for (let ring = 0; ring < 3; ring++) {
      const rr = ((now * 45 + ring * (vr / 3)) % vr);
      ctx.strokeStyle = `rgba(168, 85, 247, ${0.45 * (1 - rr / vr)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(vx, vy, Math.max(12, vr - rr), 0, Math.PI * 2);
      ctx.stroke();
    }
    const coreGrad = ctx.createRadialGradient(vx, vy, 4, vx, vy, 42);
    coreGrad.addColorStop(0, '#05070D');
    coreGrad.addColorStop(0.55, 'rgba(168, 85, 247, 0.6)');
    coreGrad.addColorStop(1, 'rgba(0, 194, 255, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(vx, vy, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Pickups (3D hovering orbs)
  const tNow = now * 4;
  for (const pk of snap.pickups) {
    const color =
      pk.kind === 'shield'
        ? '#00C2FF'
        : pk.kind === 'rapid'
          ? '#FFB800'
          : pk.kind === 'triple'
            ? '#FF3B9A'
            : pk.kind === 'pierce'
              ? '#C084FC'
              : '#10D98B';
    const label =
      pk.kind === 'shield'
        ? 'S'
        : pk.kind === 'rapid'
          ? 'R'
          : pk.kind === 'triple'
            ? '3X'
            : pk.kind === 'pierce'
              ? 'P'
              : '+';
    const bob = Math.sin(tNow + pk.x) * 4;
    drawSphere3D(ctx, pk.x, pk.y, 16, color, '#FFFFFF', 5 + bob, true);
    ctx.save();
    ctx.fillStyle = '#0B0E14';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pk.x, pk.y - (5 + bob) + 0.5);
    ctx.restore();
  }

  // Destructible Gold Crystal Meteors
  for (const cr of snap.crystals ?? []) {
    ctx.save();
    ctx.translate(cr.x, cr.y);
    ctx.fillStyle = 'rgba(255, 184, 0, 0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, cr.r + 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(now * 0.6 + cr.x * 0.01);
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rad = i % 2 === 0 ? cr.r : cr.r * 0.72;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (cr.hp < cr.maxHp) {
      ctx.save();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cr.x, cr.y, cr.r + 6, -Math.PI / 2, -Math.PI / 2 + (cr.hp / cr.maxHp) * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 3D Asteroids
  for (const ast of snap.asteroids) {
    drawPolygonAsteroid3D(ctx, ast.x, ast.y, ast.r, ast.seed);
  }

  // Plasma bolts
  for (const b of snap.bullets) {
    ctx.save();
    const angle = Math.atan2(b.vy, b.vx);
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    if (b.pierce) {
      ctx.fillStyle = 'rgba(192, 132, 252, 0.45)';
      ctx.beginPath();
      ctx.roundRect(-16, -6, 30, 12, 6);
      ctx.fill();
    }
    ctx.fillStyle = shadeHex(b.colorHex, -0.35);
    ctx.beginPath();
    ctx.roundRect(-11, -3.5, 20, 8, 4);
    ctx.fill();
    ctx.fillStyle = b.pierce ? '#E879F9' : b.colorHex;
    ctx.beginPath();
    ctx.roundRect(-10, -4, 18, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(-4, -2, 10, 3, 1.5);
    ctx.fill();
    ctx.restore();
  }

  // 2.5D Starfighters (Y-sorted)
  const ships = [...snap.players].filter((s) => s.alive).sort((a, b) => a.y - b.y);
  for (const ship of ships) {
    // Ground/space shadow beneath hovering ship
    drawShadowOval(ctx, ship.x + 3, ship.y + 16, 20, 11, 0.38);

    ctx.save();
    ctx.translate(ship.x, ship.y - 4);

    // Shield halo
    if (ship.shieldTimer > 0 || ship.boostTimer > 0) {
      ctx.strokeStyle = ship.boostTimer > 0 ? '#10D98B' : '#00C2FF';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Extruded underside wing thickness (offset downward before rotating!)
    ctx.save();
    ctx.translate(0, 5);
    ctx.rotate(ship.angle);
    ctx.fillStyle = shadeHex(ship.colorHex, -0.58);
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, -16);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.rotate(ship.angle);

    const podFx = getPodFx(ship.id);
    ctx.scale(podFx.scaleX, podFx.scaleY);

    // Thruster flame with flicker
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > 45 || ship.boostTimer > 0) {
      const flicker = 0.85 + 0.25 * Math.sin(now * 38 + ship.slotIndex);
      const flameLen = (ship.boostTimer > 0 ? 32 : Math.min(22, speed / 17)) * flicker;
      ctx.fillStyle = ship.boostTimer > 0 ? '#10D98B' : '#FFB800';
      ctx.beginPath();
      ctx.moveTo(-14, -5.5);
      ctx.lineTo(-14 - flameLen, 0);
      ctx.lineTo(-14, 5.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFFBEB';
      ctx.beginPath();
      ctx.moveTo(-14, -2.4);
      ctx.lineTo(-14 - flameLen * 0.52, 0);
      ctx.lineTo(-14, 2.4);
      ctx.closePath();
      ctx.fill();
    }

    // Top starfighter hull with wing bevel gradient
    const hullGrad = ctx.createLinearGradient(-14, -16, 18, 16);
    hullGrad.addColorStop(0, shadeHex(ship.colorHex, 0.35));
    hullGrad.addColorStop(0.5, ship.colorHex);
    hullGrad.addColorStop(1, shadeHex(ship.colorHex, -0.25));
    ctx.fillStyle = hullGrad;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, -16);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Raised fuselage spine
    ctx.fillStyle = shadeHex(ship.colorHex, 0.25);
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-9, -6);
    ctx.lineTo(-9, 6);
    ctx.closePath();
    ctx.fill();

    // 3D Cockpit glass dome
    ctx.fillStyle = '#BAE6FD';
    ctx.beginPath();
    ctx.ellipse(4, 0, 6.5, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(5, -1, 2.5, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // HP pips under ship
    const pipWidth = 10;
    const totalW = ship.maxHp * (pipWidth + 3) - 3;
    for (let i = 0; i < ship.maxHp; i++) {
      ctx.fillStyle = i < ship.hp ? ship.colorHex : 'rgba(255,255,255,0.16)';
      ctx.fillRect(ship.x - totalW / 2 + i * (pipWidth + 3), ship.y + 24, pipWidth, 4);
    }

    drawNameplate(ctx, ship.x, ship.y - 36, ship.slotIndex, ship.name, ship.colorHex);
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

  drawPopupTexts(ctx, snap.popups);

  // Timer readout
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
  ctx.fillText(tCanvas(`TIME  ${mm}:${ss}`), 40, 40);
  ctx.restore();
}

// ============================================================
// 3. TURBO DRIFT RENDERER (2.5D Elevated Sky-Track Viaduct)
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
  drawStudioBackdrop(ctx, '#090C12', 'rgba(0, 194, 255, 0.06)', 'rgba(255, 255, 255, 0.03)', 48);

  const pts = snap.trackPoints;
  const roadW = snap.trackHalfWidth * 2;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Deep abyss shadow cast by elevated viaduct
  ctx.save();
  ctx.translate(4, 24);
  strokeClosedSpline(ctx, pts);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.62)';
  ctx.lineWidth = roadW + 24;
  ctx.stroke();
  ctx.restore();

  // Thick 2.5D concrete/steel viaduct deck wall underneath track
  for (let layer = 14; layer >= 4; layer -= 5) {
    ctx.save();
    ctx.translate(0, layer);
    strokeClosedSpline(ctx, pts);
    ctx.strokeStyle = layer === 14 ? '#161B25' : '#242B3A';
    ctx.lineWidth = roadW + 20;
    ctx.stroke();
    ctx.restore();
  }

  // Outer steel deck rim
  strokeClosedSpline(ctx, pts);
  ctx.strokeStyle = '#3B4457';
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
  ctx.strokeStyle = '#1E232D';
  ctx.lineWidth = roadW;
  ctx.stroke();

  // Center dashed lane marker
  ctx.save();
  strokeClosedSpline(ctx, pts);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
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

  // Boost chevron pads (animated flowing pulse)
  const driftNow = getMotionTime() * 5;
  for (const pad of snap.boostPads) {
    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.rotate(pad.angle);
    ctx.fillStyle = 'rgba(255, 184, 0, 0.16)';
    ctx.beginPath();
    ctx.roundRect(-24, -20, 48, 40, 6);
    ctx.fill();
    for (let c = -1; c <= 1; c++) {
      const ox = c * 14;
      const pulse = 0.55 + 0.45 * Math.sin(driftNow * 2.2 - c * 1.4);
      ctx.strokeStyle = `rgba(255, 184, 0, ${pulse.toFixed(2)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ox - 6, -15);
      ctx.lineTo(ox + 6, 0);
      ctx.lineTo(ox - 6, 15);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Oil slick puddles on track
  for (const oil of snap.oils ?? []) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 12, 18, 0.88)';
    ctx.beginPath();
    ctx.ellipse(oil.x, oil.y, oil.r, oil.r * 0.72, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 194, 255, 0.22)';
    ctx.beginPath();
    ctx.ellipse(oil.x - 4, oil.y - 3, oil.r * 0.45, oil.r * 0.25, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Track Coins & Mystery Boxes
  for (const c of snap.coins ?? []) {
    const bob = Math.sin(driftNow + c.x * 0.03) * 3.5;
    if (c.kind === 'mystery') {
      drawSphere3D(ctx, c.x, c.y, 13, '#A855F7', '#FDE047', 4 + bob, true);
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', c.x, c.y - (4 + bob));
      ctx.restore();
    } else {
      drawSphere3D(ctx, c.x, c.y, 10, '#FFB800', '#FEF9C3', 3 + bob, true);
    }
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

  // Cars (falling cars drop below deck; on-track cars Y-sorted)
  const orderedCars = [...snap.players].sort((a, b) => {
    if (a.falling !== b.falling) return Number(b.falling) - Number(a.falling);
    return a.y - b.y;
  });

  for (const car of orderedCars) {
    ctx.save();
    const fallDropY = car.falling ? car.fallProgress * 44 : 0;
    ctx.translate(car.x, car.y + fallDropY);

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
      // Track shadow
      drawShadowOval(ctx, 2, 7, 20, 13, 0.46);
    }

    // Nitro exhaust flame
    if (car.boosting && !car.falling) {
      ctx.save();
      ctx.translate(0, -4);
      ctx.rotate(car.angle);
      const flameReach = 34 + Math.sin(driftNow * 9 + car.slotIndex) * 7;
      ctx.fillStyle = '#FFB800';
      ctx.beginPath();
      ctx.moveTo(-17, -5.5);
      ctx.lineTo(-flameReach, 0);
      ctx.lineTo(-17, 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(-17, -2.5);
      ctx.lineTo(-flameReach * 0.55, 0);
      ctx.lineTo(-17, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Lower 2.5D chassis skirt (world-space offset +3px down)
    if (!car.falling) {
      ctx.save();
      ctx.rotate(car.angle);
      ctx.fillStyle = '#0D0F14';
      ctx.fillRect(-13, -12, 8, 4);
      ctx.fillRect(6, -12, 8, 4);
      ctx.fillRect(-13, 8, 8, 4);
      ctx.fillRect(6, 8, 8, 4);
      ctx.fillStyle = shadeHex(car.colorHex, -0.52);
      ctx.beginPath();
      ctx.roundRect(-17, -9, 34, 21, 6);
      ctx.fill();
      ctx.restore();
    }

    // Upper sculpted car body lifted -5px
    ctx.translate(0, car.falling ? 0 : -5);
    if (!car.falling) ctx.rotate(car.angle);

    // Tires
    ctx.fillStyle = '#141820';
    ctx.fillRect(-13, -12, 8, 4);
    ctx.fillRect(6, -12, 8, 4);
    ctx.fillRect(-13, 8, 8, 4);
    ctx.fillRect(6, 8, 8, 4);

    // Main glossy car shell
    const carGrad = ctx.createLinearGradient(-17, -10, 17, 10);
    carGrad.addColorStop(0, shadeHex(car.colorHex, 0.32));
    carGrad.addColorStop(0.55, car.colorHex);
    carGrad.addColorStop(1, shadeHex(car.colorHex, -0.25));
    ctx.fillStyle = carGrad;
    ctx.beginPath();
    ctx.roundRect(-17, -10, 34, 20, 6);
    ctx.fill();
    ctx.strokeStyle = car.respawnBlink > 0 ? '#FFFFFF' : '#0D0F14';
    ctx.lineWidth = car.respawnBlink > 0 ? 2.5 : 1.5;
    ctx.stroke();

    // Racing stripe & raised windshield canopy
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillRect(-15, -2, 30, 4);
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(1, -7, 9, 14, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.fillRect(4, -5, 4, 10);

    // Slipstream draft streaks or oil-spin ring
    if (!car.falling && car.drafting) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 194, 255, 0.72)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-22, -12);
      ctx.lineTo(14, -14);
      ctx.moveTo(-22, 12);
      ctx.lineTo(14, 14);
      ctx.stroke();
      ctx.restore();
    }
    if (!car.falling && car.slipping) {
      ctx.save();
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

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
    const coinTag = !car.falling && (car.coins ?? 0) > 0 ? `${posStr} · $${car.coins}` : posStr;
    drawNameplate(
      ctx,
      car.x,
      car.y + fallDropY - 30,
      car.slotIndex,
      car.name,
      car.falling ? '#FF4D2E' : car.colorHex,
      coinTag
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
  ctx.fillText(tCanvas(`LAP ${leaderLap}/${snap.totalLaps}  ·  ${sec}s`), 38, 40);
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
      tCanvas(`RACE ENDING IN ${Math.ceil(snap.finishCountdown)}s`),
      ARENA_WIDTH / 2,
      40
    );
    ctx.restore();
  }
}

export function renderGameSnapshot(
  ctx: CanvasRenderingContext2D,
  rawSnap: GameSnapshot,
  fx: RenderFxState,
  lang: Language = 'en'
): void {
  setActiveCanvasLang(lang);
  const snap = prepareArcadeFrame(rawSnap, fx.arcade);
  setActiveArcadeMotion(fx.arcade);
  ctx.save();

  try {
    const isCardGame = CARD_GAME_IDS.has(snap.gameId);
    const kickX = isCardGame ? 0 : fx.arcade.kickX;
    const kickY = isCardGame ? 0 : fx.arcade.kickY;

    if (fx.shake > 0.2 || Math.abs(kickX) > 0.1 || Math.abs(kickY) > 0.1) {
      const ox = kickX + (fx.shake > 0.2 ? (Math.random() - 0.5) * fx.shake : 0);
      const oy = kickY + (fx.shake > 0.2 ? (Math.random() - 0.5) * fx.shake : 0);
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
      case 'laser-gauntlet':
        renderLaserGauntlet(ctx, snap);
        break;
      case 'vault-heist':
        renderVaultHeist(ctx, snap);
        break;
      case 'hyper-pong':
        renderHyperPong(ctx, snap);
        break;
      case 'blade-duel':
        renderBladeDuel(ctx, snap);
        break;
      case 'cannon-siege':
        renderCannonSiege(ctx, snap);
        break;
      case 'crown-heist':
        renderCrownHeist(ctx, snap);
        break;
      case 'freeze-tag':
        renderFreezeTag(ctx, snap);
        break;
      case 'ghost-hunt':
        renderGhostHunt(ctx, snap);
        break;
      case 'meteor-swarm':
        renderMeteorSwarm(ctx, snap);
        break;
      case 'hook-shot':
        renderHookShot(ctx, snap);
        break;
      case 'gravity-flip':
        renderGravityFlip(ctx, snap);
        break;
      case 'rich-street':
        renderRichStreet(ctx, snap);
        break;
      case 'jungle-ladders':
        renderJungleLadders(ctx, snap);
        break;
      case 'bomb-grid':
        renderBombGrid(ctx, snap);
        break;
      case 'red-light-dash':
        renderRedLightDash(ctx, snap);
        break;
      case 'color-match':
        renderColorMatch(ctx, snap);
        break;
      case 'kitchen-rush':
        renderKitchenRush(ctx, snap);
        break;
      case 'treasure-dig':
        renderTreasureDig(ctx, snap);
        break;
      case 'fruit-drop':
        renderFruitDrop(ctx, snap);
        break;
      case 'lucky-auction':
        renderLuckyAuction(ctx, snap);
        break;
      case 'pinball-clash':
        renderPinballClash(ctx, snap);
        break;
      case 'color-clash':
        renderColorClash(ctx, snap);
        break;
      case 'liars-deck':
        renderLiarsDeck(ctx, snap);
        break;
      default:
        renderModularGame(ctx, snap);
        break;
    }

    drawArcadeFrontFX(ctx, fx.arcade);
  } finally {
    setActiveArcadeMotion(null);
    ctx.restore();
  }
}

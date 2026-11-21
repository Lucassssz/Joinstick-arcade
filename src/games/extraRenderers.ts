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
import { drawNameplate, drawPopupTexts, tCanvas } from './renderers';
import {
  drawArenaSlab,
  drawCharacterPod3D,
  drawExtrudedBox3D,
  drawExtrudedCylinder3D,
  drawExtrudedHex3D,
  drawShadowOval,
  drawSphere3D,
  drawStudioBackdrop,
  shadeHex,
} from './render25d';

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
  ctx.fillText(tCanvas(text), x + w / 2, y + 20);
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
  ctx.fillText(tCanvas(text), ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
  ctx.restore();
}

// ============================================================
// 4. HEX DROP RENDERER (2.5D Extruded Hex Pillars)
// ============================================================
export function renderHexDrop(ctx: CanvasRenderingContext2D, snap: HexDropSnapshot): void {
  drawStudioBackdrop(ctx, '#090B11', 'rgba(16, 217, 139, 0.08)', 'rgba(16, 217, 139, 0.04)', 48);

  // Draw tiles: falling tiles first, then solid/cracking sorted back-to-front by Y
  const orderedTiles = [...snap.tiles].sort((a, b) => {
    const aFall = a.state === 'falling' ? 0 : 1;
    const bFall = b.state === 'falling' ? 0 : 1;
    if (aFall !== bFall) return aFall - bFall;
    return a.y - b.y;
  });

  for (const tile of orderedTiles) {
    if (tile.state === 'gone') continue;
    ctx.save();

    let scale = 1;
    let alpha = 1;
    let oy = 0;
    let jitterX = 0;
    let fill = '#242B3A';
    let side = '#121620';
    let stroke = '#3E4B63';
    let innerAccent = 'rgba(16, 217, 139, 0.18)';
    let depth = 15;

    if (tile.kind === 'gold') {
      fill = '#5A4114';
      side = '#2F2008';
      stroke = '#FFB800';
      innerAccent = 'rgba(255, 184, 0, 0.42)';
    } else if (tile.kind === 'spring') {
      fill = '#12463A';
      side = '#09241E';
      stroke = '#10D98B';
      innerAccent = 'rgba(16, 217, 139, 0.48)';
    } else if (tile.kind === 'ice') {
      fill = '#1B3F56';
      side = '#0D212E';
      stroke = '#38BDF8';
      innerAccent = 'rgba(56, 189, 248, 0.45)';
    }

    if (tile.state === 'cracking') {
      jitterX = Math.sin(Date.now() * 0.06 + tile.id) * 2.5 * tile.progress;
      oy = tile.progress * 5;
      depth = Math.max(8, 15 - tile.progress * 5);
      fill = tile.progress > 0.55 ? '#6B2622' : '#58411E';
      side = tile.progress > 0.55 ? '#351210' : '#2D210E';
      stroke = tile.progress > 0.55 ? '#FF4D2E' : '#FFB800';
      innerAccent = 'rgba(255, 184, 0, 0.42)';
    } else if (tile.state === 'falling') {
      scale = Math.max(0.25, 1 - tile.progress * 0.72);
      alpha = Math.max(0, 1 - tile.progress);
      oy = tile.progress * 54;
      fill = '#451A1A';
      side = '#240C0C';
      stroke = '#FF4D2E';
      depth = 10;
    }

    ctx.globalAlpha = alpha;
    ctx.translate(tile.x + jitterX, tile.y + oy);
    ctx.scale(scale, scale);

    drawExtrudedHex3D(ctx, 0, 0, tile.radius - 2, depth, fill, side, stroke, innerAccent);

    if (tile.state === 'solid') {
      if (tile.kind === 'gold') {
        ctx.fillStyle = '#FDE047';
        ctx.font = '800 16px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', 0, 0);
      } else if (tile.kind === 'spring') {
        ctx.strokeStyle = '#6EE7B7';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-10, 4);
        ctx.lineTo(0, -6);
        ctx.lineTo(10, 4);
        ctx.stroke();
      } else if (tile.kind === 'ice') {
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, -5);
        ctx.lineTo(6, -12);
        ctx.moveTo(-4, 7);
        ctx.lineTo(12, 0);
        ctx.stroke();
      }
    }

    if (tile.targeted) {
      const pulse = 0.55 + Math.sin(Date.now() * 0.02) * 0.35;
      ctx.strokeStyle = `rgba(255, 77, 46, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, tile.radius * 0.58, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crack lines on top hex face
    if (tile.state === 'cracking' && tile.progress > 0.2) {
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, -7);
      ctx.lineTo(0, 2);
      ctx.lineTo(14, -5);
      ctx.moveTo(0, 2);
      ctx.lineTo(-4, 13);
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

  // Players: falling first, then sorted by Y and leap state
  const orderedPlayers = [...snap.players].sort((a, b) => {
    if (a.falling !== b.falling) return Number(b.falling) - Number(a.falling);
    return a.y - b.y;
  });

  for (const p of orderedPlayers) {
    if (!p.alive) continue;
    const jumpArc =
      p.leapTimer > 0
        ? Math.sin((1 - p.leapTimer / Math.max(0.01, p.leapDuration)) * Math.PI)
        : 0;
    const scale = p.falling
      ? Math.max(0.28, 1 - p.fallProgress * 0.72)
      : 1 + jumpArc * 0.18;
    const liftZ = p.falling ? -p.fallProgress * 46 : jumpArc * 28;

    drawCharacterPod3D(ctx, p.x, p.y, 17, p.angle + (p.falling ? p.fallProgress * 5 : 0), p.colorHex, {
      height: 10,
      zHeight: liftZ,
      scale,
      alpha: p.falling ? Math.max(0.1, 1 - p.fallProgress * 0.9) : 1,
      rimColor: '#F8FAFC',
    });

    if (!p.falling) {
      drawNameplate(ctx, p.x, p.y - liftZ - 34, p.slotIndex, p.name, p.colorHex);
    }
  }

  drawPopupTexts(ctx, snap.popups);

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
// 5. FUSE PASS RENDERER (2.5D Industrial Workshop)
// ============================================================
export function renderFusePass(ctx: CanvasRenderingContext2D, snap: FusePassSnapshot): void {
  drawStudioBackdrop(ctx, '#0D1016', 'rgba(255, 122, 26, 0.08)', 'rgba(255,255,255,0.025)', 48);

  // Raised 2.5D workshop platform slab
  drawArenaSlab(
    ctx,
    30,
    26,
    ARENA_WIDTH - 60,
    ARENA_HEIGHT - 60,
    18,
    16,
    '#191E28',
    '#10131B',
    '#FF7A1A',
    4
  );

  // Subtle floor grid on platform top
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 60; x < ARENA_WIDTH - 40; x += 60) {
    ctx.moveTo(x, 30);
    ctx.lineTo(x, ARENA_HEIGHT - 38);
  }
  for (let y = 60; y < ARENA_HEIGHT - 40; y += 60) {
    ctx.moveTo(34, y);
    ctx.lineTo(ARENA_WIDTH - 34, y);
  }
  ctx.stroke();

  // Workshop Jump Pads
  for (const jp of snap.jumpPads ?? []) {
    ctx.save();
    ctx.fillStyle = 'rgba(16, 217, 139, 0.16)';
    ctx.strokeStyle = '#10D98B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(jp.x, jp.y, jp.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#A7F3D0';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(jp.x - 9, jp.y + 4);
    ctx.lineTo(jp.x, jp.y - 6);
    ctx.lineTo(jp.x + 9, jp.y + 4);
    ctx.stroke();
    ctx.restore();
  }

  // Fuse pickups
  const fuseNow = Date.now() * 0.0045;
  for (const pk of snap.pickups ?? []) {
    const col = pk.kind === 'speed' ? '#10D98B' : pk.kind === 'shield' ? '#00C2FF' : '#38BDF8';
    const label = pk.kind === 'speed' ? 'SPD' : pk.kind === 'shield' ? 'SHD' : '+2.5';
    const bob = Math.sin(fuseNow + pk.x * 0.03) * 4;
    drawSphere3D(ctx, pk.x, pk.y, 15, col, '#FFFFFF', 4 + bob, true);
    ctx.save();
    ctx.fillStyle = '#0B0E14';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pk.x, pk.y - (4 + bob));
    ctx.restore();
  }

  // Explosions on floor
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

  // Y-sort pillars and players
  type Item =
    | { kind: 'pillar'; y: number; pil: (typeof snap.pillars)[number] }
    | { kind: 'player'; y: number; p: (typeof snap.players)[number] };
  const items: Item[] = [
    ...snap.pillars.map((pil) => ({ kind: 'pillar' as const, y: pil.y, pil })),
    ...snap.players.filter((p) => p.alive).map((p) => ({ kind: 'player' as const, y: p.y, p })),
  ];
  items.sort((a, b) => a.y - b.y);

  for (const item of items) {
    if (item.kind === 'pillar') {
      const { pil } = item;
      drawExtrudedCylinder3D(
        ctx,
        pil.x,
        pil.y,
        pil.r,
        24,
        '#323B4D',
        '#1D2330',
        '#5B677F',
        '#191E29'
      );
    } else {
      const p = item.p;
      ctx.save();
      if ((p.shieldTimer ?? 0) > 0) {
        ctx.strokeStyle = '#00C2FF';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 4, 28, 0, Math.PI * 2);
        ctx.stroke();
      }
      if ((p.speedBuffTimer ?? 0) > 0) {
        ctx.strokeStyle = '#10D98B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(p.x, p.y - 4, 33, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Bomb danger aura on floor
      if (p.hasBomb) {
        ctx.strokeStyle = flashFast ? '#FF4D2E' : '#FFB800';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 32 + urgency * 8, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.immuneTimer > 0) {
        ctx.strokeStyle = 'rgba(0, 194, 255, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();

      drawCharacterPod3D(ctx, p.x, p.y, 19, p.angle, p.colorHex, {
        height: 11,
        rimColor: p.hasBomb ? (flashFast ? '#FF4D2E' : '#FFB800') : '#FFFFFF',
      });

      // Render glossy 3D ticking bomb hovering above holder
      if (p.hasBomb) {
        const bx = p.x;
        const by = p.y - 36;
        const bombCol = flashFast ? '#FF4D2E' : '#252B38';
        drawSphere3D(ctx, bx, by, 14, bombCol, '#FFB800', 0, false);

        ctx.save();
        // Fuse spark
        ctx.fillStyle = '#FFB800';
        ctx.beginPath();
        ctx.arc(bx + 10, by - 12, flashFast ? 6 : 4, 0, Math.PI * 2);
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
        p.hasBomb ? p.y - 62 : p.y - 38,
        p.slotIndex,
        p.name,
        p.hasBomb ? '#FF4D2E' : p.colorHex,
        p.hasBomb ? 'BOMB' : undefined
      );
    }
  }

  drawPopupTexts(ctx, snap.popups);

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
// 6. GRID RUNNERS RENDERER (2.5D Extruded Light-Wall Deck)
// ============================================================
export function renderGridRunners(ctx: CanvasRenderingContext2D, snap: GridRunnersSnapshot): void {
  drawStudioBackdrop(ctx, '#06080E', 'rgba(0, 194, 255, 0.1)', 'rgba(0, 194, 255, 0.04)', 48);

  // Elevated neon cyber-deck slab
  drawArenaSlab(
    ctx,
    24,
    22,
    ARENA_WIDTH - 48,
    ARENA_HEIGHT - 48,
    14,
    14,
    '#0A0E18',
    '#0E2235',
    '#00C2FF',
    4
  );

  // Retro neon cyber-grid
  ctx.strokeStyle = 'rgba(0, 194, 255, 0.085)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 24; x <= ARENA_WIDTH - 24; x += 40) {
    ctx.moveTo(x, 24);
    ctx.lineTo(x, ARENA_HEIGHT - 26);
  }
  for (let y = 24; y <= ARENA_HEIGHT - 24; y += 40) {
    ctx.moveTo(24, y);
    ctx.lineTo(ARENA_WIDTH - 24, y);
  }
  ctx.stroke();

  // 2.5D Extruded Light-Wall Trails (base shadow + vertical neon wall + top laser crest)
  for (const trail of snap.trails) {
    if (trail.points.length < 2) continue;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawRibbon = (oy: number, width: number, color: string, alpha: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < trail.points.length; i++) {
        const pt = trail.points[i];
        if (!started || pt.gap) {
          ctx.moveTo(pt.x, pt.y + oy);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y + oy);
        }
      }
      ctx.stroke();
    };

    drawRibbon(4, 12, 'rgba(0,0,0,0.65)', 0.55);
    drawRibbon(1, 10, shadeHex(trail.colorHex, -0.45), 0.9);
    drawRibbon(-4, 7, trail.colorHex, 0.95);
    drawRibbon(-6, 2.5, '#FFFFFF', 0.88);
    ctx.restore();
  }

  // Cyber Monolith Obstacles (hoppable)
  for (const obs of snap.obstacles ?? []) {
    drawExtrudedBox3D(ctx, obs.x, obs.y, obs.w, obs.h, 16, 5, '#1D2940', '#0F1726', '#00C2FF');
  }

  // Grid pickups
  const gridNow = Date.now() * 0.0045;
  for (const pk of snap.pickups ?? []) {
    const col = pk.kind === 'energy' ? '#10D98B' : pk.kind === 'emp' ? '#FF3B9A' : '#FFB800';
    const label = pk.kind === 'energy' ? '⚡' : pk.kind === 'emp' ? 'EMP' : '★';
    const bob = Math.sin(gridNow + pk.x * 0.03) * 4;
    drawSphere3D(ctx, pk.x, pk.y, 15, col, '#FFFFFF', 5 + bob, true);
    ctx.save();
    ctx.fillStyle = '#0B0E14';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pk.x, pk.y - (5 + bob));
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

  drawPopupTexts(ctx, snap.popups);

  // Light cycles (Y-sorted)
  const cycles = [...snap.players].filter((p) => p.alive).sort((a, b) => a.y - b.y);
  for (const p of cycles) {
    const hopArc =
      p.hopTimer > 0
        ? Math.sin((1 - p.hopTimer / Math.max(0.01, p.hopDuration)) * Math.PI)
        : 0;
    const scale = 1 + hopArc * 0.28;
    const liftZ = hopArc * 24;

    drawShadowOval(ctx, p.x + 2, p.y + 6, 19 * (1 - hopArc * 0.2), 11 * (1 - hopArc * 0.2), 0.45);

    ctx.save();
    ctx.translate(p.x, p.y - liftZ - 4);
    ctx.scale(scale, scale);

    // Lower 2.5D extruded chassis skirt
    ctx.save();
    ctx.translate(0, 5);
    ctx.rotate(p.angle);
    ctx.fillStyle = shadeHex(p.colorHex, -0.55);
    ctx.beginPath();
    ctx.roundRect(-16, -9, 32, 18, 7);
    ctx.fill();
    ctx.restore();

    ctx.rotate(p.angle);

    // Overdrive tail glow
    if (p.overdriveTimer > 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(-14, -5);
      ctx.lineTo(-34, 0);
      ctx.lineTo(-14, 5);
      ctx.closePath();
      ctx.fill();
    }

    // Sleek cycle top shell
    ctx.fillStyle = '#0B0E16';
    ctx.beginPath();
    ctx.roundRect(-16, -9, 32, 18, 7);
    ctx.fill();

    const bodyGrad = ctx.createLinearGradient(-13, -7, 14, 7);
    bodyGrad.addColorStop(0, shadeHex(p.colorHex, 0.35));
    bodyGrad.addColorStop(1, p.colorHex);
    ctx.fillStyle = bodyGrad;
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
      p.y - liftZ - 32,
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
// 7. RICOCHET TANKS RENDERER (2.5D Armored Bunker Arena)
// ============================================================
export function renderRicochetTanks(
  ctx: CanvasRenderingContext2D,
  snap: RicochetTanksSnapshot
): void {
  drawStudioBackdrop(ctx, '#0D1017', 'rgba(82, 139, 255, 0.06)', 'rgba(255,255,255,0.025)', 40);

  // Raised armored bunker floor slab
  drawArenaSlab(
    ctx,
    17,
    15,
    ARENA_WIDTH - 34,
    ARENA_HEIGHT - 34,
    10,
    14,
    '#161B25',
    '#242B3A',
    '#434E66',
    7
  );

  // Blueprint tiles
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 20; x <= ARENA_WIDTH - 20; x += 40) {
    ctx.moveTo(x, 20);
    ctx.lineTo(x, ARENA_HEIGHT - 22);
  }
  for (let y = 20; y <= ARENA_HEIGHT - 20; y += 40) {
    ctx.moveTo(20, y);
    ctx.lineTo(ARENA_WIDTH - 20, y);
  }
  ctx.stroke();

  // Proximity mines on floor
  const blink = Math.floor(Date.now() / 220) % 2 === 0;
  for (const m of snap.mines) {
    drawExtrudedCylinder3D(
      ctx,
      m.x,
      m.y,
      11,
      5,
      '#252C3B',
      '#141822',
      m.colorHex,
      m.armed && blink ? '#FF4D2E' : '#64748B'
    );
  }

  // Supply Pickups
  const nowBob = Math.sin(Date.now() * 0.006) * 3;
  for (const pk of snap.pickups ?? []) {
    const col = pk.kind === 'triple' ? '#FF3B9A' : pk.kind === 'speed' ? '#10D98B' : '#00C2FF';
    const label = pk.kind === 'triple' ? '3X' : pk.kind === 'speed' ? 'SPD' : 'SHD';
    drawShadowOval(ctx, pk.x, pk.y + 8, 16, 10, 0.35);
    drawExtrudedCylinder3D(ctx, pk.x, pk.y + nowBob * 0.5, 16, 8, shadeHex(col, -0.2), shadeHex(col, -0.5), col);
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tCanvas(label), pk.x, pk.y - 4 + nowBob * 0.5);
    ctx.restore();
  }

  // Y-sort Bunker Walls, Golden Crates, and Tanks for true 2.5D overlap!
  type Entity =
    | { kind: 'wall'; y: number; w: (typeof snap.walls)[number] }
    | { kind: 'crate'; y: number; c: NonNullable<typeof snap.crates>[number] }
    | { kind: 'tank'; y: number; t: (typeof snap.players)[number] };
  const entities: Entity[] = [
    ...snap.walls.map((w) => ({ kind: 'wall' as const, y: w.y + w.h, w })),
    ...(snap.crates ?? []).map((c) => ({ kind: 'crate' as const, y: c.y + c.r, c })),
    ...snap.players.filter((t) => t.alive).map((t) => ({ kind: 'tank' as const, y: t.y + 12, t })),
  ];
  entities.sort((a, b) => a.y - b.y);

  for (const ent of entities) {
    if (ent.kind === 'wall') {
      const { w } = ent;
      drawExtrudedBox3D(ctx, w.x, w.y, w.w, w.h, 16, 5, '#343E52', '#1F2533', '#5C6B87');
    } else if (ent.kind === 'crate') {
      const { c } = ent;
      const topCol = c.hp < c.maxHp ? '#D97706' : '#F59E0B';
      drawExtrudedBox3D(ctx, c.x - c.r, c.y - c.r, c.r * 2, c.r * 2, 14, 5, topCol, '#92400E', '#FDE68A');
      ctx.save();
      ctx.fillStyle = '#FFFBEB';
      ctx.font = '900 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', c.x, c.y - 7);
      ctx.restore();
    } else {
      const t = ent.t;
      drawShadowOval(ctx, t.x + 2, t.y + 8, 22, 15, 0.48);

      ctx.save();
      ctx.translate(t.x, t.y - 3);

      if (t.shieldTimer > 0) {
        ctx.strokeStyle = '#00C2FF';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(0, -4, 28, 0, Math.PI * 2);
        ctx.stroke();
      }
      if ((t.tripleTimer ?? 0) > 0) {
        ctx.strokeStyle = '#FF3B9A';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(0, -4, 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if ((t.speedTimer ?? 0) > 0) {
        ctx.strokeStyle = '#10D98B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -4, 36, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Lower tank treads + hull thickness
      ctx.save();
      ctx.translate(0, 4);
      ctx.rotate(t.hullAngle);
      ctx.fillStyle = '#0B0E14';
      ctx.fillRect(-18, -18, 36, 8);
      ctx.fillRect(-18, 10, 36, 8);
      ctx.fillStyle = shadeHex(t.colorHex, -0.5);
      ctx.beginPath();
      ctx.roundRect(-16, -12, 32, 24, 5);
      ctx.fill();
      ctx.restore();

      // Upper tank hull
      ctx.save();
      ctx.rotate(t.hullAngle);
      ctx.fillStyle = '#181D27';
      ctx.fillRect(-18, -18, 36, 7);
      ctx.fillRect(-18, 11, 36, 7);

      const hullGrad = ctx.createLinearGradient(-16, -12, 16, 12);
      hullGrad.addColorStop(0, shadeHex(t.colorHex, 0.28));
      hullGrad.addColorStop(1, shadeHex(t.colorHex, -0.22));
      ctx.fillStyle = hullGrad;
      ctx.beginPath();
      ctx.roundRect(-16, -12, 32, 24, 5);
      ctx.fill();
      ctx.strokeStyle = '#0D1017';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Raised extruded turret + shaded barrel (lifted -7px)
      ctx.save();
      ctx.translate(0, -7);
      ctx.rotate(t.turretAngle);
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.roundRect(4, -2, 22, 7, 2);
      ctx.fill();
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.roundRect(4, -4, 22, 7, 2);
      ctx.fill();
      ctx.strokeStyle = '#0D1017';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();

      drawExtrudedCylinder3D(ctx, 0, -2, 10, 7, '#283040', '#141923', t.colorHex, t.colorHex);
      ctx.restore();

      // HP pips
      const pipW = 10;
      const totalW = t.maxHp * (pipW + 3) - 3;
      for (let i = 0; i < t.maxHp; i++) {
        ctx.fillStyle = i < t.hp ? t.colorHex : 'rgba(255,255,255,0.16)';
        ctx.fillRect(t.x - totalW / 2 + i * (pipW + 3), t.y + 24, pipW, 4);
      }

      drawNameplate(ctx, t.x, t.y - 38, t.slotIndex, t.name, t.colorHex);
    }
  }

  // 3D Ricochet shells
  for (const sh of snap.shells) {
    drawSphere3D(ctx, sh.x, sh.y, 7.5, sh.bounces > 0 ? '#FFB800' : sh.colorHex, '#FFFFFF', 6, true);
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
// 8. TURBO STRIKER RENDERER (2.5D Stadium Turf)
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

  drawStudioBackdrop(ctx, '#0A0E15', 'rgba(16, 217, 139, 0.07)', 'rgba(255,255,255,0.025)', 56);

  // Raised stadium pitch slab
  drawArenaSlab(ctx, left - 10, top - 10, pitchW + 20, pitchH + 20, 14, 16, '#122620', '#18242C', '#334155', 3);

  // Striped turf field
  const stripes = 10;
  const stripeW = pitchW / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#152F27' : '#19382E';
    ctx.fillRect(left + i * stripeW, top, stripeW + 0.5, pitchH);
  }

  // Recessed 3D Goals (Left = Red, Right = Blue)
  ctx.fillStyle = 'rgba(255, 77, 46, 0.24)';
  ctx.fillRect(left - goalDepth, cy - goalHalf, goalDepth, goalHalf * 2);
  ctx.strokeStyle = '#FF4D2E';
  ctx.lineWidth = 4;
  ctx.strokeRect(left - goalDepth, cy - goalHalf, goalDepth, goalHalf * 2);

  ctx.fillStyle = 'rgba(0, 194, 255, 0.24)';
  ctx.fillRect(right, cy - goalHalf, goalDepth, goalHalf * 2);
  ctx.strokeStyle = '#00C2FF';
  ctx.lineWidth = 4;
  ctx.strokeRect(right, cy - goalHalf, goalDepth, goalHalf * 2);

  // Goal net crosshatch
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gy = cy - goalHalf + 16; gy < cy + goalHalf; gy += 16) {
    ctx.moveTo(left - goalDepth, gy);
    ctx.lineTo(left, gy);
    ctx.moveTo(right, gy);
    ctx.lineTo(right + goalDepth, gy);
  }
  ctx.stroke();

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

  ctx.strokeRect(left, cy - 155, 130, 310);
  ctx.strokeRect(right - 130, cy - 155, 130, 310);

  // Top & Bottom 2.5D perimeter walls (raised look)
  drawExtrudedBox3D(ctx, left - 4, top - 6, pitchW + 8, 8, 6, 3, '#E2E8F0', '#94A3B8', '#FFFFFF', false);

  // Side walls (open goal mouths)
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(left, cy - goalHalf);
  ctx.lineTo(left, top);
  ctx.moveTo(right, top);
  ctx.lineTo(right, cy - goalHalf);
  ctx.moveTo(right, cy + goalHalf);
  ctx.lineTo(right, bottom);
  ctx.lineTo(left, bottom);
  ctx.lineTo(left, cy + goalHalf);
  ctx.stroke();

  // Goal posts (3D cylinders)
  drawExtrudedCylinder3D(ctx, left, cy - goalHalf, 6, 12, '#FFFFFF', '#94A3B8', '#FF4D2E');
  drawExtrudedCylinder3D(ctx, left, cy + goalHalf, 6, 12, '#FFFFFF', '#94A3B8', '#FF4D2E');
  drawExtrudedCylinder3D(ctx, right, cy - goalHalf, 6, 12, '#FFFFFF', '#94A3B8', '#00C2FF');
  drawExtrudedCylinder3D(ctx, right, cy + goalHalf, 6, 12, '#FFFFFF', '#94A3B8', '#00C2FF');

  // Golden Time glow border on pitch
  if (snap.goldenTime) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 184, 0, 0.72)';
    ctx.lineWidth = 5;
    ctx.strokeRect(left - 2, top - 2, pitchW + 4, pitchH + 4);
    ctx.restore();
  }

  // Pitch Powerups
  const puPulse = Math.sin(Date.now() * 0.007) * 3;
  for (const pu of snap.powerups ?? []) {
    const col = pu.kind === 'mega-kick' ? '#FF7A00' : pu.kind === 'speed' ? '#10D98B' : '#FFB800';
    const txt = pu.kind === 'mega-kick' ? '⚡' : pu.kind === 'speed' ? 'SPD' : '2●';
    drawShadowOval(ctx, pu.x, pu.y + 8, 16, 10, 0.35);
    drawExtrudedCylinder3D(ctx, pu.x, pu.y + puPulse * 0.4, 17, 7, shadeHex(col, -0.2), shadeHex(col, -0.5), col);
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tCanvas(txt), pu.x, pu.y - 4 + puPulse * 0.4);
    ctx.restore();
  }

  // Y-sort strikers, soccer ball, and bonus balls
  const b = snap.ball;
  const bonusBalls = snap.bonusBalls ?? [];
  type PitchItem =
    | { kind: 'player'; y: number; p: (typeof snap.players)[number] }
    | { kind: 'ball'; y: number }
    | { kind: 'bonusBall'; y: number; bb: (typeof bonusBalls)[number] };
  const pitchItems: PitchItem[] = [
    ...snap.players.map((p) => ({ kind: 'player' as const, y: p.y, p })),
    { kind: 'ball' as const, y: b.y },
    ...bonusBalls.map((bb) => ({ kind: 'bonusBall' as const, y: bb.y, bb })),
  ];
  pitchItems.sort((a, bItem) => a.y - bItem.y);

  for (const item of pitchItems) {
    if (item.kind === 'ball') {
      drawSphere3D(ctx, b.x, b.y, b.radius, '#F8FAFC', b.lastTouchColor ?? '#121419', 4, true);
      ctx.save();
      ctx.fillStyle = '#1E2430';
      ctx.beginPath();
      ctx.arc(b.x, b.y - 4, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (item.kind === 'bonusBall') {
      const bb = item.bb;
      drawSphere3D(ctx, bb.x, bb.y, bb.radius, '#FDE047', bb.lastTouchColor ?? '#B45309', 4, true);
      ctx.save();
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(bb.x, bb.y - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      const p = item.p;
      const teamColor = p.team === 'red' ? '#FF4D2E' : '#00C2FF';
      ctx.save();
      if (p.kickRingTimer > 0) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.globalAlpha = p.kickRingTimer * 3.5;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 26 + (0.24 - p.kickRingTimer) * 160, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if ((p.megaKickTimer ?? 0) > 0) {
        ctx.strokeStyle = '#FF7A00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 28, 0, Math.PI * 2);
        ctx.stroke();
      }
      if ((p.speedTimer ?? 0) > 0) {
        ctx.strokeStyle = '#10D98B';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 33, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (p.tackleTimer > 0) {
        ctx.fillStyle = teamColor;
        ctx.globalAlpha = 0.32;
        ctx.beginPath();
        ctx.arc(p.x - Math.cos(p.angle) * 14, p.y - Math.sin(p.angle) * 14, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      drawCharacterPod3D(ctx, p.x, p.y, 21, p.angle, p.colorHex, {
        height: 11,
        rimColor: teamColor,
        collarColor: shadeHex(teamColor, -0.45),
        visorColor: '#FFFFFF',
      });

      drawNameplate(
        ctx,
        p.x,
        p.y - 38,
        p.slotIndex,
        p.name,
        teamColor,
        p.team === 'red' ? 'RED' : 'BLUE'
      );
    }
  }

  // Bottom perimeter 3D wall rendered in front of pitch edge
  drawExtrudedBox3D(ctx, left - 4, bottom - 2, pitchW + 8, 8, 6, 3, '#E2E8F0', '#94A3B8', '#FFFFFF', false);

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
  ctx.fillText(tCanvas(`RED ${snap.scoreRed}`), ARENA_WIDTH / 2 - 48, 30);

  ctx.fillStyle = snap.timeLeft <= 10 ? '#FFB800' : '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.fillText(`${mm}:${ss}`, ARENA_WIDTH / 2, 30);

  ctx.fillStyle = '#00C2FF';
  ctx.textAlign = 'left';
  ctx.fillText(tCanvas(`${snap.scoreBlue} BLUE`), ARENA_WIDTH / 2 + 48, 30);
  ctx.restore();

  if (snap.goldenTime) {
    drawHudChip(ctx, ARENA_WIDTH - 224, 14, 202, 'GOLDEN TIME  2X', '#FFB800', 'rgba(255,184,0,0.65)');
  }
  drawPopupTexts(ctx, snap.popups);

  if (snap.goalBanner) {
    drawCenterBanner(ctx, snap.goalBanner, snap.goalBannerColor ?? '#FFB800');
  }
}

// ============================================================
// 9. PAINT RUSH RENDERER (2.5D Beveled Paint Tiles & Rollers)
// ============================================================
export function renderPaintRush(ctx: CanvasRenderingContext2D, snap: PaintRushSnapshot): void {
  const cellW = ARENA_WIDTH / snap.cols;
  const cellH = ARENA_HEIGHT / snap.rows;

  const slotColor = PLAYER_PALETTE.map((c) => c.hex);
  for (const p of snap.players) {
    slotColor[p.slotIndex] = p.colorHex;
  }

  ctx.fillStyle = '#12161F';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  for (let r = 0; r < snap.rows; r++) {
    const y = r * cellH;
    for (let c = 0; c < snap.cols; c++) {
      const owner = snap.grid[r * snap.cols + c];
      const x = c * cellW;
      if (owner >= 0) {
        const col = slotColor[owner] ?? '#FF3B9A';
        // Subtle 3D raised wet-paint tile lip
        ctx.fillStyle = shadeHex(col, -0.35);
        ctx.beginPath();
        ctx.roundRect(x + 1.5, y + 3.5, cellW - 3, cellH - 3, 4);
        ctx.fill();

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(x + 1.5, y + 1, cellW - 3, cellH - 4, 4);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(x + 4, y + 2.5, cellW - 8, 4.5);
      } else {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#1C222D' : '#171C26';
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      }
    }
  }

  // Golden bonus tiles overlay
  const bonusSet = new Set(snap.bonusCells ?? []);
  if (bonusSet.size > 0) {
    const pulse = 0.55 + Math.sin(Date.now() * 0.008) * 0.25;
    ctx.save();
    for (const idx of bonusSet) {
      const r = Math.floor(idx / snap.cols);
      const c = idx % snap.cols;
      const x = c * cellW;
      const y = r * cellH;
      ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 2.5, y + 2.5, cellW - 5, cellH - 5);
      ctx.fillStyle = `rgba(255, 225, 100, ${pulse})`;
      ctx.font = '900 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', x + cellW / 2, y + cellH / 2);
    }
    ctx.restore();
  }

  // Paint pickups
  const pkBob = Math.sin(Date.now() * 0.006) * 3;
  for (const pk of snap.pickups ?? []) {
    const col = pk.kind === 'wide' ? '#00C2FF' : pk.kind === 'bomb' ? '#FF3B9A' : '#10D98B';
    const label = pk.kind === 'wide' ? 'W' : pk.kind === 'bomb' ? 'B' : '⚡';
    drawShadowOval(ctx, pk.x, pk.y + 8, 16, 10, 0.35);
    drawExtrudedCylinder3D(ctx, pk.x, pk.y + pkBob * 0.5, 16, 8, shadeHex(col, -0.2), shadeHex(col, -0.5), col);
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tCanvas(label), pk.x, pk.y - 4 + pkBob * 0.5);
    ctx.restore();
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

  // Paint rollers / bots (Y-sorted)
  const bots = [...snap.players].sort((a, b) => a.y - b.y);
  for (const p of bots) {
    ctx.save();
    // Roller shadow + 3D roller cylinder positioned ahead
    const rx = p.x + Math.cos(p.angle) * 18;
    const ry = p.y + Math.sin(p.angle) * 18;
    drawShadowOval(ctx, rx + 2, ry + 5, 16, 16, 0.32);

    ctx.save();
    ctx.translate(p.x, p.y - 4);
    ctx.rotate(p.angle);

    // 3D cylindrical paint roller drum
    ctx.fillStyle = shadeHex(p.colorHex, -0.38);
    ctx.beginPath();
    ctx.roundRect(12, -19, 12, 38, 5);
    ctx.fill();

    const rollGrad = ctx.createLinearGradient(12, -19, 12, 19);
    rollGrad.addColorStop(0, shadeHex(p.colorHex, 0.35));
    rollGrad.addColorStop(0.45, p.colorHex);
    rollGrad.addColorStop(1, shadeHex(p.colorHex, -0.35));
    ctx.fillStyle = rollGrad;
    ctx.beginPath();
    ctx.roundRect(11, -20, 11, 37, 5);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Roller end-caps
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(14, -21, 5, 3);
    ctx.fillRect(14, 15, 5, 3);
    ctx.restore();

    drawCharacterPod3D(ctx, p.x, p.y, 19, p.angle, p.colorHex, {
      height: 11,
      rimColor: '#FFFFFF',
      showVisor: false,
    });

    if ((p.wideTimer ?? 0) > 0) {
      ctx.strokeStyle = '#00C2FF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 4, 29, 0, Math.PI * 2);
      ctx.stroke();
    }
    if ((p.turboTimer ?? 0) > 0) {
      ctx.strokeStyle = '#10D98B';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y - 4, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Center cap on pod top
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 11, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawNameplate(
      ctx,
      p.x,
      p.y - 40,
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

  drawPopupTexts(ctx, snap.popups);
}

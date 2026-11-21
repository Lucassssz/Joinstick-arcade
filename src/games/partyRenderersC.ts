import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BombGridSnapshot,
  type DishKind,
  type FruitDropSnapshot,
  type KitchenRushSnapshot,
  type PinballClashSnapshot,
  type RedLightDashSnapshot,
} from '../shared/types';
import { drawNameplate, tCanvas } from './renderers';

function drawHudChip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, accent = '#FFB800'): void {
  const label = tCanvas(text);
  ctx.save();
  ctx.font = '800 13px "JetBrains Mono", monospace';
  const w = Math.max(96, ctx.measureText(label).width + 24);
  const h = 28;
  ctx.fillStyle = 'rgba(13, 15, 20, 0.88)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + h / 2 + 0.5);
  ctx.restore();
}

function drawBanner(ctx: CanvasRenderingContext2D, text: string, accent = '#FFB800', y = ARENA_HEIGHT / 2): void {
  const label = tCanvas(text);
  ctx.save();
  ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
  const w = Math.min(ARENA_WIDTH - 100, Math.max(300, ctx.measureText(label).width + 64));
  const h = 60;
  ctx.fillStyle = 'rgba(13, 15, 20, 0.94)';
  ctx.beginPath();
  ctx.roundRect(ARENA_WIDTH / 2 - w / 2, y - h / 2, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, ARENA_WIDTH / 2, y + 1);
  ctx.restore();
}

// ============================================================
// 23. BOMB GRID (Bomberman-Style Maze)
// ============================================================
export function renderBombGrid(ctx: CanvasRenderingContext2D, snap: BombGridSnapshot): void {
  ctx.fillStyle = '#101319';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  const cell = 68;
  const gridLeft = Math.floor((ARENA_WIDTH - snap.cols * cell) / 2);
  const gridTop = Math.floor((ARENA_HEIGHT - snap.rows * cell) / 2) + 14;

  // Floor & Walls
  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const x = gridLeft + c * cell;
      const y = gridTop + r * cell;
      const val = snap.cells[r * snap.cols + c];

      ctx.fillStyle = (r + c) % 2 === 0 ? '#1B202A' : '#171C24';
      ctx.fillRect(x, y, cell, cell);

      if (val === 1) {
        // Solid steel block
        ctx.fillStyle = '#333C4D';
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 3, cell - 6, cell - 6, 8);
        ctx.fill();
        ctx.strokeStyle = '#526078';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (val === 2) {
        // Wooden crate
        ctx.fillStyle = '#8C582B';
        ctx.beginPath();
        ctx.roundRect(x + 4, y + 4, cell - 8, cell - 8, 8);
        ctx.fill();
        ctx.strokeStyle = '#C48447';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 10);
        ctx.lineTo(x + cell - 10, y + cell - 10);
        ctx.moveTo(x + cell - 10, y + 10);
        ctx.lineTo(x + 10, y + cell - 10);
        ctx.stroke();
      }
    }
  }

  // Powerups
  for (const pu of snap.powerups) {
    const cx = gridLeft + (pu.col + 0.5) * cell;
    const cy = gridTop + (pu.row + 0.5) * cell;
    const col = pu.kind === 'flame' ? '#FF7A1A' : pu.kind === 'bomb' ? '#00C2FF' : '#9EE622';
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#0D0F14';
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.kind === 'flame' ? 'F+' : pu.kind === 'bomb' ? 'B+' : 'S+', cx, cy + 0.5);
    ctx.restore();
  }

  // Bombs
  for (const bm of snap.bombs) {
    const pulse = 1 + Math.sin(performance.now() * 0.025) * 0.1;
    ctx.save();
    ctx.translate(bm.x, bm.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#181B22';
    ctx.beginPath();
    ctx.arc(0, 2, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = bm.colorHex;
    ctx.lineWidth = 3;
    ctx.stroke();
    // Sparking fuse
    ctx.fillStyle = '#FFB800';
    ctx.beginPath();
    ctx.arc(8, -18, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Flames
  for (const fl of snap.flames) {
    const x = gridLeft + fl.col * cell;
    const y = gridTop + fl.row * cell;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fl.alpha);
    ctx.fillStyle = '#FF7A1A';
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, cell - 8, cell - 8, 12);
    ctx.fill();
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.roundRect(x + 14, y + 14, cell - 28, cell - 28, 8);
    ctx.fill();
    ctx.restore();
  }

  // Players
  for (const p of snap.players) {
    if (!p.alive) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Visor direction indicator
    ctx.fillStyle = '#0F131A';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 8, Math.sin(p.angle) * 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawNameplate(ctx, p.x, p.y - 34, p.slotIndex, p.name, p.colorHex);
  }

  drawHudChip(ctx, ARENA_WIDTH / 2, 12, `ROUND ${snap.round}/${snap.totalRounds} · ${Math.ceil(snap.roundTimer)}s`, '#FF7A1A');
  if (snap.roundBanner) drawBanner(ctx, snap.roundBanner, '#FF7A1A');
}

// ============================================================
// 24. RED LIGHT DASH (Stop & Go Sprint)
// ============================================================
export function renderRedLightDash(ctx: CanvasRenderingContext2D, snap: RedLightDashSnapshot): void {
  // Stadium track floor
  ctx.fillStyle = '#121821';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  const trackTop = 94;
  const trackBottom = ARENA_HEIGHT - 64;

  // Running lanes
  const lanes = 6;
  const laneH = (trackBottom - trackTop) / lanes;
  for (let i = 0; i < lanes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1B2532' : '#17202B';
    ctx.fillRect(60, trackTop + i * laneH, snap.finishX - 40, laneH);
  }

  // Start line
  ctx.fillStyle = '#334155';
  ctx.fillRect(snap.startX - 4, trackTop, 8, trackBottom - trackTop);

  // Checkered Finish line
  const sq = 16;
  for (let y = trackTop; y < trackBottom; y += sq) {
    const idx = Math.floor((y - trackTop) / sq);
    ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#111827';
    ctx.fillRect(snap.finishX, y, sq, Math.min(sq, trackBottom - y));
    ctx.fillStyle = idx % 2 === 1 ? '#FFFFFF' : '#111827';
    ctx.fillRect(snap.finishX + sq, y, sq, Math.min(sq, trackBottom - y));
  }

  // Red scanning overlay when Red Light is active
  if (snap.lightState === 'red') {
    ctx.fillStyle = 'rgba(255, 77, 46, 0.12)';
    ctx.fillRect(60, trackTop, snap.finishX - 60, trackBottom - trackTop);
  }

  // Giant Traffic-Light Robot Mascot on the right
  const rx = 1126;
  const ry = ARENA_HEIGHT / 2;
  ctx.save();
  ctx.fillStyle = '#1E2532';
  ctx.beginPath();
  ctx.roundRect(rx - 44, ry - 122, 88, 244, 22);
  ctx.fill();
  ctx.strokeStyle =
    snap.lightState === 'green' ? '#10D98B' : snap.lightState === 'yellow' ? '#FFB800' : '#FF4D2E';
  ctx.lineWidth = 4;
  ctx.stroke();

  const lights: { cy: number; active: boolean; on: string; off: string }[] = [
    { cy: ry - 70, active: snap.lightState === 'red', on: '#FF4D2E', off: '#3B1816' },
    { cy: ry, active: snap.lightState === 'yellow', on: '#FFB800', off: '#3B2F12' },
    { cy: ry + 70, active: snap.lightState === 'green', on: '#10D98B', off: '#123629' },
  ];
  for (const l of lights) {
    ctx.fillStyle = l.active ? l.on : l.off;
    ctx.beginPath();
    ctx.arc(rx, l.cy, 26, 0, Math.PI * 2);
    ctx.fill();
    if (l.active) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  ctx.restore();

  // Zap laser lines
  for (const z of snap.zapLines) {
    ctx.save();
    ctx.strokeStyle = '#FF4D2E';
    ctx.globalAlpha = Math.max(0, z.alpha);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(rx - 40, ry - 70);
    ctx.lineTo(z.x, z.y);
    ctx.stroke();
    ctx.restore();
  }

  // Runners
  for (const p of snap.players) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.shieldTimer > 0) {
      ctx.strokeStyle = '#00C2FF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 29, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.sprintTimer > 0) {
      ctx.strokeStyle = '#10D98B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-36, -8);
      ctx.lineTo(-18, -8);
      ctx.moveTo(-42, 6);
      ctx.lineTo(-20, 6);
      ctx.stroke();
    }
    ctx.fillStyle = p.zappedTimer > 0 ? '#FF4D2E' : p.colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    drawNameplate(ctx, p.x, p.y - 34, p.slotIndex, p.name, p.colorHex, p.finished ? `#${p.finishOrder}` : undefined);
  }

  const lightWord =
    snap.lightState === 'green' ? 'GREEN LIGHT — RUN!' : snap.lightState === 'yellow' ? 'YELLOW — SLOW DOWN!' : 'RED LIGHT — FREEZE!';
  const lightAccent = snap.lightState === 'green' ? '#10D98B' : snap.lightState === 'yellow' ? '#FFB800' : '#FF4D2E';
  drawHudChip(ctx, ARENA_WIDTH / 2, 18, `${lightWord} · ${Math.ceil(snap.roundTimer)}s`, lightAccent);
  drawHudChip(ctx, 130, 18, `RACE ${snap.round}/${snap.totalRounds}`, '#528BFF');

  if (snap.banner) drawBanner(ctx, snap.banner, lightAccent);
}

// ============================================================
// 26. KITCHEN RUSH (Party Cooking Scramble)
// ============================================================
function drawDishIcon(ctx: CanvasRenderingContext2D, dish: DishKind, x: number, y: number, cooked: boolean, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (cooked) {
    // Serving plate
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  if (dish === 'burger') {
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.roundRect(-12, -10, 24, 9, 4);
    ctx.fill();
    ctx.fillStyle = cooked ? '#78350F' : '#FCA5A5';
    ctx.fillRect(-13, -1, 26, 6);
    ctx.fillStyle = '#10D98B';
    ctx.fillRect(-12, 5, 24, 3);
    ctx.fillStyle = '#D97706';
    ctx.fillRect(-12, 8, 24, 4);
  } else if (dish === 'pizza') {
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(13, 12);
    ctx.lineTo(-13, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = cooked ? '#EF4444' : '#FCA5A5';
    ctx.beginPath();
    ctx.arc(-3, 2, 3, 0, Math.PI * 2);
    ctx.arc(4, 5, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Taco
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(0, 6, 13, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = cooked ? '#EA580C' : '#94A3B8';
    ctx.fillRect(-9, 1, 18, 5);
  }
  ctx.restore();
}

export function renderKitchenRush(ctx: CanvasRenderingContext2D, snap: KitchenRushSnapshot): void {
  // Warm checkered tile kitchen floor
  ctx.fillStyle = '#1A1817';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  const sq = 48;
  for (let y = 96; y < ARENA_HEIGHT; y += sq) {
    for (let x = 0; x < ARENA_WIDTH; x += sq) {
      ctx.fillStyle = (Math.floor(x / sq) + Math.floor(y / sq)) % 2 === 0 ? '#24211E' : '#1E1B18';
      ctx.fillRect(x, y, sq, sq);
    }
  }

  // Top Order Tickets Strip
  ctx.fillStyle = '#13151C';
  ctx.fillRect(0, 0, ARENA_WIDTH, 96);
  ctx.strokeStyle = '#2B3140';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 96);
  ctx.lineTo(ARENA_WIDTH, 96);
  ctx.stroke();

  snap.orders.forEach((ord, idx) => {
    const ox = 28 + idx * 210;
    const oy = 14;
    ctx.fillStyle = '#1E232F';
    ctx.beginPath();
    ctx.roundRect(ox, oy, 192, 68, 12);
    ctx.fill();
    ctx.strokeStyle = ord.timeLeft < 7 ? '#FF4D2E' : '#FFB800';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawDishIcon(ctx, ord.dish, ox + 36, oy + 32, true, 1.05);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(tCanvas(ord.dish.toUpperCase()), ox + 66, oy + 26);

    // Order freshness bar
    ctx.fillStyle = '#0E1117';
    ctx.fillRect(ox + 66, oy + 42, 108, 10);
    ctx.fillStyle = ord.timeLeft < 7 ? '#FF4D2E' : '#10D98B';
    ctx.fillRect(ox + 66, oy + 42, 108 * Math.max(0, ord.timeLeft / ord.maxTime), 10);
  });

  drawHudChip(ctx, ARENA_WIDTH - 120, 32, `TIME ${Math.ceil(snap.timeLeft)}s`, '#FF7A1A');

  // Stations
  for (const st of snap.stations) {
    ctx.save();
    const isServe = st.kind === 'serve';
    const isGrill = st.kind === 'grill';
    ctx.fillStyle = isServe ? '#153A2E' : isGrill ? '#3A1F1B' : '#2C261F';
    ctx.beginPath();
    ctx.roundRect(st.x, st.y, st.w, st.h, 14);
    ctx.fill();
    ctx.strokeStyle = isServe ? '#10D98B' : isGrill ? '#FF7A1A' : '#B48852';
    ctx.lineWidth = 3;
    ctx.stroke();

    const cx = st.x + st.w / 2;
    const cy = st.y + st.h / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (st.kind === 'raw-burger' || st.kind === 'raw-pizza' || st.kind === 'raw-taco') {
      const dish: DishKind = st.kind === 'raw-burger' ? 'burger' : st.kind === 'raw-pizza' ? 'pizza' : 'taco';
      drawDishIcon(ctx, dish, cx, cy - 8, false, 1.35);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(tCanvas(dish.toUpperCase()), cx, st.y + st.h - 14);
    } else if (isGrill) {
      if (st.cookingDish) {
        drawDishIcon(ctx, st.cookingDish, cx, cy - 6, st.cookProgress >= 1, 1.25);
        // Progress bar
        ctx.fillStyle = '#11141B';
        ctx.fillRect(st.x + 18, st.y + st.h - 18, st.w - 36, 9);
        ctx.fillStyle = st.cookProgress >= 1 ? '#10D98B' : '#FFB800';
        ctx.fillRect(st.x + 18, st.y + st.h - 18, (st.w - 36) * st.cookProgress, 9);
      } else {
        ctx.fillStyle = '#FF7A1A';
        ctx.font = '800 13px "JetBrains Mono", monospace';
        ctx.fillText(tCanvas('GRILL'), cx, cy);
      }
    } else {
      ctx.fillStyle = '#10D98B';
      ctx.font = '800 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(tCanvas('SERVE'), cx, cy - 10);
      ctx.fillStyle = '#A7F3D0';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillText(tCanvas('A / TOSS B'), cx, cy + 16);
    }
    ctx.restore();
  }

  // Flying tossed plates
  for (const fp of snap.flyingPlates) {
    drawDishIcon(ctx, fp.dish, fp.x, fp.y, true, 1.15);
  }

  // Chefs
  for (const p of snap.players) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Little white chef hat
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, -10, 9, 0, Math.PI * 2);
    ctx.fill();
    if (p.holding) {
      drawDishIcon(ctx, p.holding.dish, Math.cos(p.angle) * 24, Math.sin(p.angle) * 24, p.holding.cooked, 0.95);
    }
    ctx.restore();
    drawNameplate(ctx, p.x, p.y - 38, p.slotIndex, p.name, p.colorHex);
  }

  // Popups
  for (const pp of snap.popups) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pp.alpha);
    ctx.font = '800 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = pp.colorHex;
    ctx.fillText(tCanvas(pp.text), pp.x, pp.y);
    ctx.restore();
  }
}

// ============================================================
// 28. FRUIT DROP FRENZY (Sky Catcher)
// ============================================================
export function renderFruitDrop(ctx: CanvasRenderingContext2D, snap: FruitDropSnapshot): void {
  // Twilight arcade sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
  sky.addColorStop(0, '#131629');
  sky.addColorStop(0.75, '#1F233A');
  sky.addColorStop(1, '#261F1C');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Wooden arcade stage deck
  ctx.fillStyle = '#38261B';
  ctx.fillRect(0, ARENA_HEIGHT - 76, ARENA_WIDTH, 76);
  ctx.fillStyle = '#FFB800';
  ctx.fillRect(0, ARENA_HEIGHT - 78, ARENA_WIDTH, 4);

  // Falling items
  for (const it of snap.items) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot);
    if (it.kind === 'pineapple') {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.ellipse(0, 4, 15, 19, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#10D98B';
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(-10, -10);
      ctx.lineTo(10, -10);
      ctx.closePath();
      ctx.fill();
    } else if (it.kind === 'watermelon') {
      ctx.fillStyle = '#10D98B';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FF4D2E';
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    } else if (it.kind === 'berry') {
      ctx.fillStyle = '#FF3B9A';
      ctx.beginPath();
      ctx.arc(0, 2, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9EE622';
      ctx.fillRect(-5, -18, 10, 6);
    } else if (it.kind === 'star') {
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 22 : 10;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Spiky bomb
      ctx.fillStyle = '#1F2937';
      ctx.beginPath();
      ctx.arc(0, 2, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FF4D2E';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#FF4D2E';
      ctx.beginPath();
      ctx.arc(0, -18, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Bounce shockwaves
  for (const w of snap.bounceWaves) {
    ctx.save();
    ctx.strokeStyle = w.colorHex;
    ctx.globalAlpha = Math.max(0, w.alpha);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.radius, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Players & Baskets
  for (const p of snap.players) {
    ctx.save();
    ctx.translate(p.x, p.y);
    // Woven basket
    ctx.fillStyle = '#C88D44';
    ctx.beginPath();
    ctx.roundRect(-34, -26, 68, 24, 8);
    ctx.fill();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    // Character badge beneath basket
    ctx.fillStyle = p.stunTimer > 0 ? '#64748B' : p.colorHex;
    ctx.beginPath();
    ctx.arc(0, 10, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawNameplate(ctx, p.x, p.y + 42, p.slotIndex, p.name, p.colorHex, p.combo > 1 ? `x${p.combo}` : undefined);
  }

  // Popups
  for (const pp of snap.popups) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pp.alpha);
    ctx.font = '800 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = pp.colorHex;
    ctx.fillText(tCanvas(pp.text), pp.x, pp.y);
    ctx.restore();
  }

  drawHudChip(ctx, ARENA_WIDTH / 2, 16, `TIME ${Math.ceil(snap.timeLeft)}s`, '#9EE622');
}

// ============================================================
// 30. PINBALL CLASH (1v1 Arcade Table Duel)
// ============================================================
export function renderPinballClash(ctx: CanvasRenderingContext2D, snap: PinballClashSnapshot): void {
  ctx.fillStyle = '#0B0E14';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  const left = 64;
  const right = ARENA_WIDTH - 64;
  const top = 64;
  const bottom = ARENA_HEIGHT - 64;
  const goalHalf = 148;

  // Metallic Pinball Playfield
  ctx.fillStyle = '#151A24';
  ctx.beginPath();
  ctx.roundRect(left, top, right - left, bottom - top, 18);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Center lane lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ARENA_WIDTH / 2, top);
  ctx.lineTo(ARENA_WIDTH / 2, bottom);
  ctx.stroke();

  // Left & Right Goal Mouths
  ctx.fillStyle = 'rgba(0, 194, 255, 0.25)';
  ctx.fillRect(left - 8, ARENA_HEIGHT / 2 - goalHalf, 12, goalHalf * 2);
  ctx.fillStyle = 'rgba(255, 77, 46, 0.25)';
  ctx.fillRect(right - 4, ARENA_HEIGHT / 2 - goalHalf, 12, goalHalf * 2);

  // Multiball Charge Gauge at bottom center
  const gw = 220;
  ctx.fillStyle = '#0D1017';
  ctx.beginPath();
  ctx.roundRect(ARENA_WIDTH / 2 - gw / 2, bottom + 16, gw, 16, 8);
  ctx.fill();
  ctx.fillStyle = '#FFB800';
  ctx.beginPath();
  ctx.roundRect(ARENA_WIDTH / 2 - gw / 2 + 2, bottom + 18, (gw - 4) * snap.multiballCharge, 12, 6);
  ctx.fill();
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tCanvas('MULTIBALL CHARGE'), ARENA_WIDTH / 2, bottom + 48);

  // Glowing Bumpers
  for (const bm of snap.bumpers) {
    ctx.save();
    const scale = 1 + bm.flash * 0.24;
    ctx.translate(bm.x, bm.y);
    ctx.scale(scale, scale);
    ctx.fillStyle = bm.flash > 0.1 ? '#FFFFFF' : bm.colorHex;
    ctx.beginPath();
    ctx.arc(0, 0, bm.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111622';
    ctx.beginPath();
    ctx.arc(0, 0, bm.r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(bm.value), 0, 0.5);
    ctx.restore();
  }

  // Flippers
  for (const p of snap.players) {
    ctx.save();
    if (p.bumpTimer > 0) {
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 110 * (1 - p.bumpTimer / 0.3) + 40, 0, Math.PI * 2);
      ctx.stroke();
    }
    const kickX = p.flipTimer > 0 ? (p.side === 'left' ? 16 : -16) : 0;
    ctx.fillStyle = p.flipTimer > 0 ? '#FFFFFF' : p.colorHex;
    ctx.beginPath();
    ctx.roundRect(p.x - 12 + kickX, p.y - 56, 24, 112, 12);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    drawNameplate(ctx, p.x, p.y - 74, p.slotIndex, p.name, p.colorHex);
  }

  // Pinballs & Trails
  for (const ball of snap.balls) {
    for (let i = 0; i < ball.trail.length; i++) {
      const pt = ball.trail[i];
      ctx.save();
      ctx.globalAlpha = ((i + 1) / ball.trail.length) * 0.35;
      ctx.fillStyle = ball.golden ? '#FFB800' : ball.lastTouchColor ?? '#CBD5E1';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, ball.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = ball.golden ? '#FDE047' : '#E2E8F0';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ball.golden ? '#FF7A1A' : '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // Scoreboard HUD
  drawHudChip(
    ctx,
    ARENA_WIDTH / 2,
    18,
    `${snap.scoreLeft}  —  ${snap.scoreRight}  (FIRST TO ${snap.targetGoals})`,
    '#00C2FF'
  );
  if (snap.goalBanner) {
    drawBanner(ctx, snap.goalBanner, snap.goalBannerColor ?? '#FFB800');
  }
}

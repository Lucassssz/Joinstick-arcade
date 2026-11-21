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
import { drawNameplate, drawPopupTexts, tCanvas } from './renderers';
import {
  drawArenaSlab,
  drawCharacterPod3D,
  drawExtrudedBox3D,
  drawExtrudedCylinder3D,
  drawShadowOval,
  drawSphere3D,
  drawStudioBackdrop,
  shadeHex,
} from './render25d';

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
// 23. BOMB GRID (2.5D Extruded Bomberman Maze)
// ============================================================
export function renderBombGrid(ctx: CanvasRenderingContext2D, snap: BombGridSnapshot): void {
  drawStudioBackdrop(ctx, '#0B0D12', 'rgba(255, 122, 26, 0.08)', 'rgba(255,255,255,0.025)', 48);

  const cell = 68;
  const gridW = snap.cols * cell;
  const gridH = snap.rows * cell;
  const gridLeft = Math.floor((ARENA_WIDTH - gridW) / 2);
  const gridTop = Math.floor((ARENA_HEIGHT - gridH) / 2) + 14;

  // Raised 2.5D maze platform slab
  drawArenaSlab(ctx, gridLeft - 8, gridTop - 8, gridW + 16, gridH + 16, 14, 16, '#151922', '#0D1017', '#334155', 3);

  // Checkerboard floor first
  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const x = gridLeft + c * cell;
      const y = gridTop + r * cell;
      ctx.fillStyle = (r + c) % 2 === 0 ? '#1C222D' : '#171C25';
      ctx.fillRect(x, y, cell, cell);
    }
  }

  // Y-sort blocks, crates, powerups, bombs, and players by bottom Y!
  type GridItem =
    | { kind: 'steel'; y: number; x: number; by: number }
    | { kind: 'crate'; y: number; x: number; by: number }
    | { kind: 'pu'; y: number; pu: (typeof snap.powerups)[number] }
    | { kind: 'bomb'; y: number; bm: (typeof snap.bombs)[number] }
    | { kind: 'player'; y: number; p: (typeof snap.players)[number] };

  const items: GridItem[] = [];
  for (let r = 0; r < snap.rows; r++) {
    for (let c = 0; c < snap.cols; c++) {
      const val = snap.cells[r * snap.cols + c];
      const x = gridLeft + c * cell;
      const by = gridTop + r * cell;
      if (val === 1) items.push({ kind: 'steel', y: by + cell, x, by });
      else if (val === 2) items.push({ kind: 'crate', y: by + cell, x, by });
    }
  }
  for (const pu of snap.powerups) {
    items.push({ kind: 'pu', y: gridTop + (pu.row + 0.5) * cell, pu });
  }
  for (const bm of snap.bombs) {
    items.push({ kind: 'bomb', y: bm.y + 10, bm });
  }
  for (const p of snap.players) {
    if (p.alive) items.push({ kind: 'player', y: p.y + 12, p });
  }
  items.sort((a, b) => a.y - b.y);

  const pulse = Math.sin(performance.now() * 0.025);
  for (const it of items) {
    if (it.kind === 'steel') {
      drawExtrudedBox3D(
        ctx,
        it.x + 3,
        it.by + 3,
        cell - 6,
        cell - 6,
        16,
        8,
        '#3D485E',
        '#202736',
        '#64748B'
      );
      // Corner steel rivets on top face
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(it.x + 10, it.by - 8, 4, 4);
      ctx.fillRect(it.x + cell - 14, it.by - 8, 4, 4);
    } else if (it.kind === 'crate') {
      drawExtrudedBox3D(
        ctx,
        it.x + 4,
        it.by + 4,
        cell - 8,
        cell - 8,
        14,
        8,
        '#9B6230',
        '#5B3616',
        '#D99B5A'
      );
      // Cross-brace on top face (shifted up by 14px)
      ctx.save();
      ctx.strokeStyle = '#C48447';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(it.x + 12, it.by - 4);
      ctx.lineTo(it.x + cell - 12, it.by + cell - 20);
      ctx.moveTo(it.x + cell - 12, it.by - 4);
      ctx.lineTo(it.x + 12, it.by + cell - 20);
      ctx.stroke();
      ctx.restore();
    } else if (it.kind === 'pu') {
      const { pu } = it;
      const cx = gridLeft + (pu.col + 0.5) * cell;
      const cy = gridTop + (pu.row + 0.5) * cell;
      const col =
        pu.kind === 'flame'
          ? '#FF7A1A'
          : pu.kind === 'bomb'
            ? '#00C2FF'
            : pu.kind === 'shield'
              ? '#38BDF8'
              : pu.kind === 'mega'
                ? '#FF3B9A'
                : '#9EE622';
      const txt =
        pu.kind === 'flame'
          ? 'F+'
          : pu.kind === 'bomb'
            ? 'B+'
            : pu.kind === 'shield'
              ? 'SHD'
              : pu.kind === 'mega'
                ? 'M+'
                : 'S+';
      const bob = Math.sin(performance.now() * 0.005 + cx) * 3;
      drawSphere3D(ctx, cx, cy, 17, col, '#FFFFFF', 5 + bob, true);
      ctx.save();
      ctx.fillStyle = '#0D0F14';
      ctx.font = '800 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tCanvas(txt), cx, cy - 5 - bob);
      ctx.restore();
    } else if (it.kind === 'bomb') {
      const { bm } = it;
      const sc = 1 + pulse * 0.09;
      drawSphere3D(ctx, bm.x, bm.y, 20 * sc, '#262C3B', bm.colorHex, 6, true);
      ctx.save();
      ctx.fillStyle = '#FFB800';
      ctx.beginPath();
      ctx.arc(bm.x + 9, bm.y - 24, 6 + pulse * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      const { p } = it;
      if (p.hasShield) {
        ctx.save();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 4, 27, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      drawCharacterPod3D(ctx, p.x, p.y, 20, p.angle, p.colorHex, {
        height: 12,
        rimColor: (p.megaBombs ?? 0) > 0 ? '#FF3B9A' : '#FFFFFF',
        visorColor: '#0F131A',
      });
      drawNameplate(ctx, p.x, p.y - 40, p.slotIndex, p.name, p.colorHex, (p.megaBombs ?? 0) > 0 ? 'MEGA' : undefined);
    }
  }

  // Explosion Flames
  for (const fl of snap.flames) {
    const x = gridLeft + fl.col * cell;
    const y = gridTop + fl.row * cell;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fl.alpha);
    ctx.fillStyle = '#FF7A1A';
    ctx.beginPath();
    ctx.roundRect(x + 4, y - 4, cell - 8, cell - 4, 12);
    ctx.fill();
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.roundRect(x + 14, y + 6, cell - 28, cell - 24, 8);
    ctx.fill();
    ctx.restore();
  }

  drawPopupTexts(ctx, snap.popups);

  drawHudChip(ctx, ARENA_WIDTH / 2, 12, `ROUND ${snap.round}/${snap.totalRounds} · ${Math.ceil(snap.roundTimer)}s${snap.suddenDeath ? ' · SHRINK!' : ''}`, snap.suddenDeath ? '#FF4D2E' : '#FF7A1A');
  if (snap.roundBanner) drawBanner(ctx, snap.roundBanner, '#FF7A1A');
}

// ============================================================
// 24. RED LIGHT DASH (2.5D Stadium Track & 3D Traffic Mascot)
// ============================================================
export function renderRedLightDash(ctx: CanvasRenderingContext2D, snap: RedLightDashSnapshot): void {
  drawStudioBackdrop(ctx, '#0D121A', 'rgba(16, 217, 139, 0.06)', 'rgba(255,255,255,0.025)', 52);

  const trackTop = 94;
  const trackBottom = ARENA_HEIGHT - 64;
  const trackH = trackBottom - trackTop;

  // Raised 2.5D stadium running track slab
  drawArenaSlab(ctx, 56, trackTop - 6, snap.finishX - 4, trackH + 12, 14, 16, '#18212E', '#0F151E', '#334155', 3);

  // Running lanes
  const lanes = 6;
  const laneH = trackH / lanes;
  for (let i = 0; i < lanes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1C2634' : '#17202C';
    ctx.fillRect(60, trackTop + i * laneH, snap.finishX - 40, laneH);
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(60, trackTop + i * laneH);
      ctx.lineTo(snap.finishX + 28, trackTop + i * laneH);
      ctx.stroke();
    }
  }

  // Start line
  ctx.fillStyle = '#475569';
  ctx.fillRect(snap.startX - 4, trackTop, 8, trackH);

  // Checkered Finish line
  const sq = 16;
  for (let y = trackTop; y < trackBottom; y += sq) {
    const idx = Math.floor((y - trackTop) / sq);
    ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#111827';
    ctx.fillRect(snap.finishX, y, sq, Math.min(sq, trackBottom - y));
    ctx.fillStyle = idx % 2 === 1 ? '#FFFFFF' : '#111827';
    ctx.fillRect(snap.finishX + sq, y, sq, Math.min(sq, trackBottom - y));
  }
  // 3D Finish Gate Pillars at top & bottom of finish line
  drawExtrudedCylinder3D(ctx, snap.finishX + 16, trackTop, 11, 22, '#F8FAFC', '#64748B', '#FFB800');
  drawExtrudedCylinder3D(ctx, snap.finishX + 16, trackBottom, 11, 22, '#F8FAFC', '#64748B', '#FFB800');

  // Sticky Mud Puddles & Golden Sprint Apples
  for (const pd of snap.puddles ?? []) {
    ctx.save();
    ctx.fillStyle = 'rgba(101, 67, 33, 0.72)';
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(pd.x, pd.y, pd.rx, pd.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  const apBob = Math.sin(performance.now() * 0.006) * 3;
  for (const ap of snap.apples ?? []) {
    drawShadowOval(ctx, ap.x, ap.y + 10, 12, 6, 0.35);
    drawSphere3D(ctx, ap.x, ap.y + apBob, 12, '#FFB800', '#FEF08A', 3, false);
    ctx.save();
    ctx.fillStyle = '#10D98B';
    ctx.beginPath();
    ctx.ellipse(ap.x + 3, ap.y - 12 + apBob, 5, 2.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Red scanning overlay when Red Light is active
  if (snap.lightState === 'red') {
    ctx.fillStyle = 'rgba(255, 77, 46, 0.14)';
    ctx.fillRect(60, trackTop, snap.finishX - 60, trackH);
  }

  // Giant Standing 3D Traffic-Light Robot Mascot on the right
  const rx = 1126;
  const ry = ARENA_HEIGHT / 2;
  const lightCol =
    snap.lightState === 'green' ? '#10D98B' : snap.lightState === 'yellow' ? '#FFB800' : '#FF4D2E';
  drawShadowOval(ctx, rx + 4, ry + 132, 48, 18, 0.5);
  drawExtrudedBox3D(ctx, rx - 44, ry - 116, 88, 236, 18, 22, '#242D3D', '#131822', lightCol);

  // Robot antenna
  drawExtrudedCylinder3D(ctx, rx, ry - 134, 7, 14, lightCol, shadeHex(lightCol, -0.45), '#FFFFFF');

  const lights: { cy: number; active: boolean; on: string; off: string }[] = [
    { cy: ry - 82, active: snap.lightState === 'red', on: '#FF4D2E', off: '#3B1816' },
    { cy: ry - 14, active: snap.lightState === 'yellow', on: '#FFB800', off: '#3B2F12' },
    { cy: ry + 54, active: snap.lightState === 'green', on: '#10D98B', off: '#123629' },
  ];
  for (const l of lights) {
    if (l.active) {
      drawSphere3D(ctx, rx, l.cy, 27, l.on, '#FFFFFF', 0, false);
    } else {
      ctx.fillStyle = l.off;
      ctx.beginPath();
      ctx.arc(rx, l.cy, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0D1017';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Zap laser lines
  for (const z of snap.zapLines) {
    ctx.save();
    ctx.strokeStyle = '#FF4D2E';
    ctx.globalAlpha = Math.max(0, z.alpha);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(rx - 40, ry - 82);
    ctx.lineTo(z.x, z.y - 8);
    ctx.stroke();
    ctx.restore();
  }

  // Y-sort Runners
  const runners = [...snap.players].sort((a, b) => a.y - b.y);
  for (const p of runners) {
    ctx.save();
    if (p.shieldTimer > 0) {
      ctx.strokeStyle = '#00C2FF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 4, 29, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.sprintTimer > 0) {
      ctx.strokeStyle = '#10D98B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - 38, p.y - 12);
      ctx.lineTo(p.x - 18, p.y - 12);
      ctx.moveTo(p.x - 44, p.y + 2);
      ctx.lineTo(p.x - 20, p.y + 2);
      ctx.stroke();
    }
    ctx.restore();

    drawCharacterPod3D(ctx, p.x, p.y, 19, 0, p.zappedTimer > 0 ? '#FF4D2E' : p.colorHex, {
      height: 11,
      rimColor: '#FFFFFF',
      visorColor: '#FFFFFF',
    });

    drawNameplate(ctx, p.x, p.y - 38, p.slotIndex, p.name, p.colorHex, p.finished ? `#${p.finishOrder}` : undefined);
  }

  drawPopupTexts(ctx, snap.popups);

  const lightWord =
    snap.lightState === 'green' ? 'GREEN LIGHT — RUN!' : snap.lightState === 'yellow' ? 'YELLOW — SLOW DOWN!' : 'RED LIGHT — FREEZE!';
  drawHudChip(ctx, ARENA_WIDTH / 2, 18, `${lightWord} · ${Math.ceil(snap.roundTimer)}s`, lightCol);
  drawHudChip(ctx, 130, 18, `RACE ${snap.round}/${snap.totalRounds}`, '#528BFF');

  if (snap.banner) drawBanner(ctx, snap.banner, lightCol);
}

// ============================================================
// 26. KITCHEN RUSH (2.5D Counters, Grills & Chef Toques)
// ============================================================
function drawDishIcon(ctx: CanvasRenderingContext2D, dish: DishKind, x: number, y: number, cooked: boolean, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (cooked) {
    // 3D beveled serving plate
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.arc(0, 2.5, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
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
  ctx.fillStyle = '#181615';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  const sq = 48;
  for (let y = 96; y < ARENA_HEIGHT; y += sq) {
    for (let x = 0; x < ARENA_WIDTH; x += sq) {
      ctx.fillStyle = (Math.floor(x / sq) + Math.floor(y / sq)) % 2 === 0 ? '#25211E' : '#1E1B18';
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
    drawArenaSlab(
      ctx,
      ox,
      oy,
      192,
      68,
      12,
      5,
      ord.vip ? '#2B2214' : '#1E232F',
      '#10131B',
      ord.timeLeft < 7 ? '#FF4D2E' : '#FFB800',
      ord.vip ? 2.6 : 2
    );

    drawDishIcon(ctx, ord.dish, ox + 36, oy + 32, true, 1.05);
    ctx.fillStyle = ord.vip ? '#FDE047' : '#FFFFFF';
    ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(tCanvas(ord.dish.toUpperCase()), ox + 66, oy + 26);
    if (ord.vip) {
      ctx.fillStyle = '#FFB800';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('VIP', ox + 178, oy + 26);
    }

    ctx.fillStyle = '#0E1117';
    ctx.fillRect(ox + 66, oy + 42, 108, 10);
    ctx.fillStyle = ord.timeLeft < 7 ? '#FF4D2E' : '#10D98B';
    ctx.fillRect(ox + 66, oy + 42, 108 * Math.max(0, ord.timeLeft / ord.maxTime), 10);
  });

  drawHudChip(ctx, ARENA_WIDTH - 120, 32, `TIME ${Math.ceil(snap.timeLeft)}s`, '#FF7A1A');

  // Chef Speed Boots pickups on kitchen floor
  for (const bt of snap.boots ?? []) {
    drawShadowOval(ctx, bt.x, bt.y + 10, 15, 6, 0.35);
    drawSphere3D(ctx, bt.x, bt.y, 15, '#00C2FF', '#E0F2FE', 5, true);
    ctx.save();
    ctx.fillStyle = '#0D0F14';
    ctx.font = '800 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPD', bt.x, bt.y - 5);
    ctx.restore();
  }

  // Y-sort 3D Kitchen Stations & Chefs
  type KitchenItem =
    | { kind: 'station'; y: number; st: (typeof snap.stations)[number] }
    | { kind: 'chef'; y: number; p: (typeof snap.players)[number] };
  const kItems: KitchenItem[] = [
    ...snap.stations.map((st) => ({ kind: 'station' as const, y: st.y + st.h, st })),
    ...snap.players.map((p) => ({ kind: 'chef' as const, y: p.y + 12, p })),
  ];
  kItems.sort((a, b) => a.y - b.y);

  const stDepth = 14;
  for (const it of kItems) {
    if (it.kind === 'station') {
      const { st } = it;
      const isServe = st.kind === 'serve';
      const isGrill = st.kind === 'grill';
      const topFill = isServe ? '#174536' : isGrill ? '#45231D' : '#362D23';
      const frontFill = isServe ? '#0D2920' : isGrill ? '#29130F' : '#211B14';
      const borderCol = isServe ? '#10D98B' : isGrill ? '#FF7A1A' : '#B48852';

      drawExtrudedBox3D(ctx, st.x, st.y, st.w, st.h, stDepth, 14, topFill, frontFill, borderCol);

      const cx = st.x + st.w / 2;
      const cy = st.y + st.h / 2 - stDepth;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (st.kind === 'raw-burger' || st.kind === 'raw-pizza' || st.kind === 'raw-taco') {
        const dish: DishKind = st.kind === 'raw-burger' ? 'burger' : st.kind === 'raw-pizza' ? 'pizza' : 'taco';
        drawDishIcon(ctx, dish, cx, cy - 6, false, 1.35);
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.fillText(tCanvas(dish.toUpperCase()), cx, st.y + st.h - stDepth - 14);
      } else if (isGrill) {
        if (st.cookingDish) {
          drawDishIcon(ctx, st.cookingDish, cx, cy - 6, st.cookProgress >= 1, 1.25);
          ctx.fillStyle = '#11141B';
          ctx.fillRect(st.x + 18, st.y + st.h - stDepth - 16, st.w - 36, 9);
          ctx.fillStyle = st.cookProgress >= 1 ? '#10D98B' : '#FFB800';
          ctx.fillRect(st.x + 18, st.y + st.h - stDepth - 16, (st.w - 36) * st.cookProgress, 9);
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
    } else {
      const { p } = it;
      const hasBoots = (p.bootsTimer ?? 0) > 0;
      if (hasBoots) {
        ctx.save();
        ctx.strokeStyle = '#00C2FF';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(p.x, p.y - 4, 29, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      drawCharacterPod3D(ctx, p.x, p.y, 20, p.angle, p.colorHex, {
        height: 12,
        rimColor: hasBoots ? '#00C2FF' : '#FFFFFF',
        hat: 'chef',
        showVisor: false,
      });
      if (p.holding) {
        drawDishIcon(
          ctx,
          p.holding.dish,
          p.x + Math.cos(p.angle) * 24,
          p.y - 12 + Math.sin(p.angle) * 20,
          p.holding.cooked,
          0.95
        );
      }
      const chefTag = (p.combo ?? 0) > 1 ? `x${p.combo}` : undefined;
      drawNameplate(ctx, p.x, p.y - 46, p.slotIndex, p.name, p.colorHex, chefTag);
    }
  }

  // Arcing 3D Flying tossed plates with floor shadows
  for (const fp of snap.flyingPlates) {
    drawShadowOval(ctx, fp.x, fp.y + 18, 16, 8, 0.36);
    drawDishIcon(ctx, fp.dish, fp.x, fp.y - 12, true, 1.15);
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
// 28. FRUIT DROP FRENZY (2.5D Carnival Stage & 3D Falling Fruits)
// ============================================================
export function renderFruitDrop(ctx: CanvasRenderingContext2D, snap: FruitDropSnapshot): void {
  const sky = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
  sky.addColorStop(0, '#101324');
  sky.addColorStop(0.75, '#1B1F36');
  sky.addColorStop(1, '#241D1B');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Subtle stage spotlight (warms to gold during Fruit Fever Rain)
  const spot = ctx.createRadialGradient(ARENA_WIDTH / 2, 180, 40, ARENA_WIDTH / 2, 320, 560);
  spot.addColorStop(0, snap.feverActive ? 'rgba(255, 184, 0, 0.2)' : 'rgba(158, 230, 34, 0.08)');
  spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  // Raised 2.5D Wooden Arcade Stage Deck at bottom
  drawArenaSlab(ctx, -10, ARENA_HEIGHT - 80, ARENA_WIDTH + 20, 90, 8, 14, '#473021', '#261810', '#FFB800', 3.5);

  // Falling 3D-shaded items
  for (const it of snap.items) {
    ctx.save();
    if (it.kind === 'berry') {
      drawSphere3D(ctx, it.x, it.y, 17, '#FF3B9A', '#FBCFE8', 0, false);
      ctx.fillStyle = '#9EE622';
      ctx.fillRect(it.x - 5, it.y - 20, 10, 6);
    } else if (it.kind === 'bomb') {
      drawSphere3D(ctx, it.x, it.y, 19, '#262F3D', '#FF4D2E', 0, false);
      ctx.fillStyle = '#FF4D2E';
      ctx.beginPath();
      ctx.arc(it.x, it.y - 20, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (it.kind === 'magnet') {
      drawSphere3D(ctx, it.x, it.y, 18, '#00C2FF', '#E0F2FE', 0, false);
      ctx.fillStyle = '#0D0F14';
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MAG', it.x, it.y);
    } else {
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      if (it.kind === 'pineapple') {
        const pGrad = ctx.createRadialGradient(-5, -2, 2, 0, 4, 20);
        pGrad.addColorStop(0, '#FDE047');
        pGrad.addColorStop(0.55, '#F59E0B');
        pGrad.addColorStop(1, '#92400E');
        ctx.fillStyle = pGrad;
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
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.arc(0, 3, 22, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
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
      } else {
        // Beveled 3D star
        ctx.fillStyle = '#B45309';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? 22 : 10;
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r + 4);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r + 4);
        }
        ctx.closePath();
        ctx.fill();

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
      }
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

  // 3D Players & Woven Baskets
  for (const p of snap.players) {
    drawShadowOval(ctx, p.x, p.y + 20, 32, 10, 0.45);
    if ((p.magnetTimer ?? 0) > 0) {
      ctx.save();
      ctx.strokeStyle = '#00C2FF';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y - 12, 46, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // 3D Woven basket
    drawExtrudedBox3D(
      ctx,
      p.x - 34,
      p.y - 20,
      68,
      20,
      10,
      8,
      '#D99B4E',
      '#8C5C24',
      (p.magnetTimer ?? 0) > 0 ? '#00C2FF' : p.colorHex
    );
    // Basket interior dark shadow
    ctx.fillStyle = '#523412';
    ctx.beginPath();
    ctx.roundRect(p.x - 28, p.y - 27, 56, 10, 4);
    ctx.fill();

    // Character pod holding basket
    drawCharacterPod3D(ctx, p.x, p.y + 12, 16, 0, p.stunTimer > 0 ? '#64748B' : p.colorHex, {
      height: 8,
      rimColor: '#FFFFFF',
      showVisor: false,
    });

    drawNameplate(ctx, p.x, p.y + 42, p.slotIndex, p.name, p.colorHex, p.combo > 1 ? `x${p.combo}` : undefined);
  }

  // Popups
  drawPopupTexts(ctx, snap.popups);

  drawHudChip(ctx, ARENA_WIDTH / 2, 16, `TIME ${Math.ceil(snap.timeLeft)}s`, '#9EE622');
  if (snap.feverActive) {
    drawHudChip(ctx, 136, 16, 'FRUIT FEVER RAIN!', '#FFB800');
  }
}

// ============================================================
// 30. PINBALL CLASH (2.5D Arcade Pinball Cabinet)
// ============================================================
export function renderPinballClash(ctx: CanvasRenderingContext2D, snap: PinballClashSnapshot): void {
  drawStudioBackdrop(ctx, '#090B11', 'rgba(0, 194, 255, 0.08)', 'rgba(255,255,255,0.025)', 48);

  const left = 64;
  const right = ARENA_WIDTH - 64;
  const top = 64;
  const bottom = ARENA_HEIGHT - 64;
  const goalHalf = 148;

  // Outer 2.5D Arcade Pinball Cabinet Frame
  drawArenaSlab(
    ctx,
    left - 12,
    top - 12,
    right - left + 24,
    bottom - top + 24,
    22,
    20,
    '#232B3C',
    '#121621',
    '#475569',
    3.5
  );

  // Recessed metallic playfield
  ctx.fillStyle = '#131823';
  ctx.beginPath();
  ctx.roundRect(left, top, right - left, bottom - top, 18);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Center lane lines
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
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

  // 3D Glowing Pop-Bumpers
  for (const bm of snap.bumpers) {
    const scale = 1 + bm.flash * 0.22;
    const topCol = bm.flash > 0.1 ? '#FFFFFF' : bm.colorHex;
    drawExtrudedCylinder3D(
      ctx,
      bm.x,
      bm.y,
      bm.r * scale,
      14,
      topCol,
      shadeHex(bm.colorHex, -0.45),
      '#FFFFFF',
      '#111622'
    );
    ctx.save();
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(bm.value), bm.x, bm.y - 14);
    ctx.restore();
  }

  // 3D Beveled Mechanical Flippers
  for (const p of snap.players) {
    ctx.save();
    if (p.bumpTimer > 0) {
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 110 * (1 - p.bumpTimer / 0.3) + 40, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    const isGiant = (p.giantTimer ?? 0) > 0;
    const padH = isGiant ? 162 : 112;
    const kickX = p.flipTimer > 0 ? (p.side === 'left' ? 16 : -16) : 0;
    const fx = p.x - 12 + kickX;
    const fy = p.y - padH / 2;
    const fTop = p.flipTimer > 0 ? '#FFFFFF' : p.colorHex;
    drawExtrudedBox3D(
      ctx,
      fx,
      fy,
      24,
      padH,
      10,
      12,
      fTop,
      shadeHex(p.colorHex, -0.48),
      isGiant ? '#FFB800' : '#FFFFFF',
      true
    );
    drawNameplate(ctx, p.x, fy - 22, p.slotIndex, p.name, p.colorHex, isGiant ? 'GIANT' : undefined);
  }

  // 3D Chrome & Gold Pinballs with trails
  for (const ball of snap.balls) {
    for (let i = 0; i < ball.trail.length; i++) {
      const pt = ball.trail[i];
      ctx.save();
      ctx.globalAlpha = ((i + 1) / ball.trail.length) * 0.32;
      ctx.fillStyle = ball.golden ? '#FFB800' : ball.lastTouchColor ?? '#CBD5E1';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - 4, ball.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawSphere3D(
      ctx,
      ball.x,
      ball.y,
      ball.r,
      ball.golden ? '#FDE047' : '#CBD5E1',
      ball.golden ? '#FF7A1A' : '#FFFFFF',
      5,
      true
    );
  }

  drawPopupTexts(ctx, snap.popups);

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

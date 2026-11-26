import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import type {
  BladeFruitSliceSnapshot,
  ChaptehJuggleSnapshot,
  CorridorFencingSnapshot,
  FiveSecondMicrogamesSnapshot,
  FiveStonesTossSnapshot,
  HalfpipeSkateComboSnapshot,
  PegFeverBounceSnapshot,
  ProDarts301Snapshot,
  WauKiteCutSnapshot,
  XiangqiRiverClashSnapshot,
} from '../shared/packCultHeritageTypes';
import {
  drawArenaSlab,
  drawBoardBanner,
  drawCharacterPod3D,
  drawExtrudedBox3D,
  drawHudChip,
  drawNameplate,
  drawShadowOval,
  drawSphere3D,
  drawStudioBackdrop,
  getActiveCanvasLang,
  shadeHex,
  tCanvas,
} from './packRenderHelpers';

function drawFooterBar(
  ctx: CanvasRenderingContext2D,
  players: { name: string; colorHex: string; score: number; badge?: string }[]
) {
  const count = Math.max(1, players.length);
  const w = Math.min(220, (ARENA_WIDTH - 80) / count - 10);
  const sx = (ARENA_WIDTH - (count * (w + 10) - 10)) / 2;
  players.forEach((p, i) => {
    const x = sx + i * (w + 10);
    ctx.save();
    ctx.fillStyle = 'rgba(13,18,30,0.92)';
    ctx.beginPath();
    ctx.roundRect(x, ARENA_HEIGHT - 72, w, 52, 12);
    ctx.fill();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 2.8;
    ctx.stroke();
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, x + w / 2, ARENA_HEIGHT - 51);
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 13px "JetBrains Mono", monospace';
    ctx.fillText(`${tCanvas(`${Math.round(p.score)} PTS`)}${p.badge ? ` · ${tCanvas(p.badge)}` : ''}`, x + w / 2, ARENA_HEIGHT - 30);
    ctx.restore();
  });
}

// 1. BLADE FRUIT SLICE
export function renderBladeFruitSlice(ctx: CanvasRenderingContext2D, snap: BladeFruitSliceSnapshot): void {
  drawStudioBackdrop(ctx, '#1A1109', 'rgba(34,197,94,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 74, 86, ARENA_WIDTH - 148, 535, 22, '#3D2614', '#22C55E');

  const fruitCols: Record<string, string> = {
    melon: '#22C55E',
    orange: '#F97316',
    kiwi: '#84CC16',
    gold: '#FACC15',
    bomb: '#1E293B',
  };
  for (const f of snap.fruits) {
    drawSphere3D(ctx, f.x, f.y, f.r, fruitCols[f.kind], f.kind === 'bomb' ? '#EF4444' : '#FFFFFF');
    if (f.kind === 'bomb') {
      ctx.fillStyle = '#EF4444';
      ctx.font = '900 16px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💣', f.x, f.y + 6);
    }
  }

  for (const p of snap.players) {
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.trailX, p.trailY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    drawNameplate(ctx, p.x, p.y - 26, `${p.name} · ${p.score}`, p.colorHex);
    ctx.restore();
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#22C55E');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#22C55E', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.slices} CUTS` }))
  );
}

// 2. PEG FEVER BOUNCE
export function renderPegFeverBounce(ctx: CanvasRenderingContext2D, snap: PegFeverBounceSnapshot): void {
  drawStudioBackdrop(ctx, '#0C1124', 'rgba(249,115,22,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 130, 86, ARENA_WIDTH - 260, 540, 24, '#111936', '#F97316');

  for (const peg of snap.pegs) {
    if (peg.hit) continue;
    const col = peg.kind === 'orange' ? '#F97316' : peg.kind === 'purple' ? '#A855F7' : '#38BDF8';
    drawSphere3D(ctx, peg.x, peg.y, 13, col, '#FFFFFF');
  }

  // Catch Bucket
  drawExtrudedBox3D(ctx, snap.bucketX - 72, ARENA_HEIGHT - 125, 144, 26, 8, '#FACC15', '#B45309', 12);
  ctx.fillStyle = '#14120B';
  ctx.font = '900 13px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tCanvas('FREE +110'), snap.bucketX, ARENA_HEIGHT - 107);

  for (const b of snap.balls) {
    drawSphere3D(ctx, b.x, b.y, 12, '#E2E8F0', b.colorHex);
  }

  for (const p of snap.players) {
    drawCharacterPod3D(ctx, p.aimX, 118, 16, p.colorHex, Math.PI / 2, 4);
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.aimX, 134);
    ctx.lineTo(p.aimX, 220);
    ctx.stroke();
    ctx.restore();
    drawNameplate(ctx, p.aimX, 95, p.name, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#F97316');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F97316', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.pegsHit} PEGS` }))
  );
}

// 3. HALFPIPE SKATE COMBO
export function renderHalfpipeSkateCombo(ctx: CanvasRenderingContext2D, snap: HalfpipeSkateComboSnapshot): void {
  drawStudioBackdrop(ctx, '#091522', 'rgba(0,194,255,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 90, ARENA_WIDTH - 168, 520, 24, '#0D1E32', '#00C2FF');

  // Halfpipe U-Curve
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const u = -1 + (i / 40) * 2;
    const x = ARENA_WIDTH / 2 + u * 420;
    const y = 520 - Math.pow(Math.abs(u), 2.1) * 235;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#38BDF8';
  ctx.stroke();
  ctx.restore();

  for (const p of snap.players) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.spinDeg * Math.PI) / 180);
    drawExtrudedBox3D(ctx, -26, -8, 52, 16, 6, p.colorHex, shadeHex(p.colorHex, -0.4), 6);
    ctx.restore();
    drawCharacterPod3D(ctx, p.x, p.y - 16, 16, p.colorHex, 0, p.airborne ? 10 : 2);
    drawNameplate(ctx, p.x, p.y - 48, p.trickName ? `${p.name}: ${tCanvas(p.trickName)}` : `${p.name} (${p.combo}×)`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#00C2FF');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#00C2FF', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.combo}×` }))
  );
}

// 4. FIVE-SECOND MICROGAMES
export function renderFiveSecondMicrogames(ctx: CanvasRenderingContext2D, snap: FiveSecondMicrogamesSnapshot): void {
  const bg = snap.redLight ? '#2B0912' : '#160B24';
  drawStudioBackdrop(ctx, bg, 'rgba(255,59,154,0.2)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 96, ARENA_WIDTH - 168, 515, 24, '#1B112B', '#FF3B9A');

  if (snap.microKind === 'catch') {
    drawSphere3D(ctx, snap.goalX, snap.goalY, 34, '#FACC15', '#FFFFFF');
    ctx.fillStyle = '#14120B';
    ctx.font = '900 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', snap.goalX, snap.goalY + 8);
  } else if (snap.microKind === 'dodge') {
    drawSphere3D(ctx, snap.hazardX, snap.hazardY, 36, '#EF4444', '#FCA5A5');
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tCanvas('SAW!'), snap.hazardX, snap.hazardY + 6);
  }

  for (const p of snap.players) {
    drawShadowOval(ctx, p.x, p.y + 18, 22, 10, 0.3);
    drawCharacterPod3D(ctx, p.x, p.y, 20, p.colorHex, 0, p.passed ? 8 : 2);
    drawNameplate(ctx, p.x, p.y - 32, `${p.name} ${p.passed ? '✓' : '✗'}`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · R${snap.round}`, '#FF3B9A');
  const isZh = getActiveCanvasLang() === 'zh';
  drawBoardBanner(ctx, `${isZh ? snap.promptZh : snap.promptEn} (${snap.microTimer.toFixed(1)}${isZh ? '秒' : 's'})`, '#FACC15', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.wins} ★` }))
  );
}

// 5. CORRIDOR FENCING
export function renderCorridorFencing(ctx: CanvasRenderingContext2D, snap: CorridorFencingSnapshot): void {
  drawStudioBackdrop(ctx, '#1A0B0E', 'rgba(239,68,68,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 150, ARENA_WIDTH - 168, 410, 22, '#28141A', '#EF4444');

  // Endzone Goal Gates
  drawExtrudedBox3D(ctx, 96, 175, 42, 360, 8, '#38BDF8', '#0284C7', 10);
  drawExtrudedBox3D(ctx, ARENA_WIDTH - 138, 175, 42, 360, 8, '#FACC15', '#B45309', 10);

  for (const p of snap.players) {
    const stanceOff = p.stance === 'high' ? -14 : p.stance === 'low' ? 14 : 0;
    const reach = p.lunging ? 68 : 42;
    drawCharacterPod3D(ctx, p.x, p.y, 22, p.colorHex, p.facing > 0 ? 0 : Math.PI, 6);
    ctx.save();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + stanceOff);
    ctx.lineTo(p.x + p.facing * reach, p.y + stanceOff);
    ctx.stroke();
    ctx.restore();
    drawNameplate(ctx, p.x, p.y - 34, `${p.name} [${tCanvas(p.stance.toUpperCase())}]`, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#EF4444');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EF4444', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.touches} HITS` }))
  );
}

// 6. PRO DARTS 301
export function renderProDarts301(ctx: CanvasRenderingContext2D, snap: ProDarts301Snapshot): void {
  drawStudioBackdrop(ctx, '#091B12', 'rgba(16,217,139,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 180, 88, ARENA_WIDTH - 360, 515, 24, '#13261C', '#10D98B');

  const rings = [
    { r: 190, col: '#1E293B' },
    { r: 135, col: '#F8FAFC' },
    { r: 105, col: '#10D98B' },
    { r: 65, col: '#0F172A' },
    { r: 22, col: '#EF4444' },
  ];
  for (const rg of rings) {
    ctx.save();
    ctx.fillStyle = rg.col;
    ctx.beginPath();
    ctx.arc(snap.boardX, snap.boardY, rg.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  for (const d of snap.darts) {
    drawSphere3D(ctx, d.x, d.y, 7, d.colorHex, '#FFFFFF');
  }

  for (const p of snap.players) {
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    drawNameplate(ctx, p.x, p.y - 28, `${p.name} (${p.remaining301})`, p.colorHex);
    ctx.restore();
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#10D98B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10D98B', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.remaining301} LEFT` }))
  );
}

// 7. WAU KITE CUT
export function renderWauKiteCut(ctx: CanvasRenderingContext2D, snap: WauKiteCutSnapshot): void {
  drawStudioBackdrop(ctx, '#0B243E', 'rgba(245,158,11,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 88, ARENA_WIDTH - 168, 520, 24, '#0F365C', '#F59E0B');

  for (const gr of snap.gustRings) {
    ctx.save();
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(gr.x, gr.y, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const p of snap.players) {
    ctx.save();
    // Kite tail string
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 18);
    ctx.quadraticCurveTo(p.x - 18, p.y + 42, p.x, p.y + 66);
    ctx.stroke();
    // Wau Bulan crescent wings
    ctx.fillStyle = p.colorHex;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 26, Math.PI, 0);
    ctx.lineTo(p.x + 12, p.y + 22);
    ctx.lineTo(p.x - 12, p.y + 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = p.dashing ? '#FFFFFF' : '#FACC15';
    ctx.lineWidth = p.dashing ? 4 : 2.5;
    ctx.stroke();
    drawNameplate(ctx, p.x, p.y - 38, `${p.name} (${p.cuts}✂)`, p.colorHex);
    ctx.restore();
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s · WIND ${Math.round(snap.windX)}`, '#F59E0B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F59E0B', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.cuts} CUTS` }))
  );
}

// 8. FIVE STONES TOSS (Batu Seremban)
export function renderFiveStonesToss(ctx: CanvasRenderingContext2D, snap: FiveStonesTossSnapshot): void {
  drawStudioBackdrop(ctx, '#1E1117', 'rgba(236,72,153,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 110, 96, ARENA_WIDTH - 220, 495, 24, '#4C1D35', '#EC4899');

  for (const s of snap.stones) {
    drawShadowOval(ctx, s.x, s.y + 16, 20, 9, 0.35);
    const sz = 22 + s.z * 0.16;
    ctx.save();
    ctx.fillStyle = s.kind === 'tossed' ? '#FACC15' : '#F472B6';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - s.z - sz);
    ctx.lineTo(s.x + sz, s.y - s.z + sz * 0.7);
    ctx.lineTo(s.x - sz, s.y - s.z + sz * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  for (const p of snap.players) {
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 32, 0, Math.PI * 2);
    ctx.stroke();
    drawNameplate(ctx, p.x, p.y - 42, `${p.name} (${p.heldStones}/5)`, p.colorHex);
    ctx.restore();
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#EC4899');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EC4899', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.setsCleared} SETS` }))
  );
}

// 9. CHAPTEH JUGGLE
export function renderChaptehJuggle(ctx: CanvasRenderingContext2D, snap: ChaptehJuggleSnapshot): void {
  drawStudioBackdrop(ctx, '#091E16', 'rgba(16,217,139,0.18)', 'rgba(255,255,255,0.03)', 44);
  drawArenaSlab(ctx, 84, 96, ARENA_WIDTH - 168, 505, 24, '#0F2E22', '#10D98B');

  for (const f of snap.feathers) {
    drawShadowOval(ctx, f.x, 575, 18, 6, 0.25);
    const col = f.golden ? '#FACC15' : '#FF3B9A';
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(f.x - 16, f.y - 22);
    ctx.lineTo(f.x, f.y - 6);
    ctx.lineTo(f.x + 16, f.y - 22);
    ctx.closePath();
    ctx.fill();
    drawSphere3D(ctx, f.x, f.y + 6, 12, '#0F172A', col);
    ctx.restore();
  }

  for (const p of snap.players) {
    drawCharacterPod3D(ctx, p.x, p.y, 24, p.colorHex, 0, 6);
    ctx.save();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 18, 42, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawNameplate(ctx, p.x, p.y - 36, `${p.name} (${p.streak}×)`, p.colorHex);
    ctx.restore();
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#10D98B');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#10D98B', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.kicks} KICKS` }))
  );
}

// 10. XIANGQI RIVER CLASH
export function renderXiangqiRiverClash(ctx: CanvasRenderingContext2D, snap: XiangqiRiverClashSnapshot): void {
  drawStudioBackdrop(ctx, '#1F140A', 'rgba(239,68,68,0.18)', 'rgba(255,255,255,0.03)', 44);
  const bw = 720;
  const bh = 460;
  const ox = (ARENA_WIDTH - bw) / 2;
  const oy = 96;
  drawArenaSlab(ctx, ox - 20, oy - 20, bw + 40, bh + 40, 22, '#92400E', '#EF4444');

  const cw = bw / snap.cols;
  const ch = bh / snap.rows;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,237,213,0.45)';
  ctx.lineWidth = 2;
  for (let r = 0; r < snap.rows; r++) {
    ctx.beginPath();
    ctx.moveTo(ox + cw * 0.5, oy + (r + 0.5) * ch);
    ctx.lineTo(ox + bw - cw * 0.5, oy + (r + 0.5) * ch);
    ctx.stroke();
  }
  for (let c = 0; c < snap.cols; c++) {
    ctx.beginPath();
    ctx.moveTo(ox + (c + 0.5) * cw, oy + ch * 0.5);
    ctx.lineTo(ox + (c + 0.5) * cw, oy + bh - ch * 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(14,165,233,0.28)';
  ctx.fillRect(ox, oy + bh / 2 - 22, bw, 44);
  ctx.fillStyle = '#FEF3C7';
  ctx.font = '900 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('楚 河     漢 界', ARENA_WIDTH / 2, oy + bh / 2 + 7);
  ctx.restore();

  for (const t of snap.targets) {
    const tx = ox + (t.c + 0.5) * cw;
    const ty = oy + (t.r + 0.5) * ch;
    drawSphere3D(ctx, tx, ty, 24, '#FEF3C7', '#EF4444');
    ctx.fillStyle = '#B91C1C';
    ctx.font = '900 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.label, tx, ty + 1);
  }

  const pieceChar: Record<string, string> = {
    chariot: '車',
    horse: '馬',
    cannon: '炮',
  };
  for (const p of snap.players) {
    const px = ox + (p.c + 0.5) * cw;
    const py = oy + (p.r + 0.5) * ch;
    drawSphere3D(ctx, px, py, 24, p.colorHex, '#FFFFFF');
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pieceChar[p.piece] ?? '車', px, py + 1);
    drawNameplate(ctx, px, py - 34, p.name, p.colorHex);
  }

  drawHudChip(ctx, 24, 22, `${Math.ceil(snap.timeLeft)}s`, '#EF4444');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#EF4444', 16);
  drawFooterBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: `${p.captures} ★` }))
  );
}

import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import type {
  CodeGridSnapshot,
  FibPartySnapshot,
  TriviaBlitzSnapshot,
  WordPulseSnapshot,
} from '../shared/packGlobalViralTypes';
import {
  drawArenaSlab,
  drawBoardBanner,
  drawExtrudedBox3D,
  drawHudChip,
  drawStudioBackdrop,
  shadeHex,
} from './packRenderHelpers';

function drawPlayerBar(
  ctx: CanvasRenderingContext2D,
  players: { name: string; colorHex: string; score: number; badge?: string }[]
) {
  const count = Math.max(1, players.length);
  const w = Math.min(220, (ARENA_WIDTH - 80) / count - 10);
  const totalW = count * (w + 10) - 10;
  const sx = (ARENA_WIDTH - totalW) / 2;
  players.forEach((p, i) => {
    const x = sx + i * (w + 10);
    ctx.save();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(x, ARENA_HEIGHT - 74, w, 54, 12);
    ctx.fill();
    ctx.strokeStyle = p.colorHex;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, x + w / 2, ARENA_HEIGHT - 51);
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 14px "JetBrains Mono", monospace';
    ctx.fillText(`${p.score} PTS${p.badge ? ` · ${p.badge}` : ''}`, x + w / 2, ARENA_HEIGHT - 30);
    ctx.restore();
  });
}

// 13. WORD PULSE (Wordle)
export function renderWordPulse(ctx: CanvasRenderingContext2D, snap: WordPulseSnapshot): void {
  drawStudioBackdrop(ctx, '#0A1219', 'rgba(34,197,94,0.16)', 'rgba(255,255,255,0.03)', 44);
  drawHudChip(ctx, 24, 22, `R${snap.round}/${snap.maxRounds} · ${Math.ceil(snap.timeLeft)}s`, '#22C55E');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#22C55E', 18);

  // Category chip
  ctx.save();
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.roundRect(360, 86, 480, 44, 12);
  ctx.fill();
  ctx.fillStyle = '#FACC15';
  ctx.font = '900 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`HINT: ${snap.categoryHint} · ${snap.categoryHintZh}`, ARENA_WIDTH / 2, 115);
  ctx.restore();

  // 6x5 Wordle board
  const tile = 72;
  const gap = 10;
  const startX = ARENA_WIDTH / 2 - (5 * tile + 4 * gap) / 2;
  const startY = 148;
  for (let r = 0; r < 6; r++) {
    const row = snap.rows[r];
    for (let c = 0; c < 5; c++) {
      const tx = startX + c * (tile + gap);
      const ty = startY + r * (tile + gap);
      const mark = row?.marks[c];
      const col =
        mark === 'correct'
          ? '#22C55E'
          : mark === 'present'
          ? '#EAB308'
          : mark === 'absent'
          ? '#334155'
          : '#0F172A';
      drawExtrudedBox3D(ctx, tx, ty, tile, tile, 6, col, shadeHex(col, -35), 10);
      if (row) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 34px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(row.word[c] ?? '', tx + tile / 2, ty + tile / 2);
      }
    }
    if (row) {
      ctx.fillStyle = row.pickerColor;
      ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(row.pickerName, startX + 5 * (tile + gap) + 14, startY + r * (tile + gap) + 40);
    }
  }

  drawPlayerBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: p.solved ? 'CRACKED' : undefined }))
  );
}

// 14. TRIVIA BLITZ (Kahoot!)
export function renderTriviaBlitz(ctx: CanvasRenderingContext2D, snap: TriviaBlitzSnapshot): void {
  drawStudioBackdrop(ctx, '#120A24', 'rgba(139,92,246,0.2)', 'rgba(255,255,255,0.03)', 46);
  drawHudChip(ctx, 24, 22, `Q${snap.round}/${snap.maxRounds} · ${Math.ceil(snap.timeLeft)}s`, '#8B5CF6');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#8B5CF6', 18);

  // Question Panel
  drawArenaSlab(ctx, 84, 92, ARENA_WIDTH - 168, 178, 20, '#131B2E', '#8B5CF6');
  ctx.save();
  ctx.fillStyle = '#A78BFA';
  ctx.font = '900 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(snap.category, ARENA_WIDTH / 2, 128);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(snap.question, ARENA_WIDTH / 2, 178, ARENA_WIDTH - 220);
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(snap.questionZh, ARENA_WIDTH / 2, 224, ARENA_WIDTH - 220);
  ctx.restore();

  // 2x2 Colored Answer Cards
  const letters = ['A', 'B', 'C', 'D'];
  snap.options.forEach((opt, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bw = 490;
    const bh = 132;
    const x = 96 + col * (bw + 28);
    const y = 300 + row * (bh + 24);
    const isCorrect = snap.correctIdx === i;
    const dimmed = snap.correctIdx !== null && !isCorrect;
    ctx.save();
    if (dimmed) ctx.globalAlpha = 0.35;
    drawExtrudedBox3D(ctx, x, y, bw, bh, 12, opt.colorHex, shadeHex(opt.colorHex, -35), 16);
    if (isCorrect) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 6;
      ctx.strokeRect(x - 3, y - 3, bw + 6, bh + 6);
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 26px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${letters[i]}  ${opt.label}`, x + 28, y + 54);
    ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(opt.labelZh, x + 64, y + 96);
    ctx.restore();
  });

  drawPlayerBar(
    ctx,
    snap.players.map((p) => ({
      name: p.name,
      colorHex: p.colorHex,
      score: p.score,
      badge: p.streak >= 2 ? `🔥${p.streak}` : p.answered ? '✓' : undefined,
    }))
  );
}

// 15. CODE GRID (Codenames)
export function renderCodeGrid(ctx: CanvasRenderingContext2D, snap: CodeGridSnapshot): void {
  drawStudioBackdrop(ctx, '#07151A', 'rgba(20,184,166,0.16)', 'rgba(255,255,255,0.03)', 46);
  drawHudChip(ctx, 24, 22, `R${snap.round}/${snap.maxRounds} · ${Math.ceil(snap.timeLeft)}s`, '#14B8A6');

  // Spymaster Clue Box
  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(290, 22, 620, 68, 16);
  ctx.fill();
  ctx.strokeStyle = '#14B8A6';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#5EEAD4';
  ctx.font = '900 30px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`CLUE: ${snap.clueWord} (${snap.clueWordZh}) · ${snap.foundCount}/${snap.clueCount}`, ARENA_WIDTH / 2, 66);
  ctx.restore();

  // 4x3 Codename Cards
  const cw = 236;
  const ch = 148;
  const gap = 22;
  const sx = (ARENA_WIDTH - (4 * cw + 3 * gap)) / 2;
  const sy = 122;

  snap.cards.forEach((c, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const x = sx + col * (cw + gap);
    const y = sy + row * (ch + gap);
    const bg = !c.revealed
      ? '#1E293B'
      : c.kind === 'agent'
      ? '#10B981'
      : c.kind === 'assassin'
      ? '#111827'
      : '#64748B';
    drawExtrudedBox3D(ctx, x, y, cw, ch, 10, bg, shadeHex(bg, -35), 14);
    if (c.revealed && c.kind === 'assassin') {
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
    }
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 24px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.word, x + cw / 2, y + 66);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(c.wordZh, x + cw / 2, y + 104);
    ctx.restore();
  });

  drawPlayerBar(
    ctx,
    snap.players.map((p) => ({ name: p.name, colorHex: p.colorHex, score: p.score, badge: p.lastAction }))
  );
}

// 16. BLUFF TRIVIA (Fibbage)
export function renderFibParty(ctx: CanvasRenderingContext2D, snap: FibPartySnapshot): void {
  drawStudioBackdrop(ctx, '#180912', 'rgba(244,63,94,0.18)', 'rgba(255,255,255,0.03)', 48);
  drawHudChip(ctx, 24, 22, `R${snap.round}/${snap.maxRounds} · ${Math.ceil(snap.timeLeft)}s`, '#F43F5E');
  if (snap.banner) drawBoardBanner(ctx, snap.banner, '#F43F5E', 18);

  // Prompt Card
  drawArenaSlab(ctx, 84, 94, ARENA_WIDTH - 168, 174, 20, '#1B1020', '#F43F5E');
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 26px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(snap.prompt, ARENA_WIDTH / 2, 162, ARENA_WIDTH - 220);
  ctx.fillStyle = '#FDA4AF';
  ctx.font = '700 21px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(snap.promptZh, ARENA_WIDTH / 2, 212, ARENA_WIDTH - 220);
  ctx.restore();

  if (snap.phase === 'write-fib') {
    ctx.save();
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 30px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CHECK YOUR PHONE · PICK A SNEAKY LIE!', ARENA_WIDTH / 2, 420);
    ctx.restore();
  } else {
    const cols = 2;
    const bw = 490;
    const bh = 104;
    snap.choices.slice(0, 6).forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 96 + col * (bw + 28);
      const y = 294 + row * (bh + 18);
      const colHex = c.isTruth ? '#10B981' : '#1E293B';
      drawExtrudedBox3D(ctx, x, y, bw, bh, 8, colHex, shadeHex(colHex, -35), 14);
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 22px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${c.text} · ${c.textZh}`, x + 22, y + 48, bw - 44);
      if (c.isTruth) {
        ctx.fillStyle = '#FEF08A';
        ctx.font = '900 15px "JetBrains Mono", monospace';
        ctx.fillText('✓ REAL TRUTH', x + 22, y + 80);
      } else if (c.authorName) {
        ctx.fillStyle = '#FDA4AF';
        ctx.font = '800 14px "JetBrains Mono", monospace';
        ctx.fillText(`LIE BY ${c.authorName}`, x + 22, y + 80);
      }
      // Voter dots
      c.voterColors.forEach((vc, vi) => {
        ctx.fillStyle = vc;
        ctx.beginPath();
        ctx.arc(x + bw - 26 - vi * 24, y + 74, 9, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    });
  }

  drawPlayerBar(
    ctx,
    snap.players.map((p) => ({
      name: p.name,
      colorHex: p.colorHex,
      score: p.score,
      badge: p.submitted ? '✓' : '...',
    }))
  );
}

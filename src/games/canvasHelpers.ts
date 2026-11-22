import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';
import { Language, translateGameText } from '../lib/i18n';
import { easeOutBack, getSpringBannerAnim } from './arcadeMotion';

let activeCanvasLang: Language = 'en';

export function setActiveCanvasLang(lang: Language): void {
  activeCanvasLang = lang;
}

export function getActiveCanvasLang(): Language {
  return activeCanvasLang;
}

export function tCanvas(text: string): string {
  return translateGameText(text, activeCanvasLang);
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
  const extraLabel = extra ? tCanvas(extra) : '';
  const label = `P${slotIndex + 1} ${name}${extraLabel ? ` · ${extraLabel}` : ''}`;
  ctx.save();
  ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
  const metrics = ctx.measureText(label);
  const w = metrics.width + 14;
  const h = 20;
  const rx = x - w / 2;
  const ry = y - h / 2;

  ctx.fillStyle = 'rgba(13, 15, 20, 0.88)';
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

export function drawPopupTexts(
  ctx: CanvasRenderingContext2D,
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[]
): void {
  if (!popups || popups.length === 0) return;
  ctx.save();
  ctx.font = '800 16px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const pop of popups) {
    const a = Math.max(0, Math.min(1, pop.alpha));
    const popIn = a > 0.78 ? easeOutBack((1 - a) / 0.22, 2.1) : 1;
    const scale = 0.72 + 0.34 * popIn - (1 - a) * 0.08;
    ctx.save();
    ctx.translate(pop.x, pop.y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = a;
    const txt = tCanvas(pop.text);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = 'rgba(10, 12, 18, 0.94)';
    ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = pop.colorHex;
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

export function drawHudChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  accentHex = '#FFB800',
  align: 'left' | 'center' | 'right' = 'center'
): void {
  const label = tCanvas(text);
  ctx.save();
  ctx.font = '800 13px "JetBrains Mono", monospace';
  const w = Math.max(96, ctx.measureText(label).width + 24);
  const h = 28;
  const rx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  ctx.fillStyle = 'rgba(13, 15, 20, 0.9)';
  ctx.beginPath();
  ctx.roundRect(rx, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rx + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

export function drawBoardBanner(
  ctx: CanvasRenderingContext2D,
  bannerKey: string,
  text: string | null,
  eventText: string | null,
  accent = '#FFB800'
): void {
  if (eventText) {
    drawHudChip(ctx, ARENA_WIDTH / 2, ARENA_HEIGHT - 42, eventText, accent);
  }
  if (!text) return;
  const label = tCanvas(text);
  const anim = getSpringBannerAnim(bannerKey, text);
  ctx.save();
  ctx.translate(ARENA_WIDTH / 2, 74);
  ctx.scale(anim.scale, anim.scale);
  ctx.globalAlpha = anim.alpha;
  ctx.font = '900 21px "Plus Jakarta Sans", sans-serif';
  const w = Math.max(270, ctx.measureText(label).width + 48);
  ctx.fillStyle = 'rgba(13, 15, 20, 0.94)';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -23, w, 46, 12);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

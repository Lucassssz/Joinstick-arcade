import { ARENA_WIDTH } from '../shared/types';
import { getSpringBannerAnim } from './arcadeMotion';
import {
  drawHudChip,
  drawPopupTexts,
  getActiveCanvasLang,
  isTablePlayerHidden,
  recordDrawnNameplate,
  tCanvas,
} from './canvasHelpers';
import {
  drawArenaSlab as coreDrawArenaSlab,
  drawCharacterPod3D as coreDrawCharacterPod3D,
  drawExtrudedBox3D as coreDrawExtrudedBox3D,
  drawShadowOval,
  drawSphere3D,
  drawStudioBackdrop,
  shadeHex,
} from './render25d';

export {
  drawHudChip,
  drawPopupTexts,
  drawShadowOval,
  drawSphere3D,
  drawStudioBackdrop,
  getActiveCanvasLang,
  isTablePlayerHidden,
  shadeHex,
  tCanvas,
};

export function drawArenaSlab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  topFill: string,
  borderColor: string
): void {
  coreDrawArenaSlab(ctx, x, y, w, h, r, 10, topFill, shadeHex(topFill, -0.4), borderColor, 2.5);
}

export function drawExtrudedBox3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  topColor: string,
  frontColor?: string,
  r = 8
): void {
  coreDrawExtrudedBox3D(ctx, x, y, w, h, depth, r, topColor, frontColor);
}

export function drawCharacterPod3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  colorHex: string,
  angle = 0,
  zHeight = 0
): void {
  coreDrawCharacterPod3D(ctx, x, y, r, angle, colorHex, { zHeight });
}

export function drawNameplate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  labelText: string,
  colorHex: string
): void {
  const label = tCanvas(labelText);
  ctx.save();
  ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
  const w = ctx.measureText(label).width + 14;
  const h = 20;
  const rx = x - w / 2;
  const ry = y - h / 2;
  ctx.fillStyle = 'rgba(13, 15, 20, 0.9)';
  ctx.beginPath();
  ctx.roundRect(rx, ry, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 0.5);
  recordDrawnNameplate(ctx, rx, ry, w, h);
  ctx.restore();
}

export function drawBoardBanner(
  ctx: CanvasRenderingContext2D,
  text: string | null,
  accent = '#FFB800',
  topY = 20
): void {
  if (!text) return;
  const label = tCanvas(text);
  const anim = getSpringBannerAnim(`pack:${accent}:${topY}`, text);
  ctx.save();
  ctx.font = '900 17px "Plus Jakarta Sans", sans-serif';
  const w = Math.max(240, ctx.measureText(label).width + 38);
  const h = 36;
  ctx.translate(ARENA_WIDTH / 2, topY + h / 2);
  ctx.scale(anim.scale, anim.scale);
  ctx.globalAlpha = anim.alpha;
  ctx.fillStyle = 'rgba(13, 15, 20, 0.92)';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0.5);
  ctx.restore();
}

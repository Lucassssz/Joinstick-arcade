import { ARENA_HEIGHT, ARENA_WIDTH } from '../shared/types';

const shadeCache = new Map<string, string>();

/**
 * Fast cached hex color shading.
 * factor > 0 lightens toward white; factor < 0 darkens toward black.
 */
export function shadeHex(hex: string, factor: number): string {
  const key = `${hex}|${factor.toFixed(2)}`;
  const cached = shadeCache.get(key);
  if (cached) return cached;

  let clean = hex.trim();
  if (!clean.startsWith('#')) return hex;
  clean = clean.slice(1);
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return hex;

  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;

  if (factor >= 0) {
    r = Math.min(255, Math.round(r + (255 - r) * factor));
    g = Math.min(255, Math.round(g + (255 - g) * factor));
    b = Math.min(255, Math.round(b + (255 - b) * factor));
  } else {
    const f = Math.max(0, 1 + factor);
    r = Math.round(r * f);
    g = Math.round(g * f);
    b = Math.round(b * f);
  }

  const out = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  if (shadeCache.size < 800) shadeCache.set(key, out);
  return out;
}

export function drawStudioBackdrop(
  ctx: CanvasRenderingContext2D,
  baseBg: string,
  spotlightColor: string,
  gridColor = 'rgba(255,255,255,0.035)',
  gridStep = 48
): void {
  ctx.fillStyle = baseBg;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  const glow = ctx.createRadialGradient(
    ARENA_WIDTH * 0.5,
    ARENA_HEIGHT * 0.42,
    40,
    ARENA_WIDTH * 0.5,
    ARENA_HEIGHT * 0.5,
    680
  );
  glow.addColorStop(0, spotlightColor);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  if (gridStep > 0) {
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= ARENA_WIDTH; x += gridStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA_HEIGHT);
    }
    for (let y = 0; y <= ARENA_HEIGHT; y += gridStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA_WIDTH, y);
    }
    ctx.stroke();
  }
}

export function drawShadowOval(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha = 0.42
): void {
  if (rx <= 0 || ry <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(4, 6, 12, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Raised 2.5D Diorama Platform Slab with floor drop-shadow, vertical front skirt,
 * beveled top surface, and crisp inner specular rim.
 */
export function drawArenaSlab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  depth: number,
  topFill: string | CanvasGradient,
  skirtColor: string,
  borderColor: string,
  borderWidth = 3
): void {
  ctx.save();
  // Cast floor shadow under the slab
  ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
  ctx.beginPath();
  ctx.roundRect(x + 4, y + depth + 8, w, h, r);
  ctx.fill();

  // Vertical extruded cliff skirt
  ctx.fillStyle = skirtColor;
  ctx.beginPath();
  ctx.roundRect(x, y + depth, w, h, r);
  ctx.fill();

  // Subtle vertical highlight ridge along bottom skirt edge
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top playable surface
  ctx.fillStyle = topFill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();

  if (borderWidth > 0) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
  }

  // Top-left inner specular lip
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 4, Math.max(2, r - 2));
  ctx.stroke();
  ctx.restore();
}

/**
 * Circular 2.5D stage with thick cylindrical cliff wall & cast abyss shadow.
 */
export function drawExtrudedDiscStage(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  depth: number,
  topFill: string | CanvasGradient,
  skirtColor: string,
  rimColor?: string
): void {
  ctx.save();
  // Deep pit shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.beginPath();
  ctx.ellipse(cx + 4, cy + depth + 10, r + 8, r + 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cylindrical cliff wall (shifted downward by depth)
  const skirtGrad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  skirtGrad.addColorStop(0, shadeHex(skirtColor, -0.35));
  skirtGrad.addColorStop(0.28, shadeHex(skirtColor, 0.08));
  skirtGrad.addColorStop(0.72, skirtColor);
  skirtGrad.addColorStop(1, shadeHex(skirtColor, -0.45));

  ctx.fillStyle = skirtGrad;
  ctx.beginPath();
  ctx.arc(cx, cy + depth, r, 0, Math.PI);
  ctx.lineTo(cx - r, cy);
  ctx.arc(cx, cy, r, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();

  // Vertical structural ribs on the cliff wall
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.lineWidth = 2;
  for (let a = 0.25; a <= Math.PI - 0.25; a += 0.45) {
    const rx = cx + Math.cos(a) * (r - 2);
    const ry = cy + Math.sin(a) * (r - 2);
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx, ry + depth - 1);
    ctx.stroke();
  }

  // Top playable disc
  ctx.fillStyle = topFill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  if (rimColor) {
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 2.5D Extruded Axis-Aligned Box (walls, crates, bricks, tiles, counters).
 * Footprint base stays anchored to (x, y, w, h) while top face rises upward by `depth`.
 */
export function drawExtrudedBox3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  r: number,
  topColor: string,
  frontColor?: string,
  borderColor?: string,
  topHighlight = true
): void {
  const fColor = frontColor ?? shadeHex(topColor, -0.38);
  const bColor = borderColor ?? shadeHex(topColor, 0.16);
  const topY = y - depth;

  ctx.save();
  // Ground shadow to bottom-right
  ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 4, w, h, r);
  ctx.fill();

  // Front vertical wall face connecting top face to base footprint
  ctx.fillStyle = fColor;
  ctx.beginPath();
  ctx.roundRect(x, topY + Math.min(4, h * 0.2), w, h + depth - Math.min(4, h * 0.2), r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top beveled cap
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.roundRect(x, topY, w, h, r);
  ctx.fill();

  ctx.strokeStyle = bColor;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Top-left specular rim highlight
  if (topHighlight && w > 12 && h > 12) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.max(4, r), topY + 2.5);
    ctx.lineTo(x + w - Math.max(4, r), topY + 2.5);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHexPath25D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  ySquash = 0.92
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r * ySquash;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * 2.5D Hexagonal Pillar Tile (for Hex Drop).
 */
export function drawExtrudedHex3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  depth: number,
  topColor: string,
  sideColor: string,
  borderColor: string,
  innerAccent?: string
): void {
  const ySquash = 0.92;
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * ySquash]);
  }

  ctx.save();
  // Drop shadow beneath hex column
  drawHexPath25D(ctx, x + 2, y + depth + 5, r, ySquash);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.fill();

  // Visible front facets (vertices 0->1->2->3 in screen space: bottom-right, bottom, bottom-left)
  const facetShades = [shadeHex(sideColor, -0.15), sideColor, shadeHex(sideColor, 0.14)];
  for (let i = 0; i < 3; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    ctx.fillStyle = facetShades[i];
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y2 + depth);
    ctx.lineTo(x1, y1 + depth);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Top hex face
  drawHexPath25D(ctx, x, y, r, ySquash);
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (innerAccent) {
    drawHexPath25D(ctx, x, y, Math.max(4, r - 7), ySquash);
    ctx.strokeStyle = innerAccent;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 2.5D Extruded Cylinder (pillars, bumper pylons, power cores, towers).
 * Base stays anchored at (x, y); body rises upward by `height`.
 */
export function drawExtrudedCylinder3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  height: number,
  topColor: string,
  sideColor?: string,
  borderColor?: string,
  centerCapColor?: string
): void {
  const sColor = sideColor ?? shadeHex(topColor, -0.35);
  const bColor = borderColor ?? shadeHex(topColor, 0.25);
  const topY = y - height;

  ctx.save();
  // Ground shadow
  drawShadowOval(ctx, x + 3, y + 4, r * 1.08, r * 0.85, 0.44);

  // Cylinder side wall
  const cylGrad = ctx.createLinearGradient(x - r, y, x + r, y);
  cylGrad.addColorStop(0, shadeHex(sColor, -0.3));
  cylGrad.addColorStop(0.28, shadeHex(sColor, 0.18));
  cylGrad.addColorStop(0.75, sColor);
  cylGrad.addColorStop(1, shadeHex(sColor, -0.4));

  ctx.fillStyle = cylGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI);
  ctx.lineTo(x - r, topY);
  ctx.arc(x, topY, r, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top face
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.arc(x, topY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = bColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Top-left bevel gleam
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(x, topY, Math.max(2, r - 2.5), Math.PI * 0.95, Math.PI * 1.75);
  ctx.stroke();

  if (centerCapColor) {
    ctx.fillStyle = centerCapColor;
    ctx.beginPath();
    ctx.arc(x, topY, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Glossy 2.5D Shaded Sphere (balls, pinballs, bombs, pucks, orbs, fruits)
 * with cast ground shadow and top-left specular crescent.
 */
export function drawSphere3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  baseColor: string,
  rimColor?: string,
  zHeight = 0,
  withShadow = true
): void {
  const drawY = y - zHeight;
  ctx.save();
  if (withShadow) {
    const shadowScale = Math.max(0.4, 1 - zHeight / 140);
    drawShadowOval(ctx, x + 3, y + r * 0.55, r * 0.95 * shadowScale, r * 0.55 * shadowScale, 0.4 * shadowScale);
  }

  const grad = ctx.createRadialGradient(
    x - r * 0.34,
    drawY - r * 0.36,
    r * 0.1,
    x,
    drawY,
    r
  );
  grad.addColorStop(0, shadeHex(baseColor, 0.52));
  grad.addColorStop(0.45, baseColor);
  grad.addColorStop(1, shadeHex(baseColor, -0.48));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, drawY, r, 0, Math.PI * 2);
  ctx.fill();

  if (rimColor) {
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Crisp specular glint
  ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.34, drawY - r * 0.34, r * 0.26, r * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export interface Pod3DOptions {
  height?: number;
  zHeight?: number;
  rimColor?: string;
  collarColor?: string;
  visorColor?: string;
  hat?: 'none' | 'chef' | 'crown';
  frozen?: boolean;
  scale?: number;
  alpha?: number;
  showVisor?: boolean;
}

/**
 * Tactile 2.5D Extruded Player Pod / Character Figurine.
 * Keeps base centered at (x, y) while lifting/extruding cleanly upward.
 */
export function drawCharacterPod3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
  colorHex: string,
  opts: Pod3DOptions = {}
): void {
  const height = opts.height ?? 9;
  const zHeight = opts.zHeight ?? 0;
  const scale = opts.scale ?? 1;
  const alpha = opts.alpha ?? 1;
  const collar = opts.collarColor ?? '#0E1117';
  const rim = opts.rimColor ?? 'rgba(255,255,255,0.88)';
  const showVisor = opts.showVisor ?? true;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Ground cast shadow
  const shScale = Math.max(0.38, 1 - zHeight / 120) * scale;
  drawShadowOval(ctx, x + 2, y + r * 0.42, r * 1.08 * shScale, r * 0.72 * shScale, 0.46 * alpha);

  const drawY = y - zHeight;
  ctx.translate(x, drawY);
  ctx.scale(scale, scale);

  // Dark extruded collar / base skirt
  const skirtGrad = ctx.createLinearGradient(-r, 0, r, 0);
  skirtGrad.addColorStop(0, shadeHex(colorHex, -0.58));
  skirtGrad.addColorStop(0.32, shadeHex(colorHex, -0.25));
  skirtGrad.addColorStop(0.75, shadeHex(colorHex, -0.42));
  skirtGrad.addColorStop(1, shadeHex(colorHex, -0.65));

  ctx.fillStyle = skirtGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.lineTo(-r, -height);
  ctx.arc(0, -height, r, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = collar;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top dome cap
  const domeGrad = ctx.createRadialGradient(-r * 0.3, -height - r * 0.35, r * 0.1, 0, -height, r);
  domeGrad.addColorStop(0, shadeHex(colorHex, 0.38));
  domeGrad.addColorStop(0.55, colorHex);
  domeGrad.addColorStop(1, shadeHex(colorHex, -0.28));

  ctx.fillStyle = domeGrad;
  ctx.beginPath();
  ctx.arc(0, -height, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rim;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Specular top crescent
  ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -height - r * 0.34, r * 0.38, r * 0.18, -0.45, 0, Math.PI * 2);
  ctx.fill();

  // Directional visor
  if (showVisor) {
    ctx.save();
    ctx.translate(0, -height);
    ctx.rotate(angle);
    ctx.fillStyle = opts.visorColor ?? '#F8FAFC';
    ctx.beginPath();
    ctx.roundRect(r * 0.34, -r * 0.36, r * 0.42, r * 0.72, 3);
    ctx.fill();
    ctx.strokeStyle = '#0D1017';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  // Chef puffy toque
  if (opts.hat === 'chef') {
    const hy = -height - r * 0.35;
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.roundRect(-8, hy - 4, 16, 7, 3);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-5, hy - 7, 6.5, 0, Math.PI * 2);
    ctx.arc(5, hy - 7, 6.5, 0, Math.PI * 2);
    ctx.arc(0, hy - 11, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (opts.hat === 'crown') {
    drawCrown3D(ctx, 0, -height - r - 6, 0.85);
  }

  ctx.restore();

  if (opts.frozen) {
    drawIceCube3D(ctx, x, drawY - height * 0.5, r * 2.55);
  }
}

export function drawIceCube3D(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
): void {
  const half = size * 0.5;
  const depth = size * 0.22;
  ctx.save();
  // Front translucent ice block
  ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
  ctx.strokeStyle = '#E0F2FE';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(cx - half, cy - half, size, size, 8);
  ctx.fill();
  ctx.stroke();

  // Top beveled ice face
  ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
  ctx.beginPath();
  ctx.moveTo(cx - half + 4, cy - half);
  ctx.lineTo(cx - half + depth, cy - half - depth * 0.65);
  ctx.lineTo(cx + half + depth * 0.65, cy - half - depth * 0.65);
  ctx.lineTo(cx + half - 2, cy - half);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Diagonal ice gleam
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - half + 8, cy - half + 14);
  ctx.lineTo(cx - half + 16, cy - half + 6);
  ctx.moveTo(cx - half + 10, cy - half + 24);
  ctx.lineTo(cx - half + 24, cy - half + 10);
  ctx.stroke();
  ctx.restore();
}

export function drawCrown3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Extruded base rim
  ctx.fillStyle = '#B45309';
  ctx.beginPath();
  ctx.roundRect(-14, 4, 28, 7, 3);
  ctx.fill();

  // Gold crown body
  const g = ctx.createLinearGradient(-15, -12, 15, 8);
  g.addColorStop(0, '#FEF08A');
  g.addColorStop(0.5, '#FFB800');
  g.addColorStop(1, '#D97706');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#FFFBEB';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-14, 7);
  ctx.lineTo(-16, -8);
  ctx.lineTo(-6, -1);
  ctx.lineTo(0, -14);
  ctx.lineTo(6, -1);
  ctx.lineTo(16, -8);
  ctx.lineTo(14, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Center ruby jewel
  ctx.fillStyle = '#FF3B9A';
  ctx.beginPath();
  ctx.arc(0, 1, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawSpinningGem3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  colorHex: string,
  phase: number,
  zLift = 6
): void {
  const spinW = 0.42 + 0.58 * Math.abs(Math.cos(phase));
  const hover = Math.sin(phase * 1.4) * 3.5;
  const drawY = y - zLift + hover;

  ctx.save();
  drawShadowOval(ctx, x, y + size * 0.65, size * 0.65, size * 0.34, 0.36);

  ctx.translate(x, drawY);
  // Dark back facet for thickness
  ctx.fillStyle = shadeHex(colorHex, -0.45);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.85 * spinW + 2, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.85 * spinW, 0);
  ctx.closePath();
  ctx.fill();

  // Left bright facet
  ctx.fillStyle = shadeHex(colorHex, 0.35);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.78 * spinW, 0);
  ctx.closePath();
  ctx.fill();

  // Right rich facet
  ctx.fillStyle = colorHex;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.78 * spinW, 0);
  ctx.lineTo(0, size);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.78 * spinW, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.78 * spinW, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

export function drawCoin3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  phase: number,
  colorHex = '#FFB800'
): void {
  const rx = Math.max(r * 0.28, r * Math.abs(Math.cos(phase)));
  const hover = Math.sin(phase * 1.5) * 2.5;
  ctx.save();
  drawShadowOval(ctx, x, y + r * 0.85, rx * 0.9, r * 0.35, 0.34);

  ctx.translate(x, y - 3 + hover);
  // Coin edge thickness
  ctx.fillStyle = shadeHex(colorHex, -0.42);
  ctx.beginPath();
  ctx.ellipse(3, 0, rx, r, 0, 0, Math.PI * 2);
  ctx.fill();

  // Coin face
  ctx.fillStyle = colorHex;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FEF3C7';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (rx > r * 0.48) {
    ctx.strokeStyle = shadeHex(colorHex, -0.35);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.56, r * 0.56, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 2.5D Beveled 3D Die with cast shadow, bottom extrusion lip, and glossy pips.
 */
export function drawDie3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  value: number,
  rolling: boolean
): void {
  ctx.save();
  const depth = Math.max(6, Math.round(size * 0.14));
  const hop = rolling ? Math.abs(Math.sin(performance.now() * 0.025)) * 10 : 0;

  drawShadowOval(ctx, x + 2, y + size * 0.55 + depth, size * 0.55, size * 0.24, rolling ? 0.3 : 0.45);

  ctx.translate(x, y - hop);
  if (rolling) ctx.rotate(Math.sin(performance.now() * 0.04) * 0.28);

  // Bottom/side bevel extrusion
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2 + depth, size, size, 10);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top face
  const faceGrad = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
  faceGrad.addColorStop(0, '#FFFFFF');
  faceGrad.addColorStop(1, '#E2E8F0');
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2, size, size, 10);
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  const off = size * 0.25;
  const r = size * 0.09;
  const pips: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-off, -off], [off, off]],
    3: [[-off, -off], [0, 0], [off, off]],
    4: [[-off, -off], [off, -off], [-off, off], [off, off]],
    5: [[-off, -off], [off, -off], [0, 0], [-off, off], [off, off]],
    6: [[-off, -off], [off, -off], [-off, 0], [off, 0], [-off, off], [off, off]],
  };
  const pipColor = value === 1 || value === 6 ? '#FF4D2E' : '#11141B';
  for (const [px, py] of pips[Math.max(1, Math.min(6, value))] ?? pips[1]) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(px, py + 1.2, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pipColor;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

import { useEffect, useRef, useState } from 'react';
import { BOARD_GAME_IDS, CARD_GAME_IDS } from '../shared/games';
import { ARENA_HEIGHT, ARENA_WIDTH, type GameId, type GameSnapshot } from '../shared/types';
import { ensureGameRendererLoaded } from '../games/rendererRegistry';
import { createRenderFxState, renderGameSnapshot } from '../games/renderers';
import { useLanguage } from '../lib/i18n';

interface RuleClipsPayload {
  gameId: GameId;
  segmentDurationMs: number;
  fps: number;
  segments: GameSnapshot[][];
}

const MAX_CLIENT_RULE_CLIP_CACHE = 18;
const ruleClipCache = new Map<GameId, RuleClipsPayload>();
const inflightRuleClips = new Map<GameId, Promise<RuleClipsPayload | null>>();

function getCachedRuleClips(gameId: GameId): RuleClipsPayload | null {
  const hit = ruleClipCache.get(gameId);
  if (!hit) return null;
  ruleClipCache.delete(gameId);
  ruleClipCache.set(gameId, hit);
  return hit;
}

function putCachedRuleClips(gameId: GameId, payload: RuleClipsPayload): void {
  if (ruleClipCache.has(gameId)) {
    ruleClipCache.delete(gameId);
  } else if (ruleClipCache.size >= MAX_CLIENT_RULE_CLIP_CACHE) {
    const oldest = ruleClipCache.keys().next().value;
    if (oldest) ruleClipCache.delete(oldest);
  }
  ruleClipCache.set(gameId, payload);
}

async function fetchRuleClips(
  gameId: GameId,
  signal?: AbortSignal
): Promise<RuleClipsPayload | null> {
  const cached = getCachedRuleClips(gameId);
  if (cached) return cached;

  let task = inflightRuleClips.get(gameId);
  if (!task) {
    task = (async () => {
      try {
        const [resp] = await Promise.all([
          fetch(`/api/rule-clips/${encodeURIComponent(gameId)}`),
          ensureGameRendererLoaded(gameId),
        ]);
        if (!resp.ok) return null;
        const data = (await resp.json()) as RuleClipsPayload;
        if (!data || !Array.isArray(data.segments) || data.segments.length === 0) {
          return null;
        }
        putCachedRuleClips(gameId, data);
        return data;
      } catch {
        return null;
      } finally {
        inflightRuleClips.delete(gameId);
      }
    })();
    inflightRuleClips.set(gameId, task);
  }

  const result = await task;
  if (signal?.aborted) return null;
  return result;
}

export function isRuleClipsReady(gameId: GameId): boolean {
  return ruleClipCache.has(gameId);
}

export async function preloadRuleClips(gameId: GameId): Promise<boolean> {
  if (getCachedRuleClips(gameId)) return true;
  const loaded = await fetchRuleClips(gameId);
  return Boolean(loaded);
}

interface WatchAndPlayCardCanvasProps {
  gameId: GameId;
  category: string;
  accentHex: string;
  ruleText: string;
  ruleIndex: number;
  totalRules: number;
  actionALabel: string;
  actionAColor: string;
  actionBLabel?: string;
  actionBColor?: string;
  active: boolean;
}

type RuleCueKind = 'move' | 'actionA' | 'actionB' | 'win';

function detectRuleCue(
  ruleText: string,
  ruleIndex: number,
  totalRules: number,
  actionALabel: string,
  actionBLabel: string
): RuleCueKind {
  const lower = ruleText.toLowerCase();
  const aLower = actionALabel.toLowerCase();
  const bLower = actionBLabel.toLowerCase();

  if (bLower && lower.includes(bLower)) return 'actionB';
  if (/\(b\)|button b|press b|b 键|按 b/i.test(lower)) return 'actionB';
  if (aLower && lower.includes(aLower)) return 'actionA';
  if (/\(a\)|button a|press a|a 键|按 a/i.test(lower)) return 'actionA';
  if (
    ruleIndex >= totalRules - 1 ||
    /\b(win|last|highest|first to|champion|most points|victory)\b|获胜|最高|最后|冠军|最先|得分最多/.test(
      lower
    )
  ) {
    return 'win';
  }
  if (ruleIndex === 1) return 'actionA';
  if (ruleIndex === 2) return 'actionB';
  return 'move';
}

function drawInstantStudioFallback(
  ctx: CanvasRenderingContext2D,
  gameId: GameId,
  accentHex: string,
  actionAColor: string,
  cue: RuleCueKind,
  progress: number,
  isZh: boolean
) {
  const W = ARENA_WIDTH;
  const H = ARENA_HEIGHT;
  const isCard = CARD_GAME_IDS.has(gameId);
  const isBoard = BOARD_GAME_IDS.has(gameId);

  ctx.save();
  // Studio backdrop
  const grad = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.65);
  grad.addColorStop(0, isCard ? '#123D2B' : isBoard ? '#182235' : '#161C2A');
  grad.addColorStop(1, '#090C12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Perspective floor grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let x = 120; x < W; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 90; y < H; y += 90) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Arena spotlight ring
  ctx.strokeStyle = `${accentHex}55`;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(W / 2, H / 2, 420, 220, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Animated actor tokens
  const angle = progress * Math.PI * 2;
  const p1x = W / 2 - 140 + Math.cos(angle) * 140;
  const p1y = H / 2 + Math.sin(angle * 2) * 75;
  const p2x = W / 2 + 160 + Math.cos(angle + Math.PI) * 90;
  const p2y = H / 2 + Math.sin(angle + 1) * 70;

  if (cue === 'actionA' || cue === 'actionB') {
    const pulse = (progress * 2) % 1;
    ctx.strokeStyle = cue === 'actionA' ? actionAColor : '#FFB800';
    ctx.lineWidth = 6;
    ctx.globalAlpha = 1 - pulse;
    ctx.beginPath();
    ctx.arc(p1x, p1y, 44 + pulse * 140, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Rival token
  ctx.fillStyle = '#64748B';
  ctx.beginPath();
  ctx.arc(p2x, p2y, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Hero P1 token
  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.arc(p1x, p1y, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = '#0B0E14';
  ctx.font = '900 28px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P1', p1x, p1y + 2);

  // Circular loading spinner + subtle loading indicator text
  const labelText = isZh ? '实机画面加载中…' : 'Loading live game scene…';
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  const textWidth = ctx.measureText(labelText).width;
  const spinnerR = 11;
  const groupX = W / 2 - textWidth / 2 - 18;
  const groupY = H - 56;
  const spinAngle = progress * Math.PI * 4;

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(groupX, groupY, spinnerR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = accentHex;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(groupX, groupY, spinnerR, spinAngle, spinAngle + Math.PI * 1.35);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, groupX + 20, groupY);
  ctx.restore();
}

function drawRuleCoachingHud(
  ctx: CanvasRenderingContext2D,
  cue: RuleCueKind,
  ruleIndex: number,
  accentHex: string,
  actionALabel: string,
  actionAColor: string,
  actionBLabel: string,
  actionBColor: string,
  progress: number,
  isZh: boolean
) {
  const W = ARENA_WIDTH;
  const H = ARENA_HEIGHT;

  ctx.save();

  // Top-left floating keycap coaching badge
  const badgeColor =
    cue === 'actionA'
      ? actionAColor
      : cue === 'actionB'
      ? actionBColor
      : cue === 'win'
      ? '#10D98B'
      : accentHex;

  const badgeKey =
    cue === 'actionA'
      ? 'A'
      : cue === 'actionB'
      ? 'B'
      : cue === 'win'
      ? '★'
      : '⇄';

  const badgeText =
    cue === 'actionA'
      ? isZh
        ? `按 A · ${actionALabel}`
        : `TAP A · ${actionALabel}`
      : cue === 'actionB'
      ? isZh
        ? `按 B · ${actionBLabel}`
        : `TAP B · ${actionBLabel}`
      : cue === 'win'
      ? isZh
        ? `第 ${ruleIndex + 1} 步 · 得分夺冠`
        : `STEP ${ruleIndex + 1} · SCORE & WIN`
      : isZh
      ? `第 ${ruleIndex + 1} 步 · 走位操控`
      : `STEP ${ruleIndex + 1} · MOVE & AIM`;

  ctx.font = '900 26px "JetBrains Mono", monospace';
  const textW = ctx.measureText(badgeText).width;
  const pillW = textW + 78;
  const pillH = 52;
  const px = 28;
  const py = 24;

  // High-contrast dark backdrop
  ctx.fillStyle = 'rgba(9, 12, 18, 0.86)';
  ctx.beginPath();
  ctx.roundRect(px, py, pillW, pillH, 14);
  ctx.fill();
  ctx.strokeStyle = badgeColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Keycap icon square
  ctx.fillStyle = badgeColor;
  ctx.beginPath();
  ctx.roundRect(px + 8, py + 8, 36, 36, 9);
  ctx.fill();

  ctx.fillStyle = '#0B0E14';
  ctx.font = '900 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeKey, px + 26, py + 27);

  // Cue label
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(badgeText, px + 56, py + 27);

  // Top-right 2.0s timer stamp
  const secVal = Math.min(2.0, Math.max(0.1, progress * 2.0)).toFixed(1);
  const timerText = `${secVal}s / 2.0s`;
  ctx.font = '800 22px "JetBrains Mono", monospace';
  const tw = ctx.measureText(timerText).width;
  ctx.fillStyle = 'rgba(9, 12, 18, 0.84)';
  ctx.beginPath();
  ctx.roundRect(W - tw - 54, 24, tw + 30, 44, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#E2E8F0';
  ctx.textAlign = 'right';
  ctx.fillText(timerText, W - 39, 47);

  // Bottom 2-second loop progress bar
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, H - 10, W, 10);
  ctx.fillStyle = badgeColor;
  ctx.fillRect(0, H - 10, W * progress, 10);

  ctx.restore();
}

/**
 * Renders REAL in-game footage generated by each game's server engine + canvas renderer
 * (`/api/rule-clips/:gameId`), selecting a distinct 2.0-second gameplay clip per rule
 * with a crisp coaching keycap overlay and instant 2.5D studio fallback while loading.
 */
export function WatchAndPlayCardCanvas({
  gameId,
  accentHex,
  ruleText,
  ruleIndex,
  totalRules,
  actionALabel,
  actionAColor,
  actionBLabel = 'SPECIAL',
  actionBColor = '#FFB800',
  active,
}: WatchAndPlayCardCanvasProps) {
  const { lang } = useLanguage();
  const langRef = useRef(lang);
  langRef.current = lang;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ruleClips, setRuleClips] = useState<RuleClipsPayload | null>(() =>
    getCachedRuleClips(gameId)
  );

  const cue = detectRuleCue(ruleText, ruleIndex, totalRules, actionALabel, actionBLabel);

  // Sync cached clips when gameId switches and fetch real engine rule clips
  useEffect(() => {
    const cached = getCachedRuleClips(gameId);
    if (cached) {
      let cancelled = false;
      ensureGameRendererLoaded(gameId)
        .then(() => {
          if (!cancelled) {
            setRuleClips(cached);
          }
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    setRuleClips(null);
    let cancelled = false;
    const controller = new AbortController();

    fetchRuleClips(gameId, controller.signal).then((loaded) => {
      if (!cancelled && loaded) {
        setRuleClips(loaded);
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [gameId]);

  // 2.0-second real-engine playback loop for the active rule segment
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fx = createRenderFxState();
    const segmentFrames =
      ruleClips && ruleClips.segments.length > 0
        ? ruleClips.segments[ruleIndex % ruleClips.segments.length] ?? ruleClips.segments[0]
        : null;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const LOOP_MS = ruleClips?.segmentDurationMs || 2000;
    const startTime = performance.now();
    let rafId = 0;

    const renderAtProgress = (rawProgress: number) => {
      const progress = Math.max(0, Math.min(1, rawProgress));
      const isZh = langRef.current === 'zh';
      if (segmentFrames && segmentFrames.length > 0) {
        const frameIdx = Math.max(
          0,
          Math.min(segmentFrames.length - 1, Math.floor(progress * segmentFrames.length))
        );
        const frame = segmentFrames[frameIdx];
        if (frame) {
          renderGameSnapshot(ctx, frame, fx, langRef.current);
        }
      } else {
        drawInstantStudioFallback(
          ctx,
          gameId,
          accentHex,
          actionAColor,
          cue,
          progress,
          isZh
        );
      }

      drawRuleCoachingHud(
        ctx,
        cue,
        ruleIndex,
        accentHex,
        actionALabel,
        actionAColor,
        actionBLabel,
        actionBColor,
        progress,
        isZh
      );
    };

    if (reducedMotion || !active) {
      renderAtProgress(0.55);
      return;
    }

    const tick = (now: number) => {
      if (typeof document !== 'undefined' && document.hidden) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const progress = (Math.max(0, now - startTime) % LOOP_MS) / LOOP_MS;
      renderAtProgress(progress);
      rafId = requestAnimationFrame(tick);
    };

    renderAtProgress(0);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [
    gameId,
    ruleClips,
    ruleIndex,
    accentHex,
    actionALabel,
    actionAColor,
    actionBLabel,
    actionBColor,
    cue,
    active,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={ARENA_WIDTH}
      height={ARENA_HEIGHT}
      aria-hidden="true"
      className="w-full h-full block bg-[#0B0E14]"
      style={{ aspectRatio: '16 / 9' }}
    />
  );
}

import { ARENA_HEIGHT, ARENA_WIDTH, type CompetitiveSnapshot } from '../shared/types';
import { type Language } from '../lib/i18n';
import { getMotionTime } from './arcadeMotion';
import { findDrawnNameplateNear } from './canvasHelpers';

export function renderCompetitiveOverlay(
  ctx: CanvasRenderingContext2D,
  comp: CompetitiveSnapshot | null | undefined,
  lang: Language
): void {
  if (!comp) return;
  const now = getMotionTime();
  const isZh = lang === 'zh';

  ctx.save();

  // 1. Contested Hot Zone Ring (Spatial Arena Games)
  if (comp.spatialActive && comp.hotZone) {
    const hz = comp.hotZone;
    const pulse = 1 + Math.sin(now * 5.2) * 0.04;
    const r = hz.radius * pulse;
    const baseCol = hz.holderColorHex ?? '#00C2FF';

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = baseCol;
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = baseCol;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -now * 28;
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Remaining time progress arc
    ctx.setLineDash([]);
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 4;
    const pct = Math.max(0, Math.min(1, hz.remaining / Math.max(0.1, hz.duration)));
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isZh ? '⚡ 争夺热区 +PTS' : '⚡ HOT ZONE +PTS',
      hz.x,
      hz.y - r - 14
    );
    ctx.restore();
  }

  // 2. Interactive Bounty Relics & Surge Drops (Spatial Arena Games)
  if (comp.spatialActive && comp.drops.length > 0) {
    for (const drop of comp.drops) {
      const bob = Math.sin(now * 4.6 + drop.x * 0.02) * 5;
      const dy = drop.y + bob;
      const col =
        drop.kind === 'crown' ? '#FFB800' : drop.kind === 'relic' ? '#10D98B' : '#00C2FF';
      const glyph = drop.kind === 'crown' ? '👑' : drop.kind === 'relic' ? '⭐' : '⚡';
      const blink = drop.ttl < 2.2 ? 0.5 + 0.5 * Math.sin(now * 16) : 1;

      ctx.save();
      ctx.globalAlpha = blink;

      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(drop.x, drop.y + 18, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glowing aura ring
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(drop.x, dy, 21 + Math.sin(now * 6) * 2.5, 0, Math.PI * 2);
      ctx.stroke();

      // Core orb
      const grad = ctx.createRadialGradient(drop.x - 5, dy - 6, 2, drop.x, dy, 17);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.45, col);
      grad.addColorStop(1, '#10141E');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(drop.x, dy, 16, 0, Math.PI * 2);
      ctx.fill();

      // Emoji / symbol
      ctx.font = '700 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, drop.x, dy + 1);

      // Value tag
      ctx.fillStyle = '#0D1017';
      ctx.beginPath();
      ctx.roundRect(drop.x - 19, dy + 17, 38, 15, 5);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = col;
      ctx.font = '900 10px "JetBrains Mono", monospace';
      ctx.fillText(`+${drop.value}`, drop.x, dy + 25);
      ctx.restore();
    }
  }

  // 3. Leader Bounty Crown & Hot Streak Badges positioned cleanly above/beside player nameplates
  if (comp.spatialActive) {
    for (const pm of comp.playerMeta) {
      if (typeof pm.x !== 'number' || typeof pm.y !== 'number') continue;
      const hasCrown = pm.isLeader && pm.bounty > 0;
      const hasStreak = pm.streak >= 3;
      if (!hasCrown && !hasStreak) continue;

      ctx.save();
      const label =
        hasCrown && hasStreak
          ? `👑+${pm.bounty} · 🔥${pm.streak}×`
          : hasCrown
          ? `👑 +${pm.bounty}`
          : `🔥${pm.streak}×`;
      ctx.font = '900 10px "JetBrains Mono", monospace';
      const badgeW = Math.max(hasCrown && hasStreak ? 76 : hasCrown ? 58 : 42, ctx.measureText(label).width + 14);
      const badgeH = 17;
      const bob = Math.sin(now * 4) * 1.5;

      const plate =
        findDrawnNameplateNear(pm.x, pm.y - 36, 95, 52) ??
        findDrawnNameplateNear(pm.x, pm.y, 95, 85);

      let bx = pm.x;
      let by = pm.y - 62 + bob;

      if (plate) {
        if (plate.cy <= pm.y + 4) {
          // Nameplate sits above the player: place badge cleanly above the nameplate
          const aboveY = plate.ry - badgeH / 2 - 4 + bob;
          if (aboveY - badgeH / 2 >= 8) {
            bx = plate.cx;
            by = aboveY;
          } else {
            // Near top edge of arena: place cleanly beside the nameplate
            const rightX = plate.rx + plate.w + badgeW / 2 + 6;
            bx =
              rightX + badgeW / 2 <= ARENA_WIDTH - 10
                ? rightX
                : Math.max(badgeW / 2 + 10, plate.rx - badgeW / 2 - 6);
            by = plate.cy;
          }
        } else {
          // Nameplate sits below the player: place badge cleanly above the player sprite
          const abovePlayerY = pm.y - 36 + bob;
          if (abovePlayerY - badgeH / 2 >= 8) {
            bx = pm.x;
            by = abovePlayerY;
          } else {
            bx = plate.cx;
            by = Math.min(ARENA_HEIGHT - badgeH / 2 - 8, plate.ry + plate.h + badgeH / 2 + 4);
          }
        }
      } else {
        by = Math.max(badgeH / 2 + 8, pm.y - 62 + bob);
      }

      bx = Math.max(badgeW / 2 + 8, Math.min(ARENA_WIDTH - badgeW / 2 - 8, bx));
      by = Math.max(badgeH / 2 + 6, Math.min(ARENA_HEIGHT - badgeH / 2 - 6, by));

      ctx.fillStyle = hasCrown ? 'rgba(20, 18, 11, 0.9)' : 'rgba(20, 12, 8, 0.88)';
      ctx.strokeStyle = hasCrown ? '#FFB800' : '#FF5E1A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bx - badgeW / 2, by - badgeH / 2, badgeW, badgeH, 5.5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFB800';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx, by + 0.5);
      ctx.restore();
    }
  }

  // 4. Floating Bilingual Competitive Popups (ALL 150 GAMES)
  for (const pop of comp.popups) {
    const label = isZh ? pop.textZh : pop.textEn;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, pop.alpha));
    ctx.font = '900 16px "Plus Jakarta Sans", "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(11, 14, 20, 0.92)';
    ctx.strokeText(label, pop.x, pop.y);
    ctx.fillStyle = pop.colorHex;
    ctx.fillText(label, pop.x, pop.y);
    ctx.restore();
  }

  // 5. Top-Center Competitive Event Callout Pill (Lead Change / Crown Shard / Hot Zone)
  if (comp.bannerAlpha > 0.04 && (comp.bannerEn || comp.bannerZh)) {
    const text = isZh ? comp.bannerZh ?? comp.bannerEn : comp.bannerEn ?? comp.bannerZh;
    if (text) {
      const alpha = Math.max(0, Math.min(1, comp.bannerAlpha * 1.3));
      const col = comp.bannerColor ?? '#FFB800';
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '900 13px "Plus Jakarta Sans", "JetBrains Mono", sans-serif';
      const tw = Math.min(540, ctx.measureText(text).width + 36);
      const x = ARENA_WIDTH / 2 - tw / 2;
      const y = 62;

      ctx.fillStyle = 'rgba(15, 18, 26, 0.92)';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, tw, 28, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, ARENA_WIDTH / 2, y + 14.5);
      ctx.restore();
    }
  }

  ctx.restore();
}

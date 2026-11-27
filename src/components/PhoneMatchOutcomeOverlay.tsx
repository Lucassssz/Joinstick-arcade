import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Crown, Flame, Medal, ShieldAlert, Sparkles, Trophy } from 'lucide-react';
import { translateGameText, useLanguage } from '../lib/i18n';
import { PlayerAvatar } from './PlayerAvatar';

interface PhoneMatchOutcomeOverlayProps {
  open: boolean;
  isVictory: boolean;
  isTournamentFinal?: boolean;
  isTeamMode?: boolean;
  rank: number | null;
  score: number;
  playerName: string;
  playerColorHex: string;
  playerTextOnColor: string;
  avatarId: string;
  highlight?: string;
  teamLabel?: string | null;
  teamColorHex?: string | null;
  onDismiss: () => void;
}

const VICTORY_BURST_PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + (i % 2 === 0 ? 0.12 : -0.08);
  const dist = 96 + (i % 3) * 34;
  const colors = ['#FFB800', '#10D98B', '#00C2FF', '#FF4D2E', '#FDE047'];
  return {
    id: i,
    tx: Math.cos(angle) * dist,
    ty: Math.sin(angle) * dist - 10,
    rot: (i % 2 === 0 ? 1 : -1) * (120 + i * 24),
    size: i % 3 === 0 ? 10 : 7,
    color: colors[i % colors.length],
    delay: 0.06 + (i % 4) * 0.035,
    shape: i % 3 === 0 ? 'diamond' : i % 2 === 0 ? 'pill' : 'dot',
  };
});

const DEFEAT_SHARD_PARTICLES = Array.from({ length: 10 }, (_, i) => {
  const spreadX = -135 + (i / 9) * 270;
  return {
    id: i,
    sx: spreadX,
    sy: -65 - (i % 3) * 24,
    ey: 95 + (i % 4) * 22,
    rot: (i % 2 === 0 ? 1 : -1) * (45 + i * 18),
    color: i % 2 === 0 ? '#EF4444' : '#818CF8',
    delay: 0.08 + (i % 5) * 0.04,
  };
});

const AUTO_DISMISS_MS = 2900;

export function PhoneMatchOutcomeOverlay({
  open,
  isVictory,
  isTournamentFinal = false,
  isTeamMode = false,
  rank,
  score,
  playerName,
  playerColorHex,
  playerTextOnColor,
  avatarId,
  highlight,
  teamLabel,
  teamColorHex,
  onDismiss,
}: PhoneMatchOutcomeOverlayProps) {
  const { lang, t } = useLanguage();
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      onDismissRef.current();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [open]);

  const headline = isVictory
    ? isTournamentFinal
      ? t('GRAND CHAMPION!', '荣耀夺冠！')
      : isTeamMode
      ? t('TEAM VICTORY!', '团队胜利！')
      : t('VICTORY!', '胜利！')
    : isTeamMode
    ? t('TEAM DEFEAT', '队伍惜败')
    : t('DEFEAT', '惜败');

  const subtitle = isVictory
    ? isTournamentFinal
      ? t('You conquered the 5-Game Cup!', '称霸五局锦标赛总决赛！')
      : t('Top of the leaderboard!', '实力碾压，全场第一！')
    : rank === 2
    ? t('Runner-up — so close to the crown!', '屈居亚军 —— 距离冠军仅差一步！')
    : t('Shake it off — ready for the rematch!', '重整旗鼓，下一局强势翻盘！');

  const accent = isVictory ? '#FFB800' : '#EF4444';
  const secondaryAccent = isVictory ? '#10D98B' : '#6366F1';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="phone-match-outcome-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={headline}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.22, ease: 'easeOut' } }}
          onClick={onDismiss}
          style={{ touchAction: 'manipulation' }}
          className="absolute inset-0 z-[72] flex items-center justify-center p-3 sm:p-5 bg-[#07090E]/86 backdrop-blur-md overflow-hidden cursor-pointer select-none"
        >
          {/* Ambient radial glow */}
          <motion.div
            aria-hidden="true"
            initial={{ scale: 0.45, opacity: 0 }}
            animate={{ scale: 1.15, opacity: 1 }}
            exit={{ scale: 1.25, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute inset-0"
            style={{
              background: isVictory
                ? 'radial-gradient(circle at 50% 44%, rgba(255,184,0,0.28) 0%, rgba(16,217,139,0.12) 34%, rgba(7,9,14,0) 70%)'
                : 'radial-gradient(circle at 50% 44%, rgba(239,68,68,0.26) 0%, rgba(99,102,241,0.14) 36%, rgba(7,9,14,0) 72%)',
            }}
          />

          {/* Victory rotating rays & confetti burst */}
          {isVictory ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
              <motion.div
                initial={{ scale: 0.4, opacity: 0, rotate: 0 }}
                animate={{ scale: 1, opacity: 0.32, rotate: 360 }}
                transition={{
                  scale: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.35 },
                  rotate: { duration: 16, repeat: Infinity, ease: 'linear' },
                }}
                className="w-[340px] h-[340px] sm:w-[440px] sm:h-[440px] rounded-full"
                style={{
                  background:
                    'repeating-conic-gradient(from 0deg, rgba(255,184,0,0.34) 0deg 14deg, transparent 14deg 36deg)',
                  maskImage: 'radial-gradient(circle, black 18%, transparent 70%)',
                  WebkitMaskImage: 'radial-gradient(circle, black 18%, transparent 70%)',
                }}
              />
              {VICTORY_BURST_PARTICLES.map((p) => (
                <motion.span
                  key={p.id}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
                  animate={{
                    x: p.tx,
                    y: p.ty,
                    scale: [0, 1.2, 0.85],
                    opacity: [1, 1, 0],
                    rotate: p.rot,
                  }}
                  transition={{
                    duration: 1.25,
                    delay: p.delay,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="absolute"
                  style={{
                    width: p.shape === 'pill' ? p.size * 1.45 : p.size,
                    height: p.shape === 'pill' ? p.size * 0.55 : p.size,
                    backgroundColor: p.color,
                    borderRadius:
                      p.shape === 'dot' ? '9999px' : p.shape === 'pill' ? '9999px' : '2px',
                    boxShadow: `0 0 10px ${p.color}AA`,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
              {DEFEAT_SHARD_PARTICLES.map((p) => (
                <motion.span
                  key={p.id}
                  initial={{ x: p.sx, y: p.sy, opacity: 0, rotate: 0 }}
                  animate={{
                    x: p.sx * 1.15,
                    y: p.ey,
                    opacity: [0, 0.75, 0],
                    rotate: p.rot,
                  }}
                  transition={{
                    duration: 1.5,
                    delay: p.delay,
                    ease: 'easeIn',
                  }}
                  className="absolute w-1.5 h-3.5 rounded-full"
                  style={{
                    backgroundColor: p.color,
                    boxShadow: `0 0 8px ${p.color}88`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Shockwave ring */}
          <motion.div
            aria-hidden="true"
            initial={{ scale: 0.45, opacity: 0.9 }}
            animate={{ scale: 1.95, opacity: 0 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute w-36 h-36 rounded-full border-2"
            style={{ borderColor: accent }}
          />

          {/* Center Reward Card */}
          <motion.div
            initial={
              isVictory
                ? { scale: 0.72, y: 24, opacity: 0 }
                : { scale: 1.18, y: -14, opacity: 0 }
            }
            animate={
              isVictory
                ? { scale: 1, y: 0, opacity: 1 }
                : {
                    scale: 1,
                    y: 0,
                    x: [0, -7, 7, -4, 4, 0],
                    opacity: 1,
                  }
            }
            exit={{ scale: 0.92, y: 10, opacity: 0, transition: { duration: 0.2 } }}
            transition={
              isVictory
                ? { type: 'spring', stiffness: 330, damping: 20 }
                : {
                    scale: { type: 'spring', stiffness: 380, damping: 24 },
                    y: { type: 'spring', stiffness: 380, damping: 24 },
                    x: { duration: 0.42, delay: 0.04, ease: 'easeOut' },
                    opacity: { duration: 0.22 },
                  }
            }
            className="relative w-full max-w-[360px] rounded-3xl bg-[#121620]/95 border-2 px-5 py-4 sm:py-5 text-center shadow-[0_24px_64px_rgba(0,0,0,0.7)] overflow-hidden"
            style={{
              borderColor: `${accent}AA`,
              boxShadow: `0 0 36px ${accent}38, 0 24px 64px rgba(0,0,0,0.75)`,
            }}
          >
            {/* Top metallic sheen */}
            <motion.div
              aria-hidden="true"
              initial={{ x: '-120%' }}
              animate={{ x: '220%' }}
              transition={{ duration: 1.1, delay: 0.25, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/12 to-transparent"
            />

            {/* Hero Emblem + Avatar */}
            <div className="relative flex items-center justify-center mb-2">
              <motion.div
                initial={{ scale: 0.3, rotate: isVictory ? -18 : 12 }}
                animate={
                  isVictory
                    ? { scale: 1, rotate: 0, y: [0, -3, 0] }
                    : { scale: 1, rotate: 0 }
                }
                transition={
                  isVictory
                    ? {
                        scale: { type: 'spring', stiffness: 400, damping: 16, delay: 0.06 },
                        rotate: { type: 'spring', stiffness: 320, damping: 16, delay: 0.06 },
                        y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 },
                      }
                    : { type: 'spring', stiffness: 380, damping: 20, delay: 0.05 }
                }
                className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl border-2 shadow-lg"
                style={{
                  background: isVictory
                    ? 'linear-gradient(145deg, rgba(255,184,0,0.28), rgba(16,217,139,0.16))'
                    : 'linear-gradient(145deg, rgba(239,68,68,0.24), rgba(99,102,241,0.18))',
                  borderColor: accent,
                  boxShadow: `0 0 24px ${accent}55`,
                }}
              >
                {isVictory ? (
                  isTournamentFinal ? (
                    <Trophy className="w-8 h-8 text-[#FFB800] drop-shadow-[0_2px_8px_rgba(255,184,0,0.6)]" />
                  ) : (
                    <Crown className="w-8 h-8 text-[#FFB800] drop-shadow-[0_2px_8px_rgba(255,184,0,0.6)]" />
                  )
                ) : rank === 2 ? (
                  <Medal className="w-8 h-8 text-[#CBD5E1] drop-shadow-[0_2px_8px_rgba(239,68,68,0.45)]" />
                ) : (
                  <ShieldAlert className="w-8 h-8 text-[#F87171] drop-shadow-[0_2px_8px_rgba(239,68,68,0.5)]" />
                )}

                <span
                  className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-lg font-display text-xs font-black border border-black/40 shadow"
                  style={{ backgroundColor: playerColorHex, color: playerTextOnColor }}
                >
                  #{rank ?? '-'}
                </span>
              </motion.div>
            </div>

            {/* Outcome Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 360, damping: 22, delay: 0.12 }}
              className="font-display text-2xl sm:text-3xl font-black tracking-tight"
              style={{
                color: isVictory ? '#FDE047' : '#FCA5A5',
                textShadow: isVictory
                  ? '0 2px 16px rgba(255,184,0,0.45)'
                  : '0 2px 14px rgba(239,68,68,0.4)',
              }}
            >
              {headline}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.18 }}
              className="text-xs font-semibold text-[#CBD5E1] mt-0.5"
            >
              {subtitle}
            </motion.p>

            {/* Player & Score Pill */}
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.24 }}
              className="mt-3 rounded-2xl bg-[#0B0E14]/90 border border-white/10 px-3 py-2 flex items-center justify-center gap-2.5"
            >
              <PlayerAvatar avatarId={avatarId} colorHex={playerColorHex} size="sm" />
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold text-white truncate max-w-[130px]">
                    {playerName}
                  </span>
                  {isVictory ? (
                    <Sparkles className="w-3.5 h-3.5 text-[#FFB800] shrink-0" />
                  ) : (
                    <Flame className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />
                  )}
                </div>
                <div className="font-mono text-[11px] font-black" style={{ color: secondaryAccent }}>
                  {score.toLocaleString()} {t('PTS', '分')}
                  {highlight ? ` · ${translateGameText(highlight, lang)}` : ''}
                </div>
              </div>
            </motion.div>

            {teamLabel && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-[11px] font-extrabold"
                style={{
                  backgroundColor: `${teamColorHex || accent}20`,
                  borderColor: `${teamColorHex || accent}70`,
                  color: teamColorHex || '#FFFFFF',
                }}
              >
                {teamLabel}
              </motion.div>
            )}

            {/* Tap to skip cue + smooth countdown bar */}
            <div className="mt-3.5 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                {t('Tap anywhere to continue', '点击任意处继续')}
              </div>
              <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
                  className="h-full origin-left rounded-full"
                  style={{
                    backgroundColor: accent,
                  }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

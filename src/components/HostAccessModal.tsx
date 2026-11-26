import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Crown,
  Gamepad2,
  KeyRound,
  Lock,
  MessageSquareText,
  Monitor,
  Plus,
  Power,
  RefreshCw,
  Share2,
  SlidersHorizontal,
  Smartphone,
  Ticket,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import {
  changeMasterPin,
  clearHostAuthSession,
  closeActiveRoomByOwner,
  createGuestPass,
  fetchHostAuthStatus,
  fetchOwnerRoomsDashboard,
  listGuestPasses,
  revokeGuestPass,
  setPlatformPublicAccess,
  useHostAuthSession,
  usePublicAccessOpen,
  verifyHostCode,
  type GuestPassMode,
  type GuestPassSummary,
  type OwnerActiveRoomSummary,
  type OwnerRoomsDashboard,
  type RoomActivityEvent,
} from '../lib/hostAuth';
import { GAME_CATALOG, getGameMeta } from '../shared/games';
import { getLocalizedGameMeta, useLanguage } from '../lib/i18n';
import type { RoomStatus } from '../shared/types';

interface HostUnlockModalProps {
  open: boolean;
  target: 'host' | 'pocket' | 'passes';
  onClose: () => void;
  onUnlocked: () => void;
}

export function HostUnlockModal({ open, target, onClose, onUnlocked }: HostUnlockModalProps) {
  const { t } = useLanguage();
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const onUnlockedRef = useRef(onUnlocked);
  onUnlockedRef.current = onUnlocked;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCodeInput('');
    setErrorMsg(null);
    setLoadingStatus(true);
    fetchHostAuthStatus()
      .then((res) => {
        if (cancelled) return;
        if (res.publicAccessOpen && target !== 'passes') {
          onUnlockedRef.current();
        }
      })
      .catch(() => {
        // Keep modal ready to verify against server
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, target]);

  if (!open) return null;

  const isOwnerOnly = target === 'passes';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = codeInput.trim();
    if (!trimmed) {
      setErrorMsg(
        isOwnerOnly
          ? t('Enter your Owner Master PIN.', '请输入房主管理密码。')
          : t('Enter your Master PIN or a Friend Guest Pass.', '请输入房主密码或访客临时口令。')
      );
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await verifyHostCode(trimmed, { requireMaster: isOwnerOnly });
      onUnlocked();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isOwnerOnly
          ? t('Invalid Owner Master PIN.', '房主管理密码错误。')
          : t('Invalid Master PIN or Guest Pass.', '密码或访客口令无效。')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#0B0E14]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-md w-full rounded-3xl bg-[#151B26] border-2 border-[#2A354A] shadow-2xl p-6 sm:p-8 text-center"
      >
        <div
          className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4 ${
            isOwnerOnly
              ? 'bg-[#00C2FF]/15 border-[#00C2FF]/40 text-[#00C2FF]'
              : 'bg-[#FF4D2E]/20 border-[#FF4D2E]/40 text-[#FF4D2E]'
          }`}
        >
          {isOwnerOnly ? <SlidersHorizontal className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
        </div>

        <h2 id="pin-modal-title" className="font-display text-2xl font-extrabold text-white">
          {isOwnerOnly
            ? t('Owner Settings', '房主设置')
            : target === 'pocket'
            ? t('Unlock Pocket Mode', '解锁掌机开房模式')
            : t('Unlock Host Monitor', '解锁大屏主持端')}
        </h2>

        <p className="mt-2 text-sm text-[#9CA3AF] leading-relaxed">
          {isOwnerOnly
            ? t(
                'Enter your private Master PIN to open Owner Settings, monitor active rooms, share the platform, and manage access.',
                '请输入你的房主管理密码以进入房主设置、监控活跃房间、分享平台及管理访客权限。'
              )
            : target === 'pocket'
            ? t(
                'Enter your private Master PIN or a temporary Friend Guest Pass (e.g. GP-XXXX-XXXX).',
                '请输入你的房主管理密码，或朋友分享的访客临时口令（如 GP-XXXX-XXXX）。'
              )
            : t(
                'Enter your private Master PIN or a temporary Friend Guest Pass to open a room.',
                '请输入你的房主管理密码，或输入访客临时口令来创建游戏房间。'
              )}
        </p>

        {loadingStatus ? (
          <div className="py-8 text-xs text-[#9CA3AF]">
            {t('Checking security status...', '正在验证安全配置...')}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
            <input
              type={isOwnerOnly ? 'password' : 'text'}
              maxLength={24}
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value);
                setErrorMsg(null);
              }}
              placeholder={
                isOwnerOnly
                  ? '••••••••'
                  : t('PIN or GP-XXXX-XXXX', '输入密码或访客口令')
              }
              autoFocus
              autoComplete="off"
              aria-label={
                isOwnerOnly
                  ? t('Owner Master PIN', '房主管理密码')
                  : t('Master PIN or Guest Pass', '管理密码或访客口令')
              }
              className={`w-full h-14 px-4 rounded-xl bg-[#0B0E14] border border-[#2A354A] focus:border-[#00C2FF] focus:outline-none font-mono text-lg sm:text-xl font-bold text-center text-white placeholder:text-[#4B5563] ${
                isOwnerOnly ? 'tracking-[0.35em]' : 'tracking-[0.14em] uppercase'
              }`}
            />

            {errorMsg && (
              <p className="text-xs font-semibold text-[#FF4D2E]">{errorMsg}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-xl bg-[#1E2636] hover:bg-[#273145] text-sm font-bold text-white cursor-pointer"
              >
                {t('Cancel', '取消')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="tactile-btn flex-1 h-12 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60 bg-[#FF4D2E] hover:bg-[#FF6145] text-white shadow-[0_3px_0_#B82E17]"
              >
                {submitting ? t('Verifying...', '验证中...') : t('Unlock', '解锁进入')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

interface GuestPassManagerModalProps {
  open: boolean;
  onClose: () => void;
}

type OwnerTab = 'rooms' | 'access';

function formatRelativeAgo(timestamp: number, now: number, lang: 'en' | 'zh'): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 10) return lang === 'zh' ? '刚刚' : 'just now';
  if (diffSec < 60) return lang === 'zh' ? `${diffSec}秒前` : `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return lang === 'zh' ? `${diffMin}分钟前` : `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return lang === 'zh' ? `${diffHr}小时前` : `${diffHr}h ago`;
}

function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function GuestPassManagerModal({ open, onClose }: GuestPassManagerModalProps) {
  const { lang, t } = useLanguage();
  const session = useHostAuthSession();
  const publicAccessOpen = usePublicAccessOpen();

  const [activeTab, setActiveTab] = useState<OwnerTab>('rooms');

  // Active Rooms Dashboard State
  const [dashboard, setDashboard] = useState<OwnerRoomsDashboard>({
    rooms: [],
    recentActivity: [],
    serverTime: Date.now(),
  });
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [closingRoomCode, setClosingRoomCode] = useState<string | null>(null);
  const [confirmCloseCode, setConfirmCloseCode] = useState<string | null>(null);
  const [expandedActivityRoom, setExpandedActivityRoom] = useState<string | null>(null);

  // Access, Sharing & Guest Passes State
  const [passes, setPasses] = useState<GuestPassSummary[]>([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [togglingPublicAccess, setTogglingPublicAccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [platformShareMessage, setPlatformShareMessage] = useState<string | null>(null);
  const [platformShareLang, setPlatformShareLang] = useState<'en' | 'zh'>(lang);

  const [friendLabel, setFriendLabel] = useState('');
  const [passMode, setPassMode] = useState<GuestPassMode>('single-use');
  const [timedHours, setTimedHours] = useState<number>(4);
  const [creating, setCreating] = useState(false);
  const [latestCreated, setLatestCreated] = useState<{
    code: string;
    pass: GuestPassSummary;
    recipientName: string | null;
  } | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<'code' | 'message' | 'platform' | null>(null);

  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinSavedMsg, setPinSavedMsg] = useState<string | null>(null);

  const refreshPasses = useCallback(async () => {
    setLoadingPasses(true);
    try {
      const data = await listGuestPasses();
      setPasses(data.passes);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('Failed to load passes', '加载失败'));
    } finally {
      setLoadingPasses(false);
    }
  }, [t]);

  const refreshDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoadingDashboard(true);
    try {
      const snap = await fetchOwnerRoomsDashboard();
      setDashboard(snap);
    } catch (err) {
      if (!silent) {
        setErrorMsg(
          err instanceof Error ? err.message : t('Failed to load active rooms', '加载活跃房间失败')
        );
      }
    } finally {
      if (!silent) setLoadingDashboard(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open || session?.role !== 'master') return;
    setErrorMsg(null);
    setLatestCreated(null);
    setGeneratedMessage(null);
    setPlatformShareMessage(null);
    setPlatformShareLang(lang);
    setCopiedTarget(null);
    setPinSavedMsg(null);
    setNewPin('');
    setConfirmCloseCode(null);
    void refreshPasses();
    void refreshDashboard(false);
  }, [open, session?.role, refreshPasses, refreshDashboard]);

  // Auto-poll active rooms & live activity every 3 seconds while Owner Settings is open
  useEffect(() => {
    if (!open || session?.role !== 'master') return;
    const timer = window.setInterval(() => {
      void refreshDashboard(true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [open, session?.role, refreshDashboard]);

  if (!open) return null;

  const copyTextToClipboard = async (
    text: string,
    target: 'code' | 'message' | 'platform'
  ) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget((prev) => (prev === target ? null : prev)), 2000);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (ok) {
          setCopiedTarget(target);
          setTimeout(() => setCopiedTarget((prev) => (prev === target ? null : prev)), 2000);
        }
      } catch {
        setCopiedTarget(null);
      }
    }
  };

  const handleTogglePublicAccess = async () => {
    if (togglingPublicAccess) return;
    setTogglingPublicAccess(true);
    setErrorMsg(null);
    try {
      await setPlatformPublicAccess(!publicAccessOpen);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : t('Failed to update platform lock state.', '更新平台开放状态失败。')
      );
    } finally {
      setTogglingPublicAccess(false);
    }
  };

  const handleCloseActiveRoom = async (code: string) => {
    if (closingRoomCode) return;
    setClosingRoomCode(code);
    setErrorMsg(null);
    try {
      await closeActiveRoomByOwner(code);
      setConfirmCloseCode(null);
      await refreshDashboard(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : t('Failed to close room.', '关闭房间失败。')
      );
    } finally {
      setClosingRoomCode(null);
    }
  };

  const handleGeneratePlatformShareMessage = (targetLang: 'en' | 'zh' = platformShareLang) => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const totalGames = GAME_CATALOG.length;

    const msg =
      targetLang === 'zh'
        ? [
            `快来一起玩 JoinStick Arcade 街机派对！🎮🔥`,
            `内置 ${totalGames} 款多人派对、棋盘与卡牌小游戏，无需下载 App，手机扫码秒变无线手柄！`,
            '',
            ...(appUrl ? [`游戏入口：${appUrl}`] : []),
            publicAccessOpen
              ? '开放状态：当前全员免密开放，直接打开链接即可创建「大屏房间」或「无大屏掌机房」！'
              : '加入方式：打开链接后点击「手机加入游戏」输入 4 位房间码即可开玩；如需自己开房请找我领取访客口令！',
            '',
            '支持电视/电脑大屏 + 手机手柄，也支持随时随地纯手机掌机联机，快拉上朋友开局吧！',
          ].join('\n')
        : [
            `Come play JoinStick Arcade! 🎮🔥`,
            `${totalGames} multiplayer party, arcade, board & card games right in your browser — zero downloads, just use your phone as a wireless controller!`,
            '',
            ...(appUrl ? [`Play here: ${appUrl}`] : []),
            publicAccessOpen
              ? 'Access: Platform is currently open to everyone — jump in and start a Host Monitor or Pocket Mode room anytime!'
              : 'How to join: Open the link and tap "Join with Phone" with a 4-letter room code — or ask me for a Guest Pass if you want to host your own room!',
            '',
            'Host on any TV/laptop or play phone-only in Pocket Mode. Let’s get game night started!',
          ].join('\n');

    setPlatformShareLang(targetLang);
    setPlatformShareMessage(msg);
    setCopiedTarget(null);
  };

  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    const recipientName = friendLabel.trim() || null;
    setCreating(true);
    setErrorMsg(null);
    try {
      const created = await createGuestPass({
        label: recipientName || undefined,
        mode: passMode,
        hours: timedHours,
      });
      setLatestCreated({ code: created.code, pass: created.pass, recipientName });
      setGeneratedMessage(null);
      setFriendLabel('');
      setCopiedTarget(null);
      await refreshPasses();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('Could not create pass', '生成口令失败'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = () => {
    if (!latestCreated) return;
    void copyTextToClipboard(latestCreated.code, 'code');
  };

  const handleGenerateMessage = () => {
    if (!latestCreated) return;
    const { code, pass, recipientName } = latestCreated;
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const expiresLabel = new Date(pass.expiresAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const msg =
      lang === 'zh'
        ? [
            recipientName
              ? `嗨 ${recipientName}！这是你的 JoinStick Arcade 访客临时口令，可以用来开房带大家一起玩：`
              : `嗨！这是你的 JoinStick Arcade 访客临时口令，可以用来开房带大家一起玩：`,
            '',
            `访客口令：${code}`,
            pass.mode === 'single-use'
              ? `有效规则：单次开房有效（过期时间 ${expiresLabel}）`
              : `有效规则：${pass.durationHours} 小时内无限开房（过期时间 ${expiresLabel}）`,
            ...(appUrl ? [`游戏入口：${appUrl}`] : []),
            '',
            '使用方法：',
            '1. 打开上方链接，选择「大屏主持端」或「掌机开房模式」。',
            '2. 在解锁弹窗中输入上方访客口令，即可创建房间游玩！',
          ].join('\n')
        : [
            recipientName
              ? `Hey ${recipientName}! Here is your JoinStick Arcade Guest Pass to host a game room:`
              : `Hey! Here is your JoinStick Arcade Guest Pass to host a game room:`,
            '',
            `Guest Pass: ${code}`,
            pass.mode === 'single-use'
              ? `Validity: 1-Time Room Unlock (expires ${expiresLabel})`
              : `Validity: ${pass.durationHours}h Party Pass (expires ${expiresLabel})`,
            ...(appUrl ? [`Play here: ${appUrl}`] : []),
            '',
            'How to use:',
            '1. Open the link above and pick "Host Monitor" or "Pocket Mode".',
            '2. Enter the Guest Pass code when prompted to unlock and create a room.',
          ].join('\n');

    setGeneratedMessage(msg);
    setCopiedTarget(null);
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeGuestPass(id);
      await refreshPasses();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('Could not revoke pass', '吊销失败'));
    }
  };

  const handleRotatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPin.trim();
    if (trimmed.length < 4 || trimmed.length > 24) {
      setErrorMsg(t('New PIN must be 4–24 characters.', '新密码需为 4–24 位。'));
      return;
    }
    if (trimmed !== confirmNewPin.trim()) {
      setErrorMsg(t('PIN confirmation does not match.', '两次输入的新密码不一致。'));
      return;
    }
    setErrorMsg(null);
    try {
      await changeMasterPin(trimmed);
      setNewPin('');
      setConfirmNewPin('');
      setPinSavedMsg(
        t(
          'Master PIN updated across all devices.',
          '房主管理密码已更新，所有设备将立即生效。'
        )
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('Failed to update PIN.', '修改失败。'));
    }
  };

  const getPassStatus = (p: GuestPassSummary) => {
    if (p.revoked) {
      return { text: t('Revoked', '已吊销'), cls: 'bg-[#FF4D2E]/15 text-[#FF9B8A] border-[#FF4D2E]/35' };
    }
    if (p.mode === 'single-use' && (p.usesRemaining ?? 0) <= 0) {
      return { text: t('Used', '已使用'), cls: 'bg-[#242A36] text-[#9CA3AF] border-[#343C4D]' };
    }
    if (Date.now() > p.expiresAt) {
      return { text: t('Expired', '已过期'), cls: 'bg-[#242A36] text-[#9CA3AF] border-[#343C4D]' };
    }
    return { text: t('Active', '生效中'), cls: 'bg-[#10D98B]/15 text-[#10D98B] border-[#10D98B]/40' };
  };

  const getRoomStatusBadge = (status: RoomStatus) => {
    switch (status) {
      case 'PLAYING':
        return {
          text: t('Playing', '对局中'),
          cls: 'bg-[#10D98B]/15 text-[#10D98B] border-[#10D98B]/45',
        };
      case 'COUNTDOWN':
      case 'BRIEFING':
        return {
          text: status === 'BRIEFING' ? t('Briefing', '规则说明') : t('Countdown', '倒计时'),
          cls: 'bg-[#FFB800]/15 text-[#FFB800] border-[#FFB800]/45',
        };
      case 'PAUSED':
        return {
          text: t('Paused', '已暂停'),
          cls: 'bg-[#FFB800]/15 text-[#FFD166] border-[#FFB800]/40',
        };
      case 'RESULTS':
        return {
          text: t('Results', '结算中'),
          cls: 'bg-[#A855F7]/15 text-[#D8B4FE] border-[#A855F7]/45',
        };
      case 'LOBBY':
        return {
          text: t('Lobby', '大厅选游'),
          cls: 'bg-[#00C2FF]/15 text-[#00C2FF] border-[#00C2FF]/45',
        };
      default:
        return {
          text: t('Setup', '准备阶段'),
          cls: 'bg-[#242A36] text-[#D1D5DB] border-[#343C4D]',
        };
    }
  };

  const getActivityDotColor = (kind: RoomActivityEvent['kind']) => {
    switch (kind) {
      case 'room-created':
        return 'bg-[#00C2FF]';
      case 'player-joined':
        return 'bg-[#10D98B]';
      case 'match-started':
        return 'bg-[#FFB800]';
      case 'match-finished':
        return 'bg-[#A855F7]';
      case 'room-closed':
        return 'bg-[#FF4D2E]';
      default:
        return 'bg-[#6B7280]';
    }
  };

  const totalOnlineHumans = dashboard.rooms.reduce((sum, r) => sum + r.connectedHumanCount, 0);
  const totalBots = dashboard.rooms.reduce((sum, r) => sum + r.botCount, 0);
  const liveMatchesCount = dashboard.rooms.filter(
    (r) => r.status === 'PLAYING' || r.status === 'COUNTDOWN' || r.status === 'BRIEFING'
  ).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('Owner Settings', '房主设置')}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#0B0E14]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-2xl w-full rounded-3xl bg-[#151B26] border-2 border-[#2A354A] shadow-2xl p-5 sm:p-6 text-left max-h-[90vh] overflow-y-auto arcade-scrollbar"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#222B3B] pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/40 text-[#00C2FF] flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-xl font-extrabold text-white truncate">
                  {t('Owner Settings', '房主设置')}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                    publicAccessOpen
                      ? 'bg-[#10D98B]/15 text-[#10D98B] border-[#10D98B]/40'
                      : 'bg-[#FF4D2E]/15 text-[#FF9B8A] border-[#FF4D2E]/35'
                  }`}
                >
                  {publicAccessOpen ? t('Platform Open', '全员开放中') : t('Invite Only', '邀请码模式')}
                </span>
              </div>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                {t(
                  'Monitor active rooms, share the platform, control open access, and manage Guest Passes.',
                  '实时监控活跃房间、分享平台链接、控制开放权限并管理访客口令。'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close', '关闭')}
            className="h-9 w-9 rounded-xl bg-[#1E2636] hover:bg-[#273145] text-[#9CA3AF] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {session?.role !== 'master' ? (
          <div className="py-8 text-center text-sm text-[#9CA3AF]">
            {t(
              'Only the Owner unlocked with the Master PIN can access Owner Settings.',
              '仅使用房主管理密码验证后，才可进入房主设置。'
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#10141D] border border-[#222B3B]">
              <button
                type="button"
                onClick={() => setActiveTab('rooms')}
                className={`h-10 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  activeTab === 'rooms'
                    ? 'bg-[#00C2FF] text-[#07131D] shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>{t('Active Rooms', '活跃房间监控')}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    activeTab === 'rooms'
                      ? 'bg-[#07131D]/20 text-[#07131D]'
                      : 'bg-[#1E2636] text-[#D1D5DB]'
                  }`}
                >
                  {dashboard.rooms.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('access')}
                className={`h-10 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  activeTab === 'access'
                    ? 'bg-[#FF4D2E] text-white shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <Ticket className="w-4 h-4" />
                <span>{t('Access, Share & Passes', '权限、分享与口令')}</span>
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/40 px-3 py-2 text-xs font-semibold text-[#FF9B8A]">
                {errorMsg}
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 1: ACTIVE ROOMS DASHBOARD & ROOM ACTIVITY                 */}
            {/* ============================================================= */}
            {activeTab === 'rooms' && (
              <div className="space-y-4">
                {/* Summary Stats Bar */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-2xl bg-[#10141D] border border-[#222B3B] p-3">
                    <div className="text-[11px] font-semibold text-[#9CA3AF]">
                      {t('Active Rooms', '活跃房间')}
                    </div>
                    <div className="font-display text-2xl font-extrabold text-white mt-0.5">
                      {dashboard.rooms.length}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[#10141D] border border-[#222B3B] p-3">
                    <div className="text-[11px] font-semibold text-[#9CA3AF]">
                      {t('Online Players', '在线玩家')}
                    </div>
                    <div className="font-display text-2xl font-extrabold text-[#00C2FF] mt-0.5">
                      {totalOnlineHumans}
                      {totalBots > 0 && (
                        <span className="text-xs font-semibold text-[#9CA3AF] ml-1.5">
                          +{totalBots} {t('AI', '机器人')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[#10141D] border border-[#222B3B] p-3">
                    <div className="text-[11px] font-semibold text-[#9CA3AF]">
                      {t('Live Matches', '进行中对局')}
                    </div>
                    <div className="font-display text-2xl font-extrabold text-[#10D98B] mt-0.5">
                      {liveMatchesCount}
                    </div>
                  </div>
                </div>

                {/* Active Rooms List Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#10D98B] animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#D1D5DB]">
                      {t('Live Room Dashboard', '实时活跃房间')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshDashboard(false)}
                    disabled={loadingDashboard}
                    className="h-8 px-2.5 rounded-lg bg-[#1E2636] hover:bg-[#273145] text-xs font-bold text-[#00C2FF] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDashboard ? 'animate-spin' : ''}`} />
                    <span>{t('Refresh', '刷新')}</span>
                  </button>
                </div>

                {/* Active Rooms Cards */}
                {loadingDashboard && dashboard.rooms.length === 0 ? (
                  <div className="rounded-2xl bg-[#10141D] border border-[#222B3B] p-6 text-center text-xs text-[#9CA3AF]">
                    {t('Loading active rooms...', '正在加载活跃房间...')}
                  </div>
                ) : dashboard.rooms.length === 0 ? (
                  <div className="rounded-2xl bg-[#10141D] border border-[#222B3B] p-6 text-center space-y-1.5">
                    <Gamepad2 className="w-7 h-7 text-[#4B5563] mx-auto" />
                    <div className="text-sm font-bold text-white">
                      {t('No Active Rooms Right Now', '当前暂无活跃房间')}
                    </div>
                    <p className="text-xs text-[#9CA3AF]">
                      {t(
                        'Rooms created on Host Monitor or Pocket Mode will appear here live with player rosters and activity.',
                        '通过大屏主持端或掌机模式创建的房间将在此实时显示，可随时查看动态或手动关闭。'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.rooms.map((room: OwnerActiveRoomSummary) => {
                      const badge = getRoomStatusBadge(room.status);
                      const gameMeta = getLocalizedGameMeta(getGameMeta(room.selectedGameId), lang);
                      const isConfirming = confirmCloseCode === room.code;
                      const isClosing = closingRoomCode === room.code;
                      const isExpanded = expandedActivityRoom === room.code;

                      return (
                        <div
                          key={room.code}
                          className="rounded-2xl bg-[#10141D] border border-[#263146] p-4 space-y-3"
                        >
                          {/* Top Row: Room Code, Mode, Status, Close Action */}
                          <div className="flex flex-wrap items-start justify-between gap-2.5">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-base font-black tracking-wider text-white bg-[#1B2333] border border-[#2E3B52] px-2.5 py-0.5 rounded-lg">
                                  {room.code}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-[#1B2333] border border-[#2A354A] text-[10px] font-bold text-[#CBD5E1] inline-flex items-center gap-1">
                                  {room.roomMode === 'pocket' ? (
                                    <Smartphone className="w-3 h-3 text-[#10D98B]" />
                                  ) : (
                                    <Monitor className="w-3 h-3 text-[#00C2FF]" />
                                  )}
                                  {room.roomMode === 'pocket'
                                    ? t('Pocket Mode', '掌机房')
                                    : t('Host Monitor', '大屏房')}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.cls}`}
                                >
                                  {badge.text}
                                </span>
                                {!room.hostConnected && (
                                  <span className="px-2 py-0.5 rounded-md bg-[#FF4D2E]/15 border border-[#FF4D2E]/40 text-[10px] font-bold text-[#FF9B8A]">
                                    {t('Host Offline', '房主离线')}
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-[#D1D5DB] flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-white">{gameMeta.name}</span>
                                <span className="text-[#4B5563]">·</span>
                                <span className="inline-flex items-center gap-1 text-[#9CA3AF]">
                                  <Users className="w-3.5 h-3.5 text-[#00C2FF]" />
                                  {room.connectedHumanCount}/{room.humanCount}{' '}
                                  {t('humans', '玩家')}
                                  {room.botCount > 0 &&
                                    ` · ${room.botCount} ${t('AI', '机器人')}`}
                                </span>
                                <span className="text-[#4B5563]">·</span>
                                <span className="text-[#9CA3AF]">
                                  {t('Active', '活跃')}{' '}
                                  {formatRelativeAgo(
                                    room.lastActivityAt,
                                    dashboard.serverTime,
                                    lang
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* Close Room Controls */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isConfirming ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isClosing}
                                    onClick={() => void handleCloseActiveRoom(room.code)}
                                    className="h-8 px-3 rounded-lg bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                    <span>
                                      {isClosing
                                        ? t('Closing...', '关闭中...')
                                        : t('Confirm Close', '确认关闭')}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isClosing}
                                    onClick={() => setConfirmCloseCode(null)}
                                    className="h-8 px-2.5 rounded-lg bg-[#1E2636] hover:bg-[#273145] text-xs font-bold text-[#D1D5DB] cursor-pointer"
                                  >
                                    {t('Cancel', '取消')}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmCloseCode(room.code)}
                                  className="h-8 px-3 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-[#FF9B8A] hover:text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <Power className="w-3.5 h-3.5" />
                                  <span>{t('Close Room', '关闭房间')}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Players Roster */}
                          {room.players.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {room.players.map((p) => (
                                <span
                                  key={p.id}
                                  className={`px-2 py-1 rounded-lg bg-[#161C28] border text-[11px] font-semibold inline-flex items-center gap-1.5 ${
                                    p.connected || p.isBot
                                      ? 'border-[#2A354A] text-white'
                                      : 'border-[#242A36] text-[#6B7280] opacity-70'
                                  }`}
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: p.colorHex }}
                                  />
                                  <span className="truncate max-w-[110px]">{p.name}</span>
                                  {p.isHost && <Crown className="w-3 h-3 text-[#FFB800] shrink-0" />}
                                  {p.isBot && <Bot className="w-3 h-3 text-[#00C2FF] shrink-0" />}
                                  {p.score > 0 && (
                                    <span className="font-mono text-[10px] text-[#10D98B]">
                                      {p.score}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[11px] text-[#6B7280]">
                              {t('Waiting for players to scan QR code...', '等待玩家扫码加入中...')}
                            </div>
                          )}

                          {/* Room Activity Log */}
                          {room.activity.length > 0 && (
                            <div className="pt-2 border-t border-[#1D2535] space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] inline-flex items-center gap-1">
                                  <Activity className="w-3 h-3 text-[#00C2FF]" />
                                  {t('Room Activity', '房间动态')}
                                </span>
                                {room.activity.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedActivityRoom(isExpanded ? null : room.code)
                                    }
                                    className="text-[11px] font-semibold text-[#00C2FF] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <span>
                                      {isExpanded
                                        ? t('Show Less', '收起')
                                        : t(
                                            `All (${room.activity.length})`,
                                            `展开全部 (${room.activity.length})`
                                          )}
                                    </span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                              <div className="space-y-1">
                                {(isExpanded ? room.activity : room.activity.slice(0, 2)).map(
                                  (evt) => (
                                    <div
                                      key={evt.id}
                                      className="flex items-center justify-between gap-2 text-[11px]"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${getActivityDotColor(
                                            evt.kind
                                          )}`}
                                        />
                                        <span className="text-[#CBD5E1] truncate">
                                          {lang === 'zh' ? evt.summaryZh : evt.summaryEn}
                                        </span>
                                      </div>
                                      <span className="font-mono text-[10px] text-[#6B7280] shrink-0">
                                        {formatClockTime(evt.timestamp)}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Recent Platform-Wide Activity Log */}
                <div className="rounded-2xl bg-[#10141D] border border-[#222B3B] p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] inline-flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-[#00C2FF]" />
                      {t('Recent Room Activity Feed', '近期全局房间动态')}
                    </span>
                    <span className="text-[10px] text-[#6B7280]">
                      {t('Auto-updates every 3s', '每 3 秒自动刷新')}
                    </span>
                  </div>

                  {dashboard.recentActivity.length === 0 ? (
                    <div className="text-xs text-[#6B7280] py-2 text-center">
                      {t('No room activity recorded yet in this session.', '本次启动暂未记录到房间活动。')}
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto arcade-scrollbar pr-1">
                      {dashboard.recentActivity.map((evt) => (
                        <div
                          key={evt.id}
                          className="flex items-center justify-between gap-2 text-xs py-1 border-b border-[#19202E] last:border-b-0"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${getActivityDotColor(
                                evt.kind
                              )}`}
                            />
                            <span className="font-mono text-[10px] font-bold text-[#9CA3AF] bg-[#182030] px-1.5 py-0.5 rounded shrink-0">
                              {evt.roomCode}
                            </span>
                            <span className="text-[#D1D5DB] truncate">
                              {lang === 'zh' ? evt.summaryZh : evt.summaryEn}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-[#6B7280] shrink-0">
                            {formatClockTime(evt.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* TAB 2: ACCESS, SHARE PLATFORM & GUEST PASSES                  */}
            {/* ============================================================= */}
            {activeTab === 'access' && (
              <div className="space-y-5">
                {/* Whole-Platform Public Access Toggle */}
                <div
                  className={`rounded-2xl border-2 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-colors ${
                    publicAccessOpen
                      ? 'bg-[#10D98B]/10 border-[#10D98B]/50'
                      : 'bg-[#10141D] border-[#2A354A]'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                        publicAccessOpen
                          ? 'bg-[#10D98B]/20 border-[#10D98B]/50 text-[#10D98B]'
                          : 'bg-[#FF4D2E]/15 border-[#FF4D2E]/40 text-[#FF4D2E]'
                      }`}
                    >
                      {publicAccessOpen ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                          {publicAccessOpen
                            ? t('Whole Platform Unlocked', '整个平台已免密开放')
                            : t('Platform Locked (Invite Only)', '平台已锁定（需邀请码）')}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                            publicAccessOpen
                              ? 'bg-[#10D98B]/20 text-[#10D98B] border-[#10D98B]/45'
                              : 'bg-[#FF4D2E]/15 text-[#FF9B8A] border-[#FF4D2E]/40'
                          }`}
                        >
                          {publicAccessOpen ? t('Open to Anyone', '全员可用') : t('Code Required', '需邀请码')}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9CA3AF] mt-1 leading-relaxed">
                        {publicAccessOpen
                          ? t(
                              'Anyone can create rooms and play right now without an invitation code. Lock it anytime to require codes again.',
                              '当前任何人都可以直接开房游玩，无需邀请码。随时点击右侧按钮即可重新锁定。'
                            )
                          : t(
                              'Normal mode: hosting a room requires your Master PIN or a Guest Pass. Unlock to let anyone use the platform freely.',
                              '正常模式：创建房间需要房主密码或访客邀请码。点击解锁后全员均可免密开房。'
                            )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={togglingPublicAccess}
                    onClick={() => void handleTogglePublicAccess()}
                    className={`tactile-btn h-10 px-4 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                      publicAccessOpen
                        ? 'bg-[#FF4D2E] hover:bg-[#FF6145] text-white shadow-[0_3px_0_#B82E17]'
                        : 'bg-[#10D98B] hover:bg-[#22E89B] text-[#071A12] shadow-[0_3px_0_#0A915D]'
                    }`}
                  >
                    {publicAccessOpen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    <span>
                      {togglingPublicAccess
                        ? t('Updating...', '切换中...')
                        : publicAccessOpen
                        ? t('Lock Platform', '锁定平台')
                        : t('Unlock Platform', '解锁整个平台')}
                    </span>
                  </button>
                </div>

                {/* Share Platform Message Generator */}
                <div className="rounded-2xl bg-[#10141D] border border-[#222B3B] p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/40 text-[#00C2FF] flex items-center justify-center shrink-0">
                        <Share2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-white">
                          {t('Share Platform Invite', '分享游戏平台')}
                        </div>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                          {t(
                            'Generate a ready-to-send message with your platform link and quick play instructions.',
                            '一键生成包含平台链接与游玩说明的分享文案，直接发给好友或群聊。'
                          )}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGeneratePlatformShareMessage(platformShareLang)}
                      className="tactile-btn h-9 px-3.5 rounded-xl bg-[#00C2FF] hover:bg-[#38D1FF] text-[#07131D] font-extrabold text-xs inline-flex items-center justify-center gap-1.5 shadow-[0_3px_0_#0084B0] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <MessageSquareText className="w-4 h-4" />
                      <span>{t('Generate Share Message', '生成分享文案')}</span>
                    </button>
                  </div>

                  {platformShareMessage !== null && (
                    <div className="pt-3 border-t border-[#1D2535] space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C2FF]">
                          {t('Platform Share Message', '平台分享文案')}
                        </span>
                        <div className="flex items-center gap-2">
                          <div
                            role="group"
                            aria-label={t('Message language', '文案语言')}
                            className="inline-flex items-center p-0.5 rounded-lg bg-[#161C28] border border-[#2F3A4F]"
                          >
                            <button
                              type="button"
                              onClick={() => handleGeneratePlatformShareMessage('en')}
                              className={`h-7 px-2.5 rounded-md text-[11px] font-extrabold cursor-pointer transition-colors ${
                                platformShareLang === 'en'
                                  ? 'bg-[#00C2FF] text-[#07131D]'
                                  : 'text-[#9CA3AF] hover:text-white'
                              }`}
                            >
                              EN
                            </button>
                            <button
                              type="button"
                              onClick={() => handleGeneratePlatformShareMessage('zh')}
                              className={`h-7 px-2.5 rounded-md text-[11px] font-extrabold cursor-pointer transition-colors ${
                                platformShareLang === 'zh'
                                  ? 'bg-[#00C2FF] text-[#07131D]'
                                  : 'text-[#9CA3AF] hover:text-white'
                              }`}
                            >
                              CN
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              void copyTextToClipboard(platformShareMessage, 'platform')
                            }
                            className="h-8 px-3 rounded-lg bg-[#1E2636] hover:bg-[#273145] border border-[#2F3A4F] text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedTarget === 'platform' ? (
                              <Check className="w-3.5 h-3.5 text-[#10D98B]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-[#00C2FF]" />
                            )}
                            <span>
                              {copiedTarget === 'platform'
                                ? t('Message Copied!', '文案已复制')
                                : t('Copy Message', '复制文案')}
                            </span>
                          </button>
                        </div>
                      </div>
                      <textarea
                        rows={6}
                        value={platformShareMessage}
                        onChange={(e) => setPlatformShareMessage(e.target.value)}
                        aria-label={t('Platform share message', '平台分享文案')}
                        className="w-full rounded-xl bg-[#0B0E14] border border-[#2A354A] focus:border-[#00C2FF] focus:outline-none p-3 text-xs leading-relaxed text-[#E5E7EB] resize-y arcade-scrollbar"
                      />
                    </div>
                  )}
                </div>

                {/* Mint Guest Pass Form */}
                <form
                  onSubmit={handleCreatePass}
                  className="rounded-2xl bg-[#10141D] border border-[#222B3B] p-4 space-y-3"
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-[#00C2FF]">
                    {t('Generate New Guest Pass', '生成新访客口令')}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      maxLength={24}
                      value={friendLabel}
                      onChange={(e) => setFriendLabel(e.target.value)}
                      placeholder={t('Friend name (optional)', '备注好友名称（可选）')}
                      className="h-10 px-3 rounded-xl bg-[#161C28] border border-[#2A354A] focus:border-[#00C2FF] focus:outline-none text-xs text-white placeholder:text-[#6B7280]"
                    />

                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#161C28] border border-[#2A354A]">
                      <button
                        type="button"
                        onClick={() => setPassMode('single-use')}
                        className={`h-8 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          passMode === 'single-use'
                            ? 'bg-[#FF4D2E] text-white'
                            : 'text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        {t('1-Time Use', '单次有效')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPassMode('timed')}
                        className={`h-8 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          passMode === 'timed'
                            ? 'bg-[#00C2FF] text-[#07131D]'
                            : 'text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        {t('Timed Pass', '限时有效')}
                      </button>
                    </div>
                  </div>

                  {passMode === 'timed' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[#9CA3AF] inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {t('Expires after:', '有效时长：')}
                      </span>
                      {[1, 4, 12, 24].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setTimedHours(h)}
                          className={`h-7 px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                            timedHours === h
                              ? 'bg-[#00C2FF]/20 border-[#00C2FF] text-[#00C2FF]'
                              : 'bg-[#161C28] border-[#2A354A] text-[#9CA3AF] hover:text-white'
                          }`}
                        >
                          {h}h
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={creating}
                    className="tactile-btn w-full h-10 rounded-xl bg-[#10D98B] hover:bg-[#22E89B] text-[#071A12] font-extrabold text-xs inline-flex items-center justify-center gap-1.5 shadow-[0_3px_0_#0A915D] cursor-pointer disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {creating
                        ? t('Creating...', '生成中...')
                        : passMode === 'single-use'
                        ? t('Generate 1-Time Friend Code', '生成一次性好友口令')
                        : t(`Generate ${timedHours}h Party Code`, `生成 ${timedHours} 小时派对口令`)}
                    </span>
                  </button>
                </form>

                {/* One-time reveal banner */}
                {latestCreated && (
                  <div className="rounded-2xl bg-[#10D98B]/10 border-2 border-[#10D98B]/50 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#10D98B]">
                          {t(
                            'Share This Code With Your Friend (Shown Once)',
                            '请立刻复制发给好友（仅展示一次）'
                          )}
                        </div>
                        <div className="font-mono text-2xl font-black tracking-wider text-white mt-0.5">
                          {latestCreated.code}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="tactile-btn h-10 px-3.5 rounded-xl bg-[#10D98B] hover:bg-[#22E89B] text-[#071A12] font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedTarget === 'code' ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          <span>
                            {copiedTarget === 'code' ? t('Copied!', '已复制') : t('Copy Code', '复制口令')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateMessage}
                          className="tactile-btn h-10 px-3.5 rounded-xl bg-[#00C2FF] hover:bg-[#38D1FF] text-[#07131D] font-extrabold text-xs inline-flex items-center gap-1.5 shadow-[0_3px_0_#0084B0] cursor-pointer"
                        >
                          <MessageSquareText className="w-4 h-4" />
                          <span>{t('Generate Message', '生成邀请消息')}</span>
                        </button>
                      </div>
                    </div>

                    {generatedMessage !== null && (
                      <div className="pt-3 border-t border-[#10D98B]/25 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C2FF]">
                            {t('Ready-to-Send Invite Message', '可直接发送的邀请消息')}
                          </span>
                          <button
                            type="button"
                            onClick={() => void copyTextToClipboard(generatedMessage, 'message')}
                            className="h-8 px-3 rounded-lg bg-[#1E2636] hover:bg-[#273145] border border-[#2F3A4F] text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedTarget === 'message' ? (
                              <Check className="w-3.5 h-3.5 text-[#10D98B]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-[#00C2FF]" />
                            )}
                            <span>
                              {copiedTarget === 'message'
                                ? t('Message Copied!', '消息已复制')
                                : t('Copy Message', '复制消息')}
                            </span>
                          </button>
                        </div>
                        <textarea
                          rows={6}
                          value={generatedMessage}
                          onChange={(e) => setGeneratedMessage(e.target.value)}
                          aria-label={t('Generated guest invite message', '生成的访客邀请消息')}
                          className="w-full rounded-xl bg-[#0B0E14] border border-[#2A354A] focus:border-[#00C2FF] focus:outline-none p-3 text-xs leading-relaxed text-[#E5E7EB] resize-y arcade-scrollbar"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Issued Passes List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                      {t('Issued Guest Passes', '已发放访客口令')} ({passes.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => void refreshPasses()}
                      className="text-xs font-semibold text-[#00C2FF] hover:underline cursor-pointer"
                    >
                      {t('Refresh', '刷新')}
                    </button>
                  </div>

                  {loadingPasses && passes.length === 0 ? (
                    <div className="text-xs text-[#9CA3AF] py-4 text-center">
                      {t('Loading...', '加载中...')}
                    </div>
                  ) : passes.length === 0 ? (
                    <div className="rounded-xl bg-[#10141D] border border-[#222B3B] p-4 text-center text-xs text-[#9CA3AF]">
                      {t('No Guest Passes issued yet.', '暂未生成任何访客口令。')}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto arcade-scrollbar pr-1">
                      {passes.map((p) => {
                        const st = getPassStatus(p);
                        const canRevoke =
                          !p.revoked &&
                          Date.now() <= p.expiresAt &&
                          (p.mode === 'timed' || (p.usesRemaining ?? 0) > 0);
                        return (
                          <div
                            key={p.id}
                            className="rounded-xl bg-[#10141D] border border-[#222B3B] px-3 py-2.5 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white truncate">
                                  {p.label}
                                </span>
                                <span className="font-mono text-[11px] text-[#9CA3AF]">
                                  {p.codeHint}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${st.cls}`}
                                >
                                  {st.text}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#6B7280] mt-0.5">
                                {p.mode === 'single-use'
                                  ? t('Single-use (1 room)', '单次开房有效')
                                  : t(`Timed (${p.durationHours}h)`, `限时 (${p.durationHours} 小时)`)}
                                {' · '}
                                {t('Expires', '过期时间')}:{' '}
                                {new Date(p.expiresAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>

                            {canRevoke && (
                              <button
                                type="button"
                                onClick={() => void handleRevoke(p.id)}
                                className="h-8 px-2.5 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/40 text-[#FF9B8A] hover:text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{t('Revoke', '吊销')}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Persistent Owner Footer: Change Fixed Master PIN / Sign Out */}
            <div className="border-t border-[#222B3B] pt-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#00C2FF] shrink-0" />
                  <span>
                    {t(
                      'Owner Master PIN (shared across all devices — only editable here)',
                      '房主主密码（全设备通用，仅可在此修改）'
                    )}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <form
                  onSubmit={handleRotatePin}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1"
                >
                  <input
                    type="password"
                    maxLength={24}
                    autoComplete="new-password"
                    value={newPin}
                    onChange={(e) => {
                      setNewPin(e.target.value);
                      setPinSavedMsg(null);
                      setErrorMsg(null);
                    }}
                    placeholder={t('New Master PIN (4–24)...', '输入新主密码 (4–24位)...')}
                    aria-label={t('New Master PIN', '新主密码')}
                    className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-[#10141D] border border-[#2A354A] focus:border-[#00C2FF] focus:outline-none text-xs text-white"
                  />
                  <input
                    type="password"
                    maxLength={24}
                    autoComplete="new-password"
                    value={confirmNewPin}
                    onChange={(e) => {
                      setConfirmNewPin(e.target.value);
                      setPinSavedMsg(null);
                      setErrorMsg(null);
                    }}
                    placeholder={t('Confirm PIN...', '确认新密码...')}
                    aria-label={t('Confirm New Master PIN', '确认新主密码')}
                    className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-[#10141D] border border-[#2A354A] focus:border-[#00C2FF] focus:outline-none text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="h-9 px-3.5 rounded-xl bg-[#1E2636] hover:bg-[#273145] text-xs font-bold text-white whitespace-nowrap cursor-pointer"
                  >
                    {t('Update PIN', '更新密码')}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => {
                    clearHostAuthSession();
                    onClose();
                  }}
                  className="h-9 px-3.5 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-[#FF9B8A] inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t('Sign Out Owner', '退出房主登录')}</span>
                </button>
              </div>
            </div>

            {pinSavedMsg && (
              <p className="text-xs font-semibold text-[#10D98B]">{pinSavedMsg}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const OwnerSettingsModal = GuestPassManagerModal;

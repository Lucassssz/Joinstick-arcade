import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  KeyRound,
  Lock,
  Plus,
  ShieldCheck,
  Ticket,
  Trash2,
  X,
} from 'lucide-react';
import {
  changeMasterPin,
  claimInitialMasterPin,
  clearHostAuthSession,
  createGuestPass,
  fetchHostAuthStatus,
  listGuestPasses,
  revokeGuestPass,
  useHostAuthSession,
  verifyHostCode,
  type GuestPassMode,
  type GuestPassSummary,
  type HostAuthStatus,
} from '../lib/hostAuth';
import { useLanguage } from '../lib/i18n';

interface HostUnlockModalProps {
  open: boolean;
  target: 'host' | 'pocket';
  onClose: () => void;
  onUnlocked: () => void;
}

export function HostUnlockModal({ open, target, onClose, onUnlocked }: HostUnlockModalProps) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<HostAuthStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCodeInput('');
    setConfirmPinInput('');
    setErrorMsg(null);
    setLoadingStatus(true);
    fetchHostAuthStatus()
      .then((res) => setStatus(res))
      .catch(() => setStatus({ masterConfigured: true, usingEnvPin: false }))
      .finally(() => setLoadingStatus(false));
  }, [open]);

  if (!open) return null;

  const isFirstRunSetup = status !== null && !status.masterConfigured;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = codeInput.trim();
    if (!trimmed) {
      setErrorMsg(
        isFirstRunSetup
          ? t('Enter a Master PIN (4–24 characters).', '请设置 4–24 位的房主管理密码。')
          : t('Enter your Master PIN or a Friend Guest Pass.', '请输入房主密码或访客临时口令。')
      );
      return;
    }

    if (isFirstRunSetup) {
      if (trimmed.length < 4 || trimmed.length > 24) {
        setErrorMsg(t('Master PIN must be 4–24 characters.', '房主管理密码长度需为 4–24 位。'));
        return;
      }
      if (trimmed !== confirmPinInput.trim()) {
        setErrorMsg(t('PIN confirmation does not match.', '两次输入的密码不一致。'));
        return;
      }
      setSubmitting(true);
      setErrorMsg(null);
      try {
        await claimInitialMasterPin(trimmed);
        onUnlocked();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : t('Failed to save PIN.', '设置失败，请重试。'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await verifyHostCode(trimmed);
      onUnlocked();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
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
            isFirstRunSetup
              ? 'bg-[#10D98B]/15 border-[#10D98B]/40 text-[#10D98B]'
              : 'bg-[#FF4D2E]/20 border-[#FF4D2E]/40 text-[#FF4D2E]'
          }`}
        >
          {isFirstRunSetup ? <ShieldCheck className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
        </div>

        <h2 id="pin-modal-title" className="font-display text-2xl font-extrabold text-white">
          {isFirstRunSetup
            ? t('Set Your Owner Master PIN', '首次设置房主专属密码')
            : target === 'pocket'
            ? t('Unlock Pocket Mode', '解锁掌机开房模式')
            : t('Unlock Host Monitor', '解锁大屏主持端')}
        </h2>

        <p className="mt-2 text-sm text-[#9CA3AF] leading-relaxed">
          {isFirstRunSetup
            ? t(
                'Create your private Master PIN now (or set HOST_MASTER_PIN in Server Secrets). Keep it private and mint temporary Guest Passes whenever lending to friends.',
                '请先设置只有你知道的房主私密密码（也可在环境变量中配置 HOST_MASTER_PIN）。借给朋友游玩时，可在后台生成一次性或限时访客口令，绝不泄露主密码。'
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
              type={isFirstRunSetup ? 'password' : 'text'}
              maxLength={24}
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value);
                setErrorMsg(null);
              }}
              placeholder={isFirstRunSetup ? '••••••' : t('PIN or GP-XXXX-XXXX', '输入密码或访客口令')}
              autoFocus
              autoComplete="off"
              aria-label={
                isFirstRunSetup
                  ? t('New Master PIN', '设置新管理密码')
                  : t('Master PIN or Guest Pass', '管理密码或访客口令')
              }
              className={`w-full h-14 px-4 rounded-xl bg-[#0B0E14] border border-[#2A354A] focus:border-[#00C2FF] focus:outline-none font-mono text-lg sm:text-xl font-bold text-center text-white placeholder:text-[#4B5563] ${
                isFirstRunSetup ? 'tracking-[0.35em]' : 'tracking-[0.14em] uppercase'
              }`}
            />

            {isFirstRunSetup && (
              <input
                type="password"
                maxLength={24}
                value={confirmPinInput}
                onChange={(e) => {
                  setConfirmPinInput(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder={t('Confirm Master PIN', '再次确认管理密码')}
                autoComplete="off"
                aria-label={t('Confirm Master PIN', '再次确认管理密码')}
                className="w-full h-12 px-4 rounded-xl bg-[#0B0E14] border border-[#2A354A] focus:border-[#10D98B] focus:outline-none font-mono text-base font-bold tracking-[0.25em] text-center text-white placeholder:text-[#4B5563]"
              />
            )}

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
                className={`tactile-btn flex-1 h-12 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60 ${
                  isFirstRunSetup
                    ? 'bg-[#10D98B] hover:bg-[#22E89B] text-[#071A12] shadow-[0_3px_0_#0A915D]'
                    : 'bg-[#FF4D2E] hover:bg-[#FF6145] text-white shadow-[0_3px_0_#B82E17]'
                }`}
              >
                {submitting
                  ? t('Verifying...', '验证中...')
                  : isFirstRunSetup
                  ? t('Save & Unlock', '保存并解锁')
                  : t('Unlock', '解锁进入')}
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

export function GuestPassManagerModal({ open, onClose }: GuestPassManagerModalProps) {
  const { t } = useLanguage();
  const session = useHostAuthSession();
  const [passes, setPasses] = useState<GuestPassSummary[]>([]);
  const [usingEnvPin, setUsingEnvPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [friendLabel, setFriendLabel] = useState('');
  const [passMode, setPassMode] = useState<GuestPassMode>('single-use');
  const [timedHours, setTimedHours] = useState<number>(4);
  const [creating, setCreating] = useState(false);
  const [latestCreatedCode, setLatestCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [newPin, setNewPin] = useState('');
  const [pinSavedMsg, setPinSavedMsg] = useState<string | null>(null);

  const refreshPasses = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listGuestPasses();
      setPasses(data.passes);
      setUsingEnvPin(data.usingEnvPin);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('Failed to load passes', '加载失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open || session?.role !== 'master') return;
    setLatestCreatedCode(null);
    setPinSavedMsg(null);
    setNewPin('');
    void refreshPasses();
  }, [open, session?.role, refreshPasses]);

  if (!open) return null;

  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setErrorMsg(null);
    try {
      const created = await createGuestPass({
        label: friendLabel.trim() || undefined,
        mode: passMode,
        hours: timedHours,
      });
      setLatestCreatedCode(created.code);
      setFriendLabel('');
      setCopied(false);
      await refreshPasses();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('Could not create pass', '生成口令失败'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!latestCreatedCode) return;
    try {
      await navigator.clipboard.writeText(latestCreatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
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
    setErrorMsg(null);
    try {
      await changeMasterPin(trimmed);
      setNewPin('');
      setPinSavedMsg(t('Master PIN updated.', '房主管理密码已更新。'));
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('Host Access & Friend Guest Passes', '房主权限与访客临时口令')}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#0B0E14]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-xl w-full rounded-3xl bg-[#151B26] border-2 border-[#2A354A] shadow-2xl p-5 sm:p-6 text-left max-h-[90vh] overflow-y-auto arcade-scrollbar"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#222B3B] pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/40 text-[#00C2FF] flex items-center justify-center shrink-0">
              <Ticket className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-extrabold text-white truncate">
                {t('Friend Guest Passes', '访客临时口令')}
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                {t(
                  'Lend access to friends with disposable codes — your Master PIN stays secret.',
                  '借给朋友开房无需透露主密码，用完即废或限时自动失效。'
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
              'Only the Owner unlocked with the Master PIN can mint or revoke Guest Passes.',
              '仅使用房主管理密码解锁时，可生成或吊销访客临时口令。'
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* Mint Form */}
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
            {latestCreatedCode && (
              <div className="rounded-2xl bg-[#10D98B]/10 border-2 border-[#10D98B]/50 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#10D98B]">
                    {t('Share This Code With Your Friend (Shown Once)', '请立刻复制发给好友（仅展示一次）')}
                  </div>
                  <div className="font-mono text-2xl font-black tracking-wider text-white mt-0.5">
                    {latestCreatedCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="tactile-btn h-10 px-4 rounded-xl bg-[#10D98B] hover:bg-[#22E89B] text-[#071A12] font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? t('Copied!', '已复制') : t('Copy Code', '复制口令')}</span>
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/40 px-3 py-2 text-xs font-semibold text-[#FF9B8A]">
                {errorMsg}
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

              {loading && passes.length === 0 ? (
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
                            <span className="text-xs font-bold text-white truncate">{p.label}</span>
                            <span className="font-mono text-[11px] text-[#9CA3AF]">{p.codeHint}</span>
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${st.cls}`}>
                              {st.text}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#6B7280] mt-0.5">
                            {p.mode === 'single-use'
                              ? t('Single-use (1 room)', '单次开房有效')
                              : t(`Timed (${p.durationHours}h)`, `限时 (${p.durationHours} 小时)`)}
                            {' · '}
                            {t('Expires', '过期时间')}: {new Date(p.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

            {/* Rotate Master PIN / Lock */}
            <div className="border-t border-[#222B3B] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {usingEnvPin ? (
                <div className="text-[11px] text-[#9CA3AF] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#00C2FF] shrink-0" />
                  <span>
                    {t(
                      'Master PIN is managed via HOST_MASTER_PIN env secret.',
                      '主密码当前由服务端 HOST_MASTER_PIN 环境变量托管。'
                    )}
                  </span>
                </div>
              ) : (
                <form onSubmit={handleRotatePin} className="flex items-center gap-2 flex-1">
                  <input
                    type="password"
                    maxLength={24}
                    value={newPin}
                    onChange={(e) => {
                      setNewPin(e.target.value);
                      setPinSavedMsg(null);
                    }}
                    placeholder={t('Rotate Master PIN...', '更换新的房主密码...')}
                    className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-[#10141D] border border-[#2A354A] focus:border-[#00C2FF] focus:outline-none text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="h-9 px-3 rounded-xl bg-[#1E2636] hover:bg-[#273145] text-xs font-bold text-white whitespace-nowrap cursor-pointer"
                  >
                    {t('Update PIN', '更新密码')}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  clearHostAuthSession();
                  onClose();
                }}
                className="h-9 px-3.5 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-[#FF9B8A] inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{t('Lock Access', '锁定权限')}</span>
              </button>
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

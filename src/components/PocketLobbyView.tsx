import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeftRight,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Crown,
  Dices,
  Filter,
  LogOut,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  Power,
  QrCode,
  Search,
  Share2,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  filterGamesByPlayerMode,
  getGameGenre,
  getGameMeta,
  PLAYER_FILTER_OPTIONS,
} from '../shared/games';
import { getMutatorSpec } from '../shared/modifiers';
import { getTeamsForMode, getTeamSpec, TEAM_MODE_OPTIONS, type TeamId, type TeamMode } from '../shared/party';
import type {
  BotDifficulty,
  GameId,
  PlayerFilterMode,
  PlayerSummary,
  RoomSnapshot,
} from '../shared/types';
import {
  getLocalizedDifficulty,
  getLocalizedFilterLabel,
  getLocalizedGameMeta,
  LanguageToggle,
  useLanguage,
} from '../lib/i18n';
import { getJoinUrl } from '../lib/ws';
import { copyRoomInvite, shareRoomInvite } from '../lib/shareInvite';
import { GameThumbnail } from './GameThumbnail';
import { PlayerAvatar } from './PlayerAvatar';
import { RuleChatbotDrawer } from './RuleChatbotDrawer';

const DIFFICULTY_CYCLE: BotDifficulty[] = ['chill', 'arcade', 'spicy'];

interface PocketLobbyViewProps {
  room: RoomSnapshot;
  me: PlayerSummary;
  isRoomHost: boolean;
  isFullscreen: boolean;
  pocketMuted: boolean;
  errorMsg: string | null;
  quickEmotes: readonly string[];
  avatarPickerOverlay: ReactNode;
  passHostOverlay: ReactNode;
  closeRoomOverlay: ReactNode;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onOpenAvatarPicker: () => void;
  onOpenSettings: () => void;
  onOpenPassHost: () => void;
  onOpenCloseRoom: () => void;
  onLeave: () => void;
  onToggleReady: () => void;
  onSelectGame: (gameId: GameId, settingValue?: number) => void;
  onChangeFilter: (filter: PlayerFilterMode) => void;
  onStartMatch: () => void;
  onStartTournament: () => void;
  onAddBot: () => void;
  onCycleBotDifficulty: (next: BotDifficulty) => void;
  onCycleTeamMode: (next: TeamMode) => void;
  onCycleMyTeam: (next: TeamId) => void;
  onShuffleTeams: () => void;
  onSpinMutator: () => void;
  onSendEmote: (emoji: string) => void;
}

export function PocketLobbyView({
  room,
  me,
  isRoomHost,
  isFullscreen,
  pocketMuted,
  errorMsg,
  quickEmotes,
  avatarPickerOverlay,
  passHostOverlay,
  closeRoomOverlay,
  onToggleMute,
  onToggleFullscreen,
  onOpenAvatarPicker,
  onOpenSettings,
  onOpenPassHost,
  onOpenCloseRoom,
  onLeave,
  onToggleReady,
  onSelectGame,
  onChangeFilter,
  onStartMatch,
  onStartTournament,
  onAddBot,
  onCycleBotDifficulty,
  onCycleTeamMode,
  onCycleMyTeam,
  onShuffleTeams,
  onSpinMutator,
  onSendEmote,
}: PocketLobbyViewProps) {
  const { lang, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [ruleBotOpen, setRuleBotOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<null | 'shared' | 'copied'>(null);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFilterOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filterOpen]);

  const selectedMeta = getLocalizedGameMeta(getGameMeta(room.selectedGameId), lang);
  const activeMutatorSpec = getMutatorSpec(room.activeMutator);
  const connectedHumans = room.players.filter((p) => !p.isBot && p.connected);
  const readyHumans = connectedHumans.filter((p) => p.ready);
  const allHumansReady = room.readyGate.allHumansReady;
  const botCount = room.players.filter((p) => p.isBot).length;
  const hostPlayer = room.players.find((p) => p.id === room.hostPlayerId);
  const diffInfo = getLocalizedDifficulty(room.botDifficulty, lang);

  const visibleGames = useMemo(() => {
    const base = filterGamesByPlayerMode(room.lobbyFilter);
    const q = searchQuery.trim().toLowerCase();
    const localized = base.map((raw) => ({ raw, loc: getLocalizedGameMeta(raw, lang) }));
    if (!q) return localized.map((x) => x.loc);
    return localized
      .filter(({ raw, loc }) =>
        [raw.name, raw.category, raw.tagline, loc.name, loc.category, loc.tagline]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
      .map((x) => x.loc);
  }, [room.lobbyFilter, searchQuery, lang]);

  useEffect(() => {
    if (!qrOpen) return;
    const url = getJoinUrl(room.code, lang);
    QRCode.toDataURL(url, {
      width: 240,
      margin: 2,
      color: { dark: '#121419', light: '#FFFFFF' },
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch(() => setQrDataUrl(''));
  }, [qrOpen, room.code, lang]);

  useEffect(() => {
    return () => {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    };
  }, []);

  const handleOneTapShare = async () => {
    const result = await shareRoomInvite({
      roomCode: room.code,
      lang,
      gameName: selectedMeta.name,
    });
    if (result === 'shared' || result === 'copied') {
      setShareFeedback(result);
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
      shareTimerRef.current = setTimeout(() => setShareFeedback(null), 1800);
    }
  };

  const handleCopyInvite = async () => {
    const ok = await copyRoomInvite(room.code, lang);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1600);
    }
  };

  const handleNextBotDifficulty = () => {
    const curIdx = DIFFICULTY_CYCLE.indexOf(room.botDifficulty);
    onCycleBotDifficulty(DIFFICULTY_CYCLE[(curIdx + 1) % DIFFICULTY_CYCLE.length]);
  };

  const handleNextTeamMode = () => {
    const curIdx = TEAM_MODE_OPTIONS.findIndex((o) => o.id === room.teamMode);
    const next = TEAM_MODE_OPTIONS[(curIdx + 1) % TEAM_MODE_OPTIONS.length];
    onCycleTeamMode(next.id);
  };

  const handleCyclePlayerTeam = () => {
    if (room.teamMode === 'ffa') return;
    const teams = getTeamsForMode(room.teamMode);
    if (teams.length === 0) return;
    const curIdx = me.teamId ? teams.indexOf(me.teamId) : -1;
    onCycleMyTeam(teams[(curIdx + 1) % teams.length]);
  };

  const handlePickRandomGame = () => {
    const pool = visibleGames.length > 0 ? visibleGames : [selectedMeta];
    const candidates =
      pool.length > 1 ? pool.filter((g) => g.id !== room.selectedGameId) : pool;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    if (!chosen) return;
    onSelectGame(chosen.id, chosen.defaultSetting);
    requestAnimationFrame(() => {
      const el = railRef.current?.querySelector<HTMLElement>(
        `[data-pocket-game-id="${chosen.id}"]`
      );
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  };

  const myTeamSpec = room.teamMode !== 'ffa' ? getTeamSpec(me.teamId) : null;

  return (
    <div className="relative flex flex-col h-full w-full max-w-6xl mx-auto gap-1.5 overflow-hidden">
      {avatarPickerOverlay}
      {passHostOverlay}
      {closeRoomOverlay}

      {/* Invite QR Modal */}
      {qrOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('Invite friends to Pocket Room', '邀请好友加入掌机联机房')}
          onClick={() => setQrOpen(false)}
          className="absolute inset-0 z-50 bg-[#0B0E14]/92 backdrop-blur-md p-4 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#161B24] border border-[#2A354A] p-4 flex items-center gap-4 shadow-2xl"
          >
            <div className="w-36 h-36 rounded-xl bg-white p-2 flex items-center justify-center shrink-0">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={t(`Join code ${room.code}`, `房间码 ${room.code}`)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <QrCode className="w-16 h-16 text-[#121419]" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-[#00C2FF]">
                    {t('Pocket Mode Invite', '掌机模式邀请')}
                  </div>
                  <div className="font-mono text-2xl font-black tracking-[0.22em] text-white">
                    {room.code}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQrOpen(false)}
                  aria-label={t('Close invite dialog', '关闭邀请窗口')}
                  className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-[#9CA3AF] leading-snug">
                {t(
                  'Friends scan this QR or tap Join with Phone and enter the 4-letter code.',
                  '好友用手机扫码或在首页输入 4 位房间码即可直接加入同屏联机。'
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOneTapShare}
                  className="tactile-btn h-9 flex-1 rounded-xl bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219] font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {shareFeedback ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>
                    {shareFeedback === 'shared'
                      ? t('Invite Shared!', '已分享邀请！')
                      : shareFeedback === 'copied'
                      ? t('Link Copied!', '已复制链接！')
                      : t('Share Invite', '一键分享邀请')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="h-9 px-3 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-[#10D98B]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? t('Copied', '已复制') : t('Copy', '复制')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Party & Host Controls Drawer */}
      {partyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('Party roster and settings', '玩家队伍与房间设置')}
          onClick={() => setPartyOpen(false)}
          className="absolute inset-0 z-40 bg-[#0B0E14]/82 backdrop-blur-sm p-3 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-full rounded-2xl bg-[#161B24] border border-[#2C374B] p-3.5 flex flex-col gap-2.5 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00C2FF]" />
                <span className="font-display font-extrabold text-sm text-white">
                  {t('Party Roster', '玩家列表')} ({room.players.length}/8)
                </span>
                <span className="text-[11px] font-mono text-[#10D98B]">
                  {readyHumans.length}/{connectedHumans.length} {t('Ready', '已准备')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isRoomHost && room.players.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPartyOpen(false);
                      onOpenPassHost();
                    }}
                    className="h-7 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2F3747] text-[11px] font-bold text-[#FFB800] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    {t('Manage', '管理')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPartyOpen(false)}
                  aria-label={t('Close party drawer', '关闭玩家窗口')}
                  className="h-7 w-7 rounded-lg bg-[#242A36] hover:bg-[#2F3747] text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto arcade-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {room.players.map((p) => {
                const pTeam = room.teamMode !== 'ffa' ? getTeamSpec(p.teamId) : null;
                const pIsHost = !p.isBot && room.hostPlayerId === p.id;
                return (
                  <div
                    key={p.id}
                    className="px-2.5 py-1.5 rounded-xl bg-[#10131A] border border-[#222938] flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PlayerAvatar avatarId={p.avatarId} colorHex={p.color.hex} size="xs" />
                      <div className="min-w-0 leading-tight">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                          <span className="truncate">{p.name}</span>
                          {pIsHost && <Crown className="w-3 h-3 text-[#FFB800] shrink-0" />}
                          {p.isBot && <Bot className="w-3 h-3 text-[#00C2FF] shrink-0" />}
                        </div>
                        <div className="text-[10px] text-[#9CA3AF] truncate">
                          {pTeam ? `${pTeam.emoji} ${lang === 'zh' ? pTeam.nameZh : pTeam.shortName} · ` : ''}
                          {p.isBot
                            ? t('Bot', '机器人')
                            : p.connected
                            ? p.ready
                              ? t('Ready', '已准备')
                              : t('Waiting', '未准备')
                            : t('Offline', '离线')}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-extrabold shrink-0 ${
                        p.ready ? 'text-[#10D98B]' : 'text-[#FFB800]'
                      }`}
                    >
                      {p.ready ? '✓' : '…'}
                    </span>
                  </div>
                );
              })}
            </div>

            {isRoomHost ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#242B3A] shrink-0">
                <button
                  type="button"
                  onClick={onAddBot}
                  className="h-8 px-3 rounded-lg bg-[#212735] hover:bg-[#2A3244] text-xs font-bold text-white inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#00C2FF]" />
                  <span>{t('Add Bot', '加机器人')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextBotDifficulty}
                  className="h-8 px-3 rounded-lg bg-[#212735] hover:bg-[#2A3244] text-xs font-bold text-[#D1D5DB] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5 text-[#FFB800]" />
                  <span>{diffInfo.label}</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextTeamMode}
                  className="h-8 px-3 rounded-lg bg-[#212735] hover:bg-[#2A3244] text-xs font-bold text-[#D1D5DB] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5 text-[#10D98B]" />
                  <span>
                    {(() => {
                      const modeOpt = TEAM_MODE_OPTIONS.find((o) => o.id === room.teamMode);
                      if (!modeOpt) return t('FFA', '混战');
                      return lang === 'zh' ? modeOpt.labelZh : modeOpt.label;
                    })()}
                  </span>
                </button>
                {room.teamMode !== 'ffa' && (
                  <>
                    {myTeamSpec && (
                      <button
                        type="button"
                        onClick={handleCyclePlayerTeam}
                        className="h-8 px-2.5 rounded-lg bg-[#10131A] border border-[#262E3E] text-xs font-bold text-white cursor-pointer"
                      >
                        {myTeamSpec.emoji} {lang === 'zh' ? myTeamSpec.nameZh : myTeamSpec.shortName}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onShuffleTeams}
                      className="h-8 px-2.5 rounded-lg bg-[#10131A] border border-[#262E3E] text-xs font-bold text-[#00C2FF] cursor-pointer"
                    >
                      {t('Shuffle Teams', '随机分队')}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#242B3A] shrink-0">
                {myTeamSpec ? (
                  <button
                    type="button"
                    onClick={handleCyclePlayerTeam}
                    className="h-8 px-3 rounded-lg bg-[#212735] text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{myTeamSpec.emoji}</span>
                    <span>{lang === 'zh' ? myTeamSpec.nameZh : myTeamSpec.shortName}</span>
                  </button>
                ) : (
                  <span className="text-xs text-[#9CA3AF]">
                    {t('Send a quick reaction:', '发送快捷表情：')}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  {quickEmotes.slice(0, 5).map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onSendEmote(emoji)}
                      className="h-8 w-8 rounded-lg bg-[#212735] hover:bg-[#2A3244] text-sm flex items-center justify-center cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Slim Header + Collapsible Party Pill */}
      <div className="flex items-center justify-between gap-2 h-9 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenAvatarPicker}
            title={t('Tap to change avatar', '点击更换头像')}
            className="shrink-0 cursor-pointer hover:scale-105 transition-transform"
          >
            <PlayerAvatar avatarId={me.avatarId} colorHex={me.color.hex} size="xs" />
          </button>

          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1 text-xs font-extrabold text-white truncate">
              <span className="truncate">{me.name}</span>
              {isRoomHost && <Crown className="w-3 h-3 text-[#FFB800] shrink-0" />}
              <span className="font-mono text-[10px] text-[#00C2FF] bg-[#00C2FF]/12 px-1.5 py-0.2 rounded ml-0.5 shrink-0">
                {room.code}
              </span>
            </div>
          </div>

          {/* Collapsible Party Dock Trigger */}
          <button
            type="button"
            onClick={() => setPartyOpen(true)}
            className="h-7 px-2 rounded-lg bg-[#171C27] hover:bg-[#1E2534] border border-[#2B3548] inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
          >
            <div className="flex items-center -space-x-1">
              {room.players.slice(0, 4).map((p) => (
                <span
                  key={p.id}
                  className="w-2.5 h-2.5 rounded-full border border-[#121419]"
                  style={{ backgroundColor: p.color.hex }}
                />
              ))}
            </div>
            <span className="text-[11px] font-bold text-white tabular-nums">
              {room.players.length}/8
            </span>
            <span className="text-[10px] font-mono text-[#10D98B] tabular-nums hidden sm:inline">
              {readyHumans.length}/{connectedHumans.length}✓
            </span>
            {botCount > 0 && (
              <span className="text-[10px] font-mono text-[#00C2FF] hidden md:inline">
                +{botCount}🤖
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-[#9CA3AF]" />
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleOneTapShare}
            title={t('1-tap share room invite link', '一键分享房间邀请链接')}
            className={`tactile-btn h-7 px-2.5 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors ${
              shareFeedback
                ? 'bg-[#10D98B] text-[#0A1913]'
                : 'bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219]'
            }`}
          >
            {shareFeedback ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>
              {shareFeedback === 'shared'
                ? t('Shared!', '已分享!')
                : shareFeedback === 'copied'
                ? t('Copied!', '已复制!')
                : t('Share', '邀请')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setQrOpen(true)}
            aria-label={t('Show room QR code', '显示房间二维码')}
            title={t('Show QR Code', '扫码加入二维码')}
            className="h-7 w-7 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#00C2FF] flex items-center justify-center cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={pocketMuted ? t('Unmute sound', '开启音效') : t('Mute sound', '静音音效')}
            className={`h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer ${
              pocketMuted
                ? 'bg-[#242A36] text-[#9CA3AF]'
                : 'bg-[#10D98B]/20 border border-[#10D98B]/50 text-[#10D98B]'
            }`}
          >
            {pocketMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setRuleBotOpen(true)}
            aria-label={t('Guide Bot', '平台助手')}
            title={t('Guide Bot', '平台助手')}
            className="h-7 px-2 rounded-lg bg-[#00C2FF]/18 hover:bg-[#00C2FF]/28 border border-[#00C2FF]/45 text-[#00C2FF] inline-flex items-center gap-1 text-[10px] font-extrabold cursor-pointer whitespace-nowrap"
          >
            <Bot className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t('Guide', '平台助手')}</span>
          </button>

          <LanguageToggle compact className="h-7" />

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t('Controller settings', '手柄设置')}
            className="h-7 w-7 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#00C2FF] flex items-center justify-center cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')}
            className="h-7 w-7 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] flex items-center justify-center cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onLeave}
            aria-label={t('Leave room', '退出房间')}
            className="h-7 w-7 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] flex items-center justify-center cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>

          {isRoomHost && (
            <button
              type="button"
              onClick={onOpenCloseRoom}
              aria-label={t('Close Entire Room', '关闭整个房间')}
              className="h-7 w-7 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-[#FF9B8A] hover:text-white flex items-center justify-center cursor-pointer"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Full-Width Visual Game Showcase Stage */}
      <div className="flex-1 min-h-0 flex flex-col gap-1.5">
        {isRoomHost ? (
          <>
            {/* Search + Collapsible Filter + Discovery Controls */}
            <div className="flex items-center justify-between gap-1.5 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div className="relative flex-1 min-w-[110px] max-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('Search…', '搜索…')}
                    className="w-full h-7 pl-7 pr-2 rounded-lg bg-[#161B24] border border-[#283142] focus:border-[#00C2FF] focus:outline-none text-xs text-white placeholder:text-[#6B7280]"
                  />
                </div>

                <div ref={filterRef} className="relative shrink-0">
                  <button
                    type="button"
                    aria-expanded={filterOpen}
                    aria-haspopup="listbox"
                    onClick={() => setFilterOpen((prev) => !prev)}
                    className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                      room.lobbyFilter !== 'all' || filterOpen
                        ? 'bg-[#00C2FF]/15 border-[#00C2FF] text-[#00C2FF]'
                        : 'bg-[#161B24] border-[#283142] hover:border-[#3D4B66] text-[#D1D5DB]'
                    }`}
                  >
                    <Filter className="w-3 h-3 shrink-0" />
                    <span>
                      {room.lobbyFilter === 'all'
                        ? t('Filter', '筛选')
                        : getLocalizedFilterLabel(room.lobbyFilter, lang, true)}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
                        filterOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {filterOpen && (
                    <div
                      role="listbox"
                      aria-label={t('Filter games', '筛选游戏')}
                      className="absolute left-0 top-full mt-1.5 z-30 w-60 sm:w-68 rounded-xl bg-[#161B24]/98 backdrop-blur-md border border-[#2C374B] p-2 shadow-2xl grid grid-cols-2 gap-1.5"
                    >
                      {PLAYER_FILTER_OPTIONS.map((opt) => {
                        const active = room.lobbyFilter === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => {
                              onChangeFilter(opt.id);
                              setFilterOpen(false);
                            }}
                            className={`h-7 px-2.5 rounded-lg text-[11px] font-bold text-left inline-flex items-center justify-between gap-1 cursor-pointer transition-colors ${
                              active
                                ? 'bg-[#00C2FF] text-[#0B1219]'
                                : 'bg-[#10131A] border border-[#242C3D] text-[#D1D5DB] hover:border-[#3D4B66] hover:text-white'
                            }`}
                          >
                            <span className="truncate">
                              {getLocalizedFilterLabel(opt.id, lang, true)}
                            </span>
                            {active && <Check className="w-3 h-3 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handlePickRandomGame}
                  title={t('Pick a random game', '随机选一款游戏')}
                  className="h-7 px-2 rounded-lg bg-[#161B24] border border-[#283142] hover:border-[#10D98B] text-[11px] font-bold text-[#10D98B] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span className="hidden sm:inline">{t('Random', '随机')}</span>
                </button>

                <button
                  type="button"
                  onClick={onSpinMutator}
                  title={t('Spin Chaos Rule', '随机混沌规则')}
                  className="h-7 px-2 rounded-lg bg-[#161B24] border border-[#283142] hover:border-[#FFB800] text-[11px] font-bold text-white inline-flex items-center gap-1 cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5" style={{ color: activeMutatorSpec.accentHex }} />
                  <span className="truncate max-w-[68px] hidden sm:inline">
                    {room.activeMutator === 'normal'
                      ? t('Chaos', '混沌')
                      : lang === 'zh'
                      ? activeMutatorSpec.shortTagZh
                      : activeMutatorSpec.shortTag}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onStartTournament}
                  title={t('Start 5-Game Cup', '开启 5 局锦标赛')}
                  className="h-7 px-2 rounded-lg bg-[#FFB800] hover:bg-[#FFC933] text-[#14120B] text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trophy className="w-3 h-3" />
                  <span className="hidden sm:inline">{t('Cup', '锦标赛')}</span>
                </button>
              </div>
            </div>

            {/* Visual Showcase Rail */}
            <div
              ref={railRef}
              className="flex-1 min-h-0 flex items-stretch gap-2.5 overflow-x-auto arcade-scrollbar pb-1 px-0.5 snap-x snap-mandatory"
            >
              {visibleGames.length === 0 ? (
                <div className="w-full flex flex-col items-center justify-center text-center py-6 text-xs text-[#9CA3AF]">
                  <span>{t('No matching games found.', '没有找到匹配的游戏。')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      onChangeFilter('all');
                    }}
                    className="mt-2 px-3 py-1 rounded-lg bg-[#242A36] text-white font-bold cursor-pointer"
                  >
                    {t('Show All Games', '显示全部游戏')}
                  </button>
                </div>
              ) : (
                visibleGames.map((g) => {
                  const selected = g.id === room.selectedGameId;
                  const genre = getGameGenre(g.id);
                  return (
                    <button
                      key={g.id}
                      data-pocket-game-id={g.id}
                      type="button"
                      onClick={() => onSelectGame(g.id, g.defaultSetting)}
                      className={`group relative rounded-2xl border text-left overflow-hidden flex flex-col transition-all cursor-pointer w-[176px] sm:w-[208px] shrink-0 snap-center h-full ${
                        selected
                          ? 'bg-[#152436] border-[#00C2FF] ring-2 ring-[#00C2FF]/65 shadow-[0_6px_22px_rgba(0,194,255,0.22)]'
                          : 'bg-[#141822] border-[#242C3D] hover:border-[#3D4B66]'
                      }`}
                    >
                      <div className="relative w-full overflow-hidden shrink-0 flex-1 min-h-[76px]">
                        <GameThumbnail
                          gameId={g.id}
                          gameName={g.name}
                          accentHex={g.accentHex}
                          fallbackSrc={g.coverImage}
                          eager={selected}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#10131C] via-transparent to-black/35 pointer-events-none" />

                        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none">
                          <span
                            className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-extrabold uppercase tracking-wide truncate"
                            style={{ color: g.accentHex }}
                          >
                            {getLocalizedFilterLabel(genre, lang, true)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm font-mono text-[9px] font-bold text-[#E5E7EB] shrink-0">
                            {g.playerModeLabel}
                          </span>
                        </div>

                        {selected && (
                          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[#00C2FF] text-[#0B1219] font-mono text-[9px] font-black uppercase shadow">
                            {t('SELECTED', '已选')}
                          </span>
                        )}
                      </div>

                      <div className="px-2.5 py-1.5 shrink-0 bg-[#121620]">
                        <div className="font-display font-extrabold text-xs sm:text-sm text-white truncate">
                          {g.name}
                        </div>
                        <div className="text-[10px] text-[#9CA3AF] truncate mt-0.5">
                          {g.tagline}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* Non-Host Friend Full-Width Selected Game Hero Preview */
          <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5 bg-[#151923] border border-[#262E3E] rounded-2xl p-2.5 overflow-hidden">
            <div className="col-span-5 relative rounded-xl overflow-hidden border border-white/10 bg-[#0D1017]">
              <GameThumbnail
                gameId={selectedMeta.id}
                gameName={selectedMeta.name}
                accentHex={selectedMeta.accentHex}
                fallbackSrc={selectedMeta.coverImage}
                eager
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1">
                <span className="px-2 py-0.5 rounded-md bg-black/75 text-[#FFB800] text-[10px] font-bold inline-flex items-center gap-1 truncate">
                  <Crown className="w-3 h-3 shrink-0" />
                  {t(`${hostPlayer?.name ?? 'Host'} Pick`, `${hostPlayer?.name ?? '房主'} 选定`)}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-black/75 font-mono text-[10px] text-white shrink-0">
                  {selectedMeta.playerModeLabel}
                </span>
              </div>
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
                {quickEmotes.slice(0, 5).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onSendEmote(emoji)}
                    className="h-7 w-7 rounded-lg bg-black/65 hover:bg-black/85 border border-white/15 text-sm flex items-center justify-center cursor-pointer shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-7 flex flex-col justify-between min-h-0 gap-2 overflow-y-auto arcade-scrollbar pr-0.5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: selectedMeta.accentHex }}
                  >
                    {selectedMeta.category}
                  </span>
                  {room.activeMutator !== 'normal' && (
                    <span
                      className="px-2 py-0.5 rounded-md bg-[#10131A] border border-[#262E3E] text-[10px] font-bold inline-flex items-center gap-1"
                      style={{ color: activeMutatorSpec.accentHex }}
                    >
                      <Dices className="w-3 h-3" />
                      {lang === 'zh' ? activeMutatorSpec.nameZh : activeMutatorSpec.name}
                    </span>
                  )}
                </div>
                <h2 className="font-display text-lg sm:text-xl font-black text-white truncate">
                  {selectedMeta.name}
                </h2>
                <p className="text-xs text-[#A5AEBD] mt-1 leading-snug line-clamp-2">
                  {selectedMeta.description}
                </p>
              </div>

              <div className="p-2 rounded-xl bg-[#10131A] border border-[#222938] space-y-1 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#00C2FF]">
                  {t('Pocket Controls', '掌机操作指南')}
                </div>
                <p className="text-[11px] text-[#D1D5DB] leading-snug">
                  {selectedMeta.controllerSchema.controlTip}
                </p>
                <div className="pt-0.5 flex items-center gap-4 text-[11px] text-[#9CA3AF]">
                  <span>
                    A: <strong className="text-white">{selectedMeta.controllerSchema.actionA.label}</strong>
                  </span>
                  <span>
                    B: <strong className="text-white">{selectedMeta.controllerSchema.actionB.label}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Sticky Bottom Launch Dock (Selected Settings + Ready & Start) */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-2xl bg-[#161B24] border border-[#262E3E] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: selectedMeta.accentHex }}
              />
              <span className="font-display font-extrabold text-xs sm:text-sm text-white truncate">
                {selectedMeta.name}
              </span>
              {room.activeMutator !== 'normal' && (
                <span
                  className="px-1.5 py-0.5 rounded bg-[#10131A] font-mono text-[9px] font-black shrink-0"
                  style={{ color: activeMutatorSpec.accentHex }}
                >
                  {lang === 'zh' ? activeMutatorSpec.shortTagZh : activeMutatorSpec.shortTag}
                </span>
              )}
            </div>
            {errorMsg ? (
              <p className="text-[10px] font-semibold text-[#FF9B8A] truncate">{errorMsg}</p>
            ) : (
              <p className="text-[10px] text-[#9CA3AF] truncate hidden sm:block">
                {selectedMeta.tagline}
              </p>
            )}
          </div>

          {isRoomHost && selectedMeta.settingOptions.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {selectedMeta.settingOptions.map((opt) => {
                const active = room.gameSettingValue === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSelectGame(room.selectedGameId, opt.value)}
                    className={`h-7 px-2 rounded-lg text-[10px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-[#FF4D2E] text-white'
                        : 'bg-[#10131A] border border-[#252E3F] text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleReady}
            className="tactile-btn h-9 px-3.5 sm:px-4 rounded-xl font-display font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            style={
              me.ready
                ? {
                    backgroundColor: '#10D98B',
                    color: '#0A1913',
                    boxShadow: '0 3px 0 #0A915D',
                  }
                : {
                    backgroundColor: me.color.hex,
                    color: me.color.textOnColor,
                    boxShadow: `0 3px 0 ${me.color.dark}`,
                  }
            }
          >
            {me.ready && <Check className="w-4 h-4 shrink-0" />}
            <span>{me.ready ? t('Ready!', '已准备!') : t('Tap Ready', '点击准备')}</span>
          </button>

          {isRoomHost && (
            <button
              type="button"
              onClick={onStartMatch}
              className={`tactile-btn h-9 px-4 rounded-xl font-display font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-1 cursor-pointer shrink-0 whitespace-nowrap ${
                allHumansReady
                  ? 'bg-[#FF4D2E] hover:bg-[#FF6145] text-white shadow-[0_3px_0_#B82E17]'
                  : 'bg-[#242A36] text-[#9CA3AF]'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{t('Start', '开始')}</span>
            </button>
          )}
        </div>
      </div>

      <RuleChatbotDrawer
        isOpen={ruleBotOpen}
        onClose={() => setRuleBotOpen(false)}
        activeGameId={room.selectedGameId}
      />
    </div>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeftRight,
  Bot,
  Check,
  Copy,
  Crown,
  Dices,
  LogOut,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  Power,
  QrCode,
  Search,
  Shuffle,
  SlidersHorizontal,
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
import { PlayerAvatar } from './PlayerAvatar';

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
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

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

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(getJoinUrl(room.code, lang));
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1600);
    } catch {
      // Ignore clipboard failure on restricted browsers
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

  const myTeamSpec = room.teamMode !== 'ffa' ? getTeamSpec(me.teamId) : null;

  return (
    <div className="relative flex flex-col h-full w-full max-w-6xl mx-auto gap-2 overflow-hidden">
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
              <button
                type="button"
                onClick={handleCopyInvite}
                className="tactile-btn h-9 w-full rounded-xl bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219] font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>
                  {copiedLink
                    ? t('Invite Link Copied!', '已复制邀请链接！')
                    : t('Copy Invite Link', '复制邀请链接')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Pocket Room Bar */}
      <div className="flex items-center justify-between gap-2 h-10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenAvatarPicker}
            title={t('Tap to change avatar', '点击更换头像')}
            className="shrink-0 cursor-pointer hover:scale-105 transition-transform"
          >
            <PlayerAvatar avatarId={me.avatarId} colorHex={me.color.hex} size="sm" />
          </button>

          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-white truncate">
              <span className="truncate">{me.name}</span>
              {isRoomHost && <Crown className="w-3.5 h-3.5 text-[#FFB800] shrink-0" />}
            </div>
            <div className="text-[11px] text-[#9CA3AF] font-mono tabular-nums truncate">
              {t('Pocket', '掌机房')} · {room.code} · {readyHumans.length}/{connectedHumans.length}{' '}
              {t('Ready', '已准备')}
              {botCount > 0 ? ` · +${botCount} ${t('Bots', '机器人')}` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="tactile-btn h-8 px-2.5 rounded-lg bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219] text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{t('Invite', '邀请')}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={pocketMuted ? t('Unmute sound', '开启音效') : t('Mute sound', '静音音效')}
            className={`h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer ${
              pocketMuted
                ? 'bg-[#242A36] text-[#9CA3AF]'
                : 'bg-[#10D98B]/20 border border-[#10D98B]/50 text-[#10D98B]'
            }`}
          >
            {pocketMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <LanguageToggle compact className="h-8" />

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t('Controller settings', '手柄设置')}
            className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#00C2FF] flex items-center justify-center cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')}
            className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] flex items-center justify-center cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onLeave}
            aria-label={t('Leave room', '退出房间')}
            className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] flex items-center justify-center cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>

          {isRoomHost && (
            <button
              type="button"
              onClick={onOpenCloseRoom}
              aria-label={t('Close Entire Room', '关闭整个房间')}
              className="h-8 w-8 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-[#FF9B8A] hover:text-white flex items-center justify-center cursor-pointer"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Mobile Landscape Pocket Lobby */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5">
        {/* LEFT COLUMN (5 cols): Roster + Host Tools + Ready & Start */}
        <div className="col-span-5 flex flex-col justify-between gap-2 min-h-0 bg-[#171B24] border border-[#262E3E] rounded-2xl p-2.5">
          {/* Players Roster */}
          <div className="min-h-0 flex-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#9CA3AF]">
              <span className="inline-flex items-center gap-1 text-white">
                <Users className="w-3.5 h-3.5 text-[#00C2FF]" />
                {t('Players', '玩家列表')} ({room.players.length}/8)
              </span>
              {isRoomHost && room.players.length > 1 && (
                <button
                  type="button"
                  onClick={onOpenPassHost}
                  className="text-[#FFB800] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  {t('Manage', '管理')}
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto arcade-scrollbar space-y-1 pr-0.5">
              {room.players.map((p) => {
                const pTeam = room.teamMode !== 'ffa' ? getTeamSpec(p.teamId) : null;
                const pIsHost = !p.isBot && room.hostPlayerId === p.id;
                return (
                  <div
                    key={p.id}
                    className="px-2 py-1.5 rounded-xl bg-[#10131A] border border-[#222938] flex items-center justify-between gap-2"
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
                      className={`text-[10px] font-extrabold shrink-0 ${
                        p.ready ? 'text-[#10D98B]' : 'text-[#FFB800]'
                      }`}
                    >
                      {p.ready ? '✓' : '…'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Host Bot / Team Controls OR Non-Host Team & Emotes */}
          <div className="space-y-1.5 shrink-0">
            {isRoomHost ? (
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={onAddBot}
                  className="h-8 px-2 rounded-lg bg-[#212735] hover:bg-[#2A3244] text-[11px] font-bold text-white inline-flex items-center justify-center gap-1 cursor-pointer truncate"
                >
                  <Plus className="w-3 h-3 text-[#00C2FF] shrink-0" />
                  <span className="truncate">{t('Bot', '机器人')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextBotDifficulty}
                  className="h-8 px-2 rounded-lg bg-[#212735] hover:bg-[#2A3244] text-[11px] font-bold text-[#D1D5DB] inline-flex items-center justify-center gap-1 cursor-pointer truncate"
                >
                  <Bot className="w-3 h-3 text-[#FFB800] shrink-0" />
                  <span className="truncate">{diffInfo.label}</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextTeamMode}
                  className="h-8 px-2 rounded-lg bg-[#212735] hover:bg-[#2A3244] text-[11px] font-bold text-[#D1D5DB] inline-flex items-center justify-center gap-1 cursor-pointer truncate"
                >
                  <Shuffle className="w-3 h-3 text-[#10D98B] shrink-0" />
                  <span className="truncate">
                    {(() => {
                      const modeOpt = TEAM_MODE_OPTIONS.find((o) => o.id === room.teamMode);
                      if (!modeOpt) return t('FFA', '混战');
                      return lang === 'zh' ? modeOpt.labelZh : modeOpt.label;
                    })()}
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-1.5">
                {myTeamSpec ? (
                  <button
                    type="button"
                    onClick={handleCyclePlayerTeam}
                    className="h-8 px-2.5 rounded-lg bg-[#212735] text-xs font-bold text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{myTeamSpec.emoji}</span>
                    <span>{lang === 'zh' ? myTeamSpec.nameZh : myTeamSpec.shortName}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {quickEmotes.slice(0, 5).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => onSendEmote(emoji)}
                        className="h-8 w-8 rounded-lg bg-[#212735] hover:bg-[#2A3244] text-sm flex items-center justify-center cursor-pointer shrink-0"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isRoomHost && room.teamMode !== 'ffa' && (
              <div className="flex items-center justify-between gap-1.5">
                {myTeamSpec && (
                  <button
                    type="button"
                    onClick={handleCyclePlayerTeam}
                    className="flex-1 h-7 px-2 rounded-lg bg-[#10131A] border border-[#262E3E] text-[11px] font-bold text-white truncate cursor-pointer"
                  >
                    {t('My Team:', '我的队伍：')} {myTeamSpec.emoji}{' '}
                    {lang === 'zh' ? myTeamSpec.nameZh : myTeamSpec.shortName}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onShuffleTeams}
                  className="h-7 px-2.5 rounded-lg bg-[#10131A] border border-[#262E3E] text-[11px] font-bold text-[#00C2FF] cursor-pointer"
                >
                  {t('Shuffle', '随机分队')}
                </button>
              </div>
            )}

            {/* Primary Ready & Host Start Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleReady}
                className="tactile-btn flex-1 h-10 rounded-xl font-display font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
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
                <span className="truncate">
                  {me.ready ? t('Ready!', '已准备!') : t('Tap Ready', '点击准备')}
                </span>
              </button>

              {isRoomHost && (
                <button
                  type="button"
                  onClick={onStartMatch}
                  className={`tactile-btn h-10 px-3.5 rounded-xl font-display font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-1 cursor-pointer shrink-0 ${
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

            {errorMsg && (
              <p className="text-[10px] font-semibold text-[#FF9B8A] leading-tight truncate">
                {errorMsg}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (7 cols): Host Game Browser OR Friend Selected Game Card */}
        <div className="col-span-7 flex flex-col gap-2 min-h-0 bg-[#171B24] border border-[#262E3E] rounded-2xl p-2.5">
          {isRoomHost ? (
            <>
              {/* Filter + Search + Chaos & Cup Row */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('Search games…', '搜索游戏…')}
                    className="w-full h-8 pl-8 pr-2.5 rounded-lg bg-[#10131A] border border-[#262E3E] focus:border-[#00C2FF] focus:outline-none text-xs text-white placeholder:text-[#6B7280]"
                  />
                </div>
                <button
                  type="button"
                  onClick={onSpinMutator}
                  title={t('Spin Chaos Rule', '随机混沌规则')}
                  className="h-8 px-2.5 rounded-lg bg-[#10131A] border border-[#262E3E] hover:border-[#FFB800] text-[11px] font-bold text-white inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5" style={{ color: activeMutatorSpec.accentHex }} />
                  <span className="truncate max-w-[84px]">
                    {room.activeMutator === 'normal'
                      ? t('Chaos', '混沌轮盘')
                      : lang === 'zh'
                      ? activeMutatorSpec.shortTagZh
                      : activeMutatorSpec.shortTag}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onStartTournament}
                  title={t('Start 5-Game Cup', '开启 5 局锦标赛')}
                  className="h-8 px-2.5 rounded-lg bg-[#FFB800] hover:bg-[#FFC933] text-[#14120B] text-[11px] font-extrabold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>{t('Cup', '锦标赛')}</span>
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto arcade-scrollbar pb-0.5 shrink-0">
                {PLAYER_FILTER_OPTIONS.map((opt) => {
                  const active = room.lobbyFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeFilter(opt.id)}
                      className={`h-7 px-2.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#00C2FF] text-[#0B1219]'
                          : 'bg-[#10131A] text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {getLocalizedFilterLabel(opt.id, lang, true)}
                    </button>
                  );
                })}
              </div>

              {/* Selected Game Setting Strip */}
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#10131A] border border-[#222938] shrink-0">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-white truncate">
                    {selectedMeta.name}
                  </div>
                  <div className="text-[10px] text-[#9CA3AF] truncate">{selectedMeta.tagline}</div>
                </div>
                {selectedMeta.settingOptions.length > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    {selectedMeta.settingOptions.map((opt) => {
                      const active = room.gameSettingValue === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onSelectGame(room.selectedGameId, opt.value)}
                          className={`h-6 px-2 rounded-md text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-[#FF4D2E] text-white'
                              : 'bg-[#1A202C] text-[#9CA3AF] hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Scrollable Game Picker Grid */}
              <div className="flex-1 min-h-0 overflow-y-auto arcade-scrollbar grid grid-cols-2 gap-1.5 pr-0.5 content-start">
                {visibleGames.map((g) => {
                  const selected = g.id === room.selectedGameId;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onSelectGame(g.id, g.defaultSetting)}
                      className={`p-2 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1 ${
                        selected
                          ? 'bg-[#152436] border-[#00C2FF]'
                          : 'bg-[#10131A] border-[#222938] hover:border-[#39455E]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px] text-[#9CA3AF]">
                        <span className="font-semibold truncate" style={{ color: g.accentHex }}>
                          {getLocalizedFilterLabel(getGameGenre(g.id), lang, true)} · {g.category}
                        </span>
                        <span className="font-mono shrink-0">{g.playerModeLabel}</span>
                      </div>
                      <div className="font-display font-bold text-xs text-white truncate">
                        {g.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Non-Host Friend View: Selected Game Details + Rules + Control Tip */
            <div className="flex-1 min-h-0 flex flex-col justify-between gap-2 p-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#FFB800] font-bold inline-flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5" />
                    {t(
                      `${hostPlayer?.name ?? 'Host'} selected`,
                      `${hostPlayer?.name ?? '房主'} 已选择游戏`
                    )}
                  </span>
                  <span className="font-mono text-[#9CA3AF]">{selectedMeta.playerModeLabel}</span>
                </div>

                <div>
                  <div className="text-[11px] font-semibold" style={{ color: selectedMeta.accentHex }}>
                    {selectedMeta.category}
                  </div>
                  <h2 className="font-display text-xl font-extrabold text-white truncate">
                    {selectedMeta.name}
                  </h2>
                  <p className="text-xs text-[#A5AEBD] mt-1 leading-relaxed">
                    {selectedMeta.description}
                  </p>
                </div>

                {room.activeMutator !== 'normal' && (
                  <div className="px-2.5 py-1.5 rounded-xl bg-[#10131A] border border-[#262E3E] flex items-center justify-between text-xs">
                    <span className="text-[#9CA3AF] inline-flex items-center gap-1.5">
                      <Dices className="w-3.5 h-3.5" style={{ color: activeMutatorSpec.accentHex }} />
                      {t('Chaos Rule', '混沌规则')}
                    </span>
                    <span className="font-bold" style={{ color: activeMutatorSpec.accentHex }}>
                      {lang === 'zh' ? activeMutatorSpec.nameZh : activeMutatorSpec.name}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-[#10131A] border border-[#222938] space-y-1 text-xs">
                <div className="text-[11px] font-bold text-[#00C2FF]">
                  {t('Pocket Mode Controls', '掌机操作说明')}
                </div>
                <p className="text-[11px] text-[#D1D5DB] leading-snug">
                  {selectedMeta.controllerSchema.controlTip}
                </p>
                <div className="pt-1 flex items-center justify-between text-[11px] text-[#9CA3AF]">
                  <span>
                    A: <strong className="text-white">{selectedMeta.controllerSchema.actionA.label}</strong>
                  </span>
                  <span>
                    B: <strong className="text-white">{selectedMeta.controllerSchema.actionB.label}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

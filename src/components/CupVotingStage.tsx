import { AnimatePresence, motion } from 'motion/react';
import { Check, Clock, Crown, Play, Sparkles, Trophy, Vote, Users } from 'lucide-react';
import { getGameMeta } from '../shared/games';
import { getTeamSpec, TEAM_MODE_OPTIONS } from '../shared/party';
import type { GameId, RoomSnapshot } from '../shared/types';
import { getLocalizedGameMeta, useLanguage } from '../lib/i18n';
import { GameHoverPreview } from './GameHoverPreview';
import { PlayerAvatar } from './PlayerAvatar';

interface CupVotingStageProps {
  room: RoomSnapshot;
  isScreenRemoteLocked: boolean;
  onCastOrLockGame: (gameId: GameId) => void;
  onForceLockVote: () => void;
  onExitCup: () => void;
}

export function CupVotingStage({
  room,
  isScreenRemoteLocked,
  onCastOrLockGame,
  onForceLockVote,
  onExitCup,
}: CupVotingStageProps) {
  const { lang, t } = useLanguage();
  const tournament = room.tournament;
  const vote = tournament?.vote;
  if (!tournament || !vote) return null;

  const isLocked = vote.phase === 'locked';
  const totalVoters = room.players.length;
  const castCount = Object.keys(vote.votes).length;
  const timerPercent = Math.max(0, Math.min(100, (vote.secondsLeft / Math.max(1, vote.totalSeconds)) * 100));
  const roundNum = vote.roundIndex + 1;
  const isFinale = roundNum >= tournament.totalGames;
  const teamModeInfo = TEAM_MODE_OPTIONS.find((m) => m.id === room.teamMode);

  return (
    <div className="fixed inset-0 h-dvh w-full bg-[#121419] text-[#F4F6FA] flex flex-col overflow-hidden select-none">
      {/* Subtle Ambient Arcade Glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -left-24 w-[420px] h-[420px] rounded-full bg-[#FFB800]/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-24 w-[420px] h-[420px] rounded-full bg-[#00C2FF]/10 blur-[120px]" />
        <div className="absolute -bottom-32 left-1/3 w-[420px] h-[420px] rounded-full bg-[#FF4D2E]/10 blur-[120px]" />
      </div>

      {/* Top Cup Voting Header */}
      <header className="relative z-10 border-b border-[#242934] bg-[#151820]/95 backdrop-blur-md px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 px-3 rounded-xl bg-[#FFB800]/18 border border-[#FFB800]/60 text-[#FFB800] font-display font-extrabold text-sm inline-flex items-center gap-2 shrink-0">
            <Trophy className="w-4 h-4" />
            <span>
              {t(`5-Game Cup · Match ${roundNum}/${tournament.totalGames}`, `5局锦标赛 · 第 ${roundNum}/${tournament.totalGames} 局`)}
            </span>
            {isFinale && (
              <span className="px-1.5 py-0.5 rounded bg-[#FF4D2E] text-white font-mono text-[10px] font-black">
                1.5×
              </span>
            )}
          </div>

          <div className="hidden md:flex items-center gap-1.5">
            {Array.from({ length: tournament.totalGames }).map((_, idx) => {
              const gId = tournament.gameQueue[idx];
              const isCurrent = idx === vote.roundIndex;
              const isDone = idx < vote.roundIndex && Boolean(gId);
              const meta = gId ? getLocalizedGameMeta(getGameMeta(gId), lang) : null;
              return (
                <div
                  key={idx}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 ${
                    isCurrent
                      ? 'bg-[#262C38] border-[#FFB800] text-[#FFB800]'
                      : isDone
                      ? 'bg-[#102620] border-[#10D98B]/50 text-[#6EE7B7]'
                      : 'bg-[#101217] border-[#262C38] text-[#6B7280]'
                  }`}
                >
                  <span className="font-mono text-[10px]">#{idx + 1}</span>
                  <span className="truncate max-w-[84px]">
                    {meta
                      ? meta.name
                      : isCurrent
                      ? t('Voting...', '投票中...')
                      : t('Vote', '待投票')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {room.teamMode !== 'ffa' && teamModeInfo && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#00C2FF]/15 border border-[#00C2FF]/45 text-[#00C2FF] text-xs font-extrabold">
              <Users className="w-3.5 h-3.5" />
              <span>{lang === 'zh' ? teamModeInfo.shortLabelZh : teamModeInfo.shortLabel}</span>
            </span>
          )}

          <div className="px-3 py-1.5 rounded-xl bg-[#101217] border border-[#2A303D] font-mono text-xs font-bold text-[#D1D5DB] inline-flex items-center gap-1.5 tabular-nums">
            <Vote className="w-3.5 h-3.5 text-[#00C2FF]" />
            <span>
              {castCount}/{totalVoters} {t('Voted', '已投票')}
            </span>
          </div>

          <div
            className={`min-w-[84px] h-10 px-3 rounded-xl border-2 font-mono text-base font-black inline-flex items-center justify-center gap-1.5 tabular-nums ${
              isLocked
                ? 'bg-[#10D98B]/20 border-[#10D98B] text-[#10D98B]'
                : vote.secondsLeft <= 5
                ? 'bg-[#FF4D2E]/20 border-[#FF4D2E] text-[#FF9B8A] animate-pulse'
                : 'bg-[#1A1E26] border-[#FFB800]/65 text-[#FFB800]'
            }`}
          >
            {isLocked ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{t('LOCKED', '已锁定')}</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                <span>{vote.secondsLeft}s</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Smooth Countdown Bar */}
      <div className="relative z-10 h-1.5 w-full bg-[#1C212C] shrink-0 overflow-hidden">
        <motion.div
          className="h-full"
          style={{
            backgroundColor: isLocked ? '#10D98B' : vote.secondsLeft <= 5 ? '#FF4D2E' : '#FFB800',
          }}
          initial={false}
          animate={{ width: `${isLocked ? 100 : timerPercent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Main Voting Arena */}
      <main className="relative z-10 flex-1 min-h-0 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col justify-between gap-4 overflow-hidden">
        {/* Title & Prompt */}
        <div className="text-center shrink-0">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2.5">
            {isLocked ? (
              <>
                <Sparkles className="w-7 h-7 text-[#FFB800]" />
                <span>
                  {t('Next Cup Game Locked In!', '下一局锦标赛游戏已揭晓！')}
                </span>
              </>
            ) : (
              <>
                <Vote className="w-7 h-7 text-[#00C2FF]" />
                <span>
                  {t('Vote on Your Phone for the Next Game!', '请在手机上投票选出下一款游戏！')}
                </span>
              </>
            )}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#9CA3AF]">
            {isLocked
              ? t(
                  'Launching rules briefing in a moment...',
                  '正在进入玩法说明，请准备就绪...'
                )
              : t(
                  'All 3 candidates are playing live 5-second gameplay previews — tap your favorite on your phone!',
                  '3 款候选游戏均在实时播放 5 秒实机画面 — 在手机上点击你最想玩的一款！'
                )}
          </p>
        </div>

        {/* 3 Candidate Cards — EVERY card auto-plays its 5-second gameplay video loop */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-stretch">
          {vote.candidates.map((gameId, idx) => {
            const rawMeta = getGameMeta(gameId);
            const meta = getLocalizedGameMeta(rawMeta, lang);
            const voters = room.players.filter((p) => vote.votes[p.id] === gameId);
            const voteShare = totalVoters > 0 ? Math.round((voters.length / totalVoters) * 100) : 0;
            const isWinner = isLocked && vote.winningGameId === gameId;
            const isLoser = isLocked && vote.winningGameId !== gameId;
            const isRemoteFocused = !isLocked && room.remoteFocus.modalIndex === idx;
            const genreBadge =
              rawMeta.genre === 'board'
                ? { en: 'BOARD', zh: '桌游', color: '#FFB800' }
                : rawMeta.genre === 'card'
                ? { en: 'CARD', zh: '卡牌', color: '#FF3B9A' }
                : { en: 'ARCADE', zh: '街机', color: '#00C2FF' };

            return (
              <motion.div
                key={gameId}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{
                  opacity: isLoser ? 0.36 : 1,
                  y: 0,
                  scale: isWinner ? 1.03 : isLoser ? 0.96 : 1,
                }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                onClick={() => {
                  if (!isLocked && !isScreenRemoteLocked) {
                    onCastOrLockGame(gameId);
                  }
                }}
                className={`relative rounded-3xl overflow-hidden bg-[#181C25] border-2 flex flex-col justify-between transition-all shadow-2xl ${
                  isWinner
                    ? 'border-[#FFB800] ring-4 ring-[#FFB800]/50 shadow-[0_0_40px_rgba(255,184,0,0.38)] z-10'
                    : isRemoteFocused
                    ? 'border-[#00C2FF] ring-2 ring-[#00C2FF]/60'
                    : 'border-[#2A3142]'
                } ${!isLocked && !isScreenRemoteLocked ? 'cursor-pointer hover:border-[#4B5670]' : ''}`}
              >
                {/* Live 5-Second Gameplay Video Preview (Always active for every candidate!) */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0E1117] shrink-0">
                  <GameHoverPreview
                    gameId={gameId}
                    gameName={meta.name}
                    accentHex={rawMeta.accentHex}
                    fallbackSrc={rawMeta.coverImage}
                    alt={meta.name}
                    active={true}
                    eager={true}
                    immediate={true}
                    timecodePosition="top-right"
                  />

                  {/* Top-left Option Letter & Genre */}
                  <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-1.5">
                    <span className="h-7 w-7 rounded-lg bg-[#0D1017]/88 border border-white/20 font-mono text-xs font-black text-white flex items-center justify-center shadow">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span
                      className="px-2 py-1 rounded-lg bg-[#0D1017]/88 border font-mono text-[10px] font-black tracking-wide shadow"
                      style={{
                        borderColor: `${genreBadge.color}70`,
                        color: genreBadge.color,
                      }}
                    >
                      {t(genreBadge.en, genreBadge.zh)}
                    </span>
                  </div>

                  {/* Winner Lock Banner */}
                  {isWinner && (
                    <motion.div
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="pointer-events-none absolute inset-x-3 bottom-3 z-20 px-3 py-2 rounded-xl bg-[#FFB800] text-[#14120B] font-display font-black text-sm text-center shadow-xl flex items-center justify-center gap-1.5"
                    >
                      <Crown className="w-4 h-4 shrink-0" />
                      <span>{t('WINNER — UP NEXT!', '胜出 — 即将开赛！')}</span>
                    </motion.div>
                  )}
                </div>

                {/* Card Details + Live Vote Tally & Voter Avatars */}
                <div className="flex-1 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-[#9CA3AF] truncate">
                          {meta.category} · {meta.playerModeLabel}
                        </div>
                        <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white truncate mt-0.5">
                          {meta.name}
                        </h2>
                      </div>
                      <motion.div
                        key={voters.length}
                        initial={{ scale: 1.25 }}
                        animate={{ scale: 1 }}
                        className="px-2.5 py-1 rounded-xl font-mono text-sm font-black shrink-0 tabular-nums border"
                        style={{
                          backgroundColor:
                            voters.length > 0 ? `${rawMeta.accentHex}22` : '#101217',
                          borderColor: voters.length > 0 ? rawMeta.accentHex : '#262C38',
                          color: voters.length > 0 ? '#FFFFFF' : '#6B7280',
                        }}
                      >
                        {voters.length} {t(voters.length === 1 ? 'vote' : 'votes', '票')}
                      </motion.div>
                    </div>
                    <p className="mt-1.5 text-xs text-[#A5AEBD] line-clamp-2 leading-relaxed">
                      {meta.tagline}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {/* Animated Vote Share Bar */}
                    <div className="h-2 w-full rounded-full bg-[#101217] overflow-hidden border border-[#242934]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: isWinner ? '#FFB800' : rawMeta.accentHex }}
                        initial={false}
                        animate={{ width: `${voteShare}%` }}
                        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                      />
                    </div>

                    {/* Voter Avatar Chips */}
                    <div className="min-h-[34px] flex flex-wrap items-center gap-1.5">
                      <AnimatePresence mode="popLayout">
                        {voters.length === 0 ? (
                          <span className="text-[11px] text-[#6B7280] italic">
                            {t('No votes yet', '暂无投票')}
                          </span>
                        ) : (
                          voters.map((vp) => {
                            const tSpec = getTeamSpec(vp.teamId);
                            return (
                              <motion.div
                                key={vp.id}
                                layout
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                className="pl-1 pr-2 py-0.5 rounded-lg bg-[#101217] border border-[#2A303D] inline-flex items-center gap-1.5 text-[11px] font-bold text-white"
                              >
                                <PlayerAvatar
                                  avatarId={vp.avatarId}
                                  colorHex={tSpec ? tSpec.colorHex : vp.color.hex}
                                  size="xs"
                                />
                                <span className="truncate max-w-[68px]">{vp.name}</span>
                              </motion.div>
                            );
                          })
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer: Mini Cup Leaderboard + Controls */}
        <footer className="rounded-2xl bg-[#151820] border border-[#242934] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] shrink-0">
              {t('Cup Standings:', '锦标赛排名：')}
            </span>
            {room.teamMode !== 'ffa' && tournament.teamStandings && tournament.teamStandings.length > 0 ? (
              tournament.teamStandings.map((ts) => (
                <div
                  key={ts.teamId}
                  className="px-2.5 py-1 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
                  style={{
                    backgroundColor: `${ts.colorHex}18`,
                    borderColor: `${ts.colorHex}70`,
                    color: '#FFFFFF',
                  }}
                >
                  <span>#{ts.rank}</span>
                  <span>{ts.emoji}</span>
                  <span>{lang === 'zh' ? ts.nameZh : ts.name}</span>
                  <span className="font-mono text-[#FFB800] tabular-nums">{ts.score}</span>
                </div>
              ))
            ) : (
              tournament.standings.slice(0, 5).map((st) => (
                <div
                  key={st.playerId}
                  className="px-2 py-1 rounded-lg bg-[#101217] border border-[#262C38] text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
                >
                  <span className="font-mono text-[10px] text-[#FFB800]">#{st.rank}</span>
                  <PlayerAvatar avatarId={st.avatarId} colorHex={st.color.hex} size="xs" />
                  <span className="text-white truncate max-w-[74px]">{st.name}</span>
                  <span className="font-mono text-[11px] text-[#00C2FF] tabular-nums">
                    {st.totalMarks}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {!isLocked && (
              <button
                type="button"
                onClick={onForceLockVote}
                className="tactile-btn h-9 px-3.5 rounded-xl bg-[#FFB800] hover:bg-[#FFC933] text-[#14120B] font-display font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{t('Lock Vote Now', '立即锁定投票')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onExitCup}
              className="h-9 px-3 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-[#D1D5DB] cursor-pointer whitespace-nowrap"
            >
              {t('Exit Cup', '退出锦标赛')}
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

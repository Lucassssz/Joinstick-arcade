import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Bomb,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Crosshair,
  Crown,
  Dices,
  Flame,
  Footprints,
  Gamepad2,
  Gauge,
  HelpCircle,
  Home,
  Loader2,
  Lock,
  LogOut,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Move,
  Paintbrush,
  Pause,
  Play,
  Power,
  RefreshCw,
  Repeat,
  RotateCcw,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Unlock,
  Users,
  Volume2,
  VolumeX,
  Vote,
  Waves,
  WifiOff,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import {
  clampControllerPrefs,
  ControllerPrefs,
  ControllerSettingsOverlay,
  DEFAULT_CONTROLLER_PREFS,
  loadControllerPrefs,
  saveControllerPrefs,
} from './ControllerSettingsOverlay';
import { EasyArrowsDeck, SwipeTrackpadDeck } from './GamePadDecks';
import { DirectArenaTouchDeck, SketchNormalDeck } from './DirectArenaTouchDeck';
import { FrenzyBannerOverlay } from './FrenzyBannerOverlay';
import { PocketArenaCanvas } from './PocketArenaCanvas';
import { PocketLobbyView } from './PocketLobbyView';
import { PhoneMatchOutcomeOverlay } from './PhoneMatchOutcomeOverlay';
import { RuleChatbotDrawer } from './RuleChatbotDrawer';
import {
  ArcadePadMode,
  getGamePadProfile,
  PadMode,
} from '../shared/padProfiles';
import { AvatarPickerGrid, PlayerAvatar } from './PlayerAvatar';
import {
  CARD_GAME_IDS,
  filterGamesByPlayerMode,
  getGameMeta,
  PLAYER_FILTER_OPTIONS,
} from '../shared/games';
import { getMutatorSpec } from '../shared/modifiers';
import {
  AVATAR_PRESETS,
  getAvatarPreset,
  getTeamsForMode,
  getTeamSpec,
  isValidAvatarId,
  TEAM_MODE_OPTIONS,
  type TeamId,
} from '../shared/party';
import { CardControllerDeck, type PocketCardSituation } from './CardControllerDeck';
import { PhoneControllerDemo } from './PhoneControllerDemo';
import { createRenderFxState } from '../games/renderers';
import type { LocalPaddlePrediction } from '../games/arcadeMotion';
import { isGameRendererReady, preloadRenderer } from '../games/rendererRegistry';
import { arcadeAudio } from '../lib/audio';
import {
  ActionButtonSpec,
  CardClientAction,
  CardPrivateState,
  CompetitiveSnapshot,
  ControllerInput,
  GameId,
  GameSnapshot,
  PLAYER_PALETTE,
  RemoteDirection,
  RoomSnapshot,
  ServerMessage,
} from '../shared/types';
import { ManagedWebSocket, SocketStatus } from '../lib/ws';
import { createRoomSyncStore, useRoomSyncSnapshot } from '../lib/roomSyncStore';
import { shareRoomInvite } from '../lib/shareInvite';
import {
  clearHostAuthSession,
  consumeGuestSingleUseTokenLocally,
  fetchHostAuthStatus,
  getHostAuthToken,
  getPublicAccessOpen,
  setPublicAccessOpenLocally,
  useHostAuthSession,
  usePublicAccessOpen,
  verifyHostCode,
} from '../lib/hostAuth';
import {
  getLocalizedDifficulty,
  getLocalizedFilterLabel,
  getLocalizedGameMeta,
  LanguageToggle,
  translateGameText,
  translateServerMessage,
  useLanguage,
} from '../lib/i18n';

export interface PhoneControllerProps {
  initialRoomCode?: string;
  initialMode?: 'join' | 'pocket';
  preferredGameId?: GameId;
  defaultName?: string;
  autoJoin?: boolean;
  embedded?: boolean;
  keyboardProfile?: 'wasd' | 'arrows' | 'none';
  onExit?: () => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(24, 28, 36, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const CALLSIGNS = [
  'Viper',
  'Turbo',
  'Pixel',
  'Blitz',
  'Nova',
  'Drift',
  'Spark',
  'Echo',
];

const QUICK_EMOTES = ['🔥', '😂', '⚡', '👑', '🎉', '👏'];

function ActionIcon({ icon, className }: { icon: ActionButtonSpec['icon']; className?: string }) {
  switch (icon) {
    case 'zap':
      return <Zap className={className} />;
    case 'waves':
      return <Waves className={className} />;
    case 'crosshair':
      return <Crosshair className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'gauge':
      return <Gauge className={className} />;
    case 'wind':
      return <Wind className={className} />;
    case 'arrow-up':
      return <ArrowUp className={className} />;
    case 'bomb':
      return <Bomb className={className} />;
    case 'target':
      return <Target className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'paintbrush':
      return <Paintbrush className={className} />;
    case 'footprints':
      return <Footprints className={className} />;
  }
}

const SITUATION_COLOR_BADGE: Record<string, { bg: string; fg: string; en: string; zh: string }> = {
  red: { bg: '#FF4D2E', fg: '#FFFFFF', en: 'RED', zh: '红' },
  blue: { bg: '#00C2FF', fg: '#0B1219', en: 'BLUE', zh: '蓝' },
  gold: { bg: '#FFB800', fg: '#14120B', en: 'GOLD', zh: '黄' },
  green: { bg: '#10D98B', fg: '#0A1913', en: 'GREEN', zh: '绿' },
  wild: { bg: '#7C3AED', fg: '#FFFFFF', en: 'WILD', zh: '万能' },
};

const TABLETOP_ZOOM_CARD_GAMES = new Set<GameId>([
  'color-clash',
  'dark-flip-clash',
  'liars-deck',
  'boom-kittens',
  'property-deal',
  'flip-seven',
  'royal-bluff',
  'sushi-draft',
  'big-two-royale',
  'lucky-21',
  'ten-pair-showdown',
  'landlord-clash',
  'speed-mahjong',
  'liars-dice-tavern',
  'hearts-breaker',
  'spades-bidding',
  'rummy-royale',
  'poker-showdown',
  'tarot-arcana',
  'baccarat-club',
  'sequence-jack',
  'camel-stack-derby',
  'route-express',
  'gem-engine-guild',
  'secret-rank-flags',
  'row-six-bust',
  'silent-sync',
  'one-card-court',
  'firework-hints',
  'tunnel-saboteur',
  'word-tile-crossroads',
  'undercover-word',
  'midnight-werewolf',
  'idiom-chain',
]);

function buildPocketCardSituation(
  snap: GameSnapshot | null,
  room: RoomSnapshot,
  cardState: CardPrivateState | null,
  meId: string,
  lang: 'en' | 'zh'
): PocketCardSituation {
  const s = (snap ?? null) as Record<string, unknown> | null;
  const activePlayerId =
    typeof s?.activePlayerId === 'string' && s.activePlayerId ? s.activePlayerId : undefined;
  const snapPlayers = Array.isArray(s?.players)
    ? (s.players as Array<Record<string, unknown>>)
    : [];
  const gameId = String(s?.gameId ?? room.selectedGameId);

  const players = room.players.map((rp) => {
    const sp = snapPlayers.find((p) => p.id === rp.id);
    let stat = rp.statText || `${rp.score}`;
    let statusTag: string | null = null;
    let statusTone: 'danger' | 'warn' | 'good' | 'neutral' = 'neutral';
    const lastAction = typeof sp?.lastAction === 'string' && sp.lastAction ? sp.lastAction : null;
    let cardCount: number | null = null;

    if (sp) {
      if (typeof sp.cardCount === 'number') {
        cardCount = sp.cardCount;
      } else if (typeof sp.handCount === 'number') {
        cardCount = sp.handCount;
      } else if (typeof sp.tileCount === 'number') {
        cardCount = sp.tileCount;
      } else if (typeof sp.cardsLeft === 'number') {
        cardCount = sp.cardsLeft;
      } else if (typeof sp.influenceLeft === 'number') {
        cardCount = sp.influenceLeft;
      } else if (typeof sp.diceCount === 'number') {
        cardCount = sp.diceCount;
      } else if (Array.isArray(sp.numberCards)) {
        cardCount = sp.numberCards.length;
      }

      if (typeof sp.bankCash === 'number' && typeof sp.setsCompleted === 'number') {
        stat = `${sp.setsCompleted}★ $${sp.bankCash}M`;
        if (typeof sp.cardCount === 'number') {
          statusTag = `${sp.cardCount}🃏`;
        }
      } else if (typeof sp.influenceLeft === 'number') {
        stat = `${sp.influenceLeft}♛ $${typeof sp.coins === 'number' ? sp.coins : 0}`;
      } else if (typeof sp.roundPoints === 'number') {
        const cardsArr = Array.isArray(sp.numberCards) ? sp.numberCards.length : undefined;
        stat = cardsArr !== undefined ? `${sp.roundPoints}pt (${cardsArr})` : `${sp.roundPoints}pt`;
      } else if (typeof sp.total === 'number') {
        stat = `${sp.total}pt`;
      } else if (typeof sp.handCount === 'number' && typeof sp.meldsCount === 'number') {
        stat = `${sp.handCount}🃏 · ${sp.meldsCount}M`;
      } else if (typeof sp.tricksWon === 'number') {
        stat = `${sp.tricksWon}W`;
        if (typeof sp.heartsTaken === 'number' && sp.heartsTaken > 0) {
          statusTag = `♥${sp.heartsTaken}`;
          statusTone = 'danger';
        } else if (typeof sp.spadesPlayed === 'number' && sp.spadesPlayed > 0) {
          statusTag = `♠${sp.spadesPlayed}`;
          statusTone = 'neutral';
        }
      } else if (typeof sp.routesClaimed === 'number') {
        stat = `${sp.routesClaimed}🚂 · ${typeof sp.score === 'number' ? sp.score : 0}pt`;
      } else if (typeof sp.gems === 'number') {
        stat = `${sp.gems}💎 · ${typeof sp.score === 'number' ? sp.score : 0}pt`;
      } else if (typeof sp.flagsCaptured === 'number') {
        stat = `${sp.flagsCaptured}🚩 · ${typeof sp.score === 'number' ? sp.score : 0}pt`;
      } else if (typeof sp.bullsTaken === 'number') {
        stat = `${sp.bullsTaken}🐮 · ${typeof sp.score === 'number' ? sp.score : 0}pt`;
      } else if (typeof sp.synced === 'number') {
        stat = `${sp.synced}✓ · ${typeof sp.score === 'number' ? sp.score : 0}pt`;
      } else if (typeof sp.favors === 'number') {
        stat = `${sp.favors}👑 · ${typeof sp.score === 'number' ? sp.score : 0}pt`;
      } else if (typeof sp.launched === 'number') {
        stat = `${sp.launched}🎆 · ${typeof sp.score === 'number' ? sp.score : 0}pt`;
      } else if (typeof sp.goldFound === 'number') {
        stat = `${sp.goldFound}⛏️ · ${typeof sp.score === 'number' ? sp.score : 0}pt`;
      } else if (typeof sp.wordsBuilt === 'number') {
        stat = `${sp.wordsBuilt}🔤 · ${typeof sp.score === 'number' ? sp.score : 0}pt`;
      } else if (typeof sp.coins === 'number' && typeof sp.betColor !== 'undefined') {
        stat = `${sp.coins}🪙 · ${typeof sp.score === 'number' ? sp.score : 0}pt`;
      } else if (typeof sp.cardCount === 'number') {
        stat = `${sp.cardCount}🃏`;
      } else if (typeof sp.handCount === 'number') {
        stat = `${sp.handCount}🃏`;
      } else if (typeof sp.chips === 'number') {
        const activeBet =
          typeof sp.currentBet === 'number' && sp.currentBet > 0
            ? sp.currentBet
            : typeof sp.bet === 'number' && sp.bet > 0
            ? sp.bet
            : 0;
        stat = activeBet > 0 ? `$${sp.chips} · B$${activeBet}` : `$${sp.chips}`;
      } else if (typeof sp.totalScore === 'number') {
        stat = `${sp.totalScore}pt`;
      } else if (typeof sp.score === 'number') {
        stat = `${sp.score}pt`;
      }

      if (typeof sp.bustedCount === 'number' && sp.bustedCount > 0) {
        statusTag = `${sp.bustedCount}/6 🔫`;
        statusTone = sp.bustedCount >= 4 ? 'danger' : 'warn';
      } else if (sp.cardCount === 1 || sp.handCount === 1) {
        statusTag = 'UNO!';
        statusTone = 'danger';
      }

      if (sp.folded === true) {
        statusTag = lang === 'zh' ? '弃牌' : 'FOLD';
        statusTone = 'danger';
      } else if (sp.allIn === true) {
        statusTag = 'ALL-IN';
        statusTone = 'warn';
      } else if (sp.status === 'busted' || sp.busted === true) {
        statusTag = lang === 'zh' ? '爆牌' : 'BUST';
        statusTone = 'danger';
      } else if (sp.status === 'stayed' || sp.standing === true) {
        statusTag = lang === 'zh' ? '停牌' : 'STAY';
        statusTone = 'good';
      } else if (sp.status === 'flip7') {
        statusTag = 'FLIP 7!';
        statusTone = 'good';
      } else if (typeof sp.handRankLabel === 'string' && sp.handRankLabel) {
        statusTag = sp.handRankLabel;
        statusTone = 'good';
      } else if (sp.locked === true) {
        statusTag = lang === 'zh' ? '已锁牌' : 'LOCKED';
        statusTone = 'good';
      } else if (sp.pickedThisStep === true) {
        statusTag = lang === 'zh' ? '已选' : 'PICKED';
        statusTone = 'good';
      } else if (sp.checked === true) {
        statusTag = lang === 'zh' ? '过牌' : 'CHECK';
        statusTone = 'neutral';
      }

      if (typeof s?.bankerId === 'string' && s.bankerId === rp.id && !statusTag) {
        statusTag = lang === 'zh' ? '庄家' : 'BANKER';
        statusTone = 'warn';
      } else if ((sp.isLandlord === true || sp.role === 'landlord') && !statusTag) {
        statusTag = lang === 'zh' ? '地主' : 'BOSS';
        statusTone = 'warn';
      }
    }

    const alive = typeof sp?.alive === 'boolean' ? sp.alive : rp.alive;
    if (!alive) {
      statusTag = lang === 'zh' ? '出局' : 'OUT';
      statusTone = 'danger';
    }

    return {
      id: rp.id,
      name: rp.name,
      avatarId: rp.avatarId,
      colorHex: rp.color.hex,
      stat,
      cardCount,
      lastAction,
      statusTag,
      statusTone,
      isActive: activePlayerId ? rp.id === activePlayerId : false,
      isMe: rp.id === meId,
      alive,
    };
  });

  const activePlayer =
    players.find((p) => p.isActive) ??
    (cardState?.isMyTurn ? players.find((p) => p.isMe) : undefined);

  let tableBadge: PocketCardSituation['tableBadge'] = null;
  const summaryParts: string[] = [];
  let lastMoveText: string | null = null;
  let direction: 1 | -1 = 1;
  let deckCount: number | null = null;
  let activeColorKey: 'red' | 'blue' | 'gold' | 'green' | 'wild' | null =
    cardState?.activeColor ?? null;
  let centerPileCard: PocketCardSituation['centerPileCard'] = null;

  if (s) {
    if (s.direction === -1 || s.direction === 1) {
      direction = s.direction;
    }
    if (typeof s.deckCount === 'number') {
      deckCount = s.deckCount;
    } else if (typeof s.wallRemaining === 'number') {
      deckCount = s.wallRemaining;
    } else if (typeof s.cardsRemaining === 'number') {
      deckCount = s.cardsRemaining;
    }

    if ((gameId === 'color-clash' || gameId === 'dark-flip-clash') && s.topCard && typeof s.topCard === 'object') {
      const topCard = s.topCard as { color?: string; value?: string };
      const rawCol = (typeof s.activeColor === 'string' ? s.activeColor : topCard.color ?? 'red') as
        | 'red'
        | 'blue'
        | 'gold'
        | 'green'
        | 'wild';
      activeColorKey = rawCol;
      const colStyle = SITUATION_COLOR_BADGE[rawCol] ?? SITUATION_COLOR_BADGE.red;
      const topVal = topCard.value ?? '';
      tableBadge = {
        text: `${lang === 'zh' ? colStyle.zh : colStyle.en} ${topVal}`.trim(),
        bg: colStyle.bg,
        fg: colStyle.fg,
      };
      centerPileCard = {
        kind: 'clash',
        colorKey: (topCard.color as 'red' | 'blue' | 'gold' | 'green' | 'wild') ?? rawCol,
        activeColorKey: rawCol,
        mainText: topVal || '?',
        subText:
          gameId === 'dark-flip-clash'
            ? s.side === 'dark'
              ? lang === 'zh'
                ? '暗面模式'
                : 'DARK SIDE'
              : lang === 'zh'
              ? '亮面模式'
              : 'LIGHT SIDE'
            : lang === 'zh'
            ? `当前色: ${colStyle.zh}`
            : `COLOR: ${colStyle.en}`,
        accentHex: colStyle.bg,
      };
      if (s.direction === 1 || s.direction === -1) {
        summaryParts.push(s.direction === 1 ? '↻' : '↺');
      }
      if (typeof s.drawPenalty === 'number' && s.drawPenalty > 0) {
        summaryParts.push(`+${s.drawPenalty}`);
      }
      if (typeof s.deckCount === 'number') {
        summaryParts.push(lang === 'zh' ? `牌堆 ${s.deckCount}` : `Deck ${s.deckCount}`);
      }
    } else if (gameId === 'liars-deck') {
      const target = typeof s.targetRank === 'string' ? s.targetRank : cardState?.targetRank ?? 'A';
      const pileCount = typeof s.pileCount === 'number' ? s.pileCount : 0;
      tableBadge = {
        text: lang === 'zh' ? `目标 ${target}` : `TARGET ${target}`,
        bg: '#FFB800',
        fg: '#14120B',
      };
      if (typeof s.pileCount === 'number') {
        summaryParts.push(lang === 'zh' ? `桌面 ${s.pileCount} 张` : `Pile ${s.pileCount}`);
      }
      if (typeof s.lastClaimPlayerName === 'string' && typeof s.lastClaimCount === 'number') {
        lastMoveText = `${s.lastClaimPlayerName}: ${s.lastClaimCount}×${target}`;
      }
      centerPileCard = {
        kind: 'bluff',
        mainText: target,
        subText:
          lastMoveText ||
          (lang === 'zh' ? `桌面暗牌 ${pileCount} 张` : `${pileCount} Face-Down`),
        badgeText: lang === 'zh' ? '目标牌' : 'TABLE RANK',
        accentHex: '#FFB800',
        pileCount,
      };
    } else if (gameId === 'boom-kittens') {
      const bombs = typeof s.bombsInDeck === 'number' ? s.bombsInDeck : 1;
      const deck = typeof s.deckCount === 'number' ? s.deckCount : 0;
      tableBadge = {
        text: `💣 ${bombs} · 🃏 ${deck}`,
        bg: '#FF4D2E',
        fg: '#FFFFFF',
      };
      if (s.topDiscard && typeof s.topDiscard === 'object') {
        const td = s.topDiscard as { label?: string; badge?: string; accentHex?: string };
        if (td.label) lastMoveText = td.label;
        centerPileCard = {
          kind: 'party',
          mainText: td.label ?? 'BOOM',
          subText: lang === 'zh' ? `炸弹 ${bombs} · 剩 ${deck} 张` : `${bombs} Bombs · ${deck} Left`,
          badgeText: td.badge ?? 'ACTION',
          accentHex: td.accentHex ?? '#FF4D2E',
        };
      }
    } else if (gameId === 'royal-bluff' && s.pendingClaim && typeof s.pendingClaim === 'object') {
      const pc = s.pendingClaim as { actorName?: string; actionName?: string; claimedRole?: string };
      tableBadge = {
        text: pc.claimedRole ?? 'CLAIM',
        bg: '#FFB800',
        fg: '#14120B',
      };
      if (pc.actorName && pc.actionName) {
        lastMoveText = `${pc.actorName}: ${pc.actionName}`;
      }
      centerPileCard = {
        kind: 'party',
        mainText: pc.claimedRole ?? 'COURT',
        subText: lastMoveText ?? '',
        badgeText: lang === 'zh' ? '宣称身份' : 'CLAIMED ROLE',
        accentHex: '#FFB800',
      };
    } else if (gameId === 'property-deal' && s.lastPlayedCard && typeof s.lastPlayedCard === 'object') {
      const lpc = s.lastPlayedCard as {
        title?: string;
        subtitle?: string;
        badge?: string;
        accentHex?: string;
      };
      if (lpc.title) lastMoveText = `${lpc.badge ? `${lpc.badge} · ` : ''}${lpc.title}`;
      if (typeof s.deckCount === 'number') {
        tableBadge = {
          text: lang === 'zh' ? `牌堆 ${s.deckCount}` : `DECK ${s.deckCount}`,
          bg: '#10D98B',
          fg: '#0A1913',
        };
      }
      centerPileCard = {
        kind: 'party',
        mainText: lpc.title ?? 'DEAL',
        subText: lpc.subtitle ?? '',
        badgeText: lpc.badge ?? 'PLAYED',
        accentHex: lpc.accentHex ?? '#10D98B',
      };
    } else if (gameId === 'flip-seven' && s.lastFlipped && typeof s.lastFlipped === 'object') {
      const lf = s.lastFlipped as { label?: string; subtitle?: string; accentHex?: string };
      if (lf.label) lastMoveText = lf.label;
      if (typeof s.targetScore === 'number') {
        tableBadge = {
          text: `${lang === 'zh' ? '目标' : 'GOAL'} ${s.targetScore}`,
          bg: '#00C2FF',
          fg: '#0B1219',
        };
      }
      centerPileCard = {
        kind: 'party',
        mainText: lf.label ?? '7',
        subText: lf.subtitle ?? '',
        badgeText: 'FLIP 7',
        accentHex: lf.accentHex ?? '#00C2FF',
      };
    } else if (typeof s.tableComboName === 'string' && s.tableComboName) {
      tableBadge = {
        text: s.tableComboName,
        bg: '#FFB800',
        fg: '#14120B',
      };
      if (typeof s.trickOwnerName === 'string' && s.trickOwnerName) {
        lastMoveText = `${s.trickOwnerName}: ${s.tableComboName}`;
      }
    } else if (typeof s.tableLabel === 'string' && s.tableLabel) {
      tableBadge = {
        text: s.tableLabel,
        bg: '#FFB800',
        fg: '#14120B',
      };
    } else if (typeof s.pot === 'number' && s.pot > 0) {
      tableBadge = {
        text: `POT $${s.pot}`,
        bg: '#10D98B',
        fg: '#0A1913',
      };
    } else if (typeof s.currentBid === 'string' && s.currentBid) {
      tableBadge = {
        text: s.currentBid,
        bg: '#FFB800',
        fg: '#14120B',
      };
    } else if (typeof s.round === 'number') {
      tableBadge = {
        text: `R${s.round}`,
        bg: '#00C2FF',
        fg: '#0B1219',
      };
    }

    if (typeof s.dealerTotal === 'number' && s.dealerTotal > 0) {
      summaryParts.push(lang === 'zh' ? `庄家 ${s.dealerTotal}` : `Dealer ${s.dealerTotal}`);
    }
    if (!lastMoveText && typeof s.banner === 'string' && s.banner) {
      lastMoveText = s.banner;
    }
    if (typeof s.banner === 'string' && s.banner && summaryParts.length < 2) {
      summaryParts.push(s.banner);
    }
  }

  if (!tableBadge && cardState?.badgeText) {
    tableBadge = {
      text: cardState.badgeText,
      bg: cardState.badgeColorHex ?? '#FFB800',
      fg: '#0B1219',
    };
  }

  if (summaryParts.length === 0 && activePlayer) {
    summaryParts.push(
      activePlayer.isMe
        ? lang === 'zh'
          ? '轮到你出牌！'
          : 'Your Turn!'
        : lang === 'zh'
        ? `${activePlayer.name} 回合`
        : `${activePlayer.name}'s Turn`
    );
  }

  const canDrawDeck = Boolean(
    cardState?.isMyTurn &&
      (gameId === 'color-clash' ||
        gameId === 'dark-flip-clash' ||
        gameId === 'boom-kittens' ||
        cardState.secondaryBtn?.action.type === 'draw-or-pass' ||
        cardState.primaryBtn?.action.type === 'draw-or-pass')
  );

  return {
    gameId,
    activePlayerId,
    activePlayerName: activePlayer?.name,
    activePlayerColor: activePlayer?.colorHex,
    direction,
    deckCount,
    activeColorKey,
    centerPileCard,
    canDrawDeck,
    tableBadge,
    tableSummary: summaryParts.join(' · '),
    lastMoveText,
    banner: typeof s?.banner === 'string' ? s.banner : null,
    players,
  };
}

export function PhoneController({
  initialRoomCode = '',
  initialMode = 'join',
  preferredGameId,
  defaultName,
  autoJoin = false,
  embedded = false,
  keyboardProfile = 'none',
  onExit,
}: PhoneControllerProps) {
  const { lang, t } = useLanguage();
  const [entryMode, setEntryMode] = useState<'join' | 'pocket'>(() =>
    initialRoomCode.trim().length === 4 ? 'join' : initialMode
  );
  const hostSession = useHostAuthSession();
  const publicAccessOpen = usePublicAccessOpen();
  const pocketPinUnlocked = Boolean(hostSession?.token) || publicAccessOpen;
  const [pocketPinInput, setPocketPinInput] = useState('');
  const [pocketPinSubmitting, setPocketPinSubmitting] = useState(false);
  const [pocketPinError, setPocketPinError] = useState<string | null>(null);

  useEffect(() => {
    if (entryMode !== 'pocket') return;
    void fetchHostAuthStatus().catch(() => {});
  }, [entryMode]);

  const [roomCode, setRoomCode] = useState(initialRoomCode.toUpperCase());
  const [playerName, setPlayerName] = useState(
    () => defaultName || CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)]
  );
  const [preferredColor, setPreferredColor] = useState(PLAYER_PALETTE[0].id);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(() => {
    if (!embedded && typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('joinstick_avatar_v1');
        if (saved && isValidAvatarId(saved)) return saved;
      } catch {
        // Ignore storage error
      }
    }
    return AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)].id;
  });
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const syncStore = useMemo(() => createRoomSyncStore(), []);
  const syncState = useRoomSyncSnapshot(syncStore);
  const wsConnected = syncState.wsConnected;
  const socketStatus = syncState.socketStatus;
  const room = syncState.room;
  const cardState = syncState.cardState;
  const [joinedPlayerId, setJoinedPlayerId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [passHostOpen, setPassHostOpen] = useState(false);
  const [closeRoomConfirmOpen, setCloseRoomConfirmOpen] = useState(false);
  const [hostToast, setHostToast] = useState<string | null>(null);
  const [controllerPrefs, setControllerPrefs] = useState<ControllerPrefs>(() => loadControllerPrefs());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [repositionMode, setRepositionMode] = useState(false);
  const [manualReconnecting, setManualReconnecting] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [autoTapPinned, setAutoTapPinned] = useState(false);
  const [emoteDrawerOpen, setEmoteDrawerOpen] = useState(false);
  const [pocketMenuOpen, setPocketMenuOpen] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<null | 'shared' | 'copied'>(null);
  const [connectedGamepadName, setConnectedGamepadName] = useState<string | null>(null);
  const [floatingOriginOffset, setFloatingOriginOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [pocketTickVersion, setPocketTickVersion] = useState(0);
  const [pocketMuted, setPocketMuted] = useState(false);
  const [pocketCardViewOverride, setPocketCardViewOverride] = useState<
    'auto' | 'show-hand' | 'show-table'
  >('auto');
  const [pocketRulesOpen, setPocketRulesOpen] = useState(false);
  const [ruleBotOpen, setRuleBotOpen] = useState(false);
  const [pocketCoachDismissed, setPocketCoachDismissed] = useState(false);
  const [pocketCoachExpired, setPocketCoachExpired] = useState(false);
  const [pocketCardActed, setPocketCardActed] = useState(false);
  const [pocketTopHudTucked, setPocketTopHudTucked] = useState(false);
  const pocketHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pocketCompletionRef = useRef<{
    gameId: GameId | null;
    round: number | null;
    hole: number | null;
    phase: string | null;
    meFinished: boolean;
    meAlive: boolean;
  }>({
    gameId: null,
    round: null,
    hole: null,
    phase: null,
    meFinished: false,
    meAlive: true,
  });
  const prevHudStatusFlagsRef = useRef<{
    alive: boolean;
    frenzy: boolean;
    handLen: number | null;
  }>({
    alive: true,
    frenzy: false,
    handLen: null,
  });
  const prevCardTurnRef = useRef<boolean | null>(null);
  const prevPocketMatchPhaseRef = useRef<{ status: RoomSnapshot['status'] | null; gameId: GameId | null }>({
    status: null,
    gameId: null,
  });

  const latestSnapshotRef = useRef<GameSnapshot | null>(null);
  const latestCompetitiveRef = useRef<CompetitiveSnapshot | null>(null);
  const fxRef = useRef(createRenderFxState());
  const localPredictionRef = useRef<LocalPaddlePrediction | null>(null);
  const hasPocketSnapRef = useRef<boolean>(false);
  const lastPocketHudBumpRef = useRef<number>(0);
  const pocketAudioStartedRef = useRef<boolean>(false);

  const wasDisconnectedRef = useRef<boolean>(false);
  const prevIsHostRef = useRef<boolean>(false);
  const hostToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReconnectTapRef = useRef<number>(0);
  const lastEmoteAtRef = useRef<number>(0);
  const autoTapPulseRef = useRef<boolean>(false);
  const hwActiveRef = useRef<boolean>(false);
  const pulseATimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerPrefsRef = useRef<ControllerPrefs>(controllerPrefs);
  const userExitedPhoneFsRef = useRef<boolean>(false);
  const manualExitFsRef = useRef<boolean>(false);
  const wasFullscreenRef = useRef<boolean>(false);
  const prevRoomStatusRef = useRef<RoomSnapshot['status'] | null>(null);
  const prevOutcomeStatusRef = useRef<RoomSnapshot['status'] | null>(null);
  const [outcomeOverlayOpen, setOutcomeOverlayOpen] = useState(false);
  const [rendererLoadState, setRendererLoadState] = useState<'ready' | 'loading' | 'error'>('ready');
  const dragTargetRef = useRef<{
    target: 'stick' | 'buttons';
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Viewport tracking for automatic CSS landscape rotation on portrait phones
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 800,
    h: typeof window !== 'undefined' ? window.innerHeight : 600,
  }));

  // Visual state for analog joystick + buttons
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [stickActive, setStickActive] = useState(false);
  const [pressedA, setPressedA] = useState(false);
  const [pressedB, setPressedB] = useState(false);

  // Refs synced with latest state so WebSocket/pointer closures are never stale
  const wsRef = useRef<ManagedWebSocket | null>(null);
  const roomRef = useRef<RoomSnapshot | null>(room);
  const joinedPlayerIdRef = useRef<string | null>(joinedPlayerId);
  const roomCodeRef = useRef<string>(roomCode);
  const playerNameRef = useRef<string>(playerName);
  const preferredColorRef = useRef<string>(preferredColor);
  const selectedAvatarIdRef = useRef<string>(selectedAvatarId);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const inputRef = useRef<ControllerInput>({ dx: 0, dy: 0, a: false, b: false });
  const lastSentRef = useRef<string>('');
  const lastSentAtRef = useRef<number>(0);

  const stickPointerId = useRef<number | null>(null);
  const stickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stickZoneRef = useRef<HTMLDivElement | null>(null);
  const btnAPointers = useRef<Set<number>>(new Set());
  const btnBPointers = useRef<Set<number>>(new Set());
  const keysDownRef = useRef<Set<string>>(new Set());

  const isCssRotated = !embedded && viewport.w < viewport.h && viewport.w <= 960;
  const isCssRotatedRef = useRef<boolean>(isCssRotated);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    joinedPlayerIdRef.current = joinedPlayerId;
  }, [joinedPlayerId]);
  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);
  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);
  useEffect(() => {
    preferredColorRef.current = preferredColor;
  }, [preferredColor]);
  useEffect(() => {
    selectedAvatarIdRef.current = selectedAvatarId;
  }, [selectedAvatarId]);
  useEffect(() => {
    isCssRotatedRef.current = isCssRotated;
  }, [isCssRotated]);
  useEffect(() => {
    controllerPrefsRef.current = controllerPrefs;
  }, [controllerPrefs]);

  useEffect(() => {
    if (initialRoomCode.trim().length === 4) {
      setEntryMode('join');
    } else {
      setEntryMode(initialMode);
    }
  }, [initialMode, initialRoomCode]);

  const updateControllerPrefs = (next: ControllerPrefs) => {
    const clamped = clampControllerPrefs(next);
    controllerPrefsRef.current = clamped;
    setControllerPrefs(clamped);
    saveControllerPrefs(clamped);
  };

  const handleResetControllerPrefs = () => {
    updateControllerPrefs(DEFAULT_CONTROLLER_PREFS);
  };

  // Listen to resize, orientationchange, and fullscreen changes
  useEffect(() => {
    if (embedded) return;
    const doc = document as Document & { webkitFullscreenElement?: Element };
    const initialFs = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
    wasFullscreenRef.current = initialFs;
    setIsFullscreen(initialFs);

    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    const onFsChange = () => {
      const nextFs = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
      if (wasFullscreenRef.current && !nextFs) {
        // Respect native exits (Esc key, mobile soft keyboard opening, swipe/back gesture, browser UI)
        userExitedPhoneFsRef.current = true;
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
          manualExitFsRef.current = true;
        }
      } else if (nextFs) {
        userExitedPhoneFsRef.current = false;
        manualExitFsRef.current = false;
      }
      wasFullscreenRef.current = nextFs;
      setIsFullscreen(nextFs);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [embedded]);

  const enterFullscreenAndLandscape = (force = false) => {
    if (embedded || typeof document === 'undefined') return;
    if (!force && (!joinedPlayerIdRef.current || userExitedPhoneFsRef.current)) {
      return;
    }
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
      return;
    }

    try {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
        msRequestFullscreen?: () => Promise<void> | void;
      };
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        if (typeof el.requestFullscreen === 'function') {
          el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions).catch(() => {});
        } else if (typeof el.webkitRequestFullscreen === 'function') {
          el.webkitRequestFullscreen();
        } else if (typeof el.msRequestFullscreen === 'function') {
          el.msRequestFullscreen();
        }
      }
    } catch {
      // Fullscreen may not be supported on iOS Safari; CSS full-viewport rotation handles it
    }

    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientation && typeof orientation.lock === 'function') {
        orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Orientation lock unsupported; CSS auto-rotation handles portrait devices
    }

    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      };
      if (nav.wakeLock && !wakeLockRef.current) {
        nav.wakeLock
          .request('screen')
          .then((lock) => {
            wakeLockRef.current = lock;
          })
          .catch(() => {});
      }
    } catch {
      // Wake lock optional
    }
  };

  const triggerRoomFullscreen = () => {
    if (embedded || typeof document === 'undefined') return;
    const activeEl = document.activeElement as HTMLElement | null;
    if (
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT')
    ) {
      activeEl.blur();
    }
    userExitedPhoneFsRef.current = false;
    manualExitFsRef.current = false;
    enterFullscreenAndLandscape(true);
  };

  const exitFullscreenAndUnlock = () => {
    if (embedded || typeof document === 'undefined') return;
    userExitedPhoneFsRef.current = true;
    try {
      const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void };
      orientation?.unlock?.();
    } catch {
      // Ignore unlock error
    }
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    } catch {
      // Ignore wakeLock release error
    }
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        webkitExitFullscreen?: () => Promise<void> | void;
      };
      if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') {
        doc.webkitExitFullscreen();
      }
    } catch {
      // Ignore exitFullscreen error
    }
  };

  const toggleFullscreen = () => {
    if (embedded || typeof document === 'undefined') return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
    };
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      manualExitFsRef.current = true;
      exitFullscreenAndUnlock();
    } else {
      triggerRoomFullscreen();
    }
  };

  // Trigger fullscreen automatically when entering a game room or starting a match (unless user manually exited)
  useEffect(() => {
    if (closedReason) {
      manualExitFsRef.current = false;
      exitFullscreenAndUnlock();
      return;
    }
    const status = room?.status ?? null;
    const prev = prevRoomStatusRef.current;
    prevRoomStatusRef.current = status;
    if (embedded || !status || !joinedPlayerId) return;
    const enteredGameRoom =
      prev === null ||
      (prev === 'SETUP' && (status === 'LOBBY' || status === 'COUNTDOWN' || status === 'PLAYING')) ||
      ((prev === 'LOBBY' || prev === 'BRIEFING' || prev === 'RESULTS' || prev === 'VOTING') &&
        (status === 'COUNTDOWN' || status === 'PLAYING'));
    if (enteredGameRoom && !manualExitFsRef.current) {
      userExitedPhoneFsRef.current = false;
      enterFullscreenAndLandscape(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, joinedPlayerId, embedded, closedReason]);

  useEffect(() => {
    const status = room?.status ?? null;
    const prev = prevOutcomeStatusRef.current;
    prevOutcomeStatusRef.current = status;
    if (!joinedPlayerId || !status) {
      setOutcomeOverlayOpen(false);
      return;
    }
    if (status === 'RESULTS' && prev !== 'RESULTS') {
      setOutcomeOverlayOpen(true);
    } else if (status !== 'RESULTS') {
      setOutcomeOverlayOpen(false);
    }
  }, [room?.status, joinedPlayerId]);

  const simSlot: 'P1' | 'P2' = useMemo(() => {
    const raw = (defaultName || 'Test P1').trim().toUpperCase();
    return raw.endsWith('P2') ? 'P2' : 'P1';
  }, [defaultName]);

  const sessionKey = useMemo(
    () => (embedded ? `joinstick_sim_${simSlot}` : 'joinstick_player_id'),
    [embedded, simSlot]
  );
  const roomCodeSessionKey = `${sessionKey}_room`;

  const persistentDeviceIdRef = useRef<string>('');
  const getDeviceId = (codeForJoin: string): string => {
    const cleanCode = codeForJoin.trim().toUpperCase();
    if (embedded) {
      return `sim_device_${cleanCode}_${simSlot}`;
    }
    if (persistentDeviceIdRef.current) {
      return persistentDeviceIdRef.current;
    }
    if (typeof window !== 'undefined') {
      try {
        const existing =
          window.localStorage.getItem('joinstick_device_id_v1') ||
          window.sessionStorage.getItem('joinstick_device_id_v1');
        if (existing && existing.length >= 8) {
          persistentDeviceIdRef.current = existing;
          return existing;
        }
        const created = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        try {
          window.localStorage.setItem('joinstick_device_id_v1', created);
        } catch {
          // Ignore localStorage quota/privacy error
        }
        try {
          window.sessionStorage.setItem('joinstick_device_id_v1', created);
        } catch {
          // Ignore sessionStorage error
        }
        persistentDeviceIdRef.current = created;
        return created;
      } catch {
        // Fallback below
      }
    }
    const fallback = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    persistentDeviceIdRef.current = fallback;
    return fallback;
  };

  const ensureWakeLock = () => {
    if (embedded || wakeLockRef.current || typeof navigator === 'undefined') return;
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      };
      if (nav.wakeLock) {
        nav.wakeLock
          .request('screen')
          .then((lock) => {
            wakeLockRef.current = lock;
          })
          .catch(() => {});
      }
    } catch {
      // Wake lock optional
    }
  };

  // Persistent playerId & roomCode for instant reconnects (for both real phones & Test Controllers)
  const storedPlayerIdRef = useRef<string | undefined>((() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const saved = window.sessionStorage.getItem(sessionKey);
      const savedRoom = window.sessionStorage.getItem(roomCodeSessionKey);
      const initCode = initialRoomCode.trim().toUpperCase();
      if (saved && (!initCode || !savedRoom || savedRoom === initCode)) {
        return saved;
      }
    } catch {
      // Ignore storage error
    }
    return undefined;
  })());

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(sessionKey);
      const savedRoom = sessionStorage.getItem(roomCodeSessionKey);
      const currentCode = roomCodeRef.current.trim().toUpperCase();
      if (saved && (!currentCode || !savedRoom || savedRoom === currentCode)) {
        storedPlayerIdRef.current = saved;
      }
      if (!embedded && savedRoom && savedRoom.length === 4 && !roomCodeRef.current) {
        roomCodeRef.current = savedRoom;
        setRoomCode(savedRoom);
      }
    } catch {
      // Ignore storage error
    }
  }, [embedded, sessionKey, roomCodeSessionKey]);

  const sendCurrentInput = (force = false) => {
    const ws = wsRef.current;
    if (!ws || !joinedPlayerIdRef.current) return;
    const inp = inputRef.current;
    const rounded: ControllerInput = {
      dx: Math.round(inp.dx * 100) / 100,
      dy: Math.round(inp.dy * 100) / 100,
      a: Boolean(inp.a || autoTapPulseRef.current),
      b: inp.b,
    };
    if (typeof inp.targetX === 'number' && Number.isFinite(inp.targetX)) {
      rounded.targetX = Math.round(inp.targetX * 10) / 10;
    }
    if (typeof inp.targetY === 'number' && Number.isFinite(inp.targetY)) {
      rounded.targetY = Math.round(inp.targetY * 10) / 10;
    }
    if (typeof inp.aimAngle === 'number' && Number.isFinite(inp.aimAngle)) {
      rounded.aimAngle = Math.round(inp.aimAngle * 1000) / 1000;
    }
    if (typeof inp.shootPower === 'number' && Number.isFinite(inp.shootPower)) {
      rounded.shootPower = Math.round(inp.shootPower * 100) / 100;
    }
    if (typeof inp.shootRelease === 'number' && Number.isFinite(inp.shootRelease)) {
      rounded.shootRelease = Math.floor(inp.shootRelease);
    }
    const key = `${rounded.dx}|${rounded.dy}|${rounded.a ? 1 : 0}|${rounded.b ? 1 : 0}|${rounded.targetX ?? ''}|${rounded.targetY ?? ''}|${rounded.aimAngle ?? ''}|${rounded.shootPower ?? ''}|${rounded.shootRelease ?? ''}`;
    const now = Date.now();
    const isActive =
      rounded.dx !== 0 ||
      rounded.dy !== 0 ||
      rounded.a ||
      rounded.b ||
      rounded.targetX !== undefined ||
      rounded.shootPower !== undefined;

    // Resend immediately on any change, or heartbeat every 120ms while actively holding controls
    if (!force && key === lastSentRef.current && (!isActive || now - lastSentAtRef.current < 120)) {
      return;
    }
    lastSentRef.current = key;
    lastSentAtRef.current = now;
    ws.send({ type: 'controller:input', input: rounded });
  };

  // Reset all pointer & button locks cleanly whenever game, pad mode, or room status transitions
  const resetControlsState = (clearAutoTap = false) => {
    stickPointerId.current = null;
    btnAPointers.current.clear();
    btnBPointers.current.clear();
    keysDownRef.current.clear();
    if (pulseATimerRef.current) {
      clearTimeout(pulseATimerRef.current);
      pulseATimerRef.current = null;
    }
    autoTapPulseRef.current = false;
    if (clearAutoTap) setAutoTapPinned(false);
    localPredictionRef.current = null;
    inputRef.current = { dx: 0, dy: 0, a: false, b: false };
    lastSentRef.current = '';
    setStickActive(false);
    setKnobOffset({ x: 0, y: 0 });
    setFloatingOriginOffset({ x: 0, y: 0 });
    setPressedA(false);
    setPressedB(false);
    sendCurrentInput(true);
  };

  useEffect(() => {
    resetControlsState(true);
    setPassHostOpen(false);
    setCloseRoomConfirmOpen(false);
    setRepositionMode(false);
    setEmoteDrawerOpen(false);
    setPocketMenuOpen(false);
    setPocketRulesOpen(false);
    setPocketCardViewOverride('auto');
    prevCardTurnRef.current = null;
    if (room?.status !== 'PLAYING' && room?.status !== 'COUNTDOWN' && room?.status !== 'PAUSED') {
      syncStore.applyCardState(null);
      latestSnapshotRef.current = null;
      latestCompetitiveRef.current = null;
      hasPocketSnapRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, room?.selectedGameId, room?.hostPlayerId]);

  // Reset in-game coach once per match start (preserving state across Pause -> Resume)
  useEffect(() => {
    const nextStatus = room?.status ?? null;
    const nextGameId = room?.selectedGameId ?? null;
    const prev = prevPocketMatchPhaseRef.current;
    const gameChanged = nextGameId !== prev.gameId;
    const enteredFreshMatch =
      nextStatus === 'COUNTDOWN' ||
      (nextStatus === 'PLAYING' && prev.status !== 'PAUSED' && prev.status !== 'COUNTDOWN' && prev.status !== 'PLAYING');

    if (gameChanged || enteredFreshMatch) {
      setPocketCoachDismissed(false);
      setPocketCoachExpired(false);
      setPocketCardActed(false);
    }
    prevPocketMatchPhaseRef.current = { status: nextStatus, gameId: nextGameId };
  }, [room?.status, room?.selectedGameId]);

  const clearPocketHudTimer = () => {
    if (pocketHudTimerRef.current) {
      clearTimeout(pocketHudTimerRef.current);
      pocketHudTimerRef.current = null;
    }
  };

  const schedulePocketHudAutoTuck = (delayMs = 2800) => {
    clearPocketHudTimer();
    pocketHudTimerRef.current = setTimeout(() => {
      pocketHudTimerRef.current = null;
      setPocketTopHudTucked(true);
    }, delayMs);
  };

  const revealPocketHudTemporarily = (delayMs = 3800) => {
    setPocketTopHudTucked(false);
    schedulePocketHudAutoTuck(delayMs);
  };

  const tuckPocketHudNow = () => {
    clearPocketHudTimer();
    setPocketTopHudTucked(true);
  };

  // Auto-fade the live Pocket Mode arcade coach strip after 6.5s of active play
  useEffect(() => {
    if (
      room?.roomMode !== 'pocket' ||
      room.status !== 'PLAYING' ||
      CARD_GAME_IDS.has(room.selectedGameId) ||
      pocketCoachDismissed ||
      pocketCoachExpired
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      setPocketCoachExpired(true);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [room?.roomMode, room?.status, room?.selectedGameId, pocketCoachDismissed, pocketCoachExpired]);

  // Pocket Mode top HUD: auto-tuck ("keep up") during active play & auto-show on status/completion
  const pocketHudPinnedOpen = Boolean(
    repositionMode ||
      emoteDrawerOpen ||
      pocketMenuOpen ||
      pocketRulesOpen ||
      settingsOpen ||
      !wsConnected
  );

  useEffect(() => {
    if (room?.roomMode !== 'pocket' || room.status !== 'PLAYING') {
      clearPocketHudTimer();
      setPocketTopHudTucked(false);
      pocketCompletionRef.current = {
        gameId: room?.selectedGameId ?? null,
        round: null,
        hole: null,
        phase: null,
        meFinished: false,
        meAlive: true,
      };
      return;
    }
    pocketCompletionRef.current = {
      gameId: room.selectedGameId,
      round: null,
      hole: null,
      phase: null,
      meFinished: false,
      meAlive: true,
    };
    if (!pocketHudPinnedOpen) {
      revealPocketHudTemporarily(2400);
    }
    return () => clearPocketHudTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.roomMode, room?.status, room?.selectedGameId]);

  useEffect(() => {
    if (room?.roomMode !== 'pocket' || room.status !== 'PLAYING') return;
    if (pocketHudPinnedOpen) {
      clearPocketHudTimer();
      setPocketTopHudTucked(false);
    } else if (!pocketTopHudTucked && !pocketHudTimerRef.current) {
      schedulePocketHudAutoTuck(3200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pocketHudPinnedOpen, room?.roomMode, room?.status, pocketTopHudTucked]);

  const selfPlayerForHud = room?.players.find((p) => p.id === joinedPlayerId) ?? null;
  const selfAliveForHud = selfPlayerForHud ? selfPlayerForHud.alive : true;
  const frenzyActiveForHud = Boolean(room?.frenzy?.active);
  const cardHandLenForHud = cardState ? cardState.hand.length : null;

  useEffect(() => {
    const prev = prevHudStatusFlagsRef.current;
    if (room?.roomMode === 'pocket' && room.status === 'PLAYING') {
      const eliminatedNow = prev.alive && !selfAliveForHud;
      const frenzyTriggered = !prev.frenzy && frenzyActiveForHud;
      const handEmptied =
        prev.handLen !== null &&
        prev.handLen > 0 &&
        cardHandLenForHud === 0;
      if ((eliminatedNow || frenzyTriggered || handEmptied) && !pocketHudPinnedOpen) {
        revealPocketHudTemporarily(4200);
      }
    }
    prevHudStatusFlagsRef.current = {
      alive: selfAliveForHud,
      frenzy: frenzyActiveForHud,
      handLen: cardHandLenForHud,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.roomMode, room?.status, selfAliveForHud, frenzyActiveForHud, cardHandLenForHud, pocketHudPinnedOpen]);

  // Pocket Mode audio & BGM lifecycle
  useEffect(() => {
    if (room?.roomMode !== 'pocket') {
      if (pocketAudioStartedRef.current) {
        pocketAudioStartedRef.current = false;
        arcadeAudio.setBgm(null);
      }
      return;
    }
    pocketAudioStartedRef.current = true;
    arcadeAudio.setMuted(pocketMuted);
    if (
      room.status === 'SETUP' ||
      room.status === 'LOBBY' ||
      room.status === 'BRIEFING' ||
      room.status === 'VOTING'
    ) {
      arcadeAudio.setBgm('lobby');
    } else if (room.status === 'PLAYING' || room.status === 'COUNTDOWN') {
      arcadeAudio.setBgm(room.frenzy.active ? 'frenzy' : 'battle');
    } else {
      arcadeAudio.setBgm(null);
    }
  }, [room?.roomMode, room?.status, room?.frenzy?.active, pocketMuted]);

  useEffect(() => {
    return () => {
      if (pocketAudioStartedRef.current) {
        pocketAudioStartedRef.current = false;
        arcadeAudio.setBgm(null);
      }
    };
  }, []);

  // Clear stuck touches if browser tab loses focus
  useEffect(() => {
    const onBlur = () => resetControlsState();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-acquire Screen Wake Lock when returning to the phone browser tab
  useEffect(() => {
    if (embedded || !joinedPlayerId) return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (wsRef.current?.isConnected()) {
        syncStore.requestSync(true);
      } else {
        wsRef.current?.reconnectNow(false);
      }
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) {
          nav.wakeLock
            .request('screen')
            .then((lock) => {
              wakeLockRef.current = lock;
            })
            .catch(() => {});
        }
      } catch {
        // Wake lock optional
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [embedded, joinedPlayerId]);

  // Reset controls cleanly if connection drops mid-session
  useEffect(() => {
    const selfPlayer = room?.players.find((p) => p.id === joinedPlayerId) ?? null;
    const isLost = Boolean(joinedPlayerId && room && (!wsConnected || (selfPlayer && !selfPlayer.connected)));
    if (isLost && !wasDisconnectedRef.current) {
      wasDisconnectedRef.current = true;
      resetControlsState();
    } else if (!isLost && wasDisconnectedRef.current) {
      wasDisconnectedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsConnected, joinedPlayerId, room]);

  // Auto-clear stale ready-check error messages whenever the room ready condition or status changes
  const unreadyIdsKey = room?.readyGate?.unreadyHumanIds?.join(',') ?? '';
  useEffect(() => {
    setErrorMsg(null);
  }, [room?.status, room?.readyGate?.allHumansReady, unreadyIdsKey, room?.players.length]);

  // Notify the player if they inherit Host Remote Control mid-session, including the reason
  useEffect(() => {
    const isHostNow = Boolean(room && joinedPlayerId && room.hostPlayerId === joinedPlayerId);
    const wasHost = prevIsHostRef.current;
    prevIsHostRef.current = isHostNow;

    if (!wasHost && isHostNow && room && room.status !== 'SETUP') {
      const transfer =
        room.hostTransfer && room.hostTransfer.toPlayerId === joinedPlayerId
          ? room.hostTransfer
          : null;
      const fromName = transfer?.fromPlayerName;
      let message: string;
      if (transfer?.reason === 'disconnect-timeout') {
        message =
          lang === 'zh'
            ? `你已成为新房主！（原房主 ${fromName || ''} 离线满 15 秒，按 P1→P2 顺序移交）`
            : `You are now the Room Host! (${fromName || 'Previous host'} offline 15s · passed in slot order)`;
      } else if (transfer?.reason === 'player-left') {
        message =
          lang === 'zh'
            ? `你已成为新房主！（原房主 ${fromName || ''} 已离开房间）`
            : `You are now the Room Host! (${fromName || 'Previous host'} left the room)`;
      } else if (transfer?.reason === 'kicked') {
        message =
          lang === 'zh'
            ? `你已成为新房主！（原房主 ${fromName || ''} 已被移出房间）`
            : `You are now the Room Host! (${fromName || 'Previous host'} was removed)`;
      } else if (transfer?.reason === 'real-phone-priority') {
        message =
          lang === 'zh'
            ? '你已成为新房主！（真实手机优先于测试手柄接管大屏遥控器）'
            : 'You are now the Room Host! (Real phone prioritized over Test Controller)';
      } else if (transfer?.reason === 'manual' && fromName) {
        message =
          lang === 'zh'
            ? `${fromName} 已将房主遥控权移交给你！`
            : `${fromName} passed Host Remote Control to you!`;
      } else {
        message =
          lang === 'zh'
            ? '你已成为新房主！现在由你使用遥控器控制大屏。'
            : 'You are now the Room Host! Use this remote to control the TV.';
      }
      setHostToast(message);
      if (hostToastTimerRef.current) clearTimeout(hostToastTimerRef.current);
      hostToastTimerRef.current = setTimeout(() => setHostToast(null), 5000);
    }
  }, [room?.hostPlayerId, room?.hostTransfer?.seq, room?.status, joinedPlayerId, lang]);

  // Keep container/session warm during long controller play sessions
  useEffect(() => {
    if (embedded || !joinedPlayerId) return;
    const id = window.setInterval(() => {
      fetch('/api/health', { cache: 'no-store' }).catch(() => {});
    }, 4 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [embedded, joinedPlayerId]);

  // Safety net: if WebSocket is open while server snapshot still marks us disconnected, re-send room:join
  useEffect(() => {
    if (!wsConnected || !joinedPlayerId || !room) return;
    const self = room.players.find((p) => p.id === joinedPlayerId);
    if (!self || self.connected) {
      setManualReconnecting(false);
      return;
    }
    const timer = window.setInterval(() => {
      const codeNow = (roomRef.current?.code || roomCodeRef.current || '').trim().toUpperCase();
      if (wsRef.current?.isConnected() && storedPlayerIdRef.current && codeNow.length === 4) {
        wsRef.current.send({
          type: 'room:join',
          code: codeNow,
          name: playerNameRef.current.trim() || 'Player',
          playerId: storedPlayerIdRef.current,
          deviceId: getDeviceId(codeNow),
          isTestController: embedded,
          preferredColorId: preferredColorRef.current,
          avatarId: selectedAvatarIdRef.current,
        });
      }
    }, 1_400);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsConnected, joinedPlayerId, room]);

  // Manage WebSocket connection
  useEffect(() => {
    const socket = new ManagedWebSocket({
      onOpen: () => {
        syncStore.setSocketStatus('connected');
        let savedRoom = '';
        try {
          savedRoom = sessionStorage.getItem(roomCodeSessionKey) || '';
        } catch {
          // Ignore storage error
        }
        const codeNow = (roomRef.current?.code || roomCodeRef.current || savedRoom).trim().toUpperCase();
        if (storedPlayerIdRef.current && codeNow.length === 4) {
          socket.send({
            type: 'room:join',
            code: codeNow,
            name: playerNameRef.current.trim() || 'Player',
            playerId: storedPlayerIdRef.current,
            deviceId: getDeviceId(codeNow),
            isTestController: embedded,
            preferredColorId: preferredColorRef.current,
            avatarId: selectedAvatarIdRef.current,
          });
        } else if (autoJoin && initialRoomCode.length === 4) {
          const cleanInit = initialRoomCode.toUpperCase();
          setJoiningRoom(true);
          socket.send({
            type: 'room:join',
            code: cleanInit,
            name: playerNameRef.current.trim() || 'Player',
            playerId: storedPlayerIdRef.current,
            deviceId: getDeviceId(cleanInit),
            isTestController: embedded,
            preferredColorId: preferredColorRef.current,
            avatarId: selectedAvatarIdRef.current,
          });
        }
      },
      onClose: () => {
        syncStore.setSocketStatus('reconnecting');
        setJoiningRoom(false);
      },
      onRecover: () => {
        syncStore.requestSync(true);
      },
      onPendingOpsChange: (count) => {
        syncStore.setPendingOpsCount(count);
      },
      onStatusChange: (status) => {
        syncStore.setSocketStatus(status);
      },
      onMessage: (msg: ServerMessage) => {
        switch (msg.type) {
          case 'room:joined':
            storedPlayerIdRef.current = msg.playerId;
            joinedPlayerIdRef.current = msg.playerId;
            roomRef.current = msg.room;
            roomCodeRef.current = msg.room.code;
            setRoomCode(msg.room.code);
            try {
              sessionStorage.setItem(sessionKey, msg.playerId);
              sessionStorage.setItem(roomCodeSessionKey, msg.room.code);
            } catch {
              // Ignore storage error
            }
            if (msg.room.roomMode === 'pocket') {
              arcadeAudio.unlock();
              consumeGuestSingleUseTokenLocally();
            }
            if (manualReconnectTimerRef.current) {
              clearTimeout(manualReconnectTimerRef.current);
              manualReconnectTimerRef.current = null;
            }
            setManualReconnecting(false);
            setJoiningRoom(false);
            setJoinedPlayerId(msg.playerId);
            syncStore.applyRoomAuthoritative(msg.room, true);
            syncStore.applyCardState(null);
            setErrorMsg(null);
            setClosedReason(null);
            break;
          case 'room:snapshot':
            roomRef.current = msg.room;
            syncStore.applyRoomAuthoritative(msg.room);
            break;
          case 'game:tick': {
            if (msg.snapshot) {
              const { accepted } = syncStore.applyGameTick(msg);
              if (!accepted) break;
              latestSnapshotRef.current = syncStore.latestSnapshot;
              latestCompetitiveRef.current = syncStore.latestCompetitive;
              const nowMs = Date.now();
              if (!hasPocketSnapRef.current) {
                hasPocketSnapRef.current = true;
                lastPocketHudBumpRef.current = nowMs;
                setPocketTickVersion((v) => v + 1);
              } else if (
                roomRef.current?.roomMode === 'pocket' &&
                (CARD_GAME_IDS.has(roomRef.current.selectedGameId) ||
                  roomRef.current.selectedGameId === 'draw-guess-relay') &&
                nowMs - lastPocketHudBumpRef.current >= 200
              ) {
                lastPocketHudBumpRef.current = nowMs;
                setPocketTickVersion((v) => v + 1);
              }

              // Detect in-match completion milestones (round/hole/phase/finish) in Pocket Mode
              if (
                roomRef.current?.roomMode === 'pocket' &&
                roomRef.current.status === 'PLAYING'
              ) {
                const s = msg.snapshot as unknown as Record<string, unknown>;
                const snapRound = typeof s.round === 'number' ? s.round : null;
                const snapHole = typeof s.hole === 'number' ? s.hole : null;
                const snapPhase = typeof s.phase === 'string' ? s.phase : null;
                const playersArr = Array.isArray(s.players)
                  ? (s.players as Array<Record<string, unknown>>)
                  : [];
                const myIdNow = joinedPlayerIdRef.current;
                const meSnap = myIdNow ? playersArr.find((p) => p?.id === myIdNow) : undefined;
                const meFinished = Boolean(
                  meSnap &&
                    (meSnap.finished === true ||
                      meSnap.sunk === true ||
                      meSnap.completed === true)
                );
                const meAlive =
                  meSnap && typeof meSnap.alive === 'boolean' ? meSnap.alive : true;

                const prevComp = pocketCompletionRef.current;
                if (prevComp.gameId === roomRef.current.selectedGameId) {
                  const roundCompleted =
                    prevComp.round !== null && snapRound !== null && snapRound > prevComp.round;
                  const holeCompleted =
                    prevComp.hole !== null && snapHole !== null && snapHole > prevComp.hole;
                  const phaseDone =
                    snapPhase !== null &&
                    snapPhase !== prevComp.phase &&
                    /^(reveal|round-?end|round_?over|resolve|scoring|finished|celebration|intermission|showdown|results|ended|hole-?done)$/i.test(
                      snapPhase
                    );
                  const playerDone =
                    (!prevComp.meFinished && meFinished) || (prevComp.meAlive && !meAlive);

                  if (roundCompleted || holeCompleted || phaseDone || playerDone) {
                    revealPocketHudTemporarily(4200);
                  }
                }
                pocketCompletionRef.current = {
                  gameId: roomRef.current.selectedGameId,
                  round: snapRound,
                  hole: snapHole,
                  phase: snapPhase,
                  meFinished,
                  meAlive,
                };
              }
            }
            if (roomRef.current?.roomMode === 'pocket') {
              for (const s of msg.sounds) {
                arcadeAudio.play(s);
              }
              const snapRecord = (msg.snapshot ?? {}) as { shake?: number };
              if (typeof snapRecord.shake === 'number' && snapRecord.shake > fxRef.current.shake) {
                fxRef.current.shake = snapRecord.shake;
              }
            }
            break;
          }
          case 'player:card-state':
            syncStore.applyCardState(msg.cardState, msg.seq);
            break;
          case 'player:haptic':
            break;
          case 'room:closed':
            exitFullscreenAndUnlock();
            manualExitFsRef.current = false;
            storedPlayerIdRef.current = undefined;
            joinedPlayerIdRef.current = null;
            roomRef.current = null;
            latestSnapshotRef.current = null;
            latestCompetitiveRef.current = null;
            hasPocketSnapRef.current = false;
            try {
              sessionStorage.removeItem(sessionKey);
              sessionStorage.removeItem(roomCodeSessionKey);
            } catch {
              // Ignore storage error
            }
            setManualReconnecting(false);
            setJoiningRoom(false);
            setClosedReason(msg.reason);
            syncStore.reset();
            setJoinedPlayerId(null);
            break;
          case 'error':
            setManualReconnecting(false);
            setJoiningRoom(false);
            if (msg.code === 'HOST_AUTH_REQUIRED') {
              exitFullscreenAndUnlock();
              clearHostAuthSession();
              setPublicAccessOpenLocally(false);
              setPocketPinError(msg.message);
            } else if (msg.code === 'ROOM_NOT_FOUND' && joinedPlayerIdRef.current) {
              exitFullscreenAndUnlock();
              storedPlayerIdRef.current = undefined;
              joinedPlayerIdRef.current = null;
              roomRef.current = null;
              latestSnapshotRef.current = null;
              latestCompetitiveRef.current = null;
              hasPocketSnapRef.current = false;
              try {
                sessionStorage.removeItem(sessionKey);
                sessionStorage.removeItem(roomCodeSessionKey);
              } catch {
                // Ignore storage error
              }
              setJoinedPlayerId(null);
              syncStore.reset();
            }
            setErrorMsg(msg.message);
            break;
        }
      },
    });
    wsRef.current = socket;
    syncStore.attachSocket(socket);

    return () => {
      syncStore.detachSocket();
      socket.close();
      wsRef.current = null;
      clearPocketHudTimer();
      if (hostToastTimerRef.current) clearTimeout(hostToastTimerRef.current);
      if (manualReconnectTimerRef.current) clearTimeout(manualReconnectTimerRef.current);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic 30Hz input pump while connected
  useEffect(() => {
    if (!joinedPlayerId) return;
    const id = setInterval(() => {
      sendCurrentInput(false);
    }, 33);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinedPlayerId]);

  // Auto-Tap / Turbo Oscillator loop for Pad 1 & Pad 2
  useEffect(() => {
    if (
      !autoTapPinned ||
      !joinedPlayerId ||
      !room ||
      CARD_GAME_IDS.has(room.selectedGameId) ||
      room.status !== 'PLAYING'
    ) {
      if (autoTapPulseRef.current) {
        autoTapPulseRef.current = false;
        setPressedA(inputRef.current.a);
        sendCurrentInput(true);
      }
      return;
    }
    const halfPeriodMs = Math.max(28, Math.round(500 / controllerPrefs.autoTapRateHz));
    const timer = window.setInterval(() => {
      autoTapPulseRef.current = !autoTapPulseRef.current;
      setPressedA(Boolean(inputRef.current.a || autoTapPulseRef.current));
      sendCurrentInput(true);
    }, halfPeriodMs);
    return () => {
      window.clearInterval(timer);
      autoTapPulseRef.current = false;
      setPressedA(inputRef.current.a);
      sendCurrentInput(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTapPinned, controllerPrefs.autoTapRateHz, joinedPlayerId, room?.selectedGameId, room?.status]);

  // Physical Bluetooth / USB Hardware Gamepad Poller (Xbox, PS, Switch Pro, 8BitDo)
  useEffect(() => {
    if (embedded || !controllerPrefs.bluetoothEnabled || typeof navigator === 'undefined') {
      setConnectedGamepadName(null);
      return;
    }
    const scanConnected = () => {
      try {
        const pads = navigator.getGamepads?.() ?? [];
        const first = Array.from(pads).find((gp) => gp && gp.connected);
        setConnectedGamepadName(first ? first.id : null);
      } catch {
        setConnectedGamepadName(null);
      }
    };
    scanConnected();
    window.addEventListener('gamepadconnected', scanConnected);
    window.addEventListener('gamepaddisconnected', scanConnected);
    return () => {
      window.removeEventListener('gamepadconnected', scanConnected);
      window.removeEventListener('gamepaddisconnected', scanConnected);
    };
  }, [embedded, controllerPrefs.bluetoothEnabled]);

  useEffect(() => {
    if (
      embedded ||
      !controllerPrefs.bluetoothEnabled ||
      !joinedPlayerId ||
      !room ||
      CARD_GAME_IDS.has(room.selectedGameId) ||
      (room.status !== 'PLAYING' && room.status !== 'COUNTDOWN')
    ) {
      hwActiveRef.current = false;
      return;
    }

    let rafId = 0;
    const poll = () => {
      try {
        const pads = navigator.getGamepads?.() ?? [];
        const gp = Array.from(pads).find((p) => p && p.connected);
        if (gp) {
          const ax = gp.axes[0] ?? 0;
          const ay = gp.axes[1] ?? 0;
          let dx = Math.abs(ax) > 0.15 ? ax : 0;
          let dy = Math.abs(ay) > 0.15 ? ay : 0;
          if (gp.buttons[14]?.pressed) dx -= 1;
          if (gp.buttons[15]?.pressed) dx += 1;
          if (gp.buttons[12]?.pressed) dy -= 1;
          if (gp.buttons[13]?.pressed) dy += 1;
          const len = Math.hypot(dx, dy);
          if (len > 1) {
            dx /= len;
            dy /= len;
          }
          const a = Boolean(
            gp.buttons[0]?.pressed || gp.buttons[2]?.pressed || gp.buttons[7]?.pressed
          );
          const b = Boolean(
            gp.buttons[1]?.pressed || gp.buttons[3]?.pressed || gp.buttons[6]?.pressed
          );
          const hasHwSignal = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || a || b;
          if (hasHwSignal) {
            hwActiveRef.current = true;
            inputRef.current = { dx, dy, a, b };
            setKnobOffset({ x: dx * 38, y: dy * 38 });
            setStickActive(len > 0);
            setPressedA(a || autoTapPulseRef.current);
            setPressedB(b);
            sendCurrentInput(false);
          } else if (hwActiveRef.current) {
            hwActiveRef.current = false;
            inputRef.current = { dx: 0, dy: 0, a: false, b: false };
            setKnobOffset({ x: 0, y: 0 });
            setStickActive(false);
            setPressedA(autoTapPulseRef.current);
            setPressedB(false);
            sendCurrentInput(true);
          }
        }
      } catch {
        // Ignore browser gamepad security errors
      }
      rafId = window.requestAnimationFrame(poll);
    };
    rafId = window.requestAnimationFrame(poll);
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, controllerPrefs.bluetoothEnabled, joinedPlayerId, room?.selectedGameId, room?.status]);

  // Optional Keyboard Support for Desktop Test Controller Mode
  useEffect(() => {
    if (keyboardProfile === 'none' || !joinedPlayerId) return;

    const recomputeKeyboard = () => {
      const keys = keysDownRef.current;
      let dx = 0;
      let dy = 0;
      let a = false;
      let b = false;

      if (keyboardProfile === 'wasd') {
        if (keys.has('KeyA')) dx -= 1;
        if (keys.has('KeyD')) dx += 1;
        if (keys.has('KeyW')) dy -= 1;
        if (keys.has('KeyS')) dy += 1;
        a = keys.has('Space') || keys.has('KeyJ');
        b = keys.has('ShiftLeft') || keys.has('KeyK');
      } else if (keyboardProfile === 'arrows') {
        if (keys.has('ArrowLeft')) dx -= 1;
        if (keys.has('ArrowRight')) dx += 1;
        if (keys.has('ArrowUp')) dy -= 1;
        if (keys.has('ArrowDown')) dy += 1;
        a = keys.has('Enter') || keys.has('Slash');
        b = keys.has('ShiftRight') || keys.has('Period');
      }

      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }

      inputRef.current = { dx, dy, a, b };
      setKnobOffset({ x: dx * 38, y: dy * 38 });
      setStickActive(len > 0);
      setPressedA(a);
      setPressedB(b);
      sendCurrentInput(true);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const watched =
        keyboardProfile === 'wasd'
          ? ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'KeyJ', 'KeyK']
          : ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'ShiftRight', 'Slash', 'Period'];
      if (!watched.includes(e.code)) return;
      e.preventDefault();
      if (!keysDownRef.current.has(e.code)) {
        keysDownRef.current.add(e.code);
        recomputeKeyboard();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (keysDownRef.current.has(e.code)) {
        keysDownRef.current.delete(e.code);
        recomputeKeyboard();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardProfile, joinedPlayerId]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entryMode === 'pocket') {
      if (pocketPinSubmitting || joiningRoom) return;
      setPocketPinSubmitting(true);
      setPocketPinError(null);
      setErrorMsg(null);
      let authToken = getHostAuthToken();
      let isPublicOpen = getPublicAccessOpen();
      try {
        const status = await fetchHostAuthStatus();
        isPublicOpen = status.publicAccessOpen;
        authToken = getHostAuthToken();
        if (!isPublicOpen && !authToken) {
          const cleanedPin = pocketPinInput.trim();
          if (!cleanedPin) {
            setPocketPinError(
              t('Enter your Master PIN or a Friend Guest Pass.', '请输入房主密码或访客临时口令。')
            );
            return;
          }
          const sess = await verifyHostCode(cleanedPin);
          authToken = sess.token;
          setPocketPinInput('');
        }
      } catch (err) {
        setPocketPinError(
          err instanceof Error
            ? err.message
            : t('Invalid Master PIN or Guest Pass.', '密码或访客口令无效。')
        );
        return;
      } finally {
        setPocketPinSubmitting(false);
      }

      if (!authToken && !isPublicOpen) return;
      triggerRoomFullscreen();
      setErrorMsg(null);
      setJoiningRoom(true);
      storedPlayerIdRef.current = undefined;
      joinedPlayerIdRef.current = null;
      latestSnapshotRef.current = null;
      latestCompetitiveRef.current = null;
      hasPocketSnapRef.current = false;
      arcadeAudio.unlock();
      wsRef.current?.send({
        type: 'room:create-pocket',
        preferredGameId,
        name: playerName.trim() || 'Host',
        deviceId: getDeviceId('POCKET'),
        preferredColorId: preferredColor,
        avatarId: selectedAvatarId,
        ...(authToken ? { authToken } : {}),
      });
      return;
    }

    const cleaned = roomCode.trim().toUpperCase();
    if (cleaned.length !== 4) {
      setErrorMsg(
        t(
          'Enter the 4-letter room code shown on the monitor.',
          '请输入大屏上显示的 4 位房间码。'
        )
      );
      return;
    }
    triggerRoomFullscreen();
    setErrorMsg(null);
    setJoiningRoom(true);
    arcadeAudio.unlock();
    wsRef.current?.send({
      type: 'room:join',
      code: cleaned,
      name: playerName.trim() || 'Player',
      playerId: storedPlayerIdRef.current,
      deviceId: getDeviceId(cleaned),
      isTestController: embedded,
      preferredColorId: preferredColor,
      avatarId: selectedAvatarId,
    });
  };

  const handleSelectAvatar = (avatarId: string) => {
    setSelectedAvatarId(avatarId);
    selectedAvatarIdRef.current = avatarId;
    if (!embedded && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('joinstick_avatar_v1', avatarId);
      } catch {
        // Ignore storage failure
      }
    }
    if (joinedPlayerIdRef.current) {
      wsRef.current?.send({ type: 'player:set-avatar', avatarId });
    }
  };

  const handleSelectTeam = (teamId: TeamId) => {
    wsRef.current?.send({ type: 'player:set-team', teamId });
  };

  const handleCastCupVote = (gameId: GameId) => {
    wsRef.current?.send({ type: 'tournament:vote', gameId });
  };

  const ensureGameRendererReady = useCallback(async (gameId: GameId): Promise<boolean> => {
    if (isGameRendererReady(gameId)) {
      setRendererLoadState('ready');
      return true;
    }
    setRendererLoadState('loading');
    try {
      await preloadRenderer(gameId);
      setRendererLoadState('ready');
      return true;
    } catch {
      setRendererLoadState('error');
      return false;
    }
  }, []);

  useEffect(() => {
    const targetGameId = room?.tournament?.vote?.winningGameId ?? room?.selectedGameId;
    if (targetGameId) {
      void ensureGameRendererReady(targetGameId);
    }
  }, [room?.selectedGameId, room?.tournament?.vote?.winningGameId, ensureGameRendererReady]);

  const handleLeave = () => {
    const now = Date.now();
    if (now - lastReconnectTapRef.current < 280) return;
    lastReconnectTapRef.current = now;
    wsRef.current?.send({ type: 'player:leave' });
    storedPlayerIdRef.current = undefined;
    joinedPlayerIdRef.current = null;
    roomRef.current = null;
    latestSnapshotRef.current = null;
    latestCompetitiveRef.current = null;
    hasPocketSnapRef.current = false;
    if (pocketAudioStartedRef.current) {
      pocketAudioStartedRef.current = false;
      arcadeAudio.setBgm(null);
    }
    try {
      sessionStorage.removeItem(sessionKey);
      sessionStorage.removeItem(roomCodeSessionKey);
    } catch {
      // Ignore storage error
    }
    exitFullscreenAndUnlock();
    manualExitFsRef.current = false;
    setJoinedPlayerId(null);
    syncStore.reset();
    if (onExit) onExit();
  };

  const me = room?.players.find((p) => p.id === joinedPlayerId) ?? null;
  const gameMeta = room ? getLocalizedGameMeta(getGameMeta(room.selectedGameId), lang) : null;
  const isCardGame = Boolean(room && CARD_GAME_IDS.has(room.selectedGameId));
  const isMyCardTurnNow = Boolean(cardState && (cardState.isActionRequired || cardState.isMyTurn));

  useEffect(() => {
    if (!isCardGame || !cardState) {
      prevCardTurnRef.current = null;
      return;
    }
    if (prevCardTurnRef.current === false && isMyCardTurnNow) {
      setPocketCardViewOverride('auto');
    }
    prevCardTurnRef.current = isMyCardTurnNow;
  }, [isCardGame, cardState, isMyCardTurnNow]);

  const isPocketCardHandShown = Boolean(
    room?.status !== 'COUNTDOWN' &&
      cardState &&
      pocketCardViewOverride !== 'show-table'
  );

  const currentPadProfile = room ? getGamePadProfile(room.selectedGameId) : null;
  const recommendedPadMode: PadMode = isCardGame
    ? 'card'
    : currentPadProfile && currentPadProfile.pad !== 'card'
    ? currentPadProfile.pad
    : 'analog';
  const activeArcadePad: ArcadePadMode = (() => {
    if (!room || isCardGame) return 'analog';
    const override = controllerPrefs.perGamePadOverrides[room.selectedGameId];
    if (override) return override;
    if (controllerPrefs.autoSelectPadPerGame && currentPadProfile && currentPadProfile.pad !== 'card') {
      return currentPadProfile.pad;
    }
    return controllerPrefs.padMode;
  })();
  const activePadMode: PadMode = isCardGame ? 'card' : activeArcadePad;
  const effectiveArrowsStrictFourWay =
    controllerPrefs.arrowsStrictFourWay !== null
      ? controllerPrefs.arrowsStrictFourWay
      : currentPadProfile?.arrowsStrictFourWay ?? true;
  const effectiveTrackpadMode =
    controllerPrefs.trackpadModeOverride ?? currentPadProfile?.trackpadMode ?? 'glide';
  const effectiveTrackpadTapForA =
    controllerPrefs.trackpadTapForAOverride !== null
      ? controllerPrefs.trackpadTapForAOverride
      : currentPadProfile?.trackpadTapForA ?? true;
  const effectiveCardDefaultView = currentPadProfile?.cardDefaultView ?? 'fan';

  const handleSelectArcadePad = (nextPad: ArcadePadMode) => {
    if (!room) return;
    resetControlsState(true);
    setRepositionMode(false);
    updateControllerPrefs({
      ...controllerPrefsRef.current,
      padMode: controllerPrefsRef.current.autoSelectPadPerGame
        ? controllerPrefsRef.current.padMode
        : nextPad,
      perGamePadOverrides: {
        ...controllerPrefsRef.current.perGamePadOverrides,
        [room.selectedGameId]: nextPad,
      },
    });
  };

  const handleSetVector = (dx: number, dy: number) => {
    inputRef.current.dx = dx;
    inputRef.current.dy = dy;
    sendCurrentInput(true);
  };

  const handleSendDirectInput = (patch: Partial<ControllerInput>, force = false) => {
    Object.assign(inputRef.current, patch);
    sendCurrentInput(force);
  };

  const handlePulseActionA = () => {
    if (repositionMode || settingsOpen) return;
    if (pulseATimerRef.current) clearTimeout(pulseATimerRef.current);
    inputRef.current.a = true;
    setPressedA(true);
    sendCurrentInput(true);
    pulseATimerRef.current = setTimeout(() => {
      pulseATimerRef.current = null;
      if (btnAPointers.current.size === 0) {
        inputRef.current.a = false;
        setPressedA(Boolean(autoTapPulseRef.current));
        sendCurrentInput(true);
      }
    }, 115);
  };

  const handleSendQuickEmote = (emoji: string) => {
    const now = Date.now();
    if (now - lastEmoteAtRef.current < 450) return;
    lastEmoteAtRef.current = now;
    wsRef.current?.send({ type: 'player:emote', emoji });
    setEmoteDrawerOpen(false);
  };

  const isCardRedWarning = Boolean(
    isCardGame &&
      room?.status === 'PLAYING' &&
      cardState?.isActionRequired &&
      cardState.turnTimeLeft > 0 &&
      cardState.turnTimeLeft <= 5.0
  );

  const sendCardAction = (action: CardClientAction) => {
    if (action.type !== 'select-index' && action.type !== 'toggle-card') {
      setPocketCardActed(true);
    }
    wsRef.current?.send({ type: 'card:action', action });
  };

  // --- Multi-touch Analog Joystick Pointer Handlers (Rotation-Aware + Calibrated!) ---
  const updateStickFromPointer = (clientX: number, clientY: number) => {
    const activePrefs = controllerPrefsRef.current;
    const maxStickRadius = embedded ? 41 : activePrefs.stickRadius;
    const dxScreen = clientX - stickCenterRef.current.x;
    const dyScreen = clientY - stickCenterRef.current.y;

    // When container is CSS-rotated 90deg clockwise (portrait phone forced to landscape),
    // inverse-rotate viewport pointer delta into local landscape joystick coordinates:
    // localX = dyScreen, localY = -dxScreen
    const localDx = isCssRotatedRef.current ? dyScreen : dxScreen;
    const localDy = isCssRotatedRef.current ? -dxScreen : dyScreen;

    const dist = Math.hypot(localDx, localDy);
    const clamped = Math.min(dist, maxStickRadius);
    const angle = Math.atan2(localDy, localDx);
    const ox = Math.cos(angle) * clamped;
    const oy = Math.sin(angle) * clamped;

    const normMag = clamped / maxStickRadius;
    const deadzone = embedded ? 0.1 : activePrefs.deadzone;
    const sensitivity = embedded ? 0.86 : activePrefs.stickSensitivity;
    const linearMag = normMag < deadzone ? 0 : (normMag - deadzone) / (1 - deadzone);
    const adjMag =
      linearMag === 0 ? 0 : Math.min(1, Math.pow(linearMag, 1.15) * sensitivity);

    inputRef.current.dx = Math.cos(angle) * adjMag;
    inputRef.current.dy = Math.sin(angle) * adjMag;
    setKnobOffset({ x: ox, y: oy });
    sendCurrentInput(true);
  };

  const onStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (repositionMode || settingsOpen) return;
    if (stickPointerId.current !== null && stickPointerId.current !== e.pointerId) return;
    if (!embedded) {
      ensureWakeLock();
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some mobile browsers skip pointer capture; still works via zone events
    }
    stickPointerId.current = e.pointerId;
    const rect = stickZoneRef.current?.getBoundingClientRect();
    if (rect) {
      const baseCx = rect.left + rect.width / 2;
      const baseCy = rect.top + rect.height / 2;
      if (!embedded && controllerPrefsRef.current.floatingStick) {
        const dxScreen = e.clientX - baseCx;
        const dyScreen = e.clientY - baseCy;
        const localDx = isCssRotatedRef.current ? dyScreen : dxScreen;
        const localDy = isCssRotatedRef.current ? -dxScreen : dyScreen;
        const clampedOx = Math.max(-44, Math.min(84, localDx));
        const clampedOy = Math.max(-44, Math.min(44, localDy));
        setFloatingOriginOffset({ x: clampedOx, y: clampedOy });
        const screenDx = isCssRotatedRef.current ? -clampedOy : clampedOx;
        const screenDy = isCssRotatedRef.current ? clampedOx : clampedOy;
        stickCenterRef.current = { x: baseCx + screenDx, y: baseCy + screenDy };
      } else {
        setFloatingOriginOffset({ x: 0, y: 0 });
        stickCenterRef.current = { x: baseCx, y: baseCy };
      }
    } else {
      stickCenterRef.current = { x: e.clientX, y: e.clientY };
    }
    setStickActive(true);
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const onStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (repositionMode || settingsOpen) return;
    if (stickPointerId.current !== e.pointerId) return;
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const releaseStick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    stickPointerId.current = null;
    setStickActive(false);
    setKnobOffset({ x: 0, y: 0 });
    setFloatingOriginOffset({ x: 0, y: 0 });
    inputRef.current.dx = 0;
    inputRef.current.dy = 0;
    sendCurrentInput(true);
  };

  // --- Direct Drag-to-Reposition Calibration Handlers ---
  const startRepositionDrag = (
    target: 'stick' | 'buttons',
    e: React.PointerEvent<HTMLElement>
  ) => {
    if (!repositionMode) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const cur = controllerPrefsRef.current;
    dragTargetRef.current = {
      target,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: target === 'stick' ? cur.stickOffsetX : cur.buttonsOffsetX,
      origY: target === 'stick' ? cur.stickOffsetY : cur.buttonsOffsetY,
    };
  };

  const moveRepositionDrag = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragTargetRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const dxScreen = e.clientX - drag.startX;
    const dyScreen = e.clientY - drag.startY;
    const localDx = isCssRotatedRef.current ? dyScreen : dxScreen;
    const localDy = isCssRotatedRef.current ? -dxScreen : dyScreen;
    const cur = controllerPrefsRef.current;
    if (drag.target === 'stick') {
      updateControllerPrefs({
        ...cur,
        stickOffsetX: drag.origX + localDx,
        stickOffsetY: drag.origY + localDy,
      });
    } else {
      updateControllerPrefs({
        ...cur,
        buttonsOffsetX: drag.origX + localDx,
        buttonsOffsetY: drag.origY + localDy,
      });
    }
  };

  const endRepositionDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (dragTargetRef.current?.pointerId === e.pointerId) {
      dragTargetRef.current = null;
    }
  };

  // --- Multi-touch Action Button Handlers ---
  const onActionDown = (which: 'a' | 'b', e: React.PointerEvent<HTMLElement>) => {
    if (repositionMode || settingsOpen) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    if (which === 'a') {
      btnAPointers.current.add(e.pointerId);
      inputRef.current.a = true;
      setPressedA(true);
    } else {
      btnBPointers.current.add(e.pointerId);
      inputRef.current.b = true;
      setPressedB(true);
    }
    if (!embedded) {
      ensureWakeLock();
    }
    sendCurrentInput(true);
  };

  const onActionUp = (which: 'a' | 'b', e: React.PointerEvent<HTMLElement>) => {
    if (which === 'a') {
      btnAPointers.current.delete(e.pointerId);
      if (btnAPointers.current.size === 0) {
        inputRef.current.a = false;
        setPressedA(false);
      }
    } else {
      btnBPointers.current.delete(e.pointerId);
      if (btnBPointers.current.size === 0) {
        inputRef.current.b = false;
        setPressedB(false);
      }
    }
    sendCurrentInput(true);
  };

  const handleManualReconnect = () => {
    const now = Date.now();
    // Prevent duplicate firing when pointerUp + synthesized click both fire on mobile
    if (now - lastReconnectTapRef.current < 280) return;
    lastReconnectTapRef.current = now;

    setErrorMsg(null);
    setManualReconnecting(true);
    if (manualReconnectTimerRef.current) clearTimeout(manualReconnectTimerRef.current);
    manualReconnectTimerRef.current = setTimeout(() => {
      setManualReconnecting(false);
    }, 1_800);

    if (!embedded) {
      ensureWakeLock();
      fetch('/api/health', { cache: 'no-store' }).catch(() => {});
    }

    const ws = wsRef.current;
    if (!ws) return;

    let savedRoom = '';
    try {
      savedRoom = sessionStorage.getItem(roomCodeSessionKey) || '';
    } catch {
      // Ignore storage error
    }
    const codeNow = (roomRef.current?.code || roomCodeRef.current || savedRoom).trim().toUpperCase();

    if (ws.isConnected() && codeNow.length === 4 && storedPlayerIdRef.current) {
      // Socket is already open — immediately re-attach the player without dropping TCP first!
      ws.send({
        type: 'room:join',
        code: codeNow,
        name: playerNameRef.current.trim() || 'Player',
        playerId: storedPlayerIdRef.current,
        deviceId: getDeviceId(codeNow),
        isTestController: embedded,
        preferredColorId: preferredColorRef.current,
        avatarId: selectedAvatarIdRef.current,
      });
      // If server doesn't confirm re-join within 900ms, force a clean WebSocket reset
      window.setTimeout(() => {
        const selfNow = roomRef.current?.players.find((p) => p.id === joinedPlayerIdRef.current);
        if (!selfNow || !selfNow.connected) {
          wsRef.current?.reconnectNow(true);
        }
      }, 900);
      return;
    }

    ws.reconnectNow(true);
  };

  // Wrapper that renders full-screen & landscape-rotated on connected phones
  const renderConnectedShell = (children: ReactNode) => {
    const selfPlayer = room?.players.find((p) => p.id === joinedPlayerId) ?? null;
    const isConnectionLost = Boolean(
      joinedPlayerId && room && (!wsConnected || (selfPlayer && !selfPlayer.connected))
    );

    const statusOverlays = (
      <>
        {hostToast && !isConnectionLost && (
          <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 z-[65] px-4 py-2 rounded-xl bg-[#FFB800] text-[#14120B] font-display font-extrabold text-xs sm:text-sm shadow-xl inline-flex items-center gap-1.5 whitespace-nowrap">
            <Crown className="w-4 h-4 shrink-0" />
            <span>{hostToast}</span>
          </div>
        )}

        {isConnectionLost && (
          <div
            role="alert"
            aria-live="assertive"
            style={{ touchAction: 'manipulation' }}
            className="pointer-events-auto absolute inset-0 z-[80] bg-[#0B0D12]/92 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              style={{ touchAction: 'manipulation' }}
              className="max-w-sm w-full rounded-2xl bg-[#1A1E26] border-2 border-[#FF4D2E] p-5 text-center shadow-2xl"
            >
              <div className="relative w-12 h-12 rounded-2xl bg-[#FF4D2E]/20 border border-[#FF4D2E]/50 text-[#FF4D2E] flex items-center justify-center mx-auto">
                <WifiOff className="w-6 h-6" aria-hidden="true" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1A1E26] border border-[#FFB800]/70 flex items-center justify-center">
                  <Loader2 className="w-3 h-3 text-[#FFB800] animate-spin" aria-hidden="true" />
                </span>
              </div>
              <h3 className="mt-3 font-display text-xl font-extrabold text-white">
                {t('Controller Disconnected!', '手柄连接已断开！')}
              </h3>
              <p className="mt-1.5 text-xs text-[#D1D5DB] leading-relaxed inline-flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 text-[#FFB800] animate-spin shrink-0" aria-hidden="true" />
                <span>
                  {manualReconnecting
                    ? t(
                        'Establishing fresh link to the game room...',
                        '正在快速建立新连接并恢复您的座位...'
                      )
                    : t(
                        'Signal dropped — your button taps are paused while we reconnect.',
                        '网络信号中断 — 正在自动重连，重连前按键暂不生效。'
                      )}
                </span>
              </p>
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <button
                  type="button"
                  style={{ touchAction: 'manipulation' }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    handleManualReconnect();
                  }}
                  onClick={handleManualReconnect}
                  className="tactile-btn pointer-events-auto w-full sm:w-auto h-11 px-5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] active:scale-95 text-white font-display font-extrabold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {manualReconnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {manualReconnecting
                      ? t('Reconnecting...', '正在重连...')
                      : t('Reconnect Now', '立即重连')}
                  </span>
                </button>
                <button
                  type="button"
                  style={{ touchAction: 'manipulation' }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    handleLeave();
                  }}
                  onClick={handleLeave}
                  className="pointer-events-auto h-11 px-4 rounded-xl bg-[#242A36] hover:bg-[#2E3646] active:scale-95 text-xs font-bold text-[#D1D5DB] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('Leave Room', '退出房间')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
        <ControllerSettingsOverlay
          open={settingsOpen && !embedded}
          prefs={controllerPrefs}
          onChange={updateControllerPrefs}
          onReset={handleResetControllerPrefs}
          onEnterDragMode={
            room && (room.status === 'PLAYING' || room.status === 'COUNTDOWN') && activePadMode === 'analog'
              ? () => {
                  resetControlsState();
                  setSettingsOpen(false);
                  setRepositionMode(true);
                }
              : undefined
          }
          onClose={() => setSettingsOpen(false)}
          accentHex={selfPlayer?.color.hex ?? '#00C2FF'}
          actionALabel={gameMeta?.controllerSchema.actionA.label ?? 'A'}
          actionBLabel={gameMeta?.controllerSchema.actionB.label ?? 'B'}
          actionAHex={gameMeta?.controllerSchema.actionA.colorHex ?? '#FF4D2E'}
          actionBHex={gameMeta?.controllerSchema.actionB.colorHex ?? '#00C2FF'}
          activePadMode={activePadMode}
          recommendedPadMode={recommendedPadMode}
          connectedGamepadName={connectedGamepadName}
        />
        {room && selfPlayer && (() => {
          const outcomeRankEntry = room.rankings.find((r) => r.playerId === selfPlayer.id);
          const outcomeTournament = room.tournament?.active ? room.tournament : null;
          const outcomeStanding =
            outcomeTournament?.standings.find((s) => s.playerId === selfPlayer.id) ?? null;
          const outcomeTeamSpec = room.teamMode !== 'ffa' ? getTeamSpec(selfPlayer.teamId) : null;
          const outcomeTeamStanding =
            room.teamMode !== 'ffa'
              ? (outcomeTournament?.teamStandings ?? room.teamRankings).find(
                  (tr) => tr.teamId === selfPlayer.teamId
                ) ?? null
              : null;
          const effectiveRank =
            room.teamMode !== 'ffa' && outcomeTeamStanding
              ? outcomeTeamStanding.rank
              : outcomeTournament?.completed && outcomeStanding
              ? outcomeStanding.rank
              : outcomeRankEntry?.rank ?? null;
          return (
            <PhoneMatchOutcomeOverlay
              open={outcomeOverlayOpen && room.status === 'RESULTS' && !isConnectionLost}
              isVictory={effectiveRank === 1}
              isTournamentFinal={Boolean(outcomeTournament?.completed)}
              isTeamMode={room.teamMode !== 'ffa' && Boolean(outcomeTeamStanding)}
              rank={
                outcomeTournament?.completed && outcomeStanding
                  ? outcomeStanding.rank
                  : outcomeRankEntry?.rank ?? null
              }
              score={outcomeRankEntry?.score ?? selfPlayer.score}
              playerName={selfPlayer.name}
              playerColorHex={selfPlayer.color.hex}
              playerTextOnColor={selfPlayer.color.textOnColor}
              avatarId={selfPlayer.avatarId}
              highlight={outcomeRankEntry?.highlight}
              teamLabel={
                outcomeTeamSpec && outcomeTeamStanding
                  ? `${outcomeTeamSpec.emoji} ${
                      lang === 'zh' ? outcomeTeamSpec.nameZh : outcomeTeamSpec.name
                    } #${outcomeTeamStanding.rank}`
                  : null
              }
              teamColorHex={outcomeTeamSpec?.colorHex ?? null}
              onDismiss={() => setOutcomeOverlayOpen(false)}
            />
          );
        })()}
      </>
    );

    if (embedded) {
      return (
        <div className="relative gamepad-surface rounded-2xl border border-[#2A303D] bg-[#121419] text-[#F4F6FA] p-3.5 overflow-hidden">
          {children}
          {statusOverlays}
        </div>
      );
    }

    const isCompactPocketCardShell = Boolean(
      room?.roomMode === 'pocket' &&
        CARD_GAME_IDS.has(room.selectedGameId) &&
        (room.status === 'PLAYING' || room.status === 'COUNTDOWN')
    );

    if (isCssRotated) {
      return (
        <div className="fixed inset-0 bg-[#121419] overflow-hidden gamepad-surface z-50">
          <div
            className="fixed top-1/2 left-1/2 flex flex-col justify-between bg-[#121419] text-[#F4F6FA] overflow-hidden"
            style={{
              width: '100dvh',
              height: '100dvw',
              transform: 'translate(-50%, -50%) rotate(90deg)',
              padding: isCompactPocketCardShell
                ? 'max(6px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(6px, env(safe-area-inset-left)) max(12px, env(safe-area-inset-top))'
                : 'max(10px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left)) max(16px, env(safe-area-inset-top))',
            }}
          >
            {children}
            {statusOverlays}
          </div>
        </div>
      );
    }

    return (
      <div
        className="fixed inset-0 w-screen h-[100dvh] flex flex-col justify-between bg-[#121419] text-[#F4F6FA] overflow-hidden gamepad-surface z-50"
        style={{
          padding: isCompactPocketCardShell
            ? 'max(6px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(6px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))'
            : 'max(10px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left))',
        }}
      >
        {children}
        {statusOverlays}
      </div>
    );
  };

  // =====================================================================
  // STATE 1: ROOM CLOSED RECOVERY
  // =====================================================================
  if (closedReason) {
    return (
      <div className="min-h-screen bg-[#121419] text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="font-display text-2xl font-bold">{t('Room Closed', '房间已关闭')}</h2>
        <p className="mt-2 text-sm text-[#9CA3AF] max-w-sm">
          {translateServerMessage(closedReason, lang)}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {!embedded && (
            <button
              type="button"
              onClick={() => {
                setClosedReason(null);
                if (onExit) {
                  onExit();
                } else if (typeof window !== 'undefined') {
                  window.location.assign('/');
                }
              }}
              className="tactile-btn px-6 py-3 rounded-xl bg-[#242A36] hover:bg-[#2E3646] border border-[#343C4D] text-white font-semibold text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              {t('Home', '返回首页')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setClosedReason(null)}
            className="tactile-btn px-6 py-3 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-semibold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            {t('Join Another Room', '加入其他房间')}
          </button>
        </div>
      </div>
    );
  }

  // =====================================================================
  // STATE 2: JOIN ROOM FORM (Not yet joined)
  // =====================================================================
  if (!room || !me || !gameMeta) {
    const isDisconnectedAfterAttempt =
      socketStatus === 'reconnecting' || socketStatus === 'closed';
    return (
      <div
        className={`${
          embedded ? 'p-4' : 'min-h-screen w-full max-w-full overflow-x-clip p-4 sm:p-5 flex flex-col justify-between'
        } bg-[#121419] text-white`}
      >
        {!embedded && (
          <div className="max-w-md w-full mx-auto flex items-center justify-between h-12">
            {onExit ? (
              <button
                type="button"
                onClick={onExit}
                className="min-h-[44px] min-w-[44px] -ml-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#9CA3AF] hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('Back', '返回')}
              </button>
            ) : (
              <span className="font-display font-bold text-lg">{t('JoinStick Arcade', 'JoinStick 街机派对')}</span>
            )}
            <div className="flex items-center gap-2.5">
              <LanguageToggle compact />
              <span className="text-xs font-medium text-[#9CA3AF] flex items-center gap-1.5">
                {wsConnected ? (
                  <span className="w-2 h-2 rounded-full bg-[#10D98B]" />
                ) : (
                  <Loader2
                    className={`w-3.5 h-3.5 animate-spin ${
                      isDisconnectedAfterAttempt ? 'text-[#FFB800]' : 'text-[#00C2FF]'
                    }`}
                    aria-hidden="true"
                  />
                )}
                {wsConnected
                  ? t('Live', '已连接')
                  : isDisconnectedAfterAttempt
                  ? t('Reconnecting', '重连中')
                  : t('Connecting...', '连接中...')}
              </span>
            </div>
          </div>
        )}

        <div className="max-w-md w-full mx-auto my-auto py-4">
          {!embedded && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#1A1E26] border border-[#2A303D] mb-4">
              <button
                type="button"
                onClick={() => {
                  setEntryMode('join');
                  setErrorMsg(null);
                }}
                className={`h-9 rounded-lg text-xs font-extrabold whitespace-nowrap cursor-pointer transition-colors ${
                  entryMode === 'join'
                    ? 'bg-[#00C2FF] text-[#0B1219]'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                {t('Join Room', '输入房间码加入')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryMode('pocket');
                  setErrorMsg(null);
                }}
                className={`h-9 rounded-lg text-xs font-extrabold whitespace-nowrap cursor-pointer transition-colors inline-flex items-center justify-center gap-1.5 ${
                  entryMode === 'pocket'
                    ? 'bg-[#FF4D2E] text-white'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>
                  {publicAccessOpen
                    ? t('Pocket Mode', '无大屏掌机建房')
                    : t('Pocket Mode (PIN)', '无大屏掌机建房')}
                </span>
              </button>
            </div>
          )}

          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            {entryMode === 'pocket'
              ? t('Pocket Party Room', '无大屏掌机联机房')
              : t('Connect Your Controller', '连接手机手柄')}
          </h1>
          <p className="mt-1.5 text-sm text-[#9CA3AF]">
            {entryMode === 'pocket'
              ? t(
                  'No TV or laptop monitor required. Play together directly on your phones with integrated Mobile HUD controls.',
                  '无需电视或电脑大屏！直接用手机开房，游戏画面与触控按键合二为一，随时随地开玩。'
                )
              : t(
                  'Enter the 4-letter code on the game monitor. Your controller switches to full-screen landscape as soon as you join.',
                  '输入大屏上的 4 位房间码，加入后手机将自动切换为全屏横屏手柄。'
                )}
          </p>

          <form onSubmit={handleJoinSubmit} className="mt-6 space-y-5">
            {entryMode === 'join' ? (
              <div>
                <label
                  htmlFor={`room-code-${sessionKey}`}
                  className="block text-xs font-semibold text-[#A5AEBD] mb-2"
                >
                  {t('Room Code', '房间码')}
                </label>
                <input
                  id={`room-code-${sessionKey}`}
                  type="text"
                  maxLength={4}
                  autoComplete="off"
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                  }
                  placeholder="ABCD"
                  className="w-full h-14 px-4 rounded-xl bg-[#1A1E26] border border-[#2F3747] focus:border-[#00C2FF] focus:outline-none font-mono text-2xl font-bold tracking-[0.35em] text-center text-white uppercase"
                />
              </div>
            ) : pocketPinUnlocked ? (
              <div className="p-3.5 rounded-xl bg-[#10D98B]/10 border border-[#10D98B]/35 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {hostSession?.token ? (
                    <ShieldCheck className="w-4 h-4 text-[#10D98B] shrink-0" />
                  ) : (
                    <Unlock className="w-4 h-4 text-[#10D98B] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {!hostSession?.token
                        ? t('Platform Open Access Active', '平台已全员免密开放')
                        : hostSession.role === 'guest'
                        ? t(
                            `Guest Pass Active${hostSession.passLabel ? ` (${hostSession.passLabel})` : ''}`,
                            `访客口令已验证${hostSession.passLabel ? `（${hostSession.passLabel}）` : ''}`
                          )
                        : t('Owner Access Unlocked', '房主权限已验证')}
                    </div>
                    <div className="text-[11px] text-[#9CA3AF]">
                      {!hostSession?.token
                        ? t(
                            'No invitation code required — ready to create a Pocket Party Room',
                            '无需邀请码，可直接创建无大屏掌机房'
                          )
                        : hostSession.singleUse
                        ? t('Valid for 1 room creation', '可创建 1 次掌机房间')
                        : t('Ready to create Pocket Party Room', '可直接创建无大屏掌机房')}
                    </div>
                  </div>
                </div>
                {hostSession?.token && (
                  <button
                    type="button"
                    onClick={() => {
                      clearHostAuthSession();
                      setPocketPinInput('');
                      setPocketPinError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#1A1E26] hover:bg-[#242A36] border border-[#2F3747] text-[11px] font-bold text-[#9CA3AF] hover:text-white shrink-0 cursor-pointer"
                  >
                    {t('Lock', '锁定')}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <label
                  htmlFor={`pocket-pin-${sessionKey}`}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#A5AEBD] mb-2"
                >
                  <Lock className="w-3.5 h-3.5 text-[#FF4D2E]" />
                  <span>{t('Master PIN or Friend Guest Pass', '房主管理密码或访客临时口令')}</span>
                </label>
                <input
                  id={`pocket-pin-${sessionKey}`}
                  type="text"
                  maxLength={24}
                  autoComplete="off"
                  value={pocketPinInput}
                  onChange={(e) => {
                    setPocketPinInput(e.target.value);
                    setPocketPinError(null);
                  }}
                  placeholder={t('PIN or GP-XXXX-XXXX', '输入管理密码或访客口令')}
                  className="w-full h-13 px-4 rounded-xl bg-[#1A1E26] border border-[#2F3747] focus:border-[#FF4D2E] focus:outline-none font-mono text-lg font-bold tracking-[0.16em] text-center text-white placeholder:text-xs placeholder:tracking-normal placeholder:font-sans uppercase"
                />
                <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                  {t(
                    'Ask the host for a single-use or timed Guest Pass (GP-XXXX-XXXX) so the Master PIN stays private.',
                    '朋友借用时请使用房主生成的一次性或限时访客口令（GP-XXXX-XXXX），无需知晓主密码。'
                  )}
                </p>
                {pocketPinError && (
                  <p className="mt-1.5 text-xs font-semibold text-[#FF4D2E] text-center">
                    {pocketPinError}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor={`player-name-${sessionKey}`}
                className="block text-xs font-semibold text-[#A5AEBD] mb-2"
              >
                {t('Player Name', '玩家昵称')}
              </label>
              <input
                id={`player-name-${sessionKey}`}
                type="text"
                maxLength={14}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={t('Your arcade name', '输入你的昵称')}
                className="w-full h-12 px-4 rounded-xl bg-[#1A1E26] border border-[#2F3747] focus:border-[#00C2FF] focus:outline-none text-base font-medium text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#A5AEBD]">
                  {t('Choose Avatar (Preset Only)', '选择你的头像')}
                </span>
                <span className="text-[11px] font-bold text-[#00C2FF]">
                  {(() => {
                    const preset = getAvatarPreset(selectedAvatarId);
                    return `${preset.emoji} ${lang === 'zh' ? preset.labelZh : preset.label}`;
                  })()}
                </span>
              </div>
              <AvatarPickerGrid
                selectedAvatarId={selectedAvatarId}
                onSelect={handleSelectAvatar}
                compact
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#A5AEBD] mb-2.5">
                {t('Controller Color', '手柄配色')}
              </span>
              <div className="grid grid-cols-8 gap-2">
                {PLAYER_PALETTE.map((c) => {
                  const selected = preferredColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      title={c.name}
                      aria-label={t(`Select color ${c.name}`, `选择颜色 ${c.name}`)}
                      onClick={() => setPreferredColor(c.id)}
                      className={`h-10 rounded-lg transition-transform flex items-center justify-center cursor-pointer ${
                        selected
                          ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#121419]'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    >
                      {selected && <Check className="w-4 h-4" style={{ color: c.textOnColor }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {isDisconnectedAfterAttempt && (
              <div className="p-3 rounded-xl bg-[#FFB800]/15 border border-[#FFB800]/45 flex items-center justify-between gap-3 text-xs text-[#FDE68A]">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Loader2 className="w-4 h-4 text-[#FFB800] animate-spin shrink-0" aria-hidden="true" />
                  <span>
                    {t('Disconnected from server — reconnecting...', '未连接到服务器 — 正在尝试重连...')}
                  </span>
                </span>
                <button
                  type="button"
                  style={{ touchAction: 'manipulation' }}
                  onPointerUp={handleManualReconnect}
                  onClick={handleManualReconnect}
                  className="px-2.5 py-1 rounded-lg bg-[#FFB800] text-[#14120B] font-bold shrink-0 cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
                >
                  {manualReconnecting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
                  )}
                  <span>{manualReconnecting ? t('Retrying...', '重试中...') : t('Retry', '重试')}</span>
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/40 text-sm text-[#FF9B8A]">
                {translateServerMessage(errorMsg, lang)}
              </div>
            )}

            <button
              type="submit"
              disabled={!wsConnected || joiningRoom || pocketPinSubmitting}
              className="tactile-btn w-full h-13 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] disabled:opacity-50 text-white font-bold text-base shadow-[0_4px_0_#B82E17] inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {(!wsConnected || joiningRoom || pocketPinSubmitting) && (
                <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden="true" />
              )}
              <span>
                {!wsConnected
                  ? isDisconnectedAfterAttempt
                    ? t('Reconnecting to Server...', '正在重新连接服务器...')
                    : t('Connecting to Server...', '正在连接服务器...')
                  : pocketPinSubmitting
                  ? t('Verifying Access...', '正在验证口令...')
                  : joiningRoom
                  ? entryMode === 'pocket'
                    ? t('Creating Pocket Room...', '正在创建掌机房间...')
                    : t('Joining Room...', '正在加入房间...')
                  : entryMode === 'pocket'
                  ? t('Create Pocket Room', '创建掌机房间并进入')
                  : t('Join Room & Open Gamepad', '加入房间并打开手柄')}
              </span>
            </button>
          </form>
        </div>

        {!embedded && (
          <div className="max-w-md w-full mx-auto text-center text-xs text-[#6B7280] py-2">
            {entryMode === 'pocket'
              ? t(
                  'Share your 4-letter code or QR code in the Pocket Lobby so friends can play alongside you.',
                  '建房后可将 4 位房间码或二维码分享给身边的朋友，直接手机同屏开黑。'
                )
              : t(
                  'Full-screen landscape gamepad activates automatically once connected.',
                  '连接后自动切换为全屏横屏手柄。'
                )}
          </div>
        )}
      </div>
    );
  }

  const isPocketRoom = room.roomMode === 'pocket';

  const isRoomHost = room.hostPlayerId === me.id;
  const connectedHumans = room.players.filter((p) => !p.isBot && p.connected);
  const otherHumans = room.players.filter((p) => !p.isBot && p.id !== me.id);
  const otherPlayers = room.players.filter((p) => p.id !== me.id);
  const otherConnectedHumans = connectedHumans.filter((p) => p.id !== me.id);
  const readyHumans = connectedHumans.filter((p) => p.ready);
  const unreadyHumans = connectedHumans.filter((p) => !p.ready);
  const botCount = room.players.filter((p) => p.isBot).length;
  const hostPlayer = room.players.find((p) => p.id === room.hostPlayerId);

  const sendRemote = (action: RemoteDirection) => {
    if (!isRoomHost) return;
    setErrorMsg(null);
    wsRef.current?.send({ type: 'remote:action', action });
  };

  const handlePassHost = (targetPlayerId: string) => {
    if (!isRoomHost) return;
    wsRef.current?.send({ type: 'room:set-host-player', playerId: targetPlayerId });
    setPassHostOpen(false);
  };

  const handleKickPlayer = (targetPlayerId: string) => {
    if (!isRoomHost) return;
    wsRef.current?.send({ type: 'room:kick-player', playerId: targetPlayerId });
  };

  const handleConfirmCloseRoom = () => {
    if (!isRoomHost) return;
    setCloseRoomConfirmOpen(false);
    wsRef.current?.send({ type: 'room:close' });
  };

  const activeMutatorSpec = getMutatorSpec(room.activeMutator);
  const activeTournament = room.tournament?.active ? room.tournament : null;

  const describeRemoteTarget = (): { kicker: string; title: string } => {
    const focus = room.remoteFocus;
    if (focus.zone === 'filter') {
      const opt = PLAYER_FILTER_OPTIONS[focus.index] ?? PLAYER_FILTER_OPTIONS[0];
      return {
        kicker: t('Filter Tab · Press OK to Apply', '筛选标签 · 按 OK 切换'),
        title: getLocalizedFilterLabel(opt.id, lang, false),
      };
    }
    if (focus.zone === 'games') {
      const list = filterGamesByPlayerMode(room.lobbyFilter);
      const rawGame = list[focus.index];
      const focusedGame = rawGame ? getLocalizedGameMeta(rawGame, lang) : gameMeta;
      return {
        kicker: t(
          `Game ${focus.index + 1}/${list.length} · Press OK to Open`,
          `游戏 ${focus.index + 1}/${list.length} · 按 OK 进入`
        ),
        title: focusedGame.name,
      };
    }
    const diffLabel = getLocalizedDifficulty(room.botDifficulty, lang).label;
    const mutatorLabel =
      room.activeMutator === 'normal'
        ? t('Spin Chaos Wheel', '转动混沌轮盘')
        : `${t('Chaos Wheel:', '混沌轮盘:')} ${lang === 'zh' ? activeMutatorSpec.shortTagZh : activeMutatorSpec.shortTag}`;
    const actionLabels = [
      t(`Open ${gameMeta.name}`, `进入 ${gameMeta.name}`),
      t('Start 5-Game Tournament', '开启 5 局锦标赛'),
      mutatorLabel,
      t(`Change ${gameMeta.settingLabel}`, `切换 ${gameMeta.settingLabel}`),
      t('+ Add Robot', '+ 添加机器人'),
      t(`Bot Level: ${diffLabel}`, `机器人难度：${diffLabel}`),
      t('Room Setup / QR', '房间设置 / 扫码'),
    ];
    return {
      kicker: t('Bottom Action · Press OK', '底部功能 · 按 OK 执行'),
      title: actionLabels[focus.index] ?? actionLabels[0],
    };
  };

  const passHostOverlay = passHostOpen && isRoomHost && (
    <div className="absolute inset-0 z-50 bg-[#121419]/95 backdrop-blur-sm p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-[#FFB800]" />
          <span className="font-display text-lg font-extrabold text-white">
            {t('Kick Players / Pass Host', '踢出玩家 / 移交房主')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPassHostOpen(false)}
          aria-label={t('Close player manager', '关闭玩家管理弹窗')}
          className="h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto arcade-scrollbar my-3 pr-1">
        {otherPlayers.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-sm text-[#9CA3AF]">
            {t('No other players are in the room right now.', '目前房间里没有其他玩家。')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {otherPlayers.map((p) => (
              <div
                key={p.id}
                className="min-h-[54px] px-3.5 py-2.5 rounded-xl bg-[#1A1E26] border border-[#2A303D] flex items-center justify-between gap-2.5 text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar avatarId={p.avatarId} colorHex={p.color.hex} size="sm" />
                  <div className="min-w-0">
                    <div className="font-display font-bold text-sm text-white truncate">
                      {p.name}
                    </div>
                    <div className="text-[10px] font-semibold text-[#9CA3AF]">
                      P{p.slotIndex + 1} ·{' '}
                      {p.isBot ? (
                        <span className="text-[#00C2FF]">{t('AI Robot', 'AI 机器人')}</span>
                      ) : p.connected ? (
                        <span className="text-[#10D98B]">
                          {p.ready ? t('Online · Ready', '在线 · 已准备') : t('Online · Not Ready', '在线 · 未准备')}
                        </span>
                      ) : (
                        <span className="text-[#FF4D2E]">{t('Offline', '离线')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!p.isBot && p.connected && (
                    <button
                      type="button"
                      onClick={() => handlePassHost(p.id)}
                      className="tactile-btn px-2.5 py-1.5 rounded-lg bg-[#FFB800] hover:bg-[#FFC933] text-[#14120B] text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      {t('Host', '设房主')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleKickPlayer(p.id)}
                    title={t(`Kick ${p.name}`, `踢出 ${p.name}`)}
                    className="tactile-btn px-2.5 py-1.5 rounded-lg bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t('Kick', '踢出')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPassHostOpen(false)}
        className="h-10 w-full rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-white cursor-pointer shrink-0"
      >
        {t('Done', '完成')}
      </button>
    </div>
  );

  const avatarPickerOverlay = avatarPickerOpen && (
    <div className="absolute inset-0 z-50 bg-[#121419]/96 backdrop-blur-sm p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <PlayerAvatar avatarId={me.avatarId} colorHex={me.color.hex} size="sm" />
          <div>
            <div className="font-display text-base font-extrabold text-white leading-tight">
              {t('Choose Your Avatar', '选择专属头像')}
            </div>
            <div className="text-[11px] text-[#9CA3AF]">
              {t('Pick any preset avatar — updates live on the TV!', '点击预设头像，大屏实时更新！')}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAvatarPickerOpen(false)}
          aria-label={t('Close Avatar Picker', '关闭头像选择')}
          className="h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto arcade-scrollbar my-3 pr-1 flex items-center">
        <div className="w-full">
          <AvatarPickerGrid
            selectedAvatarId={me.avatarId}
            onSelect={(id) => {
              handleSelectAvatar(id);
              setAvatarPickerOpen(false);
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setAvatarPickerOpen(false)}
        className="h-9 w-full rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-white cursor-pointer shrink-0"
      >
        {t('Done', '完成')}
      </button>
    </div>
  );

  const renderTeamSelector = (compact = false) => {
    if (room.teamMode === 'ffa') return null;
    const teams = getTeamsForMode(room.teamMode);
    if (teams.length === 0) return null;
    const modeInfo = TEAM_MODE_OPTIONS.find((m) => m.id === room.teamMode);
    return (
      <div className={compact ? 'mt-2 pt-2 border-t border-[#262C38]' : 'mt-2.5 pt-2.5 border-t border-[#262C38]'}>
        <div className="flex items-center justify-between text-[10px] font-bold text-[#9CA3AF] mb-1.5">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3 text-[#FFB800]" />
            {t('Your Team', '选择队伍')}
          </span>
          {modeInfo && (
            <span className="text-[#FFB800]">
              {modeInfo.icon} {lang === 'zh' ? modeInfo.labelZh : modeInfo.label}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {teams.map((tid) => {
            const spec = getTeamSpec(tid);
            if (!spec) return null;
            const active = me.teamId === tid;
            return (
              <button
                key={tid}
                type="button"
                onClick={() => handleSelectTeam(tid)}
                className={`flex-1 min-w-[70px] h-7 px-2 rounded-lg text-[11px] font-extrabold inline-flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                  active ? 'scale-[1.03]' : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: active ? spec.colorHex : `${spec.colorHex}18`,
                  borderColor: active ? '#FFFFFF' : `${spec.colorHex}88`,
                  color: active ? spec.textColor : spec.colorHex,
                }}
              >
                <span>{spec.emoji}</span>
                <span>{lang === 'zh' ? spec.nameZh : spec.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const closeRoomOverlay = closeRoomConfirmOpen && isRoomHost && (
    <div className="absolute inset-0 z-50 bg-[#121419]/95 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center">
      <div className="max-w-sm w-full rounded-2xl bg-[#1A1E26] border-2 border-[#FF4D2E]/60 p-5 shadow-2xl space-y-3">
        <div className="w-11 h-11 rounded-2xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/40 text-[#FF4D2E] flex items-center justify-center mx-auto">
          <Power className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-display text-lg font-extrabold text-white">
            {t('Close Entire Game Room?', '确定彻底关闭游戏房间？')}
          </h3>
          <p className="mt-1 text-xs text-[#A5AEBD] leading-relaxed">
            {t(
              `This will permanently close Room ${room.code} on the TV and disconnect all players.`,
              `大屏上的房间 ${room.code} 将立即永久关闭，所有玩家都会断开连接。`
            )}
          </p>
        </div>
        <div className="pt-1 flex items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => setCloseRoomConfirmOpen(false)}
            className="h-10 px-4 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-white cursor-pointer flex-1"
          >
            {t('Cancel', '取消')}
          </button>
          <button
            type="button"
            onClick={handleConfirmCloseRoom}
            className="tactile-btn h-10 px-4 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-xs font-extrabold text-white shadow-[0_3px_0_#B82E17] inline-flex items-center justify-center gap-1.5 cursor-pointer flex-1"
          >
            <Power className="w-3.5 h-3.5" />
            <span>{t('Close Room', '关闭房间')}</span>
          </button>
        </div>
      </div>
    </div>
  );

  // =====================================================================
  // STATE 3A / 3B POCKET MODE LOBBY (Phone-only direct game browser + roster)
  // =====================================================================
  if (isPocketRoom && (room.status === 'SETUP' || room.status === 'LOBBY')) {
    return renderConnectedShell(
      <PocketLobbyView
        room={room}
        me={me}
        isRoomHost={isRoomHost}
        isFullscreen={isFullscreen}
        pocketMuted={pocketMuted}
        errorMsg={errorMsg ? translateServerMessage(errorMsg, lang) : null}
        quickEmotes={QUICK_EMOTES}
        avatarPickerOverlay={avatarPickerOverlay}
        passHostOverlay={passHostOverlay}
        closeRoomOverlay={closeRoomOverlay}
        onToggleMute={() => {
          arcadeAudio.unlock();
          setPocketMuted((m) => !m);
        }}
        onToggleFullscreen={toggleFullscreen}
        onOpenAvatarPicker={() => setAvatarPickerOpen(true)}
        onOpenSettings={() => {
          resetControlsState();
          setSettingsOpen(true);
        }}
        onOpenPassHost={() => setPassHostOpen(true)}
        onOpenCloseRoom={() => setCloseRoomConfirmOpen(true)}
        onLeave={handleLeave}
        onToggleReady={() => {
          arcadeAudio.unlock();
          if (!manualExitFsRef.current) {
            triggerRoomFullscreen();
          }
          setErrorMsg(null);
          wsRef.current?.send({ type: 'player:ready', ready: !me.ready });
        }}
        onSelectGame={(gameId, settingValue) => {
          setErrorMsg(null);
          void ensureGameRendererReady(gameId);
          wsRef.current?.send({ type: 'game:select', gameId, settingValue });
        }}
        onChangeFilter={(filter) => {
          wsRef.current?.send({ type: 'lobby:filter', filter });
        }}
        onStartMatch={() => {
          arcadeAudio.unlock();
          triggerRoomFullscreen();
          setErrorMsg(null);
          if (room?.selectedGameId) {
            void ensureGameRendererReady(room.selectedGameId);
          }
          wsRef.current?.send({ type: 'game:start' });
        }}
        onStartTournament={() => {
          arcadeAudio.unlock();
          triggerRoomFullscreen();
          setErrorMsg(null);
          wsRef.current?.send({ type: 'tournament:start' });
        }}
        onAddBot={() => wsRef.current?.send({ type: 'room:add-bot' })}
        onCycleBotDifficulty={(difficulty) =>
          wsRef.current?.send({ type: 'room:set-bot-difficulty', difficulty })
        }
        onCycleTeamMode={(teamMode) => wsRef.current?.send({ type: 'room:set-team-mode', teamMode })}
        onCycleMyTeam={(teamId) => wsRef.current?.send({ type: 'player:set-team', teamId })}
        onShuffleTeams={() => wsRef.current?.send({ type: 'room:shuffle-teams' })}
        onSpinMutator={() => wsRef.current?.send({ type: 'room:spin-mutator' })}
        onSendEmote={handleSendQuickEmote}
      />
    );
  }

  // =====================================================================
  // STATE 3A: ROOM SETUP SCREEN (Waiting for players / bots / host setup)
  // =====================================================================
  if (room.status === 'SETUP') {
    return renderConnectedShell(
      <div className="relative flex flex-col justify-between h-full w-full max-w-3xl mx-auto">
        {avatarPickerOverlay}
        {passHostOverlay}
        {closeRoomOverlay}
        <div className="flex items-center justify-between gap-3 h-11 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setAvatarPickerOpen(true)}
              title={t('Tap to change avatar', '点击更换头像')}
              className="relative shrink-0 cursor-pointer hover:scale-105 transition-transform"
            >
              <PlayerAvatar avatarId={me.avatarId} colorHex={me.color.hex} size="sm" />
            </button>
            <div className="min-w-0 leading-tight">
              <div className="font-bold text-sm truncate flex items-center gap-1.5">
                <span className="truncate">{me.name}</span>
                {isRoomHost && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#FFB800] shrink-0">
                    <Crown className="w-3 h-3" />
                    {t('Host', '房主')}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#9CA3AF] font-mono">
                {t(`Room ${room.code} · Tap avatar to change`, `房间 ${room.code} · 点击头像可更换`)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!embedded && <LanguageToggle compact className="h-9" />}
            {isRoomHost && otherPlayers.length > 0 && (
              <button
                type="button"
                onClick={() => setPassHostOpen(true)}
                className="tactile-btn h-9 px-2.5 rounded-lg bg-[#FFB800] hover:bg-[#FFC933] text-[#14120B] text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>{t('Kick / Host', '踢人 / 房主')}</span>
              </button>
            )}
            {!embedded && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')}
                className="h-9 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? t('Exit Full', '退出全屏') : t('Fullscreen', '全屏')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLeave}
              className="h-9 px-3 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t('Leave', '退出')}
            </button>
            {isRoomHost && (
              <button
                type="button"
                onClick={() => setCloseRoomConfirmOpen(true)}
                aria-label={t('Close Entire Room', '关闭整个房间')}
                title={t('Close Entire Room', '关闭整个房间')}
                className="h-9 w-9 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-[#FF9B8A] hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <Power className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div
          className={`flex-1 grid ${
            embedded ? 'grid-cols-1 gap-3 my-3' : 'grid-cols-2 gap-5 my-3 items-center'
          }`}
        >
          <div className="p-4 rounded-xl bg-[#1A1E26] border border-[#2A303D]">
            <div className="text-xs font-medium text-[#00C2FF]">
              {t('Step 1 · Room Setup', '第 1 步 · 房间集结')}
            </div>
            <div className="font-display text-xl font-bold text-white mt-0.5">
              {t(`Connected to Room ${room.code}`, `已连接到房间 ${room.code}`)}
            </div>
            <p className="text-xs text-[#A5AEBD] mt-1 leading-relaxed">
              {t(
                'Players are joining and bots are being configured on the monitor.',
                '玩家正在陆续加入，大屏端正在配置机器人与房主。'
              )}
            </p>

            <div className="mt-3 pt-2.5 border-t border-[#262C38] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">{t('Roster', '当前成员')}</span>
                <span className="font-semibold text-white inline-flex items-center gap-1.5">
                  {t(
                    `${connectedHumans.length} Human${connectedHumans.length === 1 ? '' : 's'}`,
                    `${connectedHumans.length} 名玩家`
                  )}
                  {botCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[#00C2FF]">
                      · <Bot className="w-3.5 h-3.5" />{' '}
                      {t(`${botCount} Bot${botCount === 1 ? '' : 's'}`, `${botCount} 个机器人`)}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">{t('Room Host', '房主')}</span>
                <span className="font-semibold text-[#FFB800] inline-flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  {hostPlayer ? hostPlayer.name : t('Monitor', '大屏')}
                </span>
              </div>
            </div>

            {renderTeamSelector(false)}
          </div>

          <div className="flex flex-col gap-2.5 justify-center">
            {isRoomHost ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    triggerRoomFullscreen();
                    wsRef.current?.send({ type: 'room:enter-game-room' });
                  }}
                  className="tactile-btn w-full h-16 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-bold text-lg shadow-[0_4px_0_#B82E17] inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{t('Enter Game Room', '进入游戏厅')}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <p className="text-[11px] text-center text-[#9CA3AF]">
                  {t(
                    'You are the Room Host — tap when everyone has joined and bots are set.',
                    '你是房主 — 所有人加入并配好机器人后即可点击进入游戏厅。'
                  )}
                </p>
              </>
            ) : (
              <div className="p-4 rounded-xl bg-[#1A1E26] border border-[#2A303D] text-center">
                <Loader2 className="w-5 h-5 text-[#00C2FF] animate-spin mx-auto mb-2" aria-hidden="true" />
                <div className="text-sm font-bold text-white">{t("You're In!", '加入成功！')}</div>
                <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                  {t('Waiting for', '等待')}{' '}
                  <strong className="text-white">
                    {hostPlayer?.name ?? t('the Host', '房主')}
                  </strong>{' '}
                  {t('to finish setup and open the Game Room.', '完成设置并开启游戏厅。')}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            {QUICK_EMOTES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  wsRef.current?.send({ type: 'player:emote', emoji });
                }}
                className="tactile-btn h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-base flex items-center justify-center cursor-pointer"
                aria-label={t(`Send ${emoji} reaction`, `发送 ${emoji} 表情`)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-[#9CA3AF] truncate">
            {t('Tap emojis to pop reactions on the big screen!', '点击表情在大屏上发送互动弹幕！')}
          </span>
        </div>
      </div>
    );
  }

  // =====================================================================
  // STATE 3B: GAME ROOM — HOST BECOMES TV REMOTE / OTHERS GET READY PAD
  // =====================================================================
  if (room.status === 'LOBBY') {
    const allHumansReady = room.readyGate
      ? room.readyGate.allHumansReady
      : unreadyHumans.length === 0;
    const focusInfo = describeRemoteTarget();

    // --- HOST TV REMOTE CONTROL ---
    if (isRoomHost) {
      return renderConnectedShell(
        <div className="relative flex flex-col justify-between h-full w-full max-w-4xl mx-auto">
          {avatarPickerOverlay}
          {passHostOverlay}
          {closeRoomOverlay}

          {/* Slim Remote Top Bar */}
          <div className="flex items-center justify-between gap-2 h-10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setAvatarPickerOpen(true)}
                title={t('Tap to change avatar', '点击更换头像')}
                className="shrink-0 cursor-pointer hover:scale-105 transition-transform"
              >
                <PlayerAvatar avatarId={me.avatarId} colorHex={me.color.hex} size="xs" />
              </button>
              <div className="min-w-0 leading-tight">
                <div className="font-bold text-xs sm:text-sm truncate flex items-center gap-1.5">
                  <span className="truncate">{me.name}</span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-[#FFB800] shrink-0">
                    <Crown className="w-3 h-3" />
                    {t('TV Remote', '大屏遥控器')}
                  </span>
                </div>
                <div className="text-[10px] text-[#9CA3AF] font-mono">
                  PIN {room.code} · {readyHumans.length}/{connectedHumans.length}{' '}
                  {t('Ready', '已准备')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!embedded && <LanguageToggle compact />}
              {!embedded && (
                <button
                  type="button"
                  onClick={() => {
                    resetControlsState();
                    setSettingsOpen(true);
                  }}
                  aria-label={t('Controller settings', '手柄设置')}
                  title={t('Joystick & Button Calibration', '摇杆与按键位置校准')}
                  className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#00C2FF] flex items-center justify-center cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              )}
              {otherPlayers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPassHostOpen(true)}
                  className="tactile-btn h-8 px-2.5 rounded-lg bg-[#FFB800] hover:bg-[#FFC933] text-[#14120B] text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>{t('Kick / Host', '踢人 / 房主')}</span>
                </button>
              )}
              {!embedded && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')}
                  className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] flex items-center justify-center cursor-pointer"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={handleLeave}
                aria-label={t('Leave room', '退出房间')}
                className="h-8 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('Leave', '退出')}</span>
              </button>
              <button
                type="button"
                onClick={() => setCloseRoomConfirmOpen(true)}
                aria-label={t('Close Entire Room', '关闭整个房间')}
                title={t('Close Entire Room', '关闭整个房间')}
                className="h-8 w-8 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-[#FF9B8A] hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Main 2-Column Host Remote Deck: Left = Tactile Cross D-Pad + OK, Right = TV Target + Ready + Pass Host */}
          <div
            className={`flex-1 grid ${
              embedded ? 'grid-cols-1 gap-3 my-2' : 'grid-cols-2 gap-5 my-2 items-center'
            } min-h-0`}
          >
            {/* LEFT HALF: Living-Room TV Remote D-Pad + Center OK */}
            <div className="flex flex-col items-center justify-center">
              <div
                className={`grid grid-cols-3 grid-rows-3 gap-2 p-2.5 rounded-[2rem] bg-[#151820] border-2 border-[#2A303D] shadow-[inset_0_4px_14px_rgba(0,0,0,0.55)] ${
                  embedded ? 'w-44 h-44' : 'w-52 h-52 sm:w-56 sm:h-56'
                }`}
              >
                <div />
                <button
                  type="button"
                  onClick={() => sendRemote('up')}
                  aria-label={t('Remote Up', '遥控器上')}
                  className="tactile-btn rounded-2xl bg-[#242A36] hover:bg-[#2E3646] active:bg-[#FFB800] active:text-[#14120B] text-white flex items-center justify-center shadow-[0_3px_0_#101217] cursor-pointer"
                >
                  <ChevronUp className="w-7 h-7 stroke-[2.8]" />
                </button>
                <div />

                <button
                  type="button"
                  onClick={() => sendRemote('left')}
                  aria-label={t('Remote Left', '遥控器左')}
                  className="tactile-btn rounded-2xl bg-[#242A36] hover:bg-[#2E3646] active:bg-[#FFB800] active:text-[#14120B] text-white flex items-center justify-center shadow-[0_3px_0_#101217] cursor-pointer"
                >
                  <ChevronLeft className="w-7 h-7 stroke-[2.8]" />
                </button>

                <button
                  type="button"
                  onClick={() => sendRemote('ok')}
                  aria-label={t('Remote OK', '遥控器确认')}
                  className="tactile-btn rounded-full bg-[#FF4D2E] hover:bg-[#FF6145] active:bg-[#FFB800] text-white font-display font-black text-base tracking-wide flex items-center justify-center shadow-[0_4px_0_#B82E17] cursor-pointer"
                >
                  OK
                </button>

                <button
                  type="button"
                  onClick={() => sendRemote('right')}
                  aria-label={t('Remote Right', '遥控器右')}
                  className="tactile-btn rounded-2xl bg-[#242A36] hover:bg-[#2E3646] active:bg-[#FFB800] active:text-[#14120B] text-white flex items-center justify-center shadow-[0_3px_0_#101217] cursor-pointer"
                >
                  <ChevronRight className="w-7 h-7 stroke-[2.8]" />
                </button>

                <div />
                <button
                  type="button"
                  onClick={() => sendRemote('down')}
                  aria-label={t('Remote Down', '遥控器下')}
                  className="tactile-btn rounded-2xl bg-[#242A36] hover:bg-[#2E3646] active:bg-[#FFB800] active:text-[#14120B] text-white flex items-center justify-center shadow-[0_3px_0_#101217] cursor-pointer"
                >
                  <ChevronDown className="w-7 h-7 stroke-[2.8]" />
                </button>
                <div />
              </div>
              <span className="mt-1.5 text-[11px] font-semibold text-[#9CA3AF]">
                {t('Control the big TV screen · Press OK to select', '方向键控制大屏 · 按 OK 确认')}
              </span>
            </div>

            {/* RIGHT HALF: Live TV Target Readout + Host Ready Button + Pass Host */}
            <div className="flex flex-col gap-2.5 justify-center min-w-0">
              <div className="p-3.5 rounded-xl bg-[#1A1E26] border border-[#2A303D]">
                <div className="text-[11px] font-bold text-[#FFB800] truncate">
                  {focusInfo.kicker}
                </div>
                <div className="font-display text-lg font-extrabold text-white truncate mt-0.5">
                  {focusInfo.title}
                </div>
                <div className="mt-2 pt-2 border-t border-[#262C38] flex items-center justify-between text-xs gap-2">
                  <span className="text-[#9CA3AF]">{t('Ready Check', '准备进度')}</span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      allHumansReady ? 'text-[#10D98B]' : 'text-[#FFB800]'
                    }`}
                  >
                    {readyHumans.length}/{connectedHumans.length} {t('Ready', '已准备')}
                    {botCount > 0
                      ? t(` (+${botCount} Bot${botCount === 1 ? '' : 's'})`, ` (+${botCount} 机器人)`)
                      : ''}
                  </span>
                </div>
                {room.activeMutator !== 'normal' && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-[#9CA3AF] inline-flex items-center gap-1">
                      <Dices className="w-3 h-3" style={{ color: activeMutatorSpec.accentHex }} />
                      {t('Active Rule', '当前规则')}
                    </span>
                    <span className="font-bold" style={{ color: activeMutatorSpec.accentHex }}>
                      {lang === 'zh' ? activeMutatorSpec.nameZh : activeMutatorSpec.name}
                    </span>
                  </div>
                )}
                {renderTeamSelector(true)}
              </div>

              {/* Host's own Ready Toggle */}
              <button
                type="button"
                onClick={() => {
                  enterFullscreenAndLandscape();
                  setErrorMsg(null);
                  wsRef.current?.send({ type: 'player:ready', ready: !me.ready });
                }}
                className="relative tactile-btn w-full h-13 rounded-xl font-display font-extrabold text-base cursor-pointer transition-colors flex items-center justify-center gap-2 select-none"
                style={
                  me.ready
                    ? {
                        backgroundColor: '#10D98B',
                        color: '#0A1913',
                        boxShadow: '0 4px 0 #0A915D',
                      }
                    : {
                        backgroundColor: me.color.hex,
                        color: me.color.textOnColor,
                        boxShadow: `0 4px 0 ${me.color.dark}`,
                      }
                }
              >
                {me.ready && <Check className="w-5 h-5" />}
                <span>
                  {me.ready
                    ? allHumansReady
                      ? t('All Ready! Press OK to Open', '全员已准备！按 OK 开始')
                      : t('You Are Ready!', '你已准备就绪！')
                    : t('Tap to Ready Up', '点击准备')}
                </span>
              </button>

              {errorMsg && (
                <p className="text-[11px] text-center text-[#FF9B8A] font-medium leading-snug">
                  {translateServerMessage(errorMsg, lang)}
                </p>
              )}
            </div>
          </div>

          {/* Bottom Emoji Reaction Strip */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              {QUICK_EMOTES.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    wsRef.current?.send({ type: 'player:emote', emoji });
                  }}
                  className="tactile-btn h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-sm flex items-center justify-center cursor-pointer"
                  aria-label={t(`Send ${emoji} reaction`, `发送 ${emoji} 表情`)}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[#9CA3AF] truncate">
              {t('Only your Host Remote controls the TV screen', '当前仅你的房主遥控器可操作大屏')}
            </span>
          </div>
        </div>
      );
    }

    // --- NON-HOST PLAYER READY CONTROLLER ---
    return renderConnectedShell(
      <div className="relative flex flex-col justify-between h-full w-full max-w-3xl mx-auto">
        {avatarPickerOverlay}
        <div className="flex items-center justify-between gap-3 h-11 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setAvatarPickerOpen(true)}
              title={t('Tap to change avatar', '点击更换头像')}
              className="shrink-0 cursor-pointer hover:scale-105 transition-transform"
            >
              <PlayerAvatar avatarId={me.avatarId} colorHex={me.color.hex} size="sm" />
            </button>
            <div className="min-w-0 leading-tight">
              <div className="font-bold text-sm truncate">{me.name}</div>
              <div className="text-[11px] text-[#9CA3AF] font-mono">
                {t(`Room ${room.code}`, `房间 ${room.code}`)} · {readyHumans.length}/
                {connectedHumans.length} {t('Ready', '已准备')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!embedded && (
              <button
                type="button"
                onClick={async () => {
                  const res = await shareRoomInvite({
                    roomCode: room.code,
                    lang,
                    gameName: gameMeta.name,
                  });
                  if (res === 'shared' || res === 'copied') {
                    setInviteFeedback(res);
                    setTimeout(() => setInviteFeedback(null), 1800);
                  }
                }}
                title={t('1-tap share room invite link', '一键分享房间邀请链接')}
                className={`h-9 px-2.5 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                  inviteFeedback
                    ? 'bg-[#10D98B] text-[#0A1913]'
                    : 'bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219]'
                }`}
              >
                {inviteFeedback ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>
                  {inviteFeedback === 'shared'
                    ? t('Shared!', '已分享!')
                    : inviteFeedback === 'copied'
                    ? t('Copied!', '已复制!')
                    : t('Share', '邀请')}
                </span>
              </button>
            )}
            {!embedded && <LanguageToggle compact className="h-9" />}
            {!embedded && (
              <button
                type="button"
                onClick={() => {
                  resetControlsState();
                  setSettingsOpen(true);
                }}
                aria-label={t('Controller settings', '手柄设置')}
                title={t('Joystick & Button Calibration', '摇杆与按键位置校准')}
                className="h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#00C2FF] flex items-center justify-center cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            )}
            {!embedded && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')}
                className="h-9 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? t('Exit Full', '退出全屏') : t('Fullscreen', '全屏')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLeave}
              className="h-9 px-3 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t('Leave', '退出')}
            </button>
          </div>
        </div>

        <div
          className={`flex-1 grid ${
            embedded ? 'grid-cols-1 gap-3 my-3' : 'grid-cols-2 gap-5 my-3 items-center'
          }`}
        >
          <div className="p-4 rounded-xl bg-[#1A1E26] border border-[#2A303D]">
            <div className="text-xs font-semibold text-[#FFB800] inline-flex items-center gap-1">
              <Crown className="w-3.5 h-3.5" />
              <span>
                {t(
                  `${hostPlayer?.name ?? 'Host'} is picking a game`,
                  `${hostPlayer?.name ?? '房主'} 正在挑选游戏`
                )}
              </span>
            </div>
            <div className="font-display text-xl font-bold text-white mt-1">{gameMeta.name}</div>
            <p className="text-xs text-[#A5AEBD] mt-1 leading-relaxed">
              {gameMeta.controllerSchema.controlTip}
            </p>

            <div className="mt-3 pt-2.5 border-t border-[#262C38] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">{t('Buttons', '按键')}</span>
                <span className="font-semibold text-white">
                  {gameMeta.controllerSchema.actionA.label} / {gameMeta.controllerSchema.actionB.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">{t('Ready Check', '准备进度')}</span>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    allHumansReady ? 'text-[#10D98B]' : 'text-[#FFB800]'
                  }`}
                >
                  {readyHumans.length}/{connectedHumans.length} {t('Ready', '已准备')}
                  {botCount > 0
                    ? t(` (+${botCount} Bot${botCount === 1 ? '' : 's'})`, ` (+${botCount} 机器人)`)
                    : ''}
                </span>
              </div>
              {room.activeMutator !== 'normal' && (
                <div className="flex items-center justify-between">
                  <span className="text-[#9CA3AF] inline-flex items-center gap-1">
                    <Dices className="w-3 h-3" style={{ color: activeMutatorSpec.accentHex }} />
                    {t('Chaos Rule', '混沌规则')}
                  </span>
                  <span className="font-bold" style={{ color: activeMutatorSpec.accentHex }}>
                    {lang === 'zh' ? activeMutatorSpec.shortTagZh : activeMutatorSpec.shortTag}
                  </span>
                </div>
              )}
            </div>
            {renderTeamSelector(true)}
          </div>

          <div className="flex flex-col gap-2.5 justify-center">
            <button
              type="button"
              onClick={() => {
                triggerRoomFullscreen();
                setErrorMsg(null);
                wsRef.current?.send({ type: 'player:ready', ready: !me.ready });
              }}
              className="relative tactile-btn w-full h-16 rounded-xl font-display font-bold text-lg cursor-pointer transition-colors flex items-center justify-center gap-2 select-none"
              style={
                me.ready
                  ? {
                      backgroundColor: '#10D98B',
                      color: '#0A1913',
                      boxShadow: '0 4px 0 #0A915D',
                    }
                  : {
                      backgroundColor: me.color.hex,
                      color: me.color.textOnColor,
                      boxShadow: `0 4px 0 ${me.color.dark}`,
                    }
              }
            >
              {me.ready && <Check className="w-5 h-5" />}
              <span>
                {me.ready
                  ? allHumansReady
                    ? t('Ready! Waiting for Host', '已准备！等待房主开启')
                    : t('Ready! Waiting for Others', '已准备！等待其他玩家')
                  : t('Tap to Ready Up', '点击准备')}
              </span>
            </button>

            {errorMsg && (
              <p className="text-[11px] text-center text-[#FF9B8A] leading-snug">
                {translateServerMessage(errorMsg, lang)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            {QUICK_EMOTES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  wsRef.current?.send({ type: 'player:emote', emoji });
                }}
                className="tactile-btn h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-base flex items-center justify-center cursor-pointer"
                aria-label={t(`Send ${emoji} reaction`, `发送 ${emoji} 表情`)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-[#9CA3AF] truncate">
            {keyboardProfile === 'wasd'
              ? t('WASD · Space (A) · Shift (B)', 'WASD 移动 · 空格 (A) · Shift (B)')
              : keyboardProfile === 'arrows'
              ? t('Arrows · Enter (A) · Shift (B)', '方向键 · 回车 (A) · Shift (B)')
              : t('Everyone must press Ready to start!', '需要全员点击准备后才能开始！')}
          </span>
        </div>
      </div>
    );
  }

  // =====================================================================
  // STATE 3C: 5-GAME CUP GROUP GAME VOTING PAD (Every Match Selection!)
  // =====================================================================
  if (room.status === 'VOTING' && room.tournament?.vote) {
    const vote = room.tournament.vote;
    const isLocked = vote.phase === 'locked';
    const myVotedGameId = vote.votes[me.id] ?? null;
    const totalVotes = Object.keys(vote.votes).length;
    const optionLetters = ['A', 'B', 'C'];

    return renderConnectedShell(
      <div className="relative flex flex-col justify-between h-full w-full max-w-4xl mx-auto gap-2">
        {closeRoomOverlay}

        {/* Voting Header */}
        <div className="flex items-center justify-between gap-2 h-10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <PlayerAvatar avatarId={me.avatarId} colorHex={me.color.hex} size="xs" />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFB800]/20 border border-[#FFB800]/55 text-[#FFB800] font-mono text-[11px] font-black shrink-0">
              <Trophy className="w-3 h-3" />
              <span>
                {t(
                  `Cup ${vote.roundIndex + 1}/${room.tournament.totalGames}`,
                  `锦标赛 ${vote.roundIndex + 1}/${room.tournament.totalGames}`
                )}
              </span>
            </span>
            <span className="font-display font-extrabold text-sm text-white truncate">
              {isLocked
                ? t('Winner Locked!', '投票已锁定！')
                : t('Vote Next Game!', '投票选择本局游戏！')}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`h-8 px-2.5 rounded-lg border font-mono text-xs font-black inline-flex items-center gap-1 tabular-nums ${
                isLocked
                  ? 'bg-[#10D98B]/20 border-[#10D98B] text-[#10D98B]'
                  : vote.secondsLeft <= 5
                  ? 'bg-[#FF4D2E]/20 border-[#FF4D2E] text-[#FF9B8A] animate-pulse'
                  : 'bg-[#1A1E26] border-[#2A303D] text-[#FFB800]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isLocked ? t('GO!', '出发!') : `${vote.secondsLeft}s`}</span>
            </span>
            {isRoomHost && !isLocked && (
              <button
                type="button"
                onClick={() => wsRef.current?.send({ type: 'tournament:force-lock-vote' })}
                className="tactile-btn h-8 px-2.5 rounded-lg bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-[11px] font-extrabold cursor-pointer"
              >
                {t('Lock Now', '立即锁定')}
              </button>
            )}
          </div>
        </div>

        {/* 3 Side-by-Side Candidate Game Vote Cards */}
        <div className="flex-1 min-h-0 grid grid-cols-3 gap-2.5 items-stretch">
          {vote.candidates.map((gameId, idx) => {
            const gMeta = getLocalizedGameMeta(getGameMeta(gameId), lang);
            const voteCount = Object.values(vote.votes).filter((v) => v === gameId).length;
            const isMyVote = myVotedGameId === gameId;
            const isWinner = isLocked && vote.winningGameId === gameId;
            const isDimmed = isLocked && !isWinner;

            return (
              <button
                key={gameId}
                type="button"
                disabled={isLocked}
                onClick={() => handleCastCupVote(gameId)}
                className={`tactile-btn relative rounded-2xl p-3 border-2 text-left flex flex-col justify-between gap-2 transition-all overflow-hidden ${
                  isWinner
                    ? 'bg-[#112B22] border-[#10D98B] shadow-[0_0_24px_rgba(16,217,139,0.35)] scale-[1.02]'
                    : isMyVote
                    ? 'bg-[#221D11] border-[#FFB800] shadow-[0_0_18px_rgba(255,184,0,0.28)]'
                    : isDimmed
                    ? 'bg-[#151820] border-[#242934] opacity-40'
                    : 'bg-[#1A1E26] border-[#2C3344] hover:border-[#00C2FF] cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`h-6 px-2 rounded-md font-mono text-[11px] font-black inline-flex items-center justify-center ${
                      isWinner
                        ? 'bg-[#10D98B] text-[#0A1913]'
                        : isMyVote
                        ? 'bg-[#FFB800] text-[#14120B]'
                        : 'bg-[#242A36] text-[#D1D5DB]'
                    }`}
                  >
                    {optionLetters[idx] ?? idx + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#101217] border border-[#2A303D] font-mono text-[11px] font-black text-white tabular-nums inline-flex items-center gap-1">
                    <Vote className="w-3 h-3 text-[#00C2FF]" />
                    {voteCount}
                  </span>
                </div>

                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#00C2FF] truncate">
                    {gMeta.category}
                  </div>
                  <div className="font-display text-sm sm:text-base font-extrabold text-white leading-tight line-clamp-2 mt-0.5">
                    {gMeta.name}
                  </div>
                  <p className="text-[11px] text-[#A5AEBD] mt-1 line-clamp-2 leading-snug">
                    {gMeta.tagline}
                  </p>
                </div>

                <div
                  className={`h-8 rounded-xl font-display font-extrabold text-xs flex items-center justify-center gap-1 ${
                    isWinner
                      ? 'bg-[#10D98B] text-[#0A1913]'
                      : isMyVote
                      ? 'bg-[#FFB800] text-[#14120B]'
                      : 'bg-[#242A36] text-white'
                  }`}
                >
                  {(isMyVote || isWinner) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  <span>
                    {isWinner
                      ? t('WINNER!', '本局胜出！')
                      : isMyVote
                      ? t('VOTED', '已投票')
                      : t('Tap to Vote', '点击投票')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Voting Hint */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-[#9CA3AF] shrink-0">
          <span>
            {isPocketRoom
              ? t(
                  'Vote for the next Pocket Cup game — match launches once votes lock!',
                  '投票选出下一局掌机锦标赛游戏 — 锁定后即刻开战！'
                )
              : t(
                  'Watch all three 5-second live previews on the TV!',
                  '观看大屏上 3 个游戏的 5 秒实机视频，投出你的一票！'
                )}
          </span>
          <span className="font-mono font-bold text-[#00C2FF] shrink-0 tabular-nums">
            {totalVotes}/{room.players.length} {t('Voted', '已投')}
          </span>
        </div>
      </div>
    );
  }

  // =====================================================================
  // STATE 4: RESULTS SUMMARY ON PHONE (With Host Remote & Tournament Marks!)
  // =====================================================================
  if (room.status === 'RESULTS') {
    const myRank = room.rankings.find((r) => r.playerId === me.id);
    const myStanding = activeTournament?.standings.find((s) => s.playerId === me.id) ?? null;
    const myTeamSpec = room.teamMode !== 'ffa' ? getTeamSpec(me.teamId) : null;
    const myTeamStanding =
      room.teamMode !== 'ffa'
        ? (activeTournament?.teamStandings ?? room.teamRankings).find((tr) => tr.teamId === me.teamId) ??
          null
        : null;

    const resultsOptionLabel = activeTournament
      ? room.remoteFocus.modalIndex === 0
        ? activeTournament.completed
          ? t('New 5-Game Cup', '再来一届锦标赛')
          : t(
              `Vote Next (${activeTournament.currentGameIndex + 2}/${activeTournament.totalGames})`,
              `投票第 ${activeTournament.currentGameIndex + 2}/${activeTournament.totalGames} 局`
            )
        : t('Game Room', '返回游戏厅')
      : room.remoteFocus.modalIndex === 0
      ? t('Play Again', '再来一局')
      : t('Game Room', '返回游戏厅');

    return renderConnectedShell(
      <div className="relative flex flex-col items-center justify-center h-full text-center px-4 gap-2.5">
        {passHostOverlay}
        {closeRoomOverlay}
        <div className="absolute top-1 right-1 flex items-center gap-1.5">
          {!embedded && <LanguageToggle compact />}
          {isRoomHost && (
            <button
              type="button"
              onClick={() => setCloseRoomConfirmOpen(true)}
              aria-label={t('Close Entire Room', '关闭整个房间')}
              title={t('Close Entire Room', '关闭整个房间')}
              className="h-8 w-8 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-[#FF9B8A] hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {activeTournament && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFB800]/18 border border-[#FFB800]/50 text-[#FFB800] font-mono text-[11px] font-black">
            <Trophy className="w-3.5 h-3.5" />
            <span>
              {activeTournament.completed
                ? t('5-GAME TOURNAMENT FINAL', '5局锦标赛总决赛')
                : t(
                    `TOURNAMENT ${activeTournament.currentGameIndex + 1}/${activeTournament.totalGames}`,
                    `锦标赛 第 ${activeTournament.currentGameIndex + 1}/${activeTournament.totalGames} 局`
                  )}
            </span>
          </div>
        )}
        <div className="flex items-center justify-center gap-3">
          <PlayerAvatar avatarId={me.avatarId} colorHex={me.color.hex} size="md" />
          <div
            className="w-13 h-13 rounded-2xl flex items-center justify-center font-display text-2xl font-extrabold"
            style={{ backgroundColor: me.color.hex, color: me.color.textOnColor }}
          >
            #{activeTournament?.completed && myStanding ? myStanding.rank : myRank?.rank ?? '-'}
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-extrabold">
            {activeTournament?.completed
              ? myStanding?.rank === 1
                ? t('Grand Champion!', '荣耀夺冠！')
                : t('Tournament Complete', '锦标赛结束')
              : myRank?.rank === 1
              ? t('Victory!', '胜利！')
              : t('Match Complete', '本局结束')}
          </h2>
          <p className="text-sm text-[#A5AEBD] mt-0.5">
            {me.name} · {myRank?.score ?? me.score} {t('pts', '分')}
            {myRank?.highlight ? ` · ${translateGameText(myRank.highlight, lang)}` : ''}
          </p>
          {myTeamSpec && myTeamStanding && (
            <div
              className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-extrabold"
              style={{
                backgroundColor: `${myTeamSpec.colorHex}20`,
                borderColor: `${myTeamSpec.colorHex}90`,
                color: myTeamSpec.colorHex,
              }}
            >
              <span>{myTeamSpec.emoji}</span>
              <span>{lang === 'zh' ? myTeamSpec.nameZh : myTeamSpec.name}</span>
              <span className="text-white font-mono">
                #{myTeamStanding.rank} · {myTeamStanding.score}
              </span>
            </div>
          )}
          {myStanding && (
            <div className="mt-1.5 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#1A1E26] border border-[#2F3747] text-xs font-mono">
              <span className="text-[#10D98B] font-extrabold">
                +{myStanding.lastGameMarks} {t('Marks', '积分')}
              </span>
              <span className="text-[#6B7280]">·</span>
              <span className="text-[#FFB800] font-black">
                {t('Total', '累计')}: {myStanding.totalMarks} (#{myStanding.rank})
              </span>
            </div>
          )}
        </div>

        {isPocketRoom && room.rankings.length > 0 && (
          <div className="w-full max-w-lg rounded-2xl bg-[#171B24] border border-[#262E3E] p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-left">
            {room.rankings.slice(0, 4).map((r) => (
              <div
                key={r.playerId}
                className={`px-2 py-1.5 rounded-xl border flex items-center gap-1.5 min-w-0 ${
                  r.playerId === me.id
                    ? 'bg-[#101A28] border-[#00C2FF]'
                    : 'bg-[#10131A] border-[#222938]'
                }`}
              >
                <span className="font-mono text-xs font-black text-[#FFB800] shrink-0">
                  #{r.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-white truncate">{r.name}</div>
                  <div className="text-[10px] font-mono text-[#9CA3AF] tabular-nums">
                    {r.score} {t('pts', '分')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isRoomHost ? (
          isPocketRoom ? (
            <div className="w-full max-w-md space-y-2">
              <div className="flex items-center justify-center gap-2.5">
                {activeTournament ? (
                  <button
                    type="button"
                    onClick={() => wsRef.current?.send({ type: 'tournament:next' })}
                    className="tactile-btn flex-1 h-12 px-4 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-black text-sm shadow-[0_4px_0_#B82E17] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      {activeTournament.completed
                        ? t('New 5-Game Cup', '再来一届锦标赛')
                        : t(
                            `Vote Next (${activeTournament.currentGameIndex + 2}/${activeTournament.totalGames})`,
                            `投票第 ${activeTournament.currentGameIndex + 2}/${activeTournament.totalGames} 局`
                          )}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => wsRef.current?.send({ type: 'game:restart' })}
                    className="tactile-btn flex-1 h-12 px-4 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-black text-sm shadow-[0_4px_0_#B82E17] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{t('Play Again', '再来一局')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => wsRef.current?.send({ type: 'game:return-lobby' })}
                  className="tactile-btn h-12 px-4 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-white font-display font-bold text-sm cursor-pointer"
                >
                  {t('Game Room', '返回游戏厅')}
                </button>
              </div>
              {otherPlayers.length > 0 && (
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setPassHostOpen(true)}
                    className="h-9 px-4 rounded-xl bg-[#1E232D] hover:bg-[#242A36] border border-[#FFB800]/40 text-xs font-bold text-[#FFB800] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5 text-[#FFB800]" />
                    {t('Kick Players / Pass Host', '踢出玩家 / 移交房主')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-md space-y-2">
              <div className="text-xs font-bold text-[#FFB800]">
                {t('TV Highlighted:', '大屏当前选中：')}{' '}
                <span className="text-white">{resultsOptionLabel}</span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => sendRemote('left')}
                  aria-label={t('Remote Left', '遥控器左')}
                  className="tactile-btn h-12 w-14 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => sendRemote('ok')}
                  className="tactile-btn h-12 px-7 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-black text-base shadow-[0_4px_0_#B82E17] cursor-pointer"
                >
                  OK · {resultsOptionLabel}
                </button>
                <button
                  type="button"
                  onClick={() => sendRemote('right')}
                  aria-label={t('Remote Right', '遥控器右')}
                  className="tactile-btn h-12 w-14 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
              {otherPlayers.length > 0 && (
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setPassHostOpen(true)}
                    className="h-9 px-4 rounded-xl bg-[#1E232D] hover:bg-[#242A36] border border-[#FFB800]/40 text-xs font-bold text-[#FFB800] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5 text-[#FFB800]" />
                    {t('Kick Players / Pass Host', '踢出玩家 / 移交房主')}
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          <p className="text-xs text-[#9CA3AF] inline-flex items-center justify-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 text-[#00C2FF] animate-spin shrink-0" aria-hidden="true" />
            <span>
              {t('Waiting for', '等待')}{' '}
              <strong className="text-white">{hostPlayer?.name ?? t('the Host', '房主')}</strong>
              {activeTournament
                ? t(' to launch the next Cup round.', ' 开启下一局锦标赛。')
                : t(' to play again or pick another game.', ' 选择再来一局或切换游戏。')}
            </span>
          </p>
        )}
      </div>
    );
  }

  // =====================================================================
  // STATE 4C: PAUSED SCREEN ON PHONE (Direct Touch in Pocket / Remote on Monitor)
  // =====================================================================
  if (room.status === 'PAUSED') {
    const pauseLabels = [
      t('Resume Match', '继续比赛'),
      t('Restart', '重新开始'),
      t('Switch Game', '切换游戏'),
    ];
    const activePauseLabel = pauseLabels[room.remoteFocus.modalIndex] ?? pauseLabels[0];

    return renderConnectedShell(
      <div className="relative flex flex-col items-center justify-center h-full text-center px-4 gap-3 overflow-hidden">
        {isPocketRoom && (
          <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
            <PocketArenaCanvas
              gameId={room.selectedGameId}
              status={room.status}
              snapshotRef={latestSnapshotRef}
              competitiveRef={latestCompetitiveRef}
              fxRef={fxRef}
              tickVersion={pocketTickVersion}
            />
          </div>
        )}
        {passHostOverlay}
        {closeRoomOverlay}
        {isPocketRoom && pocketRulesOpen && (
          <div className="absolute inset-0 z-50 bg-[#0B0E14]/92 backdrop-blur-md p-3 sm:p-5 flex items-center justify-center">
            <div className="w-full max-w-3xl max-h-full rounded-2xl bg-[#151923] border border-white/15 p-3.5 sm:p-4 shadow-2xl flex flex-col gap-2.5 text-left overflow-hidden">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="w-4 h-4 text-[#00C2FF] shrink-0" />
                  <span className="font-display font-extrabold text-sm sm:text-base text-white truncate">
                    {gameMeta.name}
                  </span>
                  <span className="text-[11px] font-semibold text-[#9CA3AF] truncate">
                    · {gameMeta.category}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPocketRulesOpen(false)}
                  aria-label={t('Close rules', '关闭规则')}
                  className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-12 gap-3 overflow-y-auto arcade-scrollbar">
                <div className="sm:col-span-7 space-y-2">
                  <p className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                    {gameMeta.tagline}
                  </p>
                  {gameMeta.rules.length > 0 && (
                    <ol className="space-y-1.5 pt-1.5 border-t border-white/10">
                      {gameMeta.rules.map((rule, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-[#E5E7EB] leading-snug">
                          <span
                            className="font-mono text-[10px] font-black tabular-nums mt-0.5 shrink-0"
                            style={{ color: gameMeta.accentHex }}
                          >
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          <span className="flex-1">{rule}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {room.activeMutator !== 'normal' && (
                    <div className="pt-1.5 border-t border-white/10 text-xs leading-snug">
                      <span className="font-extrabold" style={{ color: activeMutatorSpec.accentHex }}>
                        {t('Chaos Rule', '混沌规则')}:{' '}
                        {lang === 'zh' ? activeMutatorSpec.nameZh : activeMutatorSpec.name}
                      </span>
                      <span className="text-[#CBD5E1]">
                        {' '}— {lang === 'zh' ? activeMutatorSpec.descriptionZh : activeMutatorSpec.description}
                      </span>
                    </div>
                  )}
                </div>
                <div className="sm:col-span-5 rounded-xl bg-[#0F131B] border border-white/10 p-3 space-y-2 h-fit">
                  <div className="text-[11px] font-bold text-[#10D98B]">{t('Controls', '操作说明')}</div>
                  {isCardGame ? (
                    <p className="text-xs text-[#D1D5DB] leading-relaxed">
                      {gameMeta.controllerSchema.controlTip}
                    </p>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#9CA3AF]">{t('Move', '移动')}</span>
                        <span className="font-bold text-white">{gameMeta.controllerSchema.joystickLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#9CA3AF]">{t('Button A', 'A 键')}</span>
                        <span className="font-bold" style={{ color: gameMeta.controllerSchema.actionA.colorHex }}>
                          {gameMeta.controllerSchema.actionA.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#9CA3AF]">{t('Button B', 'B 键')}</span>
                        <span className="font-bold" style={{ color: gameMeta.controllerSchema.actionB.colorHex }}>
                          {gameMeta.controllerSchema.actionB.label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPocketRulesOpen(false)}
                className="h-9 w-full rounded-xl bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219] font-display font-black text-xs cursor-pointer shrink-0"
              >
                {t('Back to Pause Menu', '返回暂停菜单')}
              </button>
            </div>
          </div>
        )}
        <div className="relative z-10 flex flex-col items-center gap-3 w-full">
          <div className="absolute -top-8 right-0 flex items-center gap-1.5">
            {!embedded && <LanguageToggle compact />}
            {isRoomHost && (
              <button
                type="button"
                onClick={() => setCloseRoomConfirmOpen(true)}
                aria-label={t('Close Entire Room', '关闭整个房间')}
                title={t('Close Entire Room', '关闭整个房间')}
                className="h-8 w-8 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-[#FF9B8A] hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Pause className="w-10 h-10 text-[#FFB800]" />
          <h2 className="font-display text-2xl font-extrabold text-white">
            {t('Game Paused', '游戏已暂停')}
          </h2>
          {isRoomHost ? (
            isPocketRoom ? (
              <div className="w-full max-w-md space-y-2.5">
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => wsRef.current?.send({ type: 'game:pause', paused: false })}
                    className="tactile-btn h-12 px-6 rounded-xl bg-[#10D98B] hover:bg-[#22E89B] text-[#0A1913] font-display font-black text-sm shadow-[0_4px_0_#0A915D] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{t('Resume', '继续游戏')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => wsRef.current?.send({ type: 'game:restart' })}
                    className="tactile-btn h-12 px-5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-bold text-sm shadow-[0_4px_0_#B82E17] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{t('Restart', '重新开始')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => wsRef.current?.send({ type: 'game:return-lobby' })}
                    className="tactile-btn h-12 px-5 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-white font-display font-bold text-sm cursor-pointer"
                  >
                    {t('Switch Game', '切换游戏')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPocketRulesOpen(true)}
                    className="tactile-btn h-12 px-4 rounded-xl bg-[#1A202C] hover:bg-[#252D3D] border border-[#00C2FF]/40 text-[#00C2FF] font-display font-bold text-sm inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>{t('Rules', '规则')}</span>
                  </button>
                </div>
                {otherPlayers.length > 0 && (
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setPassHostOpen(true)}
                      className="h-9 px-4 rounded-xl bg-[#1E232D] hover:bg-[#242A36] border border-[#FFB800]/40 text-xs font-bold text-[#FFB800] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5 text-[#FFB800]" />
                      {t('Kick Players / Pass Host', '踢出玩家 / 移交房主')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full max-w-md space-y-2.5">
                <div className="text-xs font-bold text-[#FFB800]">
                  {t('TV Highlighted:', '大屏当前选中：')}{' '}
                  <span className="text-white">{activePauseLabel}</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => sendRemote('left')}
                    aria-label={t('Remote Left', '遥控器左')}
                    className="tactile-btn h-12 w-14 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => sendRemote('ok')}
                    className="tactile-btn h-12 px-7 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-black text-base shadow-[0_4px_0_#B82E17] cursor-pointer"
                  >
                    OK · {activePauseLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendRemote('right')}
                    aria-label={t('Remote Right', '遥控器右')}
                    className="tactile-btn h-12 w-14 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
                {otherPlayers.length > 0 && (
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setPassHostOpen(true)}
                      className="h-9 px-4 rounded-xl bg-[#1E232D] hover:bg-[#242A36] border border-[#FFB800]/40 text-xs font-bold text-[#FFB800] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5 text-[#FFB800]" />
                      {t('Kick Players / Pass Host', '踢出玩家 / 移交房主')}
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-2.5">
              <p className="text-xs text-[#9CA3AF] inline-flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 text-[#FFB800] animate-spin shrink-0" aria-hidden="true" />
                <span>
                  {t('Paused · Waiting for', '已暂停 · 等待')}{' '}
                  <strong className="text-white">{hostPlayer?.name ?? t('the Host', '房主')}</strong>
                </span>
              </p>
              {isPocketRoom && (
                <button
                  type="button"
                  onClick={() => setPocketRulesOpen(true)}
                  className="h-9 px-4 rounded-xl bg-[#1A202C] hover:bg-[#252D3D] border border-[#00C2FF]/40 text-[#00C2FF] font-display font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{t('View Game Rules', '查看本局规则')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =====================================================================
  // STATE 4B: INTERACTIVE RULES BRIEFING ON PHONE (NO COUNTDOWN — TAP READY!)
  // =====================================================================
  if (room.status === 'BRIEFING') {
    const schema = gameMeta.controllerSchema;
    const activeSettingOpt = gameMeta.settingOptions.find(
      (opt) => opt.value === room.gameSettingValue
    );
    const hasDistinctDescription =
      Boolean(gameMeta.description) &&
      gameMeta.description.trim().toLowerCase() !== gameMeta.tagline.trim().toLowerCase();

    return renderConnectedShell(
      <div
        className={`relative flex flex-col justify-between h-full w-full mx-auto min-h-0 ${
          isPocketRoom ? 'max-w-5xl' : 'max-w-3xl'
        }`}
      >
        {passHostOverlay}
        <div className="flex items-center justify-between gap-3 h-9 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <PlayerAvatar avatarId={me.avatarId} colorHex={me.color.hex} size="xs" />
            {room.teamMode !== 'ffa' && (() => {
              const spec = getTeamSpec(me.teamId);
              return spec ? (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black shrink-0"
                  style={{ backgroundColor: `${spec.colorHex}24`, color: spec.colorHex }}
                >
                  {spec.emoji}
                </span>
              ) : null;
            })()}
            {activeTournament && (
              <span className="px-1.5 py-0.5 rounded bg-[#FFB800]/20 text-[#FFB800] font-mono text-[10px] font-black shrink-0">
                🏆 {activeTournament.currentGameIndex + 1}/{activeTournament.totalGames}
              </span>
            )}
            <span className="font-display font-bold text-sm sm:text-base text-white truncate">
              {gameMeta.name}
            </span>
            <span className="text-xs text-[#9CA3AF] truncate hidden sm:inline">
              · {t('Rules & Controls', '玩法规则与操作')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!embedded && <LanguageToggle compact />}
            {isRoomHost && otherPlayers.length > 0 && (
              <button
                type="button"
                onClick={() => setPassHostOpen(true)}
                className="tactile-btn h-8 px-2.5 rounded-lg bg-[#FFB800] hover:bg-[#FFC933] text-[#14120B] text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>{t('Kick / Host', '踢人 / 房主')}</span>
              </button>
            )}
            {!embedded && (
              <button
                type="button"
                onClick={() => {
                  resetControlsState();
                  setSettingsOpen(true);
                }}
                aria-label={t('Controller settings', '手柄设置')}
                title={t('Joystick & Button Calibration', '摇杆与按键位置校准')}
                className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#00C2FF] flex items-center justify-center cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="font-mono text-xs font-bold text-[#10D98B] shrink-0 tabular-nums">
              {readyHumans.length}/{connectedHumans.length} {t('Ready', '已准备')}
            </span>
          </div>
        </div>

        {isPocketRoom ? (
          /* POCKET MODE BRIEFING: Full Game Rules (Left 7 cols) + Controls & Ready (Right 5 cols) */
          <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5 my-1.5">
            {/* Left Column: Complete Game Rules & Objective */}
            <div className="col-span-7 min-h-0 flex flex-col rounded-xl bg-[#161B24] border border-[#283142] p-3 overflow-hidden">
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#242C3D] shrink-0">
                <div className="flex items-center gap-1.5 min-w-0 text-[11px] font-bold text-[#00C2FF]">
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{t('Game Rules', '游戏规则')}</span>
                  <span className="text-[#6B7280]" aria-hidden="true">·</span>
                  <span className="text-[#9CA3AF] font-semibold truncate">{gameMeta.category}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono tabular-nums">
                  {activeSettingOpt && (
                    <span className="text-[#E5E7EB] font-bold">
                      {gameMeta.settingLabel}: {activeSettingOpt.label}
                    </span>
                  )}
                  {room.activeMutator !== 'normal' && (
                    <span
                      className="font-black"
                      style={{ color: activeMutatorSpec.accentHex }}
                    >
                      · {lang === 'zh' ? activeMutatorSpec.shortTagZh : activeMutatorSpec.shortTag}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto arcade-scrollbar pt-2 pr-1 space-y-2">
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                    {gameMeta.tagline}
                  </p>
                  {hasDistinctDescription && (
                    <p className="text-[11px] sm:text-xs text-[#A5AEBD] leading-relaxed mt-0.5">
                      {gameMeta.description}
                    </p>
                  )}
                </div>

                {gameMeta.rules.length > 0 && (
                  <ol className="space-y-1.5 pt-1.5 border-t border-[#222938]">
                    {gameMeta.rules.map((rule, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-[11px] sm:text-xs text-[#E5E7EB] leading-snug"
                      >
                        <span
                          className="font-mono text-[10px] font-black tabular-nums mt-0.5 shrink-0"
                          style={{ color: gameMeta.accentHex }}
                        >
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        <span className="flex-1">{rule}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {room.activeMutator !== 'normal' && (
                  <div className="pt-1.5 border-t border-[#222938] text-[11px] leading-snug">
                    <span
                      className="font-extrabold"
                      style={{ color: activeMutatorSpec.accentHex }}
                    >
                      {t('Chaos Rule', '混沌规则')}:{' '}
                      {lang === 'zh' ? activeMutatorSpec.nameZh : activeMutatorSpec.name}
                    </span>
                    <span className="text-[#CBD5E1]">
                      {' '}— {lang === 'zh' ? activeMutatorSpec.descriptionZh : activeMutatorSpec.description}
                    </span>
                    {activeMutatorSpec.invertControls && (
                      <p className="text-[11px] font-extrabold text-[#FF3B9A] mt-0.5">
                        ⚠ {t('Mirror Curse active: Joystick directions are flipped!', '镜像反转生效中：本局摇杆方向上下左右反转！')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Controls Guide + Ready CTA */}
            <div className="col-span-5 min-h-0 flex flex-col justify-between gap-2">
              <div className="flex-1 min-h-0 rounded-xl bg-[#161B24] border border-[#283142] p-2.5 flex flex-col gap-1.5 overflow-y-auto arcade-scrollbar">
                <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-[#10D98B] shrink-0">
                  <span>{t('Controls', '操作方式')}</span>
                  {currentPadProfile && (
                    <span className="font-mono text-[10px] text-[#E5E7EB] truncate">
                      {activePadMode === 'card'
                        ? t('Pad 4 · Card Table', '4号 · 手牌台')
                        : activePadMode === 'arrows'
                        ? t('Pad 2 · Arrows', '2号 · 大箭头')
                        : activePadMode === 'trackpad'
                        ? t('Pad 3 · Swipe', '3号 · 触控滑板')
                        : t('Pad 1 · Stick', '1号 · 摇杆')}
                    </span>
                  )}
                </div>

                {isCardGame ? (
                  <p className="text-[11px] text-[#D1D5DB] leading-snug">
                    {schema.controlTip}
                  </p>
                ) : (
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#9CA3AF] shrink-0">{t('Move', '移动')}</span>
                      <span className="font-bold text-white truncate">{schema.joystickLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#9CA3AF] shrink-0">{t('Button A', 'A 键')}</span>
                      <span className="font-bold truncate" style={{ color: schema.actionA.colorHex }}>
                        {schema.actionA.label} · {schema.actionA.sublabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#9CA3AF] shrink-0">{t('Button B', 'B 键')}</span>
                      <span className="font-bold truncate" style={{ color: schema.actionB.colorHex }}>
                        {schema.actionB.label} · {schema.actionB.sublabel}
                      </span>
                    </div>
                  </div>
                )}

                {!isCardGame && (
                  <div className="pt-1 mt-auto">
                    <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[#101217] border border-[#242934]">
                      {(
                        [
                          { id: 'analog', en: '1 Stick', zh: '1 摇杆' },
                          { id: 'arrows', en: '2 Arrows', zh: '2 箭头' },
                          { id: 'trackpad', en: '3 Swipe', zh: '3 滑控' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectArcadePad(opt.id)}
                          className={`py-1 rounded text-[10px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
                            activeArcadePad === opt.id
                              ? 'bg-[#FF4D2E] text-white'
                              : 'text-[#9CA3AF] hover:text-white'
                          }`}
                        >
                          {t(opt.en, opt.zh)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="shrink-0 space-y-1.5">
                {rendererLoadState === 'error' && (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-[#3B1219] border border-[#FF4D2E]/60 px-2.5 py-1.5 text-[11px] font-bold text-[#FCA5A5]">
                    <span className="truncate">{t('Arena load failed', '加载竞技场失败')}</span>
                    <button
                      type="button"
                      onClick={() => void ensureGameRendererReady(room.selectedGameId)}
                      className="px-2 py-0.5 rounded bg-[#FF4D2E] text-white text-[10px] font-extrabold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" aria-hidden="true" />
                      <span>{t('Retry', '重试')}</span>
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  disabled={rendererLoadState === 'loading'}
                  onClick={() => {
                    triggerRoomFullscreen();
                    if (me.ready) {
                      wsRef.current?.send({ type: 'player:ready', ready: false });
                      return;
                    }
                    void ensureGameRendererReady(room.selectedGameId).then((ok) => {
                      if (ok) {
                        wsRef.current?.send({ type: 'player:ready', ready: true });
                      }
                    });
                  }}
                  className="relative tactile-btn w-full h-14 sm:h-16 rounded-2xl font-display font-extrabold text-base sm:text-lg cursor-pointer transition-colors flex items-center justify-center gap-2 select-none disabled:opacity-70"
                  style={
                    me.ready
                      ? {
                          backgroundColor: '#10D98B',
                          color: '#0A1913',
                          boxShadow: '0 4px 0 #0A915D',
                        }
                      : {
                          backgroundColor: '#FF4D2E',
                          color: '#FFFFFF',
                          boxShadow: '0 4px 0 #B82E17',
                        }
                  }
                >
                  {rendererLoadState === 'loading' ? (
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  ) : (
                    me.ready && <Check className="w-5 h-5" />
                  )}
                  <span>
                    {rendererLoadState === 'loading'
                      ? t('Loading Arena...', '正在加载竞技场...')
                      : me.ready
                      ? t('Ready! Waiting...', '已准备！等待其他人')
                      : t("I'm Ready!", '我准备好了！')}
                  </span>
                </button>

                <p className="text-[10px] sm:text-[11px] text-center text-[#A5AEBD] leading-tight inline-flex w-full items-center justify-center gap-1.5">
                  {me.ready && (
                    <Loader2 className="w-3 h-3 text-[#10D98B] animate-spin shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">
                    {me.ready
                      ? t(
                          `Waiting for ${unreadyHumans.map((p) => p.name).join(', ') || 'everyone'}...`,
                          `等待 ${unreadyHumans.map((p) => p.name).join('、') || '全员'} 准备...`
                        )
                      : t(
                          'Read the rules — match starts when everyone is Ready!',
                          '看完规则点准备 — 全员准备后即刻开始！'
                        )}
                  </span>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`flex-1 min-h-0 grid ${
              embedded ? 'grid-cols-1 gap-2.5 my-2' : 'grid-cols-2 gap-4 my-2 items-stretch'
            }`}
          >
            <div className="p-3.5 rounded-xl bg-[#1A1E26] border border-[#2A303D] space-y-2 overflow-y-auto arcade-scrollbar">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#00C2FF]">
                  {t('Rules & Controls', '玩法与操作')}
                </span>
                <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono tabular-nums">
                  {(activeSettingOpt ?? gameMeta.settingOptions[0]) && (
                    <span className="px-1.5 py-0.5 rounded bg-[#101217] border border-[#2A303D] font-bold text-[#E5E7EB]">
                      {gameMeta.settingLabel}: {(activeSettingOpt ?? gameMeta.settingOptions[0]).label}
                    </span>
                  )}
                  {room.activeMutator !== 'normal' && (
                    <span
                      className="font-black px-1.5 py-0.5 rounded bg-[#101217]"
                      style={{ color: activeMutatorSpec.accentHex }}
                    >
                      {lang === 'zh' ? activeMutatorSpec.shortTagZh : activeMutatorSpec.shortTag}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm font-bold text-white leading-snug">{gameMeta.tagline}</p>
              {gameMeta.rules.length > 0 && (
                <ol className="space-y-1 text-[11px] text-[#D1D5DB] leading-snug">
                  {gameMeta.rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span
                        className="font-mono text-[10px] font-black tabular-nums mt-0.5 shrink-0"
                        style={{ color: gameMeta.accentHex }}
                      >
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ol>
              )}
              {activeMutatorSpec.invertControls && (
                <p className="text-[11px] font-extrabold text-[#FF3B9A] leading-tight">
                  ⚠ {t('Mirror Curse active: Joystick directions are flipped!', '镜像反转生效中：本局摇杆方向上下左右反转！')}
                </p>
              )}
              <div className="pt-1.5 border-t border-[#262C38] space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#9CA3AF]">{t('Joystick', '摇杆')}</span>
                  <span className="font-bold text-white">{schema.joystickLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#9CA3AF]">{t('Button A', 'A 键')}</span>
                  <span className="font-bold" style={{ color: schema.actionA.colorHex }}>
                    {schema.actionA.label} · {schema.actionA.sublabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#9CA3AF]">{t('Button B', 'B 键')}</span>
                  <span className="font-bold" style={{ color: schema.actionB.colorHex }}>
                    {schema.actionB.label} · {schema.actionB.sublabel}
                  </span>
                </div>
                {currentPadProfile && (
                  <div className="pt-1.5 mt-1 border-t border-[#262C38] space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-[#10D98B] font-bold inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {t('Auto-Matched Pad', '已自动匹配最佳手柄')}
                      </span>
                      <span className="font-mono text-white font-bold">
                        {activePadMode === 'card'
                          ? t('Pad 4 · Card Table', '4号 · 扑克手牌台')
                          : activePadMode === 'arrows'
                          ? t('Pad 2 · Easy Arrows', '2号 · 简易大箭头')
                          : activePadMode === 'trackpad'
                          ? t('Pad 3 · Swipe Pad', '3号 · 触控滑板')
                          : t('Pad 1 · Pro Stick', '1号 · 360° 摇杆')}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#9CA3AF] leading-snug">
                      {lang === 'zh' ? currentPadProfile.reasonZh : currentPadProfile.reasonEn}
                    </p>
                    {!isCardGame && (
                      <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[#101217] border border-[#242934]">
                        {(
                          [
                            { id: 'analog', en: '1 Stick', zh: '1 摇杆' },
                            { id: 'arrows', en: '2 Arrows', zh: '2 箭头' },
                            { id: 'trackpad', en: '3 Swipe', zh: '3 滑控' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectArcadePad(opt.id)}
                            className={`py-1 rounded text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                              activeArcadePad === opt.id
                                ? 'bg-[#FF4D2E] text-white'
                                : 'text-[#9CA3AF] hover:text-white'
                            }`}
                          >
                            {t(opt.en, opt.zh)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2.5 justify-center">
              {!embedded && (
                <div className="hidden sm:flex justify-center">
                  <PhoneControllerDemo
                    gameId={gameMeta.id}
                    accentHex={gameMeta.accentHex}
                    activeRuleText={gameMeta.rules[0] ?? ''}
                    compact
                  />
                </div>
              )}
              {rendererLoadState === 'error' && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-[#3B1219] border border-[#FF4D2E]/60 px-2.5 py-1.5 text-[11px] font-bold text-[#FCA5A5]">
                  <span className="truncate">{t('Failed to load arena module', '竞技场模块加载失败')}</span>
                  <button
                    type="button"
                    onClick={() => void ensureGameRendererReady(room.selectedGameId)}
                    className="px-2 py-0.5 rounded bg-[#FF4D2E] text-white text-[10px] font-extrabold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" aria-hidden="true" />
                    <span>{t('Retry', '重试')}</span>
                  </button>
                </div>
              )}
              <button
                type="button"
                disabled={rendererLoadState === 'loading'}
                onClick={() => {
                  triggerRoomFullscreen();
                  if (me.ready) {
                    wsRef.current?.send({ type: 'player:ready', ready: false });
                    return;
                  }
                  void ensureGameRendererReady(room.selectedGameId).then((ok) => {
                    if (ok) {
                      wsRef.current?.send({ type: 'player:ready', ready: true });
                    }
                  });
                }}
                className="relative tactile-btn w-full h-18 rounded-2xl font-display font-extrabold text-lg cursor-pointer transition-colors flex items-center justify-center gap-2 select-none disabled:opacity-70"
                style={
                  me.ready
                    ? {
                        backgroundColor: '#10D98B',
                        color: '#0A1913',
                        boxShadow: '0 4px 0 #0A915D',
                      }
                    : {
                        backgroundColor: '#FF4D2E',
                        color: '#FFFFFF',
                        boxShadow: '0 4px 0 #B82E17',
                      }
                }
              >
                {rendererLoadState === 'loading' ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  me.ready && <Check className="w-6 h-6" />
                )}
                <span>
                  {rendererLoadState === 'loading'
                    ? t('Loading Arena...', '正在加载竞技场...')
                    : me.ready
                    ? t('Ready! Waiting for Others', '已准备！等待其他玩家')
                    : t("I'm Ready!", '我准备好了！')}
                </span>
              </button>

              <p className="text-[11px] text-center text-[#A5AEBD] leading-snug inline-flex items-center justify-center gap-1.5">
                {me.ready && (
                  <Loader2 className="w-3.5 h-3.5 text-[#10D98B] animate-spin shrink-0" aria-hidden="true" />
                )}
                <span>
                  {me.ready
                    ? t(
                        `Waiting for ${unreadyHumans.map((p) => p.name).join(', ') || 'everyone'}...`,
                        `等待 ${unreadyHumans.map((p) => p.name).join('、') || '全员'} 准备...`
                      )
                    : t(
                        'Read the rules at your own pace — game starts once everyone taps Ready!',
                        '慢慢看规则 — 所有人点击「我准备好了」后即刻开始！'
                      )}
                </span>
              </p>
            </div>
          </div>
        )}

        {isRoomHost ? (
          <div className="flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={() => wsRef.current?.send({ type: 'game:return-lobby' })}
              className="h-8 px-3 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[11px] font-bold text-[#D1D5DB] cursor-pointer"
            >
              {t('Back to Game Room', '返回游戏厅')}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={rendererLoadState === 'loading'}
                onClick={() => {
                  void ensureGameRendererReady(room.selectedGameId).then((ok) => {
                    if (ok) {
                      wsRef.current?.send({ type: 'game:dismiss-briefing' });
                    }
                  });
                }}
                className="h-8 px-3 rounded-lg bg-[#FFB800] hover:bg-[#FFC933] text-[11px] font-extrabold text-[#14120B] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
              >
                {rendererLoadState === 'loading' && (
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                )}
                <span>
                  {rendererLoadState === 'loading'
                    ? t('Loading...', '加载中...')
                    : t('Host Start Now', '房主直接开始')}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-[11px] text-[#9CA3AF] shrink-0">
            {t(
              'Your gamepad opens automatically as soon as everyone is Ready!',
              '全员准备后手柄将自动切换为游戏模式！'
            )}
          </div>
        )}
      </div>
    );
  }

  // =====================================================================
  // STATE 5: LIVE GAME-ADAPTIVE MULTI-TOUCH GAMEPAD (FULLSCREEN LANDSCAPE)
  // =====================================================================
  const schema = gameMeta.controllerSchema;
  const cdA = Math.max(0, Math.min(1, me.cooldownA));
  const cdB = Math.max(0, Math.min(1, me.cooldownB));
  const hudOpacity = controllerPrefs.pocketHudOpacity;

  const firstAction: 'a' | 'b' = !embedded && controllerPrefs.swapAB ? 'b' : 'a';
  const secondAction: 'a' | 'b' = firstAction === 'a' ? 'b' : 'a';

  const cyclePocketHudOpacity = () => {
    const levels = [0.45, 0.62, 0.8];
    const next = levels.find((l) => l > hudOpacity + 0.05) ?? levels[0];
    updateControllerPrefs({ ...controllerPrefs, pocketHudOpacity: next });
  };

  const renderActionButton = (which: 'a' | 'b', extraClass = '', translucent = false) => {
    const isA = which === 'a';
    const spec = isA ? schema.actionA : schema.actionB;
    const pressed = isA ? pressedA : pressedB;
    const cd = isA ? cdA : cdB;
    const sizeClass = translucent
      ? isA
        ? 'w-[76px] h-[76px] sm:w-[88px] sm:h-[88px] text-xs sm:text-sm'
        : 'w-[66px] h-[66px] sm:w-[76px] sm:h-[76px] text-[11px] sm:text-xs'
      : embedded
      ? isA
        ? 'w-[74px] h-[74px] text-xs'
        : 'w-[66px] h-[66px] text-[11px]'
      : isA
      ? 'w-[92px] h-[92px] sm:w-[106px] sm:h-[106px] text-sm sm:text-base'
      : 'w-[80px] h-[80px] sm:w-[92px] sm:h-[92px] text-xs sm:text-sm';

    const showCharge = isA
      ? room.selectedGameId === 'turbo-drift' || cd > 0.05
      : cd > 0.05;

    return (
      <div key={which} className={`flex flex-col items-center ${extraClass}`}>
        <button
          type="button"
          onPointerDown={(e) => onActionDown(which, e)}
          onPointerUp={(e) => onActionUp(which, e)}
          onPointerCancel={(e) => onActionUp(which, e)}
          onLostPointerCapture={(e) => onActionUp(which, e)}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative rounded-full flex flex-col items-center justify-center font-display font-extrabold touch-none select-none cursor-pointer ${sizeClass} ${
            translucent ? 'border-2 border-white/35 backdrop-blur-[2px]' : ''
          }`}
          style={{
            backgroundColor: translucent
              ? hexToRgba(spec.colorHex, Math.max(0.45, Math.min(0.92, hudOpacity + 0.16)))
              : spec.colorHex,
            color: spec.textColor,
            transform: pressed ? 'translateY(4px) scale(0.96)' : 'translateY(0)',
            boxShadow: pressed
              ? `0 2px 0 ${spec.darkHex}`
              : `0 ${isA ? 6 : 5}px 0 ${spec.darkHex}, 0 ${isA ? 10 : 9}px 18px rgba(0,0,0,0.46)`,
            opacity: isA
              ? cd > 0.05 && room.selectedGameId !== 'turbo-drift'
                ? 0.72
                : 1
              : cd > 0.05
              ? 0.65
              : 1,
          }}
        >
          <ActionIcon
            icon={spec.icon}
            className={`${isA ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4 sm:w-5 sm:h-5'} mb-0.5 pointer-events-none`}
          />
          <span className="pointer-events-none leading-none">{spec.label}</span>
          {showCharge && (
            <span className="text-[10px] font-mono opacity-90 tabular-nums pointer-events-none mt-0.5">
              {Math.round((1 - cd) * 100)}%
            </span>
          )}
        </button>
        {!translucent && (
          <span className="mt-1 text-[10px] sm:text-[11px] font-medium text-[#8B95A7] leading-none">
            {spec.sublabel}
          </span>
        )}
      </div>
    );
  };

  const useIntegratedHud = isPocketRoom;
  const pocketTopHudHidden = Boolean(
    useIntegratedHud &&
      room.status === 'PLAYING' &&
      !pocketHudPinnedOpen &&
      pocketTopHudTucked
  );
  const pocketArcadeCoachVisible = Boolean(
    useIntegratedHud &&
      !isCardGame &&
      room.status === 'PLAYING' &&
      !pocketCoachDismissed &&
      !pocketCoachExpired &&
      !pocketRulesOpen
  );
  const pocketShowYouMarker = Boolean(
    useIntegratedHud &&
      !isCardGame &&
      (room.status === 'COUNTDOWN' || pocketArcadeCoachVisible)
  );
  const pocketCardCoachTip =
    useIntegratedHud && isCardGame && room.status === 'PLAYING' && !pocketCoachDismissed && !pocketCardActed
      ? gameMeta.coachLine || gameMeta.rules[0] || gameMeta.tagline || null
      : null;
  const activeSettingOptLive = gameMeta.settingOptions.find(
    (opt) => opt.value === room.gameSettingValue
  );

  const topControlBar =
    repositionMode && !embedded && !isCardGame ? (
      <div className="relative z-30 flex items-center justify-between gap-2 h-10 shrink-0 px-2 rounded-xl bg-[#1A1E26]/95 border border-[#00C2FF]/60">
        <div className="flex items-center gap-2 min-w-0">
          <Move className="w-4 h-4 text-[#00C2FF] shrink-0" />
          <span className="text-xs font-bold text-white truncate">
            {t(
              'Drag the joystick or A/B buttons to fit your thumbs',
              '直接拖动摇杆或 A/B 按键到最顺手的位置'
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleResetControllerPrefs}
            className="h-7 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[11px] font-bold text-[#D1D5DB] inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t('Reset', '重置')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRepositionMode(false);
              setSettingsOpen(true);
            }}
            className="h-7 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[11px] font-bold text-[#00C2FF] inline-flex items-center gap-1 cursor-pointer"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{t('Sliders', '详细设置')}</span>
          </button>
          <button
            type="button"
            onClick={() => setRepositionMode(false)}
            className="h-7 px-3 rounded-lg bg-[#10D98B] hover:bg-[#22E89B] text-[#0A1913] text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t('Done', '完成')}</span>
          </button>
        </div>
      </div>
    ) : useIntegratedHud ? (
      <div
        aria-hidden={pocketTopHudHidden}
        onPointerDownCapture={() => {
          if (room.status === 'PLAYING' && !pocketHudPinnedOpen && !pocketTopHudHidden) {
            schedulePocketHudAutoTuck(4000);
          }
        }}
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 pointer-events-none h-9 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          pocketTopHudHidden
            ? '-translate-y-[calc(100%+16px)] opacity-0'
            : 'translate-y-0 opacity-100'
        }`}
      >
        {/* Top-Left Corner Pill: Player Identity + Live Stat + Compact Badges (hidden on Pocket card tables since status is unified in bottom-left roster) */}
        <div
          className={`${
            pocketTopHudHidden ? 'pointer-events-none' : 'pointer-events-auto'
          } flex items-center gap-1.5 min-w-0 max-w-[44%]`}
        >
          {!isCardGame && (
            <div className="flex items-center gap-1.5 min-w-0 px-2 py-1 rounded-xl bg-[#0D1017]/82 border border-white/12 backdrop-blur-sm shadow-sm">
              <PlayerAvatar avatarId={me.avatarId} colorHex={me.color.hex} size="xs" />
              <div className="min-w-0 leading-tight">
                <div className="text-[11px] font-bold text-white truncate flex items-center gap-1">
                  <span className="truncate max-w-[78px]">{me.name}</span>
                  {room.teamMode !== 'ffa' && (() => {
                    const spec = getTeamSpec(me.teamId);
                    return spec ? (
                      <span
                        className="px-1 py-0.2 rounded text-[9px] font-mono font-black shrink-0"
                        style={{ backgroundColor: `${spec.colorHex}24`, color: spec.colorHex }}
                      >
                        {spec.emoji}
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="text-[10px] font-mono text-[#9CA3AF] truncate tabular-nums">
                  {translateGameText(me.statText, lang)}
                </div>
              </div>
            </div>
          )}

          {room.frenzy.active && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FF4D2E]/90 border border-[#FFB800]/80 text-white font-mono text-[9px] font-black animate-pulse shrink-0 shadow-[0_0_12px_rgba(255,77,46,0.55)]">
              <Flame className="w-2.5 h-2.5 text-[#FFB800]" />
              <span>{t('FRENZY 2×', '狂热 2×')}</span>
            </span>
          )}
          {activeMutatorSpec.invertControls && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg bg-[#FF3B9A]/80 border border-[#FF8DC7]/60 text-white font-mono text-[9px] font-black shrink-0">
              {t('FLIP', '反转')}
            </span>
          )}
        </div>

        {/* Center intentionally open so top-center game HUDs, timers & seats are unobstructed */}

        {/* Top-Right Corner Pill: Pad Switcher + Emote + Pause + Quick Menu + Leave + Hide */}
        <div
          className={`${
            pocketTopHudHidden ? 'pointer-events-none' : 'pointer-events-auto'
          } flex items-center gap-1 shrink-0 px-1 py-0.5 rounded-xl bg-[#0D1017]/82 border border-white/12 backdrop-blur-sm shadow-sm`}
        >
          {!wsConnected && (
            <span
              title={t('Reconnecting...', '正在重连...')}
              className="h-7 px-1.5 rounded-lg bg-[#FFB800]/20 text-[#FFB800] text-[10px] font-bold inline-flex items-center gap-1 shrink-0"
            >
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              <span className="hidden sm:inline">{t('Sync', '重连')}</span>
            </span>
          )}
          {!isCardGame && (
            <div
              role="group"
              aria-label={t('Switch controller pad', '切换手柄模式')}
              className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#141822]/90 border border-white/10"
            >
              {(
                [
                  { id: 'analog', en: 'Stick', zh: '摇杆' },
                  { id: 'arrows', en: 'Arrows', zh: '箭头' },
                  {
                    id: 'trackpad',
                    en: currentPadProfile?.pocketDirectTouch ? 'Touch' : 'Swipe',
                    zh: currentPadProfile?.pocketDirectTouch ? '直拖' : '滑控',
                  },
                ] as const
              ).map((opt, idx) => {
                const active = activeArcadePad === opt.id;
                const isSuggested = recommendedPadMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectArcadePad(opt.id)}
                    className={`h-6 px-1.5 rounded-md text-[10px] font-bold inline-flex items-center gap-0.5 whitespace-nowrap cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#FF4D2E] text-white'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    <span>{idx + 1}·{t(opt.en, opt.zh)}</span>
                    {isSuggested && !active && (
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full bg-[#10D98B]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setPocketMenuOpen(false);
              setEmoteDrawerOpen((v) => !v);
            }}
            aria-label={t('Send quick emote', '发送表情互动')}
            title={t('Send Emote', '发送互动表情')}
            className={`h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
              emoteDrawerOpen
                ? 'bg-[#FFB800] text-[#14120B]'
                : 'bg-[#1A202C] hover:bg-[#252D3D] text-[#FFB800]'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
          </button>
          {isRoomHost && room.status === 'PLAYING' && (
            <button
              type="button"
              onClick={() => wsRef.current?.send({ type: 'game:pause', paused: true })}
              aria-label={t('Pause game', '暂停游戏')}
              title={t('Pause Game (Host)', '暂停游戏（房主）')}
              className="h-7 w-7 rounded-lg bg-[#1A202C] hover:bg-[#252D3D] text-[#FFB800] flex items-center justify-center cursor-pointer transition-colors"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEmoteDrawerOpen(false);
              setPocketMenuOpen(false);
              setPocketRulesOpen((v) => !v);
            }}
            aria-label={t('Quick rules & controls', '快速查看规则与按键')}
            title={t('Quick Rules & Controls', '快速查看规则与按键')}
            className={`h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
              pocketRulesOpen
                ? 'bg-[#00C2FF] text-[#0B1219]'
                : 'bg-[#1A202C] hover:bg-[#252D3D] text-[#00C2FF]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setEmoteDrawerOpen(false);
              setPocketRulesOpen(false);
              setPocketMenuOpen((v) => !v);
            }}
            aria-label={t('Pocket quick menu', '更多快捷菜单')}
            title={t('More Controls & Settings', '透明度、音效与设置')}
            className={`h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
              pocketMenuOpen
                ? 'bg-[#00C2FF] text-[#0B1219]'
                : 'bg-[#1A202C] hover:bg-[#252D3D] text-[#D1D5DB]'
            }`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleLeave}
            aria-label={t('Leave room', '退出房间')}
            title={t('Leave room', '退出房间')}
            className="h-7 w-7 rounded-lg bg-[#1A202C] hover:bg-[#FF4D2E]/25 text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
          {room.status === 'PLAYING' && (
            <button
              type="button"
              onClick={tuckPocketHudNow}
              aria-label={t('Keep top bar tucked', '收起顶部控制栏')}
              title={t('Hide top bar', '收起顶部栏')}
              className="h-7 w-7 rounded-lg bg-[#1A202C] hover:bg-[#252D3D] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    ) : (
      <div className="relative z-20 flex items-center justify-between gap-2 shrink-0 px-2 h-10">
        <div className="flex items-center gap-2 min-w-0">
          <PlayerAvatar avatarId={me.avatarId} colorHex={me.color.hex} size="xs" />
          <div className="min-w-0 leading-tight">
            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              <span className="truncate">{me.name}</span>
              {room.teamMode !== 'ffa' && (() => {
                const spec = getTeamSpec(me.teamId);
                return spec ? (
                  <span
                    className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black shrink-0"
                    style={{ backgroundColor: `${spec.colorHex}24`, color: spec.colorHex }}
                  >
                    {spec.emoji} {lang === 'zh' ? spec.nameZh : spec.shortName}
                  </span>
                ) : null;
              })()}
            </div>
            <div className="text-[11px] font-mono text-[#9CA3AF] truncate tabular-nums">
              {translateGameText(me.statText, lang)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {room.frenzy.active && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FF4D2E]/25 border border-[#FF4D2E] text-[#FF9B8A] font-mono text-[10px] font-black animate-pulse">
              <Flame className="w-3 h-3 text-[#FFB800]" />
              <span>{t('2× FRENZY', '2× 狂热')}</span>
            </span>
          )}
          {activeMutatorSpec.invertControls && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FF3B9A]/20 border border-[#FF3B9A]/70 text-[#FF8DC7] font-mono text-[10px] font-black">
              {t('MIRROR', '反转')}
            </span>
          )}
          {activeTournament && (
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FFB800]/18 text-[#FFB800] font-mono text-[10px] font-black">
              🏆 {activeTournament.currentGameIndex + 1}/{activeTournament.totalGames}
            </span>
          )}
          <span className="text-[11px] font-semibold text-[#9CA3AF] hidden lg:inline">
            {gameMeta.name}
          </span>
          {!isCardGame && (
            <div
              role="group"
              aria-label={t('Switch controller pad', '切换手柄模式')}
              className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#101217]/90 border border-[#262C38]"
            >
              {(
                [
                  { id: 'analog', en: 'Stick', zh: '摇杆' },
                  { id: 'arrows', en: 'Arrows', zh: '箭头' },
                  { id: 'trackpad', en: 'Swipe', zh: '滑控' },
                ] as const
              ).map((opt, idx) => {
                const active = activeArcadePad === opt.id;
                const isSuggested = recommendedPadMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectArcadePad(opt.id)}
                    className={`h-7 px-2 rounded-md text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#FF4D2E] text-white'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    <span>{idx + 1}·{t(opt.en, opt.zh)}</span>
                    {isSuggested && !active && (
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full bg-[#10D98B]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {connectedGamepadName && !embedded && (
            <span
              title={`${t('Controller connected:', '已连接实体手柄：')} ${connectedGamepadName}`}
              className="min-h-[34px] min-w-[30px] rounded-lg bg-[#10D98B]/15 border border-[#10D98B]/50 text-[#10D98B] flex items-center justify-center shrink-0"
            >
              <Gamepad2 className="w-4 h-4" />
            </span>
          )}
          <button
            type="button"
            onClick={() => setEmoteDrawerOpen((v) => !v)}
            aria-label={t('Send quick emote', '发送表情互动')}
            title={t('Send Emote', '发送互动表情')}
            className={`min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
              emoteDrawerOpen
                ? 'bg-[#FFB800] text-[#14120B]'
                : 'bg-[#1E232D] hover:bg-[#242A36] text-[#FFB800]'
            }`}
          >
            <Smile className="w-4 h-4" />
          </button>
          {!embedded && <LanguageToggle compact />}
          {isRoomHost && room.status === 'PLAYING' && (
            <button
              type="button"
              onClick={() => wsRef.current?.send({ type: 'game:pause', paused: true })}
              aria-label={t('Pause game', '暂停游戏')}
              title={t('Pause Game (Host)', '暂停游戏（房主）')}
              className="min-h-[34px] px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#FFB800] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('Pause', '暂停')}</span>
            </button>
          )}
          {!wsConnected && (
            <span className="text-[11px] font-semibold text-[#FFB800] inline-flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
              <span>{t('Reconnecting...', '正在重连...')}</span>
            </span>
          )}
          {!embedded && (
            <button
              type="button"
              onClick={() => {
                resetControlsState();
                setSettingsOpen(true);
              }}
              aria-label={t('Controller settings & calibration', '手柄位置与按键校准')}
              title={t('Calibrate Pad & Settings', '4 合 1 手柄位置与功能设置')}
              className="min-h-[34px] min-w-[34px] rounded-lg bg-[#1E232D] hover:bg-[#242A36] text-[#00C2FF] flex items-center justify-center cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}
          {!embedded && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')}
              className="min-h-[34px] min-w-[34px] rounded-lg bg-[#1E232D] hover:bg-[#242A36] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={handleLeave}
            aria-label={t('Leave room', '退出房间')}
            className="min-h-[34px] min-w-[34px] rounded-lg bg-[#1E232D] hover:bg-[#242A36] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    );

  const analogPadSurface = (translucent: boolean) => (
    <div
      className={
        translucent
          ? 'flex-1 flex items-end justify-between gap-2 min-h-0 px-2 pb-1.5 pointer-events-none'
          : 'flex-1 grid grid-cols-2 items-center gap-2 min-h-0'
      }
    >
      {/* Left Half: Virtual Joystick */}
      <div
        onPointerDown={onStickPointerDown}
        onPointerMove={onStickPointerMove}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
        onLostPointerCapture={releaseStick}
        onContextMenu={(e) => e.preventDefault()}
        className={
          translucent
            ? `pointer-events-auto pb-1 pl-1 sm:pl-3 flex flex-col justify-end touch-none select-none ${
                repositionMode ? '' : 'cursor-grab active:cursor-grabbing'
              }`
            : `h-full flex flex-col justify-center touch-none select-none ${
                repositionMode ? '' : 'cursor-grab active:cursor-grabbing'
              } ${embedded ? 'items-center' : 'items-start pl-3 sm:pl-10'}`
        }
      >
        <div
          onPointerDown={(e) => startRepositionDrag('stick', e)}
          onPointerMove={moveRepositionDrag}
          onPointerUp={endRepositionDrag}
          onPointerCancel={endRepositionDrag}
          onLostPointerCapture={endRepositionDrag}
          className={`relative flex flex-col items-center ${
            repositionMode
              ? 'pointer-events-auto cursor-move rounded-3xl p-2 border-2 border-dashed border-[#00C2FF] bg-[#00C2FF]/10'
              : 'pointer-events-none'
          }`}
          style={{
            transform: `translate3d(${(embedded ? 0 : controllerPrefs.stickOffsetX) + floatingOriginOffset.x}px, ${(embedded ? 0 : controllerPrefs.stickOffsetY) + floatingOriginOffset.y}px, 0) scale(${embedded ? 1 : controllerPrefs.stickScale})`,
          }}
        >
          {repositionMode && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#00C2FF] text-[#0B1219] font-mono text-[9px] font-black uppercase tracking-wider whitespace-nowrap shadow">
              {t('Drag Stick', '拖动摇杆')}
            </span>
          )}
          <div
            ref={stickZoneRef}
            className={`relative rounded-full border-2 flex items-center justify-center ${
              translucent
                ? 'w-32 h-32 sm:w-36 sm:h-36 backdrop-blur-[2px]'
                : embedded
                ? 'w-32 h-32'
                : 'w-40 h-40 sm:w-44 sm:h-44'
            }`}
            style={{
              backgroundColor: translucent ? `rgba(16, 18, 23, ${hudOpacity})` : '#101217',
              borderColor: stickActive
                ? me.color.hex
                : translucent
                ? 'rgba(255,255,255,0.24)'
                : '#2A303D',
              boxShadow: 'inset 0 6px 18px rgba(0,0,0,0.65)',
            }}
          >
            {/* Subtle directional crosshairs */}
            <div className="absolute inset-4 rounded-full border border-dashed border-white/10" />
            <div className="absolute w-px h-3/4 bg-white/5" />
            <div className="absolute h-px w-3/4 bg-white/5" />

            {/* Movable tactile thumbstick knob */}
            <div
              className={`rounded-full flex items-center justify-center ${
                translucent
                  ? 'w-14 h-14 sm:w-16 sm:h-16'
                  : embedded
                  ? 'w-14 h-14'
                  : 'w-[74px] h-[74px] sm:w-20 sm:h-20'
              }`}
              style={{
                transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
                backgroundColor: translucent
                  ? hexToRgba(me.color.hex, Math.max(0.55, Math.min(0.95, hudOpacity + 0.22)))
                  : me.color.hex,
                boxShadow: `0 6px 0 ${me.color.dark}, 0 10px 20px rgba(0,0,0,0.5)`,
              }}
            >
              <div className="w-1/2 h-1/2 rounded-full bg-black/20 border border-white/25" />
            </div>
          </div>

          {!translucent && (
            <span className="mt-1.5 text-[11px] font-semibold text-[#8B95A7] tracking-wide">
              {schema.joystickLabel}
            </span>
          )}
        </div>
      </div>

      {/* Right Half: Action Buttons A & B + Turbo-A Pin */}
      <div
        onContextMenu={(e) => e.preventDefault()}
        className={
          translucent
            ? 'pointer-events-auto relative pb-1 pr-1 sm:pr-3 flex flex-col items-end justify-end gap-1.5 touch-none select-none'
            : `relative h-full flex items-center touch-none select-none ${
                embedded ? 'justify-center' : 'justify-end pr-3 sm:pr-10'
              }`
        }
      >
        {!repositionMode && (
          <button
            type="button"
            onClick={() => setAutoTapPinned((v) => !v)}
            title={t('Toggle Auto-Tap A', '切换 A 键自动连点')}
            className={`${
              translucent ? '' : 'absolute top-1 right-1 sm:right-3'
            } h-7 px-2 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
              autoTapPinned
                ? 'bg-[#FFB800] border-[#FFE082] text-[#14120B]'
                : 'border-white/25 text-[#D1D5DB] hover:text-white'
            }`}
            style={
              autoTapPinned
                ? undefined
                : {
                    backgroundColor: translucent
                      ? `rgba(16, 18, 23, ${Math.min(0.92, hudOpacity + 0.14)})`
                      : '#181C24',
                  }
            }
          >
            <Repeat className={`w-3 h-3 ${autoTapPinned ? 'animate-spin' : ''}`} />
            <span>{autoTapPinned ? t('Turbo ON', '连发开') : t('Turbo', '连发')}</span>
          </button>
        )}
        <div
          onPointerDown={(e) => startRepositionDrag('buttons', e)}
          onPointerMove={moveRepositionDrag}
          onPointerUp={endRepositionDrag}
          onPointerCancel={endRepositionDrag}
          onLostPointerCapture={endRepositionDrag}
          className={`relative flex items-center justify-center ${
            !embedded && controllerPrefs.buttonLayout === 'horizontal' ? 'flex-row' : 'flex-col'
          } ${
            repositionMode
              ? 'cursor-move rounded-3xl p-2.5 border-2 border-dashed border-[#FF4D2E] bg-[#FF4D2E]/10'
              : ''
          }`}
          style={{
            gap: translucent ? '10px' : embedded ? '10px' : `${controllerPrefs.buttonGap}px`,
            transform: `translate3d(${embedded ? 0 : controllerPrefs.buttonsOffsetX}px, ${embedded ? 0 : controllerPrefs.buttonsOffsetY}px, 0) scale(${embedded ? 1 : controllerPrefs.buttonsScale})`,
          }}
        >
          {repositionMode && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#FF4D2E] text-white font-mono text-[9px] font-black uppercase tracking-wider whitespace-nowrap shadow">
              {t('Drag Buttons', '拖动按键')}
            </span>
          )}
          {renderActionButton(
            firstAction,
            !embedded && controllerPrefs.buttonLayout === 'angled'
              ? '-translate-x-3.5'
              : !embedded && controllerPrefs.buttonLayout === 'horizontal'
              ? 'mt-3'
              : '',
            translucent
          )}
          {renderActionButton(
            secondAction,
            !embedded && controllerPrefs.buttonLayout === 'angled'
              ? 'translate-x-3.5'
              : !embedded && controllerPrefs.buttonLayout === 'horizontal'
              ? '-mt-3'
              : '',
            translucent
          )}
        </div>
      </div>
    </div>
  );

  return renderConnectedShell(
    <div
      className={`relative flex flex-col justify-between h-full w-full ${
        useIntegratedHud ? 'overflow-hidden' : 'max-w-6xl mx-auto'
      } transition-transform duration-75 ${isCardRedWarning ? 'p-1.5' : ''}`}
      style={{
        boxShadow: isCardRedWarning
          ? 'inset 0 0 0 4px #FF3B30, inset 0 0 38px rgba(255, 59, 48, 0.72), 0 0 22px rgba(255, 59, 48, 0.55)'
          : 'none',
        borderRadius: '14px',
      }}
    >
      {isCardRedWarning && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[14px] border-4 border-[#FF3B30] shadow-[inset_0_0_44px_rgba(255,59,48,0.82)] animate-pulse z-30"
        />
      )}

      {/* Pocket Mode Integrated Full-Arena Background Canvas (Arcade Games) */}
      {useIntegratedHud && !isCardGame && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <PocketArenaCanvas
            gameId={room.selectedGameId}
            status={room.status}
            snapshotRef={latestSnapshotRef}
            competitiveRef={latestCompetitiveRef}
            fxRef={fxRef}
            tickVersion={pocketTickVersion}
            highlightPlayerId={me.id}
            highlightColorHex={me.color.hex}
            showYouMarker={pocketShowYouMarker}
            localPredictionRef={localPredictionRef}
          />
          {room.status === 'COUNTDOWN' && (
            <div className="absolute inset-0 flex items-center justify-center px-4 pointer-events-none">
              <div className="w-full max-w-md px-5 py-3.5 rounded-3xl bg-[#0B0E14]/88 border-2 border-[#FFB800] text-center shadow-2xl backdrop-blur-sm">
                <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#FFB800]">
                  <span>{gameMeta.name}</span>
                  {room.activeMutator !== 'normal' && (
                    <span
                      className="px-1.5 py-0.5 rounded bg-black/50 font-mono text-[10px]"
                      style={{ color: activeMutatorSpec.accentHex }}
                    >
                      {lang === 'zh' ? activeMutatorSpec.shortTagZh : activeMutatorSpec.shortTag}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-extrabold text-white mt-1 leading-snug">
                  {gameMeta.tagline}
                </p>
                <div className="font-display text-4xl sm:text-5xl font-black text-white tabular-nums my-1">
                  {room.countdownValue}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] pt-1.5 border-t border-white/10">
                  <span className="inline-flex items-center gap-1 font-bold text-white">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: me.color.hex }}
                    />
                    {t('Spot ▼ YOU', '先看 ▼ 你在哪里')}
                  </span>
                  {currentPadProfile?.pocketDirectTouch && activeArcadePad === 'trackpad' ? (
                    <span className="font-extrabold text-[#10D98B]">
                      {currentPadProfile.pocketDirectTouch === 'golf-slingshot'
                        ? t('Drag back to aim · Release to putt', '按住后拉瞄准 · 松手推杆进洞')
                        : currentPadProfile.pocketDirectTouch === 'sketch-canvas'
                        ? t('Draw on board or tap a word card', '直接在白板画画或点击词卡抢答')
                        : t('Drag directly on court to move & hit', '直接在球场上拖动挡板击球')}
                    </span>
                  ) : (
                    <>
                      <span className="text-[#D1D5DB] font-semibold">
                        {schema.joystickLabel}
                      </span>
                      <span className="font-extrabold" style={{ color: schema.actionA.colorHex }}>
                        A·{schema.actionA.label}
                      </span>
                      <span className="font-extrabold" style={{ color: schema.actionB.colorHex }}>
                        B·{schema.actionB.label}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pocket Mode Frenzy Time Fly-Through Banner + Fiery Active Edge Vignette */}
      {useIntegratedHud && (
        <FrenzyBannerOverlay
          gameId={room.selectedGameId}
          status={room.status}
          frenzy={room.frenzy}
          compact
        />
      )}

      {topControlBar}

      {/* Minimal Top-Right Pull-Down Tab when Pocket HUD is tucked up */}
      {useIntegratedHud && room.status === 'PLAYING' && !repositionMode && (
        <button
          type="button"
          onClick={() => revealPocketHudTemporarily(4000)}
          aria-label={t('Show top controls', '展开顶部控制栏')}
          title={t('Show top controls', '展开顶部菜单与状态')}
          className={`absolute top-0 right-1 z-30 min-w-[46px] min-h-[30px] flex items-start justify-end cursor-pointer transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            pocketTopHudHidden
              ? 'opacity-80 hover:opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-full pointer-events-none'
          }`}
        >
          <span className="h-[18px] px-2 rounded-b-lg bg-[#0D1017]/82 border-x border-b border-white/20 backdrop-blur-sm shadow-md inline-flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: me.color.hex }}
            />
            <ChevronDown className="w-3 h-3 text-[#E5E7EB]" />
          </span>
        </button>
      )}

      {/* Non-Blocking Live In-Game Coach Strip (First 6.5s of Pocket Arcade Match) */}
      {pocketArcadeCoachVisible && (
        <div
          className={`pointer-events-none absolute top-10 left-1/2 z-20 w-[min(92vw,480px)] flex justify-center transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            pocketTopHudHidden ? '-translate-x-1/2 -translate-y-8' : '-translate-x-1/2 translate-y-0'
          }`}
        >
          <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0B0E14]/90 border border-white/18 shadow-xl backdrop-blur-sm text-[11px] sm:text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
              style={{ backgroundColor: me.color.hex }}
            />
            <span className="font-bold text-white truncate">
              {currentPadProfile?.pocketDirectTouch && activeArcadePad === 'trackpad'
                ? currentPadProfile.pocketDirectTouch === 'golf-slingshot'
                  ? t('Drag back anywhere to aim & release to putt!', '按住后拉瞄准，松手推杆进洞！')
                  : currentPadProfile.pocketDirectTouch === 'sketch-canvas'
                  ? cardState?.isMyTurn && cardState.badgeText
                    ? `${t('Draw:', '请画出：')} ${cardState.badgeText}`
                    : t('Draw directly on board or tap a word card!', '直接在白板画画或点击词卡猜词！')
                  : t('Drag your paddle directly on screen to hit!', '直接在画面上拖动球拍击球！')
                : gameMeta.coachLine || gameMeta.rules[0] || gameMeta.tagline}
            </span>
            {!(currentPadProfile?.pocketDirectTouch && activeArcadePad === 'trackpad') && (
              <span className="hidden sm:inline font-mono text-[10px] font-black shrink-0" style={{ color: schema.actionA.colorHex }}>
                A·{schema.actionA.label}
              </span>
            )}
            <button
              type="button"
              onClick={() => setPocketCoachDismissed(true)}
              aria-label={t('Dismiss guide', '关闭提示')}
              className="w-5 h-5 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-white shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Pocket In-Game Quick Rules Modal (Triggered anytime via ? button) */}
      {useIntegratedHud && pocketRulesOpen && (
        <div className="absolute inset-0 z-[45] bg-[#0B0E14]/88 backdrop-blur-md p-3 sm:p-5 flex items-center justify-center">
          <div className="w-full max-w-3xl max-h-full rounded-2xl bg-[#151923] border border-white/15 p-3.5 sm:p-4 shadow-2xl flex flex-col gap-2.5 overflow-hidden">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="w-4 h-4 text-[#00C2FF] shrink-0" />
                <span className="font-display font-extrabold text-sm sm:text-base text-white truncate">
                  {gameMeta.name}
                </span>
                <span className="text-[11px] font-semibold text-[#9CA3AF] truncate">
                  · {gameMeta.category}
                </span>
                {activeSettingOptLive && (
                  <span className="hidden sm:inline text-[11px] font-mono text-[#E5E7EB] shrink-0">
                    · {gameMeta.settingLabel}: {activeSettingOptLive.label}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPocketRulesOpen(false)}
                aria-label={t('Close rules', '关闭规则')}
                className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-12 gap-3 overflow-y-auto arcade-scrollbar">
              <div className="sm:col-span-7 space-y-2">
                <p className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                  {gameMeta.tagline}
                </p>
                {gameMeta.rules.length > 0 && (
                  <ol className="space-y-1.5 pt-1.5 border-t border-white/10">
                    {gameMeta.rules.map((rule, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-[#E5E7EB] leading-snug">
                        <span
                          className="font-mono text-[10px] font-black tabular-nums mt-0.5 shrink-0"
                          style={{ color: gameMeta.accentHex }}
                        >
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        <span className="flex-1">{rule}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {room.activeMutator !== 'normal' && (
                  <div className="pt-1.5 border-t border-white/10 text-xs leading-snug">
                    <span className="font-extrabold" style={{ color: activeMutatorSpec.accentHex }}>
                      {t('Chaos Rule', '混沌规则')}:{' '}
                      {lang === 'zh' ? activeMutatorSpec.nameZh : activeMutatorSpec.name}
                    </span>
                    <span className="text-[#CBD5E1]">
                      {' '}— {lang === 'zh' ? activeMutatorSpec.descriptionZh : activeMutatorSpec.description}
                    </span>
                    {activeMutatorSpec.invertControls && (
                      <p className="text-[11px] font-extrabold text-[#FF3B9A] mt-0.5">
                        ⚠ {t('Mirror Curse active: Joystick directions are flipped!', '镜像反转生效中：本局摇杆方向上下左右反转！')}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="sm:col-span-5 rounded-xl bg-[#0F131B] border border-white/10 p-3 space-y-2 h-fit">
                <div className="text-[11px] font-bold text-[#10D98B]">{t('Controls', '操作说明')}</div>
                {isCardGame ? (
                  <p className="text-xs text-[#D1D5DB] leading-relaxed">
                    {schema.controlTip}
                  </p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#9CA3AF]">{t('Move', '移动')}</span>
                      <span className="font-bold text-white">{schema.joystickLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#9CA3AF]">{t('Button A', 'A 键')}</span>
                      <span className="font-bold" style={{ color: schema.actionA.colorHex }}>
                        {schema.actionA.label} · {schema.actionA.sublabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#9CA3AF]">{t('Button B', 'B 键')}</span>
                      <span className="font-bold" style={{ color: schema.actionB.colorHex }}>
                        {schema.actionB.label} · {schema.actionB.sublabel}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPocketRulesOpen(false);
                  setRuleBotOpen(true);
                }}
                className="h-9 px-3.5 rounded-xl bg-[#182234] hover:bg-[#22304A] border border-[#00C2FF]/45 text-[#00C2FF] font-display font-black text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Bot className="w-3.5 h-3.5 shrink-0" />
                <span>{t('Ask Guide Bot', '问平台助手')}</span>
              </button>
              <button
                type="button"
                onClick={() => setPocketRulesOpen(false)}
                className="h-9 flex-1 rounded-xl bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219] font-display font-black text-xs cursor-pointer"
              >
                {t('Back to Game', '回到游戏')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Quick Live Emote Bar (Available across ALL 4 Pads!) */}
      {emoteDrawerOpen && (
        <div className="absolute top-10 right-2 z-40 p-1.5 rounded-xl bg-[#181C24]/95 border border-[#2F3747] shadow-2xl flex items-center gap-1">
          {QUICK_EMOTES.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSendQuickEmote(emoji)}
              className="w-9 h-9 rounded-lg bg-[#101217] hover:bg-[#242A36] active:scale-90 text-xl flex items-center justify-center cursor-pointer transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Pocket Quick Menu Popover (Opacity, Sound, Language, Calibration, Fullscreen) */}
      {useIntegratedHud && pocketMenuOpen && (
        <div className="absolute top-10 right-2 z-40 p-2 rounded-xl bg-[#121620]/96 border border-white/15 shadow-2xl flex flex-wrap items-center gap-1.5 max-w-[260px] backdrop-blur-md">
          <button
            type="button"
            onClick={cyclePocketHudOpacity}
            className="h-8 px-2.5 rounded-lg bg-[#1E232D] hover:bg-[#272E3B] text-[11px] font-mono font-bold text-[#00C2FF] cursor-pointer whitespace-nowrap"
          >
            {t('HUD', '透明度')} {Math.round(hudOpacity * 100)}%
          </button>
          <button
            type="button"
            onClick={() => {
              arcadeAudio.unlock();
              setPocketMuted((m) => !m);
            }}
            className={`h-8 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              pocketMuted
                ? 'bg-[#1E232D] text-[#9CA3AF]'
                : 'bg-[#10D98B]/20 border border-[#10D98B]/45 text-[#10D98B]'
            }`}
          >
            {pocketMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{pocketMuted ? t('Muted', '静音') : t('Sound', '音效')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPocketMenuOpen(false);
              setRuleBotOpen(true);
            }}
            className="h-8 px-2.5 rounded-lg bg-[#00C2FF]/18 hover:bg-[#00C2FF]/28 border border-[#00C2FF]/45 text-[11px] font-bold text-[#00C2FF] inline-flex items-center gap-1 cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>{t('Guide Bot', '平台助手')}</span>
          </button>
          {!embedded && <LanguageToggle compact />}
          {!embedded && (
            <button
              type="button"
              onClick={() => {
                setPocketMenuOpen(false);
                resetControlsState();
                setSettingsOpen(true);
              }}
              className="h-8 px-2.5 rounded-lg bg-[#1E232D] hover:bg-[#272E3B] text-[11px] font-bold text-[#00C2FF] inline-flex items-center gap-1 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{t('Pad Setup', '按键设置')}</span>
            </button>
          )}
          {!embedded && (
            <button
              type="button"
              onClick={() => {
                setPocketMenuOpen(false);
                toggleFullscreen();
              }}
              className="h-8 px-2.5 rounded-lg bg-[#1E232D] hover:bg-[#272E3B] text-[11px] font-bold text-[#D1D5DB] inline-flex items-center gap-1 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{isFullscreen ? t('Window', '退出全屏') : t('Full', '全屏')}</span>
            </button>
          )}
          {activeTournament && (
            <span className="h-8 px-2 rounded-lg bg-[#FFB800]/18 text-[#FFB800] font-mono text-[10px] font-black inline-flex items-center gap-1">
              🏆 {activeTournament.currentGameIndex + 1}/{activeTournament.totalGames}
            </span>
          )}
        </div>
      )}

      {isCardGame ? (
        /* PAD 4: Private Card Hand + Actions Below Live Table (Pocket Mode Top-to-Bottom Tabletop) */
        (() => {
          const pocketTableCanvasEl = useIntegratedHud ? (
            <>
              <PocketArenaCanvas
                gameId={room.selectedGameId}
                status={room.status}
                snapshotRef={latestSnapshotRef}
                competitiveRef={latestCompetitiveRef}
                fxRef={fxRef}
                tickVersion={pocketTickVersion}
                hidePlayerId={isPocketCardHandShown ? me.id : null}
                cameraFocus={
                  TABLETOP_ZOOM_CARD_GAMES.has(room.selectedGameId)
                    ? isPocketCardHandShown
                      ? 'turn-focus'
                      : 'table-overview-zoom'
                    : 'overview'
                }
              />
              {room.status === 'COUNTDOWN' && (
                <div className="absolute inset-0 flex items-center justify-center px-4 pointer-events-none">
                  <div className="w-full max-w-md px-5 py-3.5 rounded-3xl bg-[#0B0E14]/88 border-2 border-[#FFB800] text-center shadow-2xl backdrop-blur-sm">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#FFB800]">
                      {gameMeta.name}
                    </div>
                    <p className="text-xs sm:text-sm font-extrabold text-white mt-1 leading-snug">
                      {gameMeta.tagline}
                    </p>
                    <div className="font-display text-4xl sm:text-5xl font-black text-white tabular-nums my-1">
                      {room.countdownValue}
                    </div>
                    {(gameMeta.coachLine || gameMeta.rules[0]) && (
                      <p className="text-[11px] font-semibold text-[#CBD5E1] pt-1.5 border-t border-white/10 leading-snug">
                        {gameMeta.coachLine || gameMeta.rules[0]}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null;

          return (
            <div className="relative flex-1 min-h-0 flex flex-col">
              {useIntegratedHud && !isPocketCardHandShown && (
                <div className="pointer-events-none z-0 overflow-hidden absolute inset-0 pb-[46px]">
                  {pocketTableCanvasEl}
                </div>
              )}
              <CardControllerDeck
                cardState={cardState}
                playerColorHex={me.color.hex}
                embedded={embedded}
                pocketOverlay={isPocketRoom}
                pocketTableSlot={
                  useIntegratedHud && isPocketCardHandShown ? pocketTableCanvasEl : null
                }
                hudOpacity={hudOpacity}
                isCountdown={room.status === 'COUNTDOWN'}
                countdownValue={room.countdownValue}
                viewMode={controllerPrefs.cardViewMode}
                recommendedView={effectiveCardDefaultView}
                sortMode={controllerPrefs.cardSortMode}
                privacyShield={controllerPrefs.cardPrivacyShield}
                actionsSide={controllerPrefs.cardActionsSide}
                coachTip={pocketCardCoachTip}
                onDismissCoach={() => setPocketCoachDismissed(true)}
                situation={
                  isPocketRoom
                    ? buildPocketCardSituation(
                        latestSnapshotRef.current,
                        room,
                        cardState,
                        me.id,
                        lang
                      )
                    : null
                }
                handCollapsed={isPocketRoom ? !isPocketCardHandShown : false}
                onToggleHandCollapsed={
                  isPocketRoom
                    ? () =>
                        setPocketCardViewOverride(
                          isPocketCardHandShown ? 'show-table' : 'show-hand'
                        )
                    : undefined
                }
                onChangeViewMode={(next) =>
                  updateControllerPrefs({ ...controllerPrefs, cardViewMode: next })
                }
                onCycleSortMode={() => {
                  const order = ['server', 'playable', 'rank'] as const;
                  const next = order[(order.indexOf(controllerPrefs.cardSortMode) + 1) % order.length];
                  updateControllerPrefs({ ...controllerPrefs, cardSortMode: next });
                }}
                onTogglePrivacy={() =>
                  updateControllerPrefs({
                    ...controllerPrefs,
                    cardPrivacyShield: !controllerPrefs.cardPrivacyShield,
                  })
                }
                onFlipActionsSide={() =>
                  updateControllerPrefs({
                    ...controllerPrefs,
                    cardActionsSide: controllerPrefs.cardActionsSide === 'right' ? 'left' : 'right',
                  })
                }
                onAction={sendCardAction}
              />
            </div>
          );
        })()
      ) : (
        <>
          {useIntegratedHud &&
            currentPadProfile?.pocketDirectTouch &&
            activeArcadePad === 'trackpad' && (
              <DirectArenaTouchDeck
                mode={currentPadProfile.pocketDirectTouch}
                gameId={room.selectedGameId}
                playerId={me.id}
                accentHex={me.color.hex}
                snapshotRef={latestSnapshotRef}
                cardState={cardState}
                isCssRotated={isCssRotated}
                disabled={settingsOpen || room.status !== 'PLAYING'}
                cooldownA={cdA}
                onSendDirectInput={handleSendDirectInput}
                onPulseActionA={handlePulseActionA}
                onLocalPrediction={(pred) => {
                  localPredictionRef.current = pred;
                }}
              />
            )}
          {!useIntegratedHud &&
            room.selectedGameId === 'draw-guess-relay' &&
            activeArcadePad !== 'trackpad' &&
            cardState && (
              <div className="shrink-0 mx-auto mb-1 px-3 py-1 rounded-xl bg-[#131924] border border-[#38BDF8]/40 text-xs font-extrabold text-center text-[#7DD3FC]">
                {cardState.isMyTurn
                  ? `${t('DRAW:', '请画：')} ${cardState.badgeText}`
                  : lang === 'zh'
                  ? cardState.statusHintZh
                  : cardState.statusHint}
              </div>
            )}
          <div
            className={`flex-1 min-h-0 flex flex-col justify-end ${
              useIntegratedHud ? 'relative z-10 pointer-events-none' : ''
            }`}
          >
            {useIntegratedHud &&
            currentPadProfile?.pocketDirectTouch &&
            activeArcadePad === 'trackpad' ? null : !useIntegratedHud &&
              room.selectedGameId === 'draw-guess-relay' &&
              activeArcadePad === 'trackpad' ? (
              <SketchNormalDeck
                playerId={me.id}
                accentHex={me.color.hex}
                snapshotRef={latestSnapshotRef}
                cardState={cardState}
                disabled={settingsOpen || room.status !== 'PLAYING'}
                onSendDirectInput={handleSendDirectInput}
              />
            ) : !useIntegratedHud &&
              currentPadProfile?.pocketDirectTouch &&
              activeArcadePad === 'trackpad' ? (
              <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl border border-[#2C3545] bg-[#0B0E14]">
                <PocketArenaCanvas
                  gameId={room.selectedGameId}
                  status={room.status}
                  snapshotRef={latestSnapshotRef}
                  competitiveRef={latestCompetitiveRef}
                  fxRef={fxRef}
                  tickVersion={pocketTickVersion}
                  highlightPlayerId={me.id}
                  highlightColorHex={me.color.hex}
                  showYouMarker={room.status === 'COUNTDOWN'}
                  localPredictionRef={localPredictionRef}
                />
                <DirectArenaTouchDeck
                  mode={currentPadProfile.pocketDirectTouch}
                  gameId={room.selectedGameId}
                  playerId={me.id}
                  accentHex={me.color.hex}
                  snapshotRef={latestSnapshotRef}
                  cardState={cardState}
                  isCssRotated={isCssRotated}
                  disabled={settingsOpen || room.status !== 'PLAYING'}
                  cooldownA={cdA}
                  onSendDirectInput={handleSendDirectInput}
                  onPulseActionA={handlePulseActionA}
                  onLocalPrediction={(pred) => {
                    localPredictionRef.current = pred;
                  }}
                />
              </div>
            ) : activeArcadePad === 'arrows' ? (
              /* PAD 2: Beginner-Friendly Easy Tap Arrows + Verb-Labeled A/B + Auto-Tap */
              <EasyArrowsDeck
                schema={schema}
                accentHex={me.color.hex}
                cooldownA={cdA}
                cooldownB={cdB}
                pressedA={pressedA}
                pressedB={pressedB}
                strictFourWay={effectiveArrowsStrictFourWay}
                autoTapActive={autoTapPinned}
                preferAutoTap={Boolean(currentPadProfile?.preferAutoTap)}
                swapAB={!embedded && controllerPrefs.swapAB}
                embedded={embedded}
                pocketOverlay={useIntegratedHud}
                hudOpacity={hudOpacity}
                disabled={settingsOpen}
                isTurboDrift={room.selectedGameId === 'turbo-drift'}
                onVectorChange={handleSetVector}
                onActionDown={onActionDown}
                onActionUp={onActionUp}
                onToggleAutoTap={() => setAutoTapPinned((v) => !v)}
                onToggleStrictFourWay={() =>
                  updateControllerPrefs({
                    ...controllerPrefs,
                    arrowsStrictFourWay: !effectiveArrowsStrictFourWay,
                  })
                }
              />
            ) : activeArcadePad === 'trackpad' ? (
              /* PAD 3: Swipe Trackpad + Reversible Ergonomic Side Triggers */
              <SwipeTrackpadDeck
                schema={schema}
                accentHex={me.color.hex}
                cooldownA={cdA}
                cooldownB={cdB}
                pressedA={pressedA}
                pressedB={pressedB}
                trackpadMode={effectiveTrackpadMode}
                handedness={controllerPrefs.trackpadHandedness}
                tapForA={effectiveTrackpadTapForA}
                sensitivity={controllerPrefs.trackpadSensitivity}
                swapAB={!embedded && controllerPrefs.swapAB}
                isCssRotated={isCssRotated}
                embedded={embedded}
                pocketOverlay={useIntegratedHud}
                hudOpacity={hudOpacity}
                disabled={settingsOpen}
                isTurboDrift={room.selectedGameId === 'turbo-drift'}
                onVectorChange={handleSetVector}
                onPulseActionA={handlePulseActionA}
                onActionDown={onActionDown}
                onActionUp={onActionUp}
                onToggleTrackpadMode={() =>
                  updateControllerPrefs({
                    ...controllerPrefs,
                    trackpadModeOverride: effectiveTrackpadMode === 'glide' ? 'flick' : 'glide',
                  })
                }
                onToggleHandedness={() =>
                  updateControllerPrefs({
                    ...controllerPrefs,
                    trackpadHandedness:
                      controllerPrefs.trackpadHandedness === 'right' ? 'left' : 'right',
                  })
                }
                onToggleTapForA={() =>
                  updateControllerPrefs({
                    ...controllerPrefs,
                    trackpadTapForAOverride: !effectiveTrackpadTapForA,
                  })
                }
              />
            ) : (
              /* PAD 1: Pro Analog Console */
              analogPadSurface(useIntegratedHud)
            )}
          </div>
        </>
      )}

      {/* Subtle Bottom Helper Strip (Hidden in Pocket Integrated HUD so full screen stays open) */}
      {!useIntegratedHud && (
        <div className="text-center text-[11px] text-[#6B7280] shrink-0">
          {room.status === 'COUNTDOWN'
            ? t(`Match starting in ${room.countdownValue}...`, `比赛即将在 ${room.countdownValue} 秒后开始...`)
            : isCardGame
            ? keyboardProfile === 'wasd'
              ? t('Tap cards above or use A/D · Space (A) · Left Shift (B)', '点击上方手牌或使用 A/D · 空格 (A) · 左 Shift (B)')
              : keyboardProfile === 'arrows'
              ? t('Tap cards above or use Arrows · Enter (A) · Right Shift (B)', '点击上方手牌或使用方向键 · 回车 (A) · 右 Shift (B)')
              : t('Secret hand · 15s turn clock · Auto-passes on timeout', '私密手牌 · 每回合限时 15 秒 · 超时自动过牌')
            : !me.alive
            ? t(
                'Knocked out — watch the monitor for next round or respawn',
                '已被淘汰 — 请观看大屏等待复活或下一回合'
              )
            : keyboardProfile === 'wasd'
            ? t('Keys: W A S D · Space (A) · Left Shift (B)', '按键：W A S D · 空格 (A) · 左 Shift (B)')
            : keyboardProfile === 'arrows'
            ? t('Keys: Arrows · Enter (A) · Right Shift (B)', '按键：方向键 · 回车 (A) · 右 Shift (B)')
            : schema.controlTip}
        </div>
      )}

      <RuleChatbotDrawer
        isOpen={ruleBotOpen}
        onClose={() => setRuleBotOpen(false)}
        activeGameId={room.selectedGameId}
        roomPlayerCount={room.players.length}
      />
    </div>
  );
}

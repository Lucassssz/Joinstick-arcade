export interface AvatarPreset {
  id: string;
  emoji: string;
  label: string;
  labelZh: string;
  bgHex: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'fox', emoji: '🦊', label: 'Blitz Fox', labelZh: '闪电狐', bgHex: '#3B1F16' },
  { id: 'cat', emoji: '🐱', label: 'Neon Cat', labelZh: '霓虹猫', bgHex: '#2F213B' },
  { id: 'dino', emoji: '🦖', label: 'Rex', labelZh: '霸王龙', bgHex: '#153326' },
  { id: 'robot', emoji: '🤖', label: 'Mecha', labelZh: '机甲仔', bgHex: '#152A3D' },
  { id: 'alien', emoji: '👾', label: 'Pixel Alien', labelZh: '像素外星人', bgHex: '#241B40' },
  { id: 'dragon', emoji: '🐉', label: 'Pyro Dragon', labelZh: '烈焰龙', bgHex: '#3B181C' },
  { id: 'shark', emoji: '🦈', label: 'Turbo Shark', labelZh: '酷鲨鱼', bgHex: '#122938' },
  { id: 'panda', emoji: '🐼', label: 'Kung Fu Panda', labelZh: '功夫熊猫', bgHex: '#252B36' },
  { id: 'ghost', emoji: '👻', label: 'Boo Ghost', labelZh: '捣蛋幽灵', bgHex: '#1F2338' },
  { id: 'unicorn', emoji: '🦄', label: 'Star Uni', labelZh: '星光独角兽', bgHex: '#3A1C33' },
  { id: 'octopus', emoji: '🐙', label: 'Octo Jam', labelZh: '章鱼达人', bgHex: '#36192C' },
  { id: 'bear', emoji: '🐻', label: 'Power Bear', labelZh: '暴走熊', bgHex: '#332417' },
  { id: 'rocket', emoji: '🚀', label: 'Astro Ace', labelZh: '火箭王牌', bgHex: '#18243B' },
  { id: 'lion', emoji: '🦁', label: 'King Lion', labelZh: '黄金狮王', bgHex: '#3B2B12' },
  { id: 'frog', emoji: '🐸', label: 'Hop Frog', labelZh: '弹跳蛙', bgHex: '#15331E' },
  { id: 'owl', emoji: '🦉', label: 'Night Owl', labelZh: '夜猫头鹰', bgHex: '#2A221B' },
];

export const DEFAULT_AVATAR_ID = AVATAR_PRESETS[0].id;

export function getAvatarPreset(avatarId?: string | null): AvatarPreset {
  if (!avatarId) return AVATAR_PRESETS[0];
  return AVATAR_PRESETS.find((a) => a.id === avatarId) ?? AVATAR_PRESETS[0];
}

export function isValidAvatarId(avatarId?: string | null): avatarId is string {
  return Boolean(avatarId && AVATAR_PRESETS.some((a) => a.id === avatarId));
}

// ============================================================================
// FLEXIBLE TEAM MODES
// ============================================================================

export type TeamMode = 'ffa' | 'teams-2' | 'teams-3' | 'teams-4' | 'one-vs-all';

export type TeamId = 'red' | 'blue' | 'gold' | 'green' | 'boss' | 'squad';

export interface TeamSpec {
  id: TeamId;
  name: string;
  nameZh: string;
  shortName: string;
  shortNameZh: string;
  emoji: string;
  colorHex: string;
  darkHex: string;
  textColor: string;
}

export const TEAM_SPECS: Record<TeamId, TeamSpec> = {
  red: {
    id: 'red',
    name: 'Red Team',
    nameZh: '红队',
    shortName: 'RED',
    shortNameZh: '红队',
    emoji: '🔴',
    colorHex: '#FF4D2E',
    darkHex: '#B82E17',
    textColor: '#FFFFFF',
  },
  blue: {
    id: 'blue',
    name: 'Blue Team',
    nameZh: '蓝队',
    shortName: 'BLUE',
    shortNameZh: '蓝队',
    emoji: '🔵',
    colorHex: '#00C2FF',
    darkHex: '#007FA8',
    textColor: '#0B1219',
  },
  gold: {
    id: 'gold',
    name: 'Gold Team',
    nameZh: '金队',
    shortName: 'GOLD',
    shortNameZh: '金队',
    emoji: '🟡',
    colorHex: '#FFB800',
    darkHex: '#B58100',
    textColor: '#14120B',
  },
  green: {
    id: 'green',
    name: 'Green Team',
    nameZh: '绿队',
    shortName: 'GREEN',
    shortNameZh: '绿队',
    emoji: '🟢',
    colorHex: '#10D98B',
    darkHex: '#0A915D',
    textColor: '#071A12',
  },
  boss: {
    id: 'boss',
    name: 'The Boss',
    nameZh: '大魔王',
    shortName: 'BOSS',
    shortNameZh: '魔王',
    emoji: '👑',
    colorHex: '#FFB800',
    darkHex: '#B58100',
    textColor: '#14120B',
  },
  squad: {
    id: 'squad',
    name: 'Hero Squad',
    nameZh: '勇者小队',
    shortName: 'SQUAD',
    shortNameZh: '勇者',
    emoji: '🛡️',
    colorHex: '#00C2FF',
    darkHex: '#007FA8',
    textColor: '#0B1219',
  },
};

export interface TeamModeOption {
  id: TeamMode;
  icon: string;
  label: string;
  labelZh: string;
  shortLabel: string;
  shortLabelZh: string;
  hint: string;
  hintZh: string;
}

export const TEAM_MODE_OPTIONS: TeamModeOption[] = [
  {
    id: 'ffa',
    icon: '⚔️',
    label: 'Solo FFA',
    labelZh: '全员混战',
    shortLabel: 'FFA',
    shortLabelZh: '混战',
    hint: 'Every player for themselves',
    hintZh: '各自为战，个人积分争冠',
  },
  {
    id: 'teams-2',
    icon: '🔴',
    label: '2 Teams',
    labelZh: '双队对抗',
    shortLabel: '2 Teams',
    shortLabelZh: '红蓝2队',
    hint: 'Red vs Blue (2v2, 3v3, 4v4 or custom)',
    hintZh: '红队 vs 蓝队（支持 2v2、3v3、4v4 或自由分队）',
  },
  {
    id: 'teams-3',
    icon: '🔺',
    label: '3 Teams',
    labelZh: '三队混战',
    shortLabel: '3 Teams',
    shortLabelZh: '三队',
    hint: 'Red vs Blue vs Gold',
    hintZh: '红、蓝、金三方阵营混战',
  },
  {
    id: 'teams-4',
    icon: '🛡️',
    label: '4 Teams',
    labelZh: '四队争霸',
    shortLabel: '4 Teams',
    shortLabelZh: '四队',
    hint: 'Up to 4 Duos / Squads',
    hintZh: '最多 4 支双人小队同场争霸',
  },
  {
    id: 'one-vs-all',
    icon: '👑',
    label: '1 vs All',
    labelZh: '1 对 多',
    shortLabel: '1vAll',
    shortLabelZh: '1对多',
    hint: '1 Boss (1.25× score) vs Hero Squad average',
    hintZh: '1 名大魔王（1.25× 加成）迎战勇者小队均分',
  },
];

export function getTeamsForMode(mode: TeamMode): TeamId[] {
  switch (mode) {
    case 'teams-2':
      return ['red', 'blue'];
    case 'teams-3':
      return ['red', 'blue', 'gold'];
    case 'teams-4':
      return ['red', 'blue', 'gold', 'green'];
    case 'one-vs-all':
      return ['boss', 'squad'];
    default:
      return [];
  }
}

export function getTeamSpec(teamId?: TeamId | null): TeamSpec | null {
  if (!teamId) return null;
  return TEAM_SPECS[teamId] ?? null;
}

export interface TeamStanding {
  teamId: TeamId;
  name: string;
  nameZh: string;
  colorHex: string;
  darkHex: string;
  textColor: string;
  emoji: string;
  score: number;
  rawTotal: number;
  memberCount: number;
  memberIds: string[];
  rank: number;
}

export function computeTeamStandings(
  mode: TeamMode,
  members: { id: string; teamId: TeamId | null; score: number }[]
): TeamStanding[] {
  if (mode === 'ffa') return [];
  const validTeams = getTeamsForMode(mode);
  const grouped = new Map<TeamId, { ids: string[]; total: number }>();

  for (const m of members) {
    if (!m.teamId || !validTeams.includes(m.teamId)) continue;
    const entry = grouped.get(m.teamId) ?? { ids: [], total: 0 };
    entry.ids.push(m.id);
    entry.total += m.score;
    grouped.set(m.teamId, entry);
  }

  const activeGroups = [...grouped.entries()].filter(([, g]) => g.ids.length > 0);
  if (activeGroups.length === 0) return [];

  const maxMemberCount = Math.max(...activeGroups.map(([, g]) => g.ids.length));
  const minMemberCount = Math.min(...activeGroups.map(([, g]) => g.ids.length));
  const hasUnevenSizes = maxMemberCount !== minMemberCount;

  const standings: TeamStanding[] = activeGroups.map(([teamId, group]) => {
    const spec = TEAM_SPECS[teamId];
    let computedScore = group.total;
    if (mode === 'one-vs-all') {
      if (teamId === 'boss') {
        computedScore = Math.round(group.total * 1.25);
      } else {
        computedScore = Math.round(group.total / Math.max(1, group.ids.length));
      }
    } else if (hasUnevenSizes) {
      // Normalize uneven team sizes fairly so a 2v1 or 3v2 match stays balanced
      computedScore = Math.round((group.total / Math.max(1, group.ids.length)) * maxMemberCount);
    }

    return {
      teamId,
      name: spec.name,
      nameZh: spec.nameZh,
      colorHex: spec.colorHex,
      darkHex: spec.darkHex,
      textColor: spec.textColor,
      emoji: spec.emoji,
      score: computedScore,
      rawTotal: group.total,
      memberCount: group.ids.length,
      memberIds: group.ids,
      rank: 1,
    };
  });

  standings.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.rawTotal !== a.rawTotal) return b.rawTotal - a.rawTotal;
    return validTeams.indexOf(a.teamId) - validTeams.indexOf(b.teamId);
  });

  standings.forEach((st, idx) => {
    st.rank = idx + 1;
  });

  return standings;
}

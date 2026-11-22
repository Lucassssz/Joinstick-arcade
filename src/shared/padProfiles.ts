import type { GameId } from './types.ts';

export type ArcadePadMode = 'analog' | 'arrows' | 'trackpad';
export type PadMode = ArcadePadMode | 'card';
export type TrackpadMode = 'glide' | 'flick';
export type CardViewMode = 'auto' | 'fan' | 'grid';
export type CardSortMode = 'server' | 'playable' | 'rank';

export interface GamePadProfile {
  pad: PadMode;
  arrowsStrictFourWay?: boolean;
  preferAutoTap?: boolean;
  trackpadMode?: TrackpadMode;
  trackpadTapForA?: boolean;
  cardDefaultView?: 'fan' | 'grid';
  reasonEn: string;
  reasonZh: string;
}

const ANALOG_360 = (reasonEn: string, reasonZh: string, preferAutoTap = false): GamePadProfile => ({
  pad: 'analog',
  preferAutoTap,
  reasonEn,
  reasonZh,
});

const ARROWS_4WAY = (
  reasonEn: string,
  reasonZh: string,
  opts?: { strictFourWay?: boolean; preferAutoTap?: boolean }
): GamePadProfile => ({
  pad: 'arrows',
  arrowsStrictFourWay: opts?.strictFourWay ?? true,
  preferAutoTap: opts?.preferAutoTap ?? false,
  reasonEn,
  reasonZh,
});

const TRACKPAD = (
  trackpadMode: TrackpadMode,
  reasonEn: string,
  reasonZh: string,
  opts?: { tapForA?: boolean; preferAutoTap?: boolean }
): GamePadProfile => ({
  pad: 'trackpad',
  trackpadMode,
  trackpadTapForA: opts?.tapForA ?? false,
  preferAutoTap: opts?.preferAutoTap ?? false,
  reasonEn,
  reasonZh,
});

const CARD_PAD = (
  cardDefaultView: 'fan' | 'grid',
  reasonEn: string,
  reasonZh: string
): GamePadProfile => ({
  pad: 'card',
  cardDefaultView,
  reasonEn,
  reasonZh,
});

/**
 * Curated 106-Game Auto-Mapping Registry.
 * Every title automatically selects its most comfortable universal pad + sub-preset.
 */
export const GAME_PAD_PROFILES: Record<GameId, GamePadProfile> = {
  // === Core 48 Launch & Expansion Titles ===
  'bumper-brawl': ANALOG_360(
    '360° stick for smooth ring dodging & dashes',
    '360° 摇杆最适合走位闪避与冲撞'
  ),
  'astro-blaster': ANALOG_360(
    '360° twin-axis space steering & rapid shots',
    '360° 太空走位瞄准与连续射击',
    true
  ),
  'turbo-drift': ANALOG_360(
    'Smooth analog cornering & drift angles',
    '丝滑摇杆过弯与漂移控车'
  ),
  'hex-drop': ANALOG_360(
    'Free 360° sprinting across falling hexes',
    '六边形平台自由 360° 跑酷跳跃'
  ),
  'fuse-pass': ANALOG_360(
    'Quick 360° chase & bomb handoff movement',
    '灵活 360° 追逐传炸弹走位'
  ),
  'grid-runners': ARROWS_4WAY(
    'Crisp 4-way turns for Tron light-cycles',
    '干脆四向直角转向，零误触斜角'
  ),
  'ricochet-tanks': ANALOG_360(
    'Precision tank aiming & rebound angles',
    '精准坦克炮口瞄准与反弹走位'
  ),
  'turbo-striker': ANALOG_360(
    '360° soccer dribbling & curved power shots',
    '360° 足球盘带与射门控球'
  ),
  'paint-rush': ANALOG_360(
    'Fluid 360° arena territory painting',
    '全场自由旋转涂地走位'
  ),
  'laser-gauntlet': ANALOG_360(
    'Omni-directional dodging between laser beams',
    '全方向敏捷穿梭躲避激光'
  ),
  'vault-heist': ANALOG_360(
    'Smooth stealth movement & loot dash',
    '丝滑潜行搬运战利品'
  ),
  'hyper-pong': TRACKPAD(
    'glide',
    'Direct thumb glide for instant paddle defense',
    '滑控板精准跟手移动挡板'
  ),
  'blade-duel': ANALOG_360(
    '360° spacing & parry dashes',
    '精准剑斗走位与格挡突刺'
  ),
  'cannon-siege': TRACKPAD(
    'glide',
    'Smooth glide aiming & charged cannon power',
    '滑控板精准微调炮口瞄准'
  ),
  'crown-heist': ANALOG_360(
    '360° chase & snatch arena dodging',
    '360° 抢皇冠追逐走位'
  ),
  'freeze-tag': ANALOG_360(
    '360° sprinting, tagging & ally rescues',
    '全向冲刺抓人与解救队友'
  ),
  'ghost-hunt': ANALOG_360(
    '360° flashlight sweep & stealth turns',
    '360° 手电筒扫描与灵活转向'
  ),
  'meteor-swarm': ANALOG_360(
    'Agile 360° weaving through falling meteors',
    '全方向走位躲避陨石与拾取水晶'
  ),
  'hook-shot': ANALOG_360(
    'Accurate 360° hook aim across the chasm',
    '精准 360° 钩爪瞄准出钩'
  ),
  'gravity-flip': TRACKPAD(
    'glide',
    'Simple glide steer + giant flip trigger',
    '简易横向滑控 + 一键反转重力',
    { tapForA: true }
  ),
  'rich-street': ARROWS_4WAY(
    'Easy tap dice & labeled property buttons',
    '大按键一键掷骰与买卖地产',
    { strictFourWay: true }
  ),
  'jungle-ladders': ARROWS_4WAY(
    'Simple big dice & boost tap buttons',
    '超大简洁按键轻松掷骰爬梯',
    { strictFourWay: true }
  ),
  'bomb-grid': ARROWS_4WAY(
    'Exact 4-way grid steps for classic bomber alleys',
    '严格四向精准走格放炸弹，不怕走歪',
    { strictFourWay: true }
  ),
  'red-light-dash': ARROWS_4WAY(
    'Clear Hold/Stop sprint & freeze buttons',
    '大按钮干脆冲刺与急停冻住',
    { strictFourWay: false, preferAutoTap: true }
  ),
  'color-match': ANALOG_360(
    'Fast 360° sprint to safe color zones',
    '360° 快速冲刺抢占安全色块'
  ),
  'kitchen-rush': ANALOG_360(
    'Omni-directional station dashes & chopping',
    '全向灵活穿梭备菜与传菜'
  ),
  'treasure-dig': ARROWS_4WAY(
    'Clean 4-way grid digging & radar pulses',
    '清晰四向挖宝格步 + 大键探测',
    { strictFourWay: true }
  ),
  'fruit-drop': TRACKPAD(
    'glide',
    'Effortless basket glide along the floor',
    '左右滑控丝滑接住水果'
  ),
  'lucky-auction': ARROWS_4WAY(
    'Clear labeled bid & pass action buttons',
    '一目了然的大按键出价与竞拍',
    { strictFourWay: true }
  ),
  'pinball-clash': ARROWS_4WAY(
    'Crisp Left/Right flipper keys + plunger A',
    '左右明确大按键控制左右挡板'
  ),
  'color-clash': CARD_PAD(
    'fan',
    'Classic hand fan for quick color matching',
    '经典扇形手牌，颜色数字一眼出牌'
  ),
  'liars-deck': CARD_PAD(
    'fan',
    'Select & bluff cards with couch privacy cover',
    '经典扑克扇牌，支持防偷窥盖牌抓谎'
  ),
  'volley-smash': ANALOG_360(
    '360° court positioning & spike timing',
    '全向跑位接球与高空扣杀'
  ),
  'lava-hopper': ARROWS_4WAY(
    'Strict 4-way lane hops without diagonal slips',
    '严格四向单格跳跃，不偏离岩浆石板',
    { strictFourWay: true }
  ),
  'ludo-royale': ARROWS_4WAY(
    'Simple arrows pick pieces + big dice button',
    '方向键选棋 + 大按钮掷骰子',
    { strictFourWay: true }
  ),
  'star-party-board': ARROWS_4WAY(
    'Clear board branching arrows + roll button',
    '清晰方向选路 + 掷骰大按键',
    { strictFourWay: true }
  ),
  'reversi-clash': ARROWS_4WAY(
    'Step-by-step board cursor with zero overshoot',
    '黑白棋格步精准移动不越格',
    { strictFourWay: true }
  ),
  'four-in-a-row': ARROWS_4WAY(
    'One column per tap for exact disc drops',
    '左右按一下精准换一列落子',
    { strictFourWay: true }
  ),
  'naval-salvo': ARROWS_4WAY(
    'Exact radar grid targeting cell by cell',
    '海战坐标逐格精准锁定发射',
    { strictFourWay: true }
  ),
  'neon-checkers': ARROWS_4WAY(
    'Clean square cursor + labeled jump action',
    '跳棋格位清晰点选与跳跃',
    { strictFourWay: true }
  ),
  'carrom-arena': TRACKPAD(
    'glide',
    'Precision glide aiming & striker power trigger',
    '滑控板精准拉线瞄准击打克朗棋'
  ),
  'dungeon-crawl-board': ARROWS_4WAY(
    'Clean tile-by-tile dungeon movement & strike',
    '地牢战棋逐格移动与清晰攻击按键',
    { strictFourWay: true }
  ),
  'boom-kittens': CARD_PAD(
    'fan',
    'Fast action cards with quick skip & diffuse',
    '扇形手牌快速拆弹与跳过'
  ),
  'property-deal': CARD_PAD(
    'grid',
    'Grid layout keeps properties & action sets organized',
    '网格视图清晰查看所有地契与功能牌'
  ),
  'flip-seven': CARD_PAD(
    'fan',
    'Quick Hit or Stay decisions at a glance',
    '清晰翻牌加注与稳守结算'
  ),
  'royal-bluff': CARD_PAD(
    'fan',
    'Use Privacy Shield when bluffing roles nearby',
    '支持防偷窥遮罩，密谋身份不怕看'
  ),
  'dark-flip-clash': CARD_PAD(
    'fan',
    'Dual-side hand fan with bright playable glow',
    '高亮可出牌提示，暗黑翻面大逆转'
  ),
  'sushi-draft': CARD_PAD(
    'grid',
    'Grid layout compares every sushi dish clearly',
    '网格铺开手牌轻松挑选最佳寿司组合'
  ),

  // === Pack 1: 10 Malaysian Traditional & Tabletop Classics ===
  'line-breakers': ANALOG_360(
    '360° jukes & feints across guard lines',
    '360° 灵巧假动作冲破过五关防线'
  ),
  'desk-flippers': TRACKPAD(
    'glide',
    'Precision angle aiming + power flick launch',
    '滑控瞄准擦子角度与蓄力弹射'
  ),
  'spin-clash': ANALOG_360(
    'Smooth 360° gyro top steering & clash spin',
    '360° 陀螺撞击走位与加速旋转'
  ),
  'marble-ring': TRACKPAD(
    'glide',
    'Steady finger aiming to knock ring marbles',
    '手指滑控精准瞄准弹珠出圈'
  ),
  'rattan-volley': ANALOG_360(
    '360° footwork for acrobatic sepak takraw kicks',
    '360° 跑位接藤球凌空倒钩'
  ),
  'step-stomp': ARROWS_4WAY(
    'Crisp hop-timing arrows & labeled kick button',
    '大箭头跳格子 + 清晰踢石按键',
    { strictFourWay: true }
  ),
  'pit-harvest': ARROWS_4WAY(
    'Tap Left/Right between congkak houses cleanly',
    '左右按格精准挑选播棋洞口',
    { strictFourWay: true }
  ),
  'big-two-royale': CARD_PAD(
    'grid',
    'Grid view makes 13-card Chor Dai Di combos effortless',
    '网格模式一览 13 张锄大地手牌，顺子对子更好组'
  ),
  'lucky-21': CARD_PAD(
    'fan',
    'Clear Hit / Stand / Double triggers for 21点',
    '21 点清晰要牌/停牌/加倍大按钮'
  ),
  'ten-pair-showdown': CARD_PAD(
    'grid',
    'Grid shows every tile pair for instant 牛牛 / 10-point matching',
    '网格一眼配对 10 点组合，算牛更快'
  ),

  // === Pack 2: 16 Chinese Viral & Party Hits ===
  'melon-merge': TRACKPAD(
    'glide',
    'Slide dropper smoothly to stack fruits precisely',
    '滑控板精准对准水果落点合成大西瓜'
  ),
  'tile-triple': TRACKPAD(
    'flick',
    'Swipe & tap tiles effortlessly across layers',
    '轻量滑控快速消除三连牌块',
    { tapForA: true }
  ),
  'block-hop': TRACKPAD(
    'glide',
    'Press & hold right trigger for jump-charge distance',
    '大扳机按住蓄力跳一跳，手感更稳',
    { tapForA: true }
  ),
  'platform-leap': ARROWS_4WAY(
    'Simple Left/Right tap movement down 100 floors',
    '是男人就下一百层：左右大键精准落台',
    { strictFourWay: true }
  ),
  'egg-rush': ANALOG_360(
    '360° eggy obstacle racing, dives & bumps',
    '蛋仔 360° 跑酷滚蛋撞击过关'
  ),
  'goose-alert': ANALOG_360(
    '360° ship roaming, tasks & meeting calls',
    '太空杀 360° 全图巡逻做任务与报警'
  ),
  'hotpot-rush': ANALOG_360(
    'Fast 360° dash between hotpot tables & broth',
    '全向跑动捞菜端锅手忙脚乱'
  ),
  'claw-mania': TRACKPAD(
    'glide',
    'Smooth precision glide over plushies + drop trigger',
    '滑控精准对准抓娃娃坐标 + 下爪扳机'
  ),
  'truth-bomb': ARROWS_4WAY(
    'Simple clear choice buttons for quick reactions',
    '超大选项按键快速作答真心话炸弹',
    { strictFourWay: true }
  ),
  'draw-guess-relay': TRACKPAD(
    'glide',
    'Natural finger canvas glides just like drawing',
    '滑控板就像手绘画板一样顺滑画画'
  ),
  'landlord-clash': CARD_PAD(
    'grid',
    'Grid organizes bombs, rockets & 17-card Landlord hands',
    '斗地主网格排牌，炸弹飞机连对一目了然'
  ),
  'speed-mahjong': CARD_PAD(
    'grid',
    'Grid aligns 14 Mahjong tiles for instant Pong/Chow/Hu',
    '麻将网格铺开 14 张牌，碰吃杠胡快人一步'
  ),
  'liars-dice-tavern': CARD_PAD(
    'fan',
    'Use Privacy Shield to hide your secret dice cup',
    '大话骰支持防偷窥遮罩，守住你的暗骰'
  ),
  'undercover-word': CARD_PAD(
    'fan',
    'Hold-to-Peek protects your secret Who-is-Spy word',
    '谁是卧底长按看词防偷窥，松手即遮'
  ),
  'midnight-werewolf': CARD_PAD(
    'fan',
    'Keep night roles private with Hold-to-Peek shield',
    '狼人杀身份卡片长按保密，闭眼阶段不露馅'
  ),
  'idiom-chain': CARD_PAD(
    'grid',
    'Grid displays every idiom character clearly to tap',
    '成语网格清晰大字排布，接龙更快'
  ),

  // === Pack 3: 16 Global & English Viral Internet Hits ===
  'sky-climb': ANALOG_360(
    '360° air control & ledge grabs climbing upward',
    'Only Up 360° 空中微调落点与抓边攀登'
  ),
  'slither-feast': ANALOG_360(
    'Fluid 360° serpent steering & turbo cutoffs',
    '贪吃蛇 360° 丝滑绕圈加速拦截'
  ),
  'blob-devour': ANALOG_360(
    'Smooth 360° cell movement & split-eject combos',
    '球球大作战 360° 走位分身吐球'
  ),
  'turf-ribbon': ANALOG_360(
    'Agile 360° ribbon loops to claim safe territory',
    'Paper.io 灵活绕圈圈地与防断尾'
  ),
  'glass-bridge': ARROWS_4WAY(
    'Clear Left / Right pane arrows + jump confirm',
    '玻璃桥左右大箭头精准选格跳跃',
    { strictFourWay: true }
  ),
  'tug-titan': ARROWS_4WAY(
    'Giant button + Auto-Tap friendly for tug pulling',
    '拔河巨型按键 + 支持自动连点不累手',
    { strictFourWay: true, preferAutoTap: true }
  ),
  'flappy-flock': TRACKPAD(
    'glide',
    'Tap anywhere on trackpad or hit giant A to flap',
    '点触滑控区或大扳机轻松振翅飞翔',
    { tapForA: true }
  ),
  'dino-dash': TRACKPAD(
    'glide',
    'Wide trackpad tap jumps; side B trigger ducks',
    '轻点滑控区起跳，侧边 B 键低头俯冲',
    { tapForA: true }
  ),
  'tile-2048-blitz': TRACKPAD(
    'flick',
    'Instant 4-way swipe flicks feel native to 2048',
    '四向滑屏手势合并 2048 方块最顺手'
  ),
  'mine-sweep-duel': ARROWS_4WAY(
    'Exact cell-by-cell arrows + Reveal / Flag buttons',
    '扫雷逐格方向步进 + 清晰翻开/插旗键',
    { strictFourWay: true }
  ),
  'geo-pin-rush': TRACKPAD(
    'glide',
    'Mouse-smooth map crosshair glide + Lock Pin',
    '滑控板如鼠标般顺滑定位世界地图钉'
  ),
  'wavelength-sync': TRACKPAD(
    'glide',
    'Silky analog-smooth spectrum needle sliding',
    '滑控板微调心灵波长指针刻度'
  ),
  'word-pulse': CARD_PAD(
    'grid',
    'Grid lays out Wordle letter tiles cleanly',
    'Wordle 字母网格清晰拼词不挡手'
  ),
  'trivia-blitz': CARD_PAD(
    'grid',
    'Large 4-color Kahoot-style answer tiles',
    '大块彩色选项按钮快问快答抢积分'
  ),
  'codenames-grid': CARD_PAD(
    'grid',
    'Grid mirrors the 5×5 Spymaster word board',
    '行动代号网格与大屏词汇矩阵一一对应'
  ),
  'fib-party': CARD_PAD(
    'grid',
    'Easy grid cards for writing & voting bluffs',
    '大卡片轻松点选真假线索与投票'
  ),

  // === Pack 4: 16 Retro Arcade & Classic Skill Hits ===
  'maze-chomper': ARROWS_4WAY(
    'Strict 4-way corridor turns — zero stuck corners',
    '吃豆人严格四向拐弯，不错过任何迷宫路口',
    { strictFourWay: true }
  ),
  'brick-clash': TRACKPAD(
    'glide',
    '1:1 smooth thumb glide controls the breaker paddle',
    '跟手横滑精准接住打砖块弹球'
  ),
  'alien-wave': ARROWS_4WAY(
    'Clean Left/Right ship steps + Auto-Tap laser fire',
    '小蜜蜂左右移动 + 支持自动连发炮火',
    { strictFourWay: true, preferAutoTap: true }
  ),
  'block-stack': ARROWS_4WAY(
    'Zero accidental hard-drops with strict 4-way arrows',
    '俄罗斯方块严格四向移动旋转，绝不误触速降',
    { strictFourWay: true }
  ),
  'frog-crossing': ARROWS_4WAY(
    'Crisp 1-lane-per-tap hopping across traffic',
    '青蛙过河按一下跳一格，车流穿行最精准',
    { strictFourWay: true }
  ),
  'barrel-tower': ARROWS_4WAY(
    'Clean ladder climbs & clear Jump over barrels',
    '大金刚精准上梯 + 大按钮跳跃滚桶',
    { strictFourWay: true }
  ),
  'whack-blitz': ARROWS_4WAY(
    'Fast 4-way hammer arrows + Auto-Tap smash',
    '打地鼠四向快锤 + 大按钮连击',
    { strictFourWay: true, preferAutoTap: true }
  ),
  'rhythm-pulse': ARROWS_4WAY(
    'Classic arcade directional arrow buttons match beat lanes',
    '劲舞音游大箭头完美对应节拍轨道',
    { strictFourWay: false }
  ),
  'clay-skeet': TRACKPAD(
    'glide',
    'Fast crosshair tracking across flying clay targets',
    '滑控准星快速追踪飞碟开火'
  ),
  'air-hockey-neo': TRACKPAD(
    'glide',
    'Natural air-hockey mallet glide & bank slapshot',
    '桌球气垫滑控击打冰球最具手感'
  ),
  'skee-roll': TRACKPAD(
    'glide',
    'Aim lane smoothly and launch up the ramp',
    '滑控对准得分洞口顺势推球'
  ),
  'stack-tower': TRACKPAD(
    'glide',
    'Tap anywhere on pad for frame-perfect block drops',
    '随时轻点大面域实现像素级叠高锁定',
    { tapForA: true }
  ),
  'tunnel-dig': ARROWS_4WAY(
    'Strict 4-way grid tunneling + pump/harpoon A',
    '挖地道严格四向直角挖掘 + 大键充气攻击',
    { strictFourWay: true }
  ),
  'bubble-pop-arc': TRACKPAD(
    'glide',
    'Precision continuous launcher angle aiming',
    '滑控微调泡泡龙发射角度精确反弹'
  ),
  'pin-strike': TRACKPAD(
    'glide',
    'Line up bowling aim & flick/trigger roll',
    '保龄球滑控对准球瓶轨道顺滑滚出'
  ),
  'coin-dozer': ARROWS_4WAY(
    'Left/Right pusher slot arrows + Auto-Tap coin drops',
    '推币机左右定位 + 自动连投金币不累手',
    { strictFourWay: true, preferAutoTap: true }
  ),

  // === Pack 5: 14 Sports & Physics Showdowns ===
  'hoop-blitz': TRACKPAD(
    'glide',
    'Smooth arc aiming + hold SHOOT trigger cleanly',
    '滑控微调三分弧线 + 按住出手更精准'
  ),
  'penalty-duel': TRACKPAD(
    'glide',
    'Slide crosshair straight into top corners + fire',
    '滑控直接瞄准球门死角射门'
  ),
  'mini-golf-pro': TRACKPAD(
    'glide',
    'Precision 360° putter aiming & power charge',
    '滑控微调推杆角度与蓄力击球'
  ),
  'archery-wind': TRACKPAD(
    'glide',
    'Thumb crosshair glide beats crosswind drift effortlessly',
    '滑控准星精准补偿风偏直击金靶心'
  ),
  'boxing-ko': ARROWS_4WAY(
    'Crisp footwork steps + clear HOOK & GUARD triggers',
    '干脆步法走位 + 清晰大键重拳与格挡',
    { strictFourWay: false }
  ),
  'ping-pong-pro': TRACKPAD(
    'glide',
    '1:1 paddle glide across the table edge + SMASH trigger',
    '跟手横向滑控接球 + 扣杀大扳机'
  ),
  'home-run-derby': ARROWS_4WAY(
    'Quick batter-box adjustment + crisp timing SWING button',
    '简洁打击站位调整 + 精准时机大键挥棒',
    { strictFourWay: true }
  ),
  'dodgeball-riot': ANALOG_360(
    '360° arena dodging, throwing & clutch catches',
    '360° 场地奔跑躲球、暴砸与空手夺球'
  ),
  'sumo-clash': ANALOG_360(
    '360° heavy sumo positioning, belly rams & stomps',
    '360° 土俵周旋、铁山靠冲撞与震地'
  ),
  'canoe-sprint': ARROWS_4WAY(
    'Left/Right slalom steering + Auto-Tap PADDLE friendly',
    '左右掌舵穿门 + 支持自动连点划桨冲刺',
    { strictFourWay: true, preferAutoTap: true }
  ),
  'disc-arena': ANALOG_360(
    '360° Windjammers court defense & angled curve throws',
    '360° 接盘扑救并带斜角甩出弧线飞盘'
  ),
  'badminton-smash': ARROWS_4WAY(
    'Fast Left/Right footwork + big SMASH & CLEAR buttons',
    '左右快速步法 + 干脆起跳扣杀与挑高按键',
    { strictFourWay: false }
  ),
  'billiards-snooker': TRACKPAD(
    'glide',
    'Precision pool-cue angle aiming & smooth power break',
    '滑控精细瞄准台球入袋角度并蓄力出杆'
  ),
  'tether-joust': ANALOG_360(
    '360° knight steering for flank lance lunges & parries',
    '360° 骑士转向绕后突刺与举盾格挡'
  ),

  // === Pack 6: 15 Chaos Party & Survival Games ===
  'laser-jump-rope': TRACKPAD(
    'glide',
    'Ring positioning + tap anywhere on pad to hop lasers',
    '滑控走位 + 轻点滑控区随时起跳跃过激光',
    { tapForA: true }
  ),
  'hot-lava-floor': ANALOG_360(
    '360° island sprinting, magma hops & edge shoves',
    '360° 跨岛奔跑、跳跃躲岩浆与边缘推撞'
  ),
  'bomb-tag-arena': ANALOG_360(
    'Fast 360° chase & last-second bomb handoffs',
    '360° 极速追逃与压哨传弹撞击'
  ),
  'musical-thrones': ANALOG_360(
    'Smooth 360° ring orbiting & instant pod dives',
    '360° 绕圈走位与座椅亮起飞扑抢座'
  ),
  'sumo-ice-drift': ANALOG_360(
    'Continuous 360° counter-steering on slippery glacier ice',
    '360° 冰面惯性反拉控向与滑铲撞飞'
  ),
  'meteor-dodge-x': ANALOG_360(
    'Agile 360° weaving around expanding meteor shadows',
    '360° 灵活穿梭避开红色陨石预警圈'
  ),
  'king-of-hill-neo': ANALOG_360(
    '360° zone tracking & radial blasts to clear rivals',
    '360° 紧跟移动皇冠圈并将竞争者轰出场外'
  ),
  'laser-maze-heist': ANALOG_360(
    '360° stealth weaving between rotating vault lasers',
    '360° 潜行穿行旋转红外线狂抢钻石'
  ),
  'zombie-outbreak': ANALOG_360(
    '360° quarantine sprinting, cure hunts & zombie lunges',
    '360° 跑酷逃生抢解药或化身丧尸飞扑猎杀'
  ),
  'falling-anvils': ANALOG_360(
    '360° shadow dodging & sneaky rival shoves',
    '360° 灵巧躲避铁砧黑影并推好友进坑'
  ),
  'seesaw-balance': ARROWS_4WAY(
    'Clean Left/Right plank balance + big STOMP & GRIP triggers',
    '清晰左右配重平衡 + 超大重踏与防滑锚定键',
    { strictFourWay: true }
  ),
  'chain-gang-climb': ANALOG_360(
    '360° canyon weaving & elastic tether yanks past saws',
    '360° 绕开旋转电锯并用能量链牵引冲刺'
  ),
  'confetti-capture': ANALOG_360(
    '360° turf painting & explosive paint-bomb sweeps',
    '360° 全场涂色奔跑与彩弹范围爆破抢地盘'
  ),
  'crane-drop-chaos': ANALOG_360(
    '360° rooftop dodging around sweeping wrecking balls',
    '360° 屋顶灵活躲避横扫大铁球'
  ),
  'roulette-arena': ANALOG_360(
    'Fast 360° scrambling off blinking red trapdoors',
    '360° 极速逃离闪红地板抢占安全绿格'
  ),

  // === Pack 7: 15 Strategy Board & Card Classics ===
  'gomoku-blitz': ARROWS_4WAY(
    'Exact 4-way Gomoku grid steps without diagonal slips',
    '五子棋格位严格四向步进，落子绝不点偏',
    { strictFourWay: true }
  ),
  'chess-blitz': ARROWS_4WAY(
    'Crisp 4-way square aiming for Knight hops & Queen dashes',
    '国际象棋棋格四向精准锁定，骑士跳跃吃子更稳',
    { strictFourWay: true }
  ),
  'domino-chain': ARROWS_4WAY(
    'Left/Right domino rack picking + crisp Play & Draw keys',
    '左右精准挑选多米诺骨牌 + 大键接龙换牌',
    { strictFourWay: true }
  ),
  'hexagon-conquest': ARROWS_4WAY(
    'Clean honeycomb grid stepping + Claim & Flip shockwaves',
    '六角蜂巢棋盘清晰步进占格与范围翻转',
    { strictFourWay: true }
  ),
  'backgammon-sprint': ARROWS_4WAY(
    'Left/Right runner selection + one-tap Roll & Double',
    '左右挑选双陆棋道 + 大键一键掷骰推进',
    { strictFourWay: true }
  ),
  'mancala-jewels': ARROWS_4WAY(
    'Simple Left/Right pit selector + one-tap Gem Sowing',
    '左右轻松点选翡翠宝石孔 + 一键播种收割',
    { strictFourWay: true }
  ),
  'curling-masters': TRACKPAD(
    'glide',
    '1:1 thumb glide lane aiming + Hold-to-Slide stone release',
    '滑控板 1:1 横向精准定道 + 按住蓄力推出冰壶'
  ),
  'rummy-royale': CARD_PAD(
    'grid',
    'Grid View lets you spot 3-card sets & suited runs at a glance',
    '网格牌台一眼看清三条刻子与同花顺组合'
  ),
  'hearts-breaker': CARD_PAD(
    'fan',
    'Secret arched hand fan + couch privacy cover to dodge Q♠',
    '扇形私密手牌搭配防偷窥盖牌，灵活避开黑桃Q'
  ),
  'spades-bidding': CARD_PAD(
    'fan',
    'Classic trump-spade hand fan for quick trick timing',
    '经典黑桃将牌扇形手牌，把握时机出牌赢墩'
  ),
  'poker-showdown': CARD_PAD(
    'fan',
    'Private 5-card fan with multi-select redraw & Privacy Shield',
    '私密五张扑克扇牌，支持多选换牌与防偷窥保护'
  ),
  'tarot-arcana': CARD_PAD(
    'fan',
    'Secret elemental hand fan keeps Fire/Frost/Nature hidden',
    '私密元素手牌完美隐藏火冰木出招心理博弈'
  ),
  'baccarat-club': CARD_PAD(
    'fan',
    'Pick any 2 private cards from your fan toward Natural 9',
    '私密扇形手牌任选两张凑近天生 9 点亮牌'
  ),
  'memory-pairs': CARD_PAD(
    'grid',
    '12-card interactive grid matches the TV memory board layout',
    '12 格扑克网格直接对应 TV 翻牌矩阵秒速配对'
  ),
  'sequence-jack': CARD_PAD(
    'grid',
    'Grid view makes scanning matching board coordinates effortless',
    '网格牌台方便快速对照棋盘数字格落子连线'
  ),
};

export function getGamePadProfile(gameId: GameId): GamePadProfile {
  return (
    GAME_PAD_PROFILES[gameId] ?? {
      pad: 'analog',
      reasonEn: 'Universal 360° analog stick + dual buttons',
      reasonZh: '通用 360° 摇杆双按键手柄',
    }
  );
}

export interface PadTutorialGuide {
  pad: PadMode;
  padNumber: 1 | 2 | 3 | 4;
  padTitle: string;
  padShortLabel: string;
  presetTag: string;
  accentHex: string;
  tutorialText: string;
  shortTutorial: string;
  whyText: string;
}

export function getPadTutorialGuide(gameId: GameId, lang: 'en' | 'zh'): PadTutorialGuide {
  const profile = getGamePadProfile(gameId);
  const zh = lang === 'zh';
  const whyText = zh ? profile.reasonZh : profile.reasonEn;

  if (profile.pad === 'arrows') {
    const strict = profile.arrowsStrictFourWay !== false;
    const autoTap = !!profile.preferAutoTap;
    const presetTag =
      strict && autoTap
        ? zh
          ? '严格四向 + 自动连点'
          : '4-Way Lock · Auto-Tap'
        : strict
          ? zh
            ? '严格四向锁定'
            : '4-Way Lock'
          : autoTap
            ? zh
              ? '八向 + 自动连点'
              : '8-Way · Auto-Tap'
            : zh
              ? '八向大箭头'
              : '8-Way Arrows';

    return {
      pad: 'arrows',
      padNumber: 2,
      padTitle: zh ? '2号 · 简易大箭头' : 'Pad 2 · Easy Arrows',
      padShortLabel: zh ? '2号 · 大箭头' : 'Pad 2 · Easy Arrows',
      presetTag,
      accentHex: '#FFB800',
      shortTutorial: strict
        ? zh
          ? '点按左侧大号上下左右箭头精准步进（四向锁防误触），右侧大键按 A / B 操作。'
          : 'Tap crisp Up/Down/Left/Right keys for exact steps (4-Way Lock), plus big A & B buttons.'
        : zh
          ? '点击大号方向键灵活走位（支持双键斜向），搭配右侧大按键 A / B 触发技能。'
          : 'Tap big directional arrows (diagonals supported) and press oversized A & B buttons.',
      tutorialText: strict
        ? zh
          ? '左手点击清晰大号上下左右方向键，已默认锁定四向绝不误触斜角（最适合棋盘走格与跑道）；右手点按超大 A / B 按键完成落子、掷骰或动作。'
          : 'Tap the large Up/Down/Left/Right keys on the left—4-Way Lock prevents accidental diagonal slips on grids & lanes. Press the oversized A & B buttons on the right to act.'
        : zh
          ? '左手点按或长按大号方向键控制走位（同时按两向可走斜角），右手点击 A / B 大键释放技能；支持开启 Auto-Tap 自动连点省力快打。'
          : 'Tap or hold the large directional buttons on the left (press two adjacent keys for diagonals) and use the big A & B triggers on the right.',
      whyText,
    };
  }

  if (profile.pad === 'trackpad') {
    const isFlick = profile.trackpadMode === 'flick';
    const tapA = !!profile.trackpadTapForA;
    const presetTag =
      isFlick && tapA
        ? zh
          ? '快甩模式 + 轻点=A'
          : 'Flick + Tap=A'
        : isFlick
          ? zh
            ? '快甩爆发模式'
            : 'Flick Mode'
          : tapA
            ? zh
              ? '1:1 滑控 + 轻点=A'
              : 'Glide + Tap=A'
            : zh
              ? '1:1 跟手滑控'
              : 'Glide Mode';

    return {
      pad: 'trackpad',
      padNumber: 3,
      padTitle: zh ? '3号 · 触控滑板' : 'Pad 3 · Swipe Pad',
      padShortLabel: zh ? '3号 · 触控滑板' : 'Pad 3 · Swipe Pad',
      presetTag,
      accentHex: '#FF3B9A',
      shortTutorial: isFlick
        ? zh
          ? '在左侧触控滑板朝目标快速甩滑发力，配合右侧 A / B 按键出招。'
          : 'Swipe briskly across the touch pad to flick & launch; tap A / B for actions.'
        : tapA
          ? zh
            ? '在触控滑板上拖动拇指跟手走位/瞄准，轻点滑板任意位置可直接触发 A 键！'
            : 'Drag your thumb on the pad to steer/aim 1:1, and tap anywhere on the pad to trigger A!'
          : zh
            ? '在触控滑板上拖动拇指 1:1 跟手瞄准或移动挡板，右侧按 A / B 蓄力或击发。'
            : 'Glide your thumb across the touch pad for 1:1 aiming or sliding, plus A & B buttons.',
      tutorialText: isFlick
        ? zh
          ? '快甩模式：在左侧触控滑板上朝目标方向快速甩动手指即可给出方向与速度爆发，松手再甩可连续发力，右手 A / B 按钮释放蓄力或辅助技。'
          : 'Flick Mode: Swipe briskly across the left trackpad to throw, launch, or dash in that exact angle; lift and swipe again for bursts, with A & B buttons on the right.'
        : tapA
          ? zh
            ? '跟手滑控 + 轻点=A：在左侧触控滑板内滑动拇指即可 1:1 跟手微调位置或准星，直接轻点一下滑板（或按右侧 A 键）就能瞬发跳跃/翻转！'
            : 'Glide + Tap=A: Drag your thumb anywhere inside the touch pad for smooth 1:1 positioning or aiming, and simply tap the pad surface (or press A) for instant jumps/flips.'
          : zh
            ? '跟手滑控模式：把拇指放在左侧触控滑板上顺滑拖动即可 1:1 精准控位或微调瞄准角度，右侧超大 A / B 扳机用于蓄力、挥击或释放技能。'
            : 'Glide Mode: Rest and slide your thumb anywhere on the left trackpad for smooth 1:1 aiming or paddle control, then tap or hold the right-side A & B buttons.',
      whyText,
    };
  }

  if (profile.pad === 'card') {
    const isGrid = profile.cardDefaultView === 'grid';
    return {
      pad: 'card',
      padNumber: 4,
      padTitle: zh ? '4号 · 扑克/桌面手牌' : 'Pad 4 · Card Table',
      padShortLabel: zh ? '4号 · 私密牌桌' : 'Pad 4 · Card Table',
      presetTag: isGrid ? (zh ? '网格牌台 · 防偷窥' : 'Grid View · Privacy') : zh ? '扇形手牌 · 防偷窥' : 'Fan View · Privacy',
      accentHex: '#10D98B',
      shortTutorial: isGrid
        ? zh
          ? '在手机私密网格直接点选卡牌打出或翻开，顶部支持排序与防偷窥遮罩。'
          : 'Tap cards in your private Grid to select or flip directly on your phone (with Sort & Privacy Shield).'
        : zh
          ? '浏览手机扇形私密手牌，点选卡牌并用底部大键出牌，可开启防偷窥遮罩。'
          : 'Pick cards from your private Hand Fan, tap bottom action keys to play, and toggle Privacy Shield.',
      tutorialText: isGrid
        ? zh
          ? '私密网格牌台：你的手牌/选项仅在个人手机展示。直接在网格点击选牌或翻牌，可用顶部 Sort 排序整理，按下底部彩色大键打出至大屏或开启防偷窥遮罩。'
          : 'Private Card Grid: Secret cards appear only on your phone in a clean grid. Tap cards to select or flip, use Sort to organize quickly, and press the action buttons or Privacy Shield anytime.'
        : zh
          ? '私密扇形手牌：你的手牌只会在自己手机显示！在扇形手牌点击卡牌选中预览，按下底部彩色动作键拍上 TV 牌桌，沙发聚会还可随时点「防偷窥遮罩」遮挡手牌。'
          : 'Private Card Fan: Your secret hand lives exclusively on your phone. Tap cards in the arched fan to select, press the bottom action buttons to submit to the TV table, and toggle Privacy Shield during couch play.',
      whyText,
    };
  }

  const autoTap = !!profile.preferAutoTap;
  return {
    pad: 'analog',
    padNumber: 1,
    padTitle: zh ? '1号 · 360° 摇杆' : 'Pad 1 · Pro Stick',
    padShortLabel: zh ? '1号 · 360° 摇杆' : 'Pad 1 · Pro Stick',
    presetTag: autoTap ? (zh ? '360° + 自动连点' : '360° + Auto-Tap') : zh ? '360° 全向摇杆' : '360° Analog',
    accentHex: '#00C2FF',
    shortTutorial: autoTap
      ? zh
        ? '左拇指自由滑动 360° 摇杆走位瞄准，右侧 A / B 出招（支持开启自动连点）。'
        : 'Slide the 360° left stick to steer/aim, tap A & B (Auto-Tap supported for rapid action).'
      : zh
        ? '左拇指滑动 360° 摇杆全向走位或瞄准，右手点击大按键 A / B 触发技能。'
        : 'Slide the 360° left thumbstick to move or aim smoothly, and press A or B on the right.',
    tutorialText: autoTap
      ? zh
        ? '左手在 360° 摇杆圈内任意方向拖动即可丝滑走位与瞄准；右手点按 A / B 触发攻击或冲刺，也可在顶部一键开启自动连点省力连发。'
        : 'Drag your left thumb inside the 360° analog ring to move and aim smoothly. Press A & B on the right—or toggle Auto-Tap for effortless rapid fire.'
      : zh
        ? '左手在 360° 摇杆区自由滑动控制全方位移动、漂移或瞄准；右手点击大号 A / B 按键完成冲刺、攻击、跳跃或防御动作。'
        : 'Drag your left thumb anywhere on the 360° analog ring to move, steer, or aim in any direction. Tap or hold the right-side A and B buttons to act.',
    whyText,
  };
}


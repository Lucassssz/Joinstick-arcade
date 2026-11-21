import type { GameId, GameMetadata, PlayerFilterMode } from './types.ts';

export const PLAYER_FILTER_OPTIONS: {
  id: PlayerFilterMode;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'all', label: 'All Games', shortLabel: 'All' },
  { id: 'solo', label: 'Solo (1P)', shortLabel: 'Solo · 1P' },
  { id: 'double', label: 'Double (2P)', shortLabel: '2 Players' },
  { id: 'multiplayer', label: 'Multiplayer (3+)', shortLabel: '3+ Players' },
];

/**
 * Modular Game Catalog Registry.
 * To add a new multiplayer game to JoinStick Arcade:
 * 1. Add its metadata & controllerSchema entry here.
 * 2. Implement its authoritative ServerGameModule in server/games/.
 * 3. Add its canvas renderer in src/games/renderers.ts.
 */
export const GAME_CATALOG: GameMetadata[] = [
  {
    id: 'bumper-brawl',
    name: 'Bumper Brawl',
    category: 'Arena Sumo',
    tagline: 'Knock rivals off the shrinking steel ring.',
    description:
      'Ram opponents out of bounds with momentum dashes and radial shockwaves while the arena floor closes in.',
    minPlayers: 1,
    maxPlayers: 8,
    suitableFor: ['double', 'multiplayer'],
    playerModeLabel: '2P · 3–8P',
    coverImage: '/src/assets/images/game_bumper_brawl_1795251971302.jpg',
    accentHex: '#FF4D2E',
    rules: [
      'Steer with the left thumbstick to build arena momentum.',
      'Hit Dash to ram rivals with heavy knockback force.',
      'Trigger Pulse to blast nearby contenders away from you.',
      'Stay inside the shrinking hazard ring — last standing wins the round.',
    ],
    controllerSchema: {
      joystickMode: 'analog-360',
      joystickLabel: 'Move',
      actionA: {
        label: 'DASH',
        sublabel: 'Ram Surge',
        colorHex: '#FF4D2E',
        darkHex: '#B82E17',
        textColor: '#FFFFFF',
        icon: 'zap',
      },
      actionB: {
        label: 'PULSE',
        sublabel: 'Shockwave',
        colorHex: '#FFB800',
        darkHex: '#B58100',
        textColor: '#14120B',
        icon: 'waves',
      },
      controlTip: 'Combine Dash + Pulse near the edge to launch rivals out.',
    },
    settingLabel: 'Rounds',
    settingOptions: [
      { label: '3 Rounds', value: 3 },
      { label: '5 Rounds', value: 5 },
      { label: '1 Quick Round', value: 1 },
    ],
    defaultSetting: 3,
  },
  {
    id: 'astro-blaster',
    name: 'Astro Blaster',
    category: 'Space Dogfight',
    tagline: 'Weave through asteroids and outgun every pilot.',
    description:
      'High-speed zero-gravity dogfights with plasma cannons, shield cores, rapid-fire pickups, and afterburner evasions.',
    minPlayers: 1,
    maxPlayers: 8,
    suitableFor: ['double', 'multiplayer'],
    playerModeLabel: '2P · 3–8P',
    coverImage: '/src/assets/images/game_astro_blaster_1795251972156.jpg',
    accentHex: '#00C2FF',
    rules: [
      'Aim and fly in 360 degrees with the analog joystick.',
      'Tap or hold Fire to launch rapid plasma bolts.',
      'Hit Boost for an afterburner dodge through crossfire.',
      'Grab Shield and Rapid-Fire cores — highest score when time expires wins.',
    ],
    controllerSchema: {
      joystickMode: 'analog-360',
      joystickLabel: 'Fly & Aim',
      actionA: {
        label: 'FIRE',
        sublabel: 'Plasma',
        colorHex: '#00C2FF',
        darkHex: '#007FA8',
        textColor: '#0B1219',
        icon: 'crosshair',
      },
      actionB: {
        label: 'BOOST',
        sublabel: 'Afterburn',
        colorHex: '#10D98B',
        darkHex: '#0A915D',
        textColor: '#0A1913',
        icon: 'flame',
      },
      controlTip: 'Use asteroids for cover and time Boost to evade incoming fire.',
    },
    settingLabel: 'Match Time',
    settingOptions: [
      { label: '60 sec', value: 60 },
      { label: '90 sec', value: 90 },
      { label: '120 sec', value: 120 },
    ],
    defaultSetting: 75,
  },
  {
    id: 'turbo-drift',
    name: 'Turbo Drift',
    category: 'Arcade Circuit',
    tagline: 'Power-slide tight hairpins and hit boost chevrons.',
    description:
      'Side-by-side 8-car top-down racing with responsive analog steering, drift-charged nitro, and high-speed boost strips.',
    minPlayers: 1,
    maxPlayers: 8,
    suitableFor: ['solo', 'double', 'multiplayer'],
    playerModeLabel: 'Solo · 2P · 3–8P',
    coverImage: '/src/assets/images/game_turbo_drift_1795251973488.jpg',
    accentHex: '#FFB800',
    rules: [
      'Point the joystick along the road to steer and accelerate smoothly.',
      'Hold Drift around hairpins to carve tight lines and charge Nitro.',
      'Fire Nitro on straights and ride glowing amber boost chevrons.',
      'First racer to complete all laps takes the checkered flag.',
    ],
    controllerSchema: {
      joystickMode: 'analog-360',
      joystickLabel: 'Drive & Steer',
      actionA: {
        label: 'NITRO',
        sublabel: 'Turbo Burst',
        colorHex: '#FFB800',
        darkHex: '#B58100',
        textColor: '#14120B',
        icon: 'gauge',
      },
      actionB: {
        label: 'DRIFT',
        sublabel: 'Tight Slide',
        colorHex: '#FF4D2E',
        darkHex: '#B82E17',
        textColor: '#FFFFFF',
        icon: 'wind',
      },
      controlTip: 'Drifting corners fills your Nitro gauge faster for straightaways.',
    },
    settingLabel: 'Race Laps',
    settingOptions: [
      { label: '3 Laps', value: 3 },
      { label: '5 Laps', value: 5 },
      { label: '2 Sprint Laps', value: 2 },
    ],
    defaultSetting: 3,
  },
  {
    id: 'hex-drop',
    name: 'Hex Drop',
    category: 'Falling Survival',
    tagline: 'Keep moving as every hexagonal tile crumbles beneath you.',
    description:
      'Sprint across a suspended honeycomb floor that cracks and drops the instant you step on it. Leap over chasms and shove rivals into the void.',
    minPlayers: 1,
    maxPlayers: 8,
    suitableFor: ['solo', 'double', 'multiplayer'],
    playerModeLabel: 'Solo · 2P · 3–8P',
    coverImage: '/src/assets/images/game_hex_drop_1795253993093.jpg',
    accentHex: '#10D98B',
    rules: [
      'Every tile you step on cracks and collapses into the abyss.',
      'Hit Leap to jump cleanly across missing tiles and cut off escape routes.',
      'Trigger Shove near opponents to push them off narrow ledges.',
      'Last survivor standing on the honeycomb wins the round.',
    ],
    controllerSchema: {
      joystickMode: 'analog-360',
      joystickLabel: 'Run',
      actionA: {
        label: 'LEAP',
        sublabel: 'Gap Jump',
        colorHex: '#10D98B',
        darkHex: '#0A915D',
        textColor: '#0A1913',
        icon: 'arrow-up',
      },
      actionB: {
        label: 'SHOVE',
        sublabel: 'Push Rival',
        colorHex: '#FF4D2E',
        darkHex: '#B82E17',
        textColor: '#FFFFFF',
        icon: 'waves',
      },
      controlTip: 'Save Leap to cross big gaps and Shove rivals at the edge.',
    },
    settingLabel: 'Rounds',
    settingOptions: [
      { label: '3 Rounds', value: 3 },
      { label: '5 Rounds', value: 5 },
      { label: '1 Quick Round', value: 1 },
    ],
    defaultSetting: 3,
  },
  {
    id: 'fuse-pass',
    name: 'Fuse Pass',
    category: 'Bomb Tag',
    tagline: 'Pass the ticking bomb before the fuse burns out.',
    description:
      'Frantic hot-potato tag around steel arena pillars. The bomb holder moves faster—hunt down a rival and lunge-pass the explosive before zero.',
    minPlayers: 1,
    maxPlayers: 8,
    suitableFor: ['multiplayer'],
    playerModeLabel: '3–8P Party',
    coverImage: '/src/assets/images/game_fuse_pass_1795253992519.jpg',
    accentHex: '#FF7A1A',
    rules: [
      'One player holds a live ticking bomb with a built-in speed boost.',
      'Collide or hit Pass to lunge and hand the bomb to another player.',
      'Use Sprint to juke around pillars and escape the bomb carrier.',
      'When the fuse hits zero, the holder blasts out—last player wins.',
    ],
    controllerSchema: {
      joystickMode: 'analog-360',
      joystickLabel: 'Run & Juke',
      actionA: {
        label: 'SPRINT',
        sublabel: 'Speed Burst',
        colorHex: '#FFB800',
        darkHex: '#B58100',
        textColor: '#14120B',
        icon: 'footprints',
      },
      actionB: {
        label: 'PASS',
        sublabel: 'Tag Lunge',
        colorHex: '#FF4D2E',
        darkHex: '#B82E17',
        textColor: '#FFFFFF',
        icon: 'bomb',
      },
      controlTip: 'Lunge with Pass when close to hand off the bomb fast.',
    },
    settingLabel: 'Rounds',
    settingOptions: [
      { label: '3 Rounds', value: 3 },
      { label: '5 Rounds', value: 5 },
      { label: '1 Quick Round', value: 1 },
    ],
    defaultSetting: 3,
  },
  {
    id: 'grid-runners',
    name: 'Grid Runners',
    category: 'Light Trails',
    tagline: 'Carve glowing walls and trap every rival on the grid.',
    description:
      'High-speed light-cycle arena survival. Leave a solid neon ribbon in your wake, surge ahead with Overdrive, and hop over enemy barriers to escape traps.',
    minPlayers: 1,
    maxPlayers: 8,
    suitableFor: ['solo', 'double', 'multiplayer'],
    playerModeLabel: 'Solo · 2P · 3–8P',
    coverImage: '/src/assets/images/game_grid_runners_1795253992673.jpg',
    accentHex: '#00C2FF',
    rules: [
      'Steer continuously with the joystick—your bike never stops moving.',
      'Touching any glowing trail wall or arena edge triggers an instant crash.',
      'Hit Overdrive to cut across a rival lane and seal them in.',
      'Trigger Hop to vault cleanly over a single barrier when cornered.',
    ],
    controllerSchema: {
      joystickMode: 'analog-360',
      joystickLabel: 'Steer Cycle',
      actionA: {
        label: 'BOOST',
        sublabel: 'Overdrive',
        colorHex: '#00C2FF',
        darkHex: '#007FA8',
        textColor: '#0B1219',
        icon: 'zap',
      },
      actionB: {
        label: 'HOP',
        sublabel: 'Trail Jump',
        colorHex: '#FF3B9A',
        darkHex: '#B31C67',
        textColor: '#FFFFFF',
        icon: 'arrow-up',
      },
      controlTip: 'Use Hop to jump across enemy walls and break out of traps.',
    },
    settingLabel: 'Rounds',
    settingOptions: [
      { label: '3 Rounds', value: 3 },
      { label: '5 Rounds', value: 5 },
      { label: '1 Quick Round', value: 1 },
    ],
    defaultSetting: 3,
  },
  {
    id: 'ricochet-tanks',
    name: 'Ricochet Tanks',
    category: 'Bunker Combat',
    tagline: 'Bank bouncing shells around corners in a steel bunker.',
    description:
      'Tactical top-down tank warfare inside a symmetrical maze. Fire shells that ricochet off walls up to two times and plant blinking proximity mines in choke points.',
    minPlayers: 1,
    maxPlayers: 8,
    suitableFor: ['double', 'multiplayer'],
    playerModeLabel: '2P · 3–8P',
    coverImage: '/src/assets/images/game_ricochet_tanks_1795253992988.jpg',
    accentHex: '#9EE622',
    rules: [
      'Drive and aim your turret smoothly with the left joystick.',
      'Fire bouncing Shells that ricochet up to twice off bunker walls.',
      'Bank-shot eliminations score bonus points—drop Mines to guard corridors.',
      'Highest tank score when the match clock hits zero takes the win.',
    ],
    controllerSchema: {
      joystickMode: 'analog-360',
      joystickLabel: 'Drive & Aim',
      actionA: {
        label: 'SHELL',
        sublabel: 'Bank Shot',
        colorHex: '#9EE622',
        darkHex: '#679910',
        textColor: '#12190A',
        icon: 'target',
      },
      actionB: {
        label: 'MINE',
        sublabel: 'Blast Trap',
        colorHex: '#FF7A1A',
        darkHex: '#B54F06',
        textColor: '#140F0A',
        icon: 'bomb',
      },
      controlTip: 'Angle shots off bunker walls for +50 bonus bank-shot points.',
    },
    settingLabel: 'Match Time',
    settingOptions: [
      { label: '60 sec', value: 60 },
      { label: '90 sec', value: 90 },
      { label: '120 sec', value: 120 },
    ],
    defaultSetting: 90,
  },
  {
    id: 'turbo-striker',
    name: 'Turbo Striker',
    category: 'Team Soccer',
    tagline: 'Fast 4v4 arcade soccer with power kicks and dive tackles.',
    description:
      'Players auto-split into Red vs. Blue squads on a walled neon stadium pitch. Dribble, blast power shots into the goal, and dive-tackle rivals on defense.',
    minPlayers: 1,
    maxPlayers: 8,
    suitableFor: ['double', 'multiplayer'],
    playerModeLabel: '2P · 3–8P',
    coverImage: '/src/assets/images/game_turbo_striker_1795253992991.jpg',
    accentHex: '#528BFF',
    rules: [
      'Players split automatically into Red (attacks Right) vs. Blue (attacks Left).',
      'Dribble by driving into the ball—the walled pitch keeps play nonstop.',
      'Hit Kick near the ball for a blazing power shot toward the net.',
      'Trigger Tackle to dash-steal the ball or make a clutch goalie dive.',
    ],
    controllerSchema: {
      joystickMode: 'analog-360',
      joystickLabel: 'Move & Aim',
      actionA: {
        label: 'KICK',
        sublabel: 'Power Shot',
        colorHex: '#00C2FF',
        darkHex: '#007FA8',
        textColor: '#0B1219',
        icon: 'zap',
      },
      actionB: {
        label: 'TACKLE',
        sublabel: 'Dash Dive',
        colorHex: '#FF4D2E',
        darkHex: '#B82E17',
        textColor: '#FFFFFF',
        icon: 'shield',
      },
      controlTip: 'Line up behind the ball before pressing Kick to aim your shot.',
    },
    settingLabel: 'Match Time',
    settingOptions: [
      { label: '60 sec', value: 60 },
      { label: '90 sec', value: 90 },
      { label: '120 sec', value: 120 },
    ],
    defaultSetting: 90,
  },
  {
    id: 'paint-rush',
    name: 'Paint Rush',
    category: 'Turf Clash',
    tagline: 'Claim the arena floor in a 60-second color frenzy.',
    description:
      'Roll across a tiled workshop floor to coat squares in your color and overwrite enemy turf. Detonate Splash bombs and boost-slide across wide lanes to steal the lead.',
    minPlayers: 1,
    maxPlayers: 8,
    suitableFor: ['solo', 'double', 'multiplayer'],
    playerModeLabel: 'Solo · 2P · 3–8P',
    coverImage: '/src/assets/images/game_paint_rush_1795253992311.jpg',
    accentHex: '#FF3B9A',
    rules: [
      'Every tile you roll over flips to your color—overwrite rival paint freely.',
      'Trigger Splash to detonate a wide paint bomb around your roller.',
      'Hit Slide for a rapid streak dash that coats an entire lane fast.',
      'Player owning the highest percentage of the board at 0:00 wins.',
    ],
    controllerSchema: {
      joystickMode: 'analog-360',
      joystickLabel: 'Roll Paint',
      actionA: {
        label: 'SPLASH',
        sublabel: 'Paint Bomb',
        colorHex: '#FF3B9A',
        darkHex: '#B31C67',
        textColor: '#FFFFFF',
        icon: 'paintbrush',
      },
      actionB: {
        label: 'SLIDE',
        sublabel: 'Fast Streak',
        colorHex: '#FFB800',
        darkHex: '#B58100',
        textColor: '#14120B',
        icon: 'wind',
      },
      controlTip: 'Save Splash for the final 5 seconds to steal a huge patch of turf.',
    },
    settingLabel: 'Match Time',
    settingOptions: [
      { label: '45 sec', value: 45 },
      { label: '60 sec', value: 60 },
      { label: '90 sec', value: 90 },
    ],
    defaultSetting: 60,
  },
];

export const GAME_BY_ID: Record<GameId, GameMetadata> = GAME_CATALOG.reduce(
  (acc, game) => {
    acc[game.id] = game;
    return acc;
  },
  {} as Record<GameId, GameMetadata>
);

export function getGameMeta(id: GameId): GameMetadata {
  return GAME_BY_ID[id] ?? GAME_CATALOG[0];
}

export function filterGamesByPlayerMode(mode: PlayerFilterMode): GameMetadata[] {
  if (mode === 'all') return GAME_CATALOG;
  return GAME_CATALOG.filter((game) => game.suitableFor.includes(mode));
}

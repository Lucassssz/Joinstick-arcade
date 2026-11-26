# JoinStick Arcade — Universal Game Development Standard

This document is the authoritative engineering, visual, ergonomic, and integration standard for **every new game** built for JoinStick Arcade. Every future title—whether Arcade, Board, or Card—must comply with all sections below before it is considered complete.

---

## 1. Canvas, Layout & Dual-Mode Safe Zones

All games render onto a unified logical canvas of **`1200 × 720`** (`ARENA_WIDTH × ARENA_HEIGHT`, 16:9). The exact same renderer drives both **Party Mode (TV Monitor)** and **Pocket Mode (Phone Handheld)**, as well as live **Lobby Thumbnails** and **Cup Vote Previews**.

### 1.1 Safe-Zone Blueprint (Zero HUD Overlap Rule)
Because Pocket Mode overlays translucent controls and corner pills directly on top of the 1200×720 canvas, every arena layout MUST respect these zones:

| Zone | Canvas Coordinates (`1200×720`) | Purpose & Constraint |
| --- | --- | --- |
| **Top-Left & Top-Right Corners** | `x: 0–340, y: 0–68` and `x: 860–1200, y: 0–68` | Reserved for Pocket Mode's corner identity pill and action pill (`⋯`, `?`, `Pause`). **Never place critical timers, scores, turn prompts, or interactive spawn targets in these top corners.** |
| **Top-Center HUD Band** | `x: 350–850, y: 12–66` | Primary home for match timer, round counter, active turn banner, or phase indicator. Always unobstructed in both Party Mode and Pocket Mode. |
| **Primary Playfield Safe Area** | `x: 90–1110, y: 80–650` | Core interactive arena, board, or card table. Center focal action near `(600, 385)`. |
| **Bottom-Left & Bottom-Right Corners** | `x: 0–270, y: 470–720` and `x: 930–1200, y: 470–720` | Covered by Pocket Mode's translucent Joystick/Arrows/Trackpad and A/B buttons in Arcade/Board games. Keep spawn points, goals, and key score readouts clear of these bottom corners. |
| **Card Table Bottom Strip** | `y: 650–720` | Reserved for Pocket Mode's collapsed table status bar (`48px` strip). Keep central discard/pot/tricks centered at `y: 260–460` so `table-overview-zoom` (`1.06×`) and `turn-focus` (`1.52×`) frame the action cleanly. |

### 1.2 Camera & Framing Discipline
- **No tiny unreadable micro-grids**: Elements must remain legible on a 6-inch phone in landscape as well as a 65-inch TV from 3 meters away.
- **Minimum canvas text size**: `14px` bold for secondary labels, `18px–22px` bold for scores/timers, `28px–44px` black for phase banners.
- **No off-screen mystery spawns**: Every player pod, hazard, projectile, or goal must stay cleanly inside the visible bounds (or telegraph clearly from the edge with directional arrows/glows).

---

## 2. Graphics & 2.5D Visual Standard

JoinStick Arcade uses a cohesive **Tactile 2.5D Studio Diorama** art direction—not flat 2D rectangles or low-contrast wireframes.

### 2.1 Mandatory Rendering Pipeline Order
Every game renderer MUST draw layers in this strict order:
1. **Studio Backdrop**: Use `drawStudioBackdrop(...)` from `src/games/render25d.ts` with a themed dark base (`#080A0F`–`#141824`), subtle overhead radial spotlight, and clean background grid or atmospheric motifs.
2. **2.5D Extruded Stage**: Build the playable floor with `drawArenaSlab(...)` or `drawExtrudedDiscStage(...)` (floor drop shadow + vertical extruded cliff skirt + top surface gradient + crisp inner specular lip).
3. **Floor Markings & Telegraph Zones**: Lanes, territory paint, danger rings, hot zones, or board tiles rendered cleanly on the top plane.
4. **Grounded Contact Shadows**: Draw `drawShadowOval(...)` directly beneath every entity, prop, ball, or lifted object (scaling down and fading smoothly as elevation `liftZ` increases).
5. **Y-Sorted 2.5D Entities**: Sort all characters, obstacles, and props by `y` coordinate (painter's algorithm) and render using `drawCharacterPod3D(...)`, `drawSphere3D(...)`, `drawExtrudedCylinder3D(...)`, and `shadeHex(...)`.
6. **Non-Overlapping Nameplates**: Use `drawNameplate(...)` from `src/games/canvasHelpers.ts` (automatically tracks bounds via `clearDrawnNameplates` / `recordDrawnNameplate` and stays legible in EN/ZH).
7. **Floating Popups & Banners**: Render score popups via `drawPopupTexts(...)` and spring-animated banners via `getSpringBannerAnim(...)`.
8. **Universal Competitive & Front FX Layers**: Handled automatically by `renderGameSnapshot` (`renderCompetitiveOverlay` + `drawArcadeFrontFX`).

### 2.2 Color, Contrast & Readability Rules
- **Player Identity**: Always use each player's assigned `p.colorHex` from `PLAYER_PALETTE` for their character body, trail, territory, and nameplate accent. Never override player colors with team-conflicting or low-contrast hues.
- **Semantic Game Colors**:
  - Danger / Hazard / Elimination: `#FF3B30` / `#FF4D2E`
  - Reward / Crown / Gold / Turn Highlight: `#FFB800`
  - Safe / Ready / Shield / Boost: `#10D98B`
  - Info / Energy / Special Ability: `#00C2FF`
- **Eliminated / Out States**: Dim eliminated players (`opacity` or ghosted ring) and remove their active nameplate clutter so living contenders remain instantly readable.

---

## 3. Animation, Motion & Game Feel

Static snapshots feel lifeless. Every game MUST feel tactile, springy, and responsive at 60 FPS using `src/games/arcadeMotion.ts`.

### 3.1 Core Motion Requirements
- **Sub-Tick Interpolation**: Server ticks run at fixed `TICK_MS`; renderers MUST read interpolated positions/angles via `arcadeMotion` (`lerp`, `lerpAngle`, `interpAlpha`) so movement stays silky smooth at 60–120Hz.
- **Squash, Stretch & Recoil**: Use `getPodFx(...)` (`scaleX`, `scaleY`, `flash`, motion trails) on dashes, jumps, bounces, hits, and sudden stops.
- **Telegraph -> Action -> Impact -> Settle**:
  - *Telegraph*: Every hazard (laser, bomb blast, falling anvil, shrinking ring, red light) MUST show a clear visual warning (`0.4s–1.2s`) before dealing damage.
  - *Impact*: Trigger particle bursts (`spark`, `dust`, `ember`, `confetti`, `droplet`, `snowflake`, `star`), expanding shockwave rings (`ArcadeRing`), brief white hit-flash, and subtle camera recoil (`kickX`/`kickY`) or micro hit-stop (`30–60ms`) on KOs/goals.
  - *Settle*: Board pieces, dice (`getDiceSettleMotion`), and cards use spring/cubic easing (`easeOutBack`, `easeOutCubic`, `easeInOutCubic`)—never teleport instantaneously.
- **Idle Life**: Living characters and idle collectibles should have subtle breathing bob, directional facing, or gentle ambient shimmer (`getMotionTime()`).

### 3.2 Audio & Haptic Feedback Contract
Every significant game event MUST emit synchronized `sounds: SoundEvent[]` and targeted `haptics: HapticTrigger[]` from `step(...)`:
- **Light tap (`15–30ms`)**: Pickup, menu step, card select, tile flip.
- **Medium hit (`35–55ms`)**: Dash, shot fired, collision bump, turn start.
- **Heavy impact (`[45, 25, 85]` or `[60, 35, 110]`)**: Elimination, goal scored, bluff caught, Frenzy trigger, match win.

---

## 4. Universal 4-in-1 Pad Suitability & Control Ergonomics

Every game MUST be registered in `GAME_PAD_PROFILES` (`src/shared/padProfiles.ts`) with bilingual `reasonEn` / `reasonZh` and mapped to its optimal default pad while remaining playable on all compatible arcade pads.

### 4.1 Pad Selection Matrix

| Pad | `PadMode` | Best For | Required Sub-Preset Flags |
| --- | --- | --- | --- |
| **Pad 1 · Pro Analog Stick** | `'analog'` | 360° arena roaming, racing, twin-axis aiming, dodging, sports dribbling. | `preferAutoTap?: boolean` (set `true` for rapid-fire shooters / mashers). |
| **Pad 2 · Easy 4-Way Arrows** | `'arrows'` | Grid/lane movement, light-cycles, maze runners, board games with directional cursor or dice/choice buttons. | `arrowsStrictFourWay: true` (for crisp 90° turns with zero accidental diagonals) or `false` (8-way); `preferAutoTap`. |
| **Pad 3 · Swipe / Glide Trackpad** | `'trackpad'` | Direct-position paddles, lane sliders, precision angle/power aimers, flick/slingshot games. | `trackpadMode: 'glide' \| 'flick'`; `trackpadTapForA: true` when single-tap triggers primary action (jump/flip/fire). |
| **Pad 4 · Private Card Table** | `'card'` | Secret hands, bidding, bluffing, trick-taking, drafting, word/trivia/social deduction. | `cardDefaultView: 'fan'` (<= 7 cards) or `'grid'` (large hands / tile grids / choice buttons). |

### 4.2 Universal Arcade & Board Input Contract
- **Strict 2-Button Ceiling**: All non-card gameplay MUST work using only `(dx, dy)` in `[-1, 1]` and two buttons (`a`, `b`). Never require hidden gestures or extra buttons.
- **Clear Verb Labels**: `controllerSchema.joystickLabel`, `actionA.label`, and `actionB.label` MUST be 1–2 word action verbs (e.g., `DASH`, `FIRE`, `JUMP`, `ROLL`, `BUY`), with a short `sublabel` and distinct icon + color.
- **Edge-Triggered vs Held Inputs**: Use `p.input.a && !p.prevA` for discrete actions (jump, roll, shoot burst, pass) and `p.input.a` for charge/hold mechanics (boost, shield, power meter).
- **Live Cooldown Telemetry**: Report `cooldownA` and `cooldownB` normalized to `0..1` (`0` = ready, `1` = just used) in `hudUpdates` so the phone buttons display live charge percentages and dim smoothly during cooldown.
- **No Dead Buttons**: If a game primarily uses one button (`A`), give `B` a meaningful secondary utility (e.g., brake, shield, ping/taunt, cancel, quick-pass, or alternate power).
- **Accessibility & Preferences Compatibility**: Must work seamlessly with `swapAB`, `autoTapPinned` (Turbo-A), hardware gamepads, keyboard (`WASD` / `Arrows`), and Chaos Wheel `invertControls` (Mirror Curse).

### 4.3 Universal Card Game Contract (`CARD_GAME_IDS`)
- **Zero Secret Leakage**: Never put a player's private hand contents inside the public `GameSnapshot`. Always send private hands exclusively via `getPrivateStates(...)` -> `CardPrivateState`.
- **Rich Action Descriptors**: Populate `statusHint` & `statusHintZh`, `isMyTurn`, `isActionRequired`, `turnTimeLeft` (standard `15s` shot-clock with red warning under `5s`), and explicit `primaryBtn`/`secondaryBtn` or `extraActions` with localized `labelZh`.
- **Timeout Safety**: Always auto-pass, auto-draw, or auto-pick cleanly when `turnTimeLeft <= 0` so no player can stall a match.

---

## 5. Dual-Mode Integration: Party Mode & Pocket Mode

Every game MUST feel native in both room modes without duplicating game logic.

### 5.1 Party Mode (TV Monitor + Phone Controllers)
- **Rules Briefing (`BRIEFING`)**: TV shows `GameTutorialOverlay` with live playable canvas demo + `PhoneControllerDemo` while phones display the rules/pad summary and `"I'm Ready!"` button.
- **Spectator Legibility**: All match drama (timers, scores, leader crown, turn owner, last card played, eliminations) must be readable on the TV screen without needing to look at anyone's phone.
- **Host Remote Navigation**: `SETUP`, `LOBBY`, `VOTING`, `BRIEFING`, `PAUSED`, and `RESULTS` flows must remain 100% controllable via the Host Phone Remote (`remote:action`).

### 5.2 Pocket Mode (Phone-Only Handheld Play)
- **Zero-Friction Live Intro (No Blocking Rule Wall)**:
  - Pocket Mode skips `BRIEFING` and launches directly into `COUNTDOWN` -> `PLAYING`.
  - During `COUNTDOWN`, the live arena renders immediately behind a compact goal + controls card (`gameMeta.tagline`, `A`/`B` verbs, Chaos badge).
- **Live `▼ YOU` Player Beacon**:
  - `PocketArenaCanvas` automatically draws a pulsing ring + floating `▼ YOU` (`▼ 你在这里`) pointer during `COUNTDOWN` and the first `6.5s` of `PLAYING`.
  - **Requirement for Spatial Games**: Every arcade/action `GameSnapshot` MUST expose `players: Array<{ id: string; x: number; y: number; alive?: boolean }>` in `1200×720` canvas coordinates so the `▼ YOU` beacon tracks the player accurately out of the box!
- **Opening Live Coach & Turn-1 Card Prompt**:
  - Arcade games show `gameMeta.rules[0]` in a slim non-blocking top strip for `6.5s` (auto-fades or tap `×`).
  - Card games show `gameMeta.rules[0]` as a Turn-1 `coachTip` inside `CardControllerDeck` until the player takes their first action or dismisses it.
  - **Copy Rule**: `gameMeta.rules[0]` MUST always be written as a punchy, actionable 1-sentence instruction (under ~75 characters) that makes sense immediately mid-match.
- **1-Tap Quick Rules (`?`)**:
  - Every game's `tagline`, numbered `rules[]`, active `settingLabel`, `activeMutator`, and `controllerSchema` are surfaced on demand via the top-right `?` button and on the `PAUSED` screen.
- **Pocket Card Mode Option A (Turn-Driven Split + Full Table)**:
  - Card games automatically switch between **Full-Table Overview** on opponents' turns and the **42%/58% Split Hand View** on the player's turn.
  - Every new card game MUST be wired into `buildPocketCardSituation(...)` in `src/components/PhoneController.tsx` (providing `tableBadge`, `tableSummary`, `lastMoveText`, and per-opponent `stat`/`statusTag`/`statusTone`) and added to `TABLETOP_ZOOM_CARD_GAMES` if it uses a central tabletop layout.

---

## 6. Gameplay Architecture, Bots, Competitive Systems & Scaling

### 6.1 Server Authoritative Engine (`ServerGameModule<TState>`)
- Pure TypeScript simulation in `server/games/*.ts` (never rely on browser DOM/Canvas APIs on the server).
- Implement `createState`, `step`, `getSnapshot`, `getRankings`, plus `addPlayer` (optional hot-join) and `handleCardAction`/`getPrivateStates` (for card games).
- **Match Length Sweet Spot**: Default setting targets **45–90 seconds** for Arcade games and **1.5–3 minutes** for Board/Card games, with 3 selectable `settingOptions` (Short / Standard / Extended or Win Target variants).
- **Player Count Scaling (`1–8` Players)**:
  - Must support **Solo (`1P` vs AI Bots or Solo High-Score)**, **Double (`2P`)**, and **Multiplayer (`3–8P`)** cleanly without crowding spawns or breaking UI layout.
  - Tag `suitableFor: ('solo' | 'double' | 'multiplayer')[]` accurately in `GAME_CATALOG`.

### 6.2 Universal AI Bot Support (`easy` | `medium` | `hard`)
- Every new game MUST have working AI behavior in `server/games/botController.ts` / `server/games/botEngine.ts` (and card AI inside the module or bot engine) so any solo or small group can fill seats with bots immediately.
- Bots must obey the exact same physics, cooldowns, and turn rules as humans—differentiated by reaction delay, aim accuracy, and tactical foresight across `easy`, `medium`, and `hard`.

### 6.3 Platform-Wide Modes & Multipliers
Every new game must integrate cleanly with JoinStick Arcade's party systems:
1. **2× Frenzy Mode**: Register end-game trigger condition in `shouldTriggerFrenzy(...)` (`server/roomManager.ts`) or set `handlesOwnFrenzyMultiplier: true` if the engine scales scores internally.
2. **Chaos Wheel Mutators**: Respect `simDt` speed scaling (`isTurnPacedGame` list in `server/roomManager.ts` for turn-based games that must stay `1.0×` speed), `scoreMult`, and `invertControls`.
3. **Competitive Layer (Golden Relics, 2× Hot Zones, Bounty & Streaks)**:
   - Add free-roaming 2D arena games to `FREE_ROAM_ARENA_GAMES` (and circular/ring stages to `COMPACT_RING_GAMES`) in `server/games/competitiveLayer.ts`.
4. **Ranking Integrity**: If winners are determined by survival/finish order rather than raw points (e.g., racing, elimination, card emptying), add the `GameId` to `RANK_PRIORITY_GAMES` in `server/roomManager.ts`.
5. **5-Game Cup Voting & Team Modes (`2v2`, `3v3`, `4v4`)**: Ensure scores are finite non-negative integers so `computeTeamStandings` and Tournament Marks aggregate cleanly.

---

## 7. Localization, Thumbnails & Performance Standards

### 7.1 Full Bilingual Support (English + Simplified Chinese)
- Every user-facing string MUST be localized via `src/lib/i18n.ts`:
  - Game metadata (`name`, `category`, `tagline`, `description`, `rules[]`, `settingLabel`, `settingOptions`, `controllerSchema` labels) in `GAME_META_ZH`.
  - Dynamic canvas banners, phase callouts, and `statText` via `tCanvas(...)` / `translateGameText(...)`.
  - Card private hints & action buttons via `statusHintZh` and `labelZh`.
  - Pad recommendation explanation via `reasonEn` / `reasonZh`.

### 7.2 Live Demo Snapshots & Thumbnails
- Every new game MUST produce a rich, mid-action snapshot in `server/demoSnapshot.ts` (never an empty/black starting frame) so:
  - Lobby cards generate crisp cached PNG thumbnails via `src/games/thumbnailGenerator.ts`.
  - 5-Game Cup voting and TV Briefing render exciting live previews immediately.

### 7.3 Performance & Network Budget
- **Zero Per-Frame Allocations Where Possible**: Cache gradients/shaded colors (`shadeHex`), avoid allocating large arrays or loading external images inside the 60 FPS `renderLoop`.
- **Lean Snapshots**: Keep `GameSnapshot` JSON payloads compact (round coordinates/floats where appropriate, omit internal AI/debug fields, cap particle/trail arrays).
- **Graceful Cleanup**: Never leave dangling `setInterval` / `setTimeout` timers inside game state—drive all timers strictly from `dt` inside `step(state, players, dt)`.

---

## 8. Mandatory New-Game Integration Checklist

Before shipping any new game, verify every touchpoint below:

- [ ] **Types (`src/shared/types.ts`)**: Add `GameId` union member and strongly-typed `*Snapshot` interface (with `players[].x/y` for spatial games).
- [ ] **Catalog (`src/shared/games.ts` or pack catalog)**: Add complete `GameMetadata` (`tagline`, 3–4 crisp `rules` with standalone `rules[0]`, `settingOptions`, `suitableFor`, `controllerSchema`, genre set `BOARD_GAME_IDS` / `CARD_GAME_IDS` / `HERITAGE_GAME_IDS`).
- [ ] **Localization (`src/lib/i18n.ts`)**: Add full Simplified Chinese entry for metadata, pad reasons, and dynamic canvas/HUD strings.
- [ ] **Pad Profile (`src/shared/padProfiles.ts`)**: Add curated `GAME_PAD_PROFILES[gameId]` entry with optimal pad (`analog` / `arrows` / `trackpad` / `card`) and sub-presets.
- [ ] **Server Engine (`server/games/*.ts` & `server/games/engine.ts`)**: Implement `ServerGameModule`, register in `SERVER_GAMES`, add AI logic in `botController.ts`/`botEngine.ts`.
- [ ] **Room & Competitive Hooks (`server/roomManager.ts`, `server/games/competitiveLayer.ts`, `server/demoSnapshot.ts`)**: Classify `isTurnPacedGame`, `RANK_PRIORITY_GAMES`, `shouldTriggerFrenzy`, `FREE_ROAM_ARENA_GAMES`, and mid-action demo snapshot.
- [ ] **2.5D Renderer (`src/games/*Renderers.ts` & `src/games/rendererRegistry.ts`)**: Implement full 2.5D layered canvas renderer respecting Safe Zones, `arcadeMotion`, `drawNameplate`, and `tCanvas`.
- [ ] **Pocket Mode Integration (`src/components/PhoneController.tsx`)**: Verify `▼ YOU` beacon tracks player (arcade/board) OR wire `buildPocketCardSituation` + `TABLETOP_ZOOM_CARD_GAMES` (card).
- [ ] **Verification**: Run `tsc --noEmit` (`lint_applet`) and `npm run build` (`compile_applet`) cleanly with zero errors, and verify both Party Mode and Pocket Mode flows (1P+bots, countdown, live coach, `?` Quick Rules, pause, results, replay).

# Browser KOC — Development Plan

Reference mockup: `map-mockup.html` in this repo.
Agents available in `~/.claude/agents/` from github.com/msitarzewski/agency-agents

---

## Agents Cheat Sheet

Which agent to use for what. Run with `/agents <name>` in Claude Code.

```
AGENT                              BEST FOR
─────────────────────────────────  ────────────────────────────────────────
level-designer                     Sprint 0: map layout, spawn zones, gate
                                   placement, spatial tuning, pacing
game-designer                      Sprint 1-2: build tree, weapon balance,
                                   economy curves, progression design
engineering-frontend-developer     All sprints: core JS implementation,
                                   canvas rendering, game loop, systems
technical-artist                   Sprint 0 + 4: background rendering,
                                   entity visuals, effects, performance
design-ui-designer                 Sprint 3-4: shop UI, tech tree, HUD
                                   layout, minimap design
design-ux-architect                Sprint 3: shop flow, information
                                   hierarchy, player decision UX
engineering-code-reviewer          After each sprint: review all changes
                                   for bugs, perf, consistency
testing-performance-benchmarker    After Sprint 0: ensure 60fps with large
                                   world, many enemies, camera system
game-audio-engineer                Future: SFX, ambient audio, boss music
narrative-designer                 Future: enemy lore, wave themes, boss
                                   intros, achievement flavor text
```

---

## Sprint 0: Map Overhaul — Large Fort, 4 Gates, Camera System

```
RECOMMENDED AGENTS:
  Primary:   engineering-frontend-developer (core implementation)
  Support:   level-designer (spatial layout, spawn balance, pacing)
  Review:    engineering-code-reviewer (after completion)
  Perf test: testing-performance-benchmarker (verify 60fps on large world)
```

The map changes from a single-screen 960x540 side-view to a large scrolling world
with the camera following the player. The fort is a walled courtyard in the center
of the map with 4 gates (N/S/E/W) that enemies attack from all directions.

### 0.1 World & Camera Constants

Add to `config.js`:

```js
// World
export const WORLD_W = 1800;
export const WORLD_H = 1200;
export const VIEW_W = 960;   // viewport width (unchanged)
export const VIEW_H = 540;   // viewport height (unchanged)

// Fort (centered in world)
export const FORT = {
  x: 400,
  y: 250,
  w: 1000,
  h: 700,
  wallThickness: 24,
};

// Gates (openings in fort walls)
export const GATES = {
  north: { x: 900 - 60, y: 250,             w: 120, h: 24,  side: 'top' },
  south: { x: 900 - 60, y: 950 - 24,        w: 120, h: 24,  side: 'bottom' },
  east:  { x: 1400 - 24, y: 600 - 60,       w: 24,  h: 120, side: 'right' },
  west:  { x: 400,       y: 600 - 60,       w: 24,  h: 120, side: 'left' },
};

// Player
export const PLAYER = {
  ...existing,
  startX: 900,   // center of fort
  startY: 600,   // center of fort
};

// Playfield bounds (inside fort walls)
export const PLAYFIELD = {
  minX: FORT.x + FORT.wallThickness,
  maxX: FORT.x + FORT.w - FORT.wallThickness,
  minY: FORT.y + FORT.wallThickness,
  maxY: FORT.y + FORT.h - FORT.wallThickness,
};
```

Remove old constants: `BARRICADE_X`, `BARRICADE_Y`, `BARRICADE_W`, `BARRICADE_H`,
`FORT_WIDTH`, `GROUND_Y`, `PLAYFIELD_RIGHT`, `PLAYFIELD_TOP`, `PLAYFIELD_BOTTOM`.

### 0.2 Camera System

Create `src/systems/camera.js`:

```
- Camera follows player with lerp smoothing
- cam.x, cam.y = top-left of viewport in world coords
- Update: lerp toward (player.x - VIEW_W/2, player.y - VIEW_H/2)
- Clamp: 0 <= cam.x <= WORLD_W - VIEW_W, same for y
- All drawing uses ctx.translate(-cam.x, -cam.y)
- Export: createCamera(), updateCamera(cam, player, dt), applyCameraTransform(cam, ctx)
```

### 0.3 Barricade System — 4 Walls

Replace single barricade with array of 4 wall segments. Each wall has its own HP
and can be independently damaged/repaired/destroyed.

Refactor `barricade.js` to work with an array:

```
- createBarricades(level, hpMult) -> returns { north, south, east, west }
- Each barricade: { side, x, y, w, h, hp, maxHP, level, destroyed, rebuildTimer, gateX, gateY, gateW, gateH }
- The gate gap is part of each wall (enemies path through it when wall is destroyed)
- Draw: wall segments on either side of gate gap, gate archway frame, portcullis when alive
- upgradeBarricades() upgrades all 4 walls at once
- damageBarricade(walls, side, amount) damages a specific wall
- repairBarricade(walls, side, dt, gold) repairs nearest wall to player
```

Wall segments per side (each side has 2 wall pieces + 1 gate gap):
```
North wall: left piece (FORT.x to gateX) + right piece (gateX+gateW to FORT.x+FORT.w)
  Gate gap at center x, y=FORT.y, 120px wide
South wall: same layout, y=FORT.y+FORT.h-wallThickness
East wall: top piece + bottom piece
  Gate gap at center y, x=FORT.x+FORT.w-wallThickness, 120px tall
West wall: same layout, x=FORT.x
```

### 0.4 Enemy Spawning — 4 Directions

Update `waveManager.js`:

```
- Enemies spawn from 4 directions, distributed randomly or by wave pattern
- Spawn zones (outside fort, near world edges):
  North: y=40,  x=random(500-1300)
  South: y=1160, x=random(500-1300)
  East:  x=1700, y=random(300-900)
  West:  x=100,  y=random(300-900)
- Each enemy gets a `targetGate` (north/south/east/west) assigned at spawn
- Early waves: enemies from 1-2 sides. Later waves: all 4 sides.
  Wave 1-5:   east only
  Wave 6-10:  east + one random other
  Wave 11-20: east + south + north
  Wave 21+:   all 4 gates
```

### 0.5 Enemy AI — Gate Targeting

Update `enemy.js`:

```
- Each enemy has a `targetGate` property (north/south/east/west)
- Movement: head toward their assigned gate position
- When barricade on their side is alive: stop at wall, attack barricade
- When barricade on their side is destroyed: path through gate gap into courtyard
- Once inside courtyard: target nearest of (player, troops) using distance
- Ranged enemies: stop at range distance from their target gate and fire
- Boss: always targets the gate, smashes through (bonus damage to barricade)
```

Key coordinates for enemy targeting:
```
Heading to north gate: target (900, FORT.y - 10), then through gap to (900, FORT.y + 40)
Heading to south gate: target (900, FORT.y + FORT.h + 10), then through gap
Heading to east gate:  target (FORT.x + FORT.w + 10, 600), then through gap
Heading to west gate:  target (FORT.x - 10, 600), then through gap
```

### 0.6 Player Movement & Clamping

Update `player.js`:

```
- Player can move anywhere in the world (not just inside fort)
- Remove old x/y clamp to PLAYFIELD constants
- New clamp: 0 < x < WORLD_W, 0 < y < WORLD_H
- Fort walls block movement EXCEPT through gate gaps
- Need collision check: if player tries to walk through a wall segment, block it
- Player can walk through gate gaps freely to go outside and fight
```

Wall collision for player:
```
For each wall segment (not the gate gap):
  if player.nextX overlaps wall rect -> block x movement
  if player.nextY overlaps wall rect -> block y movement
```

### 0.7 Troop Positioning

Update `troop.js`:

```
- Troops assigned to defend specific gates (distribute evenly)
- Default position: just inside the gate gap on their assigned side
- If their gate's barricade breaks: hold position at gap to defend it
- Regroup (G key): all troops move to player position
```

### 0.8 Renderer — Background Rewrite

```
RECOMMENDED AGENT: technical-artist (background rendering, textures, perf)
```

Rewrite `rebuildBackground()` in `renderer.js`:

```
- Outside fort: dark grass (#2a4a2a) with texture patches
- Dirt paths from each gate leading outward to world edges
- Fort courtyard: cobblestone texture (#8a7a6a) with stone grid pattern
- Fort walls: #776655, with battlements on outer edge
- Corner towers: circles at 4 corners of fort
- Gate archways: darker stone frame around each gate gap
- Torch glow: warm circles at corners and midpoints inside fort
```

All drawing must be offset by camera position.

### 0.9 Minimap

```
RECOMMENDED AGENT: design-ui-designer (minimap layout, readability)
```

Create `src/systems/minimap.js`:

```
- Renders in bottom-right corner of screen (NOT world-space, always on screen)
- Size: ~180x120px
- Shows: fort outline, wall health (color-coded), enemy dots (red),
  troop dots (blue), player dot (green), camera viewport rectangle (green outline)
- Scale: world coords * (minimap size / world size)
- Draw after all world rendering, without camera transform
```

### 0.10 HUD Updates

Update `hud.js`:

```
- Add wall status panel (bottom-left): 4 small HP bars labeled N/S/E/W
- Color per bar: green (>50%), yellow (25-50%), red (<25%), grey (destroyed)
- Existing HP/XP/Wave/Gold bars stay at top
- Repair prompt: when near a wall, show "F to repair [NORTH WALL]" etc
```

### 0.11 Repair Mechanic

Update repair in `player.js` and `combat.js`:

```
- Player presses F near any wall/gate to repair it
- "Near" = within 80px of any wall segment on that side
- Repair targets the wall on the side closest to the player
- Show which wall you are repairing in HUD text
```

### 0.12 Gold Drops

Update `goldDrop.js`:

```
- Gold drops where enemies die (outside the fort for most kills)
- Player must walk out through gates to collect gold (risk/reward)
- Gold pickup radius unchanged, but gold magnet skill more valuable now
- Gold slowly drifts toward nearest gate gap? (optional QoL)
```

### Files changed in Sprint 0

```
MODIFIED:
  src/config.js          — new world/fort/gate constants, remove old barricade constants
  src/renderer.js        — full background rewrite, camera-aware drawing
  src/entities/player.js — new start pos, wall collision, world-bounds clamp
  src/entities/enemy.js  — gate targeting AI, 4-direction approach
  src/entities/barricade.js — 4 walls with individual HP, gate rendering
  src/entities/troop.js  — gate-assigned positioning
  src/entities/goldDrop.js — world-space drops
  src/entities/projectile.js — world-space, camera-aware
  src/systems/waveManager.js — 4-direction spawning
  src/systems/combat.js  — barricade attack per-wall, wall collision
  src/systems/hud.js     — wall status panel, camera-independent
  src/systems/shopUI.js  — no spatial changes, but verify it still works
  src/main.js            — integrate camera, pass barricades array, minimap draw call
  src/input.js           — no changes expected

NEW:
  src/systems/camera.js  — camera follow + clamp + transform
  src/systems/minimap.js — minimap renderer
```

### Sprint 0 — Suggested Agent Workflow

```
STEP 1: /agents level-designer
  "Read DEVPLAN.md Sprint 0 and map-mockup.html. Review sections 0.1, 0.3,
   0.4, 0.5 for spatial balance. Are the fort dimensions, gate sizes, spawn
   zones, and wave direction progression well-tuned? Flag any issues before
   we start coding."

STEP 2: /agents engineering-frontend-developer
  "Read DEVPLAN.md and implement Sprint 0 (sections 0.1 through 0.12).
   Reference map-mockup.html for the visual design. Work through each
   sub-task in order. The game should be fully playable after this sprint
   with the new 4-gate fort, camera system, minimap, and multi-directional
   enemy spawning."

STEP 3: /agents engineering-code-reviewer
  "Review all changes made during Sprint 0. Check for: performance issues
   with the larger world, camera transform bugs, wall collision edge cases,
   enemy pathfinding issues at gates, memory leaks from offscreen rendering.
   The game must maintain 60fps."

STEP 4: /agents testing-performance-benchmarker
  "Profile the game running wave 25+ with enemies from all 4 directions.
   Check frame times, identify any bottlenecks in rendering the 1800x1200
   world, enemy AI updates, or minimap drawing. Suggest optimizations."
```

---

## Sprint 1: Expanded Build Tree

```
RECOMMENDED AGENTS:
  Primary:   game-designer (economy balance, building costs, passive effects)
  Code:      engineering-frontend-developer (implementation)
  Review:    engineering-code-reviewer
```

### 1.1 New Buildings in Config

Add to `BUILDINGS` in `config.js`:

```js
engineeringWorkshop: { name: 'Engineering Workshop', cost: 800,  requires: 'lumberMill',  unlocks: ['spikedBarricades', 'moat'] },
spikedBarricades:    { name: 'Spiked Barricades',   cost: 1500, requires: 'engineeringWorkshop', unlocks: [] },
moat:                { name: 'Moat',                 cost: 2500, requires: 'engineeringWorkshop', unlocks: [] },
weaponsmith:         { name: 'Weaponsmith',          cost: 1000, requires: 'blacksmith',  unlocks: ['masterForge'] },
masterForge:         { name: 'Master Forge',         cost: 6000, requires: 'weaponsmith', unlocks: [] },
apothecary:          { name: 'Apothecary',           cost: 400,  requires: null,          unlocks: ['alchemistLab'] },
alchemistLab:        { name: 'Alchemist Lab',        cost: 1500, requires: 'apothecary',  unlocks: ['wizardTower'] },
goldMine:            { name: 'Gold Mine',            cost: 600,  requires: null,          unlocks: ['crystalMine'] },
crystalMine:         { name: 'Crystal Mine',         cost: 3000, requires: 'goldMine',    unlocks: ['treasury'] },
treasury:            { name: 'Treasury',             cost: 7000, requires: 'crystalMine', unlocks: [] },
```

Update existing buildings to wire into the Apothecary chain:
```js
wizardTower: { ...existing, requires: 'alchemistLab' },  // was requires: null
```

### 1.2 Passive Building Effects

Add to game update loop:

```
- Spiked Barricades: enemies attacking any wall take 3 dmg/sec while in melee range
- Moat: enemies within 100px outside any wall move at 70% speed
- Gold Mine: wave completion bonus * 1.15
- Crystal Mine: new `crystals` field in economy state, +5 crystals per wave
- Treasury: wave bonus * 1.30, +10 crystals per wave
```

### 1.3 Building Visuals in Courtyard

In `renderer.js` or new `src/systems/buildingVisuals.js`:

```
- When a building is purchased, draw a small structure at its assigned position
- Positions defined in config (see map-mockup.html for layout)
- Each building: 40x30px rectangle with distinct color + label
- Draw as part of background (rebuild offscreen canvas when building purchased)
```

### Files changed

```
MODIFIED: src/config.js, src/systems/economy.js, src/systems/shopUI.js, src/renderer.js
NEW: src/systems/buildingVisuals.js (optional, could be in renderer)
```

### Sprint 1 — Suggested Agent Workflow

```
STEP 1: /agents game-designer
  "Read DEVPLAN.md Sprint 1 and existing config.js. Review building costs,
   prerequisite chains, and passive effect values. Are the costs balanced
   against expected gold income per wave? Does the Apothecary->Wizard Tower
   chain feel right? Run a paper economy simulation for waves 1-50."

STEP 2: /agents engineering-frontend-developer
  "Read DEVPLAN.md and implement Sprint 1 (sections 1.1 through 1.3).
   Add new buildings, passive effects, and courtyard building visuals.
   The shop should show all new buildings with correct prerequisites."
```

---

## Sprint 2: Weapon Categories & Upgrade Paths

```
RECOMMENDED AGENTS:
  Primary:   game-designer (weapon balance, DPS curves, upgrade pricing)
  Code:      engineering-frontend-developer (implementation)
  Review:    engineering-code-reviewer
```

### 2.1 Restructure Weapons Config

Replace flat `WEAPONS` object with `WEAPON_CLASSES`:

```js
export const WEAPON_CLASSES = {
  swords: {
    name: 'Swords', type: '1h',
    tiers: [
      { key: 'shortsword',  name: 'Shortsword',    damage: 10, cleave: 2, speed: 1.0,  cost: 0,     requires: null,           special: null,       knockbackMult: 1.0 },
      { key: 'longsword',   name: 'Longsword',     damage: 16, cleave: 2, speed: 1.0,  cost: 400,   requires: 'blacksmith',   special: null,       knockbackMult: 1.0 },
      { key: 'broadsword',  name: 'Broadsword',    damage: 24, cleave: 3, speed: 0.95, cost: 1500,  requires: 'weaponsmith',  special: null,       knockbackMult: 1.0 },
      { key: 'runicBlade',  name: 'Runic Blade',   damage: 35, cleave: 3, speed: 1.05, cost: 8000,  requires: 'wizardTower',  special: null,       knockbackMult: 1.0 },
      { key: 'orcbane',     name: 'Orcbane',       damage: 70, cleave: 5, speed: 0.75, cost: 50000, requires: 'arcaneLibrary',special: 'blastEvery3', knockbackMult: 1.0 },
    ]
  },
  axes: {
    name: 'Axes', type: '2h',
    tiers: [
      { key: 'handAxe',       name: 'Hand Axe',        damage: 14, cleave: 3, speed: 0.9,  cost: 250,   requires: 'blacksmith',   special: null,       knockbackMult: 1.0 },
      { key: 'battleAxe',     name: 'Battle Axe',      damage: 22, cleave: 3, speed: 0.85, cost: 600,   requires: 'blacksmith',   special: null,       knockbackMult: 1.0 },
      { key: 'executionerAxe',name: 'Executioner Axe',  damage: 32, cleave: 4, speed: 0.8,  cost: 4000,  requires: 'armory',       special: null,       knockbackMult: 1.0 },
      { key: 'axeRegen',      name: 'Axe of Regen',    damage: 38, cleave: 4, speed: 0.85, cost: 12000, requires: 'wizardTower',  special: 'regen2',   knockbackMult: 1.0 },
      { key: 'berserkerAxe',  name: 'Berserker Axe',   damage: 55, cleave: 5, speed: 0.9,  cost: 35000, requires: 'masterForge',  special: 'comboStack', knockbackMult: 1.0 },
    ]
  },
  maces: {
    name: 'Maces', type: '2h',
    tiers: [
      { key: 'mace',        name: 'Mace',            damage: 12, cleave: 2, speed: 0.85, cost: 300,   requires: 'blacksmith',   special: null,         knockbackMult: 1.2 },
      { key: 'flail',       name: 'Flail',           damage: 18, cleave: 2, speed: 0.9,  cost: 800,   requires: 'weaponsmith',  special: null,         knockbackMult: 1.3 },
      { key: 'warHammer',   name: 'War Hammer',      damage: 28, cleave: 2, speed: 0.7,  cost: 3000,  requires: 'armory',       special: null,         knockbackMult: 1.5 },
      { key: 'mithrilMaul', name: 'Mithril Maul',    damage: 40, cleave: 3, speed: 0.65, cost: 15000, requires: 'masterForge',  special: 'stun03',     knockbackMult: 1.5 },
      { key: 'maulTitans',  name: 'Maul of Titans',  damage: 60, cleave: 4, speed: 0.6,  cost: 45000, requires: 'arcaneLibrary',special: 'aoeEvery3',  knockbackMult: 1.5 },
    ]
  },
  ranged: {
    name: 'Ranged', type: 'ranged',
    tiers: [
      { key: 'lightCrossbow', name: 'Light Crossbow',  damage: 10, cleave: 1, speed: 0.7,  cost: 300,   requires: 'archeryRange',  special: null,       knockbackMult: 0 },
      { key: 'crossbow',      name: 'Crossbow',        damage: 15, cleave: 1, speed: 0.8,  cost: 800,   requires: 'archeryRange',  special: null,       knockbackMult: 0 },
      { key: 'heavyCrossbow', name: 'Heavy Crossbow',  damage: 22, cleave: 1, speed: 0.65, cost: 2500,  requires: 'armory',        special: 'pierce2',  knockbackMult: 0 },
      { key: 'crossbowSpeed', name: 'Crossbow of Speed',damage: 18, cleave: 1, speed: 1.3, cost: 6000,  requires: 'wizardTower',   special: null,       knockbackMult: 0 },
      { key: 'arcaneRepeater',name: 'Arcane Repeater', damage: 30, cleave: 1, speed: 1.1,  cost: 25000, requires: 'arcaneLibrary', special: 'pierce3',  knockbackMult: 0 },
    ]
  },
};

// Special standalone weapons (not in upgrade paths)
export const SPECIAL_WEAPONS = {
  deflectionGladius: { name: 'Deflection Gladius', damage: 15, cleave: 2, speed: 1.1, type: '1h', cost: 3500,  requires: 'wizardTower',  special: 'blockBonus20', knockbackMult: 1.0 },
  flailThrashing:    { name: 'Flail of Thrashing', damage: 30, cleave: 3, speed: 1.0, type: '1h', cost: 25000, requires: 'arcaneLibrary',special: 'knockback30',  knockbackMult: 1.3 },
  twinDaggers:       { name: 'Twin Daggers',       damage: 8,  cleave: 1, speed: 1.4, type: '1h', cost: 2000,  requires: 'weaponsmith',  special: 'doubleStrike', knockbackMult: 0.5 },
};
```

### 2.2 Upgrade Mechanic

In `economy.js`:

```
- Player state tracks: weaponClass ('swords'|'axes'|'maces'|'ranged'|null), weaponTier (0-4)
- Or for special weapons: weaponKey ('deflectionGladius' etc)
- Upgrade cost = next tier cost - current tier cost
- Switching class: pay full cost of tier 0 of new class (old weapon lost)
- getEquippedWeapon(player) -> looks up from WEAPON_CLASSES or SPECIAL_WEAPONS
```

### 2.3 Update Combat to Use New Weapon Lookup

In `player.js` and `combat.js`:

```
- Replace WEAPONS[p.weapon] with getEquippedWeapon(p)
- All damage/speed/cleave/special lookups go through the helper
- Add new specials: 'comboStack' (+5% dmg per combo), 'stun03' (0.3s stun),
  'pierce2' (projectile hits 2 enemies), 'pierce3', 'doubleStrike' (chance for 2 hits)
```

### Files changed

```
MODIFIED: src/config.js, src/systems/economy.js, src/systems/shopUI.js,
          src/entities/player.js, src/systems/combat.js
```

### Sprint 2 — Suggested Agent Workflow

```
STEP 1: /agents game-designer
  "Read DEVPLAN.md Sprint 2 weapon tiers. Build a DPS spreadsheet for each
   weapon class across all 5 tiers (damage * speed * cleave). Check that
   Swords/Axes/Maces/Ranged each have a distinct power curve and that no
   class dominates at every tier. Validate upgrade costs against expected
   gold income at the wave each tier unlocks."

STEP 2: /agents engineering-frontend-developer
  "Read DEVPLAN.md and implement Sprint 2 (sections 2.1 through 2.3).
   Restructure weapons config, add upgrade mechanic, update combat system.
   All existing weapon specials must still work. Game must be playable."
```

---

## Sprint 3: Visual Tech-Tree UI

```
RECOMMENDED AGENTS:
  Primary:   design-ui-designer (node graph layout, visual hierarchy)
  Support:   design-ux-architect (shop flow, purchase UX, info architecture)
  Code:      engineering-frontend-developer (canvas UI implementation)
```

### 3.1 Building Tech Tree (Shop Buildings Tab)

Create `src/ui/techTreeUI.js`:

```
- Renders building nodes as rounded rectangles with connecting lines
- Node layout: hardcoded x,y positions per building (design in data)
- States: built (green), available (gold pulsing), locked (grey)
- Click node to purchase
- Hover shows: name, cost, what it unlocks
- Connecting lines from parent -> child buildings
```

### 3.2 Weapon Upgrade Lanes (Shop Equipment Tab)

Update `shopUI.js`:

```
- 4 horizontal lanes, one per weapon class
- Each tier shown as a box: [T1] -> [T2] -> [T3] -> [T4] -> [T5]
- Current tier highlighted, next tier shows upgrade cost
- Locked tiers greyed out (missing building requirement)
- Special weapons shown below as standalone cards
- Armor and Shields as their own upgrade lanes
```

### Files changed

```
NEW: src/ui/techTreeUI.js
MODIFIED: src/systems/shopUI.js
```

### Sprint 3 — Suggested Agent Workflow

```
STEP 1: /agents design-ux-architect
  "Read DEVPLAN.md Sprint 3. Design the information architecture for the
   shop screen. How should buildings, weapons, armor, troops, and skills
   be organized across tabs? What info does the player need at a glance
   vs on hover? Sketch the flow for purchasing an upgrade."

STEP 2: /agents design-ui-designer
  "Read DEVPLAN.md Sprint 3. Design the visual layout for the tech tree
   nodes and weapon upgrade lanes. Define node sizes, spacing, colors for
   each state (built/available/locked), connecting line styles, and hover
   tooltip format. Output a design spec the frontend dev can implement."

STEP 3: /agents engineering-frontend-developer
  "Read DEVPLAN.md Sprint 3 and implement the tech tree UI and weapon
   upgrade lanes based on the design specs. All building purchases and
   weapon upgrades must work through the new UI."
```

---

## Sprint 4: Visual Polish

```
RECOMMENDED AGENTS:
  Primary:   technical-artist (entity rendering, effects, performance)
  Support:   design-ui-designer (HUD polish, shop cards)
  Code:      engineering-frontend-developer (implementation)
  Perf:      testing-performance-benchmarker (effects budget)
```

### 4.1 Entity Rendering

Update draw functions in `player.js`, `enemy.js`, `troop.js`:

```
- Player: rounded body, visible helmet plume, shield shape, weapon swing arc
- Enemies: distinct silhouettes per type:
    Raider: small circle + sword line
    Soldier: circle + shield rect
    Bomber: small circle + flickering fuse spark
    Archer: circle + bow arc
    Ogre: large oval / stacked circles
    Knight: circle + visor cross
    Wizard: circle + pointed hat triangle + staff
    Titan: massive shape + crown spikes + glow
- Troops: banner/flag above head instead of green diamond
- Projectiles: arrow fletching, magic trailing particles
```

### 4.2 HUD Polish

Update `hud.js`:

```
- HP bar: smooth lerp animation, heart icon
- XP bar: star icon, flash on level up
- Gold: coin icon, count-up tween
- Wave banner: large slide-in from top
- Damage numbers: size scales with amount, crits bounce
- Boss HP bar: full-width bar at top with name
- Wall status: 4 colored bars (already in Sprint 0)
```

### 4.3 Shop UI Cards

Update `shopUI.js`:

```
- Item cards with bordered boxes, stat preview, cost badge
- Stat comparison tooltip: "+5 dmg" in green, "-0.1 speed" in red
- Dimmed items you cant afford, pulsing items you can
- Circular countdown timer ring
```

### 4.4 Effects

Add `src/systems/particles.js`:

```
- Death burst: 3-5 colored circles fly outward on enemy death
- Gold sparkle: small yellow dots around gold drops
- Boss spawn: white screen flash
- Ambient: occasional leaf/dust motes in courtyard
- Torch flicker: animated glow radius on torch positions
```

### Files changed

```
MODIFIED: src/entities/player.js, src/entities/enemy.js, src/entities/troop.js,
          src/entities/projectile.js, src/systems/hud.js, src/systems/shopUI.js
NEW: src/systems/particles.js
```

### Sprint 4 — Suggested Agent Workflow

```
STEP 1: /agents technical-artist
  "Read DEVPLAN.md Sprint 4. Define a visual effects performance budget.
   We're targeting 60fps on the 1800x1200 world with 30+ enemies. How many
   particles per death burst? Max active particles? Should trails use
   object pooling? Define the constraints before implementation."

STEP 2: /agents engineering-frontend-developer
  "Read DEVPLAN.md Sprint 4. Implement entity rendering upgrades (4.1),
   HUD polish (4.2), shop UI cards (4.3), and particle effects (4.4).
   Stay within the performance budget. Use object pooling for particles."

STEP 3: /agents testing-performance-benchmarker
  "Run the game at wave 40+ with all visual effects active. Profile
   frame times. Identify any effects that need to be scaled back or
   optimized. Target: 95th percentile frame time under 16.6ms."
```

---

## Sprint Order Summary

```
Sprint 0 — Map overhaul (fort, 4 gates, camera, minimap, enemy 4-dir spawn)
Sprint 1 — Build tree expansion (new buildings, passive effects, courtyard visuals)
Sprint 2 — Weapon categories & upgrade paths
Sprint 3 — Tech tree UI & shop overhaul
Sprint 4 — Visual polish (entities, HUD, effects, particles)
```

Each sprint is self-contained and playable after completion.

---

## Quick Reference: Prompts to Copy-Paste

### Start Sprint 0
```
Read DEVPLAN.md and implement Sprint 0 (sections 0.1 through 0.12).
Reference map-mockup.html for the visual design. Work through each
sub-task in order. The game should be fully playable after this sprint
with the new 4-gate fort, camera system, minimap, and multi-directional
enemy spawning.
```

### Start Sprint 1
```
Read DEVPLAN.md and implement Sprint 1 (sections 1.1 through 1.3).
Add new buildings to config, implement passive building effects, and
add building visuals inside the courtyard. The shop must show all new
buildings with correct prerequisite chains.
```

### Start Sprint 2
```
Read DEVPLAN.md and implement Sprint 2 (sections 2.1 through 2.3).
Restructure weapons into 4 classes with 5 upgrade tiers each. Add the
upgrade mechanic to economy.js. Update combat to use the new weapon
lookup. All existing weapon specials must still work.
```

### Start Sprint 3
```
Read DEVPLAN.md and implement Sprint 3 (sections 3.1 and 3.2).
Create the visual tech-tree node graph for buildings and horizontal
upgrade lanes for weapons in the shop UI.
```

### Start Sprint 4
```
Read DEVPLAN.md and implement Sprint 4 (sections 4.1 through 4.4).
Upgrade entity rendering with distinct silhouettes, polish the HUD,
add shop UI cards with stat comparison, and implement particle effects.
Target 60fps at wave 40+.
```

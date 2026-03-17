# Knight Orc Assault -- Browser Replica
## Game Design Document v1.0

**Project**: Browser-based replica of Ninja Kiwi's Knight Orc Assault (Knight Elite)
**Genre**: Side-scrolling hack-and-slash / castle defense hybrid
**Platform**: Desktop web browsers (Chrome, Firefox, Safari, Edge)
**Target resolution**: 960 x 540 (16:9), scaled to fit viewport
**Target framerate**: 60 FPS

---

## Table of Contents

1. [Design Pillars](#1-design-pillars)
2. [Core Gameplay Loop](#2-core-gameplay-loop)
3. [Player Character](#3-player-character)
4. [Combat System](#4-combat-system)
5. [Enemy Design](#5-enemy-design)
6. [Wave / Level Progression](#6-wave--level-progression)
7. [Barricade & Fort System](#7-barricade--fort-system)
8. [Buildings & Economy](#8-buildings--economy)
9. [Equipment (Weapons, Armor, Shields)](#9-equipment-weapons-armor-shields)
10. [Allied Troops](#10-allied-troops)
11. [Skill / Leveling System](#11-skill--leveling-system)
12. [UI / HUD Design](#12-ui--hud-design)
13. [Scoring System](#13-scoring-system)
14. [Difficulty & Balance Tables](#14-difficulty--balance-tables)
15. [Tech Stack](#15-tech-stack)
16. [Asset Requirements](#16-asset-requirements)
17. [Onboarding / Tutorial Flow](#17-onboarding--tutorial-flow)
18. [Changelog](#18-changelog)

---

## 1. Design Pillars

1. **Hack-and-Slash Satisfaction** -- Every swing must feel impactful. Screen shake, hit flash, knockback, and crunchy SFX sell every attack. If a single orc dies and it does not feel *good*, the game has failed.
2. **Escalating Overwhelm** -- The player starts confident and ends desperate. Difficulty must ramp smoothly so that every wave survived feels earned.
3. **Build-Your-Way** -- Meaningful choices between weapons, buildings, skills, and troops let players develop distinct strategies across playthroughs.
4. **Clarity Under Chaos** -- Even with 20 enemies on screen, the player must always know where they are, what is hitting them, and what needs their attention.
5. **One More Wave** -- Session hooks must trigger at the end of every wave. The upgrade shop, new unlocks, and "what comes next" tension should make stopping difficult.

---

## 2. Core Gameplay Loop

### Moment-to-Moment (0-30 seconds)
- **Action**: Player moves to an enemy cluster, attacks with current weapon, dodges or blocks incoming damage.
- **Feedback**: Hit sparks, screen shake (2px, 50ms), damage numbers float upward, enemy knockback.
- **Micro-decisions**: Attack or block? Advance to barricade or fall back? Pick up gold drops or keep fighting?

### Session Loop (per wave, 30-120 seconds)
- **Goal**: Survive the current wave. Kill all enemies before they destroy barricades and breach the fort.
- **Tension**: Enemies approach from the right side. Barricade HP depletes under attack. Gold drops on the ground have a 10-second despawn timer.
- **Resolution**: Wave cleared. XP tallied. Gold collected. Between-wave shop opens.

### Long-Term Loop (50 waves, 60-90 minute full session)
- **Progression**: Level up, unlock buildings, buy better equipment, recruit stronger troops.
- **Retention Hook**: "Can I beat wave 50?" Boss encounters every 10 waves. New enemy types introduced at waves 5, 10, 15, 25, 35. Equipment unlocks gated behind buildings that are gated behind gold.
- **Mastery**: Elite difficulty mode after completion (enemies have 2x HP and 1.5x damage).

---

## 3. Player Character

### Base Stats
| Stat | Base Value | Notes |
|------|-----------|-------|
| Max HP | 100 | Increases via armor and skills |
| Move Speed | 180 px/s | Reduced by heavy armor |
| Attack Range | 48 px (melee), 400 px (ranged) | Depends on weapon type |
| Base Damage | 10 (shortsword) | Depends on weapon |
| Block Damage Reduction | 50% | With shield equipped |
| Invincibility Frames | 0 | No i-frames; blocking is the defense |

### Movement
- **Controls**: WASD or Arrow Keys
- **Horizontal movement**: Left/Right at `moveSpeed` px/s
- **Vertical movement**: Up/Down within the playfield lane (the game uses a pseudo-2D side view with slight vertical movement for lane positioning, approximately 100px of vertical range)
- **No jumping**: This is a ground-based combat game
- **Movement is disabled during attack animation wind-up** (first 100ms of swing)

### Health & Damage
- HP is displayed as a bar above the player and on the HUD
- When HP reaches 0, the game is over (game over screen with final score and wave reached)
- There is no passive HP regeneration unless the Axe of Regeneration is equipped
- HP can be restored via Stoneskin Potions (purchased consumable) or between-wave rest (see shop)

---

## 4. Combat System

### Attack (Left Mouse Button / Spacebar)
- **Input**: Click or press attack key
- **Animation phases**:
  - Wind-up: 100ms (player commits, cannot cancel)
  - Active: 150ms (hitbox is live, damage dealt on first contact per enemy)
  - Recovery: 200ms (can move but cannot attack again)
- **Total attack cycle**: 450ms (approximately 2.2 attacks per second base rate)
- **Cleave**: Melee weapons hit all enemies within the weapon's arc. Cleave count is a weapon stat (how many enemies one swing can damage).

### Attack Combo System
- Successive attacks within 600ms of the previous attack recovery trigger a combo chain.
- **Combo chain**: Attack 1 (normal swing) -> Attack 2 (reverse swing, +10% damage) -> Attack 3 (overhead slam, +25% damage, wider arc)
- After combo 3, the chain resets. There is a 300ms cooldown before a new chain can begin.
- Combo counter displayed briefly above player sprite.

### Blocking (Right Mouse Button / Shift)
- Requires a shield to be equipped (cannot block with two-handed weapons).
- While holding block: player movement speed reduced to 60 px/s, incoming frontal damage reduced by shield's block percentage.
- Block does NOT negate damage fully -- it reduces it. Shields have a block percentage stat.
- Blocking from behind offers no protection (enemies that flank deal full damage).
- No stamina system; blocking can be held indefinitely but at the cost of mobility and DPS.

### Knockback
- Most melee attacks knock smaller enemies back 20-40px depending on weapon weight.
- Knockback is critical for crowd control at the barricade line.
- Heavy enemies (Ogres, Titans) receive reduced knockback (5px or 0px).

### Stun-locking
- Rapid attacks can stun-lock most enemies, preventing them from attacking.
- Exception: Orc Titan and Goblin Bombers cannot be stun-locked.
- This is an intended player skill reward for aggressive play.

---

## 5. Enemy Design

### Enemy Types Table

| Enemy | HP | Damage | Speed (px/s) | Attack Rate | Gold Drop | XP | First Appears | Behavior |
|-------|-----|--------|---------------|-------------|-----------|-----|---------------|----------|
| Orc Raider | 20 | 5 | 100 | 1.0s | 5-10 | 5 | Wave 1 | Basic melee. Walks toward barricade or player. Attacks nearest target. |
| Orc Soldier | 45 | 10 | 90 | 1.2s | 10-20 | 12 | Wave 5 | Tougher melee. Has a shield that blocks first hit (shield breaks). |
| Goblin Bomber | 15 | 30 (AoE) | 130 | 2.5s (fuse) | 15-25 | 15 | Wave 8 | Suicide unit. Runs fast, explodes on contact or after fuse timer. Damages player AND nearby orcs. Cannot be stun-locked. |
| Orc Archer | 25 | 8 | 70 | 1.8s | 12-18 | 10 | Wave 10 | Ranged. Stops at 300px distance and fires arrows. Arrows can be blocked. |
| Ogre | 120 | 25 | 60 | 2.0s | 30-50 | 30 | Wave 15 | Tank. Slow but high HP/damage. Reduced knockback (5px). Can break barricades fast. |
| Orc Knight | 80 | 18 | 85 | 1.0s | 25-40 | 25 | Wave 20 | Elite melee. Has armor that reduces first 3 hits by 50%. Fast attack rate. |
| Orc Wizard | 35 | 15 (magic) | 65 | 2.5s | 20-35 | 20 | Wave 25 | Ranged caster. Magic projectiles bypass shield block (magic damage). Stops at 250px. |
| Ogre Soldier | 180 | 35 | 55 | 2.2s | 50-80 | 50 | Wave 35 | Elite tank. Even more HP than Ogre. Deals devastating damage. |
| Orc Titan (Boss) | 800 | 50 | 40 | 3.0s | 200 | 200 | Waves 10, 20, 30, 40, 50 | Boss. Cannot be stun-locked. Has 3 attack patterns (see below). Appears alongside regular enemies. |

### Enemy AI Behavior Patterns

**Basic Melee (Raiders, Soldiers, Knights)**:
1. Spawn off-screen right
2. Move left toward nearest target (barricade or player, whichever is closer)
3. When within attack range (32px), stop and attack on their attack timer
4. If target is destroyed (barricade broken), move to next target
5. If player is within 64px, prioritize attacking player over barricade

**Ranged (Archers, Wizards)**:
1. Spawn off-screen right
2. Move left until within their firing range
3. Stop and fire projectiles at the player (not barricades)
4. If player closes distance to within 48px, attempt to retreat 100px to the right
5. If cornered (at screen edge), switch to slow melee attack (half their ranged damage)

**Suicide (Goblin Bombers)**:
1. Spawn off-screen right
2. Sprint directly toward the barricade at high speed
3. On contact with barricade or player, explode dealing AoE damage in 64px radius
4. If not killed within 5 seconds of spawning, explode at current position
5. Explosion damages ALL entities in radius (including other enemies)

**Boss (Orc Titan)**:
1. Walks slowly toward fort
2. **Slam Attack**: At melee range, slams ground -- 50 damage in 80px frontal arc. 3.0s cooldown.
3. **Charge Attack**: Every 15 seconds, charges forward 200px at 200 px/s, dealing 40 damage to anything in path. Telegraphed by 1.5s wind-up animation (glowing red).
4. **Roar**: Every 30 seconds, roars to buff all nearby enemies (+25% attack speed for 5 seconds, 200px radius). Visual indicator: red aura on buffed enemies.
5. Cannot be stun-locked. Knockback immune.

---

## 6. Wave / Level Progression

### Wave Structure
- **Total waves**: 50
- **Between each wave**: 5-second countdown + shop/upgrade screen (player can skip countdown early)
- **Wave duration**: Enemies spawn over a period; wave ends when all enemies in that wave are killed
- **Spawn pattern**: Enemies spawn from the right edge at intervals defined per wave

### Wave Composition Formula

Waves are defined by a spawn table. Below is a representative sample; the full table would be generated from this pattern.

| Wave | Enemies | Composition | Boss? |
|------|---------|-------------|-------|
| 1 | 5 | 5 Raiders | No |
| 2 | 7 | 7 Raiders | No |
| 3 | 10 | 10 Raiders | No |
| 4 | 12 | 12 Raiders | No |
| 5 | 10 | 7 Raiders, 3 Soldiers | No |
| 6 | 12 | 8 Raiders, 4 Soldiers | No |
| 7 | 14 | 9 Raiders, 5 Soldiers | No |
| 8 | 12 | 6 Raiders, 4 Soldiers, 2 Bombers | No |
| 9 | 15 | 8 Raiders, 5 Soldiers, 2 Bombers | No |
| 10 | 18 | 8 Raiders, 5 Soldiers, 2 Bombers, 2 Archers + **Titan** | Yes |
| 15 | 22 | 5 Raiders, 6 Soldiers, 3 Bombers, 4 Archers, 4 Ogres | No |
| 20 | 28 | 4 Raiders, 5 Soldiers, 3 Bombers, 5 Archers, 5 Ogres, 4 Knights + **Titan** | Yes |
| 25 | 30 | 3 Raiders, 5 Soldiers, 4 Bombers, 5 Archers, 4 Ogres, 5 Knights, 4 Wizards | No |
| 30 | 35 | Mixed heavy composition + **Titan** | Yes |
| 40 | 42 | Heavy composition with Ogre Soldiers + **Titan** | Yes |
| 50 | 50 | All enemy types, maximum counts + **Titan** (2x HP) | Yes (Final) |

### Spawn Timing Per Wave
- **Spawn interval**: `max(0.8, 3.0 - (wave * 0.04))` seconds between spawns
- Wave 1: one enemy every 3.0s
- Wave 25: one enemy every 2.0s
- Wave 50: one enemy every 0.8s
- **Spawn clustering**: Every 5th enemy in a wave spawns simultaneously with the next enemy (creates occasional pressure spikes)

### Difficulty Scaling
- Enemy HP scales: `baseHP * (1 + wave * 0.02)` -- at wave 50, enemies have +100% HP
- Enemy damage scales: `baseDamage * (1 + wave * 0.015)` -- at wave 50, enemies have +75% damage
- **Elite Mode** (unlocked after beating wave 50): multiplies all enemy HP by 2x and damage by 1.5x on top of wave scaling

---

## 7. Barricade & Fort System

### Layout
The play area scrolls slightly but is primarily a fixed scene:
```
[Fort Interior | Barricade | Open Field ---------> Spawn Edge]
   Left 20%    | Position  |        Right 80%
               | ~200px    |
```

- The **fort** is on the left side of the screen. The player's base.
- The **barricade** is a defensive wall approximately 200px from the left edge.
- Enemies approach from the right.
- The player can move freely across the entire horizontal playfield.

### Barricade Stats

| Barricade Level | HP | Repair Cost | Unlock |
|-----------------|-----|-------------|--------|
| Wooden Wall (default) | 200 | Free (auto) | Start |
| Braced Wood Wall | 400 | 10 gold/repair | Lumber Mill |
| Stone Wall | 700 | 25 gold/repair | Stoneworks |
| Reinforced Stone Wall | 1200 | 50 gold/repair | Masonry |
| Iron-Bound Wall | 2000 | 100 gold/repair | Forge |

### Repair Mechanic
- Player must be within 48px of the barricade and press **F** to repair.
- Repair rate: 50 HP/second while holding F.
- Repairing costs gold per HP restored (rate depends on barricade level, see table).
- Player cannot attack while repairing.
- If the barricade is destroyed (0 HP), enemies pour into the fort interior. The barricade can still be rebuilt by holding F at its position, but it takes 3 seconds to reconstruct at 25% HP before normal repair resumes.

---

## 8. Buildings & Economy

### Gold Economy
- **Source**: Enemy drops (must be walked over to collect within 10 seconds), wave completion bonus (`50 + wave * 10` gold).
- **Sinks**: Equipment, buildings, troop recruitment, barricade repairs, consumables.
- **Expected gold income per wave** (approximate): `(enemyCount * avgGoldDrop) + waveBonus`
  - Wave 1: ~75 gold
  - Wave 10: ~350 gold
  - Wave 25: ~800 gold
  - Wave 50: ~1800 gold
- **Cumulative gold by wave 50**: approximately 25,000-35,000 gold depending on collection efficiency.

### Building Tree

Buildings are purchased between waves and unlock equipment, troops, and further buildings.

```
Start
  |
  +-- Lumber Mill (100 gold)
  |     +-- Braced Wood Walls (unlocks barricade upgrade)
  |     +-- Stoneworks (500 gold)
  |     |     +-- Stone Wall (unlocks barricade upgrade)
  |     |     +-- Masonry (2,000 gold)
  |     |           +-- Reinforced Stone Wall
  |     |           +-- Forge (5,000 gold)
  |     |                 +-- Iron-Bound Wall
  |     +-- Archery Range (300 gold)
  |           +-- Unlocks: Crossbow, Archers (troop)
  |
  +-- Barracks (200 gold)
  |     +-- Unlocks: Footmen (troop)
  |     +-- Knight Academy (1,500 gold)
  |     |     +-- Unlocks: Knights (troop)
  |     |     +-- Advanced Combat Facility (4,000 gold)
  |     |           +-- Unlocks: Shredders (troop)
  |     +-- Archery Range (shared with Lumber Mill path)
  |
  +-- Blacksmith (300 gold)
  |     +-- Unlocks: Battle Axe, Flail, Leather Armor, Chain Mail
  |     +-- Armory (1,200 gold)
  |           +-- Unlocks: Full Plate, Tower Shield, War Hammer
  |
  +-- Wizard Tower (2,500 gold)
        +-- Unlocks: Wizards (troop), Stoneskin Potions
        +-- Unlocks: Crossbow of Speed, Deflection Gladius, Axe of Regeneration
        +-- Arcane Library (8,000 gold)
              +-- Unlocks: Mithril Maul, Executioner's Sword, Flail of Thrashing
              +-- Unlocks: Maul of the Titans, Orcbane, Adamantine Plate, Templar Shield
```

---

## 9. Equipment (Weapons, Armor, Shields)

### Weapons

| Weapon | Damage | Cleave | Attack Speed | Type | Cost | Requires | Special |
|--------|--------|--------|-------------|------|------|----------|---------|
| Shortsword | 10 | 2 | 1.0x | 1H Melee | Free | Start | -- |
| Battle Axe | 20 | 3 | 0.85x | 2H Melee | 500 | Blacksmith | Cannot use shield |
| Flail | 18 | 2 | 0.9x | 1H Melee | 400 | Blacksmith | +30% knockback |
| Crossbow | 15 | 1 | 0.7x | Ranged | 600 | Archery Range | 400px range, projectile |
| War Hammer | 28 | 2 | 0.7x | 2H Melee | 1,500 | Armory | +50% knockback, cannot use shield |
| Crossbow of Speed | 12 | 1 | 1.3x | Ranged | 3,000 | Wizard Tower | 400px range, very fast fire rate |
| Deflection Gladius | 15 | 2 | 1.1x | 1H Melee | 3,500 | Wizard Tower | +20% block efficiency while equipped |
| Axe of Regeneration | 22 | 3 | 0.85x | 2H Melee | 5,000 | Wizard Tower | Passive: regenerate 2 HP/second |
| Mithril Maul | 40 | 3 | 0.65x | 2H Melee | 15,000 | Arcane Library | Massive damage, slow |
| Executioner's Sword | 35 | 4 | 0.8x | 2H Melee | 20,000 | Arcane Library | Highest cleave |
| Flail of Thrashing | 30 | 3 | 1.0x | 1H Melee | 25,000 | Arcane Library | Can use with shield, high damage |
| Maul of the Titans | 55 | 4 | 0.6x | 2H Melee | 50,000 | Arcane Library | Every 3rd swing creates AoE explosion (80px radius, 40 damage) |
| Orcbane | 70 | 5 | 0.75x | 2H Melee | 80,000 | Arcane Library | Every 3rd swing fires magic blast (200px line, 50 damage) |

**Attack Speed Modifier**: The base attack cycle is 450ms. Multiply recovery phase by `1 / attackSpeed`. A 0.7x weapon has `200 / 0.7 = 286ms` recovery, making the full cycle 536ms.

### Armor

| Armor | Damage Reduction | Speed Penalty | Cost | Requires |
|-------|-----------------|---------------|------|----------|
| None (default) | 0% | 0% | Free | Start |
| Leather Armor | 15% | -5% move speed | 200 | Blacksmith |
| Chain Mail | 30% | -15% move speed | 3,000 | Blacksmith |
| Full Plate | 50% | -30% move speed | 10,000 | Armory |
| Adamantine Plate | 55% | 0% move speed | 50,000 | Arcane Library |

### Shields

| Shield | Block % (frontal) | Cost | Requires |
|--------|-------------------|------|----------|
| Wooden Shield (default) | 40% | Free | Start |
| Iron Shield | 55% | 800 | Blacksmith |
| Tower Shield | 70% | 3,000 | Armory |
| Templar Shield | 80% | 30,000 | Arcane Library |

*Note: Shields cannot be used with 2H weapons. When a 2H weapon is equipped, the shield slot is disabled.*

### Consumables

| Item | Effect | Cost | Requires | Limit |
|------|--------|------|----------|-------|
| Stoneskin Potion | Restores 50 HP instantly | 200 | Wizard Tower | Buy between waves, use during combat (hotkey: 1). Max carry: 3 |

---

## 10. Allied Troops

Troops are recruited between waves and fight alongside the player. They respawn between waves if killed (no additional cost). Troop capacity is limited by building level.

| Troop | HP | Damage | Attack Rate | Speed | Cost | Max Count | Requires | Behavior |
|-------|-----|--------|-------------|-------|------|-----------|----------|----------|
| Footman | 40 | 8 | 1.2s | 80 | 50 | 4 | Barracks | Stands at barricade, attacks nearest enemy |
| Archer | 25 | 10 | 2.0s | 60 | 80 | 3 | Archery Range | Stands behind barricade, fires arrows at 350px range |
| Knight | 80 | 15 | 1.0s | 90 | 200 | 3 | Knight Academy | Patrols near barricade, engages enemies aggressively |
| Wizard | 30 | 20 (AoE) | 3.0s | 50 | 350 | 2 | Wizard Tower | Stands behind barricade, fires AoE spell (48px blast radius) |
| Shredder | 150 | 25 | 0.8s | 40 | 500 | 1 | Adv. Combat Facility | Mechanical unit. High HP/DPS, slow. Attacks in frontal cone. |

### Troop AI
- Troops are positioned near the barricade by default.
- Press **G** to regroup all troops to the player's current position.
- Troops auto-attack the nearest enemy within their attack range.
- Troops do not pick up gold.
- If a troop dies during a wave, they are unavailable until the next wave starts (they respawn for free).

---

## 11. Skill / Leveling System

### XP and Leveling
- XP is earned automatically when enemies die (no need to pick up).
- XP required per level: `100 * level` (Level 2 = 200 XP, Level 10 = 1000 XP)
- **Max level**: 25
- Each level grants 1 skill point.

### Skill Tree

Players choose one skill per level. Skills are organized into three branches.

**Combat Branch**
| Skill | Effect | Max Rank | Per Rank |
|-------|--------|----------|----------|
| Sword Expertise | +10% melee damage | 5 | +10% per rank (max +50%) |
| Power Strikes | +15% combo finisher damage | 3 | +15% per rank (max +45%) |
| Weapon Master | +5% attack speed | 5 | +5% per rank (max +25%) |
| Critical Strike | 5% chance to deal 2x damage | 3 | +5% per rank (max 15% crit) |

**Defense Branch**
| Skill | Effect | Max Rank | Per Rank |
|-------|--------|----------|----------|
| Toughness | +15 max HP | 5 | +15 per rank (max +75 HP) |
| Shield Expertise | +5% block efficiency | 3 | +5% per rank (max +15%) |
| Nimble | +8% movement speed | 3 | +8% per rank (max +24%) |
| Fortify | Barricades have +10% HP | 3 | +10% per rank (max +30%) |

**Economy Branch**
| Skill | Effect | Max Rank | Per Rank |
|-------|--------|----------|----------|
| Haggler | Buildings and equipment cost -5% | 3 | -5% per rank (max -15%) |
| Gold Magnet | Gold pickup radius +32px | 3 | +32px per rank (max +96px) |
| Bounty Hunter | +10% gold from enemies | 3 | +10% per rank (max +30%) |
| Commander | Troop damage +10% | 3 | +10% per rank (max +30%) |

---

## 12. UI / HUD Design

### In-Game HUD Layout

```
+------------------------------------------------------------------+
| [HP BAR ██████████░░░░] 75/100   [Wave 12/50]   [Gold: 1,250]   |
| [XP BAR ████░░░░░░░░░] Lv.8      [Enemies: 8]   [Score: 12,450] |
+------------------------------------------------------------------+
|                                                                    |
|                        GAMEPLAY AREA                               |
|                                                                    |
+------------------------------------------------------------------+
| [1] Potion x2  |  [F] Repair  |  [G] Regroup  |  [Q][E] Weapon  |
+------------------------------------------------------------------+
```

- **Top bar**: HP bar (red), XP bar (yellow), wave counter, gold, enemy count, score
- **Bottom bar**: Hotkey hints for consumables and actions
- **Floating elements**: Damage numbers (white for normal, yellow for crit, red for player damage taken), combo counter above player, enemy HP bars above enemies
- **Wave announcement**: Large centered text "WAVE 12" with 2-second fade-in/fade-out at wave start

### Between-Wave Shop Screen

```
+------------------------------------------------------------------+
|  WAVE 12 COMPLETE!                          Gold: 1,250           |
|  +20 XP earned   |   Next wave in: [5]                           |
+------------------------------------------------------------------+
|                                                                    |
|  [BUILDINGS]  [EQUIPMENT]  [TROOPS]  [SKILLS]                     |
|                                                                    |
|  +------------------+  +------------------+  +-----------------+  |
|  | Lumber Mill      |  | Battle Axe       |  | Footman x2      |  |
|  | Cost: 100g       |  | DMG: 20 CLV: 3   |  | HP:40 DMG:8     |  |
|  | [BUY]            |  | Cost: 500g       |  | Cost: 50g ea    |  |
|  +------------------+  | [BUY]            |  | [HIRE]          |  |
|                         +------------------+  +-----------------+  |
|                                                                    |
|  [START NEXT WAVE]                                                |
+------------------------------------------------------------------+
```

### Game Over Screen
```
+------------------------------------------------------------------+
|                       GAME OVER                                    |
|                                                                    |
|              You survived to Wave 34                               |
|              Final Score: 45,230                                   |
|              Enemies Killed: 312                                   |
|              Time: 42:15                                           |
|                                                                    |
|              [RETRY]    [MAIN MENU]                               |
+------------------------------------------------------------------+
```

### Victory Screen (Wave 50 cleared)
```
+------------------------------------------------------------------+
|                    VICTORY! THE ORCS RETREAT!                      |
|                                                                    |
|              Final Score: 128,450                                  |
|              Enemies Killed: 847                                   |
|              Time: 1:12:30                                         |
|                                                                    |
|              [ELITE MODE UNLOCKED]                                |
|              [PLAY AGAIN]    [MAIN MENU]                          |
+------------------------------------------------------------------+
```

---

## 13. Scoring System

| Action | Points |
|--------|--------|
| Kill Orc Raider | 10 |
| Kill Orc Soldier | 25 |
| Kill Goblin Bomber | 30 |
| Kill Orc Archer | 20 |
| Kill Ogre | 60 |
| Kill Orc Knight | 50 |
| Kill Orc Wizard | 40 |
| Kill Ogre Soldier | 100 |
| Kill Orc Titan | 500 |
| Complete wave | 100 + (wave * 20) |
| No damage taken in wave | 200 bonus |
| Barricade intact at wave end | 50 bonus |
| Combo kill (3+ kills in 2s) | 25 per kill beyond 2nd |

Score is displayed on the HUD and on the game over / victory screen. Score has no gameplay effect; it is purely for player satisfaction and replayability.

---

## 14. Difficulty & Balance Tables

### Player Power Curve (Expected Per Wave)

| Wave | Player Level | Approx. DPS | Approx. Effective HP | Expected Equipment |
|------|-------------|-------------|---------------------|-------------------|
| 1 | 1 | 22 | 100 | Shortsword, Wooden Shield |
| 10 | 5 | 40 | 130 | Battle Axe or Flail + Leather Armor |
| 20 | 10 | 75 | 180 | War Hammer or Crossbow of Speed + Chain Mail |
| 30 | 15 | 120 | 250 | Mithril Maul or similar + Full Plate |
| 40 | 20 | 180 | 320 | Endgame weapon + Adamantine Plate |
| 50 | 25 | 250 | 400 | Orcbane / Maul of Titans + best armor/shield |

### Enemy Power Curve (With Wave Scaling)

| Wave | Raider Effective HP | Raider Effective DMG | Toughest Enemy HP | Toughest Enemy DMG |
|------|--------------------|--------------------|-------------------|-------------------|
| 1 | 20 | 5 | 20 (Raider) | 5 |
| 10 | 24 | 5.75 | 960 (Titan) | 57.5 |
| 25 | 30 | 6.9 | 120+ (Ogre scaled) | 31+ |
| 50 | 40 | 8.75 | 1600 (Titan) | 87.5 |

### Balance Design Notes

All values marked with `[PLACEHOLDER]` in the tables above are initial hypotheses. The following metrics define "broken" and should be monitored during playtesting:

- **Too Easy**: Player completes a wave without taking any damage for 3+ consecutive waves (after wave 10).
- **Too Hard**: Player dies before wave 10 on their first competent attempt (player who understands controls).
- **Economy Broken (inflation)**: Player has enough gold to buy everything available by wave 30. Target: player should need to make meaningful purchase choices until wave 40+.
- **Economy Broken (starvation)**: Player cannot afford any barricade repairs and has no equipment upgrades by wave 15.
- **Stun-lock Abuse**: If the player can stun-lock an Ogre and take 0 damage, consider adding a "poise" system where enemies break free after X consecutive hits.

### Tuning Levers (Priority Order)
1. Enemy spawn count per wave (most impactful)
2. Enemy HP scaling multiplier per wave
3. Gold drop amounts
4. Weapon damage values
5. Barricade HP values
6. Troop stats
7. Skill magnitudes

---

## 15. Tech Stack

### Recommended Stack

| Component | Recommendation | Rationale |
|-----------|---------------|-----------|
| **Rendering** | HTML5 Canvas 2D (`CanvasRenderingContext2D`) | Sufficient for 2D sprite-based game. No WebGL needed. Well-supported everywhere. |
| **Language** | Vanilla JavaScript (ES6+ modules) | No framework overhead. Full control over game loop. Easy to debug. |
| **Build Tool** | Vite | Fast dev server with HMR. Handles ES module bundling. Zero-config for vanilla JS. |
| **Audio** | Web Audio API + Howler.js (optional) | Web Audio for low-latency SFX. Howler.js as a convenience wrapper if needed. |
| **Sprite Animation** | Custom sprite sheet renderer | Load sprite sheets, define frame rectangles, animate by cycling frames. No library needed. |
| **Physics** | None (custom AABB collision) | Simple axis-aligned bounding box checks. No physics engine warranted for this game. |
| **State Management** | Simple state machine (vanilla) | Game states: Menu, Playing, Shop, Paused, GameOver, Victory. Plain JS object. |
| **Asset Loading** | Custom preloader with Promise.all | Load all images and audio before game start. Show loading bar. |

### Project Structure

```
browser-KOC/
  index.html
  style.css
  src/
    main.js              -- Entry point, game loop, state machine
    config.js            -- All tuning constants (enemy stats, weapon stats, etc.)
    input.js             -- Keyboard and mouse input handler
    renderer.js          -- Canvas drawing, camera, sprite rendering
    entities/
      player.js          -- Player character logic
      enemy.js           -- Base enemy class
      enemyTypes.js      -- Enemy type definitions and factory
      troop.js           -- Allied troop logic
      projectile.js      -- Arrows, spells, bombs
      barricade.js       -- Barricade entity
      goldDrop.js        -- Gold pickup entity
    systems/
      combat.js          -- Hit detection, damage calculation, knockback
      waveManager.js     -- Wave spawning, progression, completion
      economy.js         -- Gold tracking, purchase validation
      shopUI.js          -- Between-wave shop rendering and interaction
      skillTree.js       -- Skill system, XP, leveling
      hud.js             -- In-game HUD rendering
    ui/
      mainMenu.js        -- Title screen
      gameOver.js        -- Game over screen
      victory.js         -- Victory screen
    utils/
      spriteSheet.js     -- Sprite sheet loading and frame extraction
      audio.js           -- Sound effect and music manager
      math.js            -- Clamp, lerp, random range, distance
      collision.js       -- AABB collision detection
  assets/
    sprites/             -- All sprite sheets (PNG)
    audio/
      sfx/               -- Sound effects (WAV or MP3)
      music/             -- Background music (MP3 or OGG)
    fonts/               -- Pixel art font (TTF or bitmap font PNG)
  package.json
  vite.config.js
```

### Game Loop Architecture

```javascript
// Simplified game loop structure
const TICK_RATE = 1000 / 60; // 60 FPS target

function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTimestamp) / 1000; // seconds
    lastTimestamp = timestamp;

    // Cap delta to prevent spiral of death
    const dt = Math.min(deltaTime, 0.05);

    update(dt);   // Physics, AI, input, spawning
    render();     // Draw everything to canvas

    requestAnimationFrame(gameLoop);
}
```

Use `requestAnimationFrame` for the loop. Pass `deltaTime` (in seconds) to all update functions for frame-rate independent movement.

---

## 16. Asset Requirements

### Sprite Sheets

| Asset | Dimensions (per frame) | Frames | Animations |
|-------|----------------------|--------|------------|
| Player Knight | 48x48 px | ~40 total | Idle (4f), Walk (6f), Attack1 (4f), Attack2 (4f), Attack3 (5f), Block (2f), Hit (2f), Death (5f), Repair (4f) |
| Orc Raider | 32x32 px | ~20 | Idle (4f), Walk (4f), Attack (4f), Hit (2f), Death (4f) |
| Orc Soldier | 32x36 px | ~22 | Same as Raider + Shield break (2f) |
| Goblin Bomber | 24x28 px | ~16 | Run (4f), Fuse-lit (4f), Explode (4f), Death (4f) |
| Orc Archer | 32x32 px | ~20 | Idle (4f), Walk (4f), Shoot (4f), Hit (2f), Death (4f) |
| Ogre | 48x56 px | ~20 | Idle (4f), Walk (4f), Attack (4f), Hit (2f), Death (4f) |
| Orc Knight | 36x40 px | ~22 | Same as Orc Soldier |
| Orc Wizard | 32x36 px | ~20 | Idle (4f), Walk (4f), Cast (4f), Hit (2f), Death (4f) |
| Ogre Soldier | 52x60 px | ~20 | Same as Ogre |
| Orc Titan (Boss) | 80x96 px | ~30 | Idle (4f), Walk (4f), Slam (5f), Charge (4f), Roar (4f), Hit (2f), Death (6f) |
| Footman | 32x32 px | ~16 | Idle (4f), Attack (4f), Hit (2f), Death (4f) |
| Archer (ally) | 32x32 px | ~16 | Idle (4f), Shoot (4f), Hit (2f), Death (4f) |
| Knight (ally) | 36x36 px | ~16 | Same as Footman |
| Wizard (ally) | 32x36 px | ~16 | Idle (4f), Cast (4f), Hit (2f), Death (4f) |
| Shredder | 48x40 px | ~12 | Idle (4f), Attack (4f), Death (4f) |

### Environment

| Asset | Size | Notes |
|-------|------|-------|
| Background (sky, mountains) | 960x540 px | Parallax layers (2-3 layers) |
| Fort interior | 200x540 px | Left side of play area |
| Barricade (5 levels) | 48x120 px each | One sprite per barricade level, plus damaged/destroyed variants |
| Ground tile | 64x64 px | Repeating grass/dirt tile |
| Gold coin pickup | 16x16 px | 4-frame sparkle animation |
| Arrow projectile | 16x4 px | 1 frame + rotation |
| Magic projectile | 16x16 px | 4-frame loop |
| Explosion effect | 64x64 px | 6 frames |
| Hit spark effect | 16x16 px | 3 frames |

### UI Art

| Asset | Notes |
|-------|-------|
| HP bar frame + fill | 200x20 px, red fill |
| XP bar frame + fill | 200x16 px, yellow fill |
| Enemy HP bar | 32x4 px, red fill |
| Button sprites (normal, hover, pressed) | Variable size, 9-slice |
| Building icons (for shop) | 32x32 px each, ~10 buildings |
| Weapon icons (for shop/HUD) | 24x24 px each, ~13 weapons |
| Armor icons | 24x24 px each, ~5 armors |
| Shield icons | 24x24 px each, ~4 shields |
| Skill icons | 24x24 px each, ~12 skills |
| Troop icons | 24x24 px each, ~5 troop types |
| Potion icon | 16x16 px |
| Font | Pixel art bitmap font or Google Fonts "Press Start 2P" |

### Audio

| Asset | Type | Notes |
|-------|------|-------|
| Sword swing (3 variations) | SFX | Short whoosh |
| Sword hit (3 variations) | SFX | Metal/flesh impact |
| Axe/hammer hit | SFX | Heavy thud |
| Crossbow fire | SFX | Twang |
| Arrow impact | SFX | Thunk |
| Magic cast | SFX | Sparkle/woosh |
| Magic impact | SFX | Arcane burst |
| Explosion | SFX | Boom |
| Enemy death (3 variations) | SFX | Orc grunt/collapse |
| Player hit | SFX | Armor clang + grunt |
| Player death | SFX | Dramatic collapse |
| Gold pickup | SFX | Coin clink |
| Barricade hit | SFX | Wood/stone crack |
| Barricade break | SFX | Crash |
| Repair | SFX | Hammering loop |
| Wave start horn | SFX | War horn |
| Wave complete | SFX | Fanfare |
| Button click | SFX | UI click |
| Purchase | SFX | Cash register / forge sound |
| Level up | SFX | Chime |
| Titan roar | SFX | Deep bellow |
| Battle music (looping) | Music | Intense medieval, ~2-3 min loop |
| Shop music (looping) | Music | Calm medieval, ~1-2 min loop |
| Menu music (looping) | Music | Atmospheric, ~1-2 min loop |
| Victory jingle | Music | Triumphant, ~10 seconds |
| Game over sting | Music | Somber, ~5 seconds |

---

## 17. Onboarding / Tutorial Flow

### Wave 1 serves as the tutorial. No separate tutorial mode.

| Beat | Trigger | On-Screen Text | Player Learns |
|------|---------|---------------|---------------|
| 1 | Game start | "WASD to move" (bottom center, fades after player moves) | Movement |
| 2 | After moving | "Click to attack" | Basic attack |
| 3 | First enemy in range | "Strike the orcs!" | Combat engagement |
| 4 | First kill | "Collect the gold!" (arrow pointing to gold drop) | Gold economy |
| 5 | Wave 1 complete | Shop opens with only Lumber Mill and Barracks visible | Shop navigation |
| 6 | First shop purchase | "Build structures to unlock weapons and allies" | Building progression |
| 7 | Wave 2 start | No more tutorials. Player is on their own. | -- |

### Design Principles for Onboarding
- First wave has only 5 weak Raiders. Guaranteed success.
- No shield tutorial needed; player starts with one and will discover Right-Click naturally.
- Barricade repair is not prompted until the barricade takes damage (wave 3-4 typically). "Press F near barricade to repair" appears when barricade drops below 75% HP for the first time.
- Tutorial text uses the pixel font, appears as floating banners that fade after 3 seconds or after the action is performed.

---

## 18. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-17 | Initial GDD. Complete mechanics, economy, enemy design, tech stack, asset list. |

---

*This is a living document. All numerical values are initial hypotheses marked for playtesting. Update this document with each significant design revision.*

---

Sources:
- [Knight Orc Assault - Flash Gaming Wiki](https://flashgaming.fandom.com/wiki/Knight_Orc_Assault)
- [Knight Elite - Orc Assault - Ninja Kiwi](https://ninjakiwi.com/Games/Action/Knight-Elite.html)
- [Knight Elite - Walkthrough, Tips, Review - JayIsGames](https://jayisgames.com/review/knight-elite.php)
- [Knight Orc Assault - Miniplay](https://www.miniplay.com/game/knight-orc-assault)
- [Ninja Kiwi Archive - Steam Discussions](https://steamcommunity.com/app/1275350/discussions/0/591767669138588819/)

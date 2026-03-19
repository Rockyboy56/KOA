# Knight Orc Assault — Visual Gap Analysis

Reference video: "What's At Ninja Kiwi? #2" by Aliensrock (YouTube)
Reference video: "Knight Elite - Ninjas" by NinjakiwiChris (YouTube)

---

## Original Game Visual Style (from video analysis)

### Art Direction
- **Hand-painted 2D art** — not pixel art, closer to Warcraft III / Flash game era illustration
- **Top-down 3/4 perspective** with slight isometric lean
- **Warm earth tones** — dirt is tan/sandy (#c4a882), grass is vibrant green (#4a8a2a), stone is cool grey (#9a9a9a)
- **Organic textures** — everything has painted noise/grain, nothing is a flat color
- **Scale**: Characters are roughly 24-32px tall at game resolution

### Terrain & Environment
- **Grass field**: vibrant green with subtle darker patches and small highlight sparkles
- **Dirt/combat area**: sandy brown with stone texture variation, lighter patches (like dried mud puddles)
- **Fort walls**: curved wooden palisade with large round corner posts (like log towers)
- **Barricade/gate**: wooden gate frame with metal reinforcements, stone archway surround
- **Fort interior**: stone/cobble floor visible through the gate entrance
- **Transition zones**: grass blends into dirt naturally, no hard edges

### Characters & Entities
- **Player knight**: ~28px tall, visible round shield (blue), helmet, weapon swing arc visible, animated movement
- **Enemy orcs**: green-skinned, ~20-24px, distinct poses — some with swords, some larger (ogres)
- **Friendly troops**: blue-tinted units, visually distinct from enemies, smaller than player
- **All characters have visible shadows** on the ground
- **Character art is hand-drawn/illustrated**, not geometric shapes

### HUD & UI
- **Bottom bar**: HP (red/green bar), XP bar below it, level display ("73/100 to level 7")
- **Top-left**: Score + Wave counter ("wave 11 / 50")
- **Bottom-right**: SHOP button (gold shield icon with text), gold count, gem count
- **Bottom-left**: REGROUP button (red text)
- **Floating text**: "crit!" pops up during combat, damage numbers float
- **Gold drops**: blue orbs + gold coins on ground (must walk over to collect)

### Shop/Menu UI
- **Parchment/leather texture background** — aged paper look with gold border
- **Tab navigation across top**: buy, premium, build, train, rank
- **Troop cards**: hand-drawn portrait illustrations in bordered cards
- **Locked items shown as dark silhouettes** with the name still visible
- **Medieval/fantasy font** for all headers ("TRAIN", "BUILD")
- **Gold display** in top-right of shop
- **Building tech tree**: interconnected node graph with lines between dependencies

### Wave Complete Screen
- **Dark overlay** with large medieval text "Wave 5 Complete"
- **Checkpoint notification** text
- **Reward display**: gold icon + amount
- **Action buttons**: "get more gold", "get more xp", "buy equipment & view skills", "fight on!"

### Effects & Polish
- **"crit!" floating text** on critical hits
- **Damage numbers** floating above enemies
- **Gold/XP orbs** scatter on enemy death
- **Weapon swing arcs** visible during attacks
- **Character shadows** under all entities
- **Subtle grass sparkle particles** in the field

---

## Browser KOC Current State (from codebase)

### Art Direction
- **Colored rectangles and circles** — geometric primitives
- **Flat colors** — no textures, gradients, or painted feel
- **Side-view perspective** (being changed to top-down in Sprint 0)

### Terrain
- Flat green rectangle (grass)
- Flat brown rectangle (dirt)
- Simple fort shape on left side

### Characters
- Player: colored rectangle with basic shape
- Enemies: colored circles/rectangles per type
- Troops: basic geometric shapes
- No shadows, no animation frames

### HUD
- Basic text and rectangular bars
- Functional but no icons, no polish

### Shop UI
- Text-based lists
- No portrait cards, no parchment background
- No visual tech tree

---

## Key Visual Gaps (Priority Order)

### 1. TERRAIN TEXTURES (Biggest Impact)
**Gap**: Flat solid colors → Hand-painted textured surfaces
**Fix**: Generate noise-based textures on Canvas for grass, dirt, stone, cobblestone. Add variation patches. This alone transforms the look.

### 2. CHARACTER ART (Second Biggest)
**Gap**: Rectangles/circles → Illustrated character sprites
**Fix**: 16-32px pixel art sprites for player, each enemy type, and troops. Even simple pixel art is a massive upgrade over colored rectangles.

### 3. BARRICADE/FORT RENDERING
**Gap**: Simple brown rectangle → Detailed wooden gate with metal reinforcements and stone archway
**Fix**: Draw multi-part barricade: wooden planks, round corner posts, gate frame, stone trim.

### 4. HUD POLISH
**Gap**: Plain text bars → Styled bars with icons
**Fix**: Add heart icon for HP, star for XP, coin for gold, gem for crystals. Smooth bar animations. Medieval-style SHOP button.

### 5. FLOATING COMBAT TEXT
**Gap**: No floating text → "crit!" and damage numbers
**Fix**: Spawn floating text entities on damage events with upward drift and fade.

### 6. SHOP UI THEMING
**Gap**: Plain text lists → Parchment background with portrait cards
**Fix**: Draw parchment texture, bordered card frames, silhouette states for locked items. Medieval font headers.

### 7. SHADOWS & DEPTH
**Gap**: No shadows → All entities cast ground shadows
**Fix**: Draw dark ellipse under each entity before drawing the entity itself.

### 8. GOLD/DROP PRESENTATION
**Gap**: Simple circles → Animated orbs with sparkle
**Fix**: Add glow effect, slight bob animation, sparkle particles around drops.

### 9. PARTICLE EFFECTS
**Gap**: No particles → Death bursts, sparkles, combat effects
**Fix**: Object-pooled particle system for death, gold pickup, crit hits, ambient.

### 10. WAVE COMPLETE SCREEN
**Gap**: Basic text → Styled overlay with rewards display
**Fix**: Dark semi-transparent overlay, large medieval text, reward icons, action buttons.

---

## Recommended Approach

The visual upgrade prompt already covers most of these gaps. The key insight from watching the original is that **KOA uses a hand-painted Flash art style, not pixel art**. However, for Browser KOC, 16-32px pixel art is actually a great choice because:

1. It's achievable with programmatic Canvas drawing (no external assets needed)
2. It gives characters distinct, recognizable silhouettes
3. It has its own charm while being clearly "inspired by" rather than a direct copy
4. It's much easier to maintain and modify than hand-painted art

The biggest bang-for-buck visual upgrades are:
1. **Textured terrain** (noise-based grass/dirt/stone)
2. **Character sprites** (even simple 16px pixel art is 10x better than rectangles)
3. **Entity shadows** (adds depth instantly)
4. **Floating damage numbers** (makes combat feel responsive)

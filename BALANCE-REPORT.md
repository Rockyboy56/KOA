# KOA Balance Report — Sprint 5 Pre-Implementation Review
**Date:** 2026-03-19
**Scope:** Sprint 5 sections 5.3 (Active Skills) and 5.7 (Balance Pass)
**Sources analyzed:** `src/config.js`, `src/systems/waveManager.js`, `DEVPLAN.md`

---

## 1. Active Skills Verdict (Sprint 5.3)

### Proposed skills
| Skill | Cost | Cooldown | Effect | Requires |
|-------|------|----------|--------|----------|
| War Cry | 800g | 45s | Stun all on-screen enemies 2s | barracks |
| Shield Bash | 600g | 30s | Knock nearby enemies back 150px | none |

### Passive skill context
Passive skills (SKILLS in config.js) are XP-rank based — no gold cost. Active skills compete for gold, not skill points. The comparison is therefore: **800g active skill vs. what else 800g buys at wave 5-10** (Iron Shield 800g, Flail 800g, Engineering Workshop 800g).

---

### War Cry — REJECTED AS DESIGNED

**Problem: Severely undercosted and undercooled for its effect.**

At wave 20+, 15-25 enemies are alive simultaneously (see composition table in §3). A 2-second stun on all of them at 45s cooldown means the skill fires every 45 seconds for a guaranteed "pause all damage" window.

**Effective value calculation (wave 20, typical conditions):**
- Enemies deal roughly 60-120 combined DPS at wave 20
- 2s stun prevents ~120-240 HP of incoming damage per use
- Player max HP with Toughness rank 5: 100 + 75 = 175 HP
- One War Cry = blocking ~70–140% of player's HP in damage → effectively a guaranteed survival button every 45 seconds

**Comparison:** Stoneskin Potion heals 50 HP for 200g and requires Wizard Tower. War Cry prevents ~150-240 HP equivalent for 800g with barracks-only requirement. War Cry is ~3-5× more gold-efficient on defense.

**Recommended changes:**
- Raise cost to **1,500g** (in line with Knight Academy, a mid-tier unlock)
- Raise cooldown to **60s** (2 uses per ~2min wave instead of ~2.7)
- OR reduce stun duration to **1.5s** at current cost/cooldown
- Keep barracks requirement — the building cost (200g) is already gating it somewhat

---

### Shield Bash — APPROVED WITH MINOR ADJUSTMENT

**Effect is well-scoped.** Knockback without stun is repositioning, not CC. It doesn't prevent damage — enemies return immediately. 150px knockback is roughly 1-2 enemy widths.

**Concerns:**
- 30s cooldown in a late-game wave (waves 30+) lasting 90-120 seconds means 3-4 uses per wave. That's frequent enough that the player can reliably cancel every ogre rush.
- No requirement means it's available from wave 1 — before enemies are threatening enough to need it.

**Recommended changes:**
- Raise cooldown to **38s** (prevents it from firing 3× reliably in one wave)
- Add soft requirement: **barracks** (100g building, already cheap) — keeps it accessible but signals it's a combat tool
- Cost of 600g is appropriate for a repositioning skill

---

## 2. Paper Economy Simulation — Waves 1–50

### Gold income per wave (calculated)

**Formulas used:**
- `getWaveBonus(wave) = 50 + wave * 10`
- Enemy avg gold = `(goldMin + goldMax) / 2`
- Wave composition from `getWaveComposition()` in `waveManager.js`

| Wave | Enemy composition (count) | Kill gold | Wave bonus | Total income |
|------|--------------------------|-----------|------------|-------------|
| 1 | 5 raiders | 38g | 60g | **98g** |
| 2 | 7 raiders | 53g | 70g | **123g** |
| 3 | 9 raiders | 68g | 80g | **148g** |
| 4 | 11 raiders | 83g | 90g | **173g** |
| 5 | 9 raiders, 1 soldier | 83g | 100g | **183g** |
| 8 | 9 raiders, 3 soldiers | 113g | 130g | **243g** |
| 10 | 8 raiders, 4 soldiers, 1 bomber, 1 archer | 155g | 150g | **305g** |
| 15 | 7r, 8s, 3b, 3a, 1 titan | 478g | 200g | **678g** |
| 20 | 6r, 8s, 5b, 6a, 2 ogres | 435g | 250g | **685g** |
| 25 | 5r, 8s, 6b, 6a, 4 ogres, 2 knights, 1 titan | 793g | 300g | **1,093g** |
| 30 | 4r, 8s, 6b, 6a, 6 ogres, 4 knights, 2 wizards | 785g | 350g | **1,135g** |
| 35 | 3r, 8s, 6b, 6a, 6 ogres, 5 knights, 3 wizards, 1 titan | 1,038g | 400g | **1,438g** |
| 40 | 2r, 8s, 6b, 6a, 6 ogres, 6 knights, 5 wizards, 1 ogreSoldier | 983g | 450g | **1,433g** |
| 45 | 2r, 8s, 6b, 6a, 6 ogres, 6 knights, 5 wizards, 3 ogreSoldiers, 1 titan | 1,313g | 500g | **1,813g** |
| 50 | 2r, 8s, 6b, 6a, 6 ogres, 6 knights, 5 wizards, 4 ogreSoldiers, 1 titan | 1,378g | 550g | **1,928g** |

**Approximate cumulative gold by wave (no spending):**
| After wave | ~Total earned |
|------------|--------------|
| 5 | 725g |
| 10 | 1,725g |
| 15 | 3,525g |
| 20 | 6,875g |
| 25 | 12,340g |
| 30 | 17,715g |
| 35 | 24,605g |
| 40 | 31,770g |
| 45 | 38,835g |
| 50 | 47,470g |

### Dead Zones Identified

#### DEAD ZONE A — Waves 11–14 (Mild)
**Problem:** Player earns ~300g/wave but the shop offers a gap between affordable small items (Stoneworks 500g done, Iron Shield 800g maybe done) and next meaningful tier (Knight Academy 1500g, Armory 1200g). A player who bought Stoneworks, Archery Range, and Iron Shield is sitting on 300g/wave with nothing to spend on for 2-3 waves.

**Recommended fix:** Add a mid-tier military building at ~700g (e.g., "Watchtower" that increases troop attack range by 50px). Fills the gap without breaking the economy curve.

---

#### DEAD ZONE B — Waves 21–24 (Significant)
**Problem:** Player earns 650-700g/wave. After buying Knight Academy (1500g), Armory (1200g), and Weaponsmith (1000g) by wave 20, the next targets are Crystal Mine (3000g), Wizard Tower chain (apothecary 400g + alchemist lab 1500g + wizard tower 2500g = 4400g), or War Hammer (3000g). All require 4-5 waves of saving. Meanwhile there's nothing useful to buy in the 600-1000g range that hasn't been purchased already.

**Recommended fix:**
- Add a cheap consumable upgrade (e.g., Potion Belt upgrade: carry +2 potions, 500g) at this tier
- Or reduce Alchemist Lab to 1,000g (currently 1,500g) to smooth entry into the magic chain

---

#### DEAD ZONE C — Waves 26–34 (Significant — longest gap)
**Problem:** Player earns 1,000-1,135g/wave. After buying everything through mid-tier (Armory, Knight Academy, Weaponsmith, Crystal Mine), the targets are:
- Master Forge: 6,000g → 5-6 waves of saving
- Wizard Tower chain: ~4,400g chain minimum → 4 waves after crystal mine, then Arcane Library at 8,000g = another 7+ waves

A player saving for Arcane Library from wave 26 (with ~5,000g in hand) won't reach the 12,400g total chain cost until wave ~30, and then needs 8,000g more = another 7 waves. That's a **10+ wave dead zone with nothing meaningful to buy** during the save.

**Recommended fix:**
- Add 1-2 mid-tier weapons in the 4,000-7,000g range that don't require arcane unlock (e.g., an Axe tier between Executioner and Axe of Regen)
- Or reduce Arcane Library from 8,000g to 6,000g (Master Forge-equivalent cost for the magic branch)

---

#### DEAD ZONE D — Waves 36–50 (Severe — endgame economy collapse)
**Problem:** The five endgame items (Orcbane 50,000g, Adamantine Plate 50,000g, Maul of Titans 45,000g, Berserker Axe 35,000g, Arcane Repeater 25,000g) are priced far above what the player can earn in a 50-wave run.

Total gold earnable across all 50 waves: **~47,500g** (without economy buildings)
With Gold Mine + Treasury boosts: ~55,000-60,000g maximum

A player who has bought ~20,000-25,000g of buildings, armor, and weapons by wave 35 has ~20,000-25,000g left to spend on waves 36-50. The cheapest endgame item (Arcane Repeater 25,000g) is essentially all remaining gold. Orcbane (50,000g) and Adamantine Plate (50,000g) are **completely unreachable** in a single playthrough even with zero spending after wave 30.

**Recommended fixes:**
- Reduce endgame costs: Orcbane → 35,000g, Adamantine → 35,000g, Maul of Titans → 30,000g, Berserker Axe → 22,000g, Arcane Repeater → 18,000g
- Or increase late-wave income: ogreSoldier gold drops from 50-80g to 80-120g avg
- Or make Treasury compound: +30% wave bonus PLUS +10g per wave for each enemy type unlocked (scales with difficulty)

---

### Wave Composition Formula Bugs

Several enemy types listed with a `firstWave` value do not actually appear on that wave due to floor() rounding in `getWaveComposition()`:

| Enemy | Config firstWave | Actual first appearance | Formula at firstWave |
|-------|-----------------|------------------------|---------------------|
| bomber | 8 | **Wave 9** | `floor((8-6)*0.4)` = `floor(0.8)` = **0** |
| ogre | 15 | **Wave 16** | `floor((15-13)*0.4)` = `floor(0.8)` = **0** |
| orcKnight | 20 | **Wave 21** | `floor((20-18)*0.35)` = `floor(0.7)` = **0** |
| wizard | 25 | **Wave 27** | `floor((25-23)*0.3)` = `floor(0.6)` = **0** |
| ogreSoldier | 35 | **Wave 37** | `floor((35-33)*0.25)` = `floor(0.5)` = **0** |

These are off-by-1 to off-by-2 delays. The wave flavour text in 5.6 references these specific waves ("Wave 5: Orc Soldiers join the assault", "Wave 8: Goblin Bombers detected") so the text fires 1-2 waves before the enemies actually spawn. The flavour text will feel misleading.

**Recommended fix:** Adjust `firstWave` values in ENEMIES to match actual first appearance, OR fix the formulas to use ceiling instead of floor for the first instance:
```js
// Example fix for ogreSoldier:
if (wave >= 35) add('ogreSoldier', Math.min(4, Math.max(0, Math.floor((wave - 32) * 0.25))));
// wave 35: floor(3*0.25) = 0... still broken. Better: change threshold.
// if (wave >= 35) add('ogreSoldier', Math.min(4, Math.ceil((wave - 34) * 0.4)));
// wave 35: ceil(1*0.4) = ceil(0.4) = 1 ✓
```

---

## 3. OgreSoldier Stats Verdict (Wave 35)

**Config:** `hp: 180, damage: 35, speed: 55, attackRate: 2.2, knockbackResist: 0.9`

**Effective stats at wave 35 (with scaling):**
- HP: `180 × (1 + 35×0.02)` = `180 × 1.70` = **306 HP**
- Damage per hit: `35 × (1 + 35×0.015)` = `35 × 1.525` = **53.4 dmg**
- DPS: `53.4 × 2.2` = **117.5 DPS**

**Player survivability at wave 35 (with full plate, 50% reduction):**
- Effective DPS taken: `117.5 × 0.5` = **58.75 DPS**
- Player max HP (Toughness rank 5): 100 + 75 = **175 HP**
- Time to death: 175 / 58.75 ≈ **~3.0 seconds**

**Compare to Ogre at wave 15:**
- Effective stats: `120 × 1.30` = 156 HP, `25 × 1.225` = 30.6 dmg, 2.0 rate → 61.2 DPS
- With chain mail (30% reduction): 61.2 × 0.7 = 42.8 DPS → time to death ~2.9s

The ogreSoldier at wave 35 is tuned comparably to ogre at wave 15 relative to expected player gear — which is **correct scaling**. The wave 35 player should have Full Plate available. The ogreSoldier is tough but not unreasonable.

**HOWEVER — formula bug makes ogreSoldiers appear at wave 37, not 35.** See §2. This means the wave 35 boss wave has no ogreSoldiers (just the titan), which makes wave 35 *easier* than designed, and wave 37-38 suddenly spikes without a boss. This creates an unintentional difficulty inversion.

**Verdict: Stats are APPROVED for a wave 35 enemy, but the formula must be fixed so they appear on wave 35 as designed.**

---

## 4. Ranged vs Melee DPS Verdict

### DPS table (attack formula: `damage × speed / 0.45`, single-target)

| Weapon | Tier | Cost | DPS | vs same-tier sword |
|--------|------|------|-----|--------------------|
| Shortsword | S1 | 0g | 22.2 | — |
| Light Crossbow | R1 | 300g | **15.6** | -30% |
| Longsword | S2 | 400g | 35.6 | — |
| Crossbow | R2 | 800g | **26.7** | -25% |
| Broadsword | S3 | 1,500g | 50.7 | — |
| Heavy Crossbow | R3 | 2,500g | **31.8** | -37% |
| Runic Blade | S4 | 8,000g | 81.7 | — |
| Crossbow of Speed | R4 | 6,000g | **52.0** | -36% |
| Orcbane | S5 | 50,000g | 116.7 | — |
| Arcane Repeater | R5 | 25,000g | **73.3** | -37% |

**Axes DPS reference:** HandAxe 28.0 → BattleAxe 41.6 → ExecAxe 56.9 → AxeRegen 71.8 → BerserkerAxe 110.0
**Maces DPS reference:** Mace 22.7 → Flail 36.0 → WarHammer 43.6 → MithrilMaul 57.8 → MaulTitans 80.0

### Findings

**Ranged DPS deficit grows from -30% at T1 to -37% at T3-T5.** The gap should widen slightly at higher tiers to compensate for range/safety advantages — a 15-25% penalty is defensible. A 35-37% penalty makes ranged feel punishing even with pierce.

**Critical problem — pierce doesn't compensate in this game's geometry:** Enemies converge on 4 gates in clusters, but pierce only works on the projectile path (linear). In a crowd of 10 enemies mobbing a gate, a pierce-2 bolt hits at most 2 enemies in a line. Melee cleave-3/4 hits all enemies in a radius simultaneously. The actual multi-target DPS advantage of pierce vs. cleave likely favors melee.

**Crossbow of Speed (T4) is well-priced but anomalous in design:**
- It costs *less* than Runic Blade T4 (6,000g vs 8,000g) but has 37% lower DPS
- Its speed (1.3) makes it functionally feel like a different weapon class than the slow-fire crossbow line
- It should be a distinct branch or renamed to signal the playstyle shift

**Specific anomaly — Heavy Crossbow (T3, 2,500g) to Crossbow of Speed (T4, 6,000g):**
The cost jump is 3,500g for a DPS increase from 31.8 → 52.0 (+64%). Compare: War Hammer (T3 mace, 3,000g) has 43.6 DPS. Crossbow of Speed at 6,000g has 52 DPS — only 19% better than War Hammer at half the cost. Ranged T4 is not worth its price relative to melee T3.

**Verdict: Ranged is NOT a viable alternative at the same tier as stated in DEVPLAN 5.7. Specific recommendations:**

1. **Light Crossbow T1:** Increase damage from 10 to 13 → DPS 20.2 (-9% vs Shortsword, acceptable for ranged safety)
2. **Crossbow T2:** Increase damage from 15 to 19 → DPS 33.8 (-5% vs Longsword)
3. **Heavy Crossbow T3:** Increase damage from 22 to 27, or increase speed from 0.65 to 0.80 → DPS ~48.0 (-5% vs Broadsword)
4. **Crossbow of Speed T4:** Reduce cost from 6,000g to 4,500g to better match its actual DPS value
5. **Arcane Repeater T5:** Increase damage from 30 to 38 → DPS 92.9 (-20% vs Orcbane, appropriate given pierce3)

---

## 5. Additional Balance Issues Spotted

### 5.1 Potion economy mismatch
The Stoneskin Potion (`heal: 50, cost: 200g, requires: wizardTower`) requires a 4,400g building chain for a 200g consumable. Even the planned Minor Heal Potion (25 HP, 100g) is effectively a +25 HP burst — equivalent to ~1.7 Toughness ranks but spendable. Players will skip potions entirely due to the perceived low value-per-gold vs. permanent upgrades.

**Recommend:** Increase Stoneskin Potion heal to 75 HP (at 200g it competes better with the Toughness skill). Minor Heal Potion at 100g / 25 HP is fine for early access.

### 5.2 Troop cost-utility ratio
| Troop | Cost | DPS | HP | Verdict |
|-------|------|-----|----|---------|
| Footman | 50g | 9.6 | 40 | Fair — cheap cannon fodder |
| Archer | 80g | 20.0 | 25 | Good — 350 range, but fragile |
| Knight | 200g | 15.0 | 80 | Underperforms vs Archer at 2.5× cost |
| Wizard | 350g | 60.0 | 30 | Very strong (AOE 48px), but requires wizardTower |
| Shredder | 500g | 20.0 | 150 | Poor DPS for cost; slow but tanky |

**Knight (200g, 15 DPS) vs Archer (80g, 20 DPS):** The Knight costs 2.5× more and deals 25% less damage with higher HP. Its value is durability, but 80 HP dies fast to ogres regardless. Knight needs either higher damage (18→20+) or a cost reduction to 150g.

**Shredder (500g, 20 DPS, 150 HP):** The highest-cost troop has the same DPS as the cheapest ranged troop. Its slow speed (40) means it rarely reaches enemies before they're killed. Consider raising Shredder damage to 35-40 to justify its cost.

### 5.3 War Cry requires barracks — timing concern
If War Cry requires barracks (200g) and costs 800g, a player can buy it at wave 4-5 total (~700g earned). This means War Cry is available starting from **wave 5**, when only raiders and soldiers are present — earlier than intended for a "stun all enemies" ability. The `requires: 'barracks'` gating is weak; consider `requires: 'knightAcademy'` (1,500g gate) to push it to wave ~8-10 accessibility.

### 5.4 Crystal Mine crystals are undefined
`crystalMine: cost 3000g, requires goldMine, unlocks treasury` — the passive effect adds "+5 crystals per wave" but `crystals` is not defined in the economy state anywhere in the current codebase. Treasury also references crystals. This system appears incomplete and may cause silent bugs when these buildings are purchased.

### 5.5 Adamantine Plate speedPenalty inconsistency
`adamantine: { reduction: 0.55, speedPenalty: 0, cost: 50,000g }` — the best armor has ZERO speed penalty while Full Plate (50% reduction) has a 30% speed penalty. This means the most expensive, most protective armor is also faster than the mid-tier armor. This breaks the armor tradeoff design entirely. Adamantine Plate should have a `speedPenalty: 0.15` or Full Plate's penalty should be reduced to make the curve consistent.

---

## Summary Table

| Issue | Severity | Recommendation |
|-------|----------|----------------|
| War Cry: undercosted/undercooled | HIGH | Cost 1,500g, cooldown 60s |
| Shield Bash: cooldown slightly short | LOW | Cooldown 38s |
| Dead zone waves 21–24 | MEDIUM | Add ~700g item or reduce Alchemist Lab to 1,000g |
| Dead zone waves 26–34 | HIGH | Add mid-tier weapons 4,000-7,000g range |
| Dead zone waves 36–50 (endgame) | HIGH | Reduce T5 costs 30-40% |
| Formula bugs: enemies appear 1-2 waves late | MEDIUM | Fix composition thresholds |
| OgreSoldier stats: approved | OK | Fix formula so they appear at wave 35 |
| Ranged DPS: 35-37% deficit at T3-T5 | HIGH | Increase ranged damage at T1-T5 (specific numbers above) |
| Crossbow of Speed T4: overpriced | MEDIUM | Reduce cost to 4,500g |
| Knight troop: underperforms | LOW | Raise damage to 20 or reduce cost to 150g |
| Shredder troop: underperforms | LOW | Raise damage to 35-40 |
| Crystal Mine crystals undefined | HIGH | Implement crystal economy or revert to gold-only effect |
| Adamantine Plate: no speed penalty | MEDIUM | Add speedPenalty: 0.15 |
| Stoneskin Potion: low value | LOW | Raise heal to 75 HP |
| War Cry: barracks gate too early | MEDIUM | Change requires to 'knightAcademy' |

---

*No game files were modified. This report is output only.*

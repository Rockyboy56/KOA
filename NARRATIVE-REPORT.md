# KOA Narrative Report — Sprint 5 Final Approved Text
**Date:** 2026-03-19
**Scope:** Sprint 5 sections 5.2 (Boss Intro Cards) and 5.6 (Wave Flavour Text)
**Sources reviewed:** `DEVPLAN.md`, `BALANCE-REPORT.md`

---

## 1. Final Boss Entry Table

These entries populate `ENEMIES.titan.bosses[]` in `config.js` and appear on the boss intro card (wave freeze, 2s display, then boss spawns).

| Wave | Boss Name | Lore Line |
|------|-----------|-----------|
| 15 | Iron Fist | Gates fall before him. This one holds. |
| 25 | Bloodtusk | They say he has never bled. Prove them wrong. |
| 35 | The Siege King | He has broken a hundred forts. Not this one. |
| 45 | Warchief Gronn | The horde bows to him. Your walls do not. |
| 50 | The Ruinbringer | He doesn't want your gold. He wants this fort erased. |

---

## 2. Final Wave Flavour Text

These strings populate `WAVE_FLAVOUR` in `config.js` and appear as small italic text under the wave number in `drawWaveAnnouncement()`.

### Waves 1–10 (All entries, including new waves 2/3/4/6/7/9)

| Wave | Flavour Text |
|------|-------------|
| 1 | `The siege begins. Hold the line.` |
| 2 | `More of them. Keep swinging.` |
| 3 | `The raiders won't stop. Neither will you.` |
| 4 | `Pushing harder now. Stay sharp.` |
| 5 | `Orc Soldiers hit the field. They hit harder — plan accordingly.` |
| 6 | `New angles on the attack. Keep every gate covered.` |
| 7 | `The raid keeps growing. Keep pace.` |
| 8 | `Bombers spotted in the vanguard. Don't let them near the walls.` |
| 9 | `Those bombers are live. Watch every fuse.` |
| 10 | `Two-front assault now. Split your attention — not your nerve.` |

### Milestone Waves 15–50

| Wave | Flavour Text |
|------|-------------|
| 15 | `⚠ BOSS WAVE — Iron Fist is at the gates.` |
| 20 | `Orc Knights ride the vanguard. Heavy blows incoming.` |
| 25 | `⚠ BOSS WAVE — Bloodtusk charges.` |
| 30 | `The sorcerers are unleashing everything. Watch for spells.` |
| 35 | `⚠ BOSS WAVE — The Siege King has come to collect.` |
| 40 | `The horde smells blood. Don't give it to them.` |
| 45 | `⚠ BOSS WAVE — Warchief Gronn leads the charge.` |
| 50 | `⚠ FINAL WAVE — The Ruinbringer comes for everything.` |

---

## 3. Rationale

### Boss Names

**Iron Fist, Bloodtusk, The Siege King, Warchief Gronn — KEPT.**
All four are distinct, immediately legible, and fit the orc warlord register without being clichéd. The mix of epithet-style names ("The Siege King") and proper names with flavor ("Bloodtusk", "Gronn") gives each boss a different feel across 50 waves.

**"The Titan Lord" → "The Ruinbringer" — CHANGED.**
"The Titan Lord" is redundant — all five bosses are titans, so calling the last one "the lord of titans" doesn't differentiate him. It also reads as a placeholder title ("lord of [enemy type]"). "The Ruinbringer" is action-oriented, names a specific thing he *does*, and raises the final-wave stakes beyond individual combat to total annihilation. The "The" prefix maintains structural consistency with Boss 3.

---

### Boss Lore Lines

**Iron Fist — CHANGED.**
Original: *"The first of many. He will not be the last."*
The original is retrospective and passive — it narrates a future event ("will not be the last") as if the fight is already over. For an intro card with a 2-second window, it reads as narrator commentary, not a threat. New version is immediate: it positions this boss as someone who has a track record of winning, then challenges the player to break that record. The short second sentence lands harder with no verb.

**Bloodtusk — MINOR CHANGE.**
Original: *"They say he has never bled. Today that changes."*
Solid line. "Today that changes" is the narrator predicting the player's success, which slightly undermines tension. Swapping to "Prove them wrong" makes the same point but addresses the player directly, which is more action-punchy and more Ninja Kiwi in register. Otherwise unchanged.

**The Siege King — KEPT.**
Original: *"He has broken a hundred forts. Not this one."*
This is the cleanest of the five. The short declarative payoff ("Not this one.") works perfectly. Nothing to improve.

**Warchief Gronn — KEPT.**
Original: *"The horde bows to him. Your walls do not."*
The best line in the batch. Tight parallelism, both halves land. The implicit argument is that the walls are more defiant than his own army. No changes needed.

**The Ruinbringer — CHANGED (also reflects new boss name).**
Original: *"The final wave. The last stand. Make it count."*
This reads as a pep talk from the narrator, not an introduction to the final boss. It positions the player as the subject ("Make it count") rather than establishing why this specific enemy is terrifying. The replacement describes what the boss *wants* — not gold, not victory points, but total erasure. That specific detail is more menacing than generic "final stand" language and gives the 2-second intro card real weight.

---

### Wave Flavour — Added Entries (Waves 2, 3, 4, 6, 7, 9)

**Waves 2–4 (all new):**
Early game has no new enemy types to announce, so these entries focus on escalating energy rather than mechanical information. Kept very short — the player is in combat and these should register in a glance. Each one steps up the intensity slightly without becoming repetitive.

**Waves 6–7 (new):**
Fill the gap between the wave 5 soldier announcement and the wave 8 bomber warning. Wave 6 notes that multi-direction spawning has begun (accurate — waves 6–10 add a second spawn direction). Wave 7 is a momentum line to keep the mid-game from going silent.

**Wave 9 (new):**
Per the formula bug documented in `BALANCE-REPORT.md §2`, bombers actually first appear on wave 9 (not wave 8) due to `floor()` rounding in `getWaveComposition()`. Wave 9 is therefore the correct "bombers are live" announcement. Wave 8 becomes the advance warning (see below).

---

### Wave Flavour — Revised Entries

**Wave 8 — REVISED.**
Original: *"Goblin Bombers detected. Watch the fuses."*
Per `BALANCE-REPORT.md §2`, bombers don't actually spawn until wave 9. If the original text fires at wave 8 and no bombers appear, the player will be confused or learn to distrust the text. "Spotted in the vanguard" reframes this as advance intelligence — the player is warned they're coming, which is accurate and also more interesting narratively than a direct announcement.

**Wave 10 — REVISED.**
Original: *"They come from multiple directions now."*
Pure mechanical description with no personality. "Two-front assault now" is punchy, accurate (waves 6–10 are 2-direction spawning), and shorter. The second half ("Split your attention — not your nerve") gives the player something actionable and maintains the game's confident, action-focused tone.

**Wave 20 — REVISED.**
Original: *"Orc Knights lead the charge."*
Per `BALANCE-REPORT.md §2`, orcKnights first appear at wave 21 due to a formula rounding bug. Announcing them at wave 20 is inaccurate. "Ride the vanguard" reframes this as an advance warning (advance elements spotted), which is defensible and remains true even if the knights appear a wave late. "Heavy blows incoming" replaces the generic description with player-relevant information.

**Wave 25 boss — REVISED.**
Original: *"⚠ BOSS WAVE — Bloodtusk has arrived."*
"Has arrived" is the weakest possible entrance for the second boss. "Charges" is a single word that communicates speed, aggression, and inevitability. It also matches Bloodtusk's combat character (a melee titan who closes distance fast).

**Wave 30 — REVISED.**
Original: *"Orc Wizards bring dark magic."*
By wave 30, wizards have been spawning since wave 27. Announcing them as if they're new is inaccurate. The revised text instead marks wave 30 as a point of escalation within an already-established threat — the sorcerers are ramping up, not arriving for the first time.

**Wave 35 boss — REVISED.**
Original: *"⚠ BOSS WAVE — The Siege King commands them."*
"Commands them" is low stakes — of course the warchief commands the horde. "Has come to collect" implies he treats this fort as already fallen, a debt the horde is here to cash in. It puts the player on the back foot psychologically, which is exactly what a boss intro should do before the card dismisses and the titan appears.

**Wave 40 — REVISED.**
Original: *"The horde is relentless. Do not falter."*
Generic motivational language that could appear in any medieval game. "The horde smells blood. Don't give it to them." is visceral, specific to the game's world, and reframes the same message as a dare rather than a warning.

**Wave 45 boss — REVISED.**
Original: *"⚠ BOSS WAVE — Warchief Gronn is here."*
"Is here" is the flattest possible announcement. Warchief Gronn is the commander of the entire horde — he deserves an entrance that reflects that. "Leads the charge" communicates that he's personally leading the assault, which raises stakes and matches his rank.

**Wave 50 final — REVISED.**
Original: *"⚠ FINAL WAVE — The Titan Lord. This ends now."*
Updated to reflect the new boss name. "This ends now" is functional but reads as a cliché resolve-line. "Comes for everything" is broader and more terrifying — he's not coming for a fight, he's coming to take everything. Matches the boss lore line and closes the game's narrative arc.

---

## 4. Formula Bug Notice for Engineering

Several wave flavour entries were written with the `BALANCE-REPORT.md §2` formula bugs in mind. The following wave texts are intentionally framed as advance warnings rather than enemy-type announcements to avoid contradiction when enemies appear 1–2 waves later than the `firstWave` config value suggests:

| Wave | Text framing | Actual enemy appearance |
|------|-------------|------------------------|
| 8 | "Bombers spotted in the vanguard" (warning) | Bombers first spawn wave 9 |
| 20 | "ride the vanguard" (advance elements) | orcKnights first spawn wave 21 |

If the formula bugs are fixed upstream (as recommended in `BALANCE-REPORT.md`), the texts remain accurate and can optionally be made more direct (e.g., wave 8: "Goblin Bombers hit the field. Watch every fuse."). No change to the texts is required either way.

---

*No game files were modified. This report is output only.*

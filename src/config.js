// ─── Game Config ──────────────────────────────────────────────
// Every tunable number lives here. Touch nothing in game logic to rebalance.

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const FPS = 60;

// ─── World / Viewport ───
export const WORLD_W = 1800;
export const WORLD_H = 1200;
export const VIEW_W = 960;
export const VIEW_H = 540;

// ─── Fort Layout ───
export const FORT = { x: 400, y: 250, w: 1000, h: 700, wallThickness: 24 };

export const GATES = {
  north: { x: 840, y: 250, w: 120, h: 24, side: 'top' },
  south: { x: 840, y: 926, w: 120, h: 24, side: 'bottom' },
  east:  { x: 1376, y: 540, w: 24, h: 120, side: 'right' },
  west:  { x: 400, y: 540, w: 24, h: 120, side: 'left' },
};

// ─── Player ───
export const PLAYER = {
  maxHP: 100,
  moveSpeed: 180,
  attackRange: 48,
  blockSpeedMult: 0.33,     // movement multiplier while blocking
  invincibilityMs: 0,
  radius: 18,               // top-down circular hitbox radius
  width: 36,
  height: 36,
  startX: 900,
  startY: 600,
  verticalMin: 0,
  verticalMax: 1200,
  goldPickupRadius: 32,
  comboWindow: 600,         // ms to chain next combo hit
  comboCooldown: 300,       // ms after combo 3 before new chain
};

// ─── Attack Phases (ms) ───
export const ATTACK = {
  windUp: 100,
  active: 150,
  recovery: 200,
  combo2DmgMult: 1.1,
  combo3DmgMult: 1.25,
};

// ─── Weapon Classes (4 upgrade paths, 5 tiers each) ───
export const WEAPON_CLASSES = {
  swords: {
    name: 'Swords', type: '1h',
    tiers: [
      { key: 'shortsword',   name: 'Shortsword',    damage: 10, cleave: 2, speed: 1.0,  cost: 0,     requires: null,            special: null,          knockbackMult: 1.0 },
      { key: 'longsword',    name: 'Longsword',     damage: 16, cleave: 2, speed: 1.0,  cost: 400,   requires: 'blacksmith',    special: null,          knockbackMult: 1.0 },
      { key: 'broadsword',   name: 'Broadsword',    damage: 24, cleave: 3, speed: 0.95, cost: 1500,  requires: 'weaponsmith',   special: null,          knockbackMult: 1.0 },
      { key: 'runicBlade',   name: 'Runic Blade',   damage: 35, cleave: 3, speed: 1.05, cost: 8000,  requires: 'wizardTower',   special: null,          knockbackMult: 1.0 },
      { key: 'orcbane',      name: 'Orcbane',       damage: 70, cleave: 5, speed: 0.75, cost: 35000, requires: 'arcaneLibrary', special: 'blastEvery3', knockbackMult: 1.0 },
    ],
  },
  axes: {
    name: 'Axes', type: '2h',
    tiers: [
      { key: 'handAxe',        name: 'Hand Axe',        damage: 14, cleave: 3, speed: 0.9,  cost: 250,   requires: 'blacksmith',    special: null,         knockbackMult: 1.0 },
      { key: 'battleAxe',      name: 'Battle Axe',      damage: 22, cleave: 3, speed: 0.85, cost: 600,   requires: 'blacksmith',    special: null,         knockbackMult: 1.0 },
      { key: 'executionerAxe', name: 'Executioner Axe',  damage: 32, cleave: 4, speed: 0.8,  cost: 4000,  requires: 'armory',        special: null,         knockbackMult: 1.0 },
      { key: 'axeRegen',       name: 'Axe of Regen',    damage: 38, cleave: 4, speed: 0.85, cost: 12000, requires: 'wizardTower',   special: 'regen2',     knockbackMult: 1.0 },
      { key: 'berserkerAxe',   name: 'Berserker Axe',   damage: 55, cleave: 5, speed: 0.9,  cost: 22000, requires: 'masterForge',   special: 'comboStack', knockbackMult: 1.0 },
    ],
  },
  maces: {
    name: 'Maces', type: '2h',
    tiers: [
      { key: 'mace',         name: 'Mace',            damage: 12, cleave: 2, speed: 0.85, cost: 300,   requires: 'blacksmith',    special: null,         knockbackMult: 1.2 },
      { key: 'flail',        name: 'Flail',           damage: 18, cleave: 2, speed: 0.9,  cost: 800,   requires: 'weaponsmith',   special: null,         knockbackMult: 1.3 },
      { key: 'warHammer',    name: 'War Hammer',      damage: 28, cleave: 2, speed: 0.7,  cost: 3000,  requires: 'armory',        special: null,         knockbackMult: 1.5 },
      { key: 'mithrilMaul',  name: 'Mithril Maul',    damage: 40, cleave: 3, speed: 0.65, cost: 15000, requires: 'masterForge',   special: 'stun03',     knockbackMult: 1.5 },
      { key: 'maulTitans',   name: 'Maul of Titans',  damage: 60, cleave: 4, speed: 0.6,  cost: 30000, requires: 'arcaneLibrary', special: 'aoeEvery3',  knockbackMult: 1.5 },
    ],
  },
  ranged: {
    name: 'Ranged', type: 'ranged',
    tiers: [
      { key: 'lightCrossbow',  name: 'Light Crossbow',   damage: 13, cleave: 1, speed: 0.7,  cost: 300,   requires: 'archeryRange',  special: null,      knockbackMult: 0 },
      { key: 'crossbow',       name: 'Crossbow',         damage: 19, cleave: 1, speed: 0.8,  cost: 800,   requires: 'archeryRange',  special: null,      knockbackMult: 0 },
      { key: 'heavyCrossbow',  name: 'Heavy Crossbow',   damage: 27, cleave: 1, speed: 0.65, cost: 2500,  requires: 'armory',        special: 'pierce2', knockbackMult: 0 },
      { key: 'crossbowSpeed',  name: 'Crossbow of Speed',damage: 22, cleave: 1, speed: 1.3,  cost: 4500,  requires: 'wizardTower',   special: null,      knockbackMult: 0 },
      { key: 'arcaneRepeater', name: 'Arcane Repeater',  damage: 38, cleave: 1, speed: 1.1,  cost: 25000, requires: 'arcaneLibrary', special: 'pierce3', knockbackMult: 0 },
    ],
  },
};

// Special standalone weapons (not in upgrade paths)
export const SPECIAL_WEAPONS = {
  deflectionGladius: { name: 'Deflection Gladius', damage: 15, cleave: 2, speed: 1.1, type: '1h', cost: 3500,  requires: 'wizardTower',   special: 'blockBonus20', knockbackMult: 1.0 },
  flailThrashing:    { name: 'Flail of Thrashing', damage: 30, cleave: 3, speed: 1.0, type: '1h', cost: 25000, requires: 'arcaneLibrary', special: 'knockback30',  knockbackMult: 1.3 },
  twinDaggers:       { name: 'Twin Daggers',       damage: 8,  cleave: 1, speed: 1.4, type: '1h', cost: 2000,  requires: 'weaponsmith',   special: 'doubleStrike', knockbackMult: 0.5 },
  orcSlayer:         { name: 'Orc Slayer',   damage: 26, cleave: 3, speed: 0.95, type: '1h', cost: 4500,  requires: 'armory',   special: null,     knockbackMult: 1.2 },
  siegeHammer:       { name: 'Siege Hammer', damage: 34, cleave: 2, speed: 0.65, type: '2h', cost: 6500,  requires: 'armory',   special: null,     knockbackMult: 1.4 },
};

// ─── Flat WEAPONS lookup (built from classes + specials for backward compat) ───
export const WEAPONS = {};
for (const [cls, data] of Object.entries(WEAPON_CLASSES)) {
  for (const tier of data.tiers) {
    WEAPONS[tier.key] = { ...tier, type: data.type };
  }
}
for (const [key, def] of Object.entries(SPECIAL_WEAPONS)) {
  WEAPONS[key] = { ...def };
}

// ─── Armor ───
export const ARMORS = {
  none:       { name: 'No Armor',          reduction: 0,    speedPenalty: 0,    cost: 0,     requires: null },
  leather:    { name: 'Leather Armor',     reduction: 0.15, speedPenalty: 0.05, cost: 200,   requires: 'blacksmith' },
  chainMail:  { name: 'Chain Mail',        reduction: 0.30, speedPenalty: 0.15, cost: 3000,  requires: 'blacksmith' },
  fullPlate:  { name: 'Full Plate',        reduction: 0.50, speedPenalty: 0.30, cost: 10000, requires: 'armory' },
  adamantine: { name: 'Adamantine Plate',  reduction: 0.55, speedPenalty: 0.15, cost: 50000, requires: 'arcaneLibrary' },
};

// ─── Shields ───
export const SHIELDS = {
  wooden:  { name: 'Wooden Shield',  block: 0.40, cost: 0,     requires: null },
  iron:    { name: 'Iron Shield',    block: 0.55, cost: 800,   requires: 'blacksmith' },
  tower:   { name: 'Tower Shield',   block: 0.70, cost: 3000,  requires: 'armory' },
  templar: { name: 'Templar Shield', block: 0.80, cost: 30000, requires: 'arcaneLibrary' },
};

// ─── Enemies ───
export const ENEMIES = {
  raider:      { name: 'Orc Raider',     hp: 20,  damage: 5,  speed: 100, attackRate: 1.0, goldMin: 5,   goldMax: 10,  xp: 5,   firstWave: 1,  score: 10,  type: 'melee',   width: 28, height: 32, color: '#4a7' },
  soldier:     { name: 'Orc Soldier',     hp: 45,  damage: 10, speed: 90,  attackRate: 1.2, goldMin: 10,  goldMax: 20,  xp: 12,  firstWave: 5,  score: 25,  type: 'melee',   width: 30, height: 36, color: '#396', hasShield: true },
  bomber:      { name: 'Goblin Bomber',   hp: 15,  damage: 30, speed: 130, attackRate: 2.5, goldMin: 15,  goldMax: 25,  xp: 15,  firstWave: 8,  score: 30,  type: 'suicide', width: 22, height: 28, color: '#a54' },
  archer:      { name: 'Orc Archer',      hp: 25,  damage: 8,  speed: 70,  attackRate: 1.8, goldMin: 12,  goldMax: 18,  xp: 10,  firstWave: 10, score: 20,  type: 'ranged',  width: 28, height: 32, color: '#585', range: 300, retreatDist: 100 },
  ogre:        { name: 'Ogre',            hp: 120, damage: 25, speed: 60,  attackRate: 2.0, goldMin: 30,  goldMax: 50,  xp: 30,  firstWave: 15, score: 60,  type: 'melee',   width: 44, height: 52, color: '#765', knockbackResist: 0.8 },
  orcKnight:   { name: 'Orc Knight',      hp: 80,  damage: 18, speed: 85,  attackRate: 1.0, goldMin: 25,  goldMax: 40,  xp: 25,  firstWave: 20, score: 50,  type: 'melee',   width: 32, height: 40, color: '#456', armorHits: 3 },
  wizard:      { name: 'Orc Wizard',      hp: 35,  damage: 15, speed: 65,  attackRate: 2.5, goldMin: 20,  goldMax: 35,  xp: 20,  firstWave: 25, score: 40,  type: 'ranged',  width: 28, height: 36, color: '#639', range: 250, magic: true },
  ogreSoldier: { name: 'Ogre Soldier',    hp: 180, damage: 35, speed: 55,  attackRate: 2.2, goldMin: 50,  goldMax: 80,  xp: 50,  firstWave: 35, score: 100, type: 'melee',   width: 48, height: 56, color: '#654', knockbackResist: 0.9 },
  titan:       { name: 'Orc Titan',       hp: 800, damage: 50, speed: 40,  attackRate: 3.0, goldMin: 200, goldMax: 200, xp: 200, firstWave: 15, score: 500, type: 'boss',    width: 64, height: 80, color: '#833', knockbackResist: 1.0,
    bosses: [
      { name: 'Iron Fist',      lore: 'Gates fall before him. This one holds.' },
      { name: 'Bloodtusk',      lore: 'They say he has never bled. Prove them wrong.' },
      { name: 'The Siege King', lore: 'He has broken a hundred forts. Not this one.' },
      { name: 'Warchief Gronn', lore: 'The horde bows to him. Your walls do not.' },
      { name: 'The Ruinbringer',lore: "He doesn't want your gold. He wants this fort erased." },
    ]
  },
};

// ─── Barricade ───
export const BARRICADES = [
  { name: 'Wooden Wall',          hp: 200,  repairCostPerHP: 0,    color: '#8B6914' },
  { name: 'Braced Wood Wall',     hp: 400,  repairCostPerHP: 0.2,  color: '#9B7924', requires: 'lumberMill' },
  { name: 'Stone Wall',           hp: 700,  repairCostPerHP: 0.5,  color: '#888',    requires: 'stoneworks' },
  { name: 'Reinforced Stone Wall',hp: 1200, repairCostPerHP: 1.0,  color: '#999',    requires: 'masonry' },
  { name: 'Iron-Bound Wall',      hp: 2000, repairCostPerHP: 2.0,  color: '#aab',    requires: 'forge' },
];

// ─── Buildings ───
export const BUILDINGS = {
  // Fortification branch (top-left courtyard)
  lumberMill:          { name: 'Lumber Mill',          cost: 100,  requires: null,                  unlocks: ['stoneworks', 'archeryRange', 'engineeringWorkshop'] },
  stoneworks:          { name: 'Stoneworks',           cost: 500,  requires: 'lumberMill',          unlocks: ['masonry'] },
  masonry:             { name: 'Masonry',              cost: 2000, requires: 'stoneworks',          unlocks: ['forge'] },
  forge:               { name: 'Forge',                cost: 5000, requires: 'masonry',             unlocks: [] },
  engineeringWorkshop: { name: 'Eng. Workshop',        cost: 800,  requires: 'lumberMill',          unlocks: ['spikedBarricades', 'moat'] },
  spikedBarricades:    { name: 'Spiked Barricades',    cost: 1000, requires: 'engineeringWorkshop', unlocks: [] },
  moat:                { name: 'Moat',                 cost: 2500, requires: 'engineeringWorkshop', unlocks: [] },

  // Military branch (top-right courtyard)
  barracks:            { name: 'Barracks',             cost: 200,  requires: null,                  unlocks: ['knightAcademy'] },
  archeryRange:        { name: 'Archery Range',        cost: 300,  requires: 'lumberMill',          unlocks: [] },
  knightAcademy:       { name: 'Knight Academy',       cost: 1500, requires: 'barracks',            unlocks: ['advCombat'] },
  advCombat:           { name: 'Adv. Combat',          cost: 4000, requires: 'knightAcademy',       unlocks: [] },

  // Crafting branch (bottom-left courtyard)
  blacksmith:          { name: 'Blacksmith',           cost: 300,  requires: null,                  unlocks: ['armory', 'weaponsmith'] },
  armory:              { name: 'Armory',               cost: 1200, requires: 'blacksmith',          unlocks: [] },
  weaponsmith:         { name: 'Weaponsmith',          cost: 1000, requires: 'blacksmith',          unlocks: ['masterForge'] },
  masterForge:         { name: 'Master Forge',         cost: 6000, requires: 'weaponsmith',         unlocks: [] },

  // Magic branch (bottom-right courtyard)
  apothecary:          { name: 'Apothecary',           cost: 400,  requires: null,                  unlocks: ['alchemistLab'] },
  alchemistLab:        { name: 'Alchemist Lab',        cost: 1000, requires: 'apothecary',          unlocks: ['wizardTower'] },
  wizardTower:         { name: 'Wizard Tower',         cost: 2500, requires: 'alchemistLab',        unlocks: ['arcaneLibrary'] },
  arcaneLibrary:       { name: 'Arcane Library',       cost: 8000, requires: 'wizardTower',         unlocks: [] },

  // Economy branch (center courtyard)
  goldMine:            { name: 'Gold Mine',            cost: 600,  requires: null,                  unlocks: ['crystalMine'] },
  crystalMine:         { name: 'Crystal Mine',         cost: 3000, requires: 'goldMine',            unlocks: ['treasury'] },
  treasury:            { name: 'Treasury',             cost: 4500, requires: 'crystalMine',         unlocks: [] },
};

// ─── Building Visual Positions (world coords inside courtyard, from map-mockup) ───
export const BUILDING_VISUALS = {
  // Fortification branch - top left
  lumberMill:          { x: 480, y: 310, w: 50, h: 40, color: '#8B6914' },
  stoneworks:          { x: 540, y: 310, w: 50, h: 40, color: '#888' },
  masonry:             { x: 600, y: 310, w: 50, h: 40, color: '#999' },
  forge:               { x: 660, y: 310, w: 50, h: 40, color: '#c84' },
  engineeringWorkshop: { x: 480, y: 360, w: 50, h: 40, color: '#a86' },
  spikedBarricades:    { x: 540, y: 360, w: 50, h: 40, color: '#b55' },
  moat:                { x: 600, y: 360, w: 50, h: 40, color: '#48a' },

  // Military branch - top right
  barracks:            { x: 900, y: 310, w: 50, h: 40, color: '#68a' },
  archeryRange:        { x: 960, y: 310, w: 50, h: 40, color: '#6a6' },
  knightAcademy:       { x: 1020, y: 310, w: 50, h: 40, color: '#88c' },
  advCombat:           { x: 1080, y: 310, w: 50, h: 40, color: '#aa8' },

  // Crafting branch - bottom left
  blacksmith:          { x: 480, y: 820, w: 50, h: 40, color: '#a86' },
  armory:              { x: 540, y: 820, w: 50, h: 40, color: '#8a8' },
  weaponsmith:         { x: 600, y: 820, w: 50, h: 40, color: '#ca6' },
  masterForge:         { x: 660, y: 820, w: 50, h: 40, color: '#e94' },

  // Magic branch - bottom right
  apothecary:          { x: 900, y: 820, w: 50, h: 40, color: '#6a8' },
  alchemistLab:        { x: 960, y: 820, w: 50, h: 40, color: '#8ad' },
  wizardTower:         { x: 1020, y: 820, w: 50, h: 40, color: '#a6d' },
  arcaneLibrary:       { x: 1080, y: 820, w: 50, h: 40, color: '#c8f' },

  // Economy - center
  goldMine:            { x: 820, y: 560, w: 55, h: 45, color: '#da4' },
  crystalMine:         { x: 885, y: 560, w: 55, h: 45, color: '#8df' },
  treasury:            { x: 950, y: 560, w: 55, h: 45, color: '#fd4' },
};

// ─── Troops ───
export const TROOPS = {
  footman: { name: 'Footman', hp: 40,  damage: 8,  attackRate: 1.2, speed: 80,  cost: 50,  max: 4, requires: 'barracks',      width: 28, height: 32, color: '#68a', type: 'melee' },
  archer:  { name: 'Archer',  hp: 25,  damage: 10, attackRate: 2.0, speed: 60,  cost: 80,  max: 3, requires: 'archeryRange',  width: 28, height: 32, color: '#6a6', type: 'ranged', range: 350 },
  knight:  { name: 'Knight',  hp: 80,  damage: 20, attackRate: 1.0, speed: 90,  cost: 200, max: 3, requires: 'knightAcademy', width: 32, height: 36, color: '#88c', type: 'melee' },
  wizard:  { name: 'Wizard',  hp: 30,  damage: 20, attackRate: 3.0, speed: 50,  cost: 350, max: 2, requires: 'wizardTower',   width: 28, height: 36, color: '#a6d', type: 'ranged', range: 300, aoeRadius: 48 },
  shredder:{ name: 'Shredder',hp: 150, damage: 38, attackRate: 0.8, speed: 40,  cost: 500, max: 1, requires: 'advCombat',     width: 44, height: 40, color: '#aa8', type: 'melee' },
};

// ─── Skills ───
export const SKILLS = {
  combat: [
    { id: 'swordExpertise', name: 'Sword Expertise', desc: '+10% melee dmg', maxRank: 5, perRank: 0.10 },
    { id: 'powerStrikes',   name: 'Power Strikes',   desc: '+15% combo finisher', maxRank: 3, perRank: 0.15 },
    { id: 'weaponMaster',   name: 'Weapon Master',    desc: '+5% attack speed', maxRank: 5, perRank: 0.05 },
    { id: 'criticalStrike', name: 'Critical Strike',  desc: '5% crit chance', maxRank: 3, perRank: 0.05 },
  ],
  defense: [
    { id: 'toughness',      name: 'Toughness',        desc: '+15 max HP', maxRank: 5, perRank: 15 },
    { id: 'shieldExpertise',name: 'Shield Expertise', desc: '+5% block', maxRank: 3, perRank: 0.05 },
    { id: 'nimble',         name: 'Nimble',           desc: '+8% move speed', maxRank: 3, perRank: 0.08 },
    { id: 'fortify',        name: 'Fortify',          desc: '+10% barricade HP', maxRank: 3, perRank: 0.10 },
  ],
  economy: [
    { id: 'haggler',       name: 'Haggler',       desc: '-5% costs', maxRank: 3, perRank: 0.05 },
    { id: 'goldMagnet',    name: 'Gold Magnet',   desc: '+32px pickup', maxRank: 3, perRank: 32 },
    { id: 'bountyHunter',  name: 'Bounty Hunter', desc: '+10% gold', maxRank: 3, perRank: 0.10 },
    { id: 'commander',     name: 'Commander',     desc: '+10% troop dmg', maxRank: 3, perRank: 0.10 },
  ],
};

// ─── Active Skills ───
export const ACTIVE_SKILLS = {
  warCry:    { id: 'warCry',    name: 'War Cry',    cost: 1500, cooldown: 60, requires: 'barracks',     description: 'Stun all enemies on screen for 2 seconds.' },
  shieldBash:{ id: 'shieldBash',name: 'Shield Bash', cost: 600,  cooldown: 38, requires: null,           description: 'Knock all nearby enemies back 200px.' },
};

// ─── Waves ───
export const WAVE_COUNT = 50;

export const WAVE_FLAVOUR = {
  1:  'The siege begins. Hold the line.',
  2:  'More of them. Keep swinging.',
  3:  "The raiders won't stop. Neither will you.",
  4:  'Pushing harder now. Stay sharp.',
  5:  'Orc Soldiers hit the field. They hit harder — plan accordingly.',
  6:  'New angles on the attack. Keep every gate covered.',
  7:  'The raid keeps growing. Keep pace.',
  8:  'Bombers spotted in the vanguard. Don\'t let them near the walls.',
  9:  'Those bombers are live. Watch every fuse.',
  10: "Two-front assault now. Split your attention — not your nerve.",
  15: 'BOSS WAVE — Iron Fist is at the gates.',
  20: 'Orc Knights ride the vanguard. Heavy blows incoming.',
  25: 'BOSS WAVE — Bloodtusk charges.',
  30: 'The sorcerers are unleashing everything. Watch for spells.',
  35: 'BOSS WAVE — The Siege King has come to collect.',
  40: "The horde smells blood. Don't give it to them.",
  45: 'BOSS WAVE — Warchief Gronn leads the charge.',
  50: 'FINAL WAVE — The Ruinbringer comes for everything.',
};

export function getSpawnInterval(wave) {
  return Math.max(0.8, 3.0 - wave * 0.04);
}

export function getHPScale(wave) {
  return 1 + wave * 0.02;
}

export function getDamageScale(wave) {
  return 1 + wave * 0.015;
}

export function getWaveBonus(wave) {
  return 50 + wave * 10;
}

// ─── XP ───
export function xpForLevel(level) {
  return 100 * level;
}

export const MAX_LEVEL = 25;

// ─── Consumables ───
export const POTIONS = {
  minorHeal: { name: 'Minor Heal Potion', heal: 25, cost: 100, maxCarry: 5, requires: null,         description: 'Restore 25 HP instantly. Basic field medicine.' },
  stoneskin:  { name: 'Stoneskin Potion',  heal: 75, cost: 200, maxCarry: 3, requires: 'wizardTower', description: 'Restore 75 HP. Potent alchemical brew.' },
};

// ─── Visual ───
export const COLORS = {
  bg:          '#3a6a2a',
  grass:       '#3a6a2a',
  grassAlt:    '#347024',
  courtyard:   '#8a7a6a',
  dirt:        '#7a6a4a',
  dirtLight:   '#8a7a5a',
  fort:        '#554433',
  fortWall:    '#665544',
  stone:       '#888888',
  hpBar:       '#cc3333',
  hpBarBg:     '#441111',
  xpBar:       '#cccc33',
  xpBarBg:     '#444411',
  gold:        '#ffdd44',
  text:        '#ffffff',
  textShadow:  '#000000',
  shopBg:      '#1a1a2e',
  shopPanel:   '#2a2a4e',
  buttonNorm:  '#446688',
  buttonHover: '#5577aa',
  buttonPress: '#334466',
  buttonLock:  '#333',
};

// ─── Elite Mode ───
export const ELITE_MODE = {
  hpMult:     2.0,
  damageMult: 1.5,
  speedMult:  1.15,
  goldMult:   1.25,
};

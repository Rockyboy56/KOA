import { BUILDINGS, WEAPON_CLASSES, SPECIAL_WEAPONS, ARMORS, SHIELDS, TROOPS, POTIONS, ACTIVE_SKILLS, BARRICADES } from '../config.js';

export function createEconomy() {
  return {
    gold: 0,
    crystals: 0,
    buildings: {},        // { lumberMill: true, ... }
    ownedArmors: { none: true },
    ownedShields: { wooden: true },
    troops: [],           // [{ typeKey, alive }]
    troopCounts: {},      // { footman: 2, ... }
    buildingsBought: 0,
    troopsHired: 0,
  };
}

// ─── Weapon System (class/tier based) ───

// Pre-build a lookup table: classKey+tier -> weapon data with `type` included
const _weaponLookup = {};
for (const [classKey, cls] of Object.entries(WEAPON_CLASSES)) {
  for (let i = 0; i < cls.tiers.length; i++) {
    _weaponLookup[`${classKey}_${i}`] = { ...cls.tiers[i], type: cls.type };
  }
}
const _defaultWeapon = _weaponLookup['swords_0'];

/** Get the weapon data for the player's currently equipped weapon. */
export function getEquippedWeapon(player) {
  if (player.weaponSpecial) {
    return SPECIAL_WEAPONS[player.weaponSpecial] || _defaultWeapon;
  }
  return _weaponLookup[`${player.weaponClass}_${player.weaponTier}`] || _defaultWeapon;
}

/** Get the upgrade cost for the next tier in the current class. Returns null if maxed. */
export function getUpgradeCost(player, discount = 0) {
  if (player.weaponSpecial) return null; // specials don't upgrade
  const cls = WEAPON_CLASSES[player.weaponClass];
  if (!cls || player.weaponTier >= cls.tiers.length - 1) return null;
  const current = cls.tiers[player.weaponTier];
  const next = cls.tiers[player.weaponTier + 1];
  return Math.round((next.cost - current.cost) * (1 - discount));
}

/** Check if player can upgrade to next tier. */
export function canUpgradeWeapon(econ, player, discount = 0) {
  if (player.weaponSpecial) return false;
  const cls = WEAPON_CLASSES[player.weaponClass];
  if (!cls || player.weaponTier >= cls.tiers.length - 1) return false;
  const next = cls.tiers[player.weaponTier + 1];
  if (next.requires && !econ.buildings[next.requires]) return false;
  const cost = getUpgradeCost(player, discount);
  return cost !== null && econ.gold >= cost;
}

/** Upgrade to next tier. Returns false if cannot afford. */
export function upgradeWeapon(econ, player, discount = 0) {
  const cost = getUpgradeCost(player, discount);
  if (cost === null || econ.gold < cost) return false;
  econ.gold -= cost;
  player.weaponTier++;
  player.weaponSpecial = null;
  player.weaponUpgrades = (player.weaponUpgrades || 0) + 1;
  return true;
}

/** Get cost to switch to a new weapon class (tier 0). Minimum 100g. */
export function getSwitchCost(classKey, discount = 0) {
  const cls = WEAPON_CLASSES[classKey];
  if (!cls) return Infinity;
  return Math.max(100, Math.round(cls.tiers[0].cost * (1 - discount)));
}

/** Check if player can switch to a new weapon class. */
export function canSwitchWeaponClass(econ, player, classKey, discount = 0) {
  if (player.weaponClass === classKey && !player.weaponSpecial) return false;
  const cls = WEAPON_CLASSES[classKey];
  if (!cls) return false;
  const tier0 = cls.tiers[0];
  if (tier0.requires && !econ.buildings[tier0.requires]) return false;
  return econ.gold >= getSwitchCost(classKey, discount);
}

/** Switch to a new weapon class at tier 0. Returns false if can't afford. */
export function switchWeaponClass(econ, player, classKey, discount = 0) {
  const cost = getSwitchCost(classKey, discount);
  if (econ.gold < cost) return false;
  econ.gold -= cost;
  player.weaponClass = classKey;
  player.weaponTier = 0;
  player.weaponSpecial = null;
  player.weaponUpgrades = (player.weaponUpgrades || 0) + 1;
  return true;
}

/** Check if player can buy a special weapon. */
export function canBuySpecialWeapon(econ, player, key, discount = 0) {
  const def = SPECIAL_WEAPONS[key];
  if (!def) return false;
  if (player.weaponSpecial === key) return false; // already equipped
  if (def.requires && !econ.buildings[def.requires]) return false;
  return econ.gold >= Math.round(def.cost * (1 - discount));
}

/** Buy and equip a special weapon. */
export function buySpecialWeapon(econ, player, key, discount = 0) {
  const def = SPECIAL_WEAPONS[key];
  if (!def || player.weaponSpecial === key) return false;
  const cost = Math.round(def.cost * (1 - discount));
  if (econ.gold < cost) return false;
  econ.gold -= cost;
  player.weaponSpecial = key;
  player.weaponUpgrades = (player.weaponUpgrades || 0) + 1;
  return true;
}

/** Apply wave-end passive building effects: gold bonus multipliers, crystal income. */
export function applyWaveEndPassives(econ, baseBonus) {
  let goldBonus = baseBonus;
  if (econ.buildings.goldMine) goldBonus = Math.round(goldBonus * 1.15);
  if (econ.buildings.crystalMine) goldBonus += 50; // Crystal Mine: +50 flat gold/wave
  if (econ.buildings.treasury) goldBonus = Math.round(goldBonus * 1.30);

  let crystals = 0;
  if (econ.buildings.crystalMine) crystals += 5;
  if (econ.buildings.treasury) crystals += 10;

  econ.gold += goldBonus;
  econ.crystals += crystals;
  return { goldBonus, crystals };
}

/** Get the passive weapon damage multiplier from buildings. */
export function getBuildingDamageMult(econ) {
  let mult = 1;
  if (econ.buildings.masterForge) mult += 0.10; // Master Forge: +10% all weapon damage
  return mult;
}

export function canAfford(econ, cost, discount = 0) {
  return econ.gold >= Math.round(cost * (1 - discount));
}

export function spend(econ, cost, discount = 0) {
  const actual = Math.round(cost * (1 - discount));
  econ.gold -= actual;
  return actual;
}

export function hasBuilding(econ, key) {
  return !!econ.buildings[key];
}

export function canBuyBuilding(econ, key, discount = 0) {
  const def = BUILDINGS[key];
  if (!def) return false;
  if (econ.buildings[key]) return false;
  if (def.requires && !econ.buildings[def.requires]) return false;
  return canAfford(econ, def.cost, discount);
}

export function buyBuilding(econ, key, discount = 0) {
  const def = BUILDINGS[key];
  spend(econ, def.cost, discount);
  econ.buildings[key] = true;
  econ.buildingsBought++;
}

// Old flat weapon buy/sell removed — use class-based upgrade system instead

export function canBuyArmor(econ, key, discount = 0) {
  const def = ARMORS[key];
  if (!def) return false;
  if (econ.ownedArmors[key]) return false;
  if (def.requires && !econ.buildings[def.requires]) return false;
  return canAfford(econ, def.cost, discount);
}

export function buyArmor(econ, key, discount = 0) {
  spend(econ, ARMORS[key].cost, discount);
  econ.ownedArmors[key] = true;
}

export function canBuyShield(econ, key, discount = 0) {
  const def = SHIELDS[key];
  if (!def) return false;
  if (econ.ownedShields[key]) return false;
  if (def.requires && !econ.buildings[def.requires]) return false;
  return canAfford(econ, def.cost, discount);
}

export function buyShield(econ, key, discount = 0) {
  spend(econ, SHIELDS[key].cost, discount);
  econ.ownedShields[key] = true;
}

export function canHireTroop(econ, typeKey, discount = 0) {
  const def = TROOPS[typeKey];
  if (!def) return false;
  if (def.requires && !econ.buildings[def.requires]) return false;
  const count = econ.troopCounts[typeKey] || 0;
  if (count >= def.max) return false;
  return canAfford(econ, def.cost, discount);
}

export function hireTroop(econ, typeKey, discount = 0) {
  spend(econ, TROOPS[typeKey].cost, discount);
  econ.troopCounts[typeKey] = (econ.troopCounts[typeKey] || 0) + 1;
  econ.troopsHired = (econ.troopsHired || 0) + 1;
}

export function canBuyPotion(econ, potionKey, currentCount, discount = 0) {
  const def = POTIONS[potionKey];
  if (!def) return false;
  if (currentCount >= def.maxCarry) return false;
  if (def.requires && !econ.buildings[def.requires]) return false;
  return canAfford(econ, def.cost, discount);
}

export function buyPotion(econ, potionKey, discount = 0) {
  return spend(econ, POTIONS[potionKey].cost, discount);
}

export function canBuyActiveSkill(econ, skillKey, player, discount = 0) {
  const def = ACTIVE_SKILLS[skillKey];
  if (!def) return false;
  if (player.activeSkills && player.activeSkills.includes(skillKey)) return false;
  if (player.activeSkills && player.activeSkills.length >= 2) return false;
  if (def.requires && !econ.buildings[def.requires]) return false;
  return canAfford(econ, def.cost, discount);
}

export function buyActiveSkill(econ, skillKey, player, discount = 0) {
  const def = ACTIVE_SKILLS[skillKey];
  if (!def) return false;
  spend(econ, def.cost, discount);
  if (!player.activeSkills) player.activeSkills = [];
  player.activeSkills.push(skillKey);
  if (!player.skillCooldowns) player.skillCooldowns = {};
  player.skillCooldowns[skillKey] = 0;
  return true;
}

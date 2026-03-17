import { BUILDINGS, WEAPONS, ARMORS, SHIELDS, TROOPS, POTIONS, BARRICADES } from '../config.js';

export function createEconomy() {
  return {
    gold: 0,
    buildings: {},        // { lumberMill: true, ... }
    ownedWeapons: { shortsword: true },
    ownedArmors: { none: true },
    ownedShields: { wooden: true },
    troops: [],           // [{ typeKey, alive }]
    troopCounts: {},      // { footman: 2, ... }
  };
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
}

export function canBuyWeapon(econ, key, discount = 0) {
  const def = WEAPONS[key];
  if (!def) return false;
  if (econ.ownedWeapons[key]) return false;
  if (def.requires && !econ.buildings[def.requires]) return false;
  return canAfford(econ, def.cost, discount);
}

export function buyWeapon(econ, key, discount = 0) {
  spend(econ, WEAPONS[key].cost, discount);
  econ.ownedWeapons[key] = true;
}

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
}

export function canBuyPotion(econ, currentCount, discount = 0) {
  if (currentCount >= POTIONS.stoneskin.maxCarry) return false;
  if (!econ.buildings.wizardTower) return false;
  return canAfford(econ, POTIONS.stoneskin.cost, discount);
}

export function buyPotion(econ, discount = 0) {
  return spend(econ, POTIONS.stoneskin.cost, discount);
}

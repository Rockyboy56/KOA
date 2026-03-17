import { GAME_WIDTH, GAME_HEIGHT, BUILDINGS, WEAPONS, ARMORS, SHIELDS, TROOPS, POTIONS, SKILLS, BARRICADES } from '../config.js';
import { drawRect, drawText, drawBar, drawTextCentered, getCtx } from '../renderer.js';
import { pointInRect } from '../utils/collision.js';
import { getMouse } from '../input.js';
import * as Econ from './economy.js';
import { recalcStats } from '../entities/player.js';

const TABS = ['BUILDINGS', 'EQUIPMENT', 'TROOPS', 'SKILLS'];
let currentTab = 0;
let scrollOffset = 0;
let buttons = [];
let headers = [];

export function resetShop() {
  currentTab = 0;
  scrollOffset = 0;
  buttons = [];
  headers = [];
}

export function updateShop(player, economy, mouseClicked) {
  const mouse = getMouse();
  buttons = [];
  headers = [];

  // Tab buttons
  for (let i = 0; i < TABS.length; i++) {
    const bx = 30 + i * 160;
    const by = 60;
    buttons.push({ x: bx, y: by, width: 140, height: 30, isTab: true, tabIndex: i, action: () => { currentTab = i; scrollOffset = 0; } });
  }

  let yOff = 110;
  const discount = player.costDiscount;

  if (currentTab === 0) {
    for (const [key, def] of Object.entries(BUILDINGS)) {
      const owned = economy.buildings[key];
      const canBuy = Econ.canBuyBuilding(economy, key, discount);
      const visible = !def.requires || economy.buildings[def.requires];
      if (!visible) continue;

      buttons.push({
        x: 30, y: yOff, width: 400, height: 50,
        label: `${def.name} - ${owned ? 'BUILT' : Math.round(def.cost * (1 - discount)) + 'g'}`,
        enabled: canBuy && !owned,
        action: () => { Econ.buyBuilding(economy, key, discount); },
      });
      yOff += 58;
    }
  } else if (currentTab === 1) {
    headers.push({ text: '-- Weapons --', y: yOff - 4 });
    yOff += 20;
    for (const [key, def] of Object.entries(WEAPONS)) {
      const owned = economy.ownedWeapons[key];
      const canBuy = Econ.canBuyWeapon(economy, key, discount);
      const unlocked = !def.requires || economy.buildings[def.requires];
      const equipped = player.weapon === key;
      const reqName = def.requires ? (BUILDINGS[def.requires]?.name || def.requires) : '';

      const label = equipped ? `> ${def.name} [EQUIPPED]` :
                    owned ? `${def.name} [EQUIP]` :
                    !unlocked ? `${def.name} DMG:${def.damage} [Needs ${reqName}]` :
                    `${def.name} DMG:${def.damage} - ${Math.round(def.cost * (1 - discount))}g`;
      buttons.push({
        x: 30, y: yOff, width: 500, height: 36, label,
        enabled: owned ? !equipped : canBuy,
        action: () => {
          if (owned) { player.weapon = key; }
          else if (canBuy) { Econ.buyWeapon(economy, key, discount); player.weapon = key; }
        },
      });
      yOff += 42;
    }

    yOff += 10;
    headers.push({ text: '-- Armor --', y: yOff - 4 });
    yOff += 20;
    for (const [key, def] of Object.entries(ARMORS)) {
      if (key === 'none') continue;
      const owned = economy.ownedArmors[key];
      const canBuy = Econ.canBuyArmor(economy, key, discount);
      const unlocked = !def.requires || economy.buildings[def.requires];
      const equipped = player.armor === key;
      const reqName = def.requires ? (BUILDINGS[def.requires]?.name || def.requires) : '';

      const label = equipped ? `> ${def.name} [EQUIPPED]` :
                    owned ? `${def.name} [EQUIP]` :
                    !unlocked ? `${def.name} DR:${Math.round(def.reduction * 100)}% [Needs ${reqName}]` :
                    `${def.name} DR:${Math.round(def.reduction * 100)}% - ${Math.round(def.cost * (1 - discount))}g`;
      buttons.push({
        x: 30, y: yOff, width: 500, height: 36, label,
        enabled: owned ? !equipped : canBuy,
        action: () => {
          if (owned) { player.armor = key; recalcStats(player); }
          else if (canBuy) { Econ.buyArmor(economy, key, discount); player.armor = key; recalcStats(player); }
        },
      });
      yOff += 42;
    }

    yOff += 10;
    headers.push({ text: '-- Shields --', y: yOff - 4 });
    yOff += 20;
    for (const [key, def] of Object.entries(SHIELDS)) {
      const owned = economy.ownedShields[key];
      const canBuy = Econ.canBuyShield(economy, key, discount);
      const unlocked = !def.requires || economy.buildings[def.requires];
      const equipped = player.shield === key;
      const reqName = def.requires ? (BUILDINGS[def.requires]?.name || def.requires) : '';

      const label = equipped ? `> ${def.name} [EQUIPPED]` :
                    owned ? `${def.name} [EQUIP]` :
                    !unlocked ? `${def.name} BLK:${Math.round(def.block * 100)}% [Needs ${reqName}]` :
                    `${def.name} BLK:${Math.round(def.block * 100)}% - ${Math.round(def.cost * (1 - discount))}g`;
      buttons.push({
        x: 30, y: yOff, width: 500, height: 36, label,
        enabled: owned ? !equipped : canBuy,
        action: () => {
          if (owned) { player.shield = key; }
          else if (canBuy) { Econ.buyShield(economy, key, discount); player.shield = key; }
        },
      });
      yOff += 42;
    }

    if (economy.buildings.wizardTower) {
      yOff += 10;
      headers.push({ text: '-- Consumables --', y: yOff - 4 });
      yOff += 20;
      const canBuyP = Econ.canBuyPotion(economy, player.potions, discount);
      buttons.push({
        x: 30, y: yOff, width: 500, height: 36,
        label: `Stoneskin Potion (${player.potions}/3) - ${Math.round(POTIONS.stoneskin.cost * (1 - discount))}g`,
        enabled: canBuyP,
        action: () => { Econ.buyPotion(economy, discount); player.potions++; },
      });
      yOff += 42;
    }
  } else if (currentTab === 2) {
    for (const [key, def] of Object.entries(TROOPS)) {
      const visible = !def.requires || economy.buildings[def.requires];
      if (!visible) continue;
      const count = economy.troopCounts[key] || 0;
      const canHire = Econ.canHireTroop(economy, key, discount);

      buttons.push({
        x: 30, y: yOff, width: 500, height: 44,
        label: `${def.name} (${count}/${def.max}) HP:${def.hp} DMG:${def.damage} - ${Math.round(def.cost * (1 - discount))}g`,
        enabled: canHire,
        action: () => { Econ.hireTroop(economy, key, discount); },
      });
      yOff += 52;
    }
  } else if (currentTab === 3) {
    headers.push({ text: `Skill Points: ${player.skillPoints}`, y: yOff, color: '#ff0' });
    yOff += 26;

    const branches = ['combat', 'defense', 'economy'];
    const branchNames = ['Combat', 'Defense', 'Economy'];

    for (let b = 0; b < branches.length; b++) {
      headers.push({ text: `-- ${branchNames[b]} --`, y: yOff });
      yOff += 20;

      for (const skill of SKILLS[branches[b]]) {
        const rank = player.skills[skill.id] || 0;
        const canLevel = player.skillPoints > 0 && rank < skill.maxRank;

        buttons.push({
          x: 30, y: yOff, width: 500, height: 36,
          label: `${skill.name} (${rank}/${skill.maxRank}) ${skill.desc}`,
          enabled: canLevel,
          action: () => {
            const r = player.skills[skill.id] || 0;
            if (player.skillPoints > 0 && r < skill.maxRank) {
              player.skills[skill.id] = r + 1;
              player.skillPoints--;
              recalcStats(player);
            }
          },
        });
        yOff += 42;
      }
      yOff += 10;
    }
  }

  // Process click
  if (mouseClicked) {
    for (const btn of buttons) {
      if (btn.enabled !== false && pointInRect(mouse.x, mouse.y, btn)) {
        btn.action();
        break;
      }
    }
  }
}

export function drawShop(player, economy, waveManager) {
  const ctx = getCtx();

  // Background overlay
  ctx.fillStyle = 'rgba(10, 10, 30, 0.92)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Header
  drawTextCentered(`WAVE ${waveManager.wave} COMPLETE!`, 14, 16, '#fff');
  drawText(`Gold: ${economy.gold}`, GAME_WIDTH - 220, 14, 12, '#ffdd44');

  // Tabs
  const mouse = getMouse();
  for (let i = 0; i < TABS.length; i++) {
    const bx = 30 + i * 160;
    const isActive = currentTab === i;
    drawRect(bx, 60, 140, 30, isActive ? '#557' : '#334');
    drawText(TABS[i], bx + 8, 68, 8, isActive ? '#fff' : '#888');
  }

  // Section headers
  for (const h of headers) {
    drawText(h.text, 30, h.y, 10, h.color || '#aaa');
  }

  // Draw buttons
  for (const btn of buttons) {
    if (btn.isTab) continue;
    const hover = pointInRect(mouse.x, mouse.y, btn);
    const color = btn.enabled === false ? '#222' : hover ? '#446' : '#334';
    const textColor = btn.enabled === false ? '#555' : '#ddd';
    drawRect(btn.x, btn.y, btn.width, btn.height, color);
    ctx.strokeStyle = btn.enabled === false ? '#333' : '#556';
    ctx.lineWidth = 1;
    ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
    drawText(btn.label || '', btn.x + 8, btn.y + 8, 8, textColor);
  }

  // Start next wave button
  const startBtn = { x: GAME_WIDTH / 2 - 120, y: GAME_HEIGHT - 60, width: 240, height: 40 };
  const hover = pointInRect(mouse.x, mouse.y, startBtn);
  drawRect(startBtn.x, startBtn.y, startBtn.width, startBtn.height, hover ? '#484' : '#363');
  ctx.strokeStyle = '#5a5';
  ctx.lineWidth = 2;
  ctx.strokeRect(startBtn.x, startBtn.y, startBtn.width, startBtn.height);
  drawTextCentered('START NEXT WAVE', GAME_HEIGHT - 48, 12, '#fff');

  return startBtn;
}

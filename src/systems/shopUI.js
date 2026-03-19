import { GAME_WIDTH, GAME_HEIGHT, BUILDINGS, WEAPON_CLASSES, SPECIAL_WEAPONS, ARMORS, SHIELDS, TROOPS, POTIONS, ACTIVE_SKILLS, SKILLS } from '../config.js';
import { drawRect, drawText, drawBar, drawTextCentered, getCtx } from '../renderer.js';
import { pointInRect } from '../utils/collision.js';
import { getMouse, getWheelDelta } from '../input.js';
import * as Econ from './economy.js';
import { recalcStats } from '../entities/player.js';
import { updateTechTree, drawTechTree } from '../ui/techTreeUI.js';
import { playPurchase, playShopClick } from './audio.js';
import { spawnGoldSparkle } from './particles.js';

function _triggerEquipFlash(player) {
  player.equipFlashTimer = 0.3;
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  for (let i = 0; i < 6; i++) spawnGoldSparkle(px, py);
}

const TABS = ['BUILDINGS', 'EQUIPMENT', 'TROOPS', 'SKILLS', 'CONSUMABLES'];
let currentTab = 0;
let scrollOffset = 0;
let buttons = [];
let headers = [];
let parchmentCanvas = null;
let newItemTabs = new Set();

// ─── Helper: rounded rectangle path ─────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Coin icon (small, for header) ──────────────────────────────
function drawSmallCoin(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#ddaa22';
  ctx.fill();
  ctx.strokeStyle = '#886611';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Inner ring
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(119,85,0,0.35)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // Shine
  ctx.beginPath();
  ctx.arc(-2, -2, 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
  ctx.restore();
}

function buildParchmentTexture() {
  const c = document.createElement('canvas');
  c.width = GAME_WIDTH;
  c.height = GAME_HEIGHT;
  const g = c.getContext('2d');

  // Base warm beige
  g.fillStyle = '#d4c4a0';
  g.fillRect(0, 0, c.width, c.height);

  // Noise patches -- wider range from #c4b490 to #e4d4b0
  // Darker patches
  g.fillStyle = '#c0ae88';
  for (let py = 0; py < c.height; py += 6) {
    for (let px = 0; px < c.width; px += 6) {
      const h = ((px * 13 + py * 7 + 5) % 37);
      if (h < 12) {
        g.fillRect(px, py, 8 + (h % 4), 6 + (h % 3));
      }
    }
  }

  // Lighter patches for variation
  g.fillStyle = '#e0d0a8';
  for (let py = 0; py < c.height; py += 10) {
    for (let px = 0; px < c.width; px += 10) {
      const h = ((px * 11 + py * 23 + 9) % 41);
      if (h < 8) {
        g.fillRect(px, py, 10 + (h % 3), 8 + (h % 2));
      }
    }
  }

  // Medium tone patches
  g.fillStyle = '#ccbc98';
  for (let py = 0; py < c.height; py += 14) {
    for (let px = 0; px < c.width; px += 14) {
      const h = ((px * 19 + py * 11 + 3) % 53);
      if (h < 7) {
        g.fillRect(px, py, 12, 8);
      }
    }
  }

  // Subtle stain spots (3-4 darker circles at random positions)
  const stains = [
    [c.width * 0.2, c.height * 0.3, 40],
    [c.width * 0.7, c.height * 0.15, 35],
    [c.width * 0.5, c.height * 0.7, 45],
    [c.width * 0.85, c.height * 0.6, 30],
  ];
  for (const [sx, sy, sr] of stains) {
    const stainGrad = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
    stainGrad.addColorStop(0, 'rgba(100,80,50,0.08)');
    stainGrad.addColorStop(0.6, 'rgba(100,80,50,0.04)');
    stainGrad.addColorStop(1, 'rgba(100,80,50,0)');
    g.fillStyle = stainGrad;
    g.beginPath();
    g.arc(sx, sy, sr, 0, Math.PI * 2);
    g.fill();
  }

  // Vignette darkening around edges (wider, more visible)
  const vignetteW = 30;
  // Top
  for (let i = 0; i < vignetteW; i++) {
    const a = (1 - i / vignetteW) * 0.2;
    g.fillStyle = `rgba(60,45,20,${a})`;
    g.fillRect(0, i, c.width, 1);
  }
  // Bottom
  for (let i = 0; i < vignetteW; i++) {
    const a = (1 - i / vignetteW) * 0.2;
    g.fillStyle = `rgba(60,45,20,${a})`;
    g.fillRect(0, c.height - 1 - i, c.width, 1);
  }
  // Left
  for (let i = 0; i < vignetteW; i++) {
    const a = (1 - i / vignetteW) * 0.2;
    g.fillStyle = `rgba(60,45,20,${a})`;
    g.fillRect(i, 0, 1, c.height);
  }
  // Right
  for (let i = 0; i < vignetteW; i++) {
    const a = (1 - i / vignetteW) * 0.2;
    g.fillStyle = `rgba(60,45,20,${a})`;
    g.fillRect(c.width - 1 - i, 0, 1, c.height);
  }

  // Corner darkening for extra depth
  const corners = [
    [0, 0], [c.width, 0], [0, c.height], [c.width, c.height],
  ];
  for (const [cx, cy] of corners) {
    const cGrad = g.createRadialGradient(cx, cy, 0, cx, cy, 120);
    cGrad.addColorStop(0, 'rgba(50,35,15,0.12)');
    cGrad.addColorStop(1, 'rgba(50,35,15,0)');
    g.fillStyle = cGrad;
    g.beginPath();
    g.arc(cx, cy, 120, 0, Math.PI * 2);
    g.fill();
  }

  // Thick gold border with inner glow
  // Inner glow
  g.strokeStyle = 'rgba(200,170,80,0.15)';
  g.lineWidth = 6;
  g.strokeRect(6, 6, c.width - 12, c.height - 12);
  // Main gold border
  g.strokeStyle = '#a08040';
  g.lineWidth = 3;
  g.strokeRect(4, 4, c.width - 8, c.height - 8);
  // Outer darker accent
  g.strokeStyle = 'rgba(80,60,30,0.4)';
  g.lineWidth = 1;
  g.strokeRect(2, 2, c.width - 4, c.height - 4);

  return c;
}

function getParchment() {
  if (!parchmentCanvas) parchmentCanvas = buildParchmentTexture();
  return parchmentCanvas;
}

export function resetShop() {
  currentTab = 0;
  scrollOffset = 0;
  buttons = [];
  headers = [];
  newItemTabs.add(4); // CONSUMABLES
  newItemTabs.add(1); // EQUIPMENT
  newItemTabs.add(2); // TROOPS
  newItemTabs.add(3); // SKILLS
}

export function updateShop(player, economy, mouseClicked) {
  const mouse = getMouse();
  buttons = [];
  headers = [];

  scrollOffset += getWheelDelta() * 0.5;
  scrollOffset = Math.max(0, Math.min(scrollOffset, 600)); // clamp to reasonable max

  // Tab buttons
  for (let i = 0; i < TABS.length; i++) {
    const bx = 30 + i * 160;
    const by = 60;
    buttons.push({ x: bx, y: by, width: 140, height: 30, isTab: true, action: () => { currentTab = i; scrollOffset = 0; newItemTabs.delete(i); playShopClick(); } });
  }

  const discount = player.costDiscount;

  if (currentTab === 0) {
    // ── Tech Tree (handled by techTreeUI.js) ──
    updateTechTree(economy, discount, mouseClicked);
    // No list buttons for buildings tab — the tech tree handles its own clicks
  } else if (currentTab === 1) {
    // ── Equipment Tab: Weapon Lanes + Armor/Shields ──
    buildEquipmentTab(player, economy, discount, mouseClicked);
  } else if (currentTab === 2) {
    buildTroopsTab(player, economy, discount);
  } else if (currentTab === 3) {
    buildSkillsTab(player, economy, discount);
  } else if (currentTab === 4) {
    buildConsumablesTab(player, economy, discount);
  }

  // Process clicks: tab buttons always, content buttons for non-tech-tree tabs
  if (mouseClicked) {
    for (const btn of buttons) {
      if (btn.enabled !== false && pointInRect(mouse.x, mouse.y, btn)) {
        btn.action();
        if (!btn.isTab) playPurchase();
        break;
      }
    }
  }
}

// ═══ Equipment Tab ═══

function buildEquipmentTab(player, economy, discount, mouseClicked) {
  const mouse = getMouse();

  // Process weapon lane clicks during update phase (not draw phase)
  if (mouseClicked) {
    processWeaponLaneClicks(player, economy, discount, mouse);
  }

  let yOff = 350 - scrollOffset; // Armor/shields start below the weapon lanes area

  // ── Armor ──
  headers.push({ text: '-- Armor --', y: yOff - 4 });
  yOff += 18;
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
      x: 30, y: yOff, width: 440, height: 30, label,
      enabled: owned ? !equipped : canBuy,
      action: () => {
        if (owned) { player.armor = key; recalcStats(player); _triggerEquipFlash(player); }
        else if (canBuy) { Econ.buyArmor(economy, key, discount); player.armor = key; recalcStats(player); _triggerEquipFlash(player); }
      },
    });
    yOff += 34;
  }

  // ── Shields ──
  yOff += 6;
  headers.push({ text: '-- Shields --', y: yOff - 4 });
  yOff += 18;
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
      x: 30, y: yOff, width: 440, height: 30, label,
      enabled: owned ? !equipped : canBuy,
      action: () => {
        if (owned) { player.shield = key; _triggerEquipFlash(player); }
        else if (canBuy) { Econ.buyShield(economy, key, discount); player.shield = key; _triggerEquipFlash(player); }
      },
    });
    yOff += 34;
  }

}

function buildConsumablesTab(player, economy, discount) {
  let yOff = 110 - scrollOffset;
  headers.push({ text: '-- Potions --', y: yOff - 4 });
  yOff += 18;

  // Minor Heal Potion (always available)
  const minorCount = player.potions.minorHeal || 0;
  const canBuyMinor = Econ.canBuyPotion(economy, 'minorHeal', minorCount, discount);
  buttons.push({
    x: 30, y: yOff, width: 500, height: 34,
    label: `Minor Heal Potion (+25 HP) (${minorCount}/${POTIONS.minorHeal.maxCarry}) - ${Math.round(POTIONS.minorHeal.cost * (1 - discount))}g`,
    enabled: canBuyMinor,
    action: () => {
      if (Econ.canBuyPotion(economy, 'minorHeal', player.potions.minorHeal || 0, discount)) {
        Econ.buyPotion(economy, 'minorHeal', discount);
        player.potions.minorHeal = (player.potions.minorHeal || 0) + 1;
      }
    },
  });
  yOff += 38;

  // Stoneskin Potion (requires wizardTower)
  if (economy.buildings.wizardTower) {
    const stoneskinCount = player.potions.stoneskin || 0;
    const canBuyStoneskin = Econ.canBuyPotion(economy, 'stoneskin', stoneskinCount, discount);
    buttons.push({
      x: 30, y: yOff, width: 500, height: 34,
      label: `Stoneskin Potion (+75 HP) (${stoneskinCount}/${POTIONS.stoneskin.maxCarry}) - ${Math.round(POTIONS.stoneskin.cost * (1 - discount))}g`,
      enabled: canBuyStoneskin,
      action: () => {
        if (Econ.canBuyPotion(economy, 'stoneskin', player.potions.stoneskin || 0, discount)) {
          Econ.buyPotion(economy, 'stoneskin', discount);
          player.potions.stoneskin = (player.potions.stoneskin || 0) + 1;
        }
      },
    });
    yOff += 38;
  }

  // Active Skills section
  yOff += 16;
  headers.push({ text: '-- Active Skills --', y: yOff - 4 });
  yOff += 18;

  for (const [skillKey, def] of Object.entries(ACTIVE_SKILLS)) {
    const owned = player.activeSkills && player.activeSkills.includes(skillKey);
    const canBuy = Econ.canBuyActiveSkill(economy, skillKey, player, discount);
    const reqName = def.requires ? (BUILDINGS[def.requires]?.name || def.requires) : null;

    let label;
    if (owned) {
      label = `> ${def.name} [EQUIPPED] - CD: ${def.cooldown}s`;
    } else if (reqName && !economy.buildings[def.requires]) {
      label = `${def.name} (${def.cost}g) [Needs ${reqName}]`;
    } else if (player.activeSkills && player.activeSkills.length >= 2) {
      label = `${def.name} [FULL - 2 skill slots used]`;
    } else {
      label = `${def.name} - ${Math.round(def.cost * (1 - discount))}g - ${def.description}`;
    }

    buttons.push({
      x: 30, y: yOff, width: 500, height: 38,
      label,
      enabled: canBuy && !owned,
      action: () => {
        if (Econ.canBuyActiveSkill(economy, skillKey, player, discount)) {
          Econ.buyActiveSkill(economy, skillKey, player, discount);
        }
      },
    });
    yOff += 42;
  }
}

function buildTroopsTab(player, economy, discount) {
  let yOff = 110 - scrollOffset;
  for (const [key, def] of Object.entries(TROOPS)) {
    const visible = !def.requires || economy.buildings[def.requires];
    if (!visible) continue;
    const count = economy.troopCounts[key] || 0;
    const canHire = Econ.canHireTroop(economy, key, discount);

    buttons.push({
      x: 30, y: yOff, width: 500, height: 44,
      label: `${def.name} (${count}/${def.max}) HP:${def.hp} DMG:${def.damage} - ${Math.round(def.cost * (1 - discount))}g`,
      enabled: canHire,
      troopKey: key,
      troopDef: def,
      troopCount: count,
      troopCost: Math.round(def.cost * (1 - discount)),
      action: () => { Econ.hireTroop(economy, key, discount); },
    });
    yOff += 52;
  }
}

function buildSkillsTab(player, economy, discount) {
  let yOff = 110 - scrollOffset;
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
        skillBranch: branches[b],
        skillData: skill,
        skillRank: rank,
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

// ═══ Drawing ═══

export function drawShop(player, economy, waveManager) {
  const ctx = getCtx();
  const mouse = getMouse();
  const discount = player.costDiscount;

  // Parchment background
  ctx.drawImage(getParchment(), 0, 0);

  // Header -- dark brown on parchment with gold accent shadow
  ctx.save();
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#c09030';
  ctx.fillText(`WAVE ${waveManager.wave} COMPLETE!`, GAME_WIDTH / 2 + 1, 15);
  ctx.fillStyle = '#4a3020';
  ctx.fillText(`WAVE ${waveManager.wave} COMPLETE!`, GAME_WIDTH / 2, 14);
  ctx.restore();

  // Gold display with coin icon
  drawSmallCoin(ctx, GAME_WIDTH - 228, 19);
  ctx.font = '12px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(80,50,10,0.3)';
  ctx.fillText(`${economy.gold}`, GAME_WIDTH - 217, 15);
  ctx.fillStyle = '#c08020';
  ctx.fillText(`${economy.gold}`, GAME_WIDTH - 218, 14);

  if (economy.crystals > 0) {
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#4466aa';
    ctx.fillText(`Crystals: ${economy.crystals}`, GAME_WIDTH - 220, 32);
  }

  // ─── Tabs: leather bookmark tabs (trapezoid shape) ───
  const tabBaseline = 90; // bottom of tabs
  for (let i = 0; i < TABS.length; i++) {
    const bx = 30 + i * 160;
    const isActive = currentTab === i;
    const tabW = 140;
    const tabH = isActive ? 36 : 28;
    const tabY = tabBaseline - tabH;
    const hovered = pointInRect(mouse.x, mouse.y, { x: bx, y: tabY, width: tabW, height: tabH });
    const inset = 8; // trapezoid narrowing at top

    ctx.save();

    // Trapezoid path (wider at bottom, narrower at top)
    ctx.beginPath();
    ctx.moveTo(bx, tabBaseline);                          // bottom-left
    ctx.lineTo(bx + inset, tabY + 3);                     // top-left (inset)
    ctx.quadraticCurveTo(bx + inset + 2, tabY, bx + inset + 4, tabY); // rounded top-left
    ctx.lineTo(bx + tabW - inset - 4, tabY);              // top edge
    ctx.quadraticCurveTo(bx + tabW - inset - 2, tabY, bx + tabW - inset, tabY + 3); // rounded top-right
    ctx.lineTo(bx + tabW, tabBaseline);                    // bottom-right
    ctx.closePath();

    // Fill
    if (isActive) {
      ctx.fillStyle = '#ddd0b0';
    } else if (hovered) {
      ctx.fillStyle = '#bba880';
    } else {
      ctx.fillStyle = '#a89870';
    }
    ctx.fill();

    // Border
    ctx.strokeStyle = isActive ? '#a08040' : '#806838';
    ctx.lineWidth = isActive ? 2.5 : 1;
    ctx.stroke();

    // Active tab: subtle inner glow
    if (isActive) {
      ctx.strokeStyle = 'rgba(240,220,160,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + 3, tabBaseline - 1);
      ctx.lineTo(bx + inset + 3, tabY + 5);
      ctx.lineTo(bx + tabW - inset - 3, tabY + 5);
      ctx.lineTo(bx + tabW - 3, tabBaseline - 1);
      ctx.stroke();
    }

    // Stitching lines (1-2 thin horizontal lines for leather texture)
    ctx.strokeStyle = isActive ? 'rgba(100,80,50,0.2)' : 'rgba(60,45,25,0.25)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    const stitch1Y = tabY + tabH * 0.35;
    const stitch2Y = tabY + tabH * 0.65;
    // Stitch line 1
    ctx.beginPath();
    ctx.moveTo(bx + inset + 6, stitch1Y);
    ctx.lineTo(bx + tabW - inset - 6, stitch1Y);
    ctx.stroke();
    // Stitch line 2
    ctx.beginPath();
    ctx.moveTo(bx + 4, stitch2Y);
    ctx.lineTo(bx + tabW - 4, stitch2Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();

    // Tab text
    const textY = tabY + tabH / 2 - 3;
    ctx.save();
    ctx.font = isActive ? 'bold 9px "Press Start 2P", monospace' : '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // Drop shadow
    if (isActive) {
      ctx.fillStyle = 'rgba(80,60,30,0.3)';
      ctx.fillText(TABS[i], bx + tabW / 2 + 1, textY + 1);
    }
    ctx.fillStyle = isActive ? '#3a2010' : '#6a5a40';
    ctx.fillText(TABS[i], bx + tabW / 2, textY);
    ctx.restore();

    // Gold pulsing dot for tabs with new items
    if (newItemTabs.has(i)) {
      const dotTime = performance.now() / 1000;
      const dotAlpha = 0.7 + 0.3 * Math.sin(dotTime * 4);
      ctx.save();
      ctx.globalAlpha = dotAlpha;
      ctx.beginPath();
      ctx.arc(bx + tabW - 10, tabY + 8, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffcc00';
      ctx.fill();
      ctx.strokeStyle = '#aa8800';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Content area
  if (currentTab === 0) {
    drawTechTree(economy, discount);
  } else if (currentTab === 1) {
    drawWeaponLanes(ctx, player, economy, discount, mouse);
    drawListContent(ctx, mouse);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 100, GAME_WIDTH, GAME_HEIGHT - 170);
    ctx.clip();
    drawListHeaders(ctx);
    drawListButtons(ctx, mouse);
    ctx.restore();
  }

  // ─── Start next wave button: shield shape with green gradient + sword icons ───
  const startBtn = { x: GAME_WIDTH / 2 - 120, y: GAME_HEIGHT - 60, width: 240, height: 40 };
  const hover = pointInRect(mouse.x, mouse.y, startBtn);
  const time = performance.now() / 1000;

  ctx.save();
  // Shield shape (pointed bottom)
  const sx = startBtn.x;
  const sy = startBtn.y;
  const sw = startBtn.width;
  const sh = startBtn.height;
  ctx.beginPath();
  ctx.moveTo(sx + 8, sy);
  ctx.lineTo(sx + sw - 8, sy);
  ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + 8);
  ctx.lineTo(sx + sw, sy + sh * 0.6);
  ctx.quadraticCurveTo(sx + sw - 20, sy + sh, sx + sw / 2, sy + sh + 6);
  ctx.quadraticCurveTo(sx + 20, sy + sh, sx, sy + sh * 0.6);
  ctx.lineTo(sx, sy + 8);
  ctx.quadraticCurveTo(sx, sy, sx + 8, sy);
  ctx.closePath();

  // Pulsing glow when hovered
  if (hover) {
    const glowAlpha = 0.15 + 0.1 * Math.sin(time * 4);
    ctx.save();
    ctx.shadowColor = `rgba(200,180,60,${glowAlpha + 0.3})`;
    ctx.shadowBlur = 12 + 4 * Math.sin(time * 4);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fill();
    ctx.restore();
  }

  // Green gradient fill
  const btnGrad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
  btnGrad.addColorStop(0, hover ? '#669944' : '#557733');
  btnGrad.addColorStop(1, hover ? '#446622' : '#334411');
  ctx.fillStyle = btnGrad;
  ctx.fill();

  // Gold border with pulsing brightness on hover
  if (hover) {
    const borderBright = 160 + Math.round(40 * Math.sin(time * 4));
    ctx.strokeStyle = `rgb(${borderBright},${Math.round(borderBright * 0.65)},64)`;
    ctx.lineWidth = 2.5;
  } else {
    ctx.strokeStyle = '#a08040';
    ctx.lineWidth = 2;
  }
  ctx.stroke();

  // Inner highlight
  if (hover) {
    ctx.strokeStyle = 'rgba(200,180,80,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  // Sword icons on each side of text
  const btnCenterY = sy + sh / 2;
  // Left sword
  ctx.save();
  ctx.strokeStyle = '#ffdd88';
  ctx.lineWidth = 2;
  const lsx = sx + 22;
  // Blade (angled line)
  ctx.beginPath();
  ctx.moveTo(lsx, btnCenterY + 6);
  ctx.lineTo(lsx + 10, btnCenterY - 8);
  ctx.stroke();
  // Cross guard
  ctx.beginPath();
  ctx.moveTo(lsx + 3, btnCenterY - 1);
  ctx.lineTo(lsx + 9, btnCenterY + 2);
  ctx.stroke();
  ctx.restore();

  // Right sword (mirrored)
  ctx.save();
  ctx.strokeStyle = '#ffdd88';
  ctx.lineWidth = 2;
  const rsx = sx + sw - 22;
  ctx.beginPath();
  ctx.moveTo(rsx, btnCenterY + 6);
  ctx.lineTo(rsx - 10, btnCenterY - 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rsx - 3, btnCenterY - 1);
  ctx.lineTo(rsx - 9, btnCenterY + 2);
  ctx.stroke();
  ctx.restore();

  // Button text
  ctx.save();
  ctx.font = '12px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(20,10,0,0.4)';
  ctx.fillText('START NEXT WAVE', GAME_WIDTH / 2 + 1, btnCenterY + 1);
  ctx.fillStyle = '#ffdd88';
  ctx.fillText('START NEXT WAVE', GAME_WIDTH / 2, btnCenterY);
  ctx.restore();

  return startBtn;
}

// ═══ Weapon Lane Click Processing (update phase) ═══

function processWeaponLaneClicks(player, economy, discount, mouse) {
  const laneX = 30;
  let laneY = 104;
  const tierW = 130;
  const tierH = 32;
  const tierGap = 10;
  const laneH = 48;

  // Weapon class tiers
  for (const [classKey, cls] of Object.entries(WEAPON_CLASSES)) {
    const isCurrentClass = player.weaponClass === classKey && !player.weaponSpecial;
    const boxY = laneY + 14;

    for (let t = 0; t < cls.tiers.length; t++) {
      const tier = cls.tiers[t];
      const bx = laneX + t * (tierW + tierGap);
      const unlocked = !tier.requires || economy.buildings[tier.requires];
      const isEquipped = isCurrentClass && player.weaponTier === t;
      const isNextUpgrade = isCurrentClass && player.weaponTier === t - 1;
      const isSwitchTarget = t === 0 && !isCurrentClass;

      if (pointInRect(mouse.x, mouse.y, { x: bx, y: boxY, width: tierW, height: tierH })) {
        if (isNextUpgrade && unlocked && Econ.canUpgradeWeapon(economy, player, discount)) {
          Econ.upgradeWeapon(economy, player, discount);
          playPurchase();
          _triggerEquipFlash(player);
          return; // one action per click
        }
        if (isSwitchTarget && unlocked && Econ.canSwitchWeaponClass(economy, player, classKey, discount)) {
          Econ.switchWeaponClass(economy, player, classKey, discount);
          playPurchase();
          _triggerEquipFlash(player);
          return;
        }
      }
    }
    laneY += laneH;
  }

  // Special weapon cards
  laneY += 4 + 14;
  const specKeys = Object.keys(SPECIAL_WEAPONS);
  const cardW = Math.min(180, (GAME_WIDTH - 60 - (specKeys.length - 1) * 8) / specKeys.length);
  const cardH = 40;

  for (let i = 0; i < specKeys.length; i++) {
    const key = specKeys[i];
    const cx = laneX + i * (cardW + 8);
    if (pointInRect(mouse.x, mouse.y, { x: cx, y: laneY, width: cardW, height: cardH })) {
      if (Econ.canBuySpecialWeapon(economy, player, key, discount)) {
        Econ.buySpecialWeapon(economy, player, key, discount);
        playPurchase();
        _triggerEquipFlash(player);
        return;
      }
    }
  }
}

// ═══ Weapon Lanes Drawing ═══

function drawWeaponLanes(ctx, player, economy, discount, mouse) {
  const laneX = 30;
  let laneY = 104;
  const tierW = 130;
  const tierH = 32;
  const tierGap = 10;
  const laneH = 48;
  const time = performance.now() / 1000;

  for (const [classKey, cls] of Object.entries(WEAPON_CLASSES)) {
    const isCurrentClass = player.weaponClass === classKey && !player.weaponSpecial;

    // Lane label in warm brown
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (isCurrentClass) {
      ctx.fillStyle = 'rgba(80,50,10,0.3)';
      ctx.fillText(`${cls.name} (${cls.type})`, laneX + 1, laneY + 1);
      ctx.fillStyle = '#8a6a20';
    } else {
      ctx.fillStyle = '#8a7a60';
    }
    ctx.fillText(`${cls.name} (${cls.type})`, laneX, laneY);

    // Tier boxes
    const boxY = laneY + 14;
    for (let t = 0; t < cls.tiers.length; t++) {
      const tier = cls.tiers[t];
      const bx = laneX + t * (tierW + tierGap);
      const unlocked = !tier.requires || economy.buildings[tier.requires];
      const isEquipped = isCurrentClass && player.weaponTier === t;
      const isNextUpgrade = isCurrentClass && player.weaponTier === t - 1;
      const isSwitchTarget = t === 0 && !isCurrentClass;
      const upgCost = isNextUpgrade ? Econ.getUpgradeCost(player, discount) : null;
      const canUpg = isNextUpgrade && Econ.canUpgradeWeapon(economy, player, discount);
      const canSwitch = isSwitchTarget && unlocked && Econ.canSwitchWeaponClass(economy, player, classKey, discount);
      const hovered = pointInRect(mouse.x, mouse.y, { x: bx, y: boxY, width: tierW, height: tierH });

      // Background: parchment-toned
      if (isEquipped) {
        // Gold glow border equipped
        ctx.fillStyle = '#c8bc98';
        roundRect(ctx, bx, boxY, tierW, tierH, 5);
        ctx.fill();
      } else if ((canUpg || canSwitch) && !isEquipped) {
        // Warm highlight pulse
        const pulse = 0.6 + 0.15 * Math.sin(time * 3);
        ctx.fillStyle = `rgba(210,190,130,${pulse})`;
        roundRect(ctx, bx, boxY, tierW, tierH, 5);
        ctx.fill();
      } else if (!unlocked) {
        // Dark desaturated parchment
        ctx.fillStyle = '#9a9080';
        roundRect(ctx, bx, boxY, tierW, tierH, 5);
        ctx.fill();
      } else {
        // Normal parchment
        ctx.fillStyle = '#bfaf8f';
        roundRect(ctx, bx, boxY, tierW, tierH, 5);
        ctx.fill();
      }

      // Border
      if (isEquipped) {
        // Gold glow for equipped
        ctx.strokeStyle = 'rgba(200,170,60,0.4)';
        ctx.lineWidth = 3;
        roundRect(ctx, bx - 1, boxY - 1, tierW + 2, tierH + 2, 6);
        ctx.stroke();
        ctx.strokeStyle = '#b09030';
        ctx.lineWidth = 2;
      } else if (hovered && (canUpg || canSwitch)) {
        ctx.strokeStyle = '#a08040';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = unlocked ? '#907848' : '#807060';
        ctx.lineWidth = 1;
      }
      roundRect(ctx, bx, boxY, tierW, tierH, 5);
      ctx.stroke();

      // Weapon name
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = !unlocked ? '#7a7060' : isEquipped ? '#4a3020' : '#3a2a1a';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText(tier.name, bx + 4, boxY + 4);

      // Stats line
      ctx.fillStyle = !unlocked ? '#8a7a68' : '#6a5a48';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText(`DMG:${tier.damage} SPD:${tier.speed}`, bx + 4, boxY + 16);

      // Cost / status badge
      if (isEquipped) {
        ctx.fillStyle = '#557733';
        ctx.textAlign = 'right';
        ctx.fillText('EQUIPPED', bx + tierW - 4, boxY + 4);
      } else if (isNextUpgrade && unlocked) {
        ctx.fillStyle = canUpg ? '#8a6a10' : '#8a7a60';
        ctx.textAlign = 'right';
        ctx.fillText(`${upgCost}g`, bx + tierW - 4, boxY + 4);
      } else if (isSwitchTarget && unlocked) {
        const swCost = Econ.getSwitchCost(classKey, discount);
        ctx.fillStyle = canSwitch ? '#8a6a10' : '#8a7a60';
        ctx.textAlign = 'right';
        ctx.fillText(`${swCost}g`, bx + tierW - 4, boxY + 4);
      } else if (!unlocked) {
        const reqName = BUILDINGS[tier.requires]?.name || tier.requires;
        ctx.fillStyle = '#8a7a68';
        ctx.textAlign = 'right';
        ctx.font = '5px "Press Start 2P", monospace';
        ctx.fillText(reqName, bx + tierW - 4, boxY + 4);
      }

      // Arrow between tiers: painted arrow shape
      if (t < cls.tiers.length - 1) {
        const arrowX = bx + tierW + 1;
        const arrowY = boxY + tierH / 2;
        ctx.save();
        ctx.fillStyle = '#907848';
        ctx.beginPath();
        // Shaft
        ctx.moveTo(arrowX, arrowY - 1.5);
        ctx.lineTo(arrowX + 4, arrowY - 1.5);
        // Arrow head
        ctx.lineTo(arrowX + 4, arrowY - 4);
        ctx.lineTo(arrowX + 8, arrowY);
        ctx.lineTo(arrowX + 4, arrowY + 4);
        ctx.lineTo(arrowX + 4, arrowY + 1.5);
        // Shaft bottom
        ctx.lineTo(arrowX, arrowY + 1.5);
        ctx.closePath();
        ctx.fill();
        // Highlight top edge
        ctx.strokeStyle = 'rgba(200,170,80,0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY - 1.5);
        ctx.lineTo(arrowX + 4, arrowY - 1.5);
        ctx.lineTo(arrowX + 4, arrowY - 4);
        ctx.lineTo(arrowX + 8, arrowY);
        ctx.stroke();
        ctx.restore();
      }
    }

    laneY += laneH;
  }

  // ── Special Weapons (cards below lanes) ──
  laneY += 4;
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(80,50,10,0.3)';
  ctx.fillText('SPECIAL WEAPONS', laneX + 1, laneY + 1);
  ctx.fillStyle = '#7a6a48';
  ctx.fillText('SPECIAL WEAPONS', laneX, laneY);
  laneY += 14;

  const specKeys = Object.keys(SPECIAL_WEAPONS);
  const cardW = Math.min(180, (GAME_WIDTH - 60 - (specKeys.length - 1) * 8) / specKeys.length);
  const cardH = 40;

  for (let i = 0; i < specKeys.length; i++) {
    const key = specKeys[i];
    const def = SPECIAL_WEAPONS[key];
    const cx = laneX + i * (cardW + 8);
    const isEquipped = player.weaponSpecial === key;
    const unlocked = !def.requires || economy.buildings[def.requires];
    const canBuy = Econ.canBuySpecialWeapon(economy, player, key, discount);
    const hovered = pointInRect(mouse.x, mouse.y, { x: cx, y: laneY, width: cardW, height: cardH });

    // Card background: bordered parchment cards
    if (isEquipped) {
      ctx.fillStyle = '#c8bc98';
    } else if (canBuy && hovered) {
      ctx.fillStyle = '#ccbc98';
    } else if (canBuy) {
      ctx.fillStyle = '#bfaf8f';
    } else {
      ctx.fillStyle = '#a8a088';
    }
    roundRect(ctx, cx, laneY, cardW, cardH, 5);
    ctx.fill();

    // Border
    if (isEquipped) {
      ctx.strokeStyle = 'rgba(200,170,60,0.4)';
      ctx.lineWidth = 3;
      roundRect(ctx, cx - 1, laneY - 1, cardW + 2, cardH + 2, 6);
      ctx.stroke();
      ctx.strokeStyle = '#b09030';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = hovered && canBuy ? '#a08040' : unlocked ? '#907848' : '#807060';
      ctx.lineWidth = 1;
    }
    roundRect(ctx, cx, laneY, cardW, cardH, 5);
    ctx.stroke();

    // Name: calligraphy-style (larger, dark brown)
    ctx.fillStyle = !unlocked ? '#8a7a68' : isEquipped ? '#4a3020' : '#3a2a1a';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(def.name, cx + 4, laneY + 5);

    // Stats
    ctx.fillStyle = '#6a5a48';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillText(`DMG:${def.damage} SPD:${def.speed}`, cx + 4, laneY + 16);

    // Special ability
    ctx.fillStyle = '#7a5a80';
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText(def.special || '', cx + 4, laneY + 27);

    // Cost / status
    ctx.textAlign = 'right';
    if (isEquipped) {
      ctx.fillStyle = '#557733';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText('EQUIPPED', cx + cardW - 4, laneY + 5);
    } else if (unlocked) {
      ctx.fillStyle = canBuy ? '#8a6a10' : '#8a7a60';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText(`${Math.round(def.cost * (1 - discount))}g`, cx + cardW - 4, laneY + 5);
    }
  }
}

// ═══ List Drawing Helpers ═══

function drawListContent(ctx, mouse) {
  // Clip and draw armor/shields/consumables below the weapon lanes
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 340, GAME_WIDTH, GAME_HEIGHT - 410);
  ctx.clip();
  drawListHeaders(ctx);
  drawListButtons(ctx, mouse);
  ctx.restore();
}

function drawListHeaders(ctx) {
  for (const h of headers) {
    const _ctx = ctx || getCtx();
    _ctx.font = '10px "Press Start 2P", monospace';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';

    if (h.color === '#ff0') {
      // Skill points header: prominent gold with star icon
      // Star icon
      _drawStarIcon(_ctx, 34, h.y + 5, 7, '#c09030');
      // Gold accent shadow
      _ctx.fillStyle = '#c09030';
      _ctx.fillText(h.text, 47, h.y + 1);
      // Main text in dark brown
      _ctx.fillStyle = '#4a3020';
      _ctx.fillText(h.text, 46, h.y);
    } else {
      // Section headers: darker brown with gold accent shadow
      _ctx.fillStyle = 'rgba(192,144,48,0.3)';
      _ctx.fillText(h.text, 31, h.y + 1);
      _ctx.fillStyle = h.color || '#4a3020';
      _ctx.fillText(h.text, 30, h.y);
    }
  }
}

function _drawStarIcon(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const innerAngle = angle + Math.PI / 5;
    const ox = cx + Math.cos(angle) * r;
    const oy = cy + Math.sin(angle) * r;
    const ix = cx + Math.cos(innerAngle) * (r * 0.4);
    const iy = cy + Math.sin(innerAngle) * (r * 0.4);
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawListButtons(ctx, mouse) {
  for (const btn of buttons) {
    if (btn.isTab) continue;

    if (btn.troopKey) {
      _drawTroopCard(ctx, btn, mouse);
    } else if (btn.skillBranch) {
      _drawSkillRow(ctx, btn, mouse);
    } else {
      _drawDefaultButton(ctx, btn, mouse);
    }
  }
}

// ─── Default parchment button (equipment, consumables) ───
function _drawDefaultButton(ctx, btn, mouse) {
  const hover = pointInRect(mouse.x, mouse.y, btn);
  const disabled = btn.enabled === false;

  if (disabled) {
    ctx.fillStyle = '#b4a888';
  } else if (hover) {
    ctx.fillStyle = '#d8c8a0';
  } else {
    ctx.fillStyle = '#c8b898';
  }
  roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 5);
  ctx.fill();

  if (disabled) {
    ctx.strokeStyle = '#a89878';
  } else if (hover) {
    ctx.strokeStyle = '#a08040';
    ctx.lineWidth = 1.5;
    roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,170,80,0.2)';
    ctx.lineWidth = 3;
    roundRect(ctx, btn.x - 1, btn.y - 1, btn.width + 2, btn.height + 2, 6);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#907848';
  }
  ctx.lineWidth = 1;
  roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 5);
  ctx.stroke();

  // Text with drop shadow
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  if (disabled) {
    ctx.fillStyle = '#8a7a60';
  } else {
    ctx.fillStyle = '#3a2a15';
    ctx.fillText(btn.label || '', btn.x + 9, btn.y + 9);
    ctx.fillStyle = '#f5e6c8';
  }
  ctx.fillText(btn.label || '', btn.x + 8, btn.y + 8);
}

// ─── Troop Portrait Card ───
function _drawTroopCard(ctx, btn, mouse) {
  const hover = pointInRect(mouse.x, mouse.y, btn);
  const disabled = btn.enabled === false;
  const x = btn.x;
  const y = btn.y;
  const w = btn.width;
  const h = btn.height;
  const def = btn.troopDef;

  ctx.save();

  // Card frame with wavy torn edges
  ctx.beginPath();
  const wavyStep = 4;
  // Top edge (wavy)
  ctx.moveTo(x, y);
  for (let px = x; px <= x + w; px += wavyStep) {
    const offset = Math.sin(px * 0.8 + y * 0.3) * 1.2;
    ctx.lineTo(px, y + offset);
  }
  // Right edge (wavy)
  for (let py = y; py <= y + h; py += wavyStep) {
    const offset = Math.sin(py * 0.7 + x * 0.4) * 1.2;
    ctx.lineTo(x + w + offset, py);
  }
  // Bottom edge (wavy)
  for (let px = x + w; px >= x; px -= wavyStep) {
    const offset = Math.sin(px * 0.9 + (y + h) * 0.5) * 1.2;
    ctx.lineTo(px, y + h + offset);
  }
  // Left edge (wavy)
  for (let py = y + h; py >= y; py -= wavyStep) {
    const offset = Math.sin(py * 0.6 + x * 0.3) * 1.2;
    ctx.lineTo(x + offset, py);
  }
  ctx.closePath();

  // Fill
  ctx.fillStyle = disabled ? '#b8a888' : hover ? '#ddd0b0' : '#d0c0a0';
  ctx.fill();
  ctx.strokeStyle = disabled ? '#a09070' : hover ? '#a08040' : '#8a7048';
  ctx.lineWidth = hover ? 2 : 1.5;
  ctx.stroke();

  // Portrait area (left 60px)
  const portraitX = x + 4;
  const portraitY = y + 4;
  const portraitW = 52;
  const portraitH = h - 8;

  // Portrait background
  ctx.fillStyle = 'rgba(80,60,30,0.12)';
  roundRect(ctx, portraitX, portraitY, portraitW, portraitH, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,80,40,0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, portraitX, portraitY, portraitW, portraitH, 4);
  ctx.stroke();

  // Draw troop portrait
  _drawTroopPortrait(ctx, btn.troopKey, portraitX, portraitY, portraitW, portraitH);

  // Info area (right of portrait)
  const infoX = x + 62;

  // Name in dark brown with shadow
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#3a2a15';
  ctx.fillText(def.name, infoX + 1, y + 6 + 1);
  ctx.fillStyle = disabled ? '#8a7a60' : '#4a3020';
  ctx.fillText(def.name, infoX, y + 6);

  // Stats line: HP and DMG
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.fillStyle = '#6a5a40';
  ctx.fillText(`HP:${def.hp}  DMG:${def.damage}  SPD:${def.speed}`, infoX, y + 18);

  // Count
  ctx.fillStyle = '#5a4a30';
  ctx.fillText(`Hired: ${btn.troopCount}/${def.max}`, infoX, y + 29);

  // Cost in gold color with shadow
  ctx.textAlign = 'right';
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = '#3a2a15';
  ctx.fillText(`${btn.troopCost}g`, x + w - 7, y + 7);
  ctx.fillStyle = disabled ? '#8a7a60' : '#c08020';
  ctx.fillText(`${btn.troopCost}g`, x + w - 8, y + 6);

  // HIRE button area (bottom-right)
  if (!disabled) {
    const hireX = x + w - 60;
    const hireY = y + h - 18;
    const hireW = 50;
    const hireH = 14;
    roundRect(ctx, hireX, hireY, hireW, hireH, 3);
    ctx.fillStyle = hover ? '#6a8a40' : '#5a7a30';
    ctx.fill();
    ctx.strokeStyle = '#8a6a20';
    ctx.lineWidth = 1;
    roundRect(ctx, hireX, hireY, hireW, hireH, 3);
    ctx.stroke();

    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f5e6c8';
    ctx.fillText('HIRE', hireX + hireW / 2, hireY + 3);
  }

  ctx.restore();
}

// ─── Troop Portrait Drawing ───
function _drawTroopPortrait(ctx, key, px, py, pw, ph) {
  const cx = px + pw / 2;
  const cy = py + ph / 2;
  ctx.save();

  switch (key) {
    case 'footman': {
      // Blue helmet dome
      ctx.fillStyle = '#4a6a9a';
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 10, Math.PI, 0);
      ctx.fill();
      // Face area (grey guard)
      ctx.fillStyle = '#8a8a8a';
      ctx.fillRect(cx - 7, cy - 4, 14, 10);
      // Eye slit
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(cx - 5, cy - 1, 10, 2);
      // Sword handle (right side)
      ctx.strokeStyle = '#aa8830';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + 10, cy + 4);
      ctx.lineTo(cx + 14, cy - 6);
      ctx.stroke();
      // Cross guard
      ctx.beginPath();
      ctx.moveTo(cx + 8, cy - 3);
      ctx.lineTo(cx + 14, cy - 3);
      ctx.stroke();
      break;
    }
    case 'archer': {
      // Green hood
      ctx.fillStyle = '#4a7a3a';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14);
      ctx.lineTo(cx - 10, cy + 2);
      ctx.lineTo(cx + 10, cy + 2);
      ctx.closePath();
      ctx.fill();
      // Face
      ctx.fillStyle = '#d4b088';
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 6, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(cx - 4, cy - 3, 2, 2);
      ctx.fillRect(cx + 2, cy - 3, 2, 2);
      // Brown bow (right side)
      ctx.strokeStyle = '#8a5a20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx + 14, cy - 2, 12, -Math.PI * 0.6, Math.PI * 0.6);
      ctx.stroke();
      // Bowstring
      ctx.strokeStyle = '#c0b080';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + 14 + Math.cos(-Math.PI * 0.6) * 12, cy - 2 + Math.sin(-Math.PI * 0.6) * 12);
      ctx.lineTo(cx + 14 + Math.cos(Math.PI * 0.6) * 12, cy - 2 + Math.sin(Math.PI * 0.6) * 12);
      ctx.stroke();
      break;
    }
    case 'knight': {
      // Full helmet
      ctx.fillStyle = '#8888aa';
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 11, 0, Math.PI * 2);
      ctx.fill();
      // Visor cross
      ctx.strokeStyle = '#3a3a4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx, cy + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 2);
      ctx.lineTo(cx + 8, cy - 2);
      ctx.stroke();
      // Purple plume on top
      ctx.fillStyle = '#8a4aaa';
      ctx.beginPath();
      ctx.ellipse(cx + 2, cy - 14, 3, 7, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'wizard': {
      // Pointed purple hat
      ctx.fillStyle = '#7a4a9a';
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 16);
      ctx.lineTo(cx - 10, cy - 2);
      ctx.lineTo(cx + 10, cy - 2);
      ctx.closePath();
      ctx.fill();
      // Hat brim
      ctx.fillStyle = '#6a3a8a';
      ctx.fillRect(cx - 12, cy - 3, 24, 3);
      // Face
      ctx.fillStyle = '#d4b088';
      ctx.beginPath();
      ctx.arc(cx, cy + 3, 6, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(cx - 3, cy + 1, 2, 2);
      ctx.fillRect(cx + 2, cy + 1, 2, 2);
      // Glowing staff orb (right side)
      ctx.fillStyle = '#44ddff';
      ctx.beginPath();
      ctx.arc(cx + 16, cy - 8, 4, 0, Math.PI * 2);
      ctx.fill();
      // Orb glow
      ctx.fillStyle = 'rgba(68,221,255,0.3)';
      ctx.beginPath();
      ctx.arc(cx + 16, cy - 8, 7, 0, Math.PI * 2);
      ctx.fill();
      // Staff line
      ctx.strokeStyle = '#8a6a30';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + 16, cy - 4);
      ctx.lineTo(cx + 14, cy + 12);
      ctx.stroke();
      break;
    }
    case 'shredder': {
      // Heavy metal helmet
      ctx.fillStyle = '#6a6a70';
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy + 2);
      ctx.lineTo(cx - 10, cy - 10);
      ctx.lineTo(cx + 10, cy - 10);
      ctx.lineTo(cx + 12, cy + 2);
      ctx.closePath();
      ctx.fill();
      // Helmet rivets
      ctx.fillStyle = '#aaaaaa';
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 6, cy - 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Eye slit (red glow)
      ctx.fillStyle = '#cc3333';
      ctx.fillRect(cx - 5, cy - 3, 10, 2);
      // Mechanical arm (left side)
      ctx.strokeStyle = '#7a7a80';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy + 2);
      ctx.lineTo(cx - 18, cy + 10);
      ctx.stroke();
      // Claw
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy + 10);
      ctx.lineTo(cx - 22, cy + 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy + 10);
      ctx.lineTo(cx - 22, cy + 12);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

// ─── Skill Row Drawing ───
function _drawSkillRow(ctx, btn, mouse) {
  const hover = pointInRect(mouse.x, mouse.y, btn);
  const disabled = btn.enabled === false;
  const x = btn.x;
  const y = btn.y;
  const w = btn.width;
  const h = btn.height;
  const skill = btn.skillData;
  const rank = btn.skillRank;
  const branch = btn.skillBranch;

  ctx.save();

  // Row background
  if (disabled) {
    ctx.fillStyle = '#b4a888';
  } else if (hover) {
    ctx.fillStyle = '#d8c8a0';
  } else {
    ctx.fillStyle = '#c8b898';
  }
  roundRect(ctx, x, y, w, h, 5);
  ctx.fill();

  // Border
  ctx.strokeStyle = disabled ? '#a89878' : hover ? '#a08040' : '#907848';
  ctx.lineWidth = hover ? 1.5 : 1;
  roundRect(ctx, x, y, w, h, 5);
  ctx.stroke();
  if (hover && !disabled) {
    ctx.strokeStyle = 'rgba(200,170,80,0.2)';
    ctx.lineWidth = 3;
    roundRect(ctx, x - 1, y - 1, w + 2, h + 2, 6);
    ctx.stroke();
  }

  // Branch color for circle icon
  const branchColors = { combat: '#aa3030', defense: '#3060aa', economy: '#c09030' };
  const circleColor = branchColors[branch] || '#907848';

  // Skill circle icon (32x32 area on the left)
  const iconCx = x + 20;
  const iconCy = y + h / 2;
  ctx.beginPath();
  ctx.arc(iconCx, iconCy, 12, 0, Math.PI * 2);
  ctx.fillStyle = circleColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Symbol inside circle based on branch
  ctx.fillStyle = '#f5e6c8';
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (branch === 'combat') {
    // Sword symbol (two crossed lines)
    ctx.strokeStyle = '#f5e6c8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(iconCx - 5, iconCy + 5);
    ctx.lineTo(iconCx + 5, iconCy - 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(iconCx + 5, iconCy + 5);
    ctx.lineTo(iconCx - 5, iconCy - 5);
    ctx.stroke();
  } else if (branch === 'defense') {
    // Shield symbol
    ctx.strokeStyle = '#f5e6c8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(iconCx - 5, iconCy - 6);
    ctx.lineTo(iconCx + 5, iconCy - 6);
    ctx.lineTo(iconCx + 5, iconCy + 1);
    ctx.lineTo(iconCx, iconCy + 6);
    ctx.lineTo(iconCx - 5, iconCy + 1);
    ctx.closePath();
    ctx.stroke();
  } else if (branch === 'economy') {
    // Coin symbol
    ctx.fillText('$', iconCx, iconCy + 1);
  }

  // Rank dots (filled = earned, empty = remaining)
  const dotStartX = x + 40;
  const dotY = iconCy;
  const dotR = 4;
  const dotGap = 12;
  for (let r = 0; r < skill.maxRank; r++) {
    const dx = dotStartX + r * dotGap;
    ctx.beginPath();
    ctx.arc(dx, dotY, dotR, 0, Math.PI * 2);
    if (r < rank) {
      ctx.fillStyle = circleColor;
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(80,60,30,0.15)';
      ctx.fill();
      ctx.strokeStyle = circleColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Skill name and description to the right of dots
  const textX = dotStartX + skill.maxRank * dotGap + 8;
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  // Name with drop shadow
  ctx.fillStyle = '#3a2a15';
  ctx.fillText(skill.name, textX + 1, y + 6 + 1);
  ctx.fillStyle = disabled ? '#8a7a60' : '#4a3020';
  ctx.fillText(skill.name, textX, y + 6);

  // Description
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillStyle = '#6a5a40';
  ctx.fillText(`${skill.desc} (${rank}/${skill.maxRank})`, textX, y + 20);

  ctx.restore();
}

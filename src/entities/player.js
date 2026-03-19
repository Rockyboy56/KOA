import { PLAYER, ATTACK, ARMORS, SHIELDS, WORLD_W, WORLD_H, FORT, GATES, POTIONS, ACTIVE_SKILLS } from '../config.js';
import { clamp } from '../utils/math.js';
import * as Input from '../input.js';
import { drawRect, drawBar, drawText, drawCircle, shake, getCtx } from '../renderer.js';
import { getWallSegments, getNearestWall } from '../entities/barricade.js';
import { getEquippedWeapon } from '../systems/economy.js';
import { getBlockingRects, resolveAxis } from '../utils/wallCollision.js';
import { drawPlayer as _drawPlayerNew } from '../rendering/drawPlayer.js';

/** Create a new player entity with default stats, equipment, and position. */
export function createPlayer() {
  return {
    x: PLAYER.startX,
    y: PLAYER.startY,
    width: PLAYER.width,
    height: PLAYER.height,
    hp: PLAYER.maxHP,
    maxHP: PLAYER.maxHP,
    facing: 0, // angle in radians (0 = right, PI/2 = down)

    // Attack state
    attacking: false,
    attackPhase: 'none', // none, windUp, active, recovery
    attackTimer: 0,
    comboCount: 0,
    comboTimer: 0,
    comboCooldownTimer: 0,
    hitEnemiesThisSwing: new Set(),
    swingCount: 0, // for 'every 3rd swing' specials

    // Hit stop (brief freeze on killing blow)
    hitStopTimer: 0,

    // Block
    blocking: false,

    // Repair
    repairing: false,
    repairingSide: null,

    // Equipment (weapon class system)
    weaponClass: 'swords',
    weaponTier: 0,
    weaponSpecial: null, // set to key like 'deflectionGladius' when using a special
    armor: 'none',
    shield: 'wooden',

    // Consumables
    potions: { minorHeal: 0, stoneskin: 0 },

    // Active skills
    activeSkills: [],       // array of equipped active skill keys (max 2)
    skillCooldowns: {},     // { warCry: 0, shieldBash: 0 }

    // Run stats tracking
    potionsUsed: 0,
    weaponUpgrades: 0,
    totalDamageTaken: 0,

    // Level / XP
    level: 1,
    xp: 0,
    xpToNext: 100,
    skillPoints: 0,
    skills: {},

    // Computed stats (recalculated)
    meleeDmgMult: 1,
    attackSpeedMult: 1,
    critChance: 0,
    comboFinisherMult: 1,
    moveSpeedMult: 1,
    blockBonusPct: 0,
    maxHPBonus: 0,
    goldPickupBonus: 0,
    goldDropMult: 1,
    costDiscount: 0,
    troopDmgMult: 1,
    barricadeHPMult: 1,
    buildingDmgMult: 1, // from Master Forge passive

    // Damage flash
    flashTimer: 0,

    // Score
    score: 0,
    kills: 0,
    damageTakenThisWave: 0,

    // Equip flash
    equipFlashTimer: 0,
  };
}

export function recalcStats(p) {
  const sk = p.skills;
  p.meleeDmgMult = 1 + (sk.swordExpertise || 0) * 0.10;
  p.comboFinisherMult = 1 + (sk.powerStrikes || 0) * 0.15;
  p.attackSpeedMult = 1 + (sk.weaponMaster || 0) * 0.05;
  p.critChance = (sk.criticalStrike || 0) * 0.05;
  p.maxHPBonus = (sk.toughness || 0) * 15;
  p.blockBonusPct = (sk.shieldExpertise || 0) * 0.05;
  p.moveSpeedMult = 1 + (sk.nimble || 0) * 0.08;
  p.barricadeHPMult = 1 + (sk.fortify || 0) * 0.10;
  p.costDiscount = (sk.haggler || 0) * 0.05;
  p.goldPickupBonus = (sk.goldMagnet || 0) * 32;
  p.goldDropMult = 1 + (sk.bountyHunter || 0) * 0.10;
  p.troopDmgMult = 1 + (sk.commander || 0) * 0.10;

  p.maxHP = PLAYER.maxHP + p.maxHPBonus;
  if (p.hp > p.maxHP) p.hp = p.maxHP;
}

/** Advance player state by dt: movement, facing, attacking, blocking, and repair. */
export function updatePlayer(p, dt, walls, mouseX, mouseY, camX, camY) {
  const weapon = getEquippedWeapon(p);
  const armor = ARMORS[p.armor];

  // Flash timer
  if (p.flashTimer > 0) p.flashTimer -= dt;

  // Regen from Axe of Regeneration
  if (weapon.special === 'regen2') {
    p.hp = Math.min(p.maxHP, p.hp + 2 * dt);
  }

  // Convert mouse to world coords
  const worldMouseX = mouseX + (camX || 0);
  const worldMouseY = mouseY + (camY || 0);

  // Update facing toward world mouse cursor
  if (mouseX !== undefined && mouseY !== undefined) {
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    p.facing = Math.atan2(worldMouseY - cy, worldMouseX - cx);
  }

  // Repairing
  p.repairing = false;
  p.repairingSide = null;
  if (walls) {
    const pcx = p.x + p.width / 2;
    const pcy = p.y + p.height / 2;
    const nearest = getNearestWall(walls, pcx, pcy);
    if (nearest && nearest.dist < 80 && Input.isRepair() && !p.attacking) {
      p.repairing = true;
      p.repairingSide = nearest.side;
    }
  }

  // Blocking
  const canBlock = weapon.type !== '2h' && weapon.type !== 'ranged';
  p.blocking = canBlock && Input.isBlocking() && !p.attacking && !p.repairing;

  // Attack
  if (p.attacking) {
    p.attackTimer -= dt * 1000;
    if (p.attackTimer <= 0) {
      if (p.attackPhase === 'windUp') {
        p.attackPhase = 'active';
        p.attackTimer = ATTACK.active;
        p.hitEnemiesThisSwing.clear();
      } else if (p.attackPhase === 'active') {
        p.attackPhase = 'recovery';
        const speedMod = weapon.speed * p.attackSpeedMult;
        p.attackTimer = ATTACK.recovery / speedMod;
      } else {
        p.attacking = false;
        p.attackPhase = 'none';
        p.comboTimer = ATTACK.windUp + ATTACK.active + ATTACK.recovery + PLAYER.comboWindow;
      }
    }
  }

  // Combo timer
  if (!p.attacking && p.comboTimer > 0) {
    p.comboTimer -= dt * 1000;
    if (p.comboTimer <= 0) {
      p.comboCount = 0;
    }
  }

  // Combo cooldown
  if (p.comboCooldownTimer > 0) {
    p.comboCooldownTimer -= dt * 1000;
  }

  // Start attack
  if (Input.isAttacking() && !p.attacking && !p.repairing && p.comboCooldownTimer <= 0) {
    p.attacking = true;
    p.attackPhase = 'windUp';
    p.attackTimer = ATTACK.windUp;
    p.swingCount++;

    if (p.comboCount < 3 && p.comboTimer > 0) {
      p.comboCount++;
    } else {
      p.comboCount = 1;
    }

    if (p.comboCount >= 3) {
      p.comboCooldownTimer = PLAYER.comboCooldown;
    }
  }

  // Potion use (Digit1 key)
  if (Input.isPotion() && p.hp < p.maxHP) {
    if (p.potions.stoneskin > 0) {
      p.potions.stoneskin--;
      p.hp = Math.min(p.maxHP, p.hp + POTIONS.stoneskin.heal);
      p.potionsUsed++;
    } else if (p.potions.minorHeal > 0) {
      p.potions.minorHeal--;
      p.hp = Math.min(p.maxHP, p.hp + POTIONS.minorHeal.heal);
      p.potionsUsed++;
    }
  }

  // Active skill cooldowns — clamp to 0 to prevent negative or fractional display
  for (const key of Object.keys(p.skillCooldowns)) {
    if (p.skillCooldowns[key] > 0) {
      p.skillCooldowns[key] -= dt;
      if (p.skillCooldowns[key] < 0) p.skillCooldowns[key] = 0;
    }
  }

  // Movement with wall collision (separate X/Y axes for wall sliding)
  if (!p.repairing && p.attackPhase !== 'windUp') {
    let speed = PLAYER.moveSpeed * (1 - armor.speedPenalty) * p.moveSpeedMult;
    if (p.blocking) speed *= PLAYER.blockSpeedMult;

    let dx = 0, dy = 0;
    if (Input.isMovingLeft())  dx = -1;
    if (Input.isMovingRight()) dx = 1;
    if (Input.isMovingUp())    dy = -1;
    if (Input.isMovingDown())  dy = 1;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }

    // Build blocking rects for player (blocked by solid wall segments, free through gate gaps)
    const rects = walls ? getBlockingRects(walls, 'player') : [];

    // Apply X movement, resolve X collisions
    p.x += dx * speed * dt;
    p.x = clamp(p.x, 0, WORLD_W - p.width);
    resolveAxis(p, rects, 'x');

    // Apply Y movement, resolve Y collisions
    p.y += dy * speed * dt;
    p.y = clamp(p.y, 0, WORLD_H - p.height);
    resolveAxis(p, rects, 'y');
  } else {
    p.x = clamp(p.x, 0, WORLD_W - p.width);
    p.y = clamp(p.y, 0, WORLD_H - p.height);
  }
}

export function getAttackBox(p) {
  const weapon = getEquippedWeapon(p);
  if (weapon.type === 'ranged') return null;

  const range = PLAYER.attackRange;
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;

  // Create attack hitbox in the facing direction
  const ax = cx + Math.cos(p.facing) * (p.width / 2 + range / 2) - range / 2;
  const ay = cy + Math.sin(p.facing) * (p.height / 2 + range / 2) - range / 2;

  return {
    x: ax,
    y: ay,
    width: range,
    height: range,
  };
}

export function getAttackDamage(p) {
  const weapon = getEquippedWeapon(p);
  let dmg = weapon.damage * p.meleeDmgMult * p.buildingDmgMult;

  if (p.comboCount === 2) dmg *= ATTACK.combo2DmgMult;
  if (p.comboCount >= 3) dmg *= ATTACK.combo3DmgMult * p.comboFinisherMult;

  // comboStack special: +5% per combo hit (Berserker Axe)
  if (weapon.special === 'comboStack' && p.comboCount > 1) {
    dmg *= 1 + (p.comboCount - 1) * 0.05;
  }

  // Crit
  const isCrit = Math.random() < p.critChance;
  if (isCrit) dmg *= 2;

  return { dmg: Math.round(dmg), isCrit, cleave: weapon.cleave, knockbackMult: weapon.knockbackMult };
}

export function damagePlayer(p, amount, isMagic = false) {
  const armor = ARMORS[p.armor];
  let dmg = amount;

  // Armor reduction
  dmg *= (1 - armor.reduction);

  // Blocking
  if (p.blocking && !isMagic) {
    const shield = SHIELDS[p.shield];
    const blockPct = shield.block + p.blockBonusPct;
    const wep = getEquippedWeapon(p);
    const extra = wep.special === 'blockBonus20' ? 0.20 : 0;
    dmg *= (1 - Math.min(blockPct + extra, 0.95));
  }

  dmg = Math.max(1, Math.round(dmg));
  p.hp -= dmg;
  p.damageTakenThisWave += dmg;
  p.totalDamageTaken += dmg;
  p.flashTimer = 0.15;
  shake(3, 80);

  if (p.hp <= 0) p.hp = 0;
  return dmg;
}

export function addXP(p, amount) {
  p.xp += amount;
  while (p.xp >= p.xpToNext && p.level < 25) {
    p.xp -= p.xpToNext;
    p.level++;
    p.skillPoints++;
    p.xpToNext = 100 * p.level;
  }
}

// ─── Weapon Visual Lookup Table ───
const WEAPON_VISUALS = {
  // Swords (1h) — drawn as blades extending from handle
  shortsword:      { bladeLen: 14, bladeW: 2, color: '#b0b4bc', hilite: '#dde', grip: '#7a5530', guard: '#aa8844', glow: null, arc: 0.6 },
  longsword:       { bladeLen: 18, bladeW: 2.2, color: '#b8bcc4', hilite: '#eef', grip: '#7a5530', guard: '#aa8844', glow: null, arc: 0.6, fullerLine: true },
  broadsword:      { bladeLen: 20, bladeW: 3.5, color: '#c0c4cc', hilite: '#fff', grip: '#6a4a2a', guard: '#bb9944', glow: null, arc: 0.7, doubleEdge: true },
  runicBlade:      { bladeLen: 22, bladeW: 2.5, color: '#8af', hilite: '#cef', grip: '#445', guard: '#668', glow: '#4488ff', arc: 0.6, particles: 'blue' },
  orcbane:         { bladeLen: 26, bladeW: 3, color: '#fda', hilite: '#ffe', grip: '#884', guard: '#cc8', glow: '#ff8800', arc: 0.8, particles: 'orange' },
  // Axes (2h) — drawn as haft + head
  handAxe:         { type: 'axe', haftLen: 14, headW: 8, headH: 6, color: '#888', grip: '#6a4a2a', glow: null, arc: 0.9 },
  battleAxe:       { type: 'axe', haftLen: 18, headW: 12, headH: 8, color: '#777', grip: '#5a3a1a', glow: null, arc: 1.0, doubleBlade: true },
  executionerAxe:  { type: 'axe', haftLen: 22, headW: 14, headH: 10, color: '#556', grip: '#4a3020', glow: null, arc: 1.1, curved: true },
  axeRegen:        { type: 'axe', haftLen: 20, headW: 12, headH: 9, color: '#4a8', grip: '#5a3a1a', glow: '#44ff44', arc: 0.9, particles: 'green' },
  berserkerAxe:    { type: 'axe', haftLen: 22, headW: 14, headH: 10, color: '#a44', grip: '#4a2020', glow: '#ff4400', arc: 1.1, particles: 'red' },
  // Maces (2h) — drawn as handle + head shape
  mace:            { type: 'mace', haftLen: 12, headR: 5, color: '#999', grip: '#6a4a2a', glow: null, arc: 0.8, impactRing: true },
  flail:           { type: 'flail', haftLen: 10, chainLen: 8, headR: 5, color: '#888', grip: '#5a3a1a', glow: null, arc: 0.8 },
  warHammer:       { type: 'mace', haftLen: 16, headR: 7, headRect: true, color: '#777', grip: '#4a3020', glow: null, arc: 0.9, impactRing: true },
  mithrilMaul:     { type: 'mace', haftLen: 18, headR: 8, color: '#8af', grip: '#445', glow: '#88bbff', arc: 1.0, impactRing: true, particles: 'spark' },
  maulTitans:      { type: 'mace', haftLen: 22, headR: 10, color: '#da4', grip: '#664', glow: '#ffaa00', arc: 1.2, impactRing: true, particles: 'lightning' },
  // Ranged — drawn as crossbow frame
  lightCrossbow:   { type: 'xbow', frameW: 12, frameH: 8, color: '#8a6a4a', string: '#c8a880', bolt: '#654', glow: null },
  crossbow:        { type: 'xbow', frameW: 16, frameH: 10, color: '#7a5a3a', string: '#c8a880', bolt: '#654', glow: null, boltLoaded: true },
  heavyCrossbow:   { type: 'xbow', frameW: 18, frameH: 12, color: '#667', string: '#aaa', bolt: '#888', glow: null, boltLoaded: true, reinforced: true },
  crossbowSpeed:   { type: 'xbow', frameW: 16, frameH: 10, color: '#557', string: '#88f', bolt: '#55a', glow: '#4466ff' },
  arcaneRepeater:  { type: 'xbow', frameW: 18, frameH: 12, color: '#636', string: '#a4f', bolt: '#a4f', glow: '#8844ff', crystal: true },
  // Specials
  deflectionGladius: { bladeLen: 16, bladeW: 2, color: '#ccd', hilite: '#fff', grip: '#556', guard: '#778', glow: '#88aadd', arc: 0.5 },
  twinDaggers:     { type: 'twin', bladeLen: 10, color: '#bbc', grip: '#554', glow: null, arc: 0.5 },
  flailThrashing:  { type: 'flail', haftLen: 12, chainLen: 12, headR: 7, color: '#888', grip: '#5a3a1a', glow: null, arc: 0.9, spiked: true },
  orcSlayer:       { bladeLen: 18, bladeW: 2.5, color: '#c88', hilite: '#faa', grip: '#554', guard: '#888', glow: null, arc: 0.7 },
  siegeHammer:     { type: 'mace', haftLen: 20, headR: 9, headRect: true, color: '#666', grip: '#442', glow: null, arc: 1.0, impactRing: true },
};

// ─── Armor Visual Lookup Table ───
const ARMOR_VISUALS = {
  none:       { main: '#8a7a60', hi: '#a8986a', sh: '#5a4a30', rim: '#9a8a68', style: 'cloth', stitching: false, grid: false, plates: false, shimmer: false },
  leather:    { main: '#7a6040', hi: '#a08060', sh: '#4a3020', rim: '#8a7050', style: 'leather', stitching: true },
  chainMail:  { main: '#7788aa', hi: '#a0b0cc', sh: '#4a5a70', rim: '#8898b8', style: 'chain', grid: true },
  fullPlate:  { main: '#8899bb', hi: '#b0c0dd', sh: '#5a6a88', rim: '#98a8cc', style: 'plate', plates: true, pauldrons: true },
  adamantine: { main: '#4a3860', hi: '#7060a0', sh: '#2a1840', rim: '#6050a0', style: 'adamantine', shimmer: true, plates: true, pauldrons: true },
};

// ─── Shield Visual Lookup Table ───
const SHIELD_VISUALS = {
  wooden: { r: 9, color: '#997744', rim: '#775530', style: 'round', grain: true },
  iron:   { r: 10, color: '#8898a8', rim: '#667788', style: 'round', rivets: true },
  tower:  { r: 12, color: '#b0b8c4', rim: '#8090a0', style: 'rect', emblem: true, gold: true },
  templar:{ r: 14, color: '#c4cce0', rim: '#a8b0c8', style: 'tower', emblem: true, gold: true, glow: true },
};

// ─── Particle color helpers ───
const _particleColors = {
  blue: ['#4488ff', '#66aaff', '#88ccff'],
  orange: ['#ff8800', '#ffaa44', '#ffcc88'],
  green: ['#44ff44', '#66ff88', '#88ffaa'],
  red: ['#ff4400', '#ff6644', '#ff8866'],
  spark: ['#88bbff', '#aaddff', '#ffffff'],
  lightning: ['#ffaa00', '#ffcc44', '#ffffff'],
};

/** Draw idle sword (no type field or type unset) */
function _drawIdleSword(ctx, vis, isFlash) {
  const bLen = vis.bladeLen;
  const bW = vis.bladeW;
  // Pommel
  ctx.fillStyle = isFlash ? '#fff' : vis.grip;
  ctx.beginPath();
  ctx.arc(-3, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // Handle
  ctx.fillStyle = isFlash ? '#fff' : vis.grip;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cross guard
  ctx.fillStyle = isFlash ? '#fff' : vis.guard;
  ctx.fillRect(3, -3.5, 2.5, 7);
  // Blade body
  if (isFlash) {
    ctx.fillStyle = '#fff';
  } else {
    const g = ctx.createLinearGradient(5, 0, 5 + bLen, 0);
    g.addColorStop(0, vis.color);
    g.addColorStop(0.6, vis.hilite);
    g.addColorStop(1, '#fff');
    ctx.fillStyle = g;
  }
  const halfW = bW;
  ctx.beginPath();
  if (vis.doubleEdge) {
    // Wider blade with two edge lines
    ctx.moveTo(5, -halfW - 0.5);
    ctx.lineTo(5 + bLen - 4, -halfW + 0.5);
    ctx.lineTo(5 + bLen, 0);
    ctx.lineTo(5 + bLen - 4, halfW - 0.5);
    ctx.lineTo(5, halfW + 0.5);
  } else {
    ctx.moveTo(5, -halfW);
    ctx.lineTo(5 + bLen - 4, -halfW * 0.6);
    ctx.lineTo(5 + bLen, 0);
    ctx.lineTo(5 + bLen - 4, halfW * 0.6);
    ctx.lineTo(5, halfW);
  }
  ctx.closePath();
  ctx.fill();
  // Edge highlight
  if (!isFlash) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(6, -halfW * 0.7);
    ctx.lineTo(5 + bLen - 2, 0);
    ctx.stroke();
    if (vis.doubleEdge) {
      ctx.beginPath();
      ctx.moveTo(6, halfW * 0.7);
      ctx.lineTo(5 + bLen - 2, 0);
      ctx.stroke();
    }
  }
  // Fuller line
  if (vis.fullerLine && !isFlash) {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(5 + bLen - 6, 0);
    ctx.stroke();
  }
  // Glow
  if (vis.glow && !isFlash) {
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = vis.glow;
    ctx.beginPath();
    ctx.ellipse(5 + bLen * 0.5, 0, bLen * 0.5 + 2, halfW + 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** Draw idle axe */
function _drawIdleAxe(ctx, vis, isFlash) {
  const hL = vis.haftLen;
  // Grip dot
  ctx.fillStyle = isFlash ? '#fff' : vis.grip;
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Haft
  ctx.strokeStyle = isFlash ? '#fff' : vis.grip;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(hL, 0);
  ctx.stroke();
  // Axe head
  const hx = hL;
  const hW = vis.headW * 0.5;
  const hH = vis.headH * 0.5;
  ctx.fillStyle = isFlash ? '#fff' : vis.color;
  ctx.beginPath();
  if (vis.curved) {
    ctx.moveTo(hx - 2, -hH);
    ctx.bezierCurveTo(hx + hW, -hH * 0.8, hx + hW + 2, 0, hx + hW, hH * 0.8);
    ctx.lineTo(hx - 2, hH);
  } else {
    ctx.moveTo(hx - 2, -hH);
    ctx.lineTo(hx + hW, -hH * 0.6);
    ctx.lineTo(hx + hW, hH * 0.6);
    ctx.lineTo(hx - 2, hH);
  }
  ctx.closePath();
  ctx.fill();
  if (!isFlash) {
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  // Double blade
  if (vis.doubleBlade) {
    ctx.fillStyle = isFlash ? '#fff' : vis.color;
    ctx.beginPath();
    ctx.moveTo(hx + 2, -hH);
    ctx.lineTo(hx - hW, -hH * 0.6);
    ctx.lineTo(hx - hW, hH * 0.6);
    ctx.lineTo(hx + 2, hH);
    ctx.closePath();
    ctx.fill();
  }
  // Glow
  if (vis.glow && !isFlash) {
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = vis.glow;
    ctx.beginPath();
    ctx.arc(hx, 0, hH + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** Draw idle mace */
function _drawIdleMace(ctx, vis, isFlash) {
  const hL = vis.haftLen;
  // Grip
  ctx.fillStyle = isFlash ? '#fff' : vis.grip;
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Haft
  ctx.strokeStyle = isFlash ? '#fff' : vis.grip;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(hL, 0);
  ctx.stroke();
  // Head
  const hr = vis.headR;
  if (vis.headRect) {
    ctx.fillStyle = isFlash ? '#fff' : vis.color;
    ctx.fillRect(hL - hr * 0.8, -hr, hr * 1.6, hr * 2);
    if (!isFlash) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(hL - hr * 0.8, -hr, hr * 1.6, hr * 2);
    }
  } else {
    ctx.fillStyle = isFlash ? '#fff' : vis.color;
    ctx.beginPath();
    ctx.arc(hL, 0, hr, 0, Math.PI * 2);
    ctx.fill();
    if (!isFlash) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(hL, 0, hr, -0.8, 0.8);
      ctx.stroke();
    }
  }
  // Glow
  if (vis.glow && !isFlash) {
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = vis.glow;
    ctx.beginPath();
    ctx.arc(hL, 0, hr + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** Draw idle flail */
function _drawIdleFlail(ctx, vis, isFlash, t) {
  const hL = vis.haftLen;
  const cL = vis.chainLen;
  // Grip
  ctx.fillStyle = isFlash ? '#fff' : vis.grip;
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Haft
  ctx.strokeStyle = isFlash ? '#fff' : vis.grip;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(hL, 0);
  ctx.stroke();
  // Chain links (3 small circles)
  const sway = Math.sin(t * 4) * 1.5;
  ctx.fillStyle = isFlash ? '#fff' : '#888';
  for (let i = 1; i <= 3; i++) {
    const frac = i / 4;
    const lx = hL + cL * frac;
    const ly = sway * frac * frac;
    ctx.beginPath();
    ctx.arc(lx, ly, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Ball
  const ballX = hL + cL;
  const ballY = sway;
  const hr = vis.headR;
  ctx.fillStyle = isFlash ? '#fff' : vis.color;
  ctx.beginPath();
  ctx.arc(ballX, ballY, hr, 0, Math.PI * 2);
  ctx.fill();
  // Spikes
  if (vis.spiked && !isFlash) {
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(ballX + Math.cos(a) * hr, ballY + Math.sin(a) * hr);
      ctx.lineTo(ballX + Math.cos(a) * (hr + 3), ballY + Math.sin(a) * (hr + 3));
      ctx.stroke();
    }
  }
}

/** Draw idle crossbow */
function _drawIdleCrossbow(ctx, vis, isFlash) {
  const fw = vis.frameW;
  const fh = vis.frameH;
  // Frame: channel (horizontal bar)
  ctx.strokeStyle = isFlash ? '#fff' : vis.color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(fw, 0);
  ctx.stroke();
  // Bow arms: V shape
  const armColor = vis.reinforced ? '#889' : vis.color;
  ctx.strokeStyle = isFlash ? '#fff' : armColor;
  ctx.lineWidth = vis.reinforced ? 2.5 : 2;
  ctx.beginPath();
  ctx.moveTo(fw * 0.6, -fh * 0.5);
  ctx.quadraticCurveTo(fw * 0.3, -fh * 0.2, fw * 0.2, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(fw * 0.6, fh * 0.5);
  ctx.quadraticCurveTo(fw * 0.3, fh * 0.2, fw * 0.2, 0);
  ctx.stroke();
  // String
  ctx.strokeStyle = isFlash ? '#ddd' : vis.string;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(fw * 0.6, -fh * 0.5);
  ctx.lineTo(fw * 0.2, 0);
  ctx.lineTo(fw * 0.6, fh * 0.5);
  ctx.stroke();
  // Bolt
  if (vis.boltLoaded || vis.bolt) {
    ctx.strokeStyle = isFlash ? '#fff' : vis.bolt;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(fw * 0.2, 0);
    ctx.lineTo(fw + 4, 0);
    ctx.stroke();
    // Bolt tip
    ctx.fillStyle = isFlash ? '#fff' : '#aaa';
    ctx.beginPath();
    ctx.moveTo(fw + 4, 0);
    ctx.lineTo(fw + 7, 0);
    ctx.stroke();
  }
  // Crystal orb
  if (vis.crystal && !isFlash) {
    ctx.fillStyle = vis.glow || '#8844ff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(fw * 0.4, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Glow behind string
  if (vis.glow && !isFlash) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = vis.glow;
    ctx.beginPath();
    ctx.ellipse(fw * 0.4, 0, fw * 0.4, fh * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** Draw idle twin daggers */
function _drawIdleTwin(ctx, vis, isFlash) {
  const bLen = vis.bladeLen;
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.translate(0, side * 3);
    // Grip
    ctx.fillStyle = isFlash ? '#fff' : vis.grip;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Blade
    ctx.fillStyle = isFlash ? '#fff' : vis.color;
    ctx.beginPath();
    ctx.moveTo(3, -1.2);
    ctx.lineTo(3 + bLen - 2, -0.5);
    ctx.lineTo(3 + bLen, 0);
    ctx.lineTo(3 + bLen - 2, 0.5);
    ctx.lineTo(3, 1.2);
    ctx.closePath();
    ctx.fill();
    if (!isFlash) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(3 + bLen - 1, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Draw trailing particles for glowing weapons */
function _drawWeaponParticles(ctx, vis, t, tipX, tipY) {
  if (!vis.particles) return;
  const colors = _particleColors[vis.particles] || _particleColors.blue;
  for (let i = 0; i < 3; i++) {
    const phase = t * 3 + i * 2.1;
    const px = tipX + Math.sin(phase) * 3;
    const py = tipY + Math.cos(phase * 1.3) * 3;
    const alpha = 0.3 + Math.sin(phase) * 0.2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(px, py, 1 + Math.sin(phase) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawPlayer(p) {
  _drawPlayerNew(p);
}

function _drawPlayerLegacy(p) {
  const ctx = getCtx();
  ctx.save();

  const isFlash = p.flashTimer > 0 && Math.floor(p.flashTimer * 20) % 2;
  const cx = (p.x + p.width / 2) | 0;
  const cy = (p.y + p.height / 2) | 0;
  const r = PLAYER.radius;
  const facing = p.facing;
  const weapon = getEquippedWeapon(p);
  const weaponKey = p.weaponSpecial || weapon.key;
  const vis = WEAPON_VISUALS[weaponKey] || WEAPON_VISUALS.shortsword;
  const t = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;

  // Armor visuals
  const pal = ARMOR_VISUALS[p.armor] || ARMOR_VISUALS.none;

  // --- Equip Flash Effect ---
  if (p.equipFlashTimer > 0) {
    p.equipFlashTimer -= 0.016; // ~1 frame
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, p.equipFlashTimer * 3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // --- Shadow: dark radial gradient ellipse ---
  ctx.save();
  ctx.translate(cx, cy + r + 3);
  ctx.scale(1.4, 0.35);
  const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- Body drawn rotated to face p.facing ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(facing);

  // Legs: two short tapered shapes
  const legSway = Math.sin(t * 8) * 0.12;
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.translate(0, side * 5);
    ctx.rotate(side * legSway);
    ctx.fillStyle = isFlash ? '#fff' : '#3a2815';
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(2, 0);
    ctx.lineTo(1.5, 7);
    ctx.lineTo(-1.5, 7);
    ctx.closePath();
    ctx.fill();
    // Boot highlight
    if (!isFlash) {
      ctx.fillStyle = '#5a4830';
      ctx.beginPath();
      ctx.arc(0, 7, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Torso: rounded rectangle with armor gradient
  const tw = 9, th = 10, tr = 4;
  ctx.beginPath();
  ctx.moveTo(-tw + tr, -th);
  ctx.arcTo(tw, -th, tw, th, tr);
  ctx.arcTo(tw, th, -tw, th, tr);
  ctx.arcTo(-tw, th, -tw, -th, tr);
  ctx.arcTo(-tw, -th, tw, -th, tr);
  ctx.closePath();
  if (isFlash) {
    ctx.fillStyle = '#fff';
  } else {
    const bodyGrad = ctx.createLinearGradient(0, -th, 0, th);
    bodyGrad.addColorStop(0, pal.hi);
    bodyGrad.addColorStop(0.4, pal.main);
    bodyGrad.addColorStop(1, pal.sh);
    ctx.fillStyle = bodyGrad;
  }
  ctx.fill();
  // Armor rim
  if (!isFlash) {
    ctx.strokeStyle = pal.rim;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Chest plate accent
    ctx.fillStyle = pal.hi;
    ctx.beginPath();
    ctx.ellipse(0, -2, 4, 3, 0, 0, Math.PI * 2);
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;

    // --- Armor style overlays ---
    if (pal.stitching) {
      // Leather stitching: small stitch marks
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 4; i++) {
        const sy = -th + 4 + i * 5;
        ctx.beginPath();
        ctx.moveTo(-3, sy);
        ctx.lineTo(-1, sy + 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(1, sy);
        ctx.lineTo(3, sy + 2);
        ctx.stroke();
      }
    }
    if (pal.grid) {
      // Chain mail crosshatch grid
      ctx.strokeStyle = 'rgba(200,210,230,0.15)';
      ctx.lineWidth = 0.4;
      for (let gx = -tw + 2; gx < tw; gx += 3) {
        ctx.beginPath();
        ctx.moveTo(gx, -th + 2);
        ctx.lineTo(gx, th - 2);
        ctx.stroke();
      }
      for (let gy = -th + 2; gy < th; gy += 3) {
        ctx.beginPath();
        ctx.moveTo(-tw + 2, gy);
        ctx.lineTo(tw - 2, gy);
        ctx.stroke();
      }
    }
    if (pal.plates) {
      // Plate segment lines
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 3; i++) {
        const py = -th + 4 + i * 6;
        ctx.beginPath();
        ctx.moveTo(-tw + 3, py);
        ctx.lineTo(tw - 3, py);
        ctx.stroke();
      }
    }
    if (pal.shimmer) {
      // Moving highlight sweep
      const shimX = Math.sin(t * 2) * (tw - 2);
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(shimX, 0, 2, th - 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Arms: two small arcs extending from torso sides
  for (let side = -1; side <= 1; side += 2) {
    ctx.fillStyle = isFlash ? '#fff' : pal.main;
    ctx.beginPath();
    ctx.ellipse(tw + 2, side * 4, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!isFlash) {
      ctx.strokeStyle = pal.sh;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      // Pauldrons (shoulder guards)
      if (pal.pauldrons) {
        ctx.strokeStyle = pal.rim;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tw + 2, side * 4, 4.5, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.stroke();
      }
    }
  }

  // --- Helmet ---
  // Base: metallic grey gradient dome
  ctx.beginPath();
  ctx.arc(0, -13, 7, Math.PI, 0);
  ctx.lineTo(7, -9);
  ctx.lineTo(-7, -9);
  ctx.closePath();
  if (isFlash) {
    ctx.fillStyle = '#fff';
  } else {
    const helmGrad = ctx.createLinearGradient(-7, -20, 7, -9);
    helmGrad.addColorStop(0, '#bbb');
    helmGrad.addColorStop(0.3, '#999');
    helmGrad.addColorStop(1, '#666');
    ctx.fillStyle = helmGrad;
  }
  ctx.fill();
  // Lower helmet face guard
  ctx.fillStyle = isFlash ? '#fff' : '#777';
  ctx.fillRect(-6, -9, 12, 5);

  if (!isFlash) {
    // Helmet highlight arc
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -13, 6, Math.PI + 0.3, -0.3);
    ctx.stroke();
    // Nose guard: thin dark vertical line from center
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, -5);
    ctx.stroke();
    // Visor slit: thin dark horizontal arc
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -9, 5, -0.4, 0.4);
    ctx.stroke();
  }

  // Red plume: bezier curve feather shape trailing backward
  if (!isFlash) {
    ctx.fillStyle = '#cc2244';
    ctx.beginPath();
    ctx.moveTo(-3, -17);
    ctx.bezierCurveTo(-10, -22, -18, -20, -22, -16);
    ctx.bezierCurveTo(-18, -15, -12, -14, -3, -14);
    ctx.closePath();
    ctx.fill();
    // Plume highlight
    ctx.fillStyle = '#dd3355';
    ctx.beginPath();
    ctx.moveTo(-3, -17);
    ctx.bezierCurveTo(-9, -21, -15, -19, -18, -17);
    ctx.bezierCurveTo(-14, -16, -8, -15, -3, -15);
    ctx.closePath();
    ctx.fill();
    // Plume shadow
    ctx.fillStyle = '#991133';
    ctx.beginPath();
    ctx.moveTo(-8, -15);
    ctx.bezierCurveTo(-14, -14, -20, -15, -22, -16);
    ctx.bezierCurveTo(-18, -14, -12, -13, -6, -14);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-3, -17);
    ctx.bezierCurveTo(-10, -22, -18, -20, -22, -16);
    ctx.bezierCurveTo(-18, -15, -12, -14, -3, -14);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore(); // end rotation

  // --- Shield ---
  if (weapon.type !== '2h' && weapon.type !== 'ranged') {
    const shieldAngle = facing + Math.PI * 0.6;
    const shieldDist = r + 4;
    const sx = cx + Math.cos(shieldAngle) * shieldDist;
    const sy = cy + Math.sin(shieldAngle) * shieldDist;
    const sv = SHIELD_VISUALS[p.shield] || SHIELD_VISUALS.wooden;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(facing);

    const shieldBright = p.blocking ? 0.25 : 0;

    if (sv.style === 'round') {
      // Round shield
      ctx.beginPath();
      ctx.arc(0, 0, sv.r, 0, Math.PI * 2);
      if (isFlash) {
        ctx.fillStyle = '#fff';
      } else {
        const cR = parseInt(sv.color.slice(1, 3), 16);
        const cG = parseInt(sv.color.slice(3, 5), 16);
        const cB = parseInt(sv.color.slice(5, 7), 16);
        ctx.fillStyle = `rgb(${Math.min(255, cR + shieldBright * 60)|0},${Math.min(255, cG + shieldBright * 40)|0},${Math.min(255, cB + shieldBright * 30)|0})`;
      }
      ctx.fill();
      // Rim
      ctx.strokeStyle = isFlash ? '#ddd' : sv.rim;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Wood grain
      if (sv.grain && !isFlash) {
        ctx.strokeStyle = 'rgba(80,50,20,0.25)';
        ctx.lineWidth = 0.6;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.arc(i * 3, 0, sv.r * 0.6 + i * 1.5, -0.6, 0.6);
          ctx.stroke();
        }
      }
      // Rivets
      if (sv.rivets && !isFlash) {
        ctx.fillStyle = '#bbc';
        const rr = sv.r - 1.5;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 2.5) {
          ctx.beginPath();
          ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Boss
      if (!isFlash) {
        ctx.fillStyle = 'rgba(200,210,230,0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Rect or tower shield
      const sW = sv.style === 'tower' ? sv.r * 1.2 : sv.r;
      const sH = sv.style === 'tower' ? sv.r * 2.0 : sv.r * 1.6;
      const sRad = 3;
      ctx.beginPath();
      ctx.moveTo(-sW + sRad, -sH);
      ctx.arcTo(sW, -sH, sW, sH, sRad);
      ctx.arcTo(sW, sH, -sW, sH, sRad);
      ctx.arcTo(-sW, sH, -sW, -sH, sRad);
      ctx.arcTo(-sW, -sH, sW, -sH, sRad);
      ctx.closePath();
      if (isFlash) {
        ctx.fillStyle = '#fff';
      } else {
        const cR = parseInt(sv.color.slice(1, 3), 16);
        const cG = parseInt(sv.color.slice(3, 5), 16);
        const cB = parseInt(sv.color.slice(5, 7), 16);
        ctx.fillStyle = `rgb(${Math.min(255, cR + shieldBright * 60)|0},${Math.min(255, cG + shieldBright * 40)|0},${Math.min(255, cB + shieldBright * 30)|0})`;
      }
      ctx.fill();
      // Rim
      ctx.strokeStyle = isFlash ? '#ddd' : sv.rim;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      // Gold trim
      if (sv.gold && !isFlash) {
        ctx.strokeStyle = 'rgba(204,170,68,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-sW + sRad + 2, -sH + 2);
        ctx.arcTo(sW - 2, -sH + 2, sW - 2, sH - 2, sRad);
        ctx.arcTo(sW - 2, sH - 2, -sW + 2, sH - 2, sRad);
        ctx.arcTo(-sW + 2, sH - 2, -sW + 2, -sH + 2, sRad);
        ctx.arcTo(-sW + 2, -sH + 2, sW - 2, -sH + 2, sRad);
        ctx.closePath();
        ctx.stroke();
      }
      // Emblem: cross
      if (sv.emblem && !isFlash) {
        ctx.strokeStyle = sv.gold ? '#ccaa44' : '#a0b0c8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(0, 4);
        ctx.moveTo(-3, 0);
        ctx.lineTo(3, 0);
        ctx.stroke();
      }
    }

    // Blocking glow (all shields)
    if (p.blocking && !isFlash) {
      ctx.globalAlpha = 0.2 + Math.sin(t * 8) * 0.1;
      ctx.fillStyle = sv.glow ? '#ddeeff' : '#aaccff';
      ctx.beginPath();
      ctx.arc(0, 1, sv.r + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Templar shield special glow
      if (sv.glow) {
        ctx.globalAlpha = 0.1 + Math.sin(t * 6) * 0.05;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, sv.r + 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  // --- Weapon ---
  const weaponAngle = facing - Math.PI * 0.3;
  const weaponDist = r + 2;
  const wx = cx + Math.cos(weaponAngle) * weaponDist;
  const wy = cy + Math.sin(weaponAngle) * weaponDist;
  const visType = vis.type || 'sword';

  if (p.attacking && p.attackPhase === 'active') {
    const swingLen = PLAYER.attackRange;
    const arcW = vis.arc || 0.6;

    // --- Crossbow attack: flash at bolt spawn ---
    if (visType === 'xbow') {
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(facing);
      _drawIdleCrossbow(ctx, vis, isFlash);
      // Muzzle flash
      if (!isFlash) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = vis.glow || '#ffcc44';
        ctx.beginPath();
        ctx.arc(vis.frameW + 6, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(vis.frameW + 6, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    // --- Twin daggers attack: rapid alternating stabs ---
    else if (visType === 'twin') {
      const stabPhase = Math.sin(t * 30);
      for (let side = -1; side <= 1; side += 2) {
        const offset = side * stabPhase * 0.3;
        const trailAngle = facing + offset;
        const reach = r + swingLen * (0.6 + (side === (stabPhase > 0 ? 1 : -1) ? 0.4 : 0));

        // Small arc
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#c0d4ff';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, reach, trailAngle - 0.2, trailAngle + 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Blade
        const bx = cx + Math.cos(trailAngle) * r;
        const by = cy + Math.sin(trailAngle) * r;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(trailAngle);
        ctx.fillStyle = isFlash ? '#fff' : vis.color;
        const bl = vis.bladeLen;
        ctx.beginPath();
        ctx.moveTo(0, -1.2);
        ctx.lineTo(bl - 2, -0.4);
        ctx.lineTo(bl, 0);
        ctx.lineTo(bl - 2, 0.4);
        ctx.lineTo(0, 1.2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    // --- Melee swing (swords, axes, maces, flails) ---
    else {
      // Determine arc tint color
      const arcColor = vis.glow || 'rgba(180,210,255,1)';
      const isHeavy = visType === 'axe' || visType === 'mace' || visType === 'flail';
      const trailW = isHeavy ? 4 : 3;

      // Motion blur trailing copies
      for (let i = 3; i >= 1; i--) {
        const trailAngle = facing - arcW + (arcW * 2 * (1 - i * 0.25));
        ctx.globalAlpha = 0.08 * i;
        ctx.strokeStyle = vis.glow || '#c0d4ff';
        ctx.lineWidth = trailW;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(trailAngle) * r, cy + Math.sin(trailAngle) * r);
        ctx.lineTo(cx + Math.cos(trailAngle) * (r + swingLen), cy + Math.sin(trailAngle) * (r + swingLen));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Semi-transparent arc sweep
      const sweepGrad = ctx.createRadialGradient(cx, cy, r, cx, cy, r + swingLen);
      if (vis.glow) {
        const gc = vis.glow;
        sweepGrad.addColorStop(0, gc.replace(')', ',0.05)').replace('rgb(', 'rgba(').replace('#', ''));
        sweepGrad.addColorStop(1, gc.replace(')', ',0.18)').replace('rgb(', 'rgba(').replace('#', ''));
        // Fallback to simpler approach
        sweepGrad.addColorStop(0, 'rgba(180,210,255,0.05)');
        sweepGrad.addColorStop(1, 'rgba(180,210,255,0.18)');
      }
      // Reset and use solid approach
      ctx.globalAlpha = isHeavy ? 0.15 : 0.1;
      ctx.fillStyle = vis.glow || '#b4d6ff';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r + swingLen, facing - arcW, facing + arcW);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Weapon head at swing tip
      const bladeBase = r;
      const bx1 = cx + Math.cos(facing) * bladeBase;
      const by1 = cy + Math.sin(facing) * bladeBase;

      ctx.save();
      ctx.translate(bx1, by1);
      ctx.rotate(facing);
      const bladeLen = swingLen;

      if (visType === 'sword' || !vis.type) {
        // Blade body - tapered
        const bW = vis.bladeW || 2;
        ctx.fillStyle = isFlash ? '#fff' : vis.color;
        ctx.beginPath();
        ctx.moveTo(0, -bW - 0.5);
        ctx.lineTo(bladeLen - 4, -bW * 0.5);
        ctx.lineTo(bladeLen, 0);
        ctx.lineTo(bladeLen - 4, bW * 0.5);
        ctx.lineTo(0, bW + 0.5);
        ctx.closePath();
        ctx.fill();
        if (!isFlash) {
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      } else if (visType === 'axe') {
        // Haft extending out
        ctx.strokeStyle = isFlash ? '#fff' : vis.grip;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(bladeLen - 6, 0);
        ctx.stroke();
        // Axe head at tip
        const hw = vis.headW * 0.5;
        const hh = vis.headH * 0.5;
        ctx.fillStyle = isFlash ? '#fff' : vis.color;
        ctx.beginPath();
        ctx.moveTo(bladeLen - 6, -hh);
        ctx.lineTo(bladeLen, -hh * 0.5);
        ctx.lineTo(bladeLen, hh * 0.5);
        ctx.lineTo(bladeLen - 6, hh);
        ctx.closePath();
        ctx.fill();
      } else if (visType === 'mace') {
        // Haft
        ctx.strokeStyle = isFlash ? '#fff' : vis.grip;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(bladeLen - vis.headR, 0);
        ctx.stroke();
        // Head
        ctx.fillStyle = isFlash ? '#fff' : vis.color;
        ctx.beginPath();
        ctx.arc(bladeLen - 2, 0, vis.headR, 0, Math.PI * 2);
        ctx.fill();
      } else if (visType === 'flail') {
        // Haft + chain + ball
        ctx.strokeStyle = isFlash ? '#fff' : vis.grip;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(bladeLen * 0.5, 0);
        ctx.stroke();
        // Chain dots
        ctx.fillStyle = isFlash ? '#fff' : '#888';
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.arc(bladeLen * 0.5 + (bladeLen * 0.4) * (i / 4), 0, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        // Ball
        ctx.fillStyle = isFlash ? '#fff' : vis.color;
        ctx.beginPath();
        ctx.arc(bladeLen - 2, 0, vis.headR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Handle at base
      ctx.fillStyle = isFlash ? '#fff' : (vis.grip || '#7a5530');
      ctx.beginPath();
      ctx.arc(bx1, by1, 3, 0, Math.PI * 2);
      ctx.fill();

      // Impact ring for maces
      if (vis.impactRing && !isFlash) {
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = vis.glow || '#fff';
        ctx.lineWidth = 2;
        const tipX = cx + Math.cos(facing) * (r + swingLen);
        const tipY = cy + Math.sin(facing) * (r + swingLen);
        ctx.beginPath();
        ctx.arc(tipX, tipY, vis.headR + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Arc outline glow
      ctx.strokeStyle = vis.glow ? vis.glow : 'rgba(200,220,255,0.35)';
      ctx.globalAlpha = vis.glow ? 0.4 : 0.35;
      ctx.lineWidth = isHeavy ? 3 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + swingLen, facing - arcW + 0.1, facing + arcW - 0.1);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  } else {
    // --- Resting weapon ---
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(facing);

    if (visType === 'sword' || !vis.type) {
      _drawIdleSword(ctx, vis, isFlash);
    } else if (visType === 'axe') {
      _drawIdleAxe(ctx, vis, isFlash);
    } else if (visType === 'mace') {
      _drawIdleMace(ctx, vis, isFlash);
    } else if (visType === 'flail') {
      _drawIdleFlail(ctx, vis, isFlash, t);
    } else if (visType === 'xbow') {
      _drawIdleCrossbow(ctx, vis, isFlash);
    } else if (visType === 'twin') {
      _drawIdleTwin(ctx, vis, isFlash);
    }

    // Weapon particles (idle)
    if (vis.particles && !isFlash) {
      const tipLen = vis.bladeLen || vis.haftLen || vis.frameW || 12;
      _drawWeaponParticles(ctx, vis, t, tipLen + 3, 0);
    }

    ctx.restore();
  }

  // Combo indicator above head
  if (p.comboCount >= 2) {
    drawText(`x${p.comboCount}`, cx - 10, cy - r - 26, 10, '#ff0');
  }

  // HP bar above head
  drawBar(cx - r - 5, cy - r - 14, r * 2 + 10, 5, p.hp / p.maxHP, '#cc3333', '#441111');

  ctx.restore();
}

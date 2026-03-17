import { PLAYER, ATTACK, WEAPONS, ARMORS, SHIELDS, BARRICADE_X, GAME_WIDTH, GAME_HEIGHT, POTIONS } from '../config.js';
import { clamp } from '../utils/math.js';
import * as Input from '../input.js';
import { drawRect, drawBar, drawText, drawCircle, shake, getCtx } from '../renderer.js';

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

    // Block
    blocking: false,

    // Repair
    repairing: false,

    // Equipment
    weapon: 'shortsword',
    armor: 'none',
    shield: 'wooden',

    // Consumables
    potions: 0,

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

    // Damage flash
    flashTimer: 0,

    // Score
    score: 0,
    kills: 0,
    damageTakenThisWave: 0,
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

  const armor = ARMORS[p.armor];
  p.maxHP = PLAYER.maxHP + p.maxHPBonus;
  if (p.hp > p.maxHP) p.hp = p.maxHP;
}

export function updatePlayer(p, dt, barricade, mouseX, mouseY) {
  const weapon = WEAPONS[p.weapon];
  const armor = ARMORS[p.armor];

  // Flash timer
  if (p.flashTimer > 0) p.flashTimer -= dt;

  // Regen from Axe of Regeneration
  if (weapon.special === 'regen2') {
    p.hp = Math.min(p.maxHP, p.hp + 2 * dt);
  }

  // Update facing toward mouse cursor
  if (mouseX !== undefined && mouseY !== undefined) {
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    p.facing = Math.atan2(mouseY - cy, mouseX - cx);
  }

  // Repairing
  p.repairing = false;
  const pcx = p.x + p.width / 2;
  const pcy = p.y + p.height / 2;
  const bcx = barricade.x + barricade.width / 2;
  const bcy = barricade.y + barricade.height / 2;
  const repairDist = Math.sqrt((pcx - bcx) ** 2 + (pcy - bcy) ** 2);
  if (Input.isRepair() && repairDist < 80 && !p.attacking) {
    p.repairing = true;
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

  // Potion
  if (Input.isPotion() && p.potions > 0 && p.hp < p.maxHP) {
    p.potions--;
    p.hp = Math.min(p.maxHP, p.hp + POTIONS.stoneskin.heal);
  }

  // Movement
  if (!p.repairing && p.attackPhase !== 'windUp') {
    let speed = PLAYER.moveSpeed * (1 - armor.speedPenalty) * p.moveSpeedMult;
    if (p.blocking) speed *= PLAYER.blockSpeedMult;

    let dx = 0, dy = 0;
    if (Input.isMovingLeft())  dx = -1;
    if (Input.isMovingRight()) dx = 1;
    if (Input.isMovingUp())    dy = -1;
    if (Input.isMovingDown())  dy = 1;

    // Normalize diagonal
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }

    p.x += dx * speed * dt;
    p.y += dy * speed * dt;
  }

  // Clamp position (full playfield)
  p.x = clamp(p.x, 10, GAME_WIDTH - p.width - 10);
  p.y = clamp(p.y, PLAYER.verticalMin, PLAYER.verticalMax);
}

export function getAttackBox(p) {
  const weapon = WEAPONS[p.weapon];
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
  const weapon = WEAPONS[p.weapon];
  let dmg = weapon.damage * p.meleeDmgMult;

  if (p.comboCount === 2) dmg *= ATTACK.combo2DmgMult;
  if (p.comboCount >= 3) dmg *= ATTACK.combo3DmgMult * p.comboFinisherMult;

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
    const wep = WEAPONS[p.weapon];
    const extra = wep.special === 'blockBonus20' ? 0.20 : 0;
    dmg *= (1 - Math.min(blockPct + extra, 0.95));
  }

  dmg = Math.max(1, Math.round(dmg));
  p.hp -= dmg;
  p.damageTakenThisWave += dmg;
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

export function drawPlayer(p) {
  const ctx = getCtx();
  const isFlash = p.flashTimer > 0 && Math.floor(p.flashTimer * 20) % 2;
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;
  const r = PLAYER.radius;
  const facing = p.facing;
  const weapon = WEAPONS[p.weapon];

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r + 3, r + 2, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body circle (armor tint)
  const bodyColor = isFlash ? '#fff' : '#4477cc';
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#335599';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Helmet (inner circle)
  ctx.fillStyle = isFlash ? '#fff' : '#888';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Visor line showing facing
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(facing) * r * 0.7, cy + Math.sin(facing) * r * 0.7);
  ctx.stroke();

  // Shield (on the side perpendicular to facing, offset backward)
  if (weapon.type !== '2h' && weapon.type !== 'ranged') {
    const shieldAngle = facing + Math.PI * 0.6;
    const shieldDist = r + 3;
    const sx = cx + Math.cos(shieldAngle) * shieldDist;
    const sy = cy + Math.sin(shieldAngle) * shieldDist;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(facing);
    ctx.fillStyle = p.blocking ? '#dda' : '#aa8';
    ctx.fillRect(-4, -8, 8, 16);
    ctx.strokeStyle = '#776';
    ctx.lineWidth = 1;
    ctx.strokeRect(-4, -8, 8, 16);
    ctx.restore();
  }

  // Weapon
  const weaponAngle = facing - Math.PI * 0.3;
  const weaponDist = r + 2;
  const wx = cx + Math.cos(weaponAngle) * weaponDist;
  const wy = cy + Math.sin(weaponAngle) * weaponDist;

  if (p.attacking && p.attackPhase === 'active') {
    // Swing arc - draw weapon extended in facing direction
    const swingLen = PLAYER.attackRange;
    const tipX = cx + Math.cos(facing) * (r + swingLen);
    const tipY = cy + Math.sin(facing) * (r + swingLen);

    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(facing) * r, cy + Math.sin(facing) * r);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Swing arc visual
    ctx.strokeStyle = 'rgba(200,200,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + swingLen, facing - 0.6, facing + 0.6);
    ctx.stroke();
  } else {
    // Resting weapon
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(facing);
    ctx.fillStyle = '#ccc';
    ctx.fillRect(0, -2, 18, 4);
    ctx.restore();
  }

  // Combo indicator
  if (p.comboCount >= 2) {
    drawText(`x${p.comboCount}`, cx - 10, cy - r - 24, 10, '#ff0');
  }

  // HP bar above head
  drawBar(cx - r - 5, cy - r - 12, r * 2 + 10, 5, p.hp / p.maxHP, '#cc3333', '#441111');
}

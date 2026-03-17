import { ENEMIES, BARRICADE_X, GAME_WIDTH, GAME_HEIGHT, PLAYFIELD_TOP, PLAYFIELD_BOTTOM } from '../config.js';
import { randInt, randRange, clamp, dist } from '../utils/math.js';
import { drawRect, drawBar, drawText, drawCircle, getCtx } from '../renderer.js';
import { getHPScale, getDamageScale } from '../config.js';

let nextId = 0;

export function createEnemy(typeKey, wave, yPos) {
  const def = ENEMIES[typeKey];
  const hpScale = getHPScale(wave);
  const dmgScale = getDamageScale(wave);

  // Spread enemies across the full playfield height
  const spawnY = yPos || randRange(PLAYFIELD_TOP + 20, PLAYFIELD_BOTTOM - 20);

  return {
    id: nextId++,
    typeKey,
    name: def.name,
    x: GAME_WIDTH + randRange(10, 60),
    y: spawnY,
    width: def.width,
    height: def.height,
    hp: Math.round(def.hp * hpScale),
    maxHP: Math.round(def.hp * hpScale),
    damage: Math.round(def.damage * dmgScale),
    speed: def.speed,
    attackRate: def.attackRate,
    attackTimer: def.attackRate,
    goldMin: def.goldMin,
    goldMax: def.goldMax,
    xp: def.xp,
    score: def.score,
    type: def.type,
    color: def.color,
    knockbackResist: def.knockbackResist || 0,
    alive: true,
    deathTimer: 0,
    facing: Math.PI, // facing left by default (toward fort)

    // Shield (for soldiers)
    hasShield: def.hasShield || false,
    shieldBroken: false,

    // Armor hits (for orc knights)
    armorHits: def.armorHits || 0,

    // Ranged
    range: def.range || 0,
    retreatDist: def.retreatDist || 0,
    magic: def.magic || false,

    // Suicide
    fuseTimer: def.type === 'suicide' ? 5.0 : 0,

    // Boss
    chargeTimer: def.type === 'boss' ? 15 : 0,
    roarTimer: def.type === 'boss' ? 30 : 0,
    charging: false,
    chargeSpeed: 200,
    roaring: false,
    roarAura: false,
    roarAuraTimer: 0,
    slamming: false,

    // Flash
    flashTimer: 0,

    // Buffed
    buffed: false,
    buffTimer: 0,
  };
}

export function updateEnemy(e, dt, playerX, playerY, barricadeX, barricadeAlive) {
  if (!e.alive) {
    e.deathTimer -= dt;
    return;
  }

  if (e.flashTimer > 0) e.flashTimer -= dt;
  if (e.buffTimer > 0) { e.buffTimer -= dt; if (e.buffTimer <= 0) e.buffed = false; }

  const targetX = barricadeAlive ? barricadeX : playerX;
  const targetY = barricadeAlive ? (e.y) : playerY; // head toward barricade x but keep y, or head to player

  if (e.type === 'melee' || e.type === 'boss') {
    updateMelee(e, dt, playerX, playerY, targetX);
  } else if (e.type === 'ranged') {
    updateRanged(e, dt, playerX, playerY);
  } else if (e.type === 'suicide') {
    updateSuicide(e, dt, targetX, playerX, playerY);
  }

  // Keep enemies in bounds vertically
  e.y = clamp(e.y, PLAYFIELD_TOP, PLAYFIELD_BOTTOM - e.height);
}

function updateMelee(e, dt, playerX, playerY, targetX) {
  if (e.charging) return; // handled by combat system

  // Move toward target in 2D
  const ecx = e.x + e.width / 2;
  const ecy = e.y + e.height / 2;

  // Primary movement: advance leftward toward target x
  const dx = targetX - ecx;
  const dy = playerY - ecy; // drift toward player's y

  if (Math.abs(dx) > 32) {
    e.x += Math.sign(dx) * e.speed * dt;
  }

  // Gentle y-drift toward player
  if (Math.abs(dy) > 20) {
    e.y += Math.sign(dy) * e.speed * 0.3 * dt;
  }

  // Update facing
  e.facing = Math.atan2(dy, dx);

  e.attackTimer -= dt;
}

function updateRanged(e, dt, playerX, playerY) {
  const ecx = e.x + e.width / 2;
  const ecy = e.y + e.height / 2;
  const d = dist(ecx, ecy, playerX, playerY);

  if (d > e.range) {
    // Move toward player
    const angle = Math.atan2(playerY - ecy, playerX - ecx);
    e.x += Math.cos(angle) * e.speed * dt;
    e.y += Math.sin(angle) * e.speed * dt;
    e.facing = angle;
  } else if (d < 80) {
    // Retreat away from player
    const angle = Math.atan2(ecy - playerY, ecx - playerX);
    e.x += Math.cos(angle) * e.speed * 0.5 * dt;
    e.y += Math.sin(angle) * e.speed * 0.5 * dt;
    e.facing = Math.atan2(playerY - ecy, playerX - ecx);
  } else {
    e.facing = Math.atan2(playerY - ecy, playerX - ecx);
  }

  e.x = clamp(e.x, 0, GAME_WIDTH - e.width);
  e.attackTimer -= dt;
}

function updateSuicide(e, dt, targetX, playerX, playerY) {
  e.fuseTimer -= dt;

  // Rush toward the nearest target (player or barricade x)
  const ecx = e.x + e.width / 2;
  const ecy = e.y + e.height / 2;
  const dToPlayer = dist(ecx, ecy, playerX, playerY);

  // Head toward player if close, otherwise toward barricade
  let tx, ty;
  if (dToPlayer < 200) {
    tx = playerX; ty = playerY;
  } else {
    tx = targetX; ty = ecy; // head left
  }

  const angle = Math.atan2(ty - ecy, tx - ecx);
  e.x += Math.cos(angle) * e.speed * dt;
  e.y += Math.sin(angle) * e.speed * dt;
  e.facing = angle;
}

export function damageEnemy(e, dmg) {
  // Shield absorbs first hit
  if (e.hasShield && !e.shieldBroken) {
    e.shieldBroken = true;
    e.flashTimer = 0.1;
    return 0;
  }

  // Armor reduction for orc knights
  if (e.armorHits > 0) {
    dmg = Math.round(dmg * 0.5);
    e.armorHits--;
  }

  e.hp -= dmg;
  e.flashTimer = 0.1;
  if (e.hp <= 0) {
    e.hp = 0;
    e.alive = false;
    e.deathTimer = 0.3;
  }
  return dmg;
}

export function knockbackEnemy(e, amount) {
  const resist = e.knockbackResist || 0;
  // Knock back away from player (in the direction they were facing from, i.e. rightward)
  const kbAngle = e.facing + Math.PI; // opposite of their facing
  const kb = amount * (1 - resist);
  e.x += Math.cos(kbAngle) * kb;
  e.y += Math.sin(kbAngle) * kb;
  e.x = clamp(e.x, 0, GAME_WIDTH + 50);
  e.y = clamp(e.y, PLAYFIELD_TOP, PLAYFIELD_BOTTOM);
}

export function drawEnemy(e) {
  const ctx = getCtx();
  const isFlash = e.flashTimer > 0 && Math.floor(e.flashTimer * 20) % 2;

  const cx = e.x + e.width / 2;
  const cy = e.y + e.height / 2;
  const r = Math.max(e.width, e.height) / 2;

  if (!e.alive) {
    // Death fade
    if (e.deathTimer > 0) {
      const alpha = e.deathTimer / 0.3;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(cx, cy, r * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return;
  }

  const color = isFlash ? '#fff' : (e.buffed ? '#f88' : e.color);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r + 2, r, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body circle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Eyes (two yellow dots offset in facing direction)
  const eyeOffset = r * 0.35;
  const eyeSpread = 0.4;
  const leftEyeAngle = e.facing - eyeSpread;
  const rightEyeAngle = e.facing + eyeSpread;
  ctx.fillStyle = '#ff0';
  ctx.beginPath();
  ctx.arc(cx + Math.cos(leftEyeAngle) * eyeOffset, cy + Math.sin(leftEyeAngle) * eyeOffset, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + Math.cos(rightEyeAngle) * eyeOffset, cy + Math.sin(rightEyeAngle) * eyeOffset, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Directional indicator (nose/facing line)
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(e.facing) * r * 0.6, cy + Math.sin(e.facing) * r * 0.6);
  ctx.lineTo(cx + Math.cos(e.facing) * (r + 3), cy + Math.sin(e.facing) * (r + 3));
  ctx.stroke();

  // Shield for soldiers
  if (e.hasShield && !e.shieldBroken) {
    const sx = cx + Math.cos(e.facing) * (r + 2);
    const sy = cy + Math.sin(e.facing) * (r + 2);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(e.facing);
    ctx.fillStyle = '#886';
    ctx.fillRect(-3, -8, 6, 16);
    ctx.restore();
  }

  // Boss indicators - crown
  if (e.type === 'boss') {
    ctx.fillStyle = '#a33';
    const crownY = cy - r - 8;
    ctx.fillRect(cx - 12, crownY, 24, 6);
    ctx.fillRect(cx - 8, crownY - 6, 4, 8);
    ctx.fillRect(cx + 4, crownY - 6, 4, 8);
    ctx.fillRect(cx - 2, crownY - 4, 4, 6);

    // Boss aura ring
    ctx.strokeStyle = 'rgba(170, 50, 50, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Bomber fuse indicator
  if (e.type === 'suicide') {
    const pulseRate = e.fuseTimer < 2 ? 10 : 4;
    if (Math.floor(e.fuseTimer * pulseRate) % 2) {
      drawCircle(cx, cy - r - 4, 4, '#f00');
    }
    // Bomb backpack
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(cx - Math.cos(e.facing) * r * 0.4, cy - Math.sin(e.facing) * r * 0.4, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ranged enemy weapon indicator
  if (e.type === 'ranged') {
    const bowX = cx + Math.cos(e.facing + 0.5) * (r + 2);
    const bowY = cy + Math.sin(e.facing + 0.5) * (r + 2);
    ctx.strokeStyle = e.magic ? '#a4f' : '#8B4513';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bowX, bowY, 6, e.facing - 0.8, e.facing + 0.8);
    ctx.stroke();
  }

  // HP bar
  if (e.hp < e.maxHP) {
    drawBar(cx - r, cy - r - 8, r * 2, 4, e.hp / e.maxHP, '#cc3333', '#441111');
  }
}

import { ENEMIES, WORLD_W, WORLD_H, FORT, GATES } from '../config.js';
import { randInt, randRange, clamp, dist } from '../utils/math.js';
import { drawRect, drawBar, drawText, drawCircle, getCtx } from '../renderer.js';
import { getHPScale, getDamageScale } from '../config.js';
import { getWallSegments } from '../entities/barricade.js';
import { getBlockingRects, resolveAxis } from '../utils/wallCollision.js';

let nextId = 0;

export function createEnemy(typeKey, wave, spawnX, spawnY, targetGate, eliteMode = false) {
  const def = ENEMIES[typeKey];
  const hpScale = getHPScale(wave) * (eliteMode ? 2.0 : 1.0);
  const dmgScale = getDamageScale(wave) * (eliteMode ? 1.5 : 1.0);
  const speedMult = eliteMode ? 1.15 : 1.0;

  return {
    id: nextId++,
    typeKey,
    name: def.name,
    x: spawnX !== undefined ? spawnX : WORLD_W + randRange(10, 60),
    y: spawnY !== undefined ? spawnY : randRange(300, 900),
    width: def.width,
    height: def.height,
    hp: Math.round(def.hp * hpScale),
    maxHP: Math.round(def.hp * hpScale),
    damage: Math.round(def.damage * dmgScale),
    speed: def.speed * speedMult,
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

    // Gate targeting
    targetGate: targetGate || 'east',
    insideFort: false,

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
    chargeWindupTimer: 0,
    chargeExecute: false,
    chargeSpeed: 200,
    roarTimer: def.type === 'boss' ? 30 : 0,
    charging: false,
    roaring: false,
    roarAura: false,
    roarAuraTimer: 0,
    slamming: false,

    // Knockback cooldown
    knockbackCooldown: 0,

    // Knockback afterimage trail
    knockbackTrail: 0,

    // Stun (freezes movement + attack)
    stunTimer: 0,

    // Flash
    flashTimer: 0,

    // Buffed
    buffed: false,
    buffTimer: 0,

    // Animation
    walkPhase: Math.random() * Math.PI * 2,
    attackAnim: 0, // 0 = idle, >0 = lunging forward
  };
}

/** Get the center target position for a gate. */
function getGateTarget(gateName) {
  const gate = GATES[gateName];
  if (!gate) return { x: WORLD_W / 2, y: WORLD_H / 2 };
  return {
    x: gate.x + gate.w / 2,
    y: gate.y + gate.h / 2,
  };
}

/** Check if enemy is near any wall segment on their target gate side. */
function getNearestWallSegmentDist(e, walls) {
  const wall = walls[e.targetGate];
  if (!wall || wall.destroyed) return Infinity;

  const segments = getWallSegments(wall);
  const ecx = e.x + e.width / 2;
  const ecy = e.y + e.height / 2;
  let minDist = Infinity;

  for (const seg of segments) {
    // Nearest point on segment rect to enemy center
    const nearX = clamp(ecx, seg.x, seg.x + seg.w);
    const nearY = clamp(ecy, seg.y, seg.y + seg.h);
    const d = dist(ecx, ecy, nearX, nearY);
    if (d < minDist) minDist = d;
  }

  return minDist;
}

export function updateEnemy(e, dt, playerX, playerY, walls) {
  if (!e.alive) {
    e.deathTimer -= dt;
    return;
  }

  if (e.knockbackCooldown > 0) e.knockbackCooldown -= dt;
  if (e.flashTimer > 0) e.flashTimer -= dt;
  if (e.knockbackTrail > 0) e.knockbackTrail -= dt * 10;
  if (e.buffTimer > 0) { e.buffTimer -= dt; if (e.buffTimer <= 0) e.buffed = false; }
  e.walkPhase += dt * 8;
  if (e.attackAnim > 0) e.attackAnim -= dt * 4; // slower decay for more visible lunge

  // Stun: skip all movement while stunned
  if (e.stunTimer > 0) { e.stunTimer -= dt; return; }

  // Moat slow
  const effectiveDt = e._moatSlowed ? dt * 0.7 : dt;

  // Save position before movement
  const prevX = e.x;
  const prevY = e.y;

  if (e.type === 'melee' || e.type === 'boss') {
    updateMelee(e, effectiveDt, playerX, playerY, walls);
  } else if (e.type === 'ranged') {
    updateRanged(e, effectiveDt, playerX, playerY, walls);
  } else if (e.type === 'suicide') {
    updateSuicide(e, effectiveDt, playerX, playerY, walls);
  }

  // Wall collision: enemies blocked by all walls.
  // Can only pass through their assigned gate gap when that side's barricade is destroyed.
  if (!e.insideFort && walls) {
    const rects = getBlockingRects(walls, 'enemy', e.targetGate);
    // Separate-axis resolution: resolve X then Y for wall sliding
    const movedX = e.x - prevX;
    const movedY = e.y - prevY;
    e.x = prevX;
    e.y = prevY;
    e.x += movedX;
    e.x = clamp(e.x, 0, WORLD_W - e.width);
    resolveAxis(e, rects, 'x');
    e.y += movedY;
    e.y = clamp(e.y, 0, WORLD_H - e.height);
    resolveAxis(e, rects, 'y');
  } else {
    e.y = clamp(e.y, 0, WORLD_H - e.height);
    e.x = clamp(e.x, 0, WORLD_W - e.width);
  }
}

function updateMelee(e, dt, playerX, playerY, walls) {
  if (e.charging) return;

  const ecx = e.x + e.width / 2;
  const ecy = e.y + e.height / 2;
  const dToPlayer = dist(ecx, ecy, playerX, playerY);

  // Always decrement attack timer
  e.attackTimer -= dt;

  // Player aggro: if player is nearby (within 120px), chase and attack them
  if (dToPlayer < 120) {
    const angle = Math.atan2(playerY - ecy, playerX - ecx);
    e.facing = angle;
    if (dToPlayer > 35) {
      e.x += Math.cos(angle) * e.speed * dt;
      e.y += Math.sin(angle) * e.speed * dt;
    }
    return;
  }

  if (!e.insideFort) {
    const wall = walls[e.targetGate];
    const wallAlive = wall && !wall.destroyed;

    if (wallAlive) {
      // Check distance to nearest wall segment
      const wallDist = getNearestWallSegmentDist(e, walls);

      if (wallDist < 40) {
        // STOPPED AT WALL — face the wall, wait for combat.js to fire damage
        const gateTarget = getGateTarget(e.targetGate);
        e.facing = Math.atan2(gateTarget.y - ecy, gateTarget.x - ecx);
        // Don't move — wall collision will prevent it anyway
      } else {
        // APPROACHING: Move toward the gate/wall area
        // Offset target slightly from gate center toward the wall segment
        const gateTarget = getGateTarget(e.targetGate);
        // Add a small random offset so enemies spread along the wall, not all at gate center
        const spreadX = ((e.id * 37) % 60) - 30;
        const spreadY = ((e.id * 53) % 60) - 30;
        const tx = gateTarget.x + spreadX;
        const ty = gateTarget.y + spreadY;
        const angle = Math.atan2(ty - ecy, tx - ecx);
        e.x += Math.cos(angle) * e.speed * dt;
        e.y += Math.sin(angle) * e.speed * dt;
        e.facing = angle;
      }
    } else {
      // Wall destroyed: head through gate gap into fort
      const gateTarget = getGateTarget(e.targetGate);
      const distToGate = dist(ecx, ecy, gateTarget.x, gateTarget.y);

      if (distToGate < 50) {
        e.insideFort = true;
      } else {
        const angle = Math.atan2(gateTarget.y - ecy, gateTarget.x - ecx);
        e.x += Math.cos(angle) * e.speed * dt;
        e.y += Math.sin(angle) * e.speed * dt;
        e.facing = angle;
      }
    }
  } else {
    // Inside fort: head toward player
    const dx = playerX - ecx;
    const dy = playerY - ecy;
    const angle = Math.atan2(dy, dx);
    e.facing = angle;
    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
      e.x += Math.cos(angle) * e.speed * dt;
      e.y += Math.sin(angle) * e.speed * dt;
    }
  }
}

function updateRanged(e, dt, playerX, playerY, walls) {
  const ecx = e.x + e.width / 2;
  const ecy = e.y + e.height / 2;

  e.attackTimer -= dt;

  if (!e.insideFort) {
    const gateTarget = getGateTarget(e.targetGate);
    const wall = walls[e.targetGate];
    const wallAlive = wall && !wall.destroyed;
    const distToGate = dist(ecx, ecy, gateTarget.x, gateTarget.y);

    // Ranged enemies stop at range distance from gate and fire
    const stopDist = wallAlive ? Math.min(e.range || 200, 200) : 40;

    if (distToGate < stopDist && wallAlive) {
      e.facing = Math.atan2(playerY - ecy, playerX - ecx);
    } else if (distToGate < 40 && !wallAlive) {
      // Walk through destroyed gate
      e.insideFort = true;
    } else {
      // Move toward gate
      const angle = Math.atan2(gateTarget.y - ecy, gateTarget.x - ecx);
      e.x += Math.cos(angle) * e.speed * dt;
      e.y += Math.sin(angle) * e.speed * dt;
      e.facing = angle;
    }
  } else {
    // Inside fort: standard ranged behavior vs player
    const d = dist(ecx, ecy, playerX, playerY);

    if (d > (e.range || 200)) {
      const angle = Math.atan2(playerY - ecy, playerX - ecx);
      e.x += Math.cos(angle) * e.speed * dt;
      e.y += Math.sin(angle) * e.speed * dt;
      e.facing = angle;
    } else if (d < (e.retreatDist || 80)) {
      const angle = Math.atan2(ecy - playerY, ecx - playerX);
      e.x += Math.cos(angle) * e.speed * 0.5 * dt;
      e.y += Math.sin(angle) * e.speed * 0.5 * dt;
      e.facing = Math.atan2(playerY - ecy, playerX - ecx);
    } else {
      e.facing = Math.atan2(playerY - ecy, playerX - ecx);
    }
  }
}

function updateSuicide(e, dt, playerX, playerY, walls) {
  e.fuseTimer -= dt;

  const ecx = e.x + e.width / 2;
  const ecy = e.y + e.height / 2;
  const dToPlayer = dist(ecx, ecy, playerX, playerY);

  if (!e.insideFort) {
    // Rush toward gate
    const gateTarget = getGateTarget(e.targetGate);
    const wall = walls[e.targetGate];
    const wallAlive = wall && !wall.destroyed;
    const distToGate = dist(ecx, ecy, gateTarget.x, gateTarget.y);

    // Head toward player if very close, otherwise toward gate
    let tx, ty;
    if (dToPlayer < 200) {
      tx = playerX; ty = playerY;
    } else {
      tx = gateTarget.x; ty = gateTarget.y;
    }

    const angle = Math.atan2(ty - ecy, tx - ecx);
    e.x += Math.cos(angle) * e.speed * dt;
    e.y += Math.sin(angle) * e.speed * dt;
    e.facing = angle;

    // Check if through destroyed gate
    if (distToGate < 40 && !wallAlive) {
      e.insideFort = true;
    }
  } else {
    // Inside fort: rush toward player
    const angle = Math.atan2(playerY - ecy, playerX - ecx);
    e.x += Math.cos(angle) * e.speed * dt;
    e.y += Math.sin(angle) * e.speed * dt;
    e.facing = angle;
  }
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
  if (e.knockbackCooldown > 0) return;
  const resist = e.knockbackResist || 0;
  const kbAngle = e.facing + Math.PI; // opposite of their facing
  const kb = amount * (1 - resist);
  e.x += Math.cos(kbAngle) * kb;
  e.y += Math.sin(kbAngle) * kb;
  e.knockbackCooldown = 0.3;
  e.knockbackTrail = 3; // afterimage count
  e.x = clamp(e.x, 0, WORLD_W - e.width);
  e.y = clamp(e.y, 0, WORLD_H - e.height);
}

export function drawEnemy(e) {
  const ctx = getCtx();
  ctx.save();

  const isFlash = e.flashTimer > 0 && Math.floor(e.flashTimer * 20) % 2;

  const cx = (e.x + e.width / 2) | 0;
  const cy = (e.y + e.height / 2) | 0;
  const r = Math.max(e.width, e.height) / 2;

  if (!e.alive) {
    if (e.deathTimer > 0) {
      const alpha = e.deathTimer / 0.3;
      const sz = r * alpha;
      ctx.globalAlpha = alpha;
      const dGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz);
      dGrad.addColorStop(0, e.color);
      dGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, sz, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return;
  }

  const color = isFlash ? '#fff' : (e.buffed ? '#f88' : e.color);
  const t = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
  const tk = e.typeKey;

  // Walking bob animation
  const walkBob = (Math.sin(e.walkPhase) * 1.5) | 0;

  // Attack lunge
  const lungeMax = (tk === 'ogre' || tk === 'ogreSoldier' || tk === 'titan') ? 8 : 5;
  const lungeOffset = e.attackAnim > 0 ? (e.attackAnim * lungeMax) | 0 : 0;
  const lungeDx = Math.cos(e.facing) * lungeOffset;
  const lungeDy = Math.sin(e.facing) * lungeOffset;

  const drawCx = (cx + lungeDx) | 0;
  const drawCy = (cy + walkBob + lungeDy) | 0;

  // Knockback afterimages: semi-transparent copies trailing behind
  if (e.knockbackTrail > 0 && e.alive) {
    const trailCount = Math.min(3, Math.ceil(e.knockbackTrail));
    const kbAngle = e.facing; // trail behind in the direction they were knocked
    for (let i = 1; i <= trailCount; i++) {
      const trailAlpha = 0.15 * (1 - i / (trailCount + 1)) * (e.knockbackTrail / 3);
      const offsetX = Math.cos(kbAngle) * i * 4;
      const offsetY = Math.sin(kbAngle) * i * 4;
      ctx.globalAlpha = trailAlpha;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(drawCx + offsetX, drawCy + offsetY, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Shadow: dark radial gradient ellipse
  ctx.save();
  ctx.translate(cx, cy + r + 2);
  ctx.scale(1.3, 0.32);
  const shGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  shGrad.addColorStop(0, 'rgba(0,0,0,0.32)');
  shGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- Per-type painted characters ---
  if (tk === 'raider') {
    ctx.save();
    ctx.translate(drawCx, drawCy);
    ctx.rotate(e.facing);
    // Hunched body blob with bezier curves
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.bezierCurveTo(-8, -6, -9, 2, -7, 6);
    ctx.bezierCurveTo(-5, 9, 5, 9, 7, 6);
    ctx.bezierCurveTo(9, 2, 8, -6, 4, -8);
    ctx.bezierCurveTo(2, -10, -2, -10, -4, -8);
    ctx.closePath();
    if (isFlash) { ctx.fillStyle = '#fff'; }
    else {
      const bg = ctx.createRadialGradient(0, -2, 2, 0, 2, 10);
      bg.addColorStop(0, '#5cb85c');
      bg.addColorStop(1, '#2a5a1a');
      ctx.fillStyle = bg;
    }
    ctx.fill();
    // Ragged cloth at waist
    if (!isFlash) {
      ctx.fillStyle = '#6a5030';
      ctx.beginPath();
      ctx.moveTo(-6, 3);
      ctx.lineTo(-7, 8);
      ctx.lineTo(-3, 6);
      ctx.lineTo(0, 9);
      ctx.lineTo(3, 6);
      ctx.lineTo(7, 8);
      ctx.lineTo(6, 3);
      ctx.closePath();
      ctx.fill();
    }
    // Eyes: two small yellow arcs
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(4, -4, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Sword: short tapered brown-grey line
    if (!isFlash) {
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(17, 0);
      ctx.stroke();
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(17, 0);
      ctx.stroke();
      // Handle
      ctx.fillStyle = '#664';
      ctx.beginPath();
      ctx.arc(7, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(17, 0);
      ctx.stroke();
    }
    ctx.restore();

  } else if (tk === 'soldier') {
    ctx.save();
    ctx.translate(drawCx, drawCy);
    ctx.rotate(e.facing);
    // Upright body, taller than raider
    ctx.beginPath();
    ctx.moveTo(-5, -11);
    ctx.bezierCurveTo(-9, -8, -9, 6, -7, 9);
    ctx.bezierCurveTo(-4, 12, 4, 12, 7, 9);
    ctx.bezierCurveTo(9, 6, 9, -8, 5, -11);
    ctx.closePath();
    if (isFlash) { ctx.fillStyle = '#fff'; }
    else {
      const bg = ctx.createLinearGradient(0, -11, 0, 12);
      bg.addColorStop(0, '#5cb85c');
      bg.addColorStop(1, '#2a5a1a');
      ctx.fillStyle = bg;
    }
    ctx.fill();
    // Leather helmet: brown arc on top
    ctx.fillStyle = isFlash ? '#fff' : '#7a5530';
    ctx.beginPath();
    ctx.arc(0, -10, 5, Math.PI, 0);
    ctx.fill();
    if (!isFlash) {
      ctx.fillStyle = '#8a6540';
      ctx.beginPath();
      ctx.arc(0, -10, 4, Math.PI + 0.2, -0.2);
      ctx.fill();
    }
    // Wooden shield (if not broken)
    if (e.hasShield && !e.shieldBroken) {
      ctx.fillStyle = isFlash ? '#fff' : '#997744';
      ctx.beginPath();
      ctx.arc(10, 0, 7, -1.2, 1.2);
      ctx.closePath();
      ctx.fill();
      // Grain lines on shield
      if (!isFlash) {
        ctx.strokeStyle = '#7a5530';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(10, 0, 5, -0.8, 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(10, 0, 3, -0.5, 0.5);
        ctx.stroke();
        // Shield boss
        ctx.fillStyle = '#ccbb88';
        ctx.beginPath();
        ctx.arc(10, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Spear: long thin line behind shield
    ctx.strokeStyle = isFlash ? '#fff' : '#aaa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(6, -1);
    ctx.lineTo(22, -1);
    ctx.stroke();
    // Spear tip
    if (!isFlash) {
      ctx.fillStyle = '#ccc';
      ctx.beginPath();
      ctx.moveTo(20, -3);
      ctx.lineTo(24, -1);
      ctx.lineTo(20, 1);
      ctx.closePath();
      ctx.fill();
    }
    // Eyes
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(3, -6, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  } else if (tk === 'bomber') {
    ctx.save();
    ctx.translate(drawCx, drawCy);
    ctx.rotate(e.facing);
    // Round squat body (darker green)
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 6, 0, 0, Math.PI * 2);
    if (isFlash) { ctx.fillStyle = '#fff'; }
    else {
      const bg = ctx.createRadialGradient(0, -1, 1, 0, 1, 7);
      bg.addColorStop(0, '#4a8a3a');
      bg.addColorStop(1, '#1a3a0a');
      ctx.fillStyle = bg;
    }
    ctx.fill();
    // Bomb on back: dark grey circle
    ctx.fillStyle = isFlash ? '#fff' : '#2a2a2a';
    ctx.beginPath();
    ctx.arc(-8, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    if (!isFlash) {
      // Bomb highlight
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(-7, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Wild eyes: larger yellow eyes
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(4, -3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, 3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    if (!isFlash) {
      ctx.fillStyle = '#220';
      ctx.beginPath();
      ctx.arc(5, -3, 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5, 3, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Fuse spark (world space)
    const fuseRate = e.fuseTimer < 2 ? 12 : 5;
    const fusePulse = Math.sin((e.fuseTimer || t) * fuseRate * Math.PI);
    const backX = cx - Math.cos(e.facing) * (r * 0.6);
    const backY = cy - Math.sin(e.facing) * (r * 0.6);
    // Fuse line
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(backX, backY);
    ctx.quadraticCurveTo(backX + 2, backY - 5, backX, backY - 8);
    ctx.stroke();
    // Animated spark glow
    const sparkR = 3 + fusePulse * 2;
    const sparkAlpha = 0.6 + fusePulse * 0.4;
    const sparkGrad = ctx.createRadialGradient(backX, backY - 9, 0, backX, backY - 9, sparkR + 3);
    sparkGrad.addColorStop(0, `rgba(255,220,80,${sparkAlpha})`);
    sparkGrad.addColorStop(0.5, `rgba(255,120,20,${sparkAlpha * 0.6})`);
    sparkGrad.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = sparkGrad;
    ctx.beginPath();
    ctx.arc(backX, backY - 9, sparkR + 3, 0, Math.PI * 2);
    ctx.fill();
    // Bright core
    ctx.fillStyle = `rgba(255,255,200,${sparkAlpha})`;
    ctx.beginPath();
    ctx.arc(backX, backY - 9, sparkR * 0.4, 0, Math.PI * 2);
    ctx.fill();

  } else if (tk === 'archer') {
    ctx.save();
    ctx.translate(drawCx, drawCy);
    ctx.rotate(e.facing);
    // Slim green body
    ctx.beginPath();
    ctx.moveTo(-4, -10);
    ctx.bezierCurveTo(-7, -7, -7, 7, -5, 10);
    ctx.bezierCurveTo(-3, 12, 3, 12, 5, 10);
    ctx.bezierCurveTo(7, 7, 7, -7, 4, -10);
    ctx.closePath();
    if (isFlash) { ctx.fillStyle = '#fff'; }
    else {
      const bg = ctx.createLinearGradient(0, -10, 0, 12);
      bg.addColorStop(0, '#5ab84a');
      bg.addColorStop(1, '#2a5a1a');
      ctx.fillStyle = bg;
    }
    ctx.fill();
    // Bow: curved arc on facing side
    ctx.strokeStyle = isFlash ? '#fff' : '#8B4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(9, 0, 9, -1.0, 1.0);
    ctx.stroke();
    // Bowstring
    ctx.strokeStyle = isFlash ? '#ddd' : '#c8a880';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(9 + Math.cos(-1.0) * 9, Math.sin(-1.0) * 9);
    ctx.lineTo(9 + Math.cos(1.0) * 9, Math.sin(1.0) * 9);
    ctx.stroke();
    // Arrow notched on string
    ctx.strokeStyle = isFlash ? '#fff' : '#8B4513';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(19, 0);
    ctx.stroke();
    // Arrow tip
    if (!isFlash) {
      ctx.fillStyle = '#aaa';
      ctx.beginPath();
      ctx.moveTo(17, -2);
      ctx.lineTo(20, 0);
      ctx.lineTo(17, 2);
      ctx.closePath();
      ctx.fill();
    }
    // Quiver on back
    ctx.fillStyle = isFlash ? '#fff' : '#654321';
    ctx.beginPath();
    ctx.moveTo(-9, -7);
    ctx.arcTo(-13, -7, -13, 5, 2);
    ctx.arcTo(-13, 7, -9, 7, 2);
    ctx.lineTo(-9, 5);
    ctx.closePath();
    ctx.fill();
    // Arrow tips poking out (3 small lines)
    if (!isFlash) {
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-10, -8 + i * 0.8);
        ctx.lineTo(-10, -10 + i * 0.5);
        ctx.stroke();
      }
      // Arrow tip triangles
      ctx.fillStyle = '#999';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-11, -10.5 + i * 0.8);
        ctx.lineTo(-10, -12 + i * 0.5);
        ctx.lineTo(-9, -10.5 + i * 0.8);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Eyes
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(3, -5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  } else if (tk === 'ogre') {
    ctx.save();
    ctx.translate(drawCx, drawCy);
    ctx.rotate(e.facing);
    // LARGE wide body: big oval with gradient
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 14, 0, 0, Math.PI * 2);
    if (isFlash) { ctx.fillStyle = '#fff'; }
    else {
      const bg = ctx.createLinearGradient(0, -14, 0, 14);
      bg.addColorStop(0, '#7ab86a');
      bg.addColorStop(0.5, '#4a8a3a');
      bg.addColorStop(1, '#2a5a1a');
      ctx.fillStyle = bg;
    }
    ctx.fill();
    // Thick arms: tapered bezier paths
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = isFlash ? '#fff' : '#4a8a3a';
      ctx.beginPath();
      ctx.moveTo(-14, side * 8);
      ctx.bezierCurveTo(-18, side * 6, -20, side * 10, -17, side * 14);
      ctx.bezierCurveTo(-15, side * 16, -12, side * 14, -12, side * 10);
      ctx.closePath();
      ctx.fill();
    }
    // Small head
    ctx.fillStyle = isFlash ? '#fff' : '#5a7a4a';
    ctx.beginPath();
    ctx.arc(0, -16, 5, 0, Math.PI * 2);
    ctx.fill();
    if (!isFlash) {
      ctx.fillStyle = '#4a6a3a';
      ctx.beginPath();
      ctx.arc(0, -15, 3, 0, Math.PI);
      ctx.fill();
    }
    // Eyes
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(-2, -17, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2, -17, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // Club: thick brown tapered bezier shape
    ctx.fillStyle = isFlash ? '#fff' : '#664422';
    ctx.beginPath();
    ctx.moveTo(14, -2);
    ctx.bezierCurveTo(18, -3, 24, -4, 28, -5);
    ctx.bezierCurveTo(30, -3, 30, 3, 28, 5);
    ctx.bezierCurveTo(24, 4, 18, 3, 14, 2);
    ctx.closePath();
    ctx.fill();
    if (!isFlash) {
      ctx.fillStyle = '#553318';
      ctx.beginPath();
      ctx.moveTo(24, -3);
      ctx.bezierCurveTo(26, -4, 30, -3, 30, 0);
      ctx.bezierCurveTo(30, 3, 26, 4, 24, 3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

  } else if (tk === 'orcKnight') {
    ctx.save();
    ctx.translate(drawCx, drawCy);
    ctx.rotate(e.facing);
    // Metallic grey gradient body (armored)
    ctx.beginPath();
    ctx.moveTo(-7, -12);
    ctx.bezierCurveTo(-11, -10, -11, 10, -8, 12);
    ctx.bezierCurveTo(-4, 14, 4, 14, 8, 12);
    ctx.bezierCurveTo(11, 10, 11, -10, 7, -12);
    ctx.closePath();
    if (isFlash) { ctx.fillStyle = '#fff'; }
    else {
      const bg = ctx.createLinearGradient(0, -12, 0, 14);
      bg.addColorStop(0, '#8898a8');
      bg.addColorStop(0.5, '#667788');
      bg.addColorStop(1, '#445566');
      ctx.fillStyle = bg;
    }
    ctx.fill();
    // Helmet with cross visor
    ctx.fillStyle = isFlash ? '#fff' : '#556';
    ctx.beginPath();
    ctx.arc(0, -12, 7, 0, Math.PI * 2);
    ctx.fill();
    // Cross visor lines
    if (!isFlash) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, -12);
      ctx.lineTo(4, -12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(0, -8);
      ctx.stroke();
    }
    // Shoulder pauldrons
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = isFlash ? '#fff' : '#667';
      ctx.beginPath();
      ctx.arc(0, side * 10, 5, side > 0 ? 0 : Math.PI, side > 0 ? Math.PI : Math.PI * 2);
      ctx.fill();
      if (!isFlash) {
        ctx.fillStyle = '#778';
        ctx.beginPath();
        ctx.arc(0, side * 10, 4, side > 0 ? 0.2 : Math.PI + 0.2, side > 0 ? Math.PI - 0.2 : Math.PI * 2 - 0.2);
        ctx.fill();
      }
    }
    // Heavy sword: gradient metallic line
    if (!isFlash) {
      const sGrad = ctx.createLinearGradient(8, 0, 24, 0);
      sGrad.addColorStop(0, '#aab');
      sGrad.addColorStop(0.5, '#dde');
      sGrad.addColorStop(1, '#fff');
      ctx.strokeStyle = sGrad;
    } else {
      ctx.strokeStyle = '#fff';
    }
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();
    // Handle
    ctx.fillStyle = isFlash ? '#fff' : '#884';
    ctx.beginPath();
    ctx.arc(8, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  } else if (tk === 'wizard') {
    ctx.save();
    ctx.translate(drawCx, drawCy);
    ctx.rotate(e.facing);
    // Purple robe body: triangular gradient
    ctx.beginPath();
    ctx.moveTo(-5, -8);
    ctx.lineTo(5, -8);
    ctx.bezierCurveTo(8, 0, 11, 8, 10, 12);
    ctx.lineTo(-10, 12);
    ctx.bezierCurveTo(-11, 8, -8, 0, -5, -8);
    ctx.closePath();
    if (isFlash) { ctx.fillStyle = '#fff'; }
    else {
      const bg = ctx.createLinearGradient(0, -8, 0, 12);
      bg.addColorStop(0, '#8050c0');
      bg.addColorStop(1, '#3a1a5a');
      ctx.fillStyle = bg;
    }
    ctx.fill();
    // Robe trim
    if (!isFlash) {
      ctx.strokeStyle = '#6040a0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-9, 10);
      ctx.lineTo(9, 10);
      ctx.stroke();
    }
    // Pointed hat
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.bezierCurveTo(-3, -18, -8, -10, -9, -8);
    ctx.lineTo(9, -8);
    ctx.bezierCurveTo(8, -10, 3, -18, 0, -26);
    ctx.closePath();
    if (isFlash) { ctx.fillStyle = '#fff'; }
    else {
      const hg = ctx.createLinearGradient(-5, -26, 5, -8);
      hg.addColorStop(0, '#6040a0');
      hg.addColorStop(1, '#402070');
      ctx.fillStyle = hg;
    }
    ctx.fill();
    // Star at hat tip (tiny 4-point shape)
    if (!isFlash) {
      ctx.fillStyle = '#ffe080';
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(1.5, -26);
      ctx.lineTo(0, -24);
      ctx.lineTo(-1.5, -26);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-2, -26);
      ctx.lineTo(0, -27);
      ctx.lineTo(2, -26);
      ctx.lineTo(0, -25);
      ctx.closePath();
      ctx.fill();
    }
    // Hat brim
    ctx.fillStyle = isFlash ? '#fff' : '#503080';
    ctx.beginPath();
    ctx.ellipse(0, -9, 10, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Staff extending backward
    ctx.strokeStyle = isFlash ? '#fff' : '#8B6914';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-22, 0);
    ctx.stroke();
    // Glowing orb at staff tip
    if (!isFlash) {
      const orbGrad = ctx.createRadialGradient(-22, 0, 0, -22, 0, 5);
      orbGrad.addColorStop(0, 'rgba(240,200,255,0.9)');
      orbGrad.addColorStop(0.5, 'rgba(180,100,255,0.6)');
      orbGrad.addColorStop(1, 'rgba(120,40,200,0)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(-22, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      // Bright core
      ctx.fillStyle = '#e0c0ff';
      ctx.beginPath();
      ctx.arc(-22, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-22, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Magic trail: 2-3 semi-transparent purple circles trailing behind
    if (!isFlash) {
      for (let i = 1; i <= 3; i++) {
        const ox = Math.sin(t * 5 + i * 2) * 2;
        const oy = Math.cos(t * 4 + i * 1.5) * 2;
        ctx.fillStyle = `rgba(160,80,255,${0.3 / i})`;
        ctx.beginPath();
        ctx.arc(-22 - i * 5 + ox, oy, 2.5 - i * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Eyes
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(3, -5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  } else if (tk === 'ogreSoldier') {
    ctx.save();
    ctx.translate(drawCx, drawCy);
    ctx.rotate(e.facing);
    // Same as ogre but darker palette with armor
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 14, 0, 0, Math.PI * 2);
    if (isFlash) { ctx.fillStyle = '#fff'; }
    else {
      const bg = ctx.createLinearGradient(0, -14, 0, 14);
      bg.addColorStop(0, '#887060');
      bg.addColorStop(0.5, '#665544');
      bg.addColorStop(1, '#443322');
      ctx.fillStyle = bg;
    }
    ctx.fill();
    // Armor plates: darker gradient shapes on body
    if (!isFlash) {
      ctx.fillStyle = 'rgba(50,50,60,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, -4, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(50,50,60,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 5, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Thick arms
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = isFlash ? '#fff' : '#665544';
      ctx.beginPath();
      ctx.moveTo(-14, side * 8);
      ctx.bezierCurveTo(-18, side * 6, -20, side * 10, -17, side * 14);
      ctx.bezierCurveTo(-15, side * 16, -12, side * 14, -12, side * 10);
      ctx.closePath();
      ctx.fill();
      // Arm armor
      if (!isFlash) {
        ctx.fillStyle = 'rgba(50,50,60,0.4)';
        ctx.beginPath();
        ctx.ellipse(-16, side * 10, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Helmet: small grey arc on head
    ctx.fillStyle = isFlash ? '#fff' : '#667';
    ctx.beginPath();
    ctx.arc(0, -16, 6, Math.PI, 0);
    ctx.lineTo(6, -13);
    ctx.lineTo(-6, -13);
    ctx.closePath();
    ctx.fill();
    if (!isFlash) {
      ctx.fillStyle = '#778';
      ctx.beginPath();
      ctx.arc(0, -16, 5, Math.PI + 0.2, -0.2);
      ctx.fill();
      // Visor slit
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-4, -14);
      ctx.lineTo(4, -14);
      ctx.stroke();
    }
    // Club forward
    ctx.fillStyle = isFlash ? '#fff' : '#664422';
    ctx.beginPath();
    ctx.moveTo(14, -2);
    ctx.bezierCurveTo(18, -3, 24, -5, 30, -6);
    ctx.bezierCurveTo(32, -3, 32, 3, 30, 6);
    ctx.bezierCurveTo(24, 5, 18, 3, 14, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

  } else if (tk === 'titan') {
    // Pulsing red aura behind body
    const auraR = r + 10 + Math.sin(t * 3) * 4;
    const auraAlpha = 0.08 + 0.06 * Math.sin(t * 4);
    const auraGrad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, auraR);
    auraGrad.addColorStop(0, `rgba(255,40,40,${auraAlpha * 1.5})`);
    auraGrad.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
    ctx.fill();
    // Boss aura ring: semi-transparent red circle stroke that pulses
    const ringAlpha = 0.15 + 0.12 * Math.sin(t * 4);
    ctx.strokeStyle = `rgba(200,40,40,${ringAlpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, auraR - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(drawCx, drawCy);
    ctx.rotate(e.facing);
    // MASSIVE body with gradient fill
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 20, 0, 0, Math.PI * 2);
    if (isFlash) { ctx.fillStyle = '#fff'; }
    else {
      const bg = ctx.createLinearGradient(0, -20, 0, 20);
      bg.addColorStop(0, '#a44');
      bg.addColorStop(0.5, '#833');
      bg.addColorStop(1, '#522');
      ctx.fillStyle = bg;
    }
    ctx.fill();
    // Thick arms
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = isFlash ? '#fff' : '#733';
      ctx.beginPath();
      ctx.moveTo(-18, side * 10);
      ctx.bezierCurveTo(-24, side * 8, -28, side * 12, -24, side * 18);
      ctx.bezierCurveTo(-20, side * 20, -16, side * 16, -16, side * 12);
      ctx.closePath();
      ctx.fill();
    }
    // Head
    ctx.fillStyle = isFlash ? '#fff' : '#622';
    ctx.beginPath();
    ctx.arc(0, -22, 8, 0, Math.PI * 2);
    ctx.fill();
    // Crown: 3 gold triangles on top
    ctx.fillStyle = isFlash ? '#fff' : '#da2';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 6 - 2, -28);
      ctx.lineTo(i * 6, -34 - (i === 0 ? 4 : 0));
      ctx.lineTo(i * 6 + 2, -28);
      ctx.closePath();
      ctx.fill();
    }
    // Crown base
    ctx.fillStyle = isFlash ? '#fff' : '#c92';
    ctx.fillRect(-8, -29, 16, 3);
    if (!isFlash) {
      ctx.fillStyle = '#a70';
      ctx.fillRect(-7, -28, 14, 1);
    }
    // Glowing red eyes
    if (!isFlash) {
      for (let side = -1; side <= 1; side += 2) {
        const eyeGrad = ctx.createRadialGradient(side * 3, -22, 0, side * 3, -22, 3);
        eyeGrad.addColorStop(0, '#f88');
        eyeGrad.addColorStop(0.5, '#f33');
        eyeGrad.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.arc(side * 3, -22, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-3, -22, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(3, -22, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Heavy weapon with slight glow
    if (!isFlash) {
      // Weapon glow
      ctx.fillStyle = 'rgba(255,100,100,0.15)';
      ctx.beginPath();
      ctx.ellipse(34, 0, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      const wGrad = ctx.createLinearGradient(20, 0, 42, 0);
      wGrad.addColorStop(0, '#666');
      wGrad.addColorStop(0.5, '#888');
      wGrad.addColorStop(1, '#999');
      ctx.fillStyle = wGrad;
    } else {
      ctx.fillStyle = '#fff';
    }
    ctx.beginPath();
    ctx.moveTo(20, -4);
    ctx.lineTo(38, -6);
    ctx.bezierCurveTo(42, -6, 44, -2, 44, 0);
    ctx.bezierCurveTo(44, 2, 42, 6, 38, 6);
    ctx.lineTo(20, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

  } else {
    // Fallback: painted circle
    ctx.beginPath();
    ctx.arc(drawCx, drawCy, r, 0, Math.PI * 2);
    if (isFlash) { ctx.fillStyle = '#fff'; }
    else {
      const bg = ctx.createRadialGradient(drawCx, drawCy - r * 0.3, r * 0.2, drawCx, drawCy, r);
      bg.addColorStop(0, e.color);
      bg.addColorStop(1, '#333');
      ctx.fillStyle = bg;
    }
    ctx.fill();
  }

  // Heavy enemy dust footsteps (ogre/ogreSoldier/titan)
  if ((tk === 'ogre' || tk === 'ogreSoldier' || tk === 'titan') && e.speed > 0 && !isFlash) {
    const dustAlpha = Math.max(0, 0.3 - Math.abs(Math.sin(e.walkPhase)) * 0.4);
    if (dustAlpha > 0.02) {
      const footY = cy + r + 2;
      ctx.fillStyle = `rgba(120,100,70,${dustAlpha})`;
      ctx.beginPath();
      ctx.arc(cx - 4 + Math.sin(e.walkPhase * 0.7) * 3, footY, 2 + dustAlpha * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 5 + Math.cos(e.walkPhase * 0.7) * 2, footY + 1, 1.5 + dustAlpha * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // White overlay on body shape when hit flash
  if (isFlash) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(drawCx, drawCy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Buffed red tint overlay
  if (e.buffed && !isFlash) {
    ctx.fillStyle = 'rgba(255, 50, 50, 0.18)';
    ctx.beginPath();
    ctx.arc(drawCx, drawCy, r + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // HP bar (follows animation position)
  if (e.hp < e.maxHP) {
    drawBar(drawCx - r, drawCy - r - 8, r * 2, 4, e.hp / e.maxHP, '#cc3333', '#441111');
  }

  ctx.restore();
}

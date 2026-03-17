import { TROOPS, BARRICADE_X, GAME_WIDTH, PLAYFIELD_TOP, PLAYFIELD_BOTTOM } from '../config.js';
import { clamp, randRange, dist } from '../utils/math.js';
import { drawRect, drawBar, drawCircle, getCtx } from '../renderer.js';

let troopId = 0;

export function createTroop(typeKey, troopDmgMult = 1) {
  const def = TROOPS[typeKey];
  return {
    id: troopId++,
    typeKey,
    name: def.name,
    x: BARRICADE_X - 50 + randRange(-20, 20),
    y: randRange(PLAYFIELD_TOP + 40, PLAYFIELD_BOTTOM - 40),
    width: def.width,
    height: def.height,
    hp: def.hp,
    maxHP: def.hp,
    damage: Math.round(def.damage * troopDmgMult),
    attackRate: def.attackRate,
    attackTimer: def.attackRate,
    speed: def.speed,
    color: def.color,
    type: def.type,
    range: def.range || 40,
    aoeRadius: def.aoeRadius || 0,
    alive: true,
    flashTimer: 0,
    facing: 0,
    regroupX: null,
    regroupY: null,
  };
}

export function updateTroop(t, dt, enemies, regroupPos) {
  if (!t.alive) return;

  if (t.flashTimer > 0) t.flashTimer -= dt;

  // Regroup
  if (regroupPos) {
    t.regroupX = regroupPos.x + randRange(-30, 30);
    t.regroupY = regroupPos.y + randRange(-20, 20);
  }

  // Find nearest enemy (2D distance)
  let nearest = null;
  let nearestDist = Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = dist(e.x + e.width / 2, e.y + e.height / 2, t.x + t.width / 2, t.y + t.height / 2);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = e;
    }
  }

  // Move towards target or regroup position
  const tcx = t.x + t.width / 2;
  const tcy = t.y + t.height / 2;

  if (t.type === 'melee') {
    if (nearest && nearestDist < 300) {
      const angle = Math.atan2(nearest.y + nearest.height / 2 - tcy, nearest.x + nearest.width / 2 - tcx);
      t.facing = angle;
      if (nearestDist > 40) {
        t.x += Math.cos(angle) * t.speed * dt;
        t.y += Math.sin(angle) * t.speed * dt;
      }
    } else if (t.regroupX !== null) {
      const dx = t.regroupX - t.x;
      const dy = t.regroupY - t.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 5) {
        t.x += (dx / d) * t.speed * dt;
        t.y += (dy / d) * t.speed * dt;
      }
    }
  } else if (t.type === 'ranged') {
    // Ranged troops face nearest enemy but keep distance
    if (nearest) {
      t.facing = Math.atan2(nearest.y + nearest.height / 2 - tcy, nearest.x + nearest.width / 2 - tcx);
      if (nearestDist < 60) {
        // Back away
        t.x -= Math.cos(t.facing) * t.speed * 0.5 * dt;
        t.y -= Math.sin(t.facing) * t.speed * 0.5 * dt;
      }
    }
  }

  // Clamp position
  t.x = clamp(t.x, 20, GAME_WIDTH - t.width);
  t.y = clamp(t.y, PLAYFIELD_TOP, PLAYFIELD_BOTTOM - t.height);

  // Attack
  t.attackTimer -= dt;
  if (t.attackTimer <= 0 && nearest) {
    t.attackTimer = t.attackRate;
    if (nearestDist <= t.range) {
      return { target: nearest, damage: t.damage, aoe: t.aoeRadius };
    }
  }

  return null;
}

export function damageTroop(t, amount) {
  t.hp -= amount;
  t.flashTimer = 0.1;
  if (t.hp <= 0) {
    t.hp = 0;
    t.alive = false;
  }
}

export function drawTroop(t) {
  if (!t.alive) return;

  const ctx = getCtx();
  const isFlash = t.flashTimer > 0 && Math.floor(t.flashTimer * 20) % 2;
  const color = isFlash ? '#fff' : t.color;
  const cx = t.x + t.width / 2;
  const cy = t.y + t.height / 2;
  const r = Math.max(t.width, t.height) / 2;

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
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Facing indicator
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(t.facing) * r * 0.5, cy + Math.sin(t.facing) * r * 0.5);
  ctx.lineTo(cx + Math.cos(t.facing) * (r + 3), cy + Math.sin(t.facing) * (r + 3));
  ctx.stroke();

  // Friendly indicator (green diamond above)
  ctx.fillStyle = '#4f4';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r - 6);
  ctx.lineTo(cx + 3, cy - r - 3);
  ctx.lineTo(cx, cy - r);
  ctx.lineTo(cx - 3, cy - r - 3);
  ctx.fill();

  // HP bar
  if (t.hp < t.maxHP) {
    drawBar(cx - r, cy - r - 10, r * 2, 3, t.hp / t.maxHP, '#4a4', '#222');
  }
}

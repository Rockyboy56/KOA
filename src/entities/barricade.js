import { BARRICADES, BARRICADE_X, BARRICADE_Y, BARRICADE_W, BARRICADE_H, GAME_HEIGHT, PLAYFIELD_TOP, PLAYFIELD_BOTTOM } from '../config.js';
import { drawRect, drawBar, drawText, getCtx } from '../renderer.js';

export function createBarricade(level = 0, hpMult = 1) {
  const def = BARRICADES[level];
  const maxHP = Math.round(def.hp * hpMult);
  // Horizontal wall positioned as a vertical defensive line
  return {
    x: BARRICADE_X,
    y: BARRICADE_Y - BARRICADE_H / 2,
    width: BARRICADE_W,
    height: BARRICADE_H,
    level,
    hp: maxHP,
    maxHP,
    color: def.color,
    destroyed: false,
    rebuildTimer: 0,
  };
}

export function upgradeBarricade(b, newLevel, hpMult) {
  const def = BARRICADES[newLevel];
  b.level = newLevel;
  b.maxHP = Math.round(def.hp * hpMult);
  b.hp = b.maxHP;
  b.color = def.color;
  b.destroyed = false;
}

export function damageBarricade(b, amount) {
  b.hp -= amount;
  if (b.hp <= 0) {
    b.hp = 0;
    b.destroyed = true;
    b.rebuildTimer = 3.0;
  }
}

export function repairBarricade(b, dt, gold) {
  const def = BARRICADES[b.level];

  if (b.destroyed) {
    b.rebuildTimer -= dt;
    if (b.rebuildTimer <= 0) {
      b.destroyed = false;
      b.hp = Math.round(b.maxHP * 0.25);
    }
    return 0;
  }

  if (b.hp >= b.maxHP) return 0;

  const repairAmount = 50 * dt;
  const costPerHP = def.repairCostPerHP;
  const cost = Math.round(repairAmount * costPerHP);

  if (cost > gold && costPerHP > 0) return 0;

  b.hp = Math.min(b.maxHP, b.hp + repairAmount);
  return cost;
}

export function drawBarricade(b) {
  const ctx = getCtx();

  if (b.destroyed) {
    // Rubble scattered along the wall line
    ctx.fillStyle = '#553';
    for (let i = 0; i < 8; i++) {
      const ry = b.y + i * (b.height / 8);
      ctx.fillRect(b.x - 4 + (i % 3) * 4, ry, 12, 8);
    }
    drawText('DESTROYED', b.x - 30, b.y + b.height / 2 - 5, 8, '#f44');
    return;
  }

  // Wall shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(b.x + 3, b.y + 3, b.width, b.height);

  // Main wall body
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.width, b.height);

  // Wall top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(b.x, b.y, b.width * 0.4, b.height);

  // Stone/wood texture lines along the wall
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < b.height; i += 20) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + i);
    ctx.lineTo(b.x + b.width, b.y + i);
    ctx.stroke();
  }

  // Damage cracks
  const pct = b.hp / b.maxHP;
  if (pct < 0.75) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x + 2, b.y + 30);
    ctx.lineTo(b.x + b.width - 2, b.y + 45);
    ctx.stroke();
  }
  if (pct < 0.5) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x + b.width - 2, b.y + b.height * 0.4);
    ctx.lineTo(b.x + 2, b.y + b.height * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x + 4, b.y + b.height * 0.7);
    ctx.lineTo(b.x + b.width - 4, b.y + b.height * 0.75);
    ctx.stroke();
  }
  if (pct < 0.25) {
    ctx.fillStyle = 'rgba(50,30,10,0.5)';
    ctx.fillRect(b.x + 2, b.y + b.height * 0.3, b.width - 4, 12);
    ctx.fillRect(b.x + 2, b.y + b.height * 0.6, b.width - 4, 10);
  }

  // HP bar alongside the wall
  const barColor = pct > 0.5 ? '#4a4' : pct > 0.25 ? '#aa4' : '#a44';
  drawBar(b.x - 8, b.y - 10, b.width + 16, 6, pct, barColor, '#222');
}

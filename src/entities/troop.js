import { TROOPS, FORT, GATES, WORLD_W, WORLD_H } from '../config.js';
import { clamp, randRange, dist } from '../utils/math.js';
import { drawRect, drawBar, drawCircle, getCtx } from '../renderer.js';
import { getBlockingRects, resolveAxis } from '../utils/wallCollision.js';
import { drawTroop as _drawTroopNew } from '../rendering/drawTroop.js';

let troopId = 0;

export function createTroop(typeKey, troopDmgMult = 1, assignedGate = 'east') {
  const def = TROOPS[typeKey];

  // Default position: just inside the gate gap on their assigned side
  let startX, startY;
  switch (assignedGate) {
    case 'north':
      startX = GATES.north.x + 60 + randRange(-20, 20);
      startY = FORT.y + FORT.wallThickness + 40 + randRange(-10, 10);
      break;
    case 'south':
      startX = GATES.south.x + 60 + randRange(-20, 20);
      startY = FORT.y + FORT.h - FORT.wallThickness - 40 + randRange(-10, 10);
      break;
    case 'east':
      startX = FORT.x + FORT.w - FORT.wallThickness - 40 + randRange(-10, 10);
      startY = GATES.east.y + 60 + randRange(-20, 20);
      break;
    case 'west':
      startX = FORT.x + FORT.wallThickness + 40 + randRange(-10, 10);
      startY = GATES.west.y + 60 + randRange(-20, 20);
      break;
    default:
      startX = FORT.x + FORT.w - FORT.wallThickness - 40;
      startY = GATES.east.y + 60;
      break;
  }

  return {
    id: troopId++,
    typeKey,
    name: def.name,
    x: startX,
    y: startY,
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
    assignedGate,
  };
}

export function updateTroop(t, dt, enemies, regroupPos, walls) {
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

  // Wall collision (troops pass through gate gaps freely, like player)
  t.x = clamp(t.x, 0, WORLD_W - t.width);
  t.y = clamp(t.y, 0, WORLD_H - t.height);
  if (walls) {
    const rects = getBlockingRects(walls, 'troop');
    resolveAxis(t, rects, 'x');
    resolveAxis(t, rects, 'y');
  }

  // Attack
  t.attackTimer -= dt;
  if (t.attackTimer <= 0 && nearest) {
    t.attackTimer = t.attackRate;
    if (nearestDist <= t.range) {
      if (t.typeKey === 'archer') {
        const angle = Math.atan2(
          nearest.y + nearest.height / 2 - tcy,
          nearest.x + nearest.width / 2 - tcx
        );
        return { spawnProjectile: { x: tcx, y: tcy, angle, damage: t.damage } };
      }
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
  _drawTroopNew(t);
}

function _drawTroopLegacy(t) {
  if (!t.alive) return;

  const ctx = getCtx();
  ctx.save();

  const isFlash = t.flashTimer > 0 && Math.floor(t.flashTimer * 20) % 2;
  const cx = (t.x + t.width / 2) | 0;
  const cy = (t.y + t.height / 2) | 0;
  const r = Math.max(t.width, t.height) / 2;
  const time = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;

  // Flag colors per troop type
  const flagColors = {
    footman: '#4488dd',
    archer: '#44aa44',
    knight: '#8844aa',
    wizard: '#cc44cc',
    shredder: '#ccaa22',
  };
  const flagColor = flagColors[t.typeKey] || '#4f4';

  // Shadow: dark gradient ellipse underneath
  ctx.save();
  ctx.translate(cx, cy + r + 2);
  ctx.scale(1.3, 0.3);
  const shGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  shGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
  shGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Body: blue-tinted painted soldier with gradient
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (isFlash) {
    ctx.fillStyle = '#fff';
  } else {
    const bodyGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.15, cx, cy, r);
    bodyGrad.addColorStop(0, '#8ab4e0');
    bodyGrad.addColorStop(0.6, '#5580a8');
    bodyGrad.addColorStop(1, '#3a5a78');
    ctx.fillStyle = bodyGrad;
  }
  ctx.fill();
  // Rim outline
  ctx.strokeStyle = isFlash ? 'rgba(255,255,255,0.5)' : 'rgba(30,50,80,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Small shield (blue arc on the body side)
  if (!isFlash) {
    const shX = cx + Math.cos(t.facing + 0.6) * (r * 0.6);
    const shY = cy + Math.sin(t.facing + 0.6) * (r * 0.6);
    ctx.fillStyle = '#4470a0';
    ctx.beginPath();
    ctx.arc(shX, shY, r * 0.4, t.facing + 0.2, t.facing + Math.PI - 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6090c0';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // Per-type weapon drawing
  const wBase = r * 0.4;
  const cosF = Math.cos(t.facing);
  const sinF = Math.sin(t.facing);
  const perpCos = Math.cos(t.facing + Math.PI / 2);
  const perpSin = Math.sin(t.facing + Math.PI / 2);

  if (t.typeKey === 'footman') {
    // Short sword: tapered line with crossguard
    ctx.strokeStyle = isFlash ? '#fff' : '#bcc8d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + cosF * wBase, cy + sinF * wBase);
    ctx.lineTo(cx + cosF * (r + 6), cy + sinF * (r + 6));
    ctx.stroke();
    // Tapered tip
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + cosF * (r + 6), cy + sinF * (r + 6));
    ctx.lineTo(cx + cosF * (r + 9), cy + sinF * (r + 9));
    ctx.stroke();
    // Crossguard
    if (!isFlash) {
      ctx.strokeStyle = '#887';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + cosF * wBase + perpCos * 3, cy + sinF * wBase + perpSin * 3);
      ctx.lineTo(cx + cosF * wBase - perpCos * 3, cy + sinF * wBase - perpSin * 3);
      ctx.stroke();
    }

  } else if (t.typeKey === 'archer') {
    // Small bow arc on the facing side
    ctx.strokeStyle = isFlash ? '#fff' : '#8B4513';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + cosF * (r + 2), cy + sinF * (r + 2), 7, t.facing + Math.PI / 2 - 1.0, t.facing + Math.PI / 2 + 1.0);
    ctx.stroke();
    // Bowstring
    if (!isFlash) {
      ctx.strokeStyle = '#c8a880';
      ctx.lineWidth = 0.7;
      const bowCx = cx + cosF * (r + 2);
      const bowCy = cy + sinF * (r + 2);
      ctx.beginPath();
      ctx.moveTo(bowCx + Math.cos(t.facing + Math.PI / 2 - 1.0) * 7, bowCy + Math.sin(t.facing + Math.PI / 2 - 1.0) * 7);
      ctx.lineTo(bowCx + Math.cos(t.facing + Math.PI / 2 + 1.0) * 7, bowCy + Math.sin(t.facing + Math.PI / 2 + 1.0) * 7);
      ctx.stroke();
    }

  } else if (t.typeKey === 'knight') {
    // Longer lance/spear: thin line with pointed tip
    ctx.strokeStyle = isFlash ? '#fff' : '#aab';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + cosF * wBase, cy + sinF * wBase);
    ctx.lineTo(cx + cosF * (r + 12), cy + sinF * (r + 12));
    ctx.stroke();
    // Pointed tip triangle
    if (!isFlash) {
      ctx.fillStyle = '#ccd';
      const tipX = cx + cosF * (r + 12);
      const tipY = cy + sinF * (r + 12);
      ctx.beginPath();
      ctx.moveTo(tipX - perpCos * 2, tipY - perpSin * 2);
      ctx.lineTo(tipX + cosF * 4, tipY + sinF * 4);
      ctx.lineTo(tipX + perpCos * 2, tipY + perpSin * 2);
      ctx.closePath();
      ctx.fill();
    }

  } else if (t.typeKey === 'wizard') {
    // Staff with glowing orb at tip
    ctx.strokeStyle = isFlash ? '#fff' : '#8B6914';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + cosF * wBase, cy + sinF * wBase);
    ctx.lineTo(cx + cosF * (r + 8), cy + sinF * (r + 8));
    ctx.stroke();
    // Glowing orb
    if (!isFlash) {
      const orbX = cx + cosF * (r + 9);
      const orbY = cy + sinF * (r + 9);
      const orbGrad = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, 4);
      orbGrad.addColorStop(0, 'rgba(220,180,255,0.9)');
      orbGrad.addColorStop(0.5, 'rgba(160,80,255,0.5)');
      orbGrad.addColorStop(1, 'rgba(120,40,200,0)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath(); ctx.arc(orbX, orbY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0c0ff';
      ctx.beginPath(); ctx.arc(orbX, orbY, 1.2, 0, Math.PI * 2); ctx.fill();
    }

  } else if (t.typeKey === 'shredder') {
    // Thick cleaver/axe shape
    ctx.strokeStyle = isFlash ? '#fff' : '#999';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + cosF * wBase, cy + sinF * wBase);
    ctx.lineTo(cx + cosF * (r + 6), cy + sinF * (r + 6));
    ctx.stroke();
    // Axe head (wide wedge)
    if (!isFlash) {
      ctx.fillStyle = '#888';
      const axBase = r + 4;
      const axTip = r + 10;
      ctx.beginPath();
      ctx.moveTo(cx + cosF * axBase + perpCos * 1, cy + sinF * axBase + perpSin * 1);
      ctx.lineTo(cx + cosF * axTip + perpCos * 5, cy + sinF * axTip + perpSin * 5);
      ctx.lineTo(cx + cosF * axTip - perpCos * 1, cy + sinF * axTip - perpSin * 1);
      ctx.closePath();
      ctx.fill();
    }

  } else {
    // Fallback generic weapon line
    ctx.strokeStyle = isFlash ? '#fff' : '#aabbcc';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx + cosF * wBase, cy + sinF * wBase);
    ctx.lineTo(cx + cosF * (r + 5), cy + sinF * (r + 5));
    ctx.stroke();
    if (!isFlash) {
      ctx.fillStyle = '#ccdde8';
      ctx.beginPath();
      ctx.arc(cx + cosF * (r + 5), cy + sinF * (r + 5), 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Banner ---
  // Pole: thin dark line extending upward from head
  const poleX = cx + 2;
  const poleTop = cy - r - 18;
  const poleBottom = cy - r - 1;
  ctx.strokeStyle = '#554';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(poleX, poleBottom);
  ctx.lineTo(poleX, poleTop);
  ctx.stroke();
  // Pole knob
  ctx.fillStyle = '#776';
  ctx.beginPath();
  ctx.arc(poleX, poleTop, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Flag: bezier curve shape that waves with sin(time)
  const flagW = 11;
  const flagH = 7;
  const wave1 = Math.sin(time * 3.5 + cx * 0.05) * 2.5;
  const wave2 = Math.sin(time * 3.5 + cx * 0.05 + 1.2) * 1.8;
  ctx.beginPath();
  ctx.moveTo(poleX, poleTop);
  ctx.bezierCurveTo(poleX + flagW * 0.3, poleTop - 1 + wave1 * 0.3,
                     poleX + flagW * 0.7, poleTop + 1 + wave1 * 0.5,
                     poleX + flagW + wave1, poleTop + 1);
  ctx.bezierCurveTo(poleX + flagW * 0.8 + wave2, poleTop + flagH * 0.5,
                     poleX + flagW * 0.6 + wave2 * 0.5, poleTop + flagH * 0.8,
                     poleX + flagW + wave2 * 0.6, poleTop + flagH);
  ctx.lineTo(poleX, poleTop + flagH);
  ctx.closePath();
  ctx.fillStyle = flagColor;
  ctx.fill();
  // Flag highlight
  if (!isFlash) {
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.moveTo(poleX + 1, poleTop + 1);
    ctx.bezierCurveTo(poleX + flagW * 0.3, poleTop + wave1 * 0.2,
                       poleX + flagW * 0.6, poleTop + 1 + wave1 * 0.3,
                       poleX + flagW + wave1, poleTop + 2);
    ctx.lineTo(poleX + flagW + wave1, poleTop + 3);
    ctx.lineTo(poleX + 1, poleTop + 3);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Flag outline
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // HP bar
  if (t.hp < t.maxHP) {
    drawBar(cx - r, cy - r - 20, r * 2, 3, t.hp / t.maxHP, '#4a4', '#222');
  }

  ctx.restore();
}

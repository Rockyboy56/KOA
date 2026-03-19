import { FORT, GATES, BARRICADES } from '../config.js';
import { drawRect, drawBar, drawText, getCtx } from '../renderer.js';
import { dist } from '../utils/math.js';

// ---- Wall Creation ----

/** Create all 4 fort walls at the given upgrade level with HP scaled by hpMult. */
export function createBarricades(level = 0, hpMult = 1) {
  const def = BARRICADES[level];
  const maxHP = Math.round(def.hp * hpMult);
  const wt = FORT.wallThickness;

  return {
    north: {
      side: 'north',
      x: FORT.x, y: FORT.y, w: FORT.w, h: wt,
      hp: maxHP, maxHP, level, destroyed: false, rebuildTimer: 0, color: def.color,
      gateX: GATES.north.x, gateY: GATES.north.y, gateW: GATES.north.w, gateH: GATES.north.h,
    },
    south: {
      side: 'south',
      x: FORT.x, y: FORT.y + FORT.h - wt, w: FORT.w, h: wt,
      hp: maxHP, maxHP, level, destroyed: false, rebuildTimer: 0, color: def.color,
      gateX: GATES.south.x, gateY: GATES.south.y, gateW: GATES.south.w, gateH: GATES.south.h,
    },
    east: {
      side: 'east',
      x: FORT.x + FORT.w - wt, y: FORT.y, w: wt, h: FORT.h,
      hp: maxHP, maxHP, level, destroyed: false, rebuildTimer: 0, color: def.color,
      gateX: GATES.east.x, gateY: GATES.east.y, gateW: GATES.east.w, gateH: GATES.east.h,
    },
    west: {
      side: 'west',
      x: FORT.x, y: FORT.y, w: wt, h: FORT.h,
      hp: maxHP, maxHP, level, destroyed: false, rebuildTimer: 0, color: def.color,
      gateX: GATES.west.x, gateY: GATES.west.y, gateW: GATES.west.w, gateH: GATES.west.h,
    },
  };
}

// ---- Wall Damage / Repair ----

export function damageWall(wall, amount) {
  wall.hp -= amount;
  if (wall.hp <= 0) {
    wall.hp = 0;
    wall.destroyed = true;
    wall.rebuildTimer = 3.0;
  }
}

export function repairWall(wall, dt, gold) {
  const def = BARRICADES[wall.level];

  if (wall.destroyed) {
    wall.rebuildTimer -= dt;
    if (wall.rebuildTimer <= 0) {
      wall.destroyed = false;
      wall.hp = Math.round(wall.maxHP * 0.25);
    }
    return 0;
  }

  if (wall.hp >= wall.maxHP) return 0;

  const repairAmount = 50 * dt;
  const costPerHP = def.repairCostPerHP;
  const cost = Math.round(repairAmount * costPerHP);

  if (cost > gold && costPerHP > 0) return 0;

  wall.hp = Math.min(wall.maxHP, wall.hp + repairAmount);
  return cost;
}

// ---- Upgrade ----

export function upgradeBarricades(walls, newLevel, hpMult) {
  const def = BARRICADES[newLevel];
  const newMaxHP = Math.round(def.hp * hpMult);
  for (const side of ['north', 'south', 'east', 'west']) {
    const wall = walls[side];
    const ratio = wall.maxHP > 0 ? wall.hp / wall.maxHP : 1;
    wall.level = newLevel;
    wall.maxHP = newMaxHP;
    wall.hp = Math.round(newMaxHP * ratio);
    wall.color = def.color;
    if (wall.destroyed) {
      wall.destroyed = false;
      wall.hp = Math.round(newMaxHP * 0.25);
    }
  }
}

// ---- Nearest Wall ----

export function getNearestWall(walls, px, py) {
  let best = null;
  let bestDist = Infinity;
  let bestSide = null;
  for (const side of ['north', 'south', 'east', 'west']) {
    const wall = walls[side];
    const cx = Math.max(wall.x, Math.min(px, wall.x + wall.w));
    const cy = Math.max(wall.y, Math.min(py, wall.y + wall.h));
    const d = dist(px, py, cx, cy);
    if (d < bestDist) {
      bestDist = d;
      best = wall;
      bestSide = side;
    }
  }
  return { wall: best, dist: bestDist, side: bestSide };
}

// ---- Wall Segments (for collision & drawing) ----

export function getWallSegments(wall) {
  if (wall._segCache) return wall._segCache;
  wall._segCache = _computeWallSegments(wall);
  return wall._segCache;
}

function _computeWallSegments(wall) {
  if (wall.side === 'north' || wall.side === 'south') {
    const leftW = wall.gateX - wall.x;
    const rightX = wall.gateX + wall.gateW;
    const rightW = (wall.x + wall.w) - rightX;
    return [
      { x: wall.x, y: wall.y, w: leftW, h: wall.h },
      { x: rightX, y: wall.y, w: rightW, h: wall.h },
    ];
  } else {
    const topH = wall.gateY - wall.y;
    const bottomY = wall.gateY + wall.gateH;
    const bottomH = (wall.y + wall.h) - bottomY;
    return [
      { x: wall.x, y: wall.y, w: wall.w, h: topH },
      { x: wall.x, y: bottomY, w: wall.w, h: bottomH },
    ];
  }
}

// ---- Deterministic hash for stone variation ----
function _hash(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

// ---- Drawing ----

function drawWallSegment(ctx, seg, wall) {
  const pct = wall.hp / wall.maxHP;
  const isHoriz = (wall.side === 'north' || wall.side === 'south');

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(seg.x + 5, seg.y + 5);
  ctx.lineTo(seg.x + seg.w + 3, seg.y + 3);
  ctx.lineTo(seg.x + seg.w + 3, seg.y + seg.h + 3);
  ctx.lineTo(seg.x + 3, seg.y + seg.h + 5);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.rect(seg.x, seg.y, seg.w, seg.h);
  ctx.clip();

  // Base: warm stone gradient (lighter on top, darker on bottom)
  let baseGrad;
  if (isHoriz) {
    baseGrad = ctx.createLinearGradient(seg.x, seg.y, seg.x, seg.y + seg.h);
  } else {
    baseGrad = ctx.createLinearGradient(seg.x, seg.y, seg.x + seg.w, seg.y);
  }
  baseGrad.addColorStop(0, '#9a8a7a');
  baseGrad.addColorStop(0.3, '#8a7a6a');
  baseGrad.addColorStop(1, '#706050');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(seg.x, seg.y, seg.w, seg.h);

  // Stone blocks: 8-12 rounded rectangles with variation
  const brickW = 16;
  const brickH = 8;
  let row = 0;
  for (let by = seg.y; by < seg.y + seg.h; by += brickH) {
    const offset = (row % 2) * (brickW / 2);
    for (let bx = seg.x - brickW + offset; bx < seg.x + seg.w; bx += brickW) {
      const v = _hash(bx | 0, by | 0, 1);
      const shade = 0.38 + v * 0.2;
      const r = shade * 255 | 0;
      const g = (shade - 0.04) * 255 | 0;
      const b = (shade - 0.1) * 255 | 0;

      // Rounded stone block
      const sx = (bx + 1) | 0;
      const sy = (by + 1) | 0;
      const sw = brickW - 2;
      const sh = brickH - 2;
      const cr = 2;

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(sx + cr, sy);
      ctx.lineTo(sx + sw - cr, sy);
      ctx.arcTo(sx + sw, sy, sx + sw, sy + cr, cr);
      ctx.lineTo(sx + sw, sy + sh - cr);
      ctx.arcTo(sx + sw, sy + sh, sx + sw - cr, sy + sh, cr);
      ctx.lineTo(sx + cr, sy + sh);
      ctx.arcTo(sx, sy + sh, sx, sy + sh - cr, cr);
      ctx.lineTo(sx, sy + cr);
      ctx.arcTo(sx, sy, sx + cr, sy, cr);
      ctx.closePath();
      ctx.fill();

      // Highlight top edge
      ctx.fillStyle = 'rgba(255, 245, 220, 0.1)';
      ctx.fillRect(sx + 1, sy, sw - 2, 1);
    }
    row++;
  }

  // Dark mortar lines between blocks
  ctx.fillStyle = 'rgba(40, 30, 20, 0.25)';
  row = 0;
  for (let by = seg.y; by < seg.y + seg.h; by += brickH) {
    ctx.fillRect(seg.x, by | 0, seg.w, 1);
    const offset = (row % 2) * (brickW / 2);
    for (let bx = seg.x - brickW + offset; bx < seg.x + seg.w; bx += brickW) {
      ctx.fillRect(bx | 0, (by + 1) | 0, 1, brickH - 1);
    }
    row++;
  }

  // Moss patches at lower HP
  if (pct < 0.6) {
    const mossCount = Math.floor((1 - pct) * 8);
    for (let i = 0; i < mossCount; i++) {
      const mx = seg.x + _hash(i, seg.x, 70) * seg.w;
      const my = seg.y + seg.h * 0.6 + _hash(i, seg.y, 71) * seg.h * 0.35;
      ctx.fillStyle = `rgba(60, 100, 40, ${0.2 + _hash(i, seg.x, 72) * 0.15})`;
      ctx.beginPath();
      ctx.arc(mx, my, 2 + _hash(i, seg.x, 73) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  // Top highlight line
  ctx.strokeStyle = 'rgba(255, 245, 220, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (isHoriz) {
    ctx.moveTo(seg.x, seg.y + 0.5);
    ctx.lineTo(seg.x + seg.w, seg.y + 0.5);
  } else {
    ctx.moveTo(seg.x + 0.5, seg.y);
    ctx.lineTo(seg.x + 0.5, seg.y + seg.h);
  }
  ctx.stroke();

  // Bottom shadow line
  ctx.strokeStyle = 'rgba(30, 20, 10, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (isHoriz) {
    ctx.moveTo(seg.x, seg.y + seg.h - 0.5);
    ctx.lineTo(seg.x + seg.w, seg.y + seg.h - 0.5);
  } else {
    ctx.moveTo(seg.x + seg.w - 0.5, seg.y);
    ctx.lineTo(seg.x + seg.w - 0.5, seg.y + seg.h);
  }
  ctx.stroke();

  // Damage cracks: organic bezier paths, more at lower HP
  if (pct < 0.75) {
    ctx.strokeStyle = 'rgba(20, 15, 10, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(seg.x + 4, seg.y + seg.h * 0.3);
    ctx.quadraticCurveTo(
      seg.x + seg.w * 0.25, seg.y + seg.h * 0.35,
      seg.x + seg.w * 0.4, seg.y + seg.h * 0.5
    );
    ctx.quadraticCurveTo(
      seg.x + seg.w * 0.35, seg.y + seg.h * 0.6,
      seg.x + seg.w * 0.3, seg.y + seg.h * 0.7
    );
    ctx.stroke();
  }
  if (pct < 0.5) {
    ctx.strokeStyle = 'rgba(20, 15, 10, 0.7)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(seg.x + seg.w * 0.5, seg.y + 2);
    ctx.quadraticCurveTo(
      seg.x + seg.w * 0.55, seg.y + seg.h * 0.25,
      seg.x + seg.w * 0.6, seg.y + seg.h * 0.4
    );
    ctx.quadraticCurveTo(
      seg.x + seg.w * 0.52, seg.y + seg.h * 0.7,
      seg.x + seg.w * 0.45, seg.y + seg.h - 2
    );
    ctx.stroke();

    ctx.strokeStyle = 'rgba(20, 15, 10, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(seg.x + seg.w * 0.8, seg.y + seg.h * 0.2);
    ctx.quadraticCurveTo(
      seg.x + seg.w * 0.85, seg.y + seg.h * 0.4,
      seg.x + seg.w * 0.9, seg.y + seg.h * 0.6
    );
    ctx.stroke();
  }
  if (pct < 0.25) {
    // Heavy damage: dark holes showing through
    ctx.fillStyle = 'rgba(30,20,10,0.5)';
    const hx = seg.x + 4;
    const hy = seg.y + seg.h * 0.2;
    const hw = Math.min(seg.w - 8, 20);
    const hh = Math.min(10, seg.h * 0.2);
    ctx.beginPath();
    ctx.arc(hx + hw / 2, hy + hh / 2, Math.min(hw, hh) / 2, 0, Math.PI * 2);
    ctx.fill();

    const hx2 = seg.x + seg.w * 0.5;
    const hy2 = seg.y + seg.h * 0.6;
    ctx.beginPath();
    ctx.arc(hx2 + 6, hy2 + 4, 5, 0, Math.PI * 2);
    ctx.fill();

    // Wood splinter details
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 1.5;
    for (let si = 0; si < 4; si++) {
      const sx = seg.x + _hash(si, seg.x, 80) * seg.w;
      const sy = seg.y + _hash(si, seg.y, 81) * seg.h;
      const angle = _hash(si, 0, 82) * Math.PI;
      const len = 4 + _hash(si, 0, 83) * 6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
      ctx.stroke();
    }

    // Extra crack
    ctx.strokeStyle = 'rgba(10, 8, 5, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(seg.x + seg.w * 0.2, seg.y + seg.h * 0.5);
    ctx.quadraticCurveTo(
      seg.x + seg.w * 0.5, seg.y + seg.h * 0.25,
      seg.x + seg.w * 0.7, seg.y + seg.h * 0.3
    );
    ctx.quadraticCurveTo(
      seg.x + seg.w * 0.75, seg.y + seg.h * 0.55,
      seg.x + seg.w * 0.8, seg.y + seg.h * 0.8
    );
    ctx.stroke();
  }
}

function drawRubble(ctx, seg) {
  // Dust cloud behind rubble
  const cx = seg.x + seg.w / 2;
  const cy = seg.y + seg.h / 2;
  const dustR = Math.max(seg.w, seg.h) * 0.6;
  const dustGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, dustR);
  dustGrad.addColorStop(0, 'rgba(140, 120, 90, 0.2)');
  dustGrad.addColorStop(1, 'rgba(140, 120, 90, 0)');
  ctx.fillStyle = dustGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, dustR, 0, Math.PI * 2);
  ctx.fill();

  // Scattered rounded stone shapes
  const stoneColors = ['#776655', '#665544', '#887766', '#554433', '#8a7a6a'];
  const count = 12;
  const isWide = seg.w > seg.h;

  for (let i = 0; i < count; i++) {
    const t = i / count;
    let rx, ry;
    if (isWide) {
      rx = seg.x + t * seg.w + (_hash(i, 100, 1) - 0.5) * 14;
      ry = seg.y + (_hash(i, 100, 2) - 0.5) * seg.h * 1.5;
    } else {
      rx = seg.x + (_hash(i, 100, 1) - 0.5) * seg.w * 1.5;
      ry = seg.y + t * seg.h + (_hash(i, 100, 2) - 0.5) * 14;
    }
    const sr = 3 + _hash(i, 100, 3) * 6;

    // Stone with radial gradient
    const sGrad = ctx.createRadialGradient(rx - 1, ry - 1, 0, rx, ry, sr);
    const ci = i % stoneColors.length;
    sGrad.addColorStop(0, stoneColors[(ci + 1) % stoneColors.length]);
    sGrad.addColorStop(1, stoneColors[ci]);
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.arc(rx, ry, sr, 0, Math.PI * 2);
    ctx.fill();

    // Highlight on top
    ctx.fillStyle = 'rgba(255, 245, 220, 0.12)';
    ctx.beginPath();
    ctx.arc(rx - 1, ry - sr * 0.3, sr * 0.5, Math.PI, 0);
    ctx.fill();
  }

  // Broken wood pieces
  ctx.strokeStyle = '#7a5a3a';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const wx = isWide
      ? seg.x + _hash(i, 101, 1) * seg.w
      : seg.x + (_hash(i, 101, 1) - 0.3) * seg.w;
    const wy = isWide
      ? seg.y + (_hash(i, 101, 2) - 0.3) * seg.h
      : seg.y + _hash(i, 101, 2) * seg.h;
    const angle = _hash(i, 101, 3) * Math.PI;
    const len = 6 + _hash(i, 101, 4) * 8;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + Math.cos(angle) * len, wy + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function drawBattlements(ctx, wall, segments) {
  for (const seg of segments) {
    if (wall.side === 'north') {
      for (let bx = seg.x; bx < seg.x + seg.w - 10; bx += 24) {
        // Merlon as rounded shape
        const mx = (bx + 2) | 0;
        const my = seg.y - 8;
        const mw = 12;
        const mh = 10;
        const cr = 2;
        // Gradient fill
        const mGrad = ctx.createLinearGradient(mx, my, mx, my + mh);
        mGrad.addColorStop(0, '#998877');
        mGrad.addColorStop(1, '#776655');
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.moveTo(mx + cr, my);
        ctx.lineTo(mx + mw - cr, my);
        ctx.arcTo(mx + mw, my, mx + mw, my + cr, cr);
        ctx.lineTo(mx + mw, my + mh);
        ctx.lineTo(mx, my + mh);
        ctx.lineTo(mx, my + cr);
        ctx.arcTo(mx, my, mx + cr, my, cr);
        ctx.closePath();
        ctx.fill();
        // Top highlight
        ctx.fillStyle = 'rgba(255, 245, 220, 0.15)';
        ctx.fillRect(mx + 1, my, mw - 2, 2);
        // Bottom shadow
        ctx.fillStyle = 'rgba(30, 20, 10, 0.2)';
        ctx.fillRect(mx, my + mh - 2, mw, 2);
      }
    } else if (wall.side === 'south') {
      for (let bx = seg.x; bx < seg.x + seg.w - 10; bx += 24) {
        const mx = (bx + 2) | 0;
        const my = seg.y + seg.h - 2;
        const mw = 12;
        const mh = 10;
        const cr = 2;
        const mGrad = ctx.createLinearGradient(mx, my, mx, my + mh);
        mGrad.addColorStop(0, '#998877');
        mGrad.addColorStop(1, '#776655');
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + mw, my);
        ctx.lineTo(mx + mw, my + mh - cr);
        ctx.arcTo(mx + mw, my + mh, mx + mw - cr, my + mh, cr);
        ctx.lineTo(mx + cr, my + mh);
        ctx.arcTo(mx, my + mh, mx, my + mh - cr, cr);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 245, 220, 0.12)';
        ctx.fillRect(mx + 1, my, mw - 2, 2);
      }
    } else if (wall.side === 'east') {
      for (let by = seg.y; by < seg.y + seg.h - 10; by += 24) {
        const mx = seg.x + seg.w - 2;
        const my = (by + 2) | 0;
        const mw = 10;
        const mh = 12;
        const cr = 2;
        const mGrad = ctx.createLinearGradient(mx, my, mx + mw, my);
        mGrad.addColorStop(0, '#998877');
        mGrad.addColorStop(1, '#776655');
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + mw - cr, my);
        ctx.arcTo(mx + mw, my, mx + mw, my + cr, cr);
        ctx.lineTo(mx + mw, my + mh - cr);
        ctx.arcTo(mx + mw, my + mh, mx + mw - cr, my + mh, cr);
        ctx.lineTo(mx, my + mh);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 245, 220, 0.12)';
        ctx.fillRect(mx, my + 1, 2, mh - 2);
      }
    } else if (wall.side === 'west') {
      for (let by = seg.y; by < seg.y + seg.h - 10; by += 24) {
        const mx = seg.x - 8;
        const my = (by + 2) | 0;
        const mw = 10;
        const mh = 12;
        const cr = 2;
        const mGrad = ctx.createLinearGradient(mx, my, mx + mw, my);
        mGrad.addColorStop(0, '#776655');
        mGrad.addColorStop(1, '#998877');
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.moveTo(mx + cr, my);
        ctx.lineTo(mx + mw, my);
        ctx.lineTo(mx + mw, my + mh);
        ctx.lineTo(mx + cr, my + mh);
        ctx.arcTo(mx, my + mh, mx, my + mh - cr, cr);
        ctx.lineTo(mx, my + cr);
        ctx.arcTo(mx, my, mx + cr, my, cr);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 245, 220, 0.12)';
        ctx.fillRect(mx + mw - 2, my + 1, 2, mh - 2);
      }
    }
  }
}

function drawGateArchway(ctx, wall) {
  const wt = FORT.wallThickness;

  // Helper to draw a stone pillar with gradient
  function drawPillar(px, py, pw, ph, lightSide) {
    const pGrad = lightSide === 'left'
      ? ctx.createLinearGradient(px, py, px + pw, py)
      : ctx.createLinearGradient(px + pw, py, px, py);
    pGrad.addColorStop(0, '#6a5a4a');
    pGrad.addColorStop(0.5, '#554433');
    pGrad.addColorStop(1, '#443322');
    ctx.fillStyle = pGrad;
    ctx.fillRect(px, py, pw, ph);
    // Highlight line on the lighter side
    ctx.fillStyle = 'rgba(255, 245, 220, 0.12)';
    if (lightSide === 'left') {
      ctx.fillRect(px, py, 1.5, ph);
    } else {
      ctx.fillRect(px + pw - 1.5, py, 1.5, ph);
    }
  }

  // Helper to draw the keystone
  function drawKeystone(kx, ky, kw, kh) {
    // Trapezoidal shape
    ctx.fillStyle = '#776655';
    ctx.beginPath();
    ctx.moveTo(kx + 2, ky);
    ctx.lineTo(kx + kw - 2, ky);
    ctx.lineTo(kx + kw, ky + kh);
    ctx.lineTo(kx, ky + kh);
    ctx.closePath();
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255, 245, 220, 0.18)';
    ctx.fillRect(kx + 2, ky, kw - 4, 2);
  }

  // Portcullis bars
  function drawPortcullis(gx, gy, gw, gh, isVertical) {
    if (wall.destroyed) return;
    ctx.strokeStyle = 'rgba(80, 80, 90, 0.6)';
    ctx.lineWidth = 2;
    if (!isVertical) {
      // Horizontal gate: vertical bars
      for (let bx = gx + 6; bx < gx + gw - 4; bx += 10) {
        const barGrad = ctx.createLinearGradient(bx - 1, gy, bx + 1, gy);
        barGrad.addColorStop(0, 'rgba(120, 120, 130, 0.7)');
        barGrad.addColorStop(0.5, 'rgba(180, 180, 190, 0.5)');
        barGrad.addColorStop(1, 'rgba(100, 100, 110, 0.7)');
        ctx.strokeStyle = barGrad;
        ctx.beginPath();
        ctx.moveTo(bx, gy + 2);
        ctx.lineTo(bx, gy + gh - 2);
        ctx.stroke();
      }
    } else {
      // Vertical gate: horizontal bars
      for (let by = gy + 6; by < gy + gh - 4; by += 10) {
        const barGrad = ctx.createLinearGradient(gx, by - 1, gx, by + 1);
        barGrad.addColorStop(0, 'rgba(120, 120, 130, 0.7)');
        barGrad.addColorStop(0.5, 'rgba(180, 180, 190, 0.5)');
        barGrad.addColorStop(1, 'rgba(100, 100, 110, 0.7)');
        ctx.strokeStyle = barGrad;
        ctx.beginPath();
        ctx.moveTo(gx + 2, by);
        ctx.lineTo(gx + wt - 2, by);
        ctx.stroke();
      }
    }
  }

  if (wall.side === 'north') {
    drawPillar(wall.gateX - 6, wall.y - 4, 6, wt + 8, 'right');
    drawPillar(wall.gateX + wall.gateW, wall.y - 4, 6, wt + 8, 'left');
    // Lintel
    const lGrad = ctx.createLinearGradient(wall.gateX, wall.y - 4, wall.gateX, wall.y + 2);
    lGrad.addColorStop(0, '#6a5a4a');
    lGrad.addColorStop(1, '#554433');
    ctx.fillStyle = lGrad;
    ctx.fillRect(wall.gateX - 6, wall.y - 4, wall.gateW + 12, 6);
    drawKeystone(wall.gateX + wall.gateW / 2 - 5, wall.y - 6, 10, 6);
    drawPortcullis(wall.gateX, wall.y, wall.gateW, wt, false);
  } else if (wall.side === 'south') {
    drawPillar(wall.gateX - 6, wall.y - 4, 6, wt + 8, 'right');
    drawPillar(wall.gateX + wall.gateW, wall.y - 4, 6, wt + 8, 'left');
    const lGrad = ctx.createLinearGradient(wall.gateX, wall.y + wt - 2, wall.gateX, wall.y + wt + 4);
    lGrad.addColorStop(0, '#554433');
    lGrad.addColorStop(1, '#6a5a4a');
    ctx.fillStyle = lGrad;
    ctx.fillRect(wall.gateX - 6, wall.y + wt - 2, wall.gateW + 12, 6);
    drawKeystone(wall.gateX + wall.gateW / 2 - 5, wall.y + wt - 2, 10, 6);
    drawPortcullis(wall.gateX, wall.y, wall.gateW, wt, false);
  } else if (wall.side === 'east') {
    drawPillar(wall.gateX - 4, wall.gateY - 6, wt + 8, 6, 'left');
    drawPillar(wall.gateX - 4, wall.gateY + wall.gateH, wt + 8, 6, 'left');
    const lGrad = ctx.createLinearGradient(wall.gateX + wt - 2, wall.gateY, wall.gateX + wt + 4, wall.gateY);
    lGrad.addColorStop(0, '#554433');
    lGrad.addColorStop(1, '#6a5a4a');
    ctx.fillStyle = lGrad;
    ctx.fillRect(wall.gateX + wt - 2, wall.gateY - 6, 6, wall.gateH + 12);
    drawKeystone(wall.gateX + wt - 2, wall.gateY + wall.gateH / 2 - 5, 6, 10);
    drawPortcullis(wall.gateX, wall.gateY, wt, wall.gateH, true);
  } else if (wall.side === 'west') {
    drawPillar(wall.gateX - 4, wall.gateY - 6, wt + 8, 6, 'right');
    drawPillar(wall.gateX - 4, wall.gateY + wall.gateH, wt + 8, 6, 'right');
    const lGrad = ctx.createLinearGradient(wall.gateX - 4, wall.gateY, wall.gateX + 2, wall.gateY);
    lGrad.addColorStop(0, '#6a5a4a');
    lGrad.addColorStop(1, '#554433');
    ctx.fillStyle = lGrad;
    ctx.fillRect(wall.gateX - 4, wall.gateY - 6, 6, wall.gateH + 12);
    drawKeystone(wall.gateX - 4, wall.gateY + wall.gateH / 2 - 5, 6, 10);
    drawPortcullis(wall.gateX, wall.gateY, wt, wall.gateH, true);
  }
}

/** Draw all 4 fort walls with gate archways, battlements, cracks, and rubble. */
export function drawBarricades(walls) {
  const ctx = getCtx();

  for (const side of ['north', 'south', 'east', 'west']) {
    const wall = walls[side];
    if (!wall) continue;

    const segments = getWallSegments(wall);

    if (wall.destroyed) {
      for (const seg of segments) {
        drawRubble(ctx, seg);
      }
      const labelX = wall.gateX + (wall.gateW || 0) / 2;
      const labelY = wall.gateY + (wall.gateH || 0) / 2;
      drawText('DESTROYED', labelX - 30, labelY - 5, 8, '#f44');
    } else {
      for (const seg of segments) {
        drawWallSegment(ctx, seg, wall);
      }

      drawBattlements(ctx, wall, segments);
      drawGateArchway(ctx, wall);

      const pct = wall.hp / wall.maxHP;
      const barColor = pct > 0.5 ? '#4a4' : pct > 0.25 ? '#aa4' : '#a44';
      if (wall.side === 'north' || wall.side === 'south') {
        drawBar(wall.gateX, wall.y - 12, wall.gateW, 6, pct, barColor, '#222');
      } else {
        drawBar(wall.gateX - 10, wall.gateY - 12, wall.gateH, 6, pct, barColor, '#222');
      }
    }
  }
}

import { getCtx } from '../renderer.js';
import { drawBar } from '../renderer.js';

/**
 * Draw a troop as a top-down painted sprite matching the player style.
 * Blue/gold tabard, spear pointing in troop.facing direction.
 * Called after camera transform is applied — uses world coordinates.
 */
export function drawTroop(t) {
  if (!t.alive) return;

  const ctx = getCtx();
  ctx.save();

  const isFlash = t.flashTimer > 0 && Math.floor(t.flashTimer * 20) % 2;
  const cx = (t.x + t.width / 2) | 0;
  const cy = (t.y + t.height / 2) | 0;
  const r = Math.max(t.width, t.height) / 2;
  const time = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;

  // Flag colors per type
  const flagColors = {
    footman: '#4488dd', archer: '#44aa44', knight: '#8844aa',
    wizard: '#cc44cc', shredder: '#ccaa22',
  };
  const flagColor = flagColors[t.typeKey] || '#4488dd';

  // Drop shadow
  ctx.save();
  ctx.translate(cx, cy + r + 2); ctx.scale(1.3, 0.3);
  const shGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  shGrad.addColorStop(0, 'rgba(0,0,0,0.3)'); shGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shGrad;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Body — rotate to facing direction (same top-down approach as player)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t.facing);
  _drawTroopBody(ctx, t, r, time, isFlash);
  ctx.restore();

  // Banner pole + waving flag (world space, above head)
  const poleX = cx + 2;
  const poleTop = cy - r - 18;
  const poleBottom = cy - r - 1;
  ctx.strokeStyle = '#554'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(poleX, poleBottom); ctx.lineTo(poleX, poleTop); ctx.stroke();
  ctx.fillStyle = '#776'; ctx.beginPath(); ctx.arc(poleX, poleTop, 1.2, 0, Math.PI * 2); ctx.fill();

  const flagW = 11, flagH = 7;
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
  ctx.fillStyle = flagColor; ctx.fill();

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
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.5; ctx.stroke();

  // HP bar
  if (t.hp < t.maxHP) {
    drawBar(cx - r, cy - r - 20, r * 2, 3, t.hp / t.maxHP, '#4a4', '#222');
  }

  ctx.restore();
}

function _drawTroopBody(ctx, t, r, time, isFlash) {
  const tk = t.typeKey;

  // Body oval — blue/silver gradient, top-down style
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.85, r * 0.7, 0, 0, Math.PI * 2);
  if (!isFlash) {
    const bodyGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 0.85);
    bodyGrad.addColorStop(0, '#9ab8d8');
    bodyGrad.addColorStop(0.5, '#5880a8');
    bodyGrad.addColorStop(1, '#3a5a78');
    ctx.fillStyle = bodyGrad;
  } else { ctx.fillStyle = '#fff'; }
  ctx.strokeStyle = isFlash ? '#ddd' : 'rgba(20,40,70,0.7)'; ctx.lineWidth = 2;
  ctx.fill(); ctx.stroke();

  // Helmet dome (front, +X direction)
  ctx.fillStyle = isFlash ? '#fff' : '#7090b8';
  ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = isFlash ? '#ddd' : '#4060a0'; ctx.lineWidth = 1.2; ctx.stroke();
  if (!isFlash) {
    ctx.strokeStyle = 'rgba(180,210,240,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.15, r * 0.25, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke();
  }

  // Gold tabard stripe (chest line)
  if (!isFlash) {
    ctx.strokeStyle = '#c8a830'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.25); ctx.lineTo(r * 0.2, -r * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.25); ctx.lineTo(r * 0.2, r * 0.25); ctx.stroke();
  }

  // Small shield on left side (−Y)
  if (tk !== 'archer' && tk !== 'wizard') {
    ctx.fillStyle = isFlash ? '#fff' : '#3465a8';
    ctx.strokeStyle = '#1a3560'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6); ctx.lineTo(r * 0.2, -r * 0.6);
    ctx.lineTo(r * 0.35, -r * 0.3); ctx.lineTo(r * 0.2, 0);
    ctx.lineTo(0, -r * 0.1); ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (!isFlash) {
      ctx.strokeStyle = '#c8a830'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.55); ctx.lineTo(r * 0.1, -r * 0.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -r * 0.32); ctx.lineTo(r * 0.32, -r * 0.32); ctx.stroke();
    }
  }

  // Weapon / tool (right side, +Y direction, points forward)
  const cosF = Math.cos(0); // already rotated by facing, so local +X = forward
  const sinF = Math.sin(0);

  if (tk === 'footman') {
    // Short sword extending forward-right
    ctx.strokeStyle = isFlash ? '#fff' : '#bcc8d4'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(r * 0.4, r * 0.2); ctx.lineTo(r + 6, r * 0.2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r + 6, r * 0.2); ctx.lineTo(r + 9, r * 0.2); ctx.stroke();
    if (!isFlash) {
      ctx.strokeStyle = '#887'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(r * 0.4, r * 0.1); ctx.lineTo(r * 0.4, r * 0.35); ctx.stroke();
    }

  } else if (tk === 'archer') {
    // Bow arc on right side
    ctx.strokeStyle = isFlash ? '#fff' : '#8B4513'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r + 2, 0, 7, Math.PI / 2 - 1.0, Math.PI / 2 + 1.0); ctx.stroke();
    if (!isFlash) {
      const bowCx = r + 2, bowCy = 0;
      ctx.strokeStyle = '#c8a880'; ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(bowCx + Math.cos(Math.PI / 2 - 1.0) * 7, bowCy + Math.sin(Math.PI / 2 - 1.0) * 7);
      ctx.lineTo(bowCx + Math.cos(Math.PI / 2 + 1.0) * 7, bowCy + Math.sin(Math.PI / 2 + 1.0) * 7);
      ctx.stroke();
    }

  } else if (tk === 'knight') {
    // Lance/spear — longer
    ctx.strokeStyle = isFlash ? '#fff' : '#aab'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.25); ctx.lineTo(r + 14, r * 0.25); ctx.stroke();
    if (!isFlash) {
      ctx.fillStyle = '#ccd';
      ctx.beginPath();
      ctx.moveTo(r + 11, r * 0.1); ctx.lineTo(r + 15, r * 0.25); ctx.lineTo(r + 11, r * 0.4);
      ctx.closePath(); ctx.fill();
    }

  } else if (tk === 'wizard') {
    // Staff with glowing orb
    ctx.strokeStyle = isFlash ? '#fff' : '#8B6914'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.2); ctx.lineTo(r + 8, r * 0.2); ctx.stroke();
    if (!isFlash) {
      const orbX = r + 9, orbY = r * 0.2;
      const orbGrad = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, 4);
      orbGrad.addColorStop(0, 'rgba(220,180,255,0.9)');
      orbGrad.addColorStop(0.5, 'rgba(160,80,255,0.5)');
      orbGrad.addColorStop(1, 'rgba(120,40,200,0)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath(); ctx.arc(orbX, orbY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0c0ff';
      ctx.beginPath(); ctx.arc(orbX, orbY, 1.2, 0, Math.PI * 2); ctx.fill();
    }

  } else if (tk === 'shredder') {
    // Axe/cleaver
    ctx.strokeStyle = isFlash ? '#fff' : '#999'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.2); ctx.lineTo(r + 6, r * 0.2); ctx.stroke();
    if (!isFlash) {
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.moveTo(r + 4, 0); ctx.lineTo(r + 10, r * 0.5); ctx.lineTo(r + 7, r * 0.55); ctx.closePath();
      ctx.fill();
    }

  } else {
    // Fallback spear
    ctx.strokeStyle = isFlash ? '#fff' : '#aabbcc'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.2); ctx.lineTo(r + 5, r * 0.2); ctx.stroke();
    if (!isFlash) {
      ctx.fillStyle = '#ccdde8';
      ctx.beginPath(); ctx.arc(r + 5, r * 0.2, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

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

  if (tk === 'footman') {
    // ── Footman: brown leather base, blue tabard, round helmet, spear ──
    // Leather body
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.85, r * 0.7, 0, 0, Math.PI * 2);
    if (!isFlash) {
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 0.85);
      g.addColorStop(0, '#b08860'); g.addColorStop(0.5, '#8a6840'); g.addColorStop(1, '#5a3820');
      ctx.fillStyle = g;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = isFlash ? '#ddd' : '#1a1a1a'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    // Blue tabard overlay
    if (!isFlash) {
      ctx.fillStyle = '#4488dd';
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.52, r * 0.46, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2255aa'; ctx.lineWidth = 1; ctx.stroke();
    }
    // Round helmet (forward dome)
    ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = isFlash ? '#fff' : '#8090a8'; ctx.fill();
    ctx.strokeStyle = isFlash ? '#ddd' : '#1a1a1a'; ctx.lineWidth = 1.5; ctx.stroke();
    if (!isFlash) {
      ctx.strokeStyle = 'rgba(200,220,255,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(r * 0.18, -r * 0.14, r * 0.22, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke();
    }
    // Spear: long shaft + triangle tip pointing forward (+X)
    ctx.strokeStyle = isFlash ? '#fff' : '#8B6914'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.15); ctx.lineTo(r + 13, r * 0.15); ctx.stroke();
    if (!isFlash) {
      ctx.fillStyle = '#ccd8e0';
      ctx.beginPath();
      ctx.moveTo(r + 10, r * 0.04); ctx.lineTo(r + 17, r * 0.15); ctx.lineTo(r + 10, r * 0.26);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.8; ctx.stroke();
    }

  } else if (tk === 'archer') {
    // ── Archer: green tunic, green hood, bow on side, quiver on back ──
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.8, r * 0.65, 0, 0, Math.PI * 2);
    if (!isFlash) {
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 0.8);
      g.addColorStop(0, '#70c060'); g.addColorStop(0.5, '#4a9040'); g.addColorStop(1, '#2a6020');
      ctx.fillStyle = g;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = isFlash ? '#ddd' : '#1a1a1a'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    // Green hood (rounded triangle pointing forward)
    if (!isFlash) {
      ctx.fillStyle = '#3a7030';
      ctx.beginPath();
      ctx.moveTo(r * 0.0, -r * 0.38);
      ctx.bezierCurveTo(r * 0.55, -r * 0.52, r * 0.82, -r * 0.08, r * 0.62, r * 0.3);
      ctx.bezierCurveTo(r * 0.4, r * 0.42, -r * 0.1, r * 0.38, -r * 0.12, r * 0.18);
      ctx.bezierCurveTo(-r * 0.18, -r * 0.08, -r * 0.12, -r * 0.32, r * 0.0, -r * 0.38);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    // Quiver rectangle on back (−X side)
    if (!isFlash) {
      ctx.fillStyle = '#8B4513';
      ctx.beginPath(); ctx.rect(-r * 0.72, -r * 0.22, r * 0.26, r * 0.44); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = '#c8a030'; ctx.lineWidth = 0.8;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(-r * 0.58, i * r * 0.09); ctx.lineTo(-r * 0.72, i * r * 0.09); ctx.stroke();
      }
    }
    // Bow arc on right (+Y) side
    ctx.strokeStyle = isFlash ? '#fff' : '#8B4513'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r * 0.2, r * 0.58, 8, -Math.PI * 0.6, Math.PI * 0.6); ctx.stroke();
    if (!isFlash) {
      ctx.strokeStyle = '#c8a880'; ctx.lineWidth = 0.7;
      const bx = r * 0.2, by = r * 0.58;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(-Math.PI * 0.6) * 8, by + Math.sin(-Math.PI * 0.6) * 8);
      ctx.lineTo(bx + Math.cos(Math.PI * 0.6) * 8, by + Math.sin(Math.PI * 0.6) * 8);
      ctx.stroke();
    }

  } else if (tk === 'knight') {
    // ── Knight: gold-trimmed grey armor, gold visor helmet, sword ──
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.92, r * 0.76, 0, 0, Math.PI * 2);
    if (!isFlash) {
      const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r * 0.92);
      g.addColorStop(0, '#d0c0a0'); g.addColorStop(0.5, '#a09080'); g.addColorStop(1, '#706050');
      ctx.fillStyle = g;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = isFlash ? '#ddd' : '#1a1a1a'; ctx.lineWidth = 2.5;
    ctx.fill(); ctx.stroke();
    // Gold trim bands
    if (!isFlash) {
      ctx.strokeStyle = '#c8a830'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(r * 0.42, -r * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.3); ctx.lineTo(r * 0.42, r * 0.3); ctx.stroke();
    }
    // Helmet dome
    ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.44, 0, Math.PI * 2);
    ctx.fillStyle = isFlash ? '#fff' : '#9898a8'; ctx.fill();
    ctx.strokeStyle = isFlash ? '#ddd' : '#1a1a1a'; ctx.lineWidth = 1.5; ctx.stroke();
    if (!isFlash) {
      ctx.strokeStyle = '#c8a830'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.1); ctx.lineTo(r * 0.62, -r * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.1); ctx.lineTo(r * 0.62, r * 0.1); ctx.stroke();
    }
    // Shield on left (−Y)
    if (!isFlash) {
      ctx.fillStyle = '#3465a8';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.65); ctx.lineTo(r * 0.22, -r * 0.65);
      ctx.lineTo(r * 0.4, -r * 0.32); ctx.lineTo(r * 0.22, 0);
      ctx.lineTo(0, -r * 0.1); ctx.closePath();
      ctx.fill(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = '#c8a830'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.6); ctx.lineTo(r * 0.1, -r * 0.08); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.5, -r * 0.34); ctx.lineTo(r * 0.36, -r * 0.34); ctx.stroke();
    }
    // Sword extended forward
    ctx.strokeStyle = isFlash ? '#fff' : '#c8d4e0'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.18); ctx.lineTo(r + 14, r * 0.18); ctx.stroke();
    if (!isFlash) {
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(r + 14, r * 0.18); ctx.lineTo(r + 18, r * 0.18); ctx.stroke();
      ctx.strokeStyle = '#c8a830'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(r * 0.38, r * 0.06); ctx.lineTo(r * 0.38, r * 0.3); ctx.stroke();
    }

  } else if (tk === 'crossbowman') {
    // ── Crossbowman: brown leather, leather cap, T-shaped crossbow ──
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.82, r * 0.67, 0, 0, Math.PI * 2);
    if (!isFlash) {
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 0.82);
      g.addColorStop(0, '#b08860'); g.addColorStop(0.5, '#8a6840'); g.addColorStop(1, '#6a4820');
      ctx.fillStyle = g;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = isFlash ? '#ddd' : '#1a1a1a'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = isFlash ? '#fff' : '#9a7040'; ctx.fill();
    ctx.strokeStyle = isFlash ? '#ddd' : '#1a1a1a'; ctx.lineWidth = 1.2; ctx.stroke();
    // T-shaped crossbow: stock (shaft) + prod (perpendicular bow bar)
    ctx.strokeStyle = isFlash ? '#fff' : '#8B4513'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.18); ctx.lineTo(r + 10, r * 0.18); ctx.stroke();
    if (!isFlash) {
      ctx.strokeStyle = '#6a3510'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(r + 4, r * 0.18 - 7); ctx.lineTo(r + 4, r * 0.18 + 7); ctx.stroke();
      ctx.strokeStyle = '#c8a880'; ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(r + 4, r * 0.18 - 7); ctx.lineTo(r + 10, r * 0.18); ctx.lineTo(r + 4, r * 0.18 + 7);
      ctx.stroke();
    }

  } else if (tk === 'wizard') {
    // ── Wizard: wide blue robes, dome head, pointed hat, cyan staff orb ──
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.92, r * 0.8, 0, 0, Math.PI * 2);
    if (!isFlash) {
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 0.92);
      g.addColorStop(0, '#8090d8'); g.addColorStop(0.5, '#5060b0'); g.addColorStop(1, '#303878');
      ctx.fillStyle = g;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = isFlash ? '#ddd' : '#1a1a1a'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    if (!isFlash) {
      // Robe rune lines
      ctx.strokeStyle = 'rgba(160,200,255,0.35)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-r * 0.12, -r * 0.22); ctx.lineTo(-r * 0.12, r * 0.22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.32, 0); ctx.lineTo(r * 0.08, 0); ctx.stroke();
    }
    // Dome head
    ctx.beginPath(); ctx.arc(r * 0.28, 0, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = isFlash ? '#fff' : '#7888c8'; ctx.fill();
    ctx.strokeStyle = isFlash ? '#ddd' : '#1a1a1a'; ctx.lineWidth = 1.5; ctx.stroke();
    // Pointed hat (triangle rising from head center, tilted back)
    if (!isFlash) {
      ctx.fillStyle = '#4050a0';
      ctx.beginPath();
      ctx.moveTo(r * 0.28 - r * 0.3, 0);
      ctx.lineTo(r * 0.28 + r * 0.3, 0);
      ctx.lineTo(r * 0.2, -r * 0.95);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#a0c0ff';
      ctx.beginPath(); ctx.arc(r * 0.24, -r * 0.52, 2, 0, Math.PI * 2); ctx.fill();
    }
    // Staff with cyan glowing orb
    ctx.strokeStyle = isFlash ? '#fff' : '#8B6914'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.2); ctx.lineTo(r + 8, r * 0.2); ctx.stroke();
    if (!isFlash) {
      const ox = r + 9, oy = r * 0.2;
      const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, 5);
      og.addColorStop(0, 'rgba(180,255,255,0.95)');
      og.addColorStop(0.4, 'rgba(0,200,220,0.6)');
      og.addColorStop(1, 'rgba(0,150,180,0)');
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0ffff';
      ctx.beginPath(); ctx.arc(ox, oy, 1.5, 0, Math.PI * 2); ctx.fill();
    }

  } else {
    // ── Shredder / generic fallback ──
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.88, r * 0.72, 0, 0, Math.PI * 2);
    if (!isFlash) {
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 0.88);
      g.addColorStop(0, '#aaa898'); g.addColorStop(0.5, '#807870'); g.addColorStop(1, '#504840');
      ctx.fillStyle = g;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = isFlash ? '#ddd' : '#1a1a1a'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = isFlash ? '#fff' : '#7090b8'; ctx.fill();
    ctx.strokeStyle = isFlash ? '#ddd' : '#1a1a1a'; ctx.lineWidth = 1.2; ctx.stroke();
    // Heavy axe
    ctx.strokeStyle = isFlash ? '#fff' : '#999'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(r * 0.3, r * 0.2); ctx.lineTo(r + 6, r * 0.2); ctx.stroke();
    if (!isFlash) {
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.moveTo(r + 4, r * 0.2 - 5); ctx.lineTo(r + 11, r * 0.2 + 6); ctx.lineTo(r + 7, r * 0.2 + 7);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.8; ctx.stroke();
    }
  }
}

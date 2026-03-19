import { getCtx } from '../renderer.js';
import { drawBar } from '../renderer.js';

/**
 * Draw an enemy entity as a top-down painted sprite.
 * All enemy types have: drop shadow, bold outline, gradient fill.
 * Called after camera transform is applied — uses world coordinates.
 */
export function drawEnemy(e) {
  const ctx = getCtx();
  ctx.save();

  const isFlash = e.flashTimer > 0 && Math.floor(e.flashTimer * 20) % 2;
  const cx = (e.x + e.width / 2) | 0;
  const cy = (e.y + e.height / 2) | 0;
  const r = Math.max(e.width, e.height) / 2;

  // Death fade-out
  if (!e.alive) {
    if (e.deathTimer > 0) {
      const alpha = e.deathTimer / 0.3;
      const sz = r * alpha;
      ctx.globalAlpha = alpha;
      const dGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz);
      dGrad.addColorStop(0, e.color);
      dGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dGrad;
      ctx.beginPath(); ctx.arc(cx, cy, sz, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return;
  }

  const t = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
  const tk = e.typeKey;

  // Walking bob
  const walkBob = (Math.sin(e.walkPhase) * 1.5) | 0;

  // Attack lunge animation
  const lungeMax = (tk === 'ogre' || tk === 'ogreSoldier' || tk === 'titan') ? 8 : 5;
  const lungeOffset = e.attackAnim > 0 ? (e.attackAnim * lungeMax) | 0 : 0;
  const drawCx = (cx + Math.cos(e.facing) * lungeOffset) | 0;
  const drawCy = (cy + walkBob + Math.sin(e.facing) * lungeOffset) | 0;

  // Knockback afterimages
  if (e.knockbackTrail > 0) {
    const trailCount = Math.min(3, Math.ceil(e.knockbackTrail));
    for (let i = 1; i <= trailCount; i++) {
      const trailAlpha = 0.15 * (1 - i / (trailCount + 1)) * (e.knockbackTrail / 3);
      ctx.globalAlpha = trailAlpha;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(drawCx + Math.cos(e.facing) * i * 4, drawCy + Math.sin(e.facing) * i * 4, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Titan: pulsing red aura (world space, before body)
  if (tk === 'titan') {
    const auraR = r + 10 + Math.sin(t * 3) * 4;
    const auraAlpha = 0.08 + 0.06 * Math.sin(t * 4);
    const auraGrad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, auraR);
    auraGrad.addColorStop(0, `rgba(255,40,40,${auraAlpha * 1.5})`);
    auraGrad.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath(); ctx.arc(cx, cy, auraR, 0, Math.PI * 2); ctx.fill();
    const ringAlpha = 0.15 + 0.12 * Math.sin(t * 4);
    ctx.strokeStyle = `rgba(200,40,40,${ringAlpha})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, auraR - 2, 0, Math.PI * 2); ctx.stroke();
  }

  // Drop shadow
  ctx.save();
  ctx.translate(cx, cy + r + 2); ctx.scale(1.3, 0.32);
  const shGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  shGrad.addColorStop(0, 'rgba(0,0,0,0.32)'); shGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shGrad;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Per-type sprite (rotated to face direction)
  ctx.save();
  ctx.translate(drawCx, drawCy);
  ctx.rotate(e.facing);
  _drawEnemyType(ctx, e, tk, r, t, isFlash);
  ctx.restore();

  // Bomber fuse spark (world space, after body)
  if (tk === 'bomber') {
    const fuseRate = e.fuseTimer < 2 ? 12 : 5;
    const fusePulse = Math.sin((e.fuseTimer || t) * fuseRate * Math.PI);
    const backX = cx - Math.cos(e.facing) * (r * 0.6);
    const backY = cy - Math.sin(e.facing) * (r * 0.6);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(backX, backY);
    ctx.quadraticCurveTo(backX + 2, backY - 5, backX, backY - 8); ctx.stroke();
    const sparkR = 3 + fusePulse * 2;
    const sparkAlpha = 0.6 + fusePulse * 0.4;
    const sparkGrad = ctx.createRadialGradient(backX, backY - 9, 0, backX, backY - 9, sparkR + 3);
    sparkGrad.addColorStop(0, `rgba(255,220,80,${sparkAlpha})`);
    sparkGrad.addColorStop(0.5, `rgba(255,120,20,${sparkAlpha * 0.6})`);
    sparkGrad.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = sparkGrad;
    ctx.beginPath(); ctx.arc(backX, backY - 9, sparkR + 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,200,${sparkAlpha})`;
    ctx.beginPath(); ctx.arc(backX, backY - 9, sparkR * 0.4, 0, Math.PI * 2); ctx.fill();
  }

  // Heavy enemy dust footsteps
  if ((tk === 'ogre' || tk === 'ogreSoldier' || tk === 'titan') && !isFlash) {
    const dustAlpha = Math.max(0, 0.3 - Math.abs(Math.sin(e.walkPhase)) * 0.4);
    if (dustAlpha > 0.02) {
      const footY = cy + r + 2;
      ctx.fillStyle = `rgba(120,100,70,${dustAlpha})`;
      ctx.beginPath(); ctx.arc(cx - 4 + Math.sin(e.walkPhase * 0.7) * 3, footY, 2 + dustAlpha * 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5 + Math.cos(e.walkPhase * 0.7) * 2, footY + 1, 1.5 + dustAlpha * 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Hit flash white overlay (source-atop over the body)
  if (isFlash) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(drawCx, drawCy, r + 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Buffed red tint
  if (e.buffed && !isFlash) {
    ctx.fillStyle = 'rgba(255,50,50,0.18)';
    ctx.beginPath(); ctx.arc(drawCx, drawCy, r + 1, 0, Math.PI * 2); ctx.fill();
  }

  // HP bar
  if (e.hp < e.maxHP) {
    drawBar(drawCx - r, drawCy - r - 8, r * 2, 4, e.hp / e.maxHP, '#cc3333', '#441111');
  }

  ctx.restore();
}

// ─── Per-type enemy sprite renderers ──────────────────────────────────────

function _drawEnemyType(ctx, e, tk, r, t, isFlash) {
  if (tk === 'raider') {
    // Green dome head + ragged hunched body
    ctx.beginPath();
    ctx.moveTo(-4, -8); ctx.bezierCurveTo(-8, -6, -9, 2, -7, 6);
    ctx.bezierCurveTo(-5, 9, 5, 9, 7, 6); ctx.bezierCurveTo(9, 2, 8, -6, 4, -8);
    ctx.bezierCurveTo(2, -10, -2, -10, -4, -8); ctx.closePath();
    if (!isFlash) {
      const bg = ctx.createRadialGradient(0, -2, 2, 0, 2, 10);
      bg.addColorStop(0, '#6ac86a'); bg.addColorStop(1, '#2a5a1a');
      ctx.fillStyle = bg;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();

    // Ragged waist cloth
    if (!isFlash) {
      ctx.fillStyle = '#6a5030';
      ctx.beginPath();
      ctx.moveTo(-6, 3); ctx.lineTo(-7, 8); ctx.lineTo(-3, 6);
      ctx.lineTo(0, 9); ctx.lineTo(3, 6); ctx.lineTo(7, 8); ctx.lineTo(6, 3);
      ctx.closePath(); ctx.fill();
    }

    // Yellow eyes
    ctx.fillStyle = isFlash ? '#fff' : '#ffdd00';
    ctx.beginPath(); ctx.arc(4, -4, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, 2, 1.8, 0, Math.PI * 2); ctx.fill();

    // Club arm
    if (!isFlash) {
      ctx.strokeStyle = '#664422'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(16, 0); ctx.stroke();
      ctx.fillStyle = '#7a5530';
      ctx.beginPath(); ctx.arc(18, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(22, 0); ctx.stroke();
    }

    // Tusks
    if (!isFlash) {
      ctx.fillStyle = '#fffde0';
      ctx.beginPath(); ctx.moveTo(5, -5); ctx.lineTo(9, -7); ctx.lineTo(8, -4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(5, 5); ctx.lineTo(9, 7); ctx.lineTo(8, 4); ctx.closePath(); ctx.fill();
    }

  } else if (tk === 'soldier') {
    // Upright orc — green body, half-helm, spear + shield
    ctx.beginPath();
    ctx.moveTo(-5, -11); ctx.bezierCurveTo(-9, -8, -9, 6, -7, 9);
    ctx.bezierCurveTo(-4, 12, 4, 12, 7, 9); ctx.bezierCurveTo(9, 6, 9, -8, 5, -11);
    ctx.closePath();
    if (!isFlash) {
      const bg = ctx.createLinearGradient(0, -11, 0, 12);
      bg.addColorStop(0, '#5cb85c'); bg.addColorStop(1, '#2a5a1a');
      ctx.fillStyle = bg;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();

    // Half-helm
    ctx.fillStyle = isFlash ? '#fff' : '#7a5530';
    ctx.beginPath(); ctx.arc(0, -10, 5, Math.PI, 0); ctx.fill();
    if (!isFlash) {
      ctx.fillStyle = '#8a6540';
      ctx.beginPath(); ctx.arc(0, -10, 4, Math.PI + 0.2, -0.2); ctx.fill();
    }

    // Wooden shield
    if (e.hasShield && !e.shieldBroken) {
      ctx.fillStyle = isFlash ? '#fff' : '#997744';
      ctx.beginPath(); ctx.arc(10, 0, 7, -1.2, 1.2); ctx.closePath(); ctx.fill();
      if (!isFlash) {
        ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.arc(10, 0, 5, -0.8, 0.8); ctx.stroke();
        ctx.fillStyle = '#ccbb88'; ctx.beginPath(); ctx.arc(10, 0, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Spear
    ctx.strokeStyle = isFlash ? '#fff' : '#aaa'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(6, -1); ctx.lineTo(22, -1); ctx.stroke();
    if (!isFlash) {
      ctx.fillStyle = '#ccc';
      ctx.beginPath(); ctx.moveTo(20, -3); ctx.lineTo(24, -1); ctx.lineTo(20, 1); ctx.closePath(); ctx.fill();
    }

    // Eyes
    ctx.fillStyle = isFlash ? '#fff' : '#ffdd00';
    ctx.beginPath(); ctx.arc(3, -6, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, 2, 1.5, 0, Math.PI * 2); ctx.fill();

  } else if (tk === 'bomber') {
    // Small squat body — fuse handled in world space after restore
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 6, 0, 0, Math.PI * 2);
    if (!isFlash) {
      const bg = ctx.createRadialGradient(0, -1, 1, 0, 1, 7);
      bg.addColorStop(0, '#4a8a3a'); bg.addColorStop(1, '#1a3a0a');
      ctx.fillStyle = bg;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();

    // Bomb on back
    ctx.fillStyle = isFlash ? '#fff' : '#2a2a2a';
    ctx.beginPath(); ctx.arc(-8, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.8; ctx.stroke();
    if (!isFlash) {
      ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(-7, -2, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // Wild eyes
    ctx.fillStyle = isFlash ? '#fff' : '#ffee00';
    ctx.beginPath(); ctx.arc(4, -3, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, 3, 2.2, 0, Math.PI * 2); ctx.fill();
    if (!isFlash) {
      ctx.fillStyle = '#220';
      ctx.beginPath(); ctx.arc(5, -3, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, 3, 0.8, 0, Math.PI * 2); ctx.fill();
    }

  } else if (tk === 'archer') {
    // Slim hunched body with bow
    ctx.beginPath();
    ctx.moveTo(-4, -10); ctx.bezierCurveTo(-7, -7, -7, 7, -5, 10);
    ctx.bezierCurveTo(-3, 12, 3, 12, 5, 10); ctx.bezierCurveTo(7, 7, 7, -7, 4, -10);
    ctx.closePath();
    if (!isFlash) {
      const bg = ctx.createLinearGradient(0, -10, 0, 12);
      bg.addColorStop(0, '#5ab84a'); bg.addColorStop(1, '#2a5a1a');
      ctx.fillStyle = bg;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();

    // Bow + string
    ctx.strokeStyle = isFlash ? '#fff' : '#8B4513'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(9, 0, 9, -1.0, 1.0); ctx.stroke();
    ctx.strokeStyle = isFlash ? '#ddd' : '#c8a880'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(9 + Math.cos(-1.0) * 9, Math.sin(-1.0) * 9);
    ctx.lineTo(9 + Math.cos(1.0) * 9, Math.sin(1.0) * 9);
    ctx.stroke();

    // Arrow notched
    ctx.strokeStyle = isFlash ? '#fff' : '#8B4513'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(19, 0); ctx.stroke();
    if (!isFlash) {
      ctx.fillStyle = '#aaa';
      ctx.beginPath(); ctx.moveTo(17, -2); ctx.lineTo(20, 0); ctx.lineTo(17, 2); ctx.closePath(); ctx.fill();
    }

    // Quiver on back
    ctx.fillStyle = isFlash ? '#fff' : '#654321';
    ctx.beginPath();
    ctx.moveTo(-9, -7); ctx.arcTo(-13, -7, -13, 5, 2); ctx.arcTo(-13, 7, -9, 7, 2); ctx.lineTo(-9, 5); ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = isFlash ? '#fff' : '#ffdd00';
    ctx.beginPath(); ctx.arc(3, -5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, 3, 1.5, 0, Math.PI * 2); ctx.fill();

  } else if (tk === 'ogre') {
    // Large brownish-green body + massive club
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 14, 0, 0, Math.PI * 2);
    if (!isFlash) {
      const bg = ctx.createLinearGradient(0, -14, 0, 14);
      bg.addColorStop(0, '#7ab86a'); bg.addColorStop(0.5, '#4a8a3a'); bg.addColorStop(1, '#2a5a1a');
      ctx.fillStyle = bg;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();

    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = isFlash ? '#fff' : '#4a8a3a';
      ctx.beginPath();
      ctx.moveTo(-14, side * 8); ctx.bezierCurveTo(-18, side * 6, -20, side * 10, -17, side * 14);
      ctx.bezierCurveTo(-15, side * 16, -12, side * 14, -12, side * 10); ctx.closePath(); ctx.fill();
    }

    ctx.fillStyle = isFlash ? '#fff' : '#5a7a4a';
    ctx.beginPath(); ctx.arc(0, -16, 5, 0, Math.PI * 2); ctx.fill();
    if (!isFlash) { ctx.fillStyle = '#4a6a3a'; ctx.beginPath(); ctx.arc(0, -15, 3, 0, Math.PI); ctx.fill(); }

    ctx.fillStyle = isFlash ? '#fff' : '#ffdd00';
    ctx.beginPath(); ctx.arc(-2, -17, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2, -17, 1.2, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = isFlash ? '#fff' : '#664422';
    ctx.beginPath();
    ctx.moveTo(14, -2); ctx.bezierCurveTo(18, -3, 24, -4, 28, -5);
    ctx.bezierCurveTo(30, -3, 30, 3, 28, 5); ctx.bezierCurveTo(24, 4, 18, 3, 14, 2); ctx.closePath();
    ctx.fill();
    if (!isFlash) { ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke(); }

  } else if (tk === 'orcKnight') {
    // Metallic armored knight — visor helm, tower shield, sword
    ctx.beginPath();
    ctx.moveTo(-7, -12); ctx.bezierCurveTo(-11, -10, -11, 10, -8, 12);
    ctx.bezierCurveTo(-4, 14, 4, 14, 8, 12); ctx.bezierCurveTo(11, 10, 11, -10, 7, -12);
    ctx.closePath();
    if (!isFlash) {
      const bg = ctx.createLinearGradient(0, -12, 0, 14);
      bg.addColorStop(0, '#8898a8'); bg.addColorStop(0.5, '#667788'); bg.addColorStop(1, '#445566');
      ctx.fillStyle = bg;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();

    // Visor helmet
    ctx.fillStyle = isFlash ? '#fff' : '#556';
    ctx.beginPath(); ctx.arc(0, -12, 7, 0, Math.PI * 2); ctx.fill();
    if (!isFlash) {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(4, -12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, -8); ctx.stroke();
    }

    // Tower shield (front-right)
    ctx.fillStyle = isFlash ? '#fff' : '#8898a8';
    ctx.beginPath();
    ctx.moveTo(10, -10); ctx.lineTo(18, -10); ctx.lineTo(20, 0);
    ctx.lineTo(18, 10); ctx.lineTo(10, 12); ctx.lineTo(8, 0); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (!isFlash) {
      ctx.strokeStyle = '#ccaa44'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(14, -8); ctx.lineTo(14, 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, 1); ctx.lineTo(18, 1); ctx.stroke();
    }

    // Sword (left side)
    if (!isFlash) {
      const sGrad = ctx.createLinearGradient(-8, 0, -24, 0);
      sGrad.addColorStop(0, '#aab'); sGrad.addColorStop(0.5, '#dde'); sGrad.addColorStop(1, '#fff');
      ctx.strokeStyle = sGrad;
    } else { ctx.strokeStyle = '#fff'; }
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-24, 0); ctx.stroke();
    ctx.fillStyle = isFlash ? '#fff' : '#884';
    ctx.beginPath(); ctx.arc(-8, 0, 2.5, 0, Math.PI * 2); ctx.fill();

  } else if (tk === 'wizard') {
    // Purple robe + pointed hat + staff with cyan orb
    ctx.beginPath();
    ctx.moveTo(-5, -8); ctx.lineTo(5, -8);
    ctx.bezierCurveTo(8, 0, 11, 8, 10, 12); ctx.lineTo(-10, 12);
    ctx.bezierCurveTo(-11, 8, -8, 0, -5, -8); ctx.closePath();
    if (!isFlash) {
      const bg = ctx.createLinearGradient(0, -8, 0, 12);
      bg.addColorStop(0, '#8050c0'); bg.addColorStop(1, '#3a1a5a');
      ctx.fillStyle = bg;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();

    if (!isFlash) { ctx.strokeStyle = '#6040a0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, 10); ctx.lineTo(9, 10); ctx.stroke(); }

    // Pointed hat (triangle)
    ctx.beginPath();
    ctx.moveTo(0, -26); ctx.bezierCurveTo(-3, -18, -8, -10, -9, -8);
    ctx.lineTo(9, -8); ctx.bezierCurveTo(8, -10, 3, -18, 0, -26); ctx.closePath();
    if (!isFlash) {
      const hg = ctx.createLinearGradient(-5, -26, 5, -8);
      hg.addColorStop(0, '#6040a0'); hg.addColorStop(1, '#402070');
      ctx.fillStyle = hg;
    } else { ctx.fillStyle = '#fff'; }
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = isFlash ? '#fff' : '#503080';
    ctx.beginPath(); ctx.ellipse(0, -9, 10, 2.5, 0, 0, Math.PI * 2); ctx.fill();

    if (!isFlash) {
      ctx.fillStyle = '#ffe080';
      ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(1.5, -26); ctx.lineTo(0, -24); ctx.lineTo(-1.5, -26); ctx.closePath(); ctx.fill();
    }

    // Staff + cyan glowing orb
    ctx.strokeStyle = isFlash ? '#fff' : '#8B6914'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-22, 0); ctx.stroke();
    if (!isFlash) {
      const orbGrad = ctx.createRadialGradient(-22, 0, 0, -22, 0, 5);
      orbGrad.addColorStop(0, 'rgba(160,240,255,0.9)');
      orbGrad.addColorStop(0.5, 'rgba(40,180,255,0.6)');
      orbGrad.addColorStop(1, 'rgba(0,120,200,0)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath(); ctx.arc(-22, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ccf0ff';
      ctx.beginPath(); ctx.arc(-22, 0, 1.5, 0, Math.PI * 2); ctx.fill();
      for (let i = 1; i <= 3; i++) {
        const ox = Math.sin(t * 5 + i * 2) * 2, oy = Math.cos(t * 4 + i * 1.5) * 2;
        ctx.fillStyle = `rgba(40,180,255,${0.3 / i})`;
        ctx.beginPath(); ctx.arc(-22 - i * 5 + ox, oy, 2.5 - i * 0.5, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-22, 0, 3, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = isFlash ? '#fff' : '#ffdd00';
    ctx.beginPath(); ctx.arc(3, -5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, 3, 1.5, 0, Math.PI * 2); ctx.fill();

  } else if (tk === 'ogreSoldier') {
    // Ogre with brownish body + armor straps
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 14, 0, 0, Math.PI * 2);
    if (!isFlash) {
      const bg = ctx.createLinearGradient(0, -14, 0, 14);
      bg.addColorStop(0, '#887060'); bg.addColorStop(0.5, '#665544'); bg.addColorStop(1, '#443322');
      ctx.fillStyle = bg;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();

    if (!isFlash) {
      ctx.fillStyle = 'rgba(50,50,60,0.5)';
      ctx.beginPath(); ctx.ellipse(0, -4, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(50,50,60,0.4)';
      ctx.beginPath(); ctx.ellipse(0, 5, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(80,70,50,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(12, 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-12, 4); ctx.lineTo(12, -4); ctx.stroke();
    }

    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = isFlash ? '#fff' : '#665544';
      ctx.beginPath();
      ctx.moveTo(-14, side * 8); ctx.bezierCurveTo(-18, side * 6, -20, side * 10, -17, side * 14);
      ctx.bezierCurveTo(-15, side * 16, -12, side * 14, -12, side * 10); ctx.closePath(); ctx.fill();
    }

    ctx.fillStyle = isFlash ? '#fff' : '#667';
    ctx.beginPath(); ctx.arc(0, -16, 6, Math.PI, 0); ctx.lineTo(6, -13); ctx.lineTo(-6, -13); ctx.closePath(); ctx.fill();
    if (!isFlash) {
      ctx.fillStyle = '#778'; ctx.beginPath(); ctx.arc(0, -16, 5, Math.PI + 0.2, -0.2); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(4, -14); ctx.stroke();
    }

    ctx.fillStyle = isFlash ? '#fff' : '#664422';
    ctx.beginPath();
    ctx.moveTo(14, -2); ctx.bezierCurveTo(18, -3, 24, -5, 30, -6);
    ctx.bezierCurveTo(32, -3, 32, 3, 30, 6); ctx.bezierCurveTo(24, 5, 18, 3, 14, 2); ctx.closePath();
    ctx.fill();
    if (!isFlash) { ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke(); }

  } else if (tk === 'titan') {
    // Massive boss — crown, glowing red eyes, battle axe (1.4x scale via larger ellipse)
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 20, 0, 0, Math.PI * 2);
    if (!isFlash) {
      const bg = ctx.createLinearGradient(0, -20, 0, 20);
      bg.addColorStop(0, '#a44'); bg.addColorStop(0.5, '#833'); bg.addColorStop(1, '#522');
      ctx.fillStyle = bg;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2.5;
    ctx.fill(); ctx.stroke();

    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = isFlash ? '#fff' : '#733';
      ctx.beginPath();
      ctx.moveTo(-18, side * 10); ctx.bezierCurveTo(-24, side * 8, -28, side * 12, -24, side * 18);
      ctx.bezierCurveTo(-20, side * 20, -16, side * 16, -16, side * 12); ctx.closePath(); ctx.fill();
    }

    ctx.fillStyle = isFlash ? '#fff' : '#622';
    ctx.beginPath(); ctx.arc(0, -22, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();

    // Crown ring
    if (!isFlash) {
      ctx.strokeStyle = '#da2'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -22, 10, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.fillStyle = isFlash ? '#fff' : '#da2';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 6 - 2, -28); ctx.lineTo(i * 6, -34 - (i === 0 ? 4 : 0)); ctx.lineTo(i * 6 + 2, -28);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = isFlash ? '#fff' : '#c92';
    ctx.fillRect(-8, -29, 16, 3);
    if (!isFlash) { ctx.fillStyle = '#a70'; ctx.fillRect(-7, -28, 14, 1); }

    // Glowing red eyes
    if (!isFlash) {
      for (let side = -1; side <= 1; side += 2) {
        const eyeGrad = ctx.createRadialGradient(side * 3, -22, 0, side * 3, -22, 3.5);
        eyeGrad.addColorStop(0, '#f88'); eyeGrad.addColorStop(0.5, '#f33'); eyeGrad.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = eyeGrad;
        ctx.beginPath(); ctx.arc(side * 3, -22, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-3, -22, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3, -22, 2, 0, Math.PI * 2); ctx.fill();
    }

    // Massive battle axe
    if (!isFlash) {
      ctx.fillStyle = 'rgba(255,100,100,0.12)';
      ctx.beginPath(); ctx.ellipse(34, 0, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
      const wGrad = ctx.createLinearGradient(20, 0, 46, 0);
      wGrad.addColorStop(0, '#666'); wGrad.addColorStop(0.5, '#888'); wGrad.addColorStop(1, '#aaa');
      ctx.fillStyle = wGrad;
    } else { ctx.fillStyle = '#fff'; }
    ctx.beginPath();
    ctx.moveTo(20, -4); ctx.lineTo(38, -6); ctx.bezierCurveTo(44, -6, 46, -2, 46, 0);
    ctx.bezierCurveTo(46, 2, 44, 6, 38, 6); ctx.lineTo(20, 4); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();

  } else {
    // Fallback painted circle
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    if (!isFlash) {
      const bg = ctx.createRadialGradient(0, -r * 0.3, r * 0.2, 0, 0, r);
      bg.addColorStop(0, e.color); bg.addColorStop(1, '#333');
      ctx.fillStyle = bg;
    } else { ctx.fillStyle = '#fff'; }
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
  }
}

import { PLAYER, ATTACK } from '../config.js';
import { getCtx } from '../renderer.js';
import { drawBar, drawText } from '../renderer.js';
import { getEquippedWeapon } from '../systems/economy.js';

/**
 * Draw the player as a top-down knight sprite.
 * Called after camera transform is applied — uses world coordinates.
 */
export function drawPlayer(p) {
  const ctx = getCtx();
  ctx.save();

  const cx = (p.x + p.width / 2) | 0;
  const cy = (p.y + p.height / 2) | 0;
  const r = PLAYER.radius;
  const facing = p.facing;
  const weapon = getEquippedWeapon(p);
  const t = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;

  // Invincibility / hit flash pulse
  if (p.flashTimer > 0) {
    ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(Date.now() * 0.015));
  }

  const isFlash = p.flashTimer > 0 && Math.floor(p.flashTimer * 20) % 2;
  const phase = p.attackPhase;
  const combo = p.comboCount;

  // Progress in active attack phase (0→1)
  let activeProgress = 0;
  if (p.attacking && phase === 'active') {
    activeProgress = Math.max(0, Math.min(1, 1 - p.attackTimer / ATTACK.active));
  }

  // Combo 2: body translates forward during active phase
  let lungeDist = 0;
  if (p.attacking && combo === 2) {
    if (phase === 'active') {
      lungeDist = Math.sin(activeProgress * Math.PI) * 16;
    }
  }

  const drawCx = cx + Math.cos(facing) * lungeDist;
  const drawCy = cy + Math.sin(facing) * lungeDist;

  // ── Drop shadow ──
  ctx.save();
  ctx.translate(drawCx + Math.cos(facing) * 3, drawCy + Math.sin(facing) * 4);
  ctx.scale(1.6, 0.4);
  const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.32)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ── Attack effects (drawn under the body) ──
  if (p.attacking && phase === 'active') {
    _drawAttackEffect(ctx, drawCx, drawCy, facing, combo, activeProgress, r);
  }

  // ── Equip flash ring ──
  if (p.equipFlashTimer > 0) {
    p.equipFlashTimer -= 0.016;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, p.equipFlashTimer * 3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ── Body: translate to draw position, rotate to face direction ──
  // Combo 3: full body spin during active phase
  let bodyRotExtra = 0;
  if (p.attacking && combo === 3 && phase === 'active') {
    bodyRotExtra = activeProgress * Math.PI * (5 / 3); // 300° sweep
  }

  ctx.save();
  ctx.translate(drawCx, drawCy);
  ctx.rotate(facing + bodyRotExtra);
  _drawKnightBody(ctx, p, weapon, t, isFlash);
  ctx.restore();

  // ── Combo counter ──
  if (p.comboCount >= 2) {
    drawText(`x${p.comboCount}`, cx - 10, cy - r - 26, 10, '#ff0');
  }

  // ── HP bar ──
  drawBar(cx - r - 5, cy - r - 14, r * 2 + 10, 5, p.hp / p.maxHP, '#cc3333', '#441111');

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── Attack visual effects ─────────────────────────────────────────────────

function _drawAttackEffect(ctx, cx, cy, facing, combo, progress, r) {
  ctx.save();
  ctx.translate(cx, cy);

  if (combo === 1) {
    // ── Combo 1: Wide horizontal blue arc sweep ──
    const arcSpan = Math.PI * (5 / 4);
    const startAngle = facing + Math.PI * 0.55; // wind-up position
    const endAngle = startAngle - arcSpan * progress; // sweeps to the left
    const alpha = Math.sin(progress * Math.PI) * 0.65;
    const sweepR = r + 44;

    // Arc fill
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, sweepR, endAngle, startAngle);
    ctx.closePath();
    const arcG = ctx.createRadialGradient(0, 0, 20, 0, 0, sweepR);
    arcG.addColorStop(0, `rgba(60,120,255,${alpha * 0.4})`);
    arcG.addColorStop(1, `rgba(60,120,255,0)`);
    ctx.fillStyle = arcG; ctx.fill();

    // Leading edge glow
    ctx.strokeStyle = `rgba(140,200,255,${alpha})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, sweepR, endAngle - 0.05, endAngle); ctx.stroke();

    // Trailing afterimage arcs
    for (let i = 1; i <= 4; i++) {
      ctx.strokeStyle = `rgba(100,160,255,${alpha * (1 - i * 0.22)})`; ctx.lineWidth = 2 - i * 0.25;
      ctx.beginPath(); ctx.arc(0, 0, sweepR - i * 3, endAngle + i * 0.2, endAngle); ctx.stroke();
    }

  } else if (combo === 2) {
    // ── Combo 2: Orange thrust streaks ──
    const alpha = (1 - progress) * 0.85;
    const cosF = Math.cos(facing);
    const sinF = Math.sin(facing);
    const perpX = -sinF;
    const perpY = cosF;

    for (let i = 1; i <= 6; i++) {
      const offX = perpX * (i - 3.5) * 2;
      const offY = perpY * (i - 3.5) * 2;
      const streakLen = 18 + i * 5 + progress * 18;
      ctx.strokeStyle = `rgba(255,${130 + i * 12},20,${alpha * (1 - i * 0.1)})`;
      ctx.lineWidth = 4.5 - i * 0.5;
      ctx.beginPath();
      ctx.moveTo(offX + cosF * 12, offY + sinF * 12);
      ctx.lineTo(offX - cosF * streakLen, offY - sinF * streakLen);
      ctx.stroke();
    }

    // Impact flash at sword tip
    if (progress > 0.45) {
      const ep = (progress - 0.45) / 0.55;
      const tipX = cosF * (r + 36);
      const tipY = sinF * (r + 36);
      const flashG = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 24 * ep);
      flashG.addColorStop(0, `rgba(255,220,80,${ep * 0.8})`);
      flashG.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = flashG;
      ctx.beginPath(); ctx.arc(tipX, tipY, 24 * ep, 0, Math.PI * 2); ctx.fill();
    }

  } else if (combo >= 3) {
    // ── Combo 3: Red/gold spinning orbit arc ──
    const spinStart = facing - Math.PI * 0.4;
    const spinEnd = spinStart + progress * Math.PI * (5 / 3);
    const alpha = 0.55;
    const spinR = r + 50;

    // Orbit arc fill
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, spinR, spinStart, spinEnd);
    ctx.closePath();
    const arcG = ctx.createRadialGradient(0, 0, 22, 0, 0, spinR);
    arcG.addColorStop(0, `rgba(255,80,20,${alpha * 0.3})`);
    arcG.addColorStop(0.6, `rgba(255,160,30,${alpha * 0.45})`);
    arcG.addColorStop(1, `rgba(255,200,80,0)`);
    ctx.fillStyle = arcG; ctx.fill();

    // Leading edge glow
    ctx.strokeStyle = `rgba(255,180,40,${alpha * 0.9})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, spinR, spinEnd - 0.08, spinEnd); ctx.stroke();

    // Trailing afterimage arcs
    for (let i = 1; i <= 5; i++) {
      ctx.strokeStyle = `rgba(255,140,30,${alpha * (1 - i * 0.18)})`; ctx.lineWidth = 3 - i * 0.4;
      ctx.beginPath(); ctx.arc(0, 0, spinR - i * 2, spinEnd - i * 0.28, spinEnd - i * 0.05); ctx.stroke();
    }

    // Explosion burst at the end
    if (progress > 0.82) {
      const ep = (progress - 0.82) / 0.18;
      // Expanding shockwave ring
      const ringR = ep * 82;
      ctx.strokeStyle = `rgba(255,210,80,${1 - ep})`; ctx.lineWidth = 4 * (1 - ep) + 1;
      ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
      if (ep > 0.25) {
        const r2 = (ep - 0.25) * 0.85 * 65;
        ctx.strokeStyle = `rgba(255,100,30,${(1 - ep) * 0.7})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r2, 0, Math.PI * 2); ctx.stroke();
      }
      // Spark burst rays
      for (let i = 0; i < 12; i++) {
        const sa = (i / 12) * Math.PI * 2;
        const sd = (32 + (i % 3) * 12) * Math.min(ep * 1.4, 1);
        ctx.strokeStyle = `rgba(255,${(150 + (i * 17) % 100) | 0},30,${(1 - ep) * 0.9})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * 13, Math.sin(sa) * 13);
        ctx.lineTo(Math.cos(sa) * sd, Math.sin(sa) * sd);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

// ─── Knight body (top-down, facing +X in local space after ctx.rotate(facing)) ──

function _drawKnightBody(ctx, p, weapon, t, isFlash) {
  const r = PLAYER.radius;

  // Cape: teardrop trailing behind (-X = backward)
  if (!isFlash) {
    ctx.fillStyle = '#881111';
    ctx.strokeStyle = '#550000'; ctx.lineWidth = 1.5;
  } else {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  }
  ctx.beginPath();
  ctx.moveTo(-4, -5);
  ctx.bezierCurveTo(-14, -8, -18, 2, -12, 10);
  ctx.bezierCurveTo(-6, 18, 4, 14, 6, 6);
  ctx.bezierCurveTo(8, 0, 2, -3, -4, -5);
  ctx.fill(); ctx.stroke();

  // Body oval (wider in forward +X, shorter in side ±Y)
  if (!isFlash) {
    const bodyGrad = ctx.createRadialGradient(-2, -2, 2, -2, -2, 18);
    bodyGrad.addColorStop(0, '#c8d8e8');
    bodyGrad.addColorStop(0.6, '#8090a8');
    bodyGrad.addColorStop(1, '#4a5a6a');
    ctx.fillStyle = bodyGrad;
  } else {
    ctx.fillStyle = '#fff';
  }
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Helmet dome (front of body, at positive X)
  if (!isFlash) {
    const helmGrad = ctx.createRadialGradient(-3, -3, 1, 1, 0, 11);
    helmGrad.addColorStop(0, '#ddeeff');
    helmGrad.addColorStop(0.5, '#9aabbd');
    helmGrad.addColorStop(1, '#5a6a7a');
    ctx.fillStyle = helmGrad;
  } else {
    ctx.fillStyle = '#fff';
  }
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(2, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Helmet rim highlight
  if (!isFlash) {
    ctx.strokeStyle = 'rgba(220,240,255,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -2, 7, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
  }

  // Red plume (feather going backward = negative X)
  if (!isFlash) {
    ctx.fillStyle = '#cc2222';
    ctx.strokeStyle = '#881111'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, -5);
    ctx.bezierCurveTo(-9, -16, 3, -20, 3, -10);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Plume highlight
    ctx.fillStyle = '#dd3355';
    ctx.beginPath();
    ctx.moveTo(-3, -5);
    ctx.bezierCurveTo(-7, -14, 2, -18, 2, -10);
    ctx.closePath(); ctx.fill();
  }

  // Shield arm (left side = -Y direction, slightly forward)
  const hasShield = weapon.type !== '2h' && weapon.type !== 'ranged';
  if (hasShield) {
    // Arm
    ctx.fillStyle = isFlash ? '#fff' : '#8090a8';
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(2, -17, 4, 3, 0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Shield face (kite/heater shape)
    ctx.fillStyle = isFlash ? '#fff' : (p.blocking ? '#2244cc' : '#1a3a9a');
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-3, -22);
    ctx.lineTo(-3, -29);
    ctx.lineTo(7, -29);
    ctx.lineTo(9, -22);
    ctx.lineTo(3, -18);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Shield emblem
    if (!isFlash) {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-1, -27, 6, 2);
      ctx.fillRect(1, -30, 2, 8);
    }

    // Blocking glow
    if (p.blocking && !isFlash) {
      ctx.globalAlpha = 0.25 + Math.sin(t * 8) * 0.1;
      ctx.fillStyle = '#aaccff';
      ctx.beginPath(); ctx.arc(3, -24, 9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Sword arm (right side = +Y direction)
  ctx.fillStyle = isFlash ? '#fff' : '#8090a8';
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(2, 17, 4, 3, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Sword blade (extends forward from arm, in +X direction)
  const sGrad = !isFlash ? (() => {
    const g = ctx.createLinearGradient(8, 16, 44, 20);
    g.addColorStop(0, '#eef4ff'); g.addColorStop(1, '#6878a0'); return g;
  })() : '#fff';
  ctx.fillStyle = sGrad;
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(8, 16);
  ctx.lineTo(44, 19);
  ctx.lineTo(44, 22);
  ctx.lineTo(8, 24);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Sword crossguard
  if (!isFlash) {
    ctx.fillStyle = '#c8a830'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
    ctx.fillRect(5, 13, 5, 12); ctx.strokeRect(5, 13, 5, 12);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(5, 13, 5, 12);
  }
}

import { drawRect, drawCircle, getCtx } from '../renderer.js';
import { WORLD_W, WORLD_H } from '../config.js';

export function createProjectile(x, y, dirOrAngle, damage, speed, type = 'arrow', magic = false, angle = null) {
  // Support both old API (dirOrAngle = -1/1 for left/right) and new angle-based API
  let dx, dy;
  if (angle !== null) {
    dx = Math.cos(angle);
    dy = Math.sin(angle);
  } else if (typeof dirOrAngle === 'number' && (dirOrAngle === 1 || dirOrAngle === -1)) {
    dx = dirOrAngle;
    dy = 0;
  } else {
    // dirOrAngle is actually an angle in radians
    dx = Math.cos(dirOrAngle);
    dy = Math.sin(dirOrAngle);
  }

  return {
    x, y,
    width: type === 'arrow' || type === 'playerArrow' || type === 'troopArrow' ? 12 : 10,
    height: type === 'arrow' || type === 'playerArrow' || type === 'troopArrow' ? 6 : 10,
    dx,
    dy,
    speed,
    damage,
    type,
    magic,
    alive: true,
    angle: Math.atan2(dy, dx),
  };
}

export function updateProjectiles(projectiles, dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.dx * p.speed * dt;
    p.y += p.dy * p.speed * dt;
    if (p.lifeTime !== undefined) {
      p.lifeTime -= dt;
      if (p.lifeTime <= 0) p.alive = false;
    }
    if (p.x < -20 || p.x > WORLD_W + 20 || p.y < -20 || p.y > WORLD_H + 20) {
      p.alive = false;
    }
    if (!p.alive) projectiles.splice(i, 1);
  }
}

export function drawProjectile(p) {
  const ctx = getCtx();
  ctx.save();

  const pcx = (p.x + p.width / 2) | 0;
  const pcy = (p.y + p.height / 2) | 0;

  if (p.type === 'arrow') {
    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.rotate(p.angle);
    // Shaft with gradient (brown)
    const shaftGrad = ctx.createLinearGradient(-7, 0, 7, 0);
    shaftGrad.addColorStop(0, '#6a3010');
    shaftGrad.addColorStop(0.5, '#a06828');
    shaftGrad.addColorStop(1, '#7a4818');
    ctx.fillStyle = shaftGrad;
    ctx.beginPath();
    ctx.moveTo(-7, -1);
    ctx.lineTo(7, -0.8);
    ctx.lineTo(7, 0.8);
    ctx.lineTo(-7, 1);
    ctx.closePath();
    ctx.fill();
    // Metallic arrowhead triangle with fill
    const headGrad = ctx.createLinearGradient(7, 0, 13, 0);
    headGrad.addColorStop(0, '#888');
    headGrad.addColorStop(0.5, '#ccc');
    headGrad.addColorStop(1, '#eee');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.moveTo(7, -3.5);
    ctx.lineTo(13, 0);
    ctx.lineTo(7, 3.5);
    ctx.closePath();
    ctx.fill();
    // Arrowhead edge highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(8, -2.5);
    ctx.lineTo(12, 0);
    ctx.stroke();
    // 2-3 feather fletching at tail
    const featherColor = '#994433';
    for (let i = -1; i <= 1; i++) {
      ctx.fillStyle = i === 0 ? '#884030' : featherColor;
      ctx.beginPath();
      ctx.moveTo(-7, i * 0.5);
      ctx.bezierCurveTo(-9, i * 0.5 + i * 1.5, -10, i * 0.5 + i * 3, -8, i * 0.5 + i * 3.5);
      ctx.bezierCurveTo(-7, i * 0.5 + i * 2, -7, i * 0.5 + i * 1, -6, i * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

  } else if (p.type === 'troopArrow') {
    // 2 fading trail copies offset backward along velocity
    for (let i = 2; i >= 1; i--) {
      const trailX = pcx - p.dx * i * 7;
      const trailY = pcy - p.dy * i * 7;
      ctx.globalAlpha = (3 - i) * 0.10;
      ctx.save();
      ctx.translate(trailX, trailY);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#7a4818';
      ctx.beginPath();
      ctx.moveTo(-6, -1); ctx.lineTo(5, -0.7); ctx.lineTo(5, 0.7); ctx.lineTo(-6, 1);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.rotate(p.angle);
    // Brown shaft
    const tShaftGrad = ctx.createLinearGradient(-7, 0, 7, 0);
    tShaftGrad.addColorStop(0, '#6a3010');
    tShaftGrad.addColorStop(0.5, '#a06828');
    tShaftGrad.addColorStop(1, '#7a4818');
    ctx.fillStyle = tShaftGrad;
    ctx.beginPath();
    ctx.moveTo(-7, -1); ctx.lineTo(7, -0.8); ctx.lineTo(7, 0.8); ctx.lineTo(-7, 1);
    ctx.closePath(); ctx.fill();
    // Grey metallic arrowhead
    const tHeadGrad = ctx.createLinearGradient(7, 0, 13, 0);
    tHeadGrad.addColorStop(0, '#888');
    tHeadGrad.addColorStop(0.5, '#bbb');
    tHeadGrad.addColorStop(1, '#ddd');
    ctx.fillStyle = tHeadGrad;
    ctx.beginPath();
    ctx.moveTo(7, -3); ctx.lineTo(13, 0); ctx.lineTo(7, 3);
    ctx.closePath(); ctx.fill();
    // Feather fletching
    ctx.fillStyle = '#884030';
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.bezierCurveTo(-9, -1.5, -10, -3, -8, -3.5);
    ctx.bezierCurveTo(-7, -2, -7, -1, -6, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();

  } else if (p.type === 'magic') {
    // 3 trailing afterimage circles that fade
    const tailDx = -p.dx;
    const tailDy = -p.dy;
    for (let i = 3; i >= 1; i--) {
      const d = i * 7;
      const alpha = (4 - i) * 0.12;
      const tr = 4 - i * 0.8;
      const tx = pcx + tailDx * d;
      const ty = pcy + tailDy * d;
      const tGrad = ctx.createRadialGradient(tx, ty, 0, tx, ty, tr);
      tGrad.addColorStop(0, `rgba(200,140,255,${alpha})`);
      tGrad.addColorStop(1, `rgba(120,40,200,0)`);
      ctx.fillStyle = tGrad;
      ctx.beginPath();
      ctx.arc(tx, ty, tr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Main glowing orb with radial gradient (purple center, transparent edge)
    const orbGrad = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, 5);
    orbGrad.addColorStop(0, 'rgba(240,200,255,0.95)');
    orbGrad.addColorStop(0.3, 'rgba(180,100,255,0.8)');
    orbGrad.addColorStop(0.7, 'rgba(140,60,220,0.4)');
    orbGrad.addColorStop(1, 'rgba(100,20,180,0)');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(pcx, pcy, 5, 0, Math.PI * 2);
    ctx.fill();
    // Bright core
    ctx.fillStyle = '#f0d0ff';
    ctx.beginPath();
    ctx.arc(pcx, pcy, 1.5, 0, Math.PI * 2);
    ctx.fill();

  } else if (p.type === 'playerArrow') {
    // Warm glow halo: radial gradient behind it
    const haloGrad = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, 10);
    haloGrad.addColorStop(0, 'rgba(255,240,160,0.25)');
    haloGrad.addColorStop(0.5, 'rgba(255,220,100,0.1)');
    haloGrad.addColorStop(1, 'rgba(255,200,60,0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(pcx, pcy, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.rotate(p.angle);
    // Golden shaft with gradient
    const gShaftGrad = ctx.createLinearGradient(-7, 0, 7, 0);
    gShaftGrad.addColorStop(0, '#c8a030');
    gShaftGrad.addColorStop(0.5, '#e8c860');
    gShaftGrad.addColorStop(1, '#d0a840');
    ctx.fillStyle = gShaftGrad;
    ctx.beginPath();
    ctx.moveTo(-7, -1);
    ctx.lineTo(7, -0.7);
    ctx.lineTo(7, 0.7);
    ctx.lineTo(-7, 1);
    ctx.closePath();
    ctx.fill();
    // Shaft highlight
    ctx.strokeStyle = 'rgba(255,255,220,0.5)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-5, -0.5);
    ctx.lineTo(6, -0.3);
    ctx.stroke();
    // Bright arrowhead with warm metallic fill
    const gHeadGrad = ctx.createLinearGradient(7, 0, 13, 0);
    gHeadGrad.addColorStop(0, '#ddb040');
    gHeadGrad.addColorStop(0.5, '#ffe070');
    gHeadGrad.addColorStop(1, '#fff8c0');
    ctx.fillStyle = gHeadGrad;
    ctx.beginPath();
    ctx.moveTo(7, -3.5);
    ctx.lineTo(13, 0);
    ctx.lineTo(7, 3.5);
    ctx.closePath();
    ctx.fill();
    // 3 feather fletching at tail
    for (let i = -1; i <= 1; i++) {
      ctx.fillStyle = i === 0 ? '#a0a8b0' : '#8890a0';
      ctx.beginPath();
      ctx.moveTo(-7, i * 0.5);
      ctx.bezierCurveTo(-9, i * 0.5 + i * 1.5, -10, i * 0.5 + i * 3, -8, i * 0.5 + i * 3.5);
      ctx.bezierCurveTo(-7, i * 0.5 + i * 2, -7, i * 0.5 + i * 1, -6, i * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
}

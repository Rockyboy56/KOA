import { drawRect, drawCircle, getCtx } from '../renderer.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';

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
    width: type === 'arrow' || type === 'playerArrow' ? 12 : 10,
    height: type === 'arrow' || type === 'playerArrow' ? 6 : 10,
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
    if (p.x < -20 || p.x > GAME_WIDTH + 20 || p.y < -20 || p.y > GAME_HEIGHT + 20) {
      p.alive = false;
    }
    if (!p.alive) projectiles.splice(i, 1);
  }
}

export function drawProjectile(p) {
  const ctx = getCtx();

  if (p.type === 'arrow') {
    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-6, -2, 12, 4);
    // Arrowhead
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.moveTo(6, -3);
    ctx.lineTo(10, 0);
    ctx.lineTo(6, 3);
    ctx.fill();
    // Fletching
    ctx.fillStyle = '#866';
    ctx.fillRect(-7, -3, 3, 6);
    ctx.restore();
  } else if (p.type === 'magic') {
    drawCircle(p.x + 5, p.y + 5, 6, '#a4f');
    drawCircle(p.x + 5, p.y + 5, 3, '#f8f');
  } else if (p.type === 'playerArrow') {
    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ddd';
    ctx.fillRect(-6, -2, 12, 4);
    // Arrowhead
    ctx.fillStyle = '#ff8';
    ctx.beginPath();
    ctx.moveTo(6, -3);
    ctx.lineTo(10, 0);
    ctx.lineTo(6, 3);
    ctx.fill();
    ctx.restore();
  }
}

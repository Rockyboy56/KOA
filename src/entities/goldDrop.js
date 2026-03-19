import { randRange } from '../utils/math.js';
import { drawRect, drawCircle, getCtx } from '../renderer.js';

const DESPAWN_TIME = 10;

export function createGoldDrop(x, y, amount) {
  return {
    x: x + randRange(-10, 10),
    y: y + randRange(-5, 5),
    width: 12,
    height: 12,
    amount,
    timer: DESPAWN_TIME,
    alive: true,
    sparklePhase: Math.random() * Math.PI * 2,
    sparkleTimer: 0,
  };
}

export function updateGoldDrops(drops, dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    drops[i].timer -= dt;
    drops[i].sparklePhase += dt * 6;
    drops[i].sparkleTimer += dt;
    if (drops[i].timer <= 0) {
      drops[i].alive = false;
    }
    if (!drops[i].alive) drops.splice(i, 1);
  }
}

export function drawGoldDrop(g) {
  // Blink when about to despawn
  if (g.timer < 3 && Math.floor(g.timer * 4) % 2) {
    return;
  }

  const ctx = getCtx();

  // Vertical bob animation
  const bobY = Math.sin(g.sparklePhase) * 2;
  const drawX = g.x + 6;
  const drawY = g.y + 6 + bobY;
  const coinR = 6;

  // Warm glow underneath the coin
  const glowGrad = ctx.createRadialGradient(drawX, drawY + 1, 0, drawX, drawY + 1, coinR + 4);
  glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
  glowGrad.addColorStop(0.6, 'rgba(255, 200, 0, 0.1)');
  glowGrad.addColorStop(1, 'rgba(255, 180, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(drawX, drawY + 1, coinR + 4, 0, Math.PI * 2);
  ctx.fill();

  // Coin body: radial gradient (bright gold center, darker rim)
  const coinGrad = ctx.createRadialGradient(drawX - 1.5, drawY - 1.5, 0, drawX, drawY, coinR);
  coinGrad.addColorStop(0, '#fff0b0');
  coinGrad.addColorStop(0.3, '#ffd700');
  coinGrad.addColorStop(0.8, '#dda800');
  coinGrad.addColorStop(1, '#cc9900');
  ctx.fillStyle = coinGrad;
  ctx.beginPath();
  ctx.arc(drawX, drawY, coinR, 0, Math.PI * 2);
  ctx.fill();

  // Metallic rim stroke in darker gold
  ctx.strokeStyle = '#aa7700';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(drawX, drawY, coinR - 0.5, 0, Math.PI * 2);
  ctx.stroke();

  // Shine spot: small white arc on upper-left
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.arc(drawX - 2, drawY - 2, 2.5, Math.PI * 1.1, Math.PI * 1.8);
  ctx.lineTo(drawX - 2, drawY - 2);
  ctx.closePath();
  ctx.fill();

  // Small highlight dot
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.arc(drawX - 2.5, drawY - 2.5, 1, 0, Math.PI * 2);
  ctx.fill();

  // Orbiting sparkles: 4-point stars (two rotated overlapping small rects)
  for (let si = 0; si < 3; si++) {
    const sparkAngle = g.sparklePhase * 1.5 + si * (Math.PI * 2 / 3);
    const orbitR = 8 + si;
    const sx = drawX + Math.cos(sparkAngle) * orbitR;
    const sy = drawY + Math.sin(sparkAngle) * orbitR;
    const starSize = 1.5 - si * 0.3;
    const sa = 0.7 - si * 0.15;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.globalAlpha = sa;

    // 4-point star: two overlapping rotated diamonds
    ctx.fillStyle = '#ffee66';
    // Vertical diamond
    ctx.beginPath();
    ctx.moveTo(0, -starSize * 1.5);
    ctx.lineTo(starSize * 0.5, 0);
    ctx.lineTo(0, starSize * 1.5);
    ctx.lineTo(-starSize * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    // Horizontal diamond
    ctx.beginPath();
    ctx.moveTo(-starSize * 1.5, 0);
    ctx.lineTo(0, starSize * 0.5);
    ctx.lineTo(starSize * 1.5, 0);
    ctx.lineTo(0, -starSize * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

import { randRange } from '../utils/math.js';
import { drawRect, drawCircle } from '../renderer.js';

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
  };
}

export function updateGoldDrops(drops, dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    drops[i].timer -= dt;
    drops[i].sparklePhase += dt * 6;
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

  // Coin body
  const brightness = 0.7 + 0.3 * Math.sin(g.sparklePhase);
  const r = Math.round(255 * brightness);
  const gb = Math.round(200 * brightness);
  const color = `rgb(${r},${gb},50)`;
  drawCircle(g.x + 6, g.y + 6, 6, color);

  // Shine
  drawRect(g.x + 3, g.y + 2, 3, 2, '#fff');
}

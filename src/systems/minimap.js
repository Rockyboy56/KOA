import { WORLD_W, WORLD_H, VIEW_W, VIEW_H, FORT, GATES } from '../config.js';
import { getCtx } from '../renderer.js';

const MM_W = 180;
const MM_H = Math.round(MM_W * (WORLD_H / WORLD_W));

export function drawMinimap(cam, player, enemies, troops, walls) {
  const ctx = getCtx();
  const mmX = VIEW_W - MM_W - 10;
  const mmY = VIEW_H - MM_H - 10;
  const sx = MM_W / WORLD_W;
  const sy = MM_H / WORLD_H;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(mmX - 2, mmY - 2, MM_W + 4, MM_H + 4);
  ctx.fillStyle = '#2a4a2a';
  ctx.fillRect(mmX, mmY, MM_W, MM_H);

  // Fort courtyard
  ctx.fillStyle = '#8a7a6a';
  ctx.fillRect(mmX + FORT.x * sx, mmY + FORT.y * sy, FORT.w * sx, FORT.h * sy);

  // Fort walls (color-coded by HP)
  for (const side of ['north', 'south', 'east', 'west']) {
    const wall = walls[side];
    if (!wall) continue;
    const pct = wall.hp / wall.maxHP;
    const color = wall.destroyed ? '#444' : pct > 0.5 ? '#4a4' : pct > 0.25 ? '#aa4' : '#a44';
    ctx.fillStyle = color;
    ctx.fillRect(mmX + wall.x * sx, mmY + wall.y * sy, Math.max(2, wall.w * sx), Math.max(2, wall.h * sy));
  }

  // Gate gaps
  ctx.fillStyle = '#6a5a3a';
  for (const g of Object.values(GATES)) {
    ctx.fillRect(mmX + g.x * sx, mmY + g.y * sy, Math.max(2, g.w * sx), Math.max(2, g.h * sy));
  }

  // Enemy dots (red)
  ctx.fillStyle = '#f44';
  for (const e of enemies) {
    if (!e.alive) continue;
    ctx.fillRect(mmX + e.x * sx - 1, mmY + e.y * sy - 1, 2, 2);
  }

  // Troop dots (blue)
  ctx.fillStyle = '#48f';
  for (const t of troops) {
    if (!t.alive) continue;
    ctx.fillRect(mmX + t.x * sx - 1, mmY + t.y * sy - 1, 3, 3);
  }

  // Player (green dot)
  ctx.fillStyle = '#4f4';
  ctx.beginPath();
  ctx.arc(mmX + (player.x + player.width / 2) * sx, mmY + (player.y + player.height / 2) * sy, 3, 0, Math.PI * 2);
  ctx.fill();

  // Camera viewport rectangle
  ctx.strokeStyle = '#0f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(mmX + cam.x * sx, mmY + cam.y * sy, VIEW_W * sx, VIEW_H * sy);

  // Label
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MINIMAP', mmX + MM_W / 2, mmY - 4);
}

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config.js';
import { drawRect, drawText, drawTextCentered, getCtx } from '../renderer.js';
import { pointInRect } from '../utils/collision.js';
import { getMouse } from '../input.js';

export function drawMainMenu(highScore) {
  const ctx = getCtx();

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Castle silhouette
  ctx.fillStyle = '#2a2a3e';
  ctx.fillRect(100, 200, 80, 340);
  ctx.fillRect(80, 240, 120, 300);
  ctx.fillRect(300, 280, 60, 260);
  ctx.fillRect(700, 250, 70, 290);
  ctx.fillRect(750, 280, 100, 260);

  // Battlements
  ctx.fillStyle = '#3a3a4e';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(80 + i * 30, 220, 20, 30);
  }
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(700 + i * 35, 240, 25, 30);
  }

  // Moon
  ctx.fillStyle = '#dde';
  ctx.beginPath();
  ctx.arc(750, 80, 40, 0, Math.PI * 2);
  ctx.fill();

  // Title
  drawTextCentered('KNIGHT ORC', 80, 32, '#fff');
  drawTextCentered('ASSAULT', 120, 32, '#c44');

  // Subtitle
  drawTextCentered('Defend your fort against the orc horde', 170, 10, '#888');

  // Play button
  const playBtn = { x: GAME_WIDTH / 2 - 120, y: 280, width: 240, height: 50 };
  const mouse = getMouse();
  const hover = pointInRect(mouse.x, mouse.y, playBtn);

  drawRect(playBtn.x, playBtn.y, playBtn.width, playBtn.height, hover ? '#484' : '#363');
  ctx.strokeStyle = '#5a5';
  ctx.lineWidth = 2;
  ctx.strokeRect(playBtn.x, playBtn.y, playBtn.width, playBtn.height);
  drawTextCentered('PLAY', 296, 18, '#fff');

  // Controls
  drawTextCentered('Controls:', 370, 10, '#888');
  drawTextCentered('WASD - Move    LMB - Attack    RMB - Block', 392, 8, '#666');
  drawTextCentered('F - Repair    G - Regroup    1 - Potion', 410, 8, '#666');

  // High Score
  drawTextCentered('High Score: ' + highScore, 440, 10, '#ffdd44');

  // Credit
  drawTextCentered('Inspired by Ninja Kiwi', GAME_HEIGHT - 30, 8, '#555');

  return playBtn;
}

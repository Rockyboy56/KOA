import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { drawRect, drawTextCentered, getCtx } from '../renderer.js';
import { pointInRect } from '../utils/collision.js';
import { getMouse } from '../input.js';

export function drawGameOver(player, wave, elapsed, highScore) {
  const ctx = getCtx();

  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  drawTextCentered('GAME OVER', 100, 32, '#c44');

  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  drawTextCentered(`You survived to Wave ${wave}`, 180, 14, '#fff');
  drawTextCentered(`Final Score: ${player.score}`, 210, 14, '#ffdd44');
  drawTextCentered(`Enemies Killed: ${player.kills}`, 240, 12, '#aaa');
  drawTextCentered(`Time: ${timeStr}`, 265, 12, '#aaa');
  drawTextCentered(`High Score: ${highScore}`, 295, 12, '#ffdd44');
  if (player.score >= highScore) {
    drawTextCentered('NEW HIGH SCORE!', 320, 14, '#ff4444');
  }

  // Retry button
  const retryBtn = { x: GAME_WIDTH / 2 - 100, y: 360, width: 200, height: 45 };
  const mouse = getMouse();
  const hover = pointInRect(mouse.x, mouse.y, retryBtn);
  drawRect(retryBtn.x, retryBtn.y, retryBtn.width, retryBtn.height, hover ? '#484' : '#363');
  ctx.strokeStyle = '#5a5';
  ctx.lineWidth = 2;
  ctx.strokeRect(retryBtn.x, retryBtn.y, retryBtn.width, retryBtn.height);
  drawTextCentered('RETRY', 374, 14, '#fff');

  return retryBtn;
}

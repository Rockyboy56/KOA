import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { drawRect, drawTextCentered, getCtx } from '../renderer.js';
import { pointInRect } from '../utils/collision.js';
import { getMouse } from '../input.js';

export function drawVictory(player, elapsed, highScore) {
  const ctx = getCtx();

  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  drawTextCentered('VICTORY!', 80, 32, '#ffdd44');
  drawTextCentered('THE ORCS RETREAT!', 120, 18, '#fff');

  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  drawTextCentered(`Final Score: ${player.score}`, 190, 16, '#ffdd44');
  drawTextCentered(`Enemies Killed: ${player.kills}`, 220, 12, '#aaa');
  drawTextCentered(`Time: ${timeStr}`, 245, 12, '#aaa');
  drawTextCentered(`High Score: ${highScore}`, 275, 12, '#ffdd44');
  if (player.score >= highScore) {
    drawTextCentered('NEW HIGH SCORE!', 300, 14, '#ff4444');
  }

  // Play again button
  const playBtn = { x: GAME_WIDTH / 2 - 120, y: 350, width: 240, height: 45 };
  const mouse = getMouse();
  const hover = pointInRect(mouse.x, mouse.y, playBtn);
  drawRect(playBtn.x, playBtn.y, playBtn.width, playBtn.height, hover ? '#484' : '#363');
  ctx.strokeStyle = '#5a5';
  ctx.lineWidth = 2;
  ctx.strokeRect(playBtn.x, playBtn.y, playBtn.width, playBtn.height);
  drawTextCentered('PLAY AGAIN', 364, 14, '#fff');

  return playBtn;
}

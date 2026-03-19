import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config.js';
import { drawRect, drawText, drawTextCentered, getCtx } from '../renderer.js';
import { pointInRect } from '../utils/collision.js';
import { getMouse } from '../input.js';

export function drawMainMenu(highScore, eliteUnlocked = false, eliteHighScore = 0) {
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

  const mouse = getMouse();

  // Play button
  const playBtn = { x: GAME_WIDTH / 2 - 120, y: 240, width: 240, height: 50 };
  const hoverPlay = pointInRect(mouse.x, mouse.y, playBtn);

  drawRect(playBtn.x, playBtn.y, playBtn.width, playBtn.height, hoverPlay ? '#484' : '#363');
  ctx.strokeStyle = '#5a5';
  ctx.lineWidth = 2;
  ctx.strokeRect(playBtn.x, playBtn.y, playBtn.width, playBtn.height);
  drawTextCentered('PLAY', playBtn.y + 16, 18, '#fff');

  // Elite Mode button (unlocked after wave 50 victory)
  let eliteBtn = null;
  if (eliteUnlocked) {
    eliteBtn = { x: GAME_WIDTH / 2 - 120, y: 305, width: 240, height: 44 };
    const hoverElite = pointInRect(mouse.x, mouse.y, eliteBtn);
    const time = performance.now() / 1000;
    const glowAlpha = 0.5 + 0.3 * Math.sin(time * 3);

    // Glowing red background
    ctx.save();
    ctx.shadowColor = `rgba(220,50,50,${glowAlpha})`;
    ctx.shadowBlur = 12;
    ctx.fillStyle = hoverElite ? '#6a1a1a' : '#4a0a0a';
    ctx.fillRect(eliteBtn.x, eliteBtn.y, eliteBtn.width, eliteBtn.height);
    ctx.restore();
    ctx.strokeStyle = hoverElite ? '#cc3333' : '#882222';
    ctx.lineWidth = 2;
    ctx.strokeRect(eliteBtn.x, eliteBtn.y, eliteBtn.width, eliteBtn.height);

    ctx.font = '14px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ff6666';
    ctx.fillText('ELITE MODE', GAME_WIDTH / 2, eliteBtn.y + 8);
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#cc4444';
    ctx.fillText('2x HP  1.5x DMG  1.15x SPD', GAME_WIDTH / 2, eliteBtn.y + 28);

    if (eliteHighScore > 0) {
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffaa44';
      ctx.fillText(`Elite Best: Wave ${eliteHighScore}`, GAME_WIDTH / 2, eliteBtn.y + 56);
    }
  }

  // Controls
  const ctrlY = eliteUnlocked ? 385 : 310;
  drawTextCentered('Controls:', ctrlY, 10, '#888');
  drawTextCentered('WASD - Move    LMB - Attack    RMB - Block', ctrlY + 22, 8, '#666');
  drawTextCentered('F - Repair    G - Regroup    1 - Potion', ctrlY + 40, 8, '#666');
  drawTextCentered('Q - War Cry    R - Shield Bash', ctrlY + 58, 8, '#666');

  // High Score
  drawTextCentered('High Score: Wave ' + highScore, ctrlY + 90, 10, '#ffdd44');

  // Credit
  drawTextCentered('Inspired by Ninja Kiwi', GAME_HEIGHT - 30, 8, '#555');

  return { playBtn, eliteBtn };
}

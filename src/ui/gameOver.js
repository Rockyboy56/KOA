import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { drawRect, drawTextCentered, getCtx } from '../renderer.js';
import { pointInRect } from '../utils/collision.js';
import { getMouse } from '../input.js';

export function drawGameOver(player, wave, elapsed, highScore, runStats = {}, eliteMode = false) {
  const ctx = getCtx();
  const mouse = getMouse();

  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Title
  const titleColor = eliteMode ? '#ff4444' : '#c44';
  drawTextCentered(eliteMode ? 'ELITE DEFEATED' : 'GAME OVER', 60, 30, titleColor);
  drawTextCentered(`Survived to Wave ${wave}`, 100, 13, '#fff');

  // Stats panel
  const panelX = GAME_WIDTH / 2 - 230;
  const panelY = 125;
  const panelW = 460;
  const panelH = 200;

  ctx.fillStyle = 'rgba(30,20,10,0.85)';
  ctx.strokeStyle = '#806030';
  ctx.lineWidth = 2;
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  // Stats grid (2 columns)
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  const stats = [
    ['Score', player.score],
    ['Kills', player.kills],
    ['Time', timeStr],
    ['Gold Earned', runStats.goldEarned || 0],
    ['Buildings', runStats.buildingsBought || 0],
    ['Potions Used', runStats.potionsUsed || player.potionsUsed || 0],
    ['Weapon Upgrades', runStats.weaponUpgrades || player.weaponUpgrades || 0],
    ['Kill Streak Best', runStats.highestKillStreak || 0],
    ['Damage Taken', runStats.totalDamageTaken || player.totalDamageTaken || 0],
    ['Troops Hired', runStats.troopsHired || 0],
  ];

  const colW = panelW / 2;
  const rowH = 18;
  const startX = panelX + 12;
  const startY = panelY + 14;

  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textBaseline = 'top';

  for (let i = 0; i < stats.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * colW;
    const y = startY + row * rowH;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#a09070';
    ctx.fillText(stats[i][0] + ':', x, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffdd88';
    ctx.fillText(String(stats[i][1]), x + colW - 24, y);
  }

  // High score line
  const hsY = panelY + panelH + 12;
  drawTextCentered(`High Score: Wave ${highScore}`, hsY, 10, '#ffdd44');
  if (wave >= highScore) {
    drawTextCentered('NEW BEST!', hsY + 18, 10, '#ff6644');
  }

  // Buttons
  const btnY = hsY + 46;
  const retryBtn = { x: GAME_WIDTH / 2 - 210, y: btnY, width: 190, height: 42 };
  const menuBtn = { x: GAME_WIDTH / 2 + 20, y: btnY, width: 190, height: 42 };

  const hoverRetry = pointInRect(mouse.x, mouse.y, retryBtn);
  const hoverMenu = pointInRect(mouse.x, mouse.y, menuBtn);

  drawRect(retryBtn.x, retryBtn.y, retryBtn.width, retryBtn.height, hoverRetry ? '#484' : '#363');
  ctx.strokeStyle = '#5a5';
  ctx.lineWidth = 2;
  ctx.strokeRect(retryBtn.x, retryBtn.y, retryBtn.width, retryBtn.height);
  ctx.font = '12px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText('RETRY', retryBtn.x + retryBtn.width / 2, retryBtn.y + retryBtn.height / 2);

  drawRect(menuBtn.x, menuBtn.y, menuBtn.width, menuBtn.height, hoverMenu ? '#446' : '#334');
  ctx.strokeStyle = '#448';
  ctx.lineWidth = 2;
  ctx.strokeRect(menuBtn.x, menuBtn.y, menuBtn.width, menuBtn.height);
  ctx.fillStyle = '#ccddff';
  ctx.fillText('MENU', menuBtn.x + menuBtn.width / 2, menuBtn.y + menuBtn.height / 2);

  return { retryBtn, menuBtn };
}

import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { drawRect, drawTextCentered, getCtx } from '../renderer.js';
import { pointInRect } from '../utils/collision.js';
import { getMouse } from '../input.js';

export function drawVictory(player, elapsed, highScore, runStats = {}, eliteMode = false) {
  const ctx = getCtx();
  const mouse = getMouse();

  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (eliteMode) {
    // Elite champion variant
    const time = performance.now() / 1000;
    const glow = 0.6 + 0.4 * Math.sin(time * 3);
    ctx.save();
    ctx.shadowColor = `rgba(255,80,80,${glow})`;
    ctx.shadowBlur = 20;
    drawTextCentered('ELITE CHAMPION!', 55, 28, '#ff6666');
    ctx.restore();
    drawTextCentered('THE ORC WARLORD IS SLAIN!', 92, 12, '#ffaaaa');
    drawTextCentered('Unlocked: Elite Mode', 112, 9, '#ff8888');
  } else {
    drawTextCentered('VICTORY!', 55, 30, '#ffdd44');
    drawTextCentered('THE ORCS RETREAT!', 92, 14, '#fff');
    drawTextCentered('Elite Mode Unlocked!', 114, 9, '#ffaa44');
  }

  // Stats panel
  const panelX = GAME_WIDTH / 2 - 230;
  const panelY = 132;
  const panelW = 460;
  const panelH = 200;

  ctx.fillStyle = eliteMode ? 'rgba(40,10,10,0.85)' : 'rgba(10,30,10,0.85)';
  ctx.strokeStyle = eliteMode ? '#882222' : '#406020';
  ctx.lineWidth = 2;
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeRect(panelX, panelY, panelW, panelH);

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
    ctx.fillStyle = eliteMode ? '#a07060' : '#80a060';
    ctx.fillText(stats[i][0] + ':', x, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffdd88';
    ctx.fillText(String(stats[i][1]), x + colW - 24, y);
  }

  // High score line
  const hsY = panelY + panelH + 12;
  drawTextCentered(`Best: Wave ${highScore}`, hsY, 10, '#ffdd44');

  // Buttons
  const btnY = hsY + 40;
  const playBtn = { x: GAME_WIDTH / 2 - 210, y: btnY, width: 190, height: 42 };
  const menuBtn = { x: GAME_WIDTH / 2 + 20, y: btnY, width: 190, height: 42 };

  const hoverPlay = pointInRect(mouse.x, mouse.y, playBtn);
  const hoverMenu = pointInRect(mouse.x, mouse.y, menuBtn);

  drawRect(playBtn.x, playBtn.y, playBtn.width, playBtn.height, hoverPlay ? '#484' : '#363');
  ctx.strokeStyle = '#5a5';
  ctx.lineWidth = 2;
  ctx.strokeRect(playBtn.x, playBtn.y, playBtn.width, playBtn.height);
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText('PLAY AGAIN', playBtn.x + playBtn.width / 2, playBtn.y + playBtn.height / 2);

  drawRect(menuBtn.x, menuBtn.y, menuBtn.width, menuBtn.height, hoverMenu ? '#446' : '#334');
  ctx.strokeStyle = '#448';
  ctx.lineWidth = 2;
  ctx.strokeRect(menuBtn.x, menuBtn.y, menuBtn.width, menuBtn.height);
  ctx.fillStyle = '#ccddff';
  ctx.fillText('MENU', menuBtn.x + menuBtn.width / 2, menuBtn.y + menuBtn.height / 2);

  return { playBtn, menuBtn };
}

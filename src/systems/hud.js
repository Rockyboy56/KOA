import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { drawBar, drawText, drawTextCentered, drawRect } from '../renderer.js';

export function drawHUD(player, waveManager, economy) {
  const ctx = document.getElementById('game').getContext('2d');

  // Top bar background
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, GAME_WIDTH, 44);

  // HP Bar
  drawText('HP', 8, 6, 8, '#f88');
  drawBar(32, 6, 160, 12, player.hp / player.maxHP, '#cc3333', '#441111');
  drawText(`${Math.ceil(player.hp)}/${player.maxHP}`, 196, 6, 8);

  // XP Bar
  drawText('XP', 8, 24, 8, '#ff8');
  drawBar(32, 24, 160, 10, player.xp / player.xpToNext, '#cccc33', '#444411');
  drawText(`Lv.${player.level}`, 196, 24, 8);

  // Wave counter
  drawText(`Wave ${waveManager.wave}/50`, 340, 6, 10);

  // Enemies remaining
  const alive = waveManager.enemiesAlive;
  if (waveManager.active) {
    drawText(`Enemies: ${alive}`, 340, 24, 8, '#f88');
  }

  // Gold
  drawText(`Gold: ${economy.gold}`, 600, 6, 10, '#ffdd44');

  // Score
  drawText(`Score: ${player.score}`, 600, 24, 8, '#aaa');

  // Bottom bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, GAME_HEIGHT - 28, GAME_WIDTH, 28);

  drawText('[1] Potion x' + player.potions, 10, GAME_HEIGHT - 22, 8, '#8cf');
  drawText('[F] Repair', 200, GAME_HEIGHT - 22, 8, '#8cf');
  drawText('[G] Regroup', 360, GAME_HEIGHT - 22, 8, '#8cf');
  drawText('[RMB] Block', 530, GAME_HEIGHT - 22, 8, '#8cf');
  drawText('[LMB] Attack', 710, GAME_HEIGHT - 22, 8, '#8cf');
}

export function drawWaveAnnouncement(wave, timer) {
  if (timer <= 0) return;
  const ctx = document.getElementById('game').getContext('2d');
  const alpha = Math.min(1, timer);
  ctx.globalAlpha = alpha;
  drawTextCentered(`WAVE ${wave}`, 180, 28, '#fff');
  ctx.globalAlpha = 1;
}

export function drawTutorial(step, timer) {
  if (timer <= 0) return;
  const ctx = document.getElementById('game').getContext('2d');
  const alpha = Math.min(1, timer);
  ctx.globalAlpha = alpha;

  const messages = [
    'WASD to move',
    'Click to attack',
    'Strike the orcs!',
    'Collect the gold!',
  ];

  if (step < messages.length) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const text = messages[step];
    const w = text.length * 12 + 20;
    ctx.fillRect(GAME_WIDTH / 2 - w / 2, GAME_HEIGHT - 80, w, 30);
    drawTextCentered(text, GAME_HEIGHT - 74, 12, '#fff');
  }
  ctx.globalAlpha = 1;
}

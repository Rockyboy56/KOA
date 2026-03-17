import { GAME_WIDTH, GAME_HEIGHT, PLAYER, getWaveBonus } from './config.js';
import { initInput, clearFrameInput, getMouse, isRegroup, isRepair } from './input.js';
import { initRenderer, clearScreen, drawBackground, updateShake, endShake, getCtx } from './renderer.js';
import { createPlayer, updatePlayer, drawPlayer, recalcStats, addXP } from './entities/player.js';
import { updateEnemy, drawEnemy } from './entities/enemy.js';
import { createBarricade, drawBarricade, repairBarricade, upgradeBarricade } from './entities/barricade.js';
import { updateGoldDrops, drawGoldDrop, createGoldDrop } from './entities/goldDrop.js';
import { updateProjectiles, drawProjectile } from './entities/projectile.js';
import { createTroop, updateTroop, drawTroop } from './entities/troop.js';
import { createWaveManager, startNextWave, updateWaveSpawning } from './systems/waveManager.js';
import { processCombat, updateFloatingTexts, drawFloatingTexts, createFloatingText } from './systems/combat.js';
import { createEconomy } from './systems/economy.js';
import { drawHUD, drawWaveAnnouncement, drawTutorial } from './systems/hud.js';
import { drawShop, updateShop, resetShop } from './systems/shopUI.js';
import { drawMainMenu } from './ui/mainMenu.js';
import { drawGameOver } from './ui/gameOver.js';
import { drawVictory } from './ui/victory.js';
import { dist } from './utils/math.js';
import { pointInRect } from './utils/collision.js';

// --- Game State ---
let state = 'menu'; // menu, playing, shop, gameOver, victory
let player, barricade, waveManager, economy;
let enemies = [];
let goldDrops = [];
let projectiles = [];
let troops = [];
let floatingTexts = [];
let elapsedTime = 0;
let waveAnnouncementTimer = 0;
let tutorialStep = 0;
let tutorialTimer = 0;
let hasMoved = false;
let hasAttacked = false;
let hasKilled = false;

function init() {
  const canvas = initRenderer();
  initInput(canvas);
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  player = createPlayer();
  recalcStats(player);
  barricade = createBarricade(0, player.barricadeHPMult);
  waveManager = createWaveManager();
  economy = createEconomy();
  enemies = [];
  goldDrops = [];
  projectiles = [];
  troops = [];
  floatingTexts = [];
  elapsedTime = 0;
  tutorialStep = 0;
  tutorialTimer = 5;
  hasMoved = false;
  hasAttacked = false;
  hasKilled = false;
}

// --- Game Loop ---
let lastTime = 0;

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  const mouse = getMouse();
  const mouseClicked = mouse.leftDown;

  clearScreen();

  switch (state) {
    case 'menu':
      updateMenu(mouseClicked, mouse);
      break;
    case 'playing':
      updatePlaying(dt, mouseClicked, mouse);
      break;
    case 'shop':
      updateShopState(dt, mouseClicked, mouse);
      break;
    case 'gameOver':
      updateGameOver(mouseClicked, mouse);
      break;
    case 'victory':
      updateVictoryState(mouseClicked, mouse);
      break;
  }

  clearFrameInput();
  requestAnimationFrame(gameLoop);
}

// --- Menu ---
function updateMenu(mouseClicked, mouse) {
  const playBtn = drawMainMenu();
  if (mouseClicked && pointInRect(mouse.x, mouse.y, playBtn)) {
    resetGame();
    state = 'playing';
    startWave();
  }
}

// --- Playing ---
function startWave() {
  startNextWave(waveManager);
  waveAnnouncementTimer = 2.5;

  // Respawn troops
  troops = [];
  for (const [typeKey, count] of Object.entries(economy.troopCounts)) {
    for (let i = 0; i < count; i++) {
      troops.push(createTroop(typeKey, player.troopDmgMult));
    }
  }

  player.damageTakenThisWave = 0;
}

function updatePlaying(dt, mouseClicked, mouse) {
  elapsedTime += dt;
  waveAnnouncementTimer -= dt;

  // Update player (pass mouse position for facing)
  updatePlayer(player, dt, barricade, mouse.x, mouse.y);

  // Repair barricade
  if (player.repairing) {
    const cost = repairBarricade(barricade, dt, economy.gold);
    economy.gold -= cost;
  }

  // Gold collection
  const pickupRadius = PLAYER.goldPickupRadius + player.goldPickupBonus;
  for (const g of goldDrops) {
    if (!g.alive) continue;
    const d = dist(player.x + player.width / 2, player.y + player.height / 2, g.x + 6, g.y + 6);
    if (d < pickupRadius) {
      economy.gold += g.amount;
      floatingTexts.push(createFloatingText(g.x, g.y - 10, '+' + g.amount, '#ffdd44'));
      g.alive = false;
      if (!hasKilled && tutorialStep === 3) { tutorialStep = 4; tutorialTimer = 0; }
    }
  }

  // Regroup troops
  let regroupPos = null;
  if (isRegroup()) {
    regroupPos = { x: player.x, y: player.y };
  }

  // Update troops
  for (const t of troops) {
    const attack = updateTroop(t, dt, enemies, regroupPos);
    if (attack) {
      // Apply troop attack
      const { target, damage, aoe } = attack;
      if (target.alive) {
        const dealt = target.hp;
        target.hp -= damage;
        target.flashTimer = 0.1;
        if (target.hp <= 0) {
          target.hp = 0;
          target.alive = false;
          target.deathTimer = 0.3;
          addXP(player, target.xp);
          player.score += target.score;
          player.kills++;
          goldDrops.push(createGoldDrop(target.x, target.y, Math.round(
            (target.goldMin + Math.random() * (target.goldMax - target.goldMin)) * player.goldDropMult
          )));
        }
        floatingTexts.push(createFloatingText(target.x, target.y - 10, damage, '#8cf'));
      }
    }
  }

  // Update entities
  updateWaveSpawning(waveManager, dt, enemies, waveManager.wave);

  for (const e of enemies) {
    updateEnemy(e, dt, player.x + player.width / 2, player.y + player.height / 2, barricade.x + barricade.width, !barricade.destroyed);
  }

  // Combat
  processCombat(dt, player, enemies, barricade, goldDrops, projectiles, troops, floatingTexts);

  // Update projectiles and gold drops
  updateProjectiles(projectiles, dt);
  updateGoldDrops(goldDrops, dt);
  updateFloatingTexts(floatingTexts, dt);

  // Clean up dead enemies
  enemies = enemies.filter(e => e.alive || e.deathTimer > 0);

  // Tutorial logic
  if (tutorialStep === 0 && (player.x !== PLAYER.startX || player.y !== PLAYER.startY)) {
    tutorialStep = 1; tutorialTimer = 3;
  }
  if (tutorialStep === 1 && player.attacking) {
    tutorialStep = 2; tutorialTimer = 3; hasAttacked = true;
  }
  if (tutorialStep === 2 && player.kills > 0 && !hasKilled) {
    tutorialStep = 3; tutorialTimer = 3; hasKilled = true;
  }
  if (tutorialTimer > 0) tutorialTimer -= dt;

  // Check game over
  if (player.hp <= 0) {
    state = 'gameOver';
    return;
  }

  // Check wave complete
  if (waveManager.waveComplete) {
    // Wave completion bonus
    const bonus = getWaveBonus(waveManager.wave);
    economy.gold += bonus;
    player.score += 100 + waveManager.wave * 20;

    // No damage bonus
    if (player.damageTakenThisWave === 0) {
      player.score += 200;
      floatingTexts.push(createFloatingText(GAME_WIDTH / 2, 200, 'NO DAMAGE BONUS! +200', '#ff0'));
    }

    // Barricade intact bonus
    if (!barricade.destroyed) {
      player.score += 50;
    }

    if (waveManager.allWavesComplete) {
      state = 'victory';
      return;
    }

    state = 'shop';
    resetShop();
    return;
  }

  // --- Draw ---
  drawBackground();
  updateShake(dt);

  // Barricade
  drawBarricade(barricade);

  // Gold drops
  for (const g of goldDrops) drawGoldDrop(g);

  // Troops
  for (const t of troops) drawTroop(t);

  // Enemies (sort by y for depth)
  enemies.sort((a, b) => a.y - b.y);
  for (const e of enemies) drawEnemy(e);

  // Projectiles
  for (const p of projectiles) drawProjectile(p);

  // Player
  drawPlayer(player);

  // Floating texts
  drawFloatingTexts(floatingTexts);

  endShake();

  // HUD
  drawHUD(player, waveManager, economy);

  // Wave announcement
  if (waveAnnouncementTimer > 0) {
    drawWaveAnnouncement(waveManager.wave, waveAnnouncementTimer);
  }

  // Tutorial
  if (waveManager.wave === 1 && tutorialStep < 4) {
    drawTutorial(tutorialStep, tutorialTimer);
  }
}

// --- Shop ---
function updateShopState(dt, mouseClicked, mouse) {
  updateShop(player, economy, mouseClicked);
  const startBtn = drawShop(player, economy, waveManager);

  if (mouseClicked && pointInRect(mouse.x, mouse.y, startBtn)) {
    state = 'playing';

    // Check if barricade can be upgraded
    const bLevel = barricade.level;
    const upgrades = ['lumberMill', 'stoneworks', 'masonry', 'forge'];
    for (let i = bLevel; i < upgrades.length; i++) {
      if (economy.buildings[upgrades[i]]) {
        upgradeBarricade(barricade, i + 1, player.barricadeHPMult);
      }
    }

    // Heal 10% between waves
    player.hp = Math.min(player.maxHP, player.hp + player.maxHP * 0.1);

    startWave();
  }
}

// --- Game Over ---
function updateGameOver(mouseClicked, mouse) {
  drawBackground();
  drawBarricade(barricade);
  for (const e of enemies) drawEnemy(e);
  drawPlayer(player);

  const retryBtn = drawGameOver(player, waveManager.wave, elapsedTime);
  if (mouseClicked && pointInRect(mouse.x, mouse.y, retryBtn)) {
    resetGame();
    state = 'playing';
    startWave();
  }
}

// --- Victory ---
function updateVictoryState(mouseClicked, mouse) {
  const playBtn = drawVictory(player, elapsedTime);
  if (mouseClicked && pointInRect(mouse.x, mouse.y, playBtn)) {
    resetGame();
    state = 'playing';
    startWave();
  }
}

// --- Start ---
init();

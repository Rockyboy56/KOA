import { WORLD_W, WORLD_H, VIEW_W, VIEW_H, FORT, PLAYER, getWaveBonus, ENEMIES, ELITE_MODE, ACTIVE_SKILLS } from './config.js';
import { initInput, clearFrameInput, getMouse, isRegroup, isRepair, isPause, isMuteToggle, isSkillQ, isSkillR } from './input.js';
import { initAudio, ensureContext, toggleMute, isMuted, playWaveStart, playBossSpawn, playGoldPickup, playLevelUp, playShopClick, playRepair, startMusic, stopMusic, setBossIntensity, playHordeDrum, playWarCryHorn } from './systems/audio.js';
import { initRenderer, clearScreen, drawBackground, drawTextCentered, updateShake, endShake, getCtx, startFade, updateFade, drawFade, rebuildBackground, drawBuildingVisuals, drawTorchFlicker } from './renderer.js';
import { createPlayer, updatePlayer, drawPlayer, recalcStats, addXP } from './entities/player.js';
import { createEnemy, updateEnemy, drawEnemy, damageEnemy } from './entities/enemy.js';
import { createBarricades, drawBarricades, repairWall, upgradeBarricades, getNearestWall, getWallSegments } from './entities/barricade.js';
import { updateGoldDrops, drawGoldDrop, createGoldDrop } from './entities/goldDrop.js';
import { updateProjectiles, drawProjectile } from './entities/projectile.js';
import { createTroop, updateTroop, drawTroop } from './entities/troop.js';
import { createWaveManager, startNextWave, updateWaveSpawning, getSpawnSides, getSpawnPosition } from './systems/waveManager.js';
import { processCombat, updateFloatingTexts, createFloatingText, handleEnemyDeath, activateWarCry, activateShieldBash } from './systems/combat.js';
import { createEconomy, applyWaveEndPassives, getBuildingDamageMult, getEquippedWeapon as getEquippedWeaponForBash } from './systems/economy.js';
import { drawHUD, drawWaveAnnouncement, drawTutorial, drawBossHP, drawDamageNumbers, resetHUDState, showHordeBanner, updateHordeBanner, drawHordeBanner, drawBossIntroCard } from './systems/hud.js';
import { updateParticles, drawParticles, drawScreenParticles, spawnDeathBurst, spawnGoldSparkle, spawnBossFlash, updateScreenFlash, updateAmbient, resetParticles, spawnCritRing } from './systems/particles.js';
import { drawShop, updateShop, resetShop } from './systems/shopUI.js';
import { drawMainMenu } from './ui/mainMenu.js';
import { drawGameOver } from './ui/gameOver.js';
import { drawVictory } from './ui/victory.js';
import { createCamera, updateCamera, applyCameraTransform, resetCameraTransform } from './systems/camera.js';
import { drawMinimap } from './systems/minimap.js';
import { dist } from './utils/math.js';
import { pointInRect } from './utils/collision.js';

// --- High Score ---
let highScore = parseInt(localStorage.getItem('koa_highscore') || '0', 10);
let eliteHighScore = parseInt(localStorage.getItem('koa_elite_highscore') || '0', 10);
let eliteUnlocked = localStorage.getItem('koa_elite_unlocked') === 'true';

// --- Game State ---
let state = 'menu'; // menu, playing, shop, gameOver, victory, paused
let eliteMode = false;
let player, walls, waveManager, economy, camera;
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
let wave2TutorialTimer = 0;
let waveCompleteTimer = 0;
let waveCompleteShown = false;
let waveCompleteGold = 0;
let waveCompleteCrystals = 0;
let waveCompleteWallBonus = 0;
let lastRepairSoundTime = 0;
let prevPlayerLevel = 1;

// Kill streak tracking
let killStreakCount = 0;
let killStreakTimer = 0;
let killStreakText = '';
let killStreakShowTimer = 0;

// Level up effect
let levelUpTextTimer = 0;

// Track kills for streak detection
let prevKills = 0;

// Run stats
let runStats = {
  goldEarned: 0,
  buildingsBought: 0,
  highestKillStreak: 0,
  potionsUsed: 0,
  weaponUpgrades: 0,
  totalDamageTaken: 0,
  troopsHired: 0,
};

// Boss intro card
let bossIntroTimer = 0;
let bossIntroData = null;

function init() {
  const canvas = initRenderer();
  initInput(canvas);
  requestAnimationFrame(gameLoop);
}

function resetGame(elite = false) {
  eliteMode = elite;
  player = createPlayer();
  recalcStats(player);
  walls = createBarricades(0, player.barricadeHPMult);
  waveManager = createWaveManager();
  waveManager.eliteMode = elite;
  economy = createEconomy();
  camera = createCamera();
  camera.x = 900 - VIEW_W / 2;
  camera.y = 600 - VIEW_H / 2;
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
  wave2TutorialTimer = 0;
  waveCompleteTimer = 0;
  waveCompleteShown = false;
  waveCompleteGold = 0;
  waveCompleteCrystals = 0;
  waveCompleteWallBonus = 0;
  prevPlayerLevel = 1;
  lastRepairSoundTime = 0;
  killStreakCount = 0;
  killStreakTimer = 0;
  killStreakText = '';
  killStreakShowTimer = 0;
  levelUpTextTimer = 0;
  prevKills = 0;
  bossIntroTimer = 0;
  bossIntroData = null;
  runStats = {
    goldEarned: 0,
    buildingsBought: 0,
    highestKillStreak: 0,
    potionsUsed: 0,
    weaponUpgrades: 0,
    totalDamageTaken: 0,
    troopsHired: 0,
  };
  resetParticles();
  resetHUDState();
}

// --- Game Loop ---
let lastTime = 0;

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  const mouse = getMouse();
  const mouseClicked = mouse.leftDown;

  // Global mute toggle (works in all states)
  if (isMuteToggle()) { toggleMute(); }

  clearScreen();

  switch (state) {
    case 'menu':
      updateMenu(mouseClicked, mouse);
      break;
    case 'playing':
      updatePlaying(dt, mouseClicked, mouse);
      break;
    case 'paused':
      updatePaused(mouseClicked);
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

  updateFade(dt);
  drawFade();

  clearFrameInput();
  requestAnimationFrame(gameLoop);
}

// --- Menu ---
function updateMenu(mouseClicked, mouse) {
  const { playBtn, eliteBtn } = drawMainMenu(highScore, eliteUnlocked, eliteHighScore);
  if (mouseClicked && pointInRect(mouse.x, mouse.y, playBtn)) {
    ensureContext();
    startFade(1, 3, () => {
      resetGame(false);
      state = 'playing';
      startWave();
      startMusic(false);
      startFade(0, 3);
    });
  }
  if (eliteBtn && mouseClicked && pointInRect(mouse.x, mouse.y, eliteBtn)) {
    ensureContext();
    startFade(1, 3, () => {
      resetGame(true);
      state = 'playing';
      startWave();
      startMusic(false);
      startFade(0, 3);
    });
  }
}

// --- Playing ---
function startWave() {
  startNextWave(waveManager);
  waveAnnouncementTimer = 2.5;
  waveCompleteShown = false;
  waveCompleteTimer = 0;

  // Audio: wave start horn + boss detection
  playWaveStart();
  const hasBoss = waveManager.spawnQueue && waveManager.spawnQueue.includes('titan');
  if (hasBoss) {
    playBossSpawn();
    spawnBossFlash();
    setBossIntensity(true);

    // Boss intro card: pick named boss based on wave
    // Boss waves are 15, 25, 35, 45, 50 → mapped to bosses[0..4]
    const bosses = ENEMIES.titan.bosses || [];
    const bossIndex = waveManager.wave === 50
      ? Math.min(4, bosses.length - 1)
      : Math.min(Math.floor((waveManager.wave - 15) / 10), bosses.length - 1);
    bossIntroData = bosses[bossIndex] || { name: 'The Titan', lore: 'A fearsome warrior.' };
    bossIntroTimer = 4.0;
  } else {
    setBossIntensity(false);
    bossIntroData = null;
    bossIntroTimer = 0;
  }

  // Wave 2 tutorial: blocking hint
  if (waveManager.wave === 2) {
    wave2TutorialTimer = 4;
  }

  // Respawn troops distributed across gates
  troops = [];
  const gateKeys = ['north', 'south', 'east', 'west'];
  let gateIdx = 0;
  for (const [typeKey, count] of Object.entries(economy.troopCounts)) {
    for (let i = 0; i < count; i++) {
      troops.push(createTroop(typeKey, player.troopDmgMult, gateKeys[gateIdx % 4]));
      gateIdx++;
    }
  }

  player.damageTakenThisWave = 0;
}

function updatePlaying(dt, mouseClicked, mouse) {
  // Pause check
  if (isPause()) { stopMusic(); state = 'paused'; return; }

  // Boss intro card freeze: skip updates but still draw
  if (bossIntroTimer > 0) {
    bossIntroTimer -= dt;
    drawGameScene(0);
    return;
  }

  // Hit stop: freeze all game updates briefly on killing blows
  if (player.hitStopTimer > 0) { player.hitStopTimer -= dt; drawGameScene(0); return; }

  elapsedTime += dt;
  waveAnnouncementTimer -= dt;
  if (wave2TutorialTimer > 0) wave2TutorialTimer -= dt;

  // Horde event: trigger once per wave (waves 10,20,30,40) when first enemy has spawned
  if (waveManager.hordeEventPending && !waveManager.hordeEventFired && enemies.length > 0) {
    waveManager.hordeEventFired = true;
    waveManager.hordeEventPending = false;
    showHordeBanner();
    playHordeDrum();
    // Spawn 15 frenzied raiders from all active sides simultaneously
    const hordeSides = getSpawnSides(waveManager.wave);
    for (let i = 0; i < 15; i++) {
      const side = hordeSides[i % hordeSides.length];
      const pos = getSpawnPosition(side);
      const hordeRaider = createEnemy('raider', waveManager.wave, pos.x, pos.y, side, eliteMode);
      hordeRaider.speed *= 1.5; // frenzied speed
      hordeRaider.buffed = true; // mark as horde member
      enemies.push(hordeRaider);
      waveManager.enemiesAlive++;
    }
  }

  // Active skills (Q = War Cry, R = Shield Bash)
  if (isSkillQ() && player.activeSkills && player.activeSkills.includes('warCry')) {
    const cd = player.skillCooldowns && player.skillCooldowns['warCry'] || 0;
    if (cd <= 0) {
      const aliveEnemies = enemies.filter(e => e.alive);
      if (aliveEnemies.length > 0) {
        activateWarCry(player, enemies, floatingTexts);
        playWarCryHorn();
      }
      // If no enemies alive, skill does nothing and cooldown is not consumed
    }
  }
  if (isSkillR() && player.activeSkills && player.activeSkills.includes('shieldBash')) {
    const cd = player.skillCooldowns && player.skillCooldowns['shieldBash'] || 0;
    if (cd <= 0) {
      // Shield Bash requires a shield (not usable with 2h or ranged weapon types)
      const bashWeapon = getEquippedWeaponForBash(player);
      if (bashWeapon && (bashWeapon.type === '2h' || bashWeapon.type === 'ranged')) {
        floatingTexts.push(createFloatingText(player.x + player.width / 2, player.y - 20, 'Requires shield', '#ff8800'));
      } else {
        activateShieldBash(player, enemies);
      }
    }
  }

  // Wave complete celebration overlay
  if (waveCompleteShown && waveCompleteTimer > 0) {
    waveCompleteTimer -= dt;

    // Sync run stats at wave end
    runStats.buildingsBought = economy.buildingsBought || 0;
    runStats.troopsHired = economy.troopsHired || 0;
    runStats.potionsUsed = player.potionsUsed || 0;
    runStats.weaponUpgrades = player.weaponUpgrades || 0;
    runStats.totalDamageTaken = player.totalDamageTaken || 0;

    // Draw frozen game scene
    drawGameScene(dt);

    // Styled wave complete overlay
    const ctx = getCtx();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Decorative gold separator line (above title)
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(VIEW_W / 2 - 100, 195, 200, 2);

    // Large centered title in gold
    drawTextCentered(`WAVE ${waveManager.wave} COMPLETE!`, 210, 24, '#ffdd44');

    // Decorative gold separator line (below title)
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(VIEW_W / 2 - 100, 240, 200, 2);

    // Reward line: gold earned
    drawTextCentered(`Gold earned: +${waveCompleteGold}g`, 258, 12, '#ffffff');

    // Crystals earned (if any)
    if (waveCompleteCrystals > 0) {
      drawTextCentered(`Crystals: +${waveCompleteCrystals}`, 278, 10, '#88ccff');
    }

    // Wall bonus (if any)
    if (waveCompleteWallBonus > 0) {
      drawTextCentered(`+${waveCompleteWallBonus} wall bonus`, waveCompleteCrystals > 0 ? 296 : 278, 10, '#88ff88');
    }

    if (waveCompleteTimer <= 0) {
      // Transition to shop or victory
      if (waveManager.allWavesComplete) {
        // Unlock elite mode on wave 50 victory
        if (!eliteUnlocked) {
          eliteUnlocked = true;
          localStorage.setItem('koa_elite_unlocked', 'true');
        }
        saveHighScore();
        stopMusic();
        state = 'victory';
      } else {
        stopMusic();
        startFade(1, 4, () => {
          state = 'shop';
          resetShop();
          playShopClick();
          startFade(0, 4);
        });
      }
    }
    return;
  }

  // Update horde banner
  updateHordeBanner(dt);

  // Update camera
  updateCamera(camera, player.x + player.width / 2, player.y + player.height / 2, dt);

  // Update player (pass camera-adjusted mouse coords)
  updatePlayer(player, dt, walls, mouse.x, mouse.y, camera.x, camera.y);

  // Repair wall
  if (player.repairing && player.repairingSide) {
    const wall = walls[player.repairingSide];
    if (wall) {
      const cost = repairWall(wall, dt, economy.gold);
      economy.gold -= cost;
      // Repair sound throttled to once per 0.5s
      if (elapsedTime - lastRepairSoundTime > 0.5) {
        playRepair();
        lastRepairSoundTime = elapsedTime;
      }
    }
  }

  // Gold collection
  const pickupRadius = PLAYER.goldPickupRadius + player.goldPickupBonus;
  for (const g of goldDrops) {
    if (!g.alive) continue;
    const d = dist(player.x + player.width / 2, player.y + player.height / 2, g.x + 6, g.y + 6);
    if (d < pickupRadius) {
      economy.gold += g.amount;
      runStats.goldEarned += g.amount;
      floatingTexts.push(createFloatingText(g.x, g.y - 10, '+' + g.amount, '#ffdd44'));
      spawnGoldSparkle(g.x + 6, g.y + 6);
      playGoldPickup();
      g.alive = false;
      if (!hasKilled && tutorialStep === 3) { tutorialStep = 4; tutorialTimer = 0; }
    }
  }

  // Regroup troops
  let regroupPos = null;
  if (isRegroup()) {
    regroupPos = { x: player.x, y: player.y };
  }

  // Update troops (route through damageEnemy + shared handleEnemyDeath)
  const playerCX = player.x + player.width / 2;
  const playerCY = player.y + player.height / 2;
  for (const t of troops) {
    const attack = updateTroop(t, dt, enemies, regroupPos, walls);
    if (attack) {
      if (attack.spawnProjectile) {
        const { x, y, angle, damage } = attack.spawnProjectile;
        const proj = createProjectile(x, y, angle, damage, 400, 'troopArrow');
        proj.lifeTime = 1.2;
        projectiles.push(proj);
      } else {
        const { target, damage } = attack;
        if (target.alive) {
          const dealt = damageEnemy(target, damage);
          if (dealt > 0) {
            floatingTexts.push(createFloatingText(target.x + target.width / 2, target.y - 10, dealt, '#8cf'));
          }
          if (!target.alive) {
            handleEnemyDeath(target, player, goldDrops, floatingTexts);
          }
        }
      }
    }
  }

  // Update entities
  updateWaveSpawning(waveManager, dt, enemies, waveManager.wave);

  // Pre-update passive: set moat slow flags BEFORE enemy movement
  if (economy.buildings.moat) {
    for (const e of enemies) {
      if (!e.alive || e.insideFort) { e._moatSlowed = false; continue; }
      const ecx = e.x + e.width / 2;
      const ecy = e.y + e.height / 2;
      let nearWall = Infinity;
      for (const side of ['north', 'south', 'east', 'west']) {
        const wall = walls[side];
        if (!wall) continue;
        for (const seg of getWallSegments(wall)) {
          const nx = Math.max(seg.x, Math.min(ecx, seg.x + seg.w));
          const ny = Math.max(seg.y, Math.min(ecy, seg.y + seg.h));
          const d = dist(ecx, ecy, nx, ny);
          if (d < nearWall) nearWall = d;
        }
      }
      e._moatSlowed = nearWall < 100;
    }
  }

  for (const e of enemies) {
    updateEnemy(e, dt, playerCX, playerCY, walls);
  }

  // Post-update passive: spiked barricades damage
  if (economy.buildings.spikedBarricades) {
    for (const e of enemies) {
      if (!e.alive || e.insideFort) continue;
      const ecx = e.x + e.width / 2;
      const ecy = e.y + e.height / 2;
      let nearWall = Infinity;
      for (const side of ['north', 'south', 'east', 'west']) {
        const wall = walls[side];
        if (!wall) continue;
        for (const seg of getWallSegments(wall)) {
          const nx = Math.max(seg.x, Math.min(ecx, seg.x + seg.w));
          const ny = Math.max(seg.y, Math.min(ecy, seg.y + seg.h));
          const d = dist(ecx, ecy, nx, ny);
          if (d < nearWall) nearWall = d;
        }
      }
      if (nearWall < 40) {
        e.hp -= 5 * dt;
        if (e.hp <= 0) { e.hp = 0; e.alive = false; e.deathTimer = 0.3; handleEnemyDeath(e, player, goldDrops, floatingTexts); }
      }
    }
  }

  // Combat
  processCombat(dt, player, enemies, walls, goldDrops, projectiles, troops, floatingTexts);

  // Kill streak detection
  if (player.kills > prevKills) {
    const newKills = player.kills - prevKills;
    killStreakCount += newKills;
    killStreakTimer = 3.0;
    if (killStreakCount > runStats.highestKillStreak) runStats.highestKillStreak = killStreakCount;
    if (killStreakCount >= 20) { killStreakText = 'UNSTOPPABLE!'; killStreakShowTimer = 2.0; }
    else if (killStreakCount >= 10) { killStreakText = 'RAMPAGE!'; killStreakShowTimer = 2.0; }
    else if (killStreakCount >= 5) { killStreakText = 'KILLING SPREE!'; killStreakShowTimer = 2.0; }
    prevKills = player.kills;
  }
  if (killStreakTimer > 0) {
    killStreakTimer -= dt;
    if (killStreakTimer <= 0) { killStreakCount = 0; }
  }
  if (killStreakShowTimer > 0) killStreakShowTimer -= dt;

  // Level up sound detection + visual effect
  if (player.level > prevPlayerLevel) {
    playLevelUp();
    prevPlayerLevel = player.level;
    levelUpTextTimer = 1.5;
    // Golden ring burst at player position
    spawnCritRing(player.x + player.width / 2, player.y + player.height / 2);
  }
  if (levelUpTextTimer > 0) levelUpTextTimer -= dt;

  // Update projectiles, gold drops, particles
  updateProjectiles(projectiles, dt);
  updateGoldDrops(goldDrops, dt);
  updateFloatingTexts(floatingTexts, dt);
  updateParticles(dt);
  updateScreenFlash(dt);
  updateAmbient(dt, WORLD_W, WORLD_H, FORT);

  // Clean up dead entities
  enemies = enemies.filter(e => e.alive || e.deathTimer > 0);
  troops = troops.filter(t => t.alive);

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
    // Sync run stats
    runStats.buildingsBought = economy.buildingsBought || 0;
    runStats.troopsHired = economy.troopsHired || 0;
    runStats.potionsUsed = player.potionsUsed || 0;
    runStats.weaponUpgrades = player.weaponUpgrades || 0;
    runStats.totalDamageTaken = player.totalDamageTaken || 0;
    saveHighScore();
    stopMusic();
    state = 'gameOver';
    return;
  }

  // Check wave complete
  if (waveManager.waveComplete && !waveCompleteShown) {
    // Wave completion bonus (passive building effects apply)
    const baseBonus = getWaveBonus(waveManager.wave);
    const { goldBonus, crystals } = applyWaveEndPassives(economy, baseBonus);
    runStats.goldEarned += goldBonus;
    player.score += 100 + waveManager.wave * 20;

    // No damage bonus
    if (player.damageTakenThisWave === 0) {
      player.score += 200;
      floatingTexts.push(createFloatingText(playerCX, playerCY - 40, 'NO DAMAGE BONUS! +200', '#ff0'));
    }

    // Wall intact bonus: +25 per surviving wall (max +100 for all 4)
    const intactCount = ['north', 'south', 'east', 'west'].filter(side => walls[side] && !walls[side].destroyed).length;
    if (intactCount > 0) {
      player.score += intactCount * 25;
    }

    // Store rewards for overlay display
    waveCompleteGold = goldBonus;
    waveCompleteCrystals = crystals;
    waveCompleteWallBonus = intactCount * 25;

    waveCompleteShown = true;
    waveCompleteTimer = 1.5;
    return;
  }

  // --- Draw ---
  drawGameScene(dt);
}

function drawGameScene(dt) {
  const ctx = getCtx();

  drawBackground(camera);
  updateShake(dt);

  // Start world-space drawing
  applyCameraTransform(camera, ctx);

  // Animated torch glow (world space, on top of static background)
  drawTorchFlicker(ctx, elapsedTime);

  // Barricades (world space)
  drawBarricades(walls);

  // Viewport culling bounds (with margin for large entities)
  const cullX = camera.x - 60;
  const cullY = camera.y - 60;
  const cullR = camera.x + VIEW_W + 60;
  const cullB = camera.y + VIEW_H + 60;
  const inView = (e) => e.x + (e.width || 12) > cullX && e.x < cullR && e.y + (e.height || 12) > cullY && e.y < cullB;

  // Gold drops (cull offscreen)
  for (const g of goldDrops) { if (inView(g)) drawGoldDrop(g); }

  // Troops (cull offscreen)
  for (const t of troops) { if (t.alive && inView(t)) drawTroop(t); }

  // Enemies (sort by y for depth, cull offscreen)
  enemies.sort((a, b) => a.y - b.y);
  for (const e of enemies) { if (inView(e)) drawEnemy(e); }

  // Projectiles (cull offscreen)
  for (const p of projectiles) { if (inView(p)) drawProjectile(p); }

  // Player (always draw)
  drawPlayer(player);

  // Floating texts (world space) — use enhanced damage numbers
  drawDamageNumbers(floatingTexts);

  // Particles (world space)
  drawParticles(ctx);

  // End world-space drawing
  resetCameraTransform(ctx);
  endShake(); // End shake before HUD so UI elements don't jiggle

  // Screen-space particles (ambient motes, boss flash)
  drawScreenParticles(ctx, VIEW_W, VIEW_H);

  // Elite mode red vignette
  if (eliteMode) {
    const vigTime = performance.now() / 1000;
    const vigAlpha = 0.12 + 0.04 * Math.sin(vigTime * 1.5);
    const vigGrad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.8);
    vigGrad.addColorStop(0, 'rgba(180,0,0,0)');
    vigGrad.addColorStop(1, `rgba(180,0,0,${vigAlpha})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // HUD (screen space)
  drawHUD(player, waveManager, economy, walls, player.repairingSide);

  // Boss HP bar (screen space, below main HUD)
  drawBossHP(enemies);

  // Minimap (screen space)
  drawMinimap(camera, player, enemies, troops, walls);

  // Horde banner
  drawHordeBanner();

  // Wave announcement
  if (waveAnnouncementTimer > 0) {
    drawWaveAnnouncement(waveManager.wave, waveAnnouncementTimer, eliteMode);
  }

  // Boss intro card
  if (bossIntroTimer > 0 && bossIntroData) {
    drawBossIntroCard(bossIntroData, bossIntroTimer);
  }

  // Tutorial
  if (waveManager.wave === 1 && tutorialStep < 4) {
    drawTutorial(tutorialStep, tutorialTimer);
  }

  // Wave 2 blocking tutorial
  if (wave2TutorialTimer > 0) {
    const alpha = Math.min(1, wave2TutorialTimer);
    ctx.globalAlpha = alpha;
    const text = 'Right-click or Shift to block';
    const w = text.length * 10 + 30;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(VIEW_W / 2 - w / 2, VIEW_H - 84, w, 36);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(VIEW_W / 2 - w / 2, VIEW_H - 84, w, 36);
    drawTextCentered(text, VIEW_H - 74, 10, '#fff');
    ctx.globalAlpha = 1;
  }

  // Kill streak text (slides in from left)
  if (killStreakShowTimer > 0) {
    const alpha = Math.min(1, killStreakShowTimer);
    const progress = Math.min(1, (2.0 - killStreakShowTimer) * 3); // fast slide-in
    const slideX = progress * VIEW_W / 2;
    ctx.globalAlpha = alpha;
    ctx.font = '18px "Press Start 2P", monospace';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.fillText(killStreakText, slideX + 2, VIEW_H / 2 - 38);
    ctx.fillStyle = '#ffdd44';
    ctx.fillText(killStreakText, slideX, VIEW_H / 2 - 40);
    ctx.globalAlpha = 1;
  }

  // Level up text
  if (levelUpTextTimer > 0) {
    const alpha = Math.min(1, levelUpTextTimer);
    ctx.globalAlpha = alpha;
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText('LEVEL UP!', VIEW_W / 2 + 2, VIEW_H / 2 + 2);
    ctx.fillStyle = '#ffdd44';
    ctx.fillText('LEVEL UP!', VIEW_W / 2, VIEW_H / 2);
    ctx.globalAlpha = 1;
  }
}

// --- Paused ---
function updatePaused(mouseClicked) {
  const ctx = getCtx();

  // Draw frozen game with camera
  drawBackground(camera);
  applyCameraTransform(camera, ctx);
  drawBarricades(walls);
  for (const g of goldDrops) drawGoldDrop(g);
  for (const t of troops) drawTroop(t);
  for (const e of enemies) drawEnemy(e);
  drawPlayer(player);
  resetCameraTransform(ctx);

  drawHUD(player, waveManager, economy, walls, player.repairingSide);
  drawMinimap(camera, player, enemies, troops, walls);

  // Overlay
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawTextCentered('PAUSED', 200, 32, '#fff');
  drawTextCentered('Press ESC to resume', 260, 12, '#aaa');

  if (isPause()) {
    startMusic();
    state = 'playing';
  }
}

// --- Shop ---
function updateShopState(dt, mouseClicked, mouse) {
  updateShop(player, economy, mouseClicked);
  const startBtn = drawShop(player, economy, waveManager);

  if (mouseClicked && pointInRect(mouse.x, mouse.y, startBtn)) {
    state = 'playing';
    startMusic(false);

    // Check if barricades can be upgraded
    const bLevel = walls.north ? walls.north.level : 0;
    const upgrades = ['lumberMill', 'stoneworks', 'masonry', 'forge'];
    for (let i = bLevel; i < upgrades.length; i++) {
      if (economy.buildings[upgrades[i]]) {
        upgradeBarricades(walls, i + 1, player.barricadeHPMult);
      }
    }

    // Heal 10% between waves
    player.hp = Math.min(player.maxHP, player.hp + player.maxHP * 0.1);

    // Apply building passives to player stats
    player.buildingDmgMult = getBuildingDamageMult(economy);

    // Rebuild background with newly purchased building visuals
    rebuildBackground();
    drawBuildingVisuals(economy.buildings);

    startWave();
  }
}

// --- High Score Helper ---
function saveHighScore() {
  if (eliteMode) {
    if (waveManager.wave > eliteHighScore) {
      eliteHighScore = waveManager.wave;
      localStorage.setItem('koa_elite_highscore', String(eliteHighScore));
    }
  } else {
    if (player.score > highScore) {
      highScore = player.score;
      localStorage.setItem('koa_highscore', String(highScore));
    }
  }
}

// --- Game Over ---
function updateGameOver(mouseClicked, mouse) {
  const ctx = getCtx();

  drawBackground(camera);
  applyCameraTransform(camera, ctx);
  drawBarricades(walls);
  for (const e of enemies) drawEnemy(e);
  drawPlayer(player);
  resetCameraTransform(ctx);

  const { retryBtn, menuBtn } = drawGameOver(player, waveManager.wave, elapsedTime, eliteMode ? eliteHighScore : highScore, runStats, eliteMode);
  if (mouseClicked && pointInRect(mouse.x, mouse.y, retryBtn)) {
    ensureContext();
    startFade(1, 3, () => {
      resetGame(eliteMode);
      state = 'playing';
      startWave();
      startMusic(false);
      startFade(0, 3);
    });
  }
  if (menuBtn && mouseClicked && pointInRect(mouse.x, mouse.y, menuBtn)) {
    ensureContext();
    startFade(1, 3, () => {
      state = 'menu';
      startFade(0, 3);
    });
  }
}

// --- Victory ---
function updateVictoryState(mouseClicked, mouse) {
  const { playBtn, menuBtn } = drawVictory(player, elapsedTime, eliteMode ? eliteHighScore : highScore, runStats, eliteMode);
  if (mouseClicked && pointInRect(mouse.x, mouse.y, playBtn)) {
    ensureContext();
    startFade(1, 3, () => {
      resetGame(eliteMode);
      state = 'playing';
      startWave();
      startMusic(false);
      startFade(0, 3);
    });
  }
  if (menuBtn && mouseClicked && pointInRect(mouse.x, mouse.y, menuBtn)) {
    ensureContext();
    startFade(1, 3, () => {
      state = 'menu';
      startFade(0, 3);
    });
  }
}

// --- Start ---
init();

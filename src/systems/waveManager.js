import { ENEMIES, WAVE_COUNT, getSpawnInterval } from '../config.js';
import { createEnemy } from '../entities/enemy.js';

// Wave composition definitions
function getWaveComposition(wave) {
  const comp = [];
  const add = (type, count) => { for (let i = 0; i < count; i++) comp.push(type); };

  // Raiders always present
  if (wave <= 4) {
    add('raider', 3 + wave * 2);
  } else {
    add('raider', Math.max(2, 10 - Math.floor(wave / 5)));
  }

  // Soldiers from wave 5
  if (wave >= 5) add('soldier', Math.min(8, Math.floor((wave - 3) * 0.7)));

  // Bombers from wave 8
  if (wave >= 8) add('bomber', Math.min(6, Math.floor((wave - 6) * 0.4)));

  // Archers from wave 10
  if (wave >= 10) add('archer', Math.min(6, Math.floor((wave - 8) * 0.5)));

  // Ogres from wave 15
  if (wave >= 15) add('ogre', Math.min(6, Math.floor((wave - 13) * 0.4)));

  // Orc Knights from wave 20
  if (wave >= 20) add('orcKnight', Math.min(6, Math.floor((wave - 18) * 0.35)));

  // Wizards from wave 25
  if (wave >= 25) add('wizard', Math.min(5, Math.floor((wave - 23) * 0.3)));

  // Ogre Soldiers from wave 35
  if (wave >= 35) add('ogreSoldier', Math.min(4, Math.floor((wave - 33) * 0.25)));

  // Boss every 10 waves
  if (wave % 10 === 0) add('titan', 1);

  return comp;
}

export function createWaveManager() {
  return {
    wave: 0,
    active: false,
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: 3.0,
    spawnIndex: 0,
    enemiesAlive: 0,
    totalEnemies: 0,
    waveComplete: false,
    betweenWaves: true,
    betweenWaveTimer: 0,
    allWavesComplete: false,
  };
}

export function startNextWave(wm) {
  wm.wave++;
  if (wm.wave > WAVE_COUNT) {
    wm.allWavesComplete = true;
    return [];
  }

  const composition = getWaveComposition(wm.wave);
  // Shuffle
  for (let i = composition.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [composition[i], composition[j]] = [composition[j], composition[i]];
  }

  wm.spawnQueue = composition;
  wm.spawnIndex = 0;
  wm.spawnTimer = 1.0; // Initial delay
  wm.spawnInterval = getSpawnInterval(wm.wave);
  wm.totalEnemies = composition.length;
  wm.enemiesAlive = 0;
  wm.active = true;
  wm.waveComplete = false;
  wm.betweenWaves = false;

  return [];
}

export function updateWaveSpawning(wm, dt, enemies, wave) {
  if (!wm.active) return;

  wm.spawnTimer -= dt;
  if (wm.spawnTimer <= 0 && wm.spawnIndex < wm.spawnQueue.length) {
    const typeKey = wm.spawnQueue[wm.spawnIndex];
    const enemy = createEnemy(typeKey, wm.wave);
    enemies.push(enemy);
    wm.spawnIndex++;
    wm.enemiesAlive++;

    // Spawn clustering: every 5th enemy spawns with the next one
    if (wm.spawnIndex % 5 === 0 && wm.spawnIndex < wm.spawnQueue.length) {
      const typeKey2 = wm.spawnQueue[wm.spawnIndex];
      const enemy2 = createEnemy(typeKey2, wm.wave);
      enemies.push(enemy2);
      wm.spawnIndex++;
      wm.enemiesAlive++;
    }

    wm.spawnTimer = wm.spawnInterval;
  }

  // Check wave completion
  if (wm.spawnIndex >= wm.spawnQueue.length) {
    const aliveCount = enemies.filter(e => e.alive).length;
    wm.enemiesAlive = aliveCount;
    if (aliveCount === 0) {
      wm.active = false;
      wm.waveComplete = true;
      wm.betweenWaves = true;
      wm.betweenWaveTimer = 5.0;
    }
  }
}

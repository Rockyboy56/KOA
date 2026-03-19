import { ENEMIES, WAVE_COUNT, getSpawnInterval } from '../config.js';
import { createEnemy } from '../entities/enemy.js';
import { randRange } from '../utils/math.js';
import { spawnBossFlash } from './particles.js';

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
  if (wave >= 8) add('bomber', Math.min(6, Math.ceil((wave - 7) * 0.4)));

  // Archers from wave 10
  if (wave >= 10) add('archer', Math.min(6, Math.floor((wave - 8) * 0.5)));

  // Ogres from wave 15
  if (wave >= 15) add('ogre', Math.min(6, Math.ceil((wave - 14) * 0.4)));

  // Orc Knights from wave 20
  if (wave >= 20) add('orcKnight', Math.min(6, Math.ceil((wave - 19) * 0.35)));

  // Wizards from wave 25
  if (wave >= 25) add('wizard', Math.min(5, Math.ceil((wave - 24) * 0.3)));

  // Ogre Soldiers from wave 35
  if (wave >= 35) add('ogreSoldier', Math.min(4, Math.ceil((wave - 34) * 0.4)));

  // Boss at waves 15, 25, 35, 45, 50
  if ((wave >= 15 && wave % 10 === 5) || wave === 50) add('titan', 1);

  return comp;
}

/** Determine which sides enemies can spawn from based on wave number. */
export function getSpawnSides(wave) {
  if (wave <= 5) {
    return ['east'];
  } else if (wave <= 10) {
    const others = ['north', 'south', 'west'];
    const randomOther = others[Math.floor(Math.random() * others.length)];
    return ['east', randomOther];
  } else if (wave <= 20) {
    return ['east', 'south', 'north'];
  } else {
    return ['north', 'south', 'east', 'west'];
  }
}

/** Get a random spawn position for a given side. */
export function getSpawnPosition(side) {
  switch (side) {
    case 'north': return { x: randRange(500, 1300), y: 40 };
    case 'south': return { x: randRange(500, 1300), y: 1160 };
    case 'east':  return { x: 1700, y: randRange(300, 900) };
    case 'west':  return { x: 100, y: randRange(300, 900) };
    default:      return { x: 1700, y: randRange(300, 900) };
  }
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
    spawnSides: ['east'], // computed once per wave
    hordeEventFired: false,
    hordeEventPending: false,
    eliteMode: false,
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
  wm.spawnSides = getSpawnSides(wm.wave); // fix: compute once per wave

  // Horde event on waves 10, 20, 30, 40
  wm.hordeEventFired = false;
  wm.hordeEventPending = (wm.wave % 10 === 0 && wm.wave <= 40);

  return [];
}

export function updateWaveSpawning(wm, dt, enemies, wave) {
  if (!wm.active) return;

  const allowedSides = wm.spawnSides;

  wm.spawnTimer -= dt;
  if (wm.spawnTimer <= 0 && wm.spawnIndex < wm.spawnQueue.length) {
    const typeKey = wm.spawnQueue[wm.spawnIndex];
    const side = allowedSides[Math.floor(Math.random() * allowedSides.length)];
    const pos = getSpawnPosition(side);
    const enemy = createEnemy(typeKey, wm.wave, pos.x, pos.y, side, wm.eliteMode);
    enemies.push(enemy);
    wm.spawnIndex++;
    wm.enemiesAlive++;
    if (typeKey === 'titan') spawnBossFlash();

    // Spawn clustering: every 5th enemy spawns with the next one
    if (wm.spawnIndex % 5 === 0 && wm.spawnIndex < wm.spawnQueue.length) {
      const typeKey2 = wm.spawnQueue[wm.spawnIndex];
      const side2 = allowedSides[Math.floor(Math.random() * allowedSides.length)];
      const pos2 = getSpawnPosition(side2);
      const enemy2 = createEnemy(typeKey2, wm.wave, pos2.x, pos2.y, side2, wm.eliteMode);
      enemies.push(enemy2);
      wm.spawnIndex++;
      wm.enemiesAlive++;
    }

    wm.spawnTimer = wm.spawnInterval;
  }

  // Check wave completion
  if (wm.spawnIndex >= wm.spawnQueue.length) {
    let aliveCount = 0;
    for (let i = 0; i < enemies.length; i++) { if (enemies[i].alive) aliveCount++; }
    wm.enemiesAlive = aliveCount;
    if (aliveCount === 0) {
      wm.active = false;
      wm.waveComplete = true;
      wm.betweenWaves = true;
      wm.betweenWaveTimer = 5.0;
    }
  }
}

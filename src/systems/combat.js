import { aabb } from '../utils/collision.js';
import { dist, clamp } from '../utils/math.js';
import { getAttackBox, getAttackDamage, damagePlayer, addXP } from '../entities/player.js';
import { damageEnemy, knockbackEnemy } from '../entities/enemy.js';
import { damageWall, getWallSegments } from '../entities/barricade.js';
import { damageTroop } from '../entities/troop.js';
import { createGoldDrop } from '../entities/goldDrop.js';
import { createProjectile } from '../entities/projectile.js';
import { WORLD_W, WORLD_H, FORT } from '../config.js';
import { shake, getCtx } from '../renderer.js';
import { getEquippedWeapon } from './economy.js';
import { spawnDeathBurst, spawnGoldSparkle, spawnWallImpact, spawnCritRing, spawnBlockSpark } from './particles.js';
import { playSwordSwing, playHeavyHit, playCrossbowFire, playEnemyDeath, playPlayerDamage, playBarricadeHit, playBarricadeBreak, playCritHit } from './audio.js';

export function processCombat(dt, player, enemies, walls, goldDrops, projectiles, troops, floatingTexts) {
  const weapon = getEquippedWeapon(player);
  const pcx = player.x + player.width / 2;
  const pcy = player.y + player.height / 2;

  // --- Player melee attacks ---
  if (player.attacking && player.attackPhase === 'active' && weapon.type !== 'ranged') {
    const box = getAttackBox(player);
    if (box) {
      if (!player.hitEnemiesThisSwing.has('_swingSound')) {
        playSwordSwing();
        player.hitEnemiesThisSwing.add('_swingSound');
      }
      const { dmg, isCrit, cleave, knockbackMult } = getAttackDamage(player);
      let hitCount = 0;

      for (const e of enemies) {
        if (!e.alive || hitCount >= cleave) break;
        if (player.hitEnemiesThisSwing.has(e.id)) continue;

        if (aabb(box, e)) {
          const dealt = damageEnemy(e, dmg);
          player.hitEnemiesThisSwing.add(e.id);
          hitCount++;
          shake(2, 50);

          // Knockback
          knockbackEnemy(e, 25 * knockbackMult);

          // Floating text
          if (dealt > 0) {
            floatingTexts.push(createFloatingText(e.x + e.width / 2, e.y - 10, dealt, isCrit ? '#ff0' : '#fff'));
            playHeavyHit();
            if (isCrit) {
              playCritHit();
              spawnCritRing(e.x + e.width / 2, e.y);
            }
          }

          // Death
          if (!e.alive) {
            handleEnemyDeath(e, player, goldDrops, floatingTexts);
          }

          // Special: AoE every 3rd swing (Maul of Titans)
          if (weapon.special === 'aoeEvery3' && player.swingCount % 3 === 0) {
            doAoE(e.x, e.y, 80, 40, enemies, player, goldDrops, floatingTexts);
          }

          // Special: Blast every 3rd swing (Orcbane)
          if (weapon.special === 'blastEvery3' && player.swingCount % 3 === 0) {
            const proj = createProjectile(pcx, pcy, player.facing, 50, 400, 'magic');
            projectiles.push(proj);
          }

          // Special: Stun for 0.3s — freezes attack AND movement (Mithril Maul)
          if (weapon.special === 'stun03' && e.alive) {
            e.attackTimer = Math.max(e.attackTimer, 0.3);
            e.stunTimer = 0.3;
          }

          // Special: Double Strike — 30% chance for bonus hit (Twin Daggers)
          if (weapon.special === 'doubleStrike' && e.alive && Math.random() < 0.3) {
            const bonus = damageEnemy(e, Math.round(dmg * 0.5));
            if (bonus > 0) {
              floatingTexts.push(createFloatingText(e.x + e.width / 2, e.y - 20, bonus, '#aaf'));
            }
            if (!e.alive) handleEnemyDeath(e, player, goldDrops, floatingTexts);
          }
        }
      }
    }
  }

  // --- Player ranged attacks ---
  if (player.attacking && player.attackPhase === 'active' && weapon.type === 'ranged') {
    if (!player.hitEnemiesThisSwing.has('rangedFired')) {
      player.hitEnemiesThisSwing.add('rangedFired');
      playCrossbowFire();
      const proj = createProjectile(
        pcx + Math.cos(player.facing) * 20,
        pcy + Math.sin(player.facing) * 20,
        player.facing,
        weapon.damage * player.meleeDmgMult * player.buildingDmgMult,
        350,
        'playerArrow'
      );
      // Pierce: projectile passes through multiple enemies
      proj.pierceLeft = weapon.special === 'pierce3' ? 3 : weapon.special === 'pierce2' ? 2 : 1;
      projectiles.push(proj);
    }
  }

  // --- Enemy attacks on player ---
  for (const e of enemies) {
    if (!e.alive) continue;

    if (e.type === 'melee') {
      const d = dist(e.x + e.width / 2, e.y + e.height / 2, pcx, pcy);
      if (d < 50 && e.attackTimer <= 0) {
        const wasBlocking = player.blocking;
        const dealt = damagePlayer(player, e.damage);
        e.attackTimer = e.attackRate * (e.buffed ? 0.75 : 1);
        e.attackAnim = 1; // trigger lunge animation
        floatingTexts.push(createFloatingText(pcx, pcy - 20, dealt, '#f44'));
        playPlayerDamage();
        // Block spark at shield position
        if (wasBlocking) {
          const sparkX = pcx + Math.cos(player.facing) * 15;
          const sparkY = pcy + Math.sin(player.facing) * 15;
          spawnBlockSpark(sparkX, sparkY);
        }
      }
    }

    if (e.type === 'ranged' && e.attackTimer <= 0) {
      const ecx = e.x + e.width / 2;
      const ecy = e.y + e.height / 2;
      const d = dist(ecx, ecy, pcx, pcy);
      // Only shoot if inside fort (line of sight) or close enough outside
      if (d < (e.range + 50) && (e.insideFort || d < 150)) {
        e.attackTimer = e.attackRate;
        const projType = e.magic ? 'magic' : 'arrow';
        const angle = Math.atan2(pcy - ecy, pcx - ecx);
        const proj = createProjectile(ecx, ecy, angle, e.damage, 200, projType, e.magic);
        projectiles.push(proj);
      }
    }

    // Suicide bomber
    if (e.type === 'suicide') {
      const ecx = e.x + e.width / 2;
      const ecy = e.y + e.height / 2;
      const dPlayer = dist(ecx, ecy, pcx, pcy);

      // Check distance to nearest wall segment on their target gate side
      let dWall = Infinity;
      const targetWall = walls[e.targetGate];
      if (targetWall && !targetWall.destroyed) {
        const segments = getWallSegments(targetWall);
        for (const seg of segments) {
          const nearX = clamp(ecx, seg.x, seg.x + seg.w);
          const nearY = clamp(ecy, seg.y, seg.y + seg.h);
          const d = dist(ecx, ecy, nearX, nearY);
          if (d < dWall) dWall = d;
        }
      }

      if (dPlayer < 40 || dWall < 40 || e.fuseTimer <= 0) {
        // Explode
        doExplosion(ecx, ecy, 64, e.damage, player, enemies, walls, troops, goldDrops, floatingTexts);
        e.alive = false;
        e.deathTimer = 0.3;
        handleEnemyDeath(e, player, goldDrops, floatingTexts);
      }
    }

    // Boss mechanics
    if (e.type === 'boss' && e.alive) {
      const ecx = e.x + e.width / 2;
      const ecy = e.y + e.height / 2;
      // Slam at melee range
      const dPlayer = dist(ecx, ecy, pcx, pcy);
      if (dPlayer < 80 && e.attackTimer <= 0) {
        const dealt = damagePlayer(player, e.damage);
        e.attackTimer = e.attackRate;
        e.attackAnim = 1; // boss lunge animation
        shake(5, 150);
        floatingTexts.push(createFloatingText(pcx, pcy - 20, dealt, '#f44'));
      }

      // Charge windup
      e.chargeTimer -= dt;
      if (e.chargeTimer <= 0 && !e.charging) {
        e.charging = true;
        e.chargeWindupTimer = 1.5;
      }
      if (e.charging && e.chargeWindupTimer > 0) {
        e.chargeWindupTimer -= dt;
        if (e.chargeWindupTimer <= 0) {
          // Execute charge using CURRENT player position
          const curPcx = player.x + player.width / 2;
          const curPcy = player.y + player.height / 2;
          const ecx2 = e.x + e.width / 2;
          const ecy2 = e.y + e.height / 2;
          const angle = Math.atan2(curPcy - ecy2, curPcx - ecx2);
          e.x += Math.cos(angle) * 200;
          e.y += Math.sin(angle) * 200;
          // Clamp to world bounds after charge
          e.x = clamp(e.x, 0, WORLD_W - e.width);
          e.y = clamp(e.y, 0, WORLD_H - e.height);
          // Check if boss ended up inside fort
          const ecxPost = e.x + e.width / 2;
          const ecyPost = e.y + e.height / 2;
          if (ecxPost > FORT.x && ecxPost < FORT.x + FORT.w && ecyPost > FORT.y && ecyPost < FORT.y + FORT.h) {
            e.insideFort = true;
          }
          e.charging = false;
          e.chargeTimer = 15;
          if (dist(e.x + e.width / 2, e.y + e.height / 2, curPcx, curPcy) < 80) {
            const dealt = damagePlayer(player, 40);
            floatingTexts.push(createFloatingText(curPcx, curPcy - 20, dealt, '#f44'));
          }
        }
      }

      // Roar (buff nearby)
      e.roarTimer -= dt;
      if (e.roarTimer <= 0) {
        e.roarTimer = 30;
        for (const ally of enemies) {
          if (ally !== e && ally.alive && dist(ecx, ecy, ally.x + ally.width / 2, ally.y + ally.height / 2) < 200) {
            ally.buffed = true;
            ally.buffTimer = 5;
          }
        }
      }
    }

    // Enemy attacks barricade wall on their target gate side
    if ((e.type === 'melee' || e.type === 'boss') && !e.insideFort) {
      const wall = walls[e.targetGate];
      if (wall && !wall.destroyed) {
        const ecx = e.x + e.width / 2;
        const ecy = e.y + e.height / 2;

        // Check distance to nearest wall segment
        const segments = getWallSegments(wall);
        let nearestSegDist = Infinity;
        for (const seg of segments) {
          const nearX = clamp(ecx, seg.x, seg.x + seg.w);
          const nearY = clamp(ecy, seg.y, seg.y + seg.h);
          const d = dist(ecx, ecy, nearX, nearY);
          if (d < nearestSegDist) nearestSegDist = d;
        }

        if (nearestSegDist < 50 && e.attackTimer <= 0) {
          const wasAlive = !wall.destroyed;
          damageWall(wall, e.damage);
          e.attackTimer = e.attackRate * (e.buffed ? 0.75 : 1);
          e.attackAnim = 1; // trigger lunge animation
          spawnWallImpact(ecx, ecy);
          if (wall.destroyed && wasAlive) {
            playBarricadeBreak();
            shake(7, 200); // heavy shake on barricade break
          } else {
            playBarricadeHit();
            shake(4, 120); // medium shake on barricade hit
          }
        }
      }
    }
  }

  // --- Projectile hits ---
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (!p.alive) continue;

    // Determine if this is a player projectile or enemy projectile
    const isPlayerProj = p.type === 'playerArrow';

    if (!isPlayerProj) {
      // Enemy projectile -> hits player
      if (aabb(p, player)) {
        const wasBlocking = player.blocking;
        const dealt = damagePlayer(player, p.damage, p.magic);
        floatingTexts.push(createFloatingText(pcx, pcy - 10, dealt, '#f44'));
        // Block spark for blocked projectiles
        if (wasBlocking && !p.magic) {
          const sparkX = pcx + Math.cos(player.facing) * 15;
          const sparkY = pcy + Math.sin(player.facing) * 15;
          spawnBlockSpark(sparkX, sparkY);
        }
        p.alive = false;
      } else {
        // Check all 4 walls for projectile collision
        let hitWall = false;
        const sides = ['north', 'south', 'east', 'west'];
        for (const side of sides) {
          if (hitWall) break;
          const wall = walls[side];
          if (!wall || wall.destroyed) continue;
          const segments = getWallSegments(wall);
          for (const seg of segments) {
            if (aabb(p, { x: seg.x, y: seg.y, width: seg.w, height: seg.h })) {
              damageWall(wall, p.damage);
              p.alive = false;
              hitWall = true;
              break;
            }
          }
        }
      }
    } else {
      // Player projectile -> hits enemies (supports pierce)
      for (const e of enemies) {
        if (!e.alive) continue;
        if (aabb(p, e)) {
          const dealt = damageEnemy(e, p.damage);
          if (dealt > 0) {
            floatingTexts.push(createFloatingText(e.x + e.width / 2, e.y - 10, dealt, '#fff'));
          }
          if (!e.alive) handleEnemyDeath(e, player, goldDrops, floatingTexts);
          // Pierce: decrement pierce counter, destroy if exhausted
          const pierce = p.pierceLeft || 1;
          if (pierce <= 1) { p.alive = false; break; }
          p.pierceLeft = pierce - 1;
          // Continue to hit next enemy (don't break)
        }
      }
    }
  }

  // --- Troop attacks ---
  for (const t of troops) {
    if (!t.alive) continue;

    // Enemies attack troops
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.type === 'melee' || e.type === 'boss') {
        if (dist(e.x + e.width / 2, e.y + e.height / 2, t.x + t.width / 2, t.y + t.height / 2) < 40 && e.attackTimer <= 0) {
          damageTroop(t, e.damage);
          e.attackTimer = e.attackRate;
        }
      }
    }
  }
}

export function handleEnemyDeath(e, player, goldDrops, floatingTexts) {
  playEnemyDeath();
  addXP(player, e.xp);
  player.score += e.score;
  player.kills++;

  // Hit stop: brief 30ms freeze for impact feel
  player.hitStopTimer = 0.03;

  const cx = e.x + e.width / 2;
  const cy = e.y + e.height / 2;

  // Death burst particles
  spawnDeathBurst(cx, cy, e.color);

  // XP floating text (blue)
  if (floatingTexts) {
    floatingTexts.push(createFloatingText(cx, cy - 20, '+' + e.xp + 'xp', '#88ccff'));
  }

  const goldAmount = Math.round(
    (e.goldMin + Math.random() * (e.goldMax - e.goldMin)) * player.goldDropMult
  );
  goldDrops.push(createGoldDrop(cx, cy, goldAmount));
}

function doAoE(cx, cy, radius, damage, enemies, player, goldDrops, floatingTexts) {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (dist(cx, cy, e.x + e.width / 2, e.y + e.height / 2) < radius) {
      const dealt = damageEnemy(e, damage);
      if (dealt > 0) {
        floatingTexts.push(createFloatingText(e.x, e.y - 10, dealt, '#fa0'));
      }
      if (!e.alive) handleEnemyDeath(e, player, goldDrops, floatingTexts);
    }
  }
}

function doExplosion(cx, cy, radius, damage, player, enemies, walls, troops, goldDrops, floatingTexts) {
  const pcx = player.x + player.width / 2;
  const pcy = player.y + player.height / 2;

  // Damage player
  if (dist(cx, cy, pcx, pcy) < radius) {
    const dealt = damagePlayer(player, damage);
    floatingTexts.push(createFloatingText(pcx, pcy - 10, dealt, '#f44'));
  }

  // Damage enemies
  for (const e of enemies) {
    if (!e.alive || e.type === 'suicide') continue;
    if (dist(cx, cy, e.x + e.width / 2, e.y + e.height / 2) < radius) {
      damageEnemy(e, damage);
      if (!e.alive) handleEnemyDeath(e, player, goldDrops, floatingTexts);
    }
  }

  // Damage all 4 walls
  const sides = ['north', 'south', 'east', 'west'];
  for (const side of sides) {
    const wall = walls[side];
    if (!wall || wall.destroyed) continue;
    const segments = getWallSegments(wall);
    for (const seg of segments) {
      const segCx = seg.x + seg.w / 2;
      const segCy = seg.y + seg.h / 2;
      if (dist(cx, cy, segCx, segCy) < radius + Math.max(seg.w, seg.h) / 2) {
        damageWall(wall, damage);
        break; // Only damage this wall once per explosion
      }
    }
  }

  // Damage troops
  for (const t of troops) {
    if (!t.alive) continue;
    if (dist(cx, cy, t.x + t.width / 2, t.y + t.height / 2) < radius) {
      damageTroop(t, damage);
    }
  }

  shake(6, 200);
}

export function createFloatingText(x, y, value, color) {
  return { x, y, text: String(value), color, timer: 1.0, vy: -40 };
}

export function updateFloatingTexts(texts, dt) {
  for (let i = texts.length - 1; i >= 0; i--) {
    texts[i].y += texts[i].vy * dt;
    texts[i].timer -= dt;
    if (texts[i].timer <= 0) texts.splice(i, 1);
  }
}

// drawFloatingTexts removed — replaced by drawDamageNumbers in hud.js

export function activateWarCry(player, enemies, floatingTexts) {
  for (const e of enemies) {
    if (!e.alive) continue;
    e.stunTimer = 2.0;
    e.attackTimer = Math.max(e.attackTimer, 2.0);
    floatingTexts.push(createFloatingText(e.x + e.width / 2, e.y - 15, 'STUNNED', '#ffff00'));
  }
  // Start cooldown
  player.skillCooldowns['warCry'] = 60;
}

export function activateShieldBash(player, enemies) {
  const pcx = player.x + player.width / 2;
  const pcy = player.y + player.height / 2;
  for (const e of enemies) {
    if (!e.alive) continue;
    const ecx = e.x + e.width / 2;
    const ecy = e.y + e.height / 2;
    const d = dist(pcx, pcy, ecx, ecy);
    if (d < 200) {
      const angle = Math.atan2(ecy - pcy, ecx - pcx);
      const force = 200 * (1 - e.knockbackResist);
      e.x += Math.cos(angle) * force;
      e.y += Math.sin(angle) * force;
      // clamp to world bounds
      e.x = clamp(e.x, 0, WORLD_W - e.width);
      e.y = clamp(e.y, 0, WORLD_H - e.height);
    }
  }
  player.skillCooldowns['shieldBash'] = 38;
}

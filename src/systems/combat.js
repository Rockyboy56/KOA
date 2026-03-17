import { aabb } from '../utils/collision.js';
import { dist } from '../utils/math.js';
import { getAttackBox, getAttackDamage, damagePlayer, addXP } from '../entities/player.js';
import { damageEnemy, knockbackEnemy } from '../entities/enemy.js';
import { damageBarricade } from '../entities/barricade.js';
import { damageTroop } from '../entities/troop.js';
import { createGoldDrop } from '../entities/goldDrop.js';
import { createProjectile } from '../entities/projectile.js';
import { WEAPONS } from '../config.js';
import { shake } from '../renderer.js';

export function processCombat(dt, player, enemies, barricade, goldDrops, projectiles, troops, floatingTexts) {
  const weapon = WEAPONS[player.weapon];
  const pcx = player.x + player.width / 2;
  const pcy = player.y + player.height / 2;

  // --- Player melee attacks ---
  if (player.attacking && player.attackPhase === 'active' && weapon.type !== 'ranged') {
    const box = getAttackBox(player);
    if (box) {
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
          }

          // Death
          if (!e.alive) {
            handleEnemyDeath(e, player, goldDrops);
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
        }
      }
    }
  }

  // --- Player ranged attacks ---
  if (player.attacking && player.attackPhase === 'active' && weapon.type === 'ranged') {
    if (!player.hitEnemiesThisSwing.has('rangedFired')) {
      player.hitEnemiesThisSwing.add('rangedFired');
      const proj = createProjectile(
        pcx + Math.cos(player.facing) * 20,
        pcy + Math.sin(player.facing) * 20,
        player.facing,
        weapon.damage * player.meleeDmgMult,
        350,
        'playerArrow'
      );
      projectiles.push(proj);
    }
  }

  // --- Enemy attacks on player ---
  for (const e of enemies) {
    if (!e.alive) continue;

    if (e.type === 'melee') {
      const d = dist(e.x + e.width / 2, e.y + e.height / 2, pcx, pcy);
      if (d < 50 && e.attackTimer <= 0) {
        const dealt = damagePlayer(player, e.damage);
        e.attackTimer = e.attackRate * (e.buffed ? 0.75 : 1);
        floatingTexts.push(createFloatingText(pcx, pcy - 20, dealt, '#f44'));
      }
    }

    if (e.type === 'ranged' && e.attackTimer <= 0) {
      const ecx = e.x + e.width / 2;
      const ecy = e.y + e.height / 2;
      const d = dist(ecx, ecy, pcx, pcy);
      if (d < (e.range + 50)) {
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
      const dBarricade = dist(ecx, ecy, barricade.x + barricade.width / 2, barricade.y + barricade.height / 2);

      if (dPlayer < 40 || dBarricade < 40 || e.fuseTimer <= 0) {
        // Explode
        doExplosion(ecx, ecy, 64, e.damage, player, enemies, barricade, troops, goldDrops, floatingTexts);
        e.alive = false;
        e.deathTimer = 0.3;
        handleEnemyDeath(e, player, goldDrops);
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
        shake(5, 150);
        floatingTexts.push(createFloatingText(pcx, pcy - 20, dealt, '#f44'));
      }

      // Charge
      e.chargeTimer -= dt;
      if (e.chargeTimer <= 0 && !e.charging) {
        e.charging = true;
        e.chargeTimer = 15;
        setTimeout(() => {
          if (e.alive) {
            // Charge toward player position
            const angle = Math.atan2(pcy - ecy, pcx - ecx);
            e.x += Math.cos(angle) * 200;
            e.y += Math.sin(angle) * 200;
            e.charging = false;
            // Damage player if in path
            if (dist(e.x + e.width / 2, e.y + e.height / 2, pcx, pcy) < 80) {
              const dealt = damagePlayer(player, 40);
              floatingTexts.push(createFloatingText(pcx, pcy - 20, dealt, '#f44'));
            }
          }
        }, 1500);
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

    // Enemy attacks barricade
    if (e.type === 'melee' || e.type === 'boss') {
      if (!barricade.destroyed) {
        const ecx = e.x + e.width / 2;
        const ecy = e.y + e.height / 2;
        // Check if enemy is near the barricade wall (check x and y overlap)
        const bLeft = barricade.x;
        const bRight = barricade.x + barricade.width;
        const bTop = barricade.y;
        const bBottom = barricade.y + barricade.height;

        if (ecx >= bLeft - 20 && ecx <= bRight + 20 && ecy >= bTop && ecy <= bBottom && e.attackTimer <= 0) {
          damageBarricade(barricade, e.damage);
          e.attackTimer = e.attackRate * (e.buffed ? 0.75 : 1);
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
        const dealt = damagePlayer(player, p.damage, p.magic);
        floatingTexts.push(createFloatingText(pcx, pcy - 10, dealt, '#f44'));
        p.alive = false;
      }
      // Hits barricade
      if (!barricade.destroyed && aabb(p, barricade)) {
        damageBarricade(barricade, p.damage);
        p.alive = false;
      }
    } else {
      // Player projectile -> hits enemies
      for (const e of enemies) {
        if (!e.alive) continue;
        if (aabb(p, e)) {
          const dealt = damageEnemy(e, p.damage);
          if (dealt > 0) {
            floatingTexts.push(createFloatingText(e.x + e.width / 2, e.y - 10, dealt, '#fff'));
          }
          if (!e.alive) handleEnemyDeath(e, player, goldDrops);
          p.alive = false;
          break;
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

function handleEnemyDeath(e, player, goldDrops) {
  addXP(player, e.xp);
  player.score += e.score;
  player.kills++;

  const goldAmount = Math.round(
    (e.goldMin + Math.random() * (e.goldMax - e.goldMin)) * player.goldDropMult
  );
  goldDrops.push(createGoldDrop(e.x + e.width / 2, e.y + e.height / 2, goldAmount));
}

function doAoE(cx, cy, radius, damage, enemies, player, goldDrops, floatingTexts) {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (dist(cx, cy, e.x + e.width / 2, e.y + e.height / 2) < radius) {
      const dealt = damageEnemy(e, damage);
      if (dealt > 0) {
        floatingTexts.push(createFloatingText(e.x, e.y - 10, dealt, '#fa0'));
      }
      if (!e.alive) handleEnemyDeath(e, player, goldDrops);
    }
  }
}

function doExplosion(cx, cy, radius, damage, player, enemies, barricade, troops, goldDrops, floatingTexts) {
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
      if (!e.alive) handleEnemyDeath(e, player, goldDrops);
    }
  }

  // Damage barricade
  if (!barricade.destroyed) {
    const bcx = barricade.x + barricade.width / 2;
    const bcy = barricade.y + barricade.height / 2;
    if (dist(cx, cy, bcx, bcy) < radius + barricade.height / 2) {
      damageBarricade(barricade, damage);
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

export function drawFloatingTexts(texts) {
  const ctx = document.getElementById('game').getContext('2d');
  for (const t of texts) {
    const alpha = Math.min(1, t.timer * 2);
    ctx.globalAlpha = alpha;
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#000';
    ctx.fillText(t.text, t.x + 1, t.y + 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
    ctx.globalAlpha = 1;
  }
}

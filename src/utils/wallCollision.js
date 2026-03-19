import { FORT, GATES } from '../config.js';
import { getWallSegments } from '../entities/barricade.js';

/**
 * Build the list of solid wall rects for collision.
 * Each wall side has 2 solid segments (left/right or top/bottom of the gate gap).
 * The gate gap itself is an opening — not solid.
 *
 * @param {object} walls - The 4-wall barricade object { north, south, east, west }
 * @param {string} mode - 'player' | 'troop' | 'enemy'
 * @param {string} enemyTargetGate - only for enemies: which gate they're assigned to
 * @returns {Array<{x,y,w,h}>} - array of solid rects that block movement
 */
export function getBlockingRects(walls, mode, enemyTargetGate) {
  const rects = [];

  for (const side of ['north', 'south', 'east', 'west']) {
    const wall = walls[side];
    if (!wall) continue;

    const segs = getWallSegments(wall);

    if (mode === 'enemy') {
      // Enemies are blocked by ALL wall segments on all sides.
      // The gate gap on their assigned side is passable ONLY if the barricade is destroyed.
      // The gate gaps on other sides are always blocked (enemies approach from one side only).
      if (wall.destroyed && side === enemyTargetGate) {
        // This side's barricade is destroyed — enemy can pass through the gap.
        // Still add solid wall segments (the parts beside the gap are still solid walls).
        rects.push(...segs);
      } else {
        // Barricade alive OR not their assigned gate — block EVERYTHING including gap.
        // Add the full wall rect (covers the gap too) so enemies can't slip through.
        rects.push({ x: wall.x, y: wall.y, w: wall.w, h: wall.h });
      }
    } else {
      // Player and troops: blocked by solid wall segments, can always pass through gate gaps.
      // Only add the 2 segments beside the gap, NOT the gap itself.
      rects.push(...segs);
    }
  }

  return rects;
}

/**
 * Resolve wall collision for an entity along a single axis.
 * Call this after moving on that axis. It pushes the entity out of any overlapping wall rect.
 *
 * @param {{x,y,width,height}} entity
 * @param {Array<{x,y,w,h}>} rects - blocking wall rects
 * @param {'x'|'y'} axis
 */
export function resolveAxis(entity, rects, axis) {
  for (const r of rects) {
    // AABB overlap check
    if (entity.x < r.x + r.w && entity.x + entity.width > r.x &&
        entity.y < r.y + r.h && entity.y + entity.height > r.y) {
      if (axis === 'x') {
        const overlapLeft = (entity.x + entity.width) - r.x;
        const overlapRight = (r.x + r.w) - entity.x;
        if (overlapLeft < overlapRight) {
          entity.x = r.x - entity.width;
        } else {
          entity.x = r.x + r.w;
        }
      } else {
        const overlapTop = (entity.y + entity.height) - r.y;
        const overlapBottom = (r.y + r.h) - entity.y;
        if (overlapTop < overlapBottom) {
          entity.y = r.y - entity.height;
        } else {
          entity.y = r.y + r.h;
        }
      }
    }
  }
}

/**
 * Full wall collision check with separate-axis resolution.
 * Applies movement, checks X collision, then Y collision.
 * Allows sliding along walls instead of getting stuck.
 *
 * @param {{x,y,width,height}} entity
 * @param {number} dx - X movement delta this frame
 * @param {number} dy - Y movement delta this frame
 * @param {Array<{x,y,w,h}>} rects - blocking wall rects
 */
export function moveWithWallCollision(entity, dx, dy, rects) {
  // Apply X movement, resolve X
  entity.x += dx;
  resolveAxis(entity, rects, 'x');

  // Apply Y movement, resolve Y
  entity.y += dy;
  resolveAxis(entity, rects, 'y');
}

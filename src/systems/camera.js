import { WORLD_W, WORLD_H, VIEW_W, VIEW_H } from '../config.js';
import { clamp, lerp } from '../utils/math.js';

export function createCamera() {
  return { x: 0, y: 0 };
}

export function updateCamera(cam, targetX, targetY, dt) {
  const goalX = targetX - VIEW_W / 2;
  const goalY = targetY - VIEW_H / 2;
  cam.x = lerp(cam.x, goalX, 1 - Math.pow(0.001, dt));
  cam.y = lerp(cam.y, goalY, 1 - Math.pow(0.001, dt));
  cam.x = clamp(cam.x, 0, WORLD_W - VIEW_W);
  cam.y = clamp(cam.y, 0, WORLD_H - VIEW_H);
}

export function applyCameraTransform(cam, ctx) {
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
}

export function resetCameraTransform(ctx) {
  ctx.restore();
}

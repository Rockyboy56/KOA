import { GAME_WIDTH, GAME_HEIGHT, COLORS, FORT_WIDTH, BARRICADE_X, BARRICADE_Y, BARRICADE_W, BARRICADE_H } from './config.js';

let canvas, ctx;
let screenShake = { x: 0, y: 0, duration: 0, active: false };

export function initRenderer() {
  canvas = document.getElementById('game');
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  return canvas;
}

function resizeCanvas() {
  const aspect = GAME_WIDTH / GAME_HEIGHT;
  let w = window.innerWidth;
  let h = window.innerHeight;
  if (w / h > aspect) w = h * aspect;
  else h = w / aspect;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
}

export function getCtx() { return ctx; }
export function getCanvas() { return canvas; }

export function shake(px, ms) {
  screenShake.duration = ms;
  screenShake.x = px;
  screenShake.y = px;
}

export function updateShake(dt) {
  if (screenShake.duration > 0) {
    screenShake.duration -= dt * 1000;
    screenShake.active = true;
    ctx.save();
    const ox = (Math.random() - 0.5) * screenShake.x * 2;
    const oy = (Math.random() - 0.5) * screenShake.y * 2;
    ctx.translate(ox, oy);
  } else {
    screenShake.active = false;
  }
}

export function endShake() {
  if (screenShake.active) {
    ctx.restore();
    if (screenShake.duration <= 0) {
      screenShake.duration = 0;
      screenShake.active = false;
    }
  }
}

export function clearScreen() {
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

export function drawBackground() {
  // Grass base with subtle variation tiles
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Grass texture - subtle darker patches
  ctx.fillStyle = COLORS.grassAlt;
  for (let gx = 0; gx < GAME_WIDTH; gx += 64) {
    for (let gy = 0; gy < GAME_HEIGHT; gy += 64) {
      // Deterministic pseudo-random based on position
      const hash = ((gx * 31 + gy * 17) % 97) / 97;
      if (hash > 0.5) {
        ctx.fillRect(gx + 8, gy + 8, 48, 48);
      }
    }
  }

  // Dirt path - horizontal road from right to left across center
  const pathY = GAME_HEIGHT / 2 - 30;
  const pathH = 60;
  ctx.fillStyle = COLORS.dirt;
  ctx.fillRect(FORT_WIDTH, pathY, GAME_WIDTH - FORT_WIDTH, pathH);

  // Path texture - lighter dirt streaks
  ctx.fillStyle = COLORS.dirtLight;
  ctx.fillRect(FORT_WIDTH, pathY + 10, GAME_WIDTH - FORT_WIDTH, 3);
  ctx.fillRect(FORT_WIDTH, pathY + pathH - 14, GAME_WIDTH - FORT_WIDTH, 2);

  // Narrower connecting paths branching up and down from center
  ctx.fillStyle = COLORS.dirt;
  ctx.fillRect(FORT_WIDTH + 60, pathY - 80, 30, 80);
  ctx.fillRect(FORT_WIDTH + 60, pathY + pathH, 30, 80);

  // Fort structure (left side, top-down view)
  // Outer walls
  ctx.fillStyle = COLORS.fortWall;
  ctx.fillRect(0, 60, FORT_WIDTH + 10, GAME_HEIGHT - 120);

  // Inner courtyard
  ctx.fillStyle = '#443322';
  ctx.fillRect(10, 80, FORT_WIDTH - 20, GAME_HEIGHT - 160);

  // Fort floor
  ctx.fillStyle = '#5a4a3a';
  ctx.fillRect(20, 90, FORT_WIDTH - 40, GAME_HEIGHT - 180);

  // Fort gate (opening on right wall)
  ctx.fillStyle = COLORS.dirt;
  ctx.fillRect(FORT_WIDTH - 2, pathY - 5, 20, pathH + 10);

  // Battlements on fort walls (top-down crenellations)
  ctx.fillStyle = '#776655';
  // Top wall battlements
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(10 + i * 24, 55, 14, 12);
  }
  // Bottom wall battlements
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(10 + i * 24, GAME_HEIGHT - 67, 14, 12);
  }
  // Right wall battlements (above and below gate)
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(FORT_WIDTH + 4, 70 + i * 40, 10, 14);
  }
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(FORT_WIDTH + 4, GAME_HEIGHT - 110 - i * 40, 10, 14);
  }

  // Fort interior details
  ctx.fillStyle = '#4a3a2a';
  // Table
  ctx.fillRect(40, 140, 50, 30);
  // Throne
  ctx.fillRect(60, GAME_HEIGHT / 2 - 20, 30, 40);
  ctx.fillStyle = '#886633';
  ctx.fillRect(64, GAME_HEIGHT / 2 - 16, 22, 32);

  // Torch lights in fort (top-down glow)
  ctx.fillStyle = 'rgba(255, 200, 80, 0.15)';
  ctx.beginPath();
  ctx.arc(30, 120, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(30, GAME_HEIGHT - 120, 20, 0, Math.PI * 2);
  ctx.fill();

  // Decorative edge details along the field
  // Small rocks scattered on the field
  ctx.fillStyle = '#667766';
  const rocks = [[300, 100], [500, 80], [700, 450], [850, 150], [400, 420], [650, 380]];
  for (const [rx, ry] of rocks) {
    ctx.beginPath();
    ctx.arc(rx, ry, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grass tufts
  ctx.fillStyle = '#2a5a1a';
  const tufts = [[280, 150], [450, 90], [600, 470], [780, 110], [350, 400], [820, 350]];
  for (const [tx, ty] of tufts) {
    ctx.fillRect(tx, ty, 6, 3);
    ctx.fillRect(tx + 2, ty - 3, 2, 4);
  }
}

export function drawRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function drawCircle(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawBar(x, y, w, h, pct, fg, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, w * Math.max(0, pct), h);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

export function drawText(text, x, y, size = 14, color = COLORS.text, align = 'left') {
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  // shadow
  ctx.fillStyle = COLORS.textShadow;
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function drawTextCentered(text, y, size = 14, color = COLORS.text) {
  drawText(text, GAME_WIDTH / 2, y, size, color, 'center');
}

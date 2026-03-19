// ---- Pool-based Particle System ----
// Target: 60fps with 200+ active particles via object pooling.

import { randRange } from '../utils/math.js';

const MAX_PARTICLES = 300;
const pool = [];
let activeCount = 0;

// Pre-allocate pool
for (let i = 0; i < MAX_PARTICLES; i++) {
  pool.push({
    active: false,
    x: 0, y: 0,
    vx: 0, vy: 0,
    life: 0, maxLife: 0,
    r: 0,
    color: '',
    type: '',       // 'circle' | 'spark' | 'mote'
    screenSpace: false,
    gravity: 0,
  });
}

function spawn(x, y, vx, vy, life, radius, color, type = 'circle', screenSpace = false, gravity = 0) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (!pool[i].active) {
      const p = pool[i];
      p.active = true;
      p.x = x; p.y = y;
      p.vx = vx; p.vy = vy;
      p.life = life; p.maxLife = life;
      p.r = radius;
      p.color = color;
      p.type = type;
      p.screenSpace = screenSpace;
      p.gravity = gravity;
      activeCount++;
      return p;
    }
  }
  return null;
}

// ---- Update ----

export function updateParticles(dt) {
  activeCount = 0;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = pool[i];
    if (!p.active) continue;

    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;

    activeCount++;
  }
}

// ---- Warm color parsing helper ----
function parseColor(color) {
  // Returns [r, g, b] from hex string
  if (color[0] === '#') {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  return [255, 180, 80]; // fallback warm color
}

// ---- Draw (world space) ----

export function drawParticles(ctx) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = pool[i];
    if (!p.active || p.screenSpace) continue;

    const alpha = Math.max(0, p.life / p.maxLife);

    if (p.type === 'circle') {
      // Death burst: radial gradient (bright center, transparent edge)
      const [r, g, b] = parseColor(p.color);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      grad.addColorStop(0, `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 20)}, ${alpha})`);
      grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.6})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'spark') {
      // 4-point star with golden glow
      const size = p.r * (p.life / p.maxLife);
      if (size < 0.3) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = alpha;

      // Soft glow behind the spark
      const [r, g, b] = parseColor(p.color);
      const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2);
      glowGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
      glowGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, size * 2, 0, Math.PI * 2);
      ctx.fill();

      // 4-point star shape
      ctx.fillStyle = p.color;
      // Vertical diamond
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.5);
      ctx.lineTo(size * 0.4, 0);
      ctx.lineTo(0, size * 1.5);
      ctx.lineTo(-size * 0.4, 0);
      ctx.closePath();
      ctx.fill();
      // Horizontal diamond
      ctx.beginPath();
      ctx.moveTo(-size * 1.5, 0);
      ctx.lineTo(0, size * 0.4);
      ctx.lineTo(size * 1.5, 0);
      ctx.lineTo(0, -size * 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.restore();
    } else if (p.type === 'ring') {
      // Expanding ring (used for crit hits and level up)
      const progress = 1 - (p.life / p.maxLife);
      const ringR = p.r * (0.5 + progress * 1.5); // expands from 50% to 200%
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 * (1 - progress); // thins as it expands
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (p.type === 'mote') {
      // Soft radial gradient circle (very low alpha, warm tone)
      const [r, g, b] = parseColor(p.color);
      const moteGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      moteGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`);
      moteGrad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${alpha * 0.2})`);
      moteGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = moteGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---- Draw screen-space particles (ambient motes, boss flash) ----

let screenFlashAlpha = 0;

export function drawScreenParticles(ctx, viewW, viewH) {
  // Screen flash (boss spawn)
  if (screenFlashAlpha > 0) {
    ctx.globalAlpha = screenFlashAlpha;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalAlpha = 1;
  }
}

// ---- Spawn Effects ----

/**
 * Death burst: 4-6 warm-colored gradient circles flying outward with gravity.
 */
export function spawnDeathBurst(x, y, color) {
  const count = 4 + Math.floor(Math.random() * 3);
  // Use warm colors (orange-red-yellow range)
  const warmColors = ['#ff8844', '#ffaa33', '#ee5533', '#ffcc44', '#dd6644', '#ff9955'];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + randRange(-0.3, 0.3);
    const speed = randRange(60, 140);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const life = randRange(0.4, 0.8);
    const radius = randRange(3, 6);
    const c = warmColors[Math.floor(Math.random() * warmColors.length)];
    spawn(x, y, vx, vy, life, radius, c, 'circle', false, 180);
  }
}

/**
 * Gold sparkle: 2-3 tiny 4-point star sparks with golden glow.
 */
export function spawnGoldSparkle(x, y) {
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const vx = randRange(-50, 50);
    const vy = randRange(-80, -30);
    const life = randRange(0.3, 0.6);
    const radius = randRange(1.5, 3);
    const colors = ['#ffdd44', '#ffe866', '#ffcc00'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    spawn(x, y, vx, vy, life, radius, color, 'spark', false, 60);
  }
}

/**
 * Boss flash: sets a screen flash timer (white overlay that fades).
 */
export function spawnBossFlash() {
  screenFlashAlpha = 0.8;
}

/**
 * Update the screen flash fade (call every frame).
 */
export function updateScreenFlash(dt) {
  if (screenFlashAlpha > 0) {
    screenFlashAlpha -= dt * 2;
    if (screenFlashAlpha < 0) screenFlashAlpha = 0;
  }
}

/**
 * Ambient mote: slow-moving warm-toned dust/leaf inside the fort courtyard.
 */
export function spawnAmbientMote(worldW, worldH, fortX, fortY, fortW, fortH) {
  const x = fortX + randRange(30, fortW - 30);
  const y = fortY + randRange(30, fortH - 30);
  const vx = randRange(-8, 8);
  const vy = randRange(-5, 5);
  const life = randRange(3, 5);
  const radius = randRange(2, 4);
  // Warm brown/green mote colors
  const colors = ['#8a7a5a', '#7a6a4a', '#6a8a4a', '#9a8a6a', '#5a7a3a'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  spawn(x, y, vx, vy, life, radius, color, 'mote', false, 0);
}

// ---- Ambient auto-spawner ----

let ambientTimer = 0;

/**
 * Auto-spawn ambient motes at a low rate (1 every 0.5s).
 */
export function updateAmbient(dt, worldW, worldH, fort) {
  ambientTimer += dt;
  if (ambientTimer >= 0.5) {
    ambientTimer -= 0.5;
    spawnAmbientMote(worldW, worldH, fort.x, fort.y, fort.w, fort.h);
  }
}

/**
 * Crit ring: expanding golden ring effect for critical hits.
 */
export function spawnCritRing(x, y) {
  spawn(x, y, 0, 0, 0.3, 20, '#ffdd44', 'ring');
}

/**
 * Block sparks: small white sparks at shield position when blocking.
 */
export function spawnBlockSpark(x, y) {
  for (let i = 0; i < 3; i++) {
    spawn(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100,
          0.15, 1.5, '#fff', 'spark');
  }
}

/**
 * Wall impact: 2-3 small brown/grey dust circles that fly outward briefly.
 */
export function spawnWallImpact(x, y) {
  for (let i = 0; i < 3; i++) {
    spawn(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 40, -Math.random() * 30,
          0.3, 2 + Math.random() * 2, '#8a7a6a', 'circle');
  }
}

/**
 * Small yellow spark burst when an arrow hits an enemy (4 particles).
 */
export function spawnArrowImpact(x, y) {
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI * 2 * i) / 4 + (Math.random() - 0.5) * 0.8;
    const spd = 40 + Math.random() * 60;
    spawn(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd,
          0.25, 2 + Math.random() * 2, '#ffe844', 'spark');
  }
}

// ---- Reset (for game restart) ----

export function resetParticles() {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pool[i].active = false;
  }
  activeCount = 0;
  screenFlashAlpha = 0;
  ambientTimer = 0;
}

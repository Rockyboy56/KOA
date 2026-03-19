import { GAME_WIDTH, GAME_HEIGHT, WORLD_W, WORLD_H, VIEW_W, VIEW_H, FORT, GATES, COLORS, BUILDING_VISUALS, BUILDINGS } from './config.js';

let canvas, ctx;
let screenShake = { x: 0, y: 0, duration: 0, active: false };
let offscreenBg = null;
let parallaxCanvas = null;

export function initRenderer() {
  canvas = document.getElementById('game');
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  ctx = canvas.getContext('2d');
  rebuildBackground();
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
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// ---- Torch positions (shared between background and flicker) ----
const TORCH_POSITIONS = [
  [FORT.x + 50, FORT.y + 50],
  [FORT.x + FORT.w - 50, FORT.y + 50],
  [FORT.x + 50, FORT.y + FORT.h - 50],
  [FORT.x + FORT.w - 50, FORT.y + FORT.h - 50],
  [FORT.x + FORT.w / 2, FORT.y + 50],
  [FORT.x + FORT.w / 2, FORT.y + FORT.h - 50],
];

// ---- Deterministic pseudo-random from position ----
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff; // 0..1
}

/** Build a parallax layer canvas with distant hills and tree silhouettes. */
function buildParallaxCanvas() {
  const pw = 960;
  const ph = 540;
  const pc = document.createElement('canvas');
  pc.width = pw;
  pc.height = ph;
  const pg = pc.getContext('2d');

  pg.clearRect(0, 0, pw, ph);

  // Layer 1: Distant rolling hills (north edge) with gradient
  const hillGrad = pg.createLinearGradient(0, 0, 0, 40);
  hillGrad.addColorStop(0, '#1a3a1a');
  hillGrad.addColorStop(1, 'rgba(26,58,26,0)');
  pg.fillStyle = hillGrad;
  pg.beginPath();
  pg.moveTo(0, 0);
  for (let x = 0; x <= pw; x += 4) {
    const hillH = 20 + Math.sin(x * 0.02) * 12 + Math.sin(x * 0.05 + 1.5) * 6;
    pg.lineTo(x, hillH);
  }
  pg.lineTo(pw, 0);
  pg.closePath();
  pg.fill();

  // South edge hills
  const hillGrad2 = pg.createLinearGradient(0, ph, 0, ph - 40);
  hillGrad2.addColorStop(0, '#1a3a1a');
  hillGrad2.addColorStop(1, 'rgba(26,58,26,0)');
  pg.fillStyle = hillGrad2;
  pg.beginPath();
  pg.moveTo(0, ph);
  for (let x = 0; x <= pw; x += 4) {
    const hillH = 18 + Math.sin(x * 0.025 + 3) * 10 + Math.sin(x * 0.06 + 0.8) * 5;
    pg.lineTo(x, ph - hillH);
  }
  pg.lineTo(pw, ph);
  pg.closePath();
  pg.fill();

  // Layer 2: Tree silhouettes
  const trees = [
    [40, 60], [80, 110], [120, 40], [60, 180], [100, 250],
    [30, 340], [90, 400],
    [880, 50], [920, 100], [860, 160], [900, 280], [940, 370],
    [250, 35], [400, 25], [550, 40], [700, 30],
    [300, 510], [500, 500], [650, 515], [800, 505],
  ];

  for (const [tx, ty] of trees) {
    // Trunk with gradient
    const trunkGrad = pg.createLinearGradient(tx - 2, ty, tx + 2, ty + 10);
    trunkGrad.addColorStop(0, '#5a4a3a');
    trunkGrad.addColorStop(1, '#3a2a1a');
    pg.fillStyle = trunkGrad;
    pg.beginPath();
    pg.moveTo(tx - 2, ty + 10);
    pg.quadraticCurveTo(tx, ty - 1, tx + 2, ty + 10);
    pg.fill();
    // Canopy with radial gradient
    const canopyGrad = pg.createRadialGradient(tx - 1, ty - 4, 1, tx, ty - 2, 9);
    canopyGrad.addColorStop(0, '#3a7a2a');
    canopyGrad.addColorStop(0.6, '#2a5a1a');
    canopyGrad.addColorStop(1, '#1a3a0a');
    pg.fillStyle = canopyGrad;
    pg.beginPath();
    pg.arc(tx, ty - 2, 9, 0, Math.PI * 2);
    pg.fill();
  }

  return pc;
}

/** Rebuild the offscreen background cache (WORLD_W x WORLD_H). Reuses existing canvas. */
export function rebuildBackground() {
  if (!offscreenBg || offscreenBg.width !== WORLD_W || offscreenBg.height !== WORLD_H) {
    offscreenBg = document.createElement('canvas');
    offscreenBg.width = WORLD_W;
    offscreenBg.height = WORLD_H;
  }
  const bgCtx = offscreenBg.getContext('2d');

  const wt = FORT.wallThickness;

  // ---- 1. Painted grass across the entire world ----
  // Base gradient fill
  const grassGrad = bgCtx.createLinearGradient(0, 0, 0, WORLD_H);
  grassGrad.addColorStop(0, '#3a7a2a');
  grassGrad.addColorStop(0.5, '#448a34');
  grassGrad.addColorStop(1, '#4a8a3a');
  bgCtx.fillStyle = grassGrad;
  bgCtx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Texture: scattered semi-transparent darker circles for depth
  for (let i = 0; i < 200; i++) {
    const px = hash(i, 0, 1) * WORLD_W;
    const py = hash(i, 0, 2) * WORLD_H;
    const r = 8 + hash(i, 0, 3) * 12;
    const a = 0.1 + hash(i, 0, 4) * 0.1;
    bgCtx.fillStyle = `rgba(42, 90, 26, ${a})`;
    bgCtx.beginPath();
    bgCtx.arc(px, py, r, 0, Math.PI * 2);
    bgCtx.fill();
  }

  // Grass tufts: bezier curved blades outside the fort
  bgCtx.lineWidth = 1.5;
  bgCtx.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const tx = hash(i, 1, 10) * WORLD_W;
    const ty = hash(i, 1, 11) * WORLD_H;
    // Skip if inside fort
    if (tx > FORT.x && tx < FORT.x + FORT.w && ty > FORT.y && ty < FORT.y + FORT.h) continue;
    const shade = `rgba(${30 + hash(i, 1, 12) * 20 | 0}, ${70 + hash(i, 1, 13) * 30 | 0}, ${20 + hash(i, 1, 14) * 10 | 0}, 0.7)`;
    bgCtx.strokeStyle = shade;
    // Draw 3 curved blades
    for (let b = 0; b < 3; b++) {
      const bx = tx + (b - 1) * 4;
      const lean = (hash(i, b, 15) - 0.5) * 12;
      bgCtx.beginPath();
      bgCtx.moveTo(bx, ty);
      bgCtx.quadraticCurveTo(bx + lean, ty - 8 - hash(i, b, 16) * 6, bx + lean * 0.5, ty - 12 - hash(i, b, 17) * 6);
      bgCtx.stroke();
    }
  }

  // Highlight sparkles on the grass
  for (let i = 0; i < 30; i++) {
    const sx = hash(i, 2, 20) * WORLD_W;
    const sy = hash(i, 2, 21) * WORLD_H;
    bgCtx.fillStyle = `rgba(255, 255, 255, ${0.1 + hash(i, 2, 22) * 0.08})`;
    bgCtx.beginPath();
    bgCtx.arc(sx, sy, 1 + hash(i, 2, 23), 0, Math.PI * 2);
    bgCtx.fill();
  }

  // Small flower details
  const flowerColors = ['#cc8844', '#aacc44', '#ccaa66', '#dd9966'];
  for (let i = 0; i < 30; i++) {
    const fx = hash(i, 3, 30) * WORLD_W;
    const fy = hash(i, 3, 31) * WORLD_H;
    if (fx > FORT.x && fx < FORT.x + FORT.w && fy > FORT.y && fy < FORT.y + FORT.h) continue;
    bgCtx.fillStyle = flowerColors[i % 4];
    bgCtx.beginPath();
    bgCtx.arc(fx, fy, 1.5 + hash(i, 3, 32), 0, Math.PI * 2);
    bgCtx.fill();
  }

  // ---- 1b. Wildflower dots ----
  const wildflowerColors = ['#dd4', '#eee', '#d8a', '#88d'];
  for (let i = 0; i < 50; i++) {
    const fx = hash(i, 8, 60) * WORLD_W;
    const fy = hash(i, 8, 61) * WORLD_H;
    if (fx > FORT.x && fx < FORT.x + FORT.w && fy > FORT.y && fy < FORT.y + FORT.h) continue;
    bgCtx.fillStyle = wildflowerColors[i % 4];
    bgCtx.beginPath();
    bgCtx.arc(fx, fy, 1 + hash(i, 8, 62) * 0.8, 0, Math.PI * 2);
    bgCtx.fill();
  }

  // ---- 1c. Dark grass clumps ----
  bgCtx.lineWidth = 1.5;
  bgCtx.lineCap = 'round';
  for (let i = 0; i < 30; i++) {
    const tx = hash(i, 9, 70) * WORLD_W;
    const ty = hash(i, 9, 71) * WORLD_H;
    if (tx > FORT.x && tx < FORT.x + FORT.w && ty > FORT.y && ty < FORT.y + FORT.h) continue;
    bgCtx.strokeStyle = `rgba(${20 + (hash(i, 9, 72) * 10 | 0)}, ${50 + (hash(i, 9, 73) * 15 | 0)}, ${15 + (hash(i, 9, 74) * 8 | 0)}, 0.8)`;
    for (let b = 0; b < 3; b++) {
      const bx = tx + (b - 1) * 3;
      const lean = (hash(i, b, 75) - 0.5) * 10;
      bgCtx.beginPath();
      bgCtx.moveTo(bx, ty);
      bgCtx.quadraticCurveTo(bx + lean, ty - 6 - hash(i, b, 76) * 5, bx + lean * 0.6, ty - 10 - hash(i, b, 77) * 5);
      bgCtx.stroke();
    }
  }

  // ---- 1d. Shadow patches under parallax trees ----
  const parallaxTrees = [
    [40, 60], [80, 110], [120, 40], [60, 180], [100, 250],
    [30, 340], [90, 400],
    [880, 50], [920, 100], [860, 160], [900, 280], [940, 370],
    [250, 35], [400, 25], [550, 40], [700, 30],
    [300, 510], [500, 500], [650, 515], [800, 505],
  ];
  for (const [ptx, pty] of parallaxTrees) {
    // Map parallax coords to world coords (parallax canvas is 960x540, world is 1800x1200)
    const wx = ptx * (WORLD_W / 960);
    const wy = pty * (WORLD_H / 540);
    bgCtx.save();
    bgCtx.translate(wx, wy + 8);
    bgCtx.scale(1.5, 0.4);
    bgCtx.fillStyle = 'rgba(0,0,0,0.08)';
    bgCtx.beginPath();
    bgCtx.arc(0, 0, 14, 0, Math.PI * 2);
    bgCtx.fill();
    bgCtx.restore();
  }

  // ---- 2. Painted dirt paths from each gate to world edges ----
  const pathW = 60;
  const gateCX = FORT.x + FORT.w / 2 - pathW / 2;
  const gateCY = FORT.y + FORT.h / 2 - pathW / 2;

  // Helper to paint a dirt path region
  function paintDirtPath(rx, ry, rw, rh, isHorizontal) {
    // Base sandy gradient
    let dirtGrad;
    if (isHorizontal) {
      dirtGrad = bgCtx.createLinearGradient(rx, ry, rx, ry + rh);
    } else {
      dirtGrad = bgCtx.createLinearGradient(rx, ry, rx + rw, ry);
    }
    dirtGrad.addColorStop(0, '#c4a882');
    dirtGrad.addColorStop(0.5, '#b8a078');
    dirtGrad.addColorStop(1, '#b09870');
    bgCtx.fillStyle = dirtGrad;
    bgCtx.fillRect(rx, ry, rw, rh);

    // Texture circles
    for (let i = 0; i < 60; i++) {
      const cx = rx + hash(i, 4, rx) * rw;
      const cy = ry + hash(i, 4, ry) * rh;
      const cr = 3 + hash(i, 4, rx + ry) * 5;
      const light = hash(i, 5, rx + ry) > 0.5;
      bgCtx.fillStyle = light ? 'rgba(210, 190, 160, 0.08)' : 'rgba(130, 110, 80, 0.08)';
      bgCtx.beginPath();
      bgCtx.arc(cx, cy, cr, 0, Math.PI * 2);
      bgCtx.fill();
    }

    // Soft path edges (gradient fade to transparent)
    if (isHorizontal) {
      // Left edge fade
      const edgeL = bgCtx.createLinearGradient(rx - 8, 0, rx, 0);
      edgeL.addColorStop(0, 'rgba(180, 160, 120, 0)');
      edgeL.addColorStop(1, 'rgba(180, 160, 120, 0.3)');
      bgCtx.fillStyle = edgeL;
      bgCtx.fillRect(rx - 8, ry, 8, rh);
      // Right edge fade
      const edgeR = bgCtx.createLinearGradient(rx + rw, 0, rx + rw + 8, 0);
      edgeR.addColorStop(0, 'rgba(180, 160, 120, 0.3)');
      edgeR.addColorStop(1, 'rgba(180, 160, 120, 0)');
      bgCtx.fillStyle = edgeR;
      bgCtx.fillRect(rx + rw, ry, 8, rh);
    } else {
      // Top edge fade
      const edgeT = bgCtx.createLinearGradient(0, ry - 8, 0, ry);
      edgeT.addColorStop(0, 'rgba(180, 160, 120, 0)');
      edgeT.addColorStop(1, 'rgba(180, 160, 120, 0.3)');
      bgCtx.fillStyle = edgeT;
      bgCtx.fillRect(rx, ry - 8, rw, 8);
      // Bottom edge fade
      const edgeB = bgCtx.createLinearGradient(0, ry + rh, 0, ry + rh + 8);
      edgeB.addColorStop(0, 'rgba(180, 160, 120, 0.3)');
      edgeB.addColorStop(1, 'rgba(180, 160, 120, 0)');
      bgCtx.fillStyle = edgeB;
      bgCtx.fillRect(rx, ry + rh, rw, 8);
    }
  }

  // North path (vertical strip)
  paintDirtPath(gateCX, 0, pathW, FORT.y, false);
  // South path
  paintDirtPath(gateCX, FORT.y + FORT.h, pathW, WORLD_H - FORT.y - FORT.h, false);
  // East path (horizontal strip)
  paintDirtPath(FORT.x + FORT.w, gateCY, WORLD_W - FORT.x - FORT.w, pathW, true);
  // West path
  paintDirtPath(0, gateCY, FORT.x, pathW, true);

  // ---- 2b. Wagon wheel ruts and pebbles on paths ----
  const pathDefs = [
    { rx: gateCX, ry: 0, rw: pathW, rh: FORT.y, horiz: false },
    { rx: gateCX, ry: FORT.y + FORT.h, rw: pathW, rh: WORLD_H - FORT.y - FORT.h, horiz: false },
    { rx: FORT.x + FORT.w, ry: gateCY, rw: WORLD_W - FORT.x - FORT.w, rh: pathW, horiz: true },
    { rx: 0, ry: gateCY, rw: FORT.x, rh: pathW, horiz: true },
  ];
  for (let pi = 0; pi < pathDefs.length; pi++) {
    const pd = pathDefs[pi];
    // Wagon wheel ruts: two parallel darker lines along center
    bgCtx.strokeStyle = 'rgba(100,85,60,0.25)';
    bgCtx.lineWidth = 1;
    if (pd.horiz) {
      const midY = pd.ry + pd.rh / 2;
      bgCtx.beginPath(); bgCtx.moveTo(pd.rx, midY - 6); bgCtx.lineTo(pd.rx + pd.rw, midY - 6); bgCtx.stroke();
      bgCtx.beginPath(); bgCtx.moveTo(pd.rx, midY + 6); bgCtx.lineTo(pd.rx + pd.rw, midY + 6); bgCtx.stroke();
    } else {
      const midX = pd.rx + pd.rw / 2;
      bgCtx.beginPath(); bgCtx.moveTo(midX - 6, pd.ry); bgCtx.lineTo(midX - 6, pd.ry + pd.rh); bgCtx.stroke();
      bgCtx.beginPath(); bgCtx.moveTo(midX + 6, pd.ry); bgCtx.lineTo(midX + 6, pd.ry + pd.rh); bgCtx.stroke();
    }
    // Scattered pebbles along path
    for (let i = 0; i < 18; i++) {
      const px = pd.rx + hash(i, 10 + pi, 80) * pd.rw;
      const py = pd.ry + hash(i, 10 + pi, 81) * pd.rh;
      const pr = 1 + hash(i, 10 + pi, 82) * 2;
      const shade = 0.4 + hash(i, 10 + pi, 83) * 0.2;
      bgCtx.fillStyle = `rgba(${shade * 200 | 0}, ${shade * 180 | 0}, ${shade * 150 | 0}, 0.4)`;
      bgCtx.beginPath();
      bgCtx.arc(px, py, pr, 0, Math.PI * 2);
      bgCtx.fill();
    }
  }

  // ---- 3. Cobblestone courtyard inside the fort ----
  const cyX = FORT.x + wt;
  const cyY = FORT.y + wt;
  const cyW = FORT.w - wt * 2;
  const cyH = FORT.h - wt * 2;

  // Base fill
  const cobbleGrad = bgCtx.createRadialGradient(
    cyX + cyW / 2, cyY + cyH / 2, 40,
    cyX + cyW / 2, cyY + cyH / 2, cyW * 0.6
  );
  cobbleGrad.addColorStop(0, '#9a8a7a');
  cobbleGrad.addColorStop(1, '#8a7a6a');
  bgCtx.fillStyle = cobbleGrad;
  bgCtx.fillRect(cyX, cyY, cyW, cyH);

  // Draw rounded stones with mortar gaps
  for (let i = 0; i < 200; i++) {
    const sx = cyX + hash(i, 6, 40) * cyW;
    const sy = cyY + hash(i, 6, 41) * cyH;
    const sw = 16 + hash(i, 6, 42) * 12;
    const sh = 14 + hash(i, 6, 43) * 10;
    const shade = 0.42 + hash(i, 6, 44) * 0.18;
    const r = shade * 255 | 0;
    const g = (shade - 0.06) * 255 | 0;
    const b = (shade - 0.12) * 255 | 0;

    // Stone body (rounded rect via arc)
    const cr = 3;
    bgCtx.fillStyle = `rgb(${r},${g},${b})`;
    bgCtx.beginPath();
    bgCtx.moveTo(sx + cr, sy);
    bgCtx.lineTo(sx + sw - cr, sy);
    bgCtx.arcTo(sx + sw, sy, sx + sw, sy + cr, cr);
    bgCtx.lineTo(sx + sw, sy + sh - cr);
    bgCtx.arcTo(sx + sw, sy + sh, sx + sw - cr, sy + sh, cr);
    bgCtx.lineTo(sx + cr, sy + sh);
    bgCtx.arcTo(sx, sy + sh, sx, sy + sh - cr, cr);
    bgCtx.lineTo(sx, sy + cr);
    bgCtx.arcTo(sx, sy, sx + cr, sy, cr);
    bgCtx.closePath();
    bgCtx.fill();

    // Warm highlight on top edge
    bgCtx.fillStyle = 'rgba(255, 245, 220, 0.08)';
    bgCtx.fillRect(sx + 1, sy, sw - 2, 2);

    // Dark mortar gap
    bgCtx.strokeStyle = 'rgba(60, 50, 40, 0.25)';
    bgCtx.lineWidth = 1;
    bgCtx.stroke();
  }

  // ---- 4. Corner towers ----
  const towerR = 30;
  const towers = [
    [FORT.x, FORT.y],
    [FORT.x + FORT.w, FORT.y],
    [FORT.x, FORT.y + FORT.h],
    [FORT.x + FORT.w, FORT.y + FORT.h],
  ];
  for (const [tx, ty] of towers) {
    // Base: radial gradient stone circle
    const tGrad = bgCtx.createRadialGradient(tx - 4, ty - 4, 2, tx, ty, towerR);
    tGrad.addColorStop(0, '#998877');
    tGrad.addColorStop(0.5, '#776655');
    tGrad.addColorStop(1, '#554433');
    bgCtx.fillStyle = tGrad;
    bgCtx.beginPath();
    bgCtx.arc(tx, ty, towerR, 0, Math.PI * 2);
    bgCtx.fill();

    // Conical cap: darker inner circle
    const capGrad = bgCtx.createRadialGradient(tx - 2, ty - 2, 1, tx, ty, towerR - 4);
    capGrad.addColorStop(0, '#887766');
    capGrad.addColorStop(1, '#665544');
    bgCtx.fillStyle = capGrad;
    bgCtx.beginPath();
    bgCtx.arc(tx, ty, towerR - 4, 0, Math.PI * 2);
    bgCtx.fill();

    // Window slits
    bgCtx.fillStyle = '#2a1a0a';
    bgCtx.fillRect(tx - 6, ty - 3, 3, 8);
    bgCtx.fillRect(tx + 3, ty - 3, 3, 8);

    // Outer rim
    bgCtx.strokeStyle = '#443322';
    bgCtx.lineWidth = 2;
    bgCtx.beginPath();
    bgCtx.arc(tx, ty, towerR, 0, Math.PI * 2);
    bgCtx.stroke();

    // Flag pole and flag
    bgCtx.strokeStyle = '#443322';
    bgCtx.lineWidth = 1.5;
    bgCtx.beginPath();
    bgCtx.moveTo(tx, ty - towerR + 4);
    bgCtx.lineTo(tx, ty - towerR - 16);
    bgCtx.stroke();
    // Flag triangle
    bgCtx.fillStyle = '#cc3333';
    bgCtx.beginPath();
    bgCtx.moveTo(tx, ty - towerR - 16);
    bgCtx.lineTo(tx + 12, ty - towerR - 12);
    bgCtx.lineTo(tx, ty - towerR - 8);
    bgCtx.closePath();
    bgCtx.fill();

    // Battlement blocks around the edge
    bgCtx.fillStyle = '#887766';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const bx = tx + Math.cos(a) * (towerR + 2) - 4;
      const by = ty + Math.sin(a) * (towerR + 2) - 4;
      // Rounded block
      bgCtx.beginPath();
      bgCtx.arc(bx + 4, by + 4, 5, 0, Math.PI * 2);
      bgCtx.fill();
      // Highlight
      bgCtx.fillStyle = 'rgba(255,255,255,0.12)';
      bgCtx.beginPath();
      bgCtx.arc(bx + 4, by + 2, 3, Math.PI, 0);
      bgCtx.fill();
      bgCtx.fillStyle = '#887766';
    }
  }

  // ---- 5. Torch base glow (static warm radial) ----
  for (const [tx, ty] of TORCH_POSITIONS) {
    // Outer soft radial glow
    const torchGrad = bgCtx.createRadialGradient(tx, ty, 0, tx, ty, 40);
    torchGrad.addColorStop(0, 'rgba(255, 200, 68, 0.18)');
    torchGrad.addColorStop(0.4, 'rgba(255, 180, 60, 0.08)');
    torchGrad.addColorStop(1, 'rgba(255, 160, 40, 0)');
    bgCtx.fillStyle = torchGrad;
    bgCtx.beginPath();
    bgCtx.arc(tx, ty, 40, 0, Math.PI * 2);
    bgCtx.fill();

    // Bright core dot
    const coreGrad = bgCtx.createRadialGradient(tx, ty, 0, tx, ty, 4);
    coreGrad.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
    coreGrad.addColorStop(1, 'rgba(255, 200, 100, 0)');
    bgCtx.fillStyle = coreGrad;
    bgCtx.beginPath();
    bgCtx.arc(tx, ty, 4, 0, Math.PI * 2);
    bgCtx.fill();
  }

  // ---- 6. Small scattered rocks outside fort ----
  for (let i = 0; i < 14; i++) {
    const rx = hash(i, 7, 50) * WORLD_W;
    const ry = hash(i, 7, 51) * WORLD_H;
    if (rx > FORT.x - 20 && rx < FORT.x + FORT.w + 20 && ry > FORT.y - 20 && ry < FORT.y + FORT.h + 20) continue;
    const rr = 3 + hash(i, 7, 52) * 3;
    const rockGrad = bgCtx.createRadialGradient(rx - 1, ry - 1, 0, rx, ry, rr);
    rockGrad.addColorStop(0, '#889988');
    rockGrad.addColorStop(1, '#556655');
    bgCtx.fillStyle = rockGrad;
    bgCtx.beginPath();
    bgCtx.arc(rx, ry, rr, 0, Math.PI * 2);
    bgCtx.fill();
  }

  // Build parallax layer canvas
  parallaxCanvas = buildParallaxCanvas();
}

/** Stamp purchased building visuals onto the offscreen background. Call after a building is bought. */
export function drawBuildingVisuals(ownedBuildings) {
  if (!offscreenBg) return;
  const bgCtx = offscreenBg.getContext('2d');

  for (const [key, owned] of Object.entries(ownedBuildings)) {
    if (!owned) continue;
    const vis = BUILDING_VISUALS[key];
    if (!vis) continue;
    const def = BUILDINGS[key];
    if (!def) continue;

    const x = vis.x, y = vis.y, w = vis.w, h = vis.h;
    const cx = x + w / 2, cy = y + h / 2;

    // Shadow behind structure
    bgCtx.fillStyle = 'rgba(0,0,0,0.22)';
    bgCtx.fillRect(x + 4, y + 4, w, h);

    // Per-building painted structure
    if (key === 'lumberMill') {
      // Brown wooden body
      bgCtx.fillStyle = '#8B6914';
      bgCtx.fillRect(x, y, w, h);
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y, w, 3);
      // Sawtooth roof
      bgCtx.fillStyle = '#6a4a0a';
      for (let i = 0; i < 5; i++) {
        bgCtx.beginPath();
        bgCtx.moveTo(x + i * (w / 5), y);
        bgCtx.lineTo(x + i * (w / 5) + w / 10, y - 8);
        bgCtx.lineTo(x + (i + 1) * (w / 5), y);
        bgCtx.fill();
      }
      // Log pile: 3 stacked brown circles
      bgCtx.fillStyle = '#6a4a0a';
      bgCtx.beginPath(); bgCtx.arc(x + 10, y + h - 6, 4, 0, Math.PI * 2); bgCtx.fill();
      bgCtx.beginPath(); bgCtx.arc(x + 20, y + h - 6, 4, 0, Math.PI * 2); bgCtx.fill();
      bgCtx.beginPath(); bgCtx.arc(x + 15, y + h - 12, 4, 0, Math.PI * 2); bgCtx.fill();

    } else if (key === 'stoneworks') {
      // Grey stone blocks
      bgCtx.fillStyle = '#888';
      bgCtx.fillRect(x, y, w, h);
      // Block lines
      bgCtx.strokeStyle = '#666';
      bgCtx.lineWidth = 1;
      for (let row = 0; row < 3; row++) {
        const ry = y + row * (h / 3);
        bgCtx.beginPath(); bgCtx.moveTo(x, ry); bgCtx.lineTo(x + w, ry); bgCtx.stroke();
        const off = row % 2 === 0 ? w / 3 : w / 2;
        bgCtx.beginPath(); bgCtx.moveTo(x + off, ry); bgCtx.lineTo(x + off, ry + h / 3); bgCtx.stroke();
      }
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y, w, 3);
      // Chisel detail
      bgCtx.strokeStyle = '#aaa';
      bgCtx.lineWidth = 1.5;
      bgCtx.beginPath(); bgCtx.moveTo(x + w - 12, y + h - 8); bgCtx.lineTo(x + w - 6, y + h - 14); bgCtx.stroke();

    } else if (key === 'masonry') {
      // Taller stone blocks with arched window
      bgCtx.fillStyle = '#999';
      bgCtx.fillRect(x, y - 6, w, h + 6);
      bgCtx.strokeStyle = '#777';
      bgCtx.lineWidth = 1;
      for (let row = 0; row < 4; row++) {
        const ry = y - 6 + row * ((h + 6) / 4);
        bgCtx.beginPath(); bgCtx.moveTo(x, ry); bgCtx.lineTo(x + w, ry); bgCtx.stroke();
      }
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y - 6, w, 3);
      // Arched window
      bgCtx.fillStyle = '#444';
      bgCtx.beginPath();
      bgCtx.arc(cx, cy - 2, 6, Math.PI, 0);
      bgCtx.fillRect(cx - 6, cy - 2, 12, 10);
      bgCtx.fill();

    } else if (key === 'forge') {
      // Dark structure
      bgCtx.fillStyle = '#554';
      bgCtx.fillRect(x, y, w, h);
      bgCtx.fillStyle = 'rgba(255,255,255,0.06)';
      bgCtx.fillRect(x, y, w, 3);
      // Orange glow window
      const glowGrad = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, 12);
      glowGrad.addColorStop(0, 'rgba(255,160,40,0.9)');
      glowGrad.addColorStop(0.5, 'rgba(255,100,20,0.5)');
      glowGrad.addColorStop(1, 'rgba(255,60,10,0)');
      bgCtx.fillStyle = glowGrad;
      bgCtx.beginPath(); bgCtx.arc(cx, cy, 12, 0, Math.PI * 2); bgCtx.fill();
      // Anvil in front
      bgCtx.fillStyle = '#333';
      bgCtx.beginPath();
      bgCtx.moveTo(cx - 8, y + h - 4);
      bgCtx.lineTo(cx + 8, y + h - 4);
      bgCtx.lineTo(cx + 4, y + h - 10);
      bgCtx.lineTo(cx - 4, y + h - 10);
      bgCtx.closePath(); bgCtx.fill();

    } else if (key === 'engineeringWorkshop') {
      // Brown workshop
      bgCtx.fillStyle = '#a86';
      bgCtx.fillRect(x, y, w, h);
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y, w, 3);
      // Gear symbol
      bgCtx.strokeStyle = '#654';
      bgCtx.lineWidth = 2;
      bgCtx.beginPath(); bgCtx.arc(cx, cy, 8, 0, Math.PI * 2); bgCtx.stroke();
      // Gear teeth
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        bgCtx.fillStyle = '#654';
        bgCtx.fillRect(cx + Math.cos(a) * 8 - 2, cy + Math.sin(a) * 8 - 2, 4, 4);
      }

    } else if (key === 'spikedBarricades') {
      // Small spike fence
      bgCtx.fillStyle = '#8B6914';
      bgCtx.fillRect(x, y + h / 2, w, h / 2);
      bgCtx.fillStyle = '#654';
      for (let i = 0; i < 6; i++) {
        const sx = x + 4 + i * (w / 6);
        bgCtx.beginPath();
        bgCtx.moveTo(sx, y + h / 2);
        bgCtx.lineTo(sx + 3, y + 4);
        bgCtx.lineTo(sx + 6, y + h / 2);
        bgCtx.closePath(); bgCtx.fill();
      }

    } else if (key === 'moat') {
      // Blue water channel
      bgCtx.fillStyle = '#48a';
      bgCtx.fillRect(x, y + 8, w, h - 16);
      // Water highlight ripples
      bgCtx.strokeStyle = 'rgba(150,200,255,0.3)';
      bgCtx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        bgCtx.beginPath();
        bgCtx.moveTo(x + 4, cy - 4 + i * 6);
        bgCtx.quadraticCurveTo(cx, cy - 8 + i * 6, x + w - 4, cy - 4 + i * 6);
        bgCtx.stroke();
      }

    } else if (key === 'barracks') {
      // Rectangular structure
      bgCtx.fillStyle = '#68a';
      bgCtx.fillRect(x, y, w, h);
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y, w, 3);
      // Door arch
      bgCtx.fillStyle = '#446';
      bgCtx.beginPath();
      bgCtx.arc(cx, y + h, 7, Math.PI, 0);
      bgCtx.fill();
      // Red flag on pole
      bgCtx.strokeStyle = '#543';
      bgCtx.lineWidth = 1.5;
      bgCtx.beginPath(); bgCtx.moveTo(x + w - 8, y); bgCtx.lineTo(x + w - 8, y - 16); bgCtx.stroke();
      bgCtx.fillStyle = '#cc3333';
      bgCtx.beginPath();
      bgCtx.moveTo(x + w - 8, y - 16);
      bgCtx.lineTo(x + w + 2, y - 12);
      bgCtx.lineTo(x + w - 8, y - 8);
      bgCtx.closePath(); bgCtx.fill();

    } else if (key === 'archeryRange') {
      // Target circles
      bgCtx.fillStyle = '#6a6';
      bgCtx.fillRect(x, y, w, h);
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y, w, 3);
      // Concentric target
      bgCtx.fillStyle = '#fff';
      bgCtx.beginPath(); bgCtx.arc(cx, cy, 10, 0, Math.PI * 2); bgCtx.fill();
      bgCtx.fillStyle = '#c33';
      bgCtx.beginPath(); bgCtx.arc(cx, cy, 7, 0, Math.PI * 2); bgCtx.fill();
      bgCtx.fillStyle = '#fff';
      bgCtx.beginPath(); bgCtx.arc(cx, cy, 4, 0, Math.PI * 2); bgCtx.fill();
      bgCtx.fillStyle = '#c33';
      bgCtx.beginPath(); bgCtx.arc(cx, cy, 2, 0, Math.PI * 2); bgCtx.fill();

    } else if (key === 'knightAcademy') {
      // Larger structure with shield emblem
      bgCtx.fillStyle = '#88c';
      bgCtx.fillRect(x, y - 4, w, h + 4);
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y - 4, w, 3);
      // Shield emblem
      bgCtx.fillStyle = '#669';
      bgCtx.beginPath();
      bgCtx.moveTo(cx - 8, cy - 8);
      bgCtx.lineTo(cx + 8, cy - 8);
      bgCtx.lineTo(cx + 8, cy + 2);
      bgCtx.lineTo(cx, cy + 10);
      bgCtx.lineTo(cx - 8, cy + 2);
      bgCtx.closePath(); bgCtx.fill();
      bgCtx.fillStyle = '#aaf';
      bgCtx.fillRect(cx - 1, cy - 6, 2, 12);
      bgCtx.fillRect(cx - 5, cy - 2, 10, 2);

    } else if (key === 'advCombat') {
      // Arena-like open circle
      bgCtx.fillStyle = '#aa8';
      bgCtx.fillRect(x, y, w, h);
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y, w, 3);
      bgCtx.strokeStyle = '#886';
      bgCtx.lineWidth = 2;
      bgCtx.beginPath(); bgCtx.arc(cx, cy, 12, 0, Math.PI * 2); bgCtx.stroke();
      bgCtx.strokeStyle = '#996';
      bgCtx.lineWidth = 1;
      bgCtx.beginPath(); bgCtx.arc(cx, cy, 8, 0, Math.PI * 2); bgCtx.stroke();

    } else if (key === 'blacksmith') {
      // Brown structure with anvil
      bgCtx.fillStyle = '#a86';
      bgCtx.fillRect(x, y, w, h);
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y, w, 3);
      // Orange glow from window
      const bsGlow = bgCtx.createRadialGradient(cx - 6, cy, 0, cx - 6, cy, 8);
      bsGlow.addColorStop(0, 'rgba(255,140,30,0.6)');
      bsGlow.addColorStop(1, 'rgba(255,80,10,0)');
      bgCtx.fillStyle = bsGlow;
      bgCtx.beginPath(); bgCtx.arc(cx - 6, cy, 8, 0, Math.PI * 2); bgCtx.fill();
      // Anvil in front
      bgCtx.fillStyle = '#444';
      bgCtx.beginPath();
      bgCtx.moveTo(cx + 6, y + h - 2);
      bgCtx.lineTo(cx + 16, y + h - 2);
      bgCtx.lineTo(cx + 14, y + h - 8);
      bgCtx.lineTo(cx + 8, y + h - 8);
      bgCtx.closePath(); bgCtx.fill();

    } else if (key === 'armory') {
      // Structure with weapon rack
      bgCtx.fillStyle = '#8a8';
      bgCtx.fillRect(x, y, w, h);
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y, w, 3);
      // Weapon rack: vertical lines
      bgCtx.strokeStyle = '#565';
      bgCtx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const rx = cx - 10 + i * 5;
        bgCtx.beginPath(); bgCtx.moveTo(rx, cy - 6); bgCtx.lineTo(rx, cy + 8); bgCtx.stroke();
      }
      // Rack bar
      bgCtx.strokeStyle = '#654';
      bgCtx.lineWidth = 2;
      bgCtx.beginPath(); bgCtx.moveTo(cx - 12, cy - 6); bgCtx.lineTo(cx + 12, cy - 6); bgCtx.stroke();

    } else if (key === 'weaponsmith') {
      // Similar to blacksmith with hammer symbol
      bgCtx.fillStyle = '#ca6';
      bgCtx.fillRect(x, y, w, h);
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y, w, 3);
      // Hammer symbol
      bgCtx.fillStyle = '#654';
      bgCtx.fillRect(cx - 2, cy - 10, 4, 16);
      bgCtx.fillStyle = '#888';
      bgCtx.fillRect(cx - 6, cy - 12, 12, 5);

    } else if (key === 'masterForge') {
      // Larger forge with brighter glow
      bgCtx.fillStyle = '#664';
      bgCtx.fillRect(x, y - 4, w, h + 4);
      bgCtx.fillStyle = 'rgba(255,255,255,0.06)';
      bgCtx.fillRect(x, y - 4, w, 3);
      // Bright glow
      const mfGlow = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, 16);
      mfGlow.addColorStop(0, 'rgba(255,200,60,0.9)');
      mfGlow.addColorStop(0.4, 'rgba(255,130,20,0.5)');
      mfGlow.addColorStop(1, 'rgba(255,60,10,0)');
      bgCtx.fillStyle = mfGlow;
      bgCtx.beginPath(); bgCtx.arc(cx, cy, 16, 0, Math.PI * 2); bgCtx.fill();
      // Chimney
      bgCtx.fillStyle = '#555';
      bgCtx.fillRect(x + w - 12, y - 10, 8, 14);

    } else if (key === 'apothecary') {
      // Small green-roofed hut
      bgCtx.fillStyle = '#6a8';
      bgCtx.fillRect(x, y, w, h);
      // Green roof triangle
      bgCtx.fillStyle = '#3a6';
      bgCtx.beginPath();
      bgCtx.moveTo(x - 4, y);
      bgCtx.lineTo(cx, y - 12);
      bgCtx.lineTo(x + w + 4, y);
      bgCtx.closePath(); bgCtx.fill();
      // Potion bottle
      bgCtx.fillStyle = '#c44';
      bgCtx.beginPath(); bgCtx.arc(cx, cy + 4, 4, 0, Math.PI * 2); bgCtx.fill();
      bgCtx.fillStyle = '#855';
      bgCtx.fillRect(cx - 1.5, cy - 4, 3, 5);

    } else if (key === 'alchemistLab') {
      // Structure with bubbling flask
      bgCtx.fillStyle = '#8ad';
      bgCtx.fillRect(x, y, w, h);
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y, w, 3);
      // Flask (circle with neck)
      bgCtx.fillStyle = '#6a9';
      bgCtx.beginPath(); bgCtx.arc(cx, cy + 4, 7, 0, Math.PI * 2); bgCtx.fill();
      bgCtx.fillRect(cx - 2, cy - 6, 4, 8);
      // Bubbles rising
      bgCtx.fillStyle = 'rgba(200,255,200,0.6)';
      bgCtx.beginPath(); bgCtx.arc(cx - 2, cy - 8, 2, 0, Math.PI * 2); bgCtx.fill();
      bgCtx.beginPath(); bgCtx.arc(cx + 3, cy - 12, 1.5, 0, Math.PI * 2); bgCtx.fill();
      bgCtx.beginPath(); bgCtx.arc(cx - 1, cy - 16, 1, 0, Math.PI * 2); bgCtx.fill();

    } else if (key === 'wizardTower') {
      // Tall pointed roof tower
      bgCtx.fillStyle = '#a6d';
      bgCtx.fillRect(x + 8, y, w - 16, h);
      // Pointed roof
      bgCtx.fillStyle = '#83a';
      bgCtx.beginPath();
      bgCtx.moveTo(x + 4, y);
      bgCtx.lineTo(cx, y - 20);
      bgCtx.lineTo(x + w - 4, y);
      bgCtx.closePath(); bgCtx.fill();
      // Purple glow at top
      const wzGlow = bgCtx.createRadialGradient(cx, y - 18, 0, cx, y - 18, 8);
      wzGlow.addColorStop(0, 'rgba(200,120,255,0.8)');
      wzGlow.addColorStop(1, 'rgba(140,60,200,0)');
      bgCtx.fillStyle = wzGlow;
      bgCtx.beginPath(); bgCtx.arc(cx, y - 18, 8, 0, Math.PI * 2); bgCtx.fill();
      // Star at tip
      bgCtx.fillStyle = '#ffe080';
      bgCtx.beginPath();
      bgCtx.moveTo(cx, y - 22); bgCtx.lineTo(cx + 2, y - 18);
      bgCtx.lineTo(cx, y - 16); bgCtx.lineTo(cx - 2, y - 18);
      bgCtx.closePath(); bgCtx.fill();

    } else if (key === 'arcaneLibrary') {
      // Wide structure with book spines visible
      bgCtx.fillStyle = '#c8f';
      bgCtx.fillRect(x, y, w, h);
      bgCtx.fillStyle = 'rgba(255,255,255,0.08)';
      bgCtx.fillRect(x, y, w, 3);
      // Window with book spines
      bgCtx.fillStyle = '#446';
      bgCtx.fillRect(cx - 14, cy - 6, 28, 14);
      const bookColors = ['#c44','#4a4','#44c','#ca4','#a4c','#4ca','#c84'];
      for (let i = 0; i < 7; i++) {
        bgCtx.fillStyle = bookColors[i];
        bgCtx.fillRect(cx - 13 + i * 4, cy - 5, 3, 12);
      }

    } else if (key === 'goldMine') {
      // Brown entrance with gold nuggets
      bgCtx.fillStyle = '#8a6';
      bgCtx.fillRect(x, y, w, h);
      // Mine entrance arch
      bgCtx.fillStyle = '#543';
      bgCtx.beginPath();
      bgCtx.arc(cx, cy + 4, 10, Math.PI, 0);
      bgCtx.fillRect(cx - 10, cy + 4, 20, 10);
      bgCtx.fill();
      bgCtx.fillStyle = '#222';
      bgCtx.beginPath(); bgCtx.arc(cx, cy + 4, 7, Math.PI, 0); bgCtx.fill();
      bgCtx.fillRect(cx - 7, cy + 4, 14, 8);
      // Gold nugget dots
      bgCtx.fillStyle = '#fd4';
      bgCtx.beginPath(); bgCtx.arc(x + 8, y + h - 6, 2.5, 0, Math.PI * 2); bgCtx.fill();
      bgCtx.beginPath(); bgCtx.arc(x + 14, y + h - 4, 2, 0, Math.PI * 2); bgCtx.fill();
      // Pickaxe
      bgCtx.strokeStyle = '#876';
      bgCtx.lineWidth = 1.5;
      bgCtx.beginPath(); bgCtx.moveTo(x + w - 8, y + 6); bgCtx.lineTo(x + w - 16, y + 18); bgCtx.stroke();
      bgCtx.fillStyle = '#888';
      bgCtx.beginPath();
      bgCtx.moveTo(x + w - 6, y + 4); bgCtx.lineTo(x + w - 10, y + 8); bgCtx.lineTo(x + w - 5, y + 9);
      bgCtx.closePath(); bgCtx.fill();

    } else if (key === 'crystalMine') {
      // Blue-tinted entrance with crystal shapes
      bgCtx.fillStyle = '#678';
      bgCtx.fillRect(x, y, w, h);
      // Mine entrance
      bgCtx.fillStyle = '#345';
      bgCtx.beginPath(); bgCtx.arc(cx, cy + 4, 10, Math.PI, 0); bgCtx.fill();
      bgCtx.fillRect(cx - 10, cy + 4, 20, 10);
      bgCtx.fillStyle = '#123';
      bgCtx.beginPath(); bgCtx.arc(cx, cy + 4, 7, Math.PI, 0); bgCtx.fill();
      bgCtx.fillRect(cx - 7, cy + 4, 14, 8);
      // Crystal shapes (small triangles)
      bgCtx.fillStyle = '#8df';
      bgCtx.beginPath(); bgCtx.moveTo(x + 6, y + h - 4); bgCtx.lineTo(x + 9, y + h - 14); bgCtx.lineTo(x + 12, y + h - 4); bgCtx.fill();
      bgCtx.fillStyle = '#aef';
      bgCtx.beginPath(); bgCtx.moveTo(x + w - 14, y + h - 4); bgCtx.lineTo(x + w - 10, y + h - 12); bgCtx.lineTo(x + w - 6, y + h - 4); bgCtx.fill();

    } else if (key === 'treasury') {
      // Golden-roofed structure with coin stacks
      bgCtx.fillStyle = '#b94';
      bgCtx.fillRect(x, y, w, h);
      // Golden roof
      bgCtx.fillStyle = '#fd4';
      bgCtx.beginPath();
      bgCtx.moveTo(x - 3, y);
      bgCtx.lineTo(cx, y - 10);
      bgCtx.lineTo(x + w + 3, y);
      bgCtx.closePath(); bgCtx.fill();
      bgCtx.fillStyle = 'rgba(255,255,255,0.15)';
      bgCtx.beginPath();
      bgCtx.moveTo(x - 3, y);
      bgCtx.lineTo(cx, y - 10);
      bgCtx.lineTo(cx, y);
      bgCtx.closePath(); bgCtx.fill();
      // Coin stacks
      bgCtx.fillStyle = '#fd4';
      for (let s = 0; s < 3; s++) {
        for (let c = 0; c <= s; c++) {
          bgCtx.beginPath();
          bgCtx.arc(cx - 8 + s * 8, cy + 6 - c * 5, 3, 0, Math.PI * 2);
          bgCtx.fill();
        }
      }

    } else {
      // Fallback generic building
      bgCtx.fillStyle = vis.color;
      bgCtx.fillRect(x, y, w, h);
      bgCtx.fillStyle = 'rgba(255,255,255,0.1)';
      bgCtx.fillRect(x, y, w, 3);
    }

    // Border
    bgCtx.strokeStyle = 'rgba(0,0,0,0.25)';
    bgCtx.lineWidth = 1;
    bgCtx.strokeRect(x, y, w, h);

    // Label
    bgCtx.fillStyle = '#fff';
    bgCtx.font = '7px monospace';
    bgCtx.textAlign = 'center';
    bgCtx.textBaseline = 'top';
    bgCtx.fillText(def.name, cx, y + h + 3);
  }
}

/** Draw the visible portion of the offscreen background, offset by camera. */
export function drawBackground(cam) {
  if (!cam) {
    ctx.drawImage(offscreenBg, 0, 0, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    return;
  }

  // Distant parallax layer (scrolls at 50% camera speed for depth)
  if (parallaxCanvas) {
    const parallaxX = cam.x * 0.5;
    const parallaxY = cam.y * 0.5;
    const srcX = Math.max(0, parallaxX) | 0;
    const srcY = Math.max(0, parallaxY) | 0;
    const srcW = Math.min(VIEW_W, parallaxCanvas.width - srcX);
    const srcH = Math.min(VIEW_H, parallaxCanvas.height - srcY);
    if (srcW > 0 && srcH > 0) {
      ctx.drawImage(parallaxCanvas, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
    }
  }

  // Main background at full camera speed
  ctx.drawImage(offscreenBg, cam.x, cam.y, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
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
  drawText(text, VIEW_W / 2, y, size, color, 'center');
}

// === Fade System ===
let fadeAlpha = 0;
let fadeTarget = 0;
let fadeSpeed = 2;
let fadeCallback = null;

export function startFade(target, speed, cb) {
  fadeTarget = target;
  fadeSpeed = speed || 2;
  fadeCallback = cb || null;
}

export function updateFade(dt) {
  if (Math.abs(fadeAlpha - fadeTarget) < 0.01) {
    fadeAlpha = fadeTarget;
    if (fadeCallback) { const cb = fadeCallback; fadeCallback = null; cb(); }
    return;
  }
  fadeAlpha += (fadeTarget > fadeAlpha ? 1 : -1) * fadeSpeed * dt;
  fadeAlpha = fadeTarget > fadeAlpha ? Math.min(fadeAlpha, fadeTarget) : Math.max(fadeAlpha, fadeTarget);
}

export function drawFade() {
  if (fadeAlpha > 0.01) {
    ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

/**
 * Draw animated torch flicker on top of the static background each frame.
 * Torch positions are in world space; camera transform should be active.
 */
export function drawTorchFlicker(targetCtx, time) {
  for (const [tx, ty] of TORCH_POSITIONS) {
    const pulse = Math.sin(time * 4.0 + tx * 0.1) * 0.4 + Math.sin(time * 7.3 + ty * 0.2) * 0.2;
    const radius = 30 + pulse * 8;
    const alpha = 0.08 + pulse * 0.04;

    // Pulsing radial glow
    const glowGrad = targetCtx.createRadialGradient(tx, ty, 0, tx, ty, radius);
    glowGrad.addColorStop(0, `rgba(255, 200, 80, ${Math.max(0.03, alpha)})`);
    glowGrad.addColorStop(0.5, `rgba(255, 160, 40, ${Math.max(0.01, alpha * 0.4)})`);
    glowGrad.addColorStop(1, 'rgba(255, 140, 30, 0)');
    targetCtx.fillStyle = glowGrad;
    targetCtx.beginPath();
    targetCtx.arc(tx, ty, radius, 0, Math.PI * 2);
    targetCtx.fill();

    // Flame flicker core with gradient
    const jx = tx + Math.sin(time * 11 + tx) * 1.5;
    const jy = ty + Math.cos(time * 9 + ty) * 1.5;
    const coreGrad = targetCtx.createRadialGradient(jx, jy - 1, 0, jx, jy, 3);
    coreGrad.addColorStop(0, '#fff8e0');
    coreGrad.addColorStop(0.4, '#ffcc44');
    coreGrad.addColorStop(1, 'rgba(255, 160, 40, 0)');
    targetCtx.fillStyle = coreGrad;
    targetCtx.beginPath();
    targetCtx.arc(jx, jy, 3, 0, Math.PI * 2);
    targetCtx.fill();

    // Rising particles: 3 small gradient circles drifting upward
    for (let pi = 0; pi < 3; pi++) {
      const phase = time * 3 + pi * 2.1 + tx * 0.05;
      const drift = (phase % 3) / 3; // 0..1 cycle
      const px = tx + Math.sin(phase * 2.5) * 4;
      const py = ty - 4 - drift * 20;
      const pr = 1.5 - drift * 1.2;
      const pa = (1 - drift) * 0.4;
      if (pr > 0.2) {
        const pGrad = targetCtx.createRadialGradient(px, py, 0, px, py, pr);
        pGrad.addColorStop(0, `rgba(255, 200, 80, ${pa})`);
        pGrad.addColorStop(1, `rgba(255, 140, 30, 0)`);
        targetCtx.fillStyle = pGrad;
        targetCtx.beginPath();
        targetCtx.arc(px, py, pr + 1, 0, Math.PI * 2);
        targetCtx.fill();
      }
    }
  }
}

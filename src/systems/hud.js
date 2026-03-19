import { VIEW_W, VIEW_H } from '../config.js';
import { lerp } from '../utils/math.js';
import { drawBar, drawText, drawTextCentered, drawRect, getCtx } from '../renderer.js';
import { isMuted } from './audio.js';

// ─── Smooth bar animation state ─────────────────────────────────
let displayHP = 100;
let displayXP = 0;
let displayGold = 0;
let levelUpFlash = 0;
let lastLevel = 1;

// ─── Wave banner slide-in state ─────────────────────────────────
let bannerY = -50;
let bannerWave = 0;
let bannerPhase = 'idle';  // 'slideIn' | 'hold' | 'slideOut' | 'idle'
let bannerTimer = 0;

const BANNER_W = 300;
const BANNER_H = 50;
const BANNER_SLIDE_IN = 0.3;
const BANNER_HOLD = 1.5;
const BANNER_SLIDE_OUT = 0.3;
const BANNER_TARGET_Y = 20;

// ─── Cached gradients (created once on first use) ────────────────
let cachedHpBarGrad = null;
let cachedXpBarGrad = null;
let cachedHeartGrad = null;
let cachedStarGrad = null;
let cachedCoinGrad = null;
let gradientsCached = false;

function ensureGradients(ctx) {
  if (gradientsCached) return;
  // HP bar gradient (160px wide)
  cachedHpBarGrad = ctx.createLinearGradient(0, 0, 160, 0);
  cachedHpBarGrad.addColorStop(0, '#cc3333');
  cachedHpBarGrad.addColorStop(1, '#881111');
  // XP bar gradient (160px wide)
  cachedXpBarGrad = ctx.createLinearGradient(0, 0, 160, 0);
  cachedXpBarGrad.addColorStop(0, '#ccaa33');
  cachedXpBarGrad.addColorStop(1, '#887711');
  // Heart gradient
  cachedHeartGrad = ctx.createLinearGradient(0, -6, 0, 8);
  cachedHeartGrad.addColorStop(0, '#ee4444');
  cachedHeartGrad.addColorStop(1, '#991111');
  // Star gradient
  cachedStarGrad = ctx.createLinearGradient(0, -7, 0, 7);
  cachedStarGrad.addColorStop(0, '#ffdd55');
  cachedStarGrad.addColorStop(1, '#bb8811');
  // Coin radial gradient
  cachedCoinGrad = ctx.createRadialGradient(0, -1, 0, 0, 0, 6);
  cachedCoinGrad.addColorStop(0, '#ffee77');
  cachedCoinGrad.addColorStop(0.6, '#ddaa22');
  cachedCoinGrad.addColorStop(1, '#aa7711');
  gradientsCached = true;
}

// ─── Helper: rounded rectangle path ─────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Icons ──────────────────────────────────────────────────────

function drawHeart(ctx, cx, cy, size) {
  ctx.save();
  const s = size;
  ctx.translate(cx, cy);
  ctx.beginPath();
  // Two arcs for the top bumps
  ctx.arc(-s * 0.3, -s * 0.15, s * 0.4, Math.PI, 0, false);
  ctx.arc(s * 0.3, -s * 0.15, s * 0.4, Math.PI, 0, false);
  // Triangle for the bottom point
  ctx.lineTo(0, s * 0.6);
  ctx.lineTo(-s * 0.7, -s * 0.15);
  ctx.closePath();
  ctx.fillStyle = cachedHeartGrad;
  ctx.fill();
  // Subtle shine highlight
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#ff8888';
  ctx.beginPath();
  ctx.arc(-s * 0.2, -s * 0.2, s * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  const spikes = 5;
  const outerR = size * 0.5;
  const innerR = size * 0.2;
  let rot = -Math.PI / 2;
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(Math.cos(rot) * outerR, Math.sin(rot) * outerR);
    rot += Math.PI / spikes;
    ctx.lineTo(Math.cos(rot) * innerR, Math.sin(rot) * innerR);
    rot += Math.PI / spikes;
  }
  ctx.closePath();
  ctx.fillStyle = cachedStarGrad;
  ctx.fill();
  // Center shine
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#ffffaa';
  ctx.beginPath();
  ctx.arc(0, -1, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCoin(ctx, cx, cy, size) {
  ctx.save();
  const r = size * 0.4;
  ctx.translate(cx, cy);
  // Coin body with radial gradient
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = cachedCoinGrad;
  ctx.fill();
  // Dark border
  ctx.strokeStyle = '#775500';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Inner ring detail
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(119,85,0,0.4)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // White arc shine spot
  ctx.beginPath();
  ctx.arc(-r * 0.25, -r * 0.25, r * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();
  ctx.restore();
}

function drawGem(ctx, cx, cy, size) {
  ctx.save();
  const s = size * 0.4;
  ctx.translate(cx, cy);
  // Diamond shape
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.6, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.6, 0);
  ctx.closePath();
  // Blue gradient fill
  const grd = ctx.createLinearGradient(-s * 0.6, -s, s * 0.6, s);
  grd.addColorStop(0, '#66bbff');
  grd.addColorStop(0.5, '#3388dd');
  grd.addColorStop(1, '#2255aa');
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.strokeStyle = '#1144aa';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Shine
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#aaddff';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.7);
  ctx.lineTo(s * 0.2, -s * 0.1);
  ctx.lineTo(-s * 0.2, -s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ─── Rounded bar drawing helper ─────────────────────────────────
function drawRoundedBar(ctx, x, y, w, h, pct, fgStyle, bgColor, r) {
  // Background
  ctx.fillStyle = bgColor;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  // Foreground (clipped to rounded rect)
  if (pct > 0.005) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = fgStyle;
    ctx.fillRect(x, y, w * Math.max(0, pct), h);
    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y, w * Math.max(0, pct), h * 0.35);
    ctx.restore();
  }
  // Border
  ctx.strokeStyle = 'rgba(60,40,20,0.5)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

// ─── Main HUD ───────────────────────────────────────────────────

export function drawHUD(player, waveManager, economy, walls, repairingSide) {
  const ctx = getCtx();
  ensureGradients(ctx);

  // Smooth interpolation
  displayHP = lerp(displayHP, player.hp, 0.1);
  displayXP = lerp(displayXP, player.xp / player.xpToNext, 0.15);
  displayGold = lerp(displayGold, economy.gold, 0.1);

  // Level up flash detection
  if (player.level > lastLevel) {
    levelUpFlash = 1.0;
    lastLevel = player.level;
  }

  // ─── Top bar background: warm dark gradient ───
  ctx.save();
  const topBarGrad = ctx.createLinearGradient(0, 0, VIEW_W, 0);
  topBarGrad.addColorStop(0, 'rgba(20,15,10,0.75)');
  topBarGrad.addColorStop(1, 'rgba(20,15,10,0.6)');
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(0, 0, VIEW_W, 44);
  // Subtle bottom edge
  ctx.fillStyle = 'rgba(160,128,64,0.15)';
  ctx.fillRect(0, 43, VIEW_W, 1);
  ctx.restore();

  // ─── HP Bar with heart icon ───
  drawHeart(ctx, 16, 12, 12);
  ctx.save();
  ctx.translate(32, 0);
  drawRoundedBar(ctx, 0, 5, 160, 13, displayHP / player.maxHP, cachedHpBarGrad, '#2a1a0a', 4);
  ctx.restore();
  // HP text with warm shadow
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(20,10,5,0.6)';
  ctx.fillText(`${Math.ceil(displayHP)}/${player.maxHP}`, 197, 8);
  ctx.fillStyle = '#eeddcc';
  ctx.fillText(`${Math.ceil(displayHP)}/${player.maxHP}`, 196, 7);

  // ─── XP Bar with star icon and level-up flash ───
  if (levelUpFlash > 0) {
    ctx.save();
    ctx.globalAlpha = levelUpFlash * 0.4;
    ctx.fillStyle = '#ffcc00';
    roundRect(ctx, 32, 22, 160, 12, 4);
    ctx.fill();
    ctx.restore();
  }
  drawStar(ctx, 16, 30, 14);
  ctx.save();
  ctx.translate(32, 0);
  drawRoundedBar(ctx, 0, 23, 160, 11, displayXP, cachedXpBarGrad, '#2a1a0a', 4);
  ctx.restore();
  // Level text
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(20,10,5,0.6)';
  ctx.fillText(`Lv.${player.level}`, 197, 25);
  ctx.fillStyle = '#eeddaa';
  ctx.fillText(`Lv.${player.level}`, 196, 24);

  // ─── Wave counter: parchment-styled ───
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(20,10,5,0.5)';
  ctx.fillText(`Wave ${waveManager.wave}/50`, 341, 8);
  ctx.fillStyle = '#ddb866';
  ctx.fillText(`Wave ${waveManager.wave}/50`, 340, 7);

  // ─── Enemies remaining: red-tinted with glow ───
  const alive = waveManager.enemiesAlive;
  if (waveManager.active) {
    ctx.font = '8px "Press Start 2P", monospace';
    // Subtle red glow
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ff4444';
    ctx.fillText(`Enemies: ${alive}`, 341, 26);
    ctx.fillText(`Enemies: ${alive}`, 339, 24);
    ctx.restore();
    ctx.fillStyle = 'rgba(20,5,5,0.5)';
    ctx.fillText(`Enemies: ${alive}`, 341, 25);
    ctx.fillStyle = '#ff8877';
    ctx.fillText(`Enemies: ${alive}`, 340, 24);
  }

  // ─── Gold with coin icon ───
  drawCoin(ctx, 590, 12, 14);
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(20,10,5,0.5)';
  ctx.fillText(`${Math.round(displayGold)}`, 605, 7);
  ctx.fillStyle = '#ffdd55';
  ctx.fillText(`${Math.round(displayGold)}`, 604, 6);

  // ─── Crystals with gem icon ───
  if (economy.crystals > 0) {
    drawGem(ctx, 784, 12, 14);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = 'rgba(10,10,20,0.5)';
    ctx.fillText(`${economy.crystals}`, 797, 7);
    ctx.fillStyle = '#88ddff';
    ctx.fillText(`${economy.crystals}`, 796, 6);
  }

  // ─── Score ───
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = 'rgba(20,10,5,0.4)';
  ctx.fillText(`Score: ${player.score}`, 605, 25);
  ctx.fillStyle = '#bbaa88';
  ctx.fillText(`Score: ${player.score}`, 604, 24);

  // ─── Bottom bar ───
  ctx.save();
  const botBarGrad = ctx.createLinearGradient(0, VIEW_H - 28, VIEW_W, VIEW_H - 28);
  botBarGrad.addColorStop(0, 'rgba(20,15,10,0.7)');
  botBarGrad.addColorStop(1, 'rgba(20,15,10,0.55)');
  ctx.fillStyle = botBarGrad;
  ctx.fillRect(0, VIEW_H - 28, VIEW_W, 28);
  // Top edge accent
  ctx.fillStyle = 'rgba(160,128,64,0.12)';
  ctx.fillRect(0, VIEW_H - 28, VIEW_W, 1);
  ctx.restore();

  // Key hints in parchment gold tone
  const hints = [
    ['[1] Potion x' + player.potions, 10],
    ['[F] Repair', 200],
    ['[G] Regroup', 360],
    ['[RMB] Block', 530],
    ['[LMB] Attack', 710],
    ['[ESC] Pause', 870],
  ];
  ctx.font = '8px "Press Start 2P", monospace';
  for (const [txt, hx] of hints) {
    ctx.fillStyle = 'rgba(20,10,5,0.4)';
    ctx.fillText(txt, hx + 1, VIEW_H - 21);
    ctx.fillStyle = '#ddb866';
    ctx.fillText(txt, hx, VIEW_H - 22);
  }

  // Mute indicator
  if (isMuted()) {
    ctx.fillStyle = 'rgba(20,5,5,0.4)';
    ctx.fillText('MUTED', VIEW_W - 59, VIEW_H - 21);
    ctx.fillStyle = '#ee6655';
    ctx.fillText('MUTED', VIEW_W - 60, VIEW_H - 22);
  } else {
    ctx.fillStyle = 'rgba(20,10,5,0.3)';
    ctx.fillText('[M] Sound', VIEW_W - 99, VIEW_H - 21);
    ctx.fillStyle = '#887755';
    ctx.fillText('[M] Sound', VIEW_W - 100, VIEW_H - 22);
  }

  // ─── Wall status panel ───
  if (walls) {
    ctx.save();
    // Dark parchment background (warm brown)
    ctx.fillStyle = 'rgba(40,30,18,0.75)';
    roundRect(ctx, 8, VIEW_H - 100, 164, 64, 6);
    ctx.fill();
    // Gold border
    ctx.strokeStyle = 'rgba(160,128,64,0.4)';
    ctx.lineWidth = 1;
    roundRect(ctx, 8, VIEW_H - 100, 164, 64, 6);
    ctx.stroke();
    ctx.restore();

    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(20,10,5,0.4)';
    ctx.fillText('WALL STATUS', 15, VIEW_H - 93);
    ctx.fillStyle = '#eeddbb';
    ctx.fillText('WALL STATUS', 14, VIEW_H - 94);

    const sides = ['north', 'south', 'east', 'west'];
    const labels = ['N', 'S', 'E', 'W'];
    for (let i = 0; i < sides.length; i++) {
      const wall = walls[sides[i]];
      const yOff = VIEW_H - 82 + i * 13;

      ctx.fillStyle = '#ccbb99';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText(labels[i], 14, yOff);

      if (wall) {
        const pct = wall.hp / wall.maxHP;
        let barFg;
        if (wall.destroyed) {
          barFg = '#555544';
        } else if (pct > 0.5) {
          barFg = '#55aa55';
        } else if (pct > 0.25) {
          barFg = '#bbaa44';
        } else {
          barFg = '#bb4444';
        }
        drawRoundedBar(ctx, 30, yOff, 100, 8, wall.destroyed ? 0 : pct, barFg, '#1a1208', 3);

        ctx.font = '7px "Press Start 2P", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        if (wall.destroyed) {
          ctx.fillStyle = 'rgba(20,5,0,0.4)';
          ctx.fillText('DOWN', 135, yOff + 1);
          ctx.fillStyle = '#ee6633';
          ctx.fillText('DOWN', 134, yOff);
        } else {
          ctx.fillStyle = '#ccbb99';
          ctx.fillText(`${Math.ceil(pct * 100)}%`, 134, yOff);
        }
      }
    }
  }

  // ─── Repair indicator ───
  if (repairingSide) {
    const label = `Repairing [${repairingSide.toUpperCase()} WALL]`;
    ctx.font = '8px "Press Start 2P", monospace';
    const tw = ctx.measureText(label).width;
    const px = VIEW_W / 2 - tw / 2 - 12;
    const py = VIEW_H / 2 + 58;
    const pw = tw + 24;
    const ph = 28;
    // Warm parchment pill background
    ctx.fillStyle = 'rgba(40,30,18,0.8)';
    roundRect(ctx, px, py, pw, ph, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,128,64,0.5)';
    ctx.lineWidth = 1;
    roundRect(ctx, px, py, pw, ph, 10);
    ctx.stroke();
    // Warm glowing text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(20,10,5,0.4)';
    ctx.fillText(label, VIEW_W / 2 - tw / 2 + 1, py + 8);
    ctx.fillStyle = '#88ff88';
    ctx.fillText(label, VIEW_W / 2 - tw / 2, py + 7);
  }

  // Decrement level up flash
  if (levelUpFlash > 0) {
    levelUpFlash -= 0.016;
    if (levelUpFlash < 0) levelUpFlash = 0;
  }
}

// ─── Wave Announcement Banner ───────────────────────────────────

export function drawWaveAnnouncement(wave, timer) {
  if (timer <= 0) return;
  const ctx = getCtx();

  // Initialize banner on new wave
  if (wave !== bannerWave || bannerPhase === 'idle') {
    bannerWave = wave;
    bannerPhase = 'slideIn';
    bannerTimer = BANNER_SLIDE_IN;
    bannerY = -BANNER_H;
  }

  // Advance banner phases
  const dt = 0.016; // approximate frame time
  bannerTimer -= dt;

  if (bannerPhase === 'slideIn') {
    const progress = 1 - Math.max(0, bannerTimer / BANNER_SLIDE_IN);
    const eased = 1 - Math.pow(1 - progress, 3);
    bannerY = -BANNER_H + (BANNER_TARGET_Y + BANNER_H) * eased;
    if (bannerTimer <= 0) {
      bannerPhase = 'hold';
      bannerTimer = BANNER_HOLD;
      bannerY = BANNER_TARGET_Y;
    }
  } else if (bannerPhase === 'hold') {
    bannerY = BANNER_TARGET_Y;
    if (bannerTimer <= 0) {
      bannerPhase = 'slideOut';
      bannerTimer = BANNER_SLIDE_OUT;
    }
  } else if (bannerPhase === 'slideOut') {
    const progress = 1 - Math.max(0, bannerTimer / BANNER_SLIDE_OUT);
    const eased = Math.pow(progress, 3);
    bannerY = BANNER_TARGET_Y - (BANNER_TARGET_Y + BANNER_H) * eased;
    if (bannerTimer <= 0) {
      bannerPhase = 'idle';
      return;
    }
  }

  const bx = VIEW_W / 2 - BANNER_W / 2;

  ctx.save();
  // Shadow underneath banner
  ctx.fillStyle = 'rgba(10,8,4,0.35)';
  roundRect(ctx, bx + 4, bannerY + 4, BANNER_W, BANNER_H, 8);
  ctx.fill();

  // Banner: warm tan parchment gradient
  const bannerGrad = ctx.createLinearGradient(bx, bannerY, bx, bannerY + BANNER_H);
  bannerGrad.addColorStop(0, '#d4c4a0');
  bannerGrad.addColorStop(0.5, '#c8b890');
  bannerGrad.addColorStop(1, '#b4a480');
  ctx.fillStyle = bannerGrad;
  roundRect(ctx, bx, bannerY, BANNER_W, BANNER_H, 8);
  ctx.fill();

  // Gold border
  ctx.strokeStyle = '#a08040';
  ctx.lineWidth = 2.5;
  roundRect(ctx, bx, bannerY, BANNER_W, BANNER_H, 8);
  ctx.stroke();

  // Inner subtle gold line
  ctx.strokeStyle = 'rgba(180,150,80,0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, bx + 4, bannerY + 4, BANNER_W - 8, BANNER_H - 8, 5);
  ctx.stroke();

  // Text centered
  ctx.font = '14px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Golden drop shadow
  ctx.fillStyle = 'rgba(160,128,64,0.4)';
  ctx.fillText(`WAVE ${wave}`, VIEW_W / 2 + 1, bannerY + BANNER_H / 2 + 2);
  // Main text: dark brown
  ctx.fillStyle = '#3a2a1a';
  ctx.fillText(`WAVE ${wave}`, VIEW_W / 2, bannerY + BANNER_H / 2);
  ctx.restore();
}

// ─── Tutorial ───────────────────────────────────────────────────

export function drawTutorial(step, timer) {
  if (timer <= 0) return;
  const ctx = getCtx();
  const alpha = Math.min(1, timer);
  ctx.globalAlpha = alpha;

  const messages = [
    'WASD to move',
    'Click to attack',
    'Defeat the orcs!',
    'Walk over gold to collect!',
  ];

  if (step < messages.length) {
    const text = messages[step];
    ctx.font = '10px "Press Start 2P", monospace';
    const tw = ctx.measureText(text).width;
    const pw = tw + 36;
    const px = VIEW_W / 2 - pw / 2;
    const py = VIEW_H - 88;
    const ph = 32;

    // Warm parchment pill
    ctx.fillStyle = 'rgba(60,45,25,0.8)';
    roundRect(ctx, px, py, pw, ph, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,128,64,0.4)';
    ctx.lineWidth = 1;
    roundRect(ctx, px, py, pw, ph, 12);
    ctx.stroke();

    // Text in warm brown with shadow
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(20,10,5,0.4)';
    ctx.fillText(text, VIEW_W / 2 + 1, py + ph / 2 + 1);
    ctx.fillStyle = '#eeddbb';
    ctx.fillText(text, VIEW_W / 2, py + ph / 2);
  }
  ctx.globalAlpha = 1;
}

// ─── Boss HP Bar ────────────────────────────────────────────────

export function drawBossHP(enemies) {
  if (!enemies) return;

  let boss = null;
  for (const e of enemies) {
    if (e.type === 'boss' && e.alive) {
      boss = e;
      break;
    }
  }
  if (!boss) return;

  const ctx = getCtx();
  const barY = 48;
  const barH = 18;
  const barMargin = 20;
  const barW = VIEW_W - barMargin * 2;

  ctx.save();
  // Dark parchment background
  ctx.fillStyle = 'rgba(30,22,12,0.8)';
  roundRect(ctx, barMargin - 6, barY - 4, barW + 12, barH + 8, 6);
  ctx.fill();
  // Gold border
  ctx.strokeStyle = 'rgba(160,128,64,0.5)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, barMargin - 6, barY - 4, barW + 12, barH + 8, 6);
  ctx.stroke();

  // HP bar with red gradient
  const pct = Math.max(0, boss.hp / boss.maxHP);
  const bossHpGrad = ctx.createLinearGradient(barMargin, 0, barMargin + barW, 0);
  bossHpGrad.addColorStop(0, '#cc2222');
  bossHpGrad.addColorStop(1, '#881111');
  drawRoundedBar(ctx, barMargin, barY, barW, barH, pct, bossHpGrad, '#1a0808', 4);

  // Boss name in warm cream with shadow (left)
  const bossName = boss.name || 'BOSS';
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(10,5,0,0.5)';
  ctx.fillText(bossName, barMargin + 5, barY + 4);
  ctx.fillStyle = '#eeddcc';
  ctx.fillText(bossName, barMargin + 4, barY + 3);

  // HP percentage (right)
  const pctText = `${Math.ceil(pct * 100)}%`;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(10,5,0,0.5)';
  ctx.fillText(pctText, barMargin + barW - 3, barY + 4);
  ctx.fillStyle = '#ffaa88';
  ctx.fillText(pctText, barMargin + barW - 4, barY + 3);
  ctx.restore();
}

// ─── Damage Numbers ─────────────────────────────────────────────

export function drawDamageNumbers(texts) {
  if (!texts || texts.length === 0) return;
  const ctx = getCtx();

  for (const t of texts) {
    const alpha = Math.min(1, t.timer * 2);
    ctx.globalAlpha = alpha;

    // Parse numeric value for sizing
    const numericVal = parseInt(t.text, 10) || 10;
    const size = Math.min(16, 8 + Math.floor(numericVal / 10));

    let drawY = t.y;

    // Crit bounce effect (yellow text = crit)
    const isCrit = t.color === '#ff0';
    if (isCrit) {
      const elapsed = t.maxLife !== undefined ? t.maxLife - t.timer : 1 - t.timer;
      drawY += Math.sin(elapsed * 12) * 4;
    }

    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Dark shadow (offset 1px)
    ctx.fillStyle = 'rgba(10,5,0,0.7)';
    ctx.fillText(t.text, t.x + 1, drawY + 1);
    // Main color
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, drawY);

    // Crit label alongside
    if (isCrit) {
      const mainWidth = ctx.measureText(t.text).width;
      ctx.font = `${Math.max(6, size - 2)}px "Press Start 2P", monospace`;
      // Orange glow behind CRIT text
      ctx.fillStyle = 'rgba(255,160,0,0.4)';
      ctx.fillText('CRIT!', t.x + mainWidth + 4, drawY + 1);
      ctx.fillText('CRIT!', t.x + mainWidth + 2, drawY - 1);
      // Bright gold CRIT text
      ctx.fillStyle = '#ffdd44';
      ctx.fillText('CRIT!', t.x + mainWidth + 3, drawY);
    }
  }
  ctx.globalAlpha = 1;
}

// ─── Reset HUD State ────────────────────────────────────────────

export function resetHUDState() {
  displayHP = 100;
  displayXP = 0;
  displayGold = 0;
  levelUpFlash = 0;
  lastLevel = 1;
  bannerY = -50;
  bannerWave = 0;
  bannerPhase = 'idle';
  bannerTimer = 0;
}

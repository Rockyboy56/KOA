import { BUILDINGS, GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { getCtx } from '../renderer.js';
import { pointInRect } from '../utils/collision.js';
import { getMouse } from '../input.js';
import * as Econ from '../systems/economy.js';
import { playPurchase } from '../systems/audio.js';

// ─── Node Layout (hardcoded positions for each building) ───
// Arranged in 5 branches within the 960x540 shop overlay
const NODE_W = 90;
const NODE_H = 36;
const LAYOUT = {
  // Fortification branch — top-left
  lumberMill:          { x: 30,  y: 110 },
  stoneworks:          { x: 140, y: 110 },
  masonry:             { x: 250, y: 110 },
  forge:               { x: 360, y: 110 },
  engineeringWorkshop: { x: 140, y: 160 },
  spikedBarricades:    { x: 250, y: 160 },
  moat:                { x: 360, y: 160 },
  archeryRange:        { x: 140, y: 210 },

  // Military branch — top-right
  barracks:            { x: 530, y: 110 },
  knightAcademy:       { x: 640, y: 110 },
  advCombat:           { x: 750, y: 110 },

  // Crafting branch — middle-left
  blacksmith:          { x: 30,  y: 280 },
  armory:              { x: 140, y: 280 },
  weaponsmith:         { x: 140, y: 330 },
  masterForge:         { x: 250, y: 330 },

  // Magic branch — middle-right
  apothecary:          { x: 530, y: 280 },
  alchemistLab:        { x: 640, y: 280 },
  wizardTower:         { x: 750, y: 280 },
  arcaneLibrary:       { x: 860, y: 280 },

  // Economy branch — bottom-center
  goldMine:            { x: 300, y: 410 },
  crystalMine:         { x: 420, y: 410 },
  treasury:            { x: 540, y: 410 },
};

// Parent -> child connections (for drawing lines)
const CONNECTIONS = [];
for (const [key, def] of Object.entries(BUILDINGS)) {
  if (def.requires && LAYOUT[key] && LAYOUT[def.requires]) {
    CONNECTIONS.push({ from: def.requires, to: key });
  }
}

// ─── Branch Labels ───
const BRANCH_LABELS = [
  { text: 'FORTIFICATION', x: 30, y: 96, color: '#ca8' },
  { text: 'MILITARY', x: 530, y: 96, color: '#8ac' },
  { text: 'CRAFTING', x: 30, y: 266, color: '#ca6' },
  { text: 'MAGIC', x: 530, y: 266, color: '#a8d' },
  { text: 'ECONOMY', x: 300, y: 396, color: '#da4' },
];

let hoveredNode = null;

/** Build clickable areas and process clicks for the tech tree. */
export function updateTechTree(economy, discount, mouseClicked) {
  const mouse = getMouse();
  hoveredNode = null;
  const actions = [];

  for (const [key, pos] of Object.entries(LAYOUT)) {
    const def = BUILDINGS[key];
    if (!def) continue;

    const rect = { x: pos.x, y: pos.y, width: NODE_W, height: NODE_H };
    const owned = !!economy.buildings[key];
    const canBuy = Econ.canBuyBuilding(economy, key, discount);
    const locked = def.requires && !economy.buildings[def.requires];

    if (pointInRect(mouse.x, mouse.y, rect)) {
      hoveredNode = { key, def, pos, owned, canBuy, locked };
    }

    if (mouseClicked && canBuy && !owned && pointInRect(mouse.x, mouse.y, rect)) {
      actions.push(() => Econ.buyBuilding(economy, key, discount));
    }
  }

  // Execute first action (only one buy per click)
  if (actions.length > 0) { actions[0](); playPurchase(); }
}

/** Render the visual tech tree with nodes, connections, and tooltips. */
export function drawTechTree(economy, discount) {
  const ctx = getCtx();
  const mouse = getMouse();
  const time = performance.now() / 1000;

  // Branch labels
  ctx.font = '8px "Press Start 2P", monospace';
  for (const label of BRANCH_LABELS) {
    ctx.fillStyle = label.color;
    ctx.textAlign = 'left';
    ctx.fillText(label.text, label.x, label.y);
  }

  // Draw connection lines first (behind nodes)
  for (const conn of CONNECTIONS) {
    const from = LAYOUT[conn.from];
    const to = LAYOUT[conn.to];
    if (!from || !to) continue;

    const fromOwned = !!economy.buildings[conn.from];
    const toOwned = !!economy.buildings[conn.to];

    ctx.strokeStyle = toOwned ? '#4a4' : fromOwned ? '#886' : '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const fx = from.x + NODE_W;
    const fy = from.y + NODE_H / 2;
    const tx = to.x;
    const ty = to.y + NODE_H / 2;

    // If same row, draw straight; otherwise draw elbow
    if (Math.abs(fy - ty) < 5) {
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
    } else {
      const midX = (fx + tx) / 2;
      ctx.moveTo(fx, fy);
      ctx.lineTo(midX, fy);
      ctx.lineTo(midX, ty);
      ctx.lineTo(tx, ty);
    }
    ctx.stroke();

    // Arrow at end
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(tx, ty - 4);
    ctx.lineTo(tx + 6, ty);
    ctx.lineTo(tx, ty + 4);
    ctx.fill();
  }

  // Draw nodes
  for (const [key, pos] of Object.entries(LAYOUT)) {
    const def = BUILDINGS[key];
    if (!def) continue;

    const owned = !!economy.buildings[key];
    const canBuy = Econ.canBuyBuilding(economy, key, discount);
    const locked = def.requires && !economy.buildings[def.requires];
    const isHovered = hoveredNode && hoveredNode.key === key;

    // Node background color
    let bgColor, borderColor, textColor;
    if (owned) {
      bgColor = '#2a4a2a';
      borderColor = '#4a4';
      textColor = '#8c8';
    } else if (canBuy) {
      // Pulsing gold for available
      const pulse = 0.6 + 0.4 * Math.sin(time * 3);
      const r = Math.round(180 * pulse);
      const g = Math.round(150 * pulse);
      bgColor = `rgb(${r},${g},40)`;
      borderColor = '#da4';
      textColor = '#fff';
    } else if (locked) {
      bgColor = '#1a1a1a';
      borderColor = '#333';
      textColor = '#555';
    } else {
      // Unlocked but can't afford
      bgColor = '#2a2a2a';
      borderColor = '#555';
      textColor = '#888';
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, pos.x + 2, pos.y + 2, NODE_W, NODE_H, 6);
    ctx.fill();

    // Body
    ctx.fillStyle = bgColor;
    roundRect(ctx, pos.x, pos.y, NODE_W, NODE_H, 6);
    ctx.fill();

    // Border
    ctx.strokeStyle = isHovered ? '#fff' : borderColor;
    ctx.lineWidth = isHovered ? 2 : 1;
    roundRect(ctx, pos.x, pos.y, NODE_W, NODE_H, 6);
    ctx.stroke();

    // Name (truncated if needed)
    ctx.fillStyle = textColor;
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.name, pos.x + NODE_W / 2, pos.y + NODE_H / 2 - 4);

    // Cost or BUILT
    ctx.font = '6px "Press Start 2P", monospace';
    if (owned) {
      ctx.fillStyle = '#4a4';
      ctx.fillText('BUILT', pos.x + NODE_W / 2, pos.y + NODE_H / 2 + 8);
    } else {
      ctx.fillStyle = canBuy ? '#fd4' : '#666';
      ctx.fillText(`${Math.round(def.cost * (1 - discount))}g`, pos.x + NODE_W / 2, pos.y + NODE_H / 2 + 8);
    }
  }

  // Tooltip on hover
  if (hoveredNode) {
    const { def, pos, owned, canBuy, locked } = hoveredNode;
    const tx = Math.min(pos.x, GAME_WIDTH - 220);
    // Clamp Y: show above node if tooltip would overlap bottom UI
    const ty = (pos.y + NODE_H + 8 + 52 > GAME_HEIGHT - 70)
      ? pos.y - 60
      : pos.y + NODE_H + 8;

    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    roundRect(ctx, tx, ty, 210, 52, 4);
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    roundRect(ctx, tx, ty, 210, 52, 4);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText(def.name, tx + 6, ty + 6);

    ctx.fillStyle = '#aaa';
    ctx.font = '6px "Press Start 2P", monospace';
    if (owned) {
      ctx.fillText('Already built', tx + 6, ty + 20);
    } else if (locked) {
      const reqName = BUILDINGS[def.requires]?.name || def.requires;
      ctx.fillText(`Requires: ${reqName}`, tx + 6, ty + 20);
    } else if (canBuy) {
      ctx.fillStyle = '#fd4';
      ctx.fillText('Click to purchase', tx + 6, ty + 20);
    } else {
      ctx.fillText(`Cost: ${Math.round(def.cost * (1 - discount))}g`, tx + 6, ty + 20);
    }

    // Show what it unlocks
    if (def.unlocks && def.unlocks.length > 0) {
      const unlockNames = def.unlocks.map(k => BUILDINGS[k]?.name || k).join(', ');
      ctx.fillStyle = '#886';
      ctx.fillText(`Unlocks: ${unlockNames}`, tx + 6, ty + 34);
    }
  }

  ctx.textBaseline = 'top'; // reset
}

/** Draw a rounded rectangle path (does not fill/stroke). */
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

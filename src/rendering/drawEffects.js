/**
 * Standalone slash arc drawing utilities.
 * These are also embedded in drawPlayer.js but exported here for external use.
 */

/**
 * Draw the slash arc effect for the current attack.
 * @param {CanvasRenderingContext2D} ctx - Already positioned at attacker center
 * @param {object} attack - { combo, progress, facing, r }
 *   combo: 1|2|3, progress: 0-1, facing: angle in radians, r: attacker radius
 */
export function drawSlashArc(ctx, attack) {
  const { combo, progress, facing, r } = attack;
  if (progress <= 0 || progress >= 1) return;

  ctx.save();

  if (combo === 1) {
    // Blue horizontal sweep arc
    const arcSpan = Math.PI * (5 / 4);
    const startAngle = facing + Math.PI * 0.55;
    const endAngle = startAngle - arcSpan * progress;
    const alpha = Math.sin(progress * Math.PI) * 0.65;
    const sweepR = r + 44;

    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, sweepR, endAngle, startAngle);
    ctx.closePath();
    const arcG = ctx.createRadialGradient(0, 0, 20, 0, 0, sweepR);
    arcG.addColorStop(0, `rgba(60,120,255,${alpha * 0.4})`);
    arcG.addColorStop(1, `rgba(60,120,255,0)`);
    ctx.fillStyle = arcG; ctx.fill();

    ctx.strokeStyle = `rgba(140,200,255,${alpha})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, sweepR, endAngle - 0.05, endAngle); ctx.stroke();
    for (let i = 1; i <= 4; i++) {
      ctx.strokeStyle = `rgba(100,160,255,${alpha * (1 - i * 0.22)})`; ctx.lineWidth = 2 - i * 0.25;
      ctx.beginPath(); ctx.arc(0, 0, sweepR - i * 3, endAngle + i * 0.2, endAngle); ctx.stroke();
    }

  } else if (combo === 2) {
    // Orange thrust streaks (no arc — forward speed lines)
    const alpha = (1 - progress) * 0.85;
    const cosF = Math.cos(facing), sinF = Math.sin(facing);
    const perpX = -sinF, perpY = cosF;

    for (let i = 1; i <= 6; i++) {
      const offX = perpX * (i - 3.5) * 2;
      const offY = perpY * (i - 3.5) * 2;
      const streakLen = 18 + i * 5 + progress * 18;
      ctx.strokeStyle = `rgba(255,${130 + i * 12},20,${alpha * (1 - i * 0.1)})`;
      ctx.lineWidth = 4.5 - i * 0.5;
      ctx.beginPath();
      ctx.moveTo(offX + cosF * 12, offY + sinF * 12);
      ctx.lineTo(offX - cosF * streakLen, offY - sinF * streakLen);
      ctx.stroke();
    }

    if (progress > 0.45) {
      const ep = (progress - 0.45) / 0.55;
      const tipX = cosF * (r + 36), tipY = sinF * (r + 36);
      const flashG = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 24 * ep);
      flashG.addColorStop(0, `rgba(255,220,80,${ep * 0.8})`);
      flashG.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = flashG;
      ctx.beginPath(); ctx.arc(tipX, tipY, 24 * ep, 0, Math.PI * 2); ctx.fill();
    }

  } else if (combo >= 3) {
    // Red/gold spinning orbit arc + explosion burst at end
    const spinStart = facing - Math.PI * 0.4;
    const spinEnd = spinStart + progress * Math.PI * (5 / 3);
    const alpha = 0.55, spinR = r + 50;

    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, spinR, spinStart, spinEnd); ctx.closePath();
    const arcG = ctx.createRadialGradient(0, 0, 22, 0, 0, spinR);
    arcG.addColorStop(0, `rgba(255,80,20,${alpha * 0.3})`);
    arcG.addColorStop(0.6, `rgba(255,160,30,${alpha * 0.45})`);
    arcG.addColorStop(1, `rgba(255,200,80,0)`);
    ctx.fillStyle = arcG; ctx.fill();

    ctx.strokeStyle = `rgba(255,180,40,${alpha * 0.9})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, spinR, spinEnd - 0.08, spinEnd); ctx.stroke();
    for (let i = 1; i <= 5; i++) {
      ctx.strokeStyle = `rgba(255,140,30,${alpha * (1 - i * 0.18)})`; ctx.lineWidth = 3 - i * 0.4;
      ctx.beginPath(); ctx.arc(0, 0, spinR - i * 2, spinEnd - i * 0.28, spinEnd - i * 0.05); ctx.stroke();
    }

    if (progress > 0.82) {
      const ep = (progress - 0.82) / 0.18;
      ctx.strokeStyle = `rgba(255,210,80,${1 - ep})`; ctx.lineWidth = 4 * (1 - ep) + 1;
      ctx.beginPath(); ctx.arc(0, 0, ep * 82, 0, Math.PI * 2); ctx.stroke();
      if (ep > 0.25) {
        ctx.strokeStyle = `rgba(255,100,30,${(1 - ep) * 0.7})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, (ep - 0.25) * 0.85 * 65, 0, Math.PI * 2); ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const sa = (i / 12) * Math.PI * 2;
        const sd = (32 + (i % 3) * 12) * Math.min(ep * 1.4, 1);
        ctx.strokeStyle = `rgba(255,${(150 + (i * 17) % 100) | 0},30,${(1 - ep) * 0.9})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * 13, Math.sin(sa) * 13);
        ctx.lineTo(Math.cos(sa) * sd, Math.sin(sa) * sd);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

/**
 * Axe chop: tight 90° downward arc, earth-brown/dark-grey trail + impact dust.
 * ctx is already translated to attacker center.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} attack - { progress: 0-1, facing: radians, r: number }
 */
export function axeChop(ctx, attack) {
  const { progress, facing, r } = attack;
  if (progress <= 0) return;

  ctx.save();

  const arcSpan = Math.PI * 0.5; // 90° tight arc
  const arcStart = facing + Math.PI * 0.8; // arm raised behind
  const arcEnd = arcStart - arcSpan * progress;
  const sweepR = r + 34;
  const alpha = Math.sin(progress * Math.PI) * 0.9;

  // Arc fill: earth-brown
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.arc(0, 0, sweepR, arcEnd, arcStart);
  ctx.closePath();
  const arcG = ctx.createRadialGradient(0, 0, 10, 0, 0, sweepR);
  arcG.addColorStop(0, `rgba(110,75,30,${alpha * 0.5})`);
  arcG.addColorStop(0.5, `rgba(80,55,20,${alpha * 0.6})`);
  arcG.addColorStop(1, `rgba(55,40,15,0)`);
  ctx.fillStyle = arcG; ctx.fill();

  // Heavy leading edge (dark grey/brown)
  ctx.strokeStyle = `rgba(70,55,35,${alpha})`; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(0, 0, sweepR, arcEnd - 0.04, arcEnd); ctx.stroke();

  // Chunky trailing line
  ctx.strokeStyle = `rgba(120,90,45,${alpha * 0.7})`; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, sweepR - 7, arcEnd - 0.15, arcEnd + 0.05); ctx.stroke();

  // Impact dust burst at end of arc (progress > 0.8)
  if (progress > 0.8) {
    const ep = (progress - 0.8) / 0.2;
    const tipX = Math.cos(arcEnd) * sweepR;
    const tipY = Math.sin(arcEnd) * sweepR;
    for (let i = 0; i < 6; i++) {
      const dustA = arcEnd + (i / 6 - 0.5) * Math.PI * 0.9;
      const dustD = (10 + i * 5) * ep;
      const dustX = tipX + Math.cos(dustA) * dustD;
      const dustY = tipY + Math.sin(dustA) * dustD;
      const dustR = Math.max(0.5, (4 + i * 1.5) * (1 - ep * 0.4));
      const dustAlpha = (1 - ep) * 0.75;
      const bv = 130 - i * 8;
      ctx.fillStyle = `rgba(${bv},${Math.floor(bv * 0.65)},${Math.floor(bv * 0.28)},${dustAlpha})`;
      ctx.beginPath(); ctx.arc(dustX, dustY, dustR, 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Mace slam: straight forward punch, expanding shockwave rings, stun stars.
 * ctx is already translated to attacker center.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} attack - { progress: 0-1, facing: radians, r: number }
 */
export function maceSlam(ctx, attack) {
  const { progress, facing, r } = attack;
  if (progress <= 0) return;

  ctx.save();

  const cosF = Math.cos(facing);
  const sinF = Math.sin(facing);
  const reachDist = r + 22 + progress * 18;
  const tipX = cosF * reachDist;
  const tipY = sinF * reachDist;
  const alpha = Math.sin(progress * Math.PI) * 0.85;

  // Impact glow at mace tip
  const impG = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 16);
  impG.addColorStop(0, `rgba(230,230,255,${alpha * 0.8})`);
  impG.addColorStop(0.5, `rgba(180,190,255,${alpha * 0.4})`);
  impG.addColorStop(1, `rgba(150,160,255,0)`);
  ctx.fillStyle = impG;
  ctx.beginPath(); ctx.arc(tipX, tipY, 16, 0, Math.PI * 2); ctx.fill();

  // Shockwave ring: white → transparent, grows 0→60px
  const ringR = progress * 60;
  ctx.strokeStyle = `rgba(255,255,255,${(1 - progress) * 0.85})`;
  ctx.lineWidth = 5 * (1 - progress * 0.8) + 1;
  ctx.beginPath(); ctx.arc(tipX, tipY, ringR, 0, Math.PI * 2); ctx.stroke();

  // Secondary blue ring (delayed)
  if (progress > 0.15) {
    const bp = (progress - 0.15) / 0.85;
    ctx.strokeStyle = `rgba(100,140,255,${(1 - bp) * 0.5})`;
    ctx.lineWidth = 3 * (1 - bp) + 1;
    ctx.beginPath(); ctx.arc(tipX, tipY, bp * 55, 0, Math.PI * 2); ctx.stroke();
  }

  // Stun stars: 3 spinning outward
  if (progress > 0.3) {
    const sp = (progress - 0.3) / 0.7;
    for (let i = 0; i < 3; i++) {
      const sa = (i / 3) * Math.PI * 2 + sp * Math.PI * 1.5;
      const sx = tipX + Math.cos(sa) * (12 + sp * 28);
      const sy = tipY + Math.sin(sa) * (12 + sp * 28);
      const starA = (1 - sp) * 0.9;
      const ss = 4.5 * (1 - sp * 0.5);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(sa + sp * Math.PI * 2);
      ctx.fillStyle = `rgba(255,235,50,${starA})`;
      ctx.beginPath();
      ctx.moveTo(0, -ss); ctx.lineTo(ss * 0.3, -ss * 0.3);
      ctx.lineTo(ss, 0); ctx.lineTo(ss * 0.3, ss * 0.3);
      ctx.lineTo(0, ss); ctx.lineTo(-ss * 0.3, ss * 0.3);
      ctx.lineTo(-ss, 0); ctx.lineTo(-ss * 0.3, -ss * 0.3);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Ranged fire: muzzle flash at barrel tip (lasts first ~35% of active phase).
 * ctx is already translated to attacker center.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} attack - { progress: 0-1, facing: radians, r: number }
 */
export function rangedFire(ctx, attack) {
  const { progress, facing, r } = attack;
  if (progress <= 0 || progress > 0.38) return;

  ctx.save();

  const flashFrac = 1 - progress / 0.38;
  const cosF = Math.cos(facing);
  const sinF = Math.sin(facing);
  const barrelX = cosF * (r + 36);
  const barrelY = sinF * (r + 36);

  // Muzzle flash radial burst
  const flashG = ctx.createRadialGradient(barrelX, barrelY, 0, barrelX, barrelY, 14);
  flashG.addColorStop(0, `rgba(255,255,210,${flashFrac * 0.95})`);
  flashG.addColorStop(0.35, `rgba(255,170,50,${flashFrac * 0.7})`);
  flashG.addColorStop(1, `rgba(255,80,0,0)`);
  ctx.fillStyle = flashG;
  ctx.beginPath(); ctx.arc(barrelX, barrelY, 14, 0, Math.PI * 2); ctx.fill();

  // Small burst rays
  for (let i = 0; i < 5; i++) {
    const ra = facing + (i / 5 - 0.5) * 0.7;
    const rd = 6 + flashFrac * 10;
    ctx.strokeStyle = `rgba(255,200,80,${flashFrac * 0.8})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(barrelX + cosF * 4, barrelY + sinF * 4);
    ctx.lineTo(barrelX + Math.cos(ra) * rd, barrelY + Math.sin(ra) * rd);
    ctx.stroke();
  }

  ctx.restore();
}

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

import type { MalakarVisualSnapshot } from './visualModes';

const TAU = Math.PI * 2;
const GOLD = '#c9a959';
const GOLD_BRIGHT = '#f0d78c';
const AMBER = '#d1873f';
const PARCHMENT = '#ece0c4';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;

function drawCape(
  ctx: CanvasRenderingContext2D,
  snapshot: MalakarVisualSnapshot,
  side: -1 | 1,
) {
  const phaseSpread = snapshot.phase >= 3 ? 0.22 : snapshot.phase >= 2 ? 0.1 : 0;
  const windupSpread = snapshot.state === 'windup' ? snapshot.windupProgress * 0.16 : 0;
  const staggerFold = snapshot.state === 'staggered' ? -0.24 : 0;
  const flap = Math.sin(snapshot.time * (snapshot.phase >= 3 ? 3.1 : 2.15) + side) * 0.06;
  const spread = 0.46 + phaseSpread + windupSpread + staggerFold + flap;
  const length = snapshot.r * (snapshot.phase >= 3 ? 2.55 : snapshot.phase >= 2 ? 2.18 : 1.92);

  ctx.save();
  ctx.rotate(Math.PI + side * spread);
  ctx.fillStyle = snapshot.phase >= 3 ? 'rgba(42,30,45,0.96)' : 'rgba(31,28,35,0.94)';
  ctx.strokeStyle = snapshot.phase >= 2 ? 'rgba(196,126,61,0.55)' : 'rgba(123,113,105,0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(snapshot.r * 0.12, side * snapshot.r * 0.15);
  ctx.bezierCurveTo(
    length * 0.28,
    side * snapshot.r * 0.72,
    length * 0.66,
    side * snapshot.r * 0.8,
    length,
    side * snapshot.r * 0.28,
  );
  ctx.lineTo(length * 0.83, side * snapshot.r * 0.05);
  ctx.lineTo(length * 0.7, side * snapshot.r * 0.2);
  ctx.lineTo(length * 0.53, -side * snapshot.r * 0.03);
  ctx.lineTo(length * 0.34, side * snapshot.r * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 0.38;
  ctx.strokeStyle = snapshot.phase >= 3 ? GOLD : '#746957';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(snapshot.r * 0.3, side * snapshot.r * 0.14);
  ctx.quadraticCurveTo(length * 0.5, side * snapshot.r * 0.4, length * 0.8, side * snapshot.r * 0.22);
  ctx.stroke();
  ctx.restore();
}

function drawSword(
  ctx: CanvasRenderingContext2D,
  snapshot: MalakarVisualSnapshot,
  angle: number,
  length: number,
  reveal = 1,
  glow = 0,
) {
  if (reveal <= 0) return;
  const start = snapshot.r * 0.42;
  const shown = length * reveal;
  ctx.save();
  ctx.rotate(angle);

  ctx.fillStyle = '#161419';
  ctx.beginPath();
  ctx.moveTo(start - 7, -11);
  ctx.lineTo(start + 3, -5);
  ctx.lineTo(start + 3, 5);
  ctx.lineTo(start - 7, 11);
  ctx.lineTo(start - 12, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const blade = ctx.createLinearGradient(start, 0, start + shown, 0);
  blade.addColorStop(0, snapshot.phase >= 3 ? '#4f403d' : '#39383c');
  blade.addColorStop(0.65, snapshot.phase >= 2 ? '#746052' : '#6b6866');
  blade.addColorStop(1, snapshot.phase >= 3 ? '#c38b4a' : '#938474');
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(start + 1, -5.2);
  ctx.lineTo(start + shown - 12, -3.2);
  ctx.lineTo(start + shown, 0);
  ctx.lineTo(start + shown - 12, 3.2);
  ctx.lineTo(start + 1, 5.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = snapshot.phase >= 3 ? GOLD_BRIGHT : 'rgba(180,165,144,0.72)';
  ctx.lineWidth = 1.15;
  ctx.stroke();

  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(start - 8, 0, 3.4, 0, TAU);
  ctx.fill();

  if (glow > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glow;
    ctx.strokeStyle = snapshot.phase >= 2 ? AMBER : GOLD;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(start + 5, 0);
    ctx.lineTo(start + shown - 2, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHalo(ctx: CanvasRenderingContext2D, snapshot: MalakarVisualSnapshot) {
  const count = Math.max(0, 9 - Math.round(snapshot.haloSpent));
  const baseSpeed = snapshot.phase >= 3 ? 2.6 : snapshot.phase === 2 ? 1.6 : 0.8;
  const speed = snapshot.state === 'staggered' ? 0.22 : baseSpeed;
  const volleyGather = snapshot.attack === 'volley' && snapshot.state === 'windup'
    ? snapshot.windupProgress * 8
    : 0;
  const verticalScale = snapshot.state === 'staggered' ? 0.54 : 0.72;

  for (let i = 0; i < count; i++) {
    const angle = snapshot.time * speed + (i / 9) * TAU;
    const staggerWobble = snapshot.state === 'staggered'
      ? Math.sin(snapshot.time * 5 + i * 1.7) * 5.5
      : 0;
    const radius = snapshot.r + 28 - volleyGather + staggerWobble;
    ctx.save();
    ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius * verticalScale);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = snapshot.hurtFlash > 0
      ? '#fff'
      : snapshot.phase >= 3 ? '#56301e' : '#252127';
    ctx.strokeStyle = snapshot.phase >= 3
      || (snapshot.attack === 'volley' && snapshot.state === 'windup')
      ? GOLD_BRIGHT
      : 'rgba(201,169,89,0.72)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(4.2, 2);
    ctx.lineTo(0, 10);
    ctx.lineTo(-4.2, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (snapshot.phase >= 2) {
      ctx.fillStyle = snapshot.phase >= 3 ? GOLD_BRIGHT : AMBER;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(2, -4);
      ctx.lineTo(-2, -4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawMalakarCanvasProof(
  ctx: CanvasRenderingContext2D,
  snapshot: MalakarVisualSnapshot,
) {
  const flash = snapshot.hurtFlash > 0;
  const windup = clamp01(snapshot.windupProgress);
  const staggerLean = snapshot.state === 'staggered'
    ? Math.sin(snapshot.time * 3) * 0.05 + 0.15
    : 0;

  ctx.save();
  ctx.translate(
    snapshot.x + Math.cos(snapshot.recoilAng) * snapshot.recoil,
    snapshot.y + Math.sin(snapshot.recoilAng) * snapshot.recoil,
  );
  ctx.rotate(staggerLean);

  if (snapshot.phase >= 2 || snapshot.state === 'windup') {
    const auraRadius = snapshot.r + 25 + Math.sin(snapshot.time * 6) * 3;
    const aura = ctx.createRadialGradient(0, 0, snapshot.r * 0.35, 0, 0, auraRadius + 24);
    aura.addColorStop(0, snapshot.phase >= 3
      ? 'rgba(232,153,72,0.34)'
      : 'rgba(174,104,54,0.26)');
    aura.addColorStop(0.68, 'rgba(81,47,37,0.12)');
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, auraRadius + 24, 0, TAU);
    ctx.fill();
  }

  ctx.rotate(snapshot.facing);
  drawCape(ctx, snapshot, -1);
  drawCape(ctx, snapshot, 1);

  // Wide asymmetric shoulders and a long facing-led breastplate make the
  // Canvas proof read as a fallen knight instead of a radial particle boss.
  ctx.fillStyle = flash ? PARCHMENT : '#201d23';
  ctx.strokeStyle = flash ? '#fff' : '#756961';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(snapshot.r * 0.18, side * snapshot.r * 0.34);
    ctx.lineTo(-snapshot.r * 0.18, side * snapshot.r * 0.86);
    ctx.lineTo(-snapshot.r * 0.7, side * snapshot.r * 0.65);
    ctx.lineTo(-snapshot.r * 0.46, side * snapshot.r * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  const armor = ctx.createLinearGradient(-snapshot.r, -snapshot.r, snapshot.r, snapshot.r);
  if (flash) {
    armor.addColorStop(0, '#fff');
    armor.addColorStop(1, '#cdbeba');
  } else {
    armor.addColorStop(0, snapshot.phase >= 2 ? '#65534f' : '#595358');
    armor.addColorStop(0.42, '#312b30');
    armor.addColorStop(1, '#111015');
  }
  ctx.fillStyle = armor;
  ctx.beginPath();
  ctx.ellipse(0, 0, snapshot.r * 1.05, snapshot.r * 0.64, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = flash ? '#fff' : '#71665f';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Plate ridges share the body's light direction and cost no extra gradients.
  ctx.strokeStyle = flash ? '#fff' : 'rgba(180,157,132,0.48)';
  ctx.lineWidth = 1.7;
  for (let i = 0; i < 3; i++) {
    const px = 12 - i * 13;
    ctx.beginPath();
    ctx.moveTo(px, -snapshot.r * 0.58);
    ctx.lineTo(px + 7, 0);
    ctx.lineTo(px, snapshot.r * 0.58);
    ctx.stroke();
  }

  // Forward helm and narrow grace slit preserve the authored facing direction.
  ctx.fillStyle = flash ? '#fff' : '#2e2930';
  ctx.beginPath();
  ctx.moveTo(snapshot.r * 1.13, 0);
  ctx.lineTo(snapshot.r * 0.65, -snapshot.r * 0.42);
  ctx.lineTo(snapshot.r * 0.35, -snapshot.r * 0.28);
  ctx.lineTo(snapshot.r * 0.35, snapshot.r * 0.28);
  ctx.lineTo(snapshot.r * 0.65, snapshot.r * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = snapshot.phase >= 3 ? GOLD_BRIGHT : GOLD;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = snapshot.phase >= 3 ? GOLD_BRIGHT : 'rgba(201,169,89,0.72)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(snapshot.r * 0.57, 0);
  ctx.lineTo(snapshot.r * 0.97, 0);
  ctx.stroke();

  // The core is small, steady and always visible; it must not resemble a
  // damaging projectile or borrow the reserved danger red.
  const coreRadius = snapshot.phase >= 3
    ? 8.5 + Math.sin(snapshot.time * 11) * 1.3
    : snapshot.phase === 2
      ? 6.8 + Math.sin(snapshot.time * 8) * 1
      : 5 + Math.sin(snapshot.time * 4) * 0.6;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = snapshot.phase >= 3 ? '#fff0c5' : '#e8b76f';
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  drawHalo(ctx, snapshot);

  const swordAngle = snapshot.state === 'windup'
    ? mix(-2.2, -1.3, windup)
    : snapshot.state === 'strike' && snapshot.attack === 'swipe'
      ? 0.8
      : snapshot.state === 'recover'
        ? 1.55
        : 0.55;
  const swordGlow = snapshot.state === 'windup' ? 0.14 + windup * 0.34 : 0;
  drawSword(ctx, snapshot, swordAngle, 92, 1, swordGlow);
  if (snapshot.phase >= 3) {
    const reveal = 1 - Math.pow(1 - clamp01(snapshot.secondSwordDraw), 3);
    drawSword(ctx, snapshot, -swordAngle, 86, reveal, swordGlow * 0.8);
  }

  if (snapshot.attack === 'ring' && snapshot.state === 'windup') {
    ctx.globalAlpha = 0.16 + windup * 0.22;
    ctx.strokeStyle = GOLD_BRIGHT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, snapshot.r + 10 + windup * 12, 0, TAU);
    ctx.stroke();
  }

  if (snapshot.state === 'staggered') {
    ctx.globalAlpha = 0.22 + Math.sin(snapshot.time * 10) * 0.06;
    ctx.strokeStyle = GOLD_BRIGHT;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 9]);
    ctx.beginPath();
    ctx.ellipse(0, 0, snapshot.r + 13, snapshot.r * 0.62, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

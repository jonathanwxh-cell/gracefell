// GRACEFELL — boss-arena ARPG engine (canvas 2D, procedural, no assets)
import { GameAudio } from './audio';

// ------------------------------------------------------------------ utils
export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const dist = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1);
export const angTo = (x1: number, y1: number, x2: number, y2: number) => Math.atan2(y2 - y1, x2 - x1);
export function angDiff(a: number, b: number) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// palette — parchment & grace-gold on ash-black
export const PAL = {
  bg: '#0b0907',
  floor: '#14110c',
  floorRing: '#241d13',
  rune: '#3d3320',
  parchment: '#ece0c4',
  parchmentDim: '#9a8f74',
  gold: '#c9a959',
  goldBright: '#f0d78c',
  ember: '#ff7a29',
  emberDeep: '#c33d1e',
  // --- RESERVED HAZARD HUE ---------------------------------------------
  // PAL.danger (and dangerEdge) mean exactly one thing: THIS WILL HURT YOU.
  // Hostile projectiles, hostile rings, and attack telegraphs only. Never use
  // it for ambience, embers, the boss body, or UI chrome — the moment decor
  // borrows this hue the player stops being able to read the screen at a
  // glance. Warm decorative fire lives on `ember`/`amber` instead.
  danger: '#ff2d17',
  dangerEdge: '#ffd9c9',
  amber: '#e8a13c',
  blood: '#a42727',
  hpBack: '#2a1210',
  stamina: '#7d9c5a',
  bossBar: '#8f1f1f',
  spirit: '#bcd7ff',
};

// ------------------------------------------------------------------ types
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; sizeEnd: number;
  color: string; colorEnd?: string; glow: boolean; drag: number; grav: number;
  shape: 'circle' | 'spark' | 'wisp';
}
interface DamageNum { x: number; y: number; vy: number; life: number; maxLife: number; text: string; color: string; size: number; }
interface Projectile { x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number; hostile: boolean; hue: string; }
interface RingWave { x: number; y: number; r: number; speed: number; thickness: number; dmg: number; maxR: number; hostile: boolean; hitDone: boolean; }
interface Meteor { x: number; y: number; fuse: number; maxFuse: number; r: number; dmg: number; }

// ------------------------------------------------------------------ input
const KEYMAP: Record<string, string> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'roll', ShiftLeft: 'roll', ShiftRight: 'roll',
  KeyJ: 'light', KeyK: 'heavy', KeyF: 'flask', KeyL: 'flask',
  Enter: 'confirm', KeyM: 'mute',
};

export class Input {
  private canvas: HTMLCanvasElement;
  private onFirstGesture: () => void;
  held: Record<string, boolean> = {};
  pressed: Record<string, number> = {}; // press timestamps — souls-style input buffering
  private static BUFFER_MS = 190;
  // touch
  joyActive = false; joyId = -1; joyOx = 0; joyOy = 0; joyX = 0; joyY = 0;
  btnPressed: Record<string, boolean> = {};
  isTouch = false;
  taps: { x: number; y: number }[] = []; // consumed by menu hit-tests each frame

  constructor(canvas: HTMLCanvasElement, onFirstGesture: () => void) {
    this.canvas = canvas;
    this.onFirstGesture = onFirstGesture;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
  }
  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
  private gestureFired = false;
  private fireGesture() { if (!this.gestureFired) { this.gestureFired = true; this.onFirstGesture(); } }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = KEYMAP[e.code];
    if (k) {
      e.preventDefault();
      if (!this.held[k]) this.pressed[k] = performance.now();
      this.held[k] = true;
    }
    this.fireGesture();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    const k = KEYMAP[e.code];
    if (k) this.held[k] = false;
  };
  private onMouseDown = (e: MouseEvent) => {
    this.fireGesture();
    const r = this.canvas.getBoundingClientRect();
    this.taps.push({ x: e.clientX - r.left, y: e.clientY - r.top });
    const now = performance.now();
    if (e.button === 0) this.pressed['light'] = now;
    if (e.button === 2) this.pressed['heavy'] = now;
    this.pressed['confirm'] = now;
  };
  private onMouseUp = () => {};

  // touch → joystick on left 45% of screen, buttons handled by game hit test
  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    this.isTouch = true;
    this.fireGesture();
    const r = this.canvas.getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX - r.left, y = t.clientY - r.top;
      this.taps.push({ x, y });
      if (x < r.width * 0.45 && !this.joyActive) {
        this.joyActive = true; this.joyId = t.identifier;
        this.joyOx = x; this.joyOy = y; this.joyX = 0; this.joyY = 0;
      }
    }
    this.pressed['confirm'] = performance.now();
    (window as any).__graceTouch?.(e, 'start');
  };
  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (this.joyActive && t.identifier === this.joyId) {
        const x = t.clientX - r.left, y = t.clientY - r.top;
        const dx = x - this.joyOx, dy = y - this.joyOy;
        const m = Math.hypot(dx, dy), max = 52;
        const s = m > max ? max / m : 1;
        this.joyX = (dx * s) / max; this.joyY = (dy * s) / max;
      }
    }
  };
  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (this.joyActive && t.identifier === this.joyId) {
        this.joyActive = false; this.joyX = 0; this.joyY = 0;
      }
    }
    (window as any).__graceTouch?.(e, 'end');
  };

  axis(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.held['left']) x -= 1;
    if (this.held['right']) x += 1;
    if (this.held['up']) y -= 1;
    if (this.held['down']) y += 1;
    if (this.joyActive) { x = this.joyX; y = this.joyY; }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }
  consume(k: string): boolean {
    const t = this.pressed[k];
    if (this.btnPressed[k]) { this.btnPressed[k] = false; delete this.pressed[k]; return true; }
    if (t !== undefined && performance.now() - t < Input.BUFFER_MS) { delete this.pressed[k]; return true; }
    if (t !== undefined) delete this.pressed[k]; // expired
    return false;
  }
  endFrame() { this.btnPressed = {}; this.taps = []; }
}

// ------------------------------------------------------------------ player
export class Player {
  x = 0; y = 240; vx = 0; vy = 0; r = 15;
  facing = -Math.PI / 2;
  hp = 110; maxHp = 110;
  stam = 100; maxStam = 100; stamDelay = 0;
  flasks = 3; maxFlasks = 3;
  state: 'move' | 'roll' | 'light' | 'heavy' | 'flask' | 'stagger' | 'dead' = 'move';
  t = 0; // state timer
  iframes = 0; hurtFlash = 0;
  rollDir = 0; attackHit = false; lungeVx = 0; lungeVy = 0;
  comboStep = 0; comboWindow = 0; perfectCd = 0;
  trail: { x: number; y: number; a: number; life: number }[] = [];
  swordTip: { x: number; y: number }[] = [];
  capePhase = 0;
  healPulse = 0;

  get busy() { return this.state !== 'move'; }

  update(dt: number, input: Input, game: Game) {
    this.capePhase += dt * 6;
    this.iframes = Math.max(0, this.iframes - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.healPulse = Math.max(0, this.healPulse - dt);
    this.stamDelay = Math.max(0, this.stamDelay - dt);
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    if (this.comboWindow <= 0 && this.state === 'move') this.comboStep = 0;
    this.perfectCd = Math.max(0, this.perfectCd - dt);
    if (this.stamDelay <= 0 && this.state !== 'heavy') this.stam = clamp(this.stam + 36 * dt, 0, this.maxStam);
    this.t -= dt;

    const ax = input.axis();
    const spd = 232;

    if (this.state === 'dead') { this.updateTrail(dt); return; }

    // state transitions
    if (this.state === 'move' || this.state === 'flask') {
      if (this.stam >= 20 && this.state !== 'flask' && input.consume('roll')) {
        this.state = 'roll'; this.t = 0.42;
        this.comboStep = 0; this.comboWindow = 0;
        const m = Math.hypot(ax.x, ax.y);
        this.rollDir = m > 0.1 ? Math.atan2(ax.y, ax.x) : this.facing;
        this.stam -= 20; this.stamDelay = 0.55;
        this.iframes = Math.max(this.iframes, 0.34 * game.mods.iframe);
        game.audio.dodge();
        game.burst(this.x, this.y, 8, '#8f8776', 120, 0.35, 3);
      } else if (this.stam >= 12 && this.state !== 'flask' && input.consume('light')) {
        const step = this.comboWindow > 0 ? this.comboStep : 0;
        this.comboStep = step;
        this.state = 'light'; this.t = step === 2 ? 0.44 : 0.32; this.attackHit = false;
        this.stam -= 12; this.stamDelay = 0.55;
        // soft lock: aim at boss
        const b = game.boss;
        if (b && b.hp > 0) this.facing = angTo(this.x, this.y, b.x, b.y);
        const lunge = 340 + step * 55;
        this.lungeVx = Math.cos(this.facing) * lunge; this.lungeVy = Math.sin(this.facing) * lunge;
        if (step === 2) game.audio.swingHeavy(); else game.audio.swing();
      } else if (this.stam >= 26 && this.state !== 'flask' && input.consume('heavy')) {
        this.state = 'heavy'; this.t = 0.62; this.attackHit = false;
        this.stam -= 26; this.stamDelay = 0.7;
        const b = game.boss;
        if (b && b.hp > 0) this.facing = angTo(this.x, this.y, b.x, b.y);
        this.lungeVx = Math.cos(this.facing) * 300; this.lungeVy = Math.sin(this.facing) * 300;
        game.audio.swingHeavy();
      } else if (this.flasks > 0 && this.hp < this.maxHp && this.state === 'move' && input.consume('flask')) {
        this.state = 'flask'; this.t = 1.0;
        this.flasks--;
        game.audio.flask();
      }
    }

    // state behavior
    if (this.state === 'move') {
      this.vx = lerp(this.vx, ax.x * spd, 1 - Math.exp(-12 * dt));
      this.vy = lerp(this.vy, ax.y * spd, 1 - Math.exp(-12 * dt));
      if (Math.hypot(ax.x, ax.y) > 0.1) this.facing = Math.atan2(ax.y, ax.x);
    } else if (this.state === 'roll') {
      const rollSpd = 370;
      this.vx = Math.cos(this.rollDir) * rollSpd;
      this.vy = Math.sin(this.rollDir) * rollSpd;
      this.trail.push({ x: this.x, y: this.y, a: this.facing, life: 0.3 });
      if (this.t <= 0) { this.state = 'move'; this.vx *= 0.3; this.vy *= 0.3; }
    } else if (this.state === 'light' || this.state === 'heavy') {
      const heavy = this.state === 'heavy';
      const total = heavy ? 0.62 : this.comboStep === 2 ? 0.44 : 0.32;
      const activeStart = heavy ? 0.62 - 0.20 : total - 0.16;
      const elapsed = total - this.t;
      // lunge early
      const lungeDecay = Math.exp(-9 * dt);
      this.vx = this.lungeVx * lungeDecay; this.vy = this.lungeVy * lungeDecay;
      if (elapsed > activeStart - 0.06) { this.lungeVx *= 0.6; this.lungeVy *= 0.6; }
      // sword tip trail during active window
      const sw = this.swordAngle();
      const tipX = this.x + Math.cos(sw) * (heavy ? 88 : 74);
      const tipY = this.y + Math.sin(sw) * (heavy ? 88 : 74);
      this.swordTip.push({ x: tipX, y: tipY });
      if (this.swordTip.length > 10) this.swordTip.shift();
      // hit check
      if (!this.attackHit && elapsed >= activeStart) {
        this.attackHit = true;
        game.playerStrike(heavy);
      }
      if (this.t <= 0) {
        this.state = 'move'; this.swordTip = [];
        if (!heavy) { this.comboWindow = 0.6; this.comboStep = (this.comboStep + 1) % 3; }
        else { this.comboStep = 0; this.comboWindow = 0; }
      }
    } else if (this.state === 'flask') {
      this.vx = lerp(this.vx, ax.x * spd * 0.35, 1 - Math.exp(-10 * dt));
      this.vy = lerp(this.vy, ax.y * spd * 0.35, 1 - Math.exp(-10 * dt));
      if (Math.hypot(ax.x, ax.y) > 0.1) this.facing = Math.atan2(ax.y, ax.x);
      if (this.t <= 0) {
        this.state = 'move';
        this.hp = clamp(this.hp + 62, 0, this.maxHp);
        this.healPulse = 0.7;
        game.burst(this.x, this.y, 22, PAL.goldBright, 90, 0.8, 3);
      }
    } else if (this.state === 'stagger') {
      this.vx = lerp(this.vx, 0, 1 - Math.exp(-6 * dt));
      this.vy = lerp(this.vy, 0, 1 - Math.exp(-6 * dt));
      if (this.t <= 0) this.state = 'move';
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    game.clampArena(this);
    this.updateTrail(dt);
  }

  private updateTrail(dt: number) {
    for (const tr of this.trail) tr.life -= dt;
    this.trail = this.trail.filter((t) => t.life > 0);
  }

  swordAngle(): number {
    // sweep across arc based on attack progress
    if (this.state === 'light') {
      const dur = this.comboStep === 2 ? 0.44 : 0.32;
      const p = 1 - this.t / dur;
      const arc = this.comboStep === 2 ? 2.7 : 2.1;
      const dir = this.comboStep === 1 ? -1 : 1; // alternate sweep direction
      return this.facing - dir * (arc / 2) + dir * p * arc;
    }
    if (this.state === 'heavy') {
      const p = 1 - this.t / 0.62;
      if (p < 0.55) return this.facing - 1.25 * clamp(p / 0.28, 0, 1);
      const s = (p - 0.55) / 0.45;
      return this.facing - 1.25 + s * 2.5;
    }
    return this.facing;
  }

  takeDamage(dmg: number, sx: number, sy: number, game: Game): boolean {
    if (this.iframes > 0 || this.state === 'dead') {
      // perfect dodge: hit lands inside the early roll window
      if (this.state === 'roll' && this.iframes > 0 && this.t > 0.42 - 0.24 * game.mods.perfectWindow && this.perfectCd <= 0) {
        game.onPerfectDodge();
      }
      return false;
    }
    this.comboStep = 0; this.comboWindow = 0;
    dmg = Math.max(1, Math.round(dmg * game.mods.dmgTaken));
    this.hp -= dmg;
    this.iframes = 0.9;
    this.hurtFlash = 0.35;
    const a = angTo(sx, sy, this.x, this.y);
    this.vx = Math.cos(a) * 330; this.vy = Math.sin(a) * 330;
    game.audio.playerHurt();
    game.shake(10, 0.3);
    game.redFlash = 0.5;
    game.burst(this.x, this.y, 14, PAL.blood, 200, 0.5, 3.5);
    game.addScorch(this.x + rand(-8, 8), this.y + rand(-8, 8), rand(14, 26), 'rgba(90,16,12,0.8)', 0.4);
    game.hitsTaken++;
    if (this.hp <= 0) {
      this.hp = 0; this.state = 'dead'; this.t = 0;
      game.onPlayerDeath();
    } else {
      this.state = 'stagger'; this.t = 0.32;
      this.swordTip = [];
    }
    return true;
  }

  draw(ctx: CanvasRenderingContext2D, game: Game) {
    const { x, y } = this;
    // roll afterimages
    for (const tr of this.trail) {
      ctx.save();
      ctx.globalAlpha = tr.life * 1.4;
      ctx.fillStyle = PAL.spirit;
      ctx.beginPath(); ctx.arc(tr.x, tr.y, this.r * 0.9, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(x, y + this.r * 0.85, this.r * 1.05, this.r * 0.42, 0, 0, TAU); ctx.fill();

    const rolling = this.state === 'roll';
    const rollSpin = rolling ? (1 - this.t / 0.42) * TAU : 0;
    const blink = this.iframes > 0 && !rolling && this.state !== 'dead' && Math.floor(this.iframes * 18) % 2 === 0;

    ctx.save();
    ctx.translate(x, y);
    if (rolling) ctx.rotate(rollSpin * 0.9);

    if (!blink) {
      // cape
      const flutter = Math.sin(this.capePhase) * 2.2;
      ctx.fillStyle = '#2c2531';
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.quadraticCurveTo(-this.r - 6 + flutter, 6, -this.r * 0.4 + flutter, this.r + 8);
      ctx.quadraticCurveTo(0, this.r + 4, this.r * 0.4 + flutter, this.r + 7);
      ctx.quadraticCurveTo(this.r + 5 + flutter, 4, 0, -4);
      ctx.fill();
      // body — ashen steel with gold trim
      const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, this.r + 2);
      g.addColorStop(0, '#cfd3da');
      g.addColorStop(0.55, '#7e8592');
      g.addColorStop(1, '#3a3f4a');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, this.r - 1, 0, TAU); ctx.stroke();
      // helm plume
      ctx.fillStyle = PAL.emberDeep;
      ctx.beginPath(); ctx.arc(-3, -this.r + 2, 4, 0, TAU); ctx.fill();
      // glow when healing
      if (this.healPulse > 0) {
        ctx.globalAlpha = this.healPulse;
        ctx.strokeStyle = PAL.goldBright;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, this.r + 8 * (1 - this.healPulse) + 4, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();

    // sword
    if (!blink && this.state !== 'dead') {
      const sw = this.swordAngle();
      const inAtk = this.state === 'light' || this.state === 'heavy';
      const len = inAtk ? (this.state === 'heavy' ? 88 : 74) : 34;
      const a = inAtk ? sw : this.facing + 0.9;
      // trail ribbon
      if (inAtk && this.swordTip.length > 1) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = this.state === 'heavy' ? PAL.goldBright : '#dfe6ee';
        ctx.lineCap = 'round';
        for (let i = 1; i < this.swordTip.length; i++) {
          ctx.lineWidth = (i / this.swordTip.length) * 7;
          ctx.globalAlpha = (i / this.swordTip.length) * 0.5;
          ctx.beginPath();
          ctx.moveTo(this.swordTip[i - 1].x, this.swordTip[i - 1].y);
          ctx.lineTo(this.swordTip[i].x, this.swordTip[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      const grad = ctx.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, '#8d949e');
      grad.addColorStop(1, '#e8edf4');
      ctx.fillStyle = grad;
      ctx.fillRect(6, -2, len, 4);
      ctx.fillStyle = PAL.gold;
      ctx.fillRect(2, -4.5, 6, 9);
      ctx.restore();
      // heavy charge glow
      if (this.state === 'heavy' && this.t > 0.28) {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(game.time * 30) * 0.2;
        ctx.strokeStyle = PAL.goldBright;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, this.r + 7, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
  }
}

// ------------------------------------------------------------------ boss
type BossAttack = 'swipe' | 'slam' | 'charge' | 'volley' | 'meteor' | 'ring' | 'spiral';

export class Boss {
  x = 0; y = -220; vx = 0; vy = 0; r = 34;
  hp = 1350; maxHp = 1350;
  phase = 1;
  facing = Math.PI / 2;
  state: 'spawn' | 'stalk' | 'windup' | 'strike' | 'recover' | 'staggered' | 'dying' = 'spawn';
  t = 1.6;
  attack: BossAttack = 'swipe';
  comboLeft = 0;
  chargeDir = 0; chargeTime = 0;
  poise = 120; maxPoise = 120;
  cooldowns: Record<BossAttack, number> = { swipe: 0, slam: 0, charge: 0, volley: 0, meteor: 0, ring: 0, spiral: 0 };
  aura = 0; hurtFlash = 0;
  meteorQueue: Meteor[] = [];
  swordAng = 0;
  embers = 0;
  phaseRoarDone = false;
  phase3Done = false;
  spiralLeft = 0; spiralAng = 0; spiralTick = 0;

  extraSpeed = 1; // set from Game.mods — the grace dial
  get speedMul() { return (this.phase >= 3 ? 1.42 : this.phase === 2 ? 1.28 : 1) * this.extraSpeed; }

  update(dt: number, game: Game) {
    const p = game.player;
    this.t -= dt;
    this.aura = Math.max(0, this.aura - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.embers += dt;
    for (const k of Object.keys(this.cooldowns) as BossAttack[]) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    const dToP = dist(this.x, this.y, p.x, p.y);
    const aToP = angTo(this.x, this.y, p.x, p.y);

    // ambient embers in phase 2
    if (this.phase >= 2 && Math.random() < dt * (this.phase >= 3 ? 28 : 14)) {
      game.addParticle({
        x: this.x + rand(-this.r, this.r), y: this.y + rand(-this.r, this.r),
        vx: rand(-20, 20), vy: rand(-90, -40), life: rand(0.4, 0.9), maxLife: 0.9,
        size: rand(1.5, 3.5), sizeEnd: 0, color: this.phase >= 3 && Math.random() < 0.4 ? PAL.goldBright : PAL.amber, glow: true, drag: 1, grav: -40, shape: 'circle',
      });
    }

    switch (this.state) {
      case 'spawn': {
        if (this.t <= 0) this.state = 'stalk';
        break;
      }
      case 'stalk': {
        // face player, approach with strafe wobble
        this.facing += angDiff(this.facing, aToP) * Math.min(1, 6 * dt);
        const want = dToP > 120 ? 1 : 0.25;
        const wob = Math.sin(game.time * 1.7) * 0.5;
        const spd = 148 * this.speedMul * want;
        this.vx = Math.cos(this.facing + wob * 0.35) * spd;
        this.vy = Math.sin(this.facing + wob * 0.35) * spd;
        if (this.t <= 0) this.chooseAttack(game, dToP);
        break;
      }
      case 'windup': {
        this.facing += angDiff(this.facing, this.attack === 'charge' ? this.chargeDir : aToP) * Math.min(1, (this.attack === 'charge' ? 1.2 : 4) * dt);
        this.vx *= 0.86; this.vy *= 0.86;
        if (this.attack === 'charge') this.chargeDir = this.facing;
        if (this.t <= 0) this.beginStrike(game);
        break;
      }
      case 'strike': {
        if (this.attack === 'charge') {
          this.chargeTime -= dt;
          this.vx = Math.cos(this.chargeDir) * 880;
          this.vy = Math.sin(this.chargeDir) * 880;
          game.addParticle({
            x: this.x - Math.cos(this.chargeDir) * this.r, y: this.y - Math.sin(this.chargeDir) * this.r,
            vx: rand(-40, 40), vy: rand(-40, 40), life: 0.4, maxLife: 0.4, size: rand(4, 8), sizeEnd: 0,
            color: '#6b5a41', glow: false, drag: 2, grav: 0, shape: 'circle',
          });
          // hit check (body)
          if (dist(this.x, this.y, p.x, p.y) < this.r + p.r + 6) {
            if (p.takeDamage(22, this.x, this.y, game)) { this.endStrike(0.75); break; }
          }
          const dc = Math.hypot(this.x, this.y);
          if (this.chargeTime <= 0 || dc > game.arenaR - this.r - 8) {
            game.shake(14, 0.4);
            game.audio.slam();
            game.burst(this.x, this.y, 26, '#8a7a5c', 260, 0.6, 5);
            this.endStrike(0.8);
          }
        } else if (this.attack === 'swipe') {
          if (this.t <= 0) {
            // active frame
            game.bossArcStrike(this.x, this.y, this.facing, 1.45, 108, 16);
            this.swordAng = this.facing;
            this.comboLeft--;
            if (this.comboLeft > 0 && dToP < 190) {
              this.state = 'windup'; this.t = 0.34 / this.speedMul;
              game.audio.telegraph();
            } else this.endStrike(0.55 / this.speedMul);
          }
        } else if (this.attack === 'slam') {
          if (this.t <= 0) {
            game.bossSlam(this.x, this.y, 188, 26);
            this.endStrike(0.9 / this.speedMul);
          }
        } else if (this.attack === 'ring') {
          if (this.t <= 0) {
            game.bossSlam(this.x, this.y, 150, 16);
            game.rings.push({ x: this.x, y: this.y, r: 60, speed: 265, thickness: 26, dmg: 18, maxR: game.arenaR + 60, hostile: true, hitDone: false });
            if (this.phase >= 3) game.rings.push({ x: this.x, y: this.y, r: 10, speed: 205, thickness: 22, dmg: 14, maxR: game.arenaR + 60, hostile: true, hitDone: false });
            this.endStrike(0.8);
          }
        } else if (this.attack === 'volley') {
          if (this.t <= 0) {
            const n = this.phase >= 3 ? 9 : this.phase === 2 ? 7 : 5;
            for (let i = 0; i < n; i++) {
              const spread = (i / (n - 1) - 0.5) * 0.85;
              const a = aToP + spread;
              game.projectiles.push({
                x: this.x + Math.cos(a) * (this.r + 8), y: this.y + Math.sin(a) * (this.r + 8),
                vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, r: 7, dmg: 11, life: 3, hostile: true,
                hue: PAL.danger,
              });
            }
            game.audio.projectile();
            this.endStrike(0.6 / this.speedMul);
          }
        } else if (this.attack === 'spiral') {
          this.spiralTick -= dt;
          if (this.spiralTick <= 0 && this.spiralLeft > 0) {
            this.spiralTick = 0.075;
            this.spiralLeft--;
            for (const off of [0, Math.PI]) {
              const a = this.spiralAng + off;
              game.projectiles.push({
                x: this.x + Math.cos(a) * (this.r + 10), y: this.y + Math.sin(a) * (this.r + 10),
                vx: Math.cos(a) * 335, vy: Math.sin(a) * 335, r: 7, dmg: 10, life: 3.2, hostile: true,
                hue: PAL.danger,
              });
            }
            this.spiralAng += 0.44;
            if (this.spiralLeft % 3 === 0) game.audio.projectile();
          }
          if (this.spiralLeft <= 0) this.endStrike(0.85);
        } else if (this.attack === 'meteor') {
          if (this.meteorQueue.length === 0) { this.endStrike(0.7); }
        }
        break;
      }
      case 'recover': {
        this.vx *= 0.9; this.vy *= 0.9;
        if (this.t <= 0) { this.state = 'stalk'; this.t = rand(0.5, 1.1) / this.speedMul; }
        break;
      }
      case 'staggered': {
        this.vx = 0; this.vy = 0;
        if (this.t <= 0) { this.state = 'stalk'; this.t = 0.3; this.poise = this.maxPoise; }
        break;
      }
      case 'dying': break;
    }

    // phase transitions
    if (this.phase === 1 && this.hp <= this.maxHp * 0.55 && !this.phaseRoarDone) {
      this.phaseRoarDone = true;
      this.phase = 2;
      this.state = 'windup'; this.attack = 'ring'; this.t = 1.1;
      game.audio.setPhase(2);
      game.audio.roar(true);
      game.shake(20, 0.9);
      game.goldFlash = 0.4;
      game.banner('THE SOVEREIGN BURNS', 'phase');
      // push player back
      const a = angTo(this.x, this.y, p.x, p.y);
      p.vx = Math.cos(a) * 420; p.vy = Math.sin(a) * 420;
    } else if (this.phase === 2 && this.hp <= this.maxHp * 0.22 && !this.phase3Done) {
      this.phase3Done = true;
      this.phase = 3;
      this.state = 'windup'; this.attack = 'ring'; this.t = 1.2;
      this.poise = this.maxPoise;
      for (const k of Object.keys(this.cooldowns) as BossAttack[]) this.cooldowns[k] = 0;
      game.audio.setPhase(3);
      game.audio.roar(true);
      game.shake(24, 1.1);
      game.redFlash = Math.max(game.redFlash, 0.3);
      game.goldFlash = 0.5;
      game.slowT = 0.6; game.timeScale = 0.35;
      game.banner('GRACE ABANDONS HIM', 'phase');
      game.burst(this.x, this.y, 46, PAL.goldBright, 340, 1.1, 4);
      const a = angTo(this.x, this.y, p.x, p.y);
      p.vx = Math.cos(a) * 460; p.vy = Math.sin(a) * 460;
    }

    // meteor spawning during strike
    if (this.attack === 'meteor' && this.state === 'strike' && this.meteorQueue.length > 0) {
      const next = this.meteorQueue[0];
      next.fuse -= dt;
      if (next.fuse <= 0) {
        game.meteors.push({ ...next, fuse: 0.85, maxFuse: 0.85 });
        this.meteorQueue.shift();
        game.audio.telegraph();
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    game.clampArena(this);
  }

  private chooseAttack(game: Game, dToP: number) {
    const opts: { a: BossAttack; w: number }[] = [];
    if (dToP < 150 && this.cooldowns.swipe <= 0) opts.push({ a: 'swipe', w: 5 });
    if (dToP < 260 && this.cooldowns.slam <= 0) opts.push({ a: 'slam', w: 3 });
    if (dToP > 220 && this.cooldowns.charge <= 0) opts.push({ a: 'charge', w: 4 });
    if (dToP > 170 && this.cooldowns.volley <= 0) opts.push({ a: 'volley', w: 2.5 });
    if (this.phase >= 2) {
      if (this.cooldowns.meteor <= 0) opts.push({ a: 'meteor', w: 3.2 });
      if (dToP < 320 && this.cooldowns.ring <= 0) opts.push({ a: 'ring', w: 2.4 });
    }
    if (this.phase >= 3 && this.cooldowns.spiral <= 0) opts.push({ a: 'spiral', w: 3.6 });
    if (opts.length === 0) { this.t = 0.25; return; }
    let total = 0; for (const o of opts) total += o.w;
    let roll = Math.random() * total;
    let pick = opts[0].a;
    for (const o of opts) { roll -= o.w; if (roll <= 0) { pick = o.a; break; } }
    this.attack = pick;
    this.state = 'windup';
    const mul = this.speedMul;
    switch (pick) {
      case 'swipe':
        this.t = 0.55 / mul; this.comboLeft = this.phase === 2 ? 3 : 2;
        this.cooldowns.swipe = 2.2; game.audio.telegraph(); break;
      case 'slam':
        this.t = 0.95 / mul; this.cooldowns.slam = 5; game.audio.roar(false); break;
      case 'charge':
        this.t = 0.8 / mul; this.chargeDir = angTo(this.x, this.y, game.player.x, game.player.y);
        this.cooldowns.charge = 6; game.audio.roar(false); break;
      case 'volley':
        this.t = 0.6 / mul; this.cooldowns.volley = 4.5; game.audio.telegraph(); break;
      case 'spiral':
        this.t = 0.75 / mul; this.cooldowns.spiral = 8;
        this.spiralLeft = 16; this.spiralTick = 0;
        this.spiralAng = angTo(this.x, this.y, game.player.x, game.player.y) + 0.5;
        game.audio.roar(false);
        break;
      case 'meteor': {
        this.t = 0.7 / mul; this.cooldowns.meteor = this.phase >= 3 ? 7.5 : 9;
        this.meteorQueue = [];
        const p = game.player;
        const mCount = this.phase >= 3 ? 9 : 6;
        for (let i = 0; i < mCount; i++) {
          const px = i === 0 ? p.x : p.x + rand(-160, 160);
          const py = i === 0 ? p.y : p.y + rand(-160, 160);
          this.meteorQueue.push({ x: px, y: py, fuse: 0.25 + i * (this.phase >= 3 ? 0.27 : 0.34), maxFuse: 0.25 + i * 0.34, r: 95, dmg: 20 });
        }
        this.state = 'strike'; this.t = 999; game.audio.roar(false);
        break;
      }
      case 'ring':
        this.t = 0.9 / mul; this.cooldowns.ring = 7; game.audio.roar(false); break;
    }
  }

  private beginStrike(game: Game) {
    this.state = 'strike';
    switch (this.attack) {
      case 'swipe': this.t = 0.1; game.audio.swingHeavy(); break;
      case 'slam': this.t = 0.06; break;
      case 'ring': this.t = 0.06; break;
      case 'charge': this.chargeTime = 0.42; game.audio.swingHeavy(); break;
      case 'volley': this.t = 0.02; break;
      case 'meteor': this.t = 999; break;
      case 'spiral': this.t = 999; game.audio.swingHeavy(); break;
    }
  }

  private endStrike(recover: number) {
    this.state = 'recover'; this.t = recover;
    this.vx *= 0.2; this.vy *= 0.2;
  }

  takeDamage(dmg: number, game: Game, fromX: number, fromY: number) {
    if (this.state === 'dying' || this.state === 'spawn') return;
    const staggered = this.state === 'staggered';
    const final = staggered ? dmg * 1.4 : dmg;
    this.hp -= final;
    this.hurtFlash = 0.12;
    this.poise -= dmg * (staggered ? 0 : 1);
    game.damageDealt += final;
    game.hitstop = Math.max(game.hitstop, dmg > 20 ? 0.09 : 0.05);
    if (dmg > 20) game.zoomPunch = Math.max(game.zoomPunch, 0.045);
    game.shake(dmg > 20 ? 7 : 4, 0.2);
    game.audio.hit(dmg > 20);
    const a = angTo(fromX, fromY, this.x, this.y);
    game.sparks(this.x - Math.cos(a) * this.r * 0.5, this.y - Math.sin(a) * this.r * 0.5, dmg > 20 ? 16 : 9);
    game.addDamageNum(this.x + rand(-16, 16), this.y - this.r - 8, Math.round(final).toString(), dmg > 20 ? PAL.goldBright : PAL.parchment, dmg > 20 ? 26 : 19);
    if (this.hp <= 0) {
      this.hp = 0;
      game.onBossDeath();
      return;
    }
    if (this.poise <= 0 && !staggered) this.triggerStagger(game);
  }

  applyPoise(dmg: number, game: Game) {
    if (this.state === 'dying' || this.state === 'spawn' || this.state === 'staggered') return;
    this.poise -= dmg;
    if (this.poise <= 0) this.triggerStagger(game);
  }

  private triggerStagger(game: Game) {
    if (game.mods.noStagger) { this.poise = this.maxPoise; return; }
    this.state = 'staggered'; this.t = 1.7;
    this.poise = this.maxPoise;
    game.audio.stagger();
    game.goldFlash = 0.35;
    game.banner('STAGGERED', 'stagger');
    game.shake(8, 0.35);
  }

  draw(ctx: CanvasRenderingContext2D, game: Game) {
    const { x, y } = this;
    const windupP = this.state === 'windup' ? 1 - this.t / this.windupTotal() : 0;

    // ---- telegraphs (drawn under everything else, called by game before)
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(x, y + this.r * 0.85, this.r * 1.15, this.r * 0.45, 0, 0, TAU); ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    if (this.state === 'staggered') ctx.rotate(Math.sin(game.time * 3) * 0.05 + 0.12);

    // aura
    if (this.phase >= 2 || this.state === 'windup') {
      const auraR = this.r + 14 + Math.sin(game.time * 6) * 4;
      const ag = ctx.createRadialGradient(0, 0, this.r * 0.5, 0, 0, auraR + 20);
      ag.addColorStop(0, this.phase >= 3 ? 'rgba(255,170,60,0.45)' : this.phase === 2 ? 'rgba(255,110,30,0.35)' : 'rgba(200,60,40,0.25)');
      ag.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(0, 0, auraR + 20, 0, TAU); ctx.fill();
    }

    // tattered wings (phase 2+) — behind the body
    if (this.phase >= 2) {
      const flap = Math.sin(game.time * (this.phase >= 3 ? 3.4 : 2.2)) * 0.16;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.rotate(this.facing + Math.PI + side * (0.75 + flap));
        ctx.fillStyle = this.phase >= 3 ? 'rgba(48,24,14,0.92)' : 'rgba(30,20,16,0.9)';
        ctx.beginPath();
        ctx.moveTo(this.r * 0.4, 0);
        const wl = this.r * (this.phase >= 3 ? 2.6 : 2.1);
        ctx.quadraticCurveTo(wl * 0.5, -this.r * 0.9, wl, -this.r * 0.35);
        // ragged trailing edge
        ctx.lineTo(wl * 0.82, this.r * 0.05);
        ctx.lineTo(wl * 0.66, -this.r * 0.18);
        ctx.lineTo(wl * 0.5, this.r * 0.16);
        ctx.lineTo(wl * 0.32, -this.r * 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = this.phase >= 3 ? 'rgba(255,122,41,0.5)' : 'rgba(195,61,30,0.4)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      }
    }

    // body — ashen armor
    const flash = this.hurtFlash > 0;
    const g = ctx.createRadialGradient(-10, -12, 6, 0, 0, this.r + 4);
    if (flash) { g.addColorStop(0, '#fff'); g.addColorStop(1, '#caa'); }
    else {
      g.addColorStop(0, this.phase === 2 ? '#5a3a2e' : '#4a4442');
      g.addColorStop(0.6, '#241f1e');
      g.addColorStop(1, '#100d0c');
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill();

    // armor plates
    ctx.strokeStyle = flash ? '#fff' : '#574f4a';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(0, 0, this.r - 8 - i * 8, 0.4 + i * 0.8, 2.4 + i * 0.8); ctx.stroke();
    }
    // crown spikes
    ctx.fillStyle = flash ? '#fff' : '#3a332f';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(this.r - 4, -5); ctx.lineTo(this.r + 9, 0); ctx.lineTo(this.r - 4, 5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // burning core
    const coreR = this.phase >= 3 ? 13 + Math.sin(game.time * 12) * 3 : this.phase === 2 ? 10 + Math.sin(game.time * 9) * 2.5 : 7 + Math.sin(game.time * 4) * 1.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2.2);
    cg.addColorStop(0, this.phase >= 3 ? '#fff3d6' : '#ffd9a0');
    cg.addColorStop(0.4, this.phase >= 2 ? PAL.amber : '#b05030');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, 0, coreR * 2.2, 0, TAU); ctx.fill();
    ctx.restore();

    // orbiting crown shards
    {
      const n = 5;
      const orbSpd = this.phase >= 3 ? 2.6 : this.phase === 2 ? 1.6 : 0.8;
      for (let i = 0; i < n; i++) {
        const a = game.time * orbSpd + (i / n) * TAU;
        const orx = Math.cos(a) * (this.r + 17), ory = Math.sin(a) * (this.r + 17) * 0.92;
        ctx.save();
        ctx.translate(orx, ory);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = flash ? '#fff' : this.phase >= 3 ? '#5a3018' : '#2b2622';
        ctx.beginPath();
        ctx.moveTo(0, -7); ctx.lineTo(4.5, 4); ctx.lineTo(-4.5, 4); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = this.phase >= 3 ? PAL.goldBright : 'rgba(201,169,89,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    // greatsword
    const swA = this.state === 'windup'
      ? this.facing + lerp(-2.2, -2.2 + windupP * 0.9, windupP)
      : this.state === 'strike' && this.attack === 'swipe'
        ? this.facing + 0.8
        : this.facing + 0.55;
    ctx.save();
    ctx.rotate(swA);
    const sLen = 86;
    const sGrad = ctx.createLinearGradient(0, 0, sLen, 0);
    sGrad.addColorStop(0, '#2c2828');
    sGrad.addColorStop(0.5, '#4c453f');
    sGrad.addColorStop(1, this.phase >= 2 ? '#7a4526' : '#5c534a');
    ctx.fillStyle = sGrad;
    ctx.fillRect(this.r * 0.5, -5, sLen, 10);
    ctx.fillStyle = '#1a1715';
    ctx.fillRect(this.r * 0.5 - 4, -9, 8, 18);
    if (this.state === 'windup') {
      ctx.globalAlpha = 0.4 + windupP * 0.5;
      ctx.fillStyle = this.phase >= 2 ? PAL.amber : '#c34a2e';
      ctx.fillRect(this.r * 0.5, -7, sLen, 14);
    }
    ctx.restore();

    // staggered kneel indication
    if (this.state === 'staggered') {
      ctx.strokeStyle = PAL.goldBright;
      ctx.globalAlpha = 0.6 + Math.sin(game.time * 10) * 0.3;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(0, 0, this.r + 12, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private windupTotal(): number {
    const mul = this.speedMul;
    switch (this.attack) {
      case 'swipe': return (this.comboLeft > 1 ? 0.55 : 0.34) / mul;
      case 'slam': return 0.95 / mul;
      case 'charge': return 0.8 / mul;
      case 'volley': return 0.6 / mul;
      case 'ring': return 0.9 / mul;
      case 'meteor': return 0.7 / mul;
      case 'spiral': return 0.75 / mul;
    }
  }

  drawTelegraph(ctx: CanvasRenderingContext2D) {
    if (this.state !== 'windup') return;
    const p = clamp(1 - this.t / this.windupTotal(), 0, 1);
    ctx.save();
    if (this.attack === 'swipe') {
      // arc sector
      const range = 108, arc = 1.45;
      ctx.globalAlpha = 0.14 + p * 0.22;
      ctx.fillStyle = PAL.danger;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.arc(this.x, this.y, range, this.facing - arc, this.facing + arc);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.5 + p * 0.4;
      ctx.strokeStyle = PAL.dangerEdge;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, range * p, this.facing - arc, this.facing + arc);
      ctx.stroke();
    } else if (this.attack === 'slam' || this.attack === 'ring') {
      const rMax = this.attack === 'slam' ? 188 : 150;
      ctx.globalAlpha = 0.13 + p * 0.2;
      ctx.fillStyle = PAL.danger;
      ctx.beginPath(); ctx.arc(this.x, this.y, rMax, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.55 + p * 0.4;
      ctx.strokeStyle = PAL.dangerEdge;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, rMax * p, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(this.x, this.y, rMax, 0, TAU); ctx.globalAlpha = 0.3; ctx.stroke();
    } else if (this.attack === 'spiral') {
      // rotating spoke preview
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.globalAlpha = 0.25 + p * 0.4;
      ctx.strokeStyle = PAL.danger;
      ctx.lineWidth = 2.5;
      const previewA = this.spiralAng;
      for (const off of [0, Math.PI]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(previewA + off) * (this.r + 8), Math.sin(previewA + off) * (this.r + 8));
        ctx.lineTo(Math.cos(previewA + off) * (this.r + 60 + p * 60), Math.sin(previewA + off) * (this.r + 60 + p * 60));
        ctx.stroke();
      }
      ctx.globalAlpha = 0.35 + p * 0.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.arc(0, 0, this.r + 26 + Math.sin(p * 14) * 4, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else if (this.attack === 'charge') {
      const len = 900;
      ctx.globalAlpha = 0.12 + p * 0.18;
      ctx.fillStyle = PAL.danger;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.chargeDir);
      ctx.fillRect(0, -this.r - 6, len, (this.r + 6) * 2);
      ctx.globalAlpha = 0.4 + p * 0.4;
      ctx.strokeStyle = PAL.dangerEdge;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(0, -this.r - 6, len * p, (this.r + 6) * 2);
      ctx.restore();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ game
type GameState = 'title' | 'intro' | 'fight' | 'dead' | 'victory';

const TOUCH_BTNS = [
  { id: 'light', label: 'ATK', dx: -70, dy: -90, r: 44 },
  { id: 'roll', label: 'ROLL', dx: -140, dy: -46, r: 38 },
  { id: 'heavy', label: 'HVY', dx: -56, dy: -176, r: 36 },
  { id: 'flask', label: 'FLASK', dx: -206, dy: -118, r: 30 },
];

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  input: Input;
  audio = new GameAudio();
  player = new Player();
  boss = new Boss();
  state: GameState = 'title';
  stateT = 0;
  time = 0;
  arenaR = 560;
  particles: Particle[] = [];
  dmgNums: DamageNum[] = [];
  projectiles: Projectile[] = [];
  rings: RingWave[] = [];
  meteors: Meteor[] = [];
  camX = 0; camY = 0; camZoom = 1;
  shakeAmp = 0; shakeT = 0; shakeDur = 0;
  hitstop = 0; timeScale = 1; slowT = 0;
  redFlash = 0; goldFlash = 0;
  bannerText = ''; bannerSub = ''; bannerT = 0; bannerKind = '';
  raf = 0; lastTs = 0;
  dpr = 1; w = 0; h = 0;
  // stats
  attempts = 1; fightTime = 0; damageDealt = 0; hitsTaken = 0;
  floorStones: { x: number; y: number; r: number; s: number }[] = [];
  ambientT = 0;
  hintT = 0;
  bossBarFill = 0;
  destroyed = false;
  // rendering layers
  floorCanvas: HTMLCanvasElement | null = null;
  scorchCanvas: HTMLCanvasElement | null = null;
  scorchCtx: CanvasRenderingContext2D | null = null;
  floorSize = 0;
  motes: { x: number; y: number; spd: number; drift: number; size: number; par: number }[] = [];
  zoomPunch = 0;
  hbT = 0;
  graceAtStart = 0;
  // persistence
  bestTime = 0; wins = 0; newRecord = false; grade = '';
  bests: Record<string, number> = {};
  // accessibility / difficulty — one dial, -3 (aided) .. +5 (vowed)
  grace = 0;
  shakeEnabled = true;
  flashReduced = false;
  static SAVE_VERSION = 2;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.input = new Input(canvas, () => { this.audio.init(); if (this.audio.muted) this.audio.setMuted(true); });
    (window as any).__graceTouch = (e: TouchEvent, phase: string) => this.handleTouch(e, phase);
    this.resize();
    window.addEventListener('resize', this.resize);
    (window as any).__game = this; // QA / debug hook
    // scatter floor detail
    for (let i = 0; i < 130; i++) {
      const a = rand(0, TAU), r = Math.sqrt(Math.random()) * (this.arenaR - 20);
      this.floorStones.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, r: rand(3, 14), s: rand(0, TAU) });
    }
    // parallax ash field (screen space)
    for (let i = 0; i < 64; i++) {
      this.motes.push({ x: Math.random(), y: Math.random(), spd: rand(7, 26), drift: rand(-5, 5), size: rand(0.7, 2.2), par: rand(0.02, 0.09) });
    }
    // saved progress
    try {
      const sv = JSON.parse(localStorage.getItem('gracefell') || '{}');
      // v1 saves had a single bestTime and no settings; migrate forward.
      if (typeof sv.wins === 'number') this.wins = sv.wins;
      if (typeof sv.attempts === 'number') this.attempts = Math.max(1, sv.attempts);
      if (sv.muted) this.audio.muted = true;
      if (sv.bests && typeof sv.bests === 'object') this.bests = sv.bests;
      if (typeof sv.bestTime === 'number' && sv.bestTime > 0) {
        this.bestTime = sv.bestTime;
        if (this.bests['0'] === undefined) this.bests['0'] = sv.bestTime; // v1 runs were all grace 0
      }
      if (typeof sv.grace === 'number') this.grace = clamp(Math.round(sv.grace), -3, 5);
      if (typeof sv.shakeEnabled === 'boolean') this.shakeEnabled = sv.shakeEnabled;
      if (typeof sv.flashReduced === 'boolean') this.flashReduced = sv.flashReduced;
    } catch { /* first run / private mode */ }
    this.buildFloor();
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      if (this.destroyed) return;
      const rawDt = Math.min(0.05, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      this.frame(rawDt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    window.removeEventListener('resize', this.resize);
    (window as any).__graceTouch = undefined;
  }

  private resize = () => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
  };

  // ------------------------------------------------------------ helpers
  clampArena(e: { x: number; y: number; r: number }) {
    const d = Math.hypot(e.x, e.y);
    const max = this.arenaR - e.r - 6;
    if (d > max) { e.x = (e.x / d) * max; e.y = (e.y / d) * max; }
  }
  shake(amp: number, dur: number) {
    if (!this.shakeEnabled) return;
    this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = 0; this.shakeDur = dur;
  }
  addParticle(p: Particle) { if (this.particles.length < 700) this.particles.push(p); }
  burst(x: number, y: number, n: number, color: string, spd: number, life: number, size: number) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.3, 1) * spd;
      this.addParticle({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.5, 1) * life, maxLife: life, size: rand(0.5, 1) * size, sizeEnd: 0,
        color, glow: true, drag: 3, grav: 60, shape: 'circle',
      });
    }
  }
  sparks(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(120, 420);
      this.addParticle({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.15, 0.4), maxLife: 0.4, size: rand(1, 2.4), sizeEnd: 0,
        color: Math.random() < 0.5 ? PAL.goldBright : '#fff2d0', glow: true, drag: 4, grav: 200, shape: 'spark',
      });
    }
  }
  addDamageNum(x: number, y: number, text: string, color: string, size: number) {
    this.dmgNums.push({ x, y, vy: -70, life: 0.9, maxLife: 0.9, text, color, size });
  }
  banner(text: string, kind: string, sub = '') {
    this.bannerText = text; this.bannerKind = kind; this.bannerSub = sub; this.bannerT = kind === 'phase' ? 2.2 : 1.4;
  }

  // Every difficulty and accessibility lever derives from `grace`. Negative
  // grace lengthens the read (slower boss, longer telegraphs, wider i-frames,
  // softer hits) rather than making the fight a different fight — the pattern
  // you learn at -3 is the same pattern you execute at +5.
  get mods() {
    const g = this.grace;
    const aid = clamp(-g, 0, 3) / 3;
    const vow = clamp(g, 0, 5) / 5;
    return {
      bossSpeed: 1 - aid * 0.22 + vow * 0.30,
      dmgTaken: 1 - aid * 0.45 + vow * 0.40,
      iframe: 1 + aid * 0.55,
      perfectWindow: 1 + aid * 0.6,
      flasks: 3 + (g <= -2 ? 1 : 0) - (g >= 4 ? 2 : g >= 2 ? 1 : 0),
      noStagger: g >= 3,
    };
  }

  graceLabel(g = this.grace): string {
    if (g === 0) return 'MEASURED';
    const names: Record<number, string> = {
      [-3]: 'UNBURDENED', [-2]: 'SHELTERED', [-1]: 'STEADIED',
      1: 'HASTE', 2: 'FAMINE', 3: 'IRON', 4: 'FRAILTY', 5: 'FORSAKEN',
    };
    return `${names[g] ?? ''} ${g > 0 ? '+' : ''}${g}`.trim();
  }

  setGrace(g: number) {
    this.grace = clamp(Math.round(g), -3, 5);
    this.persist();
  }

  // shake and flashes are photosensitivity levers as much as feel levers
  flashScale() { return this.flashReduced ? 0.25 : 1; }

  persist() {
    try {
      localStorage.setItem('gracefell', JSON.stringify({
        v: Game.SAVE_VERSION,
        bestTime: this.bestTime, bests: this.bests, wins: this.wins,
        attempts: this.attempts, muted: this.audio.muted,
        grace: this.grace, shakeEnabled: this.shakeEnabled, flashReduced: this.flashReduced,
      }));
    } catch { /* ignore */ }
  }

  // bake the arena floor once at 2x — rich detail with zero per-frame cost
  buildFloor() {
    const R = this.arenaR;
    const S = (R + 110) * 2;
    this.floorSize = S;
    const ss = 2; // supersample
    const c = document.createElement('canvas');
    c.width = S * ss; c.height = S * ss;
    const g = c.getContext('2d')!;
    g.scale(ss, ss);
    g.translate(S / 2, S / 2);
    // base
    const fg = g.createRadialGradient(0, 0, 40, 0, 0, R + 90);
    fg.addColorStop(0, '#282013');
    fg.addColorStop(0.55, '#1c160e');
    fg.addColorStop(0.85, '#141009');
    fg.addColorStop(1, '#0a0806');
    g.fillStyle = fg;
    g.beginPath(); g.arc(0, 0, R + 100, 0, TAU); g.fill();
    // flagstone plates — radial mortar joints
    g.strokeStyle = 'rgba(0,0,0,0.42)';
    g.lineWidth = 2;
    for (let ring = 0; ring < 5; ring++) {
      const r0 = 90 + ring * (R - 110) / 5;
      const segs = 8 + ring * 3;
      const a0 = ring * 0.37;
      for (let i = 0; i < segs; i++) {
        const a = a0 + (i / segs) * TAU;
        g.beginPath();
        g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        g.lineTo(Math.cos(a + rand(-0.04, 0.04)) * (r0 + (R - 110) / 5), Math.sin(a + rand(-0.04, 0.04)) * (r0 + (R - 110) / 5));
        g.stroke();
      }
      g.beginPath(); g.arc(0, 0, r0, 0, TAU); g.stroke();
    }
    // per-plate tonal variance
    for (let i = 0; i < 90; i++) {
      const a = rand(0, TAU), r = 90 + Math.sqrt(Math.random()) * (R - 110);
      g.globalAlpha = rand(0.03, 0.08);
      g.fillStyle = Math.random() < 0.5 ? '#000' : '#c9b58a';
      g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, rand(24, 60), 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    // stones
    g.fillStyle = 'rgba(255,240,200,0.05)';
    for (const st of this.floorStones) {
      g.beginPath(); g.arc(st.x, st.y, st.r, 0, TAU); g.fill();
    }
    // cracks
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.4;
      g.beginPath();
      g.moveTo(Math.cos(a) * 80, Math.sin(a) * 80);
      const mx = Math.cos(a + 0.15) * (R * 0.5), my = Math.sin(a + 0.15) * (R * 0.5);
      g.quadraticCurveTo(mx + Math.sin(i * 7) * 40, my + Math.cos(i * 5) * 40, Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92);
      g.stroke();
    }
    // concentric guide rings
    g.strokeStyle = PAL.floorRing;
    for (const rr of [R * 0.35, R * 0.65, R * 0.92]) {
      g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.stroke();
    }
    // center sigil (static)
    g.save();
    g.globalAlpha = 0.16;
    g.strokeStyle = PAL.gold;
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - Math.PI / 2;
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 46, Math.sin(a) * 46);
    }
    g.stroke();
    g.beginPath(); g.arc(0, 0, 46, 0, TAU); g.stroke();
    g.restore();
    // fine speckle
    for (let i = 0; i < 700; i++) {
      const a = rand(0, TAU), r = Math.sqrt(Math.random()) * (R + 60);
      g.globalAlpha = rand(0.02, 0.07);
      g.fillStyle = Math.random() < 0.6 ? '#000' : '#e8dcc0';
      g.fillRect(Math.cos(a) * r, Math.sin(a) * r, rand(1, 2.4), rand(1, 2.4));
    }
    g.globalAlpha = 1;
    this.floorCanvas = c;
    // scorch overlay — battle scars accumulate here
    const sc = document.createElement('canvas');
    sc.width = S; sc.height = S;
    this.scorchCanvas = sc;
    this.scorchCtx = sc.getContext('2d')!;
    this.scorchCtx.translate(S / 2, S / 2);
  }

  addScorch(x: number, y: number, r: number, color: string, alpha: number) {
    const g = this.scorchCtx;
    if (!g) return;
    if (Math.hypot(x, y) > this.arenaR + 40) return;
    const grad = g.createRadialGradient(x, y, r * 0.1, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha;
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }

  // ------------------------------------------------------------ combat glue
  playerStrike(heavy: boolean) {
    const p = this.player, b = this.boss;
    const step = p.comboStep;
    const finisher = !heavy && step === 2;
    const range = heavy ? 95 : finisher ? 88 : 78;
    const arc = heavy ? 1.25 : finisher ? 1.3 : 1.05;
    const dmg = heavy ? 30 : finisher ? 24 : step === 1 ? 14 : 12;
    const d = dist(p.x, p.y, b.x, b.y);
    if (d < range + b.r) {
      const a = angTo(p.x, p.y, b.x, b.y);
      if (Math.abs(angDiff(p.facing, a)) < arc) {
        b.takeDamage((heavy || finisher) ? dmg : dmg + Math.floor(rand(-2, 3)), this, p.x, p.y);
        if ((heavy || finisher) && b.state !== 'staggered') { b.vx += Math.cos(a) * (finisher ? 90 : 60); b.vy += Math.sin(a) * (finisher ? 90 : 60); }
        if (finisher) { this.sparks(b.x, b.y, 10); this.shake(5, 0.2); }
      }
    }
  }
  onPerfectDodge() {
    const p = this.player;
    p.perfectCd = 0.8;
    p.stam = clamp(p.stam + 30, 0, p.maxStam);
    this.slowT = 0.34; this.timeScale = 0.25;
    this.goldFlash = Math.max(this.goldFlash, 0.28);
    this.audio.parrySpark();
    this.addDamageNum(p.x, p.y - 30, 'PERFECT', PAL.spirit, 21);
    this.sparks(p.x, p.y, 14);
    this.boss.applyPoise(16, this);
  }
  bossArcStrike(x: number, y: number, facing: number, arc: number, range: number, dmg: number) {
    const p = this.player;
    const d = dist(x, y, p.x, p.y);
    this.sparks(x + Math.cos(facing) * range * 0.7, y + Math.sin(facing) * range * 0.7, 6);
    if (d < range + p.r && Math.abs(angDiff(facing, angTo(x, y, p.x, p.y))) < arc) {
      p.takeDamage(dmg, x, y, this);
    }
  }
  bossSlam(x: number, y: number, r: number, dmg: number) {
    this.audio.slam();
    this.shake(16, 0.5);
    this.addScorch(x, y, r * 0.55, 'rgba(10,6,3,0.85)', 0.32);
    this.addScorch(x, y, r * 0.3, 'rgba(60,30,10,0.9)', 0.25);
    this.burst(x, y, 34, '#8a7a5c', 320, 0.7, 6);
    this.burst(x, y, 16, PAL.amber, 260, 0.6, 4);
    // shockwave ring visual (non-damaging)
    this.rings.push({ x, y, r: 30, speed: 420, thickness: 18, dmg: 0, maxR: r + 40, hostile: false, hitDone: true });
    const p = this.player;
    if (dist(x, y, p.x, p.y) < r + p.r * 0.3) p.takeDamage(dmg, x, y, this);
  }

  onPlayerDeath() {
    this.audio.deathSting();
    this.slowT = 1.2; this.timeScale = 0.3;
    this.state = 'dead'; this.stateT = 0;
    this.persist();
  }
  onBossDeath() {
    this.boss.state = 'dying';
    this.slowT = 1.5; this.timeScale = 0.22;
    this.audio.roar(true);
    this.shake(18, 1);
    this.burst(this.boss.x, this.boss.y, 80, PAL.amber, 380, 1.6, 5);
    this.burst(this.boss.x, this.boss.y, 40, PAL.goldBright, 260, 2, 4);
    this.state = 'victory'; this.stateT = 0;
    this.goldFlash = 0.8;
    this.audio.victoryChord();
    this.wins++;
    const key = String(this.graceAtStart);
    const prev = this.bests[key];
    this.newRecord = prev === undefined || this.fightTime < prev;
    if (this.newRecord) this.bests[key] = this.fightTime;
    if (this.bestTime === 0 || this.fightTime < this.bestTime) this.bestTime = this.fightTime;
    this.grade = this.computeGrade();
    this.persist();
  }

  computeGrade(): string {
    const t = this.fightTime, h = this.hitsTaken, f = this.player.flasks;
    if (h === 0) return 'S';
    if (t < 100 && h <= 3) return 'S';
    if (t < 160 && h <= 6) return 'A';
    if (t < 240 || h <= 9) return 'B';
    void f;
    return 'C';
  }

  resetFight() {
    this.player = new Player();
    this.boss = new Boss();
    const m = this.mods;
    this.boss.extraSpeed = m.bossSpeed;
    this.player.flasks = m.flasks;
    this.player.maxFlasks = m.flasks;
    this.graceAtStart = this.grace;
    this.projectiles = []; this.rings = []; this.meteors = [];
    this.particles = []; this.dmgNums = [];
    this.fightTime = 0; this.damageDealt = 0; this.hitsTaken = 0;
    this.hitstop = 0; this.timeScale = 1; this.slowT = 0;
    this.redFlash = 0; this.goldFlash = 0; this.bannerT = 0;
    this.audio.setPhase(1);
    this.bossBarFill = 0;
    this.hintT = 9;
    if (this.scorchCtx && this.scorchCanvas) {
      this.scorchCtx.save();
      this.scorchCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.scorchCtx.clearRect(0, 0, this.scorchCanvas.width, this.scorchCanvas.height);
      this.scorchCtx.restore();
    }
  }

  // ------------------------------------------------------------ title menu
  // Laid out once and reused by both the renderer and the hit-test, so the
  // thing you see is provably the thing you can press.
  menuRows(): { id: string; y: number; label: string; value: string }[] {
    const baseY = this.h * 0.70;
    const gap = Math.max(30, Math.min(38, this.h * 0.045));
    return [
      { id: 'grace', y: baseY, label: 'TRIAL', value: this.graceLabel() },
      { id: 'shake', y: baseY + gap, label: 'SCREEN SHAKE', value: this.shakeEnabled ? 'on' : 'off' },
      { id: 'flash', y: baseY + gap * 2, label: 'FLASHES', value: this.flashReduced ? 'reduced' : 'full' },
    ];
  }

  // One geometry function feeds the renderer, the hit-test, AND the layout
  // assertions in qa/verify.cjs — so what you see is provably what you can
  // press, at any viewport, without a human eyeballing a screenshot.
  menuGeom() {
    const cx = this.w / 2;
    const halfW = Math.min(300, this.w * 0.42);
    const pad = 18;
    const pipStep = Math.min(16, halfW * 0.055);
    return {
      cx, halfW, pad, pipStep,
      plateL: cx - halfW,
      plateR: cx + halfW,
      rowH: 30,
      chevLx: cx - halfW + pad,
      chevRx: cx + halfW - pad,
      valueRx: cx + halfW - pad * 2.2,
      labelLx: cx - halfW + pad * 0.8,
      pipX: (g: number) => cx + (g - 1) * pipStep,
      decZone: cx - halfW * 0.42,
      incZone: cx + halfW * 0.42,
    };
  }

  private menuHit(tx: number, ty: number): boolean {
    const rows = this.menuRows();
    const { cx, halfW } = this.menuGeom();
    for (const row of rows) {
      if (Math.abs(ty - row.y) > 18) continue;
      if (Math.abs(tx - cx) > halfW) continue;
      if (row.id === 'grace') {
        // left third decreases, right third increases, middle does nothing
        const gm = this.menuGeom();
        if (tx < gm.decZone) { this.setGrace(this.grace - 1); this.audio.telegraph(); return true; }
        if (tx > gm.incZone) { this.setGrace(this.grace + 1); this.audio.telegraph(); return true; }
        return true; // swallow: they aimed at the row, not at "start"
      }
      if (row.id === 'shake') { this.shakeEnabled = !this.shakeEnabled; this.persist(); this.audio.telegraph(); return true; }
      if (row.id === 'flash') { this.flashReduced = !this.flashReduced; this.persist(); this.audio.telegraph(); return true; }
    }
    return false;
  }

  // Returns true if the tap was eaten by the menu (so it must not start the fight).
  handleTitleInput(): boolean {
    let ate = false;
    for (const t of this.input.taps) {
      if (this.menuHit(t.x, t.y)) ate = true;
    }
    // keyboard: left/right nudge the dial without touching the start binding
    if (this.input.consume('left')) { this.setGrace(this.grace - 1); this.audio.telegraph(); }
    if (this.input.consume('right')) { this.setGrace(this.grace + 1); this.audio.telegraph(); }
    return ate;
  }

  // ------------------------------------------------------------ touch buttons
  private handleTouch(e: TouchEvent, phase: string) {
    if (!this.input.isTouch) return;
    const r = this.canvas.getBoundingClientRect();
    const btn = (id: string) => TOUCH_BTNS.find((b) => b.id === id)!;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX - r.left, y = t.clientY - r.top;
      for (const b of TOUCH_BTNS) {
        const bx = r.width + b.dx, by = r.height + b.dy;
        if (Math.hypot(x - bx, y - by) < b.r + 8) {
          if (phase === 'start') this.input.btnPressed[b.id] = true;
        }
      }
      void btn;
    }
  }

  // ------------------------------------------------------------ frame
  private frame(rawDt: number) {
    // hitstop freezes simulation but keeps rendering
    if (this.hitstop > 0) { this.hitstop -= rawDt; this.render(); this.input.endFrame(); return; }
    let dt = rawDt * this.timeScale;
    if (this.slowT > 0) { this.slowT -= rawDt; if (this.slowT <= 0) this.timeScale = 1; }

    this.time += dt;
    this.stateT += dt;

    // global state transitions
    if (this.state === 'title') {
      const ateTap = this.handleTitleInput();
      if (ateTap) this.input.consume('confirm'); // swallow — they pressed a setting
      if (!ateTap && this.input.consume('confirm')) {
        this.state = 'intro'; this.stateT = 0;
        this.resetFight();
        this.audio.init();
      }
    } else if (this.state === 'intro') {
      if (this.stateT > 2.6 || (this.stateT > 0.6 && this.input.consume('confirm'))) {
        this.state = 'fight'; this.stateT = 0;
        this.boss.state = 'stalk'; this.boss.t = 0.4;
        this.audio.roar(true);
      }
    } else if (this.state === 'dead') {
      if (this.stateT > 1.4 && this.input.consume('confirm')) {
        this.attempts++;
        this.resetFight();
        this.state = 'intro'; this.stateT = 0;
      }
    } else if (this.state === 'victory') {
      if (this.stateT > 2.2 && this.input.consume('confirm')) {
        this.attempts++;
        this.resetFight();
        this.state = 'intro'; this.stateT = 0;
      }
    }

    if (this.input.consume('mute')) this.audio.setMuted(!this.audio.muted);

    // simulation
    const fighting = this.state === 'fight' || this.state === 'intro';
    if (fighting) {
      if (this.state === 'fight') this.fightTime += dt;
      this.player.update(dt, this.input, this);
      if (this.boss.hp > 0) this.boss.update(dt, this);
      this.updateProjectiles(dt);
      this.updateRings(dt);
      this.updateMeteors(dt);
      this.hintT = Math.max(0, this.hintT - dt);
      // body separation — no standing inside the sovereign
      const b = this.boss, pl = this.player;
      if (b.hp > 0 && pl.state !== 'dead' && b.state !== 'dying') {
        const d = dist(pl.x, pl.y, b.x, b.y);
        const min = b.r + pl.r - 2;
        if (d < min && d > 0.01) {
          const push = min - d;
          pl.x += ((pl.x - b.x) / d) * push;
          pl.y += ((pl.y - b.y) / d) * push;
        }
      }
    }
    this.updateParticles(dt);
    this.updateDmgNums(dt);

    // camera
    const p = this.player, b = this.boss;
    const lookX = p.x + p.vx * 0.12, lookY = p.y + p.vy * 0.12;
    const targetX = this.state === 'intro' ? b.x : lerp(lookX, (p.x + b.x) / 2, 0.25);
    const targetY = this.state === 'intro' ? b.y : lerp(lookY, (p.y + b.y) / 2, 0.25);
    this.camX = lerp(this.camX, targetX, 1 - Math.exp(-5 * dt));
    this.camY = lerp(this.camY, targetY, 1 - Math.exp(-5 * dt));
    const baseZoom = clamp(Math.min(this.w / 1250, this.h / 900), 0.55, 1.35) * (this.state === 'intro' ? 1.12 : 1);
    this.camZoom = lerp(this.camZoom, baseZoom, 1 - Math.exp(-3 * dt));

    // shake decay
    if (this.shakeT < this.shakeDur) this.shakeT += rawDt; else this.shakeAmp = 0;
    this.zoomPunch = Math.max(0, this.zoomPunch - rawDt * 0.22);

    // low-hp heartbeat
    if (this.state === 'fight') {
      const frac = this.player.hp / this.player.maxHp;
      if (frac < 0.3 && this.player.hp > 0) {
        this.hbT -= rawDt;
        if (this.hbT <= 0) {
          this.hbT = lerp(0.55, 1.0, frac / 0.3);
          this.audio.heartbeat();
        }
      } else this.hbT = 0;
    }

    // flashes
    this.redFlash = Math.max(0, this.redFlash - rawDt * 1.6);
    this.goldFlash = Math.max(0, this.goldFlash - rawDt * 1.2);
    this.bannerT = Math.max(0, this.bannerT - rawDt);

    // ambient embers
    this.ambientT -= dt;
    if (this.ambientT <= 0) {
      this.ambientT = 0.12;
      const a = rand(0, TAU), r = Math.sqrt(Math.random()) * this.arenaR;
      this.addParticle({
        x: Math.cos(a) * r, y: Math.sin(a) * r, vx: rand(-8, 8), vy: rand(-26, -10),
        life: rand(1.5, 3), maxLife: 3, size: rand(0.8, 2), sizeEnd: 0,
        color: Math.random() < 0.6 ? '#7a5a30' : PAL.gold, glow: true, drag: 0.2, grav: -6, shape: 'wisp',
      });
    }

    // boss bar smoothing
    const targetFill = this.boss.hp / this.boss.maxHp;
    this.bossBarFill = lerp(this.bossBarFill, targetFill, 1 - Math.exp(-4 * dt));

    this.render();
    this.input.endFrame();
  }

  private updateProjectiles(dt: number) {
    const p = this.player;
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if (Math.random() < dt * 30) {
        this.addParticle({
          x: pr.x, y: pr.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.3, maxLife: 0.3,
          size: rand(1.5, 3), sizeEnd: 0, color: pr.hue, glow: true, drag: 2, grav: 0, shape: 'circle',
        });
      }
      if (pr.hostile && dist(pr.x, pr.y, p.x, p.y) < pr.r + p.r) {
        if (p.takeDamage(pr.dmg, pr.x - pr.vx * 0.1, pr.y - pr.vy * 0.1, this)) pr.life = 0;
      }
      if (Math.hypot(pr.x, pr.y) > this.arenaR + 40) pr.life = 0;
    }
    this.projectiles = this.projectiles.filter((pr) => pr.life > 0);
  }

  private updateRings(dt: number) {
    const p = this.player;
    for (const rg of this.rings) {
      rg.r += rg.speed * dt;
      if (rg.hostile && !rg.hitDone && rg.dmg > 0) {
        const d = dist(rg.x, rg.y, p.x, p.y);
        if (Math.abs(d - rg.r) < rg.thickness / 2 + p.r * 0.6) {
          if (p.takeDamage(rg.dmg, rg.x, rg.y, this)) rg.hitDone = true;
          else if (p.iframes > 0) rg.hitDone = true; // dodged through
        }
      }
    }
    this.rings = this.rings.filter((rg) => rg.r < rg.maxR);
  }

  private updateMeteors(dt: number) {
    const p = this.player;
    for (const m of this.meteors) {
      m.fuse -= dt;
      if (m.fuse <= 0) {
        this.audio.meteor();
        this.shake(9, 0.3);
        this.addScorch(m.x, m.y, m.r * 0.6, 'rgba(8,4,2,0.9)', 0.4);
        this.addScorch(m.x, m.y, m.r * 0.32, 'rgba(120,45,15,0.8)', 0.3);
        this.burst(m.x, m.y, 26, PAL.amber, 300, 0.7, 5);
        this.burst(m.x, m.y, 12, '#6b5a41', 220, 0.6, 6);
        if (dist(m.x, m.y, p.x, p.y) < m.r + p.r * 0.3) p.takeDamage(m.dmg, m.x, m.y, this);
      }
    }
    this.meteors = this.meteors.filter((m) => m.fuse > 0);
  }

  private updateParticles(dt: number) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.vx -= pt.vx * pt.drag * dt;
      pt.vy -= pt.vy * pt.drag * dt;
      pt.vy += pt.grav * dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }
  private updateDmgNums(dt: number) {
    for (const dn of this.dmgNums) { dn.life -= dt; dn.y += dn.vy * dt; dn.vy *= 0.92; }
    this.dmgNums = this.dmgNums.filter((dn) => dn.life > 0);
  }
}

// ------------------------------------------------------------------ render
export interface Game {
  render(): void;
  drawArena(ctx: CanvasRenderingContext2D): void;
  drawHUD(ctx: CanvasRenderingContext2D): void;
  drawBanner(ctx: CanvasRenderingContext2D): void;
  drawTitle(ctx: CanvasRenderingContext2D): void;
  drawIntro(ctx: CanvasRenderingContext2D): void;
  drawDeath(ctx: CanvasRenderingContext2D): void;
  drawVictory(ctx: CanvasRenderingContext2D): void;
  drawTouchUI(ctx: CanvasRenderingContext2D): void;
}

const serif = (size: number, weight = 700) => `${weight} ${size}px Cinzel, 'Times New Roman', serif`;
const body = (size: number, weight = 400) => `${weight} ${size}px 'Cormorant Garamond', Georgia, serif`;

(Game.prototype as any).render = function render(this: Game) {
  const ctx = this.ctx;
  ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  ctx.clearRect(0, 0, this.w, this.h);

  // ---- backdrop
  const bgGrad = ctx.createRadialGradient(this.w / 2, this.h / 2, 10, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
  bgGrad.addColorStop(0, '#16120c');
  bgGrad.addColorStop(0.6, PAL.bg);
  bgGrad.addColorStop(1, '#050403');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, this.w, this.h);

  // ---- god rays — faint shafts of grace from above
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(this.time * 0.12 + i * 2.1) * this.w * 0.06;
    const bx = this.w * (0.3 + i * 0.2) + sway;
    const spread = this.w * 0.10;
    const rg2 = ctx.createLinearGradient(0, 0, 0, this.h);
    rg2.addColorStop(0, 'rgba(240,215,140,0.05)');
    rg2.addColorStop(0.75, 'rgba(240,215,140,0.008)');
    rg2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg2;
    ctx.beginPath();
    ctx.moveTo(bx - spread * 0.25, -10);
    ctx.lineTo(bx + spread * 0.25, -10);
    ctx.lineTo(bx + spread + sway * 0.5, this.h);
    ctx.lineTo(bx - spread + sway * 0.5, this.h);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // ---- drifting ash (parallax, screen space)
  ctx.save();
  for (const m of this.motes) {
    const px = ((m.x * this.w + this.time * m.drift - this.camX * m.par * 10) % this.w + this.w) % this.w;
    const py = ((m.y * this.h - this.time * m.spd - this.camY * m.par * 10) % this.h + this.h) % this.h;
    ctx.globalAlpha = 0.10 + m.par * 2.2;
    ctx.fillStyle = m.size > 1.6 ? '#c9a959' : '#8a7a5c';
    ctx.beginPath(); ctx.arc(px, py, m.size, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // ---- camera transform
  let shX = 0, shY = 0;
  if (this.shakeAmp > 0.1) {
    const decay = 1 - this.shakeT / Math.max(0.001, this.shakeDur);
    shX = rand(-1, 1) * this.shakeAmp * decay;
    shY = rand(-1, 1) * this.shakeAmp * decay;
  }
  ctx.save();
  ctx.translate(this.w / 2 + shX, this.h / 2 + shY);
  const zp = this.camZoom * (1 + this.zoomPunch);
  ctx.scale(zp, zp);
  ctx.translate(-this.camX, -this.camY);

  this.drawArena(ctx);

  // telegraphs under entities
  if (this.boss.hp > 0) this.boss.drawTelegraph(ctx);

  // torchlight pools — lift hero & boss from the dark
  {
    const pl = this.player;
    const lp = ctx.createRadialGradient(pl.x, pl.y, 8, pl.x, pl.y, 160);
    lp.addColorStop(0, 'rgba(240,215,140,0.11)');
    lp.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lp;
    ctx.beginPath(); ctx.arc(pl.x, pl.y, 160, 0, TAU); ctx.fill();
    if (this.boss.hp > 0) {
      const bs = this.boss;
      const lb = ctx.createRadialGradient(bs.x, bs.y, 10, bs.x, bs.y, 230);
      lb.addColorStop(0, bs.phase === 2 ? 'rgba(255,122,41,0.16)' : 'rgba(255,150,80,0.08)');
      lb.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lb;
      ctx.beginPath(); ctx.arc(bs.x, bs.y, 230, 0, TAU); ctx.fill();
    }
  }

  // meteors telegraphs
  for (const m of this.meteors) {
    const p = 1 - m.fuse / m.maxFuse;
    ctx.globalAlpha = 0.16 + p * 0.25;
    ctx.fillStyle = PAL.danger;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.6 + p * 0.4;
    ctx.strokeStyle = PAL.dangerEdge;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r * p, 0, TAU); ctx.stroke();
    // shape coding — four ticks closing in, readable without colour
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      const r0 = m.r * (1 - p * 0.7), r1 = r0 + 12;
      ctx.beginPath();
      ctx.moveTo(m.x + Math.cos(a) * r0, m.y + Math.sin(a) * r0);
      ctx.lineTo(m.x + Math.cos(a) * r1, m.y + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // rings
  for (const rg of this.rings) {
    const fade = 1 - rg.r / rg.maxR;
    ctx.globalAlpha = clamp(fade * 1.4, 0, 1) * (rg.hostile ? 0.85 : 0.4);
    ctx.strokeStyle = rg.hostile ? PAL.danger : '#c9b58a';
    ctx.lineWidth = rg.thickness * clamp(fade, 0.3, 1);
    ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, TAU); ctx.stroke();
    if (rg.hostile) {
      // bright leading edge — the thing you actually have to clear
      ctx.globalAlpha = clamp(fade * 1.6, 0, 1);
      ctx.strokeStyle = PAL.dangerEdge;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r + rg.thickness / 2, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // projectiles
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const pr of this.projectiles) {
    const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, pr.r * 2.6);
    g.addColorStop(0, '#fff4ec');
    g.addColorStop(0.35, pr.hue);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 2.6, 0, TAU); ctx.fill();
    // hard white core — survives any colour deficiency or dark display
    ctx.fillStyle = PAL.dangerEdge;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // shape coding pass — hazards are diamonds, decoration is round
  ctx.save();
  ctx.strokeStyle = PAL.dangerEdge;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.9;
  for (const pr of this.projectiles) {
    const spin = this.time * 3 + pr.x * 0.01;
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(spin);
    ctx.beginPath();
    ctx.moveTo(0, -pr.r * 1.5); ctx.lineTo(pr.r * 1.5, 0);
    ctx.lineTo(0, pr.r * 1.5); ctx.lineTo(-pr.r * 1.5, 0);
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  if (this.boss.hp > 0 || this.state === 'victory') {
    if (this.boss.state !== 'dying') this.boss.draw(ctx, this);
  }
  this.player.draw(ctx, this);

  // particles — additive bloom pass for glowing ones (cheaper + brighter than shadowBlur)
  ctx.save();
  for (const pt of this.particles) {
    const t = clamp(pt.life / pt.maxLife, 0, 1);
    const s = lerp(pt.sizeEnd, pt.size, t);
    ctx.globalCompositeOperation = pt.glow ? 'lighter' : 'source-over';
    ctx.fillStyle = pt.color;
    if (pt.shape === 'spark') {
      ctx.globalAlpha = t;
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(Math.atan2(pt.vy, pt.vx));
      ctx.fillRect(-s * 3, -s * 0.5, s * 6, s);
      ctx.restore();
    } else {
      if (pt.glow) {
        ctx.globalAlpha = t * 0.28;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0.1, s * 2.3), 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = t;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0.1, s), 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // damage numbers
  ctx.textAlign = 'center';
  for (const dn of this.dmgNums) {
    const t = clamp(dn.life / dn.maxLife, 0, 1);
    ctx.globalAlpha = t;
    ctx.font = serif(dn.size, 700);
    ctx.fillStyle = dn.color;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(dn.text, dn.x, dn.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  ctx.restore(); // end world transform

  // ---- vignette + flashes
  const vg = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.42, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, this.w, this.h);

  if ((this.state === 'fight' || this.state === 'intro') && this.player.hp > 0) {
    const frac = this.player.hp / this.player.maxHp;
    if (frac < 0.3) {
      const sev = 1 - frac / 0.3;
      const pulse = this.flashReduced ? 0.85 : 0.6 + Math.sin(this.time * 5.2) * 0.4;
      const dg = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.32, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.66);
      dg.addColorStop(0, 'rgba(120,10,8,0)');
      dg.addColorStop(1, `rgba(120,10,8,${(0.22 + sev * 0.3) * pulse})`);
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }
  const fscale = this.flashScale();
  if (this.redFlash > 0) {
    const rg = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.7);
    rg.addColorStop(0, 'rgba(150,20,10,0)');
    rg.addColorStop(1, `rgba(150,20,10,${this.redFlash * 0.55 * fscale})`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, this.w, this.h);
  }
  if (this.goldFlash > 0) {
    ctx.fillStyle = `rgba(240,215,140,${this.goldFlash * 0.22 * fscale})`;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  // ---- HUD & screens
  if (this.state === 'fight' || this.state === 'intro') this.drawHUD(ctx);
  this.drawBanner(ctx);
  if (this.state === 'title') this.drawTitle(ctx);
  if (this.state === 'intro') this.drawIntro(ctx);
  if (this.state === 'dead') this.drawDeath(ctx);
  if (this.state === 'victory') this.drawVictory(ctx);
  if (this.input.isTouch && this.state === 'fight') this.drawTouchUI(ctx);
};

(Game.prototype as any).drawArena = function drawArena(this: Game, ctx: CanvasRenderingContext2D) {
  const R = this.arenaR;
  const S = this.floorSize;
  // baked floor
  if (this.floorCanvas) ctx.drawImage(this.floorCanvas, -S / 2, -S / 2, S, S);
  // battle scars
  if (this.scorchCanvas) ctx.drawImage(this.scorchCanvas, -S / 2, -S / 2, S, S);

  // rune circle — rotating glyphs
  ctx.save();
  ctx.rotate(this.time * 0.03);
  ctx.strokeStyle = 'rgba(201,169,89,0.28)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([14, 10]);
  ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.save();
    ctx.translate(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8);
    ctx.rotate(a + Math.PI / 2);
    ctx.strokeRect(-5, -5, 10, 10);
    ctx.restore();
  }
  ctx.restore();

  // arena wall — grace-gold ward
  const pulse = 0.5 + Math.sin(this.time * 1.4) * 0.15;
  ctx.strokeStyle = `rgba(201,169,89,${0.35 + pulse * 0.3})`;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(240,215,140,${pulse * 0.25})`;
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(0, 0, R + 4, 0, TAU); ctx.stroke();

};

(Game.prototype as any).drawHUD = function drawHUD(this: Game, ctx: CanvasRenderingContext2D) {
  const p = this.player;
  const pad = Math.max(18, this.w * 0.02);
  const barW = clamp(this.w * 0.3, 190, 380);

  // ---- player HP
  ctx.save();
  ctx.translate(pad, pad);
  const frame = (w: number, h: number) => {
    ctx.fillStyle = 'rgba(8,6,4,0.75)';
    ctx.fillRect(-2, -2, w + 4, h + 4);
    ctx.strokeStyle = 'rgba(201,169,89,0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-2, -2, w + 4, h + 4);
  };
  frame(barW, 14);
  ctx.fillStyle = PAL.hpBack;
  ctx.fillRect(0, 0, barW, 14);
  const hpw = (p.hp / p.maxHp) * barW;
  const hpg = ctx.createLinearGradient(0, 0, 0, 14);
  hpg.addColorStop(0, '#b8433a');
  hpg.addColorStop(1, '#7c1f1c');
  ctx.fillStyle = hpg;
  ctx.fillRect(0, 0, hpw, 14);
  if (p.hurtFlash > 0) { ctx.fillStyle = `rgba(255,120,100,${p.hurtFlash})`; ctx.fillRect(0, 0, hpw, 14); }

  // stamina
  ctx.translate(0, 22);
  frame(barW * 0.82, 8);
  ctx.fillStyle = '#131a10';
  ctx.fillRect(0, 0, barW * 0.82, 8);
  ctx.fillStyle = PAL.stamina;
  ctx.fillRect(0, 0, (p.stam / p.maxStam) * barW * 0.82, 8);

  // flasks
  ctx.translate(0, 20);
  for (let i = 0; i < p.maxFlasks; i++) {
    ctx.save();
    ctx.translate(i * 26 + 8, 6);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i < p.flasks ? PAL.gold : 'rgba(201,169,89,0.18)';
    ctx.strokeStyle = 'rgba(201,169,89,0.7)';
    ctx.lineWidth = 1;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.strokeRect(-5, -5, 10, 10);
    ctx.restore();
  }
  ctx.restore();

  // ---- boss bar (bottom center)
  if (this.boss.hp > 0) {
    const bw = clamp(this.w * 0.62, 280, 760);
    const bx = (this.w - bw) / 2;
    const by = this.h - (this.input.isTouch ? 248 : 64);
    ctx.textAlign = 'left';
    ctx.font = serif(15, 600);
    ctx.fillStyle = PAL.parchment;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    const name = this.boss.phase >= 3 ? 'MALAKAR, GRACE-FORSAKEN' : this.boss.phase === 2 ? 'MALAKAR, THE BURNING SOVEREIGN' : 'MALAKAR, ASHEN SOVEREIGN';
    ctx.fillText(name, bx + 2, by - 10);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(8,6,4,0.8)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 16);
    ctx.strokeStyle = 'rgba(201,169,89,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 2, by - 2, bw + 4, 16);
    ctx.fillStyle = '#241012';
    ctx.fillRect(bx, by, bw, 12);
    // damage ghost
    ctx.fillStyle = 'rgba(240,215,140,0.5)';
    ctx.fillRect(bx, by, this.bossBarFill * bw, 12);
    ctx.fillStyle = PAL.bossBar;
    ctx.fillRect(bx, by, (this.boss.hp / this.boss.maxHp) * bw, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(bx, by, (this.boss.hp / this.boss.maxHp) * bw, 4);
    // poise — thin gold sliver under the health bar
    ctx.fillStyle = 'rgba(20,14,8,0.8)';
    ctx.fillRect(bx, by + 15, bw, 3);
    ctx.fillStyle = this.boss.state === 'staggered' ? PAL.goldBright : 'rgba(201,169,89,0.75)';
    ctx.fillRect(bx, by + 15, clamp(this.boss.poise / this.boss.maxPoise, 0, 1) * bw, 3);
    // phase pips
    ctx.textAlign = 'right';
    ctx.font = serif(12, 700);
    ctx.fillStyle = 'rgba(201,169,89,0.8)';
    const pips = this.boss.phase >= 3 ? '\u25c6 \u25c6 \u25c6' : this.boss.phase === 2 ? '\u25c6 \u25c6 \u25c7' : '\u25c6 \u25c7 \u25c7';
    ctx.fillText(pips, bx + bw, by - 10);
  }

  // ---- control hints
  if (this.hintT > 0 && !this.input.isTouch) {
    ctx.globalAlpha = clamp(this.hintT / 2, 0, 1) * 0.75;
    ctx.textAlign = 'center';
    ctx.font = body(15, 500);
    ctx.fillStyle = PAL.parchmentDim;
    ctx.fillText('WASD move · SPACE roll · J / LMB attack · K heavy · F flask · M mute', this.w / 2, this.h - 18);
    ctx.globalAlpha = 1;
  }

  // mute indicator
  ctx.textAlign = 'right';
  ctx.font = body(13, 500);
  ctx.fillStyle = 'rgba(154,143,116,0.7)';
  ctx.fillText(this.audio.muted ? 'muted [M]' : '[M] sound', this.w - pad, pad + 8);
};

(Game.prototype as any).drawBanner = function drawBanner(this: Game, ctx: CanvasRenderingContext2D) {
  if (this.bannerT <= 0) return;
  const a = clamp(this.bannerT / 0.5, 0, 1);
  ctx.textAlign = 'center';
  ctx.globalAlpha = a;
  if (this.bannerKind === 'phase') {
    ctx.font = serif(34, 900);
    ctx.fillStyle = PAL.ember;
    ctx.shadowColor = 'rgba(255,110,30,0.6)';
    ctx.shadowBlur = 24;
    ctx.fillText(this.bannerText, this.w / 2, this.h * 0.3);
  } else {
    ctx.font = serif(22, 700);
    ctx.fillStyle = PAL.goldBright;
    ctx.shadowColor = 'rgba(240,215,140,0.5)';
    ctx.shadowBlur = 16;
    ctx.fillText(this.bannerText, this.w / 2, this.h * 0.3);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
};

(Game.prototype as any).drawTitle = function drawTitle(this: Game, ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(5,4,3,0.55)';
  ctx.fillRect(0, 0, this.w, this.h);
  const cx = this.w / 2;
  const cy = this.h * 0.36;

  // grace glow
  const pulse = 0.6 + Math.sin(this.time * 1.8) * 0.25;
  const gg = ctx.createRadialGradient(cx, cy - 30, 4, cx, cy - 30, 260);
  gg.addColorStop(0, `rgba(240,215,140,${0.30 * pulse})`);
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg;
  ctx.fillRect(cx - 280, cy - 300, 560, 560);

  // the sovereign looms behind the title
  {
    ctx.save();
    const sy = cy - 46;
    const breathe = Math.sin(this.time * 0.9) * 4;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#0e0a08';
    ctx.beginPath(); ctx.arc(cx, sy + breathe, 120, 0, TAU); ctx.fill();
    ctx.fillStyle = '#171008';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32;
      ctx.save();
      ctx.translate(cx, sy + breathe);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -112); ctx.lineTo(9, -152 - (i % 2) * 14); ctx.lineTo(18, -112);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // dim core, waiting
    ctx.globalCompositeOperation = 'lighter';
    const corePulse = 0.5 + Math.sin(this.time * 1.4) * 0.3;
    const cg = ctx.createRadialGradient(cx, sy + breathe + 20, 0, cx, sy + breathe + 20, 34);
    cg.addColorStop(0, `rgba(255,150,60,${0.35 * corePulse})`);
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, sy + breathe + 20, 34, 0, TAU); ctx.fill();
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.font = serif(clamp(this.w * 0.085, 44, 96), 900);
  ctx.fillStyle = PAL.parchment;
  ctx.shadowColor = 'rgba(201,169,89,0.45)';
  ctx.shadowBlur = 30;
  ctx.fillText('G R A C E F E L L', cx, cy);
  ctx.shadowBlur = 0;

  ctx.font = body(clamp(this.w * 0.02, 16, 22), 500);
  ctx.fillStyle = PAL.parchmentDim;
  ctx.fillText('a boss waits at the end of grace', cx, cy + 38);

  // divider
  ctx.strokeStyle = 'rgba(201,169,89,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 130, cy + 64); ctx.lineTo(cx + 130, cy + 64); ctx.stroke();
  ctx.save();
  ctx.translate(cx, cy + 64); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = PAL.gold; ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();

  const blink = 0.55 + Math.sin(this.time * 3.2) * 0.45;
  ctx.globalAlpha = blink;
  ctx.font = serif(clamp(this.w * 0.018, 15, 20), 600);
  ctx.fillStyle = PAL.goldBright;
  ctx.fillText(this.input.isTouch ? 'TOUCH TO RAISE YOUR BLADE' : 'CLICK TO RAISE YOUR BLADE', cx, this.h * 0.60);
  ctx.globalAlpha = 1;

  // ---- settings dial: trial / shake / flashes
  {
    const rows = this.menuRows();
    const gm = this.menuGeom();
    const halfW = gm.halfW;
    for (const row of rows) {
      const isGrace = row.id === 'grace';
      // row plate
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = 'rgba(10,8,5,0.55)';
      ctx.fillRect(cx - halfW, row.y - 15, halfW * 2, 30);
      ctx.strokeStyle = 'rgba(201,169,89,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - halfW, row.y - 15, halfW * 2, 30);
      ctx.globalAlpha = 1;

      ctx.textAlign = 'left';
      ctx.font = body(14, 600);
      ctx.fillStyle = PAL.parchmentDim;
      ctx.fillText(row.label, gm.labelLx, row.y + 5);

      ctx.textAlign = 'right';
      ctx.font = serif(14, 700);
      ctx.fillStyle = isGrace
        ? (this.grace > 0 ? PAL.danger : this.grace < 0 ? PAL.spirit : PAL.goldBright)
        : PAL.parchment;
      ctx.fillText(row.value, isGrace ? gm.valueRx : gm.plateR - gm.pad * 0.8, row.y + 5);

      if (isGrace) {
        // chevrons — dimmed at the ends of the range so the limit is visible
        ctx.textAlign = 'center';
        ctx.font = serif(17, 700);
        ctx.fillStyle = this.grace > -3 ? PAL.gold : 'rgba(201,169,89,0.25)';
        ctx.fillText('\u25c0', gm.chevLx, row.y + 6);
        ctx.fillStyle = this.grace < 5 ? PAL.gold : 'rgba(201,169,89,0.25)';
        ctx.fillText('\u25b6', gm.chevRx, row.y + 6);
        // pip scale
        ctx.textAlign = 'center';
        for (let g = -3; g <= 5; g++) {
          const px = gm.pipX(g);
          const on = g <= this.grace && g < 0 ? true : g >= 0 && g <= this.grace;
          ctx.globalAlpha = g === this.grace ? 1 : on ? 0.55 : 0.18;
          ctx.fillStyle = g > 0 ? PAL.danger : g < 0 ? PAL.spirit : PAL.gold;
          const sz = g === this.grace ? 4 : 2.4;
          ctx.beginPath(); ctx.arc(px, row.y + 1, sz, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.textAlign = 'center';
    ctx.font = body(12, 500);
    ctx.fillStyle = 'rgba(154,143,116,0.65)';
    ctx.fillText(
      this.input.isTouch ? 'tap a row to change it \u00b7 tap anywhere else to begin'
                         : '\u2190 \u2192 or click to change \u00b7 the trial is recorded with your grade',
      cx, rows[2].y + 30,
    );
  }

  if (!this.input.isTouch) {
    ctx.font = body(15, 500);
    ctx.fillStyle = 'rgba(154,143,116,0.7)';
    ctx.fillText('WASD move \u00b7 SPACE roll \u00b7 J slash \u00b7 K heavy \u00b7 F flask', cx, this.h * 0.655);
  }
  if (this.wins > 0 || this.bestTime > 0) {
    ctx.font = body(15, 500);
    ctx.fillStyle = 'rgba(201,169,89,0.75)';
    const bm = Math.floor(this.bestTime / 60), bs2 = Math.floor(this.bestTime % 60);
    const parts: string[] = [];
    if (this.wins > 0) parts.push(`${this.wins} victor${this.wins === 1 ? 'y' : 'ies'}`);
    if (this.bestTime > 0) parts.push(`best ${bm}:${bs2.toString().padStart(2, '0')}`);
    ctx.fillText(parts.join('   \u00b7   '), cx, this.h * 0.60 + 26);
  }
  ctx.font = body(13, 400);
  ctx.fillStyle = 'rgba(154,143,116,0.55)';
  ctx.fillText('headphones advised \u00b7 the sovereign does not forgive', cx, this.h - 26);
};

(Game.prototype as any).drawIntro = function drawIntro(this: Game, ctx: CanvasRenderingContext2D) {
  const t = this.stateT;
  if (t > 2.2) return;
  const a = t < 0.4 ? t / 0.4 : t > 1.8 ? clamp((2.2 - t) / 0.4, 0, 1) : 1;
  ctx.globalAlpha = a;
  // dark band
  ctx.fillStyle = 'rgba(5,4,3,0.72)';
  ctx.fillRect(0, this.h * 0.3, this.w, this.h * 0.2);
  ctx.strokeStyle = 'rgba(201,169,89,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, this.h * 0.3); ctx.lineTo(this.w, this.h * 0.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, this.h * 0.5); ctx.lineTo(this.w, this.h * 0.5); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = serif(clamp(this.w * 0.045, 30, 52), 900);
  ctx.fillStyle = PAL.parchment;
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 12;
  ctx.fillText('MALAKAR', this.w / 2, this.h * 0.42);
  ctx.font = body(clamp(this.w * 0.02, 15, 20), 500);
  ctx.fillStyle = PAL.gold;
  ctx.shadowBlur = 0;
  ctx.fillText('A S H E N   S O V E R E I G N', this.w / 2, this.h * 0.465);
  ctx.globalAlpha = 1;
};

(Game.prototype as any).drawDeath = function drawDeath(this: Game, ctx: CanvasRenderingContext2D) {
  const t = this.stateT;
  const fade = clamp(t / 1.2, 0, 1);
  ctx.fillStyle = `rgba(10,2,2,${fade * 0.72})`;
  ctx.fillRect(0, 0, this.w, this.h);
  if (t < 0.7) return;
  const a = clamp((t - 0.7) / 0.9, 0, 1);
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  const size = clamp(this.w * 0.075, 40, 84);
  ctx.font = serif(size, 400);
  ctx.fillStyle = '#8f1f1f';
  ctx.shadowColor = 'rgba(143,31,31,0.7)';
  ctx.shadowBlur = 26;
  // letterspaced
  const word = 'YOU DIED';
  const spaced = word.split('').join('  ');
  ctx.fillText(spaced, this.w / 2, this.h * 0.44);
  ctx.shadowBlur = 0;
  ctx.font = body(18, 500);
  ctx.fillStyle = PAL.parchmentDim;
  const bossPct = Math.max(1, Math.ceil((this.boss.hp / this.boss.maxHp) * 100));
  ctx.fillText(`attempt ${this.attempts}  \u00b7  the sovereign stood at ${bossPct}%`, this.w / 2, this.h * 0.44 + size * 0.7);
  if (t > 1.6) {
    ctx.globalAlpha = a * (0.55 + Math.sin(this.time * 3) * 0.4);
    ctx.font = serif(17, 600);
    ctx.fillStyle = PAL.goldBright;
    ctx.fillText(this.input.isTouch ? 'touch to rise again' : 'click to rise again', this.w / 2, this.h * 0.44 + size * 0.7 + 46);
  }
  ctx.globalAlpha = 1;
};

(Game.prototype as any).drawVictory = function drawVictory(this: Game, ctx: CanvasRenderingContext2D) {
  const t = this.stateT;
  if (t < 1.1) return; // slow-mo plays first
  const fade = clamp((t - 1.1) / 1, 0, 1);
  ctx.fillStyle = `rgba(6,5,3,${fade * 0.66})`;
  ctx.fillRect(0, 0, this.w, this.h);
  const a = clamp((t - 1.5) / 0.8, 0, 1);
  if (a <= 0) return;
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  const size = clamp(this.w * 0.052, 30, 60);
  ctx.font = serif(size, 400);
  ctx.fillStyle = PAL.goldBright;
  ctx.shadowColor = 'rgba(240,215,140,0.55)';
  ctx.shadowBlur = 30;
  ctx.fillText('GREAT ENEMY FELLED', this.w / 2, this.h * 0.4);
  ctx.shadowBlur = 0;

  // grade seal
  {
    const gx = this.w / 2, gy = this.h * 0.4 + size * 0.9 + 8;
    const gcol = this.grade === 'S' ? PAL.goldBright : this.grade === 'A' ? PAL.gold : this.grade === 'B' ? PAL.parchment : PAL.parchmentDim;
    const pop = 1 + Math.max(0, 0.35 - (t - 1.5)) * 1.6;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.scale(pop, pop);
    ctx.strokeStyle = gcol;
    ctx.globalAlpha = a * 0.8;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.stroke();
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(0, 0, 36, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = a;
    ctx.font = serif(34, 900);
    ctx.fillStyle = gcol;
    if (this.grade === 'S') { ctx.shadowColor = gcol; ctx.shadowBlur = 22; }
    ctx.fillText(this.grade, 0, 12);
    ctx.font = body(11, 600);
    ctx.fillText(this.graceAtStart > 0 ? `+${this.graceAtStart}` : `${this.graceAtStart}`, 0, 26);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  ctx.font = body(19, 500);
  ctx.fillStyle = PAL.parchment;
  const mins = Math.floor(this.fightTime / 60), secs = Math.floor(this.fightTime % 60);
  const bestForTrial = this.bests[String(this.graceAtStart)] ?? this.bestTime;
  const bm = Math.floor(bestForTrial / 60), bs2 = Math.floor(bestForTrial % 60);
  const stats = [
    `trial \u2014 ${this.graceLabel(this.graceAtStart)}`,
    `time \u2014 ${mins}:${secs.toString().padStart(2, '0')}${this.newRecord ? '  \u2726 new record' : `   (best ${bm}:${bs2.toString().padStart(2, '0')})`}`,
    `attempts \u2014 ${this.attempts}`,
    `damage dealt \u2014 ${Math.round(this.damageDealt)}`,
    `wounds taken \u2014 ${this.hitsTaken}`,
  ];
  stats.forEach((s, i) => ctx.fillText(s, this.w / 2, this.h * 0.4 + size * 0.9 + 62 + i * 26));
  if (t > 2.4) {
    ctx.globalAlpha = a * (0.55 + Math.sin(this.time * 3) * 0.4);
    ctx.font = serif(16, 600);
    ctx.fillStyle = PAL.gold;
    ctx.fillText(this.input.isTouch ? 'touch to face him again' : 'click to face him again', this.w / 2, this.h * 0.4 + size * 0.9 + 62 + stats.length * 26 + 30);
  }
  ctx.globalAlpha = 1;
};

(Game.prototype as any).drawTouchUI = function drawTouchUI(this: Game, ctx: CanvasRenderingContext2D) {
  // joystick
  if (this.input.joyActive) {
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = PAL.parchment;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.input.joyOx, this.input.joyOy, 52, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = PAL.parchment;
    ctx.beginPath(); ctx.arc(this.input.joyOx + this.input.joyX * 52, this.input.joyOy + this.input.joyY * 52, 22, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // buttons
  ctx.textAlign = 'center';
  for (const b of TOUCH_BTNS) {
    const bx = this.w + b.dx, by = this.h + b.dy;
    const active = this.input.btnPressed[b.id];
    ctx.globalAlpha = active ? 0.6 : 0.22;
    ctx.fillStyle = b.id === 'flask' ? PAL.gold : '#d8cdb2';
    ctx.beginPath(); ctx.arc(bx, by, b.r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = PAL.parchment;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(bx, by, b.r, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#0d0b08';
    ctx.font = serif(b.r > 40 ? 14 : 11, 700);
    ctx.fillText(b.label, bx, by + 4);
    ctx.globalAlpha = 1;
  }
  // flask count near button
  const fb = TOUCH_BTNS[3];
  ctx.fillStyle = PAL.goldBright;
  ctx.font = serif(13, 700);
  ctx.fillText(`×${this.player.flasks}`, this.w + fb.dx, this.h + fb.dy - fb.r - 8);
};

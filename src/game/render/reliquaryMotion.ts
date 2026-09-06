// Presentation-only motion. The combat snapshot is read-only; no animation
// event may award damage, move a collider, or advance the simulation clock.
export const JOINTS = ['Pelvis', 'Torso', 'Head', 'Cape', 'Arm_L', 'Arm_R',
  'Forearm_L', 'Forearm_R', 'Leg_L', 'Leg_R', 'Knee_L', 'Knee_R', 'Foot_L',
  'Foot_R', 'Sword_R', 'Sword_L'] as const;
type Joint = typeof JOINTS[number];
type Vec = [number, number, number];
export interface MotionInput {
  kind: 'kiteveil' | 'malakar'; time: number; x: number; y: number;
  vx: number; vy: number; facing: number; state: string; remaining: number;
  attack?: string; combo?: number; windup?: number; charging?: boolean;
  charge?: number; rollDir?: number; phase?: number; reduced?: boolean;
}
export interface MotionPose {
  joints: Record<Joint, Vec>; pelvis: Vec; root: Vec; rootRotation: Vec;
  facing: number; gait: number; speed: number; age: number;
}
const TAU = Math.PI * 2;
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const angle = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

/** Two-bone sagittal IK: upper .48m, lower .42m, ankle .12m above sole. */
export function solveLeg(height: number, forward: number) {
  const upper = .48, lower = .42;
  const distance = clamp(Math.hypot(height, forward), .18, upper + lower - .003);
  const knee = -Math.acos(clamp((distance * distance - upper * upper - lower * lower) / (2 * upper * lower), -1, 1));
  const hip = Math.atan2(forward, height) + Math.acos(clamp((upper * upper + distance * distance - lower * lower) / (2 * upper * distance), -1, 1));
  return { hip, knee, ankle: -hip - knee };
}

// Cubic interpolation between authored silhouette keys. Each key is [time,
// shoulder yaw, shoulder pitch, torso twist, torso lean, elbow, wrist].
type Key = [number, number, number, number, number, number, number];
function gesture(pose: MotionPose, progress: number, keys: Key[], reverse = 1) {
  let i = 1;
  while (i < keys.length - 1 && progress > keys[i][0]) i++;
  const a = keys[i - 1], b = keys[i];
  const t = smooth((progress - a[0]) / (b[0] - a[0]));
  const v = (n: number) => mix(a[n], b[n], t);
  pose.joints.Arm_R = [v(2), -v(1) * reverse, .12];
  pose.joints.Torso[1] -= v(3) * reverse;
  pose.joints.Torso[0] += v(4);
  pose.joints.Forearm_R[0] = v(5);
  pose.joints.Sword_R[0] = v(6);
  pose.joints.Head[1] += v(3) * reverse * .55; // eyes stay on the threat
  pose.joints.Arm_L = [-.5 - Math.abs(v(3)) * .5, -.2 * reverse, -.18];
  pose.joints.Forearm_L[0] = -.85;
}
const CUT: Key[] = [
  [0, -.2, -.45, -.05, 0, -.7, -2.5],
  [.3, -1.2, -.9, -.5, -.12, -1.2, -2.5],
  [.52, -.8, -.95, -.28, -.05, -.9, -2.9],
  [.78, 1.25, -.7, .65, .24, -.28, -2.0],
  [1, .4, -.55, .15, .08, -.65, -2.5],
];
const CRUSH: Key[] = [
  [0, -.2, -.5, 0, .03, -.6, -2.5],
  [.6, -.6, -2.3, -.35, -.23, -.7, -3.0],
  [.68, -.5, -2.15, -.3, -.18, -.55, -2.8],
  [.86, .5, -.4, .4, .62, -.25, -2.2],
  [1, .25, -.25, .1, .2, -.5, -2.4],
];

export class CharacterMotion {
  private lastTime: number | null = null;
  private lastX = 0; private lastY = 0;
  private phase = 0; private speed = 0; private travel = 0;
  private facing = 0; private key = ''; private entered = 0;
  private previous: MotionPose | null = null;
  private blendFrom: MotionPose | null = null;
  private lastAttack = '';

  reset() { this.lastTime = null; this.previous = null; this.blendFrom = null; }

  sample(s: Readonly<MotionInput>): MotionPose {
    const reset = this.lastTime === null || s.time < this.lastTime || s.time - this.lastTime > .5;
    const dt = reset ? 0 : Math.max(0, s.time - this.lastTime!);
    const key = `${s.state}:${s.state === 'light' ? s.combo : ''}:${s.attack ?? ''}`;
    const locomoting = s.state === 'move' || s.state === 'stalk' || s.state === 'flask';
    const targetSpeed = locomoting ? Math.hypot(s.vx, s.vy) : 0;
    if (reset) {
      this.phase = 0; this.speed = targetSpeed; this.facing = s.facing;
      this.key = key; this.entered = s.time; this.blendFrom = null;
      this.travel = Math.atan2(s.vy, s.vx);
    } else {
      this.speed = mix(this.speed, targetSpeed, 1 - Math.exp(-dt * 13));
      // Distance drives footfalls; parked actors do not march to a global sine.
      const distance = Math.hypot(s.x - this.lastX, s.y - this.lastY);
      if (locomoting && distance < 90) this.phase += distance / (s.kind === 'malakar' ? 140 : 74) * TAU;
      if (targetSpeed > 8) this.travel += angle(Math.atan2(s.vy, s.vx) - this.travel) * (1 - Math.exp(-dt * 18));
      if (key !== this.key) {
        this.blendFrom = this.previous; this.entered = s.time; this.key = key;
      }
      // Locomotion turns settle with weight. Attacks keep authoritative facing.
      this.facing += angle(s.facing - this.facing) * (locomoting ? 1 - Math.exp(-dt * 20) : 1);
    }
    if (s.attack) this.lastAttack = s.attack;
    this.lastTime = s.time; this.lastX = s.x; this.lastY = s.y;
    const age = Math.max(0, s.time - this.entered);
    const joints = Object.fromEntries(JOINTS.map(name => [name, [0, 0, 0]])) as Record<Joint, Vec>;
    const pose: MotionPose = { joints, pelvis: [0, 0, 0], root: [0, 0, 0], rootRotation: [0, 0, 0], facing: this.facing, gait: this.phase, speed: this.speed, age };
    const boss = s.kind === 'malakar';
    const motion = s.reduced ? .3 : 1;
    const breath = Math.sin(s.time * (boss ? 1.9 : 2.7));
    const weight = clamp(this.speed / (boss ? 75 : 180));
    const yaw = angle(s.facing - this.facing);
    const travel = angle(this.travel - this.facing);
    const bob = Math.cos(this.phase * 2) * .028 * weight;
    pose.pelvis = [Math.sin(this.phase) * .035 * weight, -.018 - weight * .065 + bob + breath * .006 * motion, 0];
    joints.Pelvis[1] = Math.sin(this.phase) * .085 * weight;
    joints.Pelvis[2] = Math.sin(this.phase) * .065 * weight;
    joints.Torso = [.06 + .17 * weight + breath * .035 * motion, -joints.Pelvis[1] * .8, -joints.Pelvis[2] * .6];
    joints.Head = [-.03 - breath * .025 * motion, -yaw * .45 + Math.sin(s.time * .63) * .045 * motion, 0];
    joints.Arm_L = [-.22 - Math.sin(this.phase) * .4 * weight, -.1, -.13];
    joints.Arm_R = [-.42 + Math.sin(this.phase) * .24 * weight, .12, .13];
    joints.Forearm_L[0] = -.7 + Math.sin(this.phase + .45) * .18 * weight;
    joints.Forearm_R[0] = -.8 - Math.sin(this.phase + .45) * .15 * weight;
    joints.Sword_R[0] = -2.8 + Math.sin(s.time * 2.7 - .5) * .035 * motion;
    joints.Sword_L[0] = -2.65;
    joints.Cape = [.07 + weight * .2 + Math.sin(s.time * 2.5 - .7) * .045 * motion, -yaw * .3, Math.sin(this.phase - .6) * .07 * weight];
    for (const [index, side] of (['L', 'R'] as const).entries()) {
      const cycle = ((this.phase / TAU + index * .5) % 1 + 1) % 1;
      const stance = cycle < .6;
      const u = stance ? cycle / .6 : (cycle - .6) / .4;
      const step = (stance ? mix(.30, -.30, u) : mix(-.30, .30, smooth(u))) * weight;
      const lift = stance ? 0 : Math.sin(u * Math.PI) * .22 * weight;
      const footForward = step * Math.cos(travel) + (index ? -.055 : .055) * (1 - weight);
      const height = .9 + pose.pelvis[1] - lift;
      const leg = solveLeg(height, footForward);
      joints[`Leg_${side}`] = [leg.hip, 0, Math.atan2(step * Math.sin(travel) - pose.pelvis[0], height)];
      joints[`Knee_${side}`][0] = leg.knee;
      joints[`Foot_${side}`][0] = leg.ankle + (stance ? Math.max(0, u - .7) * .5 * weight : -.12 * Math.sin(u * Math.PI));
    }
    if (!boss) this.player(pose, s);
    else this.boss(pose, s, age);
    // Upper-body gesture keys use forward flexion negative. glTF's front is
    // -Z, so shoulder/elbow flexion is +X and torso/chin forward lean is -X.
    // Legs are solved directly in glTF space; wrists already encode blade aim.
    for (const name of ['Torso', 'Head', 'Arm_L', 'Arm_R', 'Forearm_L', 'Forearm_R'] as const) joints[name][0] *= -1;
    // Short inertial entry from the last rendered pose; never delay the release
    // or damage window. Roll has its own continuous tuck/recovery curve.
    const blendDuration = s.state === 'move' || s.state === 'stalk' ? .16 : .065;
    const blend = smooth(age / blendDuration);
    if (this.blendFrom && blend < 1 && s.state !== 'roll' && s.state !== 'strike') {
      for (const name of JOINTS) for (let axis = 0; axis < 3; axis++) {
        joints[name][axis] = mix(this.blendFrom.joints[name][axis], joints[name][axis], blend);
      }
      for (let axis = 0; axis < 3; axis++) pose.pelvis[axis] = mix(this.blendFrom.pelvis[axis], pose.pelvis[axis], blend);
    }
    this.previous = pose;
    return pose;
  }

  private player(p: MotionPose, s: Readonly<MotionInput>) {
    const j = p.joints;
    if (['light', 'sunder', 'rollSlash', 'heavy'].includes(s.state)) {
      const total = s.state === 'heavy' ? .62 : s.state === 'sunder' ? .48 : s.state === 'rollSlash' ? .3 : s.combo === 2 ? .44 : .32;
      const progress = clamp(1 - s.remaining / total);
      gesture(p, progress, s.state === 'heavy' ? CRUSH : CUT, s.combo === 1 || s.state === 'sunder' ? -1 : 1);
      p.pelvis[1] -= Math.sin(progress * Math.PI) * .055;
      j.Leg_L[0] += Math.sin(progress * Math.PI) * .14;
      j.Leg_R[0] -= Math.sin(progress * Math.PI) * .1;
      if (s.charging) {
        gesture(p, .6, CRUSH);
        const strain = Math.sin(s.time * 34) * .018 * (s.reduced ? .2 : 1);
        j.Arm_R[0] += strain; j.Torso[0] += strain * .4;
        j.Arm_L = [-1.45, -.5, -.3]; j.Forearm_L[0] = -1.4;
      }
    }
    if (s.state === 'roll') {
      const t = clamp(1 - s.remaining / .42), tuck = Math.sin(Math.PI * t);
      const roll = -smooth(t) * TAU;
      p.facing = s.rollDir ?? s.facing;
      p.rootRotation[0] = roll;
      p.root = [0, 1.05 * (1 - Math.cos(roll)) + .12 * tuck, -1.05 * Math.sin(roll)];
      j.Torso[0] = .75 * tuck; j.Head[0] = .45 * tuck;
      j.Leg_L[0] = 1.4 * tuck; j.Leg_R[0] = 1.25 * tuck;
      j.Knee_L[0] = -2.1 * tuck; j.Knee_R[0] = -2.0 * tuck;
      j.Arm_L[0] = -.8; j.Arm_R[0] = -.8;
      j.Forearm_L[0] = -1.4; j.Forearm_R[0] = -1.4;
    }
    if (s.state === 'flask') {
      const t = clamp(1 - s.remaining), lift = smooth(t / .22) * (1 - smooth((t - .7) / .3));
      j.Arm_L[0] = mix(-.2, -1.25, lift); j.Forearm_L[0] = mix(-.7, -1.7, lift);
      j.Head[0] -= lift * .16; j.Torso[2] += lift * .06;
    }
    if (s.state === 'stagger') {
      const t = clamp(1 - s.remaining / .32), recoil = Math.sin(Math.PI * t) * Math.exp(-t);
      j.Torso[0] -= .55 * recoil; j.Head[0] += .25 * recoil;
      j.Arm_L[2] -= .45 * recoil; j.Arm_R[2] += .45 * recoil;
    }
    if (s.state === 'dead') {
      const fall = smooth(p.age / .7);
      j.Torso[0] = .7 * fall; j.Knee_L[0] = -1.3 * fall; j.Knee_R[0] = -1.6 * fall;
      p.rootRotation[2] = fall * 1.4; p.root[1] = -.65 * fall;
    }
  }

  private boss(p: MotionPose, s: Readonly<MotionInput>, age: number) {
    const j = p.joints, attack = s.attack ?? this.lastAttack;
    const overhead = attack === 'slam' || attack === 'meteor';
    if (s.state === 'windup') {
      const windup = smooth(s.windup ?? 0);
      if (attack === 'swipe') gesture(p, windup * .52, CUT);
      else if (overhead) gesture(p, windup * .68, CRUSH);
      else if (attack === 'charge') {
        j.Torso[0] = .08 + .5 * windup; j.Head[0] = -.2 * windup;
        j.Arm_R = [-.6, -.9 * windup, .12]; j.Forearm_R[0] = -.7;
        p.pelvis[1] -= .1 * windup;
      } else {
        j.Arm_L[2] = -1.2 * windup; j.Arm_R[2] = 1.2 * windup;
        j.Forearm_L[0] = -1.2; j.Forearm_R[0] = -1.2;
        j.Torso[0] = -.14 * windup; j.Head[0] = -.13 * windup;
      }
    }
    if (s.state === 'strike' || s.state === 'recover') {
      const striking = s.state === 'strike';
      if (attack === 'swipe' || attack === 'slam') {
        const release = striking ? clamp(1 - s.remaining / (overhead ? .06 : .1)) : 1;
        gesture(p, mix(overhead ? .68 : .52, .91, smooth(release)), overhead ? CRUSH : CUT);
        if (!striking) {
          const settle = smooth(age / .32);
          for (const name of ['Torso', 'Arm_R', 'Forearm_R'] as const) for (let axis = 0; axis < 3; axis++) j[name][axis] *= 1 - settle * .6;
          j.Torso[0] += Math.sin(age * 14) * Math.exp(-age * 10) * .07;
        }
      } else if (attack === 'charge') {
        j.Torso[0] = striking ? .62 : .32 * Math.exp(-age * 5);
        j.Head[0] = -.27; j.Arm_R[1] = -.65;
        j.Leg_L[0] += Math.sin(s.time * 20) * .25; j.Leg_R[0] -= Math.sin(s.time * 20) * .25;
      } else {
        const pulse = Math.sin(s.time * 5) * .09 * (s.reduced ? .2 : 1);
        j.Arm_L[2] = -1.0 - pulse; j.Arm_R[2] = 1.0 + pulse;
        j.Forearm_L[0] = -1.25; j.Forearm_R[0] = -1.25;
        j.Torso[1] = Math.sin(s.time * 2) * .18;
      }
    }
    if (s.state === 'staggered') {
      const collapse = smooth(age / .18);
      p.pelvis[1] -= .18 * collapse; j.Torso[0] = .6 * collapse;
      j.Head[0] = .25 + Math.sin(s.time * 3) * .04;
      j.Knee_L[0] -= .55 * collapse; j.Knee_R[0] -= .35 * collapse;
      j.Arm_R[0] = -.12; j.Forearm_R[0] = -.2; j.Sword_R[0] = -2.1;
    }
    if (s.state === 'dying') {
      const fall = smooth(age / 1.2);
      p.pelvis[1] -= .45 * fall; j.Torso[0] = .7 * fall;
      j.Knee_L[0] = -1.7 * fall; j.Knee_R[0] = -1.4 * fall; j.Head[0] = .4 * fall;
      p.rootRotation[2] = smooth((age - .6) / 1.1) * .85;
    }
    if ((s.phase ?? 1) >= 3) {
      j.Arm_L[0] -= .25;
      j.Arm_L[1] = -j.Arm_R[1] * .65;
      j.Forearm_L[0] = j.Forearm_R[0] * .8;
    }
  }
}

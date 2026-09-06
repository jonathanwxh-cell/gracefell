import { describe, expect, it } from 'vitest';
import { CharacterMotion, solveLeg, type MotionInput } from './reliquaryMotion';

const base: MotionInput = { kind: 'kiteveil', time: 0, x: 0, y: 0, vx: 0, vy: 0,
  facing: 0, state: 'move', remaining: 0 };
describe('articulated character motion', () => {
  it('places a level ankle at the requested planted-foot point', () => {
    for (const forward of [-.25, 0, .25]) {
      const leg = solveLeg(.82, forward);
      expect(.48 * Math.cos(leg.hip) + .42 * Math.cos(leg.hip + leg.knee)).toBeCloseTo(.82, 7);
      expect(.48 * Math.sin(leg.hip) + .42 * Math.sin(leg.hip + leg.knee)).toBeCloseTo(forward, 7);
      expect(leg.hip + leg.knee + leg.ankle).toBeCloseTo(0, 10);
    }
  });
  it('breathes at rest without walking in place', () => {
    const motion = new CharacterMotion();
    const first = motion.sample(base);
    let last = first;
    for (let i = 1; i <= 30; i++) last = motion.sample({ ...base, time: i / 60 });
    expect(last.gait).toBe(0);
    expect(last.joints.Torso[0]).not.toBeCloseTo(first.joints.Torso[0], 3);
    expect(last.joints.Head[0]).not.toBe(first.joints.Head[0]);
  });
  it('drives strides by distance and is invariant to repeated render calls', () => {
    const a = new CharacterMotion(), b = new CharacterMotion();
    let lastA = a.sample(base), lastB = b.sample(base);
    for (let i = 1; i <= 60; i++) {
      const s = Object.freeze({ ...base, time: i / 60, x: i * 2, vx: 120 });
      lastA = a.sample(s);
      lastB = b.sample(s);
      expect(b.sample(s)).toEqual(lastB);
      expect(b.sample(s)).toEqual(lastB);
    }
    expect(lastA).toEqual(lastB);
    expect(lastA.gait).toBeCloseTo(120 / 74 * Math.PI * 2, 8);
    expect(lastA.joints.Knee_L[0]).not.toBe(lastA.joints.Knee_R[0]);
    expect(a.sample({ ...base, time: 0 }).gait).toBe(0);
  });
  it('uses distinct continuous light, heavy and boss-release poses', () => {
    const poses = ['light', 'heavy', 'sunder'].map(state => {
      const motion = new CharacterMotion();
      return motion.sample({ ...base, state, remaining: .1 });
    });
    expect(poses[0].joints.Arm_R).not.toEqual(poses[1].joints.Arm_R);
    expect(poses[0].joints.Torso).not.toEqual(poses[2].joints.Torso);
    const boss = new CharacterMotion();
    const a = boss.sample({ ...base, kind: 'malakar', state: 'strike', attack: 'swipe', remaining: .095 });
    const b = boss.sample({ ...base, kind: 'malakar', time: .06, state: 'strike', attack: 'swipe', remaining: .035 });
    expect(Math.abs(b.joints.Arm_R[1] - a.joints.Arm_R[1])).toBeGreaterThan(.8);
  });
  it('softens incidental motion and remains finite in every state', () => {
    const full = new CharacterMotion().sample({ ...base, time: .4 });
    const reduced = new CharacterMotion().sample({ ...base, time: .4, reduced: true });
    expect(Math.abs(reduced.joints.Torso[0] + .06)).toBeLessThan(Math.abs(full.joints.Torso[0] + .06));
    for (const state of ['move','light','heavy','sunder','rollSlash','roll','flask','stagger','dead','windup','strike','recover','staggered','dying']) {
      for (const kind of ['kiteveil', 'malakar'] as const) {
        const pose = new CharacterMotion().sample({ ...base, kind, state, time: 4, remaining: .08, attack: 'slam', windup: .7, phase: 3 });
        expect(Object.values(pose.joints).flat().every(Number.isFinite)).toBe(true);
      }
    }
  });
});

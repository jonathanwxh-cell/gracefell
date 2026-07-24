import { describe, it, expect } from 'vitest';
import {
  clamp, lerp, dist, angTo, angDiff, TAU, seededRandom,
  difficultyForGrace, isScoreHistoryEntry, isVictoryScore,
} from './engine';

describe('math helpers', () => {
  it('clamp keeps values within [a, b]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
  it('lerp interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });
  it('dist is euclidean', () => {
    expect(dist(0, 0, 3, 4)).toBe(5);
    expect(dist(1, 1, 1, 1)).toBe(0);
  });
  it('angTo points from a toward b', () => {
    expect(angTo(0, 0, 1, 0)).toBeCloseTo(0);
    expect(angTo(0, 0, 0, 1)).toBeCloseTo(Math.PI / 2);
    expect(angTo(0, 0, -1, 0)).toBeCloseTo(Math.PI);
  });
  it('angDiff wraps into [-PI, PI]', () => {
    expect(angDiff(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(angDiff(0, TAU)).toBeCloseTo(0);
    expect(Math.abs(angDiff(0, Math.PI + 0.1))).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});

describe('seededRandom is deterministic', () => {
  it('same seed produces the same [0,1) sequence', () => {
    const a = seededRandom(0xC0FFEE);
    const b = seededRandom(0xC0FFEE);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
    for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('different seeds diverge', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

describe('difficultyForGrace — the published balance contract (README table)', () => {
  it('MEASURED (0) is canonical', () => {
    expect(difficultyForGrace(0)).toMatchObject({
      bossSpeed: 1, dmgTaken: 1, iframe: 1, perfectWindow: 1, flasks: 3,
      poiseMul: 1, staggerDuration: 1.7, noStagger: false, clearTells: false,
      chainRank: 0, recoveryMul: 1,
    });
  });
  it('JOURNEY -2 is aided: 4 flasks, named tells, slower + softer, wider windows', () => {
    const m = difficultyForGrace(-2);
    expect(m.flasks).toBe(4);
    expect(m.clearTells).toBe(true);
    expect(m.bossSpeed).toBeCloseTo(1 - (2 / 3) * 0.22);
    expect(m.dmgTaken).toBeCloseTo(0.7);
    expect(m.iframe).toBeGreaterThan(1);
    expect(m.perfectWindow).toBeGreaterThan(1);
  });
  it('Oath ranks match the published rows', () => {
    expect(difficultyForGrace(1)).toMatchObject({ bossSpeed: 1.04, dmgTaken: 1.05, flasks: 3, chainRank: 1 });
    expect(difficultyForGrace(2)).toMatchObject({ bossSpeed: 1.1, dmgTaken: 1.13, flasks: 2 });
    expect(difficultyForGrace(3)).toMatchObject({ poiseMul: 1.35, staggerDuration: 1.45, chainRank: 2, flasks: 2 });
    expect(difficultyForGrace(4)).toMatchObject({ poiseMul: 1.7, staggerDuration: 1.25 });
    expect(difficultyForGrace(5)).toMatchObject({ noStagger: true, flasks: 1, chainRank: 3 });
  });
  it('clamps out-of-range grace to [-3, 5]', () => {
    expect(difficultyForGrace(-99)).toEqual(difficultyForGrace(-3));
    expect(difficultyForGrace(99)).toEqual(difficultyForGrace(5));
  });
});

describe('isVictoryScore — save-schema v4 validator', () => {
  const valid = { grade: 'S', time: 42.5, trial: 0, attempt: 1, damageDealt: 1350, woundsTaken: 0 };
  it('accepts a valid v4 score (with and without optional fields)', () => {
    expect(isVictoryScore(valid)).toBe(true);
    expect(isVictoryScore({ ...valid, perfectDodges: 3, flasksUsed: 2, oathRank: 2 })).toBe(true);
  });
  it('rejects non-objects', () => {
    expect(isVictoryScore(null)).toBe(false);
    expect(isVictoryScore(undefined)).toBe(false);
    expect(isVictoryScore('S')).toBe(false);
  });
  it('rejects malformed or out-of-range fields', () => {
    expect(isVictoryScore({ ...valid, grade: 5 })).toBe(false);
    expect(isVictoryScore({ ...valid, time: -1 })).toBe(false);
    expect(isVictoryScore({ ...valid, trial: 9 })).toBe(false);
    expect(isVictoryScore({ ...valid, attempt: 0 })).toBe(false);
    expect(isVictoryScore({ ...valid, oathRank: 9 })).toBe(false);
  });
});

describe('isScoreHistoryEntry — save-schema v6 history validator', () => {
  const valid = {
    grade: 'A',
    time: 73.2,
    trial: -2,
    attempt: 3,
    damageDealt: 1250,
    woundsTaken: 2,
  };

  it('accepts new ISO timestamps and honest legacy null dates', () => {
    expect(isScoreHistoryEntry({ ...valid, completedAt: '2026-07-24T02:15:00.000Z' })).toBe(true);
    expect(isScoreHistoryEntry({ ...valid, completedAt: null })).toBe(true);
  });

  it('rejects missing, empty, and invalid completion dates', () => {
    expect(isScoreHistoryEntry(valid)).toBe(false);
    expect(isScoreHistoryEntry({ ...valid, completedAt: '' })).toBe(false);
    expect(isScoreHistoryEntry({ ...valid, completedAt: 'after the battle' })).toBe(false);
  });
});

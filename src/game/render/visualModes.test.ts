import { describe, expect, it } from 'vitest';
import { parseVisualProofFlags } from './visualModes';

describe('visual proof query flags', () => {
  it('uses the accepted Canvas-first treatment by default', () => {
    expect(parseVisualProofFlags('')).toEqual({
      arena: 'arena-bake',
      boss: 'blender-canvas',
    });
  });

  it('keeps every comparison mode explicitly selectable', () => {
    expect(parseVisualProofFlags('?visual=arena-bake')).toEqual({
      arena: 'arena-bake',
      boss: 'blender-canvas',
    });
    expect(parseVisualProofFlags('?boss=blender-canvas')).toEqual({
      arena: 'arena-bake',
      boss: 'blender-canvas',
    });
    expect(parseVisualProofFlags('?boss=blender-three&visual=arena-bake')).toEqual({
      arena: 'arena-bake',
      boss: 'blender-three',
    });
    expect(parseVisualProofFlags('?visual=procedural&boss=current')).toEqual({
      arena: 'procedural',
      boss: 'current',
    });
  });

  it('falls back deterministically for stale or misspelled values', () => {
    expect(parseVisualProofFlags('?boss=three&visual=bake')).toEqual({
      arena: 'arena-bake',
      boss: 'blender-canvas',
    });
    expect(parseVisualProofFlags('?boss=&visual=arena-bake-extra')).toEqual({
      arena: 'arena-bake',
      boss: 'blender-canvas',
    });
  });
});

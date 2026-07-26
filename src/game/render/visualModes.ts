export type ArenaVisualMode = 'procedural' | 'arena-bake';
export type BossVisualMode = 'current' | 'blender-canvas' | 'blender-three';

// `/art/` is served with immutable caching. Every changed shipping asset must
// bump this token so an older CDN/browser response cannot survive a release.
export const VISUAL_ASSET_VERSION = 'v225-2';

export type BossVisualState =
  | 'spawn'
  | 'stalk'
  | 'windup'
  | 'strike'
  | 'recover'
  | 'staggered'
  | 'dying';

export type BossVisualAttack =
  | 'swipe'
  | 'slam'
  | 'charge'
  | 'volley'
  | 'meteor'
  | 'ring'
  | 'spiral';

export interface VisualProofFlags {
  arena: ArenaVisualMode;
  boss: BossVisualMode;
}

export interface MalakarVisualSnapshot {
  x: number;
  y: number;
  r: number;
  facing: number;
  phase: number;
  state: BossVisualState;
  attack: BossVisualAttack;
  windupProgress: number;
  hurtFlash: number;
  haloSpent: number;
  secondSwordDraw: number;
  recoil: number;
  recoilAng: number;
  time: number;
}

const BOSS_MODES = new Set<BossVisualMode>([
  'current',
  'blender-canvas',
  'blender-three',
]);

export function parseVisualProofFlags(search: string): VisualProofFlags {
  const params = new URLSearchParams(search);
  const requestedBoss = params.get('boss');
  return {
    // The accepted baked arena and Canvas Malakar are the production v2.25
    // treatment. Explicit classic flags preserve the measured v2.24 fallback;
    // live Three remains opt-in only.
    arena: params.get('visual') === 'procedural' ? 'procedural' : 'arena-bake',
    boss: requestedBoss && BOSS_MODES.has(requestedBoss as BossVisualMode)
      ? requestedBoss as BossVisualMode
      : 'blender-canvas',
  };
}

export type ArenaVisualMode = 'procedural' | 'arena-bake';
export type BossVisualMode = 'current' | 'blender-canvas' | 'blender-three' | 'reliquary-three';

// `/art/` is served with immutable caching. Every changed shipping asset must
// bump this token so an older CDN/browser response cannot survive a release.
export const VISUAL_ASSET_VERSION = 'v225-2';
export const RELIQUARY_ASSET_VERSION = 'v228-1';

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

export type MalakarTechniqueImpact = 'sunder' | 'execute';

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
  techniqueImpact: MalakarTechniqueImpact | null;
  techniqueImpactStrength: number;
  time: number;
}

const BOSS_MODES = new Set<BossVisualMode>([
  'current',
  'blender-canvas',
  'blender-three',
  'reliquary-three',
]);

export function parseVisualProofFlags(search: string): VisualProofFlags {
  const params = new URLSearchParams(search);
  const requestedBoss = params.get('boss');
  return {
    // Explicit legacy flags preserve both previous looks. The new authored
    // pair promotes together after loading, at an intro/title/pause boundary.
    arena: params.get('visual') === 'procedural' ? 'procedural' : 'arena-bake',
    boss: requestedBoss && BOSS_MODES.has(requestedBoss as BossVisualMode)
      ? requestedBoss as BossVisualMode
      : 'reliquary-three',
  };
}

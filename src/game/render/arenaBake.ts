export type ArenaBakeAssetState = 'loading' | 'ready' | 'fallback';
export type ArenaBakePhase = 2 | 3;

export interface ArenaBakeAssetDiagnostic {
  state: ArenaBakeAssetState;
  url: string;
  width: number;
  height: number;
  error: string | null;
}

export interface ArenaBakeDiagnostic {
  enabled: true;
  base: ArenaBakeAssetDiagnostic;
  phase2: ArenaBakeAssetDiagnostic;
  phase3: ArenaBakeAssetDiagnostic;
}

interface ArenaBakeAsset {
  diagnostic: ArenaBakeAssetDiagnostic;
  image: HTMLImageElement | null;
}

interface ArenaBakeCallbacks {
  onBaseReady: (image: HTMLImageElement) => void;
  onPhaseReady: (phase: ArenaBakePhase, image: HTMLImageElement) => void;
}

const ASSET_PATHS = {
  base: 'art/arena/arena-base.webp',
  phase2: 'art/arena/phase-2-mask.webp',
  phase3: 'art/arena/phase-3-mask.webp',
} as const;

export class ArenaBakeAssets {
  private destroyed = false;
  private generation = 0;
  private readonly callbacks: ArenaBakeCallbacks;
  private readonly assets: Record<keyof typeof ASSET_PATHS, ArenaBakeAsset>;

  constructor(callbacks: ArenaBakeCallbacks) {
    this.callbacks = callbacks;
    this.assets = {
      base: this.createAsset(ASSET_PATHS.base),
      phase2: this.createAsset(ASSET_PATHS.phase2),
      phase3: this.createAsset(ASSET_PATHS.phase3),
    };
    const generation = ++this.generation;
    void this.load('base', generation);
    void this.load('phase2', generation);
    void this.load('phase3', generation);
  }

  private createAsset(path: string): ArenaBakeAsset {
    const url = new URL(path, document.baseURI);
    url.searchParams.set('v', VISUAL_ASSET_VERSION);
    return {
      image: null,
      diagnostic: {
        state: 'loading',
        url: url.href,
        width: 0,
        height: 0,
        error: null,
      },
    };
  }

  private async load(key: keyof typeof ASSET_PATHS, generation: number) {
    const asset = this.assets[key];
    const image = new Image();
    image.decoding = 'async';
    image.src = asset.diagnostic.url;
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Unable to load ${ASSET_PATHS[key]}`));
      });
      if ('decode' in image) await image.decode().catch(() => undefined);
      if (this.destroyed || generation !== this.generation) return;
      asset.image = image;
      asset.diagnostic.state = 'ready';
      asset.diagnostic.width = image.naturalWidth;
      asset.diagnostic.height = image.naturalHeight;
      if (key === 'base') this.callbacks.onBaseReady(image);
      else this.callbacks.onPhaseReady(key === 'phase2' ? 2 : 3, image);
    } catch (error) {
      if (this.destroyed || generation !== this.generation) return;
      asset.diagnostic.state = 'fallback';
      asset.diagnostic.error = error instanceof Error ? error.message : String(error);
    } finally {
      image.onload = null;
      image.onerror = null;
    }
  }

  getPhaseImage(phase: ArenaBakePhase): HTMLImageElement | null {
    return this.assets[phase === 2 ? 'phase2' : 'phase3'].image;
  }

  releaseBase() {
    // Once copied into the adaptive floor cache, the 2048px source no longer
    // needs a strong reference. The two small phase masks stay available so a
    // retry can stamp them again without allocating another full-size canvas.
    this.assets.base.image = null;
  }

  markBaseFallback(error: unknown) {
    const asset = this.assets.base;
    asset.image = null;
    asset.diagnostic.state = 'fallback';
    asset.diagnostic.error = error instanceof Error ? error.message : String(error);
  }

  diagnostics(): ArenaBakeDiagnostic {
    const copy = (asset: ArenaBakeAsset): ArenaBakeAssetDiagnostic => ({ ...asset.diagnostic });
    return {
      enabled: true,
      base: copy(this.assets.base),
      phase2: copy(this.assets.phase2),
      phase3: copy(this.assets.phase3),
    };
  }

  destroy() {
    this.destroyed = true;
    this.generation++;
    for (const asset of Object.values(this.assets)) asset.image = null;
  }
}
import { VISUAL_ASSET_VERSION } from './visualModes';

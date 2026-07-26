import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  VISUAL_ASSET_VERSION,
  type MalakarVisualSnapshot,
} from './visualModes';

type ProofState = 'ready' | 'context-lost' | 'destroyed';
type ModelState = 'loading' | 'procedural-fallback' | 'asset-ready';

export interface MalakarThreeDiagnostic {
  state: ProofState;
  modelState: ModelState;
  modelUrl: string;
  renders: number;
  triangles: number;
  drawCalls: number;
  geometries: number;
  textures: number;
  canvas: { width: number; height: number };
  error: string | null;
}

interface AssetMaterialState {
  material: THREE.MeshStandardMaterial;
  color: number;
  emissive: number;
  emissiveIntensity: number;
}

const GOLD = 0xc9a959;
const GOLD_BRIGHT = 0xf0d78c;
const ARMOR = 0x2d2930;
const CAPE = 0x211c27;
const AMBER = 0xd1873f;
const PROOF_SIZE = 256;
// Fixed to the validated v225-2 GLB export. Runtime bounds normalization
// produced non-finite transforms in Chromium for the quantized Meshopt asset;
// an explicit contract is both cheaper and deterministic. Update this together
// with VISUAL_ASSET_VERSION when the authored model changes.
const AUTHORED_MODEL_PLACEMENT = {
  scale: 0.84,
  x: -0.015,
  y: -1.285,
  z: 0.092,
} as const;

const setMeshVisibility = (object: THREE.Object3D, visible: boolean) => {
  object.visible = visible;
};

function material(
  color: number,
  roughness = 0.72,
  metalness = 0.3,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function createSword(length: number) {
  const root = new THREE.Group();
  const bladeMaterial = material(0x8a817c, 0.42, 0.72);
  const guardMaterial = material(0x19171c, 0.76, 0.48);
  const goldMaterial = material(GOLD, 0.46, 0.62);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, length, 0.075), bladeMaterial);
  blade.position.y = length * 0.5 + 0.1;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 4), bladeMaterial);
  tip.position.y = length + 0.21;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.12), guardMaterial);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.36, 7), guardMaterial);
  grip.position.y = -0.22;
  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), goldMaterial);
  pommel.position.y = -0.43;
  root.add(blade, tip, guard, grip, pommel);
  return root;
}

function capeShape(side: -1 | 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-0.5, side * 0.24);
  shape.lineTo(-1.22, side * 0.55);
  shape.lineTo(-1.58, side * 0.32);
  shape.lineTo(-1.28, side * 0.06);
  shape.lineTo(-1.08, side * 0.2);
  shape.lineTo(-0.82, -side * 0.02);
  shape.lineTo(-0.55, side * 0.12);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  const capeMaterial = new THREE.MeshStandardMaterial({
    color: CAPE,
    roughness: 0.9,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, capeMaterial);
}

export class MalakarThreeProof {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly modelRoot = new THREE.Group();
  private readonly proceduralRoot = new THREE.Group();
  private readonly proceduralBody = new THREE.Group();
  private readonly assetRoot = new THREE.Group();
  private readonly capeLeft = capeShape(-1);
  private readonly capeRight = capeShape(1);
  private readonly core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private readonly swordA = createSword(1.72);
  private readonly swordB = createSword(1.58);
  private readonly halo: THREE.Mesh[] = [];
  private readonly assetMaterials: AssetMaterialState[] = [];
  private state: ProofState = 'ready';
  private modelState: ModelState = 'loading';
  private modelUrl = (() => {
    const url = new URL('art/models/malakar.glb', document.baseURI);
    url.searchParams.set('v', VISUAL_ASSET_VERSION);
    return url.href;
  })();
  private error: string | null = null;
  private renders = 0;
  private destroyed = false;
  private loadGeneration = 0;

  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    this.state = 'context-lost';
    this.error = 'WebGL context lost; Canvas fallback is active.';
  };

  private readonly onContextRestored = () => {
    if (this.destroyed) return;
    this.state = 'ready';
    this.error = null;
  };

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = PROOF_SIZE;
    this.canvas.height = PROOF_SIZE;
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false,
      depth: true,
      powerPreference: 'low-power',
      premultipliedAlpha: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(PROOF_SIZE, PROOF_SIZE, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.55;

    this.camera = new THREE.OrthographicCamera(-2.25, 2.25, 2.25, -2.25, 0.1, 30);
    this.camera.position.set(0, 3.3, 7.4);
    this.camera.lookAt(0, 0.35, 0);

    this.scene.add(new THREE.HemisphereLight(0xe7d4aa, 0x17131c, 2.15));
    const key = new THREE.DirectionalLight(0xffd990, 3.4);
    key.position.set(-3, 5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8c637d, 1.5);
    rim.position.set(4, 1, -3);
    this.scene.add(rim);

    this.scene.add(this.modelRoot);
    this.modelRoot.add(this.proceduralRoot, this.assetRoot);
    this.proceduralRoot.add(this.proceduralBody);
    this.assetRoot.visible = false;

    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.68, 1.18, 7),
      material(ARMOR, 0.58, 0.58),
    );
    torso.position.y = 0.12;
    torso.scale.z = 0.72;
    this.proceduralBody.add(torso);

    const breastplate = new THREE.Mesh(
      new THREE.ConeGeometry(0.49, 0.92, 5),
      material(0x4a4142, 0.56, 0.54),
    );
    breastplate.rotation.z = -Math.PI / 2;
    breastplate.position.set(0.32, 0.18, 0.02);
    breastplate.scale.set(0.7, 0.82, 0.72);
    this.proceduralBody.add(breastplate);

    const head = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.36, 0),
      material(0x28242b, 0.52, 0.64),
    );
    head.position.y = 0.91;
    head.scale.z = 0.82;
    this.proceduralBody.add(head);

    const visor = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.58, 4),
      material(0x373139, 0.48, 0.68),
    );
    visor.rotation.z = -Math.PI / 2;
    visor.position.set(0.34, 0.91, 0);
    this.proceduralBody.add(visor);

    const shoulderGeometry = new THREE.OctahedronGeometry(0.34, 0);
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(shoulderGeometry, material(0x3b353b, 0.6, 0.5));
      shoulder.position.set(-0.04, 0.47, side * 0.63);
      shoulder.scale.set(1.1, 0.72, 1);
      this.proceduralBody.add(shoulder);
    }

    this.capeLeft.position.set(-0.25, 0.4, -0.12);
    this.capeRight.position.set(-0.25, 0.4, 0.12);
    this.capeLeft.rotation.x = Math.PI / 2;
    this.capeRight.rotation.x = Math.PI / 2;
    this.proceduralBody.add(this.capeLeft, this.capeRight);

    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 6),
      new THREE.MeshStandardMaterial({
        color: 0xffd08a,
        emissive: AMBER,
        emissiveIntensity: 2.2,
        roughness: 0.35,
        metalness: 0.12,
        // The core is a gameplay-state read, not surface decoration. Keep it
        // legible when phase-three swords cross the chest at play scale.
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.core.renderOrder = 20;
    this.core.position.set(0.38, 0.3, 0);
    this.proceduralRoot.add(this.core);

    this.swordA.position.set(0.03, 0.2, 0.68);
    this.swordB.position.set(0.03, 0.2, -0.68);
    this.swordA.rotation.z = -0.55;
    this.swordB.rotation.z = 0.55;
    this.proceduralRoot.add(this.swordA, this.swordB);

    const haloGeometry = new THREE.OctahedronGeometry(0.11, 0);
    const haloMaterial = material(GOLD, 0.42, 0.58);
    for (let i = 0; i < 9; i++) {
      const shard = new THREE.Mesh(haloGeometry, haloMaterial);
      shard.scale.set(0.6, 1.55, 0.6);
      this.halo.push(shard);
      this.proceduralRoot.add(shard);
    }

    void this.loadAuthoredModel(++this.loadGeneration);
  }

  private async loadAuthoredModel(generation: number) {
    try {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(this.modelUrl);
      if (this.destroyed || generation !== this.loadGeneration) {
        this.disposeObject(gltf.scene);
        return;
      }
      const authoredRoot = gltf.scene.getObjectByName('Malakar_Root');
      if (!authoredRoot) throw new Error('Malakar GLB is missing Malakar_Root');
      let finiteAsset = true;
      gltf.scene.traverse((object) => {
        const transform = [
          ...object.position.toArray(),
          ...object.quaternion.toArray(),
          ...object.scale.toArray(),
        ];
        if (!transform.every(Number.isFinite)) finiteAsset = false;
        const position = (object as THREE.Mesh).geometry?.getAttribute?.('position');
        if (position) {
          const values = position.array;
          for (let i = 0; i < values.length; i++) {
            if (!Number.isFinite(values[i])) {
              finiteAsset = false;
              break;
            }
          }
        }
      });
      if (!finiteAsset) throw new Error('Malakar GLB contains non-finite geometry or transforms');
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((object) => {
        if (!object.matrixWorld.elements.every(Number.isFinite)) finiteAsset = false;
      });
      if (!finiteAsset) throw new Error('Malakar GLB contains a non-finite world transform');
      gltf.scene.scale.setScalar(AUTHORED_MODEL_PLACEMENT.scale);
      gltf.scene.position.set(
        AUTHORED_MODEL_PLACEMENT.x,
        AUTHORED_MODEL_PLACEMENT.y,
        AUTHORED_MODEL_PLACEMENT.z,
      );
      // Halo transforms and the phase-reactive core remain runtime-owned. The
      // authored nodes document the asset contract but must not double-render.
      const prototypeHalo = gltf.scene.getObjectByName('Halo_Fragment_Prototype');
      const authoredCore = gltf.scene.getObjectByName('Malakar_Core');
      if (prototypeHalo) prototypeHalo.visible = false;
      if (authoredCore) authoredCore.visible = false;
      gltf.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const entry of materials) {
          if (entry instanceof THREE.MeshStandardMaterial) {
            entry.envMapIntensity = 1.25;
            entry.needsUpdate = true;
            if (!this.assetMaterials.some(({ material: existing }) => existing === entry)) {
              this.assetMaterials.push({
                material: entry,
                color: entry.color.getHex(),
                emissive: entry.emissive.getHex(),
                emissiveIntensity: entry.emissiveIntensity,
              });
            }
          }
        }
      });
      this.assetRoot.add(gltf.scene);
      this.assetRoot.visible = true;
      // The authored GLB replaces the placeholder armour only. Runtime-owned
      // halo fragments, core and sword poses stay driven by the snapshot.
      this.proceduralBody.visible = false;
      this.modelState = 'asset-ready';
      this.error = null;
    } catch (error) {
      if (this.destroyed || generation !== this.loadGeneration) return;
      this.modelState = 'procedural-fallback';
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  private updateProcedural(snapshot: MalakarVisualSnapshot) {
    const windup = Math.max(0, Math.min(1, snapshot.windupProgress));
    const capeSpread = snapshot.phase >= 3 ? 0.22 : snapshot.phase >= 2 ? 0.12 : 0;
    this.capeLeft.rotation.y = capeSpread + windup * 0.14;
    this.capeRight.rotation.y = -capeSpread - windup * 0.14;
    setMeshVisibility(this.capeLeft, snapshot.phase >= 2);
    setMeshVisibility(this.capeRight, snapshot.phase >= 2);

    const phaseScale = snapshot.phase >= 3 ? 1.08 : snapshot.phase === 2 ? 1.03 : 1;
    this.proceduralRoot.scale.setScalar(phaseScale);
    const assetWidth = snapshot.phase >= 3 ? 1.14 : snapshot.phase === 2 ? 1.07 : 1;
    const assetHeight = snapshot.state === 'staggered' ? 0.86 : 1;
    this.assetRoot.scale.set(assetWidth, assetHeight, assetWidth);
    this.assetRoot.rotation.z = snapshot.state === 'windup'
      ? -0.04 - windup * 0.1
      : snapshot.state === 'staggered'
        ? 0.16
        : 0;
    const hurtFlash = snapshot.hurtFlash > 0;
    for (const state of this.assetMaterials) {
      state.material.color.setHex(hurtFlash ? 0xffffff : state.color);
      state.material.emissive.setHex(hurtFlash ? 0xffffff : state.emissive);
      state.material.emissiveIntensity = hurtFlash
        ? Math.max(1.6, state.emissiveIntensity)
        : state.emissiveIntensity;
    }
    this.core.scale.setScalar(1 + Math.sin(snapshot.time * (snapshot.phase >= 3 ? 11 : 7)) * 0.1);
    this.core.material.emissive.setHex(snapshot.phase >= 3 ? GOLD_BRIGHT : AMBER);
    this.core.material.emissiveIntensity = snapshot.phase >= 3 ? 3.1 : 2.2;

    const swordAngle = snapshot.state === 'windup'
      ? -0.55 - windup * 1.15
      : snapshot.state === 'strike' && snapshot.attack === 'swipe'
        ? 0.95
        : snapshot.state === 'recover'
          ? -1.25
          : -0.55;
    this.swordA.rotation.z = swordAngle;
    this.swordB.rotation.z = -swordAngle;
    this.swordB.visible = snapshot.phase >= 3 && snapshot.secondSwordDraw > 0.02;
    const secondReveal = 1 - Math.pow(1 - Math.max(0, Math.min(1, snapshot.secondSwordDraw)), 3);
    this.swordB.scale.setScalar(Math.max(0.01, secondReveal));

    const visible = Math.max(0, 9 - Math.round(snapshot.haloSpent));
    const speed = snapshot.state === 'staggered'
      ? 0.22
      : snapshot.phase >= 3 ? 2.6 : snapshot.phase === 2 ? 1.6 : 0.8;
    const gather = snapshot.attack === 'volley' && snapshot.state === 'windup' ? windup * 0.18 : 0;
    for (let i = 0; i < this.halo.length; i++) {
      const shard = this.halo[i];
      shard.visible = i < visible;
      const angle = snapshot.time * speed + i / 9 * Math.PI * 2;
      const radius = 1.18 - gather;
      shard.position.set(Math.cos(angle) * radius, 0.48 + Math.sin(angle) * 0.72, Math.sin(angle) * 0.36);
      shard.rotation.set(angle * 0.2, angle, angle + Math.PI / 2);
    }
  }

  render(ctx: CanvasRenderingContext2D, snapshot: MalakarVisualSnapshot): boolean {
    // Until the authored GLB is ready—or whenever it fails—the established
    // Canvas proof is the honest fallback. Do not silently substitute a
    // different procedural WebGL body.
    if (this.destroyed || this.state !== 'ready' || this.modelState !== 'asset-ready') return false;
    this.modelRoot.rotation.y = -snapshot.facing + Math.PI / 2;
    this.modelRoot.rotation.z = snapshot.state === 'staggered'
      ? Math.sin(snapshot.time * 3) * 0.04 + 0.12
      : 0;
    this.modelRoot.position.x = Math.cos(snapshot.recoilAng) * snapshot.recoil / 34 * 0.12;
    this.modelRoot.position.y = Math.sin(snapshot.recoilAng) * snapshot.recoil / 34 * -0.12;
    this.updateProcedural(snapshot);

    this.renderer.render(this.scene, this.camera);
    this.renders++;
    const worldSize = snapshot.r * 6.2;
    ctx.drawImage(
      this.canvas,
      snapshot.x - worldSize / 2,
      snapshot.y - worldSize * 0.57,
      worldSize,
      worldSize,
    );
    return true;
  }

  diagnostics(): MalakarThreeDiagnostic {
    return {
      state: this.state,
      modelState: this.modelState,
      modelUrl: this.modelUrl,
      renders: this.renders,
      triangles: this.renderer.info.render.triangles,
      drawCalls: this.renderer.info.render.calls,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      canvas: { width: this.canvas.width, height: this.canvas.height },
      error: this.error,
    };
  }

  private disposeObject(root: THREE.Object3D) {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) {
        for (const entry of mesh.material) entry.dispose();
      } else {
        mesh.material?.dispose();
      }
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loadGeneration++;
    this.state = 'destroyed';
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

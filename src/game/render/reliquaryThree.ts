import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RELIQUARY_ASSET_VERSION, type MalakarVisualSnapshot } from './visualModes';
import { CharacterMotion, JOINTS, type MotionInput, type MotionPose } from './reliquaryMotion';

export interface PilgrimSnapshot {
  x: number; y: number; r: number; facing: number; time: number;
  state: string; t: number; moving: boolean; swordAngle: number;
  heavyCharging: boolean; heavyCharge: number; hurt: boolean;
  vx: number; vy: number; comboStep: number; rollDir: number;
}

type Kind = 'kiteveil' | 'malakar';
type LoadState = 'loading' | 'ready' | 'failed';
interface Actor {
  root: THREE.Group;
  nodes: Record<string, THREE.Object3D>;
  materials: { material: THREE.MeshStandardMaterial; emission: number; emissionColor: number }[];
  cloth: { mesh: THREE.Mesh; rest: Float32Array }[];
  state: LoadState;
  triangles: number;
  motion: CharacterMotion;
  rest: Record<string, THREE.Vector3>;
  pose: MotionPose | null;
}

function forgedSurface(material: THREE.MeshStandardMaterial) {
  // Fine material-space patina and hammer variation. No extra texture requests,
  // screen-space noise, random frame state, or changes to authored silhouette.
  material.roughness = Math.max(material.roughness, .39);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vForgePosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vForgePosition = position;');
    shader.fragmentShader = `varying vec3 vForgePosition;
      float forgeGrain(vec3 p) { return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      float forgeNoise(vec3 p) {
        vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(forgeGrain(i),forgeGrain(i+vec3(1,0,0)),f.x),
          mix(forgeGrain(i+vec3(0,1,0)),forgeGrain(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(forgeGrain(i+vec3(0,0,1)),forgeGrain(i+vec3(1,0,1)),f.x),
          mix(forgeGrain(i+vec3(0,1,1)),forgeGrain(i+vec3(1,1,1)),f.x),f.y),f.z);
      }\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb *= .80 + .24 * forgeNoise(vForgePosition * 42.0);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor + .20 * forgeNoise(vForgePosition * 65.0), .3, .85);');
  };
  material.customProgramCacheKey = () => 'reliquary-forged-metal-1';
}

// One bounded, shared context. Offscreen 3D characters composite at the existing
// world anchors, keeping the exact camera, telegraph and input coordinate system.
export class ReliquaryThree {
  readonly canvas = document.createElement('canvas');
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 40);
  private readonly actors: Record<Kind, Actor>;
  private environment: THREE.WebGLRenderTarget;
  private readonly halo = new THREE.Group();
  private readonly haloShards: THREE.Mesh[] = [];
  private readonly key = new THREE.DirectionalLight(0xffdfac, 2.7);
  private readonly rim = new THREE.DirectionalLight(0x91cbff, 2.5);
  private destroyed = false;
  private lost = false;
  private activated = false;
  private error: string | null = null;
  private renders = 0;
  private calls = 0;
  private readonly size: number;

  private onLost = (event: Event) => {
    event.preventDefault();
    this.lost = true;
    this.activated = false;
  };
  private onRestored = () => {
    if (this.destroyed) return;
    try {
      // PMREM was rendered on the GPU, so its pixels do not survive loss even
      // though the JS texture survives. Recreate it before promoting the pair.
      this.environment.dispose();
      this.environment = this.buildEnvironment();
      this.scene.environment = this.environment.texture;
      this.lost = false;
    } catch (error) {
      this.error = String(error);
      this.actors.kiteveil.state = 'failed';
    }
  };

  constructor(touch: boolean, allowSoftwareForQA = false) {
    this.size = touch ? 384 : 640;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, alpha: true, antialias: true,
      powerPreference: 'high-performance', premultipliedAlpha: true,
    });
    const gl = this.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const device = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
    if (!allowSoftwareForQA && /swiftshader|llvmpipe|software rasterizer|microsoft basic render/i.test(device)) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      throw new Error('Hardware acceleration is unavailable; Classic characters remain active.');
    }
    this.canvas.addEventListener('webglcontextlost', this.onLost);
    this.canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.renderer.setSize(this.size, this.size, false);
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.environment = this.buildEnvironment();
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = .6;
    this.key.position.set(-3, 5, 4);
    this.rim.position.set(3, 2, -3);
    this.scene.add(this.key, this.rim, new THREE.HemisphereLight(0xbbd5ed, 0x24170b, 1.2));
    const createActor = (): Actor => {
      const root = new THREE.Group(); root.rotation.order = 'YXZ';
      return { root, nodes: {}, materials: [], cloth: [], state: 'loading', triangles: 0,
        motion: new CharacterMotion(), rest: {}, pose: null };
    };
    this.actors = { kiteveil: createActor(), malakar: createActor() };
    for (const actor of Object.values(this.actors)) { actor.root.visible = false; this.scene.add(actor.root); }
    const shardGeometry = new THREE.ConeGeometry(.055, .30, 5);
    const shardMaterial = new THREE.MeshStandardMaterial({
      color: 0xd6ae56, metalness: .8, roughness: .26,
      emissive: 0x9d5e18, emissiveIntensity: .35,
    });
    for (let i = 0; i < 9; i++) {
      const shard = new THREE.Mesh(shardGeometry, shardMaterial);
      this.halo.add(shard); this.haloShards.push(shard);
    }
    this.actors.malakar.root.add(this.halo);
    void this.load('kiteveil');
    void this.load('malakar');
  }

  private buildEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    try { return pmrem.fromScene(room, .04); }
    finally { room.dispose(); pmrem.dispose(); }
  }

  private async load(kind: Kind) {
    const actor = this.actors[kind];
    try {
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const url = new URL(`art/reliquary/${kind}.glb`, document.baseURI);
      url.searchParams.set('v', RELIQUARY_ASSET_VERSION);
      const { scene } = await loader.loadAsync(url.href);
      if (this.destroyed) { this.disposeObject(scene); return; }
      try {
        for (const name of JOINTS.filter(name => name !== 'Sword_L')) {
          const node = scene.getObjectByName(name);
          if (!node) throw new Error(`${kind}: missing articulated node ${name}`);
          actor.nodes[name] = node;
          actor.rest[name] = node.position.clone();
        }
        const secondSword = scene.getObjectByName('Sword_L');
        if (secondSword) { actor.nodes.Sword_L = secondSword; actor.rest.Sword_L = secondSword.position.clone(); }
        scene.traverse((object) => {
          if (![...object.position, ...object.quaternion, ...object.scale].every(Number.isFinite)) {
            throw new Error(`${kind}: non-finite transform`);
          }
          if (!(object instanceof THREE.Mesh)) return;
          const positions = object.geometry.getAttribute('position');
          if (!positions || !Array.from(positions.array).every(Number.isFinite)) {
            throw new Error(`${kind}: invalid geometry`);
          }
          object.frustumCulled = false;
          actor.triangles += (object.geometry.index?.count ?? positions.count) / 3;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (!(material instanceof THREE.MeshStandardMaterial)) continue;
            if (!actor.materials.some((entry) => entry.material === material)) {
              material.envMapIntensity = 1.15;
              if (material.metalness > .5) forgedSurface(material);
              if (/velvet|linen/.test(material.name)) { material.side = THREE.DoubleSide; }
              actor.materials.push({ material, emission: material.emissiveIntensity, emissionColor: material.emissive.getHex() });
            }
          }
          // Rest-space cloth vertices, deterministic time-driven displacement.
          // No accumulated transforms, no new physics state or animation clocks.
          if (/Cape_|Head_/.test(object.name) && materials.some(material => /velvet|linen/.test(material.name))) {
            // Meshopt attributes may be quantized; expand before deforming.
            const rest = new Float32Array(positions.count * 3);
            for (let i = 0; i < positions.count; i++) {
              rest[i * 3] = positions.getX(i); rest[i * 3 + 1] = positions.getY(i); rest[i * 3 + 2] = positions.getZ(i);
            }
            object.geometry.setAttribute('position', new THREE.BufferAttribute(rest.slice(), 3).setUsage(THREE.DynamicDrawUsage));
            actor.cloth.push({ mesh: object, rest });
          }
        });
        actor.root.add(scene);
        actor.state = 'ready';
      } catch (error) { this.disposeObject(scene); throw error; }
    } catch (error) {
      if (this.destroyed) return;
      actor.state = 'failed';
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  // Late loads and context restoration can only promote at a safe boundary.
  // The engine calls this on intro/title/pause/reset, not in live combat.
  activateAtBoundary() {
    if (!this.destroyed && !this.lost && Object.values(this.actors).every((a) => a.state === 'ready')) this.activated = true;
  }

  get ready() { return this.activated && !this.destroyed && !this.lost; }
  get failed() { return Object.values(this.actors).some((a) => a.state === 'failed'); }

  private pose(actor: Actor, input: MotionInput, hurt: boolean) {
    const n = actor.nodes;
    const pose = actor.motion.sample(input);
    actor.pose = pose;
    for (const [name, node] of Object.entries(n)) {
      node.position.copy(actor.rest[name]);
      node.rotation.set(...pose.joints[name as keyof typeof pose.joints]);
      node.scale.set(1, 1, 1);
    }
    n.Pelvis.position.x += pose.pelvis[0]; n.Pelvis.position.y += pose.pelvis[1]; n.Pelvis.position.z += pose.pelvis[2];
    const facing = -Math.PI / 2 - pose.facing;
    actor.root.rotation.set(pose.rootRotation[0], facing + pose.rootRotation[1], pose.rootRotation[2]);
    actor.root.position.set(Math.sin(facing) * pose.root[2] + Math.cos(facing) * pose.root[0],
      pose.root[1], Math.cos(facing) * pose.root[2] - Math.sin(facing) * pose.root[0]);
    const motion = input.reduced ? .3 : 1, movement = Math.min(1, pose.speed / 180);
    for (const { mesh, rest } of actor.cloth) {
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
        const fall = Math.min(1, Math.abs(y) / 1.35);
        const flutter = Math.sin(input.time * 4.2 + x * 6 + y * 5) * (.035 + movement * .045)
          + Math.sin(input.time * 7.1 + y * 8) * movement * .018;
        positions.setXYZ(i, x + Math.sin(input.time * 2.1 + y * 3) * .02 * fall * motion,
          y, z + flutter * fall * motion);
      }
      positions.needsUpdate = true;
    }
    for (const { material, emission, emissionColor } of actor.materials) {
      material.emissive.setHex(hurt && emissionColor === 0 ? 0xbba993 : emissionColor);
      material.emissiveIntensity = hurt ? Math.max(emission, 1.1) : emission;
      // Keep crystal/visor material hue intact; metal catches the hit as a rim.
    }
  }

  private composite(ctx: CanvasRenderingContext2D, kind: Kind, x: number, y: number, worldSize: number) {
    for (const [name, actor] of Object.entries(this.actors)) actor.root.visible = name === kind;
    this.camera.position.set(0, 5.4, 8);
    this.camera.lookAt(0, 1.05, 0);
    this.renderer.render(this.scene, this.camera);
    this.calls = this.renderer.info.render.calls;
    this.renders++;
    // The point of contact is below image centre because the camera looks at
    // the torso. Fixed authored framing keeps feet planted across every pose.
    ctx.drawImage(this.canvas, x - worldSize / 2, y - worldSize * .735, worldSize, worldSize);
  }

  renderPlayer(ctx: CanvasRenderingContext2D, s: PilgrimSnapshot, reducedMotion: boolean) {
    if (!this.ready) return false;
    const actor = this.actors.kiteveil, n = actor.nodes;
    this.pose(actor, { kind: 'kiteveil', x: s.x, y: s.y, time: s.time, vx: s.vx, vy: s.vy,
      facing: s.facing, state: s.state, remaining: s.t, combo: s.comboStep,
      charging: s.heavyCharging, charge: s.heavyCharge, rollDir: s.rollDir, reduced: reducedMotion }, s.hurt);
    n.Sword_R.visible = !['flask', 'dead', 'roll', 'stagger'].includes(s.state);
    this.rim.color.setHex(0x91cbff);
    this.composite(ctx, 'kiteveil', s.x, s.y + s.r * .7, s.r * 7.2);
    return true;
  }

  renderBoss(ctx: CanvasRenderingContext2D, s: MalakarVisualSnapshot, reducedMotion: boolean) {
    if (!this.ready) return false;
    const actor = this.actors.malakar, n = actor.nodes;
    this.pose(actor, { kind: 'malakar', x: s.x, y: s.y, time: s.time,
      vx: s.vx ?? 0, vy: s.vy ?? 0, facing: s.facing, state: s.state,
      remaining: s.stateRemaining ?? 0, attack: s.attack, windup: s.windupProgress,
      phase: s.phase, reduced: reducedMotion }, s.hurtFlash > 0);
    const impact = s.techniqueImpactStrength * (s.techniqueImpact === 'execute' ? 1 : .6);
    n.Torso.rotation.x -= impact * .42;
    actor.root.position.x += Math.cos(s.recoilAng) * s.recoil / 50;
    actor.root.position.z += Math.sin(s.recoilAng) * s.recoil / 50;
    n.Cape.rotation.x += s.phase >= 2 ? .18 : 0;
    const sword = n.Sword_L;
    if (sword) {
      sword.visible = s.phase >= 3 && s.secondSwordDraw > .02;
      sword.scale.setScalar(Math.max(.01, Math.min(1, s.secondSwordDraw)));
    }
    // Halo belongs to world-facing presentation, so it does not disappear
    // edge-on when Malakar turns. Its nine shards still track volley spending.
    this.halo.rotation.y = -actor.root.rotation.y;
    const visible = Math.max(0, 9 - Math.round(s.haloSpent));
    for (let i = 0; i < 9; i++) {
      const shard = this.haloShards[i];
      const a = i / 9 * Math.PI * 2 + s.time * (s.phase === 3 ? .8 : .26);
      const radius = .76 + impact * .2;
      shard.visible = i < visible;
      shard.position.set(Math.cos(a) * radius, 1.78 + Math.sin(a) * radius, -.24);
      shard.rotation.set(0, 0, a - Math.PI / 2);
    }
    this.rim.color.setHex(s.phase >= 3 ? 0xc3eaff : s.phase === 2 ? 0xedb477 : 0x91b5e4);
    this.composite(ctx, 'malakar', s.x, s.y + s.r * .7, s.r * 6.1);
    return true;
  }

  diagnostics() {
    return {
      state: this.destroyed ? 'destroyed' : this.lost ? 'context-lost' : this.ready ? 'active' : this.failed ? 'fallback' : 'loading',
      error: this.error, renders: this.renders, drawCalls: this.calls,
      canvasSize: this.size, geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      models: Object.fromEntries(Object.entries(this.actors).map(([name, actor]) => [name, { state: actor.state, triangles: actor.triangles }])),
      motion: Object.fromEntries(Object.entries(this.actors).map(([name, actor]) => [name, actor.pose])),
    };
  }

  private disposeObject(root: THREE.Object3D) {
    const materials = new Set<THREE.Material>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    for (const material of materials) material.dispose();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.disposeObject(this.scene);
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

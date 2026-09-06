import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RELIQUARY_ASSET_VERSION, type MalakarVisualSnapshot } from './visualModes';

export interface PilgrimSnapshot {
  x: number; y: number; r: number; facing: number; time: number;
  state: string; t: number; moving: boolean; swordAngle: number;
  heavyCharging: boolean; heavyCharge: number; hurt: boolean;
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
      return { root, nodes: {}, materials: [], cloth: [], state: 'loading', triangles: 0 };
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
        for (const name of ['Torso', 'Head', 'Cape', 'Arm_L', 'Arm_R', 'Forearm_L', 'Forearm_R', 'Leg_L', 'Leg_R', 'Sword_R']) {
          const node = scene.getObjectByName(name);
          if (!node) throw new Error(`${kind}: missing articulated node ${name}`);
          actor.nodes[name] = node;
        }
        const secondSword = scene.getObjectByName('Sword_L');
        if (secondSword) actor.nodes.Sword_L = secondSword;
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
          if (/Cape_/.test(object.name)) {
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

  private pose(actor: Actor, time: number, movement: number, hurt: boolean, motion: number) {
    const n = actor.nodes;
    // Reset all rotation every draw; no animation data is written into combat.
    for (const node of Object.values(n)) node.rotation.set(0, 0, 0);
    actor.root.rotation.set(0, 0, 0); actor.root.position.set(0, 0, 0);
    n.Leg_L.rotation.x = Math.sin(time * 8.5) * .34 * movement;
    n.Leg_R.rotation.x = -n.Leg_L.rotation.x;
    n.Torso.rotation.z = Math.sin(time * 4.25) * .025 * movement;
    n.Arm_L.rotation.x = -.14 + Math.sin(time * 8.5) * .14 * movement;
    n.Arm_R.rotation.x = -.18 - Math.sin(time * 8.5) * .14 * movement;
    n.Forearm_R.rotation.x = -.38;
    n.Sword_R.rotation.x = -1.10;
    if (n.Sword_L) n.Sword_L.rotation.x = -1.1;
    n.Cape.rotation.x = .05 + movement * .12;
    for (const { mesh, rest } of actor.cloth) {
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
        const fall = Math.min(1, Math.abs(y) / 1.35);
        positions.setXYZ(i, x, y, z + Math.sin(time * 2.8 * motion + x * 7 + y * 4) * .048 * fall);
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
    this.pose(actor, s.time, s.moving ? 1 : 0, s.hurt, reducedMotion ? .45 : 1);
    actor.root.rotation.y = -Math.PI / 2 - s.facing;
    const attacking = ['light', 'heavy', 'sunder', 'rollSlash'].includes(s.state);
    n.Sword_R.scale.set(1, attacking && !s.heavyCharging ? (s.state === 'heavy' ? 2.55 : 2.15) : 1, 1);
    if (attacking) {
      n.Torso.rotation.y = Math.sin(s.swordAngle - s.facing) * .25;
      n.Arm_R.rotation.y = -(s.swordAngle - s.facing) + .45;
      n.Arm_R.rotation.x = -.8;
      n.Forearm_R.rotation.x = -.6;
      n.Sword_R.rotation.x = -.8;
    }
    if (s.heavyCharging) {
      n.Arm_R.rotation.x = -1.45; n.Forearm_R.rotation.x = -.85;
      n.Sword_R.rotation.x = .35; n.Torso.rotation.x = -.1;
    }
    if (s.state === 'flask') { n.Arm_L.rotation.x = -1.3; n.Forearm_L.rotation.x = -1; }
    if (s.state === 'stagger') n.Torso.rotation.x = -.26;
    if (s.state === 'dead') { actor.root.rotation.z = 1.35; actor.root.position.y = -.55; }
    if (s.state === 'roll') {
      const angle = (1 - s.t / .42) * Math.PI * 2;
      actor.root.rotation.x = angle;
      // Roll around the torso, not the origin at the feet; that would make the
      // whole model orbit the ground anchor and clip through its own viewport.
      const offset = -1.05 * Math.sin(angle);
      actor.root.position.set(Math.sin(actor.root.rotation.y) * offset,
        1.05 * (1 - Math.cos(angle)), Math.cos(actor.root.rotation.y) * offset);
    }
    n.Sword_R.visible = !['flask', 'dead', 'roll', 'stagger'].includes(s.state);
    this.rim.color.setHex(0x91cbff);
    this.composite(ctx, 'kiteveil', s.x, s.y + s.r * .7, s.r * 7.2);
    return true;
  }

  renderBoss(ctx: CanvasRenderingContext2D, s: MalakarVisualSnapshot, reducedMotion: boolean) {
    if (!this.ready) return false;
    const actor = this.actors.malakar, n = actor.nodes;
    this.pose(actor, s.time, s.state === 'stalk' ? .5 : 0, s.hurtFlash > 0, reducedMotion ? .45 : 1);
    actor.root.rotation.y = -Math.PI / 2 - s.facing;
    const windup = Math.max(0, Math.min(1, s.windupProgress));
    if (s.state === 'windup') {
      n.Torso.rotation.y = -.2 - windup * .3;
      if (s.attack === 'slam' || s.attack === 'meteor') {
        n.Arm_R.rotation.x = -1.6 * windup; n.Sword_R.rotation.x = .3;
      } else if (s.attack === 'swipe' || s.attack === 'charge') {
        n.Arm_R.rotation.y = -.7 - windup * 1.1; n.Arm_R.rotation.x = -.75;
      } else { n.Arm_L.rotation.z = -.9 * windup; n.Arm_R.rotation.z = .9 * windup; }
    }
    if (s.state === 'strike') {
      n.Arm_R.rotation.y = 1.25; n.Arm_R.rotation.x = -.65;
      n.Torso.rotation.y = .4; n.Sword_R.rotation.x = -1.25;
    }
    if (s.state === 'recover') { n.Torso.rotation.x = .12; n.Sword_R.rotation.x = -2.3; }
    if (s.state === 'staggered') { n.Torso.rotation.x = .42; n.Head.rotation.x = .25; n.Arm_R.rotation.z = .25; }
    const impact = s.techniqueImpactStrength * (s.techniqueImpact === 'execute' ? 1 : .6);
    n.Torso.rotation.x -= impact * .42;
    actor.root.position.x = Math.cos(s.recoilAng) * s.recoil / 50;
    actor.root.position.z = Math.sin(s.recoilAng) * s.recoil / 50;
    n.Cape.rotation.x += s.phase >= 2 ? .18 : 0;
    const sword = n.Sword_L;
    if (sword) {
      sword.visible = s.phase >= 3 && s.secondSwordDraw > .02;
      sword.scale.setScalar(Math.max(.01, Math.min(1, s.secondSwordDraw)));
      n.Arm_L.rotation.y = s.state === 'strike' ? -1 : .4;
      n.Arm_L.rotation.x = -.55;
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

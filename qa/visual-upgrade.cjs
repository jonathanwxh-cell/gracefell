// GRACEFELL v2.25 visual-depth acceptance lane.
//
// This is intentionally standalone until the arena-bake runtime has completed
// review. It fails with structured readiness errors when the required asset or
// diagnostics contract is absent instead of silently treating the current
// procedural renderer as the candidate.
//
// Run:
//   node qa/visual-upgrade.cjs
//   GRACEFELL_URL=http://127.0.0.1:8492/ node qa/visual-upgrade.cjs
//
// Artifacts:
//   %TEMP%/gracefell-qa/visual-upgrade/
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.GRACEFELL_URL || 'http://127.0.0.1:8492/';
const ARTIFACT_DIR = process.env.GRACEFELL_VISUAL_QA_DIR
  || path.join(os.tmpdir(), 'gracefell-qa', 'visual-upgrade');
const RESULT_PATH = process.env.GRACEFELL_VISUAL_QA_RESULT
  || path.join(ARTIFACT_DIR, 'result.json');
const PERF_RECEIPT_PATH = process.env.GRACEFELL_V224_PERF_RECEIPT
  || path.join(process.cwd(), '.artifacts', 'v224-perf-baseline.json');
const EXPECTED_VISUAL_ASSET_VERSION = process.env.GRACEFELL_VISUAL_ASSET_VERSION || 'v225-2';

const ARENA_QUERY = 'visual=arena-bake&boss=blender-canvas';
const ASSETS = [
  {
    id: 'arenaBase',
    pathname: '/art/arena/arena-base.webp',
    kind: 'image',
    contentTypePattern: '^image/(webp|avif)(?:;|$)',
    required: true,
    maxBytes: 700 * 1024,
    width: 2048,
    height: 2048,
  },
  {
    id: 'phase2Mask',
    pathname: '/art/arena/phase-2-mask.webp',
    kind: 'image',
    contentTypePattern: '^image/(webp|avif)(?:;|$)',
    required: false,
    maxBytes: 400 * 1024,
    maxWidth: 1024,
    maxHeight: 1024,
  },
  {
    id: 'phase3Mask',
    pathname: '/art/arena/phase-3-mask.webp',
    kind: 'image',
    contentTypePattern: '^image/(webp|avif)(?:;|$)',
    required: false,
    maxBytes: 400 * 1024,
    maxWidth: 1024,
    maxHeight: 1024,
  },
  {
    id: 'malakarModel',
    pathname: '/art/models/malakar.glb',
    kind: 'binary',
    contentTypePattern: '^model/gltf-binary(?:;|$)',
    required: true,
    maxBytes: 500 * 1024,
  },
];
const ARENA_ASSETS = ASSETS.filter((asset) => asset.id !== 'malakarModel');

const BOSS_MODES = ['current', 'blender-canvas', 'blender-three'];
const BOSS_PROOF_STATES = [
  {
    id: 'phase-one-guard',
    phase: 1,
    state: 'stalk',
    attack: 'swipe',
    t: 0.8,
    currentWindup: 0.8,
    haloSpent: 0,
    secondSwordDraw: 0,
  },
  {
    id: 'swipe-release',
    phase: 1,
    state: 'strike',
    attack: 'swipe',
    t: 0.12,
    currentWindup: 0.8,
    haloSpent: 1,
    secondSwordDraw: 0,
  },
  {
    id: 'ring-cast-anticipation',
    phase: 2,
    state: 'windup',
    attack: 'ring',
    t: 0.18,
    currentWindup: 0.9,
    haloSpent: 2,
    secondSwordDraw: 0,
  },
  {
    id: 'stagger',
    phase: 2,
    state: 'staggered',
    attack: 'slam',
    t: 0.55,
    currentWindup: 0.9,
    haloSpent: 4,
    secondSwordDraw: 0,
  },
  {
    id: 'phase-three-dual-sword',
    phase: 3,
    state: 'stalk',
    attack: 'spiral',
    t: 0.7,
    currentWindup: 0.72,
    haloSpent: 6,
    secondSwordDraw: 1,
  },
];

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, dpr: 2, touch: true },
  { name: 'desktop', width: 1280, height: 800, dpr: 1, touch: false },
];

// A baked floor replaces the existing floor cache. It must not introduce
// per-frame drawing work. These are deltas against the same-build procedural
// page, not broad absolute budgets.
const MAX_CANDIDATE_DELTA = {
  createRadialGradient: 0,
  createLinearGradient: 0,
  drawImage: 0,
  shadowBlurNonZero: 0,
  drawCalls: 4,
};

const ABSOLUTE_PERF_CAPS = {
  createRadialGradient: 52,
  shadowBlurNonZero: 12,
  drawCalls: 1100,
};

const out = {
  ok: false,
  readiness: 'blocked',
  errors: [],
  warnings: [],
  assets: {},
  productionDefault: null,
  productionDefaultGesture: null,
  variants: {},
  fallback: null,
  bossProofs: {},
  bossFallbacks: {
    corruptModel: null,
    contextLifecycle: null,
  },
  arenaLifecycle: null,
  uploadFallbacks: {
    base: null,
    phase: null,
  },
  performance: {
    policy: 'deterministic Canvas operation census; timings are not asserted',
    v224Receipt: null,
    comparisons: {},
  },
};

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function addError(message) {
  out.errors.push(message);
}

function addWarning(message) {
  out.warnings.push(message);
}

function appendQuery(url, query) {
  const parsed = new URL(url);
  for (const [key, value] of new URLSearchParams(query)) parsed.searchParams.set(key, value);
  return parsed.href;
}

function readPerfReceipt() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PERF_RECEIPT_PATH, 'utf8'));
    if (!parsed?.ok || !parsed?.viewports?.mobile || !parsed?.viewports?.desktop) {
      addWarning(`v2.24 perf receipt is present but invalid: ${PERF_RECEIPT_PATH}`);
      return null;
    }
    return {
      path: PERF_RECEIPT_PATH,
      mobile: {
        census: parsed.viewports.mobile.census,
        timings: parsed.viewports.mobile.timings,
      },
      desktop: {
        census: parsed.viewports.desktop.census,
        timings: parsed.viewports.desktop.timings,
      },
    };
  } catch (error) {
    addWarning(`v2.24 perf receipt unavailable; same-build comparisons still run: ${error.message}`);
    return null;
  }
}

async function performFirstGesture(page, touch) {
  await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 20000 });
  const before = await page.evaluate(() => {
    const game = window.__game;
    return {
      audio: game.audio.debugState(),
      visualProofsPrepared: game.visualProofsPrepared,
      visualTimerPending: game.visualProofStartTimer !== null,
      arenaAssetsAllocated: game.arenaBakeAssets !== null,
      threeAllocated: game.malakarThree !== null,
    };
  });
  const canvas = page.locator('canvas').first();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('game canvas has no gesture target');
  const x = bounds.x + bounds.width * 0.5;
  const y = bounds.y + bounds.height * 0.5;
  await page.evaluate(() => {
    window.__v225FirstGestureReceipt = null;
    window.addEventListener('pointerdown', (event) => {
      if (!event.isTrusted) return;
      // The event has bubbled past the Canvas engine handler. A microtask
      // observes synchronous gesture work before the 120 ms product timer,
      // even if Playwright's tap/click protocol call itself returns slowly.
      queueMicrotask(() => {
        const game = window.__game;
        window.__v225FirstGestureReceipt = {
          trusted: event.isTrusted,
          capturedAt: performance.now(),
          audio: game.audio.debugState(),
          visualProofsPrepared: game.visualProofsPrepared,
          visualTimerPending: game.visualProofStartTimer !== null,
          arenaAssetsAllocated: game.arenaBakeAssets !== null,
          threeAllocated: game.malakarThree !== null,
        };
      });
    }, { once: true });
  });
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.waitForFunction(() => Boolean(window.__v225FirstGestureReceipt), null, { timeout: 2000 });
  const after = await page.evaluate(() => window.__v225FirstGestureReceipt);
  return {
    kind: touch ? 'touch' : 'pointer',
    target: { x, y },
    before,
    after,
  };
}

async function inspectAsset(page, asset) {
  const parsedUrl = new URL(asset.pathname, BASE_URL);
  parsedUrl.searchParams.set('v', EXPECTED_VISUAL_ASSET_VERSION);
  const url = parsedUrl.href;
  return page.evaluate(async ({ url: assetUrl, kind }) => {
    try {
      const response = await fetch(assetUrl, { cache: 'no-store' });
      const contentType = response.headers.get('content-type') || '';
      const cacheControl = response.headers.get('cache-control') || '';
      const buffer = await response.arrayBuffer();
      let width = null;
      let height = null;
      let decodeError = null;
      if (response.ok && kind === 'image') {
        try {
          const bitmap = await createImageBitmap(new Blob([buffer], { type: contentType }));
          width = bitmap.width;
          height = bitmap.height;
          bitmap.close();
        } catch (error) {
          decodeError = String(error?.message || error);
        }
      }
      return {
        url: assetUrl,
        responseUrl: response.url,
        status: response.status,
        ok: response.ok,
        contentType,
        cacheControl,
        bytes: buffer.byteLength,
        width,
        height,
        decodeError,
      };
    } catch (error) {
      return {
        url: assetUrl,
        responseUrl: null,
        status: 0,
        ok: false,
        contentType: '',
        cacheControl: '',
        bytes: 0,
        width: null,
        height: null,
        decodeError: String(error?.message || error),
      };
    }
  }, { url, kind: asset.kind });
}

function readVisualDiagnosticsInPage() {
  const game = window.__game;
  const attempts = [
    ['window.__graceVisualDiagnostics', window.__graceVisualDiagnostics],
    ['game.visualDiagnostics', game?.visualDiagnostics],
    ['game.visualDebugState', game?.visualDebugState],
    ['game.visualSnapshot', game?.visualSnapshot],
    ['game.visualDebug', game?.visualDebug],
    ['game.visualState', game?.visualState],
  ];
  let source = null;
  let value = null;
  let diagnosticError = null;
  for (const [name, candidate] of attempts) {
    if (candidate == null) continue;
    try {
      source = name;
      value = typeof candidate === 'function'
        ? candidate.call(name.startsWith('game.') ? game : window)
        : candidate;
      break;
    } catch (error) {
      source = name;
      diagnosticError = String(error?.message || error);
      break;
    }
  }

  let raw = null;
  if (value != null) {
    try {
      raw = JSON.parse(JSON.stringify(value, (_key, item) => (
        typeof item === 'function' ? `[function ${item.name || 'anonymous'}]` : item
      )));
    } catch (error) {
      diagnosticError = diagnosticError || String(error?.message || error);
    }
  }

  const pick = (object, paths) => {
    for (const pathText of paths) {
      let cursor = object;
      for (const key of pathText.split('.')) cursor = cursor?.[key];
      if (cursor !== undefined && cursor !== null) return cursor;
    }
    return null;
  };
  const text = (input) => {
    if (typeof input === 'string') return input;
    if (input && typeof input === 'object') {
      return input.kind || input.mode || input.name || input.id || null;
    }
    return input == null ? null : String(input);
  };
  const params = new URLSearchParams(location.search);
  const requestedVisual = text(pick(raw, [
    'requestedVisual', 'requested.arena', 'visual.requested', 'query.visual', 'requested',
  ]));
  const arenaState = text(pick(raw, [
    'arena.state', 'arena.assets.base.state', 'arenaAsset.state', 'asset.state', 'arenaStatus',
  ]));
  const arenaApplied = pick(raw, [
    'arena.applied', 'arena.active', 'arenaAsset.applied',
  ]);
  const arenaPending = pick(raw, [
    'arena.pending', 'arenaAsset.pending',
  ]);
  const arenaStampedPhases = pick(raw, [
    'arena.stampedPhases', 'arenaAsset.stampedPhases',
  ]);
  const arenaOverlayErrors = pick(raw, [
    'arena.overlayErrors', 'arenaAsset.overlayErrors',
  ]);
  let activeVisual = text(pick(raw, [
    'activeVisual', 'active.arena', 'visual.active', 'mode', 'visualMode', 'active',
  ]));
  if (!activeVisual && requestedVisual === 'arena-bake') {
    if (arenaApplied === true && /^(ready|loaded)$/i.test(arenaState || '')) {
      activeVisual = 'arena-bake';
    } else if (/^(fallback|failed|error)$/i.test(arenaState || '')) {
      activeVisual = 'procedural';
    }
  }
  return {
    source,
    error: diagnosticError,
    raw,
    query: {
      visual: params.get('visual'),
      boss: params.get('boss'),
    },
    requestedBoss: text(pick(raw, [
      'requestedBoss', 'requested.boss', 'boss.requested', 'query.boss',
    ])),
    activeBoss: text(pick(raw, [
      'activeBoss', 'boss.active', 'active.boss',
    ])),
    threeState: text(pick(raw, [
      'boss.three.state', 'three.state', 'webgl.state',
    ])),
    threeError: text(pick(raw, [
      'boss.three.error', 'three.error', 'webgl.error',
    ])),
    threeReleased: pick(raw, [
      'boss.three.released', 'three.released', 'webgl.released',
    ]),
    modelState: text(pick(raw, [
      'boss.three.renderer.modelState', 'three.renderer.modelState',
      'model.state',
    ])),
    modelUrl: text(pick(raw, [
      'boss.three.renderer.modelUrl', 'three.renderer.modelUrl',
      'model.url',
    ])),
    rendererState: text(pick(raw, [
      'boss.three.renderer.state', 'three.renderer.state', 'webgl.renderer.state',
    ])),
    rendererRenders: pick(raw, [
      'boss.three.renderer.renders', 'three.renderer.renders', 'webgl.renders',
    ]),
    rendererTriangles: pick(raw, [
      'boss.three.renderer.triangles', 'three.renderer.triangles', 'webgl.triangles',
    ]),
    rendererDrawCalls: pick(raw, [
      'boss.three.renderer.drawCalls', 'three.renderer.drawCalls', 'webgl.drawCalls',
    ]),
    rendererGeometries: pick(raw, [
      'boss.three.renderer.geometries', 'three.renderer.geometries', 'webgl.geometries',
    ]),
    rendererTextures: pick(raw, [
      'boss.three.renderer.textures', 'three.renderer.textures', 'webgl.textures',
    ]),
    rendererCanvas: pick(raw, [
      'boss.three.renderer.canvas', 'three.renderer.canvas', 'webgl.canvas',
    ]),
    requestedVisual,
    activeVisual,
    renderer: text(pick(raw, [
      'renderer', 'renderer.kind', 'renderer.mode', 'renderMode',
    ])),
    arenaState,
    arenaApplied,
    arenaPending,
    arenaStampedPhases,
    arenaOverlayErrors,
    arenaUrl: text(pick(raw, [
      'arena.url', 'arena.assets.base.url', 'arenaAsset.url', 'asset.url',
    ])),
    fallbackReason: text(pick(raw, [
      'fallbackReason', 'arena.fallbackReason', 'arena.assets.base.error',
      'arenaAsset.fallbackReason',
      'fallback.reason',
    ])),
    permanentFullSizeSurfaces: pick(raw, [
      'permanentFullSizeSurfaces', 'surfaces.permanentFullSize',
      'memory.permanentFullSizeSurfaces',
    ]),
  };
}

function surfaceInventoryInPage() {
  const game = window.__game;
  const surfaces = [];
  for (const [key, value] of Object.entries(game || {})) {
    const isCanvas = value instanceof HTMLCanvasElement
      || (typeof OffscreenCanvas !== 'undefined' && value instanceof OffscreenCanvas);
    if (!isCanvas) continue;
    surfaces.push({
      key,
      width: value.width,
      height: value.height,
      pixels: value.width * value.height,
      visible: value instanceof HTMLCanvasElement && value.isConnected,
    });
  }
  surfaces.sort((a, b) => a.key.localeCompare(b.key));
  return {
    domCanvasCount: document.querySelectorAll('canvas').length,
    surfaces,
    totalPixels: surfaces.reduce((sum, item) => sum + item.pixels, 0),
  };
}

function buildPinnedPerfSceneInPage(projectileCount) {
  const game = window.__game;
  cancelAnimationFrame(game.raf);
  game.raf = 0;
  game.paused = true;
  game.manualPaused = false;
  game.uiFocused = false;
  game.state = 'fight';
  game.hintT = 0;
  game.bannerT = 0;
  game.playerChainT = 0;
  game.boss.phase = 3;
  game.boss.hp = game.boss.maxHp * 0.15;
  game.boss.haloSpent = 0;
  game.boss.hurtFlash = 0;
  game.boss.recoil = 0;
  game.boss.secondSwordDraw = 1;
  game.deepenArena(3);
  game.weatherFromPhase = 3;
  game.weatherPhase = 3;
  game.weatherBlend = 1;
  game.player.hp = game.player.maxHp * 0.25;
  game.player.iframes = 0;
  game.boss.state = 'windup';
  game.boss.attack = 'spiral';
  game.boss.t = 0.1;
  game.boss.currentWindup = 0.75;
  game.player.x = 60;
  game.player.y = 40;
  game.boss.x = -40;
  game.boss.y = -20;
  game.shakeAmp = 0;
  game.shakeT = 0;
  game.shakeDur = 0.3;
  game.zoomPunch = 0;
  game.redFlash = 0.4;
  game.goldFlash = 0.3;

  game.projectiles.length = 0;
  for (let i = 0; i < projectileCount; i++) {
    const angle = (i / Math.max(1, projectileCount)) * Math.PI * 2;
    game.projectiles.push({
      x: Math.cos(angle) * 120,
      y: Math.sin(angle) * 120,
      vx: Math.cos(angle) * 90,
      vy: Math.sin(angle) * 90,
      r: 7,
      dmg: 10,
      life: 5,
      hostile: true,
      hue: '#ff2d17',
      source: 'spiral',
    });
  }
  game.rings.length = 0;
  for (let i = 0; i < 3; i++) {
    game.rings.push({
      x: 0,
      y: 0,
      r: 90 + i * 70,
      speed: 150,
      thickness: 14,
      dmg: 12,
      maxR: 420,
      hostile: true,
      hitDone: false,
    });
  }
  game.meteors.length = 0;
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    game.meteors.push({
      x: Math.cos(angle) * 160,
      y: Math.sin(angle) * 160,
      fuse: 0.5,
      maxFuse: 1.1,
      r: 46,
      dmg: 18,
    });
  }
  game.particles.length = 0;
  for (let i = 0; i < 420; i++) {
    const angle = (i / 420) * Math.PI * 14;
    game.particles.push({
      x: Math.cos(angle) * 200 * ((i % 17) / 17),
      y: Math.sin(angle) * 200 * ((i % 13) / 13),
      vx: Math.cos(angle) * 40,
      vy: Math.sin(angle) * 40,
      life: 0.6,
      maxLife: 1,
      size: 3.2,
      sizeEnd: 0.6,
      color: i % 3 === 0 ? '#f0d78c' : '#e8a03c',
      glow: i % 2 === 0,
      shape: i % 5 === 0 ? 'spark' : 'circle',
      drag: 1,
      grav: 0,
    });
  }
  game.dmgNums.length = 0;
  for (let i = 0; i < 6; i++) {
    game.dmgNums.push({
      x: i * 18 - 50,
      y: -40 - i * 9,
      vy: -30,
      life: 0.7,
      maxLife: 1,
      text: '109',
      color: '#f0d78c',
      size: 22,
    });
  }
  game.render();
  return {
    particles: game.particles.length,
    projectiles: game.projectiles.length,
    meteors: game.meteors.length,
    rings: game.rings.length,
    dpr: game.dpr,
    width: game.w,
    height: game.h,
  };
}

function censusOneFrameInPage() {
  const game = window.__game;
  const proto = CanvasRenderingContext2D.prototype;
  const watched = [
    'createRadialGradient', 'createLinearGradient', 'fill', 'stroke',
    'fillRect', 'strokeRect', 'beginPath', 'arc', 'moveTo', 'lineTo',
    'save', 'restore', 'drawImage', 'fillText', 'translate', 'rotate',
    'setLineDash',
  ];
  const counts = {};
  const originals = {};
  let shadowDescriptor = null;
  let shadowBlurNonZero = 0;
  try {
    for (const method of watched) {
      originals[method] = proto[method];
      counts[method] = 0;
      proto[method] = function (...args) {
        counts[method]++;
        return originals[method].apply(this, args);
      };
    }
    shadowDescriptor = Object.getOwnPropertyDescriptor(proto, 'shadowBlur');
    Object.defineProperty(proto, 'shadowBlur', {
      configurable: true,
      enumerable: shadowDescriptor.enumerable,
      get: shadowDescriptor.get,
      set(value) {
        if (value) shadowBlurNonZero++;
        return shadowDescriptor.set.call(this, value);
      },
    });
    game.render();
  } finally {
    for (const method of watched) {
      if (originals[method]) proto[method] = originals[method];
    }
    if (shadowDescriptor) Object.defineProperty(proto, 'shadowBlur', shadowDescriptor);
  }
  counts.shadowBlurNonZero = shadowBlurNonZero;
  counts.drawCalls = counts.fill + counts.stroke + counts.fillRect
    + counts.strokeRect + counts.drawImage + counts.fillText;
  return counts;
}

function setTelegraphSceneInPage({ touch, weatherPhase }) {
  const game = window.__game;
  game.resetFight();
  cancelAnimationFrame(game.raf);
  game.raf = 0;
  game.paused = true;
  game.manualPaused = false;
  game.uiFocused = false;
  game.state = 'fight';
  game.input.isTouch = touch;
  game.hintT = 0;
  game.bannerT = 0;
  game.playerChainT = 0;
  game.redFlash = 0;
  game.goldFlash = 0;
  game.shakeAmp = 0;
  game.shakeT = 0;
  game.zoomPunch = 0;
  game.projectiles.length = 0;
  game.rings.length = 0;
  game.meteors.length = 0;
  game.particles.length = 0;
  game.dmgNums.length = 0;
  game.boss.phase = 2;
  game.boss.x = 0;
  game.boss.y = -70;
  game.boss.facing = Math.PI / 2;
  game.boss.hp = game.boss.maxHp * 0.55;
  game.boss.hurtFlash = 0;
  game.boss.recoil = 0;
  game.boss.state = 'windup';
  game.boss.attack = 'ring';
  game.boss.currentWindup = 0.9;
  game.boss.t = 0.45;
  game.player.x = 0;
  game.player.y = 230;
  game.player.facing = -Math.PI / 2;
  game.player.state = 'move';
  game.player.iframes = 0;
  game.weatherFromPhase = weatherPhase;
  game.weatherPhase = weatherPhase;
  game.weatherBlend = 1;
  game.camX = 0;
  game.camY = 0;
  game.baseZoom = Math.max(0.55, Math.min(1.35, Math.min(game.w / 1250, game.h / 900)));
  game.camZoom = game.baseZoom;
  game.render();
  return {
    width: game.w,
    height: game.h,
    dpr: game.dpr,
    zoom: game.camZoom,
    boss: { x: game.boss.x, y: game.boss.y },
    weatherPhase,
  };
}

function setBossProofStateInPage({ pose, touch }) {
  const game = window.__game;
  game.resetFight();
  cancelAnimationFrame(game.raf);
  game.raf = 0;
  game.paused = true;
  game.manualPaused = false;
  game.uiFocused = false;
  game.state = 'fight';
  game.input.isTouch = touch;
  game.time = 2.375;
  game.fightTime = 18;
  game.hintT = 0;
  game.bannerT = 0;
  game.playerChainT = 0;
  game.redFlash = 0;
  game.goldFlash = 0;
  game.shakeAmp = 0;
  game.shakeT = 0;
  game.zoomPunch = 0;
  game.projectiles.length = 0;
  game.rings.length = 0;
  game.meteors.length = 0;
  game.particles.length = 0;
  game.dmgNums.length = 0;
  game.motes.length = 0;
  game.weatherFromPhase = 1;
  game.weatherPhase = 1;
  game.weatherBlend = 1;
  game.boss.phase = pose.phase;
  game.boss.phase2Done = pose.phase >= 2;
  game.boss.phase3Done = pose.phase >= 3;
  game.boss.x = 0;
  game.boss.y = -70;
  game.boss.facing = 0;
  game.boss.hp = game.boss.maxHp * 0.62;
  game.boss.hurtFlash = 0;
  game.boss.recoil = 0;
  game.boss.recoilAng = 0;
  game.boss.state = pose.state;
  game.boss.attack = pose.attack;
  game.boss.t = pose.t;
  game.boss.currentWindup = pose.currentWindup;
  game.boss.haloSpent = pose.haloSpent;
  game.boss.secondSwordDraw = pose.secondSwordDraw;
  game.player.x = 0;
  game.player.y = 230;
  game.player.facing = -Math.PI / 2;
  game.player.state = 'move';
  game.player.iframes = 0;
  game.camX = 0;
  game.camY = 0;
  game.baseZoom = Math.max(0.55, Math.min(1.35, Math.min(game.w / 1250, game.h / 900)));
  game.camZoom = game.baseZoom;
  game.render();
  return {
    pose: pose.id,
    phase: game.boss.phase,
    state: game.boss.state,
    attack: game.boss.attack,
    t: game.boss.t,
    currentWindup: game.boss.currentWindup,
    haloSpent: game.boss.haloSpent,
    secondSwordDraw: game.boss.secondSwordDraw,
    time: game.time,
    camera: {
      x: game.camX,
      y: game.camY,
      zoom: game.camZoom,
      width: game.w,
      height: game.h,
      dpr: game.dpr,
    },
  };
}

function readAuthoritativeCombatStateInPage() {
  const game = window.__game;
  const boss = game.boss;
  const player = game.player;
  const audio = game.audio;
  const audioDebug = audio.debugState();
  return {
    persistedGracefell: localStorage.getItem('gracefell'),
    gameState: game.state,
    time: game.time,
    fightTime: game.fightTime,
    boss: {
      x: boss.x,
      y: boss.y,
      hp: boss.hp,
      maxHp: boss.maxHp,
      phase: boss.phase,
      state: boss.state,
      attack: boss.attack,
      t: boss.t,
      currentWindup: boss.currentWindup,
      haloSpent: boss.haloSpent,
      secondSwordDraw: boss.secondSwordDraw,
      recoil: boss.recoil,
      recoilAng: boss.recoilAng,
    },
    player: {
      x: player.x,
      y: player.y,
      hp: player.hp,
      maxHp: player.maxHp,
      stam: player.stam,
      maxStam: player.maxStam,
      state: player.state,
      iframes: player.iframes,
      comboStep: player.comboStep,
      comboWindow: player.comboWindow,
      queuedLightAttacks: player.queuedLightAttacks,
      rollSlashQueued: player.rollSlashQueued,
    },
    input: {
      confirmSequence: game.input.confirmSequence,
      terminalConfirmSequence: game.terminalConfirmSequence,
      held: { ...game.input.held },
      pressed: { ...game.input.pressed },
      buttonPressed: { ...game.input.btnPressed },
      taps: game.input.taps.map((tap) => ({ ...tap })),
      touchPoints: game.input.touchPoints.map((point) => ({ ...point })),
    },
    audio: {
      muted: audio.muted,
      musicVolume: audio.musicVolume,
      sfxVolume: audio.sfxVolume,
      phase: audio.phase,
      soundtrackMode: audioDebug.soundtrackMode,
      soundtrackPhase: audioDebug.soundtrackPhase,
      pendingSoundtrackPhase: audioDebug.pendingSoundtrackPhase,
    },
    encounterArrays: {
      projectiles: game.projectiles.length,
      rings: game.rings.length,
      meteors: game.meteors.length,
      particles: game.particles.length,
      damageNumbers: game.dmgNums.length,
    },
  };
}

function bossVisualProbeInPage() {
  const game = window.__game;
  const canvas = game.canvas || document.querySelector('canvas');
  const context = game.ctx || canvas.getContext('2d');
  const dpr = game.dpr;
  const centreX = (game.w / 2 + (game.boss.x - game.camX) * game.camZoom) * dpr;
  const centreY = (game.h / 2 + (game.boss.y - game.camY) * game.camZoom) * dpr;
  const radius = Math.max(52, game.boss.r * 3.6 * game.camZoom) * dpr;
  const x = Math.max(0, Math.floor(centreX - radius));
  const y = Math.max(0, Math.floor(centreY - radius));
  const width = Math.max(1, Math.min(canvas.width - x, Math.ceil(radius * 2)));
  const height = Math.max(1, Math.min(canvas.height - y, Math.ceil(radius * 2)));
  const pixels = context.getImageData(x, y, width, height).data;
  let signature = 2166136261;
  let brightPixels = 0;
  let chromaPixels = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    signature ^= r; signature = Math.imul(signature, 16777619);
    signature ^= g; signature = Math.imul(signature, 16777619);
    signature ^= b; signature = Math.imul(signature, 16777619);
    if (Math.max(r, g, b) >= 190) brightPixels++;
    if (Math.max(r, g, b) - Math.min(r, g, b) >= 35) chromaPixels++;
  }
  const coreRadius = Math.max(8, 13 * dpr);
  const coreX = Math.max(0, Math.floor(centreX - coreRadius));
  const coreY = Math.max(0, Math.floor(centreY - coreRadius));
  const coreWidth = Math.max(1, Math.min(canvas.width - coreX, Math.ceil(coreRadius * 2)));
  const coreHeight = Math.max(1, Math.min(canvas.height - coreY, Math.ceil(coreRadius * 2)));
  const core = context.getImageData(coreX, coreY, coreWidth, coreHeight).data;
  let brightCorePixels = 0;
  for (let index = 0; index < core.length; index += 4) {
    if (core[index] >= 170 && core[index + 1] >= 120 && core[index + 2] >= 65) {
      brightCorePixels++;
    }
  }
  return {
    signature: (signature >>> 0).toString(16).padStart(8, '0'),
    crop: { x, y, width, height },
    brightPixels,
    chromaPixels,
    brightCorePixels,
  };
}

function telegraphBoundaryCoverageInPage() {
  const game = window.__game;
  const canvas = game.canvas || document.querySelector('canvas');
  const context = game.ctx || canvas.getContext('2d');
  const saved = {
    state: game.boss.state,
    attack: game.boss.attack,
    t: game.boss.t,
    currentWindup: game.boss.currentWindup,
  };
  game.boss.state = 'recover';
  game.render();
  const withoutTell = context.getImageData(0, 0, canvas.width, canvas.height).data;
  game.boss.state = 'windup';
  game.boss.attack = 'ring';
  game.boss.currentWindup = 0.9;
  game.boss.t = 0.45;
  game.render();
  const withTell = context.getImageData(0, 0, canvas.width, canvas.height).data;

  const dpr = game.dpr;
  const progress = 0.5;
  const worldRadius = 150 * progress;
  const screenRadius = worldRadius * game.camZoom * dpr;
  const centreX = (game.w / 2 + (game.boss.x - game.camX) * game.camZoom) * dpr;
  const centreY = (game.h / 2 + (game.boss.y - game.camY) * game.camZoom) * dpr;
  const samples = 48;
  let visible = 0;
  let minBestDifference = Number.POSITIVE_INFINITY;
  let totalBestDifference = 0;
  for (let sample = 0; sample < samples; sample++) {
    const angle = sample / samples * Math.PI * 2;
    let bestDifference = 0;
    for (let radial = -Math.ceil(3 * dpr); radial <= Math.ceil(3 * dpr); radial++) {
      const x = Math.round(centreX + Math.cos(angle) * (screenRadius + radial));
      const y = Math.round(centreY + Math.sin(angle) * (screenRadius + radial));
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
      const index = (y * canvas.width + x) * 4;
      const difference = Math.abs(withTell[index] - withoutTell[index])
        + Math.abs(withTell[index + 1] - withoutTell[index + 1])
        + Math.abs(withTell[index + 2] - withoutTell[index + 2]);
      bestDifference = Math.max(bestDifference, difference);
    }
    if (bestDifference >= 36) visible++;
    minBestDifference = Math.min(minBestDifference, bestDifference);
    totalBestDifference += bestDifference;
  }

  game.boss.state = saved.state;
  game.boss.attack = saved.attack;
  game.boss.t = saved.t;
  game.boss.currentWindup = saved.currentWindup;
  game.render();
  return {
    samples,
    visible,
    coverage: visible / samples,
    averageBestDifference: totalBestDifference / samples,
    minBestDifference,
    screenRadiusCss: screenRadius / dpr,
    centreCss: { x: centreX / dpr, y: centreY / dpr },
  };
}

function combatVisibilityInPage() {
  const game = window.__game;
  const canvas = game.canvas || document.querySelector('canvas');
  const context = game.ctx || canvas.getContext('2d');
  const domRect = (selector) => {
    const rect = document.querySelector(selector)?.getBoundingClientRect();
    return rect
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      : null;
  };
  const playerHud = game.playerHudRect();
  const utilities = {
    menu: domRect('.game-menu-toggle'),
    mix: domRect('.game-mix-toggle'),
    pause: domRect('.game-pause-toggle'),
    sound: game.soundButtonRect(),
  };
  const bossWidth = Math.max(280, Math.min(760, game.w * 0.62));
  const bossBar = {
    x: (game.w - bossWidth) / 2 - 2,
    y: game.h - (game.input.isTouch ? 248 : 64) - 26,
    width: bossWidth + 4,
    height: 46,
  };
  const touchButtons = game.input.isTouch
    ? game.touchLayout().btns.map((button) => ({
      id: button.id,
      x: button.x - button.r,
      y: button.y - button.r,
      width: button.r * 2,
      height: button.r * 2,
    }))
    : [];
  const inkRatio = (rect) => {
    const dpr = game.dpr;
    const x = Math.max(0, Math.floor(rect.x * dpr));
    const y = Math.max(0, Math.floor(rect.y * dpr));
    const width = Math.max(1, Math.min(canvas.width - x, Math.ceil(rect.width * dpr)));
    const height = Math.max(1, Math.min(canvas.height - y, Math.ceil(rect.height * dpr)));
    const pixels = context.getImageData(x, y, width, height).data;
    let ink = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 75) ink++;
    }
    return ink / (pixels.length / 4);
  };
  return {
    width: game.w,
    height: game.h,
    playerHud,
    bossBar,
    utilities,
    touchButtons,
    playerHudInkRatio: inkRatio(playerHud),
    bossBarInkRatio: inkRatio(bossBar),
  };
}

function proceduralFloorProbeInPage() {
  const game = window.__game;
  const floor = game.floorCanvas;
  let sampledInk = 0;
  if (floor) {
    const context = floor.getContext('2d');
    const pixels = context.getImageData(0, 0, floor.width, floor.height).data;
    const stride = Math.max(4, Math.floor(pixels.length / 12000 / 4) * 4);
    for (let index = 0; index < pixels.length; index += stride) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 40) sampledInk++;
    }
  }
  return {
    hasFloorCanvas: Boolean(floor),
    width: floor?.width || 0,
    height: floor?.height || 0,
    sampledInk,
  };
}

function rectsOverlap(a, b) {
  return Boolean(a && b
    && a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y);
}

async function waitForCandidateSettled(page) {
  await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 20000 });
  await page.waitForFunction(() => {
    if (new URLSearchParams(location.search).get('visual') === 'procedural') return true;
    const game = window.__game;
    const candidate = window.__graceVisualDiagnostics
      || game?.visualDiagnostics
      || game?.visualDebugState
      || game?.visualSnapshot
      || game?.visualDebug
      || game?.visualState;
    if (!candidate) return false;
    try {
      const value = typeof candidate === 'function' ? candidate.call(game) : candidate;
      const state = value?.arena?.state
        || value?.arena?.assets?.base?.state
        || value?.arenaAsset?.state
        || value?.asset?.state
        || value?.arenaStatus;
      return ['ready', 'loaded', 'fallback', 'failed', 'error'].includes(String(state || '').toLowerCase());
    } catch {
      return true;
    }
  }, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function waitForBossSettled(page, expectation = 'asset-ready') {
  await page.waitForFunction(({ expectation: expected }) => {
    const game = window.__game;
    if (!game?.visualDebugState) return false;
    const diagnostic = game.visualDebugState();
    const three = diagnostic?.boss?.three;
    if (expected === 'none') return Boolean(diagnostic?.boss);
    if (expected === 'released') return three?.released === true && three?.renderer == null;
    if (expected === 'procedural-fallback') {
      return three?.renderer?.modelState === expected || three?.released === true;
    }
    return three?.renderer?.modelState === expected;
  }, { expectation }, { timeout: 10000 });
  await page.waitForTimeout(100);
}

async function runVariant(browser, viewport, variant) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    hasTouch: viewport.touch,
    isMobile: viewport.touch,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(variant.url, { waitUntil: 'load' });
  const gesture = await performFirstGesture(page, viewport.touch);
  await waitForCandidateSettled(page);

  const diagnostics = await page.evaluate(readVisualDiagnosticsInPage);
  const surfaces = await page.evaluate(surfaceInventoryInPage);
  const perfScene = await page.evaluate(buildPinnedPerfSceneInPage, 32);
  const census = await page.evaluate(censusOneFrameInPage);
  const censusRepeat = await page.evaluate(censusOneFrameInPage);

  const quietScene = await page.evaluate(setTelegraphSceneInPage, {
    touch: viewport.touch,
    weatherPhase: 1,
  });
  await page.waitForTimeout(300);
  const quietBoundary = await page.evaluate(telegraphBoundaryCoverageInPage);
  const visibility = await page.evaluate(combatVisibilityInPage);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `${viewport.name}-${variant.name}-ring-quiet.png`),
  });

  const severeScene = await page.evaluate(setTelegraphSceneInPage, {
    touch: viewport.touch,
    weatherPhase: 3,
  });
  const severeBoundary = await page.evaluate(telegraphBoundaryCoverageInPage);
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `${viewport.name}-${variant.name}-ring-severe.png`),
  });

  const result = {
    url: variant.url,
    gesture,
    diagnostics,
    surfaces,
    perf: {
      scene: perfScene,
      census,
      censusRepeat,
      deterministic: JSON.stringify(census) === JSON.stringify(censusRepeat),
    },
    telegraph: {
      quiet: { scene: quietScene, boundary: quietBoundary },
      severe: { scene: severeScene, boundary: severeBoundary },
    },
    visibility,
    consoleErrors,
    pageErrors,
  };
  await context.close();
  return result;
}

async function runBossProofMode(browser, viewport, bossMode) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    hasTouch: viewport.touch,
    isMobile: viewport.touch,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const url = appendQuery(
    BASE_URL,
    `visual=arena-bake&boss=${bossMode}&visualQa=boss-comparison`,
  );
  await page.goto(url, { waitUntil: 'load' });
  const gesture = await performFirstGesture(page, viewport.touch);
  await waitForCandidateSettled(page);
  await waitForBossSettled(page, bossMode === 'blender-three' ? 'asset-ready' : 'none');

  const poses = {};
  for (let index = 0; index < BOSS_PROOF_STATES.length; index++) {
    const pose = BOSS_PROOF_STATES[index];
    const state = await page.evaluate(setBossProofStateInPage, {
      pose,
      touch: viewport.touch,
    });
    if (index === 0) await page.waitForTimeout(300);
    const authoritativeBefore = await page.evaluate(readAuthoritativeCombatStateInPage);
    const firstProbe = await page.evaluate(bossVisualProbeInPage);
    await page.evaluate(() => window.__game.render());
    const secondProbe = await page.evaluate(bossVisualProbeInPage);
    const census = await page.evaluate(censusOneFrameInPage);
    const censusRepeat = await page.evaluate(censusOneFrameInPage);
    const diagnostics = await page.evaluate(readVisualDiagnosticsInPage);
    const authoritativeAfter = await page.evaluate(readAuthoritativeCombatStateInPage);
    const screenshot = path.join(
      ARTIFACT_DIR,
      `${viewport.name}-boss-${bossMode}-${pose.id}.png`,
    );
    await page.screenshot({ path: screenshot });
    poses[pose.id] = {
      state,
      authoritativeBefore,
      authoritativeAfter,
      renderSideEffects: JSON.stringify(authoritativeBefore) !== JSON.stringify(authoritativeAfter),
      diagnostics,
      probe: firstProbe,
      repeatProbe: secondProbe,
      deterministicPixels: firstProbe.signature === secondProbe.signature,
      census,
      censusRepeat,
      deterministicCensus: JSON.stringify(census) === JSON.stringify(censusRepeat),
      screenshot,
    };
  }

  const result = {
    url,
    gesture,
    viewport,
    bossMode,
    poses,
    surfaces: await page.evaluate(surfaceInventoryInPage),
    consoleErrors,
    pageErrors,
  };
  await context.close();
  return result;
}

async function runCorruptModelFallback(browser) {
  const viewport = VIEWPORTS[0];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    hasTouch: true,
    isMobile: true,
  });
  const interceptedUrls = [];
  await context.route('**/art/models/malakar.glb*', (route) => {
    interceptedUrls.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'model/gltf-binary',
      body: Buffer.from('gracefell-qa-invalid-glb'),
    });
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const url = appendQuery(
    BASE_URL,
    'visual=arena-bake&boss=blender-three&visualQa=corrupt-glb',
  );
  await page.goto(url, { waitUntil: 'load' });
  const gesture = await performFirstGesture(page, true);
  await waitForCandidateSettled(page);
  await waitForBossSettled(page, 'procedural-fallback');
  const state = await page.evaluate(setBossProofStateInPage, {
    pose: BOSS_PROOF_STATES[0],
    touch: true,
  });
  await waitForBossSettled(page, 'released');
  const diagnostics = await page.evaluate(readVisualDiagnosticsInPage);
  const probe = await page.evaluate(bossVisualProbeInPage);
  const screenshot = path.join(ARTIFACT_DIR, 'mobile-boss-blender-three-corrupt-glb-fallback.png');
  await page.screenshot({ path: screenshot });
  const result = {
    url,
    gesture,
    interceptedUrls,
    state,
    diagnostics,
    probe,
    screenshot,
    surfaces: await page.evaluate(surfaceInventoryInPage),
    consoleErrors,
    pageErrors,
  };
  await context.close();
  return result;
}

async function runContextLifecycle(browser) {
  const viewport = VIEWPORTS[0];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const url = appendQuery(
    BASE_URL,
    'visual=arena-bake&boss=blender-three&visualQa=context-lifecycle',
  );
  await page.goto(url, { waitUntil: 'load' });
  const gesture = await performFirstGesture(page, true);
  await waitForCandidateSettled(page);
  await waitForBossSettled(page, 'asset-ready');
  const state = await page.evaluate(setBossProofStateInPage, {
    pose: BOSS_PROOF_STATES[2],
    touch: true,
  });
  const before = await page.evaluate(readVisualDiagnosticsInPage);
  const lossRequest = await page.evaluate(() => {
    const game = window.__game;
    const proof = game.malakarThree;
    const renderer = proof?.renderer;
    const extension = renderer?.getContext?.().getExtension('WEBGL_lose_context');
    if (!extension) return { extensionAvailable: false, requested: false };
    window.__qaWebglLoseExtension = extension;
    extension.loseContext();
    return { extensionAvailable: true, requested: true };
  });
  if (lossRequest.extensionAvailable) {
    await page.waitForFunction(() => (
      window.__game?.malakarThree?.diagnostics?.().state === 'context-lost'
    ), null, { timeout: 10000 });
    await page.evaluate(() => window.__game.render());
  }
  const lost = await page.evaluate(readVisualDiagnosticsInPage);
  const lostProbe = await page.evaluate(bossVisualProbeInPage);
  const lostScreenshot = path.join(ARTIFACT_DIR, 'mobile-boss-blender-three-context-lost.png');
  await page.screenshot({ path: lostScreenshot });
  const restoreRequest = await page.evaluate(() => {
    const extension = window.__qaWebglLoseExtension;
    if (!extension) return { extensionAvailable: false, requested: false };
    extension.restoreContext();
    return { extensionAvailable: true, requested: true };
  });
  if (restoreRequest.extensionAvailable) {
    await page.waitForFunction(() => (
      window.__game?.malakarThree?.diagnostics?.().state === 'ready'
    ), null, { timeout: 10000 });
    await page.evaluate(() => window.__game.render());
  }
  const restored = await page.evaluate(readVisualDiagnosticsInPage);
  const restoredProbe = await page.evaluate(bossVisualProbeInPage);
  const restoredScreenshot = path.join(ARTIFACT_DIR, 'mobile-boss-blender-three-context-restored.png');
  await page.screenshot({ path: restoredScreenshot });
  const result = {
    url,
    gesture,
    state,
    before,
    lost: {
      event: lossRequest,
      diagnostics: lost,
      probe: lostProbe,
      screenshot: lostScreenshot,
    },
    restored: {
      event: restoreRequest,
      diagnostics: restored,
      probe: restoredProbe,
      screenshot: restoredScreenshot,
    },
    consoleErrors,
    pageErrors,
  };
  await context.close();
  return result;
}

async function runDelayedArenaLifecycle(browser) {
  const viewport = VIEWPORTS[0];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    hasTouch: true,
    isMobile: true,
  });
  const holds = {};
  const captured = {};
  const releases = {};
  for (const [id, pattern] of [
    ['base', '**/art/arena/arena-base.webp*'],
    ['phase2', '**/art/arena/phase-2-mask.webp*'],
    ['phase3', '**/art/arena/phase-3-mask.webp*'],
  ]) {
    captured[id] = new Promise((resolveCaptured) => {
      void context.route(pattern, (route) => {
        holds[id] = route.request().url();
        resolveCaptured();
        return new Promise((resolveRoute) => {
          releases[id] = async () => {
            await route.continue();
            resolveRoute();
          };
        });
      });
    });
  }
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const url = appendQuery(
    BASE_URL,
    'visual=arena-bake&boss=blender-canvas&visualQa=delayed-arena',
  );
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const gesture = await performFirstGesture(page, true);
  await Promise.all(Object.values(captured));
  const beforeFight = await page.evaluate(readVisualDiagnosticsInPage);
  const liveTransition = await page.evaluate(() => {
    const game = window.__game;
    game.resetFight();
    cancelAnimationFrame(game.raf);
    game.raf = 0;
    game.state = 'fight';
    game.paused = false;
    game.manualPaused = false;
    game.boss.phase = 2;
    game.deepenArena(2);
    game.render();
    return game.visualDebugState();
  });
  const midFight = await page.evaluate(readVisualDiagnosticsInPage);

  await releases.base();
  await page.waitForFunction(() => {
    const arena = window.__game?.visualDebugState?.().arena;
    return arena?.assets?.base?.state === 'ready' && arena?.pending === true;
  }, null, { timeout: 10000 });
  const baseReadyDuringFight = await page.evaluate(readVisualDiagnosticsInPage);

  await Promise.all([releases.phase2(), releases.phase3()]);
  await page.waitForFunction(() => {
    const arena = window.__game?.visualDebugState?.().arena;
    return arena?.assets?.phase2?.state === 'ready'
      && arena?.assets?.phase3?.state === 'ready';
  }, null, { timeout: 10000 });
  const masksReadyDuringFight = await page.evaluate(readVisualDiagnosticsInPage);

  const afterReset = await page.evaluate(() => {
    const game = window.__game;
    game.resetFight();
    game.render();
    return game.visualDebugState();
  });
  const afterResetDiagnostics = await page.evaluate(readVisualDiagnosticsInPage);
  const afterNextTransition = await page.evaluate(() => {
    const game = window.__game;
    game.state = 'fight';
    game.paused = false;
    game.boss.phase = 2;
    game.deepenArena(2);
    game.render();
    return game.visualDebugState();
  });
  const afterNextTransitionDiagnostics = await page.evaluate(readVisualDiagnosticsInPage);
  const screenshot = path.join(ARTIFACT_DIR, 'mobile-arena-delayed-load-next-transition.png');
  await page.screenshot({ path: screenshot });
  const result = {
    url,
    gesture,
    heldAssetUrls: holds,
    beforeFight,
    liveTransition,
    midFight,
    baseReadyDuringFight,
    masksReadyDuringFight,
    afterReset,
    afterResetDiagnostics,
    afterNextTransition,
    afterNextTransitionDiagnostics,
    screenshot,
    consoleErrors,
    pageErrors,
  };
  await context.close();
  return result;
}

async function runBaseUploadFailure(browser) {
  const viewport = VIEWPORTS[0];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const original = proto.drawImage;
    proto.drawImage = function (source, ...args) {
      if (source instanceof HTMLImageElement && /arena-base\.webp/i.test(source.currentSrc || source.src)) {
        throw new Error('qa synthetic arena base drawImage failure');
      }
      return original.call(this, source, ...args);
    };
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const url = appendQuery(
    BASE_URL,
    'visual=arena-bake&boss=blender-canvas&visualQa=base-upload-failure',
  );
  await page.goto(url, { waitUntil: 'load' });
  const gesture = await performFirstGesture(page, true);
  await waitForCandidateSettled(page);
  const diagnostics = await page.evaluate(readVisualDiagnosticsInPage);
  const floor = await page.evaluate(proceduralFloorProbeInPage);
  const screenshot = path.join(ARTIFACT_DIR, 'mobile-arena-base-upload-fallback.png');
  await page.screenshot({ path: screenshot });
  const result = {
    url,
    gesture,
    diagnostics,
    floor,
    screenshot,
    consoleErrors,
    pageErrors,
  };
  await context.close();
  return result;
}

async function runPhaseUploadFailure(browser) {
  const viewport = VIEWPORTS[0];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const original = proto.drawImage;
    proto.drawImage = function (source, ...args) {
      if (source instanceof HTMLImageElement && /phase-2-mask\.webp/i.test(source.currentSrc || source.src)) {
        throw new Error('qa synthetic arena phase drawImage failure');
      }
      return original.call(this, source, ...args);
    };
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const url = appendQuery(
    BASE_URL,
    'visual=arena-bake&boss=blender-canvas&visualQa=phase-upload-failure',
  );
  await page.goto(url, { waitUntil: 'load' });
  const gesture = await performFirstGesture(page, true);
  await waitForCandidateSettled(page);
  await page.waitForFunction(() => {
    const arena = window.__game?.visualDebugState?.().arena;
    return arena?.assets?.phase2?.state === 'ready';
  }, null, { timeout: 10000 });
  const before = await page.evaluate(readVisualDiagnosticsInPage);
  const transition = await page.evaluate(() => {
    const game = window.__game;
    game.resetFight();
    cancelAnimationFrame(game.raf);
    game.raf = 0;
    game.state = 'fight';
    game.paused = false;
    game.boss.phase = 2;
    game.deepenArena(2);
    game.render();
    return game.visualDebugState();
  });
  const diagnostics = await page.evaluate(readVisualDiagnosticsInPage);
  const screenshot = path.join(ARTIFACT_DIR, 'mobile-arena-phase-upload-fallback.png');
  await page.screenshot({ path: screenshot });
  const result = {
    url,
    gesture,
    before,
    transition,
    diagnostics,
    screenshot,
    consoleErrors,
    pageErrors,
  };
  await context.close();
  return result;
}

async function runFallback(browser) {
  const viewport = VIEWPORTS[0];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    hasTouch: true,
    isMobile: true,
  });
  // Return bytes with a successful transport but an invalid image payload.
  // This exercises decode fallback without accepting an uncaught 404 as normal.
  await context.route('**/art/arena/**', (route) => route.fulfill({
    status: 200,
    contentType: 'image/webp',
    body: Buffer.from('gracefell-qa-invalid-image'),
  }));
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const url = appendQuery(BASE_URL, `${ARENA_QUERY}&qaAssetFailure=decode`);
  await page.goto(url, { waitUntil: 'load' });
  const gesture = await performFirstGesture(page, true);
  await waitForCandidateSettled(page);
  const diagnostics = await page.evaluate(readVisualDiagnosticsInPage);
  await page.evaluate(setTelegraphSceneInPage, { touch: true, weatherPhase: 3 });
  const floor = await page.evaluate(proceduralFloorProbeInPage);
  const boundary = await page.evaluate(telegraphBoundaryCoverageInPage);
  const surfaces = await page.evaluate(surfaceInventoryInPage);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile-arena-bake-fallback.png') });
  await context.close();
  return {
    url,
    gesture,
    diagnostics,
    floor,
    boundary,
    surfaces,
    consoleErrors,
    pageErrors,
  };
}

function validateAsset(asset, receipt) {
  if (asset.required && (!receipt.ok || receipt.status !== 200)) {
    addError(`asset ${asset.pathname} is required but returned ${receipt.status || 'no response'}`);
    return;
  }
  if (!receipt.ok) return;
  if (!(new RegExp(asset.contentTypePattern, 'i')).test(receipt.contentType)) {
    addError(`asset ${asset.pathname} has unexpected content type ${receipt.contentType || '(missing)'}`);
  }
  const requestVersion = new URL(receipt.url).searchParams.get('v');
  const responseVersion = receipt.responseUrl
    ? new URL(receipt.responseUrl).searchParams.get('v')
    : null;
  if (requestVersion !== EXPECTED_VISUAL_ASSET_VERSION
    || responseVersion !== EXPECTED_VISUAL_ASSET_VERSION) {
    addError(`asset ${asset.pathname} was not served with v=${EXPECTED_VISUAL_ASSET_VERSION}: ${receipt.responseUrl || receipt.url}`);
  }
  if (!/\bpublic\b/i.test(receipt.cacheControl)
    || !/\bmax-age=31536000\b/i.test(receipt.cacheControl)
    || !/\bimmutable\b/i.test(receipt.cacheControl)) {
    addError(`asset ${asset.pathname} lacks the immutable one-year cache contract: ${receipt.cacheControl || '(missing)'}`);
  }
  if (asset.kind === 'image' && (receipt.decodeError || !receipt.width || !receipt.height)) {
    addError(`asset ${asset.pathname} did not decode: ${receipt.decodeError || 'dimensions unavailable'}`);
  }
  if (receipt.bytes > asset.maxBytes) {
    addError(`asset ${asset.pathname} is ${receipt.bytes} bytes; budget is ${asset.maxBytes}`);
  }
  if (asset.width && (receipt.width !== asset.width || receipt.height !== asset.height)) {
    addError(`asset ${asset.pathname} is ${receipt.width}x${receipt.height}; required ${asset.width}x${asset.height}`);
  }
  if (asset.maxWidth && (receipt.width > asset.maxWidth || receipt.height > asset.maxHeight)) {
    addError(`asset ${asset.pathname} is ${receipt.width}x${receipt.height}; maximum is ${asset.maxWidth}x${asset.maxHeight}`);
  }
}

function validateDiagnostics(label, diagnostics, expectedActive, options = {}) {
  if (!diagnostics.source) {
    addError(`${label}: required visual diagnostics are missing`);
    return;
  }
  if (diagnostics.error) addError(`${label}: visual diagnostics threw: ${diagnostics.error}`);
  if (!options.allowImplicitDefault && diagnostics.query.visual !== 'arena-bake') {
    addError(`${label}: visual query was not retained: ${JSON.stringify(diagnostics.query)}`);
  }
  if (!diagnostics.requestedVisual) {
    addError(`${label}: diagnostics do not disclose requestedVisual`);
  } else if (!diagnostics.requestedVisual.toLowerCase().includes('arena')) {
    addError(`${label}: requestedVisual is not arena-bake: ${diagnostics.requestedVisual}`);
  }
  if (!diagnostics.activeVisual) {
    addError(`${label}: diagnostics do not disclose activeVisual`);
  } else if (expectedActive === 'arena'
    && !diagnostics.activeVisual.toLowerCase().includes('arena')) {
    addError(`${label}: arena-bake did not become active: ${diagnostics.activeVisual}`);
  } else if (expectedActive === 'procedural'
    && !/(procedural|classic|fallback|canvas)/i.test(diagnostics.activeVisual)) {
    addError(`${label}: decode failure did not activate procedural fallback: ${diagnostics.activeVisual}`);
  }
  if (expectedActive === 'arena' && diagnostics.arenaApplied !== true) {
    addError(`${label}: ready arena asset was not applied to the cached floor`);
  } else if (expectedActive === 'procedural' && diagnostics.arenaApplied === true) {
    addError(`${label}: failed arena asset is incorrectly reported as applied`);
  }
  if (!diagnostics.arenaState) {
    addError(`${label}: diagnostics do not disclose arena asset state`);
  } else if (expectedActive === 'arena'
    && !/(ready|loaded)/i.test(diagnostics.arenaState)) {
    addError(`${label}: arena asset is not ready: ${diagnostics.arenaState}`);
  } else if (expectedActive === 'procedural'
    && !/(fallback|failed|error)/i.test(diagnostics.arenaState)) {
    addError(`${label}: failed asset state is not truthful: ${diagnostics.arenaState}`);
  }
  validateVersionedUrl(`${label} arena`, diagnostics.arenaUrl);
}

function validateVersionedUrl(label, url) {
  if (!url) {
    addError(`${label}: versioned asset URL is missing`);
    return;
  }
  try {
    const parsed = new URL(url, BASE_URL);
    if (parsed.searchParams.get('v') !== EXPECTED_VISUAL_ASSET_VERSION) {
      addError(`${label}: expected v=${EXPECTED_VISUAL_ASSET_VERSION}, received ${parsed.href}`);
    }
  } catch (error) {
    addError(`${label}: invalid asset URL ${url}: ${error.message}`);
  }
}

function validateFirstGesture(label, gesture, touch) {
  if (!gesture
    || gesture.kind !== (touch ? 'touch' : 'pointer')
    || gesture.before.audio.initialized
    || !gesture.after.trusted
    || !gesture.after.audio.initialized) {
    addError(`${label}: real first-interaction audio unlock was not observed: ${JSON.stringify(gesture)}`);
    return;
  }
  if (gesture.after.visualProofsPrepared
    || !gesture.after.visualTimerPending
    || gesture.after.arenaAssetsAllocated
    || gesture.after.threeAllocated) {
    addError(`${label}: visual asset preparation entered the synchronous first-gesture window: ${JSON.stringify(gesture.after)}`);
  }
}

function validateBossProof(label, proof) {
  validateFirstGesture(label, proof.gesture, proof.viewport.touch);
  const signatures = new Set();
  for (const pose of BOSS_PROOF_STATES) {
    const receipt = proof.poses[pose.id];
    if (!receipt) {
      addError(`${label}: missing ${pose.id} proof receipt`);
      continue;
    }
    const diagnostic = receipt.diagnostics;
    if (diagnostic.query.boss !== proof.bossMode
      || diagnostic.requestedBoss !== proof.bossMode) {
      addError(`${label} ${pose.id}: boss query/diagnostic mismatch: ${JSON.stringify({
        query: diagnostic.query.boss,
        requested: diagnostic.requestedBoss,
      })}`);
    }
    const expectedActive = proof.bossMode;
    if (diagnostic.activeBoss !== expectedActive) {
      addError(`${label} ${pose.id}: active boss ${diagnostic.activeBoss || '(missing)'}; expected ${expectedActive}`);
    }
    if (!receipt.deterministicPixels) {
      addError(`${label} ${pose.id}: repeated pinned renders changed pixel signature`);
    }
    if (!receipt.deterministicCensus) {
      addError(`${label} ${pose.id}: repeated pinned renders changed Canvas operation census`);
    }
    if (receipt.renderSideEffects) {
      addError(`${label} ${pose.id}: presentation render mutated authoritative combat state: ${JSON.stringify({
        before: receipt.authoritativeBefore,
        after: receipt.authoritativeAfter,
      })}`);
    }
    if (receipt.probe.brightCorePixels < 1) {
      addError(`${label} ${pose.id}: no readable warm core pixels at the authoritative boss root`);
    }
    signatures.add(receipt.probe.signature);
    if (receipt.state.phase !== pose.phase
      || receipt.state.state !== pose.state
      || receipt.state.attack !== pose.attack
      || receipt.state.haloSpent !== pose.haloSpent
      || receipt.state.secondSwordDraw !== pose.secondSwordDraw) {
      addError(`${label} ${pose.id}: pinned gameplay state drifted: ${JSON.stringify(receipt.state)}`);
    }
    validateVersionedUrl(`${label} ${pose.id} arena`, diagnostic.arenaUrl);
    if (proof.bossMode === 'blender-three') {
      if (diagnostic.threeState !== 'ready'
        || diagnostic.rendererState !== 'ready'
        || diagnostic.modelState !== 'asset-ready') {
        addError(`${label} ${pose.id}: Three renderer is not asset-ready: ${JSON.stringify({
          engine: diagnostic.threeState,
          renderer: diagnostic.rendererState,
          model: diagnostic.modelState,
        })}`);
      }
      validateVersionedUrl(`${label} ${pose.id} model`, diagnostic.modelUrl);
      if (!diagnostic.rendererCanvas
        || diagnostic.rendererCanvas.width !== 256
        || diagnostic.rendererCanvas.height !== 256) {
        addError(`${label} ${pose.id}: Three proof surface is not the bounded 256x256 target: ${JSON.stringify(diagnostic.rendererCanvas)}`);
      }
      if (!(diagnostic.rendererTriangles > 0 && diagnostic.rendererTriangles <= 5000)) {
        addError(`${label} ${pose.id}: Three triangle receipt ${diagnostic.rendererTriangles} is outside 1..5000`);
      }
      if (!(diagnostic.rendererDrawCalls > 0 && diagnostic.rendererDrawCalls <= 45)) {
        addError(`${label} ${pose.id}: Three draw-call receipt ${diagnostic.rendererDrawCalls} is outside 1..45`);
      }
      if (!Number.isFinite(diagnostic.rendererGeometries)
        || !Number.isFinite(diagnostic.rendererTextures)) {
        addError(`${label} ${pose.id}: Three memory diagnostics are missing: ${JSON.stringify({
          geometries: diagnostic.rendererGeometries,
          textures: diagnostic.rendererTextures,
        })}`);
      }
      if (!(diagnostic.rendererRenders > 0)) {
        addError(`${label} ${pose.id}: Three renderer did not report a completed render`);
      }
    }
  }
  if (signatures.size !== BOSS_PROOF_STATES.length) {
    addError(`${label}: five authored states produced only ${signatures.size} unique pixel signatures`);
  }
  if (proof.consoleErrors.length || proof.pageErrors.length) {
    addError(`${label}: page/console errors: ${JSON.stringify({
      console: proof.consoleErrors,
      page: proof.pageErrors,
    })}`);
  }
}

function validateCorruptModelFallback(result) {
  const label = 'mobile corrupt-GLB fallback';
  validateFirstGesture(label, result.gesture, true);
  const diagnostic = result.diagnostics;
  if (diagnostic.requestedBoss !== 'blender-three'
    || diagnostic.activeBoss !== 'blender-canvas-fallback') {
    addError(`${label}: expected requested blender-three and active blender-canvas-fallback: ${JSON.stringify({
      requested: diagnostic.requestedBoss,
      active: diagnostic.activeBoss,
    })}`);
  }
  if (diagnostic.threeState !== 'fallback'
    || diagnostic.threeReleased !== true
    || diagnostic.raw?.boss?.three?.renderer != null) {
    addError(`${label}: permanent failed WebGL proof was not released: ${JSON.stringify(diagnostic.raw?.boss?.three)}`);
  }
  if (result.probe.brightCorePixels < 1) {
    addError(`${label}: Canvas fallback did not preserve the readable boss core`);
  }
  if (!result.interceptedUrls.length) {
    addError(`${label}: model request was not intercepted`);
  }
  for (const url of result.interceptedUrls) validateVersionedUrl(`${label} intercepted model`, url);
  if (result.consoleErrors.length || result.pageErrors.length) {
    addError(`${label}: page/console errors: ${JSON.stringify({
      console: result.consoleErrors,
      page: result.pageErrors,
    })}`);
  }
}

function validateContextLifecycle(result) {
  const label = 'mobile WebGL context lifecycle';
  validateFirstGesture(label, result.gesture, true);
  if (result.before.activeBoss !== 'blender-three'
    || result.before.threeState !== 'ready'
    || result.before.rendererState !== 'ready') {
    addError(`${label}: precondition was not an active ready Three renderer`);
  }
  if (!result.lost.event.extensionAvailable
    || !result.lost.event.requested
    || result.lost.diagnostics.activeBoss !== 'blender-canvas-fallback'
    || result.lost.diagnostics.threeState !== 'fallback'
    || result.lost.diagnostics.rendererState !== 'context-lost'
    || result.lost.diagnostics.threeReleased === true) {
    addError(`${label}: context loss did not retain a recoverable proof behind Canvas fallback: ${JSON.stringify({
      event: result.lost.event,
      diagnostics: result.lost.diagnostics.raw?.boss,
    })}`);
  }
  if (result.lost.probe.brightCorePixels < 1) {
    addError(`${label}: Canvas fallback lost the readable boss core`);
  }
  if (!result.restored.event.extensionAvailable
    || !result.restored.event.requested
    || result.restored.diagnostics.activeBoss !== 'blender-three'
    || result.restored.diagnostics.threeState !== 'ready'
    || result.restored.diagnostics.rendererState !== 'ready'
    || result.restored.diagnostics.modelState !== 'asset-ready'
    || result.restored.diagnostics.threeReleased === true) {
    addError(`${label}: restored context did not reactivate the authored Three proof: ${JSON.stringify(result.restored.diagnostics.raw?.boss)}`);
  }
  validateVersionedUrl(`${label} restored model`, result.restored.diagnostics.modelUrl);
  if (result.consoleErrors.length || result.pageErrors.length) {
    addError(`${label}: page/console errors: ${JSON.stringify({
      console: result.consoleErrors,
      page: result.pageErrors,
    })}`);
  }
}

function validateDelayedArenaLifecycle(result) {
  const label = 'mobile delayed arena lifecycle';
  validateFirstGesture(label, result.gesture, true);
  const noMutation = [
    ['before fight', result.beforeFight],
    ['mid-fight before release', result.midFight],
    ['base ready during fight', result.baseReadyDuringFight],
    ['masks ready during fight', result.masksReadyDuringFight],
  ];
  for (const [state, diagnostic] of noMutation) {
    if (diagnostic.arenaApplied !== false
      || (diagnostic.arenaStampedPhases || []).length !== 0) {
      addError(`${label} ${state}: late assets mutated the live arena: ${JSON.stringify({
        applied: diagnostic.arenaApplied,
        stamps: diagnostic.arenaStampedPhases,
      })}`);
    }
  }
  if (result.baseReadyDuringFight.arenaPending !== true
    || result.baseReadyDuringFight.arenaState !== 'ready') {
    addError(`${label}: ready late base was not queued during live combat`);
  }
  if (result.masksReadyDuringFight.arenaPending !== true
    || result.masksReadyDuringFight.raw?.arena?.assets?.phase2?.state !== 'ready'
    || result.masksReadyDuringFight.raw?.arena?.assets?.phase3?.state !== 'ready') {
    addError(`${label}: delayed masks/base did not settle without stamping`);
  }
  if (result.afterResetDiagnostics.arenaApplied !== true
    || result.afterResetDiagnostics.arenaPending !== false
    || (result.afterResetDiagnostics.arenaStampedPhases || []).length !== 0) {
    addError(`${label}: reset did not atomically apply the queued base while keeping masks unstamped`);
  }
  if (!(result.afterNextTransitionDiagnostics.arenaStampedPhases || []).includes(2)) {
    addError(`${label}: ready Phase-2 mask did not stamp at the next authored transition`);
  }
  for (const [id, url] of Object.entries(result.heldAssetUrls)) {
    validateVersionedUrl(`${label} held ${id}`, url);
  }
  if (result.consoleErrors.length || result.pageErrors.length) {
    addError(`${label}: page/console errors: ${JSON.stringify({
      console: result.consoleErrors,
      page: result.pageErrors,
    })}`);
  }
}

function validateUploadFallbacks(base, phase) {
  validateFirstGesture('mobile arena base upload failure', base.gesture, true);
  validateFirstGesture('mobile arena phase upload failure', phase.gesture, true);
  if (base.diagnostics.arenaState !== 'fallback'
    || base.diagnostics.arenaApplied !== false
    || base.floor.sampledInk < 10
    || !/synthetic arena base drawImage failure/i.test(base.diagnostics.fallbackReason || '')) {
    addError(`mobile arena base upload failure did not preserve procedural fallback: ${JSON.stringify({
      diagnostics: base.diagnostics,
      floor: base.floor,
    })}`);
  }
  if (base.consoleErrors.length || base.pageErrors.length) {
    addError(`mobile arena base upload failure escaped to page/console errors`);
  }
  const phaseError = phase.diagnostics.arenaOverlayErrors?.[2]
    || phase.diagnostics.arenaOverlayErrors?.['2'];
  if (phase.before.arenaApplied !== true
    || (phase.diagnostics.arenaStampedPhases || []).includes(2)
    || !/synthetic arena phase drawImage failure/i.test(phaseError || '')) {
    addError(`mobile arena phase upload failure was not contained and diagnosed: ${JSON.stringify({
      beforeApplied: phase.before.arenaApplied,
      stamps: phase.diagnostics.arenaStampedPhases,
      errors: phase.diagnostics.arenaOverlayErrors,
    })}`);
  }
  if (phase.consoleErrors.length || phase.pageErrors.length) {
    addError(`mobile arena phase upload failure escaped to page/console errors`);
  }
}

function validateVisibility(label, result) {
  for (const weather of ['quiet', 'severe']) {
    const boundary = result.telegraph[weather].boundary;
    if (boundary.coverage < 0.9) {
      addError(`${label}: ring boundary coverage under ${weather} weather is ${(boundary.coverage * 100).toFixed(1)}%; minimum is 90%`);
    }
  }
  const visibility = result.visibility;
  for (const [id, utility] of Object.entries(visibility.utilities)) {
    if (!utility) {
      addError(`${label}: ${id} utility is missing`);
      continue;
    }
    if (utility.width < 44 || utility.height < 44
      || utility.x < 0 || utility.y < 0
      || utility.x + utility.width > visibility.width + 1
      || utility.y + utility.height > visibility.height + 1) {
      addError(`${label}: ${id} utility is clipped or below fingertip size: ${JSON.stringify(utility)}`);
    }
    if (rectsOverlap(utility, visibility.playerHud)) {
      addError(`${label}: ${id} utility obscures player resources`);
    }
  }
  if (visibility.playerHudInkRatio < 0.03) {
    addError(`${label}: player HUD has insufficient visible ink (${visibility.playerHudInkRatio.toFixed(4)})`);
  }
  if (visibility.bossBarInkRatio < 0.03) {
    addError(`${label}: boss HUD has insufficient visible ink (${visibility.bossBarInkRatio.toFixed(4)})`);
  }
  for (const button of visibility.touchButtons) {
    if (rectsOverlap(button, visibility.bossBar)) {
      addError(`${label}: ${button.id} touch control obscures the boss HUD`);
    }
  }
  if (result.consoleErrors.length || result.pageErrors.length) {
    addError(`${label}: page/console errors: ${JSON.stringify({
      console: result.consoleErrors,
      page: result.pageErrors,
    })}`);
  }
}

function validatePerf(viewportName, baseline, candidate) {
  const label = `${viewportName} render cost`;
  if (!baseline.perf.deterministic) {
    addError(`${label}: procedural op census is not deterministic: ${JSON.stringify({
      first: baseline.perf.census,
      second: baseline.perf.censusRepeat,
    })}`);
  }
  if (!candidate.perf.deterministic) {
    addError(`${label}: candidate op census is not deterministic: ${JSON.stringify({
      first: candidate.perf.census,
      second: candidate.perf.censusRepeat,
    })}`);
  }
  const comparison = { baseline: baseline.perf.census, candidate: candidate.perf.census, delta: {} };
  for (const [metric, maximum] of Object.entries(MAX_CANDIDATE_DELTA)) {
    const delta = (candidate.perf.census[metric] || 0) - (baseline.perf.census[metric] || 0);
    comparison.delta[metric] = delta;
    if (delta > maximum) {
      addError(`${label}: ${metric} increased by ${delta}; maximum candidate delta is ${maximum}`);
    }
  }
  for (const [metric, maximum] of Object.entries(ABSOLUTE_PERF_CAPS)) {
    if ((candidate.perf.census[metric] || 0) > maximum) {
      addError(`${label}: candidate ${metric} ${candidate.perf.census[metric]} exceeds absolute cap ${maximum}`);
    }
  }
  if (candidate.surfaces.domCanvasCount !== baseline.surfaces.domCanvasCount) {
    addError(`${label}: candidate changed DOM canvas count from ${baseline.surfaces.domCanvasCount} to ${candidate.surfaces.domCanvasCount}`);
  }
  if (candidate.surfaces.totalPixels > baseline.surfaces.totalPixels) {
    addError(`${label}: candidate added permanent Canvas pixels (${baseline.surfaces.totalPixels} -> ${candidate.surfaces.totalPixels})`);
  }
  comparison.surfacePixels = {
    baseline: baseline.surfaces.totalPixels,
    candidate: candidate.surfaces.totalPixels,
    delta: candidate.surfaces.totalPixels - baseline.surfaces.totalPixels,
  };
  out.performance.comparisons[viewportName] = comparison;
}

(async () => {
  out.performance.v224Receipt = readPerfReceipt();
  let browser = null;
  try {
    const healthUrl = new URL('/health', BASE_URL);
    const healthResponse = await fetch(healthUrl);
    if (!healthResponse.ok) throw new Error(`health returned ${healthResponse.status}`);

    const launchOptions = { headless: true, args: ['--no-sandbox'] };
    if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
    }
    browser = await chromium.launch(launchOptions);

    const assetContext = await browser.newContext();
    const assetPage = await assetContext.newPage();
    await assetPage.goto(BASE_URL, { waitUntil: 'load' });
    out.productionDefaultGesture = await performFirstGesture(assetPage, false);
    validateFirstGesture('production default', out.productionDefaultGesture, false);
    await waitForCandidateSettled(assetPage);
    out.productionDefault = await assetPage.evaluate(readVisualDiagnosticsInPage);
    validateDiagnostics('production default', out.productionDefault, 'arena', {
      allowImplicitDefault: true,
    });
    if (out.productionDefault.requestedBoss !== 'blender-canvas'
      || out.productionDefault.activeBoss !== 'blender-canvas') {
      addError(`production default did not select accepted Blender-to-Canvas Malakar: ${JSON.stringify({
        requested: out.productionDefault.requestedBoss,
        active: out.productionDefault.activeBoss,
      })}`);
    }
    for (const asset of ASSETS) {
      const receipt = await inspectAsset(assetPage, asset);
      out.assets[asset.id] = { spec: asset, receipt };
      validateAsset(asset, receipt);
    }
    out.unversionedArtCache = await assetPage.evaluate(async (url) => {
      const response = await fetch(url, { cache: 'no-store' });
      return {
        status: response.status,
        cacheControl: response.headers.get('cache-control') || '',
      };
    }, new URL('/art/arena/arena-base.webp', BASE_URL).href);
    if (out.unversionedArtCache.status !== 200
      || !/\bno-cache\b/i.test(out.unversionedArtCache.cacheControl)
      || /\bimmutable\b/i.test(out.unversionedArtCache.cacheControl)) {
      addError(`unversioned art must remain revalidatable: ${JSON.stringify(out.unversionedArtCache)}`);
    }
    const overlays = ARENA_ASSETS.slice(1)
      .map((asset) => out.assets[asset.id].receipt)
      .filter((receipt) => receipt.ok);
    const overlayBytes = overlays.reduce((sum, receipt) => sum + receipt.bytes, 0);
    out.assets.phaseOverlays = { present: overlays.length, combinedBytes: overlayBytes };
    if (overlayBytes > 400 * 1024) {
      addError(`phase overlays total ${overlayBytes} bytes; combined budget is ${400 * 1024}`);
    }
    await assetContext.close();

    for (const viewport of VIEWPORTS) {
      const baseline = await runVariant(browser, viewport, {
        name: 'procedural',
        url: appendQuery(BASE_URL, 'visual=procedural&boss=current&visualQa=baseline'),
      });
      const arenaControl = await runVariant(browser, viewport, {
        name: 'procedural-blender-canvas',
        url: appendQuery(
          BASE_URL,
          'visual=procedural&boss=blender-canvas&visualQa=arena-control',
        ),
      });
      const candidate = await runVariant(browser, viewport, {
        name: 'accepted',
        url: appendQuery(BASE_URL, `${ARENA_QUERY}&visualQa=candidate`),
      });
      out.variants[viewport.name] = { baseline, arenaControl, candidate };
      validateFirstGesture(`${viewport.name} procedural baseline`, baseline.gesture, viewport.touch);
      validateFirstGesture(`${viewport.name} procedural arena control`, arenaControl.gesture, viewport.touch);
      validateFirstGesture(`${viewport.name} accepted candidate`, candidate.gesture, viewport.touch);
      if (baseline.diagnostics.query.visual !== 'procedural'
        || baseline.diagnostics.requestedVisual !== 'procedural'
        || baseline.diagnostics.requestedBoss !== 'current'
        || baseline.diagnostics.activeBoss !== 'current') {
        addError(`${viewport.name} baseline did not remain explicit procedural/current: ${JSON.stringify(baseline.diagnostics.raw)}`);
      }
      validateDiagnostics(`${viewport.name} candidate`, candidate.diagnostics, 'arena');
      if (candidate.diagnostics.requestedBoss !== 'blender-canvas'
        || candidate.diagnostics.activeBoss !== 'blender-canvas') {
        addError(`${viewport.name} candidate did not use accepted Blender-to-Canvas Malakar`);
      }
      validateVisibility(`${viewport.name} candidate`, candidate);
      // Isolate the baked-floor cost: both sides use the accepted Canvas boss.
      validatePerf(viewport.name, arenaControl, candidate);
    }

    for (const viewport of VIEWPORTS) {
      out.bossProofs[viewport.name] = {};
      for (const bossMode of BOSS_MODES) {
        const proof = await runBossProofMode(browser, viewport, bossMode);
        out.bossProofs[viewport.name][bossMode] = proof;
        validateBossProof(`${viewport.name} ${bossMode} five-state proof`, proof);
      }
    }

    out.bossFallbacks.corruptModel = await runCorruptModelFallback(browser);
    validateCorruptModelFallback(out.bossFallbacks.corruptModel);
    out.bossFallbacks.contextLifecycle = await runContextLifecycle(browser);
    validateContextLifecycle(out.bossFallbacks.contextLifecycle);

    out.arenaLifecycle = await runDelayedArenaLifecycle(browser);
    validateDelayedArenaLifecycle(out.arenaLifecycle);
    out.uploadFallbacks.base = await runBaseUploadFailure(browser);
    out.uploadFallbacks.phase = await runPhaseUploadFailure(browser);
    validateUploadFallbacks(out.uploadFallbacks.base, out.uploadFallbacks.phase);

    out.fallback = await runFallback(browser);
    validateFirstGesture('mobile asset-failure fallback', out.fallback.gesture, true);
    validateDiagnostics('mobile asset-failure fallback', out.fallback.diagnostics, 'procedural');
    if (!out.fallback.floor.hasFloorCanvas || out.fallback.floor.sampledInk < 10) {
      addError(`mobile asset-failure fallback did not retain a procedural floor: ${JSON.stringify(out.fallback.floor)}`);
    }
    if (out.fallback.boundary.coverage < 0.9) {
      addError(`mobile asset-failure fallback ring coverage is ${(out.fallback.boundary.coverage * 100).toFixed(1)}%; minimum is 90%`);
    }
    if (out.fallback.consoleErrors.length || out.fallback.pageErrors.length) {
      addError(`mobile asset-failure fallback emitted page/console errors: ${JSON.stringify({
        console: out.fallback.consoleErrors,
        page: out.fallback.pageErrors,
      })}`);
    }

    out.ok = out.errors.length === 0;
    out.readiness = out.ok ? 'ready' : 'blocked';
  } catch (error) {
    addError(`harness failure: ${error?.stack || error}`);
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync(RESULT_PATH, JSON.stringify(out, null, 2));
    console.log(JSON.stringify({
      ok: out.ok,
      readiness: out.readiness,
      nErrors: out.errors.length,
      nWarnings: out.warnings.length,
      result: RESULT_PATH,
      artifacts: ARTIFACT_DIR,
    }));
    if (!out.ok) {
      for (const error of out.errors) console.error(`  - ${error}`);
      process.exitCode = 1;
    }
  }
})();

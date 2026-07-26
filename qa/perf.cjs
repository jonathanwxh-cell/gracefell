// GRACEFELL render-cost gate — portable across local machines and CI.
//
// ---------------------------------------------------------------------------
// Why this counts operations instead of timing them
// ---------------------------------------------------------------------------
// The v2.20 weather check times single `render()` calls and asserts a 0.5 ms
// median delta. Two properties of the platform make that unreliable as a gate:
// `performance.now()` is clamped to roughly 100 us, so one render is only a few
// ticks wide; and Canvas2D defers rasterisation, so timing a render call
// measures command submission rather than pixels. Measured frame-to-frame
// baseline drift on a developer laptop was +/-20% — an order of magnitude above
// the threshold being asserted.
//
// So the CI gate here is a DETERMINISTIC OP CENSUS. Canvas call counts for a
// pinned scene do not vary with machine load at all, which makes them a real
// tripwire. Timings are reported behind --timings for humans, never asserted.
//
// ---------------------------------------------------------------------------
// What this harness already found (v2.23) — do not re-litigate without evidence
// ---------------------------------------------------------------------------
// Four "obvious" Canvas2D optimisations were implemented and measured against
// this scene, interleaved block-by-block across simultaneously-served builds so
// machine drift hit every variant equally. A second copy of the SAME build was
// measured alongside as a control, to establish the noise floor:
//
//   control (identical build, measured as a variant) ... +0.5%   <- noise floor
//   pre-baked sprites for glow PARTICLES ............... +17.6%  <- REGRESSION
//   pre-baked sprite for the PROJECTILE glow ........... -1.5% / -3.5% (2 runs)
//   offset double-draw instead of shadowBlur on text ... -1.4%
//   baked static vignette instead of a gradient fill ... +1.9%
//
// Only the particle result is outside the noise, and it is a loss: converting
// ~500 small flat-colour arc fills into drawImage blits made the frame 17.6%
// slower. Everything else is indistinguishable from measuring the same build
// twice. None of the four shipped.
//
// The conclusion that matters: this renderer has no meaningful slack to
// reclaim. A worst-case phase-three frame costs about 1.7 ms on a desktop GPU
// at 390x844 dpr2 — roughly a tenth of a 16.7 ms budget. Do not gate new visual
// work on finding headroom in the draw path; the headroom is already there. The
// risks worth managing are per-frame ALLOCATION (GC pauses on phones) and
// low-end mobile GPUs, and neither is visible from a desktop timing run.
//
// The caps below are therefore runaway tripwires around the measured shipped
// state, not targets. They catch a new effect that allocates or draws per
// entity — the mistake this file exists to make expensive.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.GRACEFELL_URL || 'http://127.0.0.1:8491/';
const ARTIFACT_DIR = process.env.GRACEFELL_QA_DIR || path.join(os.tmpdir(), 'gracefell-qa');
const RESULT_PATH = process.env.GRACEFELL_PERF_RESULT || path.join(ARTIFACT_DIR, 'perf.json');
const WANT_TIMINGS = process.argv.includes('--timings');
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const out = { ok: false, errors: [], viewports: {} };

const VIEWPORTS = [
  { name: 'mobile', w: 390, h: 844, dpr: 2, touch: true },
  { name: 'desktop', w: 1280, h: 800, dpr: 1, touch: false },
];

// Measured on the shipped engine for the pinned scene below:
//   mobile  gradients=41 drawImage=2 shadowBlur=9 drawCalls=908
//   desktop gradients=41 drawImage=2 shadowBlur=9 drawCalls=889
// Caps carry roughly 20% headroom so honest unrelated work does not trip them.
const CAPS = {
  createRadialGradient: 52,
  shadowBlurNonZero: 12,
  drawCalls: 1100,
};

// The scene holds 32 projectiles. `createRadialGradient` currently scales with
// that count, which is the known cost and is inside the cap. This asserts it
// does not get WORSE per entity: adding a second per-projectile gradient would
// push the slope past the limit even though the absolute count still fits.
const MAX_GRADIENTS_PER_PROJECTILE = 1.2;

// A pinned scene: fixed counts, fixed positions, no Math.random, so the census
// is identical run to run and machine to machine.
function buildPinnedScene(projectileCount) {
  const g = window.__game;
  cancelAnimationFrame(g.raf); g.raf = 0; g.paused = true;
  g.state = 'fight';
  g.boss.phase = 3; g.boss.hp = g.boss.maxHp * 0.15; g.boss.haloSpent = 0;
  g.deepenArena(3);
  g.weatherFromPhase = 3; g.weatherPhase = 3; g.weatherBlend = 1;
  g.player.hp = g.player.maxHp * 0.25; g.player.iframes = 0;
  g.boss.state = 'windup'; g.boss.attack = 'spiral'; g.boss.t = 0.1;
  g.boss.currentWindup = 0.75;
  g.player.x = 60; g.player.y = 40; g.boss.x = -40; g.boss.y = -20;

  g.projectiles.length = 0;
  for (let i = 0; i < projectileCount; i++) {
    const a = (i / Math.max(1, projectileCount)) * Math.PI * 2;
    g.projectiles.push({ x: Math.cos(a) * 120, y: Math.sin(a) * 120,
      vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, r: 7, dmg: 10,
      life: 5, hostile: true, hue: '#ff2d17', source: 'spiral' });
  }
  g.rings.length = 0;
  for (let i = 0; i < 3; i++) {
    g.rings.push({ x: 0, y: 0, r: 90 + i * 70, speed: 150, thickness: 14,
      dmg: 12, maxR: 420, hostile: true, hitDone: false });
  }
  g.meteors.length = 0;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.meteors.push({ x: Math.cos(a) * 160, y: Math.sin(a) * 160,
      fuse: 0.5, maxFuse: 1.1, r: 46, dmg: 18 });
  }
  g.particles.length = 0;
  for (let i = 0; i < 420; i++) {
    const a = (i / 420) * Math.PI * 14;
    g.particles.push({ x: Math.cos(a) * 200 * ((i % 17) / 17),
      y: Math.sin(a) * 200 * ((i % 13) / 13),
      vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, life: 0.6, maxLife: 1,
      size: 3.2, sizeEnd: 0.6, color: i % 3 === 0 ? '#f0d78c' : '#e8a03c',
      glow: i % 2 === 0, shape: i % 5 === 0 ? 'spark' : 'circle',
      drag: 1, grav: 0 });
  }
  g.dmgNums.length = 0;
  for (let i = 0; i < 6; i++) {
    g.dmgNums.push({ x: i * 18 - 50, y: -40 - i * 9, vy: -30, life: 0.7,
      maxLife: 1, text: '109', color: '#f0d78c', size: 22 });
  }
  // Shake feeds rand() into positions but not into op counts; pinning it to
  // zero keeps the census reproducible and the scene otherwise unchanged.
  g.shakeAmp = 0; g.shakeT = 0; g.shakeDur = 0.3;
  g.redFlash = 0.4; g.goldFlash = 0.3;
  return { particles: g.particles.length, projectiles: g.projectiles.length,
    meteors: g.meteors.length, rings: g.rings.length, dmgNums: g.dmgNums.length,
    dpr: g.dpr, w: g.w, h: g.h, phase: g.boss.phase };
}

// Count canvas operations across exactly one frame.
function censusOneFrame() {
  const g = window.__game;
  const proto = CanvasRenderingContext2D.prototype;
  const watched = ['createRadialGradient', 'createLinearGradient', 'fill', 'stroke',
    'fillRect', 'strokeRect', 'beginPath', 'arc', 'moveTo', 'lineTo', 'save',
    'restore', 'drawImage', 'fillText', 'translate', 'rotate', 'setLineDash'];
  const counts = {}; const originals = {};
  for (const m of watched) {
    originals[m] = proto[m]; counts[m] = 0;
    proto[m] = function (...args) { counts[m]++; return originals[m].apply(this, args); };
  }
  const sb = Object.getOwnPropertyDescriptor(proto, 'shadowBlur');
  let shadowBlurNonZero = 0;
  Object.defineProperty(proto, 'shadowBlur', {
    configurable: true, enumerable: sb.enumerable, get: sb.get,
    set(v) { if (v) shadowBlurNonZero++; return sb.set.call(this, v); },
  });

  g.render();

  for (const m of watched) proto[m] = originals[m];
  Object.defineProperty(proto, 'shadowBlur', sb);
  counts.shadowBlurNonZero = shadowBlurNonZero;
  counts.drawCalls = counts.fill + counts.stroke + counts.fillRect
    + counts.strokeRect + counts.drawImage + counts.fillText;
  return counts;
}

// Batched renders with a forced GPU flush. Reported, never asserted — see the
// header for why a single-render timing cannot gate anything.
function timeFrames() {
  const g = window.__game;
  const BATCH = 25; const BLOCKS = 11;
  const block = () => {
    const t0 = performance.now();
    for (let i = 0; i < BATCH; i++) g.render();
    g.ctx.getImageData(0, 0, 1, 1);   // pull rasterisation into the window
    return (performance.now() - t0) / BATCH;
  };
  for (let i = 0; i < 4; i++) block();
  const v = [];
  for (let i = 0; i < BLOCKS; i++) v.push(block());
  v.sort((a, b) => a - b);
  return {
    medianMs: +v[Math.floor(v.length * 0.5)].toFixed(3),
    p25Ms: +v[Math.floor(v.length * 0.25)].toFixed(3),
    p75Ms: +v[Math.floor(v.length * 0.75)].toFixed(3),
  };
}

(async () => {
  const launchOptions = { headless: true, args: ['--no-sandbox'] };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch(launchOptions);
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.touch,
      });
      const pg = await context.newPage();
      const pageErrors = [];
      pg.on('pageerror', (e) => pageErrors.push(String(e)));
      await pg.goto(URL, { waitUntil: 'load' });
      await pg.waitForFunction(() => !!window.__game, null, { timeout: 15000 });

      if (vp.touch) await pg.touchscreen.tap(vp.w / 2, vp.h / 2);
      else {
        await pg.getByRole('button', { name: 'Raise your blade' }).focus();
        await pg.keyboard.press('Enter');
      }
      await pg.waitForFunction(() => window.__game.state === 'fight', null, { timeout: 20000 });

      const scene = await pg.evaluate(buildPinnedScene, 32);
      // Two censuses prove the count is actually deterministic. A scene that
      // drifts frame to frame would make this gate flaky instead of strict, and
      // lazily-built caches show up here as a first-frame-only difference.
      const census = await pg.evaluate(censusOneFrame);
      const censusRepeat = await pg.evaluate(censusOneFrame);

      // Same scene, no projectiles: isolates the per-projectile gradient slope.
      await pg.evaluate(buildPinnedScene, 0);
      await pg.evaluate(censusOneFrame);
      const censusNoProjectiles = await pg.evaluate(censusOneFrame);
      const gradientSlope = (census.createRadialGradient
        - censusNoProjectiles.createRadialGradient) / scene.projectiles;

      const timings = WANT_TIMINGS
        ? await (async () => {
          await pg.evaluate(buildPinnedScene, 32);
          return pg.evaluate(timeFrames);
        })()
        : null;

      out.viewports[vp.name] = {
        scene, census, censusNoProjectiles,
        gradientsPerProjectile: +gradientSlope.toFixed(3), timings, pageErrors,
      };

      const tag = (m) => `${vp.name}: ${m}`;
      if (pageErrors.length) out.errors.push(tag(`page errors: ${JSON.stringify(pageErrors)}`));
      if (JSON.stringify(census) !== JSON.stringify(censusRepeat)) {
        out.errors.push(tag('op census is not deterministic across two frames: '
          + JSON.stringify({ census, censusRepeat })));
      }
      if (census.createRadialGradient > CAPS.createRadialGradient) {
        out.errors.push(tag(`createRadialGradient ${census.createRadialGradient} exceeds cap `
          + `${CAPS.createRadialGradient} — a gradient rebuilt every frame belongs in a cache`));
      }
      if (gradientSlope > MAX_GRADIENTS_PER_PROJECTILE) {
        out.errors.push(tag(`${gradientSlope.toFixed(2)} gradients per projectile exceeds `
          + `${MAX_GRADIENTS_PER_PROJECTILE} — per-entity gradient work is growing`));
      }
      if (census.shadowBlurNonZero > CAPS.shadowBlurNonZero) {
        out.errors.push(tag(`shadowBlur set non-zero ${census.shadowBlurNonZero} times, cap `
          + `${CAPS.shadowBlurNonZero} — shadowBlur re-rasterises into a blur buffer per call`));
      }
      if (census.drawCalls > CAPS.drawCalls) {
        out.errors.push(tag(`${census.drawCalls} draw calls exceeds cap ${CAPS.drawCalls}`));
      }
      await context.close();
    }
    out.ok = out.errors.length === 0;
  } catch (error) {
    out.errors.push(`harness failure: ${error && error.stack ? error.stack : String(error)}`);
  } finally {
    await browser.close();
  }

  fs.writeFileSync(RESULT_PATH, JSON.stringify(out, null, 2));
  for (const [name, v] of Object.entries(out.viewports)) {
    const c = v.census || {};
    console.log(`${name}: gradients=${c.createRadialGradient} (${v.gradientsPerProjectile}/projectile) `
      + `drawImage=${c.drawImage} shadowBlur=${c.shadowBlurNonZero} drawCalls=${c.drawCalls}`
      + (v.timings ? ` median=${v.timings.medianMs}ms` : ''));
  }
  if (!out.ok) {
    console.error(`\nrender-cost gate FAILED (${out.errors.length}):`);
    for (const e of out.errors) console.error('  - ' + e);
    console.error(`\nfull report: ${RESULT_PATH}`);
    process.exitCode = 1;
  } else {
    console.log(`\nrender-cost gate passed. Report: ${RESULT_PATH}`);
  }
})();

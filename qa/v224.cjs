// v2.24 impact-frame acceptance.
//
// The whole claim of this release is that the added feel is PRESENTATION ONLY.
// These assertions are what make that claim falsifiable: a hit must move the
// drawn body without moving the boss, and a swing must stretch the drawn player
// without touching attack timing, position, or damage.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE_URL = process.env.GRACEFELL_URL || 'http://127.0.0.1:8492/';
const ARTIFACT_DIR = process.env.GRACEFELL_ARTIFACT_DIR
  || path.join(os.tmpdir(), 'gracefell-qa', 'v2.24');

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true, isMobile: true, deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  const result = await page.evaluate(() => {
    const g = window.__game;

    // ---- boss hit recoil is render-only -----------------------------------
    g.resetFight();
    g.state = 'fight';
    g.player.x = 0; g.player.y = 0; g.player.facing = 0;
    g.boss.x = 120; g.boss.y = 40; g.boss.facing = 0;
    g.boss.hp = 9999; g.boss.maxHp = 9999;
    g.boss.state = 'recover'; g.boss.t = 99;

    const before = { x: g.boss.x, y: g.boss.y, poise: g.boss.poise, recoil: g.boss.recoil };
    g.boss.takeDamage(30, g, g.player.x, g.player.y, 'heavy');
    const afterHit = {
      x: g.boss.x, y: g.boss.y, recoil: g.boss.recoil, recoilAng: g.boss.recoilAng,
    };
    // Recoil must decay back to rest without ever displacing the entity.
    let movedDuringDecay = false;
    for (let i = 0; i < 40; i++) {
      g.boss.update(1 / 60, g);
      if (g.boss.x !== afterHit.x || g.boss.y !== afterHit.y) movedDuringDecay = true;
      if (g.boss.recoil === 0) break;
    }
    const afterDecay = { x: g.boss.x, y: g.boss.y, recoil: g.boss.recoil };

    // A fresh fight must not inherit a recoil offset.
    g.resetFight();
    const afterReset = { recoil: g.boss.recoil, recoilAng: g.boss.recoilAng };

    // ---- drawing a swing must not mutate the simulation --------------------
    // The impact frame and the ribbon both add logic to draw time. The risk
    // that introduces is a render path writing back into game state, so this
    // renders repeatedly across a live swing and proves nothing moved.
    // (The stretch curve itself is locked by src/game/engine.test.ts.)
    g.resetFight();
    g.state = 'fight';
    g.player.x = 0; g.player.y = 0; g.player.facing = 0;
    g.boss.x = 205; g.boss.y = 0;
    g.boss.hp = 9999; g.boss.maxHp = 9999; g.boss.state = 'recover'; g.boss.t = 99;
    g.input.bufferPress('light');
    g.frame(1 / 60);

    const snapshot = () => JSON.stringify({
      px: g.player.x, py: g.player.y, pt: +g.player.t.toFixed(6),
      pstate: g.player.state, php: g.player.hp, pstam: +g.player.stam.toFixed(6),
      pfacing: +g.player.facing.toFixed(6), tips: g.player.swordTip.length,
      bx: g.boss.x, by: g.boss.y, bhp: g.boss.hp, bpoise: g.boss.poise,
      brecoil: g.boss.recoil, particles: g.particles.length, dmgNums: g.dmgNums.length,
    });

    const swingStates = [];
    let renderMutated = null;
    let sawAttackState = false;
    for (let i = 0; i < 24 && !renderMutated; i++) {
      swingStates.push(g.player.state);
      if (g.player.state === 'light') sawAttackState = true;
      const pre = snapshot();
      g.render(); g.render(); g.render();   // several draws, one sim step
      const post = snapshot();
      if (pre !== post) renderMutated = { frame: i, pre, post };
      g.frame(1 / 60);
    }

    return {
      before, afterHit, afterDecay, afterReset, movedDuringDecay,
      swingStates: Array.from(new Set(swingStates)),
      sawAttackState, renderMutated,
    };
  });

  const failures = [];
  const r = result;
  if (r.afterHit.x !== r.before.x || r.afterHit.y !== r.before.y) {
    failures.push(`boss position moved on hit (render-only violated): ${JSON.stringify({ before: r.before, afterHit: r.afterHit })}`);
  }
  if (!(r.afterHit.recoil > 0)) {
    failures.push(`no recoil recorded on a heavy hit: ${JSON.stringify(r.afterHit)}`);
  }
  if (r.movedDuringDecay) {
    failures.push('boss position changed while recoil decayed — recoil must not feed back into simulation');
  }
  if (r.afterDecay.recoil !== 0) {
    failures.push(`recoil did not decay to rest: ${JSON.stringify(r.afterDecay)}`);
  }
  if (r.afterReset.recoil !== 0 || r.afterReset.recoilAng !== 0) {
    failures.push(`a fresh fight inherited recoil state: ${JSON.stringify(r.afterReset)}`);
  }
  if (!r.sawAttackState) {
    failures.push(`the buffered light never entered the attack state: ${JSON.stringify(r.swingStates)}`);
  }
  if (r.renderMutated) {
    failures.push(`render() mutated simulation state during a swing: ${JSON.stringify(r.renderMutated)}`);
  }
  if (errors.length) failures.push(`page errors: ${JSON.stringify(errors)}`);

  const out = { ok: failures.length === 0, nErrors: failures.length, failures, result: r };
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'result.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: out.ok, nErrors: out.nErrors, artifacts: ARTIFACT_DIR }));
  if (!out.ok) {
    for (const f of failures) console.error('  - ' + f);
    process.exitCode = 1;
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

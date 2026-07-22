// GRACEFELL headless QA gate — writes /tmp/gracefell-result.json
const fs = require('fs');
const pw = require('/home/alyosha/workspace/projects/uptime-kuma/node_modules/playwright-core/index.js');
const { chromium } = pw;

const URL = 'http://127.0.0.1:8491/';
const out = { ok: false, errors: [], steps: {} };

function canvasHasInk(pix) {
  // count non-near-black pixels
  let lit = 0;
  for (let i = 0; i < pix.length; i += 4) {
    if (pix[i] + pix[i + 1] + pix[i + 2] > 60) lit++;
  }
  return lit;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/alyosha/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const vp of [{ name: 'desktop', w: 1280, h: 800 }, { name: 'mobile', w: 390, h: 844 }]) {
      const ctxB = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      const pg = await ctxB.newPage();
      const consoleErrs = [];
      pg.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
      pg.on('pageerror', (e) => consoleErrs.push('pageerror: ' + e.message));
      await pg.goto(URL, { waitUntil: 'load' });
      await pg.waitForTimeout(1200);

      const step = {};
      // canvas exists and draws
      const ink0 = await pg.evaluate(() => {
        const c = document.querySelector('canvas');
        if (!c) return -1;
        const g = c.getContext('2d');
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let lit = 0;
        for (let i = 0; i < d.length; i += 400) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
        return lit;
      });
      step.titleInk = ink0;
      if (ink0 <= 0) out.errors.push(vp.name + ': canvas not drawing on title');

      // no page overflow (mobile)
      const overflow = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      step.overflowPx = overflow;
      if (overflow > 1) out.errors.push(vp.name + ': horizontal overflow ' + overflow + 'px');

      // start fight — click through title, then wait for intro to auto-advance
      await pg.mouse.click(vp.w / 2, vp.h / 2);
      await pg.waitForFunction(() => (window).__game && (window).__game.state === 'fight', null, { timeout: 8000 }).catch(() => {});
      const st1 = await pg.evaluate(() => (window).__game && (window).__game.state);
      step.stateAfterStart = st1;
      if (st1 !== 'fight') out.errors.push(vp.name + ': did not reach fight state (' + st1 + ')');

      // Audio cannot be heard headlessly, but its runtime architecture and every
      // distinct boss cue can still be initialized and exercised without errors.
      const audioState = await pg.evaluate(() => {
        const g = window.__game;
        const pan = [-0.8, -0.5, -0.2, 0.2, 0.5, 0.8, 0];
        ['swipe', 'slam', 'charge', 'volley', 'meteor', 'ring', 'spiral']
          .forEach((cue, i) => g.audio.telegraph(cue, pan[i]));
        const farLeft = { pan: -0.8, distance: 470 };
        const farRight = { pan: 0.8, distance: 430 };
        g.audio.meteorWarning(farLeft);
        g.audio.ring(farRight);
        g.audio.swing(1, { pan: 0, distance: 0 });
        g.audio.hit(true, farRight, 2);
        g.audio.bossStep(farLeft, 1.1);
        g.audio.chargeScrape(farRight);
        g.audio.roar(true, farLeft);
        g.audio.updateCombatState(0.12, 0.18, true);
        return g.audio.debugState();
      });
      step.audio = audioState;
      if (!audioState.initialized || !audioState.hasLimiter || !audioState.hasPeakLimiter || !audioState.hasReusableNoise) {
        out.errors.push(vp.name + ': audio engine did not initialize its master/noise graph: ' + JSON.stringify(audioState));
      }
      if (audioState.activeVoices > audioState.maxVoices) {
        out.errors.push(vp.name + ': audio voice budget exceeded: ' + JSON.stringify(audioState));
      }
      if (audioState.soundtrackState !== 'playing') {
        out.errors.push(vp.name + ': generated soundtrack did not load: ' + JSON.stringify(audioState));
      }
      if (audioState.arenaIrDuration < 1.5 || audioState.irBuildCostMs > 50) {
        out.errors.push(vp.name + ': arena IR failed duration/init budget: ' + JSON.stringify(audioState));
      }
      if (audioState.variationCount < 4 || audioState.maxObservedDistance < 400) {
        out.errors.push(vp.name + ': variation/spatial audio paths were not exercised: ' + JSON.stringify(audioState));
      }
      if (audioState.adaptive.tension < 0.8 || audioState.adaptive.intensity < 0.4 || !audioState.adaptive.staggered) {
        out.errors.push(vp.name + ': adaptive music state did not engage: ' + JSON.stringify(audioState));
      }

      if (vp.name === 'desktop') {
        // simulate combat: move, roll, attack; force phase transitions via damage
        await pg.keyboard.down('KeyW');
        await pg.waitForTimeout(300);
        await pg.keyboard.up('KeyW');
        await pg.keyboard.press('KeyJ');
        await pg.waitForTimeout(200);
        await pg.keyboard.press('Space');
        await pg.waitForTimeout(400);

        // phase 2
        await pg.evaluate(() => { const g = (window).__game; g.boss.takeDamage(g.boss.maxHp * 0.5, g, g.player.x, g.player.y); });
        await pg.waitForTimeout(700);
        const ph2 = await pg.evaluate(() => (window).__game.boss.phase);
        step.phase2 = ph2;
        if (ph2 !== 2) out.errors.push('phase 2 did not trigger (phase=' + ph2 + ')');

        // phase 3
        await pg.evaluate(() => { const g = (window).__game; g.boss.takeDamage(g.boss.maxHp * 0.35, g, g.player.x, g.player.y); });
        await pg.waitForTimeout(900);
        const ph3 = await pg.evaluate(() => (window).__game.boss.phase);
        step.phase3 = ph3;
        if (ph3 !== 3) out.errors.push('phase 3 did not trigger (phase=' + ph3 + ')');

        // let phase-3 combat run — spiral etc.
        await pg.waitForTimeout(3500);
        const alive = await pg.evaluate(() => { const g = (window).__game; return { st: g.state, projs: g.projectiles.length, parts: g.particles.length, scorch: !!g.scorchCanvas }; });
        step.phase3Run = alive;

        // victory
        await pg.evaluate(() => { const g = (window).__game; g.boss.takeDamage(99999, g, g.player.x, g.player.y); });
        await pg.waitForTimeout(2800);
        const vict = await pg.evaluate(() => { const g = (window).__game; return { st: g.state, grade: g.grade, best: g.bestTime, wins: g.wins }; });
        step.victory = vict;
        if (vict.st !== 'victory') out.errors.push('victory state not reached (' + vict.st + ')');
        if (!vict.grade) out.errors.push('no grade computed');

        // localStorage round-trip
        const saved = await pg.evaluate(() => JSON.parse(localStorage.getItem('gracefell') || 'null'));
        step.saved = saved;
        if (!saved || typeof saved.bestTime !== 'number' || saved.wins < 1) out.errors.push('save data did not round-trip: ' + JSON.stringify(saved));

        // restart flow — headless RAF runs slow, so wait on sim stateT, not wall clock
        await pg.waitForFunction(() => (window).__game.stateT > 2.4, null, { timeout: 20000 }).catch(() => {});
        await pg.mouse.click(vp.w / 2, vp.h / 2);
        await pg.waitForFunction(() => ['intro', 'fight'].includes((window).__game.state), null, { timeout: 5000 }).catch(() => {});
        const st2 = await pg.evaluate(() => (window).__game.state);
        step.restart = st2;
        if (st2 !== 'intro' && st2 !== 'fight') out.errors.push('restart flow broken (' + st2 + ')');

        // perfect dodge unit check
        const pd = await pg.evaluate(() => {
          const g = (window).__game;
          window.__hapticEvents = [];
          try {
            Object.defineProperty(navigator, 'vibrate', {
              configurable: true,
              value: (pattern) => { window.__hapticEvents.push(pattern); return true; },
            });
          } catch { /* browser may expose a non-configurable vibration stub */ }
          g.state = 'fight';
          const p = g.player;
          p.state = 'roll'; p.t = 0.35; p.iframes = 0.3; p.perfectCd = 0; p.stam = 10;
          const before = g.dmgNums.length;
          const hpBefore = p.hp;
          p.takeDamage(10, p.x + 30, p.y, g);
          return { stam: p.stam, dmgNums: g.dmgNums.length - before, hpDelta: p.hp - hpBefore,
                   haptics: window.__hapticEvents.length };
        });
        step.perfectDodge = pd;
        if (pd.stam < 35 || pd.dmgNums < 1 || pd.hpDelta !== 0) out.errors.push('perfect dodge failed: ' + JSON.stringify(pd));
        if (pd.haptics < 1) out.errors.push('perfect dodge did not request haptic feedback');

        // ---- v2.1: grace dial, accessibility, palette discipline
        const acc = await pg.evaluate(() => {
          const g = window.__game;
          const out = {};
          // grace clamps
          g.setGrace(-99); out.min = g.grace;
          g.setGrace(99); out.max = g.grace;
          // aid direction: slower boss, softer hits, wider iframes
          g.setGrace(-3); const aid = g.mods;
          g.setGrace(5); const vow = g.mods;
          g.setGrace(0); const mid = g.mods;
          out.aidSlower = aid.bossSpeed < mid.bossSpeed && mid.bossSpeed < vow.bossSpeed;
          out.aidSofter = aid.dmgTaken < mid.dmgTaken && mid.dmgTaken < vow.dmgTaken;
          out.aidIframe = aid.iframe > mid.iframe;
          out.flaskSpread = [aid.flasks, mid.flasks, vow.flasks];
          out.vowNoStagger = vow.noStagger && !mid.noStagger;
          // the dial actually reaches the boss
          g.setGrace(-3); g.resetFight();
          out.bossSpeedAided = g.boss.extraSpeed;
          out.flasksAided = g.player.flasks;
          g.setGrace(5); g.resetFight();
          out.bossSpeedVowed = g.boss.extraSpeed;
          out.flasksVowed = g.player.flasks;
          // damage scaling actually applies
          g.setGrace(-3); g.resetFight(); g.state = 'fight';
          const hp0 = g.player.hp; g.player.iframes = 0;
          g.player.takeDamage(20, g.player.x + 40, g.player.y, g);
          out.aidedLoss = hp0 - g.player.hp;
          g.setGrace(5); g.resetFight(); g.state = 'fight';
          const hp1 = g.player.hp; g.player.iframes = 0;
          g.player.takeDamage(20, g.player.x + 40, g.player.y, g);
          out.vowedLoss = hp1 - g.player.hp;
          // toggles
          g.shakeEnabled = false; g.shakeAmp = 0; g.shake(20, 0.5);
          out.shakeOffWorks = g.shakeAmp === 0;
          g.shakeEnabled = true; g.shake(20, 0.5);
          out.shakeOnWorks = g.shakeAmp > 0;
          g.flashReduced = true; out.flashReducedScale = g.flashScale();
          g.flashReduced = false; out.flashFullScale = g.flashScale();
          // hazard hue is reserved: no ambient particle may use it
          g.setGrace(0); g.resetFight();
          out.dangerHue = g.constructor === Object ? null : undefined;
          return out;
        });
        step.accessibility = acc;
        if (acc.min !== -3 || acc.max !== 5) out.errors.push('grace does not clamp to -3..5: ' + JSON.stringify([acc.min, acc.max]));
        if (!acc.aidSlower) out.errors.push('grace does not scale boss speed monotonically');
        if (!acc.aidSofter) out.errors.push('grace does not scale damage taken monotonically');
        if (!acc.aidIframe) out.errors.push('aid does not widen i-frames');
        if (!acc.vowNoStagger) out.errors.push('vow +5 should disable stagger');
        if (!(acc.bossSpeedAided < 1 && acc.bossSpeedVowed > 1)) out.errors.push('grace not reaching boss.extraSpeed: ' + JSON.stringify([acc.bossSpeedAided, acc.bossSpeedVowed]));
        if (!(acc.flasksAided > acc.flasksVowed)) out.errors.push('flask count not responding to grace: ' + JSON.stringify([acc.flasksAided, acc.flasksVowed]));
        if (!(acc.aidedLoss < acc.vowedLoss)) out.errors.push('damage taken not scaled by grace: ' + JSON.stringify([acc.aidedLoss, acc.vowedLoss]));
        if (!acc.shakeOffWorks || !acc.shakeOnWorks) out.errors.push('screen shake toggle broken');
        if (!(acc.flashReducedScale < acc.flashFullScale)) out.errors.push('flash reduction not applied');

        // hazard-hue discipline: ambient particles must never use PAL.danger
        const hue = await pg.evaluate(async () => {
          const g = window.__game;
          g.setGrace(0); g.resetFight(); g.state = 'fight';
          g.particles = [];
          g.boss.phase = 3;
          // run ambient emitters for a while
          for (let i = 0; i < 400; i++) { g.boss.update(0.016, g); }
          for (let i = 0; i < 200; i++) { g.frame ? null : null; }
          const danger = '#ff2d17';
          const ambientUsingDanger = g.particles.filter((p) => p.color === danger).length;
          return { total: g.particles.length, ambientUsingDanger, danger };
        });
        step.hazardHue = hue;
        if (hue.ambientUsingDanger > 0) out.errors.push('ambient particles are using the reserved hazard hue (' + hue.ambientUsingDanger + ')');

        // save schema v2 round-trip incl. settings
        const sv2 = await pg.evaluate(() => {
          const g = window.__game;
          g.setGrace(2); g.shakeEnabled = false; g.flashReduced = true; g.persist();
          return JSON.parse(localStorage.getItem('gracefell'));
        });
        step.saveV2 = sv2;
        if (sv2.v !== 2 || sv2.grace !== 2 || sv2.shakeEnabled !== false || sv2.flashReduced !== true || !sv2.bests) {
          out.errors.push('save v2 did not round-trip settings: ' + JSON.stringify(sv2));
        }

        // v1 save migrates forward
        const mig = await pg.evaluate(async () => {
          localStorage.setItem('gracefell', JSON.stringify({ bestTime: 42, wins: 3, attempts: 7, muted: false }));
          const live = window.__game;           // constructing a Game hijacks the
          const G = live.constructor;            // window.__game debug hook, and
          const c = document.createElement('canvas');
          const g2 = new G(c);                   // destroy() does not put it back —
          const r = { best: g2.bestTime, wins: g2.wins, bestsZero: g2.bests['0'], grace: g2.grace };
          g2.destroy();
          window.__game = live;                  // so restore it, or every later
          return r;                              // assertion reads a dead instance.
        });
        step.migration = mig;
        if (mig.best !== 42 || mig.wins !== 3 || mig.bestsZero !== 42 || mig.grace !== 0) {
          out.errors.push('v1 save did not migrate: ' + JSON.stringify(mig));
        }

        // title menu hit-test: tapping the trial row must not start the fight
        await pg.evaluate(() => { const g = window.__game; g.state = 'title'; g.stateT = 1; g.setGrace(0); });
        await pg.waitForTimeout(120);
        const rowY = await pg.evaluate(() => window.__game.menuRows()[0].y);
        await pg.mouse.click(vp.w / 2 + 260, rowY);  // right chevron zone
        await pg.waitForTimeout(250);
        const afterTap = await pg.evaluate(() => ({ st: window.__game.state, grace: window.__game.grace }));
        step.menuTap = afterTap;
        if (afterTap.st !== 'title') out.errors.push('tapping a settings row started the fight');
        if (afterTap.grace !== 1) out.errors.push('trial chevron did not change grace: ' + afterTap.grace);

        // combo fields exist
        const combo = await pg.evaluate(() => { const p = (window).__game.player; return typeof p.comboStep === 'number' && typeof p.comboWindow === 'number'; });
        if (!combo) out.errors.push('combo fields missing');
        step.combo = combo;

        // fight-scene screenshot
        await pg.screenshot({ path: '/tmp/gracefell-desktop.png' });
      } else {
        // mobile: fight ink + touch UI presence + screenshot
        const inkFight = await pg.evaluate(() => {
          const c = document.querySelector('canvas');
          const g = c.getContext('2d');
          const d = g.getImageData(0, 0, c.width, c.height).data;
          let lit = 0;
          for (let i = 0; i < d.length; i += 400) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
          return lit;
        });
        step.fightInk = inkFight;
        if (inkFight <= 0) out.errors.push('mobile: canvas blank in fight');
        await pg.screenshot({ path: '/tmp/gracefell-mobile.png' });
      }

      // ---- menu layout must fit its own plate + the viewport, every viewport
      const lay = await pg.evaluate(() => {
        const g = window.__game;
        g.state = 'title';
        const gm = g.menuGeom();
        const rows = g.menuRows();
        return {
          w: g.w, h: g.h,
          plateL: gm.plateL, plateR: gm.plateR,
          chevLx: gm.chevLx, chevRx: gm.chevRx,
          valueRx: gm.valueRx, labelLx: gm.labelLx,
          pipMin: gm.pipX(-3), pipMax: gm.pipX(5),
          decZone: gm.decZone, incZone: gm.incZone,
          lastRowY: rows[rows.length - 1].y,
          firstRowY: rows[0].y,
        };
      });
      step.menuLayout = lay;
      const L = [];
      if (lay.chevLx < lay.plateL + 8) L.push('left chevron outside plate');
      if (lay.chevRx > lay.plateR - 8) L.push('right chevron outside plate');
      if (lay.labelLx < lay.plateL + 8) L.push('label outside plate');
      if (lay.valueRx > lay.chevRx - 12) L.push('value text collides with right chevron');
      if (lay.pipMin < lay.plateL + 8 || lay.pipMax > lay.plateR - 8) L.push('grace pips outside plate');
      if (lay.pipMax > lay.valueRx - 24) L.push('grace pips collide with value text');
      if (lay.plateL < 4 || lay.plateR > lay.w - 4) L.push('menu plate wider than viewport');
      if (lay.lastRowY + 40 > lay.h) L.push('menu overflows bottom of screen');
      if (lay.firstRowY < lay.h * 0.5) L.push('menu overlaps the title block');
      if (!(lay.decZone < lay.incZone)) L.push('grace hit zones inverted');
      if (L.length) out.errors.push(vp.name + ' menu layout: ' + L.join('; '));

      step.consoleErrors = consoleErrs;
      if (consoleErrs.length) out.errors.push(vp.name + ' console: ' + consoleErrs.join(' | '));
      out.steps[vp.name] = step;
      await ctxB.close();
    }
    // ================= TOUCH DEVICE PASS =================
    // The touch path had never been driven by a test — only rendered. This
    // emulates a real phone (hasTouch + isMobile) and plays with thumbs only.
    {
      const tctx = await browser.newContext({
        viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3,
      });
      const pg = await tctx.newPage();
      const cerr = [];
      pg.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text()); });
      pg.on('pageerror', (e) => cerr.push('pageerror: ' + e.message));
      await pg.goto(URL, { waitUntil: 'load' });
      await pg.waitForTimeout(1200);
      const t = {};

      // 1. the game must KNOW it's a phone before any touch happens
      t.isTouchBeforeAnyTouch = await pg.evaluate(() => window.__game.input.isTouch);
      if (!t.isTouchBeforeAnyTouch) out.errors.push('touch: game did not detect a coarse pointer before first touch (phone users see mouse/keyboard copy)');

      // 2. touch-appropriate copy, no keyboard bindings shown
      t.rows = await pg.evaluate(() => window.__game.menuRows().map((r) => r.id));
      if (!t.rows.includes('haptics')) out.errors.push('touch: haptics row missing from menu');

      // 3. controls layout: inside screen, clear of the joystick half and the safe area
      t.layout = await pg.evaluate(() => {
        const g = window.__game; const L = g.touchLayout();
        return { base: L.base, joyZoneR: L.joyZoneR, w: g.w, h: g.h,
                 btns: L.btns.map((b) => ({ id: b.id, x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.r) })) };
      });
      for (const b of t.layout.btns) {
        if (b.x - b.r < t.layout.joyZoneR) out.errors.push(`touch: ${b.id} button overlaps the joystick half`);
        if (b.x + b.r > t.layout.w) out.errors.push(`touch: ${b.id} button off the right edge`);
        if (b.y + b.r > t.layout.h) out.errors.push(`touch: ${b.id} button off the bottom edge`);
        if (b.r < 22) out.errors.push(`touch: ${b.id} button smaller than a fingertip (r=${b.r})`);
      }
      // buttons must not overlap each other
      for (let i = 0; i < t.layout.btns.length; i++) {
        for (let j = i + 1; j < t.layout.btns.length; j++) {
          const a = t.layout.btns[i], b = t.layout.btns[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - 4) out.errors.push(`touch: ${a.id} and ${b.id} buttons overlap`);
        }
      }

      // 4. start the fight with a tap
      await pg.touchscreen.tap(195, 300);
      await pg.waitForFunction(() => window.__game && window.__game.state === 'fight', null, { timeout: 12000 }).catch(() => {});
      t.stateAfterTap = await pg.evaluate(() => window.__game.state);
      if (t.stateAfterTap !== 'fight') out.errors.push('touch: tap did not start the fight (' + t.stateAfterTap + ')');

      // 5. the joystick actually moves the knight
      const before = await pg.evaluate(() => ({ x: window.__game.player.x, y: window.__game.player.y }));
      await pg.touchscreen.tap(100, 600); // establishes touch capability path
      await pg.evaluate(() => {
        // drive a drag through the real listeners
        const c = document.querySelector('canvas');
        const mk = (type, id, x, y) => {
          const t = new Touch({ identifier: id, target: c, clientX: x, clientY: y });
          c.dispatchEvent(new TouchEvent(type, { changedTouches: [t], touches: type === 'touchend' ? [] : [t], bubbles: true, cancelable: true }));
        };
        mk('touchstart', 1, 90, 600);
        for (let i = 1; i <= 6; i++) mk('touchmove', 1, 90 + i * 12, 600 - i * 12);
      });
      await pg.waitForTimeout(700);
      const after = await pg.evaluate(() => ({ x: window.__game.player.x, y: window.__game.player.y,
                                               joy: { a: window.__game.input.joyActive, x: window.__game.input.joyX, y: window.__game.input.joyY } }));
      t.joystick = { before, after };
      if (!after.joy.a) out.errors.push('touch: drag on the left half did not engage the joystick');
      if (Math.hypot(after.x - before.x, after.y - before.y) < 4) out.errors.push('touch: joystick drag did not move the player');
      await pg.evaluate(() => {
        const c = document.querySelector('canvas');
        const t = new Touch({ identifier: 1, target: c, clientX: 160, clientY: 530 });
        c.dispatchEvent(new TouchEvent('touchend', { changedTouches: [t], touches: [], bubbles: true, cancelable: true }));
      });

      // 6. the ATK button actually attacks
      const atk = t.layout.btns.find((b) => b.id === 'light');
      await pg.evaluate(() => { window.__game.player.state = 'move'; window.__game.player.stam = 100; });
      await pg.touchscreen.tap(atk.x, atk.y);
      await pg.waitForFunction(() => window.__game.player.state === 'light', null, { timeout: 1000 }).catch(() => {});
      t.atkState = await pg.evaluate(() => window.__game.player.state);
      if (t.atkState !== 'light') out.errors.push('touch: ATK button did not enter the light-attack state (' + t.atkState + ')');

      // 7. no horizontal overflow, canvas drawing, clean console
      t.overflow = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (t.overflow > 1) out.errors.push('touch: horizontal overflow ' + t.overflow);
      t.ink = await pg.evaluate(() => {
        const c = document.querySelector('canvas'); const g = c.getContext('2d');
        const d = g.getImageData(0, 0, c.width, c.height).data; let lit = 0;
        for (let i = 0; i < d.length; i += 400) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
        return lit;
      });
      if (t.ink <= 0) out.errors.push('touch: canvas blank');
      if (cerr.length) out.errors.push('touch console: ' + cerr.join(' | '));
      t.consoleErrors = cerr;
      out.steps.touch = t;
      await tctx.close();
    }

    out.ok = out.errors.length === 0;
  } catch (e) {
    out.errors.push('harness: ' + e.message);
  } finally {
    await browser.close();
    fs.writeFileSync('/tmp/gracefell-result.json', JSON.stringify(out, null, 2));
    console.log(JSON.stringify({ ok: out.ok, nErrors: out.errors.length }));
  }
})();

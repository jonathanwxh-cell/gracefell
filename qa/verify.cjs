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
          g.state = 'fight';
          const p = g.player;
          p.state = 'roll'; p.t = 0.35; p.iframes = 0.3; p.perfectCd = 0; p.stam = 10;
          const before = g.dmgNums.length;
          const hpBefore = p.hp;
          p.takeDamage(10, p.x + 30, p.y, g);
          return { stam: p.stam, dmgNums: g.dmgNums.length - before, hpDelta: p.hp - hpBefore };
        });
        step.perfectDodge = pd;
        if (pd.stam < 35 || pd.dmgNums < 1 || pd.hpDelta !== 0) out.errors.push('perfect dodge failed: ' + JSON.stringify(pd));

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

      step.consoleErrors = consoleErrs;
      if (consoleErrs.length) out.errors.push(vp.name + ' console: ' + consoleErrs.join(' | '));
      out.steps[vp.name] = step;
      await ctxB.close();
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

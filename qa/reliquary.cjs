// Authored character acceptance: real assets, pose changes, fallback and snapshots.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.GRACEFELL_URL || 'http://127.0.0.1:8493/';
const out = path.resolve('.artifacts/reliquary');
fs.mkdirSync(out, { recursive: true });
const screenshotOnly = process.argv.includes('--capture');
const classicOnly = process.argv.includes('--classic');

async function start(page, query = '?visualQa=allow-software') {
  await page.goto(new URL(query, base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game);
  await page.locator('canvas').first().click({ position: { x: 100, y: 100 } });
  await page.evaluate(() => {
    const g = window.__game;
    g.paused = true; cancelAnimationFrame(g.raf); g.raf = 0;
  });
}

async function pin(page, phase = 1) {
  await page.evaluate((phase) => {
    const g = window.__game;
    g.resetFight(); g.state = 'fight'; g.stateT = 8; g.time = 12;
    g.paused = true; g.manualPaused = false; g.tutorialComplete = true; g.tutorialT = 0;
    g.banner = ''; g.bannerT = 0; g.bossBarFill = 1;
    g.player.x = -52; g.player.y = 75; g.player.facing = -.5;
    g.boss.x = 46; g.boss.y = -62; g.boss.facing = 2.15;
    g.boss.state = 'stalk'; g.boss.t = 2; g.boss.phase = phase;
    g.boss.secondSwordDraw = phase === 3 ? 1 : 0;
    g.boss.hp = phase === 3 ? 350 : 1350;
    g.player.iframes = 0; g.player.state = 'move';
    g.camX = 0; g.camY = 0; g.camZoom = g.input.isTouch ? .64 : .86;
    g.shakeAmp = 0; g.zoomPunch = 0; g.redFlash = 0; g.goldFlash = 0;
    g.projectiles = []; g.rings = []; g.meteors = []; g.particles = [];
    g.render();
    g.uiChanged?.();
  }, phase);
  await page.getByRole('button', {name:'PAUSE',exact:true}).waitFor({state:'visible'});
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.GRACEFELL_GPU_QA === '1' ? { channel: 'chrome' } : {}),
    args: process.env.GRACEFELL_GPU_QA === '1' ? ['--no-sandbox', '--enable-gpu', '--use-angle=d3d11'] : ['--no-sandbox'],
  });
  const errors = [], receipts = {};
  try {
    for (const touch of [false, true]) {
      const label = touch ? 'phone' : 'desktop';
      const context = await browser.newContext({ viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
      await page.goto(base, { waitUntil: 'networkidle' });
      const graphics = page.getByRole('button', { name: 'Graphics: Detailed 3D. Switch to Classic', exact: true });
      await graphics.waitFor({ state: 'visible' });
      const button = await graphics.boundingBox();
      const scores = await page.getByRole('button', { name: 'RECORDS', exact: true }).boundingBox();
      assert(button && button.width >= 44 && button.height >= 44, 'Graphics target must be fingertip-sized');
      assert(button.x >= 0 && button.y >= 0 && button.x + button.width <= (touch ? 390 : 1280) && button.y + button.height <= (touch ? 844 : 800), 'Graphics control must fit the viewport');
      assert(scores && button.x + button.width <= scores.x, 'Graphics must not overlap Scores');
      await page.screenshot({ path: path.join(out, `${label}-title.png`) });
      await graphics.click();
      await page.waitForURL(url => url.searchParams.get('boss') === 'blender-canvas');
      await page.getByRole('button', { name: 'Graphics: Classic. Switch to Detailed 3D', exact: true }).click();
      await page.waitForURL(url => url.searchParams.get('boss') === 'reliquary-three');
      await start(page, '?boss=blender-canvas');
      await page.waitForFunction(() => window.__game.visualDebugState().arena.applied, null, { timeout: 30000 });
      await pin(page);
      await page.screenshot({ path: path.join(out, `${label}-before.png`) });
      if (!classicOnly) {
        await start(page);
        await page.waitForFunction(() => {
          const g = window.__game; if (!g) return false; g.render();
          return g.visualDebugState().reliquary.state === 'active';
        }, null, { timeout: 60000 });
        await pin(page);
        await page.screenshot({ path: path.join(out, `${label}-after.png`) });
        receipts[label] = await page.evaluate(() => window.__game.visualDebugState());
        receipts[label].gpu = await page.evaluate(() => {
          const gl=window.__game.reliquary.canvas.getContext('webgl2');
          const ext=gl.getExtension('WEBGL_debug_renderer_info');
          return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        });
        await pin(page, 3);
        await page.screenshot({ path: path.join(out, `${label}-phase3.png`) });
        if (!screenshotOnly) {
          const pure = await page.evaluate(() => {
            const g = window.__game;
            const combat = () => JSON.stringify({
              player: Object.fromEntries(Object.entries(g.player).filter(([,v]) => typeof v !== 'object')),
              boss: Object.fromEntries(Object.entries(g.boss).filter(([,v]) => typeof v !== 'object')),
              time: g.time, fightTime: g.fightTime, trial: g.trialMods,
            });
            const before = combat();
            for (let i = 0; i < 4; i++) g.render();
            return before === combat();
          });
          assert(pure, `${label}: rendering modified combat state`);
          assert(receipts[label].reliquary.models.kiteveil.triangles > 10000, 'Player is not the authored detailed asset');
          assert(receipts[label].reliquary.models.malakar.triangles > 10000, 'Boss is not the authored detailed asset');
          assert.equal(receipts[label].boss.active, 'reliquary-three');
          for (const state of ['light', 'heavy', 'roll', 'flask', 'stagger', 'dead']) {
            await page.evaluate(state => { const g=window.__game; g.player.state=state; g.player.t=.15; for(let i=0;i<12;i++){g.time+=1/60;g.render();} }, state);
            await page.screenshot({ path: path.join(out, `${label}-${state}.png`) });
          }
          await pin(page);
          // Pointer directions must visibly change the 3D silhouette.
          const front = await page.locator('canvas').first().screenshot();
          await page.evaluate(() => { const g=window.__game; g.boss.facing+=Math.PI; for(let i=0;i<12;i++){g.time+=1/60;g.render();} });
          const back = await page.locator('canvas').first().screenshot();
          assert(!front.equals(back), `${label}: 3D model does not turn with facing`);
          // Context loss must immediately expose both existing character bodies;
          // restoration may promote the pair only on a safe boundary.
          await page.evaluate(() => {
            const g=window.__game;
            window.__reliquaryContext = g.reliquary.canvas.getContext('webgl2');
            window.__reliquaryLoss = window.__reliquaryContext.getExtension('WEBGL_lose_context');
            window.__reliquaryLoss.loseContext();
          });
          await page.waitForFunction(() => window.__game.visualDebugState().reliquary.state === 'context-lost');
          await page.evaluate(() => window.__game.render());
          assert.equal(await page.evaluate(() => window.__game.visualDebugState().boss.active), 'blender-canvas-fallback');
          await page.evaluate(() => window.__reliquaryLoss.restoreContext());
          await page.waitForFunction(() => { const g=window.__game; g.render(); return g.visualDebugState().reliquary.state === 'active'; });
          // Includes GPU submission + compositing, not just a draw-op census.
          receipts[label].frames = await page.evaluate(async () => {
            const g=window.__game, samples=[];
            for (let i=0;i<42;i++) {
              await new Promise(requestAnimationFrame);
              const start=performance.now(); g.time+=1/60; g.render();
              if (i>=10) samples.push(performance.now()-start);
            }
            samples.sort((a,b)=>a-b);
            return { medianMs:samples[16],p95Ms:samples[30],count:samples.length };
          });
          const dimensions = touch ? {width:360,height:640} : {width:1440,height:900};
          await page.setViewportSize(dimensions);
          await pin(page);
          await page.screenshot({path:path.join(out,`${label}-resized.png`)});
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Viewport overflow');
        }
      }
      await context.close();
    }
    if (!screenshotOnly && !classicOnly) {
      // With no test override, the normal entry point selects real 3D on a GPU
      // or releases the software context. A slow renderer must not be the
      // default merely because WebGL happened to initialize successfully.
      const normal=await browser.newContext(); const normalPage=await normal.newPage();
      await start(normalPage, '');
      await normalPage.waitForFunction(()=>{
        const g=window.__game; g.render();
        return ['active','fallback'].includes(g.visualDebugState().reliquary.state);
      });
      receipts.normalDefault=await normalPage.evaluate(()=>window.__game.visualDebugState().reliquary);
      const software = /swiftshader|llvmpipe|software rasterizer|microsoft basic render/i.test(receipts.desktop.gpu);
      assert.equal(receipts.normalDefault.state,software?'fallback':'active');
      if (software) assert.match(receipts.normalDefault.error,/Hardware acceleration/);
      await normal.close();
      // Network failure: the detached GPU context must be released, and gameplay
      // must continue using the previous authored Canvas treatment.
      const context=await browser.newContext(); const page=await context.newPage();
      await page.route('**/art/reliquary/*.glb*', route=>route.abort());
      await start(page);
      await page.waitForFunction(() => { const g=window.__game; g.render(); return g.visualDebugState().reliquary.state==='fallback'; });
      await pin(page);
      receipts.failedAssets=await page.evaluate(()=>({released:window.__game.reliquary===null,debug:window.__game.visualDebugState()}));
      assert(receipts.failedAssets.released, 'Failed assets retained a GPU context');
      assert.equal(receipts.failedAssets.debug.boss.active,'blender-canvas-fallback');
      await context.close();
      const delayed=await browser.newContext(); const slow=await delayed.newPage();
      let release; const gate=new Promise(resolve=>{release=resolve;});
      await slow.route('**/art/reliquary/*.glb*', async route=>{await gate; await route.continue();});
      await start(slow);
      await slow.waitForFunction(()=>window.__game.reliquary);
      await slow.evaluate(()=>{const g=window.__game; g.state='fight';g.paused=false;});
      release();
      await slow.waitForFunction(()=>Object.values(window.__game.visualDebugState().reliquary.models).every(m=>m.state==='ready'));
      await slow.evaluate(()=>window.__game.render());
      assert.equal(await slow.evaluate(()=>window.__game.reliquaryReady),false,'Late model popped in during combat');
      await slow.evaluate(()=>{const g=window.__game; g.paused=true;g.render();});
      assert.equal(await slow.evaluate(()=>window.__game.reliquaryReady),true,'Safe boundary failed to promote');
      await delayed.close();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, screenshotOnly ? 'capture-receipt.json' : 'runtime-receipt.json'), JSON.stringify(receipts, null, 2));
    if (process.env.GRACEFELL_GPU_QA === '1' && !screenshotOnly) fs.writeFileSync(path.join(out, 'hardware-receipt.json'), JSON.stringify(receipts,null,2));
    if (!classicOnly) {
      // Browser-composed review sheet from same-camera captures, with honest
      // labels. These are actual game renders, not concept artwork.
      const comparison=await browser.newPage({viewport:{width:1440,height:570},deviceScaleFactor:1});
      const picture=name=>'data:image/png;base64,'+fs.readFileSync(path.join(out,name)).toString('base64');
      await comparison.setContent(`<html><style>body{margin:0;background:#100f0e;color:#e9deca;font-family:Georgia,serif;padding:24px}h1{font-size:25px;font-weight:normal;margin:0 0 6px}p{font-size:14px;color:#baa785;margin:0 0 18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}h2{font-size:14px;letter-spacing:2px;font-weight:normal}img{width:100%;border:1px solid #514733}</style><h1>GRACEFELL · The Forged Reliquary</h1><p>Actual game captures · same camera and combat positions</p><div class="grid"><section><h2>CURRENT RELEASE</h2><img src="${picture('desktop-before.png')}"></section><section><h2>NEW 3D CHARACTERS + STONE ARENA</h2><img src="${picture('desktop-after.png')}"></section></div></html>`);
      await comparison.screenshot({path:path.join(out,'comparison.png'),fullPage:true});
      await comparison.close();
    }
    console.log(JSON.stringify({ errors, receipts }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

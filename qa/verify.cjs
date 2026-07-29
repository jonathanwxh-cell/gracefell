// GRACEFELL headless QA gate — portable across local machines and CI.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.GRACEFELL_URL || 'http://127.0.0.1:8491/';
const ARTIFACT_DIR = process.env.GRACEFELL_QA_DIR || path.join(os.tmpdir(), 'gracefell-qa');
const RESULT_PATH = process.env.GRACEFELL_QA_RESULT || path.join(ARTIFACT_DIR, 'result.json');
const FORCED_AUDIO_SAMPLE_RATE = Number(process.env.GRACEFELL_AUDIO_SAMPLE_RATE || 44100);
// Isolated v2.25 samples hold around 2 ms (3.5 ms max in an 18-sample
// follow-up), but a one-shot wall clock can include an OS deschedule. Keep 8 ms
// as the engineering target and 12 ms as the deterministic release ceiling.
const MAX_GRAPH_INIT_MS = 12;
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
const out = { ok: false, errors: [], steps: {} };

function canvasHasInk(pix) {
  // count non-near-black pixels
  let lit = 0;
  for (let i = 0; i < pix.length; i += 4) {
    if (pix[i] + pix[i + 1] + pix[i + 2] > 60) lit++;
  }
  return lit;
}

async function installAudioSampleRate(context) {
  if (!Number.isFinite(FORCED_AUDIO_SAMPLE_RATE) || FORCED_AUDIO_SAMPLE_RATE <= 0) return;
  await context.addInitScript((sampleRate) => {
    const NativeAudioContext = window.AudioContext;
    if (!NativeAudioContext) return;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options = {}) {
        super({ ...options, sampleRate });
      }
    };
  }, FORCED_AUDIO_SAMPLE_RATE);
}

(async () => {
  const launchOptions = { headless: true, args: ['--no-sandbox'] };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch(launchOptions);
  try {
    // v2.16 (#45/#46): server.mjs hardening — security headers + immutable audio.
    {
      const rootRes = await fetch(URL);
      const audioRes = await fetch(new globalThis.URL('/audio/gracefell-phase-1-quiet-ash.mp3?v=2.18', URL), { method: 'HEAD' });
      const sfxRes = await fetch(new globalThis.URL('/audio/sfx/hit-light-1.mp3?v=2.22.0', URL), { method: 'HEAD' });
      const h = (r, k) => (r.headers.get(k) || '').toLowerCase();
      out.steps.serverHeaders = {
        nosniff: h(rootRes, 'x-content-type-options'),
        referrer: h(rootRes, 'referrer-policy'),
        frame: h(rootRes, 'x-frame-options'),
        audioCache: h(audioRes, 'cache-control'),
        sfxStatus: sfxRes.status,
        sfxType: h(sfxRes, 'content-type'),
        sfxCache: h(sfxRes, 'cache-control'),
      };
      const sh = out.steps.serverHeaders;
      if (sh.nosniff !== 'nosniff') out.errors.push('v2.16 (#45): missing X-Content-Type-Options: nosniff (' + JSON.stringify(sh) + ')');
      if (!sh.referrer) out.errors.push('v2.16 (#45): missing Referrer-Policy header');
      if (!/immutable/.test(sh.audioCache)) out.errors.push('v2.16 (#46): /audio/ not served immutable (' + sh.audioCache + ')');
      if (sh.sfxStatus !== 200 || !sh.sfxType.includes('audio/mpeg') || !/immutable/.test(sh.sfxCache)) {
        out.errors.push('v2.22: versioned recorded SFX asset/header contract failed: ' + JSON.stringify(sh));
      }

      // v2.17 (#39/#40): self-hosted fonts (no third-party CDN) + manifest/icons/meta.
      const html = await (await fetch(URL)).text();
      const favicon = await fetch(new globalThis.URL('/favicon.svg', URL), { method: 'HEAD' });
      const manifest = await fetch(new globalThis.URL('/manifest.webmanifest', URL), { method: 'HEAD' });
      out.steps.webPolish = {
        googleFontRefs: (html.match(/googleapis|gstatic/g) || []).length,
        hasManifestLink: /rel="manifest"/.test(html),
        hasIconLink: /rel="icon"/.test(html),
        hasDescription: /name="description"/.test(html),
        favicon: favicon.status,
        manifest: manifest.status,
      };
      const wp = out.steps.webPolish;
      if (wp.googleFontRefs !== 0) out.errors.push('v2.17 (#39): third-party font CDN still referenced (' + wp.googleFontRefs + ')');
      if (!wp.hasManifestLink || wp.manifest !== 200) out.errors.push('v2.17 (#40): PWA manifest missing (' + JSON.stringify(wp) + ')');
      if (!wp.hasIconLink || wp.favicon !== 200) out.errors.push('v2.17 (#40): favicon missing (' + JSON.stringify(wp) + ')');
      if (!wp.hasDescription) out.errors.push('v2.17 (#40): meta description missing');
    }
    for (const vp of [{ name: 'desktop', w: 1280, h: 800 }, { name: 'mobile', w: 390, h: 844 }]) {
      const ctxB = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      await installAudioSampleRate(ctxB);
      const pg = await ctxB.newPage();
      const consoleErrs = [];
      pg.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
      pg.on('pageerror', (e) => consoleErrs.push('pageerror: ' + e.message));
      await pg.goto(URL, { waitUntil: 'load' });
      await pg.waitForTimeout(1200);

      const step = {};
      step.firstJourney = await pg.evaluate(() => {
        const g = window.__game;
        const ui = g.uiSnapshot();
        const save = localStorage.getItem('gracefell');
        return {
          grace: g.grace,
          label: g.graceLabel(),
          summary: g.graceSummary(),
          menuLabel: g.graceMenuLabel(),
          menuSummary: g.graceMenuSummary(),
          clearTells: g.difficultyForGrace().clearTells,
          flasks: g.difficultyForGrace().flasks,
          uiGrace: ui.grace,
          uiSummary: ui.graceSummary,
          musicVolume: ui.musicVolume,
          sfxVolume: ui.sfxVolume,
          hasSave: save !== null,
        };
      });
      if (
        step.firstJourney.grace !== -2
        || step.firstJourney.label !== 'JOURNEY -2'
        || !step.firstJourney.summary.includes('recommended')
        || step.firstJourney.menuLabel !== 'JOURNEY · GUIDED'
        || !step.firstJourney.menuSummary.includes('Recommended for first victories')
        || !step.firstJourney.clearTells
        || step.firstJourney.flasks !== 4
          || step.firstJourney.uiGrace !== -2
          || step.firstJourney.uiSummary !== step.firstJourney.summary
          || step.firstJourney.musicVolume !== 0.85
          || step.firstJourney.sfxVolume !== 1
          || step.firstJourney.hasSave
      ) {
        out.errors.push(vp.name + ': fresh player did not begin on the transparent Journey: '
          + JSON.stringify(step.firstJourney));
      }
      step.semantics = await pg.evaluate(() => ({
        canvasRole: document.querySelector('canvas')?.getAttribute('role'),
        labelledCanvas: Boolean(document.querySelector('canvas')?.getAttribute('aria-label')),
          liveStatus: Boolean(document.querySelector('[aria-live="polite"]')),
          semanticControls: document.querySelectorAll('.game-accessibility button').length,
          audioSliders: document.querySelectorAll('.game-accessibility input[type="range"]').length,
        }));
      if (step.semantics.canvasRole !== 'application' || !step.semantics.labelledCanvas || !step.semantics.liveStatus
        || step.semantics.semanticControls < 6 || step.semantics.audioSliders !== 2) {
        out.errors.push(vp.name + ': semantic companion controls missing: ' + JSON.stringify(step.semantics));
      }
      const scoresButton = pg.locator('.game-scores-toggle');
      const scoresButtonBox = await scoresButton.boundingBox();
      await scoresButton.click();
      await pg.waitForFunction(() => Boolean(document.querySelector('#game-score-history')),
        null, { timeout: 1200 }).catch(() => {});
      const emptyScores = await pg.evaluate(() => {
        const dialog = document.querySelector('#game-score-history');
        const box = dialog?.getBoundingClientRect();
        return {
          role: dialog?.getAttribute('role'),
          width: box?.width,
          height: box?.height,
          left: box?.left,
          right: box?.right,
          top: box?.top,
          bottom: box?.bottom,
          empty: document.querySelector('.game-score-history__empty')?.textContent?.trim(),
          activeText: document.activeElement?.textContent?.trim(),
        };
      });
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, `${vp.name}-scores-empty.png`) });
      await pg.keyboard.press('Escape');
      await pg.waitForFunction(() => !document.querySelector('#game-score-history'),
        null, { timeout: 1200 }).catch(() => {});
      step.emptyScores = { button: scoresButtonBox, dialog: emptyScores };
      if (!scoresButtonBox
        || scoresButtonBox.width < 44
        || scoresButtonBox.height < 44
        || scoresButtonBox.x < 0
        || scoresButtonBox.x + scoresButtonBox.width > vp.w + 1
        || emptyScores.role !== 'dialog'
        || !emptyScores.empty?.includes('first score')
        || emptyScores.activeText !== 'CLOSE'
        || emptyScores.left < 0
        || emptyScores.right > vp.w + 1
        || emptyScores.top < 0
        || emptyScores.bottom > vp.h + 1) {
        out.errors.push(vp.name + ': empty score chronicle is clipped or inaccessible: '
          + JSON.stringify(step.emptyScores));
      }
      if (vp.name === 'desktop') {
        // Focused DOM controls own Enter/Space. They must not confirm the game
        // or leak a combat action through the window-level input handler.
        const soundButton = pg.locator('.game-accessibility button').nth(1);
        await soundButton.focus();
        await pg.waitForFunction(() => Boolean(document.querySelector('.game-controls-backdrop')),
          null, { timeout: 1000 }).catch(() => {});
        step.focusReveal = await pg.locator('.game-accessibility').evaluate((panel) => {
          const box = panel.getBoundingClientRect();
          const actions = panel.querySelector('.game-accessibility__actions');
          const primary = panel.querySelector('.game-accessibility__primary')?.getBoundingClientRect();
          const primaryNode = panel.querySelector('.game-accessibility__primary');
          const tipsNode = panel.querySelector('.game-accessibility__tips summary');
          const sound = panel.querySelector('.game-accessibility__sound')?.getBoundingClientRect();
          const ranges = Array.from(panel.querySelectorAll('.game-accessibility__range'))
            .map((node) => node.getBoundingClientRect());
          const trialRow = [
            panel.querySelector('.game-accessibility__trial-step'),
            panel.querySelector('.game-accessibility__trial'),
            panel.querySelectorAll('.game-accessibility__trial-step')[1],
          ].map((node) => node?.getBoundingClientRect());
          return {
            width: box.width,
            height: box.height,
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
            clipped: getComputedStyle(panel).clipPath,
            actionsDisplay: actions ? getComputedStyle(actions).display : '',
            hasBackdrop: Boolean(document.querySelector('.game-controls-backdrop')),
            primaryBeforeTips: Boolean(primaryNode && tipsNode
              && (primaryNode.compareDocumentPosition(tipsNode) & Node.DOCUMENT_POSITION_FOLLOWING)),
            primary: primary ? { x: primary.x, y: primary.y, width: primary.width } : null,
            sound: sound ? { x: sound.x, y: sound.y, width: sound.width } : null,
            ranges: ranges.map((range) => ({ x: range.x, width: range.width })),
            trialRow: trialRow.map((item) => item ? ({ x: item.x, y: item.y, width: item.width }) : null),
          };
        });
        if (step.focusReveal.width < 300 || step.focusReveal.height < 100
          || step.focusReveal.clipped !== 'none'
          || step.focusReveal.actionsDisplay !== 'grid'
          || !step.focusReveal.hasBackdrop
          || !step.focusReveal.primaryBeforeTips
          || step.focusReveal.left < 0
          || step.focusReveal.right > vp.w + 1
          || step.focusReveal.top < 0
          || step.focusReveal.bottom > vp.h + 1
          || !step.focusReveal.primary
          || !step.focusReveal.sound
          || Math.abs(step.focusReveal.primary.y - step.focusReveal.sound.y) > 2
          || Math.abs(step.focusReveal.primary.width - step.focusReveal.sound.width) > 2
          || step.focusReveal.ranges.length !== 2
          || step.focusReveal.ranges.some((range) => range.width < step.focusReveal.width - 50)
          || step.focusReveal.trialRow.some((item) => !item)
          || step.focusReveal.trialRow.some((item) => Math.abs(item.y - step.focusReveal.trialRow[0].y) > 2)) {
          out.errors.push('desktop: keyboard controls panel is clipped or loses its visual grid: '
            + JSON.stringify(step.focusReveal));
        }
        const semanticBefore = await pg.evaluate(() => ({ state: window.__game.state, muted: window.__game.audio.muted }));
        await pg.keyboard.press('Enter');
        await pg.waitForTimeout(80);
        const semanticAfter = await pg.evaluate(() => ({ state: window.__game.state, muted: window.__game.audio.muted,
          light: window.__game.input.hasBuffered('light'), roll: window.__game.input.hasBuffered('roll'),
          confirmSequence: window.__game.input.confirmSequence }));
        step.semanticKeyboard = { before: semanticBefore, after: semanticAfter };
        if (semanticAfter.state !== 'title' || semanticAfter.muted === semanticBefore.muted || semanticAfter.light || semanticAfter.roll) {
          out.errors.push('desktop: semantic Sound control leaked into game input: ' + JSON.stringify(step.semanticKeyboard));
        }
        await pg.keyboard.press('Enter'); // restore sound for the audio checks

        const musicSlider = pg.getByRole('slider', { name: 'Music volume' });
        const sfxSlider = pg.getByRole('slider', { name: 'Combat effects volume' });
        await musicSlider.fill('70');
        await sfxSlider.fill('90');
        const semanticMix = await pg.evaluate(() => ({
          music: window.__game.audio.musicVolume,
          sfx: window.__game.audio.sfxVolume,
          save: JSON.parse(localStorage.getItem('gracefell')),
        }));
        step.semanticMix = semanticMix;
        if (Math.abs(semanticMix.music - 0.7) > 0.001 || Math.abs(semanticMix.sfx - 0.9) > 0.001
          || Math.abs(semanticMix.save.musicVolume - 0.7) > 0.001
          || Math.abs(semanticMix.save.sfxVolume - 0.9) > 0.001) {
          out.errors.push('desktop: independent music/effects controls did not persist: ' + JSON.stringify(semanticMix));
        }
        await musicSlider.fill('85');
        await sfxSlider.fill('100');

        // Post-launch persona review alleged that a pointer activation of the
        // semantic path controls could start the fight or shift the selected
        // path again when Start was activated. Exercise pointer and keyboard
        // ownership directly before accepting the title.
        const moreOath = pg.getByRole('button', { name: /Harder path/ });
        await moreOath.focus();
        await moreOath.click();
        await pg.waitForFunction(() => window.__game.grace === -1, null, { timeout: 1000 }).catch(() => {});
        const afterPointerOath = await pg.evaluate(() => ({
          state: window.__game.state,
          grace: window.__game.grace,
          label: document.querySelector('output[aria-label="Current difficulty"]')?.textContent,
          confirmSequence: window.__game.input.confirmSequence,
        }));
        const moreGrace = pg.getByRole('button', { name: /Easier path/ });
        await moreGrace.focus();
        await pg.keyboard.press('Enter');
        await pg.waitForFunction(() => window.__game.grace === -2, null, { timeout: 1000 }).catch(() => {});
        const afterKeyboardGrace = await pg.evaluate(() => ({
          state: window.__game.state,
          grace: window.__game.grace,
          label: document.querySelector('output[aria-label="Current difficulty"]')?.textContent,
          confirmSequence: window.__game.input.confirmSequence,
        }));
        step.semanticPathOwnership = { afterPointerOath, afterKeyboardGrace };
        if (afterPointerOath.state !== 'title' || afterPointerOath.grace !== -1
          || afterPointerOath.label !== 'STEADIED · GENTLE'
          || afterKeyboardGrace.state !== 'title' || afterKeyboardGrace.grace !== -2
          || afterKeyboardGrace.label !== 'JOURNEY · GUIDED'
          || afterPointerOath.confirmSequence !== semanticAfter.confirmSequence
          || afterKeyboardGrace.confirmSequence !== semanticAfter.confirmSequence) {
          out.errors.push('desktop: semantic path controls leaked into canvas confirmation: '
            + JSON.stringify(step.semanticPathOwnership));
        }

        const tips = pg.locator('.game-accessibility__tips summary');
        await tips.focus();
        const tipsBefore = await pg.evaluate(() => ({
          state: window.__game.state,
          confirmSequence: window.__game.input.confirmSequence,
        }));
        await pg.keyboard.press('Enter');
        await pg.waitForTimeout(80);
        const tipsAfter = await pg.evaluate(() => ({
          open: document.querySelector('.game-accessibility__tips')?.open,
          copy: document.querySelector('.game-accessibility__tips')?.textContent?.trim() || '',
          state: window.__game.state,
          confirmSequence: window.__game.input.confirmSequence,
        }));
        step.semanticTips = { before: tipsBefore, after: tipsAfter };
        if (!tipsAfter.open
          || !tipsAfter.copy.includes('hold Heavy through the charge')
          || tipsAfter.copy.includes('tap Break')
          || tipsAfter.state !== 'title'
          || tipsAfter.confirmSequence !== tipsBefore.confirmSequence) {
          out.errors.push('desktop: Combat tips lost keyboard ownership or device-specific Gracebreak copy: '
            + JSON.stringify(step.semanticTips));
        }
        await pg.keyboard.press('Enter'); // close the optional disclosure
        await pg.locator('canvas').focus();
      }
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

      // Desktop starts through the semantic button so focus cannot remain on
      // the disabled title control and pause the fight. Touch/non-touch mobile
      // retain their direct canvas start paths.
      if (vp.name === 'desktop') {
        const startButton = pg.getByRole('button', { name: 'Raise your blade' });
        await startButton.focus();
        await pg.keyboard.press('Enter');
      } else {
        await pg.mouse.click(vp.w / 2, vp.h / 2);
      }
      await pg.waitForFunction(() => window.__game && window.__game.state === 'intro', null, { timeout: 2500 }).catch(() => {});
      const introClean = await pg.evaluate(() => {
        const g = window.__game;
        return { state: g.state, playerState: g.player.state, stamina: g.player.stam, bossState: g.boss.state,
          projectiles: g.projectiles.length, rings: g.rings.length, meteors: g.meteors.length };
      });
      step.introIsolation = introClean;
      if (introClean.state !== 'intro' || introClean.playerState !== 'move' || introClean.stamina !== 100
        || introClean.projectiles || introClean.rings || introClean.meteors) {
        out.errors.push(vp.name + ': title confirmation or intro leaked combat: ' + JSON.stringify(introClean));
      }
      await pg.waitForFunction(() => (window).__game && (window).__game.state === 'fight', null, { timeout: 8000 }).catch(() => {});
      const st1 = await pg.evaluate(() => (window).__game && (window).__game.state);
      step.stateAfterStart = st1;
      if (st1 !== 'fight') out.errors.push(vp.name + ': did not reach fight state (' + st1 + ')');
      step.openingGuidance = await pg.evaluate(() => {
        const g = window.__game;
        return {
          bossState: g.boss.state,
          bossT: g.boss.t,
          tutorialStage: g.tutorialStage,
          tutorialT: g.tutorialT,
          grace: g.graceAtStart,
        };
      });
      if (step.openingGuidance.grace < 0
        && step.openingGuidance.tutorialStage === 'move'
        && (step.openingGuidance.bossState !== 'stalk'
          || step.openingGuidance.bossT < 3
          || step.openingGuidance.tutorialT < 4.3)) {
        out.errors.push(vp.name + ': first-run Journey lost its playable opening guidance: '
          + JSON.stringify(step.openingGuidance));
      }
      await pg.waitForTimeout(300);
      step.combatSemantics = await pg.evaluate(() => ({
        status: document.querySelector('#game-status')?.textContent,
        labelled: document.querySelector('#game-combat-status')?.getAttribute('aria-label'),
        terms: Array.from(document.querySelectorAll('#game-combat-status dt')).map((node) => node.textContent?.trim()),
        values: Array.from(document.querySelectorAll('#game-combat-status dd')).map((node) => node.textContent?.trim()),
      }));
      if (!step.combatSemantics.status?.includes('Battle in progress')
        || step.combatSemantics.labelled !== 'Current combat status'
        || !step.combatSemantics.terms.includes('Health')
        || !step.combatSemantics.terms.includes('Malakar health')
        || !step.combatSemantics.terms.includes('Queued attacks')
        || step.combatSemantics.values.length !== step.combatSemantics.terms.length) {
        out.errors.push(vp.name + ': semantic combat telemetry missing: ' + JSON.stringify(step.combatSemantics));
      }
      const pauseControl = pg.locator('.game-pause-toggle');
      await pauseControl.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
      step.pauseControl = await pauseControl.evaluate((button) => {
        const box = button.getBoundingClientRect();
        return {
          label: button.textContent?.trim(),
          width: box.width,
          height: box.height,
          left: box.left,
          right: box.right,
          top: box.top,
          ariaPressed: button.getAttribute('aria-pressed'),
          shortcuts: button.getAttribute('aria-keyshortcuts'),
        };
      }).catch(() => null);
      if (!step.pauseControl
        || step.pauseControl.label !== 'PAUSE'
        || step.pauseControl.width < 44
        || step.pauseControl.height < 44
        || step.pauseControl.left < 0
        || step.pauseControl.right > vp.w + 1
        || step.pauseControl.top < 0
        || step.pauseControl.ariaPressed !== 'false'
        || !step.pauseControl.shortcuts?.includes('Escape')) {
        out.errors.push(vp.name + ': pause control is missing, clipped, or too small: '
          + JSON.stringify(step.pauseControl));
      }
      const menuControl = pg.locator('.game-menu-toggle');
      await menuControl.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
      step.menuControl = await menuControl.evaluate((button) => {
        const box = button.getBoundingClientRect();
        return {
          label: button.textContent?.trim(),
          width: box.width,
          height: box.height,
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
        };
      }).catch(() => null);
      if (!step.menuControl
        || step.menuControl.label !== 'MENU'
        || step.menuControl.width < 44
        || step.menuControl.height < 44
        || step.menuControl.left < 0
        || step.menuControl.right > vp.w + 1
        || step.menuControl.top < 0
        || step.menuControl.bottom > vp.h + 1) {
        out.errors.push(vp.name + ': battle menu control is missing, clipped, or too small: '
          + JSON.stringify(step.menuControl));
      }

      const mixControl = pg.locator('.game-mix-toggle');
      const beforeMix = await pg.evaluate(() => {
        // Pin a harmless combat state so this UI ownership check cannot
        // randomly resume into an already-committed boss strike. The lane
        // still proves time/input/audio pause and focus restoration; boss-hit
        // behavior is covered by deterministic combat checks below.
        const g = window.__game;
        g.player.state = 'move';
        g.player.t = 0;
        g.boss.state = 'stalk';
        g.boss.t = 9;
        g.boss.vx = 0;
        g.boss.vy = 0;
        g.projectiles = [];
        g.rings = [];
        g.meteors = [];
        return {
          playerState: g.player.state,
          fightTime: g.fightTime,
        };
      });
      await mixControl.click();
      await pg.waitForFunction(() => document.querySelector('.game-accessibility')?.classList.contains('is-mix-open'),
        null, { timeout: 1200 }).catch(() => {});
      const mixOpenState = await pg.evaluate(() => ({
        expanded: document.querySelector('.game-mix-toggle')?.getAttribute('aria-expanded'),
        dialog: document.querySelector('.game-accessibility')?.getAttribute('role'),
        paused: window.__game.paused,
        manualPaused: window.__game.manualPaused,
        audio: window.__game.audio.debugState().contextState,
        playerState: window.__game.player.state,
        fightTime: window.__game.fightTime,
        activeLabel: document.activeElement?.getAttribute('aria-label'),
        pauseDisabled: document.querySelector('.game-pause-toggle')?.disabled,
        canvasTabIndex: document.querySelector('canvas')?.tabIndex,
      }));
      await pg.waitForTimeout(150);
      const mixHeldState = await pg.evaluate(() => ({
        paused: window.__game.paused,
        playerState: window.__game.player.state,
        fightTime: window.__game.fightTime,
        audio: window.__game.audio.debugState().contextState,
      }));
      let focusTrap = null;
      if (vp.name === 'desktop') {
        await pg.keyboard.press('Shift+Tab');
        await pg.keyboard.press('Shift+Tab');
        focusTrap = await pg.evaluate(() => ({
          text: document.activeElement?.textContent?.trim(),
          insideDialog: Boolean(document.activeElement?.closest('[role="dialog"]')),
        }));
      }
      const testSfx = pg.getByRole('button', { name: 'TEST SFX' });
      const testSfxCount = await testSfx.count();
      if (testSfxCount === 1) await testSfx.click();
      if (vp.name === 'desktop') {
        const musicSlider = pg.getByRole('slider', { name: 'Music volume' });
        await musicSlider.press('Escape');
      } else {
        const done = pg.getByRole('button', { name: 'DONE · RESUME' });
        const doneCount = await done.count();
        if (doneCount === 1) await done.click();
      }
      await pg.waitForFunction(() => !window.__game.paused
        && document.querySelector('.game-mix-toggle')?.getAttribute('aria-expanded') === 'false',
      null, { timeout: 1200 }).catch(() => {});
      const afterMix = await pg.evaluate(() => ({
        expanded: document.querySelector('.game-mix-toggle')?.getAttribute('aria-expanded'),
        paused: window.__game.paused,
        audio: window.__game.audio.debugState().contextState,
        playerState: window.__game.player.state,
        fightTime: window.__game.fightTime,
        bufferedLight: window.__game.input.hasBuffered('light'),
        activeIsCanvas: document.activeElement === document.querySelector('canvas'),
      }));
      step.mixControl = { before: beforeMix, open: mixOpenState, held: mixHeldState, focusTrap, after: afterMix };
      if (mixOpenState.expanded !== 'true' || mixOpenState.dialog !== 'dialog'
        || !mixOpenState.paused || mixOpenState.manualPaused || mixOpenState.audio !== 'running'
        || mixOpenState.playerState !== beforeMix.playerState
        || mixOpenState.activeLabel !== 'Music volume'
        || !mixOpenState.pauseDisabled || mixOpenState.canvasTabIndex !== -1
        || !mixHeldState.paused || mixHeldState.audio !== 'running'
        || mixHeldState.playerState !== mixOpenState.playerState
        || Math.abs(mixHeldState.fightTime - mixOpenState.fightTime) > 0.03
        || (vp.name === 'desktop' && (!focusTrap?.insideDialog || focusTrap.text !== 'DONE · RESUME'))
        || testSfxCount !== 1
        || afterMix.expanded !== 'false' || afterMix.paused || afterMix.audio !== 'running'
        || afterMix.playerState !== beforeMix.playerState || afterMix.bufferedLight
        || !afterMix.activeIsCanvas) {
        out.errors.push(vp.name + ': combat MIX did not audition and dismiss safely: '
          + JSON.stringify(step.mixControl));
      }

      const beforeBattleMenu = await pg.evaluate(() => ({
        fightTime: window.__game.fightTime,
        playerState: window.__game.player.state,
      }));
      await menuControl.click();
      await pg.waitForFunction(() => Boolean(document.querySelector('#game-battle-menu')),
        null, { timeout: 1200 }).catch(() => {});
      await pg.waitForTimeout(140);
      const battleMenuOpen = await pg.evaluate(() => ({
        dialog: document.querySelector('#game-battle-menu')?.getAttribute('role'),
        title: document.querySelector('#game-battle-menu-title')?.textContent?.trim(),
        paused: window.__game.paused,
        manualPaused: window.__game.manualPaused,
        audio: window.__game.audio.debugState().contextState,
        fightTime: window.__game.fightTime,
        playerState: window.__game.player.state,
        activeText: document.activeElement?.textContent?.trim(),
        canvasTabIndex: document.querySelector('canvas')?.tabIndex,
        pauseDisabled: document.querySelector('.game-pause-toggle')?.disabled,
      }));
      await pg.waitForTimeout(140);
      const battleMenuHeld = await pg.evaluate(() => ({
        paused: window.__game.paused,
        audio: window.__game.audio.debugState().contextState,
        fightTime: window.__game.fightTime,
        playerState: window.__game.player.state,
      }));
      await pg.getByRole('button', { name: 'RESUME BATTLE' }).click();
      await pg.waitForFunction(() => !window.__game.paused
        && !document.querySelector('#game-battle-menu')
        && window.__game.audio.debugState().contextState === 'running',
        null, { timeout: 1500 }).catch(() => {});
      const battleMenuAfter = await pg.evaluate(() => ({
        paused: window.__game.paused,
        audio: window.__game.audio.debugState().contextState,
        playerState: window.__game.player.state,
        bufferedLight: window.__game.input.hasBuffered('light'),
        activeIsCanvas: document.activeElement === document.querySelector('canvas'),
      }));
      step.battleMenuResume = {
        before: beforeBattleMenu,
        open: battleMenuOpen,
        held: battleMenuHeld,
        after: battleMenuAfter,
      };
      if (battleMenuOpen.dialog !== 'dialog'
        || battleMenuOpen.title !== 'Return to the main menu?'
        || !battleMenuOpen.paused
        || battleMenuOpen.manualPaused
        || battleMenuOpen.audio !== 'suspended'
        || battleMenuOpen.activeText !== 'RESUME BATTLE'
        || battleMenuOpen.canvasTabIndex !== -1
        || !battleMenuOpen.pauseDisabled
        || !battleMenuHeld.paused
        || battleMenuHeld.audio !== 'suspended'
        || Math.abs(battleMenuHeld.fightTime - battleMenuOpen.fightTime) > 0.03
        || battleMenuHeld.playerState !== battleMenuOpen.playerState
        || battleMenuAfter.paused
        || battleMenuAfter.audio !== 'running'
        || battleMenuAfter.bufferedLight
        || !battleMenuAfter.activeIsCanvas) {
        out.errors.push(vp.name + ': battle menu did not pause and resume safely: '
          + JSON.stringify(step.battleMenuResume));
      }

      if (vp.name === 'desktop') {
        const semanticStart = await pg.evaluate(() => ({
          paused: window.__game.paused,
          uiFocused: window.__game.uiFocused,
          activeIsCanvas: document.activeElement === document.querySelector('canvas'),
          rafRunning: window.__game.raf !== 0,
        }));
        step.semanticStart = semanticStart;
        if (semanticStart.paused || semanticStart.uiFocused || !semanticStart.activeIsCanvas || !semanticStart.rafRunning) {
          out.errors.push('desktop: semantic Raise your blade did not return control to the canvas: ' + JSON.stringify(semanticStart));
        }

        // Player pause is distinct from focus/interruption pause: it must stop
        // simulation + audio, survive time, clear paused combat input on
        // resume, and leave the keyboard with the canvas.
        const beforeManualPause = await pg.evaluate(() => ({
          fightTime: window.__game.fightTime,
          playerState: window.__game.player.state,
          bossState: window.__game.boss.state,
        }));
        await pg.keyboard.press('KeyP');
        await pg.waitForFunction(() => window.__game.manualPaused && window.__game.paused, null, { timeout: 1000 }).catch(() => {});
        await pg.waitForFunction(() => window.__game.audio.debugState().contextState === 'suspended', null, { timeout: 1500 }).catch(() => {});
        const pausedAt = await pg.evaluate(() => ({
          fightTime: window.__game.fightTime,
          playerState: window.__game.player.state,
          bossState: window.__game.boss.state,
        }));
        await pg.keyboard.press('KeyJ');
        await pg.waitForTimeout(280);
        const duringManualPause = await pg.evaluate(() => ({
          paused: window.__game.paused,
          manualPaused: window.__game.manualPaused,
          fightTime: window.__game.fightTime,
          playerState: window.__game.player.state,
          bossState: window.__game.boss.state,
          rafRunning: window.__game.raf !== 0,
          audioState: window.__game.audio.debugState().contextState,
          status: window.__game.uiSnapshot().status,
          button: document.querySelector('.game-pause-toggle')?.textContent?.trim(),
          ariaPressed: document.querySelector('.game-pause-toggle')?.getAttribute('aria-pressed'),
          mixDisabled: document.querySelector('.game-mix-toggle')?.disabled,
          lightBuffered: window.__game.input.hasBuffered('light'),
        }));
        step.manualPause = { before: beforeManualPause, pausedAt, during: duringManualPause };
        await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop-paused.png') });
        await pg.keyboard.press('Escape');
        await pg.waitForFunction(() => !window.__game.paused && !window.__game.manualPaused, null, { timeout: 1500 }).catch(() => {});
        await pg.waitForTimeout(80);
        const afterManualResume = await pg.evaluate(() => ({
          paused: window.__game.paused,
          manualPaused: window.__game.manualPaused,
          fightTime: window.__game.fightTime,
          playerState: window.__game.player.state,
          rafRunning: window.__game.raf !== 0,
          activeIsCanvas: document.activeElement === document.querySelector('canvas'),
          button: document.querySelector('.game-pause-toggle')?.textContent?.trim(),
          ariaPressed: document.querySelector('.game-pause-toggle')?.getAttribute('aria-pressed'),
          mixDisabled: document.querySelector('.game-mix-toggle')?.disabled,
          lightBuffered: window.__game.input.hasBuffered('light'),
        }));
        step.manualPause.after = afterManualResume;
        if (!duringManualPause.paused || !duringManualPause.manualPaused
          || Math.abs(duringManualPause.fightTime - pausedAt.fightTime) > 0.03
          || duringManualPause.playerState !== pausedAt.playerState
          || duringManualPause.bossState !== pausedAt.bossState
          || duringManualPause.rafRunning
          || duringManualPause.audioState !== 'suspended'
          || duringManualPause.status !== 'Paused'
          || duringManualPause.button !== 'RESUME'
          || duringManualPause.ariaPressed !== 'true'
          || !duringManualPause.mixDisabled
          || afterManualResume.paused
          || afterManualResume.manualPaused
          || !afterManualResume.rafRunning
          || !afterManualResume.activeIsCanvas
          || afterManualResume.button !== 'PAUSE'
          || afterManualResume.ariaPressed !== 'false'
          || afterManualResume.mixDisabled
          || afterManualResume.lightBuffered
          || afterManualResume.playerState === 'light') {
          out.errors.push('desktop: player pause/resume contract failed: ' + JSON.stringify(step.manualPause));
        }
      }

      if (vp.name === 'desktop') {
        // Revealing/focusing settings during combat pauses the simulation;
        // Space activates the DOM button only and cannot roll behind it.
        const soundButton = pg.locator('.game-accessibility button').nth(1);
        const beforeFocus = await pg.evaluate(() => ({ fightTime: window.__game.fightTime, muted: window.__game.audio.muted,
          playerState: window.__game.player.state, stamina: window.__game.player.stam }));
        await soundButton.focus();
        await pg.waitForFunction(() => window.__game.paused, null, { timeout: 1000 }).catch(() => {});
        const pausedAt = await pg.evaluate(() => ({ fightTime: window.__game.fightTime, muted: window.__game.audio.muted,
          playerState: window.__game.player.state, stamina: window.__game.player.stam }));
        await pg.waitForTimeout(260);
        await pg.keyboard.press('Space');
        await pg.waitForTimeout(100);
        const duringFocus = await pg.evaluate(() => ({ paused: window.__game.paused, fightTime: window.__game.fightTime,
          muted: window.__game.audio.muted, playerState: window.__game.player.state, stamina: window.__game.player.stam }));
        step.semanticCombatPause = { before: beforeFocus, pausedAt, during: duringFocus };
        if (!duringFocus.paused || Math.abs(duringFocus.fightTime - pausedAt.fightTime) > 0.03
          || duringFocus.muted === pausedAt.muted || duringFocus.playerState === 'roll' || duringFocus.stamina < pausedAt.stamina) {
          out.errors.push('desktop: focused settings did not isolate/pause combat: ' + JSON.stringify(step.semanticCombatPause));
        }
        await pg.keyboard.press('Space'); // restore sound
        await pg.locator('canvas').focus();
        await pg.waitForFunction(() => !window.__game.paused, null, { timeout: 1500 }).catch(() => {});
      }

      // Audio cannot be heard headlessly, but its runtime architecture and every
      // distinct boss cue can still be initialized and exercised without errors.
      const audioState = await pg.evaluate(() => {
        const g = window.__game;
        const pan = [-0.8, -0.5, -0.2, 0.2, 0.5, 0.8, 0];
        ['swipe', 'slam', 'charge', 'volley', 'meteor', 'ring', 'spiral']
          .forEach((cue, i) => g.audio.telegraph(cue, pan[i]));
        const strongDuck = g.audio.debugState().mix.currentDuckAmount;
        g.audio.swing(1, { pan: 0, distance: 0 });
        const overlapDuck = g.audio.debugState().mix.currentDuckAmount;
        const farLeft = { pan: -0.8, distance: 470 };
        const farRight = { pan: 0.8, distance: 430 };
        g.audio.meteorWarning(farLeft);
        g.audio.ring(farRight);
        g.audio.hit(true, farRight, 2);
        g.audio.bossStep(farLeft, 1.1);
        g.audio.chargeScrape(farRight);
        g.audio.roar(true, farLeft);
        g.audio.updateCombatState(0.12, 0.18, true);
        // At the normal-voice cutoff, the light contact crack must still enter
        // the six-voice critical reserve instead of disappearing under music.
        const normalVoices = g.audio.activeVoices;
        g.audio.activeVoices = g.audio.maxVoices - 6;
        const pressureBefore = g.audio.activeVoices;
        g.audio.hit(false, { pan: 0, distance: 30 }, 1);
        const pressureAfter = g.audio.activeVoices;
        const debug = g.audio.debugState();
        g.audio.activeVoices = normalVoices;
        return { ...debug, lightPressureDelta: pressureAfter - pressureBefore, strongDuck, overlapDuck };
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
      if (!audioState.waveDataPrepared || audioState.lightPressureDelta < 1) {
        out.errors.push(vp.name + ': light-hit contact cue did not survive voice pressure: ' + JSON.stringify(audioState));
      }
      if (audioState.soundtrackMode !== 'stream') {
        out.errors.push(vp.name + ': soundtrack is not using the streaming path: ' + JSON.stringify(audioState));
      }
      if (audioState.soundtrackPhase !== 1 || audioState.soundtrackDeckCount !== 2) {
        out.errors.push(vp.name + ': phase soundtrack decks were not prepared: ' + JSON.stringify(audioState));
      }
      // Native AudioContext construction varies by browser/host and accounts
      // for >90% of this interval in isolated baseline/current A/B runs. Keep
      // a conservative total hitch guard, but gate the graph work the app
      // actually controls independently.
      if (!(audioState.contextCreateCostMs > 0)
        || !(audioState.graphInitCostMs > 0)
        || audioState.graphInitCostMs > MAX_GRAPH_INIT_MS
        || audioState.initCostMs > 40) {
        out.errors.push(vp.name + ': first-gesture audio init exceeded the 40ms total / 12ms graph ceiling: '
          + JSON.stringify(audioState));
      }
      if (!(audioState.soundtrackStartCostMs > 0) || audioState.soundtrackStartCostMs > 1500) {
        out.errors.push(vp.name + ': streamed soundtrack unlock/start exceeded 1500ms: ' + JSON.stringify(audioState));
      }
      if (audioState.arenaIrDuration < 1.5 || audioState.irBuildCostMs > 50) {
        out.errors.push(vp.name + ': arena IR failed duration/init budget: ' + JSON.stringify(audioState));
      }
      if (audioState.contextSampleRate !== audioState.arenaIrSampleRate) {
        out.errors.push(vp.name + ': arena IR sample rate does not match the AudioContext: ' + JSON.stringify(audioState));
      }
      if (
        audioState.mix.sfxLevel < 1
        || audioState.mix.musicLevel > 0.25
        || audioState.mix.soundtrackBaseLevel > 0.6
        || audioState.mix.soundtrackPresenceDipDb > -4
      ) {
        out.errors.push(vp.name + ': music/SFX separation regressed: ' + JSON.stringify(audioState.mix));
      }
      if (audioState.mix.duckCount < 10 || audioState.mix.minDuckAmount > 0.25) {
        out.errors.push(vp.name + ': action-triggered music ducking was not exercised: ' + JSON.stringify(audioState.mix));
      }
      if (audioState.strongDuck > 0.21 || audioState.overlapDuck > audioState.strongDuck + 0.001) {
        out.errors.push(vp.name + ': weaker action raised music during a critical duck: ' + JSON.stringify({
          strongDuck: audioState.strongDuck,
          overlapDuck: audioState.overlapDuck,
        }));
      }
      if (audioState.variationCount < 4 || audioState.maxObservedDistance < 400) {
        out.errors.push(vp.name + ': variation/spatial audio paths were not exercised: ' + JSON.stringify(audioState));
      }
      if (audioState.adaptive.tension < 0.8 || audioState.adaptive.intensity < 0.4 || !audioState.adaptive.staggered) {
        out.errors.push(vp.name + ': adaptive music state did not engage: ' + JSON.stringify(audioState));
      }

      if (vp.name === 'desktop') {
        await pg.evaluate(() => window.__game.setUiFocused(true, true));
        await pg.waitForTimeout(1600);
        const duckRecovery = await pg.evaluate(() => {
          const g = window.__game;
          const recovered = g.audio.debugState();
          g.audio.telegraph('slam', 0);
          g.setMusicVolume(0.6);
          const volumeDuringDuck = g.audio.debugState();
          return { recovered, volumeDuringDuck };
        });
        await pg.waitForTimeout(1100);
        const duckRecoveredAfterVolume = await pg.evaluate(() => {
          const g = window.__game;
          g.setMusicVolume(0.85);
          const recovered = g.audio.debugState();
          g.setUiFocused(false);
          return recovered;
        });
        step.duckLifecycle = { ...duckRecovery, recoveredAfterVolume: duckRecoveredAfterVolume };
        if (duckRecovery.recovered.mix.activeDuckCount !== 0
          || duckRecovery.recovered.mix.currentDuckAmount < 0.99
          || duckRecovery.volumeDuringDuck.mix.musicVolume !== 0.6
          || duckRecovery.volumeDuringDuck.mix.currentDuckAmount > 0.25
          || duckRecoveredAfterVolume.mix.currentDuckAmount < 0.99) {
          out.errors.push('desktop: stacked music duck did not expire/recover across a volume change: '
            + JSON.stringify(step.duckLifecycle));
        }

        // simulate combat: move, roll, attack; force phase transitions via damage

        // v2.14 (1): dynamic combat camera. Intent is numeric, like menuGeom —
        // a clean 1v1 tightens the frame; active area-denial widens it back
        // toward the viewport-fit floor so a phone never zooms into a storm.
        const camClean = await pg.evaluate(() => {
          const g = window.__game;
          g.projectiles.length = 0; g.rings.length = 0; g.meteors.length = 0;
          return {
            base: g.baseZoom ?? null,
            target: typeof g.combatZoomTarget === 'function' ? g.combatZoomTarget() : null,
            phase: g.boss.phase,
          };
        });
        step.camClean = camClean;
        if (camClean.base === null || camClean.target === null || !(camClean.target > camClean.base * 1.04)) {
          out.errors.push('v2.14 (1): camera did not tighten in clean melee: ' + JSON.stringify(camClean));
        }
        const camBusy = await pg.evaluate(() => {
          const g = window.__game;
          for (let i = 0; i < 8; i++) g.projectiles.push({ x: 0, y: 0, vx: 0, vy: 0, r: 7, dmg: 0, life: 0.001, hostile: true, hue: '#ffffff' });
          const target = typeof g.combatZoomTarget === 'function' ? g.combatZoomTarget() : null;
          g.projectiles.length = 0;
          return { base: g.baseZoom ?? null, target };
        });
        step.camBusy = camBusy;
        if (camBusy.base === null || camBusy.target === null || !(camBusy.target <= camBusy.base * 1.02)) {
          out.errors.push('v2.14 (1): camera did not widen under area-denial load: ' + JSON.stringify(camBusy));
        }

        await pg.keyboard.down('KeyW');
        await pg.waitForTimeout(300);
        await pg.keyboard.up('KeyW');
        await pg.keyboard.press('KeyJ');
        await pg.waitForTimeout(200);
        await pg.keyboard.press('Space');
        await pg.waitForTimeout(400);

        // phase 2
        await pg.evaluate(() => { const g = (window).__game; g.boss.takeDamage(g.boss.maxHp * 0.5, g, g.player.x, g.player.y); });
        await pg.waitForFunction(() => window.__game.audio.debugState().soundtrackTransitioning,
          null, { timeout: 1500 }).catch(() => {});
        const phase2TransitionStarted = await pg.evaluate(() => window.__game.audio.debugState().soundtrackTransitioning);
        let phase2WeatherPause = null;
        if (phase2TransitionStarted) {
          const beforePause = await pg.evaluate(() => window.__game.weatherSnapshot());
          await pg.keyboard.press('KeyP');
          await pg.waitForFunction(() => window.__game.audio.debugState().contextState === 'suspended',
            null, { timeout: 1200 }).catch(() => {});
          const pausedAt = await pg.evaluate(() => window.__game.weatherSnapshot());
          await pg.waitForTimeout(160);
          const held = await pg.evaluate(() => window.__game.weatherSnapshot());
          phase2WeatherPause = { beforePause, pausedAt, held };
          await pg.keyboard.press('Escape');
          await pg.waitForFunction(() => window.__game.audio.debugState().contextState === 'running',
            null, { timeout: 1200 }).catch(() => {});
        }
        step.weatherPause = phase2WeatherPause;
        if (!phase2WeatherPause
          || phase2WeatherPause.pausedAt.phase !== 2
          || Math.abs(phase2WeatherPause.held.blend - phase2WeatherPause.pausedAt.blend) > 0.000001) {
          out.errors.push('v2.20: phase weather advanced under pause: ' + JSON.stringify(phase2WeatherPause));
        }
        // The score waits at most 250ms for the next nominal 78 BPM beat,
        // then completes its 720ms equal-power crossfade.
        await pg.waitForFunction(() => {
          const audio = window.__game.audio.debugState();
          return audio.soundtrackPhase === 2 && !audio.soundtrackTransitioning;
        }, null, { timeout: 3500 }).catch(() => {});
        const ph2 = await pg.evaluate(() => (window).__game.boss.phase);
        step.phase2 = ph2;
        if (ph2 !== 2) out.errors.push('phase 2 did not trigger (phase=' + ph2 + ')');
        const musicPh2 = await pg.evaluate(() => window.__game.audio.debugState());
        step.musicPhase2 = musicPh2;
        if (musicPh2.soundtrackPhase !== 2 || musicPh2.soundtrackTransitioning) {
          out.errors.push('phase 2 score did not complete its beat-aware crossfade: ' + JSON.stringify(musicPh2));
        }
        if (!phase2TransitionStarted || musicPh2.soundtrackDecksPaused[musicPh2.soundtrackPhase === 2 ? 1 : 0]) {
          out.errors.push('phase 2 score did not survive pause during its crossfade: ' + JSON.stringify(musicPh2));
        }
        // v2.14 (4): the arena visibly deteriorates as the sovereign burns.
        const decayPh2 = await pg.evaluate(() => (window).__game.phaseDecay ?? null);
        step.decayPh2 = decayPh2;
        if (decayPh2 === null || !(decayPh2 >= 1)) out.errors.push('v2.14 (4): phase-2 arena decay not applied (decay=' + decayPh2 + ')');
        await pg.waitForFunction(() => window.__game.weatherSnapshot().blend >= 0.99,
          null, { timeout: 3500 }).catch(() => {});
        const weatherPh2 = await pg.evaluate(() => window.__game.weatherSnapshot());
        step.weatherPhase2 = weatherPh2;
        if (weatherPh2.phase !== 2
          || weatherPh2.label !== 'Ember Gale'
          || weatherPh2.blend < 0.99
          || weatherPh2.moteCount !== 64
          || weatherPh2.backgroundMotes !== 48
          || weatherPh2.foregroundMotes !== 16
          || weatherPh2.windX <= 0
          || weatherPh2.streak < 5) {
          out.errors.push('v2.20: phase-2 fixed-pool Ember Gale contract failed: '
            + JSON.stringify(weatherPh2));
        }
        await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop-weather-phase2.png') });

        // The first incoming phase-3 play is rejected deliberately. The
        // controller must retain the phase request, retry the same permanent
        // deck, and complete without growing its retained node set.
        const phase3RetryProbe = await pg.evaluate(() => {
          const audio = window.__game.audio;
          const toIndex = audio.activeSoundtrackDeck === 0 ? 1 : 0;
          const deck = audio.soundtrackDecks[toIndex];
          const originalPlay = deck.element.play.bind(deck.element);
          let rejected = false;
          deck.element.play = () => {
            if (!rejected) {
              rejected = true;
              return Promise.reject(new DOMException('QA playback rejection', 'NotAllowedError'));
            }
            return originalPlay();
          };
          return { beforeNodes: audio.debugState().musicNodeCount, toIndex };
        });
        // phase 3
        await pg.evaluate(() => { const g = (window).__game; g.boss.takeDamage(g.boss.maxHp * 0.35, g, g.player.x, g.player.y); });
        await pg.waitForFunction(() => {
          const audio = window.__game.audio.debugState();
          return audio.soundtrackPhase === 3 && !audio.soundtrackTransitioning;
        }, null, { timeout: 4500 }).catch(() => {});
        const ph3 = await pg.evaluate(() => (window).__game.boss.phase);
        step.phase3 = ph3;
        if (ph3 !== 3) out.errors.push('phase 3 did not trigger (phase=' + ph3 + ')');
        const musicPh3 = await pg.evaluate(() => window.__game.audio.debugState());
        step.musicPhase3 = musicPh3;
        if (musicPh3.soundtrackPhase !== 3 || musicPh3.soundtrackTransitioning) {
          out.errors.push('phase 3 score did not complete its beat-aware crossfade: ' + JSON.stringify(musicPh3));
        }
        step.phase3Retry = { ...phase3RetryProbe, afterNodes: musicPh3.musicNodeCount,
          retryCount: musicPh3.soundtrackRetryCount };
        if (musicPh3.musicNodeCount !== phase3RetryProbe.beforeNodes
          || musicPh3.soundtrackDecksPaused[phase3RetryProbe.toIndex]) {
          out.errors.push('phase soundtrack retry leaked nodes or promoted a paused deck: '
            + JSON.stringify(step.phase3Retry));
        }
        // v2.14 (4): phase 3 deepens the decay further.
        const decayPh3 = await pg.evaluate(() => (window).__game.phaseDecay ?? null);
        step.decayPh3 = decayPh3;
        if (decayPh3 === null || !(decayPh3 > (step.decayPh2 ?? 0))) out.errors.push('v2.14 (4): phase-3 arena decay did not deepen (decay=' + decayPh3 + ')');
        await pg.waitForFunction(() => window.__game.weatherSnapshot().blend >= 0.99,
          null, { timeout: 3500 }).catch(() => {});
        const weatherPh3 = await pg.evaluate(() => {
          const g = window.__game;
          const normal = g.weatherSnapshot();
          const oldFlash = g.flashReduced;
          g.flashReduced = true;
          const reduced = g.weatherSnapshot();
          g.flashReduced = oldFlash;
          return { normal, reduced };
        });
        step.weatherPhase3 = weatherPh3;
        if (weatherPh3.normal.phase !== 3
          || weatherPh3.normal.label !== 'Gracefall Storm'
          || weatherPh3.normal.blend < 0.99
          || weatherPh3.normal.moteCount !== 64
          || weatherPh3.normal.windX >= 0
          || weatherPh3.normal.streak < 8
          || !weatherPh3.reduced.reducedMotion
          || weatherPh3.reduced.motionScale !== 0.45
          || weatherPh3.reduced.streak >= weatherPh3.normal.streak
          || Math.abs(weatherPh3.reduced.windX) >= Math.abs(weatherPh3.normal.windX)) {
          out.errors.push('v2.20: phase-3 Gracefall/reduced-motion contract failed: '
            + JSON.stringify(weatherPh3));
        }
        const weatherPerf = await pg.evaluate(() => {
          const g = window.__game;
          const saved = {
            from: g.weatherFromPhase,
            phase: g.weatherPhase,
            blend: g.weatherBlend,
          };
          const sample = (phase) => {
            g.weatherFromPhase = phase;
            g.weatherPhase = phase;
            g.weatherBlend = 1;
            for (let i = 0; i < 20; i++) g.render();
            const costs = [];
            for (let i = 0; i < 120; i++) {
              const started = performance.now();
              g.render();
              costs.push(performance.now() - started);
            }
            costs.sort((a, b) => a - b);
            return {
              median: costs[Math.floor(costs.length * 0.5)],
              p95: costs[Math.floor(costs.length * 0.95)],
            };
          };
          const phase1 = sample(1);
          const phase2 = sample(2);
          const phase3 = sample(3);
          g.weatherFromPhase = saved.from;
          g.weatherPhase = saved.phase;
          g.weatherBlend = saved.blend;
          g.render();
          return {
            phase1,
            phase2,
            phase3,
            phase3MedianDelta: phase3.median - phase1.median,
            phase3P95Delta: phase3.p95 - phase1.p95,
          };
        });
        step.weatherPerformance = weatherPerf;
        if (weatherPerf.phase3MedianDelta > 0.5 || weatherPerf.phase3P95Delta > 1) {
          out.errors.push('v2.20: Gracefall weather exceeded its relative render budget: '
            + JSON.stringify(weatherPerf));
        }
        // v2.15: phase 3 lifts the adaptive music through the existing buses.
        const audioLift = await pg.evaluate(() => { const s = window.__game.audio.debugState(); return s.phaseLift ?? null; });
        step.audioPhaseLift = audioLift;
        if (audioLift === null || !(audioLift >= 0.2)) out.errors.push('v2.15: phase-3 audio lift not applied (phaseLift=' + audioLift + ')');

        // let phase-3 combat run — spiral etc.
        await pg.waitForTimeout(3500);
        const alive = await pg.evaluate(() => { const g = (window).__game; return { st: g.state, projs: g.projectiles.length, parts: g.particles.length, scorch: !!g.scorchCanvas }; });
        step.phase3Run = alive;
        await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop-weather-phase3.png') });

        // v2.14 (2): stagger execution. The first heavy into a staggered
        // Malakar is a riposte that spikes damage exactly once, then reverts to
        // the normal staggered multiplier until poise is broken again.
        const exec = await pg.evaluate(() => {
          const g = window.__game;
          const b = g.boss, p = g.player;
          b.hp = b.maxHp * 0.85;
          b.state = 'staggered'; b.t = 2; b.executeConsumed = false;
          p.x = b.x - 50; p.y = b.y; p.facing = 0; p.comboStep = 0; p.state = 'move';
          const hp0 = b.hp;
          g.playerStrike(true);
          const dExec = hp0 - b.hp;
          const consumed = b.executeConsumed ?? null;
          b.state = 'staggered';
          const hp1 = b.hp;
          g.playerStrike(true);
          const dNormal = hp1 - b.hp;
          return { dExec, dNormal, consumed };
        });
        step.staggerExecute = exec;
        if (exec.consumed !== true || !(exec.dExec > 84) || !(exec.dExec > exec.dNormal * 1.8)) {
          out.errors.push('v2.14 (2): stagger execution did not spike exactly once: ' + JSON.stringify(exec));
        }

        // v2.15: hold-to-charge heavy. Holding HVY through the wind-up roots the
        // player and builds charge; a quick tap is the unchanged normal heavy.
        await pg.evaluate(() => {
          const g = window.__game, p = g.player;
          g.projectiles.length = 0; g.rings.length = 0; g.meteors.length = 0;
          p.state = 'move'; p.stam = 100; p.heavyChargeT = 0; p.iframes = 999; // isolate from interruption
        });
        await pg.keyboard.down('KeyK');
        const built = await pg.waitForFunction(() => window.__game.player.heavyChargeT >= 0.4, null, { timeout: 3000 }).then(() => true).catch(() => false);
        const chargeState = await pg.evaluate(() => ({ heavyChargeT: window.__game.player.heavyChargeT, heavyCharging: window.__game.player.heavyCharging }));
        await pg.keyboard.up('KeyK');
        step.holdCharge = { built, ...chargeState };
        if (!built || !(chargeState.heavyChargeT >= 0.4)) {
          out.errors.push('v2.15: holding heavy did not build charge: ' + JSON.stringify(step.holdCharge));
        }
        const chargeDmg = await pg.evaluate(() => {
          const g = window.__game, p = g.player, b = g.boss;
          b.x = 500; b.y = 400; b.hp = b.maxHp * 0.9; b.state = 'stalk'; b.executeConsumed = true;
          p.x = b.x - 50; p.y = b.y; p.facing = 0; p.comboStep = 0; p.state = 'move';
          p.charge01 = 0; const h0 = b.hp; g.playerStrike(true); const dNormal = h0 - b.hp;
          p.charge01 = 1; const h1 = b.hp; g.playerStrike(true); const dCharged = h1 - b.hp;
          return { dNormal, dCharged, hasApi: typeof g.heavyInputHeld === 'function' && typeof p.charge01 === 'number' };
        });
        step.chargeDmg = chargeDmg;
        if (!chargeDmg.hasApi || !(chargeDmg.dCharged > chargeDmg.dNormal * 1.4)) {
          out.errors.push('v2.15: charged heavy did not scale damage: ' + JSON.stringify(chargeDmg));
        }
        const touchHeld = await pg.evaluate(() => {
          const g = window.__game;
          const wasTouch = g.input.isTouch;
          g.input.held.heavy = false; g.input.isTouch = true;
          const hvy = g.touchLayout().btns.find((b) => b.id === 'heavy');
          const held = () => (typeof g.heavyInputHeld === 'function' ? g.heavyInputHeld() : null);
          g.input.touchPoints = [];
          const before = held();
          g.input.touchPoints = [{ id: 99, x: hvy.x, y: hvy.y }];
          const during = held();
          g.input.touchPoints = []; g.input.isTouch = wasTouch;
          return { before, during };
        });
        step.touchHeld = touchHeld;
        if (touchHeld.before !== false || touchHeld.during !== true) {
          out.errors.push('v2.15: touch heavy-held detection wrong: ' + JSON.stringify(touchHeld));
        }

        // Victory score must persist synchronously with boss death, before the
        // reveal or any follow-up input can replace the terminal state.
        const victoryImmediate = await pg.evaluate(() => {
          const g = window.__game;
          g.boss.takeDamage(99999, g, g.player.x, g.player.y);
          return {
            state: g.state,
            stateT: g.stateT,
            grade: g.grade,
            fightTime: g.fightTime,
            trial: g.graceAtStart,
            delay: g.constructor.VICTORY_INPUT_DELAY,
            saved: JSON.parse(localStorage.getItem('gracefell') || 'null'),
          };
        });
        step.victoryImmediate = victoryImmediate;
        const immediateScore = victoryImmediate.saved?.lastScore;
        const immediateBest = victoryImmediate.saved?.bestScores?.[String(victoryImmediate.trial)];
        const immediateHistory = victoryImmediate.saved?.scoreHistory?.[0];
        if (victoryImmediate.state !== 'victory' || victoryImmediate.stateT !== 0
          || victoryImmediate.saved?.v !== 7
          || immediateScore?.grade !== victoryImmediate.grade
          || Math.abs((immediateScore?.time ?? -1) - victoryImmediate.fightTime) > 0.000001
          || immediateScore?.trial !== victoryImmediate.trial
          || typeof immediateScore?.perfectDodges !== 'number'
          || typeof immediateScore?.flasksUsed !== 'number'
          || typeof immediateScore?.oathRank !== 'number'
          || immediateBest?.grade !== victoryImmediate.grade
          || immediateHistory?.grade !== victoryImmediate.grade
          || !Number.isFinite(Date.parse(immediateHistory?.completedAt || ''))
          || victoryImmediate.delay < 4.5) {
          out.errors.push('victory score was not saved immediately: ' + JSON.stringify(victoryImmediate));
        }
        await pg.waitForTimeout(2800);
        const vict = await pg.evaluate(() => { const g = (window).__game; return { st: g.state, grade: g.grade, best: g.bestTime, wins: g.wins }; });
        step.victory = vict;
        if (vict.st !== 'victory') out.errors.push('victory state not reached (' + vict.st + ')');
        if (!vict.grade) out.errors.push('no grade computed');

        // localStorage round-trip
        const saved = await pg.evaluate(() => JSON.parse(localStorage.getItem('gracefell') || 'null'));
        step.saved = saved;
        if (!saved || typeof saved.bestTime !== 'number' || saved.wins < 1 || !saved.lastScore || !saved.bestScores) {
          out.errors.push('save data did not round-trip: ' + JSON.stringify(saved));
        }

        // restart flow — headless RAF runs slow, so wait on sim stateT, not wall clock
        // An early confirmation is discarded rather than queued. The result
        // remains visible through the hold and only a fresh post-prompt input
        // can restart the fight.
        await pg.evaluate(() => {
          const g = window.__game;
          g.slowT = 0;
          g.timeScale = 1;
          g.stateT = g.constructor.VICTORY_INPUT_DELAY - 0.4;
          g.confirm();
        });
        await pg.waitForFunction(() => {
          const g = window.__game;
          return g.stateT > g.constructor.VICTORY_INPUT_DELAY + 0.1;
        }, null, { timeout: 5000 }).catch(() => {});
        const victoryHold = await pg.evaluate(() => {
          const g = window.__game;
          return { state: g.state, stateT: g.stateT, delay: g.constructor.VICTORY_INPUT_DELAY };
        });
        step.victoryHold = victoryHold;
        if (victoryHold.state !== 'victory' || victoryHold.stateT <= victoryHold.delay) {
          out.errors.push('early victory input skipped the score hold: ' + JSON.stringify(victoryHold));
        }
        await pg.screenshot({ path: path.join(ARTIFACT_DIR, `${vp.name}-victory.png`) });
        await pg.mouse.click(vp.w / 2, vp.h / 2);
        await pg.waitForFunction(() => ['intro', 'fight'].includes((window).__game.state), null, { timeout: 5000 }).catch(() => {});
        const st2 = await pg.evaluate(() => (window).__game.state);
        step.restart = st2;
        if (st2 !== 'intro' && st2 !== 'fight') out.errors.push('restart flow broken (' + st2 + ')');

        const beforeReturn = await pg.evaluate(() => ({
          state: window.__game.state,
          wins: window.__game.wins,
          attempts: window.__game.attempts,
          history: window.__game.scoreHistory.length,
        }));
        await pg.locator('.game-menu-toggle').click();
        await pg.getByRole('button', { name: 'RETURN TO MAIN MENU' }).click();
        await pg.waitForFunction(() => window.__game.state === 'title'
          && Boolean(document.querySelector('.game-scores-toggle')), null, { timeout: 1800 }).catch(() => {});
        const afterReturn = await pg.evaluate(() => ({
          state: window.__game.state,
          wins: window.__game.wins,
          attempts: window.__game.attempts,
          history: window.__game.scoreHistory.length,
          paused: window.__game.paused,
          scoreButton: document.querySelector('.game-scores-toggle')?.textContent?.trim(),
        }));
        await pg.locator('.game-scores-toggle').click();
        await pg.waitForFunction(() => Boolean(document.querySelector('#game-score-history')),
          null, { timeout: 1200 }).catch(() => {});
        const scoreDialog = await pg.evaluate(() => ({
          role: document.querySelector('#game-score-history')?.getAttribute('role'),
          rows: document.querySelectorAll('.game-score-history__list > li').length,
          dateTime: document.querySelector('.game-score-history time')?.getAttribute('datetime'),
          visibleDate: document.querySelector('.game-score-history time')?.textContent?.trim(),
          activeText: document.activeElement?.textContent?.trim(),
          canvasTabIndex: document.querySelector('canvas')?.tabIndex,
          summary: document.querySelector('.game-score-history__summary')?.textContent?.trim(),
        }));
        await pg.screenshot({ path: path.join(ARTIFACT_DIR, `${vp.name}-scores.png`) });
        await pg.keyboard.press('Escape');
        await pg.waitForFunction(() => !document.querySelector('#game-score-history'),
          null, { timeout: 1200 }).catch(() => {});
        const scoreDialogAfter = await pg.evaluate(() => ({
          activeIsScores: document.activeElement === document.querySelector('.game-scores-toggle'),
          canvasTabIndex: document.querySelector('canvas')?.tabIndex,
        }));
        step.returnAndScores = { before: beforeReturn, after: afterReturn, dialog: scoreDialog, closed: scoreDialogAfter };
        if (afterReturn.state !== 'title'
          || afterReturn.wins !== beforeReturn.wins
          || afterReturn.attempts !== beforeReturn.attempts
          || afterReturn.history !== beforeReturn.history
          || afterReturn.paused
          || afterReturn.scoreButton !== 'RECORDS'
          || scoreDialog.role !== 'dialog'
          || scoreDialog.rows < 1
          || !Number.isFinite(Date.parse(scoreDialog.dateTime || ''))
          || !scoreDialog.visibleDate
          || scoreDialog.activeText !== 'CLOSE'
          || scoreDialog.canvasTabIndex !== -1
          || !scoreDialog.summary?.includes('victory')
          || !scoreDialogAfter.activeIsScores
          || scoreDialogAfter.canvasTabIndex !== 0) {
          out.errors.push(vp.name + ': return-to-menu or score chronicle failed: '
            + JSON.stringify(step.returnAndScores));
        }

        // focus loss must freeze both simulation and audio, then resume cleanly
        const pauseBefore = await pg.evaluate(async () => {
          const g = window.__game;
          g.state = 'fight';
          g.fightTime = 10;
          window.dispatchEvent(new Event('blur'));
          await new Promise((resolve) => setTimeout(resolve, 80));
          return { paused: g.paused, fightTime: g.fightTime, audio: g.audio.debugState().contextState };
        });
        await pg.waitForTimeout(500);
        const pauseAfter = await pg.evaluate(() => ({
          paused: window.__game.paused,
          fightTime: window.__game.fightTime,
          audio: window.__game.audio.debugState().contextState,
        }));
        step.interruptionPause = { before: pauseBefore, after: pauseAfter };
        if (!pauseAfter.paused || Math.abs(pauseAfter.fightTime - pauseBefore.fightTime) > 0.01 || pauseAfter.audio !== 'suspended') {
          out.errors.push('focus loss did not pause cleanly: ' + JSON.stringify(step.interruptionPause));
        }
        await pg.evaluate(() => window.dispatchEvent(new Event('focus')));
        await pg.waitForFunction(() => !window.__game.paused, null, { timeout: 1500 }).catch(() => {});
        if (await pg.evaluate(() => window.__game.paused)) out.errors.push('focus return did not resume the game');

        // failure overlays must not inherit active phase-three hazards
        const deathCleanup = await pg.evaluate(() => {
          const g = window.__game;
          g.resetFight();
          g.state = 'fight';
          g.projectiles.push({ x: 0, y: 0, vx: 0, vy: 0, r: 10, dmg: 1, life: 1, hostile: true, hue: '#ff2d17' });
          g.rings.push({ x: 0, y: 0, r: 40, speed: 10, thickness: 10, dmg: 1, maxR: 500, hostile: true, hitDone: false });
          g.meteors.push({ x: 0, y: 0, fuse: 1, maxFuse: 1, r: 20, dmg: 1 });
          g.onPlayerDeath();
          return { state: g.state, projectiles: g.projectiles.length, rings: g.rings.length, meteors: g.meteors.length };
        });
        step.deathCleanup = deathCleanup;
        if (deathCleanup.state !== 'dead' || deathCleanup.projectiles || deathCleanup.rings || deathCleanup.meteors) {
          out.errors.push('death did not clear active hazards: ' + JSON.stringify(deathCleanup));
        }

        // Deterministic combat-system regressions. Pause RAF while stepping the
        // private simulation clock so refresh rate and browser load cannot hide
        // state-machine failures.
        const combatRegression = await pg.evaluate(() => {
          const g = window.__game;
          cancelAnimationFrame(g.raf); g.raf = 0; g.paused = true;
          const oldMuted = g.audio.muted; g.audio.muted = true;
          const result = {};
          try {
            // Victory owns a same-frame trade and prevents any late damage from
            // producing a dead player with a persisted win.
            g.resetFight(); g.state = 'fight';
            const winsBefore = g.wins;
            g.player.hp = 1; g.boss.hp = 0; g.boss.state = 'stalk';
            g.onBossDeath();
            g.player.takeDamage(99, g.boss.x, g.boss.y, g);
            result.terminalTrade = { state: g.state, playerState: g.player.state, playerHp: g.player.hp,
              bossHp: g.boss.hp, winsDelta: g.wins - winsBefore, projectiles: g.projectiles.length,
              rings: g.rings.length, meteors: g.meteors.length };

            // A natural impact-time follow-up must retain its full simulation
            // TTL while hit-stop freezes the attack recovery.
            g.resetFight(); g.state = 'fight'; g.input.reset();
            g.player.state = 'light'; g.player.t = 0.16; g.player.attackHit = true; g.player.stam = 100;
            g.hitstop = 0.12; g.input.bufferPress('light');
            for (let i = 0; i < 8; i++) g.frame(1 / 60);
            const bufferedAfterStop = g.input.hasBuffered('light');
            for (let i = 0; i < 13; i++) g.frame(1 / 60);
            result.hitstopBuffer = { bufferedAfterStop, state: g.player.state, stamina: g.player.stam };

            // Three rapid ATK presses must remain three distinct light attacks.
            // The generic one-slot TTL used to collapse the second and third
            // presses into one follow-up, while the finisher also reused HVY
            // swing/contact cues.
            g.resetFight(); g.state = 'fight'; g.input.reset();
            g.player.x = 0; g.player.y = 0; g.player.facing = 0; g.player.stam = 100;
            g.boss.x = 70; g.boss.y = 0; g.boss.hp = 9999; g.boss.maxHp = 9999;
            g.boss.state = 'recover'; g.boss.t = 99; g.boss.vx = 0; g.boss.vy = 0;
            const comboSteps = [];
            const comboCues = [];
            const comboFeedback = [];
            const originalPlayerStrike = g.playerStrike.bind(g);
            const originalSwing = g.audio.swing.bind(g.audio);
            const originalSwingHeavy = g.audio.swingHeavy.bind(g.audio);
            const originalHit = g.audio.hit.bind(g.audio);
            g.playerStrike = (heavy) => {
              comboSteps.push({ heavy, step: g.player.comboStep });
              originalPlayerStrike(heavy);
              comboFeedback.push({
                hits: g.playerChainHits,
                finished: g.playerChainFinished,
                visibleFor: g.playerChainT,
              });
            };
            g.audio.swing = (step) => comboCues.push(`swing-${step}`);
            g.audio.swingHeavy = () => comboCues.push('swing-heavy');
            g.audio.hit = (heavy, _spatial, variant) => comboCues.push(`hit-${heavy ? 'heavy' : 'light'}-${variant}`);
            for (let frame = 0; frame < 120; frame++) {
              if (frame === 0 || frame === 3 || frame === 6) g.input.bufferPress('light');
              g.frame(1 / 60);
            }
            result.rapidLightCombo = {
              steps: comboSteps,
              cues: comboCues,
              feedback: comboFeedback,
              queuedAtEnd: g.player.queuedLightAttacks,
              state: g.player.state,
            };
            g.playerStrike = originalPlayerStrike;
            g.audio.swing = originalSwing;
            g.audio.swingHeavy = originalSwingHeavy;
            g.audio.hit = originalHit;

            // Heavy remains committed, but a roll pressed on the contact frame
            // must execute as soon as its roughly 200 ms recovery completes.
            g.resetFight(); g.state = 'fight'; g.input.reset();
            g.player.state = 'heavy'; g.player.t = 0.20; g.player.attackHit = true; g.player.stam = 100;
            g.hitstop = 0.09; g.input.bufferPress('roll');
            for (let i = 0; i < 6; i++) g.frame(1 / 60);
            const heavyRollAfterStop = g.input.hasBuffered('roll');
            for (let i = 0; i < 15; i++) g.frame(1 / 60);
            result.heavyRollBuffer = { bufferedAfterStop: heavyRollAfterStop,
              state: g.player.state, stamina: g.player.stam };

            const runLunge = (hz) => {
              g.resetFight(); g.state = 'fight'; g.input.reset();
              g.player.x = 0; g.player.y = 0; g.player.facing = 0;
              g.boss.x = 500; g.boss.y = 0; g.boss.state = 'staggered'; g.boss.t = 9;
              g.input.bufferPress('light');
              let remaining = 0.32;
              while (remaining > 1e-7) {
                const dt = Math.min(1 / hz, remaining);
                g.player.update(dt, g.input, g); g.input.endFrame(dt); remaining -= dt;
              }
              return g.player.x;
            };
            const lunge = [30, 60, 120].map((hz) => ({ hz, x: runLunge(hz) }));
            result.lunge = { samples: lunge, spread: Math.max(...lunge.map((v) => v.x)) - Math.min(...lunge.map((v) => v.x)) };

            const runWindup = (hz) => {
              g.resetFight(); g.state = 'fight';
              const b = g.boss; b.state = 'windup'; b.attack = 'volley'; b.t = 0.6; b.x = 0; b.y = -220; b.vx = 200; b.vy = 0;
              let remaining = 0.3;
              while (remaining > 1e-7) { const dt = Math.min(1 / hz, remaining); b.update(dt, g); remaining -= dt; }
              return b.x;
            };
            const windup = [30, 60, 120].map((hz) => ({ hz, x: runWindup(hz) }));
            result.windup = { samples: windup, spread: Math.max(...windup.map((v) => v.x)) - Math.min(...windup.map((v) => v.x)) };

            const runMeteor = (phase) => {
              g.resetFight(); g.state = 'fight';
              const b = g.boss; b.phase = phase; b.state = 'strike'; b.attack = 'meteor'; b.t = 999;
              b.x = 0; b.y = -220; b.vx = 0; b.vy = 0;
              const count = phase === 3 ? 9 : 6;
              b.meteorQueue = Array.from({ length: count }, (_, i) => ({ x: i * 3, y: 0,
                fuse: i === 0 ? 0.25 : phase === 3 ? 0.27 : 0.34,
                maxFuse: i === 0 ? 0.25 : phase === 3 ? 0.27 : 0.34, r: 95, dmg: 20 }));
              let elapsed = 0;
              while (b.meteorQueue.length && elapsed < 4) { b.update(1 / 120, g); elapsed += 1 / 120; }
              return { elapsed, drift: Math.hypot(b.x, b.y + 220), spawned: g.meteors.length };
            };
            result.meteor2 = runMeteor(2);
            result.meteor3 = runMeteor(3);

            const heavyStep = (withHit) => {
              g.resetFight(); g.state = 'fight';
              const p = g.player, b = g.boss;
              p.x = -60; p.y = 0; p.facing = 0;
              b.x = 0; b.y = 0; b.facing = Math.PI; b.state = 'stalk'; b.t = 1;
              if (withHit) g.playerStrike(true);
              const impulseBefore = b.impulseVx;
              b.update(1 / 60, g);
              return { x: b.x, impulseBefore, impulseAfter: b.impulseVx };
            };
            const noHit = heavyStep(false), hit = heavyStep(true);
            result.heavyImpulse = { noHit, hit, displacementAdded: hit.x - noHit.x };

            // Generic post-hit i-frames are not a perfect dodge. Only the
            // dedicated early-roll window earns stamina/poise rewards.
            g.resetFight(); g.state = 'fight';
            g.player.state = 'roll'; g.player.t = 0.35; g.player.iframes = 0.3; g.player.rollIframes = 0;
            g.player.perfectCd = 0; g.player.stam = 10;
            const numsBefore = g.dmgNums.length, poiseBefore = g.boss.poise;
            g.player.takeDamage(10, g.player.x + 30, g.player.y, g);
            result.postHitIframe = { stamina: g.player.stam, newNumbers: g.dmgNums.length - numsBefore,
              poiseDelta: g.boss.poise - poiseBefore };

            // Phase presentation clears old hazards, leaves a baked scar, and
            // retains its authored push as an impulse.
            g.resetFight(); g.state = 'fight';
            g.projectiles.push({ x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 1, life: 1, hostile: true, hue: '#ff2d17' });
            g.rings.push({ x: 0, y: 0, r: 10, speed: 1, thickness: 5, dmg: 1, maxR: 100, hostile: true, hitDone: false });
            g.meteors.push({ x: 0, y: 0, fuse: 1, maxFuse: 1, r: 20, dmg: 1 });
            g.boss.state = 'stalk'; g.boss.t = 9; g.boss.hp = g.boss.maxHp * 0.5;
            g.boss.update(1 / 60, g);
            const alpha = g.scorchCtx.getImageData(0, 0, g.scorchCanvas.width, g.scorchCanvas.height).data;
            let scarSamples = 0; for (let i = 3; i < alpha.length; i += 64) if (alpha[i] > 0) scarSamples++;
            result.phaseTransition = { phase: g.boss.phase, projectiles: g.projectiles.length, rings: g.rings.length,
              meteors: g.meteors.length, playerImpulse: Math.hypot(g.player.impulseVx, g.player.impulseVy), scarSamples };
          } finally {
            g.audio.muted = oldMuted;
            g.paused = false; g.lastTs = performance.now(); g.startLoop();
          }
          return result;
        });
        step.combatRegression = combatRegression;
        const tr = combatRegression.terminalTrade;
        if (tr.state !== 'victory' || tr.playerState === 'dead' || tr.playerHp <= 0 || tr.bossHp !== 0 || tr.winsDelta !== 1
          || tr.projectiles || tr.rings || tr.meteors) out.errors.push('terminal trade arbitration failed: ' + JSON.stringify(tr));
        if (!combatRegression.hitstopBuffer.bufferedAfterStop || combatRegression.hitstopBuffer.state !== 'light') {
          out.errors.push('natural combo input expired during hit-stop: ' + JSON.stringify(combatRegression.hitstopBuffer));
        }
        const rapidSteps = combatRegression.rapidLightCombo.steps;
        if (rapidSteps.length !== 3
          || rapidSteps.some((hit, index) => hit.heavy || hit.step !== index)
          || combatRegression.rapidLightCombo.queuedAtEnd !== 0
          || combatRegression.rapidLightCombo.cues.some((cue) => cue.includes('heavy'))
          || !combatRegression.rapidLightCombo.cues.includes('swing-2')
          || !combatRegression.rapidLightCombo.cues.includes('hit-light-2')
          || combatRegression.rapidLightCombo.feedback.map((v) => v.hits).join(',') !== '1,2,3'
          || !combatRegression.rapidLightCombo.feedback[2]?.finished
          || combatRegression.rapidLightCombo.feedback.some((v) => v.visibleFor < 1)) {
          out.errors.push('rapid ATK did not produce a distinct three-hit light combo: '
            + JSON.stringify(combatRegression.rapidLightCombo));
        }
        if (!combatRegression.heavyRollBuffer.bufferedAfterStop || combatRegression.heavyRollBuffer.state !== 'roll'
          || combatRegression.heavyRollBuffer.stamina > 81) {
          out.errors.push('heavy-contact roll input expired before recovery: ' + JSON.stringify(combatRegression.heavyRollBuffer));
        }
        if (combatRegression.lunge.spread > 3) out.errors.push('player lunge is refresh-rate dependent: ' + JSON.stringify(combatRegression.lunge));
        if (combatRegression.windup.spread > 3) out.errors.push('boss windup damping is refresh-rate dependent: ' + JSON.stringify(combatRegression.windup));
        if (Math.abs(combatRegression.meteor2.elapsed - 1.95) > 0.05 || combatRegression.meteor2.spawned !== 6 || combatRegression.meteor2.drift > 1) {
          out.errors.push('phase-2 meteor cadence/drift regressed: ' + JSON.stringify(combatRegression.meteor2));
        }
        if (Math.abs(combatRegression.meteor3.elapsed - 2.41) > 0.05 || combatRegression.meteor3.spawned !== 9 || combatRegression.meteor3.drift > 1) {
          out.errors.push('phase-3 meteor cadence/drift regressed: ' + JSON.stringify(combatRegression.meteor3));
        }
        if (combatRegression.heavyImpulse.hit.impulseBefore < 50 || combatRegression.heavyImpulse.hit.impulseAfter <= 0
          || combatRegression.heavyImpulse.displacementAdded < 0.8) {
          out.errors.push('heavy knockback did not survive stalk locomotion: ' + JSON.stringify(combatRegression.heavyImpulse));
        }
        if (combatRegression.postHitIframe.stamina !== 10 || combatRegression.postHitIframe.newNumbers !== 0
          || combatRegression.postHitIframe.poiseDelta !== 0) {
          out.errors.push('generic post-hit iframe falsely triggered perfect dodge: ' + JSON.stringify(combatRegression.postHitIframe));
        }
        const ptr = combatRegression.phaseTransition;
        if (ptr.phase !== 2 || ptr.projectiles || ptr.rings || ptr.meteors || ptr.playerImpulse < 400 || ptr.scarSamples < 1) {
          out.errors.push('phase transition did not clear/move/scar cleanly: ' + JSON.stringify(ptr));
        }

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
          p.state = 'roll'; p.t = 0.35; p.iframes = 0.3; p.rollIframes = 0.3; p.perfectCd = 0; p.stam = 10;
          const before = g.dmgNums.length;
          const hpBefore = p.hp;
          p.takeDamage(10, p.x + 30, p.y, g);
          return { stam: p.stam, dmgNums: g.dmgNums.length - before, hpDelta: p.hp - hpBefore,
                   haptics: window.__hapticEvents.length };
        });
        step.perfectDodge = pd;
        if (pd.stam < 35 || pd.dmgNums < 1 || pd.hpDelta !== 0) out.errors.push('perfect dodge failed: ' + JSON.stringify(pd));
        if (pd.haptics < 1) out.errors.push('perfect dodge did not request haptic feedback');

        // ---- v2.10: every trial level is coherent, monotonic and immutable
        // Let React observe the fight state before reading semantic disabled
        // controls; an immediate game-state mutation plus DOM read is a race.
        await pg.evaluate(() => { window.__game.state = 'fight'; });
        await pg.waitForTimeout(300);
        const semanticTrialLocked = await pg.evaluate(() => [...document.querySelectorAll('.game-accessibility button')]
          .filter((button) => /Grace|Oath/i.test(button.textContent || ''))
          .every((button) => button.disabled));
        const acc = await pg.evaluate(() => {
          const g = window.__game;
          const out = { levels: [] };
          g.state = 'title';
          // grace clamps
          g.setGrace(-99); out.min = g.grace;
          g.setGrace(99); out.max = g.grace;
          for (let grace = -3; grace <= 5; grace++) {
            g.state = 'title';
            g.setGrace(grace);
            const preview = { ...g.difficultyForGrace(grace) };
            g.resetFight();
            out.levels.push({
              grace,
              speed: preview.bossSpeed,
              damage: preview.dmgTaken,
              iframe: preview.iframe,
              flasks: g.player.flasks,
              maxPoise: g.boss.maxPoise,
              staggerDuration: preview.staggerDuration,
              noStagger: preview.noStagger,
              clearTells: preview.clearTells,
              chainRank: preview.chainRank,
              recoveryMul: preview.recoveryMul,
              bossExtraSpeed: g.boss.extraSpeed,
              bossChainRank: g.boss.chainRank,
              bossRecoveryMul: g.boss.recoveryMul,
              summary: g.graceSummary(grace),
            });
          }
          // A run is authored once at the title. Neither the semantic controls
          // nor a stale/direct grace write may create a hybrid trial.
          g.state = 'title'; g.setGrace(5); g.resetFight(); g.state = 'fight';
          const graceBefore = g.grace;
          out.setDuringFight = g.setGrace(-3);
          out.graceAfterBlockedSet = g.grace;
          g.grace = -3;
          out.lockedMods = { ...g.mods };
          out.graceAtStart = g.graceAtStart;
          const hp = g.player.hp; g.player.iframes = 0;
          g.player.takeDamage(20, g.player.x + 40, g.player.y, g);
          out.lockedDamageLoss = hp - g.player.hp;
          out.semanticTrialLocked = [...document.querySelectorAll('.game-accessibility button')]
            .filter((button) => /Grace|Oath/i.test(button.textContent || ''))
            .every((button) => button.disabled);
          g.state = 'title'; g.setGrace(3); g.resetFight(); g.state = 'fight';
          g.boss.state = 'stalk'; g.boss.applyPoise(g.boss.maxPoise, g);
          out.ironStagger = { state: g.boss.state, duration: g.boss.t, maxPoise: g.boss.maxPoise };
          g.state = 'title'; g.setGrace(5); g.resetFight(); g.state = 'fight';
          g.boss.state = 'stalk'; g.boss.applyPoise(g.boss.maxPoise, g);
          out.forsakenPoise = { state: g.boss.state, poise: g.boss.poise, maxPoise: g.boss.maxPoise };
          // Records belong to the selected dial setting, not the global PB.
          g.state = 'title';
          g.bests = { '5': 120 };
          g.bestTime = 40;
          g.setGrace(5); out.bestAtFive = g.trialBest();
          g.setGrace(0); out.bestAtZero = g.trialBest();
          // toggles
          g.shakeEnabled = false; g.shakeAmp = 0; g.shake(20, 0.5);
          out.shakeOffWorks = g.shakeAmp === 0;
          g.shakeEnabled = true; g.shake(20, 0.5);
          out.shakeOnWorks = g.shakeAmp > 0;
          g.flashReduced = true; out.flashReducedScale = g.flashScale();
          g.flashReduced = false; out.flashFullScale = g.flashScale();
          return out;
        });
        acc.semanticTrialLocked = semanticTrialLocked;
        await pg.waitForTimeout(300);
        acc.semanticTrialUnlocked = await pg.evaluate(() => [...document.querySelectorAll('.game-accessibility button')]
          .filter((button) => /Grace|Oath/i.test(button.textContent || ''))
          .every((button) => !button.disabled));
        step.accessibility = acc;
        if (acc.min !== -3 || acc.max !== 5) out.errors.push('grace does not clamp to -3..5: ' + JSON.stringify([acc.min, acc.max]));
        const expectedFlasks = [4, 4, 3, 3, 3, 2, 2, 2, 1];
        const expectedPoise = [120, 120, 120, 120, 120, 120, 162, 204, 204];
        const expectedChains = [0, 0, 0, 0, 1, 1, 2, 2, 3];
        if (acc.levels.length !== 9) out.errors.push('difficulty audit did not cover all nine levels');
        acc.levels.forEach((level, i) => {
          if (level.flasks !== expectedFlasks[i]) out.errors.push(`grace ${level.grace}: expected ${expectedFlasks[i]} flasks, got ${level.flasks}`);
          if (level.maxPoise !== expectedPoise[i]) out.errors.push(`grace ${level.grace}: expected ${expectedPoise[i]} poise, got ${level.maxPoise}`);
          if (level.noStagger !== (level.grace === 5)) out.errors.push(`grace ${level.grace}: no-stagger should be exclusive to +5`);
          if (level.clearTells !== (level.grace <= -2)) out.errors.push(`grace ${level.grace}: clear tells should be exclusive to beginner Grace`);
          if (level.chainRank !== expectedChains[i] || level.bossChainRank !== expectedChains[i]) {
            out.errors.push(`grace ${level.grace}: Oath chain rank mismatch: ${JSON.stringify(level)}`);
          }
          if (Math.abs(level.recoveryMul - level.bossRecoveryMul) > 0.000001) {
            out.errors.push(`grace ${level.grace}: preview recovery differs from active boss recovery`);
          }
          if (typeof level.summary !== 'string' || level.summary.length < 16) {
            out.errors.push(`grace ${level.grace}: path summary missing`);
          }
          if (Math.abs(level.speed - level.bossExtraSpeed) > 0.000001) out.errors.push(`grace ${level.grace}: preview speed differs from active boss speed`);
          if (i > 0 && !(level.speed > acc.levels[i - 1].speed)) out.errors.push(`grace ${level.grace}: boss speed is not strictly increasing`);
          if (i > 0 && !(level.damage > acc.levels[i - 1].damage)) out.errors.push(`grace ${level.grace}: damage is not strictly increasing`);
          if (i > 0 && level.flasks > acc.levels[i - 1].flasks) out.errors.push(`grace ${level.grace}: flask count increases`);
        });
        if (acc.setDuringFight !== false || acc.graceAfterBlockedSet !== acc.graceAtStart
          || acc.graceAtStart !== 5 || !acc.lockedMods.noStagger || acc.lockedMods.flasks !== 1
          || acc.lockedDamageLoss !== 28) {
          out.errors.push('active trial snapshot/lock failed: ' + JSON.stringify(acc));
        }
        if (acc.ironStagger.state !== 'staggered' || Math.abs(acc.ironStagger.duration - 1.45) > 0.000001
          || acc.ironStagger.maxPoise !== 162) {
          out.errors.push('+3 IRON poise should be harder but breakable: ' + JSON.stringify(acc.ironStagger));
        }
        if (acc.forsakenPoise.state === 'staggered' || acc.forsakenPoise.poise !== acc.forsakenPoise.maxPoise) {
          out.errors.push('+5 FORSAKEN poise should reset without staggering: ' + JSON.stringify(acc.forsakenPoise));
        }
        if (!acc.semanticTrialLocked || !acc.semanticTrialUnlocked) out.errors.push('semantic trial controls do not reflect the fight lock');
        if (acc.bestAtFive !== 120 || acc.bestAtZero !== 40) out.errors.push('selected-trial record lookup is wrong: ' + JSON.stringify([acc.bestAtFive, acc.bestAtZero]));
        if (!acc.shakeOffWorks || !acc.shakeOnWorks) out.errors.push('screen shake toggle broken');
        if (!(acc.flashReducedScale < acc.flashFullScale)) out.errors.push('flash reduction not applied');

        // Expert Oaths add readable authored packets instead of simply
        // shrinking every opening. Journey keeps the original one-attack turn.
        const oathPackets = await pg.evaluate(() => {
          const g = window.__game;
          const originalRandom = Math.random;
          const originalMuted = g.audio.muted;
          cancelAnimationFrame(g.raf); g.raf = 0; g.paused = true;
          g.audio.muted = true;
          try {
            const allAttacks = ['swipe', 'slam', 'charge', 'volley', 'meteor', 'ring', 'spiral'];
            const forceVolley = (grace) => {
              g.state = 'title'; g.setGrace(grace); g.resetFight(); g.state = 'fight';
              const b = g.boss;
              b.phase = 3; b.state = 'stalk'; b.t = 0;
              for (const attack of allAttacks) b.cooldowns[attack] = 999;
              b.cooldowns.volley = 0;
              Math.random = () => 0;
              b.chooseAttack(g, 240);
              return b;
            };

            const b = forceVolley(5);
            const first = {
              attack: b.attack, step: b.chainStep, total: b.chainTotal,
              queue: [...b.chainQueue], rank: b.chainRank, recovery: b.recoveryMul,
            };
            b.state = 'stalk'; b.cooldowns.charge = 0;
            b.chooseAttack(g, 240);
            const second = { attack: b.attack, step: b.chainStep, total: b.chainTotal, queue: [...b.chainQueue] };
            b.state = 'stalk'; b.cooldowns.swipe = 0;
            b.chooseAttack(g, 100);
            const third = { attack: b.attack, step: b.chainStep, total: b.chainTotal, queue: [...b.chainQueue] };

            const measuredBoss = forceVolley(0);
            const measured = {
              attack: measuredBoss.attack, total: measuredBoss.chainTotal,
              queue: [...measuredBoss.chainQueue], rank: measuredBoss.chainRank,
              recovery: measuredBoss.recoveryMul,
            };
            g.state = 'title'; g.setGrace(-2); g.resetFight();
            const journey = { rank: g.boss.chainRank, recovery: g.boss.recoveryMul };
            return { first, second, third, measured, journey };
          } finally {
            Math.random = originalRandom;
            g.audio.muted = originalMuted;
            g.paused = false;
            g.lastTs = performance.now();
            g.startLoop();
          }
        });
        step.oathPackets = oathPackets;
        if (oathPackets.first.attack !== 'volley'
          || oathPackets.first.step !== 1
          || oathPackets.first.total !== 3
          || oathPackets.first.queue.join(',') !== 'charge,swipe'
          || oathPackets.second.attack !== 'charge'
          || oathPackets.second.step !== 2
          || oathPackets.third.attack !== 'swipe'
          || oathPackets.third.step !== 3
          || oathPackets.third.queue.length !== 0
          || oathPackets.measured.total !== 1
          || oathPackets.measured.queue.length !== 0
          || oathPackets.measured.rank !== 0
          || oathPackets.first.recovery >= oathPackets.measured.recovery
          || oathPackets.journey.recovery <= oathPackets.measured.recovery) {
          out.errors.push('authored Oath/Journey pacing packet is incoherent: ' + JSON.stringify(oathPackets));
        }

        // The contextual rite teaches one interaction at a time and persists
        // completion only after the player punishes a real stagger.
        const teaching = await pg.evaluate(() => {
          const g = window.__game;
          const originalMuted = g.audio.muted;
          cancelAnimationFrame(g.raf); g.raf = 0; g.paused = true;
          g.audio.muted = true;
          try {
            g.state = 'title'; g.setGrace(-2); g.tutorialStage = 'move'; g.resetFight(); g.state = 'fight';
            const start = { stage: g.tutorialStage, message: g.tutorialMessage() };
            g.input.held.right = true;
            g.frame(1 / 60);
            g.input.held.right = false;
            const moved = { stage: g.tutorialStage, message: g.tutorialMessage() };
            g.player.state = 'roll'; g.player.t = 0.35; g.player.iframes = 0.3;
            g.player.rollIframes = 0.3; g.player.perfectCd = 0;
            g.onPerfectDodge();
            const dodged = { stage: g.tutorialStage, message: g.tutorialMessage(), count: g.perfectDodges };
            g.boss.state = 'stalk'; g.boss.applyPoise(g.boss.maxPoise, g);
            const staggered = { stage: g.tutorialStage, message: g.tutorialMessage(), boss: g.boss.state };
            g.player.x = 0; g.player.y = 0; g.player.facing = 0; g.player.comboStep = 0;
            g.boss.x = 60; g.boss.y = 0; g.boss.hp = Math.max(g.boss.hp, 100);
            g.playerStrike(false);
            const completed = {
              stage: g.tutorialStage,
              saved: JSON.parse(localStorage.getItem('gracefell') || 'null')?.tutorialComplete,
            };
            return { start, moved, dodged, staggered, completed };
          } finally {
            g.input.held.right = false;
            g.audio.muted = originalMuted;
            g.paused = false;
            g.lastTs = performance.now();
            g.startLoop();
          }
        });
        step.teaching = teaching;
        if (teaching.start.stage !== 'move'
          || teaching.moved.stage !== 'roll'
          || teaching.dodged.stage !== 'poise'
          || teaching.dodged.count < 1
          || teaching.staggered.stage !== 'stagger'
          || teaching.staggered.boss !== 'staggered'
          || teaching.completed.stage !== 'done'
          || teaching.completed.saved !== true) {
          out.errors.push('contextual combat rite did not progress or persist: ' + JSON.stringify(teaching));
        }

        // hazard-hue discipline: ambient particles must never use PAL.danger
        const hue = await pg.evaluate(async () => {
          const g = window.__game;
          g.state = 'title';
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

        // Blade-Saint production contract: the halo is a diegetic volley
        // counter, reforges at the authored cadence, and the phase-three
        // shadow sword draws without changing the boss hit circle.
        const bladeSaint = await pg.evaluate(() => {
          const g = window.__game;
          g.state = 'title';
          g.setGrace(0);
          g.resetFight();
          g.state = 'fight';
          const b = g.boss;
          b.phase = 2;
          b.state = 'strike';
          b.attack = 'volley';
          b.t = 0;
          b.haloSpent = 0;
          b.haloReforgeT = 0;
          const projectilesBefore = g.projectiles.length;
          b.update(0.016, g);
          const spentAfterVolley = b.haloSpent;
          const projectilesDelta = g.projectiles.length - projectilesBefore;
          b.state = 'recover';
          b.t = 99;
          b.vx = 0;
          b.vy = 0;
          b.update(0.79, g);
          const spentBeforeReforge = b.haloSpent;
          b.update(0.02, g);
          const spentAfterReforge = b.haloSpent;
          b.phase = 3;
          b.secondSwordDraw = 0;
          b.update(0.2, g);
          const swordAt200ms = b.secondSwordDraw;
          b.update(0.2, g);
          return {
            spentAfterVolley,
            projectilesDelta,
            spentBeforeReforge,
            spentAfterReforge,
            swordAt200ms,
            swordAt400ms: b.secondSwordDraw,
            hitRadius: b.r,
          };
        });
        step.bladeSaint = bladeSaint;
        if (bladeSaint.spentAfterVolley !== 7 || bladeSaint.projectilesDelta !== 7) {
          out.errors.push('Blade-Saint phase-two volley did not consume seven halo blades: ' + JSON.stringify(bladeSaint));
        }
        if (bladeSaint.spentBeforeReforge !== 7 || bladeSaint.spentAfterReforge !== 6) {
          out.errors.push('Blade-Saint halo did not reforge one blade at 0.8 s: ' + JSON.stringify(bladeSaint));
        }
        if (Math.abs(bladeSaint.swordAt200ms - 0.5) > 0.000001 || bladeSaint.swordAt400ms !== 1) {
          out.errors.push('Blade-Saint shadow sword did not complete its 0.4 s draw: ' + JSON.stringify(bladeSaint));
        }
        if (bladeSaint.hitRadius !== 34) out.errors.push('Blade-Saint visual pass changed the boss hit radius');

        // save schema v6 round-trip incl. independent mix, settings, scorecards,
        // dated history and teaching state
        const sv6 = await pg.evaluate(() => {
          const g = window.__game;
          g.state = 'title';
          g.setMusicVolume(0.65); g.setSfxVolume(0.95);
          g.setGrace(2); g.shakeEnabled = false; g.flashReduced = true; g.persist();
          return JSON.parse(localStorage.getItem('gracefell'));
        });
        step.saveV6 = sv6;
        if (sv6.v !== 7 || sv6.grace !== 2 || sv6.shakeEnabled !== false || sv6.flashReduced !== true
          || sv6.musicVolume !== 0.65 || sv6.sfxVolume !== 0.95
          || !sv6.bests || !sv6.lastScore || !sv6.bestScores
          || !Array.isArray(sv6.scoreHistory) || sv6.scoreHistory.length < 1
          || sv6.scoreHistory.length > 20
          || !Number.isFinite(Date.parse(sv6.scoreHistory[0].completedAt || ''))
          || typeof sv6.tutorialComplete !== 'boolean') {
          out.errors.push('save v6 did not round-trip mix, settings, teaching state and score history: ' + JSON.stringify(sv6));
        }
        const scoreReload = await pg.evaluate(() => {
          const live = window.__game;
          const G = live.constructor;
          const c = document.createElement('canvas');
          const g2 = new G(c);
          const r = {
            lastScore: g2.lastScore,
            bestScore: g2.lastScore ? g2.bestScores[String(g2.lastScore.trial)] : null,
            scoreHistory: g2.scoreHistory,
          };
          g2.destroy();
          window.__game = live;
          return r;
        });
        step.scoreReload = scoreReload;
        if (!scoreReload.lastScore || !scoreReload.bestScore || scoreReload.scoreHistory.length < 1
          || scoreReload.lastScore.grade !== sv6.lastScore.grade
          || scoreReload.bestScore.grade !== sv6.lastScore.grade
          || scoreReload.scoreHistory[0].completedAt !== sv6.scoreHistory[0].completedAt) {
          out.errors.push('saved victory score did not reload: ' + JSON.stringify(scoreReload));
        }

        const v5ScoreMigration = await pg.evaluate(() => {
          const live = window.__game;
          const previousSave = localStorage.getItem('gracefell');
          localStorage.setItem('gracefell', JSON.stringify({
            v: 5,
            lastScore: live.lastScore,
            bestScores: live.bestScores,
            wins: live.wins,
            attempts: live.attempts,
          }));
          const G = live.constructor;
          const c = document.createElement('canvas');
          const migrated = new G(c);
          const result = {
            historyLength: migrated.scoreHistory.length,
            completedAt: migrated.scoreHistory[0]?.completedAt,
            grade: migrated.scoreHistory[0]?.grade,
          };
          migrated.destroy();
          if (previousSave) localStorage.setItem('gracefell', previousSave);
          window.__game = live;
          return result;
        });
        step.v5ScoreMigration = v5ScoreMigration;
        if (v5ScoreMigration.historyLength !== 1
          || v5ScoreMigration.completedAt !== null
          || v5ScoreMigration.grade !== sv6.lastScore.grade) {
          out.errors.push('v5 last score did not migrate honestly into v6 history: '
            + JSON.stringify(v5ScoreMigration));
        }

        const historyCap = await pg.evaluate(() => {
          const live = window.__game;
          const previousSave = localStorage.getItem('gracefell');
          const save = JSON.parse(previousSave);
          const base = save.lastScore;
          save.scoreHistory = Array.from({ length: 25 }, (_, index) => ({
            ...base,
            attempt: index + 1,
            completedAt: new Date(Date.UTC(2026, 6, 24, 0, index)).toISOString(),
          }));
          localStorage.setItem('gracefell', JSON.stringify(save));
          const G = live.constructor;
          const c = document.createElement('canvas');
          const capped = new G(c);
          const result = {
            length: capped.scoreHistory.length,
            firstAttempt: capped.scoreHistory[0]?.attempt,
            lastAttempt: capped.scoreHistory[capped.scoreHistory.length - 1]?.attempt,
          };
          capped.destroy();
          localStorage.setItem('gracefell', previousSave);
          window.__game = live;
          return result;
        });
        step.historyCap = historyCap;
        if (historyCap.length !== 20 || historyCap.firstAttempt !== 1 || historyCap.lastAttempt !== 20) {
          out.errors.push('v6 score history did not retain exactly the newest 20 valid entries: '
            + JSON.stringify(historyCap));
        }

        // v1 save migrates forward
        const mig = await pg.evaluate(async () => {
          localStorage.setItem('gracefell', JSON.stringify({ bestTime: 42, wins: 3, attempts: 7, muted: false }));
          const live = window.__game;           // constructing a Game hijacks the
          const G = live.constructor;            // window.__game debug hook, and
          const c = document.createElement('canvas');
          const g2 = new G(c);                   // destroy() does not put it back —
          const r = {
            best: g2.bestTime,
            wins: g2.wins,
            bestsZero: g2.bests['0'],
            grace: g2.grace,
            musicVolume: g2.audio.musicVolume,
            sfxVolume: g2.audio.sfxVolume,
          };
          g2.destroy();
          window.__game = live;                  // so restore it, or every later
          return r;                              // assertion reads a dead instance.
        });
        step.migration = mig;
        if (mig.best !== 42 || mig.wins !== 3 || mig.bestsZero !== 42 || mig.grace !== 0
          || mig.musicVolume !== 0.85 || mig.sfxVolume !== 1) {
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
        await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop.png') });
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
        await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile.png') });
      }

      // ---- menu layout must fit its own plate + the viewport, every viewport
      const lay = await pg.evaluate(() => {
        const g = window.__game;
        g.state = 'title';
        g.setGrace(5);
        const gm = g.menuGeom();
        const rows = g.menuRows();
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const originalFillText = ctx.fillText;
        let valueLeft = Number.POSITIVE_INFINITY;
        let trialLabelRight = 0;
        let titleWidth = 0;
        ctx.fillText = function (text, x, y, maxWidth) {
          if (String(text) === 'FORSAKEN · OATH V' || String(text) === 'FORSAKEN') {
            const width = this.measureText(String(text)).width;
            valueLeft = this.textAlign === 'right' ? x - width : x;
          }
          if (String(text) === 'GRACEFELL') {
            titleWidth = this.measureText(String(text)).width;
          }
          if (String(text) === 'CHOOSE DIFFICULTY' || String(text) === 'DIFFICULTY') {
            trialLabelRight = x + this.measureText(String(text)).width;
          }
          return maxWidth === undefined
            ? originalFillText.call(this, text, x, y)
            : originalFillText.call(this, text, x, y, maxWidth);
        };
        g.render();
        ctx.fillText = originalFillText;
        return {
          w: g.w, h: g.h,
          plateL: gm.plateL, plateR: gm.plateR,
          chevLx: gm.chevLx, chevRx: gm.chevRx,
          valueRx: gm.valueRx, labelLx: gm.labelLx,
          pipMin: gm.pipX(-3), pipMax: gm.pipX(5),
          valueLeft, trialLabelRight, titleWidth,
          titleMaxWidth: g.w - (g.w < 520 ? 28 : 64),
          uiScale: gm.uiScale,
          decZone: gm.decZone, incZone: gm.incZone,
          lastRowY: rows[rows.length - 1].y,
          firstRowY: rows[0].y,
          title: g.titleTextLayout(),
        };
      });
      step.menuLayout = lay;
      const L = [];
      if (lay.chevLx < lay.plateL + 8) L.push('left chevron outside plate');
      if (lay.chevRx > lay.plateR - 8) L.push('right chevron outside plate');
      if (lay.labelLx < lay.plateL + 8) L.push('label outside plate');
      if (lay.valueRx > lay.chevRx - 12) L.push('value text collides with right chevron');
      if (lay.pipMin < lay.plateL + 8 || lay.pipMax > lay.plateR - 8) L.push('grace pips outside plate');
      if (lay.trialLabelRight > lay.pipMin - 6) L.push('difficulty label collides with grace pips');
      if (lay.pipMax > lay.valueLeft - 6) L.push('grace pips collide with FORSAKEN Oath V text');
      if (lay.plateL < 4 || lay.plateR > lay.w - 4) L.push('menu plate wider than viewport');
      if (lay.titleWidth > lay.titleMaxWidth + 1) L.push('title wordmark wider than viewport');
      if (lay.lastRowY + 40 > lay.h) L.push('menu overflows bottom of screen');
      if (lay.firstRowY < lay.h * 0.5) L.push('menu overlaps the title block');
      if (!(lay.decZone < lay.incZone)) L.push('grace hit zones inverted');
      if (lay.title.titleY + 64 > lay.title.statsY - 18) L.push('title divider collides with saved-result summary');
      if (lay.title.statsY > lay.title.promptY - 18) L.push('saved-result summary collides with prompt');
      if (lay.title.promptY > lay.title.controlsY - 18) L.push('prompt collides with controls');
      if (Math.abs(lay.title.controlsY - lay.title.controlsAltY) > 1) {
        L.push('single-line controls split unexpectedly');
      }
      const lastControlsY = Math.max(lay.title.controlsY, lay.title.controlsAltY);
      if (lastControlsY > lay.title.summaryY - 18) L.push('controls collide with trial summary');
      if (lay.title.summaryY > lay.title.menuTop - 8) L.push('trial summary collides with settings plate');
      if (L.length) out.errors.push(vp.name + ' menu layout: ' + L.join('; '));

      step.consoleErrors = consoleErrs;
      if (consoleErrs.length) out.errors.push(vp.name + ' console: ' + consoleErrs.join(' | '));
      out.steps[vp.name] = step;
      await ctxB.close();
    }
    // A wide desktop should not strand a phone-sized settings plate beneath
    // the cinematic wordmark. This is a focused title-only lane so the full
    // combat suite does not have to run a third time.
    {
      const wideCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      await installAudioSampleRate(wideCtx);
      const pg = await wideCtx.newPage();
      await pg.goto(URL, { waitUntil: 'load' });
      await pg.waitForTimeout(900);
      const wide = await pg.evaluate(() => {
        const g = window.__game;
        g.state = 'title';
        g.grace = -2;
        g.wins = 2;
        g.bestTime = 82;
        g.bests['-2'] = 82;
        const gm = g.menuGeom();
        const rows = g.menuRows();
        const layout = g.titleTextLayout();
        g.render();
        return {
          uiScale: gm.uiScale,
          plateWidth: gm.plateR - gm.plateL,
          rowH: gm.rowH,
          firstRowY: rows[0].y,
          lastRowY: rows[rows.length - 1].y,
          ...layout,
        };
      });
      out.steps.desktopWideMenu = wide;
      if (wide.uiScale < 1.19
        || wide.plateWidth < 700
        || wide.rowH < 38
        || wide.lastRowY + 40 > 1080
        || wide.statsY > wide.promptY - 18
        || wide.promptY > wide.controlsY - 18
        || wide.controlsY > wide.summaryY - 18
        || wide.summaryY > wide.menuTop - 8) {
        out.errors.push('desktop-wide: title hierarchy did not scale as one system: ' + JSON.stringify(wide));
      }
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop-wide-title.png') });
      await wideCtx.close();
    }
    // ================= TOUCH DEVICE PASS =================
    // The touch path had never been driven by a test — only rendered. This
    // emulates a real phone (hasTouch + isMobile) and plays with thumbs only.
    {
      const tctx = await browser.newContext({
        viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3,
      });
      await installAudioSampleRate(tctx);
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
      t.combatTipsCopy = (await pg.locator('.game-accessibility__tips').textContent())?.trim() || '';
      if (!t.combatTipsCopy.includes('tap Break') || t.combatTipsCopy.includes('hold Heavy')) {
        out.errors.push('touch: Combat tips do not match the tap-driven BREAK action: ' + t.combatTipsCopy);
      }

      // 2. touch-appropriate copy, no keyboard bindings shown
      t.rows = await pg.evaluate(() => window.__game.menuRows().map((r) => r.id));
      if (!t.rows.includes('haptics')) out.errors.push('touch: haptics row missing from menu');
      t.titleLayout = await pg.evaluate(() => {
        const g = window.__game;
        const layout = g.titleTextLayout();
        const rows = g.menuRows();
        return {
          ...layout,
          helpY: rows[rows.length - 1].y + 30,
          bottomY: g.h - 16,
        };
      });
      if (t.titleLayout.titleY + 64 > t.titleLayout.statsY - 18) {
        out.errors.push('touch: title divider overlaps saved-result summary: ' + JSON.stringify(t.titleLayout));
      }
      if (t.titleLayout.statsY > t.titleLayout.promptY - 18
        || t.titleLayout.promptY > t.titleLayout.controlsY - 18
        || t.titleLayout.controlsY > t.titleLayout.summaryY - 18
        || t.titleLayout.summaryY > t.titleLayout.menuTop - 8) {
        out.errors.push('touch: title copy overlaps the settings menu: ' + JSON.stringify(t.titleLayout));
      }
      if (t.titleLayout.helpY > t.titleLayout.bottomY) {
        out.errors.push('touch: control legend overflows the title viewport: ' + JSON.stringify(t.titleLayout));
      }
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-title.png') });
      t.forsakenTitle = await pg.evaluate(() => {
        const g = window.__game;
        g.state = 'title'; g.setGrace(5); g.render();
        const gm = g.menuGeom();
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const originalFillText = ctx.fillText;
        let labelLeft = Number.POSITIVE_INFINITY;
        ctx.fillText = function (text, x, y, maxWidth) {
          if (String(text) === 'FORSAKEN') labelLeft = x - this.measureText(String(text)).width;
          return maxWidth === undefined
            ? originalFillText.call(this, text, x, y)
            : originalFillText.call(this, text, x, y, maxWidth);
        };
        g.render();
        ctx.fillText = originalFillText;
        return { pipMax: gm.pipX(5), labelLeft, gap: labelLeft - gm.pipX(5) };
      });
      if (t.forsakenTitle.gap < 6) out.errors.push('touch: FORSAKEN Oath V overlaps the grace pips: ' + JSON.stringify(t.forsakenTitle));
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-forsaken-title.png') });

      // 3. controls layout: inside screen, clear of the joystick half and the safe area
      t.layout = await pg.evaluate(() => {
        const g = window.__game; const L = g.touchLayout();
        return { base: L.base, joyZoneR: L.joyZoneR, w: g.w, h: g.h, floorCacheWidth: g.floorCanvas?.width || 0,
                 btns: L.btns.map((b) => ({ id: b.id, x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.r) })) };
      });
      if (t.layout.floorCacheWidth > 1800) out.errors.push(`touch: floor cache is oversized (${t.layout.floorCacheWidth}px)`);
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
      t.openingGuidance = await pg.evaluate(() => {
        const g = window.__game;
        return {
          bossState: g.boss.state,
          bossT: g.boss.t,
          tutorialStage: g.tutorialStage,
          tutorialT: g.tutorialT,
          grace: g.graceAtStart,
        };
      });
      if (t.openingGuidance.grace < 0
        && t.openingGuidance.tutorialStage === 'move'
        && (t.openingGuidance.bossState !== 'stalk'
          || t.openingGuidance.bossT < 3
          || t.openingGuidance.tutorialT < 4.3)) {
        out.errors.push('touch: first-run Journey lost its playable opening guidance: '
          + JSON.stringify(t.openingGuidance));
      }
      t.moveGuidePersistence = await pg.evaluate(() => {
        const g = window.__game;
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const originalFillText = ctx.fillText;
        const original = {
          stage: g.tutorialStage,
          tutorialT: g.tutorialT,
          hintT: g.hintT,
        };
        let moveLabels = 0;
        ctx.fillText = function (text, x, y, maxWidth) {
          if (String(text) === 'MOVE') moveLabels++;
          return maxWidth === undefined
            ? originalFillText.call(this, text, x, y)
            : originalFillText.call(this, text, x, y, maxWidth);
        };
        g.tutorialStage = 'move';
        g.tutorialT = 0;
        g.hintT = 0;
        g.render();
        const afterPromptExpiry = moveLabels;
        moveLabels = 0;
        g.tutorialStage = 'roll';
        g.render();
        const afterMovementLearned = moveLabels;
        ctx.fillText = originalFillText;
        g.tutorialStage = original.stage;
        g.tutorialT = original.tutorialT;
        g.hintT = original.hintT;
        g.render();
        return { afterPromptExpiry, afterMovementLearned };
      });
      if (t.moveGuidePersistence.afterPromptExpiry < 1
        || t.moveGuidePersistence.afterMovementLearned !== 0) {
        out.errors.push('touch: MOVE guide does not persist exactly until movement is learned: '
          + JSON.stringify(t.moveGuidePersistence));
      }

      // The player-resource HUD is Canvas content while the utilities mix DOM
      // and Canvas targets. Protect the actual cross-layer geometry so a valid
      // fingertip button cannot obscure HP, stamina, or flasks on a phone.
      await pg.waitForSelector('.game-mix-toggle', { timeout: 1200 }).catch(() => {});
      t.combatUtilityLayout = await pg.evaluate(() => {
        const g = window.__game;
        const hud = g.playerHudRect();
        const domRect = (selector) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect
            ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            : null;
        };
        const utilities = {
          menu: domRect('.game-menu-toggle'),
          mix: domRect('.game-mix-toggle'),
          pause: domRect('.game-pause-toggle'),
          sound: g.soundButtonRect(),
        };
        return { w: g.w, h: g.h, hud, utilities };
      });
      const rectsOverlap = (a, b) => Boolean(a && b
        && a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y);
      const utilityEntries = Object.entries(t.combatUtilityLayout.utilities);
      for (const [id, rect] of utilityEntries) {
        if (!rect
          || rect.width < 44
          || rect.height < 44
          || rect.x < 0
          || rect.y < 0
          || rect.x + rect.width > t.combatUtilityLayout.w
          || rect.y + rect.height > t.combatUtilityLayout.h) {
          out.errors.push(`touch: ${id} utility is not a valid on-screen fingertip target: ${JSON.stringify(rect)}`);
        } else if (rectsOverlap(rect, t.combatUtilityLayout.hud)) {
          out.errors.push(`touch: ${id} utility obscures the player HUD: `
            + JSON.stringify({ utility: rect, hud: t.combatUtilityLayout.hud }));
        }
      }
      for (let i = 0; i < utilityEntries.length; i++) {
        for (let j = i + 1; j < utilityEntries.length; j++) {
          const [aId, a] = utilityEntries[i];
          const [bId, b] = utilityEntries[j];
          if (rectsOverlap(a, b)) out.errors.push(`touch: ${aId} and ${bId} utilities overlap`);
        }
      }
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-hud-utilities.png') });

      // 5. the persistent pause control must work through a real phone tap,
      // stop simulation/audio, and resume without replaying paused input.
      const touchPause = pg.locator('.game-pause-toggle');
      const touchPauseBox = await touchPause.boundingBox();
      const touchPauseBefore = await pg.evaluate(() => ({
        fightTime: window.__game.fightTime,
        playerState: window.__game.player.state,
      }));
      await touchPause.tap();
      await pg.waitForFunction(() => window.__game.manualPaused && window.__game.paused, null, { timeout: 1000 }).catch(() => {});
      await pg.waitForFunction(() => window.__game.audio.debugState().contextState === 'suspended', null, { timeout: 1500 }).catch(() => {});
      const touchPausedAt = await pg.evaluate(() => ({
        fightTime: window.__game.fightTime,
        playerState: window.__game.player.state,
      }));
      await pg.waitForTimeout(280);
      const touchPauseDuring = await pg.evaluate(() => ({
        paused: window.__game.paused,
        manualPaused: window.__game.manualPaused,
        fightTime: window.__game.fightTime,
        playerState: window.__game.player.state,
        rafRunning: window.__game.raf !== 0,
        audioState: window.__game.audio.debugState().contextState,
        status: window.__game.uiSnapshot().status,
        label: document.querySelector('.game-pause-toggle')?.textContent?.trim(),
        activeIsCanvas: document.activeElement === document.querySelector('canvas'),
      }));
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-paused.png') });
      await pg.getByRole('button', { name: 'RESUME' }).tap();
      await pg.waitForFunction(() => !window.__game.manualPaused && !window.__game.paused, null, { timeout: 1500 }).catch(() => {});
      await pg.waitForTimeout(80);
      const touchPauseAfter = await pg.evaluate(() => ({
        paused: window.__game.paused,
        manualPaused: window.__game.manualPaused,
        fightTime: window.__game.fightTime,
        rafRunning: window.__game.raf !== 0,
        label: document.querySelector('.game-pause-toggle')?.textContent?.trim(),
        activeIsCanvas: document.activeElement === document.querySelector('canvas'),
      }));
      t.manualPause = {
        box: touchPauseBox,
        before: touchPauseBefore,
        pausedAt: touchPausedAt,
        during: touchPauseDuring,
        after: touchPauseAfter,
      };
      if (!touchPauseBox
        || touchPauseBox.width < 44
        || touchPauseBox.height < 44
        || !touchPauseDuring.paused
        || !touchPauseDuring.manualPaused
        || Math.abs(touchPauseDuring.fightTime - touchPausedAt.fightTime) > 0.03
        || touchPauseDuring.playerState !== touchPausedAt.playerState
        || touchPauseDuring.rafRunning
        || touchPauseDuring.audioState !== 'suspended'
        || touchPauseDuring.status !== 'Paused'
        || touchPauseDuring.label !== 'RESUME'
        || !touchPauseDuring.activeIsCanvas
        || touchPauseAfter.paused
        || touchPauseAfter.manualPaused
        || !touchPauseAfter.rafRunning
        || touchPauseAfter.label !== 'PAUSE'
        || !touchPauseAfter.activeIsCanvas
        || touchPauseAfter.fightTime <= touchPausedAt.fightTime) {
        out.errors.push('touch: player pause/resume contract failed: ' + JSON.stringify(t.manualPause));
      }

      const touchMenu = pg.locator('.game-menu-toggle');
      const touchMenuBox = await touchMenu.boundingBox();
      const touchMenuBefore = await pg.evaluate(() => ({
        fightTime: window.__game.fightTime,
        playerState: window.__game.player.state,
      }));
      await touchMenu.tap();
      await pg.waitForFunction(() => Boolean(document.querySelector('#game-battle-menu')),
        null, { timeout: 1200 }).catch(() => {});
      await pg.waitForTimeout(120);
      const touchMenuOpen = await pg.evaluate(() => ({
        paused: window.__game.paused,
        audio: window.__game.audio.debugState().contextState,
        fightTime: window.__game.fightTime,
        playerState: window.__game.player.state,
        canvasTabIndex: document.querySelector('canvas')?.tabIndex,
        activeText: document.activeElement?.textContent?.trim(),
      }));
      await pg.waitForTimeout(120);
      const touchMenuHeld = await pg.evaluate(() => ({
        paused: window.__game.paused,
        audio: window.__game.audio.debugState().contextState,
        fightTime: window.__game.fightTime,
        playerState: window.__game.player.state,
      }));
      await pg.getByRole('button', { name: 'RESUME BATTLE' }).tap();
      await pg.waitForFunction(() => !window.__game.paused
        && !document.querySelector('#game-battle-menu')
        && window.__game.audio.debugState().contextState === 'running',
        null, { timeout: 1500 }).catch(() => {});
      const touchMenuAfter = await pg.evaluate(() => ({
        paused: window.__game.paused,
        playerState: window.__game.player.state,
        activeIsCanvas: document.activeElement === document.querySelector('canvas'),
      }));
      t.battleMenu = {
        box: touchMenuBox,
        before: touchMenuBefore,
        open: touchMenuOpen,
        held: touchMenuHeld,
        after: touchMenuAfter,
      };
      if (!touchMenuBox
        || touchMenuBox.width < 44
        || touchMenuBox.height < 44
        || touchMenuBox.x < 0
        || touchMenuBox.y < 0
        || touchMenuBox.x + touchMenuBox.width > 391
        || !touchMenuOpen.paused
        || touchMenuOpen.audio !== 'suspended'
        || touchMenuOpen.canvasTabIndex !== -1
        || touchMenuOpen.activeText !== 'RESUME BATTLE'
        || !touchMenuHeld.paused
        || touchMenuHeld.audio !== 'suspended'
        || Math.abs(touchMenuHeld.fightTime - touchMenuOpen.fightTime) > 0.03
        || touchMenuHeld.playerState !== touchMenuOpen.playerState
        || touchMenuAfter.paused
        || !touchMenuAfter.activeIsCanvas) {
        out.errors.push('touch: battle menu did not pause and resume safely: ' + JSON.stringify(t.battleMenu));
      }

      // 6. +5 touch swipe timing and combo length must match what is drawn.
      t.difficultyTelegraphs = await pg.evaluate(() => {
        const g = window.__game;
        const probe = (phase) => {
          g.state = 'title'; g.setGrace(5); g.resetFight(); g.state = 'fight';
          const b = g.boss;
          b.phase = phase;
          b.state = 'stalk';
          b.x = 0; b.y = -100;
          g.player.x = 100; g.player.y = -100;
          for (const key of Object.keys(b.cooldowns)) b.cooldowns[key] = key === 'swipe' ? 0 : 999;
          b.chooseAttack(g, 100);
          const fresh = { combo: b.comboLeft, duration: b.t, total: b.windupTotal(),
            progress: 1 - b.t / b.windupTotal() };
          b.state = 'strike'; b.t = 0;
          b.update(0, g);
          const followup = { combo: b.comboLeft, duration: b.t, total: b.windupTotal(),
            progress: 1 - b.t / b.windupTotal() };
          return { fresh, followup };
        };
        const phase2 = probe(2);
        const phase3 = probe(3);
        const b = g.boss;
        b.phase = 3;
        b.state = 'windup';
        b.attack = 'swipe';
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const originalFillText = ctx.fillText;
        const labels = [];
        ctx.fillText = function (text, x, y, maxWidth) {
          labels.push(String(text));
          return maxWidth === undefined
            ? originalFillText.call(this, text, x, y)
            : originalFillText.call(this, text, x, y, maxWidth);
        };
        g.render();
        ctx.fillText = originalFillText;
        return { phase2, phase3, ironboundVisible: labels.some((text) => text.includes('IRONBOUND')) };
      });
      for (const [phase, probe] of Object.entries({
        phase2: t.difficultyTelegraphs.phase2,
        phase3: t.difficultyTelegraphs.phase3,
      })) {
        if (probe.fresh.combo !== 3) out.errors.push(`touch: ${phase} swipe combo starts with ${probe.fresh.combo}, expected 3`);
        if (probe.fresh.duration < 0.299 || probe.followup.duration < 0.239) {
          out.errors.push(`touch: ${phase} swipe telegraph is below the reaction floor: ` + JSON.stringify(probe));
        }
        if (Math.abs(probe.fresh.duration - probe.fresh.total) > 0.000001
          || Math.abs(probe.followup.duration - probe.followup.total) > 0.000001
          || Math.abs(probe.fresh.progress) > 0.000001
          || Math.abs(probe.followup.progress) > 0.000001) {
          out.errors.push(`touch: ${phase} swipe visual timing differs from combat timing: ` + JSON.stringify(probe));
        }
      }
      if (!t.difficultyTelegraphs.ironboundVisible) out.errors.push('touch: +5 HUD does not disclose IRONBOUND poise');
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-forsaken-ironbound.png') });

      // 6. the joystick actually moves the knight
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
                                               hintT: window.__game.hintT,
                                               joy: { a: window.__game.input.joyActive, x: window.__game.input.joyX, y: window.__game.input.joyY } }));
      t.joystick = { before, after };
      if (!after.joy.a) out.errors.push('touch: drag on the left half did not engage the joystick');
      if (Math.hypot(after.x - before.x, after.y - before.y) < 4) out.errors.push('touch: joystick drag did not move the player');
      if (after.hintT > 0.35) out.errors.push('touch: tutorial did not dismiss after meaningful movement (' + after.hintT + ')');
      await pg.evaluate(() => {
        const c = document.querySelector('canvas');
        const t = new Touch({ identifier: 1, target: c, clientX: 160, clientY: 530 });
        c.dispatchEvent(new TouchEvent('touchend', { changedTouches: [t], touches: [], bubbles: true, cancelable: true }));
      });

      // 7. the ATK button actually attacks
      const atk = t.layout.btns.find((b) => b.id === 'light');
      await pg.evaluate(() => {
        const g = window.__game;
        g.resetFight();
        g.state = 'fight';
        g.boss.state = 'staggered';
        g.boss.t = 0;
        g.player.state = 'move';
        g.player.stam = 100;
      });
      await pg.touchscreen.tap(atk.x, atk.y);
      await pg.waitForFunction(() => window.__game.player.state === 'light', null, { timeout: 1000 }).catch(() => {});
      t.atkState = await pg.evaluate(() => window.__game.player.state);
      if (t.atkState !== 'light') out.errors.push('touch: ATK button did not enter the light-attack state (' + t.atkState + ')');

      // A phone player naturally taps ATK faster than one full attack cycle.
      // Preserve all three presses rather than collapsing them into two hits.
      await pg.evaluate(() => {
        const g = window.__game;
        g.resetFight();
        g.state = 'fight';
        g.input.reset();
        g.player.x = 0; g.player.y = 0; g.player.facing = 0; g.player.stam = 100;
        g.boss.x = 70; g.boss.y = 0; g.boss.hp = 9999; g.boss.maxHp = 9999;
        g.boss.state = 'recover'; g.boss.t = 99; g.boss.vx = 0; g.boss.vy = 0;
        window.__touchComboSteps = [];
        window.__touchComboFeedback = [];
        window.__touchComboOriginalStrike = g.playerStrike.bind(g);
        g.playerStrike = (heavy) => {
          window.__touchComboSteps.push({ heavy, step: g.player.comboStep });
          window.__touchComboOriginalStrike(heavy);
          window.__touchComboFeedback.push({
            hits: g.playerChainHits,
            finished: g.playerChainFinished,
            visibleFor: g.playerChainT,
          });
        };
      });
      for (let press = 0; press < 3; press++) {
        if (press > 0) await pg.waitForTimeout(50);
        await pg.touchscreen.tap(atk.x, atk.y);
      }
      await pg.waitForFunction(() => window.__touchComboSteps.length >= 3, null, { timeout: 2500 }).catch(() => {});
      t.rapidAtkCombo = await pg.evaluate(() => {
        const g = window.__game;
        const result = {
          steps: window.__touchComboSteps,
          feedback: window.__touchComboFeedback,
          queuedAtEnd: g.player.queuedLightAttacks,
        };
        g.playerChainHits = 3;
        g.playerChainFinished = true;
        g.playerChainT = 1.4;
        g.render();
        g.playerStrike = window.__touchComboOriginalStrike;
        delete window.__touchComboOriginalStrike;
        delete window.__touchComboSteps;
        delete window.__touchComboFeedback;
        return result;
      });
      if (t.rapidAtkCombo.steps.length !== 3
        || t.rapidAtkCombo.steps.some((hit, index) => hit.heavy || hit.step !== index)
        || t.rapidAtkCombo.feedback.map((v) => v.hits).join(',') !== '1,2,3'
        || !t.rapidAtkCombo.feedback[2]?.finished
        || t.rapidAtkCombo.queuedAtEnd !== 0) {
        out.errors.push('touch: rapid ATK did not complete the three-hit light combo: '
          + JSON.stringify(t.rapidAtkCombo));
      }
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-combo-finisher.png') });

      t.queuedComboFeedback = await pg.evaluate(() => {
        const g = window.__game;
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const originalFillText = ctx.fillText;
        const labels = [];
        ctx.fillText = function (text, x, y, maxWidth) {
          labels.push(String(text));
          return maxWidth === undefined
            ? originalFillText.call(this, text, x, y)
            : originalFillText.call(this, text, x, y, maxWidth);
        };
        g.playerChainHits = 0;
        g.playerChainFinished = false;
        g.playerChainT = 0;
        g.player.queuedLightAttacks = 2;
        g.render();
        ctx.fillText = originalFillText;
        g.player.queuedLightAttacks = 0;
        return labels.find((label) => label.includes('ATK QUEUED')) || '';
      });
      if (!t.queuedComboFeedback.includes('◆◆')) {
        out.errors.push('touch: queued light attacks have no visible feedback (' + t.queuedComboFeedback + ')');
      }

      // Expanded fingertip regions can overlap even though the circles do not.
      // A point on the visible ATK edge must resolve to exactly one nearest
      // normalized action, never ATK + ROLL together.
      t.expandedTargeting = await pg.evaluate(() => {
        const g = window.__game, c = document.querySelector('canvas');
        const btns = g.touchLayout().btns;
        const a = btns.find((b) => b.id === 'light'), b = btns.find((v) => v.id === 'roll');
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const x = a.x + (b.x - a.x) / d * (a.r - 1);
        const y = a.y + (b.y - a.y) / d * (a.r - 1);
        g.setUiFocused(true); g.input.clearCombatActions();
        const touch = new Touch({ identifier: 77, target: c, clientX: x, clientY: y });
        c.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [touch], touches: [touch], bubbles: true, cancelable: true }));
        const result = { x, y, inLight: Math.hypot(x - a.x, y - a.y) < a.r + 10,
          inRoll: Math.hypot(x - b.x, y - b.y) < b.r + 10,
          light: g.input.hasBuffered('light'), roll: g.input.hasBuffered('roll'), heavy: g.input.hasBuffered('heavy') };
        c.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch], touches: [], bubbles: true, cancelable: true }));
        g.input.clearCombatActions(); g.setUiFocused(false);
        return result;
      });
      if (!t.expandedTargeting.inLight || !t.expandedTargeting.inRoll || !t.expandedTargeting.light
        || t.expandedTargeting.roll || t.expandedTargeting.heavy) {
        out.errors.push('touch: expanded overlap did not resolve to one nearest action: ' + JSON.stringify(t.expandedTargeting));
      }

      // 8. touch actions share the keyboard/mouse buffer through hit-stop
      const roll = t.layout.btns.find((b) => b.id === 'roll');
      await pg.evaluate(() => {
        const g = window.__game;
        g.player.state = 'move';
        g.player.stam = 100;
        g.hitstop = 0.09;
      });
      await pg.touchscreen.tap(roll.x, roll.y);
      await pg.waitForFunction(() => window.__game.player.state === 'roll', null, { timeout: 1500 }).catch(() => {});
      t.bufferedRollState = await pg.evaluate(() => window.__game.player.state);
      if (t.bufferedRollState !== 'roll') out.errors.push('touch: roll was lost during hit-stop (' + t.bufferedRollState + ')');

      // 9. sound is an actual touch target, not a passive status label
      const sound = await pg.evaluate(() => window.__game.soundButtonRect());
      const mutedBefore = await pg.evaluate(() => window.__game.audio.muted);
      await pg.touchscreen.tap(sound.x + sound.width / 2, sound.y + sound.height / 2);
      await pg.waitForTimeout(120);
      const mutedAfter = await pg.evaluate(() => window.__game.audio.muted);
      t.touchMute = { before: mutedBefore, after: mutedAfter };
      if (mutedAfter === mutedBefore) out.errors.push('touch: sound control did not toggle mute');

      // 10. A natural death must accept one real tap after the prompt appears.
      // Retry uses a durable confirmation sequence rather than a frame-length
      // action flag, so focus/event translation cannot discard the gesture.
      t.deathRetryBefore = await pg.evaluate(() => {
        const g = window.__game;
        g.resetFight();
        g.state = 'fight';
        g.player.takeDamage(g.player.maxHp * 10, g.boss.x, g.boss.y, g);
        return { state: g.state, playerState: g.player.state, attempts: g.attempts,
          confirmSequence: g.input.confirmSequence };
      });
      await pg.waitForFunction(() => window.__game.state === 'dead' && window.__game.stateT > 1.65, null, { timeout: 8000 }).catch(() => {});
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-death.png') });
      await pg.touchscreen.tap(195, 500);
      await pg.waitForFunction(() => window.__game.state === 'intro', null, { timeout: 3000 }).catch(() => {});
      t.deathRetryAfter = await pg.evaluate(() => ({
        state: window.__game.state, playerState: window.__game.player.state,
        attempts: window.__game.attempts, confirmSequence: window.__game.input.confirmSequence,
      }));
      if (
        t.deathRetryBefore.state !== 'dead'
        || t.deathRetryBefore.playerState !== 'dead'
        || t.deathRetryAfter.state !== 'intro'
        || t.deathRetryAfter.playerState !== 'move'
        || t.deathRetryAfter.attempts !== t.deathRetryBefore.attempts + 1
        || t.deathRetryAfter.confirmSequence <= t.deathRetryBefore.confirmSequence
      ) out.errors.push('touch: natural death did not rise on one tap: ' + JSON.stringify({
        before: t.deathRetryBefore, after: t.deathRetryAfter,
      }));

      // Some embedded/mobile surfaces expose Pointer Events without delivering
      // a legacy touchstart. Exercise that exact fallback independently.
      t.pointerRetryBefore = await pg.evaluate(() => {
        const g = window.__game;
        g.resetFight();
        g.state = 'fight';
        g.player.takeDamage(g.player.maxHp * 10, g.boss.x, g.boss.y, g);
        return { state: g.state, attempts: g.attempts, confirmSequence: g.input.confirmSequence };
      });
      await pg.waitForFunction(() => window.__game.state === 'dead' && window.__game.stateT > 1.65, null, { timeout: 8000 }).catch(() => {});
      await pg.evaluate(() => {
        const c = document.querySelector('canvas');
        c.dispatchEvent(new PointerEvent('pointerdown', {
          pointerId: 91, pointerType: 'touch', isPrimary: true, button: 0,
          clientX: 195, clientY: 500, bubbles: true, cancelable: true,
        }));
      });
      await pg.waitForFunction(() => window.__game.state === 'intro', null, { timeout: 3000 }).catch(() => {});
      t.pointerRetryAfter = await pg.evaluate(() => ({
        state: window.__game.state, attempts: window.__game.attempts,
        confirmSequence: window.__game.input.confirmSequence,
      }));
      if (
        t.pointerRetryAfter.state !== 'intro'
        || t.pointerRetryAfter.attempts !== t.pointerRetryBefore.attempts + 1
        || t.pointerRetryAfter.confirmSequence <= t.pointerRetryBefore.confirmSequence
      ) out.errors.push('touch: pointer-only death retry failed: ' + JSON.stringify({
        before: t.pointerRetryBefore, after: t.pointerRetryAfter,
      }));

      // Repeated deaths offer one explicit, non-automatic step toward Grace.
      // The lethal source also needs to produce a useful next-attempt hint.
      t.deathGraceFreshInput = await pg.evaluate(() => {
        const g = window.__game;
        g.state = 'title'; g.setGrace(0); g.attempts = 2;
        g.resetFight(); g.state = 'fight'; g.player.iframes = 0;
        g.input.bufferPress('left');
        g.player.takeDamage(g.player.maxHp * 10, g.boss.x, g.boss.y, g, 'ring');
        const afterDeath = {
          state: g.state,
          grace: g.grace,
          carriedLeft: g.input.hasBuffered('left'),
        };
        g.frame(1 / 60);
        const afterCarryoverFrame = { state: g.state, grace: g.grace };
        g.input.bufferPress('left');
        g.frame(1 / 60);
        return {
          afterDeath,
          afterCarryoverFrame,
          afterFreshInput: { state: g.state, grace: g.grace },
        };
      });
      if (
        t.deathGraceFreshInput.afterDeath.state !== 'dead'
        || t.deathGraceFreshInput.afterDeath.grace !== 0
        || t.deathGraceFreshInput.afterDeath.carriedLeft
        || t.deathGraceFreshInput.afterCarryoverFrame.grace !== 0
        || t.deathGraceFreshInput.afterFreshInput.state !== 'dead'
        || t.deathGraceFreshInput.afterFreshInput.grace !== -1
      ) {
        out.errors.push('touch: Receive Grace did not require fresh post-death input: '
          + JSON.stringify(t.deathGraceFreshInput));
      }

      t.deathGraceBefore = await pg.evaluate(() => {
        const g = window.__game;
        g.state = 'title'; g.setGrace(0); g.attempts = 2;
        g.resetFight(); g.state = 'fight'; g.player.iframes = 0;
        g.player.takeDamage(g.player.maxHp * 10, g.boss.x, g.boss.y, g, 'ring');
        return {
          state: g.state,
          grace: g.grace,
          hint: g.deathHint(),
          rect: g.deathGraceRect(),
          confirmSequence: g.input.confirmSequence,
        };
      });
      await pg.waitForFunction(() => window.__game.state === 'dead' && window.__game.stateT > 1.65, null, { timeout: 8000 }).catch(() => {});
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-death-grace-before.png') });
      await pg.touchscreen.tap(
        t.deathGraceBefore.rect.x + t.deathGraceBefore.rect.width / 2,
        t.deathGraceBefore.rect.y + t.deathGraceBefore.rect.height / 2,
      );
      await pg.waitForFunction(() => window.__game.grace === -1, null, { timeout: 1500 }).catch(() => {});
      t.deathGraceAfter = await pg.evaluate(() => ({
        state: window.__game.state,
        grace: window.__game.grace,
        confirmSequence: window.__game.input.confirmSequence,
        terminalConfirmSequence: window.__game.terminalConfirmSequence,
      }));
      if (t.deathGraceBefore.state !== 'dead'
        || t.deathGraceBefore.grace !== 0
        || !t.deathGraceBefore.hint.includes('bright edge')
        || t.deathGraceAfter.state !== 'dead'
        || t.deathGraceAfter.grace !== -1
        || t.deathGraceAfter.terminalConfirmSequence !== t.deathGraceAfter.confirmSequence) {
        out.errors.push('touch: Receive Grace or lethal-source hint failed: ' + JSON.stringify({
          before: t.deathGraceBefore, after: t.deathGraceAfter,
        }));
      }
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-death-grace-after.png') });
      await pg.touchscreen.tap(195, 500);
      await pg.waitForFunction(() => window.__game.state === 'intro', null, { timeout: 3000 }).catch(() => {});
      if (await pg.evaluate(() => window.__game.state) !== 'intro') {
        out.errors.push('touch: retry stopped working after Receive Grace');
      }

      // Mobile victory scorecard must fit the real touch viewport and carry
      // the same immediately persisted result as desktop.
      t.victoryScore = await pg.evaluate(() => {
        const g = window.__game;
        g.resetFight();
        g.state = 'fight';
        g.fightTime = 83.2;
        g.damageDealt = 1147;
        g.hitsTaken = 2;
        g.boss.hp = 0;
        g.onBossDeath();
        g.slowT = 0;
        g.timeScale = 1;
        g.stateT = g.constructor.VICTORY_INPUT_DELAY + 0.2;
        g.goldFlash = 0;
        g.render();
        return {
          state: g.state,
          lastScore: g.lastScore,
          save: JSON.parse(localStorage.getItem('gracefell') || 'null'),
        };
      });
      if (t.victoryScore.state !== 'victory'
        || t.victoryScore.save?.v !== 7
        || t.victoryScore.lastScore?.grade !== t.victoryScore.save?.lastScore?.grade
        || t.victoryScore.lastScore?.time !== 83.2
        || t.victoryScore.save?.scoreHistory?.[0]?.time !== 83.2
        || !Number.isFinite(Date.parse(t.victoryScore.save?.scoreHistory?.[0]?.completedAt || ''))) {
        out.errors.push('touch: victory scorecard was not saved: ' + JSON.stringify(t.victoryScore));
      }
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-victory.png') });
      await pg.evaluate(() => {
        const g = window.__game;
        g.resetFight();
        g.state = 'fight';
        g.render();
      });

      // 11. no horizontal overflow, canvas drawing, clean console
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
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-combat.png') });
      t.weatherPhase2 = await pg.evaluate(() => {
        const g = window.__game; g.state = 'fight'; g.boss.phase = 2;
        g.deepenArena(2); g.weatherBlend = 1;
        g.banner('THE SOVEREIGN BURNS', 'phase'); g.render();
        return g.weatherSnapshot();
      });
      if (t.weatherPhase2.phase !== 2
        || t.weatherPhase2.moteCount !== 64
        || t.weatherPhase2.backgroundMotes !== 48
        || t.weatherPhase2.foregroundMotes !== 16) {
        out.errors.push('touch: fixed-pool Ember Gale did not render: ' + JSON.stringify(t.weatherPhase2));
      }
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-phase2.png') });

      t.journeyTell = await pg.evaluate(() => {
        const g = window.__game;
        g.state = 'title'; g.setGrace(-2); g.resetFight(); g.state = 'fight';
        g.boss.phase = 2; g.boss.state = 'windup'; g.boss.attack = 'ring'; g.boss.t = 0.5;
        const labels = [];
        const ctx = g.ctx;
        const originalFillText = ctx.fillText;
        ctx.fillText = function (text, x, y, maxWidth) {
          labels.push(String(text));
          return maxWidth === undefined
            ? originalFillText.call(this, text, x, y)
            : originalFillText.call(this, text, x, y, maxWidth);
        };
        g.render();
        ctx.fillText = originalFillText;
        return { clearTells: g.mods.clearTells, labels };
      });
      if (!t.journeyTell.clearTells || !t.journeyTell.labels.includes('READ · RING')) {
        out.errors.push('touch: Journey did not expose the authored boss tell: ' + JSON.stringify(t.journeyTell));
      }
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-journey-tell.png') });

      t.oathChainHud = await pg.evaluate(() => {
        const g = window.__game;
        g.state = 'title'; g.setGrace(5); g.resetFight(); g.state = 'fight';
        g.boss.state = 'windup'; g.boss.attack = 'charge'; g.boss.t = 0.5;
        g.boss.chainStep = 2; g.boss.chainTotal = 3;
        const labels = [];
        const ctx = g.ctx;
        const originalFillText = ctx.fillText;
        ctx.fillText = function (text, x, y, maxWidth) {
          labels.push(String(text));
          return maxWidth === undefined
            ? originalFillText.call(this, text, x, y)
            : originalFillText.call(this, text, x, y, maxWidth);
        };
        g.render();
        ctx.fillText = originalFillText;
        return { rank: g.mods.chainRank, labels };
      });
      const compactChain = t.oathChainHud.labels.find((label) => label.includes('OATH CHAIN  2/3'));
      if (t.oathChainHud.rank !== 3 || !compactChain || !compactChain.includes('IRONBOUND')) {
        out.errors.push('touch: Oath chain HUD did not surface the current packet: ' + JSON.stringify(t.oathChainHud));
      }
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-oath-chain.png') });
      await tctx.close();
    }

    // Cold-start audio guard: do not hide first-tap work behind the main pass's
    // 1.2 second settle. This opens a fresh phone context and gestures as soon
    // as the Game instance exists.
    {
      const fastCtx = await browser.newContext({
        viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3,
      });
      await installAudioSampleRate(fastCtx);
      const fast = await fastCtx.newPage();
      await fast.goto(URL, { waitUntil: 'load' });
      await fast.waitForFunction(() => Boolean(window.__game), null, { timeout: 3000 });
      const preparedBeforeGesture = await fast.evaluate(() => window.__game.audio.debugState().waveDataPrepared);
      await fast.touchscreen.tap(195, 300);
      await fast.waitForTimeout(100);
      const fastAudio = await fast.evaluate(() => window.__game.audio.debugState());
      out.steps.fastFirstTapAudio = {
        preparedBeforeGesture,
        initCostMs: fastAudio.initCostMs,
        contextCreateCostMs: fastAudio.contextCreateCostMs,
        graphInitCostMs: fastAudio.graphInitCostMs,
        initialized: fastAudio.initialized,
        sampleRate: fastAudio.contextSampleRate,
      };
      if (!preparedBeforeGesture
        || !fastAudio.initialized
        || !(fastAudio.contextCreateCostMs > 0)
        || !(fastAudio.graphInitCostMs > 0)
        || fastAudio.graphInitCostMs > MAX_GRAPH_INIT_MS
        || fastAudio.initCostMs > 40) {
        out.errors.push('touch: fast first-tap audio missed the 40ms total / 12ms graph ceiling: '
          + JSON.stringify(out.steps.fastFirstTapAudio));
      }
      await fastCtx.close();
    }

    // v2.22 recorded-SFX acceptance. Run in an isolated save-data phone
    // context so the two-worker contract, priority order, cold-start fallback,
    // and cleanup paths are deterministic without weakening the main
    // desktop/mobile/true-touch visual gates above.
    {
      const audioCtx = await browser.newContext({
        viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3,
      });
      await installAudioSampleRate(audioCtx);
      await audioCtx.addInitScript(() => {
        Object.defineProperty(navigator, 'connection', {
          configurable: true,
          value: { saveData: true, effectiveType: '4g' },
        });
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const requestUrl = typeof input === 'string'
            ? input
            : input instanceof Request
              ? input.url
              : String(input);
          if (requestUrl.includes('/audio/sfx/')) {
            await new Promise((resolve) => setTimeout(resolve, 65));
          }
          return nativeFetch(input, init);
        };
      });

      const audioPg = await audioCtx.newPage();
      const sfxResponses = [];
      const audioConsoleErrors = [];
      audioPg.on('response', (response) => {
        if (response.url().includes('/audio/sfx/')) {
          sfxResponses.push({ url: response.url(), status: response.status() });
        }
      });
      audioPg.on('console', (message) => {
        if (message.type() === 'error') audioConsoleErrors.push(message.text());
      });
      audioPg.on('pageerror', (error) => audioConsoleErrors.push('pageerror: ' + error.message));

      await audioPg.goto(URL, { waitUntil: 'load' });
      await audioPg.waitForFunction(() => Boolean(window.__game), null, { timeout: 3000 });
      await audioPg.touchscreen.tap(195, 300);
      await audioPg.waitForFunction(() => {
        const state = window.__game?.audio.debugState();
        return state?.sfxSampleState === 'loading' && state.sfxLoadingCount > 0;
      }, null, { timeout: 2000 }).catch(() => {});

      const initialLoader = await audioPg.evaluate(() => window.__game.audio.debugState());
      const coldFallback = await audioPg.evaluate(() => {
        const audio = window.__game.audio;
        const before = audio.debugState().activeVoices;
        audio.chargeLoopStart();
        audio.chargeLoopStart();
        audio.chargeLoopSet(0.75);
        const started = audio.debugState();
        audio.chargeLoopStop();
        return {
          before,
          started: {
            activeVoices: started.activeVoices,
            sustainedCueActive: started.sustainedCueActive,
            sustainedCueFallback: started.sustainedCueFallback,
          },
          stopped: audio.debugState().sustainedCueActive,
        };
      });
      await audioPg.waitForFunction((baseline) => (
        !window.__game.audio.debugState().sustainedCueActive
        && window.__game.audio.debugState().activeVoices <= baseline
      ), coldFallback.before, { timeout: 1200 });

      await audioPg.waitForFunction(() => window.__game.state === 'fight', null, { timeout: 8000 }).catch(() => {});
      const fightBoundary = await audioPg.evaluate(() => window.__game.audio.debugState());
      await audioPg.waitForFunction(() => {
        const state = window.__game.audio.debugState();
        return ['ready', 'partial', 'fallback'].includes(state.sfxSampleState)
          && state.sfxLoadingCount === 0;
      }, null, { timeout: 15000 }).catch(() => {});
      const finalLoader = await audioPg.evaluate(() => window.__game.audio.debugState());

      const uniqueAssets = [...new Set(sfxResponses.map((response) => {
        const parsed = new globalThis.URL(response.url);
        return parsed.pathname;
      }))];
      const versionedResponses = sfxResponses.filter((response) => (
        new globalThis.URL(response.url).searchParams.get('v') === '2.22.0'
      )).length;
      const failedResponses = sfxResponses.filter((response) => response.status < 200 || response.status >= 300);
      const tierSum = Object.values(finalLoader.sfxLoadedByTier).reduce((sum, value) => sum + value, 0);
      const expectedTierSum = Object.values(finalLoader.sfxExpectedByTier).reduce((sum, value) => sum + value, 0);
      out.steps.recordedSfxLoader = {
        initial: {
          state: initialLoader.sfxSampleState,
          workers: initialLoader.sfxWorkerCount,
          loading: initialLoader.sfxLoadingCount,
          queued: initialLoader.sfxQueueRemaining,
          total: initialLoader.sfxSamplesTotal,
        },
        coldFallback,
        fightBoundary: {
          state: fightBoundary.sfxSampleState,
          loaded: fightBoundary.sfxSamplesLoaded,
          failed: fightBoundary.sfxSamplesFailed,
          critical: fightBoundary.sfxLoadedByTier.critical,
          criticalExpected: fightBoundary.sfxExpectedByTier.critical,
        },
        final: {
          state: finalLoader.sfxSampleState,
          version: finalLoader.sfxVersion,
          loaded: finalLoader.sfxSamplesLoaded,
          failed: finalLoader.sfxSamplesFailed,
          total: finalLoader.sfxSamplesTotal,
          queued: finalLoader.sfxQueueRemaining,
          loading: finalLoader.sfxLoadingCount,
          workers: finalLoader.sfxWorkerCount,
          tiers: finalLoader.sfxLoadedByTier,
          expectedTiers: finalLoader.sfxExpectedByTier,
        },
        responses: {
          count: sfxResponses.length,
          uniqueAssets: uniqueAssets.length,
          versioned: versionedResponses,
          failed: failedResponses,
        },
        consoleErrors: audioConsoleErrors,
      };

      if (
        initialLoader.sfxSampleState !== 'loading'
        || initialLoader.sfxWorkerCount !== 2
        || initialLoader.sfxLoadingCount < 1
        || initialLoader.sfxLoadingCount > initialLoader.sfxWorkerCount
        || initialLoader.sfxSamplesTotal !== Object.values(initialLoader.sfxExpectedByTier)
          .reduce((sum, value) => sum + value, 0)
      ) {
        out.errors.push('v2.22: save-data SFX worker bound/manifest diagnostics failed: '
          + JSON.stringify(out.steps.recordedSfxLoader.initial));
      }
      if (
        !coldFallback.started.sustainedCueActive
        || !coldFallback.started.sustainedCueFallback
        || coldFallback.started.activeVoices !== coldFallback.before + 1
        || coldFallback.stopped
      ) {
        out.errors.push('v2.22: cold-start charge fallback was silent, duplicated, or failed to stop: '
          + JSON.stringify(coldFallback));
      }
      if (
        fightBoundary.sfxSamplesFailed !== 0
        || fightBoundary.sfxLoadedByTier.critical !== fightBoundary.sfxExpectedByTier.critical
      ) {
        out.errors.push('v2.22: critical SFX tier was not ready at the natural fight boundary: '
          + JSON.stringify(out.steps.recordedSfxLoader.fightBoundary));
      }
      if (
        finalLoader.sfxSampleState !== 'ready'
        || finalLoader.sfxVersion !== '2.22.0'
        || finalLoader.sfxSamplesLoaded !== expectedTierSum
        || finalLoader.sfxSamplesFailed !== 0
        || finalLoader.sfxSamplesTotal !== expectedTierSum
        || finalLoader.sfxQueueRemaining !== 0
        || finalLoader.sfxLoadingCount !== 0
        || tierSum !== finalLoader.sfxSamplesLoaded
        || finalLoader.sfxLoadedByTier.critical !== finalLoader.sfxExpectedByTier.critical
        || finalLoader.sfxLoadedByTier.phase !== finalLoader.sfxExpectedByTier.phase
        || finalLoader.sfxLoadedByTier.cosmetic !== finalLoader.sfxExpectedByTier.cosmetic
      ) {
        out.errors.push('v2.22: final SFX manifest/load counters are not truthful: '
          + JSON.stringify(out.steps.recordedSfxLoader.final));
      }
      if (
        uniqueAssets.length !== expectedTierSum
        || sfxResponses.length !== expectedTierSum
        || versionedResponses !== expectedTierSum
        || failedResponses.length !== 0
        || audioConsoleErrors.length !== 0
      ) {
        out.errors.push('v2.22: recorded SFX requests were missing, unversioned, duplicated, or errored: '
          + JSON.stringify(out.steps.recordedSfxLoader.responses)
          + ' console=' + JSON.stringify(audioConsoleErrors));
      }

      // Exercise gameplay ownership with method probes, then restore every
      // function before testing the real sustained-voice lifecycle.
      const cueRouting = await audioPg.evaluate(() => {
        const g = window.__game;
        const audio = g.audio;
        const originalBossRelease = audio.bossRelease.bind(audio);
        const originalSwingHeavy = audio.swingHeavy.bind(audio);
        const originalPlayerHurt = audio.playerHurt.bind(audio);
        const originalChargeScrape = audio.chargeScrape.bind(audio);
        const releases = [];
        const hurts = [];
        const scrapeFrames = [];
        try {
          audio.bossRelease = (cue) => releases.push(`boss-${cue}`);
          audio.swingHeavy = (_spatial, charge) => releases.push(`player-heavy-${Math.round(charge * 10)}`);
          audio.playerHurt = (_spatial, damage) => {
            hurts.push(damage <= 12 ? 'light' : damage <= 20 ? 'medium' : 'heavy');
          };
          audio.chargeScrape = () => scrapeFrames.push(g.__qaAudioFrame);

          g.state = 'title';
          g.setGrace(0);
          g.resetFight();
          g.state = 'fight';
          g.input.reset();

          g.player.state = 'move';
          g.player.stam = 100;
          g.input.bufferPress('heavy');
          g.player.update(1 / 60, g.input, g);
          g.player.t = 0.2;
          g.player.update(1 / 60, g.input, g);

          g.player.state = 'heavy';
          g.player.t = 0.2;
          g.player.attackHit = false;
          g.player.heavyCharging = true;
          g.player.heavyChargeT = 0.5;
          g.input.reset();
          g.player.update(1 / 60, g.input, g);

          for (const cue of ['swipe', 'charge', 'spiral']) {
            g.boss.attack = cue;
            g.boss.beginStrike(g);
          }

          g.player.state = 'move';
          g.player.hp = g.player.maxHp;
          g.player.iframes = 0;
          g.player.takeDamage(10, g.boss.x, g.boss.y, g);
          g.player.state = 'move';
          g.player.hp = g.player.maxHp;
          g.player.iframes = 0;
          g.player.takeDamage(16, g.boss.x, g.boss.y, g);
          g.player.state = 'move';
          g.player.hp = g.player.maxHp;
          g.player.iframes = 0;
          g.player.takeDamage(24, g.boss.x, g.boss.y, g);

          g.resetFight();
          g.state = 'fight';
          g.arenaR = 99999;
          g.player.x = 10000;
          g.player.y = 10000;
          g.boss.x = 0;
          g.boss.y = 0;
          g.boss.state = 'strike';
          g.boss.attack = 'charge';
          g.boss.chargeDir = 0;
          g.boss.chargeTime = 2;
          g.boss.chargeFoleyT = 0;
          for (let frame = 0; frame < 66; frame++) {
            g.__qaAudioFrame = frame;
            g.boss.update(1 / 60, g);
          }
        } finally {
          audio.bossRelease = originalBossRelease;
          audio.swingHeavy = originalSwingHeavy;
          audio.playerHurt = originalPlayerHurt;
          audio.chargeScrape = originalChargeScrape;
          delete g.__qaAudioFrame;
        }
        return { releases, hurts, scrapeFrames };
      });
      out.steps.recordedSfxRouting = cueRouting;
      if (
        cueRouting.releases.join(',') !== 'player-heavy-0,player-heavy-10,boss-swipe,boss-charge,boss-spiral'
      ) {
        out.errors.push('v2.26: charged/uncharged player releases or boss release semantics are not distinct: '
          + JSON.stringify(cueRouting));
      }
      if (cueRouting.hurts.join(',') !== 'light,medium,heavy') {
        out.errors.push('v2.26: light/medium/heavy player damage did not route to distinct hurt tiers: '
          + JSON.stringify(cueRouting));
      }
      if (
        cueRouting.scrapeFrames.length !== 3
        || cueRouting.scrapeFrames.some((frame, index) => (
          index > 0 && frame - cueRouting.scrapeFrames[index - 1] < 20
        ))
      ) {
        out.errors.push('v2.22: boss charge scrape cadence can overload the mix: ' + JSON.stringify(cueRouting));
      }

      const v226Contracts = await audioPg.evaluate(() => {
        const g = window.__game;
        const audio = g.audio;
        const originalHit = audio.hit.bind(audio);
        const originalNearMiss = audio.nearMiss.bind(audio);
        const originalStaminaEmpty = audio.staminaEmpty.bind(audio);
        const originalWardChime = audio.wardChime.bind(audio);
        const originalGradeStamp = audio.gradeStamp.bind(audio);
        const chargedContacts = [];
        const gradeStamps = [];
        let nearMisses = 0;
        let staminaWarnings = 0;
        let wardContacts = 0;
        const wasPaused = g.paused;
        cancelAnimationFrame(g.raf);
        g.raf = 0;
        g.paused = true;
        try {
          audio.hit = (heavy, _spatial, _variant, charge) => {
            chargedContacts.push({ heavy, charge: Math.round((charge ?? 0) * 10) / 10 });
          };
          audio.nearMiss = () => { nearMisses++; };
          audio.staminaEmpty = () => { staminaWarnings++; };
          audio.wardChime = () => { wardContacts++; };
          audio.gradeStamp = (grade) => gradeStamps.push(grade);

          g.setGrace(0);
          g.resetFight();
          g.state = 'fight';
          g.boss.state = 'stalk';
          g.boss.takeDamage(10, g, g.player.x, g.player.y, 'heavy', 0);
          g.boss.takeDamage(10, g, g.player.x, g.player.y, 'heavy', 1);

          g.resetFight();
          g.state = 'fight';
          g.input.reset();
          g.player.stam = 0;
          g.input.bufferPress('heavy');
          g.player.update(1 / 60, g.input, g);
          const stamina = {
            warnings: staminaWarnings,
            buffered: g.input.hasBuffered('heavy'),
            state: g.player.state,
          };

          g.resetFight();
          g.state = 'fight';
          g.arenaR = 120;
          g.input.reset();
          g.player.x = 98;
          g.player.y = 0;
          g.player.vx = 240;
          g.player.vy = 0;
          g.player.update(1 / 60, g.input, g);
          const firstWardX = g.player.x;
          g.player.update(1 / 60, g.input, g);
          const ward = {
            contacts: wardContacts,
            firstWardX,
            maxX: g.arenaR - g.player.r - 6,
            latched: g.player.wardContact,
          };

          g.resetFight();
          g.state = 'fight';
          g.arenaR = 520;
          g.player.x = 0;
          g.player.y = 0;
          g.projectiles = [{
            x: -10, y: 40, vx: 600, vy: 0, r: 6, dmg: 10,
            life: 2, hostile: true, hue: '#fff', source: 'volley',
          }];
          g.updateProjectiles(1 / 30);
          g.updateProjectiles(1 / 30);
          g.updateProjectiles(1 / 30);
          const missCount = nearMisses;

          g.player.hp = g.player.maxHp;
          g.player.iframes = 0;
          g.player.state = 'move';
          g.projectiles = [{
            x: -30, y: 0, vx: 600, vy: 0, r: 6, dmg: 10,
            life: 2, hostile: true, hue: '#fff', source: 'volley',
          }];
          g.updateProjectiles(1 / 30);
          const projectile = {
            missCount,
            afterHitMissCount: nearMisses,
            hitRemoved: g.projectiles.length === 0,
            hp: g.player.hp,
          };

          g.state = 'victory';
          g.stateT = 1.49;
          g.timeScale = 1;
          g.hitstop = 0;
          g.grade = 'S';
          g.gradeStampPlayed = false;
          g.frame(0.02);
          g.frame(0.02);

          return {
            chargedContacts,
            stamina,
            ward,
            projectile,
            gradeStamps,
            gradeStampPlayed: g.gradeStampPlayed,
          };
        } finally {
          audio.hit = originalHit;
          audio.nearMiss = originalNearMiss;
          audio.staminaEmpty = originalStaminaEmpty;
          audio.wardChime = originalWardChime;
          audio.gradeStamp = originalGradeStamp;
          g.paused = wasPaused;
          if (!wasPaused) {
            g.lastTs = performance.now();
            g.startLoop();
          }
        }
      });
      out.steps.v226AudioGameplayContracts = v226Contracts;
      if (
        JSON.stringify(v226Contracts.chargedContacts) !== JSON.stringify([
          { heavy: true, charge: 0 },
          { heavy: true, charge: 1 },
        ])
      ) {
        out.errors.push('v2.26: charged contact weight was not passed through the boss impact boundary: '
          + JSON.stringify(v226Contracts));
      }
      if (
        v226Contracts.stamina.warnings !== 1
        || !v226Contracts.stamina.buffered
        || v226Contracts.stamina.state !== 'move'
      ) {
        out.errors.push('v2.26: stamina denial warning consumed or mutated the buffered command: '
          + JSON.stringify(v226Contracts.stamina));
      }
      if (
        v226Contracts.ward.contacts !== 1
        || Math.abs(v226Contracts.ward.firstWardX - v226Contracts.ward.maxX) > 0.001
        || !v226Contracts.ward.latched
      ) {
        out.errors.push('v2.26: arena-ward contact cue is missing, repeated, or detached from clamping: '
          + JSON.stringify(v226Contracts.ward));
      }
      if (
        v226Contracts.projectile.missCount !== 1
        || v226Contracts.projectile.afterHitMissCount !== 1
        || !v226Contracts.projectile.hitRemoved
        || v226Contracts.projectile.hp >= 110
      ) {
        out.errors.push('v2.26: projectile closest-pass cue repeated or fired on damaging contact: '
          + JSON.stringify(v226Contracts.projectile));
      }
      if (
        v226Contracts.gradeStamps.join(',') !== 'S'
        || !v226Contracts.gradeStampPlayed
      ) {
        out.errors.push('v2.26: victory grade seal did not stamp exactly once at its reveal: '
          + JSON.stringify(v226Contracts));
      }

      const v226MixProfiles = await audioPg.evaluate(() => {
        const audio = window.__game.audio;
        const originalPlaySample = audio.playSample.bind(audio);
        const samples = [];
        let label = '';
        try {
          audio.playSample = (opts) => {
            samples.push({
              label,
              name: opts.name,
              gain: opts.gain,
              rate: opts.rate ?? 1,
              reverb: opts.reverb,
            });
            return true;
          };
          const capture = (nextLabel, cue) => {
            label = nextLabel;
            audio.lastCue.clear();
            cue();
          };
          capture('heavy-release-0', () => audio.swingHeavy(0, 0));
          capture('heavy-release-1', () => audio.swingHeavy(0, 1));
          capture('heavy-hit-0', () => audio.hit(true, 0, 0, 0));
          capture('heavy-hit-1', () => audio.hit(true, 0, 0, 1));
          capture('hurt-light', () => audio.playerHurt(0, 10));
          capture('hurt-medium', () => audio.playerHurt(0, 16));
          capture('hurt-heavy', () => audio.playerHurt(0, 24));
          capture('grade-s', () => audio.gradeStamp('S'));
          return samples;
        } finally {
          audio.playSample = originalPlaySample;
          audio.lastCue.clear();
        }
      });
      out.steps.v226MixProfiles = v226MixProfiles;
      const mixByLabel = Object.fromEntries(v226MixProfiles.map((sample) => [sample.label, sample]));
      if (
        !(mixByLabel['heavy-release-1']?.rate < mixByLabel['heavy-release-0']?.rate)
        || !(mixByLabel['heavy-hit-1']?.rate < mixByLabel['heavy-hit-0']?.rate)
        || mixByLabel['hurt-light']?.name !== 'hurt-light-1'
        || mixByLabel['hurt-medium']?.name !== 'hurt-heavy-1'
        || mixByLabel['hurt-heavy']?.name !== 'hurt-heavy-1'
        || !(mixByLabel['hurt-heavy']?.rate < mixByLabel['hurt-medium']?.rate)
        || mixByLabel['grade-s']?.name !== 'stamp'
      ) {
        out.errors.push('v2.26: authored charge, hurt-tier, or grade-seal mix profiles regressed: '
          + JSON.stringify(v226MixProfiles));
      }

      const sustainedLifecycle = await audioPg.evaluate(async () => {
        const g = window.__game;
        const audio = g.audio;
        const settle = (ms = 260) => new Promise((resolve) => setTimeout(resolve, ms));
        // This probe owns the voice counter it samples. Leave Web Audio
        // running, but stop the gameplay RAF so a real boss cue cannot enter
        // the global pool between the charge release and its assertion.
        cancelAnimationFrame(g.raf);
        g.raf = 0;
        g.paused = true;
        g.arenaR = 520;
        g.resetFight();
        g.state = 'fight';
        await settle(700);
        const baseline = audio.debugState().activeVoices;

        audio.chargeLoopStart();
        const first = audio.debugState();
        audio.chargeLoopStart();
        audio.chargeLoopSet(0.9);
        const duplicate = audio.debugState();
        audio.chargeLoopStop();
        await settle();
        const release = audio.debugState();
        const simulationIsolated = g.paused && g.raf === 0;

        audio.chargeLoopStart();
        g.player.state = 'move';
        g.player.hp = g.player.maxHp;
        g.player.iframes = 0;
        g.player.takeDamage(10, g.boss.x, g.boss.y, g);
        const damage = audio.debugState();
        await settle(700);

        audio.chargeLoopStart();
        g.resetFight();
        const reset = audio.debugState();

        audio.chargeLoopStart();
        g.state = 'fight';
        g.returnToTitle();
        const title = { state: g.state, ...audio.debugState() };

        audio.chargeLoopStart();
        audio.destroy();
        await settle(350);
        const destroyed = audio.debugState();
        return {
          simulationIsolated,
          baseline,
          first: { active: first.sustainedCueActive, voices: first.activeVoices, fallback: first.sustainedCueFallback },
          duplicate: { active: duplicate.sustainedCueActive, voices: duplicate.activeVoices },
          release: { active: release.sustainedCueActive, voices: release.activeVoices },
          damage: { active: damage.sustainedCueActive },
          reset: { active: reset.sustainedCueActive },
          title: { state: title.state, active: title.sustainedCueActive },
          destroyed: {
            active: destroyed.sustainedCueActive,
            voices: destroyed.activeVoices,
            sampleState: destroyed.sfxSampleState,
            loaded: destroyed.sfxSamplesLoaded,
            failed: destroyed.sfxSamplesFailed,
            total: destroyed.sfxSamplesTotal,
          },
        };
      });
      out.steps.recordedSfxLifecycle = sustainedLifecycle;
      if (
        !sustainedLifecycle.simulationIsolated
        || !sustainedLifecycle.first.active
        || sustainedLifecycle.first.fallback
        || sustainedLifecycle.first.voices !== sustainedLifecycle.baseline + 1
        || sustainedLifecycle.duplicate.voices !== sustainedLifecycle.first.voices
        || sustainedLifecycle.duplicate.active !== true
        || sustainedLifecycle.release.active
        || sustainedLifecycle.release.voices > sustainedLifecycle.baseline
        || sustainedLifecycle.damage.active
        || sustainedLifecycle.reset.active
        || sustainedLifecycle.title.state !== 'title'
        || sustainedLifecycle.title.active
        || sustainedLifecycle.destroyed.active
        || sustainedLifecycle.destroyed.voices !== 0
        || sustainedLifecycle.destroyed.sampleState !== 'idle'
        || sustainedLifecycle.destroyed.loaded !== 0
        || sustainedLifecycle.destroyed.failed !== 0
        || sustainedLifecycle.destroyed.total !== 0
      ) {
        out.errors.push('v2.22: sustained audio lifecycle leaked or duplicated a charge voice: '
          + JSON.stringify(sustainedLifecycle));
      }

      await audioCtx.close();
    }

    out.ok = out.errors.length === 0;
  } catch (e) {
    out.errors.push('harness: ' + e.message);
  } finally {
    await browser.close();
    fs.writeFileSync(RESULT_PATH, JSON.stringify(out, null, 2));
    console.log(JSON.stringify({ ok: out.ok, nErrors: out.errors.length, result: RESULT_PATH, artifacts: ARTIFACT_DIR }));
    if (!out.ok) process.exitCode = 1;
  }
})();

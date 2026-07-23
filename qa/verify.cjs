// GRACEFELL headless QA gate — portable across local machines and CI.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.GRACEFELL_URL || 'http://127.0.0.1:8491/';
const ARTIFACT_DIR = process.env.GRACEFELL_QA_DIR || path.join(os.tmpdir(), 'gracefell-qa');
const RESULT_PATH = process.env.GRACEFELL_QA_RESULT || path.join(ARTIFACT_DIR, 'result.json');
const FORCED_AUDIO_SAMPLE_RATE = Number(process.env.GRACEFELL_AUDIO_SAMPLE_RATE || 44100);
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
      step.semantics = await pg.evaluate(() => ({
        canvasRole: document.querySelector('canvas')?.getAttribute('role'),
        labelledCanvas: Boolean(document.querySelector('canvas')?.getAttribute('aria-label')),
        liveStatus: Boolean(document.querySelector('[aria-live="polite"]')),
        semanticControls: document.querySelectorAll('.game-accessibility button').length,
      }));
      if (step.semantics.canvasRole !== 'application' || !step.semantics.labelledCanvas || !step.semantics.liveStatus || step.semantics.semanticControls < 6) {
        out.errors.push(vp.name + ': semantic companion controls missing: ' + JSON.stringify(step.semantics));
      }
      if (vp.name === 'desktop') {
        // Focused DOM controls own Enter/Space. They must not confirm the game
        // or leak a combat action through the window-level input handler.
        const soundButton = pg.locator('.game-accessibility button').nth(1);
        await soundButton.focus();
        const semanticBefore = await pg.evaluate(() => ({ state: window.__game.state, muted: window.__game.audio.muted }));
        await pg.keyboard.press('Enter');
        await pg.waitForTimeout(80);
        const semanticAfter = await pg.evaluate(() => ({ state: window.__game.state, muted: window.__game.audio.muted,
          light: window.__game.input.hasBuffered('light'), roll: window.__game.input.hasBuffered('roll') }));
        step.semanticKeyboard = { before: semanticBefore, after: semanticAfter };
        if (semanticAfter.state !== 'title' || semanticAfter.muted === semanticBefore.muted || semanticAfter.light || semanticAfter.roll) {
          out.errors.push('desktop: semantic Sound control leaked into game input: ' + JSON.stringify(step.semanticKeyboard));
        }
        await pg.keyboard.press('Enter'); // restore sound for the audio checks
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
        const startButton = pg.getByRole('button', { name: 'Start fight' });
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
      if (vp.name === 'desktop') {
        const semanticStart = await pg.evaluate(() => ({
          paused: window.__game.paused,
          uiFocused: window.__game.uiFocused,
          activeIsCanvas: document.activeElement === document.querySelector('canvas'),
          rafRunning: window.__game.raf !== 0,
        }));
        step.semanticStart = semanticStart;
        if (semanticStart.paused || semanticStart.uiFocused || !semanticStart.activeIsCanvas || !semanticStart.rafRunning) {
          out.errors.push('desktop: semantic Start fight did not return control to the canvas: ' + JSON.stringify(semanticStart));
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
        // At the normal-voice cutoff, the light contact crack must still enter
        // the six-voice critical reserve instead of disappearing under music.
        const normalVoices = g.audio.activeVoices;
        g.audio.activeVoices = g.audio.maxVoices - 6;
        const pressureBefore = g.audio.activeVoices;
        g.audio.hit(false, { pan: 0, distance: 30 }, 1);
        const pressureAfter = g.audio.activeVoices;
        const debug = g.audio.debugState();
        g.audio.activeVoices = normalVoices;
        return { ...debug, lightPressureDelta: pressureAfter - pressureBefore };
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
      const audioInitBudgetMs = vp.name === 'mobile' ? 20 : 25;
      if (audioState.initCostMs > audioInitBudgetMs) {
        out.errors.push(vp.name + ': first-gesture audio init exceeded ' + audioInitBudgetMs + 'ms: ' + JSON.stringify(audioState));
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
        if (victoryImmediate.state !== 'victory' || victoryImmediate.stateT !== 0
          || victoryImmediate.saved?.v !== 3
          || immediateScore?.grade !== victoryImmediate.grade
          || Math.abs((immediateScore?.time ?? -1) - victoryImmediate.fightTime) > 0.000001
          || immediateScore?.trial !== victoryImmediate.trial
          || immediateBest?.grade !== victoryImmediate.grade
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
            const originalPlayerStrike = g.playerStrike.bind(g);
            const originalSwing = g.audio.swing.bind(g.audio);
            const originalSwingHeavy = g.audio.swingHeavy.bind(g.audio);
            const originalHit = g.audio.hit.bind(g.audio);
            g.playerStrike = (heavy) => {
              comboSteps.push({ heavy, step: g.player.comboStep });
              originalPlayerStrike(heavy);
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
          || !combatRegression.rapidLightCombo.cues.includes('hit-light-2')) {
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
          .filter((button) => /trial/i.test(button.textContent || ''))
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
              bossExtraSpeed: g.boss.extraSpeed,
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
            .filter((button) => /trial/i.test(button.textContent || ''))
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
          .filter((button) => /trial/i.test(button.textContent || ''))
          .every((button) => !button.disabled));
        step.accessibility = acc;
        if (acc.min !== -3 || acc.max !== 5) out.errors.push('grace does not clamp to -3..5: ' + JSON.stringify([acc.min, acc.max]));
        const expectedFlasks = [4, 4, 3, 3, 3, 2, 2, 2, 1];
        const expectedPoise = [120, 120, 120, 120, 120, 120, 162, 204, 204];
        if (acc.levels.length !== 9) out.errors.push('difficulty audit did not cover all nine levels');
        acc.levels.forEach((level, i) => {
          if (level.flasks !== expectedFlasks[i]) out.errors.push(`grace ${level.grace}: expected ${expectedFlasks[i]} flasks, got ${level.flasks}`);
          if (level.maxPoise !== expectedPoise[i]) out.errors.push(`grace ${level.grace}: expected ${expectedPoise[i]} poise, got ${level.maxPoise}`);
          if (level.noStagger !== (level.grace === 5)) out.errors.push(`grace ${level.grace}: no-stagger should be exclusive to +5`);
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

        // save schema v3 round-trip incl. settings and scorecards
        const sv3 = await pg.evaluate(() => {
          const g = window.__game;
          g.state = 'title';
          g.setGrace(2); g.shakeEnabled = false; g.flashReduced = true; g.persist();
          return JSON.parse(localStorage.getItem('gracefell'));
        });
        step.saveV3 = sv3;
        if (sv3.v !== 3 || sv3.grace !== 2 || sv3.shakeEnabled !== false || sv3.flashReduced !== true
          || !sv3.bests || !sv3.lastScore || !sv3.bestScores) {
          out.errors.push('save v3 did not round-trip settings and scores: ' + JSON.stringify(sv3));
        }
        const scoreReload = await pg.evaluate(() => {
          const live = window.__game;
          const G = live.constructor;
          const c = document.createElement('canvas');
          const g2 = new G(c);
          const r = {
            lastScore: g2.lastScore,
            bestScore: g2.lastScore ? g2.bestScores[String(g2.lastScore.trial)] : null,
          };
          g2.destroy();
          window.__game = live;
          return r;
        });
        step.scoreReload = scoreReload;
        if (!scoreReload.lastScore || !scoreReload.bestScore
          || scoreReload.lastScore.grade !== sv3.lastScore.grade
          || scoreReload.bestScore.grade !== sv3.lastScore.grade) {
          out.errors.push('saved victory score did not reload: ' + JSON.stringify(scoreReload));
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
        ctx.fillText = function (text, x, y, maxWidth) {
          if (String(text) === 'FORSAKEN +5') {
            const width = this.measureText(String(text)).width;
            valueLeft = this.textAlign === 'right' ? x - width : x;
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
          valueLeft,
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
      if (lay.pipMax > lay.valueLeft - 6) L.push('grace pips collide with FORSAKEN +5 text');
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

      // 2. touch-appropriate copy, no keyboard bindings shown
      t.rows = await pg.evaluate(() => window.__game.menuRows().map((r) => r.id));
      if (!t.rows.includes('haptics')) out.errors.push('touch: haptics row missing from menu');
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
          if (String(text) === 'FORSAKEN +5') labelLeft = x - this.measureText(String(text)).width;
          return maxWidth === undefined
            ? originalFillText.call(this, text, x, y)
            : originalFillText.call(this, text, x, y, maxWidth);
        };
        g.render();
        ctx.fillText = originalFillText;
        return { pipMax: gm.pipX(5), labelLeft, gap: labelLeft - gm.pipX(5) };
      });
      if (t.forsakenTitle.gap < 6) out.errors.push('touch: FORSAKEN +5 overlaps the grace pips: ' + JSON.stringify(t.forsakenTitle));
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

      // 5. +5 touch swipe timing and combo length must match what is drawn.
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
        window.__touchComboOriginalStrike = g.playerStrike.bind(g);
        g.playerStrike = (heavy) => {
          window.__touchComboSteps.push({ heavy, step: g.player.comboStep });
          window.__touchComboOriginalStrike(heavy);
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
          queuedAtEnd: g.player.queuedLightAttacks,
        };
        g.playerStrike = window.__touchComboOriginalStrike;
        delete window.__touchComboOriginalStrike;
        delete window.__touchComboSteps;
        return result;
      });
      if (t.rapidAtkCombo.steps.length !== 3
        || t.rapidAtkCombo.steps.some((hit, index) => hit.heavy || hit.step !== index)
        || t.rapidAtkCombo.queuedAtEnd !== 0) {
        out.errors.push('touch: rapid ATK did not complete the three-hit light combo: '
          + JSON.stringify(t.rapidAtkCombo));
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
          saved: JSON.parse(localStorage.getItem('gracefell') || 'null')?.lastScore,
        };
      });
      if (t.victoryScore.state !== 'victory'
        || t.victoryScore.lastScore?.grade !== t.victoryScore.saved?.grade
        || t.victoryScore.lastScore?.time !== 83.2) {
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
      await pg.evaluate(() => {
        const g = window.__game; g.state = 'fight'; g.boss.phase = 2;
        g.banner('THE SOVEREIGN BURNS', 'phase'); g.render();
      });
      await pg.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-phase2.png') });
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
      out.steps.fastFirstTapAudio = { preparedBeforeGesture, initCostMs: fastAudio.initCostMs,
        initialized: fastAudio.initialized, sampleRate: fastAudio.contextSampleRate };
      if (!preparedBeforeGesture || !fastAudio.initialized || fastAudio.initCostMs > 20) {
        out.errors.push('touch: fast first-tap audio missed the 20ms budget: ' + JSON.stringify(out.steps.fastFirstTapAudio));
      }
      await fastCtx.close();
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

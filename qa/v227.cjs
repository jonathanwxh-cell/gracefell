// v2.27 Sunder + Resolve acceptance.
//
// These checks exercise authored input routes in the browser, not only exported
// constants. They lock roll priority, contact-gated Sunder, Gracebreak
// consumption, stagger Execute priority, Journey-only recovery and compact HUD
// containment at phone and desktop viewports.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE_URL = process.env.GRACEFELL_URL || 'http://127.0.0.1:8492/';
const ARTIFACT_DIR = process.env.GRACEFELL_ARTIFACT_DIR
  || path.join(os.tmpdir(), 'gracefell-qa', 'v2.27');

async function openGame(browser, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  return { context, page, errors };
}

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const mobile = await openGame(browser, {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });

  const result = await mobile.page.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.raf = 0;
    g.audio.setMuted(true);
    const originalRandom = Math.random;
    Math.random = () => 0.5;

    const setArena = (grace = 0) => {
      g.grace = grace;
      g.resetFight();
      g.state = 'fight';
      g.stateT = 0;
      g.hitstop = 0;
      g.timeScale = 1;
      g.input.reset();
      g.input.isTouch = true;
      const p = g.player;
      const b = g.boss;
      p.x = 0; p.y = 0; p.facing = 0; p.stam = 100; p.iframes = 999;
      b.x = 150; b.y = 0; b.facing = Math.PI; b.r = 40;
      b.hp = 9999; b.maxHp = 9999;
      b.maxPoise = 400; b.poise = 400;
      b.state = 'recover'; b.t = 999; b.vx = 0; b.vy = 0;
      return { p, b };
    };

    const tick = (frames = 1) => {
      for (let i = 0; i < frames; i++) {
        g.hitstop = 0;
        g.player.update(1 / 60, g.input, g);
        g.input.endFrame(1 / 60);
      }
    };

    const perform = (verb, maxFrames = 100, recenter = true) => {
      if (recenter) {
        g.player.x = 0; g.player.y = 0; g.player.facing = 0;
        g.player.vx = 0; g.player.vy = 0;
        g.boss.x = 150; g.boss.y = 0;
        g.boss.vx = 0; g.boss.vy = 0;
      }
      g.input.bufferPress(verb);
      const states = [];
      let sawAction = false;
      for (let i = 0; i < maxFrames; i++) {
        tick();
        states.push(g.player.state);
        if (g.player.state !== 'move') sawAction = true;
        if (sawAction && g.player.state === 'move') break;
      }
      return states;
    };

    const renderText = () => {
      const entries = [];
      const originalFillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function capture(text, x, y, ...rest) {
        entries.push({ text: String(text), x, y });
        return originalFillText.call(this, text, x, y, ...rest);
      };
      try {
        g.render();
      } finally {
        CanvasRenderingContext2D.prototype.fillText = originalFillText;
      }
      return entries;
    };
    const renderLabels = () => renderText().map(({ text }) => text);
    const isCentralFeedback = ({ x, y }) => Math.abs(x - g.w / 2) < 1
      && y >= 100
      && y <= 250;
    const isHeavyButtonLabel = ({ text, x, y }, label) => {
      const heavyButton = g.touchLayout().btns.find((button) => button.id === 'heavy');
      return Boolean(
        heavyButton
        && text === label
        && Math.abs(x - heavyButton.x) < 1
        && Math.abs(y - (heavyButton.y + 4)) < 1
      );
    };

    // ATK, ATK, HVY must branch only after two connected lights.
    let { p, b } = setArena();
    const sunderStart = { hp: b.hp, poise: b.poise, stam: p.stam };
    const sunderStates = [
      ...perform('light'),
      ...perform('light'),
      ...perform('heavy'),
    ];
    const sunder = {
      sawState: sunderStates.includes('sunder'),
      damage: sunderStart.hp - b.hp,
      poise: sunderStart.poise - b.poise,
      stamina: sunderStart.stam - p.stam,
      resolve: g.resolve,
      routeCleared: p.routeLightHits === 0 && p.sunderWindow === 0 && !p.sunderQueued,
    };

    // The familiar third light remains intact and has lower poise/stamina cost.
    ({ p, b } = setArena());
    const lightStart = { hp: b.hp, poise: b.poise, stam: p.stam };
    perform('light'); perform('light'); perform('light');
    const lightString = {
      damage: lightStart.hp - b.hp,
      poise: lightStart.poise - b.poise,
      stamina: lightStart.stam - p.stam,
      resolve: g.resolve,
    };

    // A missed second contact cannot unlock Sunder.
    ({ p, b } = setArena());
    perform('light');
    b.x = 900;
    perform('light', 100, false);
    b.x = 150;
    const missRoute = {
      routeLightHits: p.routeLightHits,
      sunderWindow: p.sunderWindow,
      beforeState: p.state,
      chainBreakText: g.chainBreakText,
      chainBreakVisible: g.chainBreakT > 0,
    };
    const missHeavyStates = perform('heavy');
    missRoute.sawSunder = missHeavyStates.includes('sunder');

    // Roll owns the priority lane when defensive and ender inputs coincide.
    ({ p, b } = setArena());
    perform('light'); perform('light');
    g.input.bufferPress('heavy');
    g.input.bufferPress('roll');
    tick();
    const rollPriority = {
      state: p.state,
      routeLightHits: p.routeLightHits,
      sunderWindow: p.sunderWindow,
    };

    const chargeHeavy = (holdFrames = 60) => {
      if (g.boss.x < 500) {
        g.player.x = 0; g.player.y = 0; g.player.facing = 0;
        g.player.vx = 0; g.player.vy = 0;
        g.boss.x = 150; g.boss.y = 0;
        g.boss.vx = 0; g.boss.vy = 0;
      }
      g.input.held.heavy = true;
      g.input.bufferPress('heavy');
      let sawHeavy = false;
      for (let i = 0; i < holdFrames; i++) {
        tick();
        if (g.player.state === 'heavy') sawHeavy = true;
        if (sawHeavy && g.player.state === 'move') break;
      }
      g.input.held.heavy = false;
      if (g.player.state === 'heavy' && !g.player.attackHit) tick(4);
      return sawHeavy;
    };

    // Full Resolve + full charge becomes one earned release.
    ({ p, b } = setArena());
    g.resolve = 100;
    const breakStart = { hp: b.hp, poise: b.poise, stam: p.stam };
    const sawBreakHeavy = chargeHeavy();
    const gracebreak = {
      sawHeavy: sawBreakHeavy,
      damage: breakStart.hp - b.hp,
      poise: breakStart.poise - b.poise,
      staminaAfter: p.stam,
      resolveAfter: g.resolve,
      uses: g.resolveUses,
    };

    // The release spends Resolve even when it misses.
    ({ p, b } = setArena());
    g.resolve = 100;
    b.x = 900;
    const whiffHp = b.hp;
    chargeHeavy();
    const whiff = { damage: whiffHp - b.hp, resolveAfter: g.resolve, uses: g.resolveUses };

    // Desktop/manual partial heavy remains a normal heavy and preserves the
    // earned meter. Touch has a separate real-tap assertion below because its
    // contextual BREAK button now intentionally latches the full release.
    ({ p, b } = setArena());
    g.resolve = 100;
    g.input.isTouch = false;
    g.input.held.heavy = true;
    g.input.bufferPress('heavy');
    while (p.state !== 'heavy' || p.heavyChargeT < 0.2) tick();
    g.input.held.heavy = false;
    while (!p.attackHit) tick();
    const partial = { charge: p.charge01, resolveAfter: g.resolve, uses: g.resolveUses };
    g.input.isTouch = true;

    // Staggered Execute always wins over Gracebreak and preserves the meter.
    ({ p, b } = setArena());
    g.resolve = 100;
    b.state = 'staggered'; b.t = 99; b.executeConsumed = false;
    chargeHeavy();
    const executePriority = {
      executeConsumed: b.executeConsumed,
      resolveAfter: g.resolve,
      uses: g.resolveUses,
    };

    // Damage cancels the touch-owned charge without spending its meter.
    ({ p, b } = setArena());
    g.resolve = 100;
    g.input.bufferPress('heavy');
    tick();
    const latchedBeforeDamage = p.gracebreakTouchLatch;
    p.iframes = 0;
    p.takeDamage(10, b.x, b.y, g, 'swipe');
    const interruptedTouchBreak = {
      latchedBeforeDamage,
      latchedAfterDamage: p.gracebreakTouchLatch,
      state: p.state,
      resolveAfter: g.resolve,
      uses: g.resolveUses,
    };

    // If the second connected light breaks poise, the earned Execute must
    // outrank the still-valid mixed route instead of resolving as Sunder.
    ({ p, b } = setArena());
    g.tutorialStage = 'done';
    g.tutorialT = 0;
    g.hintT = 0;
    g.resolve = 100;
    perform('light');
    b.poise = 10;
    perform('light');
    g.hintT = 4;
    const executeRouteText = renderText();
    const executeRouteLabels = executeRouteText.map(({ text }) => text);
    const executeRouteCombat = g.uiSnapshot().combat;
    const executeRouteStartHp = b.hp;
    const executeRouteStates = perform('heavy');
    const postExecuteText = renderText();
    const postExecuteCombat = g.uiSnapshot().combat;
    const executeOverSunder = {
      staggeredAfterSecondContact: b.state === 'staggered',
      centralExecuteReady: executeRouteText.some(
        (entry) => entry.text === 'EXECUTE READY · TAP HVY'
          && isCentralFeedback(entry),
      ),
      semanticExecuteReady: executeRouteCombat.technique === 'Execute ready',
      semanticGracebreakReady: executeRouteCombat.resolveReady,
      resolveFullLabel: executeRouteLabels.includes('RESOLVE FULL'),
      showedBreakReady: executeRouteLabels.includes('BREAK READY'),
      showedGracebreakHint: executeRouteLabels.some((label) => label.includes('GRACEBREAK')),
      showedSunderHint: executeRouteLabels.some((label) => label.includes('SUNDER')),
      showedSunderReady: executeRouteLabels.some((label) => label.includes('SUNDER READY')),
      executeButton: executeRouteText.some((entry) => isHeavyButtonLabel(entry, 'EXECUTE')),
      sawHeavy: executeRouteStates.includes('heavy'),
      sawSunder: executeRouteStates.includes('sunder'),
      executeConsumed: b.executeConsumed,
      damage: executeRouteStartHp - b.hp,
      routeCleared: p.routeLightHits === 0 && p.sunderWindow === 0 && !p.sunderQueued,
      postExecuteTechnique: postExecuteCombat.technique,
      postSemanticGracebreakReady: postExecuteCombat.resolveReady,
      postResolveFullLabel: postExecuteText.some(({ text }) => text === 'RESOLVE FULL'),
      postShowedBreakReady: postExecuteText.some(({ text }) => text === 'BREAK READY'),
      postShowedGracebreakHint: postExecuteText.some(({ text }) => text.includes('GRACEBREAK')),
      postShowedSunderHint: postExecuteText.some(({ text }) => text.includes('SUNDER')),
      postExecuteReady: postExecuteText.some(
        (entry) => entry.text === 'EXECUTE READY · TAP HVY'
          && isCentralFeedback(entry),
      )
        || postExecuteCombat.technique === 'Execute ready',
      postExecuteButton: postExecuteText.some((entry) => isHeavyButtonLabel(entry, 'EXECUTE')),
      postBreakButton: postExecuteText.some((entry) => isHeavyButtonLabel(entry, 'BREAK')),
      postSunderButton: postExecuteText.some((entry) => isHeavyButtonLabel(entry, 'SUNDER')),
      postHeavyButton: postExecuteText.some((entry) => isHeavyButtonLabel(entry, 'HVY')),
    };
    const postExecuteHeavyStart = {
      hp: b.hp,
      resolve: g.resolve,
      uses: g.resolveUses,
    };
    const postExecuteHeavyStates = perform('heavy');
    executeOverSunder.postExecuteHeavy = {
      sawHeavy: postExecuteHeavyStates.includes('heavy'),
      sawSunder: postExecuteHeavyStates.includes('sunder'),
      damage: postExecuteHeavyStart.hp - b.hp,
      resolve: g.resolve,
      uses: g.resolveUses,
    };
    b.state = 'recover';
    b.t = 99;
    const afterStaggerText = renderText();
    const afterStaggerCombat = g.uiSnapshot().combat;
    executeOverSunder.afterStagger = {
      semanticGracebreakReady: afterStaggerCombat.resolveReady,
      breakReadyLabel: afterStaggerText.some(({ text }) => text === 'BREAK READY'),
      breakButton: afterStaggerText.some((entry) => isHeavyButtonLabel(entry, 'BREAK')),
      gracebreakHint: afterStaggerText.some(({ text }) => text.includes('GRACEBREAK')),
    };

    // Execute can naturally cross the Resolve cap. The stored meter may become
    // full, but its Break action must not overwrite Execute authority.
    ({ p, b } = setArena());
    g.tutorialStage = 'done';
    g.tutorialT = 0;
    g.hintT = 4;
    g.resolve = 89;
    b.state = 'staggered';
    b.t = 99;
    b.executeConsumed = false;
    const executeFillStartHp = b.hp;
    const executeFillStates = perform('heavy');
    const executeFillText = renderText();
    const executeFillLabels = executeFillText.map(({ text }) => text);
    const executeFillCombat = g.uiSnapshot().combat;
    const executeFill = {
      sawHeavy: executeFillStates.includes('heavy'),
      executeConsumed: b.executeConsumed,
      damage: executeFillStartHp - b.hp,
      resolve: g.resolve,
      technique: executeFillCombat.technique,
      status: g.uiSnapshot().status,
      semanticGracebreakReady: executeFillCombat.resolveReady,
      centralExecute: executeFillText.some(
        (entry) => entry.text === 'EXECUTE' && isCentralFeedback(entry),
      ),
      resolveFullLabel: executeFillLabels.includes('RESOLVE FULL'),
      showedBreakReady: executeFillLabels.includes('BREAK READY'),
      showedGracebreakHint: executeFillLabels.some((label) => label.includes('GRACEBREAK')),
      heavyButton: executeFillText.some((entry) => isHeavyButtonLabel(entry, 'HVY')),
    };

    // Sunder remains the connected action, but if its poise packet creates a
    // stagger, the newly earned Execute opportunity owns every next-action
    // surface immediately.
    ({ p, b } = setArena());
    g.tutorialStage = 'done';
    g.tutorialT = 0;
    g.hintT = 0;
    perform('light');
    perform('light');
    b.poise = 20;
    const sunderStaggerStates = perform('heavy');
    const sunderStaggerText = renderText();
    const sunderStaggerAuthority = {
      sawSunder: sunderStaggerStates.includes('sunder'),
      bossState: b.state,
      technique: g.uiSnapshot().combat.technique,
      centralExecuteReady: sunderStaggerText.some(
        (entry) => entry.text === 'EXECUTE READY · TAP HVY'
          && isCentralFeedback(entry),
      ),
      executeButton: sunderStaggerText.some((entry) => isHeavyButtonLabel(entry, 'EXECUTE')),
      staleSunderBanner: sunderStaggerText.some(
        (entry) => entry.text === 'SUNDER' && isCentralFeedback(entry),
      ),
    };

    // A poise break owns its complete punish opening even when the same hit
    // crosses a phase threshold. The existing ring transition begins exactly
    // once after the stagger expires.
    const phaseThresholdStagger = (phase) => {
      ({ p, b } = setArena());
      b.maxHp = 1000;
      b.hp = phase === 1 ? 560 : 230;
      b.phase = phase;
      b.phaseRoarDone = phase >= 2;
      b.phase3Done = false;
      b.maxPoise = 400;
      b.poise = 1;
      b.state = 'recover';
      b.t = 99;
      const expectedOpening = g.mods.staggerDuration;
      const transitionCalls = {
        setPhase: 0,
        phaseBanner: 0,
        staggerBanner: 0,
        deepenArena: 0,
        stampPhaseScars: 0,
      };
      const originalSetPhase = g.audio.setPhase;
      const originalBanner = g.banner;
      const originalDeepenArena = g.deepenArena;
      const originalStampPhaseScars = g.stampPhaseScars;
      g.audio.setPhase = (...args) => {
        transitionCalls.setPhase++;
        return originalSetPhase.apply(g.audio, args);
      };
      g.banner = (...args) => {
        if (args[1] === 'phase') transitionCalls.phaseBanner++;
        if (args[1] === 'stagger') transitionCalls.staggerBanner++;
        return originalBanner.apply(g, args);
      };
      g.deepenArena = (...args) => {
        transitionCalls.deepenArena++;
        return originalDeepenArena.apply(g, args);
      };
      g.stampPhaseScars = (...args) => {
        transitionCalls.stampPhaseScars++;
        return originalStampPhaseScars.apply(g, args);
      };
      try {
        b.takeDamage(20, g, p.x, p.y, 'heavy');
        const awarded = {
          phase: b.phase,
          state: b.state,
          opening: b.t,
          expectedOpening,
          executeReady: g.uiSnapshot().combat.technique,
        };
        b.update(1 / 60, g);
        const during = {
          phase: b.phase,
          state: b.state,
          remaining: b.t,
          executeReady: g.uiSnapshot().combat.technique,
        };
        let heldFrames = 1;
        while (b.state === 'staggered' && b.t > 1 / 60 && heldFrames < 240) {
          b.update(1 / 60, g);
          heldFrames++;
        }
        const beforeTransition = {
          phase: b.phase,
          state: b.state,
          remaining: b.t,
          heldFrames,
        };
        b.update(1 / 60, g);
        const transitioned = {
          phase: b.phase,
          state: b.state,
          attack: b.attack,
          phaseRoarDone: b.phaseRoarDone,
          phase3Done: b.phase3Done,
        };
        b.update(1 / 60, g);
        transitioned.stablePhase = b.phase;
        transitioned.calls = { ...transitionCalls };
        return { awarded, during, beforeTransition, transitioned };
      } finally {
        g.audio.setPhase = originalSetPhase;
        g.banner = originalBanner;
        g.deepenArena = originalDeepenArena;
        g.stampPhaseScars = originalStampPhaseScars;
      }
    };
    const phaseTwoStagger = phaseThresholdStagger(1);
    const phaseThreeStagger = phaseThresholdStagger(2);

    // One deliberate action survives the 320 ms wound recovery. A later ROLL
    // replaces an earlier attack because defense owns the priority lane.
    ({ p } = setArena());
    p.state = 'stagger'; p.t = 0.32;
    g.input.bufferPress('light');
    tick();
    const recoveryAttackQueued = p.recoveryAction;
    const recoveryAttackStates = [];
    for (let i = 0; i < 30; i++) {
      tick();
      recoveryAttackStates.push(p.state);
    }
    const recoveryAttack = {
      queued: recoveryAttackQueued,
      sawLight: recoveryAttackStates.includes('light'),
    };

    ({ p } = setArena());
    p.state = 'stagger'; p.t = 0.32;
    g.input.bufferPress('light');
    tick();
    g.input.bufferPress('roll');
    tick();
    const recoveryRollQueued = p.recoveryAction;
    const recoveryRollStates = [];
    for (let i = 0; i < 30; i++) {
      tick();
      recoveryRollStates.push(p.state);
    }
    const recoveryRoll = {
      queued: recoveryRollQueued,
      sawRoll: recoveryRollStates.includes('roll'),
      sawLight: recoveryRollStates.includes('light'),
    };

    // The named next action and the first-contact prompt are rendered from
    // combat-authoritative contact state.
    ({ p, b } = setArena());
    g.tutorialStage = 'done';
    g.tutorialT = 0;
    g.hintT = 0;
    perform('light');
    const firstContactLabels = renderLabels();
    perform('light');
    const sunderReadyLabels = renderLabels();
    const comboFeedback = {
      firstContact: firstContactLabels.some((label) => label.includes('1 HIT · LAND NEXT ATK')),
      sunderReady: sunderReadyLabels.some((label) => label.includes('SUNDER READY · TAP HVY')),
      sunderButton: sunderReadyLabels.includes('SUNDER'),
    };

    // Wound recovery exists only on disclosed beginner Journeys and caps at 12.
    setArena(-2);
    for (let i = 0; i < 6; i++) g.onPlayerWound();
    const journeyWounds = { resolve: g.resolve, fromWounds: g.resolveFromWounds };
    setArena(0);
    for (let i = 0; i < 6; i++) g.onPlayerWound();
    const measuredWounds = { resolve: g.resolve, fromWounds: g.resolveFromWounds };

    // FORSAKEN remains IRONBOUND even against the largest poise packet.
    ({ b } = setArena(5));
    b.poise = 40;
    b.takeDamage(72, g, 0, 0, 'gracebreak', 1);
    b.applyPoise(40, g);
    const ironbound = { state: b.state, noStagger: g.mods.noStagger, poise: b.poise };

    // The new rail remains in the protected player HUD and clear of utilities.
    setArena();
    g.resolve = 100;
    const hud = g.playerHudRect();
    const utilityTop = g.combatUtilityTop();
    const snapshot = g.uiSnapshot();
    g.render();
    const layout = {
      hud,
      utilityTop,
      hudClear: hud.y + hud.height <= utilityTop,
      resolvePercent: snapshot.combat.resolvePercent,
      resolveReady: snapshot.combat.resolveReady,
      technique: snapshot.combat.technique,
      hasAudioVerbs: [
        'sunderRelease', 'sunderHit', 'resolveReady', 'gracebreakRelease', 'gracebreakHit',
      ].every((key) => typeof g.audio[key] === 'function'),
    };

    Math.random = originalRandom;
    return {
      sunder, lightString, missRoute, rollPriority,
      gracebreak, whiff, partial, executePriority, interruptedTouchBreak,
      executeOverSunder, sunderStaggerAuthority, phaseTwoStagger, phaseThreeStagger,
      executeFill, recoveryAttack, recoveryRoll, comboFeedback,
      journeyWounds, measuredWounds, ironbound, layout,
    };
  });

  // Exercise the real mobile event route, then read React's live-region-adjacent
  // combat status. The canvas, semantic panel and resolved action must agree.
  const touchExecuteSetup = await mobile.page.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.raf = 0;
    g.grace = 0;
    g.resetFight();
    g.state = 'fight';
    g.stateT = 1;
    g.input.reset();
    g.input.isTouch = true;
    g.resolve = 100;
    g.tutorialStage = 'done';
    g.tutorialT = 0;
    g.hintT = 0;
    g.player.x = 0;
    g.player.y = 0;
    g.player.facing = 0;
    g.player.stam = 100;
    g.player.iframes = 999;
    g.boss.x = 145;
    g.boss.y = 0;
    g.boss.state = 'staggered';
    g.boss.t = 99;
    g.boss.executeConsumed = false;
    g.boss.hp = 9999;
    g.boss.maxHp = 9999;
    g.boss.poise = g.boss.maxPoise;
    g.render();
    g.paused = false;
    g.lastTs = performance.now();
    g.startLoop();
    g.uiChanged?.();
    return {
      button: g.touchLayout().btns.find((candidate) => candidate.id === 'heavy'),
      startHp: g.boss.hp,
      snapshotTechnique: g.uiSnapshot().combat.technique,
      snapshotResolveReady: g.uiSnapshot().combat.resolveReady,
    };
  });
  await mobile.page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('#game-combat-status > div')];
    const technique = rows.find((row) => row.querySelector('dt')?.textContent === 'Technique');
    const resolve = rows.find((row) => row.querySelector('dt')?.textContent === 'Resolve');
    return technique?.querySelector('dd')?.textContent === 'Execute ready'
      && resolve?.querySelector('dd')?.textContent === '100%';
  });
  const touchExecuteReadyDom = await mobile.page.evaluate(() => {
    const rows = [...document.querySelectorAll('#game-combat-status > div')];
    const technique = rows.find((row) => row.querySelector('dt')?.textContent === 'Technique');
    const resolve = rows.find((row) => row.querySelector('dt')?.textContent === 'Resolve');
    return {
      technique: technique?.querySelector('dd')?.textContent || '',
      resolve: resolve?.querySelector('dd')?.textContent || '',
    };
  });
  await mobile.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-real-tap-execute-ready.png'),
    fullPage: true,
  });
  await mobile.page.touchscreen.tap(touchExecuteSetup.button.x, touchExecuteSetup.button.y);
  await mobile.page.waitForFunction(() => window.__game?.boss.executeConsumed === true);
  await mobile.page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('#game-combat-status > div')];
    const technique = rows.find((row) => row.querySelector('dt')?.textContent === 'Technique');
    const resolve = rows.find((row) => row.querySelector('dt')?.textContent === 'Resolve');
    return technique?.querySelector('dd')?.textContent === 'EXECUTE'
      && resolve?.querySelector('dd')?.textContent === '100%';
  });
  const touchExecute = await mobile.page.evaluate((startHp) => {
    const g = window.__game;
    const rows = [...document.querySelectorAll('#game-combat-status > div')];
    const technique = rows.find((row) => row.querySelector('dt')?.textContent === 'Technique');
    const resolve = rows.find((row) => row.querySelector('dt')?.textContent === 'Resolve');
    const outcome = {
      executeConsumed: g.boss.executeConsumed,
      damage: startHp - g.boss.hp,
      resolve: g.resolve,
      uses: g.resolveUses,
      snapshotTechnique: g.uiSnapshot().combat.technique,
      domTechnique: technique?.querySelector('dd')?.textContent || '',
      snapshotResolveReady: g.uiSnapshot().combat.resolveReady,
      domResolve: resolve?.querySelector('dd')?.textContent || '',
    };
    cancelAnimationFrame(g.raf);
    g.raf = 0;
    return outcome;
  }, touchExecuteSetup.startHp);
  await mobile.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-real-tap-execute-hit.png'),
    fullPage: true,
  });

  // The visible touch button says BREAK at full Resolve. Exercise that exact
  // fingertip path: a tap must latch the existing 0.5 s charged release rather
  // than silently falling through to an ordinary quick heavy.
  const touchBreakSetup = await mobile.page.evaluate(() => {
    const g = window.__game;
    g.grace = 0;
    g.resetFight();
    g.state = 'fight';
    g.stateT = 1;
    g.input.reset();
    g.input.isTouch = true;
    g.resolve = 100;
    g.hintT = 4;
    g.tutorialStage = 'done';
    g.tutorialT = 0;
    g.player.x = 0;
    g.player.y = 0;
    g.player.facing = 0;
    g.player.stam = 100;
    g.player.iframes = 999;
    g.boss.x = 145;
    g.boss.y = 0;
    g.boss.state = 'recover';
    g.boss.t = 99;
    g.boss.hp = 9999;
    g.boss.maxHp = 9999;
    g.boss.poise = 400;
    g.boss.maxPoise = 400;
    const labels = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function capture(text, x, y, ...rest) {
      labels.push(String(text));
      return originalFillText.call(this, text, x, y, ...rest);
    };
    try {
      g.render();
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
    g.paused = false;
    g.lastTs = performance.now();
    g.startLoop();
    g.uiChanged?.();
    const button = g.touchLayout().btns.find((candidate) => candidate.id === 'heavy');
    return {
      button,
      readyCopy: labels.includes('FULL RESOLVE · TAP BREAK · GRACEBREAK'),
    };
  });
  await mobile.page.waitForTimeout(300);
  await mobile.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-break-tap-ready.png'),
    fullPage: true,
  });
  await mobile.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-resolve-ready.png'),
    fullPage: true,
  });
  await mobile.page.touchscreen.tap(touchBreakSetup.button.x, touchBreakSetup.button.y);
  await mobile.page.waitForTimeout(720);
  const touchBreakCharging = await mobile.page.evaluate(() => {
    const g = window.__game;
    return {
      state: g.player.state,
      charge: g.player.heavyChargeT,
      latched: g.player.gracebreakTouchLatch,
      resolve: g.resolve,
      uses: g.resolveUses,
    };
  });
  await mobile.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-break-tap-charging.png'),
    fullPage: true,
  });
  await mobile.page.waitForTimeout(600);
  const touchBreak = await mobile.page.evaluate(() => {
    const g = window.__game;
    const outcome = {
      state: g.player.state,
      charge: g.player.charge01,
      latched: g.player.gracebreakTouchLatch,
      resolve: g.resolve,
      uses: g.resolveUses,
      damage: g.boss.maxHp - g.boss.hp,
      technique: g.techniqueText,
    };
    cancelAnimationFrame(g.raf);
    g.raf = 0;
    return outcome;
  });
  await mobile.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-break-tap-released.png'),
    fullPage: true,
  });

  await mobile.page.evaluate(() => {
    const g = window.__game;
    g.grace = -2;
    g.resetFight();
    g.state = 'fight';
    g.stateT = 0;
    g.input.isTouch = true;
    g.tutorialStage = 'done';
    g.tutorialT = 0;
    g.hintT = 0;
    g.player.routeLightHits = 2;
    g.player.comboStep = 2;
    g.player.comboWindow = 0.6;
    g.player.sunderWindow = 0.6;
    g.playerChainHits = 2;
    g.playerChainT = 1;
    g.boss.state = 'recover';
    g.boss.t = 99;
    g.render();
  });
  await mobile.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-sunder-ready.png'),
    fullPage: true,
  });

  await mobile.page.evaluate(() => {
    const g = window.__game;
    g.boss.state = 'staggered';
    g.boss.t = 99;
    g.render();
  });
  await mobile.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-execute-ready.png'),
    fullPage: true,
  });

  const shortTouch = await openGame(browser, {
    viewport: { width: 360, height: 640 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const shortLayout = await shortTouch.page.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.raf = 0;
    g.audio.setMuted(true);
    g.input.isTouch = true;
    g.grace = -2;
    g.resetFight();
    g.state = 'fight';
    g.stateT = 0;
    g.baseZoom = 0.55;
    g.player.vx = 0;
    g.player.vy = 0;
    g.boss.state = 'windup';
    g.boss.attack = 'charge';
    g.tutorialStage = 'move';
    g.tutorialT = 4.5;
    g.hintT = 4;

    const targetY = g.combatCameraTargetY(g.player.y, g.boss.y);
    const zoom = g.combatZoomTarget();
    g.camX = 0;
    g.camY = targetY;
    g.camZoom = zoom;

    const labels = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function capture(text, x, y, ...rest) {
      labels.push(String(text));
      return originalFillText.call(this, text, x, y, ...rest);
    };
    try {
      g.render();
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }

    const utilityBottom = g.combatUtilityTop() + 44;
    const tutorial = g.combatTutorialLayout();
    const bossScreenY = innerHeight / 2 + (g.boss.y - targetY) * zoom;
    const playerScreenY = innerHeight / 2 + (g.player.y - targetY) * zoom;
    const bossTop = bossScreenY - g.boss.r * zoom;
    const bossBottom = bossScreenY + g.boss.r * zoom;
    const playerBottom = playerScreenY + g.player.r * zoom;
    const bossBarY = innerHeight - 248;
    const buttonTop = Math.min(...g.touchLayout().btns.map((button) => button.y - button.r));
    return {
      targetY,
      zoom,
      utilityBottom,
      tutorial,
      bossTop,
      bossBottom,
      playerBottom,
      bossBarY,
      buttonTop,
      labels,
      bossClear: bossTop >= utilityBottom,
      tutorialClearOfBoss: tutorial.y - 18 > bossBottom,
      playerClearOfBossBar: playerBottom < bossBarY,
      tutorialBetweenBossBarAndButtons:
        tutorial.y - 18 >= bossBarY + 18
        && tutorial.y + 12 < buttonTop,
      proactiveSunder: labels.some((label) => label.includes('HVY SUNDER')),
      duplicateControlHint: labels.some((label) => label.includes('hold BREAK for Gracebreak')),
    };
  });
  await shortTouch.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'short-360x640-opening.png'),
    fullPage: true,
  });

  const pauseLayout = await shortTouch.page.evaluate(() => {
    const g = window.__game;
    g.manualPaused = true;
    g.paused = true;
    const labels = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function capture(text, x, y, ...rest) {
      labels.push(String(text));
      return originalFillText.call(this, text, x, y, ...rest);
    };
    try {
      g.render();
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
    return {
      labels,
      lightRecipe: labels.includes('ATK ×3 · LIGHT FINISHER'),
      sunderRecipe: labels.includes('LAND ATK ×2 → HVY · SUNDER'),
      gracebreakRecipe: labels.includes('FULL RESOLVE · TAP BREAK · GRACEBREAK'),
    };
  });
  await shortTouch.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'short-360x640-pause-recipes.png'),
    fullPage: true,
  });

  const oathHud = await mobile.page.evaluate(() => {
    const g = window.__game;
    g.input.isTouch = true;
    g.grace = 5;
    g.resetFight();
    g.state = 'fight';
    g.stateT = 0;
    g.tutorialStage = 'done';
    g.tutorialT = 0;
    g.hintT = 0;
    g.boss.state = 'windup';
    g.boss.attack = 'charge';
    g.boss.chainTotal = 3;
    g.boss.chainStep = 2;

    const labels = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function capture(text, x, y, ...rest) {
      labels.push(String(text));
      return originalFillText.call(this, text, x, y, ...rest);
    };
    try {
      g.render();
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
    const chainLabels = labels.filter((label) => label.includes('OATH CHAIN'));
    const separateIronbound = labels.filter((label) => label.startsWith('IRONBOUND'));
    return {
      chainLabels,
      separateIronbound,
      combined: chainLabels.some((label) => label.includes('IRONBOUND')),
    };
  });
  await mobile.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-oath-chain-ironbound.png'),
    fullPage: true,
  });

  const desktop = await openGame(browser, {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const desktopLayout = await desktop.page.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.raf = 0;
    g.grace = 0;
    g.resetFight();
    g.state = 'fight';
    g.input.isTouch = false;
    g.resolve = 100;
    g.boss.state = 'recover';
    const labels = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function capture(text, x, y, ...rest) {
      labels.push(String(text));
      return originalFillText.call(this, text, x, y, ...rest);
    };
    try {
      g.render();
    } finally {
      CanvasRenderingContext2D.prototype.fillText = originalFillText;
    }
    const hud = g.playerHudRect();
    return {
      hud,
      contained: hud.x >= 0 && hud.y >= 0
        && hud.x + hud.width <= innerWidth
        && hud.y + hud.height <= innerHeight,
      snapshot: g.uiSnapshot().combat,
      labels,
      breakReadyLabel: labels.includes('BREAK READY'),
      breakReadyHint: labels.some((label) => label.includes('HOLD K: BREAK')),
    };
  });
  await desktop.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'desktop-resolve-ready.png'),
    fullPage: true,
  });

  // Exercise the authored desktop KeyK route against the same authority.
  const desktopExecuteSetup = await desktop.page.evaluate(() => {
    const g = window.__game;
    g.grace = 0;
    g.resetFight();
    g.state = 'fight';
    g.stateT = 1;
    g.input.reset();
    g.input.isTouch = false;
    g.resolve = 89;
    g.tutorialStage = 'done';
    g.tutorialT = 0;
    g.hintT = 0;
    g.player.x = 0;
    g.player.y = 0;
    g.player.facing = 0;
    g.player.stam = 100;
    g.player.iframes = 999;
    g.boss.x = 145;
    g.boss.y = 0;
    g.boss.state = 'staggered';
    g.boss.t = 99;
    g.boss.executeConsumed = false;
    g.boss.hp = 9999;
    g.boss.maxHp = 9999;
    g.boss.poise = g.boss.maxPoise;
    g.paused = false;
    g.lastTs = performance.now();
    g.startLoop();
    g.uiChanged?.();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    return {
      startHp: g.boss.hp,
      snapshotTechnique: g.uiSnapshot().combat.technique,
      snapshotResolveReady: g.uiSnapshot().combat.resolveReady,
    };
  });
  await desktop.page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('#game-combat-status > div')];
    const technique = rows.find((row) => row.querySelector('dt')?.textContent === 'Technique');
    const resolve = rows.find((row) => row.querySelector('dt')?.textContent === 'Resolve');
    return technique?.querySelector('dd')?.textContent === 'Execute ready'
      && resolve?.querySelector('dd')?.textContent === '89%';
  });
  const desktopExecuteReadyDom = await desktop.page.evaluate(() => {
    const rows = [...document.querySelectorAll('#game-combat-status > div')];
    const technique = rows.find((row) => row.querySelector('dt')?.textContent === 'Technique');
    const resolve = rows.find((row) => row.querySelector('dt')?.textContent === 'Resolve');
    return {
      technique: technique?.querySelector('dd')?.textContent || '',
      resolve: resolve?.querySelector('dd')?.textContent || '',
    };
  });
  await desktop.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'desktop-key-k-execute-ready.png'),
    fullPage: true,
  });
  await desktop.page.keyboard.press('k');
  await desktop.page.waitForFunction(() => window.__game?.boss.executeConsumed === true);
  await desktop.page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('#game-combat-status > div')];
    const technique = rows.find((row) => row.querySelector('dt')?.textContent === 'Technique');
    const resolve = rows.find((row) => row.querySelector('dt')?.textContent === 'Resolve');
    const status = document.querySelector('#game-status')?.textContent;
    return technique?.querySelector('dd')?.textContent === 'EXECUTE'
      && resolve?.querySelector('dd')?.textContent === '100%'
      && status === 'Battle in progress, phase 1. MALAKAR STAGGERED. Resolve full';
  });
  const desktopExecute = await desktop.page.evaluate((startHp) => {
    const g = window.__game;
    const rows = [...document.querySelectorAll('#game-combat-status > div')];
    const technique = rows.find((row) => row.querySelector('dt')?.textContent === 'Technique');
    const resolve = rows.find((row) => row.querySelector('dt')?.textContent === 'Resolve');
    const status = document.querySelector('#game-status');
    const outcome = {
      executeConsumed: g.boss.executeConsumed,
      damage: startHp - g.boss.hp,
      resolve: g.resolve,
      uses: g.resolveUses,
      snapshotTechnique: g.uiSnapshot().combat.technique,
      domTechnique: technique?.querySelector('dd')?.textContent || '',
      snapshotResolveReady: g.uiSnapshot().combat.resolveReady,
      domResolve: resolve?.querySelector('dd')?.textContent || '',
      domStatus: status?.textContent || '',
      statusAriaLive: status?.getAttribute('aria-live') || '',
    };
    cancelAnimationFrame(g.raf);
    g.raf = 0;
    return outcome;
  }, desktopExecuteSetup.startHp);
  await desktop.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'desktop-key-k-execute-hit.png'),
    fullPage: true,
  });

  const failures = [];
  if (touchExecuteSetup.snapshotTechnique !== 'Execute ready'
    || touchExecuteSetup.snapshotResolveReady
    || touchExecuteReadyDom.technique !== 'Execute ready'
    || touchExecuteReadyDom.resolve !== '100%'
    || !touchExecute.executeConsumed
    || Math.abs(touchExecute.damage - 109.2) > 0.01
    || touchExecute.resolve !== 100
    || touchExecute.uses !== 0
    || touchExecute.snapshotTechnique !== 'EXECUTE'
    || touchExecute.domTechnique !== touchExecute.snapshotTechnique
    || touchExecute.snapshotResolveReady
    || touchExecute.domResolve !== '100%') {
    failures.push(`real touch Execute path disagreed with semantic status: ${JSON.stringify({
      setup: touchExecuteSetup,
      readyDom: touchExecuteReadyDom,
      outcome: touchExecute,
    })}`);
  }
  if (!touchBreakSetup.readyCopy
    || touchBreakCharging.state !== 'heavy'
    || !(touchBreakCharging.charge > 0 && touchBreakCharging.charge < 0.5)
    || !touchBreakCharging.latched
    || touchBreakCharging.resolve !== 100
    || touchBreakCharging.uses !== 0
    || touchBreak.state !== 'move'
    || touchBreak.charge !== 1
    || touchBreak.latched
    || touchBreak.resolve !== 0
    || touchBreak.uses !== 1
    || touchBreak.damage !== 72
    || touchBreak.technique !== 'GRACEBREAK') {
    failures.push(`touch BREAK tap did not own one charged Gracebreak: ${JSON.stringify({
      setup: touchBreakSetup,
      charging: touchBreakCharging,
      released: touchBreak,
    })}`);
  }
  if (!result.sunder.sawState
    || result.sunder.damage !== 50
    || result.sunder.poise !== 70
    || result.sunder.stamina !== 44
    || result.sunder.resolve !== 8
    || !result.sunder.routeCleared) {
    failures.push(`ATK ATK SUNDER contract failed: ${JSON.stringify(result.sunder)}`);
  }
  if (result.lightString.damage !== 50
    || result.lightString.poise !== 50
    || result.lightString.stamina !== 36
    || result.lightString.resolve !== 5) {
    failures.push(`three-light control route changed: ${JSON.stringify(result.lightString)}`);
  }
  if (result.missRoute.routeLightHits !== 0
    || result.missRoute.sunderWindow !== 0
    || result.missRoute.sawSunder
    || result.missRoute.chainBreakText !== 'CHAIN LOST · MISS'
    || !result.missRoute.chainBreakVisible) {
    failures.push(`missed contact unlocked Sunder: ${JSON.stringify(result.missRoute)}`);
  }
  if (result.rollPriority.state !== 'roll'
    || result.rollPriority.routeLightHits !== 0
    || result.rollPriority.sunderWindow !== 0) {
    failures.push(`roll did not own simultaneous priority: ${JSON.stringify(result.rollPriority)}`);
  }
  if (!result.gracebreak.sawHeavy
    || result.gracebreak.damage !== 72
    || result.gracebreak.poise !== 112
    || result.gracebreak.staminaAfter !== 94
    || result.gracebreak.resolveAfter !== 0
    || result.gracebreak.uses !== 1) {
    failures.push(`Gracebreak contract failed: ${JSON.stringify(result.gracebreak)}`);
  }
  if (result.whiff.damage !== 0 || result.whiff.resolveAfter !== 0 || result.whiff.uses !== 1) {
    failures.push(`Gracebreak whiff did not spend exactly once: ${JSON.stringify(result.whiff)}`);
  }
  if (!(result.partial.charge > 0 && result.partial.charge < 1)
    || result.partial.resolveAfter !== 100
    || result.partial.uses !== 0) {
    failures.push(`partial heavy consumed Resolve: ${JSON.stringify(result.partial)}`);
  }
  if (!result.executePriority.executeConsumed
    || result.executePriority.resolveAfter !== 100
    || result.executePriority.uses !== 0) {
    failures.push(`Execute did not outrank Gracebreak: ${JSON.stringify(result.executePriority)}`);
  }
  if (!result.interruptedTouchBreak.latchedBeforeDamage
    || result.interruptedTouchBreak.latchedAfterDamage
    || result.interruptedTouchBreak.state !== 'stagger'
    || result.interruptedTouchBreak.resolveAfter !== 100
    || result.interruptedTouchBreak.uses !== 0) {
    failures.push(`damage did not cancel touch BREAK safely: ${JSON.stringify(result.interruptedTouchBreak)}`);
  }
  if (!result.executeOverSunder.staggeredAfterSecondContact
    || !result.executeOverSunder.centralExecuteReady
    || !result.executeOverSunder.semanticExecuteReady
    || result.executeOverSunder.semanticGracebreakReady
    || !result.executeOverSunder.resolveFullLabel
    || result.executeOverSunder.showedBreakReady
    || result.executeOverSunder.showedGracebreakHint
    || result.executeOverSunder.showedSunderHint
    || result.executeOverSunder.showedSunderReady
    || !result.executeOverSunder.executeButton
    || !result.executeOverSunder.sawHeavy
    || result.executeOverSunder.sawSunder
    || !result.executeOverSunder.executeConsumed
    || result.executeOverSunder.damage < 100
    || !result.executeOverSunder.routeCleared
    || result.executeOverSunder.postExecuteReady
    || result.executeOverSunder.postExecuteButton
    || result.executeOverSunder.postBreakButton
    || result.executeOverSunder.postSunderButton
    || !result.executeOverSunder.postHeavyButton
    || result.executeOverSunder.postSemanticGracebreakReady
    || !result.executeOverSunder.postResolveFullLabel
    || result.executeOverSunder.postShowedBreakReady
    || result.executeOverSunder.postShowedGracebreakHint
    || result.executeOverSunder.postShowedSunderHint
    || !result.executeOverSunder.postExecuteHeavy.sawHeavy
    || result.executeOverSunder.postExecuteHeavy.sawSunder
    || Math.abs(result.executeOverSunder.postExecuteHeavy.damage - 42) > 0.01
    || result.executeOverSunder.postExecuteHeavy.resolve !== 100
    || result.executeOverSunder.postExecuteHeavy.uses !== 0
    || !result.executeOverSunder.afterStagger.semanticGracebreakReady
    || !result.executeOverSunder.afterStagger.breakReadyLabel
    || !result.executeOverSunder.afterStagger.breakButton
    || !result.executeOverSunder.afterStagger.gracebreakHint) {
    failures.push(`Sunder route stole stagger Execute: ${JSON.stringify(result.executeOverSunder)}`);
  }
  if (!result.executeFill.sawHeavy
    || !result.executeFill.executeConsumed
    || Math.abs(result.executeFill.damage - 109.2) > 0.01
    || result.executeFill.resolve !== 100
    || result.executeFill.technique !== 'EXECUTE'
    || !result.executeFill.status.includes('MALAKAR STAGGERED')
    || !result.executeFill.status.includes('Resolve full')
    || result.executeFill.status.includes('Resolve ready')
    || result.executeFill.semanticGracebreakReady
    || !result.executeFill.centralExecute
    || !result.executeFill.resolveFullLabel
    || result.executeFill.showedBreakReady
    || result.executeFill.showedGracebreakHint
    || !result.executeFill.heavyButton) {
    failures.push(`Execute-filled Resolve displaced stagger authority: ${JSON.stringify(result.executeFill)}`);
  }
  if (!result.sunderStaggerAuthority.sawSunder
    || result.sunderStaggerAuthority.bossState !== 'staggered'
    || result.sunderStaggerAuthority.technique !== 'Execute ready'
    || !result.sunderStaggerAuthority.centralExecuteReady
    || !result.sunderStaggerAuthority.executeButton
    || result.sunderStaggerAuthority.staleSunderBanner) {
    failures.push(`Sunder-created stagger did not yield one Execute truth: ${JSON.stringify(result.sunderStaggerAuthority)}`);
  }
  for (const [label, phaseResult, fromPhase, toPhase] of [
    ['phase two', result.phaseTwoStagger, 1, 2],
    ['phase three', result.phaseThreeStagger, 2, 3],
  ]) {
    if (phaseResult.awarded.phase !== fromPhase
      || phaseResult.awarded.state !== 'staggered'
      || phaseResult.awarded.executeReady !== 'Execute ready'
      || Math.abs(phaseResult.awarded.opening - phaseResult.awarded.expectedOpening) > 0.000001
      || phaseResult.during.phase !== fromPhase
      || phaseResult.during.state !== 'staggered'
      || phaseResult.during.executeReady !== 'Execute ready'
      || !(phaseResult.during.remaining < phaseResult.awarded.opening)
      || phaseResult.beforeTransition.phase !== fromPhase
      || phaseResult.beforeTransition.state !== 'staggered'
      || phaseResult.beforeTransition.heldFrames !== Math.ceil(phaseResult.awarded.expectedOpening * 60)
      || phaseResult.transitioned.phase !== toPhase
      || phaseResult.transitioned.stablePhase !== toPhase
      || phaseResult.transitioned.state !== 'windup'
      || phaseResult.transitioned.attack !== 'ring'
      || !phaseResult.transitioned.phaseRoarDone
      || (toPhase === 3 && !phaseResult.transitioned.phase3Done)
      || phaseResult.transitioned.calls.setPhase !== 1
      || phaseResult.transitioned.calls.phaseBanner !== 1
      || phaseResult.transitioned.calls.staggerBanner !== 1
      || phaseResult.transitioned.calls.deepenArena !== 1
      || phaseResult.transitioned.calls.stampPhaseScars !== 1) {
      failures.push(`${label} threshold stole or repeated stagger payoff: ${JSON.stringify(phaseResult)}`);
    }
  }
  if (result.recoveryAttack.queued !== 'light'
    || !result.recoveryAttack.sawLight
    || result.recoveryRoll.queued !== 'roll'
    || !result.recoveryRoll.sawRoll
    || result.recoveryRoll.sawLight) {
    failures.push(`wound recovery input contract failed: ${JSON.stringify({
      attack: result.recoveryAttack,
      roll: result.recoveryRoll,
    })}`);
  }
  if (!result.comboFeedback.firstContact
    || !result.comboFeedback.sunderReady
    || !result.comboFeedback.sunderButton) {
    failures.push(`combo route feedback is not actionable: ${JSON.stringify(result.comboFeedback)}`);
  }
  if (result.journeyWounds.resolve !== 12
    || result.journeyWounds.fromWounds !== 12
    || result.measuredWounds.resolve !== 0
    || result.measuredWounds.fromWounds !== 0) {
    failures.push(`Journey wound recovery leaked or exceeded cap: ${JSON.stringify({
      journey: result.journeyWounds,
      measured: result.measuredWounds,
    })}`);
  }
  if (!result.ironbound.noStagger || result.ironbound.state === 'staggered') {
    failures.push(`FORSAKEN was staggered by Gracebreak: ${JSON.stringify(result.ironbound)}`);
  }
  if (!result.layout.hudClear
    || result.layout.resolvePercent !== 100
    || !result.layout.resolveReady
    || !result.layout.hasAudioVerbs
    || !desktopLayout.contained
    || desktopLayout.snapshot.resolvePercent !== 100
    || !desktopLayout.breakReadyLabel
    || !desktopLayout.breakReadyHint) {
    failures.push(`Resolve HUD/audio acceptance failed: ${JSON.stringify({
      mobile: result.layout,
      desktop: desktopLayout,
    })}`);
  }
  if (!shortLayout.bossClear
    || !shortLayout.tutorialClearOfBoss
    || !shortLayout.playerClearOfBossBar
    || !shortLayout.tutorialBetweenBossBarAndButtons
    || !shortLayout.proactiveSunder
    || shortLayout.duplicateControlHint) {
    failures.push(`short-phone opening lanes overlap: ${JSON.stringify(shortLayout)}`);
  }
  if (!pauseLayout.lightRecipe || !pauseLayout.sunderRecipe || !pauseLayout.gracebreakRecipe) {
    failures.push(`pause technique reference is incomplete: ${JSON.stringify(pauseLayout)}`);
  }
  if (!oathHud.combined
    || oathHud.chainLabels.length !== 1
    || oathHud.separateIronbound.length !== 0) {
    failures.push(`Oath chain and IRONBOUND are not in one compact lane: ${JSON.stringify(oathHud)}`);
  }
  if (desktopExecuteSetup.snapshotTechnique !== 'Execute ready'
    || desktopExecuteSetup.snapshotResolveReady
    || desktopExecuteReadyDom.technique !== 'Execute ready'
    || desktopExecuteReadyDom.resolve !== '89%'
    || !desktopExecute.executeConsumed
    || Math.abs(desktopExecute.damage - 109.2) > 0.01
    || desktopExecute.resolve !== 100
    || desktopExecute.uses !== 0
    || desktopExecute.snapshotTechnique !== 'EXECUTE'
    || desktopExecute.domTechnique !== desktopExecute.snapshotTechnique
    || desktopExecute.snapshotResolveReady
    || desktopExecute.domResolve !== '100%'
    || desktopExecute.domStatus !== 'Battle in progress, phase 1. MALAKAR STAGGERED. Resolve full'
    || desktopExecute.statusAriaLive !== 'polite') {
    failures.push(`desktop K Execute path disagreed with semantic status: ${JSON.stringify({
      setup: desktopExecuteSetup,
      readyDom: desktopExecuteReadyDom,
      outcome: desktopExecute,
    })}`);
  }
  const errors = [...mobile.errors, ...shortTouch.errors, ...desktop.errors];
  if (errors.length) failures.push(`page errors: ${JSON.stringify(errors)}`);

  const out = {
    ok: failures.length === 0,
    nErrors: failures.length,
    failures,
    result,
    touchExecuteSetup,
    touchExecuteReadyDom,
    touchExecute,
    touchBreakSetup,
    touchBreakCharging,
    touchBreak,
    shortLayout,
    pauseLayout,
    oathHud,
    desktopLayout,
    desktopExecuteSetup,
    desktopExecuteReadyDom,
    desktopExecute,
    artifacts: ARTIFACT_DIR,
  };
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'result.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: out.ok, nErrors: out.nErrors, artifacts: ARTIFACT_DIR }));
  if (!out.ok) {
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  }
  await mobile.context.close();
  await shortTouch.context.close();
  await desktop.context.close();
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

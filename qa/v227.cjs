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

    const renderLabels = () => {
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
      return labels;
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

    // A partial heavy remains a normal heavy and preserves the earned meter.
    ({ p, b } = setArena());
    g.resolve = 100;
    g.input.held.heavy = true;
    g.input.bufferPress('heavy');
    while (p.state !== 'heavy' || p.heavyChargeT < 0.2) tick();
    g.input.held.heavy = false;
    while (!p.attackHit) tick();
    const partial = { charge: p.charge01, resolveAfter: g.resolve, uses: g.resolveUses };

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

    // If the second connected light breaks poise, the earned Execute must
    // outrank the still-valid mixed route instead of resolving as Sunder.
    ({ p, b } = setArena());
    g.tutorialStage = 'done';
    g.tutorialT = 0;
    g.hintT = 0;
    perform('light');
    b.poise = 10;
    perform('light');
    const executeRouteLabels = renderLabels();
    const executeRouteStartHp = b.hp;
    const executeRouteStates = perform('heavy');
    const executeOverSunder = {
      staggeredAfterSecondContact: executeRouteLabels.some((label) => label.includes('EXECUTE READY')),
      showedSunderReady: executeRouteLabels.some((label) => label.includes('SUNDER READY')),
      executeButton: executeRouteLabels.includes('EXECUTE'),
      sawHeavy: executeRouteStates.includes('heavy'),
      sawSunder: executeRouteStates.includes('sunder'),
      executeConsumed: b.executeConsumed,
      damage: executeRouteStartHp - b.hp,
      routeCleared: p.routeLightHits === 0 && p.sunderWindow === 0 && !p.sunderQueued,
    };

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
      gracebreak, whiff, partial, executePriority,
      executeOverSunder, recoveryAttack, recoveryRoll, comboFeedback,
      journeyWounds, measuredWounds, ironbound, layout,
    };
  });

  await mobile.page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mobile-resolve-ready.png'),
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
      gracebreakRecipe: labels.includes('FULL RESOLVE · HOLD HVY · GRACEBREAK'),
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

  const failures = [];
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
  if (!result.executeOverSunder.staggeredAfterSecondContact
    || result.executeOverSunder.showedSunderReady
    || !result.executeOverSunder.executeButton
    || !result.executeOverSunder.sawHeavy
    || result.executeOverSunder.sawSunder
    || !result.executeOverSunder.executeConsumed
    || result.executeOverSunder.damage < 100
    || !result.executeOverSunder.routeCleared) {
    failures.push(`Sunder route stole stagger Execute: ${JSON.stringify(result.executeOverSunder)}`);
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
  const errors = [...mobile.errors, ...shortTouch.errors, ...desktop.errors];
  if (errors.length) failures.push(`page errors: ${JSON.stringify(errors)}`);

  const out = {
    ok: failures.length === 0,
    nErrors: failures.length,
    failures,
    result,
    shortLayout,
    pauseLayout,
    oathHud,
    desktopLayout,
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

const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE_URL = process.env.GRACEFELL_URL || 'http://127.0.0.1:8492/';
const ARTIFACT_DIR = process.env.GRACEFELL_ARTIFACT_DIR
  || path.join(os.tmpdir(), 'gracefell-qa', 'v2.21');

(async () => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  const mechanics = await page.evaluate(() => {
    const g = window.__game;
    g.input.isTouch = true;
    if (g.leftHanded) g.toggleLeftHanded();
    const rightHanded = g.touchLayout();
    g.toggleLeftHanded();
    const leftHanded = g.touchLayout();
    const savedLeftHanded = JSON.parse(localStorage.getItem('gracefell') || '{}');

    g.resetFight();
    g.state = 'fight';
    g.player.x = 0; g.player.y = 0; g.player.facing = 0;
    g.boss.x = 205; g.boss.y = 0; g.boss.facing = 0;
    g.boss.hp = 9999; g.boss.maxHp = 9999; g.boss.state = 'recover'; g.boss.t = 99;
    g.input.bufferPress('roll');
    g.frame(1 / 60);
    const rollStarted = { state: g.player.state, iframes: g.player.iframes };
    g.input.bufferPress('light');
    for (let i = 0; i < 27; i++) g.frame(1 / 60);
    const rollSlash = {
      state: g.player.state,
      queued: g.player.rollSlashQueued,
      iframes: g.player.iframes,
      bossDamage: 9999 - g.boss.hp,
    };

    const sampleHeavy = (playerX) => {
      g.state = 'fight';
      g.player.x = playerX; g.player.y = 0;
      g.player.facing = playerX < 0 ? 0 : Math.PI;
      g.player.charge01 = 0;
      g.boss.x = 0; g.boss.y = 0; g.boss.facing = 0;
      g.boss.hp = 1000; g.boss.maxHp = 1000; g.boss.poise = 1000;
      g.boss.state = 'recover'; g.boss.t = 99;
      g.damageMix = { light: 0, heavy: 0, riposte: 0, flank: 0 };
      g.playerStrike(true);
      return { damage: 1000 - g.boss.hp, mix: { ...g.damageMix } };
    };
    const front = sampleHeavy(60);
    const rear = sampleHeavy(-60);

    g.state = 'fight';
    g.grace = 0; g.graceAtStart = 0; g.fightTime = 84;
    g.phaseEnteredAt = [0, 31, 62];
    g.lastHits = [{ source: 'swipe', at: 70 }, { source: 'ring', at: 81 }];
    g.damageMix = { light: 500, heavy: 300, riposte: 100, flank: 250 };
    g.hitsTaken = 2; g.perfectDodges = 3;
    g.boss.state = 'recover'; g.boss.hp = 1; g.boss.maxHp = 1350;
    g.boss.takeDamage(10, g, g.player.x, g.player.y, 'light');
    g.stateT = 5;
    g.uiChanged?.();
    return {
      rightHanded,
      leftHanded,
      savedVersion: savedLeftHanded.v,
      savedLeftHanded: savedLeftHanded.leftHanded,
      rollStarted,
      rollSlash,
      front,
      rear,
      chronicle: g.terminalChronicle(),
    };
  });

  if (mechanics.savedVersion !== 7 || mechanics.savedLeftHanded !== true) {
    errors.push(`left-handed save migration failed: ${JSON.stringify(mechanics)}`);
  }
  if (mechanics.rightHanded.joySide !== 'left' || mechanics.leftHanded.joySide !== 'right') {
    errors.push(`joystick side did not mirror: ${JSON.stringify(mechanics)}`);
  }
  const rightAtk = mechanics.rightHanded.btns.find((button) => button.id === 'light');
  const leftAtk = mechanics.leftHanded.btns.find((button) => button.id === 'light');
  if (!(rightAtk.x > 195 && leftAtk.x < 195)) {
    errors.push(`action cluster did not mirror: ${JSON.stringify({ rightAtk, leftAtk })}`);
  }
  if (mechanics.rollStarted.state !== 'roll' || mechanics.rollStarted.iframes <= 0
    || mechanics.rollSlash.state !== 'rollSlash') {
    errors.push(`roll slash did not preserve roll then chain: ${JSON.stringify(mechanics.rollSlash)}`);
  }
  if (Math.abs(mechanics.front.damage - 30) > 0.01
    || Math.abs(mechanics.rear.damage - 37.5) > 0.01
    || mechanics.rear.mix.flank <= 0
    || mechanics.front.mix.flank !== 0) {
    errors.push(`flank reward is not isolated to the rear arc: ${JSON.stringify({ front: mechanics.front, rear: mechanics.rear })}`);
  }

  await page.waitForSelector('.game-terminal-chronicle', { state: 'visible' });
  const terminal = await page.locator('.game-terminal-chronicle').boundingBox();
  if (!terminal || terminal.x < 0 || terminal.y < 0
    || terminal.x + terminal.width > 390 || terminal.y + terminal.height > 844) {
    errors.push(`terminal chronicle is clipped: ${JSON.stringify(terminal)}`);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'touch-victory-chronicle.png') });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'SHARE VICTORY' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const downloadBytes = downloadPath ? fs.statSync(downloadPath).size : 0;
  if (downloadBytes < 10000 || !download.suggestedFilename().endsWith('.png')) {
    errors.push(`victory PNG fallback is invalid: ${download.suggestedFilename()} (${downloadBytes} bytes)`);
  }

  const ascension = await page.evaluate(() => {
    const g = window.__game;
    const accepted = g.replayVictory(true);
    const save = JSON.parse(localStorage.getItem('gracefell') || '{}');
    return { accepted, state: g.state, grace: g.grace, graceAtStart: g.graceAtStart, saveGrace: save.grace };
  });
  if (!ascension.accepted || ascension.state !== 'intro' || ascension.grace !== 1 || ascension.saveGrace !== 1) {
    errors.push(`ascension did not advance exactly one step: ${JSON.stringify(ascension)}`);
  }

  await browser.close();
  const result = { ok: errors.length === 0, errors, mechanics, terminal, downloadBytes, ascension };
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ok: result.ok, nErrors: errors.length, artifacts: ARTIFACT_DIR }));
  if (errors.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

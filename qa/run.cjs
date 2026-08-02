const { spawn } = require('child_process');
const net = require('node:net');

// Keep automated QA isolated from the user's fixed 8491 preview/service.
// The QA port cannot be a fixed constant: the 849x block on the production
// box is allocated to other services (rent=8492, howmuchlah=8493,
// paceplate=8495, paper-island=8496, gold=8497, alphabet-empire=8498,
// lifepath=8499), so a hardcoded default dies with EADDRINUSE before any
// check runs. Pick a free ephemeral port instead; an explicit
// GRACEFELL_QA_PORT override still wins, and GRACEFELL_URL skips the local
// server entirely (production QA).
function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

let PORT = null;
let BASE_URL = process.env.GRACEFELL_URL || '';
let server = null;

async function healthy() {
  try {
    const response = await fetch(new URL('/health', BASE_URL));
    const body = await response.json();
    return response.ok && body?.app === 'gracefell';
  } catch {
    return false;
  }
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await healthy()) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Gracefell server did not become healthy at ${BASE_URL}`);
}

function runScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      stdio: 'inherit',
      env: { ...process.env, GRACEFELL_URL: BASE_URL },
    });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`QA exited with code ${code}`)));
  });
}

(async () => {
  try {
    if (!BASE_URL) {
      PORT = process.env.GRACEFELL_QA_PORT
        ? Number(process.env.GRACEFELL_QA_PORT)
        : await findFreePort();
      BASE_URL = `http://127.0.0.1:${PORT}/`;
      console.log(`gracefell QA server on 127.0.0.1:${PORT}`);
    }
    if (!(await healthy())) {
      server = spawn(process.execPath, ['server.mjs'], {
        stdio: 'inherit',
        env: { ...process.env, PORT: String(PORT) },
      });
      await waitForServer();
    }
    await runScript('qa/verify.cjs');
    await runScript('qa/v221.cjs');
    await runScript('qa/v224.cjs');
    await runScript('qa/v227.cjs');
    await runScript('qa/perf.cjs');
    await runScript('qa/visual-upgrade.cjs');
  } finally {
    if (server) server.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

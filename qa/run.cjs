const { spawn } = require('child_process');

// Keep automated QA isolated from the user's fixed 8491 preview/service.
const PORT = Number(process.env.GRACEFELL_QA_PORT || 8492);
const BASE_URL = process.env.GRACEFELL_URL || `http://127.0.0.1:${PORT}/`;
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

function runVerify() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['qa/verify.cjs'], {
      stdio: 'inherit',
      env: { ...process.env, GRACEFELL_URL: BASE_URL },
    });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`QA exited with code ${code}`)));
  });
}

(async () => {
  try {
    if (!(await healthy())) {
      server = spawn(process.execPath, ['server.mjs'], {
        stdio: 'inherit',
        env: { ...process.env, PORT: String(PORT) },
      });
      await waitForServer();
    }
    await runVerify();
  } finally {
    if (server) server.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

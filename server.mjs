// gracefell — scaffolded by mcp-deploy new_app. Zero-dependency Node HTTP server.
// Binds 127.0.0.1:<PORT> (from .env). /health is always open; everything else is
// behind Basic auth iff BASIC_AUTH_PASS is set. Edit me, then: restart_service gracefell
import http from "node:http";

const PORT = Number(process.env.PORT || 8460);
const USER = process.env.BASIC_AUTH_USER || "";
const PASS = process.env.BASIC_AUTH_PASS || "";
const APP = "gracefell";

function authed(req) {
  if (!PASS) return true;
  const m = (req.headers.authorization || "").match(/^Basic (.+)$/);
  if (!m) return false;
  const [u, p] = Buffer.from(m[1], "base64").toString().split(":");
  return u === USER && p === PASS;
}

http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, app: APP, ts: new Date().toISOString() }));
    return;
  }
  if (!authed(req)) {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="' + APP + '"' });
    res.end("auth required");
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end('<!doctype html><meta charset=utf-8><title>' + APP + '</title>' +
    '<body style="font:16px/1.6 system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;color:#1a1a1a">' +
    '<h1>' + APP + '</h1>' +
    '<p>Scaffolded by <code>new_app</code> and live. Edit <code>server.mjs</code>, then run <code>restart_service ' + APP + '</code>.</p>' +
    '<p>Health: <a href="/health">/health</a></p></body>');
}).listen(PORT, "127.0.0.1", () => console.log(APP + " listening on 127.0.0.1:" + PORT));

// gracefell — static server for the built Vite app (dist/)
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 8491);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const url = requestUrl.pathname;
  if (url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', ...SECURITY });
    res.end(JSON.stringify({ ok: true, app: 'gracefell' }));
    return;
  }
  let path = normalize(url).replace(/^(\.\.[/\\])+/, '');
  if (path === '/' || path === '\\') path = '/index.html';
  let file = join(DIST, path);
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
    const staticNamespace = url.startsWith('/assets/')
      || url.startsWith('/audio/')
      || url.startsWith('/art/');
    if (staticNamespace) {
      res.writeHead(404, {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store, max-age=0',
        ...SECURITY,
      });
      res.end('not found');
      return;
    }
    file = join(DIST, 'index.html'); // SPA fallback
  }
  const ext = extname(file);
  // Classify caching from the URL path, not the platform-normalized filesystem path.
  // On Windows, path.normalize() changes "/" to "\", which previously made
  // real /assets/, /audio/, and versioned /art/ requests keep immutable caching.
  const immutable = url.startsWith('/assets/')
    || url.startsWith('/audio/')
    || (url.startsWith('/art/') && Boolean(requestUrl.searchParams.get('v')));
  const unversionedArt = url.startsWith('/art/') && !immutable;
  try {
    const body = readFileSync(file);
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      // Cloudflare's default four-hour Browser Cache TTL can raise `no-cache`
      // on static extensions to max-age=14400. Unversioned art is a debug and
      // fallback path, so make its non-retention contract explicit at both the
      // browser and CDN layers. Runtime art always uses a versioned URL.
      'cache-control': immutable
        ? 'public, max-age=31536000, immutable'
        : unversionedArt
          ? 'no-store, max-age=0'
          : 'no-cache',
      ...(unversionedArt ? { 'cloudflare-cdn-cache-control': 'no-store' } : {}),
      ...SECURITY,
    });
    res.end(body);
  } catch {
    res.writeHead(500); res.end('error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`gracefell listening on 127.0.0.1:${PORT}`);
});

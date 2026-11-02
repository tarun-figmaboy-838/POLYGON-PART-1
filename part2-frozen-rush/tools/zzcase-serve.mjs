// THE GAME, SERVED WITH STRICT PATH CASE — what Linux does, on Windows.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', 'game');
const PORT = Number(process.argv[2] || 8321);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2'
};

const listings = new Map();
async function entries(dir) {
  let e = listings.get(dir);
  if (!e) { e = new Set(await readdir(dir)); listings.set(dir, e); }
  return e;
}

/** The path, if every segment matches a real entry with exactly that case. */
async function exactPath(segments) {
  let dir = ROOT;
  for (let i = 0; i < segments.length; i++) {
    const name = segments[i];
    if (!name || name === '.' || name === '..') return null;   // no climbing out
    let have = await entries(dir);
    if (!have.has(name)) { listings.delete(dir); have = await entries(dir); }
    if (!have.has(name)) return null;
    dir = join(dir, name);
  }
  return dir;
}

const server = createServer(async (req, res) => {
  const fail = (code, why) => {
    res.writeHead(code, { 'Content-Type': 'text/plain' }).end(why);
  };
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const segments = path.split('/').filter(Boolean);
    const file = await exactPath(segments);
    if (!file) return fail(404, 'not found (exact case required): ' + path);
    if (!file.startsWith(ROOT + sep) && file !== ROOT) return fail(403, 'forbidden');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'public, max-age=60'
    });
    res.end(body);
  } catch (e) {
    fail(404, 'not found: ' + (e && e.message));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('game (strict case) on http://127.0.0.1:' + PORT);
});

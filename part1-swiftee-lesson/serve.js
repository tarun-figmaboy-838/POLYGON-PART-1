#!/usr/bin/env node
// serve.js — run the game locally.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.riv': 'application/octet-stream'
};

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'; }
  catch (e) { res.writeHead(400).end('bad request'); return; }
  const file = path.resolve(ROOT, rel);
  if ((file !== ROOT && !file.startsWith(ROOT + path.sep)) || /(^|[\\/])\.git([\\/]|$)/.test(rel)) { res.writeHead(403).end('forbidden'); return; }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found: /' + rel); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      // Sprite sheets are large and immutable; the source files are not.
      'Cache-Control': rel.indexOf('assets/') === 0 ? 'public, max-age=3600' : 'no-cache'
    });
    res.end(buf);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('  Swiftee & the Polygons  ->  http://localhost:' + PORT + '/');
});

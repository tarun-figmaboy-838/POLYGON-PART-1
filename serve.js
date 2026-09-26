#!/usr/bin/env node
/*!
 * serve.js — run the whole adventure locally: the home page and both parts.
 *
 *   npm start            then open the URL it prints
 *   node serve.js 8000   to choose the port
 *
 * Everything also opens straight off the disk (index.html, then either part),
 * but over file:// each game loses a little: Part 1 falls back to the browser's
 * voice, Part 2 plays without its music and recorded sounds. Served, both get
 * everything.
 *
 * Each part still has its own server for its own test runs
 * (part1-swiftee-lesson/serve.js, part2-frozen-rush/tools/serve.mjs); this one
 * is for playing the two together.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 8000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.riv': 'application/octet-stream'
};

// Code must never be served stale while it is being edited; the art is large
// and only changes with its filename (or its ?v= hash), so it may be kept.
const CODE = new Set(['.html', '.js', '.mjs', '.css', '.json']);

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''); }
  catch (e) { res.writeHead(400).end('bad request'); return; }

  let file = path.resolve(ROOT, rel);
  // inside this folder — not a sibling whose name merely starts the same —
  // and never the repository's history or anyone's installed packages
  if ((file !== ROOT && !file.startsWith(ROOT + path.sep)) ||
      /(^|[\\/])(\.git|node_modules)([\\/]|$)/.test(rel)) {
    res.writeHead(403).end('forbidden'); return;
  }

  fs.stat(file, (err, info) => {
    if (!err && info.isDirectory()) {
      // A folder without its slash would resolve every relative URL in its
      // page one level too high, so send the browser to the slashed form.
      if (rel && !rel.endsWith('/')) {
        res.writeHead(301, { Location: '/' + rel + '/' }).end(); return;
      }
      file = path.join(file, 'index.html');
    }
    fs.readFile(file, (err2, buf) => {
      if (err2) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found: /' + rel); return; }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'Content-Type': TYPES[ext] || 'application/octet-stream',
        'Content-Length': buf.length,
        'Cache-Control': CODE.has(ext) ? 'no-cache' : 'public, max-age=3600'
      });
      res.end(buf);
    });
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  Polygon Adventure  ->  http://localhost:' + PORT + '/');
  console.log('    Part 1  Swiftee & the Polygons   /part1-swiftee-lesson/');
  console.log('    Part 2  Frozen Rush              /part2-frozen-rush/game/');
  console.log('');
});

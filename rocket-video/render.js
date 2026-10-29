#!/usr/bin/env node
// Renders scene/index.html frame by frame with headless Chromium and encodes the result with ffmpeg.
//
//   node render.js                          full video → output/ax-2700.mp4
//   node render.js --stills 0,10,20,45      single frames → output/stills/
//   node render.js --from 0 --to 10 --scale 0.5 --out output/preview.mp4
//   node render.js --workers 3              split frames across parallel browsers
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = __dirname;
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const FPS = Number(args.fps || 30);
const SCALE = Number(args.scale || 1);
const WARMUP = 6; // seconds of particle simulation before a chunk starts

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'text/xml',
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function openScene(port) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: SCALE });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/scene/index.html`);
  const info = await page.evaluate(() => window.sceneReady);
  return { browser, page, info };
}

async function capture(page, t, file) {
  await page.evaluate((tt) => window.renderFrame(tt), t);
  await page.screenshot({ path: file, type: 'jpeg', quality: 94, timeout: 180000, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
}

async function renderRange(port, frames, dir, label) {
  const { browser, page } = await openScene(port);
  const first = frames[0];
  for (let f = Math.max(0, first - WARMUP * FPS); f < first; f++) await page.evaluate((tt) => window.simulate(tt), f / FPS);
  const t0 = Date.now();
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const file = path.join(dir, `f${String(f).padStart(5, '0')}.jpg`);
    await capture(page, f / FPS, file);
    if (i % 30 === 0) {
      const per = (Date.now() - t0) / (i + 1) / 1000;
      console.log(`${label} frame ${f} (${i + 1}/${frames.length}) ${per.toFixed(2)}s/frame, ~${((frames.length - i - 1) * per / 60).toFixed(1)} min left`);
    }
  }
  await browser.close();
}

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  try {
    if (args.stills) {
      const dir = path.join(ROOT, 'output', 'stills');
      fs.mkdirSync(dir, { recursive: true });
      const { browser, page, info } = await openScene(port);
      console.log('scene ready', info);
      const times = String(args.stills).split(',').map(Number);
      let simT = 0;
      for (const t of times) {
        // run the simulation up to t so particles look right
        for (; simT < t - 1 / FPS; simT += 1 / FPS) if (t - simT < Number(args.warm || 1.5)) await page.evaluate((tt) => window.simulate(tt), simT);
        simT = t;
        const file = path.join(dir, `still_${t.toFixed(2).padStart(6, '0')}.jpg`);
        await capture(page, t, file);
        console.log('wrote', file);
      }
      await browser.close();
      return;
    }
    const from = Number(args.from || 0), to = Number(args.to || 60);
    const out = path.join(ROOT, args.out || 'output/ax-2700.mp4');
    const dir = path.join(ROOT, 'output', 'frames');
    fs.mkdirSync(dir, { recursive: true });
    const all = [];
    for (let f = Math.round(from * FPS); f < Math.round(to * FPS); f++) {
      if (!args.force && fs.existsSync(path.join(dir, `f${String(f).padStart(5, '0')}.jpg`))) continue;
      all.push(f);
    }
    const W = Math.max(1, Number(args.workers || 1));
    const chunk = Math.ceil(all.length / W);
    await Promise.all(Array.from({ length: W }, (_, w) => all.slice(w * chunk, (w + 1) * chunk))
      .filter((c) => c.length).map((c, w) => renderRange(port, c, dir, `[w${w}]`)));
    // encode
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const list = path.join(dir, 'list.txt');
    const frames = [];
    for (let f = Math.round(from * FPS); f < Math.round(to * FPS); f++) frames.push(`file 'f${String(f).padStart(5, '0')}.jpg'\nduration ${1 / FPS}`);
    fs.writeFileSync(list, frames.join('\n') + '\n');
    const ff = ['-y', '-f', 'concat', '-safe', '0', '-i', list];
    if (args.audio) ff.push('-i', path.resolve(args.audio), '-shortest', '-c:a', 'aac', '-b:a', '192k');
    ff.push('-vf', `scale=1080:1920:flags=lanczos,format=yuv420p,fps=${FPS}`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', out);
    execFileSync('ffmpeg', ff, { stdio: 'inherit' });
    console.log('wrote', out);
  } finally {
    srv.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });

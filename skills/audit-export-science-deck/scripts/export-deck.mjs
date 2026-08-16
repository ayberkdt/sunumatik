#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function usage(code = 0) {
  console.log('Usage: node export-deck.mjs <deck.html> <output-dir> [--pdf <deck.pdf>] [--slide-selector <css>] [--server-root <dir>] [--browser-executable <path>]');
  console.log('  --server-root  HTTP kökü. Verilmezse deste kendi klasörünün dışına çıkan');
  console.log('                 (../) varlık yollarına göre otomatik seçilir.');
  process.exit(code);
}
const args = process.argv.slice(2);
if (args[0] === '--help') usage();
if (args.length < 2) usage(2);
const source = path.resolve(args[0]);
const outputDir = path.resolve(args[1]);
const valueAfter = (flag, fallback = null) => {
  const at = args.indexOf(flag);
  if (at < 0) return fallback;
  const value = args[at + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
  return value;
};
const pdfValue = valueAfter('--pdf');
const pdfFile = pdfValue ? path.resolve(pdfValue) : null;
const slideSelector = valueAfter('--slide-selector', '[data-slide], .slide, .reveal .slides > section');
const serverRootValue = valueAfter('--server-root');
const browserExecutable = valueAfter('--browser-executable');
if (!fs.existsSync(source) || path.extname(source).toLowerCase() !== '.html') throw new Error('Input must be an existing HTML file.');
fs.mkdirSync(outputDir, { recursive: true });

/* HTTP kökü. Deste kendi klasörünün dışındaki varlıkları (`../presets/...`)
   kullanabilir; kök deste klasörü olursa bu istekler 404 döner ve export sessizce
   boş sahnelerle çıkar. Kök, destedeki en derin `../` zincirini kapsayacak kadar
   yukarı taşınır. */
function escapeDepth(html) {
  let deepest = 0;
  for (const match of html.matchAll(/(?:src|href|data-src|data-embed|data-[a-z-]*-src)\s*=\s*["']((?:\.\.\/)+)/gi)) {
    deepest = Math.max(deepest, match[1].length / 3);
  }
  for (const match of html.matchAll(/(?:from|import)\s*["']((?:\.\.\/)+)/gi)) {
    deepest = Math.max(deepest, match[1].length / 3);
  }
  for (const match of html.matchAll(/url\(\s*["']?((?:\.\.\/)+)/gi)) {
    deepest = Math.max(deepest, match[1].length / 3);
  }
  return deepest;
}
const deckDirectory = path.dirname(source);
let root;
if (serverRootValue) {
  root = path.resolve(serverRootValue);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`--server-root is not a directory: ${root}`);
  if (deckDirectory !== root && !deckDirectory.startsWith(root + path.sep)) throw new Error('--server-root must contain the deck file.');
} else {
  const depth = escapeDepth(fs.readFileSync(source, 'utf8'));
  root = path.resolve(deckDirectory, ...Array.from({ length: depth }, () => '..'));
  if (depth) console.error(`Server root lifted ${depth} level(s) for out-of-folder assets: ${root}`);
}

let chromium;
try {
  const requireFromProject = createRequire(path.join(process.cwd(), 'package.json'));
  const playwrightEntry = requireFromProject.resolve('playwright');
  const playwright = await import(pathToFileURL(playwrightEntry).href);
  chromium = playwright.chromium ?? playwright.default?.chromium;
  if (!chromium) throw new Error('Playwright chromium export is unavailable.');
} catch {
  console.error('Playwright must resolve from the current project. Install it explicitly or run this command from a project that provides it.');
  process.exit(2);
}

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2' };
const missing = new Set();
const server = http.createServer((request, response) => {
  const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const candidate = path.resolve(root, `.${requested}`);
  if (!(candidate === root || candidate.startsWith(root + path.sep)) || !fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
    missing.add(requested);
    response.writeHead(404).end('Not found'); return;
  }
  response.writeHead(200, { 'Content-Type': types[path.extname(candidate).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(candidate).pipe(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch(browserExecutable ? { executablePath: path.resolve(browserExecutable) } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const relative = path.relative(root, source).split(path.sep).map(encodeURIComponent).join('/');
  await page.goto(`http://127.0.0.1:${port}/${relative}`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.complete ? null : new Promise(resolve => { image.onload = image.onerror = resolve; })));
    if (globalThis.MathJax?.startup?.promise) await globalThis.MathJax.startup.promise;
    document.documentElement.dataset.export = 'true';
    const style = document.createElement('style');
    style.textContent = '[data-export-hide], .controls, .progress { display:none !important; }';
    document.head.append(style);
  });
  const slides = page.locator(slideSelector);
  const count = await slides.count();
  if (!count) throw new Error(`No slides found with selector: ${slideSelector}`);
  const pngFiles = [];
  for (let index = 0; index < count; index += 1) {
    await page.evaluate(active => {
      if (globalThis.Reveal?.slide) globalThis.Reveal.slide(active);
    }, index);
    await slides.evaluateAll((elements, active) => elements.forEach((slide, i) => {
      slide.style.visibility = i === active ? 'visible' : 'hidden';
      slide.style.opacity = i === active ? '1' : '0';
      slide.style.pointerEvents = 'none';
    }), index);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const png = path.join(outputDir, `slide-${String(index + 1).padStart(3, '0')}.png`);
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width: 1920, height: 1080 }, animations: 'disabled' });
    pngFiles.push(png);
  }
  if (pdfFile) {
    const printPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const pages = pngFiles.map(file => `<section><img alt="" src="data:image/png;base64,${fs.readFileSync(file).toString('base64')}"></section>`).join('');
    await printPage.setContent(`<style>@page{size:16in 9in;margin:0}*{box-sizing:border-box}body{margin:0}section{break-after:page;width:16in;height:9in}img{display:block;width:100%;height:100%}</style>${pages}`);
    await printPage.pdf({ path: pdfFile, width: '16in', height: '9in', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    await printPage.close();
  }
  console.log(JSON.stringify({ slides: count, slideSelector, serverRoot: root, outputDir, pdf: pdfFile, missingAssets: [...missing] }, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
/* Eksik varlık sessiz kalmamalı: boş bir sahne ekran görüntüsünde "koyu ama
   düzgün" görünür, kırıklığı ancak sunumda fark edilir. */
if (missing.size) {
  console.error(`${missing.size} varlık sunucudan 404 döndü — export eksik:`);
  for (const item of missing) console.error(`  ${item}`);
  console.error('Kök yanlışsa --server-root ile açıkça verin.');
  process.exit(1);
}

// Plays all 10 levels in headless Chromium against dev.html (JS simulator).
// Usage: node tests/e2e.mjs   (needs playwright; set NODE_PATH if installed globally)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8137;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const errors = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/dev.html?level=1&unlock=1`);
await page.waitForFunction(() => window.__game && window.__game.state.level);
await page.click('#focus-overlay');
await page.waitForFunction(() => document.activeElement.id === 'game');

const wait = (ms) => page.waitForTimeout(ms);
const press = async (k) => { await page.keyboard.press(k); await wait(115); };
const state = () => page.evaluate(() => { const s = window.__game.state; return { world: s.vis.world, door: s.vis.door, slot: s.vis.slot, phase: s.phase, level: s.levelIndex + 1, pos: s.pos, seq: s.seq.join(',') }; });
const R = async (n) => { for (let i = 0; i < n; i++) await press('ArrowRight'); };
const L = async (n) => { for (let i = 0; i < n; i++) await press('ArrowLeft'); };
const D = async (n) => { for (let i = 0; i < n; i++) await press('ArrowDown'); };
const U = async (n) => { for (let i = 0; i < n; i++) await press('ArrowUp'); };
const skill = (k) => press(k).then(() => press('Space'));
const snake = async (...pre) => { for (const f of pre) await f(); };

const plays = {
  1: async () => { await skill('x'); await R(13); await D(2); await L(13); await D(2); await R(12); },
  2: async () => {
    await skill('h'); await R(13); await D(2); await L(9);
    for (let i = 0; i < 12; i++) {
      const s = await state();
      if (s.world === 'night') break;
      if (s.world === 'day') { await press('Space'); await R(1); await L(1); }
    }
    await L(4);
  },
  3: async () => { await R(13); await D(2); await L(5); await press('Space'); await L(2); await press('Space'); await L(6); },
  4: async () => { await press('Space'); await skill('s'); await R(13); await D(2); await L(13); },
  5: async () => { await press('Space'); await skill('s'); await press('Space'); await R(13); await D(2); await L(9); await skill('h'); await L(4); },
  6: async () => { await press('Space'); await skill('z'); await R(13); await D(2); await L(9); await skill('h'); await L(4); },
  7: async () => {
    await press('Space'); await skill('z'); await R(4); await skill('h'); await R(9); await D(2); await L(8);
    await skill('h'); await skill('z'); await L(2); await skill('h'); await L(3);
  },
  8: async () => { await R(13); await D(2); await L(9); await skill('x'); await skill('c'); await L(4); },
  9: async () => {
    await R(13); await D(2); await L(9);
    for (let i = 0; i < 12; i++) {
      await skill('h'); await skill('c'); await D(1);
      const s = await state();
      if (s.world === 'night' && s.door === 'open') break;
      await U(1);
    }
    await U(1); await L(4);
  },
  10: async () => {
    await press('h'); await press('Space'); await skill('s'); await R(4); await skill('s'); await skill('h');
    await R(9); await D(2); await L(7); await skill('c'); await L(6); await D(2); await R(1);
    await skill('h'); await skill('z'); await R(2); await skill('h'); await R(9);
  },
};

let failed = false;
for (let lv = 1; lv <= 10; lv++) {
  const before = await state();
  if (before.level !== lv) { console.log(`FAIL expected level ${lv}, on ${before.level}`); failed = true; break; }
  await plays[lv]();
  await wait(100);
  const after = await state();
  if (after.phase !== 'card') { console.log(`FAIL level ${lv} not complete`, after); failed = true; break; }
  console.log(`ok   level ${lv} completed`);
  if (lv === 1) await page.screenshot({ path: process.env.SHOT || '/tmp/qm-card.png' });
  await press('Enter');
}
if (!failed) {
  const s = await state();
  console.log('back at level', s.level, '(wraps to 1 after finale)');
}
await browser.close();
server.kill();
if (errors.length) { console.log('console errors:\n' + errors.join('\n')); process.exit(1); }
if (failed) process.exit(1);
console.log('e2e passed with no console errors');

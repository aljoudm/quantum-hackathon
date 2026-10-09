// Star gate and level unlocking, driven through the real menus (no dev unlock).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = spawn('python3', ['-m', 'http.server', '8140', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:8140/dev.html?notips=1');
await page.waitForSelector('button[data-action="start"]');
await page.click('button[data-action="start"]');
await page.click('button[data-action="begin"]');
await page.waitForFunction(() => window.__game.state.phase === 'play');
const S = (fn, arg) => page.evaluate(fn, arg);
const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(130); };

// finish tile with 0 stars: blocked
await S(() => { const s = window.__game.state; s.pos = { x: 2, y: 4 }; s.vx = 2; s.vy = 4; });
await key('ArrowLeft');
assert.equal(await S(() => window.__game.state.phase), 'play', 'finish must stay locked with 0 stars');
// 1 star: still blocked
await S(() => { const s = window.__game.state; s.starsGot = 1; s.pos = { x: 2, y: 4 }; s.vx = 2; s.vy = 4; });
await key('ArrowLeft');
assert.equal(await S(() => window.__game.state.phase), 'play', 'finish must stay locked with 1 star');
// level select: level 2 locked
await key('Escape');
await page.click('button[data-action="levels"]');
assert.equal(await page.locator('.lv.locked').count(), 19, '19 levels locked before clearing level 1');
await page.click('button[data-action="back"]');
await page.click('button[data-action="resume"]'); await page.waitForTimeout(150);
// 2 stars: finish opens and level 2 unlocks
await S(() => { const s = window.__game.state; s.starsGot = 2; s.goalLocked = false; s.pos = { x: 2, y: 4 }; s.vx = 2; s.vy = 4; });
await key('ArrowLeft');
assert.equal(await S(() => window.__game.state.phase), 'card', 'finish opens with 2 stars');
await page.click('button[data-action="levels"]');
assert.equal(await page.locator('.lv.locked').count(), 18, 'level 2 unlocked, 18 still locked');
assert.ok((await page.locator('.lv.cleared .lv-stars').first().innerText()).startsWith('★★☆'), 'cleared level shows its stars');
await page.screenshot({ path: process.env.SHOT || '/tmp/s2-levels.png' });
await page.click('button[data-action="level"][data-value="0"]');   // replay a cleared level
assert.equal(await S(() => window.__game.state.levelIndex), 0);
assert.equal(await S(() => window.__game.state.starsGot), 0, 'replay resets collected stars');
console.log('errors', errors);
assert.equal(errors.length, 0);
console.log('progress checks passed');
await browser.close(); server.kill();

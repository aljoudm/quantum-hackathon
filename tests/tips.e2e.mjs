// First-time element pop-ups, click-to-explain, and skipping.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = spawn('python3', ['-m', 'http.server', '8151', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:8151/dev.html?level=2');
await page.waitForFunction(() => window.__game && window.__game.state.level);
await page.click('#focus-overlay');
await page.waitForFunction(() => document.activeElement.id === 'game');
const phase = () => page.evaluate(() => window.__game.state.phase);
const title = () => page.evaluate(() => document.querySelector('#tip h3')?.textContent);
const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(150); };
// level 2 contains a gate, the Eye, a Night bridge, stars and the finish: the unseen ones queue up
assert.equal(await phase(), 'tip');
const seen = [];
for (let i = 0; i < 8 && (await phase()) === 'tip'; i++) { seen.push(await title()); await key('Enter'); }
console.log('shown:', seen.join(', '));
assert.ok(seen.includes('Ghost gate') && seen.includes('The Eye') && seen.includes('Night bridge'));
assert.equal(await phase(), 'play');
// restart: nothing shown again
await page.click('#btn-restart'); await page.waitForTimeout(300);
assert.equal(await phase(), 'play', 'tips are shown only once');
// click the Eye tile: the explanation returns
const pos = await page.evaluate(() => { const s = window.__game.state; const r = document.getElementById('game').getBoundingClientRect(); const ox = Math.floor((16 - s.grid.w) / 2), oy = Math.floor((10 - s.grid.h) / 2); let eye; s.grid.tiles.forEach((row, y) => row.forEach((c, x) => { if (c === 'E') eye = { x, y }; })); return { x: r.left + (ox + eye.x + 0.5) * 48 * r.width / 768, y: r.top + (oy + eye.y + 0.5) * 48 * r.height / 480 }; });
await page.mouse.click(pos.x, pos.y); await page.waitForTimeout(200);
assert.equal(await phase(), 'tip');
assert.equal(await title(), 'The Eye');
const shot = process.env.SHOT || '/tmp/tip.png';
await page.screenshot({ path: shot });
await key('Escape');
assert.equal(await phase(), 'play');
assert.deepEqual(errors, []);
console.log('tips checks passed');
await browser.close(); server.kill();

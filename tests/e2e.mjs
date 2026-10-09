// Plays all 20 levels in headless Chromium against dev.html (JS simulator).
// A solver-driven bot collects every star and reaches the finish, re-planning
// after each Eye because the outcome is random.
// Usage: node tests/e2e.mjs   (needs playwright; set PLAYWRIGHT_PATH if installed globally)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LEVELS } from '../game/levels.js';
import * as qsim from '../game/qsim.js';
import { parseLevel, tileAt } from '../game/world.js';
import { solve } from './solver.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8137;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const errors = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const START = Number(process.env.START_LEVEL || 1);
await page.goto(`http://127.0.0.1:${PORT}/dev.html?level=${START}&unlock=1&notips=1`);
await page.waitForFunction(() => window.__game && window.__game.state.level);
await page.click('#focus-overlay');
await page.waitForFunction(() => document.activeElement.id === 'game');

const wait = (ms) => page.waitForTimeout(ms);
const press = async (k) => { await page.keyboard.press(k); await wait(112); };
const snapshot = () => page.evaluate(() => {
  const s = window.__game.state;
  return { phase: s.phase, level: s.levelIndex + 1, x: s.pos.x, y: s.pos.y, seq: [...s.seq], left: s.stars.map((t) => [t.x, t.y]), got: s.starsGot, ch: s.chasers.map((c) => ({ x: c.x, y: c.y })), t: s.chaseT };
});

async function playLevel(n) {
  const level = LEVELS[n - 1];
  const grid = parseLevel(level);
  let replans = 0, caught = 0, lastGot = 0;
  for (;;) {
    const s = await snapshot();
    if (s.got < lastGot) caught++;
    lastGot = s.got;
    if (s.phase === 'card') return { ok: true, replans, got: s.got, caught };
    if (replans++ > 60) return { ok: false, why: 'too many replans' };
    let mask = 0;
    grid.stars.forEach((st, i) => { if (!s.left.some(([x, y]) => x === st.x && y === st.y)) mask |= 1 << i; });
    const plan = solve(level, { all: true, from: { x: s.x, y: s.y, mask, amps: qsim.getState(s.seq), ch: s.ch.length ? s.ch : null, t: s.t } });
    if (!plan) return { ok: false, why: `no plan from ${JSON.stringify(s)}` };
    for (const a of plan.actions) {
      if (a.type === 'use') { await press(a.char.toLowerCase()); await press('Space'); continue; }
      await press({ '1,0': 'ArrowRight', '-1,0': 'ArrowLeft', '0,1': 'ArrowDown', '0,-1': 'ArrowUp' }[`${a.dx},${a.dy}`]);
      const cur = await snapshot();
      if (cur.phase === 'card') break;
      const target = tileAt(grid, cur.x, cur.y);
      if (target === 'E') { await wait(60); break; } // random outcome: replan
    }
    await wait(80);
  }
}

let failed = false;
for (let lv = START; lv <= 20; lv++) {
  const before = await snapshot();
  if (before.level !== lv) { console.log(`FAIL expected level ${lv}, on ${before.level}`); failed = true; break; }
  const r = await playLevel(lv);
  if (!r.ok) { console.log(`FAIL level ${lv}: ${r.why}`); failed = true; break; }
  console.log(`ok   level ${lv} ${LEVELS[lv - 1].name}: ${r.got} stars, ${r.replans} plan(s)${r.caught ? ', caught ' + r.caught + 'x' : ''}`);
  if (lv === 1 && process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  await press('Enter');
}
await browser.close();
server.kill();
if (errors.length) { console.log('console errors:\n' + errors.join('\n')); process.exit(1); }
if (failed) process.exit(1);
console.log('e2e passed with no console errors');

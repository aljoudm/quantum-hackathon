// Game controller: state, input handling, quantum wiring, game loop.
import { LEVELS } from './levels.js';
import { parseLevel, tileAt, canEnter, nearDoor, deriveVisuals, blochVector, CHARACTERS } from './world.js';
import { createRenderer, tileRect } from './render.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createQuantum } from './quantum.js';
import { COMBOS, matchCombo, renderCircuit } from './combos.js';
import * as qsim from './qsim.js';
import { createScreens } from './screens.js';
import { HOWTO_HTML, CHAR_INFO, ELEMENTS, elementKey, charLine, worldLine, wheelLine, doorLine, changeLine } from './text.js';

export function startGame({ core = null, backend = null, doc = document, startLevel = 0, skipMenu = false, unlockAll = false, tips = true } = {}) {
  const canvas = doc.getElementById('game');
  const hud = createHud(doc, {
    onInfo: (k) => enqueue({ type: 'info', char: k }),
    onSelect: (k) => enqueue({ type: 'select', char: k }),
  });
  const quantum = createQuantum({ core, backend });
  const renderer = createRenderer(canvas);

  const S = {
    levelIndex: 0, level: null, grid: null, pos: { x: 1, y: 1 }, vx: 1, vy: 1, facing: 1, moving: false, walkFrame: 0, lastMove: 0,
    stars: [], starsGot: 0, need: 2, goalLocked: true, active: null, seq: [], history: [], bar: [], amps: qsim.getState([]), vis: deriveVisuals(qsim.getState([])),
    tipTile: null, tipQueue: [], phase: 'screen', screenFrom: 'menu', stack: [], hintTier: -1, stepIdx: 0, notebook: [], snapAt: -1e9,
  };
  const settings = { guide: true, calm: false, tips };
  const seenTips = new Set();
  const progress = { cleared: LEVELS.map(() => false), best: LEVELS.map(() => 0) };
  let firstRun = true;
  const unlocked = (i) => unlockAll || i === 0 || progress.cleared[i] || progress.cleared[i - 1];
  const highest = () => { const i = progress.cleared.indexOf(false); return i === -1 ? LEVELS.length - 1 : i; };
  const appEl = doc.getElementById('app');
  const applySettings = () => {
    appEl.classList.toggle('no-guide', !settings.guide);
    appEl.classList.toggle('calm', settings.calm);
  };
  const screenCtx = () => ({
    levels: LEVELS, unlocked, progress, settings, starTotals: LEVELS.map((l) => l.stars.length),
    anyCleared: progress.cleared.some(Boolean), howto: HOWTO_HTML, firstRun,
  });
  const screens = createScreens(doc, (a, v) => onAction(a, v));

  function openScreen(name, { push = true } = {}) {
    if (S.phase !== 'screen') { S.screenFrom = S.phase; S.stack = []; }
    else if (push && screens.current) S.stack.push(screens.current);
    S.phase = 'screen';
    screens.show(name, screenCtx());
  }
  function closeScreen() {
    screens.hide();
    S.stack = [];
    S.phase = S.screenFrom === 'card' ? 'card' : 'play';
  }
  function backScreen() {
    const prev = S.stack.pop();
    if (prev) screens.show(prev, screenCtx()); else closeScreen();
  }
  async function onAction(a, v) {
    switch (a) {
      case 'start':
        if (firstRun) { openScreen('howto'); break; }
        await loadLevel(highest()); break;
      case 'begin': firstRun = false; await loadLevel(highest()); break;
      case 'levels': openScreen('levels'); break;
      case 'settings': openScreen('settings'); break;
      case 'howto': openScreen('howto'); break;
      case 'back': backScreen(); break;
      case 'resume': closeScreen(); break;
      case 'retry': case 'replay': await loadLevel(S.levelIndex); break;
      case 'level': await loadLevel(Number(v)); break;
      case 'next': await loadLevel(Math.min(S.levelIndex + 1, LEVELS.length - 1)); break;
      case 'menu': S.screenFrom = S.phase === 'screen' ? S.screenFrom : S.phase; S.phase = 'screen'; S.stack = []; screens.show('menu', screenCtx()); break;
      case 'toggle': settings[v] = !settings[v]; applySettings(); screens.show('settings', screenCtx()); break;
      case 'reset':
        progress.cleared.fill(false); progress.best.fill(0); S.notebook = []; hud.setNotebookCount(0);
        screens.show('settings', screenCtx()); hud.toast('Progress reset.'); break;
      default: break;
    }
  }
  let queue = Promise.resolve();
  let pending = 0;

  const emit = (evt) => {
    const lv = S.level;
    if (lv.guidance === 'full' && lv.stepOn && lv.stepOn[S.stepIdx] === evt) {
      S.stepIdx = Math.min(S.stepIdx + 1, lv.steps.length);
      showSteps();
    }
  };
  function showSteps() {
    const lv = S.level;
    if (lv.guidance !== 'full') return;
    hud.setSteps(lv.steps, S.stepIdx);
  }

  function updateNow() {
    const hasDoor = S.grid && S.grid.tiles.some((r) => r.includes('M'));
    hud.setNow({
      char: charLine(S.active, S.level),
      world: worldLine(S.vis),
      wheel: wheelLine(S.vis),
      door: hasDoor || S.vis.door !== 'closed' ? doorLine(S.vis) : '',
    });
  }
  const notice = (text) => hud.setNow({ event: text });

  async function refresh() {
    const prev = S.vis;
    S.amps = await quantum.getState(S.seq);
    S.vis = deriveVisuals(S.amps);
    hud.setWheel(S.vis.slot, blochVector(S.amps));
    hud.setGhost(S.vis.world === 'ghost');
    hud.setBar(S.bar);
    updateNow();
    emit('world:' + S.vis.world);
    if (S.vis.slot !== null) emit('slot:' + S.vis.slot);
    if (S.vis.door === 'open' && prev.door !== 'open') emit('door:open');
  }

  // ---- element explanations ----
  function findElement(key) {
    // nearest instance of an element type to the start tile, as {x, y}
    const g = S.grid, st = g.start;
    let best = null;
    const consider = (x, y) => { const d = Math.abs(x - st.x) + Math.abs(y - st.y); if (!best || d < best.d) best = { x, y, d }; };
    if (key === 'star') S.stars.forEach((q) => consider(q.x, q.y));
    else if (key === 'chaser') (S.chasers || []).forEach((c) => consider(c.x, c.y));
    else g.tiles.forEach((row, y) => row.forEach((ch, x) => { if (elementKey(ch) === key) consider(x, y); }));
    return best;
  }
  function elementsInLevel() {
    const keys = new Set();
    S.grid.tiles.forEach((row) => row.forEach((ch) => { const k = elementKey(ch); if (k) keys.add(k); }));
    if (S.stars.length) keys.add('star');
    if (S.chasers && S.chasers.length) keys.add('chaser');
    const order = ['bridgeDay', 'bridgeNight', 'gate', 'eye', 'door', 'chaser', 'star', 'finish'];
    return order.filter((k) => keys.has(k));
  }
  function showTipFor(key) {
    const where = findElement(key);
    const e = ELEMENTS[key];
    if (!where || !e) return false;
    seenTips.add(key);
    S.tipTile = { x: where.x, y: where.y };
    const r = tileRect(S.grid, where.x, where.y);
    const k = stage.clientWidth / canvas.width;
    hud.showTip(`<h3>${e.title}</h3><p>${e.what}</p><p class="q"><b>In quantum computing:</b> ${e.quantum}</p>` +
      `<p class="small">Enter: ${S.tipQueue.length ? 'next' : 'close'}${S.tipQueue.length ? ' · Esc: skip' : ''}</p>`,
      { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k });
    return true;
  }
  function nextTip() {
    while (S.tipQueue.length) {
      const key = S.tipQueue.shift();
      if (showTipFor(key)) { S.phase = 'tip'; return; }
    }
    S.tipTile = null; hud.hideTip();
    if (S.phase === 'tip') S.phase = 'play';
  }
  function closeTips() { S.tipQueue = []; S.tipTile = null; hud.hideTip(); if (S.phase === 'tip') S.phase = 'play'; }

  async function loadLevel(i) {
    S.levelIndex = i;
    S.level = LEVELS[i];
    S.grid = parseLevel(S.level);
    S.pos = { ...S.grid.start };
    S.vx = S.pos.x; S.vy = S.pos.y;
    S.stars = S.grid.stars.map((st) => ({ ...st })); S.starsGot = 0; S.need = S.grid.need;
    S.goalLocked = S.need > 0;
    S.seq = []; S.history = []; S.bar = [];
    S.active = S.level.startActive === false ? null : S.level.chars[0];
    S.phase = 'play'; S.hintTier = -1; S.stepIdx = 0;
    screens.hide(); S.stack = [];
    hud.hideCard(); hud.hideNotebook();
    hud.setLevel(i + 1, LEVELS.length, S.level.name);
    hud.setChars(S.level.chars, S.active);
    hud.setNotebookCount(S.notebook.length);
    hud.setStars(0, S.stars.length, S.need);
    hud.setMission(S.level.goal, S.level.guidance === 'none' ? '' : S.level.why);
    hud.setNow({ event: '' });
    hud.setHint('', '');
    showSteps();
    await refresh();
    if (S.level.guidance === 'full' && S.active) emit('select:' + S.active);
    closeTips();
    if (settings.tips) { S.tipQueue = elementsInLevel().filter((k) => !seenTips.has(k)); if (doc.activeElement === canvas) nextTip(); }
  }

  const gateToken = (ch) => CHARACTERS[ch].gate;

  function addToken(t) {
    S.history.push({ t, before: { world: S.vis.world, door: S.vis.door } });
    S.bar.push(t);
  }

  function checkCombos() {
    const c = matchCombo(S.history);
    if (c && !S.notebook.some((n) => n.name === c.name)) {
      S.notebook.push(c);
      hud.flashCombo(c.name);
      hud.setNotebookCount(S.notebook.length);
    }
  }

  async function useSkill() {
    const ch = S.active;
    if (!ch) { hud.toast(`Pick a character first: press ${S.level.chars[0]}.`); return; }
    if (ch === 'C' && !nearDoor(S.grid, S.pos.x, S.pos.y)) { hud.toast('The Cat must stand next to a magic door.'); notice('The Cat needs to stand right next to a magic door before it can link it.'); return; }
    const g = gateToken(ch);
    addToken(g);
    S.seq.push(g);
    checkCombos();
    const prev = S.vis;
    await refresh();
    notice(changeLine(CHARACTERS[ch].name, g, prev, S.vis));
    emit('skill:' + ch);
  }

  async function eye() {
    if (S.vis.world !== 'ghost' && S.vis.door !== 'flicker') return; // nothing to measure: no job sent
    let bits;
    try { bits = await quantum.measure(S.seq); } catch (err) {
      console.warn('[game] measurement failed, sampling locally', err);
      bits = qsim.sample(S.amps);
    }
    addToken('EYE');
    checkCombos();
    const q0 = bits[bits.length - 1] === '1';
    const q1 = bits[bits.length - 2] === '1';
    S.seq = [];
    if (q0) S.seq.push('X');
    if (q1) S.seq.push('XD');
    S.bar = [];
    S.snapAt = performance.now();
    await refresh();
    notice(`The Eye measured: ${q0 ? 'Night' : 'Day'}${S.level.chars.includes('C') || q1 ? ` and the door is ${q1 ? 'open' : 'closed'}` : ''}. The ghost collapsed to one world.`);
    emit('eye');
  }

  function win() {
    S.phase = 'card';
    const lv = S.level;
    progress.cleared[S.levelIndex] = true;
    progress.best[S.levelIndex] = Math.max(progress.best[S.levelIndex], S.starsGot);
    const total = S.starsGot + S.stars.length;
    const starLine = Array.from({ length: total }, (_, k) => (k < S.starsGot ? '★' : '☆')).join('');
    const mine = renderCircuit(S.history.slice(-12).map((h) => h.t));
    const last = S.levelIndex === LEVELS.length - 1;
    hud.showCard(`<h2>Level ${lv.id} complete: ${lv.name} <span class="stars">${starLine}</span></h2>` +
      `<h3>What happened</h3><p>${lv.why}</p>` +
      `<h3>The concept</h3><p>${lv.card.text}</p><p class="term">${lv.card.term}</p>` +
      `<h3>Why it is useful</h3><p>${lv.card.useful}</p>` +
      `<div class="circuits"><div><div class="small">The idea</div><pre>${lv.card.circuit}</pre></div>` +
      `<div><div class="small">Your circuit</div><pre>${mine}</pre></div></div>` +
      `<div class="row">${last ? '' : '<button data-action="next">Next level</button>'}<button data-action="levels">Levels</button></div>` +
      `<p class="small">Enter: ${last ? 'play again' : 'next level'} · R: replay</p>`);
  }

  async function move(dx, dy) {
    const now = performance.now();
    if (now - S.lastMove < 90) return;
    S.lastMove = now;
    if (dx) S.facing = dx;
    const nx = S.pos.x + dx, ny = S.pos.y + dy;
    const ch = tileAt(S.grid, nx, ny);
    if (!canEnter(ch, S.vis)) return;
    S.pos = { x: nx, y: ny };
    S.moving = true; S.walkFrame++;
    emit('enter:' + ch);
    if (nearDoor(S.grid, nx, ny)) emit('near:door');
    const si = S.stars.findIndex((st) => st.x === nx && st.y === ny);
    if (si >= 0) {
      S.stars.splice(si, 1);
      S.starsGot++;
      S.goalLocked = S.starsGot < S.need;
      hud.setStars(S.starsGot, S.stars.length + S.starsGot, S.need);
      notice(S.goalLocked ? `Star ${S.starsGot}! Collect ${S.need - S.starsGot} more to unlock the finish.` : 'Star! The finish is unlocked: go to the big star.');
      hud.toast(S.goalLocked ? `Star! ${S.starsGot} collected, ${S.need - S.starsGot} more to unlock the finish.` : 'Star! The finish is unlocked.', 1800);
    }
    if (ch === 'E') await eye();
    else if (ch === 'G') {
      if (S.starsGot < S.need) hud.toast(`The finish needs ${S.need} stars. You have ${S.starsGot}.`, 2600);
      else { emit('goal'); win(); }
    }
  }

  async function handle(a) {
    if (S.phase === 'screen') {
      if (a.type === 'move') screens.nav(a.dx, a.dy);
      else if (a.type === 'confirm' || a.type === 'skill') screens.activate();
      else if (a.type === 'menu') {
        if (screens.current === 'pause') closeScreen();
        else if (screens.current !== 'menu') backScreen();
      }
      return;
    }
    if (S.phase === 'tip') {
      if (a.type === 'menu') closeTips();
      else if (a.type !== 'info' && a.type !== 'select') nextTip();
      return;
    }
    if (a.type === 'tipAt') { closeTips(); S.tipQueue = []; if (showTipFor(a.key)) S.phase = 'tip'; return; }
    if (S.phase === 'info') {
      if (['menu', 'confirm', 'info', 'skill'].includes(a.type)) { S.phase = S.infoFrom; hud.hideInfo(); }
      return;
    }
    if (a.type === 'info') {
      if (S.phase === 'notebook') { hud.hideNotebook(); }
      const c = CHAR_INFO[a.char];
      S.infoFrom = S.phase === 'card' ? 'card' : 'play';
      S.phase = 'info';
      hud.showInfo(`<h2>${CHARACTERS[a.char].name} · ${CHARACTERS[a.char].gate === 'CNOT' ? 'CNOT' : a.char} key</h2>` +
        `<p>${c.who}</p><p class="term">${c.gate}</p>` +
        `<p><b>In quantum computing:</b> ${c.quantum}</p><p><b>In this game:</b> ${c.game}</p>` +
        `<p><b>The maths:</b> <code>${c.math}</code></p><p class="small">Press Enter or Esc to close.</p>`);
      return;
    }
    if (a.type === 'menu') { openScreen('pause'); return; }
    if (S.phase === 'card') {
      if (a.type === 'confirm') await onAction(S.levelIndex === LEVELS.length - 1 ? 'replay' : 'next');
      else if (a.type === 'restart') await loadLevel(S.levelIndex);
      return;
    }
    if (a.type === 'notebook') {
      if (S.phase === 'notebook') { S.phase = 'play'; hud.hideNotebook(); } else { S.phase = 'notebook'; hud.showNotebook(S.notebook); }
      return;
    }
    if (S.phase === 'notebook') { if (a.type === 'confirm') { S.phase = 'play'; hud.hideNotebook(); } return; }
    switch (a.type) {
      case 'move': await move(a.dx, a.dy); break;
      case 'select':
        if (!S.level.chars.includes(a.char)) { hud.shake(a.char); break; }
        S.active = a.char; hud.setChars(S.level.chars, S.active); updateNow(); emit('select:' + a.char); break;
      case 'skill': await useSkill(); break;
      case 'hint':
        if (S.level.guidance === 'hints') {
          S.hintTier = Math.min(S.hintTier + 1, S.level.hints.length - 1);
          hud.setHint(`<div class="step now">💡 Hint ${S.hintTier + 1} of ${S.level.hints.length}: ${S.level.hints[S.hintTier]}</div>`, 'hint');
        }
        break;
      case 'restart': await loadLevel(S.levelIndex); break;
      default: break;
    }
  }

  function enqueue(a) {
    if (a.type === 'move' && pending > 2) return;
    pending++;
    queue = queue.then(() => handle(a)).catch((err) => console.error('[game] action failed', err)).finally(() => { pending--; });
  }
  createInput(canvas, enqueue);

  // focus handling: any click inside the game gives the canvas keyboard focus back
  const stage = doc.getElementById('stage');
  const refocus = () => setTimeout(() => canvas.focus(), 0);
  stage.addEventListener('mousedown', refocus);
  appEl.addEventListener('click', (e) => { if (e.target.closest('button')) refocus(); });
  canvas.addEventListener('focus', () => { hud.setFocusOverlay(false); if (S.phase === 'play' && S.tipQueue.length) nextTip(); });
  doc.getElementById('tip').addEventListener('click', () => { enqueue({ type: 'confirm' }); refocus(); });
  canvas.addEventListener('blur', () => hud.setFocusOverlay(true));
  hud.setFocusOverlay(doc.activeElement !== canvas);

  // click an element to read its explanation again
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (S.phase === 'tip') { enqueue({ type: 'confirm' }); return; }
    if (S.phase !== 'play') return;
    const ox = Math.floor((16 - S.grid.w) / 2), oy = Math.floor((10 - S.grid.h) / 2);
    const x = Math.floor(px / 48) - ox, y = Math.floor(py / 48) - oy;
    let key = null;
    if (S.stars.some((q) => q.x === x && q.y === y)) key = 'star';
    else if ((S.chasers || []).some((c) => c.x === x && c.y === y)) key = 'chaser';
    else key = elementKey(tileAt(S.grid, x, y));
    if (key) enqueue({ type: 'tipAt', key });
  });

  // card buttons, top bar buttons, settings dropdown
  doc.getElementById('card').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-action]');
    if (b) onAction(b.dataset.action, b.dataset.value);
  });
  doc.getElementById('btn-restart').addEventListener('click', () => { queue = queue.then(() => loadLevel(S.levelIndex)); });
  doc.getElementById('btn-settings').addEventListener('click', () => {
    if (S.phase === 'screen') { if (screens.current === 'pause') closeScreen(); else if (screens.current !== 'menu') openScreen('pause', { push: false }); return; }
    if (S.phase === 'notebook') { S.phase = 'play'; hud.hideNotebook(); }
    openScreen('pause');
  });

  // fit the stage to the free area (largest 16:10 rectangle), and the zoom button
  const area = doc.getElementById('stage-area');
  function fit() {
    const w = area.clientWidth, h = area.clientHeight;
    if (!w || !h) return;
    const ratio = canvas.width / canvas.height;
    const sw = Math.floor(Math.min(w, h * ratio));
    stage.style.width = sw + 'px';
    stage.style.height = Math.floor(sw / ratio) + 'px';
    stage.style.setProperty('--u', (sw / canvas.width).toFixed(3));
    if (typeof ResizeObserver === 'undefined') return;
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(area);
  window.addEventListener('resize', fit);
  doc.getElementById('btn-zoom').addEventListener('click', () => {
    appEl.classList.toggle('zoom');
    fit();
  });
  fit();

  function frame(t) {
    const k = 0.35;
    S.vx += (S.pos.x - S.vx) * k; S.vy += (S.pos.y - S.vy) * k;
    if (Math.abs(S.pos.x - S.vx) < 0.02 && Math.abs(S.pos.y - S.vy) < 0.02) { S.vx = S.pos.x; S.vy = S.pos.y; S.moving = false; }
    renderer.draw(S, t);
    requestAnimationFrame(frame);
  }

  applySettings();
  const ready = loadLevel(startLevel).then(() => {
    if (!skipMenu) { S.phase = 'screen'; S.screenFrom = 'play'; screens.show('menu', screenCtx()); }
    requestAnimationFrame(frame);
  });
  hud.setWheel(null);
  return { state: S, ready, quantum, loadLevel };
}

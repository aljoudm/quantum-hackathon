// Game controller: state, input handling, quantum wiring, game loop.
import { LEVELS } from './levels.js';
import { parseLevel, tileAt, canEnter, nearDoor, deriveVisuals, CHARACTERS } from './world.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createQuantum } from './quantum.js';
import { COMBOS, matchCombo, renderCircuit } from './combos.js';
import * as qsim from './qsim.js';

export function startGame({ core = null, backend = null, doc = document, startLevel = 0 } = {}) {
  const canvas = doc.getElementById('game');
  const hud = createHud(doc);
  const quantum = createQuantum({ core, backend });
  const renderer = createRenderer(canvas);

  const S = {
    levelIndex: 0, level: null, grid: null, pos: { x: 1, y: 1 }, vx: 1, vy: 1, facing: 1, moving: false, walkFrame: 0, lastMove: 0,
    active: null, seq: [], history: [], bar: [], amps: qsim.getState([]), vis: deriveVisuals(qsim.getState([])),
    phase: 'play', hintTier: -1, stepIdx: 0, notebook: [], snapAt: -1e9,
  };
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

  async function refresh() {
    const prev = S.vis;
    S.amps = await quantum.getState(S.seq);
    S.vis = deriveVisuals(S.amps);
    hud.setDoor(S.vis.door);
    hud.setWheel(S.vis.slot);
    hud.setBar(S.bar);
    emit('world:' + S.vis.world);
    if (S.vis.slot !== null) emit('slot:' + S.vis.slot);
    if (S.vis.door === 'open' && prev.door !== 'open') emit('door:open');
  }

  async function loadLevel(i) {
    S.levelIndex = i;
    S.level = LEVELS[i];
    S.grid = parseLevel(S.level);
    S.pos = { ...S.grid.start };
    S.vx = S.pos.x; S.vy = S.pos.y;
    S.seq = []; S.history = []; S.bar = [];
    S.active = S.level.startActive === false ? null : S.level.chars[0];
    S.phase = 'play'; S.hintTier = -1; S.stepIdx = 0;
    hud.hideCard();
    hud.setLevel(i + 1, LEVELS.length, S.level.name);
    hud.setChars(S.level.chars, S.active);
    hud.setNotebookCount(S.notebook.length);
    hud.setHint('', '');
    showSteps();
    await refresh();
    if (S.level.guidance === 'full' && S.active) emit('select:' + S.active);
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
    if (ch === 'C' && !nearDoor(S.grid, S.pos.x, S.pos.y)) { hud.toast('The Cat must stand next to a magic door.'); return; }
    const g = gateToken(ch);
    addToken(g);
    S.seq.push(g);
    checkCombos();
    await refresh();
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
    emit('eye');
  }

  function win() {
    S.phase = 'card';
    const lv = S.level;
    const mine = renderCircuit(S.history.slice(-12).map((h) => h.t));
    const last = S.levelIndex === LEVELS.length - 1;
    hud.showCard(`<h2>Level ${lv.id} complete: ${lv.name}</h2><p>${lv.card.text}</p><p class="term">${lv.card.term}</p>` +
      `<div class="circuits"><div><div class="small">The idea</div><pre>${lv.card.circuit}</pre></div>` +
      `<div><div class="small">Your circuit</div><pre>${mine}</pre></div></div>` +
      `<p class="small">Press Enter ${last ? 'to play again' : 'for the next level'}</p>`);
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
    if (ch === 'E') await eye();
    else if (ch === 'G') { emit('goal'); win(); }
  }

  async function handle(a) {
    if (S.phase === 'card') {
      if (a.type === 'confirm') {
        const next = S.levelIndex + 1;
        await loadLevel(next >= LEVELS.length ? 0 : next);
      } else if (a.type === 'restart') await loadLevel(S.levelIndex);
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
        S.active = a.char; hud.setChars(S.level.chars, S.active); emit('select:' + a.char); break;
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

  createInput(canvas, (a) => {
    if (a.type === 'move' && pending > 2) return;
    pending++;
    queue = queue.then(() => handle(a)).catch((err) => console.error('[game] action failed', err)).finally(() => { pending--; });
  });

  // focus overlay
  const stage = doc.getElementById('stage');
  stage.addEventListener('mousedown', () => setTimeout(() => canvas.focus(), 0));
  canvas.addEventListener('focus', () => hud.setFocusOverlay(false));
  canvas.addEventListener('blur', () => hud.setFocusOverlay(true));
  hud.setFocusOverlay(doc.activeElement !== canvas);

  function frame(t) {
    const k = 0.35;
    S.vx += (S.pos.x - S.vx) * k; S.vy += (S.pos.y - S.vy) * k;
    if (Math.abs(S.pos.x - S.vx) < 0.02 && Math.abs(S.pos.y - S.vy) < 0.02) { S.vx = S.pos.x; S.vy = S.pos.y; S.moving = false; }
    renderer.draw(S, t);
    requestAnimationFrame(frame);
  }

  const ready = loadLevel(startLevel).then(() => { requestAnimationFrame(frame); });
  hud.setWheel(null);
  return { state: S, ready, quantum, loadLevel };
}

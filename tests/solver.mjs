// Headless solver used by the level tests and the e2e bot. Measurement is
// treated optimistically: every possible outcome is explored, so the player
// can always "retry until it works". Chasers are simulated exactly as in the game.
import * as qsim from '../game/qsim.js';
import { parseLevel, tileAt, canEnter, nearDoor, deriveVisuals, CHARACTERS, chaserStep, chaseNext } from '../game/world.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ZERO = qsim.getState([]);
const bits = (m) => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };

const ampIds = new Map();
const ampKey = (amps) => amps.map(([a, b]) => `${a.toFixed(3)},${b.toFixed(3)}`).join('|');
function ampId(amps) {
  const k = ampKey(amps);
  let id = ampIds.get(k);
  if (id === undefined) { id = ampIds.size; ampIds.set(k, id); }
  return id;
}
const keyOf = (n) => `${n.x},${n.y},${n.mask},${ampId(n.amps)},${n.ch ? n.ch.map((c) => c.x + ':' + c.y).join(';') : ''},${n.t || 0}`;

export function basisState(i) {
  const a = [[0, 0], [0, 0], [0, 0], [0, 0]];
  a[i] = [1, 0];
  return a;
}

// Advance the chasers after the player moved to (x, y); returns null if the player is caught.
function afterMove(grid, node, x, y) {
  if (!grid.chasers.length) return { ch: null, t: 0 };
  let ch = node.ch;
  if (ch.some((c) => c.x === x && c.y === y)) return null;
  const { t, step } = chaseNext(grid.chase, node.t);
  if (step) {
    ch = ch.map((c) => chaserStep(grid, c, { x, y }));
    if (ch.some((c) => c.x === x && c.y === y)) return null;
  }
  return { ch, t };
}

// Expand every successor of a node. Calls out(next, action, won).
function successors(grid, chars, node, out) {
  const vis = deriveVisuals(node.amps);
  for (const [dx, dy] of DIRS) {
    const x = node.x + dx, y = node.y + dy, ch = tileAt(grid, x, y);
    if (!canEnter(ch, vis)) continue;
    const adv = afterMove(grid, node, x, y);
    if (!adv) continue;
    let mask = node.mask;
    const si = grid.stars.findIndex((s) => s.x === x && s.y === y);
    if (si >= 0) mask |= 1 << si;
    const action = { type: 'move', dx, dy };
    const base = { x, y, mask, ch: adv.ch, t: adv.t };
    if (ch === 'G') {
      out({ ...base, amps: node.amps }, action, true);
    } else if (ch === 'E' && (vis.world === 'ghost' || vis.door === 'flicker')) {
      const p = qsim.probabilities(node.amps);
      p.forEach((pi, i) => { if (pi > 1e-9) out({ ...base, amps: basisState(i) }, action, false); });
    } else out({ ...base, amps: node.amps }, action, false);
  }
  for (const c of chars) {
    if (c === 'C' && !nearDoor(grid, node.x, node.y)) continue;
    const amps = qsim.applyGate(node.amps, CHARACTERS[c].gate);
    out({ x: node.x, y: node.y, mask: node.mask, ch: node.ch, t: node.t, amps }, { type: 'use', char: c }, false);
  }
}

export function startNode(grid) {
  return { x: grid.start.x, y: grid.start.y, mask: 0, amps: ZERO, ch: grid.chasers.length ? grid.chasers.map((c) => ({ ...c })) : null, t: 0 };
}

// opts: { chars, from: {x,y,mask,amps,ch,t}, all: collect every star first }
export function solve(level, opts = {}) {
  const grid = parseLevel(level);
  const chars = opts.chars || level.chars;
  const total = grid.stars.length;
  const required = opts.all ? total : grid.need;
  const start = opts.from || startNode(grid);
  const seen = new Set([keyOf(start)]);
  const queue = [{ ...start, parent: null, action: null }];
  for (let qi = 0; qi < queue.length; qi++) {
    const node = queue[qi];
    let found = null;
    successors(grid, chars, node, (next, action, won) => {
      if (found) return;
      if (won) { if (bits(next.mask) >= required) found = { action, parent: node }; return; }
      const k = keyOf(next);
      if (seen.has(k)) return;
      seen.add(k);
      queue.push({ ...next, parent: node, action });
    });
    if (found) {
      const actions = [found.action];
      for (let n = found.parent; n && n.parent; n = n.parent) actions.push(n.action);
      return { actions: actions.reverse(), explored: queue.length };
    }
  }
  return null;
}

// Every reachable state must be able to finish (no soft-locks). Without
// chasers this must be exactly 0. With chasers, being caught restarts the
// level, so the useful check is that the start can still reach the finish.
export function softLocks(level, chars) {
  const grid = parseLevel(level);
  chars = chars || level.chars;
  const ids = new Map();
  const list = [];
  const rev = [];
  const winners = new Set();
  const idOf = (n) => {
    const k = keyOf(n);
    let id = ids.get(k);
    if (id === undefined) { id = list.length; ids.set(k, id); list.push(n); rev.push([]); }
    return id;
  };
  idOf(startNode(grid));
  for (let i = 0; i < list.length; i++) {
    successors(grid, chars, list[i], (next, action, won) => {
      if (won) { if (bits(next.mask) >= grid.need) winners.add(i); return; }
      const j = idOf(next);
      rev[j].push(i);
    });
  }
  const ok = new Set(winners);
  const stack = [...winners];
  while (stack.length) {
    const n = stack.pop();
    for (const p of rev[n]) if (!ok.has(p)) { ok.add(p); stack.push(p); }
  }
  return { states: list.length, stuck: list.length - ok.size };
}

// Which characters does the level need? (those whose removal makes it unsolvable)
export function neededChars(level) {
  return level.chars.filter((c) => !solve(level, { chars: level.chars.filter((x) => x !== c) }));
}

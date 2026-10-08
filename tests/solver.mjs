// Headless solver used by the level tests and the e2e bot. Measurement is
// treated optimistically: every possible outcome is explored, so the player
// can always "retry until it works".
import * as qsim from '../game/qsim.js';
import { parseLevel, tileAt, canEnter, nearDoor, deriveVisuals, CHARACTERS } from '../game/world.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ZERO = qsim.getState([]);
const keyOf = (x, y, mask, amps) =>
  `${x},${y},${mask}:` + amps.map(([a, b]) => `${a.toFixed(3)},${b.toFixed(3)}`).join('|');
const bits = (m) => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };

export function basisState(i) {
  const a = [[0, 0], [0, 0], [0, 0], [0, 0]];
  a[i] = [1, 0];
  return a;
}

// Expand every successor of a node. Calls out(next, action, won).
function successors(grid, chars, node, out) {
  const vis = deriveVisuals(node.amps);
  for (const [dx, dy] of DIRS) {
    const x = node.x + dx, y = node.y + dy, ch = tileAt(grid, x, y);
    if (!canEnter(ch, vis)) continue;
    let mask = node.mask;
    const si = grid.stars.findIndex((s) => s.x === x && s.y === y);
    if (si >= 0) mask |= 1 << si;
    const action = { type: 'move', dx, dy };
    if (ch === 'G') {
      out({ x, y, mask, amps: node.amps }, action, true);
    } else if (ch === 'E' && (vis.world === 'ghost' || vis.door === 'flicker')) {
      const p = qsim.probabilities(node.amps);
      p.forEach((pi, i) => { if (pi > 1e-9) out({ x, y, mask, amps: basisState(i) }, action, false); });
    } else out({ x, y, mask, amps: node.amps }, action, false);
  }
  for (const c of chars) {
    if (c === 'C' && !nearDoor(grid, node.x, node.y)) continue;
    const amps = qsim.applyGate(node.amps, CHARACTERS[c].gate);
    out({ x: node.x, y: node.y, mask: node.mask, amps }, { type: 'use', char: c }, false);
  }
}

// opts: { chars, from: {x,y,mask,amps}, all: collect every star first }
export function solve(level, opts = {}) {
  const grid = parseLevel(level);
  const chars = opts.chars || level.chars;
  const total = grid.stars.length;
  const required = opts.all ? total : grid.need;
  const start = opts.from || { x: grid.start.x, y: grid.start.y, mask: 0, amps: ZERO };
  const seen = new Map();
  const queue = [{ ...start, parent: null, action: null }];
  seen.set(keyOf(start.x, start.y, start.mask, start.amps), true);
  for (let qi = 0; qi < queue.length; qi++) {
    const node = queue[qi];
    let found = null;
    successors(grid, chars, node, (next, action, won) => {
      if (found) return;
      if (won) { if (bits(next.mask) >= required) found = { action, parent: node }; return; }
      const k = keyOf(next.x, next.y, next.mask, next.amps);
      if (seen.has(k)) return;
      seen.set(k, true);
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

// Every reachable state must be able to finish (no soft-locks). Returns the
// number of reachable states that can no longer reach the finish.
export function softLocks(level, chars) {
  const grid = parseLevel(level);
  chars = chars || level.chars;
  const nodes = new Map();
  const edges = [];
  const rev = [];
  const winners = new Set();
  const startNode = { x: grid.start.x, y: grid.start.y, mask: 0, amps: ZERO };
  const idOf = (n) => {
    const k = keyOf(n.x, n.y, n.mask, n.amps);
    if (!nodes.has(k)) { nodes.set(k, nodes.size); edges.push([]); rev.push([]); nodes.get(k); list.push(n); }
    return nodes.get(k);
  };
  const list = [];
  idOf(startNode);
  for (let i = 0; i < list.length; i++) {
    successors(grid, chars, list[i], (next, action, won) => {
      if (won) { if (bits(next.mask) >= grid.need) winners.add(i); return; }
      const before = list.length;
      const j = idOf(next);
      edges[i].push(j);
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

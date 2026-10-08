// Headless solver: every level must be solvable with its characters, and the
// intended characters must be required. Measurement is treated optimistically
// (the player can retry until the wanted outcome).
import assert from 'node:assert/strict';
import { LEVELS } from '../game/levels.js';
import * as qsim from '../game/qsim.js';
import { parseLevel, tileAt, canEnter, nearDoor, deriveVisuals, CHARACTERS } from '../game/world.js';

const key = (amps) => amps.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join('|');

function solve(level, chars) {
  const grid = parseLevel(level);
  const start = { x: grid.start.x, y: grid.start.y, seq: [] };
  const seen = new Set();
  const queue = [{ ...start, steps: 0 }];
  const id = (n, amps) => `${n.x},${n.y}:${key(amps)}`;
  seen.add(id(start, qsim.getState([])));
  while (queue.length) {
    const cur = queue.shift();
    const amps = qsim.getState(cur.seq);
    const vis = deriveVisuals(amps);
    const next = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cur.x + dx, y = cur.y + dy, ch = tileAt(grid, x, y);
      if (!canEnter(ch, vis)) continue;
      if (ch === 'G') return cur.steps + 1;
      if (ch === 'E' && (vis.world === 'ghost' || vis.door === 'flicker')) {
        const p = qsim.probabilities(amps);
        p.forEach((pi, i) => {
          if (pi < 1e-9) return;
          const seq = [];
          if (i & 1) seq.push('X');
          if (i & 2) seq.push('XD');
          next.push({ x, y, seq });
        });
      } else next.push({ x, y, seq: cur.seq });
    }
    for (const c of chars) {
      if (c === 'C' && !nearDoor(grid, cur.x, cur.y)) continue;
      next.push({ x: cur.x, y: cur.y, seq: [...cur.seq, CHARACTERS[c].gate] });
    }
    for (const n of next) {
      const k = id(n, qsim.getState(n.seq));
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ ...n, steps: cur.steps + 1 });
    }
  }
  return null;
}

const NEEDED = { 1: ['X'], 2: ['H'], 3: ['H'], 4: ['H', 'S'], 5: ['H', 'S'], 6: ['H', 'Z'], 7: ['H'], 8: ['X', 'C'], 9: ['H', 'C'], 10: ['H', 'S', 'C'] };
for (const level of LEVELS) {
  const solved = solve(level, level.chars);
  assert.ok(solved, `level ${level.id} must be solvable`);
  for (const c of NEEDED[level.id]) {
    const rest = level.chars.filter((x) => x !== c);
    assert.equal(solve(level, rest), null, `level ${level.id} must not be solvable without ${c}`);
  }
  for (const c of 'XHSZC') {
    if (level.chars.includes(c)) continue;
    // characters that are not available must not be needed (sanity: solved above)
  }
  console.log(`ok   level ${level.id} ${level.name}: solvable in ${solved} actions; needs ${NEEDED[level.id].join('+')}`);
}
// level 7 needs a quarter-turn or half-turn character
assert.equal(solve(LEVELS[6], ['H']), null);
console.log('level checks passed');

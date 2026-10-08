// Every level must be solvable, all its stars reachable in a single run, and
// the intended characters must be required.
import assert from 'node:assert/strict';
import { LEVELS } from '../game/levels.js';
import { parseLevel, tileAt, canEnter } from '../game/world.js';
import { solve, softLocks, neededChars } from './solver.mjs';

const NEEDED = {
  1: ['X'], 2: ['H'], 3: ['H'], 4: ['H', 'S'], 5: ['H', 'S'], 6: ['H', 'Z'], 7: ['H'], 8: ['X', 'C'], 9: ['H', 'C'], 10: ['H', 'S', 'C'],
  11: ['X'], 12: ['H', 'S'], 13: ['X', 'C'], 14: ['H'], 15: ['H', 'C'], 16: ['H', 'S'], 17: ['X', 'H', 'C'], 18: ['H', 'S', 'C'], 19: ['H', 'C'], 20: ['H', 'S', 'C'],
};
assert.equal(LEVELS.length, 20);
for (const level of LEVELS) {
  const grid = parseLevel(level);
  assert.ok(level.map.every((r) => r.length === 16), `level ${level.id} rows must be 16 wide`);
  assert.ok(level.map.length <= 10, `level ${level.id} too tall`);
  const stars = level.stars.length;
  assert.equal(stars, level.id === 20 ? 5 : 3, `level ${level.id} star count`);
  assert.equal(grid.need, level.id === 20 ? 5 : 2, `level ${level.id} stars needed`);
  for (const s of level.stars) {
    const ch = tileAt(grid, s.x === undefined ? s[0] : s.x, s.y === undefined ? s[1] : s.y);
    assert.notEqual(ch, '#', `level ${level.id} star on a wall`);
  }
  const all = solve(level, { all: true });
  assert.ok(all, `level ${level.id}: all ${stars} stars + finish must be reachable`);
  const needed = neededChars(level);
  assert.deepEqual(needed, NEEDED[level.id], `level ${level.id} needed characters (got ${needed})`);
  const lock = softLocks(level);
  console.log(`ok   level ${level.id} ${level.name}: all ${stars} stars + finish in ${all.actions.length} actions; needs ${needed.join('+')}; ${lock.states} states, ${lock.stuck} soft-locked`);
}
console.log('level checks passed');

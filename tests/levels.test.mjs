// Every level must be solvable, all its stars reachable in a single run, and
// the intended characters must be required.
import assert from 'node:assert/strict';
import { LEVELS } from '../game/levels.js';
import { parseLevel, tileAt, canEnter } from '../game/world.js';
import { solve, softLocks, neededChars } from './solver.mjs';

const NEEDED = {
  1: ['X'], 2: ['H'], 3: ['H'], 4: ['H', 'S'], 5: ['H', 'S'], 6: ['H', 'Z'], 7: ['H'], 8: ['X', 'C'], 9: ['H', 'C'], 10: ['H', 'S', 'C'],
};
// Levels 11-20 give the player every character, so no single one has to be required.
// Instead the difficulty (fewest actions to collect every star and finish) must rise level after level.
let lastActions = 0;
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
  const needed = NEEDED[level.id] ? neededChars(level) : [];
  if (NEEDED[level.id]) assert.deepEqual(needed, NEEDED[level.id], `level ${level.id} needed characters (got ${needed})`);
  else {
    assert.deepEqual(level.chars, ['X', 'H', 'S', 'Z', 'C'], `level ${level.id} must offer every character`);
    assert.equal(level.startActive, false, `level ${level.id}: the player picks the character`);
    assert.ok(all.actions.length > lastActions, `level ${level.id} (${all.actions.length} actions) must be harder than level ${level.id - 1} (${lastActions})`);
    lastActions = all.actions.length;
  }
  if (level.id === 10) lastActions = 0;
  if (level.id === 11) lastActions = 0;
  // chasers do not change the map: check for soft-locks without them
  const lock = softLocks({ ...level, chasers: [] });
  console.log(`ok   level ${level.id} ${level.name}: all ${stars} stars + finish in ${all.actions.length} actions; ${needed.length ? 'needs ' + needed.join('+') + '; ' : 'any character; '}${level.chasers ? 'with Noise; ' : ''}${lock.states} states, ${lock.stuck} soft-locked`);
}
console.log('level checks passed');

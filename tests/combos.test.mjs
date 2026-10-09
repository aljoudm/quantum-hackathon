// Section 9 acceptance table checked against game/qsim.js.
import assert from 'node:assert/strict';
import * as qsim from '../game/qsim.js';
import { deriveVisuals, blochVector } from '../game/world.js';

const vis = (seq) => deriveVisuals(qsim.getState(seq));
const probs = (seq) => qsim.probabilities(qsim.getState(seq)).map((p) => +p.toFixed(6));

let n = 0;
const check = (name, fn) => { fn(); n++; console.log('ok  ', name); };

check('Double flip X X -> Day', () => assert.equal(vis(['X', 'X']).world, 'day'));
check('Return H H -> Day, certain', () => assert.deepEqual(probs(['H', 'H']), [1, 0, 0, 0]));
check('Trap H -> 50/50', () => { assert.equal(vis(['H']).world, 'ghost'); assert.deepEqual(probs(['H']), [0.5, 0.5, 0, 0]); });
check('Quarter H S H -> still Ghost, 50/50', () => { assert.equal(vis(['H', 'S', 'H']).world, 'ghost'); assert.deepEqual(probs(['H', 'S', 'H']), [0.5, 0.5, 0, 0]); });
check('Two quarters H S S H -> Night', () => assert.deepEqual(probs(['H', 'S', 'S', 'H']), [0, 1, 0, 0]));
check('Half H Z H -> Night', () => assert.deepEqual(probs(['H', 'Z', 'H']), [0, 1, 0, 0]));
check('Full turn S S S S unchanged', () => assert.deepEqual(qsim.getState(['H', 'S', 'S', 'S', 'S']), qsim.getState(['H'])));
check('Key X CNOT -> Night, door open', () => { const v = vis(['X', 'CNOT']); assert.equal(v.world, 'night'); assert.equal(v.door, 'open'); });
check('Magic door H CNOT -> only 00 or 11', () => assert.deepEqual(probs(['H', 'CNOT']), [0.5, 0, 0, 0.5]));
check('Magic door measure never mixed', () => {
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(qsim.measure(['H', 'CNOT']));
  assert.deepEqual([...seen].sort(), ['00', '11']);
});
check('Phase wheel slots', () => {
  assert.equal(vis(['H']).slot, 0);
  assert.equal(vis(['H', 'S']).slot, 1);
  assert.equal(vis(['H', 'S', 'S']).slot, 2);
  assert.equal(vis(['H', 'Z']).slot, 2);
  assert.equal(vis(['H', 'S', 'S', 'S']).slot, 3);
  assert.equal(vis(['X', 'H']).slot, 2);
  assert.equal(vis(['X', 'H', 'Z']).slot, 0);
});
check('Collapse states', () => {
  assert.equal(vis(['X']).world, 'night');
  assert.equal(vis(['XD']).door, 'open');
  assert.equal(vis(['X', 'XD']).world, 'night');
});
check('Bloch vector matches the wheel', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  const day = blochVector(qsim.getState([]));       near(day.z, 1);
  const night = blochVector(qsim.getState(['X']));  near(night.z, -1);
  const plus = blochVector(qsim.getState(['H']));   near(plus.x, 1); near(plus.z, 0);
  const plusI = blochVector(qsim.getState(['H', 'S'])); near(plusI.y, 1);
  const minus = blochVector(qsim.getState(['H', 'Z'])); near(minus.x, -1);
  const bell = blochVector(qsim.getState(['H', 'CNOT']));
  near(Math.hypot(bell.x, bell.y, bell.z), 0);      // entangled with the door: arrow shrinks to the centre
});
console.log(`${n} checks passed`);

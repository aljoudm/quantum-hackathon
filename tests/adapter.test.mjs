// The adapter must never throw: Qiskit failures fall back to qsim.js.
import assert from 'node:assert/strict';
import { createQuantum } from '../game/quantum.js';
import * as qsim from '../game/qsim.js';

const wrap = (fn) => ({ callPromising: async (...a) => fn(...a) });
const proxy = (v) => ({ toJs: () => v, destroy() {} });

// 1. Qiskit path is used when it works.
let calls = 0;
const good = createQuantum({
  core: { get_state: wrap((s) => { calls++; return proxy(qsim.getState(s)); }), measure: wrap(() => '11') },
  backend: {},
});
assert.deepEqual(await good.getState(['H']), qsim.getState(['H']));
assert.equal(calls, 1);
assert.equal(await good.measure(['X']), '11');

// 2. Second IonQ job throws: measurement falls back to local sampling, no exception.
let jobs = 0;
const ionq = createQuantum({
  core: { get_state: wrap((s) => proxy(qsim.getState(s))), measure: wrap(() => { if (jobs++ >= 1) throw new Error('IonQ: one job per run'); return '01'; }) },
  backend: {},
});
assert.equal(await ionq.measure(['X']), '01');
const second = await ionq.measure(['X', 'XD']);
assert.equal(second, '11'); // collapsed state is deterministic, so the fallback agrees

// 3. Statevector import failure: state falls back to qsim, the Eye still uses the backend.
const noState = createQuantum({
  core: { get_state: wrap(() => { throw new Error('Statevector import failed'); }), measure: wrap(() => '10') },
  backend: {},
});
assert.deepEqual(await noState.getState(['X']), qsim.getState(['X']));
assert.equal(await noState.measure(['XD']), '10');

// 4. No core at all (dev.html).
const dev = createQuantum();
assert.deepEqual(await dev.getState(['H', 'CNOT']), qsim.getState(['H', 'CNOT']));
assert.match(await dev.measure(['H', 'CNOT']), /^(00|11)$/);
console.log('adapter checks passed');

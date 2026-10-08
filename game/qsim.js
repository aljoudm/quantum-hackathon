// Tiny 2-qubit statevector simulator. Amplitudes are [re, im] pairs indexed
// i = q1*2 + q0 (Qiskit little-endian). Mirrors quantum/core.py.
const R = Math.SQRT1_2;
const GATES = {
  X: { q: 0, m: [[[0, 0], [1, 0]], [[1, 0], [0, 0]]] },
  H: { q: 0, m: [[[R, 0], [R, 0]], [[R, 0], [-R, 0]]] },
  S: { q: 0, m: [[[1, 0], [0, 0]], [[0, 0], [0, 1]]] },
  Z: { q: 0, m: [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]] },
  XD: { q: 1, m: [[[0, 0], [1, 0]], [[1, 0], [0, 0]]] },
};

const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];

export function parseSeq(seq) {
  if (Array.isArray(seq)) return seq;
  return String(seq || '').split(',').filter(Boolean);
}

function applyOne(amps, q, m) {
  const out = amps.map((a) => a.slice());
  const bit = 1 << q;
  for (let i = 0; i < 4; i++) {
    if (i & bit) continue;
    const j = i | bit;
    out[i] = add(mul(m[0][0], amps[i]), mul(m[0][1], amps[j]));
    out[j] = add(mul(m[1][0], amps[i]), mul(m[1][1], amps[j]));
  }
  return out;
}

export function getState(seq) {
  let amps = [[1, 0], [0, 0], [0, 0], [0, 0]];
  for (const g of parseSeq(seq)) {
    if (g === 'CNOT') {
      const next = amps.map((a) => a.slice());
      next[1] = amps[3].slice(); // control q0=1: swap target q1
      next[3] = amps[1].slice();
      amps = next;
    } else if (GATES[g]) {
      amps = applyOne(amps, GATES[g].q, GATES[g].m);
    }
  }
  return amps.map(([re, im]) => [Math.abs(re) < 1e-12 ? 0 : re, Math.abs(im) < 1e-12 ? 0 : im]);
}

export function probabilities(amps) {
  return amps.map(([re, im]) => re * re + im * im);
}

// Sample one outcome from amplitudes; returns a "q1q0" bitstring.
export function sample(amps, rng = Math.random) {
  const p = probabilities(amps);
  let r = rng() * p.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 4; i++) {
    r -= p[i];
    if (r < 0) return String((i >> 1) & 1) + String(i & 1);
  }
  return '00';
}

export function measure(seq, rng = Math.random) {
  return sample(getState(seq), rng);
}

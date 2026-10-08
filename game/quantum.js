// Quantum adapter used by the game: Qiskit (via Pyodide) first, qsim.js as fallback.
import * as qsim from './qsim.js';

function toArray(proxy) {
  if (proxy && typeof proxy.toJs === 'function') {
    const v = proxy.toJs();
    if (typeof proxy.destroy === 'function') proxy.destroy();
    return v;
  }
  return proxy;
}

function validState(a) {
  return Array.isArray(a) && a.length === 4 &&
    a.every((c) => (c.length === 2) && Number.isFinite(c[0]) && Number.isFinite(c[1]));
}

export function createQuantum({ core = null, backend = null } = {}) {
  let qiskitState = !!(core && core.get_state);
  let warnedMeasure = false;

  async function getState(seq) {
    const gates = qsim.parseSeq(seq);
    if (qiskitState) {
      try {
        const raw = await core.get_state.callPromising(gates.join(','));
        const amps = Array.from(toArray(raw), (c) => Array.from(c));
        if (!validState(amps)) throw new Error('unexpected state shape');
        return amps;
      } catch (err) {
        console.error('[quantum] Qiskit get_state failed, using qsim.js for state:', err);
        qiskitState = false;
      }
    }
    return qsim.getState(gates);
  }

  // Returns a "q1q0" bitstring. Never throws.
  async function measure(seq) {
    const gates = qsim.parseSeq(seq);
    if (core && core.measure && backend) {
      try {
        const raw = toArray(await core.measure.callPromising(backend, gates.join(',')));
        const bits = String(raw).replace(/[^01]/g, '');
        if (bits.length >= 2) return bits.slice(-2);
        throw new Error('unexpected measurement result: ' + raw);
      } catch (err) {
        if (!warnedMeasure) {
          console.warn('[quantum] backend measurement failed (for example the IonQ one-job limit); sampling locally instead:', err);
          warnedMeasure = true;
        }
      }
    }
    return qsim.sample(await getState(gates));
  }

  return { getState, measure, usingQiskit: () => qiskitState };
}

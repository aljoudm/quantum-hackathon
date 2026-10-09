// LOCAL DEV ONLY: runs the game with the JS simulator (no Pyodide, no Qiskit).
// ?level=N jumps to a level. ?mock=1 uses a fake Qiskit module and an IonQ-like
// backend that allows a single job, to exercise the fallback paths.
import { startGame } from './game/game.js';
import * as qsim from './game/qsim.js';

const html = await (await fetch('./index.html')).text();
document.getElementById('app-root').innerHTML = html;
const params = new URLSearchParams(location.search);
const jump = params.get('level');
const level = Number(jump || 1) - 1;

let core = null;
let backend = null;
window.__jobs = { sent: 0, rejected: 0 };
if (params.get('mock')) {
  const wrap = (fn) => ({ callPromising: async (...a) => fn(...a) });
  backend = { used: false };
  core = {
    get_state: wrap((seq) => ({ toJs: () => qsim.getState(seq), destroy() {} })),
    measure: wrap((be, seq) => {
      if (be.used) { window.__jobs.rejected++; throw new Error('IonQ: only one job per run'); }
      be.used = true; window.__jobs.sent++;
      return qsim.measure(seq);
    }),
  };
}
window.__game = startGame({ core, backend, startLevel: level, skipMenu: !!jump, unlockAll: !!params.get('unlock'), tips: !params.get('notips') });

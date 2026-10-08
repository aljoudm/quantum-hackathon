// LOCAL DEV ONLY: runs the game with the JS simulator (no Pyodide, no Qiskit).
import { startGame } from './game/game.js';

const html = await (await fetch('./index.html')).text();
document.getElementById('app-root').innerHTML = html;
const level = Number(new URLSearchParams(location.search).get('level') || 1) - 1;
window.__game = startGame({ startLevel: level });

// Thin entry point for Qollab: hands the Qiskit module and the global backend to the game.
import * as core from 'quantum.core';
import { startGame } from './game/game.js';

startGame({
  core,
  backend: typeof backend !== 'undefined' ? backend : null, // provided by Qollab, never created here
});

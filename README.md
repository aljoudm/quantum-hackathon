# Quantum Gate Maze

A small pixel-art maze that teaches five quantum gates (X, H, S, Z, CNOT) to people with zero quantum background.
Every skill you use adds a gate to a real Qiskit circuit, and the world you see is read from that circuit's statevector.

Built for the Qollab x IonQ hackathon. License: MIT.

## How to play

The maze exists twice, as a **Day** and a **Night** version. The world is qubit 0, and a **magic door** is qubit 1.
Pick a character, use its skill, and get to the star. Bridges only exist in one world, ghost gates only open for a ghost,
and the Eye forces the world to choose. Ten short levels each teach one idea, then show a concept card with the real term.
Click the game once to give it keyboard focus.

## Controls

| Key | Action |
|-----|--------|
| Arrow keys | Move (WASD is not used because S is a gate key) |
| X / H / S / Z / C | Switch to Owl / Goose / Lizard / Octopus / Cat |
| Space | Use the active character's skill |
| Q | Hint (hint levels only; press again for a stronger hint) |
| R | Restart level |
| N | Open or close the notebook of combos you found |
| Enter | Confirm, next level, close a card |

## Characters and gates

| Character | Key | Gate | Skill | Effect |
|-----------|-----|------|-------|--------|
| Owl | X | X on q0 | Flip | Day <-> Night |
| Goose | H | H on q0 | Ghost | Both worlds overlaid, or return |
| Lizard | S | S on q0 | Quarter turn | Phase wheel moves one slot |
| Octopus | Z | Z on q0 | Half turn | Phase wheel jumps to the opposite slot |
| Cat | C | CNOT (q0 -> q1) | Link | Door flips if the world is Night (stand next to a door) |

## Combos

Starting from Day with the door closed. The notebook records each one the first time you complete it.

| Name | Sequence | Result | Circuit |
|------|----------|--------|---------|
| Double flip | X X | Day | `q0: -X-X-` |
| Return | H H | Day, certain | `q0: -H-H-` |
| Trap | H, Eye | Day or Night, 50/50 | `q0: -H-M-` |
| Quarter | H S H | still a ghost, Eye gives 50/50 | `q0: -H-S-H-` |
| Two quarters | H S S H | Night, certain | `q0: -H-S-S-H-` |
| Half | H Z H | Night, certain | `q0: -H-Z-H-` |
| Full turn | S S S S | unchanged | `q0: -S-S-S-S-` |
| Key | X, CNOT | Night, door open | `q0: -X-o-` / `q1: ---+-` |
| Magic door | H, CNOT, Eye | Night+open or Day+closed, never mixed | `q0: -H-o-M-` / `q1: ---+-M-` |

## How the state is computed

`main.js` imports `quantum.core` (`quantum/core.py`, run by Pyodide on Qollab) and passes it, plus Qollab's global `backend`, to the game.
The game keeps a gate sequence such as `H,CNOT`. After each skill it calls `core.get_state`, which builds a 2-qubit Qiskit circuit and returns the
statevector `[q1*2+q0]`. From it:

- `P(Night) = |a1|^2 + |a3|^2` gives Day (< 0.01), Night (> 0.99) or Ghost.
- `P(open) = |a2|^2 + |a3|^2` gives the door: closed, open, or flickering (linked).
- The phase wheel slot is the angle of `a1/a0` (largest amplitudes with q0=1 and q0=0) rounded to a quarter turn.

The Eye calls `core.measure(backend, seq)` with one shot, then collapses the gate sequence to the measured basis state.
`game/qsim.js` is a tiny JS statevector simulator used by the local dev page, and as the fallback if Qiskit state or a backend job fails.

**IonQ note:** IonQ backends allow one job per Run, so a second `backend.run` throws. The Eye catches that and samples one outcome from the current
amplitudes in JS instead. If the Eye is stepped on while the world is not a ghost and the door is not linked, no job is sent at all.
Local simulators allow unlimited jobs.

## Development

- `dev.html` (not uploaded to Qollab) runs the game with the JS simulator only: `python3 -m http.server`, then open `/dev.html?level=3`.
- `node tests/combos.test.mjs` checks the combo table against `qsim.js`; `python tests/test_core.py` checks it against `core.py` (needs `qiskit`).
- `node tests/levels.test.mjs` solves every level headlessly and checks the intended characters are required.
- `node tests/adapter.test.mjs` checks the Qiskit-to-qsim fallbacks (including the IonQ one-job limit); `dev.html?mock=1` exercises them in the browser.
- `node tests/e2e.mjs` plays all 10 levels in headless Chromium (needs Playwright).

## Tools used

Built with plain ES modules and the 2D canvas API, with Qiskit on Pyodide for the quantum part. The code was written with the help of
Claude Code (an AI coding tool) from the project spec in `quantum-maze-spec.md`. No project was forked and no external code, assets or fonts were used.

## License

MIT, see `LICENSE`.

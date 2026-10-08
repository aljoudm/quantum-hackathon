# Build spec: Quantum Gate Maze (Qollab x IonQ hackathon)

You are building a small pixel-art maze game that teaches five quantum gates
(X, H, S, Z, CNOT) to people with zero quantum background. It must run as a
**JS project on Qollab** (qollab.xyz), where the game state is computed by a
real Qiskit circuit. Read this whole file before writing code.

## 1. Hard platform constraints (do not violate)

Qollab runs the project in the browser. Python runs on Pyodide.

- Top-level `index.html` + `main.js` make it a JS project. `main.css` is the
  only stylesheet loaded. No other .html/.css files are loaded.
- `index.html` is body content only. `<html>`, `<head>`, `<body>` are dropped
  and `<script>` tags do NOT run. All code goes in `main.js` and its imports.
- JS imports other JS with relative paths (`./game/render.js`).
- JS imports Python by dotted module name, named or namespace imports only:
  `import * as core from 'quantum.core';` (file `quantum/core.py`).
- Call Python functions with `await fn.callPromising(args...)`, and convert
  returned lists/dicts with `.toJs()`.
- A global `backend` exists in `main.js`. Never create or hardcode a backend.
- IonQ backends allow **one job per Run**. A second `backend.run` throws.
  Local simulators allow unlimited jobs.
- No persistence: no localStorage, sessionStorage, IndexedDB, cookies.
- JS cannot `fetch` project files. Level data must live in a JS module.
- No web workers, no WebSocket, GET requests only. Do not depend on network.
- Limits: 100 files, 2 MB each. Target browsers: recent Chrome / Edge.
- No build step, no bundler, no npm packages. Plain ES modules, 2D canvas.
- License: MIT. Add a LICENSE file.

## 2. File layout

```
index.html          canvas + HUD containers (body content only)
main.css            layout and HUD styling
main.js             boot, game loop, input, wiring
game/input.js       keyboard handling
game/levels.js      the 10 levels as data
game/world.js       tile rules, movement, collision
game/render.js      tiles, characters, palettes, ghost effect
game/hud.js         combo bar, phase wheel, hint box, concept cards
game/qsim.js        tiny 2-qubit statevector simulator in JS (dev + fallback)
quantum/core.py     Qiskit circuit builder, statevector, measurement
quantum/__init__.py empty
dev.html            LOCAL DEV ONLY harness, not uploaded to Qollab
README.md           project page text (see section 12)
LICENSE             MIT
```

## 3. Core idea

The maze exists in two versions, **Day** and **Night**. The world is qubit 0:
|0> = Day, |1> = Night. A second qubit (qubit 1) is a **magic door**:
|0> = closed, |1> = open. Every skill the player uses appends a gate to a
running gate sequence; the visible world is derived from that circuit's
statevector. Nothing about the quantum behaviour is hardcoded as animation.

Player-facing vocabulary (never show jargon during play):

| Game word   | Meaning                                   |
|-------------|-------------------------------------------|
| Day / Night | qubit 0 is |0> / |1>                      |
| Ghost       | qubit 0 in superposition                  |
| Ghost color | relative phase, shown on a 4-slot wheel   |
| The Eye     | measurement, collapses everything         |
| Magic door  | qubit 1                                   |

## 4. Controls (letter keys)

Each character's key is the letter of its gate, so players learn the names.

| Key            | Action                                         |
|----------------|------------------------------------------------|
| Arrow keys     | Move (do NOT use WASD: S is a gate key)        |
| X              | Switch to Owl                                  |
| H              | Switch to Goose                                |
| S              | Switch to Lizard                               |
| Z              | Switch to Octopus                              |
| C              | Switch to Cat                                  |
| Space          | Use the active character's skill               |
| Q              | Ask for a hint (hint levels only)              |
| R              | Restart level                                  |
| Enter          | Confirm / next level / close card              |

- Switching to a character that is not available in the level does nothing
  (show a small shake on its icon).
- The canvas needs `tabindex="0"`, must grab focus on click, and must
  `preventDefault()` on arrows and Space so the page does not scroll.
- Show a "click to play" overlay until the canvas has focus.
- Always show a key legend strip under the canvas.

## 5. Characters

| Character | Key | Gate            | Skill name   | Visible effect                          |
|-----------|-----|-----------------|--------------|-----------------------------------------|
| Owl       | X   | X on q0         | Flip         | Day <-> Night                           |
| Goose     | H   | H on q0         | Ghost        | Both worlds overlaid, or return         |
| Lizard    | S   | S on q0         | Quarter turn | Phase wheel moves one slot              |
| Octopus   | Z   | Z on q0         | Half turn    | Phase wheel jumps to the opposite slot  |
| Cat       | C   | CNOT(q0 -> q1)  | Link         | Door flips if the world is Night        |

The Cat's skill only works when standing next to a door tile.
All sprites are 16x16, same walk cycle, drawn procedurally on canvas (no image
files needed). Print the gate letter on each character icon in the HUD.

## 6. Deriving visuals from the statevector

`get_state` returns 4 complex amplitudes indexed `i = q1*2 + q0`
(Qiskit little-endian): a[0]=|00>, a[1]=|01> (door 0, world 1), a[2]=|10>,
a[3]=|11>.

- `pNight = |a[1]|^2 + |a[3]|^2`.
  `pNight < 0.01` -> Day, `> 0.99` -> Night, otherwise Ghost.
- `pOpen = |a[2]|^2 + |a[3]|^2`.
  `< 0.01` closed, `> 0.99` open, otherwise the door flickers (linked).
- Phase wheel (only shown while Ghost): take the largest-magnitude amplitude
  with q0=1 and the largest with q0=0, compute `arg(a1 / a0)`, round to the
  nearest quarter turn -> slot 0..3.
- Palettes: Day = light palette, Night = dark palette, Ghost = both tile
  layers drawn at 50% alpha, tinted by the wheel slot color.

## 7. Tiles

| Tile            | Passable when                                   |
|-----------------|-------------------------------------------------|
| Floor           | always                                          |
| Wall            | never                                           |
| Day bridge      | world is Day (not Ghost)                        |
| Night bridge    | world is Night (not Ghost)                      |
| Ghost gate      | world is Ghost; optional required wheel slot    |
| Eye             | always; triggers measurement when stepped on    |
| Magic door      | door is open (not flickering)                   |
| Goal            | always; ends the level                          |

## 8. The Eye (measurement)

When the player steps on an Eye:

1. Call `core.measure(backend, seq)` (one shot, all qubits). Returns a
   bitstring `"q1q0"`.
2. If that call throws (for example the IonQ one-job limit), fall back to
   sampling one outcome from the current amplitudes in JS. Never crash.
3. Collapse: reset the gate sequence to the measured basis state
   (`"X"` if q0=1, `"XD"` if q1=1, both if both). `XD` is an internal gate,
   X on qubit 1, never exposed to the player.
4. Clear the combo bar and play a short "snap" effect.

If the world is not Ghost and the door is not flickering, the Eye does nothing
visible and must NOT send a job.

## 9. Combos (these are the acceptance tests)

Starting from Day, door closed. Verify each in `qsim.js` unit checks and
against `core.py`.

| Name          | Sequence             | Expected                                   |
|---------------|----------------------|--------------------------------------------|
| Double flip   | X X                  | Day                                        |
| Return        | H H                  | Day, certain                               |
| Trap          | H, Eye               | Day or Night, 50/50                        |
| Quarter       | H S H                | still Ghost; Eye gives 50/50               |
| Two quarters  | H S S H              | Night, certain                             |
| Half          | H Z H                | Night, certain                             |
| Full turn     | S S S S              | unchanged                                  |
| Key           | X, CNOT              | Night, door open                           |
| Magic door    | H, CNOT, Eye         | (Night, open) or (Day, closed), never mixed|

When a named combo is completed for the first time, flash its name and add it
to an in-memory notebook the player can view.

## 10. Levels

One screen each (about 16x10 tiles), one idea each. Draft the maps, keep them
small, and make sure the listed solution is the ONLY way through.

| #  | Name            | Available chars       | Intended solution        | Guidance |
|----|-----------------|-----------------------|--------------------------|----------|
| 1  | The Owl         | Owl                   | X to cross a Night bridge| full     |
| 2  | Goose and Eye   | Goose                 | H through a Ghost gate, then Eye; retry if wrong world | full |
| 3  | Return          | Goose                 | H, Ghost gate, H again BEFORE the Eye | hints |
| 4  | The Lizard      | Goose, Lizard         | H S to pass a slot-1 Ghost gate | full |
| 5  | Two quarters    | Goose, Lizard         | H S S H to reach Night with no Owl | hints |
| 6  | The Octopus     | Goose, Octopus        | H Z H                    | full     |
| 7  | No owl          | Goose, Lizard, Octopus| needs Night then Day again: H Z H, later H S S H | hints |
| 8  | The Cat         | Owl, Cat              | X then CNOT at the door  | full     |
| 9  | Magic door      | Goose, Cat            | H, CNOT, Eye; retry until Night+open | hints |
| 10 | Finale          | all five              | three combos in sequence | none     |

Guidance modes:
- `full`: one short instruction line per step, shown automatically.
- `hints`: nothing shown until the player presses Q. Three tiers per level:
  idea -> which character -> full sequence.
- `none`: no text at all.

The first use of any new skill must happen in a spot where nothing can go
wrong. After each level show one concept card: plain-language sentence, the
real term (for example "This is called superposition"), and the circuit the
player just built drawn as text.

Level data format (in `game/levels.js`):

```js
export const LEVELS = [
  {
    id: 1,
    name: "The Owl",
    chars: ["X"],
    guidance: "full",
    map: [
      "################",
      "#P....N....G...#",
      "################",
    ],
    steps: ["Press X to pick the Owl.", "Press Space to flip the world."],
    hints: [],
    card: { text: "...", term: "X gate (NOT)", circuit: "q0: -X-" },
  },
];
```

Map legend: `#` wall, `.` floor, `P` start, `G` goal, `D` Day bridge,
`N` Night bridge, `0`-`3` Ghost gate requiring that wheel slot, `?` Ghost gate
any slot, `E` Eye, `M` magic door.

## 11. Quantum module

`quantum/core.py`:

```python
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

def build(seq):
    qc = QuantumCircuit(2)
    for g in [s for s in seq.split(",") if s]:
        if g == "X": qc.x(0)
        elif g == "H": qc.h(0)
        elif g == "S": qc.s(0)
        elif g == "Z": qc.z(0)
        elif g == "CNOT": qc.cx(0, 1)
        elif g == "XD": qc.x(1)
    return qc

def get_state(seq):
    sv = Statevector(build(seq))
    return [[float(a.real), float(a.imag)] for a in sv.data]

def measure(backend, seq):
    qc = build(seq)
    qc.measure_all()
    counts = backend.run(qc, shots=1).result().get_counts()
    return list(counts.keys())[0]
```

`game/qsim.js` implements the same three functions in plain JS (4 complex
amplitudes, the six gates above, sampling). Wrap both behind one adapter:

```js
// quantum adapter used by the game
export async function getState(seq) { /* Qiskit if available, else qsim */ }
export async function measure(seq)  { /* Qiskit + backend, else qsim   */ }
```

On Qollab the Qiskit path is the primary one. `qsim.js` is used only by
`dev.html` and as the measurement fallback in section 8. If the Qiskit
`Statevector` import fails on Qollab, log it clearly to the console and fall
back to `qsim.js` for state, but still use Qiskit + `backend` for the Eye.

Because `main.js` imports Python by module name, it cannot load in a plain
browser. So `main.js` should be a thin entry that imports `quantum.core` and
passes it (plus `backend`) into `startGame(...)` from `game/`. `dev.html`
loads a separate `dev.js` that calls the same `startGame` with only `qsim`.

## 12. HUD and README

HUD: character icons with key letters (active one highlighted, unavailable
ones dimmed), combo bar showing the gate sequence since the last Eye, phase
wheel, door status, level name, hint box, key legend.

`README.md` is the Qollab project page. Include: two-line pitch, how to play,
controls table, characters and gates table, combo table with the matching
circuit, how state is computed from Qiskit, the one-job-per-run note for IonQ,
a statement of which tools were used (including AI coding tools) and any
project forked or used as reference, MIT license.

## 13. Build order (each milestone must be playable)

1. Engine: canvas, tiles, movement, Day/Night rendering, character switching
   by letter key, adapter + qsim, level 1.
2. Goose, Ghost rendering, Eye, levels 2-3.
3. Phase wheel, Lizard, Octopus, levels 4-7.
4. Door, Cat, levels 8-9, combo bar and notebook.
5. Level 10, hints, concept cards, README.

Stop and report after each milestone. Do not start the next one until the
previous one runs without console errors.

## 14. Out of scope

Sound, save games, mobile/touch, more than 2 qubits, rotation gates,
teleportation, any server, any external assets or fonts.

## 15. Definition of done

- All combo expectations in section 9 hold in both `qsim.js` and `core.py`.
- All 10 levels are completable with the intended solution and only with it.
- Works from a fresh browser profile with keyboard only.
- No uncaught errors when a second measurement is attempted on an IonQ backend.
- Every file under 2 MB, fewer than 100 files, no network requests.

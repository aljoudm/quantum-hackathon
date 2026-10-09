// Player-facing explanations that are not tied to one level.

export const HOWTO_HTML = `<h1>How to play</h1>
<h2>Your goal</h2>
<p>Reach the big star at the end of each maze. Some paths are blocked, and you open them by using quantum gates. Small stars are hidden in the maze: collect at least 2 of the 3 to unlock the next level (all 5 in the last level).</p>
<h2>Why you are doing it</h2>
<p>Every skill you use is a real quantum gate added to a real quantum circuit. What you see on screen (Day, Night, the ghost, the magic door) is read from that circuit. Playing the maze is playing with two qubits.</p>
<h2>What you are looking at</h2>
<ul>
<li><b>Day / Night</b> is the first qubit. State 0 is Day, state 1 is Night.</li>
<li><b>Ghost</b> means the world qubit is in a superposition: a single state with an amplitude for Day (0) and for Night (1). It is not secretly one of them, and it is not literally in two places. Only ghost gates open for a ghost.</li>
<li><b>Ghost colour</b> is the relative phase between the Day part and the Night part of a ghost, shown on the qubit sphere at the bottom. It does not change the odds of Day or Night by itself, but it changes what later gates do.</li>
<li><b>The Eye</b> is a measurement. It forces a ghost to become Day or Night at random, with odds set by the amplitudes (50/50 for the ghosts you make here). The superposition is gone afterwards.</li>
<li><b>The magic door</b> is the second qubit: closed is 0, open is 1.</li>
</ul>
<h2>Controls</h2>
<p>Arrow keys move. Press a letter (<b>X H S Z C</b>) to pick a character, then <b>Space</b> to use its skill. <b>R</b> restarts, <b>Q</b> asks for a hint, <b>N</b> opens the notebook, <b>Esc</b> opens the menu. Click the (i) under a character to learn who it is and what its gate does.</p>
<h2>The five gates</h2>
<ul>
<li><b>X (Owl)</b>: flips 0 and 1, like a NOT.</li>
<li><b>H (Goose)</b>: turns Day or Night into an equal superposition, and turns it back.</li>
<li><b>S (Lizard)</b>: quarter-turns the phase of the ghost.</li>
<li><b>Z (Octopus)</b>: half-turns the phase.</li>
<li><b>CNOT (Cat)</b>: flips the door if the world is Night.</li>
</ul>
<p>The left panel tells you what is happening right now. Click any maze element to read what it is. The game is a simplified picture of a real two-qubit circuit: Day, Night, ghost and door are labels for the qubit states.</p>`;

// Who each character is and what its gate is in quantum computing.
export const CHAR_INFO = {
  X: {
    who: 'The Owl flips the world over: Day becomes Night and Night becomes Day.',
    gate: 'X gate (quantum NOT)',
    quantum: 'The X gate swaps the amplitudes of |0⟩ and |1⟩. It is the quantum version of a classical NOT, and it is how a quantum program turns a 0 into a 1.',
    game: 'Space flips the world qubit. Pressed twice, you are back where you were.',
    math: 'X|0⟩ = |1⟩, X|1⟩ = |0⟩',
    line: 'Owl (X gate): flips the world, Day ⇄ Night. Press Space to use it.',
  },
  H: {
    who: 'The Goose turns the world into a ghost, or folds a ghost back into a single world.',
    gate: 'H gate (Hadamard)',
    quantum: 'The Hadamard gate turns a definite |0⟩ or |1⟩ into an equal superposition of both, and back again. Many quantum algorithms begin by applying it.',
    game: 'Space makes a ghost: an equal superposition of Day and Night. Used on a ghost, it folds it back: colour 0 returns to Day, colour 2 to Night, and colours 1 and 3 give another 50/50 ghost.',
    math: 'H|0⟩ = (|0⟩ + |1⟩)/√2, H|1⟩ = (|0⟩ − |1⟩)/√2',
    line: 'Goose (H gate): makes a ghost (a superposition of Day and Night), or folds a ghost back.',
  },
  S: {
    who: 'The Lizard turns the ghost\'s hidden colour by a quarter.',
    gate: 'S gate (quarter-turn phase, √Z)',
    quantum: 'The S gate leaves the odds of 0 and 1 alone but turns the phase of |1⟩ by 90 degrees. Phase cannot be measured directly, yet it decides how amplitudes interfere.',
    game: 'Space moves the ghost colour on the sphere one slot. It does nothing visible in plain Day or Night.',
    math: 'S|0⟩ = |0⟩, S|1⟩ = i|1⟩',
    line: 'Lizard (S gate): quarter-turns the ghost colour one slot. Only matters in Ghost Mode.',
  },
  Z: {
    who: 'The Octopus turns the ghost\'s hidden colour by a half turn.',
    gate: 'Z gate (phase flip)',
    quantum: 'The Z gate flips the sign of |1⟩, a 180-degree phase turn. It equals two S gates, and it is used in quantum error correction.',
    game: 'Space jumps the ghost colour two slots, to the opposite side of the sphere.',
    math: 'Z|0⟩ = |0⟩, Z|1⟩ = −|1⟩',
    line: 'Octopus (Z gate): half-turns the ghost colour, two slots at once.',
  },
  C: {
    who: 'The Cat links the magic door to the world.',
    gate: 'CNOT gate (controlled NOT)',
    quantum: 'CNOT acts on two qubits: it flips the second (target) only if the first (control) is |1⟩. If the control is in superposition and the target is |0⟩, the result is an entangled pair: their values are perfectly correlated, though neither has a definite value alone until measured.',
    game: 'Stand next to a magic door and press Space: the door flips if the world is Night, and does nothing in Day.',
    math: '(control, target): (0,0) → (0,0), (0,1) → (0,1), (1,0) → (1,1), (1,1) → (1,0)',
    line: 'Cat (CNOT gate): links the door to the world: flips the door if it is Night. Stand next to a door.',
  },
};

// ---- persistent one-line state notifications (left panel) ----
import { SLOT_NAMES } from './render.js';

const TURNS = ['0°, no turn', '90°, one quarter turn', '180°, a half turn', '270°, three quarter turns'];

export function charLine(active, level) {
  if (!active) return `No character picked yet. Press ${level.chars[0]} to pick the ${{ X: 'Owl', H: 'Goose', S: 'Lizard', Z: 'Octopus', C: 'Cat' }[level.chars[0]]}.`;
  return CHAR_INFO[active].line;
}

export function worldLine(vis) {
  if (vis.world === 'day') return 'Day: the world is certainly Day (state 0). Day bridges are solid.';
  if (vis.world === 'night') return 'Night: the world is certainly Night (state 1). Night bridges are solid.';
  return 'Ghost Mode: the world is in a superposition: it has an amplitude for both Day and Night and is not secretly either. Ghost gates open, bridges are water. The Eye will force one of them, at random.';
}

export function wheelLine(vis) {
  if (vis.world !== 'ghost') return 'Ghost colour: only a superposition has a relative phase between its parts. In plain Day or Night there is nothing to compare.';
  const n = SLOT_NAMES[vis.slot];
  return `Ghost colour: slot ${vis.slot} (${n}), a relative phase of ${TURNS[vis.slot]}. Only ${n} gates (and white ones) open now.`;
}

export function doorLine(vis) {
  if (vis.door === 'open') return 'Magic door: open (state 1). It stays open until the Cat flips it again.';
  if (vis.door === 'flicker') return 'Magic door: entangled with the world. It flickers because it has no definite value alone, only a correlation with the world. Step on the Eye to settle both.';
  return 'Magic door: closed (state 0). The Cat opens it, but only when the world is Night.';
}

// what a skill just did, in one line
export function changeLine(name, gate, prev, cur) {
  const head = `${name} used ${gate}: `;
  if (prev.world !== cur.world) {
    if (cur.world === 'ghost') return head + 'the world is now a ghost, a superposition of Day and Night.';
    if (prev.world === 'ghost') return head + `the ghost folded back into ${cur.world === 'day' ? 'Day' : 'Night'}, for certain.`;
    return head + `the world flipped to ${cur.world === 'day' ? 'Day' : 'Night'}.`;
  }
  if (cur.world === 'ghost' && prev.slot !== cur.slot) return head + `the ghost colour moved from slot ${prev.slot} to slot ${cur.slot} (${SLOT_NAMES[cur.slot]}).`;
  if (prev.door !== cur.door) return head + (cur.door === 'flicker' ? 'the door is now entangled with the world: neither has a definite value alone.' : `the door is now ${cur.door}.`);
  if (gate === 'CNOT') return head + (cur.world === 'day' ? 'the world is Day, so the door did not flip.' : 'nothing new to link.');
  if (gate === 'S' || gate === 'Z') return head + 'nothing you can observe changed. A phase only matters between the two parts of a ghost, so make a ghost first (H).';
  if (cur.world === 'ghost') return head + 'the ghost changed.';
  return head + 'no visible change.';
}

// ---- element explanations: shown the first time an element appears, and on click ----
export const ELEMENTS = {
  bridgeDay: {
    title: 'Day bridge',
    what: 'Solid only while the world is Day. In Night, or while you are a ghost, it is water.',
    quantum: 'Day is the world qubit in state |0⟩. Only a definite 0 counts: a superposition is not definitely 0.',
  },
  bridgeNight: {
    title: 'Night bridge',
    what: 'Solid only while the world is Night. In Day, or while you are a ghost, it is water.',
    quantum: 'Night is the world qubit in state |1⟩. Only a definite 1 counts. The X gate (Owl) turns |0⟩ into |1⟩.',
  },
  gate: {
    title: 'Ghost gate',
    what: 'Opens only for a ghost of the matching colour. White gates accept any ghost.',
    quantum: 'A ghost is a qubit in a superposition of 0 and 1. Its colour is the relative phase between the two parts, a multiple of 90°. S adds 90°, Z adds 180°.',
  },
  eye: {
    title: 'The Eye',
    what: 'Step on it to look at the world: a ghost is forced to become Day or Night.',
    quantum: 'This is a measurement. It takes the qubit out of superposition and fixes it to 0 or 1, at random, with probabilities set by its amplitudes (50/50 for a ghost).',
  },
  door: {
    title: 'Magic door',
    what: 'You can only walk through when it is open. The Cat can flip it, standing next to it.',
    quantum: 'The door is a second qubit: closed is 0, open is 1. The Cat\'s CNOT flips it only if the world qubit is 1. On a ghost, CNOT entangles the two qubits.',
  },
  star: {
    title: 'Star',
    what: 'A collectible. Collect enough of them to unlock the finish.',
    quantum: 'Only a game score, not physics. The quantum puzzles are in reaching them.',
  },
  finish: {
    title: 'Finish',
    what: 'Ends the level. It stays grey and locked until you have enough stars.',
    quantum: 'A game rule, not physics.',
  },
  chaser: {
    title: 'Noise',
    what: 'A wisp that follows you through the maze. If it catches you, the level restarts.',
    quantum: 'It stands for decoherence: noise from the environment that disturbs qubits and destroys their quantum behaviour, so real quantum computers must work fast.',
  },
};

export function elementKey(ch) {
  if (ch === 'D') return 'bridgeDay';
  if (ch === 'N') return 'bridgeNight';
  if ('0123?'.includes(ch)) return 'gate';
  if (ch === 'E') return 'eye';
  if (ch === 'M') return 'door';
  if (ch === 'G') return 'finish';
  return null;
}

// Player-facing explanations that are not tied to one level.

export const HOWTO_HTML = `<h1>How to play</h1>
<h2>Your goal</h2>
<p>Reach the big star at the end of each maze. Some paths are blocked, and you open them by using quantum gates. Small stars are hidden in the maze: collect at least 2 of the 3 to unlock the next level (all 5 in the last level).</p>
<h2>Why you are doing it</h2>
<p>Every skill you use is a real quantum gate added to a real quantum circuit. What you see on screen (Day, Night, the ghost, the magic door) is read from that circuit. Playing the maze is playing with two qubits.</p>
<h2>What you are looking at</h2>
<ul>
<li><b>Day / Night</b> is the first qubit. State 0 is Day, state 1 is Night.</li>
<li><b>Ghost</b> means the qubit is in superposition: Day and Night at once. Only ghost gates open for a ghost.</li>
<li><b>Ghost colour</b> is the phase, shown on the qubit sphere at the bottom. It is invisible in plain Day or Night, but gates can check it.</li>
<li><b>The Eye</b> is a measurement. It forces a ghost to become Day or Night, at random.</li>
<li><b>The magic door</b> is the second qubit: closed is 0, open is 1.</li>
</ul>
<h2>Controls</h2>
<p>Arrow keys move. Press a letter (<b>X H S Z C</b>) to pick a character, then <b>Space</b> to use its skill. <b>R</b> restarts, <b>Q</b> asks for a hint, <b>N</b> opens the notebook, <b>Esc</b> opens the menu. Click the (i) under a character to learn who it is and what its gate does.</p>
<h2>The five gates</h2>
<ul>
<li><b>X (Owl)</b>: flips 0 and 1, like a NOT.</li>
<li><b>H (Goose)</b>: makes or undoes an equal superposition.</li>
<li><b>S (Lizard)</b>: quarter-turns the phase of the ghost.</li>
<li><b>Z (Octopus)</b>: half-turns the phase.</li>
<li><b>CNOT (Cat)</b>: flips the door if the world is Night.</li>
</ul>
<p>The left panel tells you what is happening right now. The right board is a cheat sheet for every maze element.</p>`;

// Who each character is and what its gate is in quantum computing.
export const CHAR_INFO = {
  X: {
    who: 'The Owl flips the world over: Day becomes Night and Night becomes Day.',
    gate: 'X gate (quantum NOT)',
    quantum: 'The X gate swaps the amplitudes of |0⟩ and |1⟩. It is the quantum version of a classical NOT, and it is how a quantum program writes a 1 into a qubit.',
    game: 'Space flips the world qubit. Pressed twice, you are back where you were.',
    math: 'X|0⟩ = |1⟩, X|1⟩ = |0⟩',
    line: 'Owl (X gate): flips the world, Day ⇄ Night. Press Space to use it.',
  },
  H: {
    who: 'The Goose turns the world into a ghost, or folds a ghost back into a single world.',
    gate: 'H gate (Hadamard)',
    quantum: 'The Hadamard gate turns a definite |0⟩ or |1⟩ into an equal superposition, and back. It is how superposition starts, and almost every quantum algorithm begins with it.',
    game: 'Space puts the world in Day and Night at once (Ghost Mode). Pressed again on a plain ghost, it returns to a certain world.',
    math: 'H|0⟩ = (|0⟩ + |1⟩)/√2, H|1⟩ = (|0⟩ − |1⟩)/√2',
    line: 'Goose (H gate): puts the world in Day AND Night at once, or folds the ghost back.',
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
    quantum: 'The Z gate flips the sign of |1⟩, a 180-degree phase turn. It equals two S gates, and it is a key ingredient of quantum error correction.',
    game: 'Space jumps the ghost colour two slots, to the opposite side of the sphere.',
    math: 'Z|0⟩ = |0⟩, Z|1⟩ = −|1⟩',
    line: 'Octopus (Z gate): half-turns the ghost colour, two slots at once.',
  },
  C: {
    who: 'The Cat links the magic door to the world.',
    gate: 'CNOT gate (controlled NOT)',
    quantum: 'CNOT acts on two qubits: it flips the second (target) only if the first (control) is |1⟩. Applied to a superposition it entangles the qubits, so they share one fate.',
    game: 'Stand next to a magic door and press Space: the door flips if the world is Night, and does nothing in Day.',
    math: 'CNOT|00⟩ = |00⟩, CNOT|10⟩ = |11⟩ (control first)',
    line: 'Cat (CNOT gate): links the door to the world: flips the door if it is Night. Stand next to a door.',
  },
};

// Named combos (section 9) and the text circuit drawing.
export const COMBOS = [
  { name: 'Double flip', seq: ['X', 'X'], result: 'Back to Day.' },
  { name: 'Return', seq: ['H', 'H'], result: 'Day again, with certainty.' },
  { name: 'Trap', seq: ['H', 'EYE'], result: 'Day or Night, 50/50.' },
  { name: 'Quarter', seq: ['H', 'S', 'H'], result: 'Still a ghost. The Eye gives 50/50.' },
  { name: 'Two quarters', seq: ['H', 'S', 'S', 'H'], result: 'Night, with certainty.' },
  { name: 'Half', seq: ['H', 'Z', 'H'], result: 'Night, with certainty.' },
  { name: 'Full turn', seq: ['S', 'S', 'S', 'S'], result: 'Nothing changed.' },
  { name: 'Key', seq: ['X', 'CNOT'], result: 'Night, and the door opens.' },
  { name: 'Magic door', seq: ['H', 'CNOT', 'EYE'], result: 'Night + open, or Day + closed. Never mixed.' },
];

// history: [{ t: token, before: { world, door } }] ; combos assume a Day, closed start.
export function matchCombo(history) {
  let best = null;
  for (const c of COMBOS) {
    const n = c.seq.length;
    if (history.length < n) continue;
    const tail = history.slice(history.length - n);
    if (!tail.every((h, i) => h.t === c.seq[i])) continue;
    if (!(tail[0].before.world === 'day' && tail[0].before.door === 'closed')) continue;
    if (!best || n > best.seq.length) best = c;
  }
  return best;
}

export function renderCircuit(tokens) {
  let l0 = 'q0: ─';
  let l1 = 'q1: ─';
  for (const t of tokens) {
    if (t === 'CNOT') { l0 += '●─'; l1 += '⊕─'; }
    else if (t === 'XD') { l0 += '──'; l1 += 'X─'; }
    else if (t === 'EYE') { l0 += 'M─'; l1 += 'M─'; }
    else { l0 += t + '─'; l1 += '──'; }
  }
  return l0 + '\n' + l1;
}

// Right-hand reference board: a cheat sheet for every maze element.
import { drawSwatch, SLOT_COLORS, SLOT_NAMES } from './render.js';

const GHOST = { world: 'ghost', door: 'closed', slot: 0 };
const DAY = { world: 'day', door: 'closed', slot: null };
const NIGHT = { world: 'night', door: 'closed', slot: null };

// swatch: [tile char, layer, vis]; rows: [label, text]
const ENTRIES = [
  { title: 'Day bridge', swatches: [['D', 'day', DAY]],
    rows: [['Colour', 'Warm wooden planks over blue water.'], ['What', 'A bridge that only exists in Day (state 0). In Night or Ghost Mode it is water.'],
      ['How', 'Be in Day. Flip back with the Owl (X), or fold a ghost with H.']] },
  { title: 'Night bridge', swatches: [['N', 'night', NIGHT]],
    rows: [['Colour', 'Glowing purple planks over black water.'], ['What', 'A bridge that only exists in Night (state 1).'],
      ['How', 'Flip with the Owl (X), use a half turn then H (H Z H), or win an Eye.']] },
  { title: 'Ghost gate', swatches: SLOT_COLORS.map((c, i) => [String(i), 'day', { ...GHOST, slot: i }]).concat([['?', 'day', GHOST]]),
    rows: [['Colour', SLOT_NAMES.map((n, i) => `${n} = slot ${i}`).join(', ') + '; white = any ghost.'],
      ['What', 'A gate that opens only for a ghost whose colour matches (see the sphere).'],
      ['How', 'Goose (H) makes the ghost, Lizard (S) adds a quarter turn, Octopus (Z) adds two.']] },
  { title: 'The Eye', swatches: [['E', 'day', DAY], ['E', 'day', GHOST]],
    rows: [['Colour', 'Dull and half-shut: nothing to measure. Glowing and open: ready.'],
      ['What', 'A measurement. It forces a ghost to become Day or Night at random, and settles a linked door.'],
      ['How', 'Step on it.'],
      ['When', 'Use it when you are a ghost and need the world to pick, e.g. for a Night bridge or to settle the door. Avoid it if you want to keep the ghost: fold it back with H first.']] },
  { title: 'Magic door', swatches: [['M', 'day', { ...DAY, door: 'closed' }], ['M', 'day', { ...DAY, door: 'open' }], ['M', 'day', { ...DAY, door: 'flicker' }]],
    rows: [['Colour', 'Brown: closed (0). Purple glow: open (1). Flickering: linked to the world.'],
      ['What', 'The second qubit. You can only walk through when it is open.'],
      ['How', 'Stand next to it and use the Cat (CNOT) at Night. Or make a ghost, link with the Cat, then step on the Eye.']] },
  { title: 'Stars', swatches: [['*', 'day', DAY]],
    rows: [['What', 'Collect at least 2 of the 3 stars to unlock the finish (all 5 in the last level).']] },
  { title: 'Finish', swatches: [['G', 'day', { ...DAY, locked: true }], ['G', 'day', DAY]],
    rows: [['What', 'Grey and locked until you have enough stars. Gold when open.']] },
];

export function createBoard(doc) {
  const root = doc.getElementById('board');
  const cvs = [];
  root.innerHTML = '<h2>Maze cheat sheet</h2>';
  for (const e of ENTRIES) {
    const box = doc.createElement('div');
    box.className = 'entry';
    const sw = doc.createElement('div');
    sw.className = 'swatches';
    for (const [ch, layer, vis] of e.swatches) {
      const cv = doc.createElement('canvas');
      cv.width = 32; cv.height = 32;
      sw.append(cv);
      cvs.push({ cv, ch, layer, vis });
    }
    const h = doc.createElement('h3');
    h.textContent = e.title;
    const dl = doc.createElement('div');
    dl.className = 'rows';
    dl.innerHTML = e.rows.map(([k, v]) => `<div><b>${k}:</b> ${v}</div>`).join('');
    box.append(h, sw, dl);
    root.append(box);
  }
  function redraw(t) { for (const c of cvs) drawSwatch(c.cv, c.ch, c.layer, c.vis, t); }
  redraw(0);
  return { redraw };
}

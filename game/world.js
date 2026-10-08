// Tile rules, movement, collision, and the statevector -> visuals mapping.

export const CHARACTERS = {
  X: { key: 'X', name: 'Owl', gate: 'X', skill: 'Flip' },
  H: { key: 'H', name: 'Goose', gate: 'H', skill: 'Ghost' },
  S: { key: 'S', name: 'Lizard', gate: 'S', skill: 'Quarter turn' },
  Z: { key: 'Z', name: 'Octopus', gate: 'Z', skill: 'Half turn' },
  C: { key: 'C', name: 'Cat', gate: 'CNOT', skill: 'Link' },
};
export const CHAR_ORDER = ['X', 'H', 'S', 'Z', 'C'];

export function parseLevel(level) {
  const w = Math.max(...level.map.map((r) => r.length));
  const tiles = level.map.map((r) => r.padEnd(w, '#').split(''));
  let start = { x: 1, y: 1 };
  tiles.forEach((row, y) => row.forEach((ch, x) => {
    if (ch === 'P') { start = { x, y }; row[x] = '.'; }
  }));
  return { w, h: tiles.length, tiles, start };
}

export function tileAt(grid, x, y) {
  if (x < 0 || y < 0 || y >= grid.h || x >= grid.w) return '#';
  return grid.tiles[y][x];
}

// vis: { world: 'day'|'night'|'ghost', door: 'closed'|'open'|'flicker', slot }
export function canEnter(ch, vis) {
  switch (ch) {
    case '#': return false;
    case 'D': return vis.world === 'day';
    case 'N': return vis.world === 'night';
    case '0': case '1': case '2': case '3':
      return vis.world === 'ghost' && vis.slot === Number(ch);
    case '?': return vis.world === 'ghost';
    case 'M': return vis.door === 'open';
    default: return true; // floor, Eye, goal
  }
}

export function nearDoor(grid, x, y) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(grid, x + dx, y + dy) === 'M');
}

const prob = (a) => a[0] * a[0] + a[1] * a[1];

export function phaseSlot(amps) {
  const pick = (idx) => idx.reduce((best, i) => (prob(amps[i]) > prob(amps[best]) ? i : best), idx[0]);
  const a0 = amps[pick([0, 2])];
  const a1 = amps[pick([1, 3])];
  const re = a1[0] * a0[0] + a1[1] * a0[1]; // a1 * conj(a0)
  const im = a1[1] * a0[0] - a1[0] * a0[1];
  const turns = Math.round(Math.atan2(im, re) / (Math.PI / 2));
  return ((turns % 4) + 4) % 4;
}

export function deriveVisuals(amps) {
  const pNight = prob(amps[1]) + prob(amps[3]);
  const pOpen = prob(amps[2]) + prob(amps[3]);
  const world = pNight < 0.01 ? 'day' : pNight > 0.99 ? 'night' : 'ghost';
  const door = pOpen < 0.01 ? 'closed' : pOpen > 0.99 ? 'open' : 'flicker';
  return { world, door, pNight, pOpen, slot: world === 'ghost' ? phaseSlot(amps) : null };
}

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
  const stars = (level.stars || []).map(([x, y]) => ({ x, y }));
  const chase = level.chase || { every: 3, delay: 8 };
  const chasers = (level.chasers || []).map(([x, y]) => ({ x, y }));
  return { w, h: tiles.length, tiles, start, stars, need: level.need || 2, chasers, chase };
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

// Bloch vector of qubit 0 (the world), from its reduced density matrix.
// z = +1 is Day (|0>), z = -1 is Night (|1>); x, y carry the phase of a ghost.
// A qubit entangled with the door has a shorter vector.
export function blochVector(amps) {
  const [a0, a1, a2, a3] = amps;
  const rho00 = prob(a0) + prob(a2);
  const rho11 = prob(a1) + prob(a3);
  // rho01 = a0*conj(a1) + a2*conj(a3)
  const re = a0[0] * a1[0] + a0[1] * a1[1] + a2[0] * a3[0] + a2[1] * a3[1];
  const im = a0[1] * a1[0] - a0[0] * a1[1] + a2[1] * a3[0] - a2[0] * a3[1];
  return { x: 2 * re, y: -2 * im, z: rho00 - rho11 };
}

// ---- the chaser ("Noise") ----
// It walks through every tile that is not a wall (noise ignores quantum rules)
// and takes one step towards the player along a shortest path. It moves only
// when the player moves: after `delay` player moves, then every `every` moves.
const STEP_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function chaserStep(grid, c, target) {
  if (c.x === target.x && c.y === target.y) return { x: c.x, y: c.y };
  const cache = grid._chase || (grid._chase = new Map());
  const key = (c.y * grid.w + c.x) * 4096 + target.y * grid.w + target.x;
  const hit = cache.get(key);
  if (hit) return hit;
  // BFS from the target so that every tile knows its distance; step to the neighbour that is closer
  const dist = new Map([[target.y * grid.w + target.x, 0]]);
  const queue = [[target.x, target.y]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of STEP_DIRS) {
      const nx = x + dx, ny = y + dy;
      if (tileAt(grid, nx, ny) === '#') continue;
      const k = ny * grid.w + nx;
      if (dist.has(k)) continue;
      dist.set(k, dist.get(y * grid.w + x) + 1);
      queue.push([nx, ny]);
    }
  }
  let best = { x: c.x, y: c.y }, bd = dist.has(c.y * grid.w + c.x) ? dist.get(c.y * grid.w + c.x) : Infinity;
  for (const [dx, dy] of STEP_DIRS) {
    const nx = c.x + dx, ny = c.y + dy;
    const d = dist.get(ny * grid.w + nx);
    if (d !== undefined && d < bd) { bd = d; best = { x: nx, y: ny }; }
  }
  cache.set(key, best);
  return best;
}

// Time bookkeeping shared by the game and the solver. t counts player moves,
// capped into a small cycle: 0..delay, then delay+1 .. delay+every.
export function chaseNext(chase, t) {
  const { every, delay } = chase;
  const t2 = t < delay ? t + 1 : t === delay + every ? delay + 1 : t + 1;
  return { t: t2, step: t2 === delay + every };
}

// Number of steps the chaser needs to reach the target (walls only block it).
export function chaserDistance(grid, c, target) {
  const w = grid.w;
  const dist = new Map([[c.y * w + c.x, 0]]);
  const queue = [[c.x, c.y]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x === target.x && y === target.y) return dist.get(y * w + x);
    for (const [dx, dy] of STEP_DIRS) {
      const nx = x + dx, ny = y + dy;
      if (tileAt(grid, nx, ny) === '#' || dist.has(ny * w + nx)) continue;
      dist.set(ny * w + nx, dist.get(y * w + x) + 1);
      queue.push([nx, ny]);
    }
  }
  return Infinity;
}

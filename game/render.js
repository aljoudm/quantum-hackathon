// Procedural pixel-art rendering: tiles, characters, palettes, ghost effect.
export const T = 48;      // tile size on the canvas
export const U = T / 16;  // size of one sprite pixel
export const COLS = 16;
export const ROWS = 10;
// Wheel slot colours: slot 0 at the top, then clockwise.
export const SLOT_COLORS = ['#ffd54f', '#4db6ac', '#ba68c8', '#ff8a65'];

const PAL = {
  day: { a: '#f1e3b3', b: '#e8d6a0', wall: '#8a6d3b', wallD: '#6b5229', voidC: '#8ecae6', voidD: '#6fb1d4', br: '#c08a4a', brD: '#8f6330', eye: '#ffffff', iris: '#2a9d8f', door: '#7b5a3c' },
  night: { a: '#343a6b', b: '#2c3260', wall: '#1a1c3a', wallD: '#101226', voidC: '#0b0c1f', voidD: '#15173a', br: '#8f7be8', brD: '#6a57c4', eye: '#e0e0ff', iris: '#ff6f91', door: '#4a3a6b' },
};

// Each character: list of [x, y, w, h, colour] rectangles on a 16x16 grid, plus foot colour.
const SPRITES = {
  X: { feet: '#ff9800', body: [ // Owl
    [3, 1, 2, 3, '#5a4430'], [11, 1, 2, 3, '#5a4430'], [3, 3, 10, 10, '#8d6e4a'], [5, 8, 6, 5, '#d7b98a'],
    [4, 4, 3, 3, '#ffffff'], [9, 4, 3, 3, '#ffffff'], [5, 5, 2, 2, '#111111'], [9, 5, 2, 2, '#111111'], [7, 7, 2, 2, '#ff9800'],
  ] },
  H: { feet: '#ff9800', body: [ // Goose
    [3, 7, 2, 2, '#fafafa'], [4, 6, 9, 6, '#fafafa'], [6, 7, 4, 3, '#cfd8dc'], [10, 2, 3, 6, '#fafafa'],
    [10, 1, 4, 3, '#ffffff'], [14, 2, 2, 2, '#ff9800'], [12, 2, 1, 1, '#111111'],
  ] },
  S: { feet: '#2e7d32', body: [ // Lizard
    [0, 9, 2, 2, '#43a047'], [1, 8, 4, 2, '#43a047'], [4, 6, 9, 6, '#66bb6a'], [5, 10, 7, 2, '#a5d6a7'],
    [10, 4, 5, 5, '#66bb6a'], [13, 5, 1, 1, '#111111'], [15, 7, 1, 1, '#e53935'], [6, 7, 1, 1, '#2e7d32'], [9, 7, 1, 1, '#2e7d32'],
  ] },
  Z: { feet: '#8e24aa', body: [ // Octopus
    [4, 1, 8, 7, '#ab47bc'], [3, 3, 10, 5, '#ab47bc'], [5, 4, 2, 2, '#ffffff'], [9, 4, 2, 2, '#ffffff'],
    [6, 5, 1, 1, '#111111'], [10, 5, 1, 1, '#111111'], [3, 8, 2, 4, '#ab47bc'], [6, 8, 2, 4, '#ab47bc'], [8, 8, 2, 4, '#ab47bc'], [11, 8, 2, 4, '#ab47bc'],
  ] },
  C: { feet: '#e65100', body: [ // Cat
    [3, 1, 2, 3, '#ffa726'], [11, 1, 2, 3, '#ffa726'], [4, 2, 1, 1, '#f48fb1'], [11, 2, 1, 1, '#f48fb1'],
    [3, 3, 10, 5, '#ffa726'], [4, 8, 8, 5, '#ffa726'], [7, 3, 2, 2, '#e65100'], [5, 5, 2, 2, '#c6ff00'], [9, 5, 2, 2, '#c6ff00'],
    [6, 5, 1, 2, '#111111'], [10, 5, 1, 2, '#111111'], [7, 7, 2, 1, '#f48fb1'], [1, 6, 3, 1, '#ffffff'], [12, 6, 3, 1, '#ffffff'],
    [12, 10, 3, 2, '#ffa726'], [14, 6, 1, 5, '#ffa726'],
  ] },
  none: { feet: '#bdbdbd', body: [ // not picked yet: plain spirit
    [4, 3, 8, 10, '#e0e0e0'], [3, 5, 10, 6, '#e0e0e0'], [5, 6, 2, 2, '#111111'], [9, 6, 2, 2, '#111111'],
  ] },
};

// Same 2-frame walk cycle for everyone: bob and swap feet.
export function drawSprite(ctx, key, x, y, scale = U, frame = 0, flip = false, alpha = 1) {
  const sp = SPRITES[key] || SPRITES.none;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (flip) { ctx.translate(16, 0); ctx.scale(-1, 1); }
  const bob = frame % 2 ? -1 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(3, 14, 10, 1);
  for (const [rx, ry, rw, rh, c] of sp.body) { ctx.fillStyle = c; ctx.fillRect(rx, ry + bob, rw, rh); }
  ctx.fillStyle = sp.feet;
  if (frame % 2) { ctx.fillRect(5, 13, 2, 2); ctx.fillRect(9, 13, 2, 1); }
  else { ctx.fillRect(5, 13, 2, 1); ctx.fillRect(9, 13, 2, 2); }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function tile(ch, tx, ty, ox, oy, layer, vis, t, parity) {
    const p = PAL[layer];
    ctx.save();
    ctx.translate((ox + tx) * T, (oy + ty) * T);
    ctx.scale(U, U);
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    const floor = () => r(0, 0, 16, 16, parity ? p.a : p.b);
    const water = () => {
      r(0, 0, 16, 16, p.voidC);
      const s = Math.floor(t / 400 + tx) % 4;
      r(2 + s, 4, 5, 1, p.voidD); r(9 - s, 11, 5, 1, p.voidD);
    };
    const bridge = () => {
      water();
      r(0, 2, 16, 12, p.br);
      r(0, 5, 16, 1, p.brD); r(0, 9, 16, 1, p.brD); r(0, 13, 16, 1, p.brD);
      r(0, 2, 16, 1, p.brD);
    };
    switch (ch) {
      case '#':
        r(0, 0, 16, 16, p.wall);
        r(0, 5, 16, 1, p.wallD); r(0, 10, 16, 1, p.wallD); r(8, 0, 1, 5, p.wallD); r(4, 5, 1, 5, p.wallD);
        r(12, 5, 1, 5, p.wallD); r(8, 10, 1, 6, p.wallD); r(0, 0, 16, 1, 'rgba(255,255,255,0.15)');
        break;
      case 'D': if (layer === 'day') bridge(); else water(); break;
      case 'N': if (layer === 'night') bridge(); else water(); break;
      case '0': case '1': case '2': case '3': case '?': {
        floor();
        const any = ch === '?';
        const slot = any ? -1 : Number(ch);
        const col = any ? '#ffffff' : SLOT_COLORS[slot];
        const open = vis.world === 'ghost' && (any || vis.slot === slot);
        r(1, 2, 2, 12, col); r(13, 2, 2, 12, col);
        if (open) {
          ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t / 250);
          r(1, 1, 14, 2, col);
        } else {
          ctx.globalAlpha = 0.85;
          r(5, 3, 1, 10, col); r(8, 3, 1, 10, col); r(11, 3, 1, 10, col);
        }
        ctx.globalAlpha = 1;
        // mini wheel: the slot this gate wants is lit
        const pip = [[7, 5], [10, 7], [7, 9], [4, 7]];
        pip.forEach(([x, y], i) => r(x, y, 2, 2, any || i === slot ? col : 'rgba(0,0,0,0.35)'));
        break;
      }
      case 'E': {
        floor();
        const live = vis.world === 'ghost' || vis.door === 'flicker';
        r(2, 5, 12, 6, p.eye); r(3, 4, 10, 8, p.eye);
        r(6, 4, 4, 8, p.iris); r(7, 5, 2, 6, '#111111');
        r(3, 4, 10, 1, '#111111'); r(3, 11, 10, 1, '#111111');
        if (!live) { r(2, 4, 12, 4, p.a === PAL.day.a ? '#b9a56b' : '#1f2350'); r(2, 8, 12, 1, '#111111'); }
        else { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t / 200); r(1, 3, 14, 10, p.iris); }
        break;
      }
      case 'M': {
        floor();
        const state = vis.door === 'flicker' ? (Math.floor(t / 130) % 2 ? 'open' : 'closed') : vis.door;
        if (state === 'closed') {
          r(2, 1, 12, 14, p.door); r(2, 5, 12, 1, 'rgba(0,0,0,0.3)'); r(2, 10, 12, 1, 'rgba(0,0,0,0.3)'); r(11, 7, 2, 2, '#ffd54f');
        } else {
          r(2, 1, 2, 14, p.door); r(12, 1, 2, 14, p.door); r(2, 1, 12, 2, p.door);
          ctx.globalAlpha = 0.6; r(4, 3, 8, 12, '#b388ff'); ctx.globalAlpha = 1;
        }
        break;
      }
      case 'G': {
        floor();
        const dy = Math.round(Math.sin(t / 300));
        r(7, 2 + dy, 2, 12, '#ffd54f'); r(2, 7 + dy, 12, 2, '#ffd54f'); r(5, 5 + dy, 6, 6, '#fff176');
        break;
      }
      default: floor();
    }
    ctx.restore();
  }

  function layerPass(layer, ox, oy, S, t, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    S.grid.tiles.forEach((row, y) => row.forEach((ch, x) => tile(ch, x, y, ox, oy, layer, S.vis, t, (x + y) % 2)));
    ctx.restore();
  }

  function draw(S, t) {
    const vis = S.vis;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ox = Math.floor((COLS - S.grid.w) / 2);
    const oy = Math.floor((ROWS - S.grid.h) / 2);
    if (vis.world === 'ghost') {
      layerPass('day', ox, oy, S, t, 0.5);
      layerPass('night', ox, oy, S, t, 0.5);
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = SLOT_COLORS[vis.slot];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      layerPass(vis.world, ox, oy, S, t, 1);
    }
    const px = (ox + S.vx) * T;
    const py = (oy + S.vy) * T;
    const frame = S.moving ? S.walkFrame : 0;
    if (vis.world === 'ghost') {
      const w = Math.sin(t / 180);
      drawSprite(ctx, S.active || 'none', px + w * 2, py, U, frame, S.facing < 0, 0.45);
      drawSprite(ctx, S.active || 'none', px - w * 2, py, U, frame, S.facing < 0, 0.45);
    } else {
      drawSprite(ctx, S.active || 'none', px, py, U, frame, S.facing < 0, 1);
    }
    // snap effect after a measurement
    const age = t - S.snapAt;
    if (age >= 0 && age < 450) {
      const k = 1 - age / 450;
      ctx.save();
      ctx.globalAlpha = 0.6 * k;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + T / 2, py + T / 2, (1 - k) * 90 + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  return { draw };
}

// HUD: character icons, combo bar, phase wheel, door status, hint box, cards, notebook.
import { CHARACTERS, CHAR_ORDER } from './world.js';
import { drawSprite, SLOT_COLORS } from './render.js';
import { COMBOS } from './combos.js';

export function createHud(doc, handlers = {}) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    level: $('level-name'), nbCount: $('achievements-count'), chars: $('chars'),
    bar: $('combo-bar'), wheel: $('wheel'), wheelLabel: $('wheel-label'), hint: $('hint-box'),
    card: $('card'), info: $('char-panel'), notebook: $('notebook'), flash: $('combo-flash'), toast: $('toast'), focus: $('focus-overlay'),
    canvas: $('game'),
  };
  const icons = {};
  for (const k of CHAR_ORDER) {
    const box = doc.createElement('div');
    box.className = 'char-icon';
    const cv = doc.createElement('canvas');
    cv.width = 48; cv.height = 48;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    drawSprite(g, k, 0, 0, 3, 0, false, 1);
    const key = doc.createElement('span');
    key.className = 'char-key';
    key.textContent = CHARACTERS[k].gate === 'CNOT' ? 'C' : k;
    const name = doc.createElement('span');
    name.className = 'char-name';
    name.textContent = CHARACTERS[k].name;
    const info = doc.createElement('button');
    info.className = 'char-info';
    info.textContent = 'ⓘ info';
    info.title = `Who is the ${CHARACTERS[k].name}?`;
    info.addEventListener('click', () => { if (handlers.onInfo) handlers.onInfo(k); });
    box.addEventListener('click', (e) => { if (!e.target.closest('.char-info') && handlers.onSelect) handlers.onSelect(k); });
    box.append(cv, key, name, info);
    el.chars.append(box);
    icons[k] = box;
  }

  function drawIcon(k, tint) {
    const g = icons[k].querySelector('canvas').getContext('2d');
    g.clearRect(0, 0, 48, 48);
    drawSprite(g, k, 0, 0, 3, 0, false, 1, tint);
  }
  function setGhost(on) { drawIcon('H', on ? 'black' : null); icons.H.classList.toggle('ghosted', on); }

  let toastTimer = 0;
  let flashTimer = 0;

  function setChars(available, active) {
    for (const k of CHAR_ORDER) {
      icons[k].classList.toggle('active', k === active);
      icons[k].classList.toggle('dim', !available.includes(k));
    }
  }
  function shake(k) {
    const box = icons[k];
    box.classList.remove('shake');
    void box.offsetWidth;
    box.classList.add('shake');
  }
  function setBar(tokens) {
    el.bar.textContent = tokens.length ? tokens.map((t) => (t === 'EYE' ? '👁' : t)).join(' → ') : '—';
  }
  // Qubit view: a slightly 3D Bloch-style sphere. North pole = state 0 (Day),
  // south pole = state 1 (Night), the equator = superposition (Ghost Mode).
  const DAY_C = '#ffd54f';
  const NIGHT_C = '#5c6bc0';
  function setWheel(slot, b = { x: 0, y: 0, z: 1 }) {
    const g = el.wheel.getContext('2d');
    const W = el.wheel.width;
    const cx = W / 2, cy = W / 2 + 2, R = W * 0.34;
    const A = -0.55, TILT = 0.45;
    const proj = (x, y, z) => {
      const xr = x * Math.cos(A) - y * Math.sin(A);
      const yr = x * Math.sin(A) + y * Math.cos(A);
      return { sx: cx + R * xr, sy: cy - R * (yr * Math.sin(TILT) + z * Math.cos(TILT)), front: yr * Math.cos(TILT) - z * Math.sin(TILT) < 0 };
    };
    g.clearRect(0, 0, W, W);
    // sphere body with shading
    const grad = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    grad.addColorStop(0, '#6a70b8'); grad.addColorStop(1, '#15163a');
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.stroke();
    // equator ring: back half dashed, front half solid
    const ring = (front) => {
      g.beginPath();
      let pen = false;
      for (let i = 0; i <= 64; i++) {
        const p = proj(Math.cos(i / 64 * 2 * Math.PI), Math.sin(i / 64 * 2 * Math.PI), 0);
        if (p.front === front) { if (!pen) { g.moveTo(p.sx, p.sy); pen = true; } else g.lineTo(p.sx, p.sy); } else pen = false;
      }
      g.stroke();
    };
    g.lineWidth = 2;
    g.setLineDash([3, 3]); g.strokeStyle = 'rgba(255,255,255,.35)'; ring(false); g.setLineDash([]);
    // vertical axis
    const n = proj(0, 0, 1), so = proj(0, 0, -1);
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(n.sx, n.sy); g.lineTo(so.sx, so.sy); g.stroke();
    // state arrow (shorter when the world is linked to the door)
    const len = Math.min(1, Math.hypot(b.x, b.y, b.z));
    const tip = proj(b.x, b.y, b.z);
    g.strokeStyle = '#ffffff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(tip.sx, tip.sy); g.stroke();
    g.fillStyle = slot === null ? (b.z > 0 ? DAY_C : b.z < 0 ? NIGHT_C : '#fff') : '#ffffff';
    if (len < 0.05) g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(tip.sx, tip.sy, 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke();
    // front half of the ring
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.85)'; ring(true);
    // phase slots on the ring
    for (let i = 0; i < 4; i++) {
      const p = proj(Math.cos(i * Math.PI / 2), Math.sin(i * Math.PI / 2), 0);
      const on = slot === i;
      g.globalAlpha = p.front || on ? 1 : 0.55;
      g.fillStyle = SLOT_COLORS[i];
      g.beginPath(); g.arc(p.sx, p.sy, on ? 7 : 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = on ? '#fff' : '#000'; g.lineWidth = on ? 2 : 1; g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = '#000'; g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(i), p.sx, p.sy + 0.5);
    }
    // poles
    g.font = 'bold 10px monospace'; g.textAlign = 'center';
    g.fillStyle = DAY_C; g.beginPath(); g.arc(n.sx, n.sy, 5, 0, Math.PI * 2); g.fill();
    g.fillText('0 Day', n.sx, n.sy - 13);
    g.fillStyle = NIGHT_C; g.beginPath(); g.arc(so.sx, so.sy, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c5cae9'; g.fillText('1 Night', so.sx, so.sy + 13);
    el.wheelLabel.textContent = slot === null ? 'Qubit view: the world is a definite state (arrow at a pole).' : 'Qubit view: ghost! The arrow is on the equator.';
  }
  function setHint(html, mode) {
    el.hint.innerHTML = html || '';
    el.hint.dataset.mode = mode || '';
    el.hint.hidden = !html;
  }
  function setSteps(steps, idx) {
    const shown = steps.slice(0, idx + 1);
    setHint(shown.map((s, i) => `<div class="step ${i < idx ? 'done' : 'now'}">${i < idx ? '✓ ' : '▶ '}${s}</div>`).join(''), 'steps');
  }
  function toast(msg, ms = 2200) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }
  function flashCombo(name) {
    el.flash.textContent = '★ ' + name + '!';
    el.flash.classList.remove('show');
    void el.flash.offsetWidth;
    el.flash.classList.add('show');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => el.flash.classList.remove('show'), 1800);
  }
  function setNotebookCount(n) { el.nbCount.textContent = `Achievements ${n}/${COMBOS.length} · N`; }
  function showCard(html) { el.card.innerHTML = html; el.card.hidden = false; }
  function hideCard() { el.card.hidden = true; }
  function showNotebook(entries) {
    const rows = COMBOS.map((c) => {
      const got = entries.find((e) => e.name === c.name);
      return got
        ? `<li><b>${c.name}</b> <code>${c.seq.map((t) => (t === 'EYE' ? 'Eye' : t)).join(' ')}</code><br><span>${c.result}</span></li>`
        : `<li class="locked"><b>???</b></li>`;
    }).join('');
    el.notebook.innerHTML = `<h2>Achievements</h2><ul>${rows}</ul><p class="small">Press N to close</p>`;
    el.notebook.hidden = false;
  }
  function showInfo(html) { el.info.innerHTML = html; el.info.hidden = false; }
  function hideInfo() { el.info.hidden = true; }
  function showTip(html, pos) {
    const t = $('tip');
    t.innerHTML = html;
    t.hidden = false;
    t.style.left = '0px'; t.style.top = '0px';
    const stage = $('stage');
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const w = t.offsetWidth, h = t.offsetHeight;
    // pos is the tile rectangle in stage pixels: put the pop-up beside it
    let x = pos.x + pos.w + 10;
    if (x + w > sw - 6) x = pos.x - w - 10;
    if (x < 6) x = Math.max(6, Math.min(sw - w - 6, pos.x));
    let y = pos.y + pos.h / 2 - h / 2;
    y = Math.max(6, Math.min(sh - h - 6, y));
    if (x < pos.x + pos.w && x + w > pos.x) y = pos.y > sh / 2 ? Math.max(6, pos.y - h - 10) : Math.min(sh - h - 6, pos.y + pos.h + 10);
    t.style.left = Math.round(x) + 'px'; t.style.top = Math.round(y) + 'px';
  }
  function hideTip() { $('tip').hidden = true; }
  function hideNotebook() { el.notebook.hidden = true; }
  function setNow(lines) {
    for (const [k, text] of Object.entries(lines)) {
      const node = $('now-' + k);
      if (!node) continue;
      if (node.textContent !== text) {
        node.textContent = text;
        node.classList.remove('changed'); void node.offsetWidth; node.classList.add('changed');
      }
      node.hidden = !text;
    }
  }
  function setMission(goal, why) { $('mission-goal').textContent = goal; $('mission-why').textContent = why || ''; }
  let lastStarCount = 0;
  function setStars(got, total, need) {
    const strip = $('star-strip');
    strip.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const sp = doc.createElement('span');
      sp.className = 'st' + (i < got ? ' got' : '') + (i < got && i >= lastStarCount && got > lastStarCount ? ' pop' : '');
      sp.textContent = i < got ? '★' : '☆';
      strip.append(sp);
    }
    const n = doc.createElement('span');
    n.className = 'need';
    n.textContent = got >= need ? 'finish unlocked' : `need ${need}`;
    strip.append(n);
    lastStarCount = got;
  }
  function setLevel(i, n, name) { el.level.textContent = `Level ${i} of ${n}: ${name}`; }
  function setFocusOverlay(visible) { el.focus.hidden = !visible; }

  return { setChars, shake, setBar, setWheel, setHint, setSteps, toast, flashCombo, setNotebookCount,
    showCard, hideCard, showTip, hideTip, showInfo, hideInfo, showNotebook, hideNotebook, setGhost, setNow, setMission, setStars, setLevel, setFocusOverlay, elements: el };
}

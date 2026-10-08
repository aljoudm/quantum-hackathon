// HUD: character icons, combo bar, phase wheel, door status, hint box, cards, notebook.
import { CHARACTERS, CHAR_ORDER } from './world.js';
import { drawSprite, SLOT_COLORS } from './render.js';
import { COMBOS } from './combos.js';

export function createHud(doc, handlers = {}) {
  const $ = (id) => doc.getElementById(id);
  const el = {
    level: $('level-name'), door: $('door-status'), nbCount: $('notebook-count'), chars: $('chars'),
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
  function setDoor(state) {
    el.door.textContent = 'Door: ' + (state === 'flicker' ? 'linked…' : state);
    el.door.dataset.state = state;
  }
  function setWheel(slot) {
    const g = el.wheel.getContext('2d');
    const c = 36;
    g.clearRect(0, 0, 72, 72);
    const dirs = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(c, c);
      g.arc(c, c, 32, dirs[i] - Math.PI / 4, dirs[i] + Math.PI / 4);
      g.closePath();
      g.globalAlpha = slot === null ? 0.15 : (i === slot ? 1 : 0.3);
      g.fillStyle = SLOT_COLORS[i];
      g.fill();
    }
    g.globalAlpha = 1;
    if (slot !== null) {
      g.strokeStyle = '#fff'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(dirs[slot]) * 28, c + Math.sin(dirs[slot]) * 28); g.stroke();
    }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(c, c, 4, 0, Math.PI * 2); g.fill();
    el.wheelLabel.textContent = slot === null ? 'Colour wheel (ghost only)' : 'Ghost colour';
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
  function setNotebookCount(n) { el.nbCount.textContent = `Notebook ${n}/${COMBOS.length} · N`; }
  function showCard(html) { el.card.innerHTML = html; el.card.hidden = false; }
  function hideCard() { el.card.hidden = true; }
  function showNotebook(entries) {
    const rows = COMBOS.map((c) => {
      const got = entries.find((e) => e.name === c.name);
      return got
        ? `<li><b>${c.name}</b> <code>${c.seq.map((t) => (t === 'EYE' ? 'Eye' : t)).join(' ')}</code><br><span>${c.result}</span></li>`
        : `<li class="locked"><b>???</b></li>`;
    }).join('');
    el.notebook.innerHTML = `<h2>Notebook</h2><ul>${rows}</ul><p class="small">Press N to close</p>`;
    el.notebook.hidden = false;
  }
  function showInfo(html) { el.info.innerHTML = html; el.info.hidden = false; }
  function hideInfo() { el.info.hidden = true; }
  function hideNotebook() { el.notebook.hidden = true; }
  function toggleMenu() { doc.getElementById('settings-menu').hidden = !doc.getElementById('settings-menu').hidden; }
  function closeMenu() { doc.getElementById('settings-menu').hidden = true; }
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
  function setStars(got, total, need) {
    const el2 = $('star-count');
    el2.textContent = `★ ${got}/${total} · need ${need}`;
    el2.classList.toggle('ok', got >= need);
  }
  function setLevel(i, n, name) { el.level.textContent = `Level ${i} of ${n}: ${name}`; }
  function setFocusOverlay(visible) { el.focus.hidden = !visible; }

  return { setChars, shake, setBar, setDoor, setWheel, setHint, setSteps, toast, flashCombo, setNotebookCount,
    showCard, hideCard, showInfo, hideInfo, showNotebook, hideNotebook, toggleMenu, closeMenu, setNow, setMission, setStars, setLevel, setFocusOverlay, elements: el };
}

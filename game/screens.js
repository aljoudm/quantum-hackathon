// Full-stage screens: main menu, level select, settings, how to play, pause.
import { drawSprite } from './render.js';
import { CHAR_ORDER } from './world.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function createScreens(doc, onAction) {
  const root = doc.getElementById('screen');
  let current = null;
  let sel = 0;

  const buttons = () => [...root.querySelectorAll('button[data-action]:not([disabled])')];
  function highlight() {
    const b = buttons();
    b.forEach((el, i) => el.classList.toggle('sel', i === sel));
  }

  function levelsHtml(ctx) {
    const cells = ctx.levels.map((lv, i) => {
      const open = ctx.unlocked(i);
      const best = ctx.progress.best[i] || 0;
      const total = ctx.starTotals[i];
      const stars = Array.from({ length: total }, (_, k) => (k < best ? '★' : '☆')).join('');
      const state = ctx.progress.cleared[i] ? 'cleared' : open ? 'open' : 'locked';
      return `<button class="lv ${state}" data-action="level" data-value="${i}" ${open ? '' : 'disabled'}>` +
        `<span class="lv-num">${open ? i + 1 : '🔒'}</span><span class="lv-name">${esc(lv.name)}</span>` +
        `<span class="lv-stars">${open ? stars : ''}</span></button>`;
    }).join('');
    return `<h1>Levels</h1><p class="small">Cleared levels can be replayed any time. Earn at least 2 ★ in a level to unlock the next one.</p>` +
      `<div class="lv-grid">${cells}</div><div class="row"><button data-action="back">Back</button></div>`;
  }

  function settingsHtml(ctx) {
    const row = (key, label, hint) =>
      `<button class="toggle ${ctx.settings[key] ? 'on' : ''}" data-action="toggle" data-value="${key}"><b>${ctx.settings[key] ? 'ON ' : 'OFF'}</b> ${label}<br><span class="small">${hint}</span></button>`;
    return `<h1>Settings</h1><div class="col">` +
      row('guide', 'Guide panel (left)', 'Mission, what is happening now, instructions and hints.') +
      row('tips', 'Element pop-ups', 'Explains each maze element the first time it appears. You can always click an element.') +
      row('calm', 'Calm effects', 'Turns off screen flashes and shaking.') +
      `</div><div class="row"><button data-action="reset">Reset progress</button><button data-action="back">Back</button></div>`;
  }

  const SCREENS = {
    menu: (ctx) => `<canvas id="menu-chars" width="270" height="48"></canvas><h1 class="title">Quantum Gate Maze</h1>` +
      `<p class="tag">Walk the maze. Learn five quantum gates.</p><div class="col">` +
      `<button data-action="start">${ctx.anyCleared ? 'Continue' : 'Start'}</button>` +
      `<button data-action="levels">Levels</button><button data-action="settings">Settings</button>` +
      `<button data-action="howto">How to play</button></div>`,
    levels: levelsHtml,
    settings: settingsHtml,
    howto: (ctx) => ctx.howto + `<div class="row">${ctx.firstRun ? '<button data-action="begin">Let\'s go!</button>' : '<button data-action="back">Back</button>'}</div>`,
    pause: (ctx) => `<h1>Paused</h1><div class="col">` +
      `<button data-action="resume">Resume</button>` +
      `<button data-action="levels">Levels</button><button data-action="settings">Settings</button>` +
      `<button data-action="howto">How to play</button><button data-action="menu">Main menu</button></div>`,
  };

  function show(name, ctx) {
    current = name;
    sel = 0;
    root.innerHTML = `<div class="screen-inner ${name}">${SCREENS[name](ctx)}</div>`;
    root.hidden = false;
    if (name === 'menu') {
      const cv = root.querySelector('#menu-chars');
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      CHAR_ORDER.forEach((k, i) => drawSprite(g, k, i * 54, 0, 3, 0, false, 1));
    }
    highlight();
  }
  function hide() { current = null; root.hidden = true; root.innerHTML = ''; }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-action]');
    if (b && !b.disabled) onAction(b.dataset.action, b.dataset.value);
  });

  return {
    show, hide,
    get current() { return current; },
    nav(dx, dy) {
      const n = buttons().length;
      if (!n) return;
      const grid = current === 'levels' ? 5 : 1;
      const step = dy ? dy * grid : dx;
      sel = Math.max(0, Math.min(n - 1, sel + step));
      highlight();
    },
    activate() {
      const b = buttons()[sel];
      if (b) onAction(b.dataset.action, b.dataset.value);
    },
  };
}

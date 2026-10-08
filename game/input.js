// Keyboard handling. Arrow keys move (WASD is not used because S is a gate key).
const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const LETTERS = { x: 'X', h: 'H', s: 'S', z: 'Z', c: 'C' };

export function createInput(canvas, onAction) {
  canvas.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    let action = null;
    if (ARROWS[e.key]) action = { type: 'move', dx: ARROWS[e.key][0], dy: ARROWS[e.key][1] };
    else if (e.key === ' ' || e.code === 'Space') action = { type: 'skill' };
    else if (e.key === 'Enter') action = { type: 'confirm' };
    else if (LETTERS[e.key.toLowerCase()]) action = { type: 'select', char: LETTERS[e.key.toLowerCase()] };
    else if (e.key.toLowerCase() === 'q') action = { type: 'hint' };
    else if (e.key.toLowerCase() === 'r') action = { type: 'restart' };
    else if (e.key.toLowerCase() === 'n') action = { type: 'notebook' };
    if (!action) return;
    e.preventDefault();
    if (e.repeat && action.type !== 'move') return;
    onAction(action);
  });
  // never let arrows / Space scroll the page, even if focus is elsewhere in the stage
  window.addEventListener('keydown', (e) => {
    if ((ARROWS[e.key] || e.key === ' ') && document.activeElement === canvas) e.preventDefault();
  });
}

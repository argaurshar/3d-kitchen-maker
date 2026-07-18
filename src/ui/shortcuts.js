import { undo, redo } from '../state/history.js';
import { moveItem } from '../state/actions.js';
import { store } from '../state/store.js';

// Central keyboard registry for global editing shortcuts. Item-interaction
// keys (Escape, Delete, o, f, WASD) stay with their owning modules; this
// file owns undo/redo and arrow-key nudging, and later the help overlay.
const NUDGE = 0.01;
const NUDGE_BIG = 0.1;

const ARROWS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function initShortcuts({ picker, onHelp } = {}) {
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    if (picker?.isDragging?.() || picker?.isPlacing?.()) return;

    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
      return;
    }
    if (mod && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    if (event.key === '?' || (event.shiftKey && event.key === '/')) {
      onHelp?.();
      return;
    }

    const dir = ARROWS[event.key];
    if (dir && !mod) {
      const id = picker?.getSelectedId?.();
      if (!id) return;
      const item = store.get().items.find((i) => i.id === id);
      if (!item?.position) return;
      event.preventDefault();
      const step = event.shiftKey ? NUDGE_BIG : NUDGE;
      moveItem(id, [item.position[0] + dir[0] * step, item.position[1] + dir[1] * step]);
    }
  });
}

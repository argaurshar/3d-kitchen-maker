import { store } from './store.js';

// Undo/redo engine. Snapshots the whole scene as JSON strings (cheap
// equality, ~5-20 KB each) on a debounce, so slider drags and gizmo moves
// coalesce into single history steps. Replays go through store.replace,
// which the projection layer treats as a full rebuild.
const DEBOUNCE_MS = 300;
const CAP = 50;

let past = [];
let present = null;
let future = [];
let timer = null;
let applying = false;
let isDragging = () => false;
// Any held pointer (3D gizmo drag OR a DOM slider drag) defers captures, so
// a whole gesture always coalesces into a single history step.
let pointerDown = false;
window.addEventListener('pointerdown', () => (pointerDown = true), true);
window.addEventListener('pointerup', () => (pointerDown = false), true);
window.addEventListener('pointercancel', () => (pointerDown = false), true);

const busy = () => pointerDown || isDragging();

function capture() {
  const snapshot = JSON.stringify(store.get());
  if (snapshot === present) return;
  if (present != null) {
    past.push(present);
    if (past.length > CAP) past.shift();
  }
  present = snapshot;
  future = [];
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    // A capture must never land mid-gesture; retry after it ends.
    if (busy()) return schedule();
    capture();
  }, DEBOUNCE_MS);
}

export function initHistory({ isDragging: dragProbe } = {}) {
  if (dragProbe) isDragging = dragProbe;
  present = JSON.stringify(store.get());
  store.subscribe(() => {
    if (applying) return;
    schedule();
  });
}

function apply(snapshot) {
  applying = true;
  clearTimeout(timer);
  try {
    store.replace(JSON.parse(snapshot));
  } finally {
    applying = false;
  }
}

export function undo() {
  clearTimeout(timer);
  if (!busy()) capture(); // fold any pending edits in first
  if (!past.length) return { ok: false, reason: 'nothing to undo' };
  future.push(present);
  present = past.pop();
  apply(present);
  return { ok: true };
}

export function redo() {
  if (!future.length) return { ok: false, reason: 'nothing to redo' };
  past.push(present);
  present = future.pop();
  apply(present);
  return { ok: true };
}

export function historyDepth() {
  return { past: past.length, future: future.length };
}

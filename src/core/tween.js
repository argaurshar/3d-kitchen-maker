// Minimal tween pool, driven from the render loop.
const active = new Set();

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function tween({ from, to, duration = 350, onUpdate, onDone }) {
  const state = { from, to, duration, onUpdate, onDone, elapsed: 0 };
  active.add(state);
  return () => active.delete(state);
}

export function updateTweens(dtSeconds) {
  for (const t of [...active]) {
    t.elapsed += dtSeconds * 1000;
    const raw = Math.min(t.elapsed / t.duration, 1);
    t.onUpdate(t.from + (t.to - t.from) * easeInOut(raw));
    if (raw >= 1) {
      active.delete(t);
      t.onDone?.();
    }
  }
}

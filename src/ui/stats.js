import { el } from './controls.js';

// Dev-only FPS + draw-call overlay, toggled with "f".
export function createStats(renderer) {
  const node = el('div', 'stats hidden');
  document.body.appendChild(node);
  let frames = 0;
  let last = performance.now();

  window.addEventListener('keydown', (event) => {
    if (event.key === 'f') node.classList.toggle('hidden');
  });

  return {
    tick() {
      frames += 1;
      const now = performance.now();
      if (now - last < 500) return;
      const fps = (frames * 1000) / (now - last);
      frames = 0;
      last = now;
      if (!node.classList.contains('hidden')) {
        node.textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} calls · ${renderer.info.render.triangles} tris`;
      }
    },
  };
}

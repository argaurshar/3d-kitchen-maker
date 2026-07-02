import { applyOpenAmount } from '../build/fronts.js';

// Temporary "Open Doors" feature: the "o" key tweens every openable front
// (doors pivot on their hinge, drawers slide out). Becomes a real toolbar
// feature in a later prompt.
const SPEED = 2.2; // full transition in ~0.45s

export function createOpenDoors(scene) {
  let target = 0;
  let current = 0;

  window.addEventListener('keydown', (event) => {
    if (event.key === 'o') target = target > 0.5 ? 0 : 1;
  });

  function applyAll(amount) {
    scene.traverse((node) => {
      if (node.userData?.openable) applyOpenAmount(node, amount);
    });
  }

  return {
    // Jump straight to a state (used by the debug API for screenshots).
    set(amount) {
      target = amount;
      current = amount;
      applyAll(amount);
    },
    update(dt) {
      if (current === target) return;
      const step = SPEED * dt;
      current = current < target ? Math.min(target, current + step) : Math.max(target, current - step);
      // Ease with smoothstep so the motion reads as furniture, not a robot.
      const eased = current * current * (3 - 2 * current);
      applyAll(eased);
    },
  };
}

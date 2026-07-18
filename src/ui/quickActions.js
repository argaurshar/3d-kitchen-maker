import * as THREE from 'three';
import { store } from '../state/store.js';
import { rotateItem, duplicateItem, removeItem } from '../state/actions.js';
import { el } from './controls.js';

// On-selection quick actions: a small screen-projected button row under the
// selected item — rotate 90°, duplicate, materials, delete — so the common
// edits don't require the panel or a tool switch. Follows the runButtons
// pattern: reprojected per frame with an integer-pixel jitter guard.
const PAINTABLE = ['doorFront', 'drawerFront', 'worktop', 'seat', 'applianceBody', 'carcass'];

export function createQuickActions({ camera, renderer, projection, picker, paint }) {
  const v = new THREE.Vector3();
  const bar = el('div', 'quick-actions hidden');
  document.body.appendChild(bar);

  const id = () => picker.getSelectedId();
  const make = (html, title, onClick) => {
    const btn = el('button', 'qa-btn');
    btn.innerHTML = html;
    btn.title = title;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    bar.appendChild(btn);
  };

  make('⟳', 'Rotate 90°', () => id() && rotateItem(id(), -Math.PI / 2));
  make('⧉', 'Duplicate', () => {
    const result = id() && duplicateItem(id());
    if (result?.ok) picker.select(result.id);
  });
  make('◐', 'Materials', () => {
    const group = id() && projection.getItemGroup(id());
    if (!group) return;
    let target = null;
    group.traverse((n) => {
      if (!target && n.isMesh && PAINTABLE.includes(n.userData.surfaceRole)) target = n;
    });
    if (!target) return;
    paint.openAt({ object: target, point: target.getWorldPosition(new THREE.Vector3()) });
  });
  make('🗑', 'Delete (undo with Ctrl+Z)', () => {
    const itemId = id();
    if (!itemId) return;
    picker.select(null);
    removeItem(itemId);
  });

  const lastPos = { x: -1, y: -1 };
  return {
    update(dragging) {
      const itemId = id();
      const item = itemId && store.get().items.find((i) => i.id === itemId);
      if (!item?.position || dragging || paint.isOpen()) {
        bar.classList.add('hidden');
        return;
      }
      v.set(item.position[0], 0.02, item.position[1]).project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      bar.classList.toggle('hidden', !visible);
      if (!visible) return;
      const dom = renderer.domElement;
      const x = Math.round(((v.x + 1) / 2) * dom.clientWidth);
      const y = Math.round(((1 - v.y) / 2) * dom.clientHeight) + 44;
      // Integer-pixel guard: never rewrite an unchanged position, or the
      // buttons are unstable for pointer input.
      if (x === lastPos.x && y === lastPos.y) return;
      lastPos.x = x;
      lastPos.y = y;
      bar.style.left = `${x}px`;
      bar.style.top = `${y}px`;
    },
  };
}

import * as THREE from 'three';
import { store } from '../state/store.js';
import { addModule, moveItem, addItem, setUnitParam } from '../state/actions.js';
import { el } from './controls.js';
import { DIMS } from '../state/schema.js';

const rot2 = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
const runWidth = (item) => (item.modules ?? []).reduce((s, m) => s + m.width, 0);

// Screen-space overlay for the selected run: round "+" buttons just outside
// each end (append/prepend a module) and two pill actions above it.
// Repositioned every frame from projected world anchors.
export function createRunButtons({ camera, renderer }) {
  let itemId = null;
  const v = new THREE.Vector3();

  const plusLeft = el('button', 'plus-btn hidden', '+');
  const plusRight = el('button', 'plus-btn hidden', '+');
  const pillWall = el('button', 'pill-btn hidden', 'Add wall cabinet');
  const pillTall = el('button', 'pill-btn hidden', 'Switch to tall unit');
  document.body.append(plusLeft, plusRight, pillWall, pillTall);

  const item = () => store.get().items.find((i) => i.id === itemId);

  plusRight.addEventListener('click', () => itemId && addModule(itemId));
  plusLeft.addEventListener('click', () => {
    const it = item();
    if (!it) return;
    const result = addModule(itemId, 'start');
    if (!result.ok) return;
    // Prepending grows the run away from its origin; shift the origin back
    // so the existing modules stay put and the new one appears at this end.
    const rot = it.rotationY ?? 0;
    const [dx, dz] = rot2(0.6, 0, rot);
    moveItem(itemId, [it.position[0] - dx, it.position[1] - dz]);
  });

  pillWall.addEventListener('click', () => {
    const it = item();
    if (!it) return;
    addItem({
      kind: 'run',
      unitType: 'wall',
      position: [...it.position],
      rotationY: it.rotationY ?? 0,
      worktop: false,
      plinth: false,
      materials: { ...it.materials },
      modules: (it.modules ?? []).map((m, i) => ({
        type: 'cabinet',
        width: m.width,
        handle: m.handle ?? 'bar',
        compartments: [
          { type: 'door', style: { hinge: i % 2 ? 'R' : 'L', glass: false }, shelvesInside: 1, weight: 1 },
        ],
      })),
    });
  });

  pillTall.addEventListener('click', () => {
    const it = item();
    if (!it) return;
    setUnitParam(itemId, 'unitType', (it.unitType ?? 'base') === 'tall' ? 'base' : 'tall');
  });

  function place(button, world) {
    v.copy(world).project(camera);
    const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
    button.classList.toggle('hidden', !visible);
    if (!visible) return;
    const dom = renderer.domElement;
    button.style.left = `${((v.x + 1) / 2) * dom.clientWidth}px`;
    button.style.top = `${((1 - v.y) / 2) * dom.clientHeight}px`;
  }

  function hideAll() {
    for (const b of [plusLeft, plusRight, pillWall, pillTall]) b.classList.add('hidden');
  }

  return {
    setItem(id) {
      itemId = id;
    },

    update(dragging) {
      const it = itemId && item();
      if (!it || it.kind !== 'run' || dragging) return hideAll();
      const rot = it.rotationY ?? 0;
      const rw = runWidth(it);
      const [px, pz] = it.position;
      const unitType = it.unitType ?? 'base';
      const midY = unitType === 'wall' ? DIMS.wallUnitMount + 0.35 : 0.45;
      const topY = unitType === 'tall' ? DIMS.tallHeight + 0.15 : unitType === 'wall' ? DIMS.wallUnitMount + DIMS.wallUnitHeight + 0.15 : 1.05;

      const anchor = (lx, ly, lz) => {
        const [ax, az] = rot2(lx, lz, rot);
        return v.set(px + ax, ly, pz + az).clone();
      };
      pillTall.textContent = unitType === 'tall' ? 'Switch to base unit' : 'Switch to tall unit';
      place(plusLeft, anchor(-0.28, midY, 0.3));
      place(plusRight, anchor(rw + 0.28, midY, 0.3));
      place(pillWall, anchor(rw / 2, topY, 0.3));
      place(pillTall, anchor(rw / 2, topY + 0, 0.3));
      // Stack the pills vertically in screen space.
      if (!pillTall.classList.contains('hidden')) {
        pillTall.style.top = `${parseFloat(pillWall.style.top || '0') + 34}px`;
      }
      pillWall.classList.toggle('hidden', pillWall.classList.contains('hidden') || unitType !== 'base');
    },
  };
}

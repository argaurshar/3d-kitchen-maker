import * as THREE from 'three';
import { highlightFor } from './highlight.js';
import { createGizmo } from './gizmo.js';
import { createPlacement } from './placement.js';
import { store } from '../state/store.js';

// Interaction coordinator: hover highlight, click select, escape deselect,
// and pointer routing to the gizmo (rotate) and placement (move) drags.
// OrbitControls are disabled for the duration of any drag.
export function createPicker({ scene, camera, renderer, controls, projection, panel, runButtons }) {
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line = { threshold: 0.001 };
  const pointer = new THREE.Vector2();
  const dom = renderer.domElement;

  const gizmo = createGizmo(scene);
  const placement = createPlacement(scene);

  let hoveredId = null;
  let selectedId = null;
  let dragging = null; // 'gizmo' | 'item'
  let downAt = null;

  function castFrom(event) {
    const rect = dom.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
  }

  function pick(event) {
    castFrom(event);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const hit of hits) {
      if (!hit.object.visible) continue;
      const ud = hit.object.userData;
      if (ud.gizmoDot) return { kind: 'gizmoDot', point: hit.point };
      if (ud.gizmo) continue;
      const id = ud.itemId;
      if (!id) continue;
      if (id === 'room' || id === 'studio') return { kind: 'floor', point: hit.point };
      return { kind: 'item', itemId: id, point: hit.point };
    }
    return { kind: 'none' };
  }

  function setHighlightVisible(id, visible) {
    const group = projection.getItemGroup(id);
    if (group) highlightFor(group).visible = visible;
  }

  function setHover(id) {
    if (hoveredId === id) return;
    if (hoveredId && hoveredId !== selectedId) setHighlightVisible(hoveredId, false);
    hoveredId = id;
    if (id && id !== selectedId) setHighlightVisible(id, true);
  }

  function select(id) {
    if (id === selectedId) return;
    if (selectedId) setHighlightVisible(selectedId, false);
    selectedId = id;
    panel.select(id);
    runButtons.setItem(id);
    if (!id) gizmo.detach();
    // highlight + gizmo sync happen in update() from the fresh group
  }

  // Discard leftover damping momentum without applying it: consume the
  // full delta in one update, then restore the camera pose. Otherwise the
  // tail of a previous orbit keeps moving the camera during item drags.
  function stopInertia() {
    const position = camera.position.clone();
    const target = controls.target.clone();
    const factor = controls.dampingFactor;
    controls.dampingFactor = 1;
    controls.update(); // consumes all momentum (jumping the camera)
    camera.position.copy(position); // undo the jump
    controls.target.copy(target);
    controls.dampingFactor = factor;
    controls.update(); // re-sync internals to the restored pose
  }

  function beginDrag(kind, pointerId) {
    dragging = kind;
    stopInertia();
    controls.enabled = false;
    dom.setPointerCapture(pointerId);
  }

  // Capture phase: when a drag begins, swallow the event so OrbitControls
  // (whose listeners are on the same element) never starts its own gesture —
  // otherwise its stale internal state fights the camera afterwards.
  dom.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return;
      downAt = [event.clientX, event.clientY];
      const hit = pick(event);
      let started = false;
      if (hit.kind === 'gizmoDot' && selectedId) {
        started = gizmo.startDrag(hit.point) && (beginDrag('gizmo', event.pointerId), true);
      } else if (hit.kind === 'item' && hit.itemId === selectedId) {
        started = placement.start(selectedId, hit.point) && (beginDrag('item', event.pointerId), true);
      }
      if (started) event.stopImmediatePropagation();
    },
    { capture: true }
  );

  dom.addEventListener('pointermove', (event) => {
    if (dragging === 'gizmo') {
      castFrom(event);
      gizmo.dragMove(raycaster, event.shiftKey || placement.getSnap());
      return;
    }
    if (dragging === 'item') {
      castFrom(event);
      placement.move(raycaster);
      return;
    }
    const hit = pick(event);
    setHover(hit.kind === 'item' ? hit.itemId : null);
    dom.style.cursor =
      hit.kind === 'gizmoDot' ? 'grab' : hit.kind === 'item' ? 'pointer' : '';
  });

  dom.addEventListener('pointerup', (event) => {
    if (dragging) {
      dragging = null;
      controls.enabled = true;
      placement.end();
      gizmo.endDrag();
      dom.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (!downAt) return;
    const moved = Math.hypot(event.clientX - downAt[0], event.clientY - downAt[1]);
    downAt = null;
    if (moved > 5) return; // was an orbit, not a click
    const hit = pick(event);
    if (hit.kind === 'item') select(hit.itemId);
    else if (hit.kind === 'floor') select(null);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') select(null);
  });

  function update() {
    if (selectedId) {
      const group = projection.getItemGroup(selectedId);
      const item = store.get().items.find((i) => i.id === selectedId);
      if (!group || !item) {
        select(null);
      } else {
        highlightFor(group).visible = true; // re-decorate after rebuilds
        if (!gizmo.isDragging()) gizmo.sync(selectedId, group);
      }
    }
    runButtons.update(Boolean(dragging));
  }

  return {
    select,
    update,
    setSnap: (v) => placement.setSnap(v),
    getSelectedId: () => selectedId,
    isDragging: () => Boolean(dragging),
    gizmoDotWorld: () => gizmo.dot.getWorldPosition(new THREE.Vector3()).toArray(),
  };
}

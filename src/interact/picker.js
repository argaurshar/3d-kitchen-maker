import * as THREE from 'three';
import { highlightFor } from './highlight.js';
import { createGizmo } from './gizmo.js';
import { createPlacement } from './placement.js';
import { createGhost } from './ghost.js';
import { store } from '../state/store.js';
import { addItem, addFeature, removeItem as removeItemAction } from '../state/actions.js';

// Interaction coordinator: hover highlight, click select, escape deselect,
// and pointer routing to the gizmo (rotate) and placement (move) drags.
// OrbitControls are disabled for the duration of any drag.
export function createPicker({ scene, camera, renderer, controls, projection, panel, runButtons, paint, onPlacementEnd }) {
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line = { threshold: 0.001 };
  const pointer = new THREE.Vector2();
  const dom = renderer.domElement;

  const gizmo = createGizmo(scene);
  const placement = createPlacement(scene);
  const ghost = createGhost(scene);

  let tool = 'select'; // 'select' | 'paint' | 'delete'
  let suspended = false; // preview / walk modes own the pointer
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
    // Freshly added groups may not have rendered a frame yet; raycasting
    // reads matrixWorld directly, so keep it current.
    scene.updateMatrixWorld(true);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const hit of hits) {
      if (!hit.object.visible) continue;
      // Surfaces the camera is embedded in (e.g. orbiting into a wall's
      // skin) are never meaningful pick targets.
      if (hit.distance < 0.05) continue;
      const ud = hit.object.userData;
      if (ud.gizmoDot) return { kind: 'gizmoDot', point: hit.point };
      if (ud.gizmo) continue;
      const id = ud.itemId;
      if (!id) continue;
      if (id === 'room' || id === 'studio') return { kind: 'floor', point: hit.point, object: hit.object };
      return { kind: 'item', itemId: id, point: hit.point, object: hit.object };
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
      if (suspended || event.button !== 0) return;
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
    if (suspended) return;
    if (ghost.active()) {
      castFrom(event);
      ghost.update(raycaster, store.get(), placement.getSnap());
      return;
    }
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
    if (tool === 'paint') {
      paint?.hover(hit);
      return;
    }
    setHover(hit.kind === 'item' ? hit.itemId : null);
    dom.style.cursor =
      hit.kind === 'gizmoDot' ? 'grab' : hit.kind === 'item' ? 'pointer' : '';
  });

  dom.addEventListener('pointerup', (event) => {
    if (suspended) return;
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

    if (ghost.active()) {
      const commit = ghost.commit();
      if (!commit) return; // e.g. wall unit not wall-snapped yet
      const isFeature = commit.kind === 'feature';
      const result = isFeature ? addFeature(commit.targetItemId, commit.feature) : addItem(commit);
      if (result.ok) {
        ghost.cancel();
        select(isFeature ? commit.targetItemId : result.id);
        onPlacementEnd?.();
      }
      return;
    }
    const hit = pick(event);
    if (tool === 'delete') {
      if (hit.kind === 'item') {
        if (hit.itemId === selectedId) select(null);
        removeItemAction(hit.itemId);
      }
      return;
    }
    if (tool === 'paint') {
      paint?.click(hit);
      return;
    }
    if (hit.kind === 'item') select(hit.itemId);
    else if (hit.kind === 'floor') select(null);
  });

  dom.addEventListener('contextmenu', (event) => {
    if (ghost.active()) {
      event.preventDefault();
      cancelPlacement();
    }
  });

  function cancelPlacement() {
    if (!ghost.active()) return;
    ghost.cancel();
    dom.style.cursor = '';
    onPlacementEnd?.();
  }

  window.addEventListener('keydown', (event) => {
    if (suspended) return;
    if (event.key === 'Escape') {
      if (paint?.escape()) return;
      if (ghost.active()) cancelPlacement();
      else select(null);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId && !ghost.active()) {
      const id = selectedId;
      select(null);
      removeItemAction(id);
    }
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
    paint?.update();
  }

  return {
    select,
    update,
    setSnap: (v) => placement.setSnap(v),
    getSelectedId: () => selectedId,
    isDragging: () => Boolean(dragging),
    gizmoDotWorld: () => gizmo.dot.getWorldPosition(new THREE.Vector3()).toArray(),

    setTool(t) {
      if (tool === 'paint' && t !== 'paint') paint?.deactivate();
      tool = t;
      cancelPlacement();
      if (t !== 'select') select(null);
    },
    setSuspended(v) {
      suspended = Boolean(v);
      if (suspended) setHover(null);
    },
    getTool: () => tool,
    beginPlacement(kind) {
      select(null);
      ghost.begin(kind);
      dom.style.cursor = 'copy';
    },
    isPlacing: () => ghost.active(),

    // Harness helper: what a click at these client coords would hit.
    pickAt(clientX, clientY, raw = false) {
      const hit = pick({ clientX, clientY });
      if (!raw) return { kind: hit.kind, itemId: hit.itemId ?? null };
      castFrom({ clientX, clientY });
      scene.updateMatrixWorld(true);
      return raycaster.intersectObjects(scene.children, true).slice(0, 6).map((h) => ({
        name: h.object.name || h.object.type,
        itemId: h.object.userData.itemId ?? null,
        surfaceRole: h.object.userData.surfaceRole ?? null,
        visible: h.object.visible,
        d: Number(h.distance.toFixed(2)),
      }));
    },
  };
}

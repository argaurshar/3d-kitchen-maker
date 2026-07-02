import * as THREE from 'three';
import { buildRoom, updateWallVisibility, FLOOR_TOP_Y } from './room.js';
import { buildRun, unitContext } from '../build/run.js';
import { buildPlaceholder } from '../build/placeholder.js';
import { solveHeights } from '../build/compartments.js';
import { disposeGroup } from './dispose.js';
import { materialLibrary } from '../materials/library.js';
import { store } from '../state/store.js';

// Clay ("Solid") mode: every item mesh renders in one shared matte white.
// Real materials are pointer-swapped into userData and restored on toggle.
const clayMaterial = new THREE.MeshStandardMaterial({ color: 0xf0efec, roughness: 0.9, metalness: 0 });
clayMaterial.userData.shared = true;

function applyClay(group, on) {
  group.traverse((node) => {
    if (!node.isMesh) return;
    if (on && !node.userData.realMaterial) {
      node.userData.realMaterial = node.material;
      node.material = clayMaterial;
    } else if (!on && node.userData.realMaterial) {
      node.material = node.userData.realMaterial;
      delete node.userData.realMaterial;
    }
  });
}

// The 3D layer: a pure projection of the store's Scene JSON. Subscribes to
// the store and rebuilds only what a change affects (see CLAUDE.md).
export function createProjection(scene) {
  let roomGroup = null;
  let clay = false;
  const itemGroups = new Map(); // item id -> THREE.Group

  function rebuildRoom() {
    if (roomGroup) {
      scene.remove(roomGroup);
      disposeGroup(roomGroup);
    }
    roomGroup = buildRoom(store.get().room);
    scene.add(roomGroup);
  }

  function buildItemGroup(item) {
    if (item.kind === 'run') return buildRun(item, materialLibrary);
    if (item.kind === 'appliance' || item.kind === 'furniture') return buildPlaceholder(item);
    console.warn(`projection: no builder for item kind "${item.kind}" yet`);
    return new THREE.Group();
  }

  function removeItem(id) {
    const group = itemGroups.get(id);
    if (!group) return;
    scene.remove(group);
    disposeGroup(group);
    itemGroups.delete(id);
  }

  function rebuildItem(item) {
    removeItem(item.id);
    const group = buildItemGroup(item);
    group.position.y += FLOOR_TOP_Y; // items sit on the room floor plane
    if (clay) applyClay(group, true);
    itemGroups.set(item.id, group);
    scene.add(group);
    validateItem(item);
  }

  // Flag modules whose compartment stack can't fit (renders as the red
  // warning box). Generators stay pure; the projection owns the store write.
  // Converges: the write triggers one rebuild, after which flags match.
  function validateItem(item) {
    if (item.kind !== 'run') return;
    const index = store.get().items.findIndex((i) => i.id === item.id);
    if (index < 0) return;
    const ctx = unitContext(item);
    (item.modules ?? []).forEach((module, m) => {
      const invalid = Boolean(solveHeights(module.compartments ?? [], ctx.carcassHeight).error);
      if (Boolean(module.invalid) !== invalid) {
        store.set(`items.${index}.modules.${m}.invalid`, invalid);
      }
    });
  }

  function rebuildAllItems() {
    for (const id of [...itemGroups.keys()]) removeItem(id);
    for (const item of store.get().items) rebuildItem(item);
  }

  store.subscribe((change) => {
    if (change.type === 'replace') {
      rebuildRoom();
      rebuildAllItems();
      return;
    }
    const [head, index] = change.path.split('.');
    if (head === 'room') {
      rebuildRoom();
    } else if (head === 'items') {
      const item = store.get().items[Number(index)];
      if (index === undefined || !item) rebuildAllItems();
      else rebuildItem(item);
    }
  });

  rebuildRoom();
  rebuildAllItems();

  return {
    update(camera) {
      if (roomGroup) updateWallVisibility(roomGroup, camera);
    },
    getItemGroup(id) {
      return itemGroups.get(id) ?? null;
    },
    setClay(on) {
      clay = Boolean(on);
      for (const group of itemGroups.values()) applyClay(group, clay);
    },
    isClay: () => clay,
  };
}

import * as THREE from 'three';
import { buildRoom, updateWallVisibility, FLOOR_TOP_Y } from './room.js';
import { buildRun } from '../build/run.js';
import { disposeGroup } from './dispose.js';
import { materialLibrary } from '../materials/library.js';
import { store } from '../state/store.js';

// The 3D layer: a pure projection of the store's Scene JSON. Subscribes to
// the store and rebuilds only what a change affects (see CLAUDE.md).
export function createProjection(scene) {
  let roomGroup = null;
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
    itemGroups.set(item.id, group);
    scene.add(group);
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
  };
}

import * as THREE from 'three';
import { store } from '../state/store.js';
import { setUnitParam, setFurnitureParam, setRoomParam } from '../state/actions.js';
import { materialLibrary } from '../materials/library.js';
import { makeFloorMaterial, makeWallMaterial } from '../core/room.js';
import { createWheel } from '../ui/wheel.js';

// Paint tool: hover highlights the surface under the cursor, click opens
// the radial wheel anchored to the clicked 3D point. Hovering wheel
// segments live-previews by pointer-swapping materials; commit writes
// through actions; revert restores.
const FRONT_ROLES = new Set(['doorFront', 'drawerFront']);
const RUN_ROLES = { carcass: 'carcass', worktop: 'worktop', plinth: 'plinth' };

const hoverMaterial = new THREE.LineBasicMaterial({ color: 0xd7e34a, transparent: true, opacity: 0.95 });
hoverMaterial.userData.shared = true;

export function createPaintTool({ scene, camera, renderer, projection }) {
  const overlay = new THREE.Group();
  overlay.name = 'paint-hover';
  scene.add(overlay);
  const wheel = createWheel({
    onPreview: (id) => preview(id),
    onRevert: () => revert(),
    onCommit: (id) => commit(id),
  });

  let surface = null; // { targetKey, label, meshes, apply(swatchId) }
  let anchor = null;
  let previewed = null; // { material, owned }

  function collect(group, roles) {
    const meshes = [];
    group?.traverse((n) => n.isMesh && roles.has(n.userData.surfaceRole) && meshes.push(n));
    return meshes;
  }

  // Resolve a pick hit into a paintable surface descriptor.
  function surfaceFromHit(hit) {
    if (!hit?.object) return null;
    const { itemId, surfaceRole } = hit.object.userData;
    if (!itemId || itemId === 'studio') return null;
    const room = store.get().room;
    if (itemId === 'room') {
      const roomGroup = projection.getRoomGroup();
      if (surfaceRole === 'floor') {
        return {
          label: 'Floor',
          role: 'FLOOR',
          meshes: collect(roomGroup, new Set(['floor'])).filter((m) => m.name === 'roomFloor'),
          resolve: (id) => ({ material: makeFloorMaterial({ ...room, floorMaterial: id }, materialLibrary), owned: true }),
          apply: (id) => setRoomParam('floorMaterial', id),
        };
      }
      if (surfaceRole === 'wall') {
        return {
          label: 'Walls',
          role: 'WALL',
          meshes: collect(roomGroup, new Set(['wall'])),
          resolve: (id) => ({ material: makeWallMaterial({ ...room, wallColor: id }, materialLibrary), owned: true }),
          apply: (id) => setRoomParam('wallColor', id),
        };
      }
      return null;
    }
    const item = store.get().items.find((i) => i.id === itemId);
    const group = projection.getItemGroup(itemId);
    if (!item || !group) return null;
    if (item.kind === 'furniture' && surfaceRole === 'seat') {
      return {
        label: 'Seat',
        role: 'SEAT',
        meshes: collect(group, new Set(['seat'])),
        resolve: (id) => ({ material: materialLibrary.get(id), owned: false }),
        apply: (id) => setFurnitureParam(itemId, 'seatMaterial', id),
      };
    }
    if (item.kind !== 'run') return null;
    let slot = null;
    let roles = null;
    if (FRONT_ROLES.has(surfaceRole)) {
      slot = 'door';
      roles = FRONT_ROLES;
    } else if (RUN_ROLES[surfaceRole]) {
      slot = RUN_ROLES[surfaceRole];
      roles = new Set([surfaceRole]);
    } else {
      return null;
    }
    return {
      label: slot === 'door' ? 'Fronts' : slot[0].toUpperCase() + slot.slice(1),
      role: slot.toUpperCase(),
      meshes: collect(group, roles),
      resolve: (id) => ({ material: materialLibrary.get(id), owned: false }),
      apply: (id) => setUnitParam(itemId, `materials.${slot}`, id),
    };
  }

  function showHover(next) {
    clearOverlay();
    if (!next) return;
    for (const mesh of next.meshes) {
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), hoverMaterial);
      mesh.updateMatrixWorld();
      lines.matrix.copy(mesh.matrixWorld);
      lines.matrix.decompose(lines.position, lines.quaternion, lines.scale);
      lines.raycast = () => {};
      overlay.add(lines);
    }
  }

  function clearOverlay() {
    for (const child of [...overlay.children]) {
      child.geometry.dispose();
      overlay.remove(child);
    }
  }

  function preview(swatchId) {
    revert();
    if (!surface) return;
    const resolved = surface.resolve(swatchId);
    for (const mesh of surface.meshes) {
      mesh.userData.paintPrev = mesh.material;
      mesh.material = resolved.material;
    }
    previewed = resolved;
  }

  function revert() {
    if (!previewed || !surface) return;
    for (const mesh of surface.meshes) {
      if (mesh.userData.paintPrev) {
        mesh.material = mesh.userData.paintPrev;
        delete mesh.userData.paintPrev;
      }
    }
    if (previewed.owned) previewed.material.dispose();
    previewed = null;
  }

  function commit(swatchId) {
    if (!surface) return;
    // The store write rebuilds the affected groups, so the swapped meshes
    // are replaced wholesale — just drop preview bookkeeping first.
    if (previewed?.owned) previewed.material.dispose();
    previewed = null;
    surface.apply(swatchId);
    close();
  }

  function close() {
    revert();
    wheel.hide();
    clearOverlay();
    surface = null;
    anchor = null;
  }

  return {
    hover(hit) {
      if (wheel.isOpen()) return;
      const next = surfaceFromHit(hit);
      const changed = next?.meshes[0] !== surface?.meshes[0] || next?.role !== surface?.role;
      if (!changed) return;
      surface = next;
      showHover(next);
      renderer.domElement.style.cursor = next ? 'crosshair' : '';
    },

    click(hit) {
      if (wheel.isOpen()) {
        close();
        return;
      }
      this.openAt(hit);
    },

    // Direct entry used outside the paint tool (double-click, quick actions):
    // opens the wheel on the given hit without requiring a mode switch.
    openAt(hit) {
      const next = surfaceFromHit(hit);
      if (!next) return false;
      surface = next;
      showHover(next);
      anchor = hit.point.clone();
      wheel.show(next);
      return true;
    },

    // Reproject the anchor every frame so the wheel sticks while orbiting.
    update() {
      if (!wheel.isOpen() || !anchor) return;
      camera.updateMatrixWorld();
      const v = anchor.clone().project(camera);
      const dom = renderer.domElement;
      wheel.setScreen(((v.x + 1) / 2) * dom.clientWidth, ((1 - v.y) / 2) * dom.clientHeight, v.z < 1);
    },

    escape() {
      if (!wheel.isOpen()) return false;
      close();
      return true;
    },
    isOpen: () => wheel.isOpen(),
    deactivate: close,
  };
}

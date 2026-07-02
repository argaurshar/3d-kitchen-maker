import * as THREE from 'three';
import { FLOOR_TOP_Y } from '../core/room.js';
import { store } from '../state/store.js';
import { moveItem } from '../state/actions.js';
import { snapPosition } from './snapping.js';
import { rafThrottle } from '../ui/controls.js';

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_TOP_Y);

// Body drag: raycast the floor plane, apply snapping, moveItem. Also owns
// the faint yellow wall guide line shown while a wall snap is engaged.
export function createPlacement(scene) {
  let drag = null; // { itemId, grabOffset:[dx,dz] }
  let snapEnabled = false;

  // A thin flat strip reads far better than a 1px line against the
  // wall-floor shadow seam.
  const guide = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.006, 0.025),
    new THREE.MeshBasicMaterial({ color: 0xf0dd4a, transparent: true, opacity: 0.9 })
  );
  guide.visible = false;
  guide.raycast = () => {};
  scene.add(guide);

  const write = rafThrottle((id, pos, rot) => moveItem(id, pos, rot));

  function showGuide(wallId, room) {
    if (!wallId) {
      guide.visible = false;
      return;
    }
    const W2 = room.width / 2;
    const D2 = room.depth / 2;
    const inset = 0.05; // just inside the wall so it doesn't sink into the seam shadow
    const y = FLOOR_TOP_Y + 0.02;
    const placements = {
      N: { pos: [0, y, -D2 + inset], rotY: 0, length: room.width },
      S: { pos: [0, y, D2 - inset], rotY: 0, length: room.width },
      W: { pos: [-W2 + inset, y, 0], rotY: Math.PI / 2, length: room.depth },
      E: { pos: [W2 - inset, y, 0], rotY: Math.PI / 2, length: room.depth },
    };
    const p = placements[wallId];
    guide.position.set(...p.pos);
    guide.rotation.y = p.rotY;
    guide.scale.set(p.length, 1, 1);
    guide.visible = true;
  }

  return {
    setSnap(v) {
      snapEnabled = Boolean(v);
    },
    getSnap: () => snapEnabled,

    start(itemId, hitPoint) {
      const item = store.get().items.find((i) => i.id === itemId);
      if (!item) return false;
      drag = { itemId, grabOffset: [hitPoint.x - item.position[0], hitPoint.z - item.position[1]] };
      return true;
    },

    move(raycaster) {
      if (!drag) return;
      const scene_ = store.get();
      const item = scene_.items.find((i) => i.id === drag.itemId);
      const p = new THREE.Vector3();
      if (!item || !raycaster.ray.intersectPlane(floorPlane, p)) return;
      const snapped = snapPosition({
        position: [p.x - drag.grabOffset[0], p.z - drag.grabOffset[1]],
        rotationY: item.rotationY ?? 0,
        item,
        room: scene_.room,
        otherItems: scene_.items,
        snapEnabled,
      });
      showGuide(snapped.wallGuide, scene_.room);
      write(drag.itemId, snapped.position, snapped.rotationY);
    },

    end() {
      drag = null;
      guide.visible = false;
    },

    isDragging: () => Boolean(drag),
  };
}

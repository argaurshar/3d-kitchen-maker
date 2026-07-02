import * as THREE from 'three';
import { FLOOR_TOP_Y } from '../core/room.js';
import { store } from '../state/store.js';
import { moveItem } from '../state/actions.js';
import { rafThrottle } from '../ui/controls.js';

const RING_COLOR = 0x4a7fe3;
const SNAP_STEP = THREE.MathUtils.degToRad(15);
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_TOP_Y);

const rotate2 = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

// Flat blue rotation ring with one drag dot on its rim. Dragging the dot
// rotates the item around its bounding-center Y via moveItem (the position
// is re-derived so the center stays fixed while the origin orbits it).
export function createGizmo(scene) {
  const group = new THREE.Group();
  group.name = 'gizmo';
  group.visible = false;
  scene.add(group);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: RING_COLOR,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  let ring = null;
  let ringRadius = 0;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), new THREE.MeshBasicMaterial({ color: 0x76a1f0 }));
  dot.userData.gizmoDot = true;
  group.add(dot);

  let itemId = null;
  let center = new THREE.Vector3();
  let drag = null;
  const write = rafThrottle((id, pos, rot) => moveItem(id, pos, rot));

  function ensureRing(radius) {
    if (ring && Math.abs(radius - ringRadius) < 0.01) return;
    if (ring) {
      ring.geometry.dispose();
      group.remove(ring);
    }
    ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.012, radius + 0.012, 72), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.userData.gizmo = true;
    ringRadius = radius;
    group.add(ring);
  }

  function placeDot(rotationY) {
    dot.position.set(Math.sin(rotationY) * ringRadius, 0.02, Math.cos(rotationY) * ringRadius);
  }

  // Re-measure from the (possibly rebuilt) item group; cheap when idle.
  function sync(id, itemGroup) {
    itemId = id;
    const bounds = new THREE.Box3().setFromObject(itemGroup);
    center.set((bounds.min.x + bounds.max.x) / 2, 0, (bounds.min.z + bounds.max.z) / 2);
    const radius = Math.hypot(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2 + 0.15;
    ensureRing(radius);
    group.position.set(center.x, FLOOR_TOP_Y + 0.012, center.z);
    const item = store.get().items.find((i) => i.id === id);
    placeDot(item?.rotationY ?? 0);
    group.visible = true;
  }

  function detach() {
    itemId = null;
    group.visible = false;
  }

  function pointerAngle(point) {
    return Math.atan2(point.x - center.x, point.z - center.z);
  }

  function startDrag(hitPoint) {
    const item = store.get().items.find((i) => i.id === itemId);
    if (!item) return false;
    const rot0 = item.rotationY ?? 0;
    const [ox, oz] = [item.position[0] - center.x, item.position[1] - center.z];
    drag = {
      rot0,
      grabAngle: pointerAngle(hitPoint),
      offsetLocal: rotate2(ox, oz, -rot0), // origin relative to center, unrotated
    };
    return true;
  }

  function dragMove(raycaster, snap15) {
    if (!drag) return;
    const p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(floorPlane, p)) return;
    let rot = drag.rot0 + (pointerAngle(p) - drag.grabAngle);
    if (snap15) rot = Math.round(rot / SNAP_STEP) * SNAP_STEP;
    const [rx, rz] = rotate2(drag.offsetLocal[0], drag.offsetLocal[1], rot);
    write(itemId, [center.x + rx, center.z + rz], rot);
    placeDot(rot);
  }

  function endDrag() {
    drag = null;
  }

  return { sync, detach, startDrag, dragMove, endDrag, isDragging: () => Boolean(drag), dot };
}

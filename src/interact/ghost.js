import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { FLOOR_TOP_Y } from '../core/room.js';
import { snapPosition } from './snapping.js';
import { placeholderDims } from '../build/placeholder.js';
import { doorFaceZ } from '../build/cabinet.js';

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_TOP_Y);
const rot2 = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 7)}`;

const cabTemplate = () => ({
  id: uid('m'),
  type: 'cabinet',
  width: 0.6,
  handle: 'bar',
  compartments: [{ id: uid('c'), type: 'door', style: { hinge: 'L', glass: false }, shelvesInside: 1, weight: 1 }],
});
const MATERIALS = { door: 'paint_sage', carcass: 'paint_white', worktop: 'wood_butcher', handle: 'metal_black' };

function ghostSpec(kind) {
  if (kind.type === 'run') {
    const depth = doorFaceZ() + DIMS.worktopOverhang;
    const specs = {
      base: { w: 0.6, h: 0.88, d: depth, y: 0 },
      island: { w: 1.2, h: 0.88, d: depth, y: 0 },
      tall: { w: 0.6, h: DIMS.tallHeight, d: doorFaceZ(), y: 0 },
      wall: { w: 0.6, h: DIMS.wallUnitHeight, d: DIMS.wallUnitDepth, y: DIMS.wallUnitMount },
    };
    return specs[kind.unitType];
  }
  return placeholderDims(kind.applianceType ?? kind.furnitureType);
}

// Translucent violet ghost box following the floor raycast under the same
// snapping rules. Wall units float at mounting height and only commit
// while wall-snapped.
export function createGhost(scene) {
  const material = new THREE.MeshBasicMaterial({
    color: 0x8b8bf0,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const group = new THREE.Group();
  group.name = 'ghost';
  group.visible = false;
  scene.add(group);

  let kind = null;
  let spec = null;
  let candidate = null; // { position, rotationY, wallGuide }
  let body = null;

  function begin(k) {
    kind = k;
    spec = ghostSpec(k);
    if (body) {
      body.geometry.dispose();
      group.remove(body);
    }
    body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.d), material);
    body.raycast = () => {};
    body.position.set(spec.w / 2, spec.y + spec.h / 2, spec.d / 2);
    group.add(body);
    group.visible = false;
    candidate = null;
  }

  function update(raycaster, sceneState, snapEnabled) {
    if (!kind) return;
    const p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(floorPlane, p)) return;
    const rot = candidate?.rotationY ?? 0;
    const [cx, cz] = rot2(spec.w / 2, spec.d / 2, rot);
    const raw = [p.x - cx, p.z - cz];

    if (kind.type === 'run') {
      candidate = snapPosition({
        position: raw,
        rotationY: rot,
        item: { id: '__ghost', kind: 'run', unitType: kind.unitType, modules: [{ width: spec.w }] },
        room: sceneState.room,
        otherItems: sceneState.items,
        snapEnabled,
      });
    } else {
      const grid = (v) => (snapEnabled ? Math.round(v / 0.05) * 0.05 : v);
      candidate = { position: [grid(raw[0]), grid(raw[1])], rotationY: 0, wallGuide: null };
    }
    group.position.set(candidate.position[0], FLOOR_TOP_Y, candidate.position[1]);
    group.rotation.y = candidate.rotationY;
    group.visible = true;
    const commitable = canCommit();
    material.opacity = commitable ? 0.35 : 0.15;
  }

  function canCommit() {
    if (!kind || !candidate) return false;
    if (kind.type === 'run' && kind.unitType === 'wall') return candidate.wallGuide !== null;
    return true;
  }

  // Returns the item JSON to add, or null if not commitable.
  function commit() {
    if (!canCommit()) return null;
    const base = { position: candidate.position, rotationY: candidate.rotationY };
    if (kind.type === 'run') {
      const unitType = kind.unitType;
      return {
        kind: 'run',
        unitType,
        ...base,
        worktop: unitType === 'base' || unitType === 'island',
        plinth: unitType !== 'wall',
        materials: { ...MATERIALS },
        modules: unitType === 'island' ? [cabTemplate(), cabTemplate()] : [cabTemplate()],
      };
    }
    if (kind.type === 'appliance') {
      return { kind: 'appliance', applianceType: kind.applianceType, ...base, params: {} };
    }
    return { kind: 'furniture', furnitureType: kind.furnitureType, ...base, params: {} };
  }

  function cancel() {
    kind = null;
    candidate = null;
    group.visible = false;
  }

  return { begin, update, commit, cancel, active: () => Boolean(kind) };
}

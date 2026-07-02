import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { FLOOR_TOP_Y } from '../core/room.js';
import { snapPosition } from './snapping.js';
import { placeholderDims } from '../build/placeholder.js';
import { doorFaceZ } from '../build/cabinet.js';
import { FRIDGE_DEFAULTS } from '../build/appliances/fridge.js';
import { HOOD_DEFAULTS, HOOD_DIMS } from '../build/appliances/hood.js';
import { HOB_SIZE } from '../build/appliances/hob.js';
import { SINK_SIZE } from '../build/appliances/sink.js';
import { TAP_SIZE } from '../build/appliances/tap.js';

// Worktop features attach to a run instead of standing on the floor.
const FEATURE_KINDS = { hob: HOB_SIZE, sink: SINK_SIZE, tap: TAP_SIZE };

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
  if (kind.applianceType === 'fridge') {
    return { w: FRIDGE_DEFAULTS.width, h: FRIDGE_DEFAULTS.height, d: FRIDGE_DEFAULTS.depth, y: 0 };
  }
  if (kind.applianceType === 'hood') {
    return {
      w: HOOD_DEFAULTS.width,
      h: HOOD_DIMS.canopyH + HOOD_DIMS.ductH,
      d: HOOD_DIMS.depth,
      y: HOOD_DEFAULTS.mountY,
      requiresWall: true,
    };
  }
  const featureSize = FEATURE_KINDS[kind.applianceType];
  if (featureSize) {
    return { w: featureSize.w, h: kind.applianceType === 'tap' ? 0.3 : 0.05, d: featureSize.d, feature: kind.applianceType };
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
    // Features are centered on their origin; everything else is corner-origin.
    if (spec.feature) body.position.set(0, spec.h / 2, 0);
    else body.position.set(spec.w / 2, (spec.y ?? 0) + spec.h / 2, spec.d / 2);
    group.add(body);
    group.visible = false;
    candidate = null;
  }

  // Feature ghosts ride the hovered worktop; scene is needed to raycast it.
  function updateFeature(raycaster, sceneState) {
    const hits = raycaster.intersectObjects(scene.children, true);
    const hit = hits.find((h) => h.object.visible && h.object.userData.surfaceRole === 'worktop');
    if (!hit) {
      candidate = null;
      group.visible = false;
      return;
    }
    const itemId = hit.object.userData.itemId;
    const run = sceneState.items.find((i) => i.id === itemId);
    if (!run) return;
    const rot = run.rotationY ?? 0;
    const [lx] = rot2(hit.point.x - run.position[0], hit.point.z - run.position[1], -rot);
    const runWidth = (run.modules ?? []).reduce((s, m) => s + m.width, 0);
    const offsetX = Math.min(Math.max(lx, 0.3), runWidth - 0.3);
    let valid = runWidth >= 0.6;
    if (spec.feature === 'tap') {
      valid = valid && (run.features ?? []).some((f) => f.type === 'sink' && Math.abs(f.offsetX - offsetX) < 0.4);
    }
    candidate = { featureTarget: itemId, offsetX, rotationY: rot, valid };
    const topY = FLOOR_TOP_Y + (run.plinth === false ? 0 : DIMS.plinthHeight) + DIMS.baseHeight + DIMS.worktopThickness;
    const depth = doorFaceZ() + DIMS.worktopOverhang;
    const zLocal = spec.feature === 'tap' ? 0.11 : depth / 2 + 0.02;
    const [wx, wz] = rot2(offsetX, zLocal, rot);
    group.position.set(run.position[0] + wx, topY, run.position[1] + wz);
    group.rotation.y = rot;
    group.visible = true;
    material.opacity = valid ? 0.35 : 0.15;
  }

  function update(raycaster, sceneState, snapEnabled) {
    if (!kind) return;
    if (spec.feature) return updateFeature(raycaster, sceneState);
    const p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(floorPlane, p)) return;
    const rot = candidate?.rotationY ?? 0;
    const [cx, cz] = rot2(spec.w / 2, spec.d / 2, rot);
    const raw = [p.x - cx, p.z - cz];

    if (kind.type === 'run' || spec.requiresWall) {
      candidate = snapPosition({
        position: raw,
        rotationY: rot,
        item: { id: '__ghost', kind: 'run', unitType: spec.requiresWall ? 'wall' : kind.unitType, modules: [{ width: spec.w }] },
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
    if (spec.feature) return candidate.valid;
    if ((kind.type === 'run' && kind.unitType === 'wall') || spec.requiresWall) {
      return candidate.wallGuide !== null;
    }
    return true;
  }

  // Returns the item JSON to add, a feature descriptor, or null.
  function commit() {
    if (!canCommit()) return null;
    if (spec.feature) {
      return {
        kind: 'feature',
        targetItemId: candidate.featureTarget,
        feature: { type: spec.feature, offsetX: candidate.offsetX, params: spec.feature === 'hob' ? { burners: 4 } : {} },
      };
    }
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

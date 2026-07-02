import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { buildModule, doorFaceZ } from './cabinet.js';
import { box, worldScaleBoxUVs } from './util.js';

// Pure generator: a run item -> THREE.Group (see CLAUDE.md).
// Modules go left to right along local +x; doors face local +z. The group
// origin is the run's left-back-bottom corner; item.position/rotationY place it.
export function buildRun(item, matLib) {
  const group = new THREE.Group();
  group.name = `run:${item.id}`;
  group.userData.itemId = item.id;

  const unitCtx = {
    itemId: item.id,
    materials: item.materials,
    plinth: item.plinth !== false,
  };

  let cursor = 0;
  for (const module of item.modules ?? []) {
    const moduleGroup = buildModule(module, unitCtx, matLib);
    moduleGroup.position.x = cursor;
    group.add(moduleGroup);
    cursor += module.width;
  }

  if (item.worktop !== false && cursor > 0) {
    group.add(buildWorktop(item, cursor, unitCtx, matLib));
  }

  group.position.set(item.position?.[0] ?? 0, 0, item.position?.[1] ?? 0);
  group.rotation.y = item.rotationY ?? 0;
  return group;
}

// One slab spanning the full run: sides flush, front overhang, back at z=0.
function buildWorktop(item, runWidth, unitCtx, matLib) {
  const t = DIMS.worktopThickness;
  const depth = doorFaceZ() + DIMS.worktopOverhang;
  const y = (unitCtx.plinth ? DIMS.plinthHeight : 0) + DIMS.baseHeight;

  const material = matLib.get(item.materials.worktop);
  const slab = box(runWidth, t, depth, material, {
    itemId: item.id,
    surfaceRole: 'worktop',
  });
  worldScaleBoxUVs(slab.geometry, runWidth, t, depth);
  slab.position.set(runWidth / 2, y + t / 2, depth / 2);
  return slab;
}

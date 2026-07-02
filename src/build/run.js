import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { buildModule, doorFaceZ } from './cabinet.js';
import { box, worldScaleBoxUVs } from './util.js';

// Per-unit-type context shared by the module generator and validation.
export function unitContext(item) {
  const unitType = item.unitType ?? 'base';
  const floorStanding = unitType !== 'wall';
  const plinth = floorStanding && item.plinth !== false;
  const yBase = unitType === 'wall' ? DIMS.wallUnitMount : plinth ? DIMS.plinthHeight : 0;
  const carcassHeight =
    unitType === 'tall'
      ? DIMS.tallHeight - (plinth ? DIMS.plinthHeight : 0)
      : unitType === 'wall'
        ? DIMS.wallUnitHeight
        : DIMS.baseHeight;
  const carcassDepth =
    unitType === 'wall' ? DIMS.wallUnitDepth - DIMS.frontThickness : DIMS.carcassDepth;
  return { itemId: item.id, materials: item.materials, unitType, plinth, yBase, carcassHeight, carcassDepth };
}

// Pure generator: a run item -> THREE.Group (see CLAUDE.md).
// Modules go left to right along local +x; doors face local +z. The group
// origin is the run's left-back-bottom corner; item.position/rotationY place it.
export function buildRun(item, matLib) {
  const group = new THREE.Group();
  group.name = `run:${item.id}`;
  group.userData.itemId = item.id;
  const ctx = unitContext(item);

  let cursor = 0;
  for (const module of item.modules ?? []) {
    const moduleGroup = buildModule(module, ctx, matLib);
    moduleGroup.position.x = cursor;
    group.add(moduleGroup);
    cursor += module.width;
  }

  const wantsWorktop =
    item.worktop !== false && (ctx.unitType === 'base' || ctx.unitType === 'island');
  if (wantsWorktop && cursor > 0) {
    group.add(buildWorktop(item, cursor, ctx, matLib));
  }

  group.position.set(item.position?.[0] ?? 0, 0, item.position?.[1] ?? 0);
  group.rotation.y = item.rotationY ?? 0;
  return group;
}

// One slab spanning the full run: sides flush, front overhang, back at z=0.
function buildWorktop(item, runWidth, ctx, matLib) {
  const t = DIMS.worktopThickness;
  const depth = doorFaceZ(ctx.carcassDepth) + DIMS.worktopOverhang;
  const y = ctx.yBase + ctx.carcassHeight;

  const material = matLib.get(item.materials.worktop);
  const slab = box(runWidth, t, depth, material, {
    itemId: item.id,
    surfaceRole: 'worktop',
  });
  worldScaleBoxUVs(slab.geometry, runWidth, t, depth);
  slab.position.set(runWidth / 2, y + t / 2, depth / 2);
  return slab;
}

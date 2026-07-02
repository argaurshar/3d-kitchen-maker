import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { box } from './util.js';
import { buildCompartmentStack } from './compartments.js';

const P = DIMS.panelThickness;
const DOOR_CLEARANCE = 0.003;
const STRETCHER_DEPTH = 0.1;

export function doorFaceZ(carcassDepth = DIMS.carcassDepth) {
  return carcassDepth + DOOR_CLEARANCE + DIMS.frontThickness;
}

// Pure generator: one module -> THREE.Group (see CLAUDE.md).
// ctx (from run.js unitContext): { itemId, materials, plinth, unitType,
// yBase, carcassHeight, carcassDepth }. Module-local frame: x 0..width,
// z 0 at back, +z front.
export function buildModule(module, ctx, matLib) {
  const group = new THREE.Group();
  group.name = `module:${module.id}`;
  const width = module.width;
  const tag = (surfaceRole, extra) => ({
    itemId: ctx.itemId,
    moduleId: module.id,
    surfaceRole,
    ...extra,
  });

  addCarcass(group, width, ctx, matLib.get(ctx.materials.carcass), tag);
  if (ctx.plinth) {
    const plinth = box(width, DIMS.plinthHeight, P, matLib.get(ctx.materials.carcass), tag('plinth'));
    plinth.position.set(width / 2, DIMS.plinthHeight / 2, doorFaceZ(ctx.carcassDepth) - 0.05 - P / 2);
    group.add(plinth);
  }

  const stack = buildCompartmentStack(module, ctx, matLib, tag);
  if (stack) {
    group.add(stack);
  } else {
    group.add(buildOverflowWarning(width, ctx, tag));
  }
  return group;
}

// Translucent red box over the whole module when the compartment stack
// can't fit (module.invalid is flagged by the projection layer).
function buildOverflowWarning(width, ctx, tag) {
  const yLow = ctx.plinth ? 0 : ctx.yBase;
  const height = ctx.yBase + ctx.carcassHeight - yLow + 0.04;
  const material = new THREE.MeshStandardMaterial({
    color: 0xd8342c,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const warning = box(width + 0.02, height, ctx.carcassDepth + 0.1, material, tag('carcass'));
  warning.name = 'overflow-warning';
  warning.castShadow = false;
  warning.position.set(width / 2, yLow + height / 2, ctx.carcassDepth / 2 + 0.02);
  return warning;
}

// Hollow 18mm carcass: two sides, bottom, back, two top stretchers.
function addCarcass(group, width, ctx, material, tag) {
  const H = ctx.carcassHeight;
  const D = ctx.carcassDepth;
  const y = ctx.yBase;
  const innerW = width - 2 * P;
  const parts = [
    { size: [P, H, D], pos: [P / 2, y + H / 2, D / 2] },
    { size: [P, H, D], pos: [width - P / 2, y + H / 2, D / 2] },
    { size: [innerW, P, D], pos: [width / 2, y + P / 2, D / 2] },
    { size: [innerW, H - 2 * P, P], pos: [width / 2, y + H / 2, P / 2] },
    { size: [innerW, P, STRETCHER_DEPTH], pos: [width / 2, y + H - P / 2, D - STRETCHER_DEPTH / 2] },
    { size: [innerW, P, STRETCHER_DEPTH], pos: [width / 2, y + H - P / 2, P + STRETCHER_DEPTH / 2] },
  ];
  for (const { size, pos } of parts) {
    const mesh = box(...size, material, tag('carcass'));
    mesh.position.set(...pos);
    group.add(mesh);
  }
}

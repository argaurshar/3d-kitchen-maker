import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { box, cylinder, boxGeom, mergeParts } from './util.js';
import { buildCompartmentStack } from './compartments.js';
import { buildDoorFronts } from './fronts.js';

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
    const plinth = box(width, DIMS.plinthHeight, P, matLib.get(ctx.materials.plinth ?? ctx.materials.carcass), tag('plinth'));
    plinth.position.set(width / 2, DIMS.plinthHeight / 2, doorFaceZ(ctx.carcassDepth) - 0.05 - P / 2);
    group.add(plinth);
  }

  switch (module.type) {
    case 'dishwasher':
      addDishwasherFront(group, module, ctx, matLib, tag);
      break;
    case 'filler':
      addFillerFront(group, width, ctx, matLib, tag);
      break;
    case 'blindCorner':
      addBlindCornerFronts(group, module, ctx, matLib, tag);
      break;
    default: {
      const stack = buildCompartmentStack(module, ctx, matLib, tag);
      if (stack) group.add(stack);
      else group.add(buildOverflowWarning(width, ctx, tag));
    }
  }
  return group;
}

const INSET = DIMS.frontGap / 2;

function frontRect(width, ctx) {
  return {
    x0: INSET,
    x1: width - INSET,
    y0: ctx.yBase + INSET,
    y1: ctx.yBase + ctx.carcassHeight - INSET,
  };
}

// Integrated look: flat dark panel, thin control strip along the top edge.
function addDishwasherFront(group, module, ctx, matLib, tag) {
  const rect = frontRect(module.width, ctx);
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  const zBack = ctx.carcassDepth + 0.003;

  const front = box(w, h, DIMS.frontThickness, matLib.get('appliance_dark'), tag('applianceBody'));
  front.position.set(rect.x0 + w / 2, rect.y0 + h / 2, zBack + DIMS.frontThickness / 2);
  group.add(front);

  const strip = box(w - 0.02, 0.045, 0.004, matLib.get('metal_steel'), tag('applianceBody'));
  strip.position.set(rect.x0 + w / 2, rect.y1 - 0.033, zBack + DIMS.frontThickness + 0.002);
  group.add(strip);

  if ((module.handle ?? 'bar') === 'bar') {
    const bar = cylinder(0.005, Math.min(0.5, w - 0.15), matLib.get(ctx.materials.handle), tag('handle'));
    bar.rotation.z = Math.PI / 2;
    bar.position.set(rect.x0 + w / 2, rect.y1 - 0.085, zBack + DIMS.frontThickness + 0.018);
    group.add(bar);
  }
}

// A plain full-height strip panel in the door material.
function addFillerFront(group, width, ctx, matLib, tag) {
  const rect = frontRect(width, ctx);
  const zBack = ctx.carcassDepth + 0.003;
  const panel = box(rect.x1 - rect.x0, rect.y1 - rect.y0, DIMS.frontThickness, matLib.get(ctx.materials.door), tag('doorFront'));
  panel.position.set(width / 2, ctx.yBase + ctx.carcassHeight / 2, zBack + DIMS.frontThickness / 2);
  group.add(panel);
}

// Door on the exposed half, blank flat panel on the buried half.
// module.blindSide ('L' default) says which half is buried.
function addBlindCornerFronts(group, module, ctx, matLib, tag) {
  const rect = frontRect(module.width, ctx);
  const zBack = ctx.carcassDepth + 0.003;
  const mid = module.width / 2;
  const blindLeft = (module.blindSide ?? 'L') === 'L';
  const blankRect = blindLeft
    ? { ...rect, x1: mid - DIMS.frontGap / 2 }
    : { ...rect, x0: mid + DIMS.frontGap / 2 };
  const doorRect = blindLeft
    ? { ...rect, x0: mid + DIMS.frontGap / 2 }
    : { ...rect, x1: mid - DIMS.frontGap / 2 };

  const blank = box(
    blankRect.x1 - blankRect.x0,
    blankRect.y1 - blankRect.y0,
    DIMS.frontThickness,
    matLib.get(ctx.materials.door),
    tag('doorFront')
  );
  blank.position.set(
    (blankRect.x0 + blankRect.x1) / 2,
    (blankRect.y0 + blankRect.y1) / 2,
    zBack + DIMS.frontThickness / 2
  );
  group.add(blank);

  const comp = (module.compartments ?? [])[0];
  for (const leaf of buildDoorFronts({
    rect: doorRect,
    zBack,
    hinge: comp?.style?.hinge ?? (blindLeft ? 'R' : 'L'),
    glassMat: comp?.style?.glass ? matLib.get('glass_tint') : null,
    doorMat: matLib.get(ctx.materials.door),
    handleStyle: module.handle ?? 'bar',
    handleMat: matLib.get(ctx.materials.handle),
    tag: (role, extra) => tag(role, { compartmentId: comp?.id, ...extra }),
  })) {
    group.add(leaf);
  }
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

// Hollow 18mm carcass: two sides, bottom, back, two top stretchers —
// merged into ONE static mesh per module (draw-call budget).
function addCarcass(group, width, ctx, material, tag) {
  const H = ctx.carcassHeight;
  const D = ctx.carcassDepth;
  const y = ctx.yBase;
  const innerW = width - 2 * P;
  group.add(
    mergeParts(
      [
        boxGeom(P, H, D, P / 2, y + H / 2, D / 2),
        boxGeom(P, H, D, width - P / 2, y + H / 2, D / 2),
        boxGeom(innerW, P, D, width / 2, y + P / 2, D / 2),
        boxGeom(innerW, H - 2 * P, P, width / 2, y + H / 2, P / 2),
        boxGeom(innerW, P, STRETCHER_DEPTH, width / 2, y + H - P / 2, D - STRETCHER_DEPTH / 2),
        boxGeom(innerW, P, STRETCHER_DEPTH, width / 2, y + H - P / 2, P + STRETCHER_DEPTH / 2),
      ],
      material,
      tag('carcass')
    )
  );
}

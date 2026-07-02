import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { box, cylinder, boxGeom, cylGeom, mergeParts } from './util.js';
import { buildDoorFronts, buildDrawerFront } from './fronts.js';

const GAP = DIMS.frontGap;
const INSET = DIMS.frontGap / 2; // half-gap at edges -> 0.003 between neighbor modules
const MIN_FLEX = 0.1;
const EPS = 1e-9;

export const FIXED_HEIGHTS = {
  oven: DIMS.ovenHeight,
  microwave: DIMS.microwaveHeight,
};

// Modules without stored compartments fall back to a type preset
// (drawerBase = 4 equal drawers). Shared by the renderer, validation and
// the action layer (which materializes it before editing).
export function effectiveCompartments(module) {
  if (module.compartments?.length) return module.compartments;
  if (module.type === 'drawerBase') {
    return [1, 2, 3, 4].map((n) => ({ id: `${module.id}-d${n}`, type: 'drawer', weight: 1 }));
  }
  if (module.type === 'cabinet' || module.type === 'blindCorner') {
    return [{ id: `${module.id}-door`, type: 'door', style: { hinge: 'L', glass: false }, shelvesInside: 1, weight: 1 }];
  }
  return [];
}

// Fixed compartments take their height; the rest share the leftover
// proportionally to weight, waterfall-clamped to the 0.10 minimum.
export function solveHeights(compartments, H) {
  const heights = new Array(compartments.length).fill(0);
  let fixedSum = 0;
  let pool = [];
  compartments.forEach((c, i) => {
    const fixed = FIXED_HEIGHTS[c.type];
    if (fixed != null) {
      heights[i] = fixed;
      fixedSum += fixed;
    } else {
      pool.push(i);
    }
  });

  let remaining = H - fixedSum;
  if (remaining < pool.length * MIN_FLEX - EPS) return { error: 'overflow' };
  if (fixedSum > H + EPS) return { error: 'overflow' };

  while (pool.length) {
    const totalWeight = pool.reduce((s, i) => s + (compartments[i].weight ?? 1), 0);
    const starved = pool.filter(
      (i) => (remaining * (compartments[i].weight ?? 1)) / totalWeight < MIN_FLEX - EPS
    );
    if (!starved.length) {
      for (const i of pool) heights[i] = (remaining * (compartments[i].weight ?? 1)) / totalWeight;
      break;
    }
    for (const i of starved) {
      heights[i] = MIN_FLEX;
      remaining -= MIN_FLEX;
    }
    pool = pool.filter((i) => !starved.includes(i));
  }
  return { heights };
}

// Builds the full front stack (top to bottom). Returns null on overflow —
// the caller renders the warning box instead.
export function buildCompartmentStack(module, ctx, matLib, tag) {
  const compartments = effectiveCompartments(module);
  const solved = solveHeights(compartments, ctx.carcassHeight);
  if (solved.error) return null;

  const group = new THREE.Group();
  group.name = 'compartments';
  const zBack = ctx.carcassDepth + 0.003;
  const width = module.width;
  let top = ctx.yBase + ctx.carcassHeight;

  compartments.forEach((comp, i) => {
    const bottom = top - solved.heights[i];
    const rect = {
      x0: INSET,
      x1: width - INSET,
      y0: bottom + (i === compartments.length - 1 ? INSET : GAP / 2),
      y1: top - (i === 0 ? INSET : GAP / 2),
    };
    const compTag = (role, extra) => tag(role, { compartmentId: comp.id, ...extra });
    buildCompartment(group, comp, rect, { ...ctx, zBack, module }, matLib, compTag);
    top = bottom;
  });
  return group;
}

function buildCompartment(group, comp, rect, ctx, matLib, tag) {
  const doorMat = matLib.get(ctx.materials.door);
  const handleMat = matLib.get(ctx.materials.handle);
  const carcassMat = matLib.get(ctx.materials.carcass);
  const handleStyle = ctx.module.handle ?? 'bar';

  switch (comp.type) {
    case 'door': {
      const glass = comp.style?.glass;
      for (const leaf of buildDoorFronts({
        rect,
        zBack: ctx.zBack,
        hinge: comp.style?.hinge ?? 'L',
        glassMat: glass ? matLib.get('glass_tint') : null,
        doorMat,
        handleStyle,
        handleMat,
        tag,
      })) {
        group.add(leaf);
      }
      if (glass || comp.shelvesInside > 0) {
        addInteriorShelves(group, comp.shelvesInside ?? 0, rect, ctx, carcassMat, tag);
      }
      break;
    }
    case 'drawer':
      group.add(
        buildDrawerFront({ rect, zBack: ctx.zBack, doorMat, carcassMat, handleStyle, handleMat, tag })
      );
      break;
    case 'shelf':
      addInteriorShelves(group, comp.shelvesInside ?? 1, rect, ctx, carcassMat, tag);
      break;
    case 'oven':
      buildOvenFront(group, rect, ctx, matLib, tag);
      break;
    case 'microwave':
      buildMicrowaveFront(group, rect, ctx, matLib, tag);
      break;
    default:
      console.warn(`compartments: unknown type "${comp.type}"`);
  }
}

function addInteriorShelves(group, count, rect, ctx, material, tag) {
  const w = rect.x1 - rect.x0;
  const depth = ctx.carcassDepth - 0.05;
  for (let s = 1; s <= count; s += 1) {
    const y = rect.y0 + ((rect.y1 - rect.y0) * s) / (count + 1);
    const shelf = box(w - 0.03, DIMS.panelThickness, depth, material, tag('carcass'));
    shelf.position.set(rect.x0 + w / 2, y, 0.01 + depth / 2);
    group.add(shelf);
  }
}

// Dark front, glass window band, control strip with 4 knobs, bar handle.
function buildOvenFront(group, rect, ctx, matLib, tag) {
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  const cx = rect.x0 + w / 2;
  const dark = matLib.get('appliance_dark');
  const glass = matLib.get('glass_dark');
  const steel = matLib.get('metal_steel');
  const t = tag('applianceBody');

  const body = box(w, h, 0.02, dark, t);
  body.position.set(cx, rect.y0 + h / 2, ctx.zBack + 0.01);
  group.add(body);

  const win = box(w - 0.12, h * 0.45, 0.006, glass, tag('applianceBody'));
  win.position.set(cx, rect.y0 + h * 0.34, ctx.zBack + 0.022);
  group.add(win);

  const steelGeoms = [];
  for (let k = 0; k < 4; k += 1) {
    steelGeoms.push(
      cylGeom(0.009, 0.014, rect.x0 + w * (0.3 + k * 0.135), rect.y1 - 0.05, ctx.zBack + 0.026, { rx: Math.PI / 2, seg: 14 })
    );
  }
  steelGeoms.push(cylGeom(0.006, w - 0.1, cx, rect.y1 - 0.105, ctx.zBack + 0.05, { rz: Math.PI / 2 }));
  for (const side of [-1, 1]) {
    steelGeoms.push(
      cylGeom(0.004, 0.035, cx + side * (w / 2 - 0.08), rect.y1 - 0.105, ctx.zBack + 0.032, { rx: Math.PI / 2, seg: 12 })
    );
  }
  group.add(mergeParts(steelGeoms, steel, tag('applianceBody')));
}

// Dark front, window on the left, button grid on the right control panel.
function buildMicrowaveFront(group, rect, ctx, matLib, tag) {
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  const dark = matLib.get('appliance_dark');
  const glass = matLib.get('glass_dark');
  const steel = matLib.get('metal_steel');

  const body = box(w, h, 0.02, dark, tag('applianceBody'));
  body.position.set(rect.x0 + w / 2, rect.y0 + h / 2, ctx.zBack + 0.01);
  group.add(body);

  const panelW = 0.13;
  const win = box(w - panelW - 0.07, h - 0.07, 0.006, glass, tag('applianceBody'));
  win.position.set(rect.x0 + (w - panelW) / 2, rect.y0 + h / 2, ctx.zBack + 0.022);
  group.add(win);

  const gridX = rect.x1 - panelW / 2 - 0.015;
  const buttonGeoms = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      buttonGeoms.push(
        boxGeom(0.016, 0.012, 0.003, gridX + (col - 1) * 0.024, rect.y0 + h * 0.72 - row * 0.032, ctx.zBack + 0.022)
      );
    }
  }
  group.add(mergeParts(buttonGeoms, steel, tag('applianceBody')));
}

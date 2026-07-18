import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { box } from './util.js';
import { buildDoorFronts, buildDrawerFront } from './fronts.js';
import { buildLiftUpFront, buildBiFoldFront } from './frontsLift.js';
import { makeProfilePanelBuilder } from './frontsProfile.js';
import { buildOvenFront, buildMicrowaveFront } from './frontsAppliance.js';

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
      const style = comp.style ?? {};
      const profile = style.profile;
      // Glass: profile shutters always glaze (variant + optional backlight);
      // shaker doors glaze via the legacy glass flag.
      const glassMat = profile
        ? matLib.get(
            style.lit
              ? 'glass_led'
              : { clear: 'glass_clear', frosted: 'glass_frosted', fluted: 'glass_fluted' }[profile.glass ?? 'clear']
          )
        : style.glass
          ? matLib.get('glass_tint')
          : null;
      const opts = {
        rect,
        zBack: ctx.zBack,
        hinge: style.hinge ?? 'L',
        glassMat,
        doorMat,
        handleStyle,
        handleMat,
        tag,
        panelBuilder: profile ? makeProfilePanelBuilder(matLib, profile) : undefined,
      };
      const front = style.front ?? 'hinged';
      if (front === 'liftUp') group.add(buildLiftUpFront(opts));
      else if (front === 'biFold') group.add(buildBiFoldFront(opts));
      else for (const leaf of buildDoorFronts(opts)) group.add(leaf);

      if (glassMat || comp.shelvesInside > 0) {
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


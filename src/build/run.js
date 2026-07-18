import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { buildModule, doorFaceZ } from './cabinet.js';
import { box, boxGeom, mergeParts, worldScaleBoxUVs } from './util.js';
import { buildHob } from './appliances/hob.js';
import { buildSink } from './appliances/sink.js';
import { buildTap } from './appliances/tap.js';
import { addIslandShutterFaces } from './islandFaces.js';

const FEATURE_BUILDERS = { hob: buildHob, sink: buildSink, tap: buildTap };

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
    addWorktopFeatures(group, item, ctx, matLib);
  }
  if (ctx.unitType === 'island' && cursor > 0) {
    addIslandPanels(group, item, cursor, ctx, matLib);
    if (item.islandFaces === 'shutter') addIslandShutterFaces(group, item, cursor, ctx, matLib);
  }
  // Under-cabinet LED for wall runs: emissive strip along the front lower
  // edge plus one warm point light (no shadows) for the task-light pool.
  if (item.underLight && ctx.unitType === 'wall' && cursor > 0) {
    const strip = box(cursor - 0.02, 0.008, 0.03, matLib.get('led_strip'), {
      itemId: item.id,
      surfaceRole: 'ledStrip',
    });
    strip.castShadow = false;
    strip.position.set(cursor / 2, ctx.yBase - 0.004, ctx.carcassDepth - 0.03);
    group.add(strip);
    const glow = new THREE.PointLight(0xffe2ae, 0.55, 1.6, 2);
    glow.position.set(cursor / 2, ctx.yBase - 0.08, ctx.carcassDepth + 0.12);
    group.add(glow);
  }

  // Optional backsplash strip between worktop and wall-unit height.
  if (item.backsplash && ctx.unitType === 'base' && cursor > 0) {
    const y0 = ctx.yBase + ctx.carcassHeight + DIMS.worktopThickness;
    const h = DIMS.wallUnitMount - y0;
    const splash = box(cursor, h, 0.008, matLib.get('tile_hex'), {
      itemId: item.id,
      surfaceRole: 'wall',
    });
    worldScaleBoxUVs(splash.geometry, cursor, h, 0.008);
    splash.position.set(cursor / 2, y0 + h / 2, 0.005);
    group.add(splash);
  }

  group.position.set(item.position?.[0] ?? 0, 0, item.position?.[1] ?? 0);
  group.rotation.y = item.rotationY ?? 0;
  return group;
}

// Worktop features (hob/sink/tap) ride on the slab and move with the run.
// Feature groups are centered at their origin; tap sits toward the back.
function addWorktopFeatures(group, item, ctx, matLib) {
  const topY = ctx.yBase + ctx.carcassHeight + DIMS.worktopThickness;
  const depth = doorFaceZ(ctx.carcassDepth) + DIMS.worktopOverhang;
  for (const feature of item.features ?? []) {
    const builder = FEATURE_BUILDERS[feature.type];
    if (!builder) continue;
    const tag = (surfaceRole) => ({ itemId: item.id, featureId: feature.id, surfaceRole });
    const featureGroup = builder(feature, matLib, tag);
    const z = feature.type === 'tap' ? 0.11 : depth / 2 + 0.02;
    featureGroup.position.set(feature.offsetX, topY, z);
    group.add(featureGroup);
  }
}

const ISLAND_BACK_OVERHANG = 0.3;

// One slab spanning the full run: sides flush, front overhang, back at
// z=0 — except islands, whose slab extends 0.30 past the back for seating.
function buildWorktop(item, runWidth, ctx, matLib) {
  const t = DIMS.worktopThickness;
  const back = ctx.unitType === 'island' ? ISLAND_BACK_OVERHANG : 0;
  const depth = doorFaceZ(ctx.carcassDepth) + DIMS.worktopOverhang + back;
  const y = ctx.yBase + ctx.carcassHeight;

  const material = matLib.get(item.materials.worktop);
  const slab = box(runWidth, t, depth, material, {
    itemId: item.id,
    surfaceRole: 'worktop',
  });
  worldScaleBoxUVs(slab.geometry, runWidth, t, depth);
  slab.position.set(runWidth / 2, y + t / 2, depth / 2 - back);
  return slab;
}

// Islands never show raw carcass: finished panels close the back and ends
// (merged into one mesh).
function addIslandPanels(group, item, runWidth, ctx, matLib) {
  const P = DIMS.panelThickness;
  const H = ctx.carcassHeight + (ctx.plinth ? DIMS.plinthHeight : 0);
  group.add(
    mergeParts(
      [
        boxGeom(runWidth + 2 * P, H, P, runWidth / 2, H / 2, -P / 2),
        boxGeom(P, H, ctx.carcassDepth + P, -P / 2, H / 2, (ctx.carcassDepth + P) / 2 - P),
        boxGeom(P, H, ctx.carcassDepth + P, runWidth + P / 2, H / 2, (ctx.carcassDepth + P) / 2 - P),
      ],
      matLib.get(item.materials.door),
      { itemId: item.id, surfaceRole: 'carcass' }
    )
  );
}

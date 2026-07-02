import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { box, cylinder } from './util.js';

const P = DIMS.panelThickness;
const DOOR_INSET = 0.003; // front panel inset all around the module face
const DOOR_CLEARANCE = 0.003; // air between carcass front and door back
const STRETCHER_DEPTH = 0.1;
const FRAME_RECESS = 0.012; // shaker center panel sits this far behind frame
const PANEL_T = 0.008; // shaker center panel thickness

// Pure generator: one base module -> THREE.Group (see CLAUDE.md).
// unitCtx: { itemId, materials: {door, carcass, worktop, handle}, plinth }
// Module-local frame: x 0..width (left to right), z 0 at back, +z is front.
export function buildModule(module, unitCtx, matLib) {
  const group = new THREE.Group();
  group.name = `module:${module.id}`;
  const width = module.width;
  const yBase = unitCtx.plinth ? DIMS.plinthHeight : 0;
  const tag = (surfaceRole, extra) => ({
    itemId: unitCtx.itemId,
    moduleId: module.id,
    surfaceRole,
    ...extra,
  });

  addCarcass(group, width, yBase, matLib.get(unitCtx.materials.carcass), tag);
  if (unitCtx.plinth) {
    const plinth = box(width, DIMS.plinthHeight, P, matLib.get(unitCtx.materials.carcass), tag('plinth'));
    plinth.position.set(width / 2, DIMS.plinthHeight / 2, plinthFrontZ() - P / 2);
    group.add(plinth);
  }

  // ONE full-height door for now; per-compartment fronts land later.
  const compartment = module.compartments?.[0];
  group.add(buildDoor(module, compartment, width, yBase, unitCtx, matLib, tag));
  return group;
}

export function doorFaceZ() {
  return DIMS.carcassDepth + DOOR_CLEARANCE + DIMS.frontThickness; // 0.583
}

function plinthFrontZ() {
  return doorFaceZ() - 0.05; // recessed 5cm behind the door face
}

// Hollow 18mm carcass: two sides, bottom, back, two top stretchers.
function addCarcass(group, width, yBase, material, tag) {
  const H = DIMS.baseHeight;
  const D = DIMS.carcassDepth;
  const innerW = width - 2 * P;
  const parts = [
    { size: [P, H, D], pos: [P / 2, yBase + H / 2, D / 2] },
    { size: [P, H, D], pos: [width - P / 2, yBase + H / 2, D / 2] },
    { size: [innerW, P, D], pos: [width / 2, yBase + P / 2, D / 2] },
    { size: [innerW, H - 2 * P, P], pos: [width / 2, yBase + H / 2, P / 2] },
    { size: [innerW, P, STRETCHER_DEPTH], pos: [width / 2, yBase + H - P / 2, D - STRETCHER_DEPTH / 2] },
    { size: [innerW, P, STRETCHER_DEPTH], pos: [width / 2, yBase + H - P / 2, P + STRETCHER_DEPTH / 2] },
  ];
  for (const { size, pos } of parts) {
    const mesh = box(...size, material, tag('carcass'));
    mesh.position.set(...pos);
    group.add(mesh);
  }
}

// Shaker door: 4 frame boxes + recessed center panel, pivot group at the
// hinge edge so opening can rotate it later.
function buildDoor(module, compartment, width, yBase, unitCtx, matLib, tag) {
  const doorMat = matLib.get(unitCtx.materials.door);
  const handleMat = matLib.get(unitCtx.materials.handle);
  const hinge = compartment?.style?.hinge === 'R' ? 'R' : 'L'; // 'double' later
  const t = DIMS.frontThickness;
  const dw = width - 2 * DOOR_INSET;
  const dh = DIMS.baseHeight - 2 * DOOR_INSET;
  const fw = Math.min(0.075, dw * 0.22); // frame width, narrower on slim doors
  const handleStyle = module.handle ?? 'bar';
  const doorTag = (role = 'doorFront') => tag(role, { compartmentId: compartment?.id });

  const door = new THREE.Group();
  door.name = `door:${compartment?.id ?? module.id}`;
  // Origin sits on the hinge edge; meshes span x0..x0+dw.
  const x0 = hinge === 'R' ? -dw : 0;
  door.position.set(hinge === 'R' ? width - DOOR_INSET : DOOR_INSET, yBase + DOOR_INSET, DIMS.carcassDepth + DOOR_CLEARANCE);

  // J-pull cutout replaces the very top of the door with a dark channel.
  const cutout = handleStyle === 'cutout';
  const railH = cutout ? fw - 0.018 : fw;
  const frame = [
    { size: [dw, railH, t], pos: [x0 + dw / 2, dh - 0.018 * cutout - railH / 2, t / 2] },
    { size: [dw, fw, t], pos: [x0 + dw / 2, fw / 2, t / 2] },
    { size: [fw, dh - fw - railH, t], pos: [x0 + fw / 2, fw + (dh - fw - railH) / 2, t / 2] },
    { size: [fw, dh - fw - railH, t], pos: [x0 + dw - fw / 2, fw + (dh - fw - railH) / 2, t / 2] },
  ];
  for (const { size, pos } of frame) {
    const mesh = box(...size, doorMat, doorTag());
    mesh.position.set(...pos);
    door.add(mesh);
  }

  // Center panel tucks 8mm behind the frame (no through-slit, no light
  // leak); 1mm z-offsets keep its faces off the frame's planes.
  const overlap = 0.008;
  const panelT = t - FRAME_RECESS - 0.002;
  const panelW = dw - 2 * fw + 2 * overlap;
  const panelH = dh - fw - railH - 0.018 * cutout + 2 * overlap;
  const panel = box(panelW, panelH, panelT, doorMat, doorTag());
  panel.position.set(x0 + dw / 2, fw - overlap + panelH / 2, 0.001 + panelT / 2);
  door.add(panel);

  if (cutout) {
    const strip = box(dw, 0.018, t, handleMat, doorTag('handle'));
    strip.position.set(x0 + dw / 2, dh - 0.009, t / 2);
    door.add(strip);
  } else if (handleStyle === 'hole') {
    const hole = cylinder(0.016, t, handleMat, doorTag('handle'));
    hole.rotation.x = Math.PI / 2;
    hole.position.set(handleX(hinge, x0, dw, 0.08), dh - 0.08, t / 2 + 0.0005);
    door.add(hole);
  } else {
    addBarHandle(door, hinge, x0, dw, dh, t, handleMat, doorTag('handle'));
  }
  return door;
}

function handleX(hinge, x0, dw, margin) {
  return hinge === 'R' ? x0 + margin : x0 + dw - margin;
}

// Slim horizontal bar near the top edge, on the side opposite the hinge.
function addBarHandle(door, hinge, x0, dw, dh, t, material, userData) {
  const length = Math.min(0.15, dw * 0.45);
  const cx = handleX(hinge, x0, dw, length / 2 + 0.035);
  const bar = cylinder(0.005, length, material, userData);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(cx, dh - 0.055, t + 0.018);
  door.add(bar);
  for (const side of [-1, 1]) {
    const post = cylinder(0.003, 0.018, material, userData, 12);
    post.rotation.x = Math.PI / 2;
    post.position.set(cx + side * (length / 2 - 0.012), dh - 0.055, t + 0.009);
    door.add(post);
  }
}

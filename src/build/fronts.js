import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { box, cylinder } from './util.js';

const T = DIMS.frontThickness;
const OPEN_DOOR_RAD = THREE.MathUtils.degToRad(105);
const DRAWER_TRAVEL = 0.45;

// Open-state contract: openable groups carry userData
// { openable: 'door'|'drawer', openAmount, hingeSign?, closedZ? }.
export function applyOpenAmount(group, amount) {
  const ud = group.userData;
  ud.openAmount = amount;
  if (ud.openable === 'door') {
    group.rotation.y = ud.hingeSign * amount * OPEN_DOOR_RAD;
  } else if (ud.openable === 'drawer') {
    group.position.z = ud.closedZ + amount * DRAWER_TRAVEL;
  }
}

function frameWidth(w, h) {
  return THREE.MathUtils.clamp(0.22 * Math.min(w, h), 0.032, 0.075);
}

// Shaker panel with origin at its bottom-left corner; spans 0..w, 0..h,
// z 0..T. glassMat !== null replaces the center panel with a thin pane.
function buildShakerPanel({ w, h, doorMat, glassMat, handleStyle, handleMat, kind, hinge, tag }) {
  const g = new THREE.Group();
  const role = kind === 'drawer' ? 'drawerFront' : 'doorFront';
  const fw = frameWidth(w, h);
  const cutout = handleStyle === 'cutout';
  const railH = cutout ? Math.max(fw - 0.018, 0.014) : fw;
  const railTopY = h - 0.018 * cutout - railH / 2;

  const frame = [
    { size: [w, railH, T], pos: [w / 2, railTopY, T / 2] },
    { size: [w, fw, T], pos: [w / 2, fw / 2, T / 2] },
    { size: [fw, h - fw - railH - 0.018 * cutout, T], pos: [fw / 2, fw + (h - fw - railH - 0.018 * cutout) / 2, T / 2] },
    { size: [fw, h - fw - railH - 0.018 * cutout, T], pos: [w - fw / 2, fw + (h - fw - railH - 0.018 * cutout) / 2, T / 2] },
  ];
  for (const { size, pos } of frame) {
    const mesh = box(...size, doorMat, tag(role));
    mesh.position.set(...pos);
    g.add(mesh);
  }

  // Center panel (or glass pane) tucks behind the frame: no through-slit.
  const overlap = 0.008;
  const innerW = w - 2 * fw + 2 * overlap;
  const innerH = h - fw - railH - 0.018 * cutout + 2 * overlap;
  if (glassMat) {
    const pane = box(innerW, innerH, 0.004, glassMat, tag(role));
    pane.castShadow = false;
    pane.position.set(w / 2, fw - overlap + innerH / 2, 0.008);
    g.add(pane);
  } else {
    const panelT = T - 0.014;
    const panel = box(innerW, innerH, panelT, doorMat, tag(role));
    panel.position.set(w / 2, fw - overlap + innerH / 2, 0.001 + panelT / 2);
    g.add(panel);
  }

  if (cutout) {
    const strip = box(w, 0.018, T, handleMat, tag('handle'));
    strip.position.set(w / 2, h - 0.009, T / 2);
    g.add(strip);
  } else if (handleStyle === 'hole') {
    const hole = cylinder(0.016, T, handleMat, tag('handle'));
    hole.rotation.x = Math.PI / 2;
    const hx = kind === 'drawer' ? w / 2 : hinge === 'R' ? 0.08 : w - 0.08;
    hole.position.set(hx, kind === 'drawer' ? h / 2 : h - 0.08, T / 2 + 0.0005);
    g.add(hole);
  } else {
    addBarHandle(g, { w, h, kind, hinge, material: handleMat, tag });
  }
  return g;
}

// Bar: horizontal near the top edge (drawers: centered); vertical at
// mid-height for tall doors, always on the side opposite the hinge.
function addBarHandle(g, { w, h, kind, hinge, material, tag }) {
  const verticalBar = kind === 'door' && h > 0.9;
  const length = verticalBar ? Math.min(0.35, h * 0.35) : Math.min(0.15, w * 0.45);
  const bar = cylinder(0.005, length, material, tag('handle'));
  let cx;
  let cy;
  if (kind === 'drawer') {
    cx = w / 2;
    cy = h - Math.min(0.045, h * 0.28);
  } else if (verticalBar) {
    cx = hinge === 'R' ? 0.055 : w - 0.055;
    cy = h / 2;
  } else {
    const margin = length / 2 + 0.035;
    cx = hinge === 'R' ? margin : w - margin;
    cy = h - 0.055;
  }
  if (!verticalBar) bar.rotation.z = Math.PI / 2;
  bar.position.set(cx, cy, T + 0.018);
  g.add(bar);
  for (const side of [-1, 1]) {
    const post = cylinder(0.003, 0.018, material, tag('handle'), 12);
    post.rotation.x = Math.PI / 2;
    const off = side * (length / 2 - 0.012);
    post.position.set(cx + (verticalBar ? 0 : off), cy + (verticalBar ? off : 0), T + 0.009);
    g.add(post);
  }
}

// Door front(s) for a compartment rect. hinge 'double' yields two leaves.
// Each leaf group pivots on its hinge edge and honors the open contract.
export function buildDoorFronts({ rect, zBack, hinge, glassMat, doorMat, handleStyle, handleMat, tag }) {
  const { x0, x1, y0, y1 } = rect;
  const h = y1 - y0;
  const leaves = [];
  const defs =
    hinge === 'double'
      ? [
          { xa: x0, xb: (x0 + x1) / 2 - DIMS.frontGap / 2, hinge: 'L' },
          { xa: (x0 + x1) / 2 + DIMS.frontGap / 2, xb: x1, hinge: 'R' },
        ]
      : [{ xa: x0, xb: x1, hinge: hinge === 'R' ? 'R' : 'L' }];

  for (const def of defs) {
    const w = def.xb - def.xa;
    const leaf = new THREE.Group();
    leaf.name = 'door';
    leaf.position.set(def.hinge === 'R' ? def.xb : def.xa, y0, zBack);
    leaf.userData = { openable: 'door', openAmount: 0, hingeSign: def.hinge === 'R' ? 1 : -1 };
    const panel = buildShakerPanel({ w, h, doorMat, glassMat, handleStyle, handleMat, kind: 'door', hinge: def.hinge, tag });
    panel.position.x = def.hinge === 'R' ? -w : 0;
    leaf.add(panel);
    leaves.push(leaf);
  }
  return leaves;
}

// Drawer: shaker front plus an interior box that slides out with it.
export function buildDrawerFront({ rect, zBack, doorMat, carcassMat, handleStyle, handleMat, tag }) {
  const { x0, x1, y0, y1 } = rect;
  const w = x1 - x0;
  const h = y1 - y0;
  const drawer = new THREE.Group();
  drawer.name = 'drawer';
  drawer.position.set(x0, y0, zBack);
  drawer.userData = { openable: 'drawer', openAmount: 0, closedZ: zBack };
  drawer.add(buildShakerPanel({ w, h, doorMat, glassMat: null, handleStyle, handleMat, kind: 'drawer', tag }));

  const bw = w - 0.04;
  const bh = Math.max(h - 0.05, 0.05);
  const bd = 0.42;
  const s = 0.012;
  const parts = [
    { size: [bw, s, bd], pos: [w / 2, 0.02 + s / 2, -bd / 2 - 0.005] },
    { size: [s, bh, bd], pos: [w / 2 - bw / 2 + s / 2, 0.02 + bh / 2, -bd / 2 - 0.005] },
    { size: [s, bh, bd], pos: [w / 2 + bw / 2 - s / 2, 0.02 + bh / 2, -bd / 2 - 0.005] },
    { size: [bw, bh, s], pos: [w / 2, 0.02 + bh / 2, -bd - 0.005 + s / 2] },
  ];
  for (const { size, pos } of parts) {
    const mesh = box(...size, carcassMat, tag('carcass'));
    mesh.position.set(...pos);
    drawer.add(mesh);
  }
  return drawer;
}

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { box, cylinder } from '../util.js';

export const FRIDGE_DEFAULTS = {
  type: 'topFreezer',
  finish: 'stainless',
  width: 0.9,
  height: 1.8,
  depth: 0.72,
  openDoors: false,
  handles: 'bar',
  dispenser: false,
};

export const FRIDGE_FINISHES = {
  white: 'appliance_white',
  stainless: 'steel_stainless',
  brushedSteel: 'steel_brushed',
  blackSteel: 'steel_black',
  brushedBrass: 'brass_brushed',
  champagne: 'champagne',
};

const GAP = 0.004;
const DOOR_T = 0.05;
const OPEN_RAD = THREE.MathUtils.degToRad(100);

function rounded(w, h, d, material, userData) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.012), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = userData;
  return mesh;
}

// Pure generator: fridge item -> THREE.Group (see CLAUDE.md).
// Origin at left-back-bottom; doors face +z.
export function buildFridge(item, matLib) {
  const p = { ...FRIDGE_DEFAULTS, ...item.params };
  const group = new THREE.Group();
  group.name = `fridge:${item.id}`;
  const tag = () => ({ itemId: item.id, surfaceRole: 'applianceBody' });
  const finish = matLib.get(FRIDGE_FINISHES[p.finish] ?? 'steel_stainless');
  const dark = matLib.get('appliance_dark');
  const inner = matLib.get('appliance_white');
  const bodyD = p.depth - DOOR_T;

  const body = rounded(p.width, p.height, bodyD, finish, tag());
  body.position.set(p.width / 2, p.height / 2, bodyD / 2);
  group.add(body);
  addInterior(group, p, inner, tag);

  // Door regions: [x0, x1, y0, y1, hinge] and one optional drawer region.
  const splitY = p.type === 'topFreezer' ? p.height * 0.67 : p.height * 0.33;
  const doors = [];
  let drawer = null;
  if (p.type === 'topFreezer') {
    doors.push([0, p.width, splitY + GAP / 2, p.height, 'R'], [0, p.width, 0, splitY - GAP / 2, 'R']);
  } else if (p.type === 'bottomFreezer') {
    doors.push([0, p.width, splitY + GAP / 2, p.height, 'R']);
    drawer = [0, p.width, 0, splitY - GAP / 2];
  } else if (p.type === 'sideBySide') {
    const freezerW = p.width * 0.45;
    doors.push([0, freezerW - GAP / 2, 0, p.height, 'L'], [freezerW + GAP / 2, p.width, 0, p.height, 'R']);
  } else {
    // frenchDoor: two upper doors + lower drawer
    doors.push(
      [0, p.width / 2 - GAP / 2, splitY + GAP / 2, p.height, 'L'],
      [p.width / 2 + GAP / 2, p.width, splitY + GAP / 2, p.height, 'R']
    );
    drawer = [0, p.width, 0, splitY - GAP / 2];
  }

  doors.forEach(([x0, x1, y0, y1, hinge], i) => {
    group.add(buildDoor({ x0, x1, y0, y1, hinge, p, finish, dark, tag, dispenser: p.dispenser && i === 0 && y1 === p.height }));
  });
  if (drawer) group.add(buildFreezerDrawer({ region: drawer, p, finish, dark, inner, tag }));
  return group;
}

function addInterior(group, p, inner, tag) {
  const liner = box(p.width - 0.08, p.height - 0.08, p.depth - DOOR_T - 0.06, inner, tag());
  liner.position.set(p.width / 2, p.height / 2, (p.depth - DOOR_T) / 2);
  group.add(liner);
  for (const fy of [0.35, 0.55, 0.75]) {
    const shelf = box(p.width - 0.1, 0.012, p.depth - DOOR_T - 0.1, inner, tag());
    shelf.position.set(p.width / 2, p.height * fy, (p.depth - DOOR_T) / 2);
    group.add(shelf);
  }
}

function buildDoor({ x0, x1, y0, y1, hinge, p, finish, dark, tag, dispenser }) {
  const w = x1 - x0;
  const h = y1 - y0;
  const pivot = new THREE.Group();
  pivot.name = 'fridge-door';
  pivot.position.set(hinge === 'R' ? x1 : x0, y0, p.depth - DOOR_T);
  const ox = hinge === 'R' ? -w : 0;

  const panel = rounded(w, h, DOOR_T, finish, tag());
  panel.position.set(ox + w / 2, h / 2, DOOR_T / 2);
  pivot.add(panel);

  if (dispenser) {
    const inset = box(Math.min(0.3, w * 0.55), 0.42, 0.02, dark, tag());
    inset.position.set(ox + w / 2, h * 0.62, DOOR_T - 0.005);
    pivot.add(inset);
  }

  // Handle on the edge opposite the hinge.
  const hx = hinge === 'R' ? ox + 0.05 : ox + w - 0.05;
  if (p.handles === 'bar') {
    const bar = cylinder(0.012, Math.min(h * 0.55, 0.9), finish, tag(), 16);
    bar.position.set(hx, h / 2, DOOR_T + 0.035);
    pivot.add(bar);
    for (const s of [-1, 1]) {
      const post = cylinder(0.008, 0.035, finish, tag(), 10);
      post.rotation.x = Math.PI / 2;
      post.position.set(hx, h / 2 + s * (Math.min(h * 0.55, 0.9) / 2 - 0.03), DOOR_T + 0.018);
      pivot.add(post);
    }
  } else {
    const groove = box(0.025, h * 0.6, 0.012, dark, tag());
    groove.position.set(hx, h / 2, DOOR_T - 0.004);
    pivot.add(groove);
  }

  if (p.openDoors) pivot.rotation.y = (hinge === 'R' ? 1 : -1) * OPEN_RAD;
  return pivot;
}

function buildFreezerDrawer({ region, p, finish, dark, inner, tag }) {
  const [x0, x1, y0, y1] = region;
  const w = x1 - x0;
  const h = y1 - y0;
  const slide = new THREE.Group();
  slide.name = 'fridge-drawer';
  slide.position.set(x0, y0, p.depth - DOOR_T);

  const front = rounded(w, h, DOOR_T, finish, tag());
  front.position.set(w / 2, h / 2, DOOR_T / 2);
  slide.add(front);

  if (p.handles === 'bar') {
    const bar = cylinder(0.012, Math.min(w * 0.6, 0.7), finish, tag(), 16);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(w / 2, h - 0.07, DOOR_T + 0.035);
    slide.add(bar);
  } else {
    const groove = box(w * 0.6, 0.025, 0.012, dark, tag());
    groove.position.set(w / 2, h - 0.06, DOOR_T - 0.004);
    slide.add(groove);
  }

  if (p.openDoors) {
    slide.position.z += 0.4;
    const tub = box(w - 0.1, h - 0.12, 0.42, inner, tag());
    tub.position.set(w / 2, h / 2 - 0.02, -0.22);
    slide.add(tub);
  }
  return slide;
}

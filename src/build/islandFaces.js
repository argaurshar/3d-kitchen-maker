import * as THREE from 'three';
import { DIMS } from '../state/schema.js';
import { buildShakerPanel } from './fronts.js';

// islandFaces:'shutter' — decorative (non-opening) shutter fronts on the
// island's back and both ends, so every visible face reads as furniture
// instead of a plain slab. Panels are tagged doorFront, so painting the
// run's fronts recolors them together with the working doors.
const P = DIMS.panelThickness;
const BAY = 0.6;

function addFace(group, { width, height, matLib, materials, tag, position, rotationY }) {
  const face = new THREE.Group();
  face.position.copy(position);
  face.rotation.y = rotationY;
  const bays = Math.max(1, Math.round(width / BAY));
  const bw = width / bays;
  for (let i = 0; i < bays; i += 1) {
    const panel = buildShakerPanel({
      w: bw - DIMS.frontGap,
      h: height,
      doorMat: matLib.get(materials.door),
      glassMat: null,
      handleStyle: 'none',
      handleMat: matLib.get(materials.handle),
      kind: 'door',
      hinge: 'L',
      tag,
    });
    panel.position.x = i * bw + DIMS.frontGap / 2;
    face.add(panel);
  }
  group.add(face);
}

export function addIslandShutterFaces(group, item, runWidth, ctx, matLib) {
  const height = ctx.carcassHeight;
  const y = ctx.yBase;
  const tag = (role) => ({ itemId: item.id, surfaceRole: role });
  const common = { height, matLib, materials: item.materials, tag };

  // Back face (local -z), spanning the full run width.
  addFace(group, {
    ...common,
    width: runWidth,
    position: new THREE.Vector3(runWidth, y, -P - 0.001),
    rotationY: Math.PI,
  });
  // Left end faces -x, right end faces +x; both span the carcass depth.
  addFace(group, {
    ...common,
    width: ctx.carcassDepth,
    position: new THREE.Vector3(-P - 0.001, y, 0),
    rotationY: -Math.PI / 2,
  });
  addFace(group, {
    ...common,
    width: ctx.carcassDepth,
    position: new THREE.Vector3(runWidth + P + 0.001, y, ctx.carcassDepth),
    rotationY: Math.PI / 2,
  });
}

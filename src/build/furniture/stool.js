import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeParts } from '../util.js';

export const STOOL_DEFAULTS = {
  preset: 'counter',
  seatShape: 'round',
  seatRadius: 0.17,
  seatThickness: 0.04,
  seatHeight: 0.65,
  legSpread: 0.06,
  footrestRing: true,
  ringHeight: 0.22,
  backrest: false,
};

// Presets are param bundles; explicit params override them.
export const STOOL_PRESETS = {
  counter: { seatHeight: 0.65, seatShape: 'round', legSpread: 0.06, footrestRing: true, ringHeight: 0.22 },
  bar: { seatHeight: 0.75, seatShape: 'round', legSpread: 0.08, footrestRing: true, ringHeight: 0.26 },
  square: { seatHeight: 0.65, seatShape: 'square', legSpread: 0, footrestRing: true, ringHeight: 0.2 },
};

export function stoolParams(item) {
  const preset = item.params?.preset ?? 'counter';
  return { ...STOOL_DEFAULTS, ...(STOOL_PRESETS[preset] ?? {}), ...item.params };
}

// Pure generator: stool item -> THREE.Group, origin at the footprint
// CENTER on the floor (stools resize around their center).
export function buildStool(item, matLib) {
  const p = stoolParams(item);
  const group = new THREE.Group();
  group.name = `stool:${item.id}`;
  const seatTag = { itemId: item.id, surfaceRole: 'seat' };
  const legTag = () => ({ itemId: item.id, surfaceRole: 'leg' });
  const wood = matLib.get(p.seatMaterial ?? 'wood_butcher');
  const black = matLib.get('metal_black');

  // Seat
  let seat;
  if (p.seatShape === 'square') {
    seat = new THREE.Mesh(new RoundedBoxGeometry(p.seatRadius * 2, p.seatThickness, p.seatRadius * 2, 3, 0.015), wood);
  } else {
    seat = new THREE.Mesh(new THREE.CylinderGeometry(p.seatRadius, p.seatRadius, p.seatThickness, 32), wood);
  }
  seat.castShadow = true;
  seat.receiveShadow = true;
  seat.userData = seatTag;
  seat.position.y = p.seatHeight - p.seatThickness / 2;
  group.add(seat);

  // All black metalwork (legs, footrest, backrest) merges into one mesh.
  const metalGeoms = [];
  const topOffset = p.seatRadius * 0.62;
  const bottomOffset = topOffset + p.legSpread;
  const topY = p.seatHeight - p.seatThickness;
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion();
  const mat = new THREE.Matrix4();
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const top = new THREE.Vector3(sx * topOffset, topY, sz * topOffset);
    const bottom = new THREE.Vector3(sx * bottomOffset, 0, sz * bottomOffset);
    const dir = top.clone().sub(bottom);
    const leg = new THREE.CylinderGeometry(0.011, 0.011, dir.length(), 10);
    quat.setFromUnitVectors(up, dir.clone().normalize());
    mat.compose(bottom.clone().addScaledVector(dir, 0.5), quat, new THREE.Vector3(1, 1, 1));
    leg.applyMatrix4(mat);
    metalGeoms.push(leg);
  }

  // Footrest at ringHeight: torus for round stools, 4 bars for square.
  if (p.footrestRing) {
    const t = p.ringHeight / topY;
    const offsetAtRing = bottomOffset + (topOffset - bottomOffset) * t;
    if (p.seatShape === 'square') {
      for (const [rx, rz, rotY] of [
        [0, -offsetAtRing, Math.PI / 2],
        [0, offsetAtRing, Math.PI / 2],
        [-offsetAtRing, 0, 0],
        [offsetAtRing, 0, 0],
      ]) {
        const bar = new THREE.CylinderGeometry(0.006, 0.006, offsetAtRing * 2, 8);
        bar.rotateZ(Math.PI / 2);
        bar.rotateY(rotY);
        bar.translate(rx, p.ringHeight, rz);
        metalGeoms.push(bar);
      }
    } else {
      const ring = new THREE.TorusGeometry(offsetAtRing * Math.SQRT2, 0.006, 8, 40);
      ring.rotateX(-Math.PI / 2);
      ring.translate(0, p.ringHeight, 0);
      metalGeoms.push(ring);
    }
  }

  // Backrest: vertical hoop rising from the back edge of the seat.
  if (p.backrest) {
    const hoop = new THREE.TorusGeometry(p.seatRadius * 0.8, 0.009, 8, 32, Math.PI);
    hoop.translate(0, 0, 0);
    const hoopMat = new THREE.Matrix4().makeTranslation(0, p.seatHeight + 0.02, -p.seatRadius * 0.82);
    hoop.applyMatrix4(hoopMat);
    metalGeoms.push(hoop);
    for (const sx of [-1, 1]) {
      const post = new THREE.CylinderGeometry(0.009, 0.009, 0.1, 8);
      post.translate(sx * p.seatRadius * 0.8, p.seatHeight - 0.03, -p.seatRadius * 0.82);
      metalGeoms.push(post);
    }
  }
  group.add(mergeParts(metalGeoms, black, legTag()));

  group.position.set(item.position?.[0] ?? 0, 0, item.position?.[1] ?? 0);
  group.rotation.y = item.rotationY ?? 0;
  return group;
}

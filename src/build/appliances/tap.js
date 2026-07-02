import * as THREE from 'three';
import { cylinder } from '../util.js';

export const TAP_SIZE = { w: 0.15, d: 0.15 };

// Worktop feature behind a sink: bent-neck mixer from cylinders + a torus
// elbow. Group origin at the base center on the worktop top surface.
export function buildTap(feature, matLib, tag) {
  const group = new THREE.Group();
  group.name = `tap:${feature.id}`;
  const steel = matLib.get('metal_steel');

  const base = cylinder(0.02, 0.03, steel, tag('applianceBody'), 16);
  base.position.y = 0.015;
  group.add(base);

  const riser = cylinder(0.011, 0.24, steel, tag('applianceBody'), 14);
  riser.position.y = 0.15;
  group.add(riser);

  // Quarter-torus elbow arcs from the riser top toward the basin (+z).
  const elbow = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 10, 24, Math.PI / 2), steel);
  elbow.rotation.y = Math.PI / 2;
  elbow.position.set(0, 0.27, 0.05);
  elbow.userData = tag('applianceBody');
  group.add(elbow);

  // Short downward spout at the end of the elbow arc.
  const spout = cylinder(0.009, 0.05, steel, tag('applianceBody'), 12);
  spout.position.set(0, 0.245, 0.1);
  group.add(spout);

  const lever = cylinder(0.006, 0.09, steel, tag('handle'), 10);
  lever.rotation.x = Math.PI / 2 - 0.5;
  lever.position.set(0.03, 0.045, 0.03);
  group.add(lever);
  return group;
}

import * as THREE from 'three';
import { mergeParts, cylGeom } from '../util.js';

export const TAP_SIZE = { w: 0.15, d: 0.15 };

// Worktop feature behind a sink: bent-neck mixer, merged into one steel
// mesh. Group origin at the base center on the worktop top surface.
export function buildTap(feature, matLib, tag) {
  const group = new THREE.Group();
  group.name = `tap:${feature.id}`;

  const elbow = new THREE.TorusGeometry(0.05, 0.01, 10, 24, Math.PI / 2);
  elbow.rotateY(Math.PI / 2);
  elbow.translate(0, 0.27, 0.05);
  const lever = cylGeom(0.006, 0.09, 0, 0, 0, { seg: 10 });
  lever.rotateX(Math.PI / 2 - 0.5);
  lever.translate(0.03, 0.045, 0.03);

  group.add(
    mergeParts(
      [
        cylGeom(0.02, 0.03, 0, 0.015, 0, { seg: 16 }),
        cylGeom(0.011, 0.24, 0, 0.15, 0, { seg: 14 }),
        elbow,
        cylGeom(0.009, 0.05, 0, 0.245, 0.1, { seg: 12 }),
        lever,
      ],
      matLib.get('metal_steel'),
      tag('applianceBody')
    )
  );
  return group;
}

import * as THREE from 'three';
import { box, cylinder } from '../util.js';

export const HOB_SIZE = { w: 0.58, d: 0.51 };

// Worktop feature: black glass slab with burner rings and front knobs.
// Group origin at the feature center on the worktop top surface.
export function buildHob(feature, matLib, tag) {
  const burners = feature.params?.burners === 5 ? 5 : 4;
  const group = new THREE.Group();
  group.name = `hob:${feature.id}`;
  const glass = matLib.get('glass_dark');
  const ring = matLib.get('metal_steel');

  const slab = box(HOB_SIZE.w, 0.01, HOB_SIZE.d, glass, tag('applianceBody'));
  slab.position.y = 0.005;
  group.add(slab);

  const layout =
    burners === 5
      ? [[-0.16, -0.14, 0.07], [0.16, -0.14, 0.07], [-0.16, 0.1, 0.07], [0.16, 0.1, 0.07], [0, -0.02, 0.09]]
      : [[-0.15, -0.13, 0.075], [0.15, -0.13, 0.065], [-0.15, 0.11, 0.065], [0.15, 0.11, 0.075]];
  for (const [bx, bz, r] of layout) {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(r, 0.005, 8, 32), ring);
    torus.rotation.x = -Math.PI / 2;
    torus.position.set(bx, 0.012, bz);
    torus.userData = tag('applianceBody');
    group.add(torus);
    const cap = cylinder(0.02, 0.006, ring, tag('applianceBody'), 16);
    cap.position.set(bx, 0.013, bz);
    group.add(cap);
  }

  for (let k = 0; k < burners; k += 1) {
    const knob = cylinder(0.011, 0.014, ring, tag('handle'), 14);
    knob.position.set(-0.12 + k * 0.06, 0.014, HOB_SIZE.d / 2 - 0.035);
    group.add(knob);
  }
  return group;
}

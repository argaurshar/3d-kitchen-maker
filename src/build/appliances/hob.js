import * as THREE from 'three';
import { box, mergeParts, cylGeom } from '../util.js';

export const HOB_SIZE = { w: 0.58, d: 0.51 };

// Worktop feature: black glass slab with burner rings and front knobs.
// All steel hardware merges into one mesh; the glass slab stays separate.
export function buildHob(feature, matLib, tag) {
  const burners = feature.params?.burners === 5 ? 5 : 4;
  const group = new THREE.Group();
  group.name = `hob:${feature.id}`;

  const slab = box(HOB_SIZE.w, 0.01, HOB_SIZE.d, matLib.get('glass_dark'), tag('applianceBody'));
  slab.position.y = 0.005;
  group.add(slab);

  const layout =
    burners === 5
      ? [[-0.16, -0.14, 0.07], [0.16, -0.14, 0.07], [-0.16, 0.1, 0.07], [0.16, 0.1, 0.07], [0, -0.02, 0.09]]
      : [[-0.15, -0.13, 0.075], [0.15, -0.13, 0.065], [-0.15, 0.11, 0.065], [0.15, 0.11, 0.075]];
  const geoms = [];
  for (const [bx, bz, r] of layout) {
    const torus = new THREE.TorusGeometry(r, 0.005, 8, 32);
    torus.rotateX(-Math.PI / 2);
    torus.translate(bx, 0.012, bz);
    geoms.push(torus);
    geoms.push(cylGeom(0.02, 0.006, bx, 0.013, bz, { seg: 16 }));
  }
  for (let k = 0; k < burners; k += 1) {
    geoms.push(cylGeom(0.011, 0.014, -0.12 + k * 0.06, 0.014, HOB_SIZE.d / 2 - 0.035, { seg: 14 }));
  }
  group.add(mergeParts(geoms, matLib.get('metal_steel'), tag('applianceBody')));
  return group;
}

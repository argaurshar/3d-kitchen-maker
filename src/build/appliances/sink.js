import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { box, boxGeom, mergeParts } from '../util.js';

export const SINK_SIZE = { w: 0.56, d: 0.5 };

// Worktop feature: steel plate with a sunken rounded basin and drainer
// grooves. Group origin at the feature center on the worktop top surface.
export function buildSink(feature, matLib, tag) {
  const group = new THREE.Group();
  group.name = `sink:${feature.id}`;
  const steel = matLib.get('metal_steel');
  const dark = matLib.get('appliance_dark');

  const plate = box(SINK_SIZE.w, 0.008, SINK_SIZE.d, steel, tag('applianceBody'));
  plate.position.y = 0.004;
  group.add(plate);

  // Basin (sunken rounded box) + drainer grooves merge into one dark mesh.
  const basinGeom = new RoundedBoxGeometry(0.34, 0.03, 0.38, 3, 0.02);
  basinGeom.translate(-0.07, -0.006, 0);
  const darkGeoms = [basinGeom];
  for (let g = 0; g < 5; g += 1) {
    darkGeoms.push(boxGeom(0.11, 0.002, 0.012, 0.185, 0.0085, -0.14 + g * 0.07));
  }
  group.add(mergeParts(darkGeoms, dark, tag('applianceBody')));
  return group;
}

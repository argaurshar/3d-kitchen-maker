import * as THREE from 'three';
import { box } from '../util.js';

export const HOOD_DEFAULTS = { width: 0.6, finish: 'stainless', mountY: 1.55 };
export const HOOD_DIMS = { depth: 0.5, canopyH: 0.16, ductW: 0.32, ductH: 0.62 };

// Wall-mounted chimney extractor: canopy + duct box. Origin left-back at
// the wall, bottom of the canopy at mountY. Pure generator.
export function buildHood(item, matLib) {
  const p = { ...HOOD_DEFAULTS, ...item.params };
  const group = new THREE.Group();
  group.name = `hood:${item.id}`;
  const tag = () => ({ itemId: item.id, surfaceRole: 'applianceBody' });
  const finish = matLib.get(p.finish === 'blackSteel' ? 'steel_black' : 'steel_stainless');

  const canopy = box(p.width, HOOD_DIMS.canopyH, HOOD_DIMS.depth, finish, tag());
  canopy.position.set(p.width / 2, p.mountY + HOOD_DIMS.canopyH / 2, HOOD_DIMS.depth / 2);
  group.add(canopy);

  const lip = box(p.width, 0.03, HOOD_DIMS.depth + 0.02, finish, tag());
  lip.position.set(p.width / 2, p.mountY + 0.015, HOOD_DIMS.depth / 2);
  group.add(lip);

  const duct = box(HOOD_DIMS.ductW, HOOD_DIMS.ductH, HOOD_DIMS.ductW, finish, tag());
  duct.position.set(p.width / 2, p.mountY + HOOD_DIMS.canopyH + HOOD_DIMS.ductH / 2, HOOD_DIMS.ductW / 2 + 0.02);
  group.add(duct);

  group.position.set(item.position?.[0] ?? 0, 0, item.position?.[1] ?? 0);
  group.rotation.y = item.rotationY ?? 0;
  return group;
}

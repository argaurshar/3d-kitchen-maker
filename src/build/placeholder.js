import * as THREE from 'three';
import { box } from './util.js';

// Grey placeholder boxes for appliances/furniture until their real
// generators land (Prompts 10/11). Footprints are [w, h, d, floorY].
const FOOTPRINTS = {
  fridge: [0.6, 1.8, 0.65, 0],
  sink: [0.56, 0.22, 0.5, 0.88],
  hob: [0.58, 0.05, 0.51, 0.88],
  tap: [0.15, 0.35, 0.15, 0.88],
  stool: [0.35, 0.75, 0.35, 0],
};

export function placeholderDims(type) {
  const [w, h, d, y] = FOOTPRINTS[type] ?? [0.5, 0.5, 0.5, 0];
  return { w, h, d, y };
}

function makeLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3e44';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#e6e7e9';
  ctx.font = '600 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Pure generator: placeholder item -> THREE.Group (see CLAUDE.md).
export function buildPlaceholder(item) {
  const type = item.applianceType ?? item.furnitureType ?? 'unknown';
  const { w, h, d, y } = placeholderDims(type);
  const group = new THREE.Group();
  group.name = `placeholder:${item.id}`;
  const role = item.kind === 'furniture' ? 'seat' : 'applianceBody';

  // Same origin convention as runs and the placement ghost: the item
  // position is the left-back corner, geometry spans 0..w / 0..d.
  const material = new THREE.MeshStandardMaterial({ color: 0xb6b9bd, roughness: 0.85 });
  const body = box(w, h, d, material, { itemId: item.id, surfaceRole: role });
  body.position.set(w / 2, y + h / 2, d / 2);
  group.add(body);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.09),
    new THREE.MeshBasicMaterial({ map: makeLabelTexture(type), transparent: false })
  );
  label.position.set(w / 2, y + h + 0.08, d / 2);
  label.userData = { itemId: item.id, surfaceRole: role };
  group.add(label);

  group.position.set(item.position?.[0] ?? 0, 0, item.position?.[1] ?? 0);
  group.rotation.y = item.rotationY ?? 0;
  return group;
}

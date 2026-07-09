import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const DEFAULT_FOV = 40;

// Deterministic viewpoints used by the debug API and the screenshot harness.
// "close" stands 1.5 m (horizontally) from the scene center at eye height.
// Distances tuned for the 40deg product-shot FOV.
const PRESETS = {
  hero: { position: [6.4, 4.6, 6.4], target: [0, 0.45, 0] },
  front: { position: [0, 1.6, 9.2], target: [0, 0.8, 0] },
  top: { position: [0, 11, 0.01], target: [0, 0, 0] },
  close: { position: [1.06, 1.4, 1.06], target: [0, 0.85, 0] },
};

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    DEFAULT_FOV,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(5, 4, 7);
  return camera;
}

// Straight-on elevation framing for one wall. A narrow FOV at a computed
// distance reads as a near-orthographic elevation and auto-fits the wall's
// width and the room height for the current viewport aspect. Camera stands
// on the OPPOSITE side and looks toward the wall (whose facing wall hides).
const ELEVATION_FOV = 24;
const ELEVATION_TARGET_Y = 1.1;
export function elevationView(room, dir, aspect = 1.6) {
  const { width, depth, wallHeight = 2.7 } = room;
  const tanHalf = Math.tan((ELEVATION_FOV * Math.PI) / 360);
  const span = dir === 'north' || dir === 'south' ? width : depth;
  const distV = wallHeight / 2 / tanHalf;
  const distH = span / 2 / (tanHalf * aspect);
  const dist = Math.max(distV, distH) * 1.12 + 0.6;
  const ty = Math.min(ELEVATION_TARGET_Y, wallHeight / 2);
  const target = [0, ty, 0];
  const at = {
    north: [0, ty, dist],
    south: [0, ty, -dist],
    west: [dist, ty, 0],
    east: [-dist, ty, 0],
  }[dir];
  return { position: at, target, fov: ELEVATION_FOV };
}

export function createControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.8, 0);
  controls.minDistance = 1;
  controls.maxDistance = 30;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // keep the camera above the floor
  controls.update();
  return controls;
}

// Accepts a preset name or an explicit { position, target } (used by the
// screenshot harness for custom framings).
export function applyCameraPreset(camera, controls, preset) {
  const resolved = typeof preset === 'string' ? PRESETS[preset] : preset;
  if (!resolved?.position || !resolved?.target) {
    throw new Error(
      `Unknown camera preset "${preset}" (known: ${Object.keys(PRESETS).join(', ')})`
    );
  }
  camera.position.set(...resolved.position);
  controls.target.set(...resolved.target);
  // Presets may set a lens (elevations use a narrow FOV); reset to the
  // product-shot default otherwise so switching back is clean.
  const fov = resolved.fov ?? DEFAULT_FOV;
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  controls.update();
}

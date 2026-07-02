import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
    40,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(5, 4, 7);
  return camera;
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
  controls.update();
}

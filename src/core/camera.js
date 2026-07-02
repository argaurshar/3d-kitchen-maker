import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    50,
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

import * as THREE from 'three';
import { createRenderer } from './core/renderer.js';
import { createCamera, createControls } from './core/camera.js';
import { createLights } from './core/lights.js';
import { createProjection } from './core/projection.js';
import { createOpenDoors } from './interact/openDoors.js';
import { installDebugApi } from './core/debug.js';

const renderer = createRenderer();
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xececec);

const camera = createCamera();
const controls = createControls(camera, renderer.domElement);

scene.add(createLights());
const projection = createProjection(scene);
const openDoors = createOpenDoors(scene);

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
onResize();

let resolveReady;
const ready = new Promise((resolve) => (resolveReady = resolve));
installDebugApi({ camera, controls, renderer, ready, openDoors });

let firstFrame = true;
let lastTime = 0;
renderer.setAnimationLoop((time) => {
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  controls.update();
  projection.update(camera);
  openDoors.update(dt);
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    resolveReady();
  }
});

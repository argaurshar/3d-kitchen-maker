import * as THREE from 'three';
import { createRenderer } from './core/renderer.js';
import { createCamera, createControls } from './core/camera.js';
import { createLights } from './core/lights.js';
import { createProjection } from './core/projection.js';
import { createOpenDoors } from './interact/openDoors.js';
import { createPicker } from './interact/picker.js';
import { installDebugApi } from './core/debug.js';
import { initPanel } from './ui/panel.js';
import { createRunButtons } from './ui/runButtons.js';
import { store } from './state/store.js';

const renderer = createRenderer();
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xececec);

const camera = createCamera();
const controls = createControls(camera, renderer.domElement);

scene.add(createLights());
const projection = createProjection(scene);
const openDoors = createOpenDoors(scene);
const panel = initPanel({ onClose: () => picker.select(null) });
const runButtons = createRunButtons({ camera, renderer });
const picker = createPicker({ scene, camera, renderer, controls, projection, panel, runButtons });

// Boot scene: galley fixture with the tall larder selected.
fetch('/src/state/fixtures/galley.json')
  .then((r) => r.json())
  .then((scene_) => {
    store.replace(scene_);
    picker.select('larder-run');
  })
  .catch((e) => console.warn('boot fixture failed:', e));

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
onResize();

let resolveReady;
const ready = new Promise((resolve) => (resolveReady = resolve));
installDebugApi({ camera, controls, renderer, ready, openDoors, picker });

let firstFrame = true;
let lastTime = 0;
renderer.setAnimationLoop((time) => {
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  if (!picker.isDragging()) controls.update();
  projection.update(camera);
  openDoors.update(dt);
  picker.update();
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    resolveReady();
  }
});

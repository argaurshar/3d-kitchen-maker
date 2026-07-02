import * as THREE from 'three';
import { createRenderer } from './core/renderer.js';
import { createCamera, createControls } from './core/camera.js';
import { createLights } from './core/lights.js';
import { buildRoom, updateWallVisibility } from './core/room.js';
import { disposeGroup } from './core/dispose.js';
import { installDebugApi } from './core/debug.js';
import { store } from './state/store.js';

const renderer = createRenderer();
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xececec);

const camera = createCamera();
const controls = createControls(camera, renderer.domElement);

scene.add(createLights());

// 3D layer: a projection of the store. Rebuild only what a change affects;
// item rebuilds land with the generators in Prompt 5+.
let roomGroup = buildRoom(store.get().room);
scene.add(roomGroup);

function rebuildRoom() {
  scene.remove(roomGroup);
  disposeGroup(roomGroup);
  roomGroup = buildRoom(store.get().room);
  scene.add(roomGroup);
}

store.subscribe((change) => {
  if (change.type === 'replace' || change.path?.startsWith('room')) {
    rebuildRoom();
  }
});

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
onResize();

let resolveReady;
const ready = new Promise((resolve) => (resolveReady = resolve));
installDebugApi({ camera, controls, ready });

let firstFrame = true;
renderer.setAnimationLoop(() => {
  controls.update();
  updateWallVisibility(roomGroup, camera);
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    resolveReady();
  }
});

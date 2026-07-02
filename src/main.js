import * as THREE from 'three';
import { createRenderer } from './core/renderer.js';
import { createCamera, createControls } from './core/camera.js';
import { createLights } from './core/lights.js';
import { createGround } from './core/room.js';

const renderer = createRenderer();
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xececec);

const camera = createCamera();
const controls = createControls(camera, renderer.domElement);

scene.add(createLights());
scene.add(createGround());

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
onResize();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

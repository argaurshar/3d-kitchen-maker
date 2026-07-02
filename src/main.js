import * as THREE from 'three';
import { createRenderer, attachEnvironment } from './core/renderer.js';
import { createCamera, createControls, applyCameraPreset } from './core/camera.js';
import { createLights, applyLightPreset } from './core/lights.js';
import { createProjection } from './core/projection.js';
import { createOpenDoors } from './interact/openDoors.js';
import { createPicker } from './interact/picker.js';
import { createPaintTool } from './interact/paint.js';
import { installDebugApi } from './core/debug.js';
import { initPanel } from './ui/panel.js';
import { createRunButtons } from './ui/runButtons.js';
import { createToolbar, toast } from './ui/toolbar.js';
import { store } from './state/store.js';

const renderer = createRenderer();
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xececec);
attachEnvironment(renderer, scene);

const camera = createCamera();
const controls = createControls(camera, renderer.domElement);

const lights = createLights();
scene.add(lights);
const projection = createProjection(scene);
const openDoors = createOpenDoors(scene);
const panel = initPanel({ onClose: () => picker.select(null) });
const runButtons = createRunButtons({ camera, renderer });
const paint = createPaintTool({ scene, camera, renderer, projection });
const picker = createPicker({
  scene,
  camera,
  renderer,
  controls,
  projection,
  panel,
  runButtons,
  paint,
  onPlacementEnd: () => toolbar.setActive('select'),
});

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Share: scene JSON + a hero PNG rendered with the harness camera.
function shareScene() {
  download(new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' }), 'kitchen-scene.json');
  const prevPosition = camera.position.clone();
  const prevTarget = controls.target.clone();
  applyCameraPreset(camera, controls, 'hero');
  renderer.render(scene, camera);
  renderer.domElement.toBlob((blob) => {
    if (blob) download(blob, 'kitchen-hero.png');
    camera.position.copy(prevPosition);
    controls.target.copy(prevTarget);
    controls.update();
  }, 'image/png');
}

const toolbar = createToolbar({
  onTool: (t) => picker.setTool(t),
  onPlace: (kind) => {
    picker.setTool('select');
    toolbar.setActive('select');
    picker.beginPlacement(kind);
  },
  onSnap: (v) => picker.setSnap(v),
  onSolid: (v) => projection.setClay(v),
  onLights: (name) => applyLightPreset(lights, name),
  onShare: shareScene,
});

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
installDebugApi({ camera, controls, renderer, ready, openDoors, picker, projection });

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

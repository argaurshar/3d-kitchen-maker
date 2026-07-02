import * as THREE from 'three';
import { createRenderer, attachEnvironment } from './core/renderer.js';
import { createCamera, createControls, applyCameraPreset } from './core/camera.js';
import { createLights, applyLightPreset } from './core/lights.js';
import { createProjection } from './core/projection.js';
import { createOpenDoors } from './interact/openDoors.js';
import { createPicker } from './interact/picker.js';
import { createPaintTool } from './interact/paint.js';
import { createPreview } from './interact/preview.js';
import { createWalk } from './interact/walk.js';
import { createViewChrome } from './ui/viewChrome.js';
import { createStats } from './ui/stats.js';
import { initPersistence } from './state/persist.js';
import { updateTweens } from './core/tween.js';
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

// Share: scene JSON + hero PNG + 4-view contact sheet.
function shareScene() {
  download(new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' }), 'kitchen-scene.json');
  const prevPosition = camera.position.clone();
  const prevTarget = controls.target.clone();
  const dom = renderer.domElement;

  applyCameraPreset(camera, controls, 'hero');
  renderer.render(scene, camera);
  dom.toBlob((blob) => blob && download(blob, 'kitchen-hero.png'), 'image/png');

  const sheet = document.createElement('canvas');
  sheet.width = dom.width;
  sheet.height = dom.height;
  const ctx = sheet.getContext('2d');
  ['hero', 'front', 'top', 'close'].forEach((preset, i) => {
    applyCameraPreset(camera, controls, preset);
    renderer.render(scene, camera);
    ctx.drawImage(dom, (i % 2) * (sheet.width / 2), Math.floor(i / 2) * (sheet.height / 2), sheet.width / 2, sheet.height / 2);
  });
  sheet.toBlob((blob) => blob && download(blob, 'kitchen-views.png'), 'image/png');

  camera.position.copy(prevPosition);
  controls.target.copy(prevTarget);
  controls.update();
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

const preview = createPreview({ camera, controls, renderer, picker, projection });
const walk = createWalk({ camera, controls, renderer, picker });
const viewChrome = createViewChrome({
  onPreview: () => {
    if (walk.isActive()) walk.exit();
    if (preview.isActive()) preview.exit();
    else {
      preview.enter();
      viewChrome.setPreviewActive(true);
    }
  },
  onWalk: () => {
    if (preview.isActive()) preview.exit();
    walk.isActive() ? walk.exit() : walk.enter();
  },
  onNew: () => {
    persist.clear();
    picker.select(null);
    loadGalley(false);
    toast('New scene');
  },
  onSaveJson: () =>
    download(new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' }), 'kitchen-scene.json'),
  onLoadJson: (text) => {
    try {
      const scene_ = JSON.parse(text);
      if (!scene_?.room || !Array.isArray(scene_.items)) throw new Error('not a scene');
      picker.select(null);
      store.replace(scene_);
      toast('Scene loaded');
    } catch {
      toast('Could not read that file');
    }
  },
});
preview.onExit(() => viewChrome.setPreviewActive(false));
const stats = createStats(renderer);

const persist = initPersistence();

function loadGalley(selectLarder) {
  return fetch('/src/state/fixtures/galley.json')
    .then((r) => r.json())
    .then((scene_) => {
      store.replace(scene_);
      if (selectLarder) picker.select('larder-run');
    })
    .catch((e) => console.warn('boot fixture failed:', e));
}

// Boot: restore the autosaved scene, else the galley fixture.
const savedScene = persist.load();
if (savedScene) store.replace(savedScene);
else loadGalley(true);

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
  const rawDt = (time - lastTime) / 1000;
  const dt = Math.min(rawDt, 0.1);
  lastTime = time;
  // deltaTime keeps damping + autoRotate real-time at any frame rate;
  // looser cap than the tween dt so slow frames don't slow the orbit.
  if (!picker.isDragging() && !walk.isActive()) controls.update(Math.min(rawDt, 1));
  projection.update(camera);
  openDoors.update(dt);
  updateTweens(dt);
  // Walking uses a looser cap so speed holds up at low frame rates.
  walk.update(Math.min(rawDt, 0.3));
  picker.update();
  renderer.render(scene, camera);
  stats.tick();
  if (firstFrame) {
    firstFrame = false;
    resolveReady();
  }
});

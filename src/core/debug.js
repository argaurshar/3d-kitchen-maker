import * as THREE from 'three';
import { applyCameraPreset } from './camera.js';
import { store } from '../state/store.js';
import { loadFixtureScene } from '../state/fixtureLoader.js';
import * as actions from '../state/actions.js';

// Debug API for the screenshot harness (tools/shot.mjs) and future tooling.
// Not for application code — the app itself must go through the store.
export function installDebugApi({ camera, controls, renderer, ready, openDoors, picker, projection }) {
  window.__app = {
    // Resolves after the first rendered frame.
    ready,

    // For harness assertions (e.g. proving disposal keeps geometry flat).
    store,
    getRendererInfo: () => ({
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    }),
    actions,

    // Jump doors/drawers to an exact open amount (deterministic screenshots).
    setOpen: (amount) => openDoors?.set(amount),

    setCamera(preset) {
      applyCameraPreset(camera, controls, preset);
    },

    async loadFixture(name) {
      // Bundled at build time (see fixtureLoader) so this resolves under any
      // deploy base; loadFixtureScene throws on an unknown fixture name.
      store.replace(await loadFixtureScene(name));
    },

    // Full selection: highlight + gizmo + panel + run buttons.
    select(itemId) {
      picker?.select(itemId);
    },
    getSelection: () => picker?.getSelectedId() ?? null,
    setSnap: (v) => picker?.setSnap(v),

    // Harness helpers: screen-space projection for scripted pointer input.
    // Refreshes the camera matrices so results are correct even if no frame
    // has rendered since the camera moved (slow headless rendering).
    project(worldPos) {
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      const v = new THREE.Vector3(...worldPos).project(camera);
      const dom = renderer.domElement;
      return [((v.x + 1) / 2) * dom.clientWidth, ((1 - v.y) / 2) * dom.clientHeight];
    },
    getGizmoDotScreen() {
      const world = picker?.gizmoDotWorld();
      return world ? window.__app.project(world) : null;
    },
    getCameraPosition: () => camera.position.toArray(),
    pickAt: (x, y, raw) => picker?.pickAt(x, y, raw),
    getControlsState: () => ({
      state: controls.state,
      autoRotate: controls.autoRotate,
      enabled: controls.enabled,
      target: controls.target.toArray(),
    }),

    // Distinct material names on an item's meshes (clay-mode assertions).
    getItemMaterials(itemId) {
      const group = projection?.getItemGroup(itemId);
      const names = new Set();
      group?.traverse((n) => n.isMesh && names.add(n.material.name || 'unnamed'));
      return [...names];
    },
  };
}

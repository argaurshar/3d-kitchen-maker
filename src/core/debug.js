import * as THREE from 'three';
import { applyCameraPreset } from './camera.js';
import { store } from '../state/store.js';

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
    }),

    // Jump doors/drawers to an exact open amount (deterministic screenshots).
    setOpen: (amount) => openDoors?.set(amount),

    setCamera(preset) {
      applyCameraPreset(camera, controls, preset);
    },

    async loadFixture(name) {
      const url = `/src/state/fixtures/${name}.json`;
      const response = await fetch(url);
      const type = response.headers.get('content-type') ?? '';
      // Vite's SPA fallback answers unknown paths with 200 + index.html,
      // so a status check alone can't detect a missing fixture.
      if (!response.ok || !type.includes('json')) {
        throw new Error(`loadFixture: no fixture "${name}" at ${url}`);
      }
      store.replace(await response.json());
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

    // Distinct material names on an item's meshes (clay-mode assertions).
    getItemMaterials(itemId) {
      const group = projection?.getItemGroup(itemId);
      const names = new Set();
      group?.traverse((n) => n.isMesh && names.add(n.material.name || 'unnamed'));
      return [...names];
    },
  };
}

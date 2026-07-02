import { applyCameraPreset } from './camera.js';
import { store } from '../state/store.js';

// Debug API for the screenshot harness (tools/shot.mjs) and future tooling.
// Not for application code — the app itself must go through the store.
export function installDebugApi({ camera, controls, renderer, ready }) {
  window.__app = {
    // Resolves after the first rendered frame.
    ready,

    // For harness assertions (e.g. proving disposal keeps geometry flat).
    store,
    getRendererInfo: () => ({
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    }),

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

    // No-op until picking lands in Prompt 8.
    select(itemId) {},
  };
}

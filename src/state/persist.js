import { store } from './store.js';

const KEY = 'kitchen-maker.scene.v1';
const DEBOUNCE_MS = 500;

// Autosave the scene to localStorage on every change (debounced) and
// restore it on boot.
export function initPersistence() {
  let timer = null;
  store.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(store.get()));
      } catch (e) {
        console.warn('persist: save failed', e);
      }
    }, DEBOUNCE_MS);
  });

  return {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        const scene = raw ? JSON.parse(raw) : null;
        return scene?.room && Array.isArray(scene.items) ? scene : null;
      } catch {
        return null;
      }
    },
    clear() {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* private mode */
      }
    },
  };
}

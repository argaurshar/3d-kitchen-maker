// Scene state store — the single source of truth (see CLAUDE.md).
// Holds the Scene JSON. The UI writes here; the 3D layer subscribes and
// rebuilds affected items. Callers must not mutate the object returned by
// get() — all writes go through set()/replace().

const DEFAULT_SCENE = {
  room: {
    width: 6,
    depth: 5,
    wallHeight: 2.6,
    wallColor: 'paint_white',
    floorMaterial: 'tile_light',
  },
  items: [],
};

let scene = structuredClone(DEFAULT_SCENE);
const subscribers = new Set();

function notify(change) {
  for (const callback of subscribers) callback(change, scene);
}

export const store = {
  get() {
    return scene;
  },

  // set("room.wallColor", "paint_sage") — dot-separated path into the scene.
  set(path, value) {
    const keys = Array.isArray(path) ? path : String(path).split('.');
    let node = scene;
    for (const key of keys.slice(0, -1)) {
      if (node == null || typeof node !== 'object') {
        throw new Error(`store.set: no such path "${keys.join('.')}"`);
      }
      node = node[key];
    }
    if (node == null || typeof node !== 'object') {
      throw new Error(`store.set: no such path "${keys.join('.')}"`);
    }
    node[keys.at(-1)] = value;
    notify({ type: 'set', path: keys.join('.'), value });
  },

  // Replace the whole scene (fixture load, undo, file open).
  replace(nextScene) {
    scene = nextScene;
    notify({ type: 'replace' });
  },

  // subscribe((change, scene) => …) — returns an unsubscribe function.
  subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },
};

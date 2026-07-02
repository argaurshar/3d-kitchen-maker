import * as THREE from 'three';

// Procedural canvas textures used by generators. Seeded, not Math.random,
// so renders are identical between runs and screenshots stay diffable.

function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

// Square tiles with thin grout lines. The texture covers
// tileSize * tilesPerSide meters; callers set texture.repeat from
// texture.userData.worldSize to keep tiles at world scale.
export function makeTileTexture({
  tileSize = 0.5,
  tilesPerSide = 4,
  pixelsPerTile = 128,
  tileColor = '#e4dfd7',
  groutColor = '#c6bfb3',
  groutPx = 3,
  variation = 0.018,
  seed = 7,
} = {}) {
  const size = tilesPerSide * pixelsPerTile;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);

  ctx.fillStyle = groutColor;
  ctx.fillRect(0, 0, size, size);

  const base = new THREE.Color(tileColor);
  for (let row = 0; row < tilesPerSide; row += 1) {
    for (let col = 0; col < tilesPerSide; col += 1) {
      const jitter = (random() - 0.5) * 2 * variation;
      ctx.fillStyle = `#${base.clone().offsetHSL(0, 0, jitter).getHexString()}`;
      ctx.fillRect(
        col * pixelsPerTile + groutPx / 2,
        row * pixelsPerTile + groutPx / 2,
        pixelsPerTile - groutPx,
        pixelsPerTile - groutPx
      );
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.userData.worldSize = tileSize * tilesPerSide;
  return texture;
}

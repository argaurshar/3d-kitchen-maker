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

// Butcher-block wood: warm tan strips with subtle grain streaks. One repeat
// covers `worldSize` meters; geometry that uses it should have world-scaled
// UVs (see worldScaleBoxUVs in src/build/util.js).
export function makeWoodTexture({
  size = 512,
  worldSize = 1,
  strips = 16,
  baseColor = { h: 30, s: 38, l: 60 },
  seed = 21,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);
  const stripHeight = size / strips;

  for (let i = 0; i < strips; i += 1) {
    const y = i * stripHeight;
    const light = baseColor.l + (random() - 0.5) * 9;
    const hue = baseColor.h + (random() - 0.5) * 6;
    ctx.fillStyle = `hsl(${hue}, ${baseColor.s}%, ${light}%)`;
    ctx.fillRect(0, y, size, stripHeight);

    // Grain: faint darker streaks running along the strip.
    const streaks = 26;
    for (let s = 0; s < streaks; s += 1) {
      const sy = y + random() * stripHeight;
      const sx = random() * size;
      const length = 40 + random() * 180;
      const drift = (random() - 0.5) * 3;
      ctx.strokeStyle = `rgba(92, 62, 32, ${0.04 + random() * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + length / 2, sy + drift, sx + length, sy);
      ctx.stroke();
    }

    // Seam between strips.
    ctx.fillStyle = 'rgba(84, 56, 30, 0.35)';
    ctx.fillRect(0, y, size, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.userData.worldSize = worldSize;
  return texture;
}

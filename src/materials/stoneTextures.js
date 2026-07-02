import * as THREE from 'three';

// Procedural stone + parquet canvases (seeded, deterministic).
function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function canvasTexture(canvas, worldSize) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.userData.worldSize = worldSize;
  return texture;
}

const makeCanvas = (size) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
};

export function makeMarbleTexture({ size = 512, seed = 60 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);
  ctx.fillStyle = '#f0eeea';
  ctx.fillRect(0, 0, size, size);
  for (let v = 0; v < 7; v += 1) {
    const x0 = random() * size;
    const y0 = random() * size;
    ctx.strokeStyle = `rgba(150,150,158,${0.1 + random() * 0.15})`;
    ctx.lineWidth = 1 + random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    let x = x0;
    let y = y0;
    for (let s = 0; s < 4; s += 1) {
      const nx = x + (random() - 0.3) * 220;
      const ny = y + (random() - 0.3) * 220;
      ctx.quadraticCurveTo(x + (random() - 0.5) * 120, y + (random() - 0.5) * 120, nx, ny);
      x = nx;
      y = ny;
    }
    ctx.stroke();
  }
  return canvasTexture(canvas, 1.2);
}

export function makeGraniteTexture({ size = 512, seed = 61 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);
  ctx.fillStyle = '#26282b';
  ctx.fillRect(0, 0, size, size);
  const tones = ['#3b3e42', '#54575c', '#8e9296', '#1a1c1e', '#c9ccd0'];
  for (let d = 0; d < 4200; d += 1) {
    ctx.fillStyle = tones[Math.floor(random() * tones.length)];
    ctx.globalAlpha = 0.35 + random() * 0.5;
    const r = 0.6 + random() * 2.4;
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return canvasTexture(canvas, 0.9);
}

export function makeConcreteTexture({ size = 512, seed = 62 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);
  ctx.fillStyle = '#b9b7b2';
  ctx.fillRect(0, 0, size, size);
  for (let b = 0; b < 60; b += 1) {
    const r = 30 + random() * 90;
    const g = ctx.createRadialGradient(random() * size, random() * size, 0, random() * size, random() * size, r);
    const shade = 168 + Math.floor((random() - 0.5) * 26);
    g.addColorStop(0, `rgba(${shade},${shade - 2},${shade - 6},0.16)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  for (let p = 0; p < 300; p += 1) {
    ctx.fillStyle = `rgba(90,88,84,${0.1 + random() * 0.2})`;
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, 0.5 + random() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTexture(canvas, 1.4);
}

export function makeTerrazzoTexture({ size = 512, seed = 63 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);
  ctx.fillStyle = '#e8e4dc';
  ctx.fillRect(0, 0, size, size);
  const chips = ['#b0543f', '#3c5568', '#c8a75c', '#8e9296', '#4c4f54', '#d8cfc2'];
  for (let c = 0; c < 240; c += 1) {
    const cx = random() * size;
    const cy = random() * size;
    const r = 3 + random() * 9;
    ctx.fillStyle = chips[Math.floor(random() * chips.length)];
    ctx.beginPath();
    ctx.moveTo(cx + r, cy);
    for (let a = 1; a < 6; a += 1) {
      const ang = (a / 6) * Math.PI * 2;
      const rr = r * (0.6 + random() * 0.5);
      ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  return canvasTexture(canvas, 1.0);
}

export function makeQuartzTexture({ size = 256, seed = 64 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);
  ctx.fillStyle = '#c9c9c7';
  ctx.fillRect(0, 0, size, size);
  for (let d = 0; d < 1600; d += 1) {
    const v = 185 + Math.floor((random() - 0.5) * 34);
    ctx.fillStyle = `rgba(${v},${v},${v - 2},0.5)`;
    ctx.beginPath();
    ctx.arc(random() * size, random() * size, 0.5 + random(), 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTexture(canvas, 0.8);
}

// Hexagon tile: white hexes with thin grout, for backsplashes.
export function makeHexTexture({ size = 512, seed = 66 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);
  ctx.fillStyle = '#c9c4bb';
  ctx.fillRect(0, 0, size, size);
  const r = size / 8; // hex radius
  const w = Math.sqrt(3) * r;
  const h = 1.5 * r;
  for (let row = -1; row < size / h + 1; row += 1) {
    for (let col = -1; col < size / w + 1; col += 1) {
      const cx = col * w + (row % 2 ? w / 2 : 0);
      const cy = row * h;
      const light = 94 + (random() - 0.5) * 4;
      ctx.fillStyle = `hsl(40, 12%, ${light}%)`;
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        const px = cx + Math.cos(a) * (r - 1.6);
        const py = cy + Math.sin(a) * (r - 1.6);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  return canvasTexture(canvas, 0.55);
}

// Herringbone parquet: two-tone diagonal blocks.
export function makeParquetTexture({ size = 512, seed = 65 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);
  ctx.fillStyle = '#a5762f';
  ctx.fillRect(0, 0, size, size);
  const bw = size / 8;
  const bl = bw * 3;
  for (let row = -2; row < 14; row += 1) {
    for (let col = -2; col < 14; col += 1) {
      const x = col * bl * 0.5;
      const y = row * bw * 1.0 - ((col % 2) * bw) / 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(((col % 2 ? 45 : -45) * Math.PI) / 180);
      const light = 38 + random() * 14;
      ctx.fillStyle = `hsl(33, 42%, ${light}%)`;
      ctx.fillRect(0, 0, bl, bw - 1.5);
      ctx.restore();
    }
  }
  return canvasTexture(canvas, 1.2);
}

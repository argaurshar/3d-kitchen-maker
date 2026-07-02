import { SWATCHES } from '../materials/swatches.js';
import { el } from './controls.js';

// SVG radial swatch wheel, anchored to a 3D point (repositioned per frame).
// Rings: inner PAINT, middle WOOD+STONE, outer METAL + appliance neutrals.
const SIZE = 430;
const C = SIZE / 2;
const RINGS = [
  { categories: ['paint'], r0: 64, r1: 112 },
  { categories: ['wood', 'stone'], r0: 116, r1: 164 },
  { categories: ['metal', 'appliance'], r0: 168, r1: 208 },
];
const GAP_DEG = 1.6;

const polar = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};

function arcPath(r0, r1, a0, a1) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = polar(r1, a0);
  const [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1);
  const [x3, y3] = polar(r0, a0);
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
}

// Fill for a swatch: flat color, or a pattern rendered from the SAME canvas
// the material uses (cached).
const patternCache = new Map();
function swatchFill(swatch, defs) {
  if (!swatch.params.map) return swatch.params.color;
  if (!patternCache.has(swatch.id)) {
    const texture = swatch.params.map();
    const url = texture.image.toDataURL();
    texture.dispose();
    patternCache.set(swatch.id, url);
  }
  const pid = `pat-${swatch.id}`;
  if (!defs.querySelector(`#${pid}`)) {
    const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', pid);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', '46');
    pattern.setAttribute('height', '46');
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', patternCache.get(swatch.id));
    image.setAttribute('width', '46');
    image.setAttribute('height', '46');
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    pattern.appendChild(image);
    defs.appendChild(pattern);
  }
  return `url(#${pid})`;
}

export function createWheel({ onPreview, onRevert, onCommit }) {
  const root = el('div', 'wheel hidden');
  root.style.width = `${SIZE}px`;
  root.style.height = `${SIZE}px`;
  document.body.appendChild(root);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  root.appendChild(svg);
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);

  // Center disc + labels
  const disc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  disc.setAttribute('cx', C);
  disc.setAttribute('cy', C);
  disc.setAttribute('r', 58);
  disc.setAttribute('class', 'wheel-disc');
  const labelTop = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  labelTop.setAttribute('x', C);
  labelTop.setAttribute('y', C - 4);
  labelTop.setAttribute('class', 'wheel-label');
  const labelSub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  labelSub.setAttribute('x', C);
  labelSub.setAttribute('y', C + 16);
  labelSub.setAttribute('class', 'wheel-sublabel');

  let open = false;
  let target = null;
  let lastX = -1;
  let lastY = -1;

  function buildSegments() {
    for (const ring of RINGS) {
      const swatches = SWATCHES.filter((s) => ring.categories.includes(s.category));
      const step = 360 / swatches.length;
      swatches.forEach((swatch, i) => {
        const a0 = i * step + GAP_DEG / 2;
        const a1 = (i + 1) * step - GAP_DEG / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', arcPath(ring.r0, ring.r1, a0, a1));
        path.setAttribute('fill', swatchFill(swatch, defs));
        path.setAttribute('class', 'wheel-seg');
        path.setAttribute('data-swatch', swatch.id);
        path.addEventListener('pointerenter', () => {
          labelTop.textContent = swatch.label;
          path.classList.add('hover');
          onPreview(swatch.id);
        });
        path.addEventListener('pointerleave', () => {
          labelTop.textContent = '';
          path.classList.remove('hover');
          onRevert();
        });
        path.addEventListener('click', (e) => {
          e.stopPropagation();
          onCommit(swatch.id);
        });
        svg.appendChild(path);
      });
    }
    svg.append(disc, labelTop, labelSub);
  }
  buildSegments();

  return {
    show(surface) {
      target = surface;
      labelTop.textContent = '';
      labelSub.textContent = surface.role;
      root.classList.remove('hidden');
      open = true;
    },
    hide() {
      root.classList.add('hidden');
      open = false;
      target = null;
    },
    setScreen(x, y, visible) {
      // Skip sub-pixel jitter so the wheel is still while the camera rests.
      if (Math.abs(x - lastX) > 0.75 || Math.abs(y - lastY) > 0.75) {
        lastX = x;
        lastY = y;
        root.style.left = `${Math.round(x)}px`;
        root.style.top = `${Math.round(y)}px`;
      }
      root.style.display = visible ? '' : 'none';
    },
    isOpen: () => open,
  };
}

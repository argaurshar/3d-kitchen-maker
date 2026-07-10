import { store } from '../state/store.js';
import { applyCameraPreset, elevationView } from '../core/camera.js';
import { WALLS, WALL_LABELS, summarizeWall, elementsByWall, suggestMissing } from '../state/elements.js';
import { el } from './controls.js';

// Elevations planner: a launcher pill that opens a strip of straight-on side
// elevations (one per wall) plus Plan and 3D. Each wall button carries a live
// count of the elements against it, a caption detects what is there, and
// "Add unit" starts placement targeting that wall.
const VIEWS = [
  { id: 'north', label: 'North' },
  { id: 'east', label: 'East' },
  { id: 'south', label: 'South' },
  { id: 'west', label: 'West' },
  { id: 'plan', label: 'Plan' },
  { id: 'iso', label: '3D' },
];

export function createElevations({ camera, controls, renderer, onAdd, onPlace, onExport }) {
  const launch = el('button', 'elev-launch', 'Elevations');
  const panel = el('div', 'elev-panel hidden');
  const grid = el('div', 'elev-grid');
  const caption = el('div', 'elev-caption');
  const addBtn = el('button', 'elev-add', '+ Add unit to this wall');
  const suggestions = el('div', 'elev-suggest');
  const exportBtn = el('button', 'elev-export', 'Export 2D drawings (PNG)');
  panel.append(
    el('div', 'elev-title', 'Side elevations'),
    grid,
    caption,
    addBtn,
    el('div', 'elev-title elev-suggest-title', 'Suggestions'),
    suggestions,
    exportBtn
  );
  document.body.append(launch, panel);
  exportBtn.addEventListener('click', () => onExport?.());

  let current = null;
  let open = false;

  const buttons = new Map();
  for (const v of VIEWS) {
    const b = el('button', 'elev-view');
    b.dataset.view = v.id;
    b.append(el('span', 'elev-view-label', v.label));
    if (WALLS.includes(v.id)) b.append(el('span', 'elev-badge', '0'));
    b.addEventListener('click', () => setView(v.id));
    grid.appendChild(b);
    buttons.set(v.id, b);
  }

  addBtn.addEventListener('click', () => {
    if (current && WALLS.includes(current)) onAdd?.(current);
  });

  const aspect = () => {
    const dom = renderer.domElement;
    return dom.clientWidth / dom.clientHeight || 1.6;
  };

  function setView(id) {
    current = id;
    if (id === 'plan') applyCameraPreset(camera, controls, 'top');
    else if (id === 'iso') applyCameraPreset(camera, controls, 'hero');
    else applyCameraPreset(camera, controls, elevationView(store.get().room, id, aspect()));
    refresh();
  }

  function refresh() {
    const scene = store.get();
    const groups = elementsByWall(scene);
    for (const w of WALLS) {
      const badge = buttons.get(w).querySelector('.elev-badge');
      badge.textContent = String(groups[w].length);
      badge.classList.toggle('empty', groups[w].length === 0);
    }
    for (const [id, b] of buttons) b.classList.toggle('active', id === current);
    const wall = current && WALLS.includes(current);
    addBtn.classList.toggle('hidden', !wall);
    if (wall) caption.textContent = `${WALL_LABELS[current]} wall — ${summarizeWall(scene, current)}`;
    else if (current === 'plan') caption.textContent = 'Plan view (top-down)';
    else if (current === 'iso') caption.textContent = '3D perspective';
    else caption.textContent = 'Pick a wall to see its elevation';
    renderSuggestions(scene);
  }

  // Missing-element checklist: each row names the gap and offers a one-click
  // Add that starts ghost placement of the fixing element.
  function renderSuggestions(scene) {
    suggestions.innerHTML = '';
    const missing = suggestMissing(scene);
    if (!missing.length) {
      suggestions.appendChild(el('div', 'elev-suggest-ok', '✓ All the essentials are here'));
      return;
    }
    for (const s of missing) {
      const row = el('div', 'elev-suggest-row');
      row.dataset.suggest = s.id;
      const text = el('div', 'elev-suggest-text');
      text.append(el('div', 'elev-suggest-label', s.label), el('div', 'elev-suggest-detail', s.detail));
      const add = el('button', 'elev-suggest-add', 'Add');
      add.addEventListener('click', () => onPlace?.(s.add, s.label));
      row.append(text, add);
      suggestions.appendChild(row);
    }
  }

  launch.addEventListener('click', () => {
    open = !open;
    panel.classList.toggle('hidden', !open);
    launch.classList.toggle('active', open);
    if (open) refresh();
  });

  store.subscribe(() => open && refresh());

  return {
    setView,
    isOpen: () => open,
    currentDir: () => current,
    counts: () => {
      const g = elementsByWall(store.get());
      return Object.fromEntries(WALLS.map((w) => [w, g[w].length]));
    },
    suggestions: () => suggestMissing(store.get()),
    close() {
      open = false;
      panel.classList.add('hidden');
      launch.classList.remove('active');
    },
  };
}

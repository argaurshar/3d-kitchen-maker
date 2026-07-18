import { el } from './controls.js';
import { fixtureNames } from '../state/fixtureLoader.js';

// Categorized placement catalog (replaces the flat furnish row): tabbed
// popover above the toolbar. Entries hand the same placement kinds to
// ghost placement as before; the Presets tab loads complete designs.
const TABS = [
  {
    id: 'units',
    label: 'Units',
    items: [
      { label: 'Base unit', hint: 'Worktop run', kind: { type: 'run', unitType: 'base' } },
      { label: 'Wall unit', hint: 'Overhead, needs a wall', kind: { type: 'run', unitType: 'wall' } },
      { label: 'Tall unit', hint: 'Larder / oven tower', kind: { type: 'run', unitType: 'tall' } },
      { label: 'Island', hint: 'Freestanding + seating', kind: { type: 'run', unitType: 'island' } },
    ],
  },
  {
    id: 'appliances',
    label: 'Appliances',
    items: [
      { label: 'Fridge', hint: '4 types, 6 finishes', kind: { type: 'appliance', applianceType: 'fridge' } },
      { label: 'Hob', hint: 'Drops onto a worktop', kind: { type: 'appliance', applianceType: 'hob' } },
      { label: 'Sink', hint: 'Drops onto a worktop', kind: { type: 'appliance', applianceType: 'sink' } },
      { label: 'Tap', hint: 'Snaps to a sink', kind: { type: 'appliance', applianceType: 'tap' } },
      { label: 'Extractor hood', hint: 'Wall-mounted', kind: { type: 'appliance', applianceType: 'hood' } },
    ],
  },
  {
    id: 'seating',
    label: 'Seating',
    items: [{ label: 'Stool', hint: '3 presets, parametric', kind: { type: 'furniture', furnitureType: 'stool' } }],
  },
  { id: 'presets', label: 'Presets', items: null }, // filled from fixtures
];

const PRESET_LABELS = {
  'reference-kitchen': 'Showroom L-kitchen',
  galley: 'Galley starter',
  'single-cabinet': 'Single cabinet',
  'tall-stack': 'Tall stack demo',
  'larder-like': 'Larder demo',
  'room-only': 'Empty room',
  empty: 'Blank scene',
};
const prettify = (name) =>
  PRESET_LABELS[name] ?? name.replace(/^preset-/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function createCatalog({ onPlace, onLoadPreset }) {
  const root = el('div', 'catalog hidden');
  const tabBar = el('div', 'catalog-tabs');
  const body = el('div', 'catalog-body');
  root.append(tabBar, body);
  document.body.appendChild(root);

  let open = false;
  let active = 'units';
  const tabButtons = new Map();

  for (const tab of TABS) {
    const btn = el('button', 'catalog-tab', tab.label);
    btn.addEventListener('click', () => {
      active = tab.id;
      render();
    });
    tabBar.appendChild(btn);
    tabButtons.set(tab.id, btn);
  }

  function entry(label, hint, onClick) {
    const item = el('button', 'catalog-item');
    item.appendChild(el('span', 'catalog-item-label', label));
    if (hint) item.appendChild(el('span', 'catalog-item-hint', hint));
    item.addEventListener('click', onClick);
    return item;
  }

  function render() {
    for (const [tabId, btn] of tabButtons) btn.classList.toggle('active', tabId === active);
    body.innerHTML = '';
    const tab = TABS.find((t) => t.id === active);
    if (tab.items) {
      for (const it of tab.items) {
        body.appendChild(entry(it.label, it.hint, () => {
          setOpen(false);
          onPlace(it.kind);
        }));
      }
    } else {
      // Presets: every bundled fixture, friendly-labeled, design presets first.
      const names = fixtureNames().sort((a, b) => Number(b.startsWith('preset-')) - Number(a.startsWith('preset-')));
      for (const name of names) {
        body.appendChild(entry(prettify(name), 'Load complete design', () => {
          setOpen(false);
          onLoadPreset(name);
        }));
      }
    }
  }

  function setOpen(v) {
    open = v;
    root.classList.toggle('hidden', !open);
    if (open) render();
  }

  return {
    toggle: () => (setOpen(!open), open),
    close: () => setOpen(false),
    isOpen: () => open,
  };
}

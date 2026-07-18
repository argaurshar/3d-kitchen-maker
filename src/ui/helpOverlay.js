import { el } from './controls.js';

// Discoverability: a full-screen cheat-sheet listing every tool, toggle,
// gesture and shortcut. Opened with "?" or the chrome help button.
const SECTIONS = [
  {
    title: 'Tools (bottom bar)',
    rows: [
      ['Select', 'Click items; drag to move, blue ring to rotate'],
      ['Paint', 'Hover a surface, click for the material wheel'],
      ['Delete', 'Click any item to remove it (Ctrl+Z undoes)'],
      ['Share', 'Downloads scene JSON + photo views'],
      ['Build', 'Room size + measurement units'],
      ['Furnish', 'Catalog: units, appliances, seating, presets'],
      ['Lights / Snap / Solid', 'Lighting mood · grid snapping · clay view'],
    ],
  },
  {
    title: 'Faster editing',
    rows: [
      ['Double-click a surface', 'Opens the material wheel instantly'],
      ['Quick actions under selection', 'Rotate 90° · duplicate · materials · delete'],
      ['Arrow keys', 'Nudge selection 10 mm (Shift: 100 mm)'],
      ['Drag an item', 'Move with wall/grid snapping'],
      ['+ buttons at run ends', 'Append or prepend a cabinet'],
    ],
  },
  {
    title: 'Keyboard',
    rows: [
      ['Ctrl+Z / Ctrl+Y', 'Undo / redo any change'],
      ['O', 'Open/close every door and drawer'],
      ['Delete', 'Remove the selected item'],
      ['Escape', 'Close wheel / cancel placement / deselect'],
      ['F', 'Performance overlay'],
      ['?', 'This help'],
    ],
  },
  {
    title: 'Presenting',
    rows: [
      ['Preview', 'Clean auto-orbit for clients'],
      ['Person button', 'First-person walkthrough (WASD)'],
      ['Elevations', 'Per-wall views, suggestions, 2D CAD export'],
    ],
  },
];

export function createHelpOverlay() {
  const root = el('div', 'help-overlay hidden');
  const card = el('div', 'help-card');
  card.appendChild(el('div', 'help-title', 'Everything you can do'));
  const grid = el('div', 'help-grid');
  for (const section of SECTIONS) {
    const col = el('div', 'help-section');
    col.appendChild(el('div', 'help-section-title', section.title));
    for (const [term, what] of section.rows) {
      const row = el('div', 'help-row');
      row.appendChild(el('span', 'help-term', term));
      row.appendChild(el('span', 'help-what', what));
      col.appendChild(row);
    }
    grid.appendChild(col);
  }
  card.appendChild(grid);
  card.appendChild(el('div', 'help-hint', 'Press Escape or click anywhere to close'));
  root.appendChild(card);
  document.body.appendChild(root);

  let open = false;
  const setOpen = (v) => {
    open = v;
    root.classList.toggle('hidden', !open);
  };
  root.addEventListener('click', () => setOpen(false));
  window.addEventListener('keydown', (e) => {
    if (open && e.key === 'Escape') setOpen(false);
  });

  return { toggle: () => setOpen(!open), isOpen: () => open };
}

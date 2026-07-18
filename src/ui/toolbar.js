import { el } from './controls.js';

// Bottom-center pill toolbar + furnish row, matching the reference layout.
const svg = (paths) =>
  `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">${paths}</svg>`;

const ICONS = {
  select: svg('<path d="M4 1.5 12.5 7.6 8.6 8.6 10.8 13.2 8.9 14.1 6.8 9.5 4 12z"/>'),
  paint: svg('<path d="M2 2h9v3H2zM12 3h2v4H8v5H6v-7h6zM6 13h2v2H6z"/>'),
  delete: svg('<path d="M6 1h4l.5 1H14v1.5H2V2h3.5L6 1zM3 5h10l-.7 9.1a1 1 0 0 1-1 .9H4.7a1 1 0 0 1-1-.9L3 5zm3 2v5.5h1.2V7H6zm2.8 0v5.5H10V7H8.8z"/>'),
  share: svg('<path d="M8 1l3.5 3.5-1 1L8.75 3.7V10h-1.5V3.7L5.5 5.5l-1-1zM3 8h2v1.5H4.5V13h7V9.5H10V8h2v6.5H3z"/>'),
  build: svg('<path d="M13.7 4.3 11.6 6.4 9.5 4.3l2.1-2.1a3.4 3.4 0 0 0-4.4 4.4L2 11.8V14h2.2l5.2-5.2a3.4 3.4 0 0 0 4.3-4.5z"/>'),
  furnish: svg('<path d="M2 3h12v9h-1.5v2H11v-2H5v2H3.5v-2H2zm1.5 1.5v6h4v-6zm5.5 0v6h4v-6zM5 7h1v1.5H5zM10 7h1v1.5h-1z"/>'),
  lights: svg('<path d="M8 1a4.5 4.5 0 0 1 2.6 8.2c-.4.3-.6.7-.6 1.1V11H6v-.7c0-.4-.2-.8-.6-1.1A4.5 4.5 0 0 1 8 1zM6 12h4v1.2H6zM6.7 14h2.6v1H6.7z"/>'),
  snap: svg('<path d="M3 2h3.5v6a1.5 1.5 0 0 0 3 0V2H13v6a5 5 0 0 1-10 0zm0 0v3h3.5M9.5 2v3H13" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
  solid: svg('<path d="M8 1 14 4.2v7.6L8 15 2 11.8V4.2zM3.5 5.6v5.3L7.2 13V7.5zm9 0L8.8 7.5V13l3.7-2.1z"/>'),
  chevron: svg('<path d="M5 3l5 5-5 5-1-1 4-4-4-4z"/>'),
  quote:
    '<svg viewBox="0 0 16 16" width="16" height="16"><text x="8" y="12.5" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">₹</text></svg>',
};

const MAIN_ITEMS = [
  { id: 'select', label: 'Select', kind: 'tool' },
  { id: 'paint', label: 'Paint', kind: 'tool' },
  { id: 'delete', label: 'Delete', kind: 'tool' },
  { id: 'share', label: 'Share', kind: 'action' },
  { id: 'quote', label: 'Quote', kind: 'action' },
  { id: 'build', label: 'Build', kind: 'action' },
  { id: 'furnish', label: 'Furnish', kind: 'menu' },
  { id: 'lights', label: 'Lights', kind: 'toggle' },
  { id: 'snap', label: 'Snap', kind: 'toggle' },
  { id: 'solid', label: 'Solid', kind: 'toggle' },
];

export function toast(message) {
  document.querySelector('.toast')?.remove();
  const node = el('div', 'toast', message);
  document.body.appendChild(node);
  setTimeout(() => node.classList.add('fade'), 1400);
  setTimeout(() => node.remove(), 2000);
}

export function createToolbar(handlers) {
  const bar = el('div', 'toolbar');
  document.body.append(bar);

  const buttons = new Map();
  const state = { tool: 'select', snap: false, solid: false, lights: 'day' };

  function setActive(toolId) {
    state.tool = toolId;
    for (const [id, btn] of buttons) {
      if (MAIN_ITEMS.find((i) => i.id === id)?.kind === 'tool') {
        btn.classList.toggle('active', id === toolId);
      }
    }
  }

  // The furnish button fronts the catalog popover; handlers own its state.
  function closeFurnish() {
    handlers.onFurnishClose?.();
    buttons.get('furnish')?.classList.remove('active');
  }

  for (const item of MAIN_ITEMS) {
    const btn = el('button', 'tb-item');
    btn.dataset.tool = item.id;
    btn.innerHTML = `${ICONS[item.id]}<span class="tb-label">${item.label}</span>`;
    btn.addEventListener('click', () => {
      if (item.kind === 'tool') {
        closeFurnish();
        setActive(item.id);
        handlers.onTool?.(item.id);
      } else if (item.id === 'furnish') {
        const open = Boolean(handlers.onFurnish?.());
        btn.classList.toggle('active', open);
      } else if (item.id === 'snap') {
        state.snap = !state.snap;
        btn.classList.toggle('on', state.snap);
        handlers.onSnap?.(state.snap);
      } else if (item.id === 'solid') {
        state.solid = !state.solid;
        btn.classList.toggle('on', state.solid);
        handlers.onSolid?.(state.solid);
      } else if (item.id === 'lights') {
        // Cycle day -> evening -> night (night showcases LED lighting).
        const cycle = ['day', 'evening', 'night'];
        state.lights = cycle[(cycle.indexOf(state.lights) + 1) % cycle.length];
        btn.classList.toggle('on', state.lights !== 'day');
        btn.querySelector('.tb-label').textContent =
          state.lights === 'day' ? 'Lights' : state.lights === 'evening' ? 'Evening' : 'Night';
        handlers.onLights?.(state.lights);
      } else if (item.id === 'share') {
        handlers.onShare?.();
      } else if (item.id === 'quote') {
        handlers.onQuote?.();
      } else if (item.id === 'build') {
        handlers.onBuild?.();
      }
    });
    bar.appendChild(btn);
    buttons.set(item.id, btn);
  }

  const collapse = el('button', 'tb-item tb-collapse');
  collapse.innerHTML = ICONS.chevron;
  collapse.title = 'Collapse';
  collapse.addEventListener('click', () => {
    bar.classList.toggle('collapsed');
    closeFurnish();
  });
  bar.appendChild(collapse);

  setActive('select');
  return { setActive, closeFurnish, toast };
}

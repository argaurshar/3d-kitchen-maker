import { store } from '../state/store.js';
import * as actions from '../state/actions.js';
import { effectiveCompartments } from '../build/compartments.js';
import { renderFridgePanel, renderHoodPanel, renderStoolPanel } from './panelAppliance.js';
import { el, segmented, slider, stepper, toggle, listRow, button, section, iconButton, rafThrottle } from './controls.js';

const UNIT_LABELS = { base: 'Base unit', tall: 'Tall unit', wall: 'Wall unit', island: 'Island' };
const APPLIANCE_LABELS = { fridge: 'Fridge', hood: 'Extractor hood', sink: 'Sink', hob: 'Hob', tap: 'Tap' };
const MODULE_LABELS = {
  cabinet: 'Base cabinet',
  drawerBase: 'Drawer base',
  blindCorner: 'Blind corner',
  dishwasher: 'Dishwasher',
  filler: 'Filler',
};
const MODULE_OPTIONS = Object.entries(MODULE_LABELS).map(([value, label]) => ({ value, label }));
const COMPARTMENT_OPTIONS = [
  { value: 'shelf', label: 'Shelf' },
  { value: 'drawer', label: 'Drawer' },
  { value: 'door', label: 'Door' },
  { value: 'oven', label: 'Oven' },
  { value: 'microwave', label: 'Micro' },
];
const HANDLE_OPTIONS = [
  { value: 'cutout', label: 'Cutout' },
  { value: 'hole', label: 'Hole' },
  { value: 'bar', label: 'Bar' },
];
const cm = (m) => `${Math.round(m * 100)} cm`;

let root = null;
let view = null; // { itemId, moduleId? }
const collapsedSections = new Set();
let isLiveWrite = false;

function withLive(fn) {
  isLiveWrite = true;
  try {
    fn();
  } finally {
    isLiveWrite = false;
  }
}

// Warn + re-render when an action refuses (snaps controls back).
function run(result) {
  if (!result.ok) {
    console.warn(`panel: ${result.reason}`);
    render();
  }
}

let onCloseCallback = null;

export function initPanel({ onClose } = {}) {
  onCloseCallback = onClose ?? null;
  root = el('div', 'panel hidden');
  document.body.appendChild(root);
  store.subscribe((change) => {
    if (!view || isLiveWrite) return;
    if (change.type === 'replace') return render();
    const [head, index, ...rest] = change.path.split('.');
    if (head !== 'items') return;
    // Drag writes (position/rotation) don't affect panel content.
    if (rest.length === 1 && (rest[0] === 'position' || rest[0] === 'rotationY')) return;
    if (index === undefined || store.get().items[Number(index)]?.id === view.itemId) render();
  });
  return { select };
}

export function select(itemId) {
  view = itemId ? { itemId } : null;
  render();
}

function findItem() {
  return store.get().items.find((i) => i.id === view.itemId);
}

function render() {
  if (!view) return root.classList.add('hidden');
  const item = findItem();
  if (!item) {
    view = null;
    return root.classList.add('hidden');
  }
  const prevScroll = root.querySelector('.panel-body')?.scrollTop ?? 0;
  root.classList.remove('hidden');
  root.innerHTML = '';

  const module = view.moduleId && (item.modules ?? []).find((m) => m.id === view.moduleId);
  if (view.moduleId && !module) view.moduleId = undefined;

  root.appendChild(renderHeader(item));
  const body = el('div', 'panel-body');
  root.appendChild(body);
  if (!root.classList.contains('collapsed')) {
    const helpers = { addSection: (b, key, title) => addSection(b, key, title), run, withLive };
    if (item.kind === 'appliance' && item.applianceType === 'fridge') renderFridgePanel(body, item, helpers);
    else if (item.kind === 'appliance' && item.applianceType === 'hood') renderHoodPanel(body, item, helpers);
    else if (item.kind === 'furniture' && item.furnitureType === 'stool') renderStoolPanel(body, item, helpers);
    else if (item.kind !== 'run') body.appendChild(el('div', 'panel-note', 'No editable parameters yet'));
    else if (module) renderModulePanel(body, item, module);
    else renderRunPanel(body, item);
  }
  body.scrollTop = prevScroll;
}

function renderHeader(item) {
  const header = el('div', 'panel-header');
  header.appendChild(el('span', 'item-icon'));
  const title =
    item.kind === 'appliance'
      ? APPLIANCE_LABELS[item.applianceType] ?? 'Appliance'
      : item.kind === 'furniture'
        ? 'Stool'
        : UNIT_LABELS[item.unitType ?? 'base'] ?? 'Unit';
  header.appendChild(el('span', 'panel-title', title));
  const tools = el('div', 'panel-tools');
  tools.appendChild(
    iconButton('collapse', () => {
      root.classList.toggle('collapsed');
      render();
    }, 'Collapse')
  );
  tools.appendChild(iconButton('close', () => (onCloseCallback ? onCloseCallback() : select(null)), 'Close'));
  header.appendChild(tools);
  return header;
}

function addSection(body, key, title) {
  const sec = section(title, collapsedSections.has(key), () => {
    collapsedSections.has(key) ? collapsedSections.delete(key) : collapsedSections.add(key);
    render();
  });
  body.appendChild(sec.root);
  return sec.body;
}

function renderRunPanel(body, item) {
  const modulesBody = addSection(body, 'modules', 'Modules');
  for (const m of item.modules ?? []) {
    const label = el('div', 'list-label');
    label.appendChild(el('span', 'list-label-main', MODULE_LABELS[m.type] ?? m.type));
    label.appendChild(el('span', 'list-label-sub', cm(m.width) + (m.invalid ? ' ⚠' : '')));
    modulesBody.appendChild(
      listRow(label, {
        onClick: () => {
          view.moduleId = m.id;
          render();
        },
        onUp: () => run(actions.moveModule(item.id, m.id, -1)),
        onDown: () => run(actions.moveModule(item.id, m.id, +1)),
        onDelete: () => run(actions.removeModule(item.id, m.id)),
      })
    );
  }
  modulesBody.appendChild(button('+ Add module', () => run(actions.addModule(item.id)), 'wide'));

  const structure = addSection(body, 'structure', 'Structure');
  structure.appendChild(toggle('Worktop', item.worktop !== false, (v) => run(actions.setUnitParam(item.id, 'worktop', v))));
  structure.appendChild(toggle('Plinth (toe kick)', item.plinth !== false, (v) => run(actions.setUnitParam(item.id, 'plinth', v))));

  if (item.features?.length) {
    const featureBody = addSection(body, 'features', 'Worktop features');
    for (const feature of item.features) {
      const label = el('div', 'list-label');
      label.appendChild(el('span', 'list-label-main', APPLIANCE_LABELS[feature.type] ?? feature.type));
      label.appendChild(el('span', 'list-label-sub', `${Math.round(feature.offsetX * 100)} cm`));
      featureBody.appendChild(
        listRow(label, { onDelete: () => run(actions.removeFeature(item.id, feature.id)) })
      );
    }
  }
}

function renderModulePanel(body, item, module) {
  const crumb = el('div', 'breadcrumb');
  const back = iconButton('back', () => {
    view.moduleId = undefined;
    render();
  }, 'Back');
  crumb.append(back, el('span', 'crumb-label', UNIT_LABELS[item.unitType ?? 'base'] ?? 'Unit'));
  crumb.appendChild(el('span', 'crumb-current', MODULE_LABELS[module.type] ?? module.type));
  body.appendChild(crumb);

  body.appendChild(segmented(MODULE_OPTIONS, module.type, (v) => run(actions.setModuleParam(item.id, module.id, 'type', v))));

  const isFiller = module.type === 'filler';
  const applyWidth = rafThrottle((v) => withLive(() => actions.setModuleParam(item.id, module.id, 'width', v / 100)));
  body.appendChild(
    slider('Width', isFiller ? 6 : 30, isFiller ? 30 : 120, 2, Math.round(module.width * 100), (v) => `${v} cm`, (v, live) => {
      if (live) applyWidth(v);
      else run(actions.setModuleParam(item.id, module.id, 'width', v / 100));
    })
  );

  const comps = effectiveCompartments(module);
  const compBody = addSection(body, 'compartments', 'Compartments');
  comps.forEach((comp, i) => {
    const block = el('div', 'comp-block');
    block.appendChild(
      listRow(el('span', 'list-label-main', `${i + 1}`), {
        onUp: () => run(actions.moveCompartment(item.id, module.id, comp.id, -1)),
        onDown: () => run(actions.moveCompartment(item.id, module.id, comp.id, +1)),
        onDelete: () => run(actions.removeCompartment(item.id, module.id, comp.id)),
      })
    );
    block.appendChild(
      segmented(COMPARTMENT_OPTIONS, comp.type, (v) => run(actions.setCompartmentParam(item.id, module.id, comp.id, 'type', v)))
    );
    if (comp.type === 'door') {
      const style = el('div', 'row style-row');
      style.appendChild(
        segmented(
          [{ value: 'L', label: 'Hinge L' }, { value: 'R', label: 'Hinge R' }, { value: 'double', label: 'Double' }],
          comp.style?.hinge ?? 'L',
          (v) => run(actions.setCompartmentParam(item.id, module.id, comp.id, 'hinge', v))
        )
      );
      style.appendChild(toggle('Glass', Boolean(comp.style?.glass), (v) => run(actions.setCompartmentParam(item.id, module.id, comp.id, 'glass', v))));
      block.appendChild(style);
    }
    if (comp.type === 'shelf' || (comp.type === 'door' && comp.style?.glass)) {
      block.appendChild(
        stepper('Shelves inside', comp.shelvesInside ?? 0, 0, 6, (v) =>
          run(actions.setCompartmentParam(item.id, module.id, comp.id, 'shelvesInside', v))
        )
      );
    }
    compBody.appendChild(block);
  });
  compBody.appendChild(button('+ Add compartment', () => run(actions.addCompartment(item.id, module.id, 'door')), 'wide'));

  const handleBody = addSection(body, 'handle', 'Handle');
  handleBody.appendChild(segmented(HANDLE_OPTIONS, module.handle ?? 'bar', (v) => run(actions.setModuleParam(item.id, module.id, 'handle', v))));

  const actionsBody = addSection(body, 'actions', 'Actions');
  actionsBody.appendChild(
    button('Duplicate', () => {
      const clone = structuredClone({ type: module.type, width: module.width, handle: module.handle, compartments: effectiveCompartments(module).map(({ id, ...c }) => c) });
      run(actions.addModule(item.id, module.id, clone));
    })
  );
  actionsBody.appendChild(
    button('Delete', () => {
      view.moduleId = undefined;
      run(actions.removeModule(item.id, module.id));
    }, 'danger')
  );
}

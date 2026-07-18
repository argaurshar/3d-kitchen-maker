import { store } from '../state/store.js';
import * as actions from '../state/actions.js';
import { renderFridgePanel, renderHoodPanel, renderStoolPanel } from './panelAppliance.js';
import { renderModulePanel, MODULE_LABELS } from './panelModule.js';
import { el, segmented, toggle, listRow, button, section, iconButton } from './controls.js';
import { fmtLen, subscribeUnits } from '../state/units.js';

const UNIT_LABELS = { base: 'Base unit', tall: 'Tall unit', wall: 'Wall unit', island: 'Island' };
const APPLIANCE_LABELS = { fridge: 'Fridge', hood: 'Extractor hood', sink: 'Sink', hob: 'Hob', tap: 'Tap' };
const cm = (m) => fmtLen(m);

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
  subscribeUnits(() => view && render());
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
    const helpers = {
      addSection: (b, key, title) => addSection(b, key, title),
      run,
      withLive,
      exitModule: () => {
        view.moduleId = undefined;
        render();
      },
    };
    if (item.kind === 'appliance' && item.applianceType === 'fridge') renderFridgePanel(body, item, helpers);
    else if (item.kind === 'appliance' && item.applianceType === 'hood') renderHoodPanel(body, item, helpers);
    else if (item.kind === 'furniture' && item.furnitureType === 'stool') renderStoolPanel(body, item, helpers);
    else if (item.kind !== 'run') body.appendChild(el('div', 'panel-note', 'No editable parameters yet'));
    else if (module) renderModulePanel(body, item, module, helpers);
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
  if ((item.unitType ?? 'base') === 'wall') {
    structure.appendChild(
      toggle('Under-cabinet LED', item.underLight === true, (v) => run(actions.setUnitParam(item.id, 'underLight', v)))
    );
  }
  if ((item.unitType ?? 'base') === 'island') {
    const row = el('div', 'row');
    row.appendChild(el('label', 'row-label', 'Side faces'));
    row.appendChild(
      segmented(
        [{ value: 'panel', label: 'Panels' }, { value: 'shutter', label: 'Shutters' }],
        item.islandFaces ?? 'panel',
        (v) => run(actions.setUnitParam(item.id, 'islandFaces', v))
      )
    );
    structure.appendChild(row);
  }

  const runActions = addSection(body, 'run-actions', 'Actions');
  runActions.appendChild(toggle('Open fronts', item.openFronts === true, (v) => run(actions.setUnitParam(item.id, 'openFronts', v))));

  if (item.features?.length) {
    const featureBody = addSection(body, 'features', 'Worktop features');
    for (const feature of item.features) {
      const label = el('div', 'list-label');
      label.appendChild(el('span', 'list-label-main', APPLIANCE_LABELS[feature.type] ?? feature.type));
      label.appendChild(el('span', 'list-label-sub', fmtLen(feature.offsetX)));
      featureBody.appendChild(
        listRow(label, { onDelete: () => run(actions.removeFeature(item.id, feature.id)) })
      );
    }
  }
}

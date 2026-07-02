import { setApplianceParam } from '../state/actions.js';
import { FRIDGE_DEFAULTS, FRIDGE_FINISHES } from '../build/appliances/fridge.js';
import { SWATCHES } from '../materials/swatches.js';
import { el, segmented, slider, toggle, rafThrottle } from './controls.js';

const TYPE_OPTIONS = [
  { value: 'topFreezer', label: 'Top freezer' },
  { value: 'bottomFreezer', label: 'Bottom freezer' },
  { value: 'sideBySide', label: 'Side by side' },
  { value: 'frenchDoor', label: 'French door' },
];
const FINISH_LABELS = {
  white: 'White',
  stainless: 'Stainless',
  brushedSteel: 'Brushed steel',
  blackSteel: 'Black steel',
  brushedBrass: 'Brushed brass',
  champagne: 'Champagne',
};
const swatchColor = (finish) =>
  SWATCHES.find((s) => s.id === FRIDGE_FINISHES[finish])?.params.color ?? '#888';

// Radio chips with color dots, like the reference finish picker.
function finishChips(value, onChange) {
  const wrap = el('div', 'chip-row');
  for (const finish of Object.keys(FINISH_LABELS)) {
    const chip = el('button', `chip${finish === value ? ' active' : ''}`);
    chip.type = 'button';
    const dot = el('span', 'chip-dot');
    dot.style.background = swatchColor(finish);
    chip.append(dot, el('span', 'chip-label', FINISH_LABELS[finish]));
    chip.addEventListener('click', () => finish !== value && onChange(finish));
    wrap.appendChild(chip);
  }
  return wrap;
}

// Fridge panel mirroring the reference: Type / Finish / Dimensions /
// Doors / Handles / Dispenser. `helpers` comes from panel.js (addSection,
// run, withLive) so both panels share behavior.
export function renderFridgePanel(body, item, helpers) {
  const { addSection, run, withLive } = helpers;
  const p = { ...FRIDGE_DEFAULTS, ...item.params };
  const set = (key, value) => run(setApplianceParam(item.id, key, value));

  addSection(body, 'fridge-type', 'Type').appendChild(
    segmented(TYPE_OPTIONS, p.type, (v) => set('type', v))
  );
  addSection(body, 'fridge-finish', 'Finish').appendChild(
    finishChips(p.finish, (v) => set('finish', v))
  );

  const dims = addSection(body, 'fridge-dims', 'Dimensions');
  const meters = (v) => `${v.toFixed(2)} m`;
  for (const [key, label, min, max] of [
    ['width', 'Width', 0.6, 1.2],
    ['height', 'Height', 1.4, 2.1],
    ['depth', 'Depth', 0.6, 0.85],
  ]) {
    const live = rafThrottle((v) => withLive(() => setApplianceParam(item.id, key, v)));
    dims.appendChild(
      slider(label, min, max, 0.01, p[key], meters, (v, isLive) => {
        if (isLive) live(v);
        else set(key, v);
      })
    );
  }

  addSection(body, 'fridge-doors', 'Doors').appendChild(
    toggle('Open doors', p.openDoors, (v) => set('openDoors', v))
  );
  addSection(body, 'fridge-handles', 'Handles').appendChild(
    segmented(
      [{ value: 'bar', label: 'Bar' }, { value: 'recessed', label: 'Recessed' }],
      p.handles,
      (v) => set('handles', v)
    )
  );
  addSection(body, 'fridge-dispenser', 'Dispenser').appendChild(
    toggle('Water dispenser', p.dispenser, (v) => set('dispenser', v))
  );
}

export function renderHoodPanel(body, item, helpers) {
  const { addSection, run } = helpers;
  const p = { width: 0.6, finish: 'stainless', ...item.params };
  addSection(body, 'hood-finish', 'Finish').appendChild(
    segmented(
      [{ value: 'stainless', label: 'Stainless' }, { value: 'blackSteel', label: 'Black steel' }],
      p.finish,
      (v) => run(setApplianceParam(item.id, 'finish', v))
    )
  );
}

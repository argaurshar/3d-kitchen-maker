import { setApplianceParam, setFurnitureParam } from '../state/actions.js';
import { FRIDGE_DEFAULTS, FRIDGE_FINISHES } from '../build/appliances/fridge.js';
import { stoolParams } from '../build/furniture/stool.js';
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

// Stool panel: Preset chips, Seat, Footprint, Footrest, Backrest.
export function renderStoolPanel(body, item, helpers) {
  const { addSection, run, withLive } = helpers;
  const p = stoolParams(item);
  const set = (key, value) => run(setFurnitureParam(item.id, key, value));
  const cm = (v) => `${Math.round(v * 100)} cm`;
  const liveSlider = (parent, key, label, min, max) => {
    const live = rafThrottle((v) => withLive(() => setFurnitureParam(item.id, key, v / 100)));
    parent.appendChild(
      slider(label, min, max, 1, Math.round(p[key] * 100), (v) => `${v} cm`, (v, isLive) => {
        if (isLive) live(v);
        else set(key, v / 100);
      })
    );
  };

  const presets = el('div', 'chip-row');
  for (const preset of ['counter', 'bar', 'square']) {
    const chip = el('button', `chip${(item.params?.preset ?? 'counter') === preset ? ' active' : ''}`);
    chip.type = 'button';
    chip.appendChild(el('span', 'chip-label', preset[0].toUpperCase() + preset.slice(1)));
    chip.addEventListener('click', () => set('preset', preset));
    presets.appendChild(chip);
  }
  addSection(body, 'stool-preset', 'Preset').appendChild(presets);

  const seat = addSection(body, 'stool-seat', 'Seat');
  seat.appendChild(
    segmented(
      [{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }],
      p.seatShape,
      (v) => set('seatShape', v)
    )
  );
  liveSlider(seat, 'seatRadius', 'Seat radius', 14, 22);
  liveSlider(seat, 'seatThickness', 'Thickness', 2, 6);
  liveSlider(seat, 'seatHeight', 'Seat height', 45, 80);

  liveSlider(addSection(body, 'stool-footprint', 'Footprint'), 'legSpread', 'Leg spread', 0, 12);

  const footrest = addSection(body, 'stool-footrest', 'Footrest');
  footrest.appendChild(toggle('Footrest ring', p.footrestRing, (v) => set('footrestRing', v)));
  if (p.footrestRing) liveSlider(footrest, 'ringHeight', 'Ring height', 10, 30);

  addSection(body, 'stool-backrest', 'Backrest').appendChild(
    toggle('Backrest', p.backrest, (v) => set('backrest', v))
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

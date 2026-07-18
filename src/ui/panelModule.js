import * as actions from '../state/actions.js';
import { effectiveCompartments } from '../build/compartments.js';
import { el, segmented, slider, stepper, toggle, listRow, button, iconButton, rafThrottle } from './controls.js';
import { fmtLen } from '../state/units.js';

// Module drill-in editor (split from panel.js): compartment stack, shutter
// systems (hinged / lift-up / bi-fold, profile glass, backlit), handles,
// width, duplicate/delete. Receives {addSection, run, withLive, render,
// exitModule} helpers from panel.js.
export const MODULE_LABELS = {
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
  { value: 'none', label: 'None' },
  { value: 'jProfile', label: 'J-Profile' },
];
const FRONT_OPTIONS = [
  { value: 'hinged', label: 'Hinged' },
  { value: 'liftUp', label: 'Lift-up' },
  { value: 'biFold', label: 'Bi-fold' },
];
const FRAME_OPTIONS = [
  { value: 'silver', label: 'Silver' },
  { value: 'black', label: 'Black' },
  { value: 'gold', label: 'Gold' },
];
const GLASS_OPTIONS = [
  { value: 'clear', label: 'Clear' },
  { value: 'frosted', label: 'Frosted' },
  { value: 'fluted', label: 'Fluted' },
];
const UNIT_LABELS = { base: 'Base unit', tall: 'Tall unit', wall: 'Wall unit', island: 'Island' };

function renderDoorStyle(block, item, module, comp, run) {
  const set = (key, v) => run(actions.setCompartmentParam(item.id, module.id, comp.id, key, v));
  const style = comp.style ?? {};

  block.appendChild(el('div', 'sub-label', 'Shutter'));
  block.appendChild(segmented(FRONT_OPTIONS, style.front ?? 'hinged', (v) => set('front', v)));
  if ((style.front ?? 'hinged') === 'hinged') {
    block.appendChild(
      segmented(
        [{ value: 'L', label: 'Hinge L' }, { value: 'R', label: 'Hinge R' }, { value: 'double', label: 'Double' }],
        style.hinge ?? 'L',
        (v) => set('hinge', v)
      )
    );
  }
  const styleRow = el('div', 'row style-row');
  styleRow.appendChild(toggle('Glass profile', Boolean(style.profile), (v) => set('profile', v)));
  if (style.profile) {
    styleRow.appendChild(segmented(FRAME_OPTIONS, style.profile.frame ?? 'silver', (v) => set('profileFrame', v)));
    styleRow.appendChild(segmented(GLASS_OPTIONS, style.profile.glass ?? 'clear', (v) => set('profileGlass', v)));
    styleRow.appendChild(toggle('Backlit (LED)', Boolean(style.lit), (v) => set('lit', v)));
  } else {
    styleRow.appendChild(toggle('Glass', Boolean(style.glass), (v) => set('glass', v)));
  }
  block.appendChild(styleRow);
}

export function renderModulePanel(body, item, module, helpers) {
  const { addSection, run, withLive, exitModule } = helpers;
  const crumb = el('div', 'breadcrumb');
  const back = iconButton('back', exitModule, 'Back');
  crumb.append(back, el('span', 'crumb-label', UNIT_LABELS[item.unitType ?? 'base'] ?? 'Unit'));
  crumb.appendChild(el('span', 'crumb-current', MODULE_LABELS[module.type] ?? module.type));
  body.appendChild(crumb);

  body.appendChild(segmented(MODULE_OPTIONS, module.type, (v) => run(actions.setModuleParam(item.id, module.id, 'type', v))));

  const isFiller = module.type === 'filler';
  const applyWidth = rafThrottle((v) => withLive(() => actions.setModuleParam(item.id, module.id, 'width', v / 100)));
  body.appendChild(
    slider('Width', isFiller ? 6 : 30, isFiller ? 30 : 120, 2, Math.round(module.width * 100), (v) => fmtLen(v / 100), (v, live) => {
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
    if (comp.type === 'door') renderDoorStyle(block, item, module, comp, run);
    if (comp.type === 'shelf' || (comp.type === 'door' && (comp.style?.glass || comp.style?.profile))) {
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
  actionsBody.appendChild(toggle('Open fronts', item.openFronts === true, (v) => run(actions.setUnitParam(item.id, 'openFronts', v))));
  actionsBody.appendChild(
    button('Duplicate', () => {
      const clone = structuredClone({
        type: module.type,
        width: module.width,
        handle: module.handle,
        compartments: effectiveCompartments(module).map(({ id, ...c }) => c),
      });
      run(actions.addModule(item.id, module.id, clone));
    })
  );
  actionsBody.appendChild(
    button('Delete', () => {
      exitModule();
      run(actions.removeModule(item.id, module.id));
    }, 'danger')
  );
}

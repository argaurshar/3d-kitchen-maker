// Smoke test: exercises every store action once against the galley fixture,
// including expected refusals. Runs in plain node (the store and actions
// have no DOM dependency). Usage: node tools/actions-smoke.mjs
import { readFile } from 'node:fs/promises';
import { store } from '../src/state/store.js';
import * as actions from '../src/state/actions.js';

const scene = JSON.parse(
  await readFile(new URL('../src/state/fixtures/galley.json', import.meta.url), 'utf8')
);
store.replace(scene);

let failures = 0;
function check(label, result, expectOk = true) {
  const pass = result.ok === expectOk;
  if (!pass) failures += 1;
  const suffix = result.ok ? '' : ` (${result.reason})`;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${label}${suffix}`);
}

const modules = () => store.get().items[0].modules;

// --- module actions ---
check('addModule (cabinet after b2)', actions.addModule('base-run', 'b2', 'cabinet'));
const added = modules()[2].id;
check('addModule refuses bad width', actions.addModule('base-run', null, { type: 'cabinet', width: 2 }), false);
check('addModule refuses bad template', actions.addModule('base-run', null, 'wardrobe'), false);
check('moveModule right', actions.moveModule('base-run', added, +1));
check('moveModule refuses past edge', actions.moveModule('base-run', 'b1', -1), false);
check('removeModule', actions.removeModule('base-run', added));
check('removeModule refuses unknown id', actions.removeModule('base-run', 'nope'), false);
check('setModuleParam width 1.0', actions.setModuleParam('base-run', 'b2', 'width', 1.0));
check('setModuleParam refuses width 0.2', actions.setModuleParam('base-run', 'b2', 'width', 0.2), false);
check('setModuleParam handle hole', actions.setModuleParam('base-run', 'b2', 'handle', 'hole'));
check('setModuleParam refuses bogus key', actions.setModuleParam('base-run', 'b2', 'sparkle', 1), false);
actions.setModuleParam('base-run', 'b2', 'width', 0.6);
actions.setModuleParam('base-run', 'b2', 'handle', 'bar');

// --- compartment actions ---
check('setCompartmentParam hinge double', actions.setCompartmentParam('base-run', 'b2', 'b2c1', 'hinge', 'double'));
check('setCompartmentParam refuses weight -1', actions.setCompartmentParam('base-run', 'b2', 'b2c1', 'weight', -1), false);
check('setCompartmentParam glass true', actions.setCompartmentParam('base-run', 'b2', 'b2c1', 'glass', true));

// Overflow is allowed but must flag module.invalid (red badge behavior).
check('addCompartment oven (overflow allowed)', actions.addCompartment('base-run', 'b4', 'oven'));
const flagged = modules().find((m) => m.id === 'b4').invalid === true;
console.log(`${flagged ? 'ok  ' : 'FAIL'} overflow sets module.invalid`);
if (!flagged) failures += 1;
const ovenId = modules().find((m) => m.id === 'b4').compartments.at(-1).id;
check('removeCompartment (clears overflow)', actions.removeCompartment('base-run', 'b4', ovenId));
const cleared = modules().find((m) => m.id === 'b4').invalid === false;
console.log(`${cleared ? 'ok  ' : 'FAIL'} fixing overflow clears module.invalid`);
if (!cleared) failures += 1;

check('moveCompartment', actions.moveCompartment('base-run', 'b4', 'b4c1', +1));
check('moveCompartment refuses past edge', actions.moveCompartment('base-run', 'b4', 'b4c1', +1), false);
actions.moveCompartment('base-run', 'b4', 'b4c1', -1);
check('removeCompartment refuses unknown id', actions.removeCompartment('base-run', 'b4', 'zzz'), false);

// drawerBase preset materializes on edit
check('addCompartment to preset drawerBase', actions.addCompartment('base-run', 'b1', 'drawer'));
const b1count = modules().find((m) => m.id === 'b1').compartments.length;
console.log(`${b1count === 5 ? 'ok  ' : 'FAIL'} preset materialized to 4 + 1 drawers (got ${b1count})`);
if (b1count !== 5) failures += 1;

// --- unit + item actions ---
check('setUnitParam materials.door', actions.setUnitParam('base-run', 'materials.door', 'paint_charcoal'));
check('setUnitParam refuses unknown material', actions.setUnitParam('base-run', 'materials.door', 'paint_neon'), false);
actions.setUnitParam('base-run', 'materials.door', 'paint_sage');
check('setUnitParam worktop toggle', actions.setUnitParam('base-run', 'worktop', true));
check('addItem', actions.addItem({ id: 'tmp-run', kind: 'run', unitType: 'base', position: [0, 0], rotationY: 0, materials: scene.items[0].materials, modules: [] }));
check('addItem refuses duplicate id', actions.addItem({ id: 'tmp-run', kind: 'run', position: [0, 0] }), false);
check('moveItem', actions.moveItem('tmp-run', [1, 1], Math.PI));
check('moveItem refuses bad position', actions.moveItem('tmp-run', [1], 0), false);
check('removeItem', actions.removeItem('tmp-run'));
check('removeItem refuses unknown id', actions.removeItem('tmp-run'), false);

// --- feature + appliance param actions ---
check('addFeature hob', actions.addFeature('base-run', { type: 'hob', offsetX: 2.1, params: { burners: 4 } }));
check('addFeature refuses tap without sink', actions.addFeature('base-run', { type: 'tap', offsetX: 2.1 }), false);
check('addFeature sink then tap snaps to it', actions.addFeature('base-run', { type: 'sink', offsetX: 0.9 }));
check('addFeature tap near sink', actions.addFeature('base-run', { type: 'tap', offsetX: 1.1 }));
const tap = store.get().items[0].features.at(-1);
console.log(`${tap.offsetX === 0.9 ? 'ok  ' : 'FAIL'} tap snapped to sink offset (${tap.offsetX})`);
if (tap.offsetX !== 0.9) failures += 1;
check('removeFeature', actions.removeFeature('base-run', tap.id));
check('addFeature refuses on wall run', actions.addFeature('wall-run', { type: 'hob', offsetX: 0.9 }), false);

check('addItem fridge', actions.addItem({ id: 'smoke-fridge', kind: 'appliance', applianceType: 'fridge', position: [0, 0], rotationY: 0, params: {} }));
check('setApplianceParam type', actions.setApplianceParam('smoke-fridge', 'type', 'frenchDoor'));
check('setApplianceParam refuses bad width', actions.setApplianceParam('smoke-fridge', 'width', 2), false);
check('setApplianceParam refuses bad finish', actions.setApplianceParam('smoke-fridge', 'finish', 'gold'), false);
actions.removeItem('smoke-fridge');

// Quote engine: frozen expected totals for the reference kitchen guard the
// pricing math against silent regressions. Update deliberately when rates
// or the fixture change.
{
  const { computeQuote } = await import('../src/state/quote.js');
  const { RATE_CARD } = await import('../src/state/pricing.js');
  const { readFile } = await import('fs/promises');
  const reference = JSON.parse(await readFile(new URL('../src/state/fixtures/reference-kitchen.json', import.meta.url), 'utf8'));
  const result = computeQuote(reference, RATE_CARD);
  const okQuote = result.lines.length === 12 && result.subtotal === 221843 && result.total === 261775;
  console.log(`${okQuote ? 'ok  ' : 'FAIL'} computeQuote frozen totals (lines=${result.lines.length} subtotal=${result.subtotal} total=${result.total})`);
  if (!okQuote) failures += 1;
  const premium = computeQuote({ ...reference, quote: { hardwareTier: 'premium' } }, RATE_CARD);
  const okTier = premium.total > result.total;
  console.log(`${okTier ? 'ok  ' : 'FAIL'} premium tier prices higher (${premium.total})`);
  if (!okTier) failures += 1;
}

console.log(failures === 0 ? '\nALL ACTIONS OK' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

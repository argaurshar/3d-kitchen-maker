import { store } from './store.js';
import {
  MODULE_TYPES,
  COMPARTMENT_TYPES,
  HANDLE_STYLES,
  HINGES,
  MODULE_TEMPLATES,
  COMPARTMENT_TEMPLATES,
  moduleWidthRange,
} from './schema.js';
import { solveHeights, effectiveCompartments } from '../build/compartments.js';
import { unitContext } from '../build/run.js';
import { SWATCHES } from '../materials/swatches.js';

// Store actions: the only sanctioned way for UI code to mutate the scene.
// Each returns { ok:true } or { ok:false, reason } and leaves the store
// untouched on failure. Compartment overflow is allowed but flagged
// (module.invalid -> red warning box), matching the reference behavior.

const MATERIAL_IDS = new Set(SWATCHES.map((s) => s.id));
const ok = () => ({ ok: true });
const fail = (reason) => ({ ok: false, reason });

function findItem(itemId) {
  const items = store.get().items;
  const index = items.findIndex((i) => i.id === itemId);
  return { items, index, item: items[index] };
}

function uniqueId(prefix) {
  const ids = new Set();
  for (const item of store.get().items) {
    ids.add(item.id);
    for (const m of item.modules ?? []) {
      ids.add(m.id);
      for (const c of m.compartments ?? []) ids.add(c.id);
    }
  }
  let n = 1;
  while (ids.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

// Recompute overflow flags and write the modules array in one store.set,
// so the 3D layer rebuilds the item exactly once.
function writeModules(index, item, modules) {
  const ctx = unitContext({ ...item, modules });
  const flagged = modules.map((m) => {
    const invalid = Boolean(solveHeights(effectiveCompartments(m), ctx.carcassHeight).error);
    return invalid === Boolean(m.invalid) ? m : { ...m, invalid };
  });
  store.set(`items.${index}.modules`, flagged);
  return ok();
}

function materializeCompartments(module) {
  return effectiveCompartments(module).map((c, i) => ({
    id: c.id ?? `${module.id}-c${i + 1}`,
    ...c,
  }));
}

export function addModule(itemId, afterModuleId = null, template = 'cabinet') {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  const base = typeof template === 'string' ? MODULE_TEMPLATES[template] : MODULE_TEMPLATES[template?.type];
  if (!base) return fail(`unknown module template "${typeof template === 'string' ? template : template?.type}"`);
  const merged = { ...structuredClone(base), ...(typeof template === 'object' ? template : {}) };
  if (!MODULE_TYPES.includes(merged.type)) return fail(`unknown module type "${merged.type}"`);
  const [min, max] = moduleWidthRange(merged.type);
  if (typeof merged.width !== 'number' || merged.width < min - 1e-9 || merged.width > max + 1e-9) {
    return fail(`width ${merged.width} outside ${min}..${max}`);
  }
  merged.id = merged.id ?? uniqueId('m');
  merged.compartments = (merged.compartments ?? []).map((c, i) => ({ id: `${merged.id}-c${i + 1}`, ...c }));

  const modules = [...(item.modules ?? [])];
  // afterModuleId: null appends, 'start' prepends, otherwise inserts after.
  const at =
    afterModuleId === 'start'
      ? -1
      : afterModuleId
        ? modules.findIndex((m) => m.id === afterModuleId)
        : modules.length - 1;
  if (afterModuleId && afterModuleId !== 'start' && at < 0) return fail(`no module "${afterModuleId}"`);
  modules.splice(at + 1, 0, merged);
  return writeModules(index, item, modules);
}

export function removeModule(itemId, moduleId) {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  const modules = (item.modules ?? []).filter((m) => m.id !== moduleId);
  if (modules.length === (item.modules ?? []).length) return fail(`no module "${moduleId}"`);
  return writeModules(index, item, modules);
}

export function moveModule(itemId, moduleId, dir) {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  const modules = [...(item.modules ?? [])];
  const at = modules.findIndex((m) => m.id === moduleId);
  if (at < 0) return fail(`no module "${moduleId}"`);
  const to = at + Math.sign(dir);
  if (to < 0 || to >= modules.length) return fail('already at the edge');
  [modules[at], modules[to]] = [modules[to], modules[at]];
  return writeModules(index, item, modules);
}

export function setModuleParam(itemId, moduleId, key, value) {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  const modules = [...(item.modules ?? [])];
  const at = modules.findIndex((m) => m.id === moduleId);
  if (at < 0) return fail(`no module "${moduleId}"`);
  const module = { ...modules[at] };

  if (key === 'width') {
    const [min, max] = moduleWidthRange(module.type);
    if (typeof value !== 'number' || value < min - 1e-9 || value > max + 1e-9) {
      return fail(`width ${value} outside ${min}..${max}`);
    }
  } else if (key === 'handle') {
    if (!HANDLE_STYLES.includes(value)) return fail(`unknown handle "${value}"`);
  } else if (key === 'type') {
    if (!MODULE_TYPES.includes(value)) return fail(`unknown module type "${value}"`);
  } else if (key === 'blindSide') {
    if (value !== 'L' && value !== 'R') return fail('blindSide must be L or R');
  } else {
    return fail(`unknown module param "${key}"`);
  }
  module[key] = value;
  modules[at] = module;
  return writeModules(index, item, modules);
}

function withCompartments(itemId, moduleId, mutate) {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  const modules = [...(item.modules ?? [])];
  const at = modules.findIndex((m) => m.id === moduleId);
  if (at < 0) return fail(`no module "${moduleId}"`);
  const module = { ...modules[at], compartments: materializeCompartments(modules[at]) };
  const result = mutate(module);
  if (result) return result; // a failure from the mutator
  modules[at] = module;
  return writeModules(index, item, modules);
}

export function addCompartment(itemId, moduleId, type) {
  const template = COMPARTMENT_TEMPLATES[type];
  if (!template) return fail(`unknown compartment type "${type}"`);
  return withCompartments(itemId, moduleId, (module) => {
    module.compartments = [
      ...module.compartments,
      { id: uniqueId('c'), ...structuredClone(template) },
    ];
  });
}

export function removeCompartment(itemId, moduleId, compartmentId) {
  return withCompartments(itemId, moduleId, (module) => {
    const next = module.compartments.filter((c) => c.id !== compartmentId);
    if (next.length === module.compartments.length) return fail(`no compartment "${compartmentId}"`);
    module.compartments = next;
  });
}

export function moveCompartment(itemId, moduleId, compartmentId, dir) {
  return withCompartments(itemId, moduleId, (module) => {
    const list = [...module.compartments];
    const at = list.findIndex((c) => c.id === compartmentId);
    if (at < 0) return fail(`no compartment "${compartmentId}"`);
    const to = at + Math.sign(dir);
    if (to < 0 || to >= list.length) return fail('already at the edge');
    [list[at], list[to]] = [list[to], list[at]];
    module.compartments = list;
  });
}

export function setCompartmentParam(itemId, moduleId, compartmentId, key, value) {
  return withCompartments(itemId, moduleId, (module) => {
    const at = module.compartments.findIndex((c) => c.id === compartmentId);
    if (at < 0) return fail(`no compartment "${compartmentId}"`);
    const comp = structuredClone(module.compartments[at]);

    if (key === 'type') {
      if (!COMPARTMENT_TYPES.includes(value)) return fail(`unknown compartment type "${value}"`);
      comp.type = value;
    } else if (key === 'weight') {
      if (typeof value !== 'number' || value <= 0) return fail('weight must be > 0');
      comp.weight = value;
    } else if (key === 'shelvesInside') {
      if (!Number.isInteger(value) || value < 0 || value > 6) return fail('shelvesInside must be 0..6');
      comp.shelvesInside = value;
    } else if (key === 'hinge') {
      if (!HINGES.includes(value)) return fail(`unknown hinge "${value}"`);
      comp.style = { ...comp.style, hinge: value };
    } else if (key === 'glass') {
      comp.style = { ...comp.style, glass: Boolean(value) };
    } else {
      return fail(`unknown compartment param "${key}"`);
    }
    module.compartments = module.compartments.with(at, comp);
  });
}

export function setUnitParam(itemId, key, value) {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  if (key === 'worktop' || key === 'plinth') {
    store.set(`items.${index}.${key}`, Boolean(value));
    return ok();
  }
  if (key === 'unitType') {
    if (!['base', 'wall', 'tall', 'island'].includes(value)) return fail(`unknown unitType "${value}"`);
    store.set(`items.${index}.unitType`, value);
    return ok();
  }
  if (key.startsWith('materials.')) {
    const slot = key.split('.')[1];
    if (!['door', 'carcass', 'worktop', 'handle', 'plinth'].includes(slot)) return fail(`unknown material slot "${slot}"`);
    if (!MATERIAL_IDS.has(value)) return fail(`unknown material "${value}"`);
    store.set(`items.${index}.materials.${slot}`, value);
    return ok();
  }
  return fail(`unknown unit param "${key}"`);
}

// Room-level paint targets (walls, floor).
export function setRoomParam(key, value) {
  if (!['wallColor', 'floorMaterial'].includes(key)) return fail(`unknown room param "${key}"`);
  if (!MATERIAL_IDS.has(value)) return fail(`unknown material "${value}"`);
  store.set(`room.${key}`, value);
  return ok();
}

export function addItem(item) {
  if (!item || typeof item !== 'object') return fail('item must be an object');
  if (!['run', 'appliance', 'furniture'].includes(item.kind)) return fail(`unknown kind "${item.kind}"`);
  if (!Array.isArray(item.position) || item.position.length !== 2) return fail('position must be [x, z]');
  const items = store.get().items;
  const id = item.id ?? uniqueId('item');
  if (items.some((i) => i.id === id)) return fail(`duplicate id "${id}"`);
  store.set('items', [...items, { ...item, id }]);
  return { ok: true, id };
}

const FEATURE_TYPES = ['hob', 'sink', 'tap'];
const FEATURE_MARGIN = 0.3;

// Worktop features (hob/sink/tap) live on a run and move with it.
// Taps require a sink on the same run and snap to its offset.
export function addFeature(itemId, feature) {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  if (item.kind !== 'run' || item.worktop === false) return fail('features need a run with a worktop');
  if (!FEATURE_TYPES.includes(feature?.type)) return fail(`unknown feature type "${feature?.type}"`);
  const runWidth = (item.modules ?? []).reduce((s, m) => s + m.width, 0);
  let offsetX = Number(feature.offsetX);
  if (!Number.isFinite(offsetX)) return fail('offsetX must be a number');
  offsetX = Math.min(Math.max(offsetX, FEATURE_MARGIN), runWidth - FEATURE_MARGIN);
  if (runWidth < 2 * FEATURE_MARGIN) return fail('run too narrow for a feature');
  if (feature.type === 'tap') {
    const sink = (item.features ?? []).find((f) => f.type === 'sink' && Math.abs(f.offsetX - offsetX) < 0.4);
    if (!sink) return fail('tap needs a sink nearby');
    offsetX = sink.offsetX;
  }
  const features = [...(item.features ?? []), { id: uniqueId('f'), ...feature, offsetX }];
  store.set(`items.${index}.features`, features);
  return ok();
}

export function removeFeature(itemId, featureId) {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  const features = (item.features ?? []).filter((f) => f.id !== featureId);
  if (features.length === (item.features ?? []).length) return fail(`no feature "${featureId}"`);
  store.set(`items.${index}.features`, features);
  return ok();
}

// Validated appliance param writes (fridge/hood/hob-feature params live in
// item.params). Spec: [validator, message].
const APPLIANCE_PARAMS = {
  fridge: {
    type: (v) => ['topFreezer', 'bottomFreezer', 'sideBySide', 'frenchDoor'].includes(v),
    finish: (v) => ['white', 'stainless', 'brushedSteel', 'blackSteel', 'brushedBrass', 'champagne'].includes(v),
    width: (v) => typeof v === 'number' && v >= 0.6 && v <= 1.2,
    height: (v) => typeof v === 'number' && v >= 1.4 && v <= 2.1,
    depth: (v) => typeof v === 'number' && v >= 0.6 && v <= 0.85,
    openDoors: (v) => typeof v === 'boolean',
    handles: (v) => ['bar', 'recessed'].includes(v),
    dispenser: (v) => typeof v === 'boolean',
  },
  hood: {
    width: (v) => typeof v === 'number' && v >= 0.5 && v <= 1.2,
    finish: (v) => ['stainless', 'blackSteel'].includes(v),
  },
};

const STOOL_PARAMS = {
  preset: (v) => ['counter', 'bar', 'square'].includes(v),
  seatShape: (v) => ['round', 'square'].includes(v),
  seatRadius: (v) => typeof v === 'number' && v >= 0.14 && v <= 0.22,
  seatThickness: (v) => typeof v === 'number' && v >= 0.02 && v <= 0.06,
  seatHeight: (v) => typeof v === 'number' && v >= 0.45 && v <= 0.8,
  legSpread: (v) => typeof v === 'number' && v >= 0 && v <= 0.12,
  footrestRing: (v) => typeof v === 'boolean',
  ringHeight: (v) => typeof v === 'number' && v >= 0.1 && v <= 0.3,
  backrest: (v) => typeof v === 'boolean',
  seatMaterial: (v) => MATERIAL_IDS.has(v),
};

// Choosing a preset resets the bundle (overrides are dropped),
// matching the reference behavior.
export function setFurnitureParam(itemId, key, value) {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  if (item.kind !== 'furniture') return fail(`"${itemId}" is not furniture`);
  const validate = STOOL_PARAMS[key];
  if (!validate) return fail(`unknown param "${key}"`);
  if (!validate(value)) return fail(`invalid ${key}: ${value}`);
  const params = key === 'preset' ? { preset: value } : { ...item.params, [key]: value };
  store.set(`items.${index}.params`, params);
  return ok();
}

export function setApplianceParam(itemId, key, value) {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  const spec = APPLIANCE_PARAMS[item.applianceType];
  if (!spec) return fail(`no editable params for "${item.applianceType}"`);
  const validate = spec[key];
  if (!validate) return fail(`unknown param "${key}"`);
  if (!validate(value)) return fail(`invalid ${key}: ${value}`);
  store.set(`items.${index}.params`, { ...item.params, [key]: value });
  return ok();
}

export function removeItem(itemId) {
  const items = store.get().items;
  const next = items.filter((i) => i.id !== itemId);
  if (next.length === items.length) return fail(`no item "${itemId}"`);
  store.set('items', next);
  return ok();
}

export function moveItem(itemId, position, rotationY) {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  if (position != null) {
    if (!Array.isArray(position) || position.length !== 2 || position.some((v) => typeof v !== 'number')) {
      return fail('position must be [x, z]');
    }
    store.set(`items.${index}.position`, position);
  }
  if (rotationY != null) {
    if (typeof rotationY !== 'number') return fail('rotationY must be a number');
    store.set(`items.${index}.rotationY`, rotationY);
  }
  return ok();
}

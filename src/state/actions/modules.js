import {
  MODULE_TYPES,
  COMPARTMENT_TYPES,
  HANDLE_STYLES,
  HINGES,
  MODULE_TEMPLATES,
  COMPARTMENT_TEMPLATES,
  moduleWidthRange,
} from '../schema.js';
import { ok, fail, findItem, uniqueId, writeModules, withCompartments } from './core.js';

// Module and compartment actions.

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

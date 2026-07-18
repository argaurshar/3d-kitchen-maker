import { store } from '../store.js';
import { solveHeights, effectiveCompartments } from '../../build/compartments.js';
import { unitContext } from '../../build/run.js';
import { SWATCHES } from '../../materials/swatches.js';

// Shared internals for the action modules. Actions are the only sanctioned
// way for UI code to mutate the scene: each returns { ok:true } or
// { ok:false, reason } and leaves the store untouched on failure.

export const MATERIAL_IDS = new Set(SWATCHES.map((s) => s.id));
export const ok = () => ({ ok: true });
export const fail = (reason) => ({ ok: false, reason });

export function findItem(itemId) {
  const items = store.get().items;
  const index = items.findIndex((i) => i.id === itemId);
  return { items, index, item: items[index] };
}

export function uniqueId(prefix) {
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
// so the 3D layer rebuilds the item exactly once. Overflow is allowed but
// flagged (module.invalid -> red warning box).
export function writeModules(index, item, modules) {
  const ctx = unitContext({ ...item, modules });
  const flagged = modules.map((m) => {
    const invalid = Boolean(solveHeights(effectiveCompartments(m), ctx.carcassHeight).error);
    return invalid === Boolean(m.invalid) ? m : { ...m, invalid };
  });
  store.set(`items.${index}.modules`, flagged);
  return ok();
}

export function materializeCompartments(module) {
  return effectiveCompartments(module).map((c, i) => ({
    id: c.id ?? `${module.id}-c${i + 1}`,
    ...c,
  }));
}

export function withCompartments(itemId, moduleId, mutate) {
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

import { store } from '../store.js';
import { ok, fail, findItem, uniqueId, MATERIAL_IDS } from './core.js';

// Item-level actions: add/remove/move/rotate/duplicate whole items, unit
// params, and worktop features.

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

export function rotateItem(itemId, deltaRad) {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  if (typeof deltaRad !== 'number' || !Number.isFinite(deltaRad)) return fail('deltaRad must be a number');
  store.set(`items.${index}.rotationY`, (item.rotationY ?? 0) + deltaRad);
  return ok();
}

// Deep-copies an item with fresh ids throughout, offset so the copy is
// visible next to the original. Returns { ok, id } like addItem.
export function duplicateItem(itemId) {
  const { item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  const clone = structuredClone(item);
  clone.id = uniqueId('item');
  for (const m of clone.modules ?? []) {
    m.id = uniqueId('m');
    (m.compartments ?? []).forEach((c, i) => (c.id = `${m.id}-c${i + 1}`));
  }
  for (const f of clone.features ?? []) f.id = uniqueId('f');
  clone.position = [clone.position[0] + 0.25, clone.position[1] + 0.25];
  store.set('items', [...store.get().items, clone]);
  return { ok: true, id: clone.id };
}

export function setUnitParam(itemId, key, value) {
  const { index, item } = findItem(itemId);
  if (!item) return fail(`no item "${itemId}"`);
  if (key === 'worktop' || key === 'plinth' || key === 'openFronts' || key === 'backsplash') {
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

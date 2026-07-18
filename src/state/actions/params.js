import { store } from '../store.js';
import { ok, fail, findItem, MATERIAL_IDS } from './core.js';

// Validated appliance/furniture param writes (params live in item.params).
// Spec objects: { key: validator }.

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

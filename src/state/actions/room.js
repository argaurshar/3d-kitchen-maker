import { store } from '../store.js';
import { ok, fail, MATERIAL_IDS } from './core.js';

// Room-level params: paint targets (walls, floor) and room dimensions.
// Dimensions are meters; the projection layer rebuilds the room shell on
// any room.* write, so a size change re-fits walls, floor and grid.
const SIZE_RANGES = {
  width: [2.4, 12],
  depth: [2.4, 12],
  wallHeight: [2.2, 4],
};

export function setRoomParam(key, value) {
  const range = SIZE_RANGES[key];
  if (range) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fail(`${key} must be a number`);
    if (value < range[0] - 1e-9 || value > range[1] + 1e-9) {
      return fail(`${key} ${value} outside ${range[0]}..${range[1]} m`);
    }
    store.set(`room.${key}`, value);
    return ok();
  }
  if (!['wallColor', 'floorMaterial'].includes(key)) return fail(`unknown room param "${key}"`);
  if (!MATERIAL_IDS.has(value)) return fail(`unknown material "${value}"`);
  store.set(`room.${key}`, value);
  return ok();
}

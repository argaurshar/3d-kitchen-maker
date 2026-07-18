import { wallOf, labelOf } from '../state/elements.js';

// Deterministic reference tags for the drawing set: B1/B2 base runs, W wall,
// T tall, I island, F fridge, H hood, S stool — numbered per wall in
// left-to-right elevation order so the plan, elevations and legend agree.
const PREFIX = {
  base: 'B',
  wall: 'W',
  tall: 'T',
  island: 'I',
  fridge: 'F',
  hood: 'H',
  stool: 'S',
};

function prefixOf(item) {
  if (item.kind === 'run') return PREFIX[item.unitType ?? 'base'] ?? 'U';
  if (item.kind === 'appliance') return PREFIX[item.applianceType] ?? 'A';
  return PREFIX.stool;
}

// Wall-local coordinate increasing to screen-right in that wall's elevation
// (same mapping as draw2d/elevation.js).
function uOf(room, wall, [x, z]) {
  const { width: W, depth: D } = room;
  if (wall === 'north') return x + W / 2;
  if (wall === 'south') return W / 2 - x;
  if (wall === 'west') return D / 2 - z;
  if (wall === 'east') return z + D / 2;
  return x + W / 2; // center items order by x
}

export function assignTags(scene) {
  const order = new Map(); // prefix -> counter
  const tags = new Map();
  const sorted = [...(scene.items ?? [])].sort((a, b) => {
    const ua = uOf(scene.room, wallOf(a), a.position);
    const ub = uOf(scene.room, wallOf(b), b.position);
    return wallOf(a).localeCompare(wallOf(b)) || ua - ub;
  });
  for (const item of sorted) {
    const prefix = prefixOf(item);
    const n = (order.get(prefix) ?? 0) + 1;
    order.set(prefix, n);
    tags.set(item.id, `${prefix}${n}`);
  }
  return tags;
}

export function legendRows(scene, tags, fmtSize) {
  return (scene.items ?? [])
    .map((item) => {
      const tag = tags.get(item.id);
      if (!tag) return null;
      let size = '';
      if (item.kind === 'run') {
        const w = (item.modules ?? []).reduce((s, m) => s + m.width, 0);
        size = fmtSize(w);
      } else if (item.kind === 'appliance' && item.params?.width) {
        size = fmtSize(item.params.width);
      }
      return { tag, label: labelOf(item), size };
    })
    .filter(Boolean)
    .sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }));
}

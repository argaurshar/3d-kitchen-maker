// Pure scene analysis for the elevations planner: which wall each item sits
// against, and a per-wall summary. No THREE, no store reads — takes plain
// scene JSON so it is trivially testable.

export const WALLS = ['north', 'east', 'south', 'west'];
export const WALL_LABELS = { north: 'North', east: 'East', south: 'South', west: 'West' };

const UNIT_LABELS = { base: 'Base run', tall: 'Tall unit', wall: 'Wall units', island: 'Island' };
const APPLIANCE_LABELS = { fridge: 'Fridge', hood: 'Extractor hood', sink: 'Sink', hob: 'Hob', tap: 'Tap' };

export function labelOf(item) {
  if (item.kind === 'appliance') return APPLIANCE_LABELS[item.applianceType] ?? 'Appliance';
  if (item.kind === 'furniture') return 'Stool';
  return UNIT_LABELS[item.unitType ?? 'base'] ?? 'Unit';
}

// World direction (x, z) the item's front faces. Local +z is the front
// (doors/appliance face); rotationY spins it. Matches build/run.js rot2.
function frontDir(item) {
  const a = item.rotationY ?? 0;
  return [Math.sin(a), Math.cos(a)];
}

// The wall an item is set against: the one whose inward normal best matches
// the item's front direction (its back is on that wall). Islands and
// free-standing furniture belong to no wall ('center').
export function wallOf(item) {
  if (item.kind === 'furniture') return 'center';
  if (item.kind === 'run' && (item.unitType ?? 'base') === 'island') return 'center';
  const [fx, fz] = frontDir(item);
  const dots = { north: fz, south: -fz, west: fx, east: -fx };
  return WALLS.reduce((best, k) => (dots[k] > dots[best] ? k : best), 'north');
}

// { north: [{id,label}], east: [...], ..., center: [...] }
export function elementsByWall(scene) {
  const groups = { north: [], east: [], south: [], west: [], center: [] };
  for (const item of scene.items ?? []) {
    groups[wallOf(item)].push({ id: item.id, label: labelOf(item) });
  }
  return groups;
}

// Short human summary of what stands against a wall, e.g. "2 base runs, fridge".
export function summarizeWall(scene, wall) {
  const items = elementsByWall(scene)[wall] ?? [];
  if (!items.length) return 'nothing yet';
  const counts = new Map();
  for (const { label } of items) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].map(([label, n]) => (n > 1 ? `${n}× ${label}` : label)).join(', ');
}

// Kitchen-completeness rules: what a drafted configuration is still missing.
// Each suggestion carries the placement kind that fixes it (same shape the
// furnish row hands to picker.beginPlacement). Ordered by importance.
export function suggestMissing(scene) {
  const items = scene.items ?? [];
  const runs = items.filter((i) => i.kind === 'run');
  const features = runs.flatMap((r) => r.features ?? []);
  const has = {
    sink: features.some((f) => f.type === 'sink'),
    hob: features.some((f) => f.type === 'hob'),
    tap: features.some((f) => f.type === 'tap'),
    fridge: items.some((i) => i.kind === 'appliance' && i.applianceType === 'fridge'),
    hood: items.some((i) => i.kind === 'appliance' && i.applianceType === 'hood'),
    worktopRun: runs.some((r) => ['base', 'island'].includes(r.unitType ?? 'base') && r.worktop !== false),
    storage: runs.some((r) => r.unitType === 'wall' || r.unitType === 'tall'),
    seating: items.some((i) => i.kind === 'furniture'),
    island: runs.some((r) => r.unitType === 'island'),
  };
  const out = [];
  const need = (id, label, detail, add) => out.push({ id, label, detail, add });
  if (!has.worktopRun)
    need('base', 'No worktop detected', 'Add a base unit to carry sink and hob', { type: 'run', unitType: 'base' });
  if (has.worktopRun && !has.sink)
    need('sink', 'No sink detected', 'Drop one onto a worktop', { type: 'appliance', applianceType: 'sink' });
  if (has.sink && !has.tap)
    need('tap', 'Sink has no tap', 'Place it next to the sink', { type: 'appliance', applianceType: 'tap' });
  if (has.worktopRun && !has.hob)
    need('hob', 'No hob detected', 'Drop one onto a worktop', { type: 'appliance', applianceType: 'hob' });
  if (has.hob && !has.hood)
    need('hood', 'Hob has no extractor hood', 'Mount one on the wall above', { type: 'appliance', applianceType: 'hood' });
  if (!has.fridge)
    need('fridge', 'No fridge detected', 'Place one against a wall', { type: 'appliance', applianceType: 'fridge' });
  if (!has.storage)
    need('storage', 'No wall or tall storage', 'Add wall units above the run', { type: 'run', unitType: 'wall' });
  if (has.island && !has.seating)
    need('stool', 'Island has no seating', 'Pull up a stool or two', { type: 'furniture', furnitureType: 'stool' });
  return out;
}

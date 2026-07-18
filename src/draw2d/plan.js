import { DIMS } from '../state/schema.js';
import { doorFaceZ } from '../build/cabinet.js';
import { HOB_SIZE } from '../build/appliances/hob.js';
import { SINK_SIZE } from '../build/appliances/sink.js';
import { FRIDGE_DEFAULTS } from '../build/appliances/fridge.js';
import { HOOD_DIMS, HOOD_DEFAULTS } from '../build/appliances/hood.js';
import { L, R, C, T, dim, fmtDim, tagBubble } from './svg.js';

// True top-down CAD floor plan drawn from the scene JSON. Architectural
// conventions: walls as a filled cut, base units solid with the worktop
// outline over them, wall-mounted items (wall units, hood) dashed because
// they sit above the plan's cut plane, tall units cross-hatched with an X,
// appliance symbols for sink/hob/fridge, room dimensions outside the walls,
// a scale bar and a north arrow.
const WALL_T = 0.1;

export function planGroup(scene, cw, ch, opts = {}) {
  const { unit = 'mm', tags = null } = opts;
  const fmt = (v) => fmtDim(v, unit);
  const { width: W, depth: D } = scene.room;
  const M = 52;
  const s = Math.min((cw - 2 * M) / (W + 2 * WALL_T), (ch - 2 * M) / (D + 2 * WALL_T));
  const X = (x) => cw / 2 + x * s;
  const Y = (z) => ch / 2 + z * s;
  const out = [R(0, 0, cw, ch, 'paper')];

  out.push(R(X(-W / 2 - WALL_T), Y(-D / 2 - WALL_T), (W + 2 * WALL_T) * s, (D + 2 * WALL_T) * s, 'wallcut'));
  out.push(R(X(-W / 2), Y(-D / 2), W * s, D * s, 'paper'));
  out.push(R(X(-W / 2), Y(-D / 2), W * s, D * s, 'ln'));

  for (const item of scene.items ?? []) {
    const g = itemPlan(item, s);
    if (!g) continue;
    const deg = (-(item.rotationY ?? 0) * 180) / Math.PI;
    out.push(
      `<g transform="translate(${X(item.position[0]).toFixed(1)},${Y(item.position[1]).toFixed(1)}) rotate(${deg.toFixed(1)})">${g}</g>`
    );
    if (tags?.get(item.id)) out.push(tagBubble(X(item.position[0]), Y(item.position[1]), tags.get(item.id)));
  }

  // Room dimensions outside the walls, scale bar, north arrow.
  out.push(dim(X(-W / 2), Y(D / 2 + WALL_T) + 16, X(W / 2), Y(D / 2 + WALL_T) + 16, fmt(W)));
  out.push(dim(X(-W / 2 - WALL_T) - 16, Y(-D / 2), X(-W / 2 - WALL_T) - 16, Y(D / 2), fmt(D)));
  out.push(dim(M, ch - 14, M + s, ch - 14, '1 m'));
  const nx = cw - 26;
  out.push(C(nx, 26, 11, 'ln'), L(nx, 33, nx, 19, 'ln'), L(nx, 19, nx - 3.5, 25, 'ln'), L(nx, 19, nx + 3.5, 25, 'ln'));
  out.push(T(nx, 49, 'N', 'lbl', 'middle'));
  return out.join('');
}

// Item drawn in run-local coordinates (px = meters * s), origin at the item's
// anchor, +x right, +z down; the caller applies translate/rotate.
function itemPlan(item, s) {
  if (item.kind === 'run') return runPlan(item, s);
  if (item.kind === 'appliance' && item.applianceType === 'fridge') {
    const w = (item.params?.width ?? FRIDGE_DEFAULTS.width) * s;
    const d = (item.params?.depth ?? FRIDGE_DEFAULTS.depth) * s;
    return [
      R(0, 0, w, d, 'appl'),
      L(0, d, w, d, 'ln'),
      L(w / 2, d - 4, w / 2, d, 'ln'), // door split
      T(w / 2, d / 2 + 3, 'REF', 'dimtxt', 'middle'),
    ].join('');
  }
  if (item.kind === 'appliance' && item.applianceType === 'hood') {
    const w = (item.params?.width ?? HOOD_DEFAULTS.width) * s;
    return R(0, 0, w, HOOD_DIMS.depth * s, 'dash');
  }
  if (item.kind === 'furniture') {
    const r = (item.params?.seatRadius ?? 0.19) * s;
    return item.params?.seatShape === 'square'
      ? R(-r, -r, 2 * r, 2 * r, 'ln', 2)
      : C(0, 0, r, 'ln');
  }
  return null;
}

function runPlan(item, s) {
  const unit = item.unitType ?? 'base';
  const widths = (item.modules ?? []).map((m) => m.width);
  const rw = widths.reduce((a, b) => a + b, 0);
  if (rw <= 0) return '';
  const isWall = unit === 'wall';
  const front = (isWall ? DIMS.wallUnitDepth : doorFaceZ()) * s;
  const out = [];

  // Worktop outline first (slab with overhang; islands overhang the back).
  const hasTop = item.worktop !== false && (unit === 'base' || unit === 'island');
  const back = unit === 'island' ? 0.3 * s : 0;
  const wtFront = (doorFaceZ() + DIMS.worktopOverhang) * s;
  if (hasTop) out.push(R(0, -back, rw * s, wtFront + back, 'worktop'));

  // Modules: boxes with shared division lines; tall units get an X.
  let cum = 0;
  for (const w of widths) {
    const x = cum * s;
    out.push(R(x, 0, w * s, front, isWall ? 'dash' : hasTop ? 'ln' : 'box'));
    if (unit === 'tall') out.push(L(x, 0, x + w * s, front, 'thin'), L(x, front, x + w * s, 0, 'thin'));
    cum += w;
  }
  // Door-face line emphasised on floor-standing units; LED marker on wall
  // runs (dashed light line just outside the front edge).
  if (!isWall) out.push(L(0, front, rw * s, front, 'ln'));
  if (isWall && item.underLight) {
    out.push(L(2, front + 3, rw * s - 2, front + 3, 'swing'));
    out.push(T(rw * s + 4, front + 5, 'LED', 'dimtxt'));
  }

  // Worktop feature symbols at their real offsets.
  for (const f of item.features ?? []) {
    const cx = f.offsetX * s;
    if (f.type === 'sink') {
      const w = SINK_SIZE.w * s;
      const d = SINK_SIZE.d * s;
      const cz = wtFront / 2 + 0.02 * s;
      out.push(R(cx - w / 2, cz - d / 2, w, d, 'ln', 3));
      out.push(R(cx - w / 2 + 3, cz - d / 2 + 3, w - 6, d - 6, 'thin', 2));
      out.push(C(cx, cz - d / 2 - 2, 2, 'ln')); // tap dot behind the bowl
    } else if (f.type === 'hob') {
      const cz = wtFront / 2 + 0.02 * s;
      out.push(R(cx - (HOB_SIZE.w / 2) * s, cz - (HOB_SIZE.d / 2) * s, HOB_SIZE.w * s, HOB_SIZE.d * s, 'ln', 2));
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        out.push(C(cx + ox * 0.12 * s, cz + oz * 0.1 * s, 0.055 * s, 'thin'));
      }
    } else if (f.type === 'tap') {
      out.push(C(cx, 0.11 * s, 0.035 * s, 'ln'));
    }
  }
  return out.join('');
}

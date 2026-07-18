import { DIMS } from '../state/schema.js';
import { unitContext } from '../build/run.js';
import { effectiveCompartments, solveHeights } from '../build/compartments.js';
import { wallOf } from '../state/elements.js';
import { FRIDGE_DEFAULTS } from '../build/appliances/fridge.js';
import { HOOD_DEFAULTS, HOOD_DIMS } from '../build/appliances/hood.js';
import { drawFront } from './fronts2d.js';
import { L, R, T, dim, fmtDim, tagBubble } from './svg.js';

// True front-orthographic CAD elevation of one wall, drawn from the scene
// JSON: wall face and floor line, every run's plinth / module fronts /
// worktop band / backsplash hatch, appliances (fridge by type, hood with
// duct), a per-module cm chain plus overall length per run, the wall span,
// and a worktop-height marker. Viewed from inside the room, so the
// horizontal axis matches the 3D elevation views.
const M = 56;

export function elevationGroup(scene, wall, cw, ch, opts = {}) {
  const { unit = 'mm', tags = null } = opts;
  const fmt = (v) => fmtDim(v, unit);
  const { width: W, depth: D, wallHeight: H } = scene.room;
  const span = wall === 'north' || wall === 'south' ? W : D;
  // The dimension rows (module chain + overall per run + wall span) live in
  // a reserved band under the floor line, so scale against that band.
  const DIM_BAND = 104;
  const floorY = ch - DIM_BAND;
  const s = Math.min((cw - 2 * M) / span, (floorY - 24) / H);
  const x0 = (cw - span * s) / 2;
  const U = (u) => x0 + u * s;
  const V = (y) => floorY - y * s;
  // Wall-local horizontal coordinate, increasing to screen-right as seen
  // from inside the room (matches the 3D elevation camera orientation).
  const uOf = (x, z) =>
    wall === 'north' ? x + W / 2 : wall === 'south' ? W / 2 - x : wall === 'west' ? D / 2 - z : z + D / 2;
  const uAt = (item, dist) => {
    const a = item.rotationY ?? 0;
    return uOf(item.position[0] + dist * Math.cos(a), item.position[1] - dist * Math.sin(a));
  };

  const out = [R(0, 0, cw, ch, 'paper')];
  out.push(R(U(0), V(H), span * s, H * s, 'ln'));
  out.push(L(U(0) - 10, floorY, U(span) + 10, floorY, 'ln'));

  const items = (scene.items ?? []).filter((i) => wallOf(i) === wall);
  const runs = items.filter((i) => i.kind === 'run');

  const ctxDraw = { U, V, uAt, s, floorY, fmt, tags };
  runs.forEach((run, index) => drawRun(out, run, index, ctxDraw));
  for (const a of items.filter((i) => i.kind === 'appliance')) {
    if (a.applianceType === 'fridge') drawFridge(out, a, ctxDraw);
    if (a.applianceType === 'hood') drawHood(out, a, { ...ctxDraw, H });
  }

  // Wall span at the lowest dimension row; height marker outside the wall.
  const spanRow = floorY + 16 + runs.length * 30 + 6;
  out.push(dim(U(0), spanRow, U(span), spanRow, fmt(span)));
  const height = runs.some((r) => (r.unitType ?? 'base') === 'base')
    ? DIMS.plinthHeight + DIMS.baseHeight + DIMS.worktopThickness
    : runs.some((r) => r.unitType === 'tall')
      ? DIMS.tallHeight
      : runs.some((r) => r.unitType === 'wall')
        ? DIMS.wallUnitMount + DIMS.wallUnitHeight
        : H;
  out.push(dim(U(0) - 18, floorY, U(0) - 18, V(height), fmt(height)));
  return out.join('');
}

function drawRun(out, run, index, { U, V, uAt, s, floorY, fmt, tags }) {
  const ctx = unitContext(run);
  const widths = (run.modules ?? []).map((m) => m.width);
  const rw = widths.reduce((a, b) => a + b, 0);
  if (rw <= 0) return;
  const u0 = uAt(run, 0);
  const u1 = uAt(run, rw);
  const left = Math.min(u0, u1);
  const topY = ctx.yBase + ctx.carcassHeight;

  // Backsplash hatch, then plinth, worktop band, then module fronts.
  if (run.backsplash && ctx.unitType === 'base') {
    const y1 = topY + DIMS.worktopThickness;
    out.push(R(U(left), V(DIMS.wallUnitMount), rw * s, (DIMS.wallUnitMount - y1) * s, 'thin'));
    out.push(
      `<rect x="${U(left).toFixed(1)}" y="${V(DIMS.wallUnitMount).toFixed(1)}" width="${(rw * s).toFixed(1)}" height="${((DIMS.wallUnitMount - y1) * s).toFixed(1)}" fill="url(#hatch)" stroke="none"/>`
    );
  }
  if (ctx.plinth) {
    out.push(R(U(left) + 0.02 * s, V(DIMS.plinthHeight), rw * s - 0.04 * s, DIMS.plinthHeight * s, 'thin'));
  }
  const wantsTop = run.worktop !== false && ctx.unitType === 'base';
  if (wantsTop) {
    out.push(R(U(left) - 2, V(topY + DIMS.worktopThickness), rw * s + 4, DIMS.worktopThickness * s, 'box'));
  }
  // Under-cabinet LED: dashed strip + downward light ticks below the unit.
  if (run.underLight && ctx.unitType === 'wall') {
    const y = V(ctx.yBase) + 3;
    out.push(L(U(left) + 3, y, U(left) + rw * s - 3, y, 'swing'));
    for (let k = 1; k <= 4; k += 1) {
      const x = U(left) + (rw * s * k) / 5;
      out.push(L(x, y + 2, x, y + 9, 'swing'));
    }
  }
  // Reference tag above the unit.
  if (tags?.get(run.id)) {
    out.push(tagBubble(U(left) + (rw * s) / 2, V(topY + (ctx.unitType === 'base' ? DIMS.worktopThickness : 0)) - 16, tags.get(run.id)));
  }

  let cum = 0;
  for (const module of run.modules ?? []) {
    const a = U(uAt(run, cum));
    const b = U(uAt(run, cum + module.width));
    const x = Math.min(a, b);
    const w = Math.abs(b - a);
    const comps = effectiveCompartments(module);
    const solved = solveHeights(comps, ctx.carcassHeight);
    if (solved.error) {
      out.push(R(x, V(topY), w, ctx.carcassHeight * s, 'dash'));
    } else {
      let top = topY;
      comps.forEach((comp, i) => {
        const h = solved.heights[i];
        out.push(drawFront(comp, x + 1, V(top) + 1, w - 2, h * s - 2, s));
        top -= h;
      });
    }
    out.push(R(x, V(topY), w, ctx.carcassHeight * s, 'ln'));
    cum += module.width;
  }

  // Dimensions: per-module chain, overall length below it (display unit).
  const base = floorY + 16 + index * 30;
  if (widths.length > 1) {
    let acc = 0;
    for (const w of widths) {
      const a = U(uAt(run, acc));
      const b = U(uAt(run, acc + w));
      out.push(dim(Math.min(a, b), base, Math.max(a, b), base, fmt(w), { optional: true }));
      acc += w;
    }
  }
  const overall = base + (widths.length > 1 ? 13 : 0);
  out.push(dim(U(left), overall, U(left) + rw * s, overall, fmt(rw)));
}

const FRIDGE_SPLITS = {
  sideBySide: (x, y, w, h) => [L(x + w / 2, y, x + w / 2, y + h, 'ln')],
  frenchDoor: (x, y, w, h) => [
    L(x, y + h * 0.42, x + w, y + h * 0.42, 'ln'),
    L(x + w / 2, y, x + w / 2, y + h * 0.42, 'ln'),
  ],
  topFreezer: (x, y, w, h) => [L(x, y + h * 0.3, x + w, y + h * 0.3, 'ln')],
  bottomFreezer: (x, y, w, h) => [L(x, y + h * 0.68, x + w, y + h * 0.68, 'ln')],
};

function drawFridge(out, item, { U, V, uAt, s, tags }) {
  const p = { ...FRIDGE_DEFAULTS, ...item.params };
  const a = U(uAt(item, 0));
  const b = U(uAt(item, p.width));
  const x = Math.min(a, b);
  const w = Math.abs(b - a);
  const y = V(p.height);
  const h = p.height * s;
  out.push(R(x, y, w, h, 'appl'));
  out.push(...(FRIDGE_SPLITS[p.type] ?? FRIDGE_SPLITS.sideBySide)(x, y, w, h));
  out.push(T(x + w / 2, y + h / 2 + 3, 'REF', 'dimtxt', 'middle'));
  if (tags?.get(item.id)) out.push(tagBubble(x + w / 2, y - 14, tags.get(item.id)));
}

function drawHood(out, item, { U, V, uAt, s, H }) {
  const p = { ...HOOD_DEFAULTS, ...item.params };
  const a = U(uAt(item, 0));
  const b = U(uAt(item, p.width));
  const x = Math.min(a, b);
  const w = Math.abs(b - a);
  out.push(R(x, V(p.mountY + HOOD_DIMS.canopyH), w, HOOD_DIMS.canopyH * s, 'appl'));
  const ductX = x + w / 2 - (HOOD_DIMS.ductW / 2) * s;
  out.push(R(ductX, V(H), HOOD_DIMS.ductW * s, (H - p.mountY - HOOD_DIMS.canopyH) * s, 'appl'));
}

import * as THREE from 'three';
import { applyCameraPreset, elevationView, DEFAULT_FOV } from './camera.js';
import { WALL_LABELS, summarizeWall, wallOf } from '../state/elements.js';
import { DIMS } from '../state/schema.js';

// Drawing-sheet export. buildSheetModel renders the six views (four wall
// elevations, plan, 3D key) into per-cell canvases and computes CAD-style
// dimension annotations in cell-local pixels; renderElevationSheet
// serializes the model to a canvas for the PNG download, drawingsSvg.js
// serializes the same model to vector SVG for print. Views render
// synchronously into the live renderer canvas (same trick as the Share
// contact sheet), so the WebGL buffer is still valid for drawImage.
const TITLE_H = 64;
const CAPTION_H = 30;
const PAD = 14;
export const DIM_COLOR = '#3f4750';
const FLOOR_Y = 0.02;
const CHAR_W = 6.5; // approximate label glyph width; the model decides fit

const _v = new THREE.Vector3();
const meters = (v) => `${v.toFixed(2)} m`;

function cellPoint(camera, world, cw, ch) {
  _v.set(...world).project(camera);
  return [((_v.x + 1) / 2) * cw, ((1 - _v.y) / 2) * ch];
}

// A dimension: main line a->b, perpendicular end ticks, centered label.
// Chain labels that don't fit their segment are dropped here so both
// serializers agree (SVG cannot measure text); primary labels (overall
// lengths, heights, room sizes) always render, overflowing if they must.
function makeDim(a, b, label, { optional = false } = {}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 4;
  const ny = (dx / len) * 4;
  const fits = !optional || label.length * CHAR_W + 6 <= len;
  return {
    a,
    b,
    label: fits ? label : '',
    mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    ticks: [
      [a[0] - nx, a[1] - ny, a[0] + nx, a[1] + ny],
      [b[0] - nx, b[1] - ny, b[0] + nx, b[1] + ny],
    ],
  };
}

// Per run: a chain of module widths (cm, kitchen convention) closest to the
// object, the overall length (m) below it, staggered per run; plus one
// vertical height marker per wall (worktop top, tall or wall-unit top).
function elevationDims(camera, wall, sceneState, cw, ch) {
  const at = (world) => cellPoint(camera, world, cw, ch);
  const dims = [];
  const runs = sceneState.items.filter(
    (i) => i.kind === 'run' && (i.unitType ?? 'base') !== 'island' && wallOf(i) === wall
  );
  runs.forEach((run, index) => {
    const widths = (run.modules ?? []).map((mod) => mod.width);
    const rw = widths.reduce((s, w) => s + w, 0);
    if (rw < 0.05) return;
    const dir = run.rotationY ?? 0;
    const pt = (dist) =>
      at([run.position[0] + dist * Math.cos(dir), FLOOR_Y, run.position[1] - dist * Math.sin(dir)]);
    const drop = (px, dy) => [px[0], px[1] + dy];
    const base = 16 + index * 32;
    if (widths.length > 1) {
      let cum = 0;
      for (const w of widths) {
        dims.push(
          makeDim(drop(pt(cum), base), drop(pt(cum + w), base), String(Math.round(w * 100)), { optional: true })
        );
        cum += w;
      }
    }
    const overall = base + (widths.length > 1 ? 15 : 0);
    dims.push(makeDim(drop(pt(0), overall), drop(pt(rw), overall), meters(rw)));
  });

  const height = runs.some((r) => (r.unitType ?? 'base') === 'base')
    ? DIMS.plinthHeight + DIMS.baseHeight + DIMS.worktopThickness
    : runs.some((r) => r.unitType === 'tall')
      ? DIMS.tallHeight
      : runs.some((r) => r.unitType === 'wall')
        ? DIMS.wallUnitMount + DIMS.wallUnitHeight
        : null;
  if (height != null) {
    const { width, depth } = sceneState.room;
    const span = {
      north: [[-width / 2, -depth / 2], [width / 2, -depth / 2]],
      south: [[-width / 2, depth / 2], [width / 2, depth / 2]],
      west: [[-width / 2, -depth / 2], [-width / 2, depth / 2]],
      east: [[width / 2, -depth / 2], [width / 2, depth / 2]],
    }[wall];
    const corners = span.map(([x, z]) => at([x, FLOOR_Y, z]));
    const left = corners[0][0] <= corners[1][0] ? span[0] : span[1];
    const foot = at([left[0], FLOOR_Y, left[1]]);
    const top = at([left[0], height, left[1]]);
    dims.push(makeDim([foot[0] - 18, foot[1]], [top[0] - 18, top[1]], meters(height)));
  }
  return dims;
}

// Room width and depth along the plan's bottom and left edges.
function planDims(camera, room, cw, ch) {
  const at = (world) => cellPoint(camera, world, cw, ch);
  const { width, depth } = room;
  const sw = at([-width / 2, FLOOR_Y, depth / 2]);
  const se = at([width / 2, FLOOR_Y, depth / 2]);
  const nw = at([-width / 2, FLOOR_Y, -depth / 2]);
  return [
    makeDim([sw[0], sw[1] + 16], [se[0], se[1] + 16], meters(width)),
    makeDim([nw[0] - 16, nw[1]], [sw[0] - 16, sw[1]], meters(depth)),
  ];
}

export function buildSheetModel({ renderer, scene, camera, controls, projection, sceneState }) {
  const dom = renderer.domElement;
  const cw = Math.round(dom.width / 2);
  const ch = Math.round(dom.height / 2);
  const cell = ch + CAPTION_H;
  const room = sceneState.room;
  const model = {
    width: cw * 2 + PAD * 3,
    height: TITLE_H + cell * 3 + PAD * 4,
    cw,
    ch,
    title: 'Kitchen — elevations & plan',
    subtitle: `Room ${room.width.toFixed(2)} × ${room.depth.toFixed(2)} m · walls ${room.wallHeight.toFixed(2)} m · ${sceneState.items.length} elements`,
    cells: [],
  };
  const saved = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };

  const layout = [
    ['north', 'south'],
    ['east', 'west'],
    ['plan', 'iso'],
  ];
  layout.forEach((row, r) =>
    row.forEach((view, c) => {
      const x = PAD + c * (cw + PAD);
      const y = TITLE_H + PAD + r * (cell + PAD);
      const isWall = view !== 'plan' && view !== 'iso';
      applyCameraPreset(
        camera,
        controls,
        isWall ? elevationView(room, view, cw / ch) : view === 'plan' ? 'top' : 'hero'
      );
      projection.update(camera); // refresh wall auto-hide for this viewpoint
      renderer.render(scene, camera);
      const snap = document.createElement('canvas');
      snap.width = cw;
      snap.height = ch;
      snap.getContext('2d').drawImage(dom, 0, 0, cw, ch);
      model.cells.push({
        x,
        y,
        snap,
        title: isWall ? `${WALL_LABELS[view]} elevation` : view === 'plan' ? 'Plan' : '3D view',
        detail: isWall ? summarizeWall(sceneState, view) : '',
        dims: isWall
          ? elevationDims(camera, view, sceneState, cw, ch)
          : view === 'plan'
            ? planDims(camera, room, cw, ch)
            : [],
      });
    })
  );

  camera.position.copy(saved.position);
  controls.target.copy(saved.target);
  camera.fov = saved.fov ?? DEFAULT_FOV;
  camera.updateProjectionMatrix();
  controls.update();
  projection.update(camera);
  return model;
}

function drawDim(ctx, ox, oy, d) {
  ctx.strokeStyle = DIM_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox + d.a[0], oy + d.a[1]);
  ctx.lineTo(ox + d.b[0], oy + d.b[1]);
  for (const [x1, y1, x2, y2] of d.ticks) {
    ctx.moveTo(ox + x1, oy + y1);
    ctx.lineTo(ox + x2, oy + y2);
  }
  ctx.stroke();
  if (!d.label) return;
  ctx.font = '11px system-ui, sans-serif';
  const w = ctx.measureText(d.label).width;
  const [mx, my] = [ox + d.mid[0], oy + d.mid[1]];
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(mx - w / 2 - 3, my - 7, w + 6, 14);
  ctx.fillStyle = DIM_COLOR;
  ctx.fillText(d.label, mx - w / 2, my + 4);
}

export function renderElevationSheet(deps) {
  const model = buildSheetModel(deps);
  const sheet = document.createElement('canvas');
  sheet.width = model.width;
  sheet.height = model.height;
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, model.width, model.height);
  ctx.fillStyle = '#1b1d20';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText(model.title, PAD, 32);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#5f646a';
  ctx.fillText(model.subtitle, PAD, 52);

  for (const cell of model.cells) {
    ctx.drawImage(cell.snap, cell.x, cell.y);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cell.x, cell.y, model.cw, model.ch);
    ctx.clip();
    for (const d of cell.dims) drawDim(ctx, cell.x, cell.y, d);
    ctx.restore();
    ctx.strokeStyle = '#d6d8db';
    ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, model.cw - 1, model.ch - 1);
    ctx.fillStyle = '#1b1d20';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(cell.title, cell.x, cell.y + model.ch + 19);
    if (cell.detail) {
      const titleW = ctx.measureText(cell.title).width;
      ctx.fillStyle = '#5f646a';
      ctx.font = '12px system-ui, sans-serif';
      const detail = cell.detail.length > 64 ? `${cell.detail.slice(0, 61)}…` : cell.detail;
      ctx.fillText(detail, cell.x + titleW + 12, cell.y + model.ch + 19);
    }
  }
  return sheet;
}

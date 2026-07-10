import * as THREE from 'three';
import { applyCameraPreset, elevationView, DEFAULT_FOV } from './camera.js';
import { WALL_LABELS, summarizeWall, wallOf } from '../state/elements.js';
import { DIMS } from '../state/schema.js';

// Composes a 2D drawing sheet from the live scene: the four wall elevations
// plus plan and a 3D key view, each with a caption naming the wall and the
// elements detected against it, under a title block with the room dimensions.
// Renders synchronously into the existing renderer canvas (same trick as the
// Share contact sheet) so the WebGL buffer is still valid for drawImage.
const TITLE_H = 64;
const CAPTION_H = 30;
const PAD = 14;
const DIM_COLOR = '#3f4750';
const FLOOR_Y = 0.02;

const _v = new THREE.Vector3();
// World point -> pixel inside the given sheet cell, using the camera as it
// stands for that cell's render (matrices fresh from the render itself).
function project(camera, world, cx, cy, cw, ch) {
  _v.set(...world).project(camera);
  return [cx + ((_v.x + 1) / 2) * cw, cy + ((1 - _v.y) / 2) * ch];
}

// CAD-style dimension line: main stroke, perpendicular end ticks, centered
// label on a white halo so it stays readable over the render.
function dimLine(ctx, a, b, label) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 4;
  const ny = (dx / len) * 4;
  ctx.strokeStyle = DIM_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  for (const p of [a, b]) {
    ctx.moveTo(p[0] - nx, p[1] - ny);
    ctx.lineTo(p[0] + nx, p[1] + ny);
  }
  ctx.stroke();
  ctx.font = '11px system-ui, sans-serif';
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const w = ctx.measureText(label).width;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(mx - w / 2 - 3, my - 7, w + 6, 14);
  ctx.fillStyle = DIM_COLOR;
  ctx.fillText(label, mx - w / 2, my + 4);
}

const m = (v) => `${v.toFixed(2)} m`;
// Local +x rotated by the item's rotationY into world (matches build/run.js).
const runEnd = (item, rw) => [
  item.position[0] + rw * Math.cos(item.rotationY ?? 0),
  item.position[1] - rw * Math.sin(item.rotationY ?? 0),
];

// Run lengths under each run on this wall, plus one vertical height marker
// (worktop top, tall-unit or wall-unit top — whichever the wall carries).
function annotateElevation(ctx, camera, wall, sceneState, cx, cy, cw, ch) {
  const at = (world) => project(camera, world, cx, cy, cw, ch);
  const runs = sceneState.items.filter(
    (i) => i.kind === 'run' && (i.unitType ?? 'base') !== 'island' && wallOf(i) === wall
  );
  runs.forEach((run, index) => {
    const rw = (run.modules ?? []).reduce((s, mod) => s + mod.width, 0);
    if (rw < 0.05) return;
    const [ex, ez] = runEnd(run, rw);
    const a = at([run.position[0], FLOOR_Y, run.position[1]]);
    const b = at([ex, FLOOR_Y, ez]);
    const drop = 16 + index * 15; // stagger stacked runs on the same wall
    dimLine(ctx, [a[0], a[1] + drop], [b[0], b[1] + drop], m(rw));
  });

  const height = runs.some((r) => (r.unitType ?? 'base') === 'base')
    ? DIMS.plinthHeight + DIMS.baseHeight + DIMS.worktopThickness
    : runs.some((r) => r.unitType === 'tall')
      ? DIMS.tallHeight
      : runs.some((r) => r.unitType === 'wall')
        ? DIMS.wallUnitMount + DIMS.wallUnitHeight
        : null;
  if (height == null) return;
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
  dimLine(ctx, [foot[0] - 18, foot[1]], [top[0] - 18, top[1]], m(height));
}

// Room width and depth along the plan's bottom and left edges.
function annotatePlan(ctx, camera, room, cx, cy, cw, ch) {
  const at = (world) => project(camera, world, cx, cy, cw, ch);
  const { width, depth } = room;
  const sw = at([-width / 2, FLOOR_Y, depth / 2]);
  const se = at([width / 2, FLOOR_Y, depth / 2]);
  const nw = at([-width / 2, FLOOR_Y, -depth / 2]);
  dimLine(ctx, [sw[0], sw[1] + 16], [se[0], se[1] + 16], m(width));
  dimLine(ctx, [nw[0] - 16, nw[1]], [sw[0] - 16, sw[1]], m(depth));
}

export function renderElevationSheet({ renderer, scene, camera, controls, projection, sceneState }) {
  const dom = renderer.domElement;
  const cw = Math.round(dom.width / 2);
  const ch = Math.round(dom.height / 2);
  const cell = ch + CAPTION_H;
  const sheet = document.createElement('canvas');
  sheet.width = cw * 2 + PAD * 3;
  sheet.height = TITLE_H + cell * 3 + PAD * 4;
  const ctx = sheet.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheet.width, sheet.height);

  const room = sceneState.room;
  ctx.fillStyle = '#1b1d20';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText('Kitchen — elevations & plan', PAD, 32);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#5f646a';
  ctx.fillText(
    `Room ${room.width.toFixed(2)} × ${room.depth.toFixed(2)} m · walls ${room.wallHeight.toFixed(2)} m · ${sceneState.items.length} elements`,
    PAD,
    52
  );

  const saved = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
  const views = [
    ['north', 'south'],
    ['east', 'west'],
    ['plan', 'iso'],
  ];
  views.forEach((row, r) =>
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
      ctx.drawImage(dom, x, y, cw, ch);
      // Dimension annotations, clipped to the cell. The camera matrices are
      // fresh from the render above, so world->pixel projection is exact.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cw, ch);
      ctx.clip();
      if (isWall) annotateElevation(ctx, camera, view, sceneState, x, y, cw, ch);
      else if (view === 'plan') annotatePlan(ctx, camera, room, x, y, cw, ch);
      ctx.restore();
      ctx.strokeStyle = '#d6d8db';
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
      ctx.fillStyle = '#1b1d20';
      ctx.font = '600 13px system-ui, sans-serif';
      const title = isWall ? `${WALL_LABELS[view]} elevation` : view === 'plan' ? 'Plan' : '3D view';
      ctx.fillText(title, x, y + ch + 19);
      if (isWall) {
        const titleW = ctx.measureText(title).width;
        ctx.fillStyle = '#5f646a';
        ctx.font = '12px system-ui, sans-serif';
        const detail = summarizeWall(sceneState, view);
        ctx.fillText(detail.length > 64 ? `${detail.slice(0, 61)}…` : detail, x + titleW + 12, y + ch + 19);
      }
    })
  );

  camera.position.copy(saved.position);
  controls.target.copy(saved.target);
  camera.fov = saved.fov ?? DEFAULT_FOV;
  camera.updateProjectionMatrix();
  controls.update();
  projection.update(camera);
  return sheet;
}

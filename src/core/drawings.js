import { applyCameraPreset, DEFAULT_FOV } from './camera.js';
import { WALL_LABELS, summarizeWall } from '../state/elements.js';
import { planGroup } from '../draw2d/plan.js';
import { elevationGroup } from '../draw2d/elevation.js';
import { assignTags, legendRows } from '../draw2d/tags.js';
import { SHEET_STYLE, HATCH_DEF, esc, fmtDim, tagBubble } from '../draw2d/svg.js';
import { getDisplayUnit } from '../state/units.js';

// Drawing-sheet composer. The four wall elevations and the plan are TRUE 2D
// CAD line drawings generated from the scene JSON (src/draw2d/*), so every
// stroke, symbol and dimension is vector; only the 3D key view is a raster
// snapshot of the live scene. The sheet is built as one SVG string — the SVG
// export downloads it directly, the PNG export rasterizes it via an <img>.
const TITLE_H = 64;
const CAPTION_H = 30;
const PAD = 14;
const LEGEND_H = 96;

export function buildSheetSvg({ renderer, scene, camera, controls, projection, sceneState }) {
  const dom = renderer.domElement;
  const cw = Math.round(dom.width / 2);
  const ch = Math.round(dom.height / 2);
  const cell = ch + CAPTION_H;
  const width = cw * 2 + PAD * 3;
  const height = TITLE_H + cell * 3 + PAD * 4 + LEGEND_H;
  const room = sceneState.room;
  const unit = getDisplayUnit();
  const tags = assignTags(sceneState);
  const drawOpts = { unit, tags };

  // 3D key view: the only raster cell. Restore the editor camera after.
  const saved = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
  applyCameraPreset(camera, controls, 'hero');
  projection.update(camera);
  renderer.render(scene, camera);
  const snap = document.createElement('canvas');
  snap.width = cw;
  snap.height = ch;
  snap.getContext('2d').drawImage(dom, 0, 0, cw, ch);
  camera.position.copy(saved.position);
  controls.target.copy(saved.target);
  camera.fov = saved.fov ?? DEFAULT_FOV;
  camera.updateProjectionMatrix();
  controls.update();
  projection.update(camera);

  const out = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, -apple-system, sans-serif">`
  );
  out.push(`<defs><style>${SHEET_STYLE}</style>${HATCH_DEF}</defs>`);
  out.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
  out.push(`<text x="${PAD}" y="32" font-size="22" font-weight="600" fill="#1b1d20">Kitchen — plan &amp; elevations</text>`);
  out.push(
    `<text x="${PAD}" y="52" font-size="13" fill="#5f646a">${esc(
      `Room ${room.width.toFixed(2)} × ${room.depth.toFixed(2)} m · walls ${room.wallHeight.toFixed(2)} m · ${sceneState.items.length} elements`
    )}</text>`
  );

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
      let body;
      if (isWall) body = elevationGroup(sceneState, view, cw, ch, drawOpts);
      else if (view === 'plan') body = planGroup(sceneState, cw, ch, drawOpts);
      else body = `<image width="${cw}" height="${ch}" href="${snap.toDataURL('image/png')}"/>`;
      out.push(`<g transform="translate(${x},${y})">${body}</g>`);
      out.push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="${cw - 1}" height="${ch - 1}" fill="none" stroke="#d6d8db"/>`);
      const title = isWall ? `${WALL_LABELS[view]} elevation` : view === 'plan' ? 'Floor plan' : '3D view';
      const baseline = y + ch + 19;
      out.push(`<text x="${x}" y="${baseline}" font-size="13" font-weight="600" fill="#1b1d20">${esc(title)}</text>`);
      if (isWall) {
        const detail = summarizeWall(sceneState, view);
        const shown = detail.length > 64 ? `${detail.slice(0, 61)}…` : detail;
        out.push(
          `<text x="${(x + title.length * 7.6 + 14).toFixed(1)}" y="${baseline}" font-size="12" fill="#5f646a">${esc(shown)}</text>`
        );
      }
    })
  );

  // Legend band: reference tags with element names and sizes, 3 columns.
  const legendY = TITLE_H + PAD + 3 * (cell + PAD) + 6;
  out.push(`<line x1="${PAD}" y1="${legendY - 8}" x2="${width - PAD}" y2="${legendY - 8}" stroke="#d6d8db"/>`);
  out.push(`<text x="${PAD}" y="${legendY + 6}" font-size="11" font-weight="700" fill="#5f646a" letter-spacing="0.06em">LEGEND (dimensions in ${unit === 'mm' ? 'mm' : 'feet-inches'})</text>`);
  const rows = legendRows(sceneState, tags, (v) => fmtDim(v, unit));
  const colW = (width - 2 * PAD) / 3;
  rows.slice(0, 12).forEach((row, i) => {
    const cx = PAD + (i % 3) * colW;
    const cy = legendY + 24 + Math.floor(i / 3) * 19;
    out.push(tagBubble(cx + 10, cy - 3, row.tag));
    out.push(
      `<text x="${cx + 26}" y="${cy}" font-size="11.5" fill="#22262a">${esc(row.label)}${row.size ? ` — ${esc(row.size)}` : ''}</text>`
    );
  });

  out.push('</svg>');
  return { svg: out.join('\n'), width, height };
}

// SVG string -> canvas, for the PNG download. Data-URI images inside the SVG
// (the 3D cell) keep the canvas untainted, so toBlob works.
export function rasterizeSvg(svg, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

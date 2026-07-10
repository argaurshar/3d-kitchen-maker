import { DIM_COLOR } from './drawings.js';

// Serializes a sheet model (see drawings.js buildSheetModel) to an SVG
// document for print: the rendered views are embedded as PNG images, while
// the title block, captions and every dimension line/label stay vector, so
// they print crisp at any scale (open in a browser and print to PDF).
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function dimSvg(ox, oy, d) {
  const out = [];
  const seg = (x1, y1, x2, y2) =>
    `<line x1="${(ox + x1).toFixed(1)}" y1="${(oy + y1).toFixed(1)}" x2="${(ox + x2).toFixed(1)}" y2="${(oy + y2).toFixed(1)}" stroke="${DIM_COLOR}" stroke-width="1"/>`;
  out.push(seg(d.a[0], d.a[1], d.b[0], d.b[1]));
  for (const [x1, y1, x2, y2] of d.ticks) out.push(seg(x1, y1, x2, y2));
  if (d.label) {
    const w = d.label.length * 6.5 + 6;
    const mx = ox + d.mid[0];
    const my = oy + d.mid[1];
    out.push(`<rect x="${(mx - w / 2).toFixed(1)}" y="${(my - 7).toFixed(1)}" width="${w.toFixed(1)}" height="14" fill="#ffffff"/>`);
    out.push(`<text x="${mx.toFixed(1)}" y="${(my + 4).toFixed(1)}" font-size="11" fill="${DIM_COLOR}" text-anchor="middle">${esc(d.label)}</text>`);
  }
  return out.join('');
}

export function svgFromSheetModel(model) {
  const out = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${model.width}" height="${model.height}" viewBox="0 0 ${model.width} ${model.height}" font-family="system-ui, -apple-system, sans-serif">`
  );
  out.push(`<rect width="${model.width}" height="${model.height}" fill="#ffffff"/>`);
  out.push(`<text x="14" y="32" font-size="22" font-weight="600" fill="#1b1d20">${esc(model.title)}</text>`);
  out.push(`<text x="14" y="52" font-size="13" fill="#5f646a">${esc(model.subtitle)}</text>`);

  model.cells.forEach((cell, i) => {
    out.push(`<clipPath id="cell${i}"><rect x="${cell.x}" y="${cell.y}" width="${model.cw}" height="${model.ch}"/></clipPath>`);
    out.push(
      `<image x="${cell.x}" y="${cell.y}" width="${model.cw}" height="${model.ch}" href="${cell.snap.toDataURL('image/png')}"/>`
    );
    out.push(`<g clip-path="url(#cell${i})">`);
    for (const d of cell.dims) out.push(dimSvg(cell.x, cell.y, d));
    out.push('</g>');
    out.push(
      `<rect x="${cell.x + 0.5}" y="${cell.y + 0.5}" width="${model.cw - 1}" height="${model.ch - 1}" fill="none" stroke="#d6d8db"/>`
    );
    const baseline = cell.y + model.ch + 19;
    out.push(`<text x="${cell.x}" y="${baseline}" font-size="13" font-weight="600" fill="#1b1d20">${esc(cell.title)}</text>`);
    if (cell.detail) {
      const detail = cell.detail.length > 64 ? `${cell.detail.slice(0, 61)}…` : cell.detail;
      const offset = cell.title.length * 7.6 + 14;
      out.push(`<text x="${(cell.x + offset).toFixed(1)}" y="${baseline}" font-size="12" fill="#5f646a">${esc(detail)}</text>`);
    }
  });
  out.push('</svg>');
  return out.join('\n');
}

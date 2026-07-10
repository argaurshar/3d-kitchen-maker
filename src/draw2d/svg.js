// String-building primitives for the 2D CAD drawings. Everything returns SVG
// markup; a shared <style> block keeps the line weights consistent across the
// plan and the elevations (architectural line-art: dark strokes, light fills,
// dashed = above the cut plane or a door swing).
export const SHEET_STYLE = `
  .ln { stroke:#2b3036; fill:none; stroke-width:1; }
  .thin { stroke:#9aa0a6; fill:none; stroke-width:0.6; }
  .dash { stroke:#2b3036; fill:none; stroke-width:0.8; stroke-dasharray:4 3; }
  .swing { stroke:#6b7178; fill:none; stroke-width:0.6; stroke-dasharray:3 3; }
  .box { fill:#f1f2f4; stroke:#2b3036; stroke-width:1; }
  .paper { fill:#ffffff; stroke:none; }
  .wallcut { fill:#c8ccd1; stroke:#2b3036; stroke-width:1; }
  .worktop { fill:#fafbfc; stroke:#2b3036; stroke-width:0.8; }
  .appl { fill:#eceef0; stroke:#2b3036; stroke-width:1; }
  .glass { stroke:#7f8891; fill:none; stroke-width:0.5; }
  .dim { stroke:#46505a; fill:none; stroke-width:0.8; }
  .dimtxt { font:10px system-ui,sans-serif; fill:#46505a; }
  .lbl { font:600 10px system-ui,sans-serif; fill:#2b3036; }
`;

const r1 = (v) => Math.round(v * 10) / 10;
export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const L = (x1, y1, x2, y2, cls = 'ln') =>
  `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" class="${cls}"/>`;
export const R = (x, y, w, h, cls = 'ln', rx = 0) =>
  `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(Math.max(w, 0.1))}" height="${r1(Math.max(h, 0.1))}"${rx ? ` rx="${rx}"` : ''} class="${cls}"/>`;
export const C = (cx, cy, radius, cls = 'ln') =>
  `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(radius)}" class="${cls}"/>`;
export const T = (x, y, text, cls = 'dimtxt', anchor = 'start') =>
  `<text x="${r1(x)}" y="${r1(y)}" class="${cls}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}>${esc(text)}</text>`;

const CHAR_W = 6.2;

// CAD dimension: main line, perpendicular end ticks, centered label on a
// white halo. Optional labels are dropped when the segment is too short.
export function dim(x1, y1, x2, y2, label, { optional = false } = {}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 3.5;
  const ny = (dx / len) * 3.5;
  const out = [
    L(x1, y1, x2, y2, 'dim'),
    L(x1 - nx, y1 - ny, x1 + nx, y1 + ny, 'dim'),
    L(x2 - nx, y2 - ny, x2 + nx, y2 + ny, 'dim'),
  ];
  if (!optional || label.length * CHAR_W + 6 <= len) {
    const w = label.length * CHAR_W + 6;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    out.push(`<rect x="${r1(mx - w / 2)}" y="${r1(my - 6.5)}" width="${r1(w)}" height="13" fill="#ffffff"/>`);
    out.push(T(mx, my + 3.5, label, 'dimtxt', 'middle'));
  }
  return out.join('');
}

export const meters = (v) => `${v.toFixed(2)} m`;
export const cmLabel = (v) => String(Math.round(v * 100));

// Diagonal-hatch pattern (backsplash / section fill). Define once per sheet.
export const HATCH_DEF =
  '<pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
  '<line x1="0" y1="0" x2="0" y2="7" stroke="#c9cdd2" stroke-width="1"/></pattern>';

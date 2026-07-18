import { boxGeom, cylGeom, box, mergeParts } from './util.js';

// Built-in appliance fronts (oven, microwave) — moved out of compartments.js
// verbatim to keep that file under the size cap.

// Dark front, glass window band, control strip with 4 knobs, bar handle.
export function buildOvenFront(group, rect, ctx, matLib, tag) {
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  const cx = rect.x0 + w / 2;
  const dark = matLib.get('appliance_dark');
  const glass = matLib.get('glass_dark');
  const steel = matLib.get('metal_steel');
  const t = tag('applianceBody');

  const body = box(w, h, 0.02, dark, t);
  body.position.set(cx, rect.y0 + h / 2, ctx.zBack + 0.01);
  group.add(body);

  const win = box(w - 0.12, h * 0.45, 0.006, glass, tag('applianceBody'));
  win.position.set(cx, rect.y0 + h * 0.34, ctx.zBack + 0.022);
  group.add(win);

  const steelGeoms = [];
  for (let k = 0; k < 4; k += 1) {
    steelGeoms.push(
      cylGeom(0.009, 0.014, rect.x0 + w * (0.3 + k * 0.135), rect.y1 - 0.05, ctx.zBack + 0.026, { rx: Math.PI / 2, seg: 14 })
    );
  }
  steelGeoms.push(cylGeom(0.006, w - 0.1, cx, rect.y1 - 0.105, ctx.zBack + 0.05, { rz: Math.PI / 2 }));
  for (const side of [-1, 1]) {
    steelGeoms.push(
      cylGeom(0.004, 0.035, cx + side * (w / 2 - 0.08), rect.y1 - 0.105, ctx.zBack + 0.032, { rx: Math.PI / 2, seg: 12 })
    );
  }
  group.add(mergeParts(steelGeoms, steel, tag('applianceBody')));
}

// Dark front, window on the left, button grid on the right control panel.
export function buildMicrowaveFront(group, rect, ctx, matLib, tag) {
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  const dark = matLib.get('appliance_dark');
  const glass = matLib.get('glass_dark');
  const steel = matLib.get('metal_steel');

  const body = box(w, h, 0.02, dark, tag('applianceBody'));
  body.position.set(rect.x0 + w / 2, rect.y0 + h / 2, ctx.zBack + 0.01);
  group.add(body);

  const panelW = 0.13;
  const win = box(w - panelW - 0.07, h - 0.07, 0.006, glass, tag('applianceBody'));
  win.position.set(rect.x0 + (w - panelW) / 2, rect.y0 + h / 2, ctx.zBack + 0.022);
  group.add(win);

  const gridX = rect.x1 - panelW / 2 - 0.015;
  const buttonGeoms = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      buttonGeoms.push(
        boxGeom(0.016, 0.012, 0.003, gridX + (col - 1) * 0.024, rect.y0 + h * 0.72 - row * 0.032, ctx.zBack + 0.022)
      );
    }
  }
  group.add(mergeParts(buttonGeoms, steel, tag('applianceBody')));
}

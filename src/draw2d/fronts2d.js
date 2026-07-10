import { L, R, C } from './svg.js';

// Elevation symbols for one compartment front, in sheet pixels (x,y = top
// left). Architectural conventions: dashed V on doors with the apex at the
// hinge side, a diagonal glazing mark on glass, drawers as horizontal bands
// with centered pulls, ovens/microwaves as appliance boxes with windows.
export function drawFront(comp, x, y, w, h, s) {
  switch (comp.type) {
    case 'door':
      return door(comp, x, y, w, h);
    case 'drawer':
      return [R(x, y, w, h, 'ln'), L(x + w / 2 - 7, y + 5, x + w / 2 + 7, y + 5, 'ln')].join('');
    case 'oven':
      return oven(x, y, w, h);
    case 'microwave':
      return micro(x, y, w, h);
    case 'shelf':
      return shelf(comp, x, y, w, h);
    default:
      return R(x, y, w, h, 'thin');
  }
}

function leafSwing(x, y, w, h, hinge) {
  // Dashed V, apex on the hinge edge at mid-height, arms to the far corners.
  const apexX = hinge === 'L' ? x : x + w;
  const farX = hinge === 'L' ? x + w : x;
  return [
    L(farX, y, apexX, y + h / 2, 'swing'),
    L(farX, y + h, apexX, y + h / 2, 'swing'),
  ].join('');
}

function handleTick(x, y, w, h, hinge) {
  // Pull on the latch side (opposite the hinge), vertical, mid-height.
  const hx = hinge === 'L' ? x + w - 5 : x + 5;
  return L(hx, y + h / 2 - 7, hx, y + h / 2 + 7, 'ln');
}

function door(comp, x, y, w, h) {
  const hinge = comp.style?.hinge ?? 'L';
  const out = [R(x, y, w, h, 'ln')];
  if (hinge === 'double') {
    const half = w / 2;
    out.push(L(x + half, y, x + half, y + h, 'ln'));
    out.push(leafSwing(x, y, half, h, 'L'), leafSwing(x + half, y, half, h, 'R'));
    out.push(handleTick(x, y, half, h, 'L'), handleTick(x + half, y, half, h, 'R'));
  } else {
    out.push(leafSwing(x, y, w, h, hinge), handleTick(x, y, w, h, hinge));
  }
  if (comp.style?.glass) {
    out.push(R(x + 4, y + 4, w - 8, h - 8, 'glass'));
    out.push(L(x + 4, y + h - 4, x + w - 4, y + 4, 'glass'));
  }
  return out.join('');
}

function oven(x, y, w, h) {
  const out = [R(x, y, w, h, 'appl')];
  out.push(R(x + 6, y + h * 0.32, w - 12, h * 0.55, 'glass'));
  for (let k = 0; k < 4; k += 1) {
    out.push(C(x + w * (0.3 + k * 0.135), y + h * 0.15, 2, 'ln'));
  }
  return out.join('');
}

function micro(x, y, w, h) {
  return [
    R(x, y, w, h, 'appl'),
    R(x + 4, y + 4, w * 0.62, h - 8, 'glass'),
    L(x + w * 0.78, y + 6, x + w * 0.78, y + h - 6, 'thin'),
  ].join('');
}

function shelf(comp, x, y, w, h) {
  const out = [R(x, y, w, h, 'thin')];
  const n = comp.shelvesInside ?? 1;
  for (let k = 1; k <= n; k += 1) {
    const sy = y + (h * k) / (n + 1);
    out.push(L(x + 2, sy, x + w - 2, sy, 'thin'));
  }
  return out.join('');
}

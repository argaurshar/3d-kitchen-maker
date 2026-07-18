// Display-unit preference: presentation state (like clay mode), NOT part of
// the scene — kept out of undo history and scene persistence on purpose.
// Internals stay meters everywhere; only formatting changes.
const KEY = 'kitchen-maker.units.v1';
const UNITS = ['mm', 'ftin'];

let unit = 'mm';
try {
  const saved = localStorage.getItem(KEY);
  if (UNITS.includes(saved)) unit = saved;
} catch {
  /* storage unavailable */
}

const subscribers = new Set();

export function getDisplayUnit() {
  return unit;
}

export function setDisplayUnit(next) {
  if (!UNITS.includes(next) || next === unit) return;
  unit = next;
  try {
    localStorage.setItem(KEY, unit);
  } catch {
    /* storage unavailable */
  }
  for (const cb of subscribers) cb(unit);
}

export function subscribeUnits(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function toFtIn(m) {
  const totalIn = m * 39.3701;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round((totalIn - ft * 12) * 4) / 4;
  if (inches >= 12) return { ft: ft + 1, inches: 0 };
  return { ft, inches };
}

// Full label for panels/quotes: "600 mm" or 2' 0".
export function fmtLen(m) {
  if (unit === 'mm') return `${Math.round(m * 1000)} mm`;
  const { ft, inches } = toFtIn(m);
  if (ft === 0) return `${inches}"`;
  return `${ft}' ${inches}"`;
}

// Compact label for dimension chains: "600" or 2'-0".
export function fmtDimLabel(m) {
  if (unit === 'mm') return String(Math.round(m * 1000));
  const { ft, inches } = toFtIn(m);
  return `${ft}'-${inches}"`;
}

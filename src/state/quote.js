import { SWATCHES } from '../materials/swatches.js';
import { effectiveCompartments } from '../build/compartments.js';
import { labelOf, wallOf, WALL_LABELS } from './elements.js';

// Pure quotation engine: (scene JSON, rate card) -> line items + totals.
// No store reads — deterministic and testable in node (see actions-smoke).
const M_TO_FT = 3.28084;
const CATEGORY_OF = new Map(SWATCHES.map((s) => [s.id, s.category]));

export const QUOTE_DEFAULTS = { hardwareTier: 'standard', gstPct: 18, discountPct: 0, rateOverrides: {} };

const round = (v) => Math.round(v);
const ftOf = (run) => (run.modules ?? []).reduce((s, m) => s + m.width, 0) * M_TO_FT;

function runLine(run, card, hardwareFactor) {
  const ft = ftOf(run);
  if (ft <= 0) return null;
  const unitType = run.unitType ?? 'base';
  const finishCat = CATEGORY_OF.get(run.materials?.door) ?? 'paint';
  const finishFactor = card.finishTiers[finishCat] ?? 1;

  let amount = (card.unitRates[unitType] ?? card.unitRates.base) * ft * finishFactor * hardwareFactor;
  const notes = [`${(run.modules ?? []).length} modules`, `${finishCat} finish`];

  for (const module of run.modules ?? []) {
    amount += card.moduleAdders[module.type] ?? 0;
    amount += card.handleAdders[module.handle] ?? 0;
    for (const comp of effectiveCompartments(module)) {
      if (comp.type !== 'door') continue;
      const style = comp.style ?? {};
      if (style.front && style.front !== 'hinged') amount += card.frontStyleAdders[style.front] ?? 0;
      if (style.profile) amount += card.frontStyleAdders.profile;
      if (style.lit) amount += card.frontStyleAdders.lit;
    }
  }

  const wantsTop = run.worktop !== false && (unitType === 'base' || unitType === 'island');
  if (wantsTop) {
    amount += card.extras.worktopPerFt * ft;
    notes.push('worktop');
  }
  if (run.backsplash && unitType === 'base') {
    amount += card.extras.backsplashPerFt * ft;
    notes.push('backsplash');
  }
  if (run.underLight && unitType === 'wall') {
    amount += card.extras.underLightPerFt * ft;
    notes.push('LED');
  }
  if (unitType === 'island' && run.islandFaces === 'shutter') {
    amount += card.extras.islandFacesPerFt * ft;
    notes.push('shutter faces');
  }
  return { qty: `${ft.toFixed(1)} ft`, amount: round(amount), detail: notes.join(' · ') };
}

export function computeQuote(scene, card) {
  const quote = { ...QUOTE_DEFAULTS, ...scene.quote };
  const hardwareFactor = card.hardwareTiers[quote.hardwareTier] ?? 1;
  const lines = [];

  for (const item of scene.items ?? []) {
    const wall = wallOf(item);
    const where = wall === 'center' ? 'Center' : `${WALL_LABELS[wall]} wall`;
    if (item.kind === 'run') {
      const line = runLine(item, card, hardwareFactor);
      if (!line) continue;
      lines.push({ id: item.id, label: `${labelOf(item)} — ${where}`, ...line });
      for (const feature of item.features ?? []) {
        lines.push({
          id: feature.id,
          label: `${feature.type[0].toUpperCase()}${feature.type.slice(1)}`,
          qty: '1',
          detail: `on ${labelOf(item).toLowerCase()}`,
          amount: card.features[feature.type] ?? 0,
        });
      }
    } else if (item.kind === 'appliance') {
      lines.push({
        id: item.id,
        label: `${labelOf(item)} — ${where}`,
        qty: '1',
        detail: 'freestanding',
        amount: card.appliances[item.applianceType] ?? 0,
      });
    } else if (item.kind === 'furniture') {
      lines.push({ id: item.id, label: labelOf(item), qty: '1', detail: 'seating', amount: card.furniture.stool });
    }
  }

  const subtotal = round(lines.reduce((s, l) => s + l.amount, 0));
  const discountAmt = round((subtotal * (quote.discountPct ?? 0)) / 100);
  const gstAmt = round(((subtotal - discountAmt) * (quote.gstPct ?? 18)) / 100);
  const total = subtotal - discountAmt + gstAmt;
  return { lines, subtotal, discountAmt, gstAmt, total, quote };
}

export const fmtINR = (v) => `₹${v.toLocaleString('en-IN')}`;

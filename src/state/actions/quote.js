import { store } from '../store.js';
import { ok, fail } from './core.js';
import { QUOTE_DEFAULTS } from '../quote.js';
import { RATE_CARD, isValidRatePath } from '../pricing.js';

// Quotation state: hardware tier, GST, discount, and rate-card overrides all
// live in scene.quote, so they persist and are covered by undo.
function writeQuote(patch) {
  const current = { ...QUOTE_DEFAULTS, ...store.get().quote };
  store.set('quote', { ...current, ...patch });
  return ok();
}

export function setQuoteParam(key, value) {
  if (key === 'hardwareTier') {
    if (!(value in RATE_CARD.hardwareTiers)) return fail(`unknown hardware tier "${value}"`);
    return writeQuote({ hardwareTier: value });
  }
  if (key === 'gstPct') {
    if (typeof value !== 'number' || value < 0 || value > 28) return fail('gstPct must be 0..28');
    return writeQuote({ gstPct: value });
  }
  if (key === 'discountPct') {
    if (typeof value !== 'number' || value < 0 || value > 25) return fail('discountPct must be 0..25');
    return writeQuote({ discountPct: value });
  }
  return fail(`unknown quote param "${key}"`);
}

export function setRateOverride(path, value) {
  if (!isValidRatePath(path)) return fail(`unknown rate "${path}"`);
  if (typeof value !== 'number' || value < 0) return fail('rate must be a number >= 0');
  const current = { ...QUOTE_DEFAULTS, ...store.get().quote };
  return writeQuote({ rateOverrides: { ...current.rateOverrides, [path]: value } });
}

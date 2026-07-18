import { store } from '../state/store.js';
import { setQuoteParam, setRateOverride } from '../state/actions.js';
import { computeQuote, fmtINR, QUOTE_DEFAULTS } from '../state/quote.js';
import { resolveRateCard } from '../state/pricing.js';
import { el, segmented, stepper, button } from './controls.js';

// Live quotation panel (left-docked, from the toolbar ₹ button): line items
// per element, hardware-tier / GST / discount controls that re-price
// instantly, a small editable rate card, and the Print-proposal entry.
const TIER_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
];
const EDITABLE_RATES = [
  ['unitRates.base', 'Base ₹/ft'],
  ['unitRates.wall', 'Wall ₹/ft'],
  ['unitRates.tall', 'Tall ₹/ft'],
  ['unitRates.island', 'Island ₹/ft'],
  ['extras.worktopPerFt', 'Worktop ₹/ft'],
];

export function createQuotePanel({ onProposal }) {
  const root = el('div', 'quote-panel hidden');
  document.body.appendChild(root);
  let open = false;
  let showRates = false;
  let timer = null;

  function render() {
    const scene = store.get();
    const card = resolveRateCard(scene);
    const result = computeQuote(scene, card);
    const quote = { ...QUOTE_DEFAULTS, ...scene.quote };

    root.innerHTML = '';
    const header = el('div', 'panel-header');
    header.appendChild(el('span', 'panel-title', 'Quotation'));
    const close = el('button', 'icon-btn icon-close', '✕');
    close.addEventListener('click', () => setOpen(false));
    header.appendChild(close);
    root.appendChild(header);

    const body = el('div', 'panel-body');
    root.appendChild(body);

    body.appendChild(segmented(TIER_OPTIONS, quote.hardwareTier, (v) => setQuoteParam('hardwareTier', v)));

    const list = el('div', 'quote-lines');
    for (const line of result.lines) {
      const row = el('div', 'quote-line');
      const text = el('div', 'quote-line-text');
      text.appendChild(el('div', 'quote-line-label', line.label));
      text.appendChild(el('div', 'quote-line-detail', `${line.qty} · ${line.detail}`));
      row.append(text, el('div', 'quote-line-amt', fmtINR(line.amount)));
      list.appendChild(row);
    }
    body.appendChild(list);

    const totals = el('div', 'quote-totals');
    const trow = (label, value, strong = false) => {
      const row = el('div', `quote-total-row${strong ? ' strong' : ''}`);
      row.append(el('span', '', label), el('span', '', value));
      totals.appendChild(row);
    };
    trow('Subtotal', fmtINR(result.subtotal));
    if (result.discountAmt > 0) trow(`Discount (${quote.discountPct}%)`, `− ${fmtINR(result.discountAmt)}`);
    trow(`GST (${quote.gstPct}%)`, fmtINR(result.gstAmt));
    trow('Total', fmtINR(result.total), true);
    body.appendChild(totals);

    body.appendChild(stepper('GST %', quote.gstPct, 0, 28, (v) => setQuoteParam('gstPct', v)));
    body.appendChild(stepper('Discount %', quote.discountPct, 0, 25, (v) => setQuoteParam('discountPct', v)));

    const ratesBtn = button(showRates ? 'Hide rate card' : 'Edit rate card', () => {
      showRates = !showRates;
      render();
    }, 'wide');
    body.appendChild(ratesBtn);
    if (showRates) {
      for (const [path, label] of EDITABLE_RATES) {
        const row = el('div', 'row');
        row.appendChild(el('label', 'row-label', label));
        const input = el('input', 'rate-input');
        input.type = 'number';
        input.min = '0';
        input.step = '50';
        input.value = String(path.split('.').reduce((n, k) => n[k], card));
        input.addEventListener('change', () => setRateOverride(path, Number(input.value)));
        row.appendChild(input);
        body.appendChild(row);
      }
    }

    body.appendChild(button('🖨 Print proposal', () => onProposal?.(), 'wide primary'));
  }

  function setOpen(v) {
    open = v;
    root.classList.toggle('hidden', !open);
    if (open) render();
  }

  store.subscribe(() => {
    if (!open) return;
    clearTimeout(timer);
    timer = setTimeout(render, 200);
  });

  return { toggle: () => (setOpen(!open), open), isOpen: () => open, close: () => setOpen(false) };
}

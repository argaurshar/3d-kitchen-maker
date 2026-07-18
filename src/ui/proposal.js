import { computeQuote, fmtINR } from '../state/quote.js';
import { resolveRateCard } from '../state/pricing.js';
import { WALLS, WALL_LABELS, summarizeWall } from '../state/elements.js';
import { esc } from '../draw2d/svg.js';

// Client proposal: a print-ready document opened in a new window — cover
// with editable client fields, 3D views, the CAD drawing sheet inline, a
// per-wall specification, and the full quotation. The user prints to PDF.
// Popup blocked -> falls back to downloading proposal.html.
const STYLE = `
  body { font: 13px/1.5 system-ui, -apple-system, sans-serif; color: #22262a; margin: 0; }
  .page { padding: 34px 42px; page-break-after: always; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 22px 0 8px; border-bottom: 2px solid #22262a; padding-bottom: 4px; }
  .muted { color: #6b7076; }
  .cover-field { border-bottom: 1px dotted #9aa0a6; min-width: 220px; display: inline-block; padding: 1px 4px; }
  img.hero { width: 100%; border-radius: 6px; margin: 10px 0; }
  svg.sheet { width: 100%; height: auto; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #dde0e3; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7076; }
  td.amt, th.amt { text-align: right; white-space: nowrap; }
  tr.total td { font-weight: 700; border-top: 2px solid #22262a; font-size: 14px; }
  .terms { font-size: 11px; color: #6b7076; margin-top: 18px; }
  @media print { .page { padding: 10mm 12mm; } }
`;

export function buildProposalHtml({ sceneState, snapshots, sheetSvg }) {
  const card = resolveRateCard(sceneState);
  const result = computeQuote(sceneState, card);
  const room = sceneState.room;
  const date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  const lines = result.lines
    .map(
      (l) =>
        `<tr><td>${esc(l.label)}<div class="muted">${esc(l.detail)}</div></td><td>${esc(l.qty)}</td><td class="amt">${fmtINR(l.amount)}</td></tr>`
    )
    .join('');
  const walls = WALLS.map(
    (w) => `<tr><td>${WALL_LABELS[w]} wall</td><td>${esc(summarizeWall(sceneState, w))}</td></tr>`
  ).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Kitchen proposal</title><style>${STYLE}</style></head><body>
<div class="page">
  <h1>Kitchen Proposal</h1>
  <div class="muted">Prepared <span contenteditable class="cover-field">${date}</span>
  &nbsp;·&nbsp; For <span contenteditable class="cover-field">Client name</span>
  &nbsp;·&nbsp; By <span contenteditable class="cover-field">Your Kitchen Studio</span></div>
  <img class="hero" src="${snapshots.hero}" alt="3D view">
  <h2>Design summary</h2>
  <table><tr><th>Wall</th><th>Elements</th></tr>${walls}
  <tr><td>Room</td><td>${room.width.toFixed(2)} × ${room.depth.toFixed(2)} m · walls ${room.wallHeight.toFixed(2)} m</td></tr></table>
</div>
<div class="page">
  <h2>Working drawings</h2>
  ${sheetSvg.replace('<svg ', '<svg class="sheet" ')}
</div>
<div class="page">
  <h2>Quotation (${esc(result.quote.hardwareTier)} hardware)</h2>
  <table>
    <tr><th>Item</th><th>Qty</th><th class="amt">Amount</th></tr>
    ${lines}
    <tr><td colspan="2">Subtotal</td><td class="amt">${fmtINR(result.subtotal)}</td></tr>
    ${result.discountAmt ? `<tr><td colspan="2">Discount (${result.quote.discountPct}%)</td><td class="amt">− ${fmtINR(result.discountAmt)}</td></tr>` : ''}
    <tr><td colspan="2">GST (${result.quote.gstPct}%)</td><td class="amt">${fmtINR(result.gstAmt)}</td></tr>
    <tr class="total"><td colspan="2">Grand total</td><td class="amt">${fmtINR(result.total)}</td></tr>
  </table>
  <div class="terms">Estimate valid 30 days. Final measurements on site survey. Appliance models
  substitutable at billing. Taxes as applicable on invoice date.</div>
</div>
</body></html>`;
}

// Must be called synchronously from a click handler so window.open is
// allowed. Returns 'popup' or 'download' (blocked fallback).
export function openProposal(args, download) {
  const html = buildProposalHtml(args);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    return 'popup';
  }
  download(new Blob([html], { type: 'text/html' }), 'proposal.html');
  return 'download';
}

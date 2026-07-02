// DOM factories for the properties panel. Plain DOM, one shared stylesheet.

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const ICONS = {
  up: '▲',
  down: '▼',
  back: '‹',
  collapse: '»',
  close: '✕',
  plus: '+',
  trash:
    '<svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M6 1h4l.5 1H14v1.5H2V2h3.5L6 1zM3 5h10l-.7 9.1a1 1 0 0 1-1 .9H4.7a1 1 0 0 1-1-.9L3 5zm3 2v5.5h1.2V7H6zm2.8 0v5.5H10V7H8.8z"/></svg>',
};

export function iconButton(kind, onClick, title = kind) {
  const btn = el('button', `icon-btn icon-${kind}`);
  btn.type = 'button';
  btn.title = title;
  if (ICONS[kind].startsWith('<svg')) btn.innerHTML = ICONS[kind];
  else btn.textContent = ICONS[kind];
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

export function segmented(options, value, onChange) {
  const wrap = el('div', 'seg');
  for (const opt of options) {
    const btn = el('button', `seg-btn${opt.value === value ? ' active' : ''}`, opt.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      if (opt.value !== value) onChange(opt.value);
    });
    wrap.appendChild(btn);
  }
  return wrap;
}

// onChange(value, live): live=true while dragging, false on release.
export function slider(label, min, max, step, value, format, onChange) {
  const row = el('div', 'row');
  row.appendChild(el('label', 'row-label', label));
  const input = el('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  const readout = el('span', 'readout', format(value));
  input.addEventListener('input', () => {
    readout.textContent = format(Number(input.value));
    onChange(Number(input.value), true);
  });
  input.addEventListener('change', () => onChange(Number(input.value), false));
  row.append(input, readout);
  return row;
}

export function stepper(label, value, min, max, onChange) {
  const row = el('div', 'row');
  row.appendChild(el('label', 'row-label', label));
  const wrap = el('div', 'stepper');
  const minus = el('button', 'step-btn', '−');
  const readout = el('span', 'step-value', String(value));
  const plus = el('button', 'step-btn', '+');
  minus.type = 'button';
  plus.type = 'button';
  minus.addEventListener('click', () => value > min && onChange(value - 1));
  plus.addEventListener('click', () => value < max && onChange(value + 1));
  wrap.append(minus, readout, plus);
  row.appendChild(wrap);
  return row;
}

export function toggle(label, value, onChange) {
  const row = el('div', 'row');
  row.appendChild(el('label', 'row-label', label));
  const sw = el('button', `switch${value ? ' on' : ''}`);
  sw.type = 'button';
  sw.appendChild(el('span', 'knob'));
  sw.addEventListener('click', () => onChange(!value));
  row.appendChild(sw);
  return row;
}

export function listRow(labelNode, { onClick, onUp, onDown, onDelete }) {
  const row = el('div', 'list-row');
  const main = el('div', 'list-row-main');
  main.appendChild(labelNode);
  if (onClick) {
    main.classList.add('clickable');
    main.addEventListener('click', onClick);
  }
  row.appendChild(main);
  const tools = el('div', 'list-row-tools');
  if (onUp) tools.appendChild(iconButton('up', onUp, 'Move up'));
  if (onDown) tools.appendChild(iconButton('down', onDown, 'Move down'));
  if (onDelete) tools.appendChild(iconButton('trash', onDelete, 'Delete'));
  row.appendChild(tools);
  return row;
}

export function button(label, onClick, variant = '') {
  const btn = el('button', `btn ${variant}`.trim(), label);
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

// Collapsible section; returns { root, body }. onToggle flips persisted state.
export function section(title, collapsed, onToggle) {
  const root = el('div', `panel-section${collapsed ? ' collapsed' : ''}`);
  const header = el('div', 'section-header');
  header.appendChild(el('span', 'section-title', title));
  header.appendChild(el('span', 'section-chevron', collapsed ? '▸' : '▾'));
  header.addEventListener('click', onToggle);
  const body = el('div', 'section-body');
  root.append(header, body);
  return { root, body };
}

export function rafThrottle(fn) {
  let pending = null;
  let scheduled = false;
  return (...args) => {
    pending = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn(...pending);
    });
  };
}

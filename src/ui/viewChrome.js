import { el } from './controls.js';

const PERSON_SVG =
  '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><circle cx="8" cy="4.4" r="2.4"/><path d="M8 7.6c-2.8 0-4.6 1.5-4.6 3.6V15h2.2v-3.4h.8V15h3.2v-3.4h.8V15h2.2v-3.8c0-2.1-1.8-3.6-4.6-3.6z"/></svg>';

// Top-right preview chrome (person + Preview pill) and top-left file menu.
export function createViewChrome({ onPreview, onWalk, onNew, onSaveJson, onLoadJson, onHelp }) {
  const chrome = el('div', 'view-chrome');
  const help = el('button', 'person-btn help-btn', '?');
  help.title = 'Help & shortcuts (?)';
  const person = el('button', 'person-btn');
  person.innerHTML = PERSON_SVG;
  person.title = 'Walk around (WASD + mouse)';
  const pill = el('button', 'preview-pill', 'Preview');
  chrome.append(help, person, pill);
  document.body.appendChild(chrome);
  help.addEventListener('click', () => onHelp?.());
  person.addEventListener('click', onWalk);
  pill.addEventListener('click', onPreview);

  const menu = el('div', 'file-menu');
  const fileBtn = el('button', 'file-btn', 'File');
  const dropdown = el('div', 'file-dropdown hidden');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.style.display = 'none';
  for (const [label, handler] of [
    ['New scene', onNew],
    ['Save JSON', onSaveJson],
    ['Load JSON…', () => input.click()],
  ]) {
    const entry = el('button', 'file-entry', label);
    entry.addEventListener('click', () => {
      dropdown.classList.add('hidden');
      handler();
    });
    dropdown.appendChild(entry);
  }
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    file.text().then((text) => onLoadJson(text));
    input.value = '';
  });
  fileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('pointerdown', (e) => {
    if (!menu.contains(e.target)) dropdown.classList.add('hidden');
  });
  menu.append(fileBtn, dropdown, input);
  document.body.appendChild(menu);

  return {
    setPreviewActive(v) {
      pill.classList.toggle('active', v);
      pill.textContent = v ? 'Exit preview' : 'Preview';
    },
  };
}

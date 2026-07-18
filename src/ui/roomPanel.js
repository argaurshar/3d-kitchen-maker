import { store } from '../state/store.js';
import { setRoomParam } from '../state/actions.js';
import { getDisplayUnit, setDisplayUnit, subscribeUnits, fmtLen } from '../state/units.js';
import { el, slider, segmented, rafThrottle } from './controls.js';

// Room editor, opened by the toolbar "Build" button: room dimensions plus
// the display-unit preference. Values are meters internally; labels format
// through units.js.
const FIELDS = [
  ['width', 'Room width', 2.4, 12],
  ['depth', 'Room depth', 2.4, 12],
  ['wallHeight', 'Wall height', 2.2, 4],
];

export function createRoomPanel() {
  const root = el('div', 'room-panel hidden');
  document.body.appendChild(root);
  let open = false;
  let isLiveWrite = false; // suppress re-render while a slider drags

  function render() {
    root.innerHTML = '';
    const header = el('div', 'panel-header');
    header.appendChild(el('span', 'panel-title', 'Room & units'));
    const close = el('button', 'icon-btn icon-close', '✕');
    close.addEventListener('click', () => setOpen(false));
    header.appendChild(close);
    root.appendChild(header);

    const body = el('div', 'panel-body');
    root.appendChild(body);
    const room = store.get().room;

    for (const [key, label, min, max] of FIELDS) {
      const live = rafThrottle((v) => {
        isLiveWrite = true;
        try {
          setRoomParam(key, v);
        } finally {
          isLiveWrite = false;
        }
      });
      body.appendChild(
        slider(label, min, max, 0.05, room[key], fmtLen, (v, isLive) => {
          if (isLive) live(v);
          else setRoomParam(key, v);
        })
      );
    }

    const unitsRow = el('div', 'row');
    unitsRow.appendChild(el('label', 'row-label', 'Units'));
    unitsRow.appendChild(
      segmented(
        [
          { value: 'mm', label: 'mm' },
          { value: 'ftin', label: 'ft-in' },
        ],
        getDisplayUnit(),
        (v) => setDisplayUnit(v)
      )
    );
    body.appendChild(unitsRow);
  }

  function setOpen(v) {
    open = v;
    root.classList.toggle('hidden', !open);
    if (open) render();
  }

  // Re-render when the room changes elsewhere (undo, load) or units switch.
  store.subscribe((change) => {
    if (!open || isLiveWrite) return;
    if (change.type === 'replace' || change.path?.startsWith('room.')) render();
  });
  subscribeUnits(() => open && render());

  return { toggle: () => setOpen(!open), isOpen: () => open, close: () => setOpen(false) };
}

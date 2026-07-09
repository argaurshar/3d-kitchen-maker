// Comprehensive interaction audit: drives every button/control in the real
// DOM and asserts each produced its expected effect, capturing page/console
// errors throughout. Prints one line per check (ok/FAIL) and a summary.
// Usage: node tools/button-audit.mjs
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5177, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1360, height: 760 } });

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

const results = [];
let errWatermark = 0;
function check(name, ok, detail = '') {
  const newErrors = errors.slice(errWatermark);
  errWatermark = errors.length;
  const passed = ok && newErrors.length === 0;
  results.push({ name, passed, detail: detail || newErrors.join(' | ') });
  console.log(`${passed ? 'ok  ' : 'FAIL'} ${name}${!passed && (detail || newErrors.length) ? `  — ${detail || newErrors.join(' | ')}` : ''}`);
}

const app = (fn, arg) => page.evaluate(fn, arg);
const reload = async (fixture = 'reference-kitchen') => {
  await app((f) => window.__app.loadFixture(f), fixture);
  await page.waitForTimeout(200);
};
const canvasClick = async (x, y) => {
  // move-move-down-up so ghost.update sets a candidate before the commit
  await page.mouse.move(x, y);
  await page.mouse.move(x, y);
  await page.waitForTimeout(30);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(120);
};

await page.goto('http://localhost:5177/');
await page.waitForFunction(() => window.__app?.ready);
await app(() => window.__app.ready);
await page.waitForSelector('.toolbar');
errWatermark = errors.length;

// ---------------------------------------------------------------- TOOLBAR
await reload();
const tb = (id) => page.locator(`.toolbar .tb-item[data-tool="${id}"]`);

await tb('paint').click();
check('toolbar: Paint activates paint tool',
  (await app(() => window.__app.getTool())) === 'paint' && (await tb('paint').getAttribute('class')).includes('active'));

await tb('delete').click();
check('toolbar: Delete activates delete tool',
  (await app(() => window.__app.getTool())) === 'delete');

await tb('select').click();
check('toolbar: Select activates select tool',
  (await app(() => window.__app.getTool())) === 'select');

await tb('furnish').click();
check('toolbar: Furnish opens furnish row',
  !(await page.locator('.furnish-row').getAttribute('class')).includes('hidden'));
await tb('furnish').click();
check('toolbar: Furnish closes furnish row',
  (await page.locator('.furnish-row').getAttribute('class')).includes('hidden'));

await tb('snap').click();
check('toolbar: Snap toggles on', (await tb('snap').getAttribute('class')).includes('on'));
await tb('snap').click();
check('toolbar: Snap toggles off', !(await tb('snap').getAttribute('class')).includes('on'));

const clayBefore = await app(() => window.__app.getItemMaterials('base-run').join(','));
await tb('solid').click();
const clayAfter = await app(() => window.__app.getItemMaterials('base-run').join(','));
check('toolbar: Solid changes materials to clay', clayBefore !== clayAfter, `${clayBefore} -> ${clayAfter}`);
await tb('solid').click();
const clayRestored = await app(() => window.__app.getItemMaterials('base-run').join(','));
check('toolbar: Solid restores real materials', clayRestored === clayBefore);

await tb('lights').click();
check('toolbar: Lights toggles evening', (await tb('lights').getAttribute('class')).includes('on'));
await tb('lights').click();
check('toolbar: Lights toggles back to day', !(await tb('lights').getAttribute('class')).includes('on'));

await tb('build').click();
check('toolbar: Build does something visible',
  (await page.locator('.furnish-row').count()) > 0 &&
  (!(await page.locator('.furnish-row').getAttribute('class')).includes('hidden') ||
   (await page.locator('.toast').count()) > 0));

// Share downloads
let downloads = 0;
page.on('download', () => (downloads += 1));
await tb('share').click();
await page.waitForTimeout(3500);
check('toolbar: Share downloads files', downloads >= 1, `downloads=${downloads}`);

// ---------------------------------------------------------------- FURNISH PLACEMENT
for (const label of ['Base unit', 'Island', 'Stool', 'Fridge']) {
  await reload();
  await tb('furnish').click();
  await page.locator('.furnish-item', { hasText: label }).first().click();
  const placing = await app(() => window.__app.isPlacing());
  const before = await app(() => window.__app.store.get().items.length);
  await canvasClick(680, 430);
  const after = await app(() => window.__app.store.get().items.length);
  check(`furnish: place ${label}`, placing && after === before + 1, `placing=${placing} ${before}->${after}`);
}
// Wall unit requires wall snap; just assert placement mode begins.
await reload();
await tb('furnish').click();
await page.locator('.furnish-item', { hasText: 'Wall unit' }).first().click();
check('furnish: Wall unit enters placement', await app(() => window.__app.isPlacing()));
await page.keyboard.press('Escape');

// ---------------------------------------------------------------- CHROME
await reload();
await page.locator('.file-btn').click();
check('chrome: File opens dropdown', !(await page.locator('.file-dropdown').getAttribute('class')).includes('hidden'));
await page.locator('.file-entry', { hasText: 'New scene' }).click();
await page.waitForTimeout(200);
check('chrome: New scene loads galley', (await app(() => window.__app.store.get().items.length)) > 0);

let saveDl = 0;
const onDl = () => (saveDl += 1);
page.on('download', onDl);
await page.locator('.file-btn').click();
await page.locator('.file-entry', { hasText: 'Save JSON' }).click();
await page.waitForTimeout(500);
check('chrome: Save JSON downloads', saveDl >= 1);
page.off('download', onDl);

await page.locator('.preview-pill').click();
await page.waitForTimeout(300);
check('chrome: Preview enters preview (chrome hidden)',
  (await app(() => window.__app.getControlsState().autoRotate)) === true ||
  (await page.locator('.preview-pill.active').count()) > 0);
await page.locator('.preview-pill').click();
await page.waitForTimeout(200);
check('chrome: Preview exits', (await page.locator('.preview-pill.active').count()) === 0);

// ---------------------------------------------------------------- RUN BUTTONS
async function guard(name, fn) {
  try { await fn(); } catch (e) { check(name, false, String(e.message || e).split('\n')[0]); }
}
await guard('runButtons: + adds a module', async () => {
  await reload();
  await app(() => window.__app.select('base-run'));
  await app(() => window.__app.setCamera({ position: [4.2, 3.2, 4.4], target: [-1.3, 0.65, -1.2] }));
  await page.waitForTimeout(300);
  const modsBefore = await app(() => window.__app.store.get().items.find((i) => i.id === 'base-run').modules.length);
  await page.waitForSelector('.plus-btn:not(.hidden)', { timeout: 6000 });
  await page.locator('.plus-btn:not(.hidden)').first().click({ force: true });
  await page.waitForTimeout(150);
  const modsAfter = await app(() => window.__app.store.get().items.find((i) => i.id === 'base-run').modules.length);
  check('runButtons: + adds a module', modsAfter === modsBefore + 1, `${modsBefore}->${modsAfter}`);
});
await guard('runButtons: Switch-to-tall pill works', async () => {
  const pillTall = page.locator('.pill-btn:not(.hidden)', { hasText: /tall|base unit/i });
  const typeBefore = await app(() => window.__app.store.get().items.find((i) => i.id === 'base-run').unitType ?? 'base');
  await pillTall.first().click({ force: true, timeout: 6000 });
  await page.waitForTimeout(150);
  const typeAfter = await app(() => window.__app.store.get().items.find((i) => i.id === 'base-run').unitType ?? 'base');
  check('runButtons: Switch-to-tall pill works', typeBefore !== typeAfter, `${typeBefore}->${typeAfter}`);
});

// ---------------------------------------------------------------- PANEL (all types)
async function safeClick(loc) {
  // Controls re-render the panel on change; tolerate elements that vanish.
  try { await loc.click({ force: true, timeout: 1500 }); } catch { /* re-rendered away */ }
}
async function exercisePanel(scope) {
  for (const sel of ['.seg-btn', '.switch', '.step-btn', '.chip']) {
    // Re-count after each click since the panel rebuilds itself.
    let i = 0;
    for (let guardN = 0; guardN < 40; guardN += 1) {
      const loc = page.locator(`${scope} ${sel}`);
      const n = await loc.count();
      if (i >= n) break;
      await safeClick(loc.nth(i));
      await page.waitForTimeout(40);
      i += 1;
    }
  }
  const sliders = page.locator(`${scope} input[type=range]`);
  const sn = await sliders.count();
  for (let i = 0; i < sn; i += 1) {
    const bb = await sliders.nth(i).boundingBox().catch(() => null);
    if (!bb) continue;
    await page.mouse.move(bb.x + bb.width * 0.5, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width * 0.7, bb.y + bb.height / 2, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(60);
  }
}
for (const id of ['base-run', 'island-1', 'wall-run', 'larder-run', 'fridge-1', 'hood-1', 'stool-1']) {
  await guard(`panel: ${id} controls exercise cleanly`, async () => {
    await reload();
    await app((i) => window.__app.select(i), id);
    await page.waitForTimeout(150);
    await exercisePanel('.panel-body');
    const drill = page.locator('.panel-body .list-row-main.clickable').first();
    if ((await drill.count()) > 0) {
      await drill.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(150);
      await exercisePanel('.panel-body');
      const back = page.locator('.panel-body .icon-back');
      if ((await back.count()) > 0) await back.first().click({ timeout: 3000 }).catch(() => {});
    }
    check(`panel: ${id} controls exercise cleanly`, true);
  });
}

// Module add / duplicate / delete
await reload();
await app(() => window.__app.select('base-run'));
await page.waitForTimeout(150);
const addBtn = page.locator('.panel-body .btn', { hasText: 'Add module' });
const nBefore = await app(() => window.__app.store.get().items.find((i) => i.id === 'base-run').modules.length);
await addBtn.click();
await page.waitForTimeout(150);
const nAfter = await app(() => window.__app.store.get().items.find((i) => i.id === 'base-run').modules.length);
check('panel: + Add module works', nAfter === nBefore + 1, `${nBefore}->${nAfter}`);

// ---------------------------------------------------------------- PAINT WHEEL
// By design: paint hover highlights the surface (crosshair cursor); a click
// opens the radial wheel; hovering a segment previews and clicking commits.
await guard('paint: wheel', async () => {
  await reload();
  await app(() => window.__app.setCamera({ position: [4.2, 3.2, 4.4], target: [-1.3, 0.65, -1.2] }));
  await page.waitForTimeout(200);
  await tb('paint').click();
  // Scan the viewport for a genuinely paintable surface (a run front/worktop).
  const PAINTABLE = ['doorFront', 'drawerFront', 'worktop', 'carcass', 'plinth'];
  const found = await app((roles) => {
    for (let y = 150; y < 620; y += 20) {
      for (let x = 300; x < 1100; x += 20) {
        const raw = window.__app.pickAt(x, y, true);
        const top = raw.find((h) => h.visible && h.d > 0.05);
        if (top && top.itemId && roles.includes(top.surfaceRole)) {
          const item = window.__app.store.get().items.find((i) => i.id === top.itemId);
          if (item?.kind === 'run') {
            const slot = ['doorFront', 'drawerFront'].includes(top.surfaceRole) ? 'door' : top.surfaceRole;
            return { x, y, itemId: top.itemId, slot };
          }
        }
      }
    }
    return null;
  }, PAINTABLE);
  check('paint: a paintable run surface is on screen', Boolean(found), found ? `${found.itemId}/${found.slot}` : 'none found');
  if (!found) return;
  await page.mouse.move(found.x, found.y);
  await page.mouse.move(found.x + 1, found.y);
  await page.waitForTimeout(120);
  const cursor = await app(() => document.querySelector('canvas').style.cursor);
  check('paint: hover highlights surface (crosshair cursor)', cursor === 'crosshair', `cursor=${cursor}`);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(200);
  const wheelOpen = (await page.locator('.wheel:not(.hidden)').count()) > 0;
  check('paint: clicking a surface opens the wheel', wheelOpen);
  if (wheelOpen) {
    const before = await app((f) => window.__app.store.get().items.find((i) => i.id === f.itemId).materials[f.slot], found);
    // Choose a segment whose swatch differs from the current material so the
    // commit is observable.
    const swatches = await page.locator('.wheel .wheel-seg').evaluateAll((els) => els.map((e) => e.getAttribute('data-swatch')));
    const swatch = swatches.find((s) => s && s !== before) ?? swatches[0];
    const seg = page.locator(`.wheel .wheel-seg[data-swatch="${swatch}"]`).first();
    await seg.hover();
    await page.waitForTimeout(80);
    await seg.click({ force: true, timeout: 6000 });
    await page.waitForTimeout(200);
    const after = await app((f) => window.__app.store.get().items.find((i) => i.id === f.itemId).materials[f.slot], found);
    check('paint: clicking a swatch commits the material', after === swatch && after !== before, `${before} -> ${after} (swatch ${swatch})`);
    check('paint: wheel closes after commit', (await page.locator('.wheel:not(.hidden)').count()) === 0);
  }
});

// ---------------------------------------------------------------- ELEVATIONS
await guard('elevations', async () => {
  await reload();
  await page.locator('.elev-launch').click();
  check('elevations: launcher opens the panel',
    !(await page.locator('.elev-panel').getAttribute('class')).includes('hidden'));

  // Badge counts must match the pure detection over the scene.
  const expected = await app(() => window.__app.elevationCounts());
  let badgesOk = true;
  for (const w of ['north', 'east', 'south', 'west']) {
    const badge = await page.locator(`.elev-view[data-view="${w}"] .elev-badge`).textContent();
    if (Number(badge) !== expected[w]) badgesOk = false;
  }
  check('elevations: wall badges match detected element counts', badgesOk, JSON.stringify(expected));

  // Every view button switches the camera without error and becomes active.
  for (const v of ['north', 'east', 'south', 'west', 'plan', 'iso']) {
    const btn = page.locator(`.elev-view[data-view="${v}"]`);
    const camBefore = (await app(() => window.__app.getCameraPosition())).join(',');
    await btn.click();
    await page.waitForTimeout(150);
    const active = (await btn.getAttribute('class')).includes('active');
    const camAfter = (await app(() => window.__app.getCameraPosition())).join(',');
    check(`elevations: ${v} view activates + moves camera`, active && camBefore !== camAfter);
  }

  // "Add unit to this wall" begins placement.
  await page.locator('.elev-view[data-view="north"]').click();
  await page.waitForTimeout(100);
  await page.locator('.elev-add').click();
  await page.waitForTimeout(150);
  check('elevations: Add unit begins placement', await app(() => window.__app.isPlacing()));
  await page.keyboard.press('Escape');
});

// ---------------------------------------------------------------- SUMMARY
const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILURES:');
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ''}`);
}
console.log(`total page/console errors: ${errors.length}`);
await browser.close();
await server.close();
process.exit(failed.length ? 1 : 0);

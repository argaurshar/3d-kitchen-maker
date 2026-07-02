// Screenshot harness (see CLAUDE.md "Workflow").
// Usage: npm run shot -- --fixture=empty --views=hero,front,top,close --out=prefix
// Reuses a running dev server if VITE_URL is set; otherwise starts one on a
// free port. Writes shots/<prefix>-<view>.png at 1360x760.

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import process from 'node:process';
import { chromium } from 'playwright';

const VIEWPORT = { width: 1360, height: 760 };
const DAMPING_SETTLE_MS = 300;

function parseArgs(argv) {
  const args = {};
  for (const token of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(token);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

// Managed environments pre-install a Chromium that may not match the
// Playwright default revision; prefer it when present.
function chromiumExecutablePath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  return undefined;
}

const args = parseArgs(process.argv.slice(2));
const fixture = args.fixture;
const views = (args.views ?? 'hero').split(',').map((v) => v.trim()).filter(Boolean);
const prefix = args.out ?? fixture ?? 'shot';

let server;
let url = process.env.VITE_URL;
let browser;
let failed = false;

try {
  if (!url) {
    const { createServer } = await import('vite');
    server = await createServer({
      server: { port: await freePort(), strictPort: true },
      logLevel: 'silent',
    });
    await server.listen();
    url = server.resolvedUrls.local[0];
  }

  browser = await chromium.launch({
    executablePath: chromiumExecutablePath(),
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.on('pageerror', (error) => {
    failed = true;
    console.error(`[shot] page error: ${error.message}`);
  });

  await page.goto(url);
  await page.waitForFunction(() => window.__app?.ready);
  await page.evaluate(() => window.__app.ready);

  if (fixture) {
    await page.evaluate((name) => window.__app.loadFixture(name), fixture);
  }

  await mkdir(new URL('../shots/', import.meta.url), { recursive: true });
  for (const view of views) {
    await page.evaluate((preset) => window.__app.setCamera(preset), view);
    await page.waitForTimeout(DAMPING_SETTLE_MS);
    const path = new URL(`../shots/${prefix}-${view}.png`, import.meta.url);
    await page.screenshot({ path: path.pathname });
    console.log(`[shot] wrote shots/${prefix}-${view}.png`);
  }
} catch (error) {
  failed = true;
  console.error(`[shot] ${error.message}`);
} finally {
  await browser?.close();
  await server?.close();
}

process.exit(failed ? 1 : 0);

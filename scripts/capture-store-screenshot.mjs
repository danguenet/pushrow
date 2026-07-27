import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const extensionPath = resolve(root, 'dist');
const profilePath = await mkdtemp(join(tmpdir(), 'pushrow-store-shot-'));
const pngPath = resolve(root, 'store-assets/screenshot-1280x800.png');
const jpgPath = resolve(root, 'store-assets/screenshot-1280x800.jpg');
const context = await chromium.launchPersistentContext(profilePath, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});

try {
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.evaluate(async () => {
    await globalThis.chrome.storage.local.set({
      pushrow_state: {
        schemaVersion: 1,
        destinations: [
          {
            id: 'store-fixture',
            name: 'Outbound prospects',
            url: 'https://api.clay.com/v3/sources/webhook/example-destination',
            auth: { headerName: 'x-clay-webhook-auth', value: 'placeholder-not-a-secret' },
            createdAt: '2026-07-15T12:00:00.000Z',
            updatedAt: '2026-07-15T12:00:00.000Z',
          },
        ],
        rules: [],
      },
      pushrow_activity: {
        schemaVersion: 1,
        limit: 10,
        entries: [],
      },
    });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Edit Outbound prospects' }).click();
  await page.getByRole('dialog', { name: 'Edit destination' }).waitFor();
  await page.screenshot({ path: pngPath, type: 'png' });

  const pngData = await readFile(pngPath, 'base64');
  const jpegPage = await context.newPage();
  await jpegPage.setContent(
    `<style>html,body{margin:0;width:1280px;height:800px;overflow:hidden}img{display:block;width:1280px;height:800px}</style><img alt="" src="data:image/png;base64,${pngData}">`,
  );
  await jpegPage.locator('img').evaluate((image) => image.decode());
  await jpegPage.screenshot({ path: jpgPath, type: 'jpeg', quality: 92 });
  stdout.write('Captured current 1280x800 store screenshot.\n');
} finally {
  await context.close();
  await rm(profilePath, { recursive: true, force: true });
}

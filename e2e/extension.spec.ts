import { chromium, expect, test } from '@playwright/test';
import path from 'node:path';

const extensionPath = path.resolve('.output/chrome-mv3');

// Playwright requires its fixture argument to use object destructuring.
// eslint-disable-next-line no-empty-pattern
test('loads the MV3 extension and manages local routing settings', async ({}, testInfo) => {
  const context = await chromium.launchPersistentContext(testInfo.outputPath('profile'), {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await expect(page.getByRole('heading', { name: 'Posthook' })).toBeVisible();
    await page.evaluate(async () => {
      const localStorage = (
        globalThis as typeof globalThis & {
          chrome: { storage: { local: { set(value: unknown): Promise<void> } } };
        }
      ).chrome.storage.local;
      await localStorage.set({
        posthook_state: {
          schemaVersion: 1,
          destinations: [
            {
              id: 'destination-fixture',
              name: 'Fixture table',
              url: 'https://api.clay.com/v3/sources/webhook/example-test-id',
              auth: null,
              createdAt: '2026-07-14T00:00:00.000Z',
              updatedAt: '2026-07-14T00:00:00.000Z',
            },
          ],
          rules: [],
        },
      });
    });
    await page.reload();

    await expect(page.getByText('Fixture table')).toBeVisible();
    await page.getByRole('button', { name: /Routing rules/ }).click();
    await page.getByLabel('Rule name').fill('LinkedIn people');
    await page.getByRole('button', { name: 'Save routing rule' }).click();
    await expect(page.getByText('LinkedIn people', { exact: true })).toBeVisible();

    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete all local data' }).click();
    await page.getByRole('button', { name: /Destinations/ }).click();
    await expect(page.getByText('No destinations yet')).toBeVisible();
  } finally {
    await context.close();
  }
});

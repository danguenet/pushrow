import { chromium, expect, test } from '@playwright/test';
import path from 'node:path';

const extensionPath = path.resolve('dist');

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

    await expect(page.getByRole('heading', { name: 'Push Row' })).toBeVisible();
    await page.evaluate(async () => {
      const localStorage = (
        globalThis as typeof globalThis & {
          chrome: { storage: { local: { set(value: unknown): Promise<void> } } };
        }
      ).chrome.storage.local;
      await localStorage.set({
        pushrow_state: {
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
        pushrow_activity: {
          schemaVersion: 1,
          limit: 10,
          entries: [
            {
              id: 'activity-fixture',
              attemptedAt: '2026-07-15T12:00:00.000Z',
              destination: { id: 'destination-fixture', name: 'Fixture table' },
              request: {
                source: 'linkedin',
                url: 'https://www.linkedin.com/in/example-person',
                record_id: null,
                object_type: 'person',
              },
              result: { ok: true, status: 204 },
            },
          ],
        },
      });
    });
    await page.reload();

    await expect(page.getByText('Fixture table')).toBeVisible();
    await page.getByRole('button', { name: 'Edit Fixture table' }).click();
    await expect(page.getByText('Clay connection', { exact: true })).toBeVisible();
    await expect(page.getByText('No authentication')).toBeVisible();
    await expect(page.getByText('x-clay-webhook-auth')).toHaveCount(0);
    await page.getByRole('button', { name: 'Edit connection details' }).click();
    await expect(page.getByLabel('Webhook URL')).toHaveValue(
      'https://api.clay.com/v3/sources/webhook/example-test-id',
    );
    await page.waitForTimeout(200);
    const modal = page.getByRole('dialog', { name: 'Edit destination' });
    await modal.screenshot({ path: testInfo.outputPath('destination-editor.png') });
    expect(await modal.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );

    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('tab', { name: /Routing rules/ }).click();
    await page.getByRole('button', { name: 'Add routing rule' }).click();
    await page.getByLabel('Rule name').fill('LinkedIn people');
    await page.getByRole('button', { name: 'Save routing rule' }).click();
    await expect(page.getByText('LinkedIn people', { exact: true })).toBeVisible();

    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('tab', { name: /Activity/ }).click();
    await expect(page.getByText('HTTP 204')).toBeVisible();
    await page.getByText('Fixture table', { exact: true }).click();
    await expect(page.getByText(/example-person/)).toBeVisible();
    await page.getByLabel('Keep latest').fill('1');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('Activity will keep the latest 1 sends.')).toBeVisible();
    await page.getByRole('button', { name: 'Clear activity' }).click();
    await expect(page.getByText('No sends recorded yet')).toBeVisible();

    await page.getByRole('tab', { name: /Data & privacy/ }).click();
    await page.getByRole('button', { name: 'Delete all local data' }).click();
    await page.getByRole('tab', { name: /Destinations/ }).click();
    await expect(page.getByText('No destinations yet')).toBeVisible();

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popup.getByRole('heading', { name: 'Add your first Clay table' })).toBeVisible();
  } finally {
    await context.close();
  }
});

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const extensionPath = resolve(root, 'dist');
const profilePath = await mkdtemp(join(tmpdir(), 'pushrow-popup-shot-'));
const popupPath = join(profilePath, 'popup.png');
const pngPath = resolve(root, 'store-assets/popup-screenshot-1280x800.png');
const jpgPath = resolve(root, 'store-assets/popup-screenshot-1280x800.jpg');
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
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await popupPage.evaluate(async () => {
    await globalThis.chrome.storage.local.set({
      pushrow_state: {
        schemaVersion: 1,
        destinations: [
          {
            id: 'outbound-prospects',
            name: 'Outbound prospects',
            url: 'https://api.clay.com/v3/sources/webhook/example-destination',
            auth: null,
            createdAt: '2026-07-15T12:00:00.000Z',
            updatedAt: '2026-07-15T12:00:00.000Z',
          },
          {
            id: 'crm-enrichment',
            name: 'CRM enrichment',
            url: 'https://api.clay.com/v3/sources/webhook/example-enrichment',
            auth: null,
            createdAt: '2026-07-15T12:00:00.000Z',
            updatedAt: '2026-07-15T12:00:00.000Z',
          },
        ],
        rules: [
          {
            id: 'linkedin-people',
            name: 'LinkedIn people',
            destinationId: 'outbound-prospects',
            enabled: true,
            priority: 0,
            matcher: { kind: 'guided', source: 'linkedin', objectType: 'person' },
          },
        ],
      },
      pushrow_activity: { schemaVersion: 1, limit: 10, entries: [] },
    });
  });
  await popupPage.addInitScript(() => {
    globalThis.chrome.tabs.query = async () => [
      { id: 1, url: 'https://www.linkedin.com/in/example-person' },
    ];
  });
  await popupPage.reload();
  await popupPage.getByText('Recommended', { exact: true }).waitFor();
  await popupPage.locator('.popup-shell').screenshot({ path: popupPath, type: 'png' });

  const popupData = await readFile(popupPath, 'base64');
  const canvasPage = await context.newPage();
  await canvasPage.setContent(`
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 1280px; height: 800px; overflow: hidden; }
      body { background: #e8ebf1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #172033; }
      .browser { position: relative; width: 100%; height: 100%; background: #f7f8fc; }
      .chrome { height: 92px; background: #fff; border-bottom: 1px solid #dfe3ec; box-shadow: 0 1px 6px rgba(23,32,51,.08); }
      .tabs { height: 38px; display: flex; align-items: end; padding-left: 18px; background: #eef1f6; }
      .tab { width: 252px; height: 31px; padding: 8px 14px; border-radius: 10px 10px 0 0; background: #fff; color: #4f5a70; font-size: 12px; }
      .toolbar { height: 54px; display: flex; align-items: center; gap: 14px; padding: 0 18px; }
      .nav { color: #778196; font-size: 21px; letter-spacing: 7px; }
      .address { flex: 1; height: 36px; display: flex; align-items: center; padding: 0 16px; border-radius: 18px; background: #f1f3f7; color: #536078; font-size: 13px; }
      .extension-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: #e9edff; color: #3157d5; font-weight: 800; }
      .page { padding: 54px 70px; }
      .profile { display: flex; gap: 28px; max-width: 780px; padding: 34px; border: 1px solid #e1e5ee; border-radius: 18px; background: #fff; }
      .avatar { width: 112px; height: 112px; border-radius: 56px; background: #dfe4ee; }
      .lines { flex: 1; padding-top: 10px; }
      .line { height: 14px; margin-bottom: 15px; border-radius: 7px; background: #e5e8ef; }
      .line.name { width: 48%; height: 22px; background: #cfd5e1; }
      .line.role { width: 72%; }
      .line.meta { width: 36%; }
      .hint { margin: 34px 0 0 4px; color: #66728a; font-size: 18px; font-weight: 650; }
      .popup { position: absolute; top: 104px; right: 22px; display: block; width: 380px; border-radius: 0 0 14px 14px; box-shadow: 0 18px 55px rgba(23,32,51,.28); }
      .pointer { position: absolute; top: 91px; right: 41px; width: 18px; height: 18px; transform: rotate(45deg); background: #fff; box-shadow: -2px -2px 3px rgba(23,32,51,.05); }
    </style>
    <div class="browser">
      <div class="chrome">
        <div class="tabs"><div class="tab">Example profile</div></div>
        <div class="toolbar">
          <div class="nav">‹ ›</div>
          <div class="address">linkedin.com/in/example-person</div>
          <div class="extension-icon">P</div>
        </div>
      </div>
      <div class="page">
        <div class="profile">
          <div class="avatar"></div>
          <div class="lines">
            <div class="line name"></div>
            <div class="line role"></div>
            <div class="line meta"></div>
          </div>
        </div>
        <div class="hint">Open a record, choose a Clay table, and send.</div>
      </div>
      <div class="pointer"></div>
      <img class="popup" alt="Push Row extension popup" src="data:image/png;base64,${popupData}">
    </div>
  `);
  await canvasPage.locator('.popup').evaluate((image) => image.decode());
  await canvasPage.screenshot({ path: pngPath, type: 'png' });
  await canvasPage.screenshot({ path: jpgPath, type: 'jpeg', quality: 92 });
  stdout.write('Captured current 1280x800 popup store screenshot.\n');
} finally {
  await context.close();
  await rm(profilePath, { recursive: true, force: true });
}

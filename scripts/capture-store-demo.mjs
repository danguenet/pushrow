/* global document, requestAnimationFrame, setTimeout */

import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { env, stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const extensionPath = resolve(root, 'dist');
const outputPath = resolve(root, 'store-assets/push-row-demo.mp4');
const workPath = await mkdtemp(join(tmpdir(), 'pushrow-demo-video-'));
const profilePath = join(workPath, 'profile');
const rawVideoPath = join(workPath, 'push-row-demo.webm');
const encodedVideoPath = join(workPath, 'push-row-demo-encoded.mp4');
const ffmpegPath = env.PUSHROW_FFMPEG || 'ffmpeg';

const sleep = (milliseconds) =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

async function run(command, args) {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', rejectRun);
    child.once('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function installDemoLayer(page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.dataset.demo = 'true';
    style.textContent = `
      .demo-caption {
        position: fixed; left: 54px; bottom: 48px; z-index: 10000; width: 480px;
        padding: 24px 28px; border: 1px solid rgba(255,255,255,.16); border-radius: 18px;
        color: #fff; background: rgba(23,32,51,.94); box-shadow: 0 18px 55px rgba(23,32,51,.24);
        font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        opacity: 0; transform: translateY(14px); transition: opacity .45s ease, transform .45s ease;
      }
      .demo-caption.visible { opacity: 1; transform: translateY(0); }
      .demo-caption-kicker { margin-bottom: 8px; color: #afc0ff; font-size: 14px; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
      .demo-caption-title { margin: 0; font-size: 29px; line-height: 1.15; letter-spacing: -.025em; }
      .demo-caption-body { margin: 10px 0 0; color: #d9deeb; font-size: 16px; line-height: 1.45; }
      .demo-cursor {
        position: fixed; left: 0; top: 0; z-index: 12000; width: 27px; height: 34px;
        pointer-events: none; opacity: 0; transform: translate(-4px,-3px);
        transition: left .65s cubic-bezier(.22,.8,.25,1), top .65s cubic-bezier(.22,.8,.25,1), opacity .2s ease;
        filter: drop-shadow(0 2px 2px rgba(23,32,51,.3));
      }
      .demo-cursor.visible { opacity: 1; }
      .demo-cursor::before {
        content: ''; display: block; width: 22px; height: 29px; background: #172033;
        clip-path: polygon(0 0, 0 100%, 7px 76%, 12px 100%, 17px 97%, 12px 72%, 24px 72%);
      }
      .demo-click-ring {
        position: fixed; z-index: 11999; width: 34px; height: 34px; margin: -17px;
        border: 3px solid #3157d5; border-radius: 50%; pointer-events: none;
        animation: demo-click .55s ease-out forwards;
      }
      @keyframes demo-click { from { opacity: .8; transform: scale(.4); } to { opacity: 0; transform: scale(1.65); } }
      .demo-transition {
        position: fixed; inset: 0; z-index: 20000; display: grid; place-items: center;
        overflow: hidden; color: #172033; background: #f5f7fb; opacity: 0; pointer-events: none;
        transition: opacity .55s ease;
        font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      }
      .demo-transition::before,
      .demo-transition::after { content: ''; position: absolute; border-radius: 50%; }
      .demo-transition::before { top: -240px; right: -150px; width: 650px; height: 650px; background: #e4e9ff; }
      .demo-transition::after { bottom: -250px; left: -190px; width: 570px; height: 570px; background: #e8ecf8; }
      .demo-transition.visible { opacity: 1; }
      .demo-transition-card { position: relative; z-index: 1; max-width: 1240px; padding: 70px; text-align: center; }
      .demo-transition-logo { display: block; width: 78px; height: 78px; margin: 0 auto 20px; border-radius: 20px; box-shadow: 0 14px 34px rgba(49,87,213,.18); }
      .demo-transition-kicker { margin-bottom: 24px; color: #3157d5; font-size: 17px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
      .demo-transition h1 { margin: 0; font-size: 72px; line-height: 1.05; letter-spacing: -.045em; }
      .demo-transition p { margin: 24px auto 0; max-width: 1050px; color: #58647b; font-size: 29px; line-height: 1.4; }
      .demo-transition-line { width: 120px; height: 7px; margin: 34px auto 0; border-radius: 4px; background: #3157d5; }
      .demo-badges { display: flex; justify-content: center; gap: 12px; margin-top: 32px; }
      .demo-badge { padding: 10px 17px; border: 1px solid #d9deea; border-radius: 999px; background: #fff; color: #4f5b72; font-size: 16px; font-weight: 700; }
      .demo-facts { display: flex; justify-content: center; gap: 28px; margin-top: 34px; color: #66728a; font-size: 16px; font-weight: 650; }
    `;
    document.head.append(style);

    const caption = document.createElement('section');
    caption.className = 'demo-caption';
    caption.innerHTML =
      '<div class="demo-caption-kicker"></div><h2 class="demo-caption-title"></h2><p class="demo-caption-body"></p>';
    document.body.append(caption);

    const cursor = document.createElement('div');
    cursor.className = 'demo-cursor';
    document.body.append(cursor);

    const transition = document.createElement('section');
    transition.className = 'demo-transition';
    document.body.append(transition);
  });
}

async function showCaption(page, kicker, title, body) {
  await page.evaluate(
    ([nextKicker, nextTitle, nextBody]) => {
      const caption = document.querySelector('.demo-caption');
      caption.classList.remove('visible');
      caption.querySelector('.demo-caption-kicker').textContent = nextKicker;
      caption.querySelector('.demo-caption-title').textContent = nextTitle;
      caption.querySelector('.demo-caption-body').textContent = nextBody;
      requestAnimationFrame(() => caption.classList.add('visible'));
    },
    [kicker, title, body],
  );
}

async function hideCaption(page) {
  await page.evaluate(() => document.querySelector('.demo-caption')?.classList.remove('visible'));
}

async function showTransition(page, content, duration = 3300) {
  await page.evaluate((html) => {
    const transition = document.querySelector('.demo-transition');
    transition.innerHTML = `<div class="demo-transition-card">${html}</div>`;
    transition.classList.add('visible');
  }, content);
  await sleep(duration);
}

async function hideTransition(page) {
  await page.evaluate(() =>
    document.querySelector('.demo-transition')?.classList.remove('visible'),
  );
  await sleep(700);
}

async function moveCursor(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Could not locate demo target.');
  const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  await page.evaluate(({ x, y }) => {
    const cursor = document.querySelector('.demo-cursor');
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    cursor.classList.add('visible');
  }, point);
  await sleep(850);
  return point;
}

async function clickWithCursor(page, locator) {
  const point = await moveCursor(page, locator);
  await page.evaluate(({ x, y }) => {
    const ring = document.createElement('div');
    ring.className = 'demo-click-ring';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    document.body.append(ring);
    setTimeout(() => ring.remove(), 650);
  }, point);
  await locator.click();
  await sleep(650);
}

async function installPopupScene(page) {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      'afterbegin',
      `<div class="demo-browser-scene">
        <div class="demo-browser-tabs"><div>Example LinkedIn profile</div></div>
        <div class="demo-browser-toolbar">
          <span class="demo-browser-nav">‹</span><span class="demo-browser-nav">›</span>
          <div class="demo-address">linkedin.com/in/example-person</div>
          <div class="demo-extension-button"><img src="/icon-48.png" alt=""></div>
        </div>
        <div class="demo-record-card">
          <div class="demo-avatar"></div>
          <div class="demo-record-lines"><b></b><span></span><i></i></div>
        </div>
        <div class="demo-source-row"><span>LinkedIn</span><span>HubSpot</span><span>Salesforce</span><span>Attio</span></div>
      </div>`,
    );
    const style = document.createElement('style');
    style.textContent = `
      body { width: 1920px !important; min-height: 1080px !important; overflow: hidden !important; background: #f4f6fb !important; }
      .popup-shell { position: fixed; z-index: 100; top: 142px; right: 120px; width: 380px; max-height: 850px; overflow: hidden; border-radius: 0 0 15px 15px; box-shadow: 0 24px 70px rgba(23,32,51,.30); }
      .demo-browser-scene { position: fixed; inset: 0; z-index: 0; color: #172033; background: #f6f7fb; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
      .demo-browser-tabs { height: 52px; display: flex; align-items: end; padding-left: 28px; background: #e9edf4; }
      .demo-browser-tabs div { width: 330px; height: 39px; padding: 11px 18px; border-radius: 12px 12px 0 0; background: #fff; color: #536078; font-size: 14px; }
      .demo-browser-toolbar { height: 72px; display: flex; align-items: center; gap: 14px; padding: 0 28px; border-bottom: 1px solid #dfe3ec; background: #fff; box-shadow: 0 2px 9px rgba(23,32,51,.06); }
      .demo-browser-nav { color: #7b8496; font-size: 28px; }
      .demo-address { flex: 1; height: 42px; display: flex; align-items: center; padding: 0 20px; border-radius: 21px; background: #f0f2f6; color: #536078; font-size: 15px; }
      .demo-extension-button { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 11px; background: #e9edff; }
      .demo-extension-button img { width: 27px; height: 27px; border-radius: 7px; }
      .demo-record-card { position: absolute; top: 205px; left: 105px; display: flex; gap: 36px; width: 920px; padding: 50px; border: 1px solid #dfe4ee; border-radius: 22px; background: #fff; }
      .demo-avatar { width: 140px; height: 140px; border-radius: 70px; background: #dce2ed; }
      .demo-record-lines { flex: 1; padding-top: 17px; }
      .demo-record-lines b,.demo-record-lines span,.demo-record-lines i { display: block; height: 17px; margin-bottom: 20px; border-radius: 9px; background: #e1e5ed; }
      .demo-record-lines b { width: 50%; height: 27px; background: #cbd2df; }
      .demo-record-lines span { width: 78%; }
      .demo-record-lines i { width: 38%; }
      .demo-source-row { position: absolute; top: 478px; left: 105px; display: flex; gap: 12px; }
      .demo-source-row span { padding: 10px 16px; border: 1px solid #d9deea; border-radius: 999px; color: #5d6880; background: #fff; font-size: 14px; font-weight: 700; }
    `;
    document.head.append(style);
  });
}

let context;
try {
  context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: join(workPath, 'recordings'), size: { width: 1920, height: 1080 } },
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  const video = page.video();
  if (!video) throw new Error('Playwright video recording did not start.');

  await page.addInitScript(() => {
    const originalSendMessage = globalThis.chrome?.runtime?.sendMessage?.bind(
      globalThis.chrome.runtime,
    );
    if (globalThis.chrome?.permissions) {
      globalThis.chrome.permissions.request = async () => true;
    }
    if (globalThis.chrome?.tabs) {
      globalThis.chrome.tabs.query = async () => [
        { id: 1, url: 'https://www.linkedin.com/in/example-person' },
      ];
    }
    if (originalSendMessage) {
      globalThis.chrome.runtime.sendMessage = async (message) => {
        if (message?.type === 'pushrow:send-record') {
          await new Promise((resolveSend) => setTimeout(resolveSend, 850));
          return { ok: true, status: 204 };
        }
        return originalSendMessage(message);
      };
    }
  });

  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.evaluate(async () => globalThis.chrome.storage.local.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Add destination' }).waitFor();
  await installDemoLayer(page);

  await showTransition(
    page,
    `<img class="demo-transition-logo" src="/icon-128.png" alt="">
     <div class="demo-transition-kicker">Push Row</div>
     <h1>Bring Clay workflows into your browsing session</h1>
     <p>Send LinkedIn and CRM records to the right Clay table with one quick, focused click.</p>
     <div class="demo-transition-line"></div>`,
    3800,
  );
  await hideTransition(page);

  await showCaption(
    page,
    'Step 1',
    'Connect a Clay table once',
    'Give the destination a clear name and paste its Clay webhook URL.',
  );
  await sleep(1600);
  await clickWithCursor(page, page.getByRole('button', { name: 'Add destination' }));
  await sleep(900);

  const nameInput = page.getByLabel('Name');
  await moveCursor(page, nameInput);
  await nameInput.fill('');
  await nameInput.pressSequentially('Outbound prospects', { delay: 72 });
  await sleep(650);
  const webhookInput = page.getByLabel('Paste a Clay webhook URL or cURL');
  await moveCursor(page, webhookInput);
  await webhookInput.pressSequentially(
    'https://api.clay.com/v3/sources/webhook/outbound-prospects',
    { delay: 28 },
  );
  await webhookInput.press('Tab');
  await page.getByText('Clay connection ready').waitFor();
  await sleep(1300);

  await clickWithCursor(page, page.getByRole('button', { name: 'Save destination' }));
  await page.getByText('Outbound prospects is ready to receive records.').waitFor();
  await showCaption(
    page,
    'Ready',
    'Your Clay destination is connected',
    'Push Row keeps the destination and optional routing rules in local Chrome storage.',
  );
  await sleep(2600);
  await hideCaption(page);

  await showTransition(
    page,
    `<div class="demo-transition-kicker">Ready to send</div>
     <h1>Stay in the record. Send it to Clay.</h1>
     <p>No copying fields. No page scraping. You choose the destination and the moment it sends.</p>
     <div class="demo-transition-line"></div>`,
    3000,
  );

  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByText('Choose a Clay table', { exact: true }).waitFor();
  await installDemoLayer(page);
  await installPopupScene(page);
  await page.evaluate(() => document.querySelector('.demo-transition')?.classList.add('visible'));
  await sleep(500);
  await hideTransition(page);

  await showCaption(
    page,
    'Step 2',
    'Open Push Row on any supported record',
    'It recognizes LinkedIn, HubSpot, Salesforce, and Attio records from the active URL.',
  );
  await sleep(2400);

  const destinationOption = page.getByRole('button', { name: /Outbound prospects/ });
  await clickWithCursor(page, destinationOption);
  await showCaption(
    page,
    'Deliberate by design',
    'Choose exactly where the record goes',
    'Only the four URL-derived record fields shown in the popup are included.',
  );
  await sleep(1700);

  await clickWithCursor(page, page.getByRole('button', { name: 'Send to Outbound prospects' }));
  await page.getByText('Sent to Outbound prospects').waitFor();
  await showCaption(
    page,
    'Done',
    'Sent to Clay in one click',
    'Turn manual research into fast, repeatable outbound workflows without leaving the record.',
  );
  await sleep(3300);
  await hideCaption(page);

  await showTransition(
    page,
    `<img class="demo-transition-logo" src="/icon-128.png" alt="">
     <div class="demo-transition-kicker">Push Row</div>
     <h1>Keep research moving into Clay</h1>
     <p>Send the next LinkedIn or CRM record without breaking your browsing flow.</p>
     <div class="demo-badges"><span class="demo-badge">LinkedIn</span><span class="demo-badge">HubSpot</span><span class="demo-badge">Salesforce</span><span class="demo-badge">Attio</span></div>
     <div class="demo-facts"><span>URL only</span><span>Manual sends</span><span>Local settings</span><span>No analytics</span></div>`,
    5200,
  );

  await page.close();
  await video.saveAs(rawVideoPath);
  await context.close();
  context = undefined;

  await access(rawVideoPath);
  await run(ffmpegPath, [
    '-y',
    '-i',
    rawVideoPath,
    '-ss',
    '0.55',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    encodedVideoPath,
  ]);
  await run(ffmpegPath, [
    '-y',
    '-i',
    encodedVideoPath,
    '-filter_complex',
    '[0:v][0:v]freezeframes=first=554:last=568:replace=549,format=yuv420p[v]',
    '-map',
    '[v]',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
  stdout.write(`Created ${outputPath}\n`);
} finally {
  if (context) await context.close();
  await rm(workPath, { recursive: true, force: true });
}

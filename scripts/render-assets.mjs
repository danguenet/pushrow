import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const browser = await chromium.launch({ headless: true });

async function renderSvg(sourcePath, outputPath, width, height, type, omitBackground) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  try {
    await page.goto(pathToFileURL(resolve(root, sourcePath)).href);
    await page.evaluate(
      ([nextWidth, nextHeight]) => {
        const svg = globalThis.document.documentElement;
        svg.setAttribute('width', String(nextWidth));
        svg.setAttribute('height', String(nextHeight));
        svg.style.width = `${nextWidth}px`;
        svg.style.height = `${nextHeight}px`;
      },
      [width, height],
    );
    await page.screenshot({
      path: resolve(root, outputPath),
      type,
      omitBackground,
      ...(type === 'jpeg' ? { quality: 92 } : {}),
    });
  } finally {
    await page.close();
  }
}

try {
  for (const size of [16, 32, 48, 128]) {
    await renderSvg(
      'assets/icon-source.svg',
      `src/public/icon-${size}.png`,
      size,
      size,
      'png',
      true,
    );
  }
  await copyFile(
    resolve(root, 'src/public/icon-128.png'),
    resolve(root, 'store-assets/icon-128.png'),
  );

  for (const type of ['png', 'jpeg']) {
    const extension = type === 'jpeg' ? 'jpg' : type;
    await renderSvg(
      'store-assets/promo-440x280.svg',
      `store-assets/promo-440x280.${extension}`,
      440,
      280,
      type,
      false,
    );
    await renderSvg(
      'store-assets/marquee-1400x560.svg',
      `store-assets/marquee-1400x560.${extension}`,
      1400,
      560,
      type,
      false,
    );
  }

  await renderSvg(
    'store-assets/social-preview-1280x640.svg',
    'store-assets/social-preview-1280x640.png',
    1280,
    640,
    'png',
    false,
  );
} finally {
  await browser.close();
}

import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { stdout } from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { resolveExtensionReference } from './extension-reference.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'dist');
const errors = [];

async function exists(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

async function requireReference(value, source) {
  if (!value || typeof value !== 'string') {
    errors.push(`${source} is missing.`);
    return;
  }
  const { path, resolvedPath } = resolveExtensionReference(dist, value);
  if (!resolvedPath) {
    errors.push(`${source} references a path outside dist: ${path}.`);
    return;
  }
  if (!(await exists(resolvedPath))) errors.push(`${source} references missing ${path}.`);
}

const manifestPath = resolve(dist, 'manifest.json');
if (!(await exists(manifestPath))) {
  throw new Error('dist/manifest.json does not exist. Run npm run build first.');
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (manifest.version !== packageJson.version) {
  errors.push(
    `Manifest version ${manifest.version} does not match package version ${packageJson.version}.`,
  );
}
await requireReference(manifest.background?.service_worker, 'background.service_worker');
await requireReference(manifest.action?.default_popup, 'action.default_popup');
await requireReference(manifest.options_ui?.page, 'options_ui.page');
for (const [size, path] of Object.entries(manifest.icons ?? {})) {
  await requireReference(path, `icons.${size}`);
}

for (const htmlName of ['popup.html', 'options.html']) {
  const htmlPath = resolve(dist, htmlName);
  if (!(await exists(htmlPath))) continue;
  const html = await readFile(htmlPath, 'utf8');
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const reference = match[1];
    if (!reference || /^(?:https?:|data:|#)/.test(reference)) continue;
    await requireReference(reference, htmlName);
  }
}

if (JSON.stringify(manifest.permissions) !== JSON.stringify(['activeTab', 'storage'])) {
  errors.push('Manifest permissions differ from activeTab and storage.');
}
if (
  JSON.stringify(manifest.optional_host_permissions) !== JSON.stringify(['https://api.clay.com/*'])
) {
  errors.push('Manifest optional host permissions differ from the Clay API origin.');
}
if (manifest.content_scripts) errors.push('The extension must not contain content scripts.');

const files = await walk(dist);
const relativeFiles = files.map((path) => relative(dist, path).replaceAll('\\', '/'));
for (const required of ['manifest.json', 'background.js', 'popup.html', 'options.html']) {
  if (!relativeFiles.includes(required)) errors.push(`Required artifact ${required} is missing.`);
}
for (const file of relativeFiles) {
  if (['.ts', '.tsx', '.map'].includes(extname(file)))
    errors.push(`Source artifact ${file} shipped.`);
  if (file === 'icon-source.svg' || file.startsWith('store-assets/') || file.startsWith('tests/')) {
    errors.push(`Non-runtime artifact ${file} shipped.`);
  }
}
const runtimeIcons = relativeFiles.filter((file) => /^icon-\d+\.png$/.test(file)).sort();
const expectedIcons = ['icon-128.png', 'icon-16.png', 'icon-32.png', 'icon-48.png'];
if (JSON.stringify(runtimeIcons) !== JSON.stringify(expectedIcons)) {
  errors.push(`Unexpected runtime icons: ${runtimeIcons.join(', ') || 'none'}.`);
}

if (errors.length)
  throw new Error(`Extension package validation failed:\n- ${errors.join('\n- ')}`);
stdout.write(`Validated ${relativeFiles.length} files in dist/.\n`);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { resolveExtensionReference } from './extension-reference.mjs';

const dist = resolve('/tmp/pushrow-dist');

test('resolves extension references inside the package directory', () => {
  expectInside('popup.html?cache=1', 'popup.html');
  expectInside('/assets/popup.js#entry', 'assets/popup.js');
});

test('rejects extension references that escape the package directory', () => {
  assert.equal(resolveExtensionReference(dist, '../private.txt').resolvedPath, null);
  assert.equal(resolveExtensionReference(dist, 'assets/../../private.txt').resolvedPath, null);
});

function expectInside(reference, expectedPath) {
  const result = resolveExtensionReference(dist, reference);
  assert.equal(result.path, expectedPath);
  assert.equal(result.resolvedPath, resolve(dist, expectedPath));
}

import { isAbsolute, relative, resolve, sep } from 'node:path';

export function extensionPath(value) {
  return value.replace(/^\//, '').split(/[?#]/, 1)[0];
}

export function resolveExtensionReference(directory, value) {
  const path = extensionPath(value);
  const resolvedPath = resolve(directory, path);
  const pathFromDirectory = relative(directory, resolvedPath);
  const escapesDirectory =
    pathFromDirectory === '..' ||
    pathFromDirectory.startsWith(`..${sep}`) ||
    isAbsolute(pathFromDirectory);
  return { path, resolvedPath: escapesDirectory ? null : resolvedPath };
}

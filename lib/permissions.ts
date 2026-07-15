import { browser } from 'wxt/browser';
import { CLAY_ORIGIN_PATTERN } from './constants';

export function requestClayPermission(): Promise<boolean> {
  return browser.permissions.request({ origins: [CLAY_ORIGIN_PATTERN] });
}

export function hasClayPermission(): Promise<boolean> {
  return browser.permissions.contains({ origins: [CLAY_ORIGIN_PATTERN] });
}

export function revokeClayPermission(): Promise<boolean> {
  return browser.permissions.remove({ origins: [CLAY_ORIGIN_PATTERN] });
}

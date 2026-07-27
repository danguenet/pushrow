import { browser } from 'wxt/browser';
import { STORAGE_KEY } from '@/shared/constants';
import { normalizeAppState } from '@/shared/state/app-state';
import type { AppState } from '@/shared/types';

export async function protectLocalStorage(): Promise<void> {
  await browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

export async function getState(): Promise<AppState> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return normalizeAppState(result[STORAGE_KEY]);
}

export async function saveState(state: AppState): Promise<AppState> {
  const normalized = normalizeAppState(state);
  await browser.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

export async function clearState(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}

export function subscribeState(callback: (state: AppState) => void): () => void {
  const listener = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      callback(normalizeAppState(changes[STORAGE_KEY].newValue));
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

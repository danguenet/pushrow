import { browser } from 'wxt/browser';
import { ACTIVITY_STORAGE_KEY } from '@/shared/constants';
import {
  EMPTY_ACTIVITY_STATE,
  normalizeActivityLimit,
  normalizeActivityState,
} from '@/shared/state/activity-state';
import type { ActivityEntry, ActivityState } from '@/shared/types';

export async function getActivityState(): Promise<ActivityState> {
  const result = await browser.storage.local.get(ACTIVITY_STORAGE_KEY);
  return normalizeActivityState(result[ACTIVITY_STORAGE_KEY]);
}

async function saveActivityState(state: ActivityState): Promise<ActivityState> {
  const normalized = normalizeActivityState(state);
  await browser.storage.local.set({ [ACTIVITY_STORAGE_KEY]: normalized });
  return normalized;
}

export async function appendActivityEntry(entry: ActivityEntry): Promise<ActivityState> {
  const state = await getActivityState();
  if (state.limit === 0) return state;
  return saveActivityState({ ...state, entries: [entry, ...state.entries] });
}

export async function setActivityLimit(limit: number): Promise<ActivityState> {
  const state = await getActivityState();
  return saveActivityState({ ...state, limit: normalizeActivityLimit(limit) });
}

export async function clearActivity(): Promise<ActivityState> {
  const state = await getActivityState();
  return saveActivityState({ ...state, entries: [] });
}

export async function resetActivity(): Promise<ActivityState> {
  await browser.storage.local.remove(ACTIVITY_STORAGE_KEY);
  return structuredClone(EMPTY_ACTIVITY_STATE);
}

export function subscribeActivityState(callback: (state: ActivityState) => void): () => void {
  const listener = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => {
    if (areaName === 'local' && changes[ACTIVITY_STORAGE_KEY]) {
      callback(normalizeActivityState(changes[ACTIVITY_STORAGE_KEY].newValue));
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

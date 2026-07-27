import { browser } from 'wxt/browser';
import { ACTIVITY_STORAGE_KEY, STORAGE_KEY } from '@/shared/constants';
import { EMPTY_ACTIVITY_STATE } from '@/shared/state/activity-state';
import { EMPTY_STATE } from '@/shared/state/app-state';
import type { ActivityState, AppState } from '@/shared/types';

export async function resetAllLocalData(): Promise<{
  state: AppState;
  activity: ActivityState;
}> {
  await browser.storage.local.remove([STORAGE_KEY, ACTIVITY_STORAGE_KEY]);
  return {
    state: structuredClone(EMPTY_STATE),
    activity: structuredClone(EMPTY_ACTIVITY_STATE),
  };
}

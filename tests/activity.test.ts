import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import {
  appendActivityEntry,
  clearActivity,
  getActivityState,
  resetActivity,
  setActivityLimit,
} from '@/platform/storage/activity';
import { ACTIVITY_STORAGE_KEY } from '@/shared/constants';
import type { ActivityEntry } from '@/shared/types';

function entry(id: string, attemptedAt: string): ActivityEntry {
  return {
    id,
    attemptedAt,
    destination: { id: 'destination', name: 'Prospects' },
    request: {
      source: 'linkedin',
      url: `https://www.linkedin.com/in/${id}`,
      record_id: null,
      object_type: 'person',
    },
    result: { ok: true, status: 204 },
  };
}

describe('local activity storage', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  it('defaults to retaining the latest 10 sends', async () => {
    expect(await getActivityState()).toMatchObject({ schemaVersion: 1, limit: 10, entries: [] });
  });

  it('keeps newest entries within the configured bound', async () => {
    await setActivityLimit(2);
    await appendActivityEntry(entry('first', '2026-07-15T10:00:00.000Z'));
    await appendActivityEntry(entry('third', '2026-07-15T12:00:00.000Z'));
    await appendActivityEntry(entry('second', '2026-07-15T11:00:00.000Z'));

    expect((await getActivityState()).entries.map(({ id }) => id)).toEqual(['third', 'second']);
  });

  it('turns logging off at zero and clears retained entries', async () => {
    await appendActivityEntry(entry('existing', '2026-07-15T10:00:00.000Z'));
    await setActivityLimit(0);
    await appendActivityEntry(entry('ignored', '2026-07-15T11:00:00.000Z'));

    expect(await getActivityState()).toMatchObject({ limit: 0, entries: [] });
  });

  it('caps retention and stored entries at 100', async () => {
    await browser.storage.local.set({
      [ACTIVITY_STORAGE_KEY]: {
        limit: 500,
        entries: Array.from({ length: 101 }, (_, index) =>
          entry(`entry-${index}`, new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString()),
        ),
      },
    });

    expect(await getActivityState()).toMatchObject({ limit: 100 });
    expect((await getActivityState()).entries).toHaveLength(100);
  });

  it('clears entries without changing retention', async () => {
    await setActivityLimit(25);
    await appendActivityEntry(entry('existing', '2026-07-15T10:00:00.000Z'));
    await clearActivity();

    expect(await getActivityState()).toMatchObject({ limit: 25, entries: [] });
  });

  it('removes the activity key when all local data is reset', async () => {
    await appendActivityEntry(entry('existing', '2026-07-15T10:00:00.000Z'));
    await resetActivity();

    expect((await browser.storage.local.get(ACTIVITY_STORAGE_KEY))[ACTIVITY_STORAGE_KEY]).toBe(
      undefined,
    );
    expect(await getActivityState()).toEqual({ schemaVersion: 1, limit: 10, entries: [] });
  });

  it('sanitizes persisted entries to the documented activity shape', async () => {
    await browser.storage.local.set({
      [ACTIVITY_STORAGE_KEY]: {
        limit: 10,
        entries: [
          {
            ...entry('safe', '2026-07-15T10:00:00.000Z'),
            webhookUrl: 'https://api.clay.com/secret',
            auth: { value: 'secret' },
          },
        ],
      },
    });

    expect((await getActivityState()).entries[0]).toEqual(
      entry('safe', '2026-07-15T10:00:00.000Z'),
    );
  });
});

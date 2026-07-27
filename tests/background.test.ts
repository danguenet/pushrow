import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { upsertDestination } from '@/background/configuration';
import { sendRecord } from '@/background/send-record';
import { getActivityState } from '@/platform/storage/activity';
import type { Destination, SendRecordMessage } from '@/shared/types';

const destination: Destination = {
  id: 'destination',
  name: 'Prospects',
  url: 'https://api.clay.com/v3/sources/webhook/example-test-id',
  auth: { headerName: 'x-clay-webhook-auth', value: 'local-test-secret' },
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
};

const message: SendRecordMessage = {
  type: 'pushrow:send-record',
  destinationId: destination.id,
  record: {
    source: 'linkedin',
    url: 'https://www.linkedin.com/in/example-person',
    record_id: null,
    object_type: 'person',
  },
};

describe('background send activity', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await upsertDestination(destination);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('records the sanitized request and HTTP result after sending', async () => {
    const permissions = browser.permissions as unknown as {
      contains(value: unknown): Promise<boolean>;
    };
    vi.spyOn(permissions, 'contains').mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    expect(await sendRecord(message)).toEqual({ ok: true, status: 204 });
    const [activity] = (await getActivityState()).entries;
    expect(activity).toMatchObject({
      destination: { id: 'destination', name: 'Prospects' },
      request: message.record,
      result: { ok: true, status: 204 },
    });
    expect(JSON.stringify(activity)).not.toContain(destination.url);
    expect(JSON.stringify(activity)).not.toContain('local-test-secret');
  });

  it('records permission failures without making a network request', async () => {
    const permissions = browser.permissions as unknown as {
      contains(value: unknown): Promise<boolean>;
    };
    vi.spyOn(permissions, 'contains').mockResolvedValue(false);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    expect(await sendRecord(message)).toEqual({ ok: false, code: 'permission' });
    expect((await getActivityState()).entries[0]?.result).toEqual({
      ok: false,
      code: 'permission',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not retain unvalidated messages', async () => {
    expect(
      await sendRecord({
        ...message,
        record: { ...message.record, object_type: 'company' },
      }),
    ).toEqual({ ok: false, code: 'invalid_message' });
    expect((await getActivityState()).entries).toEqual([]);
  });
});

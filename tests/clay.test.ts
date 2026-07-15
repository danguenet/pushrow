import { describe, expect, it, vi } from 'vitest';
import { postToClay, type Fetcher } from '@/lib/clay';
import type { Destination, PageRecord } from '@/lib/types';

const destination: Destination = {
  id: 'destination',
  name: 'Contacts',
  url: 'https://api.clay.com/v3/sources/webhook/example-test-id',
  auth: { headerName: 'Authorization', value: 'Bearer local-test-token' },
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
};

const record: PageRecord = {
  source: 'linkedin',
  url: 'https://www.linkedin.com/in/jane-doe',
  record_id: null,
  object_type: 'person',
};

describe('postToClay', () => {
  it('sends exactly one JSON POST with the configured auth header', async () => {
    const fetcher = vi.fn<Fetcher>(async () => new Response(null, { status: 204 }));
    await expect(postToClay(destination, record, fetcher)).resolves.toEqual({
      ok: true,
      status: 204,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(destination.url);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify(record));
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer local-test-token');
  });

  it.each([
    [400, 'bad_request'],
    [401, 'auth'],
    [403, 'auth'],
    [404, 'not_found'],
    [429, 'rate_limited'],
    [503, 'server'],
  ] as const)('maps HTTP %s without retrying', async (status, code) => {
    const fetcher = vi.fn<Fetcher>(async () => new Response(null, { status }));
    await expect(postToClay(destination, record, fetcher)).resolves.toEqual({
      ok: false,
      code,
      status,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('maps network errors without retrying', async () => {
    const fetcher = vi.fn<Fetcher>(async () => {
      throw new TypeError('offline');
    });
    await expect(postToClay(destination, record, fetcher)).resolves.toEqual({
      ok: false,
      code: 'network',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('aborts a timed-out request without retrying', async () => {
    const fetcher = vi.fn<Fetcher>(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );
    await expect(postToClay(destination, record, fetcher, 1)).resolves.toEqual({
      ok: false,
      code: 'timeout',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

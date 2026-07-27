import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { handleRuntimeMessage, isRuntimeMessage } from '@/background/messages';
import { registerRuntimeMessageHandler, sendRuntimeMessage } from '@/platform/runtime';
import { getState } from '@/platform/storage/app-state';
import { ACTIVITY_STORAGE_KEY, STORAGE_KEY } from '@/shared/constants';
import type { Destination } from '@/shared/types';

function destination(id: string): Destination {
  return {
    id,
    name: `Destination ${id}`,
    url: `https://api.clay.com/v3/sources/webhook/${id}`,
    auth: null,
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
  };
}

describe('runtime message boundary', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  it('rejects malformed configuration mutation messages', () => {
    expect(isRuntimeMessage({ type: 'pushrow:upsert-destination', destination: null })).toBe(false);
    expect(isRuntimeMessage({ type: 'pushrow:replace-rules', rules: [{}] })).toBe(false);
    expect(isRuntimeMessage({ type: 'pushrow:delete-rule', ruleId: 42 })).toBe(false);
  });

  it('serializes concurrent configuration mutations without losing updates', async () => {
    const first = destination('first');
    const second = destination('second');

    await Promise.all([
      handleRuntimeMessage({ type: 'pushrow:upsert-destination', destination: first }),
      handleRuntimeMessage({ type: 'pushrow:upsert-destination', destination: second }),
    ]);

    expect((await getState()).destinations).toEqual([first, second]);
  });

  it('keeps the Chrome message channel open and responds through the callback', async () => {
    type Listener = (
      message: unknown,
      sender: Browser.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => unknown;
    const onMessage = browser.runtime.onMessage as unknown as {
      addListener(listener: Listener): void;
      removeListener(listener: Listener): void;
    };
    let listener: Listener | undefined;
    vi.spyOn(onMessage, 'addListener').mockImplementation((next) => {
      listener = next;
    });
    const removeListener = vi.spyOn(onMessage, 'removeListener');
    const unregister = registerRuntimeMessageHandler(async () => ({ saved: true }));
    const sendResponse = vi.fn();

    expect(listener?.({}, {} as Browser.runtime.MessageSender, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(sendResponse).toHaveBeenCalledWith({
      marker: 'pushrow:runtime-response',
      ok: true,
      value: { saved: true },
    });

    unregister();
    expect(removeListener).toHaveBeenCalledWith(listener);
  });

  it('unwraps callback responses and preserves background errors', async () => {
    const runtime = browser.runtime as unknown as {
      sendMessage(message: unknown): Promise<unknown>;
    };
    const sendMessage = vi.spyOn(runtime, 'sendMessage');
    sendMessage.mockResolvedValueOnce({
      marker: 'pushrow:runtime-response',
      ok: true,
      value: { schemaVersion: 1, limit: 10, entries: [] },
    });
    await expect(sendRuntimeMessage({ type: 'pushrow:get-activity' })).resolves.toMatchObject({
      limit: 10,
    });

    sendMessage.mockResolvedValueOnce({
      marker: 'pushrow:runtime-response',
      ok: false,
      error: 'storage failed',
    });
    await expect(sendRuntimeMessage({ type: 'pushrow:get-activity' })).rejects.toThrow(
      'storage failed',
    );
  });

  it('removes configuration and activity in one storage operation', async () => {
    await browser.storage.local.set({
      [STORAGE_KEY]: { destinations: [destination('one')], rules: [] },
      [ACTIVITY_STORAGE_KEY]: { limit: 10, entries: [{ id: 'private' }] },
    });
    const remove = vi.spyOn(browser.storage.local, 'remove');

    const result = await handleRuntimeMessage({ type: 'pushrow:reset-all-data' });

    expect(remove).toHaveBeenCalledWith([STORAGE_KEY, ACTIVITY_STORAGE_KEY]);
    expect(result).toMatchObject({
      state: { destinations: [], rules: [] },
      activity: { limit: 10, entries: [] },
    });
  });
});

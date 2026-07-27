import { browser } from 'wxt/browser';
import type { RuntimeMessage, RuntimeResponse } from '@/shared/types';

const RESPONSE_MARKER = 'pushrow:runtime-response';

type RuntimeEnvelope =
  | { marker: typeof RESPONSE_MARKER; ok: true; value: unknown }
  | { marker: typeof RESPONSE_MARKER; ok: false; error: string };

function isRuntimeEnvelope(value: unknown): value is RuntimeEnvelope {
  return (
    value !== null &&
    typeof value === 'object' &&
    'marker' in value &&
    value.marker === RESPONSE_MARKER &&
    'ok' in value &&
    typeof value.ok === 'boolean'
  );
}

export async function sendRuntimeMessage<Message extends RuntimeMessage>(
  message: Message,
): Promise<RuntimeResponse<Message>> {
  const response: unknown = await browser.runtime.sendMessage(message);
  if (!isRuntimeEnvelope(response)) return response as RuntimeResponse<Message>;
  if (!response.ok) throw new Error(response.error);
  return response.value as RuntimeResponse<Message>;
}

export async function getActiveTabUrl(): Promise<string | null> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.url ?? null;
}

export function openOptionsPage(): Promise<void> {
  return browser.runtime.openOptionsPage();
}

export async function openActivityPage(): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL('/options.html#activity') });
}

export function registerRuntimeMessageHandler(
  handler: (message: unknown) => Promise<unknown> | undefined,
): () => void {
  const listener = (
    message: unknown,
    _sender: Browser.runtime.MessageSender,
    sendResponse: (response: RuntimeEnvelope) => void,
  ): true | false => {
    const result = handler(message);
    if (result === undefined) return false;
    void result.then(
      (value) => sendResponse({ marker: RESPONSE_MARKER, ok: true, value }),
      (error: unknown) =>
        sendResponse({
          marker: RESPONSE_MARKER,
          ok: false,
          error: error instanceof Error ? error.message : 'The background request failed.',
        }),
    );
    return true;
  };

  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}

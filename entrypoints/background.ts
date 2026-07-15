import { browser } from 'wxt/browser';
import { postToClay } from '@/lib/clay';
import { parsePageRecord } from '@/lib/page-record';
import { hasClayPermission } from '@/lib/permissions';
import { getState, protectLocalStorage } from '@/lib/storage';
import type { RuntimeMessage, SendResult } from '@/lib/types';

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<RuntimeMessage>;
  return (
    message.type === 'posthook:send-record' &&
    typeof message.destinationId === 'string' &&
    Boolean(message.record) &&
    typeof message.record?.url === 'string'
  );
}

async function sendRecord(message: RuntimeMessage): Promise<SendResult> {
  const parsedRecord = parsePageRecord(message.record.url);
  if (
    !parsedRecord ||
    parsedRecord.source !== message.record.source ||
    parsedRecord.record_id !== message.record.record_id ||
    parsedRecord.object_type !== message.record.object_type
  ) {
    return { ok: false, code: 'invalid_message' };
  }

  const state = await getState();
  const destination = state.destinations.find(({ id }) => id === message.destinationId);
  if (!destination) return { ok: false, code: 'destination_missing' };
  if (!(await hasClayPermission())) return { ok: false, code: 'permission' };

  return postToClay(destination, parsedRecord);
}

export default defineBackground(() => {
  void protectLocalStorage();
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isRuntimeMessage(message)) return undefined;
    return sendRecord(message);
  });
});

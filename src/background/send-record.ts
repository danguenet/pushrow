import { postToClay } from '@/integrations/clay';
import { hasClayPermission } from '@/platform/permissions';
import { appendActivityEntry } from '@/platform/storage/activity';
import { getState } from '@/platform/storage/app-state';
import { parsePageRecord } from '@/shared/page-record';
import type { SendRecordMessage, SendResult } from '@/shared/types';
import { serializeStorageMutation } from './mutations';

async function recordActivity(
  destination: { id: string; name: string },
  request: SendRecordMessage,
  result: SendResult,
  attemptedAt: string,
): Promise<void> {
  try {
    await serializeStorageMutation(() =>
      appendActivityEntry({
        id: crypto.randomUUID(),
        attemptedAt,
        destination,
        request: request.record,
        result,
      }),
    );
  } catch {
    // A local logging failure must never change the outcome of the user's send.
  }
}

export async function sendRecord(message: SendRecordMessage): Promise<SendResult> {
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
  const attemptedAt = new Date().toISOString();
  const result = (await hasClayPermission())
    ? await postToClay(destination, parsedRecord)
    : { ok: false as const, code: 'permission' as const };

  await recordActivity(
    { id: destination.id, name: destination.name },
    { ...message, record: parsedRecord },
    result,
    attemptedAt,
  );
  return result;
}

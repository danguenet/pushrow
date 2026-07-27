import {
  deleteDestination,
  deleteRule,
  replaceRules,
  upsertDestination,
  upsertRule,
} from '@/background/configuration';
import { serializeStorageMutation } from '@/background/mutations';
import { sendRecord } from '@/background/send-record';
import { resetAllLocalData } from '@/platform/storage/all-data';
import {
  clearActivity,
  getActivityState,
  resetActivity,
  setActivityLimit,
} from '@/platform/storage/activity';
import { isDestination, isRoutingRule } from '@/shared/state/app-state';
import type { ActivityState, AppState, RuntimeMessage, SendResult } from '@/shared/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSendRecordMessage(value: Record<string, unknown>): boolean {
  if (value.type !== 'pushrow:send-record' || typeof value.destinationId !== 'string') return false;
  const record = value.record;
  return (
    isRecord(record) &&
    typeof record.source === 'string' &&
    typeof record.url === 'string' &&
    (record.record_id === null || typeof record.record_id === 'string') &&
    typeof record.object_type === 'string'
  );
}

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!isRecord(value)) return false;
  if (isSendRecordMessage(value)) return true;
  if (
    value.type === 'pushrow:get-activity' ||
    value.type === 'pushrow:clear-activity' ||
    value.type === 'pushrow:reset-activity' ||
    value.type === 'pushrow:reset-all-data'
  ) {
    return true;
  }
  if (value.type === 'pushrow:set-activity-limit') {
    return typeof value.limit === 'number' && Number.isFinite(value.limit);
  }
  if (value.type === 'pushrow:upsert-destination') {
    return isDestination(value.destination);
  }
  if (value.type === 'pushrow:delete-destination') {
    return typeof value.destinationId === 'string';
  }
  if (value.type === 'pushrow:upsert-rule') {
    return (
      isRoutingRule(value.rule) &&
      (value.insertAtTop === undefined || typeof value.insertAtTop === 'boolean')
    );
  }
  if (value.type === 'pushrow:delete-rule') return typeof value.ruleId === 'string';
  return (
    value.type === 'pushrow:replace-rules' &&
    Array.isArray(value.rules) &&
    value.rules.every(isRoutingRule)
  );
}

type RuntimeResult =
  SendResult | ActivityState | AppState | { state: AppState; activity: ActivityState };

export function handleRuntimeMessage(message: RuntimeMessage): Promise<RuntimeResult> {
  switch (message.type) {
    case 'pushrow:send-record':
      return sendRecord(message);
    case 'pushrow:get-activity':
      return getActivityState();
    case 'pushrow:set-activity-limit':
      return serializeStorageMutation(() => setActivityLimit(message.limit));
    case 'pushrow:clear-activity':
      return serializeStorageMutation(clearActivity);
    case 'pushrow:reset-activity':
      return serializeStorageMutation(resetActivity);
    case 'pushrow:upsert-destination':
      return serializeStorageMutation(() => upsertDestination(message.destination));
    case 'pushrow:delete-destination':
      return serializeStorageMutation(() => deleteDestination(message.destinationId));
    case 'pushrow:upsert-rule':
      return serializeStorageMutation(() => upsertRule(message.rule, message.insertAtTop));
    case 'pushrow:delete-rule':
      return serializeStorageMutation(() => deleteRule(message.ruleId));
    case 'pushrow:replace-rules':
      return serializeStorageMutation(() => replaceRules(message.rules));
    case 'pushrow:reset-all-data':
      return serializeStorageMutation(resetAllLocalData);
  }
}

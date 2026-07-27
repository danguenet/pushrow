import {
  DEFAULT_ACTIVITY_LIMIT,
  MAX_ACTIVITY_LIMIT,
  MAX_MATCH_URL_LENGTH,
} from '@/shared/constants';
import {
  ACTIVITY_SCHEMA_VERSION,
  type ActivityEntry,
  type ActivityState,
  type PageRecord,
  type SendErrorCode,
  type SendResult,
  type Source,
} from '@/shared/types';

const SOURCES = new Set<Source>(['linkedin', 'hubspot', 'salesforce', 'attio']);
const ERROR_CODES = new Set<SendErrorCode>([
  'permission',
  'bad_request',
  'auth',
  'not_found',
  'rate_limited',
  'server',
  'timeout',
  'network',
  'invalid_message',
  'destination_missing',
]);

export const EMPTY_ACTIVITY_STATE: ActivityState = {
  schemaVersion: ACTIVITY_SCHEMA_VERSION,
  limit: DEFAULT_ACTIVITY_LIMIT,
  entries: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeActivityLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_ACTIVITY_LIMIT;
  return Math.min(MAX_ACTIVITY_LIMIT, Math.max(0, Math.trunc(value)));
}

function isPageRecord(value: unknown): value is PageRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.source === 'string' &&
    SOURCES.has(value.source as Source) &&
    typeof value.url === 'string' &&
    value.url.length <= MAX_MATCH_URL_LENGTH &&
    (value.record_id === null || typeof value.record_id === 'string') &&
    typeof value.object_type === 'string'
  );
}

function isSendResult(value: unknown): value is SendResult {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false;
  if (value.ok) return typeof value.status === 'number';
  return (
    typeof value.code === 'string' &&
    ERROR_CODES.has(value.code as SendErrorCode) &&
    (value.status === undefined || typeof value.status === 'number')
  );
}

function normalizeActivityEntry(value: unknown): ActivityEntry | null {
  if (!isRecord(value) || !isRecord(value.destination)) return null;
  if (
    typeof value.id !== 'string' ||
    typeof value.attemptedAt !== 'string' ||
    typeof value.destination.id !== 'string' ||
    typeof value.destination.name !== 'string' ||
    !isPageRecord(value.request) ||
    !isSendResult(value.result)
  ) {
    return null;
  }
  const result: SendResult = value.result.ok
    ? { ok: true, status: value.result.status }
    : {
        ok: false,
        code: value.result.code,
        ...(value.result.status === undefined ? {} : { status: value.result.status }),
      };
  return {
    id: value.id,
    attemptedAt: value.attemptedAt,
    destination: { id: value.destination.id, name: value.destination.name },
    request: {
      source: value.request.source,
      url: value.request.url,
      record_id: value.request.record_id,
      object_type: value.request.object_type,
    },
    result,
  };
}

export function normalizeActivityState(value: unknown): ActivityState {
  if (!isRecord(value)) return structuredClone(EMPTY_ACTIVITY_STATE);
  const limit = normalizeActivityLimit(value.limit);
  const entries = (Array.isArray(value.entries) ? value.entries : [])
    .map(normalizeActivityEntry)
    .filter((entry): entry is ActivityEntry => entry !== null)
    .sort((left, right) => right.attemptedAt.localeCompare(left.attemptedAt))
    .slice(0, limit);
  return { schemaVersion: ACTIVITY_SCHEMA_VERSION, limit, entries };
}

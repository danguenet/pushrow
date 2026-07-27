import { APP_SCHEMA_VERSION } from '@/shared/types';
import type { AppState, Destination, RoutingRule, Source } from '@/shared/types';

const SOURCES = new Set<Source>(['linkedin', 'hubspot', 'salesforce', 'attio']);

export const EMPTY_STATE: AppState = {
  schemaVersion: APP_SCHEMA_VERSION,
  destinations: [],
  rules: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isDestination(value: unknown): value is Destination {
  if (!isRecord(value)) return false;
  const auth = value.auth;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.url === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    (auth === null ||
      (isRecord(auth) && typeof auth.headerName === 'string' && typeof auth.value === 'string'))
  );
}

export function isRoutingRule(value: unknown): value is RoutingRule {
  if (!isRecord(value) || !isRecord(value.matcher)) return false;
  const matcher = value.matcher;
  const validMatcher =
    (matcher.kind === 'guided' &&
      typeof matcher.source === 'string' &&
      SOURCES.has(matcher.source as Source) &&
      (matcher.objectType === undefined || typeof matcher.objectType === 'string')) ||
    (matcher.kind === 'regex' && typeof matcher.pattern === 'string');

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.destinationId === 'string' &&
    typeof value.enabled === 'boolean' &&
    typeof value.priority === 'number' &&
    validMatcher
  );
}

export function normalizeAppState(value: unknown): AppState {
  if (!isRecord(value)) return structuredClone(EMPTY_STATE);
  const destinations = Array.isArray(value.destinations)
    ? value.destinations.filter(isDestination)
    : [];
  const destinationIds = new Set(destinations.map(({ id }) => id));
  const rules = (Array.isArray(value.rules) ? value.rules.filter(isRoutingRule) : [])
    .filter(({ destinationId }) => destinationIds.has(destinationId))
    .sort((left, right) => left.priority - right.priority)
    .map((rule, priority) => ({ ...rule, priority }));

  return { schemaVersion: APP_SCHEMA_VERSION, destinations, rules };
}

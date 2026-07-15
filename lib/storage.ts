import { browser } from 'wxt/browser';
import { STORAGE_KEY } from './constants';
import {
  APP_SCHEMA_VERSION,
  type AppState,
  type Destination,
  type RoutingRule,
  type Source,
} from './types';

const SOURCES = new Set<Source>(['linkedin', 'hubspot', 'salesforce', 'attio']);

export const EMPTY_STATE: AppState = {
  schemaVersion: APP_SCHEMA_VERSION,
  destinations: [],
  rules: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isDestination(value: unknown): value is Destination {
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

function isRule(value: unknown): value is RoutingRule {
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

function normalizeState(value: unknown): AppState {
  if (!isRecord(value)) return structuredClone(EMPTY_STATE);
  const destinations = Array.isArray(value.destinations)
    ? value.destinations.filter(isDestination)
    : [];
  const destinationIds = new Set(destinations.map(({ id }) => id));
  const rules = (Array.isArray(value.rules) ? value.rules.filter(isRule) : [])
    .filter(({ destinationId }) => destinationIds.has(destinationId))
    .sort((left, right) => left.priority - right.priority)
    .map((rule, priority) => ({ ...rule, priority }));

  return { schemaVersion: APP_SCHEMA_VERSION, destinations, rules };
}

export async function protectLocalStorage(): Promise<void> {
  await browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

export async function getState(): Promise<AppState> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return normalizeState(result[STORAGE_KEY]);
}

export async function saveState(state: AppState): Promise<AppState> {
  const normalized = normalizeState(state);
  await browser.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

export async function upsertDestination(destination: Destination): Promise<AppState> {
  const state = await getState();
  const duplicateName = state.destinations.some(
    ({ id, name }) =>
      id !== destination.id && name.toLowerCase() === destination.name.toLowerCase(),
  );
  if (duplicateName) throw new Error('Destination names must be unique.');

  const existingIndex = state.destinations.findIndex(({ id }) => id === destination.id);
  const destinations = [...state.destinations];
  if (existingIndex >= 0) destinations[existingIndex] = destination;
  else destinations.push(destination);
  return saveState({ ...state, destinations });
}

export async function deleteDestination(destinationId: string): Promise<AppState> {
  const state = await getState();
  return saveState({
    ...state,
    destinations: state.destinations.filter(({ id }) => id !== destinationId),
    rules: state.rules.filter((rule) => rule.destinationId !== destinationId),
  });
}

export async function upsertRule(rule: RoutingRule, insertAtTop = false): Promise<AppState> {
  const state = await getState();
  const existingIndex = state.rules.findIndex(({ id }) => id === rule.id);
  const rules = state.rules.filter(({ id }) => id !== rule.id);
  if (insertAtTop) rules.unshift(rule);
  else if (existingIndex >= 0) rules.splice(existingIndex, 0, rule);
  else rules.push(rule);
  return saveState({ ...state, rules: rules.map((item, priority) => ({ ...item, priority })) });
}

export async function deleteRule(ruleId: string): Promise<AppState> {
  const state = await getState();
  return saveState({ ...state, rules: state.rules.filter(({ id }) => id !== ruleId) });
}

export async function replaceRules(rules: RoutingRule[]): Promise<AppState> {
  const state = await getState();
  return saveState({ ...state, rules: rules.map((rule, priority) => ({ ...rule, priority })) });
}

export async function clearState(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}

export function subscribeState(callback: (state: AppState) => void): () => void {
  const listener = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      callback(normalizeState(changes[STORAGE_KEY].newValue));
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

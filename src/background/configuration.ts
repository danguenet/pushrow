import { validateAuth, validateClayWebhookUrl } from '@/shared/destinations';
import type { AppState, Destination, RoutingRule } from '@/shared/types';
import { getState, saveState } from '@/platform/storage/app-state';

function validateDestination(destination: Destination): Destination {
  const name = destination.name.trim();
  if (!name) throw new Error('Give this Clay destination a name.');
  return {
    ...destination,
    name,
    url: validateClayWebhookUrl(destination.url),
    auth: destination.auth
      ? validateAuth(destination.auth.headerName, destination.auth.value)
      : null,
  };
}

export async function upsertDestination(destination: Destination): Promise<AppState> {
  const nextDestination = validateDestination(destination);
  const state = await getState();
  const duplicateName = state.destinations.some(
    ({ id, name }) =>
      id !== nextDestination.id && name.toLowerCase() === nextDestination.name.toLowerCase(),
  );
  if (duplicateName) throw new Error('Destination names must be unique.');

  const existingIndex = state.destinations.findIndex(({ id }) => id === nextDestination.id);
  const destinations = [...state.destinations];
  if (existingIndex >= 0) destinations[existingIndex] = nextDestination;
  else destinations.push(nextDestination);
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

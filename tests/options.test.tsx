/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { handleRuntimeMessage } from '@/background/messages';
import { App } from '@/options/App';
import { getState, saveState } from '@/platform/storage/app-state';
import { EMPTY_ACTIVITY_STATE } from '@/shared/state/activity-state';
import { EMPTY_STATE } from '@/shared/state/app-state';
import type { ActivityState, Destination, RoutingRule, RuntimeMessage } from '@/shared/types';

const destination: Destination = {
  id: 'destination',
  name: 'Prospects',
  url: 'https://api.clay.com/v3/sources/webhook/old-test-id',
  auth: null,
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
};
const newWebhook = 'https://api.clay.com/v3/sources/webhook/new-test-id';
const routingRule: RoutingRule = {
  id: 'rule',
  name: 'LinkedIn people',
  destinationId: destination.id,
  enabled: true,
  priority: 0,
  matcher: { kind: 'guided', source: 'linkedin', objectType: 'person' },
};

function mockRuntime(activity: ActivityState = EMPTY_ACTIVITY_STATE) {
  const runtime = browser.runtime as unknown as {
    sendMessage(message: RuntimeMessage): Promise<unknown>;
  };
  return vi.spyOn(runtime, 'sendMessage').mockImplementation(async (message) => {
    if (message.type === 'pushrow:get-activity') return activity;
    if (message.type === 'pushrow:clear-activity') return { ...activity, entries: [] };
    if (message.type === 'pushrow:reset-activity') return EMPTY_ACTIVITY_STATE;
    if (message.type === 'pushrow:set-activity-limit') {
      return { ...activity, limit: message.limit ?? activity.limit };
    }
    return handleRuntimeMessage(message);
  });
}

describe('options page', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
    document.getElementById('root')?.remove();
    vi.restoreAllMocks();
  });

  it('shows inline validation for an unnamed destination', async () => {
    mockRuntime();
    render(<App />);

    expect(screen.queryByRole('heading', { name: 'Add destination' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save destination' }));
    expect(await screen.findAllByText('Give this Clay destination a name.')).toHaveLength(2);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('adds a destination from a plain URL without a parse step', async () => {
    mockRuntime();
    const permissions = browser.permissions as unknown as {
      request(value: unknown): Promise<boolean>;
    };
    vi.spyOn(permissions, 'request').mockResolvedValue(true);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New table' } });
    fireEvent.change(screen.getByLabelText('Paste a Clay webhook URL or cURL'), {
      target: { value: newWebhook },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save destination' }));

    expect(await screen.findByText('New table is ready to receive records.')).toBeVisible();
    expect((await getState()).destinations[0]).toMatchObject({
      name: 'New table',
      url: newWebhook,
      auth: null,
    });
  });

  it('stages authenticated cURL details on paste and exposes them under connection details', async () => {
    mockRuntime();
    const permissions = browser.permissions as unknown as {
      request(value: unknown): Promise<boolean>;
    };
    vi.spyOn(permissions, 'request').mockResolvedValue(true);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Protected table' } });
    const connectionInput = screen.getByLabelText('Paste a Clay webhook URL or cURL');
    fireEvent.paste(connectionInput, {
      clipboardData: {
        getData: () =>
          `curl '${newWebhook}' -H 'x-clay-webhook-auth: local-test-token' --data '{"sample":true}'`,
      },
    });

    expect(await screen.findByText('Clay connection ready')).toBeVisible();
    expect(screen.getByText('Authentication added')).toBeVisible();
    expect(screen.queryByLabelText('Authentication header')).not.toBeInTheDocument();

    const advanced = screen.getByRole('button', { name: 'Edit connection details' });
    expect(advanced).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(advanced);
    expect(advanced).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Authentication header')).toHaveValue('x-clay-webhook-auth');
    expect(screen.getByLabelText('Token or header value')).toHaveValue('local-test-token');
    expect(screen.getByText(/not encrypted at rest/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Save destination' }));
    expect(await screen.findByText('Protected table is ready to receive records.')).toBeVisible();
    expect((await getState()).destinations[0]?.auth).toEqual({
      headerName: 'x-clay-webhook-auth',
      value: 'local-test-token',
    });
  });

  it('updates an existing endpoint from connection details', async () => {
    await saveState({ ...EMPTY_STATE, destinations: [destination] });
    mockRuntime();
    const permissions = browser.permissions as unknown as {
      request(value: unknown): Promise<boolean>;
    };
    vi.spyOn(permissions, 'request').mockResolvedValue(true);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Prospects' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit connection details' }));
    const webhookUrl = screen.getByLabelText('Webhook URL');
    fireEvent.change(webhookUrl, {
      target: { value: newWebhook },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Prospects is ready to receive records.')).toBeVisible();
    expect((await getState()).destinations[0]?.url).toContain('new-test-id');
  });

  it('shows a simple connection summary and toggles editable connection details', async () => {
    await saveState({ ...EMPTY_STATE, destinations: [destination] });
    mockRuntime();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Prospects' }));

    expect(screen.getByText('Clay connection')).toBeVisible();
    expect(screen.getByText('No authentication')).toBeVisible();
    expect(screen.queryByText('x-clay-webhook-auth')).not.toBeInTheDocument();
    expect(screen.queryByText(/not encrypted at rest/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Paste a Clay webhook URL or cURL')).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Replace from Clay' })).not.toBeInTheDocument();
    const editDetails = screen.getByRole('button', { name: 'Edit connection details' });
    fireEvent.click(editDetails);
    expect(screen.getByLabelText('Webhook URL')).toHaveValue(destination.url);
    fireEvent.click(editDetails);
    expect(screen.queryByLabelText('Webhook URL')).not.toBeInTheDocument();
  });

  it('keeps an existing connection when edited details are invalid', async () => {
    await saveState({ ...EMPTY_STATE, destinations: [destination] });
    const runtime = mockRuntime();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Prospects' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit connection details' }));
    fireEvent.change(screen.getByLabelText('Webhook URL'), {
      target: { value: 'https://example.com/not-clay' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findAllByText('The webhook must use https://api.clay.com.')).toHaveLength(
      2,
    );
    expect((await getState()).destinations[0]?.url).toBe(destination.url);
    expect(
      runtime.mock.calls.some(([message]) => message.type === 'pushrow:upsert-destination'),
    ).toBe(false);
  });

  it('adds and removes optional authentication inside connection details', async () => {
    await saveState({ ...EMPTY_STATE, destinations: [destination] });
    mockRuntime();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Prospects' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit connection details' }));
    expect(screen.getByText('No authentication header will be sent.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Add authentication' }));
    expect(screen.getByLabelText('Authentication header')).toHaveValue('x-clay-webhook-auth');
    expect(screen.getByLabelText('Token or header value')).toHaveValue('');
    expect(screen.getByText(/not encrypted at rest/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findAllByText('Provide both an authentication header and its value.'),
    ).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Remove authentication' }));
    expect(screen.queryByLabelText('Authentication header')).not.toBeInTheDocument();
    expect(screen.getByText('No authentication header will be sent.')).toBeVisible();
    expect(screen.queryByText(/not encrypted at rest/)).not.toBeInTheDocument();
  });

  it('edits a destination name without entering replacement mode', async () => {
    await saveState({ ...EMPTY_STATE, destinations: [destination] });
    mockRuntime();
    const permissions = browser.permissions as unknown as {
      request(value: unknown): Promise<boolean>;
    };
    vi.spyOn(permissions, 'request').mockResolvedValue(true);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Prospects' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed table' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Renamed table is ready to receive records.')).toBeVisible();
    expect((await getState()).destinations[0]).toMatchObject({
      name: 'Renamed table',
      url: destination.url,
      auth: null,
    });
  });

  it('opens the editor when a destination row is selected', async () => {
    await saveState({ ...EMPTY_STATE, destinations: [destination] });
    mockRuntime();
    render(<App />);

    expect(screen.queryByRole('heading', { name: 'Edit destination' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByText(destination.url));

    expect(screen.getByRole('heading', { name: 'Edit destination' })).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Edit destination' })).toBeVisible();
    expect(screen.getByLabelText('Name')).toHaveValue('Prospects');
  });

  it('makes modal content exclusive and restores focus when it closes', async () => {
    mockRuntime();
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);
    render(<App />, { container: root });
    const add = screen.getByRole('button', { name: 'Add destination' });
    add.focus();

    fireEvent.click(add);

    expect(root).toHaveAttribute('inert');
    const dialog = screen.getByRole('dialog', { name: 'Add destination' });
    expect(dialog).toBeVisible();
    const close = within(dialog).getByRole('button', { name: 'Close editor' });
    const save = within(dialog).getByRole('button', { name: 'Save destination' });
    save.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(save).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(root).not.toHaveAttribute('inert'));
    expect(screen.queryByRole('dialog', { name: 'Add destination' })).not.toBeInTheDocument();
    expect(add).toHaveFocus();
  });

  it('keeps row actions out of the destination table', async () => {
    await saveState({ ...EMPTY_STATE, destinations: [destination] });
    mockRuntime();
    render(<App />);

    expect(await screen.findByRole('columnheader', { name: 'Destination name' })).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('puts destructive local-data controls in their own tab', async () => {
    mockRuntime();
    render(<App />);

    expect(screen.queryByRole('button', { name: 'Delete all local data' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Data & privacy' }));
    expect(screen.getByRole('button', { name: 'Delete all local data' })).toBeVisible();
  });

  it('uses a table and modal editor for routing rules', async () => {
    await saveState({ ...EMPTY_STATE, destinations: [destination], rules: [routingRule] });
    mockRuntime();
    render(<App />);

    fireEvent.click(await screen.findByRole('tab', { name: /Routing rules/ }));
    expect(screen.getByRole('columnheader', { name: 'Rule' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Destination' })).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit LinkedIn people' }));
    expect(screen.getByRole('dialog', { name: 'Edit routing rule' })).toBeVisible();
  });

  it('creates, toggles, reorders, and deletes routing rules', async () => {
    const secondRule: RoutingRule = {
      ...routingRule,
      id: 'second-rule',
      name: 'Salesforce contacts',
      priority: 1,
      matcher: { kind: 'guided', source: 'salesforce', objectType: 'Contact' },
    };
    await saveState({
      ...EMPTY_STATE,
      destinations: [destination],
      rules: [routingRule, secondRule],
    });
    mockRuntime();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    fireEvent.click(await screen.findByRole('tab', { name: /Routing rules/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Disable LinkedIn people' }));
    await waitFor(async () => expect((await getState()).rules[0]?.enabled).toBe(false));

    fireEvent.click(screen.getByRole('button', { name: 'Move LinkedIn people down' }));
    await waitFor(async () =>
      expect((await getState()).rules.map(({ id }) => id)).toEqual(['second-rule', 'rule']),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add routing rule' }));
    fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Attio people' } });
    fireEvent.change(screen.getByLabelText('Test with a supported record URL'), {
      target: {
        value: 'https://app.attio.com/salarya/person/bf071e1f-6035-429d-b874-d83ea64ea13b',
      },
    });
    expect(screen.getByText('This rule does not match.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'attio' } });
    expect(screen.getByText('This rule matches.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Save routing rule' }));
    expect(await screen.findByText('Attio people was saved.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Attio people' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete rule' }));
    expect(await screen.findByText('Attio people was deleted.')).toBeVisible();
    expect((await getState()).rules.map(({ name }) => name)).not.toContain('Attio people');
  });

  it('updates and clears bounded activity', async () => {
    const activity: ActivityState = {
      schemaVersion: 1,
      limit: 10,
      entries: [
        {
          id: 'activity',
          attemptedAt: '2026-07-15T12:00:00.000Z',
          destination: { id: destination.id, name: destination.name },
          request: {
            source: 'linkedin',
            url: 'https://www.linkedin.com/in/example-person',
            record_id: null,
            object_type: 'person',
          },
          result: { ok: true, status: 204 },
        },
      ],
    };
    mockRuntime(activity);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    fireEvent.click(await screen.findByRole('tab', { name: /Activity/ }));
    fireEvent.change(screen.getByLabelText('Keep latest'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Activity will keep the latest 5 sends.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Clear activity' }));
    expect(await screen.findByText('Local activity was cleared.')).toBeVisible();
    expect(screen.getByText('No sends recorded yet')).toBeVisible();
  });

  it('supports keyboard navigation between settings tabs', async () => {
    mockRuntime();
    render(<App />);
    const destinationsTab = screen.getByRole('tab', { name: /Destinations/ });

    fireEvent.keyDown(destinationsTab, { key: 'End' });

    expect(screen.getByRole('tab', { name: 'Data & privacy' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('keeps an editor open when unsaved changes are not discarded', async () => {
    mockRuntime();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Add destination' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Unsaved table' } });
    fireEvent.click(screen.getByRole('tab', { name: /Activity/ }));

    expect(screen.getByRole('tab', { name: /Destinations/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Unsaved table');
    expect(window.confirm).toHaveBeenCalledWith('Discard your unsaved destination changes?');
  });

  it('shows retained request data without endpoint or authentication data', async () => {
    const activity: ActivityState = {
      schemaVersion: 1,
      limit: 10,
      entries: [
        {
          id: 'activity',
          attemptedAt: '2026-07-15T12:00:00.000Z',
          destination: { id: 'destination', name: 'Prospects' },
          request: {
            source: 'linkedin',
            url: 'https://www.linkedin.com/in/example-person',
            record_id: null,
            object_type: 'person',
          },
          result: { ok: false, code: 'auth', status: 401 },
        },
      ],
    };
    mockRuntime(activity);
    render(<App />);

    fireEvent.click(await screen.findByRole('tab', { name: /Activity/ }));
    expect(await screen.findByText('HTTP 401 · auth')).toBeVisible();
    fireEvent.click(screen.getByText('Prospects'));
    expect(screen.getByText(/example-person/)).toBeVisible();
    expect(screen.queryByText(/api\.clay\.com/)).not.toBeInTheDocument();
  });

  it('revokes Clay access after deleting the last destination', async () => {
    await saveState({ ...EMPTY_STATE, destinations: [destination] });
    mockRuntime();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const permissions = browser.permissions as unknown as {
      remove(value: unknown): Promise<boolean>;
    };
    const removePermission = vi.spyOn(permissions, 'remove').mockResolvedValue(true);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Prospects' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete destination' }));

    expect(await screen.findByText('Prospects was deleted.')).toBeVisible();
    expect(removePermission).toHaveBeenCalledWith({ origins: ['https://api.clay.com/*'] });
  });

  it('deletes all stored data and revokes Clay access', async () => {
    await saveState({ ...EMPTY_STATE, destinations: [destination], rules: [routingRule] });
    mockRuntime();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const permissions = browser.permissions as unknown as {
      remove(value: unknown): Promise<boolean>;
    };
    vi.spyOn(permissions, 'remove').mockResolvedValue(true);
    render(<App />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Data & privacy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete all local data' }));

    expect(await screen.findByText('All local Push Row data was deleted.')).toBeVisible();
    expect(await getState()).toEqual(EMPTY_STATE);
  });

  it('reports partial deletion when Chrome cannot revoke Clay access', async () => {
    await saveState({ ...EMPTY_STATE, destinations: [destination] });
    mockRuntime();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const permissions = browser.permissions as unknown as {
      remove(value: unknown): Promise<boolean>;
      contains(value: unknown): Promise<boolean>;
    };
    vi.spyOn(permissions, 'remove').mockResolvedValue(false);
    vi.spyOn(permissions, 'contains').mockResolvedValue(true);
    render(<App />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Data & privacy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete all local data' }));

    expect(
      await screen.findByText(/Local data was deleted, but Clay access remains enabled/),
    ).toBeVisible();
    expect(await getState()).toEqual(EMPTY_STATE);
  });
});

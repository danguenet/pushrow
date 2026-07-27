/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { App } from '@/popup/App';
import { saveState } from '@/platform/storage/app-state';
import { EMPTY_STATE } from '@/shared/state/app-state';
import type { AppState, Destination, RoutingRule, SendResult } from '@/shared/types';

const destination: Destination = {
  id: 'destination',
  name: 'Prospects',
  url: 'https://api.clay.com/v3/sources/webhook/example-test-id',
  auth: null,
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
};

const rule: RoutingRule = {
  id: 'rule',
  name: 'LinkedIn people',
  destinationId: destination.id,
  enabled: true,
  priority: 0,
  matcher: { kind: 'guided', source: 'linkedin', objectType: 'person' },
};

const configuredState: AppState = {
  ...EMPTY_STATE,
  destinations: [destination],
  rules: [],
};

async function renderPopup(url: string, state: AppState = configuredState) {
  await saveState(state);
  const tabs = browser.tabs as unknown as {
    query(queryInfo: unknown): Promise<Array<{ id: number; url: string }>>;
  };
  vi.spyOn(tabs, 'query').mockResolvedValue([{ id: 1, url }]);
  render(<App />);
}

describe('popup states', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows first-use setup when no destination exists', async () => {
    await renderPopup('https://www.linkedin.com/in/example-person', EMPTY_STATE);
    expect(await screen.findByText('Add your first Clay table')).toBeVisible();
  });

  it('explains unsupported pages', async () => {
    await renderPopup('https://example.com/record/1');
    expect(await screen.findByText('No supported record here')).toBeVisible();
    expect(screen.getByText(/HubSpot, Salesforce Lightning, or Attio/)).toBeVisible();
  });

  it('requires a manual destination choice when no rule matches', async () => {
    await renderPopup('https://www.linkedin.com/in/example-person');
    expect(await screen.findByText('Choose a Clay table')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send to a table' })).toBeDisabled();
  });

  it('preselects the highest-priority recommendation', async () => {
    await renderPopup('https://www.linkedin.com/in/example-person', {
      ...configuredState,
      rules: [rule],
    });
    expect(await screen.findByText('Recommended')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send to Prospects' })).toBeEnabled();
  });

  it('disables sending while one request is pending, then shows success', async () => {
    let finish!: (result: SendResult) => void;
    const response = new Promise<SendResult>((resolve) => {
      finish = resolve;
    });
    const runtime = browser.runtime as unknown as {
      sendMessage(message: unknown): Promise<SendResult>;
    };
    const sendMessage = vi.spyOn(runtime, 'sendMessage').mockImplementation(() => response);
    await renderPopup('https://www.linkedin.com/in/example-person', {
      ...configuredState,
      rules: [rule],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Send to Prospects' }));
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    await act(async () => finish({ ok: true, status: 204 }));
    expect(await screen.findByText('Sent to Prospects')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send again to Prospects' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'View local activity' })).toBeVisible();
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('shows an actionable error without retrying automatically', async () => {
    const runtime = browser.runtime as unknown as {
      sendMessage(message: unknown): Promise<SendResult>;
    };
    const sendMessage = vi
      .spyOn(runtime, 'sendMessage')
      .mockResolvedValue({ ok: false, code: 'auth', status: 401 });
    await renderPopup('https://www.linkedin.com/in/example-person', {
      ...configuredState,
      rules: [rule],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Send to Prospects' }));
    expect(await screen.findByText(/rejected the authentication header/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry send' })).toBeEnabled();
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('shows a recoverable error when Chrome cannot read the active tab', async () => {
    await saveState(configuredState);
    const tabs = browser.tabs as unknown as {
      query(queryInfo: unknown): Promise<Array<{ id: number; url: string }>>;
    };
    vi.spyOn(tabs, 'query').mockRejectedValue(new Error('tab unavailable'));

    render(<App />);

    expect(await screen.findByText('Push Row could not read this tab')).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Open settings' })).toHaveLength(2);
  });

  it('reports recommendation-rule failures and allows retry', async () => {
    const runtime = browser.runtime as unknown as {
      sendMessage(message: { type: string }): Promise<unknown>;
    };
    const sendMessage = vi.spyOn(runtime, 'sendMessage').mockImplementation(async (message) => {
      if (message.type === 'pushrow:send-record') return { ok: true, status: 204 };
      if (message.type === 'pushrow:upsert-rule') throw new Error('storage unavailable');
      return undefined;
    });
    await renderPopup('https://www.linkedin.com/in/example-person');

    fireEvent.click(await screen.findByRole('button', { name: /Prospects/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to Prospects' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /Always recommend here for LinkedIn person/ }),
    );

    expect(await screen.findByText(/Could not create the recommendation rule/)).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Always recommend here for LinkedIn person/ }),
    ).toBeEnabled();
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});

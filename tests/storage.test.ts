import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import {
  deleteDestination,
  getState,
  replaceRules,
  upsertDestination,
  upsertRule,
} from '@/lib/storage';
import type { Destination, RoutingRule } from '@/lib/types';
import { STORAGE_KEY } from '@/lib/constants';

const destination: Destination = {
  id: 'destination',
  name: 'Contacts',
  url: 'https://api.clay.com/v3/sources/webhook/example-test-id',
  auth: null,
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
};

const rule: RoutingRule = {
  id: 'rule',
  name: 'LinkedIn',
  destinationId: destination.id,
  enabled: true,
  priority: 0,
  matcher: { kind: 'guided', source: 'linkedin' },
};

describe('storage repository', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  it('persists a versioned destination and rule', async () => {
    await upsertDestination(destination);
    await upsertRule(rule);
    const state = await getState();
    expect(state.schemaVersion).toBe(1);
    expect(state.destinations).toEqual([destination]);
    expect(state.rules).toEqual([rule]);
  });

  it('rejects duplicate destination names case-insensitively', async () => {
    await upsertDestination(destination);
    await expect(
      upsertDestination({ ...destination, id: 'other', name: 'contacts' }),
    ).rejects.toThrow('unique');
  });

  it('deleting a destination cascades its rules', async () => {
    await upsertDestination(destination);
    await upsertRule(rule);
    await deleteDestination(destination.id);
    expect(await getState()).toMatchObject({ destinations: [], rules: [] });
  });

  it('normalizes global rule priority after reordering', async () => {
    await upsertDestination(destination);
    const second = { ...rule, id: 'second', name: 'Second', priority: 9 };
    await replaceRules([second, rule]);
    expect((await getState()).rules.map(({ id, priority }) => [id, priority])).toEqual([
      ['second', 0],
      ['rule', 1],
    ]);
  });

  it('migrates an unversioned valid shape and removes orphaned rules', async () => {
    await browser.storage.local.set({
      [STORAGE_KEY]: {
        destinations: [destination],
        rules: [rule, { ...rule, id: 'orphan', destinationId: 'missing' }],
      },
    });
    expect(await getState()).toEqual({
      schemaVersion: 1,
      destinations: [destination],
      rules: [rule],
    });
  });
});

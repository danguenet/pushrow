import { describe, expect, it } from 'vitest';
import { getRecommendations, ruleMatches, validateRegexPattern } from '@/shared/rules';
import type { Destination, PageRecord, RoutingRule } from '@/shared/types';

const record: PageRecord = {
  source: 'salesforce',
  url: 'https://acme.lightning.force.com/lightning/r/Contact/0035g00000ABCDEAAA/view',
  record_id: '0035g00000ABCDEAAA',
  object_type: 'Contact',
};

const destinations: Destination[] = ['contacts', 'crm', 'other'].map((id) => ({
  id,
  name: id,
  url: `https://api.clay.com/v3/sources/webhook/${id}`,
  auth: null,
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
}));

function guidedRule(
  id: string,
  destinationId: string,
  priority: number,
  objectType?: string,
): RoutingRule {
  return {
    id,
    name: id,
    destinationId,
    enabled: true,
    priority,
    matcher: {
      kind: 'guided',
      source: 'salesforce',
      ...(objectType ? { objectType } : {}),
    },
  };
}

describe('routing rules', () => {
  it('matches guided source/object rules case-insensitively', () => {
    expect(ruleMatches(guidedRule('one', 'contacts', 0, 'contact'), record)).toBe(true);
    expect(ruleMatches(guidedRule('two', 'contacts', 0, 'Account'), record)).toBe(false);
  });

  it('matches valid regex rules case-insensitively', () => {
    expect(
      ruleMatches(
        {
          id: 'regex',
          name: 'regex',
          destinationId: 'contacts',
          enabled: true,
          priority: 0,
          matcher: { kind: 'regex', pattern: '/LIGHTNING/r/contact/' },
        },
        record,
      ),
    ).toBe(true);
  });

  it('rejects invalid, long, and RE2-incompatible patterns', () => {
    expect(validateRegexPattern('[').valid).toBe(false);
    expect(validateRegexPattern('a'.repeat(257)).valid).toBe(false);
    expect(validateRegexPattern('(a)\\1').valid).toBe(false);
    expect(validateRegexPattern('(?=unsafe-lookahead)').valid).toBe(false);
    expect(validateRegexPattern('(a+)+').valid).toBe(true);
  });

  it('evaluates adversarial patterns in bounded time', () => {
    const startedAt = performance.now();
    expect(
      ruleMatches(
        {
          id: 'adversarial',
          name: 'adversarial',
          destinationId: 'contacts',
          enabled: true,
          priority: 0,
          matcher: { kind: 'regex', pattern: '^(a|aa)+$' },
        },
        { ...record, url: `${'a'.repeat(2_047)}!` },
      ),
    ).toBe(false);
    expect(performance.now() - startedAt).toBeLessThan(100);
  });

  it('orders all matches and deduplicates a destination by its highest rule', () => {
    const recommendations = getRecommendations(record, destinations, [
      guidedRule('low', 'contacts', 8),
      guidedRule('top', 'crm', 0),
      guidedRule('duplicate', 'crm', 4),
      { ...guidedRule('disabled', 'other', 1), enabled: false },
    ]);
    expect(recommendations.map(({ destination }) => destination.id)).toEqual(['crm', 'contacts']);
    expect(recommendations[0]?.rule.id).toBe('top');
  });

  it('returns no implicit fallback when no rule matches', () => {
    expect(
      getRecommendations(record, destinations, [guidedRule('account', 'crm', 0, 'Account')]),
    ).toEqual([]);
  });
});

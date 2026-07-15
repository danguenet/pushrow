import { describe, expect, it } from 'vitest';
import {
  DestinationInputError,
  parseDestinationInput,
  validateAuth,
  validateClayWebhookUrl,
} from '@/lib/destinations';

const WEBHOOK =
  'https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-example-test-id';

describe('destination parsing', () => {
  it('accepts a direct Clay URL and applies the default auth header', () => {
    expect(parseDestinationInput(WEBHOOK)).toEqual({
      url: WEBHOOK,
      headerName: 'x-clay-webhook-auth',
      headerValue: '',
    });
  });

  it('extracts a multiline cURL URL and Clay auth header while ignoring the body', () => {
    const input = `curl --location '${WEBHOOK}' \\
      --header 'Content-Type: application/json' \\
      --header 'x-clay-webhook-auth: local-test-token' \\
      --data '{"company_name":"Example"}'`;
    expect(parseDestinationInput(input)).toEqual({
      url: WEBHOOK,
      headerName: 'x-clay-webhook-auth',
      headerValue: 'local-test-token',
    });
  });

  it('preserves Authorization headers', () => {
    const input = `curl --url "${WEBHOOK}" -H "Authorization: Bearer local-test-token"`;
    expect(parseDestinationInput(input).headerName).toBe('Authorization');
    expect(parseDestinationInput(input).headerValue).toBe('Bearer local-test-token');
  });

  it('rejects non-Clay, non-webhook, and credentialed endpoints', () => {
    expect(() => validateClayWebhookUrl('https://example.com/webhook')).toThrow(
      DestinationInputError,
    );
    expect(() => validateClayWebhookUrl('https://api.clay.com/v3/tables/123')).toThrow(
      'Clay webhook',
    );
    expect(() =>
      validateClayWebhookUrl('https://user:pass@api.clay.com/v3/sources/webhook/example-test-id'),
    ).toThrow('Credentials');
  });

  it('rejects shell chaining and unclosed quotes without executing anything', () => {
    expect(() => parseDestinationInput(`curl '${WEBHOOK}'; curl https://example.com`)).toThrow(
      'Shell commands',
    );
    expect(() => parseDestinationInput(`curl '${WEBHOOK}'; echo exposed`)).toThrow(
      'Shell commands',
    );
    expect(() => parseDestinationInput(`curl '${WEBHOOK}`)).toThrow('unfinished quote');
    expect(() => parseDestinationInput(`curl "$(whoami)"`)).toThrow('Shell commands');
  });

  it('allows optional auth and blocks dangerous header names', () => {
    expect(validateAuth('', '')).toBeNull();
    expect(validateAuth('Authorization', 'Bearer test')).toEqual({
      headerName: 'Authorization',
      value: 'Bearer test',
    });
    expect(() => validateAuth('Cookie', 'secret')).toThrow('not allowed');
    expect(() => validateAuth('Authorization', '')).toThrow('both');
  });
});

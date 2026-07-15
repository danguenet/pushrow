import { describe, expect, it } from 'vitest';
import { parsePageRecord } from '@/lib/page-record';

describe('parsePageRecord', () => {
  it('canonicalizes a LinkedIn profile URL', () => {
    expect(parsePageRecord('https://uk.linkedin.com/in/jane-doe/?trk=profile#about')).toEqual({
      source: 'linkedin',
      url: 'https://www.linkedin.com/in/jane-doe',
      record_id: null,
      object_type: 'person',
    });
  });

  it('rejects LinkedIn company and Sales Navigator URLs', () => {
    expect(parsePageRecord('https://www.linkedin.com/company/clay-hq')).toBeNull();
    expect(parsePageRecord('https://www.linkedin.com/sales/lead/abc')).toBeNull();
  });

  it('parses standard and custom HubSpot record URLs on regional hosts', () => {
    expect(
      parsePageRecord('https://app-eu1.hubspot.com/contacts/123/record/0-1/456?tab=activity'),
    ).toEqual({
      source: 'hubspot',
      url: 'https://app-eu1.hubspot.com/contacts/123/record/0-1/456',
      record_id: '456',
      object_type: 'contact',
    });
    expect(
      parsePageRecord('https://app.hubspot.com/contacts/123/record/2-3465404/4388553737')
        ?.object_type,
    ).toBe('2-3465404');
  });

  it('parses Salesforce Lightning records and preserves custom object names', () => {
    const input =
      'https://acme.lightning.force.com/lightning/r/Widget__c/a015g00000ABCDEAAA/view?ws=%2Flightning';
    expect(parsePageRecord(input)).toEqual({
      source: 'salesforce',
      url: 'https://acme.lightning.force.com/lightning/r/Widget__c/a015g00000ABCDEAAA/view',
      record_id: 'a015g00000ABCDEAAA',
      object_type: 'Widget__c',
    });
  });

  it('rejects Salesforce Classic and malformed IDs', () => {
    expect(parsePageRecord('https://acme.my.salesforce.com/0035g00000ABCDE')).toBeNull();
    expect(
      parsePageRecord('https://acme.lightning.force.com/lightning/r/Contact/not-an-id/view'),
    ).toBeNull();
  });

  it('parses Attio record URLs', () => {
    expect(
      parsePageRecord(
        'https://app.attio.com/salarya/person/bf071e1f-6035-429d-b874-d83ea64ea13b/?view=all',
      ),
    ).toEqual({
      source: 'attio',
      url: 'https://app.attio.com/salarya/person/bf071e1f-6035-429d-b874-d83ea64ea13b',
      record_id: 'bf071e1f-6035-429d-b874-d83ea64ea13b',
      object_type: 'person',
    });
  });

  it('rejects unsupported, insecure, and credentialed URLs', () => {
    expect(parsePageRecord('https://example.com/in/jane')).toBeNull();
    expect(parsePageRecord('http://www.linkedin.com/in/jane')).toBeNull();
    expect(parsePageRecord('https://user:pass@www.linkedin.com/in/jane')).toBeNull();
    expect(parsePageRecord('not a url')).toBeNull();
    expect(parsePageRecord(`https://www.linkedin.com/in/${'x'.repeat(2_100)}`)).toBeNull();
  });
});

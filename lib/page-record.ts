import { MAX_MATCH_URL_LENGTH } from './constants';
import type { PageRecord } from './types';

const HUBSPOT_OBJECT_TYPES: Record<string, string> = {
  '0-1': 'contact',
  '0-2': 'company',
  '0-3': 'deal',
  '0-5': 'ticket',
  '0-7': 'product',
  '0-8': 'line_item',
  '0-14': 'quote',
  '0-18': 'communication',
  '0-19': 'feedback_submission',
  '0-27': 'task',
  '0-46': 'note',
  '0-47': 'meeting',
  '0-48': 'call',
  '0-49': 'email',
  '0-84': 'discount',
  '0-85': 'fee',
  '0-86': 'tax',
  '0-53': 'invoice',
  '0-69': 'subscription',
  '0-74': 'goal',
  '0-101': 'payment',
  '0-115': 'user',
  '0-116': 'postal_mail',
  '0-123': 'order',
  '0-136': 'lead',
  '0-142': 'cart',
  '0-162': 'service',
  '0-410': 'course',
  '0-420': 'listing',
  '0-421': 'appointment',
  '0-970': 'project',
};

function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function parseLinkedIn(url: URL): PageRecord | null {
  if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
  const match = stripTrailingSlash(url.pathname).match(/^\/in\/([^/]+)$/i);
  if (!match?.[1]) return null;

  return {
    source: 'linkedin',
    url: `https://www.linkedin.com/in/${match[1]}`,
    record_id: null,
    object_type: 'person',
  };
}

function parseHubSpot(url: URL): PageRecord | null {
  if (!/^app(?:-[a-z0-9]+)?\.hubspot\.com$/i.test(url.hostname)) return null;
  const match = stripTrailingSlash(url.pathname).match(
    /^\/contacts\/(\d+)\/record\/(\d+-\d+)\/(\d+)(?:\/.*)?$/i,
  );
  if (!match?.[1] || !match[2] || !match[3]) return null;

  const [, hubId, objectTypeId, recordId] = match;
  return {
    source: 'hubspot',
    url: `${url.origin}/contacts/${hubId}/record/${objectTypeId}/${recordId}`,
    record_id: recordId,
    object_type: HUBSPOT_OBJECT_TYPES[objectTypeId] ?? objectTypeId,
  };
}

function parseSalesforce(url: URL): PageRecord | null {
  if (!/(?:\.salesforce\.com|\.force\.com)$/i.test(url.hostname)) return null;
  const match = stripTrailingSlash(url.pathname).match(
    /^\/lightning\/r\/([A-Za-z][A-Za-z0-9_]*)\/([A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?)\/view$/,
  );
  if (!match?.[1] || !match[2]) return null;

  const [, objectType, recordId] = match;
  return {
    source: 'salesforce',
    url: `${url.origin}/lightning/r/${objectType}/${recordId}/view`,
    record_id: recordId,
    object_type: objectType,
  };
}

function parseAttio(url: URL): PageRecord | null {
  if (url.hostname.toLowerCase() !== 'app.attio.com') return null;
  const match = stripTrailingSlash(url.pathname).match(
    /^\/([^/]+)\/([^/]+)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
  );
  if (!match?.[1] || !match[2] || !match[3]) return null;

  const [, workspace, objectType, recordId] = match;
  return {
    source: 'attio',
    url: `${url.origin}/${workspace}/${objectType}/${recordId}`,
    record_id: recordId,
    object_type: objectType,
  };
}

export function parsePageRecord(input: string): PageRecord | null {
  if (input.length > MAX_MATCH_URL_LENGTH) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return parseLinkedIn(url) ?? parseHubSpot(url) ?? parseSalesforce(url) ?? parseAttio(url);
  } catch {
    return null;
  }
}

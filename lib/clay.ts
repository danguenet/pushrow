import { SEND_TIMEOUT_MS } from './constants';
import { validateAuth, validateClayWebhookUrl } from './destinations';
import type { Destination, PageRecord, SendErrorCode, SendResult } from './types';

export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function codeForStatus(status: number): SendErrorCode {
  if (status === 400) return 'bad_request';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  return status >= 500 ? 'server' : 'bad_request';
}

export async function postToClay(
  destination: Destination,
  record: PageRecord,
  fetcher: Fetcher = fetch,
  timeoutMs = SEND_TIMEOUT_MS,
): Promise<SendResult> {
  let endpoint: string;
  try {
    endpoint = validateClayWebhookUrl(destination.url);
  } catch {
    return { ok: false, code: 'destination_missing' };
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (destination.auth) {
    try {
      const auth = validateAuth(destination.auth.headerName, destination.auth.value);
      if (auth) headers.set(auth.headerName, auth.value);
    } catch {
      return { ok: false, code: 'auth' };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(record),
      signal: controller.signal,
    });
    if (response.ok) return { ok: true, status: response.status };
    return { ok: false, code: codeForStatus(response.status), status: response.status };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network',
    };
  } finally {
    clearTimeout(timeout);
  }
}

import { DEFAULT_AUTH_HEADER } from './constants';
import type { DestinationAuth } from './types';

const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const BLOCKED_HEADERS = new Set([
  'content-type',
  'content-length',
  'host',
  'origin',
  'referer',
  'cookie',
  'connection',
  'transfer-encoding',
]);

export class DestinationInputError extends Error {
  override name = 'DestinationInputError';
}

export function validateClayWebhookUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new DestinationInputError('Enter a valid Clay webhook URL.');
  }

  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'api.clay.com') {
    throw new DestinationInputError('The webhook must use https://api.clay.com.');
  }
  if (url.username || url.password) {
    throw new DestinationInputError('Credentials cannot be embedded in the webhook URL.');
  }
  if (!url.pathname.toLowerCase().includes('/sources/webhook/')) {
    throw new DestinationInputError('This does not look like a Clay webhook endpoint.');
  }

  url.hash = '';
  return url.toString();
}

export function validateAuth(headerName: string, value: string): DestinationAuth | null {
  const name = headerName.trim();
  const secret = value.trim();
  if (!name && !secret) return null;
  if (!name || !secret) {
    throw new DestinationInputError('Provide both an authentication header and its value.');
  }

  const lower = name.toLowerCase();
  if (
    !HEADER_NAME.test(name) ||
    BLOCKED_HEADERS.has(lower) ||
    lower.startsWith('proxy-') ||
    lower.startsWith('sec-')
  ) {
    throw new DestinationInputError('That authentication header is not allowed.');
  }

  return { headerName: name, value: secret };
}

export interface ParsedDestinationInput {
  url: string;
  headerName: string;
  headerValue: string;
}

function rejectShellSyntax(input: string): void {
  if (/`|\$\(/.test(input)) {
    throw new DestinationInputError('Shell commands are not supported. Paste only one Clay cURL.');
  }

  const normalized = input.replace(/\\\r?\n/g, ' ');
  let quote: "'" | '"' | null = null;
  let escaping = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (character === '\\' && quote !== "'") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (
      character === ';' ||
      character === '\n' ||
      character === '\r' ||
      (character === '&' && normalized[index + 1] === '&') ||
      (character === '|' && normalized[index + 1] === '|')
    ) {
      throw new DestinationInputError(
        'Shell commands are not supported. Paste only one Clay cURL.',
      );
    }
  }
}

function tokenizeShell(input: string): string[] {
  const normalized = input.replace(/\\\r?\n/g, ' ');
  const tokens: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let escaping = false;

  for (const character of normalized) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }
    if (character === '\\' && quote !== "'") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      else current += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += character;
  }

  if (escaping || quote) throw new DestinationInputError('The cURL contains an unfinished quote.');
  if (current) tokens.push(current);
  return tokens;
}

function splitHeader(input: string): { name: string; value: string } | null {
  const colon = input.indexOf(':');
  if (colon <= 0) return null;
  return { name: input.slice(0, colon).trim(), value: input.slice(colon + 1).trim() };
}

export function parseDestinationInput(input: string): ParsedDestinationInput {
  const trimmed = input.trim();
  if (!trimmed) throw new DestinationInputError('Paste a Clay webhook URL or cURL.');

  if (!/^curl(?:\s|$)/i.test(trimmed)) {
    return {
      url: validateClayWebhookUrl(trimmed),
      headerName: DEFAULT_AUTH_HEADER,
      headerValue: '',
    };
  }

  rejectShellSyntax(trimmed);
  const tokens = tokenizeShell(trimmed);
  if (tokens[0]?.toLowerCase() !== 'curl') {
    throw new DestinationInputError('The pasted command must begin with curl.');
  }

  let url = '';
  const headers: Array<{ name: string; value: string }> = [];
  const skipValueFlags = new Set([
    '-d',
    '--data',
    '--data-raw',
    '--data-binary',
    '--data-urlencode',
    '-x',
    '-X',
    '--request',
    '--user-agent',
  ]);

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (token === '--url' && tokens[index + 1]) {
      url = tokens[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (token.startsWith('--url=')) {
      url = token.slice(6);
      continue;
    }
    if ((token === '-H' || token === '--header') && tokens[index + 1]) {
      const header = splitHeader(tokens[index + 1] ?? '');
      if (header) headers.push(header);
      index += 1;
      continue;
    }
    if (token.startsWith('-H') && token.length > 2) {
      const header = splitHeader(token.slice(2));
      if (header) headers.push(header);
      continue;
    }
    if (skipValueFlags.has(token) && tokens[index + 1]) {
      index += 1;
      continue;
    }
    if (!url && /^https:\/\//i.test(token)) url = token;
  }

  if (!url) throw new DestinationInputError('No webhook URL was found in the cURL.');

  const candidates = headers.filter(({ name, value }) => {
    const lower = name.toLowerCase();
    return Boolean(value) && lower !== 'content-type' && lower !== 'accept';
  });
  const auth =
    candidates.find(({ name }) => name.toLowerCase() === DEFAULT_AUTH_HEADER) ??
    candidates.find(({ name }) => name.toLowerCase() === 'authorization') ??
    (candidates.length === 1 ? candidates[0] : undefined);

  return {
    url: validateClayWebhookUrl(url),
    headerName: auth?.name ?? DEFAULT_AUTH_HEADER,
    headerValue: auth?.value ?? '',
  };
}

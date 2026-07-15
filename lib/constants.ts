export const STORAGE_KEY = 'posthook_state';
export const CLAY_ORIGIN_PATTERN = 'https://api.clay.com/*';
export const DEFAULT_AUTH_HEADER = 'x-clay-webhook-auth';
export const MAX_REGEX_LENGTH = 256;
export const MAX_MATCH_URL_LENGTH = 2048;
export const SEND_TIMEOUT_MS = 12_000;

export const SOURCE_LABELS = {
  linkedin: 'LinkedIn',
  hubspot: 'HubSpot',
  salesforce: 'Salesforce',
  attio: 'Attio',
} as const;

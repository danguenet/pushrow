export const APP_SCHEMA_VERSION = 1 as const;

export type Source = 'linkedin' | 'hubspot' | 'salesforce' | 'attio';

export interface PageRecord {
  source: Source;
  url: string;
  record_id: string | null;
  object_type: string;
}

export interface DestinationAuth {
  headerName: string;
  value: string;
}

export interface Destination {
  id: string;
  name: string;
  url: string;
  auth: DestinationAuth | null;
  createdAt: string;
  updatedAt: string;
}

export type RuleMatcher =
  { kind: 'guided'; source: Source; objectType?: string } | { kind: 'regex'; pattern: string };

export interface RoutingRule {
  id: string;
  name: string;
  destinationId: string;
  enabled: boolean;
  priority: number;
  matcher: RuleMatcher;
}

export interface AppState {
  schemaVersion: typeof APP_SCHEMA_VERSION;
  destinations: Destination[];
  rules: RoutingRule[];
}

export type SendErrorCode =
  | 'permission'
  | 'bad_request'
  | 'auth'
  | 'not_found'
  | 'rate_limited'
  | 'server'
  | 'timeout'
  | 'network'
  | 'invalid_message'
  | 'destination_missing';

export type SendResult =
  { ok: true; status: number } | { ok: false; code: SendErrorCode; status?: number };

export interface SendRecordMessage {
  type: 'posthook:send-record';
  destinationId: string;
  record: PageRecord;
}

export type RuntimeMessage = SendRecordMessage;

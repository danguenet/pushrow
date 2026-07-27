export const APP_SCHEMA_VERSION = 1 as const;
export const ACTIVITY_SCHEMA_VERSION = 1 as const;

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

export interface ActivityEntry {
  id: string;
  attemptedAt: string;
  destination: {
    id: string;
    name: string;
  };
  request: PageRecord;
  result: SendResult;
}

export interface ActivityState {
  schemaVersion: typeof ACTIVITY_SCHEMA_VERSION;
  limit: number;
  entries: ActivityEntry[];
}

export interface SendRecordMessage {
  type: 'pushrow:send-record';
  destinationId: string;
  record: PageRecord;
}

export interface GetActivityMessage {
  type: 'pushrow:get-activity';
}

export interface SetActivityLimitMessage {
  type: 'pushrow:set-activity-limit';
  limit: number;
}

export interface ClearActivityMessage {
  type: 'pushrow:clear-activity';
}

export interface ResetActivityMessage {
  type: 'pushrow:reset-activity';
}

export interface UpsertDestinationMessage {
  type: 'pushrow:upsert-destination';
  destination: Destination;
}

export interface DeleteDestinationMessage {
  type: 'pushrow:delete-destination';
  destinationId: string;
}

export interface UpsertRuleMessage {
  type: 'pushrow:upsert-rule';
  rule: RoutingRule;
  insertAtTop?: boolean;
}

export interface DeleteRuleMessage {
  type: 'pushrow:delete-rule';
  ruleId: string;
}

export interface ReplaceRulesMessage {
  type: 'pushrow:replace-rules';
  rules: RoutingRule[];
}

export interface ResetAllDataMessage {
  type: 'pushrow:reset-all-data';
}

export type RuntimeMessage =
  | SendRecordMessage
  | GetActivityMessage
  | SetActivityLimitMessage
  | ClearActivityMessage
  | ResetActivityMessage
  | UpsertDestinationMessage
  | DeleteDestinationMessage
  | UpsertRuleMessage
  | DeleteRuleMessage
  | ReplaceRulesMessage
  | ResetAllDataMessage;

export interface RuntimeResponseMap {
  'pushrow:send-record': SendResult;
  'pushrow:get-activity': ActivityState;
  'pushrow:set-activity-limit': ActivityState;
  'pushrow:clear-activity': ActivityState;
  'pushrow:reset-activity': ActivityState;
  'pushrow:upsert-destination': AppState;
  'pushrow:delete-destination': AppState;
  'pushrow:upsert-rule': AppState;
  'pushrow:delete-rule': AppState;
  'pushrow:replace-rules': AppState;
  'pushrow:reset-all-data': { state: AppState; activity: ActivityState };
}

export type RuntimeResponse<Message extends RuntimeMessage> = RuntimeResponseMap[Message['type']];

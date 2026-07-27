import type { Source } from '@/shared/types';

export type Tab = 'destinations' | 'rules' | 'activity' | 'data';
export type Notice = { kind: 'success' | 'error'; message: string } | null;

export interface DestinationErrors {
  name?: string | undefined;
  input?: string | undefined;
  auth?: string | undefined;
}

export interface RuleErrors {
  name?: string | undefined;
  destination?: string | undefined;
  pattern?: string | undefined;
}

export interface DestinationDraft {
  id: string | null;
  name: string;
  connectionInput: string;
  url: string;
  headerName: string;
  headerValue: string;
  createdAt: string | null;
}

export interface RuleDraft {
  id: string | null;
  name: string;
  destinationId: string;
  kind: 'guided' | 'regex';
  source: Source;
  objectType: string;
  pattern: string;
  testUrl: string;
}

import { RE2JS } from 're2js';
import { MAX_MATCH_URL_LENGTH, MAX_REGEX_LENGTH } from './constants';
import type { Destination, PageRecord, RoutingRule } from './types';

export interface RuleRecommendation {
  destination: Destination;
  rule: RoutingRule;
}

export interface RegexValidation {
  valid: boolean;
  message?: string;
}

export function validateRegexPattern(pattern: string): RegexValidation {
  if (!pattern.trim()) return { valid: false, message: 'Enter a URL pattern.' };
  if (pattern.length > MAX_REGEX_LENGTH) {
    return { valid: false, message: `Patterns can be at most ${MAX_REGEX_LENGTH} characters.` };
  }
  try {
    RE2JS.compile(pattern, RE2JS.CASE_INSENSITIVE);
    return { valid: true };
  } catch {
    return {
      valid: false,
      message:
        'Use a valid RE2-compatible pattern (lookarounds and backreferences are unsupported).',
    };
  }
}

export function ruleMatches(rule: RoutingRule, record: PageRecord): boolean {
  if (!rule.enabled) return false;
  if (rule.matcher.kind === 'guided') {
    if (rule.matcher.source !== record.source) return false;
    const objectType = rule.matcher.objectType?.trim();
    return !objectType || objectType.toLowerCase() === record.object_type.toLowerCase();
  }

  if (!validateRegexPattern(rule.matcher.pattern).valid) return false;
  return RE2JS.compile(rule.matcher.pattern, RE2JS.CASE_INSENSITIVE).test(
    record.url.slice(0, MAX_MATCH_URL_LENGTH),
  );
}

export function getRecommendations(
  record: PageRecord,
  destinations: Destination[],
  rules: RoutingRule[],
): RuleRecommendation[] {
  const destinationMap = new Map(destinations.map((destination) => [destination.id, destination]));
  const seen = new Set<string>();

  return [...rules]
    .sort((left, right) => left.priority - right.priority)
    .flatMap((rule) => {
      if (!ruleMatches(rule, record) || seen.has(rule.destinationId)) return [];
      const destination = destinationMap.get(rule.destinationId);
      if (!destination) return [];
      seen.add(rule.destinationId);
      return [{ destination, rule }];
    });
}

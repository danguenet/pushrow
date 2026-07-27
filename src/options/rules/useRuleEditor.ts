import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { sendRuntimeMessage } from '@/platform/runtime';
import { parsePageRecord } from '@/shared/page-record';
import { ruleMatches, validateRegexPattern } from '@/shared/rules';
import type { AppState, RoutingRule, RuleMatcher } from '@/shared/types';
import type { Notice, RuleDraft, RuleErrors } from '../types';

const NEW_RULE: RuleDraft = {
  id: null,
  name: '',
  destinationId: '',
  kind: 'guided',
  source: 'linkedin',
  objectType: '',
  pattern: '',
  testUrl: '',
};

function routingRuleDraft(rule: RoutingRule): RuleDraft {
  return {
    id: rule.id,
    name: rule.name,
    destinationId: rule.destinationId,
    kind: rule.matcher.kind,
    source: rule.matcher.kind === 'guided' ? rule.matcher.source : 'linkedin',
    objectType: rule.matcher.kind === 'guided' ? (rule.matcher.objectType ?? '') : '',
    pattern: rule.matcher.kind === 'regex' ? rule.matcher.pattern : '',
    testUrl: '',
  };
}

export function useRuleEditor(state: AppState, setNotice: Dispatch<SetStateAction<Notice>>) {
  const [rule, setRule] = useState<RuleDraft>(NEW_RULE);
  const [errors, setErrors] = useState<RuleErrors>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const operationInFlight = useRef(false);
  const selectedDestinationId = rule.destinationId || state.destinations[0]?.id || '';

  const parsedTestRecord = useMemo(
    () => (rule.testUrl.trim() ? parsePageRecord(rule.testUrl.trim()) : null),
    [rule.testUrl],
  );
  const testResult = useMemo(() => {
    if (!rule.testUrl.trim()) return null;
    if (!parsedTestRecord) return { matches: false, message: 'Not a supported record URL.' };
    const matcher: RuleMatcher =
      rule.kind === 'guided'
        ? {
            kind: 'guided',
            source: rule.source,
            ...(rule.objectType.trim() ? { objectType: rule.objectType.trim() } : {}),
          }
        : { kind: 'regex', pattern: rule.pattern };
    const matches = ruleMatches(
      {
        id: 'preview',
        name: 'Preview',
        destinationId: selectedDestinationId,
        enabled: true,
        priority: 0,
        matcher,
      },
      parsedTestRecord,
    );
    return { matches, message: matches ? 'This rule matches.' : 'This rule does not match.' };
  }, [parsedTestRecord, rule, selectedDestinationId]);

  const dirty = useMemo(() => {
    const existing = rule.id ? state.rules.find(({ id }) => id === rule.id) : null;
    const baseline = existing
      ? routingRuleDraft(existing)
      : { ...NEW_RULE, destinationId: state.destinations[0]?.id ?? '' };
    return (
      JSON.stringify({
        ...rule,
        destinationId: rule.destinationId || state.destinations[0]?.id || '',
        testUrl: '',
      }) !== JSON.stringify(baseline)
    );
  }, [rule, state.destinations, state.rules]);

  const confirmDiscard = () =>
    !dirty || window.confirm('Discard your unsaved routing rule changes?');

  const clear = () => {
    setRule({ ...NEW_RULE, destinationId: state.destinations[0]?.id ?? '' });
    setErrors({});
    setNotice(null);
    setOpen(false);
  };

  const reset = () => {
    if (confirmDiscard()) clear();
  };

  const create = () => {
    if (!confirmDiscard()) return;
    clear();
    setOpen(true);
  };

  const select = (item: RoutingRule) => {
    if (!confirmDiscard()) return;
    setRule(routingRuleDraft(item));
    setErrors({});
    setNotice(null);
    setOpen(true);
  };

  const save = async () => {
    if (operationInFlight.current) return;
    const name = rule.name.trim();
    setErrors({});
    if (!name || !selectedDestinationId) {
      setErrors({
        ...(!name ? { name: 'Add a rule name.' } : {}),
        ...(!selectedDestinationId ? { destination: 'Choose a destination.' } : {}),
      });
      setNotice({ kind: 'error', message: 'Add a rule name and destination.' });
      return;
    }

    let matcher: RuleMatcher;
    if (rule.kind === 'regex') {
      const validation = validateRegexPattern(rule.pattern);
      if (!validation.valid) {
        setErrors({ pattern: validation.message ?? 'Invalid URL pattern.' });
        setNotice({ kind: 'error', message: validation.message ?? 'Invalid URL pattern.' });
        return;
      }
      matcher = { kind: 'regex', pattern: rule.pattern };
    } else {
      matcher = {
        kind: 'guided',
        source: rule.source,
        ...(rule.objectType.trim() ? { objectType: rule.objectType.trim() } : {}),
      };
    }

    operationInFlight.current = true;
    setBusy(true);
    try {
      const existing = state.rules.find(({ id }) => id === rule.id);
      await sendRuntimeMessage({
        type: 'pushrow:upsert-rule',
        rule: {
          id: rule.id ?? crypto.randomUUID(),
          name,
          destinationId: selectedDestinationId,
          enabled: existing?.enabled ?? true,
          priority: existing?.priority ?? state.rules.length,
          matcher,
        },
      });
      clear();
      setNotice({ kind: 'success', message: `${name} was saved.` });
    } catch {
      setNotice({ kind: 'error', message: `Could not save ${name}.` });
    } finally {
      operationInFlight.current = false;
      setBusy(false);
    }
  };

  const replace = (rules: RoutingRule[]) =>
    sendRuntimeMessage({ type: 'pushrow:replace-rules', rules });

  const runMutation = async (
    mutation: () => Promise<unknown>,
    errorMessage: string,
  ): Promise<boolean> => {
    if (operationInFlight.current) return false;
    operationInFlight.current = true;
    setBusy(true);
    try {
      await mutation();
      return true;
    } catch {
      setNotice({ kind: 'error', message: errorMessage });
      return false;
    } finally {
      operationInFlight.current = false;
      setBusy(false);
    }
  };

  const toggle = async (item: RoutingRule) => {
    await runMutation(
      () =>
        replace(
          state.rules.map((candidate) =>
            candidate.id === item.id ? { ...candidate, enabled: !candidate.enabled } : candidate,
          ),
        ),
      `Could not ${item.enabled ? 'disable' : 'enable'} ${item.name}.`,
    );
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= state.rules.length) return;
    const next = [...state.rules];
    const currentRule = next[index];
    const targetRule = next[target];
    if (!currentRule || !targetRule) return;
    next[index] = targetRule;
    next[target] = currentRule;
    await runMutation(() => replace(next), `Could not move ${currentRule.name}.`);
  };

  const remove = async (item: RoutingRule) => {
    if (!window.confirm(`Delete routing rule “${item.name}”?`)) return;
    const removed = await runMutation(
      () => sendRuntimeMessage({ type: 'pushrow:delete-rule', ruleId: item.id }),
      `Could not delete ${item.name}.`,
    );
    if (removed) {
      if (rule.id === item.id) clear();
      setNotice({ kind: 'success', message: `${item.name} was deleted.` });
    }
  };

  return {
    rule,
    setRule,
    errors,
    setErrors,
    selectedDestinationId,
    testResult,
    dirty,
    busy,
    open,
    confirmDiscard,
    clear,
    reset,
    create,
    select,
    save,
    toggle,
    move,
    remove,
  };
}

export type RuleEditor = ReturnType<typeof useRuleEditor>;

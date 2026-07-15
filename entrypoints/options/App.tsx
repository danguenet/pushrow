import {
  ArrowDown,
  ArrowUp,
  Check,
  Database,
  Eye,
  EyeOff,
  FileInput,
  Info,
  Pencil,
  Plus,
  Route,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_AUTH_HEADER, SOURCE_LABELS } from '@/lib/constants';
import {
  DestinationInputError,
  parseDestinationInput,
  validateAuth,
  validateClayWebhookUrl,
} from '@/lib/destinations';
import { parsePageRecord } from '@/lib/page-record';
import { requestClayPermission, revokeClayPermission } from '@/lib/permissions';
import { ruleMatches, validateRegexPattern } from '@/lib/rules';
import {
  EMPTY_STATE,
  clearState,
  deleteDestination,
  deleteRule,
  getState,
  replaceRules,
  subscribeState,
  upsertDestination,
  upsertRule,
} from '@/lib/storage';
import type { AppState, Destination, RoutingRule, RuleMatcher, Source } from '@/lib/types';

type Tab = 'destinations' | 'rules';
type Notice = { kind: 'success' | 'error'; message: string } | null;

interface DestinationDraft {
  id: string | null;
  name: string;
  pastedInput: string;
  url: string;
  headerName: string;
  headerValue: string;
  createdAt: string | null;
}

interface RuleDraft {
  id: string | null;
  name: string;
  destinationId: string;
  kind: 'guided' | 'regex';
  source: Source;
  objectType: string;
  pattern: string;
  testUrl: string;
}

const NEW_DESTINATION: DestinationDraft = {
  id: null,
  name: '',
  pastedInput: '',
  url: '',
  headerName: DEFAULT_AUTH_HEADER,
  headerValue: '',
  createdAt: null,
};

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

function destinationDraft(destination: Destination): DestinationDraft {
  return {
    id: destination.id,
    name: destination.name,
    pastedInput: destination.url,
    url: destination.url,
    headerName: destination.auth?.headerName ?? DEFAULT_AUTH_HEADER,
    headerValue: destination.auth?.value ?? '',
    createdAt: destination.createdAt,
  };
}

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

function destinationHost(url: string): string {
  try {
    const parsed = new URL(url);
    const tail = parsed.pathname.split('/').filter(Boolean).at(-1)?.slice(-8);
    return `${parsed.hostname} · …${tail ?? ''}`;
  } catch {
    return 'Invalid endpoint';
  }
}

function NoticeBar({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <div className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.kind === 'success' ? <Check size={16} /> : <Info size={16} />}
      <span>{notice.message}</span>
    </div>
  );
}

export function App() {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [tab, setTab] = useState<Tab>('destinations');
  const [destination, setDestination] = useState<DestinationDraft>(NEW_DESTINATION);
  const [rule, setRule] = useState<RuleDraft>(NEW_RULE);
  const [showSecret, setShowSecret] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getState().then(setState);
    return subscribeState(setState);
  }, []);

  const selectedRuleDestinationId = rule.destinationId || state.destinations[0]?.id || '';

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
        destinationId: selectedRuleDestinationId,
        enabled: true,
        priority: 0,
        matcher,
      },
      parsedTestRecord,
    );
    return { matches, message: matches ? 'This rule matches.' : 'This rule does not match.' };
  }, [parsedTestRecord, rule, selectedRuleDestinationId]);

  const resetDestination = () => {
    setDestination(NEW_DESTINATION);
    setShowSecret(false);
    setNotice(null);
  };

  const resetRule = () => {
    setRule({ ...NEW_RULE, destinationId: state.destinations[0]?.id ?? '' });
    setNotice(null);
  };

  const importDestination = () => {
    try {
      const parsed = parseDestinationInput(destination.pastedInput);
      setDestination((current) => ({
        ...current,
        url: parsed.url,
        headerName: parsed.headerName,
        headerValue: parsed.headerValue,
      }));
      setNotice({ kind: 'success', message: 'Webhook details parsed. Review them before saving.' });
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not parse this destination.',
      });
    }
  };

  const saveDestination = async () => {
    const name = destination.name.trim();
    if (!name) {
      setNotice({ kind: 'error', message: 'Give this Clay destination a name.' });
      return;
    }

    try {
      const parsed = destination.url
        ? {
            url: validateClayWebhookUrl(destination.url),
            headerName: destination.headerName,
            headerValue: destination.headerValue,
          }
        : parseDestinationInput(destination.pastedInput);
      const auth = validateAuth(parsed.headerName, parsed.headerValue);
      setSaving(true);
      const granted = await requestClayPermission();
      if (!granted)
        throw new DestinationInputError('Clay access is required to save a destination.');
      const now = new Date().toISOString();
      await upsertDestination({
        id: destination.id ?? crypto.randomUUID(),
        name,
        url: parsed.url,
        auth,
        createdAt: destination.createdAt ?? now,
        updatedAt: now,
      });
      resetDestination();
      setNotice({ kind: 'success', message: `${name} is ready to receive records.` });
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not save this destination.',
      });
    } finally {
      setSaving(false);
    }
  };

  const removeDestination = async (item: Destination) => {
    if (!window.confirm(`Delete “${item.name}” and its routing rules?`)) return;
    const shouldRevoke = state.destinations.length === 1;
    await deleteDestination(item.id);
    if (shouldRevoke) await revokeClayPermission();
    if (destination.id === item.id) resetDestination();
    setNotice({ kind: 'success', message: `${item.name} was deleted.` });
  };

  const saveRule = async () => {
    const name = rule.name.trim();
    if (!name || !selectedRuleDestinationId) {
      setNotice({ kind: 'error', message: 'Add a rule name and destination.' });
      return;
    }
    let matcher: RuleMatcher;
    if (rule.kind === 'regex') {
      const validation = validateRegexPattern(rule.pattern);
      if (!validation.valid) {
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

    const existing = state.rules.find(({ id }) => id === rule.id);
    await upsertRule({
      id: rule.id ?? crypto.randomUUID(),
      name,
      destinationId: selectedRuleDestinationId,
      enabled: existing?.enabled ?? true,
      priority: existing?.priority ?? state.rules.length,
      matcher,
    });
    resetRule();
    setNotice({ kind: 'success', message: `${name} was saved.` });
  };

  const toggleRule = async (item: RoutingRule) => {
    await replaceRules(
      state.rules.map((candidate) =>
        candidate.id === item.id ? { ...candidate, enabled: !candidate.enabled } : candidate,
      ),
    );
  };

  const moveRule = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= state.rules.length) return;
    const next = [...state.rules];
    const currentRule = next[index];
    const targetRule = next[target];
    if (!currentRule || !targetRule) return;
    next[index] = targetRule;
    next[target] = currentRule;
    await replaceRules(next);
  };

  const removeRule = async (item: RoutingRule) => {
    if (!window.confirm(`Delete routing rule “${item.name}”?`)) return;
    await deleteRule(item.id);
    if (rule.id === item.id) resetRule();
    setNotice({ kind: 'success', message: `${item.name} was deleted.` });
  };

  const deleteAllData = async () => {
    if (!window.confirm('Delete every destination, token, and routing rule from this device?'))
      return;
    await clearState();
    await revokeClayPermission();
    resetDestination();
    resetRule();
    setNotice({ kind: 'success', message: 'All local Posthook data was deleted.' });
  };

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div className="brand-lockup">
          <img src="/icon-48.png" alt="" width="42" height="42" />
          <div>
            <h1>Posthook</h1>
            <p>Send the record in your active tab to the right Clay table.</p>
          </div>
        </div>
        <div className="privacy-badge">
          <ShieldCheck size={17} /> Local-only settings
        </div>
      </header>

      <nav className="tabs" aria-label="Settings sections">
        <button
          className={tab === 'destinations' ? 'active' : ''}
          onClick={() => {
            setTab('destinations');
            setNotice(null);
          }}
        >
          <Database size={17} /> Destinations <span>{state.destinations.length}</span>
        </button>
        <button
          className={tab === 'rules' ? 'active' : ''}
          onClick={() => {
            setTab('rules');
            setNotice(null);
          }}
        >
          <Route size={17} /> Routing rules <span>{state.rules.length}</span>
        </button>
      </nav>

      <NoticeBar notice={notice} />

      {tab === 'destinations' ? (
        <div className="settings-grid">
          <section className="list-panel" aria-labelledby="destination-list-title">
            <div className="panel-heading">
              <div>
                <h2 id="destination-list-title">Clay destinations</h2>
                <p>Each destination is one table webhook.</p>
              </div>
              <button className="small-button" type="button" onClick={resetDestination}>
                <Plus size={15} /> New
              </button>
            </div>
            {state.destinations.length ? (
              <div className="item-list">
                {state.destinations.map((item) => (
                  <div
                    className={`item-row${destination.id === item.id ? ' selected' : ''}`}
                    key={item.id}
                  >
                    <div className="item-icon">
                      <Database size={17} />
                    </div>
                    <div className="item-copy">
                      <strong>{item.name}</strong>
                      <span>{destinationHost(item.url)}</span>
                    </div>
                    <span
                      className={`auth-dot${item.auth ? ' protected' : ''}`}
                      title={item.auth ? 'Authentication configured' : 'No authentication'}
                    />
                    <button
                      className="row-action"
                      type="button"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => {
                        setDestination(destinationDraft(item));
                        setNotice(null);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="row-action danger"
                      type="button"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => void removeDestination(item)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel-empty">
                <Database size={23} />
                <strong>No destinations yet</strong>
                <span>Add the webhook from a Clay table to get started.</span>
              </div>
            )}
          </section>

          <section className="form-panel" aria-labelledby="destination-form-title">
            <div className="panel-heading">
              <div>
                <h2 id="destination-form-title">
                  {destination.id ? 'Edit destination' : 'Add destination'}
                </h2>
                <p>Paste the URL or the complete cURL from Clay.</p>
              </div>
              {destination.id ? (
                <button
                  className="icon-close"
                  type="button"
                  onClick={resetDestination}
                  aria-label="Close editor"
                >
                  <X size={17} />
                </button>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="destination-name">Name</label>
              <input
                id="destination-name"
                value={destination.name}
                maxLength={60}
                placeholder="Outbound prospects"
                onChange={(event) => setDestination({ ...destination, name: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="destination-input">Clay webhook URL or cURL</label>
              <textarea
                id="destination-input"
                rows={5}
                value={destination.pastedInput}
                placeholder="https://api.clay.com/v3/sources/webhook/…"
                onChange={(event) =>
                  setDestination({ ...destination, pastedInput: event.target.value })
                }
              />
              <div className="field-actions">
                <span>The request body in a pasted cURL is ignored.</span>
                <button className="text-button" type="button" onClick={importDestination}>
                  <FileInput size={14} /> Parse details
                </button>
              </div>
            </div>

            {destination.url ? (
              <div className="parsed-fields">
                <div className="parsed-heading">
                  <Sparkles size={15} /> Parsed webhook details
                </div>
                <div className="field">
                  <label htmlFor="webhook-url">Webhook URL</label>
                  <input
                    id="webhook-url"
                    value={destination.url}
                    onChange={(event) =>
                      setDestination({ ...destination, url: event.target.value })
                    }
                  />
                </div>
                <div className="two-fields">
                  <div className="field">
                    <label htmlFor="header-name">Authentication header</label>
                    <input
                      id="header-name"
                      value={destination.headerName}
                      onChange={(event) =>
                        setDestination({ ...destination, headerName: event.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="header-value">Token or header value</label>
                    <div className="password-field">
                      <input
                        id="header-value"
                        type={showSecret ? 'text' : 'password'}
                        value={destination.headerValue}
                        placeholder="Optional"
                        onChange={(event) =>
                          setDestination({ ...destination, headerValue: event.target.value })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        aria-label={showSecret ? 'Hide token' : 'Show token'}
                      >
                        {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="storage-warning">
                  <Info size={14} /> Tokens stay in Chrome extension storage on this device. That
                  storage is private to Posthook, but it is not encrypted at rest.
                </p>
              </div>
            ) : null}

            <button
              className="primary-button"
              type="button"
              disabled={saving}
              onClick={() => void saveDestination()}
            >
              {saving ? 'Saving…' : destination.id ? 'Save changes' : 'Save destination'}
            </button>
          </section>
        </div>
      ) : (
        <div className="settings-grid">
          <section className="list-panel" aria-labelledby="rules-list-title">
            <div className="panel-heading">
              <div>
                <h2 id="rules-list-title">Routing priority</h2>
                <p>Every match is shown; the first match is preselected.</p>
              </div>
              <button
                className="small-button"
                type="button"
                disabled={!state.destinations.length}
                onClick={resetRule}
              >
                <Plus size={15} /> New
              </button>
            </div>
            {state.rules.length ? (
              <div className="rule-list">
                {state.rules.map((item, index) => (
                  <div className={`rule-row${item.enabled ? '' : ' disabled'}`} key={item.id}>
                    <div className="priority-controls">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => void moveRule(index, -1)}
                        aria-label={`Move ${item.name} up`}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <span>{index + 1}</span>
                      <button
                        type="button"
                        disabled={index === state.rules.length - 1}
                        onClick={() => void moveRule(index, 1)}
                        aria-label={`Move ${item.name} down`}
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                    <div className="item-copy">
                      <strong>{item.name}</strong>
                      <span>
                        {item.matcher.kind === 'guided'
                          ? `${SOURCE_LABELS[item.matcher.source]} · ${item.matcher.objectType || 'any record'}`
                          : `Regex · ${item.matcher.pattern}`}
                      </span>
                      <em>
                        →{' '}
                        {state.destinations.find(({ id }) => id === item.destinationId)?.name ??
                          'Missing destination'}
                      </em>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={() => void toggleRule(item)}
                      />
                      <span />
                    </label>
                    <button
                      className="row-action"
                      type="button"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => {
                        setRule(routingRuleDraft(item));
                        setNotice(null);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="row-action danger"
                      type="button"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => void removeRule(item)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel-empty">
                <Route size={23} />
                <strong>No routing rules yet</strong>
                <span>Create source rules or advanced URL regex patterns.</span>
              </div>
            )}
          </section>

          <section className="form-panel" aria-labelledby="rule-form-title">
            <div className="panel-heading">
              <div>
                <h2 id="rule-form-title">{rule.id ? 'Edit routing rule' : 'Add routing rule'}</h2>
                <p>Rules recommend a table. They never send automatically.</p>
              </div>
              {rule.id ? (
                <button
                  className="icon-close"
                  type="button"
                  onClick={resetRule}
                  aria-label="Close editor"
                >
                  <X size={17} />
                </button>
              ) : null}
            </div>

            {!state.destinations.length ? (
              <div className="inline-empty">
                <Info size={17} /> Add a Clay destination before creating routing rules.
              </div>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="rule-name">Rule name</label>
                  <input
                    id="rule-name"
                    maxLength={80}
                    value={rule.name}
                    placeholder="Salesforce contacts"
                    onChange={(event) => setRule({ ...rule, name: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rule-destination">Recommend destination</label>
                  <select
                    id="rule-destination"
                    value={selectedRuleDestinationId}
                    onChange={(event) => setRule({ ...rule, destinationId: event.target.value })}
                  >
                    {state.destinations.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <fieldset className="segmented-field">
                  <legend>Match type</legend>
                  <div>
                    <label>
                      <input
                        type="radio"
                        name="match-kind"
                        checked={rule.kind === 'guided'}
                        onChange={() => setRule({ ...rule, kind: 'guided' })}
                      />
                      <span>Guided</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="match-kind"
                        checked={rule.kind === 'regex'}
                        onChange={() => setRule({ ...rule, kind: 'regex' })}
                      />
                      <span>Advanced regex</span>
                    </label>
                  </div>
                </fieldset>

                {rule.kind === 'guided' ? (
                  <div className="two-fields">
                    <div className="field">
                      <label htmlFor="rule-source">Source</label>
                      <select
                        id="rule-source"
                        value={rule.source}
                        onChange={(event) =>
                          setRule({ ...rule, source: event.target.value as Source })
                        }
                      >
                        {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="rule-object">Object type</label>
                      <input
                        id="rule-object"
                        value={rule.objectType}
                        placeholder="Any record"
                        onChange={(event) => setRule({ ...rule, objectType: event.target.value })}
                      />
                      <span className="field-help">
                        Leave blank for every record from this source.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="field">
                    <label htmlFor="rule-pattern">URL regular expression</label>
                    <input
                      id="rule-pattern"
                      value={rule.pattern}
                      maxLength={256}
                      placeholder="/lightning/r/Contact/"
                      onChange={(event) => setRule({ ...rule, pattern: event.target.value })}
                    />
                    <span className="field-help">
                      Case-insensitive. Unsafe nested or repeated wildcards are rejected.
                    </span>
                  </div>
                )}

                <div className="test-box">
                  <label htmlFor="test-url">Test with a supported record URL</label>
                  <input
                    id="test-url"
                    value={rule.testUrl}
                    placeholder="Paste a LinkedIn or CRM record URL"
                    onChange={(event) => setRule({ ...rule, testUrl: event.target.value })}
                  />
                  {testResult ? (
                    <div className={testResult.matches ? 'test-match' : 'test-miss'}>
                      {testResult.matches ? <Check size={14} /> : <X size={14} />}
                      {testResult.message}
                    </div>
                  ) : null}
                </div>
                <button className="primary-button" type="button" onClick={() => void saveRule()}>
                  {rule.id ? 'Save changes' : 'Save routing rule'}
                </button>
              </>
            )}
          </section>
        </div>
      )}

      <section className="privacy-section">
        <div>
          <h2>Privacy and local data</h2>
          <p>
            Posthook stores only destinations, tokens, and routing rules on this device. It keeps no
            page or send history.
          </p>
        </div>
        <button className="danger-button" type="button" onClick={() => void deleteAllData()}>
          <Trash2 size={15} /> Delete all local data
        </button>
      </section>

      <footer className="settings-footer">
        Posthook is independent open-source software and is not affiliated with Clay, LinkedIn,
        HubSpot, Salesforce, or Attio.
      </footer>
    </main>
  );
}

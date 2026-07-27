import { ArrowDown, ArrowUp, Check, Info, Plus, Route, Trash2, X } from 'lucide-react';
import { useRef, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { SOURCE_LABELS } from '@/shared/constants';
import type { AppState, Source } from '@/shared/types';
import { useModalDialog } from '../useModalDialog';
import type { RuleEditor } from './useRuleEditor';

export function RulesPanel({ state, editor }: { state: AppState; editor: RuleEditor }) {
  const {
    rule,
    setRule,
    errors,
    setErrors,
    selectedDestinationId,
    testResult,
    open,
    busy,
    reset,
    create,
    select,
    save,
    toggle,
    move,
    remove,
  } = editor;
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement>(null);
  useModalDialog(open, dialogRef, returnFocusRef, reset);

  const rememberFocus = () => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) reset();
  };

  return (
    <div className="rules-workspace" id="rules-panel" role="tabpanel" aria-labelledby="rules-tab">
      <section className="rules-ledger" aria-labelledby="rules-list-title">
        <div className="ledger-heading">
          <div>
            <h2 id="rules-list-title">Routing rules</h2>
            <p>Rules are checked from top to bottom. The first match is suggested.</p>
          </div>
          <button
            className="primary-button ledger-add"
            type="button"
            disabled={!state.destinations.length}
            onClick={() => {
              rememberFocus();
              create();
            }}
          >
            <Plus size={17} /> Add routing rule
          </button>
        </div>

        {state.rules.length ? (
          <div className="rules-table-wrap">
            <table className="rules-table">
              <thead>
                <tr>
                  <th scope="col">Priority</th>
                  <th scope="col">Rule</th>
                  <th scope="col">Match</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {state.rules.map((item, index) => {
                  const destinationName =
                    state.destinations.find(({ id }) => id === item.destinationId)?.name ??
                    'Missing destination';
                  return (
                    <tr
                      className={`${item.enabled ? '' : 'disabled'}${open && rule.id === item.id ? ' selected' : ''}`}
                      key={item.id}
                      onClick={() => {
                        rememberFocus();
                        select(item);
                      }}
                    >
                      <td>
                        <div
                          className="priority-controls"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={busy || index === 0}
                            onClick={() => void move(index, -1)}
                            aria-label={`Move ${item.name} up`}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <span>{index + 1}</span>
                          <button
                            type="button"
                            disabled={busy || index === state.rules.length - 1}
                            onClick={() => void move(index, 1)}
                            aria-label={`Move ${item.name} down`}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          className="rule-select"
                          type="button"
                          aria-label={`Edit ${item.name}`}
                        >
                          <span className="item-icon">
                            <Route size={18} />
                          </span>
                          <span className="rule-name-copy">
                            <strong>{item.name}</strong>
                            <span>
                              {item.matcher.kind === 'guided' ? 'Guided match' : 'Regex match'}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="rule-cell">
                          <strong>
                            {item.matcher.kind === 'guided'
                              ? SOURCE_LABELS[item.matcher.source]
                              : 'URL pattern'}
                          </strong>
                          <span>
                            {item.matcher.kind === 'guided'
                              ? item.matcher.objectType || 'Any record'
                              : item.matcher.pattern}
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="rule-destination">{destinationName}</span>
                      </td>
                      <td>
                        <label className="switch" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`${item.enabled ? 'Disable' : 'Enable'} ${item.name}`}
                            checked={item.enabled}
                            disabled={busy}
                            onChange={() => void toggle(item)}
                          />
                          <span />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel-empty ledger-empty">
            <Route size={23} />
            <strong>
              {state.destinations.length ? 'No routing rules yet' : 'Add a destination first'}
            </strong>
            <span>
              {state.destinations.length
                ? 'Create a rule to suggest the right destination for each record.'
                : 'Routing rules need at least one Clay destination.'}
            </span>
          </div>
        )}

        <div className="ledger-privacy-note">
          <Info size={16} />
          <span>Rules only suggest a destination. You always choose when to send.</span>
        </div>
      </section>

      {open
        ? createPortal(
            <div className="modal-backdrop" onMouseDown={closeFromBackdrop}>
              <section
                ref={dialogRef}
                className="settings-modal rule-modal"
                role="dialog"
                tabIndex={-1}
                aria-modal="true"
                aria-labelledby="rule-form-title"
              >
                <div className="modal-heading">
                  <div>
                    <h2 id="rule-form-title">
                      {rule.id ? 'Edit routing rule' : 'Add routing rule'}
                    </h2>
                    <p>Set when this destination should be suggested.</p>
                  </div>
                  <button
                    className="icon-close"
                    type="button"
                    onClick={reset}
                    aria-label="Close editor"
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="modal-body">
                  <div className="field">
                    <label htmlFor="rule-name">Rule name</label>
                    <input
                      id="rule-name"
                      autoFocus
                      maxLength={80}
                      value={rule.name}
                      placeholder="Salesforce contacts"
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? 'rule-name-error' : undefined}
                      onChange={(event) => {
                        setRule({ ...rule, name: event.target.value });
                        setErrors((current) => ({ ...current, name: undefined }));
                      }}
                    />
                    {errors.name ? (
                      <span className="field-error" id="rule-name-error">
                        {errors.name}
                      </span>
                    ) : null}
                  </div>

                  <div className="field">
                    <label htmlFor="rule-destination">Recommend destination</label>
                    <select
                      id="rule-destination"
                      value={selectedDestinationId}
                      aria-invalid={Boolean(errors.destination)}
                      aria-describedby={errors.destination ? 'rule-destination-error' : undefined}
                      onChange={(event) => {
                        setRule({ ...rule, destinationId: event.target.value });
                        setErrors((current) => ({ ...current, destination: undefined }));
                      }}
                    >
                      {state.destinations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    {errors.destination ? (
                      <span className="field-error" id="rule-destination-error">
                        {errors.destination}
                      </span>
                    ) : null}
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
                        aria-invalid={Boolean(errors.pattern)}
                        aria-describedby={errors.pattern ? 'rule-pattern-error' : undefined}
                        onChange={(event) => {
                          setRule({ ...rule, pattern: event.target.value });
                          setErrors((current) => ({ ...current, pattern: undefined }));
                        }}
                      />
                      {errors.pattern ? (
                        <span className="field-error" id="rule-pattern-error">
                          {errors.pattern}
                        </span>
                      ) : null}
                      <span className="field-help">
                        Case-insensitive and evaluated with RE2. Lookarounds and backreferences are
                        not supported.
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
                </div>

                <div className="modal-actions">
                  {rule.id ? (
                    <button
                      className="danger-button"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const item = state.rules.find(({ id }) => id === rule.id);
                        if (item) void remove(item);
                      }}
                    >
                      <Trash2 size={15} /> Delete rule
                    </button>
                  ) : (
                    <span />
                  )}
                  <div>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={reset}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void save()}
                    >
                      {busy ? 'Saving…' : rule.id ? 'Save changes' : 'Save routing rule'}
                    </button>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

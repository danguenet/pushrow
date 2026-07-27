import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Database,
  Eye,
  EyeOff,
  Info,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ActivityState, AppState } from '@/shared/types';
import { activityResultLabel, activityTime } from '../activity/format';
import { useModalDialog } from '../useModalDialog';
import type { DestinationEditor } from './useDestinationEditor';

function destinationHost(url: string): string {
  try {
    const parsed = new URL(url);
    const tail = parsed.pathname.split('/').filter(Boolean).at(-1)?.slice(-8);
    return `${parsed.hostname} · …${tail ?? ''}`;
  } catch {
    return 'Invalid endpoint';
  }
}

export function DestinationPanel({
  state,
  activity,
  editor,
}: {
  state: AppState;
  activity: ActivityState;
  editor: DestinationEditor;
}) {
  const {
    destination,
    setDestination,
    showSecret,
    setShowSecret,
    saving,
    errors,
    setErrors,
    open,
    replacementOpen,
    advancedOpen,
    setAdvancedOpen,
    connectionStaged,
    reset,
    create,
    select,
    setConnectionInput,
    stageConnection,
    updateUrl,
    addAuthentication,
    removeAuthentication,
    updateHeaderName,
    updateHeaderValue,
    save,
    remove,
  } = editor;
  const replacementInputRef = useRef<HTMLTextAreaElement>(null);
  const advancedUrlRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement>(null);
  const hasAuthentication = Boolean(destination.headerName || destination.headerValue);
  useModalDialog(open, dialogRef, returnFocusRef, reset);

  const rememberFocus = () => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };

  useEffect(() => {
    if (replacementOpen && destination.id) replacementInputRef.current?.focus();
  }, [destination.id, replacementOpen]);

  useEffect(() => {
    if (advancedOpen) advancedUrlRef.current?.focus();
  }, [advancedOpen]);
  const lastActivityByDestination = useMemo(() => {
    const result = new Map<string, ActivityState['entries'][number]>();
    for (const entry of activity.entries) {
      if (!result.has(entry.destination.id)) result.set(entry.destination.id, entry);
    }
    return result;
  }, [activity.entries]);

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) reset();
  };

  return (
    <div
      className="destination-workspace"
      id="destinations-panel"
      role="tabpanel"
      aria-labelledby="destinations-tab"
    >
      <section className="destination-ledger" aria-labelledby="destination-list-title">
        <div className="ledger-heading">
          <div>
            <h2 id="destination-list-title">Destination ledger</h2>
            <p>Each destination is one table webhook in Clay.</p>
          </div>
          <button
            className="primary-button ledger-add"
            type="button"
            onClick={() => {
              rememberFocus();
              create();
            }}
          >
            <Plus size={17} /> Add destination
          </button>
        </div>
        {state.destinations.length ? (
          <div className="destination-table-wrap">
            <table className="destination-table">
              <thead>
                <tr>
                  <th scope="col">Destination name</th>
                  <th scope="col">Webhook endpoint</th>
                  <th scope="col">Auth status</th>
                  <th scope="col">Last local activity</th>
                </tr>
              </thead>
              <tbody>
                {state.destinations.map((item) => {
                  const lastActivity = lastActivityByDestination.get(item.id);
                  return (
                    <tr
                      className={open && destination.id === item.id ? 'selected' : undefined}
                      key={item.id}
                      onClick={() => {
                        rememberFocus();
                        select(item);
                      }}
                    >
                      <td>
                        <button
                          className="destination-select"
                          type="button"
                          aria-label={`Edit ${item.name}`}
                        >
                          <span className="item-icon">
                            <Database size={18} />
                          </span>
                          <span className="destination-name-copy">
                            <strong>{item.name}</strong>
                            <span>{destinationHost(item.url).split(' · ')[0]}</span>
                          </span>
                        </button>
                      </td>
                      <td className="destination-endpoint">
                        <code title={item.url}>{item.url}</code>
                        <span>{destinationHost(item.url)}</span>
                      </td>
                      <td>
                        <span className={`status-label${item.auth ? ' protected' : ''}`}>
                          <Circle size={9} fill="currentColor" aria-hidden="true" />
                          {item.auth ? 'Protected' : 'No token'}
                        </span>
                      </td>
                      <td>
                        {lastActivity ? (
                          <span className="activity-cell">
                            <time dateTime={lastActivity.attemptedAt}>
                              {activityTime(lastActivity.attemptedAt)}
                            </time>
                            <span className={lastActivity.result.ok ? 'success' : 'error'}>
                              {activityResultLabel(lastActivity)}
                            </span>
                          </span>
                        ) : (
                          <span className="activity-cell empty">
                            <span>Never</span>
                            <span>No activity</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel-empty ledger-empty">
            <Database size={23} />
            <strong>No destinations yet</strong>
            <span>Add the webhook from a Clay table to get started.</span>
          </div>
        )}

        <div className="ledger-privacy-note">
          <Info size={16} />
          <span>Destinations, tokens, rules, and bounded activity stay on this device.</span>
        </div>
      </section>

      {open
        ? createPortal(
            <div className="modal-backdrop" onMouseDown={closeFromBackdrop}>
              <section
                ref={dialogRef}
                className="settings-modal destination-modal"
                role="dialog"
                tabIndex={-1}
                aria-modal="true"
                aria-labelledby="destination-form-title"
              >
                <div className="modal-heading">
                  <div>
                    <h2 id="destination-form-title">
                      {destination.id ? 'Edit destination' : 'Add destination'}
                    </h2>
                    <p>
                      {destination.id
                        ? 'Update the name or connection details.'
                        : 'Name this destination and connect it to Clay.'}
                    </p>
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
                    <label htmlFor="destination-name">Destination name</label>
                    <input
                      id="destination-name"
                      autoFocus
                      aria-label="Name"
                      value={destination.name}
                      maxLength={60}
                      placeholder="Outbound prospects"
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? 'destination-name-error' : undefined}
                      onChange={(event) => {
                        setDestination({ ...destination, name: event.target.value });
                        setErrors((current) => ({ ...current, name: undefined }));
                      }}
                    />
                    {errors.name ? (
                      <span className="field-error" id="destination-name-error">
                        {errors.name}
                      </span>
                    ) : null}
                  </div>
                  <div className="connection-section">
                    {replacementOpen ? (
                      <div
                        className="connection-import"
                        onBlur={(event) => {
                          if (event.currentTarget.contains(event.relatedTarget as Node | null))
                            return;
                          stageConnection();
                        }}
                      >
                        <div className="field">
                          <label htmlFor="destination-input">
                            Paste a Clay webhook URL or cURL
                          </label>
                          <textarea
                            id="destination-input"
                            ref={replacementInputRef}
                            rows={4}
                            value={destination.connectionInput}
                            placeholder="https://api.clay.com/v3/sources/webhook/…"
                            aria-invalid={Boolean(errors.input)}
                            aria-describedby={`destination-input-help${errors.input ? ' destination-input-error' : ''}`}
                            onChange={(event) => setConnectionInput(event.target.value)}
                            onPaste={(event) => {
                              const input = event.clipboardData.getData('text');
                              if (!input) return;
                              event.preventDefault();
                              setConnectionInput(input);
                              stageConnection(input);
                            }}
                          />
                          {errors.input ? (
                            <span className="field-error" id="destination-input-error">
                              {errors.input}
                            </span>
                          ) : null}
                          <div className="connection-import-help">
                            <span className="field-help" id="destination-input-help">
                              We’ll use the webhook URL and authentication header. Any sample row
                              data in the cURL won’t be saved.
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : destination.url ? (
                      <div className={`connection-card${connectionStaged ? ' staged' : ''}`}>
                        <CheckCircle2 size={19} aria-hidden="true" />
                        <div className="connection-summary">
                          <strong>
                            {connectionStaged
                              ? destination.id
                                ? 'New Clay connection ready'
                                : 'Clay connection ready'
                              : 'Clay connection'}
                          </strong>
                          <code title={destination.url}>{destination.url}</code>
                          <span>
                            {hasAuthentication ? 'Authentication added' : 'No authentication'}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {destination.url && !replacementOpen ? (
                      <div className="advanced-settings">
                        <button
                          className="advanced-toggle"
                          type="button"
                          aria-expanded={advancedOpen}
                          aria-controls="advanced-connection-settings"
                          onClick={() => setAdvancedOpen(!advancedOpen)}
                        >
                          <span>
                            <Settings2 size={15} aria-hidden="true" /> Edit connection details
                          </span>
                          <ChevronDown
                            className={advancedOpen ? 'expanded' : undefined}
                            size={16}
                            aria-hidden="true"
                          />
                        </button>

                        {advancedOpen ? (
                          <div className="advanced-panel" id="advanced-connection-settings">
                            <div className="field">
                              <label htmlFor="webhook-url">Webhook URL</label>
                              <input
                                id="webhook-url"
                                ref={advancedUrlRef}
                                value={destination.url}
                                aria-invalid={Boolean(errors.input)}
                                aria-describedby={
                                  errors.input ? 'destination-input-error' : undefined
                                }
                                onChange={(event) => updateUrl(event.target.value)}
                              />
                              {errors.input ? (
                                <span className="field-error" id="destination-input-error">
                                  {errors.input}
                                </span>
                              ) : null}
                            </div>

                            <div className="authentication-heading">
                              <div>
                                <strong>Authentication</strong>
                                <span>
                                  {hasAuthentication
                                    ? 'An authentication header will be sent.'
                                    : 'No authentication header will be sent.'}
                                </span>
                              </div>
                              <button
                                className={`text-button${hasAuthentication ? ' danger-text' : ''}`}
                                type="button"
                                onClick={
                                  hasAuthentication ? removeAuthentication : addAuthentication
                                }
                              >
                                {hasAuthentication ? 'Remove authentication' : 'Add authentication'}
                              </button>
                            </div>

                            {hasAuthentication ? (
                              <>
                                <div className="connection-auth-fields">
                                  <div className="field">
                                    <label htmlFor="header-name">Authentication header</label>
                                    <input
                                      id="header-name"
                                      value={destination.headerName}
                                      aria-invalid={Boolean(errors.auth)}
                                      aria-describedby={
                                        errors.auth ? 'destination-auth-error' : undefined
                                      }
                                      onChange={(event) => updateHeaderName(event.target.value)}
                                    />
                                  </div>
                                  <div className="field">
                                    <label htmlFor="header-value">Token or header value</label>
                                    <div className="password-field">
                                      <input
                                        id="header-value"
                                        type={showSecret ? 'text' : 'password'}
                                        value={destination.headerValue}
                                        placeholder="Enter the secret value"
                                        aria-invalid={Boolean(errors.auth)}
                                        aria-describedby={
                                          errors.auth ? 'destination-auth-error' : undefined
                                        }
                                        onChange={(event) => updateHeaderValue(event.target.value)}
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
                                {errors.auth ? (
                                  <span className="field-error" id="destination-auth-error">
                                    {errors.auth}
                                  </span>
                                ) : null}
                                <p className="storage-warning">
                                  <Info size={14} /> Tokens stay in Chrome extension storage on this
                                  device. That storage is private to Push Row, but it is not
                                  encrypted at rest.
                                </p>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="modal-actions">
                  {destination.id ? (
                    <button
                      className="danger-button"
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        const item = state.destinations.find(({ id }) => id === destination.id);
                        if (item) void remove(item);
                      }}
                    >
                      <Trash2 size={15} /> Delete destination
                    </button>
                  ) : (
                    <span />
                  )}
                  <div>
                    <button className="secondary-button" type="button" onClick={reset}>
                      Cancel
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={saving}
                      onClick={() => void save()}
                    >
                      {saving ? 'Saving…' : destination.id ? 'Save changes' : 'Save destination'}
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

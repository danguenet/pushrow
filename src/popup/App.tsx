import {
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe2,
  History,
  LoaderCircle,
  Settings,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Workflow,
} from 'lucide-react';
import { SOURCE_LABELS } from '@/shared/constants';
import type { PageRecord, SendErrorCode } from '@/shared/types';
import { DestinationOption } from './DestinationOption';
import { usePopupController } from './usePopupController';

const ERROR_MESSAGES: Record<SendErrorCode, string> = {
  permission: 'Clay access was removed. Restore access, then try again.',
  bad_request: 'Clay rejected the payload. Check the destination settings.',
  auth: 'Clay rejected the authentication header or token.',
  not_found: 'This Clay webhook could not be found. It may have been replaced.',
  rate_limited: 'Clay is limiting this webhook. Wait a moment and retry.',
  server: 'Clay had a temporary problem. Retry when you are ready.',
  timeout: 'Clay did not respond within 12 seconds. Nothing was retried automatically.',
  network: 'The request could not reach Clay. Check your connection and retry.',
  invalid_message: 'The current page changed before it could be sent. Reopen Push Row.',
  destination_missing: 'This destination no longer exists. Choose another table.',
};

function sourceIcon(record: PageRecord) {
  return record.source === 'linkedin' ? <Globe2 size={18} /> : <Database size={18} />;
}

export function App() {
  const {
    state,
    record,
    pageLoaded,
    loadError,
    recommendations,
    recommendedIds,
    effectiveSelectedId,
    selectedDestination,
    otherDestinations,
    manualChoice,
    phase,
    errorCode,
    ruleCreated,
    ruleCreating,
    ruleCreationError,
    permissionRequesting,
    chooseDestination,
    send,
    restorePermission,
    createRule,
    openSettings,
    openActivity,
  } = usePopupController();

  return (
    <main className="popup-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/icon-48.png" alt="" width="28" height="28" />
          <span>Push Row</span>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={openSettings}
          aria-label="Open settings"
        >
          <Settings size={18} />
        </button>
      </header>

      {!pageLoaded ? (
        <section className="center-state" aria-live="polite">
          <LoaderCircle className="spin" size={24} />
          <p>Reading this page…</p>
        </section>
      ) : loadError ? (
        <section className="empty-state">
          <div className="state-icon muted">
            <TriangleAlert size={24} />
          </div>
          <h1>Push Row could not read this tab</h1>
          <p>
            Chrome did not return the current page or local settings. Reopen the popup to retry.
          </p>
          <button className="secondary-button" type="button" onClick={openSettings}>
            Open settings
          </button>
        </section>
      ) : state.destinations.length === 0 ? (
        <section className="empty-state">
          <div className="state-icon">
            <Workflow size={24} />
          </div>
          <h1>Add your first Clay table</h1>
          <p>Paste a Clay webhook URL or cURL once, then send records from your toolbar.</p>
          <button className="primary-button" type="button" onClick={openSettings}>
            Add Clay destination <ExternalLink size={16} />
          </button>
        </section>
      ) : !record ? (
        <section className="empty-state">
          <div className="state-icon muted">
            <ShieldAlert size={24} />
          </div>
          <h1>No supported record here</h1>
          <p>Open a LinkedIn profile or a HubSpot, Salesforce Lightning, or Attio record.</p>
          <button className="secondary-button" type="button" onClick={openSettings}>
            Manage destinations
          </button>
        </section>
      ) : (
        <>
          <section className="record-summary" aria-label="Current record">
            <div className={`source-icon source-${record.source}`}>{sourceIcon(record)}</div>
            <div className="record-copy">
              <div className="record-heading">
                <strong>{SOURCE_LABELS[record.source]}</strong>
                <span>{record.object_type}</span>
              </div>
              <p title={record.url}>{record.url}</p>
              {record.record_id ? <code>{record.record_id}</code> : null}
            </div>
          </section>

          <section className="destination-section">
            <div className="section-heading">
              <h2>{recommendations.length ? 'Recommended' : 'Choose a Clay table'}</h2>
              {recommendations.length ? (
                <span>
                  {recommendations.length} match{recommendations.length === 1 ? '' : 'es'}
                </span>
              ) : null}
            </div>

            <div className="destination-list">
              {recommendations.map(({ destination, rule }) => (
                <DestinationOption
                  key={destination.id}
                  destination={destination}
                  selected={effectiveSelectedId === destination.id}
                  recommended
                  reason={rule.name}
                  onSelect={() => chooseDestination(destination.id)}
                />
              ))}
            </div>

            {recommendations.length && otherDestinations.length ? (
              <div className="list-label">Other tables</div>
            ) : null}
            <div className="destination-list">
              {otherDestinations.map((destination) => (
                <DestinationOption
                  key={destination.id}
                  destination={destination}
                  selected={effectiveSelectedId === destination.id}
                  recommended={false}
                  onSelect={() => chooseDestination(destination.id)}
                />
              ))}
            </div>
          </section>

          <footer className="send-area">
            {phase === 'success' ? (
              <div className="status success" role="status">
                <CheckCircle2 size={18} />
                <span>Sent to {selectedDestination?.name}</span>
              </div>
            ) : null}
            {phase === 'error' && errorCode ? (
              <div className="status error" role="alert">
                <TriangleAlert size={18} />
                <span>{ERROR_MESSAGES[errorCode]}</span>
              </div>
            ) : null}

            {phase === 'success' || phase === 'error' ? (
              <button className="activity-link" type="button" onClick={openActivity}>
                <History size={14} /> View local activity
              </button>
            ) : null}

            {phase === 'success' &&
            manualChoice &&
            effectiveSelectedId &&
            !recommendedIds.has(effectiveSelectedId) ? (
              ruleCreated ? (
                <div className="rule-created" role="status">
                  <Check size={15} /> Recommendation rule created
                </div>
              ) : (
                <button
                  className="rule-shortcut"
                  type="button"
                  disabled={ruleCreating}
                  onClick={() => void createRule()}
                >
                  <Sparkles size={15} />
                  {ruleCreating
                    ? 'Creating recommendation…'
                    : `Always recommend here for ${SOURCE_LABELS[record.source]} ${record.object_type}`}
                </button>
              )
            ) : null}

            {ruleCreationError ? (
              <div className="status error" role="alert">
                <TriangleAlert size={18} />
                <span>Could not create the recommendation rule. Try again.</span>
              </div>
            ) : null}

            {errorCode === 'permission' ? (
              <button
                className="primary-button"
                type="button"
                disabled={permissionRequesting}
                onClick={() => void restorePermission()}
              >
                {permissionRequesting ? 'Requesting access…' : 'Restore Clay access'}
              </button>
            ) : (
              <button
                className="primary-button send-button"
                type="button"
                disabled={!selectedDestination || phase === 'sending'}
                onClick={() => void send()}
              >
                {phase === 'sending' ? <LoaderCircle className="spin" size={17} /> : null}
                {phase === 'sending'
                  ? 'Sending…'
                  : phase === 'error'
                    ? 'Retry send'
                    : phase === 'success'
                      ? `Send again to ${selectedDestination?.name ?? 'a table'}`
                      : `Send to ${selectedDestination?.name ?? 'a table'}`}
              </button>
            )}
            <p className="privacy-note">Only the URL-derived record fields shown above are sent.</p>
          </footer>
        </>
      )}
    </main>
  );
}

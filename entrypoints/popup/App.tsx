import {
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Settings,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Workflow,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { SOURCE_LABELS } from '@/lib/constants';
import { parsePageRecord } from '@/lib/page-record';
import { requestClayPermission } from '@/lib/permissions';
import { getRecommendations } from '@/lib/rules';
import { EMPTY_STATE, getState, subscribeState, upsertRule } from '@/lib/storage';
import type { AppState, Destination, PageRecord, SendErrorCode, SendResult } from '@/lib/types';

type SendPhase = 'idle' | 'sending' | 'success' | 'error';

const ERROR_MESSAGES: Record<SendErrorCode, string> = {
  permission: 'Clay access was removed. Restore access, then try again.',
  bad_request: 'Clay rejected the payload. Check the destination settings.',
  auth: 'Clay rejected the authentication header or token.',
  not_found: 'This Clay webhook could not be found. It may have been replaced.',
  rate_limited: 'Clay is limiting this webhook. Wait a moment and retry.',
  server: 'Clay had a temporary problem. Retry when you are ready.',
  timeout: 'Clay did not respond within 12 seconds. Nothing was retried automatically.',
  network: 'The request could not reach Clay. Check your connection and retry.',
  invalid_message: 'The current page changed before it could be sent. Reopen Posthook.',
  destination_missing: 'This destination no longer exists. Choose another table.',
};

function sourceIcon(record: PageRecord) {
  return record.source === 'linkedin' ? <Globe2 size={18} /> : <Database size={18} />;
}

function DestinationOption({
  destination,
  selected,
  recommended,
  reason,
  onSelect,
}: {
  destination: Destination;
  selected: boolean;
  recommended: boolean;
  reason?: string;
  onSelect: () => void;
}) {
  return (
    <button
      className={`destination-option${selected ? ' is-selected' : ''}`}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="radio-dot" aria-hidden="true">
        {selected ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <span className="destination-copy">
        <span className="destination-name">{destination.name}</span>
        <span className="destination-meta">
          {recommended ? (reason ?? 'Routing rule matched') : 'Clay table'}
        </span>
      </span>
      {recommended ? <Sparkles size={15} className="recommend-icon" aria-hidden="true" /> : null}
    </button>
  );
}

export function App() {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [record, setRecord] = useState<PageRecord | null>(null);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualChoice, setManualChoice] = useState(false);
  const [phase, setPhase] = useState<SendPhase>('idle');
  const [errorCode, setErrorCode] = useState<SendErrorCode | null>(null);
  const [ruleCreated, setRuleCreated] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([getState(), browser.tabs.query({ active: true, currentWindow: true })]).then(
      ([nextState, tabs]) => {
        if (!active) return;
        setState(nextState);
        setRecord(tabs[0]?.url ? parsePageRecord(tabs[0].url) : null);
        setPageLoaded(true);
      },
    );
    const unsubscribe = subscribeState(setState);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const recommendations = useMemo(
    () => (record ? getRecommendations(record, state.destinations, state.rules) : []),
    [record, state.destinations, state.rules],
  );
  const recommendedIds = useMemo(
    () => new Set(recommendations.map(({ destination }) => destination.id)),
    [recommendations],
  );

  const effectiveSelectedId = selectedId ?? recommendations[0]?.destination.id ?? null;
  const selectedDestination =
    state.destinations.find(({ id }) => id === effectiveSelectedId) ?? null;
  const otherDestinations = state.destinations.filter(({ id }) => !recommendedIds.has(id));

  const chooseDestination = (destinationId: string) => {
    setSelectedId(destinationId);
    setManualChoice(true);
    setPhase('idle');
    setErrorCode(null);
    setRuleCreated(false);
  };

  const send = async () => {
    if (!record || !effectiveSelectedId || phase === 'sending') return;
    setPhase('sending');
    setErrorCode(null);
    try {
      const result = (await browser.runtime.sendMessage({
        type: 'posthook:send-record',
        destinationId: effectiveSelectedId,
        record,
      })) as SendResult | undefined;
      if (result?.ok) setPhase('success');
      else {
        setErrorCode(result?.code ?? 'network');
        setPhase('error');
      }
    } catch {
      setErrorCode('network');
      setPhase('error');
    }
  };

  const restorePermission = async () => {
    const granted = await requestClayPermission();
    if (granted) await send();
  };

  const createRule = async () => {
    if (!record || !selectedDestination) return;
    const sourceName = SOURCE_LABELS[record.source];
    await upsertRule(
      {
        id: crypto.randomUUID(),
        name: `${sourceName} ${record.object_type} → ${selectedDestination.name}`,
        destinationId: selectedDestination.id,
        enabled: true,
        priority: 0,
        matcher: {
          kind: 'guided',
          source: record.source,
          objectType: record.object_type,
        },
      },
      true,
    );
    setRuleCreated(true);
  };

  const openSettings = () => void browser.runtime.openOptionsPage();

  return (
    <main className="popup-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/icon-48.png" alt="" width="28" height="28" />
          <span>Posthook</span>
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

            {phase === 'success' &&
            manualChoice &&
            effectiveSelectedId &&
            !recommendedIds.has(effectiveSelectedId) ? (
              ruleCreated ? (
                <div className="rule-created" role="status">
                  <Check size={15} /> Recommendation rule created
                </div>
              ) : (
                <button className="rule-shortcut" type="button" onClick={() => void createRule()}>
                  <Sparkles size={15} /> Always recommend here for {SOURCE_LABELS[record.source]}{' '}
                  {record.object_type}
                </button>
              )
            ) : null}

            {errorCode === 'permission' ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => void restorePermission()}
              >
                Restore Clay access
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

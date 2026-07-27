import { ChevronDown, History, Info, Trash2 } from 'lucide-react';
import { MAX_ACTIVITY_LIMIT, SOURCE_LABELS } from '@/shared/constants';
import { activityResultLabel, activityTime } from './format';
import type { ActivityController } from './useActivity';

export function ActivityPanel({ controller }: { controller: ActivityController }) {
  const { activity, limitDraft, setLimitDraft, busy, updateLimit, clear } = controller;

  return (
    <section
      className="activity-panel"
      id="activity-panel"
      role="tabpanel"
      aria-labelledby="activity-tab"
    >
      <div className="section-heading activity-heading">
        <div>
          <h2>Local send activity</h2>
          <p>
            Successful and failed sends stay on this device. Webhook URLs and authentication values
            are never included.
          </p>
        </div>
      </div>

      <div className="activity-settings">
        <div className="activity-setting-copy">
          <strong>Activity retention</strong>
          <span id="activity-limit-help">
            Use 0 to turn activity off, or choose 1–{MAX_ACTIVITY_LIMIT}. Lowering the number
            immediately removes older entries.
          </span>
        </div>
        <div className="activity-controls">
          <label htmlFor="activity-limit">Keep latest</label>
          <input
            id="activity-limit"
            type="number"
            min="0"
            max={MAX_ACTIVITY_LIMIT}
            step="1"
            value={limitDraft}
            aria-describedby="activity-limit-help"
            onChange={(event) => setLimitDraft(event.target.value)}
          />
          <button
            className="small-button"
            type="button"
            disabled={busy}
            onClick={() => void updateLimit()}
          >
            {busy ? 'Updating…' : 'Update'}
          </button>
          <button
            className="danger-button"
            type="button"
            disabled={busy || !activity.entries.length}
            onClick={() => void clear()}
          >
            <Trash2 size={15} /> Clear activity
          </button>
        </div>
      </div>
      <p className="storage-warning activity-privacy">
        <Info size={14} /> Activity entries include the canonical record URL and record ID shown in
        each request payload.
      </p>

      {activity.entries.length ? (
        <div className="activity-list">
          {activity.entries.map((entry) => (
            <details className="activity-entry" key={entry.id}>
              <summary>
                <span
                  className={`activity-status ${entry.result.ok ? 'success' : 'error'}`}
                  role="img"
                  aria-label={entry.result.ok ? 'Successful send' : 'Failed send'}
                />
                <span className="activity-destination">{entry.destination.name}</span>
                <span className="activity-source">
                  {SOURCE_LABELS[entry.request.source]} · {entry.request.object_type}
                </span>
                <strong>{activityResultLabel(entry)}</strong>
                <time dateTime={entry.attemptedAt}>{activityTime(entry.attemptedAt)}</time>
                <ChevronDown className="activity-chevron" size={15} />
              </summary>
              <div className="activity-details">
                <div>
                  <span>Request payload</span>
                  <span>
                    Destination ID: <code>{entry.destination.id}</code>
                  </span>
                </div>
                <pre>{JSON.stringify(entry.request, null, 2)}</pre>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="panel-empty activity-empty">
          <History size={23} />
          <strong>{activity.limit === 0 ? 'Activity is off' : 'No sends recorded yet'}</strong>
          <span>
            {activity.limit === 0
              ? 'Set a retention number above zero to record future sends.'
              : 'Future send results and their four-field requests will appear here.'}
          </span>
        </div>
      )}
    </section>
  );
}

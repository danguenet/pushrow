import { Database, History, LockKeyhole, Route, Trash2 } from 'lucide-react';
import type { ActivityState, AppState } from '@/shared/types';

export function DataPanel({
  state,
  activity,
  deleting,
  onDeleteAllData,
}: {
  state: AppState;
  activity: ActivityState;
  deleting: boolean;
  onDeleteAllData: () => Promise<void>;
}) {
  const rows = [
    {
      icon: Database,
      label: 'Destinations and credentials',
      detail: `${state.destinations.length} ${state.destinations.length === 1 ? 'destination' : 'destinations'}`,
    },
    {
      icon: Route,
      label: 'Routing rules',
      detail: `${state.rules.length} ${state.rules.length === 1 ? 'rule' : 'rules'}`,
    },
    {
      icon: History,
      label: 'Activity history',
      detail:
        activity.limit === 0
          ? 'Off'
          : `${activity.entries.length} of ${activity.limit} retained sends`,
    },
  ];

  return (
    <section className="data-panel" id="data-panel" role="tabpanel" aria-labelledby="data-tab">
      <div className="section-heading">
        <div>
          <h2>Data & privacy</h2>
          <p>Review what Push Row stores locally and clear it when you need to.</p>
        </div>
        <span className="local-status">
          <LockKeyhole size={15} /> Stored on this device
        </span>
      </div>

      <div className="data-list" aria-label="Locally stored data">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div className="data-row" key={row.label}>
              <span className="data-icon">
                <Icon size={17} />
              </span>
              <div>
                <strong>{row.label}</strong>
                <span>{row.detail}</span>
              </div>
              <span className="data-location">Local only</span>
            </div>
          );
        })}
      </div>

      <div className="danger-zone">
        <div>
          <h3>Delete all local data</h3>
          <p>
            Permanently removes destinations, credentials, routing rules, and activity from this
            device. This cannot be undone.
          </p>
        </div>
        <button
          className="danger-button"
          type="button"
          disabled={deleting}
          onClick={() => void onDeleteAllData()}
        >
          <Trash2 size={15} /> {deleting ? 'Deleting…' : 'Delete all local data'}
        </button>
      </div>
    </section>
  );
}

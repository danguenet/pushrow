import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { hasClayPermission, revokeClayPermission } from '@/platform/permissions';
import { sendRuntimeMessage } from '@/platform/runtime';
import { getState, subscribeState } from '@/platform/storage/app-state';
import { EMPTY_STATE } from '@/shared/state/app-state';
import type { AppState } from '@/shared/types';
import { ActivityPanel } from './activity/ActivityPanel';
import { useActivity } from './activity/useActivity';
import { DataPanel } from './data/DataPanel';
import { DestinationPanel } from './destinations/DestinationPanel';
import { useDestinationEditor } from './destinations/useDestinationEditor';
import { NoticeBar } from './NoticeBar';
import { RulesPanel } from './rules/RulesPanel';
import { useRuleEditor } from './rules/useRuleEditor';
import { Tabs } from './Tabs';
import type { Notice, Tab } from './types';

function tabFromHash(): Tab {
  const candidate = window.location.hash.slice(1);
  return candidate === 'rules' || candidate === 'activity' || candidate === 'data'
    ? candidate
    : 'destinations';
}

export function App() {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [notice, setNotice] = useState<Notice>(null);
  const [deletingAllData, setDeletingAllData] = useState(false);
  const destinationEditor = useDestinationEditor(state, setNotice);
  const ruleEditor = useRuleEditor(state, setNotice);
  const activityController = useActivity(setNotice);

  useEffect(() => {
    void getState()
      .then(setState)
      .catch(() =>
        setNotice({ kind: 'error', message: 'Could not load local Push Row settings.' }),
      );
    return subscribeState(setState);
  }, []);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!destinationEditor.dirty && !ruleEditor.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [destinationEditor.dirty, ruleEditor.dirty]);

  const selectTab = (nextTab: Tab): boolean => {
    if (nextTab !== 'destinations' && !destinationEditor.confirmDiscard()) return false;
    if (nextTab !== 'rules' && !ruleEditor.confirmDiscard()) return false;
    if (nextTab !== 'destinations') destinationEditor.clear();
    if (nextTab !== 'rules') ruleEditor.clear();
    setTab(nextTab);
    setNotice(null);
    window.history.replaceState(
      null,
      '',
      nextTab === 'destinations' ? window.location.pathname : `#${nextTab}`,
    );
    return true;
  };

  const deleteAllData = async () => {
    if (deletingAllData) return;
    if (
      !window.confirm(
        'Delete every destination, token, routing rule, and activity entry from this device?',
      )
    ) {
      return;
    }
    setDeletingAllData(true);
    try {
      const result = await sendRuntimeMessage({ type: 'pushrow:reset-all-data' });
      setState(result.state);
      activityController.setActivity(result.activity);
      destinationEditor.clear();
      ruleEditor.clear();

      try {
        const revoked = await revokeClayPermission();
        if (!revoked && (await hasClayPermission())) {
          setNotice({
            kind: 'error',
            message:
              'Local data was deleted, but Clay access remains enabled. Remove it from Chrome extension settings.',
          });
          return;
        }
      } catch {
        setNotice({
          kind: 'error',
          message:
            'Local data was deleted, but Clay access could not be checked or revoked. Review it in Chrome extension settings.',
        });
        return;
      }

      setNotice({ kind: 'success', message: 'All local Push Row data was deleted.' });
    } catch {
      setNotice({ kind: 'error', message: 'Could not delete local Push Row data.' });
    } finally {
      setDeletingAllData(false);
    }
  };

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div className="brand-lockup">
          <img src="/icon-48.png" alt="" width="52" height="52" />
          <div>
            <h1>Push Row</h1>
            <p>Set up where records go and how they’re routed.</p>
          </div>
        </div>
        <div className="privacy-badge">
          <ShieldCheck size={17} /> Local-only settings
        </div>
      </header>

      <Tabs
        tab={tab}
        destinationCount={state.destinations.length}
        ruleCount={state.rules.length}
        activityCount={activityController.activity.entries.length}
        onSelect={selectTab}
      />
      <NoticeBar notice={notice} />

      {tab === 'destinations' ? (
        <DestinationPanel
          state={state}
          activity={activityController.activity}
          editor={destinationEditor}
        />
      ) : tab === 'rules' ? (
        <RulesPanel state={state} editor={ruleEditor} />
      ) : tab === 'activity' ? (
        <ActivityPanel controller={activityController} />
      ) : (
        <DataPanel
          state={state}
          activity={activityController.activity}
          deleting={deletingAllData}
          onDeleteAllData={deleteAllData}
        />
      )}

      <footer className="settings-footer">
        Push Row is independent open-source software and is not affiliated with Clay, LinkedIn,
        HubSpot, Salesforce, or Attio.
      </footer>
    </main>
  );
}

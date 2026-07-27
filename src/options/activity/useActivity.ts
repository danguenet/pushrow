import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { sendRuntimeMessage } from '@/platform/runtime';
import { subscribeActivityState } from '@/platform/storage/activity';
import { MAX_ACTIVITY_LIMIT } from '@/shared/constants';
import { EMPTY_ACTIVITY_STATE } from '@/shared/state/activity-state';
import type { ActivityState } from '@/shared/types';
import type { Notice } from '../types';

export function useActivity(setNotice: Dispatch<SetStateAction<Notice>>) {
  const [activity, setActivity] = useState<ActivityState>(EMPTY_ACTIVITY_STATE);
  const [limitDraft, setLimitDraft] = useState(String(EMPTY_ACTIVITY_STATE.limit));
  const [busy, setBusy] = useState(false);
  const operationInFlight = useRef(false);

  useEffect(() => {
    void sendRuntimeMessage({ type: 'pushrow:get-activity' })
      .then((next) => {
        setActivity(next);
        setLimitDraft(String(next.limit));
      })
      .catch(() =>
        setNotice({ kind: 'error', message: 'Could not load local activity settings.' }),
      );
    return subscribeActivityState((next) => {
      setActivity(next);
      setLimitDraft(String(next.limit));
    });
  }, [setNotice]);

  const updateLimit = async () => {
    if (operationInFlight.current) return;
    const value = Number(limitDraft);
    if (!limitDraft.trim() || !Number.isInteger(value) || value < 0 || value > MAX_ACTIVITY_LIMIT) {
      setNotice({
        kind: 'error',
        message: `Activity retention must be a whole number from 0 to ${MAX_ACTIVITY_LIMIT}.`,
      });
      return;
    }
    if (
      value === 0 &&
      activity.entries.length > 0 &&
      !window.confirm('Turn off activity and delete all existing activity entries?')
    ) {
      setLimitDraft(String(activity.limit));
      return;
    }
    try {
      operationInFlight.current = true;
      setBusy(true);
      const next = await sendRuntimeMessage({ type: 'pushrow:set-activity-limit', limit: value });
      setActivity(next);
      setNotice({
        kind: 'success',
        message: value === 0 ? 'Activity is off.' : `Activity will keep the latest ${value} sends.`,
      });
    } catch {
      setNotice({ kind: 'error', message: 'Could not update activity retention.' });
    } finally {
      operationInFlight.current = false;
      setBusy(false);
    }
  };

  const clear = async () => {
    if (operationInFlight.current) return;
    if (!activity.entries.length || !window.confirm('Delete all local activity entries?')) return;
    try {
      operationInFlight.current = true;
      setBusy(true);
      const next = await sendRuntimeMessage({ type: 'pushrow:clear-activity' });
      setActivity(next);
      setNotice({ kind: 'success', message: 'Local activity was cleared.' });
    } catch {
      setNotice({ kind: 'error', message: 'Could not clear local activity.' });
    } finally {
      operationInFlight.current = false;
      setBusy(false);
    }
  };

  return { activity, setActivity, limitDraft, setLimitDraft, busy, updateLimit, clear };
}

export type ActivityController = ReturnType<typeof useActivity>;

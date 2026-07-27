import { useEffect, useMemo, useRef, useState } from 'react';
import { requestClayPermission } from '@/platform/permissions';
import {
  getActiveTabUrl,
  openActivityPage,
  openOptionsPage,
  sendRuntimeMessage,
} from '@/platform/runtime';
import { getState, subscribeState } from '@/platform/storage/app-state';
import { SOURCE_LABELS } from '@/shared/constants';
import { parsePageRecord } from '@/shared/page-record';
import { getRecommendations } from '@/shared/rules';
import { EMPTY_STATE } from '@/shared/state/app-state';
import type { AppState, PageRecord, SendErrorCode } from '@/shared/types';

type SendPhase = 'idle' | 'sending' | 'success' | 'error';

export function usePopupController() {
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [record, setRecord] = useState<PageRecord | null>(null);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualChoice, setManualChoice] = useState(false);
  const [phase, setPhase] = useState<SendPhase>('idle');
  const [errorCode, setErrorCode] = useState<SendErrorCode | null>(null);
  const [ruleCreated, setRuleCreated] = useState(false);
  const [ruleCreating, setRuleCreating] = useState(false);
  const [ruleCreationError, setRuleCreationError] = useState(false);
  const [permissionRequesting, setPermissionRequesting] = useState(false);
  const sendInFlight = useRef(false);
  const ruleCreationInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void Promise.all([getState(), getActiveTabUrl()])
      .then(([nextState, activeUrl]) => {
        if (!active) return;
        setState(nextState);
        setRecord(activeUrl ? parsePageRecord(activeUrl) : null);
        setPageLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(true);
        setPageLoaded(true);
      });
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
    setRuleCreationError(false);
  };

  const send = async () => {
    if (!record || !effectiveSelectedId || sendInFlight.current) return;
    sendInFlight.current = true;
    setPhase('sending');
    setErrorCode(null);
    try {
      const result = await sendRuntimeMessage({
        type: 'pushrow:send-record',
        destinationId: effectiveSelectedId,
        record,
      });
      if (result.ok) setPhase('success');
      else {
        setErrorCode(result.code);
        setPhase('error');
      }
    } catch {
      setErrorCode('network');
      setPhase('error');
    } finally {
      sendInFlight.current = false;
    }
  };

  const restorePermission = async () => {
    if (permissionRequesting) return;
    setPermissionRequesting(true);
    try {
      const granted = await requestClayPermission();
      if (granted) await send();
      else {
        setErrorCode('permission');
        setPhase('error');
      }
    } catch {
      setErrorCode('permission');
      setPhase('error');
    } finally {
      setPermissionRequesting(false);
    }
  };

  const createRule = async () => {
    if (!record || !selectedDestination || ruleCreationInFlight.current) return;
    ruleCreationInFlight.current = true;
    setRuleCreating(true);
    setRuleCreationError(false);
    const sourceName = SOURCE_LABELS[record.source];
    try {
      await sendRuntimeMessage({
        type: 'pushrow:upsert-rule',
        insertAtTop: true,
        rule: {
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
      });
      setRuleCreated(true);
    } catch {
      setRuleCreationError(true);
    } finally {
      ruleCreationInFlight.current = false;
      setRuleCreating(false);
    }
  };

  return {
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
    openSettings: () => void openOptionsPage(),
    openActivity: () => void openActivityPage(),
  };
}

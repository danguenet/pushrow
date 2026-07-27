import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  hasClayPermission,
  requestClayPermission,
  revokeClayPermission,
} from '@/platform/permissions';
import { sendRuntimeMessage } from '@/platform/runtime';
import { DEFAULT_AUTH_HEADER } from '@/shared/constants';
import {
  DestinationInputError,
  parseDestinationInput,
  validateAuth,
  validateClayWebhookUrl,
} from '@/shared/destinations';
import type { AppState, Destination } from '@/shared/types';
import type { DestinationDraft, DestinationErrors, Notice } from '../types';

const NEW_DESTINATION: DestinationDraft = {
  id: null,
  name: '',
  connectionInput: '',
  url: '',
  headerName: '',
  headerValue: '',
  createdAt: null,
};

function destinationDraft(destination: Destination): DestinationDraft {
  return {
    id: destination.id,
    name: destination.name,
    connectionInput: '',
    url: destination.url,
    headerName: destination.auth?.headerName ?? '',
    headerValue: destination.auth?.value ?? '',
    createdAt: destination.createdAt,
  };
}

export function useDestinationEditor(state: AppState, setNotice: Dispatch<SetStateAction<Notice>>) {
  const [destination, setDestination] = useState<DestinationDraft>(NEW_DESTINATION);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<DestinationErrors>({});
  const [open, setOpen] = useState(false);
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [connectionStaged, setConnectionStaged] = useState(false);
  const operationInFlight = useRef(false);

  const dirty = useMemo(() => {
    if (destination.id) {
      const existing = state.destinations.find(({ id }) => id === destination.id);
      if (!existing) return false;
      const baseline = destinationDraft(existing);
      return (
        destination.name !== baseline.name ||
        destination.url !== baseline.url ||
        destination.headerName !== baseline.headerName ||
        destination.headerValue !== baseline.headerValue ||
        Boolean(destination.connectionInput.trim())
      );
    }
    return Boolean(
      destination.name.trim() ||
      destination.connectionInput.trim() ||
      destination.url.trim() ||
      destination.headerValue.trim() ||
      destination.headerName.trim(),
    );
  }, [destination, state.destinations]);

  const confirmDiscard = () =>
    !dirty || window.confirm('Discard your unsaved destination changes?');

  const clear = () => {
    setDestination(NEW_DESTINATION);
    setErrors({});
    setShowSecret(false);
    setNotice(null);
    setOpen(false);
    setReplacementOpen(false);
    setAdvancedOpen(false);
    setConnectionStaged(false);
  };

  const reset = () => {
    if (confirmDiscard()) clear();
  };

  const create = () => {
    if (!confirmDiscard()) return;
    clear();
    setReplacementOpen(true);
    setOpen(true);
  };

  const select = (item: Destination) => {
    if (!confirmDiscard()) return;
    setDestination(destinationDraft(item));
    setErrors({});
    setShowSecret(false);
    setNotice(null);
    setReplacementOpen(false);
    setAdvancedOpen(false);
    setConnectionStaged(false);
    setOpen(true);
  };

  const setConnectionInput = (value: string) => {
    setDestination((current) => ({ ...current, connectionInput: value }));
    setErrors((current) => ({ ...current, input: undefined }));
  };

  const stageConnection = (input = destination.connectionInput): boolean => {
    if (!input.trim()) return false;
    try {
      const parsed = parseDestinationInput(input);
      setDestination((current) => ({
        ...current,
        connectionInput: '',
        url: parsed.url,
        headerName: parsed.headerValue.trim() ? parsed.headerName : '',
        headerValue: parsed.headerValue,
      }));
      setErrors((current) => ({ ...current, input: undefined, auth: undefined }));
      setReplacementOpen(false);
      setAdvancedOpen(false);
      setConnectionStaged(true);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not parse this destination.';
      setErrors((current) => ({ ...current, input: message }));
      return false;
    }
  };

  const updateUrl = (url: string) => {
    setDestination((current) => ({ ...current, url }));
    setErrors((current) => ({ ...current, input: undefined }));
    setConnectionStaged(true);
  };

  const addAuthentication = () => {
    setDestination((current) => ({
      ...current,
      headerName: current.headerName || DEFAULT_AUTH_HEADER,
    }));
    setErrors((current) => ({ ...current, auth: undefined }));
    setConnectionStaged(true);
  };

  const removeAuthentication = () => {
    setDestination((current) => ({ ...current, headerName: '', headerValue: '' }));
    setErrors((current) => ({ ...current, auth: undefined }));
    setShowSecret(false);
    setConnectionStaged(true);
  };

  const updateHeaderName = (headerName: string) => {
    setDestination((current) => ({ ...current, headerName }));
    setErrors((current) => ({ ...current, auth: undefined }));
    setConnectionStaged(true);
  };

  const updateHeaderValue = (headerValue: string) => {
    setDestination((current) => ({ ...current, headerValue }));
    setErrors((current) => ({ ...current, auth: undefined }));
    setConnectionStaged(true);
  };

  const save = async () => {
    if (operationInFlight.current) return;
    const name = destination.name.trim();
    setErrors({});
    if (!name) {
      setErrors({ name: 'Give this Clay destination a name.' });
      setNotice({ kind: 'error', message: 'Give this Clay destination a name.' });
      return;
    }

    let parsed: { url: string; headerName: string; headerValue: string };
    try {
      if (destination.connectionInput.trim()) {
        const imported = parseDestinationInput(destination.connectionInput);
        parsed = {
          ...imported,
          headerName: imported.headerValue.trim() ? imported.headerName : '',
        };
        setDestination((current) => ({
          ...current,
          connectionInput: '',
          url: parsed.url,
          headerName: parsed.headerName,
          headerValue: parsed.headerValue,
        }));
        setReplacementOpen(false);
        setConnectionStaged(true);
      } else {
        parsed = {
          url: validateClayWebhookUrl(destination.url),
          headerName: destination.headerName,
          headerValue: destination.headerValue,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not parse this destination.';
      setErrors({ input: message });
      setNotice({ kind: 'error', message });
      return;
    }

    let auth: Destination['auth'];
    try {
      auth =
        parsed.headerName.trim() || parsed.headerValue.trim()
          ? validateAuth(parsed.headerName, parsed.headerValue)
          : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check the authentication fields.';
      setErrors({ auth: message });
      setNotice({ kind: 'error', message });
      return;
    }

    try {
      operationInFlight.current = true;
      setSaving(true);
      if (!(await requestClayPermission())) {
        throw new DestinationInputError(
          'Chrome did not grant Clay access. Save again and choose Allow to continue.',
        );
      }
      const now = new Date().toISOString();
      await sendRuntimeMessage({
        type: 'pushrow:upsert-destination',
        destination: {
          id: destination.id ?? crypto.randomUUID(),
          name,
          url: parsed.url,
          auth,
          createdAt: destination.createdAt ?? now,
          updatedAt: now,
        },
      });
      clear();
      setNotice({ kind: 'success', message: `${name} is ready to receive records.` });
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not save this destination.',
      });
    } finally {
      operationInFlight.current = false;
      setSaving(false);
    }
  };

  const remove = async (item: Destination) => {
    if (operationInFlight.current) return;
    if (!window.confirm(`Delete “${item.name}” and its routing rules?`)) return;
    operationInFlight.current = true;
    setSaving(true);
    try {
      const next = await sendRuntimeMessage({
        type: 'pushrow:delete-destination',
        destinationId: item.id,
      });
      if (destination.id === item.id) clear();
      if (!next.destinations.length) {
        try {
          const revoked = await revokeClayPermission();
          if (!revoked && (await hasClayPermission())) {
            setNotice({
              kind: 'error',
              message:
                `${item.name} was deleted, but Clay access remains enabled. ` +
                'Remove it from Chrome extension settings.',
            });
            return;
          }
        } catch {
          setNotice({
            kind: 'error',
            message:
              `${item.name} was deleted, but Clay access could not be checked or revoked. ` +
              'Review it in Chrome extension settings.',
          });
          return;
        }
      }
      setNotice({ kind: 'success', message: `${item.name} was deleted.` });
    } catch {
      setNotice({ kind: 'error', message: `Could not delete ${item.name}.` });
    } finally {
      operationInFlight.current = false;
      setSaving(false);
    }
  };

  return {
    destination,
    setDestination,
    showSecret,
    setShowSecret,
    saving,
    errors,
    setErrors,
    dirty,
    open,
    replacementOpen,
    advancedOpen,
    setAdvancedOpen,
    connectionStaged,
    confirmDiscard,
    clear,
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
  };
}

export type DestinationEditor = ReturnType<typeof useDestinationEditor>;

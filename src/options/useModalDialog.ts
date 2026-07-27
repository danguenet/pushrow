import { useEffect, useEffectEvent, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useModalDialog(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  returnFocusRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  const closeModal = useEffectEvent(onClose);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const background = document.getElementById('root');
    const returnFocus = returnFocusRef.current;
    background?.setAttribute('inert', '');

    queueMicrotask(() => {
      if (!dialog.isConnected) return;
      dialog.querySelector<HTMLElement>('[autofocus]')?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      background?.removeAttribute('inert');
      returnFocus?.focus();
    };
  }, [dialogRef, open, returnFocusRef]);
}

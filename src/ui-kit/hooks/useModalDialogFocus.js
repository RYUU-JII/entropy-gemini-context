import { useLayoutEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isAvailableFocusTarget(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (!element.matches(FOCUSABLE_SELECTOR)) return false;
  if (element.closest('[hidden], [inert], [aria-hidden="true"]') || element.matches(':disabled')) return false;
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'DETAILS' && !ancestor.open) {
      const summary = Array.from(ancestor.children).find(child => child.tagName === 'SUMMARY');
      if (element !== summary) return false;
    }
  }
  return true;
}

// An explicitly requested start point may be programmatic-only (tabindex="-1"),
// e.g. a dialog title, so opening does not land on and ring the first control.
function isRequestedInitialFocusTarget(element) {
  if (isAvailableFocusTarget(element)) return true;
  return element instanceof HTMLElement
    && element.matches('[tabindex="-1"]')
    && !element.closest('[hidden], [inert], [aria-hidden="true"]');
}

function getFocusableElements(container) {
  if (!(container instanceof HTMLElement)) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(isAvailableFocusTarget);
}

export function useModalDialogFocus({
  active = true,
  escapeBlocked = false,
  captureEscape = true,
  initialFocusRef = null,
  onEscape = null,
} = {}) {
  const dialogRef = useRef(null);
  const escapeBlockedRef = useRef(escapeBlocked);
  const onEscapeRef = useRef(onEscape);

  useLayoutEffect(() => {
    escapeBlockedRef.current = escapeBlocked;
    onEscapeRef.current = onEscape;
  }, [escapeBlocked, onEscape]);

  useLayoutEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;

    const dialog = dialogRef.current;
    if (!(dialog instanceof HTMLElement)) {
      throw new Error('MODAL_DIALOG_FOCUS_OWNER_REQUIRED');
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const requestedInitialFocus = initialFocusRef?.current;
    const initialFocus = isRequestedInitialFocusTarget(requestedInitialFocus)
      ? requestedInitialFocus
      : getFocusableElements(dialog)[0] || dialog;
    initialFocus.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        // Nested reading views can handle Escape before their outer dialog.
        if (!captureEscape) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (!escapeBlockedRef.current && typeof onEscapeRef.current === 'function') {
          onEscapeRef.current();
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      const activeIndex = focusable.indexOf(activeElement);

      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && (activeIndex < 0 || activeIndex === focusable.length - 1)) {
        event.preventDefault();
        first.focus();
      }
    };

    const keyEventOwner = typeof window === 'undefined' ? document : window;
    keyEventOwner.addEventListener('keydown', handleKeyDown, true);
    return () => {
      keyEventOwner.removeEventListener('keydown', handleKeyDown, true);
      if (
        previouslyFocused
        && document.contains(previouslyFocused)
        && typeof previouslyFocused.focus === 'function'
      ) {
        previouslyFocused.focus();
      }
    };
  }, [active, initialFocusRef, captureEscape]);

  return dialogRef;
}

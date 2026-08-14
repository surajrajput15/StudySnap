import { useEffect, useRef, type RefObject } from 'react';

// Day 12 Tasks 2 & 4 — shared modal/dialog accessibility.
//
// While `open` is true this hook:
//  1. remembers the element that had focus (restored on close),
//  2. moves focus into the dialog (first focusable),
//  3. traps Tab so focus cannot escape behind the backdrop,
//  4. closes the dialog on Escape.
//
// It mirrors the pattern already used by MobileDrawer, extracted so every
// modal (dashboard dialogs, AI note picker, reward overlay, PIN dialog) gets
// the same keyboard/focus behavior instead of bespoke per-component logic.

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function useDialogFocus(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void
) {
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusables = () => {
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey) {
        if (active === first || !container?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !container?.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    focusables()[0]?.focus();
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      lastFocusedRef.current?.focus();
    };
  }, [open, containerRef]);
}
import { useEffect, type RefObject } from 'react';

const EDITING_KEYS = [
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
];

const CTRL_SHORTCUTS = ['a', 'c', 'v', 'x', 'z', 'y'];

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function suppressEvent(event: KeyboardEvent, preventDefault = true): void {
  if (preventDefault) event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function isInputElement(element: Element | null): boolean {
  return element !== null && INPUT_TAGS.has(element.tagName);
}

function isEditingKey(event: KeyboardEvent): boolean {
  return (
    event.key.length === 1 ||
    EDITING_KEYS.includes(event.key) ||
    (event.ctrlKey && CTRL_SHORTCUTS.includes(event.key))
  );
}

interface UseModalKeyboardOptions {
  isOpen: boolean;
  modalRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onEscape?: () => boolean | void;
}

/**
 * モーダル共通のキーボードハンドラ
 *
 * Escape: モーダルを閉じる（onEscapeが定義されていてtrueを返した場合はスキップ）
 * Tab: モーダル内でフォーカストラップ
 * 入力フィールド内の通常操作: 許可
 * その他: 背景への伝播を阻止
 */
export function useModalKeyboard({
  isOpen,
  modalRef,
  onClose,
  onEscape,
}: UseModalKeyboardOptions): void {
  useEffect(() => {
    if (!isOpen) return;

    modalRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      const modal = modalRef.current;
      if (!modal) return;

      if (event.key === 'Escape') {
        if (onEscape?.()) return;
        suppressEvent(event);
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstEl = focusableElements[0] as HTMLElement;
        const lastEl = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey && document.activeElement === firstEl) {
          lastEl.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          firstEl.focus();
        }
        suppressEvent(event);
        return;
      }

      if (!modal.contains(document.activeElement)) return;

      if (isInputElement(document.activeElement) && isEditingKey(event)) {
        suppressEvent(event, false);
        return;
      }

      suppressEvent(event);
    }

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose, onEscape, modalRef]);
}

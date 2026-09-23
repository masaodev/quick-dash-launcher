import { useEffect, useRef, type RefObject } from 'react';

const EDITING_KEYS = [
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  // テキストエリア（メモ等）の改行
  'Enter',
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
 *
 * onClose / onEscape は最新のものを ref 経由で呼ぶ。毎レンダー作り直される関数を渡しても
 * リスナーの再登録（とモーダルへのフォーカスの移し直し）は起きず、開いたときの 1 回だけ。
 */
export function useModalKeyboard({
  isOpen,
  modalRef,
  onClose,
  onEscape,
}: UseModalKeyboardOptions): void {
  const onCloseRef = useRef(onClose);
  const onEscapeRef = useRef(onEscape);
  onCloseRef.current = onClose;
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!isOpen) return;

    modalRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      const modal = modalRef.current;
      if (!modal) return;

      if (event.key === 'Escape') {
        if (onEscapeRef.current?.()) return;
        suppressEvent(event);
        onCloseRef.current();
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
  }, [isOpen, modalRef]);
}

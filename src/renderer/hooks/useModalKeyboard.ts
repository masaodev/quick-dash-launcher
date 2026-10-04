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

/** モーダル・ダイアログの外枠（重ねて開いたダイアログを見分けるため） */
const OVERLAY_SELECTOR =
  '.modal-overlay, .window-selector-modal-overlay, .layout-capture-modal-overlay';

/**
 * このモーダルより後に描かれた（上に重なった）ダイアログが開いているか
 *
 * 登録画面から開くウィンドウ選択・ファイル選択・削除の確認などは、登録画面の外に後から描かれる
 */
function hasOverlayAbove(modal: HTMLElement): boolean {
  return Array.from(document.querySelectorAll(OVERLAY_SELECTOR)).some(
    (overlay) =>
      !overlay.contains(modal) &&
      !modal.contains(overlay) &&
      (modal.compareDocumentPosition(overlay) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
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
 * Escape: モーダルを閉じる（上に重ねたダイアログが開いているとき、onEscapeがtrueを返したときはスキップ）
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
        // 上に重ねたダイアログが開いていれば、Escape はそちらに任せる
        if (hasOverlayAbove(modal) || onEscapeRef.current?.()) return;
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

        // 端では反対の端へ折り返す。それ以外はブラウザの既定のフォーカス移動に任せる
        if (event.shiftKey && document.activeElement === firstEl) {
          lastEl.focus();
          suppressEvent(event);
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          firstEl.focus();
          suppressEvent(event);
        } else {
          suppressEvent(event, false);
        }
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

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToastItemType, WindowInfo } from '@common/types';

import { ipcErrorMessage } from '../utils/ipcError';

type Hwnd = WindowInfo['hwnd'];
type OperationResult = { success: boolean; error?: string };

interface UseWindowOperationsParams {
  /** 閉じたウィンドウを再取得を待たずに一覧から外す */
  removeWindowFromList: (hwnd: Hwnd) => void;
  /** 操作の後の取り直し（選択の位置を保つ） */
  refreshWindowsKeepingSelection: () => Promise<void>;
}

export interface WindowOperations {
  /** 閉じる。閉じた（WM_CLOSE を送れた）ウィンドウを返す */
  closeWindows: (wins: WindowInfo[]) => Promise<WindowInfo[]>;
  /** 固定・固定解除。pin を省くと、1 つでも固定していないものがあれば全部固定、全部固定済みなら全部解除 */
  togglePinned: (wins: WindowInfo[], pin?: boolean) => Promise<void>;
  /** 仮想デスクトップへ移動。移動先を関数で渡すと、ウィンドウごとに決める（null なら動かさない） */
  moveToDesktop: (
    wins: WindowInfo[],
    target: number | ((win: WindowInfo) => number | null)
  ) => Promise<void>;
  /** 閉じている途中か（Ctrl+D の連打で同じウィンドウを狙わないように） */
  isClosing: (hwnd: Hwnd) => boolean;
}

/**
 * ウィンドウ検索モードのウィンドウ操作（閉じる・固定・移動）
 *
 * キー操作（Ctrl+D／Ctrl+P／Ctrl+←→）と右クリックメニューの両方から使う。
 * 1 つでも複数でも同じ関数で扱い、結果のトーストは 1 回だけ出す。
 */
export function useWindowOperations({
  removeWindowFromList,
  refreshWindowsKeepingSelection,
}: UseWindowOperationsParams): WindowOperations {
  const { t } = useTranslation();
  // Ctrl+D で閉じている途中のウィンドウ。処理が詰まっている間に押された Ctrl+D は
  // 一覧が更新される前の同じ描画のまま続けて実行されるので、ここで覚えて対象から外す
  const closingHwndsRef = useRef(new Set<Hwnd>());

  function displayNameOf(wins: WindowInfo[]): string {
    return wins.length === 1
      ? wins[0].title
      : t('launcher.windowActions.windowCount', { count: wins.length });
  }

  /** 順に実行し、成功したものと失敗したもの（最初のエラー）に分ける */
  async function runEach(
    wins: WindowInfo[],
    fn: (win: WindowInfo) => Promise<OperationResult>
  ): Promise<{ done: WindowInfo[]; failed: WindowInfo[]; firstError?: string }> {
    const done: WindowInfo[] = [];
    const failed: WindowInfo[] = [];
    let firstError: string | undefined;
    for (const win of wins) {
      let result: OperationResult;
      try {
        result = await fn(win);
      } catch (error) {
        result = { success: false, error: ipcErrorMessage(error) };
      }
      if (result.success) {
        done.push(win);
      } else {
        failed.push(win);
        firstError ??= result.error;
      }
    }
    return { done, failed, firstError };
  }

  /**
   * 結果をトーストで知らせ、1 つでも成功していれば一覧を取り直す。
   * すべて失敗したときは「<失敗の見出し>: <理由>」、一部だけ失敗したときは成功の文言に失敗の件数を添える
   * （成功の文言を省くとトーストの既定の文言になるので、件数だけのトーストにならないよう必ず渡す）
   */
  async function report(
    outcome: { done: WindowInfo[]; failed: WindowInfo[]; firstError?: string },
    itemType: ToastItemType,
    errorLabel: string,
    successMessage: string
  ): Promise<void> {
    const { done, failed, firstError } = outcome;
    if (done.length === 0) {
      await window.electronAPI.showToastWindow({
        displayName: displayNameOf(failed),
        itemType,
        message: t('launcher.windowActions.failedWithReason', {
          label: errorLabel,
          reason: firstError || t('common.unknownError'),
        }),
      });
      return;
    }
    const message =
      failed.length > 0
        ? t('launcher.windowActions.withPartlyFailed', {
            message: successMessage,
            count: failed.length,
          })
        : successMessage;
    await window.electronAPI.showToastWindow({
      displayName: displayNameOf(done),
      itemType,
      message,
    });
    await refreshWindowsKeepingSelection();
  }

  async function closeWindows(wins: WindowInfo[]): Promise<WindowInfo[]> {
    if (wins.length === 0) return [];
    const closing = closingHwndsRef.current;
    wins.forEach((w) => closing.add(w.hwnd));
    try {
      const outcome = await runEach(wins, async (win) => {
        const result = await window.electronAPI.closeWindow(win.hwnd);
        if (result.success) {
          removeWindowFromList(win.hwnd);
        }
        return result;
      });
      // 閉じるよう頼んだだけなので、閉じる（隠れる）のを待ってから一覧を取り直す
      if (outcome.done.length > 0) {
        await window.electronAPI.waitForWindowsClosed(outcome.done.map((w) => w.hwnd));
      }
      await report(
        outcome,
        'windowClose',
        t('launcher.windowActions.closeFailed'),
        t('launcher.windowActions.closed')
      );
      return outcome.done;
    } finally {
      wins.forEach((w) => closing.delete(w.hwnd));
    }
  }

  async function togglePinned(wins: WindowInfo[], pin?: boolean): Promise<void> {
    if (wins.length === 0) return;
    let shouldPin = pin;
    if (shouldPin === undefined) {
      // 一覧の印は古いことがあるので、今の状態を聞いてから決める
      const pinned = await Promise.all(wins.map((w) => window.electronAPI.isWindowPinned(w.hwnd)));
      shouldPin = pinned.some((p) => !p);
    }
    const outcome = await runEach(wins, (win) =>
      shouldPin ? window.electronAPI.pinWindow(win.hwnd) : window.electronAPI.unPinWindow(win.hwnd)
    );
    await report(
      outcome,
      shouldPin ? 'windowPin' : 'windowUnpin',
      shouldPin
        ? t('launcher.windowActions.showOnAllDesktopsFailed')
        : t('launcher.windowActions.stopShowingOnAllDesktopsFailed'),
      shouldPin
        ? t('launcher.windowActions.shownOnAllDesktops')
        : t('launcher.windowActions.stoppedShowingOnAllDesktops')
    );
  }

  async function moveToDesktop(
    wins: WindowInfo[],
    target: number | ((win: WindowInfo) => number | null)
  ): Promise<void> {
    const moves = wins
      .map((win) => ({ win, desktop: typeof target === 'number' ? target : target(win) }))
      .filter((m): m is { win: WindowInfo; desktop: number } => m.desktop !== null);
    if (moves.length === 0) return;
    const desktopOf = new Map(moves.map((m) => [m.win.hwnd, m.desktop]));
    const outcome = await runEach(
      moves.map((m) => m.win),
      (win) => window.electronAPI.moveWindowToDesktop(win.hwnd, desktopOf.get(win.hwnd)!)
    );
    const destinations = [...new Set(outcome.done.map((w) => desktopOf.get(w.hwnd)!))];
    const count = outcome.done.length;
    const successMessage =
      destinations.length !== 1
        ? t('launcher.windowActions.moved', { count })
        : count === 1
          ? t('launcher.windowActions.movedOneToDesktop', { desktop: destinations[0] })
          : t('launcher.windowActions.movedManyToDesktop', { count, desktop: destinations[0] });
    await report(
      outcome,
      'windowMoveDesktop',
      t('launcher.windowActions.moveFailed'),
      successMessage
    );
  }

  return {
    closeWindows,
    togglePinned,
    moveToDesktop,
    isClosing: (hwnd) => closingHwndsRef.current.has(hwnd),
  };
}

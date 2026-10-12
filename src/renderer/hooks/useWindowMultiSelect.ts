import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppItem, SearchMode, WindowInfo } from '@common/types';
import { isWindowInfo } from '@common/types/guards';

type Hwnd = WindowInfo['hwnd'];

interface UseWindowMultiSelectParams {
  searchMode: SearchMode;
  /** 表示中のアイテム（ウィンドウ検索モードではウィンドウ） */
  filteredItems: AppItem[];
  selectedIndex: number;
}

export interface WindowMultiSelect {
  /** 選んでいるウィンドウ（表示中のものだけ、一覧の並び順） */
  markedWindows: WindowInfo[];
  isMarked: (hwnd: Hwnd) => boolean;
  /** Shift+↑↓: 起点から移動先までを選ぶ（戻れば縮む）。Shift を押す前に選んでいた行は残す */
  extendTo: (index: number) => void;
  /** Shift+↑↓ 以外でカーソルが動いたとき。次の Shift+↑↓ の起点を今の行にする */
  resetAnchor: () => void;
  /** Ctrl+クリック: 1 行の選択を切り替える */
  toggle: (index: number) => void;
  /** Shift+クリック: 起点（なければカーソル）からその行までを選ぶ */
  selectRangeTo: (index: number) => void;
  /** Ctrl+Shift+A: 表示中をすべて選ぶ */
  selectAll: () => void;
  clear: () => void;
  /** 操作の対象: 選んでいればそれ、なければカーソルの行 */
  targetsFor: (cursorWindow: WindowInfo | undefined) => WindowInfo[];
  /** 2 つ以上を閉じる前の確認（一覧の下の帯）。出ていないときは null */
  pendingClose: WindowInfo[] | null;
  setPendingClose: (wins: WindowInfo[] | null) => void;
}

/**
 * ウィンドウ検索モードの複数選択
 *
 * カーソル（selectedIndex。今いる行）とは別に、選んだウィンドウの集まりを hwnd で持つ。
 * 選んだ行が検索語やタブの切り替えで見えなくなったら選択から外す（見えないウィンドウを
 * 閉じてしまわないように）。通常モードに戻ったら全部外す。
 * 選択か確認の帯があるあいだは、Esc をメインプロセスで隠す処理に回さずページで受ける。
 */
export function useWindowMultiSelect({
  searchMode,
  filteredItems,
  selectedIndex,
}: UseWindowMultiSelectParams): WindowMultiSelect {
  const [marked, setMarked] = useState<Set<Hwnd>>(() => new Set());
  const [pendingClose, setPendingClose] = useState<WindowInfo[] | null>(null);
  // Shift+↑↓ の起点（Shift を押し始めた行）と、そのとき選んでいた行
  const anchorRef = useRef<number | null>(null);
  const baseRef = useRef<Set<Hwnd>>(new Set());
  // Shift+クリックの起点（最後に Ctrl+クリックした行）。Shift+↑↓ の起点とは分ける。
  // Ctrl+クリックの後にマウスのホバーでカーソルが動いても、Shift+↑↓ は今の行から選ぶように
  const clickAnchorRef = useRef<number | null>(null);

  const windows = useMemo(
    () => (searchMode === 'window' ? filteredItems.filter(isWindowInfo) : []),
    [searchMode, filteredItems]
  );
  const markedWindows = useMemo(() => windows.filter((w) => marked.has(w.hwnd)), [windows, marked]);

  // 見えなくなった行・閉じたウィンドウの選択を外す。通常モードに戻ったら全部外す
  useEffect(() => {
    if (marked.size === 0) return;
    if (markedWindows.length !== marked.size) {
      setMarked(new Set(markedWindows.map((w) => w.hwnd)));
    }
  }, [marked, markedWindows]);

  // 選択が変わったら確認の帯は引っ込める（確認した対象と違うものを閉じないように）
  useEffect(() => {
    setPendingClose(null);
  }, [marked, searchMode]);

  const escapeHandledByPage = markedWindows.length > 0 || pendingClose !== null;
  useEffect(() => {
    window.electronAPI.setEscapeHandledByPage?.(escapeHandledByPage);
  }, [escapeHandledByPage]);
  // アンマウント（開発中のホットリロードなど）のときは戻す。残るとメインプロセスが Esc で隠さなくなる。
  // ページの読み直し・クラッシュでは cleanup が走らないので、メインプロセス側でも戻している
  useEffect(() => () => window.electronAPI?.setEscapeHandledByPage?.(false), []);

  function rangeHwnds(a: number, b: number): Hwnd[] {
    const [start, end] = a < b ? [a, b] : [b, a];
    return windows.slice(start, end + 1).map((w) => w.hwnd);
  }

  function extendTo(index: number): void {
    if (windows.length === 0) return;
    if (anchorRef.current === null) {
      anchorRef.current = selectedIndex;
      baseRef.current = new Set(marked);
    }
    const next = new Set(baseRef.current);
    rangeHwnds(anchorRef.current, index).forEach((h) => next.add(h));
    setMarked(next);
  }

  function resetAnchor(): void {
    anchorRef.current = null;
    clickAnchorRef.current = null;
  }

  function toggle(index: number): void {
    const win = windows[index];
    if (!win) return;
    const next = new Set(marked);
    if (next.has(win.hwnd)) next.delete(win.hwnd);
    else next.add(win.hwnd);
    setMarked(next);
    clickAnchorRef.current = index;
    // 次の Shift+↑↓ は、その時点のカーソルの行と選択から始める
    anchorRef.current = null;
  }

  function selectRangeTo(index: number): void {
    const from = clickAnchorRef.current ?? anchorRef.current ?? selectedIndex;
    const next = new Set(marked);
    rangeHwnds(from, index).forEach((h) => next.add(h));
    setMarked(next);
  }

  function selectAll(): void {
    setMarked(new Set(windows.map((w) => w.hwnd)));
    resetAnchor();
  }

  function clear(): void {
    setMarked(new Set());
    resetAnchor();
  }

  function targetsFor(cursorWindow: WindowInfo | undefined): WindowInfo[] {
    if (markedWindows.length > 0) return markedWindows;
    return cursorWindow ? [cursorWindow] : [];
  }

  return {
    markedWindows,
    isMarked: (hwnd) => marked.has(hwnd),
    extendTo,
    resetAnchor,
    toggle,
    selectRangeTo,
    selectAll,
    clear,
    targetsFor,
    pendingClose,
    setPendingClose,
  };
}

/**
 * 画面: メインウィンドウ
 * 画面仕様: docs/screens/main-window.md
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_DATA_FILE } from '@common/types';
import { DESKTOP_TAB } from '@common/constants';
import type {
  LauncherItem,
  AppItem,
  PinLevel,
  SearchMode,
  WindowInfo,
  VirtualDesktopInfo,
  IconFetchErrorRecord,
  WorkspaceItem,
} from '@common/types';
import { isWindowInfo, isClipboardItem, isSetItem, isLauncherItem } from '@common/types/guards';
import { formatImportSummary, summarizeImportResults } from '@common/utils/bookmarkImportUtils';
import { PathUtils } from '@common/utils/pathUtils';
import { canRunAsAdmin } from '@common/utils/runAsAdmin';

import LauncherSearchBox from './components/LauncherSearchBox';
import LauncherHintBar from './components/LauncherHintBar';
import LauncherItemList from './components/LauncherItemList';
import LauncherActionButtons from './components/LauncherActionButtons';
import LauncherIconProgressBar from './components/LauncherIconProgressBar';
import LauncherFileTabBar from './components/LauncherFileTabBar';
import LauncherDesktopTabBar from './components/LauncherDesktopTabBar';
import LauncherItemCountDisplay from './components/LauncherItemCountDisplay';
import MissingIconNotice from './components/MissingIconNotice';
import { SetupFirstLaunch } from './components/SetupFirstLaunch';
import AlertDialog from './components/AlertDialog';
import ConfirmDialog from './components/ConfirmDialog';
import { filterItems } from './utils/dataParser';
import { filterWindowsByDesktopTab } from './utils/windowFilter';
import { findNoMatchElsewhere } from './utils/noMatchElsewhere';
import { debugLog, logError } from './utils/debug';
import { indexById, setEntryNames } from './utils/setEditing';
import { loadItemIcons } from './utils/customIcons';
import { useIconProgress } from './hooks/useIconProgress';
import { useSearchHistory } from './hooks/useSearchHistory';
import { useRegisterWindow } from './hooks/useRegisterWindow';
import { useItemActions } from './hooks/useItemActions';
import { useDataFileTabs } from './hooks/useDataFileTabs';
import { useShowKeyboardHints } from './hooks/useShowKeyboardHints';
import { useSearchMemo } from './hooks/useSearchMemo';
import { useIconFetcher } from './hooks/useIconFetcher';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWindowOperations } from './hooks/useWindowOperations';
import { useWindowMultiSelect } from './hooks/useWindowMultiSelect';
import { useGlobalLoading } from './hooks/useGlobalLoading';
import { useToast } from './hooks/useToast';
import { useAlertDialog } from './hooks/useDialogManager';
import { useLauncherItemDelete } from './hooks/useLauncherItemDelete';
import { classifyPastedText } from './utils/pasteClassifier';

/** ウィンドウ検索の既定のデスクトップのタブ: 今のデスクトップ（分からなければ「すべて」） */
function defaultDesktopTab(info: Pick<VirtualDesktopInfo, 'supported' | 'currentDesktop'>): number {
  return info.supported && info.currentDesktop > 0 ? info.currentDesktop : DESKTOP_TAB.ALL;
}

function App(): React.ReactElement {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [mainItems, setMainItems] = useState<AppItem[]>([]);
  /** セットのツールチップで行の名前を引く（絞り込みの外のアイテムも引けるよう、全アイテムから） */
  const nameOfMainItem = useMemo(() => {
    const byId = indexById(mainItems);
    return (itemId: string) => {
      const item = byId.get(itemId);
      return item && 'displayName' in item ? item.displayName : undefined;
    };
  }, [mainItems]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pinLevel, setPinLevel] = useState<PinLevel>(0);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('normal');
  const [windowList, setWindowList] = useState<WindowInfo[]>([]);

  // 仮想デスクトップ関連の状態
  const [desktopInfo, setDesktopInfo] = useState<{
    supported: boolean;
    desktopCount: number;
    currentDesktop: number;
  } | null>(null);
  const [activeDesktopTab, setActiveDesktopTab] = useState<number>(0); // 0 = すべて

  // AlertDialog状態管理
  const { alertDialog, showAlert, closeAlert } = useAlertDialog();

  const showErrorAlert = (message: string) => {
    showAlert(message, 'error');
  };

  // アイコン取得エラー記録
  const [iconFetchErrors, setIconFetchErrors] = useState<IconFetchErrorRecord[]>([]);
  // 進捗バーを出さない裏の取得の最中か（その間は「アイコン未取得」を出さない）
  const [isFetchingIconsSilently, setIsFetchingIconsSilently] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { progressState, resetProgress } = useIconProgress();
  const { navigateToPrevious, navigateToNext, resetNavigation, addHistoryEntry } =
    useSearchHistory();
  // 登録・編集は独立した子ウィンドウで行う（メインウィンドウは動かさない）。保存先の初期値は今のタブ
  const activeTabRef = useRef<string | undefined>(undefined);
  const { isRegisterWindowOpen, openRegisterWindow, openEditWindow, openWithDroppedPaths } =
    useRegisterWindow(useCallback(() => activeTabRef.current, []));
  const {
    handleCopyPath,
    handleCopyParentPath,
    handleCopyShortcutPath,
    handleCopyShortcutParentPath,
    handleOpenParentFolder,
    handleOpenShortcutParentFolder,
  } = useItemActions();
  const { showSuccess, showWarning } = useToast();

  const {
    showDataFileTabs,
    activeTab,
    dataFileTabs,
    dataFileLabels,
    setActiveTab,
    getTabFilteredItems,
  } = useDataFileTabs();
  activeTabRef.current = activeTab;
  const showKeyboardHints = useShowKeyboardHints();
  // 検索でメモにも当てるか（変わったら一覧を絞り直す）
  const searchMemo = useSearchMemo();

  // ワークスペースからドラッグされたアイテム。選んでいるタブ（の先頭のファイル）へ移し、ワークスペース側を参照にする
  // （結果はメインプロセスがトーストで知らせる）。参照はもうメインウィンドウにあるので、移さずに知らせる
  const handleWorkspaceItemDropped = useCallback(
    (item: WorkspaceItem) => {
      if (item.type === 'ref') {
        showWarning(t('workspace.ref.cannotMoveMissing', { name: item.displayName }));
        return;
      }
      if (item.ref) {
        showWarning(t('workspace.ref.alreadyInMain', { name: item.displayName }));
        return;
      }
      window.electronAPI.workspaceAPI
        .moveToMain(item.id, activeTabRef.current || undefined)
        .catch((error) => logError('メインウィンドウへ移せませんでした:', error));
    },
    [showWarning, t]
  );

  const itemDelete = useLauncherItemDelete(showErrorAlert);

  // Shift+F10・アプリケーションキーで検索欄にも右クリックのイベントが来る（マウスの右ボタンではない）。
  // メインウィンドウでは行のメニューを出すので、そちらは止めて検索欄の文字のメニューを出さない
  useEffect(() => {
    const suppressKeyboardContextMenu = (e: MouseEvent) => {
      if (e.isTrusted && e.button !== 2) e.preventDefault();
    };
    document.addEventListener('contextmenu', suppressKeyboardContextMenu, true);
    return () => document.removeEventListener('contextmenu', suppressKeyboardContextMenu, true);
  }, []);

  // Shift+F10・アプリケーションキー: 選んでいる行に右クリックのイベントを起こし、行の左下にメニューを出す
  const openRowContextMenu = useCallback((index: number) => {
    const row = document.querySelector<HTMLElement>(`.item-row-wrapper[data-index="${index}"]`);
    if (!row) return;
    const rect = row.getBoundingClientRect();
    row.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 24,
        clientY: rect.bottom,
      })
    );
  }, []);

  // 一覧の余白の右クリック（➕ と同じ追加の入口。ウィンドウ検索では出さない）
  useEffect(() => {
    const cleanups = [
      window.electronAPI.onLauncherBlankMenuAddItem(() => void openRegisterWindow()),
      window.electronAPI.onLauncherBlankMenuRegisterFromClipboard(async () => {
        try {
          const { files, text } = await window.electronAPI.readClipboardForRegister();
          if (files.length > 0) {
            void openWithDroppedPaths(files);
            return;
          }
          // ファイル・フォルダ・URL の形をしているものだけ（ただの文字列は登録の初期値にしない）
          const pasted = classifyPastedText(text);
          if (pasted && pasted.kind !== 'text') {
            void openWithDroppedPaths([pasted.value]);
            return;
          }
          showWarning(t('launcher.registerMenu.clipboardEmpty'));
        } catch (error) {
          logError('クリップボードを読めませんでした:', error);
        }
      }),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [openRegisterWindow, openWithDroppedPaths, showWarning, t]);

  const { isDraggingOver, dragOverKind } = useDragAndDrop(
    (paths: string[]) => openWithDroppedPaths(paths),
    showErrorAlert,
    isRegisterWindowOpen,
    handleWorkspaceItemDropped
  );

  const loadIconFetchErrors = useCallback(async () => {
    const errors = await window.electronAPI.getIconFetchErrors();
    setIconFetchErrors(errors);
  }, []);

  const {
    handleRefreshAll,
    handleFetchMissingIcons,
    handleFetchMissingIconsSilently,
    handleFetchMissingIconsCurrentTab,
  } = useIconFetcher({
    mainItems,
    setMainItems,
    activeTab,
    dataFileTabs,
    reloadIconFetchErrors: loadIconFetchErrors,
  });

  const { withLoading } = useGlobalLoading();

  // ウィンドウリストの世代。取得中に新しい取得や削除があれば、古い取得結果は捨てる
  // （Ctrl+D の連打で、閉じる前に取得した一覧が後から届いて閉じたウィンドウが戻るのを防ぐ）
  const windowListVersionRef = useRef(0);

  // resetSelection: F5・リンクでの取り直しは選択を先頭に戻す。閉じる・固定・移動の後は位置を保つ
  //（Ctrl+D を続けたとき、先頭ではなく今の位置のウィンドウを閉じるように）
  const loadWindowList = useCallback(
    async (resetSelection: boolean) => {
      if (searchMode !== 'window') return;

      const version = ++windowListVersionRef.current;
      await withLoading(t('launcher.loading.windows'), async () => {
        // ウィンドウリストと仮想デスクトップ情報を再取得
        const [windows, info] = await Promise.all([
          window.electronAPI.getAllWindowsAllDesktops(),
          window.electronAPI.getVirtualDesktopInfo(),
        ]);
        if (version !== windowListVersionRef.current) return;
        setWindowList(windows);
        setDesktopInfo(info);
        // 選んでいたタブが無くなった（デスクトップを減らした・全デスクトップ表示のウィンドウが無くなった）ら、
        // 今のデスクトップのタブ（無ければ「すべて」）に戻す。そのままだと選んだタブが無く、一覧が空になる
        setActiveDesktopTab((tab) => {
          const gone =
            (tab > 0 && tab > info.desktopCount) ||
            (tab === DESKTOP_TAB.PINNED && !windows.some((w) => w.isPinned === true));
          if (!gone) return tab;
          return defaultDesktopTab(info);
        });
        if (resetSelection) setSelectedIndex(0);
      });
    },
    [searchMode, withLoading, t]
  );
  const handleRefreshWindows = useCallback(() => loadWindowList(true), [loadWindowList]);
  const refreshWindowsKeepingSelection = useCallback(() => loadWindowList(false), [loadWindowList]);

  /** 閉じたウィンドウを再取得を待たずに一覧から外す（連打したとき次の Ctrl+D が同じウィンドウを狙わないように） */
  const removeWindowFromList = useCallback((hwnd: WindowInfo['hwnd']) => {
    windowListVersionRef.current++;
    setWindowList((prev) => prev.filter((w) => w.hwnd !== hwnd));
  }, []);

  // trigger: 起動時と F5 は省略（explicit）。完全リフレッシュは 'full'（パスの種類も確かめ直す）。
  // アプリ内の操作に伴う再読込は 'internal'（先行の再読込があれば結果を共有する）
  const loadItems = async (trigger?: 'explicit' | 'full' | 'internal'): Promise<AppItem[]> => {
    const items = await window.electronAPI.loadDataFiles(trigger);

    // Load cached icons (LauncherItemのみ)
    const launcherItems = items.filter(
      (item) => !isWindowInfo(item) && !isSetItem(item)
    ) as LauncherItem[];
    const [iconCache, customIcons] = await loadItemIcons(
      launcherItems,
      // path を持たないクリップボード・セットは、カスタムアイコンをファイル名で読む
      items.map((item) => (isClipboardItem(item) || isSetItem(item) ? item.customIcon : undefined))
    );

    // Apply cached icons to items
    const itemsWithIcons = items.map((item) => {
      if (isClipboardItem(item) || isSetItem(item)) {
        const icon = item.customIcon ? customIcons[item.customIcon] : undefined;
        return icon ? { ...item, icon } : item;
      }
      if (!isLauncherItem(item)) {
        return item;
      }
      return {
        ...item,
        icon: iconCache[item.path] || item.icon,
      };
    });

    setMainItems(itemsWithIcons);
    return itemsWithIcons;
  };

  const handleReloadItems = async (): Promise<void> => {
    // F5 は「QDL 外で編集した設定ファイルを反映する」入口でもある。
    // settings.json の副作用（ホットキー等）を適用し直してからデータを読み直す
    await window.electronAPI.reapplySettings().catch((error) => {
      logError('設定の再適用に失敗しました:', error);
    });
    await withLoading(t('launcher.loading.data'), loadItems);
  };

  /** ウィンドウ検索モードに入る。全仮想デスクトップのウィンドウとデスクトップ情報を取り、今のデスクトップのタブを選ぶ */
  const enterWindowMode = useCallback(async (): Promise<void> => {
    setSearchMode('window');
    const [windows, info] = await Promise.all([
      window.electronAPI.getAllWindowsAllDesktops(),
      window.electronAPI.getVirtualDesktopInfo(),
    ]);
    setWindowList(windows);
    setDesktopInfo(info);
    setActiveDesktopTab(defaultDesktopTab(info));
  }, []);

  const handleToggleSearchMode = async () => {
    if (searchMode === 'normal') {
      // 通常モード → ウィンドウ検索モード
      await enterWindowMode();
    } else {
      // ウィンドウ検索モード → 通常モード
      setSearchMode('normal');
      setWindowList([]);
      setDesktopInfo(null);
      setActiveDesktopTab(0);
    }
    setSelectedIndex(0); // 選択インデックスをリセット
  };

  const executeAppItem = useCallback(
    async (item: AppItem): Promise<void> => {
      if (isClipboardItem(item)) {
        // 書き戻しは一瞬なので、書き戻してから「コピーしました」を出す（前に出すと終わっていないように見える）
        const restored = await window.electronAPI.clipboardAPI.restore(item.clipboardDataRef);
        if (restored.success) {
          await window.electronAPI.showToastWindow({
            displayName: item.displayName,
            itemType: 'clipboard',
          });
        } else {
          await window.electronAPI.showToastWindow({
            type: 'error',
            message: t('launcher.messages.launchFailed', {
              name: item.displayName,
              error: restored.error ?? '',
            }),
            duration: 6000,
          });
        }
      } else if (isSetItem(item)) {
        // 置き場所のある行があれば、進み具合の表示が出る（トーストはその間は出ない）
        await window.electronAPI.showToastWindow({
          displayName: item.displayName,
          itemType: 'set',
          itemCount: item.entries.length,
          itemNames: setEntryNames(item.entries, mainItems).slice(0, 3),
        });
        await window.electronAPI.executeSet(item, mainItems);
      } else if (isLauncherItem(item)) {
        await window.electronAPI.showToastWindow({
          displayName: item.displayName,
          itemType: item.type,
          path: item.path,
          icon: item.icon,
        });
        await window.electronAPI.openItem(item);
      }
    },
    [mainItems]
  );

  const handleExecuteItem = useCallback(
    async (item: AppItem) => {
      try {
        if (searchMode === 'window') {
          // ウィンドウモード
          const windowItem = item as WindowInfo;
          const result = await window.electronAPI.activateWindowByHwnd(windowItem.hwnd);

          if (!result.success) {
            showErrorAlert(t('launcher.messages.activateWindowFailed'));
          } else {
            await window.electronAPI.showToastWindow({
              displayName: windowItem.title,
              itemType: 'windowActivate',
            });
          }
        } else {
          // 通常モード
          // 検索クエリを事前保存（実行後にクリアされる可能性を考慮）
          const searchQueryForHistory = searchQuery.trim();

          await executeAppItem(item);

          // バックグラウンドで履歴追加（fire-and-forget）
          if (searchQueryForHistory) {
            addHistoryEntry(searchQueryForHistory).catch((error) => {
              logError('検索履歴の追加に失敗しました:', error);
            });
          }
        }
      } catch (error) {
        showErrorAlert(
          t('launcher.messages.openFailed', {
            reason: error instanceof Error ? error.message : String(error),
          })
        );
      }
    },
    [searchMode, searchQuery, executeAppItem, addHistoryEntry, t]
  );

  // 管理者として実行（右クリック・Ctrl+Shift+Enter）。対象はアプリだけで、ほかの種類は実行せずに知らせる
  const handleRunAsAdmin = useCallback(
    async (item: AppItem) => {
      if (isWindowInfo(item)) return;
      if (!isLauncherItem(item) || !canRunAsAdmin(item)) {
        await window.electronAPI.showToastWindow({
          type: 'info',
          message: t('launcher.messages.cannotRunAsAdmin', { name: item.displayName }),
        });
        return;
      }
      const searchQueryForHistory = searchQuery.trim();
      try {
        await window.electronAPI.showToastWindow({
          displayName: item.displayName,
          itemType: item.type,
          path: item.path,
          icon: item.icon,
        });
        await window.electronAPI.runItemAsAdmin(item);
        if (searchQueryForHistory) {
          addHistoryEntry(searchQueryForHistory).catch((error) => {
            logError('検索履歴の追加に失敗しました:', error);
          });
        }
      } catch (error) {
        showErrorAlert(
          t('launcher.messages.openFailed', {
            reason: error instanceof Error ? error.message : String(error),
          })
        );
      }
    },
    [searchQuery, addHistoryEntry, t]
  );

  const tabFilteredItems = useMemo(
    () => getTabFilteredItems(mainItems),
    [getTabFilteredItems, mainItems]
  );

  // Ctrl+P でウィンドウを固定（全デスクトップに表示）してよいか。非対応と分かっているときだけ止める
  //（読み込み前は固定を試し、失敗すればそのトーストが出る）。ヒントは対応と分かってから出す
  const canPinWindow = desktopInfo?.supported !== false;

  // ウィンドウ検索モードで仮想デスクトップのタブを出すか（2 つ以上あるとき）
  const showDesktopTabs =
    searchMode === 'window' && !!desktopInfo?.supported && desktopInfo.desktopCount > 1;
  // 件数（n件）を出すか: 通常モードでタブ表示 OFF／ウィンドウ検索でデスクトップのタブが出ていない
  const showCountBar =
    (!showDataFileTabs && searchMode === 'normal') || (searchMode === 'window' && !showDesktopTabs);

  const filteredItems = useMemo(() => {
    const itemsToFilter =
      searchMode === 'window'
        ? filterWindowsByDesktopTab(windowList, activeDesktopTab)
        : tabFilteredItems;
    return filterItems(itemsToFilter, searchQuery, searchMode);
    // searchMemo は filterItems の中で読む設定。変わったら絞り直す
  }, [searchMode, windowList, activeDesktopTab, tabFilteredItems, searchQuery, searchMemo]);

  // 検索で 0 件のとき、他のタブや通常の検索に合うものがあるか（一覧が空の案内に使う）
  const noMatchElsewhere = useMemo(
    () =>
      filteredItems.length > 0
        ? null
        : findNoMatchElsewhere({
            searchMode,
            searchQuery,
            mainItems,
            dataFileTabs,
            showDataFileTabs,
            activeTab,
            windowList,
            showDesktopTabs,
            activeDesktopTab,
          }),
    [
      filteredItems.length,
      searchMode,
      searchQuery,
      mainItems,
      dataFileTabs,
      showDataFileTabs,
      activeTab,
      windowList,
      showDesktopTabs,
      activeDesktopTab,
    ]
  );

  // 一覧が縮んで選択が範囲外になったら末尾に合わせる（末尾のウィンドウを閉じた後など）
  useEffect(() => {
    if (filteredItems.length > 0 && selectedIndex >= filteredItems.length) {
      setSelectedIndex(filteredItems.length - 1);
    }
  }, [filteredItems.length, selectedIndex]);

  const handleEditItem = useCallback(
    (item: AppItem) => {
      if (isWindowInfo(item)) return;

      if (isSetItem(item)) {
        void openEditWindow({
          ...item,
          sourceFile: item.sourceFile || DEFAULT_DATA_FILE,
          jsonItemId: item.id ?? undefined,
        });
        return;
      }

      const launcherItem = item as LauncherItem;
      const jsonItemId = launcherItem.isDirExpanded ? launcherItem.expandedFromId : launcherItem.id;
      void openEditWindow({
        ...launcherItem,
        sourceFile: launcherItem.sourceFile || DEFAULT_DATA_FILE,
        jsonItemId: jsonItemId ?? undefined,
      });
    },
    [openEditWindow]
  );

  // 右クリック「この取込から外す…」: 元のフォルダ取込の編集画面を、除外フィルタにファイル名を足した状態で開く
  useEffect(
    () =>
      window.electronAPI.onLauncherMenuExcludeFromDir((item) => {
        if (!isLauncherItem(item) || !item.isDirExpanded || !item.expandedFromId) return;
        const fileName = PathUtils.getFileName(item.path.replace(/[\\/]+$/, ''));
        if (!fileName) return;
        void openEditWindow(
          {
            ...item,
            sourceFile: item.sourceFile || DEFAULT_DATA_FILE,
            jsonItemId: item.expandedFromId,
          },
          { addExcludeName: fileName }
        );
      }),
    [openEditWindow]
  );

  const windowOps = useWindowOperations({ removeWindowFromList, refreshWindowsKeepingSelection });
  const windowSelection = useWindowMultiSelect({ searchMode, filteredItems, selectedIndex });
  const markedCount = windowSelection.markedWindows.length;

  /** 右クリック（2 つ以上を選んでいるとき）の「閉じる」。キーの Ctrl+D と同じく確認の帯を出す */
  const handleMenuCloseMarked = () => {
    void windowSelection.requestClose(windowSelection.markedWindows, windowOps.closeWindows);
  };

  const { handleKeyDown, switchToNextTab } = useKeyboardShortcuts({
    showDataFileTabs,
    activeTab,
    dataFileTabs,
    mainItems,
    filteredItems,
    searchQuery,
    selectedIndex,
    setSelectedIndex,
    setActiveTab,
    navigateToPrevious,
    navigateToNext,
    setSearchQuery,
    handleExecuteItem,
    handleEditItem,
    searchMode,
    windowList,
    toggleSearchMode: handleToggleSearchMode,
    refreshWindows: handleRefreshWindows,
    windowOps,
    windowSelection,
    reloadData: handleReloadItems,
    desktopCount: desktopInfo?.desktopCount || 0,
    canPinWindow,
    activeDesktopTab,
    setActiveDesktopTab,
    onCopyPath: handleCopyPath,
    onCopyParentPath: handleCopyParentPath,
    onOpenContextMenu: openRowContextMenu,
    onRunAsAdmin: handleRunAsAdmin,
  });

  // リストの行や余白（フォーカスを受け取らない要素）をクリックするとフォーカスが body に移り、
  // .app の onKeyDown にキーが届かなくなる。body に来たキーは検索欄にフォーカスを戻してから処理する
  //（文字キーも検索欄に入る）
  // 削除の確認を出している間は、Enter・Esc などを確認ダイアログだけが受ける（一覧のアイテムを開かない）
  const handleAppKeyDown = useCallback(
    (e: React.KeyboardEvent) => (itemDelete.isOpen ? undefined : handleKeyDown(e)),
    [handleKeyDown, itemDelete.isOpen]
  );
  const handleKeyDownRef = useRef(handleAppKeyDown);
  handleKeyDownRef.current = handleAppKeyDown;
  useEffect(() => {
    const handleBodyKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body || !searchInputRef.current) return;
      searchInputRef.current.focus();
      void handleKeyDownRef.current(e as unknown as React.KeyboardEvent);
    };
    document.addEventListener('keydown', handleBodyKeyDown);
    return () => document.removeEventListener('keydown', handleBodyKeyDown);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([window.electronAPI.isFirstLaunch().then(setIsFirstLaunch), loadItems()]);
      window.electronAPI.notifyRendererReady();
    };

    initialize();
    loadIconFetchErrors();

    const logShowTimings = (startTime: number | undefined, suffix: string) => {
      if (startTime === undefined) return;
      const logTiming = (label: string) => {
        window.electronAPI.logPerformanceTiming(label, Date.now() - startTime);
      };
      logTiming(`renderer-received${suffix}`);
      // 表示したのに描画が止まっているときを記録する（A3-130）。そのときページが隠れている扱いかも残す
      const stallTimer = setTimeout(
        () => logTiming(`animation-frame-stalled-${document.visibilityState}${suffix}`),
        1000
      );
      requestAnimationFrame(() => {
        clearTimeout(stallTimer);
        logTiming(`before-animation-frame${suffix}`);
        requestAnimationFrame(() => {
          logTiming(`window-show-complete${suffix}`);
        });
      });
    };

    const cleanupWindowShown = window.electronAPI.onWindowShown((startTime) => {
      logShowTimings(startTime, '');
      setSearchQuery('');
      setSelectedIndex(0);
      searchInputRef.current?.focus();
    });

    const cleanupWindowShownItemSearch = window.electronAPI.onWindowShownItemSearch(
      async (startTime) => {
        logShowTimings(startTime, '-window-search');
        await enterWindowMode();
        setSearchQuery('');
        setSelectedIndex(0);
        searchInputRef.current?.focus();
      }
    );

    const cleanupWindowHidden = window.electronAPI.onWindowHidden(() => {
      setSearchQuery('');
      setSearchMode('normal');
      setWindowList([]);
    });

    const loadPinState = async () => {
      setPinLevel(await window.electronAPI.pin.get());
    };
    loadPinState();

    const cleanupPinChanged = window.electronAPI.pin.onChanged(setPinLevel);
    window.electronAPI.isWorkspaceOpen().then(setIsWorkspaceOpen);
    const cleanupWorkspaceOpenChanged =
      window.electronAPI.onWorkspaceOpenChanged(setIsWorkspaceOpen);

    const cleanupDataChanged = window.electronAPI.onDataChanged(async () => {
      debugLog('データ変更通知を受信、データを再読み込みします');
      await withLoading(t('launcher.loading.data'), () => loadItems('internal'));
    });

    // 登録・編集ウィンドウ（子ウィンドウ）での結果。データ自体は data-changed で読み直す
    const cleanupChildResult = window.electronAPI.onMainChildWindowResult((result) => {
      if (result.kind !== 'register') return;
      const messageKeys = {
        registered: 'launcher.messages.itemAdded',
        updated: 'launcher.messages.itemUpdated',
        deleted: 'launcher.messages.itemDeleted',
      } as const;
      showSuccess(t(messageKeys[result.action]));
    });

    return () => {
      cleanupWindowShown();
      cleanupWindowShownItemSearch();
      cleanupWindowHidden();
      cleanupDataChanged();
      cleanupWorkspaceOpenChanged();
      cleanupPinChanged();
      cleanupChildResult();
    };
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedIndex(0);
    resetNavigation();
  };

  const handleOpenBasicSettings = async () => {
    await window.electronAPI.openEditWindowWithTab('settings');
  };

  const handleOpenItemManagement = async () => {
    await window.electronAPI.openEditWindowWithTab('edit');
  };

  const handleToggleWorkspace = async () => {
    await window.electronAPI.toggleWorkspaceWindow();
  };

  const handleFirstLaunchComplete = async (settings: {
    hotkey: string;
    autoLaunch: boolean;
    itemSearchHotkey: string;
  }): Promise<boolean> => {
    try {
      await window.electronAPI.setMultipleSettings({
        hotkey: settings.hotkey,
        autoLaunch: settings.autoLaunch,
        itemSearchHotkey: settings.itemSearchHotkey,
      });
      await window.electronAPI.changeHotkey(settings.hotkey);
      if (settings.itemSearchHotkey) {
        await window.electronAPI.changeItemSearchHotkey(settings.itemSearchHotkey);
      }
      setIsFirstLaunch(false);
      // 初回のサンプルにはアイコンがまだ無いので、「取得」を押さなくても出るように取りに行く。
      // 頼まれた処理ではないので、進捗バーは出さない
      setIsFetchingIconsSilently(true);
      void handleFetchMissingIconsSilently().finally(() => setIsFetchingIconsSilently(false));
      return true;
    } catch (error) {
      // 初回設定の間はダイアログを描かないので、知らせるのは初回設定画面に任せる
      logError('初回設定の保存に失敗しました:', error);
      return false;
    }
  };

  const handleBookmarkAutoImport = async () => {
    const results = await window.electronAPI.bookmarkAutoImportAPI.executeAll();
    if (results.length === 0) {
      showWarning(t('launcher.messages.noBookmarkRules'));
      return;
    }
    const summary = summarizeImportResults(results);
    const message = formatImportSummary(summary, t);
    if (summary.hasError) {
      showWarning(message);
    } else {
      showSuccess(message);
    }
    await loadItems('internal');
  };

  const handleRefreshAllWrapper = async () => {
    await window.electronAPI.bookmarkAutoImportAPI.executeAll();
    await handleRefreshAll(() => loadItems('full'));
  };

  const handleTabRename = async (tabIndex: number, newName: string) => {
    const updatedTabs = dataFileTabs.map((tab, i) =>
      i === tabIndex ? { ...tab, name: newName } : tab
    );
    await window.electronAPI.setMultipleSettings({ dataFileTabs: updatedTabs });
  };

  const handleTabClickWrapper = (fileName: string) => {
    setActiveTab(fileName);
    setSelectedIndex(0);
  };

  const errorKeySet = useMemo(() => new Set(iconFetchErrors.map((e) => e.key)), [iconFetchErrors]);

  const missingIconCount = useMemo(() => {
    return mainItems.filter((item) => {
      if (!isLauncherItem(item)) {
        return false;
      }
      const launcherItem = item;
      if (
        launcherItem.type === 'folder' ||
        launcherItem.type === 'customUri' ||
        launcherItem.type === 'windowSwitch'
      ) {
        return false;
      }
      if (errorKeySet.has(launcherItem.path)) {
        return false;
      }
      return !launcherItem.icon;
    }).length;
  }, [mainItems, errorKeySet]);

  if (isFirstLaunch === null) {
    return <div className="app">{t('common.loading')}</div>;
  }

  if (isFirstLaunch) {
    return <SetupFirstLaunch onComplete={handleFirstLaunchComplete} />;
  }

  return (
    <div
      className={`app search-mode-${searchMode} ${isDraggingOver ? 'dragging-over' : ''}`}
      onKeyDown={handleAppKeyDown}
    >
      <div className="header">
        <LauncherSearchBox
          ref={searchInputRef}
          value={searchQuery}
          onChange={handleSearch}
          onKeyDown={handleAppKeyDown}
          searchMode={searchMode}
          onToggleSearchMode={handleToggleSearchMode}
        />
        <LauncherActionButtons
          searchMode={searchMode}
          onReload={handleReloadItems}
          onFetchMissingIcons={handleFetchMissingIcons}
          onFetchMissingIconsCurrentTab={handleFetchMissingIconsCurrentTab}
          onBookmarkAutoImport={handleBookmarkAutoImport}
          onRefreshAll={handleRefreshAllWrapper}
          onOpenBasicSettings={handleOpenBasicSettings}
          onOpenItemManagement={handleOpenItemManagement}
          onToggleWorkspace={handleToggleWorkspace}
          onOpenRegisterModal={() => void openRegisterWindow()}
          pinLevel={pinLevel}
          onPinLevelChange={setPinLevel}
          isWorkspaceOpen={isWorkspaceOpen}
        />
        <div className="drag-handle">⋮⋮</div>
      </div>

      {showDataFileTabs && searchMode === 'normal' && (
        <LauncherFileTabBar
          dataFileTabs={dataFileTabs}
          activeTab={activeTab}
          onTabClick={handleTabClickWrapper}
          onTabRename={handleTabRename}
          allItems={mainItems}
          searchQuery={searchQuery}
          dataFileLabels={dataFileLabels}
        />
      )}

      {(showCountBar || markedCount > 0) && (
        <div className="search-info-bar">
          {showCountBar && <LauncherItemCountDisplay count={filteredItems.length} />}
          {markedCount > 0 && (
            <span className="selection-badge" data-testid="window-selection-badge">
              {t('launcher.selectedCount', { count: markedCount })}
            </span>
          )}
        </div>
      )}

      {showDesktopTabs && desktopInfo && (
        <LauncherDesktopTabBar
          desktopInfo={desktopInfo}
          activeDesktopTab={activeDesktopTab}
          windowList={windowList}
          searchQuery={searchQuery}
          onTabChange={(tabId) => {
            setActiveDesktopTab(tabId);
            setSelectedIndex(0);
          }}
        />
      )}

      <LauncherItemList
        items={filteredItems}
        nameOfItem={nameOfMainItem}
        emptyState={
          searchQuery.trim()
            ? {
                kind: 'noMatch',
                query: searchQuery.trim(),
                windowMode: searchMode === 'window',
                elsewhere: noMatchElsewhere,
              }
            : searchMode === 'normal'
              ? { kind: 'emptyTab' }
              : null
        }
        onAddItem={() => void openRegisterWindow()}
        onBlankContextMenu={
          searchMode === 'normal'
            ? () => void window.electronAPI.showLauncherBlankContextMenu()
            : undefined
        }
        onSwitchTab={() => {
          switchToNextTab();
          searchInputRef.current?.focus();
        }}
        selectedIndex={selectedIndex}
        onItemExecute={handleExecuteItem}
        onItemSelect={setSelectedIndex}
        onCopyPath={handleCopyPath}
        onCopyParentPath={handleCopyParentPath}
        onOpenParentFolder={handleOpenParentFolder}
        onRunAsAdmin={(item) => void handleRunAsAdmin(item)}
        onCopyShortcutPath={handleCopyShortcutPath}
        onCopyShortcutParentPath={handleCopyShortcutParentPath}
        onOpenShortcutParentFolder={handleOpenShortcutParentFolder}
        onEditItem={handleEditItem}
        onCloseWindow={async (win) => {
          await windowOps.closeWindows([win]);
        }}
        onPinWindows={windowOps.togglePinned}
        onMoveWindows={(wins, desktopNumber) => windowOps.moveToDesktop(wins, desktopNumber)}
        windowSelection={{
          isMarked: windowSelection.isMarked,
          markedCount,
          toggle: windowSelection.toggle,
          selectRangeTo: windowSelection.selectRangeTo,
          onMenuClose: handleMenuCloseMarked,
          onMenuPin: (pin) => void windowOps.togglePinned(windowSelection.markedWindows, pin),
          onMenuMove: (desktopNumber) =>
            void windowOps.moveToDesktop(windowSelection.markedWindows, desktopNumber),
        }}
      />

      {searchMode === 'window' && windowSelection.pendingClose && (
        <div className="window-close-confirm" role="alert" data-testid="window-close-confirm">
          <span>
            {t('launcher.closeConfirm.message', { count: windowSelection.pendingClose.length })}
          </span>
          <span>
            <strong>Enter</strong>:{t('launcher.closeConfirm.close')}
          </span>
          <span>
            <strong>Esc</strong>:{t('launcher.closeConfirm.cancel')}
          </span>
        </div>
      )}

      {!progressState.isActive && !isFetchingIconsSilently && missingIconCount > 0 && (
        <MissingIconNotice missingCount={missingIconCount} onFetchClick={handleFetchMissingIcons} />
      )}

      {progressState.isActive && progressState.progress && (
        <LauncherIconProgressBar progress={progressState.progress} onClose={resetProgress} />
      )}

      {showKeyboardHints && (
        <LauncherHintBar
          searchMode={searchMode}
          canSwitchDataFileTab={showDataFileTabs && dataFileTabs.length > 1}
          markedCount={markedCount}
          canPinWindow={desktopInfo?.supported === true}
          canMoveToDesktop={
            !!desktopInfo?.desktopCount && desktopInfo.desktopCount > 1 && activeDesktopTab > 0
          }
        />
      )}

      {isDraggingOver && (
        <div className="drag-overlay">
          <div className="drag-message">
            {dragOverKind === 'workspaceItem'
              ? t('launcher.dropWorkspaceItemToMove')
              : t('launcher.dropToAdd')}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={itemDelete.dialog !== null}
        onClose={itemDelete.dialog?.onClose ?? (() => {})}
        onConfirm={itemDelete.dialog?.onConfirm ?? (() => {})}
        message={itemDelete.dialog?.message ?? ''}
        confirmText={t('register.delete')}
        danger
      />

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={closeAlert}
        message={alertDialog.message}
        type={alertDialog.type}
      />
    </div>
  );
}

export default App;

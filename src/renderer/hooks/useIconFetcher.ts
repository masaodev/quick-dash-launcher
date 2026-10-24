import { type Dispatch, type SetStateAction, useRef, useState } from 'react';
import { AppItem, LauncherItem, DataFileTab } from '@common/types';
import { isWindowInfo, isLauncherItem } from '@common/types/guards';

import { debugInfo } from '../utils/debug';
import { getActiveTabFiles } from '../utils/tabFiles';

type IconResults = {
  favicons: Record<string, string | null>;
  icons: Record<string, string | null>;
};

type UseIconFetcherOptions = {
  mainItems: AppItem[];
  setMainItems: Dispatch<SetStateAction<AppItem[]>>;
  activeTab: string;
  dataFileTabs: DataFileTab[];
  reloadIconFetchErrors: () => Promise<void>;
  /** 取得中に次の取得を頼まれたとき（進捗バーを × で閉じた後の［取得］・🔄 のメニューなど）。頼まれた取得は始めない */
  onBusy?: () => void;
};

type UseIconFetcherResult = {
  handleRefreshAll: (loadItems: () => Promise<AppItem[]>) => Promise<void>;
  handleFetchMissingIcons: () => Promise<void>;
  /** 進捗バーを出さずに全タブの未取得アイコンを取る（初回設定の後の自動取得。頼まれていない処理なので見せない） */
  handleFetchMissingIconsSilently: () => Promise<void>;
  handleFetchMissingIconsCurrentTab: () => Promise<void>;
  /** アイコンを取得している間 true（進捗バーを閉じても、取得が終わるまで true のまま） */
  isFetchingIcons: boolean;
  /** 今アイコンを取得しているか（描画を待たずに読める。取得の前に別の処理をするときに使う） */
  isIconFetchBusy: () => boolean;
};

function hasNoIcon(item: AppItem): boolean {
  return !('icon' in item && item.icon);
}

type ItemFilter = 'url' | 'icon';

function extractItems(
  items: AppItem[],
  filter: ItemFilter,
  requireNoIcon: boolean
): LauncherItem[] {
  return items.filter((item): item is LauncherItem => {
    if (!isLauncherItem(item)) return false;
    if (requireNoIcon && !hasNoIcon(item)) return false;

    if (filter === 'url') {
      return item.type === 'url';
    }
    return item.type !== 'url' && item.type !== 'folder';
  });
}

function applyIconsToItems(items: AppItem[], results: IconResults): AppItem[] {
  return items.map((item) => {
    if (!isLauncherItem(item)) return item;
    const icon = item.type === 'url' ? results.favicons[item.path] : results.icons[item.path];
    return icon ? { ...item, icon } : item;
  });
}

/**
 * アイコン取得管理フック
 */
export function useIconFetcher(options: UseIconFetcherOptions): UseIconFetcherResult {
  const { mainItems, setMainItems, activeTab, dataFileTabs, reloadIconFetchErrors, onBusy } =
    options;
  // 取得は一度に 1 本だけにする。同時に走ると同じアイコンを二重に取りに行く（A3-173）
  const inFlightRef = useRef(false);
  const [isFetchingIcons, setIsFetchingIcons] = useState(false);

  /** 取得中でなければ fn を流す。取得中なら流さずに onBusy で知らせ、false を返す */
  async function runExclusive(fn: () => Promise<void>, notifyBusy: boolean): Promise<boolean> {
    if (inFlightRef.current) {
      if (notifyBusy) onBusy?.();
      return false;
    }
    inFlightRef.current = true;
    setIsFetchingIcons(true);
    try {
      await fn();
      return true;
    } finally {
      inFlightRef.current = false;
      setIsFetchingIcons(false);
    }
  }

  // 一覧に出ているのと同じ範囲（「複数タブを表示」がオフでも、出ている最初のタブの中身）
  function getCurrentTabItems(): AppItem[] {
    const targetFiles = getActiveTabFiles(dataFileTabs, activeTab);

    return mainItems.filter(
      (item) => !isWindowInfo(item) && targetFiles.includes(item.sourceFile || '')
    );
  }

  async function fetchAndApplyIcons(
    items: AppItem[],
    requireNoIcon: boolean,
    forceRefetch: boolean,
    silent: boolean = false
  ): Promise<IconResults | null> {
    const urlItems = extractItems(items, 'url', requireNoIcon);
    const iconItems = extractItems(items, 'icon', requireNoIcon);

    if (urlItems.length === 0 && iconItems.length === 0) {
      return null;
    }

    return window.electronAPI.fetchIconsCombined(urlItems, iconItems, forceRefetch, silent);
  }

  async function handleRefreshAll(loadItems: () => Promise<AppItem[]>): Promise<void> {
    await runExclusive(async () => {
      debugInfo('すべての更新を開始');

      const loadedItems = await loadItems();
      const results = await fetchAndApplyIcons(loadedItems, false, true);

      if (results) {
        setMainItems(applyIconsToItems(loadedItems, results));
      }

      debugInfo('すべての更新が完了');
    }, true);
  }

  async function fetchMissingIconsFor(
    items: AppItem[],
    label: string,
    silent: boolean = false
  ): Promise<void> {
    // 頼まれていない取得（silent）が重なっても、知らせるものはない
    await runExclusive(async () => {
      debugInfo(`未取得アイコンの取得を開始（${label}）`);

      const results = await fetchAndApplyIcons(items, true, false, silent);

      if (!results) {
        debugInfo(`取得対象のアイテムがありません（${label}）`);
        return;
      }

      setMainItems((prevItems) => applyIconsToItems(prevItems, results));
      await reloadIconFetchErrors();

      debugInfo(`未取得アイコンの取得が完了（${label}）`);
    }, !silent);
  }

  function handleFetchMissingIcons(): Promise<void> {
    return fetchMissingIconsFor(mainItems, 'all tabs');
  }

  function handleFetchMissingIconsSilently(): Promise<void> {
    return fetchMissingIconsFor(mainItems, 'all tabs, silent', true);
  }

  function handleFetchMissingIconsCurrentTab(): Promise<void> {
    return fetchMissingIconsFor(getCurrentTabItems(), 'current tab');
  }

  return {
    handleRefreshAll,
    handleFetchMissingIcons,
    handleFetchMissingIconsSilently,
    handleFetchMissingIconsCurrentTab,
    isFetchingIcons,
    isIconFetchBusy: () => inFlightRef.current,
  };
}

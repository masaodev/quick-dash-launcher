import React, { useState, useEffect, useRef } from 'react';

import {
  LauncherItem,
  GroupItem,
  AppItem,
  WindowPinMode,
  RawDataLine,
  DataFileTab,
} from '../common/types';

import SearchBox from './components/SearchBox';
import ItemList from './components/ItemList';
import ActionButtons from './components/ActionButtons';
import RegisterModal, { RegisterItem } from './components/RegisterModal';
import IconProgressBar from './components/IconProgressBar';
import FileTabBar from './components/FileTabBar';
import ItemCountDisplay from './components/ItemCountDisplay';
import { FirstLaunchSetup } from './components/FirstLaunchSetup';
import { filterItems } from './utils/dataParser';
import { debugLog, debugInfo } from './utils/debug';
import { useIconProgress } from './hooks/useIconProgress';
import { useSearchHistory } from './hooks/useSearchHistory';
import { useRegisterModal } from './hooks/useRegisterModal';
import { useItemActions } from './hooks/useItemActions';

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mainItems, setMainItems] = useState<AppItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [windowPinMode, setWindowPinMode] = useState<WindowPinMode>('normal');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

  // タブ表示関連の状態
  const [showDataFileTabs, setShowDataFileTabs] = useState(false);
  const [dataFiles, setDataFiles] = useState<string[]>([]); // 後方互換性のため保持
  const [activeTab, setActiveTab] = useState<string>('data.txt');
  const [dataFileTabs, setDataFileTabs] = useState<DataFileTab[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { progressState, resetProgress } = useIconProgress();
  const { navigateToPrevious, navigateToNext, resetNavigation, addHistoryEntry } =
    useSearchHistory();
  const {
    isRegisterModalOpen,
    droppedPaths,
    editingItem,
    openRegisterModal,
    openEditModal,
    openWithDroppedPaths,
    closeModal,
  } = useRegisterModal();
  const {
    handleCopyPath,
    handleCopyParentPath,
    handleCopyShortcutPath,
    handleCopyShortcutParentPath,
    handleOpenParentFolder,
    handleOpenShortcutParentFolder,
  } = useItemActions();

  useEffect(() => {
    // 初回起動チェック: 設定ファイルの存在を確認
    const checkFirstLaunch = async () => {
      const isFirst = await window.electronAPI.isFirstLaunch();
      setIsFirstLaunch(isFirst);
    };
    checkFirstLaunch();

    loadItems();

    window.electronAPI.onWindowShown(() => {
      setSearchQuery('');
      setSelectedIndex(0);
      searchInputRef.current?.focus();
    });

    // Load initial pin mode
    const loadPinState = async () => {
      const pinMode = await window.electronAPI.getWindowPinMode();
      setWindowPinMode(pinMode);
    };
    loadPinState();

    // Setup drag and drop event listeners
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      // Check if we have files
      if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) {
        return;
      }

      const paths: string[] = [];
      const files = e.dataTransfer.files;

      // Use webUtils.getPathForFile() through the preload API
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const filePath = window.electronAPI.getPathForFile(file);
          debugLog(`Got path for ${file.name}: ${filePath}`);
          if (filePath) {
            paths.push(filePath);
          }
        } catch (error) {
          console.error(`Error getting path for ${file.name}:`, error);
        }
      }

      debugLog('Final paths:', paths);

      if (paths.length > 0) {
        openWithDroppedPaths(paths);
      } else {
        alert(
          'ファイルパスを取得できませんでした。\nファイルを直接エクスプローラーからドラッグしてください。'
        );
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    // データ変更通知のリスナーを設定
    const cleanupDataChanged = window.electronAPI.onDataChanged(async () => {
      debugLog('データ変更通知を受信、データを再読み込みします');
      loadItems();
    });

    // 設定変更通知のリスナーを設定
    const cleanupSettingsChanged = window.electronAPI.onSettingsChanged(async () => {
      debugLog('設定変更通知を受信、タブ設定を再読み込みします');
      const settings = await window.electronAPI.getSettings();
      setShowDataFileTabs(settings.showDataFileTabs);
      setDataFileTabs(settings.dataFileTabs || []);

      // 設定からデータファイルリストを再生成（設定ファイルベース）
      const tabs = settings.dataFileTabs || [];
      // 全タブの全ファイルを統合してユニークなリストを作成
      const allFiles = tabs.flatMap((tab) => tab.files || []);
      const files = Array.from(new Set(allFiles)).filter(
        (file) => file && typeof file === 'string'
      );

      // data.txtが含まれていない場合は追加
      if (!files.includes('data.txt')) {
        files.unshift('data.txt');
      }

      setDataFiles(files);

      // 物理ファイルが存在しない場合は自動作成
      await ensureDataFilesExist(files);

      // アクティブタブが削除されていた場合のフォールバック
      setActiveTab((prevTab) => {
        if (!files.includes(prevTab)) {
          if (files.includes('data.txt')) {
            return 'data.txt';
          } else if (files.length > 0) {
            return files[0];
          }
        }
        return prevTab;
      });

      // デフォルトタブが変更されていたら反映
      if (settings.defaultFileTab && settings.defaultFileTab !== activeTab) {
        if (files.includes(settings.defaultFileTab)) {
          setActiveTab(settings.defaultFileTab);
        }
      }
    });

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
      cleanupDataChanged();
      cleanupSettingsChanged();
    };
  }, []);

  // タブ表示設定とデータファイルリストをロード
  useEffect(() => {
    const loadTabSettings = async () => {
      try {
        const settings = await window.electronAPI.getSettings();

        setShowDataFileTabs(settings.showDataFileTabs);
        setDataFileTabs(settings.dataFileTabs || []);

        // デフォルトタブを設定
        if (settings.defaultFileTab) {
          setActiveTab(settings.defaultFileTab);
        }

        // 設定からデータファイルリストを生成（設定ファイルベース）
        const tabs = settings.dataFileTabs || [];
        // 全タブの全ファイルを統合してユニークなリストを作成
        const allFiles = tabs.flatMap((tab) => tab.files || []);
        const files = Array.from(new Set(allFiles)).filter(
          (file) => file && typeof file === 'string'
        );

        // data.txtが含まれていない場合は追加
        if (!files.includes('data.txt')) {
          files.unshift('data.txt');
        }

        setDataFiles(files);

        // 物理ファイルが存在しない場合は自動作成
        await ensureDataFilesExist(files);

        // タブ表示がOFFの場合は、data.txtのみ表示
        if (!settings.showDataFileTabs) {
          setActiveTab('data.txt');
        } else {
          // アクティブタブが存在するか確認、存在しない場合はdata.txtにフォールバック
          const defaultTab = settings.defaultFileTab || 'data.txt';
          if (files.includes(defaultTab)) {
            setActiveTab(defaultTab);
          } else if (files.includes('data.txt')) {
            setActiveTab('data.txt');
          } else if (files.length > 0) {
            setActiveTab(files[0]);
          }
        }
      } catch (error) {
        console.error('タブ設定のロードに失敗しました:', error);
      }
    };
    loadTabSettings();
  }, []);

  // 設定に登録されているファイルが物理的に存在するか確認し、存在しない場合は作成
  const ensureDataFilesExist = async (fileNames: string[]) => {
    // undefined や空文字列をフィルタリング
    const validFileNames = fileNames.filter((name) => name && typeof name === 'string');
    for (const fileName of validFileNames) {
      try {
        // ファイルが存在するか確認（実際には作成APIを呼ぶだけで、既存ファイルは上書きされない）
        await window.electronAPI.createDataFile(fileName);
      } catch (error) {
        console.error(`${fileName}の作成/確認に失敗しました:`, error);
      }
    }
  };

  const loadItems = async (): Promise<AppItem[]> => {
    const items = await window.electronAPI.loadDataFiles();

    // Load cached icons (LauncherItemのみ)
    const launcherItems = items.filter((item) => item.type !== 'group') as LauncherItem[];
    const iconCache = await window.electronAPI.loadCachedIcons(launcherItems);

    // Apply cached icons to items
    const itemsWithIcons = items.map((item) => {
      if (item.type === 'group') {
        return item;
      }
      return {
        ...item,
        icon: iconCache[(item as LauncherItem).path] || ('icon' in item ? item.icon : undefined),
      };
    });

    setMainItems(itemsWithIcons);
    return itemsWithIcons;
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedIndex(0);
    // ユーザーが手動で入力を変更した場合は履歴ナビゲーションをリセット
    resetNavigation();
  };

  // アクティブなタブに基づいてアイテムをフィルタリング（コンポーネントレベル）
  const getTabFilteredItemsForKeyHandler = (): AppItem[] => {
    if (!showDataFileTabs) {
      // タブ表示OFF: data.txtのみ表示
      return mainItems.filter((item) => item.sourceFile === 'data.txt');
    }
    // タブ表示ON: アクティブなタブのアイテムのみ表示
    return mainItems.filter((item) => item.sourceFile === activeTab);
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    // タブ切り替え (Tab/Shift+Tab)
    if (e.key === 'Tab' && showDataFileTabs && dataFileTabs.length > 1) {
      e.preventDefault();
      e.stopPropagation();

      // 現在のアクティブタブが属するタブグループのインデックスを探す
      const currentTabIndex = dataFileTabs.findIndex((tab) => tab.files.includes(activeTab));

      if (currentTabIndex === -1) {
        // 見つからない場合は最初のタブへ
        const firstTab = dataFileTabs[0];
        setActiveTab(firstTab.defaultFile || firstTab.files[0]);
        setSelectedIndex(0);
        return;
      }

      let newTabIndex: number;
      if (e.shiftKey) {
        // Shift+Tab: 前のタブへ
        newTabIndex = currentTabIndex > 0 ? currentTabIndex - 1 : dataFileTabs.length - 1;
      } else {
        // Tab: 次のタブへ
        newTabIndex = currentTabIndex < dataFileTabs.length - 1 ? currentTabIndex + 1 : 0;
      }

      const newTab = dataFileTabs[newTabIndex];
      setActiveTab(newTab.defaultFile || newTab.files[0]);
      setSelectedIndex(0); // タブ切り替え時は選択インデックスをリセット
      return;
    }

    // 各キー処理で最新のfilteredItemsを計算
    const tabFilteredItems = getTabFilteredItemsForKeyHandler();
    const filteredItems = filterItems(tabFilteredItems, searchQuery);

    // 検索履歴のナビゲーション（Ctrl + 上下矢印）
    if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      e.stopPropagation();

      const newQuery = e.key === 'ArrowUp' ? navigateToPrevious() : navigateToNext();

      if (newQuery !== null) {
        setSearchQuery(newQuery);
        setSelectedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'Enter':
        e.stopPropagation();
        if (
          e.shiftKey &&
          filteredItems[selectedIndex] &&
          filteredItems[selectedIndex].type !== 'group'
        ) {
          await window.electronAPI.openParentFolder(filteredItems[selectedIndex] as LauncherItem);
        } else if (filteredItems[selectedIndex]) {
          // 統一ハンドラを使用
          await handleExecuteItem(filteredItems[selectedIndex]);
        }
        break;
      case 'ArrowUp':
        if (!e.ctrlKey) {
          // Ctrlキーが押されていない場合のみメニュー選択
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        }
        break;
      case 'ArrowDown':
        if (!e.ctrlKey) {
          // Ctrlキーが押されていない場合のみメニュー選択
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
        }
        break;
      case 'e':
        if (e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          window.electronAPI.toggleEditWindow();
        }
        break;
    }
  };

  /**
   * アイテム実行の統一ハンドラ
   * グループ判定、検索履歴追加、アイテム起動を一元管理
   */
  const handleExecuteItem = async (item: AppItem) => {
    // 検索クエリがある場合は履歴に追加
    if (searchQuery.trim()) {
      await addHistoryEntry(searchQuery.trim());
    }

    // グループかどうかで処理を分岐
    if (item.type === 'group') {
      await window.electronAPI.executeGroup(item as GroupItem, mainItems);
    } else {
      await window.electronAPI.openItem(item as LauncherItem);
    }
  };

  const handleRefreshAll = async () => {
    debugInfo('すべての更新を開始');

    // 1. データファイルの再読み込み
    const loadedItems = await loadItems();

    // 2. 統合プログレスAPIで全アイコン取得（強制）
    const allUrlItems = loadedItems.filter((item) => item.type === 'url') as LauncherItem[];

    const allIconItems = loadedItems.filter(
      (item) => item.type !== 'url' && item.type !== 'group' && item.type !== 'folder'
    ) as LauncherItem[];

    if (allUrlItems.length > 0 || allIconItems.length > 0) {
      const results = await window.electronAPI.fetchIconsCombined(allUrlItems, allIconItems);

      // 取得したアイコンをアイテムに適用
      const updateItemsWithIcons = (items: AppItem[]) => {
        return items.map((item) => {
          if (item.type === 'url' && results.favicons[(item as LauncherItem).path]) {
            return { ...item, icon: results.favicons[(item as LauncherItem).path] || undefined };
          } else if (
            item.type !== 'url' &&
            item.type !== 'group' &&
            results.icons[(item as LauncherItem).path]
          ) {
            return { ...item, icon: results.icons[(item as LauncherItem).path] || undefined };
          }
          return item;
        });
      };

      setMainItems(updateItemsWithIcons(loadedItems));
    }

    debugInfo('すべての更新が完了');
  };

  const handleFetchMissingIcons = async () => {
    debugInfo('未取得アイコンの取得を開始（全タブ）');

    // 統合プログレスAPIを使用
    // URLアイテムの抽出（アイコン未設定のみ）
    const urlItems = mainItems.filter(
      (item) => item.type === 'url' && !('icon' in item && item.icon)
    ) as LauncherItem[];

    // EXE/ファイル/カスタムURIアイテムの抽出（アイコン未設定のみ、フォルダとグループを除外）
    const iconItems = mainItems.filter(
      (item) =>
        item.type !== 'url' &&
        item.type !== 'group' &&
        item.type !== 'folder' &&
        !('icon' in item && item.icon)
    ) as LauncherItem[];

    if (urlItems.length === 0 && iconItems.length === 0) {
      debugInfo('取得対象のアイテムがありません');
      return;
    }

    // 統合APIを呼び出し
    const results = await window.electronAPI.fetchIconsCombined(urlItems, iconItems);

    // 取得したアイコンをアイテムに適用
    const updateItemsWithIcons = (items: AppItem[]) => {
      return items.map((item) => {
        if (item.type === 'url' && results.favicons[(item as LauncherItem).path]) {
          return { ...item, icon: results.favicons[(item as LauncherItem).path] || undefined };
        } else if (
          item.type !== 'url' &&
          item.type !== 'group' &&
          results.icons[(item as LauncherItem).path]
        ) {
          return { ...item, icon: results.icons[(item as LauncherItem).path] || undefined };
        }
        return item;
      });
    };

    setMainItems(updateItemsWithIcons(mainItems));
    debugInfo('未取得アイコンの取得が完了（全タブ）');
  };

  const handleFetchMissingIconsCurrentTab = async () => {
    debugInfo('未取得アイコンの取得を開始（現在のタブ）');

    // 現在のタブのアイテムのみをフィルタリング
    let currentTabItems: AppItem[];
    if (!showDataFileTabs) {
      currentTabItems = mainItems.filter((item) => item.sourceFile === 'data.txt');
    } else {
      // アクティブなタブに紐付く全ファイルのアイテムを取得
      const activeTabConfig = dataFileTabs.find((tab) => tab.files.includes(activeTab));
      if (activeTabConfig) {
        currentTabItems = mainItems.filter((item) =>
          activeTabConfig.files.includes(item.sourceFile || '')
        );
      } else {
        currentTabItems = mainItems.filter((item) => item.sourceFile === activeTab);
      }
    }

    // 統合プログレスAPIを使用
    // URLアイテムの抽出（アイコン未設定のみ）
    const urlItems = currentTabItems.filter(
      (item) => item.type === 'url' && !('icon' in item && item.icon)
    ) as LauncherItem[];

    // EXE/ファイル/カスタムURIアイテムの抽出（アイコン未設定のみ、フォルダとグループを除外）
    const iconItems = currentTabItems.filter(
      (item) =>
        item.type !== 'url' &&
        item.type !== 'group' &&
        item.type !== 'folder' &&
        !('icon' in item && item.icon)
    ) as LauncherItem[];

    if (urlItems.length === 0 && iconItems.length === 0) {
      debugInfo('取得対象のアイテムがありません（現在のタブ）');
      return;
    }

    // 統合APIを呼び出し
    const results = await window.electronAPI.fetchIconsCombined(urlItems, iconItems);

    // 取得したアイコンをアイテムに適用
    const updateItemsWithIcons = (items: AppItem[]) => {
      return items.map((item) => {
        if (item.type === 'url' && results.favicons[(item as LauncherItem).path]) {
          return { ...item, icon: results.favicons[(item as LauncherItem).path] || undefined };
        } else if (
          item.type !== 'url' &&
          item.type !== 'group' &&
          results.icons[(item as LauncherItem).path]
        ) {
          return { ...item, icon: results.icons[(item as LauncherItem).path] || undefined };
        }
        return item;
      });
    };

    setMainItems(updateItemsWithIcons(mainItems));
    debugInfo('未取得アイコンの取得が完了（現在のタブ）');
  };

  const handleTogglePin = async () => {
    const newPinMode = await window.electronAPI.cycleWindowPinMode();
    setWindowPinMode(newPinMode);
  };

  const handleRegisterItems = async (items: RegisterItem[]) => {
    if (editingItem && items.length === 1) {
      // 編集モードの場合
      const item = items[0];

      // タブ（保存先）が変更されたかチェック
      const isTabChanged = item.targetTab !== editingItem.sourceFile;

      if (isTabChanged) {
        // タブが変更された場合：元のタブから削除 + 新しいタブに登録
        await window.electronAPI.deleteItems([
          {
            sourceFile: editingItem.sourceFile,
            lineNumber: editingItem.lineNumber,
          },
        ]);
        await window.electronAPI.registerItems([item]);
      } else {
        // タブが変更されていない場合：従来の更新処理
        // フォルダ取込ディレクティブの編集の場合
        if (editingItem.type === 'directive' && item.itemCategory === 'dir') {
          // ディレクティブ形式でRawDataLineを更新
          let newContent = `dir,${item.path}`;
          if (item.dirOptions) {
            const opts = item.dirOptions;
            const optParts = [];
            optParts.push(`depth=${opts.depth}`);
            optParts.push(`types=${opts.types}`);
            if (opts.filter) optParts.push(`filter=${opts.filter}`);
            if (opts.exclude) optParts.push(`exclude=${opts.exclude}`);
            if (opts.prefix) optParts.push(`prefix=${opts.prefix}`);
            if (opts.suffix) optParts.push(`suffix=${opts.suffix}`);
            newContent += ',' + optParts.join(',');
          }

          // RawDataLineとして更新（editHandlersのupdateRawLineを使用する必要がある）
          await window.electronAPI.updateRawLine({
            sourceFile: editingItem.sourceFile,
            lineNumber: editingItem.lineNumber,
            newContent: newContent,
          });
        } else {
          // 通常のアイテムの編集
          const newItem: LauncherItem = {
            name: item.name,
            path: item.path,
            type: item.type,
            args: item.args,
            customIcon: item.customIcon,
          };

          await window.electronAPI.updateItem({
            sourceFile: editingItem.sourceFile,
            lineNumber: editingItem.lineNumber,
            newItem: newItem,
          });
        }
      }
    } else {
      // 新規登録モード
      await window.electronAPI.registerItems(items);
    }
    loadItems(); // Reload items after registration/update
  };

  const handleOpenBasicSettings = async () => {
    await window.electronAPI.openEditWindowWithTab('settings');
  };

  const handleOpenItemManagement = async () => {
    await window.electronAPI.openEditWindowWithTab('edit');
  };

  const handleOpenRegisterModal = () => {
    openRegisterModal();
  };

  const handleEditItem = async (item: AppItem) => {
    // グループアイテムの場合
    if (item.type === 'group') {
      const groupItem = item as GroupItem;
      const rawDataLine: RawDataLine = {
        lineNumber: groupItem.lineNumber || 1,
        content: `group,${groupItem.name},${groupItem.itemNames.join(',')}`,
        type: 'directive',
        sourceFile: groupItem.sourceFile || 'data.txt',
        customIcon: undefined,
      };
      openEditModal(rawDataLine);
      return;
    }

    // LauncherItemからRawDataLineを構築
    const rawDataLine: RawDataLine = await convertLauncherItemToRawDataLine(item as LauncherItem);
    openEditModal(rawDataLine);
  };

  const convertLauncherItemToRawDataLine = async (item: LauncherItem): Promise<RawDataLine> => {
    // フォルダ取込から展開されたアイテムの場合
    if (item.isDirExpanded && item.expandedFrom && item.lineNumber && item.sourceFile) {
      // 元のディレクティブ行を直接読み込む
      try {
        const rawLines = await window.electronAPI.loadRawDataFiles();
        const originalLine = rawLines.find(
          (line) => line.sourceFile === item.sourceFile && line.lineNumber === item.lineNumber
        );

        if (originalLine) {
          // 元の行が見つかった場合はそれを使用
          return originalLine;
        }
      } catch (err) {
        console.error('元のディレクティブ行の読み込みに失敗しました:', err);
      }

      // フォールバック: expandedOptionsを使用（ただし正確ではない可能性がある）
      let content = `dir,${item.expandedFrom}`;
      if (item.expandedOptions) {
        content += `,${item.expandedOptions}`;
      }

      return {
        lineNumber: item.lineNumber || 1,
        content: content,
        type: 'directive',
        sourceFile: item.sourceFile || 'data.txt',
        customIcon: undefined,
      };
    }

    // 通常のアイテムの場合
    const parts = [item.name, item.path];
    if (item.args) {
      parts.push(item.args);
    }
    if (item.customIcon) {
      // 引数がない場合は空文字を追加
      if (!item.args) {
        parts.push('');
      }
      parts.push(item.customIcon);
    }

    return {
      lineNumber: item.lineNumber || 1,
      content: parts.join(','),
      type: 'item',
      sourceFile: item.sourceFile || 'data.txt',
      customIcon: item.customIcon,
    };
  };

  const handleFirstLaunchComplete = async (hotkey: string) => {
    try {
      // ホットキーを設定（設定ファイルが自動的に作成される）
      await window.electronAPI.setMultipleSettings({
        globalHotkey: hotkey,
        isFirstLaunch: false,
      });
      await window.electronAPI.changeHotkey(hotkey);

      // 初回起動画面を閉じる
      setIsFirstLaunch(false);
    } catch (error) {
      console.error('初回設定の保存に失敗しました:', error);
      alert('設定の保存に失敗しました。');
    }
  };

  // タブクリックハンドラ
  const handleTabClick = (fileName: string) => {
    setActiveTab(fileName);
    setSelectedIndex(0); // タブ切り替え時は選択インデックスをリセット
  };

  // アクティブなタブに基づいてアイテムをフィルタリング
  const getTabFilteredItems = (): AppItem[] => {
    if (!showDataFileTabs) {
      // タブ表示OFF: data.txtのみ表示
      return mainItems.filter((item) => item.sourceFile === 'data.txt');
    }
    // タブ表示ON: アクティブなタブに紐付く全ファイルのアイテムを表示
    // アクティブなタブの設定を検索
    const activeTabConfig = dataFileTabs.find((tab) => tab.files.includes(activeTab));
    if (activeTabConfig) {
      // タブに紐付く全ファイルのアイテムを取得
      return mainItems.filter((item) => activeTabConfig.files.includes(item.sourceFile || ''));
    }
    // フォールバック: アクティブタブと一致するファイルのアイテムのみ
    return mainItems.filter((item) => item.sourceFile === activeTab);
  };

  const tabFilteredItems = getTabFilteredItems();
  const filteredItems = filterItems(tabFilteredItems, searchQuery);

  // 初回起動チェック中はローディング表示
  if (isFirstLaunch === null) {
    return <div className="app">読み込み中...</div>;
  }

  // 初回起動の場合は設定画面を表示
  if (isFirstLaunch) {
    return <FirstLaunchSetup onComplete={handleFirstLaunchComplete} />;
  }

  return (
    <div className={`app ${isDraggingOver ? 'dragging-over' : ''}`} onKeyDown={handleKeyDown}>
      <>
        <div className="header">
          <SearchBox
            ref={searchInputRef}
            value={searchQuery}
            onChange={handleSearch}
            onKeyDown={handleKeyDown}
          />
          <ActionButtons
            onReload={loadItems}
            onFetchMissingIcons={handleFetchMissingIcons}
            onFetchMissingIconsCurrentTab={handleFetchMissingIconsCurrentTab}
            onRefreshAll={handleRefreshAll}
            onTogglePin={handleTogglePin}
            onOpenBasicSettings={handleOpenBasicSettings}
            onOpenItemManagement={handleOpenItemManagement}
            onOpenRegisterModal={handleOpenRegisterModal}
            windowPinMode={windowPinMode}
            isEditMode={false}
          />
        </div>

        {showDataFileTabs && dataFileTabs.length > 1 && (
          <FileTabBar
            dataFileTabs={dataFileTabs}
            activeTab={activeTab}
            onTabClick={handleTabClick}
            allItems={mainItems}
            searchQuery={searchQuery}
          />
        )}

        {!showDataFileTabs && (
          <div className="search-info-bar">
            <ItemCountDisplay count={filteredItems.length} />
          </div>
        )}

        <ItemList
          items={filteredItems}
          allItems={mainItems}
          selectedIndex={selectedIndex}
          onItemExecute={handleExecuteItem}
          onItemSelect={setSelectedIndex}
          onCopyPath={handleCopyPath}
          onCopyParentPath={handleCopyParentPath}
          onOpenParentFolder={handleOpenParentFolder}
          onCopyShortcutPath={handleCopyShortcutPath}
          onCopyShortcutParentPath={handleCopyShortcutParentPath}
          onOpenShortcutParentFolder={handleOpenShortcutParentFolder}
          onEditItem={handleEditItem}
        />

        {progressState.isActive && progressState.progress && (
          <IconProgressBar progress={progressState.progress} onClose={resetProgress} />
        )}

        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={closeModal}
          onRegister={handleRegisterItems}
          droppedPaths={droppedPaths}
          editingItem={editingItem}
          currentTab={activeTab}
        />

        {isDraggingOver && (
          <div className="drag-overlay">
            <div className="drag-message">ファイルをドロップして登録</div>
          </div>
        )}
      </>
    </div>
  );
};

export default App;

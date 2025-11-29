import React, { useState, useEffect, useRef } from 'react';

import { LauncherItem, RawDataLine, DataFileTab } from '../../common/types';
import { debugInfo, logWarn } from '../utils/debug';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (items: RegisterItem[]) => void;
  droppedPaths: string[];
  editingItem?: RawDataLine | null;
  currentTab?: string; // 現在開いているタブ
}

export interface RegisterItem {
  name: string;
  path: string;
  type: LauncherItem['type'];
  args?: string;
  targetTab: string; // データファイル名（例: 'data.txt', 'data2.txt'）
  folderProcessing?: 'folder' | 'expand';
  icon?: string;
  customIcon?: string;
  itemCategory: 'item' | 'dir' | 'group';
  // フォルダ取込アイテムオプション
  dirOptions?: {
    depth: number;
    types: 'file' | 'folder' | 'both';
    filter?: string;
    exclude?: string;
    prefix?: string;
    suffix?: string;
  };
  // グループアイテムオプション
  groupItemNames?: string[];
}

const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onRegister,
  droppedPaths,
  editingItem,
  currentTab,
}) => {
  const [items, setItems] = useState<RegisterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [customIconPreviews, setCustomIconPreviews] = useState<{ [index: number]: string }>({});
  const [groupItemNamesInput, setGroupItemNamesInput] = useState<{ [index: number]: string }>({});
  const [availableTabs, setAvailableTabs] = useState<DataFileTab[]>([]);
  const [errors, setErrors] = useState<{
    [index: number]: { name?: string; path?: string; groupItemNames?: string };
  }>({});
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // モーダルが閉じられたときの処理
      document.body.style.overflow = 'auto';
      window.electronAPI.setModalMode(false);
      // カスタムアイコンプレビューをクリア
      setCustomIconPreviews({});
      setItems([]);
      setErrors({});
      return;
    }

    // 設定からタブ一覧を取得
    const loadAvailableTabs = async () => {
      const settings = await window.electronAPI.getSettings();
      setAvailableTabs(settings.dataFileTabs);
    };
    loadAvailableTabs();

    // モーダルが開いたとき、まず前回の状態をクリア
    setCustomIconPreviews({});
    setItems([]);

    if (editingItem) {
      debugInfo('RegisterModal opened in edit mode:', editingItem);
      initializeFromEditingItem();
    } else if (droppedPaths && droppedPaths.length > 0) {
      debugInfo('RegisterModal opened with paths:', droppedPaths);
      initializeItems();
    } else {
      // ボタンから開かれた場合：空のテンプレートアイテムを1つ作成
      debugInfo('RegisterModal opened manually: creating empty template');
      const defaultTab =
        currentTab || (availableTabs.length > 0 ? availableTabs[0].file : 'data.txt');
      setItems([
        {
          name: '',
          path: '',
          type: 'app',
          targetTab: defaultTab,
          itemCategory: 'item',
        },
      ]);
    }

    // モーダルが開いたときの処理
    document.body.style.overflow = 'hidden';

    // フォーカスをモーダルに設定
    modalRef.current?.focus();

    // キーイベントの制御：capture phaseで全てのキーイベントを捕捉
    const handleKeyDown = (event: KeyboardEvent) => {
      // モーダル内でのキーイベントかどうかを確認
      const modal = modalRef.current;
      if (!modal) return;

      // モーダル内の要素がフォーカスされているかチェック
      const isModalFocused = modal.contains(document.activeElement);

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        handleCancel();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusableElement = focusableElements[0] as HTMLElement;
        const lastFocusableElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey) {
          // Shift+Tab: 逆方向
          if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        } else {
          // Tab: 順方向
          if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        }
        return;
      }

      // モーダル内でのキーイベントの場合、背景への伝播を完全に阻止
      if (isModalFocused) {
        // 現在フォーカスされている要素がinput/textareaの場合のみ、特定のキーを許可
        const activeElement = document.activeElement as HTMLElement;
        const isInputField =
          activeElement &&
          (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');

        if (isInputField) {
          // input/textareaでの通常の編集キー（文字入力、Backspace、Delete、矢印キー、Ctrl+A、Ctrl+C、Ctrl+V、Ctrl+X）は許可
          if (
            event.key.length === 1 ||
            [
              'Backspace',
              'Delete',
              'ArrowLeft',
              'ArrowRight',
              'ArrowUp',
              'ArrowDown',
              'Home',
              'End',
            ].includes(event.key) ||
            (event.ctrlKey && ['a', 'c', 'v', 'x', 'z', 'y'].includes(event.key))
          ) {
            // これらのキーは許可するが、背景への伝播は阻止
            event.stopPropagation();
            event.stopImmediatePropagation();
            return;
          }
        }

        // その他の全てのキーイベントを阻止
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    // capture phaseでキーイベントを捕捉
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, droppedPaths, editingItem]);

  // アイテムの内容が変更されたときにモーダルサイズを調整
  useEffect(() => {
    if (!isOpen || items.length === 0) return;

    // 必要サイズを計算
    const hasFolderItem = items.some((item) => item.itemCategory === 'dir');
    const requiredWidth = hasFolderItem ? 900 : 800;
    const requiredHeight = hasFolderItem ? 1000 : 1000;

    // モーダルモードを有効化し、必要サイズを設定
    window.electronAPI.setModalMode(true, { width: requiredWidth, height: requiredHeight });
  }, [isOpen, items]);

  const initializeFromEditingItem = async () => {
    setLoading(true);

    try {
      if (!editingItem) {
        console.error('No editing item provided');
        return;
      }

      const item = await convertRawDataLineToRegisterItem(editingItem);
      setItems([item]);

      // グループアイテムの場合、入力用のテキストをセット
      if (item.itemCategory === 'group' && item.groupItemNames) {
        setGroupItemNamesInput({ 0: item.groupItemNames.join(', ') });
      }

      // カスタムアイコンのプレビューを読み込み
      if (item.customIcon) {
        await loadCustomIconPreview(0, item.customIcon);
      }
    } catch (error) {
      console.error('Error initializing from editing item:', error);
      alert('編集アイテムの初期化中にエラーが発生しました: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const convertRawDataLineToRegisterItem = async (line: RawDataLine): Promise<RegisterItem> => {
    const defaultTab =
      line.sourceFile || (availableTabs.length > 0 ? availableTabs[0].file : 'data.txt');

    if (line.type === 'item') {
      // アイテム行の場合：名前,パス,引数,カスタムアイコン
      const parts = line.content.split(',');
      const name = parts[0]?.trim() || '';
      const path = parts[1]?.trim() || '';
      const args = parts[2]?.trim() || '';
      const customIcon = parts[3]?.trim() || '';

      const itemType = await detectItemType(path);

      return {
        name,
        path,
        type: itemType,
        args: args || undefined,
        targetTab: defaultTab,
        folderProcessing: itemType === 'folder' ? 'folder' : undefined,
        customIcon: customIcon || line.customIcon,
        itemCategory: 'item',
      };
    } else if (line.type === 'directive') {
      // ディレクティブの種類を判定
      const trimmedContent = line.content.trim();

      if (trimmedContent.startsWith('group,')) {
        // グループアイテム行の場合：group,グループ名,アイテム1,アイテム2,...
        const parts = line.content.split(',');
        const groupName = parts[1]?.trim() || '';
        const itemNames = parts
          .slice(2)
          .map((name) => name.trim())
          .filter((name) => name);

        return {
          name: groupName,
          path: '', // グループはパス不要
          type: 'app', // ダミー値
          targetTab: defaultTab,
          itemCategory: 'group',
          groupItemNames: itemNames,
        };
      } else {
        // フォルダ取込アイテム行の場合：dir,パス,オプション
        const parts = line.content.split(',');
        const path = parts[1]?.trim() || '';
        const optionsStr = parts.slice(2).join(',').trim();

        // オプションを解析
        const dirOptions = {
          depth: 0,
          types: 'both' as const,
          filter: undefined as string | undefined,
          exclude: undefined as string | undefined,
          prefix: undefined as string | undefined,
          suffix: undefined as string | undefined,
        };

        if (optionsStr) {
          const options = optionsStr.split(',');
          for (const option of options) {
            const [key, value] = option.split('=');
            if (key && value) {
              const trimmedKey = key.trim();
              const trimmedValue = value.trim();

              if (trimmedKey === 'depth') {
                dirOptions.depth = parseInt(trimmedValue) || 0;
              } else if (trimmedKey === 'types') {
                const validTypes = ['file', 'folder', 'both'] as const;
                if (validTypes.includes(trimmedValue as 'file' | 'folder' | 'both')) {
                  dirOptions.types = trimmedValue as typeof dirOptions.types;
                }
              } else if (trimmedKey === 'filter') {
                dirOptions.filter = trimmedValue;
              } else if (trimmedKey === 'exclude') {
                dirOptions.exclude = trimmedValue;
              } else if (trimmedKey === 'prefix') {
                dirOptions.prefix = trimmedValue;
              } else if (trimmedKey === 'suffix') {
                dirOptions.suffix = trimmedValue;
              }
            }
          }
        }

        return {
          name: path,
          path,
          type: 'folder',
          targetTab: defaultTab,
          folderProcessing: 'expand',
          dirOptions,
          itemCategory: 'dir',
        };
      }
    } else {
      // その他の場合
      return {
        name: line.content || '',
        path: line.content || '',
        type: 'file',
        targetTab: defaultTab,
        itemCategory: 'item',
      };
    }
  };

  const initializeItems = async () => {
    setLoading(true);
    const newItems: RegisterItem[] = [];
    const defaultTab =
      currentTab || (availableTabs.length > 0 ? availableTabs[0].file : 'data.txt');

    try {
      if (!droppedPaths || droppedPaths.length === 0) {
        console.error('No dropped paths provided');
        return;
      }

      for (const filePath of droppedPaths) {
        if (!filePath) {
          logWarn('Skipping undefined path');
          continue;
        }
        debugInfo('Processing dropped path:', filePath);
        const itemType = await detectItemType(filePath);
        debugInfo('Detected item type:', itemType);
        const name = extractDefaultName(filePath);
        debugInfo('Extracted name:', name);

        let icon: string | undefined;
        try {
          if (itemType === 'app') {
            // .bat/.cmd/.comファイルは拡張子ベースのアイコン取得を使用
            if (
              filePath.endsWith('.bat') ||
              filePath.endsWith('.cmd') ||
              filePath.endsWith('.com')
            ) {
              icon = (await window.electronAPI.extractFileIconByExtension(filePath)) ?? undefined;
            } else {
              icon = (await window.electronAPI.extractIcon(filePath)) ?? undefined;
            }
          } else if (itemType === 'file') {
            icon = (await window.electronAPI.extractIcon(filePath)) ?? undefined;
          } else if (itemType === 'customUri') {
            icon = (await window.electronAPI.extractCustomUriIcon(filePath)) ?? undefined;
            if (!icon) {
              icon = (await window.electronAPI.extractFileIconByExtension(filePath)) ?? undefined;
            }
          }
        } catch (error) {
          console.error('Failed to extract icon:', error);
        }

        newItems.push({
          name,
          path: filePath,
          type: itemType,
          targetTab: defaultTab,
          folderProcessing: itemType === 'folder' ? 'folder' : undefined,
          icon,
          itemCategory: 'item',
          dirOptions:
            itemType === 'folder'
              ? {
                  depth: 0,
                  types: 'both',
                  filter: undefined,
                  exclude: undefined,
                  prefix: undefined,
                  suffix: undefined,
                }
              : undefined,
        });
      }

      setItems(newItems);
    } catch (error) {
      console.error('Error initializing items:', error);
      alert('アイテムの初期化中にエラーが発生しました: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const detectItemType = async (itemPath: string): Promise<LauncherItem['type']> => {
    // URLs
    if (itemPath.includes('://')) {
      const scheme = itemPath.split('://')[0];
      if (!['http', 'https', 'ftp'].includes(scheme)) {
        return 'customUri';
      }
      return 'url';
    }

    // Check if it's a directory
    try {
      const isDirectory = await window.electronAPI.isDirectory(itemPath);
      if (isDirectory) {
        return 'folder';
      }
    } catch (error) {
      console.error('Error checking if directory:', error);
    }

    // File extensions
    const lastDot = itemPath.lastIndexOf('.');
    const ext = lastDot !== -1 ? itemPath.substring(lastDot).toLowerCase() : '';

    // Executables and shortcuts
    if (ext === '.exe' || ext === '.bat' || ext === '.cmd' || ext === '.com' || ext === '.lnk') {
      return 'app';
    }

    // Default to file
    return 'file';
  };

  const extractDefaultName = (filePath: string): string => {
    if (filePath.includes('://')) {
      // For URLs, extract domain name
      try {
        const url = new URL(filePath);
        return url.hostname.replace('www.', '');
      } catch {
        return filePath;
      }
    }

    // For files and folders, extract the last part of the path
    const parts = filePath.split(/[\\/]/);
    const basename = parts[parts.length - 1] || filePath;
    const lastDot = basename.lastIndexOf('.');
    const ext = lastDot !== -1 ? basename.substring(lastDot) : '';
    return ext ? basename.slice(0, -ext.length) : basename;
  };

  // カスタムアイコンを選択
  const handleSelectCustomIcon = async (index: number) => {
    try {
      const selectedFilePath = await window.electronAPI.selectCustomIconFile();
      if (selectedFilePath) {
        const item = items[index];
        const itemIdentifier = item.path;
        const customIconFileName = await window.electronAPI.saveCustomIcon(
          selectedFilePath,
          itemIdentifier
        );

        // アイテムのcustomIconを更新
        const newItems = [...items];
        newItems[index] = { ...newItems[index], customIcon: customIconFileName };
        setItems(newItems);

        // プレビュー用にアイコンを取得
        const iconData = await window.electronAPI.getCustomIcon(customIconFileName);
        if (iconData) {
          setCustomIconPreviews((prev) => ({ ...prev, [index]: iconData }));
        }
      }
    } catch (error) {
      console.error('カスタムアイコン選択エラー:', error);
      alert('カスタムアイコンの選択に失敗しました: ' + error);
    }
  };

  // カスタムアイコンを削除
  const handleDeleteCustomIcon = async (index: number) => {
    try {
      const item = items[index];
      if (item.customIcon) {
        await window.electronAPI.deleteCustomIcon(item.customIcon);

        // アイテムのcustomIconを削除
        const newItems = [...items];
        newItems[index] = { ...newItems[index], customIcon: undefined };
        setItems(newItems);

        // プレビューも削除
        setCustomIconPreviews((prev) => {
          const newPreviews = { ...prev };
          delete newPreviews[index];
          return newPreviews;
        });
      }
    } catch (error) {
      console.error('カスタムアイコン削除エラー:', error);
      alert('カスタムアイコンの削除に失敗しました: ' + error);
    }
  };

  // 編集モードでカスタムアイコンのプレビューを読み込み
  const loadCustomIconPreview = async (index: number, customIconFileName: string) => {
    try {
      const iconData = await window.electronAPI.getCustomIcon(customIconFileName);
      if (iconData) {
        setCustomIconPreviews((prev) => ({ ...prev, [index]: iconData }));
      }
    } catch (error) {
      console.error('カスタムアイコンプレビュー読み込みエラー:', error);
    }
  };

  const handleItemChange = async (
    index: number,
    field: keyof RegisterItem,
    value: string | boolean | RegisterItem['dirOptions']
  ) => {
    const newItems = [...items];
    if (field === 'dirOptions') {
      newItems[index] = { ...newItems[index], dirOptions: value as RegisterItem['dirOptions'] };
    } else if (field === 'groupItemNames') {
      // groupItemNamesの場合は文字列をパース
      const itemNames = (value as string)
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name);
      newItems[index] = { ...newItems[index], groupItemNames: itemNames };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }

    // 入力変更時に該当フィールドのエラーをクリア
    if (field === 'name' || field === 'path') {
      setErrors((prev) => {
        const newErrors = { ...prev };
        if (newErrors[index]) {
          const updatedError = { ...newErrors[index] };
          delete updatedError[field];
          newErrors[index] = updatedError;
        }
        return newErrors;
      });
    }

    // アイテム種別が変更された場合の処理
    if (field === 'itemCategory') {
      if (value === 'dir') {
        // フォルダ取込選択時：フォルダ処理を展開に設定し、フォルダ取込アイテムオプションを初期化
        newItems[index].folderProcessing = 'expand';
        if (!newItems[index].dirOptions) {
          newItems[index].dirOptions = {
            depth: 0,
            types: 'both',
            filter: undefined,
            exclude: undefined,
            prefix: undefined,
            suffix: undefined,
          };
        }
        // グループオプションをクリア
        delete newItems[index].groupItemNames;
        // グループ入力テキストもクリア
        setGroupItemNamesInput((prev) => {
          const newInput = { ...prev };
          delete newInput[index];
          return newInput;
        });
      } else if (value === 'group') {
        // グループ選択時：グループアイテムオプションを初期化
        if (!newItems[index].groupItemNames) {
          newItems[index].groupItemNames = [];
        }
        // グループ入力テキストを初期化
        setGroupItemNamesInput((prev) => ({
          ...prev,
          [index]: newItems[index].groupItemNames?.join(', ') || '',
        }));
        // フォルダ取込オプションをクリア
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
      } else {
        // 単一アイテム選択時：両方クリア
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
        delete newItems[index].groupItemNames;
        // グループ入力テキストもクリア
        setGroupItemNamesInput((prev) => {
          const newInput = { ...prev };
          delete newInput[index];
          return newInput;
        });
      }
    }

    // パスが変更された場合、アイテムタイプを再検出
    if (field === 'path' && (value as string).trim()) {
      const newType = await detectItemType(value as string);
      newItems[index].type = newType;

      // タイプに応じてデフォルト値を設定
      if (newType === 'folder') {
        if (!newItems[index].folderProcessing) {
          newItems[index].folderProcessing = 'folder';
        }
        if (!newItems[index].dirOptions) {
          newItems[index].dirOptions = {
            depth: 0,
            types: 'both',
            filter: undefined,
            exclude: undefined,
            prefix: undefined,
            suffix: undefined,
          };
        }
      } else {
        // フォルダでない場合はフォルダ関連の設定をクリア
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
      }
    }

    setItems(newItems);
  };

  const handleRegister = () => {
    // バリデーション：名前とパスの必須チェック
    const newErrors: typeof errors = {};

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      newErrors[i] = {};

      // グループ以外は名前が必須
      if (item.itemCategory !== 'dir' && !item.name.trim()) {
        newErrors[i].name = '名前を入力してください';
      }

      // グループ以外はパスが必須
      if (item.itemCategory !== 'group' && !item.path.trim()) {
        newErrors[i].path = 'パスを入力してください';
      }

      // グループの場合はアイテム名リストが必須
      if (item.itemCategory === 'group') {
        const itemNames = groupItemNamesInput[i]
          ? groupItemNamesInput[i]
              .split(',')
              .map((name) => name.trim())
              .filter((name) => name)
          : item.groupItemNames || [];
        if (itemNames.length === 0) {
          newErrors[i].groupItemNames = 'グループアイテム名を入力してください';
        }
      }
    }

    // エラーがある場合は登録しない
    setErrors(newErrors);
    const hasErrors = Object.values(newErrors).some((e) =>
      Object.values(e).some((msg) => msg !== undefined)
    );

    if (hasErrors) {
      return;
    }

    // 保存前に、入力中のグループアイテム名を配列に変換
    const finalItems = items.map((item, index) => {
      if (item.itemCategory === 'group' && groupItemNamesInput[index] !== undefined) {
        const itemNames = groupItemNamesInput[index]
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name);
        return { ...item, groupItemNames: itemNames };
      }
      return item;
    });

    onRegister(finalItems);
    onClose();
  };

  const handleCancel = () => {
    setItems([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div
        className="modal-content register-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <h2>{editingItem ? 'アイテムの編集' : 'アイテムの登録'}</h2>

        {loading ? (
          <div className="loading">アイテム情報を読み込み中...</div>
        ) : (
          <>
            <div className="register-items">
              {items.map((item, index) => (
                <div key={index} className="register-item">
                  <div className="item-header">
                    {item.icon && <img src={item.icon} alt="" className="item-icon" />}
                  </div>

                  <div className="form-group">
                    <label>種別:</label>
                    <select
                      value={item.itemCategory}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          'itemCategory',
                          e.target.value as 'item' | 'dir' | 'group'
                        )
                      }
                    >
                      <option value="item">単一アイテム</option>
                      <option value="dir">フォルダ取込</option>
                      <option value="group">グループ</option>
                    </select>
                  </div>

                  {item.itemCategory !== 'dir' && (
                    <div className="form-group">
                      <label>名前:</label>
                      <input
                        type="text"
                        value={item.name}
                        className={errors[index]?.name ? 'error' : ''}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        placeholder={
                          item.itemCategory === 'group' ? 'グループ名を入力' : '表示名を入力'
                        }
                      />
                      {errors[index]?.name && (
                        <span className="error-message">{errors[index].name}</span>
                      )}
                    </div>
                  )}

                  {item.itemCategory !== 'group' && (
                    <div className="form-group">
                      <label>パス:</label>
                      <input
                        type="text"
                        value={item.path}
                        readOnly={!!droppedPaths && droppedPaths.length > 0}
                        className={
                          errors[index]?.path
                            ? 'error'
                            : droppedPaths && droppedPaths.length > 0
                              ? 'readonly'
                              : ''
                        }
                        onChange={(e) => handleItemChange(index, 'path', e.target.value)}
                        placeholder="ファイルパス、URL、またはカスタムURIを入力"
                      />
                      {errors[index]?.path && (
                        <span className="error-message">{errors[index].path}</span>
                      )}
                    </div>
                  )}

                  {item.itemCategory === 'item' && (
                    <div className="form-group">
                      <label>引数 (オプション):</label>
                      <input
                        type="text"
                        value={item.args || ''}
                        onChange={(e) => handleItemChange(index, 'args', e.target.value)}
                        placeholder="コマンドライン引数（実行ファイルやアプリの場合のみ有効）"
                      />
                    </div>
                  )}

                  {item.itemCategory === 'dir' && (
                    <>
                      {item.dirOptions && (
                        <div className="dir-options">
                          <div className="form-group">
                            <label>階層深度:</label>
                            <select
                              value={item.dirOptions.depth}
                              onChange={(e) => {
                                const newDirOptions = {
                                  ...item.dirOptions!,
                                  depth: parseInt(e.target.value),
                                };
                                handleItemChange(index, 'dirOptions', newDirOptions);
                              }}
                            >
                              <option value="0">現在のフォルダのみ</option>
                              <option value="1">1階層下まで</option>
                              <option value="2">2階層下まで</option>
                              <option value="3">3階層下まで</option>
                              <option value="-1">無制限</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>取得タイプ:</label>
                            <select
                              value={item.dirOptions.types}
                              onChange={(e) => {
                                const newDirOptions = {
                                  ...item.dirOptions!,
                                  types: e.target.value as 'file' | 'folder' | 'both',
                                };
                                handleItemChange(index, 'dirOptions', newDirOptions);
                              }}
                            >
                              <option value="file">ファイルのみ</option>
                              <option value="folder">フォルダーのみ</option>
                              <option value="both">ファイルとフォルダー</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>フィルター (例: *.txt):</label>
                            <input
                              type="text"
                              value={item.dirOptions.filter || ''}
                              onChange={(e) => {
                                const newDirOptions = {
                                  ...item.dirOptions!,
                                  filter: e.target.value || undefined,
                                };
                                handleItemChange(index, 'dirOptions', newDirOptions);
                              }}
                              placeholder="ワイルドカードパターン"
                            />
                          </div>

                          <div className="form-group">
                            <label>除外パターン (例: temp*):</label>
                            <input
                              type="text"
                              value={item.dirOptions.exclude || ''}
                              onChange={(e) => {
                                const newDirOptions = {
                                  ...item.dirOptions!,
                                  exclude: e.target.value || undefined,
                                };
                                handleItemChange(index, 'dirOptions', newDirOptions);
                              }}
                              placeholder="除外するパターン"
                            />
                          </div>

                          <div className="form-group">
                            <label>プレフィックス (例: 仕事):</label>
                            <input
                              type="text"
                              value={item.dirOptions.prefix || ''}
                              onChange={(e) => {
                                const newDirOptions = {
                                  ...item.dirOptions!,
                                  prefix: e.target.value || undefined,
                                };
                                handleItemChange(index, 'dirOptions', newDirOptions);
                              }}
                              placeholder="アイテム名の前に付ける文字"
                            />
                          </div>

                          <div className="form-group">
                            <label>サフィックス (例: Dev):</label>
                            <input
                              type="text"
                              value={item.dirOptions.suffix || ''}
                              onChange={(e) => {
                                const newDirOptions = {
                                  ...item.dirOptions!,
                                  suffix: e.target.value || undefined,
                                };
                                handleItemChange(index, 'dirOptions', newDirOptions);
                              }}
                              placeholder="アイテム名の後に付ける文字"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {item.itemCategory === 'group' && (
                    <div className="form-group">
                      <label>アイテム名リスト (カンマ区切り):</label>
                      <textarea
                        value={
                          groupItemNamesInput[index] ?? (item.groupItemNames?.join(', ') || '')
                        }
                        className={errors[index]?.groupItemNames ? 'error' : ''}
                        onChange={(e) => {
                          // 入力値をそのまま一時stateに保存
                          setGroupItemNamesInput((prev) => ({
                            ...prev,
                            [index]: e.target.value,
                          }));
                          // エラーをクリア
                          setErrors((prev) => {
                            const newErrors = { ...prev };
                            if (newErrors[index]) {
                              const updatedError = { ...newErrors[index] };
                              delete updatedError.groupItemNames;
                              newErrors[index] = updatedError;
                            }
                            return newErrors;
                          });
                        }}
                        onBlur={(e) => {
                          // フォーカスを失ったタイミングで配列に変換してitemに反映
                          const itemNames = e.target.value
                            .split(',')
                            .map((name) => name.trim())
                            .filter((name) => name);
                          const newItems = [...items];
                          newItems[index] = { ...newItems[index], groupItemNames: itemNames };
                          setItems(newItems);
                        }}
                        placeholder="例: Visual Studio Code, Slack, Chrome"
                        rows={3}
                      />
                      {errors[index]?.groupItemNames && (
                        <span className="error-message">{errors[index].groupItemNames}</span>
                      )}
                      <small>
                        既存のアイテム名をカンマ区切りで入力してください。グループ実行時に順番に起動されます。
                      </small>
                    </div>
                  )}

                  <div className="form-group">
                    <label>保存先:</label>
                    <select
                      value={item.targetTab}
                      onChange={(e) => handleItemChange(index, 'targetTab', e.target.value)}
                    >
                      {availableTabs.map((tab) => (
                        <option key={tab.file} value={tab.file}>
                          {tab.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* カスタムアイコン設定 */}
                  {item.itemCategory !== 'dir' && (
                    <div className="form-group">
                      <label>カスタムアイコン:</label>
                      <div className="custom-icon-section">
                        {customIconPreviews[index] ? (
                          <div className="custom-icon-preview">
                            <img
                              src={customIconPreviews[index]}
                              alt="カスタムアイコン"
                              className="custom-icon-img"
                            />
                            <button
                              type="button"
                              className="delete-icon-btn"
                              onClick={() => handleDeleteCustomIcon(index)}
                            >
                              削除
                            </button>
                          </div>
                        ) : (
                          <div className="no-custom-icon">
                            <span>カスタムアイコン未設定</span>
                          </div>
                        )}
                        <button
                          type="button"
                          className="select-icon-btn"
                          onClick={() => handleSelectCustomIcon(index)}
                        >
                          ファイルから選択
                        </button>
                      </div>
                    </div>
                  )}

                  {items.length > 1 && <hr />}
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button onClick={handleCancel}>キャンセル</button>
              <button onClick={handleRegister} className="primary">
                {editingItem ? '更新' : '登録'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RegisterModal;

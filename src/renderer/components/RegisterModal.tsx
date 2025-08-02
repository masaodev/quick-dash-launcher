import React, { useState, useEffect, useRef } from 'react';

import { LauncherItem, RawDataLine } from '../../common/types';
import { debugInfo } from '../utils/debug';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (items: RegisterItem[]) => void;
  droppedPaths: string[];
  editingItem?: RawDataLine | null;
}

export interface RegisterItem {
  name: string;
  path: string;
  type: LauncherItem['type'];
  args?: string;
  targetTab: 'main' | 'temp';
  folderProcessing?: 'folder' | 'expand';
  icon?: string;
  itemCategory: 'item' | 'dir';
  // フォルダ取込アイテムオプション
  dirOptions?: {
    depth: number;
    types: 'file' | 'folder' | 'both';
    filter?: string;
    exclude?: string;
    prefix?: string;
    suffix?: string;
  };
}

const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onRegister,
  droppedPaths,
  editingItem,
}) => {
  const [items, setItems] = useState<RegisterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // モーダルが閉じられたときの処理
      document.body.style.overflow = 'auto';
      return;
    }

    // モーダルが開いたとき
    if (editingItem) {
      debugInfo('RegisterModal opened in edit mode:', editingItem);
      initializeFromEditingItem();
    } else if (droppedPaths && droppedPaths.length > 0) {
      debugInfo('RegisterModal opened with paths:', droppedPaths);
      initializeItems();
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

  const initializeFromEditingItem = async () => {
    setLoading(true);

    try {
      if (!editingItem) {
        console.error('No editing item provided');
        return;
      }

      const item = await convertRawDataLineToRegisterItem(editingItem);
      setItems([item]);
    } catch (error) {
      console.error('Error initializing from editing item:', error);
      alert('編集アイテムの初期化中にエラーが発生しました: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const convertRawDataLineToRegisterItem = async (line: RawDataLine): Promise<RegisterItem> => {
    if (line.type === 'item') {
      // アイテム行の場合：名前,パス,引数,元パス
      const parts = line.content.split(',');
      const name = parts[0]?.trim() || '';
      const path = parts[1]?.trim() || '';
      const args = parts[2]?.trim() || '';

      const itemType = await detectItemType(path);

      return {
        name,
        path,
        type: itemType,
        args: args || undefined,
        targetTab: 'main',
        folderProcessing: itemType === 'folder' ? 'folder' : undefined,
        itemCategory: 'item',
      };
    } else if (line.type === 'directive') {
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
        targetTab: 'main',
        folderProcessing: 'expand',
        dirOptions,
        itemCategory: 'dir',
      };
    } else {
      // その他の場合
      return {
        name: line.content || '',
        path: line.content || '',
        type: 'file',
        targetTab: 'main',
        itemCategory: 'item',
      };
    }
  };

  const initializeItems = async () => {
    setLoading(true);
    const newItems: RegisterItem[] = [];

    try {
      if (!droppedPaths || droppedPaths.length === 0) {
        console.error('No dropped paths provided');
        return;
      }

      for (const filePath of droppedPaths) {
        if (!filePath) {
          console.warn('Skipping undefined path');
          continue;
        }
        debugInfo('Processing dropped path:', filePath);
        const itemType = await detectItemType(filePath);
        debugInfo('Detected item type:', itemType);
        const name = extractDefaultName(filePath);
        debugInfo('Extracted name:', name);

        let icon: string | undefined;
        try {
          if (itemType === 'app' || itemType === 'file') {
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
          targetTab: 'main',
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

  const handleItemChange = async (
    index: number,
    field: keyof RegisterItem,
    value: string | boolean | RegisterItem['dirOptions']
  ) => {
    const newItems = [...items];
    if (field === 'dirOptions') {
      newItems[index] = { ...newItems[index], dirOptions: value as RegisterItem['dirOptions'] };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
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
      } else {
        // アイテム選択時：フォルダ処理とフォルダ取込アイテムオプションをクリア
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
      }
    }

    // パスが変更された場合、アイテムタイプを再検出
    if (field === 'path' && editingItem) {
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

      // appタイプでない場合は引数をクリア
      if (newType !== 'app') {
        delete newItems[index].args;
      }
    }

    setItems(newItems);
  };

  const handleRegister = () => {
    onRegister(items);
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
                        handleItemChange(index, 'itemCategory', e.target.value as 'item' | 'dir')
                      }
                    >
                      <option value="item">単一アイテム</option>
                      <option value="dir">フォルダ取込</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>名前:</label>
                    <input
                      type="text"
                      value={item.itemCategory === 'dir' ? '-' : item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      placeholder="表示名を入力"
                      readOnly={item.itemCategory === 'dir'}
                      className={item.itemCategory === 'dir' ? 'readonly' : ''}
                    />
                  </div>

                  <div className="form-group">
                    <label>パス:</label>
                    <input
                      type="text"
                      value={item.path}
                      readOnly={!editingItem}
                      className={editingItem ? '' : 'readonly'}
                      onChange={(e) =>
                        editingItem ? handleItemChange(index, 'path', e.target.value) : undefined
                      }
                    />
                  </div>

                  {item.type === 'app' && (
                    <div className="form-group">
                      <label>引数 (オプション):</label>
                      <input
                        type="text"
                        value={item.args || ''}
                        onChange={(e) => handleItemChange(index, 'args', e.target.value)}
                        placeholder="コマンドライン引数"
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

                  <div className="form-group">
                    <label>保存先:</label>
                    <select
                      value={item.targetTab}
                      onChange={(e) =>
                        handleItemChange(index, 'targetTab', e.target.value as 'main' | 'temp')
                      }
                    >
                      <option value="main">メインタブ</option>
                      <option value="temp">一時タブ</option>
                    </select>
                  </div>

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

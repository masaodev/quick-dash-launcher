import React, { useState, useEffect, useRef } from 'react';
import { type RegisterItem } from '@common/utils/dataConverters';
import { detectItemType } from '@common/utils/itemTypeDetector';

import { RawDataLine, DataFileTab } from '../../common/types';
import { debugInfo } from '../utils/debug';
import { useCustomIcon } from '../hooks/useCustomIcon';
import { useModalInitializer } from '../hooks/useModalInitializer';

import GroupItemSelectorModal from './GroupItemSelectorModal';
import FilePickerDialog from './FilePickerDialog';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (items: RegisterItem[]) => void;
  droppedPaths: string[];
  editingItem?: RawDataLine | null;
  currentTab?: string; // 現在開いているタブ
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
  const [_groupItemNamesInput, setGroupItemNamesInput] = useState<{ [index: number]: string }>({});
  const [availableTabs, setAvailableTabs] = useState<DataFileTab[]>([]);
  const [errors, setErrors] = useState<{
    [index: number]: { name?: string; path?: string; groupItemNames?: string };
  }>({});
  const [selectorModalOpen, setSelectorModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // カスタムアイコン管理フック
  const {
    customIconPreviews,
    filePickerState,
    openCustomIconPicker,
    closeCustomIconPicker,
    handleCustomIconFileSelected,
    deleteCustomIcon,
    loadCustomIconPreview,
    clearCustomIconPreviews,
  } = useCustomIcon();

  // モーダル初期化フック
  const {
    initializeFromEditingItem,
    initializeFromDroppedPaths,
    createEmptyTemplateItem,
  } = useModalInitializer();

  useEffect(() => {
    if (!isOpen) {
      // モーダルが閉じられたときの処理
      document.body.style.overflow = 'auto';
      window.electronAPI.setModalMode(false);
      // カスタムアイコンプレビューをクリア
      clearCustomIconPreviews();
      setItems([]);
      setErrors({});
      return;
    }

    // 設定からタブ一覧を取得してから、アイテムを初期化
    const loadAvailableTabsAndInitialize = async () => {
      const settings = await window.electronAPI.getSettings();
      setAvailableTabs(settings.dataFileTabs);

      // モーダルが開いたとき、まず前回の状態をクリア
      clearCustomIconPreviews();
      setItems([]);

      if (editingItem) {
        debugInfo('RegisterModal opened in edit mode:', editingItem);
        setLoading(true);
        const items = await initializeFromEditingItem(editingItem, settings.dataFileTabs, loadCustomIconPreview);
        setItems(items);
        setLoading(false);
      } else if (droppedPaths && droppedPaths.length > 0) {
        debugInfo('RegisterModal opened with paths:', droppedPaths);
        setLoading(true);
        const items = await initializeFromDroppedPaths(droppedPaths, currentTab, settings.dataFileTabs);
        setItems(items);
        setLoading(false);
      } else {
        // ボタンから開かれた場合：空のテンプレートアイテムを1つ作成
        debugInfo('RegisterModal opened manually: creating empty template');
        const items = createEmptyTemplateItem(currentTab, settings.dataFileTabs);
        setItems(items);
      }
    };
    loadAvailableTabsAndInitialize();

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
        // GroupItemSelectorModalが表示されている場合は、そちらに任せる
        const groupSelectorModal = document.querySelector('.group-item-selector-modal');
        if (groupSelectorModal) {
          return;
        }
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


  // カスタムアイコン選択時のコールバック
  const onCustomIconSelected = async (filePath: string) => {
    const item = items[filePickerState.itemIndex!];
    await handleCustomIconFileSelected(filePath, item.path, (index, customIconFileName) => {
      const newItems = [...items];
      newItems[index] = { ...newItems[index], customIcon: customIconFileName };
      setItems(newItems);
    });
  };

  // カスタムアイコン削除時のコールバック
  const onCustomIconDeleted = async (index: number) => {
    const item = items[index];
    if (item.customIcon) {
      await deleteCustomIcon(index, item.customIcon, (idx) => {
        const newItems = [...items];
        newItems[idx] = { ...newItems[idx], customIcon: undefined };
        setItems(newItems);
      });
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
        // フォルダ取込オプションをクリア
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
      } else {
        // 単一アイテム選択時：両方クリア
        delete newItems[index].folderProcessing;
        delete newItems[index].dirOptions;
        delete newItems[index].groupItemNames;
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
        newErrors[i].name =
          item.itemCategory === 'group' ? 'グループ名を入力してください' : '名前を入力してください';
      }

      // グループ以外はパスが必須
      if (item.itemCategory !== 'group' && !item.path.trim()) {
        newErrors[i].path = 'パスを入力してください';
      }

      // グループの場合はアイテム名リストが必須
      if (item.itemCategory === 'group') {
        const itemNames = item.groupItemNames || [];
        if (itemNames.length === 0) {
          newErrors[i].groupItemNames = 'グループアイテムを追加してください';
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

    onRegister(items);
    onClose();
  };

  const handleCancel = () => {
    setItems([]);
    onClose();
  };

  const handleAddGroupItem = (index: number) => {
    setEditingItemIndex(index);
    setSelectorModalOpen(true);
  };

  const handleSelectGroupItem = (itemName: string) => {
    if (editingItemIndex === null) return;

    const newItems = [...items];
    const currentGroupItemNames = newItems[editingItemIndex].groupItemNames || [];
    newItems[editingItemIndex] = {
      ...newItems[editingItemIndex],
      groupItemNames: [...currentGroupItemNames, itemName],
    };
    setItems(newItems);

    // エラーをクリア
    setErrors((prev) => {
      const newErrors = { ...prev };
      if (newErrors[editingItemIndex]) {
        const updatedError = { ...newErrors[editingItemIndex] };
        delete updatedError.groupItemNames;
        newErrors[editingItemIndex] = updatedError;
      }
      return newErrors;
    });
  };

  const handleRemoveGroupItem = (itemIndex: number, groupItemNameIndex: number) => {
    const newItems = [...items];
    const currentGroupItemNames = newItems[itemIndex].groupItemNames || [];
    const updatedGroupItemNames = currentGroupItemNames.filter((_, i) => i !== groupItemNameIndex);
    newItems[itemIndex] = {
      ...newItems[itemIndex],
      groupItemNames: updatedGroupItemNames,
    };
    setItems(newItems);
  };

  if (!isOpen) return null;

  return (
    <>
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
                        <option value="item">📄 単一アイテム</option>
                        <option value="dir">🗂️ フォルダ取込</option>
                        <option value="group">📦 グループ</option>
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
                        <label>グループアイテムリスト:</label>
                        <div className="group-item-list">
                          {item.groupItemNames && item.groupItemNames.length > 0 ? (
                            <div className="selected-items">
                              {item.groupItemNames.map((itemName, nameIndex) => (
                                <div key={nameIndex} className="item-chip">
                                  <span>{itemName}</span>
                                  <button
                                    type="button"
                                    className="remove-group-item-btn"
                                    onClick={() => handleRemoveGroupItem(index, nameIndex)}
                                    title="削除"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="no-group-items">アイテムが追加されていません</div>
                          )}
                          <button
                            type="button"
                            className="add-group-item-btn"
                            onClick={() => handleAddGroupItem(index)}
                          >
                            + アイテムを追加
                          </button>
                        </div>
                        {errors[index]?.groupItemNames && (
                          <span className="error-message">{errors[index].groupItemNames}</span>
                        )}
                        <small>
                          同じファイル内の既存アイテムから選択してください。グループ実行時に順番に起動されます。
                        </small>
                      </div>
                    )}

                    <div className="form-group">
                      <label>保存先タブ:</label>
                      <select
                        value={item.targetTab}
                        onChange={(e) => {
                          const selectedTab = availableTabs.find((tab) =>
                            tab.files.includes(e.target.value)
                          );

                          // targetTabとtargetFileを同時に更新
                          const newItems = [...items];
                          newItems[index] = { ...newItems[index], targetTab: e.target.value };

                          // タブに複数ファイルがある場合、最初のファイルを設定
                          if (selectedTab && selectedTab.files.length > 0) {
                            newItems[index] = {
                              ...newItems[index],
                              targetFile: selectedTab.files[0],
                            };
                          }

                          setItems(newItems);
                        }}
                      >
                        {availableTabs.map((tab) => (
                          <option key={tab.files[0]} value={tab.files[0]}>
                            {tab.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* タブに複数ファイルがある場合、保存先ファイルを選択 */}
                    {(() => {
                      const selectedTab = availableTabs.find((tab) =>
                        tab.files.includes(item.targetTab)
                      );
                      return (
                        selectedTab &&
                        selectedTab.files.length > 1 && (
                          <div className="form-group">
                            <label>保存先ファイル:</label>
                            <select
                              value={item.targetFile || selectedTab.files[0]}
                              onChange={(e) =>
                                handleItemChange(index, 'targetFile', e.target.value)
                              }
                            >
                              {selectedTab.files.map((file) => (
                                <option key={file} value={file}>
                                  {file}
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      );
                    })()}

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
                                onClick={() => onCustomIconDeleted(index)}
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
                            onClick={() => openCustomIconPicker(index)}
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

      {/* グループアイテム選択モーダル */}
      {editingItemIndex !== null && (
        <GroupItemSelectorModal
          isOpen={selectorModalOpen}
          onClose={() => {
            setSelectorModalOpen(false);
            setEditingItemIndex(null);
          }}
          onSelect={handleSelectGroupItem}
          targetFile={items[editingItemIndex]?.targetFile || items[editingItemIndex]?.targetTab}
          excludeNames={items[editingItemIndex]?.groupItemNames || []}
        />
      )}

      {/* カスタムアイコンファイル選択ダイアログ */}
      <FilePickerDialog
        isOpen={filePickerState.isOpen}
        onClose={closeCustomIconPicker}
        onFileSelect={onCustomIconSelected}
        title="カスタムアイコンを選択"
        fileTypes="image"
        description="アイコンとして使用する画像ファイルを選択してください。"
      />
    </>
  );
};

export default RegisterModal;

import React, { useEffect, useRef, useState } from 'react';
import { type RegisterItem } from '@common/utils/dataConverters';

import { RawDataLine, WindowInfo } from '../../common/types';
import { useCustomIcon } from '../hooks/useCustomIcon';
import { useRegisterForm } from '../hooks/useRegisterForm';

import GroupItemSelectorModal from './GroupItemSelectorModal';
import FilePickerDialog from './FilePickerDialog';
import DirOptionsEditor from './DirOptionsEditor';
import WindowSelectorModal from './WindowSelectorModal';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (items: RegisterItem[]) => void;
  droppedPaths: string[];
  editingItem?: RawDataLine | null;
  currentTab?: string; // 現在開いているタブ
  onDelete?: (item: RawDataLine) => void; // 削除ハンドラー
}

const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onRegister,
  droppedPaths,
  editingItem,
  currentTab,
  onDelete,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // ウィンドウ選択ダイアログの状態管理
  const [windowSelectorOpen, setWindowSelectorOpen] = useState(false);
  const [windowSelectorItemIndex, setWindowSelectorItemIndex] = useState<number | null>(null);

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

  // フォーム状態管理フック
  const {
    items,
    loading,
    errors,
    availableTabs,
    selectorModalOpen,
    editingItemIndex,
    handleItemChange,
    validateAndRegister,
    handleCancel,
    handleAddGroupItem,
    handleSelectGroupItem,
    handleRemoveGroupItem,
    updateItem,
    handleTargetTabChange,
    setEditingItemIndex,
    setSelectorModalOpen,
  } = useRegisterForm(
    isOpen,
    editingItem,
    droppedPaths,
    currentTab,
    loadCustomIconPreview,
    onClose,
    onRegister
  );

  useEffect(() => {
    if (!isOpen) {
      // モーダルが閉じられたときの処理
      document.body.style.overflow = 'auto';
      window.electronAPI.setModalMode(false);
      // カスタムアイコンプレビューをクリア
      clearCustomIconPreviews();
      return;
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
      updateItem(index, { customIcon: customIconFileName });
    });
  };

  // カスタムアイコン削除時のコールバック
  const onCustomIconDeleted = async (index: number) => {
    const item = items[index];
    if (item.customIcon) {
      await deleteCustomIcon(index, item.customIcon, (idx) => {
        updateItem(idx, { customIcon: undefined });
      });
    }
  };

  // ウィンドウ選択ダイアログを開く
  const openWindowSelector = (index: number) => {
    setWindowSelectorItemIndex(index);
    setWindowSelectorOpen(true);
  };

  // ウィンドウ選択時のコールバック
  const onWindowSelected = (window: WindowInfo) => {
    if (windowSelectorItemIndex === null) return;

    const item = items[windowSelectorItemIndex];
    if (!item) return;

    // ウィンドウ情報から WindowConfig を作成
    const windowConfig = {
      title: window.title,
      x: window.x,
      y: window.y,
      width: window.width,
      height: window.height,
    };

    // アイテムに windowConfig を設定
    handleItemChange(windowSelectorItemIndex, 'windowConfig', windowConfig);
  };

  // アイテム削除ハンドラー
  const handleDelete = () => {
    if (editingItem && onDelete) {
      onDelete(editingItem);
    }
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
                      <>
                        <div className="form-group">
                          <label>引数 (オプション):</label>
                          <input
                            type="text"
                            value={item.args || ''}
                            onChange={(e) => handleItemChange(index, 'args', e.target.value)}
                            placeholder="コマンドライン引数（実行ファイルやアプリの場合のみ有効）"
                          />
                        </div>

                        <div className="form-group">
                          <label>ウィンドウタイトル (オプション):</label>
                          <input
                            type="text"
                            value={item.windowTitle || ''}
                            onChange={(e) => handleItemChange(index, 'windowTitle', e.target.value)}
                            placeholder="例: Google Chrome, Visual Studio Code"
                          />
                          <small className="field-hint">
                            設定すると、起動前にこのタイトルのウィンドウを検索します。
                            見つかればアクティブ化、見つからなければ通常起動します。
                          </small>
                        </div>
                      </>
                    )}

                    {item.itemCategory === 'dir' && (
                      <DirOptionsEditor
                        dirOptions={item.dirOptions}
                        onChange={(newDirOptions) =>
                          handleItemChange(index, 'dirOptions', newDirOptions)
                        }
                      />
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
                        onChange={(e) => handleTargetTabChange(index, e.target.value)}
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

                    {/* ウィンドウ設定セクション */}
                    <div className="register-field">
                      <label>ウィンドウ設定（オプション）:</label>
                      <div className="window-config-section">
                        <div className="window-config-row">
                          <label className="window-config-label">ウィンドウタイトル:</label>
                          <input
                            type="text"
                            value={item.windowConfig?.title || ''}
                            onChange={(e) =>
                              handleItemChange(index, 'windowConfig', {
                                ...item.windowConfig,
                                title: e.target.value,
                              })
                            }
                            placeholder="ウィンドウタイトル（部分一致）"
                            className="window-config-input"
                          />
                        </div>
                        <div className="window-config-row">
                          <label className="window-config-label">X座標:</label>
                          <input
                            type="number"
                            value={item.windowConfig?.x ?? ''}
                            onChange={(e) =>
                              handleItemChange(index, 'windowConfig', {
                                ...item.windowConfig,
                                title: item.windowConfig?.title || '',
                                x: e.target.value ? parseInt(e.target.value, 10) : undefined,
                              })
                            }
                            placeholder="X座標（省略時は変更なし）"
                            className="window-config-input-number"
                          />
                        </div>
                        <div className="window-config-row">
                          <label className="window-config-label">Y座標:</label>
                          <input
                            type="number"
                            value={item.windowConfig?.y ?? ''}
                            onChange={(e) =>
                              handleItemChange(index, 'windowConfig', {
                                ...item.windowConfig,
                                title: item.windowConfig?.title || '',
                                y: e.target.value ? parseInt(e.target.value, 10) : undefined,
                              })
                            }
                            placeholder="Y座標（省略時は変更なし）"
                            className="window-config-input-number"
                          />
                        </div>
                        <div className="window-config-row">
                          <label className="window-config-label">幅:</label>
                          <input
                            type="number"
                            value={item.windowConfig?.width ?? ''}
                            onChange={(e) =>
                              handleItemChange(index, 'windowConfig', {
                                ...item.windowConfig,
                                title: item.windowConfig?.title || '',
                                width: e.target.value ? parseInt(e.target.value, 10) : undefined,
                              })
                            }
                            placeholder="幅（省略時は変更なし）"
                            className="window-config-input-number"
                          />
                        </div>
                        <div className="window-config-row">
                          <label className="window-config-label">高さ:</label>
                          <input
                            type="number"
                            value={item.windowConfig?.height ?? ''}
                            onChange={(e) =>
                              handleItemChange(index, 'windowConfig', {
                                ...item.windowConfig,
                                title: item.windowConfig?.title || '',
                                height: e.target.value ? parseInt(e.target.value, 10) : undefined,
                              })
                            }
                            placeholder="高さ（省略時は変更なし）"
                            className="window-config-input-number"
                          />
                        </div>
                        <button
                          type="button"
                          className="get-window-btn"
                          onClick={() => openWindowSelector(index)}
                        >
                          ウィンドウから取得
                        </button>
                      </div>
                    </div>

                    {items.length > 1 && <hr />}
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                {editingItem && onDelete && (
                  <button onClick={handleDelete} className="danger">
                    削除
                  </button>
                )}
                <div className="modal-actions-right">
                  <button onClick={handleCancel}>キャンセル</button>
                  <button onClick={validateAndRegister} className="primary">
                    {editingItem ? '更新' : '登録'}
                  </button>
                </div>
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

      {/* ウィンドウ選択ダイアログ */}
      <WindowSelectorModal
        isOpen={windowSelectorOpen}
        onClose={() => setWindowSelectorOpen(false)}
        onSelect={onWindowSelected}
      />
    </>
  );
};

export default RegisterModal;

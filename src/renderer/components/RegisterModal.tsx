import React, { useEffect, useRef, useState } from 'react';
import type {
  RegisterItem,
  EditingAppItem,
  EditableJsonItem,
  WindowInfo,
  LauncherItem,
} from '@common/types';

import { useCustomIcon } from '../hooks/useCustomIcon';
import { useRegisterForm } from '../hooks/useRegisterForm';
import { debugLog, logError } from '../utils/debug';
import { getPathsFromDropEvent } from '../utils/fileDropUtils';

import GroupItemSelectorModal from './GroupItemSelectorModal';
import FilePickerDialog from './FilePickerDialog';
import DirOptionsEditor from './DirOptionsEditor';
import WindowSelectorModal from './WindowSelectorModal';
import WindowConfigEditor from './WindowConfigEditor';
import CustomIconEditor from './CustomIconEditor';
import UrlConverterMenu from './UrlConverterMenu';
import IconFetchButton from './IconFetchButton';
import { Button } from './ui';
import '../styles/components/UrlConverterMenu.css';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (items: RegisterItem[]) => void;
  droppedPaths: string[];
  editingItem?: EditingAppItem | EditableJsonItem | null;
  currentTab?: string; // 現在開いているタブ
  onDelete?: (item: EditingAppItem | EditableJsonItem) => void; // 削除ハンドラー
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

  // オプションセクションの開閉状態管理
  const [optionsSectionOpen, setOptionsSectionOpen] = useState<boolean[]>([]);

  // モーダル内ドラッグ&ドロップの状態管理
  const [isDraggingOverModal, setIsDraggingOverModal] = useState(false);

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
    dataFileLabels,
    selectorModalOpen,
    editingItemIndex,
    iconFetchLoading,
    handleItemChange,
    handlePathBlur,
    validateAndRegister,
    handleCancel,
    handleAddGroupItem,
    handleSelectGroupItem,
    handleRemoveGroupItem,
    updateItem,
    handleTargetTabChange,
    handleFetchIcon,
    setEditingItemIndex,
    setSelectorModalOpen,
    addItemsFromPaths: _addItemsFromPaths,
    replaceFirstItemFromPath,
  } = useRegisterForm(
    isOpen,
    editingItem,
    droppedPaths,
    currentTab,
    loadCustomIconPreview,
    onClose,
    onRegister
  );

  // items配列の長さが変わったときにオプション開閉状態を初期化
  useEffect(() => {
    setOptionsSectionOpen(items.map(() => false));
  }, [items.length]);

  // ドラッグ操作がキャンセルされた場合の処理（モーダル外でドロップされた場合など）
  useEffect(() => {
    if (!isOpen) return;

    const resetDragState = () => setIsDraggingOverModal(false);

    document.addEventListener('dragend', resetDragState);

    return () => {
      document.removeEventListener('dragend', resetDragState);
    };
  }, [isOpen]);

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
        // モーダル内でのTab操作なので、すべての場合で背景への伝播を阻止
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
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

    // 必要サイズを設定
    const requiredWidth = 850;
    const requiredHeight = 1000;

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

    // ウィンドウ情報から設定を作成
    if (item.itemCategory === 'window') {
      // ウィンドウ操作アイテムの場合
      const windowOperationConfig = {
        displayName: item.displayName,
        windowTitle: window.title,
        processName: window.processName,
        x: window.x,
        y: window.y,
        width: window.width,
        height: window.height,
      };
      handleItemChange(windowSelectorItemIndex, 'windowOperationConfig', windowOperationConfig);
    } else {
      // 単一アイテムの場合
      const windowConfig = {
        title: window.title,
        processName: window.processName,
        x: window.x,
        y: window.y,
        width: window.width,
        height: window.height,
      };
      handleItemChange(windowSelectorItemIndex, 'windowConfig', windowConfig);
    }
  };

  // アイテム削除ハンドラー
  const handleDelete = () => {
    if (editingItem && onDelete) {
      onDelete(editingItem);
    }
  };

  // オプションセクションの開閉切り替え
  const toggleOptionsSection = (index: number) => {
    setOptionsSectionOpen((prev) => {
      const newState = [...prev];
      newState[index] = !newState[index];
      return newState;
    });
  };

  // モーダル内ドラッグ&ドロップハンドラー
  const handleModalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverModal(true);
  };

  const handleModalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // relatedTargetがモーダル内にある場合は何もしない（子要素間の移動）
    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) {
      return;
    }

    // モーダルの外に出た場合のみfalseにする
    setIsDraggingOverModal(false);
  };

  const handleModalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverModal(false);

    const paths = getPathsFromDropEvent(e);
    if (paths.length === 0) {
      return;
    }

    // 最初のファイルのみを使用して、現在の最初のアイテムを完全に置き換える
    if (items.length > 0) {
      await replaceFirstItemFromPath(paths[0]);
    }
  };

  // RegisterItemをLauncherItemに変換する関数
  const convertToLauncherItem = (item: RegisterItem): LauncherItem | null => {
    if (item.itemCategory === 'dir' || item.itemCategory === 'group') {
      // フォルダ取込とグループは直接実行不可
      return null;
    }

    if (item.itemCategory === 'window') {
      // ウィンドウ操作アイテムは別処理
      return null;
    }

    // 単一アイテムの場合
    return {
      displayName: item.displayName,
      path: item.path,
      type: item.type,
      args: item.args,
      customIcon: item.customIcon,
      windowConfig: item.windowConfig,
    };
  };

  // 実行ボタンのハンドラー
  const handleExecute = async () => {
    if (items.length === 0) return;

    const item = items[0]; // 最初のアイテムを実行

    // ウィンドウが閉じないように、一時的にピンモードを変更
    const originalPinMode = await window.electronAPI.getWindowPinMode();
    let pinModeChanged = false;

    try {
      // ピンモードがnormalの場合、一時的にalwaysOnTopに変更
      if (originalPinMode === 'normal') {
        await window.electronAPI.cycleWindowPinMode(); // normal -> alwaysOnTop
        pinModeChanged = true;
      }

      if (item.itemCategory === 'window') {
        // ウィンドウ操作アイテムの場合
        if (!item.windowOperationConfig) {
          logError('ウィンドウ操作設定が不足しています');
          return;
        }

        await window.electronAPI.executeWindowOperation({
          displayName: item.displayName,
          type: 'window',
          windowTitle: item.windowOperationConfig.windowTitle,
          processName: item.windowOperationConfig.processName,
          x: item.windowOperationConfig.x,
          y: item.windowOperationConfig.y,
          width: item.windowOperationConfig.width,
          height: item.windowOperationConfig.height,
          moveToActiveMonitorCenter: item.windowOperationConfig.moveToActiveMonitorCenter,
          virtualDesktopNumber: item.windowOperationConfig.virtualDesktopNumber,
          activateWindow: item.windowOperationConfig.activateWindow,
          pinToAllDesktops: item.windowOperationConfig.pinToAllDesktops,
        });
      } else if (item.itemCategory === 'group') {
        debugLog('グループアイテムは実行ボタンからは実行できません');
        // 注: グループ実行は登録後、メインウィンドウから実行可能
      } else if (item.itemCategory === 'dir') {
        debugLog('フォルダ取込アイテムは実行ボタンからは実行できません');
      } else {
        // 単一アイテムの場合
        const launcherItem = convertToLauncherItem(item);
        if (launcherItem) {
          await window.electronAPI.openItem(launcherItem);
        }
      }
    } catch (error) {
      logError('アイテムの実行に失敗しました:', error);
    } finally {
      // 元のピンモードに戻す
      if (pinModeChanged) {
        await window.electronAPI.cycleWindowPinMode(); // alwaysOnTop -> normal
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
        <div
          className={`modal-content register-modal ${isDraggingOverModal ? 'dragging-over' : ''}`}
          onClick={(e) => e.stopPropagation()}
          onDragOver={handleModalDragOver}
          onDragLeave={handleModalDragLeave}
          onDrop={handleModalDrop}
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

                    {/* 保存先タブと保存先ファイルを最上部に配置 */}
                    <div className="form-row">
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
                                    {dataFileLabels[file] || file}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )
                        );
                      })()}
                    </div>

                    <div className="form-group">
                      <label>種別:</label>
                      <select
                        value={item.itemCategory}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            'itemCategory',
                            e.target.value as 'item' | 'dir' | 'group' | 'window'
                          )
                        }
                      >
                        <option value="item">📄 単一アイテム</option>
                        <option value="dir">🗂️ フォルダ取込</option>
                        <option value="group">📦 グループ</option>
                        <option value="window">🪟 ウィンドウ操作</option>
                      </select>
                    </div>

                    {item.itemCategory !== 'dir' && (
                      <div className="form-group">
                        <label>アイテム表示名:</label>
                        <input
                          type="text"
                          value={item.displayName}
                          className={errors[index]?.displayName ? 'error' : ''}
                          onChange={(e) => handleItemChange(index, 'displayName', e.target.value)}
                          placeholder={
                            item.itemCategory === 'group'
                              ? 'グループ名を入力'
                              : 'アイテム表示名を入力'
                          }
                        />
                        {errors[index]?.displayName && (
                          <span className="error-message">{errors[index].displayName}</span>
                        )}
                      </div>
                    )}

                    {item.itemCategory !== 'group' && item.itemCategory !== 'window' && (
                      <div className="form-group path-input-group">
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
                          onBlur={() => handlePathBlur(index)}
                          placeholder="ファイルパス、URL、またはカスタムURIを入力"
                        />
                        <IconFetchButton
                          path={item.path}
                          loading={iconFetchLoading[index] || false}
                          onFetch={() => handleFetchIcon(index)}
                          itemType={item.type}
                        />
                        <UrlConverterMenu
                          url={item.path}
                          onConvert={(convertedUrl) =>
                            handleItemChange(index, 'path', convertedUrl)
                          }
                          itemType={item.type}
                        />
                        {errors[index]?.path && (
                          <span className="error-message">{errors[index].path}</span>
                        )}
                      </div>
                    )}

                    {item.itemCategory === 'group' && (
                      <div className="form-group vertical-layout">
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

                    {/* オプション設定（折りたたみ可能） */}
                    {(item.itemCategory === 'item' || item.itemCategory === 'dir') && (
                      <div className="options-section">
                        <button
                          type="button"
                          className="options-toggle"
                          onClick={() => toggleOptionsSection(index)}
                        >
                          <span className="toggle-icon">
                            {optionsSectionOpen[index] ? '▼' : '▶'}
                          </span>
                          {item.itemCategory === 'item'
                            ? 'オプション設定（引数・アイコン）'
                            : 'フォルダ取り込みオプション'}
                        </button>

                        {optionsSectionOpen[index] && (
                          <div className="options-content">
                            {item.itemCategory === 'item' && (
                              <>
                                <div className="form-group">
                                  <label>引数:</label>
                                  <input
                                    type="text"
                                    value={item.args || ''}
                                    onChange={(e) =>
                                      handleItemChange(index, 'args', e.target.value)
                                    }
                                    placeholder="コマンドライン引数（実行ファイルやアプリの場合のみ有効）"
                                  />
                                </div>

                                <CustomIconEditor
                                  customIconPreview={customIconPreviews[index]}
                                  onSelectClick={() => openCustomIconPicker(index)}
                                  onDeleteClick={() => onCustomIconDeleted(index)}
                                />
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
                          </div>
                        )}
                      </div>
                    )}

                    {/* ウィンドウ切り替え設定（並列に配置） */}
                    {item.itemCategory === 'item' && (
                      <WindowConfigEditor
                        windowConfig={item.windowConfig}
                        onChange={(windowConfig) =>
                          handleItemChange(index, 'windowConfig', windowConfig)
                        }
                        onGetWindowClick={() => openWindowSelector(index)}
                        defaultExpanded={false}
                      />
                    )}

                    {/* ウィンドウ操作設定 */}
                    {item.itemCategory === 'window' && (
                      <div>
                        <WindowConfigEditor
                          windowConfig={
                            item.windowOperationConfig
                              ? {
                                  title: item.windowOperationConfig.windowTitle,
                                  processName: item.windowOperationConfig.processName,
                                  x: item.windowOperationConfig.x,
                                  y: item.windowOperationConfig.y,
                                  width: item.windowOperationConfig.width,
                                  height: item.windowOperationConfig.height,
                                  moveToActiveMonitorCenter:
                                    item.windowOperationConfig.moveToActiveMonitorCenter,
                                  virtualDesktopNumber:
                                    item.windowOperationConfig.virtualDesktopNumber,
                                  activateWindow: item.windowOperationConfig.activateWindow,
                                  pinToAllDesktops: item.windowOperationConfig.pinToAllDesktops,
                                }
                              : { title: '' }
                          }
                          onChange={(windowConfig) =>
                            handleItemChange(index, 'windowOperationConfig', {
                              displayName: item.displayName,
                              windowTitle: windowConfig?.title || '',
                              processName: windowConfig?.processName,
                              x: windowConfig?.x,
                              y: windowConfig?.y,
                              width: windowConfig?.width,
                              height: windowConfig?.height,
                              moveToActiveMonitorCenter: windowConfig?.moveToActiveMonitorCenter,
                              virtualDesktopNumber: windowConfig?.virtualDesktopNumber,
                              activateWindow: windowConfig?.activateWindow,
                              pinToAllDesktops: windowConfig?.pinToAllDesktops,
                            })
                          }
                          onGetWindowClick={() => openWindowSelector(index)}
                          showToggle={false}
                          defaultExpanded={false}
                        />
                        {errors[index]?.displayName && (
                          <div className="form-group">
                            <span className="error-message">{errors[index].displayName}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* グループの場合はカスタムアイコンのみ表示 */}
                    {item.itemCategory === 'group' && (
                      <CustomIconEditor
                        customIconPreview={customIconPreviews[index]}
                        onSelectClick={() => openCustomIconPicker(index)}
                        onDeleteClick={() => onCustomIconDeleted(index)}
                      />
                    )}

                    {/* メモ入力欄（全アイテムタイプ共通） */}
                    <div className="form-group">
                      <label>メモ:</label>
                      <textarea
                        value={item.memo || ''}
                        onChange={(e) => handleItemChange(index, 'memo', e.target.value)}
                        placeholder="自由にメモを入力（任意）"
                        rows={3}
                        className="memo-textarea"
                      />
                    </div>

                    {items.length > 1 && <hr />}
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                {items.length > 0 &&
                  items[0].itemCategory !== 'dir' &&
                  items[0].itemCategory !== 'group' && (
                    <Button variant="primary" onClick={handleExecute}>
                      ⚡ 試しに実行
                    </Button>
                  )}
                <div className="modal-actions-right">
                  {editingItem && onDelete && (
                    <Button variant="danger" onClick={handleDelete}>
                      削除
                    </Button>
                  )}
                  <Button variant="cancel" onClick={handleCancel}>
                    キャンセル
                  </Button>
                  <Button variant="primary" onClick={validateAndRegister}>
                    {editingItem ? '更新' : '登録'}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* モーダル内ドラッグ&ドロップオーバーレイ */}
          {isDraggingOverModal && (
            <div className="drag-overlay">
              <div className="drag-message">ファイルをドロップして追加</div>
            </div>
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

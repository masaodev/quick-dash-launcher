import React, { useEffect, useRef, useState } from 'react';
import type {
  RegisterItem,
  EditingAppItem,
  EditableJsonItem,
  WindowInfo,
  LauncherItem,
} from '@common/types';
import { isJsonLauncherItem } from '@common/types';
import {
  mergeWindowInfoIntoLayoutEntry,
  buildLayoutItemFromRegisterItem,
} from '@common/utils/layoutUtils';

import { useCustomIcon } from '../hooks/useCustomIcon';
import { useRegisterForm } from '../hooks/useRegisterForm';
import { useToast } from '../hooks/useToast';
import { debugLog, logError } from '../utils/debug';
import { getPathsFromDropEvent } from '../utils/fileDropUtils';
import {
  fetchMatchingWindow,
  toWindowConfig,
  toWindowOperationConfig,
} from '../utils/windowFilter';

import GroupItemSelectorModal from './GroupItemSelectorModal';
import FilePickerDialog from './FilePickerDialog';
import DirOptionsEditor from './DirOptionsEditor';
import WindowSelectorModal from './WindowSelectorModal';
import WindowConfigEditor from './WindowConfigEditor';
import CustomIconEditor from './CustomIconEditor';
import UrlConverterMenu from './UrlConverterMenu';
import IconFetchButton from './IconFetchButton';
import ClipboardItemEditor from './ClipboardItemEditor';
import LayoutCaptureModal from './LayoutCaptureModal';
import LayoutEntryEditor from './LayoutEntryEditor';
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

function getDisplayNamePlaceholder(itemCategory: string): string {
  switch (itemCategory) {
    case 'group':
      return 'グループ名を入力';
    case 'clipboard':
      return 'クリップボードアイテム名を入力';
    default:
      return 'アイテム表示名を入力';
  }
}

const NON_EXECUTABLE_CATEGORIES = ['dir', 'group', 'clipboard'] as const;

/**
 * 編集中のアイテムが自動取込で管理されているかを判定する
 */
function isAutoImportItem(editingItem: EditingAppItem | EditableJsonItem): boolean {
  // EditableJsonItem（管理画面から）
  if ('item' in editingItem && 'meta' in editingItem) {
    const jsonItem = (editingItem as EditableJsonItem).item;
    return isJsonLauncherItem(jsonItem) && !!jsonItem.autoImportRuleId;
  }
  // EditingAppItem（ランチャーから）
  return 'autoImportRuleId' in editingItem && !!(editingItem as LauncherItem).autoImportRuleId;
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

  const [windowSelectorOpen, setWindowSelectorOpen] = useState(false);
  const [windowSelectorItemIndex, setWindowSelectorItemIndex] = useState<number | null>(null);
  const [layoutCaptureOpen, setLayoutCaptureOpen] = useState(false);
  const [layoutCaptureItemIndex, setLayoutCaptureItemIndex] = useState<number | null>(null);
  const [layoutEntryWindowSelectorIndex, setLayoutEntryWindowSelectorIndex] = useState<{
    itemIndex: number;
    entryIndex: number;
  } | null>(null);
  const [optionsSectionOpen, setOptionsSectionOpen] = useState<boolean[]>([]);
  const [isDraggingOverModal, setIsDraggingOverModal] = useState(false);

  const { showError } = useToast();

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

  useEffect(() => {
    setOptionsSectionOpen(items.map(() => false));
  }, [items.length]);

  useEffect(() => {
    if (!isOpen) return;

    const resetDragState = () => setIsDraggingOverModal(false);
    document.addEventListener('dragend', resetDragState);
    return () => document.removeEventListener('dragend', resetDragState);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = 'auto';
      window.electronAPI.setModalMode(false);
      clearCustomIconPreviews();
      return;
    }

    document.body.style.overflow = 'hidden';
    modalRef.current?.focus();

    const suppressEvent = (event: KeyboardEvent, preventDefault = true) => {
      if (preventDefault) event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const modal = modalRef.current;
      if (!modal) return;

      if (event.key === 'Escape') {
        // GroupItemSelectorModalが表示されている場合は、そちらに任せる
        if (document.querySelector('.group-item-selector-modal')) return;
        suppressEvent(event);
        handleCancel();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstEl = focusableElements[0] as HTMLElement;
        const lastEl = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey && document.activeElement === firstEl) {
          lastEl.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          firstEl.focus();
        }
        suppressEvent(event);
        return;
      }

      if (!modal.contains(document.activeElement)) return;

      const activeElement = document.activeElement as HTMLElement;
      const isInputField =
        activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      if (isInputField) {
        const allowedKeys = new Set([
          'Backspace',
          'Delete',
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Home',
          'End',
          'Enter',
        ]);
        const allowedCtrlKeys = new Set(['a', 'c', 'v', 'x', 'z', 'y']);
        const isAllowedKey =
          event.key.length === 1 ||
          allowedKeys.has(event.key) ||
          (event.ctrlKey && allowedCtrlKeys.has(event.key));

        if (isAllowedKey) {
          suppressEvent(event, false);
          return;
        }
      }

      suppressEvent(event);
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, droppedPaths, editingItem]);

  useEffect(() => {
    if (!isOpen || items.length === 0) return;

    window.electronAPI.setModalMode(true, { width: 850, height: 1000 });
  }, [isOpen, items]);

  const onCustomIconSelected = async (filePath: string): Promise<void> => {
    const item = items[filePickerState.itemIndex!];
    await handleCustomIconFileSelected(filePath, item.path, (index, customIconFileName) => {
      updateItem(index, { customIcon: customIconFileName });
    });
  };

  const onCustomIconDeleted = async (index: number): Promise<void> => {
    const item = items[index];
    if (item.customIcon) {
      await deleteCustomIcon(index, item.customIcon, (idx) => {
        updateItem(idx, { customIcon: undefined });
      });
    }
  };

  const openWindowSelector = (index: number): void => {
    setWindowSelectorItemIndex(index);
    setWindowSelectorOpen(true);
  };

  const createFetchFromWindow = (index: number): (() => Promise<WindowInfo | null>) => {
    return () => fetchMatchingWindow(items[index]);
  };

  const onWindowSelected = (window: WindowInfo): void => {
    // レイアウトエントリのウィンドウ選択
    if (layoutEntryWindowSelectorIndex !== null) {
      const { itemIndex, entryIndex } = layoutEntryWindowSelectorIndex;
      const item = items[itemIndex];
      if (!item) return;
      const currentEntries = [...(item.layoutEntries || [])];
      if (entryIndex < currentEntries.length) {
        currentEntries[entryIndex] = mergeWindowInfoIntoLayoutEntry(
          currentEntries[entryIndex],
          window
        );
        updateItem(itemIndex, { layoutEntries: currentEntries });
      }
      setLayoutEntryWindowSelectorIndex(null);
      return;
    }

    if (windowSelectorItemIndex === null) return;

    const item = items[windowSelectorItemIndex];
    if (!item) return;

    if (item.itemCategory === 'window') {
      const currentConfig = item.windowOperationConfig;
      const windowOperationConfig = {
        ...currentConfig,
        displayName: item.displayName,
        windowTitle: window.title,
        processName: window.processName,
      };
      handleItemChange(windowSelectorItemIndex, 'windowOperationConfig', windowOperationConfig);
    } else {
      const currentConfig = item.windowConfig;
      const windowConfig = {
        ...currentConfig,
        title: window.title,
        processName: window.processName,
      };
      handleItemChange(windowSelectorItemIndex, 'windowConfig', windowConfig);
    }
  };

  const handleDelete = (): void => {
    if (editingItem && onDelete) {
      onDelete(editingItem);
    }
  };

  const toggleOptionsSection = (index: number): void => {
    setOptionsSectionOpen((prev) => {
      const newState = [...prev];
      newState[index] = !newState[index];
      return newState;
    });
  };

  const handleModalDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverModal(true);
  };

  const handleModalDragLeave = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;

    setIsDraggingOverModal(false);
  };

  const handleModalDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverModal(false);

    const paths = getPathsFromDropEvent(e);
    if (paths.length === 0) return;

    if (items.length > 0) {
      await replaceFirstItemFromPath(paths[0]);
    }
  };

  const convertToLauncherItem = (item: RegisterItem): LauncherItem | null => {
    if (
      item.itemCategory === 'dir' ||
      item.itemCategory === 'group' ||
      item.itemCategory === 'window' ||
      item.itemCategory === 'layout'
    ) {
      return null;
    }

    if (item.itemCategory === 'clipboard') {
      return {
        displayName: item.displayName,
        path: '',
        type: 'clipboard',
        customIcon: item.customIcon,
        clipboardDataRef: item.clipboardDataRef,
        clipboardFormats: item.clipboardFormats,
        clipboardSavedAt: item.clipboardSavedAt,
      };
    }

    return {
      displayName: item.displayName,
      path: item.path,
      type: item.type,
      args: item.args,
      customIcon: item.customIcon,
      windowConfig: item.windowConfig,
    };
  };

  const handleExecute = async (): Promise<void> => {
    if (items.length === 0) return;

    const item = items[0];
    const originalPinMode = await window.electronAPI.getWindowPinMode();
    let pinModeChanged = false;

    try {
      if (originalPinMode === 'normal') {
        await window.electronAPI.cycleWindowPinMode();
        pinModeChanged = true;
      }

      if (item.itemCategory === 'window') {
        if (!item.windowOperationConfig) {
          logError('ウィンドウ操作設定が不足しています');
          return;
        }

        await window.electronAPI.executeWindowOperation({
          ...item.windowOperationConfig,
          displayName: item.displayName,
          type: 'window',
        });
      } else if (item.itemCategory === 'layout') {
        await window.electronAPI.executeLayout(buildLayoutItemFromRegisterItem(item));
      } else if (item.itemCategory === 'group') {
        debugLog('グループアイテムは実行ボタンからは実行できません');
      } else if (item.itemCategory === 'dir') {
        debugLog('フォルダ取込アイテムは実行ボタンからは実行できません');
      } else {
        const launcherItem = convertToLauncherItem(item);
        if (launcherItem) {
          await window.electronAPI.openItem(launcherItem);
        }
      }
    } catch (error) {
      logError('アイテムの実行に失敗しました:', error);
    } finally {
      if (pinModeChanged) {
        await window.electronAPI.cycleWindowPinMode();
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

          {editingItem && isAutoImportItem(editingItem) && (
            <div className="auto-import-warning">
              このアイテムはブックマーク自動取込で管理されています。編集しても、次回の自動取込実行時に上書きされます。
            </div>
          )}

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
                            e.target.value as
                              | 'item'
                              | 'dir'
                              | 'group'
                              | 'window'
                              | 'clipboard'
                              | 'layout'
                          )
                        }
                      >
                        <option value="item">📄 単一アイテム</option>
                        <option value="dir">🗂️ フォルダ取込</option>
                        <option value="group">📦 グループ</option>
                        <option value="window">🪟 ウィンドウ操作</option>
                        <option value="clipboard">📋 クリップボード</option>
                        <option value="layout">🖥️ ウィンドウレイアウト</option>
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
                          placeholder={getDisplayNamePlaceholder(item.itemCategory)}
                        />
                        {errors[index]?.displayName && (
                          <span className="error-message">{errors[index].displayName}</span>
                        )}
                      </div>
                    )}

                    {item.itemCategory !== 'group' &&
                      item.itemCategory !== 'window' &&
                      item.itemCategory !== 'clipboard' &&
                      item.itemCategory !== 'layout' && (
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

                    {item.itemCategory === 'item' && (
                      <WindowConfigEditor
                        windowConfig={item.windowConfig}
                        onChange={(windowConfig) =>
                          handleItemChange(index, 'windowConfig', windowConfig)
                        }
                        onGetWindowClick={() => openWindowSelector(index)}
                        onFetchFromWindow={createFetchFromWindow(index)}
                        defaultExpanded={false}
                      />
                    )}

                    {item.itemCategory === 'window' && (
                      <div>
                        <WindowConfigEditor
                          windowConfig={
                            item.windowOperationConfig
                              ? toWindowConfig(item.windowOperationConfig)
                              : { title: '' }
                          }
                          onChange={(wc) =>
                            handleItemChange(
                              index,
                              'windowOperationConfig',
                              toWindowOperationConfig(item.displayName, wc)
                            )
                          }
                          onGetWindowClick={() => openWindowSelector(index)}
                          onFetchFromWindow={createFetchFromWindow(index)}
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

                    {item.itemCategory === 'clipboard' && (
                      <>
                        <ClipboardItemEditor
                          capturedData={
                            item.clipboardDataRef
                              ? {
                                  dataFileRef: item.clipboardDataRef,
                                  preview: item.clipboardPreview,
                                  formats: item.clipboardFormats || [],
                                  savedAt: item.clipboardSavedAt || Date.now(),
                                }
                              : undefined
                          }
                          sessionData={
                            item.clipboardSessionId
                              ? {
                                  sessionId: item.clipboardSessionId,
                                  preview: item.clipboardPreview,
                                  formats: item.clipboardFormats || [],
                                  capturedAt: item.clipboardSavedAt || Date.now(),
                                }
                              : undefined
                          }
                          onCapture={(result) => {
                            const updates: Partial<RegisterItem> = {
                              clipboardSessionId: result.sessionId,
                              clipboardFormats: result.formats,
                              clipboardSavedAt: result.capturedAt,
                              clipboardPreview: result.preview || '',
                            };
                            if (!item.displayName) {
                              const preview = result.preview || 'クリップボード';
                              updates.displayName =
                                preview.length > 30 ? preview.substring(0, 30) + '...' : preview;
                            }
                            updateItem(index, updates);
                          }}
                          onError={(error) => {
                            debugLog('クリップボードキャプチャエラー:', error);
                            showError(error);
                          }}
                        />
                        {errors[index]?.path && (
                          <span className="error-message">{errors[index].path}</span>
                        )}
                      </>
                    )}

                    {item.itemCategory === 'layout' && (
                      <>
                        <LayoutEntryEditor
                          entries={item.layoutEntries || []}
                          onChange={(entries) => updateItem(index, { layoutEntries: entries })}
                          onCaptureClick={() => {
                            setLayoutCaptureItemIndex(index);
                            setLayoutCaptureOpen(true);
                          }}
                          onSelectWindow={(entryIndex) => {
                            setLayoutEntryWindowSelectorIndex({
                              itemIndex: index,
                              entryIndex,
                            });
                            setWindowSelectorOpen(true);
                          }}
                        />
                        {errors[index]?.path && (
                          <span className="error-message">{errors[index].path}</span>
                        )}
                      </>
                    )}

                    {(item.itemCategory === 'group' ||
                      item.itemCategory === 'clipboard' ||
                      item.itemCategory === 'layout') && (
                      <CustomIconEditor
                        customIconPreview={customIconPreviews[index]}
                        onSelectClick={() => openCustomIconPicker(index)}
                        onDeleteClick={() => onCustomIconDeleted(index)}
                      />
                    )}

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
                  !NON_EXECUTABLE_CATEGORIES.includes(
                    items[0].itemCategory as (typeof NON_EXECUTABLE_CATEGORIES)[number]
                  ) && (
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

          {isDraggingOverModal && (
            <div className="drag-overlay">
              <div className="drag-message">ファイルをドロップして追加</div>
            </div>
          )}
        </div>
      </div>

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

      <FilePickerDialog
        isOpen={filePickerState.isOpen}
        onClose={closeCustomIconPicker}
        onFileSelect={onCustomIconSelected}
        title="カスタムアイコンを選択"
        fileTypes="image"
        description="アイコンとして使用する画像ファイルを選択してください。"
      />

      <WindowSelectorModal
        isOpen={windowSelectorOpen}
        onClose={() => setWindowSelectorOpen(false)}
        onSelect={onWindowSelected}
      />

      <LayoutCaptureModal
        isOpen={layoutCaptureOpen}
        onClose={() => setLayoutCaptureOpen(false)}
        onCapture={(entries) => {
          if (layoutCaptureItemIndex !== null) {
            const existing = items[layoutCaptureItemIndex]?.layoutEntries || [];
            updateItem(layoutCaptureItemIndex, { layoutEntries: [...existing, ...entries] });
          }
        }}
      />
    </>
  );
};

export default RegisterModal;

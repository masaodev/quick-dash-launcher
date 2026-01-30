import React, { useEffect, useRef, useState } from 'react';
import type { WorkspaceItem, WindowInfo, WindowConfig } from '@common/types';

import { useCustomIcon } from '../hooks/useCustomIcon';
import { useWorkspaceItemEditForm } from '../hooks/workspace/useWorkspaceItemEditForm';
import { logError } from '../utils/debug';

import GroupItemSelectorModal from './GroupItemSelectorModal';
import FilePickerDialog from './FilePickerDialog';
import WindowSelectorModal from './WindowSelectorModal';
import WindowConfigEditor from './WindowConfigEditor';
import CustomIconEditor from './CustomIconEditor';
import UrlConverterMenu from './UrlConverterMenu';
import { Button } from './ui';
import '../styles/components/UrlConverterMenu.css';

interface WorkspaceItemEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: WorkspaceItem | null;
  onSave: (id: string, updates: Partial<WorkspaceItem>) => Promise<void>;
}

/**
 * ワークスペースアイテム編集モーダル
 *
 * ワークスペースアイテムの全フィールド（path, args, customIcon, windowConfig等）を
 * 編集するためのモーダルダイアログ。
 */
const WorkspaceItemEditModal: React.FC<WorkspaceItemEditModalProps> = ({
  isOpen,
  onClose,
  editingItem,
  onSave,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [windowSelectorOpen, setWindowSelectorOpen] = useState(false);

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
    item,
    loading,
    errors,
    selectorModalOpen,
    handleFieldChange,
    handlePathBlur,
    handleSave,
    handleCancel,
    handleAddGroupItem,
    handleSelectGroupItem,
    handleRemoveGroupItem,
    updateItem,
    setSelectorModalOpen,
  } = useWorkspaceItemEditForm(isOpen, editingItem, loadCustomIconPreview, onClose, onSave);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = 'auto';
      window.electronAPI.workspaceAPI.setModalMode(false);
      clearCustomIconPreviews();
      return;
    }

    document.body.style.overflow = 'hidden';
    modalRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      const modal = modalRef.current;
      if (!modal) return;

      const isModalFocused = modal.contains(document.activeElement);

      if (event.key === 'Escape') {
        const groupSelectorModal = document.querySelector('.group-item-selector-modal');
        if (groupSelectorModal) return;

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
          if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        } else {
          if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        }
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      if (isModalFocused) {
        const activeElement = document.activeElement as HTMLElement;
        const isInputField =
          activeElement &&
          (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');

        if (isInputField) {
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
            event.stopPropagation();
            event.stopImmediatePropagation();
            return;
          }
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, editingItem, handleCancel]);

  useEffect(() => {
    if (!isOpen || !item) return;

    const requiredWidth = 850;
    const requiredHeight = 800;

    window.electronAPI.workspaceAPI.setModalMode(true, {
      width: requiredWidth,
      height: requiredHeight,
    });
  }, [isOpen, item]);

  const onCustomIconSelected = async (filePath: string) => {
    if (!item) return;
    await handleCustomIconFileSelected(
      filePath,
      item.path || editingItem?.id || '',
      (_, customIconFileName) => {
        updateItem({ customIcon: customIconFileName });
      }
    );
  };

  const onCustomIconDeleted = async () => {
    if (!item?.customIcon) return;
    await deleteCustomIcon(0, item.customIcon, () => {
      updateItem({ customIcon: undefined });
    });
  };

  const onWindowSelected = (windowInfo: WindowInfo) => {
    if (!item) return;

    if (item.itemCategory === 'window') {
      const windowOperationConfig = {
        displayName: item.displayName,
        windowTitle: windowInfo.title,
        processName: windowInfo.processName,
        x: windowInfo.x,
        y: windowInfo.y,
        width: windowInfo.width,
        height: windowInfo.height,
      };
      handleFieldChange('windowOperationConfig', windowOperationConfig);
    } else {
      const windowConfig: WindowConfig = {
        title: windowInfo.title,
        processName: windowInfo.processName,
        x: windowInfo.x,
        y: windowInfo.y,
        width: windowInfo.width,
        height: windowInfo.height,
      };
      handleFieldChange('windowConfig', windowConfig);
    }

    setWindowSelectorOpen(false);
  };

  const handleExecute = async () => {
    if (!item || !editingItem) return;

    const originalPinMode = await window.electronAPI.workspaceAPI.getAlwaysOnTop();
    let pinModeChanged = false;

    try {
      if (!originalPinMode) {
        await window.electronAPI.workspaceAPI.toggleAlwaysOnTop();
        pinModeChanged = true;
      }

      if (item.itemCategory === 'window') {
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
      } else if (item.itemCategory !== 'group') {
        await window.electronAPI.workspaceAPI.launchItem(editingItem);
      }
    } catch (error) {
      logError('アイテムの実行に失敗しました:', error);
    } finally {
      if (pinModeChanged) {
        await window.electronAPI.workspaceAPI.toggleAlwaysOnTop();
      }
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
          <h2>ワークスペースアイテムの編集</h2>

          {loading ? (
            <div className="loading">アイテム情報を読み込み中...</div>
          ) : item ? (
            <>
              <div className="register-items">
                <div className="register-item">
                  <div className="form-group">
                    <label>種別:</label>
                    <select value={item.itemCategory} disabled>
                      <option value="item">単一アイテム</option>
                      <option value="group">グループ</option>
                      <option value="window">ウィンドウ操作</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>アイテム表示名:</label>
                    <input
                      type="text"
                      value={item.displayName}
                      className={errors.displayName ? 'error' : ''}
                      onChange={(e) => handleFieldChange('displayName', e.target.value)}
                      placeholder={
                        item.itemCategory === 'group' ? 'グループ名を入力' : 'アイテム表示名を入力'
                      }
                    />
                    {errors.displayName && (
                      <span className="error-message">{errors.displayName}</span>
                    )}
                  </div>

                  {item.itemCategory !== 'group' && item.itemCategory !== 'window' && (
                    <div className="form-group">
                      <label>パス:</label>
                      <input
                        type="text"
                        value={item.path}
                        className={errors.path ? 'error' : ''}
                        onChange={(e) => handleFieldChange('path', e.target.value)}
                        onBlur={() => handlePathBlur()}
                        placeholder="ファイルパス、URL、またはカスタムURIを入力"
                      />
                      {errors.path && <span className="error-message">{errors.path}</span>}
                      <UrlConverterMenu
                        url={item.path}
                        onConvert={(convertedUrl) => handleFieldChange('path', convertedUrl)}
                      />
                    </div>
                  )}

                  {item.itemCategory === 'item' && (
                    <div className="form-group">
                      <label>引数:</label>
                      <input
                        type="text"
                        value={item.args || ''}
                        onChange={(e) => handleFieldChange('args', e.target.value)}
                        placeholder="コマンドライン引数（実行ファイルやアプリの場合のみ有効）"
                      />
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
                                  onClick={() => handleRemoveGroupItem(nameIndex)}
                                  title="削除"
                                >
                                  x
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
                          onClick={handleAddGroupItem}
                        >
                          + アイテムを追加
                        </button>
                      </div>
                      {errors.groupItemNames && (
                        <span className="error-message">{errors.groupItemNames}</span>
                      )}
                      <small>
                        メインデータの既存アイテムから選択してください。グループ実行時に順番に起動されます。
                      </small>
                    </div>
                  )}

                  {(item.itemCategory === 'item' || item.itemCategory === 'group') && (
                    <CustomIconEditor
                      customIconPreview={customIconPreviews[0]}
                      onSelectClick={() => openCustomIconPicker(0)}
                      onDeleteClick={onCustomIconDeleted}
                    />
                  )}

                  {item.itemCategory === 'item' && (
                    <WindowConfigEditor
                      windowConfig={item.windowConfig}
                      onChange={(windowConfig) => handleFieldChange('windowConfig', windowConfig)}
                      onGetWindowClick={() => setWindowSelectorOpen(true)}
                      defaultExpanded={false}
                    />
                  )}

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
                          handleFieldChange('windowOperationConfig', {
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
                        onGetWindowClick={() => setWindowSelectorOpen(true)}
                        showToggle={false}
                        defaultExpanded={false}
                      />
                      {errors.displayName && (
                        <div className="form-group">
                          <span className="error-message">{errors.displayName}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                {item.itemCategory !== 'group' && (
                  <Button variant="primary" onClick={handleExecute}>
                    試しに実行
                  </Button>
                )}
                <div className="modal-actions-right">
                  <Button variant="cancel" onClick={handleCancel}>
                    キャンセル
                  </Button>
                  <Button variant="primary" onClick={handleSave}>
                    更新
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="loading">アイテムが見つかりません</div>
          )}
        </div>
      </div>

      <GroupItemSelectorModal
        isOpen={selectorModalOpen}
        onClose={() => setSelectorModalOpen(false)}
        onSelect={handleSelectGroupItem}
        excludeNames={item?.groupItemNames || []}
      />

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
    </>
  );
};

export default WorkspaceItemEditModal;
